/** Tipe bersama daftar Target Desa (menu Admin Kab & BPP) — aman dipakai server & client. */

export type RincianJenis = { jenisId: number; tanam: number; panen: number };

export type BarisTargetDesa = {
  id: number;
  nama: string;
  kecamatanId: number;
  kecamatan: string;
  /** Nama PPL aktif yang membina desa ini */
  ppl: string[];
  target: { tanam: number; panen: number; luasBaku: number; rincian: RincianJenis[] } | null;
  /** Pengisi terakhir (pembuat_id); null bila belum diisi */
  pembuat: { id: string | null; nama: string; peran: string } | null;
};
