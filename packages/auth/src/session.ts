/**
 * Session + RBAC helpers used by every API route and server component.
 *
 * Contract:
 *   - `getSession()`            → SessionContext | null (no throw)
 *   - `requireSession()`        → SessionContext (throws AuthError → 401)
 *   - `requireOrgMember(orgId)` → SessionContext + verified membership (→ 403 on miss)
 *   - `requireProject(projectId)` → resolves project + verifies access via stakeholder org membership
 *   - `actorOrgRolesForProject(userId, projectId)` → OrgType[] used by workflow guards
 */

import "server-only";
import { getServerSession } from "next-auth";
import type { OrgType, MemberRole } from "@atlas/db";
import { prisma } from "@atlas/db";
import { authOptions } from "./config";

export class AuthError extends Error {
  constructor(public status: 401 | 403, msg: string) {
    super(msg);
  }
}

export type SessionContext = {
  userId: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
};

export async function getSession(): Promise<SessionContext | null> {
  const s = await getServerSession(authOptions);
  if (!s?.user) return null;
  const u = s.user as any;
  if (!u.id) return null;
  return {
    userId: u.id,
    email: u.email ?? "",
    name: u.name ?? "",
    isSuperAdmin: !!u.isSuperAdmin,
  };
}

export async function requireSession(): Promise<SessionContext> {
  const s = await getSession();
  if (!s) throw new AuthError(401, "Chưa đăng nhập");
  return s;
}

export async function requireOrgMember(
  orgId: string,
  allowed: MemberRole[] = [],
): Promise<{ session: SessionContext; role: MemberRole }> {
  const session = await requireSession();
  const m = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: session.userId, orgId } },
  });
  if (!m && !session.isSuperAdmin) {
    throw new AuthError(403, "Bạn không thuộc tổ chức này");
  }
  const role = (m?.role ?? "ADMIN") as MemberRole;
  if (allowed.length > 0 && !session.isSuperAdmin && !allowed.includes(role)) {
    throw new AuthError(403, `Yêu cầu vai trò: ${allowed.join(", ")}`);
  }
  return { session, role };
}

/**
 * Confirm the caller has access to a project — either via Membership in any
 * stakeholder org, or as super-admin. Returns the project + the caller's
 * org-types on this project (for workflow guards).
 */
export async function requireProject(projectId: string) {
  const session = await requireSession();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { stakeholders: true, ownerOrg: true },
  });
  if (!project) throw new AuthError(403, "Không tìm thấy dự án hoặc không có quyền");

  if (session.isSuperAdmin) {
    return { session, project, orgRoles: project.stakeholders.map((s) => s.role) };
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    select: { orgId: true, role: true },
  });
  const orgIds = new Set(memberships.map((m) => m.orgId));

  const stakeholderRoles = project.stakeholders
    .filter((s) => orgIds.has(s.orgId))
    .map((s) => s.role);

  // Also count ownership: if user belongs to the ownerOrg
  if (orgIds.has(project.ownerOrgId) && !stakeholderRoles.includes("CHU_DAU_TU")) {
    stakeholderRoles.push("CHU_DAU_TU");
  }

  if (stakeholderRoles.length === 0) {
    throw new AuthError(403, "Bạn không có quyền truy cập dự án này");
  }

  return { session, project, orgRoles: stakeholderRoles };
}

/**
 * Compute org-types a user holds on a given project. Used by workflow guards
 * that don't load the project themselves.
 */
export async function actorOrgRolesForProject(
  userId: string,
  projectId: string,
): Promise<OrgType[]> {
  const [memberships, project] = await Promise.all([
    prisma.membership.findMany({ where: { userId }, select: { orgId: true } }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerOrgId: true, stakeholders: { select: { orgId: true, role: true } } },
    }),
  ]);
  if (!project) return [];
  const orgIds = new Set(memberships.map((m) => m.orgId));
  const roles = project.stakeholders.filter((s) => orgIds.has(s.orgId)).map((s) => s.role);
  if (orgIds.has(project.ownerOrgId) && !roles.includes("CHU_DAU_TU")) {
    roles.push("CHU_DAU_TU");
  }
  return roles;
}
