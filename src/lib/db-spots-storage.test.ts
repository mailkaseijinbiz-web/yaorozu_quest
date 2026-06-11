import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateTokyoSpots } from '../data/tokyo-spots';

// スポットの「差分保存」を保護するテスト。
// シード（実在寺社カタログ約4,600件・JSON約2.3MB）を丸ごと localStorage に書くと
// quota（約5MB）を圧迫し、写真投稿などの保存が QuotaExceededError で失敗していた。
// 保存はシードとの差分のみ・読み取りはシードへの重ね合わせで復元、を検証する。

const SPOTS_KEY = 'yaorozu_spots_v5';

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
}

// db はモジュール初期化時に typeof window を見るため、グローバルを立ててから import する
async function importDbWith(ls: ReturnType<typeof makeLocalStorage>) {
  vi.stubGlobal('localStorage', ls);
  vi.stubGlobal('window', {
    localStorage: ls,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  const mod = await import('./db');
  return mod.db;
}

describe('スポットの差分保存（localStorage quota 対策）', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('写真を1枚奉納しても、保存されるのは変更されたスポットだけ（シード全件は書かない）', async () => {
    const ls = makeLocalStorage();
    const db = await importDbWith(ls);
    const spot = db.getSpots()[0];
    db.addSpotPhoto('user-self', spot.id, 'data:image/jpeg;base64,xxxx');

    const stored = JSON.parse(ls.getItem(SPOTS_KEY)!) as { id: string }[];
    expect(stored.length).toBeLessThan(10);
    expect(stored.some((s) => s.id === spot.id)).toBe(true);
  });

  it('差分保存後も読み取りは完全なリストに復元され、変更が反映されている', async () => {
    const ls = makeLocalStorage();
    const db = await importDbWith(ls);
    const seedCount = db.getSpots().length;
    const spot = db.getSpots()[0];
    db.addSpotPhoto('user-self', spot.id, 'data:image/jpeg;base64,xxxx');

    expect(db.getSpots().length).toBe(seedCount);
    expect(db.getSpot(spot.id)?.photos).toContain('data:image/jpeg;base64,xxxx');
  });

  it('旧形式（シード全件保存・約2.3MB）は読み取り時に差分形式へ自動圧縮される', async () => {
    const ls = makeLocalStorage();
    // 旧形式を再現: シード全件＋ユーザー生成スポット1件を丸ごと保存しておく
    const legacy = [
      ...generateTokyoSpots(),
      { ...generateTokyoSpots()[0], id: 'osm-extra-1', name: 'ユーザー生成の場' },
    ];
    ls.setItem(SPOTS_KEY, JSON.stringify(legacy));

    const db = await importDbWith(ls);
    const spots = db.getSpots();
    expect(spots.length).toBe(legacy.length); // 復元は全件

    const stored = JSON.parse(ls.getItem(SPOTS_KEY)!) as { id: string }[];
    expect(stored.length).toBeLessThan(100); // 保存は差分のみへ圧縮
    expect(stored.some((s) => s.id === 'osm-extra-1')).toBe(true); // 生成スポットは保持
  });
});
