// 東京周辺 1000スポット 生成器
// -----------------------------------------------------------------------------
// 八百万クエストの世界を東京全域へ拡張するため、各エリアを中心に
// 神社・寺院・公園・商店街・商業施設・飲食店などを手続き的に生成する。
// 決定論的PRNG（mulberry32）でシードするため、毎回同じ並びになる。
// -----------------------------------------------------------------------------

import { Spot } from '../lib/db';

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 東京の代表エリア（中心座標）
const REAL_TEMPLES: { name: string; lat: number; lng: number }[] = [
  {
    "name": "波除神社",
    "lat": 35.6635082,
    "lng": 139.7715877
  },
  {
    "name": "嚴嶋神社",
    "lat": 35.6975939,
    "lng": 139.713373
  },
  {
    "name": "白山神社",
    "lat": 35.7218967,
    "lng": 139.7505773
  },
  {
    "name": "須賀神社",
    "lat": 35.6853339,
    "lng": 139.7225263
  },
  {
    "name": "日枝神社",
    "lat": 35.674685,
    "lng": 139.7398822
  },
  {
    "name": "三島神社",
    "lat": 35.724701,
    "lng": 139.7861395
  },
  {
    "name": "正福寺",
    "lat": 35.7645498,
    "lng": 139.459286
  },
  {
    "name": "稲荷神社",
    "lat": 35.7688092,
    "lng": 139.6759539
  },
  {
    "name": "尉殿神社",
    "lat": 35.7438019,
    "lng": 139.5503089
  },
  {
    "name": "隅田川神社",
    "lat": 35.7329191,
    "lng": 139.8129722
  },
  {
    "name": "氷川神社",
    "lat": 35.6681094,
    "lng": 139.7358306
  },
  {
    "name": "小豆澤神社",
    "lat": 35.7802116,
    "lng": 139.6991254
  },
  {
    "name": "諏訪神社",
    "lat": 35.708968,
    "lng": 139.7076837
  },
  {
    "name": "春日神社",
    "lat": 35.6927518,
    "lng": 139.6094159
  },
  {
    "name": "天祖神社",
    "lat": 35.7065662,
    "lng": 139.8209451
  },
  {
    "name": "香取神社",
    "lat": 35.7044169,
    "lng": 139.8254918
  },
  {
    "name": "愛宕神社",
    "lat": 35.6649676,
    "lng": 139.7486937
  },
  {
    "name": "薭田神社",
    "lat": 35.5645534,
    "lng": 139.7227841
  },
  {
    "name": "布多天神社",
    "lat": 35.6567931,
    "lng": 139.5454405
  },
  {
    "name": "田無神社",
    "lat": 35.7298951,
    "lng": 139.5440509
  },
  {
    "name": "八幡神社",
    "lat": 35.6615415,
    "lng": 139.7427653
  },
  {
    "name": "鳥越神社",
    "lat": 35.7020259,
    "lng": 139.7857661
  },
  {
    "name": "七社神社",
    "lat": 35.7483965,
    "lng": 139.7414966
  },
  {
    "name": "御園神社",
    "lat": 35.5630242,
    "lng": 139.7106379
  },
  {
    "name": "女塚神社",
    "lat": 35.565467,
    "lng": 139.7123615
  },
  {
    "name": "遍照院",
    "lat": 35.7904358,
    "lng": 139.8593515
  },
  {
    "name": "富士浅間神社",
    "lat": 35.6723589,
    "lng": 139.7991956
  },
  {
    "name": "浅間神社",
    "lat": 35.7383512,
    "lng": 139.6724681
  },
  {
    "name": "水元神社",
    "lat": 35.7914134,
    "lng": 139.8512055
  },
  {
    "name": "冨士神社",
    "lat": 35.7312141,
    "lng": 139.7511561
  },
  {
    "name": "富士神社",
    "lat": 35.7312141,
    "lng": 139.7511561
  },
  {
    "name": "浅間社",
    "lat": 35.5873769,
    "lng": 139.6687876
  },
  {
    "name": "烏森神社",
    "lat": 35.6667952,
    "lng": 139.7568175
  },
  {
    "name": "浅草神社",
    "lat": 35.7148087,
    "lng": 139.7974977
  },
  {
    "name": "品川神社",
    "lat": 35.6185225,
    "lng": 139.7399926
  },
  {
    "name": "八雲神社",
    "lat": 35.7861048,
    "lng": 139.7249182
  },
  {
    "name": "札次神社",
    "lat": 35.6007336,
    "lng": 139.3664199
  },
  {
    "name": "桜神宮",
    "lat": 35.632163,
    "lng": 139.647098
  },
  {
    "name": "石濱神社",
    "lat": 35.345928,
    "lng": 139.6182312
  },
  {
    "name": "東福寺",
    "lat": 35.7273567,
    "lng": 139.6680027
  },
  {
    "name": "明治神宮",
    "lat": 35.6748417,
    "lng": 139.6996266
  },
  {
    "name": "浅草寺",
    "lat": 35.7134032,
    "lng": 139.7955265
  },
  {
    "name": "神田明神",
    "lat": 35.7019403,
    "lng": 139.7677388
  },
  {
    "name": "靖国神社",
    "lat": 35.6942529,
    "lng": 139.7432734
  },
  {
    "name": "増上寺",
    "lat": 35.6572781,
    "lng": 139.7483432
  },
  {
    "name": "湯島天満宮",
    "lat": 35.7076902,
    "lng": 139.7680519
  },
  {
    "name": "根津神社",
    "lat": 35.7199731,
    "lng": 139.7606625
  },
  {
    "name": "大國魂神社",
    "lat": 35.667479,
    "lng": 139.4789703
  },
  {
    "name": "深大寺",
    "lat": 35.6674609,
    "lng": 139.5502762
  },
  {
    "name": "池上本門寺",
    "lat": 35.5789017,
    "lng": 139.7051955
  },
  {
    "name": "西新井大師",
    "lat": 35.7798732,
    "lng": 139.7802586
  },
  {
    "name": "高尾山薬王院",
    "lat": 35.6259997,
    "lng": 139.2504407
  },
  {
    "name": "護国寺",
    "lat": 35.7209953,
    "lng": 139.7268326
  },
  {
    "name": "泉岳寺",
    "lat": 35.6386825,
    "lng": 139.7400118
  },
  {
    "name": "築地本願寺",
    "lat": 35.6665999,
    "lng": 139.7721277
  }
];

