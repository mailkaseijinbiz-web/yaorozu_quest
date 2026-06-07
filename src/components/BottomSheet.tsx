'use client';

import React, { useRef, useEffect, useCallback, ReactNode } from 'react';

type SnapPoint = 'collapsed' | 'half' | 'expanded';

interface BottomSheetProps {
  state: SnapPoint;
  onStateChange: (s: SnapPoint) => void;
  /** コンテンツ上部のハンドル領域の高さ(px) - ここだけドラッグ受付 */
  handleHeight?: number;
  children: ReactNode;
  /** シートが占める画面高の割合: collapsed=peek, half, expanded */
  snapRatios?: { collapsed: number; half: number; expanded: number };
}

/**
 * BottomSheet
 * - Touch/Pointer イベントでリアルタイム追従
 * - リリース時に velocity でスナップ先を決定
 * - スナップ時だけ spring transition を適用
 */
export default function BottomSheet({
  state,
  onStateChange,
  handleHeight = 52,
  children,
  snapRatios = { collapsed: 0.92, half: 0.50, expanded: 0.08 },
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // ドラッグ状態
  const drag = useRef({
    active: false,
    startY: 0,
    startTranslate: 0,
    lastY: 0,
    lastTime: 0,
    velocity: 0, // px/ms
  });

  // containerHeight は mount 時に取得
  const containerH = useRef(0);

  const snapYFor = useCallback(
    (s: SnapPoint) => {
      const h = containerH.current;
      return Math.round(h * snapRatios[s]);
    },
    [snapRatios]
  );

  // 現在のスナップ状態から translateY を計算
  const translateYForState = useCallback(
    (s: SnapPoint) => snapYFor(s),
    [snapYFor]
  );

  // translateY を直接 style に反映（transition なし）
  const setTranslate = (y: number, animate: boolean) => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = animate
      ? 'transform 0.38s cubic-bezier(0.32,0.72,0,1)'
      : 'none';
    el.style.transform = `translateY(${y}px)`;

    // オーバーレイ透明度
    const ov = overlayRef.current;
    if (ov) {
      const h = containerH.current;
      const halfY = snapYFor('half');
      const ratio = Math.max(0, Math.min(1, (halfY - y) / halfY));
      ov.style.opacity = String(ratio * 0.4);
      ov.style.pointerEvents = ratio > 0.05 ? 'auto' : 'none';
    }
  };

  // state 変化 → アニメーション付きスナップ
  useEffect(() => {
    const h = sheetRef.current?.parentElement?.clientHeight ?? 0;
    containerH.current = h;
    setTranslate(translateYForState(state), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Resize 対応
  useEffect(() => {
    const onResize = () => {
      const h = sheetRef.current?.parentElement?.clientHeight ?? 0;
      containerH.current = h;
      setTranslate(translateYForState(state), false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // 最近接スナップを探す
  const nearestSnap = (y: number): SnapPoint => {
    const snaps: SnapPoint[] = ['collapsed', 'half', 'expanded'];
    let best: SnapPoint = 'half';
    let bestDist = Infinity;
    for (const s of snaps) {
      const d = Math.abs(snapYFor(s) - y);
      if (d < bestDist) { bestDist = d; best = s; }
    }
    return best;
  };

  // velocity 込みの判定
  const snapFromVelocity = (y: number, vel: number): SnapPoint => {
    // vel: px/ms  正=下向き
    const THRESHOLD = 0.3; // px/ms
    if (vel > THRESHOLD) {
      // 素早く下 → 一段下のスナップ
      if (y < snapYFor('half')) return 'half';
      return 'collapsed';
    }
    if (vel < -THRESHOLD) {
      // 素早く上 → 一段上のスナップ
      if (y > snapYFor('half')) return 'half';
      return 'expanded';
    }
    return nearestSnap(y);
  };

  // ---------- Touch handlers ----------
  const onTouchStart = (e: React.TouchEvent) => {
    const el = sheetRef.current;
    if (!el) return;

    // 現在の translateY を取得
    const mat = new DOMMatrix(getComputedStyle(el).transform);
    const curY = mat.m42;

    drag.current = {
      active: true,
      startY: e.touches[0].clientY,
      startTranslate: curY,
      lastY: e.touches[0].clientY,
      lastTime: Date.now(),
      velocity: 0,
    };
    el.style.transition = 'none';
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!drag.current.active) return;
    const clientY = e.touches[0].clientY;
    const now = Date.now();
    const dt = now - drag.current.lastTime;
    if (dt > 0) {
      drag.current.velocity = (clientY - drag.current.lastY) / dt;
    }
    drag.current.lastY = clientY;
    drag.current.lastTime = now;

    const dy = clientY - drag.current.startY;
    const raw = drag.current.startTranslate + dy;

    // 上端を超えた場合はラバーバンド (dampening)
    const minY = snapYFor('expanded');
    const clamped = raw < minY ? minY - (minY - raw) * 0.25 : raw;
    setTranslate(clamped, false);
  };

  const onTouchEnd = () => {
    if (!drag.current.active) return;
    drag.current.active = false;

    const el = sheetRef.current;
    if (!el) return;
    const mat = new DOMMatrix(getComputedStyle(el).transform);
    const curY = mat.m42;

    const snap = snapFromVelocity(curY, drag.current.velocity);
    if (snap === state) {
      // 同じ snap → アニメーションだけ走らせる
      setTranslate(snapYFor(snap), true);
    } else {
      onStateChange(snap);
    }
  };

  return (
    <>
      {/* スクリム */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black pointer-events-none z-[1900]"
        style={{ opacity: 0, transition: 'opacity 0.3s' }}
        onClick={() => onStateChange('collapsed')}
      />

      {/* シート本体 */}
      <div
        ref={sheetRef}
        className="absolute inset-0 z-[2000] flex flex-col bg-white rounded-t-3xl shadow-2xl border-t border-black/8 will-change-transform"
        style={{
          transform: `translateY(${snapYFor('collapsed')}px)`,
          // 初期値は collapsed — useEffect で正しい値に書き換わる
        }}
      >
        {/* ドラッグハンドル領域 */}
        <div
          className="flex-shrink-0 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none"
          style={{ height: handleHeight, touchAction: 'none' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          // マウスでも動くように (デスクトップ確認用)
          onMouseDown={(e) => {
            const el = sheetRef.current;
            if (!el) return;
            const mat = new DOMMatrix(getComputedStyle(el).transform);
            drag.current = {
              active: true,
              startY: e.clientY,
              startTranslate: mat.m42,
              lastY: e.clientY,
              lastTime: Date.now(),
              velocity: 0,
            };
            el.style.transition = 'none';

            const onMove = (ev: MouseEvent) => {
              if (!drag.current.active) return;
              const now = Date.now();
              const dt = now - drag.current.lastTime;
              if (dt > 0) drag.current.velocity = (ev.clientY - drag.current.lastY) / dt;
              drag.current.lastY = ev.clientY;
              drag.current.lastTime = now;
              const dy = ev.clientY - drag.current.startY;
              const raw = drag.current.startTranslate + dy;
              const minY = snapYFor('expanded');
              const clamped = raw < minY ? minY - (minY - raw) * 0.25 : raw;
              setTranslate(clamped, false);
            };
            const onUp = () => {
              if (!drag.current.active) return;
              drag.current.active = false;
              const m = new DOMMatrix(getComputedStyle(el).transform);
              const snap = snapFromVelocity(m.m42, drag.current.velocity);
              if (snap === state) setTranslate(snapYFor(snap), true);
              else onStateChange(snap);
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}
