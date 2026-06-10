// 町歩き観察ミッションカタログ
// -----------------------------------------------------------------------------
// 「歩くからこそ気づく」観察ミッションの実在知識付きカタログ。
// ルールベースのクエスト生成（quest-fallback）・周遊プラン・道中案内が共用する。
// trivia（蘊蓄）→ action（観察指示）が一続きで読める文章設計にしてある
// （MapTab の composeGuideText が trivia + action を連結して精霊のフキダシに出すため）。
// 文字数の上限: title 40字 / action 120字 / trivia 140字（coerceTask の制限に合わせる）。
// -----------------------------------------------------------------------------

import type { TriviaCategory } from './tasks';

/** ミッションの適用先。shrine=神社境内 / temple=寺院境内 / precinct=寺社共通の境内 / street=道中 */
export type WalkScope = 'shrine' | 'temple' | 'precinct' | 'street';

export interface WalkMission {
  id: string;
  appliesTo: WalkScope;
  /** タスク見出し（≤40字） */
  title: string;
  /** 体を使う観察指示（≤120字）。「探す/見上げる/数える/見比べる/耳を澄ます」 */
  action: string;
  /** 行くと確かめられる蘊蓄（≤140字）。action とセットで読める文に */
  trivia: string;
  triviaCategory: TriviaCategory;
  /** 写真ミッションにするか */
  photo?: boolean;
}

