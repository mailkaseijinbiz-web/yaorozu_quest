'use client';

// 管理コンソール共有UIプリミティブ。各 Manager から import して使う。
import React from 'react';
import { Search, Plus, Trash2, Pencil, X, Save } from 'lucide-react';

export const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-4">{children}</div>
);

export const Field: React.FC<{ label: string; children: React.ReactNode; full?: boolean }> = ({ label, children, full }) => (
  <div className={`space-y-1 ${full ? 'sm:col-span-2' : ''}`}>
    <label className="text-[10px] text-gray-500 font-bold block">{label}</label>
    {children}
  </div>
);

export const inputCls = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-blue-500 transition-all';

// ── 共有：ページャ ──
export const PER_PAGE = 20;
export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
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

export function Toolbar({ onAdd, search, setSearch, addLabel }: {
  onAdd?: () => void; search: string; setSearch: (v: string) => void; addLabel?: string;
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
      {onAdd && (
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-3 py-2 rounded-lg transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" /> {addLabel}
        </button>
      )}
    </div>
  );
}

export function DeleteBtn({ onClick }: { onClick: () => void }) {
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

export function EditBtn({ onClick }: { onClick: () => void }) {
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

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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

export function ModalActions({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-200">
      <button onClick={onCancel} className="px-4 py-2 rounded-lg text-xs font-black text-gray-500 hover:text-gray-900 border border-gray-200 cursor-pointer transition-all">キャンセル</button>
      <button onClick={onSave} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-all">
        <Save className="w-3.5 h-3.5" /> 保存
      </button>
    </div>
  );
}
