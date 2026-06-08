'use client';

import React from 'react';
import { Wand2, Loader2, Sparkles } from 'lucide-react';

// 生成ルール編集パネル（クエストタブ・八百万神タブ共通）。
// md テキストを編集・保存・既定に戻す・生成AIでアップデート できる。
export function RulesPanel({
  title,
  description,
  value,
  onChange,
  onSave,
  onReset,
  onAIUpdate,
  aiLoading,
  saved,
  source,
  rows = 14,
}: {
  title: string;
  description: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onReset: () => void;
  onAIUpdate?: () => void;
  aiLoading?: boolean;
  saved?: boolean;
  source?: string | null;
  rows?: number;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Wand2 className="w-4 h-4 text-blue-600" />
        <h2 className="text-sm font-black text-gray-900">{title}</h2>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed">{description}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-[11px] font-mono text-gray-800 leading-relaxed focus:outline-none focus:border-blue-400 resize-y"
        placeholder="生成ルール（方針）を Markdown で記述…"
      />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button onClick={onReset} className="text-[12px] font-black text-blue-600 hover:underline cursor-pointer">↻ 既定に戻す</button>
        <div className="flex items-center gap-2">
          {source && <span className="text-[10px] text-gray-400">AI: {source}</span>}
          {saved && <span className="text-[11px] font-bold text-green-600">保存しました</span>}
          {onAIUpdate && (
            <button
              onClick={onAIUpdate}
              disabled={aiLoading}
              className="flex items-center gap-1 text-xs font-black text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 px-3 py-2 rounded-lg cursor-pointer transition-all"
            >
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiLoading ? '生成中…' : '生成AIでアップデート'}
            </button>
          )}
          <button onClick={onSave} className="text-xs font-black text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg cursor-pointer">保存</button>
        </div>
      </div>
    </div>
  );
}
