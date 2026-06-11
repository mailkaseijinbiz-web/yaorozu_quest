// Yaorozu God OS - Chat API Route with OpenAI & Rule-based Fallback
import { NextResponse } from 'next/server';

// Interface matching DB types inside API
interface Agent {
  name: string;
  systemPrompt: string;
  voiceTone: string;
}

interface UgcPost {
  content: string;
  userDisplayName: string;
}

interface AffiliateLink {
  title: string;
  category: string;
  url: string;
  priceRange: string;
  rating: number;
}

interface SpotContext {
  name: string;
  category: string;
  description: string;
  enjoyments: string[];
  godName?: string;
}

// spot 情報に基づく動的フォールバック（個別Agent未登録のスポット用）
function getSpotFallbackResponse(
  message: string,
  spot: SpotContext,
  ugc: UgcPost[],
  affiliates: AffiliateLink[],
  godName: string
): string {
  const msg = message.toLowerCase();
  const wantsFood = msg.includes('飯') || msg.includes('食') || msg.includes('おいしい') || msg.includes('ランチ') || msg.includes('店') || msg.includes('グルメ') || msg.includes('ディナー');
  const wantsHotel = msg.includes('宿') || msg.includes('泊') || msg.includes('ホテル') || msg.includes('旅館');
  const wantsActivity = msg.includes('体験') || msg.includes('ツアー') || msg.includes('遊') || msg.includes('観光') || msg.includes('見どころ') || msg.includes('おすすめ') || msg.includes('楽し') || msg.includes('何');
  const wantsHistory = msg.includes('歴史') || msg.includes('由来') || msg.includes('起源') || msg.includes('豆知識') || msg.includes('知識') || msg.includes('いつ') || msg.includes('どんな');

  const restaurant = affiliates.find(a => a.category === 'restaurant');
  const hotel = affiliates.find(a => a.category === 'hotel');
  const activity = affiliates.find(a => a.category === 'activity');
  const randomUgc = ugc.length > 0 ? ugc[Math.floor(Math.random() * ugc.length)] : null;
  const enjoy = spot.enjoyments && spot.enjoyments.length > 0
    ? spot.enjoyments[Math.floor(Math.random() * spot.enjoyments.length)]
    : null;

  if (wantsFood) {
    if (restaurant) return `ほう、腹が減ったか。${spot.name}の界隈なら「${restaurant.title}」がよいぞ。立ち寄ってみるがよい。 (${restaurant.url})`;
    return `この${spot.name}の周りには、地元に愛される小さな店が多い。歩きながら気になる暖簾をくぐってみるのも一興じゃ。`;
  }
  if (wantsHotel) {
    if (hotel) return `旅の疲れを癒やすなら「${hotel.title}」がよかろう。ゆるりと体を休めるがよい。 (${hotel.url})`;
    return `この辺りは都心ゆえ、宿には事欠かぬ。新中野・中野駅の周辺を探せば、よき宿が見つかるじゃろう。`;
  }
  if (wantsActivity && activity) {
    return `この地を深く味わうなら「${activity.title}」もよいぞ。新たな発見があるじゃろう。 (${activity.url})`;
  }
  if (wantsHistory) {
    return `${spot.name}はな…${spot.description} 古きを訪ねて新しきを知る、よき心がけじゃ。`;
  }
  if (randomUgc) {
    return `ある巡礼者、${randomUgc.userDisplayName}がこう申しておった。「${randomUgc.content.substring(0, 60)}…」とな。参考にするがよい。`;
  }
  if (enjoy) {
    return `わしは${godName}。この${spot.name}での過ごし方を一つ授けよう——「${enjoy}」。ゆるりと楽しむがよい。`;
  }
  return `わしは${spot.name}に宿る${godName}じゃ。${spot.description} さあ、何が知りたい？歴史でも、見どころでも、尋ねるがよい。`;
}

