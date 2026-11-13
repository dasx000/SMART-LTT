"use client";

import { useState, useTransition } from "react";
import {
  Wheat,
  Sprout,
  Carrot,
  Calendar,
  LayoutDashboard,
  FileSpreadsheet,
  Search,
  Edit3,
  Trash2,
  X,
  MapPin,
  Sparkles,
} from "lucide-react";
import { formatAngka, NAMA_BULAN, formatTanggal } from "@/lib/format";
import { sukses, gagal, konfirmasi, memuat } from "@/lib/swal";
import { editLaporanKabAction, hapusLaporanKabAction } from "./actions";

export interface ItemKecamatanCapaian {
  kecamatanId: number;
  namaKecamatan: string;
  tanamPadi: number;
  tanamJagung: number;
  tanamUbi: number;
  totalTanam: number;
  targetTanam: number;
  totalPanen: number;
}

export interface ItemPmAasKecamatan {
  kecamatanId: number;
  namaKecamatan: string;
  tanamPmAas: number;
  panenPmAas: number;
}

export interface ItemLaporanKab {
  id: number;
  desa_id: number;
  nama_desa: string;
  nama_kecamatan: string;
  komoditas: "Padi" | "Jagung" | "Ubi Kayu";
  realisasi_tanam: number;
  realisasi_panen: number;
  luas_bera: number;
  realisasi_olah: number;
  metode_penanaman: "Regular" | "PM AAS" | null;
  keterangan: string | null;
  waktu: string;
  sumber: "manual" | "epusluh";
  nama_pelapor: string | null;
}

