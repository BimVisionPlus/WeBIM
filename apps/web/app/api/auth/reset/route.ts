import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumePasswordReset, validatePasswordStrength } from "@atlas/auth";
import { audit, reqMeta, rateLimit, clientKey } from "@atlas/lib";

const Body = z.object({ token: z.string().min(10), password: z.string() });

export async function POST(req: NextRequest) {
  const rl = await rateLimit({ key: `reset:${clientKey(req)}`, max: 10, windowSec: 600 });
  if (!rl.allowed) return NextResponse.json({ error: "Quá nhiều yêu cầu" }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });

  const strength = validatePasswordStrength(parsed.data.password);
  if (!strength.ok) return NextResponse.json({ error: strength.error }, { status: 400 });

  const ok = await consumePasswordReset(parsed.data.token, parsed.data.password);
  if (!ok) return NextResponse.json({ error: "Liên kết đặt lại không hợp lệ hoặc đã hết hạn" }, { status: 400 });

  await audit({ action: "auth.password_reset", entityType: "User", ...reqMeta(req) });
  return NextResponse.json({ ok: true });
}
