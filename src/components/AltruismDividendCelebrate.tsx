'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, HeartHandshake } from 'lucide-react';

interface AltruismDividendCelebrateProps {
  amount: number;
  message: string;
  onComplete: () => void;
}

export default function AltruismDividendCelebrate({ amount, message, onComplete }: AltruismDividendCelebrateProps) {
  const [step, setStep] = useState(0);

  // マウントから1.5秒後に振動（光が降り注ぐような細かい振動）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([30, 50, 30, 50, 100, 50, 200]);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // 演出の進行（フェーズ管理）
    const t1 = setTimeout(() => setStep(1), 800); // メッセージフェーズ
    const t2 = setTimeout(() => setStep(2), 3500); // 徳の付与フェーズ
    const t3 = setTimeout(() => setStep(3), 6000); // フェードアウト開始
    const t4 = setTimeout(() => onComplete(), 7000); // 完了
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(255, 250, 240, 0.95)', // 神聖な温かい白
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: step === 3 ? 0 : 1,
        transition: 'opacity 1s ease-in-out',
        overflow: 'hidden',
      }}
    >
      {/* 放射状の光の背景（回転アニメーション） */}
      <div
        style={{
          position: 'absolute',
          width: '200vw',
          height: '200vw',
          background: 'conic-gradient(from 0deg, rgba(255, 215, 0, 0.1) 0deg, rgba(255, 250, 240, 0) 60deg, rgba(255, 215, 0, 0.1) 120deg, rgba(255, 250, 240, 0) 180deg, rgba(255, 215, 0, 0.1) 240deg, rgba(255, 250, 240, 0) 300deg, rgba(255, 215, 0, 0.1) 360deg)',
          animation: 'spin 20s linear infinite',
          zIndex: -1,
        }}
      />
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes floatUp {
            0% { transform: translateY(20px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          @keyframes pulseGlow {
            0% { text-shadow: 0 0 10px rgba(218,165,32,0.5); transform: scale(1); }
            50% { text-shadow: 0 0 30px rgba(218,165,32,0.8); transform: scale(1.1); }
            100% { text-shadow: 0 0 10px rgba(218,165,32,0.5); transform: scale(1); }
          }
        `}
      </style>

      {/* アイコン */}
      <div
        style={{
          opacity: step >= 0 ? 1 : 0,
          transform: step >= 0 ? 'scale(1)' : 'scale(0.5)',
          transition: 'all 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
          marginBottom: '2rem',
        }}
      >
        <HeartHandshake size={80} color="#DAA520" strokeWidth={1.5} />
      </div>

      {/* メッセージ */}
      <div
        style={{
          opacity: step >= 1 ? 1 : 0,
          animation: step >= 1 ? 'floatUp 1s ease-out forwards' : 'none',
          textAlign: 'center',
          maxWidth: '80%',
          color: '#4A4A4A',
        }}
      >
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#B8860B' }}>
          利他の配当
        </h2>
        <p style={{ fontSize: '1.1rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
          {message}
        </p>
      </div>

      {/* 徳の付与 */}
      <div
        style={{
          marginTop: '3rem',
          opacity: step >= 2 ? 1 : 0,
          transition: 'opacity 0.8s ease-in',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#DAA520', fontSize: '2.5rem', fontWeight: 'bold', animation: step >= 2 ? 'pulseGlow 2s infinite' : 'none' }}>
          <Sparkles size={36} />
          <span>+{amount} 徳</span>
        </div>
        <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#888' }}>
          あなたの残した灯火が、世界を少しだけ明るくしました。
        </p>
      </div>
    </div>
  );
}
