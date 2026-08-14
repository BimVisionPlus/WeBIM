// ÁP ĐƠN GIÁ, TÍNH TOÁN SƠ BỘ — bước thứ hai của nhánh KIỂM TRA KHỐI LƯỢNG.
//
// Màn hình này cố tình khó nói dối. Ba chỗ:
//   - dòng chưa có đơn giá được đếm và liệt kê, không tính bằng 0;
//   - tổng tiền luôn đi kèm tỉ lệ phủ đơn giá;
//   - phần caveat nói thẳng cái mô hình không chứa (móng, thép, MEP, hoàn
//     thiện), vì đó mới là chỗ ước tính sơ bộ sai nhiều nhất.

import { useState } from "react";
import {
  DEFAULT_MARKUPS,
  estimate,
  priceProject,
  pricingCsv,
  type Markups,
} from "../application/pricing";
import { store, useStoreVersion } from "../state/store";

const vnd = (value: number) =>
  value.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

export function PricingModule() {
  useStoreVersion();
  const [markups, setMarkups] = useState<Markups>(DEFAULT_MARKUPS);
  const result = priceProject(store.project, store.project.rates);
  const sums = estimate(result.subtotal, markups);

  const download = () => {
    const blob = new Blob([pricingCsv(result, markups)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${store.projectLabel}-uoc-tinh.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const markupField = (label: string, key: keyof Markups) => (
    <label>
      {label}{" "}
      <input
        type="number"
        min={0}
        step={0.5}
        value={markups[key]}
        style={{ width: 70 }}
        onChange={(event) =>
          setMarkups({ ...markups, [key]: Number(event.target.value) })
        }
      />
      %
    </label>
  );

  return (
    <div className="module-host">
      <h2>Áp đơn giá — ước tính sơ bộ</h2>

      <div className="climate-finding warning">
        <p>
          ⚠ <strong>Ước tính sơ bộ theo khối lượng mô hình, không phải dự
          toán.</strong>
        </p>
        <p>
          Khối lượng chỉ có những gì đã được mô hình hoá. Ở bước phương án
          thường <strong>chưa có</strong> móng, cốt thép, MEP, hoàn thiện, phá
          dỡ và đất đắp — chúng không thiếu tiền trong bảng này, chúng không có
          mặt trong bảng này.
        </p>
        <p>
          Đơn giá dưới đây là <strong>đơn giá tổng hợp tự nhập</strong>. Dự toán
          theo quy định đi từ định mức (TT 12/2021/TT-BXD và bộ đơn giá địa
          phương), tách vật liệu / nhân công / máy thi công.
        </p>
      </div>

      <div className="module-form">
        {markupField("Chi phí chung", "overheadPct")}
        {markupField("Thu nhập chịu thuế TT", "profitPct")}
        {markupField("VAT", "vatPct")}
        {markupField("Dự phòng", "contingencyPct")}
        <button onClick={download} disabled={result.rows.length === 0}>
          Xuất CSV
        </button>
      </div>

      {result.rows.length === 0 ? (
        <p className="module-hint">
          Chưa có khối lượng nào để áp giá — dựng cấu kiện ở <strong>BIM</strong>{" "}
          rồi quay lại.
        </p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Hạng mục</th>
                <th>Vật liệu</th>
                <th>ĐVT</th>
                <th>Khối lượng</th>
                <th>Đơn giá (VNĐ)</th>
                <th>Thành tiền (VNĐ)</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.key} className={row.rate === null ? "row-warning" : ""}>
                  <td>{row.category}</td>
                  <td>{row.material}</td>
                  <td>{row.unit}</td>
                  <td>{row.quantity.toFixed(3)}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={row.rate ?? ""}
                      placeholder="chưa nhập"
                      style={{ width: 130 }}
                      onChange={(event) =>
                        store.setRate(row.key, Number(event.target.value))
                      }
                    />
                  </td>
                  <td>{row.amount === null ? "—" : vnd(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {result.uncovered.length > 0 && (
            <p className="module-hint climate-finding warning">
              {result.uncovered.length}/{result.rows.length} dòng chưa có đơn
              giá ({result.uncovered.map((row) => `${row.category} · ${row.material}`).join("; ")}).
              Khối lượng của chúng <strong>không</strong> nằm trong tổng dưới
              đây — tổng này là của {Math.round(result.coverage * 100)}% số dòng.
            </p>
          )}

          <table className="estimate-table">
            <tbody>
              <tr>
                <td>Chi phí trực tiếp</td>
                <td>{vnd(sums.direct)}</td>
              </tr>
              <tr>
                <td>Chi phí chung ({markups.overheadPct}%)</td>
                <td>{vnd(sums.overhead)}</td>
              </tr>
              <tr>
                <td>Thu nhập chịu thuế tính trước ({markups.profitPct}%)</td>
                <td>{vnd(sums.profit)}</td>
              </tr>
              <tr>
                <td>Cộng trước thuế</td>
                <td>{vnd(sums.beforeVat)}</td>
              </tr>
              <tr>
                <td>VAT ({markups.vatPct}%)</td>
                <td>{vnd(sums.vat)}</td>
              </tr>
              <tr>
                <td>Dự phòng ({markups.contingencyPct}%)</td>
                <td>{vnd(sums.contingency)}</td>
              </tr>
              <tr className="estimate-total">
                <td>Tổng ước tính</td>
                <td>{vnd(sums.total)} ₫</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
