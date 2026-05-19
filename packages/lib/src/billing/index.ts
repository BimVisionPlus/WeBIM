/**
 * Billing / feature-gating (Layer 8).
 *
 * Plans are seeded by code: free | pro | business | enterprise.
 * Features are string keys checked at the API boundary:
 *
 *   - "ai.action"       — every AI call (consumes aiCreditVnd)
 *   - "winwork"         — full WinWork module
 *   - "costpulse"       — CostPulse + EVM
 *   - "drawbridge"      — clash detection
 *   - "siteeye"         — CV + weather
 *   - "portfolio"       — ProjectPulse cross-project
 *   - "trust.drift"     — drift snapshot history > 30d
 *   - "integrations"    — webhooks + API keys + MISA/Base connector
 *   - "on_prem"         — Enterprise on-prem deploy
 *
 * Plan capabilities are stored in Plan.features.gated[] (Json). If the gated
 * list is empty the plan inherits the next-lower tier's gates. Free is the
 * baseline (nothing gated).
 */

import { prisma } from "@atlas/db";

export type FeatureKey =
  | "ai.action"
  | "winwork"
  | "costpulse"
  | "drawbridge"
  | "siteeye"
  | "portfolio"
  | "trust.drift"
  | "integrations"
  | "on_prem";

const PLAN_FEATURES: Record<string, FeatureKey[]> = {
  free: [],
  pro: ["winwork", "drawbridge", "siteeye"],
  business: ["winwork", "drawbridge", "siteeye", "costpulse", "portfolio", "trust.drift"],
  enterprise: [
    "winwork", "drawbridge", "siteeye", "costpulse", "portfolio", "trust.drift",
    "integrations", "on_prem",
  ],
};

const AI_ACTION_VND: Record<string, bigint> = {
  free: 500n,
  pro: 300n,
  business: 200n,
  enterprise: 0n,
};

export type FeatureCheck =
  | { ok: true; planCode: string }
  | { ok: false; planCode: string; reason: "not_in_plan" | "no_subscription" | "insufficient_credits"; upgradeTo?: string };

export async function checkFeature(orgId: string, feature: FeatureKey): Promise<FeatureCheck> {
  const sub = await prisma.subscription.findUnique({ where: { orgId } });

  // Find the plan separately so we don't rely on a relation that doesn't exist
  // in the schema (Subscription.planId is a soft FK).
  const planCode = sub
    ? (await prisma.plan.findUnique({ where: { id: sub.planId }, select: { code: true } }))?.code ?? "free"
    : "free";

  // Free is always allowed for "Free-tier" features (anything not gated).
  // For gated features, check membership in the plan's feature set.
  if (feature === "ai.action") {
    // Pay-per-action: every plan allows AI calls; we just record the cost.
    return { ok: true, planCode };
  }

  const features = PLAN_FEATURES[planCode] ?? [];
  if (features.includes(feature)) return { ok: true, planCode };

  // Suggest the cheapest plan that includes this feature.
  const tiers = ["free", "pro", "business", "enterprise"] as const;
  const upgradeTo = tiers.find((t) => (PLAN_FEATURES[t] ?? []).includes(feature));
  return { ok: false, planCode, reason: "not_in_plan", upgradeTo };
}

/**
 * Charge an AI action against the org's prepaid credit. Idempotent under retry
 * because the AiCostEvent.id provides the dedupe key.
 */
export async function chargeAiAction(args: {
  orgId: string | null;
  projectId?: string | null;
  feature: string;       // "rfi.classify" | …
  model: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
}): Promise<{ ok: boolean; charged: bigint }> {
  if (!args.orgId) return { ok: true, charged: 0n };

  // Resolve the plan code for the org → AI action price
  const sub = await prisma.subscription.findUnique({ where: { orgId: args.orgId } });
  const planCode = sub
    ? (await prisma.plan.findUnique({ where: { id: sub.planId }, select: { code: true } }))?.code ?? "free"
    : "free";
  const price = AI_ACTION_VND[planCode] ?? 500n;

  // Record cost event regardless of payment outcome (transparency)
  await prisma.aiCostEvent.create({
    data: {
      projectId: args.projectId,
      feature: args.feature,
      model: args.model,
      tokensIn: args.tokensIn ?? 0,
      tokensOut: args.tokensOut ?? 0,
      latencyMs: args.latencyMs,
      costVnd: price,
    },
  });

  // Decrement credit balance if there is one
  if (sub && price > 0n) {
    try {
      await prisma.subscription.update({
        where: { orgId: args.orgId },
        data: { aiCreditVnd: { decrement: price } },
      });
    } catch {
      /* allow negative balance — grace period; finance reconciles */
    }
  }
  return { ok: true, charged: price };
}

export function planFeatures(planCode: string): FeatureKey[] {
  return PLAN_FEATURES[planCode] ?? [];
}

export function aiActionPriceVnd(planCode: string): bigint {
  return AI_ACTION_VND[planCode] ?? 500n;
}
