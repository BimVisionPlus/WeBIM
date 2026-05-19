# Atlas AEC — Workflow & legal anchors

Every issue subtype has its own state machine in [`packages/workflows/src/`](../packages/workflows/src/). The legal `ref` shown in the UI ties each transition to a specific clause in NĐ 06/2021, NĐ 10/2021, or related rules.

## 1. RFI — Request for Information

**Anchor:** NĐ 06/2021/NĐ-CP Điều 19 — Nhà thầu có quyền yêu cầu CĐT/TVTK làm rõ thiết kế khi phát hiện chưa rõ ràng hoặc mâu thuẫn.

```
  ┌───────┐  Gửi YC  ┌───────┐  Trả lời  ┌───────────┐  Đóng  ┌────────┐
  │ DRAFT │ ───────► │  OPEN │ ────────► │ ANSWERED  │ ─────► │ CLOSED │
  └───────┘          └───┬───┘           └─────┬─────┘        └────────┘
       (NT)              │ Bác bỏ              │ Yêu cầu rõ thêm
                         ▼                      │
                    ┌──────────┐                ▼
                    │ REJECTED │            (back to OPEN)
                    └──────────┘
```

**Roles:** NT_CHINH | NT_PHU phát hành; TVTK | TVGS | CĐT trả lời.

## 2. Submittal — Vật liệu / shop drawing

**Anchor:** NĐ 06/2021 Điều 13 — kiểm soát vật liệu, sản phẩm, cấu kiện trước khi đưa vào sử dụng.

```
DRAFT → SUBMITTED → UNDER_REVIEW ─┬─ APPROVED              ─┐
                                  ├─ APPROVED_AS_NOTED      ├─→ CLOSED
                                  ├─ REVISE_RESUBMIT → DRAFT │
                                  └─ REJECTED              ─┘
```

## 3. NCR — Non-Conformance Report

**Anchor:** NĐ 06/2021 Điều 12 — quản lý sai khác chất lượng. TVGS phát hành khi phát hiện thi công không phù hợp với TKBVTC/QCVN/TCVN.

```
DRAFT → OPEN → ROOT_CAUSE → CAR_PROPOSED → CAR_APPROVED → RECTIFIED → VERIFIED → CLOSED
                                  ▲                              │
                                  └──────────────────────────────┘  (chưa đạt)
       │
       └─ REJECTED  (CĐT bác bỏ — không có cơ sở)
```

Mandatory guard: chuyển sang `RECTIFIED` yêu cầu kèm `photoEvidence[]`.

## 4. Punch list

```
OPEN → IN_PROGRESS → READY_FOR_INSPECTION ─┬─ ACCEPTED → CLOSED
                                            └─ REJECTED → IN_PROGRESS
```

Mandatory: `photoAfterUrl` để chuyển từ IN_PROGRESS → READY_FOR_INSPECTION.

## 5. Change Order

**Anchor:** NĐ 10/2021 quản lý chi phí + Luật Đấu thầu 2023.

```
DRAFT → ESTIMATING → SUBMITTED → CDT_REVIEW ─┬─ APPROVED → IMPLEMENTED → CLOSED
                                              └─ REJECTED                 → CLOSED
```

Submit phải có `costDeltaVnd`.

## 6. Acceptance — Nghiệm thu (3 levels)

**Anchor:** NĐ 06/2021 Điều 21, 22, 23.

| Cấp | Mã FSM | Chữ ký bắt buộc |
|---|---|---|
| Công việc xây dựng (Điều 21) | `CONG_VIEC` | TVGS + NT_CHINH |
| Giai đoạn / bộ phận (Điều 22) | `GIAI_DOAN` | CĐT + TVGS + NT_CHINH |
| Hoàn thành công trình (Điều 23) | `HOAN_THANH` | CĐT + TVGS + TV_THIET_KE + NT_CHINH |

```
DRAFT → SCHEDULED → IN_PROGRESS ─┬─ SIGNED → FINALIZED
                                 └─ REJECTED → REWORK → SCHEDULED
```

Transition `IN_PROGRESS → SIGNED` chạy guard `requiredSignoffsFor(level)` để đảm bảo đủ ma trận chữ ký theo cấp.

## 7. Progress Payment — Thanh toán giai đoạn

**Anchor:** NĐ 10/2021.

```
DRAFT → SUBMITTED → CDT_REVIEW ─┬─ APPROVED → PAID
                                 └─ RETURNED → DRAFT
```

VAT (8% NQ giảm hoặc 10%) + bảo lưu 5% tính tự động trong `computePayment()` ở [`packages/lib/src/vn.ts`](../packages/lib/src/vn.ts).

## Guard architecture

```ts
canTransition(workflow, fromState, toState, actor, payload)
  → { ok: true, transition } | { ok: false, error }
```

Three gates checked in order:
1. **Transition exists** — from/to pair defined in workflow.
2. **Role allowed** — `actor.orgRoles` ∩ `transition.allowedRoles` ≠ ∅.
3. **Domain guard** — runtime validation against `payload` (e.g. answer text non-empty for RFI → ANSWERED, photoEvidence present for NCR → RECTIFIED).

Each successful transition writes a row to `Transition` (audit log). `Acceptance.signoffs[]` carries chữ ký số cert serials for later HĐ pháp lý disputes.
