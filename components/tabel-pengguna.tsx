"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Pencil, Search, X } from "lucide-react";
import { PER_HAL, Paginasi, useFilterDiUrl } from "@/components/paginasi";
import type { Role } from "@/lib/auth";
import { urlDengan } from "@/lib/param";
import { TombolHapusPengguna } from "@/components/tombol-hapus-pengguna";

export type BarisPengguna = {
  id: string;
  nama: string;
  nip: string;
  whatsapp: string | null;
  role: Role;
  aktif: boolean;
  kecamatanId: number | null;
  wilayah: string;
  desaTeks: string;
};

const LABEL_ROLE: Record<Role, string> = { penyuluh: "Penyuluh", admin_bpp: "Admin BPP", admin_kab: "Admin Kab", viewer: "Viewer" };
const WARNA_ROLE: Record<Role, string> = {
  penyuluh: "bg-green-100 text-green-700",
  admin_bpp: "bg-blue-100 text-blue-700",
  admin_kab: "bg-purple-100 text-purple-700",
  viewer: "bg-gray-100 text-gray-600",
};
const kelasIn = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-500";
const lbl = "mb-1 block text-[10px] font-bold tracking-wide text-gray-400 uppercase";

/**
 * Filter + tabel + paginasi pengguna, semuanya di browser (live search).
 * Data diambil sekali oleh server; mengetik / ganti filter / pindah halaman tidak memanggil server.
 * Nilai filter disalin ke URL (replaceState) agar tetap ada saat buka form ubah atau muat ulang.
 */
export function TabelPengguna({
  dasar, mode, baris, kecamatan, awal, idSaya,
}: {
  dasar: string;
  idSaya: string;
  mode: "bpp" | "kab";
  baris: BarisPengguna[];
  kecamatan: { id: number; nama: string }[];
  awal: { q: string; role: string; kecamatan: number; hal: number };
}) {
  const [cari, setCari] = useState(awal.q);
  const [role, setRole] = useState(awal.role);
  const [kec, setKec] = useState(awal.kecamatan);
  const [halDiminta, setHal] = useState(awal.hal);
  const cariTunda = useDeferredValue(cari);

  const tampil = useMemo(() => {
    const c = cariTunda.trim().toLowerCase();
    return baris.filter(
      (u) => (!role || u.role === role) && (!kec || u.kecamatanId === kec) && (!c || u.nama.toLowerCase().includes(c) || u.nip.includes(c)),
    );
  }, [baris, cariTunda, role, kec]);

  const jmlHal = Math.max(1, Math.ceil(tampil.length / PER_HAL));
  const hal = Math.min(jmlHal, Math.max(1, halDiminta));
  const awalBaris = (hal - 1) * PER_HAL;
  const halIni = tampil.slice(awalBaris, awalBaris + PER_HAL);
  const jmlAktif = useMemo(() => tampil.filter((u) => u.aktif).length, [tampil]);

  const param = { q: cariTunda.trim() || null, role: role || null, kecamatan: kec || null, hal: hal > 1 ? hal : null };

  useFilterDiUrl(param);

  const ubahFilter = (f: () => void) => {
    f();
    setHal(1);
  };
  const adaFilter = !!(cari || role || kec);

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-[1fr_12rem_12rem_auto]">
        <label>
          <span className={lbl}>Cari Nama / NIP</span>
          <span className="relative block">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-gray-400" />
            <input
              type="search"
              value={cari}
              onChange={(e) => ubahFilter(() => setCari(e.target.value))}
              placeholder="Ketik nama atau NIP..."
              className={`${kelasIn} pl-9`}
            />
          </span>
        </label>
        {mode === "kab" && (
          <>
            <label>
              <span className={lbl}>Role</span>
              <select value={role} onChange={(e) => ubahFilter(() => setRole(e.target.value))} className={kelasIn}>
                <option value="">Semua Role</option>
                {Object.entries(LABEL_ROLE).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              <span className={lbl}>Kecamatan</span>
              <select value={kec || ""} onChange={(e) => ubahFilter(() => setKec(Number(e.target.value) || 0))} className={kelasIn}>
                <option value="">Semua Kecamatan</option>
                {kecamatan.map((k) => (
                  <option key={k.id} value={k.id}>{k.nama}</option>
                ))}
              </select>
            </label>
          </>
        )}
        <button
          type="button"
          disabled={!adaFilter}
          onClick={() => ubahFilter(() => { setCari(""); setRole(""); setKec(0); })}
          className="flex items-center justify-center gap-1 self-end rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          <X size={14} /> Reset
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                <th className="p-3 text-left">No</th>
                <th className="p-3 text-left">Nama &amp; NIP</th>
                <th className="p-3 text-left">WhatsApp</th>
                <th className="p-3 text-left">Role</th>
                <th className="p-3 text-center">Wilayah Kerja</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {halIni.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-400">Tidak ada pengguna yang cocok.</td>
                </tr>
              )}
              {halIni.map((u, i) => (
                <tr key={u.id} className={u.aktif ? "hover:bg-gray-50" : "bg-gray-50/60 text-gray-400"}>
                  <td className="p-3 text-gray-400">{awalBaris + i + 1}</td>
                  <td className="p-3">
                    <p className="text-sm font-bold text-gray-800">{u.nama}</p>
                    <p className="text-[10px] text-gray-400">{u.nip}</p>
                  </td>
                  <td className="p-3 text-gray-500">{u.whatsapp || "-"}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${WARNA_ROLE[u.role]}`}>{LABEL_ROLE[u.role]}</span>
                  </td>
                  <td className="p-3 text-center">
                    <p className="text-gray-700">{u.wilayah}</p>
                    {u.desaTeks && <p className="text-[10px] text-gray-400">{u.desaTeks}</p>}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${u.aktif ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {u.aktif ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="inline-flex gap-1.5">
                      <Link href={urlDengan(dasar, {}, { ...param, edit: u.id })} scroll={false} title="Ubah" className="inline-flex rounded-lg bg-blue-50 p-1.5 text-blue-600 hover:bg-blue-100">
                        <Pencil size={14} />
                      </Link>
                      {mode === "kab" && u.id !== idSaya && <TombolHapusPengguna id={u.id} nama={u.nama} />}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 p-3 text-xs text-gray-500">
          <span>
            Menampilkan {halIni.length ? awalBaris + 1 : 0}–{awalBaris + halIni.length} dari {tampil.length} pengguna · {jmlAktif} aktif
          </span>
          <Paginasi hal={hal} jmlHal={jmlHal} onPilih={setHal} />
        </div>
      </div>
    </>
  );
}
