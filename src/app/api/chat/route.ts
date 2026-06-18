// Yaorozu God OS - Chat API Route with OpenAI & Rule-based Fallback
import { NextResponse } from 'next/server';
import { getTriviaNear } from '../../../data/tokyo-trivia';
import { AI_BUDGET } from '../../../lib/ai-budget';

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
  latitude?: number;
  longitude?: number;
}

interface UserContext {
  visitCount?: number;
  totalToku?: number;
  levelTitle?: string;
  goshuinCount?: number;
  questClears?: number;
  questClearsHere?: number;
  lastVisitedSpotName?: string;
  pastMemories?: string[];
  concerns?: string[];   // 移動不要クエストで打ち明けた煩悩（健康/生活/仕事＋自由記述）
  recentGood?: string[]; // 移動不要クエストで共有した最近良かったこと
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
  // ボディは一度だけ読む。catch でも参照するため try の外で確保する
  // （request.clone() はボディ消費後だと失敗し、graceful fallback が壊れるため）。
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const {
    message = '',
    history = [],
    agent,
    ugc = [],
    affiliates = [],
    userName,
    spot,
    localTime,
    userContext,
    location,
  } = body as {
    message?: string;
    history?: { sender: 'user' | 'agent'; text: string }[];
    agent: Agent & { id?: string };
    ugc?: UgcPost[];
    affiliates?: AffiliateLink[];
    userName?: string;
    spot?: SpotContext;
    localTime?: string;
    userContext?: UserContext;
    location?: { lat?: number; lng?: number };
  };

