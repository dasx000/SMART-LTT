"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft, DatabaseBackup, Goal, ChartLine, ChartPie, FileText, History, House, KeyRound, Leaf, LockKeyhole, Map as Peta, Menu, PanelLeftClose, PanelLeftOpen, Power,
  Scale, Shuffle, Sprout, Tags, UserCog, Users, Warehouse, X, Shield, Target,
} from "lucide-react";
import { logout } from "@/app/(auth)/login/actions";
import type { Role } from "@/lib/auth";

type Item = {
  href: string;
  label: string;
  ikon: ReactNode;
  role?: Role[];
  /** sub-halaman yang juga menandai menu ini aktif */
  awalan?: string;
  /** judul kelompok yang ditampilkan di atas item ini */
  grup?: string;
};

/** Menu sidebar — urutan & label mengikuti aplikasi lama. Verifikasi & Pemeliharaan dihapus (keputusan §25). */
const MENU_KAB: Item[] = [
  { href: "/kab", label: "Smart Dashboard", ikon: <ChartPie size={18} />, awalan: "/kab/rekap" },
  { href: "/kab/pm-aas", label: "LTT PM AAS", ikon: <Sprout size={18} /> },
  { href: "/kab/laporan", label: "Laporan LTT", ikon: <FileText size={18} />, role: ["admin_kab"] },
  { href: "/kab/produktivitas", label: "Produktivitas", ikon: <Scale size={18} />, role: ["admin_kab"] },
  { href: "/kab/sarana", label: "Sarana Desa", ikon: <Warehouse size={18} />, role: ["admin_kab"] },
  { href: "/kab/pengguna", label: "Manajemen Penyuluh", ikon: <UserCog size={18} />, role: ["admin_kab"] },
  { href: "/kab/target", label: "Target Komoditas", ikon: <Goal size={18} />, role: ["admin_kab"] },
  { href: "/kab/logs", label: "Log Sinkronisasi", ikon: <History size={18} />, role: ["admin_kab"] },
  { href: "/kab/backup", label: "Backup Data", ikon: <DatabaseBackup size={18} />, role: ["admin_kab"] },
  { href: "/kab/master/kecamatan", label: "Kecamatan", ikon: <Peta size={18} />, role: ["admin_kab"], grup: "Master Data" },
  { href: "/kab/master/desa", label: "Desa", ikon: <House size={18} />, role: ["admin_kab"] },
  { href: "/kab/master/jenis-ltt", label: "Jenis LTT", ikon: <Tags size={18} />, role: ["admin_kab"] },
  { href: "/kab/akses-api", label: "Akses API", ikon: <KeyRound size={18} />, role: ["admin_kab"], grup: "Integrasi", awalan: "/kab/akses-api" },
  { href: "/profil", label: "Profil Saya", ikon: <LockKeyhole size={18} />, grup: "Akun" },
];

const MENU_BPP: Item[] = [
  { href: "/bpp", label: "Dashboard", ikon: <ChartLine size={18} /> },
  { href: "/bpp/laporan", label: "Laporan LTT", ikon: <FileText size={18} /> },
  { href: "/bpp/target-kecamatan", label: "Target Kecamatan", ikon: <Goal size={18} /> },
  { href: "/bpp/target", label: "Target Desa PPL", ikon: <Target size={18} /> },
  { href: "/bpp/produktivitas", label: "Produktivitas & Sarana", ikon: <Warehouse size={18} /> },
  { href: "/bpp/pengguna", label: "Manajemen Akun PPL", ikon: <Users size={18} /> },
];

const KUNCI_CIUT = "ltt-sidebar-kab-ciut";

const LABEL_ROLE: Record<Role, string> = {
  penyuluh: "Penyuluh",
  admin_bpp: "Koordinator BPP",
  admin_kab: "Admin Kabupaten",
  viewer: "Viewer",
};

