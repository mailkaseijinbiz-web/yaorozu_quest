import { describe, it, expect } from 'vitest';
import { photoThemesFor } from './photo-themes';

describe('photoThemesFor', () => {
  it('神社カテゴリは鳥居・狛犬を含むテーマ', () => {
    const t = photoThemesFor('神社');
    expect(t.length).toBeGreaterThanOrEqual(2);
    expect(t.length).toBeLessThanOrEqual(3);
    expect(t.join('')).toContain('鳥居');
  });

  it('寺院カテゴリは寺向けのテーマ', () => {
    expect(photoThemesFor('寺院').join('')).toContain('山門');
  });

  it('固有名を含むカテゴリも部分一致する', () => {
    expect(photoThemesFor('伏見稲荷大社').join('')).toContain('鳥居');
    expect(photoThemesFor('○○商店街').join('')).toContain('看板');
  });

  it('未知カテゴリ・未指定は汎用テーマにフォールバック', () => {
    expect(photoThemesFor('未知のなにか')).toEqual(photoThemesFor(undefined));
    expect(photoThemesFor(undefined).length).toBe(3);
  });

  it('常に2〜3個を返す', () => {
    for (const c of ['神社', '寺院', '公園', '商店街', '飲食店', '駅', '城跡', undefined]) {
      const n = photoThemesFor(c).length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(3);
    }
  });
});
