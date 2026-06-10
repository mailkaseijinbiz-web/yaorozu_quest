# 八百万クエスト (Yaorozu Quest) 仕様書

> **生成日**: 2026-06-09
> **対象バージョン**: brushup phase1-3
> **対象ブランチ**: `feat/brushup-phase1-3`

---

## 1. 概要・コンセプト

### 1.1 アプリケーション概要

「八百万クエスト (Yaorozu Quest)」は、現実世界の場所（神社・寺院・公園・史跡など）を巡る位置情報連動型の巡礼ゲームである。ユーザーは現在地周辺に自動生成される「場（Spot）」を訪れ、その場に宿る「八百万神（Agent）」と対話し、神から与えられるクエスト（Quest = Task[]）やタスクを遂行することで「徳（Toku）」を獲得し、称号・レベル・バッジを高めていく。

### 1.2 中核思想 — 世界の幸福

本システムの設計哲学は次の式に集約される。

```
世界の幸福 = 場の活気 + 人間の覚り
```

- **場の活気（spotVitality）** = `enjoyments.length − issues.length`（楽しみ方の数から課題の数を引いた値）
- **人間の覚り（enlightenment）** = ユーザーの累積徳（totalToku）

管理コンソールの Blueprint では世界の幸福度を次式で算出する。

```
happiness = (totalValue − totalIssues) + totalToku
```

`enlightenment = totalToku − 0`（bonnou／煩悩は常に 0 で、将来的に減算項として用いられる余地が残されている）。

この式は単なる表示用指標ではなく、ゲームメカニクスの根幹である。ユーザーが価値（enjoyments）を増やし課題（issues）を解決すると場の活気が上がり、徳を積むと人間の覚りが上がる。価値と課題のループを閉じることが神の戦略の中心に据えられている（§7.5「価値・課題のループ経済」参照）。

### 1.3 神の戦略的役割

システムの根幹を成す神の役割（DEFAULT_SYSTEM_ROLE, 約2800字のMarkdown）は、「場の価値（enjoyments）と課題（issues）のループを閉じ、メトリクスを調整することで世界の幸福を最大化する」という戦略意図として定義されている。神は次の三つの働きを通じてこれを実現する。

1. **価値の増幅**（enjoyments を増やす）
2. **課題の解決**（issues を減らす）
3. **試練を課して徳を授ける**（人間の覚りを高める）

すべての神は、基底となる総本尊「アマテラス（DAINICHI）」の Identity を継承する。

---

## 2. システムアーキテクチャ

### 2.1 技術スタック

| 領域 | 技術 |
|---|---|
| フレームワーク | Next.js 16（App Router、API Routes） |
| UI ライブラリ | React 19（useState/useEffect/useCallback/useRef/useMemo） |
| 言語 | TypeScript |
| 地図 | Leaflet v1 + CartoDB Voyager タイル |
| アイコン | lucide-react |
| スタイリング | Tailwind CSS |
| ローカル永続化 | localStorage |
| クラウド永続化 | Supabase（`user_snapshots` テーブル、`photos` Storage バケット） |
| AIチャット/生成 | Gemini（gemini-2.5-flash）→ OpenAI（gpt-4o-mini）→ ルールベース |
| 音声合成 (TTS) | ElevenLabs（eleven_multilingual_v2）→ Web Speech API |
| アバター生成 | DiceBear API |

> 注: 本リポジトリの Next.js は破壊的変更を含む特殊バージョンであり、API・規約・ファイル構造が一般的な Next.js と異なる場合がある。実装時は `node_modules/next/dist/docs/` の該当ガイドを参照すること。

### 2.2 レイヤ構成

| レイヤ | 主要ファイル | 役割 |
|---|---|---|
| プレゼンテーション | `src/app/page.tsx`, `src/components/HomeTab.tsx`, `MapTab.tsx`, `LeafletMap.tsx`, `SpotDetail.tsx` | 3タブUI・地図・スポット詳細 |
| 管理コンソール | `src/app/admin/page.tsx`, `src/components/admin/*` | パスワード認証付き管理画面 |
| ドメイン/データ層 | `src/lib/db.ts`（MockDatabase） | localStorage ベースのモックDB |
| 同期層 | `src/lib/cloud-sync.ts` | Supabase スナップショット push/pull |
| API ルート | `src/app/api/{chat,generate-quest,generate-spot,tts,upload,persist}/route.ts` | AI/TTS/アップロード/永続化 |
| データ定義 | `src/data/{tasks,challenges,challenge-seed,levels,badges,god-tasks}.ts` | クエスト・レベル・バッジ・タスク定義 |
| ユーティリティ | `src/lib/{geo,goshuin,dainichi,place-docs,upload,supabase}.ts` | 地理計算・御朱印・神格文書・画像処理 |

### 2.3 データの流れ

1. **起動時**: `pullSnapshot()` が `GET /api/persist?userId=user-self` でクラウドスナップショットを取得し、localStorage に適用（`suspendPush=true` で自己発火防止）。
2. **位置取得**: `requestLocation()` が GPS 座標を取得。場が 0 件なら `generateSpotNearby()` で自動生成チェーン。
3. **生成**: `POST /api/generate-spot` で Spot + Agent を生成し、`db.adminSaveSpot()` / `db.adminSaveAgent()` で保存。クエスト 0 件なら `POST /api/generate-quest` をチェーン。
4. **ユーザー操作**: 訪問・写真・UGC・クエスト遂行などで徳を獲得し、`db` へ保存。`db.save()` が `schedulePush()` を呼び出す。
5. **同期**: `schedulePush()` が 1500ms デバウンス後に `pushNow()` を実行し、`POST /api/persist` で SYNC_KEYS をクラウドへ送信。
6. **アクティビティ**: 各操作が `logActivity()` を呼び、`window.dispatchEvent('yaorozu:activity')` で他フレーム（管理コンソール等）へリアルタイム通知。

---

## 3. 画面構成とナビゲーション

### 3.1 メインアプリ — 3タブナビゲーション

画面下部のナビゲーションバー（NAV_TABS）で 3 タブを切り替える。`activeTab` state で管理。

| key | ラベル | アイコン | 内容 |
|---|---|---|---|
| `home` | クエスト | Flag | クエスト一覧（HomeTab） |
| `quest` | マップ | MapPin | Leaflet 地図（MapTab） |
| `mypage` | マイページ | UserCircle2 | プロフィール・4サブタブ |

> **重要**: ラベルとkeyが意味的に反転している。key=`home` が「クエスト」一覧を、key=`quest` が「マップ」を指す。実装・読解の際はこの反転に注意（§6.1・§6.2 冒頭でも再掲）。

#### タブ切り替え時の自動生成

- `key === 'home'`: `generateSpotNearby()` 実行＋クエスト確認。クエスト 0 件なら agentId を持つスポット優先で `generateQuestsForSpot()`。
- `key === 'quest'` かつ `spots.length === 0`: `generateSpotNearby()`。

#### マイページのサブタブ

| サブタブ | 内容 |
|---|---|
| activity | アクティビティログ（最大500件、種別ごとにスタイル付与） |
| goshuin | 御朱印一覧（受取時刻・神名・絵文字） |
| badges | バッジ進捗（getBadgeStates） |
| quests | 達成クエスト（completedIds から検索、シェア機能） |

### 3.2 管理コンソール

`/admin` でアクセス。パスワードゲート後、7タブ構成（blueprint / analytics / spots / gods / users / challenges / activity）。

---

## 4. ドメインモデル・データモデル

### 4.1 User

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | ユーザーID（現在ユーザーは `user-self`） |
| displayName | string | 表示名 |
| avatarUrl | string | アバター画像URL（DiceBear） |
| totalToku | number | 累積徳 |
| currentTitle | string | 徳しきい値に基づく称号 |
| avatarFrameColor? | string | 装飾フレーム色（レベル表示用） |

称号: `見習い巡礼者`(0-99) / `巡礼ガイド`(100-299) / `徳高き修行僧`(300-499) / `大創世神`(500+)。

