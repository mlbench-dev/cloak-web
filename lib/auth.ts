import clientPromise from "@/lib/mongodb";
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { ObjectId } from "mongodb";

function expireToken(token: Record<string, unknown>) {
  delete token.id;
  delete token.username;
  delete token.isVerified;
  delete token.identityVerificationStatus;
  delete token.documentType;
  delete token.role;
  delete token.image;
  delete token.name;
  delete token.email;
  delete token.onboardingStartedAt;
  token.sessionExpired = true;
  return token;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days for fully onboarded users
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  debug: process.env.NODE_ENV === "development",
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "OTP",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        const client = await clientPromise;
        const db = client.db();
        const user = await db
          .collection("users")
          .findOne({ email: credentials.email });

        if (user) {
          return {
            id: user._id.toString(),
            email: user.email,
            username: user.username,
            image: user.image || user.profileImage,
            name: user.name,
            isVerified: user.isVerified,
            identityVerificationStatus: user.identityVerificationStatus,
            documentType: user.documentType,
            role: user.role,
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        try {
          console.log("Google sign-in callback started for:", user.email);
          const client = await clientPromise;
          const db = client.db();

          console.log("Searching for existing user...");
          // Manual user management to avoid separate 'accounts' collection
          const existingUser = await db
            .collection("users")
            .findOne({ email: user.email });

          if (existingUser) {
            console.log("Existing user found, updating...");
            // Update existing user with OAuth info and set emailVerified
            // Only update name and image if they are NOT already set in our DB
            const updatedData: any = {
              emailVerified: new Date(),
              updatedAt: new Date(),
              googleId: user.id,
            };

            // Prioritize existing DB data
            updatedData.name = existingUser.name || user.name;
            updatedData.image =
              existingUser.image || existingUser.profileImage || user.image;

            await db
              .collection("users")
              .updateOne({ _id: existingUser._id }, { $set: updatedData });
            // Update the user object for JWT/Session
            (user as any).id = existingUser._id.toString();
            (user as any).username = existingUser.username;
            (user as any).isVerified = existingUser.isVerified;
            (user as any).identityVerificationStatus =
              existingUser.identityVerificationStatus;
            (user as any).role = existingUser.role;
            (user as any).image = updatedData.image;
            (user as any).name = updatedData.name;
          } else {
            console.log("New user, creating record...");
            // Create new user for first time OAuth
            const result = await db.collection("users").insertOne({
              email: user.email,
              name: user.name,
              image: user.image,
              emailVerified: new Date(),
              isVerified: false,
              identityVerificationStatus: null,
              role: "USER",
              googleId: user.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            (user as any).id = result.insertedId.toString();
            (user as any).isVerified = false;
            (user as any).identityVerificationStatus = null;
            (user as any).role = "USER";
          }
          console.log("Google sign-in callback successful");
          return true;
        } catch (error) {
          console.error("Error in Google signIn callback:", error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      // If there's a user object (on initial sign-in) or we need to refresh data
      if (user) {
        token.id = (user as any).id || user.id;
        token.username = (user as any).username;
        token.isVerified = (user as any).isVerified || false;
        token.identityVerificationStatus =
          (user as any).identityVerificationStatus || null;
        token.documentType = (user as any).documentType || null;
        token.role = (user as any).role || "USER";
        token.image = (user as any).image || user.image;
        token.name = (user as any).name || user.name;
        token.onboardingStartedAt = new Date(); // Track when onboarding started
      }

      // If there's an id, fetch fresh user data from DB (to ensure session is up to date
      if (token.id) {
        try {
          const client = await clientPromise;
          const db = client.db();
          const userId = token.id;
          const userFromDb = await db
            .collection("users")
            .findOne({ _id: new ObjectId(userId) });
          if (userFromDb) {
            token.username = userFromDb.username || token.username;
            token.isVerified = userFromDb.isVerified || false;
            token.identityVerificationStatus =
              userFromDb.identityVerificationStatus || null;
            token.documentType = userFromDb.documentType || null;
            token.role = userFromDb.role || "USER";
            token.image =
              userFromDb.image || userFromDb.profileImage || token.image;
            token.name = userFromDb.name || token.name;
            token.email = userFromDb.email || token.email;

            // Check if onboarding is completed
            const onboardingCompleted = userFromDb.username && userFromDb.image;

            // If onboarding not completed, check if session should expire
            if (!onboardingCompleted && token.onboardingStartedAt) {
              const startedAt = new Date(token.onboardingStartedAt as string);
              const now = new Date();
              const minutesSinceStarted =
                (now.getTime() - startedAt.getTime()) / (1000 * 60);

              // Expire session after 5 minutes if onboarding not completed
              if (minutesSinceStarted > 5) {
                console.log(
                  `Session expired for incomplete onboarding, user: ${userFromDb.email}`,
                );
                return expireToken(token);
              }
            }
          }
        } catch (err) {
          console.error("Error fetching fresh user data for JWT:", err);
        }
      }

      if (trigger === "update") {
        if (session?.username) token.username = session.username;
        if (session?.image) token.image = session.image;
        if (session?.name) token.name = session.name;
        if (session?.identityVerificationStatus)
          token.identityVerificationStatus = session.identityVerificationStatus;
        if (session?.documentType) token.documentType = session.documentType;
      }
      return token;
    },
    async session({ session, token }) {
      session.sessionExpired = Boolean(token.sessionExpired);

      if (session.user) {
        (session.user as any).sessionExpired = token.sessionExpired;
        (session.user as any).id = token.id;
        (session.user as any).username = token.username;
        (session.user as any).isVerified = token.isVerified;
        (session.user as any).identityVerificationStatus =
          token.identityVerificationStatus;
        (session.user as any).documentType = token.documentType;
        (session.user as any).role = token.role;
        (session.user as any).image = token.image;
        (session.user as any).name = token.name ?? null;
        (session.user as any).email = token.email ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
