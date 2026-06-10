// 生成クエストの蘊蓄（トリビア）バックフィル
// -----------------------------------------------------------------------------
// AI 生成が trivia を返さなかったタスクへ、ローカルの蘊蓄データベースから補完する。
// 関連の薄い蘊蓄を無理に出さないため、
//   (a) 蘊蓄DB（db.getTrivia）: area 文字列がスポット名・説明に含まれるもの
//   (b) TOKYO_TRIVIA: スポット座標から 5km 以内のもの
// の順に集め、候補が無ければ何もしない（達成カードは既存の定型文に自然フォールバック）。
// 保存前に1箇所（page.tsx の saveGeneratedQuests 直前）で通すと、AI 生成・ルールベース
// fallback の両経路がカバーされる。
// -----------------------------------------------------------------------------

import { db } from './db';
import { distanceKm } from './geo';
import { TOKYO_TRIVIA, type TriviaTheme } from '../data/tokyo-trivia';
import type { Quest, TriviaCategory } from '../data/tasks';

interface TriviaCandidate {
  content: string;
  category: TriviaCategory;
}

/** TOKYO_TRIVIA のテーマ軸を Task.triviaCategory（地形/歴史/建築/道路）へ寄せる */
const THEME_TO_CATEGORY: Record<TriviaTheme, TriviaCategory> = {
  '地形・スリバチ': '地形',
  '暗渠・川跡': '地形',
  坂道: '道路',
  歴史: '歴史',
  路地裏: '道路',
  '地名の由来': '歴史',
  '建築・遺構': '建築',
  ウォーキングコース: '道路',
};

/** 表示幅に収まるよう蘊蓄を短縮（達成カードは1〜2文想定） */
function clip(text: string): string {
  const t = text.trim();
  return t.length > 140 ? `${t.slice(0, 139)}…` : t;
}

interface SpotLike {
  name: string;
  description?: string;
  latitude?: number;
  longitude?: number;
}

/** スポットに関連する蘊蓄候補を集める（area 一致 → 座標近傍の順） */
function collectCandidates(spot: SpotLike): TriviaCandidate[] {
  const out: TriviaCandidate[] = [];
  const text = `${spot.name} ${spot.description ?? ''}`;
  for (const t of db.getTrivia()) {
    if (t.area && text.includes(t.area)) out.push({ content: clip(t.content), category: t.category });
  }
  if (spot.latitude != null && spot.longitude != null) {
    for (const t of TOKYO_TRIVIA) {
      if (
        t.latitude != null &&
        t.longitude != null &&
        distanceKm(spot.latitude, spot.longitude, t.latitude, t.longitude) <= 5
      ) {
        out.push({ content: clip(t.body), category: THEME_TO_CATEGORY[t.themes[0]] ?? '歴史' });
      }
    }
  }
  return out;
}

/** trivia が空のタスクへ候補を順繰りに割り当てる。候補が無ければ quests をそのまま返す。 */
export function backfillTrivia(quests: Quest[], spot: SpotLike): Quest[] {
  const candidates = collectCandidates(spot);
  if (candidates.length === 0) return quests;
  let i = 0;
  return quests.map((q) => ({
    ...q,
    tasks: q.tasks.map((t) => {
      if (t.trivia) return t;
      const c = candidates[i % candidates.length];
      i += 1;
      return { ...t, trivia: c.content, triviaCategory: c.category };
    }),
  }));
}
