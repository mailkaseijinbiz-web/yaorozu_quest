import React from 'react';
import { getLevelInfo } from '../data/levels';

interface Props {
  toku: number;
  className?: string;
  showLevel?: boolean;
}

export default function UserTitle({ toku, className = '', showLevel = true }: Props) {
  const lvInfo = getLevelInfo(toku);
  const lv = lvInfo.current.level;

  // レベルに応じたランク装飾の決定
  let rankStyle = '';
  if (lv === 1 || lv === 2) {
    // 銅 (Bronze)
    rankStyle = 'bg-gradient-to-br from-amber-700 to-amber-900 text-white border-amber-900/50 shadow-sm';
  } else if (lv === 3) {
    // 銀 (Silver)
    rankStyle = 'bg-gradient-to-br from-slate-300 via-gray-300 to-slate-400 text-slate-800 border-slate-400/50 shadow-sm shadow-slate-300/30';
  } else if (lv === 4) {
    // 金 (Gold)
    rankStyle = 'bg-gradient-to-br from-yellow-200 via-amber-400 to-yellow-600 text-amber-950 border-yellow-400 shadow-md shadow-yellow-500/40';
  } else if (lv >= 5) {
    // 虹 (Rainbow)
    rankStyle = 'bg-[linear-gradient(110deg,#e60012,20%,#f5c542,40%,#60a5fa,60%,#2563eb,80%,#8b5cf6)] text-white border-white/40 shadow-lg shadow-sky-500/30 animate-pulse-slow';
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border ${rankStyle} ${className}`}>
      {showLevel && (
        <span className="text-[10px] font-black opacity-90 drop-shadow-sm tracking-wide">Lv.{lvInfo.current.level}</span>
      )}
      <span className="text-[11px] font-bold drop-shadow-sm leading-tight">{lvInfo.current.title}</span>
    </div>
  );
}
