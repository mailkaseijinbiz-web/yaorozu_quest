'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserCircle2, Trophy, MapPin, Check, Flag, Pencil, Clock, Share2, X, Stamp } from 'lucide-react';
import { db, Spot, Agent, User as UserType, UserContribution, Activity, SPOT_TTL_MS } from '../lib/db';
import { getGoShuinList, Goshuin } from '../lib/goshuin';
import { pullSnapshot, setSyncUser } from '../lib/cloud-sync';
import { isAuthConfigured, getSupabaseBrowser, signInWithProvider, signOutAuth, profileFromUser, type AuthProfile } from '../lib/supabase-browser';
import { distanceKm, destinationPoint } from '../lib/geo';
import HomeTab from '../components/HomeTab';
import MapTab from '../components/MapTab';
import SpotDetail from '../components/SpotDetail';
import DebugPanel from '../components/DebugPanel';
import { isDebugEnabled, getDebugLocation, setDebugLocation, type DebugLatLng } from '../lib/debug';
import { getLevelInfo } from '../data/levels';
import { getBadgeStates, godAvatarEmoji, type BadgeState } from '../data/badges';
import { Challenge } from '../data/challenges';
import type { Quest } from '../data/tasks';
import { subscribePush } from '../lib/push-client';

type TabType = 'home' | 'quest' | 'mypage';

// マイページ・ヒーローの装飾シェイプ（正十角形メダリオン枠 / XPシールド）
const MEDALLION_FRAME =
  'polygon(50% 0%, 79.4% 9.5%, 97.6% 34.5%, 97.6% 65.5%, 79.4% 90.5%, 50% 100%, 20.6% 90.5%, 2.4% 65.5%, 2.4% 34.5%, 20.6% 9.5%)';
const XP_SHIELD = 'polygon(0% 0%, 100% 0%, 100% 58%, 50% 100%, 0% 58%)';

// 場・クエストを「近い / 中くらい / 遠い」が混ざるように散らす距離（km）。約 500m / 1000m / 3000m。
const VARIED_SPOT_DISTANCES_KM = [0.5, 1.0, 3.0];

// 新たに獲得したバッジを検出（既読は localStorage で管理。初回は既存を既読化して演出しない）。
function detectNewBadges(stats: UserContribution, user: UserType): BadgeState[] {
  if (typeof window === 'undefined') return [];
  const states = getBadgeStates(stats, user);
  const earnedIds = states.filter((b) => b.earned).map((b) => b.id);
  let seen: string[];
  try {
    const raw = localStorage.getItem('yaorozu_badges_earned');
    if (raw === null) { localStorage.setItem('yaorozu_badges_earned', JSON.stringify(earnedIds)); return []; }
    seen = JSON.parse(raw);
  } catch { return []; }
  const seenSet = new Set(seen);
  const fresh = states.filter((b) => b.earned && !seenSet.has(b.id));
  if (fresh.length) {
    try { localStorage.setItem('yaorozu_badges_earned', JSON.stringify([...seenSet, ...fresh.map((b) => b.id)])); } catch {}
  }
  return fresh;
}

