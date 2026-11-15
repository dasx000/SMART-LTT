import { formatAngka } from "@/lib/format";

/**
 * Grafik SVG yang dirender di SERVER (pengganti ApexCharts aplikasi lama):
 * tidak ada pustaka grafik / JS yang diunduh HP. Bentuk & warna meniru konfigurasi lama.
 */

/** Warna capaian (keputusan §25 no. 14): < 60 merah, 60–84 kuning, ≥ 85 hijau. */
export const warnaCapaian = (p: number) => (p >= 85 ? "#16a34a" : p >= 60 ? "#eab308" : "#ef4444");

/** Gauge radial (radialBar ApexCharts: hollow 65%, track #f3f4f6, ujung bulat). */
export function Gauge({ persen, label = "CAPAIAN", ukuran = 200 }: { persen: number; label?: string; ukuran?: number }) {
  const r = 80;
  const keliling = 2 * Math.PI * r;
  const isi = Math.max(0, Math.min(100, persen));
  return (
    <svg viewBox="0 0 200 200" width={ukuran} height={ukuran} role="img" aria-label={`${label} ${persen.toFixed(1)}%`}>
      <circle cx="100" cy="100" r={r} fill="none" stroke="#f3f4f6" strokeWidth="22" />
      {isi > 0 && (
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke={warnaCapaian(persen)}
          strokeWidth="22"
          strokeLinecap="round"
          strokeDasharray={`${(isi / 100) * keliling} ${keliling}`}
          transform="rotate(-90 100 100)"
        />
      )}
      <text x="100" y="90" textAnchor="middle" fill="#9ca3af" fontSize="11" fontWeight="700">
        {label}
      </text>
      <text x="100" y="120" textAnchor="middle" fill="#1f2937" fontSize="26" fontWeight="700">
        {persen.toFixed(1)}%
      </text>
    </svg>
  );
}

/** Donut komposisi (warna lama: padi biru, jagung kuning, ubi oranye). */
export function Donut({ data, ukuran = 220 }: { data: { label: string; nilai: number; warna: string }[]; ukuran?: number }) {
  const total = data.reduce((a, d) => a + d.nilai, 0);
  const r = 70;
  const keliling = 2 * Math.PI * r;
  let mulai = 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg viewBox="0 0 200 200" width={ukuran} height={ukuran} role="img" aria-label="Komposisi komoditas">
        {total === 0 ? (
          <circle cx="100" cy="100" r={r} fill="none" stroke="#f3f4f6" strokeWidth="36" />
        ) : (
          data.map((d) => {
            const porsi = d.nilai / total;
            const sudutTengah = (mulai + porsi / 2) * 2 * Math.PI - Math.PI / 2;
            const el = (
              <g key={d.label}>
                <circle
                  cx="100"
                  cy="100"
                  r={r}
                  fill="none"
                  stroke={d.warna}
                  strokeWidth="36"
                  strokeDasharray={`${porsi * keliling} ${keliling}`}
                  strokeDashoffset={-mulai * keliling}
                  transform="rotate(-90 100 100)"
                />
                {porsi >= 0.05 && (
                  <text
                    x={100 + r * Math.cos(sudutTengah)}
                    y={100 + r * Math.sin(sudutTengah) + 4}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="10"
                    fontWeight="700"
                  >
                    {(porsi * 100).toFixed(1)}%
                  </text>
                )}
              </g>
            );
            mulai += porsi;
            return el;
          })
        )}
      </svg>
      <ul className="space-y-1.5 text-xs text-gray-600">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: d.warna }} />
            {d.label} <span className="text-gray-400">({formatAngka(d.nilai)} Ha)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