export function KerangkaAdmin({
  gaya,
  judul,
  nama,
  role,
  children,
}: {
  gaya: "bpp" | "kab";
  judul: string;
  nama: string;
  role: Role;
  children: ReactNode;
}) {
  const [buka, setBuka] = useState(false);
  /** Desktop: sidebar diciutkan (default terbuka). Diingat per browser agar tetap saat pindah halaman. */
  const [ciut, setCiut] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(KUNCI_CIUT) === "1") setCiut(true);
    } catch {}
  }, []);
  const alihCiut = () => {
    setCiut((c) => {
      try {
        localStorage.setItem(KUNCI_CIUT, c ? "0" : "1");
      } catch {}
      return !c;
    });
  };
  const path = usePathname();
  const menu = (gaya === "kab" ? MENU_KAB : MENU_BPP).filter((m) => !m.role || m.role.includes(role));
  const isKab = gaya === "kab";

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-gray-100 font-sans text-gray-800">
      {/* Latar gelap saat sidebar terbuka di HP */}
      {buka && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setBuka(false)} aria-hidden />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-green-800 text-white shadow-2xl transition-all duration-300 md:relative md:translate-x-0 ${
          buka ? "translate-x-0" : "-translate-x-full"
        } ${isKab && ciut ? "md:-ml-64 md:shadow-none" : ""}`}
        inert={isKab && ciut && !buka ? true : undefined}
      >
        <div className={`flex items-center justify-between border-b border-green-700 px-4 ${isKab ? "h-20" : "h-16"}`}>
          {isKab ? (
            <div className="flex items-center">
              <Image src="/logo.webp" alt="" width={36} height={36} className="mr-3 h-9 w-9 object-contain drop-shadow" />
              <div>
                <p className="text-xl font-bold tracking-wider">SMART LTT</p>
                <p className="text-[10px] text-green-300">CWS Kabupaten Way Kanan</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-white p-1 text-green-700">
                <Leaf size={18} />
              </div>
              <span className="text-sm font-bold tracking-wide">Menu BPP</span>
            </div>
          )}
          <button type="button" onClick={() => setBuka(false)} className="p-2 text-green-300 hover:text-white md:hidden" aria-label="Tutup menu">
            <X size={22} />
          </button>
        </div>

        <nav className={`flex-1 space-y-1 overflow-y-auto ${isKab ? "px-4 py-6" : "px-2 py-4"}`}>
          {menu.map((m) => {
            const aktif = path === m.href || Boolean(m.awalan && path.startsWith(m.awalan));
            return (
              <div key={m.href}>
                {m.grup && (
                  <p className="mt-5 mb-1 border-t border-green-700 px-4 pt-4 text-[10px] font-bold tracking-widest text-green-300 uppercase">{m.grup}</p>
                )}
              <Link
                href={m.href}
                onClick={() => setBuka(false)}
                aria-current={aktif ? "page" : undefined}
                className={
                  isKab
                    ? `flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition ${aktif ? "bg-green-700 font-bold text-white" : "text-green-200 hover:bg-green-700 hover:text-white"}`
                    : `flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${aktif ? "bg-green-900 text-white" : "text-green-100 hover:bg-green-700 hover:text-white"}`
                }
              >
                <span className="w-5 shrink-0">{m.ikon}</span> {m.label}
              </Link>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-green-700 p-4">
          {isKab ? (
            <form action={logout}>
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition hover:bg-red-700">
                <Power size={16} /> Keluar
              </button>
            </form>
          ) : (
            <Link
              href="/ppl"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-600 to-teal-500 px-4 py-2.5 text-xs font-bold text-white transition hover:from-emerald-500 hover:to-teal-400"
            >
              <ArrowLeft size={14} /> Kembali ke PPL
            </Link>
          )}
        </div>
      </aside>

      <div className="relative flex h-screen flex-1 flex-col overflow-y-auto bg-gray-100">
        {isKab ? (
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between bg-white px-4 shadow-sm sm:h-20 sm:px-8">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setBuka(true)} className="-ml-2 rounded-lg p-2 text-green-700 transition hover:bg-green-50 md:hidden" aria-label="Buka menu">
                <Menu size={22} />
              </button>
              <button
                type="button"
                onClick={alihCiut}
                className="-ml-2 hidden rounded-lg p-2 text-green-700 transition hover:bg-green-50 md:inline-flex"
                aria-label={ciut ? "Buka sidebar" : "Tutup sidebar"}
                aria-expanded={!ciut}
                title={ciut ? "Buka sidebar" : "Tutup sidebar"}
              >
                {ciut ? <PanelLeftOpen size={22} /> : <PanelLeftClose size={22} />}
              </button>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-right">
                <p className="text-xs font-bold text-gray-800 sm:text-sm">{nama}</p>
                <p className="text-[9px] text-gray-500 uppercase sm:text-[10px]">{LABEL_ROLE[role]}</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 sm:h-10 sm:w-10">
                <Shield size={18} />
              </div>
            </div>
          </header>
        ) : (
          <header className="sticky top-0 z-30 shrink-0 bg-green-700 text-white shadow-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setBuka(true)} className="rounded-lg p-2 text-white transition hover:text-green-200 active:scale-95 md:hidden" aria-label="Buka menu">
                  <Menu size={22} />
                </button>
                <h1 className="text-lg font-bold tracking-wide">{judul}</h1>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-bold">{nama}</p>
                  <p className="text-[10px] text-green-200 uppercase">{LABEL_ROLE[role]}</p>
                </div>
                <Link
                  href="/ppl"
                  title="Kembali ke PPL"
                  className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-bold text-green-700 shadow transition hover:bg-green-50 active:scale-95"
                >
                  <Shuffle size={15} /> Mode PPL
                </Link>
              </div>
            </div>
          </header>
        )}

        <main className={isKab ? "w-full flex-1 p-4 sm:p-6 lg:p-8" : "mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-8 sm:px-6 lg:px-8"}>{children}</main>
      </div>
    </div>
  );
}