### 4.2 Spot（場）

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | スポットID（接頭辞は生成経路で異なる。下記注参照） |
| name | string | 名前 |
| description | string | 説明 |
| latitude / longitude | number | GPS座標 |
| creatorId | string \| null | 創世主（Creator）ユーザーID |
| imageUrl | string | メイン画像URL |
| category | string | カテゴリ（神社/寺院/公園 等） |
| tokuRequirement | number | 創世主になるのに必要な徳 |
| enjoyments | string[] | 楽しみ方（価値, 3-5件） |
| difficulty | number | 難易度 D/T レーティング 1-5 |
| terrain | number | 地形難度 1-5 |
| attributes | string[] | ジオキャッシング属性 |
| cacheType | string | キャッシュ種別（Virtual 等） |
| godName | string | 神の名前 |
| godEmoji | string | 神のアイコン絵文字 |
| godRequests | string[] | 神からの依頼テキスト（フキダシ用） |
| taskTypes? | string[] | 神が依頼できるタスク種別 |
| photos? | string[] | ユーザー投稿写真URL |
| verified? | boolean | 実在検証済みフラグ |
| issues? | string[] | 解決すべき課題リスト |
| expiresAt? | string | ISO 8601 期限（GPS生成スポット用） |

- `isVerifiedSpot()`: `verified` フラグ、なければ `!id.startsWith('tk-')` で判定。
- `spotVitality()`: `(enjoyments?.length ?? 0) − (issues?.length ?? 0)`。

> **id 接頭辞の不整合に注意**: `isVerifiedSpot()` が未検証として特別扱いするのは `tk-` 接頭辞のみである。一方 `POST /api/generate-spot` のフォールバック/生成経路は `gps-{randomId}` という別接頭辞でスポットを返す（§12.3）。`gps-` 接頭辞のスポットは `tk-` で始まらないため、`isVerifiedSpot()` 上は **検証済みと判定される**。両者は別コードパスに由来する既知の不整合であり、検証判定が必要な箇所では `verified` フラグの明示設定が推奨される。

### 4.3 Agent（八百万神）

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | エージェントID（GPS生成は `agent-{randomId}`） |
| spotId | string | 関連スポットID |
| name | string | 神の名前 |
| personaDescription | string | 人格説明 |
| systemPrompt | string | チャット用システムプロンプト |
| avatar3dUrl | string | 3Dモデル/イラストURL |
| haloColor | string | ハロー色（16進） |
| accessoryType | string | `鏡`/`剣`/`扇子`/`なし` |
| voiceTone | enum | `厳格`/`親しみやすい`/`神秘的`/`高飛車`/`賢者` |
| identityMd? | string | Identity.md（事実・価値・課題） |
| soulMd? | string | Soul.md（人格・語り口・世界観） |

スポット削除・期限切れ時にカスケード削除される。

### 4.4 Quest（= Task[]、別名 Challenge）

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | クエストID（生成は `uq-{spotId}-{ts}-{n}`、テーマ別 `chg-N`、シンプル `chs-N`） |
| spotId? | string | 場 FK |
| title / description | string | タイトル・説明 |
| difficulty | 1\|2\|3 | やさしい/ふつう/むずかしい |
| minLevel | number | 参加に必要な最低レベル |
| estMinutes | number | 推定所要時間（デフォルト20、5-120） |
| badgeIcon / badgeName | string | 獲得バッジ |
| goalName | string | ゴール地点名 |
| goalLat / goalLng | number | ゴール座標 |
| tasks | Task[] | ステップ（3-5個、生成正規化で最大8個） |
| source? | enum | `static`/`generated`/`simple`/`fallback` |

### 4.5 Task

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | クエスト内で一意（例 `s0`、場の依頼は type名） |
| kind | TaskKind | `sense`/`understand`/`act`（typeから導出） |
| type | TaskType | 12種（下記） |
| spotId? | string | 場 FK |
| icon | string | 絵文字 |
| label | string | 一覧用ラベル |
| title | string | 見出し |
| reward | number | 達成で得る徳 |
| call? | (place)=>string | 神の声の依頼文 |
| murmur? | string | 地図用の短い神の声 |
| action? | string | 次の行動指示 |
| trivia? | string | 町歩きの蘊蓄 |
| triviaCategory? | enum | `地形`/`歴史`/`建築`/`道路` |
| photo? | boolean | 写真ミッションフラグ |
| lat? / lng? | number | ジオフェンス座標 |
| issueRef? | IssueRef | `{issueIndex, issueText}` |

TaskType（12種）: `context`/`photo`/`evaluate`/`event`/`review`/`sns`/`buy`/`eat`/`cleaning`/`visit`/`resolveIssue`/`judge`。

### 4.6 UgcPost

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | 投稿ID |
| userId | string | 投稿者ID |
| userDisplayName | string | 投稿者表示名 |
| spotId | string | 関連スポットID |
| content | string | 本文 |
| imageUrl? | string | 画像URL |
| likesCount | number | いいね数 |
| likedBy | string[] | いいねしたユーザーID |
| createdAt | string | ISO 8601 |

投稿者は +50 徳、各いいねで著者 +10 徳（取消で −10）。

### 4.7 Activity

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | 自動生成 |
| type | ActivityType | 下記10種 |
| userId | string | 実行ユーザーID |
| source? | `human`\|`system` | 操作源 |
| spotId? | string | 関連スポット |
| challengeId? | string | 関連クエスト |
| detail? | string | 補足情報 |
| reward? | number | 獲得徳 |
| createdAt | string | ISO 8601 |

ActivityType: `quest_join`/`quest_step`/`quest_complete`/`visit`/`task`/`photo`/`ugc`/`home_view`/`map_move`/`spot_generate`。最大500件、unshift（新しい順）、`yaorozu:activity` CustomEvent を dispatch。

### 4.8 Goshuin（御朱印）

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | 御朱印ID |
| spotId | string | スポットID |
| spotName | string | スポット名 |
| godName | string | 神名 |
| godEmoji | string | 神絵文字 |
| category | string | カテゴリ |
| receivedAt | string | ISO 8601 受取時刻 |

各スポットへの初回メッセージで付与。`localStorage['yaorozu_goshuin_${userId}']` に保存。

### 4.9 MetricsSnapshot

| フィールド | 型 | 説明 |
|---|---|---|
| ts | number | 記録タイムスタンプ |
| spots | number | 場の総数 |
| quests | number | クエスト総数 |
| value | number | enjoyments 総数（価値） |
| issues | number | 課題総数 |
| users | number | ユーザー数 |
| activities | number | アクティビティ数 |
| toku | number | 徳総量 |
| aiCalls | number | 累積AI API呼び出し数 |
| ttsCalls | number | 累積TTS API呼び出し数 |

最大500件、全数値が前回と同一なら重複排除（dedup）。

### 4.10 InventoryItem（アイテム）

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | アイテムID |
| name | string | アイテム名 |
| icon | string | 絵文字 |
| fromSpotName | string | 入手元スポット名 |
| toSpotId | string | 配達先スポットID |
| toSpotName | string | 配達先スポット名 |
| delivered | boolean | 配達済みフラグ |

スポット訪問時に決定論的（spotIdハッシュ）に付与され、別スポットへ配達すると配達先に +25 徳と spotContrib が加算される。詳細は §6.5。

ITEM_POOL（7種）: お守り🧿 / 御神酒🍶 / 絵馬🎴 / 神札🎋 / 鈴🔔 / 御朱印📜 / 破魔矢🏹。

### 4.11 TriviaEntry（町歩き蘊蓄）

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | エントリID |
| title | string | タイトル |
| category | enum | `地形`/`歴史`/`建築`/`道路` |
| area | string | エリアキーワード |
| content | string | 本文 |

`generateTrivia()` により約1000件以上を生成。`INITIAL_TRIVIA` は5シード + 生成分。エリア/カテゴリで検索（クライアント線形走査）。管理コンソールで CRUD 可（`adminSaveTrivia`/`adminDeleteTrivia`）。**トリビアは純ローカルデータであり SYNC_KEYS に含まれない**（クラウド同期対象外）。