export function TampilanKab({
  rolePengguna,
  namaPengguna,
  bulanAktif,
  totalPadi,
  totalJagung,
  totalUbi,
  totalPmAas,
  targetKabupaten,
  rekapKecamatan,
  rekapPmAas,
  laporanKabupaten,
  daftarDesaSemua,
}: {
  rolePengguna: "Admin_Kab" | "Dinas";
  namaPengguna: string;
  bulanAktif: number;
  totalPadi: { tanam: number; panen: number };
  totalJagung: { tanam: number; panen: number };
  totalUbi: { tanam: number; panen: number };
  totalPmAas: { tanam: number; panen: number };
  targetKabupaten: {
    padi: number;
    jagung: number;
    ubiKayu: number;
  };
  rekapKecamatan: ItemKecamatanCapaian[];
  rekapPmAas: ItemPmAasKecamatan[];
  laporanKabupaten: ItemLaporanKab[];
  daftarDesaSemua: { id: number; nama: string; kecamatan_id: number }[];
}) {
  const [tabAktif, setTabAktif] = useState<"dashboard" | "pmAas" | "laporan">("dashboard");
  const [filterKecamatan, setFilterKecamatan] = useState<string>("Semua");
  const [filterKomoditas, setFilterKomoditas] = useState<string>("Semua");
  const [filterCari, setFilterCari] = useState<string>("");
  const [modalEdit, setModalEdit] = useState<ItemLaporanKab | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDinas = rolePengguna === "Dinas";

  // Ambang warna capaian: < 60% merah, 60–84% kuning, >= 85% hijau (Keputusan 13 Nov 2026)
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

  // Total tanam & panen seluruh kabupaten
  const grandTotalTanam = totalPadi.tanam + totalJagung.tanam + totalUbi.tanam;
  const grandTotalPanen = totalPadi.panen + totalJagung.panen + totalUbi.panen;
  const grandTargetTanam = targetKabupaten.padi + targetKabupaten.jagung + targetKabupaten.ubiKayu;

  const handleEditLaporan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!modalEdit || isDinas) return;

    const fd = new FormData(e.currentTarget);
    fd.set("id", String(modalEdit.id));

    startTransition(async () => {
      memuat("Memperbarui laporan...");
      const res = await editLaporanKabAction(fd);
      if (res.sukses) {
        await sukses("Berhasil!", res.pesan);
        setModalEdit(null);
      } else {
        await gagal("Gagal Memperbarui", res.pesan);
      }
    });
  };

  const handleHapusLaporan = async (id: number) => {
    if (isDinas) return;
    const yakin = await konfirmasi(
      "Hapus Laporan Ini?",
      "Laporan yang dihapus akan dikeluarkan dari rekapitulasi kabupaten.",
      "Ya, Hapus"
    );
    if (!yakin) return;

    startTransition(async () => {
      memuat("Menghapus laporan...");
      const res = await hapusLaporanKabAction(id);
      if (res.sukses) {
        await sukses("Terhapus!", res.pesan);
      } else {
        await gagal("Gagal Menghapus", res.pesan);
      }
    });
  };

  // Filter laporan se-kabupaten
  const laporanTersaring = laporanKabupaten.filter((l) => {
    const cocokKec = filterKecamatan === "Semua" || l.nama_kecamatan === filterKecamatan;
    const cocokKom = filterKomoditas === "Semua" || l.komoditas === filterKomoditas;
    const cocokTeks =
      filterCari === "" ||
      l.nama_desa.toLowerCase().includes(filterCari.toLowerCase()) ||
      l.nama_kecamatan.toLowerCase().includes(filterCari.toLowerCase());
    return cocokKec && cocokKom && cocokTeks;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Kabupaten */}
      <div className="rounded-3xl bg-linear-to-br from-emerald-900 via-primary-strong to-green-950 p-6 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-green-100 backdrop-blur-xs">
                {isDinas ? "Dinas TPHP" : "Admin Kabupaten"}
              </span>
              <span className="text-xs text-green-200 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Bulan {NAMA_BULAN[bulanAktif - 1]}
              </span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-black uppercase tracking-tight">
              Kabupaten Way Kanan
            </h1>
            <p className="text-xs text-green-100/90 flex items-center gap-1.5 mt-0.5">
              <MapPin className="h-3.5 w-3.5" /> {namaPengguna} · Dashboard Agregat 15 Kecamatan
            </p>
          </div>
        </div>

        {/* Tab Navigasi */}
        <div className="mt-6 flex gap-2 border-t border-white/15 pt-3">
          <button
            type="button"
            onClick={() => setTabAktif("dashboard")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              tabAktif === "dashboard"
                ? "bg-white text-green-950 shadow-sm"
                : "text-green-100 hover:bg-white/10"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" /> Smart Dashboard
          </button>

          <button
            type="button"
            onClick={() => setTabAktif("pmAas")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              tabAktif === "pmAas"
                ? "bg-white text-green-950 shadow-sm"
                : "text-green-100 hover:bg-white/10"
            }`}
          >
            <Sparkles className="h-4 w-4" /> LTT PM AAS
          </button>

          {!isDinas && (
            <button
              type="button"
              onClick={() => setTabAktif("laporan")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                tabAktif === "laporan"
                  ? "bg-white text-green-950 shadow-sm"
                  : "text-green-100 hover:bg-white/10"
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" /> Laporan LTT se-Kabupaten
            </button>
          )}
        </div>
      </div>

      {/* 2. KONTEN TAB: DASHBOARD KABUPATEN */}
      {tabAktif === "dashboard" && (
        <div className="space-y-6">
          {/* KPI Utama 4 Sektor */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Padi */}
            <div className="rounded-3xl border border-blue-200 bg-surface p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Wheat className="h-5 w-5" />
                </div>
                {(() => {
                  const p = hitungPersen(totalPadi.tanam, targetKabupaten.padi);
                  return (
                    <span className={`rounded-xl border px-2.5 py-1 text-xs font-bold ${warnaCapaian(p)}`}>
                      {p}%
                    </span>
                  );
                })()}
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase text-muted">PADI</span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-black text-primary-strong">
                    {formatAngka(totalPadi.tanam)}
                  </span>
                  <span className="text-xs text-muted">/ {formatAngka(targetKabupaten.padi)} Ha</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 mt-2">
                  <div
                    className={`h-full ${warnaBarCapaian(hitungPersen(totalPadi.tanam, targetKabupaten.padi))}`}
                    style={{ width: `${Math.min(100, hitungPersen(totalPadi.tanam, targetKabupaten.padi))}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted">
                  Panen: <strong className="text-amber-700">{formatAngka(totalPadi.panen)} Ha</strong>
                </p>
              </div>
            </div>

            {/* Jagung */}
            <div className="rounded-3xl border border-amber-200 bg-surface p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <Sprout className="h-5 w-5" />
                </div>
                {(() => {
                  const p = hitungPersen(totalJagung.tanam, targetKabupaten.jagung);
                  return (
                    <span className={`rounded-xl border px-2.5 py-1 text-xs font-bold ${warnaCapaian(p)}`}>
                      {p}%
                    </span>
                  );
                })()}
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase text-muted">JAGUNG</span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-black text-primary-strong">
                    {formatAngka(totalJagung.tanam)}
                  </span>
                  <span className="text-xs text-muted">/ {formatAngka(targetKabupaten.jagung)} Ha</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 mt-2">
                  <div
                    className={`h-full ${warnaBarCapaian(hitungPersen(totalJagung.tanam, targetKabupaten.jagung))}`}
                    style={{ width: `${Math.min(100, hitungPersen(totalJagung.tanam, targetKabupaten.jagung))}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted">
                  Panen: <strong className="text-amber-700">{formatAngka(totalJagung.panen)} Ha</strong>
                </p>
              </div>
            </div>

            {/* Ubi Kayu */}
            <div className="rounded-3xl border border-orange-200 bg-surface p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                  <Carrot className="h-5 w-5" />
                </div>
                {(() => {
                  const p = hitungPersen(totalUbi.tanam, targetKabupaten.ubiKayu);
                  return (
                    <span className={`rounded-xl border px-2.5 py-1 text-xs font-bold ${warnaCapaian(p)}`}>
                      {p}%
                    </span>
                  );
                })()}
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase text-muted">UBI KAYU</span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-black text-primary-strong">
                    {formatAngka(totalUbi.tanam)}
                  </span>
                  <span className="text-xs text-muted">/ {formatAngka(targetKabupaten.ubiKayu)} Ha</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 mt-2">
                  <div
                    className={`h-full ${warnaBarCapaian(hitungPersen(totalUbi.tanam, targetKabupaten.ubiKayu))}`}
                    style={{ width: `${Math.min(100, hitungPersen(totalUbi.tanam, targetKabupaten.ubiKayu))}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted">
                  Panen: <strong className="text-amber-700">{formatAngka(totalUbi.panen)} Ha</strong>
                </p>
              </div>
            </div>

            {/* PM AAS */}
            <div className="rounded-3xl border border-emerald-200 bg-surface p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Sparkles className="h-5 w-5" />
                </div>
                <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  Alsintan
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase text-muted">PM AAS (PADI)</span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-black text-emerald-700">
                    {formatAngka(totalPmAas.tanam)}
                  </span>
                  <span className="text-xs text-muted">Ha</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 mt-2">
                  <div className="h-full bg-emerald-600" style={{ width: "100%" }} />
                </div>
                <p className="mt-2 text-xs text-muted">
                  Panen: <strong className="text-amber-700">{formatAngka(totalPmAas.panen)} Ha</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Tabel Agregat 15 Kecamatan */}
          <div className="rounded-3xl border border-border bg-surface p-5 shadow-xs overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-foreground">Rekapitulasi 15 Kecamatan</h3>
                <p className="text-xs text-muted">Capaian tanam dan panen komoditas bulan berjalan</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary-soft/50 px-3 py-1 text-xs font-bold text-primary-strong">
                  Total Tanam: {formatAngka(grandTotalTanam)} Ha
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-background text-muted uppercase font-bold text-[10px]">
                    <th className="p-3">Kecamatan</th>
                    <th className="p-3 text-right">Tanam Padi</th>
                    <th className="p-3 text-right">Tanam Jagung</th>
                    <th className="p-3 text-right">Tanam Ubi</th>
                    <th className="p-3 text-right">Total Tanam</th>
                    <th className="p-3 text-right">Target</th>
                    <th className="p-3 text-center">Capaian</th>
                    <th className="p-3 text-right">Total Panen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rekapKecamatan.map((k) => {
                    const persen = hitungPersen(k.totalTanam, k.targetTanam);
                    return (
                      <tr key={k.kecamatanId} className="hover:bg-background/50">
                        <td className="p-3 font-semibold text-foreground">{k.namaKecamatan}</td>
                        <td className="p-3 text-right font-medium">{formatAngka(k.tanamPadi)} Ha</td>
                        <td className="p-3 text-right font-medium">{formatAngka(k.tanamJagung)} Ha</td>
                        <td className="p-3 text-right font-medium">{formatAngka(k.tanamUbi)} Ha</td>
                        <td className="p-3 text-right font-bold text-primary-strong">
                          {formatAngka(k.totalTanam)} Ha
                        </td>
                        <td className="p-3 text-right text-muted">{formatAngka(k.targetTanam)} Ha</td>
                        <td className="p-3 text-center">
                          <span className={`rounded-lg border px-2 py-0.5 font-bold text-[10px] ${warnaCapaian(persen)}`}>
                            {persen}%
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold text-amber-700">
                          {formatAngka(k.totalPanen)} Ha
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-background/80 font-black text-xs text-foreground">
                    <td className="p-3 uppercase">TOTAL KABUPATEN</td>
                    <td className="p-3 text-right text-primary">{formatAngka(totalPadi.tanam)} Ha</td>
                    <td className="p-3 text-right text-primary">{formatAngka(totalJagung.tanam)} Ha</td>
                    <td className="p-3 text-right text-primary">{formatAngka(totalUbi.tanam)} Ha</td>
                    <td className="p-3 text-right text-primary-strong">{formatAngka(grandTotalTanam)} Ha</td>
                    <td className="p-3 text-right">{formatAngka(grandTargetTanam)} Ha</td>
                    <td className="p-3 text-center">
                      <span className={`rounded-lg border px-2.5 py-1 font-bold text-xs ${warnaCapaian(hitungPersen(grandTotalTanam, grandTargetTanam))}`}>
                        {hitungPersen(grandTotalTanam, grandTargetTanam)}%
                      </span>
                    </td>
                    <td className="p-3 text-right text-amber-700">{formatAngka(grandTotalPanen)} Ha</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. KONTEN TAB: LTT PM AAS */}
      {tabAktif === "pmAas" && (
        <div className="rounded-3xl border border-border bg-surface p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-bold text-foreground">Rekapitulasi LTT PM AAS (Padi)</h3>
              <p className="text-xs text-muted">
                Metode penanaman Alsintan (Percepatan Tanam) di 15 Kecamatan
              </p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              Total PM AAS: {formatAngka(totalPmAas.tanam)} Ha
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-background text-muted uppercase font-bold text-[10px]">
                  <th className="p-3">Kecamatan</th>
                  <th className="p-3 text-right">Luas Tanam PM AAS</th>
                  <th className="p-3 text-right">Luas Panen PM AAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rekapPmAas.map((p) => (
                  <tr key={p.kecamatanId} className="hover:bg-background/50">
                    <td className="p-3 font-semibold text-foreground">{p.namaKecamatan}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">
                      {formatAngka(p.tanamPmAas)} Ha
                    </td>
                    <td className="p-3 text-right font-bold text-amber-700">
                      {formatAngka(p.panenPmAas)} Ha
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-background font-black text-xs">
                  <td className="p-3 uppercase">TOTAL KABUPATEN</td>
                  <td className="p-3 text-right text-emerald-700">{formatAngka(totalPmAas.tanam)} Ha</td>
                  <td className="p-3 text-right text-amber-700">{formatAngka(totalPmAas.panen)} Ha</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 4. KONTEN TAB: LAPORAN LTT SE-KABUPATEN (Hanya Admin_Kab) */}
      {tabAktif === "laporan" && !isDinas && (
        <div className="rounded-3xl border border-border bg-surface p-5 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-foreground">Seluruh Laporan LTT Kabupaten</h3>
              <p className="text-xs text-muted">Daftar semua laporan dari seluruh desa di 15 kecamatan</p>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap gap-2">
              <select
                value={filterKecamatan}
                onChange={(e) => setFilterKecamatan(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold focus:outline-hidden"
              >
                <option value="Semua">Semua Kecamatan</option>
                {rekapKecamatan.map((k) => (
                  <option key={k.kecamatanId} value={k.namaKecamatan}>
                    {k.namaKecamatan}
                  </option>
                ))}
              </select>

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
                  placeholder="Cari desa/kecamatan..."
                  value={filterCari}
                  onChange={(e) => setFilterCari(e.target.value)}
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
                  <th className="p-3">Kecamatan</th>
                  <th className="p-3">Desa</th>
                  <th className="p-3">Komoditas</th>
                  <th className="p-3 text-right">Tanam</th>
                  <th className="p-3 text-right">Panen</th>
                  <th className="p-3">Metode</th>
                  <th className="p-3">Sumber/Pelapor</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {laporanTersaring.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-xs text-muted">
                      Tidak ada laporan yang sesuai kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  laporanTersaring.map((lap) => (
                    <tr key={lap.id} className="hover:bg-background/50">
                      <td className="p-3 text-muted whitespace-nowrap">{formatTanggal(lap.waktu)}</td>
                      <td className="p-3 text-muted font-medium">{lap.nama_kecamatan}</td>
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
                        {lap.metode_penanaman ? (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800 font-semibold border border-emerald-200 text-[10px]">
                            {lap.metode_penanaman}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-3 text-muted text-[11px]">
                        {lap.sumber === "epusluh" ? "e-Pusluh" : lap.nama_pelapor || "Penyuluh"}
                      </td>
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

      {/* MODAL EDIT LAPORAN KABUPATEN */}
      {modalEdit && !isDinas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-surface p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-foreground">
                Koreksi Laporan Admin Kabupaten ({modalEdit.komoditas})
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
                  {daftarDesaSemua.map((d) => (
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Luas Bera (Ha)
                  </label>
                  <input
                    name="luasBera"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={modalEdit.luas_bera}
                    className="w-full rounded-xl border border-border bg-background p-3 text-sm font-medium focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Realisasi Olah Lahan (Ha)
                  </label>
                  <input
                    name="realisasiOlah"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={modalEdit.realisasi_olah}
                    className="w-full rounded-xl border border-border bg-background p-3 text-sm font-medium focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Metode Penanaman (Khusus Padi)
                </label>
                <select
                  name="metodePenanaman"
                  defaultValue={modalEdit.metode_penanaman || ""}
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm font-medium focus:outline-hidden"
                >
                  <option value="">-- Standar (Bukan PM AAS) --</option>
                  <option value="Regular">Regular</option>
                  <option value="PM AAS">PM AAS</option>
                </select>
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
                  {isPending ? "Menyimpan..." : "Simpan Koreksi Kabupaten"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
