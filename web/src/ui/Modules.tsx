// Platform modules beyond modeling: CDE, Plan (tasks), Standards
// (QCVN/TCVN lookup) and Drawings (PDF viewing + notes).
// Metadata lives in the synced project; binaries go to the platform
// server via the store's upload helper.

import { useEffect, useState } from "react";
import {
  searchStandards,
  supersessionChain,
  STANDARDS_CATALOG,
} from "../standards/catalog";
import { climateFindings, facadeByOrientation } from "../application/climate";
import { ganttChart, weekTicks } from "../application/gantt";
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
