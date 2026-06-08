import { describe, it, expect } from 'vitest';
import { getLevelInfo, LEVELS } from './levels';

describe('getLevelInfo（累積徳→レベル算出）', () => {
  it('徳0は見習い巡礼者（Lv.1）、次はLv.2、残り100', () => {
    const info = getLevelInfo(0);
    expect(info.current.level).toBe(1);
    expect(info.next?.level).toBe(2);
    expect(info.tokuToNext).toBe(100);
    expect(info.progress).toBe(0);
  });

  it('レベル境界ちょうど（100徳）でLv.2に上がる', () => {
    expect(getLevelInfo(100).current.level).toBe(2);
    expect(getLevelInfo(99).current.level).toBe(1);
  });

  it('レベル途中の進捗を正しく計算（150徳 = Lv.2の1/4）', () => {
    const info = getLevelInfo(150);
    expect(info.current.level).toBe(2);
    expect(info.tokuIntoLevel).toBe(50);
    expect(info.tokuSpan).toBe(200); // 300 - 100
    expect(info.tokuToNext).toBe(150); // 300 - 150
    expect(info.progress).toBeCloseTo(0.25, 5);
  });

  it('最大レベル（1000徳〜）は next=null・progress=1・残り0', () => {
    const info = getLevelInfo(1000);
    expect(info.current.level).toBe(LEVELS[LEVELS.length - 1].level);
    expect(info.next).toBeNull();
    expect(info.progress).toBe(1);
    expect(info.tokuToNext).toBe(0);
  });

  it('最大レベルを超える徳でも安全（5000徳）', () => {
    const info = getLevelInfo(5000);
    expect(info.current.level).toBe(5);
    expect(info.next).toBeNull();
  });
});
