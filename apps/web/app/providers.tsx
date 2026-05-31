"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { CommandPalette } from "@/components/command-palette";

function AuthedPalette() {
  const { data } = useSession();
  if (!data) return null;
  return <CommandPalette />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <AuthedPalette />
    </SessionProvider>
  );
}
