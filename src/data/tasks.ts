// 統合タスク／クエストモデル（唯一の真実）
// -----------------------------------------------------------------------------
// 神が巡礼者に依頼する「タスク」は3種の機能に分かれる：
//   情報収集(sense) … 場所の今・出来事・姿を集める（写真・コンテキスト等）
//   理解判断(understand) … 集めた情報・投稿をジャッジし、価値と課題を読み解く
//   操作(act) … 価値を広げ、課題を解決し、世界へ働きかける（来訪・課題解決等）
// 「クエスト」はタスクの集まり（Quest = Task[]）。場の 価値・課題・魂 から生成される。
// 旧 GodTask / ChallengeStep / Challenge は本ファイルの Task / Quest のエイリアス。
// -----------------------------------------------------------------------------

/** 蘊蓄の分類（町歩きの知識） */
export type TriviaCategory = '地形' | '歴史' | '建築' | '道路';

/** 神の根源的な3機能。人間へのタスク（依頼）によって各機能が強化される。 */
export type TaskKind = 'sense' | 'understand' | 'act'; // 情報収集 / 理解判断 / 操作

/** タスク種別（既存9種＋ visit / resolveIssue / judge）。 */
export type TaskType =
  | 'context' // sense — 今の様子（混雑・雰囲気・営業）を集める＝コンテキスト生成
  | 'photo' // sense — 景観の写真を奉納する＝一次情報の生成
  | 'evaluate' // understand — 集まったクエスト写真を評価・選別する
  | 'event' // sense — 今この場のできごとを共有する＝コンテキスト生成
  | 'review' // understand — 口コミで価値を言語化し後続の巡礼者へ伝える
  | 'sns' // act — 価値を場の外（SNS）へ拡散する＝価値を広げる
  | 'buy' // act — 買物を報告する＝経済的賑わいに寄与する
  | 'eat' // understand — 実食の感想（味の評価）を伝える
  | 'cleaning' // sense — 清掃状況を確認・報告する＝衛生のコンテキスト
  | 'visit' // sense — ジオフェンス来訪（旧 ChallengeStep の位置要素）
  | 'resolveIssue' // act — 場の課題(Spot.issues)を解決する → 課題−1・価値+1（活気+2）
  | 'judge' // understand — 投稿物のジャッジ（evaluate の一般化）
  // ── 世界の値（活気=価値−課題 / 覚り=徳−煩悩）を直接動かす拡張タスク ──
  | 'value_ask' // sense — 人間からこの場の「価値」を集める → enjoyments に加算（活気+1）
  | 'issue_ask' // sense — 人間からこの場の「課題」を集める → issues に加算（解決の素材）
  | 'bonnou_ask' // sense — 人間の「煩悩」を神が問う → 煩悩ストアに記録（覚りの調整素材）
  | 'bonnou_resolve' // act — 人間の煩悩を1つ浄化する → 未解決煩悩−1（覚り+1）
  | 'walk' // act — 散歩で心を整え、煩悩を一つ手放す → 未解決煩悩−1（覚り+1）
  | 'cleanup' // act — 実際に掃除をして場を整える＝場へ働きかける操作
  | 'avatar_photo' // sense — アバターになる写真を撮る → ユーザーのアバターに設定
  | 'goshuin' // sense — 神と会話し御朱印を授かる（写真不要・会話で完了する軽量クエスト）
  // ── バリエーション拡張 ──
  | 'weather' // sense（場）— 今の天気・体感を伝える＝コンテキスト生成
  | 'discover' // sense（場）— 隠れた魅力を見つけて報告 → enjoyments に加算（活気+1）
  | 'wish' // sense（人間）— 願いを書いて奉納する＝心のコンテキスト
  | 'gratitude' // sense（人間）— 神へ感謝を捧げる（覚りの所作）
  | 'recommend' // understand（場）— 集めた候補から一番を選ぶ
  | 'verify' // understand（場）— 集まった情報の正しさを確かめる
  | 'donate' // act（場）— お賽銭・寄進をする＝場へ働きかける
  | 'guide' // act（場）— 道案内をして他の巡礼者を助ける
  | 'meditate'; // act（人間）— 瞑想して心を鎮め、煩悩を一つ手放す（覚り+1）

