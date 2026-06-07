'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Navigation, Compass, ArrowRight, MessageSquare, Camera, Check } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Spot, User, db } from '../lib/db';

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#07090e] flex flex-col items-center justify-center text-xs text-gray-500">
      <Compass className="w-8 h-8 text-gold animate-spin-slow mb-2" />
      八百万マップを展開中...
    </div>
  ),
});

interface MapTabProps {
  spots: Spot[];
  activeSpot: Spot | null;
  onSelectSpot: (spot: Spot) => void;
  userLocation: { lat: number; lng: number };
  setUserLocation: (loc: { lat: number; lng: number }) => void;
  creatorProfiles: { [userId: string]: User };
  onNavigateTab?: (tab: 'map' | 'chat' | 'ar' | 'quest') => void; // Parent navigation hook
  sheetState?: 'collapsed' | 'half' | 'expanded'; // Bottom sheet state
}

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function MapTab({
  spots,
  activeSpot,
  onSelectSpot,
  userLocation,
  setUserLocation,
  creatorProfiles,
  onNavigateTab,
  sheetState,
}: MapTabProps) {
  const [filter, setFilter] = useState<'all' | 'shrine' | 'temple' | 'claimed'>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Compute UGC counts per spot
  const allUgc = db.getUgc();
  const ugcCounts: { [spotId: string]: number } = {};
  spots.forEach((spot) => {
    ugcCounts[spot.id] = allUgc.filter((u) => u.spotId === spot.id).length;
  });

  // Filter spots dynamically
  const filteredSpots = spots.filter((spot) => {
    if (filter === 'shrine') return spot.category === '神社';
    if (filter === 'temple') return spot.category === '寺院';
    if (filter === 'claimed') return spot.creatorId !== null;
    return true;
  });

  const warpToSpot = (spot: Spot) => {
    setUserLocation({
      lat: spot.latitude + 0.0003,
      lng: spot.longitude + 0.0003,
    });
  };

  // Scroll active spot card into view in horizontal slider
  useEffect(() => {
    if (activeSpot && scrollRef.current) {
      const activeCardElement = document.getElementById(`spot-card-${activeSpot.id}`);
      if (activeCardElement) {
        activeCardElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [activeSpot]);

  return (
    <div className="relative w-full h-full flex flex-col">
      
      {/* 1. Geographical Leaflet Map */}
      <div className="absolute inset-0 z-0">
        <LeafletMap
          spots={filteredSpots}
          activeSpot={activeSpot}
          onSelectSpot={onSelectSpot}
          userLocation={userLocation}
          setUserLocation={setUserLocation}
          ugcCounts={ugcCounts}
        />
      </div>

      {/* 2. Floating Filter Pills (Sauna-ikitai style top search HUD) */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex gap-1.5 overflow-x-auto pb-1 scrollbar-none pointer-events-auto">
        {(['all', 'shrine', 'temple', 'claimed'] as const).map((type) => {
          const labels = {
            all: 'すべて',
            shrine: '⛩️ 神社',
            temple: '🙏 寺院',
            claimed: '👑 創世済',
          };
          const isActive = filter === type;
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[10px] font-black tracking-wide border shadow-md transition-all cursor-pointer ${
                isActive
                  ? 'bg-shrine-red border-shrine-red text-white'
                  : 'bg-white/95 border-[#1e2024]/10 text-gray-700 hover:bg-white hover:text-shrine-red'
              }`}
            >
              {labels[type]}
            </button>
          );
        })}
      </div>

      {/* Floating GPS coordinates */}
      <div className="absolute top-[55px] right-3 z-[999] flex items-center gap-1.5 text-[8px] font-mono bg-white/90 border border-black/5 px-2 py-0.5 rounded-md text-gray-600 pointer-events-none shadow-sm">
        <span>N {userLocation.lat.toFixed(4)}°</span>
        <span className="text-gray-300">|</span>
        <span>E {userLocation.lng.toFixed(4)}°</span>
      </div>

      {/* 
        3. Bottom Horizontal Card Slider (Sauna-ikitai style carousel slider)
      */}
      {/* カードスライダーはボトムシートが表示されていないときのみ表示 */}
      <div 
        ref={scrollRef}
        className={`absolute bottom-[72px] left-3 right-3 z-[1000] flex gap-3 overflow-x-auto pb-1.5 scrollbar-none snap-x snap-mandatory pointer-events-auto transition-all duration-300 ${
          activeSpot && sheetState && sheetState !== 'collapsed'
            ? 'opacity-0 pointer-events-none translate-y-4'
            : 'opacity-100'
        }`}
      >
        {filteredSpots.map((spot) => {
          const isActive = activeSpot?.id === spot.id;
          const dist = getDistance(userLocation.lat, userLocation.lng, spot.latitude, spot.longitude);
          const isNear = dist <= 1.0;
          const ugcCount = ugcCounts[spot.id] || 0;
          const creator = spot.creatorId ? creatorProfiles[spot.creatorId] : null;

          return (
            <div
              key={spot.id}
              id={`spot-card-${spot.id}`}
              onClick={() => onSelectSpot(spot)}
              className={`snap-center flex-shrink-0 w-[290px] bg-white/95 border-2 rounded-2xl p-2.5 flex gap-3 shadow-xl transition-all duration-300 cursor-pointer ${
                isActive
                  ? 'border-[#d4af37] ring-4 ring-[#d4af37]/10'
                  : 'border-transparent hover:border-[#e60012]/30'
              }`}
            >
              {/* Thumbnail image */}
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-black/5 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={spot.imageUrl} alt={spot.name} className="w-full h-full object-cover" />
                <span className="absolute bottom-1 left-1 bg-black/50 text-[7px] text-white px-1 py-0.2 rounded">
                  {spot.category}
                </span>
              </div>

              {/* Spot descriptions */}
              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-xs text-[#1e2024] truncate leading-tight">
                      {spot.name}
                    </h4>
                    <span className="text-[8px] font-mono text-gray-500 whitespace-nowrap">
                      {dist.toFixed(1)} km
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[8px] text-gray-400">
                      UGC: {ugcCount}件
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-[8px] text-[#e60012] font-black">
                      {creator ? `創世主: ${creator.displayName.split('@')[0]}` : '創世主未決定'}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between gap-2 mt-2">
                  {/* Warp or Near Status */}
                  {!isNear ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // prevent select spot trigger
                        warpToSpot(spot);
                      }}
                      className="bg-[#e60012]/10 hover:bg-[#e60012]/20 text-[#e60012] text-[8px] font-black py-1 px-2 rounded-lg flex items-center gap-0.5 transition-all cursor-pointer whitespace-nowrap"
                    >
                      ワープ
                      <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  ) : (
                    <span className="bg-[#32cd32]/10 text-[#32cd32] text-[8px] font-black px-2 py-1 rounded-lg">
                      接近中 (AR可)
                    </span>
                  )}

                  {/* Message / AR Quick Links if parent hooks provided */}
                  {onNavigateTab && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSpot(spot);
                          onNavigateTab('chat');
                        }}
                        className="p-1 text-gray-500 hover:text-[#d4af37] bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSpot(spot);
                          onNavigateTab('ar');
                        }}
                        className="p-1 text-gray-500 hover:text-[#00bfff] bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
