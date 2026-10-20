import clientPromise from "@/lib/mongodb";
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { ObjectId } from "mongodb";

// How often the jwt() callback is allowed to re-query Mongo for fresh user
// data. This callback runs on every session check (client session fetch AND
// every getServerSession() call in API routes), so without a throttle every
// request in the app pays for an extra DB round trip.
const JWT_DB_REFRESH_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

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
            plan: user.plan,
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
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

            // Prioritize existing DB data. An empty image means the user
            // removed their photo — don't bring the Google one back.
            updatedData.name = existingUser.name || user.name;
            updatedData.image =
              existingUser.image ?? existingUser.profileImage ?? user.image;

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
              plan: "FREEMIUM",
              googleId: user.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            (user as any).id = result.insertedId.toString();
            (user as any).isVerified = false;
            (user as any).identityVerificationStatus = null;
            (user as any).role = "USER";
            (user as any).plan = "FREEMIUM";
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
        token.plan = (user as any).plan || "FREEMIUM";
        token.image = (user as any).image || user.image;
        token.name = (user as any).name || user.name;
        token.onboardingStartedAt = new Date(); // Track when onboarding started
        token.dbRefreshedAt = Date.now();
      }

      if (trigger === "update") {
        if (session?.username) token.username = session.username;
        // "" (photo removed) must clear it too, so check for presence.
        if (session?.image !== undefined) token.image = session.image || null;
        if (session?.name) token.name = session.name;
        if (session?.identityVerificationStatus)
          token.identityVerificationStatus = session.identityVerificationStatus;
        if (session?.documentType) token.documentType = session.documentType;
        // Force the DB refresh below to run on the very next callback
        // invocation instead of waiting out JWT_DB_REFRESH_INTERVAL_MS —
        // an explicit update() call (e.g. right after a subscription
        // checkout) means the caller wants fresh state now, not in up to
        // 2 more minutes.
        token.dbRefreshedAt = 0;
      }

      // Every session check (client session fetch or getServerSession() in an
      // API route) re-runs this callback, so re-querying Mongo unconditionally
      // here means every request in the app pays for an extra DB round trip.
      // Only refresh from the DB periodically instead of on every check.
      const lastRefreshed = (token.dbRefreshedAt as number | undefined) || 0;
      const needsDbRefresh =
        token.id && Date.now() - lastRefreshed > JWT_DB_REFRESH_INTERVAL_MS;

      if (needsDbRefresh) {
        try {
          const client = await clientPromise;
          const db = client.db();
          const userId = token.id;
          const userFromDb = await db
            .collection("users")
            .findOne({ _id: new ObjectId(userId as string) });
          if (userFromDb) {
            token.username = userFromDb.username || token.username;
            token.isVerified = userFromDb.isVerified || false;
            token.identityVerificationStatus =
              userFromDb.identityVerificationStatus || null;
            token.documentType = userFromDb.documentType || null;
            token.role = userFromDb.role || "USER";
            token.plan = userFromDb.plan || "FREEMIUM";
            token.image = userFromDb.image || userFromDb.profileImage || null;
            token.name = userFromDb.name || token.name;
            token.email = userFromDb.email || token.email;
          }
          token.dbRefreshedAt = Date.now();
        } catch (err) {
          console.error("Error fetching fresh user data for JWT:", err);
        }
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
        (session.user as any).plan = token.plan || "FREEMIUM";
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
