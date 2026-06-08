'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { X, Send, MapPin, MessageCircle, ShoppingBag, ImagePlus, Trash2, Camera, Flag } from 'lucide-react';
import { Spot, Agent, User, db } from '../lib/db';
import { getGodTasks, GodTask, TASK_TONE } from '../data/god-tasks';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  createdAt: string;
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

// 端末カメラ/ファイルから選んだ画像を縮小して data URL 化する。
// localStorage + クラウド同期に載せるため、長辺を抑え JPEG で圧縮してサイズを節約する。
const MAX_PHOTO_DIM = 1280; // 長辺の最大ピクセル
async function fileToCompressedDataUrl(file: File): Promise<string> {
  const rawUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  // 画像として読み込めない場合（HEIC 等）は元データをそのまま返す
  const img = document.createElement('img');
  const loaded = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = rawUrl;
  });
  if (!loaded || !img.naturalWidth) return rawUrl;

  const scale = Math.min(1, MAX_PHOTO_DIM / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return rawUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.82);
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
    systemPrompt: `あなたは「${spot.name}」(${spot.category})に宿る神霊「${godName}」です。${spot.description} この土地の歴史・見どころ・周辺の楽しみ方について、親しみやすくも神々しい口調で案内してください。返答は150文字以内。`,
    avatar3dUrl: 'shrine',
    haloColor: '#c5a028',
    accessoryType: 'なし',
    voiceTone: '神秘的',
  };
}

