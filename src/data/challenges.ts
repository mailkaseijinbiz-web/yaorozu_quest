// クエスト（タスクが連なったミニチャレンジ）データ
// -----------------------------------------------------------------------------
// 複数のタスク（ミッション）を順にこなしてゴールを目指す。各タスクには「次どう
// すれば良いか」と町歩きの蘊蓄（地形・歴史・建築・道路）が含まれる。写真ミッション
// もある。達成するとバッジがもらえる。難易度は3段階。
// 型は ./tasks.ts に統合。Challenge / ChallengeStep は Quest / Task のエイリアス。
// -----------------------------------------------------------------------------

import { questStep, type Quest, type TriviaCategory } from './tasks';

// ── 後方互換エイリアス ──
export type { Quest, Task, TriviaCategory } from './tasks';
export type Challenge = Quest;
export type ChallengeStep = import('./tasks').Task;

export function difficultyLabel(d: number): { label: string; stars: string; tone: string; text: string } {
  if (d <= 1) return { label: 'やさしい', stars: '★☆☆', tone: 'text-emerald-600 bg-emerald-50 border-emerald-200', text: 'text-emerald-600' };
  if (d === 2) return { label: 'ふつう', stars: '★★☆', tone: 'text-amber-600 bg-amber-50 border-amber-200', text: 'text-amber-600' };
  return { label: 'むずかしい', stars: '★★★', tone: 'text-rose-600 bg-rose-50 border-rose-200', text: 'text-rose-600' };
}

// 地形(Terrain)＝その場まで「どれだけ歩くか・起伏」。Geocaching の T 相当。
// 「今日は散歩 / しっかり歩く」を選ぶ目安として、場の terrain(1-5) をラベル化する。
export function terrainLabel(t: number): { label: string; level: number; tone: string } {
  const lv = Math.max(1, Math.min(5, Math.round(t || 1)));
  if (lv <= 2) return { label: lv === 1 ? '平坦' : 'ゆるやか', level: lv, tone: 'text-emerald-700 bg-emerald-50' };
  if (lv <= 4) return { label: lv === 3 ? '坂道あり' : '起伏あり', level: lv, tone: 'text-amber-700 bg-amber-50' };
  return { label: '険しい', level: lv, tone: 'text-rose-700 bg-rose-50' };
}

export const TRIVIA_TONE: Record<TriviaCategory, string> = {
  地形: 'text-teal-700 bg-teal-50 border-teal-200',
  歴史: 'text-amber-700 bg-amber-50 border-amber-200',
  建築: 'text-violet-700 bg-violet-50 border-violet-200',
  道路: 'text-sky-700 bg-sky-50 border-sky-200',
};

export const TRIVIA_ICON: Record<TriviaCategory, string> = {
  地形: '⛰️',
  歴史: '📜',
  建築: '🏛️',
  道路: '🛣️',
};

// リセット済み — 管理画面から神を追加するとクエストが生成されます
export const CHALLENGES: Quest[] = [];

export function getChallenge(id: string): Quest | undefined {
  return CHALLENGES.find((c) => c.id === id);
}
