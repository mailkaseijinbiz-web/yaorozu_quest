// SNS 共有ヘルパー。
// Web Share API（OSの共有シート）でユーザー自身が SNS アプリを選んで投稿する。
// 画像があれば添付し、未対応環境ではリンク文をクリップボードへコピーする。
// （特定 SNS への自動投稿は OAuth/認証が必要なため行わない。共有はユーザー操作で完結する）

export type ShareResult =
  | 'shared'      // 共有シートで共有された
  | 'copied'      // クリップボードへコピーした（フォールバック）
  | 'cancelled'   // ユーザーが共有シートをキャンセルした
  | 'unavailable';// 共有もコピーも不可

interface ShareOptions {
  title: string;
  text: string;
  url?: string;
  imageUrl?: string; // 添付したい画像（公開URL or dataURL）。取得失敗時はテキストのみ共有
}

type NavigatorWithShare = Navigator & {
  share?: (data: ShareData & { files?: File[] }) => Promise<void>;
  canShare?: (data?: ShareData & { files?: File[] }) => boolean;
};

/** 画像URL/dataURL を共有用の File に変換（失敗時は null）。 */
async function toFile(imageUrl: string): Promise<File | null> {
  if (typeof File === 'undefined') return null;
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return null;
    const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    return new File([blob], `yaorozu.${ext}`, { type: blob.type });
  } catch {
    return null; // CORS・ネットワーク失敗等はテキストのみ共有
  }
}

/**
 * SNS へ共有する。Web Share API があれば共有シートを開き、無ければリンクをコピーする。
 * 呼び出しは必ずユーザー操作（クリック等）のハンドラ内から行うこと（Web Share の要件）。
 */
export async function shareToSns(opts: ShareOptions): Promise<ShareResult> {
  if (typeof navigator === 'undefined') return 'unavailable';
  const nav = navigator as NavigatorWithShare;
  const { title, text, url, imageUrl } = opts;

  try {
    if (nav.share) {
      // 画像添付を試みる（対応端末のみ）
      if (imageUrl) {
        const file = await toFile(imageUrl);
        if (file && nav.canShare?.({ files: [file] })) {
          await nav.share({ title, text, url, files: [file] });
          return 'shared';
        }
      }
      await nav.share({ title, text, url });
      return 'shared';
    }
  } catch (err) {
    // ユーザーが共有シートを閉じた場合は AbortError
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    // それ以外はクリップボードへフォールバック
  }

  // フォールバック：リンク付きテキストをコピー
  try {
    const payload = url ? `${text}\n${url}` : text;
    await navigator.clipboard.writeText(payload);
    return 'copied';
  } catch {
    return 'unavailable';
  }
}
