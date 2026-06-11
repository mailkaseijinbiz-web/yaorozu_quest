'use client';

import { useState, useEffect } from 'react';
import { db, Spot, Activity, ActivityType, ActivitySource } from '../../lib/db';
import { CHALLENGES } from '../../data/challenges';
import { getVisitRecords, recordPhotos, VisitRecord } from '../../lib/visit-records';
import { PER_PAGE, Pager } from './ui';

// アクティビティ＝巡礼者の行動ログ（クエストに参加・場所に行く・依頼達成 等を時系列で保持）

const META: Record<ActivityType, { icon: string; label: string; color: string }> = {
  quest_join: { icon: '🚩', label: 'クエストに参加', color: 'text-blue-600' },
  quest_step: { icon: '✅', label: 'クエストのステップ達成', color: 'text-emerald-600' },
  quest_complete: { icon: '🏆', label: 'クエストを制覇', color: 'text-amber-600' },
  visit: { icon: '📍', label: '場所を訪問', color: 'text-rose-600' },
  task: { icon: '⭐', label: 'クエストを達成', color: 'text-indigo-600' },
  photo: { icon: '📸', label: '写真を奉納', color: 'text-pink-600' },
  ugc: { icon: '💬', label: '口コミを投稿', color: 'text-violet-600' },
  home_view:     { icon: '🏠', label: 'ホームタブを表示', color: 'text-slate-600' },
  map_move:      { icon: '🗺️', label: '地図を移動', color: 'text-teal-600' },
  spot_generate: { icon: '✨', label: '場を生成', color: 'text-purple-600' },
  god_generate:  { icon: '🪷', label: '神を生成', color: 'text-fuchsia-600' },
  spot_delete:   { icon: '🗑️', label: '場を削除', color: 'text-rose-600' },
};

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'たった今';
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

// 巡礼者の投稿（記録）も同じタイムラインに統合して表示する
type Row =
  | { kind: 'act'; t: number; a: Activity }
  | { kind: 'rec'; t: number; r: VisitRecord };

