// GPS 座標から場（Spot）と神（Agent）を生成する API
// POST { lat, lng }  →  { spot: Spot, agent: Agent, source: 'osm' } | 404 { error: 'no_real_place' }
//
// 方針:「場は実在の場所のみ」。OSM(Overpass) で近くの実在の寺社を探し、
// 見つかれば実在の名称・座標・カテゴリを採用して説明や神格を付与する（source: 'osm'）。
// 近くに実在の場が無ければ 404 を返す＝AI が架空の場を発明したり
// 「GPS地点 (lat, lng)」のようなプレースホルダーを作ったりはしない。
// 実在スポットは verified=true、TTL（expiresAt）を付けない＝期限切れで消えない。
import { NextResponse } from 'next/server';
import { lookupRealPlaces, type RealPlace, type Category } from '../../../lib/overpass';

// 外部 API（Overpass + Gemini）を順に叩くため、関数の最大実行時間を明示（既定の短いタイムアウトで殺されない）。
export const maxDuration = 30;

const VOICE_TONES = ['厳格', '親しみやすい', '神秘的', '高飛車', '賢者'] as const;
type VoiceTone = (typeof VOICE_TONES)[number];
const HALO_COLORS = ['#FFD700', '#FF4500', '#1E90FF', '#32CD32', '#FF69B4', '#9370DB', '#40E0D0', '#FF8C00'];

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
  //    最寄り1件だけでなく周辺もまとめて返す。大寺院（例: 善光寺）の境内・門前には
  //    子院・祠が密集しており、「最寄り1件」方式だとそちらに取られて本体が
  //    いつまでも地図に出ない問題があったため。
  let places: RealPlace[] = [];
  try {
    places = await lookupRealPlaces(lat, lng, 2500, 8);
  } catch (err) {
    console.error('[generate-spot] overpass error:', err);
  }
  const real = places[0] ?? null;
  if (real) {
    const { spot, agent } = await buildRealSpot(real, geminiKey);
    // 2件目以降はテンプレ味付け（Gemini は最寄り1件のみ＝API 消費を増やさない）
    const extras = await Promise.all(places.slice(1).map((p) => buildRealSpot(p)));
    return NextResponse.json({ spot, agent, extras, source: 'osm' });
  }

  // 2) 近くに実在の場が無い → 生成しない（架空の場やプレースホルダーは作らない）
  return NextResponse.json({ error: 'no_real_place' }, { status: 404 });
}
