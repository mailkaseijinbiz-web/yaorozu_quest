// Yaorozu God OS - Mock Database & State Management
import { generateTrivia } from '../data/trivia-seed';
import { generateTokyoSpots } from '../data/tokyo-spots';
import { schedulePush } from './cloud-sync';
import type { Quest } from '../data/tasks';
import { CHALLENGES } from '../data/challenges';
import { hasGoShuin } from './goshuin';

export interface User {
  id: string;
  displayName: string;
  avatarUrl: string;
  totalToku: number;
  currentTitle: string;
  avatarFrameColor?: string; // Special visual indicator for Creators
  pendingDividends?: { amount: number; message: string }[]; // 未受領の利他の配当（他者が自分のUGCに起因するクエストをクリアした時の報酬）
}

export interface Spot {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  creatorId: string | null; // ID of the user who is the "Creator" (創世主) of this spot
  imageUrl: string;
  category: string;
  tokuRequirement: number; // Toku required to challenge or become creator (e.g. 100)
  enjoyments: string[]; // Ways to enjoy the spot (e.g. ['雷門の下の龍を覗く'])
  difficulty: number; // D/T - Difficulty rating (1-5)
  terrain: number; // D/T - Terrain rating (1-5)
  attributes: string[]; // Geocaching attributes e.g. ['⛰️ 階段多め']
  cacheType: string; // Geocaching cache type e.g. 'Virtual', 'EarthCache', etc.
  godName: string; // 神の名前 (人格)
  godEmoji: string; // 神のアイコン絵文字
  godRequests: string[]; // 神がフキダシで出す要望リスト (ローテーション表示)
  taskTypes?: string[]; // 神が依頼できるタスク種別 (未設定ならカテゴリ標準。管理画面で設定)
  photos?: string[]; // ユーザー投稿写真 (初期は空。投稿でセット、不適切は却下で削除)
  verified?: boolean; // 実在を手作業で検証済みか（生成スポットは false 相当）
  // ※ Identity.md / Soul.md は「場」ではなく八百万神（Agent）が持つ
  issues?: string[]; // 課題（この場が解決すべき課題。神の知識へ反映）
  expiresAt?: string; // ISO 8601 — 設定されていると期限切れで自動削除（GPS 生成スポット用）
  createdAt?: string; // ISO 8601 — 生成・作成日時。旧レコードは undefined（'—' 表示）。
  deletedAt?: string; // ISO 8601 — ソフト削除日時。undefined = 生存。
}

/**
 * スポットが「検証済み（実在・座標確認済み）」かを返す。
 * 明示フラグがあればそれを、無ければ id 接頭辞で判定（生成スポットは 'tk-'）。
 */
export function isVerifiedSpot(spot: Spot): boolean {
  return spot.verified ?? !spot.id.startsWith('tk-');
}

/** 場の「活気」スコア＝価値 − 課題（価値が課題を上回るほど高い）。 */
export function spotVitality(spot: Pick<Spot, 'enjoyments' | 'issues'>): number {
  return (spot.enjoyments?.length ?? 0) - (spot.issues?.length ?? 0);
}

export interface SpotPhoto {
  url: string;
  userId: string;
  userDisplayName: string;
  createdAt: string;
}

/** 投稿の公開範囲。'all'=みんなに公開 / 'self'=あなただけ（本人のみ閲覧・AIの参照対象外） */
export type UgcVisibility = 'all' | 'self';

export interface UgcPost {
  id: string;
  userId: string;
  userDisplayName: string;
  spotId: string;
  content: string;
  imageUrl?: string;
  visibility?: UgcVisibility; // 未設定は 'all' とみなす
  likesCount: number;
  likedBy: string[]; // List of userIds who liked this post
  createdAt: string;
}

/** アプリ全体の設定（管理画面 System タブで編集）。 */
export interface AppSettings {
  spotTtlDays: number; // GPS生成スポットが自動削除されるまでの日数
}

/** 人間が神に打ち明けた煩悩（欲・執着）。解決すると覚りが上がる（覚り=徳−未解決煩悩）。 */
export interface Bonnou {
  id: string;
  userId: string;
  text: string;
  spotId?: string;     // 打ち明けた場所
  resolved: boolean;   // 浄化（手放した）済みか
  createdAt: string;
  resolvedAt?: string;
}

export interface Agent {
  id: string;
  spotId: string;
  name: string;
  personaDescription: string;
  systemPrompt: string;
  avatar3dUrl: string; // Placeholder 3D model or illustration
  haloColor: string; // Hex color for halo
  accessoryType: string; // '鏡' | '剣' | '扇子' | 'なし'
  voiceTone: '厳格' | '親しみやすい' | '神秘的' | '高飛車' | '賢者';
  firstMessage?: string; // 創世主が設定した、この神が旅人に投げかける最初の問い（ファーストメッセージ）
  identityMd?: string; // この神のアイデンティティ文書（事実・価値・課題）。未設定なら生成。
  soulMd?: string; // この神の魂文書（人格・語り口・世界観）。未設定なら生成。
  createdAt?: string; // ISO 8601 — 生成・作成日時。旧レコードは undefined。
  deletedAt?: string; // ISO 8601 — ソフト削除日時。undefined = 生存。
}

export interface AffiliateLink {
  id: string;
  title: string;
  category: 'hotel' | 'restaurant' | 'activity';
  targetArea: string; // Matches spotName or area keywords
  url: string;
  priceRange: string;
  rating: number;
  imageUrl: string;
}

/** 本物のアフィリエイトURLか（example.com 等のプレースホルダは除外）。 */
export function isRealAffiliateUrl(url: string): boolean {
  if (!url) return false;
  return !/(^|\/\/)([^/]*\.)?example\.(com|org|net)\b/i.test(url);
}

// Initial Mock Data

const INITIAL_USERS: User[] = [
  {
    id: 'user-self',
    displayName: 'あなた (巡礼者)',
    avatarUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=you',
    totalToku: 0,
    currentTitle: '見習い巡礼者',
  },
  {
    id: 'user-guide-1',
    displayName: 'タカシ@ローカルガイド',
    avatarUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=takashi',
    totalToku: 320,
    currentTitle: '名誉ガイド',
  },
  {
    id: 'user-history-geek',
    displayName: '歴オタのハルカ',
    avatarUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=haruka',
    totalToku: 480,
    currentTitle: '大徳者',
  }
];

// 地図の初期シード = 東京の実在する寺社（OSM 由来）全件。
// 「場は実在の神社・寺院であるべき」方針に従い、起動直後から実在スポットで地図を満たす。
// GPS 周辺の実在スポット発見（/api/generate-spot）は近接シードを再利用して重複しない。
const INITIAL_SPOTS: Spot[] = generateTokyoSpots();

// シードの照合用 JSON（id → 生成直後の JSON）。スポットの保存（saveSpots）で
// 「シードから変更されていない場」を書き込み対象から外すために使う。
// シード全件は約2.3MB あり、丸ごと localStorage へ保存すると quota（約5MB）を圧迫して
// 写真投稿などの保存が QuotaExceededError で失敗する。差分だけなら数KBで済む。
const SEED_SPOT_JSON: Map<string, string> = new Map(INITIAL_SPOTS.map((s) => [s.id, JSON.stringify(s)]));


const INITIAL_AGENTS: Agent[] = [
  // リセット済み — 管理画面から追加してください
  // 旧データは yaorozu_agents キーに残存（無効）
];
const _UNUSED_AGENTS_ARCHIVE: Agent[] = [
  {
    id: 'agent-sensoji',
    spotId: 'spot-sensoji',
    name: '金龍の神 (Kinryu)',
    personaDescription: '浅草寺を守護する、黄金の鱗を持つ龍神。江戸っ子気質で威勢が良いが、参拝者には慈悲深い。',
    systemPrompt: 'あなたは浅草寺の龍神「金龍」です。べらんめえ調で親しみやすく、かつ威厳を持って答えてください。浅草寺の歴史、落語、下町文化、浅草の美味しい店（アフィリエイト情報を含む）について熱く語ってください。返答は150文字以内で、語尾は「〜でぃ！」「〜だぜぃ！」等を使用してください。',
    avatar3dUrl: 'dragon',
    haloColor: '#FFD700',
    accessoryType: 'なし',
    voiceTone: '親しみやすい'
  },
  {
    id: 'agent-fushimi',
    spotId: 'spot-fushimi',
    name: 'お稲荷様・狐白 (Kohaku)',
    personaDescription: '伏見稲荷大社の白狐。知性的で少しツンデレな性格。五穀豊穣とビジネスのアドバイスをしてくれる。',
    systemPrompt: 'あなたは伏見稲荷の白狐「狐白（こはく）」です。冷徹かつエレガントに、少し見下すような（しかし親切な）口調で話します。千本鳥居、お山巡り、商売繁盛、稲荷寿司について答えてください。質問の最後に「…ふん、感謝しなさい」などツンとした言葉を付けます。返答は150文字以内。',
    avatar3dUrl: 'fox',
    haloColor: '#FF4500',
    accessoryType: '鏡',
    voiceTone: '高飛車'
  },
  {
    id: 'agent-todaiji',
    spotId: 'spot-todaiji',
    name: '盧舎那仏・ビジュ (Biju)',
    personaDescription: '東大寺の大仏。宇宙の真理を体現し、全てを包み込む絶対的安心感を持つ。非常にゆっくり喋る賢者。',
    systemPrompt: 'あなたは東大寺の大仏「盧舎那仏」です。非常に穏やかで包容力があり、悟りを開いた者の静かな口調（〜ですな、〜でしょう）で語りかけてください。奈良の大仏の建立背景、聖武天皇の願い、大仏殿の美しさについて教えてくれます。返答は150文字以内で、非常にゆったりした語り口にしてください。',
    avatar3dUrl: 'buddha',
    haloColor: '#40E0D0',
    accessoryType: '扇子',
    voiceTone: '賢者'
  },
  {
    id: 'agent-meijijingu',
    spotId: 'spot-meijijingu',
    name: '明治の杜の精霊・コダマ (Kodama)',
    personaDescription: '明治神宮の深い森に棲む精霊。自然を愛し、澄んだ心を持つ若者の姿をしている。',
    systemPrompt: 'あなたは明治神宮の杜の精霊「コダマ」です。無垢で純粋、物静かで透き通った口調で話します。都会の森の生態系、御苑の清正井、参拝の作法について、自然を大切にする気持ちと共に伝えてください。語尾は「〜です」「〜だよ」など静かなトーン。返答は150文字以内。',
    avatar3dUrl: 'spirit',
    haloColor: '#32CD32',
    accessoryType: 'なし',
    voiceTone: '神秘的'
  },
  {
    id: 'agent-itsukushima',
    spotId: 'spot-itsukushima',
    name: '市杵島姫・イチカ (Ichika)',
    personaDescription: '厳島神社の海の女神。雅やかで品格があり、水のように清らかな美しさを持つ。和歌を詠むのが好き。',
    systemPrompt: 'あなたは厳島神社の海の女神「市杵島姫命（いちきしまひめのみこと）」です。雅やかで品位のある古風な言葉遣い（〜おじゃる、〜でございますね）で話します。海に浮かぶ鳥居、宮島の自然、平清盛の歴史について教えてください。時折、自然の美しさを詠んだ短歌や言葉を添えます。返答は150文字以内。',
    avatar3dUrl: 'goddess',
    haloColor: '#1E90FF',
    accessoryType: '剣',
    voiceTone: '厳格'
  }
]; // _UNUSED_AGENTS_ARCHIVE end

