// Yaorozu God OS - Mock Database & State Management

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
    id: 'spot-sensoji',
    name: '浅草寺 (金龍山)',
    description: '都内最古の寺院。提灯の雷門や、仲見世通りが有名。五重塔がそびえ立つ。',
    latitude: 35.7148,
    longitude: 139.7967,
    creatorId: 'user-history-geek', // Starts with Haruka as Creator
    imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80',
    category: '寺院',
    tokuRequirement: 100,
    enjoyments: [
      '「雷門」の巨大提灯の下の「木彫りの龍神像」を見上げてみよう',
      '活気あふれる「仲見世通り」で焼きたての人形焼やきびだんごを味わう',
      '本堂前の「常香炉」から立ち上る煙を浴びて、心身を清める'
    ],
    difficulty: 1,
    terrain: 1,
    attributes: ['♿ バリアフリー', '🍵 茶屋あり', '🌸 桜名所', '👪 ファミリー向け'],
    cacheType: 'Virtual'
  },
  {
    id: 'spot-fushimi',
    name: '伏見稲荷大社',
    description: '全国に3万社ある稲荷神社の総本宮。千本鳥居が神秘的な朱色のトンネルを作る。',
    latitude: 34.9671,
    longitude: 135.7727,
    creatorId: 'user-guide-1', // Starts with Takashi as Creator
    imageUrl: 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=800&q=80',
    category: '神社',
    tokuRequirement: 150,
    enjoyments: [
      '朱塗りの鳥居がどこまでも続く「千本鳥居」の神秘的な光景をカメラに収める',
      '「奥社奉拝所」にある「おもかる石」を持ち上げて願いが早く叶うか占う',
      '参道付近の茶屋で、キツネの大好物とされる「きつねうどん」や「いなり寿司」を食す'
    ],
    difficulty: 3,
    terrain: 3,
    attributes: ['⛩️ 神社', '🌲 山道あり', '🦊 稲荷', '🌅 夜間参拝可'],
    cacheType: 'Traditional'
  },
  {
    id: 'spot-todaiji',
    name: '東大寺 (大仏殿)',
    description: '奈良の大仏さま（盧舎那仏）が鎮座する世界最大級 of 木造建築物。柱くぐりが有名。',
    latitude: 34.6901,
    longitude: 135.8398,
    creatorId: null, // No creator yet
    imageUrl: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800&q=80',
    category: '寺院',
    tokuRequirement: 100,
    enjoyments: [
      '大仏殿の前に立ち、世界最大級の木造建築としての圧倒的スケールを実感する',
      '高さ約15mの「盧舎那仏（奈良の大仏）」の印相（手のポーズ）に込められた意味を学ぶ',
      '大仏の鼻の穴と同じ大きさと言われる「柱の穴くぐり」に挑戦して無病息災を願う'
    ],
    difficulty: 1,
    terrain: 1,
    attributes: ['♿ バリアフリー', '🦌 鹿あり', '🏛️ 世界遺産', '👪 ファミリー向け'],
    cacheType: 'Virtual'
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
    cacheType: 'Virtual'
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
    cacheType: 'EarthCache'
  }
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

// Local Storage Keys
const KEYS = {
  USERS: 'yaorozu_users',
  SPOTS: 'yaorozu_spots',
  AGENTS: 'yaorozu_agents',
  UGC: 'yaorozu_ugc',
  AFFILIATE: 'yaorozu_affiliate',
};

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
