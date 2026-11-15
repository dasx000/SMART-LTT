"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Copy, KeyRound, ShieldOff, X } from "lucide-react";
import { gagal, konfirmasi, memuat, sukses } from "@/lib/swal";
import type { HasilKunci } from "./actions";

const kelasIn = "w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-medium outline-none focus:border-green-500";

/** Modal buat kunci (?buat=1). Setelah dibuat, kunci ditampilkan sekali untuk disalin. */
export function FormKunci({
  aksi,
  izin,
  kembali,
}: {
  aksi: (fd: FormData) => Promise<HasilKunci>;
  izin: { kode: string; label: string }[];
  kembali: string;
}) {
  const [proses, mulai] = useTransition();
  const [kunci, setKunci] = useState<string | null>(null);
  const [tersalin, setTersalin] = useState(false);

  function kirim(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mulai(async () => {
      const r = await aksi(fd);
      if (r.sukses && r.kunci) setKunci(r.kunci);
      else await gagal("Gagal", r.pesan);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <h3 className="flex items-center gap-2 font-bold text-gray-800">
            <KeyRound size={18} className="text-green-600" /> {kunci ? "Kunci API Dibuat" : "Buat Kunci API"}
          </h3>
          <Link href={kembali} scroll={false} aria-label="Tutup" className="rounded-full p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </Link>
        </div>

        {kunci ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <b>Salin dan simpan kunci ini sekarang</b> (mis. di file .env bot). Kunci tidak disimpan di server dan tidak bisa ditampilkan lagi.
              Jangan bagikan di grup atau commit ke GitHub.
            </p>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-xs break-all text-gray-800">{kunci}</code>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(kunci);
                  setTersalin(true);
                }}
                className="flex items-center gap-1 rounded-xl bg-green-600 px-3 text-xs font-bold text-white hover:bg-green-700"
              >
                {tersalin ? <Check size={14} /> : <Copy size={14} />} {tersalin ? "Tersalin" : "Salin"}
              </button>
            </div>
            <div className="flex justify-end">
              <Link href={kembali} scroll={false} className="rounded-xl bg-gray-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-800">
                Selesai
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={kirim} className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700">Nama Klien <span className="text-red-500">*</span></span>
              <input name="nama" required maxLength={80} placeholder="mis. Bot DASBOT" className={kelasIn} />
            </label>
            <fieldset>
              <legend className="mb-1 text-xs font-semibold text-gray-700">Izin <span className="text-red-500">*</span></legend>
              <p className="mb-2 text-[11px] text-gray-400">Berikan hanya izin yang benar-benar dibutuhkan klien ini.</p>
              <div className="space-y-2">
                {izin.map((z) => (
                  <label key={z.kode} className="flex items-start gap-2 rounded-xl border border-gray-200 p-2.5 text-sm hover:bg-gray-50">
                    <input type="checkbox" name="izin" value={z.kode} className="mt-0.5 h-4 w-4 accent-green-600" />
                    <span>
                      <span className="font-mono text-xs font-bold text-gray-800">{z.kode}</span>
                      <span className="block text-xs text-gray-500">{z.label}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex justify-end gap-2">
              <Link href={kembali} scroll={false} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50">
                Batal
              </Link>
              <button type="submit" disabled={proses} className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-green-700 disabled:opacity-60">
                {proses ? "Membuat..." : "Buat Kunci"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/** Tombol cabut kunci (dengan konfirmasi). */
export function TombolCabut({ id, nama, aksi }: { id: string; nama: string; aksi: (id: string) => Promise<{ sukses: boolean; pesan: string }> }) {
  const [proses, mulai] = useTransition();
  return (
    <button
      type="button"
      disabled={proses}
      onClick={async () => {
        if (!(await konfirmasi(`Cabut kunci "${nama}"?`, "Klien yang memakai kunci ini langsung tidak bisa mengakses API. Tindakan ini tidak bisa dibatalkan.", "Ya, Cabut"))) return;
        mulai(async () => {
          memuat("Mencabut kunci...");
          const r = await aksi(id);
          if (r.sukses) await sukses("Dicabut", r.pesan);
          else await gagal("Gagal", r.pesan);
        });
      }}
      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      <ShieldOff size={12} /> Cabut
    </button>
  );
}