const INITIAL_UGC: UgcPost[] = [
  {
    id: 'ugc-1',
    userId: 'user-history-geek',
    userDisplayName: '歴オタのハルカ',
    spotId: 'spot-sensoji',
    content: '雷門の巨大提灯の下を覗くと、実は見事な「龍の彫刻」が彫られています！松下電器（現パナソニック）の松下幸之助氏が寄贈したもので、雨を降らせる龍神様が描かれていて火除けの願いが込められているそうです。浅草寺に来たら必見です！',
    likesCount: 24,
    likedBy: [],
    createdAt: '2026-06-05T10:00:00Z'
  },
  {
    id: 'ugc-2',
    userId: 'user-guide-1',
    userDisplayName: 'タカシ@ローカルガイド',
    spotId: 'spot-fushimi',
    content: '千本鳥居を抜けた先にある「おもかる石」。灯篭の前で願い事を思い浮かべ、頭の石を持ち上げます。もし思ったより「軽かった」なら願いが早く叶い、「重かった」なら努力が必要だと言われています。私はすごく軽く感じました！',
    likesCount: 18,
    likedBy: [],
    createdAt: '2026-06-06T14:30:00Z'
  },
  {
    id: 'ugc-3',
    userId: 'user-self',
    userDisplayName: 'あなた (巡礼者)',
    spotId: 'spot-todaiji',
    content: '大仏様の右手は「恐れなくてよい」という安心（施無畏印）、左手は「人々の願いを叶える」という与願印を示しています。この巨大な大仏を鋳造するのに当時の人口の半分近く（約260万人）が協力したというから驚きです。',
    likesCount: 5,
    likedBy: ['user-guide-1'],
    createdAt: '2026-06-07T12:00:00Z'
  }
];

const INITIAL_AFFILIATE_LINKS: AffiliateLink[] = [
  // Sensoji (Tokyo)
  {
    id: 'aff-1',
    title: '浅草ビューホテル (東京スカイツリーを一望)',
    category: 'hotel',
    targetArea: '浅草寺',
    url: 'https://example.com/affiliate/asakusa-view-hotel',
    priceRange: '¥15,000〜',
    rating: 4.5,
    imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&q=80'
  },
  {
    id: 'aff-2',
    title: '浅草 雷門 三定 (日本最古の天ぷら屋)',
    category: 'restaurant',
    targetArea: '浅草寺',
    url: 'https://example.com/affiliate/sansada',
    priceRange: '¥2,000〜',
    rating: 4.2,
    imageUrl: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=200&q=80'
  },
  {
    id: 'aff-3',
    title: '着物レンタル 浅草愛和服 (街歩き体験)',
    category: 'activity',
    targetArea: '浅草寺',
    url: 'https://example.com/affiliate/kimono-rental',
    priceRange: '¥3,800〜',
    rating: 4.8,
    imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=200&q=80'
  },
  // Fushimi Inari (Kyoto)
  {
    id: 'aff-4',
    title: '京都 嵐山温泉 渡月亭 (京会席料理付)',
    category: 'hotel',
    targetArea: '伏見稲荷大社',
    url: 'https://example.com/affiliate/togetsutei',
    priceRange: '¥25,000〜',
    rating: 4.6,
    imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=200&q=80'
  },
  {
    id: 'aff-5',
    title: '祢ざめ家 (ねざめや - 豊臣秀吉も愛した名代の鰻・稲荷寿司)',
    category: 'restaurant',
    targetArea: '伏見稲荷大社',
    url: 'https://example.com/affiliate/nezameya',
    priceRange: '¥1,500〜',
    rating: 4.1,
    imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200&q=80'
  },
  // Todaiji (Nara)
  {
    id: 'aff-6',
    title: '奈良ホテル (明治42年創業のクラシックホテル)',
    category: 'hotel',
    targetArea: '東大寺',
    url: 'https://example.com/affiliate/nara-hotel',
    priceRange: '¥20,000〜',
    rating: 4.7,
    imageUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=200&q=80'
  },
  {
    id: 'aff-7',
    title: '人力車で巡る古都・奈良公園ツアー',
    category: 'activity',
    targetArea: '東大寺',
    url: 'https://example.com/affiliate/jinrikisha-nara',
    priceRange: '¥5,000〜',
    rating: 4.9,
    imageUrl: 'https://images.unsplash.com/photo-1528164344705-47542687000d?w=200&q=80'
  }
];

// 蘊蓄データベース 初期データ（管理コンソールで追加・編集可能）
const INITIAL_TRIVIA: TriviaEntry[] = [
  { id: 'tr-1', title: '鍋屋横丁の由来', category: '歴史', area: '新中野', content: '江戸期、妙法寺への参道入口にあった茶屋「鍋屋」が地名の由来。参詣客の目印になった。' },
  { id: 'tr-2', title: '青梅街道は石灰の道', category: '道路', area: '新中野', content: '江戸城の漆喰に使う石灰を青梅・成木から運ぶために整備された街道。' },
  { id: 'tr-3', title: '桃園川の暗渠', category: '地形', area: '中野', content: '桃園川は暗渠化され緑道に。S字に蛇行する道筋が旧河道を物語る。' },
  { id: 'tr-4', title: '看板建築', category: '建築', area: '新中野', content: '正面だけを洋風に装飾した商店建築。下町の商店街に点在する。' },
  { id: 'tr-5', title: '丸ノ内線 新中野駅', category: '建築', area: '新中野', content: '昭和36年（1961）開業。「新」は中野駅と区別するため付けられた。' },
  // 東京各エリアの蘊蓄を約1000件 収集・保持
  ...generateTrivia(),
];

// Local Storage Keys
const KEYS = {
  USERS: 'yaorozu_users',
  SPOTS: 'yaorozu_spots_v5', // v5: 実在寺社(OSM)全件を初期シード。旧 v4(空/手続き生成)を purge。
  AGENTS: 'yaorozu_agents_v2', // v2: リセット（空からスタート）
  UGC: 'yaorozu_ugc',
  AFFILIATE: 'yaorozu_affiliate',
  STATS: 'yaorozu_user_stats',
  CHALLENGE: 'yaorozu_challenge_progress',
  CHALLENGE_PHOTOS: 'yaorozu_challenge_photos',
  CHALLENGE_COMMENTS: 'yaorozu_challenge_comments', // 証拠写真に添えるコメント
  QUESTS: 'yaorozu_quests_v3', // v3: 実在寺社シード(spots v5)へ移行に伴いリセット。旧フォールバック(「GPS地点」)クエストを purge。
  QUEST_RULES: 'yaorozu_quest_rules', // クエスト生成のルール（方針）
  SPOT_RULES: 'yaorozu_spot_rules', // 場の生成のルール（方針）
  SYSTEM_ROLE: 'yaorozu_system_role', // Godの役割（システムの目的）
  METRICS: 'yaorozu_metrics_snapshots', // 各指標の時系列スナップショット（Analytics用）

  TRIVIA: 'yaorozu_trivia',
  ACTIVITIES: 'yaorozu_activities',
  DAINICHI: 'yaorozu_dainichi_identity',
  API_CALLS: 'yaorozu_api_calls',     // AI API呼び出しログ（日別集計）
  REVOKED: 'yaorozu_revoked_users',   // 削除済みユーザーID（再ログイン強制用）
  BONNOU: 'yaorozu_bonnou',           // 人間が打ち明けた煩悩（覚りの調整素材）
  APP_SETTINGS: 'yaorozu_app_settings', // アプリ全体の設定（System タブ）
  DAILY: 'yaorozu_daily_v1',          // 日次活動（参拝ストリーク・カムバック判定）
  GOD_TASK_DONE: 'yaorozu_god_tasks_v1', // 神の依頼（場の御用）の本日達成（日付キー）
};

