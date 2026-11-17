"use client";

import { useState, useTransition } from "react";
import { angkaIsian, formatAngka, parseDesimal } from "@/lib/format";
import { gagal, sukses } from "@/lib/swal";
import { simpanTargetDesaAction } from "@/app/ppl/target/actions";
import type { TargetDesaData, JenisRef, Komoditas } from "@/lib/data";

type DesaForm = { id: number; nama: string; label?: string };

const kelasIn =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-right text-sm tabular-nums focus:border-primary focus:outline-hidden";
const tampil = angkaIsian;

/**
 * Kartu input target per desa (logika-bisnis §23h) untuk SATU (tahun, bulan, komoditas) dari URL.
 * Padi: rincian per jenis LTT, total dihitung otomatis. Jagung/Ubi Kayu: total langsung.
 * Pilihan bulan & komoditas = <PilihBulanKomoditas> (server, URL).
 */
export function FormTarget({
  desa,
  jenis,
  target,
  luasBakuLalu,
  tahun,
  bulan,
  kom,
}: {
  desa: DesaForm[];
  jenis: JenisRef[];
  /** target untuk (tahun, bulan, kom) ini saja */
  target: TargetDesaData[];
  /** Luas baku bulan sebelumnya per desa — HANYA placeholder, tidak ikut tersimpan. */
  luasBakuLalu: Record<number, number>;
  tahun: number;
  bulan: number;
  kom: Komoditas;
}) {
  return (
    <div className="space-y-3">
      {desa.map((d) => {
        const awal = target.find((t) => t.desaId === d.id);
        // Data bulan ini sudah ada → rujuk bulan ini; belum ada → rujuk bulan lalu; tidak ada keduanya → 0.
        const ph = tampil(awal ? awal.luasBaku : luasBakuLalu[d.id]) || "0";
        return <KartuDesa key={`${d.id}-${tahun}-${bulan}-${kom}`} desa={d} tahun={tahun} bulan={bulan} kom={kom} jenis={jenis} awal={awal} placeholderLuasBaku={ph} />;
      })}
    </div>
  );
}

function KartuDesa({
  desa,
  tahun,
  bulan,
  kom,
  jenis,
  awal,
  placeholderLuasBaku,
}: {
  desa: DesaForm;
  tahun: number;
  bulan: number;
  kom: Komoditas;
  jenis: JenisRef[];
  awal?: TargetDesaData;
  placeholderLuasBaku: string;
}) {
  const [nilai, setNilai] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {
      tanam: tampil(awal?.tanam ?? 0),
      panen: tampil(awal?.panen ?? 0),
      luasBaku: tampil(awal?.luasBaku ?? 0),
    };
    for (const j of jenis) {
      const r = awal?.rincian.find((x) => x.jenisId === j.id);
      v[`t${j.id}`] = tampil(r?.tanam ?? 0);
      v[`p${j.id}`] = tampil(r?.panen ?? 0);
    }
    return v;
  });
  const [proses, mulai] = useTransition();
  const ubah = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setNilai((v) => ({ ...v, [k]: e.target.value }));
  const n = (k: string) => {
    const x = parseDesimal(nilai[k] ?? "");
    return Number.isFinite(x) ? x : 0;
  };
  const isPadi = kom === "Padi";
  const totalTanam = isPadi ? jenis.reduce((a, j) => a + n(`t${j.id}`), 0) : n("tanam");
  const totalPanen = isPadi ? jenis.reduce((a, j) => a + n(`p${j.id}`), 0) : n("panen");

  function simpan(e: React.FormEvent) {
    e.preventDefault();
    mulai(async () => {
      const h = await simpanTargetDesaAction({
        tahun,
        bulan,
        desaId: desa.id,
        komoditas: kom,
        targetTanam: nilai.tanam ?? "",
        targetPanen: nilai.panen ?? "",
        luasBaku: nilai.luasBaku ?? "",
        rincian: isPadi ? jenis.map((j) => ({ jenisId: j.id, tanam: nilai[`t${j.id}`] ?? "", panen: nilai[`p${j.id}`] ?? "" })) : [],
      });
      if (h.sukses) sukses("Tersimpan", h.pesan);
      else gagal("Gagal", h.pesan);
    });
  }

  return (
    <form onSubmit={simpan} className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">{desa.nama}</h3>
          {desa.label && <p className="text-[11px] text-muted">{desa.label}</p>}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${awal ? "bg-primary-soft text-primary-strong" : "bg-background text-muted"}`}>
          {awal ? "Sudah diisi" : "Belum diisi"}
        </span>
      </div>

      {isPadi ? (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-2 text-[10px] font-bold text-muted uppercase">
            <span>Jenis LTT</span>
            <span className="text-right">Tanam (Ha)</span>
            <span className="text-right">Panen (Ha)</span>
          </div>
          {jenis.map((j) => (
            <div key={j.id} className="grid grid-cols-[1fr_5.5rem_5.5rem] items-center gap-2">
              <span className="text-xs">{j.nama}</span>
              <input inputMode="decimal" aria-label={`Tanam ${j.nama}`} placeholder="0" value={nilai[`t${j.id}`]} onChange={ubah(`t${j.id}`)} className={kelasIn} />
              <input inputMode="decimal" aria-label={`Panen ${j.nama}`} placeholder="0" value={nilai[`p${j.id}`]} onChange={ubah(`p${j.id}`)} className={kelasIn} />
            </div>
          ))}
          <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-2 border-t border-border pt-1.5 text-xs font-bold">
            <span>Total (otomatis)</span>
            <span className="text-right tabular-nums">{formatAngka(totalTanam)}</span>
            <span className="text-right tabular-nums">{formatAngka(totalPanen)}</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-semibold text-muted">
            Target Tanam (Ha)
            <input inputMode="decimal" placeholder="0" value={nilai.tanam} onChange={ubah("tanam")} className={kelasIn} />
          </label>
          <label className="text-[11px] font-semibold text-muted">
            Target Panen (Ha)
            <input inputMode="decimal" placeholder="0" value={nilai.panen} onChange={ubah("panen")} className={kelasIn} />
          </label>
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <label className="flex-1 text-[11px] font-semibold text-muted">
          Luas Baku {isPadi ? "Sawah" : "Lahan"} (Ha, opsional)
          <input inputMode="decimal" placeholder={placeholderLuasBaku} value={nilai.luasBaku} onChange={ubah("luasBaku")} className={kelasIn} />
        </label>
        <button
          type="submit"
          disabled={proses}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          {proses ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </form>
  );
}
