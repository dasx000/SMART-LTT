"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Pencil, Search } from "lucide-react";
import { PER_HAL, Paginasi, useFilterDiUrl } from "@/components/paginasi";
import { urlDengan } from "@/lib/param";

type Desa = { id: number; kode: string; nama: string; kecamatan_id: number };
const kelasFilter = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-500";

/** Filter + tabel + paginasi desa di browser (live search, tanpa panggilan server). */
export function TabelDesa({
  dasar, desa, kecamatan, galat, awal,
}: {
  dasar: string;
  desa: Desa[];
  kecamatan: { id: number; nama: string }[];
  galat: string | null;
  awal: { q: string; kecamatan: number; hal: number };
}) {
  const [cari, setCari] = useState(awal.q);
  const [kec, setKec] = useState(awal.kecamatan);
  const [halDiminta, setHal] = useState(awal.hal);
  const cariTunda = useDeferredValue(cari);
  const namaKec = useMemo(() => new Map(kecamatan.map((k) => [k.id, k.nama])), [kecamatan]);

  const tampil = useMemo(() => {
    const c = cariTunda.trim().toLowerCase();
    return desa.filter((d) => (!kec || d.kecamatan_id === kec) && (!c || d.nama.toLowerCase().includes(c) || d.kode.includes(c)));
  }, [desa, cariTunda, kec]);

  const jmlHal = Math.max(1, Math.ceil(tampil.length / PER_HAL));
  const hal = Math.min(jmlHal, Math.max(1, halDiminta));
  const awalBaris = (hal - 1) * PER_HAL;
  const halIni = tampil.slice(awalBaris, awalBaris + PER_HAL);

  const param = { q: cariTunda.trim() || null, kecamatan: kec || null, hal: hal > 1 ? hal : null };
  useFilterDiUrl(param);

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-[1fr_14rem]">
        <label className="relative block">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={cari}
            onChange={(e) => { setCari(e.target.value); setHal(1); }}
            placeholder="Cari nama atau kode desa..."
            className={`${kelasFilter} pl-9`}
          />
        </label>
        <select value={kec || ""} onChange={(e) => { setKec(Number(e.target.value) || 0); setHal(1); }} className={kelasFilter}>
          <option value="">Semua Kecamatan</option>
          {kecamatan.map((k) => (
            <option key={k.id} value={k.id}>{k.nama}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                <th className="p-3 text-left">No</th>
                <th className="p-3 text-left">Kode</th>
                <th className="p-3 text-left">Nama Desa</th>
                <th className="p-3 text-left">Kecamatan</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {galat ? (
                <tr><td colSpan={5} className="p-6 text-center text-red-500">Gagal memuat: {galat}</td></tr>
              ) : halIni.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">Tidak ada desa yang cocok.</td></tr>
              ) : (
                halIni.map((d, i) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-400">{awalBaris + i + 1}</td>
                    <td className="p-3 font-mono text-xs text-gray-500">{d.kode}</td>
                    <td className="p-3 font-semibold text-gray-800">{d.nama}</td>
                    <td className="p-3 text-gray-600">{namaKec.get(d.kecamatan_id) ?? "-"}</td>
                    <td className="p-3 text-center">
                      <Link href={urlDengan(dasar, {}, { ...param, edit: d.id })} scroll={false} title="Ubah" className="inline-flex rounded-lg bg-blue-50 p-1.5 text-blue-600 hover:bg-blue-100">
                        <Pencil size={14} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 p-3 text-xs text-gray-500">
          <span>
            Menampilkan {halIni.length ? awalBaris + 1 : 0}–{awalBaris + halIni.length} dari {tampil.length} desa
            {tampil.length !== desa.length && ` (total ${desa.length})`}
          </span>
          <Paginasi hal={hal} jmlHal={jmlHal} onPilih={setHal} />
        </div>
      </div>
    </>
  );
}
