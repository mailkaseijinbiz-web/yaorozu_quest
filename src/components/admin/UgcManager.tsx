'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Card, DeleteBtn } from './ui';
import { db, Spot, UgcPost } from '../../lib/db';

export function UgcManager({ ugc, spots, onChange }: { ugc: UgcPost[]; spots: Spot[]; onChange: () => void }) {
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
