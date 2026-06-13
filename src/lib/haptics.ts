// 節目（会話開始など）の触覚フィードバック。
// iOS/Android ネイティブ(Capacitor)では @capacitor/haptics、
// それ以外(Web)では navigator.vibrate にフォールバックする。
// ※ navigator.vibrate は iOS Safari / WKWebView では無効なため、
//   ネイティブアプリでは必ず Haptics プラグイン経由で鳴らす。
import { Capacitor } from '@capacitor/core';

/** ネイティブで二拍の軽い触覚（会話が始まる合図）。 */
async function nativeConversationStart(): Promise<void> {
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  await Haptics.impact({ style: ImpactStyle.Light });
  await new Promise((r) => setTimeout(r, 70));
  await Haptics.impact({ style: ImpactStyle.Medium });
}

/**
 * 触覚フィードバックを鳴らす。ネイティブは Haptics、Web は navigator.vibrate。
 * @param webPattern Web フォールバック時の振動パターン（ミリ秒）
 */
export async function vibrate(webPattern: number | number[] = 30): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await nativeConversationStart();
      return;
    } catch {
      // プラグイン未同期などで失敗したら Web フォールバックを試みる
    }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(webPattern);
  }
}

/** 会話が始まるときの合図（短い二拍）。発火は投げっぱなしでよい。 */
export function vibrateConversationStart(): void {
  void vibrate([40, 60, 40]);
}

/** そっと気づかせる単発の軽い触覚（バナー出現・遠ざかり確認など）。発火は投げっぱなしでよい。 */
export function vibrateGentle(): void {
  void (async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Light });
        return;
      } catch {
        // プラグイン未同期などで失敗したら Web フォールバックを試みる
      }
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(20);
  })();
}
