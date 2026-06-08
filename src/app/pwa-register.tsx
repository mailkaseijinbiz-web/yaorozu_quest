'use client';

import { useEffect } from 'react';

/**
 * Service Worker を登録するクライアント専用コンポーネント。
 * 本番ビルドでのみ登録し、開発時は HMR と競合しないよう既存登録を解除する。
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      // 開発時は SW を無効化（古いキャッシュで HMR が壊れるのを防ぐ）
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('SW registration failed:', err);
      });
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
