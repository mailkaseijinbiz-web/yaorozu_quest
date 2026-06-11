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

// 検索結果ピンのラベルは外部データ（ジオコーダ）由来のためエスケープする
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// 1画面の表示数をズームに応じて制御。
// 街区スケール（z≥15）では画面内の寺社をすべて表示する（神社・寺はすべて地図に出す方針）。
// 広域では描画負荷を抑えるため上限を設ける（ズームすればすべて見られる）。
function maxMarkersForZoom(zoom: number): number {
  if (zoom <= 11) return 80;
  if (zoom <= 12) return 150;
  if (zoom <= 13) return 350;
  if (zoom <= 14) return 700;
  return Infinity;
}

interface LeafletMapProps {
  spots: Spot[];
  activeSpot: Spot | null;
  onSelectSpot: (spot: Spot) => void;
  onOpenDetail?: (spot: Spot) => void; // 選択中の場をさらにタップすると詳細を開く
  userLocation: { lat: number; lng: number };
  setUserLocation: (loc: { lat: number; lng: number }) => void;
  ugcCounts: { [spotId: string]: number };
  goal?: { lat: number; lng: number; name: string; godEmoji?: string } | null; // チャレンジのゴール（godEmoji=挑戦中の神のアイコン）
  onGoalTap?: () => void; // クエスト中、目的地アイコンのタップ（目的地の詳細を開く）
  trail?: { lat: number; lng: number }[]; // クエスト中に通ったルートの軌跡（ポリラインで描く）
  controlsBottom?: number; // 現在地ボタンの下端からの位置（下部オーバーレイの上端+余白）
  focusGoalToken?: number; // 値が変わると目的地を地図中央へ寄せる
  hideControls?: boolean; // 導入表示中は現在地ボタンを隠し、解除時にふわっと出す
  onMapMove?: (center: { lat: number; lng: number }) => void; // ユーザーが地図を移動させたとき（スロットル済み）
  cardFocus?: { lat: number; lng: number } | null; // インタラクティブカードが指す場所
  cardFocusToken?: number; // 値が変わるとカードの場所へ地図を寄せる（スワイプ連動）
  searchPin?: { lat: number; lng: number; name: string; token: number } | null; // 場所検索の結果（token が変わると再フォーカス）
  onMapLongPress?: (loc: { lat: number; lng: number }) => void; // マップの長押し
  deviceHeading?: number | null; // 端末の向き（方位磁針, 北=0時計回り）。親で取得して配る
}

