'use client';

// 初回起動の3ステップ・オンボーディング
// -----------------------------------------------------------------------------
//   step 0: 世界観 — 狐の精霊がタイプライターでアプリの楽しみ方を3行で語る
//   step 1: 名前 — 巡礼者登録（OAuth / ゲスト名入力。旧オンボーディングのカードを踏襲）
//   step 2: 位置情報 — 「近くの神様を探すため」という文脈を添えてから OS ダイアログを出す
// OS の位置情報許可をいきなり出さない（watchPosition は page.tsx 側で needsOnboard 中は
// 起動しない）。「あとで」を必ず併設し、拒否しても東京を仮の現在地に遊べる。
// -----------------------------------------------------------------------------

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, ChevronRight, Flag } from 'lucide-react';
import { isAuthConfigured, signInWithProvider } from '../lib/supabase-browser';
import { grantGoShuin } from '../lib/goshuin';
import GoshuinCelebrate from './GoshuinCelebrate';

// 公式神「狐の精霊ヤオロズ」＝最初に出会う神。歩く前にこの神が「旅立ちの御朱印」を授ける。
// 固定の特別スポットとして扱う（実在スポットではないので unofficial 表記は出さない）。
const ORIGIN_GOSHUIN = { id: 'yaorozu-origin', name: '旅立ちの社', category: '特別', godEmoji: '🦊', godName: 'ヤオロズ' };

interface OnboardingFlowProps {
  initialName: string;
  geoStatus: 'locating' | 'ok' | 'denied' | 'error';
  /** OS の位置情報許可を要求する（page.tsx の requestLocation） */
  onRequestLocation: () => void;
  /** 登録を確定して本編へ。requestedLocation=false は「あとで」スキップ */
  onComplete: (name: string, opts: { requestedLocation: boolean }) => void;
}

// step 0: 狐との一問一答。受け身の朗読ではなく、タップで応えながら旅に入る。
// 最初のビートだけ2択（agency を生む）。返答はいずれも次へ進む。
// タイプライターはコードポイント単位（絵文字のサロゲートペアを分断しない）。
const INTRO_BEATS: { fox: string; replies: string[] }[] = [
  { fox: '⛩️ そなた、いつもの街歩きを“小さな巡礼”に変えてみぬか？', replies: ['巡礼…？', 'やってみたい'] },
  { fox: '🙏 この街の社や寺には、八百万の神々が宿っておる。会いに行き、依頼をこなせば「徳」が積もるのじゃ。', replies: ['面白そう'] },
  { fox: '🔴 御朱印やバッジが集まれば、いつもの道が小さな巡礼の物語になる。さあ、名を授けよう。', replies: ['はじめる'] },
];

