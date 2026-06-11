'use client';

// クライアント用 Supabase（anon キー）。OAuth ログイン（Google/Apple）に使用。
// 環境変数 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 未設定時は無効（null）。
import { createClient, type SupabaseClient, type User as SupaUser } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** 認証（OAuth）が利用可能か（anon キー設定済みか）。 */
export function isAuthConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseBrowser(): SupabaseClient | null {
  if (!isAuthConfigured()) return null;
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      // flowType 'pkce'：既定の implicit フローは URL ハッシュでトークンを受け取るため、
      // iOS Safari / PWA でハッシュが落ちてログインが完了しないことがある。
      // PKCE は ?code= をクライアントが交換する方式で、モバイルでも確実に復帰できる。
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } },
    );
  }
  return client;
}

/** OAuth ログイン開始（プロバイダ画面へリダイレクト）。 */
export async function signInWithProvider(provider: 'google' | 'apple'): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseBrowser();
  if (!sb) return { ok: false, error: 'auth not configured' };
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOutAuth(): Promise<void> {
  await getSupabaseBrowser()?.auth.signOut();
}

export interface AuthProfile {
  id: string;
  displayName: string;
  avatarUrl: string;
  email?: string;
}

/** Supabase の User からアプリ用プロフィールを抽出。 */
export function profileFromUser(u: SupaUser): AuthProfile {
  const m = (u.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    (m.name as string) || (m.full_name as string) || (m.user_name as string) ||
    (u.email ? u.email.split('@')[0] : '') || '巡礼者';
  const avatarUrl =
    (m.avatar_url as string) || (m.picture as string) ||
    `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(displayName)}`;
  return { id: u.id, displayName, avatarUrl, email: u.email ?? undefined };
}