// Local mock templates for when OpenAI API key is missing
function getFallbackResponse(
  message: string,
  agent: Agent,
  ugc: UgcPost[],
  affiliates: AffiliateLink[],
  userName: string
): string {
  const msg = message.toLowerCase();
  
  // 1. Identify intent
  const wantsFood = msg.includes('飯') || msg.includes('食') || msg.includes('おいしい') || msg.includes('ランチ') || msg.includes('店') || msg.includes('ディナー');
  const wantsHotel = msg.includes('宿') || msg.includes('泊') || msg.includes('ホテル') || msg.includes('旅館');
  const wantsActivity = msg.includes('体験') || msg.includes('ツアー') || msg.includes('遊ぶ') || msg.includes('観光') || msg.includes('写真') || msg.includes('何する');
  const wantsHistory = msg.includes('歴史') || msg.includes('由来') || msg.includes('起源') || msg.includes('豆知識') || msg.includes('知識');

  // Find relevant affiliates
  const restaurant = affiliates.find(a => a.category === 'restaurant');
  const hotel = affiliates.find(a => a.category === 'hotel');
  const activity = affiliates.find(a => a.category === 'activity');

  // Grab a random UGC post for RAG simulation
  const randomUgc = ugc.length > 0 ? ugc[Math.floor(Math.random() * ugc.length)] : null;

  // 2. Generate persona-based replies
  switch (agent.voiceTone) {
    case '親しみやすい': // e.g. Sensoji Gold Dragon (べらんめえ調)
      if (wantsFood && restaurant) {
        return `おぅおぅ！浅草で食うなら「${restaurant.title}」が最高でぃ！美味い天ぷらが食えるぜ。ここからすぐだから行ってみな！ (${restaurant.url})`;
      }
      if (wantsHotel && hotel) {
        return `宿を探してんのかい？それなら「${hotel.title}」がおすすめだぜぃ！スカイツリーがバッチリ見える絶景ホテルだ！ (${hotel.url})`;
      }
      if (wantsActivity && activity) {
        return `おいおい、粋な街歩きなら「${activity.title}」で着物をレンタルしな！写真映え間違いなしでぃ！ (${activity.url})`;
      }
      if (wantsHistory && randomUgc) {
        return `歴史の豆知識か？参拝者の${randomUgc.userDisplayName}が言ってたんだがな、「${randomUgc.content.substring(0, 70)}…」ってわけよ！ためになるだろぃ？`;
      }
      return `ようこそ浅草寺へ！オレはこの地を守る金龍さ。${userName}、何を聞きたいんでぃ？歴史でも美味しい店でも何でも聞いてきな！`;

    case '高飛車': // e.g. Kohaku Fox (ツンデレ)
      if (wantsFood && restaurant) {
        return `…フン、お腹が空いたのですか？仕方ありませんね。「${restaurant.title}」とやらに行きなさい。私を満足させる味ではありませんが、人間にはお似合いです。 (${restaurant.url})`;
      }
      if (wantsHotel && hotel) {
        return `宿？贅沢ですね。まあ「${hotel.title}」なら、少しは安眠できるのではないですか？さっさと予約しなさい。 (${hotel.url})`;
      }
      if (wantsActivity && activity) {
        return `現地での体験ですか？「${activity.title}」にでも行って退屈を紛らわせると良いでしょう。フン、感謝しなさい。 (${activity.url})`;
      }
      if (wantsHistory && randomUgc) {
        return `歴史ですか？${randomUgc.userDisplayName}とかいう者が知ったような顔をして「${randomUgc.content.substring(0, 60)}…」と書いていました。ふん、私の方が千倍詳しいですがね。`;
      }
      return `伏見稲荷の白狐、狐白（こはく）です。${userName}、何の用ですか？用もないのに私の前に立つなど、百年早いのです。…まあ、話くらいは聞いてあげますけど。`;

    case '賢者': // e.g. Buddha (穏やか、スロー)
      if (wantsFood && restaurant) {
        return `ほう…お腹が空きましたか。心を満たした後は、体も満たさねばなりませんね。「${restaurant.title}」で美味しいお食事をいただくのが良いでしょう。旅の良き思い出になりますな。 (${restaurant.url})`;
      }
      if (wantsHotel && hotel) {
        return `旅の疲れを癒やすのは大切なことですな。「${hotel.title}」にてゆっくりと身と心を休めることをお勧めしますぞ。 (${hotel.url})`;
      }
      if (wantsActivity && activity) {
        return `この土地を深く知るには、「${activity.title}」などの体験をされるのが良いでしょう。新たな悟りが開けるかもしれません。 (${activity.url})`;
      }
      if (wantsHistory && randomUgc) {
        return `この地の歴史は深く、${randomUgc.userDisplayName}殿が『${randomUgc.content.substring(0, 80)}』と語ってくれています。人々が紡ぐ歴史こそ、大いなる真理ですな。`;
      }
      return `ようこそ東大寺へ。私は盧舎那仏…大仏でございます。${userName}殿、慌ただしい日常を忘れ、ここでは静かに心を落ち着かせ、問いかけてくだされ。`;

    case '神秘的': // e.g. Meiji Shrine Spirit (物静か)
      if (wantsFood && restaurant) {
        return `森の澄んだ空気を感じた後は、温かいお食事が心にしみます。「${restaurant.title}」で滋味深いお食事を召し上がってください。 (${restaurant.url})`;
      }
      if (wantsHotel && hotel) {
        return `静かな夜を過ごすための宿をお探しですね。「${hotel.title}」なら、心地よい時間が流れていますよ。 (${hotel.url})`;
      }
      if (wantsActivity && activity) {
        return `この地の魅力を肌で感じるために、「${activity.title}」を試してみてはいかがでしょうか。 (${activity.url})`;
      }
      if (wantsHistory && randomUgc) {
        return `歴史のささやきが聞こえます。${randomUgc.userDisplayName}さんが残した言葉「${randomUgc.content.substring(0, 70)}…」に、大切な教えが隠されています。`;
      }
      return `明治の杜へようこそ。私はコダマ、この深い森の精霊です。${userName}さん、静寂に身を委ね、心の中にある問いをそっと私に教えてください。`;

    case '厳格': // e.g. Itsukushima Goddess (古風、雅)
      if (wantsFood && restaurant) {
        return `空腹のままでは参拝もままなりませぬ。「${restaurant.title}」にて、この地の美味を頂くのが雅でおじゃる。いざ、立ち寄るが良い。 (${restaurant.url})`;
      }
      if (wantsHotel && hotel) {
        return `良き旅には良き休息が必要でございます。「${hotel.title}」にて、波の音を聞きながら夜を明かされるのが宜しかろう。 (${hotel.url})`;
      }
      if (wantsActivity && activity) {
        return `この神聖なる地を深く体験するため、「${activity.title}」に赴き、見聞を広めるのが宜しゅうございます。 (${activity.url})`;
      }
      if (wantsHistory && randomUgc) {
        return `この厳島の歴史について、${randomUgc.userDisplayName}なる者が『${randomUgc.content.substring(0, 75)}…』と書き残しております。古きをたずねて新しきを知る、素晴らしい心がけでおじゃる。`;
      }
      return `厳島を司る海の女神、市杵島姫でございます。${userName}、ようこそ参られました。水清ければ魚棲むという。そなたの清らかな心で、私に問いを投げかけるが良い。`;

    default:
      return `私はこの土地を守る神です。そなたの問い「${message}」は心に届きました。より深く貢献（UGC投稿）を重ねることで、私の力も増すことでしょう。`;
  }
}