export const WALK_MISSIONS: WalkMission[] = [
  // ── 神社（shrine） ──
  {
    id: 'sm-seichu',
    appliesTo: 'shrine',
    title: '参道の端を歩いて敬意を示す',
    trivia: '参道の真ん中は「正中（せいちゅう）」と呼ばれ、神様の通り道とされる。参拝者が左右の端に寄って歩くのは、神様に道を譲る昔ながらの作法。',
    action: '参道では真ん中を譲り、左右どちらかの端をゆっくり歩いてみよう。歩くうちに気持ちが切り替わるのを感じてみて。',
    triviaCategory: '歴史',
  },
  {
    id: 'sm-komainu',
    appliesTo: 'shrine',
    title: '狛犬の阿吽と個性をくらべる',
    trivia: '狛犬は向かって右が口を開いた「阿」、左が結んだ「吽」。造形は神社ごとに個性があり、マッチョなもの、笑うもの、子を抱くものまでさまざま。',
    action: '左右の狛犬の口元と表情を見比べて、この神社ならではの「推し狛犬」を一枚撮ろう。',
    triviaCategory: '建築',
    photo: true,
  },
  {
    id: 'sm-torii',
    appliesTo: 'shrine',
    title: '鳥居の形と素材を見分ける',
    trivia: '鳥居には大きく、直線的で簡素な「神明系」と、上の笠木が反り上がる「明神系」がある。形や素材から、祀られた神様の系統が読み取れることも。',
    action: '鳥居の前で足を止め、笠木が反っているか直線か、石か木か朱塗りかを観察してみよう。',
    triviaCategory: '建築',
  },
  {
    id: 'sm-temizu',
    appliesTo: 'shrine',
    title: '手水舎の吐水口を観察する',
    trivia: '手水舎の水の吹き出し口は龍が多い。龍は水を司る神獣とされるからで、なかには亀や兎など変わり種の神社もある。',
    action: '手水舎の吹き出し口が何の生き物かを確かめてから、左手→右手→口の順で清めてみよう。',
    triviaCategory: '建築',
  },
  {
    id: 'sm-sessha',
    appliesTo: 'shrine',
    title: '境内の摂社・末社を数える',
    trivia: '境内の小さなお社は「摂社・末社」。本殿の神様と縁の深い神々が祀られ、その数や顔ぶれに土地の信仰の歴史が表れる。',
    action: '境内の隅々を歩いて小さなお社を数え、どんな神様が祀られているか名前を読んでみよう。',
    triviaCategory: '歴史',
  },
  {
    id: 'sm-saijin',
    appliesTo: 'shrine',
    title: '由緒書きでご祭神の物語を知る',
    trivia: '神社が「いつ、誰のために」建てられたかは由緒書きに記されている。ご祭神の物語を知ると、ただの建物が物語のある場所に変わる。',
    action: '由緒書きや案内板を探して、ご祭神の名前と創建の年を見つけよう。',
    triviaCategory: '歴史',
  },
  {
    id: 'sm-omikuji',
    appliesTo: 'shrine',
    title: '変わりおみくじ・授与品を探す',
    trivia: '鳩や狐、だるまなど、土地や祭神にちなんだ形の「変わりおみくじ」を置く神社が増えている。御朱印も季節で意匠が変わることがある。',
    action: '授与所のあたりで、この神社ならではのおみくじや御朱印・授与品を探してみよう。',
    triviaCategory: '歴史',
  },
  // ── 寺院（temple） ──
  {
    id: 'tm-sango',
    appliesTo: 'temple',
    title: '山門の扁額から山号を読む',
    trivia: '寺の正式名には「◯◯山」という山号が付く。山門の扁額に掲げられていることが多く、寺の由緒や立地を映している。',
    action: '山門を見上げて扁額の文字を読み、この寺の山号を見つけよう。',
    triviaCategory: '建築',
  },
  {
    id: 'tm-sekibutsu',
    appliesTo: 'temple',
    title: '石仏の表情を見比べる',
    trivia: '境内の石仏やお地蔵さまは、一体ずつ表情が違う。長年の風雨で丸くなった顔立ちには、彫られた時代と人々の祈りが刻まれている。',
    action: '石仏やお地蔵さまの顔を見比べて、いちばん心に残る表情を一枚に収めよう。',
    triviaCategory: '建築',
    photo: true,
  },
  {
    id: 'tm-koro',
    appliesTo: 'temple',
    title: '香炉の煙で身を清める',
    trivia: '本堂前の大きな香炉の煙は「身体の良くしたいところに当てると御利益がある」と親しまれてきた。香りには場を清める意味もある。',
    action: '香炉のそばで立ち止まり、煙の流れと香りをしばらく感じてみよう。',
    triviaCategory: '歴史',
  },
  {
    id: 'tm-shoro',
    appliesTo: 'temple',
    title: '鐘楼と時の鐘を探す',
    trivia: '寺の鐘はかつて「時の鐘」として町に時刻を知らせ、暮らしを支えた。鐘楼の構えや鐘の大きさには寺の歴史が表れる。',
    action: '境内で鐘楼を探し、鐘の大きさや表面に鋳込まれた文字を観察してみよう。',
    triviaCategory: '建築',
  },
  {
    id: 'tm-jimon',
    appliesTo: 'temple',
    title: '瓦や幕から寺紋を探す',
    trivia: '寺にも家紋のような「寺紋」がある。屋根瓦や幕、賽銭箱に刻まれていて、宗派や開基した一族との縁を物語る。',
    action: '屋根瓦・幕・賽銭箱から同じ紋を探して、この寺の寺紋を見つけよう。',
    triviaCategory: '建築',
  },
  // ── 寺社共通の境内（precinct） ──
  {
    id: 'pc-shinboku',
    appliesTo: 'precinct',
    title: 'ご神木を見上げて一枚撮る',
    trivia: '境内の大木（ご神木）は、何百年もこの土地を見守ってきた生き証人。幹の太さは、この場所の歴史の長さそのもの。',
    action: '境内でいちばんの大木を見上げ、そっと幹に手を当ててから、その姿を一枚に収めよう。',
    triviaCategory: '歴史',
    photo: true,
  },
  {
    id: 'pc-nengo',
    appliesTo: 'precinct',
    title: '境内最古の年号を探す',
    trivia: '鳥居や灯篭、石碑には奉納された年号が刻まれている。「文化」「天保」など江戸の元号が見つかれば、その石はゆうに150歳を超えている。',
    action: '石造物の足元や側面の年号を読み比べ、境内でいちばん古い年号を探し出そう。',
    triviaCategory: '歴史',
  },
  {
    id: 'pc-toro',
    appliesTo: 'precinct',
    title: '灯篭の寄進者名を読む',
    trivia: '灯篭や玉垣に刻まれた名前は、かつての寄進者たちの記録。町の商店や講の名が並び、この場を支えてきた人々の存在を伝える。',
    action: '灯篭や玉垣に刻まれた名前を読み、どんな人たちがこの場を支えたのか想像してみよう。',
    triviaCategory: '歴史',
  },
  {
    id: 'pc-kukan',
    appliesTo: 'precinct',
    title: '参道の「空間の切り替わり」を感じる',
    trivia: '鳥居や山門から本殿までの参道は、日常から神聖な場所へ気持ちを切り替える装置として設計されている。木々や曲がり、石段がその仕掛け。',
    action: '入口で一度立ち止まり、本殿へ歩きながら音・光・空気がどこで変わるかを感じてみよう。',
    triviaCategory: '建築',
  },
  {
    id: 'pc-mimi',
    appliesTo: 'precinct',
    title: '30秒、境内の音に耳を澄ます',
    trivia: '境内は町なかの「静けさの島」。木々が音を吸い、一歩入るだけで車の音が遠のく。昔の人も同じ静けさの中で祈っていた。',
    action: '境内の木陰で30秒だけ目を閉じ、聞こえる音をひとつずつ数えてみよう。',
    triviaCategory: '歴史',
  },
  // ── 道中（street） ──
  {
    id: 'st-saka',
    appliesTo: 'street',
    title: '坂の名前と由来を探す',
    trivia: '東京の坂の多くには名前と物語がある。坂下や坂上に立つ標柱には、名の由来やかつての風景が書かれていることが多い。',
    action: '道中の坂で名前の標柱を探し、由来を読んでみよう。なければ自分で坂に名前を付けてみるのも一興。',
    triviaCategory: '道路',
  },
  {
    id: 'st-ankyo',
    appliesTo: 'street',
    title: '暗渠のサインを見つける',
    trivia: '不自然に蛇行する細い道、橋がないのに「◯◯橋」と残る交差点名、連なる車止め——どれも暗渠（地下に隠れた川）のサイン。',
    action: '歩きながら、くねる路地や「橋」の付く地名を探して、消えた川の流れを推理してみよう。',
    triviaCategory: '地形',
  },
  {
    id: 'st-kanban',
    appliesTo: 'street',
    title: '看板建築を見上げて一枚撮る',
    trivia: '古い商店街には、木造の建物の正面だけを銅板やタイルで洋風に飾った「看板建築」が残る。関東大震災の復興期に生まれた東京らしい建築。',
    action: '通り沿いの建物の2階から上を見上げて、正面だけ装飾された看板建築を探して一枚撮ろう。',
    triviaCategory: '建築',
    photo: true,
  },
  {
    id: 'st-sento',
    appliesTo: 'street',
    title: '銭湯の煙突を探す',
    trivia: '銭湯は街の社交場だった。宮造りの屋根と高い煙突が目印で、煙突が見えたら、そこに昔ながらの暮らしが残っている証拠。',
    action: '屋根並みの向こうに高い煙突が立っていないか、ときどき遠くへ目をやってみよう。',
    triviaCategory: '建築',
  },
  {
    id: 'st-sekizo',
    appliesTo: 'street',
    title: '道端の庚申塔・お地蔵さまを探す',
    trivia: '道端の庚申塔やお地蔵さまは、江戸の人々が旅の安全や厄除けを祈った跡。古くからの道であるほど、こうした石造物が残っている。',
    action: '交差点の角や塀の際に、小さな祠や石塔がないか目を配ってみよう。見つけたら軽く合掌。',
    triviaCategory: '歴史',
  },
  {
    id: 'st-chikei',
    appliesTo: 'street',
    title: '足で台地と谷を読む',
    trivia: '東京は台地と谷が入り組む凸凹の街。上り坂は台地へ、下り坂はかつての川の谷へ向かうサイン。自分の足の感覚がいちばんの地形計。',
    action: '歩きながら上り下りを意識して、いま自分が台地と谷のどちらにいるかを当ててみよう。',
    triviaCategory: '地形',
  },
  {
    id: 'st-roji',
    appliesTo: 'street',
    title: '一本裏の路地に入ってみる',
    trivia: '表通りの一本裏には、昔ながらの街並みや暮らしの気配が残っていることが多い。地元の人だけが知る近道や名店もそこにある。',
    action: '安全に気をつけながら、表通りから一本裏の道へ入って、生活の音や匂いを感じてみよう。',
    triviaCategory: '道路',
  },
  {
    id: 'st-meibutsu',
    appliesTo: 'street',
    title: '門前の名物・老舗を探す',
    trivia: '寺社の門前には、参拝客をもてなしてきた和菓子屋や名物料理の店が残っていることが多い。その味にも土地の歴史が染みている。',
    action: '参道や門前の通りで、長く続いていそうな菓子屋・食事処を探してみよう。見つけたら一服どうぞ。',
    triviaCategory: '歴史',
  },
];

