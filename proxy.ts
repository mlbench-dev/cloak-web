import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Server-side gate for the authenticated areas of the app (SYS-001).
//
// Before this, protected pages were only guarded client-side (a useEffect
// redirect in app/(protected)/layout.tsx), so the full page shell was served
// to anyone who navigated directly to /dashboard etc. This refuses the
// request up front when there's no NextAuth session cookie at all.
//
// Deliberately a *presence* check, not a JWT decode: this app is deployed on
// Cloud Run (not Vercel) and NEXTAUTH_URL may be unset, which makes
// getToken()'s secure-cookie-name detection unreliable — a wrong guess there
// would redirect genuinely-authenticated users to the login screen. Every
// data API still fully validates the session with getServerSession, so a
// forged/empty cookie yields no data; this layer only stops the protected
// UI shell from rendering for anonymous visitors and sends them to sign in.
//
// NextAuth names the JWT session cookie `next-auth.session-token` over http
// and `__Secure-next-auth.session-token` over https, so check both.
const SESSION_COOKIES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return NextResponse.next();

  const loginUrl = new URL("/?authStep=EMAIL", request.url);
  return NextResponse.redirect(loginUrl);
}

// Matcher values must be static literals (build-time analyzed), so each
// protected area is listed explicitly — both the bare path and its subtree.
export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/submit-report",
    "/submit-report/:path*",
    "/my-reports",
    "/my-reports/:path*",
    "/reports",
    "/reports/:path*",
    "/cloak-watch",
    "/cloak-watch/:path*",
    "/community",
    "/community/:path*",
    "/identity-profile",
    "/identity-profile/:path*",
    "/alerts",
    "/alerts/:path*",
    "/progress",
    "/progress/:path*",
    "/profile",
    "/profile/:path*",
    "/support",
    "/support/:path*",
    "/subscription",
    "/subscription/:path*",
    "/verification",
    "/verification/:path*",
    "/reference-media",
    "/reference-media/:path*",
  ],
};
