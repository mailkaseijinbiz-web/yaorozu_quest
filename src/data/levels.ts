// 八百万クエスト - レベル & 称号システム
// 累積徳(Toku)に応じてレベルが上がり、レベルごとに称号が与えられる。

export interface Level {
  level: number;
  /** そのレベルの称号 */
  title: string;
  /** このレベルに到達するのに必要な累積徳 */
  minToku: number;
  /** アバターフレーム色（任意） */
  frameColor?: string;
}

export const LEVELS: Level[] = [
  { level: 1, title: '見習い巡礼者', minToku: 0 },
  { level: 2, title: '巡礼ガイド', minToku: 100, frameColor: '#0284c7' },
  { level: 3, title: '徳高き修行僧', minToku: 300, frameColor: '#8b5cf6' },
  { level: 4, title: '大徳の創世主', minToku: 500, frameColor: '#c5a028' },
  { level: 5, title: '八百万の大神', minToku: 1000, frameColor: '#c5a028' },
];

export interface LevelInfo {
  current: Level;
  /** 次のレベル（最大レベルなら null） */
  next: Level | null;
  /** 現在レベル内で稼いだ徳 */
  tokuIntoLevel: number;
  /** 次のレベルまでに必要な徳の総量（最大レベルなら 0） */
  tokuSpan: number;
  /** 次のレベルまでの残り徳（最大レベルなら 0） */
  tokuToNext: number;
  /** 現在レベル内の進捗 0〜1（最大レベルは 1） */
  progress: number;
}

/** 累積徳からレベル情報を算出 */
export function getLevelInfo(toku: number): LevelInfo {
  let current = LEVELS[0];
  for (const lv of LEVELS) {
    if (toku >= lv.minToku) current = lv;
  }
  const next = LEVELS.find((lv) => lv.level === current.level + 1) ?? null;

  if (!next) {
    return { current, next: null, tokuIntoLevel: 0, tokuSpan: 0, tokuToNext: 0, progress: 1 };
  }

  const tokuSpan = next.minToku - current.minToku;
  const tokuIntoLevel = toku - current.minToku;
  const tokuToNext = next.minToku - toku;
  const progress = Math.min(1, Math.max(0, tokuIntoLevel / tokuSpan));

  return { current, next, tokuIntoLevel, tokuSpan, tokuToNext, progress };
}