// ── 決定論的な選定 ──

/** 31倍ローリングハッシュ（非負）。スポットIDからシードを作る */
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** カテゴリ文字列から既定の適用範囲を導く（神社→shrine系 / 寺→temple系） */
function defaultScopes(category: string): WalkScope[] {
  if (category.includes('神社')) return ['shrine', 'precinct', 'street'];
  if (category.includes('寺')) return ['temple', 'precinct', 'street'];
  return ['precinct', 'street'];
}

/** カテゴリ（と任意の scope 絞り込み）に合うミッションのプール */
export function missionPool(category: string, scopes?: WalkScope[]): WalkMission[] {
  const allowed = new Set<WalkScope>(scopes ?? defaultScopes(category));
  return WALK_MISSIONS.filter((m) => allowed.has(m.appliesTo));
}

/**
 * 決定論的に n 件選ぶ。同じ (seedKey, category, salt, scopes) → 常に同じ結果。
 * salt にクエスト番号などを渡すとバリエーションが出る。1回の選定内で重複しない。
 */
export function pickWalkMissions(
  seedKey: string,
  category: string,
  salt: number,
  n: number,
  scopes?: WalkScope[],
): WalkMission[] {
  const pool = missionPool(category, scopes);
  if (pool.length === 0) return [];
  const rand = mulberry32((hashString(seedKey) ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0);
  const arr = [...pool];
  const take = Math.min(n, arr.length);
  // 部分 Fisher-Yates: 先頭 take 件だけシャッフルして抜き出す
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(rand() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, take);
}
