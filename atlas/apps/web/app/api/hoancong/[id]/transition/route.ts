// POST /api/hoancong/[id]/transition — HoanCongDossier workflow.
// DRAFT → ASSEMBLING → NT_REVIEW → TVGS_REVIEW → CDT_REVIEW → COMPILED → SUBMITTED_QLNN → ACCEPTED.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";
import crypto from "crypto";

const Body = z.object({
  action: z.enum(["START_ASSEMBLE", "NT_SIGN", "TVGS_SIGN", "CDT_SIGN", "COMPILE_PDFA", "SUBMIT_QLNN", "ACCEPT", "REJECT"]),
  qlnnRef: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

const NEXT: Record<string, string> = {
  START_ASSEMBLE: "ASSEMBLING", NT_SIGN: "NT_REVIEW", TVGS_SIGN: "TVGS_REVIEW",
  CDT_SIGN: "CDT_REVIEW", COMPILE_PDFA: "COMPILED", SUBMIT_QLNN: "SUBMITTED_QLNN",
  ACCEPT: "ACCEPTED", REJECT: "DRAFT",
};
const FROM: Record<string, string[]> = {
  START_ASSEMBLE: ["DRAFT"], NT_SIGN: ["ASSEMBLING"], TVGS_SIGN: ["NT_REVIEW"],
  CDT_SIGN: ["TVGS_REVIEW"], COMPILE_PDFA: ["CDT_REVIEW"], SUBMIT_QLNN: ["COMPILED"],
  ACCEPT: ["SUBMITTED_QLNN"], REJECT: ["ASSEMBLING", "NT_REVIEW", "TVGS_REVIEW", "CDT_REVIEW"],
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await rateLimitGuard(req, { name: "hoancong.transition" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const dossier = await prisma.hoanCongDossier.findUnique({ where: { id: params.id } });
    if (!dossier) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(dossier.projectId);
    const allowed = FROM[d.action] ?? [];
    if (!allowed.includes(dossier.state)) return NextResponse.json({ error: `Không thể ${d.action} từ ${dossier.state}` }, { status: 422 });
    const now = new Date();
    const update: Record<string, unknown> = { state: NEXT[d.action] };
    if (d.action === "NT_SIGN") update.ntSignedAt = now;
    if (d.action === "TVGS_SIGN") update.tvgsSignedAt = now;
    if (d.action === "CDT_SIGN") update.cdtSignedAt = now;
    if (d.action === "COMPILE_PDFA") {
      update.pdfaCompiledAt = now;
      update.pdfaUrl = `hoancong/${dossier.id}/compiled.pdf`;
      update.pdfaSha256 = crypto.createHash("sha256").update(`${dossier.id}-${now.toISOString()}`).digest("hex");
    }
    if (d.action === "SUBMIT_QLNN") update.submittedAt = now;
    if (d.action === "ACCEPT") { update.acceptedAt = now; update.qlnnRef = d.qlnnRef ?? null; }
    if (d.action === "REJECT") update.notes = (dossier.notes ?? "") + `\n${now.toISOString()}: REJECT - ${d.notes ?? ""}`;
    await prisma.hoanCongDossier.update({ where: { id: params.id }, data: update });
    await audit({ action: `hoancong.${d.action.toLowerCase()}`, entityType: "HoanCongDossier", entityId: params.id, actorId: session.userId, projectId: dossier.projectId, ...reqMeta(req), before: { state: dossier.state }, after: { state: NEXT[d.action] } });
    return NextResponse.json({ ok: true, state: NEXT[d.action] });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
