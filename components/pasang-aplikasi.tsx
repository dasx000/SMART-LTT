"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Download, ShieldCheck, Smartphone, X } from "lucide-react";

/**
 * Ajakan memasang SMART LTT ke layar utama HP (PWA) — khusus beranda PPL.
 *  - KartuPasangAplikasi: kartu di atas menu; "Nanti saja" menyembunyikannya 30 hari.
 *  - IkonPasangAplikasi: ikon permanen di "Menu Lainnya".
 * Keduanya hilang bila aplikasi sudah dibuka dari ikon layar utama / baru saja dipasang.
 * Chrome/Edge Android → dialog install bawaan; iPhone & browser dalam-aplikasi (WhatsApp dll.) → panduan.
 */

type PromptPasang = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// Event beforeinstallprompt bisa datang sebelum komponen tampil → tangkap di level modul.
let tunda: PromptPasang | null = null;
let baruTerpasang = false;
const pendengar = new Set<() => void>();
const kabari = () => pendengar.forEach((f) => f());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    tunda = e as PromptPasang;
    kabari();
  });
  window.addEventListener("appinstalled", () => {
    tunda = null;
    baruTerpasang = true;
    kabari();
  });
}

type Platform = "ios" | "android" | "lain";
type Lingkungan = { platform: Platform; dalamAplikasi: boolean; mandiri: boolean; bisaPrompt: boolean; terpasang: boolean };

function deteksi(): Lingkungan {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  // Browser bawaan aplikasi lain (WhatsApp, Facebook, Instagram, Telegram, WebView Android)
  const dalamAplikasi = /WhatsApp|FBAN|FBAV|FB_IAB|Instagram|Line\/|Telegram|; wv\)/i.test(ua);
  const mandiri =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return { platform: ios ? "ios" : android ? "android" : "lain", dalamAplikasi, mandiri, bisaPrompt: tunda !== null, terpasang: baruTerpasang };
}

/** null sampai komponen tampil di browser (hindari beda render server vs browser). */
function useLingkungan(): Lingkungan | null {
  const [env, setEnv] = useState<Lingkungan | null>(null);
  useEffect(() => {
    const segarkan = () => setEnv(deteksi());
    segarkan();
    pendengar.add(segarkan);
    return () => {
      pendengar.delete(segarkan);
    };
  }, []);
  return env;
}

/** Jalankan dialog install bawaan bila ada; selain itu buka panduan. */
function usePasang(env: Lingkungan | null) {
  const [panduan, setPanduan] = useState(false);
  const pasang = async () => {
    if (env?.bisaPrompt && tunda) {
      const p = tunda;
      tunda = null; // prompt() hanya boleh dipanggil sekali per event
      await p.prompt();
      kabari();
      return;
    }
    setPanduan(true);
  };
  const modal = panduan && env ? <PanduanPasang env={env} tutup={() => setPanduan(false)} /> : null;
  return { pasang, modal };
}

const KUNCI_NANTI = "ltt-pasang-nanti";
const JEDA_NANTI_MS = 30 * 24 * 60 * 60 * 1000; // 1 bulan

function sedangDitunda(): boolean {
  try {
    const t = Number(localStorage.getItem(KUNCI_NANTI));
    return Number.isFinite(t) && t > 0 && Date.now() - t < JEDA_NANTI_MS;
  } catch {
    return false;
  }
}

export function KartuPasangAplikasi() {
  const env = useLingkungan();
  const { pasang, modal } = usePasang(env);
  const [baruDitunda, setBaruDitunda] = useState(false);

  // env baru terisi setelah tampil di browser → aman membaca localStorage di sini.
  if (!env || env.mandiri || env.terpasang) return modal;
  if (baruDitunda || sedangDitunda()) return modal;

  const nanti = () => {
    try {
      localStorage.setItem(KUNCI_NANTI, String(Date.now()));
    } catch {}
    setBaruDitunda(true);
  };

  return (
    <>
      <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white shadow">
            <Smartphone size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-green-900">Pasang SMART LTT di HP</p>
            <p className="mt-0.5 text-xs text-green-800">Buka langsung dari layar utama HP, tanpa perlu mencari link lagi.</p>
          </div>
        </div>
        <Disclaimer />
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={pasang}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white shadow transition hover:bg-green-700 active:scale-95"
          >
            <Download size={16} /> {env.bisaPrompt ? "Pasang" : "Lihat Caranya"}
          </button>
          <button type="button" onClick={nanti} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 transition hover:bg-green-100 active:scale-95">
            Nanti saja
          </button>
        </div>
      </div>
      {modal}
    </>
  );
}