### 4.12 その他のモデル

| モデル | 主なフィールド | 用途 |
|---|---|---|
| ChallengeProgress | `activeId: string\|null`, `done: {[id]: stepId[]}`, `completed: string[]` | クエスト進捗 |
| UserContribution | `visitedSpotIds[], taskCounts{}, spotContrib{}, items[], followers, following` | 貢献統計（user-self は followers=256, following=128） |
| AffiliateLink | `id, title, category, targetArea, url, priceRange, rating, imageUrl` | 提携リンク（example.com を除外） |
| ApiCallsByDay | `Record<YYYY-MM-DD, {ai_chat?, ai_generate?, tts?}>` | 日次API利用ログ（60日で自動削除） |
| GuideMsg | `role: 'spirit'\|'user', text` | 道案内チャット |
| Message (SpotDetail) | `id, sender, text, createdAt, mode?` | スポットAIチャット（mode: gemini/openai/fallback_mock/error_fallback） |

---

## 5. データ永続化と同期

### 5.1 localStorage キー（KEYS, 18個）

| 論理名 | キー | 備考 |
|---|---|---|
| USERS | `yaorozu_users` | |
| SPOTS | `yaorozu_spots_v3` | v3=リセット点 |
| AGENTS | `yaorozu_agents_v2` | v2=リセット点 |
| UGC | `yaorozu_ugc` | |
| AFFILIATE | `yaorozu_affiliate` | |
| STATS | `yaorozu_user_stats` | |
| CHALLENGE | `yaorozu_challenge_progress` | |
| CHALLENGE_PHOTOS | `yaorozu_challenge_photos` | dataURL保存 |
| QUESTS | `yaorozu_quests_v2` | |
| QUEST_RULES | `yaorozu_quest_rules` | |
| SPOT_RULES | `yaorozu_spot_rules` | |
| SYSTEM_ROLE | `yaorozu_system_role` | |
| METRICS | `yaorozu_metrics_snapshots` | 同期対象外 |
| TRIVIA | `yaorozu_trivia` | 同期対象外（純ローカル） |
| ACTIVITIES | `yaorozu_activities` | |
| DAINICHI | `yaorozu_dainichi_identity` | |
| API_CALLS | `yaorozu_api_calls` | |
| REVOKED | `yaorozu_revoked_users` | |

### 5.2 クラウド同期（SYNC_KEYS, 16個）

Supabase へ同期されるキーは **正確に16個** であり、全 KEYS のサブセットである（`src/lib/cloud-sync.ts` で検証済み）。トリビア（`yaorozu_trivia`）・メトリクススナップショット（`yaorozu_metrics_snapshots`）など純ローカルデータは含まない。

```
yaorozu_users, yaorozu_ugc, yaorozu_user_stats, yaorozu_challenge_progress,
yaorozu_challenge_photos, yaorozu_activities, yaorozu_goshuin_user-self,
yaorozu_spots_v3, yaorozu_agents_v2, yaorozu_quests_v2, yaorozu_quest_rules,
yaorozu_spot_rules, yaorozu_system_role, yaorozu_dainichi_identity,
yaorozu_api_calls, yaorozu_revoked_users
```

> **注**: 管理コンソール側の一部記述で「27 SYNC_KEYS」とされる箇所があるが誤りである。SYNC_KEYS のリストは1つだけ存在し、その要素数は16である。`yaorozu_goshuin_user-self`（御朱印）が含まれ、単一ユーザーデモのため userId が固定で埋め込まれている点に注意。

スナップショットIDは単一ユーザーデモのため固定値 `user-self`（SNAPSHOT_ID）。将来は認証ユーザーIDを使用。

### 5.3 push / pull

- **pullSnapshot()**: `GET /api/persist?userId=user-self`。`enabled && data` があれば localStorage に適用。`yaorozu_users` が空/非配列ならスキップ。適用したら `true`。`cloudEnabled` グローバルを設定。
- **schedulePush()**: 1500ms（pushDebounceMs）デバウンス。SSR・`suspendPush=true`・`cloudEnabled=false` のとき no-op。
- **pushNow()**: `POST /api/persist`（`userId=user-self` + 全SYNC_KEYS）。`yaorozu_users` が空ならスキップ。ネットワークエラーは silent（リトライなし）。

### 5.4 空ユーザー保護

`getUsers()`・`pullSnapshot()`・`pushNow()` はいずれも `yaorozu_users` が空/非配列の場合をガードし、`user-self` の喪失（マイページ空白化）を防ぐ。`getUsers()` は空なら `INITIAL_USERS` にロールバック。

### 5.5 スポット TTL

GPS生成スポットは `SPOT_TTL_MS = 30 * 24 * 60 * 60 * 1000`（30日）の `expiresAt` を持つ。`getSpots()` は読み取りのたびに期限切れスポットと対応 Agent を自動フィルタ・削除する（lazy cleanup、スケジュール実行ではない）。

### 5.6 その他の保持上限

| 項目 | 上限 |
|---|---|
| アクティビティ | 500件 |
| メトリクススナップショット | 500件 |
| 日次APIログ | 60日 |

---

## 6. 主要機能・ユースケース

### 6.1 ホームタブ（クエスト一覧 / HomeTab）

> **注**: 下部ナビでは key=`home` がラベル「クエスト」に対応する（§3.1 の反転に注意）。

- `db.getAllQuests()`（生成クエスト + 静的CHALLENGES、生成が先頭）を取得。
- フィルタ `todo`/`done`。`joinable` 派生（`userLevel >= minLevel && !completed`）。
- ソート: 第1キー＝参加可否（ok=true 優先）、第2キー＝距離（近い順）。上位20件にスライス → +5件ずつページネーション。
- 神の帰属表示: `ch.spotId → db.getSpot()` で `godName` + `godEmoji` をカード内に表示。spotId が null（生成クエストの多く）なら帰属なし。
- レベルゲート: `userLevel < minLevel` でロック 🔒 アイコン＋「Lv.N 以上」表示。
- 進捗バー: 5ドット行（done数/total）。色＝白(active)/金(completed)/赤(todo)/灰(pending)。
- スピナー: クエスト0件 かつ `!filter.done` かつ `isGeneratingQuests=true` のとき「近くの場からクエスト生成中…」を表示。
- ハイドレーション安全のため `mounted` state でlocalStorageアクセスを遅延。

### 6.2 マップタブ（MapTab / LeafletMap）

> **注**: 下部ナビでは key=`quest` がラベル「マップ」に対応する（§3.1 の反転に注意）。

