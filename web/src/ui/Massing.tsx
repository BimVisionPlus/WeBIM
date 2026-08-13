// DỰNG BOX KHỐI — bước nghiên cứu phương án của nhánh BIM.
//
// Cùng viewport với mặt bằng: khối được vẽ trên chính mặt bằng đó, nên tách ra
// một khung vẽ riêng chỉ tổ làm người ta mất chỗ đứng. Cái tab này thêm vào là
// bảng số của khối và hai chỉ tiêu quy hoạch mà bước phương án luôn phải trả
// lời — mật độ xây dựng và hệ số sử dụng đất.

import { useState } from "react";
import { floorAreaRatio, massRows, massSummary, siteCoverage } from "../application/massing";
import { DrawingTools } from "./DrawingTools";
import { Viewport } from "./Viewport";
import { store, useStoreVersion } from "../state/store";

export function MassingModule() {
  useStoreVersion();
  const [siteArea, setSiteArea] = useState("");
  const rows = massRows(store.project);
  const total = massSummary(store.project);
  const area = Number(siteArea);
  const coverage = siteCoverage(store.project, area);
  const far = floorAreaRatio(store.project, area);

  return (
    <div className="massing-host">
      {/* Cùng khung vẽ với mặt bằng — khối được vẽ trên chính mặt bằng đó. */}
      <DrawingTools />
      <div className="massing-viewport">
        <Viewport />
      </div>
      <div className="module-host">
      <h2>Box khối — nghiên cứu phương án</h2>
      <p className="module-hint">
        Chọn công cụ <strong>Mass</strong> trên thanh trên rồi click hai góc đối
        diện. Khối là hình để nghiên cứu, <strong>không phải cấu kiện</strong>:
        nó không sinh tường, không vào bảng khối lượng thi công và không tham
        gia dò va chạm.
      </p>

      <div className="module-form">
        <label>
          Diện tích lô đất{" "}
          <input
            type="number"
            min={0}
            step={10}
            value={siteArea}
            placeholder="m²"
            style={{ width: 100 }}
            onChange={(event) => setSiteArea(event.target.value)}
          />{" "}
          m²
        </label>
      </div>

      <div className="stat-row">
        <div className="stat-tile">
          <span className="stat-value">{total.count}</span>
          <span className="stat-label">Khối</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{total.footprintM2.toFixed(0)}</span>
          <span className="stat-label">Diện tích chân (m²)</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{total.floorAreaM2.toFixed(0)}</span>
          <span className="stat-label">Sàn quy đổi (m²)</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">
            {coverage === null ? "—" : `${coverage.toFixed(1)}%`}
          </span>
          <span className="stat-label">Mật độ xây dựng</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{far === null ? "—" : far.toFixed(2)}</span>
          <span className="stat-label">Hệ số sử dụng đất</span>
        </div>
      </div>

      {coverage === null && (
        <p className="module-hint">
          Nhập diện tích lô để tính mật độ và hệ số sử dụng đất — chưa có lô thì
          hai ô đó là <strong>không tính được</strong>, không phải 0. Ngưỡng cho
          phép tra ở <strong>Tiêu chuẩn</strong> (QCVN 01:2021/BXD).
        </p>
      )}

      {rows.length === 0 ? (
        <p className="module-hint">Chưa có khối nào.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Khối</th>
              <th>Chân (m²)</th>
              <th>Cao (m)</th>
              <th>Số tầng</th>
              <th>Cao mỗi tầng (m)</th>
              <th>Sàn quy đổi (m²)</th>
              <th>Thể tích (m³)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.mass.id}
                className={store.selection?.id === row.mass.id ? "row-selected" : ""}
                onClick={() => store.select({ kind: "mass", id: row.mass.id })}
              >
                <td>{row.mass.name}</td>
                <td>{row.footprintM2.toFixed(1)}</td>
                <td>
                  <input
                    type="number"
                    step={0.3}
                    min={0.1}
                    value={row.mass.height}
                    style={{ width: 70 }}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      store.updateMass(row.mass.id, { height: Number(event.target.value) })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step={1}
                    min={1}
                    value={row.mass.storeys}
                    style={{ width: 60 }}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      store.updateMass(row.mass.id, { storeys: Number(event.target.value) })
                    }
                  />
                </td>
                <td>{row.storeyHeightM.toFixed(2)}</td>
                <td>{row.floorAreaM2.toFixed(1)}</td>
                <td>{row.volumeM3.toFixed(1)}</td>
                <td>
                  <button
                    className="mini"
                    onClick={(event) => {
                      event.stopPropagation();
                      store.removeMass(row.mass.id);
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
    </div>
  );
}
