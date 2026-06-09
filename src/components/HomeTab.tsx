'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Trophy, Flag, Clock, X, Check } from 'lucide-react';
import { User, db } from '../lib/db';
import { difficultyLabel, Challenge } from '../data/challenges';
import { getLevelInfo } from '../data/levels';
import { distanceKm } from '../lib/geo';

interface HomeTabProps {
  currentUser: User;
  userLocation: { lat: number; lng: number };
  isGeneratingQuests?: boolean;
  onStartChallenge: (challengeId: string) => void;
  onEndChallenge?: () => void;
  onChanged?: () => void;
  onNeedSpots?: () => void;
}

export default function HomeTab({ currentUser, userLocation, isGeneratingQuests, onStartChallenge, onEndChallenge, onNeedSpots }: HomeTabProps) {
  // localStorage 依存のため、マウント後にのみ動的レンダリング（ハイドレーション不一致回避）
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // フィルタ：すべて / 未達成のみ / 達成したもの / 参加できるもの
  const [filter, setFilter] = useState<'all' | 'todo' | 'done' | 'joinable'>('todo');
  const [confirmCh, setConfirmCh] = useState<Challenge | null>(null); // 参加確認モーダル
  // 最初は5個。「もっと見る」で +5
  const [visibleCount, setVisibleCount] = useState(5);
  useEffect(() => { setVisibleCount(5); }, [filter]);

  const progress = db.getChallengeProgress();
  const userLevel = getLevelInfo(currentUser.totalToku).current.level;

  // フィルタごとの件数
  const FILTERS = [
    { key: 'todo', label: '未達成', n: null },
    { key: 'done', label: '達成', n: progress.completed.length },
  ] as const;

  // フィルタ → 第1ソート＝参加できるもの、第2ソート＝距離の近い順
  const nearChallenges = db.getAllQuests()
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
      d: distanceKm(userLocation.lat, userLocation.lng, ch.goalLat, ch.goalLng),
      ok: userLevel >= ch.minLevel,
    }))
    .sort((a, b) => {
      if (a.ok !== b.ok) return a.ok ? -1 : 1;
      return a.d - b.d;
    })
    .slice(0, 20)
    .map((x) => x.ch);
  const visibleChallenges = nearChallenges.slice(0, visibleCount);

  // クエストが表示されていないとき（'done'フィルタ除く）、場の生成をリクエスト
  useEffect(() => {
    if (!mounted) return;
    if (filter === 'done') return;
    if (nearChallenges.length === 0) onNeedSpots?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, nearChallenges.length, filter]);

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

        {/* フィルタ */}
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
            ) : (
              <p className="text-sm text-gray-400">
                {filter === 'done' ? 'まだ達成したクエストがありません。' : '該当するクエストがありません。'}
              </p>
            )}
          </div>
        ) : (
        <div className="flex flex-col gap-3">
          {visibleChallenges.map((ch) => {
            const diff = difficultyLabel(ch.difficulty);
            const completed = progress.completed.includes(ch.id);
            const active = progress.activeId === ch.id; // 現在挑戦中
            const distToGoal = distanceKm(userLocation.lat, userLocation.lng, ch.goalLat, ch.goalLng);
            const distValue = distToGoal < 1 ? `${Math.round(distToGoal * 1000)}` : `${distToGoal.toFixed(1)}`;
            const distUnit = distToGoal < 1 ? 'm' : 'km';
            const levelOk = userLevel >= ch.minLevel; // 必須レベルを満たすか

            const total = ch.tasks.length;
            const doneN = (progress.done[ch.id] || []).length;
            // カードをタップするとモーダル（参加/終了ボタンはモーダル内）。
            return (
              <button
                key={ch.id}
                onClick={() => setConfirmCh(ch)}
                aria-label={`クエスト「${ch.title}」を開く`}
                className={`w-full text-left rounded-2xl overflow-hidden transition-all cursor-pointer active:scale-[0.99] ${
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
                    {(() => {
                      const godSpot = ch.spotId ? db.getSpot(ch.spotId) : null;
                      return godSpot?.godName ? (
                        <p className={`text-[11px] font-bold truncate mb-0.5 ${active ? 'text-white/70' : 'text-gray-400'}`}>{godSpot.godEmoji ? `${godSpot.godEmoji} ` : ''}by {godSpot.godName}</p>
                      ) : null;
                    })()}
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
                      <span className={`text-[13px] font-black flex items-center gap-0.5 ${active ? 'text-white' : 'text-shrine-red'}`}>
                        <MapPin className="w-3 h-3" />
                        <span className="tabular-nums">{distValue}</span>
                        <span className="text-[11px]">{distUnit}</span>
                      </span>
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
            );
          })}
          {visibleCount < nearChallenges.length && (
            <button
              onClick={() => setVisibleCount((c) => c + 5)}
              className="mx-auto mt-1 py-2 text-shrine-red text-sm font-black underline underline-offset-4 decoration-shrine-red/40 hover:decoration-shrine-red cursor-pointer"
            >
              もっと見る（残り{nearChallenges.length - visibleCount}件）
            </button>
          )}
        </div>
        )}
      </div>

      {/* チャレンジモーダル（参加 / 終了 ボタンはここに表示） */}
      {confirmCh && (() => {
        const isActive = progress.activeId === confirmCh.id;
        const ok = userLevel >= confirmCh.minLevel;
        return (
          <div className="fixed inset-0 z-[4000] bg-black/40 flex items-center justify-center p-6" onClick={() => setConfirmCh(null)}>
            <div className="w-full max-w-[320px] max-h-[85vh] overflow-y-auto bg-white rounded-3xl p-5 text-center animate-in" onClick={(e) => e.stopPropagation()}>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-amber-100 flex items-center justify-center text-4xl mx-auto mb-3">{confirmCh.badgeIcon}</div>
              <h3 className="text-lg font-black text-gray-900">{confirmCh.title}</h3>
              {(() => {
                const godName = confirmCh.spotId ? db.getSpot(confirmCh.spotId)?.godName : null;
                return godName ? <p className="text-[11px] font-bold text-gray-400 mt-0.5">by {godName}</p> : null;
              })()}
              <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">{confirmCh.description}</p>
              <div className="flex items-center justify-center gap-2 mt-3 text-[13px] text-gray-500">
                <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />約{confirmCh.estMinutes}分</span>
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
                        <span className="text-[11px] font-black text-amber-600 flex-shrink-0">+{t.reward}徳</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4">
                {isActive ? (
                  <button
                    onClick={() => { setConfirmCh(null); onEndChallenge?.(); }}
                    className="w-full bg-rose-600 text-white text-base font-black py-3 rounded-xl hover:opacity-90 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <X className="w-4 h-4" />チャレンジを終了する
                  </button>
                ) : ok ? (
                  <button
                    onClick={() => { const id = confirmCh.id; setConfirmCh(null); onStartChallenge(id); }}
                    className="w-full bg-shrine-red text-white text-base font-black py-3 rounded-xl hover:opacity-90 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Flag className="w-4 h-4" />このチャレンジに参加
                  </button>
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
