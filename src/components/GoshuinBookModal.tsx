'use client';

// 御朱印帳モーダル
// -----------------------------------------------------------------------------
// 授与式（GoshuinCelebrate）の「御朱印帳を見る」から開く。
// これまではマイページの御朱印タブへ画面遷移していたが、授与式の文脈を保ったまま
// 集めた御朱印を一覧できるよう、その場にオーバーレイ表示する。
// マイページの御朱印タブと同じ朱印グリッドの見た目を踏襲する。
// -----------------------------------------------------------------------------

import React from 'react';
import { X } from 'lucide-react';
import type { Goshuin } from '../lib/goshuin';

interface GoshuinBookModalProps {
  goShuinList: Goshuin[];
  onClose: () => void;
}

export default function GoshuinBookModal({ goShuinList, onClose }: GoshuinBookModalProps) {
  return (
    <div
      className="absolute inset-0 z-[3400] bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[88vh] flex flex-col animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="relative bg-gradient-to-br from-red-50 to-rose-100/60 px-5 pt-6 pb-5 text-center rounded-t-3xl">
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-gray-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="text-4xl leading-none">📖</div>
          <p className="text-[11px] font-black tracking-[0.2em] text-rose-600 mt-2">GOSHUIN BOOK</p>
          <h3 className="text-lg font-black text-gray-900 mt-0.5">御朱印帳</h3>
          {goShuinList.length > 0 && (
            <p className="text-[12px] text-rose-700/80 font-bold mt-0.5">{goShuinList.length} 社寺の御朱印を集めた</p>
          )}
        </div>

        {/* 中身 */}
        <div className="px-5 py-4 overflow-y-auto">
          {goShuinList.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm font-black text-gray-500">御朱印帳が空です</p>
              <p className="text-xs text-gray-400 mt-1">神と対話すると御朱印を授かります</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] text-gray-400">※御朱印は公式のものではありません</span>
                <span className="text-[11px] text-gray-400 font-bold">{goShuinList.length} 社寺</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[...goShuinList].reverse().map((g) => {
                  const d = new Date(g.receivedAt);
                  const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
                  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                  return (
                    <div
                      key={g.id}
                      className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden flex flex-col items-center py-4 px-2 gap-1.5"
                    >
                      {g.photo ? (
                        // 撮影して保存した実物の御朱印
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={g.photo} alt={g.spotName} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        /* 朱印円 */
                        <div className="relative w-20 h-20 flex-shrink-0">
                          <div className="absolute inset-0 rounded-full border-4 border-red-600/80" />
                          <div className="absolute inset-1.5 rounded-full border-2 border-red-600/40" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                            <span className="text-2xl leading-none">{g.godEmoji}</span>
                            <span className="text-[8px] font-black text-red-700 text-center leading-tight px-1" style={{ maxWidth: 64 }}>{g.godName}</span>
                          </div>
                        </div>
                      )}
                      {/* スポット名 */}
                      <p className="text-[11px] font-black text-gray-800 text-center leading-tight line-clamp-2">{g.spotName}</p>
                      <p className="text-[9px] text-gray-400">{dateStr} {timeStr}</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
