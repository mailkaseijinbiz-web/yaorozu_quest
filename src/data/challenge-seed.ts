// チャレンジ 生成器（約1000件）
// -----------------------------------------------------------------------------
// 東京各エリア × テーマで、ミニチャレンジを手続き的に生成する。
// 各チャレンジは難易度・所要時間・バッジ・ゴール・ステップ（次の案内＋蘊蓄）を持つ。
// 決定論的PRNG（mulberry32）でシード。
// -----------------------------------------------------------------------------

import type { Challenge, ChallengeStep, TriviaCategory } from './challenges';

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AREAS: { name: string; lat: number; lng: number }[] = [
  { name: '新中野', lat: 35.6957, lng: 139.6655 }, { name: '中野', lat: 35.7056, lng: 139.6657 },
  { name: '高円寺', lat: 35.7053, lng: 139.6497 }, { name: '阿佐ヶ谷', lat: 35.7048, lng: 139.6360 },
  { name: '荻窪', lat: 35.7046, lng: 139.6200 }, { name: '新宿', lat: 35.6896, lng: 139.7006 },
  { name: '渋谷', lat: 35.6580, lng: 139.7016 }, { name: '吉祥寺', lat: 35.7030, lng: 139.5800 },
  { name: '池袋', lat: 35.7295, lng: 139.7109 }, { name: '上野', lat: 35.7138, lng: 139.7770 },
  { name: '浅草', lat: 35.7148, lng: 139.7967 }, { name: '神楽坂', lat: 35.7012, lng: 139.7400 },
  { name: '谷中', lat: 35.7268, lng: 139.7669 }, { name: '下北沢', lat: 35.6613, lng: 139.6680 },
  { name: '目黒', lat: 35.6339, lng: 139.7156 }, { name: '品川', lat: 35.6285, lng: 139.7387 },
  { name: '錦糸町', lat: 35.6970, lng: 139.8146 }, { name: '北千住', lat: 35.7497, lng: 139.8050 },
  { name: '築地', lat: 35.6655, lng: 139.7708 }, { name: '月島', lat: 35.6648, lng: 139.7836 },
];

const THEMES: { key: string; title: string; icon: string; badge: string; cats: TriviaCategory[] }[] = [
  { key: 'history', title: '歴史さんぽ', icon: '📜', badge: 'の語り部', cats: ['歴史', '道路'] },
  { key: 'water', title: '水の記憶めぐり', icon: '🌊', badge: 'の暗渠ハンター', cats: ['地形', '道路'] },
  { key: 'arch', title: '建築探訪', icon: '🏛️', badge: 'の建築家', cats: ['建築', '歴史'] },
  { key: 'road', title: '街道ウォーク', icon: '🛣️', badge: 'の道案内人', cats: ['道路', '歴史'] },
  { key: 'terrain', title: '地形を読む', icon: '⛰️', badge: 'の地形読み', cats: ['地形', '建築'] },
];

// 物語テンプレート（テーマごとの起承転結）。
// 神からの依頼として始まり、序章→探索→転機→結末で街を読み解く構成。
// {a}=丁目, {area}=エリア名 を置換。各幕は triviaCategory と蘊蓄を持つ。
type StoryAct = { title: string; action: string; trivia: string; cat: TriviaCategory };
type ThemeStory = {
  premise: string;      // description（依頼の導入）
  acts: StoryAct[];     // 序・承・転（3幕）
  climaxTitle: string;  // 結（ゴール地点）
  climaxAction: string;
};

