// IMPORT IFC — nhánh BIM của sơ đồ workflow.
//
// Màn hình này phải nói rõ nó khác gì với "Link IFC" ở tab Check va chạm, vì
// hai thứ nghe giống nhau và làm hai việc trái ngược:
//
//   Link   — giữ nguyên file gốc, dùng ở mức hộp bao để dò va chạm. Không sửa
//            được, nhưng không mất gì.
//   Import — chuyển thành khối trong model của mình, sửa được. Được quyền sửa
//            thì phải trả giá: chỉ còn hộp bao.

import { useMemo, useState } from "react";
import { planImport, specsForTypes } from "../application/ifcImport";
import { parseIfc } from "../ifc/parseIfc";
import type { LinkedElement } from "../ifc/parseIfc";
import { store, useStoreVersion } from "../state/store";

export function IfcImportModule() {
  useStoreVersion();
  const [elements, setElements] = useState<LinkedElement[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [skipped, setSkipped] = useState(0);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<number | null>(null);

  const plan = useMemo(() => (elements ? planImport(elements) : null), [elements]);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseIfc(await file.text());
    setFileName(file.name);
    setElements(parsed.elements);
    setSkipped(parsed.skipped);
    setDone(null);
    setChosen(new Set(planImport(parsed.elements).byType.map((row) => row.ifcType)));
  };

  const toggle = (ifcType: string) => {
    const next = new Set(chosen);
    if (next.has(ifcType)) next.delete(ifcType);
    else next.add(ifcType);
    setChosen(next);
  };

  const runImport = () => {
    if (!plan) return;
    const specs = specsForTypes(plan, chosen);
    for (const spec of specs) {
      store.project.addMass(spec.outline, { name: spec.name, height: spec.height });
    }
    store.touch(`Đã import ${specs.length} khối từ ${fileName}`);
    setDone(specs.length);
  };

  const selectedCount =
    plan?.candidates.filter((candidate) => chosen.has(candidate.ifcType)).length ?? 0;

  return (
    <div className="module-host">
      <h2>Import IFC</h2>

      <div className="climate-finding warning">
        <p>
          ⚠ Import <strong>chỉ giữ được hộp bao</strong> của mỗi phần tử. Bộ đọc
          IFC của WeBIM dựng hình từ thân SweptSolid; nó không đọc mặt cong,
          không đọc phép cắt Boolean, và <strong>không giữ lỗ mở</strong>. Mỗi
          phần tử vào đây thành một <strong>khối</strong> — sửa được, nhưng
          không phải hình học gốc.
        </p>
        <p>
          Cần hình học đúng để dò va chạm thì đừng import: dùng{" "}
          <strong>Check va chạm → Link IFC</strong>. Link giữ nguyên file và
          không nuốt nó vào một mô hình nghèo hơn.
        </p>
      </div>

      <div className="module-form">
        <label className="upload-button">
          Chọn file .ifc…
          <input
            type="file"
            accept=".ifc"
            style={{ display: "none" }}
            onChange={(event) => {
              void onPick(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {fileName && (
          <span className="module-hint" style={{ margin: 0 }}>
            {fileName}
          </span>
        )}
      </div>

      {plan && (
        <>
          <p className="module-hint">
            {plan.candidates.length} phần tử dựng được thành khối
            {skipped > 0 && ` · ${skipped} bị bỏ qua khi đọc (thân không hỗ trợ)`}
            {plan.degenerate.length > 0 &&
              ` · ${plan.degenerate.length} có hộp bao dẹt, không đùn được khối nào`}
          </p>

          {plan.byType.length === 0 ? (
            <p className="module-hint">Không có phần tử nào dựng được.</p>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Nhập</th>
                    <th>IfcType</th>
                    <th>Số phần tử</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.byType.map((row) => (
                    <tr key={row.ifcType}>
                      <td>
                        <input
                          type="checkbox"
                          checked={chosen.has(row.ifcType)}
                          onChange={() => toggle(row.ifcType)}
                        />
                      </td>
                      <td>{row.ifcType}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="module-form">
                <button onClick={runImport} disabled={selectedCount === 0}>
                  Import {selectedCount} phần tử thành khối
                </button>
                {done !== null && (
                  <span className="module-hint" style={{ margin: 0 }}>
                    Đã thêm {done} khối — xem ở <strong>BIM → Box khối</strong>.
                  </span>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
