// Pane "Đặt tên ISO" — quy ước đặt tên tài liệu của công ty, và bảng kiểm.
//
// Hai nửa cùng một màn hình có chủ đích: sửa quy ước phải THẤY NGAY hồ sơ
// nào bắt đầu sai — quy ước đặt trong một trang cài đặt riêng là quy ước
// không ai chạy lại sau khi sửa.

import { useState } from "react";
import {
  auditCodes,
  DEFAULT_CONVENTION,
  type NamingConvention,
  type NamingSegment,
} from "../application/naming";
import { store, useStoreVersion } from "../state/store";

function SegmentEditor({
  segment,
  index,
  onChange,
  onRemove,
}: {
  segment: NamingSegment;
  index: number;
  onChange: (next: NamingSegment) => void;
  onRemove: () => void;
}) {
  return (
    <tr>
      <td className="naming-seq">{index + 1}</td>
      <td>
        <input
          value={segment.name}
          onChange={(event) => onChange({ ...segment, name: event.target.value })}
        />
      </td>
      <td>
        <select
          value={segment.kind}
          onChange={(event) =>
            onChange({ ...segment, kind: event.target.value as NamingSegment["kind"] })
          }
        >
          <option value="LIST">Danh sách mã</option>
          <option value="PATTERN">Mẫu (regex)</option>
        </select>
      </td>
      <td>
        {segment.kind === "LIST" ? (
          <input
            value={(segment.values ?? []).join(", ")}
            placeholder="DR, SP, BQ…"
            onChange={(event) =>
              onChange({
                ...segment,
                values: event.target.value
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
              })
            }
          />
        ) : (
          <input
            value={segment.pattern ?? ""}
            placeholder="[0-9]{3,4}"
            onChange={(event) => onChange({ ...segment, pattern: event.target.value })}
          />
        )}
      </td>
      <td>
        <input
          value={segment.hint ?? ""}
          placeholder="Ghi chú / ví dụ"
          onChange={(event) => onChange({ ...segment, hint: event.target.value })}
        />
      </td>
      <td>
        <button className="mini" onClick={onRemove} title="Bỏ trường này">
          ×
        </button>
      </td>
    </tr>
  );
}

export function NamingModule() {
  useStoreVersion();
  const saved = store.project.namingConvention;
  const effective = saved ?? DEFAULT_CONVENTION;
  // Bản nháp sửa tại chỗ; chỉ ghi vào dự án (và đồng bộ) khi bấm Lưu.
  const [draft, setDraft] = useState<NamingConvention | null>(null);
  const editing = draft ?? effective;

  const rows = [
    ...store.project.documents.map((document) => ({
      id: document.id,
      kind: "Tài liệu CDE",
      code: document.code,
      title: document.title,
    })),
    ...store.project.sheets.map((sheet) => ({
      id: sheet.id,
      kind: "Sheet",
      code: sheet.name,
      title: sheet.title,
    })),
  ];
  const audit = auditCodes(rows, effective);
  const bad = audit.filter((row) => !row.check.ok);

  const updateSegment = (index: number, next: NamingSegment) => {
    const segments = editing.segments.map((segment, i) => (i === index ? next : segment));
    setDraft({ ...editing, segments });
  };

  return (
    <div className="module-host">
      <h2>Quy tắc đặt tên theo ISO công ty</h2>
      <p className="module-hint">
        Mã hồ sơ gồm {effective.segments.length} trường nối bằng «{effective.separator}» —{" "}
        {effective.segments.map((segment) => segment.name).join(" – ")}. Quy ước là dữ
        liệu của dự án và đồng bộ cho cả nhóm; bảng kiểm bên dưới chạy lại ngay khi quy
        ước đổi. {saved ? "Đang dùng quy ước riêng của công ty." : "Đang dùng mặc định ISO 19650-2."}
      </p>

      <div className="module-form">
        <span className={bad.length > 0 ? "naming-bad" : "naming-ok"}>
          {rows.length === 0
            ? "Chưa có tài liệu hay sheet nào để kiểm."
            : bad.length === 0
              ? `✓ Cả ${rows.length} mã đều đúng quy ước.`
              : `✗ ${bad.length}/${rows.length} mã sai quy ước.`}
        </span>
      </div>

      {bad.length > 0 && (
        <table className="data-table naming-audit">
          <thead>
            <tr>
              <th>Loại</th>
              <th>Mã</th>
              <th>Tên</th>
              <th>Vấn đề</th>
            </tr>
          </thead>
          <tbody>
            {bad.map((row) => (
              <tr key={`${row.kind}-${row.id}`}>
                <td>{row.kind}</td>
                <td className="naming-code">{row.code}</td>
                <td>{row.title}</td>
                <td>
                  <ul className="naming-problems">
                    {row.check.problems.map((problem, index) => (
                      <li key={index}>{problem}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Quy ước ({editing.segments.length} trường)</h3>
      <table className="data-table naming-editor">
        <thead>
          <tr>
            <th>#</th>
            <th>Trường</th>
            <th>Kiểu</th>
            <th>Giá trị / mẫu</th>
            <th>Ghi chú</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {editing.segments.map((segment, index) => (
            <SegmentEditor
              key={index}
              segment={segment}
              index={index}
              onChange={(next) => updateSegment(index, next)}
              onRemove={() =>
                setDraft({
                  ...editing,
                  segments: editing.segments.filter((_, i) => i !== index),
                })
              }
            />
          ))}
        </tbody>
      </table>
      <div className="module-form">
        <label>
          Dấu nối{" "}
          <input
            className="naming-separator"
            value={editing.separator}
            maxLength={1}
            onChange={(event) =>
              setDraft({ ...editing, separator: event.target.value || "-" })
            }
          />
        </label>
        <button
          onClick={() =>
            setDraft({
              ...editing,
              segments: [
                ...editing.segments,
                { name: `Trường ${editing.segments.length + 1}`, kind: "PATTERN", pattern: "[A-Z0-9]+" },
              ],
            })
          }
        >
          + Thêm trường
        </button>
        <button
          disabled={draft === null || editing.segments.length === 0}
          onClick={() => {
            if (draft) store.setNamingConvention(draft);
            setDraft(null);
          }}
        >
          Lưu quy ước cho dự án
        </button>
        <button
          disabled={saved === null && draft === null}
          onClick={() => {
            store.setNamingConvention(null);
            setDraft(null);
          }}
        >
          Về mặc định ISO 19650
        </button>
      </div>
      <p className="module-hint">
        Gợi ý từng trường: {effective.segments
          .filter((segment) => segment.hint)
          .map((segment) => `${segment.name}: ${segment.hint}`)
          .join(" · ")}
      </p>
    </div>
  );
}
