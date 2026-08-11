// Khai báo bảo vệ dữ liệu cá nhân theo NĐ 13/2023/NĐ-CP.
// Bắt buộc đăng ký với A05 (Cục An ninh mạng + Phòng chống tội phạm CN cao) trước
// khi xử lý dữ liệu cá nhân ở quy mô thương mại. Trang này phục vụ tham vấn ý kiến
// của người dùng + audit nội bộ — KHÔNG thay thế hồ sơ đăng ký A05.

export const metadata = { title: "Bảo vệ dữ liệu cá nhân — AEC Platform" };

export default function DataProtectionPage() {
  return (
    <>
      <h1>Bảo vệ dữ liệu cá nhân</h1>
      <p className="lead">
        Tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân. Cập nhật lần cuối: <strong>26/05/2026</strong>.
      </p>

      <h2>1. Phạm vi áp dụng</h2>
      <p>
        AEC Platform (vận hành bởi <strong>AEC Platform Co., Ltd.</strong>, MST <code>0123456789</code>, trụ sở tại
        TP. HCM) thu thập và xử lý dữ liệu cá nhân khi bạn:
      </p>
      <ul>
        <li>Tạo tài khoản (email, họ tên, số điện thoại, mật khẩu băm)</li>
        <li>Tham gia dự án AEC (vai trò, tổ chức, chứng chỉ hành nghề HĐXD)</li>
        <li>Sử dụng các mô-đun chữ ký số / điểm danh / nhân lực (CCCD, ảnh khuôn mặt cho face match)</li>
        <li>Upload tài liệu hồ sơ thi công có thể chứa dữ liệu cá nhân bên thứ ba</li>
      </ul>

      <h2>2. Loại dữ liệu cá nhân thu thập</h2>
      <h3>2.1 Dữ liệu cá nhân cơ bản (Đ.2.1 NĐ 13)</h3>
      <ul>
        <li>Họ tên, ngày sinh, giới tính, quốc tịch</li>
        <li>Số CCCD/CMND, hộ chiếu (cho mô-đun WorkforceHub + HSE-Train)</li>
        <li>Địa chỉ, số điện thoại, email</li>
        <li>Chứng chỉ hành nghề (số CCHN, hạng, ngày cấp)</li>
      </ul>
      <h3>2.2 Dữ liệu cá nhân nhạy cảm (Đ.2.4 NĐ 13)</h3>
      <ul>
        <li>Ảnh sinh trắc (face embedding 512-dim qua InsightFace cho face-match check-in công trường)</li>
        <li>Vị trí địa lý GPS (cho chấm công công trường)</li>
        <li>Tình trạng sức khỏe (kết quả khám sức khỏe ATLĐ — chỉ khi tự upload)</li>
      </ul>

      <h2>3. Mục đích xử lý</h2>
      <ul>
        <li><strong>Xác thực:</strong> đăng nhập, khôi phục mật khẩu, mời cộng tác</li>
        <li><strong>Vận hành công trình:</strong> ghi nhật ký, BBNT, hồ sơ hoàn công NĐ 06/2021</li>
        <li><strong>Tuân thủ ATLĐ:</strong> quản lý chứng chỉ ATLĐ NĐ 44/2016, thẻ ra vào QR</li>
        <li><strong>Thanh toán + đối soát:</strong> hồ sơ thanh toán NĐ 99/2021 + ký số chuỗi NT-TVGS-CĐT</li>
        <li><strong>Chống gian lận:</strong> audit log mọi action có tính pháp lý (xem Đ.8 NĐ 13)</li>
      </ul>

      <h2>4. Cơ sở pháp lý xử lý (Đ.3 NĐ 13)</h2>
      <ol>
        <li><strong>Sự đồng ý:</strong> bạn click "Đồng ý" khi tạo tài khoản — có thể rút lại bất cứ lúc nào</li>
        <li><strong>Thực hiện hợp đồng:</strong> để cung cấp dịch vụ bạn đã đăng ký</li>
        <li><strong>Tuân thủ pháp luật:</strong> NĐ 06/2021 yêu cầu lưu hồ sơ hoàn công 10 năm sau bàn giao</li>
      </ol>

      <h2>5. Chia sẻ dữ liệu</h2>
      <p>Chúng tôi <strong>không bán</strong> dữ liệu cá nhân. Chỉ chia sẻ trong các trường hợp:</p>
      <ul>
        <li><strong>Trong dự án:</strong> các tổ chức stakeholder (CĐT, TVGS, NT) thấy nhật ký của nhau (per project RBAC)</li>
        <li><strong>Cơ quan QLNN:</strong> khi có yêu cầu chính thức (Sở XD, KBNN, PC07, công an)</li>
        <li><strong>Nhà cung cấp hạ tầng:</strong> Neon (PG), Upstash (Redis), Cloudflare R2 / MinIO self-host, Resend (email)
          — đã ký data processing agreement, đặt server tại Singapore/EU không lưu ở quốc gia cấm</li>
        <li><strong>Chữ ký số:</strong> VNPT-CA / Viettel-CA — chỉ truyền hash, không truyền nội dung</li>
      </ul>

      <h2>6. Lưu trữ + chuyển dữ liệu xuyên biên giới (Đ.25 NĐ 13)</h2>
      <p>
        Server chính của AEC Platform đặt tại <strong>Singapore (Neon ap-southeast-1)</strong> + EU (Upstash). Khi chuyển dữ liệu
        ra ngoài VN, chúng tôi tuân thủ Đ.25 NĐ 13 + đã/sẽ nộp hồ sơ <em>Đánh giá tác động chuyển dữ liệu ra nước ngoài</em>
        cho Bộ Công an (A05) trước 60 ngày kể từ ngày bắt đầu chuyển.
      </p>

      <h2>7. Thời hạn lưu trữ</h2>
      <ul>
        <li>Hồ sơ tài khoản đang hoạt động: trong suốt thời gian sử dụng dịch vụ</li>
        <li>Hồ sơ hoàn công + BBNT: <strong>10 năm</strong> sau bàn giao (NĐ 06/2021 Đ.16)</li>
        <li>Hồ sơ thanh toán: <strong>10 năm</strong> (Luật Kế toán Đ.13)</li>
        <li>Log đăng nhập: 12 tháng (theo NĐ 53/2022)</li>
        <li>Khi xóa tài khoản: dữ liệu cá nhân (trừ legal-hold) bị xóa trong 30 ngày</li>
      </ul>

      <h2>8. Quyền của chủ thể dữ liệu (Đ.9 NĐ 13)</h2>
      <ol>
        <li>Quyền được biết</li>
        <li>Quyền đồng ý / rút đồng ý</li>
        <li>Quyền truy cập</li>
        <li>Quyền chỉnh sửa</li>
        <li>Quyền xóa</li>
        <li>Quyền hạn chế xử lý</li>
        <li>Quyền cung cấp dữ liệu</li>
        <li>Quyền phản đối xử lý</li>
        <li>Quyền khiếu nại + tố cáo + yêu cầu bồi thường</li>
        <li>Quyền tự bảo vệ</li>
      </ol>
      <p>
        Để thực hiện: gửi yêu cầu tới <a href="mailto:dpo@aecplatform.vn">dpo@aecplatform.vn</a>. Chúng tôi phản hồi trong
        <strong>72 giờ làm việc</strong>.
      </p>

      <h2>9. Bảo mật</h2>
      <ul>
        <li>Mật khẩu băm bcrypt cost 10 — không lưu plaintext</li>
        <li>TLS 1.3 toàn bộ kết nối — Let's Encrypt auto-renew</li>
        <li>Database row-level access control + audit log mọi mutation</li>
        <li>Backup mã hóa AES-256 + retention 30 ngày + restore drill hằng quý</li>
        <li>Face embedding không reversible (one-way) — không lưu ảnh gốc</li>
      </ul>

      <h2>10. Vi phạm dữ liệu</h2>
      <p>
        Nếu xảy ra vi phạm, chúng tôi sẽ:
      </p>
      <ul>
        <li>Thông báo cho A05 trong <strong>72 giờ</strong> (Đ.23 NĐ 13)</li>
        <li>Thông báo cho người bị ảnh hưởng trong 72 giờ qua email</li>
        <li>Công bố trên <a href="https://status.aecplatform.vn">status.aecplatform.vn</a></li>
      </ul>

      <h2>11. DPO (Data Protection Officer)</h2>
      <p>
        <strong>Email:</strong> <a href="mailto:dpo@aecplatform.vn">dpo@aecplatform.vn</a><br />
        <strong>Hotline:</strong> 1900-xxxx<br />
        <strong>Địa chỉ:</strong> [Office Address], Quận 1, TP. HCM
      </p>

      <h2>12. Thay đổi chính sách</h2>
      <p>
        Mọi thay đổi sẽ thông báo qua email tới chủ tài khoản + đăng tại <a href="/data-protection">/data-protection</a>{" "}
        trước ít nhất 15 ngày.
      </p>

      <hr />
      <p className="text-xs text-[rgb(var(--muted))]">
        Tuân thủ: NĐ 13/2023/NĐ-CP · Luật ATTT 2018 · Luật ANM 2018 · NĐ 53/2022 · Bộ Công an A05.
      </p>
    </>
  );
}
