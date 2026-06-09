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

/**
 * A から B への方位角（度・北を0として時計回り）。
 * 北向きの矢印を rotate(この値)deg すると、北上マップ上で目的地の方向を指す。
 */
export function bearingDeg(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(bLng - aLng);
  const y = Math.sin(dLng) * Math.cos(toRad(bLat));
  const x =
    Math.cos(toRad(aLat)) * Math.sin(toRad(bLat)) -
    Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/**
 * 始点から距離(km)・方位(度・北0時計回り)だけ進んだ地点の座標（bearingDeg の逆）。
 * 場を「約500m / 1000m / 3000m 先」など任意の距離・向きに散りばめて生成するのに使う。
 */
export function destinationPoint(
  lat: number,
  lng: number,
  distanceKm: number,
  bearing: number,
): { lat: number; lng: number } {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const angular = distanceKm / R; // 中心角（ラジアン）
  const theta = toRad(bearing);
  const phi1 = toRad(lat);
  const lambda1 = toRad(lng);
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(angular) + Math.cos(phi1) * Math.sin(angular) * Math.cos(theta),
  );
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(angular) * Math.cos(phi1),
      Math.cos(angular) - Math.sin(phi1) * Math.sin(phi2),
    );
  // 経度を -180..180 に正規化
  return { lat: toDeg(phi2), lng: ((toDeg(lambda2) + 540) % 360) - 180 };
}
