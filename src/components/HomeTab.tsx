'use client';

import React, { useState, useEffect } from 'react';
import { Award, Map, MapPin, ChevronRight, Compass, Target, Lock, Sparkles, Flag } from 'lucide-react';
import { Spot, User } from '../lib/db';
import MapTab from './MapTab';
import { SHINNAKANO_QUIZZES, quizDistance, isQuizUnlocked } from '../data/shinnakano-quiz';
import { getLevelInfo } from '../data/levels';

interface HomeTabProps {
  spots: Spot[];
  currentUser: User;
  userLocation: { lat: number; lng: number };
  setUserLocation: (loc: { lat: number; lng: number }) => void;
  creatorProfiles: { [userId: string]: User };
  activeSpot: Spot | null;
  onSelectSpot: (spot: Spot) => void;
  onNavigateToQuest: () => void;
  homeResetSignal?: number;
}

export default function HomeTab({
  spots,
  currentUser,
  userLocation,
  setUserLocation,
  creatorProfiles,
  activeSpot,
  onSelectSpot,
  onNavigateToQuest,
  homeResetSignal,
}: HomeTabProps) {
  const [view, setView] = useState<'discover' | 'map'>('discover');

  // ホームタブを押されたら地図ビューからホーム（discover）へ戻す
  useEffect(() => {
    if (homeResetSignal !== undefined) setView('discover');
  }, [homeResetSignal]);

  // 近くのミッション（クイズ）— 距離順
  const sortedMissions = SHINNAKANO_QUIZZES
    .map(q => ({ quiz: q, dist: quizDistance(q, userLocation), unlocked: isQuizUnlocked(q, userLocation) }))
    .sort((a, b) => a.dist - b.dist);



  if (view === 'map') {
    return (
      <div className="relative w-full h-full flex flex-col">
        <button
          onClick={() => setView('discover')}
          className="absolute top-4 left-4 z-[2000] flex items-center gap-1.5 bg-white/95 border border-black/10 shadow-lg px-3 py-2 rounded-full text-sm font-black text-gray-700 cursor-pointer hover:bg-white transition-all backdrop-blur-md"
        >
          ← ホームに戻る
        </button>
        <MapTab
          spots={spots}
          activeSpot={activeSpot}
          onSelectSpot={onSelectSpot}
          userLocation={userLocation}
          setUserLocation={setUserLocation}
          creatorProfiles={creatorProfiles}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#f5f7fa]">

      {/* ── ブランドヘッダー ── */}
      <div className="px-5 pt-8 pb-5 flex flex-col items-center text-center">
        <h1 className="text-2xl font-black tracking-tight leading-none">
          <span className="text-shrine-red">YAOROZU</span>
          <span className="text-gray-900"> QUEST</span>
        </h1>
        <p className="text-xs text-gray-400 mt-1.5 tracking-wider font-medium">八百万の神が息づく世界へ</p>

        {/* ── レベル & 経験値バー ── */}
        {(() => {
          const lvInfo = getLevelInfo(currentUser.totalToku);
          const pct = Math.round(lvInfo.progress * 100);
          return (
            <div className="w-full max-w-[300px] mt-4 bg-white border border-amber-100 rounded-2xl px-4 pt-2.5 pb-3 shadow-sm">
              {/* 称号・徳 */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Lv.{lvInfo.current.level}
                  </span>
                  <span className="text-xs font-black text-gray-800">{lvInfo.current.title}</span>
                </div>
                <span className="text-[11px] text-gray-500 font-semibold">
                  <span className="text-gold font-black">{currentUser.totalToku}</span> 徳
                </span>
              </div>

              {/* バー（旗で現在地を表示） */}
              <div className="relative pt-3">
                {/* 旗マーカー */}
                <div
                  className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-500"
                  style={{ left: `${pct}%` }}
                >
                  <Flag className="w-3 h-3 text-shrine-red fill-shrine-red" />
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden border border-gray-200/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-300 to-gold transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {/* 下部ラベル */}
                <div className="flex items-center justify-between mt-1.5">
                  {lvInfo.next ? (
                    <>
                      <span className="text-[9px] text-gray-400">
                        次のレベルまで <span className="font-black text-gray-600">あと {lvInfo.tokuToNext} 徳</span>
                      </span>
                      <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
                        次：{lvInfo.next.title}
                      </span>
                    </>
                  ) : (
                    <span className="text-[9px] text-gold font-black">最高位に到達！</span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── 縦並びアクションボタン ── */}
      <div className="px-5 py-4 flex flex-col gap-3">
        {/* クエストを探す */}
        <button
          onClick={onNavigateToQuest}
          className="relative overflow-hidden bg-gradient-to-r from-shrine-red to-rose-500 text-white rounded-2xl px-5 py-4 flex items-center gap-4 shadow-lg shadow-shrine-red/20 hover:opacity-95 active:scale-98 transition-all cursor-pointer"
        >
          <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div className="text-left flex-1">
            <p className="font-black text-base leading-tight">クエストを探す</p>
            <p className="text-xs text-white/75 mt-0.5">徳を積んで称号をゲット</p>
          </div>
          <ChevronRight className="w-5 h-5 text-white/60 flex-shrink-0" />
        </button>

        {/* 地図から探す */}
        <button
          onClick={() => setView('map')}
          className="relative overflow-hidden bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-2xl px-5 py-4 flex items-center gap-4 shadow-lg shadow-slate-900/20 hover:opacity-95 active:scale-98 transition-all cursor-pointer"
        >
          <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Map className="w-6 h-6 text-white" />
          </div>
          <div className="text-left flex-1">
            <p className="font-black text-base leading-tight">地図から探す</p>
            <p className="text-xs text-white/75 mt-0.5">レーダーで周辺スポットを確認</p>
          </div>
          <ChevronRight className="w-5 h-5 text-white/60 flex-shrink-0" />
        </button>
      </div>

      {/* ── 近くのミッション ── */}
      <div className="px-5 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
            <Target className="w-4 h-4 text-shrine-red" />
            近くのクエスト
          </h2>
          <span className="text-[10px] text-gray-400 font-bold">
            近づくと神様が呼びかける
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {sortedMissions.map(({ quiz, dist, unlocked }) => {
            const distText = dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`;
            return (
              <button
                key={quiz.id}
                onClick={() => setView('map')}
                className={`relative flex items-center gap-3 rounded-2xl p-3 border text-left transition-all cursor-pointer active:scale-[0.98] ${
                  unlocked
                    ? 'bg-white shadow-sm border-amber-200 hover:shadow-md'
                    : 'bg-white/70 border-black/5 hover:bg-white'
                }`}
              >
                {/* アイコン */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  unlocked ? 'bg-gradient-to-br from-amber-300 to-shrine-red' : 'bg-gray-100'
                }`}>
                  {unlocked
                    ? <span className="text-lg">⛩️</span>
                    : <Lock className="w-5 h-5 text-gray-400" />}
                </div>

                {/* テキスト */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-black text-gray-900 truncate leading-tight">{quiz.title}</h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="w-2.5 h-2.5 text-shrine-red flex-shrink-0" />
                    <span className="text-[10px] text-gray-500 truncate">{quiz.landmark}</span>
                  </div>
                  <p className={`text-[10px] mt-0.5 leading-tight line-clamp-1 ${unlocked ? 'text-amber-700 font-bold' : 'text-gray-400'}`}>
                    {unlocked
                      ? '神様が呼びかけています — 挑戦できます'
                      : `現地に近づくと解放（あと ${distText}）`}
                  </p>
                </div>

                {/* 右側: 距離 / 解放バッジ */}
                {unlocked ? (
                  <span className="flex items-center gap-0.5 text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full flex-shrink-0">
                    <Sparkles className="w-3 h-3 text-gold" />
                    挑戦
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-[10px] font-black text-gray-500 bg-gray-50 border border-gray-200 px-2 py-1 rounded-full flex-shrink-0">
                    <Compass className="w-3 h-3" />
                    {distText}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
