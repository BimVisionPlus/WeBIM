// Thanh công cụ vẽ — nằm trong khung dựng hình của BIM, không nằm trên đầu app.
//
// Trước đây mười cái nút này chiếm nửa thanh trên cùng ở *mọi* màn hình: đọc
// PDF, tra tiêu chuẩn, xem báo cáo va chạm, áp đơn giá — chỗ nào cũng có
// "Wall" và "Roof" mà bấm vào thì không xảy ra gì. Một công cụ chỉ dùng được
// ở một chỗ thì nên sống ở chỗ đó.
//
// Snap đi theo chúng vì cùng lý do: bước bắt điểm chỉ có nghĩa khi đang vẽ.

import { store, useStoreVersion } from "../state/store";
import type { ToolId } from "../state/store";

const TOOLS: { id: ToolId; label: string; title: string }[] = [
  { id: "SELECT", label: "Chọn", title: "Chọn / sửa (Esc)" },
  { id: "GRID", label: "Trục", title: "Vẽ trục — hai điểm (G)" },
  { id: "WALL", label: "Tường", title: "Vẽ tường — hai điểm (W)" },
  { id: "DOOR", label: "Cửa đi", title: "Đặt cửa đi lên tường (D)" },
  { id: "WINDOW", label: "Cửa sổ", title: "Đặt cửa sổ lên tường (O)" },
  { id: "ROOM", label: "Phòng", title: "Khoanh phòng — hai góc đối diện" },
  { id: "MASS", label: "Box khối", title: "Khối nghiên cứu — hai góc đối diện" },
  { id: "FLOOR", label: "Sàn", title: "Vẽ sàn — hai góc đối diện (F)" },
  { id: "ROOF", label: "Mái", title: "Vẽ mái — hai góc đối diện (R)" },
  { id: "DIM", label: "Kích thước", title: "Ghi kích thước — hai điểm rồi đặt đường (M)" },
];

export function DrawingTools() {
  useStoreVersion();
  // Server đã chặn frame của viewer/người ngoài rồi; khoá nút ở đây chỉ để
  // người dùng không vẽ ra thứ trông như đã lưu mà thật ra không đồng bộ.
  const locked = !store.canEdit;
  return (
    <div className="drawing-tools">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          className={store.activeTool === tool.id ? "active" : ""}
          onClick={() => store.setTool(tool.id)}
          disabled={locked && tool.id !== "SELECT"}
          title={locked && tool.id !== "SELECT" ? "Chỉ xem — bạn không có quyền editor trong dự án này" : tool.title}
        >
          {tool.label}
        </button>
      ))}
      <label className="field">
        Bắt điểm
        <select
          value={store.snapIncrement}
          onChange={(event) => store.setSnapIncrement(Number(event.target.value))}
        >
          {[0.01, 0.05, 0.1, 0.25, 0.5, 1].map((value) => (
            <option key={value} value={value}>
              {value} m
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
