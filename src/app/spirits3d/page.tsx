'use client';

// 3D 精霊（react-three-fiber）のプレビュー。
// 上：ヒーロー（モーションプリセットを切替）／下：いろいろなシード × モーション。
import React, { useState } from 'react';
import SpiritCanvas, { MotionPreset } from '../../components/Spirit3D';

const MOTIONS: { key: MotionPreset; label: string }[] = [
  { key: 'idle', label: '待機' },
  { key: 'wave', label: '手ふり' },
  { key: 'dance', label: 'ダンス' },
  { key: 'greet', label: '挨拶' },
  { key: 'jump', label: 'ジャンプ' },
  { key: 'turn', label: 'ターン' },
];

export default function Spirits3DPage() {
  const [salt, setSalt] = useState(0);
  const [motion, setMotion] = useState<MotionPreset>('dance');

  // ピンク（旧 index 2）を除外した並び。各タイルにモーションを割り当てて見せる。
  const tiles = [0, 1, 3, 4, 5, 6, 7, 8].map((i) => ({
    seed: `s3d-${salt}-${i}`,
    motion: MOTIONS[i % MOTIONS.length].key,
  }));

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(165deg,#bfe9f5 0%,#cfe9f0 40%,#d6efe0 65%,#f7e9cf 100%)', padding: '20px 16px 60px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', textShadow: '0 2px 8px rgba(90,120,150,0.4)' }}>八百万の神 3D（AR用）</h1>
        <p style={{ color: '#fff', marginTop: 4, fontSize: 14, textShadow: '0 1px 4px rgba(90,120,150,0.35)' }}>
          gene から組み立てた 3D 精霊。しゃべり・接地・関節つきの手足で動きます。
        </p>

        {/* モーション切替 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {MOTIONS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMotion(m.key)}
              style={{
                background: motion === m.key ? '#3A4A8A' : '#fff',
                color: motion === m.key ? '#fff' : '#3A4A8A',
                border: 'none', borderRadius: 999, padding: '6px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginTop: 12 }}>
          <div style={{ height: 360, borderRadius: 20, overflow: 'hidden', background: 'rgba(255,255,255,0.25)' }}>
            <SpiritCanvas seed={`hero-${salt}`} motion={motion} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(90,120,150,0.4)' }}>無限生成 × モーション</h2>
          <button
            onClick={() => setSalt((s) => s + 1)}
            style={{ background: '#fff', color: '#3A4A8A', border: 'none', borderRadius: 999, padding: '6px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            ✨ 生成しなおす
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginTop: 12 }}>
          {tiles.map(({ seed, motion: m }) => (
            <div key={seed} style={{ height: 200, borderRadius: 18, overflow: 'hidden', background: 'rgba(255,255,255,0.2)', position: 'relative' }}>
              <SpiritCanvas seed={seed} motion={m} />
              <span style={{ position: 'absolute', left: 8, bottom: 6, fontSize: 11, fontWeight: 700, color: '#3A4A8A', background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '1px 6px' }}>
                {MOTIONS.find((x) => x.key === m)?.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
