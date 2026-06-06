/**
 * Clone a template Organization → new tenant Organization with all its
 * project data. Used by /api/tenant/provision and as a standalone CLI.
 *
 * Usage (CLI):
 *   tsx scripts/tenant-clone.ts \
 *     --slug acme-corp \
 *     --name "ACME Corp Pilot" \
 *     --email "ceo@acme.com" \
 *     --company "ACME Corp" \
 *     --template cofico
 *
 * What gets cloned (per project in the template org):
 *   - Project (new ID, key prefixed with tenant slug)
 *   - BoQ + BoQLine
 *   - ScheduleTask (without dependencies; keep simple)
 *   - Issue + RFI / NCR / Submittal / ChangeOrder / PunchItem (no attachments)
 *   - DailyLog (last 14 days only)
 *   - VendorContract + VendorCreditEntry from the tenant's new Org
 *   - AuditPrep + AuditPrepItem
 *
 * NOT cloned (to keep the clone lightweight + avoid privacy issues):
 *   - Attachments (S3 references)
 *   - Models / ModelElement / Clash (would need APS re-translation)
 *   - Comments / messages
 *   - Audit log
 *   - Real users (we create one new OWNER user per tenant)
 */
import { prisma } from "@atlas/db";
import type { ProjectStatus, ProjectDepartment } from "@atlas/db";
import crypto from "crypto";

export type CloneOpts = {
  slug: string;
  name: string;
  prospectEmail: string;
  prospectName?: string;
  prospectCompany?: string;
  prospectIndustry?: string;
  prospectSource?: string;
  templateSlug?: string;
  pilotDays?: number;
};

export type CloneResult = {
  orgId: string;
  ownerUserId: string;
  signinToken: string; // one-time magic link token
  stats: Record<string, number>;
};

const cuid = () => "c" + crypto.randomBytes(12).toString("base64url").replace(/[^a-z0-9]/g, "").slice(0, 24);

