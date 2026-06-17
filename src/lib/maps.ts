// 「ここに行く」用：Google マップの経路案内を別タブで開くユーティリティ。
// 端末を問わず常に Google マップ（ブラウザ）を新規タブで起動する。

/** 目的地（緯度経度）への Google マップ経路案内 URL。 */
export function googleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** 目的地への Google マップ経路案内を別タブで開く。 */
export function openGoogleMapsDirections(lat: number, lng: number): void {
  if (typeof window === 'undefined') return;
  window.open(googleMapsDirectionsUrl(lat, lng), '_blank', 'noopener,noreferrer');
}
