'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Compass, ChevronRight, Flag, X, Camera, Check, MapPin, Clock, Navigation2, MessageCircle, Send, Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Spot, User, db } from '../lib/db';
import { uploadImage, compressImage } from '../lib/upload';
import { hasGoShuin, grantGoShuin } from '../lib/goshuin';
import { playChime } from '../lib/sound';
import GoshuinCelebrate from './GoshuinCelebrate';
import { distanceKm, bearingDeg } from '../lib/geo';
import { ttlInfo } from '../lib/quest-ui';
import { photoThemesFor } from '../lib/photo-themes';
import { getHeartVoices } from '../data/god-tasks';
import { composeWalkGuide, nextGuideStage } from '../lib/walk-guide';
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

// 道案内の精霊のセリフ（ステップ開始時の導入）。
// 土地の紹介（蘊蓄）→ 観察指示 → 写真誘導、という語り。
// 歩いている途中の語り（距離・豆知識・観察ミッション）は ../lib/walk-guide が担う。
function composeGuideText(step: ChallengeStep): string {
  const intro = step.trivia ? step.trivia : '';
  const action = step.action ?? '';
  const alreadyPhoto = /写真|一枚|撮|収め|おさめ/.test(action);
  const photoLine = alreadyPhoto ? '' : 'そして、心に残った風景を一枚、写真におさめてみよう。';
  return `${intro}${action}${photoLine}`;
}

type GuideMsg = { role: 'spirit' | 'user'; text: string; photo?: string };
type ShareKind = 'self' | 'scene' | 'photo';

// クエスト中に撮った道中の写真（地図にマーク表示し、タップで振り返る）
export interface QuestPhoto {
  id: string;
  lat: number;
  lng: number;
  photo: string;     // 圧縮 dataURL
  comment?: string;  // 添えたひとこと（プリセット or 自由入力）
  mood?: string;     // そのときの気分
  feedback?: string; // 目的地の神のコメント
  createdAt: string;
}

// 写真に添えるコメントのプリセット
const PHOTO_PRESETS = ['きれいな景色', 'おもしろい発見', '歴史を感じる', 'ほっとする場所', '美味しそう', '気になる建物', '季節を感じる'];

// 「今どんな気分？」のプリセット（神が気分も聞いてくれる）
const MOOD_PRESETS = [
  { emoji: '😊', label: 'たのしい' },
  { emoji: '😌', label: 'おだやか' },
  { emoji: '😮', label: 'おどろき' },
  { emoji: '🥹', label: '感動' },
  { emoji: '😪', label: 'おつかれ' },
  { emoji: '🤔', label: '考え中' },
];

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
  onRecordVisit?: (spot: Spot) => void; // カードの「行った」：参拝記録を残す
  activeChallenge?: Challenge | null; // 今挑戦中のチャレンジ（上部バナー＋ゴール表示）
  onClearChallenge?: () => void;
  onAdvanceChallenge?: (stepId: string, photo?: string | null) => void; // 次の目的地ステップを達成（証拠写真つき）
  onCompleteChallenge?: () => void; // 目的地100m到達＝御朱印取得でクエストを達成扱いにする
  trail?: { lat: number; lng: number }[]; // クエスト中に通ったルートの軌跡（親が保持＝タブ遷移で消えない）
  questPhotos?: QuestPhoto[]; // クエスト中に撮った道中写真（親が保持）。地図にマーク表示
  onAddQuestPhoto?: (p: QuestPhoto) => void; // 道中写真を追加
  currentUser: User; // 近くの場カード表示用
  onMapMove?: (center: { lat: number; lng: number }) => void; // 地図を移動させたとき（アクティビティログ用）
  deviceHeading?: number | null; // 端末の向き（方位磁針）。ナビ矢印のコンパス補正と現在地マーカーに使う
}


