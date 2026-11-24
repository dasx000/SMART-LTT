/** Warna kolom persentase — ambang sama dengan tabel capaian lain (<60 merah, 60–84 kuning, ≥85 hijau). Aman dipakai di client. */
export const LEGENDA = [
  { kelas: "bg-red-500 text-white", label: "< 60%", arti: "Rendah" },
  { kelas: "bg-yellow-300 text-yellow-900", label: "60% – 84,99%", arti: "Sedang" },
  { kelas: "bg-green-600 text-white", label: "≥ 85%", arti: "Baik / tercapai" },
];
export const levelPersen = (p: number) => (p >= 85 ? LEGENDA[2] : p >= 60 ? LEGENDA[1] : LEGENDA[0]);

/** Warna selisih isian PPL vs target provinsi: merah = kurang, hijau = sama, biru = lebih. `teks` belum berformat angka. */
export const warnaSelisih = (n: number) =>
  Math.abs(n) < 0.005
    ? { kelas: "text-green-700", fc: "FF15803D", arah: "sama" as const }
    : n < 0
      ? { kelas: "text-red-600", fc: "FFDC2626", arah: "kurang" as const }
      : { kelas: "text-blue-600", fc: "FF2563EB", arah: "lebih" as const };
