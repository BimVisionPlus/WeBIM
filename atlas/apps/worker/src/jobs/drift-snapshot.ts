/**
 * Hourly drift snapshot for the Trust layer.
 *
 * Reads AiSuggestion + AiCostEvent in the last hour, computes acceptance rate
 * + a coarse stability score (Lyapunov-style — smaller = more stable), persists
 * to DriftSnapshot. The /trust page reads from this table.
 */

import { prisma } from "@atlas/db";

const FEATURES = ["rfi.classify", "ncr.assess_photo", "siteeye.ppe", "daily_log.transcribe"];

export async function snapshotDrift() {
  const now = new Date();
  const start = new Date(now.getTime() - 60 * 60 * 1000);
  let created = 0;

  for (const feature of FEATURES) {
    const suggestions = await prisma.aiSuggestion.findMany({
      where: { kind: feature as any, createdAt: { gte: start, lt: now } },
    });
    if (suggestions.length === 0) continue;

    const accepted = suggestions.filter((s) => s.accepted).length;
    const acceptanceRate = accepted / suggestions.length;

    // Stability: variance of latency normalized by mean (coefficient of variation)
    const lats = suggestions.map((s) => s.latencyMs);
    const mean = lats.reduce((a, b) => a + b, 0) / lats.length;
    const variance = lats.reduce((a, b) => a + (b - mean) ** 2, 0) / lats.length;
    const stability = mean > 0 ? Math.sqrt(variance) / mean : 0;

    let alert: "OK" | "WATCH" | "DEGRADED" | "REQUIRES_RETRAIN" = "OK";
    if (acceptanceRate < 0.5) alert = "REQUIRES_RETRAIN";
    else if (acceptanceRate < 0.65) alert = "DEGRADED";
    else if (acceptanceRate < 0.75 || stability > 0.5) alert = "WATCH";

    await prisma.driftSnapshot.create({
      data: {
        feature,
        modelVersion: suggestions[0]?.model ?? "unknown",
        windowStart: start,
        windowEnd: now,
        acceptanceRate,
        stabilityScore: stability,
        alertLevel: alert,
        payload: { samples: suggestions.length, meanLatencyMs: mean } as any,
      },
    });
    created++;
  }
  return { ok: true, note: `snapshots=${created}` };
}
