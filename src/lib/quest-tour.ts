// 周遊クエスト（複数の神社をまわるプラン）ビルダー
// -----------------------------------------------------------------------------
// 現在地周辺の実在神社2〜4社を歩く順（貪欲最近傍）に束ね、社ごとの観察ミッション
// （walk-missions）と実在豆知識（tokyo-trivia）を載せた「◯社めぐり」クエストを作る。
// AI不要の純関数。同じ origin・candidates・dateSeed → 同じクエスト（決定論的）。
// タスクごとの lat/lng を MapTab がそのまま順番にウェイポイント案内する。
// -----------------------------------------------------------------------------

import { questStep, type Quest, type Task } from '../data/tasks';
import { pickWalkMissions, type WalkScope } from '../data/walk-missions';
import { getTriviaNear, THEME_TO_CATEGORY } from '../data/tokyo-trivia';
import { distanceKm } from './geo';

/** db.getSpots() の Spot と構造互換の最小入力 */
export interface TourCandidate {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category?: string;
  godEmoji?: string;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * 現在地を 0.02°（約2km）グリッドに丸めた疑似スポットID。
 * saveGeneratedQuests(key, …) の差し替えキーとして使い、同エリアでの重複生成を防ぐ。
 */
export function tourAreaKey(lat: number, lng: number): string {
  const snap = (v: number) => (Math.round(v / 0.02) * 0.02).toFixed(2);
  return `tour-${snap(lat)}-${snap(lng)}`;
}

function missionScopes(category?: string): WalkScope[] {
  if (category?.includes('寺')) return ['temple', 'precinct'];
  if (category?.includes('神社')) return ['shrine', 'precinct'];
  return ['precinct'];
}

export function buildTourQuest(
  origin: { lat: number; lng: number },
  candidates: TourCandidate[],
  opts?: { radiusKm?: number; maxSpots?: number; dateSeed?: string },
): Quest | null {
  const radiusKm = opts?.radiusKm ?? 2.0;
  const maxSpots = Math.max(2, Math.min(4, opts?.maxSpots ?? 3));
  const dateSeed = opts?.dateSeed ?? 'today';

  // 圏内の候補（神社優先、2社に満たなければ寺院も混ぜる）
  const inRange = candidates
    .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude))
    .map((c) => ({ c, d: distanceKm(origin.lat, origin.lng, c.latitude, c.longitude) }))
    .filter((x) => x.d <= radiusKm)
    .sort((a, b) => a.d - b.d);
  const shrines = inRange.filter((x) => x.c.category?.includes('神社'));
  const pool = (shrines.length >= 2 ? shrines : inRange).slice(0, maxSpots * 3).map((x) => x.c);
  if (pool.length < 2) return null;

  // 貪欲最近傍で歩く順を決める（簡易TSP）
  const route: TourCandidate[] = [];
  let cur = { lat: origin.lat, lng: origin.lng };
  const rest = [...pool];
  while (route.length < maxSpots && rest.length > 0) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < rest.length; i++) {
      const d = distanceKm(cur.lat, cur.lng, rest[i].latitude, rest[i].longitude);
      if (d < bestD) { bestD = d; best = i; }
    }
    const next = rest.splice(best, 1)[0];
    route.push(next);
    cur = { lat: next.latitude, lng: next.longitude };
  }

  // 経路総距離（出発点→各社）
  let pathKm = 0;
  let prev = { lat: origin.lat, lng: origin.lng };
  for (const s of route) {
    pathKm += distanceKm(prev.lat, prev.lng, s.latitude, s.longitude);
    prev = { lat: s.latitude, lng: s.longitude };
  }

  // 社ごとの観察タスク。蘊蓄は社の近傍の実在豆知識を優先（重複は避ける）
  const usedTrivia = new Set<string>();
  const tasks: Task[] = route.map((spot, i) => {
    const mission = pickWalkMissions(spot.id, spot.category ?? '神社', i, 1, missionScopes(spot.category))[0];
    const near = getTriviaNear(spot.latitude, spot.longitude, 1.5, 3).find((t) => !usedTrivia.has(t.id));
    if (near) usedTrivia.add(near.id);
    // 2社目以降は「社ごとの見比べ」を促す一文を、収まる場合だけ添える
    const compare = i > 0 ? 'ひとつ前の社との違いも見比べてみよう。' : '';
    const action = mission.action.length + compare.length <= 120 ? `${mission.action}${compare}` : mission.action;
    return {
      ...questStep({
        id: `s${i}`,
        title: clip(`${spot.name}：${mission.title}`, 40),
        action,
        trivia: near ? clip(near.body, 140) : mission.trivia,
        triviaCategory: near ? (THEME_TO_CATEGORY[near.themes[0]] ?? '歴史') : mission.triviaCategory,
        photo: mission.photo,
        lat: spot.latitude,
        lng: spot.longitude,
      }),
      spotId: spot.id,
    };
  });

  // 結び: 最後の社で今日いちばんの一枚（写真ミッションを必ず1つ保証する）
  const last = route[route.length - 1];
  tasks.push({
    ...questStep({
      id: `s${route.length}`,
      title: '結び：今日いちばんの一枚',
      action: `めぐった${route.length}社をふり返り、いちばん心が動いた景色を一枚奉納しよう。門前に名物があれば、それも旅の締めくくり。`,
      photo: true,
      lat: last.latitude,
      lng: last.longitude,
    }),
    spotId: last.id,
  });

  const first = route[0];
  const areaKey = tourAreaKey(origin.lat, origin.lng);
  const estMinutes = Math.max(10, Math.min(120, Math.round((pathKm / 0.08 + 8 * route.length) / 5) * 5));

  return {
    id: `uq-${areaKey}-${dateSeed}-0`,
    spotId: areaKey,
    title: clip(`${first.name}から始める${route.length}社めぐり`, 40),
    description: clip(
      `${first.name}を起点に${route.length}つの社を歩いてめぐる小さな巡礼路。参道から本殿への空気の切り替わりを感じながら、社ごとの個性を見比べよう。`,
      160,
    ),
    difficulty: pathKm <= 1.5 ? 1 : 2,
    minLevel: 1,
    estMinutes,
    badgeIcon: '⛩️',
    badgeName: clip(`${first.name}巡礼路の踏破者`, 30),
    goalName: `${first.name} ほか${route.length - 1}社`,
    goalLat: first.latitude,
    goalLng: first.longitude,
    tasks,
    source: 'generated',
  };
}
