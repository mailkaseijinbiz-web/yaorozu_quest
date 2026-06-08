// 触覚フィードバック（対応端末のみ）。SSR/非対応では安全に no-op。
// ユーザーが「動きを減らす」設定の場合は控える。
type HapticKind = 'tap' | 'success' | 'celebrate' | 'warning';

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 12,
  success: [0, 28, 40, 28],
  celebrate: [0, 40, 60, 40, 60, 80],
  warning: [0, 20, 50, 20],
};

export function haptic(kind: HapticKind = 'tap') {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  try {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* 一部ブラウザは vibrate を拒否する。無視。 */
  }
}
