// クエスト（タスクが連なったミニチャレンジ）データ
// -----------------------------------------------------------------------------
// 複数のタスク（ミッション）を順にこなしてゴールを目指す。各タスクには「次どう
// すれば良いか」と町歩きの蘊蓄（地形・歴史・建築・道路）が含まれる。写真ミッション
// もある。達成するとバッジがもらえる。難易度は3段階。
// 型は ./tasks.ts に統合。Challenge / ChallengeStep は Quest / Task のエイリアス。
// -----------------------------------------------------------------------------

import { questStep, TASK_CATALOG, type Quest, type TriviaCategory } from './tasks';

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

// ── 移動をともなわないクエスト（バリエーション） ──
// アバター画像を設定するだけのクエスト。場所に紐づかず、いつでもどこでも達成できる。
// getAllQuests() には混ぜず（場の自動生成判定を壊さない）、表示・開始は UI 側で個別に扱う。
export const AVATAR_QUEST: Quest = {
  id: 'avatar-self',
  title: 'あなたの分身をつくる',
  description: '巡礼の相棒となるアバター画像を設定しよう。場所は問わない、いつでもどこでも。',
  difficulty: 1,
  minLevel: 0,
  estMinutes: 1,
  badgeIcon: '🤳',
  badgeName: 'アバター設定者',
  goalName: 'アバター設定',
  goalLat: 0,
  goalLng: 0,
  tasks: [
    {
      id: 's0',
      type: 'avatar_photo',
      kind: TASK_CATALOG.avatar_photo.kind,
      icon: TASK_CATALOG.avatar_photo.icon,
      label: TASK_CATALOG.avatar_photo.label,
      title: TASK_CATALOG.avatar_photo.title,
      reward: TASK_CATALOG.avatar_photo.reward,
    },
  ],
  source: 'static',
};

// ── 移動不要のセルフクエスト：プリセット選択で自分のことを神に伝える ──
// 集めた内容は神（AI）の会話・サジェスト・初回あいさつの参照に使う（userContext 経由）。
export const CONCERN_PRESETS = {
  health: ['よく眠れない', '疲れがとれない', '運動不足', '肩こり・腰痛', '体重が気になる', '目の疲れ', '食生活の乱れ', 'ストレスが多い'],
  life: ['お金のやりくり', '時間が足りない', '人間関係', '家事の負担', '将来への不安', '孤独を感じる', '住まいのこと', '趣味の時間がない'],
  work: ['仕事が忙しい', '評価が気になる', '人間関係（職場）', 'やりがいが見えない', 'キャリアの方向', '残業が多い', '転職を考えている', '集中できない'],
} as const;
export const RECENT_GOOD_PRESETS = ['おいしいものを食べた', 'よく眠れた', '人にやさしくできた', '良い天気だった', '運動できた', '誰かに感謝された', '欲しかったものが手に入った', '小さな目標を達成した'];

// 煩悩（健康/生活/仕事）を打ち明ける移動不要クエスト。
export const CONCERNS_QUEST: Quest = {
  id: 'concerns-self',
  title: 'あなたの煩悩をきかせて',
  description: '健康・生活・仕事のもやもやを神に打ち明けよう。場所は問わない、いつでもどこでも。',
  difficulty: 1,
  minLevel: 0,
  estMinutes: 2,
  badgeIcon: '🍃',
  badgeName: '煩悩を打ち明けし者',
  goalName: '煩悩の告白',
  goalLat: 0,
  goalLng: 0,
  tasks: [
    {
      id: 's0',
      type: 'concerns_self',
      kind: TASK_CATALOG.concerns_self.kind,
      icon: TASK_CATALOG.concerns_self.icon,
      label: TASK_CATALOG.concerns_self.label,
      title: TASK_CATALOG.concerns_self.title,
      reward: TASK_CATALOG.concerns_self.reward,
    },
  ],
  source: 'static',
};

// 最近良かったことを共有する移動不要クエスト。
export const GOOD_QUEST: Quest = {
  id: 'recent-good-self',
  title: 'あなたの最近良かったことをきかせて',
  description: '最近うれしかった小さな出来事を神に話そう。場所は問わない、いつでもどこでも。',
  difficulty: 1,
  minLevel: 0,
  estMinutes: 2,
  badgeIcon: '🌸',
  badgeName: '喜びを分かちし者',
  goalName: '喜びの共有',
  goalLat: 0,
  goalLng: 0,
  tasks: [
    {
      id: 's0',
      type: 'recent_good_self',
      kind: TASK_CATALOG.recent_good_self.kind,
      icon: TASK_CATALOG.recent_good_self.icon,
      label: TASK_CATALOG.recent_good_self.label,
      title: TASK_CATALOG.recent_good_self.title,
      reward: TASK_CATALOG.recent_good_self.reward,
    },
  ],
  source: 'static',
};

/** 移動をともなわないクエスト（アバター設定・煩悩・最近良かったこと）か。距離表示・地図遷移を出さない判定に使う。 */
const STATIONARY_TASK_TYPES = new Set(['avatar_photo', 'concerns_self', 'recent_good_self']);
export function isStationaryQuest(q: Quest): boolean {
  return q.tasks.length === 1 && STATIONARY_TASK_TYPES.has(q.tasks[0].type);
}

/**
 * 御朱印未取得の場に出す、シンプルな「御朱印を授かる」クエスト（1タスク）。
 * 現地100m以内で御朱印が自動授与され達成になる（MapTab 側の処理）。
 */
export function buildGoshuinQuest(spot: { id: string; name: string; category: string; latitude: number; longitude: number; godEmoji?: string }): Quest {
  const godEmoji = spot.godEmoji || (spot.category === '神社' ? '⛩️' : '🙏');
  return {
    id: `goshuin-${spot.id}`,
    spotId: spot.id,
    title: `${spot.name}で御朱印を授かる`,
    description: `${spot.name}（${spot.category}）へ参り、神と語らって御朱印を授かろう。`,
    difficulty: 1,
    minLevel: 0,
    estMinutes: 15,
    badgeIcon: godEmoji,
    badgeName: `${spot.name}の御朱印`,
    goalName: spot.name,
    goalLat: spot.latitude,
    goalLng: spot.longitude,
    tasks: [
      {
        id: 's0',
        type: 'goshuin',
        spotId: spot.id,
        lat: spot.latitude,
        lng: spot.longitude,
        kind: TASK_CATALOG.goshuin.kind,
        icon: TASK_CATALOG.goshuin.icon,
        label: TASK_CATALOG.goshuin.label,
        title: `${spot.name}で御朱印を授かる`,
        reward: TASK_CATALOG.goshuin.reward,
      },
    ],
    source: 'static',
  };
}

export function getChallenge(id: string): Quest | undefined {
  return CHALLENGES.find((c) => c.id === id);
}
