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
  VBPL_PROVENANCE,
} from "../standards/catalog";
import { climateFindings, facadeByOrientation } from "../application/climate";
import { ganttChart, weekTicks } from "../application/gantt";
import { Viewer3D } from "../viewport/Viewer3D";
import {
  atlasTargetPath,
  discoverAtlas,
  identifyAtlas,
  isLocalOrigin,
  loadAtlasConfig,
  probeAtlas,
  saveAtlasConfig,
  type AtlasConfig,
  type AtlasTarget,
} from "../sync/atlasBridge";
import type { DocumentDatum, DocumentStatus, TaskStatus } from "../domain/project";
import { PdfMarkupView } from "./PdfMarkup";
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
export function StoredFileFrame({ fileKey, title }: { fileKey: string; title: string }) {
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

/** Loads the stored PDF, then hands its object URL to the markup view. */
function MarkupFrame({
  document: doc,
  fileKey,
}: {
  document: DocumentDatum;
  fileKey: string;
}) {
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
  return <PdfMarkupView document={doc} url={url} />;
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
      {/*
        Every other module says something when it has nothing; this one showed
        a bare header row, which reads as a table that failed to load.
      */}
      {documents.length === 0 && (
        <p className="module-hint">
          Chưa có tài liệu nào. Nhập mã theo ISO 19650 và tiêu đề, rồi bấm{" "}
          <strong>Add document</strong>.
        </p>
      )}
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Title</th>
            <th>Hạng mục</th>
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
                {/* Tài liệu là SẢN PHẨM của một hạng mục — liên kết ở đây là
                    cái nối CDE với tiến độ: hạng mục xong mà chưa có file
                    PUBLISHED là điều bảng tiến độ phải thấy được. */}
                <select
                  value={document.taskId ?? ""}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    store.updateDocument(document.id, {
                      taskId: event.target.value || null,
                    })
                  }
                >
                  <option value="">— chung —</option>
                  {store.project.tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.name}
                    </option>
                  ))}
                </select>
              </td>
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
            <th />
          </tr>
        </thead>
        <tbody>
          {document.revisions.map((revision, index) => (
            <tr key={revision.id}>
              <td>
                {revision.rev}
                {index === document.revisions.length - 1 && (
                  <span className="rev-current" title="Phiên bản hiện hành"> ●</span>
                )}
              </td>
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
              <td>
                {revision.fileKey && index < document.revisions.length - 1 && (
                  <button
                    className="mini"
                    title="Khôi phục: thêm một phiên bản mới trỏ lại file này — lịch sử giữ nguyên"
                    onClick={() => store.restoreDocumentRevision(document.id, revision.id)}
                  >
                    ↩
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="module-hint">
        ● = phiên bản hiện hành. Khôi phục không xoá lịch sử — nó thêm một
        phiên bản mới trỏ lại file cũ, bảng vẫn kể đúng chuyện đã xảy ra.
      </p>
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
      {chart.reversed.length > 0 && (
        <p className="module-hint climate-finding warning">
          {chart.reversed.length} hạng mục có ngày kết thúc <strong>trước</strong>{" "}
          ngày bắt đầu ({chart.reversed.map((task) => task.name).join(", ")}) — không
          vẽ được thanh, và đã bị loại khỏi khoảng thời gian của biểu đồ để những
          hạng mục còn lại vẫn hiện đúng. Sửa ngày ở chế độ <strong>Bảng</strong>.
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
            <th>Hồ sơ</th>
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
                <TaskDocuments taskId={task.id} status={task.status} />
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

/**
 * Hồ sơ của một hạng mục, nhìn từ phía Tiến độ — file là SẢN PHẨM của hạng
 * mục, nên bảng tiến độ phải thấy được sản phẩm đã nộp chưa. Một hạng mục
 * ĐÃ XONG mà chưa có tài liệu PUBLISHED là lỗ hổng bàn giao; nói ra tại
 * chỗ, không bắt ai mở CDE dò từng dòng.
 */
function TaskDocuments({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const documents = store.project.documents.filter(
    (document) => document.taskId === taskId,
  );
  const published = documents.some((document) => document.status === "PUBLISHED");
  return (
    <div className="task-docs">
      {documents.map((document) => {
        const latest = document.revisions[document.revisions.length - 1];
        return (
          <button
            key={document.id}
            className="task-doc-chip"
            title={`${document.title} · ${document.status}${latest ? ` · ${latest.rev}` : " · chưa có phiên bản"} — mở trong CDE`}
            onClick={() => {
              store.select({ kind: "document", id: document.id });
              store.setPane("CDE");
            }}
          >
            {document.code}
            <span className={`task-doc-status s-${document.status}`}>
              {document.status}
              {latest ? ` ${latest.rev}` : ""}
            </span>
          </button>
        );
      })}
      {documents.length === 0 && <span className="task-doc-none">—</span>}
      {status === "DONE" && !published && (
        <span className="task-doc-warn" title="Hạng mục đã xong nhưng chưa có tài liệu nào ở trạng thái PUBLISHED — hồ sơ bàn giao đang thiếu">
          ⚠ chưa có file PUBLISHED
        </span>
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
      <p className="module-hint">
        Tình trạng hiệu lực đối chiếu với <strong>vbpl.vn</strong> (CSDL quốc
        gia về pháp luật, Bộ Tư pháp) ngày {VBPL_PROVENANCE.fetchedAt} —{" "}
        {STANDARDS_CATALOG.filter((entry) => entry.vbpl?.length).length} văn bản
        khớp, kèm link toàn văn chính thức. TCVN không phải văn bản QPPL nên
        không nằm trong CSDL đó; hai nguồn lệch nhau sẽ được ghi rõ thay vì
        chọn im lặng một nguồn.
      </p>
      <div className="module-form">
        <input
          placeholder="Tìm theo mã, tên, tag… (vd: chay, tai trong, chung cu)"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ minWidth: 320 }}
        />
      </div>
      {/*
        Không có dòng nào khớp thì bảng chỉ còn hàng tiêu đề trần, đọc như
        một bảng nạp hỏng chứ không như "không tìm thấy".
      */}
      {query.trim() && results.length === 0 && (
        <p className="module-hint">
          Không có văn bản nào khớp “{query.trim()}”. Corpus đang có{" "}
          {STANDARDS_CATALOG.length} văn bản — thử mã hiệu (QCVN 06), một từ
          khoá ngắn hơn, hoặc bỏ dấu.
        </p>
      )}
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
              <td>
                {entry.status === "HIEN_HANH" ? "Hiện hành" : "Hết hiệu lực"}
                {entry.vbpl && entry.vbpl.length > 0 && (
                  <div className="vbpl-refs">
                    {entry.vbpl.map((ref) => (
                      <a
                        key={ref.url}
                        href={ref.url}
                        target="_blank"
                        rel="noreferrer"
                        title={`${ref.title} — ${ref.statusName}`}
                      >
                        {ref.amending ? "SĐ " : ""}
                        {ref.docNum} ↗
                      </a>
                    ))}
                  </div>
                )}
                {entry.vbplMismatch && (
                  <div className="vbpl-mismatch">⚠ {entry.vbplMismatch}</div>
                )}
              </td>
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

/**
 * Điều kiện dùng AI, tính một chỗ cho cả hai màn hình gọi nó. Biết trước khi
 * bấm — nút bấm được thì người ta bấm, rồi nhận lỗi ở cuối một việc chậm.
 */
export function aiBlockedReason(): string | null {
  if (store.standalone) return "Chế độ độc lập — chức năng AI cần máy chủ nền tảng.";
  if (store.authRequired && !store.auth) {
    return "Cần đăng nhập để dùng AI — bấm Đăng nhập ở góc trên bên phải.";
  }
  if (store.auth?.role === "viewer") {
    return "Tài khoản này là viewer, chỉ xem được. AI cần quyền editor trở lên.";
  }
  return null;
}

function AiAskBox({ fileKey }: { fileKey: string | null }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const blocked = aiBlockedReason();
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
      {blocked && <p className="module-hint">⚠ {blocked}</p>}
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
        <button disabled={!fileKey || busy || blocked !== null} onClick={() => void ask()}>
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
      <h2>Bản vẽ — đọc, ghi chú &amp; đánh dấu</h2>
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
          {latestPdf?.fileKey && selected && (
            <MarkupFrame document={selected} fileKey={latestPdf.fileKey} />
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
 * The tab is the application and nothing else: uploading a model is something
 * Atlas already does, so a second way to do it here was one panel too many.
 * The publish bridge itself is still in `sync/atlasBridge` and still wired on
 * the Atlas side — it just has no button of its own.
 *
 * Atlas must permit the embed: it sends X-Frame-Options SAMEORIGIN unless
 * FRAME_ANCESTORS names this origin (see atlas/apps/web/next.config.mjs).
 * The browser cannot report a refused frame to us cross-origin, so the header
 * always offers "mở tab mới" instead of leaving a blank rectangle.
 */
export function AtlasModule({ target = "root" }: { target?: AtlasTarget } = {}) {
  useStoreVersion();
  const [config, setConfig] = useState<AtlasConfig>(() => loadAtlasConfig());
  const [reach, setReach] = useState<"checking" | "up" | "down">("checking");
  const [identified, setIdentified] = useState(true);
  const [probeAt, setProbeAt] = useState(0);

  const update = (patch: Partial<AtlasConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveAtlasConfig(next);
  };

  const atlasUrl = config.baseUrl.replace(/\/+$/, "");
  const manualUrl = config.baseUrlSource === "manual";

  // Probe before framing: a dead host would otherwise render the browser's
  // own error page inside the app, with nothing to act on. When the
  // configured address is dead, go looking rather than making the user type
  // one — an Atlas running on this machine is the common case.
  useEffect(() => {
    let cancelled = false;
    setReach("checking");
    void (async () => {
      const real = await identifyAtlas(atlasUrl);
      if (cancelled) return;

      // A typed address is framed on reachability alone — the user has said
      // what it is, and an older Atlas, or one whose allowlist omits us,
      // should still display. It only gets a warning when it cannot prove
      // itself.
      if (manualUrl) {
        setIdentified(real);
        setReach((await probeAtlas(atlasUrl)) ? "up" : "down");
        return;
      }

      // An address the tab picked must keep proving itself, or a discovery
      // that was wrong once shows the wrong app forever.
      if (real) {
        setIdentified(true);
        setReach("up");
        return;
      }
      const found = await discoverAtlas();
      if (cancelled) return;
      if (found && found !== atlasUrl) {
        // Set through the updater rather than `update`, which is rebuilt every
        // render — depending on it here would re-run the probe in a loop.
        setConfig((previous) => {
          const next: AtlasConfig = { ...previous, baseUrl: found, baseUrlSource: "auto" };
          saveAtlasConfig(next);
          return next;
        });
        return; // the config change re-runs this effect
      }
      setIdentified(false);
      setReach("down");
    })();
    return () => {
      cancelled = true;
    };
  }, [atlasUrl, manualUrl, probeAt]);

  return (
    <div className="atlas-host">
      {/*
        Khi Atlas đã tìm thấy và trả lời được — trường hợp thường — thanh địa
        chỉ biến mất. Bày một ô "nhập địa chỉ Atlas" lên đầu một tab nằm sẵn
        trong app khiến Atlas trông như một dịch vụ bên ngoài phải tự đi nối,
        trong khi nó là nửa còn lại của chính nền tảng này. Ai tự host ở nơi
        khác vẫn đổi được, chỉ là nó không còn là thứ đầu tiên đập vào mắt.
      */}
      {reach === "up" ? (
        <div className="atlas-tabs atlas-tabs-slim">
          <details className="atlas-address">
            <summary>Địa chỉ Atlas</summary>
            <div className="atlas-address-panel">
              <input
                value={config.baseUrl}
                placeholder="https://atlas.webim.vn — bỏ trống để tự dò"
                onChange={(event) =>
                  update({
                    baseUrl: event.target.value,
                    baseUrlSource: event.target.value.trim() ? "manual" : "auto",
                  })
                }
              />
              <button onClick={() => setProbeAt((n) => n + 1)}>Kiểm tra lại</button>
              <p className="module-hint" style={{ margin: 0 }}>
                Để trống thì tab tự dò — mặc định là Atlas nằm cạnh app này.
              </p>
            </div>
          </details>
          <span className="spacer" />
          <a
            href={atlasUrl + atlasTargetPath(target, config.projectId)}
            target="_blank"
            rel="noreferrer"
          >
            Mở tab mới ↗
          </a>
        </div>
      ) : (
        <div className="atlas-tabs">
          <input
            value={config.baseUrl}
            placeholder="https://atlas.webim.vn — bỏ trống để tự dò"
            style={{ minWidth: 260 }}
            onChange={(event) =>
              update({
                baseUrl: event.target.value,
                // Typed, therefore deliberate: stop second-guessing it.
                baseUrlSource: event.target.value.trim() ? "manual" : "auto",
              })
            }
          />
          <button onClick={() => setProbeAt((n) => n + 1)}>Kiểm tra lại</button>
          <span className="spacer" />
          {atlasUrl && (
            <a href={atlasUrl} target="_blank" rel="noreferrer">
              Mở tab mới ↗
            </a>
          )}
        </div>
      )}

      {!atlasUrl && (
        <p className="module-hint">Nhập địa chỉ Atlas ở ô trên rồi bấm Kiểm tra lại.</p>
      )}

      {atlasUrl && reach === "checking" && (
        <p className="module-hint">Đang kiểm tra {atlasUrl}…</p>
      )}

      {/*
        Two different readers land here. On localhost it is whoever cloned the
        repo, and the recipe below is exactly what they need. On a deployed
        site it is a visitor with no repo, no docker and no shell — telling
        them to run pnpm is noise, and the localhost addresses we used to name
        are *their* machine, not ours.
      */}
      {atlasUrl && reach === "down" && !isLocalOrigin(window.location.origin) && (
        <div className="climate-finding warning">
          <p>
            ⚠ Không có Atlas nào trả lời ở <code>{atlasUrl}</code>.
          </p>
          <p>
            Atlas là ứng dụng máy chủ riêng (Next.js + Postgres + MinIO), không
            chạy được trong bản demo tĩnh này — bản demo không có máy chủ nào cả
            (xem dòng trạng thái cuối trang). Phần WeBIM tự dựng mô hình,
            Standards, QTO, Clash, 4D và PCCC vẫn chạy đầy đủ.
          </p>
          <p>
            Nếu bạn đã có Atlas của mình thì nhập địa chỉ của nó vào ô trên —
            Atlas cần khai <code>FRAME_ANCESTORS</code> và{" "}
            <code>WEBIM_ALLOWED_ORIGINS</code> bằng{" "}
            <code>{window.location.origin}</code> thì tab này mới nhúng và gọi
            API được.
          </p>
        </div>
      )}

      {atlasUrl && reach === "down" && isLocalOrigin(window.location.origin) && (
        <div className="climate-finding warning">
          <p>
            ⚠ Không tìm thấy Atlas nào đang chạy — đã thử <code>/atlas</code>,{" "}
            <code>localhost:3170</code> và <code>localhost:3000</code>.
          </p>
          <p>
            Atlas nằm ngay trong repo này. Khởi động rồi bấm{" "}
            <strong>Kiểm tra lại</strong> — tab sẽ tự nhận ra, không cần nhập
            địa chỉ:
          </p>
          <pre className="atlas-commands">
            cd atlas{"\n"}
            docker compose up -d postgres redis minio{"\n"}
            FRAME_ANCESTORS={window.location.origin}{" "}
            WEBIM_ALLOWED_ORIGINS={window.location.origin}{" \\"}
            {"\n"}
            {"  "}pnpm --filter @atlas/web dev
          </pre>
          <p>
            Hai biến đó là thứ cho phép nhúng và gọi API từ origin này —
            thiếu chúng thì Atlas chạy nhưng tab vẫn trống. Lần đầu còn cần{" "}
            <code>pnpm install</code> và một <code>.env</code>; xem{" "}
            <strong>Quick start</strong> trong <code>atlas/README.md</code>.
          </p>
          <p>Nếu Atlas chạy ở nơi khác thì nhập địa chỉ vào ô trên.</p>
        </div>
      )}

      {atlasUrl && reach === "up" && !identified && manualUrl && (
        <div className="climate-finding warning">
          ⚠ <strong>{atlasUrl}</strong> có trả lời, nhưng không tự nhận là
          Atlas — nhiều khả năng đây là ứng dụng khác đang giữ cổng đó (cổng
          3000 hay bị Dagster/Grafana chiếm). Sửa địa chỉ ở ô trên, hoặc bỏ
          trống rồi bấm <strong>Kiểm tra lại</strong> để dò lại từ đầu.
        </div>
      )}

      {atlasUrl && reach === "up" && (
        <iframe
          className="atlas-frame"
          title="Atlas AEC"
          src={atlasUrl + atlasTargetPath(target, config.projectId)}
        />
      )}
    </div>
  );
}
