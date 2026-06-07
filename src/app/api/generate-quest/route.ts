// Yaorozu God OS - AI Quest Generator (OpenAI + Rule-based Fallback)
import { NextResponse } from 'next/server';

interface SpotInput {
  name: string;
  category: string;
  description?: string;
  enjoyments?: string[];
}

export interface GeneratedQuest {
  title: string;
  description: string;
  reward: number;
  targetSpotName: string;
}

const REWARD_TIERS = [20, 30, 50, 80];

// ── ルールベースのフォールバック生成（OpenAIキーが無いとき） ──
function fallbackQuests(spot: SpotInput, count: number): GeneratedQuest[] {
  const enjoy = spot.enjoyments ?? [];
  const templates: { title: (s: string) => string; description: (s: string, e?: string) => string }[] = [
    {
      title: (s) => `${s}の語り部`,
      description: (s) => `${s}を訪れ、心に残った風景や発見を口コミ（UGC）として投稿しよう。`,
    },
    {
      title: (s) => `${s}で神霊と対話`,
      description: (s) => `${s}に宿る神様（AIエージェント）に話しかけ、この土地の物語を聴こう。`,
    },
    {
      title: (s) => `${s}の一枚`,
      description: (s, e) => `${s}で${e ? `「${e}」を` : 'お気に入りの構図を'}AR召喚し、写真に収めよう。`,
    },
    {
      title: (s) => `${s}巡礼`,
      description: (s) => `${s}の周辺1km以内に近づき、参拝の証を立てよう（ワープ可）。`,
    },
    {
      title: (s) => `${s}の徳を積む`,
      description: (s) => `${s}で徳を積み、創世主ランキング上位を目指そう。`,
    },
  ];

  const quests: GeneratedQuest[] = [];
  for (let i = 0; i < count; i++) {
    const t = templates[i % templates.length];
    const e = enjoy[i % Math.max(1, enjoy.length)];
    quests.push({
      title: t.title(spot.name),
      description: t.description(spot.name, e),
      reward: REWARD_TIERS[i % REWARD_TIERS.length],
      targetSpotName: spot.name,
    });
  }
  return quests;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const spot: SpotInput = body.spot;
    const count: number = Math.min(5, Math.max(1, Number(body.count) || 3));

    if (!spot?.name) {
      return NextResponse.json({ error: 'spot.name is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    // キーが無ければルールベースで生成
    if (!apiKey) {
      return NextResponse.json({ quests: fallbackQuests(spot, count), source: 'fallback' });
    }

    const prompt = `あなたは位置情報巡礼ゲーム「八百万クエスト」のクエストデザイナーです。
以下のスポットを訪れたくなる、街歩き型のクエストを${count}個、日本語で考えてください。

スポット名: ${spot.name}
カテゴリ: ${spot.category}
説明: ${spot.description ?? ''}
楽しみ方: ${(spot.enjoyments ?? []).join(' / ')}

各クエストは現地で実際に行動できる内容にし、必ず次のJSON配列だけを出力してください（前後に文章を付けない）:
[{"title":"短いクエスト名","description":"100字以内の行動指示","reward":報酬徳(10〜100の整数),"targetSpotName":"${spot.name}"}]`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
      }),
    });

    if (!openaiResponse.ok) {
      return NextResponse.json({ quests: fallbackQuests(spot, count), source: 'fallback' });
    }

    const data = await openaiResponse.json();
    const text: string = data.choices?.[0]?.message?.content ?? '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ quests: fallbackQuests(spot, count), source: 'fallback' });
    }

    const parsed = JSON.parse(match[0]) as GeneratedQuest[];
    const quests = parsed.slice(0, count).map((q) => ({
      title: String(q.title).slice(0, 30),
      description: String(q.description).slice(0, 100),
      reward: Math.min(100, Math.max(10, Math.round(Number(q.reward) || 30))),
      targetSpotName: spot.name,
    }));

    return NextResponse.json({ quests, source: 'openai' });
  } catch {
    return NextResponse.json({ error: 'generation failed' }, { status: 500 });
  }
}
