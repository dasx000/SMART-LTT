"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { gagal, konfirmasi, memuat, sukses } from "@/lib/swal";
import { hapusPenggunaAction } from "@/app/kab/pengguna/actions";

/** Tombol hapus pengguna dari SMART LTT (Admin Kab). Akun login & laporan lama tidak ikut terhapus. */
export function TombolHapusPengguna({ id, nama }: { id: string; nama: string }) {
  const [proses, mulai] = useTransition();
  return (
    <button
      type="button"
      disabled={proses}
      title="Hapus dari SMART LTT"
      onClick={async () => {
        const ya = await konfirmasi(
          `Hapus ${nama}?`,
          "Akun dicabut dari SMART LTT: tidak bisa login lagi, hilang dari daftar, dan desa binaannya dilepas. Laporan yang pernah dikirim tetap tersimpan.",
          "Ya, Hapus",
        );
        if (!ya) return;
        mulai(async () => {
          memuat("Menghapus pengguna...");
          const r = await hapusPenggunaAction({ id });
          if (r.sukses) await sukses("Terhapus!", r.pesan);
          else await gagal("Gagal Menghapus", r.pesan);
        });
      }}
      className="inline-flex rounded-lg bg-red-50 p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-50"
    >
      <Trash2 size={14} />
    </button>
  );
}
