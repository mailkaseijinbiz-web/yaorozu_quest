'use client';

import { useState } from 'react';
import { Brain } from 'lucide-react';
import { Card, Field, inputCls, PER_PAGE, Pager, Modal, ModalActions } from './ui';
import { RulesPanel } from './RulesPanel';
import { db, Spot, Agent } from '../../lib/db';
import { resolveTaskTypes, TASK_CATALOG, COMMON_TASK_TYPES, type GodTaskType } from '../../data/god-tasks';
import { buildIdentityMd, buildSoulMd } from '../../lib/place-docs';
import { buildDainichiIdentityMd } from '../../lib/dainichi';

// 八百万神 — スポットごとの「神の知性」を管理する。
//   基底クラス=大日如来（全神共通の行動定義）／各神=人格・頭脳・知識(Identity/Soul)・権能。
//   Identity.md / Soul.md は神(Agent)に格納する。

const VOICE_TONES: Agent['voiceTone'][] = ['厳格', '親しみやすい', '神秘的', '高飛車', '賢者'];

function defaultBrain(spot: Spot, godName: string): string {
  return `あなたは「${spot.name}」(${spot.category})に宿る神霊「${godName}」です。大日如来の働きの分身として、(1)場所の価値を増幅し (2)場所や人間の課題を解決し (3)人間に試練を与えます。${spot.description} 親しみやすくも神々しい口調で案内し、近くのクエストや依頼を前向きに勧めてください。返答は150字以内。`;
}

function godLevel(agent: Agent | undefined, taskN: number, ugcN: number, photoN: number): number {
  let lv = 1;
  if (agent && agent.systemPrompt.trim()) lv++;       // 頭脳カスタム
  if (agent && (agent.identityMd || agent.soulMd)) lv++; // 知識カスタム
  if (taskN > 0) lv++;                                  // 権能設定
  if (photoN + ugcN > 0) lv++;                          // 蓄積あり
  return lv;
}

type EditState = {
  spot: Spot;
  godName: string;
  godEmoji: string;
  voiceTone: Agent['voiceTone'];
  persona: string;
  brain: string;
  identityMd: string;
  soulMd: string;
  docTab: 'identity' | 'soul';
  taskTypes: GodTaskType[];
};

