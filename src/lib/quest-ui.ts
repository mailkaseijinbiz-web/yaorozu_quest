// クエストUIの純ロジック（副作用なし・テスト対象）。
// db.ts / 各コンポーネントに散っていた「刻限ラベル」「難易度・所要時間フィルタ」
// 「距離表記」を、表示に依らない純関数として切り出す。streak.ts と同じ流儀。
// QUEST_TTL_MS（24h）は db に依存させず定数を再掲する（循環 import 回避）。
// -----------------------------------------------------------------------------

/** クエストの生成後寿命（db.ts の QUEST_TTL_MS と一致させること）。 */
export const QUEST_TTL_MS = 24 * 60 * 60 * 1000;

// ── 刻限（TTL）表示 ──────────────────────────────────────────────────────────

/** 残り寿命の切迫度。critical=残り30分未満 / urgent=残り2時間未満 / normal=それ以外。 */
export type TtlTier = 'normal' | 'urgent' | 'critical';

export interface TtlInfo {
  text: string; // 「残り3時間」「残り12分」
  tier: TtlTier;
  remainingMs: number;
}

/**
 * 未参加クエストの残り寿命を返す（期限切れ・createdAt 無しの旧データは null）。
 * 最小表示は「残り1分」（残り0分にはしない）。
 */
export function ttlInfo(createdAt: string | undefined, now: number): TtlInfo | null {
  if (!createdAt) return null;
  const remainingMs = new Date(createdAt).getTime() + QUEST_TTL_MS - now;
  if (remainingMs <= 0) return null;
  const hours = Math.floor(remainingMs / 3_600_000);
  // 期限切れ直前でも「残り0分」にしない（最小表示は残り1分）
  const minutes = Math.max(1, Math.ceil((remainingMs % 3_600_000) / 60_000));
  const tier: TtlTier =
    remainingMs < 30 * 60_000 ? 'critical' : remainingMs < 2 * 3_600_000 ? 'urgent' : 'normal';
  return {
    text: hours >= 1 ? `残り${hours}時間` : `残り${minutes}分`,
    tier,
    remainingMs,
  };
}

// ── 難易度フィルタ ────────────────────────────────────────────────────────────

/** 難易度の絞り込み選択（null=すべて）。difficultyLabel と同じバケット境界。 */
export type DiffSel = 1 | 2 | 3 | null;

/** クエストの難易度 d が選択 sel に合致するか（d<=1→1, d===2→2, d>=3→3）。 */
export function matchesDifficulty(d: number, sel: DiffSel): boolean {
  if (sel == null) return true;
  const bucket = d <= 1 ? 1 : d === 2 ? 2 : 3;
  return bucket === sel;
}

// ── 所要時間フィルタ ──────────────────────────────────────────────────────────

export type TimeSel = 'short' | 'mid' | 'long' | null;

/** 所要時間チップの定義（〜15分 / 〜30分 / 30分〜）。 */
export const TIME_FILTERS = [
  { key: 'short', label: '〜15分' }, // estMinutes <= 15
  { key: 'mid', label: '〜30分' }, //   16..30
  { key: 'long', label: '30分〜' }, //  > 30
] as const;

/** 所要時間 estMinutes が選択 sel に合致するか。 */
export function matchesEstTime(estMinutes: number, sel: TimeSel): boolean {
  if (sel == null) return true;
  if (sel === 'short') return estMinutes <= 15;
  if (sel === 'mid') return estMinutes > 15 && estMinutes <= 30;
  return estMinutes > 30;
}

// ── 距離表記 ──────────────────────────────────────────────────────────────────

/** 距離(km)を「999m」「1.2km」表記の {value, unit} に整形する。 */
export function formatKm(d: number): { value: string; unit: 'm' | 'km' } {
  // 先にメートルへ丸めてから単位を決める。0.9999km を「1000m」と誤表記しないため。
  const m = Math.round(d * 1000);
  return m < 1000
    ? { value: `${m}`, unit: 'm' }
    : { value: `${(m / 1000).toFixed(1)}`, unit: 'km' };
}
