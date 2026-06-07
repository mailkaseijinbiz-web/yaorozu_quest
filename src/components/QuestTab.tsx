'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Check, ArrowRight, Shield, Award, Calendar, Sparkles, MapPin, Lock, ShieldCheck, Palette, Cpu, Settings2, AlertTriangle, Plus, Users, Send, X } from 'lucide-react';
import { Spot, Agent, User, UgcPost, db } from '../lib/db';

// ユーザー投稿クエスト型
export interface UserQuest {
  id: string;
  creatorId: string;
  creatorName: string;
  title: string;
  description: string;
  reward: number;
  targetSpotName: string;
  createdAt: string;
  completedBy: string[]; // user IDs who completed
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  category: 'daily' | 'pilgrimage' | 'achievement';
  reward: number;
  targetCount: number;
  currentCount: (params: {
    currentUser: User;
    spots: Spot[];
    ugcList: UgcPost[];
  }) => number;
  actionText: string;
  targetTab: 'map' | 'chat' | 'ar' | 'quest';
}

const INITIAL_QUESTS: Quest[] = [
  // Daily Quests
  {
    id: 'quest-daily-visit',
    title: '今日のお参り (巡礼)',
    description: 'いずれかの神社・寺院の周辺1km以内に接近する（ワープ可）。',
    category: 'daily',
    reward: 30,
    targetCount: 1,
    currentCount: () => 0,
    actionText: 'レーダーを見る',
    targetTab: 'map',
  },
  {
    id: 'quest-daily-chat',
    title: '神仏との対話',
    description: '神様（AIエージェント）に1回以上メッセージを送信する。',
    category: 'daily',
    reward: 20,
    targetCount: 1,
    currentCount: () => 0,
    actionText: '対話する',
    targetTab: 'chat',
  },
  
  // Pilgrimage Quests
  {
    id: 'quest-pilgrimage-post',
    title: '歴史の語り部',
    description: '浅草寺 (金龍山) に口コミ（UGC）を1回投稿する。',
    category: 'pilgrimage',
    reward: 50,
    targetCount: 1,
    currentCount: ({ ugcList, currentUser }) => {
      return ugcList.filter(u => u.spotId === 'spot-sensoji' && u.userId === currentUser.id).length;
    },
    actionText: '口コミを書く',
    targetTab: 'map',
  },
  {
    id: 'quest-pilgrimage-ar',
    title: '神霊との遭遇',
    description: 'いずれかのスポットで神様アバターをAR召喚し写真を撮影する。',
    category: 'pilgrimage',
    reward: 80,
    targetCount: 1,
    currentCount: () => 0,
    actionText: 'ARカメラを開く',
    targetTab: 'ar',
  },

  // Achievements
  {
    id: 'quest-achieve-toku',
    title: '信仰の深まり',
    description: '累計徳ポイントを 300 pts 以上にする。',
    category: 'achievement',
    reward: 150,
    targetCount: 300,
    currentCount: ({ currentUser }) => currentUser.totalToku,
    actionText: '徳を積む',
    targetTab: 'map',
  },
  {
    id: 'quest-achieve-creator',
    title: '創世主への目覚め',
    description: 'いずれか1つ以上のスポットで「創世主」の称号を獲得する。',
    category: 'achievement',
    reward: 250,
    targetCount: 1,
    currentCount: ({ spots, currentUser }) => {
      return spots.filter(s => s.creatorId === currentUser.id).length;
    },
    actionText: '創世主を目指す',
    targetTab: 'quest',
  }
];

const ACCESSORY_OPTIONS = ['なし', '鏡', '剣', '扇子'];
const VOICE_TONE_OPTIONS: ('厳格' | '親しみやすい' | '神秘的' | '高飛車' | '賢者')[] = [
  '厳格', '親しみやすい', '神秘的', '高飛車', '賢者',
];
const HALO_COLORS = [
  { name: '太陽 (ゴールド)', hex: '#FFD700' },
  { name: '稲荷 (朱色)', hex: '#FF4500' },
  { name: '翡翠 (グリーン)', hex: '#32CD32' },
  { name: '清流 (シアン)', hex: '#40E0D0' },
  { name: '深海 (ブルー)', hex: '#1E90FF' },
  { name: '霊気 (パープル)', hex: '#A020F0' },
];

