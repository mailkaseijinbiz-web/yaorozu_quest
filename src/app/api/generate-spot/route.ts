// GPS 座標から場（Spot）と神（Agent）を生成する API
// POST { lat, lng }  →  { spot: Spot, agent: Agent, source: 'osm' | 'ai' | 'fallback' }
//
// 方針:「場は意味のある実在の場所であるべき」。
//   1) まず OSM(Overpass) で近くの実在スポットを探す（実在優先）。
//      見つかれば実在の名称・座標・カテゴリを採用し、説明や神格を付与する（source: 'osm'）。
//   2) 近くに実在の場が無いときだけ、従来どおり Gemini が場を発明する（source: 'ai'）。
//   3) Gemini も使えなければ汎用フォールバック（source: 'fallback'）。
// 実在スポット(source:'osm')は verified=true、TTL（expiresAt）を付けない＝期限切れで消えない。
import { NextResponse } from 'next/server';
import { lookupRealPlaces, CATEGORIES, type RealPlace, type Category } from '../../../lib/overpass';

// 外部 API（Overpass + Gemini）を順に叩くため、関数の最大実行時間を明示（既定の短いタイムアウトで殺されない）。
export const maxDuration = 30;

const VOICE_TONES = ['厳格', '親しみやすい', '神秘的', '高飛車', '賢者'] as const;
type VoiceTone = (typeof VOICE_TONES)[number];
const HALO_COLORS = ['#FFD700', '#FF4500', '#1E90FF', '#32CD32', '#FF69B4', '#9370DB', '#40E0D0', '#FF8C00'];

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── カテゴリ別の神格テンプレ（Gemini 不在時の味付けに使う） ───────────────────
const PERSONA: Record<Category, { emoji: string; god: string; tone: VoiceTone }> = {
  '神社': { emoji: '⛩️', god: '杜の守り神', tone: '神秘的' },
  '寺院': { emoji: '🙏', god: '御仏の使い', tone: '賢者' },
};

function templateFlavor(name: string, category: Category): { enjoyments: string[]; issues: string[] } {
  const enjoy: Record<Category, string[]> = {
    '神社': [`${name}の鳥居をくぐり参道を歩く`, '静かに参拝して心を整える', '境内の四季の移ろいを感じる'],
    '寺院': [`${name}の山門をくぐり本堂を仰ぐ`, '線香の香りの中で手を合わせる', '庭や石畳の静けさを味わう'],
  };
  const issue: Record<Category, string[]> = {
    '神社': ['参道脇の落ち葉やゴミを一袋拾う', '由緒書きの薄れた箇所を写真に残す'],
    '寺院': ['案内の薄い角に道標写真を一枚足す', '静けさを乱す放置ゴミを一つ片付ける'],
  };
  return { enjoyments: enjoy[category], issues: issue[category] };
}

// ── 実在スポット(OSM)を Gemini で味付けして {spot, agent} を作る ──────────────
interface GeminiFlavor {
  description: string;
  enjoyments: string[];
  issues: string[];
  godName: string;
  godEmoji: string;
  godPersona: string;
  godSystemPrompt: string;
  voiceTone: VoiceTone;
  godRequests: string[];
  haloColor: string;
}

async function enrichWithGemini(real: RealPlace, geminiKey: string): Promise<GeminiFlavor | null> {
  const prompt = `
「${real.name}」は日本に実在する${real.category}です（緯度${real.latitude.toFixed(5)}, 経度${real.longitude.toFixed(5)}）。
この実在の場所を巡礼地として紹介する情報を作成してください。実在の場所なので名前は変更しないこと。
以下の JSON のみを出力（コードブロック・説明文は不要）:
{
  "description": "場所の説明（2〜3文・80字以内）",
  "enjoyments": ["この場の楽しみ方1", "2", "3"],
  "issues": ["巡礼者が一手で動かせる課題1", "2"],
  "godName": "${real.name}に宿る神の名前（例: 〜の守り神）",
  "godEmoji": "神を表す絵文字1文字",
  "godPersona": "神の人格説明（1文・50字以内）",
  "godSystemPrompt": "神のシステムプロンプト（口調・語り口、100字以内）",
  "voiceTone": "${VOICE_TONES.join(' | ')} のいずれか",
  "godRequests": ["神からの一言リクエスト1", "2"],
  "haloColor": "神のハロー色（#RRGGBB）"
}`.trim();

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const gData = await res.json();
  const raw = gData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('no JSON in response');
  const g = JSON.parse(jsonMatch[0]);

  const tmpl = templateFlavor(real.name, real.category);
  const persona = PERSONA[real.category];
  const enjoyments = Array.isArray(g.enjoyments) && g.enjoyments.length
    ? g.enjoyments.slice(0, 5).map(String)
    : tmpl.enjoyments;
  const issues = Array.isArray(g.issues) && g.issues.length
    ? g.issues.slice(0, 3).map(String)
    : tmpl.issues;
  return {
    description: String(g.description || `${real.name}（${real.category}）。実在するこの地に神霊が静かに息づいている。`).slice(0, 200),
    enjoyments,
    issues,
    godName: String(g.godName || `${real.name}の${persona.god}`).slice(0, 30),
    godEmoji: String(g.godEmoji || persona.emoji).slice(0, 2),
    godPersona: String(g.godPersona || `${real.name}に宿る${persona.god}。`).slice(0, 100),
    godSystemPrompt: String(g.godSystemPrompt || `あなたは実在する「${real.name}」(${real.category})に宿る神霊です。この場所の魅力を伝えてください。返答は150字以内。`).slice(0, 300),
    voiceTone: (VOICE_TONES as readonly string[]).includes(g.voiceTone) ? g.voiceTone : persona.tone,
    godRequests: Array.isArray(g.godRequests) && g.godRequests.length
      ? g.godRequests.slice(0, 5).map(String)
      : [`${persona.emoji} ${real.name}の今の様子を写真に撮ってほしいのじゃ`, 'この場の良いところを一つ教えてくれぬか'],
    haloColor: /^#[0-9A-Fa-f]{6}$/.test(g.haloColor) ? g.haloColor : HALO_COLORS[real.osmId % HALO_COLORS.length],
  };
}

