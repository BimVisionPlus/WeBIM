// Platform modules beyond modeling: CDE, Plan (tasks), Standards
// (QCVN/TCVN lookup) and Drawings (PDF viewing + notes).
// Metadata lives in the synced project; binaries go to the platform
// server via the store's upload helper.

import { useEffect, useRef, useState } from "react";
import {
  corpusImportedOn,
  searchStandards,
  supersessionChain,
  CORPUS_PROVENANCE,
  STANDARDS_CATALOG,
} from "../standards/catalog";
import { climateFindings, facadeByOrientation } from "../application/climate";
import { ganttChart, weekTicks } from "../application/gantt";
import { Viewer3D } from "../viewport/Viewer3D";
import {
  ATLAS_DISCIPLINES,
  listAtlasProjects,
  loadAtlasConfig,
  publishToAtlas,
  saveAtlasConfig,
  type AtlasConfig,
  type AtlasDiscipline,
  type AtlasProject,
  type PublishResult,
} from "../sync/atlasBridge";
import type { DocumentDatum, DocumentStatus, TaskStatus } from "../domain/project";
import {
  authHeaders,
  fetchFileUrl,
  fileServerBase,
  store,
  useStoreVersion,
} from "../state/store";

const DOCUMENT_STATUSES: DocumentStatus[] = ["WIP", "SHARED", "PUBLISHED", "ARCHIVED"];
const TASK_STATUSES: TaskStatus[] = ["NOT_STARTED", "IN_PROGRESS", "DONE", "BLOCKED"];

/** Renders a stored file through an authenticated blob URL. */
function StoredFileFrame({ fileKey, title }: { fileKey: string; title: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    setUrl(null);
    setError(null);
    fetchFileUrl(fileKey)
      .then((objectUrl) => {
        revoked = objectUrl;
        setUrl(objectUrl);
      })
      .catch((cause) => setError((cause as Error).message));
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [fileKey]);
  if (error) return <p className="module-hint">Không tải được file: {error}</p>;
  if (!url) return <p className="module-hint">Đang tải…</p>;
  return <iframe className="drawing-frame" title={title} src={url} />;
}

