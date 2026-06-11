// 日次ストリークリマインダー cron。
// -----------------------------------------------------------------------------
// 夕方に一度、まだ今日参拝していないが連続記録が続いているユーザーへ
// 「灯を絶やすな」と背中を押すプッシュを送る。
//
// プッシュは現状ブロードキャスト（sendToAll は購読端末すべてに配信／個別 user 宛て
// ターゲティング不可）。そのため二重配信を避け、デモの基準ユーザー user-self の
// 状態をもとに1回だけ送る。multi-user の個別配信は将来の購読↔userId 紐付けで対応。
//
// 認可: CRON_SECRET（未設定なら 503 で no-op）。
// -----------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { cronAuth, extractUserData } from '../../../../lib/cron-auth';
import { listSnapshots } from '../../../../lib/snapshot-store';
import { isSupabaseEnabled } from '../../../../lib/supabase';
import { isAnyPushConfigured, sendToAll } from '../../../../lib/push-server';
import { computeStreak } from '../../../../lib/streak';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request): Promise<NextResponse> {
  const auth = cronAuth(request);
  if (!auth.configured) return NextResponse.json({ ok: false, error: 'CRON_SECRET not set' }, { status: 503 });
  if (!auth.ok) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!isSupabaseEnabled()) return NextResponse.json({ ok: false, error: 'supabase disabled' }, { status: 503 });
  if (!isAnyPushConfigured()) return NextResponse.json({ ok: true, sent: false, reason: 'no push configured' });

  const snapshots = await listSnapshots();
  const self = snapshots.find((s) => s.userId === 'user-self') ?? snapshots[0];
  if (!self) return NextResponse.json({ ok: true, sent: false, reason: 'no snapshot' });

  const { daily } = extractUserData(self.data);
  const streak = computeStreak(daily);

  // 連続記録があり、今日まだ参拝していない場合のみ通知（途切れ防止）。
  if (streak.current >= 1 && !streak.todayDone) {
    const body = streak.current >= 3
      ? `🔥 ${streak.current}日連続の参拝中。今日の一参拝で灯をつなぎましょう。`
      : '今日もどこかの社へ。連続参拝の灯を絶やさずに。';
    try {
      await sendToAll({ title: '今日の参拝はお済みですか', body, url: '/' });
      return NextResponse.json({ ok: true, sent: true, streak: streak.current });
    } catch {
      return NextResponse.json({ ok: true, sent: false, reason: 'push failed' });
    }
  }

  return NextResponse.json({ ok: true, sent: false, streak: streak.current, todayDone: streak.todayDone });
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
