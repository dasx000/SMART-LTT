import type { MetadataRoute } from "next";

// PWA ringan: manifest + service worker KHUSUS push notifikasi (public/sw.js). TANPA mode offline /
// cache (keputusan user 16 Nov 2026) — data selalu diambil langsung dari server.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SMART LTT",
    short_name: "SMART LTT",
    description: "Pelaporan Luas Tambah Tanam (LTT) Padi, Jagung, dan Ubi Kayu.",
    lang: "id",
    start_url: "/", // "/" mengarahkan ke beranda sesuai role, atau ke /login
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#15803d",
    icons: [
      // 512 px diperbesar dari logo 192 px (belum ada logo resolusi tinggi). Ganti bila logo asli tersedia.
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Maskable: logo 72% di tengah, agar tidak terpotong saat Android membentuk ikon bulat/kotak
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
