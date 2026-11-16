"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, LoaderCircle, Send } from "lucide-react";
import { hapusLanggananAction, kirimUjiAction, simpanLanggananAction, type HasilPush } from "@/app/profil/push-actions";

const KUNCI_PUBLIK = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function base64KeUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Status = "memuat" | "tidak-didukung" | "perlu-instal-ios" | "ditolak" | "mati" | "aktif" | "dimatikan-admin";

async function daftarSw() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

/**
 * Tombol aktif/matikan push notifikasi untuk PPL.
 * `ringkas` = kartu ajakan di beranda PPL: hanya tampil bila belum aktif & masih bisa diaktifkan.
 * `dimatikanAdmin` = sakelar global di /kab/notifikasi sedang OFF → tidak ada tombol aktifkan.
 */
export function PengaturanNotifikasi({ ringkas = false, dimatikanAdmin = false }: { ringkas?: boolean; dimatikanAdmin?: boolean }) {
  const [status, setStatus] = useState<Status>(dimatikanAdmin ? "dimatikan-admin" : "memuat");
  const [hasil, setHasil] = useState<HasilPush | null>(null);
  const [proses, mulai] = useTransition();

  useEffect(() => {
    if (dimatikanAdmin) return;
    (async () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const terpasang = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || !KUNCI_PUBLIK) {
        setStatus(ios && !terpasang ? "perlu-instal-ios" : "tidak-didukung");
        return;
      }
      if (Notification.permission === "denied") return setStatus("ditolak");
      try {
        const reg = await daftarSw();
        const sub = await reg.pushManager.getSubscription();
        if (sub && Notification.permission === "granted") {
          // Sinkronkan ulang ke server (mis. setelah ganti akun di perangkat yang sama)
          await simpanLanggananAction(sub.toJSON(), navigator.userAgent);
          setStatus("aktif");
        } else setStatus("mati");
      } catch {
        setStatus("tidak-didukung");
      }
    })();
  }, [dimatikanAdmin]);

  function aktifkan() {
    setHasil(null);
    mulai(async () => {
      try {
        const izin = await Notification.requestPermission();
        if (izin !== "granted") {
          setStatus(izin === "denied" ? "ditolak" : "mati");
          return;
        }
        await daftarSw();
        const reg = await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64KeUint8(KUNCI_PUBLIK) }));
        const h = await simpanLanggananAction(sub.toJSON(), navigator.userAgent);
        setHasil(h);
        if (h.sukses) setStatus("aktif");
      } catch (e) {
        setHasil({ sukses: false, pesan: e instanceof Error ? e.message : "Gagal mengaktifkan notifikasi." });
      }
    });
  }

  function matikan() {
    setHasil(null);
    mulai(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await hapusLanggananAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("mati");
      setHasil({ sukses: true, pesan: "Notifikasi dimatikan di perangkat ini." });
    });
  }

  function uji() {
    setHasil(null);
    mulai(async () => setHasil(await kirimUjiAction()));
  }

  if (ringkas) {
    if (status !== "mati" && status !== "perlu-instal-ios") return null;
    return (
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
        <Bell size={20} className="mt-0.5 shrink-0 text-cyan-700" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-bold text-cyan-900">Aktifkan pengingat</p>
          {status === "perlu-instal-ios" ? (
            <p className="mt-0.5 text-cyan-800">Di iPhone: ketuk Bagikan → &ldquo;Tambahkan ke Layar Utama&rdquo;, buka dari ikon SMART LTT, lalu aktifkan notifikasi.</p>
          ) : (
            <>
              <p className="mt-0.5 text-cyan-800">Dapatkan notifikasi bila target desa Padi bulan ini belum diisi.</p>
              <button
                type="button"
                onClick={aktifkan}
                disabled={proses}
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-cyan-700 disabled:opacity-70"
              >
                {proses ? <LoaderCircle size={14} className="animate-spin" /> : <Bell size={14} />} Aktifkan Notifikasi
              </button>
              {hasil && !hasil.sukses && <p className="mt-2 text-xs font-medium text-red-600">{hasil.pesan}</p>}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        <Bell size={16} className="text-cyan-600" /> Notifikasi Pengingat
      </h2>
      <p className="mt-1 text-xs text-gray-500">Pengingat harian (07.00 WIB) bila target desa Padi bulan berjalan belum diisi. Berlaku per perangkat.</p>

      <div className="mt-3">
        {status === "memuat" && <p className="text-sm text-gray-500">Memeriksa…</p>}
        {status === "dimatikan-admin" && <p className="text-sm text-gray-600">Notifikasi sedang dinonaktifkan oleh Admin Kabupaten.</p>}
        {status === "tidak-didukung" && <p className="text-sm text-gray-600">Browser ini belum mendukung notifikasi. Gunakan Chrome di Android atau browser terbaru.</p>}
        {status === "perlu-instal-ios" && (
          <p className="text-sm text-gray-600">Di iPhone/iPad (iOS 16.4+): ketuk Bagikan → &ldquo;Tambahkan ke Layar Utama&rdquo;, buka SMART LTT dari ikon tersebut, lalu kembali ke halaman ini.</p>
        )}
        {status === "ditolak" && (
          <p className="text-sm text-gray-600">Notifikasi diblokir. Buka pengaturan situs di browser (ikon gembok di bilah alamat) → izinkan Notifikasi, lalu muat ulang halaman.</p>
        )}
        {status === "mati" && (
          <button type="button" onClick={aktifkan} disabled={proses} className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 font-bold text-white transition hover:bg-cyan-700 disabled:opacity-70">
            {proses ? <LoaderCircle size={16} className="animate-spin" /> : <Bell size={16} />} Aktifkan Notifikasi
          </button>
        )}
        {status === "aktif" && (
          <div className="flex gap-2">
            <button type="button" onClick={uji} disabled={proses} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-cyan-700 disabled:opacity-70">
              {proses ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />} Kirim Uji
            </button>
            <button type="button" onClick={matikan} disabled={proses} className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-70">
              <BellOff size={16} /> Matikan
            </button>
          </div>
        )}
      </div>

      {hasil && (
        <p role={hasil.sukses ? "status" : "alert"} className={`mt-3 rounded-lg px-4 py-3 text-sm font-medium ${hasil.sukses ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {hasil.pesan}
        </p>
      )}
    </section>
  );
}
