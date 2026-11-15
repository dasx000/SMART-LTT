import { NAMA_BULAN_PENDEK, formatAngka } from "@/lib/format";
import { KOLOM_SARANA, ambilProduktivitas, ambilSarana, rataPositif, type DesaRef, type Kec, type Komoditas, type Supa } from "@/lib/data";
import { Kartu, Kosong, Tabel, sel, selAngka } from "@/components/ui";

const f = (v: number) => (v ? formatAngka(v) : "–");

/**
 * Rekap produktivitas & sarana (logika-bisnis §20).
 * - `perDesa`: satu kecamatan → baris per desa + rata-rata kecamatan (rata-rata desa > 0).
 * - selain itu: baris per kecamatan (rata-rata desa > 0) + rata-rata kabupaten (rata-rata kecamatan > 0).
 */
export async function RekapProduktivitas({
  s, kecs, desa, tahun, kom, perDesa,
}: {
  s: Supa;
  kecs: Kec[];
  desa: DesaRef[];
  tahun: number;
  kom: Komoditas;
  perDesa: boolean;
}) {
  const ids = desa.map((d) => d.id);
  const [nilai, sarana] = await Promise.all([ambilProduktivitas(s, tahun, ids), ambilSarana(s, ids)]);
  const v = (desaId: number) => nilai.get(`${desaId}|${kom}`) ?? new Array(12).fill(0);
  const grup = kecs.map((k) => ({ ...k, desa: desa.filter((d) => d.kecamatan_id === k.id) })).filter((k) => k.desa.length);
  const rataKec = grup.map((k) => Array.from({ length: 12 }, (_, b) => rataPositif(k.desa.map((d) => v(d.id)[b]))));
  const terisi = (k: { desa: DesaRef[] }) => k.desa.filter((d) => v(d.id).some((x) => x > 0)).length;

  if (desa.length === 0) return <Kosong teks="Tidak ada desa." />;

  return (
    <div className="space-y-4">
      <Kartu judul={`Produktivitas ${kom} ${tahun} (ton/ha)`}>
        <Tabel
          kepala={[perDesa ? "Desa" : "Kecamatan", ...NAMA_BULAN_PENDEK, perDesa ? "" : "Desa terisi"].filter(Boolean)}
          kaki={
            perDesa ? (
              <tr>
                <td className={sel}>Rata-rata Kec.</td>
                {rataKec[0].map((x, i) => <td key={i} className={selAngka}>{f(x)}</td>)}
              </tr>
            ) : (
              <tr>
                <td className={sel}>Rata-rata Kabupaten</td>
                {Array.from({ length: 12 }, (_, b) => rataPositif(rataKec.map((r) => r[b]))).map((x, i) => (
                  <td key={i} className={selAngka}>{f(x)}</td>
                ))}
                <td className={selAngka}>
                  {grup.reduce((a, k) => a + terisi(k), 0)}/{desa.length}
                </td>
              </tr>
            )
          }
        >
          {perDesa
            ? grup[0].desa.map((d) => (
                <tr key={d.id}>
                  <td className={sel}>{d.nama}</td>
                  {v(d.id).map((x, i) => <td key={i} className={selAngka}>{f(x)}</td>)}
                </tr>
              ))
            : grup.map((k, gi) => (
                <tr key={k.id}>
                  <td className={sel}>{k.nama}</td>
                  {rataKec[gi].map((x, i) => <td key={i} className={selAngka}>{f(x)}</td>)}
                  <td className={selAngka}>{terisi(k)}/{k.desa.length}</td>
                </tr>
              ))}
        </Tabel>
        <p className="mt-2 text-[11px] text-muted">Rata-rata hanya dari nilai &gt; 0 (aturan lama).</p>
      </Kartu>

      <Kartu judul="Sarana Pascapanen">
        <Tabel kepala={[perDesa ? "Desa" : "Kecamatan", ...KOLOM_SARANA.map((c) => c.label), perDesa ? "Status" : "Desa terisi"]}>
          {perDesa
            ? grup[0].desa.map((d) => {
                const x = sarana.get(d.id);
                return (
                  <tr key={d.id}>
                    <td className={sel}>{d.nama}</td>
                    {KOLOM_SARANA.map((c) => <td key={c.kunci} className={selAngka}>{x ? x[c.kunci] : "–"}</td>)}
                    <td className={`${sel} ${x ? "text-primary" : "text-muted"}`}>{x ? "Terisi" : "Belum diisi"}</td>
                  </tr>
                );
              })
            : grup.map((k) => {
                const isi = k.desa.map((d) => sarana.get(d.id)).filter((x) => x !== undefined);
                return (
                  <tr key={k.id}>
                    <td className={sel}>{k.nama}</td>
                    {KOLOM_SARANA.map((c) => (
                      <td key={c.kunci} className={selAngka}>{isi.reduce((a, x) => a + (Number(x![c.kunci]) || 0), 0)}</td>
                    ))}
                    <td className={selAngka}>{isi.length}/{k.desa.length}</td>
                  </tr>
                );
              })}
        </Tabel>
      </Kartu>
    </div>
  );
}
