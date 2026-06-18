'use client';

import React, { useEffect, useState, useRef } from 'react';
import { X, Check } from 'lucide-react';
import YaorozuSpirit from './YaorozuSpirit';

interface MeditationQuestProps {
  godName: string;
  godEmoji: string;
  requiredSeconds: number; // 例: 30秒
  onComplete: () => void;
  onCancel: () => void;
}

export default function MeditationQuest({ godName, godEmoji, requiredSeconds, onComplete, onCancel }: MeditationQuestProps) {
  const [elapsed, setElapsed] = useState(0);
  const [isFaceDown, setIsFaceDown] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const completeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedRef = useRef(0); // 表向き時のリセット判定で参照（effect 依存から elapsed を外すため）
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);

  // アンマウント時に完了タイマーを破棄（閉じた後に onComplete が発火するのを防ぐ）
  useEffect(() => () => { if (completeTimerRef.current) clearTimeout(completeTimerRef.current); }, []);

  // 1. Page Visibility API による検知（画面がオフになった、または別アプリへ）
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // 2. Device Orientation API による検知（スマホを伏せているか）
  useEffect(() => {
    // iOS 13+ の対応
    const requestPermission = async () => {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const permission = await (DeviceOrientationEvent as any).requestPermission();
          if (permission !== 'granted') {
            setErrorMsg('センサーの許可が必要です');
          }
        } catch (e) {
          console.error(e);
        }
      }
    };

    // 画面タップでパーミッション要求するようUI側で促す必要があるので、マウント時に試みるが失敗したら無視
    requestPermission().catch(() => {});

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // beta (x軸回り: -180 ~ 180), gamma (y軸回り: -90 ~ 90)
      // スマホを机の上に「裏返して」置いた場合、betaは180または-180付近、gammaは0付近になる。
      // または画面が下を向いているかを判定（beta が 150以上180以下、または -180以上-150以下など）
      if (e.beta !== null && e.gamma !== null) {
        const isDown = (e.beta > 135 || e.beta < -135) && (Math.abs(e.gamma) < 45);
        setIsFaceDown(isDown);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  // 判定ロジック：画面が隠れている(isHidden) か、伏せられている(isFaceDown) か
  const isValidating = isHidden || isFaceDown;

  // カウントアップ。interval を毎秒作り直さないよう、依存に elapsed を含めない
  // （含めると毎ティックで clear→再生成し、1秒の刻みがずれて所要時間が伸びる）。
  useEffect(() => {
    if (isFinished) return;

    if (isValidating) {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => Math.min(prev + 1, requiredSeconds));
      }, 1000);
    } else {
      // 表を向けたらリセット（厳しいルール）
      if (timerRef.current) clearInterval(timerRef.current);
      if (elapsedRef.current > 0) {
        setElapsed(0); // やり直し
        // もし途中で表を向けられたらバイブで警告
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([50, 50, 50]);
        }
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isValidating, isFinished, requiredSeconds]);

  // 完了判定は setState 更新関数の外（専用 effect）で行い、二重発火を防ぐ。
  useEffect(() => {
    if (isFinished || elapsed < requiredSeconds) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsFinished(true);

    // 完了時のハプティック・効果音
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 500]); // 神聖な長い振動
    }

    // 3秒後に親コンポーネントへ通知して閉じる（アンマウント時は破棄）
    completeTimerRef.current = setTimeout(() => {
      onComplete();
    }, 3000);
  }, [elapsed, requiredSeconds, isFinished, onComplete]);

  const progressPercent = Math.min((elapsed / requiredSeconds) * 100, 100);

  // iOSなどでパーミッションを要求するためのボタン
  const requestDeviceOrientation = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const p = await (DeviceOrientationEvent as any).requestPermission();
        if (p === 'granted') {
          setErrorMsg(null);
        } else {
          setErrorMsg('センサーが許可されませんでした。画面をロック（電源ボタン）することでも進行可能です。');
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-gray-900 text-white flex flex-col items-center justify-center animate-in fade-in duration-500 p-6">
      <button onClick={onCancel} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-95 transition-all">
        <X className="w-5 h-5" />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm text-center">
        {!isFinished ? (
          <>
            <div className="w-24 h-24 mb-8 bg-black/30 rounded-full flex items-center justify-center relative border border-white/10">
              <span className="text-5xl opacity-80">{godEmoji}</span>
              {/* プログレス円（SVG） */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="48" cy="48" r="46" stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
                <circle
                  cx="48" cy="48" r="46"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray="289.026"
                  strokeDashoffset={289.026 - (289.026 * progressPercent) / 100}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
            </div>

            <h2 className="text-xl font-serif tracking-widest mb-4">沈黙の祈り</h2>
            
            <p className="text-white/60 text-sm leading-loose tracking-wider mb-8">
              スマホを裏返して机や膝に置き、<br />
              {requiredSeconds}秒間、この地の風を感じなさい。<br />
              画面を見つめてはならぬ。
            </p>

            <div className="text-white/30 text-xs font-mono">
              {elapsed} / {requiredSeconds}s
            </div>

            {errorMsg && (
              <p className="text-rose-400 text-xs mt-6">{errorMsg}</p>
            )}

            {/* iOS向けパーミッションボタン */}
            {typeof (window as any).DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function' && elapsed === 0 && (
               <button onClick={requestDeviceOrientation} className="mt-8 text-xs text-white/40 underline">
                 センサーへのアクセスを許可
               </button>
            )}
          </>
        ) : (
          <div className="animate-in fade-in zoom-in duration-1000 flex flex-col items-center">
            <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6">
              <Check className="w-10 h-10 text-white" />
            </div>
            <p className="text-2xl font-serif tracking-widest mb-2">祈り、届きたり</p>
            <p className="text-white/60 text-sm">そなたの心に、静寂が訪れた。</p>
          </div>
        )}
      </div>
    </div>
  );
}
