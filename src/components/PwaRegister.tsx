'use client';

import { useEffect, useState } from 'react';

// このバンドルがビルドされた時点のビルドID（デプロイごとに一意）。
const BUILD = process.env.NEXT_PUBLIC_BUILD_ID;

// Service Worker を登録して PWA（インストール・プッシュ通知）を有効化し、
// 新しいデプロイを検知したら「更新」トーストを出して滑らかに更新できるようにする。
export default function PwaRegister() {
  const [updateReady, setUpdateReady] = useState(false);

  // Service Worker 登録
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // 本番・ローカルとも登録（dev でも動作確認できるように）
    navigator.serviceWorker.register('/sw.js').catch(() => { /* 登録失敗は無視 */ });
  }, []);

  // 新しいデプロイの検知：自分のビルドIDと、サーバーが返す現行ビルドIDを比較。
  // アプリ復帰時（visibilitychange）と一定間隔でチェックし、差があれば更新を促す。
  useEffect(() => {
    if (!BUILD || BUILD.startsWith('dev')) return; // 開発ビルドでは無効
    let stopped = false;

    const check = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const { version } = await res.json();
        if (!stopped && version && version !== BUILD) setUpdateReady(true);
      } catch { /* オフライン等は無視（次回チェックに委ねる） */ }
    };

    check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(check, 5 * 60 * 1000); // 5分ごと

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(id);
    };
  }, []);

  if (!updateReady) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[5000]"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}
    >
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1.5 bg-gray-900/92 text-white text-[13px] font-black px-4 py-2.5 rounded-full shadow-lg backdrop-blur-md cursor-pointer active:scale-95 transition-all"
      >
        ✨ 新しいバージョンがあります — タップで更新
      </button>
    </div>
  );
}
