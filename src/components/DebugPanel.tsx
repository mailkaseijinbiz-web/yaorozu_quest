'use client';

import React, { useEffect, useState } from 'react';
import { Bug, X, MapPin, Crosshair } from 'lucide-react';
import { DEBUG_PRESETS, setDebugEnabled, type DebugLatLng } from '../lib/debug';

interface DebugPanelProps {
  location: DebugLatLng;                         // 現在のアプリ上の現在地
  geoStatus: 'locating' | 'ok' | 'denied' | 'error';
  onApply: (loc: DebugLatLng) => void;           // 現在地を上書き＋場を生成
  onDisable: () => void;                          // デバッグモード自体を終了
}

const GEO_LABEL: Record<DebugPanelProps['geoStatus'], string> = {
  locating: '取得中…',
  ok: 'OK',
  denied: '不許可',
  error: 'エラー',
};

// 位置情報が許可されない環境でも現在地を手動指定してテストするためのフローティングパネル。
export default function DebugPanel({ location, geoStatus, onApply, onDisable }: DebugPanelProps) {
  const [open, setOpen] = useState(false);
  const [lat, setLat] = useState(String(location.lat));
  const [lng, setLng] = useState(String(location.lng));

  // パネルを開いたとき、最新の現在地を入力欄へ反映
  useEffect(() => {
    if (open) {
      setLat(location.lat.toFixed(6));
      setLng(location.lng.toFixed(6));
    }
  }, [open, location.lat, location.lng]);

  const apply = () => {
    const la = parseFloat(lat);
    const ln = parseFloat(lng);
    if (isNaN(la) || isNaN(ln)) return;
    onApply({ lat: la, lng: ln });
  };

  // 折りたたみボタン
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="デバッグパネルを開く"
        className="absolute top-2 left-2 z-[3500] w-9 h-9 rounded-full bg-fuchsia-600 text-white shadow-lg border border-white/40 flex items-center justify-center cursor-pointer hover:bg-fuchsia-500 active:scale-95 transition-all"
      >
        <Bug className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="absolute top-2 left-2 right-2 z-[3500] bg-white/97 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-fuchsia-400 p-3 max-w-[320px]">
      {/* ヘッダー */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="flex items-center gap-1 text-[11px] font-black text-fuchsia-600 bg-fuchsia-50 px-2 py-0.5 rounded-full">
          <Bug className="w-3 h-3" /> DEBUG
        </span>
        <span className="text-[10px] text-gray-400">GPS: {GEO_LABEL[geoStatus]}</span>
        <button
          onClick={() => setOpen(false)}
          aria-label="閉じる"
          className="ml-auto w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[10px] text-gray-500 leading-snug mb-2">
        位置情報が許可されない環境向け。座標を指定すると、その地点を「現在地」として扱い、近くの場を生成します。
      </p>

      {/* 現在地表示 */}
      <div className="flex items-center gap-1 text-[11px] text-gray-600 mb-2">
        <MapPin className="w-3 h-3 text-fuchsia-500 shrink-0" />
        <span className="tabular-nums">現在地 {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
      </div>

      {/* 座標入力 */}
      <div className="flex items-center gap-1.5 mb-2">
        <label className="flex-1">
          <span className="block text-[9px] font-black text-gray-400 mb-0.5">緯度 (lat)</span>
          <input
            type="number"
            step="0.0001"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2 py-1.5 text-[12px] text-gray-900 tabular-nums focus:outline-none focus:border-fuchsia-500"
          />
        </label>
        <label className="flex-1">
          <span className="block text-[9px] font-black text-gray-400 mb-0.5">経度 (lng)</span>
          <input
            type="number"
            step="0.0001"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2 py-1.5 text-[12px] text-gray-900 tabular-nums focus:outline-none focus:border-fuchsia-500"
          />
        </label>
      </div>

      <button
        onClick={apply}
        className="w-full flex items-center justify-center gap-1.5 bg-fuchsia-600 text-white text-[12px] font-black py-2 rounded-lg hover:bg-fuchsia-500 active:scale-[0.99] transition-all cursor-pointer mb-2"
      >
        <Crosshair className="w-3.5 h-3.5" /> この座標を現在地にする
      </button>

      {/* プリセット */}
      <p className="text-[9px] font-black text-gray-400 mb-1">クイックジャンプ</p>
      <div className="flex flex-wrap gap-1 mb-2">
        {DEBUG_PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => { setLat(p.lat.toFixed(6)); setLng(p.lng.toFixed(6)); onApply({ lat: p.lat, lng: p.lng }); }}
            className="text-[11px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-fuchsia-100 hover:text-fuchsia-700 transition-colors cursor-pointer"
          >
            📍 {p.name}
          </button>
        ))}
      </div>

      {/* 無効化 */}
      <button
        onClick={() => { setDebugEnabled(false); onDisable(); }}
        className="w-full text-[11px] font-bold text-gray-400 hover:text-gray-600 py-1.5 cursor-pointer"
      >
        デバッグモードを終了
      </button>
    </div>
  );
}
