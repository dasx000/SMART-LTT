"use client";

import { useState, useTransition } from "react";
import {
  Wheat,
  Sprout,
  Carrot,
  Plus,
  Edit3,
  Trash2,
  Clock,
  CheckCircle2,
  MapPin,
  Calendar,
  X,
} from "lucide-react";
import { formatAngka, formatTanggal } from "@/lib/format";
import { sukses, gagal, konfirmasi, memuat } from "@/lib/swal";
import { simpanLaporanAction, editLaporanAction, hapusLaporanAction } from "./actions";

export interface ItemDesa {
  id: number;
  nama: string;
}

export interface ItemLaporanHariIni {
  id: number;
  desa_id: number;
  nama_desa: string;
  komoditas: "Padi" | "Jagung" | "Ubi Kayu";
  realisasi_tanam: number;
  realisasi_panen: number;
  keterangan: string | null;
  waktu: string; // ISO string
  sumber: "manual" | "epusluh";
}

export interface ItemStatusPadi {
  desa_id: number;
  nama_desa: string;
  realisasi_tanam: number;
  realisasi_panen: number;
  sudah_lapor: boolean;
  waktu_tarik: string | null;
}

export function TampilanPPL({
  namaPenyuluh,
  nip,
  kecamatanNama,
  daftarDesa,
  laporanHariIni,
  statusPadiHariIni,
}: {
  namaPenyuluh: string;
  nip: string;
  kecamatanNama: string;
  daftarDesa: ItemDesa[];
  laporanHariIni: ItemLaporanHariIni[];
  statusPadiHariIni: ItemStatusPadi[];
}) {
  const [komoditasAktif, setKomoditasAktif] = useState<"Padi" | "Jagung" | "Ubi Kayu" | null>(null);
  const [modalEdit, setModalEdit] = useState<ItemLaporanHariIni | null>(null);
  const [bukaFormBaru, setBukaFormBaru] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Hitung total tanam & panen hari ini (semua komoditas binaan)
  const totalTanamHariIni = laporanHariIni.reduce((acc, l) => acc + l.realisasi_tanam, 0);
  const totalPanenHariIni = laporanHariIni.reduce((acc, l) => acc + l.realisasi_panen, 0);

  // Filter laporan hari ini sesuai komoditas aktif (Jagung / Ubi Kayu)
  const laporanKomoditas = laporanHariIni.filter((l) => l.komoditas === komoditasAktif);

  const handleSubmitBaru = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!komoditasAktif || komoditasAktif === "Padi") return;

    const fd = new FormData(e.currentTarget);
    fd.set("komoditas", komoditasAktif);

    startTransition(async () => {
      memuat("Menyimpan laporan...");
      const res = await simpanLaporanAction(fd);
      if (res.sukses) {
        await sukses("Berhasil!", res.pesan);
        setBukaFormBaru(false);
      } else {
        await gagal("Gagal Menyimpan", res.pesan);
      }
    });
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!modalEdit) return;

    const fd = new FormData(e.currentTarget);
    fd.set("id", String(modalEdit.id));

    startTransition(async () => {
      memuat("Memperbarui laporan...");
      const res = await editLaporanAction(fd);
      if (res.sukses) {
        await sukses("Berhasil!", res.pesan);
        setModalEdit(null);
      } else {
        await gagal("Gagal Memperbarui", res.pesan);
      }
    });
  };

  const handleHapus = async (id: number) => {
    const yakin = await konfirmasi(
      "Hapus Laporan?",
      "Laporan yang dihapus tidak akan dihitung dalam rekap hari ini.",
      "Ya, Hapus"
    );
    if (!yakin) return;

    startTransition(async () => {
      memuat("Menghapus laporan...");
      const res = await hapusLaporanAction(id);
      if (res.sukses) {
        await sukses("Terhapus!", res.pesan);
      } else {
        await gagal("Gagal Menghapus", res.pesan);
      }
    });
  };

  return (
    <div className="space-y-5 pb-10">
      {/* 1. Header Profil Ringkas Penyuluh */}
      <div className="rounded-3xl bg-linear-to-br from-primary-strong via-primary to-emerald-700 p-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-green-100 backdrop-blur-xs">
            Penyuluh Pertanian
          </span>
          <span className="text-xs text-green-100 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatTanggal(new Date())}
          </span>
        </div>

        <h1 className="mt-2 text-xl font-black uppercase tracking-tight">{namaPenyuluh}</h1>
        <p className="text-xs text-green-100/90">NIP: {nip || "-"}</p>

        <div className="mt-3 flex items-start gap-1.5 border-t border-white/15 pt-3 text-xs text-green-50">
          <MapPin className="h-4 w-4 shrink-0 text-green-200 mt-0.5" />
          <div>
            <span className="font-semibold text-white">WKPP ({kecamatanNama}):</span>{" "}
            {daftarDesa.length > 0 ? daftarDesa.map((d) => d.nama).join(", ") : "Belum ditentukan"}
          </div>
        </div>
      </div>

      {/* 2. Kartu Ringkasan Hari Ini */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Total Tanam Hari Ini
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-black text-primary-strong">
              {formatAngka(totalTanamHariIni)}
            </span>
            <span className="text-xs font-semibold text-muted">Ha</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Total Panen Hari Ini
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-black text-amber-700">
              {formatAngka(totalPanenHariIni)}
            </span>
            <span className="text-xs font-semibold text-muted">Ha</span>
          </div>
        </div>
      </div>

      {/* 3. Tombol Komoditas Utama (Padi, Jagung, Ubi Kayu) */}
      <div className="rounded-3xl border border-border bg-surface p-5 shadow-xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Pilih Komoditas</h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {/* Padi */}
          <button
            type="button"
            onClick={() => {
              setKomoditasAktif("Padi");
              setBukaFormBaru(false);
            }}
            className={`flex flex-col items-center justify-center rounded-2xl border p-4 transition-all active:scale-95 ${
              komoditasAktif === "Padi"
                ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm ring-2 ring-blue-400"
                : "border-border bg-background hover:bg-surface text-foreground"
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Wheat className="h-6 w-6" />
            </div>
            <span className="mt-2 text-xs font-bold">Padi</span>
            <span className="text-[10px] text-muted">e-Pusluh</span>
          </button>

          {/* Jagung */}
          <button
            type="button"
            onClick={() => {
              setKomoditasAktif("Jagung");
              setBukaFormBaru(false);
            }}
            className={`flex flex-col items-center justify-center rounded-2xl border p-4 transition-all active:scale-95 ${
              komoditasAktif === "Jagung"
                ? "border-amber-500 bg-amber-50 text-amber-800 shadow-sm ring-2 ring-amber-400"
                : "border-border bg-background hover:bg-surface text-foreground"
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Sprout className="h-6 w-6" />
            </div>
            <span className="mt-2 text-xs font-bold">Jagung</span>
            <span className="text-[10px] text-muted">Input LTT</span>
          </button>

          {/* Ubi Kayu */}
          <button
            type="button"
            onClick={() => {
              setKomoditasAktif("Ubi Kayu");
              setBukaFormBaru(false);
            }}
            className={`flex flex-col items-center justify-center rounded-2xl border p-4 transition-all active:scale-95 ${
              komoditasAktif === "Ubi Kayu"
                ? "border-orange-500 bg-orange-50 text-orange-800 shadow-sm ring-2 ring-orange-400"
                : "border-border bg-background hover:bg-surface text-foreground"
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <Carrot className="h-6 w-6" />
            </div>
            <span className="mt-2 text-xs font-bold">Ubi Kayu</span>
            <span className="text-[10px] text-muted">Input LTT</span>
          </button>
        </div>
      </div>

      {/* 4. Konten Sesuai Komoditas yang Dipilih */}

      {/* A. KOMODITAS PADI: Cek Status Harian e-Pusluh */}
      {komoditasAktif === "Padi" && (
        <div className="rounded-3xl border border-blue-200 bg-blue-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-blue-100 pb-3">
            <div>
              <h3 className="font-bold text-blue-900">Status Padi Hari Ini</h3>
              <p className="text-xs text-blue-700">Ditarik otomatis dari e-Pusluh oleh bot server</p>
            </div>
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-800">
              Otomatis
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {statusPadiHariIni.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted">
                Belum ada data tarikan padi untuk hari ini. Bot server menarik pada jam 11:30, 12:30, 13:30, 22:30 WIB.
              </p>
            ) : (
              statusPadiHariIni.map((sp) => (
                <div
                  key={sp.desa_id}
                  className="flex items-center justify-between rounded-xl border border-blue-100 bg-white p-3 text-xs shadow-2xs"
                >
                  <div>
                    <span className="font-bold text-foreground">{sp.nama_desa}</span>
                    <div className="mt-0.5 text-[11px] text-muted">
                      Tanam: <span className="font-semibold text-primary">{formatAngka(sp.realisasi_tanam)} Ha</span> | 
                      Panen: <span className="font-semibold text-amber-700">{formatAngka(sp.realisasi_panen)} Ha</span>
                    </div>
                  </div>
                  <div>
                    {sp.sudah_lapor ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-800 text-[10px]">
                        <CheckCircle2 className="h-3 w-3" /> Sudah Lapor
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-600 text-[10px]">
                        <Clock className="h-3 w-3" /> Belum Lapor
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* B. KOMODITAS JAGUNG & UBI KAYU: Input Form & Riwayat Laporan Hari Ini */}
      {(komoditasAktif === "Jagung" || komoditasAktif === "Ubi Kayu") && (
        <div className="space-y-4">
          {/* Tombol Buka Form Input Baru */}
          {!bukaFormBaru ? (
            <button
              type="button"
              onClick={() => setBukaFormBaru(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/50 bg-primary-soft/40 py-4 text-sm font-bold text-primary transition-all hover:bg-primary-soft/70 active:scale-98"
            >
              <Plus className="h-5 w-5" />
              Input Laporan {komoditasAktif} Baru
            </button>
          ) : (
            /* Formulir Input Laporan Baru */
            <div className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-bold text-foreground">
                  Form Laporan {komoditasAktif}
                </h3>
                <button
                  type="button"
                  onClick={() => setBukaFormBaru(false)}
                  className="rounded-full p-1 text-muted hover:bg-background"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitBaru} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Pilih Desa Binaan <span className="text-danger">*</span>
                  </label>
                  <select
                    name="desaId"
                    required
                    className="w-full rounded-xl border border-border bg-background p-3 text-sm font-medium focus:border-primary focus:outline-hidden"
                  >
                    <option value="">-- Pilih Desa --</option>
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
                      Luas Tanam (Ha) <span className="text-danger">*</span>
                    </label>
                    <input
                      name="realisasiTanam"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      required
                      className="w-full rounded-xl border border-border bg-background p-3 text-sm font-medium focus:border-primary focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Luas Panen (Ha) <span className="text-danger">*</span>
                    </label>
                    <input
                      name="realisasiPanen"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      required
                      className="w-full rounded-xl border border-border bg-background p-3 text-sm font-medium focus:border-primary focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Keterangan (Opsional)
                  </label>
                  <textarea
                    name="keterangan"
                    rows={2}
                    placeholder="Contoh: Panen lancar, umur 95 hari..."
                    className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:border-primary focus:outline-hidden"
                  />
                </div>

                <p className="text-[11px] text-muted italic">
                  * Catatan: Jika nilai luas tanam dan panen 0 semua, tidak perlu mengirimkan laporan.
                </p>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBukaFormBaru(false)}
                    className="w-1/3 rounded-xl border border-border py-3 text-xs font-bold text-muted transition hover:bg-background"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-2/3 rounded-xl bg-primary py-3 text-xs font-bold text-white shadow-md shadow-primary/20 transition hover:bg-primary-strong disabled:opacity-50"
                  >
                    {isPending ? "Menyimpan..." : `Kirim Laporan ${komoditasAktif}`}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Daftar Laporan Komoditas Terpilih Hari Ini */}
          <div className="rounded-3xl border border-border bg-surface p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
              Laporan {komoditasAktif} Hari Ini
            </h3>

            <div className="mt-3 space-y-2.5">
              {laporanKomoditas.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted">
                  Belum ada laporan {komoditasAktif} yang diinput hari ini.
                </div>
              ) : (
                laporanKomoditas.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col rounded-2xl border border-border bg-background/60 p-3.5 text-xs transition hover:bg-background"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-foreground text-sm">{item.nama_desa}</span>
                        <div className="mt-1 flex gap-3 text-muted">
                          <span>
                            Tanam:{" "}
                            <strong className="text-primary-strong">
                              {formatAngka(item.realisasi_tanam)} Ha
                            </strong>
                          </span>
                          <span>
                            Panen:{" "}
                            <strong className="text-amber-700">
                              {formatAngka(item.realisasi_panen)} Ha
                            </strong>
                          </span>
                        </div>
                        {item.keterangan && (
                          <p className="mt-1 text-[11px] text-muted italic">&ldquo;{item.keterangan}&rdquo;</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setModalEdit(item)}
                          title="Edit Laporan"
                          className="rounded-lg border border-border bg-surface p-1.5 text-muted transition hover:border-primary hover:text-primary"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleHapus(item.id)}
                          title="Hapus Laporan"
                          className="rounded-lg border border-border bg-surface p-1.5 text-muted transition hover:border-danger hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT LAPORAN */}
      {modalEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-surface p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-foreground">
                Edit Laporan {modalEdit.komoditas}
              </h3>
              <button
                type="button"
                onClick={() => setModalEdit(null)}
                className="rounded-full p-1 text-muted hover:bg-background"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEdit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Desa Binaan <span className="text-danger">*</span>
                </label>
                <select
                  name="desaId"
                  defaultValue={modalEdit.desa_id}
                  required
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm font-medium focus:border-primary focus:outline-hidden"
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
                    className="w-full rounded-xl border border-border bg-background p-3 text-sm font-medium focus:border-primary focus:outline-hidden"
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
                    className="w-full rounded-xl border border-border bg-background p-3 text-sm font-medium focus:border-primary focus:outline-hidden"
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
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:border-primary focus:outline-hidden"
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
                  {isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
