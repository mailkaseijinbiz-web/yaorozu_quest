'use client';

import { useEffect, useRef } from 'react';

/**
 * 横スワイプ（指追従）ナビゲーション用フック。
 *
 * - 最初の指の動きで縦/横を判定。横と判定した瞬間に `touchmove` を `preventDefault` し、
 *   スワイプ中は縦スクロールが起きないようにロックする（passive: false で登録）。
 * - 横スクロール可能な子要素（フィルタの帯・カルーセル等）の上では乗っ取らない。
 * - しきい値を越えて離すと commit、未満なら指の位置から 0 へバネで戻す。
 * - `animateOut` 指定時は確定方向へ画面外まで滑らせてから commit を呼ぶ（詳細ページの戻る等）。
 *
 * 返り値の ref を、指追従で動かしたい要素に付ける。
 */
export interface SwipeNavOptions {
  /** false の間はスワイプを無効化（既定: true） */
  enabled?: boolean;
  /** 横スクロール子要素の上ではスワイプしない（既定: true） */
  skipOnHorizontalScroll?: boolean;
  /** 左方向（指を左へ, dx<0 = 次へ）を許可。false なら引っぱり抵抗（既定: true） */
  allowLeft?: boolean;
  /** 右方向（指を右へ, dx>0 = 前へ/戻る）を許可。false なら引っぱり抵抗（既定: true） */
  allowRight?: boolean;
  /** 確定しきい値(px)。既定は min(80, 要素幅 * 0.22) */
  threshold?: number;
  /** 確定時に画面外へ滑らせてから commit を呼ぶ（既定: false = 即時 commit） */
  animateOut?: boolean;
  /** 指を左へ払って確定（次のページ等） */
  onCommitLeft?: () => void;
  /** 指を右へ払って確定（前のページ／戻る等） */
  onCommitRight?: () => void;
}

const RESIST = 0.3; // 端での引っぱり抵抗係数

export function useSwipeNav<T extends HTMLElement>(opts: SwipeNavOptions) {
  const ref = useRef<T | null>(null);
  // 最新の opts を保持し、リスナーの再登録を避ける（クロージャは常に最新を読む）。
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let axis: 'h' | 'v' | null = null; // 最初の動きで縦/横を確定
    let moved = false; // 横ドラッグが発生したか
    let skip = false; // この一連のタッチを無視するか

    const hasScrollableX = (from: EventTarget | null) => {
      let n = from as HTMLElement | null;
      while (n && n !== el) {
        const ox = getComputedStyle(n).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 2) return true;
        n = n.parentElement;
      }
      return false;
    };

    const onStart = (e: TouchEvent) => {
      const o = optsRef.current;
      if (o.enabled === false || e.touches.length !== 1) { skip = true; return; }
      skip = (o.skipOnHorizontalScroll !== false) && hasScrollableX(e.target);
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      axis = null;
      moved = false;
      el.style.transition = 'none';
    };

    const onMove = (e: TouchEvent) => {
      if (skip) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // まだ向きが定まらない
        axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
      if (axis !== 'h') return; // 縦操作はそのまま縦スクロールへ
      // 横操作確定 → スワイプ中は縦スクロールを止める。
      if (e.cancelable) e.preventDefault();
      moved = true;
      const o = optsRef.current;
      const allowDir = dx < 0 ? o.allowLeft !== false : o.allowRight !== false;
      const shift = allowDir ? dx : dx * RESIST;
      el.style.transform = `translateX(${shift}px)`;
      el.style.willChange = 'transform';
    };

    const finish = (dx: number) => {
      const o = optsRef.current;
      const w = el.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 360);
      const threshold = o.threshold ?? Math.min(80, w * 0.22);
      const commitLeft = dx <= -threshold && o.allowLeft !== false;
      const commitRight = dx >= threshold && o.allowRight !== false;

      if (commitLeft || commitRight) {
        const cb = commitLeft ? o.onCommitLeft : o.onCommitRight;
        if (o.animateOut) {
          // 確定方向へ画面外まで滑らせてから commit（詳細ページを戻す等）。
          el.style.transition = 'transform 0.2s ease-out';
          el.style.transform = `translateX(${commitLeft ? '-100%' : '100%'})`;
          const done = () => { el.removeEventListener('transitionend', done); cb?.(); };
          el.addEventListener('transitionend', done);
        } else {
          // 即時 commit。指追従で動かした分は 0 に戻し、切替後の中身をその場に表示。
          el.style.transition = 'none';
          el.style.transform = 'translateX(0)';
          el.style.willChange = '';
          cb?.();
        }
      } else {
        // しきい値未満：指の位置から 0 へバネで戻す。
        el.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.9, 0.2, 1)';
        el.style.transform = 'translateX(0)';
        el.style.willChange = '';
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (!moved) { axis = null; return; }
      const dx = e.changedTouches[0].clientX - startX;
      axis = null;
      moved = false;
      finish(dx);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return ref;
}