export function ActivityManager({ spots }: { spots: Spot[] }) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<'all' | 'quest' | 'visit' | 'post'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | ActivitySource>('all');
  const [all, setAll] = useState<Activity[]>(() => db.getActivities());
  const [records, setRecords] = useState<VisitRecord[]>(() => getVisitRecords('user-self'));

  // リアルタイム同期：同タブ（カスタムイベント）＋別タブ（storage イベント）
  useEffect(() => {
    const refresh = () => { setAll(db.getActivities()); setRecords(getVisitRecords('user-self')); };
    window.addEventListener('yaorozu:activity', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('yaorozu:activity', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const challengeTitle = (id?: string) => (id ? (CHALLENGES.find((c) => c.id === id)?.title ?? id) : '');
  const spotName = (id?: string) => (id ? (spots.find((s) => s.id === id)?.name ?? id) : '');

  // アクティビティ＋投稿を時系列にマージしてフィルタ
  const rows: Row[] = [
    ...all.map((a): Row => ({ kind: 'act', t: new Date(a.createdAt).getTime(), a })),
    ...records.map((r): Row => ({ kind: 'rec', t: new Date(r.createdAt || r.visitedAt).getTime(), r })),
  ].sort((x, y) => y.t - x.t);

  const filtered = rows.filter((row) => {
    if (row.kind === 'rec') {
      // 投稿（記録）は人間の行動。'system' 絞り込み時は除外
      return (filter === 'all' || filter === 'post') && sourceFilter !== 'system';
    }
    const a = row.a;
    const typeOk = filter === 'all' ? true : filter === 'quest' ? a.type.startsWith('quest') : filter === 'visit' ? a.type === 'visit' : false;
    const srcOk = sourceFilter === 'all' ? true : (a.source ?? 'human') === sourceFilter;
    return typeOk && srcOk;
  });
  const pageItems = filtered.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  const FILTERS = [
    { k: 'all', label: 'すべて' },
    { k: 'quest', label: 'クエスト' },
    { k: 'visit', label: '訪問' },
    { k: 'post', label: '投稿' },
  ] as const;

  const SOURCE_FILTERS: { k: 'all' | ActivitySource; label: string; icon: string }[] = [
    { k: 'all',    label: 'すべて',   icon: '📋' },
    { k: 'human',  label: '人間',     icon: '👤' },
    { k: 'system', label: 'システム', icon: '🤖' },
  ];

  return (
    <div>
      <p className="text-[12px] text-gray-500 mb-2">巡礼者の行動ログ — <b>クエストに参加</b>・<b>場所に行く</b>・依頼達成などを時系列で保持する。</p>
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.k}
            onClick={() => { setFilter(f.k); setPage(0); }}
            className={`text-[12px] font-black px-3 py-1.5 rounded-full border transition-all cursor-pointer ${filter === f.k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-400'}`}
          >
            {f.label}
          </button>
        ))}
        <span className="w-px h-4 bg-gray-200 mx-1" />
        {SOURCE_FILTERS.map((f) => (
          <button
            key={f.k}
            onClick={() => { setSourceFilter(f.k); setPage(0); }}
            className={`text-[12px] font-black px-3 py-1.5 rounded-full border transition-all cursor-pointer flex items-center gap-1 ${sourceFilter === f.k ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200 hover:border-violet-400'}`}
          >
            {f.icon} {f.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-gray-400">全 {filtered.length} 件</span>
      </div>

      {pageItems.length === 0 ? (
        <p className="text-center text-xs text-gray-400 py-10">まだアクティビティがありません。<br />アプリでクエストに参加したり、場所を訪れたり、記録を投稿すると残ります。</p>
      ) : (
        <div className="relative pl-4">
          <div className="absolute left-1.5 top-1 bottom-1 w-px bg-gray-200" />
          <div className="space-y-2">
            {pageItems.map((row) => {
              // ── 投稿（記録）：写真サムネイル付きで表示 ──
              if (row.kind === 'rec') {
                const r = row.r;
                const pics = recordPhotos(r);
                return (
                  <div key={`rec-${r.id}`} className="relative bg-white rounded-xl border border-gray-100 shadow-sm p-2.5 pl-3">
                    <div className="absolute -left-[14px] top-3 w-3 h-3 rounded-full bg-white border-2 border-pink-400" />
                    <div className="flex items-center gap-2">
                      <span className="text-lg shrink-0">📝</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-black text-gray-800 truncate"><span className="text-pink-600">記録を投稿</span><span className="text-gray-700"> 「{r.spotName}」</span></p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[10px] text-gray-400">{timeAgo(r.createdAt || r.visitedAt)}{pics.length ? ` ・ 写真${pics.length}枚` : ''}</p>
                          <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">👤 人間</span>
                        </div>
                      </div>
                    </div>
                    {r.note && <p className="text-[11px] text-gray-600 mt-1.5 line-clamp-2">{r.note}</p>}
                    {pics.length > 0 && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {pics.slice(0, 8).map((p, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={p} alt={`${r.spotName}の写真${i + 1}`} className="w-12 h-12 rounded-lg object-cover border border-gray-100" />
                        ))}
                        {pics.length > 8 && <span className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-[11px] font-black text-gray-500">+{pics.length - 8}</span>}
                      </div>
                    )}
                  </div>
                );
              }
              // ── 通常のアクティビティ ──
              const a = row.a;
              const m = META[a.type];
              const target = a.challengeId ? `「${challengeTitle(a.challengeId)}」` : a.spotId ? `「${spotName(a.spotId)}」` : '';
              return (
                <div key={a.id} className="relative bg-white rounded-xl border border-gray-100 shadow-sm p-2.5 pl-3">
                  <div className="absolute -left-[14px] top-3 w-3 h-3 rounded-full bg-white border-2 border-blue-400" />
                  <div className="flex items-center gap-2">
                    <span className="text-lg shrink-0">{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black text-gray-800 truncate"><span className={m.color}>{m.label}</span>{target && <span className="text-gray-700"> {target}</span>}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[10px] text-gray-400">{timeAgo(a.createdAt)}{a.detail && a.type === 'task' ? ` ・ ${a.detail}` : ''}</p>
                        {(a.source ?? 'human') === 'system'
                          ? <span className="text-[9px] font-black bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full">🤖 システム</span>
                          : <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">👤 人間</span>
                        }
                      </div>
                    </div>
                    {a.reward != null && <span className="text-[11px] font-black text-amber-600 shrink-0">+{a.reward}徳</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <Pager page={page} total={filtered.length} onPage={setPage} />
    </div>
  );
}
