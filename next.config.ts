import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // sharp: native bindings need to be traced into the standalone build (see
  // outputFileTracingIncludes below) for the cloak-watch image upload route.
  // firebase-admin: specifically firebase-admin/auth -> jwks-rsa -> jose
  // mixes ESM and CJS in a way Next's bundler chokes on if it tries to
  // inline it (ERR_REQUIRE_ESM in production). Both need to stay as real
  // node_modules require()s at runtime instead of being bundled — this MUST
  // stay a single array; a second `serverExternalPackages` key here would
  // silently clobber this one instead of merging.
  serverExternalPackages: ["sharp", "firebase-admin"],
  outputFileTracingIncludes: {
    "/api/cloak-watch/posts": ["./node_modules/@img/**/*"],
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

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "ml-bench-pvt-ltd",

  project: "cloak",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
