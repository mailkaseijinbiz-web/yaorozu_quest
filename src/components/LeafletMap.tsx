'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation } from 'lucide-react';
import { Spot, isVerifiedSpot } from '../lib/db';
import { roughDistance, distanceKm } from '../lib/geo';
import { getHeartVoices } from '../data/god-tasks';

// フキダシのつぶやきは長すぎたら省略
function truncVoice(s: string): string {
  return s.length > 30 ? s.slice(0, 29) + '…' : s;
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
  controlsBottom?: number; // 現在地ボタンの下端からの位置（下部オーバーレイの上端+余白）
  focusGoalToken?: number; // 値が変わると目的地を地図中央へ寄せる
  hideControls?: boolean; // 導入表示中は現在地ボタンを隠し、解除時にふわっと出す
  onMapMove?: (center: { lat: number; lng: number }) => void; // ユーザーが地図を移動させたとき（スロットル済み）
}

export default function LeafletMap({
  spots,
  activeSpot,
  onSelectSpot,
  userLocation,
  setUserLocation,
  ugcCounts,
  goal,
  controlsBottom = 210,
  focusGoalToken,
  hideControls = false,
  onMapMove,
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const markersRef = useRef<{ [spotId: string]: L.Marker }>({});
  const goalMarkerRef = useRef<L.Marker | null>(null);
  // フキダシのつぶやきを動的に切り替えるため、スポット毎の声リストを保持
  const voicesRef = useRef<{ [spotId: string]: string[] }>({});
  // 最新の現在地を参照（再生成を避けつつ、ゴール演出で使う）
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;
  // onMapMove を ref 化してクロージャ内から最新コールバックを呼べるようにする
  const onMapMoveRef = useRef(onMapMove);
  onMapMoveRef.current = onMapMove;
  // 自動センタリング判定用：前回パンした現在地（初回取得・ワープ判定に使う）
  const lastPanLocRef = useRef<{ lat: number; lng: number } | null>(null);

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

    // 地図移動をアクティビティログへ（60秒スロットル）
    let lastMoveLog = 0;
    map.on('moveend', () => {
      const now = Date.now();
      if (now - lastMoveLog > 60_000) {
        lastMoveLog = now;
        const c = map.getCenter();
        onMapMoveRef.current?.({ lat: c.lat, lng: c.lng });
      }
    });

    // コンテナの実寸が確定/変化したら投影をやり直す。
    // PWA（standalone）ではセーフエリアやビューポート高がブラウザと異なり、
    // 初期化時のサイズが未確定だと現在地マーカーが地図上でずれる。invalidateSize で補正する。
    const refresh = () => map.invalidateSize();
    const raf = requestAnimationFrame(refresh);
    const t1 = setTimeout(refresh, 300);
    const onVisible = () => { if (!document.hidden) refresh(); };
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => map.invalidateSize());
      ro.observe(mapContainerRef.current);
    }
    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
    window.addEventListener('pageshow', refresh); // PWA 復帰
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', refresh);
      window.removeEventListener('orientationchange', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', onVisible);
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
    inView.sort((a, z) => roughDistance(c.lat, c.lng, a.latitude, a.longitude) - roughDistance(c.lat, c.lng, z.latitude, z.longitude));
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
  const goalName = goal?.name ?? '';
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (goalMarkerRef.current) { goalMarkerRef.current.remove(); goalMarkerRef.current = null; }
    if (goalLat == null || goalLng == null) return;
    // 青のフキダシ：目的地での行動（写真撮影）を促す
    const goalHtml = `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;padding-bottom:4px;">
        <div style="background:#2563eb;color:#fff;font-weight:900;font-size:11px;white-space:nowrap;padding:3px 11px;border-radius:9999px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);">📸 ここで写真を撮る！</div>
        <div style="width:10px;height:10px;background:#2563eb;transform:rotate(45deg);margin-top:-6px;border-right:2px solid #fff;border-bottom:2px solid #fff;"></div>
      </div>`;
    goalMarkerRef.current = L.marker([goalLat, goalLng], {
      icon: L.divIcon({ html: goalHtml, className: 'custom-goal-icon', iconSize: [180, 44], iconAnchor: [90, 40] }),
      zIndexOffset: 1500,
    }).addTo(map);

    // 道案内演出：まず目的地を見せ、少し待ってから現在地へ戻る
    const targetZoom = Math.max(map.getZoom(), 15);
    map.flyTo([goalLat, goalLng], targetZoom, { duration: 0.9 });
    const t = setTimeout(() => {
      const u = userLocationRef.current;
      map.flyTo([u.lat, u.lng], targetZoom, { duration: 0.9 });
    }, 1700);
    return () => clearTimeout(t);
  }, [goalLat, goalLng, goalName]);

  // 「次の目的地」タップ：目的地を地図中央へ寄せる（初回トークンは無視）
  const focusInitRef = useRef(true);
  useEffect(() => {
    if (focusInitRef.current) { focusInitRef.current = false; return; }
    const map = mapRef.current;
    if (map && goalLat != null && goalLng != null) {
      map.flyTo([goalLat, goalLng], Math.max(map.getZoom(), 16), { duration: 0.7 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusGoalToken]);

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
      const d = roughDistance(userLocation.lat, userLocation.lng, s.latitude, s.longitude);
      if (d < nearestD) { nearestD = d; nearestId = s.id; }
    });

    // クエストモード（目的地あり）では青のフキダシを出さず、赤い目的地に集中させる
    const questMode = goalLat != null && goalLng != null;

    // フキダシ表示候補（優先度順：選択中 > 最寄り）。
    // 画面上でフキダシ同士が被る場合は、優先度の高いひとつだけ表示する。
    const bubbleIds = new Set<string>();
    if (!questMode) {
      const candidateIds: string[] = [];
      if (activeSpot && visibleSpots.some((s) => s.id === activeSpot.id)) candidateIds.push(activeSpot.id);
      if (nearestId && nearestId !== activeSpot?.id) candidateIds.push(nearestId);

      const acceptedPts: { x: number; y: number }[] = [];
      candidateIds.forEach((id) => {
        const s = visibleSpots.find((v) => v.id === id);
        if (!s) return;
        const pt = map.latLngToContainerPoint([s.latitude, s.longitude]);
        // フキダシのおおよそのサイズ（横210px / 縦90px）の範囲に既存フキダシがあれば被りとみなす
        const overlaps = acceptedPts.some((p) => Math.abs(p.x - pt.x) < 190 && Math.abs(p.y - pt.y) < 80);
        if (overlaps) return;
        bubbleIds.add(id);
        acceptedPts.push({ x: pt.x, y: pt.y });
      });
    }

    // 現在地マーカーの画面座標（フキダシとの衝突判定に使う）
    const userPt = map.latLngToContainerPoint([userLocation.lat, userLocation.lng]);

    visibleSpots.forEach((spot) => {
      const isActive = activeSpot?.id === spot.id;
      const iconEmoji = spot.godEmoji || (spot.category === '神社' ? '⛩️' : '🙏');
      // 最も近い神（と選択中）だけフキダシを表示。被る場合は優先度の高いひとつのみ。クエスト中は青のフキダシを出さない。
      const showBubble = bubbleIds.has(spot.id);
      // フキダシの中身は「ここの神のつぶやき（心の声）」。スポット毎に変化させ、一定間隔で動的に切り替える
      let voice = '';
      let voiceIdx = 0;
      if (showBubble) {
        const voices = getHeartVoices(spot);
        voicesRef.current[spot.id] = voices.length ? voices : [`${spot.godName || spot.name}が見守っておる。`];
        voiceIdx = voices.length ? spot.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % voices.length : 0;
        voice = truncVoice(voicesRef.current[spot.id][voiceIdx]);
      }
      const borderCls = isActive ? 'border-[#2563eb]' : 'border-[#2563eb]/40';

      // 現在地マーカー(上方向に約44px)とフキダシ(既定では上方向に開く)が被る場合は、
      // 切り込み(しっぽ)を上側に変えて下方向に開き、現在地マーカーとぶつからないようにする
      let flipDown = false;
      if (showBubble) {
        const spotPt = map.latLngToContainerPoint([spot.latitude, spot.longitude]);
        const nearX = Math.abs(userPt.x - spotPt.x) < 110;
        const userAbove = userPt.y < spotPt.y && userPt.y > spotPt.y - 80;
        flipDown = nearX && userAbove;
      }

      const bubbleBox = `
          <div class="relative flex items-start gap-1.5 rounded-2xl px-2.5 py-1.5 shadow-lg ${isActive ? 'border-2' : 'border'} ${borderCls}" style="max-width:190px;background:#ffffff;">
            <span style="font-size:15px;line-height:1.15;flex-shrink:0;">${iconEmoji}</span>
            <span class="spot-voice text-[11px] font-bold leading-snug text-gray-800" data-spotid="${spot.id}" data-vi="${voiceIdx}" style="word-break:break-word;transition:opacity 0.3s ease;">${voice}</span>
          </div>
          <div class="${isActive ? 'border-r-2 border-b-2' : 'border-r border-b'} ${borderCls} -mt-1.5 rotate-45" style="width:10px;height:10px;background:#ffffff;margin-bottom:20px;"></div>
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
        iconSize: showBubble ? [210, 108] : [120, 30],
        // アンカー（＝この場の地理座標＝現在地ドット位置）を下げ、フキダシを上へ持ち上げてドットとの重なりを防ぐ
        iconAnchor: showBubble ? [105, 60] : [60, 6],
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
  }, [visibleSpots, activeSpot, onSelectSpot, ugcCounts, userLocation, goalLat, goalLng]);

  // 3.5 フキダシのつぶやきを一定間隔で次の声へ動的に切り替える（フェード付き・staticにしない）
  useEffect(() => {
    const id = setInterval(() => {
      const spans = document.querySelectorAll<HTMLElement>('.spot-voice[data-spotid]');
      spans.forEach((el) => {
        const sid = el.getAttribute('data-spotid') || '';
        const voices = voicesRef.current[sid];
        if (!voices || voices.length < 2) return;
        const cur = parseInt(el.getAttribute('data-vi') || '0', 10) || 0;
        const next = (cur + 1) % voices.length;
        el.setAttribute('data-vi', String(next));
        el.style.opacity = '0';
        window.setTimeout(() => {
          el.textContent = truncVoice(voices[next]);
          el.style.opacity = '1';
        }, 300);
      });
    }, 4500);
    return () => clearInterval(id);
  }, []);

  // 4. 選択スポットを地図の中央へ（ズームは維持）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (activeSpot) {
      map.panTo([activeSpot.latitude, activeSpot.longitude], { animate: true });
    }
  }, [activeSpot]);

  // 5. Warp support / 現在地への自動センタリング。
  //    GPS は歩行中に細かく更新されるため、毎回パンすると手動操作を妨げる。
  //    初回の現在地取得時とワープ（大きく移動）した時のみ中央へ寄せ、
  //    通常の歩行による小移動では地図を勝手に動かさない（現在地ボタンで手動復帰可能）。
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (activeSpot) { lastPanLocRef.current = userLocation; return; }

    const prev = lastPanLocRef.current;
    const isFirstFix = prev == null;
    const warped = prev != null && distanceKm(prev.lat, prev.lng, userLocation.lat, userLocation.lng) > 0.3;
    if (isFirstFix || warped) {
      map.panTo([userLocation.lat, userLocation.lng]);
    }
    lastPanLocRef.current = userLocation;
  }, [userLocation, activeSpot]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full rounded-2xl overflow-hidden" />

      {/* 現在地へ戻るボタン（下部オーバーレイの上端 +10px に追従・開始時にふわっと） */}
      <button
        onClick={() => mapRef.current?.setView([userLocation.lat, userLocation.lng], 15, { animate: true })}
        style={{
          bottom: controlsBottom,
          opacity: hideControls ? 0 : 1,
          transform: hideControls ? 'scale(0.7)' : 'scale(1)',
          pointerEvents: hideControls ? 'none' : 'auto',
          transition: 'opacity 0.4s ease 0.45s, transform 0.4s cubic-bezier(0.2,1.4,0.4,1) 0.45s, bottom 0.25s ease',
        }}
        className="absolute right-3 z-[600] w-11 h-11 rounded-full bg-white shadow-lg border border-[#2563eb]/20 flex items-center justify-center text-[#2563eb] hover:bg-[#2563eb] hover:text-white cursor-pointer"
        title="現在地へ"
      >
        <Navigation className="w-5 h-5 fill-current" />
      </button>
    </div>
  );
}
