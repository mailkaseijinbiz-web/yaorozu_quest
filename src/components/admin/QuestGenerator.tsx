'use client';

import { useState } from 'react';
import { Wand2, Loader2, Check, Save } from 'lucide-react';
import { Spot, db } from '../../lib/db';
import { buildDainichiIdentityMd } from '../../lib/dainichi';
import { TASK_TONE, type Quest, type TaskKind } from '../../data/tasks';
import { Card, Field, inputCls, DeleteBtn } from './ui';

// ════════════════════════════════════════════════
// AI Quest Generator — 場の 価値・課題・魂 からクエスト（=タスクの集まり）を生成
// ════════════════════════════════════════════════
const KIND_LABEL: Record<TaskKind, string> = { sense: '情報収集', understand: '理解判断', act: '操作' };
const SOURCE_LABEL: Record<string, string> = { gemini: 'Gemini', openai: 'OpenAI', fallback: 'ルールベース（フォールバック）' };

interface DraftQuest extends Quest {
  _key: string;
}

export function QuestGenerator({ spots }: { spots: Spot[] }) {
  const [spotId, setSpotId] = useState<string>(spots[0]?.id ?? '');
  const [count, setCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftQuest[]>([]);
  const [publishedCount, setPublishedCount] = useState(0);

  const spot = spots.find((s) => s.id === spotId);

  const handleGenerate = async () => {
    if (!spot) { setError('場を選択してください。'); return; }
    setLoading(true);
    setError('');
    setSource(null);
    setPublishedCount(0);
    try {
      const agent = db.getAgentBySpot(spot.id);
      const res = await fetch('/api/generate-quest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count,
          ts: Date.now(),
          rules: db.getQuestRules(),
          godRules: db.getDainichiIdentity() ?? buildDainichiIdentityMd(), // 大日如来＝全神の基底
          spotRules: db.getSpotRules(), // 場の生成ルール（背景文脈）
          spot: {
            id: spot.id,
            name: spot.name,
            category: spot.category,
            description: spot.description,
            enjoyments: spot.enjoyments,
            issues: spot.issues,
            soulMd: agent?.soulMd,
            latitude: spot.latitude,
            longitude: spot.longitude,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.quests) throw new Error(data.error || '生成に失敗しました。');
      setSource(data.source ?? null);
      setDrafts((data.quests as Quest[]).map((q, i) => ({ ...q, _key: `${q.id}-${i}` })));
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = (key: string, patch: Partial<Quest>) =>
    setDrafts((ds) => ds.map((d) => (d._key === key ? { ...d, ...patch } : d)));

  const removeDraft = (key: string) => setDrafts((ds) => ds.filter((d) => d._key !== key));

  const handlePublish = () => {
    if (!spot || drafts.length === 0) return;
    const quests: Quest[] = drafts.map((d) => {
      const q = { ...d } as Partial<DraftQuest>;
      delete q._key;
      return q as Quest;
    });
    db.saveGeneratedQuests(spot.id, quests);
    setPublishedCount(drafts.length);
    setDrafts([]);
  };

  return (
    <div className="space-y-4">
      {/* 生成コントロール */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-black text-gray-900">クエスト生成（価値・課題・魂から）</h2>
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          場の<b>価値（楽しみ方）・課題・神の魂</b>をもとに、AIが「情報収集・理解判断・操作」の3種タスクで構成されたクエストを生成します。
          確認・編集して公開すると、プレイヤーアプリのクエスト一覧とこの場の詳細に追加されます。
        </p>
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <Field label="対象の場">
            <select className={inputCls} value={spotId} onChange={(e) => setSpotId(e.target.value)}>
              {spots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="生成数">
            <select className={inputCls} value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}個</option>)}
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
        {spot && (
          <p className="text-[10px] text-gray-400">
            価値 {spot.enjoyments?.length ?? 0}件 ・ 課題 {spot.issues?.length ?? 0}件 ・ 魂 {db.getAgentBySpot(spot.id)?.soulMd ? 'あり' : 'なし'}
          </p>
        )}
        {error && <p className="text-[11px] text-red-500 font-bold">{error}</p>}
        {source && <p className="text-[10px] text-gray-400">生成エンジン: {SOURCE_LABEL[source] ?? source}</p>}
        {publishedCount > 0 && (
          <p className="text-[11px] text-green-600 font-bold flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> {publishedCount}件のクエストを公開しました（プレイヤーに反映済み）。
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
          {drafts.map((d) => (
            <Card key={d._key}>
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <input
                    className={`${inputCls} font-bold`}
                    value={d.title}
                    onChange={(e) => updateDraft(d._key, { title: e.target.value })}
                  />
                  <textarea
                    className={inputCls}
                    rows={2}
                    value={d.description}
                    onChange={(e) => updateDraft(d._key, { description: e.target.value })}
                  />
                  {/* タスク（3種の働き） */}
                  <div className="flex flex-wrap gap-1.5">
                    {d.tasks.map((t) => {
                      const tone = TASK_TONE[t.type];
                      return (
                        <span key={t.id} className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${tone.bg} ${tone.text} ${tone.border}`} title={t.action}>
                          {t.icon} {t.title} <span className="opacity-60">+{t.reward}徳・{KIND_LABEL[t.kind]}</span>
                        </span>
                      );
                    })}
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
