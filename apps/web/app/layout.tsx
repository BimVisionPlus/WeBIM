import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://app.aecplatform.vn"),
  title: {
    default: "Viwase Quản lý công việc — Module #1 của AEC Platform",
    template: "%s · Viwase Quản lý công việc",
  },
  description:
    "Viwase Quản lý công việc là module đầu tiên của AEC Platform — Atlassian-style PM cho ngành Kiến trúc Xây dựng VN. Gắn chặt NĐ 06/2021, Luật ĐT 22/2023, chữ ký số VNPT/Viettel-CA.",
  openGraph: {
    title: "Viwase Quản lý công việc — Module #1 của AEC Platform",
    siteName: "AEC Platform",
    locale: "vi_VN",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
