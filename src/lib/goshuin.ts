// 御朱印ストア
// 神と対話した（初回メッセージ送信）スポットの御朱印を localStorage に保存する。
import { schedulePush } from './cloud-sync';

export interface Goshuin {
  id: string;
  spotId: string;
  spotName: string;
  godName: string;
  godEmoji: string;
  category: string;
  receivedAt: string; // ISO 8601
  lat?: number;       // 授かった場の緯度（日本地図表示用・後方互換で任意）
  lng?: number;       // 授かった場の経度
  photo?: string;     // 実物の御朱印を撮影した写真（圧縮 dataURL・任意）
  source?: 'conversation' | 'photo'; // 授与経路。未設定=対話（後方互換）
}

const KEY = 'yaorozu_goshuin';

function storageKey(userId: string) {
  return `${KEY}_${userId}`;
}

export function getGoShuinList(userId: string): Goshuin[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function hasGoShuin(userId: string, spotId: string): boolean {
  return getGoShuinList(userId).some((g) => g.spotId === spotId);
}

function writeList(userId: string, list: Goshuin[]): boolean {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(list));
    // user-self の御朱印キーは SYNC_KEYS 対象。クラウド同期を予約して同期漏れを防ぐ。
    schedulePush();
    return true;
  } catch {
    return false; // 容量超過など
  }
}

/**
 * 実物の御朱印を撮影して保存する（写真つきデジタル御朱印）。
 * 対話授与（grantGoShuin）と違い、同じ寺社に複数枚・任意の寺社名で残せる。
 */
export function addPhotoGoshuin(
  userId: string,
  input: { spotId?: string; spotName: string; category?: string; godName?: string; godEmoji?: string; photo: string; latitude?: number; longitude?: number }
): Goshuin | null {
  const stamp: Goshuin = {
    id: `photo_${input.spotId || 'free'}_${Date.now()}`,
    spotId: input.spotId || `photo-${Date.now()}`,
    spotName: input.spotName,
    godName: input.godName || '',
    godEmoji: input.godEmoji || (input.category === '神社' ? '⛩️' : '🙏'),
    category: input.category || '',
    receivedAt: new Date().toISOString(),
    lat: input.latitude,
    lng: input.longitude,
    photo: input.photo,
    source: 'photo',
  };
  return writeList(userId, [...getGoShuinList(userId), stamp]) ? stamp : null;
}

/** 御朱印を1件削除する（主に写真御朱印の取り消し用）。 */
export function deleteGoshuin(userId: string, id: string): void {
  writeList(userId, getGoShuinList(userId).filter((g) => g.id !== id));
}

/** 既存の御朱印に実物写真を保存（差し替え）する。容量超過などで保存できなければ false。 */
export function setGoshuinPhoto(userId: string, id: string, photo: string): boolean {
  const list = getGoShuinList(userId);
  const idx = list.findIndex((g) => g.id === id);
  if (idx < 0) return false;
  const next = [...list];
  next[idx] = { ...next[idx], photo };
  return writeList(userId, next);
}

/** 御朱印を授ける。既に持っている場合は null を返す。 */
export function grantGoShuin(
  userId: string,
  spot: { id: string; name: string; category: string; godEmoji?: string; latitude?: number; longitude?: number },
  godName: string
): Goshuin | null {
  if (hasGoShuin(userId, spot.id)) return null;
  const stamp: Goshuin = {
    id: `${spot.id}_${Date.now()}`,
    spotId: spot.id,
    spotName: spot.name,
    godName,
    godEmoji: spot.godEmoji || '🙏',
    category: spot.category,
    receivedAt: new Date().toISOString(),
    lat: spot.latitude,
    lng: spot.longitude,
  };
  try {
    const list = getGoShuinList(userId);
    localStorage.setItem(storageKey(userId), JSON.stringify([...list, stamp]));
    // user-self の御朱印キーは SYNC_KEYS 対象。クラウド同期を予約して同期漏れを防ぐ。
    schedulePush();
  } catch {
    return null;
  }
  return stamp;
}
