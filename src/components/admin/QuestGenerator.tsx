'use client';

import { useState } from 'react';
import { Wand2, Loader2, Check, Save, MapPin } from 'lucide-react';
import { Spot } from '../../lib/db';
import type { GeneratedQuest } from '../../app/api/generate-quest/route';
import { Card, Field, inputCls, DeleteBtn } from './ui';

const USER_QUESTS_KEY = 'yaorozu_user_quests';

// ════════════════════════════════════════════════
// AI Quest Generator
// ════════════════════════════════════════════════
interface DraftQuest extends GeneratedQuest { _key: string; }

export function QuestGenerator({ spots }: { spots: Spot[] }) {
  const [spotId, setSpotId] = useState<string>(spots[0]?.id ?? '');
  const [count, setCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState<'openai' | 'fallback' | null>(null);
  const [drafts, setDrafts] = useState<DraftQuest[]>([]);
  const [publishedCount, setPublishedCount] = useState(0);

  const spot = spots.find(s => s.id === spotId);

  const handleGenerate = async () => {
    if (!spot) { setError('スポットを選択してください。'); return; }
    setLoading(true);
    setError('');
    setSource(null);
    setPublishedCount(0);
    try {
      const res = await fetch('/api/generate-quest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count,
          spot: {
            name: spot.name, category: spot.category,
            description: spot.description, enjoyments: spot.enjoyments,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.quests) throw new Error(data.error || '生成に失敗しました。');
      setSource(data.source ?? null);
      setDrafts(data.quests.map((q: GeneratedQuest, i: number) => ({ ...q, _key: `${Date.now()}-${i}` })));
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = (key: string, patch: Partial<DraftQuest>) =>
    setDrafts(ds => ds.map(d => d._key === key ? { ...d, ...patch } : d));

  const removeDraft = (key: string) => setDrafts(ds => ds.filter(d => d._key !== key));

  const handlePublish = () => {
    if (drafts.length === 0) return;
    const existing = JSON.parse(localStorage.getItem(USER_QUESTS_KEY) || '[]');
    const newQuests = drafts.map((d, i) => ({
      id: `uq-ai-${Date.now()}-${i}`,
      creatorId: 'ai-oracle',
      creatorName: 'AI神官（自動生成）',
      title: d.title,
      description: d.description,
      reward: d.reward,
      targetSpotName: d.targetSpotName,
      createdAt: new Date().toISOString(),
      completedBy: [],
    }));
    localStorage.setItem(USER_QUESTS_KEY, JSON.stringify([...newQuests, ...existing]));
    setPublishedCount(drafts.length);
    setDrafts([]);
  };

  return (
    <div className="space-y-4">
      {/* 生成コントロール */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-black text-gray-900">AIクエスト自動生成</h2>
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          スポット情報をもとにAIが街歩きクエストを生成します。確認・編集してから公開すると、ユーザーアプリの「コミュニティクエスト」に追加されます。
        </p>
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <Field label="対象スポット">
            <select className={inputCls} value={spotId} onChange={e => setSpotId(e.target.value)}>
              {spots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="生成数">
            <select className={inputCls} value={count} onChange={e => setCount(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}個</option>)}
            </select>
          </Field>
          <button
            onClick={handleGenerate}
            disabled={loading || !spot}
            className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black px-4 py-2 rounded-lg transition-all cursor-pointer h-[34px]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {loading ? '生成中…' : 'AIで生成'}
          </button>
        </div>
        {error && <p className="text-[11px] text-red-500 font-bold">{error}</p>}
        {source && (
          <p className="text-[10px] text-gray-400">
            生成エンジン: {source === 'openai' ? 'OpenAI' : 'ルールベース（APIキー未設定のためフォールバック）'}
          </p>
        )}
        {publishedCount > 0 && (
          <p className="text-[11px] text-green-600 font-bold flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> {publishedCount}件のクエストを公開しました。
          </p>
        )}
      </div>

      {/* 生成結果（ドラフト） */}
      {drafts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider">生成結果（{drafts.length}件・編集可）</h3>
            <button
              onClick={handlePublish}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-4 py-2 rounded-lg transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> すべて公開
            </button>
          </div>
          {drafts.map(d => (
            <Card key={d._key}>
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <input
                    className={`${inputCls} font-bold`}
                    value={d.title}
                    onChange={e => updateDraft(d._key, { title: e.target.value })}
                  />
                  <textarea
                    className={inputCls}
                    rows={2}
                    value={d.description}
                    onChange={e => updateDraft(d._key, { description: e.target.value })}
                  />
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] text-gray-500 font-bold">報酬</label>
                    <select
                      className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-900 focus:outline-none focus:border-blue-500"
                      value={d.reward}
                      onChange={e => updateDraft(d._key, { reward: Number(e.target.value) })}
                    >
                      {[10, 20, 30, 50, 80, 100].map(v => <option key={v} value={v}>+{v} 徳</option>)}
                    </select>
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" /> {d.targetSpotName}
                    </span>
                  </div>
                </div>
                <DeleteBtn onClick={() => removeDraft(d._key)} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
