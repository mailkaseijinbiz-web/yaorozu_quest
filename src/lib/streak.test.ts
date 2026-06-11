import { describe, it, expect } from 'vitest';
import { computeStreak, streakEndingAt, prevDate, dayGap, type StreakLog } from './streak';

// 連続した日付キーの days マップを作るヘルパー
function daysEndingAt(end: string, n: number): { [date: string]: { acts: number } } {
  const out: { [date: string]: { acts: number } } = {};
  let d = end;
  for (let i = 0; i < n; i++) { out[d] = { acts: 1 }; d = prevDate(d); }
  return out;
}

describe('prevDate', () => {
  it('returns the previous calendar day', () => {
    expect(prevDate('2026-06-10')).toBe('2026-06-09');
    expect(prevDate('2026-03-01')).toBe('2026-02-28');
    expect(prevDate('2026-01-01')).toBe('2025-12-31');
  });
});

describe('dayGap', () => {
  it('counts whole days between two date keys', () => {
    expect(dayGap('2026-06-08', '2026-06-11')).toBe(3);
    expect(dayGap('2026-06-11', '2026-06-11')).toBe(0);
  });
});

describe('streakEndingAt', () => {
  it('counts a back-to-back run', () => {
    const days = daysEndingAt('2026-06-11', 4);
    expect(streakEndingAt(days, '2026-06-11')).toBe(4);
  });
  it('is 0 when the anchor day has no activity', () => {
    const days = daysEndingAt('2026-06-09', 2);
    expect(streakEndingAt(days, '2026-06-11')).toBe(0);
  });
});

describe('computeStreak', () => {
  it('keeps the streak when today is not yet done but yesterday was', () => {
    const log: StreakLog = { days: daysEndingAt('2026-06-10', 3) };
    const s = computeStreak(log, '2026-06-11');
    expect(s.current).toBe(3);
    expect(s.todayDone).toBe(false);
    expect(s.lastDate).toBe('2026-06-10');
  });

  it('counts today when done', () => {
    const log: StreakLog = { days: daysEndingAt('2026-06-11', 5) };
    const s = computeStreak(log, '2026-06-11');
    expect(s.current).toBe(5);
    expect(s.todayDone).toBe(true);
  });

  it('breaks when a day was skipped', () => {
    // 6/11 done, but 6/10 missing → current run is just today
    const log: StreakLog = { days: { '2026-06-11': { acts: 1 }, '2026-06-09': { acts: 1 }, '2026-06-08': { acts: 1 } } };
    const s = computeStreak(log, '2026-06-11');
    expect(s.current).toBe(1);
    expect(s.longest).toBe(2); // 6/8-6/9
  });

  it('returns zeros for an empty/missing log', () => {
    expect(computeStreak(null, '2026-06-11')).toEqual({ current: 0, longest: 0, todayDone: false, lastDate: null });
    expect(computeStreak({ days: {} }, '2026-06-11').current).toBe(0);
  });

  it('respects a stored longestEver', () => {
    const log: StreakLog = { days: daysEndingAt('2026-06-11', 2), longestEver: 9 };
    expect(computeStreak(log, '2026-06-11').longest).toBe(9);
  });
});
