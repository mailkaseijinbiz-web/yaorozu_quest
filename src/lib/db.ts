// Yaorozu God OS - Mock Database & State Management
import { generateTokyoSpots } from '../data/tokyo-spots';
import { generateTrivia } from '../data/trivia-seed';

export interface User {
  id: string;
  displayName: string;
  avatarUrl: string;
  totalToku: number;
  currentTitle: string;
  avatarFrameColor?: string; // Special visual indicator for Creators
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
}

export interface SpotPhoto {
  url: string;
  userId: string;
  userDisplayName: string;
  createdAt: string;
}

export interface UgcPost {
  id: string;
  userId: string;
  userDisplayName: string;
  spotId: string;
  content: string;
  imageUrl?: string;
  likesCount: number;
  likedBy: string[]; // List of userIds who liked this post
  createdAt: string;
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

const INITIAL_SPOTS: Spot[] = [
  {
    id: 'spot-jukusen',
    name: '成願寺',
    description: '新中野駅から徒歩3分。中野区本町にある曹洞宗の寺院。静謐な境内に歴史ある本堂が佇む。',
    latitude: 35.6945,
    longitude: 139.6651,
    creatorId: 'user-history-geek',
    imageUrl: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80',
    category: '寺院',
    tokuRequirement: 50,
    enjoyments: [
      '静謐な境内で心を落ち着けて参拝する',
      '歴史ある山門をくぐり本堂の建築美を眺める',
      '周辺の住宅街と寺院のコントラストを楽しむ'
    ],
    difficulty: 1,
    terrain: 1,
    attributes: ['🏛️ 寺院', '🚶 散歩途中', '🍵 静謐', '👪 ファミリー向け'],
    cacheType: 'Virtual',
    godName: '成願の守り仏',
    godEmoji: '🙏',
    godRequests: [
      '📸 本堂の写真を撮ってほしいのじゃ',
      '📝 ここのクイズを作ってくれぬか？',
      '🗣️ この寺の歴史を口コミで広めてくれ',
      '🎨 境内の美しさを絵にしてみよ',
    ]
  },
  {
    id: 'spot-suzumori',
    name: '鈴森公園',
    description: '新中野駅近くの憩いの場。地元の子供たちが遊ぶ小さな公園で四季折々の緑が楽しめる。',
    latitude: 35.6933,
    longitude: 139.6625,
    creatorId: null,
    imageUrl: '', // 初期は写真なし。ユーザー投稿でセットされる
    photos: [],
    category: '公園',
    tokuRequirement: 30,
    enjoyments: [
      '公園のベンチで休憩しながら四季の花を眺める',
      '子供たちの遊ぶ姿を見ながらほっこりする',
      '夕暮れ時の空と木々のシルエットを撮影する'
    ],
    difficulty: 1,
    terrain: 1,
    attributes: ['🌳 公園', '☀️ 散歩途中', '👪 ファミリー向け', '🌸 季節の花'],
    cacheType: 'Virtual',
    godName: '鈴の木の精霊',
    godEmoji: '🌳',
    godRequests: [
      '📸 季節の花の写真が欲しいな～',
      '🧩 公園の植物クイズを作ってくれない？',
      '🗣️ みんなに鈴森の良さを伝えて！',
      '🌅 夕焼けの美しい瞬間を撮ってほしいの',
    ]
  },
  {
    id: 'spot-nakano-broadway',
    name: '中野ブロードウェイ',
    description: '日本有数のサブカル聖地。アニメ・マンガ・フィギュアの専門店が集まる商業ビル。',
    latitude: 35.7079,
    longitude: 139.6655,
    creatorId: 'user-guide-1',
    imageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
    category: '商業施設',
    tokuRequirement: 80,
    enjoyments: [
      'まんだらけ本店で掘り出し物のレアアイテムを探す',
      '隠れた名店の絶品ソフトクリームを味わう',
      'レトロゲーム専門店でノスタルジーに浸る'
    ],
    difficulty: 1,
    terrain: 1,
    attributes: ['🎮 サブカル', '🛍️ ショッピング', '🍦 グルメ', '📚 マンガ'],
    cacheType: 'Traditional',
    godName: 'サブカルの神・オタクノカミ',
    godEmoji: '🎮',
    godRequests: [
      '📸 推しフィギュアの写真を撮ってくれ！',
      '🧩 ブロードウェイ通検定を作ろうぜ！',
      '🗣️ 隠れた名店を口コミしてくれ！',
      '🎨 ブロードウェイの魅力を世界に広めろ！',
    ]
  },
  {
    id: 'spot-arai-yakushi',
    name: '新井薬師 梅照院',
    description: '中野区新井にある真言宗の寺院。眼病平癒の御利益で知られ、地域に親しまれる。',
    latitude: 35.7137,
    longitude: 139.6669,
    creatorId: null,
    imageUrl: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800&q=80',
    category: '寺院',
    tokuRequirement: 100,
    enjoyments: [
      '眼病平癒の薬師如来に健康を祈願する',
      '四季折々の花が彩る境内を散策する',
      '毎月8日の縁日で賑わう参道を楽しむ'
    ],
    difficulty: 1,
    terrain: 1,
    attributes: ['🏛️ 寺院', '👁️ 眼病平癒', '🌸 花の寺', '🎪 縁日あり'],
    cacheType: 'Virtual',
    godName: '薬師の守り神',
    godEmoji: '💊',
    godRequests: [
      '📸 季節の花と本堂を一緒に撮ってほしい',
      '📝 薬師如来のクイズを作ってくれぬか',
      '🗣️ 眼病平癒の御利益をみんなに伝えて',
      '🙏 静かな気持ちで参拝した感想を聞かせて',
    ]
  },
  {
    id: 'spot-shinnakano-shotengai',
    name: '新中野鍋屋横丁商店街',
    description: '新中野駅前に広がる活気ある商店街。昔ながらの個人商店と新しい飲食店が共存する。',
    latitude: 35.6925,
    longitude: 139.6636,
    creatorId: null,
    imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&q=80',
    category: '商店街',
    tokuRequirement: 40,
    enjoyments: [
      '地元の酒場で仕事後の一杯を楽しむ',
      '商店街を散歩しながら隠れた名店を発見する',
      '昔ながらの雰囲気を感じながら食べ歩きする'
    ],
    difficulty: 1,
    terrain: 1,
    attributes: ['🍺 居酒屋', '🚶 散歩向き', '🍽️ 食べ歩き', '🏮 下町情緒'],
    cacheType: 'Traditional',
    godName: '鍋横の商売神・ナベヨコ',
    godEmoji: '🏮',
    godRequests: [
      '📸 お気に入りの店の写真を撮ってくれ！',
      '🧩 商店街クイズを作って盛り上げてよ！',
      '🗣️ 美味い店を口コミで教えてくれ！',
      '🍺 夜の商店街の雰囲気を伝えてほしい！',
    ]
  },
  {
    id: 'spot-meijijingu',
    name: '明治神宮',
    description: '都会のオアシスとも言われる広大な人工の杜に囲まれた、明治天皇を祀る神社。',
    latitude: 35.6764,
    longitude: 139.6993,
    creatorId: null,
    imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&q=80',
    category: '神社',
    tokuRequirement: 80,
    enjoyments: [
      '日本最大級の木造鳥居をくぐる際、鳥居の前で一礼してから真ん中を避けて歩く',
      '都会の喧騒を忘れさせる、全国から寄進された10万本以上の人工林の森林浴を愉しむ',
      '「明治神宮御苑」の奥深くにある「清正井（きよまさのいど）」の澄み渡る湧水を眺める'
    ],
    difficulty: 1,
    terrain: 1,
    attributes: ['🌲 森林浴', '⛩️ 神社', '♿ バリアフリー', '👪 ファミリー向け'],
    cacheType: 'Virtual',
    godName: '明治の杜の精霊・コダマ',
    godEmoji: '🌲',
    godRequests: [
      '📸 杜の静けさが伝わる一枚を撮ってほしい',
      '🧩 参拝の作法クイズを作ってくれませんか',
      '🗣️ 都会の森の魅力を口コミで伝えて',
      '🙏 清正井で感じたことを聞かせてください',
    ]
  },
  {
    id: 'spot-itsukushima',
    name: '厳島神社',
    description: '海上に浮かぶ大鳥居と寝殿造りの社殿。潮の満ち引きで異なる美しさを見せる。',
    latitude: 34.2960,
    longitude: 132.3199,
    creatorId: null,
    imageUrl: 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=800&q=80',
    category: '神社',
    tokuRequirement: 200,
    enjoyments: [
      '潮が満ちた時に、まるで海に浮かんでいるかのように佇む朱塗りの回廊を散策する',
      '干潮のタイミングに合わせて海床に降り、巨大な「大鳥居」の根元まで歩いて接近する',
      '宮島島内で名物の「焼き牡蠣」や、できたての「もみじ饅頭」を食べ歩く'
    ],
    difficulty: 2,
    terrain: 2,
    attributes: ['🌊 海辺', '🦌 鹿あり', '⛩️ 神社', '🚢 フェリー必須'],
    cacheType: 'EarthCache',
    godName: '市杵島姫・イチカ',
    godEmoji: '🌊',
    godRequests: [
      '📸 潮の満ち引きで変わる大鳥居を撮ってほしい',
      '🧩 平清盛にまつわるクイズを作っておくれ',
      '🗣️ 宮島の美しさを口コミで広めて',
      '🍶 焼き牡蠣やもみじ饅頭の感想を聞かせて',
    ]
  },
  // 東京周辺の手続き生成スポット（合計で約1000件になる）
  ...generateTokyoSpots(),
];


const INITIAL_AGENTS: Agent[] = [
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
];

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
  SPOTS: 'yaorozu_spots_v2', // v2: 東京1000スポットへ拡張のため再シード
  AGENTS: 'yaorozu_agents',
  UGC: 'yaorozu_ugc',
  AFFILIATE: 'yaorozu_affiliate',
  STATS: 'yaorozu_user_stats',
  CHALLENGE: 'yaorozu_challenge_progress',
  TRIVIA: 'yaorozu_trivia',
};

