'use client';

// =============================================================================
// YaorozuSpirit — 八百万の神（精霊）プロシージャル・キャラクタージェネレーター
// -----------------------------------------------------------------------------
// 「ナンジャモンジャ」のようなファンシーで愛嬌のある精霊を、
// シード文字列から決定論的に生成する。各パーツ（体型・色・もよう・目・口・
// 頭かざり・ほっぺ・手・おまもり）を組み合わせることで実質無限のバリエーション
// を出力できる。framer-motion により、ふわふわ浮遊・呼吸（スカッシュ＆ストレッチ）・
// まばたき・頭かざりの揺れ・手のぱたぱた・きらめき、を常時アニメーションさせる。
//
// 使い方:
//   <YaorozuSpirit seed={spot.godName} size={120} />
//   <YaorozuSpirit gene={myGene} />               // 明示的に遺伝子を渡す
//
// バリエーション数の目安:
//   body 6 × palette 10 × pattern 4 × eyes 7 × mouth 6 × top 8 × cheek 2
//   × arms 3 × charm 5 ≈ 約 270 万通り（色相シフトを含めると事実上無限）
// =============================================================================

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

// --- 決定論的乱数（xmur3 + mulberry32）---------------------------------------
function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- パレット（ビビッドでポップな原色系：主色・影色・線色）-------------------
export const PALETTES = [
  { main: '#FF3B47', shade: '#D81E2C', line: '#8A1018' }, // ポップレッド
  { main: '#FF4DA6', shade: '#E22588', line: '#8A1456' }, // ホットピンク
  { main: '#FF9F1C', shade: '#F07800', line: '#8A4A00' }, // オレンジ
  { main: '#FFD23F', shade: '#F2B705', line: '#8A6A00' }, // イエロー
  { main: '#2EC4FF', shade: '#0A9EDC', line: '#0A5A7A' }, // ポップブルー
  { main: '#3DD68C', shade: '#16B36A', line: '#0A6A40' }, // グリーン
  { main: '#9B5DE5', shade: '#7B3FC7', line: '#4A2080' }, // パープル
  { main: '#FF7AC0', shade: '#F050A2', line: '#8A2862' }, // モモ
  { main: '#1FB6A6', shade: '#0F9486', line: '#085A52' }, // ティール
  { main: '#FF6B3D', shade: '#E84A1C', line: '#8A2810' }, // コーラル
];

// 表情の線色（ポップなステッカー風のくっきりした黒インク）
const INK = '#2A2230';

type Rng = () => number;
const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

// --- 遺伝子（パーツの組み合わせ）---------------------------------------------
export interface SpiritGene {
  hue: number; // 色相シフト 0..359（事実上無限の色）
  palette: number; // 基本パレット index
  body: number; // 体型 0..5（2D シルエット & 3D スケール）
  shape: 'round' | 'triangle' | 'box' | 'tall' | 'bean' | 'eggplant'; // 3D ベース形状（丸以外も）
  pattern: 'none' | 'dots' | 'stripes' | 'star';
  eyes: 'round' | 'sleepy' | 'sparkle' | 'dot' | 'wink' | 'happy' | 'kira';
  mouth: 'smile' | 'o' | 'cat' | 'tiny' | 'fang' | 'wobble';
  top: 'none' | 'horn' | 'leaf' | 'antenna' | 'halo' | 'flame' | 'ears' | 'crown' | 'hat';
  cheek: boolean;
  arms: 'none' | 'nubs' | 'long';
  charm: 'none' | 'gem' | 'bell' | 'star' | 'drop';
}

