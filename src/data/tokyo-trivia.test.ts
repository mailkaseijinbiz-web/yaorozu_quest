import { describe, it, expect } from 'vitest';
import { TOKYO_TRIVIA, getTriviaNear } from './tokyo-trivia';

// 実在豆知識データの整合性と、近傍検索（クエスト生成・道中案内の素材取得）を保護するテスト。

describe('TOKYO_TRIVIA（データ整合性）', () => {
  it('id が一意', () => {
    const ids = TOKYO_TRIVIA.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('座標を持つエントリは東京近郊の範囲内', () => {
    for (const t of TOKYO_TRIVIA) {
      if (t.latitude == null || t.longitude == null) continue;
      expect(t.latitude, t.id).toBeGreaterThan(35.4);
      expect(t.latitude, t.id).toBeLessThan(35.9);
      expect(t.longitude, t.id).toBeGreaterThan(139.3);
      expect(t.longitude, t.id).toBeLessThan(140.1);
    }
  });

  it('本文は達成カード表示（clip 140字）で切れすぎない長さ', () => {
    for (const t of TOKYO_TRIVIA) {
      expect(t.body.length, t.id).toBeLessThanOrEqual(160);
    }
  });

  it('walkTips（観察ポイント）を1つ以上持つ', () => {
    for (const t of TOKYO_TRIVIA) {
      expect(t.walkTips.length, t.id).toBeGreaterThan(0);
    }
  });
});

describe('getTriviaNear（座標近傍の素材取得）', () => {
  // 谷中（夕やけだんだん付近）
  const yanaka = { lat: 35.7270, lng: 139.7665 };

  it('近い順に返り、先頭は同エリアのエントリ', () => {
    const near = getTriviaNear(yanaka.lat, yanaka.lng, 5, 3);
    expect(near.length).toBeGreaterThan(0);
    expect(near[0].area).toBe('谷根千');
  });

  it('距離昇順でソートされる', () => {
    const near = getTriviaNear(yanaka.lat, yanaka.lng, 10, 10);
    const dist = (t: (typeof near)[number]) =>
      Math.hypot((t.latitude! - yanaka.lat) * 111, (t.longitude! - yanaka.lng) * 91);
    for (let i = 1; i < near.length; i++) {
      expect(dist(near[i - 1])).toBeLessThanOrEqual(dist(near[i]) + 1e-9);
    }
  });

  it('radius で絞り込まれ、limit で件数が制限される', () => {
    const tight = getTriviaNear(yanaka.lat, yanaka.lng, 0.5, 10);
    const wide = getTriviaNear(yanaka.lat, yanaka.lng, 10, 10);
    expect(tight.length).toBeLessThanOrEqual(wide.length);
    expect(getTriviaNear(yanaka.lat, yanaka.lng, 10, 2).length).toBeLessThanOrEqual(2);
  });

  it('近くに何もない座標（小笠原沖）では空配列', () => {
    expect(getTriviaNear(27.0, 142.0, 5, 3)).toEqual([]);
  });
});
