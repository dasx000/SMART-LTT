"use client";

import { useState, useTransition } from "react";
import { NAMA_BULAN, formatAngka, parseDesimal } from "@/lib/format";
import { gagal, sukses } from "@/lib/swal";
import { simpanTargetDesaAction } from "@/app/ppl/target/actions";
import type { TargetDesaData, JenisRef, Komoditas } from "@/lib/data";

type DesaForm = { id: number; nama: string; label?: string };

const KOM: Komoditas[] = ["Padi", "Jagung", "Ubi Kayu"];
const kelasIn =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-right text-sm tabular-nums focus:border-primary focus:outline-hidden";
const tampil = (n: number) => (n ? formatAngka(n) : "");

/**
 * Input target per desa (logika-bisnis §23h): pilih bulan & komoditas, satu kartu per desa.
 * Padi: rincian per jenis LTT, total dihitung otomatis. Jagung/Ubi Kayu: total langsung.
 */
export function FormTarget({
  desa,
  jenis,
  target,
  bulanAwal,
}: {
  desa: DesaForm[];
  jenis: JenisRef[];
  target: TargetDesaData[];
  bulanAwal: number;
}) {
  const [bulan, setBulan] = useState(bulanAwal);
  const [kom, setKom] = useState<Komoditas>("Padi");
  const cari = (desaId: number) => target.find((t) => t.desaId === desaId && t.bulan === bulan && t.komoditas === kom);
  const sudah = desa.filter((d) => cari(d.id)).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-surface p-3">
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted">
          Bulan
          <select
            value={bulan}
            onChange={(e) => setBulan(Number(e.target.value))}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium"
          >
            {NAMA_BULAN.map((n, i) => (
              <option key={n} value={i + 1}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-1.5">
          {KOM.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKom(k)}
              className={`rounded-xl px-3 py-2 text-xs font-bold ${kom === k ? "bg-primary text-white" : "border border-border bg-background"}`}
            >
              {k}
            </button>
          ))}
        </div>
        <p className="ml-auto text-xs text-muted">
          Terisi <b className="text-foreground">{sudah}</b> / {desa.length} desa
        </p>
      </div>

      {desa.map((d) => (
        <KartuDesa key={`${d.id}-${bulan}-${kom}`} desa={d} bulan={bulan} kom={kom} jenis={jenis} awal={cari(d.id)} />
      ))}
    </div>
  );
}

function KartuDesa({
  desa,
  bulan,
  kom,
  jenis,
  awal,
}: {
  desa: DesaForm;
  bulan: number;
  kom: Komoditas;
  jenis: JenisRef[];
  awal?: TargetDesaData;
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
          <input inputMode="decimal" placeholder="0" value={nilai.luasBaku} onChange={ubah("luasBaku")} className={kelasIn} />
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
