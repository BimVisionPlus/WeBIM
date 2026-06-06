import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

type Route = { method: "GET" | "POST" | "PATCH" | "DELETE"; path: string; what: string; body?: string; auth: "session" | "org" | "project" | "public" };

const SECTIONS: Array<{ title: string; routes: Route[] }> = [
  {
    title: "Authentication & Session",
    routes: [
      { method: "GET", path: "/api/me", what: "Trả thông tin user + memberships", auth: "session" },
      { method: "GET", path: "/api/health", what: "Health probe — Postgres + Redis + AI providers", auth: "public" },
      { method: "GET", path: "/api/ai/health", what: "AI provider status chi tiết (Groq / Cloudflare)", auth: "session" },
    ],
  },
  {
    title: "Projects",
    routes: [
      { method: "GET", path: "/api/projects", what: "List dự án theo membership", auth: "session" },
      { method: "POST", path: "/api/projects", what: "Tạo dự án mới", body: "{ key, name, ownerOrgId, department, ... }", auth: "org" },
      { method: "PATCH", path: "/api/projects/[id]", what: "Cập nhật dự án (name, dates, dept, scope)", auth: "project" },
      { method: "DELETE", path: "/api/projects/[id]", what: "Soft-delete dự án (status=CLOSED)", auth: "project" },
    ],
  },
  {
    title: "Issues (RFI / NCR / Submittal / ChangeOrder / Punch)",
    routes: [
      { method: "POST", path: "/api/issues/transition", what: "FSM transition Issue.state với role guard", body: "{ issueKey, toState, payload?, reason? }", auth: "project" },
      { method: "POST", path: "/api/projects/[id]/issues", what: "Tạo Issue (type=TASK|RFI|NCR|SUBMITTAL|CHANGE_ORDER|PUNCH)", auth: "project" },
    ],
  },
  {
    title: "Atlas Vendor (module 02)",
    routes: [
      { method: "POST", path: "/api/vendor/contracts", what: "Tạo HĐ vendor (FRAMEWORK | ANNUAL | SPOT_PO | RAMP_UP)", body: "{ orgId, vendorOrgId? | supplierId?, vendorName, contractNo, type, startDate, valueVnd?, state }", auth: "org" },
      { method: "PATCH", path: "/api/vendor/contracts/[id]", what: "Cập nhật state HĐ vendor", auth: "org" },
      { method: "DELETE", path: "/api/vendor/contracts/[id]", what: "Soft-delete (= TERMINATED) khi có credit entry", auth: "org" },
      { method: "POST", path: "/api/vendor/credit", what: "Ghi giao dịch công nợ (PURCHASE|PAYMENT|RETURN|ADJUST)", body: "{ orgId, contractId?, vendorName, txnDate, type, amountVnd, notes? }", auth: "org" },
    ],
  },
  {
    title: "Atlas Cost (module 03)",
    routes: [
      { method: "GET", path: "/api/cost-norm/search", what: "Tra định mức TT 10/2019 với đơn giá theo tỉnh × kỳ", auth: "session" },
      { method: "POST", path: "/api/cost-norm/estimate", what: "Lập dự toán nhanh từ mã + qty", body: "{ code, qty, province?, period? }", auth: "session" },
      { method: "POST", path: "/api/ai/cost-overrun/forecast", what: "AI forecast EVM (BAC/EV/AC/CPI/SPI/EAC) + drivers + action", body: "{ projectId, persist?: bool }", auth: "project" },
    ],
  },
  {
    title: "Atlas Compliance (module 04)",
    routes: [
      { method: "POST", path: "/api/audit-preps", what: "Tạo audit prep workflow (PC07/Sở XD/Hoàn công QLNN/...)", body: "{ projectId, kind, title, items? }", auth: "project" },
      { method: "PATCH", path: "/api/audit-preps/[id]/items/[itemId]", what: "Cập nhật trạng thái item (PENDING → READY/FAILED)", auth: "project" },
      { method: "POST", path: "/api/ai/compliance/check", what: "AI đánh giá compliance per TCVN/QCVN", body: "{ projectId, standardCodes? }", auth: "project" },
    ],
  },
  {
    title: "Atlas Field (module 05, PWA mobile)",
    routes: [
      { method: "POST", path: "/api/field/checkin", what: "GPS check-in/out (Attendance)", body: "{ projectId, lat, lon, accuracy?, mode: 'in' | 'out' }", auth: "session" },
      { method: "POST", path: "/api/ai/field/voice-form", what: "Voice → AI phân 5 intent + rút trích form", body: "multipart: file (audio) HOẶC transcript (text)", auth: "session" },
    ],
  },
  {
    title: "AI cross-cutting",
    routes: [
      { method: "GET", path: "/api/digest?dept=", what: "Weekly digest mỗi phòng (Groq Llama summary 80 từ)", auth: "session" },
      { method: "POST", path: "/api/ai/classify-doc", what: "Classify công văn (QUYET_DINH/THONG_BAO/QUY_TRINH/...)", body: "{ title }", auth: "session" },
      { method: "POST", path: "/api/ai/summarize-status", what: "Tóm tắt 5 cập nhật tình hình gần nhất", body: "{ projectId }", auth: "project" },
      { method: "POST", path: "/api/ai/schedule/risk", what: "AI dự đoán slip risk per task hoặc per project", body: "{ taskId } | { projectId }", auth: "project" },
      { method: "POST", path: "/api/ai/hoancong/draft", what: "AI draft hồ sơ hoàn công VIIIb mục 1-13", body: "{ projectId, seq?, all?: bool }", auth: "project" },
      { method: "POST", path: "/api/ai/submittal/check", what: "AI compare submittal vs spec (bge-m3 + Llama)", body: "{ submittalId }", auth: "project" },
      { method: "POST", path: "/api/ai/transcribe", what: "Whisper STT (multipart audio → text)", auth: "session" },
      { method: "POST", path: "/api/ai/spec/search", what: "Semantic search trên SpecPage corpus (bge-m3)", body: "{ projectId, query, topK? }", auth: "project" },
    ],
  },
  {
    title: "Audit + Compliance",
    routes: [
      { method: "GET", path: "/api/audit", what: "Liệt kê AuditEvent có filter (entity, user, days)", auth: "session" },
      { method: "GET", path: "/api/audit/export", what: "Xuất CSV audit log (?format=csv)", auth: "session" },
    ],
  },
  {
    title: "Invites & Team",
    routes: [
      { method: "POST", path: "/api/invites", what: "Tạo invite + gửi email Resend + copy-link fallback", body: "{ orgId, email, role, projectId? }", auth: "org+admin" as any },
      { method: "POST", path: "/api/invites/accept", what: "Accept invite + tạo user nếu cần", body: "{ token, name?, password? }", auth: "public" },
    ],
  },
];

