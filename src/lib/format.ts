// 距離表記をアプリ全体で統一するためのフォーマッタ。
// クエストタブの表記に合わせる：1km未満は「m」（整数）、1km以上は「km」（小数1桁）。

/** 例: 0.192 → "192 m" / 9.24 → "9.2 km" */
export function formatDistance(km: number): string {
  if (!isFinite(km) || km < 0) return '— m';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** 値と単位を分けて欲しい場合（スタイルを分けたい時用） */
export function formatDistanceParts(km: number): { value: string; unit: 'm' | 'km' } {
  if (km < 1) return { value: `${Math.round(km * 1000)}`, unit: 'm' };
  return { value: km.toFixed(1), unit: 'km' };
}
