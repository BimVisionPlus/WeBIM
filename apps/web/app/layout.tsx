import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { TenantBanner } from "@/components/tenant-banner";

export const metadata: Metadata = {
  metadataBase: new URL("https://app.aecplatform.vn"),
  title: {
    default: "Atlas — AEC Platform",
    template: "%s · Atlas",
  },
  description:
    "Atlas là module đầu tiên của AEC Platform — Atlassian-style PM cho ngành Kiến trúc Xây dựng VN. Gắn chặt NĐ 06/2021, Luật ĐT 22/2023, chữ ký số VNPT/Viettel-CA.",
  openGraph: {
    title: "Atlas — AEC Platform",
    siteName: "AEC Platform",
    locale: "vi_VN",
    type: "website",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <TenantBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