const AREAS: { name: string; lat: number; lng: number }[] = [
  { name: '新宿', lat: 35.6896, lng: 139.7006 },
  { name: '渋谷', lat: 35.6580, lng: 139.7016 },
  { name: '中野', lat: 35.7056, lng: 139.6657 },
  { name: '新中野', lat: 35.6957, lng: 139.6655 },
  { name: '高円寺', lat: 35.7053, lng: 139.6497 },
  { name: '吉祥寺', lat: 35.7030, lng: 139.5800 },
  { name: '池袋', lat: 35.7295, lng: 139.7109 },
  { name: '上野', lat: 35.7138, lng: 139.7770 },
  { name: '浅草', lat: 35.7148, lng: 139.7967 },
  { name: '秋葉原', lat: 35.6984, lng: 139.7731 },
  { name: '東京', lat: 35.6812, lng: 139.7671 },
  { name: '銀座', lat: 35.6717, lng: 139.7650 },
  { name: '品川', lat: 35.6285, lng: 139.7387 },
  { name: '目黒', lat: 35.6339, lng: 139.7156 },
  { name: '世田谷', lat: 35.6464, lng: 139.6531 },
  { name: '下北沢', lat: 35.6613, lng: 139.6680 },
  { name: '荻窪', lat: 35.7046, lng: 139.6200 },
  { name: '阿佐ヶ谷', lat: 35.7048, lng: 139.6360 },
  { name: '練馬', lat: 35.7357, lng: 139.6517 },
  { name: '錦糸町', lat: 35.6970, lng: 139.8146 },
  { name: '北千住', lat: 35.7497, lng: 139.8050 },
  { name: '蒲田', lat: 35.5614, lng: 139.7160 },
  { name: '立川', lat: 35.6939, lng: 139.4137 },
  { name: '町田', lat: 35.5436, lng: 139.4467 },
  { name: '三鷹', lat: 35.7027, lng: 139.5604 },
];

