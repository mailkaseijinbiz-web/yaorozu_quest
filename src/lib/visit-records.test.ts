import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 参拝記録（投稿）の純ロジックを保護するテスト。
// ・1日1投稿（同じ寺社・同じ日は二重に記録しない）
// ・写真は最大 MAX_RECORD_PHOTOS 枚まで
// ・旧 photo（単体）と新 photos（配列）の両対応（recordPhotos）

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

// visit-records → cloud-sync は import 時に window/localStorage を参照するため先に立てる
async function importWith(ls: ReturnType<typeof makeLocalStorage>) {
  vi.stubGlobal('localStorage', ls);
  vi.stubGlobal('window', {
    localStorage: ls,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  return import('./visit-records');
}

const SPOT = { id: 'tk-1', name: 'テスト社', category: '神社', latitude: 35.6, longitude: 139.7, godEmoji: '⛩️' };

describe('参拝記録（visit-records）', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('hasRecordForSpotOnDate: 同じ寺社・同じ日は1投稿のみ（別日は可）', async () => {
    const ls = makeLocalStorage();
    const m = await importWith(ls);
    const day1 = new Date('2026-06-11T12:00:00').toISOString();
    const day2 = new Date('2026-06-12T12:00:00').toISOString();

    expect(m.hasRecordForSpotOnDate('user-self', SPOT.id, day1)).toBe(false);
    m.addVisitRecord('user-self', SPOT, { visitedAt: day1 });
    expect(m.hasRecordForSpotOnDate('user-self', SPOT.id, day1)).toBe(true);
    // 同日・同寺社は既存ありと判定（朝/夜など時刻が違っても同じ日）
    const day1Evening = new Date('2026-06-11T20:30:00').toISOString();
    expect(m.hasRecordForSpotOnDate('user-self', SPOT.id, day1Evening)).toBe(true);
    // 翌日はまだ無い
    expect(m.hasRecordForSpotOnDate('user-self', SPOT.id, day2)).toBe(false);
  });

  it('addVisitRecord: 写真は最大 MAX_RECORD_PHOTOS 枚に丸められる', async () => {
    const ls = makeLocalStorage();
    const m = await importWith(ls);
    const tooMany = Array.from({ length: m.MAX_RECORD_PHOTOS + 5 }, (_, i) => `data:img,${i}`);
    const rec = m.addVisitRecord('user-self', SPOT, { photos: tooMany });
    expect(rec).not.toBeNull();
    expect(rec!.photos!.length).toBe(m.MAX_RECORD_PHOTOS);
  });

  it('recordPhotos: 新 photos と旧 photo の両方を配列で返す', async () => {
    const m = await importWith(makeLocalStorage());
    expect(m.recordPhotos({ photos: ['a', 'b'] } as never)).toEqual(['a', 'b']);
    expect(m.recordPhotos({ photo: 'legacy' } as never)).toEqual(['legacy']);
    expect(m.recordPhotos({} as never)).toEqual([]);
  });

  it('deleteVisitRecord: 表示からは消えるが tombstone として残る（クラウド復活防止）', async () => {
    const ls = makeLocalStorage();
    const m = await importWith(ls);
    const rec = m.addVisitRecord('user-self', SPOT, { note: 'けす', photos: ['data:img,1'] })!;
    expect(m.getVisitRecords('user-self').some((r) => r.id === rec.id)).toBe(true);

    m.deleteVisitRecord('user-self', rec.id);
    // 表示用一覧からは除外される
    expect(m.getVisitRecords('user-self').some((r) => r.id === rec.id)).toBe(false);
    // 生の保存データには deletedAt 付きで残り、写真は破棄されている（容量対策）
    const raw = JSON.parse(ls.getItem('yaorozu_visit_records_user-self')!) as Array<{ id: string; deletedAt?: string; photos?: string[] }>;
    const tomb = raw.find((r) => r.id === rec.id);
    expect(tomb?.deletedAt).toBeTruthy();
    expect(tomb?.photos).toBeUndefined();
  });

  it('addVisitRecord: 既存の tombstone を消さずに保全する', async () => {
    const ls = makeLocalStorage();
    const m = await importWith(ls);
    const a = m.addVisitRecord('user-self', SPOT, { visitedAt: new Date('2026-06-10T12:00:00').toISOString() })!;
    m.deleteVisitRecord('user-self', a.id);
    m.addVisitRecord('user-self', SPOT, { visitedAt: new Date('2026-06-12T12:00:00').toISOString() });
    const raw = JSON.parse(ls.getItem('yaorozu_visit_records_user-self')!) as Array<{ id: string; deletedAt?: string }>;
    // tombstone(a) と新規(1件) の計2件が保存され、表示は新規の1件
    expect(raw.some((r) => r.id === a.id && r.deletedAt)).toBe(true);
    expect(m.getVisitRecords('user-self').length).toBe(1);
  });
});
