import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // sharp: native bindings need to be traced into the standalone build (see
  // outputFileTracingIncludes below) for the community image upload route.
  // firebase-admin: specifically firebase-admin/auth -> jwks-rsa -> jose
  // mixes ESM and CJS in a way Next's bundler chokes on if it tries to
  // inline it (ERR_REQUIRE_ESM in production). Both need to stay as real
  // node_modules require()s at runtime instead of being bundled — this MUST
  // stay a single array; a second `serverExternalPackages` key here would
  // silently clobber this one instead of merging.
  serverExternalPackages: ["sharp", "firebase-admin"],
  outputFileTracingIncludes: {
    "/api/community/posts": ["./node_modules/@img/**/*"],
  },
  // Route rename: the community feed moved /cloak-watch -> /community, and
  // the monitoring screens moved /incidents -> /cloak-watch. These keep old
  // bookmarks and already-shared post links working. Temporary (307) on
  // purpose — /cloak-watch itself is now a live route, so nothing about it
  // should get cached as a permanent redirect by browsers.
  async redirects() {
    return [
      {
        source: "/cloak-watch/post/:id",
        destination: "/community/post/:id",
        permanent: false,
      },
      {
        source: "/cloak-watch/new-post",
        destination: "/community/new-post",
        permanent: false,
      },
      {
        source: "/cloak-watch/personalised-appearance",
        destination: "/community/personalised-appearance",
        permanent: false,
      },
      {
        source: "/incidents",
        destination: "/cloak-watch",
        permanent: false,
      },
      {
        source: "/incidents/:path*",
        destination: "/cloak-watch/:path*",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