/** resolveIssue タスクが参照する課題 */
export interface IssueRef {
  issueIndex: number;
  issueText: string;
}

/** 統合タスク。場の単発依頼（旧 GodTask）もクエストのステップ（旧 ChallengeStep）もこれ。 */
export interface Task {
  /** クエスト内で一意（'s0'…）。場の依頼タスクは type 名を id に使う。 */
  id: string;
  /** 強化する神の機能（type から導出。グルーピング用に保持） */
  kind: TaskKind;
  /** タスク種別 */
  type: TaskType;
  /** 場 FK（場由来タスクで設定） */
  spotId?: string;

  /** アイコン絵文字 */
  icon: string;
  /** 一覧・ボタン用の短いラベル */
  label: string;
  /** タスクの見出し */
  title: string;
  /** 達成で得られる徳 */
  reward: number;

  /** 神の依頼セリフ生成（場の依頼タスク。土地名を織り込む） */
  call?: (place: string) => string;
  /** 地図吹き出し用の短い神の声 */
  murmur?: string;

  /** クエストステップの「次どうすれば良いか」 */
  action?: string;
  /** 町歩きの蘊蓄（知識） */
  trivia?: string;
  triviaCategory?: TriviaCategory;
  /** 写真を撮るミッションか */
  photo?: boolean;
  /** 位置（ジオフェンス用。MapTab の距離計算がそのまま使う） */
  lat?: number;
  lng?: number;

  /** resolveIssue 用。参照する課題 */
  issueRef?: IssueRef;
}

/** クエスト = タスクの集まり（旧 Challenge）。 */
export interface Quest {
  id: string;
  /** 場 FK（生成/場クエストで設定。エリア周遊の静的クエストは未設定） */
  spotId?: string;
  title: string;
  description: string;
  /** 難易度（1=易 / 2=中 / 3=難） */
  difficulty: 1 | 2 | 3;
  /** 参加に必要な最低レベル */
  minLevel: number;
  /** 所要時間（分） */
  estMinutes: number;
  badgeIcon: string;
  badgeName: string;
  /** ゴール地点 */
  goalName: string;
  goalLat: number;
  goalLng: number;
  /** タスク列（旧 Challenge.steps） */
  tasks: Task[];
  /** 出自 */
  source?: 'static' | 'generated' | 'simple';
  /** 生成日時（ISO 8601）。生成クエストの TTL 判定に使う（未参加で期限切れなら削除） */
  createdAt?: string;
}

/** カタログ用のタスク雛形（id / spotId / ステップ固有値を除いた固定定義）。 */
export type CatalogTask = Pick<Task, 'type' | 'kind' | 'icon' | 'label' | 'title' | 'reward' | 'call' | 'murmur'>;

