import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Carrot, ChevronRight, Goal, Leaf, LogOut, TriangleAlert, Scale, Shuffle, TableProperties, UserCog, UserRoundCheck, Warehouse, Wheat } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { desaBinaanSaya, type DesaRef } from "@/lib/data";
import { NAMA_BULAN, ZONA_WIB, tanggalIsoWIB } from "@/lib/format";
import { logout } from "@/app/(auth)/login/actions";
import { IkonPasangAplikasi } from "@/components/pasang-aplikasi";

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

/** Sapaan sesuai jam WIB saat halaman dibuka. */
function sapaanWIB(): string {
  const jam = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: ZONA_WIB }).format(new Date()));
  if (jam >= 4 && jam < 11) return "Selamat pagi";
  if (jam >= 11 && jam < 15) return "Selamat siang";
  if (jam >= 15 && jam < 18) return "Selamat sore";
  return "Selamat malam";
}

async function Isi() {
  const p = await wajibRole("penyuluh", "admin_bpp");
  const s = await supabaseServer();
  const desa = await desaBinaanSaya(s, p.id);
  const kurang = await targetPadiBelumDiisi(s, desa);

  return (
    <>
      <div className="rounded-b-[2rem] bg-green-600 px-5 pt-8 pb-6 shadow-md">
        {/* Baris atas: label + tombol (Mode BPP │ Keluar); nama di bawah dengan lebar penuh */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Image src="/logo.webp" alt="" width={40} height={40} priority className="h-10 w-10 shrink-0 object-contain drop-shadow" />
            <div className="min-w-0">
              <p className="text-lg leading-tight font-extrabold tracking-wider text-white">SMART LTT</p>
              <p className="truncate text-[10px] font-semibold tracking-wide text-green-100">PPL Kementan RI · Way Kanan</p>
            </div>
          </div>
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
        <div className="mt-5 rounded-2xl bg-white/15 px-4 py-3 ring-1 ring-white/25 backdrop-blur-sm">
          <p className="text-xs text-green-100">{sapaanWIB()},</p>
          <h1 className="text-xl leading-snug font-bold text-white uppercase">{p.nama}</h1>
          <p className="mt-1 text-xs text-green-100">WKPP: {desa.length ? desa.map((d) => d.nama).join(", ") : "Belum ditentukan"}</p>
        </div>
      </div>

      <div className="mt-6 px-5 pb-10">
        {kurang && <PeringatanTargetPadi {...kurang} />}

        <h2 className="mb-4 border-b border-gray-200 pb-2 text-sm font-bold text-gray-800">Menu Laporan LTT</h2>
        <div className="grid grid-cols-4 gap-3">
          <Ikon href="/ppl/lapor/padi" label="Padi" warna="bg-blue-100 text-blue-600 border-blue-200"><Wheat size={30} /></Ikon>
          <Ikon href="/ppl/lapor/jagung" label="Jagung" warna="bg-yellow-100 text-yellow-600 border-yellow-200"><Leaf size={30} /></Ikon>
          <Ikon href="/ppl/lapor/ubi-kayu" label="Ubi Kayu" warna="bg-orange-100 text-orange-600 border-orange-200"><Carrot size={30} /></Ikon>
        </div>

        <h2 className="mt-8 mb-4 border-b border-gray-200 pb-2 text-sm font-bold text-gray-800">Menu Lainnya</h2>
        <div className="grid grid-cols-4 gap-3">
          <Ikon href="/ppl/realisasi" label={<>Realisasi<br />LTT</>} warna="bg-green-100 text-green-700 border-green-200"><UserRoundCheck size={30} /></Ikon>
          <Ikon href="/ppl/produktivitas" label={<>Produk-<br />tivitas</>} warna="bg-lime-100 text-lime-700 border-lime-200"><Scale size={30} /></Ikon>
          <Ikon href="/ppl/produktivitas?tab=sarana" label={<>Sarana<br />Desa</>} warna="bg-orange-100 text-orange-600 border-orange-200"><Warehouse size={30} /></Ikon>
          <Ikon href="/ppl/target" label={<>Target<br />Bulanan</>} warna="bg-cyan-100 text-cyan-600 border-cyan-200"><Goal size={30} /></Ikon>
          <Ikon href="/ppl/rekap" label={<>Rekap<br />Saya</>} warna="bg-purple-100 text-purple-600 border-purple-200"><TableProperties size={30} /></Ikon>
          <Ikon href="/profil" label={<>Ubah<br />Profil</>} warna="bg-amber-100 text-amber-600 border-amber-200"><UserCog size={30} /></Ikon>
          <IkonPasangAplikasi />
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

/** Peringatan target Padi tampil tanggal 5–20 (WIB) bulan berjalan. */
const TANGGAL_PERINGATAN = { dari: 5, sampai: 20 };

type KurangTarget = { tahun: number; bulan: number; belum: string[]; total: number };

/**
 * Desa binaan yang belum punya baris target PADI untuk bulan berjalan (WIB).
 * Hanya diperiksa tanggal 5–20; di luar itu / semua terisi / tidak ada desa → null.
 * "Terisi" = baris target_desa ada (sama dengan hitungan "Terisi x / y desa" di menu Target).
 */
async function targetPadiBelumDiisi(s: Awaited<ReturnType<typeof supabaseServer>>, desa: DesaRef[]): Promise<KurangTarget | null> {
  if (desa.length === 0) return null;
  const [y, m, d] = tanggalIsoWIB().split("-").map(Number);
  if (d < TANGGAL_PERINGATAN.dari || d > TANGGAL_PERINGATAN.sampai) return null;
  const { data, error } = await s
    .from("target_desa")
    .select("desa_id")
    .eq("tahun", y)
    .eq("bulan", m)
    .eq("komoditas", "Padi")
    .in("desa_id", desa.map((x) => x.id));
  if (error) return null; // gagal membaca → jangan tampilkan peringatan yang belum tentu benar
  const terisi = new Set((data ?? []).map((r) => r.desa_id as number));
  const belum = desa.filter((x) => !terisi.has(x.id)).map((x) => x.nama);
  return belum.length ? { tahun: y, bulan: m, belum, total: desa.length } : null;
}

function PeringatanTargetPadi({ tahun, bulan, belum, total }: KurangTarget) {
  return (
    <Link
      href={`/ppl/target?tahun=${tahun}&bulan=${bulan}&komoditas=Padi`}
      className="mb-6 flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 transition hover:bg-red-100 active:scale-[0.99]"
    >
      <TriangleAlert size={20} className="mt-0.5 shrink-0 text-red-600" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold text-red-900">Target Padi {NAMA_BULAN[bulan - 1]} {tahun} belum diisi</p>
        <p className="mt-0.5 text-red-800">
          {belum.length} dari {total} desa binaan: {belum.join(", ")}.
        </p>
        <p className="mt-1.5 text-xs text-red-800"><b>Wajib diisi</b> karena capaian LTT jadi salah satu dasar penilaian <b>SKP</b>.</p>
        <p className="mt-1 text-xs font-semibold text-red-700">Ketuk untuk mengisi target</p>
      </div>
      <ChevronRight size={18} className="mt-0.5 shrink-0 text-red-500" />
    </Link>
  );
}