function downloadStoredFile(fileKey: string, fileName: string): void {
  void fetchFileUrl(fileKey).then((url) => {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

export function CdeModule() {
  useStoreVersion();
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const documents = store.project.documents;
  const selected =
    store.selection?.kind === "document"
      ? documents.find((document) => document.id === store.selection?.id)
      : undefined;

  return (
    <div className="module-host">
      <h2>CDE — Common Data Environment</h2>
      <p className="module-hint">
        Naming theo ISO 19650 (Project-Originator-Volume-Level-Type-Role-Number).
        Metadata đồng bộ realtime; file nhị phân lưu trên platform server (BYO-storage
        adapter).
      </p>
      <div className="module-form">
        <input
          placeholder="Mã tài liệu, vd: WBM-XYZ-00-GF-DR-A-0001"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <input
          placeholder="Tiêu đề"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button
          onClick={() => {
            store.addDocument(code, title);
            setCode("");
            setTitle("");
          }}
        >
          Add document
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Title</th>
            <th>Status</th>
            <th>Revs</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr
              key={document.id}
              className={selected?.id === document.id ? "row-selected" : ""}
              onClick={() => store.select({ kind: "document", id: document.id })}
            >
              <td>{document.code}</td>
              <td>{document.title}</td>
              <td>
                <select
                  value={document.status}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    store.updateDocument(document.id, {
                      status: event.target.value as DocumentStatus,
                    })
                  }
                >
                  {DOCUMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </td>
              <td>{document.revisions.length}</td>
              <td>
                <button
                  className="mini"
                  onClick={(event) => {
                    event.stopPropagation();
                    store.removeDocument(document.id);
                  }}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected && <DocumentDetail document={selected} />}
    </div>
  );
}

function DocumentDetail({ document }: { document: DocumentDatum }) {
  const [note, setNote] = useState("");
  return (
    <div className="module-detail">
      <h3>{document.code} — revisions</h3>
      <div className="module-form">
        <input
          placeholder="Ghi chú revision"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <label className="upload-button">
          Upload file…
          <input
            type="file"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void store.uploadDocumentRevision(document.id, file, note);
                setNote("");
              }
              event.target.value = "";
            }}
          />
        </label>
        <button
          onClick={() => {
            store.addDocumentRevisionMeta(document.id, note || "(metadata only)");
            setNote("");
          }}
        >
          Metadata-only rev
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Rev</th>
            <th>Note</th>
            <th>File</th>
            <th>Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {document.revisions.map((revision) => (
            <tr key={revision.id}>
              <td>{revision.rev}</td>
              <td>{revision.note}</td>
              <td>
                {revision.fileKey ? (
                  <button
                    className="link-button"
                    onClick={() =>
                      downloadStoredFile(revision.fileKey!, revision.fileName ?? "file")
                    }
                  >
                    {revision.fileName}
                  </button>
                ) : (
                  "—"
                )}
              </td>
              <td>{revision.uploadedAt.slice(0, 19).replace("T", " ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const GANTT_DAY_WIDTH = 18;
const GANTT_ROW_HEIGHT = 26;
const GANTT_LABEL_WIDTH = 180;

function GanttView() {
  const chart = ganttChart(store.project, new Date().toISOString().slice(0, 10));
  if (!chart) {
    return (
      <p className="module-hint">
        Chưa có hạng mục nào có ngày bắt đầu/kết thúc — nhập ngày để vẽ Gantt.
      </p>
    );
  }
  const width = GANTT_LABEL_WIDTH + chart.totalDays * GANTT_DAY_WIDTH + 20;
  const height = chart.bars.length * GANTT_ROW_HEIGHT + 30;
  const x = (day: number) => GANTT_LABEL_WIDTH + day * GANTT_DAY_WIDTH;
  const y = (row: number) => 24 + row * GANTT_ROW_HEIGHT;
  const statusColor: Record<string, string> = {
    NOT_STARTED: "#4b5563",
    IN_PROGRESS: "#4da3ff",
    DONE: "#5f9e6e",
    BLOCKED: "#e06c75",
  };
  return (
    <div className="gantt-scroll">
      <svg width={width} height={height}>
        {weekTicks(chart).map((tick) => (
          <g key={tick.day}>
            <line
              x1={x(tick.day)}
              y1={16}
              x2={x(tick.day)}
              y2={height}
              stroke="#262a32"
            />
            <text x={x(tick.day) + 2} y={12} fill="#8b93a3" fontSize={9}>
              {tick.label}
            </text>
          </g>
        ))}
        {chart.todayDay !== null && (
          <line
            x1={x(chart.todayDay)}
            y1={16}
            x2={x(chart.todayDay)}
            y2={height}
            stroke="#e0996c"
            strokeDasharray="4 3"
          />
        )}
        {chart.bars.map((bar) => (
          <g key={bar.task.id}>
            <text
              x={4}
              y={y(bar.row) + 12}
              fill="#d7dae0"
              fontSize={11}
            >
              {bar.task.name.slice(0, 26)}
            </text>
            {bar.startDay !== null && bar.endDay !== null && (
              <>
                <rect
                  x={x(bar.startDay)}
                  y={y(bar.row)}
                  width={(bar.endDay - bar.startDay) * GANTT_DAY_WIDTH}
                  height={16}
                  rx={3}
                  fill={statusColor[bar.task.status] ?? "#4b5563"}
                  opacity={0.35}
                />
                <rect
                  x={x(bar.startDay)}
                  y={y(bar.row)}
                  width={
                    (bar.endDay - bar.startDay) *
                    GANTT_DAY_WIDTH *
                    (bar.task.progress / 100)
                  }
                  height={16}
                  rx={3}
                  fill={statusColor[bar.task.status] ?? "#4b5563"}
                />
              </>
            )}
          </g>
        ))}
        {chart.links.map((link, index) => {
          const x1 = x(link.fromEndDay);
          const y1 = y(link.fromRow) + 8;
          const x2 = x(link.toStartDay);
          const y2 = y(link.toRow) + 8;
          const mid = x1 + Math.max(6, (x2 - x1) / 2);
          return (
            <g key={index} stroke={link.violated ? "#e06c75" : "#8b93a3"} fill="none">
              <path d={`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`} />
              <path
                d={`M ${x2 - 5} ${y2 - 4} L ${x2} ${y2} L ${x2 - 5} ${y2 + 4}`}
                fill={link.violated ? "#e06c75" : "#8b93a3"}
              />
            </g>
          );
        })}
      </svg>
      {chart.links.some((link) => link.violated) && (
        <p className="module-hint climate-finding warning">
          Có phụ thuộc bị vi phạm (đường đỏ): công việc bắt đầu trước khi công
          việc tiền nhiệm kết thúc.
        </p>
      )}
    </div>
  );
}

export function PlanModule() {
  useStoreVersion();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [view, setView] = useState<"TABLE" | "GANTT">("TABLE");
  const tasks = store.project.tasks;
  const done = tasks.filter((task) => task.status === "DONE").length;

  return (
    <div className="module-host">
      <h2>Plan — hạng mục &amp; tiến độ</h2>
      <p className="module-hint">
        {tasks.length} hạng mục · {done} hoàn thành ·{" "}
        {tasks.length
          ? Math.round(
              tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length,
            )
          : 0}
        % tiến độ bình quân
      </p>
      <div className="module-form">
        <input
          placeholder="Tên hạng mục"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          placeholder="Nhóm (kết cấu / hoàn thiện / MEP…)"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        />
        <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
        <button
          onClick={() => {
            store.addTask(name, category, start, end);
            setName("");
          }}
        >
          Add task
        </button>
        <span className="view-toggle">
          <button
            className={view === "TABLE" ? "active" : ""}
            onClick={() => setView("TABLE")}
          >
            Bảng
          </button>
          <button
            className={view === "GANTT" ? "active" : ""}
            onClick={() => setView("GANTT")}
          >
            Gantt
          </button>
        </span>
      </div>
      {view === "GANTT" && <GanttView />}
      {view === "TABLE" && (
      <>
      <table>
        <thead>
          <tr>
            <th>Hạng mục</th>
            <th>Nhóm</th>
            <th>Bắt đầu</th>
            <th>Kết thúc</th>
            <th>Trạng thái</th>
            <th>Phụ thuộc</th>
            <th style={{ minWidth: 160 }}>Tiến độ</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>{task.name}</td>
              <td>{task.category}</td>
              <td>{task.start}</td>
              <td>{task.end}</td>
              <td>
                <select
                  value={task.status}
                  onChange={(event) =>
                    store.updateTask(task.id, { status: event.target.value as TaskStatus })
                  }
                >
                  {TASK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  value=""
                  title={task.dependsOn
                    .map((id) => tasks.find((t) => t.id === id)?.name ?? "?")
                    .join(", ")}
                  onChange={(event) => {
                    const id = event.target.value;
                    if (!id) return;
                    const next = task.dependsOn.includes(id)
                      ? task.dependsOn.filter((d) => d !== id)
                      : [...task.dependsOn, id];
                    store.updateTask(task.id, { dependsOn: next });
                  }}
                >
                  <option value="">
                    {task.dependsOn.length === 0
                      ? "—"
                      : `${task.dependsOn.length} tiền nhiệm`}
                  </option>
                  {tasks
                    .filter((candidate) => candidate.id !== task.id)
                    .map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {(task.dependsOn.includes(candidate.id) ? "✓ " : "") +
                          candidate.name}
                      </option>
                    ))}
                </select>
              </td>
              <td>
                <div className="progress-cell">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={task.progress}
                    onChange={(event) =>
                      store.updateTask(task.id, { progress: Number(event.target.value) })
                    }
                  />
                  <span>{task.progress}%</span>
                </div>
              </td>
              <td>
                <button className="mini" onClick={() => store.removeTask(task.id)}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </>
      )}
    </div>
  );
}

export function StandardsModule() {
  useStoreVersion();
  const [query, setQuery] = useState("");
  const results = searchStandards(query);
  return (
    <div className="module-host">
      <h2>Standards — tra cứu QCVN / TCVN</h2>
      <p className="module-hint">
        {STANDARDS_CATALOG.length} văn bản ·{" "}
        {STANDARDS_CATALOG.filter((entry) => entry.source === "corpus").length} từ
        corpus machine-checkable (qcvn-conflict-map, kèm xung đột liên-quy-chuẩn) ·
        còn lại là seed đã đối chiếu nguồn thứ cấp. Chưa mục nào đối chiếu công báo
        (edition_verified) — luôn kiểm tra văn bản gốc trước khi áp dụng.
      </p>
      <p className="module-hint">
        {corpusImportedOn()
          ? `Corpus tự động cập nhật hằng tuần · lần nhập gần nhất ${corpusImportedOn()}`
          : "Corpus chưa ghi mốc nhập — chạy npm run import-corpus"}
        {CORPUS_PROVENANCE.revision && (
          <>
            {" · "}
            <a
              href={`${CORPUS_PROVENANCE.source}/commit/${CORPUS_PROVENANCE.revision}`}
              target="_blank"
              rel="noreferrer"
            >
              {CORPUS_PROVENANCE.revision.slice(0, 8)}
            </a>
          </>
        )}
      </p>
      <div className="module-form">
        <input
          placeholder="Tìm theo mã, tên, tag… (vd: chay, tai trong, chung cu)"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ minWidth: 320 }}
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>Mã hiệu</th>
            <th>Tên</th>
            <th>Hiệu lực</th>
            <th>Thay thế</th>
            <th>Nguồn</th>
            <th>Xung đột</th>
            <th>Tags / Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {results.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.code}</td>
              <td>{entry.title}</td>
              <td>{entry.status === "HIEN_HANH" ? "Hiện hành" : "Hết hiệu lực"}</td>
              <td>{supersessionChain(entry).join(" → ") || "—"}</td>
              <td>
                <span className={`source-badge ${entry.source}`}>
                  {entry.source === "corpus" ? "corpus" : "seed"}
                </span>
              </td>
              <td>
                {entry.conflicts.length === 0
                  ? "—"
                  : entry.conflicts.map((conflict) => (
                      <div key={conflict.id} className="conflict-ref" title={conflict.title}>
                        {conflict.id} ({conflict.severity})
                      </div>
                    ))}
              </td>
              <td>{[entry.tags.join(", "), entry.note].filter(Boolean).join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AiAskBox({ fileKey }: { fileKey: string | null }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ask = async () => {
    if (!fileKey || !question.trim() || busy) return;
    setBusy(true);
    setAnswer(null);
    try {
      const response = await fetch(`${fileServerBase()}/ai/read-drawing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ key: fileKey, question }),
      });
      const body = (await response.json()) as { answer?: string; error?: string };
      setAnswer(response.ok ? (body.answer ?? "") : `⚠ ${body.error}`);
    } catch (error) {
      setAnswer(`⚠ ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ai-ask">
      <h3>AI đọc bản vẽ</h3>
      <div className="module-form">
        <input
          placeholder="Hỏi về bản vẽ này… (vd: liệt kê các trục và khoảng cách)"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void ask();
          }}
          style={{ minWidth: 240 }}
        />
        <button disabled={!fileKey || busy} onClick={() => void ask()}>
          {busy ? "Đang đọc…" : "Hỏi AI"}
        </button>
      </div>
      {answer && <div className="ai-answer">{answer}</div>}
    </div>
  );
}

export function DrawingsModule() {
  useStoreVersion();
  const [note, setNote] = useState("");
  const drawings = store.project.documents.filter((document) =>
    document.revisions.some((revision) =>
      revision.fileName?.toLowerCase().endsWith(".pdf"),
    ),
  );
  const selected =
    store.selection?.kind === "document"
      ? drawings.find((document) => document.id === store.selection?.id)
      : drawings[0];
  const latestPdf = selected?.revisions
    .filter((revision) => revision.fileName?.toLowerCase().endsWith(".pdf"))
    .at(-1);

  return (
    <div className="module-host drawings">
      <h2>Drawings — đọc bản vẽ &amp; ghi chú</h2>
      {drawings.length === 0 ? (
        <p className="module-hint">
          Chưa có bản vẽ PDF — upload một revision .pdf trong module CDE.
        </p>
      ) : (
        <div className="drawings-body">
          <div className="drawings-list">
            {drawings.map((document) => (
              <div
                key={document.id}
                className={`tree-leaf ${selected?.id === document.id ? "selected" : ""}`}
                onClick={() => store.select({ kind: "document", id: document.id })}
              >
                <span>{document.code}</span>
              </div>
            ))}
            {selected && (
              <>
                <h3>Notes</h3>
                {selected.notes.map((documentNote) => (
                  <div key={documentNote.id} className="drawing-note">
                    <em>{documentNote.author}</em> {documentNote.text}
                  </div>
                ))}
                <div className="module-form">
                  <input
                    placeholder="Thêm ghi chú…"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                  <button
                    onClick={() => {
                      store.addDocumentNote(selected.id, note);
                      setNote("");
                    }}
                  >
                    Note
                  </button>
                </div>
                <AiAskBox fileKey={latestPdf?.fileKey ?? null} />
              </>
            )}
          </div>
          {latestPdf?.fileKey && (
            <StoredFileFrame
              fileKey={latestPdf.fileKey}
              title={latestPdf.fileName ?? "drawing"}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function ClimateModule() {
  useStoreVersion();
  const rows = facadeByOrientation(store.project);
  const findings = climateFindings(rows);
  return (
    <div className="module-host">
      <h2>Climate — phân tích vi khí hậu theo hướng</h2>
      <p className="module-hint">
        Sàng lọc sơ bộ vỏ bao che theo định hướng OTTV của QCVN 09:2017/BXD —
        diện tích mặt đứng/kính và WWR theo 8 hướng (+Y = Bắc; mặt ngoài xác
        định bằng pháp tuyến hướng ra khỏi tâm mặt bằng). KHÔNG thay thế tính
        toán năng lượng đầy đủ.
      </p>
      <table>
        <thead>
          <tr>
            <th>Hướng</th>
            <th>Số tường</th>
            <th>Mặt đứng (m²)</th>
            <th>Kính (m²)</th>
            <th>Cửa đi (m²)</th>
            <th style={{ minWidth: 180 }}>WWR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.orientation}>
              <td>{row.orientation}</td>
              <td>{row.wallCount}</td>
              <td>{row.wallArea.toFixed(1)}</td>
              <td>{row.windowArea.toFixed(1)}</td>
              <td>{row.doorArea.toFixed(1)}</td>
              <td>
                <div className="wwr-cell">
                  <div className="wwr-bar">
                    <div
                      className={`wwr-fill ${row.wwr > 0.3 ? "hot" : ""}`}
                      style={{ width: `${Math.min(100, row.wwr * 100)}%` }}
                    />
                  </div>
                  <span>{(row.wwr * 100).toFixed(1)}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="module-detail">
        <h3>Đánh giá</h3>
        {findings.map((finding, index) => (
          <div key={index} className={`climate-finding ${finding.severity}`}>
            {finding.text}
          </div>
        ))}
      </div>
    </div>
  );
}

const RENDER_STYLES = [
  "Hiện đại nhiệt đới (tropical modern)",
  "Tối giản đương đại",
  "Tân cổ điển",
  "Công nghiệp (industrial)",
];

export function ViewerModule() {
  const version = useStoreVersion();
  const captureRef = useRef<(() => string) | null>(null);
  const [style, setStyle] = useState(RENDER_STYLES[0]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    brief_vi?: string;
    prompt_en?: string;
    image?: string | null;
    error?: string;
  } | null>(null);

  const renderConcept = async () => {
    const capture = captureRef.current;
    if (!capture || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch(`${fileServerBase()}/ai/render-concept`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ image: capture(), style }),
      });
      const body = await response.json();
      setResult(response.ok ? body : { error: body.error });
    } catch (error) {
      setResult({ error: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const onPickIfc = async (file: File | undefined) => {
    if (!file) return;
    store.linkIfcModel(file.name, await file.text());
  };

  return (
    <div className="module-host viewer-module">
      <div className="module-form">
        <span className="module-hint" style={{ margin: 0 }}>
          Kéo xoay · lăn chuột zoom · chuột phải pan
        </span>
        <label className="upload-button">
          Link IFC…
          <input
            type="file"
            accept=".ifc"
            style={{ display: "none" }}
            onChange={(event) => {
              void onPickIfc(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {store.linkedModels.map((model) => (
          <span key={model.name} className="peer-chip">
            {model.name} · {model.elements.length} phần tử
            <button className="mini" onClick={() => store.unlinkIfcModel(model.name)}>
              ×
            </button>
          </span>
        ))}
        <select value={style} onChange={(event) => setStyle(event.target.value)}>
          {RENDER_STYLES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button disabled={busy} onClick={() => void renderConcept()}>
          {busy ? "Đang render…" : "Render concept AI"}
        </button>
      </div>
      <Viewer3D
        project={store.project}
        linked={store.linkedModels}
        version={version}
        onReady={(capture) => {
          captureRef.current = capture;
        }}
      />
      {result && (
        <div className="render-result">
          {result.error && <div className="climate-finding warning">⚠ {result.error}</div>}
          {result.image && (
            <img src={result.image} alt="AI concept render" className="render-image" />
          )}
          {result.brief_vi && (
            <div className="ai-answer">
              <strong>Kịch bản render:</strong> {result.brief_vi}
              {"\n\n"}
              <strong>Prompt:</strong> {result.prompt_en}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Atlas — the project-management half of the platform (atlas/ in this repo),
 * embedded whole rather than linked to.
 *
 * WeBIM authors the model; Atlas runs the paperwork around it (RFI, submittal,
 * nghiệm thu, hồ sơ hoàn công, Models + canvas review). Atlas is a Next.js app
 * with its own server, so it cannot be compiled into this Vite bundle — it is
 * framed at its own origin, which keeps its session, routing and streaming
 * intact while making it one more tab of WeBIM.
 *
 * Atlas must permit the embed: it sends X-Frame-Options SAMEORIGIN unless
 * FRAME_ANCESTORS names this origin (see atlas/apps/web/next.config.mjs).
 * The browser cannot report a refused frame to us cross-origin, so the header
 * always offers "mở tab mới" instead of leaving a blank rectangle.
 *
 * "Đẩy model" is the other half of the seam: it exports the native project to
 * IFC here and publishes it into an Atlas project's Models module.
 */
export function AtlasModule() {
  useStoreVersion();
  const [config, setConfig] = useState<AtlasConfig>(() => loadAtlasConfig());
  const [pane, setPane] = useState<"app" | "publish">("app");
  const [projects, setProjects] = useState<AtlasProject[] | null>(null);
  const [modelName, setModelName] = useState(store.project.name);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<PublishResult | null>(null);

  const update = (patch: Partial<AtlasConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveAtlasConfig(next);
  };

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const found = await listAtlasProjects(config);
      setProjects(found);
      // Keep an already-chosen project if the org still has it; otherwise the
      // stored id is stale (revoked key, different org) and must be re-picked.
      const stillThere = found.some((project) => project.id === config.projectId);
      if (!stillThere) {
        const first = found[0];
        update({
          projectId: first?.id ?? "",
          projectLabel: first ? `${first.key} — ${first.name}` : "",
        });
      }
    } catch (cause) {
      setProjects(null);
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    setError(null);
    setPublished(null);
    setLog([]);
    try {
      const result = await publishToAtlas({
        config,
        ifc: store.exportIfc(),
        modelName,
        webimProjectId: store.project.id,
        onProgress: (message) => setLog((lines) => [...lines, message]),
      });
      setPublished(result);
      store.setStatus(
        result.replaced
          ? `Atlas: đã thay thế ${modelName} ${config.revision}`
          : `Atlas: đã đăng ${modelName} ${config.revision}`,
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const atlasUrl = config.baseUrl.replace(/\/+$/, "");

  if (pane === "app") {
    return (
      <div className="atlas-host">
        <div className="atlas-tabs">
          <button className="active" onClick={() => setPane("app")}>
            Ứng dụng
          </button>
          <button onClick={() => setPane("publish")}>Đẩy model</button>
          <span className="spacer" />
          <span className="module-hint" style={{ margin: 0 }}>
            {atlasUrl || "Chưa cấu hình địa chỉ Atlas"}
          </span>
          {atlasUrl && (
            <a href={atlasUrl} target="_blank" rel="noreferrer">
              Mở tab mới ↗
            </a>
          )}
        </div>
        {atlasUrl ? (
          <iframe className="atlas-frame" title="Atlas AEC" src={atlasUrl} />
        ) : (
          <p className="module-hint">
            Nhập địa chỉ Atlas ở tab <strong>Đẩy model</strong> rồi quay lại.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="module-host">
      <div className="atlas-tabs">
        <button onClick={() => setPane("app")}>Ứng dụng</button>
        <button className="active" onClick={() => setPane("publish")}>
          Đẩy model
        </button>
      </div>
      <p className="module-hint">
        Đẩy model native của WeBIM sang Atlas dưới dạng IFC. File đi thẳng lên kho
        của Atlas; WeBIM chỉ xin quyền và đăng ký bản ghi.
      </p>

      <div className="module-form">
        <input
          value={config.baseUrl}
          placeholder="https://atlas.aecplatform.vn"
          onChange={(event) => update({ baseUrl: event.target.value })}
        />
        <input
          type="password"
          value={config.apiKey}
          placeholder="API key (wbm_…)"
          onChange={(event) => update({ apiKey: event.target.value })}
        />
        <button disabled={busy || !config.baseUrl || !config.apiKey} onClick={() => void connect()}>
          {busy ? "Đang gọi…" : "Kết nối"}
        </button>
      </div>

      {projects !== null && (
        <div className="module-form">
          <select
            value={config.projectId}
            onChange={(event) => {
              const picked = projects.find((project) => project.id === event.target.value);
              update({
                projectId: event.target.value,
                projectLabel: picked ? `${picked.key} — ${picked.name}` : "",
              });
            }}
          >
            {projects.length === 0 && <option value="">Tổ chức chưa có dự án nào</option>}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.key} — {project.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="module-form">
        <input
          value={modelName}
          placeholder="Tên model"
          onChange={(event) => setModelName(event.target.value)}
        />
        <input
          value={config.revision}
          placeholder="Phiên bản"
          onChange={(event) => update({ revision: event.target.value })}
        />
        <select
          value={config.discipline}
          onChange={(event) => update({ discipline: event.target.value as AtlasDiscipline })}
        >
          {ATLAS_DISCIPLINES.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <button disabled={busy || !config.projectId} onClick={() => void publish()}>
          {busy ? "Đang đẩy…" : "Đẩy IFC sang Atlas"}
        </button>
      </div>

      {config.projectLabel && (
        <p className="module-hint">
          Dự án đích: <strong>{config.projectLabel}</strong> · cùng tên + phiên bản sẽ
          ghi đè bản cũ thay vì tạo trùng.
        </p>
      )}

      {log.map((line, index) => (
        <p key={index} className="module-hint">
          {line}
        </p>
      ))}

      {error && <div className="climate-finding warning">⚠ {error}</div>}

      {published && (
        <div className="ai-answer">
          {published.replaced ? "Đã thay thế model" : "Đã tạo model"} ·{" "}
          {(published.sizeBytes / 1024).toFixed(0)} KB
          {"\n"}
          <a href={published.viewerUrl} target="_blank" rel="noreferrer">
            Mở trong Atlas Models →
          </a>
        </div>
      )}
    </div>
  );
}
