/**
 * NextAuth configuration for Atlas AEC.
 *
 * Strategy:
 *  - Credentials provider (email + password) with bcrypt + brute-force lockout.
 *  - JWT sessions (cheaper than DB sessions per request; we still store an
 *    `Account` row + `Session` row on first login for audit).
 *  - Magic-link email provider also supported when AUTH_EMAIL_FROM is set.
 *  - Session token includes `userId`, `email`, `name`, `isSuperAdmin`.
 *
 * IMPORTANT: do NOT expose org/project ids in the JWT — they change at runtime
 * (user accepts invites). Resolve memberships per-request in `requireSession`.
 */

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@atlas/db";

const MAX_FAILED = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 }, // 7 days
  pages: {
    signIn: "/signin",
    error: "/signin",
    verifyRequest: "/signin?check-email=1",
  },
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(creds) {
        const parsed = CredentialsSchema.safeParse(creds);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user || !user.passwordHash) return null;

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error("LOCKED_OUT");
        }

        const ok = await compare(parsed.data.password, user.passwordHash);
        if (!ok) {
          const failed = user.failedLogins + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLogins: failed,
              lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCKOUT_MS) : null,
            },
          });
          return null;
        }

        if (user.failedLogins > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLogins: 0, lockedUntil: null },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isSuperAdmin: user.isSuperAdmin,
        } as any;
      },
    }),
    ...(process.env.AUTH_EMAIL_SERVER && process.env.AUTH_EMAIL_FROM
      ? [
          EmailProvider({
            server: process.env.AUTH_EMAIL_SERVER,
            from: process.env.AUTH_EMAIL_FROM,
            maxAge: 15 * 60,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as any).id;
        token.isSuperAdmin = (user as any).isSuperAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as any).id = token.uid;
        (session.user as any).isSuperAdmin = token.isSuperAdmin ?? false;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
};
