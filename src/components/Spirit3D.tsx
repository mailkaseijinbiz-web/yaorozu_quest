'use client';

// =============================================================================
// Spirit3D — 八百万の神（精霊）の 3D 版（react-three-fiber）
// -----------------------------------------------------------------------------
// YaorozuSpirit と同じ gene（パーツ遺伝子）から、The Glade 風のやわらかく光る
// 3D 精霊を組み立てる。<SpiritCanvas> はカメラ映像の上に重ねて「その場に出現」
// させる AR 用の透過キャンバス。本体は浮遊・呼吸・ゆらぎで常にアニメーションする。
//
//   <SpiritCanvas seed={agent.name} />        // 透過・AR重ね用
//   <SpiritCanvas seed={x} background="#cde" />// プレビュー用に背景つき
// =============================================================================

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { geneFromSeed, PALETTES, SpiritGene } from './YaorozuSpirit';

// --- 簡易シード乱数（形のゆがみを seed で固定するため）-----------------------
function hashSeed(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

// 位置ベースのハッシュ（0..1）。同じ座標の頂点は同じ値→面が割れない（連続）
function posHash(x: number, y: number, z: number) {
  const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return h - Math.floor(h);
}

// gene → THREE.Color（パレット基準色を素直に。彩度はいじらない）
function bodyColors(g: SpiritGene) {
  const pal = PALETTES[g.palette];
  const main = new THREE.Color(pal.main);
  const shade = new THREE.Color(pal.shade);
  const shift = g.hue / 360;
  main.offsetHSL(shift, 0, 0);
  shade.offsetHSL(shift, 0, -0.04);
  return { main, shade };
}

// --- ノイズシェーダー：MeshStandardMaterial に 3D fbm の素材ムラを注入 -------
const NOISE_GLSL = `
float n3hash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3noise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(n3hash(i+vec3(0,0,0)),n3hash(i+vec3(1,0,0)),f.x),
                 mix(n3hash(i+vec3(0,1,0)),n3hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(n3hash(i+vec3(0,0,1)),n3hash(i+vec3(1,0,1)),f.x),
                 mix(n3hash(i+vec3(0,1,1)),n3hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
float n3fbm(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*n3noise(p); p*=2.03; a*=0.5; } return v; }
`;

// 同一参照を保ってマテリアルの再コンパイルを防ぐ（色は uniform なので関数は固定でOK）
const patchNoise = (shader: THREE.WebGLProgramParametersWithUniforms) => {
  shader.vertexShader = 'varying vec3 vLocalPos;\n' + shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\n  vLocalPos = position;'
  );
  shader.fragmentShader = NOISE_GLSL + 'varying vec3 vLocalPos;\n' + shader.fragmentShader.replace(
    '#include <color_fragment>',
    '#include <color_fragment>\n  float _n = n3fbm(vLocalPos * 5.5);\n  diffuseColor.rgb *= (0.80 + 0.34 * _n);'
  );
  // 仕上げに 4x4 ベイヤー法のディザリング（色を少ない階調へ→イラスト/レトロ感）
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <dithering_fragment>',
    `#include <dithering_fragment>
    {
      float bayer[16] = float[16](0.,8.,2.,10., 12.,4.,14.,6., 3.,11.,1.,9., 15.,7.,13.,5.);
      int bx = int(mod(gl_FragCoord.x, 4.0));
      int by = int(mod(gl_FragCoord.y, 4.0));
      float th = (bayer[bx + by * 4] + 0.5) / 16.0;
      float L = 5.0;
      vec3 c = clamp(gl_FragColor.rgb, 0.0, 1.0) * (L - 1.0);
      gl_FragColor.rgb = floor(c + th) / (L - 1.0);
    }`
  );
};

// マットな素材感（テカらない・発光しない・ノイズで素材ムラ）
function softMaterial(color: THREE.Color) {
  return <meshStandardMaterial color={color} roughness={0.95} metalness={0} flatShading onBeforeCompile={patchNoise} />;
}

