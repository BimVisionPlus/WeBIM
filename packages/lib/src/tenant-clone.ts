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

  // 2) Load template org + projects (small subset for fast clone)
  const template = await prisma.organization.findUnique({
    where: { slug: templateSlug },
    include: {
      projectsOwned: {
        take: 3, // limit cloned projects for tenant pilot
        orderBy: { createdAt: "desc" },
        include: {
          boqs: { where: { isCurrent: true }, include: { lines: true } },
          scheduleTasks: true,
          issues: {
            include: { rfi: true, submittal: true, ncr: true, punchItem: true, changeOrder: true },
            take: 15, // cap per project for fast clone
          },
          dailyLogs: { take: 5, orderBy: { date: "desc" } },
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

  // 7) Pre-allocate cuids + build bulk arrays. Then 1 createMany() per table
  //    rather than per-row create() — N+1 → single round-trip per type.
  type ProjectPlan = {
    newProjectId: string;
    newKey: string;
    oldProject: typeof template.projectsOwned[number];
    issueIdMap: Map<string, string>; // oldIssueId → newIssueId
    boqIdMap: Map<string, string>;
  };
  const plans: ProjectPlan[] = template.projectsOwned.map((oldProject, idx) => {
    const newProjectId = cuid();
    const newKey = `${opts.slug.toUpperCase().slice(0, 6)}-${oldProject.key.split("-").slice(-1)[0]}-${String(idx + 1).padStart(2, "0")}`;
    return { newProjectId, newKey, oldProject, issueIdMap: new Map(), boqIdMap: new Map() };
  });
  stats.projects = plans.length;

  // 7a) Projects + Stakeholders (createMany)
  await prisma.project.createMany({
    data: plans.map((p) => ({
      id: p.newProjectId,
      key: p.newKey,
      name: p.oldProject.name,
      ownerOrgId: newOrg.id,
      address: p.oldProject.address,
      province: p.oldProject.province,
      district: p.oldProject.district,
      contractValueVnd: p.oldProject.contractValueVnd,
      startDate: p.oldProject.startDate,
      endDate: p.oldProject.endDate,
      status: p.oldProject.status as ProjectStatus,
      department: p.oldProject.department as ProjectDepartment,
      contractScope: p.oldProject.contractScope,
      warrantyMonths: p.oldProject.warrantyMonths,
    })),
  });

  await prisma.projectStakeholder.createMany({
    data: plans.map((p) => ({ projectId: p.newProjectId, orgId: newOrg.id, role: "NHA_THAU_CHINH" as const })),
  });

  // 7b) BoQ — only 1 per project usually, so map first
  const boqData: any[] = [];
  for (const p of plans) {
    for (const boq of p.oldProject.boqs) {
      const newBoqId = cuid();
      p.boqIdMap.set(boq.id, newBoqId);
      boqData.push({
        id: newBoqId,
        projectId: p.newProjectId,
        name: boq.name,
        contractValueVnd: boq.contractValueVnd,
        version: boq.version,
        isCurrent: boq.isCurrent,
      });
    }
  }
  if (boqData.length) await prisma.boQ.createMany({ data: boqData });

  // 7c) BoQ lines (bulk)
  const boqLineData: any[] = [];
  for (const p of plans) {
    for (const boq of p.oldProject.boqs) {
      const newBoqId = p.boqIdMap.get(boq.id)!;
      for (const l of boq.lines) {
        boqLineData.push({
          boqId: newBoqId,
          code: l.code,
          description: l.description,
          unit: l.unit,
          qty: l.qty,
          unitPriceVnd: l.unitPriceVnd,
          totalVnd: l.totalVnd,
          qtyCompleted: l.qtyCompleted,
          category: l.category,
        });
      }
    }
  }
  if (boqLineData.length) await prisma.boQLine.createMany({ data: boqLineData });
  stats.boqLines = boqLineData.length;

  // 7d) Schedule tasks (bulk)
  const scheduleData: any[] = [];
  for (const p of plans) {
    for (const t of p.oldProject.scheduleTasks) {
      scheduleData.push({
        projectId: p.newProjectId,
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
      });
    }
  }
  if (scheduleData.length) await prisma.scheduleTask.createMany({ data: scheduleData });
  stats.scheduleTasks = scheduleData.length;

  // 7e) Issues (bulk; pre-allocate IDs so sub-tables can FK to them)
  const issueData: any[] = [];
  for (const p of plans) {
    for (const oldIssue of p.oldProject.issues) {
      const newIssueId = cuid();
      p.issueIdMap.set(oldIssue.id, newIssueId);
      const newIssueKey = `${p.newKey}-${oldIssue.key.split("-").slice(-2).join("-")}`;
      issueData.push({
        id: newIssueId,
        key: newIssueKey,
        projectId: p.newProjectId,
        type: oldIssue.type,
        title: oldIssue.title,
        description: oldIssue.description,
        state: oldIssue.state,
        priority: oldIssue.priority,
        reporterId: ownerUser.id,
        locationZone: oldIssue.locationZone,
        dueDate: oldIssue.dueDate,
      });
    }
  }
  if (issueData.length) await prisma.issue.createMany({ data: issueData });
  stats.issues = issueData.length;

  // 7f) Issue sub-tables (RFI/NCR/Submittal/CO/Punch) — bulk per type
  const rfiData: any[] = [], ncrData: any[] = [], submittalData: any[] = [], coData: any[] = [], punchData: any[] = [];
  for (const p of plans) {
    for (const oldIssue of p.oldProject.issues) {
      const newIssueId = p.issueIdMap.get(oldIssue.id)!;
      if (oldIssue.rfi) rfiData.push({
        issueId: newIssueId,
        question: oldIssue.rfi.question, category: oldIssue.rfi.category,
        requestedById: newOrg.id, respondedById: oldIssue.rfi.respondedById ? newOrg.id : null,
        answer: oldIssue.rfi.answer, answeredAt: oldIssue.rfi.answeredAt, needBy: oldIssue.rfi.needBy,
        projectId: p.newProjectId,
      });
      if (oldIssue.ncr) ncrData.push({
        issueId: newIssueId, severity: oldIssue.ncr.severity,
        rootCause: oldIssue.ncr.rootCause, correctiveAction: oldIssue.ncr.correctiveAction,
        preventiveAction: oldIssue.ncr.preventiveAction,
        raisedByOrgId: newOrg.id, responsibleOrgId: newOrg.id,
        qcvnRef: oldIssue.ncr.qcvnRef, rectifiedAt: oldIssue.ncr.rectifiedAt,
        projectId: p.newProjectId,
      });
      if (oldIssue.submittal) submittalData.push({
        issueId: newIssueId, specSection: oldIssue.submittal.specSection,
        materialName: oldIssue.submittal.materialName, manufacturer: oldIssue.submittal.manufacturer,
        submitterOrgId: newOrg.id, decision: oldIssue.submittal.decision,
        decidedAt: oldIssue.submittal.decidedAt, projectId: p.newProjectId,
      });
      if (oldIssue.changeOrder) coData.push({
        issueId: newIssueId, reason: oldIssue.changeOrder.reason,
        scopeChange: oldIssue.changeOrder.scopeChange,
        costDeltaVnd: oldIssue.changeOrder.costDeltaVnd,
        scheduleDeltaDays: oldIssue.changeOrder.scheduleDeltaDays,
        approvedAt: oldIssue.changeOrder.approvedAt,
        approvedByUserId: oldIssue.changeOrder.approvedAt ? ownerUser.id : null,
        projectId: p.newProjectId,
      });
      if (oldIssue.punchItem) punchData.push({
        issueId: newIssueId, trade: oldIssue.punchItem.trade,
        zone: oldIssue.punchItem.zone, acceptedAt: oldIssue.punchItem.acceptedAt,
        projectId: p.newProjectId,
      });
    }
  }
  await Promise.all([
    rfiData.length ? prisma.rFI.createMany({ data: rfiData }) : null,
    ncrData.length ? prisma.nCR.createMany({ data: ncrData }) : null,
    submittalData.length ? prisma.submittal.createMany({ data: submittalData }) : null,
    coData.length ? prisma.changeOrder.createMany({ data: coData }) : null,
    punchData.length ? prisma.punchItem.createMany({ data: punchData }) : null,
  ].filter(Boolean));

  // 7g) Daily logs (bulk)
  const dailyLogData: any[] = [];
  for (const p of plans) {
    for (const dl of p.oldProject.dailyLogs) {
      dailyLogData.push({
        projectId: p.newProjectId,
        date: dl.date,
        authorId: ownerUser.id,
        weather: dl.weather,
        shift: dl.shift,
        workforce: (dl.workforce ?? {}) as any,
        workDone: dl.workDone,
        workTomorrow: dl.workTomorrow,
        safetyNotes: dl.safetyNotes,
      });
    }
  }
  if (dailyLogData.length) await prisma.dailyLog.createMany({ data: dailyLogData });
  stats.dailyLogs = dailyLogData.length;

  // 8) Finalize provisioning log
  await prisma.tenantProvisioning.update({
    where: { id: provision.id },
    data: { status: "SUCCESS", finishedAt: new Date(), stats },
  });

  return { orgId: newOrg.id, ownerUserId: ownerUser.id, signinToken, stats };
}

// CLI entrypoint moved to scripts/tenant-clone-cli.ts
