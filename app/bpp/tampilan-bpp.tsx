"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Wheat,
  Sprout,
  Carrot,
  ArrowRightLeft,
  Calendar,
  Target,
  FileSpreadsheet,
  LayoutDashboard,
  Search,
  Edit3,
  Trash2,
  X,
  MapPin,
} from "lucide-react";
import { formatAngka, NAMA_BULAN, formatTanggal } from "@/lib/format";
import { sukses, gagal, konfirmasi, memuat } from "@/lib/swal";
import { simpanTargetKecamatanAction, editLaporanBppAction, hapusLaporanBppAction } from "./actions";

export interface CapaianKomoditas {
  realisasiTanam: number;
  realisasiPanen: number;
  targetTanam: number;
  targetPanen: number;
}

export interface RekapDesaRow {
  desaId: number;
  namaDesa: string;
  tanamPadi: number;
  tanamJagung: number;
  tanamUbi: number;
  totalTanam: number;
  totalPanen: number;
}

export interface ItemLaporanBpp {
  id: number;
  desa_id: number;
  nama_desa: string;
  komoditas: "Padi" | "Jagung" | "Ubi Kayu";
  realisasi_tanam: number;
  realisasi_panen: number;
  keterangan: string | null;
  waktu: string;
  sumber: "manual" | "epusluh";
  nama_pelapor: string | null;
}

export interface ItemTargetKecamatan {
  bulan: number;
  komoditas: "Padi" | "Jagung" | "Ubi Kayu";
  target_tanam: number;
  target_panen: number;
}

