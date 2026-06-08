// 神様からの依頼（タスク）定義
// -----------------------------------------------------------------------------
// 各スポットに宿る神は、巡礼者に複数のタスクを依頼する。
//   共通       : 写真投稿 / できごと共有 / 口コミ共有 / SNSシェア
//   商業施設   : + モノを買ったことを伝える
//   飲食店/商店街: + 食べた感想を伝える
//   寺院/神社/公園: + 掃除が行き届いているか確認
// 地図上では神が吹き出しでこれらを「依頼」しているように見せる。
// 管理画面でスポットごとに有効なタスク種別を設定できる（spot.taskTypes）。
// -----------------------------------------------------------------------------

import { Spot } from '../lib/db';

export type GodTaskType =
  | 'context'
  | 'photo'
  | 'evaluate'
  | 'event'
  | 'review'
  | 'sns'
  | 'buy'
  | 'eat'
  | 'cleaning';

export interface GodTask {
  /** タスク種別 */
  type: GodTaskType;
  /** アイコン絵文字 */
  icon: string;
  /** 一覧・ボタン用の短いラベル */
  label: string;
  /** タスクの見出し */
  title: string;
  /** 達成で得られる徳 */
  reward: number;
  /** 神の依頼セリフ生成（土地名を織り込む） */
  call: (place: string) => string;
  /** 地図吹き出し用の短い神の声（一文字ずつ表示する想定） */
  murmur: string;
}

/** 全タスクのカタログ（管理画面の選択肢にも使う） */
export const TASK_CATALOG: Record<GodTaskType, GodTask> = {
  context: {
    type: 'context',
    icon: '🌡️',
    label: '今の様子を伝える',
    title: '場所のコンテキストを集める',
    reward: 25,
    call: (p) => `今の${p}の様子はどうじゃ？　混み具合・雰囲気・営業の様子を、わしに教えておくれ。`,
    murmur: 'のう、今この場の様子を教えておくれ…',
  },
  photo: {
    type: 'photo',
    icon: '📸',
    label: '写真を投稿',
    title: '佳き一枚を奉納',
    reward: 30,
    call: (p) => `おお、旅の者よ。${p}の佳き景色を一枚、撮って奉納してはくれぬか。`,
    murmur: 'そなたよ、佳き一枚を撮っておくれ…',
  },
  evaluate: {
    type: 'evaluate',
    icon: '⭐',
    label: '写真を評価',
    title: 'クエスト写真を評価する',
    reward: 35,
    call: (p) => `${p}を巡った皆の一枚を、そなたの目で評しておくれ。佳き写真には光を当ててやってほしい。`,
    murmur: 'そなたの目で、皆の佳き一枚を選んでおくれ…',
  },
  event: {
    type: 'event',
    icon: '🎏',
    label: 'できごとを共有',
    title: '今のできごとを共有',
    reward: 20,
    call: (p) => `今この${p}で何が起きておる？　そなたの目に映るものを、わしに教えておくれ。`,
    murmur: 'のう、今のできごとを教えておくれ…',
  },
  review: {
    type: 'review',
    icon: '🗣️',
    label: '口コミを共有',
    title: '口コミを言伝て',
    reward: 50,
    call: (p) => `${p}の良さを、後から来る巡礼者へ言伝てしておくれ。それが何よりの供物じゃ。`,
    murmur: 'そなたの言葉で、この地を伝えておくれ…',
  },
  sns: {
    type: 'sns',
    icon: '📣',
    label: 'SNSにシェア',
    title: 'SNSで広める',
    reward: 15,
    call: (p) => `この${p}の名を、外の世界にも広めてはくれぬか。縁が縁を呼ぶでな。`,
    murmur: 'のう旅人よ、わが名を広めてはくれぬか…',
  },
  buy: {
    type: 'buy',
    icon: '🛍️',
    label: '買物を報告',
    title: 'モノを買ったと伝える',
    reward: 40,
    call: (p) => `${p}で何か佳き品を求めたか？　手にした品を、わしにも見せておくれ。`,
    murmur: 'そなた、佳き品を見せておくれ…',
  },
  eat: {
    type: 'eat',
    icon: '🍜',
    label: '実食の声',
    title: '食べた感想を伝える',
    reward: 40,
    call: (p) => `${p}の味はどうじゃった？　美味かったなら、その喜びの声を上げておくれ。`,
    murmur: 'のう、味の感想を聞かせておくれ…',
  },
  cleaning: {
    type: 'cleaning',
    icon: '🧹',
    label: '清掃を確認',
    title: '掃除の行き届きを確認',
    reward: 25,
    call: (p) => `${p}の境内、掃除は行き届いておるか？　乱れがあれば、わしに知らせておくれ。`,
    murmur: 'そなた、掃除の様子を確かめておくれ…',
  },
};

