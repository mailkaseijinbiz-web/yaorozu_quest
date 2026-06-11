// ルールベースのクエスト生成（AIフォールバック）
// -----------------------------------------------------------------------------
// AIキーが無い環境・AI失敗時でも「町歩きが楽しい」クエストを返す。
// 観察ミッションカタログ（walk-missions）と実在豆知識（tokyo-trivia）から
// 決定論的に組み立てる（同じ spot.id → 同じクエスト構成、クエスト番号で変化）。
// 構成: 道中の観察（visit）→ 境内の発見（discover/photo）→ 価値の記録（photo/review）
//       → 世界の値を動かす操作（resolveIssue/sns）。
// 純関数のみ。サーバ（route）・クライアント・テストのどこからでも使える。
// -----------------------------------------------------------------------------

import { TASK_CATALOG, type Task, type TaskType, type Quest } from '../data/tasks';
import { pickWalkMissions, type WalkScope } from '../data/walk-missions';
import { getTriviaNear, THEME_TO_CATEGORY } from '../data/tokyo-trivia';

/** route.ts の SpotInput と構造互換の最小入力 */
export interface FallbackSpotInput {
  id?: string;
  name: string;
  category: string;
  description?: string;
  enjoyments?: string[];
  issues?: string[];
  latitude?: number;
  longitude?: number;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** 境内系ミッションの適用範囲（道中 street を除いたもの） */
function precinctScopes(category: string): WalkScope[] {
  if (category.includes('神社')) return ['shrine', 'precinct'];
  if (category.includes('寺')) return ['temple', 'precinct'];
  return ['precinct'];
}

export function buildFallbackQuest(spot: FallbackSpotInput, count: number, ts: number): Quest[] {
  const enjoy = spot.enjoyments ?? [];
  const seed = spot.id ?? spot.name;
  const at = () => (spot.latitude != null && spot.longitude != null ? { lat: spot.latitude, lng: spot.longitude } : {});
  const mk = (type: TaskType, i: number, over: Partial<Task> = {}): Task => {
    const c = TASK_CATALOG[type];
    return { id: `s${i}`, type, kind: c.kind, icon: c.icon, label: c.label, title: c.title, reward: c.reward, spotId: spot.id, ...over };
  };

  // 近傍の実在豆知識（あれば道中タスクの蘊蓄に最優先で使う）
  const nearTrivia =
    spot.latitude != null && spot.longitude != null ? getTriviaNear(spot.latitude, spot.longitude, 4, count) : [];

  const quests: Quest[] = [];
  for (let n = 0; n < count; n++) {
    const enjoyment = enjoy.length ? enjoy[n % enjoy.length] : '';
    // 道中1 + 境内1 の観察ミッションを決定論的に選ぶ
    const street = pickWalkMissions(seed, spot.category, n * 2, 1, ['street'])[0];
    const precinct = pickWalkMissions(seed, spot.category, n * 2 + 1, 1, precinctScopes(spot.category))[0];
    const near = nearTrivia[n];

    const tasks: Task[] = [
      // 道中: 歩きながらの観察。蘊蓄は土地の実在豆知識を優先
      mk('visit', 0, {
        title: clip(`${spot.name}へ歩く`, 40),
        action: street.action,
        trivia: near ? clip(near.body, 140) : street.trivia,
        triviaCategory: near ? (THEME_TO_CATEGORY[near.themes[0]] ?? '歴史') : street.triviaCategory,
        ...at(),
      }),
      // 境内: 狛犬・ご神木・年号などの発見ミッション
      mk(precinct.photo ? 'photo' : 'discover', 1, {
        title: precinct.title,
        action: precinct.action,
        trivia: precinct.trivia,
        triviaCategory: precinct.triviaCategory,
        photo: precinct.photo,
        ...(precinct.photo ? at() : {}),
      }),
      // 記録: 価値の一枚 or 気づきの言伝て
      enjoyment
        ? mk('photo', 2, { title: clip(`「${enjoyment}」を一枚に`, 40), action: `${enjoyment}を、あなたの目線で写真に収めよう。`, ...at() })
        : mk('review', 2, { action: `${spot.name}で観察して気づいたことを、後から来る巡礼者へ言伝てよう。` }),
      // 結び: 目的地に着いたら感謝を捧げる（課題の解決・SNS投稿はフローに含めない）
      mk('gratitude', 3, { title: clip(`${spot.name}に祈る`, 40), action: `${spot.name}に着いたら、心をしずめてひとつ感謝を捧げよう。`, ...at() }),
    ];

    quests.push({
      id: `uq-${spot.id || 'spot'}-${ts}-${n}`,
      spotId: spot.id,
      title: clip(enjoyment ? `${spot.name}・${enjoyment}の巡礼` : `${spot.name}・${precinct.title}`, 40),
      description: clip(`${spot.name}までの道中と境内に観察の楽しみを仕掛けた町歩き。歩くほどに、この土地の物語が見えてくる。`, 160),
      difficulty: 1,
      minLevel: 1,
      estMinutes: 25,
      badgeIcon: spot.category === '神社' ? '⛩️' : '🏮',
      badgeName: `${spot.name}の巡礼者`,
      goalName: spot.name,
      goalLat: spot.latitude ?? 0,
      goalLng: spot.longitude ?? 0,
      tasks,
      source: 'generated',
    });
  }
  return quests;
}
