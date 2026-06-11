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
  photo?: string; // 旧データ（1枚）。後方互換のため読み取り専用で残す
  photos?: string[]; // 圧縮 dataURL（最大 MAX_RECORD_PHOTOS 枚・任意・容量超過時は写真なしで保存）
  createdAt: string; // ISO 8601（記録を作った日時）
}

/** 1投稿に添付できる写真の上限 */
export const MAX_RECORD_PHOTOS = 30;

const KEY = 'yaorozu_visit_records';
const storageKey = (userId: string) => `${KEY}_${userId}`;

/** 記録の写真を配列で返す（旧 photo 単体データも 1 枚として吸収する）。 */
export function recordPhotos(rec: VisitRecord): string[] {
  if (rec.photos && rec.photos.length) return rec.photos;
  return rec.photo ? [rec.photo] : [];
}

/** ローカル時刻での日付キー（YYYY-M-D）。1日1投稿の判定に使う。 */
const dayKey = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** その寺社について、指定日にすでに記録（投稿）があるか。1日1投稿の制限に使う。 */
export function hasRecordForSpotOnDate(userId: string, spotId: string, visitedAtISO: string): boolean {
  const k = dayKey(visitedAtISO);
  return getVisitRecords(userId).some((r) => r.spotId === spotId && dayKey(r.visitedAt) === k);
}

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
  input?: { visitedAt?: string; note?: string; photos?: string[] }
): VisitRecord | null {
  const now = new Date().toISOString();
  const photos = (input?.photos || []).slice(0, MAX_RECORD_PHOTOS);
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
    photos: photos.length ? photos : undefined,
    createdAt: now,
  };
  const list = getVisitRecords(userId);
  if (write(userId, [rec, ...list])) return rec;
  // 容量超過 → 写真を減らして（最終的に外して）保存し直す
  if (rec.photos) {
    rec.photos = undefined;
    if (write(userId, [rec, ...list])) return rec;
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
