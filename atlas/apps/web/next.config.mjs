/** @type {import('next').NextConfig} */
const nextConfig = {
  // `output: standalone` builds the app into .next/standalone for Docker.
  // Vercel doesn't want this — it has its own bundler. We toggle via env.
  ...(process.env.STANDALONE_BUILD === "1" ? { output: "standalone" } : {}),
  reactStrictMode: true,
  transpilePackages: ["@atlas/db", "@atlas/lib", "@atlas/ui", "@atlas/workflows", "@atlas/auth"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs", "pino", "pino-pretty", "ioredis"],
    outputFileTracingRoot: "../../",
    outputFileTracingIncludes: {
      "/**/*": [
        "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**/*",
        "../../node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client/**/*",
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
    // WeBIM embeds Atlas whole as one of its modules, from its own origin.
    // X-Frame-Options has no allowlist — it is same-origin or nothing — so
    // when FRAME_ANCESTORS names who may embed us, express the policy as CSP
    // instead. Unset, the header stays exactly as it was.
    const frameAncestors = process.env.FRAME_ANCESTORS?.trim();
    const framing = frameAncestors
      ? [{ key: "Content-Security-Policy", value: `frame-ancestors 'self' ${frameAncestors}` }]
      : [{ key: "X-Frame-Options", value: "SAMEORIGIN" }];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          ...framing,
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
