// Số liệu sản phẩm từ audit log — activation phải đo đúng định nghĩa.

import { describe, expect, it } from "vitest";
// @ts-expect-error — module .mjs không có type declarations
import { summarizeEvents } from "../relay/audit.mjs";

const NOW = Date.parse("2026-08-17T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

describe("summarizeEvents", () => {
  it("đếm active users theo cửa sổ, bỏ login trượt khỏi active", () => {
    const summary = summarizeEvents(
      [
        { at: daysAgo(1), user: "an", action: "auth.login" },
        { at: daysAgo(2), user: "binh", action: "file.put" },
        { at: daysAgo(3), user: "tin.tac", action: "auth.login_failed" },
        { at: daysAgo(20), user: "cu", action: "auth.login" },
      ],
      NOW,
    );
    expect(summary.last7d.activeUsers).toBe(2); // an + binh, không tính tin.tac
    expect(summary.last30d.activeUsers).toBe(3); // + cu
    expect(summary.last7d.loginFailures).toBe(1);
  });

  it("activation: đăng ký rồi claim/nộp file trong 7 ngày mới tính", () => {
    const summary = summarizeEvents(
      [
        { at: daysAgo(10), user: "hoat.dong", action: "auth.register" },
        { at: daysAgo(8), user: "hoat.dong", action: "project.claim" },
        { at: daysAgo(10), user: "bo.di", action: "auth.register" },
        // bo.di quay lại claim sau 9 ngày — QUÁ cửa sổ 7 ngày
        { at: daysAgo(0.5), user: "bo.di", action: "project.claim" },
      ],
      NOW,
    );
    expect(summary.activation.registered30d).toBe(2);
    expect(summary.activation.activated).toBe(1);
    expect(summary.activation.rate).toBe(50);
  });

  it("không ai đăng ký → rate null, không chia cho 0", () => {
    expect(summarizeEvents([], NOW).activation.rate).toBeNull();
  });
});