const VERB_CLS: Record<Route["method"], string> = {
  GET: "bg-emerald-100 text-emerald-800 border-emerald-300",
  POST: "bg-blue-100 text-blue-800 border-blue-300",
  PATCH: "bg-amber-100 text-amber-800 border-amber-300",
  DELETE: "bg-rose-100 text-rose-800 border-rose-300",
};

const AUTH_LABEL: Record<string, { vn: string; cls: string }> = {
  public: { vn: "Không cần", cls: "bg-slate-100 text-slate-700" },
  session: { vn: "Cần đăng nhập", cls: "bg-blue-100 text-blue-800" },
  org: { vn: "Member của Org", cls: "bg-violet-100 text-violet-800" },
  project: { vn: "Có quyền Project", cls: "bg-amber-100 text-amber-800" },
  "org+admin": { vn: "OWNER/ADMIN", cls: "bg-rose-100 text-rose-800" },
};

export default function ApiDocsPage() {
  const totalRoutes = SECTIONS.reduce((s, sec) => s + sec.routes.length, 0);

  return (
    <AecModuleShell group="API" name="Viwase API — Reference" subtitle={`${totalRoutes} REST endpoints. JSON request/response. Auth qua NextAuth session cookie hoặc API key (Enterprise tier).`}>
      <Card className="border-blue-200 bg-blue-50/40">
        <CardBody>
          <CardTitle>Quick start</CardTitle>
          <p className="mt-2 text-sm text-slate-700">
            Tất cả endpoints cần Cookie session. Lấy session bằng cách POST <code className="rounded bg-white px-1.5 py-0.5">/api/auth/callback/credentials</code> với email/password. Sau đó truyền cookie vào mọi request tiếp theo.
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
{`# Login
curl -c jar -X POST https://app.aecplatform.vn/api/auth/callback/credentials \\
  -d 'csrfToken=...' \\
  -d 'email=anh.nguyen@cofico.vn' \\
  -d 'password=demo1234!'

# Use session
curl -b jar https://app.aecplatform.vn/api/me`}
          </pre>
        </CardBody>
      </Card>

      {SECTIONS.map((sec) => (
        <Card key={sec.title} className="mt-4">
          <CardHeader><CardTitle>{sec.title} <span className="text-sm font-normal text-slate-400">({sec.routes.length})</span></CardTitle></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="p-2 text-left w-16">Method</th><th className="p-2 text-left">Path</th><th className="p-2 text-left">Mô tả</th><th className="p-2 text-left">Body</th><th className="p-2 text-left w-32">Auth</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sec.routes.map((r) => {
                  const auth = AUTH_LABEL[r.auth] ?? AUTH_LABEL.session!;
                  return (
                    <tr key={`${r.method}-${r.path}`} className="hover:bg-slate-50 align-top">
                      <td className="p-2">
                        <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold ${VERB_CLS[r.method]}`}>{r.method}</span>
                      </td>
                      <td className="p-2 font-mono text-[11px]">{r.path}</td>
                      <td className="p-2 text-xs">{r.what}</td>
                      <td className="p-2 text-[10px] font-mono text-slate-600 max-w-md">{r.body ?? "—"}</td>
                      <td className="p-2"><span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${auth.cls}`}>{auth.vn}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ))}

      <Card className="mt-6">
        <CardHeader><CardTitle>Rate limits</CardTitle></CardHeader>
        <CardBody>
          <ul className="space-y-1.5 text-sm">
            <li>· CRUD endpoints: 60 req/min/user/IP</li>
            <li>· AI endpoints (heavy): 20 req/min/user/IP</li>
            <li>· Auth endpoints: 5 req/min/IP (brute-force protection)</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Quá rate limit → HTTP 429 với header <code className="rounded bg-slate-100 px-1.5 py-0.5">Retry-After</code>. Enterprise tier custom limit theo HĐ.
          </p>
        </CardBody>
      </Card>

      <Card className="mt-3">
        <CardHeader><CardTitle>Error format</CardTitle></CardHeader>
        <CardBody>
          <pre className="overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
{`{
  "error": "Bạn không thuộc tổ chức này"  // user-facing VN
}
// HTTP status: 400 (zod), 401 (anon), 403 (forbidden), 404 (not found),
// 409 (conflict), 429 (rate limit), 500 (internal)`}
          </pre>
        </CardBody>
      </Card>

      <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        OpenAPI 3.0 spec auto-generated từ zod schemas — cho Enterprise tier xuất ra Postman collection / Swagger UI. Liên hệ <a href="mailto:sales@aecplatform.vn" className="text-blue-600 underline">sales@aecplatform.vn</a> để có file <code>openapi.json</code>.
      </div>
    </AecModuleShell>
  );
}
