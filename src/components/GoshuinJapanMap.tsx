'use client';

// 御朱印帳の日本地図。御朱印を授かった場所を赤い点で灯す（取得地が増えるほど日本が赤くなる）。
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface GoshuinPoint {
  lat: number;
  lng: number;
  name: string;
}

export default function GoshuinJapanMap({ points }: { points: GoshuinPoint[] }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // 地図の生成（1回だけ）
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
    }).setView([37.5, 137.5], 4); // 日本全体
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 12,
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    // 初期サイズ未確定対策
    setTimeout(() => map.invalidateSize(), 0);
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  // 御朱印の赤い点を描く
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const valid = points.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng));
    for (const p of valid) {
      // やわらかい赤のにじみ
      L.circleMarker([p.lat, p.lng], { radius: 13, stroke: false, fillColor: '#dc2626', fillOpacity: 0.16 }).addTo(layer);
      // 朱印の点
      L.circleMarker([p.lat, p.lng], { radius: 5.5, color: '#fff', weight: 1.5, fillColor: '#dc2626', fillOpacity: 0.9 })
        .addTo(layer)
        .bindTooltip(p.name, { direction: 'top', offset: [0, -4] });
    }
    if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], 9);
    } else if (valid.length > 1) {
      map.fitBounds(L.latLngBounds(valid.map((p) => [p.lat, p.lng] as [number, number])).pad(0.3), { maxZoom: 9 });
    } else {
      map.setView([37.5, 137.5], 4);
    }
  }, [points]);

  return <div ref={elRef} className="w-full h-56 rounded-2xl overflow-hidden border border-red-100 relative z-0" />;
}
