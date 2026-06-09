// Yaorozu God OS - AI Quest Generator
// 場の「価値(enjoyments)・課題(issues)・魂(soulMd)」から、3種のタスク
// （情報収集 sense / 理解判断 understand / 操作 act）で構成されたクエストを生成する。
// プロバイダ: Gemini 優先 → OpenAI → ルールベース fallback（いずれも raw fetch）。
import { NextResponse } from 'next/server';
import { TASK_CATALOG, kindOfType, type TaskType, type Task, type Quest } from '../../../data/tasks';

interface SpotInput {
  id?: string;
  name: string;
  category: string;
  description?: string;
  enjoyments?: string[];
  issues?: string[];
  soulMd?: string;
  latitude?: number;
  longitude?: number;
}

const KNOWN_TYPES = Object.keys(TASK_CATALOG) as TaskType[];

// ── 1タスクを正規化（モデル出力は信用しない） ──
function coerceTask(raw: unknown, i: number, spot: SpotInput): Task {
  const r = (raw ?? {}) as Record<string, unknown>;
  const type: TaskType = KNOWN_TYPES.includes(r.type as TaskType) ? (r.type as TaskType) : 'visit';
  const c = TASK_CATALOG[type];
  const reward = Math.min(100, Math.max(10, Math.round(Number(r.reward) || c.reward)));
  const title = String(r.title || c.title).slice(0, 40);
  const action = r.action ? String(r.action).slice(0, 120) : undefined;
  const task: Task = {
    id: `s${i}`,
    type,
    kind: kindOfType(type),
    icon: c.icon,
    label: c.label,
    title,
    reward,
    action,
    spotId: spot.id,
  };
  // 位置が要るタスクには場の座標を入れる（ジオフェンス・写真ミッション）
  if ((type === 'visit' || type === 'photo') && spot.latitude != null && spot.longitude != null) {
    task.lat = spot.latitude;
    task.lng = spot.longitude;
  }
  // 課題タスクは spot.issues に紐づける
  if (type === 'resolveIssue' && spot.issues && spot.issues.length) {
    const idx = Math.min(Number(r.issueIndex) || 0, spot.issues.length - 1);
    task.issueRef = { issueIndex: idx, issueText: spot.issues[idx] };
    task.title = `課題を動かす：${spot.issues[idx]}`.slice(0, 40);
  }
  return task;
}

// ── モデルが返した quest を Quest=Task[] へ正規化 ──
function coerceQuest(raw: unknown, n: number, spot: SpotInput, ts: number): Quest | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawTasks = Array.isArray(r.tasks) ? r.tasks : [];
  if (rawTasks.length === 0) return null;
  const tasks = rawTasks.slice(0, 8).map((t, i) => coerceTask(t, i, spot));
  const difficulty = ([1, 2, 3].includes(Number(r.difficulty)) ? Number(r.difficulty) : 1) as 1 | 2 | 3;
  return {
    id: `uq-${spot.id || 'spot'}-${ts}-${n}`,
    spotId: spot.id,
    title: String(r.title || `${spot.name}のクエスト`).slice(0, 40),
    description: String(r.description || '').slice(0, 160),
    difficulty,
    minLevel: difficulty,
    estMinutes: Math.min(120, Math.max(5, Math.round(Number(r.estMinutes) || 20))),
    badgeIcon: String(r.badgeIcon || '🏮').slice(0, 4),
    badgeName: String(r.badgeName || `${spot.name}の巡礼者`).slice(0, 30),
    goalName: spot.name,
    goalLat: spot.latitude ?? 0,
    goalLng: spot.longitude ?? 0,
    tasks,
    source: 'generated',
  };
}

// ── ルールベース fallback（価値→sense / 課題→act / 投稿→understand を必ず混ぜる） ──
function buildFallbackQuest(spot: SpotInput, count: number, ts: number): Quest[] {
  const enjoy = spot.enjoyments ?? [];
  const issues = spot.issues ?? [];
  const at = (lat?: number, lng?: number) => ({ lat: spot.latitude ?? lat, lng: spot.longitude ?? lng });
  const mk = (type: TaskType, i: number, over: Partial<Task> = {}): Task => {
    const c = TASK_CATALOG[type];
    return { id: `s${i}`, type, kind: c.kind, icon: c.icon, label: c.label, title: c.title, reward: c.reward, spotId: spot.id, ...over };
  };

  const quests: Quest[] = [];
  for (let n = 0; n < count; n++) {
    const enjoyment = enjoy.length ? enjoy[n % enjoy.length] : '';
    const issue = issues.length ? issues[n % issues.length] : '';
    const tasks: Task[] = [
      mk('visit', 0, { title: `${spot.name}に立つ`, action: `${spot.name}へ足を運び、この地の気を感じよう。`, ...at() }),
      mk('photo', 1, { title: enjoyment ? `「${enjoyment}」を一枚に` : '佳き一枚を奉納', action: `${enjoyment || 'この場の魅力'}を写真に収めよう。`, ...at() }),
      mk('review', 2, { action: `${spot.name}で感じた価値を、後の巡礼者へ言伝てよう。` }),
      issue
        ? mk('resolveIssue', 3, { title: `課題を動かす：${issue}`.slice(0, 40), action: `${spot.name}の課題「${issue}」を、あなたの手で少し動かそう。`, issueRef: { issueIndex: n % issues.length, issueText: issue } })
        : mk('sns', 3, { action: `${spot.name}の名を、外の世界にも広めよう。` }),
    ];
    quests.push({
      id: `uq-${spot.id || 'spot'}-${ts}-${n}`,
      spotId: spot.id,
      title: enjoyment ? `${spot.name}・${enjoyment}の巡礼` : `${spot.name}の巡礼`,
      description: `${spot.name}を訪れ、価値を見出し、課題を動かす街歩き。`,
      difficulty: 1,
      minLevel: 1,
      estMinutes: 20,
      badgeIcon: spot.category === '神社' ? '⛩️' : '🏮',
      badgeName: `${spot.name}の巡礼者`,
      goalName: spot.name,
      goalLat: spot.latitude ?? 0,
      goalLng: spot.longitude ?? 0,
      tasks,
      source: 'generated',
    });
  }
  return quests;
}

