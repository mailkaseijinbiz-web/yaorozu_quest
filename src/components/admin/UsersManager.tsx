'use client';

import React, { useState } from 'react';
import { Eye, MapPin, Stamp, NotebookPen, Sparkles, Users as UsersGroup, Flag } from 'lucide-react';
import { db, Spot, User } from '../../lib/db';
import { getGoShuinList } from '../../lib/goshuin';
import { getVisitRecords } from '../../lib/visit-records';
import { getLevelInfo } from '../../data/levels';
import { Card, Field, inputCls, Toolbar, DeleteBtn, EditBtn, Modal, ModalActions } from './ui';

// デモ用に最初から入っているモックユーザー（実在しない賑やかし）。実ユーザー一覧では隠す。
export const DEMO_USER_IDS = new Set(['user-guide-1', 'user-history-geek']);

// 達成タスク種別の表示名（貢献内訳の見出し用）
const TASK_LABEL: Record<string, string> = {
  context: 'コンテキスト収集', photo: '写真奉納', evaluate: '写真評価', event: 'できごと報告',
  review: 'クチコミ', sns: 'SNS共有', buy: '買い物体験', eat: '食事体験',
  cleaning: '清掃奉仕', visit: '来訪', resolveIssue: '課題解決', judge: '評価',
};

function emptyUser(): User {
  return {
    id: `user-${Date.now()}`, displayName: '', currentTitle: '見習い巡礼者', totalToku: 0,
    avatarUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=new',
  };
}

// ── 統計タイル ──
function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col gap-1">
      <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1"><Icon className="w-3 h-3" />{label}</span>
      <span className="text-lg font-black text-gray-900 tabular-nums leading-none">{value}</span>
    </div>
  );
}

