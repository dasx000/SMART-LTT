"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, FileUp, Upload, X } from "lucide-react";
import type { HasilImpor } from "@/app/kab/laporan/impor-actions";
import { gagal, memuat, sukses } from "@/lib/swal";

/**
 * Impor Excel ekspor Laporan LTT e-Pusluh (padi), dibuka lewat URL (?impor=1).
 * Dua langkah: Periksa (pratinjau, tidak menulis apa pun) → Simpan.
 */
export function FormImpor({
  aksi,
  kembali,
}: {
  aksi: (fd: FormData) => Promise<HasilImpor>;
  kembali: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [hasil, setHasil] = useState<HasilImpor | null>(null);
  const [proses, mulai] = useTransition();

  function kirim(mode: "pratinjau" | "simpan") {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("mode", mode);
    mulai(async () => {
      if (mode === "simpan") memuat("Menyimpan laporan...");
      const r = await aksi(fd);
      if (mode === "pratinjau") {
        setHasil(r);
        return;
      }
      if (r.sukses) {
        await sukses("Impor Berhasil", r.pesan);
        router.replace(kembali, { scroll: false });
      } else {
        setHasil(r);
        await gagal("Impor Gagal", r.pesan);
      }
    });
  }

  const r = hasil?.ringkas;
  const akanDisimpan = r ? r.ditambah + r.diperbarui : 0;
  // Sudah diperiksa tapi tidak ada yang bisa disimpan → info (kuning), tombol jadi "Tutup"
  const tanpaPerubahan = Boolean(hasil?.sukses && akanDisimpan === 0);
  const warnaKotak = !hasil?.sukses ? "border-red-200 bg-red-50" : tanpaPerubahan ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50";
  const warnaPesan = !hasil?.sukses ? "text-red-700" : tanpaPerubahan ? "text-amber-700" : "text-green-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <h3 className="flex items-center gap-2 font-bold text-gray-800">
            <FileUp size={18} className="text-green-600" /> Impor Excel e-Pusluh (Padi)
          </h3>
          <Link href={kembali} scroll={false} aria-label="Tutup" className="rounded-full p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </Link>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Unggah file <b>Laporan LTT</b> hasil ekspor e-Pusluh (.xlsx, maks. 5 MB). Laporan dicocokkan berdasarkan <b>ID Laporan</b>:
          ID baru ditambahkan, ID yang sudah ada diperbarui, tidak ada data yang dihapus. Laporan nihil (semua luas 0) tidak disimpan,
          sama dengan bot. Komoditas otomatis Padi.
        </p>

        <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-5 text-center hover:border-green-400">
          <Upload size={22} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">{file ? file.name : "Pilih file .xlsx"}</span>
          {file && <span className="text-[11px] text-gray-400">{(file.size / 1024).toFixed(0)} KB</span>}
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setHasil(null);
            }}
          />
        </label>

        {hasil && (
          <div className={`mt-4 rounded-xl border p-3 text-xs ${warnaKotak}`}>
            <p className={`flex items-start gap-1.5 font-semibold ${warnaPesan}`}>
              {hasil.sukses && !tanpaPerubahan ? <CircleCheck size={14} className="mt-0.5 shrink-0" /> : <CircleAlert size={14} className="mt-0.5 shrink-0" />}
              {hasil.pesan}
            </p>
            {r && (
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
                <dt>Baris di file</dt><dd className="text-right font-bold text-gray-800">{r.barisFile}</dd>
                <dt>Tanggal laporan</dt><dd className="text-right font-bold text-gray-800">{r.tanggal.join(", ") || "-"}</dd>
                <dt className="text-green-700">Akan ditambahkan</dt><dd className="text-right font-bold text-green-700">{r.ditambah}</dd>
                <dt className="text-blue-700">Akan diperbarui</dt><dd className="text-right font-bold text-blue-700">{r.diperbarui}</dd>
                {r.nihil > 0 && (<><dt className="text-gray-500">Nihil (tidak disimpan)</dt><dd className="text-right font-bold text-gray-500">{r.nihil}</dd></>)}
                {r.dilewati > 0 && (<><dt className="text-orange-600">Dilewati (data lama)</dt><dd className="text-right font-bold text-orange-600">{r.dilewati}</dd></>)}
                {r.desaTakCocok.length > 0 && (<><dt className="text-red-600">Desa tidak dikenali</dt><dd className="text-right font-bold text-red-600">{r.desaTakCocok.length}</dd></>)}
                {r.tanggalGagal > 0 && (<><dt className="text-red-600">Waktu tidak terbaca</dt><dd className="text-right font-bold text-red-600">{r.tanggalGagal}</dd></>)}
                {r.idTidakValid > 0 && (<><dt className="text-red-600">ID tidak valid</dt><dd className="text-right font-bold text-red-600">{r.idTidakValid}</dd></>)}
                {r.idGanda > 0 && (<><dt className="text-red-600">ID ganda di file</dt><dd className="text-right font-bold text-red-600">{r.idGanda}</dd></>)}
              </dl>
            )}
            {r && r.wilayahDilewati.length > 0 && (
              <p className="mt-2 text-orange-700">
                Tanggal + kecamatan ini masih berisi data lama (ID SYNC), jadi dilewati agar tidak ganda: {r.wilayahDilewati.join("; ")}
              </p>
            )}
            {r && r.desaTakCocok.length > 0 && (
              <p className="mt-2 text-red-700">Desa tidak ada di database (baris tidak diimpor): {r.desaTakCocok.join("; ")}</p>
            )}
            {r && r.jenisBaru.length > 0 && <p className="mt-2 text-gray-600">Jenis LTT baru yang akan didaftarkan: {r.jenisBaru.join(", ")}</p>}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          {tanpaPerubahan ? (
            <Link href={kembali} scroll={false} className="rounded-xl bg-gray-700 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-gray-800">
              Tutup
            </Link>
          ) : (
            <Link href={kembali} scroll={false} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50">
              Batal
            </Link>
          )}
          {tanpaPerubahan ? null : hasil?.sukses && akanDisimpan > 0 ? (
            <button
              type="button"
              disabled={proses}
              onClick={() => kirim("simpan")}
              className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-green-700 disabled:opacity-60"
            >
              Simpan {akanDisimpan} Laporan
            </button>
          ) : (
            <button
              type="button"
              disabled={!file || proses}
              onClick={() => kirim("pratinjau")}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-60"
            >
              {proses ? "Memeriksa..." : "Periksa File"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
