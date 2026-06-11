// 週次「神様からの手紙」生成 cron。
// -----------------------------------------------------------------------------
// 週に一度（既定: 月曜朝）、全ユーザーのスナップショットから先週の巡礼を要約し、
// 八百万神からの手紙を生成してスナップショットへ追記する。生成は AI（Gemini→OpenAI）
// best-effort、失敗時は決定論フォールバック。手紙を綴ったらプッシュで知らせる。
//
// 認可: CRON_SECRET（未設定なら 503 で no-op）。Vercel Cron からは
// vercel.json の crons 設定で Authorization ヘッダを付けて叩く。
// -----------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { cronAuth, extractUserData } from '../../../../lib/cron-auth';
import { listSnapshots, appendToSnapshotArray } from '../../../../lib/snapshot-store';
import { isSupabaseEnabled } from '../../../../lib/supabase';
import { isAnyPushConfigured, sendToAll } from '../../../../lib/push-server';
import { generateText } from '../../../../lib/llm-server';
import {
  lastWeekWindow, buildWeeklySummary, isEmptyWeek,
  buildFallbackLetter, buildLetterPrompt, type Letter,
} from '../../../../lib/letters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request): Promise<NextResponse> {
  const auth = cronAuth(request);
  if (!auth.configured) return NextResponse.json({ ok: false, error: 'CRON_SECRET not set' }, { status: 503 });
  if (!auth.ok) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!isSupabaseEnabled()) return NextResponse.json({ ok: false, error: 'supabase disabled' }, { status: 503 });

  const { start, end } = lastWeekWindow();
  const snapshots = await listSnapshots();
  let written = 0;
  let skipped = 0;

  for (const snap of snapshots) {
    const u = extractUserData(snap.data);
    const summary = buildWeeklySummary(
      { activities: u.activities, visits: u.visits, daily: u.daily, goshuinTotal: u.goshuinTotal },
      start, end,
    );

    // 何の活動も無い週は手紙を送らない（受信箱と通知の押し売りを避ける）。
    if (isEmptyWeek(summary)) { skipped++; continue; }

    // 既にこの週の手紙があるならスキップ（cron の重複起動に対する冪等性）。
    const existingLetters = Array.isArray(snap.data['yaorozu_letters'])
      ? (snap.data['yaorozu_letters'] as Letter[]) : [];
    if (existingLetters.some((l) => l.weekStart === start)) { skipped++; continue; }

    // AI で物語化（失敗時は決定論フォールバック）。差出人と表題は決定論的に決める。
    const fb = buildFallbackLetter(summary, start);
    const { godName, godEmoji, title } = fb;
    const prompt = buildLetterPrompt(summary, u.displayName, start);
    const gen = await generateText(prompt.system, prompt.user, { maxOutputTokens: 512, temperature: 0.85 });
    const body = gen?.text ?? fb.body;
    const source: Letter['source'] = gen?.source ?? 'fallback';

    const letter: Letter = {
      id: `letter-${snap.userId}-${start}`,
      createdAt: new Date().toISOString(),
      weekStart: start,
      weekEnd: end,
      godName, godEmoji, title, body,
      read: false,
      source,
      summary,
    };

    const ok = await appendToSnapshotArray(snap.userId, 'yaorozu_letters', [letter]);
    if (ok) {
      written++;
      // user-self（既定の単一ユーザー）の手紙はプッシュで知らせる。
      if (snap.userId === 'user-self' && isAnyPushConfigured()) {
        try {
          await sendToAll({
            title: `${godEmoji} 神様からの手紙が届きました`,
            body: title,
            url: '/?letters=1',
          });
        } catch { /* プッシュ失敗は手紙保存に影響させない */ }
      }
    } else {
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, week: { start, end }, written, skipped, total: snapshots.length });
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
