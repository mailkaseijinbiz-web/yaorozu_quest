// 東京 街歩き豆知識データベース
// -----------------------------------------------------------------------------
// 「さんたつ by 散歩の達人」「note の #街歩き / #散歩 タグ」「各自治体・鉄道会社の
// ウォーキングマップ」「東京スリバチ学会（地形・歴史系）」といった情報源で語られる
// ような、マニアックな街の豆知識を構造化したデータセット。
//
// アプリ本体（src/lib/db.ts の Spot / UgcPost）とは疎結合な、純粋なデータファイル。
// 各 Trivia は「エリア軸（area）」と「テーマ軸（themes）」の両方でタグ付けされており、
// 多軸での検索・絞り込みができる。
// -----------------------------------------------------------------------------

import { distanceKm } from '../lib/geo';
import type { TriviaCategory } from './tasks';

/** エリア軸: 東京の街・地域単位のタグ */
export type TriviaArea =
  | '浅草'
  | '谷根千' // 谷中・根津・千駄木
  | '神楽坂'
  | '渋谷'
  | '四谷・赤坂'
  | '日本橋'
  | '上野'
  | '麻布・六本木'
  | '銀座'
  | '築地・月島'
  | '神田・お茶の水';

/** テーマ軸: 情報源で語られる視点・切り口のタグ */
export type TriviaTheme =
  | '地形・スリバチ' // 坂・凸凹・台地と谷
  | '暗渠・川跡' // 失われた川、用水路の跡
  | '坂道' // 名前の付いた坂
  | '歴史' // 江戸〜近代の出来事・人物
  | '路地裏' // 横丁・小道・抜け道
  | '地名の由来' // 町名・橋名の語源
  | '建築・遺構' // 近代建築、石垣、暗渠蓋など
  | 'ウォーキングコース'; // 自治体・鉄道会社のおすすめ歩行ルート的視点

/** 情報源の種別（提供してもらった参照元の分類に対応） */
export type TriviaSourceType =
  | 'さんたつ'
  | 'note街歩きタグ'
  | '自治体ウォーキングマップ'
  | '地形・歴史系サイト';

export interface TriviaSource {
  type: TriviaSourceType;
  /** 情報源の名称や運営主体（例: 「散歩の達人」「東京スリバチ学会」） */
  name: string;
  url?: string;
}

export interface Trivia {
  id: string;
  /** 豆知識のタイトル（一覧で見出しになる短い一文） */
  title: string;
  /** 豆知識の本文。散歩中に「へぇ」となる粒度で */
  body: string;
  area: TriviaArea;
  themes: TriviaTheme[];
  /** 最寄りの目印・ランドマーク（任意） */
  landmark?: string;
  /** おおよその位置（任意・地図表示用） */
  latitude?: number;
  longitude?: number;
  /** 散歩中の楽しみ方・観察ポイント */
  walkTips: string[];
  /** どの種別の情報源で語られがちか */
  sources: TriviaSource[];
}

// -----------------------------------------------------------------------------
// 情報源マスタ（提供してもらった4つの参照元）
// -----------------------------------------------------------------------------
export const TRIVIA_SOURCES: Record<TriviaSourceType, TriviaSource> = {
  さんたつ: {
    type: 'さんたつ',
    name: 'さんたつ by 散歩の達人',
    url: 'https://san-tatsu.jp/',
  },
  note街歩きタグ: {
    type: 'note街歩きタグ',
    name: 'note「#街歩き」「#散歩」タグ',
    url: 'https://note.com/hashtag/街歩き',
  },
  自治体ウォーキングマップ: {
    type: '自治体ウォーキングマップ',
    name: '各自治体・鉄道会社のウォーキングマップ',
  },
  '地形・歴史系サイト': {
    type: '地形・歴史系サイト',
    name: '東京スリバチ学会 ほか地形・歴史系サイト',
    url: 'https://misadventures.exblog.jp/',
  },
};

