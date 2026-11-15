import Link from "next/link";
import { Pencil, RotateCw, Search, UserPlus, X } from "lucide-react";
import type { Role } from "@/lib/auth";
import type { Anggota } from "@/lib/pengguna";
import { urlDengan } from "@/lib/param";
import { FormPengguna } from "./kelola-pengguna";

const LABEL_ROLE: Record<Role, string> = { penyuluh: "Penyuluh", admin_bpp: "Admin BPP", admin_kab: "Admin Kab", viewer: "Viewer" };
const WARNA_ROLE: Record<Role, string> = {
  penyuluh: "bg-green-100 text-green-700",
  admin_bpp: "bg-blue-100 text-blue-700",
  admin_kab: "bg-purple-100 text-purple-700",
  viewer: "bg-gray-100 text-gray-600",
};
const kelasIn = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-500";
const lbl = "mb-1 block text-[10px] font-bold tracking-wide text-gray-400 uppercase";

/**
 * Manajemen Akun Penyuluh (Kab & BPP) — tata letak aplikasi lama.
 * Cari / role / kecamatan / form (?edit=<id> | baru) lewat URL, disaring di server.
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
  const cari = ambil("q").toLowerCase();
  const role = ambil("role");
  const kec = Number(ambil("kecamatan")) || 0;
  const edit = ambil("edit");
  const namaKec = new Map(kecamatan.map((k) => [k.id, k.nama]));
  const namaDesa = new Map(desa.map((d) => [d.id, d.nama]));
  const tampil = pengguna.filter(
    (u) => (!role || u.role === role) && (!kec || u.kecamatanId === kec) && (!cari || u.nama.toLowerCase().includes(cari) || u.nip.includes(cari)),
  );
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
          <Link href={kembali} className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-600">
            <RotateCw size={14} /> Refresh
          </Link>
          <Link href={urlDengan(dasar, q, { edit: "baru" })} scroll={false} className="flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white shadow">
            <UserPlus size={16} /> Tambah {mode === "kab" ? "User Baru" : "PPL"}
          </Link>
        </div>
      </div>

      <form method="get" className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-[1fr_12rem_12rem_auto]">
        <label>
          <span className={lbl}>Cari Nama / NIP</span>
          <span className="relative block">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-gray-400" />
            <input name="q" defaultValue={ambil("q")} placeholder="Ketik nama atau NIP..." className={`${kelasIn} pl-9`} />
          </span>
        </label>
        {mode === "kab" && (
          <>
            <label>
              <span className={lbl}>Role</span>
              <select name="role" defaultValue={role} className={kelasIn}>
                <option value="">Semua Role</option>
                {Object.entries(LABEL_ROLE).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              <span className={lbl}>Kecamatan</span>
              <select name="kecamatan" defaultValue={kec || ""} className={kelasIn}>
                <option value="">Semua Kecamatan</option>
                {kecamatan.map((k) => (
                  <option key={k.id} value={k.id}>{k.nama}</option>
                ))}
              </select>
            </label>
          </>
        )}
        <button type="submit" className="self-end rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white">Cari</button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                <th className="p-3 text-left">No</th>
                <th className="p-3 text-left">Nama &amp; NIP</th>
                <th className="p-3 text-left">WhatsApp</th>
                <th className="p-3 text-left">Role</th>
                <th className="p-3 text-center">Wilayah Kerja</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tampil.map((u, i) => (
                <tr key={u.id} className={u.aktif ? "hover:bg-gray-50" : "bg-gray-50/60 text-gray-400"}>
                  <td className="p-3 text-gray-400">{i + 1}</td>
                  <td className="p-3">
                    <p className="text-sm font-bold text-gray-800">{u.nama}</p>
                    <p className="text-[10px] text-gray-400">{u.nip}</p>
                  </td>
                  <td className="p-3 text-gray-500">{u.whatsapp || "-"}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${WARNA_ROLE[u.role]}`}>{LABEL_ROLE[u.role]}</span>
                  </td>
                  <td className="p-3 text-center">
                    <p className="text-gray-700">{u.kecamatanId ? namaKec.get(u.kecamatanId) : "Kabupaten"}</p>
                    {u.desaIds.length > 0 && <p className="text-[10px] text-gray-400">{u.desaIds.map((d) => namaDesa.get(d) ?? d).join(", ")}</p>}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${u.aktif ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {u.aktif ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <Link href={urlDengan(dasar, q, { edit: u.id })} scroll={false} title="Ubah" className="inline-flex rounded-lg bg-blue-50 p-1.5 text-blue-600 hover:bg-blue-100">
                      <Pencil size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-gray-100 p-3 text-xs text-gray-500">
          {tampil.length} pengguna · {tampil.filter((u) => u.aktif).length} aktif
        </p>
      </div>

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