export function TampilanBPP({
  namaAdmin,
  kecamatanNama,
  bulanAktif,
  rekapKomoditas,
  rekapDesa,
  laporanKecamatan,
  targetList,
  daftarDesa,
}: {
  namaAdmin: string;
  kecamatanNama: string;
  bulanAktif: number;
  rekapKomoditas: {
    padi: CapaianKomoditas;
    jagung: CapaianKomoditas;
    ubiKayu: CapaianKomoditas;
  };
  rekapDesa: RekapDesaRow[];
  laporanKecamatan: ItemLaporanBpp[];
  targetList: ItemTargetKecamatan[];
  daftarDesa: { id: number; nama: string }[];
}) {
  const [tabAktif, setTabAktif] = useState<"dashboard" | "laporan" | "target">("dashboard");
  const [filterKomoditas, setFilterKomoditas] = useState<string>("Semua");
  const [filterCariDesa, setFilterCariDesa] = useState<string>("");
  const [modalEdit, setModalEdit] = useState<ItemLaporanBpp | null>(null);
  const [isPending, startTransition] = useTransition();

  // Helper persentase & warna: < 60% merah, 60–84% kuning, >= 85% hijau (Keputusan 13 Nov 2026)
  const hitungPersen = (realisasi: number, target: number) => {
    if (target <= 0) return 0;
    return Math.round((realisasi / target) * 100);
  };

  const warnaCapaian = (persen: number) => {
    if (persen >= 85) return "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (persen >= 60) return "text-amber-700 bg-amber-50 border-amber-200";
    return "text-rose-700 bg-rose-50 border-rose-200";
  };

  const warnaBarCapaian = (persen: number) => {
    if (persen >= 85) return "bg-emerald-600";
    if (persen >= 60) return "bg-amber-500";
    return "bg-rose-500";
  };

  const handleSimpanTarget = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      memuat("Menyimpan target kecamatan...");
      const res = await simpanTargetKecamatanAction(fd);
      if (res.sukses) {
        await sukses("Berhasil!", res.pesan);
      } else {
        await gagal("Gagal Menyimpan Target", res.pesan);
      }
    });
  };

  const handleEditLaporan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!modalEdit) return;

    const fd = new FormData(e.currentTarget);
    fd.set("id", String(modalEdit.id));

    startTransition(async () => {
      memuat("Memperbarui laporan...");
      const res = await editLaporanBppAction(fd);
      if (res.sukses) {
        await sukses("Berhasil!", res.pesan);
        setModalEdit(null);
      } else {
        await gagal("Gagal Memperbarui", res.pesan);
      }
    });
  };

  const handleHapusLaporan = async (id: number) => {
    const yakin = await konfirmasi(
      "Hapus Laporan Ini?",
      "Laporan yang dihapus akan dikeluarkan dari rekap kecamatan.",
      "Ya, Hapus"
    );
    if (!yakin) return;

    startTransition(async () => {
      memuat("Menghapus laporan...");
      const res = await hapusLaporanBppAction(id);
      if (res.sukses) {
        await sukses("Terhapus!", res.pesan);
      } else {
        await gagal("Gagal Menghapus", res.pesan);
      }
    });
  };

  // Filter laporan
  const laporanTersaring = laporanKecamatan.filter((l) => {
    const cocokKom = filterKomoditas === "Semua" || l.komoditas === filterKomoditas;
    const cocokDesa = filterCariDesa === "" || l.nama_desa.toLowerCase().includes(filterCariDesa.toLowerCase());
    return cocokKom && cocokDesa;
  });

  return (
    <div className="space-y-5 pb-12">
      {/* 1. Header BPP */}
      <div className="rounded-3xl bg-linear-to-br from-green-800 via-primary-strong to-emerald-900 p-5 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-green-100 backdrop-blur-xs">
                Koordinator BPP
              </span>
              <span className="text-xs text-green-200 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Bulan {NAMA_BULAN[bulanAktif - 1]}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black uppercase tracking-tight">
              BPP Kecamatan {kecamatanNama}
            </h1>
            <p className="text-xs text-green-100/90 flex items-center gap-1.5 mt-0.5">
              <MapPin className="h-3.5 w-3.5" /> {namaAdmin} · Kabupaten Way Kanan
            </p>
          </div>

          <Link
            href="/ppl"
            className="flex items-center justify-center gap-2 self-start rounded-2xl bg-white/15 px-4 py-2.5 text-xs font-bold text-white shadow-sm backdrop-blur-xs transition hover:bg-white/25 active:scale-95"
          >
            <ArrowRightLeft className="h-4 w-4" /> Mode Input PPL
          </Link>
        </div>

        {/* Tab Navigation */}
        <div className="mt-5 flex gap-2 border-t border-white/15 pt-3">
          <button
            type="button"
            onClick={() => setTabAktif("dashboard")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              tabAktif === "dashboard"
                ? "bg-white text-green-900 shadow-sm"
                : "text-green-100 hover:bg-white/10"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" /> Capaian Kecamatan
          </button>

          <button
            type="button"
            onClick={() => setTabAktif("laporan")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              tabAktif === "laporan"
                ? "bg-white text-green-900 shadow-sm"
                : "text-green-100 hover:bg-white/10"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" /> Laporan LTT
          </button>

          <button
            type="button"
            onClick={() => setTabAktif("target")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              tabAktif === "target"
                ? "bg-white text-green-900 shadow-sm"
                : "text-green-100 hover:bg-white/10"
            }`}
          >
            <Target className="h-4 w-4" /> Target Kecamatan
          </button>
        </div>
      </div>

      {/* 2. KONTEN TAB: DASHBOARD & CAPAIAN */}
      {tabAktif === "dashboard" && (
        <div className="space-y-6">
          {/* Kartu Capaian 3 Komoditas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Padi */}
            <div className="rounded-3xl border border-blue-200 bg-surface p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    <Wheat className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Padi</h3>
                    <p className="text-[10px] text-muted">Bulan {NAMA_BULAN[bulanAktif - 1]}</p>
                  </div>
                </div>
                {(() => {
                  const p = hitungPersen(rekapKomoditas.padi.realisasiTanam, rekapKomoditas.padi.targetTanam);
                  return (
                    <span className={`rounded-xl border px-2.5 py-1 text-xs font-bold ${warnaCapaian(p)}`}>
                      {p}%
                    </span>
                  );
                })()}
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Realisasi Tanam:</span>
                  <span className="font-bold text-primary-strong">
                    {formatAngka(rekapKomoditas.padi.realisasiTanam)} Ha
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Target Tanam:</span>
                  <span className="font-semibold text-foreground">
                    {formatAngka(rekapKomoditas.padi.targetTanam)} Ha
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full ${warnaBarCapaian(hitungPersen(rekapKomoditas.padi.realisasiTanam, rekapKomoditas.padi.targetTanam))}`}
                    style={{ width: `${Math.min(100, hitungPersen(rekapKomoditas.padi.realisasiTanam, rekapKomoditas.padi.targetTanam))}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs border-t border-border/50 pt-2 text-muted">
                  <span>Panen:</span>
                  <span className="font-semibold text-amber-700">
                    {formatAngka(rekapKomoditas.padi.realisasiPanen)} Ha
                  </span>
                </div>
              </div>
            </div>

            {/* Jagung */}
            <div className="rounded-3xl border border-amber-200 bg-surface p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                    <Sprout className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Jagung</h3>
                    <p className="text-[10px] text-muted">Bulan {NAMA_BULAN[bulanAktif - 1]}</p>
                  </div>
                </div>
                {(() => {
                  const p = hitungPersen(rekapKomoditas.jagung.realisasiTanam, rekapKomoditas.jagung.targetTanam);
                  return (
                    <span className={`rounded-xl border px-2.5 py-1 text-xs font-bold ${warnaCapaian(p)}`}>
                      {p}%
                    </span>
                  );
                })()}
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Realisasi Tanam:</span>
                  <span className="font-bold text-primary-strong">
                    {formatAngka(rekapKomoditas.jagung.realisasiTanam)} Ha
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Target Tanam:</span>
                  <span className="font-semibold text-foreground">
                    {formatAngka(rekapKomoditas.jagung.targetTanam)} Ha
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full ${warnaBarCapaian(hitungPersen(rekapKomoditas.jagung.realisasiTanam, rekapKomoditas.jagung.targetTanam))}`}
                    style={{ width: `${Math.min(100, hitungPersen(rekapKomoditas.jagung.realisasiTanam, rekapKomoditas.jagung.targetTanam))}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs border-t border-border/50 pt-2 text-muted">
                  <span>Panen:</span>
                  <span className="font-semibold text-amber-700">
                    {formatAngka(rekapKomoditas.jagung.realisasiPanen)} Ha
                  </span>
                </div>
              </div>
            </div>

            {/* Ubi Kayu */}
            <div className="rounded-3xl border border-orange-200 bg-surface p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                    <Carrot className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Ubi Kayu</h3>
                    <p className="text-[10px] text-muted">Bulan {NAMA_BULAN[bulanAktif - 1]}</p>
                  </div>
                </div>
                {(() => {
                  const p = hitungPersen(rekapKomoditas.ubiKayu.realisasiTanam, rekapKomoditas.ubiKayu.targetTanam);
                  return (
                    <span className={`rounded-xl border px-2.5 py-1 text-xs font-bold ${warnaCapaian(p)}`}>
                      {p}%
                    </span>
                  );
                })()}
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Realisasi Tanam:</span>
                  <span className="font-bold text-primary-strong">
                    {formatAngka(rekapKomoditas.ubiKayu.realisasiTanam)} Ha
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Target Tanam:</span>
                  <span className="font-semibold text-foreground">
                    {formatAngka(rekapKomoditas.ubiKayu.targetTanam)} Ha
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full ${warnaBarCapaian(hitungPersen(rekapKomoditas.ubiKayu.realisasiTanam, rekapKomoditas.ubiKayu.targetTanam))}`}
                    style={{ width: `${Math.min(100, hitungPersen(rekapKomoditas.ubiKayu.realisasiTanam, rekapKomoditas.ubiKayu.targetTanam))}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs border-t border-border/50 pt-2 text-muted">
                  <span>Panen:</span>
                  <span className="font-semibold text-amber-700">
                    {formatAngka(rekapKomoditas.ubiKayu.realisasiPanen)} Ha
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabel Capaian per Desa */}
          <div className="rounded-3xl border border-border bg-surface p-5 shadow-xs overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-foreground">Rekapitulasi Desa</h3>
                <p className="text-xs text-muted">Capaian tanam & panen per desa bulan berjalan</p>
              </div>
              <span className="rounded-full bg-background px-3 py-1 text-xs font-bold text-muted border border-border">
                {rekapDesa.length} Desa
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-background text-muted uppercase font-bold text-[10px]">
                    <th className="p-3">Nama Desa</th>
                    <th className="p-3 text-right">Tanam Padi</th>
                    <th className="p-3 text-right">Tanam Jagung</th>
                    <th className="p-3 text-right">Tanam Ubi Kayu</th>
                    <th className="p-3 text-right">Total Tanam</th>
                    <th className="p-3 text-right">Total Panen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rekapDesa.map((d) => (
                    <tr key={d.desaId} className="hover:bg-background/50">
                      <td className="p-3 font-semibold text-foreground">{d.namaDesa}</td>
                      <td className="p-3 text-right font-medium">{formatAngka(d.tanamPadi)} Ha</td>
                      <td className="p-3 text-right font-medium">{formatAngka(d.tanamJagung)} Ha</td>
                      <td className="p-3 text-right font-medium">{formatAngka(d.tanamUbi)} Ha</td>
                      <td className="p-3 text-right font-bold text-primary-strong">
                        {formatAngka(d.totalTanam)} Ha
                      </td>
                      <td className="p-3 text-right font-bold text-amber-700">
                        {formatAngka(d.totalPanen)} Ha
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. KONTEN TAB: LAPORAN LTT KECAMATAN */}
      {tabAktif === "laporan" && (
        <div className="rounded-3xl border border-border bg-surface p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-foreground">Daftar Laporan LTT Kecamatan</h3>
              <p className="text-xs text-muted">Seluruh laporan Padi, Jagung, dan Ubi Kayu di wilayah Anda</p>
            </div>

            {/* Filter Bar */}
            <div className="flex gap-2">
              <select
                value={filterKomoditas}
                onChange={(e) => setFilterKomoditas(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold focus:outline-hidden"
              >
                <option value="Semua">Semua Komoditas</option>
                <option value="Padi">Padi</option>
                <option value="Jagung">Jagung</option>
                <option value="Ubi Kayu">Ubi Kayu</option>
              </select>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
                <input
                  type="text"
                  placeholder="Cari desa..."
                  value={filterCariDesa}
                  onChange={(e) => setFilterCariDesa(e.target.value)}
                  className="rounded-xl border border-border bg-background pl-8 pr-3 py-2 text-xs focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-background text-muted uppercase font-bold text-[10px]">
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Desa</th>
                  <th className="p-3">Komoditas</th>
                  <th className="p-3 text-right">Tanam</th>
                  <th className="p-3 text-right">Panen</th>
                  <th className="p-3">Sumber/Pelapor</th>
                  <th className="p-3">Keterangan</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {laporanTersaring.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-xs text-muted">
                      Tidak ada laporan yang sesuai kriteria filter.
                    </td>
                  </tr>
                ) : (
                  laporanTersaring.map((lap) => (
                    <tr key={lap.id} className="hover:bg-background/50">
                      <td className="p-3 text-muted whitespace-nowrap">{formatTanggal(lap.waktu)}</td>
                      <td className="p-3 font-semibold text-foreground">{lap.nama_desa}</td>
                      <td className="p-3 font-semibold">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            lap.komoditas === "Padi"
                              ? "bg-blue-100 text-blue-800"
                              : lap.komoditas === "Jagung"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-orange-100 text-orange-800"
                          }`}
                        >
                          {lap.komoditas}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-primary-strong">
                        {formatAngka(lap.realisasi_tanam)} Ha
                      </td>
                      <td className="p-3 text-right font-bold text-amber-700">
                        {formatAngka(lap.realisasi_panen)} Ha
                      </td>
                      <td className="p-3 text-muted text-[11px]">
                        {lap.sumber === "epusluh" ? "e-Pusluh" : lap.nama_pelapor || "Penyuluh"}
                      </td>
                      <td className="p-3 text-muted max-w-[150px] truncate">{lap.keterangan || "-"}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setModalEdit(lap)}
                            title="Edit Laporan"
                            className="rounded-lg border border-border p-1.5 text-muted hover:border-primary hover:text-primary transition"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleHapusLaporan(lap.id)}
                            title="Hapus Laporan"
                            className="rounded-lg border border-border p-1.5 text-muted hover:border-danger hover:text-danger transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. KONTEN TAB: PENGATURAN TARGET KECAMATAN */}
      {tabAktif === "target" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Formulir Input Target */}
          <div className="md:col-span-1 rounded-3xl border border-border bg-surface p-5 shadow-xs">
            <h3 className="font-bold text-foreground">Atur Target Kecamatan</h3>
            <p className="text-xs text-muted mt-0.5">
              Target diisi oleh Admin BPP untuk siklus 12 bulan (tanpa tahun).
            </p>

            <form onSubmit={handleSimpanTarget} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Pilih Bulan <span className="text-danger">*</span>
                </label>
                <select
                  name="bulan"
                  defaultValue={bulanAktif}
                  required
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm font-medium focus:outline-hidden"
                >
                  {NAMA_BULAN.map((nama, idx) => (
                    <option key={nama} value={idx + 1}>
                      {nama} (Bulan {idx + 1})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Pilih Komoditas <span className="text-danger">*</span>
                </label>
                <select
                  name="komoditas"
                  required
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm font-medium focus:outline-hidden"
                >
                  <option value="Padi">Padi</option>
                  <option value="Jagung">Jagung</option>
                  <option value="Ubi Kayu">Ubi Kayu</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Target Luas Tanam (Ha) <span className="text-danger">*</span>
                </label>
                <input
                  name="targetTanam"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  required
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm font-medium focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Target Luas Panen (Ha) <span className="text-danger">*</span>
                </label>
                <input
                  name="targetPanen"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  required
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm font-medium focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-xl bg-primary py-3 text-xs font-bold text-white shadow-md shadow-primary/20 transition hover:bg-primary-strong disabled:opacity-50"
              >
                {isPending ? "Menyimpan..." : "Simpan Target Kecamatan"}
              </button>
            </form>
          </div>

          {/* Daftar Target yang Sudah Terisi */}
          <div className="md:col-span-2 rounded-3xl border border-border bg-surface p-5 shadow-xs overflow-hidden">
            <h3 className="font-bold text-foreground">Daftar Target Kecamatan</h3>
            <p className="text-xs text-muted mt-0.5">Ringkasan target yang tersimpan per bulan</p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-background text-muted uppercase font-bold text-[10px]">
                    <th className="p-3">Bulan</th>
                    <th className="p-3">Komoditas</th>
                    <th className="p-3 text-right">Target Tanam</th>
                    <th className="p-3 text-right">Target Panen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {targetList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-xs text-muted">
                        Belum ada target yang disimpan untuk kecamatan ini.
                      </td>
                    </tr>
                  ) : (
                    targetList.map((t, idx) => (
                      <tr key={idx} className="hover:bg-background/50">
                        <td className="p-3 font-semibold text-foreground">
                          {NAMA_BULAN[t.bulan - 1]}
                        </td>
                        <td className="p-3 font-semibold">{t.komoditas}</td>
                        <td className="p-3 text-right font-bold text-primary-strong">
                          {formatAngka(t.target_tanam)} Ha
                        </td>
                        <td className="p-3 text-right font-bold text-amber-700">
                          {formatAngka(t.target_panen)} Ha
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT LAPORAN BPP */}
      {modalEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-surface p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-foreground">
                Koreksi Laporan {modalEdit.komoditas}
              </h3>
              <button
                type="button"
                onClick={() => setModalEdit(null)}
                className="rounded-full p-1 text-muted hover:bg-background"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditLaporan} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Desa <span className="text-danger">*</span>
                </label>
                <select
                  name="desaId"
                  defaultValue={modalEdit.desa_id}
                  required
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm font-medium focus:outline-hidden"
                >
                  {daftarDesa.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Luas Tanam (Ha)
                  </label>
                  <input
                    name="realisasiTanam"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={modalEdit.realisasi_tanam}
                    required
                    className="w-full rounded-xl border border-border bg-background p-3 text-sm font-medium focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Luas Panen (Ha)
                  </label>
                  <input
                    name="realisasiPanen"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={modalEdit.realisasi_panen}
                    required
                    className="w-full rounded-xl border border-border bg-background p-3 text-sm font-medium focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Keterangan
                </label>
                <textarea
                  name="keterangan"
                  rows={2}
                  defaultValue={modalEdit.keterangan || ""}
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:outline-hidden"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalEdit(null)}
                  className="w-1/3 rounded-xl border border-border py-3 text-xs font-bold text-muted transition hover:bg-background"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-2/3 rounded-xl bg-primary py-3 text-xs font-bold text-white shadow-md shadow-primary/20 transition hover:bg-primary-strong disabled:opacity-50"
                >
                  {isPending ? "Menyimpan..." : "Simpan Koreksi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
