import { PrismaClient } from "./generated/client";

declare global {
  // eslint-disable-next-line no-var
  var __atlasPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__atlasPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__atlasPrisma = prisma;
}

export * from "./generated/client";
