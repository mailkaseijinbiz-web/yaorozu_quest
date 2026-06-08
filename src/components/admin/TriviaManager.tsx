'use client';

import { useState } from 'react';
import { db, TriviaEntry } from '../../lib/db';
import { Card, Field, inputCls, PER_PAGE, Pager, Toolbar, DeleteBtn, EditBtn, Modal, ModalActions } from './ui';

// ════════════════════════════════════════════════
// Trivia (蘊蓄) Database Manager
// ════════════════════════════════════════════════
const TRIVIA_CATS: TriviaEntry['category'][] = ['地形', '歴史', '建築', '道路'];
function emptyTrivia(): TriviaEntry {
  return { id: `tr-${Date.now()}`, title: '', category: '歴史', area: '', content: '' };
}
export function TriviaManager() {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<TriviaEntry | null>(null);
  const [, force] = useState(0);
  const [page, setPage] = useState(0);
  const all = db.getTrivia().filter(t => t.title.includes(search) || t.area.includes(search) || t.content.includes(search) || t.category.includes(search));
  const list = all.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const refresh = () => force(x => x + 1);

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">町歩きの蘊蓄をデータベースとして収集・保持します（地形・歴史・建築・道路）。現在 <span className="font-black text-blue-600">{db.getTrivia().length}</span> 件を保持中。</p>
      <Toolbar onAdd={() => setEditing(emptyTrivia())} search={search} setSearch={(v) => { setSearch(v); setPage(0); }} addLabel="蘊蓄を追加" />
      <div className="grid gap-2">
        {list.map(t => (
          <Card key={t.id}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-gray-900">{t.title || '(無題)'}</span>
                  <span className="text-[9px] bg-blue-50 border border-blue-200 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">{t.category}</span>
                  <span className="text-[10px] text-gray-400">{t.area}</span>
                </div>
                <p className="text-[11px] text-gray-600 mt-1 leading-relaxed break-words">{t.content}</p>
              </div>
              <div className="flex items-center shrink-0">
                <EditBtn onClick={() => setEditing(t)} />
                <DeleteBtn onClick={() => { if (confirm('この蘊蓄を削除しますか？')) { db.adminDeleteTrivia(t.id); refresh(); } }} />
              </div>
            </div>
          </Card>
        ))}
        {all.length === 0 && <p className="text-center text-xs text-gray-400 py-8">蘊蓄がありません。</p>}
      </div>
      <Pager page={page} total={all.length} onPage={setPage} />

      {editing && (
        <Modal title={db.getTrivia().some(t => t.id === editing.id) ? '蘊蓄を編集' : '蘊蓄を追加'} onClose={() => setEditing(null)}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="タイトル" full><input className={inputCls} value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} /></Field>
            <Field label="分類">
              <select className={inputCls} value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value as TriviaEntry['category'] })}>
                {TRIVIA_CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="エリア"><input className={inputCls} value={editing.area} onChange={e => setEditing({ ...editing, area: e.target.value })} placeholder="新中野 など" /></Field>
            <Field label="内容" full><textarea className={inputCls} rows={3} value={editing.content} onChange={e => setEditing({ ...editing, content: e.target.value })} /></Field>
          </div>
          <ModalActions
            onCancel={() => setEditing(null)}
            onSave={() => {
              if (!editing.title.trim()) { alert('タイトルは必須です。'); return; }
              db.adminSaveTrivia(editing); refresh(); setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
