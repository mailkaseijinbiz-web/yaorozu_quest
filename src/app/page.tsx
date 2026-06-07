'use client';

import React, { useState, useEffect } from 'react';
import { Compass, MessageSquare, Camera, Settings, Trophy, HelpCircle, Edit2, Check, User, Award } from 'lucide-react';
import { db, Spot, Agent, UgcPost, AffiliateLink, User as UserType } from '../lib/db';
import MapTab from '../components/MapTab';
import ChatTab from '../components/ChatTab';
import ArTab from '../components/ArTab';
import CreatorTab from '../components/CreatorTab';
import UgcPanel from '../components/UgcPanel';
import QuestTab from '../components/QuestTab';

type TabType = 'map' | 'chat' | 'ar' | 'quest' | 'creator';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('map');
  const [spots, setSpots] = useState<Spot[]>([]);
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [ugcList, setUgcList] = useState<UgcPost[]>([]);
  const [affiliates, setAffiliates] = useState<AffiliateLink[]>([]);
  
  // User state
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [creatorProfiles, setCreatorProfiles] = useState<{ [userId: string]: UserType }>({});
  const [userLocation, setUserLocation] = useState({ lat: 35.6580, lng: 139.7514 });

  // Quest states (Persistent)
  const [claimedQuests, setClaimedQuests] = useState<string[]>([]);
  const [hasChatted, setHasChatted] = useState(false);
  const [hasTakenPhoto, setHasTakenPhoto] = useState(false);

  // Bottom Sheet State for Mobile-first map overlay
  const [sheetState, setSheetState] = useState<'collapsed' | 'half' | 'expanded'>('collapsed');

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Initial Database load
  useEffect(() => {
    setSpots(db.getSpots());
    const users = db.getUsers();
    
    const profiles: { [userId: string]: UserType } = {};
    users.forEach(u => {
      profiles[u.id] = u;
    });
    setCreatorProfiles(profiles);

    // Initial selected spot (Sensoji)
    const initialSpot = db.getSpots()[0];
    setActiveSpot(initialSpot);
    setSheetState('collapsed');
    
    const self = db.getUser('user-self');
    if (self) {
      setCurrentUser(self);
      setEditName(self.displayName);
    }

    // Load quests history
    if (typeof window !== 'undefined') {
      const claimed = localStorage.getItem('yaorozu_claimed_quests');
      if (claimed) setClaimedQuests(JSON.parse(claimed));
      
      setHasChatted(localStorage.getItem('yaorozu_quest_chatted') === 'true');
      setHasTakenPhoto(localStorage.getItem('yaorozu_quest_photo') === 'true');
    }
  }, []);

  // Sync details when activeSpot changes
  useEffect(() => {
    if (activeSpot) {
      setAgent(db.getAgentBySpot(activeSpot.id) || null);
      setUgcList(db.getUgcBySpot(activeSpot.id));
      setAffiliates(db.getAffiliatesBySpot(activeSpot.name));
      setSheetState('collapsed');
    }
  }, [activeSpot]);

  const handleSelectSpotById = (spotId: string) => {
    const spot = db.getSpot(spotId);
    if (spot) {
      setActiveSpot(spot);
    }
  };

  const handleAddUgc = (content: string) => {
    if (!activeSpot || !currentUser) return;
    db.addUgcPost(currentUser.id, activeSpot.id, content);
    refreshDatabaseStates();
  };

  const handleLikePost = (postId: string) => {
    if (!currentUser) return;
    db.likeUgcPost(currentUser.id, postId);
    refreshDatabaseStates();
  };

  const handleUnlikePost = (postId: string) => {
    if (!currentUser) return;
    db.unlikeUgcPost(currentUser.id, postId);
    refreshDatabaseStates();
  };

  const handleUpdateAgent = (updatedAgent: Agent) => {
    setAgent(updatedAgent);
    setSpots(db.getSpots());
  };

  const handleSaveProfile = () => {
    if (!currentUser || !editName.trim()) return;
    const updated = db.updateUserProfile(currentUser.id, editName.trim());
    setCurrentUser(updated);
    setIsEditingProfile(false);
    refreshDatabaseStates();
  };

  // Claim Quest rewards
  const handleClaimReward = (questId: string, reward: number) => {
    if (!currentUser) return;
    
    const users = db.getUsers();
    const selfIdx = users.findIndex(u => u.id === currentUser.id);
    if (selfIdx !== -1) {
      users[selfIdx].totalToku += reward;
      
      const toku = users[selfIdx].totalToku;
      if (toku >= 500) {
        users[selfIdx].currentTitle = '大創世神';
        users[selfIdx].avatarFrameColor = '#c5a028';
      } else if (toku >= 300) {
        users[selfIdx].currentTitle = '徳高き修行僧';
        users[selfIdx].avatarFrameColor = '#8b5cf6';
      } else if (toku >= 100) {
        users[selfIdx].currentTitle = '巡礼ガイド';
        users[selfIdx].avatarFrameColor = '#0284c7';
      } else {
        users[selfIdx].currentTitle = '見習い巡礼者';
        users[selfIdx].avatarFrameColor = undefined;
      }
      
      localStorage.setItem('yaorozu_users', JSON.stringify(users));
      
      const updatedClaimed = [...claimedQuests, questId];
      setClaimedQuests(updatedClaimed);
      localStorage.setItem('yaorozu_claimed_quests', JSON.stringify(updatedClaimed));
      
      refreshDatabaseStates();
    }
  };

  const handleMessageSent = () => {
    setHasChatted(true);
    localStorage.setItem('yaorozu_quest_chatted', 'true');
  };

  const handlePhotoTaken = () => {
    setHasTakenPhoto(true);
    localStorage.setItem('yaorozu_quest_photo', 'true');
  };

  const handleShareSpot = (spotId: string) => {
    if (!currentUser) return;
    db.shareSpot(currentUser.id, spotId);
    setToastMessage("SNSで共有しました！ +15 徳を獲得！");
    setTimeout(() => setToastMessage(""), 3000);
    refreshDatabaseStates();
  };

  const refreshDatabaseStates = () => {
    setSpots(db.getSpots());
    const users = db.getUsers();
    const profiles: { [userId: string]: UserType } = {};
    users.forEach(u => {
      profiles[u.id] = u;
    });
    setCreatorProfiles(profiles);

    const self = db.getUser('user-self');
    if (self) setCurrentUser(self);

    if (activeSpot) {
      const refreshedSpot = db.getSpot(activeSpot.id);
      if (refreshedSpot) {
        setActiveSpot(refreshedSpot);
      }
      setUgcList(db.getUgcBySpot(activeSpot.id));
    }
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const activeSpotDistance = activeSpot 
    ? getDistance(userLocation.lat, userLocation.lng, activeSpot.latitude, activeSpot.longitude)
    : 999;

  const isNearSpot = activeSpotDistance <= 1.0;

  const isNearAnySpot = spots.some(s => 
    getDistance(userLocation.lat, userLocation.lng, s.latitude, s.longitude) <= 1.0
  );

  const handleWarp = () => {
    if (!activeSpot) return;
    setUserLocation({
      lat: activeSpot.latitude + 0.0003,
      lng: activeSpot.longitude + 0.0003
    });
    setTimeout(() => {
      refreshDatabaseStates();
    }, 100);
  };

  const userTokuAtSpot = (currentUser && activeSpot) 
    ? db.getTokuAtSpot(currentUser.id, activeSpot.id)
    : 0;

  const currentCreatorToku = (activeSpot && activeSpot.creatorId)
    ? db.getTokuAtSpot(activeSpot.creatorId, activeSpot.id)
    : 0;

  const activeSpotCreatorProfile = (activeSpot && activeSpot.creatorId)
    ? creatorProfiles[activeSpot.creatorId] || null
    : null;

  const getSheetTransformClass = () => {
    switch (sheetState) {
      case 'expanded': return 'translate-y-[10%]';
      case 'half': return 'translate-y-[52%]';
      case 'collapsed': default: return 'translate-y-[calc(100%-62px)]';
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-[#eaecef] flex items-center justify-center font-sans overflow-hidden p-0 sm:p-4 md:p-8 relative">
      
      {/* Background ambient lighting glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#e60012]/3 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#c5a028]/3 blur-[120px] rounded-full pointer-events-none" />

      {/* SMARTPHONE CONTAINER FRAME (Clean Light Screen inside Dark Shell) */}
      <div className="w-full h-screen sm:h-[840px] sm:max-w-[395px] sm:rounded-[48px] sm:border-[11px] sm:border-[#1E2024] sm:shadow-[0_24px_80px_rgba(0,0,0,0.15)] relative overflow-hidden flex flex-col bg-[#f5f7fa] z-10 sm:scale-[0.98] lg:scale-100 transition-all duration-300">
        
        {/* iOS Dynamic Island Notch */}
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5.5 bg-[#1E2024] rounded-b-2xl z-50 pointer-events-none" />

        {/* Header bar */}
        <header className="glass-panel px-4 py-3 border-b border-black/5 flex items-center justify-between z-40 bg-white/85 backdrop-blur-lg flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">⛩️</span>
            <div>
              <h1 className="text-xs font-black tracking-wider text-gray-900 uppercase">Yaorozu Quest</h1>
              <span className="text-[8px] text-gray-500 font-mono tracking-widest leading-none block">GOD RADAR PLATFORM</span>
            </div>
          </div>

          {/* User profile & Toku tracker */}
          {currentUser && (
            <div className="flex items-center gap-2">
              <div 
                onClick={() => setIsEditingProfile(true)}
                className="flex items-center gap-1.5 bg-gray-100/80 border border-black/5 px-2.5 py-1 rounded-full cursor-pointer hover:bg-gray-200/80 transition-all"
              >
                <div 
                  className="w-5 h-5 rounded-full overflow-hidden border border-black/10 flex items-center justify-center flex-shrink-0"
                  style={currentUser.avatarFrameColor ? { borderColor: currentUser.avatarFrameColor, borderWidth: '1.5px' } : {}}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentUser.avatarUrl} alt={currentUser.displayName} className="w-full h-full object-cover" />
                </div>
                <span className="text-[9px] font-bold text-gray-800 max-w-[55px] truncate">{currentUser.displayName.split('@')[0]}</span>
              </div>

              {/* Toku total points */}
              <div className="flex items-center gap-1 bg-[#c5a028]/10 border border-[#c5a028]/20 px-2 py-1 rounded-full">
                <Trophy className="w-3 h-3 text-[#c5a028]" />
                <span className="text-[9px] font-black text-[#c5a028]">{currentUser.totalToku}</span>
              </div>
            </div>
          )}
        </header>

        {/* Viewport content */}
        <div className="flex-1 relative overflow-hidden bg-[#f5f7fa] flex flex-col">
          
          {/* Toast Notification popup */}
          {toastMessage && (
            <div className="absolute top-4 left-4 right-4 z-[5000] bg-amber-500 text-white font-bold text-[10px] py-2 px-3 rounded-xl shadow-lg border border-amber-600/30 flex items-center justify-center gap-1.5 animate-bounce">
              <span>✨</span>
              <span>{toastMessage}</span>
            </div>
          )}
          
          <div className="flex-1 h-full overflow-hidden p-3 pb-4 relative z-0">
            {activeTab === 'map' && (
              <MapTab
                spots={spots}
                activeSpot={activeSpot}
                onSelectSpot={(s) => {
                  setActiveSpot(s);
                  setSheetState('half');
                }}
                userLocation={userLocation}
                setUserLocation={setUserLocation}
                creatorProfiles={creatorProfiles}
                onNavigateTab={setActiveTab}
              />
            )}
            
            {activeTab === 'chat' && (
              <ChatTab
                activeSpot={activeSpot}
                agent={agent}
                ugc={ugcList}
                affiliates={affiliates}
                currentUser={currentUser || db.getUsers()[0]}
                onSelectSpotById={handleSelectSpotById}
                onMessageSent={handleMessageSent}
              />
            )}

            {activeTab === 'ar' && (
              <ArTab
                activeSpot={activeSpot}
                agent={agent}
                currentUser={currentUser || db.getUsers()[0]}
                isNearSpot={isNearSpot}
                onWarpRequest={handleWarp}
                onPhotoTaken={handlePhotoTaken}
              />
            )}

            {activeTab === 'quest' && (
              <QuestTab
                currentUser={currentUser || db.getUsers()[0]}
                spots={spots}
                claimedQuests={claimedQuests}
                onClaimReward={handleClaimReward}
                onNavigateTab={(tab) => {
                  setActiveTab(tab);
                }}
                isNearAnySpot={isNearAnySpot}
                hasChatted={hasChatted}
                hasTakenPhoto={hasTakenPhoto}
              />
            )}

            {activeTab === 'creator' && (
              <CreatorTab
                activeSpot={activeSpot}
                agent={agent}
                currentUser={currentUser || db.getUsers()[0]}
                onUpdateAgent={handleUpdateAgent}
                userTokuAtSpot={userTokuAtSpot}
                currentCreatorToku={currentCreatorToku}
              />
            )}
          </div>

          {/* Collapsible bottom sheet for map search */}
          {activeTab === 'map' && activeSpot && (
            <>
              {sheetState === 'expanded' && (
                <div 
                  onClick={() => setSheetState('half')}
                  className="absolute inset-0 bg-black/20 backdrop-blur-[1px] z-[1900] transition-all duration-300"
                />
              )}
              
              <div 
                className={`absolute inset-0 z-[2000] transition-transform duration-300 ease-out ${getSheetTransformClass()}`}
              >
                <UgcPanel
                  activeSpot={activeSpot}
                  ugcList={ugcList}
                  affiliates={affiliates}
                  currentUser={currentUser || db.getUsers()[0]}
                  creatorProfile={activeSpotCreatorProfile}
                  userTokuAtSpot={userTokuAtSpot}
                  onAddUgc={handleAddUgc}
                  onLikePost={handleLikePost}
                  onUnlikePost={handleUnlikePost}
                  onShareSpot={handleShareSpot}
                  sheetState={sheetState}
                  setSheetState={setSheetState}
                  onNavigateToChat={() => setActiveTab('chat')}
                />
              </div>
            </>
          )}

        </div>

        {/* Tab Navigation Menu */}
        <nav className="glass-panel border-t border-black/5 py-2 px-3 flex justify-around items-center z-[3000] bg-white/95 backdrop-blur-lg flex-shrink-0">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'map' ? 'text-shrine-red font-bold scale-105' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Compass className="w-5 h-5" />
            <span className="text-[9px]">レーダー</span>
          </button>
          
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'chat' ? 'text-gold font-bold scale-105' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[9px]">神仏対話</span>
          </button>

          <button
            onClick={() => setActiveTab('ar')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'ar' ? 'text-cyber-blue font-bold scale-105' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Camera className="w-5 h-5" />
            <span className="text-[9px]">神霊召喚</span>
          </button>

          <button
            onClick={() => setActiveTab('quest')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'quest' ? 'text-cyber-green font-bold scale-105' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Award className="w-5 h-5" />
            <span className="text-[9px]">クエスト</span>
          </button>

          <button
            onClick={() => setActiveTab('creator')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'creator' ? 'text-cyber-purple font-bold scale-105' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[9px]">創世主</span>
          </button>
        </nav>
      </div>

      {/* Profile edit modal */}
      {isEditingProfile && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsEditingProfile(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          
          <div className="relative glass-panel-heavy p-5 rounded-3xl w-full max-w-[320px] border-gold/30 shadow-2xl space-y-4 z-10 bg-white">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
              <User className="w-4 h-4 text-gold" />
              <h3 className="font-bold text-gray-900 text-xs">プロフィールの編集</h3>
            </div>

            <div className="space-y-3">
              <div className="bg-gray-50 border border-gray-100 p-3 rounded-2xl text-[10px] space-y-1 font-mono text-gray-600">
                <div className="flex justify-between">
                  <span>称号:</span>
                  <span className="text-gold font-bold">{currentUser.currentTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span>累積徳:</span>
                  <span className="text-gray-950 font-bold">{currentUser.totalToku} pts</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-gray-500 block font-bold">表示名 (Display Name)</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={12}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-gold transition-all"
                  placeholder="名前を入力"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="flex-1 bg-gray-50 border border-gray-100 text-gray-500 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer hover:bg-gray-100"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={!editName.trim()}
                className="flex-1 bg-gold text-dark-bg py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer hover:opacity-90"
              >
                <Check className="w-3.5 h-3.5" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
