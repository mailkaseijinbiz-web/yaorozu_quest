// 地理計算ユーティリティ。各コンポーネントに散在していた距離計算を集約。

/**
 * 2点間の大圏距離（km）。Haversine 公式。
 * 現在地からの実距離表示・近接判定に使う。
 */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * 概算距離（度ベース・経度を緯度補正）。正確さより速度が要る並べ替え用。
 * 単位は km ではない（相対比較専用）。
 */
export function roughDistance(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = aLat - bLat;
  const dLng = (aLng - bLng) * Math.cos((aLat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}
