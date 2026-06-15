// 生成AIの利用量（コスト）を一箇所で調整するためのサーバー側設定。
//
// 方針: 「できるだけ節約」しつつ体験を保つ。既定値を経済的に寄せ、env で上書き可能にして
// “構成として少しずつ切り替え” られるようにする。最大の消費源はチャット（発話ごとに毎回
// 呼び出し・プロンプトが大きい）なので、まずは入力トークンの圧縮を中心に効かせる。
//
// 上書き用 env（任意。未設定なら下記の既定値）:
//   AI_CHAT_HISTORY_TURNS   … チャットでモデルへ渡す直近履歴の件数
//   AI_CHAT_MAX_TOKENS      … チャット応答の最大出力トークン
//   AI_CHAT_TOPIC_SEED_TURNS… 会話序盤のみ「話題シード」を入れる閾値（この件数未満で付与）
//   AI_PHOTO_FEEDBACK       … 写真フィードバックのビジョン利用範囲。'casual-only'|'all'|'off'

function numEnv(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

/** 写真フィードバックでビジョンAIを使う範囲。 */
export type PhotoFeedbackMode =
  | 'all'         // 証拠写真も道中共有も AI
  | 'casual-only' // 道中の共有写真のみ AI（クエスト証拠はルールベース）＝節約寄りの既定
  | 'off';        // すべてルールベース（ビジョン呼び出し0）

function photoModeEnv(def: PhotoFeedbackMode): PhotoFeedbackMode {
  const v = (process.env.AI_PHOTO_FEEDBACK ?? '').toLowerCase();
  if (v === 'all' || v === 'casual-only' || v === 'off') return v;
  // 旧来の真偽値表記も許容（true=all / false=off）
  if (v === '1' || v === 'true') return 'all';
  if (v === '0' || v === 'false') return 'off';
  return def;
}

export const AI_BUDGET = {
  /** チャットでモデルに渡す直近の会話履歴件数（少ないほど入力トークン削減）。既定6（旧10）。 */
  chatHistoryTurns: numEnv('AI_CHAT_HISTORY_TURNS', 6),
  /** チャット応答の最大出力トークン。約200字の応答に十分な範囲で抑える。既定320（旧400/300）。 */
  chatMaxOutputTokens: numEnv('AI_CHAT_MAX_TOKENS', 320),
  /** 会話序盤（履歴がこの件数未満）のみ「話題シード」をプロンプトへ含める。既定4。 */
  chatTopicSeedUntilTurns: numEnv('AI_CHAT_TOPIC_SEED_TURNS', 4),
  /** 写真フィードバックのビジョン利用範囲。既定は道中共有のみ AI（クエスト証拠は節約）。 */
  photoFeedbackMode: photoModeEnv('casual-only'),
};

/** この写真フィードバック要求でビジョンAIを呼ぶべきか（casual=道中の共有写真）。 */
export function shouldUsePhotoVision(casual: boolean): boolean {
  const m = AI_BUDGET.photoFeedbackMode;
  return m === 'all' || (m === 'casual-only' && casual);
}
