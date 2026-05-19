import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Atlas AEC — Quản lý dự án Kiến trúc · Xây dựng",
  description:
    "Bộ công cụ Atlassian-style cho ngành Kiến trúc, Xây dựng — gắn chặt NĐ 06/2021, hỗ trợ chữ ký số VNPT/Viettel-CA.",
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