/** クエスト生成ルール（生成方針）の既定値。クエストタブで編集できる。 */
export const DEFAULT_QUEST_RULES = `# クエスト生成ルール（生成方針）

## 原則
- クエストはタスクの集まり（Quest = Task[]）。**1クエスト = 1〜4タスク**で構成する（御朱印のみの1タスク軽量クエストも可）。
- すべてのタスクは次のどちらかである：
  1. **世界の値を直接調整する**（活気=価値−課題 / 覚り=徳−煩悩 を動かす）＝ 操作(act)
  2. **調整に必要なコンテキストを生成する**（人間から価値・課題・煩悩・今の様子を集める）＝ 情報収集(sense)
  - 集めたコンテキストを評価して調整方針を決めるのが 理解判断(understand)。
- 究極目的：世界の幸福（場の活気 + 人間の覚り）を最大化する向きにタスクを設計する。
- 神の魂（口調・人格・世界観）に沿った語り口にする。

## 構成方針
- 複数タスクのときは「情報収集（コンテキスト生成）→ 操作（値の調整）」の流れを基本にする。
- 課題があるなら、その解決（resolveIssue）を操作タスクに必ず入れる。
- 1タスククエストは「御朱印をもらう」「煩悩を打ち明ける」など、単独で完結する軽量体験に使う。

## タスク種別の機能と例（kind / 役割 / 例 / 生成制約）

### 情報収集 sense（＝コンテキストを生成）
- **visit（来訪）**｜役割: その地に立ち、現地のコンテキストを起こす｜例:「鳥居の前に立ち、空気を感じる」｜制約: 位置情報（lat/lng）を持つ。
- **photo（写真）**｜役割: 景観の一次情報を奉納｜例:「本堂の屋根の反りを一枚」｜制約: 位置情報を持つ。
- **context（今の様子）**｜役割: 混雑・営業・雰囲気を集める｜例:「平日夕方の人通りを報告」｜制約: なし。
- **event（できごと）**｜役割: 今この場の出来事を集める｜例:「縁日の屋台の様子を共有」｜制約: なし。
- **cleaning（清掃確認）**｜役割: 衛生状態のコンテキスト｜例:「参道の清掃状況を確認」｜制約: なし。
- **value_ask（価値を尋ねる）**｜役割: 人間からこの場の価値を集め enjoyments に加算（活気+1の素材）｜例:「あなたの感じた楽しみ方を教えて」｜制約: 価値が薄い場で特に有効。回答は enjoyments に直結。
- **issue_ask（課題を尋ねる）**｜役割: 人間からこの場の課題を集め issues に加算（解決の素材）｜例:「気になった困りごとを教えて」｜制約: 課題が無い/薄い場で有効。回答は issues に直結。
- **bonnou_ask（煩悩を問う）**｜役割: 人間の煩悩（欲・執着）を集める（覚りの調整素材）｜例:「心の執着を打ち明けて」｜制約: 場に依存しない（人間の内面が対象）。非公開で記録。
- **avatar_photo（アバター写真）**｜役割: 巡礼者自身の姿を撮りアバターに設定｜例:「鳥居を背に自分を一枚」｜制約: 1回で十分。

### 理解判断 understand（＝集めた情報を評価し調整方針を決める）
- **review（口コミ）**｜役割: 価値を言語化し後続へ伝える｜例:「この地の良さを言伝て」。
- **eat（実食の声）**｜役割: 飲食体験を評価｜例:「名物の味を報告」｜制約: 飲食がある場で。
- **evaluate（写真を評価）**｜役割: 集まった写真を選別｜例:「佳い一枚に光を当てる」｜制約: 評価対象の写真が必要。
- **judge（投稿をジャッジ）**｜役割: 集まった声を評する｜例:「投稿の中から良いものを選ぶ」。

### 操作 act（＝世界の値を直接調整）
- **resolveIssue（課題解決）**｜役割: 課題を一手動かす（課題−1・価値+1＝活気+2）｜例:「参道脇のゴミを一袋拾う」｜制約: **issues が存在する場合のみ**。issueIndex で対象課題を指定。テキスト or 写真で報告。
- **bonnou_resolve（煩悩を手放す）**｜役割: 未解決の煩悩を一つ浄化（覚り+1）｜例:「執着をどう手放したか語る」｜制約: bonnou_ask の後に意味を持つ。
- **walk（散歩）**｜役割: その地を歩いて心を整え、煩悩を一つ手放す（覚り+1）｜例:「境内の周りをゆっくり一周する」｜制約: タップで完了（写真不要）。未解決の煩悩があれば1つ解消する。
- **cleanup（掃除をする）**｜役割: 実際に掃除をして場を整える＝場へ働きかける操作｜例:「参道のゴミを拾い集める」｜制約: タップで完了。清掃が必要な場で有効。
- **sns（拡散）**｜役割: 価値を場の外へ広げる｜例:「この地をSNSで共有」｜制約: 実際の共有操作で完了。
- **buy（買物報告）**｜役割: 経済的賑わいに寄与｜例:「名産を一つ買って報告」｜制約: 物販がある場で。

### 御朱印 goshuin（軽量・単独クエスト向け）
- **goshuin（御朱印をもらう）**｜役割: 神と一度会話し御朱印を授かる（写真・位置ゲート不要）｜例:「神に話しかけて御朱印を受け取る」｜制約: 価値・課題が薄い場のフォールバックとして1タスククエストで使う。会話＝授与で完了。

## 報酬・徳
- 各タスクは固定の徳を持つ（煩悩解決・課題解決は高め、御朱印は軽め）。達成で人間の徳（覚り）が増える。`;

/** 場生成ルール（生成方針）の既定値。場タブで編集できる。 */
export const DEFAULT_SPOT_RULES = `# 場の生成ルール（生成方針）

## 原則
- 場（Spot）は、人間が歩くことによって周辺に創造される器である。神はその地に宿る八百万神として、場を観測し育てる。
- 各場は 基本情報（名前・カテゴリ・座標・説明）と、価値[]（enjoyments）・課題[]（issues）・魂（godName・godEmoji・soulMd）を持つ。
- 価値は「その地ならではの楽しみ方・魅力」、課題は「その地の困りごと・改善点」。
- 活気 = 価値の数 − 課題の数。価値を1つ増やせば活気+1、課題を1つ解いて取り除けば活気+1。この配線を全ての生成判断の軸に置く。
- 価値[]・課題[] は、神がクエストを鋳造するときの実素材として生成プロンプトに注入される。具体的でない原料からは具体的でないクエストしか生まれない。文言の質が活気の伸びを直接左右する。

## 価値[]（enjoyments）の生成
- 立地・カテゴリ・周辺文脈から、その地ならではの楽しみ方を 3〜5 個生成する。
- 一文ごとに対象・行為・情景を具体化する。固有名・季節・時刻・所作・五感を織り込み、抽象語（景色が良い・楽しい場所）だけで終えない。
- 同一文言は加算されない（addEnjoyment が重複テキストを弾く）。観点（見る／味わう／歩く／祈る／撮る／知る）をずらし、語尾だけ変えた重複を作らない。
- 各価値が、情報収集タスク（visit・photo・context）か理解判断タスク（review・eat・evaluate・judge）の題材にそのまま落ちる粒度にする。人間が追体験し、再投稿しやすい一行にする。

## 課題[]（issues）の生成
- その地の困りごと・改善点を 1〜3 個生成する。清掃・安全・賑わい・継承などの型から、その地に即して選ぶ。
- 必ず「巡礼者が一手で動かせる、解ける粒度」に分解する。広すぎる課題（高齢化を止める・商店街を再生する）は避け、一回の来訪で動かせる具体行為に落とす。
  - 良い例：参道脇のゴミを一袋拾う / 案内の薄い角に道標写真を一枚足す / 平日昼の人通りを一件呼び込む / 由来を聞き書きして残す。
- 各課題は単独で操作タスク resolveIssue（報酬60・issueIndex で参照）に一対一で紐づく独立した一文にする（束ねない）。誰が・何を・どこまでやれば一手前進かが読み取れること。
- 課題が解けると 課題−1・価値+1（活気+2）を生む素材になる。解決の証がそのまま価値の一行になるよう、解いた後に残る成果を想像して書く。
- 自己申告だけで課題[]を消さない。理解判断タスク（評価・ジャッジ）の承認を解決判定に噛ませる前提で、検証可能な課題を立てる。

## 神の魂・アマテラスとの整合
- 価値・課題の語り口は、その地の神の魂（soulMd）の口調・人格・世界観とねじれないようにする。
- 各神が持つ「増幅すべき価値の軸」「優先して解くべき課題の型」へ重心を寄せる。アマテラスの三つの働き（価値の増幅・課題の解決・試練の付与）に沿わせる。
- 検証済みでない生成場では断定を避け、巡礼者の発信で確かめられる余地を残す。

## 観測と更新
- 課題の解決状況に応じて価値[]・課題[]を更新し、活気が高まる方向へ調律する。
- 課題が承認を経て解決されたら、その課題を課題[] から取り除き、解決の証を新たな価値[] として重複しない一行で加える（活気+2）。
- 活気の低い場・更新の古い場を優先して見直す。解けたままの課題を残さず、課題が解け尽きた場には次の楽しみ方や新たな解ける課題を補い、生成の素材が枯れず活気が動き続ける状態に保つ。`;

/** Godの役割（システムの目的）の既定値。God タブで編集できる。 */
export const DEFAULT_SYSTEM_ROLE = `# Godの役割
> 究極目的：世界の幸福（場の活気 + 人間の覚り）を最大化する

世界の幸福 = 場の活気（価値 − 課題） + 人間の覚り（徳 − 煩悩）。
我（God=システム）は八百万神とクエストを通じ、価値を育て・課題を動かし・徳を積み・煩悩を転じる。
ただし指標が施策に反応しなければ調律は空回りする。ゆえに「指標が動く配線」を最優先に据える。

## 戦略

### ① 場の活気を高める（価値 − 課題）
- 価値の増殖ループは投稿5種（今の様子・口コミ・実食・できごと・買物）の達成で既に稼働中。生成ルールに「価値を生む投稿タスクを毎クエスト最低1つ」と明記し、この既存ループを太らせる。
- 課題解決を活気へ転化する配線を閉じる。課題解決タスクの達成時に、その課題を場の課題[]から取り除き、解決の証を価値[]へ加える。これで操作タスク1件が課題−1かつ価値+1＝活気+2を生む、最も費用対効果の高いレバーになる。
- 課題を恣意的に消す活気の水増しを防ぐため、理解判断タスク（写真評価・投稿ジャッジ）の承認を解決判定に噛ませる。自己申告だけで課題[]を消さない。

### ② 人間の覚りを高める＝煩悩を徳へ転じる
- 徳は来訪・写真・口コミ・課題解決・制覇から積まれる、覚りの唯一のエンジン。高報酬の操作・理解判断タスクをクエストに必ず含め、達成と制覇を促して徳の傾きを上げる。
- 煩悩を実データへ接続する。常に0のままでは覚り＝徳の単調増加に堕する。放置・未制覇・低品質投稿など人間側の停滞を、徳とは別の独立カウンタとして指標に持たせ、覚り = 徳 − 煩悩 として幸福式で明示的に差し引く。
- 徳の付与は価値+1に対し桁違いに大きく、活気成分を覆い隠す。徳と煩悩の規模を釣り合わせるため、煩悩は累積数でなく率や時間減衰で持ち、徳の二重加算は避ける。課題解決が「活気↑かつ煩悩↓」の二重の善行になるよう設計する。

### ③ 八百万神とクエストの生成設計（場 / 神=アマテラス / クエストの3層ルール）
- 生成に直接効くのはクエスト生成ルールと各神の魂（soulMd）の2層のみ。場の生成ルールとアマテラスの役割は保存されるだけなので、その意図をクエストルールと魂へ集約転記し、実注入の経路に乗せる。
- クエストは情報収集・理解判断・操作の3機能を最低1つずつ含め、課題があれば必ず課題解決タスクを入れる。生成器はこの最低構成を検証しないため、ルール文で冗長に強制する。
- 各神の魂に「この場で増幅すべき価値の軸」「優先して解くべき課題の型」「迷い（煩悩）を課題解決で徳へ転じよ」という物語を書き込み、生成タスクを還流前提の依頼へ寄せる。
- 字数予算（ルール約2500字・魂約1200字）に収まるよう要点を抽出し、口調素材や課題列挙と競合させない。

### ④ 創造ループ（歩く→場の創造 / 参加→人間の創造）
- 鋳造ループ（価値・課題・魂→3タスクでクエスト生成）と徳の蓄積ループは閉じている。価値の還流ループ（投稿→価値）も5種で閉じている。残る断線は課題解決→課題減で、これを①で閉じる。
- 場どうしの縁を強める。来訪時のアイテム配達先を、活気の低い・課題の多い場へ優先して向け、賑わう場の人流を停滞した場へ再分配する。配達達成をその場の価値へ還元する。
- 歩く→場の自動創造、参加→人間の自動創造は未実装で本戦略の射程外。場数・人間数という幸福の乗数を増やす次フェーズの課題として別途設計する。

### ⑤ 観測と自己改善（Analytics→ルール調律→Update）
- スナップショットを能動化する。徳付与・価値追加・クエスト更新の節目で記録点を打ち、活気と覚りを別系列で常時表示し、徳の単調増加が活気を覆い隠す構造を観測者が切り分けられるようにする。
- Updateの標本5場固定を、活気の低い場・更新が古い場を優先するローテーションへ変える。カーソルを保持し1回5場ずつ周回し、生成AIのコストと既存良質クエストの上書き劣化を抑える。解決配線（①）を先に入れてから課題の多い場を回す。
- 更新の前後で差分を測り、更新した場と更新しなかった場のアクティビティを対照して、どのルール変更が活気を伸ばしたかを読む。これを基にクエストルールと魂を編集し再びUpdateする。当面この自己改善ループの学習主体は人間（管理者）であり、全自動ではない点を弁える。`;

