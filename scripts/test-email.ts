/**
 * Send one test email to verify the transactional pipeline works end-to-end.
 *
 *   TO=you@your-domain.vn pnpm exec tsx scripts/test-email.ts
 *
 * Output:
 *   • transport=resend  → great, Resend is wired
 *   • transport=smtp    → great, SMTP fallback is wired
 *   • transport=log     → no provider configured; check the console for the
 *                         rendered HTML and set RESEND_API_KEY or AUTH_EMAIL_SERVER
 */

import { sendEmail } from "@atlas/lib";

async function main() {
  const to = process.env.TO;
  if (!to) {
    console.error("Set TO=<email-address> first.");
    process.exit(2);
  }
  const r = await sendEmail({
    to,
    subject: "Atlas AEC — kiểm tra cấu hình email",
    html: `<div style="font-family: -apple-system, system-ui, sans-serif; padding: 24px;">
      <h2>Email pipeline đang hoạt động ✓</h2>
      <p>Đây là email thử do <code>scripts/test-email.ts</code> gửi lúc ${new Date().toISOString()}.</p>
      <p>Provider: <code>${process.env.RESEND_API_KEY ? "Resend" : process.env.AUTH_EMAIL_SERVER ? "SMTP" : "(log fallback)"}</code></p>
    </div>`,
    text: `Atlas AEC — email test sent ${new Date().toISOString()}`,
  });
  console.log(JSON.stringify(r, null, 2));
  if (!r.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
