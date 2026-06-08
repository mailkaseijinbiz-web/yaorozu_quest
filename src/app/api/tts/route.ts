// Text-to-Speech API（ElevenLabs / 自然な音声）
// -----------------------------------------------------------------------------
// クエスト案内（道案内の精霊）のメッセージを自然な音声で読み上げるためのルート。
// ELEVENLABS_API_KEY が設定されていれば mp3 を返し、無ければ {fallback} を返して
// クライアント側で Web Speech API にフォールバックさせる。
//
// 環境変数（.env.local）:
//   ELEVENLABS_API_KEY   … 必須（自然な音声を使う場合）
//   ELEVENLABS_VOICE_ID  … 任意（既定: Rachel = 21m00Tcm4TlvDq8ikWAM）
//   ELEVENLABS_MODEL_ID  … 任意（既定: eleven_multilingual_v2 / 日本語対応）
// -----------------------------------------------------------------------------
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'no text' }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      // キー未設定 → クライアントは Web Speech にフォールバック
      return NextResponse.json({ fallback: 'web-speech' }, { status: 200 });
    }

    const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel（既定）
    const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'; // 日本語対応

    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.slice(0, 800), // 長文の暴発防止
          model_id: modelId,
          // 落ち着いた語り部らしい設定
          voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
        }),
      }
    );

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('ElevenLabs TTS error', r.status, detail.slice(0, 300));
      // 失敗時もクライアントを止めない（Web Speech にフォールバック）
      return NextResponse.json({ fallback: 'web-speech', status: r.status }, { status: 200 });
    }

    const audio = await r.arrayBuffer();
    return new NextResponse(audio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    return NextResponse.json({ fallback: 'web-speech', error: String(e) }, { status: 200 });
  }
}