- タイル: CartoDB Voyager（`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`, maxZoom=19）。attributionControl は無効。
- **ユーザー位置マーカー**: シアンドット＋コンパス。zIndexOffset=1000。iOS は `webkitCompassHeading`、Android は `deviceorientation` の alpha から導出。取得不可なら activeSpot への bearing にフォールバック。iOS 13+ は権限タップ必須。
- **スポットマーカー**: divIcon バブル。フキダシは選択中の場に対して表示（青丸マーカーの上に開く）。無選択時のみ最寄りの場に表示。🦊 神絵文字 + 30字に切り詰めた神の声を白バブルで表示（4.5秒間隔で回転、フェード）。それ以外は青ドット。
- **マーカー間引き**: ズームに応じて表示数を制限。z≤12→12, z≤13→20, z≤14→30, z≤15→45, z>15→60。境界パディング 0.15（15%）。activeSpot は画面外でも常に含める。
- **ゴールマーカー**: activeChallenge があり未完ステップが残るとき青📸バブル。zIndexOffset=1500。クエスト開始時にゴールへ0.9秒で飛び、1.7秒停止後ユーザー位置へ0.9秒で戻る演出。
- **チャレンジ導入（プロローグ）**: 初回入場時（introSeenId≠challenge.id かつ done.size===0）。Phase0（0.8秒遅延後）に説明を1字/38msでタイプ表示、Phase1（完了1.5秒後）に PROLOGUE カード（難易度/推定時間/タスク数）を表示し3秒で自動進行。導入中はヘッダー・フッター・地図ボタンを隠す。`localStorage['yaorozu_intro_seen']` に保存。
- **チャレンジ進行**: 上部に青バナー「Challenge In Progress」。マルチステップなら精霊フォックス＋予報バブル（1字/30ms）。下部に次ウェイポイントカード（500m閾値）。500m以遠ならボタングレーアウト、タップで「📍 近づいてください」警告（2.8秒で自動消去）。距離表示の色: ≤50m=emerald, ≤300m=amber, それ以外=青。
- **チャレンジ完了**: 「証拠写真」ボタン → file input（capture='environment'）→ プレビュー → `onAdvanceChallenge(stepId, photoUrl)`。全ステップ完了で celebrate モーダル（紙吹雪18片、バッジ、精霊バブル＋トリビア）。
- **インタラクティブカード**: activeChallenge が無いとき、画面下部にユーザーレベルで参加可能な最寄り未制覇クエストを表示（completed除外、activeId除外、`userLevel >= minLevel`）。距離優先・レベル可否で並べ替え。クリックで `onStartChallenge`。創世主神社を `godSpot.godName` で表示。
- **精霊ガイドチャット（マップモード）**: 予報バブル右上のフォックスアイコンで開く。`buildGuideLog`（説明＋各ステップガイド再構成）+ 追加交換を表示。`POST /api/chat`、精霊名「道案内の精霊」、systemPrompt は200字以内推奨。
- **TTSトグル**: 音量アイコンで切替。`localStorage['yaorozu_tts']`（'0'|'1'）。ON時は `/api/tts`（ElevenLabs）→ 失敗/鍵なしで Web Speech へフォールバック。
- **地図再描画**: リサイズ/orientationchange/PWA復帰（pageshow）で `invalidateSize()`。`onMapMove` は60000ms（60秒）スロットルでアクティビティログ記録。

### 6.3 スポット詳細（SpotDetail）

- ヒーロー画像（高さ208px）、タブ式UI。`history.pushState` で開閉を履歴に積み、ブラウザバックで閉じる。
- **チャットタブ**: tab='chat' かつ messages 0件で初回挨拶（nearbyChallenge あれば挑戦を誘い、なければタスク遂行を促す）。初回ユーザーメッセージで `grantGoShuin()`（御朱印付与、既保有なら null）。`fetchTtsUrl` → Web Speech で読み上げ。`POST /api/chat` に history（直近6件）・agent・ugc・affiliates を渡す。Agent systemPrompt は応答150字以内を推奨（プロンプト上の指示であり、token上限とは別物）。`formatText` がURLを検出し買い物袋アイコン付き `<a target=_blank>` でラップ。
- **依頼タブ**: `buildSpotTasks(spot)` のタスク群。`photo/evaluate/context/review/eat/buy` 等はモーダルを開き、`visit/sns` はインライン実行。評価タスクは3-8枚の写真に👍/👎。
- **写真アップロード**: file input（capture='environment'）→ `uploadImage(file, 'spot-${spotId}')` → `addSpotPhoto()`（+30徳）。
- **UGC投稿**: `context/review/event/eat/buy/resolveIssue` 等はテキストエリアモーダル → `addUgcPost()`（+50徳）＋ `addEnjoyment()` で enjoyments 成長。
- **エージェント解決**: `resolveAgent(spot)` が `db.getAgentBySpot()`、無ければ合成 Agent（systemPrompt にスポット名/カテゴリ言及、avatar3dUrl='shrine', haloColor='#c5a028'）。
- セーフエリア対応: 閉じるボタンは `top: calc(env(safe-area-inset-top, 0px) + 12px)`、チャット入力は `paddingBottom: calc(0.625rem + env(safe-area-inset-bottom))`。

### 6.4 マイページ

- **プロフィール編集**: `editingProfile` state で名前入力フォーム表示。保存で `db.updateUserProfile()`（displayName更新＋DiceBearでアバター再生成）。totalToku からレベル・次レベルまでの徳を表示。
- **御朱印タブ**: `getGoShuinList(currentUser.id)` で取得表示。
- **バッジタブ**: `getBadgeStates(userStats, currentUser)` で進捗計算。未獲得はプログレスバー。
- **達成クエストタブ**: completedIds から Quest 検索。写真があれば3列グリッド。シェアボタンで `#YAOROZUQUEST` 付き共有。

### 6.5 アイテム配達ループ（スポット間連携）

- **入手**: `recordVisit(userId, spotId)` が初訪問時に +5 徳を付与し、`spotId` のハッシュで決定論的に ITEM_POOL（§4.10、7種）からアイテムを付与する。
- **インベントリ**: `getItems(userId)` がユーザーの `UserContribution.items` を返す。
- **配達**: `deliverItem(userId, itemId)` がアイテムを `delivered=true` にし、配達先スポット（`toSpotId`）へ **+25 徳** と spotContrib を加算する（合計 +50 相当の世界貢献）。
- このループは「ある場で得た縁起物を別の場へ運ぶ」というスポット間連携の独立したゲームメカニクスである。
- デモ用フォロー操作: `adjustFollow(userId, dFollowers, dFollowing)` は followers/following にデルタを加算し 0 以上にクランプする。

### 6.6 場のランキングと徳集計

- **記念碑ランキング（getSpotRanking(spotId)）**: スポットへの貢献度上位10名を返す。各ユーザーの UGC由来の徳（投稿 50 + いいね 10 × likesCount）と spotContrib を合算し、徳 > 0 のユーザーのみを対象に降順ソートして上位10件をスライスする。
- **スポット徳総量（getSpotToku(spotId)）**: 地図ポップアップ表示用。`base`（spotId ハッシュによる決定論的初期値）+ spotContrib 合計 + UGC合計（50 + likesCount × 10）。呼び出しごとに再計算（キャッシュなし）。
- **ユーザー別スポット徳（getTokuAtSpot(userId, spotId)）**: 当該スポットでの当該ユーザーの UGC由来の徳（投稿 50 + いいね 10）の合計。

### 6.7 創世主（Creator）の再計算

スポットの `creatorId`（創世主）は固定ではなく、UGC の変化に応じて動的に再計算される。

- **トリガー**: `recalculateSpotCreator(spotId)` は UGC 投稿・いいね・いいね取消のたび、および管理コンソールの adminSave 系操作のたびに実行される（バッチ処理・インデックスなしの O(n)）。
- **計算**: 当該スポットでユーザーごとの UGC由来の徳（投稿 50 + いいね 10）を集計し、最上位ユーザーがそのスポットの `tokuRequirement` を満たしていれば、そのユーザーを `creatorId` に昇格させる。
- **降格**: 誰も `tokuRequirement` を満たさない場合、`creatorId` は `null` に戻る。
- 創世主になることはレベル進行とは独立した「場の支配者」を表すゲーム要素であり、UGC投稿によって最も場を盛り上げたユーザーが報われる仕組みである。

---

## 7. クエスト・タスクシステム

### 7.1 神の三つの働き（GOD_FUNCTIONS）

| key | アイコン | 名称 | タスク種別 |
|---|---|---|---|
| sense | 👁️ | 情報収集 | context / event / photo / cleaning / visit |
| understand | 🧠 | 理解判断 | review / eat / evaluate / judge |
| act | ✋ | 操作 | buy / sns / resolveIssue |

`kindOfType(type)` が type を kind に写像（TASK_CATALOG から、不明時は `sense`）。

### 7.2 タスクカタログ（TASK_CATALOG, 12種の唯一の真実）

| type | kind | reward（徳） |
|---|---|---|
| visit | sense | 10 |
| sns | act | 15 |
| event | sense | 20 |
| context | sense | 25 |
| cleaning | sense | 25 |
| photo | sense | 30 |
| evaluate | understand | 35 |
| judge | understand | 35 |
| buy | act | 40 |
| eat | understand | 40 |
| review | understand | 50 |
| resolveIssue | act | 60 |

