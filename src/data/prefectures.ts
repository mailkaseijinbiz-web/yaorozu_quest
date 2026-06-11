// 都道府県のおおまかな中心座標。御朱印を「最寄りの都道府県」でグルーピングするのに使う。
// 厳密な行政界判定ではなく、中心からの最短距離で割り当てる軽量・オフラインの近似。

export interface Prefecture {
  name: string;
  lat: number;
  lng: number;
}

export const PREFECTURES: Prefecture[] = [
  { name: '北海道', lat: 43.06, lng: 141.35 },
  { name: '青森県', lat: 40.82, lng: 140.74 },
  { name: '岩手県', lat: 39.70, lng: 141.15 },
  { name: '宮城県', lat: 38.27, lng: 140.87 },
  { name: '秋田県', lat: 39.72, lng: 140.10 },
  { name: '山形県', lat: 38.24, lng: 140.36 },
  { name: '福島県', lat: 37.75, lng: 140.47 },
  { name: '茨城県', lat: 36.34, lng: 140.45 },
  { name: '栃木県', lat: 36.57, lng: 139.88 },
  { name: '群馬県', lat: 36.39, lng: 139.06 },
  { name: '埼玉県', lat: 35.86, lng: 139.65 },
  { name: '千葉県', lat: 35.61, lng: 140.12 },
  { name: '東京都', lat: 35.69, lng: 139.69 },
  { name: '神奈川県', lat: 35.45, lng: 139.64 },
  { name: '新潟県', lat: 37.90, lng: 139.02 },
  { name: '富山県', lat: 36.70, lng: 137.21 },
  { name: '石川県', lat: 36.59, lng: 136.63 },
  { name: '福井県', lat: 36.07, lng: 136.22 },
  { name: '山梨県', lat: 35.66, lng: 138.57 },
  { name: '長野県', lat: 36.65, lng: 138.18 },
  { name: '岐阜県', lat: 35.39, lng: 136.72 },
  { name: '静岡県', lat: 34.98, lng: 138.38 },
  { name: '愛知県', lat: 35.18, lng: 136.91 },
  { name: '三重県', lat: 34.73, lng: 136.51 },
  { name: '滋賀県', lat: 35.00, lng: 135.87 },
  { name: '京都府', lat: 35.02, lng: 135.76 },
  { name: '大阪府', lat: 34.69, lng: 135.52 },
  { name: '兵庫県', lat: 34.69, lng: 135.18 },
  { name: '奈良県', lat: 34.69, lng: 135.83 },
  { name: '和歌山県', lat: 34.23, lng: 135.17 },
  { name: '鳥取県', lat: 35.50, lng: 134.24 },
  { name: '島根県', lat: 35.47, lng: 133.05 },
  { name: '岡山県', lat: 34.66, lng: 133.93 },
  { name: '広島県', lat: 34.40, lng: 132.46 },
  { name: '山口県', lat: 34.19, lng: 131.47 },
  { name: '徳島県', lat: 34.07, lng: 134.56 },
  { name: '香川県', lat: 34.34, lng: 134.04 },
  { name: '愛媛県', lat: 33.84, lng: 132.77 },
  { name: '高知県', lat: 33.56, lng: 133.53 },
  { name: '福岡県', lat: 33.61, lng: 130.42 },
  { name: '佐賀県', lat: 33.25, lng: 130.30 },
  { name: '長崎県', lat: 32.74, lng: 129.87 },
  { name: '熊本県', lat: 32.79, lng: 130.74 },
  { name: '大分県', lat: 33.24, lng: 131.61 },
  { name: '宮崎県', lat: 31.91, lng: 131.42 },
  { name: '鹿児島県', lat: 31.56, lng: 130.56 },
  { name: '沖縄県', lat: 26.21, lng: 127.68 },
];

/** 緯度経度から最寄りの都道府県名を返す（中心からの最短距離で割り当てる近似）。 */
export function prefectureOf(lat: number, lng: number): string {
  let best = PREFECTURES[0];
  let bestD = Infinity;
  for (const p of PREFECTURES) {
    const dLat = lat - p.lat;
    const dLng = (lng - p.lng) * Math.cos((lat * Math.PI) / 180); // 経度方向を緯度で補正
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best.name;
}
