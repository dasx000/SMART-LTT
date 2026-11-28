/**
 * Pantau Tanaman — pengingat PPL yang sudah lapor TANAM tetapi lupa lapor PANEN.
 * Murni dihitung dari ltt.laporan_ltt (baca saja), khusus Padi & Jagung.
 *
 * Cara hitung, per desa × komoditas × jenis LTT × metode (aturan pengguna: panen hanya boleh
 * dipasangkan dengan tanam yang jenis LTT DAN metodenya sama — tanpa pinjam lintas jenis/metode):
 *  1. Laporan diurutkan per tanggal (WIB). Tiap laporan tanam = satu "petak" (digabung per tanggal).
 *  2. Laporan panen mengurangi petak PALING LAMA yang umurnya sudah ≥ MIN_HST_PANEN pada tanggal panen.
 *     Panen yang tak punya pasangan (tanam sebelum data ada, mis. data Padi mulai 31 Mar 2026) diabaikan.
 *  3. Sisa luas tiap petak = belum dilapor panen; statusnya dari umur hari ini menurut jenisnya.
 */

export type KomoditasPantau = "Padi" | "Jagung";

/** Jenis pertanaman — menentukan umur panen. */
export type JenisTanam = "Reguler" | "PM AAS" | "Gogo" | "Jagung";

/** Umur panen dari tanggal laporan tanam. Disepakati dengan pengguna 28 Nov 2026 (toleransi 10 hari setelah ideal). */
export const UMUR_PANEN: Record<JenisTanam, { mulai: number; akhirIdeal: number; lewat: number; satuan: "HST" | "HSS" }> = {
  Reguler: { mulai: 95, akhirIdeal: 105, lewat: 115, satuan: "HST" }, // padi tanam pindah, acuan Inpari 32
  "PM AAS": { mulai: 115, akhirIdeal: 125, lewat: 135, satuan: "HSS" }, // padi tabela: tanggal tanam = tanggal sebar
  Gogo: { mulai: 105, akhirIdeal: 120, lewat: 130, satuan: "HST" }, // padi gogo VUB (Inpago, Situ Bagendit)
  Jagung: { mulai: 100, akhirIdeal: 110, lewat: 120, satuan: "HST" }, // acuan BISI 18 / NK, pipilan kering
};

export const LABEL_JENIS: Record<JenisTanam, string> = {
  Reguler: "Padi",
  "PM AAS": "Padi PM AAS",
  Gogo: "Padi Gogo",
  Jagung: "Jagung",
};

/**
 * Jenis dari isian laporan. Metode baru terisi sejak akhir Juli 2026 (PM AAS juga baru mulai saat itu),
 * jadi metode kosong pada Padi = Reguler.
 */
export function jenisTanam(komoditas: string, metode: string | null, namaJenisLtt: string | null): JenisTanam | null {
  if (komoditas === "Jagung") return "Jagung";
  if (komoditas !== "Padi") return null;
  if (namaJenisLtt && /gogo/i.test(namaJenisLtt)) return "Gogo";
  if (metode && /pm\s*aas/i.test(metode)) return "PM AAS";
  return "Reguler";
}

/**
 * Kartu yang umurnya sudah lewat ini (hari sejak tanam, semua jenis) tidak ditampilkan lagi:
 * di lapangan pasti sudah lama panen, kartunya hanya jadi sisa data. Disepakati pengguna 28 Nov 2026.
 */
export const BATAS_TAMPIL_HARI = 150;

/** Panen hanya boleh dipasangkan dengan tanam yang umurnya sudah ≥ ini pada tanggal panen. */
export const MIN_HST_PANEN = 70;

export type StatusPantau = "lewat" | "masa" | "belum";

/** Metode laporan untuk pengelompokan. Metode kosong (sebelum akhir Jul 2026) = Regular. */
export function metodeKelompok(komoditas: string, metode: string | null): string {
  if (komoditas !== "Padi") return "-";
  return metode && /pm\s*aas/i.test(metode) ? "PM AAS" : "Regular";
}

