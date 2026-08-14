// Nhánh CHECK VA CHẠM của sơ đồ workflow: nhập/sửa ma trận, rồi đọc báo cáo.
//
// Cả hai vốn nằm chung trong một "schedule" kiểu CLASH, tức là chỉ tới được
// khi biết rằng phải tạo một bảng thống kê trước. Sơ đồ tách chúng thành hai
// bước, và tách đúng: quyết định *kiểm cái gì* là việc khác với đọc *đã tìm
// thấy gì*, và người làm hai việc đó thường không phải một người.

import { ClashMatrixGrid, ClashTable } from "./ScheduleTable";
import { store, useStoreVersion } from "../state/store";

/** File IFC link vào để dò va chạm — dùng chung cho cả hai pane. */
function LinkedModelBar() {
  const onPickIfc = async (file: File | undefined) => {
    if (!file) return;
    store.linkIfcModel(file.name, await file.text());
  };
  return (
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
      {store.linkedModels.length === 0 ? (
        <span className="module-hint" style={{ margin: 0 }}>
          Chưa link file nào — ma trận hiện chỉ có các hệ của model native.
        </span>
      ) : (
        store.linkedModels.map((model) => (
          <span key={model.name} className="peer-chip">
            {model.name} · {model.elements.length} phần tử
            {model.skipped > 0 ? ` (bỏ qua ${model.skipped})` : ""}
            {model.fullGeometry ? " · hình học đầy đủ" : ""}
            <button className="mini" onClick={() => store.unlinkIfcModel(model.name)}>
              ×
            </button>
          </span>
        ))
      )}
    </div>
  );
}

export function ClashMatrixModule() {
  useStoreVersion();
  return (
    <div className="module-host">
      <h2>Ma trận va chạm</h2>
      <p className="module-hint">
        Hệ × hệ, mỗi ô một dung sai riêng. Tắt một ô nghĩa là <strong>không
        báo</strong> cặp hệ đó — chứ không phải không kiểm: engine vẫn dò hết,
        nên bật lại một ô không thể bỏ sót va chạm chưa từng được tìm. Số bị ẩn
        luôn được đếm và hiện ở tab <strong>Báo cáo</strong>.
      </p>
      <LinkedModelBar />
      <ClashMatrixGrid />
    </div>
  );
}

export function ClashReportModule() {
  useStoreVersion();
  return (
    <div className="module-host">
      <h2>Báo cáo va chạm</h2>
      <ClashTable />
    </div>
  );
}
