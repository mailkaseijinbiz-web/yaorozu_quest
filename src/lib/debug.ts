// デバッグモード — 位置情報が許可されない環境（PCブラウザ・テスト環境等）でも
// 現在地を手動指定してアプリをテストできるようにする仕組み。
//
// 有効化:
//   - URL に `?debug=1` を付けてアクセスすると有効化され、以降 localStorage に保持される。
//   - `?debug=0` で無効化（保持フラグも削除）。
// デバッグ位置:
//   - 有効時は実 GPS を呼ばず、手動設定した座標（無ければ既定地点）を現在地として使う。

const FLAG_KEY = 'yaorozu_debug';            // デバッグモード有効フラグ
const LOC_KEY = 'yaorozu_debug_location';    // 手動設定した現在地（{lat,lng}）

export interface DebugLatLng {
  lat: number;
  lng: number;
}

/** デバッグモードが有効か。URL の ?debug=1/0 を反映してから localStorage を見る。 */
export function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  // 本番ビルドでは無効化（位置偽装によるチャレンジのジオフェンス回避を防ぐ）。
  // process.env.NODE_ENV はビルド時に静的置換されるため、クライアントでも安全に分岐できる。
  if (process.env.NODE_ENV !== 'development') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('debug');
    if (q === '1') localStorage.setItem(FLAG_KEY, '1');
    else if (q === '0') {
      localStorage.removeItem(FLAG_KEY);
      localStorage.removeItem(LOC_KEY);
    }
  } catch {
    /* URL/localStorage 参照不可な環境では無視 */
  }
  try {
    return localStorage.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

/** デバッグモードの有効・無効を明示的に切り替える。 */
export function setDebugEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (on) {
      localStorage.setItem(FLAG_KEY, '1');
    } else {
      localStorage.removeItem(FLAG_KEY);
      localStorage.removeItem(LOC_KEY);
    }
  } catch {
    /* 無視 */
  }
}

/** 手動設定された現在地を返す（未設定なら null）。 */
export function getDebugLocation(): DebugLatLng | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOC_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.lat === 'number' && typeof v?.lng === 'number' && !isNaN(v.lat) && !isNaN(v.lng)) {
      return { lat: v.lat, lng: v.lng };
    }
  } catch {
    /* 破損値は無視 */
  }
  return null;
}

/** 手動現在地を保存（null で消去）。 */
export function setDebugLocation(loc: DebugLatLng | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (loc) localStorage.setItem(LOC_KEY, JSON.stringify({ lat: loc.lat, lng: loc.lng }));
    else localStorage.removeItem(LOC_KEY);
  } catch {
    /* 無視 */
  }
}

/** テスト用プリセット地点（東京近辺）。 */
export const DEBUG_PRESETS: { name: string; lat: number; lng: number }[] = [
  { name: '東京駅', lat: 35.6812, lng: 139.7671 },
  { name: '浅草寺', lat: 35.7148, lng: 139.7967 },
  { name: '渋谷', lat: 35.6580, lng: 139.7016 },
  { name: '汐留', lat: 35.6657, lng: 139.7626 },
  { name: '新中野', lat: 35.6925, lng: 139.6636 },
  { name: '明治神宮', lat: 35.6764, lng: 139.6993 },
];