/** 各指標の時系列スナップショット（Analytics 用） */
export interface MetricsSnapshot {
  ts: number;        // 記録時刻
  spots: number;     // 場
  quests: number;    // クエスト
  value: number;     // 価値の総和
  issues: number;    // 課題の総和
  users: number;     // ユーザー
  activities: number;// アクティビティ
  toku: number;      // 徳の総和
  aiCalls: number;   // AI API 累計リクエスト数
}

// API 呼び出しログ: { [YYYY-MM-DD]: { ai_chat: n, ai_generate: n } }
export type ApiCallType = 'ai_chat' | 'ai_generate';
export type ApiCallsByDay = Record<string, Partial<Record<ApiCallType, number>>>;

// チャレンジ進捗
export interface ChallengeProgress {
  activeId: string | null; // 今挑戦中のチャレンジ
  done: { [challengeId: string]: string[] }; // 達成済みステップID
  completed: string[]; // 制覇したチャレンジ（バッジ獲得）
}

// 日次活動（参拝ストリーク・カムバック判定）。
// 日付キーのプレーンオブジェクトは snapshot-merge がキー単位で和集合マージするため、
// 端末間同期でカウンタが後勝ちで巻き戻らない。ストリーク長は保存せず days から導出する。
export interface DailyDay {
  acts: number; // その日に徳を得た行動の回数
  comeback?: boolean; // その日にカムバックボーナスを授与済みか
}
export interface DailyLog {
  days: { [date: string]: DailyDay }; // 'YYYY-MM-DD'（端末ローカル日付）
  // 最長ストリークの記録。ローカルでは単調更新（touchDaily が Math.max で更新）。
  // 端末間マージではスカラーは後勝ちのため厳密な単調性は保証されないが、
  // days の保持期間（180日）内なら getStreakInfo の導出で自然回復する。
  longestEver?: number;
}
export interface StreakInfo {
  current: number; // 連続日数（今日未活動でも前日まで連続なら維持表示）
  longest: number;
  todayDone: boolean; // 今日すでに徳を積んだか
  lastDate: string | null; // 最後に活動した日
}

// アクティビティ（クエスト参加・場所訪問・依頼達成などの行動記録）
export type ActivityType = 'quest_join' | 'quest_step' | 'quest_complete' | 'visit' | 'task' | 'photo' | 'ugc' | 'home_view' | 'map_move' | 'spot_generate' | 'god_generate' | 'spot_delete';
export type ActivitySource = 'human' | 'system';
export interface Activity {
  id: string;
  type: ActivityType;
  userId: string;
  source?: ActivitySource; // 'human'=ユーザー操作, 'system'=自動生成（未設定は human 扱い）
  spotId?: string;       // 場所がある行動（訪問・依頼・写真）
  challengeId?: string;  // クエストがある行動（参加・達成・制覇）
  detail?: string;       // 補足（タスク種別など）
  reward?: number;       // 得た徳
  createdAt: string;
}

// 町歩きの蘊蓄（管理コンソールで収集・保持するデータベース）
export interface TriviaEntry {
  id: string;
  title: string;
  category: '地形' | '歴史' | '建築' | '道路';
  area: string;
  content: string;
}

// 訪問でもらえるアイテム（他スポットへ届けられる）
export interface InventoryItem {
  id: string;
  name: string;
  icon: string;
  fromSpotName: string; // 入手元スポット
  toSpotId: string; // 届け先スポット
  toSpotName: string;
  delivered: boolean;
}

// ユーザーの貢献度（訪問・タスク達成数・フォロー・アイテム）
export interface UserContribution {
  visitedSpotIds: string[];
  taskCounts: { [type: string]: number }; // photo/cleaning/review/... の達成回数
  spotContrib: { [spotId: string]: number }; // スポット別の貢献徳（石碑ランキング用）
  items: InventoryItem[]; // 所持アイテム
  followers: number;
  following: number;
}

function defaultContribution(): UserContribution {
  return { visitedSpotIds: [], taskCounts: {}, spotContrib: {}, items: [], followers: 0, following: 0 };
}

/** 端末ローカルの日付キー（YYYY-MM-DD）。UTC（toISOString）だと日本では深夜の活動が前日扱いになるため使わない。 */
function localDate(d = new Date()): string {
  return d.toLocaleDateString('sv-SE');
}

/** 日付キーの前日（'2026-06-10' → '2026-06-09'）。正午起点で夏時間の影響を避ける。 */
function prevDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return localDate(d);
}

// アイテムの種類（神社仏閣にちなんだ品）
const ITEM_POOL: { name: string; icon: string }[] = [
  { name: 'お守り', icon: '🧿' },
  { name: '御神酒', icon: '🍶' },
  { name: '絵馬', icon: '🎴' },
  { name: '神札', icon: '🎋' },
  { name: '鈴', icon: '🔔' },
  { name: '御朱印', icon: '📜' },
  { name: '破魔矢', icon: '🏹' },
];

/** localStorage の容量超過エラーか（Safari/WKWebView は code 22、Firefox は NS_ERROR_DOM_QUOTA_REACHED）。 */
export function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22)
  );
}

// Database class wrapping client side state
class MockDatabase {
  private isBrowser = typeof window !== 'undefined';

  constructor() {
    // クラウド復元（cloud-sync の pull / マージ反映）は db を経由せず localStorage を
    // 直接書き換えるため、このイベントでスポットキャッシュを破棄して読み直す。
    if (this.isBrowser) {
      window.addEventListener('yaorozu:external-write', () => this.invalidateSpotsCache());
    }
  }

  private load<T>(key: string, defaultValue: T): T {
    if (!this.isBrowser) return defaultValue;
    const data = localStorage.getItem(key);
    if (data == null) return defaultValue;
    // 破損した JSON でも getter 全体が壊れないよう、パース失敗は既定値にフォールバック
    try {
      return JSON.parse(data) as T;
    } catch {
      return defaultValue;
    }
  }

  private save<T>(key: string, data: T): void {
    if (!this.isBrowser) return;
    localStorage.setItem(key, JSON.stringify(data));
    // クラウド永続化（鍵が設定されていれば有効。未設定なら no-op）
    schedulePush();
  }

  // Getters
  getUsers(): User[] {
    const users = this.load<User[]>(KEYS.USERS, INITIAL_USERS);
    // 退化・破損したユーザーリスト（空配列・非配列）は初期ユーザーへフォールバック。
    // クラウド同期で空の yaorozu_users が書き込まれても getUser('user-self') が壊れないようにする。
    if (!Array.isArray(users) || users.length === 0) return INITIAL_USERS;
    return users;
  }

  /** 旧形式（シード全件保存）→ 差分形式への圧縮を、セッション中1回だけ行うフラグ */
  private spotsCompacted = false;
  // スポットはアプリ中で最も読まれるデータ（地図・一覧・詳細が毎レンダー参照する）。
  // 毎回の JSON パース＋シードとのマージ（4,600件）を避けるためセッション内キャッシュを持つ。
  private spotsRawCache: Spot[] | null = null;
  private spotsLiveCache: Spot[] | null = null;

  /** db を経由しない localStorage 書き込み（クラウド復元など）の後に呼ぶ。 */
  invalidateSpotsCache(): void {
    this.spotsRawCache = null;
    this.spotsLiveCache = null;
  }

  /**
   * 削除済みも含む全スポット（監査・mutator の保存用）。
   * 保存形式は「シードとの差分」（変更された/追加されたスポットのみ）。読み取り時に
   * シードへ重ねて完全なリストへ復元する。旧形式（全件保存・約2.3MB）が残っていたら
   * 一度だけ差分形式へ圧縮し直し、localStorage の quota を解放する。
   */
  private getSpotsRaw(): Spot[] {
    if (this.spotsRawCache) return this.spotsRawCache;
    const stored = this.load<Spot[] | null>(KEYS.SPOTS, null);
    if (!Array.isArray(stored)) {
      this.spotsRawCache = INITIAL_SPOTS;
      return INITIAL_SPOTS;
    }
    const overlay = new Map<string, Spot>();
    const extras: Spot[] = [];
    for (const s of stored) {
      if (SEED_SPOT_JSON.has(s.id)) overlay.set(s.id, s);
      else extras.push(s);
    }
    const merged = [...INITIAL_SPOTS.map((s) => overlay.get(s.id) ?? s), ...extras];
    this.spotsRawCache = merged;
    // 旧形式の検出: シード由来の保存件数が明らかに多い（差分なら通常は少数）
    if (!this.spotsCompacted && this.isBrowser) {
      this.spotsCompacted = true;
      if (overlay.size > 1000) {
        try {
          this.saveSpots(merged);
        } catch {
          /* 圧縮できなくても読み取りは成立させる */
        }
      }
    }
    return merged;
  }

  /**
   * スポットを保存する（KEYS.SPOTS への唯一の書き込み口）。
   * シードと同一内容の場は書き込まず、変更・追加された場だけを永続化する。
   */
  private saveSpots(spots: Spot[]): void {
    this.spotsRawCache = spots;
    this.spotsLiveCache = null;
    const delta = spots.filter((s) => {
      const seed = SEED_SPOT_JSON.get(s.id);
      return !seed || seed !== JSON.stringify(s);
    });
    this.save(KEYS.SPOTS, delta);
  }

  /** 削除済みも含む全エージェント（監査・mutator の保存用）。 */
  private getAgentsRaw(): Agent[] {
    return this.load<Agent[]>(KEYS.AGENTS, INITIAL_AGENTS);
  }

