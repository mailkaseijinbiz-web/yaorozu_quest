'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Sparkles, Settings2, Check, AlertTriangle, ShieldCheck, Palette, Cpu } from 'lucide-react';
import { Spot, Agent, User, db } from '../lib/db';

interface CreatorTabProps {
  activeSpot: Spot | null;
  agent: Agent | null;
  currentUser: User;
  onUpdateAgent: (updated: Agent) => void;
  userTokuAtSpot: number;
  currentCreatorToku: number;
}

const ACCESSORY_OPTIONS = ['なし', '鏡', '剣', '扇子'];
const VOICE_TONE_OPTIONS: ('厳格' | '親しみやすい' | '神秘的' | '高飛車' | '賢者')[] = [
  '厳格',
  '親しみやすい',
  '神秘的',
  '高飛車',
  '賢者',
];

const HALO_COLORS = [
  { name: '太陽 (ゴールド)', hex: '#FFD700' },
  { name: '稲荷 (朱色)', hex: '#FF4500' },
  { name: '翡翠 (グリーン)', hex: '#32CD32' },
  { name: '清流 (シアン)', hex: '#40E0D0' },
  { name: '深海 (ブルー)', hex: '#1E90FF' },
  { name: '霊気 (パープル)', hex: '#A020F0' },
];

