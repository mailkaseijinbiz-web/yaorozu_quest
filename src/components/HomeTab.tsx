'use client';

import React, { useState } from 'react';
import { Award, Map, MapPin, ChevronRight, Crown, Compass } from 'lucide-react';
import { Spot, User } from '../lib/db';
import MapTab from './MapTab';

interface HomeTabProps {
  spots: Spot[];
  currentUser: User;
  userLocation: { lat: number; lng: number };
  setUserLocation: (loc: { lat: number; lng: number }) => void;
  creatorProfiles: { [userId: string]: User };
  activeSpot: Spot | null;
  onSelectSpot: (spot: Spot) => void;
  sheetState: 'collapsed' | 'half' | 'expanded';
  onNavigateToQuest: () => void;
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function HomeTab({
  spots,
  currentUser,
  userLocation,
  setUserLocation,
  creatorProfiles,
  activeSpot,
  onSelectSpot,
  sheetState,
  onNavigateToQuest,
}: HomeTabProps) {
  const [view, setView] = useState<'discover' | 'map'>('discover');

  const sortedSpots = [...spots]
    .map(s => ({ ...s, dist: getDistance(userLocation.lat, userLocation.lng, s.latitude, s.longitude) }))
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
          sheetState={sheetState}
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
        {/* ユーザーの徳 */}
        <div className="flex items-center gap-1.5 mt-3 bg-amber-50 border border-amber-100 rounded-full px-4 py-1.5">
          <span className="text-sm">🏆</span>
          <span className="text-xs text-gray-600 font-semibold">
            累積徳 <span className="text-gold font-black">{currentUser.totalToku}</span> pts · {currentUser.currentTitle}
          </span>
        </div>
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

      {/* ── 近くのスポット ── */}
      <div className="px-5 pb-6">
        <div className="flex items-center mb-3">
          <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-shrine-red" />
            近くのスポット
          </h2>
        </div>

        {/* 2列タイルグリッド */}
        <div className="grid grid-cols-2 gap-3">
          {sortedSpots.map((spot) => {
            const distKm = spot.dist;
            const distText = distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`;
            const creator = spot.creatorId ? creatorProfiles[spot.creatorId] : null;


            return (
              <button
                key={spot.id}
                onClick={() => {
                  onSelectSpot(spot);
                  setView('map');
                }}
                className="relative flex flex-col rounded-2xl overflow-hidden bg-white shadow-sm border border-black/5 hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer text-left"
              >
                {/* 写真 */}
                <div className="relative h-[120px] w-full overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={spot.imageUrl}
                    alt={spot.name}
                    className="w-full h-full object-cover"
                  />
                  {/* カテゴリバッジ */}
                  <span className="absolute top-2 left-2 text-[10px] font-black bg-white/90 backdrop-blur-sm border border-black/10 px-1.5 py-0.5 rounded-full text-gray-700 shadow-sm">
                    {spot.category === '神社' ? '⛩️' : '🙏'} {spot.category}
                  </span>
                  {/* 距離バッジ */}
                  <span className="absolute top-2 right-2 text-[10px] font-black bg-black/60 backdrop-blur-sm text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <Compass className="w-2.5 h-2.5" />
                    {distText}
                  </span>
                  {/* 創世主バッジ */}
                  {creator && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-gold/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full shadow-sm">
                      <Crown className="w-3 h-3 text-amber-900" />
                      <span className="text-[9px] font-black text-amber-900 max-w-[55px] truncate">
                        {creator.displayName.split('(')[0].trim()}
                      </span>
                    </div>
                  )}
                </div>

                {/* テキスト情報 */}
                <div className="p-3">
                  <h3 className="text-xs font-black text-gray-900 leading-tight line-clamp-2">
                    {spot.name}
                  </h3>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