/** カテゴリごとの追加タスク（共通4種にプラスされる） */
function categoryExtraTypes(category: string): GodTaskType[] {
  if (category === '商業施設') return ['buy'];
  if (category === '飲食店' || category === '商店街') return ['eat'];
  if (category === '寺院' || category === '神社' || category === '公園') return ['cleaning'];
  return [];
}

/** 共通タスク種別（神は場所のコンテキスト情報の収集を依頼する） */
export const COMMON_TASK_TYPES: GodTaskType[] = ['context', 'photo', 'evaluate', 'event', 'review', 'sns'];

/**
 * スポットで有効なタスク種別を解決する。
 * spot.taskTypes（管理画面設定）があればそれを優先、無ければ
 * 共通4種＋カテゴリ別タスクを返す。
 */
export function resolveTaskTypes(spot: Pick<Spot, 'category' | 'taskTypes'>): GodTaskType[] {
  if (spot.taskTypes && spot.taskTypes.length > 0) {
    return spot.taskTypes.filter((t): t is GodTaskType => t in TASK_CATALOG);
  }
  return [...COMMON_TASK_TYPES, ...categoryExtraTypes(spot.category)];
}

/** スポットに宿る神の依頼タスク一覧を生成する（徳の高い順にソート）。 */
export function getGodTasks(spot: Pick<Spot, 'name' | 'category' | 'taskTypes'>): GodTask[] {
  return resolveTaskTypes(spot)
    .map((type) => TASK_CATALOG[type])
    .sort((a, b) => b.reward - a.reward);
}

/**
 * 場所の「心の声」を返す。
 * 本来は SNS／ウェブの情報から“そのとき最も相応しい”話題を選ぶ想定。
 * デモでは時間帯コンテキスト＋話題シミュレーション＋依頼を合成する。
 */
export function getHeartVoices(spot: Pick<Spot, 'name' | 'category' | 'taskTypes'>): string[] {
  const h = new Date().getHours();
  const tod = h < 5 ? '未明' : h < 10 ? '朝' : h < 15 ? '昼' : h < 19 ? '夕暮れ' : '夜';
  const ctxMap: Record<string, string> = {
    未明: 'まだ眠りの中にある',
    朝: '清々しい朝の気が満ちておる',
    昼: '今、賑わいを見せておるようじゃ',
    夕暮れ: '黄金色に染まる頃合いじゃ',
    夜: '静寂に神気が宿る刻',
  };
  return [
    `${tod}の${spot.name}…${ctxMap[tod]}。`,
    `巷では今、${spot.name}が話題のようじゃ…`,
    ...getGodTasks(spot).map((t) => t.murmur),
  ];
}

/** タスク種別ごとのテーマ色（Tailwind 用） */
export const TASK_TONE: Record<GodTaskType, { text: string; bg: string; border: string }> = {
  context: { text: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  photo: { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  evaluate: { text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  event: { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  review: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  sns: { text: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
  buy: { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  eat: { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  cleaning: { text: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
};
