/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@atlas/db", "@atlas/ui", "@atlas/lib"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
  },
};
module.exports = nextConfig;
