// 証拠写真への AI フィードバック API
// POST { photoDataUrl, context: { spotName?, taskTitle, taskAction?, godName? } }
//   → 200 { feedback: string, mode: 'gemini' | 'openai' | 'fallback' | 'error_fallback' }
//
// 写真の内容を vision モデルが見て、精霊/神の口調で1〜2文のひとことを返す。
// 既存の3段フォールバック方針を踏襲: Gemini vision → OpenAI vision → 定型文。
// どの失敗モードでも HTTP 200 で定型文を返し、達成演出を壊さない（graceful degradation）。
import { NextResponse } from 'next/server';
import { shouldUsePhotoVision } from '../../../lib/ai-budget';

interface FeedbackContext {
  spotName?: string;
  taskTitle?: string;
  taskAction?: string;
  godName?: string;
  photoThemes?: string[]; // 撮影のお題候補（鳥居・狛犬など）。写りの講評ヒントに使う
  casual?: boolean;   // 道中の「気になる風景」共有（証拠写真ではない気軽な一枚）
  userNote?: string;  // 巡礼者が添えたひとこと・気分
}

// 定型文フォールバック（決定論的に選択。写真は見ていないので内容に踏み込まない）
const FALLBACK_LINES = [
  (place: string) => `おお、よき一枚じゃ。そなたの目に映った${place}が、確かにここに残ったぞ。`,
  (place: string) => `うむ、心が動いた瞬間が伝わってくるわい。${place}も喜んでおるじゃろう。`,
  () => `ようやった。この一枚は、後から来る巡礼者への何よりの道しるべになるぞ。`,
  (place: string) => `ほう……そなたの歩いた証じゃな。${place}の気配が宿っておる。大切にせよ。`,
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function fallbackFeedback(ctx: FeedbackContext): string {
  const place = ctx.spotName || 'この場';
  const line = FALLBACK_LINES[hashString(`${ctx.taskTitle ?? ''}:${place}`) % FALLBACK_LINES.length];
  return line(place);
}

function buildPrompt(ctx: FeedbackContext): string {
  const persona = ctx.godName ? `${ctx.spotName ?? 'この地'}に宿る神「${ctx.godName}」` : '町歩きクエストの案内役「道案内の精霊」';
  if (ctx.casual) {
    // 道中の気軽な一枚。証拠写真ではなく「目的地へ向かう巡礼者が見つけた景色」を共有された場面。
    return `あなたは${persona}です。あなたのもとへ向かって歩いている巡礼者が、道中で見つけた景色やものの写真を送ってくれました。${ctx.userNote ? `巡礼者の言葉：「${ctx.userNote}」。この言葉にも軽く触れてください。` : ''}
写真に実際に写っているものに必ず1つ具体的に触れ、温かく少し古風でやさしい口調（「〜じゃ」「〜のう」）で1〜2文・80字以内のひとことを返してください。気分が添えられていれば、それに寄り添う一言を入れてもよいです。写っていないものを断定しないこと。説教くさくならず、隣で一緒に眺めているように。`;
  }
  return `あなたは${persona}です。巡礼者が${ctx.spotName ? `「${ctx.spotName}」で` : ''}ミッション「${ctx.taskTitle ?? '町歩き'}」${ctx.taskAction ? `（${ctx.taskAction}）` : ''}の証拠写真を奉納しました。${ctx.photoThemes?.length ? `（撮影のお題候補：${ctx.photoThemes.join('・')}）` : ''}
写真に実際に写っているものに必ず1つ具体的に触れて、温かく少し古風な口調（「〜じゃ」「〜ぞ」）で1〜2文・80字以内のひとことを返してください。
狛犬なら阿吽や表情の個性、鳥居なら形や素材、建物なら意匠、空や緑なら光の様子に触れるとよいです。写っていないものを断定しないこと。`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const photoDataUrl: string = String(body.photoDataUrl ?? '');
    const ctx: FeedbackContext = body.context ?? {};

    // 生成AI(ビジョン)の節約: 既定では「道中の共有写真(casual)」のみ AI で講評し、
    // クエストの証拠写真はルールベースの定型文で返す（撮影のたびのビジョン課金を抑える）。
    // 範囲は AI_PHOTO_FEEDBACK（all|casual-only|off）で切替可能。
    if (!shouldUsePhotoVision(ctx.casual === true)) {
      return NextResponse.json({ feedback: fallbackFeedback(ctx), mode: 'fallback' });
    }

    // data URL を分解（/api/upload と同じ形式チェック）。不正・過大は定型文で 200
    const m = photoDataUrl.match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/);
    if (!m || m[2].length > 1_400_000) {
      return NextResponse.json({ feedback: fallbackFeedback(ctx), mode: 'fallback' });
    }
    const [, mimeType, base64] = m;

    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const prompt = buildPrompt(ctx);

    // ── Gemini vision 優先 ──
    if (geminiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                { role: 'user', parts: [{ inlineData: { mimeType, data: base64 } }, { text: prompt }] },
              ],
              generationConfig: { maxOutputTokens: 150, temperature: 0.8, thinkingConfig: { thinkingBudget: 0 } },
            }),
            signal: AbortSignal.timeout(12_000),
          },
        );
        if (res.ok) {
          const data = await res.json();
          const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('').trim() ?? '';
          if (text) return NextResponse.json({ feedback: text.slice(0, 200), mode: 'gemini' });
        }
      } catch {
        /* fall through */
      }
    }

    // ── OpenAI vision ──
    if (openaiKey) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: photoDataUrl } },
                ],
              },
            ],
            max_tokens: 150,
            temperature: 0.8,
          }),
          signal: AbortSignal.timeout(12_000),
        });
        if (res.ok) {
          const data = await res.json();
          const text: string = data.choices?.[0]?.message?.content?.trim() ?? '';
          if (text) return NextResponse.json({ feedback: text.slice(0, 200), mode: 'openai' });
        }
      } catch {
        /* fall through */
      }
    }

    // ── 定型文 fallback ──
    return NextResponse.json({ feedback: fallbackFeedback(ctx), mode: 'fallback' });
  } catch {
    return NextResponse.json({ feedback: fallbackFeedback({}), mode: 'error_fallback' });
  }
}
