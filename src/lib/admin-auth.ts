// 管理者認証（サーバー専用）。
// パスワードは process.env.ADMIN_PASSWORD で照合し、認証後は HttpOnly Cookie に
// 「検証可能なトークン」を発行する。セッションストア不要のステートレス方式。
// トークン = HMAC-SHA256(key = ADMIN_PASSWORD, msg = 固定文字列) なので、
// Cookie 値からパスワードは復元できず、サーバー側で env から再計算して照合できる。
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE = 'yaorozu_admin';
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8; // 8時間
const TOKEN_MESSAGE = 'yaorozu-admin-session-v1';

/** Cookie に格納する検証可能トークン。ADMIN_PASSWORD 未設定時は null（=ログイン不可・fail closed）。 */
export function adminToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return createHmac('sha256', pw).update(TOKEN_MESSAGE).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // 長さが違うと timingSafeEqual が例外を投げるため、先に長さで弾く。
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** 入力パスワードが正しいか（タイミング安全比較）。ADMIN_PASSWORD 未設定なら常に false。 */
export function verifyAdminPassword(input: unknown): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || typeof input !== 'string') return false;
  return safeEqual(input, pw);
}

/** リクエストの Cookie が有効な管理者セッションか。 */
export async function isAdminAuthed(): Promise<boolean> {
  const expected = adminToken();
  if (!expected) return false;
  const store = await cookies();
  const got = store.get(ADMIN_COOKIE)?.value;
  if (!got) return false;
  return safeEqual(got, expected);
}