不変条件: 全12種が存在し、kind は `kindOfType()` の写像と常に一致。reward は10以上、最大60（resolveIssue）。`call`/`murmur` は非スポットタスクで null になりうる。`icon`/`label`/`reward`/`kind` は TASK_CATALOG から補完。

### 7.3 クエストの鋳造（構成ルール）

- Quest は 3-5 個（生成正規化で最大8個）の Task で構成。
- 構成ルール: 情報収集(sense)・理解判断(understand)・操作(act)を最低1つずつ含める。
- DEFAULT_QUEST_RULES（約560字）: 3-5タスク構成、価値/課題の統合、神の声との整合を規定。情報収集・理解判断・操作の三段構造を強調。
- `resolveTaskTypes(spot)`: `taskTypes` が設定済みかつ非空ならそれを使用。未設定なら COMMON_TASK_TYPES `['context','photo','evaluate','event','review','sns']` ＋ カテゴリ追加（商店=buy, 飲食=eat, 寺院/公園=cleaning）。`taskTypes=[]`（空配列）の場合は明示的なフォールバックがない点に注意。
- `buildSpotTasks(spot)`: 神の依頼タスク（`getGodTasks()`、reward降順）＋ issue 解決タスクを結合。各 `spot.issues[i]` から `id='issue-{i}'`, title=`課題を動かす: {text}` の resolveIssue タスクを生成し、両リストを reward 降順でソートする。

### 7.4 報酬・徳（TokuReward 一覧）

| アクション | 徳 |
|---|---|
| 訪問 (visit) | +5（+spotContrib +5、計+10相当） |
| 写真 (photo) | +30 |
| UGC投稿 | +50 |
| UGCいいね | 著者 +10（取消 −10） |
| アイテム配達 | +25（+spotContrib +25、計+50相当） |
| クエストステップ | 20（可変、デフォルト） |
| クエスト制覇 | +100ボーナス |
| シェア (shareSpot) | +15 |
| addSpotPhoto | +30 |

徳は単調増加（減点なし）。クエスト全ステップ完了時は `completeChallengeStep()` が +100 ボーナスを付与し `completed[]` へ移動する。

### 7.5 価値・課題のループ経済

§1.2 の幸福式（`(value − issues) + toku`）を支える具体メカニクスは以下のとおり。

- **価値の増幅**: `addEnjoyment(spotId, text)` は重複テキストを排除しつつ新しい「楽しみ方」を追加し、`spotVitality()` を **+1** する。UGC投稿時にも `addEnjoyment()` が呼ばれ enjoyments が成長する。
- **課題の解決**: `buildSpotTasks()` が生成する resolveIssue タスク（title=`課題を動かす: {text}`、reward 60）を遂行すると、課題が解決され issues が減少する。設計上、課題を1つ解決して価値を1つ加えると vitality は **net +2** となる（issues −1 + enjoyments +1）。
- この「価値を増やし、課題を減らす」ループを閉じることが神の戦略の中核であり、resolveIssue が最高報酬（60徳）に設定されているのはこのループ完結を奨励するためである。

---

## 8. 八百万神（Agent）とアマテラス（大日）・神の魂

### 8.1 アマテラス（DAINICHI）

すべての神の基底となる総本尊。

```
DAINICHI = { name: 'アマテラス', emoji: '☀️',
             title: '八百万神の基底（総本尊）',
             behaviors: [{icon, title, desc}...] }
```

`buildDainichiIdentityMd()` が三つの行い（価値の増幅・課題の解決・試練で徳を授ける）とクエスト鋳造の戒律を含む Markdown を返す。すべての神がこれを継承する。`getDainichiIdentity()` / `saveDainichiIdentity(md)` で `localStorage['yaorozu_dainichi_identity']`（KEYS.DAINICHI）に読み書きする。

### 8.2 神格文書（place-docs）

- `buildIdentityMd(spot)`: Spot の Identity.md（名前・カテゴリ・座標・検証状態・写真数・徳要件・概要・価値・課題・依頼タスク）。価値/課題が無い場合は「未収集」「未登録」のプレースホルダ。
- `buildSoulMd(spot, agent?)`: Spot の魂（化身/口調/人格/語り口/司るもの/世界観）。`getGodTasks()` でタスク一覧、`getHeartVoices()` で最初の3つの声を追加。

### 8.3 神の声（getHeartVoices）

時刻（未明/朝/昼/夕暮れ/夜）コンテキスト文 + 話題文 + 神タスクの murmur（非nullのみ）を連結。地図バブルや精霊対話の回転表示に使用。

### 8.4 声色（VOICE_TONES）

`厳格` / `親しみやすい` / `神秘的` / `高飛車` / `賢者`。チャットのフォールバックで persona ベースの応答テンプレートを分岐。

### 8.5 神アバター絵文字（godAvatarEmoji）

userId の多項式ローリングハッシュ（31x基数）→ GOD_AVATARS `['⛩️','🦊','🐉','🙏','🌊','🌲','🪷','🔥','🌸','🦌','🍶','🏮']`（12個）から `h % 12` で決定論的に選択。

---

## 9. 徳・レベル・称号・バッジ

### 9.1 レベルと称号（2系統に注意）

本システムには **2系統の称号** が並存する。

**(A) `rewardToku()` が `currentTitle` に設定する4段階**（徳しきい値で自動更新、avatarFrameColor は gold/purple/blue/none）:

| 徳 | currentTitle |
|---|---|
| 0-99 | 見習い巡礼者 |
| 100-299 | 巡礼ガイド |
| 300-499 | 徳高き修行僧 |
| 500+ | 大創世神 |

**(B) `LEVELS`（5段階）— 表示用レベルタイトル**:

| level | title | minToku | frameColor |
|---|---|---|---|
| 1 | 見習い巡礼者 | 0 | （なし） |
| 2 | 巡礼ガイド | 100 | #0284c7 |
| 3 | 徳高き修行僧 | 300 | #8b5cf6 |
| 4 | 大徳の創世主 | 500 | #c5a028 |
| 5 | 八百万の大神 | 1000 | #c5a028 |

> 4段階(A)と5段階(B)で最高位の名称が異なる（(A)は「大創世神」、(B)の Lv4 は「大徳の創世主」・Lv5 は「八百万の大神」）。両系統は別実装であり、混同しないこと。

`getLevelInfo(toku)`: 現在レベル（minToku ≤ toku で最大）・次レベル・進捗（0-1）・残り徳を導出。最高レベルは `next=null, progress=1`。

### 9.2 バッジ（BADGES, 全13種）

`BADGES` 配列は全13種の `BadgeDef` を含む。内訳は以下の通り。

| グループ | 種類数 | 内訳 |
|---|---|---|
| 訪問 | 4 | 1/10/50/100回 |
| 写真 | 2 | 10/50枚 |
| 点検（cleaning） | 2 | 10/50回 |
| フォロワー | 2 | 100/500人 |
| 徳 | 1 | 500徳 |
| 称号系（フォトグラファー/メンテナー/語り部/美食/人気者 等） | 2 | タスク数しきい値から導出される称号型バッジ |

> 上記のうち訪問〜徳の小計は 4+2+2+2+1 = **11**。残り **2** は称号系のバッジで、合計 **13** となる。なお §9.3 の EarnedTitle（動的導出される獲得称号）はこれとは別系統の表示要素である。

`getBadgeStates(stats, user)`: 各バッジで `badge.current()` を `badge.target` と比較し `earned` と `progress`（min(1, current/target)）を算出。獲得は単調（earned=true 後の取消なし）。

### 9.3 獲得称号（EarnedTitle）

貢献統計しきい値から動的導出。例: 写真≥50→名フォトグラファー / ≥10→フォトグラファー、ほか メンテナー・語り部・美食の使徒・人気者。`getEarnedTitles(stats, user)` が該当する称号配列（なければ空配列）を返す。