// 神の発話を一文字ずつ表示（話しているような演出）。完了後は renderDone で整形（URLリンク化など）。
function TypewriterText({
  text,
  speed = 26,
  renderDone,
  onTick,
}: {
  text: string;
  speed?: number;
  renderDone?: (t: string) => React.ReactNode;
  onTick?: () => void;
}) {
  const [n, setN] = useState(0);
  useEffect(() => { setN(0); }, [text]);
  useEffect(() => {
    if (n >= text.length) return;
    const id = setTimeout(() => setN((v) => Math.min(text.length, v + 1)), speed);
    return () => clearTimeout(id);
  }, [n, text, speed]);
  useEffect(() => { onTick?.(); }, [n, onTick]);
  if (n >= text.length) return <>{renderDone ? renderDone(text) : text}</>;
  return <>{text.slice(0, n)}<span className="ml-0.5 animate-pulse">▌</span></>;
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

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // チャット
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const ugc = useMemo(() => db.getUgcBySpot(spot.id), [spot.id, ugcTick]);
  const affiliates = db.getAffiliatesBySpot(spot.name);

  const godEmoji = spot.godEmoji || (spot.category === '神社' ? '⛩️' : '🙏');
  const tasks = getGodTasks(spot);
  const heroPhoto = photos[0] || spot.imageUrl || '';

  const flashToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 1800);
  };

  // ── 写真：投稿 / 却下 ──
  // 端末カメラ/ファイルピッカーを開く（実際の取り込みは onPickPhoto）
  const handlePostPhoto = () => {
    if (uploadingPhoto) return;
    photoInputRef.current?.click();
  };

  // 選択された画像を縮小して奉納する
  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 同じ画像を再選択しても onChange が発火するよう値をリセット
    e.target.value = '';
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      db.addSpotPhoto(currentUser.id, spot.id, dataUrl);
      db.recordTaskDone(currentUser.id, 'photo', spot.id, 30);
      setPhotos(db.getSpotPhotos(spot.id));
      setDoneTasks((prev) => ({ ...prev, photo: true }));
      flashToast('📸 写真を奉納！ +30徳');
      onChanged?.();
    } catch {
      flashToast('写真の読み込みに失敗しました');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRejectPhoto = (url: string) => {
    db.rejectSpotPhoto(spot.id, url);
    setPhotos(db.getSpotPhotos(spot.id));
    flashToast('不適切な写真を却下しました');
    onChanged?.();
  };

  // テキスト投稿が必要なタスク種別（コンテキスト収集を含む）
  const POST_TYPES = new Set(['context', 'review', 'event', 'eat', 'buy']);

  // ── 神の依頼タスク達成 ──
  const handleTask = (task: GodTask) => {
    if (doneTasks[task.type]) return;

    if (task.type === 'photo') {
      handlePostPhoto();
      return; // 写真が実際に選択・奉納された時点で done にする（onPickPhoto）
    } else if (POST_TYPES.has(task.type)) {
      // 実際に投稿（口コミ・できごと・実食・買物）→ 入力モーダルを開く
      setPostingTask(task);
      return; // 投稿完了時に done にする
    } else {
      // SNS / 清掃確認 など：その場で達成
      db.completeGodTask(currentUser.id, spot.id, task.reward);
      db.recordTaskDone(currentUser.id, task.type, spot.id, task.reward);
      flashToast(`${task.icon} 依頼を達成！ +${task.reward}徳`);
      onChanged?.();
    }
    setDoneTasks((prev) => ({ ...prev, [task.type]: true }));
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
    setDoneTasks((prev) => ({ ...prev, [postingTask.type]: true }));
    setUgcTick((t) => t + 1);
    flashToast(`${postingTask.icon} 投稿しました！ +徳`);
    onChanged?.();
    setPostingTask(null);
    setPostText('');
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

  // チャット初期あいさつ（会話の流れで「依頼」を自然に切り出す）
  useEffect(() => {
    if (tab === 'chat' && messages.length === 0) {
      const topTask = tasks[0];
      const hook = topTask
        ? `実はな…そなたに頼みたいことがあってのう。${topTask.call(spot.name)}（成し遂げれば徳を ${topTask.reward} 授けよう）`
        : 'この地のこと、何なりと尋ねるがよい。';
      setMessages([
        {
          id: `greet-${Date.now()}`,
          sender: 'agent',
          text: `よう参られた、${currentUser.displayName} よ。わしは${spot.name}に宿る「${agent.name}」じゃ。${hook}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, messages.length, agent.name, spot.name, currentUser.displayName]);

  const scrollToEnd = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages, isLoading, scrollToEnd]);

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
          tasks: tasks.map((t) => ({ type: t.type, icon: t.icon, label: t.label, title: t.title, reward: t.reward, call: t.call(spot.name) })),
        }),
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, sender: 'agent', text: data.response, createdAt: new Date().toISOString() }]);
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

  const PRESETS = ['何か頼みごとはある？', 'この場所の歴史は？', '見どころを教えて', '近くのおすすめは？'];

  return (
    <div className="fixed sm:absolute inset-0 z-[3000] bg-[#f5f7fa] flex flex-col animate-detail-enter">
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
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
          className="absolute left-4 z-[20] w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/70 active:scale-95 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="absolute bottom-3 left-4 right-4 text-white">
          <span className="text-[13px] font-bold bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full">{spot.category}</span>
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
          { key: 'requests', label: '依頼', icon: Flag },
          { key: 'photos', label: '写真', icon: Camera },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={`flex-1 py-3 flex flex-col items-center justify-center gap-0.5 text-[13px] font-black transition-all cursor-pointer border-b-2 ${tab === key ? 'text-shrine-red border-shrine-red' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>
            <Icon className="w-3.5 h-3.5" />
            <span className="truncate">{label}</span>
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
              <button onClick={handlePostPhoto} disabled={uploadingPhoto} className="flex items-center gap-1 text-[13px] font-black text-white bg-rose-500 px-3 py-1.5 rounded-full hover:opacity-90 transition-all cursor-pointer disabled:opacity-60">
                <ImagePlus className={`w-3.5 h-3.5 ${uploadingPhoto ? 'animate-pulse' : ''}`} />
                {uploadingPhoto ? '処理中…' : '写真を投稿'}
              </button>
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
            <h3 className="text-xs font-black text-gray-700 mb-1 flex items-center gap-1.5">
              <span className="text-base">{godEmoji}</span>
              {agent.name} からの依頼
            </h3>
            <p className="text-[13px] text-gray-400 mb-3">達成すると徳を授かり、この地の神が育っていく。依頼は徳の高い順。</p>
            <div className="space-y-2">
              {tasks.map((task) => {
                const tone = TASK_TONE[task.type];
                const done = doneTasks[task.type];
                return (
                  <div key={task.type} className={`rounded-xl border p-3 ${done ? 'bg-gray-50 border-gray-200 opacity-70' : `${tone.bg} ${tone.border}`}`}>
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl flex-shrink-0">{task.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className={`text-xs font-black ${done ? 'text-gray-500' : 'text-gray-800'}`}>{task.title}</h4>
                          <span className={`text-[11px] font-black ${tone.text}`}>+{task.reward}徳</span>
                        </div>
                        <p className="text-[13px] text-gray-500 leading-relaxed mt-0.5">{task.call(spot.name)}</p>
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
                    <span className={`text-[11px] text-gray-400 mb-0.5 ${isAgent ? 'text-left' : 'text-right'}`}>{isAgent ? agent.name : currentUser.displayName}</span>
                    <div className={`px-3.5 py-2.5 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap ${isAgent ? 'bg-amber-50 border border-amber-200/50 text-gray-800 rounded-tl-none' : 'bg-sky-50 border border-sky-200/60 text-gray-800 rounded-tr-none'}`}>
                      {isAgent
                        ? <TypewriterText text={msg.text} renderDone={formatText} onTick={scrollToEnd} />
                        : formatText(msg.text)}
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
          {messages.length <= 1 && !isLoading && (
            <div className="flex flex-wrap gap-1.5 px-3 pb-2 flex-shrink-0">
              {PRESETS.map((p, i) => (
                <button key={i} onClick={() => handleSend(p)} className="whitespace-nowrap bg-white border border-gray-200 px-3 py-1.5 rounded-full text-[13px] text-gray-600 hover:border-gold hover:text-amber-700 transition-all cursor-pointer">{p}</button>
              ))}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); handleSend(inputText); }} className="flex gap-2 p-3 border-t border-black/5 bg-white flex-shrink-0">
            <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={`${agent.name} に話しかける...`} disabled={isLoading} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold transition-all disabled:opacity-50" />
            <button type="submit" disabled={!inputText.trim() || isLoading} className="bg-shrine-red hover:opacity-90 text-white disabled:opacity-40 px-4 rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95">
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
            <p className="text-[13px] text-gray-500 mt-0.5">{postingTask.call(spot.name)}</p>
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

      {/* 写真投稿用の隠しファイル入力（端末カメラ優先） */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPickPhoto}
      />

      {/* トースト */}
      {toast && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[3100] bg-gray-900 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg animate-in">
          {toast}
        </div>
      )}
    </div>
  );
}
