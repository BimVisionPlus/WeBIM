// Persist + retrieve AiSuggestion rows. Keeps the DB-touching glue out of
// the pure AI adapters so they can be unit-tested without Prisma.

import { prisma } from "@atlas/db";
import type { AiResult, AiSuggestionKind } from "./types";

export async function saveSuggestion<T>(args: {
  kind: AiSuggestionKind;
  entityType: string;
  entityId: string;
  projectId?: string;
  result: AiResult<T>;
  // for failures we still write a row so the UI can show "AI thử nhưng …"
}): Promise<string | null> {
  const base = {
    kind: args.kind,
    entityType: args.entityType,
    entityId: args.entityId,
    projectId: args.projectId,
    latencyMs: args.result.latencyMs,
  };
  if (!args.result.ok) {
    const row = await prisma.aiSuggestion.create({
      data: {
        ...base,
        model: "n/a",
        ok: false,
        failReason: args.result.reason,
        output: { error: args.result.error ?? null } as any,
      },
    });
    return row.id;
  }
  const row = await prisma.aiSuggestion.create({
    data: {
      ...base,
      model: args.result.model,
      ok: true,
      output: args.result.data as any,
    },
  });
  return row.id;
}

export async function latestSuggestion<T>(args: {
  entityType: string;
  entityId: string;
  kind: AiSuggestionKind;
}): Promise<{ id: string; output: T; model: string; createdAt: Date; accepted: boolean } | null> {
  const row = await prisma.aiSuggestion.findFirst({
    where: { entityType: args.entityType, entityId: args.entityId, kind: args.kind, ok: true },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  return {
    id: row.id,
    output: row.output as unknown as T,
    model: row.model,
    createdAt: row.createdAt,
    accepted: row.accepted,
  };
}

export async function markAccepted(id: string): Promise<void> {
  await prisma.aiSuggestion.update({ where: { id }, data: { accepted: true, acceptedAt: new Date() } });
}