// --- ベース形状（丸／三角＝ポリンキー／箱／縦長）＋ seed 由来のコブで歪ませる -
// detail/セグメントを低めにして面（ファセット）を残し、粘土／紙風の素材感に。
function makeBlobGeometry(seed: string, shape: SpiritGene['shape']): THREE.BufferGeometry {
  let geo: THREE.BufferGeometry;
  if (shape === 'triangle') {
    // 三角の面をカメラ側へ。角はベベルで僅かに面取り（ポリンキー風）
    const R = 1.2;
    const sh = new THREE.Shape();
    sh.moveTo(0, R); // 頂点（上）
    sh.lineTo(-0.866 * R, -0.5 * R);
    sh.lineTo(0.866 * R, -0.5 * R);
    sh.closePath();
    const depth = 0.7, bevelT = 0.22; // 薄め
    geo = new THREE.ExtrudeGeometry(sh, {
      depth,
      bevelEnabled: true,
      bevelThickness: bevelT,
      bevelSize: 0.26,
      bevelSegments: 1, // 粗い面取り
      steps: 1,
    });
    geo.translate(0, 0, 0.75 - depth - bevelT); // 実前面(=depth+bevel)を z≈0.75 に。顔パーツ(z0.86〜)が前に出る
  } else if (shape === 'box') {
    // 角丸＋ベベルで面取りした箱
    const w = 0.74, h = 0.84, r = 0.2;
    const sh = new THREE.Shape();
    sh.moveTo(-w + r, -h);
    sh.lineTo(w - r, -h); sh.quadraticCurveTo(w, -h, w, -h + r);
    sh.lineTo(w, h - r); sh.quadraticCurveTo(w, h, w - r, h);
    sh.lineTo(-w + r, h); sh.quadraticCurveTo(-w, h, -w, h - r);
    sh.lineTo(-w, -h + r); sh.quadraticCurveTo(-w, -h, -w + r, -h);
    const depth = 0.7, bevelT = 0.2; // 薄め
    geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevelT, bevelSize: 0.22, bevelSegments: 1, steps: 1 });
    geo.translate(0, 0, 0.75 - depth - bevelT); // 実前面を z≈0.75 に（顔パーツが前に出る）
  } else {
    geo = new THREE.IcosahedronGeometry(1, 5);
  }
  const rng = hashSeed(seed + 'shape');
  const jseed = rng() * 10; // 手触りゆらぎの位相（seed 由来）
  const heavy = shape === 'round' || shape === 'tall'; // 丸系だけ強くコブを付ける
  const maxAmp = heavy ? 0.34 : 0.2; // 三角・箱なども左右非対称にゆがませる
  const lobes = Array.from({ length: 5 + Math.floor(rng() * 3) }, () => {
    const dir = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize();
    return { dir, amp: rng() * maxAmp - maxAmp * 0.35, spread: 1.0 + rng() * 1.8 };
  });
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    let disp = 0;
    for (const l of lobes) disp += l.amp * Math.exp(-(1 - n.dot(l.dir)) * l.spread * 2);
    // 顔の前面（+z 側）はコブを抑えて平らに保ち、目・鼻が埋まらないように
    const front = Math.max(0, n.z);
    disp *= 1 - 0.85 * front * front;
    // 手触り感：位置ベースのゆらぎ（同座標は同値＝面が連続）。前面は弱め
    const ph = posHash(v.x * 2.6 + jseed, v.y * 2.6 + jseed, v.z * 2.6 + jseed);
    disp += (ph - 0.5) * 0.07 * (1 - 0.6 * front);
    v.multiplyScalar(1 + disp);
    if (shape === 'tall') {
      v.y *= 1.35; // 縦長
    } else if (shape === 'bean') {
      // そらまめ：横長＋両端がそり上がる
      v.x *= 1.4; v.y *= 0.82; v.z *= 0.92;
      v.y += 0.16 * v.x * v.x;
    } else if (shape === 'eggplant') {
      // ナス：縦長で上ほど細く、少し湾曲
      const yy = (v.y + 1) / 2; // 0(下)→1(上)
      const taper = 1 - 0.42 * Math.max(0, Math.min(1, yy));
      v.x *= taper; v.z *= taper;
      v.y *= 1.4;
      v.x += 0.16 * Math.max(0, v.y);
    }
    pos.setXYZ(i, v.x, v.y * 0.96, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// --- 頭かざり -----------------------------------------------------------------
function Top3D({ g, shade }: { g: SpiritGene; shade: THREE.Color }) {
  const accent = useMemo(() => new THREE.Color('#FFE08A'), []);
  switch (g.top) {
    case 'horn':
      return (
        <>
          {[-0.32, 0.32].map((x) => (
            <mesh key={x} position={[x, 1.05, 0]} rotation={[0, 0, x > 0 ? -0.3 : 0.3]}>
              <coneGeometry args={[0.12, 0.45, 16]} />
              {softMaterial(new THREE.Color('#FFF6E0'))}
            </mesh>
          ))}
        </>
      );
    case 'antenna':
      return (
        <group position={[-0.1, 1.0, 0]} rotation={[0, 0, 0.25]}>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.4, 8]} />
            {softMaterial(shade)}
          </mesh>
          <mesh position={[0, 0.45, 0]}>
            <sphereGeometry args={[0.12, 24, 24]} />
            {softMaterial(accent)}
          </mesh>
        </group>
      );
    case 'halo':
      return (
        <mesh position={[0, 1.25, 0]} rotation={[Math.PI / 2.3, 0, 0]}>
          <torusGeometry args={[0.5, 0.05, 16, 48]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.1} roughness={0.4} />
        </mesh>
      );
    case 'flame':
      return (
        <mesh position={[0, 1.15, 0]}>
          <coneGeometry args={[0.22, 0.6, 20]} />
          <meshStandardMaterial color={'#FF8A5B'} emissive={'#FF6B3B'} emissiveIntensity={1.4} roughness={0.5} />
        </mesh>
      );
    case 'ears':
      return (
        <>
          {[-0.55, 0.55].map((x) => (
            <mesh key={x} position={[x, 0.95, 0]} rotation={[0, 0, x > 0 ? -0.5 : 0.5]}>
              <coneGeometry args={[0.16, 0.5, 16]} />
              {softMaterial(bodyColors(g).main)}
            </mesh>
          ))}
        </>
      );
    case 'crown':
      return (
        <group position={[0, 1.02, 0]}>
          {/* 台輪 */}
          <mesh>
            <cylinderGeometry args={[0.42, 0.42, 0.16, 24, 1, true]} />
            {softMaterial(accent)}
          </mesh>
          {/* とがり（5本）＋宝石 */}
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            const x = Math.cos(a) * 0.42;
            const z = Math.sin(a) * 0.42;
            return (
              <group key={i}>
                <mesh position={[x, 0.16, z]}>
                  <coneGeometry args={[0.1, 0.22, 4]} />
                  {softMaterial(accent)}
                </mesh>
                <mesh position={[x, 0.28, z]}>
                  <sphereGeometry args={[0.05, 10, 10]} />
                  {softMaterial(new THREE.Color(i % 2 ? '#FF6FA5' : '#5BD6E0'))}
                </mesh>
              </group>
            );
          })}
        </group>
      );
    case 'leaf':
      return (
        <group position={[0, 1.0, 0]}>
          {[-0.4, 0.4].map((r) => (
            <mesh key={r} position={[r * 0.3, 0.15, 0]} rotation={[0, 0, r]} scale={[0.5, 1, 0.3]}>
              <sphereGeometry args={[0.2, 16, 16]} />
              {softMaterial(new THREE.Color('#9BE08A'))}
            </mesh>
          ))}
        </group>
      );
    case 'hat': {
      // とんがり三角帽（つば＋うねった本体＋リボン＋玉飾り）
      const hatCol = new THREE.Color('#5A57C8');
      const tip = new THREE.Color('#FF6FA5');
      return (
        <group position={[0, 1.04, 0]} rotation={[-0.06, 0, 0.12]}>
          {/* つば（少しめくれ上がったドーナツ） */}
          <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.52, 0.1, 12, 32]} />
            {softMaterial(hatCol)}
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.5, 0.52, 0.08, 32]} />
            {softMaterial(hatCol)}
          </mesh>
          {/* 本体（とんがり） */}
          <mesh position={[0, 0.46, 0]}>
            <coneGeometry args={[0.46, 0.9, 32]} />
            {softMaterial(hatCol)}
          </mesh>
          {/* リボン帯 */}
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.43, 0.46, 0.14, 32]} />
            {softMaterial(accent)}
          </mesh>
          {/* リボンの結び目 */}
          <mesh position={[0.34, 0.16, 0.28]} scale={[0.12, 0.1, 0.06]}>
            <sphereGeometry args={[1, 12, 12]} />
            {softMaterial(accent)}
          </mesh>
          {/* てっぺんの玉飾り */}
          <mesh position={[0, 0.95, 0]}>
            <sphereGeometry args={[0.1, 16, 16]} />
            {softMaterial(tip)}
          </mesh>
        </group>
      );
    }
    default:
      return null;
  }
}

