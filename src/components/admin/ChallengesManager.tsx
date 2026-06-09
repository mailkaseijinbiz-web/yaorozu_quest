'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Card, PER_PAGE, Pager } from './ui';
import { difficultyLabel } from '../../data/challenges';
import { db, DEFAULT_QUEST_RULES } from '../../lib/db';
import { RulesPanel } from './RulesPanel';

// ════════════════════════════════════════════════
// Challenges Manager（どんなチャレンジがあるか管理・閲覧）
// ════════════════════════════════════════════════
export function ChallengesManager() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [rules, setRules] = useState(() => db.getQuestRules());
  const [saved, setSaved] = useState(false);
  // 生成クエストを含む全クエスト（静的 CHALLENGES は現在空のため、実体は生成クエスト）
  const allQuests = db.getAllQuests();
  const all = allQuests.filter(c => c.title.includes(q) || c.goalName.includes(q) || c.badgeName.includes(q));
  const list = all.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  return (
    <div className="space-y-3">
      {/* クエスト生成ルール（生成方針） */}
      <RulesPanel
        title="クエスト生成ルール（生成方針）"
        description={<>ここに書いたルールは、<b>新しくクエストを生成する際の方針</b>として使われます。クエストはタスクから構成され、タスクは<b className="text-emerald-600">場の価値を増幅</b>し<b className="text-rose-600">場の課題を解決</b>します。タスクの3種と例も下記の md 本文に含まれます。生成AIでの一括更新は「God」タブの Update から。</>}
        value={rules}
        onChange={(v) => { setRules(v); setSaved(false); }}
        onSave={() => { db.saveQuestRules(rules); setSaved(true); }}
        onReset={() => { setRules(DEFAULT_QUEST_RULES); setSaved(false); }}
        saved={saved}
      />

      <p className="text-xs text-gray-500">登録済みのクエスト（街歩きミッション）一覧。現在 <span className="font-black text-blue-600">{allQuests.length}</span> 件。難易度・ステップ・蘊蓄・ゴールを確認できます。</p>
      <div className="relative max-w-xs">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-blue-500" placeholder="検索…" />
      </div>
      {list.map((ch) => {
        const diff = difficultyLabel(ch.difficulty);
        return (
          <Card key={ch.id}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-xl shrink-0">{ch.badgeIcon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-gray-900">{ch.title}</span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">{diff.stars} {diff.label}</span>
                  <span className="text-[10px] text-gray-500">バッジ: {ch.badgeName}</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">{ch.description}</p>
                <p className="text-[10px] text-gray-400 mt-1">🚩 ゴール: {ch.goalName} ・ {ch.tasks.length}ステップ</p>
                <div className="mt-2 space-y-1">
                  {ch.tasks.map((st, i) => (
                    <div key={st.id} className="text-[11px] text-gray-600 flex items-start gap-1.5">
                      <span className="font-black text-blue-600">{i + 1}.</span>
                      <span>{st.title}{st.photo ? '（📸写真）' : ''}{st.triviaCategory ? ` ［${st.triviaCategory}の蘊蓄］` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
      <Pager page={page} total={all.length} onPage={setPage} />
    </div>
  );
}
