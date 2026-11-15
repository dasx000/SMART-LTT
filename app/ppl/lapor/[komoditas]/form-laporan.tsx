"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { formatAngka } from "@/lib/format";
import { gagal, memuat, sukses } from "@/lib/swal";
import { editLaporanAction, simpanLaporanAction } from "../../actions";

const kelasIn = "w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-green-500";

/** Form laporan Jagung/Ubi Kayu (tampilan aplikasi lama). Selesai simpan → kembali ke daftar (URL). */
export function FormLaporan({
  komoditas, desa, kembali, awal,
}: {
  komoditas: "Jagung" | "Ubi Kayu";
  desa: { id: number; nama: string }[];
  kembali: string;
  awal?: { id: number; desaId: number; tanam: number; panen: number; keterangan: string | null };
}) {
  const router = useRouter();
  const [proses, mulai] = useTransition();

  function kirim(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (awal) fd.set("id", String(awal.id));
    else fd.set("komoditas", komoditas);
    mulai(async () => {
      memuat(awal ? "Memperbarui laporan..." : "Mengirim laporan...");
      const r = awal ? await editLaporanAction(fd) : await simpanLaporanAction(fd);
      if (r.sukses) {
        await sukses("Berhasil!", r.pesan);
        router.replace(kembali);
      } else await gagal("Gagal", r.pesan);
    });
  }

  return (
    <form onSubmit={kirim}>
      <div className="mb-4">
        <label className="mb-1 block text-xs font-bold text-gray-600">
          Pilih Desa Binaan <span className="text-red-500">*</span>
        </label>
        <select name="desaId" required defaultValue={awal?.desaId ?? (desa.length === 1 ? desa[0].id : "")} className={kelasIn}>
          <option value="">-- Pilih Desa --</option>
          {desa.map((d) => (
            <option key={d.id} value={d.id}>{d.nama}</option>
          ))}
        </select>
      </div>
      <div className="mb-4 flex gap-3">
        <div className="w-1/2">
          <label className="mb-1 block text-xs font-bold text-gray-600">
            Luas Tanam (Ha) <span className="text-red-500">*</span>
          </label>
          <input name="realisasiTanam" inputMode="decimal" autoComplete="off" placeholder="0,00" required defaultValue={awal ? formatAngka(awal.tanam) : undefined} className={kelasIn} />
        </div>
        <div className="w-1/2">
          <label className="mb-1 block text-xs font-bold text-gray-600">
            Luas Panen (Ha) <span className="text-red-500">*</span>
          </label>
          <input name="realisasiPanen" inputMode="decimal" autoComplete="off" placeholder="0,00" required defaultValue={awal ? formatAngka(awal.panen) : undefined} className={kelasIn} />
        </div>
      </div>
      <div className="mb-6">
        <label className="mb-1 block text-xs font-bold text-gray-600">Keterangan Tambahan</label>
        <textarea name="keterangan" rows={2} placeholder="Opsional..." defaultValue={awal?.keterangan ?? ""} className={kelasIn} />
      </div>
      <button
        type="submit"
        disabled={proses}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-3 font-bold text-white shadow-lg shadow-green-200 transition active:scale-95 disabled:opacity-60"
      >
        <Send size={16} /> {awal ? "Simpan Perubahan" : "Kirim Laporan"}
      </button>
    </form>
  );
}
