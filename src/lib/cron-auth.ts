// cron ルートの共通認証・スナップショット抽出ヘルパー。
// -----------------------------------------------------------------------------

import type { LetterInputActivity, LetterInputVisit } from './letters';
import type { StreakLog } from './streak';

/**
 * cron リクエストの認可。CRON_SECRET が未設定なら null（=未構成で実行不可）を返す。
 * 設定済みなら Authorization: Bearer <secret> または ?key=<secret> と一致が必要。
 */
export function cronAuth(request: Request): { ok: boolean; configured: boolean } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, configured: false };
  const auth = request.headers.get('authorization') || '';
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  const ok = auth === `Bearer ${secret}` || key === secret;
  return { ok, configured: true };
}

/** スナップショット JSON から、手紙・ストリーク生成に必要なデータを取り出す。 */
export function extractUserData(data: Record<string, unknown>): {
  activities: LetterInputActivity[];
  visits: LetterInputVisit[];
  daily: StreakLog | null;
  goshuinTotal: number;
  displayName: string;
} {
  const activities = asArray<LetterInputActivity>(data['yaorozu_activities']);
  const visits = asArray<LetterInputVisit>(firstByPrefix(data, 'yaorozu_visit_records_'));
  const goshuin = asArray<unknown>(firstByPrefix(data, 'yaorozu_goshuin_'));
  const daily = (data['yaorozu_daily_v1'] as StreakLog | undefined) ?? null;

  let displayName = '巡礼者';
  const users = asArray<{ id?: string; displayName?: string; name?: string }>(data['yaorozu_users']);
  if (users.length) {
    const self = users.find((u) => u.id === 'user-self') ?? users[0];
    displayName = self?.displayName || self?.name || displayName;
  }

  return { activities, visits, daily, goshuinTotal: goshuin.length, displayName };
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function firstByPrefix(data: Record<string, unknown>, prefix: string): unknown {
  // user-self を優先、無ければ最初に見つかった prefix キー
  if (data[`${prefix}user-self`] != null) return data[`${prefix}user-self`];
  for (const k of Object.keys(data)) if (k.startsWith(prefix)) return data[k];
  return undefined;
}
