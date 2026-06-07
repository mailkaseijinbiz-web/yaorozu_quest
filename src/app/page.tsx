'use client';

import React, { useState, useEffect } from 'react';
import { Home, Award, UserCircle2, Trophy, Sparkles, MapPin, Check, Edit2 } from 'lucide-react';
import { db, Spot, Agent, User as UserType } from '../lib/db';
import HomeTab from '../components/HomeTab';
import MapTab from '../components/MapTab';
import { getLevelInfo, LEVELS } from '../data/levels';

type TabType = 'home' | 'quest' | 'mypage';

const FALLBACK_CURRENT_USER: UserType = {
  id: 'user-self',
  displayName: 'あなた (巡礼者)',
  avatarUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=you',
  totalToku: 0,
  currentTitle: '見習い巡礼者',
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [spots, setSpots] = useState<Spot[]>([]);
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);

  // User state
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [creatorProfiles, setCreatorProfiles] = useState<{ [userId: string]: UserType }>({});
  const [userLocation, setUserLocation] = useState({ lat: 35.6580, lng: 139.7514 });

  // Quest states
  const [claimedQuests, setClaimedQuests] = useState<string[]>([]);
  const [homeResetSignal, setHomeResetSignal] = useState(0);
  const [hasChatted, setHasChatted] = useState(false);
  const [hasTakenPhoto, setHasTakenPhoto] = useState(false);

  // Profile Edit State
  const [editName, setEditName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Initial load
  useEffect(() => {
    setSpots(db.getSpots());
    const users = db.getUsers();
    const profiles: { [userId: string]: UserType } = {};
    users.forEach(u => { profiles[u.id] = u; });
    setCreatorProfiles(profiles);

    const initialSpot = db.getSpots()[0];
    setActiveSpot(initialSpot);

    const self = db.getUser('user-self');
    if (self) {
      setCurrentUser(self);
      setEditName(self.displayName);
    }

    if (typeof window !== 'undefined') {
      const claimed = localStorage.getItem('yaorozu_claimed_quests');
      if (claimed) setClaimedQuests(JSON.parse(claimed));
      setHasChatted(localStorage.getItem('yaorozu_quest_chatted') === 'true');
      setHasTakenPhoto(localStorage.getItem('yaorozu_quest_photo') === 'true');
    }
  }, []);

  useEffect(() => {
    if (activeSpot) {
      setAgent(db.getAgentBySpot(activeSpot.id) || null);
    }
  }, [activeSpot]);

  const refreshDatabaseStates = () => {
    setSpots(db.getSpots());
    const users = db.getUsers();
    const profiles: { [userId: string]: UserType } = {};
    users.forEach(u => { profiles[u.id] = u; });
    setCreatorProfiles(profiles);
    const self = db.getUser('user-self');
    if (self) setCurrentUser(self);
    if (activeSpot) {
      const refreshedSpot = db.getSpot(activeSpot.id);
      if (refreshedSpot) setActiveSpot(refreshedSpot);
    }
  };

  const handleUpdateAgent = (updatedAgent: Agent) => {
    setAgent(updatedAgent);
    setSpots(db.getSpots());
  };

  const handleSaveProfile = () => {
    if (!currentUser || !editName.trim()) return;
    setIsSavingProfile(true);
    const updated = db.updateUserProfile(currentUser.id, editName.trim());
    setCurrentUser(updated);
    refreshDatabaseStates();
    setTimeout(() => {
      setIsSavingProfile(false);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    }, 400);
  };

  const handleClaimReward = (questId: string, reward: number) => {
    if (!currentUser) return;
    const users = db.getUsers();
    const selfIdx = users.findIndex(u => u.id === currentUser.id);
    if (selfIdx !== -1) {
      users[selfIdx].totalToku += reward;
      const toku = users[selfIdx].totalToku;
      const { current } = getLevelInfo(toku);
      users[selfIdx].currentTitle = current.title;
      users[selfIdx].avatarFrameColor = current.frameColor;
      localStorage.setItem('yaorozu_users', JSON.stringify(users));
      const updatedClaimed = [...claimedQuests, questId];
      setClaimedQuests(updatedClaimed);
      localStorage.setItem('yaorozu_claimed_quests', JSON.stringify(updatedClaimed));
      refreshDatabaseStates();
    }
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const activeSpotDistance = activeSpot ? getDistance(userLocation.lat, userLocation.lng, activeSpot.latitude, activeSpot.longitude) : 999;
  const isNearAnySpot = spots.some(s => getDistance(userLocation.lat, userLocation.lng, s.latitude, s.longitude) <= 1.0);

  const userTokuAtSpot = (currentUser && activeSpot) ? db.getTokuAtSpot(currentUser.id, activeSpot.id) : 0;
  const currentCreatorToku = (activeSpot && activeSpot.creatorId) ? db.getTokuAtSpot(activeSpot.creatorId, activeSpot.id) : 0;


  

  const NAV_TABS = [
    { key: 'home' as TabType, label: 'ホーム', icon: Home },
    { key: 'quest' as TabType, label: 'マップ', icon: MapPin },
    { key: 'mypage' as TabType, label: 'マイページ', icon: UserCircle2 },
  ];

  return (
    <div className="flex-1 min-h-dvh bg-[#eaecef] flex items-center justify-center font-sans overflow-hidden p-0 sm:p-4 md:p-8 relative">
      {/* Background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#e60012]/3 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#c5a028]/3 blur-[120px] rounded-full pointer-events-none" />

      {/* Phone frame */}
      <div className="w-full h-dvh sm:h-[840px] sm:max-w-[395px] sm:rounded-[48px] sm:border-[11px] sm:border-[#1E2024] sm:shadow-[0_24px_80px_rgba(0,0,0,0.15)] relative overflow-hidden flex flex-col bg-[#f5f7fa] z-10 sm:scale-[0.98] lg:scale-100 transition-all duration-300">

        {/* iOS Dynamic Island */}
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5.5 bg-[#1E2024] rounded-b-2xl z-50 pointer-events-none" />

        {/* Viewport */}
        <div className="flex-1 relative overflow-hidden bg-[#f5f7fa] flex flex-col">

          {/* Tab content */}
          <div className={`flex-1 h-full overflow-hidden relative z-0 ${activeTab === 'home' ? '' : 'overflow-y-auto'}`}>

            {/* ── ホーム (Map) ── */}
            {activeTab === 'home' && (
              <HomeTab
                spots={spots}
                currentUser={currentUser || FALLBACK_CURRENT_USER}
                userLocation={userLocation}
                setUserLocation={setUserLocation}
                creatorProfiles={creatorProfiles}
                activeSpot={activeSpot}
                onSelectSpot={setActiveSpot}
                onNavigateToQuest={() => setActiveTab('quest')}
                homeResetSignal={homeResetSignal}
              />
            )}

            {/* ── マップ ── */}
            {activeTab === 'quest' && (
              <div className="relative h-full w-full">
                <MapTab
                  spots={spots}
                  activeSpot={activeSpot}
                  onSelectSpot={setActiveSpot}
                  userLocation={userLocation}
                  setUserLocation={setUserLocation}
                  creatorProfiles={creatorProfiles}
                />
              </div>
            )}


            {/* ── マイページ ── */}
            {activeTab === 'mypage' && currentUser && (
              <div className="p-4 space-y-4 overflow-y-auto h-full">
                {/* Profile Card */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-black/5 flex flex-col items-center text-center gap-3">
                  <div
                    className="w-20 h-20 rounded-full overflow-hidden border-4 shadow-lg"
                    style={{ borderColor: currentUser.avatarFrameColor || '#e5e7eb' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={currentUser.avatarUrl} alt={currentUser.displayName} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900">{currentUser.displayName}</h2>
                    <span className="text-[10px] bg-gold/15 border border-gold/30 text-amber-800 font-bold px-2.5 py-0.5 rounded-full mt-1 inline-block">
                      {currentUser.currentTitle}
                    </span>
                  </div>
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 w-full mt-1">
                    <div className="bg-amber-50 rounded-2xl p-3 flex flex-col items-center">
                      <Trophy className="w-4 h-4 text-gold mb-1" />
                      <span className="text-lg font-black text-gray-900">{currentUser.totalToku}</span>
                      <span className="text-[9px] text-gray-500">累積徳ポイント</span>
                    </div>
                    <div className="bg-red-50 rounded-2xl p-3 flex flex-col items-center">
                      <MapPin className="w-4 h-4 text-shrine-red mb-1" />
                      <span className="text-lg font-black text-gray-900">
                        {spots.filter(s => s.creatorId === currentUser.id).length}
                      </span>
                      <span className="text-[9px] text-gray-500">創世主スポット</span>
                    </div>
                  </div>
                </div>

                {/* Profile Edit */}
                <div className="bg-white rounded-3xl p-4 shadow-sm border border-black/5 space-y-3">
                  <h3 className="text-xs font-black text-gray-700 flex items-center gap-1.5">
                    <Edit2 className="w-3.5 h-3.5 text-gold" />
                    プロフィール編集
                  </h3>
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-gray-500 block font-bold">表示名</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={12}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-gold transition-all"
                      placeholder="名前を入力"
                    />
                  </div>
                  <button
                    onClick={handleSaveProfile}
                    disabled={!editName.trim() || isSavingProfile}
                    className="w-full bg-gold hover:opacity-90 text-amber-950 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 shadow-sm"
                  >
                    {profileSaved ? (
                      <><Check className="w-3.5 h-3.5" />保存しました！</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5" />保存する</>
                    )}
                  </button>
                </div>

                {/* Activity summary */}
                <div className="bg-white rounded-3xl p-4 shadow-sm border border-black/5 space-y-2.5">
                  <h3 className="text-xs font-black text-gray-700">活動履歴</h3>
                  {[
                    { label: '口コミ投稿数', val: db.getUgc().filter(u => u.userId === currentUser.id).length, color: 'text-cyber-blue' },
                    { label: '獲得いいね数', val: db.getUgc().filter(u => u.userId === currentUser.id).reduce((sum, u) => sum + u.likesCount, 0), color: 'text-shrine-red' },
                    { label: 'クエスト達成数', val: claimedQuests.length, color: 'text-gold' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{label}</span>
                      <span className={`font-black ${color}`}>{val}</span>
                    </div>
                  ))}
                </div>

                {/* Badge / Level section */}
                <div className="bg-white rounded-3xl p-4 shadow-sm border border-black/5 space-y-3">
                  <h3 className="text-xs font-black text-gray-700 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-gold" />
                    バッジ・称号
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {LEVELS.map((lv) => {
                      const earned = currentUser.totalToku >= lv.minToku;
                      const isCurrent = getLevelInfo(currentUser.totalToku).current.level === lv.level;
                      const BADGE_ICONS: Record<number, string> = { 1: '🚶', 2: '🗺️', 3: '🧘', 4: '⛩️', 5: '✨' };
                      return (
                        <div
                          key={lv.level}
                          className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${
                            isCurrent
                              ? 'border-gold bg-amber-50 shadow-md'
                              : earned
                              ? 'border-gray-200 bg-gray-50'
                              : 'border-dashed border-gray-200 bg-gray-50/50 opacity-40'
                          }`}
                        >
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
                              isCurrent ? 'bg-gold/20' : earned ? 'bg-gray-100' : 'bg-gray-100'
                            }`}
                            style={earned && lv.frameColor ? { boxShadow: `0 0 0 2px ${lv.frameColor}` } : {}}
                          >
                            {BADGE_ICONS[lv.level]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-black ${
                                isCurrent ? 'text-amber-800' : earned ? 'text-gray-700' : 'text-gray-400'
                              }`}>
                                {lv.title}
                              </span>
                              {isCurrent && (
                                <span className="text-[8px] bg-gold text-white font-bold px-1.5 py-0.5 rounded-full">現在</span>
                              )}
                              {earned && !isCurrent && (
                                <span className="text-[8px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">獲得済</span>
                              )}
                            </div>
                            <div className="text-[9px] text-gray-400 mt-0.5">
                              {lv.minToku === 0 ? '初期称号' : `得 ${lv.minToku}pt で解放`}
                            </div>
                          </div>
                          {!earned && (
                            <span className="text-[9px] text-gray-400 font-mono whitespace-nowrap">
                              あと {lv.minToku - currentUser.totalToku}pt
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        <nav
          className="glass-panel border-t border-black/5 pt-2 px-1 flex justify-around items-center z-[3000] bg-white/95 backdrop-blur-lg flex-shrink-0"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
        >
          {NAV_TABS.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key;
            const hasUnread = false; // notifications removed
            return (
              <button
                key={key}
                onClick={() => {
                  if (key === 'home') setHomeResetSignal(s => s + 1);
                  setActiveTab(key);
                }}
                className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer relative ${
                  isActive ? 'text-shrine-red font-bold scale-105' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-[11px]">{label}</span>
                {hasUnread && (
                  <span className="absolute top-0.5 right-2 w-2 h-2 bg-shrine-red rounded-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
