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
export const COMMON_TASK_TYPES: GodTaskType[] = ['context', 'photo', 'event', 'review', 'sns'];

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

// 文字列から安定したシード値を作る（スポットごとに台詞のバリエーションを固定するため）
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

const TOD_VARIANTS: Record<string, string[]> = {
  未明: ['まだ眠りの中にある', '夜明け前の静寂に包まれておる', '人影もまばら、神気だけが漂う刻じゃ'],
  朝: ['清々しい朝の気が満ちておる', '朝陽が辺りを照らし始めた', '一日の始まりの活気が芽吹く頃じゃ'],
  昼: ['今、賑わいを見せておるようじゃ', '陽は高く、人の往来も盛んじゃ', '昼下がりの穏やかな時が流れておる'],
  夕暮れ: ['黄金色に染まる頃合いじゃ', '茜空がこの地を包んでおる', '一日の名残を惜しむ刻じゃ'],
  夜: ['静寂に神気が宿る刻', '灯りがともり、夜の帳が下りた', '星々がこの地を見守っておる'],
};

const SEASON_LINES: Record<string, string[]> = {
  春: ['桜の気配が、そこかしこに漂う頃じゃ…', '芽吹きの季節、新たな縁が動く頃合いよ。'],
  夏: ['蝉の声が遠くに響くようじゃ…', '夏の陽気が、この地に満ちておる。'],
  秋: ['紅葉の便りが聞こえてくる頃じゃ…', '実りの秋、感謝の念が深まる頃よ。'],
  冬: ['冷たい風が、身を清めるようじゃ…', '澄んだ空気に、神気が研ぎ澄まされる。'],
};

const CATEGORY_LINES: Record<string, string[]> = {
  神社: ['鳥居の向こうに、古き約束が眠っておる。', '手水で心身を清めてから参られよ。'],
  寺院: ['鐘の音が、そなたの迷いを払うであろう。', '線香の煙に、静かに祈りを託すがよい。'],
  商店街: ['店主らの心意気が、この通りを生かしておる。', '掘り出し物は、己の足で探すものじゃ。'],
  飲食店: ['湯気の向こうに、職人の技が宿っておる。', '空腹は最高の調味料、というでな。'],
  公園: ['木々のざわめきこそ、わしの声じゃ。', '四季の移ろいを、ここで感じるがよい。'],
  商業施設: ['人の欲と縁が交わる、面白き場よ。', '思わぬ出会いも、すべてはご縁じゃ。'],
};
const CATEGORY_FALLBACK = ['この地には、人知れぬ物語が積もっておる。', 'そなたが来るのを、ずっと待っておったぞ。'];

function seasonOf(month: number): string {
  if (month === 12 || month <= 2) return '冬';
  if (month <= 5) return '春';
  if (month <= 8) return '夏';
  return '秋';
}

/**
 * 場所の「心の声」を返す。
 * 本来は SNS／ウェブの情報から“そのとき最も相応しい”話題を選ぶ想定。
 * デモでは「時間帯 × 季節 × カテゴリ × 噂 × 依頼」を合成して、場所ごとに表情の違う独白を作る。
 * スポット名から安定シードを引くため、同じ場所・同じ時間帯では台詞が固定され、
 * タイプライター表示中に文面が入れ替わらない。
 */
export function getHeartVoices(spot: Pick<Spot, 'name' | 'category' | 'taskTypes'>): string[] {
  const now = new Date();
  const h = now.getHours();
  const tod = h < 5 ? '未明' : h < 10 ? '朝' : h < 15 ? '昼' : h < 19 ? '夕暮れ' : '夜';
  const season = seasonOf(now.getMonth() + 1);
  const seed = hashStr(spot.name) ^ (h << 3); // 場所＋時間帯で安定

  const rumorVariants = [
    `巷では今、${spot.name}が話題のようじゃ…`,
    `${spot.name}を訪れる者が、近頃増えておるとか…`,
    `風の噂で、${spot.name}の名をよう聞くようになった…`,
    `${spot.name}に、新たな縁が芽吹いておるらしい…`,
  ];
  const catLines = CATEGORY_LINES[spot.category] ?? CATEGORY_FALLBACK;

  const lines = [
    `${tod}の${spot.name}…${pick(TOD_VARIANTS[tod], seed)}。`,
    pick(SEASON_LINES[season], seed >> 2),
    pick(catLines, seed >> 3),
    pick(rumorVariants, seed >> 4),
    ...getGodTasks(spot).map((t) => t.murmur),
  ];
  return lines.filter(Boolean);
}

/** タスク種別ごとのテーマ色（Tailwind 用） */
export const TASK_TONE: Record<GodTaskType, { text: string; bg: string; border: string }> = {
  context: { text: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  photo: { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  event: { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  review: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  sns: { text: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
  buy: { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  eat: { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  cleaning: { text: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
};
