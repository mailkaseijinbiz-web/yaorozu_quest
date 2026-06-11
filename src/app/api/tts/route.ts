// 音声読み上げ（TTS）API ルート。Gemini TTS でテキストを音声（WAV）に変換して返す。
// 鍵未設定・失敗時は 503 を返し、クライアントはブラウザの speechSynthesis にフォールバックする。
// Gemini TTS は 24kHz・16bit・モノラルの生 PCM(L16) を返すため、ブラウザで再生できるよう
// WAV ヘッダを付けて audio/wav として返す。
import { NextResponse } from 'next/server';

// Gemini プリビルト音声。落ち着いた語り口の声を既定にする。
const DEFAULT_VOICE = 'Charon';
const PCM_SAMPLE_RATE = 24000; // Gemini TTS の出力サンプルレート

/** 生 PCM(L16 mono) を WAV コンテナにくるむ。 */
function pcmToWav(pcm: Buffer, sampleRate = PCM_SAMPLE_RATE): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt チャンクサイズ
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function POST(request: Request) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    // 鍵が無ければクライアント側でブラウザ読み上げにフォールバックさせる
    return NextResponse.json({ error: 'unconfigured' }, { status: 503 });
  }

  let text = '';
  let voice = DEFAULT_VOICE;
  try {
    const body = await request.json();
    text = (body?.text || '').toString().slice(0, 2000); // 暴走防止に上限
    if (body?.voice) voice = String(body.voice);
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!text.trim()) return NextResponse.json({ error: 'empty' }, { status: 400 });

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // 自然言語で語り口を指示できる（古風で落ち着いた読み上げに寄せる）
          contents: [{ parts: [{ text: `落ち着いた、古風でやさしい語り口で読み上げてください：\n${text}` }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      },
    );
    if (!res.ok) {
      return NextResponse.json({ error: 'tts_failed', status: res.status }, { status: 502 });
    }
    const data = await res.json();
    const inline = data?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data?: string } }) => p?.inlineData?.data)?.inlineData;
    const b64: string | undefined = inline?.data;
    if (!b64) return NextResponse.json({ error: 'no_audio' }, { status: 502 });

    // mimeType 例: "audio/L16;codec=pcm;rate=24000" からサンプルレートを拾う（無ければ既定）
    const rateMatch = /rate=(\d+)/.exec(inline?.mimeType || '');
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : PCM_SAMPLE_RATE;

    const wav = pcmToWav(Buffer.from(b64, 'base64'), sampleRate);
    return new NextResponse(new Uint8Array(wav), {
      status: 200,
      headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'tts_error' }, { status: 502 });
  }
}
