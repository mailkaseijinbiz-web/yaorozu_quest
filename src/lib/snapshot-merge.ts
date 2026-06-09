// スナップショット（同期キー集合）のキー単位マージ。
//
// 目的: 複数端末の同時編集で発生する「丸ごと上書き(Last-Write-Wins)」による消失を防ぐ。
// 旧実装は persist が無条件 upsert だったため、遅れて届いた古い端末の書込が
// 別端末の新しいデータ（新規投稿・御朱印・徳など）を丸ごと消していた。
//
// マージ方針:
// - 配列(id付きオブジェクト): id をキーに和集合。両方に在る id は incoming を採用。
//   → 片方にしか無い新規エンティティ(投稿/御朱印/活動 等)は決して失われない。
// - 配列(プリミティブ/混在): 値で重複排除した和集合(順序は base→incoming)。
// - プレーンオブジェクト: キー単位に再帰マージ(incoming 優先)。
// - スカラー/型不一致: incoming を採用。
//
// 限界: 同一エンティティを2端末で同時編集した場合は後勝ち(incoming)。
// totalToku のようなスカラーは厳密合算されない（将来 per-field CRDT / サーバRPC で改善）。
// それでも「別エンティティの消失ゼロ」を保証する点が、丸ごとLWWに対する本質的な改善。

type Json = unknown;

function isPlainObject(v: Json): v is Record<string, Json> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hasId(v: Json): v is { id: unknown } {
  return isPlainObject(v) && 'id' in v && (v as Record<string, Json>).id != null;
}

/** 2つの配列をマージする。要素が全て id 付きなら id で和集合、そうでなければ値で重複排除。 */
export function mergeArray(base: Json[], incoming: Json[]): Json[] {
  if (base.every(hasId) && incoming.every(hasId)) {
    const map = new Map<unknown, Json>();
    for (const it of base) map.set((it as { id: unknown }).id, it);
    for (const it of incoming) map.set((it as { id: unknown }).id, it); // incoming 優先
    return [...map.values()];
  }
  const seen = new Set<string>();
  const out: Json[] = [];
  for (const it of [...base, ...incoming]) {
    const key = JSON.stringify(it);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}

/** 任意の2値を方針に従ってマージする。 */
export function mergeValue(base: Json, incoming: Json): Json {
  if (Array.isArray(base) && Array.isArray(incoming)) return mergeArray(base, incoming);
  if (isPlainObject(base) && isPlainObject(incoming)) {
    const out: Record<string, Json> = { ...base };
    for (const k of Object.keys(incoming)) {
      out[k] = k in base ? mergeValue(base[k], incoming[k]) : incoming[k];
    }
    return out;
  }
  return incoming;
}

/**
 * スナップショット { [syncKey]: value } 同士をマージする。
 * base に在って incoming に無いキーは保持し、共通キーは mergeValue でマージする。
 */
export function mergeSnapshots(
  base: Record<string, Json> | null | undefined,
  incoming: Record<string, Json>,
): Record<string, Json> {
  if (!base) return { ...incoming };
  const out: Record<string, Json> = { ...base };
  for (const k of Object.keys(incoming)) {
    out[k] = k in base ? mergeValue(base[k], incoming[k]) : incoming[k];
  }
  return out;
}
