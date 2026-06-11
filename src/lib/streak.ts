// 参拝ストリークの純粋ロジック（サーバー側 cron・テストからも使う共通実装）。
// db.ts はブラウザ専用（localStorage 前提）のため、ストリーク計算だけを
// 副作用の無い純関数として切り出す。日付は端末/サーバーのローカル日付（YYYY-MM-DD）を扱う。
// -----------------------------------------------------------------------------

/** DailyLog の1日分（db.ts の DailyDay と互換）。 */
export interface StreakDay {
  acts: number;
  comeback?: boolean;
}

/** db.ts の DailyLog と互換の日次活動ログ。 */
export interface StreakLog {
  days: { [date: string]: StreakDay };
  longestEver?: number;
}

/** ローカル日付キー（YYYY-MM-DD）。UTC を使うと深夜の活動が前日扱いになるため使わない。 */
export function localDate(d: Date = new Date()): string {
  return d.toLocaleDateString('sv-SE');
}

/** 日付キーの前日（'2026-06-10' → '2026-06-09'）。正午起点で夏時間の影響を避ける。 */
export function prevDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return localDate(d);
}

/** 2つの日付キーの差（日数）。a が b より後なら正。 */
export function dayGap(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000,
  );
}

/** date から過去へ連続している日数（date 自身に活動が無ければ 0）。 */
export function streakEndingAt(days: { [date: string]: StreakDay }, date: string): number {
  let n = 0;
  let d = date;
  while (days[d]) { n += 1; d = prevDate(d); }
  return n;
}

export interface ComputedStreak {
  current: number;   // 連続日数（今日未活動でも前日まで連続なら維持表示）
  longest: number;
  todayDone: boolean; // 今日すでに活動したか
  lastDate: string | null;
}

/**
 * 日次ログから現在のストリークを導出する（db.getStreakInfo と同じ規則）。
 * @param log DailyLog 互換
 * @param today 基準日（省略時はローカル今日）。テスト・サーバー再現用に注入可能。
 */
export function computeStreak(log: StreakLog | null | undefined, today: string = localDate()): ComputedStreak {
  const days = (log && log.days && typeof log.days === 'object') ? log.days : {};
  const todayDone = !!days[today];
  const current = streakEndingAt(days, todayDone ? today : prevDate(today));
  let longest = Math.max(log?.longestEver ?? 0, current);
  const dates = Object.keys(days).sort();
  let run = 0;
  let prev: string | null = null;
  for (const d of dates) {
    run = prev !== null && prevDate(d) === prev ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }
  return { current, longest, todayDone, lastDate: dates.length ? dates[dates.length - 1] : null };
}
