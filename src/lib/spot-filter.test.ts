import { describe, it, expect } from 'vitest';
import { isExcludedReligion } from './spot-filter';

describe('isExcludedReligion', () => {
  it('新興宗教の施設を除外する', () => {
    const excluded = [
      '幸福の科学',
      '幸福の科学 東京正心館',
      '創価学会',
      '創価学会 新宿若松会館',
      '立正佼成会 港教会',
      '霊友会釈迦殿',
      '真如苑 大塚支部',
      '阿含宗関東別院',
      '天理教○○分教会',
      '生長の家',
      '金光教△△教会',
      '世界救世教',
      '崇教真光',
      'ワールドメイト',
      'World Mate',
      '統一教会',
      '世界平和統一家庭連合',
      'エホバの証人 王国会館',
      'ものみの塔',
      'アレフ',
      'ひかりの輪',
      '末日聖徒イエス・キリスト教会',
    ];
    for (const name of excluded) {
      expect(isExcludedReligion(name), name).toBe(true);
    }
  });

  it('伝統的な神社・寺院は誤って除外しない', () => {
    const kept = [
      '明治神宮',
      '浅草寺',
      '増上寺',
      '靖国神社',
      '真光寺', // 「真光」を含むが正規の寺院（崇教真光ではない）
      '金光寺', // 「金光」を含むが正規の寺院（金光教ではない）
      '天理市の神社', // 「天理」を含むが「天理教」ではない地名
      '法隆寺',
      '伏見稲荷大社',
      '日枝神社',
    ];
    for (const name of kept) {
      expect(isExcludedReligion(name), name).toBe(false);
    }
  });

  it('空・未定義は false', () => {
    expect(isExcludedReligion('')).toBe(false);
    expect(isExcludedReligion(null)).toBe(false);
    expect(isExcludedReligion(undefined)).toBe(false);
  });
});