### 9.4 トリビアの色分け

| category | TRIVIA_TONE | TRIVIA_ICON |
|---|---|---|
| 地形 | teal | ⛰️ |
| 歴史 | amber | 📜 |
| 建築 | violet | 🏛️ |
| 道路 | sky | 🛣️ |

---

## 10. GPS自動生成（場・クエスト）とスロットリング

### 10.1 状態の初期値

| 定数 | 値 |
|---|---|
| INITIAL_USERS | 3シードユーザー（user-self ほか2名） |
| INITIAL_SPOTS | `[]`（空、GPS生成 or 管理画面で投入） |
| INITIAL_AGENTS | `[]`（空） |
| INITIAL_UGC | 3シード投稿（参照先スポットは現在削除済み） |
| INITIAL_AFFILIATE_LINKS | 7件のプレースホルダ（example.com、isRealAffiliateUrl で除外） |
| INITIAL_TRIVIA | 5シード + generateTrivia() 約1000件 |
| CHALLENGES | `[]`（空、`db.getAllQuests()` が動的生成） |

場・神・クエストは空にリセットされており、GPS 座標から自動生成される。`user-self` は主人公（保護対象）。

### 10.2 場の自動生成（generateSpotNearby）

- `POST /api/generate-spot` で GPS 座標から Spot + Agent を生成。
- スロットル: 前回（lastGenRef）から **5分以内かつ500m以内** ならスキップ。
- 成功時: `adminSaveSpot()` / `adminSaveAgent()`、`expiresAt` を SPOT_TTL_MS（30日）でセット（クライアント側でセットする。API レスポンスには含まれない）、`logActivity('spot_generate')` 記録。アクティブスポット未選択なら自動選択。クエスト0件なら `generateQuestsForSpot()` チェーン。
- エラーは silent（UI固定、スピナー解除）。

### 10.3 クエストの自動生成（generateQuestsForSpot）

- `POST /api/generate-quest`（count=2）で enjoyments/issues/soulMd から生成。
- クールダウン: 前回（lastQuestGenRef）から **30秒以内** ならスキップ。
- `isGeneratingQuests` スピナー表示。成功時 `saveGeneratedQuests()`、`trackApiCall('ai_generate')`、`refreshDatabaseStates()`。エラー silent。

### 10.4 静的（手続き的）クエスト生成

| 関数 | seed | 件数 | 構成 |
|---|---|---|---|
| `generateChallenges(697)` | 20260609 | chg-0..696 | テーマ別4-5タスク（3幕探索+1写真climax）、difficulty 1-3、座標±0.006°、source='generated' |
| `generateSimpleChallenges(300)` | 20260610 | chs-0..299 | 1タスク（photo/context/coffee/sky）、difficulty=1, minLevel=1, estMinutes=5、座標±0.02°、source='simple' |

PRNG は mulberry32（同seed→同生成）。AREAS（20東京近隣: 新中野/中野/高円寺/阿佐ヶ谷/荻窪/新宿/渋谷/吉祥寺/池袋/上野/浅草/神楽坂/谷中/下北沢/目黒/品川/錦糸町/北千住/築地/月島）× THEMES（5: history/water/arch/road/terrain）。

---

## 11. AI・TTS 統合とフォールバック戦略

### 11.1 プロバイダ・フェイルオーバー

すべての生成系で一貫したフェイルオーバー:

```
Gemini (gemini-2.5-flash) → OpenAI (gpt-4o-mini) → ルールベース fallback
```

API エラー時も throw せず、HTTP 200 で `mode`/`source` を `fallback`/`error_fallback` として返す（graceful degradation）。

### 11.2 Chat の特殊エージェント

| 判定 | 種別 | フォールバック |
|---|---|---|
| `agent.id.startsWith('agent-synthetic-')` | 合成エージェント | `getSpotFallbackResponse()`（Spot情報で応答） |
| `agent.id === 'agent-guide-spirit'` | 道案内の精霊 | `getGuideFallbackResponse()`（zenな道案内） |
| それ以外 | 通常エージェント | `getFallbackResponse()`（voiceTone別テンプレート） |

`getFallbackResponse()` はメッセージのキーワード（飯/食/おいしい等）でintent検出、voiceTone別応答、affiliate挿入、ランダムUGC引用。

### 11.3 TTS フォールバック

- `POST /api/tts`（ElevenLabs）。`ELEVENLABS_API_KEY` 無し or 失敗で `{fallback: 'web-speech'}` を HTTP 200 で返却 → クライアントで Web Speech API へ。
- デフォルトVoice: Elli（`MF3mGyEYCl7XYWbV9V6O`、アニメ声向き、`ELEVENLABS_VOICE_ID` で上書き可）。
- デフォルトModel: `eleven_multilingual_v2`（`ELEVENLABS_MODEL_ID` で上書き可）。
- Voice settings: stability 0.2 / similarity_boost 0.85 / style 0.75 / use_speaker_boost true。テキストは先頭800字のみ。
- Web Speech フォールバック（`speakJa`）: 最良の日本語ボイス（enhanced/premium/neural/Google/Kyoko）、rate=1.05、pitch=1.45。

### 11.4 画像アップロードのフォールバック

`POST /api/upload`（Supabase Storage `photos` バケット）。Supabase 無効なら `{enabled: false}` を返し、クライアントは dataURL(base64) をそのまま保存。`uploadImage()` は `compressImage()`（最大長辺1280px, QUALITY 0.82, JPEG）で圧縮後アップロード。

---

## 12. API ルート仕様

### 12.1 POST /api/chat

| 項目 | 内容 |
|---|---|
| リクエスト | `{ message, history: {sender:'user'\|'agent', text}[], spotId?, agent: Agent, ugc: UgcPost[], affiliates: AffiliateLink[], userName?, spot? }` |
| レスポンス | `{ response: string, mode: 'gemini'\|'openai'\|'fallback_mock'\|'error_fallback' }` |
| 挙動 | Agent persona に基づき返答。history 直近6件（slice(-6)）のみ context。UGC/affiliates を systemPrompt に RAG 埋め込み。max_tokens: Gemini 300（maxOutputTokens） / OpenAI 150、temperature 0.7。Gemini は systemInstruction フィールドと thinkingBudget=0 を使用。 |

### 12.2 POST /api/generate-quest

| 項目 | 内容 |
|---|---|
| リクエスト | `{ spot: SpotInput, count: number(1-5, default 3), ts: number, rules?, godRules?, spotRules? }` |
| レスポンス | `{ quests: Quest[], source: 'gemini'\|'openai'\|'fallback' }` |
| 挙動 | `buildPrompt()` で rules→DAINICHI(godRules)→spotRules の優先度でプロンプト構築（soulMd 先頭1200字、rules 2500字、godRules 600字に制限）。Gemini（responseMimeType=application/json）→ OpenAI（response_format=json_object）→ `buildFallbackQuest()`。`coerceQuest()` で正規化（difficulty 1-3, estMinutes 5-120, tasks 最大8, issueIndex 範囲内）。temperature 0.9, max_tokens 2048。 |

### 12.3 POST /api/generate-spot

| 項目 | 内容 |
|---|---|
| リクエスト | `{ lat: number, lng: number }` |
| レスポンス | `{ spot: Spot, agent: Agent }` |
| 挙動 | GPS座標（日本国内）から Gemini で Spot + Agent を同時生成。`GEMINI_API_KEY` 未設定 or 失敗で `fallbackSpot()`。spot.id=`gps-{randomId}`, agent.id=`agent-{randomId}`。expiresAt は API では未設定（アプリ側でセット）。category は CATEGORIES（神社/寺院/公園/商店街/広場/史跡/自然/文化施設/川・池/坂・路地）から。 |

> spot.id が `gps-` 接頭辞である点は §4.2 の `isVerifiedSpot()` 判定（`tk-` のみ未検証扱い）と整合しないため、検証状態の扱いに注意。

### 12.4 POST /api/tts