/** 実在スポット(OSM) → {spot, agent}。Gemini があれば味付け、無ければテンプレ。 */
async function buildRealSpot(real: RealPlace, geminiKey?: string) {
  const base = {
    id: real.id,
    name: real.name,
    latitude: real.latitude,
    longitude: real.longitude,
    creatorId: null,
    imageUrl: '', // 写真はユーザーが奉納するまで NO IMAGE
    category: real.category,
    tokuRequirement: 0,
    difficulty: 1,
    terrain: 1,
    attributes: [] as string[],
    cacheType: 'Virtual',
    verified: true, // OSM 由来＝実在。TTL は付けない（呼び出し側で expiresAt を付けない）。
  };

  let flavor: GeminiFlavor;
  if (geminiKey) {
    try {
      const g = await enrichWithGemini(real, geminiKey);
      if (g) {
        flavor = g;
      } else {
        throw new Error('empty flavor');
      }
    } catch (err) {
      console.error('[generate-spot] enrich fallback (template):', err);
      flavor = templateFlavorFull(real);
    }
  } else {
    flavor = templateFlavorFull(real);
  }

  const spot = {
    ...base,
    description: flavor.description,
    enjoyments: flavor.enjoyments,
    issues: flavor.issues,
    godName: flavor.godName,
    godEmoji: flavor.godEmoji,
    godRequests: flavor.godRequests,
  };
  const agent = {
    // spot id から決定的に導出＝再訪/並列生成でも同一神を upsert（重複神レコードを作らない）。
    id: `agent-${real.id}`,
    spotId: real.id,
    name: flavor.godName,
    personaDescription: flavor.godPersona,
    systemPrompt: flavor.godSystemPrompt,
    avatar3dUrl: 'spirit',
    haloColor: flavor.haloColor,
    accessoryType: 'なし',
    voiceTone: flavor.voiceTone,
  };
  return { spot, agent };
}

function templateFlavorFull(real: RealPlace): GeminiFlavor {
  const persona = PERSONA[real.category];
  const { enjoyments, issues } = templateFlavor(real.name, real.category);
  const godName = `${real.name}の${persona.god}`;
  return {
    description: `${real.name}（${real.category}）。実在するこの地に宿る神霊が、訪れる人を静かに見守っている。`,
    enjoyments,
    issues,
    godName,
    godEmoji: persona.emoji,
    godPersona: `${real.name}に宿る${persona.god}。実在するこの地を見守っている。`,
    godSystemPrompt: `あなたは実在する「${real.name}」(${real.category})に宿る神霊「${godName}」です。${persona.tone}な口調で、この場所の魅力や歴史を訪れた人に伝えてください。返答は150字以内。`,
    voiceTone: persona.tone,
    godRequests: [`${persona.emoji} ${real.name}の今の様子を写真に撮ってほしいのじゃ`, 'この場の良いところを一つ教えてくれぬか'],
    haloColor: HALO_COLORS[real.osmId % HALO_COLORS.length],
  };
}

