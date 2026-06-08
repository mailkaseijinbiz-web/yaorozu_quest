'use client';

import React, { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { db, DEFAULT_SYSTEM_ROLE } from '../../lib/db';
import { GOD_FUNCTIONS } from '../../data/tasks';
import { RulesPanel } from './RulesPanel';

// システム全体のブループリント（図解）。
// コンセプト:「場が 価値・課題・蘊蓄・魂 を持つ → 神が3種のタスクでクエストを鋳造
//             → 巡礼者が達成 → 価値が育ち課題が動く（還流）」。

const fmt = (n: number) => n.toLocaleString();

const KIND_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  sense: { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-800' },
  understand: { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-800' },
  act: { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-800' },
};

// 各タスクが生むアクティビティ（具体的な行動）の説明
const KIND_ACTIVITY: Record<string, string> = {
  sense: '価値・課題・解決方法を人間から集める',
  understand: '複数の解決方法から適切な方法を人間に尋ねる',
  act: '選ばれた方法を実行し、課題を解決・価値を広げる',
};

function Node({ icon, name, type, count, ring }: {
  icon: string; name: string; type: string; count?: number; ring?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border bg-white px-3 py-2 shadow-sm ${ring ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'}`}>
      <span className="text-lg leading-none flex-shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-black text-gray-800 leading-tight">{name}{ring && <span className="ml-1 text-[9px] font-black text-amber-500 align-middle">統合</span>}</p>
        <p className="text-[10px] font-mono text-gray-400 leading-tight truncate">{type}</p>
      </div>
      {count != null && <span className="text-[11px] font-black text-gray-500 tabular-nums flex-shrink-0">{fmt(count)}</span>}
    </div>
  );
}

function Arrow({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-0.5 text-gray-400 select-none">
      <span className="text-base leading-none">▼</span>
      {label && <span className="text-[10px] font-bold text-gray-500 mt-0.5 text-center">{label}</span>}
    </div>
  );
}

function Stage({ tag, sub, color, children }: {
  tag: string; sub: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className="w-full rounded-2xl border-2 bg-white/70 backdrop-blur-sm p-3" style={{ borderColor: color }}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[11px] font-black px-2 py-0.5 rounded-full text-white" style={{ background: color }}>{tag}</span>
        <span className="text-[11px] text-gray-400">{sub}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function Blueprint() {
  const allSpots = db.getSpots();
  const spots = allSpots.length;
  const totalValue = allSpots.reduce((n, s) => n + (s.enjoyments?.length ?? 0), 0); // 価値の総和
  const totalIssues = allSpots.reduce((n, s) => n + (s.issues?.length ?? 0), 0); // 課題の総和
  const allUsers = db.getUsers();
  const users = allUsers.length;
  const totalToku = allUsers.reduce((n, u) => n + (u.totalToku ?? 0), 0); // 徳の総和（スコア）
  const activities = db.getActivities().length;
  // 究極目的：世界の幸福 = 場の活気（価値−課題）× 人間の覚り（徳−煩悩。煩悩は現状0）
  const activeness = totalValue - totalIssues;
  const enlightenment = totalToku - 0;
  const happiness = activeness + enlightenment;
  const quests = db.getAllQuests().length; // 静的＋生成クエスト

  // システムの一括更新：生成ルール＋神の魂を反映して、神・クエストを生成AIでアップデートする
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  // Godの役割（システムの目的）。記載・保存できる。
  const [systemRole, setSystemRole] = useState(() => db.getSystemRole());
  const [roleSaved, setRoleSaved] = useState(false);
  const runUpdate = async () => {
    setUpdating(true);
    setUpdateMsg(null);
    const rules = db.getQuestRules();
    const targets = db.getSpots().slice(0, 5); // 標本（全件は多数のため一部を更新）
    let ok = 0;
    for (const s of targets) {
      try {
        const agent = db.getAgentBySpot(s.id);
        const res = await fetch('/api/generate-quest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            count: 2,
            ts: Date.now(),
            rules,
            spot: { id: s.id, name: s.name, category: s.category, description: s.description, enjoyments: s.enjoyments, issues: s.issues, soulMd: agent?.soulMd, latitude: s.latitude, longitude: s.longitude },
          }),
        });
        const data = await res.json();
        if (Array.isArray(data.quests) && data.quests.length) {
          db.saveGeneratedQuests(s.id, data.quests);
          ok++;
        }
      } catch {
        /* skip */
      }
    }
    db.recordMetricsSnapshot();
    setUpdating(false);
    setUpdateMsg(`生成AIで ${ok} 場のクエストを更新しました（標本 ${targets.length} 場・神の魂と生成ルールを反映）。`);
  };

  const gridBg: React.CSSProperties = {
    backgroundColor: '#f8fafc',
    backgroundImage:
      'linear-gradient(rgba(99,102,241,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.07) 1px, transparent 1px)',
    backgroundSize: '22px 22px',
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* 究極目的：世界の幸福 = 場の活気 + 人間の覚り（最上部） */}
      <div className="mb-3 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-emerald-50 via-amber-50 to-violet-50 p-4 text-center">
        <p className="text-[11px] font-black text-gray-500">究極目的 ・ 世界の幸福 ＝ 場の活気 + 人間の覚り</p>
        <p className="text-3xl font-black text-gray-900 tabular-nums mt-1">{fmt(happiness)}</p>
        <p className="text-[11px] text-gray-500 mt-1">
          場の活気 <b className="text-blue-600">{fmt(activeness)}</b>（価値{fmt(totalValue)} − 課題{fmt(totalIssues)}）
          <span className="mx-1 text-gray-400">+</span>
          人間の覚り <b className="text-violet-600">{fmt(enlightenment)}</b>（徳{fmt(totalToku)} − 煩悩0）
        </p>
      </div>

      {/* ヘッダー */}
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">🪷 God (System)</h2>
          <button
            onClick={runUpdate}
            disabled={updating}
            className="shrink-0 flex items-center gap-1.5 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-2 rounded-lg cursor-pointer transition-all"
            title="生成ルールと神の魂を反映して、神・クエストを生成AIで更新する"
          >
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {updating ? '更新中…' : 'Update（AIで神・クエスト更新）'}
          </button>
        </div>
        {updateMsg && <p className="text-[11px] font-bold text-emerald-600 mt-1">{updateMsg}</p>}
      </div>

      {/* Godの役割（システムの目的）— 記載・保存できる */}
      <div className="mb-3">
        <RulesPanel
          title="Godの役割"
          description="このシステム（God）の目的。八百万神とクエストは、この役割を果たすために設計・生成される。"
          value={systemRole}
          onChange={(v) => { setSystemRole(v); setRoleSaved(false); }}
          onSave={() => { db.saveSystemRole(systemRole); setRoleSaved(true); }}
          onReset={() => { setSystemRole(DEFAULT_SYSTEM_ROLE); setRoleSaved(false); }}
          saved={roleSaved}
          rows={14}
        />
      </div>

      {/* 図解本体 */}
      <div className="rounded-2xl border border-gray-200 p-4" style={gridBg}>
        {/* ① 場（すべての中心） */}
        <Stage tag="場" sub="場のゴール = 場の価値を高める" color="#2563eb">
          <Node icon="📍" name="場 / スポット" type="Spot · 基本情報 / 座標" count={spots} />
          <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-3">
            <p className="text-[11px] font-black text-blue-600 mb-2">場の中心データ（神の知識になる）</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-black text-emerald-700">価値[]</p>
                  <p className="text-[9px] font-mono text-emerald-600">enjoyments</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5 leading-tight">景観・味・賑わい</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-emerald-700 tabular-nums leading-none">{fmt(totalValue)}</p>
                  <p className="text-[9px] text-emerald-500">総和</p>
                </div>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-black text-rose-700">課題[]</p>
                  <p className="text-[9px] font-mono text-rose-600">issues</p>
                  <p className="text-[10px] text-rose-600 mt-0.5 leading-tight">清掃・安全・混雑</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-rose-700 tabular-nums leading-none">{fmt(totalIssues)}</p>
                  <p className="text-[9px] text-rose-500">総和</p>
                </div>
              </div>
            </div>
          </div>
        </Stage>

        <Arrow label="場のデータを、その地の神が受け取る" />

        {/* ② 鋳造（神・工房） */}
        <Stage tag="八百万神" sub="場に宿る神が、価値・課題・魂から クエスト を鋳造する" color="#d97706">
          {/* 場に宿る神（Agent）＝ 工房の主 */}
          <Node icon="🦊" name="八百万の神 (Agent)" type="Spot と 1:1 · 魂 = Identity.md / Soul.md / 口調" count={spots} />
          <div className="flex items-center gap-2 pl-6 text-[11px] font-bold text-gray-400">└─ が鋳造する ─▶</div>
          {/* 鋳造される本体 = クエスト。3種のタスクを「内包」するコンテナとして表現する */}
          <div className="rounded-xl border-2 border-amber-400 bg-amber-50/50 p-3 shadow-sm">
            {/* クエスト見出し */}
            <div className="flex items-center gap-2.5">
              <span className="text-lg leading-none flex-shrink-0">🚩</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-gray-800 leading-tight">クエスト（タスクの集まり）<span className="ml-1 text-[9px] font-black text-amber-500 align-middle">統合</span></p>
                <p className="text-[10px] font-mono text-gray-400 leading-tight">Quest = Task[]</p>
              </div>
              <span className="text-[11px] font-black text-gray-500 tabular-nums flex-shrink-0">{fmt(quests)}</span>
            </div>
            {/* クエストが内包する3種のタスク */}
            <p className="text-[10px] font-black text-amber-600 mt-2 mb-1.5 pl-0.5">┗ 内包するタスク = 神の3つの働き（統合 <span className="font-mono">Task</span>）</p>
            <div className="grid grid-cols-3 gap-2">
              {GOD_FUNCTIONS.map((fn) => {
                const st = KIND_STYLE[fn.key];
                return (
                  <div key={fn.key} className={`rounded-lg border px-2.5 py-2 ${st.border}`}>
                    <p className={`text-[12px] font-black ${st.text}`}>{fn.label}</p>
                    <p className={`text-[10px] mt-0.5 leading-tight ${st.text} opacity-80`}>{KIND_ACTIVITY[fn.key] ?? fn.desc}</p>
                  </div>
                );
              })}
            </div>
            {/* クエスト達成で生まれるアクティビティ（クエストに内包） */}
            <p className="text-[10px] font-black text-amber-600 mt-2 mb-1.5 pl-0.5">┗ 達成で生まれる アクティビティ[]</p>
            <div className="rounded-lg border border-cyan-200 bg-transparent px-2.5 py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[12px] font-black text-cyan-700">アクティビティ[]</p>
                <p className="text-[9px] font-mono text-cyan-600">activities</p>
                <p className="text-[10px] text-cyan-600 mt-0.5 leading-tight">訪問・達成・写真・口コミ</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-black text-cyan-700 tabular-nums leading-none">{fmt(activities)}</p>
                <p className="text-[9px] text-cyan-500">総和</p>
              </div>
            </div>
          </div>
        </Stage>

        <Arrow label="クエストは神との対話によって始まる" />

        {/* ③ 巡礼（民） */}
        <Stage tag="人間" sub="人間がタスクを達成し、データを生む" color="#7c3aed">
          <Node icon="🧑‍🦱" name="巡礼者 (人間)" type="User · 徳 / レベル" count={users} />
          {/* 人間の中心データ：徳[] と アクティビティ[]（総和を表示） */}
          <div className="rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white p-3">
            <p className="text-[11px] font-black text-violet-600 mb-2">人間の中心データ</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-black text-emerald-700">徳[]</p>
                  <p className="text-[9px] font-mono text-emerald-600">toku</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5 leading-tight">達成・貢献で積まれる</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-emerald-700 tabular-nums leading-none">{fmt(totalToku)}</p>
                  <p className="text-[9px] text-emerald-500">総和（スコア）</p>
                </div>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-black text-rose-700">煩悩[]</p>
                  <p className="text-[9px] font-mono text-rose-600">bonnou</p>
                  <p className="text-[10px] text-rose-600 mt-0.5 leading-tight">未浄化の欲・執着</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-rose-700 tabular-nums leading-none">0</p>
                  <p className="text-[9px] text-rose-500">総和</p>
                </div>
              </div>
            </div>
          </div>
        </Stage>

      </div>

    </div>
  );
}
