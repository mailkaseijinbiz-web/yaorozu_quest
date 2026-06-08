import { describe, it, expect } from 'vitest';
import { isVerifiedSpot, isRealAffiliateUrl, type Spot } from './db';

function makeSpot(over: Partial<Spot>): Spot {
  return {
    id: 'tk-1',
    name: 'テスト',
    description: '',
    latitude: 35.6,
    longitude: 139.7,
    creatorId: null,
    imageUrl: '',
    category: '神社',
    tokuRequirement: 30,
    enjoyments: [],
    difficulty: 1,
    terrain: 1,
    attributes: [],
    cacheType: 'Virtual',
    godName: '',
    godEmoji: '',
    godRequests: [],
    ...over,
  };
}

describe('isVerifiedSpot', () => {
  it('生成スポット(tk-接頭辞)は未検証', () => {
    expect(isVerifiedSpot(makeSpot({ id: 'tk-42' }))).toBe(false);
  });

  it('手作りスポット(spot-接頭辞)は検証済み', () => {
    expect(isVerifiedSpot(makeSpot({ id: 'spot-jukusen' }))).toBe(true);
  });

  it('明示フラグ true は接頭辞より優先', () => {
    expect(isVerifiedSpot(makeSpot({ id: 'tk-1', verified: true }))).toBe(true);
  });

  it('明示フラグ false は接頭辞より優先', () => {
    expect(isVerifiedSpot(makeSpot({ id: 'spot-x', verified: false }))).toBe(false);
  });
});

describe('isRealAffiliateUrl', () => {
  it('example.com のプレースホルダは偽と判定', () => {
    expect(isRealAffiliateUrl('https://example.com/affiliate/abc')).toBe(false);
    expect(isRealAffiliateUrl('http://www.example.org/x')).toBe(false);
  });

  it('実在ドメインは本物と判定', () => {
    expect(isRealAffiliateUrl('https://www.booking.com/hotel/jp/abc.html')).toBe(true);
    expect(isRealAffiliateUrl('https://tabelog.com/tokyo/A1234/')).toBe(true);
  });

  it('空文字は偽', () => {
    expect(isRealAffiliateUrl('')).toBe(false);
  });
});
