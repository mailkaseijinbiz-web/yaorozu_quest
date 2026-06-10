// バッジ & 称号システム
// -----------------------------------------------------------------------------
// ユーザーの貢献度（UserContribution）と累積徳から、獲得バッジ・称号を導出する。
//   - 訪問数バッジ：訪れたスポット数に応じて
//   - ミッション称号：写真→フォトグラファー、点検→メンテナー 等
//   - フォロワーバッジ：フォロワー数に応じて
// -----------------------------------------------------------------------------

import { User, UserContribution, db } from '../lib/db';

export interface BadgeDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
  /** 進捗の現在値 */
  current: (s: UserContribution, u: User) => number;
  /** 達成に必要な値 */
  target: number;
  /** カテゴリ（表示グルーピング用） */
  group: '訪問' | '写真' | '点検' | 'フォロワー' | '徳' | '日参';
}

export const BADGES: BadgeDef[] = [
  // ── 訪問数 ──
  { id: 'visit-1', icon: '👣', name: 'はじまりの一歩', desc: 'スポットを1つ訪れた', group: '訪問', target: 1, current: (s) => s.visitedSpotIds.length },
  { id: 'visit-10', icon: '🗺️', name: '街の探訪者', desc: 'スポットを10ヶ所訪れた', group: '訪問', target: 10, current: (s) => s.visitedSpotIds.length },
  { id: 'visit-50', icon: '🧭', name: '東京巡礼者', desc: 'スポットを50ヶ所訪れた', group: '訪問', target: 50, current: (s) => s.visitedSpotIds.length },
  { id: 'visit-100', icon: '🏯', name: '八百万踏破', desc: 'スポットを100ヶ所訪れた', group: '訪問', target: 100, current: (s) => s.visitedSpotIds.length },

  // ── 写真ミッション ──
  { id: 'photo-10', icon: '📷', name: 'フォトグラファー', desc: '写真ミッションを10回達成', group: '写真', target: 10, current: (s) => s.taskCounts.photo || 0 },
  { id: 'photo-50', icon: '🎞️', name: '名フォトグラファー', desc: '写真ミッションを50回達成', group: '写真', target: 50, current: (s) => s.taskCounts.photo || 0 },

  // ── 点検（清掃）ミッション ──
  { id: 'clean-10', icon: '🧹', name: 'メンテナー', desc: '点検ミッションを10回達成', group: '点検', target: 10, current: (s) => s.taskCounts.cleaning || 0 },
  { id: 'clean-50', icon: '🛡️', name: '街の守り手', desc: '点検ミッションを50回達成', group: '点検', target: 50, current: (s) => s.taskCounts.cleaning || 0 },

  // ── フォロワー ──
  { id: 'fol-100', icon: '⭐', name: '人気者', desc: 'フォロワーが100人に到達', group: 'フォロワー', target: 100, current: (s) => s.followers },
  { id: 'fol-500', icon: '🌟', name: '教祖', desc: 'フォロワーが500人に到達', group: 'フォロワー', target: 500, current: (s) => s.followers },

  // ── 徳 ──
  { id: 'toku-500', icon: '🔆', name: '大徳者', desc: '累積徳が500に到達', group: '徳', target: 500, current: (_s, u) => u.totalToku },

  // ── 日参（参拝ストリーク。最長記録で判定するので、途切れても獲得済みバッジは戻らない） ──
  { id: 'streak-7', icon: '🔥', name: '七日詣', desc: '7日連続で徳を積んだ', group: '日参', target: 7, current: () => db.getStreakInfo().longest },
  { id: 'streak-30', icon: '⛩️', name: '月参り', desc: '30日連続で徳を積んだ', group: '日参', target: 30, current: () => db.getStreakInfo().longest },
];

export interface BadgeState extends BadgeDef {
  earned: boolean;
  progress: number; // 0〜1
}

/** 全バッジの獲得状態を返す */
export function getBadgeStates(stats: UserContribution, user: User): BadgeState[] {
  return BADGES.map((b) => {
    const cur = b.current(stats, user);
    return { ...b, earned: cur >= b.target, progress: Math.min(1, cur / b.target) };
  });
}

// -----------------------------------------------------------------------------
// 称号（ミッション貢献で得られる名誉称号。レベル称号とは別軸）
// -----------------------------------------------------------------------------

export interface EarnedTitle {
  id: string;
  icon: string;
  name: string;
  reason: string;
}

/** 貢献度から獲得済みの称号を導出する */
export function getEarnedTitles(stats: UserContribution, user: User): EarnedTitle[] {
  const titles: EarnedTitle[] = [];
  const photo = stats.taskCounts.photo || 0;
  const clean = stats.taskCounts.cleaning || 0;
  const review = stats.taskCounts.review || 0;
  const eat = stats.taskCounts.eat || 0;

  if (photo >= 50) titles.push({ id: 't-photo2', icon: '🎞️', name: '名フォトグラファー', reason: '写真ミッション50回' });
  else if (photo >= 10) titles.push({ id: 't-photo', icon: '📷', name: 'フォトグラファー', reason: '写真ミッション10回' });

  if (clean >= 50) titles.push({ id: 't-clean2', icon: '🛡️', name: '街の守り手', reason: '点検ミッション50回' });
  else if (clean >= 10) titles.push({ id: 't-clean', icon: '🧹', name: 'メンテナー', reason: '点検ミッション10回' });

  if (review >= 10) titles.push({ id: 't-review', icon: '🗣️', name: '語り部', reason: '口コミ10回' });
  if (eat >= 10) titles.push({ id: 't-eat', icon: '🍜', name: '美食の使徒', reason: '実食の声10回' });
  if (stats.followers >= 100) titles.push({ id: 't-pop', icon: '⭐', name: '人気者', reason: 'フォロワー100人' });

  return titles;
}

// -----------------------------------------------------------------------------
// 神にちなんだアカウントアイコン
// -----------------------------------------------------------------------------

const GOD_AVATARS = ['⛩️', '🦊', '🐉', '🙏', '🌊', '🌲', '🪷', '🔥', '🌸', '🦌', '🍶', '🏮'];

/** ユーザーIDから決定論的に神アイコン絵文字を割り当てる */
export function godAvatarEmoji(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return GOD_AVATARS[h % GOD_AVATARS.length];
}
