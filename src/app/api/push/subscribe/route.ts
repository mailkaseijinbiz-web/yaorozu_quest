// 端末の Push 購読を保存する。Web Push の購読 と iOS(APNs) のデバイストークンの両方を受け付ける。
// GET は設定状況＋公開鍵を返す。
import { NextResponse } from 'next/server';
import { isPushConfigured, isApnsConfigured, saveSubscription } from '../../../../lib/push-server';
import { saveApnsToken } from '../../../../lib/apns-server';

export async function GET() {
  return NextResponse.json({
    configured: isPushConfigured(),
    apns: isApnsConfigured(),
    publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
  });
}

export async function POST(request: Request) {
  let body: { subscription?: unknown; platform?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  // iOS ネイティブ(Capacitor)：APNs デバイストークンを保存する。
  if (body.platform === 'ios') {
    if (!isApnsConfigured()) return NextResponse.json({ ok: false, error: 'apns not configured' }, { status: 503 });
    if (!body.token) return NextResponse.json({ ok: false, error: 'token required' }, { status: 400 });
    await saveApnsToken(body.token);
    return NextResponse.json({ ok: true });
  }

  // Web Push(VAPID)：Service Worker の購読情報を保存する。
  if (!isPushConfigured()) return NextResponse.json({ ok: false, error: 'push not configured' }, { status: 503 });
  const sub = body.subscription as { endpoint?: string } | undefined;
  if (!sub?.endpoint) return NextResponse.json({ ok: false, error: 'subscription required' }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await saveSubscription(sub as any);
  return NextResponse.json({ ok: true });
}
