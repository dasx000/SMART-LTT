import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Bug, ChevronRight, Microscope, Sprout } from "lucide-react";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { KeteranganSumber } from "./sumber";

export const metadata: Metadata = { title: "Cari OPT — SMART LTT" };

/** /ppl/opt — pilih jenis OPT: Hama, Penyakit, atau Gulma. */
export default function HalamanCariOpt() {
  return (
    <KerangkaHalaman
      judul="Cari OPT"
      role={["penyuluh", "admin_bpp"]}
      panel={{ judul: "Cari OPT", sub: "Bahan aktif & pestisida terdaftar untuk hama, penyakit, gulma" }}
    >
      <div className="space-y-3">
        <Kartu
          href="/ppl/opt/hama"
          judul="Hama"
          ket="Wereng, penggerek batang, ulat grayak, tikus, ..."
          warna="bg-red-100 text-red-600 border-red-200"
        >
          <Bug size={26} />
        </Kartu>
        <Kartu
          href="/ppl/opt/penyakit"
          judul="Penyakit"
          ket="Blas, hawar daun bakteri, bulai, antraknosa, ..."
          warna="bg-violet-100 text-violet-600 border-violet-200"
        >
          <Microscope size={26} />
        </Kartu>
        <Kartu
          href="/ppl/opt/gulma"
          judul="Gulma"
          ket="Rumput teki, alang-alang, gulma daun lebar, ..."
          warna="bg-emerald-100 text-emerald-700 border-emerald-200"
        >
          <Sprout size={26} />
        </Kartu>
      </div>
      <KeteranganSumber />
    </KerangkaHalaman>
  );
}

function Kartu({ href, judul, ket, warna, children }: { href: string; judul: string; ket: string; warna: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-green-300 hover:bg-green-50/40 active:scale-[0.99]"
    >
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${warna}`}>{children}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-800">{judul}</p>
        <p className="mt-0.5 truncate text-xs text-gray-500">{ket}</p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-gray-400" />
    </Link>
  );
}
