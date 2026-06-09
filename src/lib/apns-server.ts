// APNs（Apple Push Notification service）サーバ側ヘルパー。※サーバ専用（node:http2 / node:crypto）。
// iOS ネイティブアプリ(Capacitor)のデバイストークン宛に、.p8 認証キーで署名した JWT を使って
// HTTP/2 で直接プッシュを送る（Firebase 不要）。
//
// 必要な環境変数:
//   APNS_KEY_ID      … APNs 認証キー(.p8)の Key ID
//   APNS_TEAM_ID     … Apple Team ID（例: 576D2UUHH5）
//   APNS_BUNDLE_ID   … アプリのバンドルID（apns-topic。例: biz.kaseijin.yaorozu）
//   APNS_PRIVATE_KEY … .p8 ファイルの中身（PKCS#8 PEM。改行は実改行 or \n エスケープ可）
//   APNS_PRODUCTION  … 'true' で本番(api.push.apple.com)。未設定/その他は Sandbox。
import http2 from 'node:http2';
import crypto from 'node:crypto';
import { getSupabaseAdmin, isSupabaseEnabled } from './supabase';

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** APNs 送信に必要な環境変数が揃っているか。 */
export function isApnsConfigured(): boolean {
  return !!(
    process.env.APNS_KEY_ID &&
    process.env.APNS_TEAM_ID &&
    process.env.APNS_BUNDLE_ID &&
    process.env.APNS_PRIVATE_KEY
  );
}

function apnsHost(): string {
  return process.env.APNS_PRODUCTION === 'true' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
}

// APNs 用 JWT は最大1時間有効。署名コストを避けるため ~50 分キャッシュする。
let cachedJwt = '';
let cachedAt = 0;
function getProviderToken(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedAt < 50 * 60) return cachedJwt;
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: process.env.APNS_KEY_ID }));
  const claims = b64url(JSON.stringify({ iss: process.env.APNS_TEAM_ID, iat: now }));
  const signingInput = `${header}.${claims}`;
  const key = (process.env.APNS_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  // ES256: EC P-256 + SHA-256。JWT は DER ではなく P1363(R||S) 形式の署名を要求する。
  const signature = crypto.sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' });
  cachedJwt = `${signingInput}.${b64url(signature)}`;
  cachedAt = now;
  return cachedJwt;
}

// Supabase テーブル apns_tokens を優先。無効/失敗時はメモリ（単一インスタンス）にフォールバック。
const mem = new Set<string>();

export async function saveApnsToken(token: string): Promise<void> {
  if (!token) return;
  if (isSupabaseEnabled()) {
    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        const { error } = await sb.from('apns_tokens').upsert({ token }, { onConflict: 'token' });
        if (!error) return;
      } catch { /* fall through */ }
    }
  }
  mem.add(token);
}

async function listApnsTokens(): Promise<string[]> {
  if (isSupabaseEnabled()) {
    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        const { data, error } = await sb.from('apns_tokens').select('token');
        if (!error && data) return data.map((r) => (r as { token: string }).token);
      } catch { /* fall through */ }
    }
  }
  return [...mem];
}

async function removeApnsToken(token: string): Promise<void> {
  if (isSupabaseEnabled()) {
    const sb = getSupabaseAdmin();
    if (sb) { try { await sb.from('apns_tokens').delete().eq('token', token); return; } catch { /* fall through */ } }
  }
  mem.delete(token);
}

/** 登録済みの全 iOS 端末へ APNs プッシュを送信。失効トークン(410/BadDeviceToken)は削除する。 */
export async function sendApnsToAll(payload: { title: string; body: string; url?: string }): Promise<{ sent: number; failed: number; total: number }> {
  if (!isApnsConfigured()) return { sent: 0, failed: 0, total: 0 };
  const tokens = await listApnsTokens();
  if (tokens.length === 0) return { sent: 0, failed: 0, total: 0 };

  let providerToken: string;
  try {
    providerToken = getProviderToken();
  } catch {
    return { sent: 0, failed: tokens.length, total: tokens.length };
  }

  const body = JSON.stringify({
    aps: { alert: { title: payload.title, body: payload.body }, sound: 'default' },
    url: payload.url || '/',
  });

  const client = http2.connect(`https://${apnsHost()}`);
  let sent = 0;
  let failed = 0;

  await new Promise<void>((resolveAll) => {
    client.on('error', () => resolveAll());
    const tasks = tokens.map((token) => new Promise<void>((res) => {
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        authorization: `bearer ${providerToken}`,
        'apns-topic': process.env.APNS_BUNDLE_ID as string,
        'apns-push-type': 'alert',
        'apns-priority': '10',
      });
      let status = 0;
      let data = '';
      req.setEncoding('utf8');
      req.on('response', (h) => { status = Number(h[':status']) || 0; });
      req.on('data', (d) => { data += d; });
      req.on('end', () => {
        if (status === 200) {
          sent++;
        } else {
          failed++;
          if (status === 410 || /BadDeviceToken|Unregistered/.test(data)) void removeApnsToken(token);
        }
        res();
      });
      req.on('error', () => { failed++; res(); });
      req.end(body);
    }));
    Promise.all(tasks).then(() => resolveAll());
  });

  try { client.close(); } catch { /* ignore */ }
  return { sent, failed, total: tokens.length };
}
