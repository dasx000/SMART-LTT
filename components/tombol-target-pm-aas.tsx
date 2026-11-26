"use client";

import { useEffect, useState, useTransition } from "react";
import { Goal, Pencil, X } from "lucide-react";
import { angkaIsian, formatAngka, parseDesimal } from "@/lib/format";
import { gagal, sukses } from "@/lib/swal";
import type { JenisRef, TargetDesaPmAas } from "@/lib/data";
import { simpanTargetPmAasAction } from "@/app/ppl/realisasi/actions";

const kelasIn = "w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-right text-sm tabular-nums outline-none focus:border-green-500";

/**
 * Tombol "Isi Target" (desa belum ada target PM-AAS) / "Ubah" + modal target PM AAS padi satu desa.
 * Isian sama dengan target padi biasa (rincian jenis LTT, tanam & panen, total otomatis) tanpa LBS.
 */
export function TombolTargetPmAas({
  desa,
  jenis,
  tahun,
  bulan,
  awal,
}: {
  desa: { id: number; nama: string; kecamatan: string };
  jenis: JenisRef[];
  tahun: number;
  bulan: number;
  awal: TargetDesaPmAas | null;
}) {
  const [buka, setBuka] = useState(false);
  return (
    <>
      {awal ? (
        <button type="button" onClick={() => setBuka(true)} className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-green-700 hover:bg-green-50">
          <Pencil size={11} aria-hidden /> Ubah
        </button>
      ) : (
        <button type="button" onClick={() => setBuka(true)} className="mt-1 inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[10px] font-extrabold text-white hover:bg-red-700 active:scale-95">
          <Goal size={12} aria-hidden /> Isi Target
        </button>
      )}
      {buka && <ModalTargetPmAas desa={desa} jenis={jenis} tahun={tahun} bulan={bulan} awal={awal} onTutup={() => setBuka(false)} />}
    </>
  );
}

function ModalTargetPmAas({
  desa,
  jenis,
  tahun,
  bulan,
  awal,
  onTutup,
}: {
  desa: { id: number; nama: string; kecamatan: string };
  jenis: JenisRef[];
  tahun: number;
  bulan: number;
  awal: TargetDesaPmAas | null;
  onTutup: () => void;
}) {
  const [nilai, setNilai] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const j of jenis) {
      const r = awal?.rincian.find((x) => x.jenisId === j.id);
      v[`t${j.id}`] = angkaIsian(r?.tanam ?? 0);
      v[`p${j.id}`] = angkaIsian(r?.panen ?? 0);
    }
    return v;
  });
  const [proses, mulai] = useTransition();

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !proses && onTutup();
    window.addEventListener("keydown", esc);
    const lama = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = lama;
    };
  }, [onTutup, proses]);

  const ubah = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setNilai((v) => ({ ...v, [k]: e.target.value }));
  const n = (k: string) => {
    const x = parseDesimal(nilai[k] ?? "");
    return Number.isFinite(x) ? x : 0;
  };
  const totalTanam = jenis.reduce((a, j) => a + n(`t${j.id}`), 0);
  const totalPanen = jenis.reduce((a, j) => a + n(`p${j.id}`), 0);

  function simpan() {
    mulai(async () => {
      const h = await simpanTargetPmAasAction({
        tahun,
        bulan,
        desaId: desa.id,
        rincian: jenis.map((j) => ({ jenisId: j.id, tanam: nilai[`t${j.id}`] ?? "", panen: nilai[`p${j.id}`] ?? "" })),
      });
      if (!h.sukses) {
        gagal("Gagal", h.pesan);
        return;
      }
      sukses("Tersimpan", h.pesan);
      onTutup();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4" onClick={() => !proses && onTutup()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={`Target PM-AAS ${desa.nama}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          simpan();
        }}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white text-left shadow-xl md:max-w-lg md:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <span className="inline-block rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-white uppercase">PM-AAS</span>
            <p className="mt-1 text-[10px] font-bold text-gray-400 uppercase">{awal ? "Ubah" : "Isi"} Target PM-AAS · Padi</p>
            <h3 className="truncate text-base font-bold text-gray-800">{desa.nama}</h3>
            <p className="truncate text-[11px] text-gray-500">{desa.kecamatan}</p>
          </div>
          <button type="button" onClick={onTutup} disabled={proses} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto px-4 py-3">
          <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-2 text-[10px] font-bold text-gray-400 uppercase">
            <span>Jenis LTT</span>
            <span className="text-right">Tanam (Ha)</span>
            <span className="text-right">Panen (Ha)</span>
          </div>
          {jenis.map((j) => (
            <div key={j.id} className="grid grid-cols-[1fr_5.5rem_5.5rem] items-center gap-2">
              <span className="text-xs text-gray-700">{j.nama}</span>
              <input inputMode="decimal" aria-label={`Tanam ${j.nama}`} placeholder="0" value={nilai[`t${j.id}`]} onChange={ubah(`t${j.id}`)} className={kelasIn} />
              <input inputMode="decimal" aria-label={`Panen ${j.nama}`} placeholder="0" value={nilai[`p${j.id}`]} onChange={ubah(`p${j.id}`)} className={kelasIn} />
            </div>
          ))}
          <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-2 border-t border-gray-100 pt-1.5 text-xs font-bold">
            <span>Total (otomatis)</span>
            <span className="text-right tabular-nums">{formatAngka(totalTanam)}</span>
            <span className="text-right tabular-nums">{formatAngka(totalPanen)}</span>
          </div>
          <p className="pt-1 text-[10px] text-gray-400">Desa tanpa target PM-AAS bulan ini: biarkan 0 lalu Simpan (tetap terhitung sudah isi).</p>
        </div>

        <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
          <button type="button" onClick={onTutup} disabled={proses} className="rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-500">
            Batal
          </button>
          <button type="submit" disabled={proses} className="flex-1 rounded-xl bg-green-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-60">
            {proses ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}