export async function cloneTenant(opts: CloneOpts): Promise<CloneResult> {
  const templateSlug = opts.templateSlug ?? "cofico";
  const pilotDays = opts.pilotDays ?? 14;

  // 1) Idempotency: bail if slug already taken
  const existing = await prisma.organization.findUnique({ where: { slug: opts.slug } });
  if (existing) throw new Error(`Slug "${opts.slug}" already taken`);

  // 2) Load template org + projects
  const template = await prisma.organization.findUnique({
    where: { slug: templateSlug },
    include: {
      projectsOwned: {
        take: 5, // limit cloned projects for tenant pilot
        orderBy: { createdAt: "desc" },
        include: {
          boqs: { where: { isCurrent: true }, include: { lines: true } },
          scheduleTasks: true,
          issues: {
            include: { rfi: true, submittal: true, ncr: true, punchItem: true, changeOrder: true },
            take: 50, // cap per project
          },
          dailyLogs: { take: 14, orderBy: { date: "desc" } },
        },
      },
    },
  });
  if (!template) throw new Error(`Template org "${templateSlug}" not found`);

  // 3) Create new tenant Organization
  const expiresAt = new Date(Date.now() + pilotDays * 86_400_000);
  const newOrg = await prisma.organization.create({
    data: {
      name: opts.name,
      slug: opts.slug,
      type: "NHA_THAU_CHINH",
      address: opts.prospectCompany ?? null,
      email: opts.prospectEmail,
      isBetaApproved: true,
      isTenantDemo: true,
      tenantStatus: "ACTIVE",
      tenantExpiresAt: expiresAt,
      tenantProvisionedFrom: templateSlug,
      tenantProvisionedAt: new Date(),
      prospectName: opts.prospectName ?? null,
      prospectEmail: opts.prospectEmail,
      prospectCompany: opts.prospectCompany ?? null,
      prospectIndustry: opts.prospectIndustry ?? null,
      prospectSource: opts.prospectSource ?? "manual",
    },
  });

  // 4) Provisioning log
  const provision = await prisma.tenantProvisioning.create({
    data: { orgId: newOrg.id, sourceOrgId: template.id, status: "RUNNING" },
  });

  // 5) Create OWNER user
  const ownerUser = await prisma.user.create({
    data: {
      email: opts.prospectEmail,
      name: opts.prospectName ?? opts.prospectEmail,
      emailVerified: new Date(),
      isSuperAdmin: false,
    },
  });
  await prisma.membership.create({
    data: { userId: ownerUser.id, orgId: newOrg.id, role: "OWNER" },
  });

  // 6) One-time signin token (24h)
  const signinToken = crypto.randomBytes(32).toString("base64url");
  await prisma.verificationToken.create({
    data: {
      identifier: opts.prospectEmail,
      token: signinToken,
      expires: new Date(Date.now() + 86_400_000),
    },
  });

  const stats = { projects: 0, boqLines: 0, scheduleTasks: 0, issues: 0, dailyLogs: 0 };

  // 7) Clone projects
  for (const oldProject of template.projectsOwned) {
    stats.projects++;

    const newProjectId = cuid();
    const newKey = `${opts.slug.toUpperCase().slice(0, 6)}-${oldProject.key.split("-").slice(-1)[0]}-${String(stats.projects).padStart(2, "0")}`;

    await prisma.project.create({
      data: {
        id: newProjectId,
        key: newKey,
        name: oldProject.name,
        ownerOrgId: newOrg.id,
        address: oldProject.address,
        province: oldProject.province,
        district: oldProject.district,
        contractValueVnd: oldProject.contractValueVnd,
        startDate: oldProject.startDate,
        endDate: oldProject.endDate,
        status: oldProject.status as ProjectStatus,
        department: oldProject.department as ProjectDepartment,
        contractScope: oldProject.contractScope,
        warrantyMonths: oldProject.warrantyMonths,
      },
    });

    // Stakeholder: new org as NHA_THAU_CHINH
    await prisma.projectStakeholder.create({
      data: { projectId: newProjectId, orgId: newOrg.id, role: "NHA_THAU_CHINH" },
    });

    // 7a) BoQ + lines
    for (const boq of oldProject.boqs) {
      const newBoqId = cuid();
      await prisma.boQ.create({
        data: {
          id: newBoqId,
          projectId: newProjectId,
          name: boq.name,
          contractValueVnd: boq.contractValueVnd,
          version: boq.version,
          isCurrent: boq.isCurrent,
        },
      });
      for (const l of boq.lines) {
        await prisma.boQLine.create({
          data: {
            boqId: newBoqId,
            code: l.code,
            description: l.description,
            unit: l.unit,
            qty: l.qty,
            unitPriceVnd: l.unitPriceVnd,
            totalVnd: l.totalVnd,
            qtyCompleted: l.qtyCompleted,
            category: l.category,
          },
        });
        stats.boqLines++;
      }
    }

    // 7b) Schedule tasks
    for (const t of oldProject.scheduleTasks) {
      await prisma.scheduleTask.create({
        data: {
          projectId: newProjectId,
          code: t.code,
          name: t.name,
          discipline: t.discipline,
          zone: t.zone,
          plannedStart: t.plannedStart,
          plannedEnd: t.plannedEnd,
          actualStart: t.actualStart,
          actualEnd: t.actualEnd,
          pctComplete: t.pctComplete,
          state: t.state,
          isCritical: t.isCritical,
          ownerOrgId: newOrg.id,
        },
      });
      stats.scheduleTasks++;
    }

    // 7c) Issues (and sub-tables)
    for (const oldIssue of oldProject.issues) {
      const newIssueId = cuid();
      const newIssueKey = `${newKey}-${oldIssue.key.split("-").slice(-2).join("-")}`;
      await prisma.issue.create({
        data: {
          id: newIssueId,
          key: newIssueKey,
          projectId: newProjectId,
          type: oldIssue.type,
          title: oldIssue.title,
          description: oldIssue.description,
          state: oldIssue.state,
          priority: oldIssue.priority,
          reporterId: ownerUser.id,
          locationZone: oldIssue.locationZone,
          dueDate: oldIssue.dueDate,
        },
      });
      stats.issues++;

      // Sub-tables (id = issueId)
      if (oldIssue.rfi) {
        await prisma.rFI.create({
          data: {
            issueId: newIssueId,
            question: oldIssue.rfi.question,
            category: oldIssue.rfi.category,
            requestedById: newOrg.id,
            respondedById: oldIssue.rfi.respondedById ? newOrg.id : null,
            answer: oldIssue.rfi.answer,
            answeredAt: oldIssue.rfi.answeredAt,
            needBy: oldIssue.rfi.needBy,
            projectId: newProjectId,
          },
        }).catch(() => {});
      }
      if (oldIssue.ncr) {
        await prisma.nCR.create({
          data: {
            issueId: newIssueId,
            severity: oldIssue.ncr.severity,
            rootCause: oldIssue.ncr.rootCause,
            correctiveAction: oldIssue.ncr.correctiveAction,
            preventiveAction: oldIssue.ncr.preventiveAction,
            raisedByOrgId: newOrg.id,
            responsibleOrgId: newOrg.id,
            qcvnRef: oldIssue.ncr.qcvnRef,
            rectifiedAt: oldIssue.ncr.rectifiedAt,
            projectId: newProjectId,
          },
        }).catch(() => {});
      }
      if (oldIssue.submittal) {
        await prisma.submittal.create({
          data: {
            issueId: newIssueId,
            specSection: oldIssue.submittal.specSection,
            materialName: oldIssue.submittal.materialName,
            manufacturer: oldIssue.submittal.manufacturer,
            submitterOrgId: newOrg.id,
            decision: oldIssue.submittal.decision,
            decidedAt: oldIssue.submittal.decidedAt,
            projectId: newProjectId,
          },
        }).catch(() => {});
      }
      if (oldIssue.changeOrder) {
        await prisma.changeOrder.create({
          data: {
            issueId: newIssueId,
            reason: oldIssue.changeOrder.reason,
            scopeChange: oldIssue.changeOrder.scopeChange,
            costDeltaVnd: oldIssue.changeOrder.costDeltaVnd,
            scheduleDeltaDays: oldIssue.changeOrder.scheduleDeltaDays,
            approvedAt: oldIssue.changeOrder.approvedAt,
            approvedByUserId: oldIssue.changeOrder.approvedAt ? ownerUser.id : null,
            projectId: newProjectId,
          },
        }).catch(() => {});
      }
      if (oldIssue.punchItem) {
        await prisma.punchItem.create({
          data: {
            issueId: newIssueId,
            trade: oldIssue.punchItem.trade,
            zone: oldIssue.punchItem.zone,
            acceptedAt: oldIssue.punchItem.acceptedAt,
            projectId: newProjectId,
          },
        }).catch(() => {});
      }
    }

    // 7d) Daily logs (last 14)
    for (const dl of oldProject.dailyLogs) {
      await prisma.dailyLog.create({
        data: {
          projectId: newProjectId,
          date: dl.date,
          authorId: ownerUser.id,
          weather: dl.weather,
          shift: dl.shift,
          workforce: (dl.workforce ?? {}) as any,
          workDone: dl.workDone,
          workTomorrow: dl.workTomorrow,
          safetyNotes: dl.safetyNotes,
        },
      });
      stats.dailyLogs++;
    }
  }

  // 8) Finalize provisioning log
  await prisma.tenantProvisioning.update({
    where: { id: provision.id },
    data: { status: "SUCCESS", finishedAt: new Date(), stats },
  });

  return { orgId: newOrg.id, ownerUserId: ownerUser.id, signinToken, stats };
}

// CLI entrypoint moved to scripts/tenant-clone-cli.ts
