import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseEnabled } from '../../../lib/supabase';
import { mergeSnapshots } from '../../../lib/snapshot-merge';

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

  let body: { userId?: string; data?: Record<string, unknown>; baseUpdatedAt?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body.userId || typeof body.data !== 'object' || body.data == null) {
    return NextResponse.json({ error: 'userId and data required' }, { status: 400 });
  }
  const userId = body.userId;
  const incoming = body.data as Record<string, unknown>;

  // 楽観的並行制御: クライアントが最後に取得した版(baseUpdatedAt)より
  // サーバーが新しい＝別端末が後から書込んでいる場合は、丸ごと上書きせず
  // キー単位でマージして両者を保全する（新規投稿・御朱印・徳の消失を防ぐ）。
  const { data: existing, error: selErr } = await supabase
    .from('user_snapshots')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (selErr) return NextResponse.json({ enabled: true, ok: false, error: selErr.message }, { status: 500 });

  let toWrite: Record<string, unknown> = incoming;
  let merged = false;
  if (existing) {
    const base = body.baseUpdatedAt ?? null;
    const serverNewer =
      base == null || new Date(existing.updated_at as string).getTime() > new Date(base).getTime();
    if (serverNewer) {
      toWrite = mergeSnapshots(
        existing.data as Record<string, unknown>,
        incoming,
      ) as Record<string, unknown>;
      merged = true;
    }
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('user_snapshots')
    .upsert({ user_id: userId, data: toWrite, updated_at: now }, { onConflict: 'user_id' });

  if (error) return NextResponse.json({ enabled: true, ok: false, error: error.message }, { status: 500 });
  // merged の場合はマージ後の正本を返し、クライアントが localStorage を更新できるようにする。
  return NextResponse.json({ enabled: true, ok: true, updatedAt: now, merged, data: merged ? toWrite : undefined });
}
