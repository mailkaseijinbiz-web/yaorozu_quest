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

export const CHALLENGES: Quest[] = [
  {
    id: 'ch-nabeyoko',
    title: '鍋屋横丁ぶらり歴史散歩',
    description: '青梅街道から鍋屋横丁、妙法寺参道へ。江戸の名残をたどるやさしい街歩き。',
    difficulty: 1,
    minLevel: 1,
    estMinutes: 30,
    badgeIcon: '🏮',
    badgeName: '鍋横の語り部',
    goalName: '鍋屋横丁交差点',
    goalLat: 35.6960,
    goalLng: 139.6638,
    source: 'static',
    tasks: [
      questStep({
        id: 's1',
        title: '鍋屋横丁交差点に立つ',
        action: '青梅街道沿いの「鍋屋横丁」交差点の標識を探そう。',
        triviaCategory: '歴史',
        trivia: '江戸期、堀ノ内・妙法寺への参道入口に茶屋「鍋屋」があり、それが地名の由来になった。',
        lat: 35.6960,
        lng: 139.6638,
      }),
      questStep({
        id: 's2',
        title: '標識を撮影する',
        action: '交差点の標識を1枚撮って奉納しよう。',
        photo: true,
        lat: 35.6960,
        lng: 139.6638,
      }),
      questStep({
        id: 's3',
        title: '青梅街道を歩く',
        action: '青梅街道を100mほど歩き、道幅と直線性を体感しよう。',
        triviaCategory: '道路',
        trivia: '青梅街道は江戸城の漆喰に使う石灰を青梅・成木から運ぶために開かれた「石灰の道」。',
        lat: 35.6958,
        lng: 139.6650,
      }),
      questStep({
        id: 's4',
        title: '妙法寺の方角を望む',
        action: '鍋屋横丁から南（妙法寺方向）を向き、参道の延長線をたどろう。',
        triviaCategory: '歴史',
        trivia: '妙法寺は「堀ノ内のお祖師さま」と親しまれる厄除けの寺。落語「堀の内」の舞台でもある。',
        lat: 35.6957,
        lng: 139.6640,
      }),
    ],
  },
  {
    id: 'ch-momozono',
    title: '消えた川・桃園川の謎',
    description: '暗渠化された桃園川の痕跡を緑道にたどる。地形を読むふつうの街歩き。',
    difficulty: 2,
    minLevel: 2,
    estMinutes: 45,
    badgeIcon: '🌊',
    badgeName: '暗渠ハンター',
    goalName: '桃園川緑道',
    goalLat: 35.6975,
    goalLng: 139.6670,
    source: 'static',
    tasks: [
      questStep({
        id: 's1',
        title: '桃園川緑道に入る',
        action: '緑道の入口を見つけて歩き始めよう。',
        triviaCategory: '地形',
        trivia: '桃園川は暗渠化され、今は緑道に。かつての川筋がそのままS字に蛇行して残る。',
        lat: 35.6975,
        lng: 139.6670,
      }),
      questStep({
        id: 's2',
        title: 'くねる道を観察',
        action: '緑道と交差する“まっすぐな街路”との角度の違いを観察しよう。',
        triviaCategory: '地形',
        trivia: '道がS字に曲がるのは川の流れの跡だから。まっすぐな街路と見比べると「ここは元・水路」と読める。',
        lat: 35.6972,
        lng: 139.6678,
      }),
      questStep({
        id: 's3',
        title: '橋跡を撮影する',
        action: '緑道のベンチや橋跡の名残を1つ見つけて撮影しよう。',
        photo: true,
        lat: 35.6975,
        lng: 139.6670,
      }),
    ],
  },
  {
    id: 'ch-architecture',
    title: '新中野 建築探訪',
    description: '駅と街並みに残る昭和の建築・土木を読み解く、むずかしい上級コース。',
    difficulty: 3,
    minLevel: 3,
    estMinutes: 60,
    badgeIcon: '🏛️',
    badgeName: '街の建築家',
    goalName: '新中野駅',
    goalLat: 35.6957,
    goalLng: 139.6655,
    source: 'static',
    tasks: [
      questStep({
        id: 's1',
        title: '新中野駅の出口を数える',
        action: '駅出口の数と方向を確認し、青梅街道との位置関係をメモしよう。',
        triviaCategory: '建築',
        trivia: '新中野駅は丸ノ内線の延伸で昭和36年（1961）に開業。「新」は中野駅と区別するため。',
        lat: 35.6957,
        lng: 139.6655,
      }),
      questStep({
        id: 's2',
        title: '商店街のファサードを見る',
        action: '鍋屋横丁商店街の看板建築・ファサードを観察しよう。',
        triviaCategory: '建築',
        trivia: '下町の商店街には、正面だけを洋風に飾った「看板建築」が点在する。',
        lat: 35.6962,
        lng: 139.6635,
      }),
      questStep({
        id: 's3',
        title: '街路の成り立ちを読む',
        action: '放射状の街道と碁盤の区画が交わる地点を探そう。',
        triviaCategory: '道路',
        trivia: '青梅街道（放射）と区画整理された街区（格子）が交わり、独特の三角地が生まれる。',
        lat: 35.6958,
        lng: 139.6650,
      }),
      questStep({
        id: 's4',
        title: '気になる建築を撮影',
        action: 'お気に入りの建築を1枚撮って記録しよう。',
        photo: true,
        lat: 35.6957,
        lng: 139.6655,
      }),
    ],
  },
];

// 東京各エリアの手続き生成クエスト＋簡単な単発クエストを追加（合計で約1000件）
import { generateChallenges, generateSimpleChallenges } from './challenge-seed';
CHALLENGES.push(...generateSimpleChallenges(), ...generateChallenges());

export function getChallenge(id: string): Quest | undefined {
  return CHALLENGES.find((c) => c.id === id);
}
