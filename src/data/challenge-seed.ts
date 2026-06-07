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

const STEP_TMPL: Record<TriviaCategory, { title: string; action: string; trivia: string }[]> = {
  歴史: [
    { title: '門前町を歩く', action: '{a}の門前や旧街道沿いを歩いてみよう。', trivia: '{a}は寺社の門前・宿場として栄え、商家や茶屋が軒を連ねた。' },
    { title: '地名の由来を探す', action: '由緒書きや石碑を探して読んでみよう。', trivia: '{a}の地名は名主・地形・産物に由来すると伝わる。' },
  ],
  地形: [
    { title: '坂を下る', action: '{a}の坂を下り、低地と台地の境を体感しよう。', trivia: '{a}は武蔵野台地の縁。坂下は旧河川沿いの低地が広がる。' },
    { title: '暗渠を辿る', action: 'くねる路地を辿って旧水路を読み解こう。', trivia: '{a}の曲がる路地は暗渠化された小川の名残。' },
  ],
  建築: [
    { title: '看板建築を探す', action: '商店街で正面だけ洋風の建物を探そう。', trivia: '{a}の商店街には看板建築が点在する。' },
    { title: '銭湯を見上げる', action: '宮造りの破風や煙突を観察しよう。', trivia: '{a}の銭湯は地域の社交場でもあった。' },
  ],
  道路: [
    { title: '街道の直線を歩く', action: '{a}の旧街道を歩き、道幅と線形を体感しよう。', trivia: '{a}の街道は物資輸送や参詣の道として開かれた。' },
    { title: '変則交差点を観察', action: '放射と格子が交わる三角地を探そう。', trivia: '{a}では放射状街道と区画が交わり変則交差点が生まれる。' },
  ],
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

    const stepCount = 3 + Math.floor(rand() * 2);
    const steps: ChallengeStep[] = [];
    for (let s = 0; s < stepCount; s++) {
      const cat = theme.cats[s % theme.cats.length];
      const tmpl = STEP_TMPL[cat][Math.floor(rand() * STEP_TMPL[cat].length)];
      steps.push({
        id: `s${s}`,
        title: tmpl.title,
        action: tmpl.action.replace(/\{a\}/g, place),
        triviaCategory: cat,
        trivia: tmpl.trivia.replace(/\{a\}/g, place),
        lat: +(goalLat + (rand() - 0.5) * 0.006).toFixed(5),
        lng: +(goalLng + (rand() - 0.5) * 0.006).toFixed(5),
      });
    }
    // 最後は写真ミッション
    steps.push({ id: `s${stepCount}`, title: 'お気に入りを撮影', action: `${place}で気になった景色を1枚撮ろう。`, photo: true, lat: goalLat, lng: goalLng });

    out.push({
      id: `chg-${i}`,
      title: `${area.name} ${theme.title}`,
      description: `${area.name}を舞台にした${theme.title}。街歩きの蘊蓄を集めながらゴールを目指そう。`,
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
