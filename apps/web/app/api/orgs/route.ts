import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession } from "@atlas/auth";
import { audit, reqMeta, isValidMst, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, "Chỉ chữ thường, số, dấu gạch ngang"),
  type: z.enum([
    "CHU_DAU_TU",
    "TU_VAN_GIAM_SAT",
    "TU_VAN_THIET_KE",
    "NHA_THAU_CHINH",
    "NHA_THAU_PHU",
    "NHA_CUNG_CAP",
    "CO_QUAN_NHA_NUOC",
  ]),
  mst: z.string().optional(),
  address: z.string().max(300).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "orgs" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ", details: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    if (data.mst && !isValidMst(data.mst)) {
      return NextResponse.json({ error: "Mã số thuế không hợp lệ" }, { status: 400 });
    }

    const slugTaken = await prisma.organization.findUnique({ where: { slug: data.slug } });
    if (slugTaken) return NextResponse.json({ error: "Slug đã được sử dụng" }, { status: 409 });

    const org = await prisma.$transaction(async (tx) => {
      const o = await tx.organization.create({
        data: {
          name: data.name,
          slug: data.slug,
          type: data.type,
          mst: data.mst,
          address: data.address,
          phone: data.phone,
          email: data.email,
        },
      });
      await tx.membership.create({
        data: { userId: session.userId, orgId: o.id, role: "OWNER" },
      });
      return o;
    });

    await audit({
      action: "org.created",
      entityType: "Organization",
      entityId: org.id,
      actorId: session.userId,
      orgId: org.id,
      ...reqMeta(req),
      after: { name: org.name, slug: org.slug, type: org.type },
    });

    return NextResponse.json({ ok: true, org });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