// --- 漂うおまもり -------------------------------------------------------------
function Charm3D({ g }: { g: SpiritGene }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current) {
      ref.current.rotation.y = s.clock.elapsedTime * 1.2;
      ref.current.position.y = 0.3 + Math.sin(s.clock.elapsedTime * 1.5) * 0.12;
    }
  });
  if (g.charm === 'none') return null;
  const color = new THREE.Color(g.charm === 'gem' || g.charm === 'drop' ? '#8FE0FF' : '#FFE08A');
  return (
    <mesh ref={ref} position={[1.15, 0.3, 0.2]} scale={0.22}>
      {g.charm === 'gem' ? <octahedronGeometry args={[1]} /> : g.charm === 'drop' ? <sphereGeometry args={[1, 24, 24]} /> : <dodecahedronGeometry args={[1]} />}
      <meshStandardMaterial color={color} roughness={0.85} metalness={0} flatShading />
    </mesh>
  );
}

// しゃべりの口パク量（0=閉じ 1=開き）。休止と音節を合成。鼻と共有して同期。
function talkAmount(t: number) {
  const env = Math.max(0, Math.sin(t * 0.85)); // しゃべる/休むの波
  const syl = 0.5 + 0.5 * Math.sin(t * 11.0 + Math.sin(t * 5.0)); // 音節（少し不規則）
  return env * syl;
}

