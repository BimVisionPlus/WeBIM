import { hash, compare } from "bcryptjs";

const ROUNDS = 12;

/** Minimum policy: 8 chars, 1 letter + 1 digit. */
export function validatePasswordStrength(pw: string): { ok: true } | { ok: false; error: string } {
  if (pw.length < 8) return { ok: false, error: "Mật khẩu cần tối thiểu 8 ký tự" };
  if (pw.length > 200) return { ok: false, error: "Mật khẩu quá dài" };
  if (!/[A-Za-z]/.test(pw)) return { ok: false, error: "Mật khẩu cần ít nhất 1 chữ cái" };
  if (!/\d/.test(pw)) return { ok: false, error: "Mật khẩu cần ít nhất 1 chữ số" };
  return { ok: true };
}

export function hashPassword(pw: string) {
  return hash(pw, ROUNDS);
}

export function verifyPassword(pw: string, hashStr: string) {
  return compare(pw, hashStr);
}
