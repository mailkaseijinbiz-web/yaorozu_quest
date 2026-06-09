'use client';

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Card, Field, inputCls, PER_PAGE, Pager, Toolbar, DeleteBtn, EditBtn, Modal, ModalActions } from './ui';
import { RulesPanel } from './RulesPanel';
import { db, Spot, spotVitality, DEFAULT_SPOT_RULES } from '../../lib/db';

// ════════════════════════════════════════════════
// Spots Manager
// ════════════════════════════════════════════════
function emptySpot(): Spot {
  return {
    id: `spot-${Date.now()}`, name: '', description: '', latitude: 35.68, longitude: 139.75,
    creatorId: null, imageUrl: '', category: '神社', tokuRequirement: 100, enjoyments: [],
    difficulty: 1, terrain: 1, attributes: [], cacheType: 'Virtual',
    godName: '', godEmoji: '⛩️', godRequests: [], issues: [],
  };
}

// 生成/削除日時の表示（ja-JP）
function fmtDt(iso?: string): string {
  return iso ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

export function SpotsManager({ spots, onChange }: { spots: Spot[]; onChange: () => void }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Spot | null>(null);
  const [page, setPage] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false); // 削除済み（ゴミ箱）を表示

  // 場の生成ルール（八百万神の「神の生成ルール」と同様にインライン編集）
  const [spotRules, setSpotRules] = useState(() => db.getSpotRules());
  const [spotRulesSaved, setSpotRulesSaved] = useState(false);

  // spots は生存のみ。トグル時は削除済みを末尾に連結。
  const base = showDeleted ? [...spots, ...db.getDeletedSpots()] : spots;
  const filtered = base.filter(s => s.name.includes(search) || s.category.includes(search));
  const pageItems = filtered.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  return (
    <div>
      {/* 場の生成ルール — 八百万神（神の生成ルール）と同じ構成のインライン編集 */}
      <div className="mb-3">
        <RulesPanel
          title="場の生成ルール（生成方針）"
          description={<>場（Spot）がどう創造され、どんな価値[]・課題[]を持つかの方針。ここに書いたルールに基づき、場と その価値・課題が生成・更新されます。生成AIでの一括更新は「God」タブの Update から。</>}
          value={spotRules}
          onChange={(v) => { setSpotRules(v); setSpotRulesSaved(false); }}
          onSave={() => { db.saveSpotRules(spotRules); setSpotRulesSaved(true); }}
          onReset={() => { setSpotRules(DEFAULT_SPOT_RULES); setSpotRulesSaved(false); }}
          saved={spotRulesSaved}
        />
      </div>

      <Toolbar search={search} setSearch={(v) => { setSearch(v); setPage(0); }} />
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] text-gray-400">全 {filtered.length} 件</p>
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 cursor-pointer">
          <input type="checkbox" checked={showDeleted} onChange={(e) => { setShowDeleted(e.target.checked); setPage(0); }} className="cursor-pointer" />
          🗑️ 削除済みも表示
        </label>
      </div>
      <div className="grid gap-2">
        {pageItems.map(s => (
          <Card key={s.id}>
            <div className={`flex items-start gap-3 ${s.deletedAt ? 'opacity-60' : ''}`}>
              {s.imageUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={s.imageUrl} alt={s.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                : <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><MapPin className="w-5 h-5 text-gray-400" /></div>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-gray-900 truncate">{s.name || '(無題)'}</span>
                  <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full shrink-0">{s.category}</span>
                  {s.deletedAt && (
                    <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full shrink-0">🗑️ 削除 {fmtDt(s.deletedAt)}</span>
                  )}
                  {(() => {
                    const v = spotVitality(s);
                    return (
                      <span
                        title="活気 = 価値 − 課題"
                        className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${v > 0 ? 'bg-emerald-100 text-emerald-700' : v < 0 ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        活気 {v > 0 ? '+' : ''}{v}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-[11px] text-gray-500 truncate">{s.description}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">📍 {s.latitude.toFixed(3)}, {s.longitude.toFixed(3)} ・ 生成 {fmtDt(s.createdAt)}</p>
                {/* 価値・課題を一覧でも確認できるように表示 */}
                {((s.enjoyments?.length ?? 0) > 0 || (s.issues?.length ?? 0) > 0) && (
                  <div className="mt-1.5 flex flex-col gap-1">
                    {s.enjoyments && s.enjoyments.length > 0 && (
                      <div className="flex items-start gap-1 flex-wrap">
                        <span className="text-[9px] font-black text-emerald-600 shrink-0 mt-[2px]">価値</span>
                        {s.enjoyments.map((v, i) => (
                          <span key={i} className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full">{v}</span>
                        ))}
                      </div>
                    )}
                    {s.issues && s.issues.length > 0 && (
                      <div className="flex items-start gap-1 flex-wrap">
                        <span className="text-[9px] font-black text-rose-600 shrink-0 mt-[2px]">課題</span>
                        {s.issues.map((v, i) => (
                          <span key={i} className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 px-1.5 py-0.5 rounded-full">{v}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {!s.deletedAt && (
                <div className="flex items-center shrink-0">
                  <EditBtn onClick={() => setEditing(s)} />
                  <DeleteBtn onClick={() => { if (confirm(`「${s.name}」を削除しますか？（関連UGC・神様AIも削除されます）`)) { db.adminDeleteSpot(s.id); onChange(); } }} />
                </div>
              )}
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-xs text-gray-400 py-8">場がありません。</p>}
      </div>
      <Pager page={page} total={filtered.length} onPage={setPage} />

      {editing && (
        <Modal title={spots.some(s => s.id === editing.id) ? '場の編集' : '場を追加'} onClose={() => setEditing(null)}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="名称" full><input className={inputCls} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="説明" full><textarea className={inputCls} rows={2} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} /></Field>
            <Field label="カテゴリ"><input className={inputCls} value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} /></Field>
            <Field label="画像URL"><input className={inputCls} value={editing.imageUrl} onChange={e => setEditing({ ...editing, imageUrl: e.target.value })} /></Field>
            <Field label="緯度"><input type="number" step="0.0001" className={inputCls} value={editing.latitude} onChange={e => setEditing({ ...editing, latitude: Number(e.target.value) })} /></Field>
            <Field label="経度"><input type="number" step="0.0001" className={inputCls} value={editing.longitude} onChange={e => setEditing({ ...editing, longitude: Number(e.target.value) })} /></Field>
            <Field label="価値（カンマ区切り）— この場の魅力・楽しみ方" full><input className={inputCls} value={editing.enjoyments.join(', ')} onChange={e => setEditing({ ...editing, enjoyments: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })} /></Field>
            <Field label="課題（カンマ区切り）— この場が解決すべき課題" full><input className={inputCls} value={(editing.issues ?? []).join(', ')} onChange={e => setEditing({ ...editing, issues: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })} /></Field>

            {/* 八百万の神：ここでは参照（ポインター）のみ。神の情報は「八百万神」タブで編集する */}
            <Field label="八百万の神（参照のみ — 編集は「八百万神」タブ）" full>
              {(() => {
                const ag = db.getAgentBySpot(editing.id);
                const tone = ag?.voiceTone ?? '神秘的';
                const brainCustom = !!(ag && ag.systemPrompt.trim());
                const knowledgeCustom = !!(ag && (ag.identityMd || ag.soulMd));
                return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
                    <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold">
                      <span className="text-base leading-none">{editing.godEmoji || '⛩️'}</span>
                      <span className="text-[12px] font-black text-amber-800">{editing.godName || `${editing.name || 'この場'}の守り神`}</span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">口調 {tone}</span>
                      <span className={`px-1.5 py-0.5 rounded ${brainCustom ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>頭脳 {brainCustom ? 'カスタム' : '既定'}</span>
                      <span className={`px-1.5 py-0.5 rounded ${knowledgeCustom ? 'bg-violet-50 text-violet-600' : 'bg-gray-100 text-gray-400'}`}>知識 {knowledgeCustom ? '編集済' : '自動'}</span>
                    </div>
                    <p className="text-[10px] text-amber-700/80 mt-1">神名・化身・口調・人格・頭脳・Identity.md / Soul.md は「八百万神」タブで編集します。</p>
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
