// 端末の Push 購読を保存する。GET は設定状況＋公開鍵を返す。
import { NextResponse } from 'next/server';
import { isPushConfigured, saveSubscription } from '../../../../lib/push-server';

export async function GET() {
  return NextResponse.json({
    configured: isPushConfigured(),
    publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
  });
}

export async function POST(request: Request) {
  if (!isPushConfigured()) return NextResponse.json({ ok: false, error: 'push not configured' }, { status: 503 });
  let body: { subscription?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const sub = body.subscription as { endpoint?: string } | undefined;
  if (!sub?.endpoint) return NextResponse.json({ ok: false, error: 'subscription required' }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await saveSubscription(sub as any);
  return NextResponse.json({ ok: true });
}
