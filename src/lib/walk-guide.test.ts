import { describe, it, expect } from 'vitest';
import { guideStage, nextGuideStage, composeWalkGuide } from './walk-guide';

// 道中ガイド（距離バンド・ローテーション）の純ロジックを保護するテスト。

describe('guideStage（距離バンド）', () => {
  it('境界値が正しいステージに落ちる', () => {
    expect(guideStage(0.05)).toBe(100);
    expect(guideStage(0.2)).toBe(99);
    expect(guideStage(0.45)).toBe(98);
    expect(guideStage(0.8)).toBe(97);
    expect(guideStage(1.2)).toBe(96);
    expect(guideStage(2.3)).toBe(94);
  });

  it('近づくほどステージが上がる（単調性）', () => {
    expect(guideStage(0.05)).toBeGreaterThan(guideStage(0.5));
    expect(guideStage(0.5)).toBeGreaterThan(guideStage(3.0));
  });
});

describe('nextGuideStage（ヒステリシス）', () => {
  it('GPSゆらぎで境界を行き来してもステージは後退しない', () => {
    let stage = nextGuideStage(0.55, null); // 98
    stage = nextGuideStage(0.62, stage); // 97 だが後退しない
    expect(stage).toBe(98);
    stage = nextGuideStage(0.58, stage);
    expect(stage).toBe(98);
    stage = nextGuideStage(0.25, stage); // 前進はする
    expect(stage).toBe(99);
  });

  it('距離が取れないステップは -1（導入文のみ）', () => {
    expect(nextGuideStage(null, null)).toBe(-1);
    expect(nextGuideStage(null, 97)).toBe(97);
  });
});

describe('composeWalkGuide（語りの合成）', () => {
  const base = {
    questId: 'uq-test-1',
    step: { id: 's0', title: '根津神社へ歩く', spotId: 'osm-seed-1' },
    user: { lat: 35.7206, lng: 139.761 }, // 谷根千圏内
  };

  it('同入力 → 同出力（決定論）', () => {
    const a = composeWalkGuide({ ...base, stage: 96, distKm: 1.2 });
    const b = composeWalkGuide({ ...base, stage: 96, distKm: 1.2 });
    expect(a).toBe(b);
  });

  it('ステージが変わると語りが変わる（ローテーション）', () => {
    const texts = new Set(
      [94, 95, 96, 97, 98].map((stage) => composeWalkGuide({ ...base, stage, distKm: 1.0 })),
    );
    expect(texts.size).toBeGreaterThan(2);
  });

  it('300m未満は到着の声かけ', () => {
    expect(composeWalkGuide({ ...base, stage: 99, distKm: 0.2 })).toContain('到着');
    expect(composeWalkGuide({ ...base, stage: 100, distKm: 0.05 })).toContain('目の前');
  });

  it('豆知識圏外（札幌）でも壊れず、距離の声かけ等に縮退する', () => {
    const remote = { ...base, user: { lat: 43.06, lng: 141.35 } };
    for (const stage of [93, 94, 95, 96, 97, 98]) {
      const text = composeWalkGuide({ ...remote, stage, distKm: 1.5 });
      expect(text.length).toBeGreaterThan(10);
    }
  });

  it('語りは長すぎない（タイプ表示30ms/字で約5秒以内）', () => {
    for (const stage of [93, 94, 95, 96, 97, 98, 99, 100]) {
      const text = composeWalkGuide({ ...base, stage, distKm: 1.0 });
      expect(text.length, `stage ${stage}`).toBeLessThanOrEqual(160);
    }
  });
});
