// SEO: robots.txt for aecplatform.vn landing.
import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_LANDING_URL ?? "https://aecplatform.vn";
const INDEXABLE = process.env.NEXT_PUBLIC_INDEXABLE === "true";

export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/_next/", "/_vercel/"] },
      // Block AI scraper bots that don't honor LLM-content licenses
      { userAgent: ["GPTBot", "ClaudeBot", "CCBot", "Google-Extended", "anthropic-ai"], disallow: "/" },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE.replace(/^https?:\/\//, ""),
  };
}
