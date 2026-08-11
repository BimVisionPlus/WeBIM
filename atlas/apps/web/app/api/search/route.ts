/**
 * GET /api/search?q=<text>&ai=1 — cross-module search palette backend.
 *
 * Strategy:
 *   1. Text match (ILIKE) in parallel across 8 modules → top 5 hits each.
 *   2. Score hits by where match landed (key/code > title > body) + recency.
 *   3. Optional bge-m3 rerank when ?ai=1 and query ≥ 3 words.
 *   4. Return top 12 sorted by score.
 *
 * Access: caller's org memberships → filter project/issue scope. Agency docs
 * + internal docs + leads / advances scoped by orgIds. SiteWorker / catalog
 * not indexed (would benefit but not yet wired).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";
import { embed, cosine } from "@atlas/ai";
import { rateLimitGuard } from "@atlas/lib";

type Hit = { kind: string; id: string; title: string; subtitle?: string | null; href: string; score: number; icon: string };

const ICONS = {
  project: "📁",
  issue: "🐞",
  internaldoc: "📄",
  agencydoc: "📨",
  lead: "🎯",
  advance: "💰",
  scheduletask: "📅",
  statusupdate: "📝",
} as const;

function score(query: string, text: string, kind: string, recencyBoost: number): number {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!t.includes(q)) {
    // word-level: count overlapping tokens
    const qw = new Set(q.split(/\s+/).filter((w) => w.length > 1));
    const tw = new Set(t.split(/\s+/));
    let n = 0;
    qw.forEach((w) => { if (tw.has(w)) n++; });
    if (n === 0) return 0;
    return n * 0.3 + recencyBoost;
  }
  // exact substring match
  const isPrefix = t.startsWith(q) ? 0.3 : 0;
  const isShort = t.length < q.length * 3 ? 0.2 : 0;
  const kindBoost = { project: 0.25, issue: 0.15 }[kind] ?? 0.1;
  return 1.0 + isPrefix + isShort + kindBoost + recencyBoost;
}

function recencyBoost(date: Date | null): number {
  if (!date) return 0;
  const days = (Date.now() - date.getTime()) / 86400000;
  if (days < 1) return 0.15;
  if (days < 7) return 0.1;
  if (days < 30) return 0.05;
  return 0;
}

export async function GET(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "search" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const useAi = url.searchParams.get("ai") === "1";
    if (q.length < 2) return NextResponse.json({ hits: [] });

    const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
    const orgIds = memberships.map((m) => m.orgId);
    const accessFilter = { OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }] };
    const ilike = { contains: q, mode: "insensitive" as const };

    const [projects, issues, internalDocs, agencyDocs, leads, advances, scheduleTasks, statusUpdates] = await Promise.all([
      prisma.project.findMany({
        where: { AND: [accessFilter, { OR: [{ name: ilike }, { key: ilike }] }] },
        select: { id: true, key: true, name: true, department: true, createdAt: true },
        take: 8,
      }),
      prisma.issue.findMany({
        where: { AND: [{ project: accessFilter }, { OR: [{ title: ilike }, { key: ilike }] }] },
        select: { id: true, key: true, title: true, projectId: true, state: true, updatedAt: true },
        take: 8,
      }),
      prisma.internalDocument.findMany({
        where: { AND: [{ orgId: { in: orgIds } }, { OR: [{ title: ilike }, { docNo: ilike }, { body: ilike }] }] },
        select: { id: true, docNo: true, title: true, category: true, issuedAt: true },
        take: 6,
      }),
      prisma.agencyDocument.findMany({
        where: { AND: [{ OR: [{ projectId: null }, { project: accessFilter }] }, { OR: [{ subject: ilike }, { docNo: ilike }] }] },
        select: { id: true, docNo: true, subject: true, direction: true, docDate: true },
        take: 6,
      }),
      prisma.projectLead.findMany({
        where: { AND: [{ orgId: { in: orgIds } }, { OR: [{ name: ilike }, { clientName: ilike }] }] },
        select: { id: true, name: true, clientName: true, status: true, createdAt: true },
        take: 6,
      }),
      prisma.advanceTransaction.findMany({
        where: { AND: [{ orgId: { in: orgIds } }, { OR: [{ payeeName: ilike }, { purpose: ilike }, { txnNo: ilike }] }] },
        select: { id: true, txnNo: true, payeeName: true, purpose: true, type: true, txnDate: true },
        take: 6,
      }),
      prisma.scheduleTask.findMany({
        where: { AND: [{ project: accessFilter }, { OR: [{ name: ilike }, { code: ilike }] }] },
        select: { id: true, code: true, name: true, projectId: true, createdAt: true },
        take: 6,
      }),
      prisma.projectStatusUpdate.findMany({
        where: { AND: [{ project: accessFilter }, { OR: [{ title: ilike }, { body: ilike }] }] },
        select: { id: true, title: true, body: true, projectId: true, reportedAt: true },
        take: 6,
      }),
    ]);

    const hits: Hit[] = [];
    for (const p of projects) hits.push({ kind: "project", id: p.id, title: p.name, subtitle: `${p.key} · ${p.department}`, href: `/projects/${p.id}`, score: score(q, `${p.key} ${p.name}`, "project", recencyBoost(p.createdAt)), icon: ICONS.project });
    for (const i of issues) hits.push({ kind: "issue", id: i.id, title: i.title, subtitle: `${i.key} · ${i.state}`, href: `/projects/${i.projectId}/site/issues/${i.key}`, score: score(q, `${i.key} ${i.title}`, "issue", recencyBoost(i.updatedAt)), icon: ICONS.issue });
    for (const d of internalDocs) hits.push({ kind: "internaldoc", id: d.id, title: d.title, subtitle: `${d.docNo} · ${d.category}`, href: `/internaldocs`, score: score(q, `${d.docNo} ${d.title}`, "internaldoc", recencyBoost(d.issuedAt)), icon: ICONS.internaldoc });
    for (const d of agencyDocs) hits.push({ kind: "agencydoc", id: d.id, title: d.subject, subtitle: `${d.docNo} · ${d.direction}`, href: `/stakeholders`, score: score(q, `${d.docNo} ${d.subject}`, "agencydoc", recencyBoost(d.docDate)), icon: ICONS.agencydoc });
    for (const l of leads) hits.push({ kind: "lead", id: l.id, title: l.name, subtitle: `${l.clientName ?? "—"} · ${l.status}`, href: `/leads`, score: score(q, `${l.name} ${l.clientName ?? ""}`, "lead", recencyBoost(l.createdAt)), icon: ICONS.lead });
    for (const t of advances) hits.push({ kind: "advance", id: t.id, title: t.payeeName, subtitle: `${t.type} · ${t.txnNo ?? "—"}`, href: `/advances`, score: score(q, `${t.txnNo ?? ""} ${t.payeeName} ${t.purpose}`, "advance", recencyBoost(t.txnDate)), icon: ICONS.advance });
    for (const t of scheduleTasks) hits.push({ kind: "scheduletask", id: t.id, title: t.name, subtitle: `${t.code}`, href: `/schedule`, score: score(q, `${t.code} ${t.name}`, "scheduletask", recencyBoost(t.createdAt)), icon: ICONS.scheduletask });
    for (const u of statusUpdates) hits.push({ kind: "statusupdate", id: u.id, title: u.title, subtitle: u.body.slice(0, 80), href: `/projects/${u.projectId}/tinh-hinh`, score: score(q, `${u.title} ${u.body}`, "statusupdate", recencyBoost(u.reportedAt)), icon: ICONS.statusupdate });

    let ranked = hits.filter((h) => h.score > 0).sort((a, b) => b.score - a.score);

    // Optional bge-m3 rerank (skipped for prefix queries / short results)
    if (useAi && ranked.length > 3 && q.split(/\s+/).length >= 2) {
      const queryEmbed = await embed(q);
      if (queryEmbed.ok) {
        const candidates = ranked.slice(0, 20);
        const embeds = await Promise.all(candidates.map((h) => embed(`${h.title} ${h.subtitle ?? ""}`)));
        const reranked = candidates.map((h, i) => {
          const e = embeds[i];
          if (!e || !e.ok) return { ...h };
          const sim = cosine(queryEmbed.data, e.data);
          return { ...h, score: h.score * 0.4 + sim * 1.5 };
        });
        ranked = reranked.sort((a, b) => b.score - a.score);
      }
    }

    return NextResponse.json({ hits: ranked.slice(0, 12), aiReranked: useAi });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
