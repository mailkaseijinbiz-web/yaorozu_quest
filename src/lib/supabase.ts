// Supabase クライアント（サーバー専用）。
// 書き込みはサービスロールキーで API Route 経由のみ。クライアントには露出しない。
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

/** サーバー(API Route)専用：サービスロールでのフルアクセスクライアント。未設定なら null。 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  if (!_admin) {
    _admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

/** Supabase 永続化が有効かどうか（環境変数が揃っているか）。 */
export function isSupabaseEnabled(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
