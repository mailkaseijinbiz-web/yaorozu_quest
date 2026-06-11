'use client';

// 神様からの手紙 受信箱モーダル
// -----------------------------------------------------------------------------
// 週次 cron（/api/cron/weekly-letter）が綴った「八百万神からの手紙」を読み返す。
// 一覧 → タップで本文を開き、開いた手紙は既読にする（未読バッジが減る）。
// 御朱印帳モーダルと同じオーバーレイ／朱印調の見た目を踏襲する。
// -----------------------------------------------------------------------------

import React, { useState } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import type { Letter } from '../lib/letters';

interface LetterInboxProps {
  letters: Letter[];
  onClose: () => void;
  onRead: (id: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

export default function LetterInbox({ letters, onClose, onRead }: LetterInboxProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = letters.find((l) => l.id === openId) ?? null;

  const handleOpen = (l: Letter) => {
    setOpenId(l.id);
    if (!l.read) onRead(l.id);
  };

  return (
    <div
      className="absolute inset-0 z-[3400] bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-[#fbf7ef] rounded-t-3xl sm:rounded-3xl max-h-[88vh] flex flex-col animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="relative bg-gradient-to-br from-amber-50 to-rose-100/60 px-5 pt-6 pb-5 text-center rounded-t-3xl">
          {open ? (
            <button
              onClick={() => setOpenId(null)}
              aria-label="一覧へ戻る"
              className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-gray-700 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : null}
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-gray-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="text-4xl leading-none">{open ? open.godEmoji : '📜'}</div>
          <p className="text-[11px] font-black tracking-[0.2em] text-amber-700 mt-2">LETTER FROM THE GODS</p>
          <h3 className="text-lg font-black text-gray-900 mt-0.5">{open ? open.title : '神様からの手紙'}</h3>
        </div>

        {/* 中身 */}
        <div className="px-5 py-4 overflow-y-auto">
          {open ? (
            // ── 本文 ──
            <div>
              <p className="text-[11px] text-amber-700/70 font-bold mb-3">
                {open.godName} ・ {formatDate(open.createdAt)}
              </p>
              <p className="text-[14px] leading-[2] text-gray-800 whitespace-pre-line" style={{ fontFamily: '"Hiragino Mincho ProN", serif' }}>
                {open.body}
              </p>
              {/* その週の歩み */}
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <Stat label="参拝" value={open.summary.visits} />
                <Stat label="徳" value={open.summary.tokuGained} />
                <Stat label="連続" value={`${open.summary.streak}日`} />
              </div>
            </div>
          ) : letters.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm font-black text-gray-500">まだ手紙は届いていません</p>
              <p className="text-xs text-gray-400 mt-1">毎週、その週の巡礼を神様が便りにしてくれます</p>
            </div>
          ) : (
            // ── 一覧 ──
            <div className="flex flex-col gap-2.5">
              {letters.map((l) => (
                <button
                  key={l.id}
                  onClick={() => handleOpen(l)}
                  className="w-full text-left bg-white rounded-2xl border border-amber-100 shadow-sm px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-amber-300 transition-colors"
                >
                  <div className="text-2xl leading-none flex-shrink-0">{l.godEmoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-black text-gray-900 truncate">{l.title}</p>
                      {!l.read && <span className="w-2 h-2 rounded-full bg-shrine-red flex-shrink-0" />}
                    </div>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">{l.body.replace(/\n/g, ' ')}</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">{formatDate(l.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-xl border border-amber-100 py-2">
      <p className="text-[15px] font-black text-amber-700 leading-none">{value}</p>
      <p className="text-[9px] text-gray-400 mt-1">{label}</p>
    </div>
  );
}
