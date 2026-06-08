import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Outfit } from "next/font/google";
import "./globals.css";
import PwaRegister from "./pwa-register";

const noto = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-noto",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-outfit",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0c16",
};

export const metadata: Metadata = {
  title: "Yaorozu God Quest - 八百万の神が息づく位置情報ARプラットフォーム",
  description: "あなたの貢献（UGC）でロケーションの神様（AIエージェント）を育てよう！現実とデジタルが交差する位置情報WebARプラットフォーム。",
  keywords: "位置情報, AR, WebAR, UGC, AIエージェント, 神社仏閣, ゲーミフィケーション",
  applicationName: "八百万クエスト",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "八百万クエスト",
    statusBarStyle: "black-translucent",
  },
  // 旧 iOS 互換のため明示（modern な mobile-web-app-capable は appleWebApp が出力）
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${noto.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-dark-bg text-foreground font-sans">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
