// PWA（ホーム画面追加／スタンドアロン起動）判定のクライアント用ユーティリティ。
// SSR では window 不在のため、呼び出しは useEffect 等のクライアント実行に限ること。

/** スマホ（モバイル）端末か。ホーム画面追加クエストはモバイルのみ対象。 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/** すでにホーム画面から（スタンドアロンで）起動しているか＝インストール済み。 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mm = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  // iOS Safari は navigator.standalone を使う
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(mm || iosStandalone);
}

/** ホーム画面追加クエストを提示すべきか（モバイル かつ 未インストール）。 */
export function shouldOfferHomescreenQuest(): boolean {
  return isMobileDevice() && !isStandalone();
}

/** 端末・ブラウザの種別（手順の出し分け用）。 */
export type HomeAddPlatform = 'ios' | 'android' | 'other';

export function homeAddPlatform(): HomeAddPlatform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}
