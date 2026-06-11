import { describe, it, expect } from 'vitest';
import {
  ttlInfo,
  matchesDifficulty,
  matchesEstTime,
  formatKm,
  QUEST_TTL_MS,
} from './quest-ui';

// 「いま」を固定し、createdAt を「残り remainingMs になる時刻」から逆算するヘルパー
const NOW = Date.parse('2026-06-11T12:00:00Z');
function createdAtFor(remainingMs: number): string {
  // remainingMs = createdAt + QUEST_TTL_MS - NOW  →  createdAt = NOW - QUEST_TTL_MS + remainingMs
  return new Date(NOW - QUEST_TTL_MS + remainingMs).toISOString();
}

describe('ttlInfo', () => {
  it('createdAt 無しの旧データは null', () => {
    expect(ttlInfo(undefined, NOW)).toBeNull();
  });

  it('期限切れ（残り0以下）は null', () => {
    expect(ttlInfo(createdAtFor(0), NOW)).toBeNull();
    expect(ttlInfo(createdAtFor(-60_000), NOW)).toBeNull();
  });

  it('1時間以上は「残りN時間」表記・tier=normal', () => {
    const r = ttlInfo(createdAtFor(3 * 3_600_000), NOW)!;
    expect(r.text).toBe('残り3時間');
    expect(r.tier).toBe('normal');
  });

  it('残り119分は urgent（2時間未満）', () => {
    const r = ttlInfo(createdAtFor(119 * 60_000), NOW)!;
    expect(r.tier).toBe('urgent');
    expect(r.text).toBe('残り1時間');
  });

  it('残り29分は critical（30分未満）で分表記', () => {
    const r = ttlInfo(createdAtFor(29 * 60_000), NOW)!;
    expect(r.tier).toBe('critical');
    expect(r.text).toBe('残り29分');
  });

  it('残り数秒でも「残り1分」（残り0分にしない）', () => {
    const r = ttlInfo(createdAtFor(5_000), NOW)!;
    expect(r.text).toBe('残り1分');
    expect(r.tier).toBe('critical');
  });

  it('境界: ちょうど30分は urgent、ちょうど2時間は normal', () => {
    expect(ttlInfo(createdAtFor(30 * 60_000), NOW)!.tier).toBe('urgent');
    expect(ttlInfo(createdAtFor(2 * 3_600_000), NOW)!.tier).toBe('normal');
  });
});

describe('matchesDifficulty', () => {
  it('null はすべて通す', () => {
    expect(matchesDifficulty(1, null)).toBe(true);
    expect(matchesDifficulty(3, null)).toBe(true);
  });

  it('d<=1 は バケット1', () => {
    expect(matchesDifficulty(1, 1)).toBe(true);
    expect(matchesDifficulty(0, 1)).toBe(true);
    expect(matchesDifficulty(1, 2)).toBe(false);
  });

  it('d===2 は バケット2', () => {
    expect(matchesDifficulty(2, 2)).toBe(true);
    expect(matchesDifficulty(2, 1)).toBe(false);
    expect(matchesDifficulty(2, 3)).toBe(false);
  });

  it('d>=3 は バケット3', () => {
    expect(matchesDifficulty(3, 3)).toBe(true);
    expect(matchesDifficulty(4, 3)).toBe(true);
    expect(matchesDifficulty(3, 2)).toBe(false);
  });
});

describe('matchesEstTime', () => {
  it('null はすべて通す', () => {
    expect(matchesEstTime(5, null)).toBe(true);
    expect(matchesEstTime(120, null)).toBe(true);
  });

  it('short は 15分以下', () => {
    expect(matchesEstTime(15, 'short')).toBe(true);
    expect(matchesEstTime(16, 'short')).toBe(false);
  });

  it('mid は 16〜30分', () => {
    expect(matchesEstTime(16, 'mid')).toBe(true);
    expect(matchesEstTime(30, 'mid')).toBe(true);
    expect(matchesEstTime(15, 'mid')).toBe(false);
    expect(matchesEstTime(31, 'mid')).toBe(false);
  });

  it('long は 30分超', () => {
    expect(matchesEstTime(31, 'long')).toBe(true);
    expect(matchesEstTime(30, 'long')).toBe(false);
  });
});

describe('formatKm', () => {
  it('1km 未満は m 表記', () => {
    expect(formatKm(0.999)).toEqual({ value: '999', unit: 'm' });
    expect(formatKm(0.12)).toEqual({ value: '120', unit: 'm' });
  });

  it('1km 以上は km 表記（小数1桁）', () => {
    expect(formatKm(1.0)).toEqual({ value: '1.0', unit: 'km' });
    expect(formatKm(2.34)).toEqual({ value: '2.3', unit: 'km' });
  });

  it('1km 直前（丸めで 1000m になる値）は「1000m」ではなく km 表記', () => {
    expect(formatKm(0.9999)).toEqual({ value: '1.0', unit: 'km' });
    expect(formatKm(0.9995)).toEqual({ value: '1.0', unit: 'km' });
    // 丸めても 1000m に達しない値は m 表記のまま
    expect(formatKm(0.9994)).toEqual({ value: '999', unit: 'm' });
  });
});
