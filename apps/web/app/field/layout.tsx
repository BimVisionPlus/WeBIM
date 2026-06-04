import type { ReactNode } from "react";

export const metadata = {
  title: "Viwase Field — Báo cáo công trường",
  description: "PWA cho công nhân hiện trường: voice-to-form, chấm công GPS, báo cáo 1-tap. Offline-first.",
  manifest: "/manifest.webmanifest",
  themeColor: "#1d4ed8",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Viwase Field",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1d4ed8",
};

export default function FieldLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {children}
    </div>
  );
}
