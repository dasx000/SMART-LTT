"use client";

import { useState, useTransition } from "react";
import { NAMA_BULAN_PENDEK, formatAngka } from "@/lib/format";
import { gagal, sukses } from "@/lib/swal";
import { simpanProduktivitasAction, simpanSaranaAction } from "./actions";

type Komoditas = "Padi" | "Jagung" | "Ubi Kayu";
const KOM: Komoditas[] = ["Padi", "Jagung", "Ubi Kayu"];
export type ProdData = { tahun: number; desaId: number; komoditas: Komoditas; nilai: number[] };
export type SaranaData = { desaId: number; gudang_gabah: number; embung: number; lantai_jemur: number; mesin_pengering: number };

const SARANA = [
  { k: "gudang_gabah", l: "Gudang Gabah" },
  { k: "embung", l: "Embung" },
  { k: "lantai_jemur", l: "Lantai Jemur" },
  { k: "mesin_pengering", l: "Mesin Pengering" },
] as const;

const kelasIn =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-right text-sm tabular-nums focus:border-primary focus:outline-hidden";

export function FormProduktivitas({
  desa,
  data,
  sarana,
  tahunPilihan,
}: {
  desa: { id: number; nama: string }[];
  data: ProdData[];
  sarana: SaranaData[];
  tahunPilihan: number[];
}) {
  const [tahun, setTahun] = useState(tahunPilihan[0]);
  const [kom, setKom] = useState<Komoditas>("Padi");
  const [tab, setTab] = useState<"prod" | "sarana">("prod");

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["prod", "sarana"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-xs font-bold ${tab === t ? "bg-primary text-white" : "border border-border bg-surface"}`}
          >
            {t === "prod" ? "Produktivitas" : "Sarana"}
          </button>
        ))}
      </div>

      {tab === "prod" ? (
        <>
          <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-surface p-3">
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted">
              Tahun
              <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                {tahunPilihan.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
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
            <p className="w-full text-[11px] text-muted">Satuan ton/ha (maks. 100). Kosong = 0.</p>
          </div>
          {desa.map((d) => (
            <KartuProd
              key={`${d.id}-${tahun}-${kom}`}
              desa={d}
              tahun={tahun}
              kom={kom}
              awal={data.find((x) => x.desaId === d.id && x.tahun === tahun && x.komoditas === kom)?.nilai}
            />
          ))}
        </>
      ) : (
        desa.map((d) => <KartuSarana key={d.id} desa={d} awal={sarana.find((x) => x.desaId === d.id)} />)
      )}
    </div>
  );
}

function KartuProd({ desa, tahun, kom, awal }: { desa: { id: number; nama: string }; tahun: number; kom: Komoditas; awal?: number[] }) {
  const [nilai, setNilai] = useState<string[]>(() => (awal ?? new Array(12).fill(0)).map((v) => (v ? formatAngka(v) : "")));
  const [proses, mulai] = useTransition();

  function simpan(e: React.FormEvent) {
    e.preventDefault();
    mulai(async () => {
      const h = await simpanProduktivitasAction({ tahun, desaId: desa.id, komoditas: kom, nilai });
      if (h.sukses) sukses("Tersimpan", h.pesan);
      else gagal("Gagal", h.pesan);
    });
  }

  return (
    <form onSubmit={simpan} className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold">{desa.nama}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${awal ? "bg-primary-soft text-primary-strong" : "bg-background text-muted"}`}>
          {awal ? "Sudah diisi" : "Belum diisi"}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {NAMA_BULAN_PENDEK.map((b, i) => (
          <label key={b} className="text-[10px] font-semibold text-muted">
            {b}
            <input
              inputMode="decimal"
              placeholder="0"
              value={nilai[i]}
              onChange={(e) => setNilai((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
              className={kelasIn}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 text-right">
        <button type="submit" disabled={proses} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
          {proses ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </form>
  );
}

function KartuSarana({ desa, awal }: { desa: { id: number; nama: string }; awal?: SaranaData }) {
  const [nilai, setNilai] = useState<Record<string, string>>(() =>
    Object.fromEntries(SARANA.map((s) => [s.k, awal ? String(awal[s.k]) : ""])),
  );
  const [proses, mulai] = useTransition();

  function simpan(e: React.FormEvent) {
    e.preventDefault();
    mulai(async () => {
      const h = await simpanSaranaAction({
        desaId: desa.id,
        gudang_gabah: nilai.gudang_gabah,
        embung: nilai.embung,
        lantai_jemur: nilai.lantai_jemur,
        mesin_pengering: nilai.mesin_pengering,
      });
      if (h.sukses) sukses("Tersimpan", h.pesan);
      else gagal("Gagal", h.pesan);
    });
  }

  return (
    <form onSubmit={simpan} className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold">{desa.nama}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${awal ? "bg-primary-soft text-primary-strong" : "bg-background text-muted"}`}>
          {awal ? "Sudah diisi" : "Belum diisi"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SARANA.map((s) => (
          <label key={s.k} className="text-[11px] font-semibold text-muted">
            {s.l} (unit)
            <input
              inputMode="numeric"
              placeholder="0"
              value={nilai[s.k]}
              onChange={(e) => setNilai((v) => ({ ...v, [s.k]: e.target.value }))}
              className={kelasIn}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 text-right">
        <button type="submit" disabled={proses} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
          {proses ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </form>
  );
}