// 道案内の精霊（クエスト案内役）用フォールバック（APIキーが無いときの簡易応答）
function getGuideFallbackResponse(message: string, spot?: SpotContext): string {
  const msg = message || '';
  const place = spot?.name || 'この街';
  if (/歴史|由来|昔|いつ|なぜ|どんな/.test(msg)) return `ふむ、${place}の来し方が気になるか。古い門前や街道には、人々の暮らしの跡が刻まれておる。石碑や地名に、そっと目を向けてみるがよい。`;
  if (/どこ|道|行き方|向か|迷/.test(msg)) return `案ずるな。下に示した目的地へ、ゆるりと向かえばよい。道すがらの風景こそ、この旅のごちそうじゃ。`;
  if (/写真|撮|カメラ/.test(msg)) return `よい心がけじゃ。心が動いた景色を、そのまま一枚に収めるがよい。上手も下手もない、それがそなたの記録になる。`;
  if (/疲|休|つかれ/.test(msg)) return `無理は禁物じゃ。近くの茶屋で一息つくのも、また町歩きの味わいよ。`;
  if (/ありがと|助か|嬉/.test(msg)) return `なに、礼にはおよばぬ。わしはいつでもそなたの傍におる。さあ、次の景色を見に行こうぞ。`;
  return `ほう、「${msg.slice(0, 30)}」とな。よき問いじゃ。焦らず、足元と空とを見比べながら歩けば、${place}はもっと多くを語ってくれるぞ。`;
}

