// Pembaca tanggal dari e-Pusluh / bot VPS. Hasil: ISO dengan offset WIB (+07:00), atau null.
// Format yang dikenal (sama dengan parseTanggalEPusluh_ lama, + "Agt"):
//   "Okt 10, 2026 10:12:28" · "Agustus 1, 2026" · "10/11/2026 08:00" · "2026-11-10T08:00:00+07:00"

const BULAN: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  agu: 8, ags: 8, agt: 8, aug: 8, agustus: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oct: 10, oktober: 10, october: 10,
  nov: 11, november: 11,
  des: 12, dec: 12, desember: 12, december: 12,
};

const dua = (n: number) => String(n).padStart(2, "0");

function susun(y: number, m: number, d: number, jam: string): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${dua(m)}-${dua(d)}T${jam}+07:00`;
}

export function parseTanggalEpusluh(nilai: unknown): string | null {
  if (nilai === null || nilai === undefined) return null;
  const s = String(nilai).trim();
  if (!s) return null;

  // Sudah ISO lengkap dengan zona waktu → biarkan Date yang membaca.
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const mJam = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/);
  const jam = mJam ? `${dua(Number(mJam[1]))}:${mJam[2]}:${mJam[3] ?? "00"}` : "00:00:00";

  const mTeks = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s*(\d{4})/);
  if (mTeks) {
    const bln = BULAN[mTeks[1].toLowerCase()];
    return bln ? susun(Number(mTeks[3]), bln, Number(mTeks[2]), jam) : null;
  }

  const mAngka = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (mAngka) {
    const a = Number(mAngka[1]);
    const b = Number(mAngka[2]);
    // b > 12 → format AS (bulan/hari); selain itu hari/bulan (Indonesia)
    const [hari, bulan] = b > 12 ? [b, a] : [a, b];
    return susun(Number(mAngka[3]), bulan, hari, jam);
  }

  const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (mIso) return susun(Number(mIso[1]), Number(mIso[2]), Number(mIso[3]), jam);

  return null;
}
