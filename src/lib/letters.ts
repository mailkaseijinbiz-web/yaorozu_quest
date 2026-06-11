// 「神様からの手紙」（週次の物語化ダイジェスト）。
// -----------------------------------------------------------------------------
// 週に一度、その週の巡礼（参拝・徳・ストリーク・御朱印）を八百万神が手紙として
// 振り返る。サーバー側 cron（/api/cron/weekly-letter）が生成して各ユーザーの
// スナップショットへ追記し、クライアントは受信箱（LetterInbox）で読み返す。
//
// このファイルは「純粋ロジック（要約・本文生成・プロンプト構築）」と
// 「クライアント用ストア（localStorage 読み書き）」を持つ。純粋ロジックは
// サーバー cron からも import できるよう副作用フリーに保つ。
// -----------------------------------------------------------------------------

import { streakEndingAt, localDate, prevDate, type StreakLog } from './streak';
import { schedulePush } from './cloud-sync';

// ── 型 ──────────────────────────────────────────────────────────────────────

export interface Letter {
  id: string;
  createdAt: string;   // ISO 8601（手紙を綴った日時）
  weekStart: string;   // YYYY-MM-DD（対象週の月曜）
  weekEnd: string;     // YYYY-MM-DD（対象週の日曜）
  godName: string;     // 差出人（最も縁の深かった神、無ければ八百万神）
  godEmoji: string;
  title: string;
  body: string;
  read: boolean;
  source: 'gemini' | 'openai' | 'fallback';
  summary: WeeklySummary;
}

export interface WeeklySummary {
  visits: number;        // 対象週の参拝・訪問数
  tokuGained: number;    // 対象週に積んだ徳
  questsCompleted: number;
  photos: number;
  goshuinTotal: number;  // 御朱印の累計（保有数）
  streak: number;        // 週末時点の連続日数
  spotNames: string[];   // 対象週に巡った場の名前（重複なし）
  topGod?: { name: string; emoji: string };
}

// 要約の入力（db のエンティティと互換の最小形。サーバーでも使うため緩く受ける）。
export interface LetterInputActivity {
  type: string;
  source?: 'human' | 'system';
  reward?: number;
  spotId?: string;
  detail?: string;
  createdAt: string;
}
export interface LetterInputVisit {
  spotName?: string;
  godEmoji?: string;
  visitedAt: string;
}

export interface WeeklyData {
  activities: LetterInputActivity[];
  visits: LetterInputVisit[];
  daily: StreakLog | null;
  goshuinTotal: number;
}

// ── 週の区切り ────────────────────────────────────────────────────────────────

/** 指定日が属する「週（月曜〜日曜）」の境界を返す。 */
export function weekWindow(today: string = localDate()): { start: string; end: string } {
  const d = new Date(`${today}T12:00:00`);
  const dow = d.getDay(); // 0=日, 1=月, ... 6=土
  const backToMonday = (dow + 6) % 7; // 月曜までさかのぼる日数
  let start = today;
  for (let i = 0; i < backToMonday; i++) start = prevDate(start);
  let end = start;
  for (let i = 0; i < 6; i++) {
    const n = new Date(`${end}T12:00:00`);
    n.setDate(n.getDate() + 1);
    end = localDate(n);
  }
  return { start, end };
}

/** cron が「直前に終わった週」を振り返るための、先週（月〜日）の境界。 */
export function lastWeekWindow(today: string = localDate()): { start: string; end: string } {
  const thisWeek = weekWindow(today);
  let start = thisWeek.start;
  for (let i = 0; i < 7; i++) start = prevDate(start);
  let end = start;
  for (let i = 0; i < 6; i++) {
    const n = new Date(`${end}T12:00:00`);
    n.setDate(n.getDate() + 1);
    end = localDate(n);
  }
  return { start, end };
}

function inWindow(iso: string, start: string, end: string): boolean {
  const day = localDate(new Date(iso));
  return day >= start && day <= end;
}

// ── 要約 ─────────────────────────────────────────────────────────────────────

/** 対象週の活動から週次サマリーを組み立てる（純関数）。 */
export function buildWeeklySummary(data: WeeklyData, start: string, end: string): WeeklySummary {
  const acts = (data.activities ?? []).filter(
    (a) => (a.source ?? 'human') === 'human' && inWindow(a.createdAt, start, end),
  );
  const visitsRecorded = (data.visits ?? []).filter((v) => inWindow(v.visitedAt, start, end));

  const tokuGained = acts.reduce((s, a) => s + (a.reward ?? 0), 0);
  const questsCompleted = acts.filter((a) => a.type === 'quest_complete').length;
  const photos = acts.filter((a) => a.type === 'photo').length;

  // 巡った場の名前：参拝記録の spotName を優先（人間が読める名前があるため）
  const spotNames = Array.from(
    new Set(visitsRecorded.map((v) => v.spotName).filter((n): n is string => !!n)),
  );
  // 訪問数：記録（visits）と活動ログの visit/quest_complete のうち多い方を採る
  const visitActs = acts.filter((a) => a.type === 'visit').length;
  const visits = Math.max(visitsRecorded.length, visitActs);

  // 最も縁の深かった神：参拝記録の絵文字の最頻値
  const emojiCount = new Map<string, number>();
  for (const v of visitsRecorded) {
    if (v.godEmoji) emojiCount.set(v.godEmoji, (emojiCount.get(v.godEmoji) ?? 0) + 1);
  }
  let topGod: { name: string; emoji: string } | undefined;
  if (emojiCount.size) {
    const [emoji] = [...emojiCount.entries()].sort((a, b) => b[1] - a[1])[0];
    topGod = { name: '土地の神', emoji };
  }

  // ストリーク：対象週の終わり（end）までで最後に活動した日を起点に連続日数を数える。
  // cron は週明けに先週を振り返るため、end をそのまま起点にすると週末の空白で 0 になってしまう。
  const days = (data.daily && typeof data.daily.days === 'object') ? data.daily.days : {};
  const lastActive = Object.keys(days).filter((d) => d <= end).sort().pop();
  const streak = lastActive ? streakEndingAt(days, lastActive) : 0;

  return {
    visits,
    tokuGained,
    questsCompleted,
    photos,
    goshuinTotal: data.goshuinTotal ?? 0,
    streak,
    spotNames,
    topGod,
  };
}

