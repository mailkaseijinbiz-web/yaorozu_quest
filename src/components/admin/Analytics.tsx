'use client';

import React, { useState } from 'react';
import { LineChart } from 'lucide-react';
import { db, type MetricsSnapshot, type ApiCallType } from '../../lib/db';

// ════════════════════════════════════════════════
// Analytics — 各指標の時系列推移を確認する
//   ・指標スナップショット（場/クエスト/価値/課題/ユーザー/アクティビティ/徳）の推移
//   ・アクティビティ（行動ログ）の日別推移
// ════════════════════════════════════════════════

const fmt = (n: number) => n.toLocaleString();

type Metrics = Omit<MetricsSnapshot, 'ts'>;
const METRICS: { key: string; label: string; color: string; get: (s: Metrics) => number }[] = [
  { key: 'happiness', label: '世界の幸福（活気+覚り）', color: '#db2777', get: (s) => (s.value - s.issues) + s.toku },
  { key: 'spots', label: '場', color: '#2563eb', get: (s) => s.spots },
  { key: 'quests', label: 'クエスト', color: '#d97706', get: (s) => s.quests },
  { key: 'value', label: '価値 総和', color: '#059669', get: (s) => s.value },
  { key: 'issues', label: '課題 総和', color: '#e11d48', get: (s) => s.issues },
  { key: 'users', label: '人間', color: '#7c3aed', get: (s) => s.users },
  { key: 'activities', label: 'アクティビティ', color: '#0891b2', get: (s) => s.activities },
  { key: 'toku',     label: '徳 総和',          color: '#ca8a04', get: (s) => s.toku },
  { key: 'aiCalls',  label: 'AI リクエスト数',  color: '#6d28d9', get: (s) => s.aiCalls ?? 0 },
];

function Sparkline({ values, color, className = 'w-full h-9' }: { values: number[]; color: string; className?: string }) {
  if (values.length < 2) {
    return <div className={`${className} flex items-center text-[9px] text-gray-300`}>計測中… 変化が記録されると推移が表示されます</div>;
  }
  const w = 200, h = 36, pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const x = (i: number) => pad + (i / (values.length - 1)) * (w - 2 * pad);
  const y = (v: number) => h - pad - ((v - min) / range) * (h - 2 * pad);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2.5} fill={color} />
    </svg>
  );
}

/** 現在のメトリクスから「世界がどうあるべきか」のアドバイスを導く（ルールベース）。 */
function buildAdvice(c: Omit<MetricsSnapshot, 'ts'>, bonnou: number, happinessDelta: number): string[] {
  const out: string[] = [];
  const activeness = c.value - c.issues;
  const enlightenment = c.toku - bonnou;
  if (c.issues > c.value) out.push('⚠️ 課題が価値を上回っています。神に「課題を解決」タスクを鋳造させ、活気（価値−課題）を取り戻しましょう。');
  else if (c.value < 3) out.push('💎 価値が乏しい状態です。「価値を尋ねる」タスクで人間から魅力を集め、活気を底上げしましょう。');
  if (c.quests === 0) out.push('🚩 クエストがありません。場を生成してクエストを補充してください。');
  if (bonnou > 0) out.push(`🌀 未解決の煩悩が ${fmt(bonnou)} あります。「煩悩を手放す」タスクで覚り（徳−煩悩）を高めましょう。`);
  if (c.spots < 3) out.push('📍 場が少なめです。GPSで歩き、神の宿る場を増やしましょう。');
  if (happinessDelta < 0) out.push('📉 世界の幸福が低下傾向です。価値の追加と課題解決を最優先に。');
  else if (happinessDelta > 0 && activeness > 0 && enlightenment > 0) out.push('🌅 世界は良い方向に育っています。この調子で価値を広げ、煩悩を浄化し続けましょう。');
  if (out.length === 0) out.push('✅ 大きな偏りはありません。価値の充実と課題・煩悩の解消をバランスよく続けましょう。');
  return out;
}

