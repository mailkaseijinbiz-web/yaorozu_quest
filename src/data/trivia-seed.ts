// 町歩きの蘊蓄データベース 生成器（約1000件）
// -----------------------------------------------------------------------------
// 東京各エリア × 分類（地形・歴史・建築・道路）で、街歩きの豆知識を
// 手続き的に生成し、管理コンソールの蘊蓄DBに収集・保持する。
// 決定論的PRNG（mulberry32）でシードするため毎回同じ並びになる。
// -----------------------------------------------------------------------------

import type { TriviaEntry } from '../lib/db';

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AREAS = [
  '新中野', '中野', '高円寺', '阿佐ヶ谷', '荻窪', '新宿', '渋谷', '吉祥寺', '池袋', '上野',
  '浅草', '秋葉原', '銀座', '品川', '目黒', '世田谷', '下北沢', '練馬', '錦糸町', '北千住',
  '蒲田', '立川', '三鷹', '神楽坂', '谷中', '根津', '本郷', '築地', '月島', '深川',
];

const CATEGORIES: TriviaEntry['category'][] = ['地形', '歴史', '建築', '道路'];

// 分類ごとの蘊蓄テンプレート（{a}=エリア名）
const TEMPLATES: Record<TriviaEntry['category'], { title: string; body: string }[]> = {
  地形: [
    { title: '{a}の暗渠', body: '{a}にはかつての小川を暗渠化した路地が残る。S字に曲がる道が旧河道の名残。' },
    { title: '{a}の台地と低地', body: '{a}は武蔵野台地の縁にあたり、坂を下ると旧河川沿いの低地が広がる。' },
    { title: '{a}の谷戸地形', body: '{a}周辺は谷戸（やと）と呼ばれる浅い谷が入り組み、湧水が池や用水を育んだ。' },
    { title: '{a}の崖線', body: '{a}には国分寺崖線につながる段差があり、神社や屋敷林が崖の上に並ぶ。' },
    { title: '{a}の旧海岸線', body: '{a}の低地はかつての入江・海辺で、埋立や干拓で陸地化した歴史を持つ。' },
  ],
  歴史: [
    { title: '{a}の宿場と門前', body: '{a}は街道の宿場や寺社の門前として栄え、茶屋や商家が軒を連ねた。' },
    { title: '{a}の地名由来', body: '{a}の地名は、かつての名主・地形・産物に由来すると伝わる。' },
    { title: '{a}の戦災と復興', body: '{a}は戦災を受け、戦後の区画整理で街路と街並みが大きく変わった。' },
    { title: '{a}の市と縁日', body: '{a}では毎月の縁日や青空市が今も続き、下町の賑わいを伝える。' },
    { title: '{a}の文人と街', body: '{a}は明治・大正期に文人や芸術家が暮らし、文化の薫りを残す。' },
  ],
  建築: [
    { title: '{a}の看板建築', body: '{a}の商店街には、正面だけを洋風に飾った看板建築が点在する。' },
    { title: '{a}の長屋・路地', body: '{a}には木造の長屋や狭い路地が残り、昭和の暮らしの面影をとどめる。' },
    { title: '{a}の銭湯建築', body: '{a}の銭湯は宮造りの破風や高い煙突が目印。地域の社交場でもあった。' },
    { title: '{a}のモダン建築', body: '{a}には昭和初期のモダン建築や駅舎が残り、タイルや曲面装飾が見どころ。' },
    { title: '{a}の蔵と商家', body: '{a}には漆喰の蔵や格子の商家が残り、防火と商いの知恵が読み取れる。' },
  ],
  道路: [
    { title: '{a}の旧街道', body: '{a}を貫く旧街道は、物資輸送や参詣の道として開かれた歴史を持つ。' },
    { title: '{a}の放射と環状', body: '{a}では放射状の街道と環状路が交わり、独特の三角地や変則交差点が生まれる。' },
    { title: '{a}の暗渠遊歩道', body: '{a}の遊歩道は暗渠化された水路の上に作られ、曲がりくねった線形が特徴。' },
    { title: '{a}の踏切と高架', body: '{a}の鉄道は踏切から高架化され、線路跡や高架下の利用に街の変化が表れる。' },
    { title: '{a}の参道と門前町', body: '{a}の参道はまっすぐ社寺へ向かい、両側に門前町の商いが発達した。' },
  ],
};

/** 約1000件の蘊蓄を生成 */
export function generateTrivia(count = 995): TriviaEntry[] {
  const rand = mulberry32(20260608);
  const out: TriviaEntry[] = [];
  for (let i = 0; i < count; i++) {
    const area = AREAS[Math.floor(rand() * AREAS.length)];
    const cat = CATEGORIES[Math.floor(rand() * CATEGORIES.length)];
    const tmpls = TEMPLATES[cat];
    const t = tmpls[Math.floor(rand() * tmpls.length)];
    const chome = 1 + Math.floor(rand() * 7);
    out.push({
      id: `trg-${i}`,
      title: t.title.replace('{a}', `${area}${chome}丁目`),
      category: cat,
      area,
      content: t.body.replace(/\{a\}/g, `${area}${chome}丁目`),
    });
  }
  return out;
}
