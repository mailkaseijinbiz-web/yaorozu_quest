'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Compass, ChevronRight, Flag, X, Camera, Check, MapPin, Clock, Navigation2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Spot, User, db } from '../lib/db';
import { uploadImage } from '../lib/upload';
import { distanceKm, bearingDeg } from '../lib/geo';
import { getHeartVoices } from '../data/god-tasks';
import { Challenge, ChallengeStep, difficultyLabel, TRIVIA_TONE, TRIVIA_ICON, CHALLENGES, TriviaCategory } from '../data/challenges';
import { getLevelInfo } from '../data/levels';

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
  currentUser: User; // 近くのクエストカード表示・レベル判定用
  onStartChallenge?: (challengeId: string) => void; // 未参加時のカードから挑戦開始
}


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
  currentUser,
  onStartChallenge,
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
  const [uploadingProof, setUploadingProof] = useState(false);
  // 達成ビート（豆知識つき・手動で次へ）
  const [celebrate, setCelebrate] = useState<
    { title: string; icon: string; complete: boolean; trivia?: string; triviaCategory?: TriviaCategory } | null
  >(null);
  // 導入（プロローグ）を見せたチャレンジID
  const [introSeenId, setIntroSeenId] = useState<string | null>(null);
  // 導入の段階：0=精霊のセリフ（フキダシ）→ 1=ミッション情報（PROLOGUE）。同時には出さない
  const [introStep, setIntroStep] = useState(0);
  useEffect(() => { setIntroStep(0); }, [activeChallenge?.id]);
  // 精霊のセリフを一文字ずつ表示
  const [introTyped, setIntroTyped] = useState('');
  // 複数ステップのクエスト：上部に進捗ガイドのフキダシを常時表示し、次のすべきことを案内する
  const [briefTyped, setBriefTyped] = useState('');

  const onPickProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    // 同じ画像を再選択しても onChange が発火するよう値をリセット（2回目が達成できない不具合の対策）
    e.target.value = '';
    if (!f) return;
    setUploadingProof(true);
    try {
      const url = await uploadImage(f, `challenge-${activeChallenge?.id ?? 'x'}`);
      setProofPhoto(url);
    } catch {
      setProofPhoto(null);
    } finally {
      setUploadingProof(false);
    }
  };

  const confirmProof = () => {
    if (!proofStep || !proofPhoto || !activeChallenge) return;
    // この達成で全ステップ完了になるか
    const doneNow = new Set(db.getChallengeProgress().done[activeChallenge.id] || []);
    const willComplete = doneNow.size + 1 >= activeChallenge.steps.length;
    const cleared = proofStep;
    onAdvanceChallenge?.(cleared.id, proofPhoto);
    // 達成ビート：このステップで得た豆知識を“次の文章”として見せてから次へ進む
    setCelebrate({
      title: willComplete ? `「${activeChallenge.badgeName}」獲得！` : `${cleared.title} 達成！`,
      icon: willComplete ? activeChallenge.badgeIcon : '✅',
      complete: willComplete,
      trivia: cleared.trivia,
      triviaCategory: cleared.triviaCategory,
    });
    setProofStep(null);
    setProofPhoto(null);
    // 自動で閉じない（豆知識を読んでから手動で次へ）
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

  const activeDist = activeSpot ? distanceKm(userLocation.lat, userLocation.lng, activeSpot.latitude, activeSpot.longitude) : 0;
  const activeNear = activeDist <= 1.0;
  const activeToku = activeSpot ? db.getSpotToku(activeSpot.id) : 0;
  const activeGodEmoji = activeSpot ? (activeSpot.godEmoji || (activeSpot.category === '神社' ? '⛩️' : '🙏')) : '⛩️';

  // クエスト未参加時に下部へ出す「近くのクエスト」（未達成・解放優先・近い順）
  const userLevel = getLevelInfo(currentUser.totalToku).current.level;
  const completedChIds = db.getChallengeProgress().completed;
  const nearChallenge = [...CHALLENGES]
    .filter((c) => !completedChIds.includes(c.id))
    .map((c) => ({ c, d: distanceKm(userLocation.lat, userLocation.lng, c.goalLat, c.goalLng), ok: userLevel >= c.minLevel }))
    .sort((a, b) => (a.ok !== b.ok ? (a.ok ? -1 : 1) : a.d - b.d))[0]?.c ?? null;

  // 下部オーバーレイの高さを測り、現在地ボタンをその上端 +10px に置く
  const overlayElRef = useRef<HTMLElement | null>(null);
  const [overlayH, setOverlayH] = useState(196);
  useEffect(() => {
    const el = overlayElRef.current;
    if (!el) { setOverlayH(0); return; }
    const update = () => setOverlayH(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeChallenge?.id, nextStep?.id, !!nearChallenge, !!celebrate, chAllDone]);
  // bottom-3(12px) + オーバーレイ高さ + 余白10px
  const controlsBottom = overlayH > 0 ? overlayH + 12 + 10 : 210;

  // 「次の目的地」タップで地図を目的地中央へ寄せるためのトークン
  const [focusGoalToken, setFocusGoalToken] = useState(0);

  // 導入（プロローグ）表示中か。表示中はヘッダー/下部オーバーレイ/現在地ボタンを隠し、
  // 冒険開始時にそれぞれふわっと登場させる。
  const introShowing = !!activeChallenge && !celebrate && (chDone?.size ?? 0) === 0 && introSeenId !== activeChallenge.id;

  // 精霊のセリフを一文字ずつタイプ表示（フェーズ0）→ 読み終えたら自動でフェーズ1へ
  // チャレンジ開始直後にいきなり喋り出すと速すぎるので、少し溜めてから語り始める
  useEffect(() => {
    if (!(introShowing && introStep === 0 && activeChallenge)) { setIntroTyped(''); return; }
    const full = activeChallenge.description;
    setIntroTyped('');
    let i = 0;
    let typer: ReturnType<typeof setInterval> | null = null;
    let advance: ReturnType<typeof setTimeout> | null = null;
    const start = setTimeout(() => {
      typer = setInterval(() => {
        i += 1;
        setIntroTyped(full.slice(0, i));
        if (i >= full.length) { if (typer) clearInterval(typer); advance = setTimeout(() => setIntroStep(1), 1500); }
      }, 38);
    }, 800);
    return () => { clearTimeout(start); if (typer) clearInterval(typer); if (advance) clearTimeout(advance); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChallenge?.id, introStep, introShowing]);

  // フェーズ1（PROLOGUE）：ボタンを押さなくても3秒で自動的に冒険開始
  useEffect(() => {
    if (!(introShowing && introStep === 1 && activeChallenge)) return;
    const id = setTimeout(() => setIntroSeenId(activeChallenge.id), 3000);
    return () => clearTimeout(id);
  }, [introShowing, introStep, activeChallenge?.id]);

  // 複数ステップのクエストでは、上部の進捗ガイドをクエスト中ずっと表示する
  const showGuide = !!activeChallenge && activeChallenge.steps.length > 1 && !introShowing && !celebrate && !chAllDone && !!nextStep;
  useEffect(() => {
    if (!(showGuide && nextStep && activeChallenge)) { setBriefTyped(''); return; }
    const full = `次は「${nextStep.title}」へ。${nextStep.action}`;
    setBriefTyped('');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setBriefTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGuide, nextStep?.id]);

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
          controlsBottom={controlsBottom}
          focusGoalToken={focusGoalToken}
          hideControls={introShowing}
        />
      </div>

      {/* 今挑戦中のチャレンジ（上部バナー・左右端まで・開始時に上からふわっと） */}
      {activeChallenge && !introShowing && (
        <div className="quest-header-in absolute top-0 left-0 right-0 z-[1100] bg-[#2563eb] text-white shadow-lg px-4 py-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-black bg-white/25 px-2 py-0.5 rounded-full flex-shrink-0">
            <Flag className="w-2.5 h-2.5" />挑戦中
          </span>
          <h4 className="flex-1 min-w-0 text-sm font-black truncate">{activeChallenge.title}</h4>
          <button onClick={onClearChallenge} aria-label="チャレンジを終了" className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center flex-shrink-0 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 進捗ガイド（複数ステップ：上部に精霊のフキダシを常時表示し、次のすべきことを案内） */}
      {activeChallenge && showGuide && nextStep && (
        <div className="absolute top-0 left-0 right-0 z-[1200] px-4 pt-[68px] flex justify-center pointer-events-none">
          <div className="w-full max-w-sm flex items-start gap-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-orange-50 border-2 border-white shadow-lg flex items-center justify-center text-2xl flex-shrink-0">🦊</div>
            <div className="relative flex-1 bg-white rounded-2xl rounded-tl-sm shadow-xl px-4 py-3">
              <p className="text-[11px] font-black tracking-wider text-amber-600">道案内の精霊</p>
              <p className="text-sm text-gray-800 leading-relaxed mt-0.5 min-h-[3em]">{briefTyped}<span className="animate-pulse text-amber-500">▌</span></p>
            </div>
          </div>
        </div>
      )}

      {/*
        3a. チャレンジ参加中の下部オーバーレイ（次の目的地・次の案内）
      */}
      {activeChallenge && !celebrate && !introShowing ? (
        <div ref={(el) => { overlayElRef.current = el; }} className="quest-overlay-in absolute bottom-3 left-3 right-3 z-[1000] bg-white/97 backdrop-blur-md rounded-3xl shadow-xl p-3">
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
              {/* 次の目的地（タップで地図を目的地中央へ） */}
              <div
                onClick={() => setFocusGoalToken((t) => t + 1)}
                title="タップで目的地を地図の中央へ"
                className="flex items-center gap-2 cursor-pointer active:scale-[0.99] transition-transform"
              >
                <Flag className="w-6 h-6 text-[#2563eb] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black tracking-wider text-[#2563eb]/70">次の目的地 ({(chDone?.size ?? 0) + 1}/{activeChallenge.steps.length})</p>
                  <h4 className="text-sm font-black text-gray-900 truncate">{nextStep.title}{nextStep.photo ? ' 📸' : ''}</h4>
                </div>
                {nextStep.lat != null && (() => {
                  const d = distanceKm(userLocation.lat, userLocation.lng, nextStep.lat, nextStep.lng!);
                  const val = d < 1 ? `${Math.round(d * 1000)}` : d.toFixed(1);
                  const unit = d < 1 ? 'm' : 'km';
                  const brg = bearingDeg(userLocation.lat, userLocation.lng, nextStep.lat, nextStep.lng!);
                  // 近づくほど色が変わる：~50m以内=緑、~300m以内=橙、遠い=青
                  const color = d <= 0.05 ? 'text-emerald-500' : d <= 0.3 ? 'text-amber-500' : 'text-[#2563eb]';
                  return (
                    <span className={`font-black flex items-baseline gap-1 flex-shrink-0 ${color}`} style={{ transition: 'color 0.3s' }}>
                      <Navigation2 className="w-5 h-5 fill-current self-center" style={{ transform: `rotate(${brg}deg)`, transition: 'transform 0.3s ease-out' }} />
                      <span className="tabular-nums text-3xl leading-none">{val}</span>
                      <span className="text-sm font-bold">{unit}</span>
                    </span>
                  );
                })()}
              </div>
              {/* アクション（達成には証拠写真が必要）。次の案内は上部の進捗ガイドに集約 */}
              <div className="mt-3">
                <button
                  onClick={() => { setProofStep(nextStep); setProofPhoto(null); }}
                  className="w-full bg-[#2563eb] text-white text-[15px] font-black py-3 rounded-full hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4 flex-shrink-0" /><span className="truncate">{nextStep.title}</span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : !activeChallenge && !celebrate && nearChallenge ? (() => {
        const ch = nearChallenge;
        const diff = difficultyLabel(ch.difficulty);
        const d = distanceKm(userLocation.lat, userLocation.lng, ch.goalLat, ch.goalLng);
        const distVal = d < 1 ? `${Math.round(d * 1000)}` : d.toFixed(1);
        const distUnit = d < 1 ? 'm' : 'km';
        const levelOk = userLevel >= ch.minLevel;
        return (
          <button
            ref={(el) => { overlayElRef.current = el; }}
            onClick={() => onStartChallenge?.(ch.id)}
            className="absolute bottom-3 left-3 right-3 z-[1000] text-left bg-white/97 backdrop-blur-md rounded-2xl shadow-xl border border-black/5 overflow-hidden cursor-pointer active:scale-[0.99] transition-all"
          >
            <div className="flex items-stretch gap-3">
              <div className={`w-20 self-stretch rounded-l-2xl flex items-center justify-center text-4xl flex-shrink-0 ${!levelOk ? 'bg-gray-200 grayscale' : 'bg-gradient-to-br from-blue-100 to-amber-100'}`}>
                {!levelOk ? '🔒' : ch.badgeIcon}
              </div>
              <div className="flex-1 min-w-0 py-3">
                <span className="text-[10px] font-black tracking-wider text-[#2563eb]/70">近くのクエスト</span>
                <h4 className="text-sm font-black text-gray-900 truncate">{ch.title}</h4>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className={`text-[13px] font-black ${diff.text}`}>{diff.stars} {diff.label}</span>
                  <span className={`text-[13px] font-black ${levelOk ? 'text-gray-500' : 'text-rose-600'}`}>{levelOk ? '' : '🔒 '}Lv.{ch.minLevel}〜</span>
                  <span className="text-[13px] flex items-center gap-0.5 text-gray-400"><Clock className="w-3 h-3" />約{ch.estMinutes}分</span>
                  <span className="text-[13px] font-black flex items-center gap-0.5 text-[#2563eb]">
                    <MapPin className="w-3 h-3" /><span className="tabular-nums">{distVal}</span><span className="text-[11px]">{distUnit}</span>
                  </span>
                </div>
              </div>
              <div className="self-center pr-3 flex-shrink-0 text-[#2563eb]"><ChevronRight className="w-5 h-5" /></div>
            </div>
          </button>
        );
      })() : null}

      {/* 証拠写真モーダル（この目的地を達成するには写真が必要） */}
      {proofStep && (
        <div className="absolute inset-0 z-[2000] bg-black/50 flex items-end" onClick={() => { setProofStep(null); setProofPhoto(null); }}>
          <div className="w-full bg-white rounded-t-3xl p-4 pb-6 animate-in" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5"><Camera className="w-4 h-4 text-[#2563eb]" />証拠写真を撮影</h3>
            <p className="text-[13px] text-gray-500 mt-1">「{proofStep.title}」を達成するには、現地で証拠となる写真を撮影してください。</p>

            <div className="mt-3 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 aspect-video flex items-center justify-center">
              {uploadingProof ? (
                <span className="text-[13px] text-gray-400 animate-pulse">アップロード中…</span>
              ) : proofPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={proofPhoto} alt="証拠写真" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[13px] text-gray-400">写真をまだ撮影していません</span>
              )}
            </div>

            <label className={`mt-3 w-full flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 text-sm font-black py-2.5 rounded-xl transition-all ${uploadingProof ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:bg-gray-200'}`}>
              <Camera className="w-4 h-4" />{proofPhoto ? '撮り直す' : '写真を撮影 / 選択'}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickProof} disabled={uploadingProof} />
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

      {/* 達成ビート（案内役の精霊がコメント＋豆知識をフキダシで語る） */}
      {celebrate && (
        <div className="absolute inset-0 z-[2100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/45 celebrate-fade" onClick={() => { if (celebrate.complete) onClearChallenge?.(); setCelebrate(null); }} />
          <div className="relative celebrate-pop w-full max-w-sm">
            {/* 達成エンブレム */}
            <div className="text-center">
              <div className={`text-6xl ${celebrate.complete ? 'animate-bounce' : ''}`}>{celebrate.icon}</div>
              <p className="text-[11px] font-black tracking-[0.2em] text-white drop-shadow mt-1">{celebrate.complete ? 'CHALLENGE COMPLETE' : 'STEP CLEAR'}</p>
            </div>
            {/* 案内役の精霊＋フキダシ（コメント＋豆知識） */}
            <div className="flex items-end gap-2 mt-3">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-100 to-orange-50 border-2 border-white shadow-lg flex items-center justify-center text-3xl flex-shrink-0">🦊</div>
              <div className="relative flex-1 bg-white rounded-2xl rounded-bl-sm shadow-xl px-4 py-3">
                <p className="text-sm font-black text-gray-900">{celebrate.title}</p>
                {celebrate.trivia && celebrate.triviaCategory ? (
                  <div className={`mt-2 text-left rounded-xl px-3 py-2 ${TRIVIA_TONE[celebrate.triviaCategory]}`}>
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-black">
                      <span className="text-lg leading-none">{TRIVIA_ICON[celebrate.triviaCategory]}</span>
                      {celebrate.triviaCategory}の豆知識
                    </span>
                    <p className="mt-1 text-[13px] leading-relaxed">{celebrate.trivia}</p>
                  </div>
                ) : (
                  <p className="text-[13px] text-gray-600 mt-0.5">{celebrate.complete ? 'みごと制覇じゃ。よく歩いたのう！' : 'よくやった。次へ進もうぞ。'}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => { if (celebrate.complete) onClearChallenge?.(); setCelebrate(null); }}
              className="w-full mt-4 bg-[#2563eb] text-white text-[15px] font-black py-3 rounded-full hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer"
            >
              {celebrate.complete ? 'クエストを終える' : '次の目的地へ →'}
            </button>
            {celebrate.complete && (
              <div className="mt-2 text-2xl celebrate-confetti text-center">🎉 ✨ 🎊</div>
            )}
          </div>
        </div>
      )}

      {/* 導入（プロローグ）：案内役の精霊がフキダシで物語を語ってから冒険へ */}
      {activeChallenge && !celebrate && (chDone?.size ?? 0) === 0 && introSeenId !== activeChallenge.id && (
        <div className="absolute inset-0 z-[2050] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/55" onClick={() => setIntroSeenId(activeChallenge.id)} />
          <div className="relative w-full max-w-sm celebrate-pop">
            {introStep === 0 ? (
              /* フェーズ0：案内役の精霊がフキダシでシナリオを一文字ずつ語る（中央センタリング・カードは出さない） */
              <div className="flex flex-col items-center text-center">
                {/* アイコン（中央） */}
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-100 to-orange-50 border-2 border-white shadow-lg flex items-center justify-center text-5xl">🦊</div>
                {/* フキダシ（上向きの尾・一文字ずつ・本文は左寄せ） */}
                <div className="relative mt-3 w-full bg-white rounded-3xl shadow-xl px-5 py-4 text-left">
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45"></div>
                  <p className="text-[11px] font-black tracking-wider text-amber-600">道案内の精霊</p>
                  <p className="text-sm text-gray-800 leading-relaxed mt-1 min-h-[4.5em]">{introTyped}<span className="animate-pulse text-amber-500">▌</span></p>
                </div>
              </div>
            ) : (
              /* フェーズ1：ミッション情報（精霊のセリフは出さない・中央寄せ） */
              <div className="bg-white rounded-3xl shadow-xl p-5 text-center">
                <p className="text-[11px] font-black tracking-[0.2em] text-[#2563eb]/70">序章 — PROLOGUE</p>
                <h3 className="text-xl font-black text-gray-900 mt-1 leading-tight">{activeChallenge.title}</h3>
                <div className="flex items-center justify-center gap-3 mt-4 text-[13px] text-gray-500">
                  <span className={`font-black ${difficultyLabel(activeChallenge.difficulty).text}`}>{difficultyLabel(activeChallenge.difficulty).stars} {difficultyLabel(activeChallenge.difficulty).label}</span>
                  <span className="flex items-center gap-0.5"><Clock className="w-3.5 h-3.5" />約{activeChallenge.estMinutes}分</span>
                  <span>全{activeChallenge.steps.length}ミッション</span>
                </div>
                {/* ボタン無しで3秒後に自動で冒険開始（進捗バー） */}
                <div className="mt-5 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#2563eb] rounded-full" style={{ animation: 'intro-auto 3s linear forwards' }} />
                </div>
                <p className="text-[11px] font-bold text-gray-400 mt-2">まもなく冒険がはじまる…</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
