import { signOut } from "next-auth/react";

// Sign out and land on the email step. NextAuth's own redirect builds an
// absolute URL from NEXTAUTH_URL (falling back to http://localhost:3000 when
// it isn't set), so navigate with a relative URL ourselves instead.
export async function signOutToLogin() {
  await signOut({ redirect: false });
  window.location.replace("/?authStep=EMAIL");
}