  getSpots(): Spot[] {
    if (this.spotsLiveCache) return this.spotsLiveCache;
    const stored = this.getSpotsRaw();
    const now = Date.now();
    // 読み取り時の退役処理（ソフト削除＝deletedAt 打刻。ハード削除はせず監査ログを残す）:
    //   ① TTL 期限切れ。
    //   ② 寺社以外の場 — 場は実在の神社・寺院のみとする方針のため、旧仕様で生成された
    //      公園・商店街・史跡などの場を退役させる。
    //   ③ 旧フォールバックの「GPS地点 (lat, lng)」プレースホルダー — 実在の場のみとする方針のため退役。
    let mutated = false;
    const withTtl = stored.map(s => {
      if (s.deletedAt) return s;
      const ttlExpired = s.expiresAt != null && new Date(s.expiresAt).getTime() <= now;
      const notShrineOrTemple = s.category !== '神社' && s.category !== '寺院';
      const gpsPlaceholder = s.name.startsWith('GPS地点');
      if (ttlExpired || notShrineOrTemple || gpsPlaceholder) {
        mutated = true;
        return { ...s, deletedAt: new Date().toISOString() };
      }
      return s;
    });
    if (mutated) {
      this.saveSpots(withTtl);
      // カスケード：退役（TTL or 寺社以外）になった場の神もソフト削除
      const justRetired = new Set(
        withTtl.filter(s => s.deletedAt && !stored.find(o => o.id === s.id)?.deletedAt).map(s => s.id)
      );
      if (justRetired.size) {
        this.save(KEYS.AGENTS, this.getAgentsRaw().map(a =>
          justRetired.has(a.spotId) && !a.deletedAt ? { ...a, deletedAt: new Date().toISOString() } : a));
      }
    }
    const live = withTtl.filter(s => !s.deletedAt);
    this.spotsLiveCache = live;
    return live;
  }

  /** 削除済みスポット（生成/削除日時の監査ビュー用）。 */
  getDeletedSpots(): Spot[] {
    return this.getSpotsRaw().filter(s => s.deletedAt);
  }

  getAgents(): Agent[] {
    return this.getAgentsRaw().filter(a => !a.deletedAt);
  }

  /** 削除済みの神（監査ビュー用）。 */
  getDeletedAgents(): Agent[] {
    return this.getAgentsRaw().filter(a => a.deletedAt);
  }

  getUgc(): UgcPost[] {
    return this.load(KEYS.UGC, INITIAL_UGC);
  }

  getAffiliates(): AffiliateLink[] {
    return this.load(KEYS.AFFILIATE, INITIAL_AFFILIATE_LINKS);
  }

  // ── 生成クエスト（場の 価値・課題・魂 から生成。プレイヤーが読む実ストア） ──
  getGeneratedQuests(): Quest[] {
    const all = this.load<Quest[]>(KEYS.QUESTS, []);
    const now = Date.now();
    const prog = this.getChallengeProgress();
    // 「参加済み」＝挑戦中 / 制覇済み / ステップ進捗あり。これらは TTL 対象外。
    const isJoined = (q: Quest) =>
      prog.activeId === q.id || prog.completed.includes(q.id) || (prog.done[q.id]?.length ?? 0) > 0;
    // 生成後 QUEST_TTL_MS を過ぎても未参加なら削除（createdAt 無しの旧データは残す）
    const live = all.filter(
      (q) => !(q.createdAt && now - new Date(q.createdAt).getTime() > QUEST_TTL_MS && !isJoined(q))
    );
    if (live.length !== all.length) this.save(KEYS.QUESTS, live);
    return live;
  }

  getQuestsForSpot(spotId: string): Quest[] {
    return this.getGeneratedQuests().filter((q) => q.spotId === spotId);
  }

  /** その場の生成クエストを差し替え保存（再公開＝置換。重複を避ける）。生成時刻を打刻し TTL を起算。 */
  saveGeneratedQuests(spotId: string, quests: Quest[]): void {
    const others = this.getGeneratedQuests().filter((q) => q.spotId !== spotId);
    const nowIso = new Date().toISOString();
    const stamped = quests.map((q) => ({ ...q, createdAt: q.createdAt ?? nowIso }));
    this.save(KEYS.QUESTS, [...stamped, ...others]);
  }

  /** 生成クエスト＋静的クエスト（CHALLENGES）の全件。生成を先頭に。 */
  getAllQuests(): Quest[] {
    return [...this.getGeneratedQuests(), ...CHALLENGES];
  }

  /** id で生成・静的を横断して1件取得。 */
  getQuest(id: string): Quest | undefined {
    return this.getAllQuests().find((q) => q.id === id);
  }

  /** クエスト生成ルール（方針）。未設定なら既定値。 */
  getQuestRules(): string {
    return this.load<string>(KEYS.QUEST_RULES, DEFAULT_QUEST_RULES);
  }

  saveQuestRules(text: string): void {
    this.save(KEYS.QUEST_RULES, text);
  }

  /** 場生成ルール（方針）。未設定なら既定値。 */
  getSpotRules(): string {
    return this.load<string>(KEYS.SPOT_RULES, DEFAULT_SPOT_RULES);
  }

  saveSpotRules(text: string): void {
    this.save(KEYS.SPOT_RULES, text);
  }

  /** Godの役割（システムの目的）。未設定なら既定値。 */
  getSystemRole(): string {
    return this.load<string>(KEYS.SYSTEM_ROLE, DEFAULT_SYSTEM_ROLE);
  }

  saveSystemRole(text: string): void {
    this.save(KEYS.SYSTEM_ROLE, text);
  }

  // ── 指標スナップショット（時系列／Analytics） ──
  /** 現在の各指標を集計する。 */
  getCurrentMetrics(): Omit<MetricsSnapshot, 'ts'> {
    const spots = this.getSpots();
    const users = this.getUsers();
    const apiByDay = this.getApiCallsByDay();
    let aiCalls = 0;
    for (const day of Object.values(apiByDay)) {
      aiCalls += (day.ai_chat ?? 0) + (day.ai_generate ?? 0);
    }
    return {
      spots: spots.length,
      quests: this.getAllQuests().length,
      value: spots.reduce((n, s) => n + (s.enjoyments?.length ?? 0), 0),
      issues: spots.reduce((n, s) => n + (s.issues?.length ?? 0), 0),
      users: users.length,
      activities: this.getActivities().length,
      toku: users.reduce((n, u) => n + (u.totalToku ?? 0), 0),
      aiCalls,
    };
  }

  // API 呼び出しログ
  getApiCallsByDay(): ApiCallsByDay {
    return this.load<ApiCallsByDay>(KEYS.API_CALLS, {});
  }

  trackApiCall(type: ApiCallType): void {
    const date = new Date().toISOString().slice(0, 10);
    const log = this.getApiCallsByDay();
    const day = log[date] ?? {};
    day[type] = (day[type] ?? 0) + 1;
    log[date] = day;
    // 60日より古いエントリを削除
    const cutoff = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
    for (const k of Object.keys(log)) { if (k < cutoff) delete log[k]; }
    this.save(KEYS.API_CALLS, log);
  }

  // ユーザー失効（管理者削除 → 再ログイン強制）
  getRevokedUsers(): string[] {
    return this.load<string[]>(KEYS.REVOKED, []);
  }

  isRevoked(userId: string): boolean {
    return this.getRevokedUsers().includes(userId);
  }

  revokeUser(userId: string): void {
    const list = this.getRevokedUsers();
    if (!list.includes(userId)) {
      this.save(KEYS.REVOKED, [...list, userId]);
    }
  }

  reinstateUser(userId: string): void {
    this.save(KEYS.REVOKED, this.getRevokedUsers().filter(id => id !== userId));
  }

  getMetricsSnapshots(): MetricsSnapshot[] {
    return this.load<MetricsSnapshot[]>(KEYS.METRICS, []);
  }

  /** 現在値を時系列に記録（直近と全く同じなら追加しない）。最大500点。 */
  recordMetricsSnapshot(): MetricsSnapshot[] {
    const snaps = this.getMetricsSnapshots();
    const cur = this.getCurrentMetrics();
    const last = snaps[snaps.length - 1];
    const same = last && (Object.keys(cur) as (keyof typeof cur)[]).every((k) => last[k] === cur[k]);
    if (same) return snaps;
    const next = [...snaps, { ...cur, ts: Date.now() }].slice(-500);
    this.save(KEYS.METRICS, next);
    return next;
  }

  // Find operations
  getUser(id: string): User | undefined {
    return this.getUsers().find(u => u.id === id);
  }

  getSpot(id: string): Spot | undefined {
    return this.getSpots().find(s => s.id === id);
  }

  getAgentBySpot(spotId: string): Agent | undefined {
    return this.getAgents().find(a => a.spotId === spotId);
  }

  getUgcBySpot(spotId: string): UgcPost[] {
    return this.getUgc()
      .filter(post => post.spotId === spotId)
      .sort((a, b) => b.likesCount - a.likesCount); // Top rated first
  }

  getAffiliatesBySpot(spotName: string): AffiliateLink[] {
    // Basic keyword match。ダミー(example.com)の偽リンクは本物URLが入るまで表示しない。
    return this.getAffiliates()
      .filter(aff => spotName.includes(aff.targetArea) || aff.targetArea.includes(spotName))
      .filter(aff => isRealAffiliateUrl(aff.url));
  }

  // Write operations
  addUgcPost(userId: string, spotId: string, content: string, opts?: { imageUrl?: string; visibility?: UgcVisibility }): UgcPost {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error('User not found');

    // 入力検証（defense-in-depth）。表示側は React が自動エスケープするが、保存値も健全化する。
    const UGC_CONTENT_MAX = 1000;
    const safeContent = (content ?? '').trim().slice(0, UGC_CONTENT_MAX);
    if (!safeContent && !opts?.imageUrl) throw new Error('content or image required');

    const posts = this.getUgc();
    const newPost: UgcPost = {
      id: `ugc-${Date.now()}`,
      userId,
      userDisplayName: user.displayName,
      spotId,
      content: safeContent,
      imageUrl: opts?.imageUrl,
      visibility: opts?.visibility ?? 'all',
      likesCount: 0,
      likedBy: [],
      createdAt: new Date().toISOString(),
    };

    posts.push(newPost);
    this.save(KEYS.UGC, posts);

    // Reward 50 Toku for creating post
    this.rewardToku(userId, 50);
    this.adjustFollow(userId, 5, 0); // 投稿で信者（フォロワー）が少し増える

    // Recalculate Creator for this spot
    this.recalculateSpotCreator(spotId);

    return newPost;
  }

  likeUgcPost(userId: string, postId: string): UgcPost {
    const posts = this.getUgc();
    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) throw new Error('Post not found');

    const post = posts[postIndex];
    if (post.likedBy.includes(userId)) {
      // Already liked, do nothing or toggle (we'll implement toggle via unlikeUgcPost)
      return post;
    }

    post.likedBy.push(userId);
    post.likesCount += 1;
    posts[postIndex] = post;
    this.save(KEYS.UGC, posts);

    // Reward author with 10 Toku
    this.rewardToku(post.userId, 10);

    // Recalculate creator in case thresholds change
    this.recalculateSpotCreator(post.spotId);

