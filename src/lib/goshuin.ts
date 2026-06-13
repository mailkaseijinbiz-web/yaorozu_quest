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
  deletedAt?: string; // ISO 8601 — ソフト削除日時。undefined = 生存。
}

const KEY = 'yaorozu_goshuin';

function storageKey(userId: string) {
  return `${KEY}_${userId}`;
}

/** 保存されている全御朱印（ソフト削除済みも含む）。同期・重複判定の正本。 */
function getGoShuinRaw(userId: string): Goshuin[] {
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

/** 表示用の御朱印一覧（ソフト削除済みは除外）。 */
export function getGoShuinList(userId: string): Goshuin[] {
  return getGoShuinRaw(userId).filter((g) => !g.deletedAt);
}

/**
 * その場の御朱印を「授かったことがある」か（ソフト削除済みも true）。
 * 削除済みを true 扱いにすることで、削除した御朱印が近接・対話で再付与されて
 * 復活するのを防ぐ（spots の「削除は尊重する」方針に合わせる）。
 */
export function hasGoShuin(userId: string, spotId: string): boolean {
  return getGoShuinRaw(userId).some((g) => g.spotId === spotId);
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
  return writeList(userId, [...getGoShuinRaw(userId), stamp]) ? stamp : null;
}

/**
 * 御朱印を1件削除する（ソフト削除）。要素は消さず deletedAt を打刻する。
 * ハード削除（要素を消す）だと、クラウド同期の id 和集合マージで
 * 別端末/クラウド側に残る同じ御朱印が復活してしまうため、墓標を残して
 * 「削除した」という事実を同期させる。
 */
export function deleteGoshuin(userId: string, id: string): void {
  const ts = new Date().toISOString();
  writeList(userId, getGoShuinRaw(userId).map((g) => (g.id === id && !g.deletedAt ? { ...g, deletedAt: ts } : g)));
}

/** 既存の御朱印に実物写真を保存（差し替え）する。容量超過などで保存できなければ false。 */
export function setGoshuinPhoto(userId: string, id: string, photo: string): boolean {
  const list = getGoShuinRaw(userId);
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
    const list = getGoShuinRaw(userId);
    localStorage.setItem(storageKey(userId), JSON.stringify([...list, stamp]));
    // user-self の御朱印キーは SYNC_KEYS 対象。クラウド同期を予約して同期漏れを防ぐ。
    schedulePush();
  } catch {
    return null;
  }
  return stamp;
}
