import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas AEC — Quản lý dự án Kiến trúc · Xây dựng theo chuẩn Việt Nam",
  description:
    "Atlassian suite cho ngành AEC. Gắn chặt NĐ 06/2021 (nghiệm thu), VBHN 06/VBHN-BXD (chi phí ĐTXD — hợp nhất NĐ 10/2021), HĐĐT theo NĐ 123/2020. Thay thế Procore/Autodesk Construction Cloud cho thị trường VN.",
  openGraph: {
    title: "Atlas AEC",
    description: "Bộ công cụ PM cho ngành Xây dựng — theo chuẩn pháp lý VN.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