// 湾曲した横長楕円の口ジオメトリ（単一メッシュ）。corner>0 で口角上げ＝笑顔。
function makeMouthGeometry(w: number, corner: number) {
  const g = new THREE.SphereGeometry(1, 24, 16);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.x *= w; v.y *= 0.11; v.z *= 0.07;
    // 口角を控えめに反らせる（笑顔/への字）
    v.y += corner * 0.16 * (v.x * v.x) / (w * w);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// 有機的な鼻ジオメトリ（球ではなく、いびつな小さい塊）
function makeNoseGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    const d = 0.16 * Math.sin(n.y * 3.0) + 0.12 * Math.max(0, n.z) + 0.08 * n.x;
    v.multiplyScalar(1 + d);
    v.y *= 0.92; v.z *= 1.12;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// --- 口（湾曲した楕円・単一メッシュ。口パクでしゃべる）-----------------------
function Mouth3D({ mouth }: { mouth: SpiritGene['mouth'] }) {
  const grp = useRef<THREE.Group>(null);
  const w = mouth === 'tiny' ? 0.13 : mouth === 'o' ? 0.16 : 0.2;
  const corner = mouth === 'smile' || mouth === 'cat' ? 0.9 : mouth === 'wobble' ? 0.2 : -0.45;
  const geo = useMemo(() => makeMouthGeometry(w, corner), [w, corner]);

  useFrame((s) => {
    const a = talkAmount(s.clock.elapsedTime);
    // 開閉＝縦に控えめに伸縮。閉じ時は薄い線、開くと横長の楕円に
    if (grp.current) grp.current.scale.set(1 + a * 0.06, 0.45 + a * 1.0, 1);
  });

  return (
    <group position={[0, -0.32, 1.06]}>
      <group ref={grp}>
        <mesh geometry={geo}>
          <meshStandardMaterial color={'#2A2230'} roughness={0.85} />
        </mesh>
      </group>
    </group>
  );
}

// 形ごとの頂点 Y（かぶり物の位置）と腰 Y（脚の付け根）
const TOP_Y: Record<SpiritGene['shape'], number> = { round: 1.0, triangle: 1.18, box: 0.95, tall: 1.34, bean: 0.82, eggplant: 1.36 };
const HIP_Y: Record<SpiritGene['shape'], number> = { round: -0.96, triangle: -0.6, box: -0.9, tall: -1.05, bean: -0.74, eggplant: -1.05 };
const GROUND = -1.35; // 足が接地する地面の高さ

// --- 簡易 2 ボーン IK（関節つきの手足）---------------------------------------
const _up = new THREE.Vector3(0, 1, 0);
// a→b を結ぶ棒（高さ1の円柱）を mesh に反映
function placeBone(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz) || 1e-4;
  mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(_up, _tmp.set(dx / len, dy / len, dz / len));
}
const _tmp = new THREE.Vector3();
// 付け根 a・先端 e・骨長 l1,l2・曲げ方向 bend → 関節（ひざ/ひじ）位置を out に
function solveIK(a: THREE.Vector3, e: THREE.Vector3, l1: number, l2: number, bend: THREE.Vector3, out: THREE.Vector3) {
  const ax = e.x - a.x, ay = e.y - a.y, az = e.z - a.z;
  let d = Math.hypot(ax, ay, az) || 1e-4;
  d = Math.min(d, l1 + l2 - 1e-3);
  d = Math.max(d, Math.abs(l1 - l2) + 1e-3);
  const along = new THREE.Vector3(ax, ay, az).multiplyScalar(1 / Math.hypot(ax, ay, az));
  const cosA = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const a1 = Math.acos(cosA);
  const dot = bend.x * along.x + bend.y * along.y + bend.z * along.z;
  const perp = new THREE.Vector3(bend.x - along.x * dot, bend.y - along.y * dot, bend.z - along.z * dot);
  if (perp.lengthSq() < 1e-6) perp.set(0, 0, 1);
  perp.normalize();
  out.set(
    a.x + (along.x * Math.cos(a1) + perp.x * Math.sin(a1)) * l1,
    a.y + (along.y * Math.cos(a1) + perp.y * Math.sin(a1)) * l1,
    a.z + (along.z * Math.cos(a1) + perp.z * Math.sin(a1)) * l1
  );
}

