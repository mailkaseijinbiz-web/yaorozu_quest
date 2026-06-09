'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Send, MapPin, MessageCircle, ShoppingBag, ImagePlus, Trash2, Camera, Flag, Landmark } from 'lucide-react';
import { Spot, Agent, User, db, isVerifiedSpot, type UgcVisibility } from '../lib/db';
import { buildSpotTasks, GodTask, TASK_TONE, TASK_CATALOG, GOD_FUNCTIONS } from '../data/god-tasks';
import { distanceKm } from '../lib/geo';
import { uploadImage } from '../lib/upload';
import { shareToSns } from '../lib/share';
import { grantGoShuin, hasGoShuin } from '../lib/goshuin';

// ── TTS（神の声）──────────────────────────────────────────
const _ttsCache = new Map<string, string>();
async function _fetchTtsUrl(text: string): Promise<string | null> {
  if (!text) return null;
  const cached = _ttsCache.get(text);
  if (cached) return cached;
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('audio')) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      _ttsCache.set(text, url);
      db.trackApiCall('tts');
      return url;
    }
  } catch { /* fallback */ }
  return null;
}
function _pickJaVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices().filter((v) => /^ja/i.test(v.lang));
  if (!voices.length) return null;
  return (
    voices.find((v) => /(enhanced|premium|neural|siri)/i.test(v.name)) ||
    voices.find((v) => /google/i.test(v.name)) ||
    voices.find((v) => /(kyoko|o-?ren|otoya|hattori|ichiro|nanami)/i.test(v.name)) ||
    voices[0]
  );
}
function _speakJa(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth || !text) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    const v = _pickJaVoice();
    if (v) u.voice = v;
    u.rate = 1.05;
    u.pitch = 1.45;
    synth.speak(u);
  } catch { /* TTS非対応環境は無視 */ }
}
// ────────────────────────────────────────────────────────────

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  createdAt: string;
  mode?: string; // 'gemini' | 'openai' | 'fallback_mock' | 'error_fallback'
}

interface SpotDetailProps {
  spot: Spot;
  currentUser: User;
  allSpots: Spot[];
  onClose: () => void;
  onOpenRelated?: (spot: Spot) => void;
  onChanged?: () => void; // 写真/楽しみ方/徳が変化した時に親へ通知
  onMessageSent?: () => void;
  onStartChallenge?: (challengeId: string) => void; // クエストタブから挑戦開始
  onGoShuinGranted?: () => void; // 御朱印を授かったとき親へ通知
}

// タスク達成時に「楽しみ方」へ追加されるテキスト（神がUGCで成長する）
function enjoymentForTask(task: GodTask, place: string): string | null {
  switch (task.type) {
    case 'context': return `今の様子：${place}の混雑・雰囲気をレポート。`;
    case 'review': return `巡礼者の声：${place}は心が落ち着く、また来たい場所。`;
    case 'eat': return `実食メモ：${place}で食べたものが美味しかった！`;
    case 'event': return `できごと：今日の${place}は活気があった。`;
    case 'buy': return `買物メモ：${place}で良い品が見つかった。`;
    default: return null;
  }
}

function resolveAgent(spot: Spot): Agent {
  const existing = db.getAgentBySpot(spot.id);
  if (existing) return existing;
  const godName = spot.godName || `${spot.name}の守り神`;
  return {
    id: `agent-synthetic-${spot.id}`,
    spotId: spot.id,
    name: godName,
    personaDescription: `${spot.name}に宿る八百万の神。`,
    systemPrompt: `あなたは「${spot.name}」(${spot.category})に宿る神霊「${godName}」です。${spot.description} この土地の歴史・見どころ・周辺の楽しみ方について、親しみやすくも神々しい口調で案内してください。会話の中では、巡礼者がこの街をもっと楽しめるよう、近くの「クエスト（街歩きの小さな冒険）」への挑戦や、あなたへの「依頼（徳を積むタスク）」を、押しつけがましくならない範囲で前向きに勧めてください。たとえば話題が一段落したら「ついでに近くの冒険に挑んでみぬか？」のように促します。返答は150文字以内。`,
    avatar3dUrl: 'shrine',
    haloColor: '#c5a028',
    accessoryType: 'なし',
    voiceTone: '神秘的',
  };
}