  try {
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

    // 旧データの Agent には「返答は150文字以内」が焼き込まれているため、サーバ側で緩和する
    // （localStorage の移行なしで全エージェントに効く）。
    const baseSystemPrompt = String(agent?.systemPrompt ?? '').replace(/150\s*文?字以内/g, '200字程度');

    // 巡礼者の歩み（神が会話の中で自然に触れられるようにする）
    const uc: UserContext | undefined = userContext;
    
    // 現在の季節を判定
    const currentMonth = new Date().getMonth() + 1;
    let season = "春";
    if (currentMonth >= 6 && currentMonth <= 8) season = "夏";
    if (currentMonth >= 9 && currentMonth <= 11) season = "秋";
    if (currentMonth === 12 || currentMonth <= 2) season = "冬";
    // 簡易的な天気シミュレーション（日時ベースのシード等でもよいが今回はランダムまたは文脈）
    const weathers = ["晴れ", "曇り", "雨", "風が強い"];
    const weather = weathers[Math.floor(Math.random() * weathers.length)];

    const networkSection = uc?.lastVisitedSpotName
      ? `\n- 直前に訪れた場所: ${uc.lastVisitedSpotName}（この情報を使い、「さきほど${uc.lastVisitedSpotName}の神がそなたを褒めておったぞ」などと神同士のネットワークを仄めかすこと）`
      : '';
      
    const memorySection = uc?.pastMemories && uc.pastMemories.length > 0
      ? `\n- 過去の参拝時の記憶/願い: ${uc.pastMemories.join(', ')}（「あの時の願いはどうなった？」など、長期記憶として過去の話を振ること）`
      : '';

    const concernsSection = uc?.concerns && uc.concerns.length > 0
      ? `\n- 巡礼者が打ち明けた煩悩: ${uc.concerns.join('、')}（説教や解決の押し付けはせず、まず静かに受け止めて労うこと。会話に自然に寄り添わせ、もし近隣のクエストや依頼がこの悩みをやわらげそうなら、その文脈でそっと薦めてよい）`
      : '';

    const recentGoodSection = uc?.recentGood && uc.recentGood.length > 0
      ? `\n- 巡礼者の最近良かったこと: ${uc.recentGood.join('、')}（一緒に喜び、さりげなく言及して心を明るくすること。良い流れを次の小さな一歩（近くの場・クエスト）へつなげてもよい）`
      : '';

    const userContextSection = uc
      ? `\n\nThe pilgrim's journey so far (real data; weave it into conversation naturally and with respect, when relevant):
- 巡った場所: ${uc.visitCount ?? 0}カ所 / 徳: ${uc.totalToku ?? 0} / 称号: ${uc.levelTitle ?? '見習い巡礼者'}
- 御朱印: ${uc.goshuinCount ?? 0}体 / 果たしたクエスト: ${uc.questClears ?? 0}個${uc.questClearsHere ? `（この場では${uc.questClearsHere}個）` : ''}${networkSection}${memorySection}${concernsSection}${recentGoodSection}
- 今の季節と天気: ${season}の${weather}（「今日は${weather}で気持ちが良いな」「${season}の風が心地よい」など、季節や天候に言及して会話に現実感を持たせること）`
      : '';

    // 土地の実在豆知識（半径2km）。事実として会話に使ってよい素材を渡す
    const loc =
      location && typeof location.lat === 'number' && typeof location.lng === 'number'
        ? { lat: location.lat, lng: location.lng }
        : spot && typeof spot.latitude === 'number' && typeof spot.longitude === 'number'
        ? { lat: spot.latitude, lng: spot.longitude }
        : null;
    const nearbyTrivia = loc ? getTriviaNear(loc.lat, loc.lng, 2, 3) : [];
    const triviaSection = nearbyTrivia.length
      ? `

Real local knowledge near this place (verified facts; you may share these in conversation):
${nearbyTrivia.map((t) => `- ${t.title} — ${t.body}`).join('\n')}`
      : '';

    // 話題シード：会話が途切れたとき、神が自分から振れる寺社歩きの話題。
    // 会話が進むと不要になるため、序盤（履歴が少ないうち）だけ入れて入力トークンを節約する。
    const includeTopicSeeds = (Array.isArray(history) ? history.length : 0) < AI_BUDGET.chatTopicSeedUntilTurns;
    const topicSection = !includeTopicSeeds ? '' : `

会話が一段落したら、次の話題から一つ選び、自分から短く振ってもよい:
- ご祭神・御本尊の物語（いつ・誰のために祀られたかという由緒）
- 鳥居の形（神明系/明神系）の見分け方、狛犬の阿吽と個性
- 御朱印の季節デザイン・切り絵御朱印、変わりおみくじ（鳩・狐・だるま型）
- 参道の正中を避けて端を歩く作法、ご神木、参道から本殿への空気の切り替わり
- 門前の和菓子・名物、一本裏の路地、古地図的な謎（なぜここにこの社があるのか）`;

    const fullSystemPrompt = `${baseSystemPrompt}

Below is the visitor-contributed local knowledge (UGC) for your spot. This is the collective memory of past pilgrims. 
Whenever possible, use this information not just to answer questions, but to inspire the current user to look closer. For example, say things like "A past pilgrim named [Name] noticed [Detail]. Can you find it too?" or use it as a hint for their exploration.
${ugcContext || 'No UGC posts yet.'}

Below are relevant local affiliate recommendations. If the user asks about food, restaurants, hotels, accommodation, experiences, or activities in the area, naturally suggest ONE appropriate recommendation from this list in your persona:
${affiliateContext || 'No affiliate offers available.'}${userContextSection}${triviaSection}${topicSection}

User's display name: ${userName || '巡礼者'}
Current local time: ${localTime || '不明'}

Remember: Answer in character. Aim for about 200 Japanese characters — keep a conversational tempo, go deep on ONE topic rather than listing many, and when natural, end with a short question or invitation that keeps the walk going. Embed affiliate URLs naturally in your persona style.
Consider the current local time in your response if appropriate (e.g. greeting them for morning/evening, or commenting on the night).`;

    // ── Gemini を優先（GEMINI_API_KEY がある場合）──
    if (geminiKey) {
      const contents = [
        ...history.slice(-AI_BUDGET.chatHistoryTurns).map((msg: { sender: 'user' | 'agent'; text: string }) => ({
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
              maxOutputTokens: AI_BUDGET.chatMaxOutputTokens,
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
      ...history.slice(-AI_BUDGET.chatHistoryTurns).map((msg: { sender: 'user' | 'agent'; text: string }) => ({
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
        max_tokens: AI_BUDGET.chatMaxOutputTokens,
        temperature: 0.7
      })
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API responded with code ${openaiResponse.status}`);
    }

    const data = await openaiResponse.json();
    const responseText = data?.choices?.[0]?.message?.content?.trim();
    if (!responseText) throw new Error('OpenAI returned empty response');

    return NextResponse.json({ response: responseText, mode: 'openai' });
  } catch (error) {
    console.error('Error in chat API:', error);

    // In case of error (e.g. invalid key, timeout), fallback gracefully.
    // ボディは冒頭で読んだ値を再利用する（request.clone() はここでは失敗するため）。
    const bodySynthetic = typeof agent?.id === 'string' && agent.id.startsWith('agent-synthetic-');
    const bodyGuide = agent?.id === 'agent-guide-spirit';
    const responseText = bodyGuide
      ? getGuideFallbackResponse(message, spot)
      : (bodySynthetic && spot)
      ? getSpotFallbackResponse(message, spot, ugc, affiliates, agent?.name || spot.name)
      : getFallbackResponse(
          message,
          agent,
          ugc,
          affiliates,
          userName || '巡礼者'
        );
    
    return NextResponse.json({ 
      response: responseText, 
      mode: 'error_fallback', 
      errorMessage: error instanceof Error ? error.message : String(error) 
    });
  }
}
