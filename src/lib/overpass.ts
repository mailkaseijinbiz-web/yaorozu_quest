// Overpass (OpenStreetMap) で GPS 周辺の「実在する場所」を引くサーバー専用ユーティリティ。
// 返すのは場（Spot）の素材＝実在の名称・座標・カテゴリのみ。
// 説明・楽しみ方・課題・神格は呼び出し側（/api/generate-spot）で付与する。
//
// 設計意図: 「場は意味のある実在の場所であるべき」。AI に場を発明させるのではなく、
// 実在の POI（神社・寺院・公園・史跡・自然・文化施設…）を一次情報として採用する。

/** 場のカテゴリ（唯一の真実）。/api/generate-spot と共有する。 */
export const CATEGORIES = [
  '神社', '寺院', '公園', '商店街', '広場', '史跡', '自然', '文化施設', '川・池', '坂・路地',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Overpass から得た実在スポット1件。 */
export interface RealPlace {
  id: string;        // 'osm-node-123456'（安定 ID。再訪で同一スポットへ upsert される）
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  name: string;
  latitude: number;
  longitude: number;
  category: Category;
  distanceM: number; // 検索中心からの距離（m）
  tags: Record<string, string>;
}

// 公開 Overpass エンドポイント（順にフェイルオーバー）。
// 1台が busy（Dispatcher timeout の XHTML を 200 で返す）でも res.json() が throw → 次へ。
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

const inSet = (v: string | undefined, ...vals: string[]): boolean =>
  v != null && vals.includes(v);

/**
 * OSM タグ群を場の 10 カテゴリへ写像する。対象外なら null。
 * 優先順位: 神社/寺院（テーマの中核）→ 文化施設 → 史跡 → 川・池 → 自然 → 公園 → 広場 → 商店街 → 坂・路地。
 */
function mapCategory(tags: Record<string, string>): Category | null {
  const name = tags['name:ja'] || tags.name || '';

  // 神社（神道）
  if (tags.religion === 'shinto' || tags.building === 'shrine') return '神社';
  // 寺院（仏教）
  if (tags.religion === 'buddhist' || tags.building === 'temple') return '寺院';
  // 宗教施設だが religion 未指定 → 名称から推定
  if (tags.amenity === 'place_of_worship') {
    if (/神社|神宮|大社|天満宮|八幡|稲荷|宮|社$/.test(name)) return '神社';
    if (/寺|院|大師|不動|観音|地蔵|堂/.test(name)) return '寺院';
    return '神社'; // 鳥居がテーマの中心。既定は神社。
  }

  // 文化施設
  if (inSet(tags.tourism, 'museum', 'gallery') || inSet(tags.amenity, 'theatre', 'library', 'arts_centre')) {
    return '文化施設';
  }
  // 史跡
  if (tags.historic) return '史跡';
  // 川・池
  if (tags.natural === 'water' || tags.water || inSet(tags.waterway, 'river', 'stream', 'canal')) {
    return '川・池';
  }
  // 自然
  if (inSet(tags.natural, 'wood', 'peak', 'spring', 'grassland', 'tree') || tags.leisure === 'nature_reserve') {
    return '自然';
  }
  // 公園
  if (inSet(tags.leisure, 'park', 'garden')) return '公園';
  // 広場
  if (tags.place === 'square') return '広場';
  // 商店街
  if (tags.shop === 'mall' || tags.landuse === 'retail') return '商店街';
  // 坂・路地（名称に「坂」を含む道）
  if (tags.highway && /坂/.test(name)) return '坂・路地';
  // 観光名所など → 史跡扱い
  if (inSet(tags.tourism, 'attraction', 'artwork')) return '史跡';

  return null;
}

/** 指定座標・半径の周辺 POI を引く Overpass QL を組み立てる。 */
function buildQuery(lat: number, lng: number, radiusM: number): string {
  const c = `${Math.round(radiusM)},${lat.toFixed(6)},${lng.toFixed(6)}`;
  return `[out:json][timeout:10];
(
  nwr(around:${c})["amenity"="place_of_worship"]["name"];
  nwr(around:${c})["building"~"^(shrine|temple)$"]["name"];
  nwr(around:${c})["leisure"~"^(park|garden|nature_reserve)$"]["name"];
  nwr(around:${c})["historic"]["name"];
  nwr(around:${c})["tourism"~"^(museum|gallery|artwork|attraction)$"]["name"];
  nwr(around:${c})["amenity"~"^(theatre|library|arts_centre)$"]["name"];
  nwr(around:${c})["natural"~"^(water|wood|peak|spring|grassland|tree)$"]["name"];
  nwr(around:${c})["waterway"~"^(river|stream|canal)$"]["name"];
  nwr(around:${c})["place"="square"]["name"];
  nwr(around:${c})["shop"="mall"]["name"];
  nwr(around:${c})["landuse"="retail"]["name"];
  nwr(around:${c})["highway"]["name"~"坂"];
);
out center 100;`;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * GPS 座標の周辺から実在スポットを近い順に返す。
 * @param radiusM 検索半径（m）
 * @param limit   返す最大件数
 */
export async function lookupRealPlaces(
  lat: number,
  lng: number,
  radiusM = 1000,
  limit = 8,
): Promise<RealPlace[]> {
  const query = buildQuery(lat, lng, radiusM);

  // 1 エンドポイントに JSON を要求。!ok や busy 時の XHTML(200) は throw 扱いにし、
  // Promise.any で「最初に成功したエンドポイント」を採用する＝総待ち時間を 1 タイムアウトに収める。
  const fetchJson = async (endpoint: string): Promise<{ elements?: OverpassElement[] }> => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        // ※ text/plain は Overpass が 406 を返す。x-www-form-urlencoded で生クエリを送る。
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'YaorozuQuest/1.0 (real-place discovery)',
      },
      body: query,
      signal: AbortSignal.timeout(6_000), // 1 エンドポイントあたり最大 6s
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`overpass ${res.status}`);
    return (await res.json()) as { elements?: OverpassElement[] }; // busy=XHTML は parse 失敗→敗退
  };

  let data: { elements?: OverpassElement[] } | null = null;
  try {
    // 並列レース：3 エンドポイントへ各 1 リクエスト。最速の成功を採用（最悪でも ~6s）。
    data = await Promise.any(ENDPOINTS.map(fetchJson));
  } catch {
    return []; // 全エンドポイント失敗（busy/ダウン）→ 呼び出し側は AI フォールバックへ
  }
  if (!data?.elements) return [];

  const seen = new Set<string>();
  const out: RealPlace[] = [];
  for (const el of data.elements) {
    const tags = el.tags ?? {};
    const name = tags['name:ja'] || tags.name;
    if (!name) continue;
    const category = mapCategory(tags);
    if (!category) continue;
    const plat = el.lat ?? el.center?.lat;
    const plng = el.lon ?? el.center?.lon;
    if (typeof plat !== 'number' || typeof plng !== 'number') continue;

    const id = `osm-${el.type}-${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({
      id,
      osmType: el.type,
      osmId: el.id,
      name: String(name).slice(0, 40),
      latitude: plat,
      longitude: plng,
      category,
      distanceM: haversineM(lat, lng, plat, plng),
      tags,
    });
  }

  out.sort((a, b) => a.distanceM - b.distanceM);
  return out.slice(0, limit);
}
