// Thanh toán VNPay cho gói Team (C4, docs/KIEN-TRUC.md).
//
// VNPay là thanh toán MỘT LẦN: người dùng mua N tháng, planUntil lùi về
// free khi hết hạn — không có subscription phải huỷ, không có thẻ phải lưu.
//
// Luồng chuẩn VNPay (Pay v2.1.0):
//   1. POST /billing/checkout → dựng URL sang cổng VNPay (ký HMAC-SHA512
//      trên chuỗi tham số đã sort + url-encode).
//   2. Người dùng trả tiền trên trang VNPay.
//   3. VNPay gọi về hai đường: vnpay-return (trình duyệt người dùng, để
//      hiển thị) và vnpay-ipn (server-to-server, NGUỒN SỰ THẬT). Cả hai
//      đều phải verify chữ ký; chỉ IPN/return hợp lệ với ResponseCode 00
//      mới nâng gói — và nâng gói là idempotent (gọi trùng vô hại).
//
// Chưa có credential (VNPAY_TMN_CODE/VNPAY_HASH_SECRET) thì checkout trả
// 501 kèm hướng dẫn — không bịa ra một cổng giả.

import { createHmac } from "node:crypto";

export function vnpayConfig(env = process.env) {
  return {
    tmnCode: (env.VNPAY_TMN_CODE ?? "").trim(),
    hashSecret: (env.VNPAY_HASH_SECRET ?? "").trim(),
    // Sandbox mặc định — đổi sang cổng thật bằng env khi lên tiền thật.
    payUrl:
      (env.VNPAY_URL ?? "").trim() ||
      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    returnUrl:
      (env.VNPAY_RETURN_URL ?? "").trim() ||
      "https://app.webim.vn/api/billing/vnpay-return",
    teamPriceVnd: Number(env.WEBIM_TEAM_PRICE_VND ?? 4_990_000),
    teamMonths: Number(env.WEBIM_TEAM_MONTHS ?? 12),
  };
}

export function vnpayEnabled(config = vnpayConfig()) {
  return Boolean(config.tmnCode && config.hashSecret);
}

/**
 * Chuỗi ký của VNPay: sort key tăng dần, encode theo encodeURIComponent
 * nhưng khoảng trắng là '+', nối bằng '&'. Sai một ly ở đây là "Sai chữ
 * ký" ở cổng — nên tách thuần để test khoá chặt.
 */
export function vnpaySignData(params) {
  return Object.keys(params)
    .filter((key) => params[key] !== "" && params[key] !== undefined && params[key] !== null)
    .sort()
    .map(
      (key) =>
        `${key}=${encodeURIComponent(String(params[key])).replace(/%20/g, "+")}`,
    )
    .join("&");
}

export function vnpaySign(params, hashSecret) {
  return createHmac("sha512", hashSecret)
    .update(Buffer.from(vnpaySignData(params), "utf8"))
    .digest("hex");
}

/** URL sang cổng VNPay cho một đơn nâng gói. */
export function buildCheckoutUrl(
  { username, amountVnd, orderInfo, ipAddress, createDate, txnRef },
  config,
) {
  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: config.tmnCode,
    // VNPay tính theo đơn vị = VND × 100.
    vnp_Amount: String(Math.round(amountVnd * 100)),
    vnp_CurrCode: "VND",
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: "other",
    vnp_Locale: "vn",
    vnp_ReturnUrl: config.returnUrl,
    vnp_IpAddr: ipAddress,
    vnp_CreateDate: createDate,
  };
  const signed = vnpaySign(params, config.hashSecret);
  return `${config.payUrl}?${vnpaySignData(params)}&vnp_SecureHash=${signed}`;
}

/**
 * Verify một callback (return/IPN): chữ ký phải khớp trên MỌI tham số
 * vnp_* trừ chính vnp_SecureHash. Trả về {valid, success, txnRef, amountVnd}.
 */
export function verifyCallback(query, config) {
  const params = {};
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith("vnp_") && key !== "vnp_SecureHash" && key !== "vnp_SecureHashType") {
      params[key] = value;
    }
  }
  const expected = vnpaySign(params, config.hashSecret);
  const provided = String(query.vnp_SecureHash ?? "");
  const valid =
    expected.length === provided.length &&
    expected.toLowerCase() === provided.toLowerCase();
  return {
    valid,
    success: valid && query.vnp_ResponseCode === "00",
    txnRef: String(query.vnp_TxnRef ?? ""),
    amountVnd: Number(query.vnp_Amount ?? 0) / 100,
  };
}

/** txnRef mã hoá người mua + thời điểm — IPN chỉ cần txnRef là biết nâng ai. */
export function makeTxnRef(username, now = Date.now()) {
  // VNPay chỉ nhận [a-zA-Z0-9] cho TxnRef ở nhiều bản tích hợp — username
  // có dấu chấm/gạch nên mã hoá base36-safe: thay ký tự ngoài chữ-số bằng x.
  const safe = username.replace(/[^a-zA-Z0-9]/g, "x");
  return `${safe}T${now.toString(36)}`;
}

export function usernameFromTxnRef(txnRef, knownUsernames) {
  // txnRef không đảo ngược được một-một (x thay nhiều ký tự) — đối chiếu
  // danh sách tài khoản thật thay vì đoán.
  const prefix = txnRef.replace(/T[a-z0-9]+$/, "");
  return (
    knownUsernames.find(
      (candidate) => candidate.replace(/[^a-zA-Z0-9]/g, "x") === prefix,
    ) ?? null
  );
}
