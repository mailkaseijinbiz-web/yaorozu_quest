'use client';

import React, { useRef, useState } from 'react';

// 下に引っぱって更新（pull-to-refresh）。スクロール最上部からの引き下げを検知し、
// しきい値を超えて指を離すと onRefresh を呼ぶ。スクロール領域そのものを内包するので、
// 各タブは外側の overflow-y-auto コンテナをこのコンポーネントに置き換えるだけでよい。
interface PullToRefreshProps {
  /** 更新処理（Promise を返せば完了まで「更新中…」を表示） */
  onRefresh: () => void | Promise<void>;
  /** スクロール要素へ付与する追加クラス（overflow-y-auto / h-full は内部で付与） */
  className?: string;
  /** 発火に必要な引っぱり量(px) */
  threshold?: number;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, className = '', threshold = 70, children }: PullToRefreshProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false); // 指を下ろして引っぱり中か（描画でrefを読まないため state 化）

  const onTouchStart = (e: React.TouchEvent) => {
    if (refreshing) return;
    const el = scrollRef.current;
    // 最上部にいるときだけ引っぱり判定を開始（途中スクロールでは通常のスクロールを優先）
    if (el && el.scrollTop <= 0) { startY.current = e.touches[0].clientY; setDragging(true); }
    else { startY.current = null; }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    // 下方向の引っぱりのみ。抵抗をかけて行き過ぎを抑える
    setPull(dy > 0 ? Math.min(dy * 0.5, threshold * 1.6) : 0);
  };

  const onTouchEnd = async () => {
    setDragging(false);
    if (startY.current == null || refreshing) { startY.current = null; return; }
    startY.current = null;
    if (pull >= threshold) {
      setRefreshing(true);
      setPull(Math.round(threshold * 0.7)); // スピナーが見える位置で保持
      try { await onRefresh(); } finally { setRefreshing(false); setPull(0); }
    } else {
      setPull(0);
    }
  };

  const ready = pull >= threshold;

  return (
    // 既存タブのスクロール領域を内包しつつ、最上部にインジケータを重ねる。
    // children はスクロール要素の直接の子のままにして、各タブの flex レイアウトを壊さない。
    <div className="relative h-full overflow-hidden">
      {/* 引っぱりインジケータ（視覚的な最上部に固定。引っぱり量で高さ・回転が変わる） */}
      <div
        className="absolute left-0 right-0 top-0 z-[60] flex items-end justify-center pointer-events-none"
        style={{ height: pull, opacity: pull > 6 ? 1 : 0, transition: dragging ? 'none' : 'height 0.2s ease, opacity 0.2s ease' }}
      >
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-black text-shrine-red">
          <span
            className={`w-4 h-4 border-2 border-shrine-red border-t-transparent rounded-full ${refreshing ? 'animate-spin' : ''}`}
            style={refreshing ? undefined : { transform: `rotate(${pull * 4}deg)` }}
          />
          {refreshing ? '更新中…' : ready ? '離して更新' : '引っぱって更新'}
        </div>
      </div>

      <div
        ref={scrollRef}
        className={`h-full overflow-y-auto ${className}`}
        style={{ transform: pull ? `translateY(${pull}px)` : undefined, transition: dragging ? 'none' : 'transform 0.2s ease' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
