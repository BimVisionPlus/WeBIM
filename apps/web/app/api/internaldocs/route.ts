import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  orgId: z.string(),
  projectId: z.string().optional(),
  docNo: z.string().min(1).max(80),
  category: z.enum(["QUYET_DINH","THONG_BAO","QUY_CHE","QUY_TRINH","BIEN_BAN","KHAC"]).default("KHAC"),
  title: z.string().min(2).max(300),
  body: z.string().max(20000).optional(),
  issuedAt: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "internaldocs.create" }); if (rl) return rl;
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const { session } = await requireOrgMember(d.orgId);
    const doc = await prisma.internalDocument.create({
      data: {
        orgId: d.orgId,
        projectId: d.projectId,
        docNo: d.docNo,
        category: d.category,
        title: d.title,
        body: d.body,
        issuedAt: d.issuedAt ? new Date(d.issuedAt) : new Date(),
        authorId: session.userId,
      },
    });
    await audit({ action: "internaldoc.create", entityType: "InternalDocument", entityId: doc.id, actorId: session.userId, orgId: d.orgId, ...reqMeta(req), after: { docNo: doc.docNo, title: doc.title } });
    return NextResponse.json({ doc });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
