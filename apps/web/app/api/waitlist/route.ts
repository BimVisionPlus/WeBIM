import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { rateLimit, clientKey, sendEmail, tplWaitlistConfirm, audit, reqMeta, logger } from "@atlas/lib";

const Body = z.object({
  email: z.string().email().max(200),
  name: z.string().max(120).optional(),
  company: z.string().max(200).optional(),
  role: z.string().max(80).optional(),
  size: z.enum(["1-10", "11-50", "51-200", "200+"]).optional(),
  notes: z.string().max(1000).optional(),
  source: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimit({ key: `waitlist:${clientKey(req)}`, max: 5, windowSec: 600 });
  if (!rl.allowed) return NextResponse.json({ error: "Quá nhiều yêu cầu" }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const data = parsed.data;
  // Upsert so resubmission doesn't error
  const row = await prisma.waitlistEntry.upsert({
    where: { email: data.email.toLowerCase() },
    update: {
      name: data.name,
      company: data.company,
      role: data.role,
      size: data.size,
      notes: data.notes,
      source: data.source,
    },
    create: {
      email: data.email.toLowerCase(),
      name: data.name,
      company: data.company,
      role: data.role,
      size: data.size,
      notes: data.notes,
      source: data.source,
    },
  });

  // Non-blocking confirmation email + audit
  sendEmail({ to: data.email, ...tplWaitlistConfirm({ name: data.name }) }).catch((err) =>
    logger().warn({ err }, "waitlist.email_failed"),
  );
  await audit({ action: "waitlist.join", entityType: "WaitlistEntry", entityId: row.id, ...reqMeta(req) });

  return NextResponse.json({ ok: true });
}
