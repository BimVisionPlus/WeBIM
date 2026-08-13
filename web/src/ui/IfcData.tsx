// IFC Data — trích xuất và tổ hợp thông tin từ nhiều file IFC.
//
// The 3D viewer and the clash pass read IFC for geometry. This reads it for
// what the geometry is annotated with: property sets and element quantities,
// unioned across every linked model, filterable, and exportable as CSV — the
// step people otherwise do by opening each file in a viewer and retyping.

import { useMemo, useState } from "react";
import {
  BASE_COLUMNS,
  buildRows,
  columnCoverage,
  filterRows,
  propertyColumns,
  toCsv,
} from "../application/ifcTable";
import { store, useStoreVersion } from "../state/store";

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function IfcDataModule() {
  useStoreVersion();
  const sources = store.linkedModels;
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const rows = useMemo(() => buildRows(sources), [sources]);
  const properties = useMemo(() => propertyColumns(sources), [sources]);
  const coverage = useMemo(() => columnCoverage(rows, properties), [rows, properties]);

  const columns = [...BASE_COLUMNS, ...properties.filter((column) => !hidden.has(column))];
  const visible = filterRows(rows, columns, query);

  const onPickIfc = async (file: File | undefined) => {
    if (!file) return;
    store.linkIfcModel(file.name, await file.text());
  };

  return (
    <div className="module-host">
      <h2>IFC Data — trích xuất &amp; tổ hợp</h2>
      <p className="module-hint">
        Gộp property set và quantity của mọi file IFC đã link thành một bảng. Cột
        là hợp của các file; ô trống nghĩa là file đó không mang thuộc tính ấy —
        không phải bằng 0.
      </p>

      <div className="module-form">
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
        {sources.map((model) => (
          <span key={model.name} className="peer-chip">
            {model.name} · {model.elements.length} phần tử
            <button className="mini" onClick={() => store.unlinkIfcModel(model.name)}>
              ×
            </button>
          </span>
        ))}
      </div>

      {sources.length === 0 ? (
        <p className="module-hint">
          Chưa link file IFC nào. Bấm <strong>Link IFC…</strong> — có thể link
          nhiều file, mỗi bộ môn một file.
        </p>
      ) : (
        <>
          <div className="module-form">
            <input
              placeholder="Lọc theo bất kỳ ô nào hiển thị…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ minWidth: 260 }}
            />
            <button
              disabled={visible.length === 0}
              onClick={() =>
                download(
                  `ifc-data-${new Date().toISOString().slice(0, 10)}.csv`,
                  toCsv(visible, columns),
                )
              }
            >
              Xuất CSV ({visible.length} dòng)
            </button>
          </div>

          {properties.length === 0 ? (
            <p className="module-hint">
              Các file đã link không mang property set nào đọc được — nhiều file
              chỉ xuất hình học. Bảng dưới chỉ có thuộc tính cơ bản.
            </p>
          ) : (
            <details className="clash-matrix">
              <summary>
                Cột thuộc tính — {properties.length - hidden.size}/{properties.length} đang hiện
              </summary>
              <div className="column-picker">
                {coverage.map(({ column, filled, total }) => (
                  <label key={column} className="clash-cell">
                    <input
                      type="checkbox"
                      checked={!hidden.has(column)}
                      onChange={(event) =>
                        setHidden((previous) => {
                          const next = new Set(previous);
                          if (event.target.checked) next.delete(column);
                          else next.add(column);
                          return next;
                        })
                      }
                    />
                    <span>{column}</span>
                    <span className="module-hint" style={{ margin: 0 }}>
                      {filled}/{total}
                    </span>
                  </label>
                ))}
              </div>
            </details>
          )}

          <div className="ifc-table-scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, 500).map((row, index) => (
                  <tr key={index}>
                    {columns.map((column) => (
                      <td key={column}>
                        {row[column] === undefined
                          ? ""
                          : typeof row[column] === "boolean"
                            ? row[column]
                              ? "✓"
                              : "—"
                            : String(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible.length > 500 && (
            <p className="module-hint">
              Hiển thị 500/{visible.length} dòng đầu — bản CSV xuất đủ tất cả.
            </p>
          )}
        </>
      )}
    </div>
  );
}
