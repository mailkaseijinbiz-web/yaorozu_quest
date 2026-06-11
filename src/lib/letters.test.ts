import { describe, it, expect } from 'vitest';
import {
  weekWindow, lastWeekWindow, buildWeeklySummary, isEmptyWeek,
  buildFallbackLetter, buildLetterPrompt, type WeeklyData,
} from './letters';

describe('weekWindow', () => {
  it('returns Monday..Sunday for a mid-week day', () => {
    // 2026-06-11 is a Thursday
    expect(weekWindow('2026-06-11')).toEqual({ start: '2026-06-08', end: '2026-06-14' });
  });
  it('treats Sunday as the end of its week', () => {
    expect(weekWindow('2026-06-14')).toEqual({ start: '2026-06-08', end: '2026-06-14' });
  });
  it('treats Monday as the start of its week', () => {
    expect(weekWindow('2026-06-08')).toEqual({ start: '2026-06-08', end: '2026-06-14' });
  });
});

describe('lastWeekWindow', () => {
  it('is the Monday..Sunday immediately before this week', () => {
    expect(lastWeekWindow('2026-06-11')).toEqual({ start: '2026-06-01', end: '2026-06-07' });
  });
});

describe('buildWeeklySummary', () => {
  const data: WeeklyData = {
    activities: [
      { type: 'visit', source: 'human', reward: 10, createdAt: '2026-06-09T03:00:00Z' },
      { type: 'photo', source: 'human', reward: 30, createdAt: '2026-06-10T03:00:00Z' },
      { type: 'quest_complete', source: 'human', reward: 100, createdAt: '2026-06-10T05:00:00Z' },
      // out of window (previous week) — must be excluded
      { type: 'visit', source: 'human', reward: 10, createdAt: '2026-06-01T03:00:00Z' },
      // system source — must be excluded
      { type: 'spot_generate', source: 'system', reward: 0, createdAt: '2026-06-10T03:00:00Z' },
    ],
    visits: [
      { spotName: '善光寺', godEmoji: '🙏', visitedAt: '2026-06-09T03:00:00Z' },
      { spotName: '戸隠神社', godEmoji: '⛩️', visitedAt: '2026-06-10T03:00:00Z' },
      { spotName: '善光寺', godEmoji: '🙏', visitedAt: '2026-06-11T03:00:00Z' },
    ],
    daily: { days: { '2026-06-09': { acts: 1 }, '2026-06-10': { acts: 2 }, '2026-06-11': { acts: 1 } } },
    goshuinTotal: 7,
  };

  const s = buildWeeklySummary(data, '2026-06-08', '2026-06-14');

  it('sums toku only for human activities in the window', () => {
    expect(s.tokuGained).toBe(140); // 10 + 30 + 100
  });
  it('counts unique visited spot names', () => {
    expect(s.spotNames.sort()).toEqual(['善光寺', '戸隠神社']);
  });
  it('counts quests and photos', () => {
    expect(s.questsCompleted).toBe(1);
    expect(s.photos).toBe(1);
  });
  it('computes the streak at week end', () => {
    expect(s.streak).toBe(3);
  });
  it('passes through the goshuin total', () => {
    expect(s.goshuinTotal).toBe(7);
  });
  it('picks the most frequent emoji as top god', () => {
    expect(s.topGod?.emoji).toBe('🙏');
  });
});

describe('isEmptyWeek', () => {
  it('is true when nothing happened', () => {
    const empty = buildWeeklySummary({ activities: [], visits: [], daily: null, goshuinTotal: 0 }, '2026-06-08', '2026-06-14');
    expect(isEmptyWeek(empty)).toBe(true);
  });
});

describe('buildFallbackLetter', () => {
  it('is deterministic and mentions visited spots', () => {
    const summary = buildWeeklySummary({
      activities: [{ type: 'visit', source: 'human', reward: 10, createdAt: '2026-06-09T03:00:00Z' }],
      visits: [{ spotName: '善光寺', godEmoji: '🙏', visitedAt: '2026-06-09T03:00:00Z' }],
      daily: { days: { '2026-06-09': { acts: 1 } } },
      goshuinTotal: 1,
    }, '2026-06-08', '2026-06-14');
    const a = buildFallbackLetter(summary, '2026-06-08');
    const b = buildFallbackLetter(summary, '2026-06-08');
    expect(a).toEqual(b); // deterministic
    expect(a.body).toContain('善光寺');
    expect(a.godEmoji).toBe('🙏');
    expect(a.title).toContain('水無月');
  });

  it('handles a quiet week without spot names', () => {
    const summary = buildWeeklySummary({ activities: [], visits: [], daily: null, goshuinTotal: 0 }, '2026-06-08', '2026-06-14');
    const letter = buildFallbackLetter(summary, '2026-06-08');
    expect(letter.godName).toBe('八百万神');
    expect(letter.body.length).toBeGreaterThan(10);
  });
});

describe('buildLetterPrompt', () => {
  it('embeds the facts in the user prompt', () => {
    const summary = buildWeeklySummary({
      activities: [{ type: 'visit', source: 'human', reward: 10, createdAt: '2026-06-09T03:00:00Z' }],
      visits: [{ spotName: '善光寺', godEmoji: '🙏', visitedAt: '2026-06-09T03:00:00Z' }],
      daily: { days: { '2026-06-09': { acts: 1 } } },
      goshuinTotal: 3,
    }, '2026-06-08', '2026-06-14');
    const { system, user } = buildLetterPrompt(summary, 'たろう', '2026-06-08');
    expect(system).toContain('八百万神');
    expect(user).toContain('善光寺');
    expect(user).toContain('たろう');
  });
});