// ── ユーザー詳細 ──
function UserDetail({ user, spots, onClose }: { user: User; spots: Spot[]; onClose: () => void }) {
  const stats = db.getUserStats(user.id);
  const lv = getLevelInfo(user.totalToku);
  const createdSpots = spots.filter((s) => s.creatorId === user.id);
  const goshuin = getGoShuinList(user.id);
  const records = getVisitRecords(user.id);
  const activities = db.getActivities().filter((a) => a.userId === user.id).slice(0, 20);
  const taskEntries = Object.entries(stats.taskCounts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);

  return (
    <Modal title="人間の詳細" onClose={onClose}>
      {/* プロフィール */}
      <div className="flex items-center gap-3 mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={user.avatarUrl} alt={user.displayName} className="w-14 h-14 rounded-full object-cover border-2" style={{ borderColor: user.avatarFrameColor || '#e5e7eb' }} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-black text-gray-900 truncate">{user.displayName || '(無名)'}</h4>
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">{user.currentTitle}</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">{user.id}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            レベル <span className="font-black text-gray-800">{lv.current.level}</span>・{lv.current.title}
            {lv.next && <span className="text-gray-400">（次まで {lv.tokuToNext} 徳）</span>}
          </p>
        </div>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Stat icon={Sparkles} label="累積徳" value={`${user.totalToku}`} />
        <Stat icon={MapPin} label="訪問した場" value={stats.visitedSpotIds.length} />
        <Stat icon={Sparkles} label="創世した場" value={createdSpots.length} />
        <Stat icon={Stamp} label="御朱印" value={goshuin.length} />
        <Stat icon={NotebookPen} label="参拝記録" value={records.length} />
        <Stat icon={Flag} label="所持アイテム" value={stats.items.length} />
        <Stat icon={UsersGroup} label="フォロワー" value={stats.followers} />
        <Stat icon={UsersGroup} label="フォロー中" value={stats.following} />
      </div>

      {/* 貢献内訳（達成タスク） */}
      {taskEntries.length > 0 && (
        <section className="mb-4">
          <h5 className="text-[11px] font-black text-gray-500 mb-2">貢献の内訳</h5>
          <div className="flex flex-wrap gap-1.5">
            {taskEntries.map(([type, n]) => (
              <span key={type} className="text-[11px] font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                {TASK_LABEL[type] ?? type} <span className="font-black">{n}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 創世した場 */}
      {createdSpots.length > 0 && (
        <section className="mb-4">
          <h5 className="text-[11px] font-black text-gray-500 mb-2">創世した場（{createdSpots.length}）</h5>
          <div className="space-y-1">
            {createdSpots.slice(0, 10).map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-[12px] text-gray-700">
                <span>{s.godEmoji || (s.category === '神社' ? '⛩️' : '🙏')}</span>
                <span className="font-bold truncate">{s.name}</span>
                <span className="text-gray-400 ml-auto shrink-0">{db.getTokuAtSpot(user.id, s.id)}徳</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 最近のアクティビティ */}
      <section>
        <h5 className="text-[11px] font-black text-gray-500 mb-2">最近のアクティビティ</h5>
        {activities.length === 0 ? (
          <p className="text-[12px] text-gray-400">記録なし</p>
        ) : (
          <div className="space-y-1">
            {activities.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-[11px] text-gray-600">
                <span className="text-gray-400 tabular-nums shrink-0">
                  {new Date(a.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="font-bold text-gray-700">{a.type}</span>
                {a.detail && <span className="truncate text-gray-500">{a.detail}</span>}
                {a.reward != null && a.reward > 0 && <span className="ml-auto font-black text-amber-600 shrink-0">+{a.reward}徳</span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </Modal>
  );
}

export function UsersManager({ users, spots, onChange }: { users: User[]; spots: Spot[]; onChange: () => void }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [detail, setDetail] = useState<User | null>(null);
  const [showDemo, setShowDemo] = useState(false);

  // 実ユーザーのみ（デモ用モックは既定で隠す）。トグルで表示も可。
  const realUsers = users.filter((u) => showDemo || !DEMO_USER_IDS.has(u.id));
  const demoCount = users.filter((u) => DEMO_USER_IDS.has(u.id)).length;
  const filtered = realUsers.filter(u => u.displayName.includes(search) || u.currentTitle.includes(search));

  return (
    <div>
      <Toolbar onAdd={() => setEditing(emptyUser())} search={search} setSearch={setSearch} addLabel="人間を追加" />

      {demoCount > 0 && (
        <div className="flex items-center justify-between mb-3 text-[11px]">
          <span className="text-gray-400">実ユーザー {realUsers.length}人を表示中{!showDemo && demoCount > 0 ? `（デモ${demoCount}人を非表示）` : ''}</span>
          <button onClick={() => setShowDemo(v => !v)} className="font-black text-blue-600 hover:underline cursor-pointer">
            {showDemo ? 'デモを隠す' : 'デモも表示'}
          </button>
        </div>
      )}

      <div className="grid gap-2">
        {filtered.map(u => {
          const isDemo = DEMO_USER_IDS.has(u.id);
          return (
          <Card key={u.id}>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.avatarUrl} alt={u.displayName} className="w-10 h-10 rounded-full object-cover shrink-0 border-2" style={{ borderColor: u.avatarFrameColor || '#e5e7eb' }} />
              <button onClick={() => setDetail(u)} className="flex-1 min-w-0 text-left cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-gray-900 truncate">{u.displayName || '(無名)'}</span>
                  <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">{u.currentTitle}</span>
                  {isDemo && <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">デモ</span>}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">徳 {u.totalToku}pt ・ 創世主 {spots.filter(s => s.creatorId === u.id).length}件 ・ {u.id}</p>
              </button>
              <div className="flex items-center shrink-0">
                <button onClick={() => setDetail(u)} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer" title="詳細">
                  <Eye className="w-4 h-4" />
                </button>
                <EditBtn onClick={() => setEditing(u)} />
                <DeleteBtn onClick={() => { if (confirm(`「${u.displayName}」を削除しますか？`)) { db.adminDeleteUser(u.id); onChange(); } }} />
              </div>
            </div>
          </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-xs text-gray-400 py-8">人間がいません。</p>}
      </div>

      {detail && <UserDetail user={detail} spots={spots} onClose={() => setDetail(null)} />}

      {editing && (
        <Modal title={users.some(u => u.id === editing.id) ? '人間の編集' : '人間を追加'} onClose={() => setEditing(null)}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="表示名" full><input className={inputCls} value={editing.displayName} onChange={e => setEditing({ ...editing, displayName: e.target.value })} /></Field>
            <Field label="称号"><input className={inputCls} value={editing.currentTitle} onChange={e => setEditing({ ...editing, currentTitle: e.target.value })} /></Field>
            <Field label="累積徳ポイント"><input type="number" className={inputCls} value={editing.totalToku} onChange={e => setEditing({ ...editing, totalToku: Number(e.target.value) })} /></Field>
            <Field label="アバターURL" full><input className={inputCls} value={editing.avatarUrl} onChange={e => setEditing({ ...editing, avatarUrl: e.target.value })} /></Field>
            <Field label="フレーム色 (任意 hex)"><input className={inputCls} value={editing.avatarFrameColor || ''} onChange={e => setEditing({ ...editing, avatarFrameColor: e.target.value || undefined })} placeholder="#c5a028" /></Field>
          </div>
          <ModalActions
            onCancel={() => setEditing(null)}
            onSave={() => {
              if (!editing.displayName.trim()) { alert('表示名は必須です。'); return; }
              db.adminSaveUser(editing); onChange(); setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
