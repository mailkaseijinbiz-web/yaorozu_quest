'use client';

import React, { useState, useEffect } from 'react';
import { UserCircle2, Trophy, MapPin, Check, Flag, Pencil, MessageSquare, Heart, Share2 } from 'lucide-react';
import { db, Spot, Agent, User as UserType, UserContribution } from '../lib/db';
import { pullSnapshot } from '../lib/cloud-sync';
import HomeTab from '../components/HomeTab';
import MapTab from '../components/MapTab';
import SpotDetail from '../components/SpotDetail';
import { getLevelInfo } from '../data/levels';
import { getBadgeStates, godAvatarEmoji } from '../data/badges';
import { getChallenge } from '../data/challenges';

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
  const [detailSpot, setDetailSpot] = useState<Spot | null>(null);
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);

  // 詳細ページをブラウザの「戻る」で閉じられるように履歴に積む
  useEffect(() => {
    if (!detailSpot) return;
    window.history.pushState({ yaorozuDetail: true }, '');
    const onPop = () => setDetailSpot(null);
    window.addEventListener('popstate', onPop);
    // 背景スクロールをロック（詳細を開いた瞬間の画面ズレを防止）
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('popstate', onPop);
      document.body.style.overflow = prevOverflow;
    };
  }, [detailSpot]);

  // User state
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [userStats, setUserStats] = useState<UserContribution | null>(null);
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
  const [editingProfile, setEditingProfile] = useState(false);
  const [mypageTab, setMypageTab] = useState<'posts' | 'badges' | 'quests'>('posts');

  // 初回起動：名前入力オンボーディング
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardName, setOnboardName] = useState('');

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
    setUserStats(db.getUserStats('user-self'));
    setActiveChallengeId(db.getChallengeProgress().activeId);

    if (typeof window !== 'undefined') {
      const claimed = localStorage.getItem('yaorozu_claimed_quests');
      if (claimed) setClaimedQuests(JSON.parse(claimed));
      setHasChatted(localStorage.getItem('yaorozu_quest_chatted') === 'true');
      setHasTakenPhoto(localStorage.getItem('yaorozu_quest_photo') === 'true');
      // 初回起動（名前未設定）なら名前入力オンボーディングを表示
      if (!localStorage.getItem('yaorozu_onboarded')) setNeedsOnboarding(true);
    }
  }, []);

  // クラウド永続化：起動時にスナップショットを復元（鍵未設定なら no-op）
  useEffect(() => {
    let cancelled = false;
    pullSnapshot().then((applied) => {
      if (applied && !cancelled) refreshDatabaseStates();
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 実際のGPS現在地を取得して反映
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { /* 取得失敗時は既定の現在地を維持 */ },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
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
    setUserStats(db.getUserStats('user-self'));
    if (activeSpot) {
      const refreshedSpot = db.getSpot(activeSpot.id);
      if (refreshedSpot) setActiveSpot(refreshedSpot);
    }
  };

  // 達成クエストを写真とともに振り返りシェア（Web Share API、非対応時はクリップボード）
  const shareQuest = async (title: string, badgeName: string, badgeIcon: string, photos: string[]) => {
    const text = `${badgeIcon} YAOROZU QUEST「${title}」を制覇！「${badgeName}」バッジを獲得しました。 #ヤオロズクエスト`;
    try {
      let files: File[] = [];
      if (photos.length && typeof File !== 'undefined') {
        files = await Promise.all(
          photos.slice(0, 4).map(async (p, i) => {
            const blob = await (await fetch(p)).blob();
            return new File([blob], `quest-${i + 1}.jpg`, { type: blob.type || 'image/jpeg' });
          })
        );
      }
      const navAny = navigator as Navigator & { canShare?: (d?: unknown) => boolean };
      if (navAny.share && files.length && navAny.canShare?.({ files })) {
        await navAny.share({ title: 'YAOROZU QUEST', text, files });
      } else if (navAny.share) {
        await navAny.share({ title: 'YAOROZU QUEST', text });
      } else {
        await navigator.clipboard.writeText(text);
        alert('シェア文をコピーしました。SNSに貼り付けてください。');
      }
    } catch {
      /* ユーザーがキャンセルした等は無視 */
    }
  };

  const completeOnboarding = () => {
    const name = onboardName.trim();
    if (!name) return;
    const updated = db.updateUserProfile('user-self', name);
    setCurrentUser(updated);
    setEditName(name);
    localStorage.setItem('yaorozu_onboarded', 'true');
    setNeedsOnboarding(false);
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
    { key: 'home' as TabType, label: 'クエスト', icon: Flag },
    { key: 'quest' as TabType, label: 'マップ', icon: MapPin },
    { key: 'mypage' as TabType, label: 'マイページ', icon: UserCircle2 },
  ];

  return (
    <div className="flex-1 min-h-dvh bg-[#eaecef] flex items-center justify-center font-sans overflow-hidden p-0 sm:p-4 md:p-8 relative">
      {/* Background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#e60012]/3 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#c5a028]/3 blur-[120px] rounded-full pointer-events-none" />

      {/* Phone frame */}
      <div
        className="w-full h-dvh sm:h-[840px] sm:max-w-[395px] sm:rounded-[48px] sm:border-[11px] sm:border-[#1E2024] sm:shadow-[0_24px_80px_rgba(0,0,0,0.15)] relative overflow-hidden flex flex-col bg-[#f5f7fa] z-10 sm:scale-[0.98] lg:scale-100 transition-all duration-300"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >

        {/* iOS Dynamic Island */}
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5.5 bg-[#1E2024] rounded-b-2xl z-50 pointer-events-none" />

        {/* Viewport */}
        <div className="flex-1 relative overflow-hidden bg-[#f5f7fa] flex flex-col">

          {/* Tab content */}
          <div className={`flex-1 h-full overflow-hidden relative z-0 ${activeTab === 'home' ? '' : 'overflow-y-auto'}`}>

            {/* ── ホーム (Map) ── */}
            {activeTab === 'home' && (
              <HomeTab
                currentUser={currentUser || FALLBACK_CURRENT_USER}
                userLocation={userLocation}
                onStartChallenge={(cid) => {
                  db.setActiveChallenge(cid);
                  setActiveChallengeId(cid);
                  setActiveTab('quest');
                }}
                onEndChallenge={() => { db.setActiveChallenge(null); setActiveChallengeId(null); }}
                onChanged={refreshDatabaseStates}
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
                  onOpenDetail={setDetailSpot}
                  activeChallenge={activeChallengeId ? getChallenge(activeChallengeId) ?? null : null}
                  onClearChallenge={() => { db.setActiveChallenge(null); setActiveChallengeId(null); }}
                  onAdvanceChallenge={(stepId, photo) => {
                    if (!activeChallengeId || !currentUser) return;
                    const ch = getChallenge(activeChallengeId);
                    if (!ch) return;
                    if (photo) db.saveChallengePhoto(activeChallengeId, stepId, photo);
                    db.completeChallengeStep(currentUser.id, activeChallengeId, stepId, ch.steps.length);
                    refreshDatabaseStates();
                  }}
                />
              </div>
            )}


            {/* ── マイページ ── */}
            {activeTab === 'mypage' && currentUser && (
              <div className="overflow-y-auto h-full bg-white">
                {/* ヘッダ：アイコン＋名前（編集はコンパクト） */}
                <div className="px-5 pt-8 pb-5 flex flex-col items-center text-center border-b border-black/5">
                  <div
                    className="w-20 h-20 rounded-full border-4 shadow-lg bg-gradient-to-br from-blue-100 via-white to-amber-100 flex items-center justify-center text-4xl"
                    style={{ borderColor: currentUser.avatarFrameColor || '#93c5fd' }}
                  >
                    {godAvatarEmoji(currentUser.id)}
                  </div>

                  {/* 名前＋コンパクト編集 */}
                  {editingProfile ? (
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={12}
                        className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-sm text-gray-800 focus:outline-none focus:border-shrine-red w-40 text-center"
                        placeholder="名前"
                      />
                      <button
                        onClick={() => { handleSaveProfile(); setEditingProfile(false); }}
                        disabled={!editName.trim()}
                        className="w-7 h-7 rounded-lg bg-shrine-red text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <h2 className="text-lg font-black text-gray-900">{currentUser.displayName}</h2>
                      <button
                        onClick={() => { setEditName(currentUser.displayName); setEditingProfile(true); }}
                        className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-shrine-red transition-all cursor-pointer"
                        title="名前を編集"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* レベル（目立つ大きな表示）＆経験値バー */}
                  {(() => {
                    const lvInfo = getLevelInfo(currentUser.totalToku);
                    const pct = Math.round(lvInfo.progress * 100);
                    return (
                      <div className="w-full mt-3 bg-gray-50 rounded-2xl px-4 py-3.5">
                        <div className="flex items-center gap-3 mb-2.5">
                          {/* 大きなLvバッジ */}
                          <div className="flex flex-col items-center justify-center bg-gradient-to-br from-shrine-red to-sky-400 text-white rounded-2xl px-3 py-1.5 shadow-sm flex-shrink-0">
                            <span className="text-[11px] font-black leading-none opacity-80">LEVEL</span>
                            <span className="text-2xl font-black leading-none">{lvInfo.current.level}</span>
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm font-black text-gray-900 truncate">{lvInfo.current.title}</div>
                            <div className="text-[13px] text-gray-500">
                              <span className="text-gold font-black">{currentUser.totalToku}</span> 徳
                            </div>
                          </div>
                        </div>
                        <div className="relative pt-3">
                          <div className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-500" style={{ left: `${pct}%` }}>
                            <Flag className="w-3 h-3 text-shrine-red fill-shrine-red" />
                          </div>
                          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden border border-gray-200/60">
                            <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-gold transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            {lvInfo.next ? (
                              <>
                                <span className="text-[11px] text-gray-400">次のレベルまで <span className="font-black text-gray-600">あと {lvInfo.tokuToNext} 徳</span></span>
                                <span className="text-[11px] text-gray-400">次：{lvInfo.next.title}</span>
                              </>
                            ) : (
                              <span className="text-[11px] text-gold font-black">最高位に到達！</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* タブ */}
                <div className="flex border-b border-black/5 bg-white sticky top-0 z-10">
                  {([
                    { key: 'posts', label: '投稿', icon: MessageSquare },
                    { key: 'quests', label: '達成クエスト', icon: Flag },
                    { key: 'badges', label: 'バッジ', icon: Trophy },
                  ] as const).map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setMypageTab(key)} className={`flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-black transition-all cursor-pointer border-b-2 ${mypageTab === key ? 'text-shrine-red border-shrine-red' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                  ))}
                </div>

                {/* タブ内容 */}
                <div className="p-4">
                  {/* 投稿コンテンツ（自分の口コミ・できごと等） */}
                  {mypageTab === 'posts' && (() => {
                    const myPosts = db.getUgc().filter((u) => u.userId === currentUser.id).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
                    const spotName = (id: string) => db.getSpot(id)?.name || 'スポット';
                    return myPosts.length === 0 ? (
                      <div className="text-center py-12">
                        <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs text-gray-400">まだ投稿がありません。<br />スポットで神の依頼に応えて投稿しよう。</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {myPosts.map((post) => (
                          <div key={post.id} className="bg-white rounded-2xl p-3.5 border border-black/5 shadow-sm">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[13px] font-black text-shrine-red bg-shrine-red/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5" />{spotName(post.spotId)}
                              </span>
                              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                <Heart className="w-2.5 h-2.5 fill-shrine-red text-shrine-red" />{post.likesCount}
                              </span>
                            </div>
                            <p className="text-xs text-gray-700 leading-relaxed">{post.content}</p>
                            <p className="text-[11px] text-gray-400 mt-1.5">{new Date(post.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* バッジ */}
                  {mypageTab === 'badges' && userStats && (() => {
                    const badges = getBadgeStates(userStats, currentUser);
                    return (
                      <div className="grid grid-cols-3 gap-2.5">
                        {badges.map((b) => (
                          <div key={b.id} className={`flex flex-col items-center text-center rounded-2xl border p-2.5 ${b.earned ? 'border-gold/40 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-1 ${b.earned ? 'bg-white shadow-sm' : 'bg-gray-100 grayscale opacity-40'}`}>{b.icon}</div>
                            <span className={`text-[11px] font-black leading-tight ${b.earned ? 'text-gray-800' : 'text-gray-400'}`}>{b.name}</span>
                            {b.earned ? (
                              <span className="text-[11px] text-emerald-600 font-bold mt-0.5">獲得済</span>
                            ) : (
                              <div className="w-full mt-1">
                                <div className="h-1 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-shrine-red/60 rounded-full" style={{ width: `${b.progress * 100}%` }} /></div>
                                <span className="text-[11px] text-gray-400 mt-0.5 block">{Math.floor(b.current(userStats, currentUser))}/{b.target}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* 称号 */}
                  {/* 達成したクエスト */}
                  {mypageTab === 'quests' && (() => {
                    const completedIds = db.getChallengeProgress().completed;
                    const completedChallenges = completedIds.map((id) => getChallenge(id)).filter((c): c is NonNullable<typeof c> => !!c);
                    return completedChallenges.length === 0 ? (
                      <div className="text-center py-12">
                        <Flag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">まだ達成したクエストがありません。<br />クエストを制覇してバッジを集めよう。</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {completedChallenges.map((ch) => {
                          const photoMap = db.getChallengePhotos(ch.id);
                          const photos = ch.steps.map((s) => photoMap[s.id]).filter((p): p is string => !!p);
                          return (
                            <div key={ch.id} className="bg-amber-50/50 rounded-2xl p-3 border border-gold/40">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gold/20 flex items-center justify-center text-3xl flex-shrink-0">{ch.badgeIcon}</div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-base font-black text-gray-900 truncate">{ch.title}</h4>
                                  <p className="text-[13px] text-amber-700 font-bold">🏆 「{ch.badgeName}」バッジ獲得</p>
                                </div>
                                <span className="text-[11px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">制覇</span>
                              </div>

                              {photos.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto scrollbar-none mt-3">
                                  {photos.map((p, i) => (
                                    <img key={i} src={p} alt="振り返り写真" className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-gold/30" />
                                  ))}
                                </div>
                              )}

                              <button
                                onClick={() => shareQuest(ch.title, ch.badgeName, ch.badgeIcon, photos)}
                                className="w-full mt-3 bg-shrine-red text-white text-[13px] font-black py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-90"
                              >
                                <Share2 className="w-4 h-4" />写真とシェアして振り返る
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
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
                <span className="text-[13px]">{label}</span>
                {hasUnread && (
                  <span className="absolute top-0.5 right-2 w-2 h-2 bg-shrine-red rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* ── 初回オンボーディング：名前入力 ── */}
        {needsOnboarding && (
          <div
            className="fixed sm:absolute inset-0 z-[4000] flex flex-col items-center justify-center px-7 text-center bg-gradient-to-br from-[#0c0d15] via-[#1c0f13] to-[#07080f]"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
          >
            <div className="text-6xl mb-4 drop-shadow-[0_0_24px_rgba(212,175,55,0.5)] animate-float">⛩️</div>
            <h1 className="text-3xl font-black tracking-tight leading-none mb-1">
              <span className="text-shrine-red">YAOROZU</span>
              <span className="text-white"> QUEST</span>
            </h1>
            <p className="text-gold text-[13px] font-bold tracking-widest mb-7">八百万の神が息づく地へ</p>

            <p className="text-white/90 text-sm leading-relaxed mb-1">ようこそ、巡礼者よ。</p>
            <p className="text-white/60 text-[13px] leading-relaxed mb-5">あなたの名を聞かせてください。<br />神々がその名で呼びかけるでしょう。</p>

            <input
              type="text"
              value={onboardName}
              onChange={(e) => setOnboardName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') completeOnboarding(); }}
              maxLength={12}
              autoFocus
              placeholder="例：ヤオロズ太郎"
              className="w-full max-w-xs bg-white/10 border border-gold/40 rounded-xl px-4 py-3 text-center text-base text-white placeholder-white/30 focus:outline-none focus:border-gold transition-all backdrop-blur-sm"
            />
            <p className="text-white/30 text-[11px] mt-2">12文字まで・あとから変更できます</p>

            <button
              onClick={completeOnboarding}
              disabled={!onboardName.trim()}
              className="w-full max-w-xs mt-6 bg-gold hover:bg-gold-light text-amber-950 font-black py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-gold/25 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
            >
              <Flag className="w-4 h-4" />
              巡礼をはじめる
            </button>
          </div>
        )}

        {/* ── 寺の詳細ページ（写真＋会話＋依頼）── */}
        {detailSpot && (
          <SpotDetail
            key={detailSpot.id}
            spot={detailSpot}
            currentUser={currentUser || FALLBACK_CURRENT_USER}
            allSpots={spots}
            onClose={() => window.history.back()}
            onOpenRelated={(s) => setDetailSpot(s)}
            onChanged={refreshDatabaseStates}
            onStartChallenge={(cid) => {
              db.setActiveChallenge(cid);
              setActiveChallengeId(cid);
              window.history.back();
              setActiveTab('quest');
            }}
            onMessageSent={() => {
              if (!hasChatted) {
                setHasChatted(true);
                localStorage.setItem('yaorozu_quest_chatted', 'true');
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
