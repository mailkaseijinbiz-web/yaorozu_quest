// 新中野・クイズ巡礼データ
// -----------------------------------------------------------------------------
// 新中野駅〜鍋屋横丁〜青梅街道〜桃園川緑道を舞台にした街歩きクイズ。
// 各問は「全プレイヤーの正答率」に応じて獲得徳が変動する（動的御利益システム）。
//   獲得徳 = baseToku × オッズ
//   オッズ = clamp( ODDS_K / (正答率 + ODDS_EPS), ODDS_MIN, ODDS_MAX )
// みんなが解けない難問ほどオッズが上がり、高い徳が得られる。
// -----------------------------------------------------------------------------

export interface QuizQuestion {
  id: string;
  /** クエストのタイトル（一覧で見出しになる短い一文） */
  title: string;
  /** 出題（神霊ナベ爺の問いかけ） */
  question: string;
  /** 神からの呼びかけ（現地に着いた瞬間に始まる召喚のセリフ） */
  call: string;
  /** 3つの選択肢 */
  choices: string[];
  /** 正解の選択肢インデックス */
  answerIndex: number;
  /** 基準徳（オッズ1.0のときの獲得徳） */
  baseToku: number;
  /** 正解時に開封される御託宣（解説） */
  lore: string;
  /** 現地の観察お題 */
  walkTip: string;
  /** 最寄りの目印 */
  landmark: string;
  /** ミッション地点の緯度 */
  latitude: number;
  /** ミッション地点の経度 */
  longitude: number;
  /** 初期の挑戦回数（シードデータ） */
  seedAttempts: number;
  /** 初期の正解回数（シードデータ） */
  seedCorrect: number;
}

// ── 位置ゲート ──
/** この距離（km）以内に近づくとクイズが解放される */
export const QUIZ_UNLOCK_RADIUS_KM = 0.3;

/** 2点間の距離（km, Haversine） */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 現在地からクイズ地点までの距離（km） */
export function quizDistance(quiz: QuizQuestion, loc: { lat: number; lng: number }): number {
  return distanceKm(loc.lat, loc.lng, quiz.latitude, quiz.longitude);
}

/** 現在地でクイズが解放されているか */
export function isQuizUnlocked(quiz: QuizQuestion, loc: { lat: number; lng: number }): boolean {
  return quizDistance(quiz, loc) <= QUIZ_UNLOCK_RADIUS_KM;
}

/** シリーズが制覇されたか（全クイズ回答済み） */
export function isSeriesCompleted(series: QuizSeries, answeredQuizIds: Set<string>): boolean {
  return series.quizIds.length > 0 && series.quizIds.every(id => answeredQuizIds.has(id));
}

// ── オッズ計算パラメータ ──
export const ODDS_K = 0.5;
export const ODDS_EPS = 0.1;
export const ODDS_MIN = 0.5;
export const ODDS_MAX = 5.0;
/** この挑戦回数に満たない問題は仮オッズ（PROVISIONAL_ODDS）で固定 */
export const MIN_SAMPLE = 30;
export const PROVISIONAL_ODDS = 1.5;

export interface QuizStat {
  attempts: number;
  correct: number;
}

/** 正答率からオッズ（徳倍率）を算出 */
export function computeOdds(stat: QuizStat): number {
  if (stat.attempts < MIN_SAMPLE) return PROVISIONAL_ODDS;
  const p = stat.correct / stat.attempts;
  const raw = ODDS_K / (p + ODDS_EPS);
  return Math.min(ODDS_MAX, Math.max(ODDS_MIN, raw));
}

/** オッズから実際の獲得徳を算出 */
export function computeToku(baseToku: number, stat: QuizStat): number {
  return Math.round(baseToku * computeOdds(stat));
}

/** 正答率（%）。サンプル不足なら null */
export function correctRate(stat: QuizStat): number | null {
  if (stat.attempts < MIN_SAMPLE) return null;
  return Math.round((stat.correct / stat.attempts) * 100);
}

/** 難易度バッジの判定 */
export function difficultyBadge(stat: QuizStat): { label: string; tone: 'easy' | 'normal' | 'hard' | 'secret' } {
  const rate = correctRate(stat);
  if (rate === null) return { label: '集計中', tone: 'normal' };
  if (rate < 15) return { label: '秘', tone: 'secret' };
  if (rate < 35) return { label: '難', tone: 'hard' };
  if (rate < 65) return { label: '並', tone: 'normal' };
  return { label: '易', tone: 'easy' };
}

// -----------------------------------------------------------------------------
// クイズデータ（新中野 七問）
// ※ 年号・由来は実装前に一次資料での裏取りを推奨
// -----------------------------------------------------------------------------
// ── クイズシリーズ ──
export interface QuizSeries {
  id: string;
  title: string;
  description: string;
  quizIds: string[];
  badgeIcon: string; // 制覇時に表示されるバッジアイコン
}

export const SHINNAKANO_SERIES: QuizSeries = {
  id: 'series-shinnakano',
  title: '新中野クイズ巡礼',
  description: '7つのクエストをすべてクリアすると制覇バッジが獲得できます',
  badgeIcon: '⛩️',
  quizIds: [],
};

