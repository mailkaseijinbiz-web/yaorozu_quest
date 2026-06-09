// クラウド同期（snapshot 方式）。
// localStorage の「ユーザー生成データ」キーだけを /api/persist 経由で
// Supabase に保存・復元する。鍵未設定時はサーバーが enabled:false を返し no-op。

// 同期対象キー（全データをサーバー管理）
const SYNC_KEYS = [
  // ユーザー・プレイデータ
  'yaorozu_users',
  'yaorozu_ugc',
  'yaorozu_user_stats',
  'yaorozu_challenge_progress',
  'yaorozu_challenge_photos',
  'yaorozu_challenge_comments',
  'yaorozu_activities',
  'yaorozu_goshuin_user-self',
  // 管理者が作成するコンテンツ
  'yaorozu_spots_v4',
  'yaorozu_agents_v2',
  'yaorozu_quests_v2',
  // ルール・設定
  'yaorozu_quest_rules',
  'yaorozu_spot_rules',
  'yaorozu_system_role',
  'yaorozu_dainichi_identity',
  // API監視・認証
  'yaorozu_api_calls',
  'yaorozu_revoked_users',
  // 人間の煩悩（覚りの調整素材）
  'yaorozu_bonnou',
  // アプリ設定
  'yaorozu_app_settings',
];

// スナップショットID。未ログインは 'user-self'、OAuth ログイン中は認証ユーザーIDに切り替える。
let SNAPSHOT_ID = 'user-self';

/** 同期対象ユーザー（クラウドスナップショットの分離キー）を設定する。認証ログイン/ログアウト時に呼ぶ。 */
export function setSyncUser(id: string | null): void {
  SNAPSHOT_ID = id || 'user-self';
}

let cloudEnabled: boolean | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let suspendPush = false; // pull適用中の自己発火を防ぐ

/** クラウド同期が有効か（null=未確認、true/false=判明済み）。System タブの表示用。 */
export function isCloudEnabled(): boolean | null {
  return cloudEnabled;
}

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
      if (!(key in json.data) || json.data[key] == null) continue;
      const v = json.data[key];
      // 空（または非配列）のユーザーリストでローカルを上書きしない。
      // user-self を失うと currentUser が null になりマイページが空白化するため。
      if (key === 'yaorozu_users' && (!Array.isArray(v) || v.length === 0)) continue;
      localStorage.setItem(key, JSON.stringify(v));
      applied = true;
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
    if (raw == null) continue;
    try {
      const parsed = JSON.parse(raw);
      // 空のユーザーリストはクラウドへ送らない（退化状態が同期で伝播するのを防ぐ）
      if (key === 'yaorozu_users' && (!Array.isArray(parsed) || parsed.length === 0)) continue;
      data[key] = parsed;
    } catch { /* skip */ }
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
