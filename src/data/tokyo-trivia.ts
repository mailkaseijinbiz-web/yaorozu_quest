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
  | '築地・月島';

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
