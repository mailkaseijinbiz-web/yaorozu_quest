'use client';

// 御朱印の授与式オーバーレイ（共通）
// -----------------------------------------------------------------------------
// 神の固有の姿（YaorozuSpirit）＋朱印スタンプが押される祝祭演出。
//   - SpotDetail: 実地/遥拝で神に会ったとき（variant 'near' / 'far'）
//   - OnboardingFlow: 初回の「旅立ちの御朱印」をゼロ距離で授けるとき（variant 'origin'）
// position は埋め込み先で変える: SpotDetail は端末フレーム内なので 'absolute'、
// オンボーディングは全画面なので 'fixed'。
// -----------------------------------------------------------------------------

import React, { useEffect } from 'react';
import YaorozuSpirit from './YaorozuSpirit';

export type GoshuinVariant = 'near' | 'far' | 'origin';

interface GoshuinCelebrateProps {
  /** YaorozuSpirit の姿を決めるシード（神名 or 場名） */
  seed: string;
  /** 朱印スタンプ中央の絵文字 */
  godEmoji: string;
  /** 朱印スタンプ下部の小さなラベル（神名） */
  stampLabel: string;
  /** 見出しに使う場の名前 */
  spotName: string;
  variant: GoshuinVariant;
  /** 「※公式のものではありません」を出すか（実在スポットは true、旅立ちは false） */
  unofficial?: boolean;
  /** 埋め込み先に応じた配置（既定 'absolute'） */
  position?: 'absolute' | 'fixed';
  /** 閉じるボタンのラベル（既定「閉じる」。オンボでは「つぎへ」） */
  closeLabel?: string;
  onClose: () => void;
  /** 指定時のみ「御朱印帳を見る」ボタンを出す */
  onOpenBook?: () => void;
}

const BADGE: Record<GoshuinVariant, { label: string; cls: string }> = {
  near: { label: '⛩️ 参拝の証', cls: 'bg-emerald-50 text-emerald-700' },
  far: { label: '🌫️ 遥拝の証', cls: 'bg-sky-50 text-sky-700' },
  origin: { label: '🦊 旅立ちの証', cls: 'bg-amber-50 text-amber-700' },
};

export default function GoshuinCelebrate({
  seed,
  godEmoji,
  stampLabel,
  spotName,
  variant,
  unofficial = true,
  position = 'absolute',
  closeLabel = '閉じる',
  onClose,
  onOpenBook,
}: GoshuinCelebrateProps) {
  const badge = BADGE[variant];
  const description =
    variant === 'origin'
      ? '旅の始まりの証。ここから、街の神々を訪ねる小さな巡礼が始まる。'
      : '御朱印帳にこの出会いが刻まれた。集めるほど旅の物語が増えていく。';

  return (
    <div className={`${position} inset-0 z-[3300] flex items-center justify-center p-6`} onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative celebrate-pop w-full max-w-[300px] bg-white rounded-3xl shadow-2xl px-6 py-6 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="text-[11px] font-black tracking-[0.25em] text-rose-500">GOSHUIN GET!</p>
        {/* 神の姿（シードから決定論的に生成される、この神だけの姿） */}
        <div className="mt-2 flex justify-center">
          <YaorozuSpirit seed={seed} size={92} />
        </div>
        {/* 朱印スタンプが押される */}
        <div className="relative mx-auto mt-2 w-24 h-24 stamp-in">
          <div className="absolute inset-0 rounded-full border-4 border-rose-600/80" />
          <div className="absolute inset-1.5 rounded-full border-2 border-rose-600/40" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span className="text-2xl leading-none">{godEmoji}</span>
            <span className="text-[8px] font-black text-rose-700 text-center leading-tight px-1.5" style={{ maxWidth: 80 }}>{stampLabel}</span>
          </div>
        </div>
        <h3 className="text-base font-black text-gray-900 mt-3 leading-snug">{spotName}の御朱印を授かった</h3>
        <p className={`inline-block text-[12px] font-black mt-1.5 px-2.5 py-0.5 rounded-full ${badge.cls}`}>
          {badge.label}
        </p>
        <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">{description}</p>
        {unofficial && <p className="text-[10px] text-gray-400 mt-1.5">※この御朱印は公式のものではありません</p>}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-600 text-[14px] font-black py-3 rounded-full hover:bg-gray-200 cursor-pointer"
          >
            {closeLabel}
          </button>
          {onOpenBook && (
            <button
              onClick={onOpenBook}
              className="flex-1 bg-shrine-red text-white text-[14px] font-black py-3 rounded-full hover:opacity-90 cursor-pointer"
            >
              御朱印帳を見る
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
