import { describe, it, expect } from 'vitest';
import { mergeArray, mergeValue, mergeSnapshots } from './snapshot-merge';

describe('mergeArray', () => {
  it('id付きオブジェクト配列は id で和集合し、新規エンティティを失わない', () => {
    const base = [{ id: 'a', t: 1 }, { id: 'b', t: 1 }];
    const incoming = [{ id: 'b', t: 2 }, { id: 'c', t: 1 }];
    const merged = mergeArray(base, incoming) as { id: string; t: number }[];
    const byId = Object.fromEntries(merged.map(m => [m.id, m.t]));
    expect(Object.keys(byId).sort()).toEqual(['a', 'b', 'c']); // a も c も残る
    expect(byId.b).toBe(2); // 衝突は incoming 優先
  });

  it('プリミティブ配列は値で重複排除した和集合になる', () => {
    expect(mergeArray(['q1', 'q2'], ['q2', 'q3'])).toEqual(['q1', 'q2', 'q3']);
  });

  it('一方が空配列でも他方を保全する', () => {
    expect(mergeArray([], [{ id: 'a' }])).toEqual([{ id: 'a' }]);
    expect(mergeArray([{ id: 'a' }], [])).toEqual([{ id: 'a' }]);
  });

  it('削除(tombstone)は復活しない: incoming の削除がサーバー(base)の生データに勝つ', () => {
    // 端末で削除 → incoming に deletedAt 付きが乗る。base(サーバー)はまだ生。
    const base = [{ id: 'r1' }, { id: 'r2' }];
    const incoming = [{ id: 'r1', deletedAt: '2026-06-15T00:00:00Z' }, { id: 'r2' }];
    const merged = mergeArray(base, incoming) as { id: string; deletedAt?: string }[];
    expect(merged.find(m => m.id === 'r1')?.deletedAt).toBe('2026-06-15T00:00:00Z');
  });

  it('削除(tombstone)は復活しない: 削除を知らない古い端末(incoming)が来ても base の削除を維持', () => {
    const base = [{ id: 'r1', deletedAt: '2026-06-15T00:00:00Z' }];
    const incoming = [{ id: 'r1' }]; // 削除を知らない生データ
    const merged = mergeArray(base, incoming) as { id: string; deletedAt?: string }[];
    expect(merged.find(m => m.id === 'r1')?.deletedAt).toBe('2026-06-15T00:00:00Z');
  });
});

describe('mergeValue', () => {
  it('プレーンオブジェクトはキー単位に再帰マージ(incoming優先)', () => {
    const base = { x: 1, nested: { a: 1, b: 1 } };
    const incoming = { y: 2, nested: { b: 2, c: 2 } };
    expect(mergeValue(base, incoming)).toEqual({ x: 1, y: 2, nested: { a: 1, b: 2, c: 2 } });
  });

  it('スカラーは incoming を採用', () => {
    expect(mergeValue(1, 2)).toBe(2);
    expect(mergeValue('old', 'new')).toBe('new');
  });

  it('型不一致は incoming を採用', () => {
    expect(mergeValue([1, 2], { a: 1 })).toEqual({ a: 1 });
  });
});

describe('mergeSnapshots', () => {
  it('base 限定キーは保持し、incoming 限定キーは追加し、共通キーはマージする', () => {
    const base = {
      yaorozu_ugc: [{ id: 'p1' }],
      yaorozu_claimed_quests: ['q1'],
      base_only: [{ id: 'x' }],
    };
    const incoming = {
      yaorozu_ugc: [{ id: 'p2' }],
      yaorozu_claimed_quests: ['q2'],
      incoming_only: [{ id: 'y' }],
    };
    const merged = mergeSnapshots(base, incoming);
    expect((merged.yaorozu_ugc as { id: string }[]).map(p => p.id).sort()).toEqual(['p1', 'p2']);
    expect((merged.yaorozu_claimed_quests as string[]).sort()).toEqual(['q1', 'q2']);
    expect(merged.base_only).toEqual([{ id: 'x' }]); // 別端末の新規投稿は消えない
    expect(merged.incoming_only).toEqual([{ id: 'y' }]);
  });

  it('base が null のときは incoming のコピーを返す', () => {
    const incoming = { a: [1] };
    const merged = mergeSnapshots(null, incoming);
    expect(merged).toEqual(incoming);
    expect(merged).not.toBe(incoming); // 防御的にコピー
  });
});
