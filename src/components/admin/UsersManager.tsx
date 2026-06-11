'use client';

import React, { useState } from 'react';
import { db, Spot, User } from '../../lib/db';
import { getLevelInfo } from '../../data/levels';
import { getVisitRecords } from '../../lib/visit-records';
import { getGoShuinList } from '../../lib/goshuin';
import { Card, Field, inputCls, Toolbar, DeleteBtn, EditBtn, Modal, ModalActions } from './ui';

function emptyUser(): User {
  return {
    id: `user-${Date.now()}`, displayName: '', currentTitle: '見習い巡礼者', totalToku: 0,
    avatarUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=new',
  };
}

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** ユーザーの詳細（プロフィール・貢献統計・参拝記録・御朱印・最近の行動） */
function UserDetail({ user, spots, onClose }: { user: User; spots: Spot[]; onClose: () => void }) {
  const stats = db.getUserStats(user.id);
  const level = getLevelInfo(user.totalToku);
  const records = getVisitRecords(user.id);
  const goshuin = getGoShuinList(user.id);
  const activities = db.getActivities().filter((a) => a.userId === user.id).slice(0, 8);
  const creatorOf = spots.filter((s) => s.creatorId === user.id);
  const taskEntries = Object.entries(stats.taskCounts ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const items = stats.items ?? [];

  const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="bg-gray-50 rounded-xl px-3 py-2">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="text-sm font-black text-gray-900">{value}</p>
    </div>
  );

  return (
    <Modal title="人間の詳細" onClose={onClose}>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={user.avatarUrl} alt={user.displayName} className="w-12 h-12 rounded-full object-cover border-2" style={{ borderColor: user.avatarFrameColor || '#e5e7eb' }} />
        <div className="min-w-0">
          <p className="text-sm font-black text-gray-900 truncate">{user.displayName || '(無名)'}</p>
          <p className="text-[11px] text-gray-400">{user.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <Stat label="累積徳" value={`${user.totalToku.toLocaleString()}pt`} />
        <Stat label="レベル" value={`Lv.${level.current.level} ${level.current.title}`} />
        <Stat label="称号" value={user.currentTitle} />
        <Stat label="巡った場所" value={`${stats.visitedSpotIds.length}カ所`} />
        <Stat label="参拝記録" value={`${records.length}件`} />
        <Stat label="御朱印" value={`${goshuin.length}体`} />
        <Stat label="フォロワー" value={stats.followers ?? 0} />
        <Stat label="フォロー中" value={stats.following ?? 0} />
        <Stat label="創世主の場" value={`${creatorOf.length}件`} />
      </div>

      {taskEntries.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-black text-gray-500 mb-1">タスク達成の内訳</p>
          <div className="flex flex-wrap gap-1">
            {taskEntries.map(([type, count]) => (
              <span key={type} className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{type} ×{count}</span>
            ))}
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-black text-gray-500 mb-1">アイテム（{items.filter((i) => i.delivered).length}/{items.length} 配達済み）</p>
          <div className="flex flex-wrap gap-1">
            {items.slice(0, 10).map((i) => (
              <span key={i.id} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${i.delivered ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {i.icon} {i.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {records.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-black text-gray-500 mb-1">最近の参拝記録</p>
          <ul className="space-y-1">
            {[...records].slice(0, 5).map((r) => (
              <li key={r.id} className="text-[11px] text-gray-600 flex items-center gap-1.5">
                <span>{r.godEmoji}</span>
                <span className="font-bold truncate">{r.spotName}</span>
                <span className="text-gray-400 ml-auto shrink-0">{fmtDateTime(r.visitedAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activities.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-black text-gray-500 mb-1">最近の行動</p>
          <ul className="space-y-1">
            {activities.map((a) => (
              <li key={a.id} className="text-[11px] text-gray-600 flex items-center gap-1.5">
                <span className="font-bold bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{a.type}</span>
                <span className="truncate">{a.detail || a.spotId || ''}</span>
                <span className="text-gray-400 ml-auto shrink-0">{fmtDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

export function UsersManager({ users, spots, onChange }: { users: User[]; spots: Spot[]; onChange: () => void }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [viewing, setViewing] = useState<User | null>(null);
  const filtered = users.filter(u => u.displayName.includes(search) || u.currentTitle.includes(search));

  return (
    <div>
      <Toolbar onAdd={() => setEditing(emptyUser())} search={search} setSearch={setSearch} addLabel="人間を追加" />
      <div className="grid gap-2">
        {filtered.map(u => (
          <Card key={u.id}>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.avatarUrl} alt={u.displayName} className="w-10 h-10 rounded-full object-cover shrink-0 border-2" style={{ borderColor: u.avatarFrameColor || '#e5e7eb' }} />
              <button onClick={() => setViewing(u)} className="flex-1 min-w-0 text-left cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-gray-900 truncate">{u.displayName || '(無名)'}</span>
                  <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">{u.currentTitle}</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">徳 {u.totalToku}pt ・ 創世主 {spots.filter(s => s.creatorId === u.id).length}件 ・ {u.id}</p>
              </button>
              <div className="flex items-center shrink-0">
                <button onClick={() => setViewing(u)} className="text-[11px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-all cursor-pointer mr-1">詳細</button>
                <EditBtn onClick={() => setEditing(u)} />
                <DeleteBtn onClick={() => { if (confirm(`「${u.displayName}」を削除しますか？`)) { db.adminDeleteUser(u.id); onChange(); } }} />
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-xs text-gray-400 py-8">人間がいません。</p>}
      </div>

      {viewing && <UserDetail user={viewing} spots={spots} onClose={() => setViewing(null)} />}

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
