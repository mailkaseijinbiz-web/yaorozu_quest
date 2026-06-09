import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  adminToken,
  isAdminAuthed,
  verifyAdminPassword,
} from '../../../../lib/admin-auth';

// 現在のセッション状態を返す（クライアントが起動時に認証済みか確認するため）。
export async function GET() {
  return NextResponse.json({ authed: await isAdminAuthed() });
}

// パスワードでログインし、HttpOnly Cookie を発行する。
export async function POST(request: Request) {
  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  if (!verifyAdminPassword(body.password)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const token = adminToken();
  if (!token) {
    // ADMIN_PASSWORD 未設定（サーバー設定ミス）。verifyAdminPassword を通った時点で通常ここには来ない。
    return NextResponse.json({ ok: false, error: 'admin not configured' }, { status: 503 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  return res;
}

// ログアウト（Cookie を失効）。
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
