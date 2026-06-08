'use client';

// 八百万の神（精霊）ジェネレーターのプレビュー / ギャラリー。
// 実際の神様名から生成した姿と、ランダムシードで無限に出力される姿を一覧する。
import React, { useState } from 'react';
import YaorozuSpirit from '../../components/YaorozuSpirit';
import { generateTokyoSpots } from '../../data/tokyo-spots';

export default function SpiritsPage() {
  const [salt, setSalt] = useState(0);

  // スポットに宿る実在の神様名から生成
  const gods = generateTokyoSpots(40)
    .map((s) => s.godName)
    .filter((n): n is string => Boolean(n))
    .slice(0, 12);

  // ランダムシードで無限生成（saltを変えると総入れ替え）
  const randoms = Array.from({ length: 24 }, (_, i) => `spirit-${salt}-${i}`);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg,#bfe9f5 0%,#d8f0 40%,#cfeede 60%,#f6e7c8 100%)',
        backgroundImage: 'linear-gradient(165deg,#bfe9f5 0%,#cfe9f0 35%,#d6efe0 60%,#f7e9cf 100%)',
        padding: '24px 16px 64px',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', textShadow: '0 2px 8px rgba(90,120,150,0.4)' }}>八百万の神 ジェネレーター</h1>
        <p style={{ color: '#fff', marginTop: 4, fontSize: 14, textShadow: '0 1px 4px rgba(90,120,150,0.35)' }}>
          パーツの組み合わせで無限に生成される精霊たち。ふわふわ動きます。
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(90,120,150,0.4)', marginTop: 24 }}>各スポットに宿る神</h2>
        <div style={grid}>
          {gods.map((name) => (
            <div key={name} style={card}>
              <YaorozuSpirit seed={name} size={120} outline={false} />
              <span style={label}>{name}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(90,120,150,0.4)' }}>無限生成（ランダム）</h2>
          <button onClick={() => setSalt((s) => s + 1)} style={btn}>
            ✨ 生成しなおす
          </button>
        </div>
        <div style={grid}>
          {randoms.map((seed) => (
            <div key={seed} style={card}>
              <YaorozuSpirit seed={seed} size={110} outline={false} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: 16,
  marginTop: 12,
};
const card: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: '18px 8px 12px',
  background: 'transparent',
};
const label: React.CSSProperties = { fontSize: 12, color: '#fff', textAlign: 'center', fontWeight: 700, textShadow: '0 1px 4px rgba(90,120,150,0.4)' };
const btn: React.CSSProperties = {
  background: '#B5C7FF',
  color: '#3A4A8A',
  border: 'none',
  borderRadius: 999,
  padding: '6px 14px',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};