export default function SpotDetail({
  spot,
  currentUser,
  allSpots,
  onClose,
  onOpenRelated,
  onChanged,
  onMessageSent,
  onStartChallenge,
  onGoShuinGranted,
}: SpotDetailProps) {
  const [tab, setTab] = useState<'chat' | 'requests' | 'photos' | 'leaderboard'>('chat');
  const [agent] = useState<Agent>(() => resolveAgent(spot));

  // UGCで変化する状態（写真・楽しみ方）は db から都度読む
  const [photos, setPhotos] = useState<string[]>(() => db.getSpotPhotos(spot.id));
  const [enjoyments, setEnjoyments] = useState<string[]>(spot.enjoyments ?? []);
  const [doneTasks, setDoneTasks] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [ugcTick, setUgcTick] = useState(0); // 口コミいいね後の再読込
  const [postingTask, setPostingTask] = useState<GodTask | null>(null); // 投稿モーダル
  const [postText, setPostText] = useState('');
  const [postPhoto, setPostPhoto] = useState<string | null>(null); // 投稿に添付する写真
  const [postPhotoUploading, setPostPhotoUploading] = useState(false);
  const [postVisibility, setPostVisibility] = useState<UgcVisibility>('all'); // 公開範囲
  const postPhotoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false); // 写真アップロード中
  const photoInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null); // アバター写真タスク用
  // クエスト写真の評価タスク
  const [evaluating, setEvaluating] = useState(false);
  const [evalIdx, setEvalIdx] = useState(0);

  // チャット
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const greetSpokenRef = useRef<string | null>(null); // 読み上げ済みスポットID（二重再生防止）
  const stopAudio = () => {
    try { ttsAudioRef.current?.pause(); ttsAudioRef.current = null; } catch {}
    try { window.speechSynthesis?.cancel(); } catch {}
  };
  const speak = async (text: string) => {
    stopAudio();
    const url = await _fetchTtsUrl(text);
    // 取得中に他の speak が走っていたら鳴らさない
    if (ttsAudioRef.current !== null) return;
    if (url) {
      const audio = new Audio(url);
      ttsAudioRef.current = audio;
      audio.play().catch(() => _speakJa(text));
    } else {
      _speakJa(text);
    }
  };

  // 「あなただけ」の投稿は本人以外には見せない（AIの参照対象からも除外）
  const ugc = useMemo(
    () => db.getUgcBySpot(spot.id).filter((p) => (p.visibility ?? 'all') === 'all' || p.userId === currentUser.id),
    [spot.id, ugcTick, currentUser.id]
  );
  const affiliates = db.getAffiliatesBySpot(spot.name);

  const godEmoji = spot.godEmoji || (spot.category === '神社' ? '⛩️' : '🙏');
  const tasks = buildSpotTasks(spot);

  // 評価タスクの対象写真：クエスト証拠写真＋各スポットの奉納写真。不足時は巡礼地の代表写真で補完。
  const evalPhotos = useMemo(() => {
    const urls: string[] = [];
    db.getAllChallengePhotoUrls().forEach((u) => u && urls.push(u));
    allSpots.forEach((s) => (s.photos || []).forEach((u) => u && urls.push(u)));
    if (urls.length < 5) allSpots.forEach((s) => { if (s.imageUrl) urls.push(s.imageUrl); });
    return Array.from(new Set(urls)).slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSpots, spot.id]);
  const evalTarget = Math.min(3, evalPhotos.length);

  // このスポットに最も近い未制覇クエスト（会話で能動的に挑戦を促す）
  const nearbyChallenge = useMemo(() => {
    const prog = db.getChallengeProgress();
    const completed = new Set(prog.completed);
    return db.getAllQuests()
      .filter((c) => !completed.has(c.id) && c.id !== prog.activeId)
      .map((c) => ({ c, d: distanceKm(spot.latitude, spot.longitude, c.goalLat, c.goalLng) }))
      .sort((a, b) => a.d - b.d)[0]?.c ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot.id]);
  const heroPhoto = photos[0] || spot.imageUrl || '';

  const flashToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 1800);
  };

  // ── 写真：投稿 / 却下 ──
  // ファイル選択ダイアログ（端末カメラ/ライブラリ）を開く
  const handlePostPhoto = () => {
    if (uploading) return;
    photoInputRef.current?.click();
  };

  // 写真が選ばれたら圧縮→アップロード→奉納
  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 同じ画像の再選択でも発火させる
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, `spot-${spot.id}`);
      db.addSpotPhoto(currentUser.id, spot.id, url);
      db.recordTaskDone(currentUser.id, 'photo', spot.id, 30);
      setPhotos(db.getSpotPhotos(spot.id));
      setDoneTasks((prev) => ({ ...prev, photo: true }));
      flashToast('📸 写真を奉納！ +30徳');
      onChanged?.();
    } catch {
      flashToast('写真の投稿に失敗しました');
    } finally {
      setUploading(false);
    }
  };

  // アバター写真タスク：撮影→アップロード→ユーザーのアバターに設定→達成
  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, `avatar-${currentUser.id}`);
      db.setUserAvatar(currentUser.id, url);
      db.completeGodTask(currentUser.id, spot.id, TASK_CATALOG.avatar_photo.reward);
      db.recordTaskDone(currentUser.id, 'avatar_photo', spot.id, TASK_CATALOG.avatar_photo.reward);
      setDoneTasks((prev) => ({ ...prev, avatar_photo: true }));
      flashToast('🤳 アバターを設定！ +徳');
      onChanged?.();
    } catch {
      flashToast('写真の処理に失敗しました');
    } finally {
      setUploading(false);
    }
  };

  // 投稿モーダル：添付写真を選んで圧縮・アップロード
  const onPickPostPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPostPhotoUploading(true);
    try {
      const url = await uploadImage(file, `ugc-${spot.id}`);
      setPostPhoto(url);
    } catch {
      flashToast('写真の処理に失敗しました');
    } finally {
      setPostPhotoUploading(false);
    }
  };

  // 投稿モーダルを閉じて入力をリセット
  const closePostModal = () => {
    setPostingTask(null);
    setPostText('');
    setPostPhoto(null);
    setPostVisibility('all');
  };

  const handleRejectPhoto = (url: string) => {
    db.rejectSpotPhoto(spot.id, url);
    setPhotos(db.getSpotPhotos(spot.id));
    flashToast('不適切な写真を却下しました');
    onChanged?.();
  };

  // テキスト投稿で達成するタスク種別（価値・課題・煩悩の収集を含む）
  const POST_TYPES = new Set(['context', 'review', 'event', 'eat', 'buy', 'resolveIssue', 'value_ask', 'issue_ask', 'bonnou_ask', 'bonnou_resolve']);

  // ── 神の依頼タスク達成 ──
  const handleTask = async (task: GodTask) => {
    if (doneTasks[task.id]) return;

    if (task.type === 'photo') {
      handlePostPhoto(); // アップロード成功時に done にする
      return;
    } else if (task.type === 'avatar_photo') {
      avatarInputRef.current?.click(); // 撮影→アバターに設定→達成
      return;
    } else if (task.type === 'goshuin') {
      // 御朱印：既に授かっていれば即達成。未取得なら会話タブへ誘導（会話で授与される）。
      if (hasGoShuin(currentUser.id, spot.id)) {
        db.completeGodTask(currentUser.id, spot.id, task.reward);
        db.recordTaskDone(currentUser.id, task.type, spot.id, task.reward);
        setDoneTasks((prev) => ({ ...prev, [task.id]: true }));
        flashToast(`🔴 御朱印を授かっている！ +${task.reward}徳`);
        onChanged?.();
      } else {
        flashToast('「会話」タブで神と語らうと御朱印を授かれます');
        setTab('chat');
      }
      return;
    } else if (task.type === 'evaluate') {
      if (evalPhotos.length === 0) { flashToast('まだ評価できる写真がありません'); return; }
      setEvalIdx(0);
      setEvaluating(true); // 評価し終えたら done にする
      return;
    } else if (task.type === 'sns') {
      // 実際に共有：OSの共有シート（Web Share API）を開く。未対応ならリンクをコピー。
      const result = await shareToSns({
        title: 'YAOROZU QUEST',
        text: `${spot.name}（${spot.godName || agent.name}）を巡礼中！この地の神からの依頼に挑戦中です。 #ヤオロズクエスト #YAOROZUQUEST`,
        url: `${window.location.origin}/?spot=${spot.id}`,
        imageUrl: db.getPrimaryPhoto(spot.id) || undefined,
      });
      if (result === 'cancelled') { flashToast('共有をキャンセルしました'); return; }     // 達成にしない
      if (result === 'unavailable') { flashToast('この環境では共有できません'); return; } // 達成にしない
      // 共有 or コピー成功 → 達成として記録（徳付与は他タスクと同じく completeGodTask に一本化）
      db.completeGodTask(currentUser.id, spot.id, task.reward);
      db.recordTaskDone(currentUser.id, task.type, spot.id, task.reward);
      setDoneTasks((prev) => ({ ...prev, [task.id]: true }));
      flashToast(result === 'copied' ? `🔗 リンクをコピー！ +${task.reward}徳` : `📣 シェアしました！ +${task.reward}徳`);
      onChanged?.();
      return;
    } else if (POST_TYPES.has(task.type)) {
      // 実際に投稿（口コミ・できごと・実食・買物・課題解決の報告）→ 入力モーダルを開く
      setPostingTask(task);
      return; // 投稿完了時に done にする
    } else {
      // 清掃確認 / 来訪 など：その場で達成
      if (task.type === 'visit') db.recordVisit(currentUser.id, spot.id);
      db.completeGodTask(currentUser.id, spot.id, task.reward);
      db.recordTaskDone(currentUser.id, task.type, spot.id, task.reward);
      flashToast(`${task.icon} クエストを達成！ +${task.reward}徳`);
      onChanged?.();
    }
    setDoneTasks((prev) => ({ ...prev, [task.id]: true }));
  };

  // 投稿モーダルの送信（テキストまたは写真で投稿。タスク種別ごとに世界の値を調整する）
  const submitPost = () => {
    if (!postingTask) return;
    if (!postText.trim() && !postPhoto) return; // テキストも写真も無ければ送信しない
    if (postPhotoUploading) return;
    const t = postingTask.type;
    const text = postText.trim();

    if (t === 'bonnou_ask') {
      // 煩悩を打ち明ける：公開投稿はせず、本人の煩悩ストアに記録（覚りの調整素材）
      db.addBonnou(currentUser.id, text, spot.id);
      db.completeGodTask(currentUser.id, spot.id, postingTask.reward);
    } else if (t === 'bonnou_resolve') {
      // 煩悩を一つ手放す：未解決の煩悩を解決（覚り+1）
      db.resolveBonnou(currentUser.id);
      db.completeGodTask(currentUser.id, spot.id, postingTask.reward);
    } else {
      // 価値・課題・口コミ等：UGC として投稿（+50徳）
      db.addUgcPost(currentUser.id, spot.id, text, { imageUrl: postPhoto || undefined, visibility: postVisibility });
      // 世界の値を直接調整：価値→enjoyments / 課題→issues に加算
      if (t === 'value_ask' && text) db.addEnjoyment(spot.id, text);
      if (t === 'issue_ask' && text) db.addIssue(spot.id, text);
      const grow = enjoymentForTask(postingTask, spot.name);
      if (grow) db.addEnjoyment(spot.id, grow);
      setEnjoyments(db.getSpot(spot.id)?.enjoyments ?? []);
    }
    db.recordTaskDone(currentUser.id, t, spot.id, postingTask.reward);
    setDoneTasks((prev) => ({ ...prev, [postingTask.id]: true }));
    setUgcTick((t2) => t2 + 1);
    flashToast(`${postingTask.icon} 達成しました！`);
    onChanged?.();
    closePostModal();
  };

  // クエスト写真の評価：1枚ずつ👍/👎で評価し、規定枚数で達成
  const rateEval = () => {
    if (evalIdx + 1 >= evalTarget) {
      const reward = TASK_CATALOG.evaluate.reward;
      db.completeGodTask(currentUser.id, spot.id, reward);
      db.recordTaskDone(currentUser.id, 'evaluate', spot.id, reward);
      setDoneTasks((prev) => ({ ...prev, evaluate: true }));
      flashToast(`⭐ 評価ありがとう！ +${reward}徳`);
      onChanged?.();
      setEvaluating(false);
      setEvalIdx(0);
    } else {
      setEvalIdx((i) => i + 1);
    }
  };

  // 訪問を記録（探訪バッジ・ランキング用）。スポットが変わるたびに1回。
  // 画面遷移を妨げないよう、記録と親へのリフレッシュ通知は描画後に遅延実行する。
  useEffect(() => {
    const t = setTimeout(() => {
      db.recordVisit(currentUser.id, spot.id);
      onChanged?.();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot.id]);

  // チャット初期あいさつ
  useEffect(() => {
    if (tab === 'chat' && messages.length === 0) {
      const greet = nearbyChallenge
        ? `よう参られた、${currentUser.displayName} よ。わしは${spot.name}に宿る「${agent.name}」じゃ。ときに——この界隈で「${nearbyChallenge.title}」という小さな冒険が始まっておる。腕試しに挑んでみぬか？ 下のボタンから、すぐに旅立てるぞ。`
        : `よう参られた、${currentUser.displayName} よ。わしは${spot.name}に宿る「${agent.name}」じゃ。わしへの依頼をこなして徳を積み、この地を共に盛り立ててはくれぬか。`;
      setMessages([
        { id: `greet-${Date.now()}`, sender: 'agent', text: greet, createdAt: new Date().toISOString() },
      ]);
      // はじめて会話を始めた（チャットを開いた）瞬間に御朱印を授ける（スポットごとに1度）
      const stamp = grantGoShuin(
        currentUser.id,
        { id: spot.id, name: spot.name, category: spot.category, godEmoji: spot.godEmoji },
        agent.name
      );
      if (stamp) {
        flashToast(`🔴 ${spot.name} の御朱印を授かった！`);
        onGoShuinGranted?.();
      }
      // TTS（読み上げ）は UI から非表示の方針につき自動再生しない。機能コードは残置。
      // if (greetSpokenRef.current !== spot.id) { greetSpokenRef.current = spot.id; speak(greet); }
    }
    return () => { stopAudio(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, messages.length, agent.name, spot.name, currentUser.displayName, nearbyChallenge]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;
    // 御朱印はチャットを開いた時点（初回あいさつ）で授与済み
    const userMessage: Message = { id: `u-${Date.now()}`, sender: 'user', text: textToSend, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    if (onMessageSent) onMessageSent();
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages.map((m) => ({ sender: m.sender, text: m.text })),
          spotId: spot.id,
          agent,
          ugc,
          affiliates,
          userName: currentUser.displayName,
          spot: { name: spot.name, category: spot.category, description: spot.description, enjoyments, godName: spot.godName },
        }),
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      db.trackApiCall('ai_chat');
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, sender: 'agent', text: data.response, createdAt: new Date().toISOString(), mode: data.mode }]);
    } catch {
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, sender: 'agent', text: '神聖なる通信に乱れが生じた。しばし時をおいて、再び問いかけてくれ。', createdAt: new Date().toISOString() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatText = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) =>
      part.match(urlRegex) ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-amber-700 underline inline-flex items-center gap-1 font-bold bg-gold/10 px-2 py-0.5 rounded border border-gold/30 mt-1 cursor-pointer">
          <ShoppingBag className="w-3 h-3" />詳細はこちら
        </a>
      ) : (
        part
      )
    );
  };

  return (
    <div className="fixed sm:absolute inset-0 z-[3000] bg-[#f5f7fa] flex flex-col">
      {/* ── ヒーロー写真（無ければ NO IMAGE） ── */}
      <div className="relative h-52 flex-shrink-0 bg-gray-200">
        {heroPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroPhoto} alt={spot.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center px-6 bg-gray-100">
            <span className="text-sm font-black text-gray-400 tracking-[0.3em]">NO IMAGE</span>
            <p className="text-[13px] text-gray-400 mt-1.5">「写真」タブから最初の一枚を奉納しよう</p>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30 pointer-events-none" />
        <button
          onClick={onClose}
          aria-label="閉じる"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
          className="absolute left-4 z-[20] w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/70 active:scale-95 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="absolute bottom-3 left-4 right-4 text-white">
          <span className="text-[13px] font-bold bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full">{spot.category}</span>
          {isVerifiedSpot(spot) ? (
            <span className="ml-1.5 text-[12px] font-bold bg-emerald-500/80 backdrop-blur-md px-2 py-0.5 rounded-full">✓ 検証済み</span>
          ) : (
            <span className="ml-1.5 text-[12px] font-bold bg-gray-500/70 backdrop-blur-md px-2 py-0.5 rounded-full">未検証</span>
          )}
          <h1 className="text-2xl font-black mt-1.5 leading-tight drop-shadow-lg">{spot.name}</h1>
          <div className="flex items-center gap-1 mt-0.5 text-white/90">
            <MapPin className="w-3 h-3" />
            <span className="text-[13px]">{spot.latitude.toFixed(4)}, {spot.longitude.toFixed(4)}</span>
          </div>
        </div>
      </div>

      {/* ── タブ切替 ── */}
      <div className="flex border-b border-black/5 bg-white flex-shrink-0">
        {([
          { key: 'chat',        label: '会話',   icon: MessageCircle },
          { key: 'requests',    label: 'クエスト', icon: Flag },
          { key: 'photos',      label: '写真',   icon: Camera },
          { key: 'leaderboard', label: '石碑',   icon: Landmark },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={`flex-1 py-3 flex flex-row items-center justify-center gap-1.5 text-[12px] font-black transition-all cursor-pointer border-b-2 ${tab === key ? 'text-shrine-red border-shrine-red' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {tab === 'leaderboard' ? (
        /* ── 石碑（参拝者ランキング） ── */
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center gap-2 border-b border-black/5">
              <Landmark className="w-4 h-4 text-stone-500" />
              <h3 className="text-sm font-black text-gray-800">石碑</h3>
              <span className="text-[11px] text-gray-400 ml-auto">この地に捧げた徳</span>
            </div>
            {(() => {
              const ranking = db.getSpotRanking(spot.id);
              if (ranking.length === 0) {
                return (
                  <div className="text-center py-10">
                    <div className="text-4xl mb-2">🪨</div>
                    <p className="text-sm text-gray-400">まだ参拝者がいません</p>
                    <p className="text-xs text-gray-300 mt-1">この地で徳を積んで刻まれよう</p>
                  </div>
                );
              }
              const RANK_MEDAL = ['🥇','🥈','🥉'];
              return (
                <ul>
                  {ranking.map(({ user, toku }, i) => {
                    const isSelf = user.id === currentUser.id;
                    return (
                      <li key={user.id} className={`flex items-center gap-3 px-4 py-3 border-b border-black/4 last:border-0 ${isSelf ? 'bg-amber-50/60' : ''}`}>
                        <span className="w-6 text-center text-base flex-shrink-0">
                          {i < 3 ? RANK_MEDAL[i] : <span className="text-[12px] font-black text-gray-400">{i + 1}</span>}
                        </span>
                        <img src={user.avatarUrl} alt={user.displayName} className="w-8 h-8 rounded-full border-2 flex-shrink-0 object-cover" style={{ borderColor: user.avatarFrameColor || '#e5e7eb' }} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-black truncate ${isSelf ? 'text-amber-700' : 'text-gray-800'}`}>
                            {user.displayName}{isSelf && <span className="ml-1 text-[10px] text-amber-500">（あなた）</span>}
                          </p>
                          <p className="text-[10px] text-gray-400">{user.currentTitle || '巡礼者'}</p>
                        </div>
                        <span className="text-sm font-black text-amber-600 flex-shrink-0">{toku.toLocaleString()} 徳</span>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
          </div>
        </div>
      ) : tab === 'photos' ? (
        /* ── みんなの写真（タブ） ── */
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-gray-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-rose-500" />
                みんなの写真 ({photos.length})
              </h3>
              <button onClick={handlePostPhoto} disabled={uploading} className="flex items-center gap-1 text-[13px] font-black text-white bg-rose-500 px-3 py-1.5 rounded-full hover:opacity-90 transition-all cursor-pointer disabled:opacity-50">
                <ImagePlus className="w-3.5 h-3.5" />
                {uploading ? '投稿中…' : '写真を投稿'}
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickPhoto} />
              <input ref={avatarInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onPickAvatar} />
            </div>
            {photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="text-sm font-black text-gray-300 tracking-[0.3em]">NO IMAGE</span>
                <p className="text-[13px] text-gray-400 mt-2">まだ写真がありません。<br />最初の一枚を奉納しよう。</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((url) => (
                  <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-black/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="投稿写真" className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRejectPhoto(url)}
                      title="不適切な写真を却下"
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-shrine-red transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {photos.length > 0 && (
              <p className="text-[11px] text-gray-400 mt-3">※ 不適切な写真は 🗑 で却下できます（コミュニティ・モデレーション）。</p>
            )}
          </div>
        </div>
      ) : tab === 'requests' ? (
        /* ── 神様からの依頼（タブ） ── */
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5">
            <h3 className="text-lg font-black text-gray-800 mb-1 flex items-center gap-2">
              <span className="text-2xl">{godEmoji}</span>
              {agent.name} からのクエスト
            </h3>
            <p className="text-[13px] text-gray-400 mb-3">達成すると徳を授かり、この地の神が育っていく。</p>
            <div className="space-y-4">
              {GOD_FUNCTIONS.map((fn) => {
                const groupTasks = tasks.filter((t) => t.kind === fn.key);
                if (groupTasks.length === 0) return null;
                return (
                  <div key={fn.key} className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{fn.icon}</span>
                      <span className="text-[13px] font-black text-gray-700">{fn.label}</span>
                      <span className="text-[11px] text-gray-400 truncate">{fn.desc}</span>
                    </div>
                    {groupTasks.map((task) => {
                      const tone = TASK_TONE[task.type];
                      const done = doneTasks[task.id];
                      return (
                        <div key={task.id} className={`rounded-xl border p-3 ${done ? 'bg-gray-50 border-gray-200 opacity-70' : `${tone.bg} ${tone.border}`}`}>
                          <div className="flex items-start gap-2.5">
                            <span className="text-xl flex-shrink-0">{task.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className={`text-base font-black ${done ? 'text-gray-500' : 'text-gray-800'}`}>{task.title}</h4>
                                <span className={`text-xs font-black ${tone.text}`}>+{task.reward}徳</span>
                              </div>
                              <p className="text-[13px] text-gray-500 leading-relaxed mt-0.5">{task.call?.(spot.name)}</p>
                            </div>
                            <button
                              onClick={() => handleTask(task)}
                              disabled={done}
                              className={`flex-shrink-0 text-[13px] font-black px-3 py-1.5 rounded-full transition-all cursor-pointer ${done ? 'bg-gray-200 text-gray-400' : 'bg-shrine-red text-white hover:opacity-90 active:scale-95'}`}
                            >
                              {done ? '達成済' : task.label}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ── チャット ── */
        <div className="flex-1 flex flex-col min-h-0 bg-[#f5f7fa]">
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((msg) => {
              const isAgent = msg.sender === 'agent';
              return (
                <div key={msg.id} className={`flex items-start gap-2 ${isAgent ? '' : 'flex-row-reverse'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-base flex-shrink-0 border ${isAgent ? 'bg-amber-50 border-gold/30' : 'bg-sky-50 border-sky-200'}`}>
                    {isAgent ? godEmoji : '🧑‍🚀'}
                  </div>
                  <div className="flex flex-col max-w-[78%]">
                    <span className={`text-[11px] text-gray-400 mb-0.5 flex items-center gap-1 ${isAgent ? 'text-left' : 'text-right flex-row-reverse'}`}>
                      {isAgent ? agent.name : currentUser.displayName}
                      {isAgent && (msg.mode === 'fallback_mock' || msg.mode === 'error_fallback') && (
                        <span className="text-[9px] font-bold text-gray-400 bg-gray-100 border border-gray-200 px-1 py-px rounded-full">定型応答</span>
                      )}
                    </span>
                    <div className={`px-3 py-2 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${isAgent ? 'bg-amber-50 border border-amber-200/50 text-gray-800 rounded-tl-none' : 'bg-sky-50 border border-sky-200/60 text-gray-800 rounded-tr-none'}`}>
                      {formatText(msg.text)}
                    </div>
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-base bg-amber-50 border border-gold/30 animate-pulse">{godEmoji}</div>
                <div className="bg-amber-50 border border-amber-200/50 px-3 py-2 rounded-2xl rounded-tl-none flex items-center gap-1 h-7">
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {messages.length <= 3 && !isLoading && nearbyChallenge && onStartChallenge && (
            <div className="px-3 pb-2 flex-shrink-0">
              <button onClick={() => onStartChallenge(nearbyChallenge.id)} className="whitespace-nowrap bg-shrine-red text-white px-3 py-1.5 rounded-full text-[13px] font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-transform">
                <Flag className="w-3 h-3" />このクエストに挑戦する
              </button>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); handleSend(inputText); }} className="flex gap-2 p-3 border-t border-black/5 bg-white flex-shrink-0">
            <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={`${agent.name} に話しかける...`} disabled={isLoading} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold transition-all disabled:opacity-50" />
            <button type="submit" aria-label="メッセージを送信" disabled={!inputText.trim() || isLoading} className="bg-shrine-red hover:opacity-90 text-white disabled:opacity-40 px-4 rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* 投稿モーダル（テキストまたは写真で投稿。公開範囲を選べる） */}
      {postingTask && (
        <div className="absolute inset-0 z-[3200] bg-black/40 flex items-end" onClick={closePostModal}>
          <div className="w-full bg-white rounded-t-3xl p-4 pb-6 animate-in" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
              <span className="text-lg">{postingTask.icon}</span>{postingTask.title}
            </h3>
            <p className="text-[13px] text-gray-500 mt-0.5">{postingTask.call?.(spot.name)}</p>
            {postingTask.type === 'resolveIssue' && (
              <p className="text-[11px] text-gray-400 mt-1">テキスト・写真のどちらか（または両方）で報告できます。</p>
            )}
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              rows={4}
              autoFocus
              placeholder={
                postingTask.type === 'context' ? '今の混雑・雰囲気・営業の様子を書いて報告…'
                : postingTask.type === 'review' ? `${spot.name}の良さを書いて投稿…`
                : postingTask.type === 'eat' ? '食べた感想を書いて投稿…'
                : postingTask.type === 'buy' ? '買ったものを書いて投稿…'
                : postingTask.type === 'resolveIssue' ? '解決の様子をテキストで報告（写真だけでも可）…'
                : '今のできごとを書いて投稿…'
              }
              className="w-full mt-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-shrine-red transition-all resize-none"
            />

            {/* 写真の添付 */}
            <input ref={postPhotoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickPostPhoto} />
            {postPhoto ? (
              <div className="relative mt-3 rounded-xl overflow-hidden border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={postPhoto} alt="添付写真" className="w-full max-h-44 object-cover" />
                <button
                  onClick={() => setPostPhoto(null)}
                  aria-label="写真を外す"
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-shrine-red transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => postPhotoInputRef.current?.click()}
                disabled={postPhotoUploading}
                className="mt-3 w-full flex items-center justify-center gap-1.5 bg-gray-50 border border-dashed border-gray-300 text-gray-600 text-xs font-black py-2.5 rounded-xl hover:border-shrine-red hover:text-shrine-red transition-all cursor-pointer disabled:opacity-50"
              >
                <ImagePlus className="w-4 h-4" />{postPhotoUploading ? '処理中…' : '写真を添付（任意）'}
              </button>
            )}

            {/* 公開範囲 */}
            <div className="mt-3">
              <p className="text-[11px] font-black text-gray-400 mb-1">公開範囲</p>
              <div className="flex gap-1.5">
                {([
                  { v: 'all' as UgcVisibility, label: 'すべて', icon: '🌐' },
                  { v: 'self' as UgcVisibility, label: 'あなただけ', icon: '🔒' },
                ]).map(({ v, label, icon }) => (
                  <button
                    key={v}
                    onClick={() => setPostVisibility(v)}
                    className={`flex-1 text-[12px] font-black py-2 rounded-xl border transition-all cursor-pointer ${postVisibility === v ? 'bg-shrine-red text-white border-shrine-red' : 'bg-white text-gray-500 border-gray-200 hover:border-shrine-red/40'}`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button onClick={closePostModal} className="flex-1 bg-gray-100 text-gray-500 text-xs font-black py-2.5 rounded-xl cursor-pointer">やめる</button>
              <button onClick={submitPost} disabled={(!postText.trim() && !postPhoto) || postPhotoUploading} className="flex-1 bg-shrine-red text-white text-xs font-black py-2.5 rounded-xl disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5">
                <Send className="w-3.5 h-3.5" />投稿する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* クエスト写真の評価モーダル（巡礼者の一枚を👍/👎で評価） */}
      {evaluating && evalTarget > 0 && (
        <div className="absolute inset-0 z-[3200] bg-black/60 flex items-center justify-center p-5" onClick={() => setEvaluating(false)}>
          <div className="w-full max-w-[340px] bg-white rounded-3xl p-4 animate-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5"><span className="text-lg">⭐</span>クエスト写真を評価</h3>
              <span className="text-[11px] font-black text-gray-400 tabular-nums">{evalIdx + 1} / {evalTarget}</span>
            </div>
            <p className="text-[12px] text-gray-500 mb-2.5">巡礼者が奉納した一枚です。佳いと思うか、そなたの目で評しておくれ。</p>
            <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={evalPhotos[evalIdx % evalPhotos.length]} alt="評価する写真" className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={rateEval} className="flex-1 py-3 rounded-full bg-gray-100 text-gray-600 font-black text-sm cursor-pointer active:scale-95 transition-transform">👎 イマイチ</button>
              <button onClick={rateEval} className="flex-1 py-3 rounded-full bg-indigo-600 text-white font-black text-sm cursor-pointer active:scale-95 transition-transform">👍 佳い</button>
            </div>
            <div className="flex items-center justify-center gap-1 mt-3">
              {Array.from({ length: evalTarget }).map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i < evalIdx ? 'w-4 bg-indigo-500' : i === evalIdx ? 'w-4 bg-indigo-300' : 'w-1.5 bg-gray-200'}`} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* トースト */}
      {toast && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[3100] bg-gray-900 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg animate-in">
          {toast}
        </div>
      )}
    </div>
  );
}