/** 全タスクのカタログ（管理画面の選択肢にも使う） */
export const TASK_CATALOG: Record<TaskType, CatalogTask> = {
  context: {
    type: 'context',
    kind: 'sense',
    icon: '🌡️',
    label: '今の様子を伝える',
    title: 'この場の空気を観察する',
    reward: 25,
    call: (p) => `今の${p}はどうじゃ？　目に見えるもの、聞こえる音、肌で感じる空気を、ありのままに教えておくれ。`,
    murmur: 'のう、この場の空気を教えておくれ…',
  },
  photo: {
    type: 'photo',
    kind: 'sense',
    icon: '📸',
    label: '光景を切り取る',
    title: '誰も気付かぬ一枚を奉納',
    reward: 30,
    call: (p) => `おお、旅の者よ。${p}でそなたの心を動かした「見落とされがちな光景」を一枚、切り取って奉納してはくれぬか。`,
    murmur: 'そなたよ、この地の隠れた姿を切り取っておくれ…',
  },
  evaluate: {
    type: 'evaluate',
    kind: 'understand',
    icon: '⭐',
    label: '写真を評価',
    title: 'クエスト写真を評価する',
    reward: 35,
    call: (p) => `${p}を巡った皆の一枚を、そなたの目で評しておくれ。佳き写真には光を当ててやってほしい。`,
    murmur: 'そなたの目で、皆の佳き一枚を選んでおくれ…',
  },
  event: {
    type: 'event',
    kind: 'sense',
    icon: '🎏',
    label: 'できごとを共有',
    title: '今のできごとを共有',
    reward: 20,
    call: (p) => `今この${p}で何が起きておる？　そなたの目に映るものを、わしに教えておくれ。`,
    murmur: 'のう、今のできごとを教えておくれ…',
  },
  review: {
    type: 'review',
    kind: 'understand',
    icon: '🗣️',
    label: '口コミを共有',
    title: '口コミを言伝て',
    reward: 50,
    call: (p) => `${p}の良さを、後から来る巡礼者へ言伝てしておくれ。それが何よりの供物じゃ。`,
    murmur: 'そなたの言葉で、この地を伝えておくれ…',
  },
  sns: {
    type: 'sns',
    kind: 'act',
    icon: '📣',
    label: 'SNSにシェア',
    title: 'SNSで広める',
    reward: 15,
    call: (p) => `この${p}の名を、外の世界にも広めてはくれぬか。縁が縁を呼ぶでな。`,
    murmur: 'のう旅人よ、わが名を広めてはくれぬか…',
  },
  buy: {
    type: 'buy',
    kind: 'act',
    icon: '🛍️',
    label: '買物を報告',
    title: 'モノを買ったと伝える',
    reward: 40,
    call: (p) => `${p}で何か佳き品を求めたか？　手にした品を、わしにも見せておくれ。`,
    murmur: 'そなた、佳き品を見せておくれ…',
  },
  eat: {
    type: 'eat',
    kind: 'understand',
    icon: '🍜',
    label: '実食の声',
    title: '食べた感想を伝える',
    reward: 40,
    call: (p) => `${p}の味はどうじゃった？　美味かったなら、その喜びの声を上げておくれ。`,
    murmur: 'のう、味の感想を聞かせておくれ…',
  },
  cleaning: {
    type: 'cleaning',
    kind: 'sense',
    icon: '🧹',
    label: '清掃を確認',
    title: '掃除の行き届きを確認',
    reward: 25,
    call: (p) => `${p}の境内、掃除は行き届いておるか？　乱れがあれば、わしに知らせておくれ。`,
    murmur: 'そなた、掃除の様子を確かめておくれ…',
  },
  visit: {
    type: 'visit',
    kind: 'sense',
    icon: '📍',
    label: 'この地に立つ',
    title: 'その場の空気を味わう',
    reward: 10,
    call: (p) => `まずは${p}へ足を運び、ただ静かに深呼吸をして、そこにある気配を肌で感じておくれ。`,
    murmur: 'まずは、この地に立ち深呼吸をしておくれ…',
  },
  resolveIssue: {
    type: 'resolveIssue',
    kind: 'act',
    icon: '🛠️',
    label: '課題を解決',
    title: 'この地の課題を動かす',
    reward: 60,
    call: (p) => `${p}には積年の課題がある。そなたの手で、それを少しでも動かしてはくれぬか。`,
    murmur: 'のう、この地の課題を動かしてはくれぬか…',
  },
  judge: {
    type: 'judge',
    kind: 'understand',
    icon: '⚖️',
    label: '投稿をジャッジ',
    title: '集まった声を評する',
    reward: 35,
    call: (p) => `${p}に集まった皆の声を、そなたの目で評しておくれ。佳きものを見極めるのじゃ。`,
    murmur: 'そなたの目で、集まった声を評しておくれ…',
  },
  // ── 世界の値を動かす拡張タスク ──
  value_ask: {
    type: 'value_ask',
    kind: 'sense',
    icon: '💎',
    label: '価値を伝える',
    title: 'この場の価値を神に伝える',
    reward: 30,
    call: (p) => `${p}の、そなたが感じた「価値」——楽しみ方や魅力を、わしに教えておくれ。それがこの地の活気となる。`,
    murmur: 'のう、この場の価値を教えておくれ…',
  },
  issue_ask: {
    type: 'issue_ask',
    kind: 'sense',
    icon: '⚠️',
    label: '課題を伝える',
    title: 'この場の課題を神に伝える',
    reward: 30,
    call: (p) => `${p}で気になった「課題」——困りごとや改善すべき点を、わしに教えておくれ。解決の第一歩じゃ。`,
    murmur: 'のう、この場の課題を教えておくれ…',
  },
  bonnou_ask: {
    type: 'bonnou_ask',
    kind: 'sense',
    icon: '🌀',
    label: '煩悩を打ち明ける',
    title: '神に煩悩を打ち明ける',
    reward: 20,
    call: () => `そなたの心に巣食う「煩悩」——欲や執着を、正直に打ち明けてみよ。見つめることが浄化の始まりじゃ。`,
    murmur: 'そなたの煩悩を、打ち明けてみぬか…',
  },
  bonnou_resolve: {
    type: 'bonnou_resolve',
    kind: 'act',
    icon: '🕊️',
    label: '煩悩を手放す',
    title: '煩悩を一つ手放す',
    reward: 50,
    call: () => `打ち明けた煩悩の一つを、いまここで手放してみよ。どう乗り越えたか、わしに聞かせておくれ。`,
    murmur: 'のう、煩悩を一つ手放してみぬか…',
  },
  walk: {
    type: 'walk',
    kind: 'act',
    icon: '🚶',
    label: '散歩する',
    title: '散歩で心を整える',
    reward: 30,
    call: (p) => `${p}の周りを、ゆっくりと歩いてみよ。足を運ぶうちに、心の煩悩が一つ、すっと解けていくはずじゃ。`,
    murmur: 'のう、ゆるりと散歩して心を整えぬか…',
  },
  cleanup: {
    type: 'cleanup',
    kind: 'act',
    icon: '🧹',
    label: '掃除をする',
    title: 'この地を掃除して整える',
    reward: 40,
    call: (p) => `${p}を、その手で少し綺麗にしてはくれぬか。一掃きが、この地の活気を取り戻す。`,
    murmur: 'のう、この地を掃除して整えてはくれぬか…',
  },
  avatar_photo: {
    type: 'avatar_photo',
    kind: 'sense',
    icon: '🤳',
    label: 'アバターを撮る',
    title: '自らの姿を一枚撮る',
    reward: 20,
    call: (p) => `${p}を背に、そなた自身の姿を一枚撮っておくれ。それがそなたの巡礼者としての顔（アバター）になる。`,
    murmur: 'そなた自身の姿を、一枚撮ってみぬか…',
  },
  goshuin: {
    type: 'goshuin',
    kind: 'sense',
    icon: '🔴',
    label: '御朱印をもらう',
    title: '神から御朱印をもらう',
    reward: 10,
    call: (p) => `${p}に宿るわしのもとへ参り、言葉を交わして御朱印を受け取っておくれ。`,
    murmur: '御朱印を授けよう。わしのもとへ参られよ…',
  },
  // ── バリエーション拡張 ──
  weather: {
    type: 'weather', kind: 'sense', icon: '⛅', label: '天気を伝える', title: '今の天気・体感を伝える', reward: 15,
    call: (p) => `${p}の今の空はどうじゃ？　晴れか曇りか、暑さ寒さも添えて教えておくれ。`,
    murmur: 'のう、今の天気を教えておくれ…',
  },
  discover: {
    type: 'discover', kind: 'sense', icon: '🔎', label: '秘密を発見', title: '誰も気付かぬ秘密を見つける', reward: 35,
    call: (p) => `看板の裏、建物の隙間、足元の石…誰も気付かぬ${p}の秘密を一つ見つけて報せておくれ。それが新たな価値となる。`,
    murmur: 'のう、この地の隠れた秘密を見つけておくれ…',
  },
  wish: {
    type: 'wish', kind: 'sense', icon: '🎋', label: '願いを書く', title: '願いを書いて奉納する', reward: 20,
    call: (p) => `${p}の神前に、そなたの願いを一つ書いて奉納してみよ。心が澄むはずじゃ。`,
    murmur: 'のう、願いを書いてみぬか…',
  },
  gratitude: {
    type: 'gratitude', kind: 'sense', icon: '🙏', label: '感謝を捧げる', title: '神へ感謝を捧げる', reward: 15,
    call: (p) => `${p}に宿るわしへ、日々の恵みに感謝を捧げてはくれぬか。`,
    murmur: 'のう、感謝を捧げてみぬか…',
  },
  recommend: {
    type: 'recommend', kind: 'understand', icon: '👍', label: 'おすすめを選ぶ', title: '一番のおすすめを選ぶ', reward: 30,
    call: (p) => `${p}で集まった声の中から、そなたが一番と思うものを選んでおくれ。`,
    murmur: 'そなたの一番を、選んでおくれ…',
  },
  verify: {
    type: 'verify', kind: 'understand', icon: '🔍', label: '情報を確かめる', title: '集まった情報の正しさを確かめる', reward: 30,
    call: (p) => `${p}に集まった情報、その正しさをそなたの目で確かめておくれ。`,
    murmur: 'そなたの目で、情報を確かめておくれ…',
  },
  donate: {
    type: 'donate', kind: 'act', icon: '🪙', label: 'お賽銭を捧げる', title: 'お賽銭・寄進をする', reward: 35,
    call: (p) => `${p}の発展のため、心ばかりの寄進をしてはくれぬか。塵も積もれば山となる。`,
    murmur: 'のう、心ばかりの寄進を…',
  },
  guide: {
    type: 'guide', kind: 'act', icon: '🧭', label: '道案内をする', title: '他の巡礼者を案内する', reward: 35,
    call: (p) => `${p}を訪れた他の巡礼者に、道や見どころを案内してはくれぬか。`,
    murmur: 'のう、他の巡礼者を案内してはくれぬか…',
  },
  meditate: {
    type: 'meditate', kind: 'act', icon: '🧘', label: '瞑想する', title: '瞑想して心を鎮める', reward: 40,
    call: (p) => `${p}の静けさの中で、しばし目を閉じ瞑想してみよ。煩悩が一つ、静かに消えてゆく。`,
    murmur: 'のう、しばし瞑想してみぬか…',
  },
};

