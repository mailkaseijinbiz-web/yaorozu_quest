import { describe, it, expect } from 'vitest';
import {
  computeOdds,
  computeToku,
  correctRate,
  difficultyBadge,
  isQuizUnlocked,
  isSeriesCompleted,
  SHINNAKANO_QUIZZES,
  MIN_SAMPLE,
  PROVISIONAL_ODDS,
  ODDS_MIN,
  ODDS_MAX,
  type QuizStat,
  type QuizSeries,
} from './shinnakano-quiz';

// 温存資産（クイズ巡礼）の純ロジックを保護するテスト。
// UI からは現在未参照だが、本実装時にこの計算が壊れていないことを保証する。

const stat = (attempts: number, correct: number): QuizStat => ({ attempts, correct });

describe('computeOdds（動的御利益オッズ）', () => {
  it('サンプル不足（< MIN_SAMPLE）は仮オッズ固定', () => {
    expect(computeOdds(stat(MIN_SAMPLE - 1, 0))).toBe(PROVISIONAL_ODDS);
    expect(computeOdds(stat(0, 0))).toBe(PROVISIONAL_ODDS);
  });

  it('全員正解（易しい）は下限 ODDS_MIN にクランプ', () => {
    expect(computeOdds(stat(100, 100))).toBe(ODDS_MIN);
  });

  it('全員不正解（難問）は上限 ODDS_MAX にクランプ', () => {
    expect(computeOdds(stat(100, 0))).toBe(ODDS_MAX);
  });

  it('正答率が下がるほどオッズが上がる（単調性）', () => {
    const easy = computeOdds(stat(100, 80)); // 正答率80%
    const hard = computeOdds(stat(100, 20)); // 正答率20%
    expect(hard).toBeGreaterThan(easy);
  });
});

describe('computeToku（獲得徳 = baseToku × オッズ、四捨五入）', () => {
  it('サンプル不足は base × 仮オッズ', () => {
    expect(computeToku(40, stat(0, 0))).toBe(Math.round(40 * PROVISIONAL_ODDS)); // 60
  });

  it('正答率50%（十分なサンプル）で期待値どおり丸められる', () => {
    // raw = 0.5/(0.5+0.1)=0.8333 → 40*0.8333=33.33 → 33
    expect(computeToku(40, stat(100, 50))).toBe(33);
  });
});

describe('correctRate（%、サンプル不足は null）', () => {
  it('サンプル不足は null', () => {
    expect(correctRate(stat(MIN_SAMPLE - 1, 5))).toBeNull();
  });
  it('十分なサンプルは整数%', () => {
    expect(correctRate(stat(100, 60))).toBe(60);
  });
});

describe('difficultyBadge', () => {
  it('サンプル不足は集計中', () => {
    expect(difficultyBadge(stat(0, 0))).toEqual({ label: '集計中', tone: 'normal' });
  });
  it('正答率帯でトーンが切り替わる', () => {
    expect(difficultyBadge(stat(100, 10)).tone).toBe('secret'); // <15
    expect(difficultyBadge(stat(100, 25)).tone).toBe('hard'); // <35
    expect(difficultyBadge(stat(100, 50)).tone).toBe('normal'); // <65
    expect(difficultyBadge(stat(100, 90)).tone).toBe('easy'); // >=65
  });
});

describe('isQuizUnlocked（半径 0.3km で解錠）', () => {
  const quiz = SHINNAKANO_QUIZZES[0];
  it('同一地点は解錠', () => {
    expect(isQuizUnlocked(quiz, { lat: quiz.latitude, lng: quiz.longitude })).toBe(true);
  });
  it('遠方（東京駅）は施錠', () => {
    expect(isQuizUnlocked(quiz, { lat: 35.6812, lng: 139.7671 })).toBe(false);
  });
});

describe('isSeriesCompleted', () => {
  const series: QuizSeries = {
    id: 's', title: 't', description: '', badgeIcon: '⛩️',
    quizIds: ['a', 'b', 'c'],
  };
  it('全問回答済みなら制覇', () => {
    expect(isSeriesCompleted(series, new Set(['a', 'b', 'c']))).toBe(true);
  });
  it('1問でも未回答なら未制覇', () => {
    expect(isSeriesCompleted(series, new Set(['a', 'b']))).toBe(false);
  });
  it('quizIds が空のシリーズは未制覇扱い', () => {
    expect(isSeriesCompleted({ ...series, quizIds: [] }, new Set())).toBe(false);
  });
});
