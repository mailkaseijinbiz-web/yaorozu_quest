'use client';

// 初回起動の3ステップ・オンボーディング
// -----------------------------------------------------------------------------
//   step 0: 世界観 — 狐の精霊がタイプライターでアプリの楽しみ方を3行で語る
//   step 1: 名前 — 巡礼者登録（OAuth / ゲスト名入力。旧オンボーディングのカードを踏襲）
//   step 2: 位置情報 — 「近くの神様を探すため」という文脈を添えてから OS ダイアログを出す
// OS の位置情報許可をいきなり出さない（watchPosition は page.tsx 側で needsOnboard 中は
// 起動しない）。「あとで」を必ず併設し、拒否しても東京を仮の現在地に遊べる。
// -----------------------------------------------------------------------------

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, ChevronRight, Flag } from 'lucide-react';
import { isAuthConfigured, signInWithProvider } from '../lib/supabase-browser';

interface OnboardingFlowProps {
  initialName: string;
  geoStatus: 'locating' | 'ok' | 'denied' | 'error';
  /** OS の位置情報許可を要求する（page.tsx の requestLocation） */
  onRequestLocation: () => void;
  /** 登録を確定して本編へ。requestedLocation=false は「あとで」スキップ */
  onComplete: (name: string, opts: { requestedLocation: boolean }) => void;
}

const STORY_LINES = [
  '⛩️ あなたの街の神社仏閣には、八百万の神々が宿っておる。',
  '🎯 神に会いに行き、依頼をこなして「徳」を積むのじゃ。',
  '🔴 御朱印やバッジを集めれば、いつもの街歩きが小さな巡礼の旅になる。',
];
// コードポイント単位で1文字ずつ表示する（String.slice だと絵文字のサロゲートペアが分断され「�」が出る）
const STORY_CHARS = STORY_LINES.map((l) => Array.from(l));
const TOTAL_CHARS = STORY_CHARS.reduce((a, l) => a + l.length, 0);

