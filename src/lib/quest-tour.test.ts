import { describe, it, expect } from 'vitest';
import { buildTourQuest, tourAreaKey, type TourCandidate } from './quest-tour';

// 周遊クエスト（複数神社めぐり）ビルダーの純ロジックを保護するテスト。

const origin = { lat: 35.72, lng: 139.76 };

const shrine = (id: string, name: string, dLat: number, dLng: number): TourCandidate => ({
  id,
  name,
  latitude: origin.lat + dLat,
  longitude: origin.lng + dLng,
  category: '神社',
  godEmoji: '⛩️',
});

const candidates: TourCandidate[] = [
  shrine('a', '一の宮神社', 0.002, 0.001), // ~250m
  shrine('b', '二の宮神社', 0.006, 0.002), // ~700m
  shrine('c', '三の宮神社', 0.01, 0.004), // ~1.2km
  shrine('d', '遠くの神社', 0.05, 0.05), // 圏外（~7km）
  { id: 'e', name: '近くの寺', latitude: origin.lat + 0.003, longitude: origin.lng, category: '寺院' },
];

describe('buildTourQuest（周遊プラン）', () => {
  it('圏内の神社が2社未満なら null', () => {
    expect(buildTourQuest(origin, [], { dateSeed: 'd' })).toBeNull();
    expect(buildTourQuest(origin, [shrine('a', 'a', 0.001, 0)], { dateSeed: 'd' })).toBeNull();
  });

  it('貪欲最近傍: 出発点に最も近い社が tasks[0] になる', () => {
    const q = buildTourQuest(origin, candidates, { dateSeed: 'd' })!;
    expect(q.tasks[0].spotId).toBe('a');
    expect(q.goalName).toContain('一の宮神社');
  });

  it('神社が2社以上あれば寺院は混ざらない', () => {
    const q = buildTourQuest(origin, candidates, { dateSeed: 'd' })!;
    expect(q.tasks.map((t) => t.spotId)).not.toContain('e');
  });

  it('神社が足りなければ寺院も混ぜて成立させる', () => {
    const q = buildTourQuest(
      origin,
      [shrine('a', '一の宮神社', 0.002, 0.001), { id: 'e', name: '近くの寺', latitude: origin.lat + 0.003, longitude: origin.lng, category: '寺院' }],
      { dateSeed: 'd' },
    )!;
    expect(q).not.toBeNull();
    expect(new Set(q.tasks.map((t) => t.spotId))).toContain('e');
  });

  it('決定論: 同一入力 → 同一出力、id は日付とエリアで安定', () => {
    const a = buildTourQuest(origin, candidates, { dateSeed: '2026-06-10' })!;
    const b = buildTourQuest(origin, candidates, { dateSeed: '2026-06-10' })!;
    expect(a).toEqual(b);
    expect(a.id).toBe(`uq-${tourAreaKey(origin.lat, origin.lng)}-2026-06-10-0`);
  });

  it('写真ミッションが必ず1つ以上（結びタスクは photo）', () => {
    const q = buildTourQuest(origin, candidates, { dateSeed: 'd' })!;
    const photos = q.tasks.filter((t) => t.type === 'photo');
    expect(photos.length).toBeGreaterThanOrEqual(1);
    expect(q.tasks[q.tasks.length - 1].type).toBe('photo');
  });

  it('全タスクが座標と spotId を持ち、文字数制限内', () => {
    const q = buildTourQuest(origin, candidates, { dateSeed: 'd' })!;
    for (const t of q.tasks) {
      expect(t.lat, t.id).toBeTypeOf('number');
      expect(t.lng, t.id).toBeTypeOf('number');
      expect(t.spotId, t.id).toBeTruthy();
      expect(t.title.length, t.id).toBeLessThanOrEqual(40);
      expect((t.action ?? '').length, t.id).toBeLessThanOrEqual(120);
      expect((t.trivia ?? '').length, t.id).toBeLessThanOrEqual(140);
    }
  });

  it('estMinutes は 10〜120 の5分刻み', () => {
    const q = buildTourQuest(origin, candidates, { dateSeed: 'd' })!;
    expect(q.estMinutes).toBeGreaterThanOrEqual(10);
    expect(q.estMinutes).toBeLessThanOrEqual(120);
    expect(q.estMinutes % 5).toBe(0);
  });
});

describe('tourAreaKey（エリアグリッド）', () => {
  it('数十mの移動ではキーが変わらない', () => {
    expect(tourAreaKey(35.7201, 139.7602)).toBe(tourAreaKey(35.7205, 139.7607));
  });

  it('十分離れた地点ではキーが変わる', () => {
    expect(tourAreaKey(35.72, 139.76)).not.toBe(tourAreaKey(35.76, 139.8));
  });
});
