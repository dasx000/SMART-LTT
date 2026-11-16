"use client";

import { useState, useTransition } from "react";
import { NAMA_BULAN_PENDEK, formatAngka } from "@/lib/format";
import { gagal, sukses } from "@/lib/swal";
import { Save } from "lucide-react";
import { simpanProduktivitasDesaAction, simpanSaranaAction } from "./actions";

type Komoditas = "Padi" | "Jagung" | "Ubi Kayu";
export type ProdData = { tahun: number; desaId: number; komoditas: Komoditas; nilai: number[] };
export type SaranaData = { desaId: number; gudang_gabah: number; embung: number; lantai_jemur: number; mesin_pengering: number };

const SARANA = [
  { k: "gudang_gabah", l: "Gudang Penyimpanan Gabah" },
  { k: "embung", l: "Embung" },
  { k: "lantai_jemur", l: "Lantai Jemur" },
  { k: "mesin_pengering", l: "Mesin Pengering" },
] as const;

const KOM: Komoditas[] = ["Padi", "Jagung", "Ubi Kayu"];
const keTeks = (arr?: number[]) => (arr ?? new Array(12).fill(0)).map((v) => (v ? formatAngka(v) : ""));

/** Tabel isian produktivitas satu desa: baris = bulan, kolom = komoditas (seperti GAS lama). */
export function TabelProd({
  desaId,
  tahun,
  bulanKini,
  awal,
  diperbarui,
}: {
  desaId: number;
  tahun: number;
  /** Bulan berjalan (1–12) bila tahun = tahun ini, untuk disorot; 0 = tidak ada */
  bulanKini: number;
  awal: Partial<Record<Komoditas, number[]>>;
  diperbarui: string | null;
}) {
  const [nilai, setNilai] = useState<Record<Komoditas, string[]>>(() => ({
    Padi: keTeks(awal.Padi),
    Jagung: keTeks(awal.Jagung),
    "Ubi Kayu": keTeks(awal["Ubi Kayu"]),
  }));
  const [proses, mulai] = useTransition();

  function ubah(kom: Komoditas, i: number, v: string) {
    setNilai((n) => ({ ...n, [kom]: n[kom].map((x, j) => (j === i ? v : x)) }));
  }

  function simpan(e: React.FormEvent) {
    e.preventDefault();
    mulai(async () => {
      const h = await simpanProduktivitasDesaAction({ tahun, desaId, nilai });
      if (h.sukses) sukses("Tersimpan", h.pesan);
      else gagal("Gagal", h.pesan);
    });
  }

  return (
    <form onSubmit={simpan}>
      <p className="mb-3 text-[10px] text-gray-400">
        Satuan <b className="text-gray-500">ton/ha</b>. Kosongkan atau isi 0 bila tidak ada panen. Boleh memakai koma atau titik.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-gray-100">
        <table className="w-full min-w-[480px] text-xs">
          <thead>
            <tr className="bg-gray-50 text-[11px] font-bold text-gray-600 uppercase">
              <th className="px-2 py-3 text-left">Bulan</th>
              {KOM.map((k) => (
                <th key={k} className="w-[28%] px-1 py-3 text-center">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NAMA_BULAN_PENDEK.map((b, i) => (
              <tr key={b} className={`border-t border-gray-100 ${bulanKini === i + 1 ? "bg-blue-50/60" : ""}`}>
                <td className="px-2 py-1 font-semibold text-gray-700">{b}</td>
                {KOM.map((k) => (
                  <td key={k} className="px-1 py-1">
                    <input
                      inputMode="decimal"
                      placeholder="0"
                      aria-label={`${k} ${b}`}
                      value={nilai[k][i]}
                      onChange={(e) => ubah(k, i, e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-right text-sm tabular-nums text-gray-800 placeholder:text-gray-400 focus:border-green-500 focus:outline-hidden"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {diperbarui && <p className="mt-2 text-[10px] text-gray-400">Terakhir diperbarui: {diperbarui}</p>}
      <button
        type="submit"
        disabled={proses}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-bold text-white transition hover:bg-green-700 active:scale-[0.99] disabled:opacity-60"
      >
        <Save size={16} /> {proses ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}

/** Kartu isian sarana satu desa (desa dipilih lewat URL, seperti GAS lama). */
export function KartuSarana({ desaId, awal, diperbarui }: { desaId: number; awal?: SaranaData; diperbarui: string | null }) {
  const [nilai, setNilai] = useState<Record<string, string>>(() =>
    Object.fromEntries(SARANA.map((s) => [s.k, awal ? String(awal[s.k]) : ""])),
  );
  const [proses, mulai] = useTransition();

  function simpan(e: React.FormEvent) {
    e.preventDefault();
    mulai(async () => {
      const h = await simpanSaranaAction({
        desaId,
        gudang_gabah: nilai.gudang_gabah,
        embung: nilai.embung,
        lantai_jemur: nilai.lantai_jemur,
        mesin_pengering: nilai.mesin_pengering,
      });
      if (h.sukses) sukses("Tersimpan", h.pesan);
      else gagal("Gagal", h.pesan);
    });
  }

  return (
    <form onSubmit={simpan}>
      <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[11px] font-bold tracking-wide text-orange-700 uppercase">Jumlah Sarana (Unit)</h3>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${awal ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {awal ? "Sudah diisi" : "Belum diisi"}
          </span>
        </div>
        <div className="space-y-2">
          {SARANA.map((s) => (
            <label key={s.k} className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-gray-700">{s.l}</span>
              <input
                inputMode="numeric"
                placeholder="0"
                value={nilai[s.k]}
                onChange={(e) => setNilai((v) => ({ ...v, [s.k]: e.target.value }))}
                className="w-20 rounded-xl border border-gray-200 bg-white px-3 py-2 text-right text-sm font-bold tabular-nums text-gray-800 placeholder:text-gray-400 focus:border-orange-400 focus:outline-hidden"
              />
            </label>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-gray-400">Isi angka bulat. Isi 0 jika desa tidak memiliki sarana tersebut.</p>
      </div>
      {diperbarui && <p className="mt-2 text-[10px] text-gray-400">Terakhir diperbarui: {diperbarui}</p>}
      <button
        type="submit"
        disabled={proses}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-bold text-white transition hover:bg-orange-600 active:scale-[0.99] disabled:opacity-60"
      >
        <Save size={16} /> {proses ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}
