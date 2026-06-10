import type { NextConfig } from "next";

// デプロイごとに一意なビルドID。Vercel ではコミットSHA、それ以外はビルド時刻。
// クライアントへ埋め込み（NEXT_PUBLIC_BUILD_ID）、/api/version と突き合わせて
// 新しいデプロイを検知し、PWA を滑らかに更新する（PwaRegister）。
const buildId = process.env.VERCEL_GIT_COMMIT_SHA || `dev-${Date.now()}`;

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  async headers() {
    return [
      {
        // Service Worker は常に再検証させ、古い SW を掴み続けないようにする。
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
