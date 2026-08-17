// Billing C4 — hạn mức gói cưỡng chế ở server + chữ ký VNPay khoá chặt.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startRelay } from "../relay/server.mjs";
import { createAuth, hashEntry } from "../relay/auth.mjs";
import { createMembers } from "../relay/members.mjs";
import { createStorage } from "../relay/storage.mjs";
import {
  buildCheckoutUrl,
  makeTxnRef,
  usernameFromTxnRef,
  verifyCallback,
  vnpaySign,
  // @ts-expect-error — module .mjs không có type declarations
} from "../relay/billing.mjs";
import type { WebSocketServer } from "ws";

let server: WebSocketServer;
let port: number;
let dir: string;
let tokens: Record<string, string> = {};

const api = (path: string, init?: RequestInit) =>
  fetch(`http://127.0.0.1:${port}${path}`, init);
const asUser = (user: string, extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${tokens[user]}`,
  ...extra,
});

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "webim-billing-"));
  writeFileSync(
    join(dir, "users.json"),
    JSON.stringify({
      users: [
        hashEntry("pw", { username: "freeuser", role: "editor" }),
        hashEntry("pw", { username: "quantri", role: "admin" }),
      ],
    }),
  );
  const auth = createAuth({
    usersPath: join(dir, "users.json"),
    accountsPath: join(dir, "accounts.json"),
    secret: "test-secret",
  });
  const members = createMembers({ path: join(dir, "memberships.json") });
  const storage = createStorage(join(dir, "data"));
  server = startRelay(0, { auth, members, storage }) as unknown as WebSocketServer;
  const httpServer = (server as unknown as { httpServer: import("node:http").Server })
    .httpServer;
  if (!httpServer.listening) {
    await new Promise((resolve) => httpServer.once("listening", resolve));
  }
  port = (httpServer.address() as { port: number }).port;
  for (const user of ["freeuser", "quantri"]) {
    const response = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: user, password: "pw" }),
    });
    tokens[user] = ((await response.json()) as { token: string }).token;
  }
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
});

describe("hạn mức gói Free", () => {
  it("free claim dự án đầu OK, dự án thứ hai bị 402 kèm lời nâng cấp", async () => {
    const first = await api("/projects/da1/claim", {
      method: "POST",
      headers: asUser("freeuser"),
    });
    expect(first.status).toBe(200);

    const second = await api("/projects/da2/claim", {
      method: "POST",
      headers: asUser("freeuser"),
    });
    expect(second.status).toBe(402);
    expect(((await second.json()) as { error: string }).error).toContain("Nâng cấp Team");
  });

  it("admin cấp Team tay → claim thêm được ngay; /billing/plan phản ánh đúng", async () => {
    const grant = await api("/auth/users/freeuser/plan", {
      method: "PUT",
      headers: asUser("quantri", { "Content-Type": "application/json" }),
      body: JSON.stringify({ plan: "team", months: 12 }),
    });
    expect(grant.status).toBe(200);

    const second = await api("/projects/da2/claim", {
      method: "POST",
      headers: asUser("freeuser"),
    });
    expect(second.status).toBe(200);

    const plan = (await (
      await api("/billing/plan", { headers: asUser("freeuser") })
    ).json()) as { plan: string; ownedProjects: number; vnpayReady: boolean };
    expect(plan.plan).toBe("team");
    expect(plan.ownedProjects).toBe(2);
    expect(plan.vnpayReady).toBe(false); // test env không có credential
  });

  it("checkout khi chưa cấu hình VNPay trả 501 có hướng dẫn, không bịa cổng giả", async () => {
    const checkout = await api("/billing/checkout", {
      method: "POST",
      headers: asUser("freeuser"),
    });
    expect(checkout.status).toBe(501);
    expect(((await checkout.json()) as { error: string }).error).toContain("VNPAY_TMN_CODE");
  });
});

describe("chữ ký VNPay", () => {
  const config = {
    tmnCode: "TESTCODE",
    hashSecret: "bimatthu",
    payUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    returnUrl: "https://app.webim.vn/api/billing/vnpay-return",
    teamPriceVnd: 4990000,
    teamMonths: 12,
  };

  it("URL checkout mang chữ ký verify lại được chính nó", () => {
    const url = new URL(
      buildCheckoutUrl(
        {
          username: "freeuser",
          amountVnd: config.teamPriceVnd,
          orderInfo: "WeBIM Team 12 thang",
          ipAddress: "1.2.3.4",
          createDate: "20260817120000",
          txnRef: makeTxnRef("freeuser", 1234567),
        },
        config,
      ),
    );
    const query = Object.fromEntries(url.searchParams);
    // return của VNPay sẽ kèm ResponseCode — mô phỏng giao dịch thành công
    const withResponse = { ...query, vnp_ResponseCode: "00" };
    delete (withResponse as Record<string, string>).vnp_SecureHash;
    const signed = {
      ...withResponse,
      vnp_SecureHash: vnpaySign(withResponse, config.hashSecret),
    };
    const verified = verifyCallback(signed, config);
    expect(verified.valid).toBe(true);
    expect(verified.success).toBe(true);
    expect(verified.amountVnd).toBe(config.teamPriceVnd);
  });

  it("đổi một tham số là chữ ký chết; ResponseCode khác 00 không thành công", () => {
    const params = {
      vnp_Amount: "499000000",
      vnp_TxnRef: "freeuserT123",
      vnp_ResponseCode: "00",
    };
    const good = { ...params, vnp_SecureHash: vnpaySign(params, config.hashSecret) };
    expect(verifyCallback(good, config).valid).toBe(true);

    const tampered = { ...good, vnp_Amount: "1" };
    expect(verifyCallback(tampered, config).valid).toBe(false);

    const cancelled = { ...params, vnp_ResponseCode: "24" };
    const cancelledSigned = {
      ...cancelled,
      vnp_SecureHash: vnpaySign(cancelled, config.hashSecret),
    };
    const verdict = verifyCallback(cancelledSigned, config);
    expect(verdict.valid).toBe(true);
    expect(verdict.success).toBe(false);
  });

  it("txnRef đối chiếu về đúng người mua qua danh sách tài khoản thật", () => {
    const ref = makeTxnRef("qa.thu-nghiem", 999);
    expect(usernameFromTxnRef(ref, ["sophie", "qa.thu-nghiem"])).toBe("qa.thu-nghiem");
    expect(usernameFromTxnRef(ref, ["sophie"])).toBeNull();
  });
});
