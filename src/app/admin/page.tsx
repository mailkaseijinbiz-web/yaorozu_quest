'use client';

import React, { useEffect, useState } from 'react';
import { Shield, MapPin, Users as UsersIcon, Lock, LogOut, RotateCcw, Flag, Network, Brain, Activity as ActivityIcon, LineChart, Settings, MessageSquare } from 'lucide-react';
import { db, Spot, User } from '../../lib/db';
import { pullSnapshot } from '../../lib/cloud-sync';
import { Blueprint } from '../../components/admin/Blueprint';
import { Analytics } from '../../components/admin/Analytics';
import { YaorozuGods } from '../../components/admin/YaorozuGods';
import { ActivityManager } from '../../components/admin/ActivityManager';
import { SpotsManager } from '../../components/admin/SpotsManager';
import { ChallengesManager } from '../../components/admin/ChallengesManager';
import { UsersManager, DEMO_USER_IDS } from '../../components/admin/UsersManager';
import { UgcManager } from '../../components/admin/UgcManager';
import { SystemPanel } from '../../components/admin/SystemPanel';

// 認証はサーバー側（/api/admin/login + HttpOnly Cookie）で行う。パスワードはクライアントに持たない。
type AdminTab = 'blueprint' | 'analytics' | 'spots' | 'gods' | 'users' | 'challenges' | 'ugc' | 'activity' | 'system';

const TABS: { key: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'blueprint', label: 'God', icon: Network },
  { key: 'analytics', label: 'Analytics', icon: LineChart },
  { key: 'spots', label: '場', icon: MapPin },
  { key: 'gods', label: '八百万神', icon: Brain },
  { key: 'users', label: '人間', icon: UsersIcon },
  { key: 'challenges', label: 'クエスト', icon: Flag },
  { key: 'ugc', label: 'UGC', icon: MessageSquare },
  { key: 'activity', label: 'アクティビティ', icon: ActivityIcon },
  { key: 'system', label: 'システム', icon: Settings },
];

const DEFAULT_TAB: AdminTab = 'blueprint';
const TAB_KEYS = TABS.map(t => t.key);

const isAdminTab = (v: string | null): v is AdminTab => !!v && (TAB_KEYS as string[]).includes(v);

// URL の ?tab=... から現在のタブを読む。不正値・未指定はデフォルト。
const readTabFromUrl = (): AdminTab => {
  if (typeof window === 'undefined') return DEFAULT_TAB;
  const t = new URLSearchParams(window.location.search).get('tab');
  return isAdminTab(t) ? t : DEFAULT_TAB;
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState(false);

  const [tab, setTabState] = useState<AdminTab>(DEFAULT_TAB);

  // タブ切り替え時に URL（?tab=...）を更新する。同一タブなら何もしない。
  const setTab = (next: AdminTab) => {
    setTabState(next);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      window.history.pushState(null, '', url);
    }
  };

  // 初期表示・ブラウザの戻る/進む（popstate）で URL ↔ タブを同期。
  useEffect(() => {
    setTabState(readTabFromUrl());
    const onPop = () => setTabState(readTabFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Data
  const [spots, setSpots] = useState<Spot[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [agentCount, setAgentCount] = useState(0);

  const refresh = () => {
    setSpots(db.getSpots());
    setUsers(db.getUsers());
    setAgentCount(db.getAgents().length);
  };

  useEffect(() => {
    // サーバーに現在のセッション状態を問い合わせる（Cookie は HttpOnly のため JS から読めない）。
    fetch('/api/admin/login')
      .then(r => r.json())
      .then((d: { authed?: boolean }) => {
        const ok = !!d.authed;
        setAuthed(ok);
        setChecking(false);
        if (ok) {
          // Supabase からスナップショットを復元してから画面を更新
          pullSnapshot().then(() => refresh());
        }
      })
      .catch(() => setChecking(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        setAuthed(true);
        setPwError(false);
        setPw('');
        await pullSnapshot();
        refresh();
      } else {
        setPwError(true);
      }
    } catch {
      setPwError(true);
    }
  };

  const handleLogout = async () => {
    try { await fetch('/api/admin/login', { method: 'DELETE' }); } catch { /* ignore */ }
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
            <h1 className="text-xl font-black text-gray-900">GOD MANAGER</h1>
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
    <div className="h-dvh flex flex-col overflow-hidden bg-gray-50 text-gray-800 font-sans">
      {/* Top bar */}
      <header className="flex-shrink-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <h1 className="text-base font-black text-gray-900">GOD MANAGER</h1>
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
      <nav className="flex-shrink-0 px-4 sm:px-6 pt-4 pb-1 flex gap-2 flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => {
          const counts: Record<AdminTab, number | null> = {
            blueprint: null, analytics: null, gods: agentCount, activity: db.getActivities().length,
            spots: spots.length, users: users.filter(u => !DEMO_USER_IDS.has(u.id)).length,
            challenges: db.getAllQuests().length, // 生成クエストを含む実数（CHALLENGES は静的・空）
            ugc: db.getUgc().length,
            system: null,
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

      <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 max-w-6xl mx-auto w-full">
        {tab === 'blueprint' && <Blueprint />}
        {tab === 'analytics' && <Analytics />}
        {tab === 'gods' && <YaorozuGods spots={spots} onChange={refresh} />}
        {tab === 'activity' && <ActivityManager spots={spots} />}
        {tab === 'spots' && <SpotsManager spots={spots} onChange={refresh} />}
        {tab === 'challenges' && <ChallengesManager />}
        {tab === 'ugc' && <UgcManager spots={spots} />}
        {tab === 'users' && <UsersManager users={users} spots={spots} onChange={refresh} />}
        {tab === 'system' && <SystemPanel onChange={refresh} />}
      </main>
    </div>
  );
}