// モーションプリセット
export type MotionPreset = 'idle' | 'wave' | 'dance' | 'greet' | 'jump' | 'turn';

// --- 精霊本体（接地して立ち・左右にゆれ・手を振る／関節つき手足）-------------
function Spirit({ gene, seed, motion = 'idle' }: { gene: SpiritGene; seed: string; motion?: MotionPreset }) {
  const g = gene;
  const { main, shade } = useMemo(() => bodyColors(g), [g]);
  const root = useRef<THREE.Group>(null); // 全体（ジャンプの上下）
  const bodyVis = useRef<THREE.Group>(null); // 体（ゆれ＆呼吸）
  const eyes = useRef<THREE.Group>(null);
  const nose = useRef<THREE.Mesh>(null); // 鼻（しゃべりで少し動く）
  const lBrow = useRef<THREE.Group>(null);
  const rBrow = useRef<THREE.Group>(null);
  const footMeshL = useRef<THREE.Mesh>(null);
  const footMeshR = useRef<THREE.Mesh>(null);
  const blob = useMemo(() => makeBlobGeometry(seed, g.shape), [seed, g.shape]);
  const noseGeo = useMemo(() => makeNoseGeometry(), []);
  const browTilt = useMemo(() => [-0.5, -0.25, 0, 0.3, 0.5][(hashSeed(seed + 'brow')() * 5) | 0], [seed]);

  // 体の横幅（肩位置に使用）
  const halfW =
    g.shape === 'box' ? 0.82 : g.shape === 'triangle' ? 0.58 : g.shape === 'tall' ? 0.6 : g.shape === 'bean' ? 0.9 : g.shape === 'eggplant' ? 0.5 : 0.72;
  const hipY = HIP_Y[g.shape];

  // 付け根アンカー（体の子。ゆれに追従させて world 座標を読む）
  const hipL = useRef<THREE.Object3D>(null);
  const hipR = useRef<THREE.Object3D>(null);
  const shL = useRef<THREE.Object3D>(null);
  const shR = useRef<THREE.Object3D>(null);
  // 骨・先端（root の子。IK で毎フレーム配置）
  const refs = {
    lThigh: useRef<THREE.Mesh>(null), lShin: useRef<THREE.Mesh>(null),
    rThigh: useRef<THREE.Mesh>(null), rShin: useRef<THREE.Mesh>(null),
    lUp: useRef<THREE.Mesh>(null), lFore: useRef<THREE.Mesh>(null), lHand: useRef<THREE.Mesh>(null),
    rUp: useRef<THREE.Mesh>(null), rFore: useRef<THREE.Mesh>(null), rHand: useRef<THREE.Mesh>(null),
  };

  // 固定の足位置（接地）
  const footL = useMemo(() => new THREE.Vector3(-0.24, GROUND, 0.12), []);
  const footR = useMemo(() => new THREE.Vector3(0.24, GROUND, 0.12), []);
  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const tmpE = useMemo(() => new THREE.Vector3(), []);
  const knee = useMemo(() => new THREE.Vector3(), []);
  const kneeBend = useMemo(() => new THREE.Vector3(0.1, -0.2, 1), []);

  useFrame((s) => {
    const t = s.clock.elapsedTime;

    // --- モーションごとの体のパラメータ ---
    let swayX = 0, bobY = 0, rotZ = 0, rotX = 0, rootY = 0, rootRotY = 0, browRaise = 0;
    // 腕の手先目標（肩相対オフセット）と脚の接地オフセット
    let armL = { x: 0, y: -0.4, z: 0.5 }, armR = { x: 0, y: -0.4, z: 0.5 };
    let footLiftL = 0, footLiftR = 0;
    if (motion === 'turn') {
      // その場でターン（くるくる回転）＋小ジャンプ＆左右ゆれ
      rootRotY = t * 2.2;
      const j = Math.max(0, Math.sin(t * 2.2));
      rootY = j * 0.18;
      swayX = Math.sin(t * 2.2) * 0.05;
      footLiftL = footLiftR = j * 0.12;
      armL = { x: -0.55, y: 0.1, z: 0.62 };
      armR = { x: 0.55, y: 0.1, z: 0.62 };
    } else if (motion === 'dance') {
      const b = t * 5;
      swayX = Math.sin(b) * 0.13;
      rotZ = -Math.sin(b) * 0.2;
      bobY = Math.abs(Math.sin(b)) * 0.07;
      footLiftL = Math.max(0, Math.sin(b)) * 0.14;
      footLiftR = Math.max(0, Math.sin(b + Math.PI)) * 0.14;
      // 両腕を上げて交互に振る
      armL = { x: -0.5, y: 0.45 + 0.18 * Math.sin(b), z: 0.62 };
      armR = { x: 0.5, y: 0.45 - 0.18 * Math.sin(b), z: 0.62 };
      browRaise = 0.05;
    } else if (motion === 'jump') {
      const j = Math.max(0, Math.sin(t * 3));
      rootY = j * 0.5;
      swayX = Math.sin(t * 3) * 0.07; // ジャンプ中に左右へ少し揺れる
      rotZ = -Math.sin(t * 3) * 0.06;
      footLiftL = footLiftR = j * 0.45; // 足を浮かせて脚をたたむ
      armL = { x: -0.45, y: 0.4 * j - 0.2, z: 0.6 };
      armR = { x: 0.45, y: 0.4 * j - 0.2, z: 0.6 };
      browRaise = 0.06 * j;
    } else if (motion === 'greet') {
      // おじぎ → 右手を上げて挨拶
      const c = (t % 4) / 4; // 0..1 ループ
      const bow = c < 0.5 ? Math.sin(c * Math.PI * 2) * 0.35 : 0;
      rotX = Math.max(0, bow);
      armL = { x: -0.45, y: -0.35, z: 0.6 };
      armR = { x: 0.5, y: 0.45, z: 0.68 }; // 手を上げて
      if (c >= 0.5) armR.x = 0.5 + 0.12 * Math.sin(t * 9); // 振る
      browRaise = 0.06;
    } else if (motion === 'wave') {
      swayX = Math.sin(t * 1.4) * 0.05;
      armL = { x: -0.55, y: 0.4, z: 0.68 };
      armR = { x: 0.55, y: 0.4, z: 0.68 };
      armL.x += 0.12 * Math.sin(t * 7);
      armR.x += 0.12 * Math.sin(t * 7 + 0.6);
      browRaise = 0.04;
    } else {
      // idle：左右にゆれ＋呼吸、右手だけ軽く振る
      const sw = Math.sin(t * 1.4);
      swayX = sw * 0.07;
      bobY = Math.abs(sw) * 0.05;
      rotZ = -sw * 0.08;
      armL = { x: -0.5, y: -0.38 + 0.05 * Math.sin(t * 2.3), z: 0.62 };
      armR = { x: 0.52 + 0.12 * Math.sin(t * 8), y: 0.4, z: 0.66 };
    }

    if (root.current) {
      root.current.position.y = rootY;
      root.current.rotation.y = rootRotY;
    }
    if (bodyVis.current) {
      bodyVis.current.position.x = swayX;
      bodyVis.current.position.y = bobY;
      bodyVis.current.rotation.z = rotZ;
      bodyVis.current.rotation.x = rotX;
      const br = Math.sin(t * 2.2) * 0.025;
      bodyVis.current.scale.set(1 + br, 1 - br, 1 + br);
    }
    // root 配下すべての行列を更新（アンカーの world 座標を正確に読むため）
    root.current?.updateMatrixWorld(true);
    if (eyes.current) {
      const blink = (t % 4) > 3.85 ? 0.1 : 1;
      eyes.current.scale.y += (blink - eyes.current.scale.y) * 0.4;
    }
    const talk = talkAmount(t);
    if (nose.current) {
      // 複雑な変形：各軸を別々の周波数で伸縮＋しゃべりで膨らむ＋ゆらゆら回転
      nose.current.scale.set(
        0.12 * (1 + 0.18 * Math.sin(t * 5.0) + talk * 0.12),
        0.1 * (1 + 0.24 * Math.sin(t * 7.0) + talk * 0.35),
        0.13 * (1 + 0.15 * Math.sin(t * 6.3))
      );
      nose.current.position.set(Math.sin(t * 3.3) * 0.012, -0.08 + talk * 0.03 + Math.sin(t * 4.0) * 0.006, 1.0);
      nose.current.rotation.set(Math.sin(t * 3.1) * 0.15, 0, Math.sin(t * 2.7) * 0.25);
    }
    // 眉：上下に動き、表情の傾き＋ゆらぎで豊かに
    const browWiggle = Math.sin(t * 1.1) * 0.1 + talk * 0.18;
    const by = 0.5 + browRaise + Math.sin(t * 1.3) * 0.03 + talk * 0.03;
    if (lBrow.current) { lBrow.current.position.y = by; lBrow.current.rotation.z = browTilt + browWiggle; }
    if (rBrow.current) { rBrow.current.position.y = by; rBrow.current.rotation.z = -browTilt - browWiggle; }

    // --- 脚：付け根→足先（root ローカル空間。ジャンプは root が上下、足はたたみ用に浮かす）---
    footL.y = GROUND + footLiftL;
    footR.y = GROUND + footLiftR;
    if (footMeshL.current) footMeshL.current.position.set(footL.x, footL.y, footL.z + 0.04);
    if (footMeshR.current) footMeshR.current.position.set(footR.x, footR.y, footR.z + 0.04);
    const placeLeg = (hip: THREE.Object3D | null, thigh: THREE.Mesh | null, shin: THREE.Mesh | null, foot: THREE.Vector3) => {
      if (!hip || !thigh || !shin || !root.current) return;
      hip.getWorldPosition(tmpA);
      root.current.worldToLocal(tmpA); // root ローカル空間へ（ジャンプ/ターンを相殺）
      const reach = tmpA.distanceTo(foot);
      const bone = Math.max(0.14, reach * 0.55);
      solveIK(tmpA, foot, bone, bone, kneeBend, knee);
      placeBone(thigh, tmpA, knee);
      placeBone(shin, knee, foot);
    };
    placeLeg(hipL.current, refs.lThigh.current, refs.lShin.current, footL);
    placeLeg(hipR.current, refs.rThigh.current, refs.rShin.current, footR);

    // --- 腕：肩→手先（プリセットのオフセット）---
    const placeArm = (
      sh: THREE.Object3D | null, up: THREE.Mesh | null, fore: THREE.Mesh | null, hand: THREE.Mesh | null,
      off: { x: number; y: number; z: number }, side: number
    ) => {
      if (!sh || !up || !fore || !hand || !root.current) return;
      sh.getWorldPosition(tmpA);
      root.current.worldToLocal(tmpA);
      tmpE.set(tmpA.x + off.x, tmpA.y + off.y, tmpA.z + off.z);
      hand.position.copy(tmpE);
      const reach = tmpA.distanceTo(tmpE);
      const bone = Math.max(0.14, reach * 0.55);
      const bend = _tmp.set(side * 0.6, -0.5, 0.6);
      solveIK(tmpA, tmpE, bone, bone, bend, knee);
      placeBone(up, tmpA, knee);
      placeBone(fore, knee, tmpE);
    };
    placeArm(shL.current, refs.lUp.current, refs.lFore.current, refs.lHand.current, armL, -1);
    placeArm(shR.current, refs.rUp.current, refs.rFore.current, refs.rHand.current, armR, 1);
  });

  // 黒い棒（骨）用マテリアル：1 つを共有
  const limbMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2A2230', roughness: 0.9 }), []);

  return (
    <group ref={root}>
      {/* 体（ゆれ＆呼吸する見た目。手足の付け根アンカーを内包） */}
      <group ref={bodyVis}>
        <mesh castShadow geometry={blob}>{softMaterial(main)}</mesh>

        <group position={[0, TOP_Y[g.shape] - 1.0, 0]}>
          <Top3D g={g} shade={shade} />
        </group>

        {/* 眉（湾曲した弧。左右対称＝同じ向きの ⌒。豊かに上下＆傾く） */}
        {[-1, 1].map((s) => (
          <group key={s} ref={s < 0 ? lBrow : rBrow} position={[s * 0.34, 0.5, 1.06]}>
            {/* 弧を前へ向けて浮かせ、めり込み防止。やや扁平な ⌒ */}
            <mesh rotation={[0, 0, (Math.PI - 2.0) / 2]} scale={[1, 0.7, 1]}>
              <torusGeometry args={[0.13, 0.028, 6, 16, 2.0]} />
              <meshStandardMaterial color={'#2A2230'} roughness={0.9} />
            </mesh>
          </group>
        ))}

        <group ref={eyes}>
          {[-0.34, 0.34].map((x) => (
            <group key={x}>
              <mesh position={[x, 0.14, 0.86]} scale={[0.2, 0.24, 0.16]}>
                <sphereGeometry args={[1, 28, 28]} />
                <meshStandardMaterial color={'#ffffff'} roughness={0.85} />
              </mesh>
              <mesh position={[x + 0.02, 0.12, 1.0]}>
                <sphereGeometry args={[0.13, 24, 24]} />
                <meshStandardMaterial color={'#2A2230'} roughness={0.7} />
              </mesh>
            </group>
          ))}
        </group>

        <mesh ref={nose} geometry={noseGeo} position={[0, -0.08, 1.0]}>
          <meshStandardMaterial color={shade} roughness={0.95} metalness={0} onBeforeCompile={patchNoise} />
        </mesh>

        <Mouth3D mouth={g.mouth} />

        {g.cheek &&
          [-0.58, 0.58].map((x) => (
            <mesh key={x} position={[x, -0.14, 0.78]} scale={[0.18, 0.12, 0.1]}>
              <sphereGeometry args={[1, 20, 20]} />
              <meshStandardMaterial color={'#FF8FA8'} transparent opacity={0.55} roughness={0.95} />
            </mesh>
          ))}

        {/* 付け根アンカー（不可視） */}
        <object3D ref={hipL} position={[-0.22, hipY, 0.05]} />
        <object3D ref={hipR} position={[0.22, hipY, 0.05]} />
        <object3D ref={shL} position={[-halfW, -0.05, 0.42]} />
        <object3D ref={shR} position={[halfW, -0.05, 0.42]} />
      </group>

      {/* 脚（関節つき・接地） */}
      <mesh ref={refs.lThigh} material={limbMaterial}><cylinderGeometry args={[0.03, 0.03, 1, 8]} /></mesh>
      <mesh ref={refs.lShin} material={limbMaterial}><cylinderGeometry args={[0.03, 0.03, 1, 8]} /></mesh>
      <mesh ref={refs.rThigh} material={limbMaterial}><cylinderGeometry args={[0.03, 0.03, 1, 8]} /></mesh>
      <mesh ref={refs.rShin} material={limbMaterial}><cylinderGeometry args={[0.03, 0.03, 1, 8]} /></mesh>
      {/* 足先 */}
      <mesh ref={footMeshL} position={[footL.x, footL.y, footL.z + 0.04]} scale={[0.08, 0.05, 0.13]} material={limbMaterial}>
        <sphereGeometry args={[1, 12, 12]} />
      </mesh>
      <mesh ref={footMeshR} position={[footR.x, footR.y, footR.z + 0.04]} scale={[0.08, 0.05, 0.13]} material={limbMaterial}>
        <sphereGeometry args={[1, 12, 12]} />
      </mesh>

      {/* 腕（関節つき・手を振る） */}
      {g.arms !== 'none' && (
        <>
          <mesh ref={refs.lUp} material={limbMaterial}><cylinderGeometry args={[0.028, 0.028, 1, 8]} /></mesh>
          <mesh ref={refs.lFore} material={limbMaterial}><cylinderGeometry args={[0.028, 0.028, 1, 8]} /></mesh>
          <mesh ref={refs.lHand} material={limbMaterial}><sphereGeometry args={[0.06, 12, 12]} /></mesh>
          <mesh ref={refs.rUp} material={limbMaterial}><cylinderGeometry args={[0.028, 0.028, 1, 8]} /></mesh>
          <mesh ref={refs.rFore} material={limbMaterial}><cylinderGeometry args={[0.028, 0.028, 1, 8]} /></mesh>
          <mesh ref={refs.rHand} material={limbMaterial}><sphereGeometry args={[0.06, 12, 12]} /></mesh>
        </>
      )}

      <Charm3D g={g} />
    </group>
  );
}

