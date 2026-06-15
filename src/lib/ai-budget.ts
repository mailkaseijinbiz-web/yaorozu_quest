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
//   AI_PHOTO_FEEDBACK       … 写真フィードバックに生成AI(ビジョン)を使うか（'0'/'false'で無効）

function numEnv(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

function boolEnv(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v == null || v === '') return def;
  return v === '1' || v.toLowerCase() === 'true';
}

export const AI_BUDGET = {
  /** チャットでモデルに渡す直近の会話履歴件数（少ないほど入力トークン削減）。既定6（旧10）。 */
  chatHistoryTurns: numEnv('AI_CHAT_HISTORY_TURNS', 6),
  /** チャット応答の最大出力トークン。約200字の応答に十分な範囲で抑える。既定320（旧400/300）。 */
  chatMaxOutputTokens: numEnv('AI_CHAT_MAX_TOKENS', 320),
  /** 会話序盤（履歴がこの件数未満）のみ「話題シード」をプロンプトへ含める。既定4。 */
  chatTopicSeedUntilTurns: numEnv('AI_CHAT_TOPIC_SEED_TURNS', 4),
  /** 写真フィードバックに生成AI(ビジョン)を使う。false ならルールベースのみ（ビジョン呼び出し0）。 */
  photoFeedbackAI: boolEnv('AI_PHOTO_FEEDBACK', true),
};