export type BarisLaporan = {
  desa_id: number;
  komoditas: KomoditasPantau;
  jenis: JenisTanam;
  /** Nama jenis LTT (mis. "LTT Reguler", "LTT CSR 2025") — kunci pengelompokan. */
  jenisLtt: string;
  /** Hasil metodeKelompok() — kunci pengelompokan. */
  metode: string;
  tanggal: string; // YYYY-MM-DD (WIB)
  tanam: number;
  panen: number;
};

export type PanenTercatat = { tanggal: string; hst: number; luas: number };

export type Petak = {
  desaId: number;
  komoditas: KomoditasPantau;
  jenis: JenisTanam;
  jenisLtt: string;
  metode: string;
  tanggalTanam: string;
  luasTanam: number;
  panen: PanenTercatat[];
  sisa: number;
  hst: number;
  status: StatusPantau;
  mulaiPanen: string;
  akhirIdeal: string;
};

const HARI = 86_400_000;
const EPS = 0.001;

function keHari(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / HARI;
}

function tambahHari(iso: string, n: number): string {
  return new Date((keHari(iso) + n) * HARI).toISOString().slice(0, 10);
}

type PetakKerja = { jenis: JenisTanam; tanggal: string; luas: number; sisa: number; panen: PanenTercatat[] };

export function hitungPantau(baris: BarisLaporan[], hariIni: string): Petak[] {
  const grup = new Map<string, BarisLaporan[]>();
  for (const b of baris) {
    const k = `${b.desa_id}|${b.komoditas}|${b.jenisLtt}|${b.metode}`;
    const g = grup.get(k);
    if (g) g.push(b);
    else grup.set(k, [b]);
  }

  const hasil: Petak[] = [];
  const hIni = keHari(hariIni);

  for (const list of grup.values()) {
    list.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    const petak: PetakKerja[] = []; // urut tanggal (karena list urut tanggal)

    for (const b of list) {
      if (b.tanam > 0) {
        const sama = petak.find((t) => t.tanggal === b.tanggal && t.jenis === b.jenis);
        if (sama) {
          sama.luas += b.tanam;
          sama.sisa += b.tanam;
        } else {
          petak.push({ jenis: b.jenis, tanggal: b.tanggal, luas: b.tanam, sisa: b.tanam, panen: [] });
        }
      }
      if (b.panen <= 0) continue;

      const hPanen = keHari(b.tanggal);
      let p = b.panen;
      for (const t of petak) {
        if (p <= EPS) break;
        const hst = hPanen - keHari(t.tanggal);
        if (hst < MIN_HST_PANEN) break; // petak urut tanggal → sisanya lebih muda
        if (t.sisa <= EPS) continue;
        const ambil = Math.min(t.sisa, p);
        t.sisa -= ambil;
        p -= ambil;
        t.panen.push({ tanggal: b.tanggal, hst, luas: ambil });
      }
      // sisa p diabaikan: panen dari tanam sebelum data tercatat
    }

    for (const t of petak) {
      if (t.sisa <= EPS) continue;
      const umur = UMUR_PANEN[t.jenis];
      const hst = hIni - keHari(t.tanggal);
      if (hst > BATAS_TAMPIL_HARI) continue;
      const status: StatusPantau = hst > umur.lewat ? "lewat" : hst >= umur.mulai ? "masa" : "belum";
      hasil.push({
        desaId: list[0].desa_id,
        komoditas: list[0].komoditas,
        jenis: t.jenis,
        jenisLtt: list[0].jenisLtt,
        metode: list[0].metode,
        tanggalTanam: t.tanggal,
        luasTanam: t.luas,
        panen: t.panen,
        sisa: Math.round(t.sisa * 100) / 100,
        hst,
        status,
        mulaiPanen: tambahHari(t.tanggal, umur.mulai),
        akhirIdeal: tambahHari(t.tanggal, umur.akhirIdeal),
      });
    }
  }

  // Paling lama ditanam lebih dulu
  return hasil.sort((a, b) => a.tanggalTanam.localeCompare(b.tanggalTanam) || a.desaId - b.desaId);
}