export const SHINNAKANO_QUIZZES: QuizQuestion[] = [
  {
    id: 'quiz-nabeyoko-origin',
    title: '「鍋屋横丁」の名の謎',
    question: '「鍋屋横丁」という地名の由来は？',
    call: 'よう来たな、旅の者よ。この横丁の名が、なぜ「鍋屋」と呼ばれるか…そなたは知っておるか？',
    choices: ['鍋を売る店が多かった', '茶屋「鍋屋」があった', '鍋の形をした池があった'],
    answerIndex: 1,
    baseToku: 40,
    lore: '江戸期、青梅街道から堀ノ内・妙法寺（厄除け祖師）へ向かう参道の入口に茶屋「鍋屋」があり、参詣客の目印になったのが地名の由来。',
    walkTip: '鍋屋横丁交差点の標識を撮影してみよう。',
    landmark: '鍋屋横丁交差点',
    latitude: 35.6960,
    longitude: 139.6638,
    seedAttempts: 120,
    seedCorrect: 60,
  },
  {
    id: 'quiz-omekaido-lime',
    title: '青梅街道に隠された荷',
    question: '青梅街道は、もともと何を江戸へ運ぶために整備された道？',
    call: 'おお、よくぞこの街道に立った。足元のこの一本道…江戸へ「あるもの」を運ぶために拓かれた。何だと思う？',
    choices: ['青梅（果実）', '石灰（しっくいの原料）', 'お茶'],
    answerIndex: 1,
    baseToku: 40,
    lore: '江戸城の壁の漆喰に使う石灰を、青梅・成木から運ぶために開かれた道。「石灰の道」とも呼ばれる。',
    walkTip: '青梅街道沿いを100mほど歩いて、道幅と直線性を体感しよう。',
    landmark: '青梅街道',
    latitude: 35.6958,
    longitude: 139.6650,
    seedAttempts: 150,
    seedCorrect: 12,
  },
  {
    id: 'quiz-momozonogawa-ankyo',
    title: '消えた川を探せ',
    question: '新中野の足元を流れていた「桃園川」は今どうなっている？',
    call: 'この緑の小道…かつてここには「桃園川」という川が流れておった。今、その川はどこへ行ったと思う？',
    choices: ['暗渠化され「緑道」になった', '今も川として流れている', '埋め立てて駅になった'],
    answerIndex: 0,
    baseToku: 40,
    lore: '桃園川は暗渠化され、現在は桃園川緑道として遊歩道になっている。かつての川筋がそのままS字に蛇行して残る。',
    walkTip: '緑道のベンチや橋跡の名残を1つ見つけて撮影しよう。',
    landmark: '桃園川緑道',
    latitude: 35.6975,
    longitude: 139.6670,
    seedAttempts: 110,
    seedCorrect: 38,
  },
  {
    id: 'quiz-ryokudo-curve',
    title: 'くねる道の正体',
    question: '桃園川緑道が不自然にくねくね曲がっているのはなぜ？',
    call: 'ふむ、よく見よ。この道、なぜこうもくねくねと曲がっておるのか…不思議には思わぬか？',
    choices: ['公園として設計されたから', '川の流路をそのままなぞっているから', '古墳を避けたから'],
    answerIndex: 1,
    baseToku: 40,
    lore: '道がS字に蛇行するのは、川の流れの跡だから。まっすぐな街路と見比べると「ここは元・水路」と読める。',
    walkTip: '緑道と交差する“まっすぐな道”との角度の違いを観察しよう。',
    landmark: '桃園川緑道',
    latitude: 35.6972,
    longitude: 139.6678,
    seedAttempts: 100,
    seedCorrect: 25,
  },
  {
    id: 'quiz-myohoji-yakuyoke',
    title: '参道の先の願い',
    question: '鍋屋横丁の参道の先「堀ノ内・妙法寺」は、何のお寺として有名？',
    call: 'この道はな、昔から人々が願いを抱いて南へ歩いた参道よ。その先の妙法寺、何を願う寺か分かるか？',
    choices: ['縁結び', '厄除け（やくよけ祖師）', '学業成就'],
    answerIndex: 1,
    baseToku: 40,
    lore: '妙法寺は「堀ノ内のお祖師さま」と親しまれる厄除けの寺。江戸落語「堀の内」の舞台でもある。',
    walkTip: '鍋屋横丁から妙法寺方向（南）を向いて、参道の延長線を辿ってみよう。',
    landmark: '鍋屋横丁',
    latitude: 35.6957,
    longitude: 139.6640,
    seedAttempts: 130,
    seedCorrect: 58,
  },
  {
    id: 'quiz-station-year',
    title: '赤い龍が生まれた年',
    question: '新中野駅（丸ノ内線）が開業したのはいつ頃？',
    call: '地の底を走る赤い龍…丸ノ内線よ。この駅が生まれたのは、いつの世だと思う？',
    choices: ['大正時代', '昭和30年代（1961年）', '平成'],
    answerIndex: 1,
    baseToku: 40,
    lore: '新中野駅は丸ノ内線の延伸で昭和36年（1961）に開業。「新」が付くのは中野駅と区別するため。',
    walkTip: '駅出口の数と方向を確認し、青梅街道との位置関係をメモしよう。',
    landmark: '新中野駅',
    latitude: 35.6957,
    longitude: 139.6655,
    seedAttempts: 90,
    seedCorrect: 27,
  },
  {
    id: 'quiz-nabeyoko-nickname',
    title: '地元の呼び名',
    question: '鍋屋横丁を地元では何と略す？',
    call: 'ふふ、地元の者はこの横丁を、長い名では呼ばぬ。さて、何と縮めて呼んでおるか…分かるかな？',
    choices: ['ナベヨコ', 'ナベチョウ', 'ヨコ丁'],
    answerIndex: 0,
    baseToku: 40,
    lore: '地元では「なべよこ」。商店街の愛称や看板にもこの略称が使われている。',
    walkTip: '「なべよこ」表記の看板やのれんを探して撮影しよう。',
    landmark: '鍋屋横丁商店街',
    latitude: 35.6962,
    longitude: 139.6635,
    seedAttempts: 140,
    seedCorrect: 119,
  },
];

// シリーズにクイズをリンク
SHINNAKANO_SERIES.quizIds = SHINNAKANO_QUIZZES.map(q => q.id);
