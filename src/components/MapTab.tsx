'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Compass, ChevronRight, Flag, X, Camera, Check, MapPin, Clock, Navigation2, MessageCircle, Send } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Spot, User, db } from '../lib/db';
import { uploadImage } from '../lib/upload';
import { hasGoShuin } from '../lib/goshuin';
import { distanceKm, bearingDeg } from '../lib/geo';
import { getHeartVoices } from '../data/god-tasks';
import { Challenge, ChallengeStep, difficultyLabel, TRIVIA_TONE, TRIVIA_ICON, TriviaCategory } from '../data/challenges';

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#07090e] flex flex-col items-center justify-center text-xs text-gray-500">
      <Compass className="w-8 h-8 text-gold animate-spin-slow mb-2" />
      八百万マップを展開中...
    </div>
  ),
});

// 道案内の精霊のセリフ。
// near=false（遠い）：土地の紹介 → 歩いて向かおう、という案内。
// near=true（500m以内）：到着間近 → さあ撮影しよう、という流れに切り替える。
function composeGuideText(step: ChallengeStep, near = false): string {
  if (near) {
    return '目的地はもう目の前。あたりをゆっくり見回して、心に残る一枚を写真におさめてみよう。';
  }
  const intro = step.trivia ? step.trivia : '';
  const action = step.action ?? '';
  const alreadyPhoto = /写真|一枚|撮|収め|おさめ/.test(action);
  const photoLine = alreadyPhoto ? '' : 'そして、心に残った風景を一枚、写真におさめてみよう。';
  return `${intro}${action}${photoLine}`;
}

type GuideMsg = { role: 'spirit' | 'user'; text: string };