export function geneFromSeed(seed: string): SpiritGene {
  const rng = mulberry32(xmur3(seed)());
  return {
    // ポップ配色を保つため色相のブレは小さめ（±18°）
    hue: Math.floor(rng() * 36) - 18,
    palette: Math.floor(rng() * PALETTES.length),
    body: Math.floor(rng() * 6),
    // 丸が多すぎないよう round に少し重みづけしつつ、三角(ポリンキー)・箱・縦長も
    shape: pick(rng, ['round', 'round', 'triangle', 'triangle', 'box', 'tall', 'bean', 'eggplant'] as const),
    pattern: pick(rng, ['none', 'dots', 'stripes', 'star', 'none'] as const),
    eyes: pick(rng, ['round', 'sleepy', 'sparkle', 'dot', 'wink', 'happy', 'kira'] as const),
    mouth: pick(rng, ['smile', 'o', 'cat', 'tiny', 'fang', 'wobble'] as const),
    top: pick(rng, ['none', 'horn', 'leaf', 'antenna', 'halo', 'flame', 'ears', 'crown', 'hat', 'hat'] as const),
    cheek: rng() > 0.35,
    arms: pick(rng, ['none', 'nubs', 'long'] as const),
    charm: pick(rng, ['none', 'gem', 'bell', 'star', 'drop', 'none'] as const),
  };
}

// --- 体型シルエット（中心 60,66 付近の丸っこいブロブ）------------------------
const BODIES: string[] = [
  // 0 まんまる
  'M60 18 C84 18 96 38 96 62 C96 90 80 108 60 108 C40 108 24 90 24 62 C24 38 36 18 60 18 Z',
  // 1 しずく（上すぼまり）
  'M60 14 C78 14 90 40 92 66 C94 92 80 110 60 110 C40 110 26 92 28 66 C30 40 42 14 60 14 Z',
  // 2 おまんじゅう（横長）
  'M60 26 C90 26 104 44 104 64 C104 88 86 104 60 104 C34 104 16 88 16 64 C16 44 30 26 60 26 Z',
  // 3 たまご（縦長）
  'M60 12 C82 12 94 36 94 66 C94 94 80 112 60 112 C40 112 26 94 26 66 C26 36 38 12 60 12 Z',
  // 4 もちもち（下ぷっくり）
  'M60 22 C82 22 92 40 92 60 C92 92 78 110 60 110 C42 110 28 92 28 60 C28 40 38 22 60 22 Z',
  // 5 ふにゃ（非対称）
  'M58 16 C82 14 98 36 96 64 C94 92 78 108 58 108 C38 108 22 88 24 62 C26 38 36 18 58 16 Z',
];

// gene.shape に対応した 2D シルエット（角丸の三角・箱・そらまめ・ナス）
const SHAPE_BODIES: Partial<Record<SpiritGene['shape'], string>> = {
  // 三角（角丸・頂点上）
  triangle: 'M60 18 Q66 16 70 26 L100 96 Q104 106 92 106 L28 106 Q16 106 20 96 L50 26 Q54 16 60 18 Z',
  // 箱（角丸）
  box: 'M34 26 Q24 26 24 38 L24 94 Q24 106 36 106 L84 106 Q96 106 96 94 L96 38 Q96 26 86 26 Z',
  // そらまめ（横長・両端そり上がり）
  bean: 'M40 40 Q60 32 80 40 Q102 50 98 70 Q100 92 78 98 Q60 102 42 98 Q20 92 22 70 Q18 50 40 40 Z',
  // ナス（上すぼまり・下ぷっくり）
  eggplant: 'M60 14 Q70 14 72 30 Q73 46 80 58 Q90 72 90 86 Q90 108 60 110 Q30 108 30 86 Q30 72 40 58 Q47 46 48 30 Q50 14 60 14 Z',
};

interface Props {
  seed?: string;
  gene?: SpiritGene;
  size?: number;
  /** アニメーションを止める（一覧の軽量表示など） */
  still?: boolean;
  /** ボディの輪郭線を消す（やわらかいグラデのみで形をとる） */
  outline?: boolean;
  className?: string;
}

