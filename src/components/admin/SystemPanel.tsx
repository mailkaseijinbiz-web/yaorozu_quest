'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Bug, Cloud, Database, RotateCcw, FileText, Bell } from 'lucide-react';
import { db } from '../../lib/db';
import { isCloudEnabled, schedulePush, pullSnapshot } from '../../lib/cloud-sync';
import { subscribePush } from '../../lib/push-client';
import { isDebugEnabled, setDebugEnabled, getDebugLocation, setDebugLocation, DEBUG_PRESETS } from '../../lib/debug';
import { GOD_FUNCTIONS, TASK_CATALOG, TASK_TARGET_META, TASK_TARGET, type TaskType } from '../../data/tasks';
import { buildDainichiIdentityMd } from '../../lib/dainichi';

// ════════════════════════════════════════════════
// System — アプリのUI/挙動設定 と 仕様確認
// ════════════════════════════════════════════════

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <h3 className="text-sm font-black text-gray-800 flex items-center gap-1.5 mb-2">{icon}{title}</h3>
      {children}
    </div>
  );
}

export function SystemPanel({ onChange }: { onChange: () => void }) {
  // 設定値
  const [debug, setDebug] = useState(false);
  const [ttlDays, setTtlDays] = useState(30);
  const [cloud, setCloud] = useState<boolean | null>(null);
  const [savedMsg, setSavedMsg] = useState('');
  // プッシュ
  const [pushConfigured, setPushConfigured] = useState<boolean | null>(null);
  const [pushTitle, setPushTitle] = useState('新しいクエストが登場');
  const [pushBody, setPushBody] = useState('近くに新しいクエストが現れました。確かめに行きましょう。');

  useEffect(() => {
    setDebug(isDebugEnabled());
    setTtlDays(db.getAppSettings().spotTtlDays);
    setCloud(isCloudEnabled());
    fetch('/api/push/subscribe').then((r) => r.json()).then((j) => setPushConfigured(!!j.configured)).catch(() => setPushConfigured(false));
  }, []);

  const flash = (m: string) => { setSavedMsg(m); setTimeout(() => setSavedMsg(''), 2000); };

  const dbgLoc = getDebugLocation();

  // データ件数
  const counts: { label: string; n: number }[] = [
    { label: '場', n: db.getSpots().length },
    { label: '削除済み場', n: db.getDeletedSpots().length },
    { label: '神', n: db.getAgents().length },
    { label: 'クエスト', n: db.getAllQuests().length },
    { label: '人間', n: db.getUsers().length },
    { label: 'アクティビティ', n: db.getActivities().length },
    { label: '未解決煩悩', n: db.getUnresolvedBonnouCount() },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h2 className="text-lg font-black text-gray-900 flex items-center gap-2"><Settings className="w-5 h-5 text-blue-600" /> System</h2>
        <p className="text-[13px] text-gray-500 mt-0.5">アプリのUI・挙動設定と、現在の仕様（生成方針・タスク定義）を確認できます。</p>
        {savedMsg && <p className="text-[12px] font-bold text-emerald-600 mt-1">{savedMsg}</p>}
      </div>

      {/* ── 設定 ── */}
      <Section icon={<Bug className="w-4 h-4 text-fuchsia-600" />} title="デバッグ・現在地">
        <label className="flex items-center justify-between gap-2 py-1.5">
          <span className="text-[13px] text-gray-700">デバッグモード（位置情報なしでテスト）</span>
          <input type="checkbox" checked={debug} onChange={(e) => { setDebugEnabled(e.target.checked); setDebug(e.target.checked); flash(e.target.checked ? 'デバッグモードを有効化' : '無効化しました'); }} className="cursor-pointer w-4 h-4" />
        </label>
        <p className="text-[11px] text-gray-400 mb-2">URL に ?debug=1 を付けても有効化できます。現在のデバッグ現在地: {dbgLoc ? `${dbgLoc.lat.toFixed(3)}, ${dbgLoc.lng.toFixed(3)}` : '未設定'}</p>
        <div className="flex flex-wrap gap-1.5">
          {DEBUG_PRESETS.map((p) => (
            <button key={p.name} onClick={() => { setDebugLocation({ lat: p.lat, lng: p.lng }); flash(`デバッグ現在地を「${p.name}」に設定`); }}
              className="text-[11px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-fuchsia-100 hover:text-fuchsia-700 cursor-pointer">📍 {p.name}</button>
          ))}
          <button onClick={() => { setDebugLocation(null); flash('デバッグ現在地を解除'); }} className="text-[11px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer">解除</button>
        </div>
      </Section>

      <Section icon={<Settings className="w-4 h-4 text-blue-600" />} title="場の自動削除（TTL）">
        <div className="flex items-end gap-2">
          <label className="flex-1">
            <span className="block text-[11px] font-black text-gray-400 mb-0.5">スポットTTL（日）— GPS生成スポットが自動削除されるまで</span>
            <input type="number" min={1} value={ttlDays} onChange={(e) => setTtlDays(Number(e.target.value))}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 tabular-nums focus:outline-none focus:border-blue-500" />
          </label>
          <button onClick={() => { db.saveAppSettings({ spotTtlDays: Math.max(1, ttlDays) }); flash('TTLを保存しました'); }}
            className="bg-blue-600 text-white text-[12px] font-black px-3 py-2 rounded-lg hover:bg-blue-700 cursor-pointer">保存</button>
        </div>
      </Section>

      <Section icon={<Cloud className="w-4 h-4 text-sky-600" />} title="クラウド同期">
        <p className="text-[13px] text-gray-700">状態: <b className={cloud === true ? 'text-emerald-600' : cloud === false ? 'text-rose-600' : 'text-gray-400'}>{cloud === true ? '有効' : cloud === false ? '無効（鍵未設定）' : '未確認'}</b></p>
        <div className="flex gap-2 mt-2">
          <button onClick={() => { schedulePush(); flash('クラウドへ保存をスケジュールしました'); }} className="text-[12px] font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-3 py-1.5 hover:bg-sky-100 cursor-pointer">今すぐ保存</button>
          <button onClick={() => { pullSnapshot().then((a) => { setCloud(isCloudEnabled()); if (a) { onChange(); flash('クラウドから復元しました'); } else flash('復元対象なし'); }); }} className="text-[12px] font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-3 py-1.5 hover:bg-sky-100 cursor-pointer">復元</button>
        </div>
      </Section>

      <Section icon={<Bell className="w-4 h-4 text-amber-600" />} title="プッシュ通知（Web Push / VAPID）">
        <p className="text-[13px] text-gray-700">状態: <b className={pushConfigured === true ? 'text-emerald-600' : pushConfigured === false ? 'text-rose-600' : 'text-gray-400'}>{pushConfigured === true ? '設定済み（VAPID鍵あり）' : pushConfigured === false ? '未設定（VAPID鍵なし）' : '確認中…'}</b></p>
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            onClick={async () => { const r = await subscribePush(); flash(r === 'subscribed' ? 'この端末で通知を有効化しました' : r === 'denied' ? '通知が許可されませんでした' : r === 'unconfigured' ? 'VAPID鍵が未設定です' : r === 'unsupported' ? 'この環境は未対応です' : '購読に失敗しました'); }}
            className="text-[12px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-100 cursor-pointer"
          >この端末で受信を有効化</button>
        </div>
        <div className="mt-3 space-y-1.5">
          <input value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} placeholder="通知タイトル" className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-900 focus:outline-none focus:border-amber-500" />
          <textarea value={pushBody} onChange={(e) => setPushBody(e.target.value)} rows={2} placeholder="本文" className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-900 focus:outline-none focus:border-amber-500 resize-none" />
          <button
            onClick={async () => {
              try {
                const r = await fetch('/api/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: pushTitle, body: pushBody, url: '/' }) });
                const j = await r.json();
                flash(j.ok ? `送信：${j.sent}件成功 / ${j.failed}件失敗（登録${j.total}件）` : `送信失敗：${j.error ?? ''}`);
              } catch { flash('送信に失敗しました'); }
            }}
            className="w-full bg-amber-600 text-white text-[12px] font-black py-2 rounded-lg hover:bg-amber-700 cursor-pointer"
          >登録端末全員に送信</button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">※ 端末ごとに「受信を有効化」が必要です。本番では .env に VAPID 鍵、Supabase に push_subscriptions テーブルが必要（docs/PUSH.md 参照）。</p>
      </Section>

      <Section icon={<Database className="w-4 h-4 text-gray-600" />} title="データ件数">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {counts.map((c) => (
            <div key={c.label} className="rounded-lg bg-gray-50 border border-gray-200 px-2 py-1.5 text-center">
              <p className="text-lg font-black text-gray-800 tabular-nums leading-none">{c.n.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
        <button onClick={() => { if (confirm('全データを初期状態にリセットします。よろしいですか？')) { db.adminResetAll(); onChange(); flash('リセットしました'); } }}
          className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-lg px-2.5 py-1.5 cursor-pointer">
          <RotateCcw className="w-3.5 h-3.5" /> 全データをリセット
        </button>
      </Section>

      {/* ── 仕様確認 ── */}
      <Section icon={<FileText className="w-4 h-4 text-indigo-600" />} title="仕様確認 — タスク定義">
        <p className="text-[11px] text-gray-400 mb-2">神の3機能 × 対象（場の活気／人間の覚り）で分類されたタスク種別。アプリが実際に使う定義です。</p>
        <div className="space-y-3">
          {GOD_FUNCTIONS.map((fn) => (
            <div key={fn.key}>
              <p className="text-[12px] font-black text-gray-700">{fn.icon} {fn.label}<span className="font-normal text-gray-400 ml-1">— {fn.desc}</span></p>
              {(['spot', 'human'] as const).map((target) => {
                const types = fn.tasks.filter((t) => TASK_TARGET[t as TaskType] === target);
                if (types.length === 0) return null;
                return (
                  <div key={target} className="ml-2 mt-1">
                    <p className="text-[10px] font-black text-gray-400">{TASK_TARGET_META[target].icon} {TASK_TARGET_META[target].label}</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {types.map((t) => {
                        const c = TASK_CATALOG[t as TaskType];
                        return <span key={t} title={`${c.title}（+${c.reward}徳）`} className="text-[11px] bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5 text-gray-700">{c.icon} {c.label}</span>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Section>

      <Section icon={<FileText className="w-4 h-4 text-indigo-600" />} title="仕様確認 — 生成方針・基底">
        <div className="space-y-2">
          {[
            { label: 'Godの役割（目的）', text: db.getSystemRole() },
            { label: '場の生成方針', text: db.getSpotRules() },
            { label: 'クエスト生成方針', text: db.getQuestRules() },
            { label: 'アマテラス（全神の基底）', text: db.getDainichiIdentity() ?? buildDainichiIdentityMd() },
          ].map((d) => (
            <details key={d.label} className="rounded-lg border border-gray-200 bg-gray-50">
              <summary className="cursor-pointer px-3 py-2 text-[12px] font-black text-gray-700">{d.label}</summary>
              <pre className="px-3 py-2 text-[11px] text-gray-600 whitespace-pre-wrap leading-snug max-h-60 overflow-y-auto border-t border-gray-200">{d.text}</pre>
            </details>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">※ 詳細仕様書は docs/SPEC.md（サーバー側）を参照。各方針は God／場／クエスト タブで編集できます。</p>
      </Section>
    </div>
  );
}
