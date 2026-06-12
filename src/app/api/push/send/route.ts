// 登録済みの全端末へプッシュ送信する（Web Push + iOS APNs。管理・通知用）。
import { NextResponse } from 'next/server';
import { isAnyPushConfigured, sendToAll } from '../../../../lib/push-server';
import { isAdminAuthed } from '../../../../lib/admin-auth';

export async function POST(request: Request) {
  // 管理者のみ全端末への一斉送信を許可する（無認可ブロードキャスト防止）。
  if (!(await isAdminAuthed())) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!isAnyPushConfigured()) return NextResponse.json({ ok: false, error: 'push not configured' }, { status: 503 });
  let body: { title?: string; body?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const title = (body.title || '八百万クエスト').slice(0, 80);
  const text = (body.body || '新しいクエストが現れました。').slice(0, 200);
  const url = body.url || '/';
  try {
    const result = await sendToAll({ title, body: text, url });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    // 想定外の例外でも 500 のまま返さず、原因を JSON で返して管理画面に表示できるようにする。
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'send failed' }, { status: 500 });
  }
}
