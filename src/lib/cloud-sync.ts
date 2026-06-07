// クラウド同期（snapshot 方式）。
// localStorage の「ユーザー生成データ」キーだけを /api/persist 経由で
// Supabase に保存・復元する。鍵未設定時はサーバーが enabled:false を返し no-op。

// 同期対象キー（生成シードの SPOTS/AGENTS など重いものは除外）
const SYNC_KEYS = [
  'yaorozu_users',
  'yaorozu_ugc',
  'yaorozu_user_stats',
  'yaorozu_challenge_progress',
  'yaorozu_challenge_photos',
];

// 単一ユーザーデモのためスナップショットIDは固定。将来は認証ユーザーIDに。
const SNAPSHOT_ID = 'user-self';

let cloudEnabled: boolean | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let suspendPush = false; // pull適用中の自己発火を防ぐ

/** 起動時：クラウドのスナップショットを localStorage へ復元。適用したら true。 */
export async function pullSnapshot(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const res = await fetch(`/api/persist?userId=${encodeURIComponent(SNAPSHOT_ID)}`, { cache: 'no-store' });
    const json = await res.json();
    cloudEnabled = !!json.enabled;
    if (!json.enabled || !json.data) return false;

    suspendPush = true;
    let applied = false;
    for (const key of SYNC_KEYS) {
      if (key in json.data && json.data[key] != null) {
        localStorage.setItem(key, JSON.stringify(json.data[key]));
        applied = true;
      }
    }
    suspendPush = false;
    return applied;
  } catch {
    cloudEnabled = false;
    return false;
  }
}

/** localStorage の対象キーをまとめてクラウドへ保存（デバウンス）。 */
export function schedulePush(): void {
  if (typeof window === 'undefined' || suspendPush) return;
  if (cloudEnabled === false) return; // 無効と判明済みなら何もしない
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 1500);
}

async function pushNow(): Promise<void> {
  if (typeof window === 'undefined') return;
  const data: Record<string, unknown> = {};
  for (const key of SYNC_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw != null) {
      try { data[key] = JSON.parse(raw); } catch { /* skip */ }
    }
  }
  try {
    const res = await fetch('/api/persist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: SNAPSHOT_ID, data }),
    });
    const json = await res.json();
    cloudEnabled = !!json.enabled;
  } catch {
    /* オフライン等は次回に委ねる */
  }
}
