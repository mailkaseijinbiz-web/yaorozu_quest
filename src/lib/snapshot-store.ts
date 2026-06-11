// サーバー側スナップショット入出力（cron 用）。
// クラウド同期は user_snapshots テーブルに「1ユーザー=1 JSON 行」で保存される
// （/api/persist と同じ）。cron はこの行を直接読み、特定キーへ追記して書き戻す。
// 書き戻しは mergeSnapshots を通すため、クライアントの並行 push と衝突しても
// エンティティ（手紙など id 付き配列）が失われない。
// -----------------------------------------------------------------------------

import { getSupabaseAdmin, isSupabaseEnabled } from './supabase';
import { mergeSnapshots } from './snapshot-merge';

export interface SnapshotRow {
  userId: string;
  data: Record<string, unknown>;
  updatedAt: string | null;
}

/** 全ユーザーのスナップショットを取得する。Supabase 無効時は空配列。 */
export async function listSnapshots(): Promise<SnapshotRow[]> {
  if (!isSupabaseEnabled()) return [];
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('user_snapshots')
      .select('user_id, data, updated_at');
    if (error || !data) return [];
    return data.map((r) => ({
      userId: (r as { user_id: string }).user_id,
      data: ((r as { data: Record<string, unknown> }).data) ?? {},
      updatedAt: (r as { updated_at: string | null }).updated_at ?? null,
    }));
  } catch {
    return [];
  }
}

/** 1ユーザーの特定キー配列へ要素を追記し、マージして書き戻す（read-modify-write）。 */
export async function appendToSnapshotArray(
  userId: string,
  key: string,
  items: unknown[],
): Promise<boolean> {
  if (!isSupabaseEnabled() || items.length === 0) return false;
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  try {
    const { data: existing } = await sb
      .from('user_snapshots')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();
    const base = (existing?.data as Record<string, unknown>) ?? {};
    // incoming 側は追記分のみ。mergeSnapshots が id 付き配列を和集合にするため、
    // base 側の既存要素は保持され、追記分だけが増える。
    const incoming = { [key]: items };
    const merged = mergeSnapshots(base, incoming) as Record<string, unknown>;
    const { error } = await sb
      .from('user_snapshots')
      .upsert({ user_id: userId, data: merged, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    return !error;
  } catch {
    return false;
  }
}