// チャレンジ進捗
export interface ChallengeProgress {
  activeId: string | null; // 今挑戦中のチャレンジ
  done: { [challengeId: string]: string[] }; // 達成済みステップID
  completed: string[]; // 制覇したチャレンジ（バッジ獲得）
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

// Database class wrapping client side state
class MockDatabase {
  private isBrowser = typeof window !== 'undefined';

  private load<T>(key: string, defaultValue: T): T {
    if (!this.isBrowser) return defaultValue;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  }

  private save<T>(key: string, data: T): void {
    if (!this.isBrowser) return;
    localStorage.setItem(key, JSON.stringify(data));
  }

  // Getters
  getUsers(): User[] {
    return this.load(KEYS.USERS, INITIAL_USERS);
  }

  getSpots(): Spot[] {
    return this.load(KEYS.SPOTS, INITIAL_SPOTS);
  }

  getAgents(): Agent[] {
    return this.load(KEYS.AGENTS, INITIAL_AGENTS);
  }

  getUgc(): UgcPost[] {
    return this.load(KEYS.UGC, INITIAL_UGC);
  }

  getAffiliates(): AffiliateLink[] {
    return this.load(KEYS.AFFILIATE, INITIAL_AFFILIATE_LINKS);
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
    // Basic keyword match
    return this.getAffiliates().filter(aff => spotName.includes(aff.targetArea) || aff.targetArea.includes(spotName));
  }