export default function OnboardingFlow({ initialName, geoStatus, onRequestLocation, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);
  // step 0: タイプライターの進行（全行の合計文字数で管理。タップで全文表示）
  const [progress, setProgress] = useState(0);
  const storyDone = progress >= TOTAL_CHARS;
  // step 2: 許可ボタンを押したか（押してから geoStatus の確定を待つ）
  const [asked, setAsked] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => {
        if (p >= TOTAL_CHARS) { clearInterval(t); return p; }
        return p + 1;
      });
    }, 30);
    return () => clearInterval(t);
  }, []);

  // 位置情報の結果（許可/拒否/失敗）が出たら登録を確定して本編へ
  useEffect(() => {
    if (!asked || completedRef.current) return;
    if (geoStatus === 'ok' || geoStatus === 'denied' || geoStatus === 'error') {
      completedRef.current = true;
      onComplete(name, { requestedLocation: true });
    }
  }, [asked, geoStatus, name, onComplete]);

  const skipLocation = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete(name, { requestedLocation: false });
  };

  // タイプライター表示：行ごとに progress を消費して部分文字列を返す
  const visibleLines: string[] = [];
  let remaining = progress;
  for (const chars of STORY_CHARS) {
    if (remaining <= 0) break;
    visibleLines.push(chars.slice(0, remaining).join(''));
    remaining -= chars.length;
  }

  const avatarUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(name.trim() || 'あなた')}`;

  return (
    <div className="flex-1 min-h-dvh bg-[#eaecef] flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-xs w-full text-center">
        {/* ロゴ＋ステップドット */}
        <div className="text-2xl font-black tracking-tight leading-none mb-2">
          <span className="text-shrine-red">YAOROZU</span><span className="text-gray-900"> QUEST</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 mb-5">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-shrine-red' : 'w-1.5 bg-gray-200'}`} />
          ))}
        </div>

        {/* ── step 0: 世界観 ── */}
        {step === 0 && (
          <>
            <div className="text-left space-y-2.5 min-h-[180px] cursor-pointer" onClick={() => setProgress(TOTAL_CHARS)}>
              {visibleLines.map((line, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xl flex-shrink-0">🦊</span>
                  <p className="flex-1 bg-amber-50 border border-amber-200/60 rounded-2xl rounded-tl-none px-3 py-2 text-[13px] leading-relaxed text-gray-800 font-bold">
                    {line}
                    {i === visibleLines.length - 1 && !storyDone && <span className="animate-pulse">▍</span>}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={() => (storyDone ? setStep(1) : setProgress(TOTAL_CHARS))}
              className="w-full mt-5 bg-shrine-red text-white font-black py-3 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              {storyDone ? 'つぎへ' : '全部読む'}<ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* ── step 1: 巡礼者登録（名前 / OAuth） ── */}
        {step === 1 && (
          <>
            <p className="text-[13px] text-gray-500 mb-5">巡礼者として、名前を授かりましょう。</p>

            {isAuthConfigured() && (
              <div className="mb-5">
                <button
                  onClick={() => signInWithProvider('google')}
                  className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-800 font-black py-3 rounded-xl hover:bg-gray-50 active:scale-[0.99] transition-all cursor-pointer mb-2"
                >
                  <span className="text-base">🔵</span> Google で続ける
                </button>
                <button
                  onClick={() => signInWithProvider('apple')}
                  className="w-full flex items-center justify-center gap-2 bg-black text-white font-black py-3 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <span className="text-base"></span> Apple で続ける
                </button>
                <div className="flex items-center gap-2 my-4">
                  <span className="flex-1 h-px bg-gray-200" />
                  <span className="text-[11px] text-gray-400">または</span>
                  <span className="flex-1 h-px bg-gray-200" />
                </div>
                <p className="text-[12px] font-bold text-gray-500 mb-2">ゲストとして始める</p>
              </div>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt="アバター" className="w-24 h-24 mx-auto rounded-full border-4 border-shrine-red/30 bg-sky-50 mb-4" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) setStep(2); }}
              maxLength={12}
              autoFocus
              placeholder="巡礼者の名前"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-center text-base text-gray-900 focus:outline-none focus:border-shrine-red mb-2"
            />
            <p className="text-[11px] text-gray-400 mb-4">アバターは名前から自動生成されます（後でクエストの「アバターを撮る」で写真にできます）。</p>
            <button
              onClick={() => setStep(2)}
              disabled={!name.trim()}
              className="w-full bg-shrine-red text-white font-black py-3 rounded-xl hover:opacity-90 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1"
            >
              つぎへ<ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* ── step 2: 位置情報プライミング ── */}
        {step === 2 && (
          <>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-100 to-amber-100 flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-shrine-red" />
            </div>
            <h2 className="text-lg font-black text-gray-900 mb-2">近くの神様を探そう</h2>
            <p className="text-[13px] text-gray-500 leading-relaxed mb-1.5">
              {name.trim() || 'そなた'}よ、近くに宿る神々に会うため、現在地を教えてほしいのじゃ。
            </p>
            <p className="text-[11px] text-gray-400 leading-relaxed mb-5">
              位置情報は、近くの場とクエストを探すためだけに使われます。
            </p>
            <button
              onClick={() => { setAsked(true); onRequestLocation(); }}
              disabled={asked && geoStatus === 'locating'}
              className="w-full bg-shrine-red text-white font-black py-3 rounded-xl hover:opacity-90 disabled:opacity-60 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {asked && geoStatus === 'locating' ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  現在地を確認中…
                </>
              ) : (
                <>
                  <Flag className="w-4 h-4" />位置情報を許可して始める
                </>
              )}
            </button>
            <button
              onClick={skipLocation}
              className="w-full mt-2 text-[12px] font-bold text-gray-400 py-2 hover:text-gray-600 cursor-pointer"
            >
              あとで（東京を仮の現在地にして試す）
            </button>
          </>
        )}
      </div>
    </div>
  );
}
