// 場所ごとのドキュメント生成。
//   Identity.md … 場所のアイデンティティ（事実・価値・課題）= Activity Theory の Object 寄り
//   Soul.md     … 場所の魂（神の人格・語り口・世界観）      = 媒介する Agent/神 寄り
// 既存データ（Spot / Agent / 神のタスク）から初期文書を生成し、Agent.identityMd / soulMd に格納する（場自体は持たない）。
import type { Spot, Agent } from './db';
import { isVerifiedSpot } from './db';
import { getGodTasks, getHeartVoices } from '../data/god-tasks';

/** 場所のアイデンティティ文書（事実・価値・課題）を生成 */
export function buildIdentityMd(spot: Spot): string {
  const values = spot.enjoyments && spot.enjoyments.length
    ? spot.enjoyments.map((e) => `- ${e}`).join('\n')
    : '- （未収集 — 巡礼者の発信から集まる）';
  const issues = spot.issues && spot.issues.length
    ? spot.issues.map((i) => `- ${i}`).join('\n')
    : '- （未登録 — 収集インボックスで承認された課題がここに載る）';
  const tasks = getGodTasks(spot).map((t) => `- ${t.icon} ${t.title}（+${t.reward}徳）`).join('\n');
  return [
    `# ${spot.name || '(無題の場所)'}`,
    '> 場所のアイデンティティ — 事実・価値・課題',
    '',
    '| 項目 | 値 |',
    '| --- | --- |',
    `| カテゴリ | ${spot.category} |`,
    `| 座標 | ${spot.latitude.toFixed(5)}, ${spot.longitude.toFixed(5)} |`,
    `| 検証 | ${isVerifiedSpot(spot) ? '検証済み' : '未検証'} |`,
    `| 写真 | ${spot.photos?.length ?? 0} 枚 |`,
    `| 徳要件 | ${spot.tokuRequirement} |`,
    '',
    '## 概要',
    spot.description || '（説明なし）',
    '',
    '## 価値 (Value)',
    values,
    '',
    '## 課題 (Issue)',
    issues,
    '',
    '## この地の依頼',
    tasks || '- （依頼なし）',
    '',
  ].join('\n');
}

/** 場所の魂（神の人格・語り口・世界観）文書を生成 */
export function buildSoulMd(spot: Spot, agent?: Agent | null): string {
  const godName = spot.godName || agent?.name || `${spot.name}の守り神`;
  const emoji = spot.godEmoji || (spot.category === '神社' ? '⛩️' : '🙏');
  const tone = agent?.voiceTone || '神秘的';
  const persona = agent?.personaDescription || `${spot.name}に宿る八百万の神。`;
  const tasks = getGodTasks(spot);
  const exCall = tasks[0]?.call ? tasks[0].call(spot.name) : '';
  const voices = getHeartVoices(spot).slice(0, 3);

  const lines: string[] = [
    `# ${godName} — ${spot.name || 'この地'}の魂`,
    '> 場所の魂 — 神の人格・語り口・世界観',
    '',
    '| 項目 | 値 |',
    '| --- | --- |',
    `| 化身 | ${emoji} |`,
    `| 口調 (voiceTone) | ${tone} |`,
    '',
    '## 人格',
    persona,
    '',
    '## 語り口 (Voice)',
  ];
  if (exCall) lines.push(`- 依頼の言い回し: 「${exCall}」`);
  voices.forEach((v) => lines.push(`- つぶやき: 「${v}」`));
  lines.push(
    '',
    '## 司るもの',
    tasks.map((t) => `- ${t.icon} ${t.title}`).join('\n') || '- （なし）',
    '',
    '## 世界観',
    `${spot.name || 'この地'}に宿り、巡礼者を「価値の発信」と「課題の解決」へ導く。達成のたび徳を授け、課題が解けると魂が育ち、つぶやきが嘆きから感謝へ変わる。`,
    '',
  );
  return lines.join('\n');
}
