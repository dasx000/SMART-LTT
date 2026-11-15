"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatAngka } from "@/lib/format";
import { gagal, memuat, sukses } from "@/lib/swal";
import { simpanTargetPmAasAction } from "./actions";

/** Form "Set Target" PM AAS — dibuka lewat URL (?set=1). */
export function FormTargetPmAas({ tahun, bulan, nilai, kembali }: { tahun: number; bulan: number; nilai: number; kembali: string }) {
  const router = useRouter();
  const [proses, mulai] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("tahun", String(tahun));
        fd.set("bulan", String(bulan));
        mulai(async () => {
          memuat("Menyimpan target...");
          const r = await simpanTargetPmAasAction(fd);
          if (r.sukses) {
            await sukses("Berhasil!", r.pesan);
            router.replace(kembali, { scroll: false });
          } else await gagal("Gagal", r.pesan);
        });
      }}
      className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3"
    >
      <label className="flex-1 text-[11px] font-bold text-gray-600">
        Target Tanam PM AAS (Ha)
        <input
          name="targetTanam"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={nilai ? formatAngka(nilai) : ""}
          placeholder="0,00"
          required
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-500"
        />
      </label>
      <Link href={kembali} scroll={false} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-500">
        Batal
      </Link>
      <button type="submit" disabled={proses} className="rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
        Simpan
      </button>
    </form>
  );
}
