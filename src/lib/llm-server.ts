// サーバー側の汎用テキスト生成ヘルパー（Gemini → OpenAI → null）。
// chat/generate-quest と同じ優先順位・同じ無料枠フォールバック思想を、
// cron など他のサーバー処理から再利用できるよう独立させたもの。
// 鍵が無い／失敗したときは null を返す（呼び出し側で決定論フォールバックに委ねる）。
// -----------------------------------------------------------------------------

export interface GeneratedText {
  text: string;
  source: 'gemini' | 'openai';
}

/**
 * systemInstruction + user プロンプトから1回だけテキストを生成する。
 * AI は best-effort：鍵未設定・APIエラー・空応答はすべて null を返し、例外は投げない。
 */
export async function generateText(
  system: string,
  user: string,
  opts: { maxOutputTokens?: number; temperature?: number } = {},
): Promise<GeneratedText | null> {
  const maxOutputTokens = opts.maxOutputTokens ?? 512;
  const temperature = opts.temperature ?? 0.8;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // ── Gemini を優先 ──
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { maxOutputTokens, temperature, thinkingConfig: { thinkingBudget: 0 } },
          }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text || '').join('').trim();
        if (text) return { text, source: 'gemini' };
      }
    } catch { /* OpenAI へフォールバック */ }
  }

  // ── OpenAI ──
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          max_tokens: maxOutputTokens,
          temperature,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text) return { text, source: 'openai' };
      }
    } catch { /* null へ */ }
  }

  return null;
}
