'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Trophy, Flag, Clock, X, Check, Hourglass } from 'lucide-react';
import { User, db } from '../lib/db';
import { difficultyLabel, terrainLabel, Challenge, AVATAR_QUEST, CONCERNS_QUEST, GOOD_QUEST, isStationaryQuest, buildGoshuinQuest } from '../data/challenges';
import { hasGoShuin } from '../lib/goshuin';
import { getLevelInfo } from '../data/levels';
import { distanceKm } from '../lib/geo';
import { ttlInfo } from '../lib/quest-ui';

// 座標を持つタスク（巡る場）を現在地から順に結んだ経路。2地点以上を「周遊」とみなし、
// 各区間距離（タスクid→km）と合計距離を返す。1地点以下なら null（従来の直線距離を使う）。
function questPath(userLoc: { lat: number; lng: number }, ch: Challenge): { total: number; legKm: Map<string, number> } | null {
  const pts = ch.tasks.filter((t) => typeof t.lat === 'number' && typeof t.lng === 'number');
  if (pts.length < 2) return null;
  let cur = userLoc;
  let total = 0;
  const legKm = new Map<string, number>();
  for (const t of pts) {
    const d = distanceKm(cur.lat, cur.lng, t.lat as number, t.lng as number);
    total += d;
    legKm.set(t.id, d);
    cur = { lat: t.lat as number, lng: t.lng as number };
  }
  return { total, legKm };
}

/** 距離(km)を「123m」「1.2km」表記にする。 */
function fmtDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

interface HomeTabProps {
  currentUser: User;
  userLocation: { lat: number; lng: number };
  isGeneratingQuests?: boolean;
  onStartChallenge: (challengeId: string) => void;
  onEndChallenge?: () => void;
  onChanged?: () => void;
  onNeedSpots?: () => void;
  /** 周辺の場とクエストをまとめて生成（「他のクエストを探す」） */
  onExploreMore?: () => void;
  /** 初回ガイド: フィルタを畳み、最寄り1件だけをコーチマーク付きで提示する */
  guided?: boolean;
}

