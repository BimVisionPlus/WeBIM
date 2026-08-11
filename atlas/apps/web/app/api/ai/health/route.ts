import { NextResponse } from "next/server";
import { aiHealth } from "@atlas/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const h = await aiHealth();
  const ok = h.enabled && h.ollama.reachable && h.ollama.missing.length === 0 && h.whisper.reachable;
  return NextResponse.json({ ok, ...h }, { status: ok ? 200 : 503 });
}
