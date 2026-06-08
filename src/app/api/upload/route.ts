import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseEnabled } from '../../../lib/supabase';

// 画像を Supabase Storage にアップロードし公開URLを返す。
// 鍵未設定時は enabled:false を返し、クライアント側で base64 フォールバックさせる。

const BUCKET = 'photos';

export async function POST(request: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ enabled: false });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ enabled: false });

  let body: { dataUrl?: string; prefix?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { dataUrl, prefix = 'misc' } = body;
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return NextResponse.json({ error: 'dataUrl required' }, { status: 400 });
  }

  // data:image/jpeg;base64,xxxx を分解
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return NextResponse.json({ error: 'unsupported data url' }, { status: 400 });
  const contentType = match[1];
  const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
  const buffer = Buffer.from(match[2], 'base64');

  // 5MB 上限（圧縮後はほぼ収まる想定）
  if (buffer.byteLength > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'file too large' }, { status: 413 });
  }

  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'misc';
  const path = `${safePrefix}/${Date.now()}-${Math.round(buffer.byteLength)}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: false });

  if (error) {
    return NextResponse.json({ enabled: true, ok: false, error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ enabled: true, ok: true, url: data.publicUrl });
}