// ── 実在の場が見つからないときの AI 発明（従来の挙動・フォールバック） ──────────
function fallbackSpot(lat: number, lng: number) {
  const id = randomId('gps');
  return {
    spot: {
      id,
      name: `GPS地点 (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      description: 'この地点に宿る神霊が静かに息づいている。',
      latitude: lat,
      longitude: lng,
      creatorId: null,
      imageUrl: '',
      category: '神社',
      tokuRequirement: 0,
      enjoyments: ['その場の空気を感じる'],
      difficulty: 1,
      terrain: 1,
      attributes: [],
      cacheType: 'Virtual',
      godName: 'この地の守り神',
      godEmoji: '⛩️',
      godRequests: ['この場所を訪れてください'],
      verified: false,
      issues: [],
    },
    agent: {
      id: randomId('agent'),
      spotId: id,
      name: 'この地の守り神',
      personaDescription: 'この場所に宿る神霊。静かに場を見守っている。',
      systemPrompt: `あなたはこの地点（緯度${lat.toFixed(4)}, 経度${lng.toFixed(4)}）に宿る神霊です。この場所を訪れた人を温かく迎え、場所の魅力を伝えてください。返答は150字以内。`,
      avatar3dUrl: 'spirit',
      haloColor: '#FFD700',
      accessoryType: 'なし',
      voiceTone: '親しみやすい' as const,
    },
  };
}

async function inventWithGemini(lat: number, lng: number, geminiKey: string) {
  const prompt = `
あなたは日本の地域情報に詳しいAIです。
以下のGPS座標（日本国内）に実在しそうな寺社（神社または寺院）を1件生成してください。

緯度: ${lat.toFixed(6)}
経度: ${lng.toFixed(6)}

以下のJSON形式で出力してください（コードブロック・説明文は不要、JSONのみ）:
{
  "name": "寺社の名前（実在感のある和風の名前）",
  "description": "場所の説明（2〜3文、80字以内）",
  "category": "${CATEGORIES.join(' | ')} のいずれか",
  "godName": "この場に宿る神の名前（例: 〜の守り神、〜の精霊）",
  "godEmoji": "神を表す絵文字1文字",
  "godPersona": "神の人格説明（1文、50字以内）",
  "godSystemPrompt": "神のシステムプロンプト（口調・語り口・返答スタイル、100字以内）",
  "voiceTone": "${VOICE_TONES.join(' | ')} のいずれか",
  "haloColor": "神のハロー色（16進数カラーコード）",
  "enjoyments": ["この場の楽しみ方1", "楽しみ方2"],
  "issues": ["この場の課題1"],
  "godRequests": ["神からの一言リクエスト1", "リクエスト2"]
}`.trim();

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const gData = await res.json();
  const raw = gData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('no JSON in response');
  const g = JSON.parse(jsonMatch[0]);

  const spotId = randomId('gps');
  const spot = {
    id: spotId,
    name: String(g.name || `地点 ${lat.toFixed(3)},${lng.toFixed(3)}`).slice(0, 40),
    description: String(g.description || '').slice(0, 200),
    latitude: lat,
    longitude: lng,
    creatorId: null,
    imageUrl: '',
    category: CATEGORIES.includes(g.category) ? g.category : '神社',
    tokuRequirement: 0,
    enjoyments: Array.isArray(g.enjoyments) ? g.enjoyments.slice(0, 5).map(String) : [],
    difficulty: 1,
    terrain: 1,
    attributes: [],
    cacheType: 'Virtual',
    godName: String(g.godName || 'この地の守り神').slice(0, 30),
    godEmoji: String(g.godEmoji || '⛩️').slice(0, 2),
    godRequests: Array.isArray(g.godRequests) ? g.godRequests.slice(0, 5).map(String) : [],
    verified: false,
    issues: Array.isArray(g.issues) ? g.issues.slice(0, 3).map(String) : [],
  };
  const agent = {
    id: randomId('agent'),
    spotId,
    name: spot.godName,
    personaDescription: String(g.godPersona || '').slice(0, 100),
    systemPrompt: String(g.godSystemPrompt || `あなたは「${spot.name}」に宿る${spot.godName}です。この場所の魅力を伝えてください。返答は150字以内。`).slice(0, 300),
    avatar3dUrl: 'spirit',
    haloColor: /^#[0-9A-Fa-f]{6}$/.test(g.haloColor) ? g.haloColor : HALO_COLORS[Math.floor(Math.random() * HALO_COLORS.length)],
    accessoryType: 'なし',
    voiceTone: (VOICE_TONES as readonly string[]).includes(g.voiceTone) ? g.voiceTone : '親しみやすい',
  };
  return { spot, agent };
}

export async function POST(request: Request) {
  let body: { lat?: number; lng?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { lat, lng } = body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const geminiKey = process.env.GEMINI_API_KEY;

  // 1) 実在優先：OSM(Overpass) で近くの実在の寺社（神社・寺院）を探す。
  //    寺社のみに絞った分ヒット密度が下がるため、半径を広げて取りこぼしを防ぐ（最寄り1件を採用）。
  let real: RealPlace | null = null;
  try {
    real = (await lookupRealPlaces(lat, lng, 2500, 8))[0] ?? null;
  } catch (err) {
    console.error('[generate-spot] overpass error:', err);
  }
  if (real) {
    const { spot, agent } = await buildRealSpot(real, geminiKey);
    return NextResponse.json({ spot, agent, source: 'osm' });
  }

  // 2) 近くに実在の場が無い → AI が場を発明（フォールバック）
  if (!geminiKey) {
    return NextResponse.json({ ...fallbackSpot(lat, lng), source: 'fallback' });
  }
  try {
    const { spot, agent } = await inventWithGemini(lat, lng, geminiKey);
    return NextResponse.json({ spot, agent, source: 'ai' });
  } catch (err) {
    console.error('[generate-spot] fallback:', err);
    return NextResponse.json({ ...fallbackSpot(lat, lng), source: 'fallback' });
  }
}
