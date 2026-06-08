'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UserCircle2, Trophy, MapPin, Check, Flag, Pencil, MessageSquare, Heart, Share2, X } from 'lucide-react';
import { db, Spot, Agent, User as UserType, UserContribution } from '../lib/db';
import { pullSnapshot } from '../lib/cloud-sync';
import { distanceKm } from '../lib/geo';
import HomeTab from '../components/HomeTab';
import MapTab from '../components/MapTab';
import SpotDetail from '../components/SpotDetail';
import { getLevelInfo } from '../data/levels';
import { getBadgeStates, godAvatarEmoji } from '../data/badges';
import { Challenge } from '../data/challenges';

type TabType = 'home' | 'quest' | 'mypage';

// マイページ・ヒーローの装飾シェイプ（正十角形メダリオン枠 / XPシールド）
const MEDALLION_FRAME =
  'polygon(50% 0%, 79.4% 9.5%, 97.6% 34.5%, 97.6% 65.5%, 79.4% 90.5%, 50% 100%, 20.6% 90.5%, 2.4% 65.5%, 2.4% 34.5%, 20.6% 9.5%)';
const XP_SHIELD = 'polygon(0% 0%, 100% 0%, 100% 58%, 50% 100%, 0% 58%)';

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
  // GPS 取得状態（失敗時にユーザーへ明示する）
  const [geoStatus, setGeoStatus] = useState<'locating' | 'ok' | 'denied' | 'error'>('locating');
  // GPS バナーをタップで薄く（透明度10%）して地図を見やすくする
  const [bannerDimmed, setBannerDimmed] = useState(false);

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
  // 達成クエストの振り返り modal
  const [reviewQuest, setReviewQuest] = useState<Challenge | null>(null);

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
  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('error');
      return;
    }
    setGeoStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('ok');
      },
      (err) => {
        // 取得失敗時は既定の現在地（東京中心）を維持しつつ、状態を明示
        setGeoStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => { requestLocation(); }, [requestLocation]);

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
    const text = `${badgeIcon} YAOROZU QUEST「${title}」を制覇！「${badgeName}」バッジを獲得しました。 #YAOROZUQUEST #ヤオロズクエスト`;
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

  const activeSpotDistance = activeSpot ? distanceKm(userLocation.lat, userLocation.lng, activeSpot.latitude, activeSpot.longitude) : 999;

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
                {/* GPS 取得失敗の明示（マップ内・上下中央・タップで薄く） */}
                {(geoStatus === 'denied' || geoStatus === 'error') && (
                  <div
                    onClick={() => setBannerDimmed((v) => !v)}
                    title={bannerDimmed ? 'タップで戻す' : 'タップで薄くする'}
                    className={`absolute top-1/2 -translate-y-1/2 left-3 right-3 z-[1500] bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3.5 flex items-center gap-2.5 shadow-xl cursor-pointer transition-opacity duration-300 ${bannerDimmed ? 'opacity-10' : 'opacity-100'}`}
                  >
                    <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <p className="flex-1 text-[12px] text-amber-800 leading-snug">
                      {geoStatus === 'denied'
                        ? '位置情報が許可されていません。東京中心を仮の現在地として表示中です。'
                        : '現在地を取得できませんでした。東京中心を仮の現在地として表示中です。'}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); requestLocation(); }}
                      className="flex-shrink-0 text-[12px] font-black text-white bg-amber-600 px-3 py-1.5 rounded-full hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                    >
                      再取得
                    </button>
                  </div>
                )}
                <MapTab
                  spots={spots}
                  activeSpot={activeSpot}
                  onSelectSpot={(s) => { setActiveSpot(s); setDetailSpot(s); }}
                  userLocation={userLocation}
                  setUserLocation={setUserLocation}
                  creatorProfiles={creatorProfiles}
                  onOpenDetail={setDetailSpot}
                  currentUser={currentUser || FALLBACK_CURRENT_USER}
                  onStartChallenge={(cid) => { db.setActiveChallenge(cid); setActiveChallengeId(cid); }}
                  activeChallenge={activeChallengeId ? db.getQuest(activeChallengeId) ?? null : null}
                  onClearChallenge={() => { db.setActiveChallenge(null); setActiveChallengeId(null); }}
                  onAdvanceChallenge={(stepId, photo) => {
                    if (!activeChallengeId || !currentUser) return;
                    const ch = db.getQuest(activeChallengeId);
                    if (!ch) return;
                    if (photo) db.saveChallengePhoto(activeChallengeId, stepId, photo);
                    db.completeChallengeStep(currentUser.id, activeChallengeId, stepId, ch.tasks.length);
                    refreshDatabaseStates();
                  }}
                />
              </div>
            )}


            {/* ── マイページ ── */}
            {activeTab === 'mypage' && currentUser && (
              <div className="overflow-y-auto h-full bg-gradient-to-b from-sky-50 via-white to-amber-50/50">
                {/* ── 巡礼者プロフィール（ヒーロー） ── */}
                <div className="relative px-5 pt-12 pb-7 border-b border-black/5 overflow-hidden">
                  {/* 背景グロー */}
                  <div className="absolute inset-0 bg-gradient-to-b from-sky-50/80 via-white to-white pointer-events-none" />
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-60 h-60 bg-shrine-red/[0.06] blur-3xl rounded-full pointer-events-none" />

                  <div className="relative flex flex-col items-center text-center">
                    {(() => {
                      const lvInfo = getLevelInfo(currentUser.totalToku);
                      const pct = Math.round(lvInfo.progress * 100);
                      const nextMin = lvInfo.next ? lvInfo.next.minToku : currentUser.totalToku;
                      return (
                        <>
                          {/* メダリオン（アバター＋装飾フレーム＋PILGRIMリボン） */}
                          <div className="relative w-36 h-36 mt-5">
                            {/* 回転ハロー */}
                            <div
                              className="absolute -inset-1 rounded-full opacity-40 blur-md animate-halo-rotate"
                              style={{ background: 'conic-gradient(from 0deg, #e60012, #f5c542, #2563eb, #60a5fa, #e60012)' }}
                            />
                            {/* 多角形グラデーション枠 */}
                            <div
                              className="absolute inset-0 drop-shadow-sm"
                              style={{ clipPath: MEDALLION_FRAME, background: 'conic-gradient(from 210deg, #e60012, #ff7a00, #f5c542, #60a5fa, #2563eb, #60a5fa, #e60012)' }}
                            />
                            <div className="absolute inset-[5px] bg-white" style={{ clipPath: MEDALLION_FRAME }} />
                            {/* アバター本体 */}
                            <div className="absolute inset-[12px] rounded-full bg-gradient-to-br from-sky-50 via-white to-amber-50 flex items-center justify-center shadow-inner overflow-hidden">
                              <span className="text-[64px] leading-none drop-shadow-sm">{godAvatarEmoji(currentUser.id)}</span>
                            </div>
                            {/* PILGRIM リボン（レベルは XP シールドに集約・重複表示を削除） */}
                            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 flex items-center bg-gradient-to-r from-sky-500 to-blue-600 text-white px-4 py-1.5 rounded-full shadow-md border-2 border-white">
                              <span className="text-[11px] font-black tracking-[0.2em]">PILGRIM</span>
                            </div>
                          </div>

                          {/* 名前＋コンパクト編集 */}
                          {editingProfile ? (
                            <div className="flex items-center gap-1.5 mt-6">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                maxLength={12}
                                className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-base text-gray-800 focus:outline-none focus:border-shrine-red w-40 text-center"
                                placeholder="名前"
                              />
                              <button
                                onClick={() => { handleSaveProfile(); setEditingProfile(false); }}
                                disabled={!editName.trim()}
                                className="w-8 h-8 rounded-lg bg-shrine-red text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 mt-6">
                              <span className="text-[13px] font-black text-white bg-gradient-to-br from-sky-500 to-blue-600 px-2 py-0.5 rounded-full leading-none">Lv.{lvInfo.current.level}</span>
                              <h2 className="text-xl font-black text-gray-900">{currentUser.displayName}</h2>
                              <button
                                onClick={() => { setEditName(currentUser.displayName); setEditingProfile(true); }}
                                className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-shrine-red transition-all cursor-pointer"
                                title="名前を編集"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          <p className="text-[13px] font-bold text-gray-500 mt-0.5">{lvInfo.current.title}</p>

                          {/* XPシールド＋徳バー */}
                          <div className="w-full mt-5 flex items-center gap-3">
                            {/* XPシールドバッジ */}
                            <div className="relative flex-shrink-0 w-14 h-16">
                              <div className="absolute inset-0 drop-shadow-sm" style={{ clipPath: XP_SHIELD, background: 'linear-gradient(150deg, #fcd34d, #f59e0b)' }} />
                              <div className="absolute inset-[2px]" style={{ clipPath: XP_SHIELD, background: 'linear-gradient(150deg, #fde68a, #f59e0b)' }} />
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-white leading-none pb-2">
                                <span className="text-[15px] font-black tracking-wider" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.2)' }}>XP</span>
                                <span className="text-[7px] font-black opacity-90 mt-0.5">LEVEL</span>
                                <span className="text-lg font-black leading-none" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.2)' }}>{lvInfo.current.level}</span>
                              </div>
                            </div>

                            {/* 徳プログレスバー */}
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-gray-900 tabular-nums leading-none">{currentUser.totalToku}</span>
                                <span className="text-sm font-black text-gold">徳</span>
                              </div>
                              <div className="relative mt-1.5">
                                <div className="h-5 rounded-full bg-slate-200 overflow-hidden border border-slate-300/60">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 relative transition-all duration-700"
                                    style={{ width: `${Math.max(pct, 6)}%` }}
                                  >
                                  </div>
                                </div>
                                {lvInfo.next && (
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="text-[10px] font-black text-white tabular-nums" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}>
                                      {currentUser.totalToku} / {nextMin} 徳
                                    </span>
                                  </div>
                                )}
                                {/* ゴール旗 */}
                                <Flag className="absolute -right-1 -top-1.5 w-3.5 h-3.5 text-shrine-red fill-shrine-red drop-shadow-sm" />
                              </div>
                              <div className="flex items-center justify-between mt-1.5">
                                {lvInfo.next ? (
                                  <>
                                    <span className="text-[11px] text-gray-500">あと <span className="font-black text-shrine-red">{lvInfo.tokuToNext}</span> 徳</span>
                                    <span className="text-[11px] text-gray-400 truncate ml-2">次の称号：<span className="font-bold text-gray-600">{lvInfo.next.title}</span></span>
                                  </>
                                ) : (
                                  <span className="text-[11px] text-gold font-black">最高位に到達！</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
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
                    const completedChallenges = completedIds.map((id) => db.getQuest(id)).filter((c): c is NonNullable<typeof c> => !!c);
                    return completedChallenges.length === 0 ? (
                      <div className="text-center py-12">
                        <Flag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">まだ達成したクエストがありません。<br />クエストを制覇してバッジを集めよう。</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {completedChallenges.map((ch) => {
                          const photoMap = db.getChallengePhotos(ch.id);
                          const photos = ch.tasks.map((s) => photoMap[s.id]).filter((p): p is string => !!p);
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
                                onClick={() => setReviewQuest(ch)}
                                className="w-full mt-3 bg-shrine-red text-white text-[13px] font-black py-2.5 rounded-full flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-90"
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

        {/* ── 達成クエストの振り返り modal（写真・物語を振り返り、#YAOROZUQUEST でシェア） ── */}
        {reviewQuest && (() => {
          const ch = reviewQuest;
          const photoMap = db.getChallengePhotos(ch.id);
          const photos = ch.tasks.map((s) => photoMap[s.id]).filter((p): p is string => !!p);
          return (
            <div className="absolute inset-0 z-[4000] bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setReviewQuest(null)}>
              <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[88vh] overflow-y-auto animate-in" onClick={(e) => e.stopPropagation()}>
                {/* ヘッダー */}
                <div className="relative bg-gradient-to-br from-gold/30 to-amber-200/40 px-5 pt-6 pb-5 text-center">
                  <button onClick={() => setReviewQuest(null)} aria-label="閉じる" className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-gray-700 cursor-pointer"><X className="w-4 h-4" /></button>
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-white/70 flex items-center justify-center text-4xl shadow-sm">{ch.badgeIcon}</div>
                  <p className="text-[11px] font-black tracking-[0.2em] text-amber-700 mt-3">CHALLENGE COMPLETE</p>
                  <h3 className="text-lg font-black text-gray-900 mt-0.5">{ch.title}</h3>
                  <p className="text-[13px] text-amber-700 font-bold mt-0.5">🏆 「{ch.badgeName}」バッジ獲得</p>
                </div>
                <div className="px-5 py-4">
                  {photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {photos.map((p, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={p} alt="振り返り写真" className="w-full aspect-square rounded-xl object-cover border border-gold/30" />
                      ))}
                    </div>
                  )}
                  {/* 物語の振り返り（ステップ＋豆知識） */}
                  <div className="mt-4 space-y-2">
                    <h4 className="text-xs font-black text-gray-500">この旅でたどった道</h4>
                    {ch.tasks.map((s, i) => (
                      <div key={s.id} className="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2">
                        <span className="w-5 h-5 rounded-full bg-shrine-red text-white text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-gray-900">{s.title}</p>
                          {s.trivia && <p className="text-[13px] text-gray-600 leading-snug mt-0.5">{s.triviaCategory ? `${s.triviaCategory}｜` : ''}{s.trivia}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* ハッシュタグ＋シェア */}
                  <div className="mt-4 bg-shrine-red/5 border border-shrine-red/20 rounded-2xl p-3.5 text-center">
                    <p className="text-base font-black text-shrine-red tracking-wide">#YAOROZUQUEST</p>
                    <p className="text-[12px] text-gray-500 mt-0.5">この旅をハッシュタグつきでシェアしよう</p>
                    <button
                      onClick={() => shareQuest(ch.title, ch.badgeName, ch.badgeIcon, photos)}
                      className="w-full mt-3 bg-shrine-red text-white text-[15px] font-black py-3 rounded-full flex items-center justify-center gap-2 cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all"
                    >
                      <Share2 className="w-4 h-4" />写真つきでシェアする
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
