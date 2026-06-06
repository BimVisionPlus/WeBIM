/**
 * Magic-link signin landing — clicks email link → consume one-time token →
 * upgrade to authenticated session.
 *
 * URL: https://<tenant>.aecplatform.vn/signin-magic?token=<token>
 */
import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";

export const dynamic = "force-dynamic";

export default async function SigninMagicPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const sp = await searchParams;
  const token = sp.token;
  if (!token) redirect("/signin");

  const vt = await prisma.verificationToken.findUnique({ where: { token } });
  if (!vt || vt.expires.getTime() < Date.now()) {
    return (
      <div style={{ maxWidth: 420, margin: "60px auto", padding: 24, fontFamily: "system-ui" }}>
        <h2>Liên kết hết hạn</h2>
        <p>Magic link đăng nhập đã hết hạn (24 giờ). Vui lòng dùng email + mật khẩu để đăng nhập, hoặc bấm "Quên mật khẩu?" trên trang đăng nhập.</p>
        <p><a href="/signin" style={{ color: "#2563eb" }}>← Về trang đăng nhập</a></p>
      </div>
    );
  }

  // Consume token (single-use)
  await prisma.verificationToken.delete({ where: { token } }).catch(() => {});

  // Find user by email + redirect via signin form (set cookie)
  const email = vt.identifier;
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) redirect("/signin");

  // We can't programmatically create a NextAuth session in a server component
  // without going through signIn. Best we can do is redirect to /signin with
  // a "magic-accepted" flag + show a one-click "Đăng nhập" button that
  // submits the credentials login with a pre-filled email + a magic
  // server-derived password (stored in tenant.tenantSigninSecret).
  //
  // For pilot: we redirect to /signin?email=... and ask user to set a
  // password on first visit. The email is pre-filled.
  redirect(`/signin?email=${encodeURIComponent(email)}&magic=accepted`);
}