interface CategorySpec {
  category: string;
  suffixes: string[];
  godNames: string[];
  godEmojis: string[];
  attributes: string[];
  descTemplate: (place: string) => string;
  enjoyments: (place: string) => string[];
}

const CATEGORIES: CategorySpec[] = [
  {
    category: '神社',
    suffixes: ['神社', '稲荷神社', '八幡神社', '天神社', '氷川神社'],
    godNames: ['杜の守り神', '稲荷の白狐', '産土の神', '雷の神', '縁結びの神'],
    godEmojis: ['⛩️', '🦊', '🌸', '⚡', '🪶'],
    attributes: ['⛩️ 神社', '🌳 緑あり', '🙏 参拝', '📿 御朱印'],
    descTemplate: (p) => `${p}の鎮守。地域に親しまれ、四季折々の表情を見せる神社。`,
    enjoyments: (p) => [`${p}で静かに参拝し心を整える`, '御朱印やお守りを授かる', '境内の木々の四季を感じる'],
  },
  {
    category: '寺院',
    suffixes: ['寺', '院', '大師', '不動尊', '観音堂'],
    godNames: ['守り仏', '薬師の守り神', '不動明王の使い', '観音の慈み', '地蔵の守り'],
    godEmojis: ['🙏', '💊', '🔥', '🪷', '🧘'],
    attributes: ['🏛️ 寺院', '🍵 静謐', '🙏 参拝', '👪 ファミリー向け'],
    descTemplate: (p) => `${p}にある歴史ある寺院。静かな境内に本堂が佇む。`,
    enjoyments: (p) => [`${p}の本堂で手を合わせる`, '山門や仏像の建築美を眺める', '写経や座禅の体験を探す'],
  },
  {
    category: '公園',
    suffixes: ['公園', '緑地', '児童公園', '森林公園', '河川敷'],
    godNames: ['木の精霊', '緑の守り手', '池の主', '風の精', '花の精'],
    godEmojis: ['🌳', '🍃', '🦆', '🌬️', '🌸'],
    attributes: ['🌳 公園', '☀️ 散歩向き', '👪 ファミリー向け', '🌸 季節の花'],
    descTemplate: (p) => `${p}の憩いの場。四季の緑と空が広がる地域の公園。`,
    enjoyments: (p) => [`${p}のベンチで休む`, '季節の花や紅葉を眺める', '夕暮れの空を撮影する'],
  },
  {
    category: '商店街',
    suffixes: ['商店街', '銀座商店街', '中央商店会', '本通り', '仲見世'],
    godNames: ['商売の神', '下町の守り神', '招き猫の精', '提灯の神', '人情の神'],
    godEmojis: ['🏮', '🐱', '🍶', '🎏', '🍡'],
    attributes: ['🏮 下町情緒', '🍺 居酒屋', '🍽️ 食べ歩き', '🚶 散歩向き'],
    descTemplate: (p) => `${p}の活気ある商店街。昔ながらの店と新店が共存する。`,
    enjoyments: (p) => [`${p}を食べ歩く`, '隠れた名店を発見する', '夜の下町情緒を味わう'],
  },
  {
    category: '商業施設',
    suffixes: ['ビル', 'モール', 'プラザ', 'マーケット', 'タウン'],
    godNames: ['商いの神', '賑わいの神', 'サブカルの神', '繁盛の神', '流行の神'],
    godEmojis: ['🛍️', '🎮', '🏬', '💴', '✨'],
    attributes: ['🛍️ ショッピング', '🍦 グルメ', '🎮 サブカル', '☔ 雨でもOK'],
    descTemplate: (p) => `${p}の商業施設。買い物やグルメが集まる賑わいの場。`,
    enjoyments: (p) => [`${p}で買い物を楽しむ`, '話題のグルメを味わう', '限定アイテムを探す'],
  },
  {
    category: '飲食店',
    suffixes: ['食堂', 'ラーメン店', '喫茶店', '居酒屋', '蕎麦処'],
    godNames: ['味の神', '出汁の神', '珈琲の精', '一杯の神', '麺の神'],
    godEmojis: ['🍜', '🍲', '☕', '🍶', '🍴'],
    attributes: ['🍽️ グルメ', '🍺 一杯', '🪑 隠れ家', '💴 リーズナブル'],
    descTemplate: (p) => `${p}の地元に愛される一軒。看板メニューが評判の店。`,
    enjoyments: (p) => [`${p}の名物を味わう`, '常連気分でカウンターに座る', '食後の感想を神に伝える'],
  },
];