// -----------------------------------------------------------------------------
// 豆知識データ
// -----------------------------------------------------------------------------
export const TOKYO_TRIVIA: Trivia[] = [
  {
    id: 'trivia-sendagi-yabita',
    title: '谷中・根津・千駄木は「谷」と「台」が織りなすスリバチ地形',
    body: '谷根千（やねせん）の「根津」は谷底の低地、「千駄木」「谷中」は本郷台・上野台の縁にあたる。藍染川（あいぞめがわ）が削った谷に沿って暗渠が走り、台地に登る無数の階段や坂が、東京スリバチ学会が好む典型的な凸凹地形をつくっている。',
    area: '谷根千',
    themes: ['地形・スリバチ', '暗渠・川跡', '坂道'],
    landmark: 'へび道（藍染川暗渠）',
    latitude: 35.7256,
    longitude: 139.7649,
    walkTips: [
      'くねくねと蛇行する「へび道」は、暗渠化された藍染川の流路をそのままなぞった道',
      '谷から台地へ登る階段の途中で振り返ると、谷底に向かって家並みが下っていくのが見える',
    ],
    sources: [TRIVIA_SOURCES['地形・歴史系サイト'], TRIVIA_SOURCES.さんたつ],
  },
  {
    id: 'trivia-yanaka-snak',
    title: '谷中銀座の「夕やけだんだん」は台地の縁に刻まれた階段',
    body: '谷中銀座商店街の東端にある階段「夕やけだんだん」は、上野台地の縁（崖線）に位置する。夕日が商店街の正面に沈むことからこの名が付き、地形フェチには台地と谷の境界を体感できる名所として知られる。',
    area: '谷根千',
    themes: ['地形・スリバチ', '坂道', '路地裏'],
    landmark: '夕やけだんだん',
    latitude: 35.7276,
    longitude: 139.7666,
    walkTips: [
      '階段の上から商店街を見下ろすと、谷に向かって店が連なる「スリバチの底」が一望できる',
      '夕方に訪れると、名前の由来どおり商店街の奥に夕日が落ちる',
    ],
    sources: [TRIVIA_SOURCES.さんたつ, TRIVIA_SOURCES.note街歩きタグ],
  },
  {
    id: 'trivia-kagurazaka-slope',
    title: '神楽坂は「坂を上がる花街」、石畳の路地に黒塀が残る',
    body: '神楽坂は飯田橋から市谷方面へ登る坂そのものが街の名になっている。坂上の台地と神田川の谷をつなぐ斜面に、かつての花街の名残である石畳の路地・黒塀・料亭が密集。表通りから一本入ると迷路のような兵庫横丁・かくれんぼ横丁が広がる。',
    area: '神楽坂',
    themes: ['坂道', '路地裏', '歴史', '地名の由来'],
    landmark: '兵庫横丁',
    latitude: 35.7016,
    longitude: 139.7407,
    walkTips: [
      '昼と夜で人通りが一変するため、石畳の風情を味わうなら夕暮れどき',
      '「かくれんぼ横丁」はその名の通り、追っ手をまける路地として遊ばれたという由来をたどる',
    ],
    sources: [TRIVIA_SOURCES.さんたつ, TRIVIA_SOURCES.note街歩きタグ],
  },
  {
    id: 'trivia-shibuya-river',
    title: '渋谷は文字どおり「谷」、複数の川が刻んだスリバチの底',
    body: '渋谷駅一帯は宇田川・渋谷川などが集まる谷底で、駅から四方どこへ向かっても上り坂になる。道玄坂・宮益坂・スペイン坂など坂名が多いのは典型的なスリバチ地形ゆえ。宇田川は暗渠化され、センター街の地下を流れている。',
    area: '渋谷',
    themes: ['地形・スリバチ', '暗渠・川跡', '坂道', '地名の由来'],
    landmark: '宮益坂・道玄坂',
    latitude: 35.6595,
    longitude: 139.7005,
    walkTips: [
      '駅前スクランブルから宮益坂・道玄坂のどちらを向いても上り坂になるのを体感する',
      'センター街の地下には暗渠化された宇田川が流れていることを意識して歩く',
    ],
    sources: [TRIVIA_SOURCES['地形・歴史系サイト'], TRIVIA_SOURCES.さんたつ],
  },
  {
    id: 'trivia-yotsuya-samegahashi',
    title: '四谷の「鮫河橋（さめがはし）」、今は消えた川と谷の記憶',
    body: '四谷から信濃町にかけての低地は、かつて鮫河（さめがわ）が流れる谷だった。川は暗渠化されて地名と橋名にのみ残る。周囲の須賀町・若葉町は台地の縁に張り付き、急な階段や「暗闇坂」など雰囲気のある坂が点在する。',
    area: '四谷・赤坂',
    themes: ['暗渠・川跡', '地名の由来', '坂道', '歴史'],
    landmark: '須賀神社の階段',
    latitude: 35.6862,
    longitude: 139.7196,
    walkTips: [
      '須賀神社へ上る石段は、アニメの舞台としても知られ台地と谷の高低差がよくわかる',
      '橋がないのに「〜橋」という地名が残っていたら、暗渠になった川のサインと考える',
    ],
    sources: [TRIVIA_SOURCES['地形・歴史系サイト'], TRIVIA_SOURCES.note街歩きタグ],
  },
  {
    id: 'trivia-azabu-juban-tani',
    title: '麻布十番は谷底の街、「暗闇坂」「狸穴坂」など坂名の宝庫',
    body: '麻布一帯は台地と谷が複雑に入り組み、麻布十番はその谷底にあたる。周囲には暗闇坂・狸穴坂（まみあなざか）・鳥居坂・大黒坂など、由来のある坂が驚くほど密集。坂の名前を辿るだけで江戸の地形と暮らしが見えてくる。',
    area: '麻布・六本木',
    themes: ['地形・スリバチ', '坂道', '地名の由来', '歴史'],
    landmark: '暗闇坂',
    latitude: 35.6556,
    longitude: 139.7363,
    walkTips: [
      '坂の下に建つ「坂の説明柱」を読み比べて、名前の由来をコレクションする',
      '十番の谷底から見上げると、四方の台地にビルやマンションが建ち並ぶスリバチ構造がわかる',
    ],
    sources: [TRIVIA_SOURCES['地形・歴史系サイト'], TRIVIA_SOURCES.さんたつ],
  },
  {
    id: 'trivia-nihonbashi-zero',
    title: '日本橋の橋上には「日本国道路元標」、全国の道はここが起点',
    body: '日本橋は五街道の起点として徳川家康が定めた地点で、現在も橋の中央に「日本国道路元標」が埋め込まれている。国道1号をはじめ多くの国道の距離がここを0kmとして測られる。橋の上を覆う首都高は地下化が進行中。',
    area: '日本橋',
    themes: ['歴史', '建築・遺構', '地名の由来'],
    landmark: '日本橋（道路元標）',
    latitude: 35.6837,
    longitude: 139.7745,
    walkTips: [
      '橋の中央車道に埋め込まれた元標は危険なので、橋の袂にある「複製プレート」で確認する',
      '橋の青銅製の麒麟・獅子像など、装飾の意味を観察する',
    ],
    sources: [TRIVIA_SOURCES.自治体ウォーキングマップ, TRIVIA_SOURCES.さんたつ],
  },
  {
    id: 'trivia-asakusa-rokku',
    title: '浅草「六区」は娯楽街の番地、興行の街として栄えた名残',
    body: '浅草寺の西側に広がる「浅草六区（ろっく）」は、明治期に浅草公園が7つの区画に整理された際の第六区にあたる。映画館・演芸場・見世物小屋が集まる日本有数の興行街となり、エノケンや萩本欽一らが育った。今も演芸ホールや演劇の灯が残る。',
    area: '浅草',
    themes: ['歴史', '地名の由来', '路地裏'],
    landmark: '浅草六区ブロードウェイ',
    latitude: 35.7148,
    longitude: 139.7945,
    walkTips: [
      '通りに埋め込まれた往年のスター名のプレートを辿って歩く',
      '仲見世の喧騒から一本西へ抜けると、興行街だった独特の路地空気が残る',
    ],
    sources: [TRIVIA_SOURCES.さんたつ, TRIVIA_SOURCES.note街歩きタグ],
  },
  {
    id: 'trivia-ueno-shinobazu',
    title: '不忍池は上野台と本郷台に挟まれた、かつての入り江の名残',
    body: '上野の不忍池（しのばずのいけ）は、縄文海進の頃に入り込んでいた海（古入り江）が取り残されてできた池とされる。上野の山（上野台）と本郷台地に挟まれた低地に水が溜まったもので、周囲の地形を読むと台地と谷の関係がはっきり見える。',
    area: '上野',
    themes: ['地形・スリバチ', '歴史', '建築・遺構'],
    landmark: '不忍池',
    latitude: 35.7128,
    longitude: 139.7702,
    walkTips: [
      '上野の山側から池へ下る坂の角度に注目し、台地の縁（崖線）を体感する',
      '弁天島の弁天堂は水辺信仰の名残として観察する',
    ],
    sources: [TRIVIA_SOURCES['地形・歴史系サイト'], TRIVIA_SOURCES.自治体ウォーキングマップ],
  },
  {
    id: 'trivia-ginza-bricktown',
    title: '銀座は「銀貨の鋳造所」が由来、煉瓦街として近代化の先頭に',
    body: '「銀座」の名は江戸時代に銀貨を鋳造・管理する役所（銀座役所）が置かれたことに由来する。明治の大火後、銀座はいち早く煉瓦造りの街並みに再建され、ガス灯・街路樹が並ぶ文明開化の象徴となった。今も数寄屋橋・新橋など旧地名に水運の痕跡が残る。',
    area: '銀座',
    themes: ['地名の由来', '歴史', '建築・遺構'],
    landmark: '銀座発祥の地碑',
    latitude: 35.6717,
    longitude: 139.7650,
    walkTips: [
      '「数寄屋橋」「新橋」など橋の名が交差点名に残るのは、埋め立てられた堀のサイン',
      '銀座二丁目にある「銀座発祥の地」碑で名の由来を確認する',
    ],
    sources: [TRIVIA_SOURCES.さんたつ, TRIVIA_SOURCES.自治体ウォーキングマップ],
  },
  {
    id: 'trivia-tsukishima-monja',
    title: '月島は明治の埋立地、碁盤目の路地に長屋ともんじゃが残る',
    body: '月島は明治期に隅田川河口を埋め立ててできた人工島で、「築（つき）島」が名の由来とも言われる。計画的な碁盤目状の街区の間に「路地（ろじ）」と呼ばれる細い生活路が走り、下町長屋の暮らしと、駄菓子屋文化から生まれたもんじゃ焼きが今も息づく。',
    area: '築地・月島',
    themes: ['歴史', '路地裏', '地名の由来'],
    landmark: '月島西仲通り（もんじゃストリート）',
    latitude: 35.6645,
    longitude: 139.7833,
    walkTips: [
      'もんじゃストリートから直角に伸びる「路地」へ入り、井戸や長屋の残る生活空間を覗く',
      '埋立地ゆえの平坦さと、まっすぐな街区の幾何学を意識して歩く',
    ],
    sources: [TRIVIA_SOURCES.さんたつ, TRIVIA_SOURCES.note街歩きタグ],
  },
  {
    id: 'trivia-yanaka-teramachi',
    title: '谷中が寺町になったのは、明暦の大火後の幕府の都市計画',
    body: '谷中が日本有数の寺町になったのは江戸幕府の政策ゆえ。明暦の大火（1657年）の後、防災と寛永寺の防衛を兼ねて多くの寺院がこの台地へ移転させられ、今も約70の寺が密集している。',
    area: '谷根千',
    themes: ['歴史', '路地裏', '建築・遺構'],
    landmark: '谷中の寺町通り',
    latitude: 35.7252,
    longitude: 139.7672,
    walkTips: [
      '寺の門前の由緒書きから「移転」「明暦」の文字を探す',
      '塀越しに連なる本堂の屋根を数えて、寺町の密度を体感する',
    ],
    sources: [TRIVIA_SOURCES['地形・歴史系サイト'], TRIVIA_SOURCES.さんたつ],
  },
  {
    id: 'trivia-kagurazaka-name',
    title: '「神楽坂」の名は、坂に響いた祭礼の神楽の音から',
    body: '神楽坂の名は、坂の途中にあった八幡宮の御旅所で祭礼のたびに神楽を奏で、その音が坂じゅうに響いたことに由来すると伝わる。坂の名がそのまま街の名になった珍しい例。',
    area: '神楽坂',
    themes: ['地名の由来', '坂道', '歴史'],
    landmark: '神楽坂下交差点',
    latitude: 35.7019,
    longitude: 139.7404,
    walkTips: [
      '坂下の標柱で「神楽坂」の由来書きを読む',
      '坂を登りながら、神楽の音がどこまで届いたか想像してみる',
    ],
    sources: [TRIVIA_SOURCES.さんたつ, TRIVIA_SOURCES.自治体ウォーキングマップ],
  },
  {
    id: 'trivia-kagurazaka-crank',
    title: '神楽坂のクランク路地は、花街の心遣いが残した形',
    body: '神楽坂の路地には、わざと直角に折れ曲がる「クランク」が多い。城下町の防衛の意図に加え、花街で客同士が正面から鉢合わせしないようにという配慮の名残とも言われる。',
    area: '神楽坂',
    themes: ['路地裏', '歴史', '建築・遺構'],
    landmark: '兵庫横丁・かくれんぼ横丁',
    latitude: 35.7022,
    longitude: 139.7396,
    walkTips: [
      '兵庫横丁で直角に折れる石畳の角を探す',
      '黒塀の路地で、先が見通せない曲がりの効き目を体感する',
    ],
    sources: [TRIVIA_SOURCES.note街歩きタグ, TRIVIA_SOURCES.さんたつ],
  },
  {
    id: 'trivia-ochanomizu-sendaibori',
    title: 'お茶の水の深い谷は人工の運河、別名「仙台堀」',
    body: 'お茶の水駅前を流れる神田川の深い谷は自然の谷ではない。江戸初期に本郷台地を人工的に掘り割って通した運河で、伊達政宗率いる仙台藩が工事を担ったため「仙台堀」とも呼ばれる。',
    area: '神田・お茶の水',
    themes: ['地形・スリバチ', '歴史', '建築・遺構'],
    landmark: '聖橋',
    latitude: 35.6997,
    longitude: 139.7656,
    walkTips: [
      '聖橋の上から谷を見下ろし、人力で掘った深さを実感する',
      '両岸の崖の高さを見比べて、台地が切り分けられた跡を読む',
    ],
    sources: [TRIVIA_SOURCES['地形・歴史系サイト'], TRIVIA_SOURCES.さんたつ],
  },
  {
    id: 'trivia-ochanomizu-name',
    title: '「御茶ノ水」は、将軍に献上したお茶の水が湧いた地',
    body: '徳川家康が江戸に入った頃、神田明神近くの高林寺の境内から湧く水で点てた茶をたいそう気に入り、毎日献上させたことから「お茶の水」と呼ばれるようになったと伝わる。',
    area: '神田・お茶の水',
    themes: ['地名の由来', '歴史'],
    landmark: '御茶ノ水駅',
    latitude: 35.6993,
    longitude: 139.7651,
    walkTips: [
      '駅周辺で「お茶の水」由来の碑や説明板を探す',
      '台地の縁の段差を観察し、湧水が出そうな地形を読む',
    ],
    sources: [TRIVIA_SOURCES.さんたつ, TRIVIA_SOURCES.自治体ウォーキングマップ],
  },
  {
    id: 'trivia-kanda-myojin',
    title: '神田明神は江戸総鎮守、平将門を裏鬼門に祀る',
    body: '江戸総鎮守の神田明神は、徳川家康が関ヶ原の戦いの前に戦勝祈願し勝利したことから徳川家に篤く崇敬された。祭神の平将門は、江戸を守る神として城の裏鬼門の方角に祀られている。',
    area: '神田・お茶の水',
    themes: ['歴史', '建築・遺構', '地名の由来'],
    landmark: '神田明神',
    latitude: 35.7019,
    longitude: 139.7679,
    walkTips: [
      '随神門の極彩色の彫刻を見上げて意匠を観察する',
      '境内の高さから、湯島の台地の縁に建つ立地を体感する',
    ],
    sources: [TRIVIA_SOURCES['地形・歴史系サイト'], TRIVIA_SOURCES.さんたつ],
  },
  {
    id: 'trivia-roppongi-name',
    title: '「六本木」の由来は6本の大木か、「木」の付く6大名か',
    body: '六本木の名には、かつて6本の大木（松など）があったという説と、青木・一柳・上杉・片桐・朽木・脇坂という「木」の字を名に持つ6家の大名屋敷が集まっていたという説がある。',
    area: '麻布・六本木',
    themes: ['地名の由来', '歴史'],
    landmark: '六本木交差点',
    latitude: 35.6627,
    longitude: 139.7315,
    walkTips: [
      '街の中で「木」にちなむ地名・坂名・店名を探してみる',
      '大名屋敷の名残である広い区画や長い塀の跡を観察する',
    ],
    sources: [TRIVIA_SOURCES.note街歩きタグ, TRIVIA_SOURCES['地形・歴史系サイト']],
  },
  {
    id: 'trivia-azabudai-gazenbo',
    title: '麻布台ヒルズの足元には「我善坊谷」という谷底の街があった',
    body: '麻布台ヒルズが建つ一帯は、かつて「我善坊谷（がぜんぼうだに）」と呼ばれた深い谷底の街。すり鉢の底のような地形に木造住宅と袋小路がひしめく、江戸から続く谷の暮らしがあった。',
    area: '麻布・六本木',
    themes: ['地形・スリバチ', '歴史', '地名の由来'],
    landmark: '麻布台ヒルズ',
    latitude: 35.6601,
    longitude: 139.7448,
    walkTips: [
      '麻布台ヒルズの足元で、周囲の台地との高低差を見上げる',
      '谷へ下る坂の急さから、すり鉢地形の深さを体感する',
    ],
    sources: [TRIVIA_SOURCES['地形・歴史系サイト'], TRIVIA_SOURCES.note街歩きタグ],
  },
  {
    id: 'trivia-tsukiji-name',
    title: '築地とは文字どおり「地を築いた」埋立の地',
    body: '築地は明暦の大火（1657年）で焼失した浅草御坊（現・築地本願寺）を再建するため、幕府が隅田川の河口を埋め立てて造った土地。「地を築く」という地名がその成り立ちを今に伝える。',
    area: '築地・月島',
    themes: ['地名の由来', '歴史', '建築・遺構'],
    landmark: '築地本願寺',
    latitude: 35.6655,
    longitude: 139.7707,
    walkTips: [
      '築地本願寺の古代インド様式の石造伽藍を正面から見上げる',
      '平坦でまっすぐな道筋に、埋立地ならではの計画性を読む',
    ],
    sources: [TRIVIA_SOURCES.さんたつ, TRIVIA_SOURCES.自治体ウォーキングマップ],
  },
  {
    id: 'trivia-tsukuda-sumiyoshi',
    title: '佃島は大阪の漁師が築いた島、佃煮と住吉神社が残る',
    body: '佃島は、徳川家康が摂津国佃村（現・大阪市）の漁師たちを江戸へ呼び寄せ、漁業特権を与えて埋め立てさせた人工島。彼らの保存食が「佃煮」の始まりで、故郷から分霊した住吉神社が島を見守る。',
    area: '築地・月島',
    themes: ['歴史', '地名の由来', '路地裏'],
    landmark: '住吉神社（佃）',
    latitude: 35.6677,
    longitude: 139.7852,
    walkTips: [
      '住吉神社の鳥居に掲げられた陶製の扁額を見上げる',
      '路地の奥に残る船溜まりと赤い佃小橋を探す',
    ],
    sources: [TRIVIA_SOURCES.さんたつ, TRIVIA_SOURCES.note街歩きタグ],
  },
  {
    id: 'trivia-akasaka-hikawa',
    title: '赤坂氷川神社の周辺は、台地と谷が入り組む大名屋敷の跡',
    body: '赤坂・六本木一帯はかつて大名屋敷が並ぶ高台で、その縁を縫うように谷と坂が走る。赤坂氷川神社の周囲には、転坂（ころびざか）・三分坂（さんぷんざか）など由来を持つ坂が点在し、勝海舟邸跡など幕末史の舞台も近い。',
    area: '四谷・赤坂',
    themes: ['坂道', '歴史', '地形・スリバチ', '建築・遺構'],
    landmark: '赤坂氷川神社',
    latitude: 35.6713,
    longitude: 139.7370,
    walkTips: [
      '「三分坂」は急坂ゆえ荷車を押す駄賃が三分（さんぷん）増したことが由来とされる',
      '氷川神社の社叢（しゃそう）は都心に残る貴重な緑として観察する',
    ],
    sources: [TRIVIA_SOURCES['地形・歴史系サイト'], TRIVIA_SOURCES.自治体ウォーキングマップ],
  },
];

