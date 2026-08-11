# Demo Panic Kit

Scripts khẩn cấp dùng giữa demo nếu có gì hỏng. Mỗi script idempotent,
in-and-out trong 10-30s, không phá data của các dự án khác.

## Quick reference

| Tình huống | Script |
|---|---|
| Trang trống / 500 error / cache lỗi | `./restart-web.sh` |
| Demo project bị xoá nhầm / data wrong | `./reset-demo-project.sh` |
| Invite cũ bị accept rồi, cần invite mới | `./reset-invite.sh ng.th.thuyy@gmail.com` |
| Workflow stuck ở state lạ | `./fix-workflow.sh KHFKKSDJF-CO-001 DRAFT` |
| AI offline banner stuck | `./reset-ai-banner.sh` |
| Container chết, cần restart | `./restart-web.sh` |
| Cần show data fresh ngay (re-seed) | `./reseed.sh` (CHẬM ~30s) |

## Prereqs

- SSH key tại `~/.ssh/aecplatform_deploy`
- VPS IP `142.132.170.171` (root)
- Có quyền chạy docker compose trên VPS

## Universal env vars
```bash
export VPS=root@142.132.170.171
export VPS_KEY=$HOME/.ssh/aecplatform_deploy
export BASE=https://app.aecplatform.vn
```
