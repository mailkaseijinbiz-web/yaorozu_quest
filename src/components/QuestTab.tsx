'use client';

import React from 'react';
import { Trophy, Check, ArrowRight, Shield, Award, Calendar, Sparkles, MapPin } from 'lucide-react';
import { Spot, User, UgcPost, db } from '../lib/db';

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
  targetTab: 'map' | 'chat' | 'ar' | 'creator';
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
    currentCount: ({ spots }) => {
      // Check if any spot is within 1km of user position
      // In db.ts, userLocation is managed in state. We'll pass a proximity helper.
      return 0; // will be overridden dynamically
    },
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
    currentCount: () => 0, // overridden dynamically
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
    currentCount: () => 0, // overridden dynamically
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
    targetTab: 'creator',
  }
];

interface QuestTabProps {
  currentUser: User;
  spots: Spot[];
  claimedQuests: string[]; // List of quest IDs claimed by user
  onClaimReward: (questId: string, reward: number) => void;
  onNavigateTab: (tab: 'map' | 'chat' | 'ar' | 'creator') => void;
  isNearAnySpot: boolean; // proximity status from parent
  hasChatted: boolean; // chat status from parent
  hasTakenPhoto: boolean; // photo status from parent
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
}: QuestTabProps) {
  // Fetch all UGC to calculate counts
  const allUgc = db.getUgc();

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto pr-1">
      {/* Tab Header */}
      <div className="border-b border-black/5 pb-3">
        <h2 className="text-xl font-bold text-amber-700 flex items-center gap-2">
          <Award className="w-5 h-5 text-gold animate-pulse" />
          修行クエスト (Quests)
        </h2>
        <p className="text-xs text-gray-500">
          徳を高めるための修行です。達成するとボーナス徳を獲得できます。
        </p>
      </div>

      {/* Quest Columns */}
      <div className="space-y-5">
        
        {/* Quest Section helper */}
        {['daily', 'pilgrimage', 'achievement'].map((cat) => {
          const catQuests = INITIAL_QUESTS.filter(q => q.category === cat);
          const catTitle = cat === 'daily' ? 'デイリー修行' : cat === 'pilgrimage' ? '霊地巡礼' : '偉大なアチーブメント';
          const catIcon = cat === 'daily' ? <Calendar className="w-4 h-4 text-cyber-blue" /> : cat === 'pilgrimage' ? <MapPin className="w-4 h-4 text-shrine-red" /> : <Shield className="w-4 h-4 text-gold" />;
          
          return (
            <div key={cat} className="space-y-2.5">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                {catIcon}
                {catTitle}
              </h3>

              <div className="grid grid-cols-1 gap-3">
                {catQuests.map((quest) => {
                  const isClaimed = claimedQuests.includes(quest.id);
                  
                  // Calculate count dynamically, matching parent events if needed
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
                      {/* Top Row: Description & Reward */}
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
                          <p className="text-[10px] text-gray-650 text-gray-600 mt-1 leading-relaxed">
                            {quest.description}
                          </p>
                        </div>

                        {/* Reward Badge */}
                        <div className="flex items-center gap-1 bg-amber-50 border border-amber-300 text-amber-700 text-[9px] font-black px-2.5 py-0.8 rounded-full flex-shrink-0">
                          <Trophy className="w-2.5 h-2.5 text-gold" />
                          <span>+{quest.reward} 徳</span>
                        </div>
                      </div>

                      {/* Bottom Row: Progress & Actions */}
                      <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-black/5">
                        
                        {/* Progress Bar & Numeric Text */}
                        <div className="flex-1 max-w-[150px] space-y-1">
                          <div className="flex justify-between text-[9px] text-gray-500 font-mono leading-none">
                            <span>進捗</span>
                            <span>{Math.min(quest.targetCount, currentVal)} / {quest.targetCount}</span>
                          </div>
                          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden border border-gray-200/50">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isComplete ? 'bg-gold' : 'bg-cyber-blue'
                              }`}
                              style={{
                                width: `${Math.min(100, (currentVal / quest.targetCount) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Interactive Buttons */}
                        {isClaimed ? (
                          <span className="text-gray-500 text-[10px] font-bold flex items-center gap-0.5">
                            <Check className="w-3.5 h-3.5 text-gray-405 text-gray-500" />
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
                            className="text-gray-500 hover:text-gray-805 hover:text-gray-800 text-[10px] font-bold py-1.5 flex items-center gap-0.5 group cursor-pointer"
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
    </div>
  );
}
