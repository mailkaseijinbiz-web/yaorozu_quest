'use client';

import React, { useState } from 'react';
import { db, Spot, User } from '../../lib/db';
import { Card, Field, inputCls, Toolbar, DeleteBtn, EditBtn, Modal, ModalActions } from './ui';

function emptyUser(): User {
  return {
    id: `user-${Date.now()}`, displayName: '', currentTitle: '見習い巡礼者', totalToku: 0,
    avatarUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=new',
  };
}

export function UsersManager({ users, spots, onChange }: { users: User[]; spots: Spot[]; onChange: () => void }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const filtered = users.filter(u => u.displayName.includes(search) || u.currentTitle.includes(search));

  return (
    <div>
      <Toolbar onAdd={() => setEditing(emptyUser())} search={search} setSearch={setSearch} addLabel="ユーザー追加" />
      <div className="grid gap-2">
        {filtered.map(u => (
          <Card key={u.id}>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.avatarUrl} alt={u.displayName} className="w-10 h-10 rounded-full object-cover shrink-0 border-2" style={{ borderColor: u.avatarFrameColor || '#e5e7eb' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-gray-900 truncate">{u.displayName || '(無名)'}</span>
                  <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">{u.currentTitle}</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">徳 {u.totalToku}pt ・ 創世主 {spots.filter(s => s.creatorId === u.id).length}件 ・ {u.id}</p>
              </div>
              <div className="flex items-center shrink-0">
                <EditBtn onClick={() => setEditing(u)} />
                <DeleteBtn onClick={() => { if (confirm(`「${u.displayName}」を削除しますか？`)) { db.adminDeleteUser(u.id); onChange(); } }} />
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-xs text-gray-400 py-8">ユーザーがいません。</p>}
      </div>

      {editing && (
        <Modal title={users.some(u => u.id === editing.id) ? 'ユーザー編集' : 'ユーザー追加'} onClose={() => setEditing(null)}>
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
