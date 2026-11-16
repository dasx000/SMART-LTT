import Link from "next/link";
import { UserPlus, X } from "lucide-react";
import { TombolMuatUlang } from "@/components/tombol-muat-ulang";
import { TabelPengguna, type BarisPengguna } from "@/components/tabel-pengguna";
import { TautanUrlKini } from "@/components/tautan-url-kini";
import type { Anggota } from "@/lib/pengguna";
import { urlDengan } from "@/lib/param";
import { FormPengguna } from "./kelola-pengguna";

/**
 * Manajemen Akun Penyuluh (Kab & BPP) — tata letak aplikasi lama.
 * Cari / role / kecamatan / halaman disaring di browser (TabelPengguna, tanpa panggilan server).
 * Form ubah/tambah (?edit=<id> | baru) tetap lewat URL.
 */
export function DaftarPengguna({
  dasar, q, mode, pengguna, desa, kecamatan, kecamatanSaya, idSaya,
}: {
  dasar: string;
  q: Record<string, string | string[] | undefined>;
  mode: "bpp" | "kab";
  pengguna: Anggota[];
  desa: { id: number; nama: string; kecamatan_id: number }[];
  kecamatan: { id: number; nama: string }[];
  kecamatanSaya: number | null;
  idSaya: string;
}) {
  const ambil = (k: string) => {
    const v = q[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const edit = ambil("edit");
  const namaKec = new Map(kecamatan.map((k) => [k.id, k.nama]));
  const namaDesa = new Map(desa.map((d) => [d.id, d.nama]));
  // Hanya kolom yang ditampilkan yang dikirim ke browser (email dll. tidak ikut).
  const baris: BarisPengguna[] = pengguna.map((u) => ({
    id: u.id,
    nama: u.nama,
    nip: u.nip,
    whatsapp: u.whatsapp,
    role: u.role,
    aktif: u.aktif,
    kecamatanId: u.kecamatanId,
    wilayah: u.kecamatanId ? (namaKec.get(u.kecamatanId) ?? "-") : "Kabupaten",
    desaTeks: u.desaIds.map((d) => namaDesa.get(d) ?? d).join(", "),
  }));
  const kembali = urlDengan(dasar, q, { edit: null });
  const dipilih = edit && edit !== "baru" ? pengguna.find((u) => u.id === edit) : undefined;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{mode === "kab" ? "Manajemen Akun Penyuluh" : "Manajemen Akun PPL"}</h2>
          <p className="text-[11px] text-gray-500">{mode === "kab" ? "Kelola akses Admin Kabupaten, BPP, dan PPL." : "Penyuluh di kecamatan Anda."}</p>
        </div>
        <div className="flex gap-2">
          <TombolMuatUlang label="Refresh" className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-600" />
          <TautanUrlKini dasar={dasar} ubah={{ edit: "baru" }} className="flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white shadow">
            <UserPlus size={16} /> Tambah {mode === "kab" ? "User Baru" : "PPL"}
          </TautanUrlKini>
        </div>
      </div>

      <TabelPengguna
        dasar={dasar}
        mode={mode}
        baris={baris}
        kecamatan={kecamatan}
        awal={{
          q: ambil("q"),
          role: mode === "kab" ? ambil("role") : "",
          kecamatan: mode === "kab" ? Number(ambil("kecamatan")) || 0 : 0,
          hal: Math.max(1, Math.floor(Number(ambil("hal"))) || 1),
        }}
      />

      {(edit === "baru" || dipilih) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h3 className="font-bold text-gray-800">{dipilih ? `Ubah ${dipilih.nama}` : "Tambah Pengguna"}</h3>
              <Link href={kembali} scroll={false} aria-label="Tutup" className="rounded-full p-1 text-gray-500 hover:bg-gray-100">
                <X size={16} />
              </Link>
            </div>
            <FormPengguna
              key={dipilih?.id ?? "baru"}
              mode={mode}
              awal={dipilih ? { id: dipilih.id, nama: dipilih.nama, nip: dipilih.nip, role: dipilih.role, kecamatanId: dipilih.kecamatanId, aktif: dipilih.aktif, whatsapp: dipilih.whatsapp, wajibGanti: dipilih.wajibGanti, desaIds: dipilih.desaIds } : undefined}
              desa={desa}
              kecamatan={kecamatan}
              kecamatanSaya={kecamatanSaya}
              idSaya={idSaya}
              kembali={kembali}
            />
          </div>
        </div>
      )}
    </>
  );
}
