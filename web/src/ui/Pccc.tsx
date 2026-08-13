// PCCC — sàng lọc thoát nạn theo QCVN 06:2022/BXD (Sửa đổi 1:2023).
//
// Ngưỡng giờ đã đối chiếu công báo, nên caveat trên màn hình đổi nội dung:
// không còn là "số mặc định chưa kiểm chứng" mà là *phạm vi* — cái quy chuẩn
// nói mà mô hình chưa đủ dữ liệu để kiểm. Mỗi phát hiện kèm điều/bảng để
// người đọc tra ngược thay vì phải tin.

import {
  analyseProject,
  isUsableFlowDensity,
  PEOPLE_PER_METRE,
  USAGE_RULES,
} from "../application/pccc";
import type { BuildingGroup, FireGrade, StructureClass } from "../domain/project";
import { store, useStoreVersion } from "../state/store";

const GRADES: FireGrade[] = ["I", "II", "III", "IV", "V"];
const CLASSES: StructureClass[] = ["S0", "S1", "S2", "S3"];
const GROUPS: { value: BuildingGroup; label: string }[] = [
  { value: "CONG_CONG", label: "Công cộng (Bảng G.2a)" },
  { value: "F1.2", label: "F1.2 — khách sạn, ký túc xá (Bảng G.1)" },
  { value: "F1.3", label: "F1.3 — chung cư (Bảng G.1)" },
];

