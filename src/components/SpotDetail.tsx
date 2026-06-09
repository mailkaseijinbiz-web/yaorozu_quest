'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Send, MapPin, MessageCircle, ShoppingBag, ImagePlus, Trash2, Camera, Flag } from 'lucide-react';
import { Spot, Agent, User, db, isVerifiedSpot } from '../lib/db';
import { buildSpotTasks, GodTask, TASK_TONE, TASK_CATALOG, GOD_FUNCTIONS } from '../data/god-tasks';
import { distanceKm } from '../lib/geo';
import { uploadImage } from '../lib/upload';

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
}: SpotDetailProps) {
  const [tab, setTab] = useState<'chat' | 'requests' | 'photos'>('chat');
  const [agent] = useState<Agent>(() => resolveAgent(spot));

  // UGCで変化する状態（写真・楽しみ方）は db から都度読む
  const [photos, setPhotos] = useState<string[]>(() => db.getSpotPhotos(spot.id));
  const [enjoyments, setEnjoyments] = useState<string[]>(spot.enjoyments ?? []);
  const [doneTasks, setDoneTasks] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [ugcTick, setUgcTick] = useState(0); // 口コミいいね後の再読込
  const [postingTask, setPostingTask] = useState<GodTask | null>(null); // 投稿モーダル
  const [postText, setPostText] = useState('');
  const [uploading, setUploading] = useState(false); // 写真アップロード中
  const photoInputRef = useRef<HTMLInputElement>(null);
  // クエスト写真の評価タスク
  const [evaluating, setEvaluating] = useState(false);
  const [evalIdx, setEvalIdx] = useState(0);

  // チャット
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const ugc = useMemo(() => db.getUgcBySpot(spot.id), [spot.id, ugcTick]);
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

  const handleRejectPhoto = (url: string) => {
    db.rejectSpotPhoto(spot.id, url);
    setPhotos(db.getSpotPhotos(spot.id));
    flashToast('不適切な写真を却下しました');
    onChanged?.();
  };

  // テキスト投稿が必要なタスク種別（コンテキスト収集・課題解決を含む）
  const POST_TYPES = new Set(['context', 'review', 'event', 'eat', 'buy', 'resolveIssue']);

  // ── 神の依頼タスク達成 ──
  const handleTask = (task: GodTask) => {
    if (doneTasks[task.id]) return;

    if (task.type === 'photo') {
      handlePostPhoto(); // アップロード成功時に done にする
      return;
    } else if (task.type === 'evaluate') {
      if (evalPhotos.length === 0) { flashToast('まだ評価できる写真がありません'); return; }
      setEvalIdx(0);
      setEvaluating(true); // 評価し終えたら done にする
      return;
    } else if (POST_TYPES.has(task.type)) {
      // 実際に投稿（口コミ・できごと・実食・買物・課題解決の報告）→ 入力モーダルを開く
      setPostingTask(task);
      return; // 投稿完了時に done にする
    } else {
      // SNS / 清掃確認 / 来訪 など：その場で達成
      if (task.type === 'visit') db.recordVisit(currentUser.id, spot.id);
      db.completeGodTask(currentUser.id, spot.id, task.reward);
      db.recordTaskDone(currentUser.id, task.type, spot.id, task.reward);
      flashToast(`${task.icon} クエストを達成！ +${task.reward}徳`);
      onChanged?.();
    }
    setDoneTasks((prev) => ({ ...prev, [task.id]: true }));
  };

  // 投稿モーダルの送信（実際に口コミ等を投稿）
  const submitPost = () => {
    if (!postingTask || !postText.trim()) return;
    db.addUgcPost(currentUser.id, spot.id, postText.trim()); // UGC投稿（+50徳）
    db.recordTaskDone(currentUser.id, postingTask.type, spot.id, postingTask.reward);
    const grow = enjoymentForTask(postingTask, spot.name);
    if (grow) {
      db.addEnjoyment(spot.id, grow);
      setEnjoyments(db.getSpot(spot.id)?.enjoyments ?? []);
    }
    setDoneTasks((prev) => ({ ...prev, [postingTask.id]: true }));
    setUgcTick((t) => t + 1);
    flashToast(`${postingTask.icon} 投稿しました！ +徳`);
    onChanged?.();
    setPostingTask(null);
    setPostText('');
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
    }
  }, [tab, messages.length, agent.name, spot.name, currentUser.displayName, nearbyChallenge]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;
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

  const PRESETS = ['この場所の歴史は？', '見どころを教えて', '近くのおすすめは？'];

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
          { key: 'chat', label: '会話', icon: MessageCircle },
          { key: 'requests', label: 'クエスト', icon: Flag },
          { key: 'photos', label: '写真', icon: Camera },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={`flex-1 py-3 flex flex-row items-center justify-center gap-1.5 text-[13px] font-black transition-all cursor-pointer border-b-2 ${tab === key ? 'text-shrine-red border-shrine-red' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {tab === 'photos' ? (
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
            <p className="text-[13px] text-gray-400 mb-3">達成すると徳を授かり、この地の神が育っていく。クエストは神の3つの働き（情報収集・理解判断・操作）で分かれる。</p>
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
          {messages.length <= 3 && !isLoading && (
            <div className="px-3 pb-2 flex-shrink-0 space-y-1.5">
              {/* 能動的アクション：クエストに挑戦 / 依頼を見る */}
              <div className="flex flex-wrap gap-1.5">
                {nearbyChallenge && onStartChallenge && (
                  <button onClick={() => onStartChallenge(nearbyChallenge.id)} className="whitespace-nowrap bg-shrine-red text-white px-3 py-1.5 rounded-full text-[13px] font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-transform">
                    <Flag className="w-3 h-3" />クエストに挑戦
                  </button>
                )}
                <button onClick={() => setTab('requests')} className="whitespace-nowrap bg-indigo-600 text-white px-3 py-1.5 rounded-full text-[13px] font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-transform">
                  ⭐ クエストを見る
                </button>
              </div>
              {/* 質問プリセット */}
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p, i) => (
                  <button key={i} onClick={() => handleSend(p)} className="whitespace-nowrap bg-white border border-gray-200 px-3 py-1.5 rounded-full text-[13px] text-gray-600 hover:border-gold hover:text-amber-700 transition-all cursor-pointer">{p}</button>
                ))}
              </div>
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

      {/* 投稿モーダル（実際に口コミ・できごと等を投稿） */}
      {postingTask && (
        <div className="absolute inset-0 z-[3200] bg-black/40 flex items-end" onClick={() => { setPostingTask(null); setPostText(''); }}>
          <div className="w-full bg-white rounded-t-3xl p-4 pb-6 animate-in" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
              <span className="text-lg">{postingTask.icon}</span>{postingTask.title}
            </h3>
            <p className="text-[13px] text-gray-500 mt-0.5">{postingTask.call?.(spot.name)}</p>
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
                : '今のできごとを書いて投稿…'
              }
              className="w-full mt-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-shrine-red transition-all resize-none"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setPostingTask(null); setPostText(''); }} className="flex-1 bg-gray-100 text-gray-500 text-xs font-black py-2.5 rounded-xl cursor-pointer">やめる</button>
              <button onClick={submitPost} disabled={!postText.trim()} className="flex-1 bg-shrine-red text-white text-xs font-black py-2.5 rounded-xl disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5">
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
