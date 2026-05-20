/** @type {import('next').NextConfig} */
const nextConfig = {
  // `output: standalone` builds the app into .next/standalone for Docker.
  // Vercel doesn't want this — it has its own bundler. We toggle via env.
  ...(process.env.STANDALONE_BUILD === "1" ? { output: "standalone" } : {}),
  reactStrictMode: true,
  transpilePackages: ["@atlas/db", "@atlas/lib", "@atlas/ui", "@atlas/workflows", "@atlas/auth"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs", "pino", "pino-pretty"],
    // Vercel doesn't auto-include workspace-generated Prisma binaries.
    // Force-trace the generated client so .node files reach the function bundle.
    outputFileTracingRoot: "../../",
    outputFileTracingIncludes: {
      "/**/*": [
        "../../packages/db/src/generated/client/**/*",
        "../../packages/db/prisma/schema.prisma",
      ],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