export default function YaorozuSpirit({ seed = 'kami', gene, size = 120, still = false, outline = true, className }: Props) {
  const g = useMemo(() => gene ?? geneFromSeed(seed), [gene, seed]);
  const pal = PALETTES[g.palette];
  // 色相シフトで無限の色味を作る
  const filterId = useMemo(() => `hue-${Math.abs(g.hue)}-${g.palette}-${(seed || 'g').replace(/\W/g, '')}`, [g.hue, g.palette, seed]);
  // 形状（三角/箱/そらまめ/ナス）があればそれを、なければ体型ブロブを使う
  const bodyPath = SHAPE_BODIES[g.shape] ?? BODIES[g.body];

  // 揺れの位相をシードでずらして、並べても動きが揃わないように
  const phase = (xmur3(seed + 'p')() % 1000) / 1000;

  const idle = still
    ? {}
    : {
        animate: { y: [0, -5, 0, 3, 0] },
        transition: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' as const, delay: phase * 2 },
      };

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 120 130"
      className={className}
      style={{ overflow: 'visible', filter: 'drop-shadow(0 6px 6px rgba(0,0,0,0.12))' }}
      {...idle}
    >
      <defs>
        {/* 色相回転で同じパレットから無限の色を派生 */}
        <filter id={filterId}>
          <feColorMatrix type="hueRotate" values={String(g.hue)} />
        </filter>
        <radialGradient id={`${filterId}-body`} cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="22%" stopColor={pal.main} />
          <stop offset="100%" stopColor={pal.shade} />
        </radialGradient>
        <clipPath id={`${filterId}-clip`}>
          <path d={bodyPath} />
        </clipPath>
        {/* やわらかい発光（The Glade 風の幻想的なにじみ） */}
        <filter id={`${filterId}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id={`${filterId}-aura`} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor={pal.main} stopOpacity="0.5" />
          <stop offset="100%" stopColor={pal.main} stopOpacity="0" />
        </radialGradient>
      </defs>

      <g filter={`url(#${filterId})`}>
        {/* 影（地面） */}
        {!still && (
          <motion.ellipse
            cx={60}
            cy={120}
            rx={30}
            ry={6}
            fill="rgba(0,0,0,0.12)"
            animate={{ rx: [30, 24, 30], opacity: [0.12, 0.18, 0.12] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: phase * 2 }}
          />
        )}

        {/* 体（呼吸：スカッシュ＆ストレッチ） */}
        <motion.g
          style={{ transformOrigin: '60px 108px' }}
          animate={still ? undefined : { scaleX: [1, 1.05, 1, 0.97, 1], scaleY: [1, 0.96, 1, 1.04, 1] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: phase * 2 }}
        >
          {/* オーラ（背後のにじむ光） */}
          {!outline && <ellipse cx={60} cy={64} rx={48} ry={52} fill={`url(#${filterId}-aura)`} />}
          <Top top={g.top} pal={pal} />
          <g filter={outline ? undefined : `url(#${filterId}-glow)`}>
            <path d={bodyPath} fill={`url(#${filterId}-body)`} stroke={outline ? pal.line : 'none'} strokeWidth={2.5} />
            {/* 上部のやわらかいハイライト */}
            {!outline && <ellipse cx={48} cy={42} rx={18} ry={12} fill="#ffffff" opacity={0.35} />}
          </g>

          {/* もよう（体でクリップ） */}
          <g clipPath={`url(#${filterId}-clip)`} opacity={0.5}>
            <Pattern pattern={g.pattern} shade={pal.shade} />
          </g>

          <Arms arms={g.arms} pal={pal} still={still} phase={phase} />

          {/* ほっぺ */}
          {g.cheek && (
            <>
              <ellipse cx={40} cy={70} rx={7} ry={4.5} fill="#FF8FA8" opacity={0.55} />
              <ellipse cx={80} cy={70} rx={7} ry={4.5} fill="#FF8FA8" opacity={0.55} />
            </>
          )}

          <Eyes eyes={g.eyes} line={INK} still={still} phase={phase} />
          <Mouth mouth={g.mouth} line={INK} />
        </motion.g>

        <Charm charm={g.charm} pal={pal} still={still} phase={phase} />
      </g>
    </motion.svg>
  );
}

// --- 頭かざり -----------------------------------------------------------------
function Top({ top, pal }: { top: SpiritGene['top']; pal: (typeof PALETTES)[number] }) {
  const sway = {
    animate: { rotate: [-4, 4, -4] },
    transition: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' as const },
    style: { transformOrigin: '60px 22px' as const },
  };
  switch (top) {
    case 'horn':
      return (
        <g stroke={pal.line} strokeWidth={2} fill="#FFF6E0">
          <path d="M46 24 L42 6 L54 22 Z" />
          <path d="M74 24 L78 6 L66 22 Z" />
        </g>
      );
    case 'leaf':
      return (
        <motion.g {...sway} fill="#9BE08A" stroke={pal.line} strokeWidth={1.8}>
          <path d="M60 22 C58 6 50 2 46 0 C50 8 50 16 60 22 Z" />
          <path d="M60 22 C62 6 70 2 74 0 C70 8 70 16 60 22 Z" />
        </motion.g>
      );
    case 'antenna':
      return (
        <motion.g {...sway} stroke={pal.line} strokeWidth={2} fill="#FFE08A">
          <path d="M60 22 C56 8 50 6 48 2" fill="none" />
          <circle cx={47} cy={1} r={4} />
        </motion.g>
      );
    case 'halo':
      return (
        <ellipse cx={60} cy={10} rx={20} ry={6} fill="none" stroke="#FFD86B" strokeWidth={3} opacity={0.95} />
      );
    case 'flame':
      return (
        <motion.g
          animate={{ scaleY: [1, 1.15, 0.95, 1], y: [0, -1, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '60px 22px' }}
          fill="#FF8A5B"
          stroke={pal.line}
          strokeWidth={1.5}
        >
          <path d="M60 22 C50 14 54 4 60 -2 C66 4 70 14 60 22 Z" />
          <path d="M60 18 C56 13 58 8 60 4 C62 8 64 13 60 18 Z" fill="#FFD86B" stroke="none" />
        </motion.g>
      );
    case 'ears':
      return (
        <g fill={pal.main} stroke={pal.line} strokeWidth={2}>
          <path d="M40 26 C34 8 28 8 30 4 C40 6 46 16 48 24 Z" />
          <path d="M80 26 C86 8 92 8 90 4 C80 6 74 16 72 24 Z" />
        </g>
      );
    case 'crown':
      return (
        <g fill="#FFD86B" stroke={pal.line} strokeWidth={1.8}>
          <path d="M44 22 L44 8 L52 16 L60 4 L68 16 L76 8 L76 22 Z" />
          <circle cx={60} cy={4} r={2.4} fill="#FF8FA8" />
        </g>
      );
    case 'hat':
      return (
        <g stroke={INK} strokeWidth={1.6}>
          {/* つば */}
          <ellipse cx={60} cy={22} rx={22} ry={5} fill="#5BBFE0" />
          {/* 山 */}
          <path d="M48 22 C48 6 72 6 72 22 Z" fill="#3DA6CC" />
          <rect x={47} y={19} width={26} height={4} rx={2} fill="#FFD86B" stroke="none" />
        </g>
      );
    default:
      return null;
  }
}

// --- もよう -------------------------------------------------------------------
function Pattern({ pattern, shade }: { pattern: SpiritGene['pattern']; shade: string }) {
  switch (pattern) {
    case 'dots':
      return (
        <g fill={shade}>
          {[
            [40, 88],
            [60, 96],
            [80, 88],
            [50, 76],
            [70, 76],
            [60, 60],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={4} />
          ))}
        </g>
      );
    case 'stripes':
      return (
        <g stroke={shade} strokeWidth={5}>
          <line x1={20} y1={70} x2={100} y2={70} />
          <line x1={20} y1={84} x2={100} y2={84} />
          <line x1={20} y1={98} x2={100} y2={98} />
        </g>
      );
    case 'star':
      return (
        <g fill={shade}>
          {[
            [44, 86],
            [76, 86],
            [60, 98],
          ].map(([x, y], i) => (
            <path
              key={i}
              transform={`translate(${x} ${y})`}
              d="M0 -6 L1.8 -1.8 L6 -1.8 L2.6 1 L4 6 L0 3 L-4 6 L-2.6 1 L-6 -1.8 L-1.8 -1.8 Z"
            />
          ))}
        </g>
      );
    default:
      return null;
  }
}

// --- 目（まばたきはscaleYで）-------------------------------------------------
function Eyes({ eyes, line, still, phase }: { eyes: SpiritGene['eyes']; line: string; still: boolean; phase: number }) {
  const blink = still
    ? {}
    : {
        animate: { scaleY: [1, 1, 0.1, 1, 1] },
        transition: { duration: 4, repeat: Infinity, times: [0, 0.92, 0.95, 0.98, 1], delay: phase * 3 },
      };
  const L = 44;
  const R = 76;
  const Y = 58;

  const content = () => {
    switch (eyes) {
      case 'round':
        return (
          <>
            {/* 白目＋黒目のぱっちりした目（ステッカー風） */}
            <ellipse cx={L} cy={Y} rx={9} ry={10} fill="#fff" stroke={line} strokeWidth={1.5} />
            <ellipse cx={R} cy={Y} rx={9} ry={10} fill="#fff" stroke={line} strokeWidth={1.5} />
            <circle cx={L + 1.5} cy={Y + 1} r={5} fill={line} />
            <circle cx={R + 1.5} cy={Y + 1} r={5} fill={line} />
            <circle cx={L + 3.5} cy={Y - 1.5} r={1.8} fill="#fff" />
            <circle cx={R + 3.5} cy={Y - 1.5} r={1.8} fill="#fff" />
          </>
        );
      case 'sleepy':
        return (
          <g stroke={line} strokeWidth={3} fill="none" strokeLinecap="round">
            <path d={`M${L - 7} ${Y} Q${L} ${Y + 5} ${L + 7} ${Y}`} />
            <path d={`M${R - 7} ${Y} Q${R} ${Y + 5} ${R + 7} ${Y}`} />
          </g>
        );
      case 'sparkle':
        return (
          <>
            <ellipse cx={L} cy={Y} rx={10} ry={11} fill="#fff" stroke={line} strokeWidth={1.5} />
            <ellipse cx={R} cy={Y} rx={10} ry={11} fill="#fff" stroke={line} strokeWidth={1.5} />
            <circle cx={L + 1} cy={Y + 1} r={6} fill={line} />
            <circle cx={R + 1} cy={Y + 1} r={6} fill={line} />
            <circle cx={L + 3.5} cy={Y - 2.5} r={2.4} fill="#fff" />
            <circle cx={R + 3.5} cy={Y - 2.5} r={2.4} fill="#fff" />
            <circle cx={L - 2.5} cy={Y + 3} r={1.4} fill="#fff" />
            <circle cx={R - 2.5} cy={Y + 3} r={1.4} fill="#fff" />
          </>
        );
      case 'dot':
        return (
          <>
            <circle cx={L} cy={Y} r={4} fill={line} />
            <circle cx={R} cy={Y} r={4} fill={line} />
          </>
        );
      case 'wink':
        return (
          <>
            <circle cx={L} cy={Y} r={7} fill={line} />
            <circle cx={L + 2.5} cy={Y - 2.5} r={2} fill="#fff" />
            <path d={`M${R - 7} ${Y} Q${R} ${Y - 5} ${R + 7} ${Y}`} stroke={line} strokeWidth={3} fill="none" strokeLinecap="round" />
          </>
        );
      case 'happy':
        return (
          <g stroke={line} strokeWidth={3} fill="none" strokeLinecap="round">
            <path d={`M${L - 7} ${Y + 2} Q${L} ${Y - 6} ${L + 7} ${Y + 2}`} />
            <path d={`M${R - 7} ${Y + 2} Q${R} ${Y - 6} ${R + 7} ${Y + 2}`} />
          </g>
        );
      case 'kira':
        return (
          <g fill={line}>
            <path transform={`translate(${L} ${Y})`} d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" />
            <path transform={`translate(${R} ${Y})`} d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" />
          </g>
        );
    }
  };

  return (
    <motion.g style={{ transformOrigin: `60px ${Y}px` }} {...blink}>
      {content()}
    </motion.g>
  );
}

// --- 口 ----------------------------------------------------------------------
function Mouth({ mouth, line }: { mouth: SpiritGene['mouth']; line: string }) {
  const Y = 76;
  switch (mouth) {
    case 'smile':
      return <path d={`M52 ${Y} Q60 ${Y + 7} 68 ${Y}`} stroke={line} strokeWidth={2.5} fill="none" strokeLinecap="round" />;
    case 'o':
      return <ellipse cx={60} cy={Y + 1} rx={4} ry={5} fill={line} />;
    case 'cat':
      return (
        <path d={`M52 ${Y} Q56 ${Y + 5} 60 ${Y} Q64 ${Y + 5} 68 ${Y}`} stroke={line} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      );
    case 'tiny':
      return <path d={`M57 ${Y} L63 ${Y}`} stroke={line} strokeWidth={2.5} strokeLinecap="round" />;
    case 'fang':
      return (
        <g>
          <path d={`M52 ${Y} Q60 ${Y + 6} 68 ${Y}`} stroke={line} strokeWidth={2.5} fill="none" strokeLinecap="round" />
          <path d={`M56 ${Y + 1} L58 ${Y + 5} L60 ${Y + 1} Z`} fill="#fff" stroke={line} strokeWidth={1} />
        </g>
      );
    case 'wobble':
      return (
        <path d={`M52 ${Y} Q56 ${Y - 3} 60 ${Y} Q64 ${Y + 4} 68 ${Y}`} stroke={line} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      );
  }
}

// --- 手（ぱたぱた）-----------------------------------------------------------
function Arms({ arms, pal, still, phase }: { arms: SpiritGene['arms']; pal: (typeof PALETTES)[number]; still: boolean; phase: number }) {
  if (arms === 'none') return null;
  const wave = (dir: number) =>
    still
      ? {}
      : {
          animate: { rotate: [dir * -8, dir * 14, dir * -8] },
          transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' as const, delay: phase },
        };
  if (arms === 'long') {
    return (
      <g stroke={pal.line} strokeWidth={2} fill={pal.shade}>
        <motion.path d="M26 80 q-12 2 -16 12" fill="none" strokeWidth={4} strokeLinecap="round" style={{ transformOrigin: '26px 80px' }} {...wave(1)} />
        <motion.path d="M94 80 q12 2 16 12" fill="none" strokeWidth={4} strokeLinecap="round" style={{ transformOrigin: '94px 80px' }} {...wave(-1)} />
      </g>
    );
  }
  // nubs
  return (
    <g fill={pal.shade} stroke={pal.line} strokeWidth={2}>
      <motion.ellipse cx={22} cy={84} rx={8} ry={6} style={{ transformOrigin: '28px 82px' }} {...wave(1)} />
      <motion.ellipse cx={98} cy={84} rx={8} ry={6} style={{ transformOrigin: '92px 82px' }} {...wave(-1)} />
    </g>
  );
}

// --- おまもり（ふわふわ漂う）------------------------------------------------
function Charm({ charm, pal, still, phase }: { charm: SpiritGene['charm']; pal: (typeof PALETTES)[number]; still: boolean; phase: number }) {
  if (charm === 'none') return null;
  const float = still
    ? {}
    : {
        animate: { y: [0, -4, 0], rotate: [-8, 8, -8] },
        transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' as const, delay: phase * 2.5 },
        style: { transformOrigin: '100px 50px' as const },
      };
  const node = () => {
    switch (charm) {
      case 'gem':
        return <path transform="translate(100 48)" d="M0 -7 L7 -1 L0 9 L-7 -1 Z" fill="#8FE0FF" stroke={pal.line} strokeWidth={1.5} />;
      case 'bell':
        return (
          <g transform="translate(100 48)" stroke={pal.line} strokeWidth={1.5}>
            <path d="M-6 4 C-6 -6 6 -6 6 4 Z" fill="#FFD86B" />
            <circle cx={0} cy={6} r={2} fill="#FFD86B" />
          </g>
        );
      case 'star':
        return (
          <path
            transform="translate(100 48)"
            d="M0 -8 L2.4 -2.4 L8 -2.4 L3.4 1.4 L5.2 8 L0 4 L-5.2 8 L-3.4 1.4 L-8 -2.4 L-2.4 -2.4 Z"
            fill="#FFE08A"
            stroke={pal.line}
            strokeWidth={1.2}
          />
        );
      case 'drop':
        return <path transform="translate(100 48)" d="M0 -8 C5 -2 6 4 0 8 C-6 4 -5 -2 0 -8 Z" fill="#A5E8F7" stroke={pal.line} strokeWidth={1.5} />;
      default:
        return null;
    }
  };
  return <motion.g {...float}>{node()}</motion.g>;
}
