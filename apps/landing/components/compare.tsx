const rows = [
  { label: "Giá / công ty 50 user / tháng", atlas: "9.9tr VND", procore: "~120tr VND", acc: "~85tr VND", excel: "0đ" },
  { label: "Giao diện tiếng Việt 100%", atlas: "Có", procore: "Một phần", acc: "Một phần", excel: "Có" },
  { label: "Nghiệm thu NĐ 06/2021 (BBNT-CV/GĐ/HT)", atlas: "Có sẵn", procore: "Tùy chỉnh", acc: "Tùy chỉnh", excel: "Tự làm" },
  { label: "Hồ sơ hoàn công tự động", atlas: "Có sẵn", procore: "Không", acc: "Không", excel: "Tự làm" },
  { label: "Chữ ký số VNPT-CA / Viettel-CA", atlas: "Tích hợp", procore: "Không", acc: "Không", excel: "Không" },
  { label: "HĐĐT NĐ 123/2020 (TCT 24h)", atlas: "Có sẵn", procore: "Không", acc: "Không", excel: "Không" },
  { label: "BIM Viewer (IFC/RVT/NWD)", atlas: "Forge", procore: "Có", acc: "Có (gốc)", excel: "Không" },
  { label: "RFI / Submittal / NCR workflow", atlas: "Có", procore: "Có", acc: "Có", excel: "Không" },
  { label: "Triển khai on-prem (chủ quyền dữ liệu)", atlas: "Có", procore: "Không", acc: "Không", excel: "—" },
  { label: "Định mức 10/2019, đơn giá địa phương", atlas: "Có sẵn", procore: "Không", acc: "Không", excel: "Tự làm" },
];

export function Compare() {
  return (
    <section className="bg-slate-950/50 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">So với Procore, Autodesk ACC, Excel</h2>
          <p className="mt-3 text-slate-400">
            Atlas AEC là duy nhất được thiết kế cho khung pháp lý xây dựng Việt Nam.
          </p>
        </div>

        <div className="mt-10 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Tính năng</th>
                <th className="px-4 py-3 text-blue-400">Atlas AEC</th>
                <th className="px-4 py-3">Procore</th>
                <th className="px-4 py-3">Autodesk ACC</th>
                <th className="px-4 py-3">Excel + Zalo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="px-4 py-3 text-slate-300">{r.label}</td>
                  <td className="px-4 py-3 font-medium text-blue-300">{r.atlas}</td>
                  <td className="px-4 py-3 text-slate-400">{r.procore}</td>
                  <td className="px-4 py-3 text-slate-400">{r.acc}</td>
                  <td className="px-4 py-3 text-slate-400">{r.excel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