interface QuestTabProps {
  currentUser: User;
  spots: Spot[];
  claimedQuests: string[];
  onClaimReward: (questId: string, reward: number) => void;
  onNavigateTab: (tab: 'map' | 'chat' | 'ar' | 'quest') => void;
  isNearAnySpot: boolean;
  hasChatted: boolean;
  hasTakenPhoto: boolean;
  // CreatorTab props
  activeSpot: Spot | null;
  agent: Agent | null;
  onUpdateAgent: (updated: Agent) => void;
  userTokuAtSpot: number;
  currentCreatorToku: number;
}

export default function QuestTab({
  currentUser,
  spots,
  claimedQuests,
  onClaimReward,
  onNavigateTab,
  isNearAnySpot,
  hasChatted,
  hasTakenPhoto,
  activeSpot,
  agent,
  onUpdateAgent,
  userTokuAtSpot,
  currentCreatorToku,
}: QuestTabProps) {
  const allUgc = db.getUgc();

  // ── コミュニティクエスト state ──
  const [userQuests, setUserQuests] = useState<UserQuest[]>([]);
  const [showQuestForm, setShowQuestForm] = useState(false);
  const [qTitle, setQTitle] = useState('');
  const [qDesc, setQDesc] = useState('');
  const [qReward, setQReward] = useState(30);
  const [qSpot, setQSpot] = useState('');
  const [postSuccess, setPostSuccess] = useState(false);

  // localStorage から読み込み
  useEffect(() => {
    const saved = localStorage.getItem('yaorozu_user_quests');
    if (saved) setUserQuests(JSON.parse(saved));
  }, []);

  const saveUserQuests = (quests: UserQuest[]) => {
    setUserQuests(quests);
    localStorage.setItem('yaorozu_user_quests', JSON.stringify(quests));
  };

  const handlePostQuest = () => {
    if (!qTitle.trim() || !qDesc.trim()) return;
    const newQuest: UserQuest = {
      id: `uq-${Date.now()}`,
      creatorId: currentUser.id,
      creatorName: currentUser.displayName,
      title: qTitle.trim(),
      description: qDesc.trim(),
      reward: qReward,
      targetSpotName: qSpot,
      createdAt: new Date().toISOString(),
      completedBy: [],
    };
    saveUserQuests([newQuest, ...userQuests]);
    setQTitle('');
    setQDesc('');
    setQReward(30);
    setQSpot('');
    setShowQuestForm(false);
    setPostSuccess(true);
    setTimeout(() => setPostSuccess(false), 2000);
  };

  const handleCompleteUserQuest = (questId: string) => {
    const updated = userQuests.map(q =>
      q.id === questId && !q.completedBy.includes(currentUser.id)
        ? { ...q, completedBy: [...q.completedBy, currentUser.id] }
        : q
    );
    saveUserQuests(updated);
    // 徳を付与
    const quest = userQuests.find(q => q.id === questId);
    if (quest) onClaimReward(questId, quest.reward);
  };

  const handleDeleteUserQuest = (questId: string) => {
    saveUserQuests(userQuests.filter(q => q.id !== questId));
  };

  // Creator customizer state
  const [name, setName] = useState('');
  const [personaDescription, setPersonaDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [haloColor, setHaloColor] = useState('');
  const [accessoryType, setAccessoryType] = useState('');
  const [voiceTone, setVoiceTone] = useState<'厳格' | '親しみやすい' | '神秘的' | '高飛車' | '賢者'>('親しみやすい');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setPersonaDescription(agent.personaDescription);
      setSystemPrompt(agent.systemPrompt);
      setHaloColor(agent.haloColor);
      setAccessoryType(agent.accessoryType);
      setVoiceTone(agent.voiceTone);
    }
  }, [agent]);

  const isCreator = activeSpot?.creatorId === currentUser.id;

  const handleSave = () => {
    if (!isCreator || !activeSpot) return;
    setIsSaving(true);
    setSaveSuccess(false);
    setTimeout(() => {
      const updatedAgent = db.updateAgent(activeSpot.id, {
        name, personaDescription, systemPrompt, haloColor, accessoryType, voiceTone,
      });
      onUpdateAgent(updatedAgent);
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 800);
  };

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto pr-1">
      {/* Tab Header */}
      <div className="flex items-center justify-between border-b border-black/5 pb-3">
        <div>
          <h2 className="text-xl font-bold text-amber-700 flex items-center gap-2">
            <Award className="w-5 h-5 text-gold animate-pulse" />
            クエスト
          </h2>
          <p className="text-xs text-gray-500">達成するとボーナス徳を獲得できます。</p>
        </div>
        {/* 投稿ボタン */}
        <button
          onClick={() => setShowQuestForm(!showQuestForm)}
          className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer shadow-sm ${
            showQuestForm
              ? 'bg-gray-100 text-gray-600'
              : 'bg-shrine-red text-white shadow-shrine-red/20'
          }`}
        >
          {showQuestForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showQuestForm ? 'キャンセル' : 'クエスト投稿'}
        </button>
      </div>

      {/* ── クエスト投稿フォーム ── */}
      {showQuestForm && (
        <div className="glass-panel bg-white/90 border border-shrine-red/20 rounded-2xl p-4 space-y-3 shadow-md">
          <h3 className="text-xs font-black text-gray-800 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-shrine-red" />
            新しいクエストを作成
          </h3>
          <div className="space-y-1.5">
            <label className="text-[9px] text-gray-500 font-bold block">クエスト名 *</label>
            <input
              type="text"
              value={qTitle}
              onChange={e => setQTitle(e.target.value)}
              maxLength={30}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-shrine-red transition-all"
              placeholder="例: 明治神宮で写真を撮る"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] text-gray-500 font-bold block">説明文 *</label>
            <textarea
              value={qDesc}
              onChange={e => setQDesc(e.target.value)}
              rows={2}
              maxLength={100}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-shrine-red transition-all leading-relaxed resize-none"
              placeholder="例: 明治神宮の大鳥居の前で記念写真を撮影してください。"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] text-gray-500 font-bold block">報酬 (徳pt)</label>
              <select
                value={qReward}
                onChange={e => setQReward(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-shrine-red transition-all"
              >
                {[10, 20, 30, 50, 80, 100].map(v => (
                  <option key={v} value={v}>+{v} 徳</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] text-gray-500 font-bold block">対象スポット</label>
              <select
                value={qSpot}
                onChange={e => setQSpot(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-shrine-red transition-all"
              >
                <option value="">指定なし</option>
                {spots.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handlePostQuest}
            disabled={!qTitle.trim() || !qDesc.trim()}
            className="w-full bg-shrine-red hover:opacity-90 text-white py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            クエストを投稿する
          </button>
        </div>
      )}

      {postSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" />
          クエストを投稿しました！
        </div>
      )}

      {/* Quest Columns */}
      <div className="space-y-5">
        {(['daily', 'pilgrimage', 'achievement'] as const).map((cat) => {
          const catQuests = INITIAL_QUESTS.filter(q => q.category === cat);
          const catTitle = cat === 'daily' ? 'デイリー修行' : cat === 'pilgrimage' ? '霊地巡礼' : '偉大なアチーブメント';
          const catIcon = cat === 'daily'
            ? <Calendar className="w-4 h-4 text-cyber-blue" />
            : cat === 'pilgrimage'
            ? <MapPin className="w-4 h-4 text-shrine-red" />
            : <Shield className="w-4 h-4 text-gold" />;

          return (
            <div key={cat} className="space-y-2.5">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                {catIcon}
                {catTitle}
              </h3>

              <div className="grid grid-cols-1 gap-3">
                {catQuests.map((quest) => {
                  const isClaimed = claimedQuests.includes(quest.id);

                  let currentVal = 0;
                  if (quest.id === 'quest-daily-visit') {
                    currentVal = isNearAnySpot ? 1 : 0;
                  } else if (quest.id === 'quest-daily-chat') {
                    currentVal = hasChatted ? 1 : 0;
                  } else if (quest.id === 'quest-pilgrimage-ar') {
                    currentVal = hasTakenPhoto ? 1 : 0;
                  } else {
                    currentVal = quest.currentCount({ currentUser, spots, ugcList: allUgc });
                  }

                  const isComplete = currentVal >= quest.targetCount;
                  const canClaim = isComplete && !isClaimed;

                  return (
                    <div
                      key={quest.id}
                      className={`glass-panel p-3.5 rounded-2xl border-black/5 flex flex-col justify-between gap-3 transition-all relative ${
                        isClaimed
                          ? 'opacity-50 border-black/5 bg-gray-50 shadow-none'
                          : canClaim
                          ? 'border-amber-400 bg-amber-50/30 shadow-md shadow-gold/5'
                          : 'bg-white/80 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-gray-800 flex items-center gap-1.5 leading-tight">
                            {quest.title}
                            {isClaimed && (
                              <span className="text-[8px] bg-gray-150 border border-gray-250 text-gray-500 px-1.5 py-0.2 rounded font-normal">
                                請求済
                              </span>
                            )}
                          </h4>
                          <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">
                            {quest.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 bg-amber-50 border border-amber-300 text-amber-700 text-[9px] font-black px-2.5 py-0.8 rounded-full flex-shrink-0">
                          <Trophy className="w-2.5 h-2.5 text-gold" />
                          <span>+{quest.reward} 徳</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-black/5">
                        <div className="flex-1 max-w-[150px] space-y-1">
                          <div className="flex justify-between text-[9px] text-gray-500 font-mono leading-none">
                            <span>進捗</span>
                            <span>{Math.min(quest.targetCount, currentVal)} / {quest.targetCount}</span>
                          </div>
                          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden border border-gray-200/50">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${isComplete ? 'bg-gold' : 'bg-cyber-blue'}`}
                              style={{ width: `${Math.min(100, (currentVal / quest.targetCount) * 100)}%` }}
                            />
                          </div>
                        </div>

                        {isClaimed ? (
                          <span className="text-gray-500 text-[10px] font-bold flex items-center gap-0.5">
                            <Check className="w-3.5 h-3.5 text-gray-500" />
                            修行完了
                          </span>
                        ) : canClaim ? (
                          <button
                            onClick={() => onClaimReward(quest.id, quest.reward)}
                            className="bg-gold hover:bg-gold-light text-amber-950 text-[10px] font-black px-4 py-1.5 rounded-xl flex items-center gap-1 shadow-lg shadow-gold/20 hover:scale-105 active:scale-95 transition-all cursor-pointer animate-pulse"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            徳を請求する
                          </button>
                        ) : (
                          <button
                            onClick={() => onNavigateTab(quest.targetTab)}
                            className="text-gray-500 hover:text-gray-800 text-[10px] font-bold py-1.5 flex items-center gap-0.5 group cursor-pointer"
                          >
                            <span>{quest.actionText}</span>
                            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-all" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── コミュニティクエスト ─── */}
      <div className="border-t border-black/5 pt-5 space-y-3">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <Users className="w-4 h-4 text-cyber-blue" />
          コミュニティクエスト
          <span className="ml-auto text-[9px] bg-cyber-blue/10 border border-cyber-blue/20 text-cyber-blue px-2 py-0.5 rounded-full font-bold">
            {userQuests.length} 件
          </span>
        </h3>

        {userQuests.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-gray-200 rounded-2xl text-[10px] text-gray-400 bg-white/60">
            <Plus className="w-6 h-6 mx-auto mb-2 text-gray-300" />
            まだ投稿されたクエストがありません。<br />
            「クエスト投稿」ボタンから作成しましょう！
          </div>
        ) : (
          <div className="space-y-3">
            {userQuests.map((uq) => {
              const isCompleted = uq.completedBy.includes(currentUser.id);
              const isOwner = uq.creatorId === currentUser.id;
              return (
                <div
                  key={uq.id}
                  className={`glass-panel p-3.5 rounded-2xl border-black/5 flex flex-col gap-2.5 transition-all relative ${
                    isCompleted ? 'opacity-60 bg-gray-50 shadow-none' : 'bg-white/80 shadow-sm'
                  }`}
                >
                  {/* 投稿者・削除ボタン */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 bg-cyber-blue/15 rounded-full flex items-center justify-center text-[9px]">🧑</span>
                      <span className="text-[9px] text-gray-500 font-bold">{uq.creatorName}</span>
                      {uq.targetSpotName && (
                        <span className="text-[8px] bg-gray-100 border border-gray-200 text-gray-500 px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                          <MapPin className="w-2 h-2" />
                          {uq.targetSpotName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] text-gray-400">
                        {new Date(uq.createdAt).toLocaleDateString('ja-JP')}
                      </span>
                      {isOwner && !isCompleted && (
                        <button
                          onClick={() => handleDeleteUserQuest(uq.id)}
                          className="text-gray-300 hover:text-shrine-red transition-all cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* タイトル・説明 */}
                  <div>
                    <h4 className="font-bold text-xs text-gray-800 leading-tight">{uq.title}</h4>
                    <p className="text-[10px] text-gray-600 mt-0.5 leading-relaxed">{uq.description}</p>
                  </div>

                  {/* 報酬・完了ボタン */}
                  <div className="flex items-center justify-between pt-1 border-t border-black/5">
                    <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded-full">
                      <Trophy className="w-2.5 h-2.5 text-gold" />
                      <span>+{uq.reward} 徳</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] text-gray-400">{uq.completedBy.length}人達成</span>
                      {isCompleted ? (
                        <span className="text-[10px] text-gray-500 font-bold flex items-center gap-0.5">
                          <Check className="w-3.5 h-3.5 text-green-500" />
                          達成済
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCompleteUserQuest(uq.id)}
                          className="bg-gold hover:opacity-90 text-amber-950 text-[10px] font-black px-3 py-1 rounded-lg flex items-center gap-1 shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          達成！
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── 創世主セクション ─── */}

      <div className="border-t border-black/5 pt-5 space-y-3">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-gold" />
          創世主設定
        </h3>

        {!activeSpot ? (
          <div className="flex flex-col items-center justify-center py-8 text-center glass-panel rounded-2xl border-black/5 bg-white/85">
            <Settings2 className="w-10 h-10 text-gray-300 mb-2 animate-pulse" />
            <p className="text-xs text-gray-500">まずはマップから神社・寺院を選択してください。</p>
          </div>
        ) : !isCreator ? (
          /* ロック状態 */
          <div className="flex flex-col items-center p-5 glass-panel rounded-2xl border-black/5 bg-gradient-to-br from-gray-50 to-amber-50/20 text-center shadow-md">
            <div className="w-12 h-12 rounded-full bg-shrine-red/10 border border-shrine-red/30 flex items-center justify-center text-shrine-red mb-3 animate-pulse">
              <Lock className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-gray-800 mb-0.5">創世主権限ロック</h4>
            <span className="text-[10px] text-shrine-red font-bold uppercase tracking-wider mb-3 block">
              {activeSpot.creatorId === null ? 'スポット未創生' : '所有権なし'}
            </span>
            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              UGC投稿と評価でスポット徳1位になると<strong>創世主</strong>として神様をカスタムできます。
            </p>
            <div className="w-full glass-panel p-3.5 rounded-xl border-black/5 bg-white/80 text-xs text-left space-y-2.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">あなたのスポット徳:</span>
                <span className="font-bold text-cyber-blue">{userTokuAtSpot} Toku</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">
                  {activeSpot.creatorId === null ? '創世しきい値:' : '現在の創世主の徳:'}
                </span>
                <span className="font-bold text-gold">
                  {activeSpot.creatorId === null ? activeSpot.tokuRequirement : Math.max(activeSpot.tokuRequirement, currentCreatorToku)} Toku
                </span>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyber-blue to-gold h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (userTokuAtSpot / Math.max(activeSpot.tokuRequirement, currentCreatorToku)) * 100)}%` }}
                />
              </div>
              <div className="bg-shrine-red/5 border border-shrine-red/15 p-2.5 rounded-lg text-[10px] leading-relaxed text-gray-600 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-shrine-red flex-shrink-0 mt-0.5" />
                <span>
                  あと<strong className="text-gray-900"> {Math.max(1, Math.max(activeSpot.tokuRequirement, currentCreatorToku) - userTokuAtSpot + 10)} Toku </strong>
                  獲得で{activeSpot.creatorId === null ? '創世主へ就任' : '所有権を強奪'}できます！
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* 創世主カスタマイザー */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-gray-500">創世主権限: 神様のAIをリデザインできます。</p>
              <span className="bg-gold/10 border border-gold/40 text-gold text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                <Sparkles className="w-3 h-3" />
                創世主モード
              </span>
            </div>

            {/* 人格・LLM設定 */}
            <div className="glass-panel p-4 rounded-xl border-black/5 bg-white/80 space-y-3.5">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-cyber-blue" />
                人格・LLMプロンプト設定
              </h4>
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-600 block font-bold">神霊名 (Name)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-gold transition-all"
                  placeholder="例: 金龍の神"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-600 block font-bold">簡単なプロフィール</label>
                <input
                  type="text"
                  value={personaDescription}
                  onChange={(e) => setPersonaDescription(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-gold transition-all"
                  placeholder="例: 浅草を守る黄金の龍神。威勢が良い。"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-600 block font-bold">システムプロンプト</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={4}
                  className="w-full bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-800 focus:outline-none focus:border-gold transition-all leading-relaxed"
                  placeholder="AIエージェントの口調や性格を入力..."
                />
              </div>
            </div>

            {/* ビジュアル・音声設定 */}
            <div className="glass-panel p-4 rounded-xl border-black/5 bg-white/80 space-y-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-gold" />
                ビジュアル ＆ 音声トーン設定
              </h4>
              <div className="space-y-2">
                <label className="text-[10px] text-gray-600 block font-bold">神光カラー (Halo)</label>
                <div className="grid grid-cols-3 gap-2">
                  {HALO_COLORS.map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setHaloColor(color.hex)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                        haloColor === color.hex
                          ? 'bg-amber-50 border-amber-400 text-gray-800 shadow-sm'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color.hex }} />
                      <span className="truncate">{color.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-gray-600 block font-bold">装飾品 (AR Accessory)</label>
                <div className="grid grid-cols-4 gap-2">
                  {ACCESSORY_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAccessoryType(opt)}
                      className={`px-2 py-2 rounded-lg border text-[10px] font-bold text-center transition-all cursor-pointer ${
                        accessoryType === opt
                          ? 'bg-gold/15 border-gold text-amber-950 shadow-sm'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {opt === '鏡' ? '🪞鏡' : opt === '剣' ? '⚔️剣' : opt === '扇子' ? '🪭扇子' : 'なし'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-gray-600 block font-bold">音声トーン (Voice)</label>
                <div className="grid grid-cols-2 gap-2">
                  {VOICE_TONE_OPTIONS.map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setVoiceTone(tone)}
                      className={`px-3 py-2 rounded-lg border text-[10px] font-bold transition-all text-center cursor-pointer ${
                        voiceTone === tone
                          ? 'bg-cyber-blue/10 border-cyber-blue text-cyber-blue shadow-sm'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 保存ボタン */}
            <div className="flex justify-end items-center gap-3 pb-4">
              {saveSuccess && (
                <span className="text-cyber-green text-xs font-bold flex items-center gap-1 animate-pulse">
                  <Check className="w-4 h-4" />
                  設定が反映されました！
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-gold hover:bg-gold-light text-amber-950 px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-md shadow-gold/25 cursor-pointer disabled:opacity-50"
              >
                <Settings2 className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                {isSaving ? '書き込み中...' : '神霊設定を更新'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