/** タスク種別 → どの神の機能を強化するか（TASK_CATALOG.kind と一致） */
export function kindOfType(type: TaskType): TaskKind {
  return TASK_CATALOG[type]?.kind ?? 'sense';
}

/**
 * クエストのステップを Task に具体化する。
 * type 省略時は、写真ミッションなら 'photo'、それ以外は 'visit'（来訪・観察）とみなす。
 * icon/label/reward/kind は TASK_CATALOG から補完する。
 */
export function questStep(s: {
  id: string;
  title: string;
  action?: string;
  triviaCategory?: TriviaCategory;
  trivia?: string;
  photo?: boolean;
  lat?: number;
  lng?: number;
  type?: TaskType;
  reward?: number;
}): Task {
  const type = s.type ?? (s.photo ? 'photo' : 'visit');
  const c = TASK_CATALOG[type];
  return {
    id: s.id,
    type,
    kind: c.kind,
    icon: c.icon,
    label: c.label,
    title: s.title,
    reward: s.reward ?? c.reward,
    action: s.action,
    trivia: s.trivia,
    triviaCategory: s.triviaCategory,
    photo: s.photo,
    lat: s.lat,
    lng: s.lng,
  };
}

/** 共通タスク種別（管理画面未設定時の既定。神は場所のコンテキスト収集を依頼する） */
export const COMMON_TASK_TYPES: TaskType[] = ['context', 'photo', 'evaluate', 'event', 'review', 'sns'];

