import { describe, it, expect } from 'vitest';
import { WALK_MISSIONS, missionPool, pickWalkMissions, hashString } from './walk-missions';

// 観察ミッションカタログの整合性と決定論的選定を保護するテスト。
// 文字数上限は coerceTask（action 120 / trivia 140）と HomeTab 表示（title 40）に対応。

describe('WALK_MISSIONS（データ整合性）', () => {
  it('id が一意', () => {
    const ids = WALK_MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('title ≤40字 / action ≤120字 / trivia ≤140字', () => {
    for (const m of WALK_MISSIONS) {
      expect(m.title.length, `${m.id} title`).toBeLessThanOrEqual(40);
      expect(m.action.length, `${m.id} action`).toBeLessThanOrEqual(120);
      expect(m.trivia.length, `${m.id} trivia`).toBeLessThanOrEqual(140);
    }
  });

  it('triviaCategory は4分類のいずれか', () => {
    for (const m of WALK_MISSIONS) {
      expect(['地形', '歴史', '建築', '道路'], m.id).toContain(m.triviaCategory);
    }
  });

  it('全 scope にミッションがある（神社/寺院/共通/道中）', () => {
    const scopes = new Set(WALK_MISSIONS.map((m) => m.appliesTo));
    expect(scopes).toEqual(new Set(['shrine', 'temple', 'precinct', 'street']));
  });
});

describe('missionPool（カテゴリ別プール）', () => {
  it('神社カテゴリには temple 系が混ざらない', () => {
    const pool = missionPool('神社');
    expect(pool.some((m) => m.appliesTo === 'shrine')).toBe(true);
    expect(pool.some((m) => m.appliesTo === 'temple')).toBe(false);
  });

  it('寺院カテゴリには shrine 系が混ざらない', () => {
    const pool = missionPool('寺院');
    expect(pool.some((m) => m.appliesTo === 'temple')).toBe(true);
    expect(pool.some((m) => m.appliesTo === 'shrine')).toBe(false);
  });

  it('scope 指定で道中ミッションだけに絞れる', () => {
    const pool = missionPool('神社', ['street']);
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((m) => m.appliesTo === 'street')).toBe(true);
  });
});

describe('pickWalkMissions（決定論的選定）', () => {
  it('同一引数 → 同一結果', () => {
    const a = pickWalkMissions('osm-seed-1', '神社', 0, 3);
    const b = pickWalkMissions('osm-seed-1', '神社', 0, 3);
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
  });

  it('1回の選定内に重複がない', () => {
    const picked = pickWalkMissions('osm-seed-2', '寺院', 1, 5);
    const ids = picked.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('salt（クエスト番号）を変えると選定が変わる', () => {
    const variants = new Set(
      [0, 1, 2, 3, 4].map((salt) => pickWalkMissions('osm-seed-3', '神社', salt, 2).map((m) => m.id).join(',')),
    );
    expect(variants.size).toBeGreaterThan(1);
  });

  it('プールより多く要求しても安全（全件まで）', () => {
    const street = pickWalkMissions('x', '神社', 0, 999, ['street']);
    expect(street.length).toBe(missionPool('神社', ['street']).length);
  });
});

describe('hashString', () => {
  it('非負かつ決定論的', () => {
    expect(hashString('osm-seed-42')).toBe(hashString('osm-seed-42'));
    expect(hashString('osm-seed-42')).toBeGreaterThanOrEqual(0);
    expect(hashString('')).toBe(0);
  });
});
