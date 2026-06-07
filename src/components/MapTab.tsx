'use client';

import React, { useEffect, useState } from 'react';
import { Compass, ChevronRight, Flag, X, Camera, Check } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Spot, User, db } from '../lib/db';
import { haptic } from '../lib/haptics';
import { getHeartVoices } from '../data/god-tasks';
import { Challenge, ChallengeStep, difficultyLabel, TRIVIA_TONE, TRIVIA_ICON } from '../data/challenges';

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
  onOpenDetail?: (spot: Spot) => void; // タップで寺の詳細ページを開く
  activeChallenge?: Challenge | null; // 今挑戦中のチャレンジ（上部バナー＋ゴール表示）
  onClearChallenge?: () => void;
  onAdvanceChallenge?: (stepId: string, photo?: string | null) => void; // 次の目的地ステップを達成（証拠写真つき）
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
  onNavigateTab,
  onOpenDetail,
  activeChallenge,
  onClearChallenge,
  onAdvanceChallenge,
}: MapTabProps) {
  const displaySpots = spots;

  // Compute UGC counts per spot
  const allUgc = db.getUgc();
  const ugcCounts: { [spotId: string]: number } = {};
  spots.forEach((spot) => {
    ugcCounts[spot.id] = allUgc.filter((u) => u.spotId === spot.id).length;
  });


  // ── 心の声（神のつぶやき）を下部オーバーレイで：一文字ずつ・タスク交互 ──
  const [typed, setTyped] = useState('');
  const [msgIdx, setMsgIdx] = useState(0);

  // チャレンジ：証拠写真モーダル & 達成演出
  const [proofStep, setProofStep] = useState<ChallengeStep | null>(null);
  const [proofPhoto, setProofPhoto] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<{ title: string; icon: string; complete: boolean } | null>(null);

  const onPickProof = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    // 同じ画像を再選択しても onChange が発火するよう値をリセット（2回目が達成できない不具合の対策）
    e.target.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setProofPhoto(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(f);
  };

  const confirmProof = () => {
    if (!proofStep || !proofPhoto || !activeChallenge) return;
    // この達成で全ステップ完了になるか
    const doneNow = new Set(db.getChallengeProgress().done[activeChallenge.id] || []);
    const willComplete = doneNow.size + 1 >= activeChallenge.steps.length;
    haptic(willComplete ? 'celebrate' : 'success');
    onAdvanceChallenge?.(proofStep.id, proofPhoto);
    setCelebrate({
      title: willComplete ? `「${activeChallenge.badgeName}」獲得！` : `${proofStep.title} 達成！`,
      icon: willComplete ? activeChallenge.badgeIcon : '✅',
      complete: willComplete,
    });
    setProofStep(null);
    setProofPhoto(null);
    setTimeout(() => setCelebrate(null), 2600);
  };

  // activeSpot の心の声（SNS/ウェブ情報を模した時々の話題＋依頼）
  const voiceLines = activeSpot ? getHeartVoices(activeSpot) : [];
  const activeId = activeSpot?.id;

  // スポットが変わったらリセット
  useEffect(() => {
    setTyped('');
    setMsgIdx(0);
  }, [activeId]);

  // タイプライター＋メッセージ交互
  useEffect(() => {
    if (voiceLines.length === 0) return;
    const full = voiceLines[msgIdx % voiceLines.length];
    if (typed.length < full.length) {
      const id = setTimeout(() => setTyped(full.slice(0, typed.length + 1)), 70);
      return () => clearTimeout(id);
    }
    // 全部出たら少し待って次のタスクへ（交互）
    const id = setTimeout(() => {
      setMsgIdx((i) => i + 1);
      setTyped('');
    }, 2200);
    return () => clearTimeout(id);
  }, [typed, msgIdx, voiceLines]);

  // ── チャレンジ参加中：次の目的地・次の案内 ──
  const chProgress = activeChallenge ? db.getChallengeProgress() : null;
  const chDone = activeChallenge && chProgress ? new Set(chProgress.done[activeChallenge.id] || []) : null;
  const nextStep = activeChallenge && chDone ? activeChallenge.steps.find((s) => !chDone.has(s.id)) || null : null;
  const chAllDone = activeChallenge && chDone ? chDone.size >= activeChallenge.steps.length : false;
  // ゴールマーカーは「次の目的地」を指す（全達成なら最終ゴール）
  const challengeGoal = activeChallenge
    ? nextStep && nextStep.lat != null && nextStep.lng != null
      ? { lat: nextStep.lat, lng: nextStep.lng, name: nextStep.title }
      : { lat: activeChallenge.goalLat, lng: activeChallenge.goalLng, name: activeChallenge.goalName }
    : null;

  const activeDist = activeSpot ? getDistance(userLocation.lat, userLocation.lng, activeSpot.latitude, activeSpot.longitude) : 0;
  const activeNear = activeDist <= 1.0;
  const activeToku = activeSpot ? db.getSpotToku(activeSpot.id) : 0;
  const activeGodEmoji = activeSpot ? (activeSpot.godEmoji || (activeSpot.category === '神社' ? '⛩️' : '🙏')) : '⛩️';

  return (
    <div className="relative w-full h-full flex flex-col">
      
      {/* 1. Geographical Leaflet Map */}
      <div className="absolute inset-0 z-0">
        <LeafletMap
          spots={displaySpots}
          activeSpot={activeSpot}
          onSelectSpot={onSelectSpot}
          userLocation={userLocation}
          setUserLocation={setUserLocation}
          ugcCounts={ugcCounts}
          goal={challengeGoal}
        />
      </div>

      {/* 今挑戦中のチャレンジ（上部バナー） */}
      {activeChallenge && (
        <div className="absolute top-3 left-3 right-3 z-[1100] bg-[#2563eb] text-white rounded-full shadow-lg pl-4 pr-2 py-2 flex items-center gap-2">
          <h4 className="flex-1 min-w-0 text-[13px] font-black truncate">{activeChallenge.title}</h4>
          <button onClick={onClearChallenge} className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center flex-shrink-0 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/*
        3a. チャレンジ参加中の下部オーバーレイ（次の目的地・次の案内）
      */}
      {activeChallenge && !celebrate ? (
        <div className="absolute bottom-3 left-3 right-3 z-[1000] bg-white/97 backdrop-blur-md rounded-2xl shadow-xl border border-[#2563eb]/25 p-3">
          {chAllDone ? (
            <div className="flex items-center gap-3">
              <span className="text-3xl">{activeChallenge.badgeIcon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-gray-900">制覇！「{activeChallenge.badgeName}」獲得</p>
                <p className="text-[13px] text-gray-500">すべての目的地を巡りました。お疲れさま！</p>
              </div>
              <button onClick={onClearChallenge} className="text-[13px] font-black text-gray-500 bg-gray-100 px-3 py-2 rounded-full cursor-pointer">終了</button>
            </div>
          ) : nextStep ? (
            <>
              {/* 次の目的地 */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-[#2563eb]/10 flex items-center justify-center flex-shrink-0">
                  <Flag className="w-5 h-5 text-[#2563eb]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black tracking-wider text-[#2563eb]/70">次の目的地 ({(chDone?.size ?? 0) + 1}/{activeChallenge.steps.length})</p>
                  <h4 className="text-sm font-black text-gray-900 truncate">{nextStep.title}{nextStep.photo ? ' 📸' : ''}</h4>
                </div>
                {nextStep.lat != null && (
                  <span className="text-[13px] font-mono text-gray-500 flex-shrink-0">
                    {getDistance(userLocation.lat, userLocation.lng, nextStep.lat, nextStep.lng!).toFixed(1)}km
                  </span>
                )}
              </div>
              {/* 次の案内・蘊蓄（左右スワイプで切替） */}
              <div className="mt-2 flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-none">
                <div className="snap-center shrink-0 w-full flex items-start gap-2 bg-[#2563eb]/5 border border-[#2563eb]/15 rounded-xl px-3 py-2">
                  <Compass className="w-4 h-4 text-[#2563eb] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-black text-[#2563eb]/70 block">次の案内</span>
                    <p className="text-[13px] text-gray-800 leading-snug">{nextStep.action}</p>
                  </div>
                </div>
                {nextStep.trivia && nextStep.triviaCategory && (
                  <div className={`snap-center shrink-0 w-full text-[13px] rounded-xl border px-3 py-2 ${TRIVIA_TONE[nextStep.triviaCategory]}`}>
                    <span className="font-black">{TRIVIA_ICON[nextStep.triviaCategory]} {nextStep.triviaCategory}の蘊蓄</span>
                    <p className="mt-0.5 leading-relaxed">{nextStep.trivia}</p>
                  </div>
                )}
              </div>
              {nextStep.trivia && (
                <p className="text-[13px] text-gray-400 text-center mt-1">← スワイプで案内／蘊蓄 →</p>
              )}
              {/* アクション（達成には証拠写真が必要） */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => { setProofStep(nextStep); setProofPhoto(null); }}
                  className="flex-1 bg-[#2563eb] text-white text-xs font-black py-2 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />証拠写真を撮って達成
                </button>
                <button onClick={onClearChallenge} className="text-[13px] font-black text-gray-400 px-2 py-2 cursor-pointer">中断</button>
              </div>
            </>
          ) : null}
        </div>
      ) : !celebrate && activeSpot && (
        <div
          onClick={() => onOpenDetail?.(activeSpot)}
          className="absolute bottom-3 left-3 right-3 z-[1000] bg-white/97 backdrop-blur-md rounded-2xl shadow-xl border border-[#2563eb]/15 p-3 cursor-pointer active:scale-[0.99] transition-all"
        >
          {/* 上段：写真（無ければNO IMAGE）＋名称＋徳＋距離 */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl flex-shrink-0 border border-black/5 bg-gray-100 flex items-center justify-center relative overflow-hidden">
              {activeSpot.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeSpot.imageUrl} alt={activeSpot.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[11px] font-black text-gray-400 tracking-wider">NO IMAGE</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-black text-sm text-[#1e2024] truncate">{activeSpot.name}</h4>
                <span className="text-[13px] font-mono text-gray-500 whitespace-nowrap">{activeDist.toFixed(1)} km</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[13px] font-black text-[#2563eb] bg-[#2563eb]/10 px-1.5 py-0.5 rounded-full">徳 {activeToku.toLocaleString()}</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
          </div>

          {/* 心の声（神のつぶやき・一文字ずつ） */}
          <div className="mt-2.5 flex items-start gap-2 bg-[#2563eb]/5 border border-[#2563eb]/15 rounded-xl px-3 py-2">
            <span className="text-base leading-none mt-0.5">{activeGodEmoji}</span>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-black tracking-[0.15em] text-[#2563eb]/70 block">― 心の声 ―</span>
              {/* 常に2行分の高さを確保（1行⇔2行でぶれない） */}
              <p className="text-[13px] text-gray-800 italic leading-snug h-[2.9em] overflow-hidden">
                {typed}<span className="animate-pulse">▌</span>
              </p>
            </div>
          </div>

          {activeNear && (
            <div className="flex items-center mt-2">
              <span className="bg-emerald-500/10 text-emerald-600 text-[13px] font-black px-2.5 py-1 rounded-lg">接近中 (AR可)</span>
            </div>
          )}
        </div>
      )}

      {/* 証拠写真モーダル（この目的地を達成するには写真が必要） */}
      {proofStep && (
        <div className="absolute inset-0 z-[2000] bg-black/50 flex items-end" onClick={() => { setProofStep(null); setProofPhoto(null); }}>
          <div className="w-full bg-white rounded-t-3xl p-4 pb-6 animate-in" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5"><Camera className="w-4 h-4 text-[#2563eb]" />証拠写真を撮影</h3>
            <p className="text-[13px] text-gray-500 mt-1">「{proofStep.title}」を達成するには、現地で証拠となる写真を撮影してください。</p>

            <div className="mt-3 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 aspect-video flex items-center justify-center">
              {proofPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={proofPhoto} alt="証拠写真" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[13px] text-gray-400">写真をまだ撮影していません</span>
              )}
            </div>

            <label className="mt-3 w-full flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 text-sm font-black py-2.5 rounded-xl cursor-pointer hover:bg-gray-200 transition-all">
              <Camera className="w-4 h-4" />{proofPhoto ? '撮り直す' : '写真を撮影 / 選択'}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickProof} />
            </label>

            <div className="flex gap-2 mt-2">
              <button onClick={() => { setProofStep(null); setProofPhoto(null); }} className="flex-1 bg-gray-100 text-gray-500 text-sm font-black py-2.5 rounded-xl cursor-pointer">やめる</button>
              <button onClick={confirmProof} disabled={!proofPhoto} className="flex-1 bg-[#2563eb] text-white text-sm font-black py-2.5 rounded-xl disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" />この写真で達成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 達成演出 */}
      {celebrate && (
        <div className="absolute inset-0 z-[2100] flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/30 celebrate-fade" />
          <div className="relative flex flex-col items-center celebrate-pop">
            <div className={`text-7xl mb-3 ${celebrate.complete ? 'animate-bounce' : ''}`}>{celebrate.icon}</div>
            <div className="bg-white rounded-2xl px-6 py-3 shadow-2xl text-center">
              <p className="text-[11px] font-black tracking-[0.2em] text-[#2563eb]">{celebrate.complete ? 'CHALLENGE COMPLETE' : 'STEP CLEAR'}</p>
              <p className="text-lg font-black text-gray-900 mt-0.5">{celebrate.title}</p>
            </div>
            {celebrate.complete && (
              <div className="mt-2 text-2xl celebrate-confetti">🎉 ✨ 🎊</div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