const FALLBACK_CURRENT_USER: UserType = {
  id: 'user-self',
  displayName: 'あなた (巡礼者)',
  avatarUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=you',
  totalToku: 0,
  currentTitle: '見習い巡礼者',
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isRevoked, setIsRevoked] = useState(false); // 管理者削除によるアカウント失効
  const [needsOnboard, setNeedsOnboard] = useState(false); // 初回起動の登録（オンボーディング）
  const [onboardName, setOnboardName] = useState(''); // オンボーディングの名前入力
  const [authProfile, setAuthProfile] = useState<AuthProfile | null>(null); // OAuthログイン中のユーザー
  const [earnedBadge, setEarnedBadge] = useState<BadgeState | null>(null); // 新規獲得バッジの演出
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
  // デバッグモード（位置情報が許可されない環境でも現在地を手動指定してテストできる）
  const [debugMode, setDebugMode] = useState(false);
  useEffect(() => { setDebugMode(isDebugEnabled()); }, []);
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
  const [mypageTab, setMypageTab] = useState<'activity' | 'goshuin' | 'badges' | 'quests'>('activity');
  const [goShuinList, setGoShuinList] = useState<Goshuin[]>([]);
  // 達成クエストの振り返り modal
  const [reviewQuest, setReviewQuest] = useState<Challenge | null>(null);

  // GPS 場の自動生成（最後に生成した座標と時刻を保持 — 近すぎる・頻度高すぎる場合はスキップ）
  const lastGenRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  // クエスト生成のクールダウン（最後に生成した時刻）
  const lastQuestGenRef = useRef<number>(0);
  // クエスト生成中フラグ（HomeTab のスピナー表示用）
  const [isGeneratingQuests, setIsGeneratingQuests] = useState(false);
  // useCallback 内から最新の activeSpot を参照するための ref
  const activeSpotRef = useRef<Spot | null>(null);
  // state との同期（毎レンダリング更新）
  activeSpotRef.current = activeSpot;

  /** 指定した場のクエストを generate-quest API で生成して保存する（force でクールダウン無視） */
  const generateQuestsForSpot = useCallback(async (spot: Spot, spotAgent: Agent | null, force = false) => {
    const now = Date.now();
    if (!force && now - lastQuestGenRef.current < 30_000) return; // 30 秒クールダウン
    lastQuestGenRef.current = now;
    setIsGeneratingQuests(true);
    try {
      const res = await fetch('/api/generate-quest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: 2,
          ts: now,
          spot: {
            id: spot.id,
            name: spot.name,
            category: spot.category,
            description: spot.description,
            enjoyments: spot.enjoyments,
            issues: spot.issues,
            soulMd: spotAgent?.soulMd,
            latitude: spot.latitude,
            longitude: spot.longitude,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json() as { quests?: Quest[] };
        if (Array.isArray(data.quests) && data.quests.length) {
          db.saveGeneratedQuests(spot.id, data.quests);
          db.trackApiCall('ai_generate');
          refreshDatabaseStates();
          // 通知はサーバ自動プッシュ（/api/generate-quest）が担うため、ここでは出さない
        }
      }
    } catch { /* ネットワークエラーは無視 */ }
    finally { setIsGeneratingQuests(false); }
  }, []);

  /**
   * 指定座標に場と神を1件生成・保存する（スロットルなし・低レベル）。
   * selectActive: アクティブスポット未設定なら生成した場を選択する。
   * chainQuests: その場のクエストも続けて生成する（クールダウン無視）。
   */
  const generateSpotAt = useCallback(async (
    lat: number,
    lng: number,
    opts: { selectActive?: boolean; chainQuests?: boolean } = {},
  ) => {
    // 既存スポットを再利用するときの共通処理：アクティブ選択し、クエストが無ければ生成する
    // （chainQuests を取りこぼさない＝場はあるがクエスト0、を防ぐ）。
    const reuseExisting = (existing: Spot) => {
      if (opts.selectActive && !activeSpotRef.current) setActiveSpot(existing);
      if (opts.chainQuests && db.getQuestsForSpot(existing.id).length === 0) {
        generateQuestsForSpot(existing, db.getAgentBySpot(existing.id) ?? null, true);
      }
    };
    try {
      // 実在優先：既に近く（~120m）に場があれば再生成しない（重複・無駄な API 呼び出しを防ぐ）。
      const near = db.getSpots().find(s => distanceKm(lat, lng, s.latitude, s.longitude) < 0.12);
      if (near) {
        reuseExisting(near);
        return;
      }
      const res = await fetch('/api/generate-spot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });
      if (!res.ok) return;
      const { spot: rawSpot, agent } = await res.json() as { spot: Spot; agent: Agent };
      // 管理者が削除した実在スポット（安定 ID）は、再訪しても復活させない（削除を尊重）。
      if (db.getDeletedSpots().some(s => s.id === rawSpot.id)) return;
      // 同一 ID（実在スポットは安定 ID）の場が既にあれば上書きしない＝蓄積した写真・口コミを守る。
      const dup = db.getSpots().find(s => s.id === rawSpot.id);
      if (dup) {
        reuseExisting(dup);
        return;
      }
      // 実在(verified)スポットは TTL を付けない＝期限切れで消えない。
      // AI 生成スポットだけ TTL を付与（System タブの spotTtlDays。未設定は既定 SPOT_TTL_MS）。
      const ttlMs = (db.getAppSettings().spotTtlDays || (SPOT_TTL_MS / 86_400_000)) * 86_400_000;
      const spot: Spot = rawSpot.verified
        ? rawSpot
        : { ...rawSpot, expiresAt: new Date(Date.now() + ttlMs).toISOString() };
      db.adminSaveSpot(spot);
      db.adminSaveAgent(agent);
      db.trackApiCall('ai_generate');
      db.logActivity({ type: 'spot_generate', userId: 'system', source: 'system', spotId: spot.id, detail: spot.name });
      db.logActivity({ type: 'god_generate', userId: 'system', source: 'system', spotId: spot.id, detail: agent.name || spot.godName });
      refreshDatabaseStates();
      // アクティブスポットが未設定なら生成した場を選択（地図がその位置にパンされる）
      if (opts.selectActive && !activeSpotRef.current) {
        setActiveSpot(spot);
      }
      if (opts.chainQuests) {
        generateQuestsForSpot(spot, agent, true);
      }
    } catch { /* ネットワークエラーは無視 */ }
  }, [generateQuestsForSpot]);

  /** 現在地周辺に1件だけ場を生成する（スロットルつき・地図移動などの逐次生成用）。 */
  const generateSpotNearby = useCallback(async (lat: number, lng: number, force = false) => {
    const now = Date.now();
    const prev = lastGenRef.current;
    // 5 分以内かつ 500 m 以内なら重複生成しない（force 時は無視）
    if (!force && prev && now - prev.at < 5 * 60_000 && distanceKm(lat, lng, prev.lat, prev.lng) < 0.5) return;
    lastGenRef.current = { lat, lng, at: now };
    // 場を生成後、クエストが無い or force 時はこの場のクエストも生成する
    await generateSpotAt(lat, lng, { selectActive: true, chainQuests: force || db.getAllQuests().length === 0 });
  }, [generateSpotAt]);

  /**
   * 現在地周辺に「近い・中くらい・遠い」が混ざるよう、約 500m / 1000m / 3000m の3地点へ
   * 場とクエストをまとめて生成する。地図に場が無いとき・「他のクエストを探す」で使う。
   */
  const generateVariedSpots = useCallback(async (centerLat: number, centerLng: number, force = false) => {
    const now = Date.now();
    const prev = lastGenRef.current;
    // 同じ場所での 5 分以内の連続バッチ生成は抑止（force 時は無視）
    if (!force && prev && now - prev.at < 5 * 60_000 && distanceKm(centerLat, centerLng, prev.lat, prev.lng) < 0.5) return;
    lastGenRef.current = { lat: centerLat, lng: centerLng, at: now };
    // 各距離帯にランダムな方位で1件ずつ。最初の1件だけアクティブにする。
    // 直列実行：Overpass を同一 IP から同時多発で叩いて「busy/429」を自分で誘発しないため。
    for (let i = 0; i < VARIED_SPOT_DISTANCES_KM.length; i++) {
      const { lat, lng } = destinationPoint(centerLat, centerLng, VARIED_SPOT_DISTANCES_KM[i], Math.random() * 360);
      await generateSpotAt(lat, lng, { selectActive: i === 0, chainQuests: true });
    }
  }, [generateSpotAt]);

  // Initial load
  useEffect(() => {
    const initSpots = db.getSpots();
    setSpots(initSpots);
    const users = db.getUsers();
    const profiles: { [userId: string]: UserType } = {};
    users.forEach(u => { profiles[u.id] = u; });
    setCreatorProfiles(profiles);

    const initialSpot = initSpots[0];
    setActiveSpot(initialSpot ?? null);

    // 管理者に削除されたユーザーは再ログイン画面へ
    if (db.isRevoked('user-self')) {
      setIsRevoked(true);
      return;
    }
    // getUser が null でも currentUser を必ず非 null にする（マイページが空白になるのを防ぐ）
    const self = db.getUser('user-self') ?? FALLBACK_CURRENT_USER;
    setCurrentUser(self);
    setEditName(self.displayName);
    // 初回起動：未登録ならオンボーディング（名前・アバター設定）へ
    if (typeof window !== 'undefined' && localStorage.getItem('yaorozu_registered') !== '1') {
      setNeedsOnboard(true);
      setOnboardName(self.displayName && self.displayName !== '巡礼者' ? self.displayName : '');
    }
    setUserStats(db.getUserStats('user-self'));
    setActiveChallengeId(db.getChallengeProgress().activeId);

    if (typeof window !== 'undefined') {
      const claimed = localStorage.getItem('yaorozu_claimed_quests');
      if (claimed) setClaimedQuests(JSON.parse(claimed));
      setHasChatted(localStorage.getItem('yaorozu_quest_chatted') === 'true');
      setHasTakenPhoto(localStorage.getItem('yaorozu_quest_photo') === 'true');
      setGoShuinList(getGoShuinList('user-self'));
    }

    // 初回生成のシード座標：デバッグ位置があればそれ、無ければ東京デフォルト（GPS取得前）
    const seed = (isDebugEnabled() && getDebugLocation()) || { lat: 35.6580, lng: 139.7514 };
    // 初回表示時：場が無ければ生成（クエスト有無に関係なく）。場があってクエストが無ければクエストだけ生成
    if (initSpots.length === 0) {
      // 場も無い → 近・中・遠の場を複数生成（場の生成後にクエストも自動チェーンされる）
      generateVariedSpots(seed.lat, seed.lng);
    } else if (db.getAllQuests().length === 0) {
      // 場はあるがクエストが無い → クエストを生成
      const agentSpotIds = new Set(db.getAgents().map(a => a.spotId));
      const spotWithAgent = initSpots.find(s => agentSpotIds.has(s.id));
      if (spotWithAgent) {
        generateQuestsForSpot(spotWithAgent, db.getAgentBySpot(spotWithAgent.id) ?? null);
      } else {
        generateSpotNearby(seed.lat, seed.lng);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // 認証ユーザー（OAuth）をアプリのプロフィール＋同期ユーザーに反映する
  const applyAuthUser = useCallback((u: import('@supabase/supabase-js').User) => {
    const p = profileFromUser(u);
    setAuthProfile(p);
    setSyncUser(p.id); // クラウドデータを認証ユーザー単位に分離
    // ローカルプロフィールを認証アイデンティティで更新
    db.updateUserProfile('user-self', p.displayName);
    db.setUserAvatar('user-self', p.avatarUrl);
    try { localStorage.setItem('yaorozu_registered', '1'); } catch {}
    setNeedsOnboard(false);
    // 認証ユーザーのクラウドデータを復元
    pullSnapshot().then(() => refreshDatabaseStates());
    const self = db.getUser('user-self');
    if (self) { setCurrentUser(self); setEditName(self.displayName); }
  }, []);

  // Supabase Auth セッション監視（OAuth リダイレクト復帰・サインイン/アウト）
  useEffect(() => {
    if (!isAuthConfigured()) return;
    const sb = getSupabaseBrowser();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => { if (data.session?.user) applyAuthUser(data.session.user); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (session?.user) applyAuthUser(session.user);
      else { setAuthProfile(null); setSyncUser(null); }
    });
    return () => { sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyAuthUser]);

  // 実際のGPS現在地を取得して反映
  const requestLocation = useCallback(() => {
    // デバッグモード：実 GPS を使わず、手動設定した座標（無ければ既定の東京中心）を現在地にする
    if (isDebugEnabled()) {
      const dbg = getDebugLocation();
      if (dbg) setUserLocation(dbg);
      setGeoStatus('ok'); // 不許可バナーを出さず、距離計算などの機能を有効化
      return;
    }
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

  // GPS を継続監視して、歩いて移動しても現在地が追従して更新されるようにする
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('error');
      return;
    }
    setGeoStatus('locating');
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('ok');
      },
      (err) => {
        // 取得失敗時は既定の現在地（東京中心）を維持しつつ、状態を明示
        setGeoStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // デバッグ：指定座標を現在地として設定し、その地点の場を生成する
  const applyDebugLocation = useCallback((loc: DebugLatLng) => {
    setDebugLocation(loc);       // localStorage に保持（リロードしても維持）
    setUserLocation(loc);
    setGeoStatus('ok');
    // ジャンプ先は周囲に場が無いので、近・中・遠を確実に生成（force でスロットル無視）
    generateVariedSpots(loc.lat, loc.lng, true);
    if (currentUser) db.logActivity({ type: 'map_move', userId: currentUser.id, source: 'human' });
  }, [generateVariedSpots, currentUser]);

  // 場が0件かつ位置情報が確定したら自動生成（初回起動・全期限切れ後）。
  // 地図に場が無いので、近・中・遠が混ざるよう複数生成する。
  useEffect(() => {
    if (spots.length > 0) return;
    if (geoStatus === 'locating') return;
    generateVariedSpots(userLocation.lat, userLocation.lng);
  }, [spots.length, geoStatus, userLocation, generateVariedSpots]);

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
    // クラウド復元後に getUser が null でも currentUser を非 null に保つ（マイページの空白防止）
    const self = db.getUser('user-self') ?? FALLBACK_CURRENT_USER;
    setCurrentUser(self);
    const stats = db.getUserStats('user-self');
    setUserStats(stats);
    if (activeSpot) {
      const refreshedSpot = db.getSpot(activeSpot.id);
      if (refreshedSpot) setActiveSpot(refreshedSpot);
    }
    // 新たに条件を満たしたバッジがあれば獲得演出
    const fresh = detectNewBadges(stats, self);
    if (fresh.length) setEarnedBadge(fresh[0]);
  };

  // バッジ獲得演出を数秒で自動的に閉じる
  useEffect(() => {
    if (!earnedBadge) return;
    const t = setTimeout(() => setEarnedBadge(null), 4500);
    return () => clearTimeout(t);
  }, [earnedBadge]);

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

  // アカウント削除 → 再ログイン画面
  if (isRevoked) {
    return (
      <div className="flex-1 min-h-dvh bg-[#eaecef] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-xs w-full text-center">
          <div className="text-5xl mb-4">⛩️</div>
          <h1 className="text-lg font-black text-gray-900 mb-2">アカウントが削除されました</h1>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">管理者によってアカウントが削除されました。<br />再度ご利用には再登録が必要です。</p>
          <button
            onClick={() => {
              db.reinstateUser('user-self');
              // ユーザーデータをクリアして再スタート（登録もリセットしてオンボーディングへ）
              ['yaorozu_users','yaorozu_user_stats','yaorozu_challenge_progress','yaorozu_challenge_photos','yaorozu_goshuin_user-self','yaorozu_registered'].forEach(k => localStorage.removeItem(k));
              window.location.reload();
            }}
            className="w-full bg-shrine-red text-white font-black py-3 rounded-xl hover:opacity-90 cursor-pointer"
          >
            新たな巡礼者として始める
          </button>
        </div>
      </div>
    );
  }

  // 初回起動：巡礼者登録（オンボーディング）
  if (needsOnboard) {
    const previewName = onboardName.trim() || 'あなた';
    const avatarUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(previewName)}`;
    const register = () => {
      const name = onboardName.trim();
      if (!name) return;
      const updated = db.updateUserProfile('user-self', name); // displayName + avatar を設定
      setCurrentUser(updated);
      setEditName(updated.displayName);
      try { localStorage.setItem('yaorozu_registered', '1'); } catch {}
      if (currentUser) db.logActivity({ type: 'home_view', userId: 'user-self', source: 'human', detail: '登録' });
      setNeedsOnboard(false);
      refreshDatabaseStates();
    };
    return (
      <div className="flex-1 min-h-dvh bg-[#eaecef] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-xs w-full text-center">
          <div className="text-2xl font-black tracking-tight leading-none mb-1">
            <span className="text-shrine-red">YAOROZU</span><span className="text-gray-900"> QUEST</span>
          </div>
          <p className="text-[13px] text-gray-500 mb-5">巡礼者として、名前を授かりましょう。</p>

          {/* アカウントでログイン（OAuth 設定時のみ表示） */}
          {isAuthConfigured() && (
            <div className="mb-5">
              <button
                onClick={() => signInWithProvider('google')}
                className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-800 font-black py-3 rounded-xl hover:bg-gray-50 active:scale-[0.99] transition-all cursor-pointer mb-2"
              >
                <span className="text-base">🔵</span> Google で続ける
              </button>
              <button
                onClick={() => signInWithProvider('apple')}
                className="w-full flex items-center justify-center gap-2 bg-black text-white font-black py-3 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer"
              >
                <span className="text-base"></span> Apple で続ける
              </button>
              <div className="flex items-center gap-2 my-4">
                <span className="flex-1 h-px bg-gray-200" />
                <span className="text-[11px] text-gray-400">または</span>
                <span className="flex-1 h-px bg-gray-200" />
              </div>
              <p className="text-[12px] font-bold text-gray-500 mb-2">ゲストとして始める</p>
            </div>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarUrl} alt="アバター" className="w-24 h-24 mx-auto rounded-full border-4 border-shrine-red/30 bg-sky-50 mb-4" />
          <input
            type="text"
            value={onboardName}
            onChange={(e) => setOnboardName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') register(); }}
            maxLength={12}
            autoFocus
            placeholder="巡礼者の名前"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-center text-base text-gray-900 focus:outline-none focus:border-shrine-red mb-2"
          />
          <p className="text-[11px] text-gray-400 mb-4">アバターは名前から自動生成されます（後でクエストの「アバターを撮る」で写真にできます）。</p>
          <button
            onClick={register}
            disabled={!onboardName.trim()}
            className="w-full bg-shrine-red text-white font-black py-3 rounded-xl hover:opacity-90 disabled:opacity-40 cursor-pointer"
          >
            巡礼をはじめる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-dvh bg-[#eaecef] flex items-center justify-center font-sans overflow-hidden p-0 sm:p-4 md:p-8 relative">
      {/* Background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#e60012]/3 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#c5a028]/3 blur-[120px] rounded-full pointer-events-none" />

      {/* Phone frame */}
      <div className="w-full h-dvh sm:h-[840px] sm:max-w-[395px] sm:rounded-[48px] sm:border-[11px] sm:border-[#1E2024] sm:shadow-[0_24px_80px_rgba(0,0,0,0.15)] relative overflow-hidden flex flex-col bg-[#f5f7fa] z-10 sm:scale-[0.98] lg:scale-100 transition-all duration-300">

        {/* iOS Dynamic Island */}
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5.5 bg-[#1E2024] rounded-b-2xl z-50 pointer-events-none" />

        {/* デバッグパネル（?debug=1 で有効化。位置情報なしでも現在地を手動指定してテスト可能） */}
        {debugMode && (
          <DebugPanel
            location={userLocation}
            geoStatus={geoStatus}
            onApply={applyDebugLocation}
            onDisable={() => setDebugMode(false)}
          />
        )}

        {/* Viewport */}
        <div className="flex-1 relative overflow-hidden bg-[#f5f7fa] flex flex-col">

          {/* Tab content */}
          <div className={`flex-1 h-full overflow-hidden relative z-0 ${activeTab === 'home' ? '' : 'overflow-y-auto'}`}>

            {/* ── ホーム (Map) ── */}
            {activeTab === 'home' && (
              <HomeTab
                currentUser={currentUser || FALLBACK_CURRENT_USER}
                userLocation={userLocation}
                isGeneratingQuests={isGeneratingQuests}
                onStartChallenge={(cid) => {
                  subscribePush(); // クエスト参加を機に通知購読（以降サーバ自動プッシュが届く）
                  db.setActiveChallenge(cid);
                  setActiveChallengeId(cid);
                  setActiveTab('quest');
                }}
                onEndChallenge={() => { db.setActiveChallenge(null); setActiveChallengeId(null); }}
                onChanged={refreshDatabaseStates}
                onNeedSpots={() => {
                  const existingSpots = db.getSpots();
                  if (existingSpots.length === 0) {
                    generateVariedSpots(userLocation.lat, userLocation.lng);
                  } else {
                    const agentIds = new Set(db.getAgents().map(a => a.spotId));
                    const target = existingSpots.find(s => agentIds.has(s.id)) ?? existingSpots[0];
                    generateQuestsForSpot(target, db.getAgentBySpot(target.id) ?? null);
                  }
                }}
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
                  onStartChallenge={(cid) => { subscribePush(); db.setActiveChallenge(cid); setActiveChallengeId(cid); }}
                  activeChallenge={activeChallengeId ? db.getQuest(activeChallengeId) ?? null : null}
                  onClearChallenge={() => { db.setActiveChallenge(null); setActiveChallengeId(null); }}
                  onMapMove={(center) => {
                    if (currentUser) db.logActivity({ type: 'map_move', userId: currentUser.id, source: 'human' });
                    generateSpotNearby(center.lat, center.lng);
                  }}
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

                          {/* 徳バー */}
                          <div className="w-full mt-5">
                            <div className="text-left">
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-gray-900 tabular-nums leading-none">{currentUser.totalToku}</span>
                                <span className="text-sm font-black text-gray-900">徳</span>
                              </div>
                              <div className="relative mt-1.5 pr-2">
                                <div className="h-5 rounded-full bg-slate-200 overflow-hidden border border-slate-300/60">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 relative transition-all duration-700"
                                    style={{ width: `${Math.max(pct, 6)}%` }}
                                  >
                                  </div>
                                </div>
                                {/* ゴール旗（大きめ） */}
                                <Flag className="absolute -right-1 -top-2.5 w-6 h-6 text-shrine-red fill-shrine-red drop-shadow-sm" />
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

                  {/* ログイン状態（OAuth） */}
                  {isAuthConfigured() && (
                    <div className="relative mt-4 flex items-center justify-center gap-2 text-[12px]">
                      {authProfile ? (
                        <>
                          <span className="text-gray-500 truncate max-w-[180px]">🔓 {authProfile.email ?? authProfile.displayName}</span>
                          <button
                            onClick={async () => { await signOutAuth(); setSyncUser(null); setAuthProfile(null); window.location.reload(); }}
                            className="font-black text-shrine-red hover:underline cursor-pointer"
                          >ログアウト</button>
                        </>
                      ) : (
                        <>
                          <span className="text-gray-400">ゲストでプレイ中</span>
                          <button onClick={() => signInWithProvider('google')} className="font-black text-shrine-red hover:underline cursor-pointer">Googleでログイン</button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* タブ */}
                <div className="flex border-b border-black/5 bg-white sticky top-0 z-10">
                  {([
                    { key: 'activity', label: 'アクティビティ', icon: Clock },
                    { key: 'goshuin',  label: '御朱印',         icon: Stamp },
                    { key: 'quests',   label: '達成クエスト',   icon: Flag },
                    { key: 'badges',   label: 'バッジ',         icon: Trophy },
                  ] as const).map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setMypageTab(key)} className={`flex-1 py-2.5 flex flex-col items-center justify-center gap-0.5 text-[10px] font-black transition-all cursor-pointer border-b-2 ${mypageTab === key ? 'text-shrine-red border-shrine-red' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                  ))}
                </div>

                {/* タブ内容 */}
                <div className="p-4">
                  {/* アクティビティ（訪問・クエスト参加・依頼達成などの履歴） */}
                  {mypageTab === 'activity' && (() => {
                    // ユーザーのアクティビティでは「ホームタブを表示」「地図を移動」などの操作ログは出さない
                    const HIDDEN_USER_ACTS = new Set(['home_view', 'map_move', 'spot_generate', 'god_generate', 'spot_delete']);
                    const activities = db.getActivities()
                      .filter((a) => a.userId === currentUser.id && !HIDDEN_USER_ACTS.has(a.type))
                      .slice(0, 60);

                    const TASK_LABEL: Record<string, string> = {
                      context: 'コンテキスト収集', photo: '写真奉納', evaluate: '写真評価',
                      event: 'できごと報告', review: 'クチコミ', sns: 'SNS共有',
                      buy: '買い物体験', eat: '食事体験', cleaning: '清掃奉仕',
                      visit: '来訪', resolveIssue: '課題解決', judge: '評価',
                    };
                    const ACT_CFG: Record<Activity['type'], { icon: string; bg: string; text: string; label: (a: Activity) => string }> = {
                      visit:          { icon: '📍', bg: 'bg-blue-50',   text: 'text-blue-700',   label: (a) => `${db.getSpot(a.spotId ?? '')?.name ?? a.spotId ?? '場所'} を訪問` },
                      quest_join:     { icon: '🏴', bg: 'bg-indigo-50', text: 'text-indigo-700', label: (a) => `「${db.getQuest(a.challengeId ?? '')?.title ?? 'クエスト'}」に参加` },
                      quest_step:     { icon: '✅', bg: 'bg-emerald-50',text: 'text-emerald-700',label: (a) => `クエストのミッションを達成` },
                      quest_complete: { icon: '🏆', bg: 'bg-amber-50',  text: 'text-amber-700',  label: (a) => `「${db.getQuest(a.challengeId ?? '')?.title ?? 'クエスト'}」を制覇！` },
                      task:           { icon: '⭐', bg: 'bg-violet-50', text: 'text-violet-700', label: (a) => `${db.getSpot(a.spotId ?? '')?.name ?? '場所'} で${TASK_LABEL[a.detail ?? ''] ?? '依頼'}を達成` },
                      photo:          { icon: '📸', bg: 'bg-rose-50',   text: 'text-rose-700',   label: (a) => `${db.getSpot(a.spotId ?? '')?.name ?? '場所'} に写真を奉納` },
                      ugc:            { icon: '💬', bg: 'bg-sky-50',    text: 'text-sky-700',    label: (a) => `${db.getSpot(a.spotId ?? '')?.name ?? '場所'} に口コミを投稿` },
                      home_view:      { icon: '🏠', bg: 'bg-slate-50',  text: 'text-slate-700',  label: () => 'ホームタブを表示' },
                      map_move:       { icon: '🗺️', bg: 'bg-teal-50',   text: 'text-teal-700',   label: () => '地図を移動' },
                      spot_generate:  { icon: '✨', bg: 'bg-purple-50', text: 'text-purple-700', label: (a) => `場を生成：${a.detail ?? '新しい場所'}` },
                      god_generate:   { icon: '🪷', bg: 'bg-fuchsia-50',text: 'text-fuchsia-700',label: (a) => `神を生成：${a.detail ?? '新しい神'}` },
                      spot_delete:    { icon: '🗑️', bg: 'bg-rose-50',   text: 'text-rose-700',   label: (a) => `場を削除：${a.detail ?? '場所'}` },
                    };

                    if (activities.length === 0) return (
                      <div className="text-center py-12">
                        <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs text-gray-400">まだアクティビティがありません。<br />スポットを訪問してクエストに挑もう。</p>
                      </div>
                    );

                    return (
                      <div className="space-y-2">
                        {activities.map((a) => {
                          const cfg = ACT_CFG[a.type] ?? ACT_CFG.task;
                          return (
                            <div key={a.id} className="flex items-start gap-3 bg-white rounded-2xl p-3 border border-black/5 shadow-sm">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${cfg.bg}`}>
                                {cfg.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-bold leading-snug ${cfg.text}`}>{cfg.label(a)}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-[11px] text-gray-400">{new Date(a.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                  {a.reward != null && a.reward > 0 && (
                                    <span className="text-[11px] font-black text-amber-600">+{a.reward}徳</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* 御朱印帳 */}
                  {mypageTab === 'goshuin' && (() => {
                    if (goShuinList.length === 0) {
                      return (
                        <div className="text-center py-14">
                          <div className="text-5xl mb-3">📖</div>
                          <p className="text-sm font-black text-gray-500">御朱印帳が空です</p>
                          <p className="text-xs text-gray-400 mt-1">神と対話すると御朱印を授かります</p>
                        </div>
                      );
                    }
                    return (
                      <div>
                        <p className="text-[11px] text-gray-400 mb-3 text-right">{goShuinList.length} 社寺</p>
                        <div className="grid grid-cols-2 gap-3">
                          {[...goShuinList].reverse().map((g) => {
                            const d = new Date(g.receivedAt);
                            const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
                            const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                            return (
                              <div key={g.id} className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden flex flex-col items-center py-4 px-2 gap-1.5">
                                {/* 朱印円 */}
                                <div className="relative w-20 h-20 flex-shrink-0">
                                  <div className="absolute inset-0 rounded-full border-4 border-red-600/80" />
                                  <div className="absolute inset-1.5 rounded-full border-2 border-red-600/40" />
                                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                                    <span className="text-2xl leading-none">{g.godEmoji}</span>
                                    <span className="text-[8px] font-black text-red-700 text-center leading-tight px-1" style={{ maxWidth: 64 }}>{g.godName}</span>
                                  </div>
                                </div>
                                {/* スポット名 */}
                                <p className="text-[11px] font-black text-gray-800 text-center leading-tight line-clamp-2">{g.spotName}</p>
                                <p className="text-[9px] text-gray-400">{dateStr} {timeStr}</p>
                              </div>
                            );
                          })}
                        </div>
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
                  if (key === 'home') {
                    setHomeResetSignal(s => s + 1);
                    if (currentUser) db.logActivity({ type: 'home_view', userId: currentUser.id, source: 'human' });
                    // 場が無ければ近・中・遠を複数生成。あれば現在地に1件だけ追加（スロットルつき）。
                    if (db.getSpots().length === 0) {
                      generateVariedSpots(userLocation.lat, userLocation.lng);
                    } else {
                      generateSpotNearby(userLocation.lat, userLocation.lng);
                      // 場はあるがクエストが無い場合は最近の場からクエストを生成
                      if (db.getAllQuests().length === 0) {
                        const agentSpotIds = new Set(db.getAgents().map(a => a.spotId));
                        const spotWithAgent = db.getSpots().find(s => agentSpotIds.has(s.id));
                        if (spotWithAgent) {
                          generateQuestsForSpot(spotWithAgent, db.getAgentBySpot(spotWithAgent.id) ?? null);
                        }
                        // 場はあるが agent が無い場合は generateSpotNearby 内でクエスト生成がチェーンされる
                      }
                    }
                  }
                  if (key === 'quest' && spots.length === 0) {
                    // マップに場が表示されていない場合は近・中・遠を複数生成する
                    generateVariedSpots(userLocation.lat, userLocation.lng);
                  }
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
            onGoShuinGranted={() => {
              if (currentUser) setGoShuinList(getGoShuinList(currentUser.id));
            }}
            activeChallenge={activeChallengeId ? db.getQuest(activeChallengeId) ?? null : null}
            onAdvanceChallenge={(stepId, photo) => {
              if (!activeChallengeId || !currentUser) return;
              const ch = db.getQuest(activeChallengeId);
              if (!ch) return;
              if (photo) db.saveChallengePhoto(activeChallengeId, stepId, photo);
              db.completeChallengeStep(currentUser.id, activeChallengeId, stepId, ch.tasks.length);
              refreshDatabaseStates();
            }}
          />
        )}

        {/* ── 達成クエストの振り返り modal（写真・物語を振り返り、#YAOROZUQUEST でシェア） ── */}
        {reviewQuest && (() => {
          const ch = reviewQuest;
          const photoMap = db.getChallengePhotos(ch.id);
          const commentMap = db.getChallengeComments(ch.id);
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
                          {commentMap[s.id] && <p className="text-[12px] text-gray-700 leading-snug mt-1 bg-white border border-gray-200 rounded-lg px-2 py-1">💬 {commentMap[s.id]}</p>}
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

        {/* ── バッジ獲得演出 ── */}
        {earnedBadge && (
          <div className="absolute inset-0 z-[4500] flex items-center justify-center p-6" onClick={() => setEarnedBadge(null)}>
            <div className="absolute inset-0 bg-black/55" />
            <div className="relative celebrate-pop w-full max-w-[300px] bg-white rounded-3xl shadow-2xl px-6 py-7 text-center">
              <p className="text-[11px] font-black tracking-[0.25em] text-amber-500">BADGE GET!</p>
              <div className="relative inline-block mt-3 mb-1">
                <div className="badge-ring" />
                <div className="badge-ring badge-ring-2" />
                <div className="text-6xl badge-acquired leading-none">{earnedBadge.icon}</div>
              </div>
              <h3 className="text-lg font-black text-gray-900 mt-3">{earnedBadge.name}</h3>
              <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">{earnedBadge.desc}</p>
              <button
                onClick={() => setEarnedBadge(null)}
                className="w-full mt-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[15px] font-black py-3 rounded-full shadow-lg shadow-amber-500/40 hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer"
              >
                やった！
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