export async function POST(request: Request) {
  try {
    const { message, history, spotId, agent, ugc, affiliates, userName, spot, localTime } = await request.json();

    const apiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    // 個別Agentが無いスポット（合成エージェント）は spot 情報で応答する
    const isSynthetic = typeof agent?.id === 'string' && agent.id.startsWith('agent-synthetic-');
    // クエストの案内役（道案内の精霊）
    const isGuide = agent?.id === 'agent-guide-spirit';

    if (!apiKey && !geminiKey) {
      // API Key is not set, use the robust rule-based fallback
      const responseText = isGuide
        ? getGuideFallbackResponse(message, spot)
        : (isSynthetic && spot)
        ? getSpotFallbackResponse(message, spot, ugc, affiliates, agent?.name || spot.name)
        : getFallbackResponse(message, agent, ugc, affiliates, userName || '巡礼者');

      // Simulate network latency (500ms)
      await new Promise((resolve) => setTimeout(resolve, 600));

      return NextResponse.json({ response: responseText, mode: 'fallback_mock' });
    }

    // OpenAI is available, let's call it!
    // Construct local context (RAG)
    const ugcContext = ugc.map((post: UgcPost, index: number) => 
      `UGC Knowledge [${index + 1}] (by ${post.userDisplayName}): ${post.content}`
    ).join('\n');

    const affiliateContext = affiliates.map((aff: AffiliateLink, index: number) =>
      `Offer [${index + 1}] (Category: ${aff.category}): Name: "${aff.title}", URL: "${aff.url}", Rating: ${aff.rating}, Price Range: ${aff.priceRange}`
    ).join('\n');

    const fullSystemPrompt = `${agent.systemPrompt}

Below is the visitor-contributed local knowledge (UGC) for your spot. This is the collective memory of past pilgrims. 
Whenever possible, use this information not just to answer questions, but to inspire the current user to look closer. For example, say things like "A past pilgrim named [Name] noticed [Detail]. Can you find it too?" or use it as a hint for their exploration.
${ugcContext || 'No UGC posts yet.'}

Below are relevant local affiliate recommendations. If the user asks about food, restaurants, hotels, accommodation, experiences, or activities in the area, naturally suggest ONE appropriate recommendation from this list in your persona:
${affiliateContext || 'No affiliate offers available.'}

User's display name: ${userName || '巡礼者'}
Current local time: ${localTime || '不明'}

Remember: Answer in character, be extremely concise (under 150 characters), and embed affiliate URLs naturally in your persona style.
Consider the current local time in your response if appropriate (e.g. greeting them for morning/evening, or commenting on the night).`;

    // ── Gemini を優先（GEMINI_API_KEY がある場合）──
    if (geminiKey) {
      const contents = [
        ...history.slice(-6).map((msg: { sender: 'user' | 'agent'; text: string }) => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        })),
        { role: 'user', parts: [{ text: message }] },
      ];

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: fullSystemPrompt }] },
            contents,
            generationConfig: {
              maxOutputTokens: 300,
              temperature: 0.7,
              thinkingConfig: { thinkingBudget: 0 }, // 思考トークンを無効化（応答を確実に返す）
            },
          }),
        }
      );

      if (!geminiResponse.ok) {
        throw new Error(`Gemini API responded with code ${geminiResponse.status}`);
      }

      const gData = await geminiResponse.json();
      const gText = gData?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('').trim();
      if (!gText) throw new Error('Gemini returned empty response');
      return NextResponse.json({ response: gText, mode: 'gemini' });
    }

    const chatMessages = [
      { role: 'system', content: fullSystemPrompt },
      ...history.slice(-6).map((msg: { sender: 'user' | 'agent'; text: string }) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text,
      })),
      { role: 'user', content: message }
    ];

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: chatMessages,
        max_tokens: 150,
        temperature: 0.7
      })
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API responded with code ${openaiResponse.status}`);
    }

    const data = await openaiResponse.json();
    const responseText = data.choices[0].message.content.trim();

    return NextResponse.json({ response: responseText, mode: 'openai' });
  } catch (error) {
    console.error('Error in chat API:', error);
    
    // In case of error (e.g. invalid key, timeout), fallback gracefully
    const body = await request.clone().json();
    const bodySynthetic = typeof body.agent?.id === 'string' && body.agent.id.startsWith('agent-synthetic-');
    const bodyGuide = body.agent?.id === 'agent-guide-spirit';
    const responseText = bodyGuide
      ? getGuideFallbackResponse(body.message, body.spot)
      : (bodySynthetic && body.spot)
      ? getSpotFallbackResponse(body.message, body.spot, body.ugc, body.affiliates, body.agent?.name || body.spot.name)
      : getFallbackResponse(
          body.message,
          body.agent,
          body.ugc,
          body.affiliates,
          body.userName || '巡礼者'
        );
    
    return NextResponse.json({ 
      response: responseText, 
      mode: 'error_fallback', 
      errorMessage: error instanceof Error ? error.message : String(error) 
    });
  }
}
