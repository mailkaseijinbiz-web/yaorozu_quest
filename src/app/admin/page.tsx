'use client';

import React, { useEffect, useState } from 'react';
import {
  Shield, MapPin, MessageSquare, Users as UsersIcon, Sparkles, Trash2, Plus,
  Save, X, Lock, LogOut, RotateCcw, Pencil, Search, Wand2, Check, Loader2, Flag, BookOpen,
} from 'lucide-react';
import { db, Spot, User, UgcPost, Agent, TriviaEntry } from '../../lib/db';
import type { GeneratedQuest } from '../api/generate-quest/route';
import { TASK_CATALOG, COMMON_TASK_TYPES, resolveTaskTypes, GodTaskType } from '../../data/god-tasks';
import { CHALLENGES, difficultyLabel } from '../../data/challenges';

const ADMIN_PASSWORD = 'Kaseijinbiz1';
const AUTH_KEY = 'yaorozu_admin_auth';
const USER_QUESTS_KEY = 'yaorozu_user_quests';

type AdminTab = 'spots' | 'ugc' | 'users' | 'agents' | 'quests' | 'challenges' | 'trivia';

const TABS: { key: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'spots', label: 'スポット', icon: MapPin },
  { key: 'challenges', label: 'チャレンジ', icon: Flag },
  { key: 'trivia', label: '蘊蓄DB', icon: BookOpen },
  { key: 'ugc', label: 'UGC投稿', icon: MessageSquare },
  { key: 'users', label: 'ユーザー', icon: UsersIcon },
];

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState(false);

  const [tab, setTab] = useState<AdminTab>('spots');

  // Data
  const [spots, setSpots] = useState<Spot[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [ugc, setUgc] = useState<UgcPost[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  const refresh = () => {
    setSpots(db.getSpots());
    setUsers(db.getUsers());
    setUgc(db.getUgc());
    setAgents(db.getAgents());
  };

  useEffect(() => {
    const ok = sessionStorage.getItem(AUTH_KEY) === '1';
    setAuthed(ok);
    setChecking(false);
    if (ok) refresh();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, '1');
      setAuthed(true);
      setPwError(false);
      refresh();
    } else {
      setPwError(true);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(AUTH_KEY);
    setAuthed(false);
    setPw('');
  };

  if (checking) return null;

  // ── Password Gate ──
  if (!authed) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-6 font-sans">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-white border border-gray-200 rounded-3xl p-8 shadow-sm space-y-5"
        >
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Shield className="w-7 h-7 text-blue-600" />
            </div>
            <h1 className="text-xl font-black text-gray-900">YAOROZU 管理コンソール</h1>
            <p className="text-xs text-gray-500">管理パスワードを入力してください</p>
          </div>
          <div className="space-y-2">
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={pw}
                onChange={e => { setPw(e.target.value); setPwError(false); }}
                autoFocus
                className="w-full bg-white border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-500 transition-all"
                placeholder="パスワード"
              />
            </div>
            {pwError && <p className="text-[11px] text-red-500 font-bold">パスワードが違います。</p>}
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-black text-sm transition-all cursor-pointer"
          >
            ログイン
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50 text-gray-800 font-sans">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <h1 className="text-base font-black text-gray-900">YAOROZU 管理コンソール</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (confirm('全データを初期状態にリセットします。よろしいですか？')) {
                db.adminResetAll();
                refresh();
              }
            }}
            className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-lg px-2.5 py-1.5 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> リセット
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-lg px-2.5 py-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> ログアウト
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="px-4 sm:px-6 pt-4 flex gap-2 flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => {
          const counts: Record<AdminTab, number | null> = {
            spots: spots.length, ugc: ugc.length, users: users.length, agents: agents.length, quests: null,
            challenges: CHALLENGES.length, trivia: db.getTrivia().length,
          };
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                active ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:text-gray-900 border border-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
              {counts[key] !== null && (
                <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/25' : 'bg-gray-100'}`}>
                  {counts[key]}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <main className="px-4 sm:px-6 py-5 max-w-6xl mx-auto">
        {tab === 'spots' && <SpotsManager spots={spots} onChange={refresh} />}
        {tab === 'challenges' && <ChallengesManager />}
        {tab === 'trivia' && <TriviaManager />}
        {tab === 'ugc' && <UgcManager ugc={ugc} spots={spots} onChange={refresh} />}
        {tab === 'users' && <UsersManager users={users} spots={spots} onChange={refresh} />}
        {tab === 'agents' && <AgentsManager agents={agents} spots={spots} onChange={refresh} />}
        {tab === 'quests' && <QuestGenerator spots={spots} />}
      </main>
    </div>
  );
}

