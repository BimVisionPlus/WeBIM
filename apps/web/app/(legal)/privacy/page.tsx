export const metadata = { title: "Chính sách bảo mật — Viwase Quản lý công việc" };

export default function PrivacyPage() {
  return (
    <article>
      <h1>Chính sách bảo mật</h1>
      <p><em>Cập nhật ngày 18/05/2026 — phù hợp NĐ 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.</em></p>

      <h2>1. Dữ liệu chúng tôi thu thập</h2>
      <ul>
        <li><strong>Thông tin tài khoản:</strong> họ tên, email, số điện thoại, mật khẩu (lưu dưới dạng băm bcrypt).</li>
        <li><strong>Thông tin tổ chức:</strong> tên doanh nghiệp, MST, địa chỉ, vai trò trong ngành.</li>
        <li><strong>Nội dung công việc:</strong> bản vẽ, mô hình BIM, ảnh công trường, nhật ký thi công, bình luận, biểu mẫu nghiệm thu — do người dùng tự nhập.</li>
        <li><strong>Dữ liệu kỹ thuật:</strong> địa chỉ IP, user-agent, log hoạt động (cho mục đích bảo mật & audit).</li>
      </ul>

      <h2>2. Mục đích sử dụng</h2>
      <ul>
        <li>Vận hành nền tảng và các tính năng nghiệp vụ AEC.</li>
        <li>Đáp ứng nghĩa vụ pháp lý (NĐ 06/2021 yêu cầu lưu vết hồ sơ chất lượng).</li>
        <li>Bảo mật, phát hiện gian lận và hỗ trợ kỹ thuật.</li>
        <li>Liên hệ về cập nhật dịch vụ (Khách hàng có thể từ chối email tiếp thị bất cứ lúc nào).</li>
      </ul>

      <h2>3. Cơ sở pháp lý xử lý dữ liệu</h2>
      <p>Hợp đồng sử dụng dịch vụ, sự đồng ý của Khách hàng, và nghĩa vụ pháp lý của doanh nghiệp xây dựng theo pháp luật Việt Nam.</p>

      <h2>4. Chia sẻ dữ liệu</h2>
      <p>Chúng tôi <strong>không bán</strong> dữ liệu cá nhân. Chỉ chia sẻ với:</p>
      <ul>
        <li>Nhà cung cấp hạ tầng (S3-compatible storage, email transactional, BIM viewer) theo hợp đồng xử lý dữ liệu.</li>
        <li>Cơ quan nhà nước có thẩm quyền khi có yêu cầu hợp pháp.</li>
        <li>Các bên liên quan trong cùng dự án (CĐT, TVGS, TVTK, NT) — chỉ với dữ liệu của dự án đó.</li>
      </ul>

      <h2>5. Lưu trữ và bảo mật</h2>
      <ul>
        <li>Mật khẩu băm bằng bcrypt (12 vòng).</li>
        <li>HTTPS bắt buộc trong môi trường sản xuất.</li>
        <li>Sao lưu cơ sở dữ liệu hàng ngày, lưu trữ 30 ngày.</li>
        <li>Audit log immutable, lưu tối thiểu 5 năm.</li>
        <li>Phiên đăng nhập tối đa 7 ngày, tự động hết hạn.</li>
      </ul>

      <h2>6. Quyền của Chủ thể dữ liệu (NĐ 13/2023)</h2>
      <p>Khách hàng có các quyền sau:</p>
      <ul>
        <li><strong>Quyền được biết</strong> dữ liệu đang được xử lý.</li>
        <li><strong>Quyền truy cập</strong> và <strong>xuất dữ liệu</strong> — sử dụng tính năng "Xuất dữ liệu của tôi" trong tài khoản, hoặc gọi <code>GET /api/me/export</code>.</li>
        <li><strong>Quyền chỉnh sửa</strong> dữ liệu cá nhân trong phần Cài đặt tài khoản.</li>
        <li><strong>Quyền xoá</strong> — yêu cầu xoá tài khoản qua email <a href="mailto:privacy@atlas-aec.vn">privacy@atlas-aec.vn</a>. Lưu ý: dữ liệu công trình mà Khách hàng đã tạo trong dự án của tổ chức khác có thể được giữ lại theo yêu cầu pháp lý.</li>
        <li><strong>Quyền phản đối</strong> việc xử lý cho mục đích tiếp thị.</li>
      </ul>

      <h2>7. Lưu giữ dữ liệu</h2>
      <p>Khi tài khoản bị xoá, dữ liệu cá nhân được xoá khỏi hệ thống sản xuất trong vòng 30 ngày, trừ khi pháp luật yêu cầu lưu lâu hơn (NĐ 06/2021 với hồ sơ nghiệm thu — tối thiểu suốt thời hạn bảo hành công trình).</p>

      <h2>8. Vị trí dữ liệu</h2>
      <p>Theo NĐ 53/2022, dữ liệu của tổ chức Việt Nam được lưu trữ tại trung tâm dữ liệu đặt tại Việt Nam. Khách hàng quốc tế có thể lựa chọn vùng lưu trữ khác.</p>

      <h2>9. Liên hệ DPO</h2>
      <p>Email: <a href="mailto:privacy@atlas-aec.vn">privacy@atlas-aec.vn</a></p>
    </article>
  );
}
