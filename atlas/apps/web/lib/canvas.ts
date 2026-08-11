import { prisma } from "@atlas/db";
import { objectExists, presignDownload } from "@atlas/lib";
import type { CanvasMarkup, CanvasSheet } from "@/components/canvas/types";

async function assetUrl(value?: string | null) {
  if (!value) return null;
  if (/^(https?:|data:|\/)/.test(value)) return value;
  try {
    if (!(await objectExists("drawings", value))) return null;
    return await presignDownload("drawings", value, 60 * 60);
  } catch { return null; }
}

export async function canvasData(sheetId: string): Promise<{ sheet: CanvasSheet; markups: CanvasMarkup[] } | null> {
  const row = await prisma.sheet.findUnique({
    where: { id: sheetId },
    include: {
      drawingSet: { include: { project: { select: { name: true } } } },
      supersedes: {
        take: 1,
        select: { rasterUrl: true, thumbnailUrl: true, revision: true },
      },
      markups: {
        include: { comments: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!row) return null;
  const userIds = new Set<string>();
  for (const markup of row.markups) { if (markup.authorId) userIds.add(markup.authorId); for (const comment of markup.comments) if (comment.authorId) userIds.add(comment.authorId); }
  const users = await prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, name: true } });
  const names = new Map(users.map((user) => [user.id, user.name]));
  const previous = row.supersedes[0];
  return {
    sheet: { id: row.id, sheetNumber: row.sheetNumber, title: row.title, revision: row.revision, scale: row.scale, rasterUrl: await assetUrl(row.rasterUrl), thumbnailUrl: await assetUrl(row.thumbnailUrl), compareRasterUrl: previous ? await assetUrl(previous.rasterUrl ?? previous.thumbnailUrl) : null, compareRevision: previous?.revision ?? null, paperWidthMm: row.paperWidthMm, paperHeightMm: row.paperHeightMm, drawingSetName: row.drawingSet.name, projectName: row.drawingSet.project.name },
    markups: row.markups.map((markup) => ({ id: markup.id, kind: markup.kind, geometry: markup.geometry, color: markup.color, label: markup.label, status: markup.status, authorName: markup.guestName ?? (markup.authorId ? names.get(markup.authorId) : null) ?? "Thành viên", createdAt: markup.createdAt.toISOString(), comments: markup.comments.map((comment) => ({ id: comment.id, body: comment.body, authorName: comment.guestName ?? (comment.authorId ? names.get(comment.authorId) : null) ?? "Thành viên", createdAt: comment.createdAt.toISOString() })) })) as CanvasMarkup[],
  };
}
