'use client';

import React, { useState } from 'react';
import { Wand2, Loader2, Sparkles, Eye, Pencil } from 'lucide-react';

// ── 軽量 Markdown レンダラー ────────────────────────────────
function renderMd(md: string): React.ReactNode[] {
  const lines = md.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  // インライン装飾（**bold**, `code`）
  function inline(text: string): React.ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((p, j) => {
      if (p.startsWith('**') && p.endsWith('**'))
        return <strong key={j}>{p.slice(2, -2)}</strong>;
      if (p.startsWith('`') && p.endsWith('`'))
        return <code key={j} className="bg-gray-100 text-rose-600 text-[10px] px-1 rounded font-mono">{p.slice(1, -1)}</code>;
      return p;
    });
  }

  while (i < lines.length) {
    const line = lines[i];

    // 空行
    if (line.trim() === '') { nodes.push(<div key={key++} className="h-2" />); i++; continue; }

    // h1
    if (/^# /.test(line)) {
      nodes.push(<h1 key={key++} className="text-base font-black text-gray-900 mt-3 mb-1">{inline(line.slice(2))}</h1>);
      i++; continue;
    }
    // h2
    if (/^## /.test(line)) {
      nodes.push(<h2 key={key++} className="text-[13px] font-black text-gray-800 mt-3 mb-1 border-b border-gray-200 pb-0.5">{inline(line.slice(3))}</h2>);
      i++; continue;
    }
    // h3
    if (/^### /.test(line)) {
      nodes.push(<h3 key={key++} className="text-[12px] font-black text-blue-700 mt-2 mb-0.5">{inline(line.slice(4))}</h3>);
      i++; continue;
    }
    // blockquote（> や "> "）
    if (/^> /.test(line)) {
      nodes.push(
        <blockquote key={key++} className="border-l-2 border-blue-400 pl-3 my-1 text-[11px] text-gray-600 italic leading-relaxed">
          {inline(line.slice(2))}
        </blockquote>
      );
      i++; continue;
    }
    // 区切り線
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={key++} className="my-2 border-gray-200" />);
      i++; continue;
    }
    // リスト（- / – / * / ・）
    if (/^[-–*・] /.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[-–*・] /.test(lines[i])) {
        const txt = lines[i].replace(/^[-–*・] /, '');
        items.push(<li key={i} className="text-[11px] text-gray-700 leading-relaxed">{inline(txt)}</li>);
        i++;
      }
      nodes.push(<ul key={key++} className="list-disc list-inside space-y-0.5 my-1 pl-1">{items}</ul>);
      continue;
    }
    // 通常テキスト
    nodes.push(
      <p key={key++} className="text-[11px] text-gray-700 leading-relaxed">{inline(line)}</p>
    );
    i++;
  }
  return nodes;
}
// ────────────────────────────────────────────────────────────

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
  const [preview, setPreview] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-black text-gray-900">{title}</h2>
        </div>
        {/* Edit / Preview トグル */}
        <button
          onClick={() => setPreview((p) => !p)}
          className="flex items-center gap-1 text-[11px] font-black text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
        >
          {preview
            ? <><Pencil className="w-3 h-3" /> 編集</>
            : <><Eye className="w-3 h-3" /> プレビュー</>
          }
        </button>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed">{description}</p>

      {preview ? (
        /* プレビュー表示 */
        <div
          className="w-full min-h-[160px] bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 overflow-y-auto"
          style={{ maxHeight: `${rows * 1.6}em` }}
        >
          {renderMd(value)}
        </div>
      ) : (
        /* テキスト編集 */
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-[11px] font-mono text-gray-800 leading-relaxed focus:outline-none focus:border-blue-400 resize-y"
          placeholder="生成ルール（方針）を Markdown で記述…"
        />
      )}

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