export function Analytics() {
  // 表示時に現在値を記録（直近と同値なら追加されない）してから読み出す
  const [snaps] = useState<MetricsSnapshot[]>(() => db.recordMetricsSnapshot());
  const [activities] = useState(() => db.getActivities());
  const [apiByDay] = useState(() => db.getApiCallsByDay());
  const current = db.getCurrentMetrics();

  // アクティビティの日別件数
  const byDay: Record<string, number> = {};
  activities.forEach((a) => {
    const d = (a.createdAt || '').slice(0, 10);
    if (d) byDay[d] = (byDay[d] || 0) + 1;
  });
  const days = Object.keys(byDay).sort();
  const maxDay = days.length ? Math.max(...days.map((d) => byDay[d])) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h2 className="text-lg font-black text-gray-900 flex items-center gap-2"><LineChart className="w-5 h-5 text-blue-600" /> Analytics</h2>
        <p className="text-[13px] text-gray-500 mt-0.5">各項目の<b>時系列での変化</b>を確認できます。表示するたびに現在値が記録され、推移として蓄積されます（記録点 {fmt(snaps.length)}）。</p>
      </div>

      {/* メイングラフ：世界の幸福（活気+覚り）＋アドバイス */}
      {(() => {
        const m = METRICS[0]; // happiness
        const series = snaps.map((s) => m.get(s));
        const lastVal = m.get(current);
        const delta = series.length ? lastVal - series[0] : 0;
        const bonnou = db.getUnresolvedBonnouCount();
        const advice = buildAdvice(current, bonnou, delta);
        return (
          <div className="bg-white border-2 border-pink-200 rounded-2xl p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-black text-gray-800">{m.label}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tabular-nums" style={{ color: m.color }}>{fmt(lastVal)}</span>
                {snaps.length >= 2 && delta !== 0 && (
                  <span className={`text-xs font-black ${delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{delta > 0 ? '▲' : '▼'}{fmt(Math.abs(delta))}</span>
                )}
              </div>
            </div>
            <Sparkline values={series} color={m.color} className="w-full h-24" />
            {/* 世界がどうあるべきかのアドバイス */}
            <div className="mt-3 rounded-xl bg-pink-50/60 border border-pink-100 p-3">
              <p className="text-[11px] font-black text-pink-700 mb-1.5">🔮 世界への助言</p>
              <ul className="space-y-1">
                {advice.map((a, i) => (
                  <li key={i} className="text-[12px] text-gray-700 leading-snug">{a}</li>
                ))}
              </ul>
            </div>
          </div>
        );
      })()}

      {/* 指標ごとの現在値＋推移（幸福はメイングラフに集約済み） */}
      <div className="grid sm:grid-cols-2 gap-2">
        {METRICS.slice(1).map((m) => {
          const series = snaps.map((s) => m.get(s));
          const first = series.length ? series[0] : 0;
          const lastVal = m.get(current);
          const delta = lastVal - first;
          return (
            <div key={m.key} className="bg-white border border-gray-200 rounded-2xl p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] font-black text-gray-600">{m.label}</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black tabular-nums" style={{ color: m.color }}>{fmt(lastVal)}</span>
                  {snaps.length >= 2 && delta !== 0 && (
                    <span className={`text-[10px] font-black ${delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{delta > 0 ? '▲' : '▼'}{fmt(Math.abs(delta))}</span>
                  )}
                </div>
              </div>
              <Sparkline values={series} color={m.color} />
            </div>
          );
        })}
      </div>

      {/* アクティビティの日別推移 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <h3 className="text-sm font-black text-gray-800">アクティビティの推移（日別）</h3>
        <p className="text-[11px] text-gray-400 mt-0.5 mb-3">巡礼者の行動ログ（訪問・達成・写真・口コミ等）の日別件数。</p>
        {days.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-6">まだアクティビティがありません。</p>
        ) : (
          <div className="flex items-end gap-1.5 h-32">
            {days.map((d) => (
              <div key={d} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
                <span className="text-[9px] font-black text-cyan-700 tabular-nums">{byDay[d]}</span>
                <div className="w-full rounded-t bg-cyan-500/80" style={{ height: `${maxDay ? (byDay[d] / maxDay) * 100 : 0}%`, minHeight: 3 }} />
                <span className="text-[8px] text-gray-400 truncate w-full text-center">{d.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI API リクエストの日別推移 */}
      {(() => {
        const API_TYPES: { key: ApiCallType; label: string; color: string }[] = [
          { key: 'ai_chat',    label: 'AI チャット', color: '#6d28d9' },
          { key: 'ai_generate',label: 'AI 生成',    color: '#9333ea' },
        ];
        const apiDays = Object.keys(apiByDay).sort();
        const maxApi = apiDays.length
          ? Math.max(...apiDays.map((d) => API_TYPES.reduce((s, t) => s + (apiByDay[d]?.[t.key] ?? 0), 0)))
          : 0;
        return (
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <h3 className="text-sm font-black text-gray-800">AI リクエスト（日別）</h3>
            <p className="text-[11px] text-gray-400 mt-0.5 mb-3">生成AI（Gemini）への API 呼び出し件数。</p>
            <div className="flex items-center gap-4 mb-3 flex-wrap">
              {API_TYPES.map((t) => (
                <span key={t.key} className="flex items-center gap-1 text-[11px] font-black" style={{ color: t.color }}>
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: t.color }} />
                  {t.label}: {Object.values(apiByDay).reduce((s, d) => s + (d?.[t.key] ?? 0), 0)}件
                </span>
              ))}
            </div>
            {apiDays.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-6">まだ API リクエストがありません。</p>
            ) : (
              <div className="flex items-end gap-1.5 h-32">
                {apiDays.map((d) => {
                  const total = API_TYPES.reduce((s, t) => s + (apiByDay[d]?.[t.key] ?? 0), 0);
                  return (
                    <div key={d} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
                      <span className="text-[9px] font-black text-violet-700 tabular-nums">{total}</span>
                      <div className="w-full flex flex-col-reverse rounded-t overflow-hidden" style={{ height: `${maxApi ? (total / maxApi) * 100 : 0}%`, minHeight: 3 }}>
                        {API_TYPES.map((t) => {
                          const n = apiByDay[d]?.[t.key] ?? 0;
                          return n > 0 ? (
                            <div key={t.key} style={{ flex: n, background: t.color }} />
                          ) : null;
                        })}
                      </div>
                      <span className="text-[8px] text-gray-400 truncate w-full text-center">{d.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
