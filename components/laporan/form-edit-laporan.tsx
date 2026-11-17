"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { formatAngka } from "@/lib/format";
import { gagal, memuat, sukses } from "@/lib/swal";

export type DataEdit = {
  id: number;
  desaId: number;
  komoditas: string;
  jenisId: number | null;
  tanam: number;
  panen: number;
  bera: number;
  olah: number;
  metode: string | null;
  keterangan: string | null;
};

const kelasIn = "w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-medium outline-none focus:border-green-500";
const lbl = "mb-1 block text-xs font-semibold text-gray-700";

/**
 * Form koreksi laporan, dibuka lewat URL (?edit=ID) — bisa di-refresh / dibagikan.
 * `lengkap` (Admin Kab): bera, olah lahan, metode penanaman (satu-satunya jalan PM AAS terisi manual).
 * Jenis LTT & metode penanaman hanya tampil untuk Padi (Jagung/Ubi Kayu selalu "LTT").
 */
export function FormEditLaporan({
  data, desa, jenis, aksi, kembali, lengkap,
}: {
  data: DataEdit;
  desa: { id: number; nama: string }[];
  jenis: { id: number; nama: string }[];
  aksi: (fd: FormData) => Promise<{ sukses: boolean; pesan: string }>;
  kembali: string;
  lengkap: boolean;
}) {
  const router = useRouter();
  const [proses, mulai] = useTransition();
  const angka = (n: number) => formatAngka(n);
  const padi = data.komoditas === "Padi";

  function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("id", String(data.id));
    mulai(async () => {
      memuat("Memperbarui laporan...");
      const r = await aksi(fd);
      if (r.sukses) {
        await sukses("Berhasil!", r.pesan);
        router.replace(kembali, { scroll: false });
      } else await gagal("Gagal Memperbarui", r.pesan);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <h3 className="font-bold text-gray-800">Koreksi Laporan ({data.komoditas})</h3>
          <Link href={kembali} scroll={false} aria-label="Tutup" className="rounded-full p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </Link>
        </div>
        <form onSubmit={simpan} className="mt-4 space-y-3.5">
          <div>
            <label className={lbl}>Desa <span className="text-red-500">*</span></label>
            <select name="desaId" defaultValue={data.desaId} required className={kelasIn}>
              {desa.map((d) => (
                <option key={d.id} value={d.id}>{d.nama}</option>
              ))}
            </select>
          </div>
          {padi && jenis.length > 0 && (
            <div>
              <label className={lbl}>Jenis LTT <span className="text-red-500">*</span></label>
              <select name="jenisLttId" defaultValue={data.jenisId ?? ""} required className={kelasIn}>
                {data.jenisId === null && <option value="" disabled>-- Pilih jenis LTT --</option>}
                {jenis.map((j) => (
                  <option key={j.id} value={j.id}>{j.nama}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Luas Tanam (Ha)</label>
              <input name="realisasiTanam" inputMode="decimal" autoComplete="off" defaultValue={angka(data.tanam)} required className={kelasIn} />
            </div>
            <div>
              <label className={lbl}>Luas Panen (Ha)</label>
              <input name="realisasiPanen" inputMode="decimal" autoComplete="off" defaultValue={angka(data.panen)} required className={kelasIn} />
            </div>
          </div>
          {lengkap && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Luas Bera (Ha)</label>
                  <input name="luasBera" inputMode="decimal" autoComplete="off" defaultValue={angka(data.bera)} className={kelasIn} />
                </div>
                <div>
                  <label className={lbl}>Olah Lahan (Ha)</label>
                  <input name="realisasiOlah" inputMode="decimal" autoComplete="off" defaultValue={angka(data.olah)} className={kelasIn} />
                </div>
              </div>
              {padi && (
                <div>
                  <label className={lbl}>Metode Penanaman</label>
                  <select name="metodePenanaman" defaultValue={data.metode ?? ""} className={kelasIn}>
                    <option value="">-- Standar (bukan PM AAS) --</option>
                    <option value="Regular">Regular</option>
                    <option value="PM AAS">PM AAS</option>
                  </select>
                </div>
              )}
            </>
          )}
          <div>
            <label className={lbl}>Keterangan</label>
            <textarea name="keterangan" rows={2} defaultValue={data.keterangan ?? ""} className={kelasIn} />
          </div>
          <div className="flex gap-2 pt-2">
            <Link href={kembali} scroll={false} className="w-1/3 rounded-xl border border-gray-200 py-3 text-center text-xs font-bold text-gray-500 hover:bg-gray-50">
              Batal
            </Link>
            <button type="submit" disabled={proses} className="w-2/3 rounded-xl bg-green-600 py-3 text-xs font-bold text-white shadow-md transition hover:bg-green-700 disabled:opacity-50">
              {proses ? "Menyimpan..." : "Simpan Koreksi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
