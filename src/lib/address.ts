// 逆ジオコーディング（座標 → 住所）。
// -----------------------------------------------------------------------------
// Nominatim (OpenStreetMap) の reverse API で日本語住所を引く。
// 結果はメモリ＋localStorage にキャッシュし、同じ寺社の再訪では即時に返す
// （Nominatim の利用ポリシー＝低頻度アクセスにも配慮）。
// -----------------------------------------------------------------------------

const LS_KEY = 'yaorozu_addr_cache_v1';
const MAX_ENTRIES = 300;

const memory = new Map<string, string>();

const keyOf = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

function loadCache(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, string>): void {
  try {
    const keys = Object.keys(cache);
    // 上限を超えたら古い順（挿入順）に間引く
    if (keys.length > MAX_ENTRIES) {
      for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete cache[k];
    }
    localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch {
    /* 容量超過などは無視（キャッシュなしでも動く） */
  }
}

/** Nominatim の address オブジェクトから簡潔な日本語住所を組み立てる */
function composeAddress(a: Record<string, string | undefined>, displayName?: string): string {
  const parts = [
    a.state ?? a.province,
    a.city ?? a.town ?? a.village ?? a.municipality,
    a.city_district ?? a.suburb ?? a.neighbourhood ?? a.quarter,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join('');
  return displayName ?? '';
}

/**
 * 座標の住所（例: 長野県長野市箱清水）を返す。取得できなければ null。
 * 失敗は静かに null（UI 側は表示しないだけ）。
 */
export async function getAddress(lat: number, lng: number): Promise<string | null> {
  const key = keyOf(lat, lng);
  const hit = memory.get(key);
  if (hit) return hit;
  const cache = loadCache();
  if (cache[key]) {
    memory.set(key, cache[key]);
    return cache[key];
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=ja&zoom=16&lat=${lat}&lon=${lng}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const addr = composeAddress(json?.address ?? {}, json?.display_name).trim();
    if (!addr) return null;
    memory.set(key, addr);
    cache[key] = addr;
    saveCache(cache);
    return addr;
  } catch {
    return null;
  }
}
