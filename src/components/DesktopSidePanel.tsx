'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { MapPin, Sparkles, Stamp, Footprints, Navigation2, Smartphone } from 'lucide-react';
import type { User } from '../lib/db';
import { getLevelInfo } from '../data/levels';

interface DesktopSidePanelProps {
  currentUser: User | null;
  userLocation: { lat: number; lng: number };
  geoStatus: 'locating' | 'ok' | 'denied' | 'error';
  nearbyCount: number; // 現在地周辺の場の数
  goshuinCount: number;
}

/**
 * 大画面（lg〜）で電話枠の左に置く案内パネル。
 * 横長スペースを活かし、ロゴ・説明・現在地/巡礼の進捗などのライブ情報を見せる。
 * モバイル幅・低い画面では非表示（hidden deskpanel:flex＝幅1024px以上かつ高さ720px以上）。
 * 本体の操作はあくまで右の電話枠で行う。
 */
export default function DesktopSidePanel({
  currentUser,
  userLocation,
  geoStatus,
  nearbyCount,
  goshuinCount,
}: DesktopSidePanelProps) {
  const lv = currentUser ? getLevelInfo(currentUser.totalToku) : null;
  const pct = lv ? Math.round(lv.progress * 100) : 0;

  // PC では現在のURLをQRコード化し、スマホで読み取ってそのまま続きを遊べるようにする。
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    QRCode.toDataURL(window.location.origin, {
      width: 320,
      margin: 1,
      color: { dark: '#1f2937', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, []);

  const geoLabel =
    geoStatus === 'ok'
      ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`
      : geoStatus === 'locating'
      ? '現在地を取得中…'
      : geoStatus === 'denied'
      ? '位置情報が許可されていません'
      : '現在地を取得できませんでした';

  return (
    <aside className="hidden deskpanel:flex flex-col justify-center w-[340px] h-[min(840px,calc(100dvh-3rem))] shrink-0 z-10 select-none">
      {/* ブランド */}
      <div className="px-2">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-shrine-red to-[#ff7a00] flex items-center justify-center text-3xl shadow-lg shadow-shrine-red/20">
            ⛩️
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800 leading-tight tracking-tight">八百万クエスト</h1>
            <p className="text-[12px] font-bold text-gray-400">YAOROZU QUEST</p>
          </div>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-gray-500">
          実在の神社・お寺をめぐり、その地に宿る<span className="font-bold text-gray-700">八百万の神</span>と語らい、
          クエストをこなして<span className="font-bold text-shrine-red">徳</span>を積む位置情報の巡礼ゲーム。
        </p>
      </div>

      {/* 巡礼者ステータス（ログイン中のみ） */}
      {currentUser && lv && (
        <div className="mt-6 mx-2 rounded-2xl bg-white shadow-sm border border-black/5 p-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentUser.avatarUrl}
              alt="アカウントのアイコン"
              className="w-12 h-12 rounded-full object-cover border-2 border-shrine-red/30"
            />
            <div className="min-w-0">
              <p className="text-[13px] font-black text-gray-800 truncate">{currentUser.displayName}</p>
              <p className="text-[11px] font-bold text-gray-400 truncate">
                Lv.{lv.current.level}・{lv.current.title}
              </p>
            </div>
          </div>

          {/* 徳の進捗 */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="flex items-center gap-1 font-bold text-gray-500">
                <Sparkles className="w-3 h-3 text-shrine-red" />徳 {currentUser.totalToku}
              </span>
              {lv.next ? (
                <span className="text-gray-400">次の称号まで {lv.tokuToNext}</span>
              ) : (
                <span className="text-gray-400">最高位</span>
              )}
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-shrine-red to-[#ff7a00] rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* カウンタ */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-gray-50 px-3 py-2 flex items-center gap-2">
              <Stamp className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-[12px] font-bold text-gray-600">御朱印 {goshuinCount}</span>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2 flex items-center gap-2">
              <Footprints className="w-4 h-4 text-sky-600 shrink-0" />
              <span className="text-[12px] font-bold text-gray-600">近くの場 {nearbyCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* 現在地 */}
      <div className="mt-4 mx-2 rounded-2xl bg-white shadow-sm border border-black/5 p-4">
        <div className="flex items-center gap-2 text-[12px] font-bold text-gray-500">
          <span className={`relative flex w-2.5 h-2.5 ${geoStatus === 'ok' ? '' : 'opacity-60'}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${geoStatus === 'ok' ? 'bg-emerald-500' : geoStatus === 'locating' ? 'bg-amber-400 animate-pulse' : 'bg-gray-300'}`} />
          </span>
          現在地
        </div>
        <div className="mt-1.5 flex items-start gap-1.5 text-[13px] text-gray-700">
          <MapPin className="w-4 h-4 text-shrine-red shrink-0 mt-0.5" />
          <span className="font-bold break-all">{geoLabel}</span>
        </div>
      </div>

      {/* PCでの遊び方ヒント */}
      <div className="mt-4 mx-2 rounded-2xl bg-sky-50/70 border border-sky-100 p-4">
        <p className="flex items-center gap-1.5 text-[12px] font-black text-sky-700">
          <Navigation2 className="w-3.5 h-3.5" />PCでの操作
        </p>
        <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-gray-500 list-disc pl-4">
          <li>右の画面の下部タブで「クエスト・マップ・記録・御朱印・マイページ」を切り替え。</li>
          <li>地図は <span className="font-bold text-gray-700">ドラッグで移動・Shift+ドラッグで回転</span>。</li>
          <li>位置情報を許可すると、近くの神社・お寺に神様が現れます。</li>
        </ul>
      </div>

      {/* スマホで開くQRコード（位置情報を使うため、スマホでの体験を推奨） */}
      <div className="mt-4 mx-2 rounded-2xl bg-white shadow-sm border border-black/5 p-4 flex items-center gap-4">
        <div className="shrink-0 w-24 h-24 rounded-xl bg-white border border-black/5 p-1.5 flex items-center justify-center overflow-hidden">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="このアプリを開くQRコード" className="w-full h-full object-contain" />
          ) : (
            <Smartphone className="w-8 h-8 text-gray-300" />
          )}
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[12px] font-black text-gray-700">
            <Smartphone className="w-3.5 h-3.5 text-shrine-red" />スマホで読み取る
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
            位置情報を使うため、<span className="font-bold text-gray-700">スマートフォンでの体験を推奨</span>しています。QRを読み取って続きを。
          </p>
        </div>
      </div>
    </aside>
  );
}
