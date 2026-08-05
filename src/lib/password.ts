import bcrypt from "bcryptjs";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function makeReferralCode() {
  return `YY${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