interface CanvasProps {
  seed?: string;
  gene?: SpiritGene;
  /** 背景色。省略すると透過（AR でカメラに重ねる用） */
  background?: string;
  /** モーションプリセット（idle/wave/dance/greet/jump） */
  motion?: MotionPreset;
  className?: string;
  style?: React.CSSProperties;
}

export default function SpiritCanvas({ seed = 'kami', gene, background, motion = 'idle', className, style }: CanvasProps) {
  const g = useMemo(() => gene ?? geneFromSeed(seed), [gene, seed]);
  return (
    <Canvas
      className={className}
      style={style}
      shadows
      dpr={[1, 2]}
      gl={{ alpha: !background, antialias: true, preserveDrawingBuffer: true }}
      camera={{ position: [0, 0.3, 4.2], fov: 40 }}
    >
      {background && <color attach="background" args={[background]} />}
      {/* イラスト調を保ちつつ顔に陰影を出す（前上からの主光＋やわらかい補助光） */}
      <hemisphereLight args={['#ffffff', '#dcdce6', 0.85]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[2.5, 3.5, 4]} intensity={1.15} castShadow />
      <directionalLight position={[-3, 1, 1]} intensity={0.25} color={'#bcd0e0'} />
      <Spirit gene={g} seed={seed} motion={motion} />
      <ContactShadows position={[0, -1.34, 0]} opacity={0.3} scale={5} blur={2.6} far={3} />
    </Canvas>
  );
}
