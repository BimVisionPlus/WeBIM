/**
 * GET /api/trust/models — public list of every AI model + version Atlas runs.
 *
 * Trust layer surface: any visitor (even unauthenticated) can read which OSS
 * models power which feature, what they were trained on, and what the
 * acceptance rate has been in the last 30 days. This is the user-facing
 * implementation of Sophie's "public model card per AI feature" principle.
 */

import { NextResponse } from "next/server";
import { prisma } from "@atlas/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [cards, drift] = await Promise.all([
    prisma.modelCard.findMany({ orderBy: [{ feature: "asc" }, { publishedAt: "desc" }] }),
    prisma.driftSnapshot.findMany({
      where: { windowEnd: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      orderBy: { windowEnd: "desc" },
    }),
  ]);

  // Recent acceptance per feature
  const acceptanceByFeature = new Map<string, { accepted: number; total: number }>();
  const recent = await prisma.aiSuggestion.findMany({
    where: { ok: true, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    select: { kind: true, accepted: true },
  });
  for (const s of recent) {
    const bucket = acceptanceByFeature.get(s.kind) ?? { accepted: 0, total: 0 };
    bucket.total++;
    if (s.accepted) bucket.accepted++;
    acceptanceByFeature.set(s.kind, bucket);
  }

  return NextResponse.json({
    cards,
    drift,
    acceptance: Object.fromEntries(acceptanceByFeature),
    generatedAt: new Date().toISOString(),
  });
}
