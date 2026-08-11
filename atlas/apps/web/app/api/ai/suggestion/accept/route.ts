import { rateLimitGuard } from "@atlas/lib";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@atlas/auth";
import { markAccepted } from "@atlas/ai";

const Body = z.object({ id: z.string() });

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "ai.suggestion.accept" });
  if (__rl) return __rl;
try {
    await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    await markAccepted(parsed.data.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
