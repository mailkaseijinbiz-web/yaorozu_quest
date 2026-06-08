'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Card, Field, inputCls, Toolbar, DeleteBtn, EditBtn, Modal, ModalActions } from './ui';
import { db, Spot, Agent } from '../../lib/db';

const VOICE_TONES: Agent['voiceTone'][] = ['厳格', '親しみやすい', '神秘的', '高飛車', '賢者'];

function emptyAgent(spotId: string): Agent {
  return {
    id: `agent-${Date.now()}`, spotId, name: '', personaDescription: '', systemPrompt: '',
    avatar3dUrl: '', haloColor: '#c5a028', accessoryType: 'なし', voiceTone: '親しみやすい',
  };
}

export function AgentsManager({ agents, spots, onChange }: { agents: Agent[]; spots: Spot[]; onChange: () => void }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Agent | null>(null);
  const spotName = (id: string) => spots.find(s => s.id === id)?.name || '(未割当)';
  const filtered = agents.filter(a => a.name.includes(search) || spotName(a.spotId).includes(search));

  return (
    <div>
      <Toolbar onAdd={() => setEditing(emptyAgent(spots[0]?.id || ''))} search={search} setSearch={setSearch} addLabel="神様AI追加" />
      <div className="grid gap-2">
        {filtered.map(a => (
          <Card key={a.id}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center" style={{ background: `${a.haloColor}22`, border: `2px solid ${a.haloColor}` }}>
                <Sparkles className="w-4 h-4" style={{ color: a.haloColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-gray-900 truncate">{a.name || '(無名の神)'}</span>
                  <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{spotName(a.spotId)}</span>
                  <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{a.voiceTone}</span>
                </div>
                <p className="text-[11px] text-gray-500 truncate mt-0.5">{a.personaDescription}</p>
              </div>
              <div className="flex items-center shrink-0">
                <EditBtn onClick={() => setEditing(a)} />
                <DeleteBtn onClick={() => { if (confirm(`「${a.name}」を削除しますか？`)) { db.adminDeleteAgent(a.id); onChange(); } }} />
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-xs text-gray-400 py-8">神様AIがいません。</p>}
      </div>

      {editing && (
        <Modal title={agents.some(a => a.id === editing.id) ? '神様AI編集' : '神様AI追加'} onClose={() => setEditing(null)}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="名前" full><input className={inputCls} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="担当スポット">
              <select className={inputCls} value={editing.spotId} onChange={e => setEditing({ ...editing, spotId: e.target.value })}>
                <option value="">（未割当）</option>
                {spots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="声のトーン">
              <select className={inputCls} value={editing.voiceTone} onChange={e => setEditing({ ...editing, voiceTone: e.target.value as Agent['voiceTone'] })}>
                {VOICE_TONES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="装飾品"><input className={inputCls} value={editing.accessoryType} onChange={e => setEditing({ ...editing, accessoryType: e.target.value })} placeholder="鏡 / 剣 / 扇子 / なし" /></Field>
            <Field label="光輪の色 (hex)"><input className={inputCls} value={editing.haloColor} onChange={e => setEditing({ ...editing, haloColor: e.target.value })} /></Field>
            <Field label="3DモデルURL" full><input className={inputCls} value={editing.avatar3dUrl} onChange={e => setEditing({ ...editing, avatar3dUrl: e.target.value })} /></Field>
            <Field label="ペルソナ説明" full><textarea className={inputCls} rows={2} value={editing.personaDescription} onChange={e => setEditing({ ...editing, personaDescription: e.target.value })} /></Field>
            <Field label="システムプロンプト" full><textarea className={inputCls} rows={4} value={editing.systemPrompt} onChange={e => setEditing({ ...editing, systemPrompt: e.target.value })} /></Field>
          </div>
          <ModalActions
            onCancel={() => setEditing(null)}
            onSave={() => {
              if (!editing.name.trim()) { alert('名前は必須です。'); return; }
              db.adminSaveAgent(editing); onChange(); setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