// -----------------------------------------------------------------------------
// 検索・絞り込みヘルパー
// -----------------------------------------------------------------------------

/** テーマ軸を Task.triviaCategory（地形/歴史/建築/道路）へ寄せる */
export const THEME_TO_CATEGORY: Record<TriviaTheme, TriviaCategory> = {
  '地形・スリバチ': '地形',
  '暗渠・川跡': '地形',
  坂道: '道路',
  歴史: '歴史',
  路地裏: '道路',
  '地名の由来': '歴史',
  '建築・遺構': '建築',
  ウォーキングコース: '道路',
};

/** エリアで絞り込む */
export function getTriviaByArea(area: TriviaArea): Trivia[] {
  return TOKYO_TRIVIA.filter((t) => t.area === area);
}

/** テーマで絞り込む（指定テーマを含むものすべて） */
export function getTriviaByTheme(theme: TriviaTheme): Trivia[] {
  return TOKYO_TRIVIA.filter((t) => t.themes.includes(theme));
}

/** エリア×テーマの多軸で絞り込む */
export function getTriviaByAreaAndTheme(area: TriviaArea, theme: TriviaTheme): Trivia[] {
  return TOKYO_TRIVIA.filter((t) => t.area === area && t.themes.includes(theme));
}

/** 情報源の種別で絞り込む */
export function getTriviaBySourceType(type: TriviaSourceType): Trivia[] {
  return TOKYO_TRIVIA.filter((t) => t.sources.some((s) => s.type === type));
}

