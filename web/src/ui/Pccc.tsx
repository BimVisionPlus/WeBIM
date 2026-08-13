// PCCC — sàng lọc thoát nạn.
//
// The caveats are on screen, not only in the source: the limits are
// unverified defaults, and the distance is straight-line rather than the
// walked route. A screen that looks authoritative about fire safety while
// resting on placeholder numbers is worse than no screen.

import { analyseProject, DEFAULT_RULES } from "../application/pccc";
import { store, useStoreVersion } from "../state/store";

export function PcccModule() {
  useStoreVersion();
  const results = analyseProject(store.project);
  const serious = results.flatMap((row) => row.findings.filter((f) => f.level === "serious"));
  const people = results.reduce((sum, row) => sum + row.occupancy, 0);

  return (
    <div className="module-host">
      <h2>PCCC — sàng lọc thoát nạn</h2>

      <div className="climate-finding warning">
        <p>
          ⚠ <strong>Đây là sàng lọc sơ bộ, không phải tính toán PCCC.</strong>
        </p>
        <p>
          Ngưỡng cự ly và mật độ người trong bảng là <strong>giá trị mặc định
          chưa đối chiếu công báo</strong> QCVN 06:2022/BXD (và Sửa đổi 1:2023).
          Phải kiểm tra với văn bản gốc trước khi dùng cho hồ sơ.
        </p>
        <p>
          Cự ly ở đây là <strong>đường thẳng</strong> từ góc phòng xa nhất tới
          cửa gần nhất, không phải quãng đường đi vòng qua vách và đồ đạc. Quãng
          đường thật luôn dài hơn — phòng <em>không đạt</em> ở đây thì chắc chắn
          không đạt; phòng <em>đạt</em> vẫn có thể trượt khi vẽ đường thoát thật.
        </p>
      </div>

      <div className="stat-row">
        <div className="stat-tile">
          <span className="stat-value">{results.length}</span>
          <span className="stat-label">Phòng</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{people}</span>
          <span className="stat-label">Người (quy đổi)</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{serious.length}</span>
          <span className="stat-label">Không đạt</span>
        </div>
      </div>

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
              <th>Cự ly trực tiếp</th>
              <th>Bề rộng có / cần</th>
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
                <td>{DEFAULT_RULES[row.room.usage]?.label ?? row.room.usage}</td>
                <td>{row.areaM2.toFixed(1)} m²</td>
                <td>
                  {row.occupancy}
                  {row.room.occupancyOverride !== null && (
                    <span className="module-hint"> (nhập tay)</span>
                  )}
                </td>
                <td>{row.exits.length}</td>
                <td>{row.travelM === null ? "—" : `${row.travelM.toFixed(1)} m`}</td>
                <td>
                  {row.availableWidthM.toFixed(2)} / {row.requiredWidthM.toFixed(2)} m
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
                        {finding.level === "serious" ? "▲" : "⚠"} {finding.message}
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