export function YaorozuGods({ spots, onChange }: { spots: Spot[]; onChange: () => void }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<EditState | null>(null);

  // 大日如来 = 神の生成ルール（全神の基底）。クエストタブと同じ構成でインライン編集。
  const [godRules, setGodRules] = useState(() => db.getDainichiIdentity() ?? buildDainichiIdentityMd());
  const [godRulesSaved, setGodRulesSaved] = useState(false);

  const filtered = spots.filter((s) => (s.godName || '').includes(search) || s.name.includes(search) || s.category.includes(search));
  const pageItems = filtered.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  const openGod = (s: Spot) => {
    const ag = db.getAgentBySpot(s.id);
    const godName = s.godName || ag?.name || `${s.name}の守り神`;
    setEditing({
      spot: s,
      godName,
      godEmoji: s.godEmoji || (s.category === '神社' ? '⛩️' : '🙏'),
      voiceTone: ag?.voiceTone || '神秘的',
      persona: ag?.personaDescription || `${s.name}に宿る八百万の神。`,
      brain: ag?.systemPrompt || defaultBrain(s, godName),
      identityMd: ag?.identityMd ?? buildIdentityMd(s),
      soulMd: ag?.soulMd ?? buildSoulMd(s, ag),
      docTab: 'identity',
      taskTypes: (s.taskTypes && s.taskTypes.length > 0) ? s.taskTypes.filter((t): t is GodTaskType => t in TASK_CATALOG) : [],
    });
  };

  const genBrain = () => editing && setEditing({ ...editing, brain: defaultBrain(editing.spot, editing.godName) });
  const regenDoc = () => {
    if (!editing) return;
    if (editing.docTab === 'identity') setEditing({ ...editing, identityMd: buildIdentityMd(editing.spot) });
    else setEditing({ ...editing, soulMd: buildSoulMd(editing.spot, db.getAgentBySpot(editing.spot.id)) });
  };

  const saveGod = () => {
    if (!editing) return;
    const ag = db.getAgentBySpot(editing.spot.id);
    const agent: Agent = {
      id: ag?.id || `agent-${editing.spot.id}`,
      spotId: editing.spot.id,
      name: editing.godName,
      personaDescription: editing.persona,
      systemPrompt: editing.brain,
      avatar3dUrl: ag?.avatar3dUrl || 'shrine',
      haloColor: ag?.haloColor || '#c5a028',
      accessoryType: ag?.accessoryType || 'なし',
      voiceTone: editing.voiceTone,
      identityMd: editing.identityMd,
      soulMd: editing.soulMd,
    };
    db.adminSaveAgent(agent);
    db.adminSaveSpot({ ...editing.spot, godName: editing.godName, godEmoji: editing.godEmoji, taskTypes: editing.taskTypes });
    onChange();
    setEditing(null);
  };

  return (
    <div>
      {/* 神の生成ルール（大日如来）— クエストタブと同じ構成のインライン編集 */}
      <div className="mb-3">
        <RulesPanel
          title="神の生成ルール（大日如来 / 全神の基底）"
          description={<>大日如来は全ての八百万神の基底。ここに書いたルールに基づき、各神の人格・口調・知性が生成・継承されます。生成AIでの一括更新は「God」タブの Update から。</>}
          value={godRules}
          onChange={(v) => { setGodRules(v); setGodRulesSaved(false); }}
          onSave={() => { db.saveDainichiIdentity(godRules); setGodRulesSaved(true); }}
          onReset={() => { setGodRules(buildDainichiIdentityMd()); setGodRulesSaved(false); }}
          saved={godRulesSaved}
        />
      </div>

      <input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        className="w-full max-w-xs bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-blue-500 mb-2"
        placeholder="神名・場所・カテゴリで検索…"
      />
      <p className="text-[11px] text-gray-400 mb-2">全 {filtered.length} 柱（八百万神は大日如来を継承。Identity.md/Soul.md は各神に格納）</p>

      <div className="grid gap-2">
        {pageItems.map((s) => {
          const ag = db.getAgentBySpot(s.id);
          const ugcN = db.getUgcBySpot(s.id).length;
          const photoN = s.photos?.length ?? 0;
          const taskN = resolveTaskTypes(s).length;
          const lv = godLevel(ag, taskN, ugcN, photoN);
          const brainCustom = !!(ag && ag.systemPrompt.trim());
          const knowledgeCustom = !!(ag && (ag.identityMd || ag.soulMd));
          const tone = ag?.voiceTone || '神秘的';
          const spotQuests = db.getQuestsForSpot(s.id); // この神が所持するクエスト（複数）
          return (
            <Card key={s.id}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 flex items-center justify-center text-2xl shrink-0">{s.godEmoji || '⛩️'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-gray-900 truncate">{s.godName || `${s.name}の守り神`}</span>
                    <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full shrink-0" title="知性の充実度">神格 {lv}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 truncate">{s.name}・{s.category}</p>
                  <div className="flex items-center gap-1 mt-1 flex-wrap text-[10px] font-bold">
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">口調 {tone}</span>
                    <span className={`px-1.5 py-0.5 rounded ${brainCustom ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>頭脳 {brainCustom ? 'カスタム' : '既定'}</span>
                    <span className={`px-1.5 py-0.5 rounded ${knowledgeCustom ? 'bg-violet-50 text-violet-600' : 'bg-gray-100 text-gray-400'}`}>知識 {knowledgeCustom ? '編集済' : '自動'}</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">権能 {taskN}</span>
                    <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">クエスト {spotQuests.length}</span>
                  </div>
                  {spotQuests.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {spotQuests.slice(0, 4).map((q) => (
                        <span key={q.id} title={q.title} className="text-[9px] bg-orange-50 text-orange-700 border border-orange-100 px-1.5 py-0.5 rounded-full truncate max-w-[160px]">🚩 {q.title}</span>
                      ))}
                      {spotQuests.length > 4 && <span className="text-[9px] text-gray-400 self-center">+{spotQuests.length - 4}</span>}
                    </div>
                  )}
                </div>
                <button onClick={() => openGod(s)} className="shrink-0 flex items-center gap-1 text-[12px] font-black text-white bg-indigo-600 px-3 py-2 rounded-lg hover:opacity-90 transition-all cursor-pointer">
                  <Brain className="w-3.5 h-3.5" />知性を調整
                </button>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-xs text-gray-400 py-8">該当する神がいません。</p>}
      </div>
      <Pager page={page} total={filtered.length} onPage={setPage} />


      {/* 神の知性エディタ */}
      {editing && (
        <Modal title={`✨ ${editing.godName} の知性`} onClose={() => setEditing(null)}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="神名"><input className={inputCls} value={editing.godName} onChange={(e) => setEditing({ ...editing, godName: e.target.value })} /></Field>
            <Field label="化身（絵文字）"><input className={inputCls} value={editing.godEmoji} onChange={(e) => setEditing({ ...editing, godEmoji: e.target.value })} /></Field>
            <Field label="口調（voiceTone）">
              <select className={inputCls} value={editing.voiceTone} onChange={(e) => setEditing({ ...editing, voiceTone: e.target.value as Agent['voiceTone'] })}>
                {VOICE_TONES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="人格（性格・由緒）" full><textarea className={inputCls} rows={2} value={editing.persona} onChange={(e) => setEditing({ ...editing, persona: e.target.value })} /></Field>
            <Field label="🧠 頭脳（システムプロンプト＝AIの知性）" full>
              <textarea className={inputCls + ' font-mono'} rows={4} value={editing.brain} onChange={(e) => setEditing({ ...editing, brain: e.target.value })} />
              <button onClick={genBrain} type="button" className="mt-1 text-[11px] font-black text-indigo-600 hover:underline cursor-pointer">↻ 大日如来＋この場所のデータから生成</button>
            </Field>
          </div>
          {/* 神のタスク（この神が依頼できる種別） */}
          <div className="mt-2">
            <Field label="神のタスク（この神が依頼できる種別）" full>
              {(() => {
                const current: GodTaskType[] = editing.taskTypes.length > 0 ? editing.taskTypes : resolveTaskTypes(editing.spot);
                const isDefault = editing.taskTypes.length === 0;
                const toggle = (type: GodTaskType) => {
                  const set = new Set(current);
                  if (set.has(type)) set.delete(type); else set.add(type);
                  setEditing({ ...editing, taskTypes: Array.from(set) });
                };
                return (
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(TASK_CATALOG) as GodTaskType[]).map((type) => {
                        const t = TASK_CATALOG[type];
                        const on = current.includes(type);
                        const common = COMMON_TASK_TYPES.includes(type);
                        return (
                          <button key={type} type="button" onClick={() => toggle(type)}
                            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`}
                            title={t.title}>
                            {t.icon} {t.label}{common ? '' : ' ★'}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      {isDefault ? 'カテゴリ標準を表示中（クリックで上書き設定）。★はカテゴリ別タスク。' : `この神専用に ${current.length} 種を設定中。`}
                    </p>
                  </div>
                );
              })()}
            </Field>
          </div>
          {/* 📚 知識（Identity.md / Soul.md を神に格納） */}
          <div className="mt-2">
            <div className="flex gap-1.5 mb-1.5">
              {([['identity', 'Identity.md'], ['soul', 'Soul.md']] as const).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setEditing({ ...editing, docTab: k })}
                  className={`text-[12px] font-black px-3 py-1.5 rounded-lg border cursor-pointer ${editing.docTab === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  📚 {label}
                </button>
              ))}
              <button type="button" onClick={regenDoc} className="ml-auto text-[11px] font-black text-indigo-600 hover:underline cursor-pointer self-center">↻ 再生成</button>
            </div>
            <textarea
              className={inputCls + ' font-mono'}
              rows={8}
              value={editing.docTab === 'identity' ? editing.identityMd : editing.soulMd}
              onChange={(e) => setEditing(editing.docTab === 'identity' ? { ...editing, identityMd: e.target.value } : { ...editing, soulMd: e.target.value })}
            />
          </div>
          <ModalActions onCancel={() => setEditing(null)} onSave={saveGod} />
        </Modal>
      )}
    </div>
  );
}