/**
 * 東京周辺の手続き生成スポットを返す。
 * @param count 生成数（既定 993。手作りの7件と合わせて約1000）
 */
export function generateTokyoSpots(count = 993): Spot[] {
  const rand = mulberry32(20260608);
  const spots: Spot[] = [];

  for (let i = 0; i < count; i++) {
    const isRealTemple = i < REAL_TEMPLES.length;
    const area = AREAS[Math.floor(rand() * AREAS.length)];
    let cat = CATEGORIES[Math.floor(rand() * CATEGORIES.length)];
    let sIdx = Math.floor(rand() * cat.suffixes.length);
    let gIdx = Math.floor(rand() * cat.godNames.length);

    let lat = 0;
    let lng = 0;
    let name = '';
    let place = '';

    if (isRealTemple) {
      const realTemple = REAL_TEMPLES[i];
      lat = realTemple.lat;
      lng = realTemple.lng;
      name = realTemple.name;
      place = name;
      cat = name.includes('神社') || name.includes('神宮') || name.includes('明神') || name.includes('天満宮') ? CATEGORIES.find(c => c.category === '神社')! : CATEGORIES.find(c => c.category === '寺院')!;
      gIdx = Math.floor(rand() * cat.godNames.length);
    } else {
      // エリア中心から半径 ~3km 程度に散布
      const dLat = (rand() - 0.5) * 0.05;
      const dLng = (rand() - 0.5) * 0.06;
      lat = +(area.lat + dLat).toFixed(5);
      lng = +(area.lng + dLng).toFixed(5);

      const blockNo = 1 + Math.floor(rand() * 7);
      place = `${area.name}${cat.suffixes[sIdx]}`;
      name = `${area.name}${blockNo}丁目${cat.suffixes[sIdx]}`;
    }

    spots.push({
      id: `tk-${i}`,
      name,
      description: cat.descTemplate(place),
      latitude: lat,
      longitude: lng,
      creatorId: null,
      imageUrl: '', // 初期は写真なし（UGCで設定）
      photos: [],
      category: cat.category,
      tokuRequirement: 30 + Math.floor(rand() * 6) * 10,
      enjoyments: cat.enjoyments(place),
      difficulty: 1 + Math.floor(rand() * 3),
      terrain: 1 + Math.floor(rand() * 3),
      attributes: cat.attributes,
      cacheType: 'Virtual',
      godName: `${place}の${cat.godNames[gIdx]}`,
      godEmoji: cat.godEmojis[gIdx],
      godRequests: [],
    });
  }

  return spots;
}
