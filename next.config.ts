import type { NextConfig } from "next";

// Header keamanan dasar untuk semua halaman (plan §12 no. 10).
// CSP ketat ditambahkan setelah semua sumber skrip/gaya final (Fase 6).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // ExcelJS hanya dipakai di server (route /api/unduh) — tidak dibundel, tidak dikirim ke HP.
  serverExternalPackages: ["exceljs", "web-push"],
  // Impor Excel e-Pusluh (Admin Kab) dikirim lewat Server Action: file maks. 5 MB + overhead multipart.
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Service worker push (public/sw.js): selalu ambil versi terbaru, jangan di-cache.
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