/**
 * 座標近傍の豆知識を距離昇順で返す。
 * クエスト生成（実在素材のプロンプト注入）・蘊蓄バックフィル・道中案内の共通素材取得。
 */
export function getTriviaNear(lat: number, lng: number, radiusKm = 5, limit = 3): Trivia[] {
  return TOKYO_TRIVIA
    .filter((t) => t.latitude != null && t.longitude != null)
    .map((t) => ({ t, d: distanceKm(lat, lng, t.latitude!, t.longitude!) }))
    .filter((x) => x.d <= radiusKm)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.t);
}

/** タイトル・本文・ランドマークを横断するキーワード検索 */
export function searchTrivia(keyword: string): Trivia[] {
  const q = keyword.trim().toLowerCase();
  if (!q) return TOKYO_TRIVIA;
  return TOKYO_TRIVIA.filter((t) =>
    [t.title, t.body, t.landmark ?? '', ...t.walkTips].join('\n').toLowerCase().includes(q),
  );
}

/** 全エリアの一覧（UI のタブ・フィルタ生成用） */
export const TRIVIA_AREAS: TriviaArea[] = Array.from(
  new Set(TOKYO_TRIVIA.map((t) => t.area)),
);

/** 全テーマの一覧（UI のタグフィルタ生成用） */
export const TRIVIA_THEMES: TriviaTheme[] = Array.from(
  new Set(TOKYO_TRIVIA.flatMap((t) => t.themes)),
);
