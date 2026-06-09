// GPS 座標から場（Spot）と神（Agent）を Gemini で自動生成する API
// POST { lat, lng }  →  { spot: Spot, agent: Agent }
import { NextResponse } from 'next/server';

const CATEGORIES = ['神社', '寺院', '公園', '商店街', '広場', '史跡', '自然', '文化施設', '川・池', '坂・路地'];
const VOICE_TONES = ['厳格', '親しみやすい', '神秘的', '高飛車', '賢者'] as const;
const HALO_COLORS = ['#FFD700', '#FF4500', '#1E90FF', '#32CD32', '#FF69B4', '#9370DB', '#40E0D0', '#FF8C00'];

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

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
      imageUrl: '', // 画像は自動設定しない（ユーザーが写真を奉納するまで NO IMAGE）
      category: '史跡',
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
  if (!geminiKey) {
    return NextResponse.json(fallbackSpot(lat, lng));
  }

  const prompt = `
あなたは日本の地域情報に詳しいAIです。
以下のGPS座標（日本国内）に実在しそうな場所（神社・寺・公園・商店街・史跡など）を1件生成してください。

緯度: ${lat.toFixed(6)}
経度: ${lng.toFixed(6)}

以下のJSON形式で出力してください（コードブロック・説明文は不要、JSONのみ）:
{
  "name": "場所の名前（実在感のある和風の名前）",
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
}
`.trim();

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
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
      imageUrl: '', // 画像は自動設定しない（ユーザーが写真を奉納するまで NO IMAGE）
      category: CATEGORIES.includes(g.category) ? g.category : '史跡',
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

    return NextResponse.json({ spot, agent });
  } catch (err) {
    console.error('[generate-spot] fallback:', err);
    return NextResponse.json(fallbackSpot(lat, lng));
  }
}
