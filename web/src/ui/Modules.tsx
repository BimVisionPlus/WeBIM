// Platform modules beyond modeling: CDE, Plan (tasks), Standards
// (QCVN/TCVN lookup) and Drawings (PDF viewing + notes).
// Metadata lives in the synced project; binaries go to the platform
// server via the store's upload helper.

import { useState } from "react";
import {
  searchStandards,
  supersessionChain,
  STANDARDS_CATALOG,
} from "../standards/catalog";
import type { DocumentDatum, DocumentStatus, TaskStatus } from "../domain/project";
import { fileServerBase, store, useStoreVersion } from "../state/store";

const DOCUMENT_STATUSES: DocumentStatus[] = ["WIP", "SHARED", "PUBLISHED", "ARCHIVED"];
const TASK_STATUSES: TaskStatus[] = ["NOT_STARTED", "IN_PROGRESS", "DONE", "BLOCKED"];

function fileUrl(key: string): string {
  return `${fileServerBase()}/files/${encodeURIComponent(key)}`;
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
                  <a href={fileUrl(revision.fileKey)} target="_blank" rel="noreferrer">
                    {revision.fileName}
                  </a>
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

export function PlanModule() {
  useStoreVersion();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
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
      </div>
      <table>
        <thead>
          <tr>
            <th>Hạng mục</th>
            <th>Nhóm</th>
            <th>Bắt đầu</th>
            <th>Kết thúc</th>
            <th>Trạng thái</th>
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
        Danh mục khởi tạo ({STANDARDS_CATALOG.length} văn bản) — đối chiếu văn bản gốc
        trước khi áp dụng. Nguồn dài hạn: corpus machine-checkable
        (qcvn-conflict-map / plancheck).
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
            <th>Tags</th>
          </tr>
        </thead>
        <tbody>
          {results.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.code}</td>
              <td>{entry.title}</td>
              <td>{entry.status === "HIEN_HANH" ? "Hiện hành" : "Hết hiệu lực"}</td>
              <td>{supersessionChain(entry).join(" → ") || "—"}</td>
              <td>{entry.tags.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
                <p className="module-hint">
                  AI đọc bản vẽ: nối qua endpoint server (chưa cấu hình khoá — stub).
                </p>
              </>
            )}
          </div>
          {latestPdf?.fileKey && (
            <iframe
              className="drawing-frame"
              title={latestPdf.fileName ?? "drawing"}
              src={fileUrl(latestPdf.fileKey)}
            />
          )}
        </div>
      )}
    </div>
  );
}
