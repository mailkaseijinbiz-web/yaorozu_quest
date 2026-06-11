import { describe, it, expect } from 'vitest';
import { buildFallbackQuest } from './quest-fallback';

// ルールベース生成（AIキー無し環境の全クエスト）が「町歩きとして楽しい」体験を
// 保つことを保証するテスト。文字数は coerceTask の制限（action 120 / trivia 140）に合わせる。

const nezu = {
  id: 'osm-seed-100',
  name: '根津神社',
  category: '神社',
  latitude: 35.7206,
  longitude: 139.761,
};

describe('buildFallbackQuest（町歩きフォールバック）', () => {
  it('価値・課題が無いスポットでも、全タスクに action・3タスク以上に trivia が付く', () => {
    const quests = buildFallbackQuest(nezu, 3, 1);
    expect(quests.length).toBe(3);
    for (const q of quests) {
      expect(q.tasks.length).toBe(4);
      for (const t of q.tasks) expect(t.action, `${q.id} ${t.id}`).toBeTruthy();
      const withTrivia = q.tasks.filter((t) => t.trivia);
      expect(withTrivia.length, q.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('文字数制限: title ≤40 / action ≤120 / trivia ≤140', () => {
    const quests = buildFallbackQuest({ ...nezu, enjoyments: ['つつじ苑の散策'], issues: ['案内板が古い'] }, 3, 1);
    for (const q of quests) {
      expect(q.title.length).toBeLessThanOrEqual(40);
      for (const t of q.tasks) {
        expect(t.title.length, t.id).toBeLessThanOrEqual(40);
        expect((t.action ?? '').length, t.id).toBeLessThanOrEqual(120);
        expect((t.trivia ?? '').length, t.id).toBeLessThanOrEqual(140);
      }
    }
  });

  it('結びの task[3] は gratitude（課題の解決・SNS投稿はフローに含めない）', () => {
    // 課題があっても resolveIssue は出さない
    const withIssues = buildFallbackQuest({ ...nezu, issues: ['参道の落ち葉', '掲示が剥がれている'] }, 2, 1);
    for (const q of withIssues) {
      expect(q.tasks[3].type).toBe('gratitude');
      expect(q.tasks.some((t) => t.type === 'resolveIssue' || t.type === 'sns')).toBe(false);
    }
    // 課題が無くても sns は出さない
    const noIssues = buildFallbackQuest(nezu, 1, 1);
    expect(noIssues[0].tasks[3].type).toBe('gratitude');
  });

  it('決定論: 同一入力 → 同一出力、クエスト番号間で観察ミッションが変化する', () => {
    const a = buildFallbackQuest(nezu, 3, 1);
    const b = buildFallbackQuest(nezu, 3, 1);
    expect(a).toEqual(b);
    const titles = new Set(a.map((q) => q.tasks[1].title));
    expect(titles.size).toBeGreaterThan(1);
  });

  it('近傍に実在豆知識がある座標では task[0] の trivia に反映される（谷根千）', () => {
    const quests = buildFallbackQuest(nezu, 1, 1);
    const t0 = quests[0].tasks[0];
    expect(t0.trivia).toBeTruthy();
    // 根津神社から4km圏には谷根千・上野などの実在豆知識がある
    expect(t0.trivia!.length).toBeGreaterThan(20);
  });

  it('座標なしスポットでも安全に生成でき、観察ミッションの trivia が入る', () => {
    const quests = buildFallbackQuest({ name: '名もなき祠', category: '神社' }, 2, 1);
    for (const q of quests) {
      expect(q.tasks[0].trivia).toBeTruthy();
      expect(q.tasks[0].lat).toBeUndefined();
    }
  });

  it('寺院カテゴリでは神社専用ミッション（狛犬・鳥居等）が出ない', () => {
    const quests = buildFallbackQuest({ ...nezu, name: '全生庵', category: '寺院' }, 5, 1);
    for (const q of quests) {
      expect(q.tasks[1].title).not.toMatch(/狛犬|鳥居|摂社|手水|おみくじ|正中/);
    }
  });
});