// ── Shared UI helpers ──
const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-4">{children}</div>
);

const Field: React.FC<{ label: string; children: React.ReactNode; full?: boolean }> = ({ label, children, full }) => (
  <div className={`space-y-1 ${full ? 'sm:col-span-2' : ''}`}>
    <label className="text-[10px] text-gray-500 font-bold block">{label}</label>
    {children}
  </div>
);

const inputCls = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-blue-500 transition-all';

// ── 共有：ページャ ──
const PER_PAGE = 20;
function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 py-4">
      <button
        onClick={() => onPage(Math.max(0, page - 1))}
        disabled={page <= 0}
        className="px-3 py-1.5 rounded-lg text-xs font-black bg-white border border-gray-300 text-gray-600 disabled:opacity-40 enabled:hover:border-blue-500 enabled:cursor-pointer"
      >‹ 前へ</button>
      <span className="text-xs font-black text-gray-700">{page + 1} / {pageCount}</span>
      <button
        onClick={() => onPage(Math.min(pageCount - 1, page + 1))}
        disabled={page >= pageCount - 1}
        className="px-3 py-1.5 rounded-lg text-xs font-black bg-white border border-gray-300 text-gray-600 disabled:opacity-40 enabled:hover:border-blue-500 enabled:cursor-pointer"
      >次へ ›</button>
    </div>
  );
}

