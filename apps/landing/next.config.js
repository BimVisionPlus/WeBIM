/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@atlas/db", "@atlas/ui", "@atlas/lib"],
  experimental: {
    // Same packages we mark external in @atlas/web — keeps Prisma's native
    // Query Engine binary out of Next's bundler and avoids the
    // "could not locate Query Engine for rhel-openssl-3.0.x" 500 at runtime.
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs", "pino", "pino-pretty"],
    outputFileTracingRoot: "../../",
    outputFileTracingIncludes: {
      "/**/*": [
        "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**/*",
        "../../node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client/**/*",
      ],
    },
  },
};
module.exports = nextConfig;
