import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  output: "standalone",
  serverExternalPackages: ["mediainfo.js"],
  outputFileTracingIncludes: { "/api/washes/*/evidence/*/complete": ["./node_modules/mediainfo.js/dist/MediaInfoModule.wasm"] },
  async headers() {
    const evidenceHeaders = [
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
    ];
    return [
      { source: "/evidencia/:path*", headers: evidenceHeaders },
      { source: "/api/evidence/:path*", headers: evidenceHeaders },
      { source: "/api/washes/:id/evidence/:path*", headers: evidenceHeaders },
    ];
  },
};

export default nextConfig;