  // Write operations
  addUgcPost(userId: string, spotId: string, content: string): UgcPost {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error('User not found');

    const posts = this.getUgc();
    const newPost: UgcPost = {
      id: `ugc-${Date.now()}`,
      userId,
      userDisplayName: user.displayName,
      spotId,
      content,
      likesCount: 0,
      likedBy: [],
      createdAt: new Date().toISOString(),
    };

    posts.push(newPost);
    this.save(KEYS.UGC, posts);

    // Reward 50 Toku for creating post
    this.rewardToku(userId, 50);

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
    const agents = this.getAgents();
    const index = agents.findIndex(a => a.spotId === spotId);
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
  // Admin operations (管理者ダッシュボード用)
  // ────────────────────────────────────────────────

  // Upsert a spot (create if id is new, otherwise update)
  adminSaveSpot(spot: Spot): Spot {
    const spots = this.getSpots();
    const index = spots.findIndex(s => s.id === spot.id);
    if (index === -1) spots.push(spot);
    else spots[index] = spot;
    this.save(KEYS.SPOTS, spots);
    return spot;
  }

  adminDeleteSpot(id: string): void {
    this.save(KEYS.SPOTS, this.getSpots().filter(s => s.id !== id));
    // Cascade: remove agent + UGC tied to this spot
    this.save(KEYS.AGENTS, this.getAgents().filter(a => a.spotId !== id));
    this.save(KEYS.UGC, this.getUgc().filter(p => p.spotId !== id));
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
  }

  adminDeleteUgc(id: string): void {
    this.save(KEYS.UGC, this.getUgc().filter(p => p.id !== id));
  }

  // Upsert an agent (神様AI)
  adminSaveAgent(agent: Agent): Agent {
    const agents = this.getAgents();
    const index = agents.findIndex(a => a.id === agent.id);
    if (index === -1) agents.push(agent);
    else agents[index] = agent;
    this.save(KEYS.AGENTS, agents);
    return agent;
  }

  adminDeleteAgent(id: string): void {
    this.save(KEYS.AGENTS, this.getAgents().filter(a => a.id !== id));
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
    const spots = this.getSpots();
    const idx = spots.findIndex(s => s.id === spotId);
    if (idx === -1) return undefined;

    const spot = spots[idx];
    spot.photos = [...(spot.photos ?? []), url];
    // メイン画像が未設定ならこの投稿をメインにする
    if (!spot.imageUrl) spot.imageUrl = url;
    spots[idx] = spot;
    this.save(KEYS.SPOTS, spots);

    this.rewardToku(userId, 30);
    this.recalculateSpotCreator(spotId);
    return spot;
  }

  /** 不適切な写真を却下（削除）。誰でも実行可能なコミュニティモデレーション */
  rejectSpotPhoto(spotId: string, url: string): Spot | undefined {
    const spots = this.getSpots();
    const idx = spots.findIndex(s => s.id === spotId);
    if (idx === -1) return undefined;

    const spot = spots[idx];
    spot.photos = (spot.photos ?? []).filter(p => p !== url);
    // メイン画像が却下されたら次の投稿写真へ差し替え（無ければ空）
    if (spot.imageUrl === url) spot.imageUrl = spot.photos[0] ?? '';
    spots[idx] = spot;
    this.save(KEYS.SPOTS, spots);
    return spot;
  }

  /** 神がUGCによって成長：楽しみ方を1つ追加 */
  addEnjoyment(spotId: string, text: string): Spot | undefined {
    const spots = this.getSpots();
    const idx = spots.findIndex(s => s.id === spotId);
    if (idx === -1) return undefined;
    const spot = spots[idx];
    if (!spot.enjoyments.includes(text)) {
      spot.enjoyments = [...spot.enjoyments, text];
      spots[idx] = spot;
      this.save(KEYS.SPOTS, spots);
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
  // チャレンジ進捗
  // ────────────────────────────────────────────────
  getChallengeProgress(): ChallengeProgress {
    return this.load(KEYS.CHALLENGE, { activeId: null, done: {}, completed: [] } as ChallengeProgress);
  }

  setActiveChallenge(challengeId: string | null): void {
    const p = this.getChallengeProgress();
    p.activeId = challengeId;
    this.save(KEYS.CHALLENGE, p);
  }

  /** チャレンジのステップを達成。+rewardの徳。全ステップ達成でcompletedに追加（バッジ獲得） */
  completeChallengeStep(userId: string, challengeId: string, stepId: string, totalSteps: number, reward = 20): ChallengeProgress {
    const p = this.getChallengeProgress();
    const done = new Set(p.done[challengeId] || []);
    if (!done.has(stepId)) {
      done.add(stepId);
      p.done[challengeId] = Array.from(done);
      this.rewardToku(userId, reward);
    }
    if (done.size >= totalSteps && !p.completed.includes(challengeId)) {
      p.completed.push(challengeId);
      this.rewardToku(userId, 100); // 制覇ボーナス
    }
    this.save(KEYS.CHALLENGE, p);
    return p;
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
      .slice(0, 5);
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
    const spots = this.getSpots();
    const spotIndex = spots.findIndex(s => s.id === spotId);
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
        this.save(KEYS.SPOTS, spots);
      }
    } else {
      // If no one meets it, it might revert to null (or keep previous if they still have the lead,
      // but let's keep it simple: if top user goes below requirement, it reverts)
      if (spot.creatorId !== null && maxToku < spot.tokuRequirement) {
        spot.creatorId = null;
        spots[spotIndex] = spot;
        this.save(KEYS.SPOTS, spots);
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
