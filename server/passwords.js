import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
// OWASP-listed scrypt work-factor combination: N=2^15, r=8, p=3.
const OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
export function passwordProblem(password) {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  )
    return "Use between 8 and 128 characters.";
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password))
    return "Include at least one uppercase letter and one number.";
  return null;
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, OPTIONS);
  return `scrypt$32768$8$3$${salt}$${key.toString("hex")}`;
}
export async function verifyPassword(password, stored) {
  if (typeof password !== "string" || password.length > 128 || !stored)
    return false;
  const [algorithm, n, r, p, salt, hex] = stored.split("$");
  if (
    algorithm !== "scrypt" ||
    !salt ||
    !hex ||
    +n !== OPTIONS.N ||
    +r !== OPTIONS.r ||
    +p !== OPTIONS.p
  )
    return false;
  const key = await scrypt(password, salt, 64, OPTIONS);
  const expected = Buffer.from(hex, "hex");
  return expected.length === key.length && timingSafeEqual(key, expected);
}
