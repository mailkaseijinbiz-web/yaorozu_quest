import type { Metadata } from 'next';
import Link from 'next/link';
import {
  MapPin,
  MessageCircle,
  Sparkles,
  Stamp,
  Footprints,
  Trophy,
  NotebookPen,
  Compass,
  ArrowRight,
  Navigation,
} from 'lucide-react';

// 紹介LP（ランディングページ）。アプリ本体（/）の魅力を伝える静的な紹介ページ。
// 本体の「電話枠」レイアウトとは独立し、PC・スマホ双方でレスポンシブに表示する。

export const metadata: Metadata = {
  title: '八百万クエスト｜歩けば、神様が待っている。位置情報×AIの巡礼ゲーム',
  description:
    '実在の神社・お寺をめぐり、その地に宿る八百万の神（AI）と語らい、クエストで「徳」を積む位置情報の巡礼ゲーム。御朱印を集め、称号を高めよう。登録不要ですぐ遊べます。',
  openGraph: {
    title: '八百万クエスト｜歩けば、神様が待っている。',
    description:
      '実在の神社・お寺をめぐり、八百万の神（AI）と語らい、クエストで徳を積む位置情報の巡礼ゲーム。',
    type: 'website',
  },
};

const FEATURES = [
  {
    icon: MapPin,
    title: '実在の場所を巡る',
    body: 'GPSで近くの神社・お寺が「場（ば）」として地図に出現。いつもの散歩が、ご利益めぐりの冒険に変わります。',
  },
  {
    icon: MessageCircle,
    title: '八百万の神と語らう',
    body: 'その地に宿るAIの神様とおしゃべり。土地の由緒や見どころ、参拝の作法まで、親しみやすくも神々しい口調で案内してくれます。',
  },
  {
    icon: Sparkles,
    title: '徳を積んで成長する',
    body: '参拝・写真・クエストで「徳（とく）」が貯まり、称号とレベルがアップ。あなただけの巡礼の物語が積み上がります。',
  },
];

const STEPS = [
  {
    no: '01',
    icon: Navigation,
    title: '場所へ行く',
    body: '位置情報をオンにして歩き出すと、近くの神社・お寺に神様が現れます。',
  },
  {
    no: '02',
    icon: MessageCircle,
    title: '神様と話す・挑む',
    body: '神様と語らい、その場のクエスト（街歩きの小さな冒険）に挑戦しましょう。',
  },
  {
    no: '03',
    icon: Stamp,
    title: '徳を積み、集める',
    body: 'クエストを果たして徳を積み、御朱印を授かり、称号を高めていきます。',
  },
];

const HIGHLIGHTS = [
  { icon: Stamp, title: '御朱印コレクション', body: '参拝や対話の証として御朱印を授かり、御朱印帳に集めていけます。' },
  { icon: Footprints, title: '街歩き・周遊クエスト', body: '「◯社めぐり」など、歩いて楽しむ周遊プランで土地の魅力を再発見。' },
  { icon: NotebookPen, title: '参拝の記録', body: '訪れた日・写真・メモを残して、自分だけの巡礼の足あとを振り返れます。' },
  { icon: Compass, title: '土地の豆知識', body: '神様が語る、その街の歴史や小さな謎。知るほど散歩が面白くなります。' },
];

