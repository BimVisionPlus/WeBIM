import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

const sourceLabel: Record<string, string> = {
  HOP_DONG: "Hợp đồng", BBNT: "BBNT", CV_QLNN: "CV QLNN", THIET_KE: "Thiết kế",
  TCVN: "TCVN/QCVN", BPTC: "BPTC", RFI: "RFI", EMAIL: "Email", KHAC: "Khác",
};

export default async function DocChatPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/docchat");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projectFilter = {
    OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }],
  };

  const [corpus, recentQueries] = await Promise.all([
    prisma.docCorpus.findMany({
      where: { OR: [{ projectId: null }, { project: projectFilter }] },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.docChatQuery.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const totalDocs = corpus.length;
  const indexed = corpus.filter((c) => c.indexed).length;
  const totalChunks = corpus.reduce((s, c) => s + c.chunkCount, 0);
  const bySource = new Map<string, number>();
  corpus.forEach((c) => bySource.set(c.sourceType, (bySource.get(c.sourceType) ?? 0) + 1));

  return (
    <AecModuleShell
      group="Pháp lý"
      name="DocChat-VN — RAG hồ sơ dự án"
      subtitle="100% OSS. bge-m3 embeddings (1024-dim) + Qwen2.5-14B-Instruct local + pgvector. Citation về điều khoản gốc."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tài liệu corpus</div><div className="mt-1 text-2xl font-bold">{totalDocs}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã index</div><div className="mt-1 text-2xl font-bold text-emerald-700">{indexed}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng chunk</div><div className="mt-1 text-2xl font-bold">{totalChunks.toLocaleString("vi-VN")}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Câu hỏi 7 ngày</div><div className="mt-1 text-2xl font-bold text-violet-700">{recentQueries.length}</div></CardBody></Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Hỏi tài liệu bằng tiếng Việt</CardTitle></CardHeader>
        <CardBody>
          <form action="/api/docchat" method="post" className="space-y-3">
            <textarea name="question" rows={3} placeholder="Ví dụ: Theo NĐ 06/2021 Đ.21, thành phần BBNT công việc xây dựng gồm những ai?" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            <div className="flex justify-between text-xs text-slate-500">
              <span>Model: Qwen2.5-14B-Instruct (Ollama local) · Embedding: bge-m3</span>
              <button type="submit" className="rounded bg-blue-600 px-4 py-1.5 font-medium text-white hover:bg-blue-700">Hỏi</button>
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Corpus phân bố ({totalDocs})</CardTitle></CardHeader>
          <CardBody className="p-0">
            {totalDocs === 0 ? <div className="p-6 text-center text-sm text-slate-500">Chưa có corpus. Index từ SpecPages + hồ sơ thiết kế.</div> : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr><th className="p-2 text-left">Tài liệu</th><th className="p-2 text-left">Nguồn</th><th className="p-2 text-right">Chunk</th><th className="p-2 text-left">Index</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {corpus.slice(0, 15).map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-2 text-xs"><div className="font-medium line-clamp-1">{c.title}</div></td>
                      <td className="p-2 text-xs">{sourceLabel[c.sourceType]}</td>
                      <td className="p-2 text-right text-xs">{c.chunkCount}</td>
                      <td className="p-2">{c.indexed ? <Badge variant="success">✓</Badge> : <Badge variant="warning">Pending</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Câu hỏi gần đây ({recentQueries.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            {recentQueries.length === 0 ? <div className="p-6 text-center text-sm text-slate-500">Chưa có ai hỏi gì.</div> : (
              <div className="divide-y divide-slate-100">
                {recentQueries.map((q) => (
                  <div key={q.id} className="p-3">
                    <div className="text-xs font-medium text-slate-900 line-clamp-2">❓ {q.question}</div>
                    {q.answer && <div className="mt-1 text-[11px] text-slate-600 line-clamp-2">💬 {q.answer}</div>}
                    <div className="mt-1 text-[10px] text-slate-400">{q.modelUsed} · {q.latencyMs ?? "?"} ms · {(q.citations as unknown[] | null)?.length ?? 0} citations</div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 text-[11px] text-slate-500">
        Pipeline: PDF/DOCX/email ingest → tika-server extract text → bge-m3 chunk 512 tokens overlap 64 →
        store embedding Bytes (sau migrate pgvector) → query: top-k=8 cosine + Qwen2.5-14B trả lời với citation.
        Toàn bộ chạy local, không gửi data ra ngoài.
      </div>
    </AecModuleShell>
  );
}
