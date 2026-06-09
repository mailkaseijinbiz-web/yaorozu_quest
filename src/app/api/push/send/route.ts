// 登録済みの全端末へ Web Push を送信する（管理・通知用）。
import { NextResponse } from 'next/server';
import { isPushConfigured, sendToAll } from '../../../../lib/push-server';

export async function POST(request: Request) {
  if (!isPushConfigured()) return NextResponse.json({ ok: false, error: 'push not configured' }, { status: 503 });
  let body: { title?: string; body?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const title = (body.title || '八百万クエスト').slice(0, 80);
  const text = (body.body || '新しいクエストが現れました。').slice(0, 200);
  const url = body.url || '/';
  const result = await sendToAll({ title, body: text, url });
  return NextResponse.json({ ok: true, ...result });
}
