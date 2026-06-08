import { describe, it, expect } from 'vitest';
import { distanceKm, roughDistance } from './geo';

describe('distanceKm (Haversine)', () => {
  it('同一地点は 0', () => {
    expect(distanceKm(35.6895, 139.6917, 35.6895, 139.6917)).toBe(0);
  });

  it('東京駅〜新宿駅は約 6〜7km', () => {
    const d = distanceKm(35.6812, 139.7671, 35.6896, 139.7006);
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(8);
  });

  it('対称性（A→B と B→A は等しい）', () => {
    const ab = distanceKm(35.6, 139.7, 35.7, 139.8);
    const ba = distanceKm(35.7, 139.8, 35.6, 139.7);
    expect(ab).toBeCloseTo(ba, 10);
  });
});

describe('roughDistance（並べ替え用の概算）', () => {
  it('同一地点は 0', () => {
    expect(roughDistance(35.6, 139.7, 35.6, 139.7)).toBe(0);
  });

  it('近い点ほど小さい値（順序が正しい）', () => {
    const near = roughDistance(35.6, 139.7, 35.61, 139.7);
    const far = roughDistance(35.6, 139.7, 35.8, 139.7);
    expect(near).toBeLessThan(far);
  });
});