export default function OnboardingFlow({ initialName, geoStatus, onRequestLocation, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);
  // step 0: 一問一答の進行（現在のビート＋そのビートのタイプライター文字数）
  const [beat, setBeat] = useState(0);
  const [typed, setTyped] = useState(0);
  const beatChars = useMemo(() => Array.from(INTRO_BEATS[beat].fox), [beat]);
  const beatDone = typed >= beatChars.length;
  // step 2: 許可ボタンを押したか（押してから geoStatus の確定を待つ）
  const [asked, setAsked] = useState(false);
  // 名付けの直後・位置情報を尋ねる前に「旅立ちの御朱印」をゼロ距離で授ける授与式
  const [showOrigin, setShowOrigin] = useState(false);
  const completedRef = useRef(false);

  // 名前を確定 → 旅立ちの御朱印を授与（grantGoShuin は重複時 null を返すので再入安全）
  const grantOriginAndCelebrate = () => {
    if (!name.trim()) return;
    grantGoShuin('user-self', ORIGIN_GOSHUIN, ORIGIN_GOSHUIN.godName);
    setShowOrigin(true);
  };

  // 現在のビートの台詞をタイプライター表示する（typed のリセットは遷移時にハンドラ側で行う）
  useEffect(() => {
    const t = setInterval(() => {
      setTyped((p) => {
        if (p >= beatChars.length) { clearInterval(t); return p; }
        return p + 1;
      });
    }, 30);
    return () => clearInterval(t);
  }, [beat, beatChars.length]);

  // 返答タップ：未表示なら全文表示、表示済みなら次のビート / 最後なら名付け（step 1）へ
  const advanceBeat = () => {
    if (!beatDone) { setTyped(beatChars.length); return; }
    if (beat < INTRO_BEATS.length - 1) { setTyped(0); setBeat(beat + 1); } // 同一更新でビート切替＆先頭から
    else setStep(1);
  };

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

        {/* ── step 0: 狐との一問一答（世界観を“対話”で体験する） ── */}
        {step === 0 && (
          <>
            <div
              className="text-left min-h-[180px] cursor-pointer"
              onClick={() => { if (!beatDone) setTyped(beatChars.length); }}
            >
              <div className="flex items-start gap-2">
                <span className="text-xl flex-shrink-0">🦊</span>
                <p className="flex-1 bg-amber-50 border border-amber-200/60 rounded-2xl rounded-tl-none px-3 py-2 text-[13px] leading-relaxed text-gray-800 font-bold">
                  {beatChars.slice(0, typed).join('')}
                  {!beatDone && <span className="animate-pulse">▍</span>}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              {beatDone ? (
                INTRO_BEATS[beat].replies.map((r, i) => {
                  // 各ビートの最後の返答を主アクション（朱）に、それ以外は副（白）にする
                  const primary = i === INTRO_BEATS[beat].replies.length - 1;
                  return (
                    <button
                      key={i}
                      onClick={advanceBeat}
                      className={`w-full font-black py-3 rounded-xl active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        primary
                          ? 'bg-shrine-red text-white hover:opacity-90'
                          : 'bg-white border border-gray-200 text-gray-600 hover:border-shrine-red/40'
                      }`}
                    >
                      {r}{primary && <ChevronRight className="w-4 h-4" />}
                    </button>
                  );
                })
              ) : (
                <button
                  onClick={() => setTyped(beatChars.length)}
                  className="w-full bg-white border border-gray-200 text-gray-500 font-black py-3 rounded-xl hover:border-shrine-red/40 cursor-pointer"
                >
                  全部読む
                </button>
              )}
            </div>
          </>
        )}

        {/* ── step 1: 巡礼者登録（名前 / OAuth） ── */}
        {step === 1 && (
          <>
            <div className="flex items-start gap-2 text-left mb-5">
              <span className="text-xl flex-shrink-0">🦊</span>
              <p className="flex-1 bg-amber-50 border border-amber-200/60 rounded-2xl rounded-tl-none px-3 py-2 text-[13px] leading-relaxed text-gray-800 font-bold">
                よい返事じゃ。では旅の名を授けよう——そなたを何と呼べばよい？
              </p>
            </div>

            {isAuthConfigured() && (
              <div className="mb-5">
                <button
                  onClick={() => signInWithProvider('google')}
                  className="w-full flex items-center justify-center gap-2.5 bg-white border border-gray-300 text-gray-800 font-black py-3 rounded-xl hover:bg-gray-50 active:scale-[0.99] transition-all cursor-pointer mb-2"
                >
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  Google で続ける
                </button>
                <button
                  onClick={() => signInWithProvider('apple')}
                  className="w-full flex items-center justify-center gap-2.5 bg-black text-white font-black py-3 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <svg className="w-5 h-5 flex-shrink-0 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-.96.04-2.13.64-2.82 1.45-.6.69-1.12 1.83-.98 2.94 1.07.08 2.15-.52 2.81-1.33z"/>
                  </svg>
                  Apple で続ける
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
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) grantOriginAndCelebrate(); }}
              maxLength={12}
              autoFocus
              placeholder="巡礼者の名前"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-center text-base text-gray-900 focus:outline-none focus:border-shrine-red mb-2"
            />
            <p className="text-[11px] text-gray-400 mb-4">アバターは名前から自動生成されます（後でクエストの「アバターを撮る」で写真にできます）。</p>
            <button
              onClick={grantOriginAndCelebrate}
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

      {showOrigin && (
        <GoshuinCelebrate
          seed={ORIGIN_GOSHUIN.godName}
          godEmoji={ORIGIN_GOSHUIN.godEmoji}
          stampLabel={ORIGIN_GOSHUIN.godName}
          spotName={ORIGIN_GOSHUIN.name}
          variant="origin"
          unofficial={false}
          position="fixed"
          closeLabel="旅に出る"
          onClose={() => { setShowOrigin(false); setStep(2); }}
        />
      )}
    </div>
  );
}