/** 神の3機能（管理画面のグルーピング表示用） */
export const GOD_FUNCTIONS: { key: TaskKind; icon: string; label: string; desc: string; tasks: TaskType[] }[] = [
  { key: 'sense', icon: '👁️', label: '情報収集タスク', desc: '世界の値を調整するためのコンテキストを集める（価値・課題・煩悩・今の様子）', tasks: ['context', 'event', 'photo', 'cleaning', 'visit', 'weather', 'value_ask', 'issue_ask', 'discover', 'bonnou_ask', 'wish', 'gratitude', 'avatar_photo', 'goshuin'] },
  { key: 'understand', icon: '🧠', label: '理解判断タスク', desc: '集めた情報・投稿をジャッジし、価値と課題を読み解く', tasks: ['review', 'eat', 'evaluate', 'judge', 'recommend', 'verify'] },
  { key: 'act', icon: '✋', label: '操作タスク', desc: '世界の値を直接動かす（価値を広げ、課題・煩悩を解決する）', tasks: ['resolveIssue', 'cleanup', 'buy', 'sns', 'donate', 'guide', 'bonnou_resolve', 'walk', 'meditate'] },
];

/** タスクの対象（第2の分類軸）。場の活気を動かすか、人間の覚りを動かすか。 */
export type TaskTarget = 'spot' | 'human';
export const TASK_TARGET_META: Record<TaskTarget, { label: string; icon: string }> = {
  spot: { label: '場（活気）', icon: '📍' },
  human: { label: '人間（覚り）', icon: '🧑‍🦱' },
};
export const TASK_TARGET: Record<TaskType, TaskTarget> = {
  // 場の活気（価値・課題）に働く
  context: 'spot', photo: 'spot', evaluate: 'spot', event: 'spot', review: 'spot',
  sns: 'spot', buy: 'spot', eat: 'spot', cleaning: 'spot', visit: 'spot',
  resolveIssue: 'spot', judge: 'spot', value_ask: 'spot', issue_ask: 'spot', cleanup: 'spot',
  weather: 'spot', discover: 'spot', recommend: 'spot', verify: 'spot', donate: 'spot', guide: 'spot',
  // 人間の覚り（徳・煩悩）に働く
  bonnou_ask: 'human', bonnou_resolve: 'human', walk: 'human', avatar_photo: 'human', goshuin: 'human',
  wish: 'human', gratitude: 'human', meditate: 'human',
};

/** タスク種別ごとのテーマ色（Tailwind 用） */
export const TASK_TONE: Record<TaskType, { text: string; bg: string; border: string }> = {
  context: { text: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  photo: { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  evaluate: { text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  event: { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  review: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  sns: { text: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
  buy: { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  eat: { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  cleaning: { text: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
  visit: { text: 'text-lime-600', bg: 'bg-lime-50', border: 'border-lime-200' },
  resolveIssue: { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  judge: { text: 'text-fuchsia-600', bg: 'bg-fuchsia-50', border: 'border-fuchsia-200' },
  value_ask: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  issue_ask: { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  bonnou_ask: { text: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  bonnou_resolve: { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  walk: { text: 'text-lime-600', bg: 'bg-lime-50', border: 'border-lime-200' },
  cleanup: { text: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
  avatar_photo: { text: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200' },
  goshuin: { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  weather: { text: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
  discover: { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  wish: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  gratitude: { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  recommend: { text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  verify: { text: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  donate: { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  guide: { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  meditate: { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
};
