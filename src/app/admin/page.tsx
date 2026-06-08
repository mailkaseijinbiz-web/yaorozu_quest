'use client';

import React, { useEffect, useState } from 'react';
import { Shield, MapPin, MessageSquare, Users as UsersIcon, Lock, LogOut, RotateCcw, Flag, BookOpen } from 'lucide-react';
import { db, Spot, User, UgcPost, Agent } from '../../lib/db';
import { CHALLENGES } from '../../data/challenges';
import { SpotsManager } from '../../components/admin/SpotsManager';
import { ChallengesManager } from '../../components/admin/ChallengesManager';
import { TriviaManager } from '../../components/admin/TriviaManager';
import { UgcManager } from '../../components/admin/UgcManager';
import { UsersManager } from '../../components/admin/UsersManager';
import { AgentsManager } from '../../components/admin/AgentsManager';
import { QuestGenerator } from '../../components/admin/QuestGenerator';

const ADMIN_PASSWORD = 'Kaseijinbiz1';
const AUTH_KEY = 'yaorozu_admin_auth';

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
