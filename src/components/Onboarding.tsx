'use client';

import React, { useState } from 'react';
import { Flag, Navigation, Camera, Trophy, MapPin, ChevronRight } from 'lucide-react';
import { haptic } from '../lib/haptics';

interface OnboardingProps {
  /** 位置情報の許可を求める（ユーザー操作内で呼ぶことでブラウザのプロンプトを確実に出す） */
  onRequestLocation: () => void;
  /** オンボーディング完了（以後は表示しない） */
  onComplete: () => void;
}

const LOOP_STEPS = [
  { icon: Flag, color: 'text-shrine-red', bg: 'bg-shrine-red/10', title: 'クエストに参加', desc: '近くの神様の依頼から、気になるものを選ぶ。' },
  { icon: Navigation, color: 'text-emerald-600', bg: 'bg-emerald-500/10', title: '現地へ向かう', desc: 'マップの案内に従って、その場所まで実際に歩く。' },
  { icon: Camera, color: 'text-sky-600', bg: 'bg-sky-500/10', title: '証拠写真で達成', desc: '現地で写真を撮ると、その目的地をクリア。' },
  { icon: Trophy, color: 'text-gold', bg: 'bg-gold/15', title: '徳を得て位を上げる', desc: '「徳」が貯まるとレベルが上がり、新たなクエストが解放される。' },
];

export default function Onboarding({ onRequestLocation, onComplete }: OnboardingProps) {
  const [page, setPage] = useState<0 | 1>(0);

  const goNext = () => { haptic('tap'); setPage(1); };
  const start = () => { haptic('success'); onRequestLocation(); onComplete(); };
  const skip = () => { haptic('tap'); onComplete(); };

  return (
    <div className="absolute inset-0 z-[6000] bg-[#f5f7fa] flex flex-col onboard-fade">
      {/* 背景の淡いグロー（ブランド調） */}
      <div className="absolute top-[-10%] left-[-15%] w-[60%] h-[40%] bg-shrine-red/5 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[-15%] w-[60%] h-[40%] bg-gold/10 blur-[100px] rounded-full pointer-events-none" />

      {page === 0 ? (
        <div className="relative flex-1 flex flex-col items-center justify-center text-center px-7">
          <div className="text-6xl mb-5 animate-float">⛩️</div>
          <h1 className="text-3xl font-black tracking-tight leading-none">
            <span className="text-shrine-red">YAOROZU</span>
            <span className="text-gray-900"> QUEST</span>
          </h1>
          <p className="mt-4 text-[15px] font-bold text-gray-700 leading-relaxed">
            八百万の神々の依頼を巡る、<br />リアル探索クエスト。
          </p>
          <p className="mt-3 text-[13px] text-gray-500 leading-relaxed max-w-[280px]">
            街に宿る神様があなたに語りかけ、ちょっとした冒険へ誘います。実際にその場所を訪れて、世界を巡りましょう。
          </p>
          <button
            onClick={goNext}
            className="mt-9 w-full max-w-[280px] bg-shrine-red text-white text-base font-black py-3.5 rounded-2xl shadow-lg shadow-shrine-red/25 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            遊び方を見る<ChevronRight className="w-4 h-4" />
          </button>
          <div className="mt-5 flex gap-1.5">
            <span className="w-5 h-1.5 rounded-full bg-shrine-red" />
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          </div>
        </div>
      ) : (
        <div className="relative flex-1 flex flex-col px-6 pt-12 pb-7 overflow-y-auto">
          <h2 className="text-xl font-black text-gray-900 text-center">遊び方はかんたん</h2>
          <p className="text-[13px] text-gray-500 text-center mt-1">4ステップのくり返しで世界が広がる</p>

          <div className="mt-6 flex flex-col gap-3">
            {LOOP_STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="flex items-center gap-3.5 bg-white rounded-2xl border border-black/5 shadow-sm p-3.5 onboard-step" style={{ animationDelay: `${i * 90}ms` }}>
                  <div className={`relative w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-6 h-6 ${s.color}`} />
                    <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-gray-900 text-white text-[11px] font-black flex items-center justify-center">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-gray-900">{s.title}</h3>
                    <p className="text-[13px] text-gray-500 leading-snug mt-0.5">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 位置情報の文脈つき依頼 */}
          <div className="mt-5 flex items-start gap-2.5 bg-emerald-50 border border-emerald-200/70 rounded-2xl p-3.5">
            <MapPin className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-emerald-800 leading-relaxed">
              近くのクエストや目的地までの距離を表示するため、<span className="font-black">位置情報</span>を使います。許可すると現在地から始められます。
            </p>
          </div>

          <div className="mt-6">
            <button
              onClick={start}
              className="w-full bg-shrine-red text-white text-base font-black py-3.5 rounded-2xl shadow-lg shadow-shrine-red/25 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Navigation className="w-4 h-4" />位置情報を許可してはじめる
            </button>
            <button
              onClick={skip}
              className="w-full mt-2 text-[13px] font-black text-gray-400 py-2 cursor-pointer hover:text-gray-600 transition-colors"
            >
              あとで（既定の現在地で始める）
            </button>
          </div>

          <div className="mt-3 flex justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
            <span className="w-5 h-1.5 rounded-full bg-shrine-red" />
          </div>
        </div>
      )}
    </div>
  );
}