// 現在のクエスト進捗から、精霊が語ってきた会話ログを再構成する（序章→現在の目的地まで）。
function buildGuideLog(ch: Challenge, doneIds: Set<string>): GuideMsg[] {
  const msgs: GuideMsg[] = [{ role: 'spirit', text: ch.description }];
  let cur = ch.tasks.findIndex((s) => !doneIds.has(s.id));
  if (cur === -1) cur = ch.tasks.length - 1;
  for (let i = 0; i <= cur; i++) msgs.push({ role: 'spirit', text: composeGuideText(ch.tasks[i]) });
  return msgs;
}

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
  currentUser: User; // 近くの場カード表示用
  onMapMove?: (center: { lat: number; lng: number }) => void; // 地図を移動させたとき（アクティビティログ用）
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
  onMapMove,
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
  const [proofComment, setProofComment] = useState(''); // 証拠写真に添えるコメント
  const [uploadingProof, setUploadingProof] = useState(false);
  // 達成ビート（豆知識つき・手動で次へ）
  const [celebrate, setCelebrate] = useState<
    { title: string; icon: string; complete: boolean; trivia?: string; triviaCategory?: TriviaCategory } | null
  >(null);
  // 導入（プロローグ）を見せたチャレンジID。タブ切替でアンマウントされても消えないよう localStorage に永続化。
  const [introSeenId, setIntroSeenId] = useState<string | null>(() => {
    try { return localStorage.getItem('yaorozu_intro_seen'); } catch { return null; }
  });
  const markIntroSeen = (id: string) => {
    try { localStorage.setItem('yaorozu_intro_seen', id); } catch {}
    setIntroSeenId(id);
  };
  // 導入の段階：0=精霊のセリフ（フキダシ）→ 1=ミッション情報（PROLOGUE）。同時には出さない
  const [introStep, setIntroStep] = useState(0);
  useEffect(() => { setIntroStep(0); }, [activeChallenge?.id]);
  // 精霊のセリフを一文字ずつ表示
  const [introTyped, setIntroTyped] = useState('');
  // 複数ステップのクエスト：上部に進捗ガイドのフキダシを常時表示し、次のすべきことを案内する
  const [briefTyped, setBriefTyped] = useState('');
  // 目的地が遠い（500m以上）のに達成を押したときの注意表示
  const [farNotice, setFarNotice] = useState(false);
  // 上部ガイド（語り部）の読み上げが終わったか。終わってから下部オーバーレイを出す
  const [guideDone, setGuideDone] = useState(false);
  // 道案内の精霊との会話（狐アイコンのタップでログ閲覧＋参加）
  const [chatOpen, setChatOpen] = useState(false);
  const [chatExtra, setChatExtra] = useState<GuideMsg[]>([]); // 参加（ユーザー⇄精霊）の追加分
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  // 上部ガイドのフキダシ本文（3行＋スクロール）の自動スクロール用
  const guideScrollRef = useRef<HTMLDivElement | null>(null);

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
    const willComplete = doneNow.size + 1 >= activeChallenge.tasks.length;
    const cleared = proofStep;
    // 証拠写真に添えるコメントを保存
    if (proofComment.trim()) db.saveChallengeComment(activeChallenge.id, cleared.id, proofComment);
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
    setProofComment('');
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
  const nextStep = activeChallenge && chDone ? activeChallenge.tasks.find((s) => !chDone.has(s.id)) || null : null;
  const chAllDone = activeChallenge && chDone ? chDone.size >= activeChallenge.tasks.length : false;
  // 次の目的地までの距離（500m以内で達成可能。圏外は達成ボタンをグレイに）
  const nextDist =
    nextStep && nextStep.lat != null && nextStep.lng != null
      ? distanceKm(userLocation.lat, userLocation.lng, nextStep.lat, nextStep.lng)
      : null;
  const tooFar = nextDist != null && nextDist >= 0.5;
  const near = nextDist != null && nextDist < 0.5; // 500m以内＝到着間近
  // 挑戦中の神のアイコン（クエストを鋳造した神→次の目的地の場の神→選択中の神→既定）。目的地マーカーの青い丸に表示する。
  const challengeGodEmoji = activeChallenge
    ? ((activeChallenge.spotId ? db.getSpot(activeChallenge.spotId)?.godEmoji : undefined)
        || (nextStep?.spotId ? db.getSpot(nextStep.spotId)?.godEmoji : undefined)
        || activeSpot?.godEmoji
        || '⛩️')
    : undefined;
  // ゴールマーカーは「次の目的地」を指す（全達成なら最終ゴール）
  const challengeGoal = activeChallenge
    ? nextStep && nextStep.lat != null && nextStep.lng != null
      ? { lat: nextStep.lat, lng: nextStep.lng, name: nextStep.title, godEmoji: challengeGodEmoji }
      : { lat: activeChallenge.goalLat, lng: activeChallenge.goalLng, name: activeChallenge.goalName, godEmoji: challengeGodEmoji }
    : null;

  const activeDist = activeSpot ? distanceKm(userLocation.lat, userLocation.lng, activeSpot.latitude, activeSpot.longitude) : 0;
  const activeNear = activeDist <= 1.0;
  const activeToku = activeSpot ? db.getSpotToku(activeSpot.id) : 0;
  const activeGodEmoji = activeSpot ? (activeSpot.godEmoji || (activeSpot.category === '神社' ? '⛩️' : '🙏')) : '⛩️';

  // ── インタラクティブカード（Interactive Card） ──
  // マップ下部に出る「近くの場」カードの領域。クエスト未参加時に表示し、
  // 横スワイプで次の場へ切替、タップでその場の詳細を開く（近い順）。
  const nearSpotList = [...spots]
    .map((s) => ({ s, d: distanceKm(userLocation.lat, userLocation.lng, s.latitude, s.longitude) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 10)
    .map((x) => x.s);
  // 表示中のカード位置（スワイプで移動）
  const [cardIndex, setCardIndex] = useState(0);
  // スワイプでカードが変わったら、対応する場所へ地図を寄せるためのトークン
  const [cardFocusToken, setCardFocusToken] = useState(0);
  // 候補数が変わったら範囲内に収める
  useEffect(() => { setCardIndex((i) => Math.min(i, Math.max(0, nearSpotList.length - 1))); }, [nearSpotList.length]);
  const nearSpot = nearSpotList[Math.min(cardIndex, nearSpotList.length - 1)] ?? null;
  // 横スワイプ検出（スワイプ直後のタップで誤って開始しないよう swipedRef でガード）
  const swipeStartXRef = useRef<number | null>(null);
  const swipedRef = useRef(false);
  const onCardTouchStart = (e: React.TouchEvent) => { swipeStartXRef.current = e.touches[0]?.clientX ?? null; swipedRef.current = false; };
  const onCardTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStartXRef.current;
    swipeStartXRef.current = null;
    if (start == null || nearSpotList.length <= 1) return;
    const dx = (e.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(dx) <= 40) return;
    swipedRef.current = true; // スワイプ後のタップ誤爆を防ぐ
    // カードが実際に変わるときだけ地図を対応する場所へ寄せる（端では動かさない）
    if (dx < 0 && cardIndex < nearSpotList.length - 1) { setCardIndex(cardIndex + 1); setCardFocusToken((t) => t + 1); }
    else if (dx > 0 && cardIndex > 0) { setCardIndex(cardIndex - 1); setCardFocusToken((t) => t + 1); }
  };

  // 導入（プロローグ）表示中か。表示中はヘッダー/下部オーバーレイ/現在地ボタンを隠す。
  const introShowing = !!activeChallenge && !celebrate && (chDone?.size ?? 0) === 0 && introSeenId !== activeChallenge.id;

  // 下部オーバーレイの高さを測り、現在地ボタンをその上端 +10px に置く。
  // 導入終了・ガイド読み上げ完了でオーバーレイが遅れてマウントされるため、それらも依存に含めて再計測する。
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
  }, [activeChallenge?.id, nextStep?.id, !!nearSpot, !!celebrate, chAllDone, introShowing, guideDone]);
  // bottom-3(12px) + オーバーレイ高さ + 余白10px
  const controlsBottom = overlayH > 0 ? overlayH + 12 + 10 : 210;

  // 「次の目的地」タップで地図を目的地中央へ寄せるためのトークン
  const [focusGoalToken, setFocusGoalToken] = useState(0);

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
    const id = setTimeout(() => markIntroSeen(activeChallenge.id), 3000);
    return () => clearTimeout(id);
  }, [introShowing, introStep, activeChallenge?.id]);

  // 複数ステップのクエストでは、上部の進捗ガイドをクエスト中ずっと表示する
  const showGuide = !!activeChallenge && activeChallenge.tasks.length > 1 && !introShowing && !celebrate && !chAllDone && !!nextStep;
  useEffect(() => {
    if (!(showGuide && nextStep && activeChallenge)) { setBriefTyped(''); setGuideDone(false); return; }
    // 「次は『title』へ」ではなく、土地の紹介 → 現地で写真を撮ろう、という自然な語りにする。
    // 目的地名・距離は下部カードに表示するため、ここでは触れない。
    const full = composeGuideText(nextStep, near);
    setBriefTyped('');
    setGuideDone(false);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setBriefTyped(full.slice(0, i));
      if (i >= full.length) { clearInterval(id); setGuideDone(true); }
    }, 30);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGuide, nextStep?.id, near]);
  // タイプ中はフキダシ本文を最下部へ追従（3行枠内でスクロール）
  useEffect(() => {
    const el = guideScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [briefTyped]);

  // 「近づいてください」注意は、目的地が変わったとき/圏内に入ったときに消す
  useEffect(() => { setFarNotice(false); }, [nextStep?.id]);
  useEffect(() => { if (!tooFar) setFarNotice(false); }, [tooFar]);
  // 表示したら数秒で自動的に消す
  useEffect(() => {
    if (!farNotice) return;
    const id = setTimeout(() => setFarNotice(false), 2800);
    return () => clearTimeout(id);
  }, [farNotice]);

  // ── 道案内の精霊との会話（これまでの語りログ＋参加分）──
  const chatMessages: GuideMsg[] = activeChallenge
    ? [...buildGuideLog(activeChallenge, chDone ?? new Set<string>()), ...chatExtra]
    : [];
  // チャレンジが変わったら会話をリセット
  useEffect(() => { setChatExtra([]); setChatOpen(false); setChatInput(''); }, [activeChallenge?.id]);
  // 新着・送信中で最下部へスクロール
  useEffect(() => {
    if (!chatOpen) return;
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatOpen, chatExtra.length, chatSending]);

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatSending || !activeChallenge) return;
    setChatInput('');
    setChatExtra((prev) => [...prev, { role: 'user', text }]);
    setChatSending(true);
    try {
      const history = chatMessages.map((m) => ({ sender: m.role === 'user' ? 'user' : 'agent', text: m.text }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
          agent: {
            id: 'agent-guide-spirit',
            name: '道案内の精霊',
            systemPrompt: `あなたは「道案内の精霊」。狐の姿をした町歩きクエストの案内役です。いまは「${activeChallenge.title}」を巡る旅の途中。旅人に寄り添い、土地の歴史・地形・建築・道の蘊蓄を、やさしく簡潔に語ります。現在の目的地は「${nextStep?.title ?? '最終地点'}」。質問には親切に、200文字以内で、温かく少し古風な精霊らしい口調（「〜じゃ」「〜ぞ」）で答えてください。`,
            voiceTone: '案内役',
          },
          ugc: [],
          affiliates: [],
          userName: currentUser.displayName || '旅人',
          spot: { name: activeChallenge.title, category: 'クエスト', description: activeChallenge.description, enjoyments: [] },
        }),
      });
      const data = await res.json();
      setChatExtra((prev) => [...prev, { role: 'spirit', text: data?.response || '…（精霊は静かに微笑んでいる）' }]);
    } catch {
      setChatExtra((prev) => [...prev, { role: 'spirit', text: 'すまぬ、いまは声が届かぬようじゃ。もう一度試しておくれ。' }]);
    } finally {
      setChatSending(false);
    }
  };

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
          onMapMove={onMapMove}
          cardFocus={nearSpot ? { lat: nearSpot.latitude, lng: nearSpot.longitude } : null}
          cardFocusToken={cardFocusToken}
        />
      </div>

      {/* 今挑戦中のチャレンジ（上部バナー・左右端まで・開始時に上からふわっと） */}
      {activeChallenge && !introShowing && (
        <div className="quest-header-in absolute top-0 left-0 right-0 z-[1100] bg-[#2563eb] text-white shadow-lg px-4 py-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-black bg-white/25 px-2 py-0.5 rounded-full flex-shrink-0">
            <Flag className="w-2.5 h-2.5" />挑戦中
          </span>
          <h4 className="flex-1 min-w-0 text-sm font-black truncate">{activeChallenge.title}</h4>
          <button onClick={onClearChallenge} aria-label="チャレンジを中断" className="flex items-center gap-0.5 text-[11px] font-black bg-white/20 hover:bg-white/30 px-2 py-1 rounded-full flex-shrink-0 cursor-pointer transition-colors">
            中断<X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 進捗ガイド（複数ステップ：上部に精霊のフキダシを常時表示し、次のすべきことを案内） */}
      {activeChallenge && showGuide && nextStep && (
        <div className="absolute top-0 left-0 right-0 z-[1200] px-4 pt-[68px] flex justify-center pointer-events-none">
          <div className="w-full max-w-sm flex items-start gap-2">
            <button
              onClick={() => setChatOpen(true)}
              aria-label="道案内の精霊と話す"
              className="relative w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-orange-50 border-2 border-white shadow-lg flex items-center justify-center text-2xl flex-shrink-0 pointer-events-auto cursor-pointer active:scale-95 transition-transform"
            >
              🦊
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#2563eb] border-2 border-white flex items-center justify-center">
                <MessageCircle className="w-2.5 h-2.5 text-white" />
              </span>
            </button>
            <div className="relative flex-1 bg-white rounded-2xl rounded-tl-sm shadow-xl px-4 py-3">
              <p className="text-[11px] font-black tracking-wider text-amber-600">道案内の精霊</p>
              <div ref={guideScrollRef} className="mt-0.5 max-h-[4.4rem] overflow-y-auto pointer-events-auto pr-1">
                <p className="text-sm text-gray-800 leading-relaxed">{briefTyped}<span className="animate-pulse text-amber-500">▌</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/*
        3a. チャレンジ参加中の下部オーバーレイ（次の目的地・次の案内）
      */}
      {activeChallenge && !celebrate && !introShowing && (!showGuide || guideDone) ? (
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
                  <p className="text-[11px] font-black tracking-wider text-[#2563eb]/70">次の目的地 ({(chDone?.size ?? 0) + 1}/{activeChallenge.tasks.length})</p>
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
              {/* アクション。御朱印タスクは写真・距離ゲートなし（会話で授かって達成）。その他は証拠写真＋500m以内。 */}
              <div className="mt-3">
                {nextStep.type === 'goshuin' ? (
                  <button
                    onClick={() => {
                      const held = nextStep.spotId ? hasGoShuin(currentUser.id, nextStep.spotId) : false;
                      if (held) {
                        const doneNow = new Set(db.getChallengeProgress().done[activeChallenge!.id] || []);
                        const willComplete = doneNow.size + 1 >= activeChallenge!.tasks.length;
                        onAdvanceChallenge?.(nextStep.id, null);
                        setCelebrate({
                          title: willComplete ? `「${activeChallenge!.badgeName}」獲得！` : `${nextStep.title} 達成！`,
                          icon: willComplete ? activeChallenge!.badgeIcon : '🔴',
                          complete: willComplete, trivia: nextStep.trivia, triviaCategory: nextStep.triviaCategory,
                        });
                      } else {
                        // 未取得 → 神のページ（会話タブ）を開いて授かりに行く
                        const target = (nextStep.spotId ? spots.find((s) => s.id === nextStep.spotId) : null) ?? activeSpot;
                        if (target) onOpenDetail?.(target);
                      }
                    }}
                    className="w-full text-[15px] font-black py-3 rounded-full transition-all cursor-pointer flex items-center justify-center gap-2 bg-[#2563eb] text-white hover:opacity-90 active:scale-[0.99]"
                  >
                    <MessageCircle className="w-4 h-4" />御朱印をもらいに行く
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (tooFar) { setFarNotice(true); return; }
                      setProofStep(nextStep); setProofPhoto(null);
                    }}
                    className={`w-full text-[15px] font-black py-3 rounded-full transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      tooFar ? 'bg-gray-200 text-gray-400' : 'bg-[#2563eb] text-white hover:opacity-90 active:scale-[0.99]'
                    }`}
                  >
                    <Camera className="w-4 h-4" />証拠写真を撮影
                  </button>
                )}
                {farNotice && tooFar && nextStep.type !== 'goshuin' && (
                  <p className="text-center text-[12px] font-black text-rose-500 mt-2">📍 目的地に近づいてください（500m以内で達成できます）</p>
                )}
              </div>
            </>
          ) : null}
        </div>
      ) : !activeChallenge && !celebrate && nearSpot ? (() => {
        // ▼ インタラクティブカード（Interactive Card）：近くの場を提示し、タップで詳細を開く
        const spot = nearSpot;
        const d = distanceKm(userLocation.lat, userLocation.lng, spot.latitude, spot.longitude);
        const distVal = d < 1 ? `${Math.round(d * 1000)}` : d.toFixed(1);
        const distUnit = d < 1 ? 'm' : 'km';
        const godEmoji = spot.godEmoji || (spot.category === '神社' ? '⛩️' : '🙏');
        const held = hasGoShuin(currentUser.id, spot.id); // この場の御朱印を授かり済みか
        const ugc = ugcCounts[spot.id] ?? 0;
        return (
          <div
            ref={(el) => { overlayElRef.current = el; }}
            role="button"
            tabIndex={0}
            onTouchStart={onCardTouchStart}
            onTouchEnd={onCardTouchEnd}
            onClick={() => { if (swipedRef.current) { swipedRef.current = false; return; } onSelectSpot(spot); }}
            className="absolute bottom-3 left-3 right-3 z-[1000] text-left bg-white/97 backdrop-blur-md rounded-2xl shadow-xl border border-black/5 overflow-hidden cursor-pointer active:scale-[0.99] transition-all touch-pan-y"
          >
            <div className="flex items-stretch gap-3">
              <div className="w-20 self-stretch rounded-l-2xl flex items-center justify-center text-4xl flex-shrink-0 bg-gradient-to-br from-blue-100 to-amber-100">
                {godEmoji}
              </div>
              <div className="flex-1 min-w-0 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black tracking-wider text-[#2563eb]/70">近くの場{nearSpotList.length > 1 ? ` ${cardIndex + 1}/${nearSpotList.length}` : ''}</span>
                  {nearSpotList.length > 1 && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5">← スワイプ →</span>
                  )}
                </div>
                <h4 className="text-sm font-black text-gray-900 truncate">{spot.name}</h4>
                {spot.godName && (
                  <p className="text-[11px] font-bold text-gray-400 truncate mt-0.5">
                    {spot.godEmoji ? `${spot.godEmoji} ` : ''}{spot.godName}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {spot.category && <span className="text-[13px] font-black text-gray-500">{spot.category}</span>}
                  <span className="text-[13px] font-black flex items-center gap-0.5 text-[#2563eb]">
                    <MapPin className="w-3 h-3" /><span className="tabular-nums">{distVal}</span><span className="text-[11px]">{distUnit}</span>
                  </span>
                  {held && <span className="text-[13px] font-black text-shrine-red flex items-center gap-0.5">🔴 御朱印</span>}
                  {ugc > 0 && <span className="text-[13px] flex items-center gap-0.5 text-gray-400"><Camera className="w-3 h-3" />{ugc}</span>}
                </div>
                {/* ページインジケータ（ドット） */}
                {nearSpotList.length > 1 && (
                  <div className="flex items-center gap-1 mt-1.5">
                    {nearSpotList.map((_, i) => (
                      <span key={i} className={`h-1 rounded-full transition-all ${i === cardIndex ? 'w-3 bg-[#2563eb]' : 'w-1 bg-gray-300'}`} />
                    ))}
                  </div>
                )}
              </div>
              <div className="self-center pr-3 flex-shrink-0 text-[#2563eb]"><ChevronRight className="w-5 h-5" /></div>
            </div>
          </div>
        );
      })() : null}


      {/* 証拠写真モーダル（この目的地を達成するには写真が必要） */}
      {proofStep && (
        <div className="absolute inset-0 z-[2000] bg-black/50 flex items-end" onClick={() => { setProofStep(null); setProofPhoto(null); setProofComment(''); }}>
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

            {/* 証拠写真に添えるコメント（任意） */}
            <textarea
              value={proofComment}
              onChange={(e) => setProofComment(e.target.value)}
              rows={2}
              placeholder="コメントを添える（任意）— 感じたこと・気づきなど"
              className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-[#2563eb] transition-all resize-none"
            />

            <div className="flex gap-2 mt-2">
              <button onClick={() => { setProofStep(null); setProofPhoto(null); setProofComment(''); }} className="flex-1 bg-gray-100 text-gray-500 text-sm font-black py-2.5 rounded-xl cursor-pointer">やめる</button>
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
          <div className="absolute inset-0 bg-black/55" onClick={() => { if (celebrate.complete) onClearChallenge?.(); setCelebrate(null); }} />

          {/* ── バッジ獲得：紙吹雪パーティクル ── */}
          {celebrate.complete && (() => {
            const COLORS = ['#f59e0b','#ef4444','#3b82f6','#10b981','#8b5cf6','#ec4899','#f97316','#fbbf24','#06b6d4','#a3e635'];
            const items = [
              { l:5,  d:0.0, dur:1.8, w:8,  h:12 },
              { l:12, d:0.2, dur:2.1, w:10, h:7  },
              { l:20, d:0.05,dur:1.6, w:7,  h:10 },
              { l:28, d:0.35,dur:2.3, w:12, h:8  },
              { l:36, d:0.1, dur:1.9, w:9,  h:13 },
              { l:44, d:0.45,dur:2.0, w:11, h:7  },
              { l:52, d:0.15,dur:1.7, w:8,  h:11 },
              { l:60, d:0.3, dur:2.2, w:10, h:9  },
              { l:68, d:0.0, dur:1.5, w:7,  h:12 },
              { l:76, d:0.4, dur:2.4, w:12, h:8  },
              { l:84, d:0.2, dur:1.8, w:9,  h:10 },
              { l:92, d:0.1, dur:2.1, w:11, h:7  },
              { l:9,  d:0.5, dur:1.9, w:8,  h:13 },
              { l:25, d:0.6, dur:2.0, w:10, h:8  },
              { l:47, d:0.55,dur:1.6, w:7,  h:11 },
              { l:63, d:0.65,dur:2.3, w:12, h:9  },
              { l:80, d:0.7, dur:1.7, w:9,  h:12 },
              { l:95, d:0.8, dur:2.2, w:11, h:8  },
            ];
            return items.map((p, i) => (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: `${p.l}%`,
                  width: p.w,
                  height: p.h,
                  backgroundColor: COLORS[i % COLORS.length],
                  animationDuration: `${p.dur}s`,
                  animationDelay: `${p.d}s`,
                  borderRadius: i % 3 === 0 ? '50%' : '2px',
                }}
              />
            ));
          })()}

          <div className="relative celebrate-pop w-full max-w-sm">
            {/* 達成エンブレム */}
            <div className="text-center">
              {celebrate.complete ? (
                <div className="relative inline-block">
                  <div className="badge-ring" />
                  <div className="badge-ring badge-ring-2" />
                  <div className="text-7xl badge-acquired leading-none">{celebrate.icon}</div>
                  <p className="badge-get-text text-[11px] font-black tracking-[0.25em] text-amber-300 drop-shadow mt-1.5">BADGE GET!</p>
                </div>
              ) : (
                <>
                  <div className="text-6xl">{celebrate.icon}</div>
                  <p className="text-[11px] font-black tracking-[0.2em] text-white drop-shadow mt-1">STEP CLEAR</p>
                </>
              )}
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
              className={`w-full mt-4 text-white text-[15px] font-black py-3 rounded-full hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer ${celebrate.complete ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/40' : 'bg-[#2563eb]'}`}
            >
              {celebrate.complete ? '🏆 クエストを終える' : '次の目的地へ →'}
            </button>
          </div>
        </div>
      )}

      {/* 導入（プロローグ）：案内役の精霊がフキダシで物語を語ってから冒険へ */}
      {activeChallenge && !celebrate && (chDone?.size ?? 0) === 0 && introSeenId !== activeChallenge.id && (
        <div className="absolute inset-0 z-[2050] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/55" onClick={() => markIntroSeen(activeChallenge.id)} />
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
                  <span>全{activeChallenge.tasks.length}ミッション</span>
                </div>
                {/* ボタン無し・進捗バー無しで3秒後に自動で冒険開始 */}
                <p className="text-[11px] font-bold text-gray-400 mt-5">まもなく冒険がはじまる…</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 道案内の精霊との会話（狐アイコンのタップで開く・これまでの語りログ＋参加） */}
      {chatOpen && activeChallenge && (
        <div className="absolute inset-0 z-[2300] bg-black/50 flex items-end" onClick={() => setChatOpen(false)}>
          <div className="w-full bg-white rounded-t-3xl flex flex-col max-h-[82%] animate-in" onClick={(e) => e.stopPropagation()}>
            {/* ヘッダー */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-2.5 border-b border-black/5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-100 to-orange-50 border border-white shadow flex items-center justify-center text-xl flex-shrink-0">🦊</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-gray-900">道案内の精霊</p>
                <p className="text-[11px] text-gray-400 truncate">{activeChallenge.title}・会話のログ</p>
              </div>
              <button onClick={() => setChatOpen(false)} aria-label="閉じる" className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center cursor-pointer"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            {/* メッセージ（これまでの語り＋参加分） */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {chatMessages.map((m, i) => m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] bg-[#2563eb] text-white rounded-2xl rounded-br-sm px-3.5 py-2 text-[13px] leading-relaxed">{m.text}</div>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-100 to-orange-50 flex items-center justify-center text-base flex-shrink-0">🦊</div>
                  <div className="max-w-[80%] bg-gray-100 text-gray-800 rounded-2xl rounded-tl-sm px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-line">{m.text}</div>
                </div>
              ))}
              {chatSending && (
                <div className="flex items-center gap-2 pl-9 text-gray-400 text-[12px]"><span className="animate-pulse">精霊が考えている…</span></div>
              )}
            </div>
            {/* 入力（会話に参加） */}
            <div className="px-3 pt-2 border-t border-black/5 flex items-center gap-2" style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendChat(); }}
                placeholder="精霊に話しかける…"
                className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-[14px] text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#2563eb]/30"
              />
              <button onClick={sendChat} disabled={!chatInput.trim() || chatSending} aria-label="送信" className="w-10 h-10 rounded-full bg-[#2563eb] text-white flex items-center justify-center disabled:opacity-40 cursor-pointer flex-shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