/** サマリーに何の活動も無いか（手紙を送る価値があるか）の判定。 */
export function isEmptyWeek(s: WeeklySummary): boolean {
  return s.visits === 0 && s.tokuGained === 0 && s.questsCompleted === 0 && s.photos === 0;
}

// ── 本文生成 ──────────────────────────────────────────────────────────────────

const MONTH_KIGO: Record<number, string> = {
  1: '睦月', 2: '如月', 3: '弥生', 4: '卯月', 5: '皐月', 6: '水無月',
  7: '文月', 8: '葉月', 9: '長月', 10: '神無月', 11: '霜月', 12: '師走',
};

function weekLabel(start: string): string {
  const m = Number(start.slice(5, 7));
  return MONTH_KIGO[m] ? `${MONTH_KIGO[m]}の週` : `${m}月の週`;
}

/** AI が使えないときの決定論的フォールバック手紙。穏やかな神の語り口。 */
export function buildFallbackLetter(
  summary: WeeklySummary,
  start: string,
): { title: string; body: string; godName: string; godEmoji: string } {
  const godEmoji = summary.topGod?.emoji ?? '⛩️';
  const godName = summary.topGod?.name ?? '八百万神';

  const lines: string[] = [];
  lines.push(`巡礼者よ、${weekLabel(start)}の歩みをここに記す。`);

  if (summary.visits > 0) {
    const where = summary.spotNames.length
      ? `とりわけ${summary.spotNames.slice(0, 2).join('・')}での祈りは、土地の気をよく整えた。`
      : '足を運んだその一歩一歩が、土地の気をよく整えた。';
    lines.push(`この週、そなたは${summary.visits}つの場を訪ね、${where}`);
  } else {
    lines.push('この週は静かであったが、心に神を思う者の歩みは途切れぬものだ。');
  }

  if (summary.tokuGained > 0) {
    lines.push(`積まれた徳は${summary.tokuGained}。世の幸福の総量は、確かにそなたの分だけ増した。`);
  }
  if (summary.streak >= 2) {
    lines.push(`${summary.streak}日の連なりは、習いとなりつつある。この灯を絶やすな。`);
  }
  if (summary.questsCompleted > 0) {
    lines.push(`授けた務めのうち${summary.questsCompleted}を果たしたこと、しかと見届けた。`);
  }

  lines.push('来たる週も、迷うたときは近くの社を訪ねるがよい。我らはいつもそこに在る。');

  return {
    title: `${weekLabel(start)}の便り`,
    body: lines.join('\n'),
    godName,
    godEmoji,
  };
}

/** LLM 用のプロンプト（systemInstruction / user）を組み立てる。 */
export function buildLetterPrompt(summary: WeeklySummary, start: string, displayName: string): {
  system: string;
  user: string;
} {
  const system = [
    'あなたは日本の「八百万神（やおろずのかみ）」の一柱です。土地に宿り、巡礼者を静かに見守る存在として、',
    '一週間の巡礼を振り返る「手紙」を綴ってください。語り口は荘厳すぎず、温かく、古風で詩的に。',
    '制約: 280〜360字程度の日本語。改行で2〜4段落。誇張や数字の羅列を避け、具体的な場の名前があれば一度だけ触れる。',
    '最後は来週そっと背中を押す一文で締める。署名や「拝啓」などの定型は不要。本文のみを返す。',
  ].join('\n');

  const facts = [
    `対象週: ${start} 週`,
    `巡礼者の名: ${displayName || '巡礼者'}`,
    `訪れた場の数: ${summary.visits}`,
    summary.spotNames.length ? `巡った場: ${summary.spotNames.slice(0, 3).join('、')}` : '',
    `積んだ徳: ${summary.tokuGained}`,
    `達成した務め: ${summary.questsCompleted}`,
    `連続参拝: ${summary.streak}日`,
    `御朱印の累計: ${summary.goshuinTotal}`,
  ].filter(Boolean).join('\n');

  const user = `次の事実をもとに、その週をねぎらう手紙を綴ってください。\n${facts}`;
  return { system, user };
}

// ── クライアント用ストア（localStorage） ──────────────────────────────────────
// NOTE: スナップショット同期の対象キー。サーバー cron は同名キーへ追記する。

export const LETTERS_KEY = 'yaorozu_letters';
const MAX_LETTERS = 60;

function readLetters(): Letter[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LETTERS_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** 受信箱の手紙（新しい順）。 */
export function getLetters(): Letter[] {
  return readLetters().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** 未読件数。 */
export function unreadLetterCount(): number {
  return readLetters().filter((l) => !l.read).length;
}

function writeLetters(list: Letter[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LETTERS_KEY, JSON.stringify(list.slice(0, MAX_LETTERS)));
  } catch { /* 容量超過は無視 */ }
}

/** 手紙を1通既読にする。 */
export function markLetterRead(id: string): void {
  const list = readLetters();
  let changed = false;
  for (const l of list) { if (l.id === id && !l.read) { l.read = true; changed = true; } }
  if (changed) {
    writeLetters(list);
    schedulePush(); // 既読状態をクラウドへ同期（LETTERS_KEY は SYNC_KEYS 対象）
  }
}
