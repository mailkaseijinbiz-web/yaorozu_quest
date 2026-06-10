// 画像アップロードのクライアントヘルパー。
// 1) 端末で取得した画像を canvas で縮小・JPEG 圧縮
// 2) /api/upload (Supabase Storage) に送り公開URLを得る
// 3) Supabase 未設定(enabled:false)なら圧縮済み base64 をそのまま返す（dev フォールバック）

const MAX_DIM = 1280; // 長辺の最大px
const QUALITY = 0.82;

/** File を縮小・圧縮して dataURL(JPEG) にする。
 *  opts で長辺・画質を上書き可（例: AI vision 用は maxDim 640 / quality 0.7 で軽量化）。 */
export function compressImage(file: File, opts?: { maxDim?: number; quality?: number }): Promise<string> {
  const maxDim = opts?.maxDim ?? MAX_DIM;
  const quality = opts?.quality ?? QUALITY;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no canvas ctx'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
  });
}

/**
 * 画像をアップロードして表示用URLを返す。
 * Supabase 有効時は公開URL、未設定時は圧縮済み base64（端末ローカル）を返す。
 * @param prefix 保存パスの接頭辞（例: 'spot-xxx', 'challenge-yyy'）
 */
export async function uploadImage(file: File, prefix = 'misc'): Promise<string> {
  const dataUrl = await compressImage(file);
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl, prefix }),
    });
    const json = await res.json();
    if (json?.enabled && json?.ok && json?.url) return json.url as string;
  } catch {
    /* ネットワーク失敗時は base64 フォールバック */
  }
  return dataUrl; // Supabase 未設定 or 失敗時
}
