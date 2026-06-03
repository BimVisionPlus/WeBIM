const items = [
  { law: "NĐ 06/2021/NĐ-CP", what: "Quản lý chất lượng, thi công, bảo trì", maps: "Workflow Nghiệm thu CV/GĐ/HT, NCR, nhật ký công trình" },
  { law: "NĐ 15/2021/NĐ-CP", what: "Quản lý dự án đầu tư xây dựng", maps: "Cấu trúc dự án, phân vai trò CĐT–TVGS–NT" },
  { law: "VBHN 06/VBHN-BXD", what: "Quản lý chi phí ĐTXD (hợp nhất NĐ 10/2021 + sửa đổi)", maps: "BoQ, định mức 10/2019, thanh toán giai đoạn" },
  { law: "Luật XD 50/2014 sđ 62/2020", what: "Cơ sở pháp lý ngành", maps: "Toàn bộ kiến trúc hệ thống" },
  { law: "NĐ 123/2020 + TT 78/2021", what: "Hoá đơn điện tử (HĐĐT)", maps: "Module thanh toán → xuất HĐĐT TCT 24h" },
  { law: "Luật Giao dịch điện tử 2023", what: "Chữ ký số có giá trị pháp lý", maps: "VNPT-CA / Viettel-CA cho BBNT" },
  { law: "QCVN 06:2022/BXD", what: "An toàn cháy cho nhà & CT", maps: "Tham chiếu trong NCR, Submittal PCCC" },
  { law: "TCVN 5574:2018", what: "Thiết kế kết cấu BTCT", maps: "QcvnRef trong NCR khi sai khác" },
];

export function VnStack() {
  return (
    <section className="bg-slate-950 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Hệ pháp lý Việt Nam — đã ngấm vào code</h2>
          <p className="mt-3 text-slate-400">
            Không phải template Excel. Là state machine + validator + audit log.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((i) => (
            <div
              key={i.law}
              className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
            >
              <div className="font-mono text-xs text-blue-400">{i.law}</div>
              <div className="mt-1 text-sm font-medium text-white">{i.what}</div>
              <div className="mt-1 text-xs text-slate-400">Maps → {i.maps}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