| 項目 | 内容 |
|---|---|
| リクエスト | `{ text: string }` |
| レスポンス | `audio/mpeg`（MP3） または `{ fallback: 'web-speech', status?, error? }` |
| 挙動 | ElevenLabs で mp3 変換。鍵なし/失敗で web-speech fallback（HTTP 200）。テキストは先頭800字。 |

### 12.5 POST /api/upload

| 項目 | 内容 |
|---|---|
| リクエスト | `{ dataUrl: 'data:image/*;base64,...', prefix? }` |
| レスポンス | `{ enabled:true, ok:true, url }` / `{ enabled:false }` / `{ enabled:true, ok:false, error }` |
| 挙動 | Supabase Storage `photos` へ。未設定なら `{enabled:false}`（HTTP 200）。パス=`{sanitizedPrefix}/{timestamp}-{size}.{ext}`、拡張子は data URL の contentType から抽出（`jpeg` は `jpg` に正規化）。5MB上限（超過は **HTTP 413**）、必須フィールド（dataUrl 等）欠如等の不正リクエストは **HTTP 400**。prefix は英数アンダースコアハイフンのみ（最大40字、デフォルト'misc'）、upsert:false。 |

### 12.6 GET / POST /api/persist

| メソッド | リクエスト | レスポンス | 挙動 |
|---|---|---|---|
| GET | クエリ `userId` | `{ enabled, data?, updatedAt? }` または `{ enabled:false }` | `user_snapshots` 行を取得。エラー時500、Supabase無効でfalse。 |
| POST | `{ userId, data }` | `{ enabled, ok?, error? }` | `user_snapshots` を upsert（onConflict: user_id）。userId/data 欠如で400、DBエラーで500、成功で `{enabled:true, ok:true}`。 |

---

## 13. 管理コンソール

### 13.1 認証

- パスワードゲート: `ADMIN_PASSWORD='Kaseijinbiz1'`（ハードコード）。`sessionStorage['yaorozu_admin_auth']='1'`。
- 認証成功時 `pullSnapshot()` → `refresh()`。ログアウトでキー削除。

### 13.2 7タブ構成

| タブ | コンポーネント | 機能 |
|---|---|---|
| blueprint | Blueprint | 世界の幸福度ダイアグラム。`happiness = (totalValue − totalIssues) + totalToku`。`runUpdate()` で先頭5スポット（各count=2）に `/api/generate-quest`、`saveGeneratedQuests()`、メトリクス記録。 |
| analytics | Analytics | レンダー時にメトリクス記録。10指標のスパークライン、日別アクティビティ（棒）、API/TTS 日別（積み上げ棒）。 |
| spots | SpotsManager | 全スポット一覧（検索・ページネーション PER_PAGE=20）。追加ボタンなし（スポットはモバイルアプリ/API経由で作成）。名前/説明/カテゴリ/座標/enjoyments/issues 編集（カンマ区切り文字列、filter(Boolean) で空除去のみ）。エージェント参照は読み取り専用（編集リンクは gods タブへ遷移）。削除で `adminDeleteSpot`（agent/UGC/quests カスケード、検証・Undo なし）。 |
| gods | YaorozuGods | エージェント登録済みスポットのみ表示（agentCount＝getAgents().length でカウント、spots.length ではない）。編集モーダル: godName/emoji/voiceTone/persona/brain（再生成可）/Identity.md・Soul.md（docTab切替・自動再生成可）/taskTypes マルチセレクト。 |
| users | UsersManager | ユーザー一覧（追加/編集/削除）。displayName/currentTitle/totalToku/avatarUrl/avatarFrameColor 編集。削除で `adminDeleteUser`→`revokeUser`（再ログイン強制）。 |
| challenges | ChallengesManager | 読み取り専用チャレンジ一覧（検索）。RulesPanel を内包。 |
| activity | ActivityManager | リアルタイムアクティビティログ。種別（all/quest/visit）・source（all/human/system）フィルタ。`yaorozu:activity` + `storage` イベントで同期（ページネーションなし・全件描画でパフォーマンスリスク）。 |

### 13.3 RulesPanel（ルール編集）

Markdown テキストエリア（Edit/Preview トグル、軽量レンダラ: h1-h3/blockquote/lists/bold/code。ネストリスト・表・コードブロックは非対応）。reset で DEFAULT_* 復元、save で `onSave()`。対象となる主要 DEFAULT_* 定数と規模:

| 定数 | 規模 | 内容 |
|---|---|---|
| DEFAULT_SYSTEM_ROLE | 約2800字 | 神の役割。世界の幸福 = 場の活気 + 人間の覚り。価値/課題ループを閉じメトリクス調整 |
| DEFAULT_SPOT_RULES | 約2200字 | 場づくりの教義。enjoyments 粒度、issues 解決可能性、vitality 式、アマテラス整合 |
| DEFAULT_QUEST_RULES | 約560字 | 3-5タスク構成、価値/課題統合、情報収集・理解判断・操作の三段構造 |

加えて神ルール（godRules）も編集対象。

### 13.4 QuestGenerator

選択スポットに `/api/generate-quest`。ドラフト（編集可、`_key` は transient・UIのみ）を publish で保存。モーダルを閉じると未保存ドラフトは失われる（自動リトライなし）。

### 13.5 god レベル算出

`godLevel = base(1) + brain custom + knowledge custom + (taskN>0) + (photoN|ugcN>0)`、最大5。重み付けなし（写真1枚とクエスト100件が同値）。Identity.md/Soul.md の非空チェックはせず存在のみ判定。

---

## 14. アクティビティログと分析

### 14.1 アクティビティ種別と source

- 10種別（ACT_CFG で種別ごとに icon/bg/text/label を定義）: `visit`/`quest_join`/`quest_step`/`quest_complete`/`task`/`photo`/`ugc`/`home_view`/`map_move`/`spot_generate`。
- `source`: `human`（ユーザー操作）/ `system`（自動生成等）。管理コンソールでフィルタ可能。

### 14.2 リアルタイム同期

`logActivity()` が `window.dispatchEvent('yaorozu:activity')` を発火（SSR では no-op）。ActivityManager は CustomEvent と `storage` イベントを購読しリアルタイム反映（ページネーションなしで全件描画 — 大量ログでパフォーマンスリスク）。

### 14.3 API 監視（Analytics）

- 日次APIログ（ApiCallsByDay）を `ai_chat`/`ai_generate`/`tts` で集計。`trackApiCall(type)` が当日（YYYY-MM-DD）バケットを加算し `schedulePush()` を呼ぶ。60日で自動削除。
- `getCurrentMetrics()` が日次ログを `aiCalls`/`ttsCalls` に合算。
- スパークラインは2点以上のスナップショットが必要（不足時は computing メッセージ）。

---

## 15. ユーザー失効（Revocation）

- 管理者が UsersManager でユーザーを削除すると `adminDeleteUser()` → `revokeUser()` で `yaorozu_revoked_users`（REVOKED）に追加。
- クライアントは認証時 `db.isRevoked('user-self')` をチェック。`true` なら失効画面（revocation screen）を表示。
- 再登録ボタン → `db.reinstateUser()`（REVOKED から除外）→ localStorage クリア → `location.reload()`。
- ユーザー削除は能動的にアクティブセッションを無効化しない。クライアントが次回同期時に欠如を検知する設計。

---

## 16. 地理計算（src/lib/geo.ts）

| 関数 | 内容 |
|---|---|
| `distanceKm(aLat,aLng,bLat,bLng)` | Haversine 公式。地球平均半径 R=6371km。大圏距離（km）。実距離表示・近接判定（0.5km=チャレンジ可、1.0km=activeNear）に使用。 |
| `roughDistance(...)` | 度ベースの高速近似（緯度コサイン補正）。可視スポットの近接ソート用（kmではない、相対比較のみ）。 |
| `bearingDeg(...)` | 方位角 0-360°（北=0°、時計回り）。ユーザー矢印・距離インジケータの回転に使用。 |

近接の主要閾値:

