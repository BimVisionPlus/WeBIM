# WeBIM Public API

Base URL (bản hosted): `https://app.webim.vn/api` — self-host thì là cổng
relay của bạn (mặc định `:8787`, không có tiền tố `/api`).

Nguyên tắc phiên bản: các endpoint dưới đây là **v1** và giữ tương thích
ngược — thay đổi phá vỡ sẽ đi kèm tiền tố đường dẫn mới, không sửa lặng lẽ
đường cũ.

## Xác thực

Hai loại danh tính, cùng một header:

```
Authorization: Bearer <token>
```

| Loại | Lấy ở đâu | Sống | Dùng cho |
|------|-----------|------|----------|
| Session token | `POST /auth/login` `{username, password}` | 12 giờ | người, UI |
| API key `wbk_…` | `POST /apikeys` (bằng session token) | đến khi thu hồi | máy: CI, script, tích hợp |

API key map về đúng tài khoản của bạn: mọi phân quyền theo dự án, quota,
gói đều áp như khi bạn đăng nhập. Key hiển thị **đúng một lần** lúc tạo;
trên máy chủ chỉ lưu SHA-256. Xoá tài khoản = mọi key của tài khoản chết theo.

Quản lý key **chỉ bằng session token** — key không tạo/xoá được key:

```bash
# tạo (lưu "key" trong response ngay — không hiển thị lại)
curl -X POST https://app.webim.vn/api/apikeys \
  -H "Authorization: Bearer $SESSION" -H "Content-Type: application/json" \
  -d '{"label": "CI pipeline"}'

# liệt kê (chỉ id/label/prefix/mốc dùng, không bao giờ có key)
curl https://app.webim.vn/api/apikeys -H "Authorization: Bearer $SESSION"

# thu hồi
curl -X DELETE https://app.webim.vn/api/apikeys/<id> -H "Authorization: Bearer $SESSION"
```

## Endpoints chính

Tất cả nhận cả hai loại token. Enforcement (membership/quota) như trong UI.

| Method | Path | Ý nghĩa |
|--------|------|---------|
| GET | `/health` | trạng thái server (không cần token) |
| GET | `/projects` | dự án bạn có quyền xem |
| GET | `/projects/:id/state` | snapshot dự án (JSON `{project, clocks}`) |
| PUT | `/projects/:id/state` | đẩy snapshot (editor; ≤25 MB) |
| GET | `/list?prefix=<projectId>/` | file của dự án |
| GET | `/files/<key>` | tải một file |
| PUT | `/files/<key>` | nộp file (editor; quota dự án mặc định 2 GB) |
| GET | `/projects/:id/audit` | nhật ký sự kiện của dự án |
| POST | `/ai/standards-qa` | Q&A quy chuẩn có trích điều khoản (cần AI self-host) |

Ví dụ — nộp một bản IFC từ CI:

```bash
curl -X PUT "https://app.webim.vn/api/files/<projectId>/models/KT-r5.ifc" \
  -H "Authorization: Bearer $WEBIM_API_KEY" \
  --data-binary @KT-r5.ifc
```

## Webhook

Owner của dự án đăng ký URL nhận sự kiện. Sự kiện hiện có:

- `file.put` — có file mới/ghi đè: `{event, projectId, key, size, user, sentAt}`
- `state.push` — snapshot dự án được đẩy: `{event, projectId, user, size, sentAt}`

```bash
# đăng ký (owner; secret trong response hiển thị đúng một lần)
curl -X POST https://app.webim.vn/api/projects/<id>/webhooks \
  -H "Authorization: Bearer $SESSION" -H "Content-Type: application/json" \
  -d '{"url": "https://hooks.cua-ban.vn/webim", "events": ["file.put"]}'

# liệt kê (kèm lastStatus/lastAt — hook chết là nhìn thấy)
curl https://app.webim.vn/api/projects/<id>/webhooks -H "Authorization: Bearer $SESSION"

# xoá
curl -X DELETE https://app.webim.vn/api/projects/<id>/webhooks/<hookId> \
  -H "Authorization: Bearer $SESSION"
```

Giới hạn: 10 webhook/dự án; chỉ http(s) tới địa chỉ công cộng (loopback,
dải private, link-local, metadata đều bị chặn — kiểm cả sau khi phân giải
DNS); timeout 10 giây, thất bại thử lại một lần sau 5 giây; kết quả cuối
ghi vào `lastStatus`. Không có hàng đợi bền — hệ của bạn sập lâu thì sự
kiện trong lúc đó mất, và `lastStatus` nói thẳng điều đó.

### Verify chữ ký

Mỗi lần gọi kèm:

```
X-WeBIM-Event: file.put
X-WeBIM-Signature: sha256=<hex HMAC-SHA256(secret, raw body)>
```

Node:

```js
import { createHmac, timingSafeEqual } from "node:crypto";

function verify(secret, rawBody, header) {
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  return (
    header?.length === expected.length &&
    timingSafeEqual(Buffer.from(header), Buffer.from(expected))
  );
}
```

Python:

```python
import hashlib, hmac

def verify(secret: str, raw_body: bytes, header: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(header or "", expected)
```

## Mã lỗi

| Mã | Nghĩa |
|----|-------|
| 401 | thiếu/sai token, hoặc key đã thu hồi |
| 402 | đụng hạn mức gói (dự án riêng thứ 2 gói free, hết credit render) |
| 403 | có danh tính nhưng thiếu quyền trong dự án này |
| 404 | không có |
| 409 | dự án chưa claim (webhook cần owner tồn tại) |
| 413 | quá quota dự án / snapshot quá 25 MB |
| 501 | tính năng AI chưa cấu hình trên server này |