// ════════════════════════════════════════════════
// Challenges Manager（どんなチャレンジがあるか管理・閲覧）
// ════════════════════════════════════════════════
function ChallengesManager() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const all = CHALLENGES.filter(c => c.title.includes(q) || c.goalName.includes(q) || c.badgeName.includes(q));
  const list = all.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">登録済みのチャレンジ（ミニチャレンジ）一覧。現在 <span className="font-black text-blue-600">{CHALLENGES.length}</span> 件。難易度・ステップ・蘊蓄・ゴールを確認できます。</p>
      <div className="relative max-w-xs">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-blue-500" placeholder="検索…" />
      </div>
      {list.map((ch) => {
        const diff = difficultyLabel(ch.difficulty);
        return (
          <Card key={ch.id}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-xl shrink-0">{ch.badgeIcon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-gray-900">{ch.title}</span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">{diff.stars} {diff.label}</span>
                  <span className="text-[10px] text-gray-500">バッジ: {ch.badgeName}</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">{ch.description}</p>
                <p className="text-[10px] text-gray-400 mt-1">🚩 ゴール: {ch.goalName} ・ {ch.steps.length}ステップ</p>
                <div className="mt-2 space-y-1">
                  {ch.steps.map((st, i) => (
                    <div key={st.id} className="text-[11px] text-gray-600 flex items-start gap-1.5">
                      <span className="font-black text-blue-600">{i + 1}.</span>
                      <span>{st.title}{st.photo ? '（📸写真）' : ''}{st.triviaCategory ? ` ［${st.triviaCategory}の蘊蓄］` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
      <Pager page={page} total={all.length} onPage={setPage} />
    </div>
  );
}

// ════════════════════════════════════════════════
// Trivia (蘊蓄) Database Manager
// ════════════════════════════════════════════════
const TRIVIA_CATS: TriviaEntry['category'][] = ['地形', '歴史', '建築', '道路'];
function emptyTrivia(): TriviaEntry {
  return { id: `tr-${Date.now()}`, title: '', category: '歴史', area: '', content: '' };
}
function TriviaManager() {
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

function Toolbar({ onAdd, search, setSearch, addLabel }: {
  onAdd: () => void; search: string; setSearch: (v: string) => void; addLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="relative flex-1 max-w-xs">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-blue-500"
          placeholder="検索…"
        />
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-3 py-2 rounded-lg transition-all cursor-pointer shrink-0"
      >
        <Plus className="w-4 h-4" /> {addLabel}
      </button>
    </div>
  );
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
      title="削除"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
      title="編集"
    >
      <Pencil className="w-4 h-4" />
    </button>
  );
}

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

function SpotsManager({ spots, onChange }: { spots: Spot[]; onChange: () => void }) {
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.imageUrl
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

// ════════════════════════════════════════════════
// UGC Manager
// ════════════════════════════════════════════════
function UgcManager({ ugc, spots, onChange }: { ugc: UgcPost[]; spots: Spot[]; onChange: () => void }) {
  const [search, setSearch] = useState('');
  const spotName = (id: string) => spots.find(s => s.id === id)?.name || '(不明なスポット)';
  const filtered = ugc.filter(p => p.content.includes(search) || p.userDisplayName.includes(search) || spotName(p.spotId).includes(search));

  return (
    <div>
      <div className="relative max-w-xs mb-4">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-blue-500" placeholder="検索…" />
      </div>
      <div className="grid gap-2">
        {filtered.map(p => (
          <Card key={p.id}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-gray-900">{p.userDisplayName}</span>
                  <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{spotName(p.spotId)}</span>
                  <span className="text-[10px] text-gray-400">♥ {p.likesCount}</span>
                  <span className="text-[10px] text-gray-400">{new Date(p.createdAt).toLocaleString('ja-JP')}</span>
                </div>
                <p className="text-[11px] text-gray-700 mt-1 leading-relaxed break-words">{p.content}</p>
              </div>
              <DeleteBtn onClick={() => { if (confirm('この投稿を削除しますか？')) { db.adminDeleteUgc(p.id); onChange(); } }} />
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-xs text-gray-400 py-8">投稿がありません。</p>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// Users Manager
// ════════════════════════════════════════════════
function emptyUser(): User {
  return {
    id: `user-${Date.now()}`, displayName: '', currentTitle: '見習い巡礼者', totalToku: 0,
    avatarUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=new',
  };
}

function UsersManager({ users, spots, onChange }: { users: User[]; spots: Spot[]; onChange: () => void }) {
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

// ════════════════════════════════════════════════
// Agents (神様AI) Manager
// ════════════════════════════════════════════════
const VOICE_TONES: Agent['voiceTone'][] = ['厳格', '親しみやすい', '神秘的', '高飛車', '賢者'];

function emptyAgent(spotId: string): Agent {
  return {
    id: `agent-${Date.now()}`, spotId, name: '', personaDescription: '', systemPrompt: '',
    avatar3dUrl: '', haloColor: '#c5a028', accessoryType: 'なし', voiceTone: '親しみやすい',
  };
}

function AgentsManager({ agents, spots, onChange }: { agents: Agent[]; spots: Spot[]; onChange: () => void }) {
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

// ════════════════════════════════════════════════
// AI Quest Generator
// ════════════════════════════════════════════════
interface DraftQuest extends GeneratedQuest { _key: string; }

function QuestGenerator({ spots }: { spots: Spot[] }) {
  const [spotId, setSpotId] = useState<string>(spots[0]?.id ?? '');
  const [count, setCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState<'openai' | 'fallback' | null>(null);
  const [drafts, setDrafts] = useState<DraftQuest[]>([]);
  const [publishedCount, setPublishedCount] = useState(0);

  const spot = spots.find(s => s.id === spotId);

  const handleGenerate = async () => {
    if (!spot) { setError('スポットを選択してください。'); return; }
    setLoading(true);
    setError('');
    setSource(null);
    setPublishedCount(0);
    try {
      const res = await fetch('/api/generate-quest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count,
          spot: {
            name: spot.name, category: spot.category,
            description: spot.description, enjoyments: spot.enjoyments,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.quests) throw new Error(data.error || '生成に失敗しました。');
      setSource(data.source ?? null);
      setDrafts(data.quests.map((q: GeneratedQuest, i: number) => ({ ...q, _key: `${Date.now()}-${i}` })));
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = (key: string, patch: Partial<DraftQuest>) =>
    setDrafts(ds => ds.map(d => d._key === key ? { ...d, ...patch } : d));

  const removeDraft = (key: string) => setDrafts(ds => ds.filter(d => d._key !== key));

  const handlePublish = () => {
    if (drafts.length === 0) return;
    const existing = JSON.parse(localStorage.getItem(USER_QUESTS_KEY) || '[]');
    const newQuests = drafts.map((d, i) => ({
      id: `uq-ai-${Date.now()}-${i}`,
      creatorId: 'ai-oracle',
      creatorName: 'AI神官（自動生成）',
      title: d.title,
      description: d.description,
      reward: d.reward,
      targetSpotName: d.targetSpotName,
      createdAt: new Date().toISOString(),
      completedBy: [],
    }));
    localStorage.setItem(USER_QUESTS_KEY, JSON.stringify([...newQuests, ...existing]));
    setPublishedCount(drafts.length);
    setDrafts([]);
  };

  return (
    <div className="space-y-4">
      {/* 生成コントロール */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-black text-gray-900">AIクエスト自動生成</h2>
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          スポット情報をもとにAIが街歩きクエストを生成します。確認・編集してから公開すると、ユーザーアプリの「コミュニティクエスト」に追加されます。
        </p>
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <Field label="対象スポット">
            <select className={inputCls} value={spotId} onChange={e => setSpotId(e.target.value)}>
              {spots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="生成数">
            <select className={inputCls} value={count} onChange={e => setCount(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}個</option>)}
            </select>
          </Field>
          <button
            onClick={handleGenerate}
            disabled={loading || !spot}
            className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black px-4 py-2 rounded-lg transition-all cursor-pointer h-[34px]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {loading ? '生成中…' : 'AIで生成'}
          </button>
        </div>
        {error && <p className="text-[11px] text-red-500 font-bold">{error}</p>}
        {source && (
          <p className="text-[10px] text-gray-400">
            生成エンジン: {source === 'openai' ? 'OpenAI' : 'ルールベース（APIキー未設定のためフォールバック）'}
          </p>
        )}
        {publishedCount > 0 && (
          <p className="text-[11px] text-green-600 font-bold flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> {publishedCount}件のクエストを公開しました。
          </p>
        )}
      </div>

      {/* 生成結果（ドラフト） */}
      {drafts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider">生成結果（{drafts.length}件・編集可）</h3>
            <button
              onClick={handlePublish}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-4 py-2 rounded-lg transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> すべて公開
            </button>
          </div>
          {drafts.map(d => (
            <Card key={d._key}>
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <input
                    className={`${inputCls} font-bold`}
                    value={d.title}
                    onChange={e => updateDraft(d._key, { title: e.target.value })}
                  />
                  <textarea
                    className={inputCls}
                    rows={2}
                    value={d.description}
                    onChange={e => updateDraft(d._key, { description: e.target.value })}
                  />
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] text-gray-500 font-bold">報酬</label>
                    <select
                      className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-900 focus:outline-none focus:border-blue-500"
                      value={d.reward}
                      onChange={e => updateDraft(d._key, { reward: Number(e.target.value) })}
                    >
                      {[10, 20, 30, 50, 80, 100].map(v => <option key={v} value={v}>+{v} 徳</option>)}
                    </select>
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" /> {d.targetSpotName}
                    </span>
                  </div>
                </div>
                <DeleteBtn onClick={() => removeDraft(d._key)} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Modal ──
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-200">
      <button onClick={onCancel} className="px-4 py-2 rounded-lg text-xs font-black text-gray-500 hover:text-gray-900 border border-gray-200 cursor-pointer transition-all">キャンセル</button>
      <button onClick={onSave} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-all">
        <Save className="w-3.5 h-3.5" /> 保存
      </button>
    </div>
  );
}