export default function LeafletMap({
  spots,
  activeSpot,
  onSelectSpot,
  onOpenDetail,
  userLocation,
  setUserLocation,
  ugcCounts,
  goal,
  onGoalTap,
  trail,
  controlsBottom = 210,
  focusGoalToken,
  hideControls = false,
  onMapMove,
  cardFocus,
  cardFocusToken,
  searchPin = null,
  onMapLongPress,
  deviceHeading = null,
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const markersRef = useRef<{ [spotId: string]: L.Marker }>({});
  const goalMarkerRef = useRef<L.Marker | null>(null);
  const trailLayerRef = useRef<L.Polyline | null>(null);
  // フキダシのつぶやきを動的に切り替えるため、スポット毎の声リストを保持
  const voicesRef = useRef<{ [spotId: string]: string[] }>({});
  // 最新の現在地を参照（再生成を避けつつ、ゴール演出で使う）
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;
  // onMapMove を ref 化してクロージャ内から最新コールバックを呼べるようにする
  const onMapMoveRef = useRef(onMapMove);
  onMapMoveRef.current = onMapMove;
  const onMapLongPressRef = useRef(onMapLongPress);
  onMapLongPressRef.current = onMapLongPress;
  // 選択中の場を再タップしたときの詳細表示コールバック（マーカー生成クロージャから最新を呼ぶ）
  const onOpenDetailRef = useRef(onOpenDetail);
  onOpenDetailRef.current = onOpenDetail;
  const onGoalTapRef = useRef(onGoalTap);
  onGoalTapRef.current = onGoalTap;
  // 自動センタリング判定用：前回パンした現在地（初回取得・ワープ判定に使う）
  const lastPanLocRef = useRef<{ lat: number; lng: number } | null>(null);

  // 地図の移動に追従して再描画するためのバージョン
  const [mapVersion, setMapVersion] = useState(0);

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
    // 表示スポットの再計算は移動・ズームの「完了時」に行う。
    // 多数の寺社マーカーを毎フレーム作り直すとドラッグがカクつくため、moveend に集約する
    // （ドラッグ中は Leaflet が既存マーカーを座標追従で滑らかに動かす）。
    const bump = () => setMapVersion((v) => v + 1);
    map.on('moveend', bump);
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

    // 長押し（PCの右クリック、スマホの長押し）で任意の場所を処理する
    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
      onMapLongPressRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
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
        <style>
          @keyframes gmap-pulse {
            0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
          }
        </style>
        <!-- Pulsing Accuracy Halo -->
        <div style="position:absolute;left:22px;top:22px;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50%;background:rgba(26,115,232,0.22);animation:gmap-pulse 2s infinite ease-out;pointer-events:none;"></div>
        
        <!-- Direction Beam -->
        <svg style="position:absolute;left:0;top:0;width:44px;height:44px;transform:rotate(${heading}deg);transform-origin:22px 22px;pointer-events:none;" viewBox="0 0 44 44">
          <defs>
            <radialGradient id="beam-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#1a73e8" stop-opacity="0.6"/>
              <stop offset="100%" stop-color="#1a73e8" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <path d="M 22 22 L 11 2.95 A 22 22 0 0 1 33 2.95 Z" fill="url(#beam-grad)"/>
        </svg>

        <!-- Blue Dot -->
        <div style="position:absolute;left:22px;top:22px;transform:translate(-50%,-50%);width:20px;height:20px;border-radius:50%;background:#1a73e8;border:3px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.3);z-index:2;pointer-events:none;"></div>
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
  const goalEmoji = goal?.godEmoji || '⛩️';
  // 道案内演出（ゴールへ飛んで戻る）を初回マウントでは行わないためのフラグ。
  // タブ再表示などで地図が作り直された直後は、まず現在地を中央に保つ。
  const goalRevealInitRef = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const isFirstRun = goalRevealInitRef.current;
    goalRevealInitRef.current = false;
    if (goalMarkerRef.current) { goalMarkerRef.current.remove(); goalMarkerRef.current = null; }
    if (goalLat == null || goalLng == null) return;
    // 青のフキダシ（目的地での写真撮影を促す）＋その下に「挑戦中の神」のアイコンを青い丸で表示。
    // アンカーは下端の青い丸の中心＝目的地座標に合わせる。
    const goalHtml = `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;">
        <div style="background:#2563eb;color:#fff;font-weight:900;font-size:11px;white-space:nowrap;padding:3px 11px;border-radius:9999px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);">ⓘ タップで詳細</div>
        <div style="width:9px;height:9px;background:#2563eb;transform:rotate(45deg);margin-top:-5px;border-right:2px solid #fff;border-bottom:2px solid #fff;"></div>
        <div style="margin-top:2px;width:38px;height:38px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1;">${goalEmoji}</div>
      </div>`;
    goalMarkerRef.current = L.marker([goalLat, goalLng], {
      icon: L.divIcon({ html: goalHtml, className: 'custom-goal-icon', iconSize: [180, 80], iconAnchor: [90, 52] }),
      zIndexOffset: 1500,
    }).addTo(map);
    // 目的地アイコンのタップで、その場の詳細を開く（クエスト中でも詳細を見られるように）
    goalMarkerRef.current.on('click', () => onGoalTapRef.current?.());

    // 初回マウント時（タブ遷移直後など）は演出せず、現在地表示を優先する。
    // 目的地が新しく決まった時（チャレンジ開始後の進行・次の目的地へ）だけ演出する。
    if (isFirstRun) return;

    // 道案内演出：まず目的地を見せ、少し待ってから現在地へ戻る
    const targetZoom = Math.max(map.getZoom(), 15);
    map.flyTo([goalLat, goalLng], targetZoom, { duration: 0.9 });
    const t = setTimeout(() => {
      const u = userLocationRef.current;
      map.flyTo([u.lat, u.lng], targetZoom, { duration: 0.9 });
    }, 1700);
    return () => clearTimeout(t);
  }, [goalLat, goalLng, goalName, goalEmoji]);

  // 2.6 クエスト中に通ったルートの軌跡（青い破線のポリライン）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pts = (trail ?? []).map((p) => [p.lat, p.lng] as [number, number]);
    if (pts.length < 2) {
      // 軌跡なし（クエスト外・リセット直後）は線を消す
      if (trailLayerRef.current) { trailLayerRef.current.remove(); trailLayerRef.current = null; }
      return;
    }
    if (!trailLayerRef.current) {
      trailLayerRef.current = L.polyline(pts, {
        color: '#2563eb', weight: 4, opacity: 0.7, dashArray: '1,8', lineCap: 'round', lineJoin: 'round',
      }).addTo(map);
    } else {
      trailLayerRef.current.setLatLngs(pts);
    }
  }, [trail]);

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

  // インタラクティブカードのスワイプ：対応する場所へ地図を寄せる（初回トークンは無視）
  const cardFocusInitRef = useRef(true);
  useEffect(() => {
    if (cardFocusInitRef.current) { cardFocusInitRef.current = false; return; }
    const map = mapRef.current;
    if (map && cardFocus) {
      map.flyTo([cardFocus.lat, cardFocus.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardFocusToken]);

  // 2.7 場所検索の結果ピン：赤いピン＋名前ラベルを置き、地図をその場所へ寄せる
  const searchMarkerRef = useRef<L.Marker | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (searchMarkerRef.current) { searchMarkerRef.current.remove(); searchMarkerRef.current = null; }
    if (!searchPin) return;
    const pinHtml = `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="background:#dc2626;color:#fff;font-weight:900;font-size:11px;white-space:nowrap;max-width:170px;overflow:hidden;text-overflow:ellipsis;padding:3px 11px;border-radius:9999px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);">📍 ${escapeHtml(searchPin.name)}</div>
        <div style="width:9px;height:9px;background:#dc2626;transform:rotate(45deg);margin-top:-5px;border-right:2px solid #fff;border-bottom:2px solid #fff;"></div>
        <div style="margin-top:2px;width:14px;height:14px;border-radius:9999px;background:#dc2626;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);"></div>
      </div>`;
    searchMarkerRef.current = L.marker([searchPin.lat, searchPin.lng], {
      icon: L.divIcon({ html: pinHtml, className: 'custom-search-icon', iconSize: [190, 56], iconAnchor: [95, 49] }),
      zIndexOffset: 1400,
    }).addTo(map);
    map.flyTo([searchPin.lat, searchPin.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
    // 検索した場所（例: 善光寺）には、まだ場（神・クエスト）が生成されていないことが多い。
    // 地図移動の moveend は 60 秒スロットルされ、直前に動かしていると検索しても生成が走らず、
    // 場のマーカーがいつまでも出ない。検索時は moveend のスロットルに頼らず、検索地点で
    // 場の生成を直接促す（下流の generateSpotNearby が 5分/500m で重複生成を抑止する）。
    onMapMoveRef.current?.({ lat: searchPin.lat, lng: searchPin.lng });
    // token が変わった時だけ再フォーカス（同じ場所の再検索でも飛べるように）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchPin?.token]);

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

    // フキダシは「選択中の場」に対して出す。選択中の場があるときはその場だけに表示し、
    // 選択していない場にフキダシが出る不具合を防ぐ。無選択のときのみ最寄りの場に出す。
    const bubbleIds = new Set<string>();
    if (!questMode) {
      const candidateIds: string[] = [];
      const activeVisible = !!activeSpot && visibleSpots.some((s) => s.id === activeSpot.id);
      if (activeVisible) candidateIds.push(activeSpot!.id);
      else if (nearestId) candidateIds.push(nearestId);

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
      // 種別アイコン：神社は ⛩️ / 寺院は 🙏 で必ず分ける（地図上で一目で見分けられるように）。
      const catEmoji = spot.category === '神社' ? '⛩️' : '🙏';
      const iconEmoji = spot.godEmoji || catEmoji;
      // 現在地マーカーとフキダシ本体が画面上で重なるスポットは、フキダシを出さずドット表示にする
      // （フキダシが現在地に被るのを防ぐ）。フキダシ本体は地点の上方に開くため、現在地が
      // 地点の真上〜同位置（横≲116px・縦 spotPt.y-82〜+2）にあるときを「被り」とみなす。
      const spotPt = map.latLngToContainerPoint([spot.latitude, spot.longitude]);
      const bubbleOverlapsUser =
        Math.abs(userPt.x - spotPt.x) < 116 && userPt.y > spotPt.y - 82 && userPt.y < spotPt.y + 2;
      // 最も近い神（と選択中）だけフキダシを表示。被る場合は優先度の高いひとつのみ。
      // クエスト中は青のフキダシを出さない。現在地と被るときも出さない。
      const showBubble = bubbleIds.has(spot.id) && !bubbleOverlapsUser;
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

      // ── UGCによるオーラ演出（他人の貢献の可視化） ──
      const ugc = ugcCounts[spot.id] || 0;
      // 貢献度に応じてオーラの強さ（ぼかし幅）と色（少し赤みを帯びた黄金色）を計算
      const auraShadow = ugc > 0 
        ? `filter: drop-shadow(0 0 ${Math.min(4 + ugc * 3, 24)}px rgba(234, 179, 8, ${Math.min(0.5 + ugc * 0.1, 1)}));` 
        : '';
      const auraCircleShadow = ugc > 0
        ? `box-shadow: 0 0 ${Math.min(8 + ugc * 4, 30)}px rgba(234, 179, 8, ${Math.min(0.6 + ugc * 0.1, 1)}), 0 2px 10px rgba(37,99,235,.55);`
        : `box-shadow: 0 2px 10px rgba(37,99,235,.55);`;

      const activeCircleHtml = `
          <div style="width:40px;height:40px;border-radius:9999px;background:#2563eb;border:3px solid #fff;${auraCircleShadow}display:flex;align-items:center;justify-content:center;font-size:21px;line-height:1;transition:box-shadow 0.3s ease;">${iconEmoji}</div>
          <span class="map-spot-name map-spot-name-active" style="margin-top:3px;">${spot.name}</span>`;

      const spotHtml = isActive && showBubble
        ? `
        <div class="relative flex flex-col items-center">
          <div class="relative flex items-start gap-1.5 rounded-2xl px-2.5 py-1.5 shadow-lg border-2 border-[#2563eb]" style="max-width:190px;background:#ffffff;">
            <span style="font-size:15px;line-height:1.15;flex-shrink:0;">${iconEmoji}</span>
            <span class="spot-voice text-[11px] font-bold leading-snug text-gray-800" data-spotid="${spot.id}" data-vi="${voiceIdx}" style="word-break:break-word;transition:opacity 0.3s ease;">${voice}</span>
          </div>
          <div class="border-r-2 border-b-2 border-[#2563eb] -mt-1.5 rotate-45" style="width:10px;height:10px;background:#ffffff;margin-bottom:6px;"></div>
          ${activeCircleHtml}
        </div>
      `
        : isActive
        ? `
        <div class="relative flex flex-col items-center">
          ${activeCircleHtml}
        </div>
      `
        : showBubble
        ? `
        <div class="relative flex flex-col items-center">
          <div class="relative flex items-start gap-1.5 rounded-2xl px-2.5 py-1.5 shadow-lg ${isActive ? 'border-2' : 'border'} ${borderCls}" style="max-width:190px;background:#ffffff;">
            <span style="font-size:15px;line-height:1.15;flex-shrink:0;">${iconEmoji}</span>
            <span class="spot-voice text-[11px] font-bold leading-snug text-gray-800" data-spotid="${spot.id}" data-vi="${voiceIdx}" style="word-break:break-word;transition:opacity 0.3s ease;">${voice}</span>
          </div>
          <div class="${isActive ? 'border-r-2 border-b-2' : 'border-r border-b'} ${borderCls} -mt-1.5 rotate-45" style="width:10px;height:10px;background:#ffffff;margin-bottom:20px;"></div>
          <div style="${auraShadow}transition:filter 0.3s ease;">
            <span class="map-spot-name ${isActive ? 'map-spot-name-active' : ''}">${spot.name}</span>
          </div>
        </div>
      `
        : `
        <div class="relative flex flex-col items-center">
          <div style="font-size:19px;line-height:1;${auraShadow}transition:filter 0.3s ease;">${catEmoji}</div>
          <span class="map-spot-name" style="${auraShadow}">${spot.name}</span>
        </div>
      `;

      const spotIcon = L.divIcon({
        html: spotHtml,
        className: 'custom-spot-icon',
        iconSize: isActive && showBubble ? [210, 128] : isActive ? [150, 64] : showBubble ? [210, 108] : [140, 40],
        // アンカー（＝この場の地理座標）。選択中は青丸の中心、フキダシは上へ持ち上げてドットとの重なりを防ぐ。
        // 種別アイコン（⛩️/🙏）はその中心を地点に合わせ、名前キャプションは絵文字の下に出す。
        iconAnchor: isActive && showBubble ? [105, 78] : isActive ? [75, 20] : showBubble ? [105, 60] : [70, 10],
      });

      const marker = L.marker([spot.latitude, spot.longitude], {
        icon: spotIcon,
      })
        .addTo(map)
        .on('click', () => {
          // 未選択の場 → 選択。すでに選択中の場を再タップ → 詳細を開く。
          // （activeSpot 変更時にマーカーは作り直されるため isActive は最新状態を反映する）
          if (isActive) onOpenDetailRef.current?.(spot);
          else onSelectSpot(spot);
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

  // 4. 選択スポットを地図の中央へ（ズームは維持）。
  //    初回マウント時はパンせず、現在地を中央に保つ（マップを開いたらまず現在地を示す）。
  const activeSpotPanInitRef = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (activeSpotPanInitRef.current) { activeSpotPanInitRef.current = false; return; }
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
