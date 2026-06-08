'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Trophy, Flag, Clock, X, Check } from 'lucide-react';
import { User, db } from '../lib/db';
import { CHALLENGES, difficultyLabel, Challenge } from '../data/challenges';
import { getLevelInfo } from '../data/levels';
import { formatDistanceParts } from '../lib/format';

interface HomeTabProps {
  currentUser: User;
  userLocation: { lat: number; lng: number };
  onStartChallenge: (challengeId: string) => void;
  onEndChallenge?: () => void;
  onChanged?: () => void;
}

function distKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function HomeTab({ currentUser, userLocation, onStartChallenge, onEndChallenge }: HomeTabProps) {
  // localStorage 依存のため、マウント後にのみ動的レンダリング（ハイドレーション不一致回避）
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // フィルタ：すべて / 未達成のみ / 達成したもの / 参加できるもの
  const [filter, setFilter] = useState<'all' | 'todo' | 'done' | 'joinable'>('todo');
  const [confirmCh, setConfirmCh] = useState<Challenge | null>(null); // 参加確認モーダル

  const progress = db.getChallengeProgress();
  const userLevel = getLevelInfo(currentUser.totalToku).current.level;

  // フィルタごとの件数
  const FILTERS = [
    { key: 'todo', label: '未達成', n: null },
    { key: 'done', label: '達成', n: progress.completed.length },
  ] as const;

  // フィルタ → 第1ソート＝参加できるもの、第2ソート＝距離の近い順
  const nearChallenges = [...CHALLENGES]
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
      d: distKm(userLocation.lat, userLocation.lng, ch.goalLat, ch.goalLng),
      ok: userLevel >= ch.minLevel,
    }))
    .sort((a, b) => {
      if (a.ok !== b.ok) return a.ok ? -1 : 1;
      return a.d - b.d;
    })
    .slice(0, 20)
    .map((x) => x.ch);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#f5f7fa]">
      {/* ── ブランドヘッダー ── */}
      <div className="px-5 pt-8 pb-4 flex flex-col items-center text-center">
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
              {f.label}{f.n != null && <span className={filter === f.key ? 'text-white/80' : 'text-gray-400'}> {f.n}</span>}
            </button>
          ))}
        </div>

        {!mounted ? (
          <div className="text-center py-10 text-xs text-gray-400">読み込み中…</div>
        ) : nearChallenges.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">
            {filter === 'done' ? 'まだ達成したクエストがありません。' : '該当するクエストがありません。'}
          </div>
        ) : (
        <div className="flex flex-col gap-3">
          {nearChallenges.map((ch) => {
            const diff = difficultyLabel(ch.difficulty);
            const completed = progress.completed.includes(ch.id);
            const active = progress.activeId === ch.id; // 現在挑戦中
            const distToGoal = distKm(userLocation.lat, userLocation.lng, ch.goalLat, ch.goalLng);
            const { value: distValue, unit: distUnit } = formatDistanceParts(distToGoal);
            const levelOk = userLevel >= ch.minLevel; // 必須レベルを満たすか

            const total = ch.steps.length;
            const doneN = (progress.done[ch.id] || []).length;
            // カードをタップするとモーダル（参加/終了ボタンはモーダル内）。
            return (
              <button
                key={ch.id}
                onClick={() => setConfirmCh(ch)}
                className={`w-full text-left rounded-2xl border p-3.5 transition-all cursor-pointer active:scale-[0.99] ${
                  active
                    ? 'bg-[#2563eb] border-[#2563eb] shadow-md'
                    : completed
                    ? 'bg-gold/10 border-gold shadow-sm'
                    : !levelOk
                    ? 'bg-gray-100 border-gray-200 opacity-60'
                    : 'bg-white border-black/5 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-3xl flex-shrink-0 ${active ? 'bg-white/20' : completed ? 'bg-gold/20' : !levelOk ? 'bg-gray-200 grayscale' : 'bg-gradient-to-br from-blue-100 to-amber-100'}`}>
                    {!levelOk && !active && !completed ? '🔒' : ch.badgeIcon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {active && <span className="text-[13px] font-black bg-white/25 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">挑戦中</span>}
                      {completed && !active && <span className="text-[11px] font-black bg-gold text-white px-1.5 py-0.5 rounded-full flex-shrink-0 flex items-center gap-0.5"><Check className="w-3 h-3" />達成済み</span>}
                      <h3 className={`text-base font-black truncate ${active ? 'text-white' : 'text-gray-900'}`}>{ch.title}</h3>
                    </div>
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
                      {ch.steps.map((_, i) => (
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
                  {completed && <Trophy className={`w-6 h-6 flex-shrink-0 ${active ? 'text-white' : 'text-gold'}`} />}
                </div>
              </button>
            );
          })}
        </div>
        )}
      </div>

      {/* チャレンジモーダル（参加 / 終了 ボタンはここに表示） */}
      {confirmCh && (() => {
        const isActive = progress.activeId === confirmCh.id;
        const ok = userLevel >= confirmCh.minLevel;
        return (
          <div className="fixed inset-0 z-[4000] bg-black/40 flex items-center justify-center p-6" onClick={() => setConfirmCh(null)}>
            <div className="w-full max-w-[320px] bg-white rounded-3xl p-5 text-center animate-in" onClick={(e) => e.stopPropagation()}>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-amber-100 flex items-center justify-center text-4xl mx-auto mb-3">{confirmCh.badgeIcon}</div>
              <h3 className="text-lg font-black text-gray-900">{confirmCh.title}</h3>
              <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">{confirmCh.description}</p>
              <div className="flex items-center justify-center gap-2 mt-3 text-[13px] text-gray-500">
                <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />約{confirmCh.estMinutes}分</span>
                <span>・</span>
                <span>🏆 {confirmCh.badgeName}</span>
              </div>

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
