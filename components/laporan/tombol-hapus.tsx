"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { gagal, konfirmasi, memuat, sukses } from "@/lib/swal";

/** Tombol hapus (soft delete). Satu-satunya JS di baris tabel laporan. */
export function TombolHapus({ id, aksi }: { id: number; aksi: (id: number) => Promise<{ sukses: boolean; pesan: string }> }) {
  const [proses, mulai] = useTransition();
  return (
    <button
      type="button"
      disabled={proses}
      title="Hapus Laporan"
      onClick={async () => {
        if (!(await konfirmasi("Hapus Laporan Ini?", "Laporan yang dihapus dikeluarkan dari rekapitulasi.", "Ya, Hapus"))) return;
        mulai(async () => {
          memuat("Menghapus laporan...");
          const r = await aksi(id);
          if (r.sukses) await sukses("Terhapus!", r.pesan);
          else await gagal("Gagal Menghapus", r.pesan);
        });
      }}
      className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition hover:border-red-500 hover:text-red-500 disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
