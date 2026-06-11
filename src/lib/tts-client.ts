// 音声読み上げ（クライアント）。まず Gemini TTS（/api/tts）で生成した音声を再生し、
// 鍵未設定・失敗・未対応環境ではブラウザの speechSynthesis にフォールバックする。
'use client';

export interface SpeechController {
  /** 読み上げを止める。 */
  stop: () => void;
}

export interface SpeakCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (e?: unknown) => void;
}

/**
 * 1つのテキストを読み上げる。Gemini TTS → 失敗時 speechSynthesis。
 * 返り値の stop() で中断できる。終了時に onEnd を呼ぶ。
 */
export function speakText(text: string, cb: SpeakCallbacks = {}): SpeechController {
  let stopped = false;
  let audio: HTMLAudioElement | null = null;
  let usingSynth = false;

  const fallbackToSynth = () => {
    if (stopped) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) { cb.onError?.(); return; }
    usingSynth = true;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 0.9;
    u.pitch = 0.9;
    const ja = window.speechSynthesis.getVoices().find((v) => v.lang === 'ja-JP' || v.lang === 'ja_JP');
    if (ja) u.voice = ja;
    u.onstart = () => cb.onStart?.();
    u.onend = () => cb.onEnd?.();
    u.onerror = (e) => cb.onError?.(e);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  (async () => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (stopped) return;
      if (!res.ok) { fallbackToSynth(); return; } // 503(未設定) など → ブラウザ読み上げ
      const blob = await res.blob();
      if (stopped) return;
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      audio = a;
      a.onplay = () => cb.onStart?.();
      a.onended = () => { URL.revokeObjectURL(url); cb.onEnd?.(); };
      a.onerror = () => { URL.revokeObjectURL(url); fallbackToSynth(); };
      await a.play();
    } catch {
      if (!stopped) fallbackToSynth();
    }
  })();

  return {
    stop: () => {
      stopped = true;
      if (audio) { audio.pause(); audio = null; }
      if (usingSynth && typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    },
  };
}