export default function MapTab({
  spots,
  activeSpot,
  onSelectSpot,
  userLocation,
  setUserLocation,
  onNavigateTab,
  onOpenDetail,
  onRecordVisit,
  activeChallenge,
  onClearChallenge,
  onAdvanceChallenge,
  onCompleteChallenge,
  trail = [],
  questPhotos = [],
  onAddQuestPhoto,
  currentUser,
  onMapMove,
  deviceHeading = null,
}: MapTabProps) {
  const displaySpots = spots;

  // Compute UGC counts per spot
  const allUgc = db.getUgc();
  const ugcCounts: { [spotId: string]: number } = {};
  spots.forEach((spot) => {
    ugcCounts[spot.id] = allUgc.filter((u) => u.spotId === spot.id).length;
  });


  // ── 場所検索：登録スポットの即時検索＋任意の場所のジオコーディング（Nominatim） ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [geoResults, setGeoResults] = useState<{ name: string; detail: string; lat: number; lng: number; d: number }[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  // 検索結果の任意地点に立てる赤ピン（token で同じ場所への再フォーカスも可能に）
  const [searchPin, setSearchPin] = useState<{ lat: number; lng: number; name: string; token: number } | null>(null);

  // 登録スポットの検索（名前・神様名・カテゴリの部分一致、近い順に最大5件）
  const q = searchQ.trim().toLowerCase();
  const spotMatches = q
    ? spots
        .filter((s) => [s.name, s.godName, s.category].some((t) => t && t.toLowerCase().includes(q)))
        .map((s) => ({ s, d: distanceKm(userLocation.lat, userLocation.lng, s.latitude, s.longitude) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 5)
    : [];

  // 任意の場所をジオコーディング（450msデバウンス・入力途中の応答は中断）
  useEffect(() => {
    const text = searchQ.trim();
    if (text.length < 2) { setGeoResults([]); setGeoLoading(false); return; }
    setGeoLoading(true);
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        // 現在地まわりの viewbox を渡して「近い場所」を優先（bounded=0=範囲外も必要なら返す）
        const { lat, lng } = userLocation;
        const box = `${lng - 0.35},${lat + 0.35},${lng + 0.35},${lat - 0.35}`;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&accept-language=ja&countrycodes=jp&limit=12&viewbox=${box}&bounded=0&q=${encodeURIComponent(text)}`,
          { signal: ctrl.signal },
        );
        const data = await res.json();
        const mapped = (Array.isArray(data) ? data : []).map((r: { name?: string; display_name: string; lat: string; lon: string }) => {
          const la = parseFloat(r.lat), ln = parseFloat(r.lon);
          return {
            name: r.name || r.display_name.split(',')[0],
            detail: r.display_name,
            lat: la,
            lng: ln,
            d: distanceKm(userLocation.lat, userLocation.lng, la, ln),
          };
        });
        // 近い順に並べ、上位6件の候補を出す
        mapped.sort((a, b) => a.d - b.d);
        setGeoResults(mapped.slice(0, 6));
        setGeoLoading(false);
      } catch {
        if (!ctrl.signal.aborted) { setGeoResults([]); setGeoLoading(false); }
      }
    }, 450);
    return () => { clearTimeout(id); ctrl.abort(); };
    // 現在地は入力時点の値を使う（GPS更新ごとの再検索は避ける）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQ]);

  const closeSearch = () => { setSearchOpen(false); setSearchQ(''); setGeoResults([]); };
  // 登録スポットを選択 → そのスポットを選択状態に（地図は activeSpot 追従でパンする）
  const gotoSpot = (s: Spot) => { setSearchPin(null); onSelectSpot(s); closeSearch(); };
  // 任意の場所を選択 → 赤ピンを立てて地図を寄せる
  const gotoPlace = (lat: number, lng: number, name: string) => {
    setSearchPin((prev) => ({ lat, lng, name, token: (prev?.token ?? 0) + 1 }));
    closeSearch();
  };

  // ── 心の声（神のつぶやき）を下部オーバーレイで：一文字ずつ・タスク交互 ──
  const [typed, setTyped] = useState('');
  const [msgIdx, setMsgIdx] = useState(0);

  // チャレンジ：証拠写真モーダル & 達成演出
  const [proofStep, setProofStep] = useState<ChallengeStep | null>(null);
  const [proofPhoto, setProofPhoto] = useState<string | null>(null);
  // AIフィードバック用の軽量 dataURL。proofPhoto が Supabase の公開URLになっても
  // vision モデルへ渡せるよう、端末で圧縮した小さいコピーを別に保持する。
  const [proofVision, setProofVision] = useState<string | null>(null);
  const [proofComment, setProofComment] = useState(''); // 証拠写真に添えるコメント
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null); // 写真の取り込み失敗メッセージ
  // 達成ビート（豆知識つき・手動で次へ）。feedback は写真へのAIのひとこと（非同期で追記）
  const [celebrate, setCelebrate] = useState<
    { title: string; icon: string; complete: boolean; trivia?: string; triviaCategory?: TriviaCategory; stepId?: string; feedback?: string; omikuji?: { result: string; message: string; toku: number } } | null
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
  // 道中の写真への神のひとこと（会話画面に入らず、上部フキダシに表示してポーン音を鳴らす）
  const [photoComment, setPhotoComment] = useState<string | null>(null);
  const [photoSending, setPhotoSending] = useState(false);
  const photoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 撮影後にコメント（プリセット/自由入力）を添えて送るシート
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [photoCommentInput, setPhotoCommentInput] = useState('');
  const [photoMood, setPhotoMood] = useState<string | null>(null);
  // 地図上の写真マークをタップして振り返るモーダル
  const [reviewPhoto, setReviewPhoto] = useState<QuestPhoto | null>(null);
  // フキダシのタップで道案内の精霊が次々に新しい話題をくれる（話題替えの種）
  const topicBumpRef = useRef(0);
  // 道案内の精霊との会話（狐アイコンのタップでログ閲覧＋参加）
  const [chatOpen, setChatOpen] = useState(false);
  const [chatExtra, setChatExtra] = useState<GuideMsg[]>([]); // 参加（ユーザー⇄精霊）の追加分
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  // 道中の「神様に伝える」寄り道：チップ起点の共有種別（徳のスロットル判定に使う）
  const [pendingShareKind, setPendingShareKind] = useState<ShareKind | null>(null);
  const godPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  // 100m到達での御朱印自動授与＝クエスト達成
  const [goshuinCelebrate, setGoshuinCelebrate] = useState<{ spot: Spot; godName: string } | null>(null);
  const [quitConfirm, setQuitConfirm] = useState(false); // 「中断」確認モーダル
  const arrivalDoneRef = useRef(false);
  const goshuinStepDoneRef = useRef<string | null>(null); // 自動授与済みの御朱印ステップID（多重発火防止）
  // 上部ガイドのフキダシ本文（3行＋スクロール）の自動スクロール用
  const guideScrollRef = useRef<HTMLDivElement | null>(null);

  // ── 隠れスポット提案 ──
  const [proposingLoc, setProposingLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [propName, setPropName] = useState('');
  const [propCategory, setPropCategory] = useState('神社');

  const handleMapLongPress = (loc: { lat: number; lng: number }) => {
    // 挑戦中や演出中は提案させない
    if (activeChallenge || celebrate) return;
    setProposingLoc(loc);
    setPropName('');
  };

  const submitProposal = () => {
    if (!proposingLoc || !propName.trim()) return;
    const s: Spot = {
      id: `prop-${Date.now()}`,
      name: propName.trim(),
      description: 'ユーザーが提案した隠れスポットです。',
      latitude: proposingLoc.lat,
      longitude: proposingLoc.lng,
      creatorId: currentUser.id,
      imageUrl: '',
      category: propCategory,
      tokuRequirement: 10,
      enjoyments: [],
      difficulty: 1,
      terrain: 1,
      attributes: [],
      cacheType: 'Virtual',
      godName: '名もなき神',
      godEmoji: propCategory === '神社' ? '⛩️' : '🙏',
      godRequests: ['ここを訪れてくれてありがとう。'],
      verified: false,
    };
    db.addSpot(s);
    setProposingLoc(null);
    setPropName('');
    db.grantToku(currentUser.id, 10, 'スポット提案');
  };

  const onPickProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    // 同じ画像を再選択しても onChange が発火するよう値をリセット（2回目が達成できない不具合の対策）
    e.target.value = '';
    if (!f) return;
    setUploadingProof(true);
    setProofError(null);
    setProofVision(null);
    try {
      const url = await uploadImage(f, `challenge-${activeChallenge?.id ?? 'x'}`);
      setProofPhoto(url);
      // vision 用の軽量コピー（失敗しても達成フローには影響させない）
      compressImage(f, { maxDim: 640, quality: 0.7 }).then(setProofVision).catch(() => setProofVision(null));
    } catch {
      setProofPhoto(null);
      setProofError('写真の読み込みに失敗しました。もう一度撮影・選択してください。');
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
    // ── おみくじ機能 ──
    const omikujiTable = [
      { result: '大吉', message: '神の祝福があります。今日一番の運勢！', toku: 50 },
      { result: '中吉', message: '良いことが起きる兆しがあります。', toku: 30 },
      { result: '小吉', message: 'ささやかな幸せが見つかるでしょう。', toku: 15 },
      { result: '吉', message: '穏やかな一日になりそうです。', toku: 10 },
      { result: '末吉', message: '少しずつ運気は上向いています。', toku: 5 }
    ];
    const omikujiResult = omikujiTable[Math.floor(Math.random() * omikujiTable.length)];
    db.grantToku(currentUser.id, omikujiResult.toku, `おみくじ（${omikujiResult.result}）`);

    // 達成ビート：このステップで得た豆知識を“次の文章”として見せてから次へ進む
    setCelebrate({
      title: willComplete ? `「${activeChallenge.badgeName}」獲得！` : `${cleared.title} 達成！`,
      icon: willComplete ? activeChallenge.badgeIcon : '✅',
      complete: willComplete,
      trivia: cleared.trivia,
      triviaCategory: cleared.triviaCategory,
      stepId: cleared.id,
      omikuji: omikujiResult,
    });
    // 写真の内容へのAIフィードバック（fire-and-forget）。届いたら達成ビートに追記する。
    // 失敗・遅延は無言＝既存の演出のまま（graceful degradation）。
    const vision = proofVision;
    if (vision) {
      const stepSpot = (cleared.spotId ? db.getSpot(cleared.spotId) : undefined)
        ?? (activeChallenge.spotId ? db.getSpot(activeChallenge.spotId) : undefined);
      fetch('/api/photo-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoDataUrl: vision,
          context: {
            spotName: stepSpot?.name,
            taskTitle: cleared.title,
            taskAction: cleared.action,
            godName: stepSpot?.godName,
            photoThemes: (cleared.type === 'photo' || cleared.photo) ? photoThemesFor(stepSpot?.category) : undefined,
          },
        }),
        signal: AbortSignal.timeout(12_000),
      })
        .then((r) => r.json())
        .then((d) => {
          // ユーザーが先に「次へ」を押していたら破棄（stepId ガードで古い応答の混入も防ぐ）
          if (d?.feedback) setCelebrate((prev) => (prev && prev.stepId === cleared.id ? { ...prev, feedback: d.feedback } : prev));
        })
        .catch(() => {});
    }
    setProofStep(null);
    setProofPhoto(null);
    setProofVision(null);
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

  // ── 目的地の八百万神（道中の語りかけ相手＋100m自動御朱印の対象）──
  const destSpot = activeChallenge
    ? ((activeChallenge.spotId ? db.getSpot(activeChallenge.spotId) : null)
        ?? (nextStep?.spotId ? db.getSpot(nextStep.spotId) : null)
        ?? null)
    : null;
  const destAgent = destSpot ? db.getAgentBySpot(destSpot.id) : undefined;
  const destGodName = destSpot?.godName || destAgent?.name || '八百万の神';
  const destGodEmoji = destSpot ? (destSpot.godEmoji || (destSpot.category === '神社' ? '⛩️' : '🙏')) : '⛩️';

  const activeDist = activeSpot ? distanceKm(userLocation.lat, userLocation.lng, activeSpot.latitude, activeSpot.longitude) : 0;
  const activeNear = activeDist <= 1.0;
  const activeToku = activeSpot ? db.getSpotToku(activeSpot.id) : 0;
  const activeGodEmoji = activeSpot ? (activeSpot.godEmoji || (activeSpot.category === '神社' ? '⛩️' : '🙏')) : '⛩️';

  // ── インタラクティブカード（Interactive Card） ──
  // マップ下部に出る「近くの場」カードの領域。クエスト未参加時に表示し、
  // 横スワイプで隣の場へ切替、タップでその場の詳細を開く（近い順）。
  const nearSpotList = (() => {
    const scored = [...spots]
      .map((s) => ({ s, d: distanceKm(userLocation.lat, userLocation.lng, s.latitude, s.longitude) }))
      .sort((a, b) => a.d - b.d);
    const top = scored.slice(0, 10);
    // 選択中の場(activeSpot)が最寄り10件の圏外でも、必ずカードに含める。
    // こうしないと cardIdx=-1 となり、選択マーカー/フキダシ(activeSpot)とカードがズレる。
    if (activeSpot && !top.some((x) => x.s.id === activeSpot.id)) {
      const found = scored.find((x) => x.s.id === activeSpot.id);
      const d = found ? found.d : distanceKm(userLocation.lat, userLocation.lng, activeSpot.latitude, activeSpot.longitude);
      top.push({ s: found ? found.s : activeSpot, d });
      top.sort((a, b) => a.d - b.d);
    }
    return top.map((x) => x.s);
  })();
  // カードが指す場：選択中(activeSpot)があればそれ、無ければ最寄り。
  // マーカータップ/スワイプで activeSpot が変わり、それに追従してカードと地図ハイライトが更新される。
  const cardSpot = activeSpot ?? nearSpotList[0] ?? null;
  const cardIdx = cardSpot ? nearSpotList.findIndex((s) => s.id === cardSpot.id) : -1;
  // ── 指に追従する横スワイプ・カルーセル（次のカードが右にチラ見えする） ──
  // PEEK=右に覗かせる次カードの幅+間隔、GAP=カード間の間隔。実カード幅は計測で決める。
  const CARD_GAP = 10;
  const CARD_PEEK = 34; // 右に約 (PEEK-GAP)=24px 次カードを覗かせる
  const cardViewportRef = useRef<HTMLDivElement | null>(null);
  const cardTrackRef = useRef<HTMLDivElement | null>(null);
  const [slideW, setSlideW] = useState(0);
  const slideWRef = useRef(0);
  const cardIdxRef = useRef(0);
  // スワイプ直後のタップで誤って詳細を開かないよう swipedRef でガードする
  const swipedRef = useRef(false);
  const dragRef = useRef<{ startX: number; dragging: boolean; dx: number }>({ startX: 0, dragging: false, dx: 0 });

  // ビューポート幅からカード幅を計測（右の覗き分を差し引く）。
  // カード領域はクエスト中・達成ビート中は描画されないため、「表示されているか」を
  // 依存に含める（cardSpot だけだと、クエスト終了で再表示されたとき el=null のまま
  // 計測されず slideW=0 → カードが全幅＋ズレた位置で描画され左右が見切れる）。
  const cardCarouselVisible = !activeChallenge && !celebrate && !!cardSpot;
  useEffect(() => {
    const el = cardViewportRef.current;
    if (!el) return;
    const measure = () => { const w = Math.max(0, el.clientWidth - CARD_PEEK); slideWRef.current = w; setSlideW(w); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cardCarouselVisible]);
  // 現在カードの位置を ref に同期（タッチハンドラのクロージャから最新を読む）。
  useEffect(() => { cardIdxRef.current = cardIdx < 0 ? 0 : cardIdx; }, [cardIdx]);

  const cardBaseFor = (idx: number) => -(idx * (slideWRef.current + CARD_GAP));
  const setTrackX = (x: number, withTransition: boolean) => {
    const t = cardTrackRef.current;
    if (!t) return;
    t.style.transition = withTransition ? 'transform .3s cubic-bezier(.22,.61,.36,1)' : 'none';
    t.style.transform = `translateX(${x}px)`;
  };
  const onTrackTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    dragRef.current = { startX: t.clientX, dragging: true, dx: 0 };
    swipedRef.current = false;
    setTrackX(cardBaseFor(cardIdxRef.current), false);
  };
  const onTrackTouchMove = (e: React.TouchEvent) => {
    const st = dragRef.current;
    const t = e.touches[0];
    if (!st.dragging || !t) return;
    let dx = t.clientX - st.startX;
    // 端ではゴムのように抵抗をつけて「これ以上ない」ことを伝える
    const atFirst = cardIdxRef.current <= 0;
    const atLast = cardIdxRef.current >= nearSpotList.length - 1;
    if ((atFirst && dx > 0) || (atLast && dx < 0)) dx *= 0.35;
    st.dx = dx;
    if (Math.abs(dx) > 8) swipedRef.current = true; // ドラッグはタップとみなさない
    setTrackX(cardBaseFor(cardIdxRef.current) + dx, false); // 指に追従
  };
  const onTrackTouchEnd = () => {
    const st = dragRef.current;
    if (!st.dragging) return;
    st.dragging = false;
    const idx = cardIdxRef.current;
    const dx = st.dx;
    const threshold = Math.max(48, (slideWRef.current || 240) * 0.22);
    let newIdx = idx;
    if (dx <= -threshold && idx < nearSpotList.length - 1) newIdx = idx + 1;
    else if (dx >= threshold && idx > 0) newIdx = idx - 1;
    // 目標カードへ滑らかにスナップ（指を離した位置から続けてアニメーション）
    setTrackX(cardBaseFor(newIdx), true);
    if (newIdx !== idx) onSelectSpot(nearSpotList[newIdx]);
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
  }, [activeChallenge?.id, nextStep?.id, !!cardSpot, !!celebrate, chAllDone, introShowing, guideDone]);
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
  // 道中ガイド：いま表示中の語りを {stepId, stage, text} で固定保持する。
  // text は距離バンドの遷移時に1回だけ合成するため、GPS更新・再レンダーで
  // タイプ表示が途中リセットされない。ステージは単調増加（walk-guide 参照）。
  const [guideMsg, setGuideMsg] = useState<{ stepId: string; stage: number; text: string } | null>(null);
  // 精霊が一度に喋りすぎないよう、語りは約3行（文の区切り優先）で止める。続きは少し歩くと変わる。
  const to3Lines = (s: string): string => {
    const MAX = 78; // text-sm・幅いっぱいでおよそ3行
    if (s.length <= MAX) return s;
    const cut = s.slice(0, MAX);
    const brk = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('！'), cut.lastIndexOf('？'));
    return brk >= 30 ? cut.slice(0, brk + 1) : `${cut.trimEnd()}…`;
  };
  useEffect(() => {
    if (!(showGuide && nextStep && activeChallenge)) { setGuideMsg(null); return; }
    setGuideMsg((prev) => {
      const sameStep = prev?.stepId === nextStep.id;
      const stage = nextGuideStage(nextDist, sameStep ? prev!.stage : null);
      if (sameStep && stage === prev!.stage) return prev; // 同一バンド内は更新しない
      // ステップ開始時は導入（蘊蓄→観察指示）、歩き出してからはバンドごとの道中語り
      // （残り距離の声かけ・現在地近くの豆知識・道中の観察ミッションのローテーション）。
      const text = to3Lines(sameStep
        ? composeWalkGuide({ questId: activeChallenge.id, step: nextStep, stage, distKm: nextDist, user: userLocation })
        : composeGuideText(nextStep));
      return { stepId: nextStep.id, stage, text };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGuide, nextStep?.id, nextDist, userLocation.lat, userLocation.lng]);
  // 語りを一文字ずつタイプ表示
  useEffect(() => {
    if (!guideMsg) { setBriefTyped(''); setGuideDone(false); return; }
    const full = guideMsg.text;
    setBriefTyped('');
    setGuideDone(false);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setBriefTyped(full.slice(0, i));
      if (i >= full.length) { clearInterval(id); setGuideDone(true); }
    }, 30);
    return () => clearInterval(id);
  }, [guideMsg]);
  // タイプ中はフキダシ本文を最下部へ追従（3行枠内でスクロール）
  useEffect(() => {
    const el = guideScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [briefTyped]);

  // フキダシをタップ → 道案内の精霊が次の話題をくれる（ポーン音つき）。写真コメント中はそれを解除。
  const nextTopic = () => {
    if (!activeChallenge || !nextStep) return;
    if (photoComment) { setPhotoComment(null); if (photoTimerRef.current) clearTimeout(photoTimerRef.current); }
    const bump = topicBumpRef.current + 1;
    topicBumpRef.current = bump;
    const stage = guideMsg?.stage ?? nextGuideStage(nextDist, null);
    const text = to3Lines(composeWalkGuide({ questId: activeChallenge.id, step: nextStep, stage, distKm: nextDist, user: userLocation, nonce: bump }));
    setGuideMsg({ stepId: nextStep.id, stage, text });
    playChime();
  };

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
  // チャレンジが変わったら会話・寄り道・軌跡・御朱印演出をリセット
  useEffect(() => {
    setChatExtra([]); setChatOpen(false); setChatInput(''); setPendingShareKind(null);
    arrivalDoneRef.current = false; goshuinStepDoneRef.current = null; setGoshuinCelebrate(null);
    setPhotoComment(null); if (photoTimerRef.current) clearTimeout(photoTimerRef.current);
    setPendingPhoto(null); setPhotoCommentInput(''); setPhotoMood(null); setReviewPhoto(null);
    topicBumpRef.current = 0; setQuitConfirm(false);
  }, [activeChallenge?.id]);
  useEffect(() => () => { if (photoTimerRef.current) clearTimeout(photoTimerRef.current); }, []);
  // 新着・送信中で最下部へスクロール
  useEffect(() => {
    if (!chatOpen) return;
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatOpen, chatExtra.length, chatSending]);

  // 目的地100m未満に入ったら御朱印を自動授与し、祝祭モーダルを出す（OKで達成確定）。
  useEffect(() => {
    if (!activeChallenge || !destSpot || arrivalDoneRef.current) return;
    const d = distanceKm(userLocation.lat, userLocation.lng, destSpot.latitude, destSpot.longitude);
    if (d >= 0.1) return; // 100m ゲート（SpotDetail と同じ閾値）
    arrivalDoneRef.current = true; // 一度きり
    grantGoShuin(
      currentUser.id,
      { id: destSpot.id, name: destSpot.name, category: destSpot.category, godEmoji: destGodEmoji, latitude: destSpot.latitude, longitude: destSpot.longitude },
      destGodName,
    ); // 既取得時は null。授与可否に関わらず達成へ進む
    const target = destSpot;
    const name = destGodName;
    setTimeout(() => { playChime(); setGoshuinCelebrate({ spot: target, godName: name }); }, 600);
  }, [userLocation, destSpot?.id, activeChallenge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 御朱印ステップ（destSpot を持たない授与タスク）も、100m以内に近づいたら自動で授かって達成にする。
  // 以前は「御朱印をもらいに行く」ボタンで会話タブへ誘導していたが、現地到達で自動化する。
  useEffect(() => {
    if (!activeChallenge || !nextStep || nextStep.type !== 'goshuin' || destSpot) return;
    if (goshuinStepDoneRef.current === nextStep.id) return; // 一度きり
    if (nextStep.lat == null || nextStep.lng == null) return;
    const d = distanceKm(userLocation.lat, userLocation.lng, nextStep.lat, nextStep.lng);
    if (d >= 0.1) return; // 100m ゲート
    goshuinStepDoneRef.current = nextStep.id;
    // 御朱印を授与（未取得時のみ）。場が引ければ授与情報を補完する。
    const spot = nextStep.spotId ? (spots.find((s) => s.id === nextStep.spotId) ?? db.getSpot(nextStep.spotId)) : null;
    if (spot && !hasGoShuin(currentUser.id, spot.id)) {
      grantGoShuin(
        currentUser.id,
        { id: spot.id, name: spot.name, category: spot.category, godEmoji: spot.godEmoji || (spot.category === '神社' ? '⛩️' : '🙏'), latitude: spot.latitude, longitude: spot.longitude },
        spot.godName || '八百万の神',
      );
    }
    const doneNow = new Set(db.getChallengeProgress().done[activeChallenge.id] || []);
    const willComplete = doneNow.size + 1 >= activeChallenge.tasks.length;
    onAdvanceChallenge?.(nextStep.id, null);
    playChime();
    setCelebrate({
      title: willComplete ? `「${activeChallenge.badgeName}」獲得！` : `${nextStep.title} 達成！`,
      icon: willComplete ? activeChallenge.badgeIcon : '🔴',
      complete: willComplete, trivia: nextStep.trivia, triviaCategory: nextStep.triviaCategory,
    });
  }, [userLocation, nextStep?.id, nextStep?.type, destSpot?.id, activeChallenge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 神の言葉が届いた瞬間の共通処理：ポーン音を鳴らし、チップ起点の共有なら徳を授ける
  // （1目的地・種別ごと1日1回まで＝farming 防止）。
  const finalizeGodReply = (kind: ShareKind | null) => {
    playChime();
    if (destSpot && kind && !db.isTaskDoneToday(destSpot.id, `wayside-${kind}`)) {
      db.grantToku(currentUser.id, 5, '寄り道：神に伝える');
      db.markTaskDoneToday(destSpot.id, `wayside-${kind}`);
      setShareToast('徳 +5');
      setTimeout(() => setShareToast(null), 2200);
    }
    setPendingShareKind(null);
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatSending || !activeChallenge) return;
    const kind = pendingShareKind;
    setChatInput('');
    setChatExtra((prev) => [...prev, { role: 'user', text }]);
    setChatSending(true);
    try {
      const history = chatMessages.map((m) => ({ sender: m.role === 'user' ? 'user' : 'agent', text: m.text }));
      // 目的地の場があれば「目的地の八百万神」が応答。無ければ従来の道案内の精霊。
      const agent = destSpot
        ? (destAgent ?? {
            id: `agent-synthetic-${destSpot.id}`,
            name: destGodName,
            systemPrompt: `あなたは「${destSpot.name}」に宿る八百万の神「${destGodName}」。いま、あなたのもとへ向かって歩いている巡礼者が、道中で見た景色や自分のことを語りかけています。その言葉を温かく受けとめ、土地や相手の心に寄り添って、200文字以内・少し古風でやさしい神の口調（「〜じゃ」「〜のう」）で返してください。`,
            voiceTone: '神',
          })
        : {
            id: 'agent-guide-spirit',
            name: '道案内の精霊',
            systemPrompt: `あなたは「道案内の精霊」。狐の姿をした町歩きクエストの案内役です。いまは「${activeChallenge.title}」を巡る旅の途中。旅人に寄り添い、土地の歴史・地形・建築・道の蘊蓄を、やさしく簡潔に語ります。現在の目的地は「${nextStep?.title ?? '最終地点'}」。質問には親切に、200文字以内で、温かく少し古風な精霊らしい口調（「〜じゃ」「〜ぞ」）で答えてください。`,
            voiceTone: '案内役',
          };
      const spotPayload = destSpot
        ? { name: destSpot.name, category: destSpot.category, description: destSpot.description, enjoyments: [], godName: destSpot.godName, latitude: destSpot.latitude, longitude: destSpot.longitude }
        : { name: activeChallenge.title, category: 'クエスト', description: activeChallenge.description, enjoyments: [] };
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
          agent,
          spotId: destSpot?.id,
          ugc: [],
          affiliates: [],
          userName: currentUser.displayName || '旅人',
          spot: spotPayload,
          // 現在地。サーバ側で「土地の実在豆知識」を引き、神/精霊が道中の土地の話をできるようにする
          location: { lat: userLocation.lat, lng: userLocation.lng },
        }),
      });
      const data = await res.json();
      setChatExtra((prev) => [...prev, { role: 'spirit', text: data?.response || (destSpot ? '…（神は静かに目を細めている）' : '…（精霊は静かに微笑んでいる）') }]);
      finalizeGodReply(kind);
    } catch {
      setChatExtra((prev) => [...prev, { role: 'spirit', text: 'すまぬ、いまは声が届かぬようじゃ。もう一度試しておくれ。' }]);
      setPendingShareKind(null);
    } finally {
      setChatSending(false);
    }
  };

  // 寄り道チップ（テキスト）：神に伝える足場文をプレフィルしてシートを開く
  const startGodShare = (kind: 'self' | 'scene') => {
    setPendingShareKind(kind);
    setChatInput(kind === 'self'
      ? 'いまそちらへ向かっています。私のことを少し聞いてください。'
      : '道中で見つけた、気になる風景について話します。');
    setChatOpen(true);
  };

  // 道中の写真：撮ったらまずコメント（プリセット/自由）を添えるシートを開く。
  const onPickGodPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !destSpot || photoSending) return;
    let dataUrl = '';
    try { dataUrl = await compressImage(file, { maxDim: 900, quality: 0.6 }); } catch { return; }
    setPhotoCommentInput('');
    setPhotoMood(null);
    setPendingPhoto(dataUrl);
  };

  // コメント・気分を添えて送信：神のひとことを上部フキダシに出し（ポーン音）、地図に写真マークを残す。
  const sendQuestPhoto = async () => {
    if (!pendingPhoto || !destSpot || photoSending) return;
    const photo = pendingPhoto;
    const comment = photoCommentInput.trim();
    const mood = photoMood;
    const userNote = [mood ? `いまの気分は「${mood}」` : '', comment].filter(Boolean).join('。') || undefined;
    setPhotoSending(true);
    setPendingPhoto(null);
    let feedback = 'ほう、よき眺めじゃ。心に残る一枚じゃな。';
    try {
      const res = await fetch('/api/photo-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoDataUrl: photo, context: { spotName: destSpot.name, godName: destGodName, casual: true, userNote } }),
        signal: AbortSignal.timeout(12_000),
      });
      const data = await res.json();
      feedback = data?.feedback || feedback;
    } catch { /* 定型文のまま */ }
    setPhotoComment(feedback);
    playChime();
    // 地図に写真マークを残す（現在地）。親が保持＝タブ遷移でも残る。
    onAddQuestPhoto?.({ id: `qp-${Date.now()}`, lat: userLocation.lat, lng: userLocation.lng, photo, comment: comment || undefined, mood: mood || undefined, feedback, createdAt: new Date().toISOString() });
    setPhotoMood(null);
    // 徳（1目的地・写真は1日1回まで）
    if (!db.isTaskDoneToday(destSpot.id, 'wayside-photo')) {
      db.grantToku(currentUser.id, 5, '寄り道：神に伝える');
      db.markTaskDoneToday(destSpot.id, 'wayside-photo');
      setShareToast('徳 +5');
      setTimeout(() => setShareToast(null), 2200);
    }
    if (photoTimerRef.current) clearTimeout(photoTimerRef.current);
    photoTimerRef.current = setTimeout(() => setPhotoComment(null), 9000);
    setPhotoSending(false);
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      
      {/* 1. Geographical Leaflet Map */}
      <div className="absolute inset-0 z-0">
        <LeafletMap
          spots={displaySpots}
          activeSpot={activeSpot}
          onSelectSpot={onSelectSpot}
          onOpenDetail={onOpenDetail}
          userLocation={userLocation}
          setUserLocation={setUserLocation}
          ugcCounts={ugcCounts}
          goal={challengeGoal}
          onGoalTap={() => { const t = destSpot ?? (nextStep?.spotId ? db.getSpot(nextStep.spotId) : null) ?? activeSpot; if (t) onOpenDetail?.(t); }}
          trail={trail}
          photoMarkers={questPhotos.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, photo: p.photo }))}
          onPhotoMarkerTap={(id) => setReviewPhoto(questPhotos.find((p) => p.id === id) ?? null)}
          controlsBottom={controlsBottom}
          focusGoalToken={focusGoalToken}
          hideControls={introShowing}
          onMapMove={onMapMove}
          searchPin={searchPin}
          onMapLongPress={handleMapLongPress}
          deviceHeading={deviceHeading}
        />
      </div>

      {/* 場所検索（クエスト中・演出中は隠す）：右上のボタン ⇄ 検索バー＋候補リスト */}
      {!activeChallenge && !celebrate && (
        <div className="absolute top-3 left-3 right-3 z-[1300] flex flex-col items-end">
          {searchOpen ? (
            <div className="w-full bg-white rounded-2xl shadow-xl border border-black/5 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="場所・神社・お寺を検索"
                  autoFocus
                  className="flex-1 min-w-0 text-[14px] text-gray-900 placeholder:text-gray-400 outline-none bg-transparent"
                />
                <button onClick={closeSearch} aria-label="検索を閉じる" className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center cursor-pointer flex-shrink-0">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              {q && (
                <div className="max-h-64 overflow-y-auto border-t border-black/5">
                  {/* 登録スポット（八百万の場）の候補 */}
                  {spotMatches.map(({ s, d }) => (
                    <button
                      key={s.id}
                      onClick={() => gotoSpot(s)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-blue-50/60 active:bg-blue-50 cursor-pointer"
                    >
                      <span className="text-xl flex-shrink-0">{s.godEmoji || (s.category === '神社' ? '⛩️' : '🙏')}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-black text-gray-900 truncate">{s.name}</span>
                        <span className="block text-[11px] text-gray-400 truncate">{s.category}{s.godName ? `・${s.godName}` : ''}</span>
                      </span>
                      <span className="text-[11px] font-bold text-[#2563eb] tabular-nums flex-shrink-0">
                        {d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`}
                      </span>
                    </button>
                  ))}
                  {/* 地図上の場所（ジオコーディング）の候補 */}
                  {geoResults.map((r, i) => (
                    <button
                      key={`geo-${i}`}
                      onClick={() => gotoPlace(r.lat, r.lng, r.name)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-gray-50 active:bg-gray-100 cursor-pointer"
                    >
                      <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-bold text-gray-800 truncate">{r.name}</span>
                        <span className="block text-[11px] text-gray-400 truncate">{r.detail}</span>
                      </span>
                      <span className="text-[11px] font-bold text-rose-500 tabular-nums flex-shrink-0">
                        {r.d < 1 ? `${Math.round(r.d * 1000)}m` : `${r.d.toFixed(1)}km`}
                      </span>
                    </button>
                  ))}
                  {geoLoading && (
                    <p className="px-4 py-2.5 text-[12px] text-gray-400 animate-pulse">地図から検索中…</p>
                  )}
                  {!geoLoading && spotMatches.length === 0 && geoResults.length === 0 && (
                    <p className="px-4 py-2.5 text-[12px] text-gray-400">見つかりませんでした</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              title="場所を検索"
              aria-label="場所を検索"
              className="w-11 h-11 rounded-full bg-white shadow-lg border border-[#2563eb]/20 flex items-center justify-center text-[#2563eb] hover:bg-[#2563eb] hover:text-white cursor-pointer transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* 今挑戦中のチャレンジ（上部バナー・左右端まで・開始時に上からふわっと） */}
      {activeChallenge && !introShowing && (
        <div className="quest-header-in absolute top-0 left-0 right-0 z-[1100] bg-[#2563eb] text-white shadow-lg px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-black bg-white/25 px-2 py-0.5 rounded-full flex-shrink-0">
              <Flag className="w-2.5 h-2.5" />挑戦中
            </span>
            <h4 className="flex-1 min-w-0 text-sm font-black truncate">{activeChallenge.title}</h4>
            <button onClick={() => setQuitConfirm(true)} aria-label="チャレンジを中断" className="flex items-center gap-0.5 text-[11px] font-black bg-white/20 hover:bg-white/30 px-2 py-1 rounded-full flex-shrink-0 cursor-pointer transition-colors">
              中断<X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 進捗ガイド（上部のフキダシ）。通常は道案内の精霊の道中語り、写真を撮ると目的地の神の
          ひとこと（photoComment）を会話画面に入らずここに表示する。 */}
      {activeChallenge && (showGuide || photoComment) && nextStep && (
        <div className="absolute top-0 left-0 right-0 z-[1200] px-4 pt-[92px] flex justify-center pointer-events-none">
          <div className="w-full max-w-sm flex items-start gap-2">
            <button
              onClick={() => setChatOpen(true)}
              aria-label={destSpot ? `${destGodName}と話す` : '道案内の精霊と話す'}
              className="relative w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-orange-50 border-2 border-white shadow-lg flex items-center justify-center text-2xl flex-shrink-0 pointer-events-auto cursor-pointer active:scale-95 transition-transform"
            >
              {photoComment ? destGodEmoji : '🦊'}
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#2563eb] border-2 border-white flex items-center justify-center">
                <MessageCircle className="w-2.5 h-2.5 text-white" />
              </span>
            </button>
            <div
              onClick={nextTopic}
              role="button"
              aria-label="道案内の精霊に次の話題を聞く"
              className="relative flex-1 bg-white rounded-2xl rounded-tl-sm shadow-xl px-4 py-3 pointer-events-auto cursor-pointer active:scale-[0.99] transition-transform"
            >
              <p className={`text-[11px] font-black tracking-wider ${photoComment ? 'text-shrine-red' : 'text-amber-600'}`}>{photoComment ? destGodName : '道案内の精霊'}</p>
              <div ref={guideScrollRef} className="mt-0.5 max-h-[4.4rem] overflow-y-auto pr-1">
                {photoComment ? (
                  <p className="text-sm text-gray-800 leading-relaxed">{photoComment}</p>
                ) : (
                  <p className="text-sm text-gray-800 leading-relaxed">{briefTyped}<span className="animate-pulse text-amber-500">▌</span></p>
                )}
              </div>
              {!photoComment && <p className="text-[10px] font-black text-gray-300 mt-1 text-right">タップで次の話題 ›</p>}
            </div>
          </div>
        </div>
      )}

      {/* 道中の写真撮影用の隠しinput（下部ボタン・会話シートのチップ双方から使う） */}
      {activeChallenge && destSpot && (
        <input ref={godPhotoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickGodPhoto} />
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
                  // コンパス化：端末の向き(deviceHeading)を引いて画面相対の方角にする。
                  // 端末を回すと矢印が現実の目的地方向を指し続ける（方位磁針が無ければ真北基準=従来動作）。
                  const screenBrg = brg - (deviceHeading ?? 0);
                  // 近づくほど色が変わる：~50m以内=緑、~300m以内=橙、遠い=青
                  const color = d <= 0.05 ? 'text-emerald-500' : d <= 0.3 ? 'text-amber-500' : 'text-[#2563eb]';
                  return (
                    <span className={`font-black flex items-baseline gap-1 flex-shrink-0 ${color}`} style={{ transition: 'color 0.3s' }}>
                      <Navigation2 className="w-5 h-5 fill-current self-center" style={{ transform: `rotate(${screenBrg}deg)`, transition: 'transform 0.3s ease-out' }} />
                      <span className="tabular-nums text-3xl leading-none">{val}</span>
                      <span className="text-sm font-bold">{unit}</span>
                    </span>
                  );
                })()}
              </div>
              {/* アクション：目的地に着くまでは「道中で気になった風景・ものを撮る」。撮ると向かう先の神が応える。
                  目的地100m未満に入ると御朱印が自動授与され達成になる（別の useEffect）。 */}
              <div className="mt-3">
                {destSpot ? (
                  <>
                    <button
                      onClick={() => godPhotoInputRef.current?.click()}
                      disabled={photoSending}
                      className="w-full text-[15px] font-black py-3 rounded-full transition-all cursor-pointer flex items-center justify-center gap-2 bg-[#2563eb] text-white hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
                    >
                      <Camera className="w-4 h-4" />{photoSending ? '神が眺めている…' : '道中で気になる風景・ものを撮る'}
                    </button>
                  </>
                ) : nextStep.type === 'goshuin' ? (
                  /* 御朱印は現地（100m以内）に近づくと自動で授かる（別の useEffect が処理） */
                  <div className="w-full text-[14px] font-black py-3 rounded-full flex items-center justify-center gap-2 bg-amber-50 text-amber-700 border border-amber-200">
                    <MapPin className="w-4 h-4" />御朱印の場へ — 100m以内で自動授与
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (tooFar) { setFarNotice(true); return; }
                      setProofStep(nextStep); setProofPhoto(null); setProofError(null);
                    }}
                    className={`w-full text-[15px] font-black py-3 rounded-full transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      tooFar ? 'bg-gray-200 text-gray-400' : 'bg-[#2563eb] text-white hover:opacity-90 active:scale-[0.99]'
                    }`}
                  >
                    <Camera className="w-4 h-4" />証拠写真を撮影
                  </button>
                )}
                {!destSpot && farNotice && tooFar && nextStep.type !== 'goshuin' && (
                  <p className="text-center text-[12px] font-black text-rose-500 mt-2">📍 目的地に近づいてください（500m以内で達成できます）</p>
                )}
              </div>
            </>
          ) : null}
        </div>
      ) : !activeChallenge && !celebrate && cardSpot ? (
        // ▼ インタラクティブカード（Interactive Card）：指に追従するスワイプ・カルーセル。
        //   右に次のカードがチラ見えして「横にめくれる」ことが一目で分かる（近い順）。
        <div
          ref={(el) => { overlayElRef.current = el; cardViewportRef.current = el; }}
          className="absolute bottom-3 left-3 right-0 z-[1000] overflow-hidden touch-pan-y"
          onTouchStart={onTrackTouchStart}
          onTouchMove={onTrackTouchMove}
          onTouchEnd={onTrackTouchEnd}
        >
          <div
            ref={cardTrackRef}
            className="flex items-stretch will-change-transform"
            style={{
              gap: `${CARD_GAP}px`,
              // 計測前（slideW=0）はオフセットを掛けない＝見切れたカードを出さない
              transform: `translateX(${slideW ? cardBaseFor(cardIdx < 0 ? 0 : cardIdx) : 0}px)`,
              transition: slideW ? 'transform .3s cubic-bezier(.22,.61,.36,1)' : 'none',
            }}
          >
            {nearSpotList.map((s) => {
              const d = distanceKm(userLocation.lat, userLocation.lng, s.latitude, s.longitude);
              const distVal = d < 1 ? `${Math.round(d * 1000)}` : d.toFixed(1);
              const distUnit = d < 1 ? 'm' : 'km';
              const godEmoji = s.godEmoji || (s.category === '神社' ? '⛩️' : '🙏');
              const held = hasGoShuin(currentUser.id, s.id); // この場の御朱印を授かり済みか
              const ugc = ugcCounts[s.id] ?? 0;
              // 探索コンパス：その場の方角を指す（端末の向きがあれば実方向、無ければ北基準）
              const cardPhoto = (s.photos && s.photos[0]) || s.imageUrl || '';
              return (
                <div
                  key={s.id}
                  style={{ width: slideW || '100%', flexShrink: 0 }}
                  className="text-left bg-white/97 backdrop-blur-md rounded-2xl shadow-xl border border-black/5 overflow-hidden"
                >
                  {/* 上部：タップでその場を選択（地図でフキダシ表示） */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => { if (swipedRef.current) { swipedRef.current = false; return; } onSelectSpot(s); }}
                    className="flex items-stretch gap-3 cursor-pointer"
                  >
                    {/* 左：その場の写真（奉納写真→代表写真の順）。無ければ神の絵文字 */}
                    <div className="w-20 self-stretch rounded-tl-2xl flex items-center justify-center text-4xl flex-shrink-0 bg-gradient-to-br from-blue-100 to-amber-100 relative overflow-hidden">
                      {cardPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cardPhoto} alt={s.name} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        godEmoji
                      )}
                    </div>
                    <div className="flex-1 min-w-0 py-3 pr-3">
                      <h4 className="text-sm font-black text-gray-900 truncate">{s.name}</h4>
                      {s.godName && (
                        <p className="text-[11px] font-bold text-gray-400 truncate mt-0.5">
                          {s.godEmoji ? `${s.godEmoji} ` : ''}{s.godName}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {s.category && <span className="text-[13px] font-black text-gray-500">{s.category}</span>}
                        <span className="text-[13px] font-black flex items-center gap-0.5 text-[#2563eb]">
                          <MapPin className="w-3 h-3" /><span className="tabular-nums">{distVal}</span><span className="text-[11px]">{distUnit}</span>
                        </span>
                        {held && <span className="text-[13px] font-black text-shrine-red flex items-center gap-0.5">🔴 御朱印</span>}
                        {ugc > 0 && <span className="text-[13px] flex items-center gap-0.5 text-gray-400"><Camera className="w-3 h-3" />{ugc}</span>}
                      </div>
                    </div>
                  </div>
                  {/* 下部：2ボタン（行った／詳細を見る） */}
                  <div className="flex border-t border-black/5">
                    <button
                      onClick={() => { onSelectSpot(s); onRecordVisit?.(s); }}
                      className="flex-1 py-2.5 text-[13px] font-black text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 flex items-center justify-center gap-1 cursor-pointer border-r border-black/5"
                    >
                      <Check className="w-4 h-4" />行った
                    </button>
                    <button
                      onClick={() => { onSelectSpot(s); onOpenDetail?.(s); }}
                      className="flex-1 py-2.5 text-[13px] font-black text-[#2563eb] hover:bg-blue-50 active:bg-blue-100 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      詳細を見る<ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}


      {/* 証拠写真モーダル（この目的地を達成するには写真が必要） */}
      {proofStep && (
        <div className="absolute inset-0 z-[2000] bg-black/50 flex items-end" onClick={() => { setProofStep(null); setProofPhoto(null); setProofComment(''); setProofError(null); }}>
          <div className="w-full bg-white rounded-t-3xl p-4 pb-6 animate-in" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5"><Camera className="w-4 h-4 text-[#2563eb]" />証拠写真を撮影</h3>
            <p className="text-[13px] text-gray-500 mt-1">「{proofStep.title}」を達成するには、現地で証拠となる写真を撮影してください。</p>

            {/* 写真タスクには、この場ならではの撮影テーマ（お題）を2〜3個ヒント表示 */}
            {(proofStep.type === 'photo' || proofStep.photo) && (() => {
              const cat = (proofStep.spotId ? db.getSpot(proofStep.spotId)?.category : undefined) || destSpot?.category;
              const themes = photoThemesFor(cat);
              return (
                <div className="mt-2.5">
                  <p className="text-[11px] font-black text-gray-400 mb-1.5">📸 撮影のお題（どれか一つでも）</p>
                  <div className="flex flex-wrap gap-1.5">
                    {themes.map((t, i) => (
                      <span key={i} className="text-[12px] font-black px-2.5 py-1 rounded-full bg-blue-50 text-[#2563eb] border border-blue-100">{t}</span>
                    ))}
                  </div>
                </div>
              );
            })()}

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

            {proofError && !uploadingProof && (
              <p className="mt-2 text-center text-[12px] font-black text-rose-500">{proofError}</p>
            )}

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
              <button onClick={() => { setProofStep(null); setProofPhoto(null); setProofComment(''); setProofError(null); }} className="flex-1 bg-gray-100 text-gray-500 text-sm font-black py-2.5 rounded-xl cursor-pointer">やめる</button>
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
                {celebrate.omikuji && (
                  <div className="mt-2 text-left rounded-xl px-3 py-2 bg-red-50 border border-red-200 text-red-800 celebrate-pop">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-black">
                      <span className="text-lg leading-none">🥠</span>おみくじ：{celebrate.omikuji.result}
                    </span>
                    <p className="mt-1 text-[13px] leading-relaxed">{celebrate.omikuji.message}</p>
                    <p className="text-[11px] font-bold mt-1 text-red-600 bg-red-100/50 inline-block px-1.5 py-0.5 rounded">徳 +{celebrate.omikuji.toku} を授かりました</p>
                  </div>
                )}
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
                {celebrate.feedback && (
                  /* 奉納した写真の内容へのAIのひとこと（非同期で届いたら表示） */
                  <div className="mt-2 text-left rounded-xl px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 celebrate-pop">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-black">
                      <span className="text-lg leading-none">📸</span>写真へのひとこと
                    </span>
                    <p className="mt-1 text-[13px] leading-relaxed">{celebrate.feedback}</p>
                  </div>
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

      {/* 道中の会話（目的地の場があれば「目的地の八百万神」／無ければ道案内の精霊） */}
      {chatOpen && activeChallenge && (
        <div className="absolute inset-0 z-[2300] bg-black/50 flex items-end" onClick={() => setChatOpen(false)}>
          <div className="w-full bg-white rounded-t-3xl flex flex-col max-h-[82%] animate-in" onClick={(e) => e.stopPropagation()}>
            {/* ヘッダー */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-2.5 border-b border-black/5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-100 to-orange-50 border border-white shadow flex items-center justify-center text-xl flex-shrink-0">{destSpot ? destGodEmoji : '🦊'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-gray-900 truncate">{destSpot ? destGodName : '道案内の精霊'}</p>
                <p className="text-[11px] text-gray-400 truncate">{destSpot ? `${destSpot.name}・道中の語らい` : `${activeChallenge.title}・会話のログ`}</p>
              </div>
              <button onClick={() => setChatOpen(false)} aria-label="閉じる" className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center cursor-pointer"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            {/* メッセージ（これまでの語り＋参加分） */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {chatMessages.map((m, i) => m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] flex flex-col items-end gap-1">
                    {m.photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photo} alt="奉納した写真" className="w-32 h-32 rounded-2xl object-cover border border-black/5" />
                    )}
                    {m.text && <div className="bg-[#2563eb] text-white rounded-2xl rounded-br-sm px-3.5 py-2 text-[13px] leading-relaxed">{m.text}</div>}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-100 to-orange-50 flex items-center justify-center text-base flex-shrink-0">{destSpot ? destGodEmoji : '🦊'}</div>
                  <div className="max-w-[80%] bg-gray-100 text-gray-800 rounded-2xl rounded-tl-sm px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-line">{m.text}</div>
                </div>
              ))}
              {chatSending && (
                <div className="flex items-center gap-2 pl-9 text-gray-400 text-[12px]"><span className="animate-pulse">{destSpot ? '神が耳を傾けている…' : '精霊が考えている…'}</span></div>
              )}
            </div>
            {/* 寄り道チップ（目的地の場がある時だけ：あなたのこと／気になる風景／写真） */}
            {destSpot && (
              <div className="px-3 pt-2.5 flex items-center gap-2 overflow-x-auto scrollbar-none">
                <button onClick={() => startGodShare('self')} disabled={chatSending} className="flex-shrink-0 text-[12px] font-black text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full disabled:opacity-40 cursor-pointer">⛩️ あなたのこと</button>
                <button onClick={() => startGodShare('scene')} disabled={chatSending} className="flex-shrink-0 text-[12px] font-black text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full disabled:opacity-40 cursor-pointer">👀 気になる風景</button>
              </div>
            )}
            {/* 入力（会話に参加） */}
            <div className="px-3 pt-2 border-t border-black/5 flex items-center gap-2" style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendChat(); }}
                placeholder={destSpot ? `${destGodName} に伝える…` : '精霊に話しかける…'}
                className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-[14px] text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#2563eb]/30"
              />
              <button onClick={sendChat} disabled={!chatInput.trim() || chatSending} aria-label="送信" className="w-10 h-10 rounded-full bg-[#2563eb] text-white flex items-center justify-center disabled:opacity-40 cursor-pointer flex-shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 道中の寄り道で徳を授かったときの小トースト */}
      {shareToast && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-[2400] bg-gray-900/90 text-white text-[13px] font-black px-4 py-2 rounded-full shadow-lg celebrate-pop">{shareToast}</div>
      )}

      {/* 撮影後：気分・ひとことを添えて神に送るシート（ネタ振り付き） */}
      {pendingPhoto && destSpot && (
        <div className="absolute inset-0 z-[2350] bg-black/50 flex items-end" onClick={() => !photoSending && setPendingPhoto(null)}>
          <div className="w-full bg-white rounded-t-3xl flex flex-col max-h-[90%] animate-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-black/5">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">{destGodEmoji} {destGodName}に伝える</h3>
              <button onClick={() => setPendingPhoto(null)} aria-label="閉じる" className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-4 py-3 overflow-y-auto space-y-3.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingPhoto} alt="撮った写真" className="w-full max-h-52 object-cover rounded-2xl border border-black/5" />
              <div>
                <p className="text-[12px] font-black text-gray-600 mb-1.5">いまどんな気分？</p>
                <div className="flex flex-wrap gap-1.5">
                  {MOOD_PRESETS.map((m) => (
                    <button key={m.label} onClick={() => setPhotoMood(photoMood === m.label ? null : m.label)} className={`text-[12px] font-black px-2.5 py-1.5 rounded-full transition-all cursor-pointer ${photoMood === m.label ? 'bg-shrine-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{m.emoji} {m.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[12px] font-black text-gray-600 mb-1.5">ひとこと（任意）</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PHOTO_PRESETS.map((p) => (
                    <button key={p} onClick={() => setPhotoCommentInput(photoCommentInput === p ? '' : p)} className={`text-[12px] font-black px-2.5 py-1.5 rounded-full transition-all cursor-pointer ${photoCommentInput === p ? 'bg-[#2563eb] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{p}</button>
                  ))}
                </div>
                <input value={photoCommentInput} onChange={(e) => setPhotoCommentInput(e.target.value)} placeholder="自由に書いてもOK" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-shrine-red" />
              </div>
            </div>
            <div className="px-4 pt-2 border-t border-black/5" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
              <button onClick={sendQuestPhoto} disabled={photoSending} className="w-full text-[15px] font-black py-3 rounded-full bg-[#2563eb] text-white hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />{photoSending ? '送信中…' : 'この一枚を送る'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 地図の写真マークをタップ → 振り返りモーダル */}
      {reviewPhoto && (
        <div className="absolute inset-0 z-[2360] bg-black/60 flex items-center justify-center p-4" onClick={() => setReviewPhoto(null)}>
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={reviewPhoto.photo} alt="道中の写真" className="w-full max-h-72 object-cover" />
              <button onClick={() => setReviewPhoto(null)} aria-label="閉じる" className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/45 text-white flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-2">
              {reviewPhoto.mood && <p className="text-[12px] font-bold text-gray-500">いまの気分：{reviewPhoto.mood}</p>}
              {reviewPhoto.comment && <p className="text-sm font-black text-gray-900">{reviewPhoto.comment}</p>}
              {reviewPhoto.feedback && (
                <div className="flex items-start gap-2">
                  <span className="text-lg flex-shrink-0">{destGodEmoji}</span>
                  <p className="text-[13px] text-gray-700 bg-gray-50 rounded-2xl px-3 py-2 leading-relaxed">{reviewPhoto.feedback}</p>
                </div>
              )}
              <p className="text-[10px] text-gray-300">{new Date(reviewPhoto.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        </div>
      )}

      {/* チャレンジ中断の確認（達成済みステップは保存・再参加で再開できることを明示） */}
      {quitConfirm && activeChallenge && (() => {
        const doneN = chDone?.size ?? 0;
        const total = activeChallenge.tasks.length;
        const isCompleted = db.getChallengeProgress().completed.includes(activeChallenge.id);
        // 未参加に戻る生成クエストの刻限（達成済みステップが無いと TTL 免除を失う）
        const ttl = doneN === 0 && !isCompleted ? ttlInfo(activeChallenge.createdAt, Date.now()) : null;
        return (
          <div className="absolute inset-0 z-[2500] bg-black/50 flex items-center justify-center p-6" onClick={() => setQuitConfirm(false)}>
            <div className="w-full max-w-[320px] bg-white rounded-3xl p-5 text-left celebrate-pop" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-black text-gray-900 mb-2">チャレンジを中断する？</h3>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-1">
                {doneN > 0
                  ? `達成済みのステップ（${doneN}/${total}）は保存され、また参加すれば続きから再開できます。`
                  : ttl
                  ? `中断すると刻限がふたたび進みます（${ttl.text}）。期限が切れるとこのクエストは消えます。`
                  : activeChallenge.createdAt
                  ? '刻限を過ぎているため、中断するとこのクエストは消えます。'
                  : '進捗はまだありません。'}
              </p>
              <p className="text-[12px] text-gray-400 leading-relaxed mb-4">道中の写真と軌跡は消えます。</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setQuitConfirm(false)}
                  className="flex-1 bg-gray-100 text-gray-600 text-sm font-black py-3 rounded-xl hover:bg-gray-200 cursor-pointer"
                >
                  続ける
                </button>
                <button
                  onClick={() => { setQuitConfirm(false); onClearChallenge?.(); }}
                  className="flex-1 bg-rose-600 text-white text-sm font-black py-3 rounded-xl hover:opacity-90 cursor-pointer"
                >
                  中断する
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 目的地100m到達：御朱印を自動授与（OKでクエスト達成・解除） */}
      {goshuinCelebrate && (
        <GoshuinCelebrate
          seed={goshuinCelebrate.godName || goshuinCelebrate.spot.name}
          godEmoji={goshuinCelebrate.spot.godEmoji || '🙏'}
          stampLabel={goshuinCelebrate.godName}
          spotName={goshuinCelebrate.spot.name}
          variant="near"
          position="absolute"
          onClose={() => { setGoshuinCelebrate(null); onCompleteChallenge?.(); }}
        />
      )}

      {/* ── 隠れスポット提案モーダル ── */}
      {proposingLoc && (
        <div className="absolute inset-0 z-[5000] flex items-center justify-center p-4" onClick={() => setProposingLoc(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-gray-900 mb-1">隠れスポットを提案</h3>
            <p className="text-[12px] text-gray-500 mb-4 leading-snug">地図上のこの場所に、まだ誰も知らない場を創り出しますか？</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">名前</label>
                <input
                  type="text"
                  value={propName}
                  onChange={(e) => setPropName(e.target.value)}
                  placeholder="例: 名もなきお地蔵様"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] outline-none focus:border-[#2563eb]"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">種類</label>
                <div className="flex gap-2">
                  {['神社', '寺院', 'その他'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setPropCategory(cat)}
                      className={`flex-1 py-2 rounded-xl text-[13px] font-bold border transition-colors ${
                        propCategory === cat ? 'bg-[#2563eb] text-white border-[#2563eb]' : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setProposingLoc(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 rounded-xl transition-colors text-[14px]"
              >
                やめる
              </button>
              <button
                onClick={submitProposal}
                disabled={!propName.trim()}
                className="flex-1 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 disabled:hover:bg-[#2563eb] text-white font-bold py-2.5 rounded-xl transition-colors text-[14px]"
              >
                提案する
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
