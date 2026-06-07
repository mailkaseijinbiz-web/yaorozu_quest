import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseEnabled } from '../../../lib/supabase';

// ユーザーごとのデータスナップショットを保存／復元する。
// 鍵(SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)未設定時は enabled:false を返し no-op。

export async function GET(request: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ enabled: false });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ enabled: false });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ enabled: true, data: null });

  const { data, error } = await supabase
    .from('user_snapshots')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return NextResponse.json({ enabled: true, data: null, error: error.message }, { status: 500 });
  return NextResponse.json({ enabled: true, data: data?.data ?? null, updatedAt: data?.updated_at ?? null });
}

export async function POST(request: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ enabled: false });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ enabled: false });

  let body: { userId?: string; data?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body.userId || typeof body.data !== 'object') {
    return NextResponse.json({ error: 'userId and data required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('user_snapshots')
    .upsert({ user_id: body.userId, data: body.data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  if (error) return NextResponse.json({ enabled: true, ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ enabled: true, ok: true });
}
