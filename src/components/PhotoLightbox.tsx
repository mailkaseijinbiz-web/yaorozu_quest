'use client';

import React from 'react';
import { X } from 'lucide-react';

// 写真のモーダル拡大表示（ライトボックス）。
// どこをタップしても閉じる。記録・御朱印・奉納写真など写真の表示箇所で共用する。
export default function PhotoLightbox({
  src,
  alt = '写真',
  onClose,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[4000] bg-black/90 flex items-center justify-center" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="max-w-full max-h-full object-contain" />
      <button
        onClick={onClose}
        aria-label="閉じる"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
        className="absolute right-4 w-10 h-10 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-white cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