const STORY: Record<string, ThemeStory> = {
  history: {
    premise: '{area}に栄えた門前町の記憶が、時とともに薄れつつある。土地の神に代わり、街に刻まれた歴史の断片を辿って、失われた物語を取り戻そう。',
    acts: [
      { title: '序章 ── 門前町へ', action: 'まず{a}の門前や旧街道沿いに立ち、往時の賑わいを想像しながら歩き出そう。', trivia: '{area}は寺社の門前・宿場として栄え、商家や茶屋が軒を連ねた。', cat: '歴史' },
      { title: '探索 ── 地名の謎', action: '由緒書きや石碑を探し、土地の名がどこから来たのかを読み解こう。', trivia: '{area}の地名は名主・地形・産物に由来すると伝わる。', cat: '歴史' },
      { title: '転機 ── 道が語る真実', action: '街道の分かれ道に立ち、人々がどこへ向かったのかに思いを馳せよう。', trivia: '{area}の街道は参詣と物流の動脈で、宿場が人を集めた。', cat: '道路' },
    ],
    climaxTitle: '結末 ── 語り部となる',
    climaxAction: '集めた記憶を胸に、ゴールで{area}の物語をあなたの一枚で締めくくろう。',
  },
  water: {
    premise: 'かつて{area}を潤した小川は、今は地下に姿を隠した。水の神の声を頼りに、街に残る「水の記憶」を辿って暗渠の物語を解き明かそう。',
    acts: [
      { title: '序章 ── 水のささやき', action: '{a}でいちばん低い場所を探し、水がどこへ流れたのかを感じ取ろう。', trivia: '{area}は武蔵野台地の縁。坂下には旧河川沿いの低地が広がる。', cat: '地形' },
      { title: '探索 ── 暗渠を辿る', action: 'くねくねと曲がる路地を辿り、消えた小川の道筋を読み解こう。', trivia: '{area}の不自然に曲がる路地は、暗渠化された小川の名残。', cat: '地形' },
      { title: '転機 ── 橋の痕跡', action: '欄干跡や「◯◯橋」の地名標を探し、かつての水辺を思い描こう。', trivia: '{area}には今も橋の名だけが残る交差点がある。', cat: '道路' },
    ],
    climaxTitle: '結末 ── 川の記憶を継ぐ',
    climaxAction: 'ゴールで、地上に残る水の痕跡をあなたの一枚に収めて物語を結ぼう。',
  },
  arch: {
    premise: '{area}の街並みには、時代の異なる建物が静かに同居している。建築の神に導かれ、ファサードに刻まれた人々の暮らしの物語を読み解こう。',
    acts: [
      { title: '序章 ── 街の表情', action: '{a}の商店街を歩き、正面だけ洋風に飾った「看板建築」を探そう。', trivia: '{area}の商店街には、震災・戦後復興期の看板建築が点在する。', cat: '建築' },
      { title: '探索 ── 湯けむりの記憶', action: '宮造りの破風や高い煙突を見上げ、銭湯の佇まいを観察しよう。', trivia: '{area}の銭湯は、地域の社交場でもあった。', cat: '建築' },
      { title: '転機 ── 時代の境目', action: '古い木造と新しいビルが隣り合う一角を探し、街の移ろいを感じよう。', trivia: '{area}は再開発と古い区画が混在し、時代の断層が見える。', cat: '歴史' },
    ],
    climaxTitle: '結末 ── 街の肖像を描く',
    climaxAction: 'ゴールで、あなたが一番惹かれた建物を一枚に収めて物語を結ぼう。',
  },
  road: {
    premise: '{area}の道は、なぜこんな形をしているのか。道の神の問いかけに答えるべく、街道と区画が織りなす街の成り立ちを歩いて確かめよう。',
    acts: [
      { title: '序章 ── 古道に立つ', action: '{a}の旧街道を歩き、道幅と緩やかな曲がりを体で感じ取ろう。', trivia: '{area}の街道は、物資輸送や参詣の道として開かれた。', cat: '道路' },
      { title: '探索 ── 変則交差点の謎', action: '放射状の道と格子の区画が交わる三角地を探そう。', trivia: '{area}では放射街道と区画が交わり、変則的な交差点が生まれた。', cat: '道路' },
      { title: '転機 ── 地形が決めた道', action: '坂や谷に沿って曲がる道を辿り、地形が街道を決めた跡を読もう。', trivia: '{area}の道は、台地と低地の地形に素直に従って引かれている。', cat: '地形' },
    ],
    climaxTitle: '結末 ── 道の語り部に',
    climaxAction: 'ゴールで、街の成り立ちを物語る道の一枚を撮って締めくくろう。',
  },
  terrain: {
    premise: '{area}の起伏には、太古の地形の記憶が眠っている。地形の神とともに、坂と谷をめぐって大地が描いた物語を読み解こう。',
    acts: [
      { title: '序章 ── 台地の縁へ', action: '{a}で坂の上に立ち、見晴らしから台地の広がりを確かめよう。', trivia: '{area}は武蔵野台地の上にあり、縁では急な崖線が走る。', cat: '地形' },
      { title: '探索 ── 谷を下る', action: '坂を下って低地へ。空気や音の変化から谷地形を体感しよう。', trivia: '{area}の谷は、かつての川が削った地形であることが多い。', cat: '地形' },
      { title: '転機 ── 高低差が生んだ街', action: '崖下に寄り添う家並みや擁壁を探し、人が地形とどう暮らしたか見よう。', trivia: '{area}では高低差に沿って建物や道が複雑に積み重なる。', cat: '建築' },
    ],
    climaxTitle: '結末 ── 大地の物語を結ぶ',
    climaxAction: 'ゴールで、いちばん高低差を感じた景色を一枚に収めて締めくくろう。',
  },
};

