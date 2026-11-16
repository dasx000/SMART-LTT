// Pembaca tanggal dari e-Pusluh (bot VPS & impor Excel). Hasil: ISO ber-offset WIB (+07:00), atau null.
//
// Dibuat tahan perubahan format tampilan e-Pusluh (keputusan 16 Nov 2026). Dikenali:
//   Nama bulan (Indonesia/Inggris, singkat/panjang, huruf besar-kecil bebas, titik opsional):
//     "Nov 15, 2026 12:38:28" · "Okt 10, 2026" · "15 Nov 2026 12:38" · "15 November 2026, 12.38"
//     "Senin, 15 November 2026 12:38 WIB" · "15-Nov-2026 12:38" · "Nov 15, 2026 2:31 PM"
//   Angka:
//     "15-11-2026 14:31:47" · "15/11/2026 14:31" · "15.11.2026" · "15/11/26" · "2026-11-15 12:38:28" · "2026/11/15"
//   Lainnya: ISO lengkap ber-zona ("2026-11-15T05:38:28Z"), objek Date (sel tanggal Excel, jam dinding = WIB),
//     angka seri Excel (46341.5).
// Aturan angka dd/mm vs mm/dd: hari dulu (Indonesia), KECUALI bagian kedua > 12 (pasti format AS).
// Pengaman: tanggal mustahil (31-02), tahun di luar 2000–2100, atau lebih dari 2 hari ke depan → null.
// Pemanggil WAJIB menghitung & melaporkan nilai yang null (lihat contohTakTerbaca), bukan membuangnya diam-diam.

const BULAN: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, peb: 2, februari: 2, pebruari: 2, february: 2,
  mar: 3, mrt: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  agu: 8, ags: 8, agt: 8, agust: 8, aug: 8, agustus: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oct: 10, oktober: 10, october: 10,
  nov: 11, nop: 11, november: 11, nopember: 11,
  des: 12, dec: 12, desember: 12, december: 12,
};

const HARI = /^(senin|selasa|rabu|kamis|jum'?at|sabtu|minggu|ahad|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\.?,?\s+/i;

const dua = (n: number) => String(n).padStart(2, "0");
const BATAS_MASA_DEPAN_MS = 2 * 86_400_000;

function bulanDari(teks: string): number | undefined {
  const k = teks.toLowerCase().replace(/\./g, "");
  return BULAN[k] ?? (k.length >= 3 ? BULAN[k.slice(0, 3)] : undefined);
}

/** Susun ISO WIB + validasi tanggal nyata & tidak terlalu jauh di masa depan. */
function susun(y: number, m: number, d: number, j: number, mn: number, dt: number, sekarang: Date): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31 || j > 23 || mn > 59 || dt > 59) return null;
  const utc = Date.UTC(y, m - 1, d, j - 7, mn, dt);
  const cek = new Date(utc + 7 * 3600_000);
  if (cek.getUTCDate() !== d || cek.getUTCMonth() !== m - 1) return null; // mis. 31-02
  if (utc > sekarang.getTime() + BATAS_MASA_DEPAN_MS) return null;
  return `${y}-${dua(m)}-${dua(d)}T${dua(j)}:${dua(mn)}:${dua(dt)}+07:00`;
}

/** Jam dinding dari objek Date (komponen UTC = jam dinding, konvensi pembaca Excel) → WIB. */
function dariJamDinding(d: Date, sekarang: Date): string | null {
  if (Number.isNaN(d.getTime())) return null;
  return susun(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), sekarang);
}

export function parseTanggalEpusluh(nilai: unknown, sekarang: Date = new Date()): string | null {
  if (nilai === null || nilai === undefined) return null;
  if (nilai instanceof Date) return dariJamDinding(nilai, sekarang);
  // Angka seri Excel (hari sejak 30-12-1899), mis. 46341.6
  if (typeof nilai === "number") {
    if (!Number.isFinite(nilai) || nilai < 36_526 || nilai > 73_051) return null; // 2000–2100
    return dariJamDinding(new Date(Math.round((nilai - 25_569) * 86_400_000)), sekarang);
  }

  let s = String(nilai).replace(/\s+/g, " ").trim();
  if (!s || s === "-") return null;

  // ISO lengkap ber-zona → titik waktu pasti
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime()) || d.getTime() > sekarang.getTime() + BATAS_MASA_DEPAN_MS) return null;
    return d.toISOString();
  }

  s = s.replace(HARI, "").replace(/\s*(WIB|WITA|WIT)$/i, "").trim();

  // Jam di akhir: "12:38", "12:38:28", "12.38", "2:31 PM" (didahului spasi, koma, atau T)
  let j = 0, mn = 0, dt = 0;
  const mJam = s.match(/(?:^|[\sT,])(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(am|pm)?$/i);
  if (mJam) {
    j = Number(mJam[1]);
    mn = Number(mJam[2]);
    dt = Number(mJam[3] ?? 0);
    const ampm = mJam[4]?.toLowerCase();
    if (ampm) {
      if (j < 1 || j > 12) return null;
      if (ampm === "pm" && j < 12) j += 12;
      if (ampm === "am" && j === 12) j = 0;
    }
    s = s.slice(0, mJam.index).replace(/[\s,T]+$/, "");
  }
  const tgl = (y: number, m: number | undefined, d: number) => (m ? susun(y, m, d, j, mn, dt, sekarang) : null);

  let m: RegExpMatchArray | null;
  // "Nov 15, 2026" · "November 15 2026"
  if ((m = s.match(/^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i))) return tgl(Number(m[3]), bulanDari(m[1]), Number(m[2]));
  // "15 Nov 2026" · "15 November, 2026" · "15-Nov-2026"
  if ((m = s.match(/^(\d{1,2})[\s-]([a-z]+)\.?[\s,-]+(\d{4})$/i))) return tgl(Number(m[3]), bulanDari(m[2]), Number(m[1]));
  // "2026-11-15" · "2026/11/15" · "2026.11.15"
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return tgl(Number(m[1]), Number(m[2]), Number(m[3]));
  // "15-11-2026" · "15/11/2026" · "15.11.2026" · "15/11/26"
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})$/))) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const [hari, bulan] = b > 12 && a <= 12 ? [b, a] : [a, b];
    return tgl(y, bulan, hari);
  }
  return null;
}

/** Kumpulan contoh nilai yang gagal dibaca (maks. 5, unik) — untuk log & pratinjau. */
export function contohTakTerbaca(): { tambah: (v: unknown) => void; daftar: () => string[] } {
  const set = new Set<string>();
  return {
    tambah: (v) => {
      if (set.size < 5) set.add(String(v ?? "(kosong)").slice(0, 60));
    },
    daftar: () => [...set],
  };
}
