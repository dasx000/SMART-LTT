"use client";

import { useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { gagal, memuat, sukses } from "@/lib/swal";

/**
 * Modal form data master, dibuka lewat URL (?edit=ID | ?edit=baru).
 * Isian (children) dirender di server; komponen ini hanya mengirim ke Server Action lalu menutup modal.
 */
export function ModalForm({
  judul,
  aksi,
  kembali,
  children,
}: {
  judul: string;
  aksi: (fd: FormData) => Promise<{ sukses: boolean; pesan: string }>;
  kembali: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [proses, mulai] = useTransition();

  function kirim(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mulai(async () => {
      memuat("Menyimpan...");
      const r = await aksi(fd);
      if (r.sukses) {
        await sukses("Berhasil", r.pesan);
        router.replace(kembali, { scroll: false });
      } else await gagal("Gagal Menyimpan", r.pesan);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <h3 className="font-bold text-gray-800">{judul}</h3>
          <Link href={kembali} scroll={false} aria-label="Tutup" className="rounded-full p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </Link>
        </div>
        <form onSubmit={kirim} className="mt-4 space-y-3.5">
          {children}
          <div className="flex justify-end gap-2 pt-2">
            <Link href={kembali} scroll={false} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50">
              Batal
            </Link>
            <button type="submit" disabled={proses} className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-green-700 disabled:opacity-60">
              {proses ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
