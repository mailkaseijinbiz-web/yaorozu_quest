// 歩行中の段階的ガイド（道案内の精霊の道中語り）
// -----------------------------------------------------------------------------
// クエスト進行中、目的地までの距離バンドを跨ぐたびに「残り距離の声かけ／土地の
// 実在豆知識／道中の観察ミッション」を決定論的にローテーションして語る。
// GPS のゆらぎでフキダシがチカチカしないよう、ステージは単調増加（後退しない）。
// 純関数のみ（タイマー・状態は MapTab 側が持つ）。
// -----------------------------------------------------------------------------

import { getTriviaNear } from '../data/tokyo-trivia';
import { pickWalkMissions } from '../data/walk-missions';

/**
 * 距離(km) → ステージ番号（大きいほど目的地に近い）。
 * 1km 未満は 1.0 / 0.6 / 0.3 / 0.1 の固定境界、1km 以上は 500m 刻み
 * （遠いクエストでも一定移動距離ごとに語りが入る）。
 */
export function guideStage(distKm: number): number {
  if (distKm < 0.1) return 100;
  if (distKm < 0.3) return 99;
  if (distKm < 0.6) return 98;
  if (distKm < 1.0) return 97;
  return Math.max(0, 96 - Math.floor((distKm - 1.0) / 0.5)); // 1.0-1.5km=96, 1.5-2.0=95, …
}

/**
 * 次に表示すべきステージ。同一ステップ中は後退させない（単調増加）。
 * 距離が取れないステップ（座標なし）は -1 のまま＝導入文だけを表示する。
 */
export function nextGuideStage(distKm: number | null, prev: number | null): number {
  if (distKm == null) return prev ?? -1;
  const s = guideStage(distKm);
  return prev == null ? s : Math.max(prev, s);
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function fmtDist(distKm: number): string {
  // 100m 単位へ丸めてから単位を決める。0.96–0.99km を「1000m」と誤表記しないため。
  const m = Math.max(100, Math.round((distKm * 1000) / 100) * 100);
  if (m >= 1000) return `${(Math.round(distKm * 10) / 10).toFixed(1)}km`;
  return `${m}m`;
}

// 残り距離の声かけ（決定論的に選択。寺社歩きの所作・歩く楽しみを織り込む）
const DISTANCE_LINES: ((d: string) => string)[] = [
  (d) => `残りおよそ${d}。よい調子じゃ。視線を上げて、街の音にも耳を傾けてみよ。`,
  (d) => `あと${d}ほど。参道に入ったら真ん中（正中）は神様の道。少し端を歩くのが粋じゃぞ。`,
  (d) => `残り${d}。急がずともよい。足の裏で坂の上り下り——土地の凸凹を感じながら参ろう。`,
  (d) => `あと${d}。一本裏の路地にも、昔ながらの暮らしの気配が残っておるぞ。寄り道も旅のうちじゃ。`,
];

export interface WalkGuideInput {
  questId: string;
  step: { id: string; title: string; spotId?: string };
  stage: number;
  distKm: number | null;
  user: { lat: number; lng: number };
  nonce?: number; // フキダシのタップで話題を次々に切り替えるための種（同一バンド内でも内容を変える）
}

/**
 * ステージ確定時に1回だけ呼んで、そのバンドの語りを合成する。同入力 → 同出力。
 * 内容: 到着間近 → 到着の声かけ / それ以外 → 距離・豆知識・観察ミッションのローテ。
 */
export function composeWalkGuide(input: WalkGuideInput): string {
  const { questId, step, stage, distKm, user, nonce = 0 } = input;

  // 目的地100m未満：写真に残して記録するよう促す。タップでの話題替え(nonce)時は通常ローテへ。
  if (nonce === 0 && stage >= 100) {
    return '目的地はもう目の前。写真に残して記録にしよう。';
  }
  if (nonce === 0 && stage === 99) {
    return '間もなく到着じゃ。鳥居や門が見えたら、一度立ち止まって全体の姿を眺めてみよ。';
  }

  const seed = hash(`${questId}:${step.id}:${stage}:${nonce}`);
  const kind = (['distance', 'trivia', 'mission'] as const)[seed % 3];

  if (kind === 'trivia') {
    // 現在地の近傍にある実在豆知識（半径1.5km）。無ければ距離の声かけに縮退
    const near = getTriviaNear(user.lat, user.lng, 1.5, 5);
    if (near.length > 0) {
      const t = near[seed % near.length];
      return `道すがらにひとつ。${clip(t.body, 130)}`;
    }
  } else if (kind === 'mission') {
    // 道中の観察ミッション（街の見方）
    const m = pickWalkMissions(step.spotId ?? step.id, '', stage, 1, ['street'])[0];
    if (m) return `歩きながらの遊びじゃ。${m.action}`;
  }

  // distance（および縮退時）
  const d = distKm != null ? fmtDist(distKm) : 'わずか';
  return DISTANCE_LINES[seed % DISTANCE_LINES.length](d);
}