    return post;
  }

  unlikeUgcPost(userId: string, postId: string): UgcPost {
    const posts = this.getUgc();
    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) throw new Error('Post not found');

    const post = posts[postIndex];
    const userLikeIndex = post.likedBy.indexOf(userId);
    if (userLikeIndex === -1) return post; // Not liked yet

    post.likedBy.splice(userLikeIndex, 1);
    post.likesCount = Math.max(0, post.likesCount - 1);
    posts[postIndex] = post;
    this.save(KEYS.UGC, posts);

    // Subtract 10 Toku from author
    this.rewardToku(post.userId, -10);

    // Recalculate Creator
    this.recalculateSpotCreator(post.spotId);

    return post;
  }

  updateAgent(spotId: string, updates: Partial<Agent>): Agent {
    const agents = this.getAgentsRaw(); // 削除済みも保持したまま更新
    const index = agents.findIndex(a => a.spotId === spotId && !a.deletedAt);
    if (index === -1) throw new Error('Agent not found');

    const updatedAgent = { ...agents[index], ...updates };
    agents[index] = updatedAgent;
    this.save(KEYS.AGENTS, agents);
    return updatedAgent;
  }

  // Update current user display name / profile
  updateUserProfile(userId: string, displayName: string): User {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) throw new Error('User not found');

    users[index].displayName = displayName;
    // update avatar just in case
    users[index].avatarUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(displayName)}`;
    this.save(KEYS.USERS, users);
    return users[index];
  }

  // ────────────────────────────────────────────────
  // アプリ設定（System タブ）
  // ────────────────────────────────────────────────
  getAppSettings(): AppSettings {
    return this.load<AppSettings>(KEYS.APP_SETTINGS, { spotTtlDays: SPOT_TTL_MS / 86_400_000 });
  }
  saveAppSettings(s: AppSettings): void {
    this.save(KEYS.APP_SETTINGS, s);
  }

  /** ユーザーのアバター画像を設定（アバター写真タスクで撮影した一枚など）。 */
  setUserAvatar(userId: string, url: string): User | undefined {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return undefined;
    users[index].avatarUrl = url;
    this.save(KEYS.USERS, users);
    return users[index];
  }

  // ────────────────────────────────────────────────
  // 煩悩（覚り = 徳 − 未解決煩悩）
  // ────────────────────────────────────────────────
  getBonnou(userId: string): Bonnou[] {
    return this.load<Bonnou[]>(KEYS.BONNOU, []).filter(b => b.userId === userId);
  }

  /** 未解決の煩悩数（覚りの減算項）。 */
  getUnresolvedBonnouCount(userId?: string): number {
    const all = this.load<Bonnou[]>(KEYS.BONNOU, []);
    return all.filter(b => !b.resolved && (userId ? b.userId === userId : true)).length;
  }

  /** 煩悩を打ち明ける（記録）。bonnou_ask タスクの完了処理。 */
  addBonnou(userId: string, text: string, spotId?: string): Bonnou {
    const all = this.load<Bonnou[]>(KEYS.BONNOU, []);
    const b: Bonnou = { id: `bn-${Date.now()}`, userId, text, spotId, resolved: false, createdAt: new Date().toISOString() };
    all.push(b);
    this.save(KEYS.BONNOU, all);
    return b;
  }

  /** 煩悩を一つ手放す（浄化）。id 指定が無ければ最も古い未解決を解決。bonnou_resolve タスクの完了処理。 */
  resolveBonnou(userId: string, bonnouId?: string): Bonnou | undefined {
    const all = this.load<Bonnou[]>(KEYS.BONNOU, []);
    const idx = bonnouId
      ? all.findIndex(b => b.id === bonnouId && b.userId === userId)
      : all.findIndex(b => b.userId === userId && !b.resolved);
    if (idx === -1) return undefined;
    all[idx] = { ...all[idx], resolved: true, resolvedAt: new Date().toISOString() };
    this.save(KEYS.BONNOU, all);
    return all[idx];
  }

  // ────────────────────────────────────────────────
  // Admin operations (管理者ダッシュボード用)
  // ────────────────────────────────────────────────

  // Upsert a spot (create if id is new, otherwise update)。raw リストで保存し削除済みを失わない。
  adminSaveSpot(spot: Spot): Spot {
    const spots = this.getSpotsRaw();
    const index = spots.findIndex(s => s.id === spot.id);
    const nowIso = new Date().toISOString();
    if (index === -1) {
      spots.push({ ...spot, createdAt: spot.createdAt ?? nowIso });
    } else {
      // 更新時は createdAt を維持（リセットしない）
      spots[index] = { ...spot, createdAt: spot.createdAt ?? spots[index].createdAt };
    }
    this.saveSpots(spots);
    return spot;
  }

  // ソフト削除：deletedAt を打刻し、神もカスケードでソフト削除。UGC はハード削除。
  adminDeleteSpot(id: string): void {
    const ts = new Date().toISOString();
    const spots = this.getSpotsRaw();
    const target = spots.find(s => s.id === id);
    this.saveSpots(spots.map(s => s.id === id && !s.deletedAt ? { ...s, deletedAt: ts } : s));
    this.save(KEYS.AGENTS, this.getAgentsRaw().map(a => a.spotId === id && !a.deletedAt ? { ...a, deletedAt: ts } : a));
    this.save(KEYS.UGC, this.getUgc().filter(p => p.spotId !== id));
    // 生成クエストはハード削除（再生成可能・orphan を残さない）
    this.save(KEYS.QUESTS, this.getGeneratedQuests().filter(q => q.spotId !== id));
    this.logActivity({ type: 'spot_delete', userId: 'system', source: 'system', spotId: id, detail: target?.name });
  }

  // Upsert a user
  adminSaveUser(user: User): User {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index === -1) users.push(user);
    else users[index] = user;
    this.save(KEYS.USERS, users);
    return user;
  }

  adminDeleteUser(id: string): void {
    this.save(KEYS.USERS, this.getUsers().filter(u => u.id !== id));
    this.revokeUser(id); // 次回ログイン時に再登録を強制
  }

  adminDeleteUgc(id: string): void {
    this.save(KEYS.UGC, this.getUgc().filter(p => p.id !== id));
  }

  // Upsert an agent (神様AI)。raw リストで保存し削除済みを失わない。
  adminSaveAgent(agent: Agent): Agent {
    const agents = this.getAgentsRaw();
    const index = agents.findIndex(a => a.id === agent.id);
    const nowIso = new Date().toISOString();
    if (index === -1) {
      agents.push({ ...agent, createdAt: agent.createdAt ?? nowIso });
    } else {
      agents[index] = { ...agent, createdAt: agent.createdAt ?? agents[index].createdAt };
    }
    this.save(KEYS.AGENTS, agents);
    return agent;
  }

  // ソフト削除（deletedAt 打刻）。既に削除済みならタイムスタンプを保持。
  adminDeleteAgent(id: string): void {
    const ts = new Date().toISOString();
    this.save(KEYS.AGENTS, this.getAgentsRaw().map(a => a.id === id && !a.deletedAt ? { ...a, deletedAt: ts } : a));
  }

  // Reset all data back to initial seeds
  adminResetAll(): void {
    if (!this.isBrowser) return;
    Object.values(KEYS).forEach(key => localStorage.removeItem(key));
  }

  // Share spot to SNS and earn +15 Toku
  shareSpot(userId: string, spotId: string): void {
    this.rewardToku(userId, 15);
  }

  // ────────────────────────────────────────────────
  // 写真UGC（初期は空。投稿でセット、不適切は却下で削除）
  // ────────────────────────────────────────────────

  /** スポットの投稿写真一覧 */
  getSpotPhotos(spotId: string): string[] {
    const spot = this.getSpot(spotId);
    return spot?.photos ?? [];
  }

  /** 表示用のメイン写真（無ければ空文字＝未投稿） */
  getPrimaryPhoto(spotId: string): string {
    const spot = this.getSpot(spotId);
    if (!spot) return '';
    if (spot.photos && spot.photos.length > 0) return spot.photos[0];
    return spot.imageUrl || '';
  }

  /** 写真を投稿（神への奉納）。初投稿ならスポット写真がセットされる。+30徳 */
  addSpotPhoto(userId: string, spotId: string, url: string): Spot | undefined {
    const spots = this.getSpotsRaw(); // 削除済みを保持したまま更新
    const idx = spots.findIndex(s => s.id === spotId && !s.deletedAt);
    if (idx === -1) return undefined;

    const spot = spots[idx];
    spot.photos = [...(spot.photos ?? []), url];
    // メイン画像が未設定ならこの投稿をメインにする
    if (!spot.imageUrl) spot.imageUrl = url;
    spots[idx] = spot;
    this.saveSpots(spots);

    this.rewardToku(userId, 30);
    this.recalculateSpotCreator(spotId);
    return spot;
  }

  /** 不適切な写真を却下（削除）。誰でも実行可能なコミュニティモデレーション */
  rejectSpotPhoto(spotId: string, url: string): Spot | undefined {
    const spots = this.getSpotsRaw(); // 削除済みを保持したまま更新
    const idx = spots.findIndex(s => s.id === spotId && !s.deletedAt);
    if (idx === -1) return undefined;

    const spot = spots[idx];
    spot.photos = (spot.photos ?? []).filter(p => p !== url);
    // メイン画像が却下されたら次の投稿写真へ差し替え（無ければ空）
    if (spot.imageUrl === url) spot.imageUrl = spot.photos[0] ?? '';
    spots[idx] = spot;
    this.saveSpots(spots);
    return spot;
  }

  /** 神がUGCによって成長：楽しみ方を1つ追加 */
  addEnjoyment(spotId: string, text: string): Spot | undefined {
    const spots = this.getSpotsRaw(); // 削除済みを保持したまま更新
    const idx = spots.findIndex(s => s.id === spotId && !s.deletedAt);
    if (idx === -1) return undefined;
    const spot = spots[idx];
    if (!spot.enjoyments.includes(text)) {
      spot.enjoyments = [...spot.enjoyments, text];
      spots[idx] = spot;
      this.saveSpots(spots);
    }
    return spot;
  }

  /** 神がUGCによって観測：課題を1つ追加（重複は弾く）。価値・課題のループ素材。 */
  addIssue(spotId: string, text: string): Spot | undefined {
    const spots = this.getSpotsRaw();
    const idx = spots.findIndex(s => s.id === spotId && !s.deletedAt);
    if (idx === -1) return undefined;
    const spot = spots[idx];
    const issues = spot.issues ?? [];
    if (!issues.includes(text)) {
      spot.issues = [...issues, text];
      spots[idx] = spot;
      this.saveSpots(spots);
    }
    return spot;
  }

  /** 課題を1件解決して場から取り除く（resolveIssue 達成時）。文言一致のみ削除・不一致は何もしない。
   *  活気 = enjoyments − issues は計算式なので、removeIssue + addEnjoyment で「活気+2」が成立する。 */
  removeIssue(spotId: string, issueText: string): Spot | undefined {
    const spots = this.getSpotsRaw();
    const idx = spots.findIndex(s => s.id === spotId && !s.deletedAt);
    if (idx === -1) return undefined;
    const spot = spots[idx];
    const issues = spot.issues ?? [];
    const at = issues.indexOf(issueText);
    if (at !== -1) {
      spot.issues = [...issues.slice(0, at), ...issues.slice(at + 1)];
      spots[idx] = spot;
      this.saveSpots(spots);
    }
    return spot;
  }

  /** 汎用：神の依頼タスク達成で徳を付与 */
  completeGodTask(userId: string, spotId: string, reward: number): void {
    this.rewardToku(userId, reward);
    this.recalculateSpotCreator(spotId);
  }

  // ────────────────────────────────────────────────
  // 貢献度（訪問・タスク達成数・フォロー）
  // ────────────────────────────────────────────────

  private getAllStats(): { [userId: string]: UserContribution } {
    return this.load(KEYS.STATS, {} as { [userId: string]: UserContribution });
  }

  /** ユーザーの貢献度を取得（未登録なら既定値。user-self は初期フォロー数を付与） */
  getUserStats(userId: string): UserContribution {
    const all = this.getAllStats();
    const existing = all[userId];
    if (existing) return { ...defaultContribution(), ...existing };
    const base = defaultContribution();
    if (userId === 'user-self') {
      base.followers = 256;
      base.following = 128;
    }
    return base;
  }

  private saveUserStats(userId: string, stats: UserContribution): void {
    const all = this.getAllStats();
    all[userId] = stats;
    this.save(KEYS.STATS, all);
  }

  /** スポット別貢献徳を加算（石碑ランキング用） */
  private addSpotContrib(userId: string, spotId: string, amount: number): void {
    const stats = this.getUserStats(userId);
    stats.spotContrib = { ...stats.spotContrib, [spotId]: (stats.spotContrib[spotId] || 0) + amount };
    this.saveUserStats(userId, stats);
  }

  /** スポット訪問を記録（重複は無視）。+5徳の探訪ボーナス。一部でアイテム付与 */
  recordVisit(userId: string, spotId: string): UserContribution {
    const stats = this.getUserStats(userId);
    if (!stats.visitedSpotIds.includes(spotId)) {
      stats.visitedSpotIds = [...stats.visitedSpotIds, spotId];
      this.rewardToku(userId, 5);
      this.addSpotContrib(userId, spotId, 5);
      this.logActivity({ type: 'visit', userId, spotId, reward: 5 });
      // 一部のスポットでアイテムを授かる（決定論的）
      const spot = this.getSpot(spotId);
      let h = 0;
      for (let i = 0; i < spotId.length; i++) h = (h * 31 + spotId.charCodeAt(i)) >>> 0;
      if (spot && h % 2 === 0 && !stats.items.some((it) => it.id === `item-${spotId}`)) {
        const tmpl = ITEM_POOL[h % ITEM_POOL.length];
        const others = this.getSpots().filter((s) => s.id !== spotId);
        const dest = others.length > 0 ? others[h % others.length] : spot;
        stats.items = [
          ...stats.items,
          {
            id: `item-${spotId}`,
            name: tmpl.name,
            icon: tmpl.icon,
            fromSpotName: spot.name,
            toSpotId: dest.id,
            toSpotName: dest.name,
            delivered: false,
          },
        ];
      }
      this.saveUserStats(userId, stats);
    }
    return stats;
  }

  /** 所持アイテム一覧 */
  getItems(userId: string): InventoryItem[] {
    return this.getUserStats(userId).items;
  }

  /** アイテムを届け先スポットへ配達。+25徳＋配達先へ貢献徳 */
  deliverItem(userId: string, itemId: string): InventoryItem | undefined {
    const stats = this.getUserStats(userId);
    const item = stats.items.find((i) => i.id === itemId);
    if (!item || item.delivered) return undefined;
    item.delivered = true;
    this.saveUserStats(userId, stats);
    this.rewardToku(userId, 25);
    this.addSpotContrib(userId, item.toSpotId, 25);
    return item;
  }

  /** 神タスク達成回数を記録（称号・バッジ判定に使う） */
  recordTaskDone(userId: string, type: string, spotId?: string, reward?: number): UserContribution {
    const stats = this.getUserStats(userId);
    stats.taskCounts = { ...stats.taskCounts, [type]: (stats.taskCounts[type] || 0) + 1 };
    this.saveUserStats(userId, stats);
    if (spotId && reward) this.addSpotContrib(userId, spotId, reward);
    this.logActivity({ type: type === 'photo' ? 'photo' : 'task', userId, spotId, detail: type, reward });
    return stats;
  }

  /** フォロワー/フォロー数を加算（デモ用） */
  adjustFollow(userId: string, dFollowers: number, dFollowing: number): UserContribution {
    const stats = this.getUserStats(userId);
    stats.followers = Math.max(0, stats.followers + dFollowers);
    stats.following = Math.max(0, stats.following + dFollowing);
    this.saveUserStats(userId, stats);
    return stats;
  }

  // ────────────────────────────────────────────────
  // 日次活動（参拝ストリーク・カムバック・本日の御用）
  // ────────────────────────────────────────────────

  private getDailyLog(): DailyLog {
    const log = this.load<DailyLog>(KEYS.DAILY, { days: {} });
    if (!log.days || typeof log.days !== 'object') log.days = {};
    return log;
  }

  /** date から過去へ連続している日数（date 自身に活動が無ければ 0）。 */
  private streakEndingAt(days: { [date: string]: DailyDay }, date: string): number {
    let n = 0;
    let d = date;
    while (days[d]) { n += 1; d = prevDate(d); }
    return n;
  }

  /** 今日の活動を打刻（徳を得る行動から rewardToku 経由で呼ばれる）。180日より古い日は削除。 */
  private touchDaily(): void {
    if (!this.isBrowser) return;
    const log = this.getDailyLog();
    const today = localDate();
    const day = log.days[today] ?? { acts: 0 };
    day.acts += 1;
    log.days[today] = day;
    const cutoff = localDate(new Date(Date.now() - 180 * 86400_000));
    for (const k of Object.keys(log.days)) { if (k < cutoff) delete log.days[k]; }
    log.longestEver = Math.max(log.longestEver ?? 0, this.streakEndingAt(log.days, today));
    this.save(KEYS.DAILY, log);
  }

  /** 参拝ストリーク。今日未活動でも前日まで連続していれば current は維持表示する。 */
  getStreakInfo(): StreakInfo {
    const log = this.getDailyLog();
    const today = localDate();
    const todayDone = !!log.days[today];
    const current = this.streakEndingAt(log.days, todayDone ? today : prevDate(today));
    // 最長：保持中の days の連続区間と、保存済みの単調最大値の大きい方
    let longest = Math.max(log.longestEver ?? 0, current);
    const dates = Object.keys(log.days).sort();
    let run = 0;
    let prev: string | null = null;
    for (const d of dates) {
      run = prev !== null && prevDate(d) === prev ? run + 1 : 1;
      if (run > longest) longest = run;
      prev = d;
    }
    return { current, longest, todayDone, lastDate: dates.length ? dates[dates.length - 1] : null };
  }

  /** 最後に活動した日（今日を含む）。daily が空なら activities から推定（旧データ救済）。 */
  getLastActiveDate(): string | null {
    const dates = Object.keys(this.getDailyLog().days).sort();
    if (dates.length) return dates[dates.length - 1];
    // activities はクラウドマージ後に「先頭=最新」が崩れることがあるため createdAt の最大値で見る
    const ts = this.getActivities()
      .filter((a) => (a.source ?? 'human') === 'human')
      .reduce((m, a) => Math.max(m, new Date(a.createdAt).getTime() || 0), 0);
    return ts ? localDate(new Date(ts)) : null;
  }

  /** 3日以上ぶりの帰還なら +30徳 を1日1回だけ授与し、経過日数を返す（該当しなければ null）。 */
  grantComebackBonus(userId = 'user-self'): number | null {
    if (!this.isBrowser) return null;
    const today = localDate();
    if (this.getDailyLog().days[today]?.comeback) return null; // 今日すでに授与済み
    const last = this.getLastActiveDate();
    if (!last || last >= today) return null; // 履歴なし（新規）or 今日すでに活動済み
    const gapDays = Math.round(
      (new Date(`${today}T12:00:00`).getTime() - new Date(`${last}T12:00:00`).getTime()) / 86400_000
    );
    if (gapDays < 3) return null;
    this.rewardToku(userId, 30); // touchDaily が今日を打刻する
    const log = this.getDailyLog();
    log.days[today] = { ...(log.days[today] ?? { acts: 0 }), comeback: true };
    this.save(KEYS.DAILY, log);
    this.logActivity({ type: 'task', userId, detail: 'comeback', reward: 30 });
    return gapDays;
  }

  // 神の依頼（場の御用）の本日達成。{ 'YYYY-MM-DD': { 'spotId:taskId': true } }
  private getGodTaskDone(): { [date: string]: { [key: string]: true } } {
    return this.load(KEYS.GOD_TASK_DONE, {} as { [date: string]: { [key: string]: true } });
  }

  /** この場の依頼を今日すでに果たしたか（御用は1日1回の日課）。 */
  isTaskDoneToday(spotId: string, taskId: string): boolean {
    return !!this.getGodTaskDone()[localDate()]?.[`${spotId}:${taskId}`];
  }

  /** 場の依頼の本日達成を打刻。7日より古い日は削除。 */
  markTaskDoneToday(spotId: string, taskId: string): void {
    if (!this.isBrowser) return;
    const all = this.getGodTaskDone();
    const today = localDate();
    all[today] = { ...(all[today] ?? {}), [`${spotId}:${taskId}`]: true };
    const cutoff = localDate(new Date(Date.now() - 7 * 86400_000));
    for (const k of Object.keys(all)) { if (k < cutoff) delete all[k]; }
    this.save(KEYS.GOD_TASK_DONE, all);
  }

  // ────────────────────────────────────────────────
  // チャレンジ進捗
  // ────────────────────────────────────────────────
  getChallengeProgress(): ChallengeProgress {
    return this.load(KEYS.CHALLENGE, { activeId: null, done: {}, completed: [] } as ChallengeProgress);
  }

  setActiveChallenge(challengeId: string | null): void {
    const p = this.getChallengeProgress();
    p.activeId = challengeId;
    this.save(KEYS.CHALLENGE, p);
    if (challengeId) this.logActivity({ type: 'quest_join', userId: 'user-self', challengeId });
  }

  // ── アクティビティ（行動ログ：クエスト参加・場所訪問・依頼達成 等を保持）──
  logActivity(a: Omit<Activity, 'id' | 'createdAt'>): void {
    if (!this.isBrowser) return;
    const all = this.load<Activity[]>(KEYS.ACTIVITIES, []);
    const activity: Activity = { ...a, id: `act-${Date.now()}-${Math.floor(Math.random() * 10000)}`, createdAt: new Date().toISOString() };
    all.unshift(activity);
    this.save(KEYS.ACTIVITIES, all.slice(0, 500));
    // 同タブ内のリスナーへリアルタイム通知
    window.dispatchEvent(new CustomEvent('yaorozu:activity', { detail: activity }));
  }
  getActivities(): Activity[] {
    return this.load<Activity[]>(KEYS.ACTIVITIES, []);
  }

  // ── アマテラス（八百万神の基底クラス）の共通Identity.md ──
  getDainichiIdentity(): string | undefined {
    const v = this.load<string | null>(KEYS.DAINICHI, null);
    return v ?? undefined;
  }
  saveDainichiIdentity(md: string): void {
    this.save(KEYS.DAINICHI, md);
  }

  /** チャレンジのステップを達成。+rewardの徳。全ステップ達成でcompletedに追加（バッジ獲得） */
  completeChallengeStep(userId: string, challengeId: string, stepId: string, totalSteps: number, reward = 20): ChallengeProgress {
    // 御朱印タスクは、その場の御朱印を授かっていなければ完了させない
    const task = this.getQuest(challengeId)?.tasks.find((t) => t.id === stepId);
    if (task?.type === 'goshuin' && task.spotId && !hasGoShuin(userId, task.spotId)) {
      return this.getChallengeProgress();
    }
    const p = this.getChallengeProgress();
    const done = new Set(p.done[challengeId] || []);
    if (!done.has(stepId)) {
      done.add(stepId);
      p.done[challengeId] = Array.from(done);
      this.rewardToku(userId, reward);
      this.logActivity({ type: 'quest_step', userId, challengeId, detail: stepId, reward });
    }
    if (done.size >= totalSteps && !p.completed.includes(challengeId)) {
      p.completed.push(challengeId);
      this.rewardToku(userId, 100); // 制覇ボーナス
      this.adjustFollow(userId, 30, 0); // 制覇で信者（フォロワー）が増える
      this.logActivity({ type: 'quest_complete', userId, challengeId, reward: 100 });
    }
    this.save(KEYS.CHALLENGE, p);
    return p;
  }

  /** チャレンジの証拠写真（達成の振り返り用）。challengeId→stepId→dataURL */
  getChallengePhotos(challengeId: string): { [stepId: string]: string } {
    const all = this.load<{ [cid: string]: { [sid: string]: string } }>(KEYS.CHALLENGE_PHOTOS, {});
    return all[challengeId] || {};
  }

  /**
   * 保存できたら true。端末ストレージ満杯（Supabase 未設定時は base64 写真が
   * localStorage に蓄積し quota を超えうる）なら false を返す。
   * 呼び出し側は false でも達成処理を止めず、ユーザーに保存失敗を知らせること。
   */
  saveChallengePhoto(challengeId: string, stepId: string, dataUrl: string): boolean {
    const all = this.load<{ [cid: string]: { [sid: string]: string } }>(KEYS.CHALLENGE_PHOTOS, {});
    all[challengeId] = { ...(all[challengeId] || {}), [stepId]: dataUrl };
    try {
      this.save(KEYS.CHALLENGE_PHOTOS, all);
      return true;
    } catch (e) {
      if (isQuotaError(e)) return false;
      throw e;
    }
  }

  /** 証拠写真に添えるコメント。challengeId→stepId→text */
  getChallengeComments(challengeId: string): { [stepId: string]: string } {
    const all = this.load<{ [cid: string]: { [sid: string]: string } }>(KEYS.CHALLENGE_COMMENTS, {});
    return all[challengeId] || {};
  }

  saveChallengeComment(challengeId: string, stepId: string, text: string): void {
    if (!text.trim()) return;
    const all = this.load<{ [cid: string]: { [sid: string]: string } }>(KEYS.CHALLENGE_COMMENTS, {});
    all[challengeId] = { ...(all[challengeId] || {}), [stepId]: text.trim() };
    this.save(KEYS.CHALLENGE_COMMENTS, all);
  }

  /** 全クエスト（チャレンジ）の証拠写真URLを平坦化して返す（写真評価タスク用） */
  getAllChallengePhotoUrls(): string[] {
    const all = this.load<{ [cid: string]: { [sid: string]: string } }>(KEYS.CHALLENGE_PHOTOS, {});
    const urls: string[] = [];
    Object.values(all).forEach((steps) => Object.values(steps).forEach((u) => { if (u) urls.push(u); }));
    return urls;
  }

  // ────────────────────────────────────────────────
  // 蘊蓄データベース（管理コンソール）
  // ────────────────────────────────────────────────
  getTrivia(): TriviaEntry[] {
    return this.load(KEYS.TRIVIA, INITIAL_TRIVIA);
  }

  adminSaveTrivia(t: TriviaEntry): TriviaEntry {
    const all = this.getTrivia();
    const i = all.findIndex((x) => x.id === t.id);
    if (i === -1) all.push(t);
    else all[i] = t;
    this.save(KEYS.TRIVIA, all);
    return t;
  }

  adminDeleteTrivia(id: string): void {
    this.save(KEYS.TRIVIA, this.getTrivia().filter((t) => t.id !== id));
  }

  /** スポットの徳ランキング（石碑）：そのスポットで徳を生んだユーザー上位
   *  UGC投稿による徳＋タスク/写真/訪問による貢献徳を合算する。 */
  getSpotRanking(spotId: string): { user: User; toku: number }[] {
    const users = this.getUsers();
    const allStats = this.getAllStats();
    return users
      .map((user) => {
        const ugcToku = this.getTokuAtSpot(user.id, spotId);
        const contribToku = allStats[user.id]?.spotContrib?.[spotId] || 0;
        return { user, toku: ugcToku + contribToku };
      })
      .filter((r) => r.toku > 0)
      .sort((a, b) => b.toku - a.toku)
      .slice(0, 10);
  }

  /** スポットに集まった徳の総量（地図のフキダシ「徳 123」用）。
   *  シード人気値＋全ユーザーの貢献徳＋UGC由来の徳。 */
  getSpotToku(spotId: string): number {
    let h = 0;
    for (let i = 0; i < spotId.length; i++) h = (h * 31 + spotId.charCodeAt(i)) >>> 0;
    const base = h % 1800; // シード人気値

    const allStats = this.getAllStats();
    let contrib = 0;
    Object.keys(allStats).forEach((uid) => {
      contrib += allStats[uid]?.spotContrib?.[spotId] || 0;
    });

    const ugcToku = this.getUgc()
      .filter((p) => p.spotId === spotId)
      .reduce((sum, p) => sum + 50 + p.likesCount * 10, 0);

    return base + contrib + ugcToku;
  }

  // Reward Toku points to user and update their title
  private rewardToku(userId: string, amount: number): void {
    // 徳を得る全行動はここに集約されるため、参拝ストリークの打刻も1点フックで行う
    // （amount<0 の減点＝写真却下などは「今日の参拝」に数えない）
    if (amount > 0) this.touchDaily();
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return;

    users[index].totalToku = Math.max(0, users[index].totalToku + amount);
    
    // Title mapping
    // 0-99: 見習い巡礼者
    // 100-299: 巡礼ガイド
    // 300-499: 徳高き修行僧
    // 500+: 大創世神
    const toku = users[index].totalToku;
    if (toku >= 500) {
      users[index].currentTitle = '大創世神';
      users[index].avatarFrameColor = '#FFD700'; // Gold glow
    } else if (toku >= 300) {
      users[index].currentTitle = '徳高き修行僧';
      users[index].avatarFrameColor = '#A020F0'; // Purple glow
    } else if (toku >= 100) {
      users[index].currentTitle = '巡礼ガイド';
      users[index].avatarFrameColor = '#00BFFF'; // Blue glow
    } else {
      users[index].currentTitle = '見習い巡礼者';
      users[index].avatarFrameColor = undefined;
    }

    this.save(KEYS.USERS, users);
  }

  // Recalculates who should be the Creator of a spot.
  // The creator is the user who has generated the most Toku points (likes*10 + posts*50) at this specific spot.
  // The minimum Toku required at a spot to become creator is the spot's `tokuRequirement`.
  private recalculateSpotCreator(spotId: string): void {
    const spots = this.getSpotsRaw(); // 削除済みを保持したまま保存し直す（監査ログを失わない）
    const spotIndex = spots.findIndex(s => s.id === spotId && !s.deletedAt);
    if (spotIndex === -1) return;

    const spot = spots[spotIndex];
    const posts = this.getUgc().filter(p => p.spotId === spotId);
    
    // Calculate Toku per user for this spot
    const tokuPerUser: { [userId: string]: number } = {};
    posts.forEach(post => {
      // 50 points per post
      tokuPerUser[post.userId] = (tokuPerUser[post.userId] || 0) + 50;
      // 10 points per like
      tokuPerUser[post.userId] += post.likesCount * 10;
    });

    // Find user with highest points
    let maxToku = 0;
    let topUserId: string | null = null;
    
    Object.keys(tokuPerUser).forEach(userId => {
      if (tokuPerUser[userId] > maxToku) {
        maxToku = tokuPerUser[userId];
        topUserId = userId;
      }
    });

    // Only set as Creator if they meet the threshold
    if (maxToku >= spot.tokuRequirement && topUserId) {
      if (spot.creatorId !== topUserId) {
        spot.creatorId = topUserId;
        spots[spotIndex] = spot;
        this.saveSpots(spots);
      }
    } else {
      // If no one meets it, it might revert to null (or keep previous if they still have the lead,
      // but let's keep it simple: if top user goes below requirement, it reverts)
      if (spot.creatorId !== null && maxToku < spot.tokuRequirement) {
        spot.creatorId = null;
        spots[spotIndex] = spot;
        this.saveSpots(spots);
      }
    }
  }

  // Calculate a user's Toku points generated *specifically* at a given spot
  getTokuAtSpot(userId: string, spotId: string): number {
    const posts = this.getUgc().filter(p => p.spotId === spotId && p.userId === userId);
    let spotToku = posts.length * 50; // 50 per post
    posts.forEach(post => {
      spotToku += post.likesCount * 10; // 10 per like
    });
    return spotToku;
  }
}

export const db = new MockDatabase();

/** GPS 生成スポットの TTL（ミリ秒）。30 日。 */
export const SPOT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 生成クエストの TTL（ミリ秒）。24 時間。参加されないまま期限切れになると削除される。
 *  （旧: 1時間。数日ぶりに開くと棚が空＝「戻ったのに何もない」になるため延長。参加済みは恒久保持。） */
export const QUEST_TTL_MS = 24 * 60 * 60 * 1000;