export function PcccModule() {
  useStoreVersion();
  const fire = store.project.fireSettings;
  const results = analyseProject(store.project, fire);
  const serious = results.flatMap((row) => row.findings.filter((f) => f.level === "serious"));
  const people = results.reduce((sum, row) => sum + row.occupancy.people, 0);
  const unknown = results.filter((row) => row.occupancy.from === "không xác định").length;

  return (
    <div className="module-host">
      <h2>PCCC — sàng lọc thoát nạn</h2>

      <div className="climate-finding warning">
        <p>
          ⚠ <strong>Sàng lọc sơ bộ, không thay thế hồ sơ thẩm duyệt PCCC.</strong>
        </p>
        <p>
          Ngưỡng lấy từ <strong>QCVN 06:2022/BXD</strong> hợp nhất với{" "}
          <strong>Sửa đổi 1:2023</strong> (Thông tư 09/2023/TT-BXD, hiệu lực
          01/12/2023): hệ số không gian sàn theo <strong>Bảng G.9</strong>, định
          mức người trên mét theo <strong>G.2.1.1</strong>, bề rộng tối thiểu
          theo <strong>3.2.9</strong>, cự ly theo <strong>Bảng G.1 / G.2a</strong>,
          khoảng cách hai lối ra theo <strong>3.2.8</strong>. Mỗi phát hiện ghi
          kèm điều/bảng đã dùng.
        </p>
        <p>
          <strong>Cái quy chuẩn yêu cầu mà mô hình chưa kiểm được:</strong> cự ly
          ở đây là <em>đường thẳng</em> từ góc phòng xa nhất tới cửa gần nhất,
          không phải quãng đi vòng qua vách và đồ đạc — phòng{" "}
          <em>không đạt</em> ở đây thì chắc chắn không đạt, phòng <em>đạt</em>{" "}
          vẫn có thể trượt khi vẽ đường thoát thật. Buồng thang bộ, hành lang
          chung và giới hạn chịu lửa của từng cấu kiện chưa được mô hình hoá,
          nên cự ly qua hành lang tới buồng thang chưa được cộng vào.
        </p>
      </div>

      <div className="atlas-tabs">
        <label>
          Bậc chịu lửa{" "}
          <select
            value={fire.grade}
            onChange={(event) => store.setFireSettings({ grade: event.target.value as FireGrade })}
          >
            {GRADES.map((grade) => (
              <option key={grade} value={grade}>
                {grade} — {PEOPLE_PER_METRE[grade]} người/m
              </option>
            ))}
          </select>
        </label>
        <label>
          Nguy hiểm cháy kết cấu{" "}
          <select
            value={fire.structureClass}
            onChange={(event) =>
              store.setFireSettings({ structureClass: event.target.value as StructureClass })
            }
          >
            {CLASSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nhóm nhà{" "}
          <select
            value={fire.group}
            onChange={(event) =>
              store.setFireSettings({ group: event.target.value as BuildingGroup })
            }
          >
            {GROUPS.map((group) => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
        {fire.group === "CONG_CONG" && (
          <label title="CHÚ THÍCH 2, Bảng G.2a: với nhà công cộng khác, mật độ dòng người được lấy cụ thể cho từng dự án.">
            Mật độ dòng người{" "}
            <input
              type="number"
              min={0}
              step={0.5}
              value={fire.flowDensity}
              style={{ width: 70 }}
              onChange={(event) =>
                store.setFireSettings({ flowDensity: Number(event.target.value) })
              }
            />{" "}
            người/m²
          </label>
        )}
        <label>
          <input
            type="checkbox"
            checked={fire.sprinklered}
            onChange={(event) => store.setFireSettings({ sprinklered: event.target.checked })}
          />{" "}
          Có Sprinkler toàn nhà
        </label>
      </div>

      <div className="stat-row">
        <div className="stat-tile">
          <span className="stat-value">{results.length}</span>
          <span className="stat-label">Phòng</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{people}</span>
          <span className="stat-label">Người</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{serious.length}</span>
          <span className="stat-label">Không đạt</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{unknown}</span>
          <span className="stat-label">Chưa xác định được số người</span>
        </div>
      </div>

      {fire.group === "CONG_CONG" && !isUsableFlowDensity(fire.flowDensity) && (
        <p className="module-hint">
          ⚠ Mật độ dòng người chưa phải số dương nên Bảng G.2a không tra được —
          đang lấy <strong>cột ngặt nhất</strong> của bảng. Nhập giá trị của dự
          án để có ngưỡng đúng.
        </p>
      )}

      {unknown > 0 && (
        <p className="module-hint">
          {unknown} phòng có công năng mà Bảng G.9 không có hệ số tương ứng —
          số người của chúng đang tính là 0 và <strong>không</strong> được cộng
          vào ô “Người” ở trên. Nhập số người theo thiết kế duyệt ở{" "}
          <strong>Properties</strong> để chúng được kiểm.
        </p>
      )}

      {results.length === 0 ? (
        <p className="module-hint">
          Chưa có phòng nào. Chọn công cụ <strong>Room</strong> rồi click hai góc
          đối diện để khoanh phòng.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên</th>
              <th>Công năng</th>
              <th>Diện tích</th>
              <th>Người</th>
              <th>Lối ra</th>
              <th>Cự ly / cho phép</th>
              <th>Bề rộng có / cần</th>
              <th>Cách nhau / cần</th>
              <th>Phát hiện</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row) => (
              <tr
                key={row.room.id}
                className={store.selection?.id === row.room.id ? "row-selected" : ""}
                onClick={() => store.select({ kind: "room", id: row.room.id })}
              >
                <td>{row.room.code}</td>
                <td>{row.room.name}</td>
                <td title={USAGE_RULES[row.room.usage]?.source}>
                  {USAGE_RULES[row.room.usage]?.label ?? row.room.usage}
                </td>
                <td>{row.areaM2.toFixed(1)} m²</td>
                <td>
                  {row.occupancy.people}
                  <span className="module-hint"> ({row.occupancy.from})</span>
                </td>
                <td>{row.exits.length}</td>
                <td title={row.limit.source}>
                  {row.travelM === null ? "—" : `${row.travelM.toFixed(1)}`} /{" "}
                  {row.limit.metres} m
                </td>
                <td>
                  {row.availableWidthM.toFixed(2)} / {row.requiredWidthM.toFixed(2)} m
                </td>
                <td>
                  {row.separation === null
                    ? "—"
                    : `${row.separation.actualM.toFixed(1)} / ${row.separation.requiredM.toFixed(1)} m`}
                </td>
                <td>
                  {row.findings.length === 0 ? (
                    <span className="module-hint">—</span>
                  ) : (
                    row.findings.map((finding, index) => (
                      <div
                        key={index}
                        style={{ color: finding.level === "serious" ? "#d03b3b" : "#fab219" }}
                      >
                        {finding.level === "serious" ? "▲" : "⚠"} {finding.message}{" "}
                        <span className="module-hint">[{finding.clause}]</span>
                      </div>
                    ))
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
