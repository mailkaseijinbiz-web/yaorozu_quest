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

/** 御朱印を授ける。既に持っている場合は null を返す。 */
export function grantGoShuin(
  userId: string,
  spot: { id: string; name: string; category: string; godEmoji?: string },
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
