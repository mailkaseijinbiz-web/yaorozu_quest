'use client';

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Card, Field, inputCls, PER_PAGE, Pager, Toolbar, DeleteBtn, EditBtn, Modal, ModalActions } from './ui';
import { db, Spot } from '../../lib/db';
import { TASK_CATALOG, COMMON_TASK_TYPES, resolveTaskTypes, GodTaskType } from '../../data/god-tasks';

// ════════════════════════════════════════════════
// Spots Manager
// ════════════════════════════════════════════════
function emptySpot(): Spot {
  return {
    id: `spot-${Date.now()}`, name: '', description: '', latitude: 35.68, longitude: 139.75,
    creatorId: null, imageUrl: '', category: '神社', tokuRequirement: 100, enjoyments: [],
    difficulty: 1, terrain: 1, attributes: [], cacheType: 'Virtual',
    godName: '', godEmoji: '⛩️', godRequests: [],
  };
}

export function SpotsManager({ spots, onChange }: { spots: Spot[]; onChange: () => void }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Spot | null>(null);
  const [page, setPage] = useState(0);

  const filtered = spots.filter(s => s.name.includes(search) || s.category.includes(search));
  const pageItems = filtered.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  return (
    <div>
      <Toolbar onAdd={() => setEditing(emptySpot())} search={search} setSearch={(v) => { setSearch(v); setPage(0); }} addLabel="スポット追加" />
      <p className="text-[11px] text-gray-400 mb-2">全 {filtered.length} 件</p>
      <div className="grid gap-2">
        {pageItems.map(s => (
          <Card key={s.id}>
            <div className="flex items-center gap-3">
              {s.imageUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={s.imageUrl} alt={s.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                : <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><MapPin className="w-5 h-5 text-gray-400" /></div>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-gray-900 truncate">{s.name || '(無題)'}</span>
                  <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full shrink-0">{s.category}</span>
                </div>
                <p className="text-[11px] text-gray-500 truncate">{s.description}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">徳要件 {s.tokuRequirement} ・ D{s.difficulty}/T{s.terrain} ・ {s.latitude.toFixed(3)}, {s.longitude.toFixed(3)}</p>
              </div>
              <div className="flex items-center shrink-0">
                <EditBtn onClick={() => setEditing(s)} />
                <DeleteBtn onClick={() => { if (confirm(`「${s.name}」を削除しますか？（関連UGC・神様AIも削除されます）`)) { db.adminDeleteSpot(s.id); onChange(); } }} />
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-xs text-gray-400 py-8">スポットがありません。</p>}
      </div>
      <Pager page={page} total={filtered.length} onPage={setPage} />

      {editing && (
        <Modal title={spots.some(s => s.id === editing.id) ? 'スポット編集' : 'スポット追加'} onClose={() => setEditing(null)}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="名称" full><input className={inputCls} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="説明" full><textarea className={inputCls} rows={2} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} /></Field>
            <Field label="カテゴリ"><input className={inputCls} value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} /></Field>
            <Field label="画像URL"><input className={inputCls} value={editing.imageUrl} onChange={e => setEditing({ ...editing, imageUrl: e.target.value })} /></Field>
            <Field label="緯度"><input type="number" step="0.0001" className={inputCls} value={editing.latitude} onChange={e => setEditing({ ...editing, latitude: Number(e.target.value) })} /></Field>
            <Field label="経度"><input type="number" step="0.0001" className={inputCls} value={editing.longitude} onChange={e => setEditing({ ...editing, longitude: Number(e.target.value) })} /></Field>
            <Field label="徳要件"><input type="number" className={inputCls} value={editing.tokuRequirement} onChange={e => setEditing({ ...editing, tokuRequirement: Number(e.target.value) })} /></Field>
            <Field label="キャッシュ種別"><input className={inputCls} value={editing.cacheType} onChange={e => setEditing({ ...editing, cacheType: e.target.value })} /></Field>
            <Field label="難易度 (1-5)"><input type="number" min={1} max={5} className={inputCls} value={editing.difficulty} onChange={e => setEditing({ ...editing, difficulty: Number(e.target.value) })} /></Field>
            <Field label="地形 (1-5)"><input type="number" min={1} max={5} className={inputCls} value={editing.terrain} onChange={e => setEditing({ ...editing, terrain: Number(e.target.value) })} /></Field>
            <Field label="楽しみ方（カンマ区切り）" full><input className={inputCls} value={editing.enjoyments.join(', ')} onChange={e => setEditing({ ...editing, enjoyments: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })} /></Field>
            <Field label="属性（カンマ区切り）" full><input className={inputCls} value={editing.attributes.join(', ')} onChange={e => setEditing({ ...editing, attributes: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })} /></Field>

            {/* 神が依頼できるタスク種別 */}
            <Field label="神のタスク（依頼できる種別）" full>
              {(() => {
                // 未設定ならカテゴリ標準を初期表示。選択を変えた時点で taskTypes に確定する。
                const current: GodTaskType[] = (editing.taskTypes && editing.taskTypes.length > 0)
                  ? (editing.taskTypes.filter((t): t is GodTaskType => t in TASK_CATALOG))
                  : resolveTaskTypes(editing);
                const isDefault = !editing.taskTypes || editing.taskTypes.length === 0;
                const toggle = (type: GodTaskType) => {
                  const set = new Set(current);
                  if (set.has(type)) set.delete(type); else set.add(type);
                  setEditing({ ...editing, taskTypes: Array.from(set) });
                };
                return (
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(TASK_CATALOG) as GodTaskType[]).map((type) => {
                        const t = TASK_CATALOG[type];
                        const on = current.includes(type);
                        const common = COMMON_TASK_TYPES.includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => toggle(type)}
                            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                              on
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                            }`}
                            title={t.title}
                          >
                            {t.icon} {t.label}{common ? '' : ' ★'}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      {isDefault
                        ? 'カテゴリ標準を表示中（クリックで上書き設定）。★はカテゴリ別タスク。'
                        : `このスポット専用に ${current.length} 種を設定中。`}
                    </p>
                  </div>
                );
              })()}
            </Field>
          </div>
          <ModalActions
            onCancel={() => setEditing(null)}
            onSave={() => {
              if (!editing.name.trim()) { alert('名称は必須です。'); return; }
              db.adminSaveSpot(editing); onChange(); setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
