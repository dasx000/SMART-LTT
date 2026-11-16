"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gagal, konfirmasi, sukses } from "@/lib/swal";
import { resetPasswordAction, tambahPenggunaAction, ubahPenggunaAction } from "@/app/kab/pengguna/actions";
import type { Role } from "@/lib/auth";

export type BarisPengguna = {
  id: string;
  nama: string;
  nip: string;
  role: Role;
  kecamatanId: number | null;
  aktif: boolean;
  whatsapp: string | null;
  wajibGanti: boolean;
  desaIds: number[];
};
type Desa = { id: number; nama: string; kecamatan_id: number };
type Kec = { id: number; nama: string };

const LABEL_ROLE: Record<Role, string> = { penyuluh: "Penyuluh", admin_bpp: "Koordinator BPP", admin_kab: "Admin Kabupaten", viewer: "Viewer" };
const kelasIn = "w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-green-500";
const kelasLbl = "flex flex-col gap-1 text-[11px] font-semibold text-gray-500";

/**
 * Form tambah/ubah pengguna. Dibuka lewat URL (?edit=<id> atau ?edit=baru); selesai → kembali ke daftar.
 * mode "bpp": role/kecamatan terkunci; nama terkunci saat ubah (server juga memeriksa).
 */
export function FormPengguna({
  mode, awal, desa, kecamatan, kecamatanSaya, idSaya, kembali,
}: {
  mode: "bpp" | "kab";
  awal?: BarisPengguna;
  desa: Desa[];
  kecamatan: Kec[];
  kecamatanSaya: number | null;
  idSaya: string;
  kembali: string;
}) {
  const baru = !awal;
  const [nip, setNip] = useState(awal?.nip ?? "");
  const [nama, setNama] = useState(awal?.nama ?? "");
  const [wa, setWa] = useState(awal?.whatsapp ?? "");
  const [role, setRole] = useState<Role>(awal?.role ?? "penyuluh");
  const [kec, setKec] = useState<number | null>(awal?.kecamatanId ?? kecamatanSaya);
  const [aktif, setAktif] = useState(awal?.aktif ?? true);
  const [pilih, setPilih] = useState<number[]>(awal?.desaIds ?? []);
  const [pw, setPw] = useState("");
  const [proses, mulai] = useTransition();
  const router = useRouter();

  const kecEfektif = mode === "bpp" ? kecamatanSaya : kec;
  const desaKec = desa.filter((d) => d.kecamatan_id === kecEfektif);
  const pakaiDesa = role === "penyuluh" || role === "admin_bpp";

  function simpan(e: React.FormEvent) {
    e.preventDefault();
    mulai(async () => {
      const desaIds = pakaiDesa ? pilih.filter((i) => desaKec.some((d) => d.id === i)) : [];
      const h = baru
        ? await tambahPenggunaAction({ nip, nama, whatsapp: wa, password: pw, role, kecamatanId: kecEfektif, desaIds })
        : await ubahPenggunaAction({
            id: awal.id, nama, whatsapp: wa, aktif, desaIds,
            ...(mode === "kab" ? { role, kecamatanId: kec } : {}),
          });
      if (h.sukses) {
        await sukses("Tersimpan", h.pesan);
        router.replace(kembali, { scroll: false });
      } else gagal("Gagal", h.pesan);
    });
  }

  function reset() {
    if (!awal) return;
    mulai(async () => {
      if (pw.length < 6) {
        gagal("Password terlalu pendek", "Isi password baru minimal 6 karakter di kolom Password baru.");
        return;
      }
      if (!(await konfirmasi("Reset password?", `Password ${awal.nama} diganti. Berlaku juga di aplikasi lain (akun bersama).`, "Ya, reset"))) return;
      const h = await resetPasswordAction({ id: awal.id, password: pw });
      if (h.sukses) {
        setPw("");
        sukses("Berhasil", h.pesan);
      } else gagal("Gagal", h.pesan);
    });
  }

  return (
    <form onSubmit={simpan} className="mt-3 space-y-3 rounded-2xl border border-primary/30 bg-background p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className={kelasLbl}>
          NIP
          <input value={nip} onChange={(e) => setNip(e.target.value)} disabled={!baru} required className={kelasIn} inputMode="numeric" />
        </label>
        <label className={kelasLbl}>
          Nama
          <input value={nama} onChange={(e) => setNama(e.target.value)} disabled={!baru && mode === "bpp"} required className={`${kelasIn} disabled:opacity-60`} />
        </label>
        <label className={kelasLbl}>
          WhatsApp
          <input value={wa} onChange={(e) => setWa(e.target.value)} className={kelasIn} inputMode="tel" placeholder="08..." />
        </label>
        {mode === "kab" && (
          <>
            <label className={kelasLbl}>
              Role
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={awal?.id === idSaya} className={kelasIn}>
                {Object.entries(LABEL_ROLE).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className={kelasLbl}>
              Kecamatan
              <select value={kec ?? ""} onChange={(e) => setKec(e.target.value ? Number(e.target.value) : null)} className={kelasIn}>
                <option value="">— tidak ada —</option>
                {kecamatan.map((k) => (
                  <option key={k.id} value={k.id}>{k.nama}</option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className={kelasLbl}>
          {baru ? "Password awal (min. 6)" : "Password baru (untuk reset)"}
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="text" autoComplete="new-password" required={baru} minLength={baru ? 6 : undefined} className={kelasIn} />
        </label>
        {!baru && (
          <label className="flex items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} disabled={awal?.id === idSaya} className="h-4 w-4 accent-primary" />
            Akun aktif
          </label>
        )}
      </div>

      {pakaiDesa && (
        <fieldset>
          <legend className="mb-1 text-[11px] font-semibold text-gray-500">Desa binaan {kecEfektif ? "" : "(pilih kecamatan dulu)"}</legend>
          <div className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
            {desaKec.map((d) => (
              <label key={d.id} className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={pilih.includes(d.id)}
                  onChange={(e) => setPilih((v) => (e.target.checked ? [...v, d.id] : v.filter((x) => x !== d.id)))}
                  className="h-4 w-4 accent-primary"
                />
                {d.nama}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {!baru && (
          <button type="button" onClick={reset} disabled={proses} className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-bold disabled:opacity-60">
            Reset Password
          </button>
        )}
        <button type="submit" disabled={proses} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
          {proses ? "Memproses..." : baru ? "Tambah" : "Simpan"}
        </button>
      </div>
    </form>
  );
}
