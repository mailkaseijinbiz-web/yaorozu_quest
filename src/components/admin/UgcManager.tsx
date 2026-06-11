'use client';

// UGC（巡礼者の投稿）一覧 — 管理画面で閲覧する。
import { useState, useEffect } from 'react';
import { db, Spot, UgcPost } from '../../lib/db';
import { PER_PAGE, Pager } from './ui';

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'たった今';
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

export function UgcManager({ spots }: { spots: Spot[] }) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<'all' | 'photo' | 'self'>('all');
  const [posts, setPosts] = useState<UgcPost[]>(() => db.getUgc());

  // リアルタイム同期（同タブのカスタムイベント＋別タブの storage イベント）
  useEffect(() => {
    const refresh = () => setPosts(db.getUgc());
    window.addEventListener('yaorozu:activity', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('yaorozu:activity', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const spotName = (id: string) => spots.find((s) => s.id === id)?.name ?? id;
  const sorted = [...posts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const filtered = sorted.filter((p) =>
    filter === 'all' ? true : filter === 'photo' ? !!p.imageUrl : (p.visibility ?? 'all') === 'self'
  );
  const pageItems = filtered.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  const FILTERS = [
    { k: 'all', label: 'すべて' },
    { k: 'photo', label: '写真つき' },
    { k: 'self', label: 'あなただけ' },
  ] as const;

  return (
    <div>
      <p className="text-[12px] text-gray-500 mb-2">巡礼者の投稿（UGC）— 口コミ・気づき・写真などを閲覧する。</p>
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.k}
            onClick={() => { setFilter(f.k); setPage(0); }}
            className={`text-[12px] font-black px-3 py-1.5 rounded-full border transition-all cursor-pointer ${filter === f.k ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200 hover:border-violet-400'}`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-gray-400">全 {filtered.length} 件</span>
      </div>

      {pageItems.length === 0 ? (
        <p className="text-center text-xs text-gray-400 py-10">まだ投稿がありません。<br />アプリで口コミや写真を投稿すると、ここに表示されます。</p>
      ) : (
        <div className="grid gap-2">
          {pageItems.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-200 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-black text-gray-900 truncate">{p.userDisplayName || p.userId}</span>
                <span className="text-[11px] text-gray-400 truncate">「{spotName(p.spotId)}」</span>
                {(p.visibility ?? 'all') === 'self' && <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">あなただけ</span>}
                <span className="ml-auto text-[10px] text-gray-400 shrink-0">{timeAgo(p.createdAt)}</span>
              </div>
              {p.content && <p className="text-[13px] text-gray-700 whitespace-pre-wrap break-words">{p.content}</p>}
              {p.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="投稿写真" className="mt-2 w-28 h-28 rounded-xl object-cover border border-gray-100" />
              )}
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                <span>❤️ {p.likesCount}</span>
                <span className="truncate">{p.id}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pager page={page} total={filtered.length} onPage={setPage} />
    </div>
  );
}
