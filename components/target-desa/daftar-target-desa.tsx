"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { angkaIsian, formatAngka, parseDesimal } from "@/lib/format";
import { gagal, konfirmasi, sukses } from "@/lib/swal";
import { PESAN_LBS_WAJIB, isianKosong } from "@/lib/validasi";
import type { JenisRef, Komoditas } from "@/lib/data";
import { hapusTargetDesaAdminAction, simpanTargetDesaAdminAction } from "./actions";
import type { BarisTargetDesa } from "./jenis";

type Status = "semua" | "belum" | "sudah";

/**
 * Daftar Target Desa untuk menu Admin Kab & BPP (pola: daftar + Buat/Ubah/Hapus lewat modal).
 * Semua desa tampil — yang belum diisi tetap muncul dengan tombol Buat.
 * Laptop: tabel. HP: kartu. Modal: layar penuh dari bawah di HP.
 * Sisa kuota = Target Provinsi (tanam) − Σ target tanam desa.
 */
export function DaftarTargetDesa({
  baris,
  jenis,
  tahun,
  bulan,
  kom,
  kuota,
  namaCakupan,
  tampilKecamatan,
  penggunaId,
}: {
  baris: BarisTargetDesa[];
  jenis: JenisRef[];
  tahun: number;
  bulan: number;
  kom: Komoditas;
  /** Target Provinsi (tanam) per kecamatan */
  kuota: Record<number, number>;
  /** mis. "Kec. Pakuan Ratu" / "Kabupaten" */
  namaCakupan: string;
  tampilKecamatan: boolean;
  penggunaId: string;
}) {
  const [cari, setCari] = useState("");
  const [status, setStatus] = useState<Status>("semua");
  const [pplPilih, setPplPilih] = useState("");
  const [buka, setBuka] = useState<number | null>(null);
  const [proses, mulai] = useTransition();

  const kecIds = useMemo(() => [...new Set(baris.map((b) => b.kecamatanId))], [baris]);
  const totalKuota = kecIds.reduce((a, id) => a + (kuota[id] ?? 0), 0);
  const totalDesa = baris.reduce((a, b) => a + (b.target?.tanam ?? 0), 0);
  const terisi = baris.filter((b) => b.target).length;
  const persen = baris.length ? (terisi / baris.length) * 100 : 0;

  // Filter PPL: hanya bila daftar berisi satu kecamatan (kecamatan sudah dipilih / halaman BPP)
  const TANPA_PPL = "__tanpa";
  const opsiPpl = useMemo(() => {
    const m = new Map<string, { desa: number; terisi: number }>();
    for (const b of baris)
      for (const n of b.ppl.length ? b.ppl : [TANPA_PPL]) {
        const x = m.get(n) ?? { desa: 0, terisi: 0 };
        x.desa++;
        if (b.target) x.terisi++;
        m.set(n, x);
      }
    return [...m.entries()].sort(([a], [b]) => (a === TANPA_PPL ? 1 : b === TANPA_PPL ? -1 : a.localeCompare(b, "id")));
  }, [baris]);
  const ppl = !tampilKecamatan && opsiPpl.some(([n]) => n === pplPilih) ? pplPilih : "";
  const perPpl = useMemo(
    () => (ppl ? baris.filter((b) => (ppl === TANPA_PPL ? b.ppl.length === 0 : b.ppl.includes(ppl))) : baris),
    [baris, ppl],
  );
  const terisiPpl = perPpl.filter((b) => b.target).length;

  const tampil = useMemo(() => {
    const c = cari.trim().toLowerCase();
    return perPpl.filter(
      (b) =>
        (status === "semua" || (status === "sudah") === Boolean(b.target)) &&
        (!c || b.nama.toLowerCase().includes(c) || b.kecamatan.toLowerCase().includes(c) || b.ppl.some((n) => n.toLowerCase().includes(c))),
    );
  }, [perPpl, cari, status]);

  const desaBuka = buka === null ? null : (baris.find((b) => b.id === buka) ?? null);

  function hapus(b: BarisTargetDesa) {
    mulai(async () => {
      const ok = await konfirmasi(`Hapus target ${b.nama}?`, `Target ${kom} desa ini akan dihapus dan statusnya kembali "Belum diisi".`, "Ya, hapus");
      if (!ok) return;
      const h = await hapusTargetDesaAdminAction({ tahun, bulan, desaId: b.id, komoditas: kom });
      if (h.sukses) sukses("Terhapus", h.pesan);
      else gagal("Gagal", h.pesan);
    });
  }

  /** Desa berikutnya (urutan daftar yang tampil) yang belum diisi, sesudah desa `id`. */
  function berikutnya(id: number): number | null {
    const i = tampil.findIndex((b) => b.id === id);
    const sisa = [...tampil.slice(i + 1), ...tampil.slice(0, Math.max(i, 0))];
    return sisa.find((b) => !b.target && b.id !== id)?.id ?? null;
  }

  const sisaKuota = totalKuota - totalDesa;

  return (
    <div>
      {/* Ringkasan: sisa kuota + progres */}
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className={`rounded-xl px-4 py-3 ${totalKuota <= 0 ? "bg-gray-50" : sisaKuota > 0 ? "bg-amber-50" : sisaKuota < 0 ? "bg-blue-50" : "bg-green-50"}`}>
          <p className="text-[10px] font-bold text-gray-500 uppercase">Sisa Kuota Target Tanam · {namaCakupan}</p>
          {totalKuota <= 0 ? (
            <p className="text-sm font-semibold text-gray-400">Target Provinsi belum diset</p>
          ) : (
            <p className={`text-lg font-bold ${sisaKuota > 0 ? "text-amber-600" : sisaKuota < 0 ? "text-blue-700" : "text-green-600"}`}>
              {sisaKuota === 0 ? "Pas (0 Ha)" : sisaKuota > 0 ? `${formatAngka(sisaKuota)} Ha` : `Lebih ${formatAngka(-sisaKuota)} Ha`}
            </p>
          )}
          <p className="text-[11px] text-gray-500">
            Provinsi {formatAngka(totalKuota)} Ha · Σ desa {formatAngka(totalDesa)} Ha
          </p>
        </div>
        <div className="rounded-xl bg-gray-50 px-4 py-3">
          <p className="text-[10px] font-bold text-gray-500 uppercase">Desa sudah diisi</p>
          <p className="text-lg font-bold text-gray-800">
            {terisi} <span className="text-sm font-normal text-gray-500">/ {baris.length} desa</span>
          </p>
          <span className="mt-1 block h-2 overflow-hidden rounded-full bg-gray-200">
            <span className={`block h-full rounded-full ${persen >= 100 ? "bg-green-500" : persen >= 50 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${persen}%` }} />
          </span>
        </div>
      </div>

      {/* Filter client: PPL (satu kecamatan) + status + cari */}
      {!tampilKecamatan && opsiPpl.length > 0 && (
        <label className="mb-2 flex flex-col gap-1 text-[11px] font-semibold text-gray-500 sm:flex-row sm:items-center sm:gap-2">
          PPL
          <select
            value={ppl}
            onChange={(e) => setPplPilih(e.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 sm:w-72"
          >
            <option value="">Semua PPL ({baris.length} desa)</option>
            {opsiPpl.map(([n, x]) => (
              <option key={n} value={n}>
                {n === TANPA_PPL ? "Desa tanpa PPL" : n} ({x.terisi}/{x.desa} desa)
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {(
            [
              ["semua", `Semua (${perPpl.length})`],
              ["belum", `Belum (${perPpl.length - terisiPpl})`],
              ["sudah", `Sudah (${terisiPpl})`],
            ] as [Status, string][]
          ).map(([k, t]) => (
            <button
              key={k}
              type="button"
              onClick={() => setStatus(k)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-bold sm:flex-none ${status === k ? "bg-white text-green-700 shadow" : "text-gray-500 hover:text-green-600"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <label className="relative block sm:w-64">
          <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder={tampilKecamatan ? "Cari desa / kecamatan / PPL" : "Cari desa / PPL"}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pr-3 pl-8 text-sm outline-none focus:border-green-500"
          />
        </label>
      </div>

      {tampil.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-400">Tidak ada desa yang cocok.</p>
      ) : (
        <>
          {/* Laptop: tabel */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                  <th className="p-2.5 text-left">Desa</th>
                  {tampilKecamatan && <th className="p-2.5 text-left">Kecamatan</th>}
                  <th className="p-2.5 text-left">PPL</th>
                  <th className="p-2.5 text-right">Tanam (Ha)</th>
                  <th className="p-2.5 text-right">Panen (Ha)</th>
                  <th className="p-2.5 text-left">Pembuat Target</th>
                  <th className="p-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tampil.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="p-2.5 font-semibold text-gray-700">{b.nama}</td>
                    {tampilKecamatan && <td className="p-2.5 text-gray-600">{b.kecamatan}</td>}
                    <td className="p-2.5 text-gray-500">{b.ppl.join(", ") || <span className="text-gray-300">Belum ada PPL</span>}</td>
                    <td className="p-2.5 text-right font-semibold tabular-nums">{b.target ? formatAngka(b.target.tanam) : "—"}</td>
                    <td className="p-2.5 text-right tabular-nums">{b.target ? formatAngka(b.target.panen) : "—"}</td>
                    <td className="p-2.5">
                      <Pembuat b={b} />
                    </td>
                    <td className="p-2.5">
                      <Aksi b={b} proses={proses} onUbah={() => setBuka(b.id)} onHapus={() => hapus(b)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* HP: kartu */}
          <ul className="space-y-2 md:hidden">
            {tampil.map((b) => (
              <li key={b.id} className="rounded-xl border border-gray-100 bg-white p-3 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-800">{b.nama}</p>
                    <p className="truncate text-[11px] text-gray-500">
                      {tampilKecamatan && <>{b.kecamatan} · </>}
                      {b.ppl.join(", ") || "Belum ada PPL"}
                    </p>
                  </div>
                  {b.target ? (
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-gray-800 tabular-nums">{formatAngka(b.target.tanam)} Ha</p>
                      <p className="text-[10px] text-gray-400">panen {formatAngka(b.target.panen)}</p>
                    </div>
                  ) : (
                    <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-500">Belum diisi</span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-50 pt-2">
                  <Pembuat b={b} />
                  <Aksi b={b} proses={proses} onUbah={() => setBuka(b.id)} onHapus={() => hapus(b)} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {desaBuka && (
        <ModalTarget
          key={`${desaBuka.id}-${tahun}-${bulan}-${kom}`}
          desa={desaBuka}
          jenis={jenis}
          tahun={tahun}
          bulan={bulan}
          kom={kom}
          kuotaKec={kuota[desaBuka.kecamatanId] ?? 0}
          lainKec={baris.filter((b) => b.kecamatanId === desaBuka.kecamatanId && b.id !== desaBuka.id).reduce((a, b) => a + (b.target?.tanam ?? 0), 0)}
          penggunaId={penggunaId}
          onTutup={() => setBuka(null)}
          onLanjut={() => setBuka(berikutnya(desaBuka.id))}
        />
      )}
    </div>
  );
}

function Pembuat({ b }: { b: BarisTargetDesa }) {
  if (!b.pembuat) return <span className="text-[11px] text-gray-300">—</span>;
  return (
    <span className="min-w-0 truncate text-[11px] text-gray-600">
      {b.pembuat.peran && (
        <span className={`mr-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${b.pembuat.peran === "PPL" ? "bg-cyan-50 text-cyan-700" : "bg-violet-50 text-violet-700"}`}>
          {b.pembuat.peran}
        </span>
      )}
      {b.pembuat.nama}
    </span>
  );
}

function Aksi({ b, proses, onUbah, onHapus }: { b: BarisTargetDesa; proses: boolean; onUbah: () => void; onHapus: () => void }) {
  if (!b.target) {
    return (
      <div className="flex justify-end">
        <button type="button" onClick={onUbah} className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-green-700">
          <Plus size={12} /> Buat
        </button>
      </div>
    );
  }
  return (
    <div className="flex shrink-0 justify-end gap-1">
      <button type="button" onClick={onUbah} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-green-700 hover:bg-green-50">
        <Pencil size={12} /> Ubah
      </button>
      <button type="button" disabled={proses} onClick={onHapus} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-50 disabled:opacity-50">
        <Trash2 size={12} /> Hapus
      </button>
    </div>
  );
}

const kelasIn = "w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-right text-sm tabular-nums outline-none focus:border-green-500";

function ModalTarget({
  desa,
  jenis,
  tahun,
  bulan,
  kom,
  kuotaKec,
  lainKec,
  penggunaId,
  onTutup,
  onLanjut,
}: {
  desa: BarisTargetDesa;
  jenis: JenisRef[];
  tahun: number;
  bulan: number;
  kom: Komoditas;
  kuotaKec: number;
  lainKec: number;
  penggunaId: string;
  onTutup: () => void;
  onLanjut: () => void;
}) {
  const awal = desa.target;
  const [nilai, setNilai] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {
      tanam: angkaIsian(awal?.tanam ?? 0),
      panen: angkaIsian(awal?.panen ?? 0),
      luasBaku: angkaIsian(awal?.luasBaku ?? 0),
    };
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

  const [salahLbs, setSalahLbs] = useState(false);
  const ubah = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setNilai((v) => ({ ...v, [k]: e.target.value }));
  const n = (k: string) => {
    const x = parseDesimal(nilai[k] ?? "");
    return Number.isFinite(x) ? x : 0;
  };
  const isPadi = kom === "Padi";
  const totalTanam = isPadi ? jenis.reduce((a, j) => a + n(`t${j.id}`), 0) : n("tanam");
  const totalPanen = isPadi ? jenis.reduce((a, j) => a + n(`p${j.id}`), 0) : n("panen");
  const sisa = kuotaKec - lainKec - totalTanam;
  const milikOrangLain = Boolean(awal && desa.pembuat && desa.pembuat.id !== penggunaId);

  function simpan(lanjut: boolean) {
    if (isPadi && isianKosong(nilai.luasBaku)) {
      setSalahLbs(true);
      gagal("LBS belum diisi", PESAN_LBS_WAJIB);
      return;
    }
    mulai(async () => {
      if (milikOrangLain) {
        const ok = await konfirmasi(
          "Timpa isian sebelumnya?",
          `Target ${desa.nama} terakhir diisi oleh ${desa.pembuat!.peran ? `${desa.pembuat!.peran} ` : ""}${desa.pembuat!.nama}. Menyimpan akan menimpa isian tersebut.`,
          "Ya, timpa",
        );
        if (!ok) return;
      }
      const h = await simpanTargetDesaAdminAction({
        tahun,
        bulan,
        desaId: desa.id,
        komoditas: kom,
        targetTanam: nilai.tanam ?? "",
        targetPanen: nilai.panen ?? "",
        luasBaku: nilai.luasBaku ?? "",
        rincian: isPadi ? jenis.map((j) => ({ jenisId: j.id, tanam: nilai[`t${j.id}`] ?? "", panen: nilai[`p${j.id}`] ?? "" })) : [],
      });
      if (!h.sukses) {
        gagal("Gagal", h.pesan);
        return;
      }
      sukses("Tersimpan", h.pesan);
      if (lanjut) onLanjut();
      else onTutup();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4" onClick={() => !proses && onTutup()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={`Target ${desa.nama}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          simpan(false);
        }}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl md:max-w-lg md:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase">{awal ? "Ubah" : "Buat"} Target {kom}</p>
            <h3 className="truncate text-base font-bold text-gray-800">{desa.nama}</h3>
            <p className="truncate text-[11px] text-gray-500">
              {desa.kecamatan} · {desa.ppl.join(", ") || "Belum ada PPL"}
            </p>
          </div>
          <button type="button" onClick={onTutup} disabled={proses} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {kuotaKec > 0 && (
            <div className={`rounded-lg px-3 py-2 text-[11px] ${sisa >= 0 ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"}`}>
              Sisa kuota Kec. {desa.kecamatan} setelah disimpan:{" "}
              <b>{sisa >= 0 ? `${formatAngka(sisa)} Ha` : `lebih ${formatAngka(-sisa)} Ha`}</b>
              <span className="text-gray-500"> (Provinsi {formatAngka(kuotaKec)} Ha)</span>
            </div>
          )}
          {milikOrangLain && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">
              Terakhir diisi oleh <b>{desa.pembuat!.peran} {desa.pembuat!.nama}</b>. Menyimpan akan menimpa isian ini.
            </p>
          )}

          {isPadi ? (
            <div className="space-y-1.5">
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
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-semibold text-gray-500">
                Target Tanam (Ha)
                <input inputMode="decimal" placeholder="0" value={nilai.tanam} onChange={ubah("tanam")} className={kelasIn} />
              </label>
              <label className="text-[11px] font-semibold text-gray-500">
                Target Panen (Ha)
                <input inputMode="decimal" placeholder="0" value={nilai.panen} onChange={ubah("panen")} className={kelasIn} />
              </label>
            </div>
          )}

          <label className="block text-[11px] font-semibold text-gray-500">
            Luas Baku {isPadi ? "Sawah" : "Lahan"} (Ha{isPadi ? "" : ", opsional"}) {isPadi && <span className="text-red-600">*</span>}
            <input
              inputMode="decimal"
              required={isPadi}
              aria-required={isPadi}
              aria-invalid={salahLbs}
              placeholder={isPadi ? "Wajib diisi" : "0"}
              value={nilai.luasBaku}
              onChange={(e) => {
                setSalahLbs(false);
                ubah("luasBaku")(e);
              }}
              className={`${kelasIn} ${salahLbs ? "border-red-500 bg-red-50" : ""}`}
            />
            {salahLbs && (
              <span className="mt-0.5 block text-[10px] font-bold text-red-600">
                Wajib diisi. Ketik 0 bila tidak ada sawah.
              </span>
            )}
          </label>
          <p className="text-[10px] text-gray-400">
            {isPadi
              ? "LBS wajib diisi (ketik 0 bila tidak ada sawah). Desa tanpa target bulan ini: biarkan target kosong, isi LBS, lalu Simpan."
              : "Desa tanpa target bulan ini: biarkan 0 lalu Simpan (tetap terhitung sudah isi)."}
          </p>
        </div>

        <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
          <button type="button" onClick={onTutup} disabled={proses} className="rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-500">
            Batal
          </button>
          <button type="button" onClick={() => simpan(true)} disabled={proses} className="flex-1 rounded-xl border border-green-600 px-3 py-2.5 text-xs font-bold text-green-700 disabled:opacity-60">
            Simpan & berikutnya
          </button>
          <button type="submit" disabled={proses} className="flex-1 rounded-xl bg-green-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-60">
            {proses ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}
