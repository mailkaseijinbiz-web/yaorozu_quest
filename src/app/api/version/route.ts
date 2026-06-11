// 現在デプロイされているビルドID を返す軽量エンドポイント。
// クライアントは自分のバンドルに埋め込まれた NEXT_PUBLIC_BUILD_ID と突き合わせ、
// 値が変わっていれば「新しいデプロイがある」と判断して更新を促す（PwaRegister）。
// （再デプロイのトリガー用コメント。挙動への影響はなし）
import { NextResponse } from 'next/server';

// 各デプロイのサーバーバンドルに、そのデプロイの BUILD_ID が埋め込まれる。
// キャッシュさせず常に現在デプロイの値を返す。
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    { version: process.env.NEXT_PUBLIC_BUILD_ID || 'dev' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
