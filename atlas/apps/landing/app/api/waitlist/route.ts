import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { rateLimit, clientKey, sendEmail, tplWaitlistConfirm, logger } from "@atlas/lib";

const Body = z.object({
  email: z.string().email("Email không hợp lệ"),
  name: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  size: z.string().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimit({ key: `waitlist:${clientKey(req)}`, max: 5, windowSec: 600 });
  if (!rl.allowed) return NextResponse.json({ error: "Quá nhiều yêu cầu" }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors.email?.[0] ?? "Dữ liệu không hợp lệ" },
      { status: 400 },
    );
  }
  try {
    const data = { ...parsed.data, email: parsed.data.email.toLowerCase() };
    const entry = await prisma.waitlistEntry.upsert({
      where: { email: data.email },
      update: data,
      create: data,
    });
    sendEmail({ to: data.email, ...tplWaitlistConfirm({ name: data.name }) }).catch((err) =>
      logger().warn({ err }, "waitlist.email_failed"),
    );
    return NextResponse.json({ ok: true, id: entry.id });
  } catch (e: any) {
    logger().error({ err: e }, "waitlist.error");
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