export default function CreatorTab({
  activeSpot,
  agent,
  currentUser,
  onUpdateAgent,
  userTokuAtSpot,
  currentCreatorToku,
}: CreatorTabProps) {
  const [name, setName] = useState('');
  const [personaDescription, setPersonaDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [haloColor, setHaloColor] = useState('');
  const [accessoryType, setAccessoryType] = useState('');
  const [voiceTone, setVoiceTone] = useState<'厳格' | '親しみやすい' | '神秘的' | '高飛車' | '賢者'>('親しみやすい');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Sync state when active spot/agent changes
  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setPersonaDescription(agent.personaDescription);
      setSystemPrompt(agent.systemPrompt);
      setHaloColor(agent.haloColor);
      setAccessoryType(agent.accessoryType);
      setVoiceTone(agent.voiceTone);
    }
  }, [agent]);

  if (!activeSpot || !agent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 glass-panel rounded-2xl border-black/5 bg-white/85">
        <Settings2 className="w-12 h-12 text-gray-300 mb-3 animate-pulse" />
        <p className="text-sm text-gray-500">
          まずはマップから神社・寺院を選択してください。
        </p>
      </div>
    );
  }

  // Check if current user is the creator of this spot
  const isCreator = activeSpot.creatorId === currentUser.id;

  const handleSave = () => {
    if (!isCreator) return;
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(false);

    try {
      // 実書き込み：localStorage を更新し、クラウド・スナップショット同期もトリガーされる。
      const updatedAgent = db.updateAgent(activeSpot.id, {
        name,
        personaDescription,
        systemPrompt,
        haloColor,
        accessoryType,
        voiceTone,
      });
      onUpdateAgent(updatedAgent);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Agent save failed:', err);
      setSaveError(true);
      setTimeout(() => setSaveError(false), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  // Locked View
  if (!isCreator) {
    // Determine how many more Toku points needed
    const requirement = activeSpot.tokuRequirement;
    const isSpotUnclaimed = activeSpot.creatorId === null;
    const targetToku = isSpotUnclaimed ? requirement : Math.max(requirement, currentCreatorToku);
    const tokuNeeded = Math.max(1, targetToku - userTokuAtSpot + 10); // user must exceed current creator to hijack

    return (
      <div className="h-full flex flex-col items-center justify-center p-6 glass-panel rounded-2xl border-black/5 bg-gradient-to-br from-gray-50 to-amber-50/20 text-center shadow-md">
        <div className="w-16 h-16 rounded-full bg-shrine-red/10 border border-shrine-red/30 flex items-center justify-center text-shrine-red mb-4 animate-pulse">
          <Lock className="w-7 h-7" />
        </div>
        
        <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-1.5 justify-center">
          創世主（Creator）権限ロック
        </h3>
        <span className="text-[10px] text-shrine-red font-bold uppercase tracking-wider mb-4 block">
          {isSpotUnclaimed ? 'スポット未創生' : '所有権なし'}
        </span>

        <p className="text-xs text-gray-600 max-w-sm leading-relaxed mb-6">
          このスポットの神様（AIエージェント）のカスタム権限は、スポットでの貢献（UGC投稿と評価）が一定水準を超えた<strong>「創世主」のみに与えられます。</strong>
        </p>

        {/* Toku Progress Card */}
        <div className="w-full max-w-sm glass-panel p-4 rounded-xl border-black/5 bg-white/80 text-xs text-left mb-6 space-y-3">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-gray-500">あなたの現在のスポット徳:</span>
            <span className="font-bold text-cyber-blue">{userTokuAtSpot} Toku</span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-gray-500">
              {isSpotUnclaimed ? '創世しきい値:' : '現在の創世主のスポット徳:'}
            </span>
            <span className="font-bold text-gold">{targetToku} Toku</span>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden border border-gray-200/50">
            <div
              className="bg-gradient-to-r from-cyber-blue to-gold h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (userTokuAtSpot / targetToku) * 100)}%`,
              }}
            />
          </div>

          <div className="bg-shrine-red/5 border border-shrine-red/15 p-3 rounded-lg text-[10px] leading-relaxed text-gray-600 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-shrine-red flex-shrink-0" />
            <div>
              あと <strong className="text-gray-900">{tokuNeeded} Toku</strong> 獲得すると、
              {isSpotUnclaimed ? '創世主へ就任' : '現在の創世主から所有権を強奪'} できます！
              UGCを投稿するか、他の人の役に立つ投稿をして「いいね」を集めましょう。
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Unlocked Customizer View
  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto pr-1">
      {/* Creator Header */}
      <div className="flex items-center justify-between border-b border-black/5 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-gold" />
          <div>
            <h2 className="text-lg font-bold text-gray-805 text-gray-900 leading-tight">神霊カスタマイザー</h2>
            <p className="text-[10px] text-gray-500">
              創世主権限: あなたはこのスポットの神様をリデザインできます。
            </p>
          </div>
        </div>
        <span className="bg-gold/10 border border-gold/40 text-gold text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
          <Sparkles className="w-3 h-3" />
          創世主モード
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left column: Personality Configuration */}
        <div className="space-y-4">
          <div className="glass-panel p-4 rounded-xl border-black/5 bg-white/80 space-y-3.5">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyber-blue" />
              人格・LLMプロンプト設定
            </h3>

            {/* God Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-600 block font-bold">神霊名 (Name)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-gray-250 rounded-lg px-3 py-2 text-xs text-gray-805 text-gray-800 focus:outline-none focus:border-gold transition-all"
                placeholder="例: 金龍の神"
              />
            </div>

            {/* Persona description */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-600 block font-bold">
                簡単なプロフィール (Persona Summary)
              </label>
              <input
                type="text"
                value={personaDescription}
                onChange={(e) => setPersonaDescription(e.target.value)}
                className="w-full bg-white border border-gray-250 rounded-lg px-3 py-2 text-xs text-gray-850 text-gray-800 focus:outline-none focus:border-gold transition-all"
                placeholder="例: 浅草を守る黄金の龍神。威勢が良い。"
              />
            </div>

            {/* System prompt */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-600 block font-bold">
                自律AIシステムプロンプト (System Prompt)
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={5}
                className="w-full bg-white border border-gray-250 rounded-lg p-3 text-xs text-gray-850 text-gray-800 focus:outline-none focus:border-gold transition-all leading-relaxed"
                placeholder="AIエージェントの口調や性格、応答ルールを入力します..."
              />
              <span className="text-[9px] text-gray-400 block text-right">
                ※アフィリエイトリンクはコンテキストに基づいて自動挿入されます。
              </span>
            </div>
          </div>
        </div>

        {/* Right column: Audio & Visual Style */}
        <div className="space-y-4">
          <div className="glass-panel p-4 rounded-xl border-black/5 bg-white/80 space-y-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-gold" />
              ビジュアル ＆ 音声トーン設定
            </h3>

            {/* Halo color selector */}
            <div className="space-y-2">
              <label className="text-[10px] text-gray-600 block font-bold">神光 of 色彩 (Halo / Aura Color)</label>
              <div className="grid grid-cols-3 gap-2">
                {HALO_COLORS.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setHaloColor(color.hex)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold text-left transition-all cursor-pointer ${
                      haloColor === color.hex
                        ? 'bg-amber-50 border-amber-400 text-gray-800 font-black shadow-sm'
                        : 'bg-white border-gray-250 text-gray-500 hover:border-gray-450 hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="truncate">{color.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Accessory selection */}
            <div className="space-y-2">
              <label className="text-[10px] text-gray-600 block font-bold">装飾品アセット (AR Accessory)</label>
              <div className="grid grid-cols-4 gap-2">
                {ACCESSORY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAccessoryType(opt)}
                    className={`px-3 py-2 rounded-lg border text-xs font-bold text-center transition-all cursor-pointer ${
                      accessoryType === opt
                        ? 'bg-gold/15 border-gold text-amber-950 font-bold shadow-sm'
                        : 'bg-white border-gray-250 text-gray-500 hover:border-gray-450 hover:bg-gray-50'
                    }`}
                  >
                    {opt === '鏡' ? '🪞 鏡' : opt === '剣' ? '⚔️ 剣' : opt === '扇子' ? '🪭 扇子' : 'なし'}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice presets */}
            <div className="space-y-2">
              <label className="text-[10px] text-gray-600 block font-bold">音声トーン・タイプ (Voice Presets)</label>
              <div className="grid grid-cols-2 gap-2">
                {VOICE_TONE_OPTIONS.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => setVoiceTone(tone)}
                    className={`px-3 py-2 rounded-lg border text-[10px] font-bold transition-all text-center cursor-pointer ${
                      voiceTone === tone
                        ? 'bg-cyber-blue/10 border-cyber-blue text-cyber-blue font-bold shadow-sm'
                        : 'bg-white border-gray-250 text-gray-500 hover:border-gray-450 hover:bg-gray-50'
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action panel */}
      <div className="border-t border-black/5 pt-4 flex justify-end gap-3 items-center">
        {saveSuccess && (
          <span className="text-cyber-green text-xs font-bold flex items-center gap-1 animate-pulse">
            <Check className="w-4 h-4" />
            設定が八百万データベースに反映されました！
          </span>
        )}
        {saveError && (
          <span className="text-shrine-red text-xs font-bold flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            保存に失敗しました。時間をおいて再度お試しください。
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-gold hover:bg-gold-light text-amber-950 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-md shadow-gold/25 cursor-pointer disabled:opacity-50"
        >
          <Settings2 className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
          {isSaving ? '設定を書き込み中...' : '神霊設定を更新'}
        </button>
      </div>
    </div>
  );
}
