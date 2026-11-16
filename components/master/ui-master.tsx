import Link from "next/link";
import type { ReactNode } from "react";
import { Database, Plus } from "lucide-react";
import { TautanUrlKini } from "@/components/tautan-url-kini";

export const kelasIn = "w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-medium outline-none focus:border-green-500";
export const lbl = "mb-1 block text-xs font-semibold text-gray-700";

const kelasTambah = "flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-green-700";

/**
 * Judul halaman master + tombol Tambah.
 * `tambah` = URL tetap, atau `{ dasar }` → ?edit=baru di atas URL saat ini (untuk tabel yang filternya di browser).
 */
export function KepalaMaster({ judul, sub, tambah, label }: { judul: string; sub: string; tambah: string | { dasar: string }; label: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-green-700 uppercase">
          <Database size={12} /> Master Data
        </p>
        <h2 className="text-xl font-bold text-gray-800">{judul}</h2>
        <p className="text-[11px] text-gray-500">{sub}</p>
      </div>
      {typeof tambah === "string" ? (
        <Link href={tambah} scroll={false} className={kelasTambah}>
          <Plus size={16} /> {label}
        </Link>
      ) : (
        <TautanUrlKini dasar={tambah.dasar} ubah={{ edit: "baru" }} className={kelasTambah}>
          <Plus size={16} /> {label}
        </TautanUrlKini>
      )}
    </div>
  );
}

/** Kotak catatan aturan (kuning). */
export function Catatan({ children }: { children: ReactNode }) {
  return <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{children}</div>;
}

/** Bidang isian berlabel. */
export function Bidang({ label, wajib, bantuan, children }: { label: string; wajib?: boolean; bantuan?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={lbl}>
        {label} {wajib && <span className="text-red-500">*</span>}
      </span>
      {children}
      {bantuan && <span className="mt-1 block text-[11px] text-gray-400">{bantuan}</span>}
    </label>
  );
}
