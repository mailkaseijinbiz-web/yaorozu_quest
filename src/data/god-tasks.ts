// 神様からの依頼（タスク）— 場に紐づく解決ロジック
// -----------------------------------------------------------------------------
// タスク／クエストの統合モデルは ./tasks.ts に集約。本ファイルは Spot に依存する
// 解決系（どのタスクをこの場で出すか）と、旧名称の後方互換エイリアスを提供する。
// -----------------------------------------------------------------------------

import { Spot } from '../lib/db';
import {
  TASK_CATALOG,
  COMMON_TASK_TYPES,
  type Task,
  type TaskType,
  type TaskKind,
} from './tasks';

// ── 後方互換エイリアス（旧名称をそのまま使えるように） ──
export type GodTaskType = TaskType;
export type GodTask = Task;
export type GodFunction = TaskKind;
export { TASK_CATALOG, COMMON_TASK_TYPES, TASK_TONE, GOD_FUNCTIONS, kindOfType, kindOfType as functionOfTask } from './tasks';

/** カテゴリごとの追加タスク（共通種別にプラスされる） */
function categoryExtraTypes(category: string): TaskType[] {
  if (category === '商業施設') return ['buy'];
  if (category === '飲食店' || category === '商店街') return ['eat'];
  if (category === '寺院' || category === '神社' || category === '公園') return ['cleaning'];
  return [];
}

/**
 * スポットで有効なタスク種別を解決する。
 * spot.taskTypes（管理画面設定）があればそれを優先、無ければ
 * 共通種別＋カテゴリ別タスクを返す。
 */
export function resolveTaskTypes(spot: Pick<Spot, 'category' | 'taskTypes'>): TaskType[] {
  if (spot.taskTypes && spot.taskTypes.length > 0) {
    const types = spot.taskTypes.filter((t): t is TaskType => t in TASK_CATALOG);
    if (!types.includes('meditate')) types.push('meditate');
    return types;
  }
  return [...COMMON_TASK_TYPES, ...categoryExtraTypes(spot.category), 'meditate'];
}

/** カタログ雛形を、その場の Task インスタンスに具体化する。 */
function instantiate(type: TaskType, spotId?: string): Task {
  return { ...TASK_CATALOG[type], id: type, spotId };
}

/** スポットに宿る神の依頼タスク一覧を生成する（徳の高い順にソート）。 */
export function getGodTasks(spot: Pick<Spot, 'name' | 'category' | 'taskTypes'>): Task[] {
  return resolveTaskTypes(spot)
    .map((type) => instantiate(type))
    .sort((a, b) => b.reward - a.reward);
}

/**
 * 場のタスク一覧（依頼タスク＋課題タスク）を構築する。
 * resolveTaskTypes のカタログタスクに加え、spot.issues ごとに resolveIssue タスクを足す。
 */
export function buildSpotTasks(spot: Pick<Spot, 'id' | 'name' | 'category' | 'taskTypes' | 'issues'>): Task[] {
  const base = resolveTaskTypes(spot).map((type) => instantiate(type, spot.id));
  const issueTasks: Task[] = (spot.issues ?? []).map((text, i) => ({
    ...TASK_CATALOG.resolveIssue,
    id: `issue-${i}`,
    spotId: spot.id,
    title: `課題を動かす：${text}`,
    issueRef: { issueIndex: i, issueText: text },
  }));
  return [...issueTasks, ...base].sort((a, b) => b.reward - a.reward);
}

/**
 * 場所の「心の声」を返す。
 * 本来は SNS／ウェブの情報から“そのとき最も相応しい”話題を選ぶ想定。
 * デモでは時間帯コンテキスト＋話題シミュレーション＋依頼を合成する。
 */
export function getHeartVoices(spot: Pick<Spot, 'name' | 'category' | 'taskTypes'>): string[] {
  const h = new Date().getHours();
  const tod = h < 5 ? '未明' : h < 10 ? '朝' : h < 15 ? '昼' : h < 19 ? '夕暮れ' : '夜';
  const ctxMap: Record<string, string> = {
    未明: 'まだ眠りの中にある',
    朝: '清々しい朝の気が満ちておる',
    昼: '今、賑わいを見せておるようじゃ',
    夕暮れ: '黄金色に染まる頃合いじゃ',
    夜: '静寂に神気が宿る刻',
  };
  return [
    `${tod}の${spot.name}…${ctxMap[tod]}。`,
    `巷では今、${spot.name}が話題のようじゃ…`,
    ...getGodTasks(spot)
      .map((t) => t.murmur)
      .filter((m): m is string => !!m),
  ];
}