const TITLES = [
  { title: '見習い巡礼者', toku: 0 },
  { title: '巡礼ガイド', toku: 100 },
  { title: '徳高き修行僧', toku: 300 },
  { title: '大徳の創世主', toku: 500 },
  { title: '八百万の大神', toku: 1000 },
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh w-full bg-white text-gray-800 font-sans overflow-x-hidden">
      {/* ── ヘッダー ── */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-black/5">
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-shrine-red to-cyber-blue flex items-center justify-center text-xl shadow-md">⛩️</span>
            <span className="text-lg font-black tracking-tight">八百万クエスト</span>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-shrine-red text-white text-sm font-bold px-4 py-2 shadow-md shadow-shrine-red/20 hover:brightness-110 active:scale-95 transition"
          >
            はじめる <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* ── ヒーロー ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sky-50 via-white to-amber-50/60 pointer-events-none" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[680px] max-w-[120%] h-[680px] bg-shrine-red/[0.07] blur-3xl rounded-full pointer-events-none" />
        <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-20 md:pt-24 md:pb-28 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-shrine-red/20 bg-white/70 px-3.5 py-1.5 text-[12px] md:text-[13px] font-bold text-shrine-red shadow-sm">
            <Sparkles className="w-3.5 h-3.5" /> 位置情報 × AI × ご利益
          </span>
          <h1 className="mt-6 text-4xl md:text-6xl font-black leading-[1.15] tracking-tight">
            歩けば、<br className="sm:hidden" />
            <span className="bg-gradient-to-r from-shrine-red to-cyber-blue bg-clip-text text-transparent">神様</span>
            が待っている。
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[15px] md:text-lg leading-relaxed text-gray-600">
            実在の神社・お寺をめぐり、その地に宿る<span className="font-bold text-gray-800">八百万の神（AI）</span>と語らい、
            クエストで<span className="font-bold text-shrine-red">徳</span>を積む——
            現実の街がそのまま舞台になる、位置情報の巡礼ゲーム。
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-shrine-red text-white text-base font-black px-7 py-3.5 shadow-lg shadow-shrine-red/25 hover:brightness-110 active:scale-95 transition"
            >
              今すぐ巡礼をはじめる <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-full bg-white text-gray-700 text-base font-bold px-7 py-3.5 border border-black/10 shadow-sm hover:bg-gray-50 active:scale-95 transition"
            >
              遊び方を見る
            </a>
          </div>
          <p className="mt-5 text-[12px] text-gray-400">登録不要・ブラウザですぐに遊べます（スマートフォン推奨）</p>
        </div>
      </section>

      {/* ── 特長 3カード ── */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="grid gap-5 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-3xl border border-black/5 bg-white p-7 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-100 to-amber-50 flex items-center justify-center text-shrine-red">
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="mt-5 text-lg font-black text-gray-800">{f.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-gray-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 遊び方 3ステップ ── */}
      <section id="how" className="bg-gradient-to-b from-white to-sky-50/60 border-y border-black/5">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">遊び方はかんたん、3ステップ</h2>
            <p className="mt-3 text-gray-500">いつもの散歩を、神様との出会いに。</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.no} className="relative rounded-3xl bg-white p-7 shadow-sm border border-black/5">
                <span className="absolute -top-3 left-7 text-4xl font-black text-shrine-red/15">{s.no}</span>
                <div className="mt-4 w-11 h-11 rounded-xl bg-shrine-red/10 flex items-center justify-center text-shrine-red">
                  <s.icon className="w-5 h-5" />
                </div>
                <h3 className="mt-4 text-lg font-black">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-gray-500">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── もっと楽しむ ── */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">巡礼を、もっと楽しく。</h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="flex gap-4 rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
              <div className="shrink-0 w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-gold">
                <h.icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-800">{h.title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-gray-500">{h.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 称号の道 ── */}
      <section className="bg-gradient-to-b from-sky-50/60 to-white border-y border-black/5">
        <div className="mx-auto max-w-4xl px-5 py-16 md:py-24">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 text-shrine-red font-bold text-sm">
              <Trophy className="w-4 h-4" /> 称号の道
            </span>
            <h2 className="mt-3 text-3xl md:text-4xl font-black tracking-tight">徳を積み、神に近づく。</h2>
            <p className="mt-3 text-gray-500">徳を貯めるほど称号が上がり、できることも広がります。</p>
          </div>
          <ol className="mt-10 space-y-3">
            {TITLES.map((t, i) => (
              <li key={t.title} className="flex items-center gap-4 rounded-2xl bg-white border border-black/5 px-5 py-4 shadow-sm">
                <span className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-shrine-red to-cyber-blue text-white flex items-center justify-center text-sm font-black">
                  {i + 1}
                </span>
                <span className="flex-1 font-black text-gray-800">{t.title}</span>
                <span className="text-sm font-bold text-gray-400">徳 {t.toku.toLocaleString()}〜</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 最終CTA ── */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-shrine-red to-cyber-blue px-8 py-14 md:py-20 text-center text-white shadow-2xl">
          <div className="absolute -top-16 -right-10 w-72 h-72 bg-white/10 blur-3xl rounded-full pointer-events-none" />
          <div className="relative">
            <div className="text-5xl">⛩️</div>
            <h2 className="mt-4 text-3xl md:text-4xl font-black leading-tight">さあ、最初の一歩を。</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/85 leading-relaxed">
              あなたの街の神社・お寺に、まだ見ぬ神様が待っています。登録不要、いますぐ巡礼の旅へ。
            </p>
            <Link
              href="/"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-white text-shrine-red text-base font-black px-8 py-4 shadow-lg hover:bg-gray-50 active:scale-95 transition"
            >
              八百万クエストをはじめる <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── フッター ── */}
      <footer className="border-t border-black/5">
        <div className="mx-auto max-w-6xl px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-shrine-red to-cyber-blue flex items-center justify-center text-base">⛩️</span>
            <span className="font-black text-gray-700">八百万クエスト</span>
          </div>
          <p className="text-[12px] text-gray-400">現実とデジタルが交差する、位置情報の巡礼ゲーム。</p>
          <Link href="/" className="text-sm font-bold text-shrine-red hover:underline">
            アプリを開く →
          </Link>
        </div>
      </footer>
    </main>
  );
}