// 簡単な単発チャレンジ（写真を1枚撮る等）を動的生成
const SIMPLE_KINDS: { title: string; action: string; icon: string; badge: string; photo: boolean }[] = [
  { title: '写真を1枚撮る', action: 'で気になった景色を写真に1枚撮ろう。', icon: '📸', badge: 'フォト', photo: true },
  { title: '今の様子を伝える', action: 'の今の混雑・雰囲気を一言で報告しよう。', icon: '🌡️', badge: '今', photo: false },
  { title: '一服する', action: 'の近くで一息ついて、感想をひとつ残そう。', icon: '🍵', badge: '一服', photo: false },
  { title: '空を見上げる', action: 'で空を見上げて、今日の空模様を記録しよう。', icon: '☁️', badge: '空', photo: true },
];

export function generateSimpleChallenges(count = 300): Challenge[] {
  const rand = mulberry32(20260610);
  const out: Challenge[] = [];
  for (let i = 0; i < count; i++) {
    const area = AREAS[Math.floor(rand() * AREAS.length)];
    const kind = SIMPLE_KINDS[Math.floor(rand() * SIMPLE_KINDS.length)];
    const place = `${area.name}${1 + Math.floor(rand() * 7)}丁目`;
    const lat = +(area.lat + (rand() - 0.5) * 0.02).toFixed(5);
    const lng = +(area.lng + (rand() - 0.5) * 0.02).toFixed(5);
    out.push({
      id: `chs-${i}`,
      title: `${place}で${kind.title}`,
      description: `${place}でサクッと達成できる簡単なミニミッション。`,
      difficulty: 1,
      minLevel: 1,
      estMinutes: 5,
      badgeIcon: kind.icon,
      badgeName: `${area.name}の${kind.badge}`,
      goalName: `${place}`,
      goalLat: lat,
      goalLng: lng,
      steps: [
        { id: 's0', title: kind.title, action: `${place}${kind.action}`, photo: kind.photo, lat, lng },
      ],
    });
  }
  return out;
}

export function generateChallenges(count = 697): Challenge[] {
  const rand = mulberry32(20260609);
  const out: Challenge[] = [];
  for (let i = 0; i < count; i++) {
    const area = AREAS[Math.floor(rand() * AREAS.length)];
    const theme = THEMES[Math.floor(rand() * THEMES.length)];
    const difficulty = (1 + Math.floor(rand() * 3)) as 1 | 2 | 3;
    const place = `${area.name}${1 + Math.floor(rand() * 7)}丁目`;
    const goalLat = +(area.lat + (rand() - 0.5) * 0.02).toFixed(5);
    const goalLng = +(area.lng + (rand() - 0.5) * 0.02).toFixed(5);

    const story = STORY[theme.key];
    const fill = (s: string) => s.replace(/\{a\}/g, place).replace(/\{area\}/g, area.name);

    // 起承転結：序・承・転（3幕の探索）＋ 結（ゴールでの写真）
    const steps: ChallengeStep[] = story.acts.map((act, s) => ({
      id: `s${s}`,
      title: act.title,
      action: fill(act.action),
      triviaCategory: act.cat,
      trivia: fill(act.trivia),
      lat: +(goalLat + (rand() - 0.5) * 0.006).toFixed(5),
      lng: +(goalLng + (rand() - 0.5) * 0.006).toFixed(5),
    }));
    // 結末：ゴール地点での写真ミッション
    steps.push({
      id: `s${story.acts.length}`,
      title: story.climaxTitle,
      action: fill(story.climaxAction),
      photo: true,
      lat: goalLat,
      lng: goalLng,
    });

    out.push({
      id: `chg-${i}`,
      title: `${area.name} ${theme.title}`,
      description: fill(story.premise),
      difficulty,
      minLevel: difficulty, // 難易度＝必要レベルの目安
      estMinutes: 20 + Math.floor(rand() * 6) * 10,
      badgeIcon: theme.icon,
      badgeName: `${area.name}${theme.badge}`,
      goalName: `${area.name}駅周辺`,
      goalLat,
      goalLng,
      steps,
    });
  }
  return out;
}
