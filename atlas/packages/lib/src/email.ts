/**
 * Transactional email sender. Resend when RESEND_API_KEY is set, otherwise
 * SMTP via nodemailer if AUTH_EMAIL_SERVER is set, otherwise log-and-skip
 * (dev mode).
 *
 * Keep templates inline + simple — no templating engine. We send VN-text.
 */

import { logger } from "./log";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

async function sendViaResend(args: SendArgs) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Atlas AEC <no-reply@atlas-aec.vn>",
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });
  if (!res.ok) {
    logger().error({ status: res.status, body: await res.text() }, "email.resend_failed");
    return false;
  }
  return true;
}

async function sendViaSmtp(args: SendArgs) {
  const url = process.env.AUTH_EMAIL_SERVER;
  if (!url) return false;
  try {
    // nodemailer is optional.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodemailer = require("nodemailer");
    const transport = nodemailer.createTransport(url);
    await transport.sendMail({
      from: process.env.EMAIL_FROM ?? "Atlas AEC <no-reply@atlas-aec.vn>",
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    return true;
  } catch (err) {
    logger().error({ err }, "email.smtp_failed");
    return false;
  }
}

export async function sendEmail(args: SendArgs): Promise<{ ok: boolean; transport: string }> {
  if (await sendViaResend(args)) return { ok: true, transport: "resend" };
  if (await sendViaSmtp(args)) return { ok: true, transport: "smtp" };
  // Dev fallback: log to console so devs can copy magic links from the terminal.
  logger().info({ to: args.to, subject: args.subject, html: args.html }, "email.dev_logged");
  return { ok: process.env.NODE_ENV !== "production", transport: "log" };
}

// ─── Templates ──────────────────────────────────────────────────────────────

export function tplInvite(args: { orgName: string; inviterName: string; link: string; role: string }) {
  return {
    subject: `${args.inviterName} mời bạn tham gia ${args.orgName} trên Atlas AEC`,
    html: `<div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="color: #0f172a;">Lời mời tham gia ${escape(args.orgName)}</h2>
      <p>${escape(args.inviterName)} đã mời bạn tham gia <strong>${escape(args.orgName)}</strong> với vai trò <strong>${escape(args.role)}</strong> trên Atlas AEC — nền tảng quản lý dự án xây dựng.</p>
      <p style="margin: 24px 0;">
        <a href="${args.link}" style="background:#2563eb; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none; display:inline-block;">Chấp nhận lời mời</a>
      </p>
      <p style="color:#64748b; font-size:13px;">Liên kết có hiệu lực trong 7 ngày. Nếu bạn không mong đợi lời mời này, có thể bỏ qua email.</p>
    </div>`,
    text: `${args.inviterName} mời bạn tham gia ${args.orgName} với vai trò ${args.role}.\n\nChấp nhận: ${args.link}\n\nLiên kết có hiệu lực 7 ngày.`,
  };
}

export function tplResetPassword(args: { link: string }) {
  return {
    subject: "Đặt lại mật khẩu Atlas AEC",
    html: `<div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h2>Đặt lại mật khẩu</h2>
      <p>Bạn đã yêu cầu đặt lại mật khẩu. Liên kết dưới đây có hiệu lực trong 30 phút:</p>
      <p style="margin:24px 0;"><a href="${args.link}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Đặt lại mật khẩu</a></p>
      <p style="color:#64748b;font-size:13px;">Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
    </div>`,
    text: `Đặt lại mật khẩu Atlas AEC: ${args.link}\nHiệu lực 30 phút.`,
  };
}

export function tplVerifyEmail(args: { name: string; link: string }) {
  return {
    subject: "Xác minh email Atlas AEC",
    html: `<div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h2>Xin chào ${escape(args.name)},</h2>
      <p>Cảm ơn bạn đã đăng ký Atlas AEC. Vui lòng xác minh email để mở khóa toàn bộ tính năng:</p>
      <p style="margin: 24px 0;">
        <a href="${args.link}" style="background:#2563eb; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none; display:inline-block;">Xác minh email</a>
      </p>
      <p style="color:#64748b; font-size:13px;">Liên kết có hiệu lực trong 24 giờ. Nếu bạn không đăng ký tài khoản này, có thể bỏ qua email.</p>
    </div>`,
    text: `Xác minh email Atlas AEC: ${args.link}\nHiệu lực 24 giờ.`,
  };
}

export function tplWaitlistConfirm(args: { name?: string }) {
  return {
    subject: "Atlas AEC — Đã ghi nhận đăng ký pilot",
    html: `<div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h2>Cảm ơn ${args.name ? escape(args.name) : "bạn"}!</h2>
      <p>Đội Atlas AEC đã ghi nhận đăng ký pilot của bạn. Chúng tôi sẽ liên hệ sớm để demo và mở tài khoản tổ chức.</p>
    </div>`,
    text: `Đã ghi nhận đăng ký pilot Atlas AEC. Chúng tôi sẽ liên hệ sớm.`,
  };
}

function escape(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
