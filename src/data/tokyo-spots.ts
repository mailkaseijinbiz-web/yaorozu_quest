// 東京の「場（Spot）」生成器 — 実在の寺社のみ
// -----------------------------------------------------------------------------
// 方針:「場は実在の神社・寺院であるべき」。AI や手続きで場を発明するのではなく、
// OpenStreetMap(Overpass) 由来の実在寺社（src/data/tokyo-temples.ts）を一次情報として
// 採用し、説明・楽しみ方・神格をテンプレで付与して Spot に仕立てる。
//
// ここで作る Spot は /api/generate-spot の templateFlavor 相当（Gemini 不在時の味付け）と
// 揃えてあり、地図の初期シード（db.ts INITIAL_SPOTS）として使う。GPS 周辺の実在スポット
// 発見（/api/generate-spot）は、近接シードを再利用するため重複しない。
// -----------------------------------------------------------------------------

import type { Spot } from '../lib/db';
import { REAL_TEMPLES } from './tokyo-temples';

// kind: 1=神社 / 0=寺院。カテゴリ別の味付けテンプレ。
const FLAVOR = {
  1: {
    category: '神社',
    emoji: '⛩️',
    god: '杜の守り神',
    enjoy: (n: string) => [`${n}の鳥居をくぐり参道を歩く`, '静かに参拝して心を整える', '境内の四季の移ろいを感じる'],
    issues: ['参道脇の落ち葉やゴミを一袋拾う', '由緒書きの薄れた箇所を写真に残す'],
  },
  0: {
    category: '寺院',
    emoji: '🙏',
    god: '御仏の使い',
    enjoy: (n: string) => [`${n}の山門をくぐり本堂を仰ぐ`, '線香の香りの中で手を合わせる', '庭や石畳の静けさを味わう'],
    issues: ['案内の薄い角に道標写真を一枚足す', '静けさを乱す放置ゴミを一つ片付ける'],
  },
} as const;

/**
 * 実在の寺社（OSM 由来）から場（Spot）を生成して返す。
 * 並びは tokyo-temples.ts の安定ソート順（緯度→経度）で決定論的。
 * @param count 生成数（既定は全件）。プレビュー用に先頭 N 件へ絞れる。
 */
export function generateTokyoSpots(count = REAL_TEMPLES.length): Spot[] {
  const n = Math.min(count, REAL_TEMPLES.length);
  const spots: Spot[] = [];

  for (let i = 0; i < n; i++) {
    const [name, lat, lng, kind] = REAL_TEMPLES[i];
    const f = FLAVOR[kind];
    const godName = `${name}の${f.god}`;

    spots.push({
      // 安定 ID。GPS 発見スポット(osm-node-…)とは別名前空間にしつつ、
      // 近接(~120m)再利用で実質的に重複しない。
      id: `osm-seed-${i}`,
      name,
      description: `${name}（${f.category}）。実在するこの地に宿る神霊が、訪れる人を静かに見守っている。`,
      latitude: lat,
      longitude: lng,
      creatorId: null,
      imageUrl: '', // 写真はユーザーが奉納するまで NO IMAGE
      photos: [],
      category: f.category,
      tokuRequirement: 0,
      enjoyments: f.enjoy(name),
      difficulty: 1,
      terrain: 1,
      attributes: [],
      cacheType: 'Virtual',
      godName,
      godEmoji: f.emoji,
      godRequests: [`${f.emoji} ${name}の今の様子を写真に撮ってほしいのじゃ`, 'この場の良いところを一つ教えてくれぬか'],
      issues: [...f.issues],
      verified: true, // OSM 由来＝実在。TTL は付けない（期限切れで消えない）。
    });
  }

  return spots;
}
