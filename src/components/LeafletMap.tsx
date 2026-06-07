'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation } from 'lucide-react';
import { Spot, db } from '../lib/db';

// 2点間の概算距離（度ベース・並べ替え用）
function roughDist(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = aLat - bLat;
  const dLng = (aLng - bLng) * Math.cos((aLat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// 1画面の表示数をズームに応じて制御（広域では少なく、拡大で増やす）
function maxMarkersForZoom(zoom: number): number {
  if (zoom <= 12) return 12;
  if (zoom <= 13) return 20;
  if (zoom <= 14) return 30;
  if (zoom <= 15) return 45;
  return 60;
}

interface LeafletMapProps {
  spots: Spot[];
  activeSpot: Spot | null;
  onSelectSpot: (spot: Spot) => void;
  userLocation: { lat: number; lng: number };
  setUserLocation: (loc: { lat: number; lng: number }) => void;
  ugcCounts: { [spotId: string]: number };
  goal?: { lat: number; lng: number; name: string } | null; // チャレンジのゴール
}

export default function LeafletMap({
  spots,
  activeSpot,
  onSelectSpot,
  userLocation,
  setUserLocation,
  ugcCounts,
  goal,
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const markersRef = useRef<{ [spotId: string]: L.Marker }>({});
  const goalMarkerRef = useRef<L.Marker | null>(null);

  // 地図の移動に追従して再描画するためのバージョン
  const [mapVersion, setMapVersion] = useState(0);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null); // 方位磁針

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([userLocation.lat, userLocation.lng], 16);

    // CartoDB Voyager Tile Layer (Bright, color-rich, highly readable map tiles)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // 拡大縮小ボタンは非表示（zoomControl:false のまま）

    mapRef.current = map;
    const bump = () => setMapVersion((v) => v + 1);
    map.on('move', bump);
    map.on('zoomend', bump);
    setMapVersion((v) => v + 1);

    return () => {
      if (mapRef.current) {
        mapRef.current.off('move', bump);
        mapRef.current.off('zoomend', bump);
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 方位磁針（デバイスの向き）に反応して矢印を回す
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (e: any) => {
      let h: number | null = null;
      if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading; // iOS
      else if (e.absolute === true && typeof e.alpha === 'number') h = (360 - e.alpha) % 360; // Android/絶対
      else if (typeof e.alpha === 'number') h = (360 - e.alpha) % 360;
      if (h != null && !isNaN(h)) setDeviceHeading(h);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DOE: any = typeof window !== 'undefined' ? (window as any).DeviceOrientationEvent : undefined;
    let attached = false;
    const attach = () => {
      window.addEventListener('deviceorientationabsolute', handler as EventListener);
      window.addEventListener('deviceorientation', handler as EventListener);
      attached = true;
    };
    if (DOE && typeof DOE.requestPermission === 'function') {
      // iOS 13+ はユーザー操作で許可が必要 → 最初のタップで要求
      const onFirst = () => {
        DOE.requestPermission().then((s: string) => { if (s === 'granted') attach(); }).catch(() => {});
        window.removeEventListener('touchend', onFirst);
        window.removeEventListener('click', onFirst);
      };
      window.addEventListener('touchend', onFirst, { once: true });
      window.addEventListener('click', onFirst, { once: true });
      return () => { window.removeEventListener('touchend', onFirst); window.removeEventListener('click', onFirst); if (attached) { window.removeEventListener('deviceorientationabsolute', handler as EventListener); window.removeEventListener('deviceorientation', handler as EventListener); } };
    }
    attach();
    return () => { window.removeEventListener('deviceorientationabsolute', handler as EventListener); window.removeEventListener('deviceorientation', handler as EventListener); };
  }, []);


  // ビューポート内のスポットを中心からの近さ順に、ズーム連動の上限まで絞る
  const visibleSpots = useMemo(() => {
    const map = mapRef.current;
    if (!map) return spots.slice(0, 20);
    const cap = maxMarkersForZoom(map.getZoom());
    const b = map.getBounds().pad(0.15);
    const c = map.getCenter();
    const inView = spots.filter((s) => b.contains([s.latitude, s.longitude]));
    inView.sort((a, z) => roughDist(c.lat, c.lng, a.latitude, a.longitude) - roughDist(c.lat, c.lng, z.latitude, z.longitude));
    const head = inView.slice(0, cap);
    // アクティブスポットは必ず含める
    if (activeSpot && !head.some((s) => s.id === activeSpot.id) && spots.some((s) => s.id === activeSpot.id)) {
      head.push(activeSpot);
    }
    return head;
    // mapVersion を依存に入れ、地図移動で再計算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots, activeSpot, mapVersion]);

  // 2. User Location Marker（現在地＋方角）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 方角：方位磁針があればそれを優先（端末の向き）、無ければ選択スポット方向、無ければ北
    let heading = 0;
    if (deviceHeading != null) {
      heading = deviceHeading;
    } else if (activeSpot) {
      const dLng = ((activeSpot.longitude - userLocation.lng) * Math.PI) / 180;
      const y = Math.sin(dLng) * Math.cos((activeSpot.latitude * Math.PI) / 180);
      const x =
        Math.cos((userLocation.lat * Math.PI) / 180) * Math.sin((activeSpot.latitude * Math.PI) / 180) -
        Math.sin((userLocation.lat * Math.PI) / 180) * Math.cos((activeSpot.latitude * Math.PI) / 180) * Math.cos(dLng);
      heading = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    }

    const userHtml = `
      <div style="position:relative;width:44px;height:44px;">
        <div style="position:absolute;left:22px;top:22px;transform:translate(-50%,-50%) rotate(${heading}deg);transform-origin:center;">
          <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:11px solid #1d4ed8;position:absolute;left:-5px;top:-22px;"></div>
        </div>
        <div class="animate-ping" style="position:absolute;left:22px;top:22px;transform:translate(-50%,-50%);width:30px;height:30px;border-radius:9999px;border:1px solid #2563eb;opacity:.4;"></div>
        <div style="position:absolute;left:22px;top:22px;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:9999px;background:#2563eb;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35);"></div>
        <div style="position:absolute;left:22px;top:34px;transform:translateX(-50%);white-space:nowrap;" class="text-[8px] font-black text-[#2563eb] bg-white/85 px-1 rounded">現在地</div>
      </div>
    `;

    const userIcon = L.divIcon({
      html: userHtml,
      className: 'custom-user-icon',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      userMarkerRef.current.setIcon(userIcon);
    } else {
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    }
  }, [userLocation, activeSpot, deviceHeading]);

  // 2.5 チャレンジのゴールマーカー（lat/lngが実際に変わった時だけ再配置。
  //     ※ goalオブジェクトは毎レンダリング新規生成されるため、依存はプリミティブにする）
  const goalLat = goal && typeof goal.lat === 'number' && !isNaN(goal.lat) ? goal.lat : null;
  const goalLng = goal && typeof goal.lng === 'number' && !isNaN(goal.lng) ? goal.lng : null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (goalMarkerRef.current) { goalMarkerRef.current.remove(); goalMarkerRef.current = null; }
    if (goalLat == null || goalLng == null) return;
    const goalHtml = `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="background:#dc2626;color:#fff;font-weight:900;font-size:10px;white-space:nowrap;padding:2px 8px;border-radius:9999px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);">🚩 目的地</div>
        <div style="width:8px;height:8px;background:#dc2626;transform:rotate(45deg);margin-top:-2px;border-right:2px solid #fff;border-bottom:2px solid #fff;"></div>
      </div>`;
    goalMarkerRef.current = L.marker([goalLat, goalLng], {
      icon: L.divIcon({ html: goalHtml, className: 'custom-goal-icon', iconSize: [80, 28], iconAnchor: [40, 28] }),
      zIndexOffset: 1500,
    }).addTo(map);
    // ゴールへ自動でパン/ズームしない（ユーザー操作を尊重）
  }, [goalLat, goalLng]);

  // 3. Manage Spot Markers (Sauna-ikitai style tag bubble pins)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    // 現在地に最も近いスポット（このスポットだけフキダシを表示）
    let nearestId: string | null = null;
    let nearestD = Infinity;
    visibleSpots.forEach((s) => {
      const d = roughDist(userLocation.lat, userLocation.lng, s.latitude, s.longitude);
      if (d < nearestD) { nearestD = d; nearestId = s.id; }
    });

    visibleSpots.forEach((spot) => {
      const isActive = activeSpot?.id === spot.id;
      const iconEmoji = spot.godEmoji || (spot.category === '神社' ? '⛩️' : '🙏');
      const spotToku = db.getSpotToku(spot.id);
      // 最も近い神（と選択中）だけフキダシを表示。他は小さなピン＋地名のみ。
      const showBubble = spot.id === nearestId || isActive;

      const spotHtml = showBubble
        ? `
        <div class="relative flex flex-col items-center">
          <div class="god-ripple ${isActive ? 'god-ripple-active' : ''}"></div>
          <div class="relative flex items-center ${
            isActive
              ? 'bg-white text-[#2563eb] border-2 border-[#2563eb] scale-110 shadow-lg'
              : 'bg-[#2563eb] text-white border-2 border-white shadow-md hover:scale-105'
          } rounded-full px-2.5 py-1 transition-all duration-150">
            <span class="text-[11px] font-black leading-none whitespace-nowrap">徳 ${spotToku.toLocaleString()}</span>
          </div>
          <div class="w-2 h-2 ${
            isActive ? 'bg-white border-[#2563eb]' : 'bg-[#2563eb] border-white'
          } rotate-45 -mt-1 border-r border-b"></div>
          <span class="map-spot-name ${isActive ? 'map-spot-name-active' : ''}">${spot.name}</span>
        </div>
      `
        : `
        <div class="relative flex flex-col items-center">
          <div class="w-3 h-3 rounded-full bg-[#2563eb]/70 border-2 border-white shadow-sm"></div>
        </div>
      `;

      const spotIcon = L.divIcon({
        html: spotHtml,
        className: 'custom-spot-icon',
        iconSize: [120, 30],
        iconAnchor: [60, showBubble ? 30 : 6],
      });

      const marker = L.marker([spot.latitude, spot.longitude], {
        icon: spotIcon,
      })
        .addTo(map)
        .on('click', () => {
          onSelectSpot(spot);
        });

      markersRef.current[spot.id] = marker;
    });
  }, [visibleSpots, activeSpot, onSelectSpot, ugcCounts, userLocation]);

  // 4. 選択スポットを地図の中央へ（ズームは維持）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (activeSpot) {
      map.panTo([activeSpot.latitude, activeSpot.longitude], { animate: true });
    }
  }, [activeSpot]);

  // 5. Warp support
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    if (!activeSpot) {
      map.panTo([userLocation.lat, userLocation.lng]);
    }
  }, [userLocation, activeSpot]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full rounded-2xl overflow-hidden" />

      {/* 現在地へ戻るボタン（下部オーバーレイと被らないよう上め） */}
      <button
        onClick={() => mapRef.current?.setView([userLocation.lat, userLocation.lng], 15, { animate: true })}
        className="absolute bottom-[210px] right-3 z-[600] w-11 h-11 rounded-full bg-white shadow-lg border border-[#2563eb]/20 flex items-center justify-center text-[#2563eb] hover:bg-[#2563eb] hover:text-white transition-all cursor-pointer"
        title="現在地へ"
      >
        <Navigation className="w-5 h-5" />
      </button>
    </div>
  );
}
