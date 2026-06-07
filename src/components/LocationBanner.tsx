'use client';

import React from 'react';
import { MapPin, LocateFixed, Loader2, AlertTriangle } from 'lucide-react';

export type LocationStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable';

interface LocationBannerProps {
  status: LocationStatus;
  onRetry: () => void;
}

/**
 * 現在地の取得状態をユーザーに明示するバナー。
 * - locating: 取得中（スピナー）
 * - granted : 何も出さない（距離は実測なので案内不要）
 * - idle/denied/unavailable: 「距離は目安」である旨＋再取得ボタン
 */
export default function LocationBanner({ status, onRetry }: LocationBannerProps) {
  if (status === 'granted') return null;

  if (status === 'locating') {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-sky-50 border border-sky-200/70 px-3 py-2 mb-3">
        <Loader2 className="w-4 h-4 text-sky-600 animate-spin flex-shrink-0" />
        <p className="text-[13px] text-sky-800 font-bold">現在地を取得しています…</p>
      </div>
    );
  }

  const isDenied = status === 'denied';
  const message = isDenied
    ? '位置情報がオフのため、距離は既定の現在地が基準です。'
    : status === 'unavailable'
    ? '現在地を取得できませんでした。距離は目安です。'
    : '現在地は未取得です。距離は目安として表示しています。';

  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-200/80 px-3 py-2 mb-3">
      {isDenied ? (
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
      ) : (
        <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0" />
      )}
      <p className="flex-1 min-w-0 text-[13px] text-amber-800 leading-snug">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-1 flex-shrink-0 text-[13px] font-black text-amber-900 bg-amber-100 hover:bg-amber-200 active:scale-95 transition-all px-2.5 py-1.5 rounded-lg cursor-pointer"
      >
        <LocateFixed className="w-3.5 h-3.5" />現在地を使う
      </button>
    </div>
  );
}
