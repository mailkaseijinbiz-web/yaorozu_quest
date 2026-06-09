// Web Push（VAPID）サーバ側ヘルパー。※サーバ専用（web-push は Node ランタイムで動作）。
// 購読の保存は Supabase テーブル push_subscriptions を優先、無効/失敗時はメモリ（単一インスタンス）にフォールバック。
import webpush, { type PushSubscription } from 'web-push';
import { getSupabaseAdmin, isSupabaseEnabled } from './supabase';
import { sendApnsToAll, isApnsConfigured } from './apns-server';

export { isApnsConfigured };

/** Web Push(VAPID) か APNs のいずれかが設定されているか。 */
export function isAnyPushConfigured(): boolean {
  return isPushConfigured() || isApnsConfigured();
}

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

/** VAPID 鍵が設定されているか。 */
export function isPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

// Supabase が無効/未作成のときのフォールバック（プロセス内のみ・サーバ再起動で消える）
const mem = new Map<string, PushSubscription>();

export async function saveSubscription(sub: PushSubscription): Promise<void> {
  if (!sub?.endpoint) return;
  if (isSupabaseEnabled()) {
    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        const { error } = await sb.from('push_subscriptions').upsert({ endpoint: sub.endpoint, subscription: sub }, { onConflict: 'endpoint' });
        if (!error) return;
      } catch { /* fall through */ }
    }
  }
  mem.set(sub.endpoint, sub);
}

async function listSubscriptions(): Promise<PushSubscription[]> {
  if (isSupabaseEnabled()) {
    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        const { data, error } = await sb.from('push_subscriptions').select('subscription');
        if (!error && data) return data.map((r) => (r as { subscription: PushSubscription }).subscription);
      } catch { /* fall through */ }
    }
  }
  return [...mem.values()];
}

async function removeSubscription(endpoint: string): Promise<void> {
  if (isSupabaseEnabled()) {
    const sb = getSupabaseAdmin();
    if (sb) { try { await sb.from('push_subscriptions').delete().eq('endpoint', endpoint); return; } catch { /* fall through */ } }
  }
  mem.delete(endpoint);
}

/** 登録済みの全端末へプッシュ送信（Web Push + iOS APNs）。失効した購読/トークンは削除する。 */
export async function sendToAll(payload: { title: string; body: string; url?: string }): Promise<{ sent: number; failed: number; total: number }> {
  let sent = 0, failed = 0, total = 0;

  // Web Push（VAPID 設定時）
  if (configure()) {
    const subs = await listSubscriptions();
    total += subs.length;
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(s, JSON.stringify(payload));
        sent++;
      } catch (e: unknown) {
        failed++;
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) await removeSubscription(s.endpoint);
      }
    }));
  }

  // iOS ネイティブ（APNs 設定時）
  if (isApnsConfigured()) {
    const a = await sendApnsToAll(payload);
    sent += a.sent;
    failed += a.failed;
    total += a.total;
  }

  return { sent, failed, total };
}
