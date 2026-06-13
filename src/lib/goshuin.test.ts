import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getGoShuinList, hasGoShuin, grantGoShuin, deleteGoshuin, type Goshuin } from './goshuin';
import { mergeArray } from './snapshot-merge';

// goshuin.ts / cloud-sync.ts は呼び出し時に typeof window を見るため、
// テスト前に window / localStorage をスタブする（db-spots-storage.test と同方式）。
function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
}

const SPOT = { id: 'tk-1', name: '五柱五成神社', category: '神社', godEmoji: '⛩️', latitude: 35.7, longitude: 139.7 };

beforeEach(() => {
  const ls = makeLocalStorage();
  vi.stubGlobal('localStorage', ls);
  vi.stubGlobal('window', { localStorage: ls, dispatchEvent: () => true });
});

describe('deleteGoshuin（ソフト削除）', () => {
  it('授与→削除で表示一覧から消える', () => {
    const g = grantGoShuin('user-self', SPOT, '杜の守り神')!;
    expect(getGoShuinList('user-self')).toHaveLength(1);
    deleteGoshuin('user-self', g.id);
    expect(getGoShuinList('user-self')).toHaveLength(0);
  });

  it('削除しても hasGoShuin は true（近接・対話での再付与＝復活を防ぐ）', () => {
    const g = grantGoShuin('user-self', SPOT, '杜の守り神')!;
    deleteGoshuin('user-self', g.id);
    expect(hasGoShuin('user-self', SPOT.id)).toBe(true);
    // 再付与は重複として弾かれる（null）
    expect(grantGoShuin('user-self', SPOT, '杜の守り神')).toBeNull();
    expect(getGoShuinList('user-self')).toHaveLength(0); // 表示は消えたまま
  });

  it('削除は要素を消さず deletedAt を打刻する（墓標が同期される）', () => {
    const g = grantGoShuin('user-self', SPOT, '杜の守り神')!;
    deleteGoshuin('user-self', g.id);
    const raw = JSON.parse(localStorage.getItem('yaorozu_goshuin_user-self')!) as Goshuin[];
    expect(raw).toHaveLength(1);
    expect(raw[0].deletedAt).toBeTruthy();
  });
});

describe('クラウド同期マージで復活しないこと', () => {
  it('クラウド側に削除前の御朱印が残っていても、ソフト削除が incoming 優先で勝つ', () => {
    // クラウド（base）= 削除前。ローカル（incoming）= deletedAt 付き。
    const cloud: Goshuin[] = [{ id: 'tk-1_1', spotId: 'tk-1', spotName: 'A', godName: '', godEmoji: '⛩️', category: '神社', receivedAt: '2026-01-01T00:00:00Z' }];
    const local: Goshuin[] = [{ ...cloud[0], deletedAt: '2026-06-13T00:00:00Z' }];
    const merged = mergeArray(cloud as unknown[], local as unknown[]) as Goshuin[];
    expect(merged).toHaveLength(1);
    expect(merged[0].deletedAt).toBe('2026-06-13T00:00:00Z'); // 復活しない
  });

  it('ハード削除だと和集合で復活してしまう（退行の対比確認）', () => {
    const cloud: Goshuin[] = [{ id: 'tk-1_1', spotId: 'tk-1', spotName: 'A', godName: '', godEmoji: '⛩️', category: '神社', receivedAt: '2026-01-01T00:00:00Z' }];
    const localHardDeleted: Goshuin[] = []; // 要素ごと消した場合
    const merged = mergeArray(cloud as unknown[], localHardDeleted as unknown[]) as Goshuin[];
    expect(merged).toHaveLength(1); // base にしか無い id は和集合で残る＝復活
  });
});
