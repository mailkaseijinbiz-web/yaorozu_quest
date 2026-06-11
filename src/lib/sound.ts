// 神様の言葉が届いた瞬間の効果音（「ポーン」という澄んだ一音）。
// 音源ファイルを持たず Web Audio で合成する（オフライン可・容量ゼロ）。
// AudioContext はユーザー操作後に有効になるため、送信ボタン等のジェスチャに続けて鳴らす。

let ctx: AudioContext | null = null;

/** 「ポーン」という余韻のある一音を鳴らす。未対応・失敗時は無音で無視。 */
export function playChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    // 立ち上がりで少し上にすべらせて、鈴のような「ポーン」に
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.012);
    // やわらかいアタックとゆるやかな減衰
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.95);
  } catch {
    /* 効果音は best-effort。失敗しても本筋を止めない */
  }
}
