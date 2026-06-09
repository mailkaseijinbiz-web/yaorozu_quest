'use client';

import { useEffect } from 'react';

// Service Worker を登録して PWA（インストール・プッシュ通知）を有効化する。
export default function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // 本番・ローカルとも登録（dev でも動作確認できるように）
    navigator.serviceWorker.register('/sw.js').catch(() => { /* 登録失敗は無視 */ });
  }, []);
  return null;
}
