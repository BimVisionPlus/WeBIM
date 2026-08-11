import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, createInvite, buildInviteLink } from "@atlas/auth";
import { audit, reqMeta, sendEmail, tplInvite, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  orgId: z.string(),
  email: z.string().email(),
  role: z.enum(["OWNER", "ADMIN", "PROJECT_MGR", "ENGINEER", "SUPERVISOR", "FIELD", "VIEWER"]),
  projectId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "invites" });
  if (__rl) return __rl;
try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });

    const { orgId, email, role, projectId } = parsed.data;
    const { session, role: callerRole } = await requireOrgMember(orgId, ["OWNER", "ADMIN"]);

    // ADMIN cannot promote others to OWNER.
    if (callerRole === "ADMIN" && role === "OWNER" && !session.isSuperAdmin) {
      return NextResponse.json({ error: "Chỉ OWNER mới có thể mời OWNER khác" }, { status: 403 });
    }

    const { invite, token } = await createInvite({
      email: email.toLowerCase(),
      orgId,
      role,
      projectId,
      invitedById: session.userId,
    });

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    // Always use the public origin of the current request so the link works
    // regardless of how NEXT_PUBLIC_BASE_URL is set in env.
    const reqUrl = new URL(req.url);
    const fromHeader = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") ?? reqUrl.protocol.replace(":", "");
    const base = fromHeader ? `${proto}://${fromHeader}` : (process.env.NEXT_PUBLIC_BASE_URL ?? reqUrl.origin);
    const link = buildInviteLink(token, base);
    const roleLabel = role;

    const emailResult = await sendEmail({
      to: email,
      ...tplInvite({ orgName: org.name, inviterName: session.name, link, role: roleLabel }),
    });

    await audit({
      action: "invite.sent",
      entityType: "Invite",
      entityId: invite.id,
      actorId: session.userId,
      orgId,
      projectId: projectId ?? null,
      ...reqMeta(req),
      after: { email, role, emailDelivered: emailResult.ok, emailTransport: emailResult.transport },
    });

    // Return link + email outcome so the UI can show a copy-link fallback when
    // email delivery isn't configured (Resend key invalid, no SMTP, etc.).
    return NextResponse.json({
      ok: true,
      inviteId: invite.id,
      link,
      emailDelivered: emailResult.ok,
      emailTransport: emailResult.transport,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