export default function HomeTab({ currentUser, userLocation, isGeneratingQuests, onStartChallenge, onEndChallenge, onNeedSpots, onExploreMore, guided }: HomeTabProps) {
  // localStorage 依存のため、マウント後にのみ動的レンダリング（ハイドレーション不一致回避）
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // フィルタ：すべて / 未達成のみ / 達成したもの / 参加できるもの
  const [filter, setFilter] = useState<'all' | 'todo' | 'done' | 'joinable'>('todo');
  const [confirmCh, setConfirmCh] = useState<Challenge | null>(null); // 参加確認モーダル
  const [confirmQuit, setConfirmQuit] = useState(false); // 終了の二段階確認
  const openConfirm = (ch: Challenge | null) => { setConfirmQuit(false); setConfirmCh(ch); };
  // 最初は5個。「もっと見る」で +5
  const [visibleCount, setVisibleCount] = useState(5);
  useEffect(() => { setVisibleCount(5); }, [filter]);

  // 刻限チップ用の現在時刻（カードごとではなくタブで1本だけ更新）
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const progress = db.getChallengeProgress();
  const userLevel = getLevelInfo(currentUser.totalToku).current.level;

  // フィルタごとの件数
  const FILTERS = [
    { key: 'todo', label: '未達成', n: null },
    { key: 'done', label: '達成', n: progress.completed.length },
  ] as const;

  // 同じ場所のクエストは見出しでまとめる（グルーピング）。場の代表距離が近い順に並べ、
  // 場の中は距離順。移動なしクエスト（アバター設定）は「どこでも」グループとして末尾に置く。
  const groupKeyOf = (ch: Challenge) => (isStationaryQuest(ch) ? '__stationary__' : (ch.spotId || ch.goalName || ch.id));
  const groupLabelOf = (ch: Challenge): { emoji: string; name: string } => {
    if (isStationaryQuest(ch)) return { emoji: '✨', name: 'どこでも（移動不要）' };
    const s = ch.spotId ? db.getSpot(ch.spotId) : null;
    return { emoji: s?.godEmoji || '📍', name: s?.name || ch.goalName || 'その他の場' };
  };

  // フィルタ → 場ごとにクラスタリング（場は近い順、場内は距離順）。移動なしクエストも候補に含める。
  // 御朱印が未取得の近くの場には「御朱印を授かる」シンプルクエストを用意（最寄り8件まで）。
  const goshuinQuests = db.getSpots()
    .filter((s) => !hasGoShuin(currentUser.id, s.id))
    .map((s) => ({ s, d: distanceKm(userLocation.lat, userLocation.lng, s.latitude, s.longitude) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 8)
    .map((x) => buildGoshuinQuest(x.s));
  const scored = [...db.getAllQuests(), ...goshuinQuests, AVATAR_QUEST, CONCERNS_QUEST, GOOD_QUEST]
    .filter((ch) => {
      const completed = progress.completed.includes(ch.id);
      const ok = userLevel >= ch.minLevel;
      if (filter === 'todo') return !completed;
      if (filter === 'done') return completed;
      if (filter === 'joinable') return ok && !completed;
      return true;
    })
    .map((ch) => ({
      ch,
      d: isStationaryQuest(ch) ? Infinity : distanceKm(userLocation.lat, userLocation.lng, ch.goalLat, ch.goalLng),
      ok: userLevel >= ch.minLevel,
    }));
  const placeMap = new Map<string, typeof scored>();
  for (const it of scored) {
    const k = groupKeyOf(it.ch);
    const arr = placeMap.get(k);
    if (arr) arr.push(it); else placeMap.set(k, [it]);
  }
  const nearChallenges = [...placeMap.values()]
    .map((items) => ({ items, minD: Math.min(...items.map((i) => i.d)) }))
    .sort((a, b) => a.minD - b.minD) // 現在地から近い場のクエストを上に
    .flatMap((g) => g.items.sort((a, b) => a.d - b.d).map((i) => i.ch))
    .slice(0, 20);
  // 場の自動生成判定は「移動をともなう実クエスト」の有無で行う（アバター等の常設クエストで隠さない）
  const realQuestCount = nearChallenges.filter((c) => !isStationaryQuest(c)).length;
  const visibleChallenges = nearChallenges.slice(0, visibleCount);
  // 初回ガイド中は最寄りの1件だけに集中させる（最初の一手を明確にする）
  const shown = guided ? nearChallenges.slice(0, 1) : visibleChallenges;

  // クエストの追加・削除をスライド＆フェードで見せるための描画リスト。
  // shown（実データ）の差分を取り、新規は entering、消えたものは exiting にして
  // 退場アニメーション（約340ms）を待ってから取り除く。
  type RenderItem = { ch: Challenge; entering: boolean; exiting: boolean };
  const [renderItems, setRenderItems] = useState<RenderItem[]>(() => shown.map((ch) => ({ ch, entering: false, exiting: false })));
  const exitTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const shownIds = shown.map((c) => c.id).join(',');
  useEffect(() => {
    setRenderItems((prev) => {
      const prevActiveIds = new Set(prev.filter((p) => !p.exiting).map((p) => p.ch.id));
      const nextIds = new Set(shown.map((c) => c.id));
      // 現在の shown を基準に並べ直す（新規は entering）
      const result: RenderItem[] = shown.map((ch) => {
        // 退場アニメ中に復活した場合は、保留中の削除タイマーを取り消す
        if (exitTimers.current[ch.id]) { clearTimeout(exitTimers.current[ch.id]); delete exitTimers.current[ch.id]; }
        return { ch, entering: !prevActiveIds.has(ch.id), exiting: false };
      });
      // shown から消えたものは元の位置付近に exiting として差し戻し、退場後に取り除く
      prev.forEach((it, idx) => {
        if (it.exiting) return; // すでに退場中
        if (!nextIds.has(it.ch.id)) {
          result.splice(Math.min(idx, result.length), 0, { ch: it.ch, entering: false, exiting: true });
          if (!exitTimers.current[it.ch.id]) {
            exitTimers.current[it.ch.id] = setTimeout(() => {
              delete exitTimers.current[it.ch.id];
              setRenderItems((cur) => cur.filter((c) => c.ch.id !== it.ch.id));
            }, 340);
          }
        }
      });
      return result;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownIds]);
  // アンマウント時に保留中の退場タイマーを片付ける
  useEffect(() => () => { Object.values(exitTimers.current).forEach(clearTimeout); }, []);
  // 入場アニメーション完了後に entering フラグを下ろす（再生は一度だけ）
  const clearEntering = (id: string) => setRenderItems((cur) => cur.map((it) => (it.ch.id === id ? { ...it, entering: false } : it)));

  // クエストが表示されていないとき（'done'フィルタ除く）、場の生成をリクエスト。
  useEffect(() => {
    if (!mounted) return;
    if (filter === 'done') return;
    if (realQuestCount === 0) onNeedSpots?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, realQuestCount, filter]);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#f5f7fa]">
      {/* ── ブランドヘッダー ── */}
      {/* 上部はステータスバー/Dynamic Island を避けるため safe-area-inset-top を加算（端末以外では 0） */}
      <div
        className="px-5 pb-4 flex flex-col items-center text-center"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}
      >
        <h1 className="text-2xl font-black tracking-tight leading-none">
          <span className="text-shrine-red">YAOROZU</span>
          <span className="text-gray-900"> QUEST</span>
        </h1>
      </div>

      {/* ── 近くのヤオロズクエスト（チャレンジ） ── */}
      <div className="px-5 pb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
            <Flag className="w-4 h-4 text-shrine-red" />
            近くのヤオロズクエスト
          </h2>
        </div>

        {/* フィルタ（初回ガイド中は畳み、狐のコーチマークで最初の一手を示す） */}
        {guided ? (
          <div className="mb-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2.5">
            <span className="text-lg flex-shrink-0">🦊</span>
            <p className="text-[12px] font-bold text-amber-800 leading-snug">
              まずは一番近くの神に会いに行くのじゃ。御朱印をいただけば、街じゅうの神々が見えてくる。
            </p>
          </div>
        ) : (
          <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-none">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex-shrink-0 text-[13px] font-black px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                  filter === f.key
                    ? 'bg-shrine-red text-white border-shrine-red'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-shrine-red/40'
                }`}
              >
                {f.label}{mounted && f.n != null && <span className={filter === f.key ? 'text-white/80' : 'text-gray-400'}> {f.n}</span>}
              </button>
            ))}
          </div>
        )}

        {!mounted ? (
          <div className="text-center py-10 text-xs text-gray-400">読み込み中…</div>
        ) : nearChallenges.length === 0 ? (
          <div className="text-center py-12">
            {filter !== 'done' && isGeneratingQuests ? (
              <>
                <div className="mx-auto mb-3 w-8 h-8 border-2 border-shrine-red border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-bold text-shrine-red">近くの場からクエストを生成中…</p>
                <p className="text-xs text-gray-400 mt-1">しばらくお待ちください</p>
              </>
            ) : filter === 'done' ? (
              <p className="text-sm text-gray-400">まだ達成したクエストがありません。</p>
            ) : (
              <>
                <p className="text-sm text-gray-400">近くにクエストが見つかりません。</p>
                <button
                  onClick={() => onExploreMore?.()}
                  className="mt-3 inline-flex items-center gap-1 bg-shrine-red text-white text-sm font-black px-5 py-2.5 rounded-full hover:opacity-90 cursor-pointer"
                >
                  🔍 他のクエストを探す
                </button>
              </>
            )}
          </div>
        ) : (
        <div className="flex flex-col gap-3">
          {(() => { let lastGroup: string | null = null; return renderItems.map(({ ch, entering, exiting }) => {
            const diff = difficultyLabel(ch.difficulty);
            const qSpot = ch.spotId ? db.getSpot(ch.spotId) : null; // 神名＋地形バッジ用
            const terRaw = qSpot ? terrainLabel(qSpot.terrain) : null;
            const ter = terRaw && terRaw.label !== '平坦' ? terRaw : null; // 「平坦」は情報量が少ないので出さない
            const completed = progress.completed.includes(ch.id);
            const active = progress.activeId === ch.id; // 現在挑戦中
            // 複数の場を巡るクエストは経路の合計距離、単一なら従来の直線距離
            const chPath = questPath(userLocation, ch);
            const distToGoal = chPath ? chPath.total : distanceKm(userLocation.lat, userLocation.lng, ch.goalLat, ch.goalLng);
            const distValue = distToGoal < 1 ? `${Math.round(distToGoal * 1000)}` : `${distToGoal.toFixed(1)}`;
            const distUnit = distToGoal < 1 ? 'm' : 'km';
            const levelOk = userLevel >= ch.minLevel; // 必須レベルを満たすか

            const total = ch.tasks.length;
            const doneN = (progress.done[ch.id] || []).length;
            // 縁の刻限：未参加の生成クエストだけに残り寿命を出す（参加すれば恒久保持）
            const ttl = !active && !completed && doneN === 0 ? ttlInfo(ch.createdAt, nowTick) : null;
            // 同じ場所のまとまりに見出しを差し込む（退場アニメ中の項目は見出し判定に使わない）
            const gKey = groupKeyOf(ch);
            const showHeading = !exiting && gKey !== lastGroup;
            if (!exiting) lastGroup = gKey;
            const gl = showHeading ? groupLabelOf(ch) : null;
            // カードをタップするとモーダル（参加/終了ボタンはモーダル内）。
            return (
              <React.Fragment key={ch.id}>
                {gl && (
                  <div className="flex items-center gap-1.5 px-1 pt-1 first:pt-0">
                    <span className="text-sm">{gl.emoji}</span>
                    <h4 className="text-[12px] font-black text-gray-500 truncate max-w-[70%]">{gl.name}</h4>
                    <span className="flex-1 h-px bg-gray-200" />
                  </div>
                )}
              <button
                onClick={() => !exiting && openConfirm(ch)}
                aria-label={`クエスト「${ch.title}」を開く`}
                onAnimationEnd={(e) => { if (entering && e.target === e.currentTarget) clearEntering(ch.id); }}
                className={`w-full text-left rounded-2xl overflow-hidden transition-all cursor-pointer active:scale-[0.99] ${
                  exiting ? 'quest-card-out' : entering ? 'quest-card-in' : ''
                } ${
                  active
                    ? 'bg-[#2563eb] shadow-md'
                    : completed
                    ? 'bg-gold/10 shadow-sm'
                    : !levelOk
                    ? 'bg-gray-100 opacity-60'
                    : 'bg-white shadow-sm'
                }`}
              >
                <div className="flex items-stretch gap-3">
                  <div className={`w-20 self-stretch rounded-l-2xl flex items-center justify-center text-4xl flex-shrink-0 ${active ? 'bg-white/20' : completed ? 'bg-gold/20' : !levelOk ? 'bg-gray-200 grayscale' : 'bg-gradient-to-br from-blue-100 to-amber-100'}`}>
                    {!levelOk && !active && !completed ? '🔒' : ch.badgeIcon}
                  </div>
                  <div className="flex-1 min-w-0 py-3.5 pr-3.5">
                    <div className="flex items-center gap-1.5">
                      {active && <span className="text-[13px] font-black bg-white/25 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">挑戦中</span>}
                      {completed && !active && <span className="text-[11px] font-black bg-gold text-white px-1.5 py-0.5 rounded-full flex-shrink-0 flex items-center gap-0.5"><Check className="w-3 h-3" />達成済み</span>}
                      {ch.tasks.length === 1 && ch.tasks[0].type === 'goshuin' && (
                        <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 ${active ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-700'}`}>🔴 御朱印</span>
                      )}
                      <h3 className={`text-base font-black truncate ${active ? 'text-white' : 'text-gray-900'}`}>{ch.title}</h3>
                    </div>
                    {qSpot?.godName ? (
                      <p className={`text-[11px] font-bold truncate mb-0.5 ${active ? 'text-white/70' : 'text-gray-400'}`}>{qSpot.godEmoji ? `${qSpot.godEmoji} ` : ''}by {qSpot.godName}</p>
                    ) : null}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-[13px] font-black ${active ? 'text-white' : diff.text}`}>
                        {diff.stars} {diff.label}
                      </span>
                      <span className={`text-[13px] font-black ${active ? 'text-white' : levelOk ? 'text-gray-500' : 'text-rose-600'}`}>
                        {levelOk ? '' : '🔒 '}Lv.{ch.minLevel}〜
                      </span>
                      <span className={`text-[13px] flex items-center gap-0.5 ${active ? 'text-white/80' : 'text-gray-400'}`}>
                        <Clock className="w-3 h-3" />約{ch.estMinutes}分
                      </span>
                      {isStationaryQuest(ch) ? (
                        <span className={`text-[12px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'}`}>✨ 移動不要</span>
                      ) : (
                        <span className={`text-[13px] font-black flex items-center gap-0.5 ${active ? 'text-white' : 'text-shrine-red'}`}>
                          <MapPin className="w-3 h-3" />
                          <span className="tabular-nums">{distValue}</span>
                          <span className="text-[11px]">{distUnit}</span>
                        </span>
                      )}
                      {ter && (
                        <span className={`text-[12px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : ter.tone}`}>🥾 {ter.label}</span>
                      )}
                      {ttl && (
                        <span
                          className={`text-[11px] font-black flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${
                            ttl.tier === 'critical' ? 'bg-rose-100 text-rose-700 animate-pulse'
                              : ttl.tier === 'urgent' ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          <Hourglass className="w-3 h-3" />
                          {ttl.tier === 'critical' ? `まもなく消える・${ttl.text}`
                            : ttl.tier === 'urgent' ? `まもなく縁が切れる・${ttl.text}`
                            : ttl.text}
                        </span>
                      )}
                    </div>
                    {/* 進捗インジケータ（ステップごとのドット） */}
                    <div className="flex items-center gap-1 mt-2">
                      {ch.tasks.map((_, i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${
                            i < doneN
                              ? active ? 'bg-white' : completed ? 'bg-gold' : 'bg-shrine-red'
                              : active ? 'bg-white/30' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                      <span className={`text-[13px] font-black ml-1 ${active ? 'text-white' : 'text-gray-500'}`}>{doneN}/{total}</span>
                    </div>
                  </div>
                  {completed && <Trophy className={`w-6 h-6 flex-shrink-0 self-center mr-3.5 ${active ? 'text-white' : 'text-gold'}`} />}
                </div>
              </button>
              </React.Fragment>
            );
          }); })()}
          {!guided && visibleCount < nearChallenges.length && (
            <button
              onClick={() => setVisibleCount((c) => c + 5)}
              className="mx-auto mt-1 py-2 text-shrine-red text-sm font-black underline underline-offset-4 decoration-shrine-red/40 hover:decoration-shrine-red cursor-pointer"
            >
              もっと見る（残り{nearChallenges.length - visibleCount}件）
            </button>
          )}
          {/* 全件表示しきったら、控えめに「他のクエストを探す」を置く（達成タブでは出さない） */}
          {!guided && filter !== 'done' && visibleCount >= nearChallenges.length && (
            <button
              onClick={() => onExploreMore?.()}
              disabled={isGeneratingQuests}
              className="mx-auto mt-2 inline-flex items-center gap-1 text-[13px] font-black text-shrine-red border border-shrine-red/30 rounded-full px-4 py-2 hover:bg-shrine-red/5 disabled:opacity-50 disabled:cursor-default cursor-pointer"
            >
              {isGeneratingQuests ? '近くの場から生成中…' : '🔍 他のクエストを探す'}
            </button>
          )}
        </div>
        )}
      </div>

      {/* チャレンジモーダル（参加 / 終了 ボタンはここに表示） */}
      {confirmCh && (() => {
        const isActive = progress.activeId === confirmCh.id;
        const ok = userLevel >= confirmCh.minLevel;
        const mDoneN = (progress.done[confirmCh.id] || []).length;
        const mTotal = confirmCh.tasks.length;
        // 未参加クエストの刻限（参加・達成済みは恒久保持なので出さない）
        const mTtl = !isActive && !progress.completed.includes(confirmCh.id) ? ttlInfo(confirmCh.createdAt, nowTick) : null;
        // 複数の場を巡るクエストの経路（区間距離＋合計）。単一なら null。
        const mPath = questPath(userLocation, confirmCh);
        return (
          <div
            className="fixed inset-0 z-[4000] bg-black/40 flex items-center justify-center px-6"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6.5rem)',
            }}
            onClick={() => openConfirm(null)}
          >
            <div className="w-full max-w-[320px] max-h-full overflow-y-auto bg-white rounded-3xl p-5 text-center animate-in" onClick={(e) => e.stopPropagation()}>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-amber-100 flex items-center justify-center text-4xl mx-auto mb-3">{confirmCh.badgeIcon}</div>
              <h3 className="text-lg font-black text-gray-900">{confirmCh.title}</h3>
              {(() => {
                const godName = confirmCh.spotId ? db.getSpot(confirmCh.spotId)?.godName : null;
                return godName ? <p className="text-[11px] font-bold text-gray-400 mt-0.5">by {godName}</p> : null;
              })()}
              <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">{confirmCh.description}</p>
              <div className="flex items-center justify-center gap-2 mt-3 text-[13px] text-gray-500">
                <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />約{confirmCh.estMinutes}分</span>
                {mPath && (
                  <>
                    <span>・</span>
                    <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />計{fmtDist(mPath.total)}</span>
                  </>
                )}
                <span>・</span>
                <span>🏆 {confirmCh.badgeName}</span>
              </div>

              {/* クエスト詳細：タスク一覧 */}
              {confirmCh.tasks.length > 0 && (
                <div className="mt-4 text-left">
                  <p className="text-[11px] font-black text-gray-500 mb-1.5">クエストの内容（全{confirmCh.tasks.length}タスク）</p>
                  <div className="space-y-1.5">
                    {confirmCh.tasks.map((t, i) => (
                      <div key={t.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-2.5 py-2">
                        <span className="w-5 h-5 rounded-full bg-shrine-red text-white text-[11px] font-black flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <span className="text-base flex-shrink-0">{t.icon}</span>
                        <span className="flex-1 min-w-0 text-[12px] font-bold text-gray-800 truncate">{t.title}</span>
                        {mPath?.legKm.has(t.id) && (
                          <span className="text-[11px] font-black text-[#2563eb] flex-shrink-0 flex items-center gap-0.5"><MapPin className="w-3 h-3" />{fmtDist(mPath.legKm.get(t.id)!)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4">
                {isActive ? (
                  confirmQuit ? (
                    <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-left">
                      <p className="text-[12px] font-black text-rose-700 mb-1">チャレンジを終了する？</p>
                      <p className="text-[11px] text-rose-700/80 leading-relaxed mb-3">
                        {mDoneN > 0
                          ? `達成済みのステップ（${mDoneN}/${mTotal}）は保存され、また参加すれば続きから再開できます。`
                          : '進捗はまだありません。'}
                        道中の写真と軌跡は消えます。
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmQuit(false)}
                          className="flex-1 bg-gray-100 text-gray-600 text-sm font-black py-2.5 rounded-lg hover:bg-gray-200 cursor-pointer"
                        >
                          やめておく
                        </button>
                        <button
                          onClick={() => { openConfirm(null); onEndChallenge?.(); }}
                          className="flex-1 bg-rose-600 text-white text-sm font-black py-2.5 rounded-lg hover:opacity-90 cursor-pointer"
                        >
                          終了する
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmQuit(true)}
                      className="w-full bg-rose-600 text-white text-base font-black py-3 rounded-xl hover:opacity-90 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <X className="w-4 h-4" />チャレンジを終了する
                    </button>
                  )
                ) : ok ? (
                  <>
                    {mTtl && (mTtl.tier === 'critical' || mTtl.tier === 'urgent') ? (
                      <div className={`rounded-xl border px-3 py-2 mb-2 text-left ${mTtl.tier === 'critical' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                        <p className="text-[11px] font-black leading-snug">⏳ このクエストは{mTtl.text}で消えます。参加すれば縁は永く結ばれます。</p>
                      </div>
                    ) : confirmCh.createdAt ? (
                      <p className="text-[11px] text-gray-400 mb-1.5">⏳ 参加すればこの縁は刻限から守られ、永く結ばれる</p>
                    ) : null}
                    <p className="text-[11px] text-gray-400 mb-2">📯 参加すると、神からの新しいクエストの知らせを届けるため通知の許可を聞かれます</p>
                    <button
                      onClick={() => { const id = confirmCh.id; openConfirm(null); onStartChallenge(id); }}
                      className="w-full bg-shrine-red text-white text-base font-black py-3 rounded-xl hover:opacity-90 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Flag className="w-4 h-4" />このチャレンジに参加
                    </button>
                  </>
                ) : (
                  <div className="w-full bg-gray-100 text-gray-400 text-[13px] font-black py-3 rounded-xl flex items-center justify-center">🔒 Lv.{confirmCh.minLevel} 以上で参加可能</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
