// 参拝記録ストア
// -----------------------------------------------------------------------------
// ユーザーが「ここに行った」と記録した参拝の履歴を localStorage に保存する。
// 御朱印（goshuin.ts）が「神と対話した証」なのに対し、こちらは実地の参拝そのものを
// 日付・メモ・写真つきで何度でも残せる軽量な記録（同じ寺社に複数回の記録を持てる）。
// user-self のキーは SYNC_KEYS 対象。書き込み時に schedulePush でクラウド同期する。
// -----------------------------------------------------------------------------

import { schedulePush } from './cloud-sync';

export interface VisitRecord {
  id: string;
  spotId: string;
  spotName: string;
  category: string;
  godEmoji: string;
  lat: number;
  lng: number;
  visitedAt: string; // ISO 8601（参拝した日）
  note?: string;
  photo?: string; // 圧縮 dataURL（任意・容量超過時は写真なしで保存）
  createdAt: string; // ISO 8601（記録を作った日時）
}

const KEY = 'yaorozu_visit_records';
const storageKey = (userId: string) => `${KEY}_${userId}`;

export function getVisitRecords(userId: string): VisitRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function write(userId: string, list: VisitRecord[]): boolean {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(list));
    schedulePush(); // クラウドへ同期（user-self のキーは SYNC_KEYS 対象）
    return true;
  } catch {
    return false; // 容量超過など
  }
}

/** 参拝記録を追加。写真つきで保存できないとき（容量超過）は写真を外して再試行する。 */
export function addVisitRecord(
  userId: string,
  spot: { id: string; name: string; category: string; latitude: number; longitude: number; godEmoji?: string },
  input?: { visitedAt?: string; note?: string; photo?: string }
): VisitRecord | null {
  const now = new Date().toISOString();
  const rec: VisitRecord = {
    id: `${spot.id}_${Date.now()}`,
    spotId: spot.id,
    spotName: spot.name,
    category: spot.category,
    godEmoji: spot.godEmoji || (spot.category === '神社' ? '⛩️' : '🙏'),
    lat: spot.latitude,
    lng: spot.longitude,
    visitedAt: input?.visitedAt || now,
    note: input?.note?.trim() || undefined,
    photo: input?.photo,
    createdAt: now,
  };
  const list = getVisitRecords(userId);
  if (write(userId, [rec, ...list])) return rec;
  // 容量超過 → 写真を外して保存し直す
  if (rec.photo) {
    rec.photo = undefined;
    if (write(userId, [rec, ...list])) return rec;
  }
  return null;
}

/**
 * 参拝記録を更新（再編集）。photo は undefined=変更なし / null=削除 / 文字列=差し替え。
 * 写真つきで保存できないとき（容量超過）は写真を外して再試行する。
 */
export function updateVisitRecord(
  userId: string,
  id: string,
  patch: { visitedAt?: string; note?: string; photo?: string | null }
): VisitRecord | null {
  const list = getVisitRecords(userId);
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const cur = list[idx];
  const next: VisitRecord = {
    ...cur,
    visitedAt: patch.visitedAt ?? cur.visitedAt,
    note: patch.note !== undefined ? patch.note.trim() || undefined : cur.note,
    photo: patch.photo === undefined ? cur.photo : patch.photo ?? undefined,
  };
  const updated = [...list];
  updated[idx] = next;
  if (write(userId, updated)) return next;
  // 容量超過 → 写真を外して保存し直す
  if (next.photo) {
    next.photo = undefined;
    updated[idx] = { ...next };
    if (write(userId, updated)) return next;
  }
  return null;
}

export function deleteVisitRecord(userId: string, id: string): void {
  write(userId, getVisitRecords(userId).filter((r) => r.id !== id));
}

/** その寺社の参拝記録の件数（「N回目の記録」表示用）。 */
export function countVisitsForSpot(userId: string, spotId: string): number {
  return getVisitRecords(userId).filter((r) => r.spotId === spotId).length;
}