/** Ikon permanen di grid "Menu Lainnya" — gaya sama dengan ikon menu beranda PPL. */
export function IkonPasangAplikasi() {
  const env = useLingkungan();
  const { pasang, modal } = usePasang(env);
  if (!env || env.mandiri || env.terpasang) return null;
  return (
    <>
      <button type="button" onClick={pasang} className="flex flex-col items-center transition hover:scale-105 active:scale-95">
        <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl border border-green-200 bg-green-100 text-green-700 shadow">
          <Download size={30} />
        </div>
        <span className="text-center text-[11px] leading-tight font-bold text-gray-700">
          Pasang
          <br />
          Aplikasi
        </span>
      </button>
      {modal}
    </>
  );
}

function Disclaimer() {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/70 p-2.5 text-[11px] leading-relaxed text-gray-600">
      <ShieldCheck size={14} className="mt-0.5 shrink-0 text-green-600" />
      <p>
        <b>Ukuran kurang dari 1 MB</b>, tidak memberatkan HP. Aman: langsung dari situs resmi <b>ltt.tani.ai.id</b>, tanpa Play Store, tanpa izin
        tambahan. Bisa dihapus kapan saja seperti aplikasi biasa.
      </p>
    </div>
  );
}

function PanduanPasang({ env, tutup }: { env: Lingkungan; tutup: () => void }) {
  let judul: string;
  let langkah: ReactNode[];
  if (env.dalamAplikasi) {
    judul = env.platform === "ios" ? "Buka di Safari dulu" : "Buka di Chrome dulu";
    langkah =
      env.platform === "ios"
        ? [
            <>Ketuk ikon <b>⋯</b> atau <b>kompas</b> di pojok layar.</>,
            <>Pilih <b>Buka di Safari</b>.</>,
            <>Di Safari, ketuk <b>Bagikan</b> (kotak dengan panah ke atas) → <b>Tambah ke Layar Utama</b> → <b>Tambah</b>.</>,
          ]
        : [
            <>Ketuk ikon <b>⋮</b> di pojok kanan atas.</>,
            <>Pilih <b>Buka di Chrome</b> (atau &quot;Buka di browser&quot;).</>,
            <>Di Chrome, buka beranda PPL lalu ketuk tombol <b>Pasang</b>.</>,
          ];
  } else if (env.platform === "ios") {
    judul = "Tambah ke Layar Utama";
    langkah = [
      <>Ketuk ikon <b>Bagikan</b> (kotak dengan panah ke atas) di bilah browser.</>,
      <>Geser ke bawah, pilih <b>Tambah ke Layar Utama</b>.</>,
      <>Ketuk <b>Tambah</b> di pojok kanan atas.</>,
    ];
  } else if (env.platform === "android") {
    judul = "Pasang lewat menu browser";
    langkah = [
      <>Ketuk ikon <b>⋮</b> di pojok kanan atas browser.</>,
      <>Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</>,
      <>Ketuk <b>Instal</b> / <b>Tambah</b>.</>,
    ];
  } else {
    judul = "Pasang lewat browser";
    langkah = [
      <>Klik ikon <b>pasang</b> (monitor dengan panah) di ujung kanan bilah alamat, atau buka menu <b>⋮</b>.</>,
      <>Pilih <b>Instal SMART LTT</b>.</>,
    ];
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={tutup}>
      <div role="dialog" aria-modal="true" aria-label={judul} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-green-800">{judul}</h3>
          <button type="button" onClick={tutup} aria-label="Tutup" className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <ol className="space-y-2.5">
          {langkah.map((l, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">{i + 1}</span>
              <span className="pt-0.5">{l}</span>
            </li>
          ))}
        </ol>
        <Disclaimer />
        <button type="button" onClick={tutup} className="mt-4 w-full rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 active:scale-95">
          Mengerti
        </button>
      </div>
    </div>
  );
}
