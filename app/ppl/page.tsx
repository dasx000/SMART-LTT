import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Carrot, Goal, Leaf, LogOut, Scale, Shuffle, TableProperties, UserCog, Warehouse, Wheat } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { desaBinaanSaya } from "@/lib/data";
import { logout } from "@/app/(auth)/login/actions";

export const metadata: Metadata = { title: "Penyuluh — SMART LTT" };

/**
 * Beranda PPL — tampilan dari aplikasi lama (File_HTML_PPL.html), tetapi setiap menu adalah URL
 * sungguhan (/ppl/lapor/jagung, /ppl/target, ...). Server Component: tanpa JS di browser,
 * hanya mengambil nama + desa binaan.
 */
export default function HalamanPPL() {
  return (
    <KerangkaHalaman judul="SMART LTT" role={["penyuluh", "admin_bpp"]} gaya="ppl">
      <Isi />
    </KerangkaHalaman>
  );
}

async function Isi() {
  const p = await wajibRole("penyuluh", "admin_bpp");
  const desa = await desaBinaanSaya(await supabaseServer(), p.id);

  return (
    <>
      <div className="rounded-b-[2rem] bg-green-600 px-5 pt-8 pb-6 shadow-md">
        {/* Baris atas: label + tombol (Mode BPP │ Keluar); nama di bawah dengan lebar penuh */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-wider text-green-100">PPL KEMENTAN RI</p>
          <div className="flex shrink-0 items-center gap-2">
            {p.role === "admin_bpp" && (
              <>
                <Link
                  href="/bpp"
                  className="flex h-7 items-center gap-1 rounded-full bg-white/15 px-2.5 text-[11px] font-bold text-white ring-1 ring-white/40 transition hover:bg-white/25 active:scale-95"
                >
                  <Shuffle size={12} /> Mode BPP
                </Link>
                <span aria-hidden className="h-5 w-px bg-white/40" />
              </>
            )}
            <form action={logout}>
              <button
                type="submit"
                aria-label="Keluar"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md transition hover:scale-105 active:scale-95"
              >
                <LogOut size={14} className="text-red-500" />
              </button>
            </form>
          </div>
        </div>
        <h1 className="mt-3 text-xl font-bold text-white uppercase">{p.nama}</h1>
        <p className="mt-1 mb-2 text-xs text-green-200">WKPP: {desa.length ? desa.map((d) => d.nama).join(", ") : "Belum ditentukan"}</p>
      </div>

      <div className="mt-6 px-5 pb-10">
        <h2 className="mb-4 border-b border-gray-200 pb-2 text-sm font-bold text-gray-800">Menu Laporan LTT</h2>
        <div className="grid grid-cols-4 gap-3">
          <Ikon href="/ppl/lapor/padi" label="Padi" warna="bg-blue-100 text-blue-600 border-blue-200"><Wheat size={30} /></Ikon>
          <Ikon href="/ppl/lapor/jagung" label="Jagung" warna="bg-yellow-100 text-yellow-600 border-yellow-200"><Leaf size={30} /></Ikon>
          <Ikon href="/ppl/lapor/ubi-kayu" label="Ubi Kayu" warna="bg-orange-100 text-orange-600 border-orange-200"><Carrot size={30} /></Ikon>
        </div>

        <h2 className="mt-8 mb-4 border-b border-gray-200 pb-2 text-sm font-bold text-gray-800">Menu Lainnya</h2>
        <div className="grid grid-cols-4 gap-3">
          <Ikon href="/ppl/produktivitas" label={<>Produk-<br />tivitas</>} warna="bg-lime-100 text-lime-700 border-lime-200"><Scale size={30} /></Ikon>
          <Ikon href="/ppl/produktivitas?tab=sarana" label={<>Sarana<br />Desa</>} warna="bg-orange-100 text-orange-600 border-orange-200"><Warehouse size={30} /></Ikon>
          <Ikon href="/ppl/target" label={<>Target<br />Bulanan</>} warna="bg-cyan-100 text-cyan-600 border-cyan-200"><Goal size={30} /></Ikon>
          <Ikon href="/ppl/rekap" label={<>Rekap<br />Saya</>} warna="bg-purple-100 text-purple-600 border-purple-200"><TableProperties size={30} /></Ikon>
          <Ikon href="/profil" label={<>Ubah<br />Profil</>} warna="bg-amber-100 text-amber-600 border-amber-200"><UserCog size={30} /></Ikon>
        </div>
      </div>
    </>
  );
}

function Ikon({ href, label, warna, children }: { href: string; label: ReactNode; warna: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex flex-col items-center transition hover:scale-105 active:scale-95">
      <div className={`mb-2 flex h-16 w-16 items-center justify-center rounded-2xl border shadow ${warna}`}>{children}</div>
      <span className="text-center text-[11px] leading-tight font-bold text-gray-700">{label}</span>
    </Link>
  );
}
