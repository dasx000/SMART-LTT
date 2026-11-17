"use client";

import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";
import { formatAngka } from "@/lib/format";
import { levelPersen } from "@/lib/warna-persen";
import type { KecRealisasi, PplRealisasi } from "@/lib/realisasi-ppl";

const td = "border border-gray-100 p-2.5";
const tdAngka = `${td} text-right tabular-nums`;
const Strip = () => <span className="text-gray-300">–</span>;

/** Sel capaian berwarna (<60 merah, 60–84,99 kuning, ≥85 hijau); null → "–" abu. */
/** `rapat` = versi HP (tabel PPL): tanpa lebar tetap, padding kecil. */
export function SelCapaianPpl({ p, tebal = true, rapat = false }: { p: number | null; tebal?: boolean; rapat?: boolean }) {
  const dasar = rapat ? "border border-gray-100 px-1.5 py-2 sm:p-2.5 whitespace-nowrap" : `${td} w-28`;
  if (p == null) return <td className={`${dasar} bg-gray-100 text-center font-bold text-gray-400`}>–</td>;
  return <td className={`${dasar} text-right tabular-nums ${tebal ? "font-extrabold" : "font-bold"} ${levelPersen(p).kelas}`}>{formatAngka(p)}%</td>;
}

export function StatusTarget({ terisi, jumlah }: { terisi: number; jumlah: number }) {
  const dasar = "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-extrabold";
  if (terisi === 0) return <span className={`${dasar} bg-red-100 text-red-700`}>Belum isi target</span>;
  if (terisi < jumlah) return <span className={`${dasar} border border-orange-200 bg-orange-50 text-orange-700`}>Target belum lengkap ({terisi}/{jumlah} desa)</span>;
  return <span className={`${dasar} bg-green-100 text-green-800`}>Lengkap ({terisi}/{jumlah} desa)</span>;
}

const LABEL_ROLE: Record<string, string> = { penyuluh: "Penyuluh", admin_bpp: "Admin BPP" };

/**
 * Tabel Realisasi per PPL (Kab/Viewer & BPP): baris jumlah kabupaten (Kab saja) di atas,
 * lalu per kecamatan (subtotal) → PPL. Klik PPL untuk membuka rincian per desa.
 */
export function TabelRealisasiPpl({
  kec,
  total,
  peringkat,
}: {
  kec: KecRealisasi[];
  /** baris JUMLAH KABUPATEN (null = tidak ditampilkan) */
  total: { target: number; realisasi: number; capaian: number | null } | null;
  /** tampilkan label "Terendah #n" di baris kecamatan (hanya bermakna bila semua kecamatan tampil) */
  peringkat: boolean;
}) {
  const [buka, setBuka] = useState<Set<string>>(() => new Set());
  const alih = (id: string) =>
    setBuka((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-xs">
        <thead>
          <tr className="bg-gray-50 text-[10px] font-extrabold tracking-wide text-gray-500 uppercase">
            <th className={`${td} w-12 text-center`}>No</th>
            <th className={`${td} text-left`}>Nama PPL / Desa Binaan</th>
            <th className={`${td} text-left`}>Status Target</th>
            <th className={`${td} text-right`}>Target (Jumlah Target Desa, Ha)</th>
            <th className={`${td} text-right`}>Realisasi Tanam (Ha)</th>
            <th className={`${td} text-right`}>Selisih (Ha)</th>
            <th className={`${td} text-right`}>Capaian</th>
          </tr>
        </thead>
        <tbody>
          {total && (
            <tr className="bg-yellow-100 font-extrabold">
              <td className={td}></td>
              <td className={td} colSpan={2}>JUMLAH KABUPATEN</td>
              <td className={tdAngka}>{formatAngka(total.target)}</td>
              <td className={tdAngka}>{formatAngka(total.realisasi)}</td>
              <td className={tdAngka}>{formatAngka(total.realisasi - total.target)}</td>
              <SelCapaianPpl p={total.capaian} />
            </tr>
          )}
          {kec.map((k, ki) => (
            <Fragment key={k.id}>
              <tr className="bg-green-50 font-extrabold text-green-800">
                <td className={`${td} text-center`}>{ki + 1}</td>
                <td className={td} colSpan={2}>
                  KECAMATAN {k.nama.toUpperCase()} · {k.ppl.length} PPL
                  {peringkat && <span className="ml-2 inline-block rounded-md bg-red-600 px-1.5 py-0.5 align-[1px] text-[10px] text-white">Terendah #{ki + 1}</span>}
                </td>
                <td className={tdAngka}>{formatAngka(k.target)}</td>
                <td className={tdAngka}>{formatAngka(k.realisasi)}</td>
                <td className={tdAngka}>{formatAngka(k.realisasi - k.target)}</td>
                <SelCapaianPpl p={k.capaian} />
              </tr>
              {k.ppl.map((p, pi) => (
                <BarisPpl key={p.id} p={p} no={`${ki + 1}.${pi + 1}`} terbuka={buka.has(p.id)} alih={() => alih(p.id)} />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BarisPpl({ p, no, terbuka, alih }: { p: PplRealisasi; no: string; terbuka: boolean; alih: () => void }) {
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50"
        tabIndex={0}
        aria-expanded={terbuka}
        onClick={alih}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            alih();
          }
        }}
      >
        <td className={`${td} text-center text-gray-500`}>{no}</td>
        <td className={td}>
          <div className="flex items-center gap-2">
            <ChevronRight size={14} className={`shrink-0 text-gray-400 transition-transform ${terbuka ? "rotate-90" : ""}`} aria-hidden />
            <div>
              <p className="font-bold text-gray-800">{p.nama}</p>
              <p className="text-[10px] text-gray-500">{LABEL_ROLE[p.role] ?? p.role} · {p.desa.length} desa binaan</p>
            </div>
          </div>
        </td>
        <td className={td}><StatusTarget terisi={p.terisi} jumlah={p.desa.length} /></td>
        <td className={tdAngka}>{p.terisi ? formatAngka(p.target) : <Strip />}</td>
        <td className={tdAngka}>{formatAngka(p.realisasi)}</td>
        <td className={tdAngka}>{p.terisi ? formatAngka(p.realisasi - p.target) : <Strip />}</td>
        <SelCapaianPpl p={p.capaian} />
      </tr>
      {terbuka &&
        p.desa.map((d) => (
          <tr key={d.id} className="bg-gray-50/60 text-gray-600">
            <td className={td}></td>
            <td className={`${td} pl-9`}>Desa {d.nama}</td>
            <td className={td}>{d.target == null && <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold text-red-700">Target kosong</span>}</td>
            <td className={tdAngka}>{d.target == null ? <Strip /> : formatAngka(d.target)}</td>
            <td className={tdAngka}>{formatAngka(d.realisasi)}</td>
            <td className={tdAngka}>{d.target == null ? <Strip /> : formatAngka(d.realisasi - d.target)}</td>
            <SelCapaianPpl p={d.capaian} tebal={false} />
          </tr>
        ))}
    </>
  );
}
