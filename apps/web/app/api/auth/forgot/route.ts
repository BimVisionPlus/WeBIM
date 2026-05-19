import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { issuePasswordReset } from "@atlas/auth";
import { sendEmail, tplResetPassword, rateLimit, clientKey, audit, reqMeta } from "@atlas/lib";

const Body = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const rl = await rateLimit({ key: `forgot:${clientKey(req)}`, max: 3, windowSec: 600 });
  if (!rl.allowed) return NextResponse.json({ ok: true }); // silent — do not leak

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: true }); // silent

  const token = await issuePasswordReset(parsed.data.email);
  if (token) {
    const link = `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/reset?token=${encodeURIComponent(token)}`;
    await sendEmail({ to: parsed.data.email, ...tplResetPassword({ link }) });
    await audit({
      action: "auth.password_reset_requested",
      entityType: "User",
      ...reqMeta(req),
    });
  }
  // Always 200 — never reveal whether email exists.
  return NextResponse.json({ ok: true });
}
