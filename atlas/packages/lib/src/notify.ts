/**
 * In-app notifications.
 *
 * Best-effort như audit: một thông báo không ghi được KHÔNG được phép làm
 * hỏng thao tác chính — chuyển giai đoạn thành công mà notify lỗi thì
 * giai đoạn vẫn phải chuyển.
 */

import { prisma } from "@atlas/db";
import { logger } from "./log";

export type NotifyKind =
  | "STAGE_BLOCKED"
  | "STAGE_CHANGED"
  | "GATE_TASK_ASSIGNED"
  | "GATE_READY";

export async function notifyUsers(
  userIds: (string | null | undefined)[],
  data: {
    kind: NotifyKind;
    title: string;
    body?: string;
    link?: string;
    projectId?: string | null;
    /** Người gây ra sự kiện — không tự thông báo cho chính mình. */
    actorId?: string | null;
  },
): Promise<void> {
  const recipients = [...new Set(userIds.filter((id): id is string => Boolean(id)))].filter(
    (id) => id !== data.actorId,
  );
  if (recipients.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        projectId: data.projectId ?? null,
        kind: data.kind,
        title: data.title,
        body: data.body ?? null,
        link: data.link ?? null,
      })),
    });
  } catch (err) {
    logger().warn({ err, kind: data.kind }, "notify.write_failed");
  }
}

/** Thành viên OWNER/ADMIN/PROJECT_MGR của một tổ chức — người cần biết về giai đoạn. */
export async function orgManagerIds(orgId: string): Promise<string[]> {
  const members = await prisma.membership.findMany({
    where: { orgId, role: { in: ["OWNER", "ADMIN", "PROJECT_MGR"] } },
    select: { userId: true },
  });
  return members.map((member) => member.userId);
}