function buildPrompt(spot: SpotInput, count: number, rules: string, godRules = '', spotRules = ''): string {
  const soul = spot.soulMd ? `\n神の魂（口調・人格・世界観。これに沿った語り口で）:\n${spot.soulMd.slice(0, 1200)}` : '';
  const policy = rules.trim() ? `【生成ルール（最優先で厳守）】\n${rules.trim().slice(0, 2500)}\n\n` : '';
  // アマテラス＝全神の基底（普遍原則）。最優先の生成ルールと衝突する場合は生成ルールを優先する。
  const base = godRules.trim() ? `【神の普遍原則（アマテラス・全神の基底）】\n${godRules.trim().slice(0, 600)}\n（普遍原則。上の生成ルールと衝突する場合は生成ルールを優先する）\n\n` : '';
  // 場の生成ルールは「この場の価値・課題がどう整備されたか」の背景文脈として短く添える（生成指示ではない）。
  const spotPolicy = spotRules.trim() ? `\nこの場の価値・課題は次の方針で整備されている（背景。価値・課題の読み解きの参考に）:\n${spotRules.trim().slice(0, 600)}` : '';
  return `${policy}${base}あなたは位置情報巡礼ゲーム「八百万クエスト」のクエストデザイナーです。
以下の「場」を題材に、街歩き型のクエストを${count}個、日本語で考えてください。

クエストは「タスクの集まり」です。各タスクは神の3つの働きのいずれかに属します:
- 情報収集(sense): visit(来訪), photo(写真), context(今の様子), event(できごと), cleaning(清掃確認)
- 理解判断(understand): review(口コミ), eat(実食の声), evaluate(写真を評価), judge(投稿をジャッジ)
- 操作(act): resolveIssue(課題解決), buy(買物報告), sns(SNS拡散)

各クエストには「情報収集・理解判断・操作」を最低1つずつ含め、3〜5タスクで構成してください。
価値は「楽しみ方」から、操作タスクは「課題」から作ってください（課題があれば必ず resolveIssue を入れ、issueIndex で何番目の課題かを示す）。

場の名前: ${spot.name}
カテゴリ: ${spot.category}
説明: ${spot.description ?? ''}
価値（楽しみ方）: ${(spot.enjoyments ?? []).join(' / ') || '（未収集）'}
課題: ${(spot.issues ?? []).map((s, i) => `[${i}] ${s}`).join(' / ') || '（なし）'}${spotPolicy}${soul}

必ず次のJSONだけを出力してください（前後に文章を付けない）:
{"quests":[{"title":"クエスト名","description":"100字以内の導入","difficulty":1,"estMinutes":20,"badgeIcon":"絵文字","badgeName":"バッジ名","tasks":[{"type":"visit","title":"タスク名","action":"行動指示","reward":20,"issueIndex":0}]}]}`;
}

function extractJson(text: string): unknown {
  const obj = text.match(/\{[\s\S]*\}/);
  if (!obj) return null;
  try {
    return JSON.parse(obj[0]);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const spot: SpotInput = body.spot;
    const count: number = Math.min(5, Math.max(1, Number(body.count) || 3));
    const ts: number = Number(body.ts) || 0;
    const rules: string = typeof body.rules === 'string' ? body.rules : '';
    const godRules: string = typeof body.godRules === 'string' ? body.godRules : '';
    const spotRules: string = typeof body.spotRules === 'string' ? body.spotRules : '';

    if (!spot?.name) {
      return NextResponse.json({ error: 'spot.name is required' }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const prompt = buildPrompt(spot, count, rules, godRules, spotRules);

    const finalize = (parsed: unknown) => {
      const arr = (parsed as { quests?: unknown[] })?.quests;
      if (!Array.isArray(arr)) return null;
      const quests = arr
        .slice(0, count)
        .map((q, n) => coerceQuest(q, n, spot, ts))
        .filter((q): q is Quest => q !== null);
      return quests.length ? quests : null;
    };

    // ── Gemini 優先 ──
    if (geminiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.9,
                maxOutputTokens: 2048,
                responseMimeType: 'application/json',
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') ?? '';
          const quests = finalize(extractJson(text));
          if (quests) return NextResponse.json({ quests, source: 'gemini' });
        }
      } catch {
        /* fall through */
      }
    }

    // ── OpenAI ──
    if (openaiKey) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.9,
            response_format: { type: 'json_object' },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const text: string = data.choices?.[0]?.message?.content ?? '';
          const quests = finalize(extractJson(text));
          if (quests) return NextResponse.json({ quests, source: 'openai' });
        }
      } catch {
        /* fall through */
      }
    }

    // ── ルールベース fallback ──
    return NextResponse.json({ quests: buildFallbackQuest(spot, count, ts), source: 'fallback' });
  } catch {
    return NextResponse.json({ error: 'generation failed' }, { status: 500 });
  }
}