| 定数 | 値 |
|---|---|
| CHALLENGE_STEP_NEAR_RADIUS | 0.5 km（証拠写真ボタン有効） |
| CHALLENGE_STEP_ACTIVE_RADIUS | 1.0 km |
| 距離色: emerald / amber / 青 | ≤50m / ≤300m / それ以外 |

---

## 17. 環境変数・設定

| 環境変数 | 用途 | 未設定時の挙動 |
|---|---|---|
| `SUPABASE_URL` | Supabase エンドポイント | クラウド同期・アップロード無効（`enabled:false`） |
| `SUPABASE_SERVICE_ROLE_KEY` | サービスロールキー（サーバー専用） | 同上 |
| `GEMINI_API_KEY` | Gemini API | OpenAI → ルールベースへフォールバック |
| `OPENAI_API_KEY` | OpenAI API | ルールベース fallback |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS | Web Speech へフォールバック |
| `ELEVENLABS_VOICE_ID` | TTS voice 上書き | デフォルト Elli (`MF3mGyEYCl7XYWbV9V6O`) |
| `ELEVENLABS_MODEL_ID` | TTS model 上書き | デフォルト `eleven_multilingual_v2` |

主要設定定数:

| 定数 | 値 |
|---|---|
| SPOT_TTL_MS | 2,592,000,000（30日） |
| pushDebounceMs | 1500 |
| SNAPSHOT_ID | `user-self` |
| デフォルト現在地 | `{ lat: 35.6580, lng: 139.7514 }`（東京駅） |
| MAP_MOVEEND_THROTTLE | 60000ms |
| 場生成スロットル | 5分 / 500m |
| クエスト生成クールダウン | 30秒 |
| API_CALLS 保存期限 | 60日 |
| アクティビティ / メトリクス上限 | 各500件 |

Supabase クライアントは service-role キー使用・サーバーAPIルートのみ・`persistence:false, autoRefreshToken:false`（ステートレス）。`getSupabaseAdmin()` はシングルトン、`isSupabaseEnabled()` は環境変数を一度だけ評価（eager）。

---

## 18. 非機能要件・制約・既知の仮実装

### 18.1 仮実装（mock / fallback）

- **MockDatabase**: 本番DBではなく localStorage ベースのモック層。サーバーサイドでは全操作が no-op。
- **単一ユーザーデモ**: SNAPSHOT_ID は固定 `user-self`。マルチユーザー対応は認証統合＋ユーザー別スナップショットへのリファクタが必要。
- **FALLBACK_CURRENT_USER**: `db.getUser('user-self')` が null でもマイページ空白化を防ぐフォールバックユーザー（`{ id:'user-self', displayName:'あなた (巡礼者)', totalToku:0, currentTitle:'見習い巡礼者' }`）。
- **合成エージェント / 道案内の精霊**: 個別 Agent が無い場合の応答生成。
- **ルールベースクエスト / 応答**: AI API 無効時の最小限生成。

### 18.2 既知の制約・gotcha

- クラウド同期は best-effort（`pushNow()` はネットワークエラーを silent に捕捉、リトライなし）。Supabase ダウン時はローカルに保持。
- スポット TTL クリーンアップは `getSpots()` 読み取り時のみ（lazy）。読まなければ期限切れエントリが残存。
- `recalculateSpotCreator()` は UGC 投稿/いいね/取消ごとに O(n) 実行（バッチなし、インデックスなし）。高頻度の変更でスポット保存が繰り返される。
- `spotContrib` は累積・減算されない（UGC削除でも貢献度は下がらない）。
- `getSpotToku()` / `getTokuAtSpot()` は呼び出しごとに UGC から再計算（キャッシュなし）。
- TTS の `URL.createObjectURL` は `revokeObjectURL` されず長セッションでメモリリークの懸念。チャレンジ写真は dataURL 保存（dataURL が解放されずメモリリークリスク）。
- `getAllChallengePhotoUrls()` は O(n²)。トリビア検索はクライアント線形走査（全文インデックスなし、約1000件以上で影響）。
- `isSupabaseEnabled()` は eager 評価のため起動後の環境変数変更は反映されない。Supabase クライアントはシングルトンで自動再接続しない（プロセス再起動が必要）。
- `id` 接頭辞の不整合: `gps-` で始まる生成スポットは `isVerifiedSpot()`（`tk-` のみ未検証扱い）上で検証済みと判定される（§4.2・§12.3）。
- Blueprint の `runUpdate()` は先頭5スポット（各count=2）のみサンプリング。`/api/generate-quest` エラー時ドラフトは空のまま（自動リトライなし）。bonnou は常に0（将来の減算余地）。
- 徳は単調増加（減点・破産・リセット機構なし、管理ツールを除く）。
- カスケード削除に検証なし・Undo なし。ユーザー削除はアクティブセッションを即時無効化しない。
- ハイドレーション安全のため HomeTab は `mounted` state、`logActivity` は `typeof window !== 'undefined'` チェックで SSR を回避。
- CartoDB の attribution control は無効化されているため、ライセンス表記はアプリフッター等で別途必要。
- HomeTab の `joinable` フィルタは UI ボタンとして露出していない（FILTERS は todo/done のみ。v2 で削除された可能性のあるレガシー）。

---

## 19. 用語集

| 用語 | 定義 |
|---|---|
| 場（Spot） | 巡礼対象の場所（神社・寺院・公園等）。価値（enjoyments）と課題（issues）を持つ。 |
| 八百万神（Agent） | 各場に宿る AI 神格。Identity.md / Soul.md を持つ。 |
| アマテラス（DAINICHI / 大日） | すべての神の基底となる総本尊（emoji=☀️）。 |
| 徳（Toku） | ユーザーが行動で獲得する仮想ポイント。単調増加。 |
| 創世主（Creator） | 場で最も UGC由来の徳を稼ぎ tokuRequirement を満たしたユーザー。`creatorId` に格納。UGC変化のたび `recalculateSpotCreator()` で再計算（§6.7）。 |
| 場の活気（spotVitality） | `enjoyments.length − issues.length`。場の健全性指標。 |
| 人間の覚り（enlightenment） | ユーザーの累積徳（totalToku）。 |
| 世界の幸福（happiness） | `(totalValue − totalIssues) + totalToku`。 |
| 価値・課題ループ | 価値（enjoyments）を増やし課題（issues）を解決して vitality を高める中核メカニクス（§7.5）。 |
| クエスト（Quest / Challenge） | Task[] の集合。情報収集/理解判断/操作を最低1つずつ含む街歩きミッション。 |
| 三つの働き | sense（情報収集 👁️）/ understand（理解判断 🧠）/ act（操作 ✋）。 |
| 御朱印（Goshuin） | 各場への初回メッセージで付与される記念スタンプ。 |
| アイテム配達 | ある場で得た縁起物を別の場へ運び +25徳を得るスポット間連携メカニクス（§6.5）。 |
| 記念碑ランキング | スポット貢献度上位10名（UGC徳 + spotContrib、徳>0）。`getSpotRanking()`（§6.6）。 |
| インタラクティブカード | activeChallenge が無いとき地図下部に出る最寄り参加可能クエストのカード。 |
| 道案内の精霊 | クエスト進行を案内する専用エージェント（`agent-guide-spirit`）。 |
| 合成エージェント | 個別 Agent 不在時に Spot 情報のみで応答するエージェント（`agent-synthetic-*`）。 |
| 失効（Revocation） | 管理者削除によりユーザーを `yaorozu_revoked_users` に追加し再ログインを強制する処理。 |
| スナップショット | localStorage の16個の SYNC_KEYS をまとめた Supabase 同期単位（ID は `user-self`）。 |
| トリビア（TriviaEntry） | 町歩き蘊蓄DB（約1000件以上）。地形/歴史/建築/道路の4カテゴリ。SYNC対象外の純ローカルデータ。 |
| TTL | GPS生成スポットの30日有効期限（SPOT_TTL_MS）。`getSpots()` で期限切れを自動削除。 |
