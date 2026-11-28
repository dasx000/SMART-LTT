"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Search } from "lucide-react";
import {
  bahanAktifAction,
  bahanAktifGrupAction,
  cariGrupOptAction,
  cariKomoditasAction,
  daftarOptAction,
  produkTopAction,
  produkTopGrupAction,
} from "@/app/ppl/opt/actions";
import {
  KOMODITAS_DEFAULT,
  LABEL_KATEGORI,
  type BahanAktif,
  type GrupOpt,
  type Hasil,
  type KategoriOpt,
  type KomoditasOpsi,
  type OptOpsi,
  type ProdukTop,
} from "@/app/ppl/opt/jenis";

/**
 * Alur "Cari OPT" (porting dari TANIKU, opt-search-flow.tsx). Dua jalur menuju hasil:
 *   via komoditas: komoditas → OPT → hasil (bahan aktif + produk)
 *   via nama OPT : ketik nama OPT → hasilGrup (gabungan semua komoditas)
 * Data diambil lewat Server Actions (app/ppl/opt/actions.ts), bukan query langsung dari browser.
 */
type Langkah = "awal" | "opt" | "hasil" | "hasilGrup";

const GAGAL = "Gagal memuat data. Coba lagi.";

function urutNama(list: KomoditasOpsi[]): KomoditasOpsi[] {
  return [...list].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

function useTunda<T>(nilai: T, ms: number): T {
  const [t, setT] = useState(nilai);
  useEffect(() => {
    const id = setTimeout(() => setT(nilai), ms);
    return () => clearTimeout(id);
  }, [nilai, ms]);
  return t;
}

export function AlurCariOpt({ kategori }: { kategori: KategoriOpt }) {
  const label = LABEL_KATEGORI[kategori];
  const labelKecil = label.toLowerCase();

  const [langkah, setLangkah] = useState<Langkah>("awal");

  // Langkah awal: satu kotak pencarian untuk komoditas DAN nama OPT.
  const [qAwal, setQAwal] = useState("");
  const [hasilKomoditas, setHasilKomoditas] = useState<KomoditasOpsi[]>([]);
  const [hasilGrup, setHasilGrup] = useState<GrupOpt[]>([]);
  const [memuatAwal, setMemuatAwal] = useState(false);
  const [galatAwal, setGalatAwal] = useState<string | null>(null);
  const [komoditas, setKomoditas] = useState<KomoditasOpsi | null>(null);

  // Jalur via komoditas.
  const [qOpt, setQOpt] = useState("");
  const [daftarOpt, setDaftarOpt] = useState<OptOpsi[]>([]);
  const [memuatOpt, setMemuatOpt] = useState(false);
  const [galatOpt, setGalatOpt] = useState<string | null>(null);
  const [opt, setOpt] = useState<OptOpsi | null>(null);

  // Jalur via nama OPT.
  const [grup, setGrup] = useState<GrupOpt | null>(null);

  const [bahan, setBahan] = useState<BahanAktif[]>([]);
  const [memuatBahan, setMemuatBahan] = useState(false);
  const [galatBahan, setGalatBahan] = useState<string | null>(null);

  const [produkBuka, setProdukBuka] = useState(false);
  const [produk, setProduk] = useState<ProdukTop[] | null>(null);
  const [memuatProduk, setMemuatProduk] = useState(false);
  const [galatProduk, setGalatProduk] = useState<string | null>(null);

  const qAwalTunda = useTunda(qAwal, 300);
  const qOptTunda = useTunda(qOpt, 300);

  useEffect(() => {
    if (langkah !== "awal") return;
    let aktif = true;
    const q = qAwalTunda.trim();

    async function jalan() {
      if (q === "") {
        setHasilKomoditas(urutNama(KOMODITAS_DEFAULT[kategori]));
        setHasilGrup([]);
        setGalatAwal(null);
        setMemuatAwal(false);
        return;
      }
      setMemuatAwal(true);
      setGalatAwal(null);
      // Komoditas & OPT dicari paralel; galat hanya tampil kalau dua-duanya gagal.
      const [k, g] = await Promise.all([cariKomoditasAction(kategori, q).catch(gagal), cariGrupOptAction(kategori, q).catch(gagal)]);
      if (!aktif) return;
      setHasilKomoditas(k.ok ? k.data : []);
      setHasilGrup(g.ok ? g.data : []);
      if (!k.ok && !g.ok) setGalatAwal(GAGAL);
      setMemuatAwal(false);
    }

    jalan();
    return () => {
      aktif = false;
    };
  }, [langkah, kategori, qAwalTunda]);

  useEffect(() => {
    if (langkah !== "opt" || !komoditas) return;
    let aktif = true;
    const id = komoditas.id;

    async function jalan() {
      setMemuatOpt(true);
      setGalatOpt(null);
      const r = await daftarOptAction(kategori, id, qOptTunda).catch(gagal);
      if (!aktif) return;
      setDaftarOpt(r.ok ? r.data : []);
      setGalatOpt(r.ok ? null : GAGAL);
      setMemuatOpt(false);
    }

    jalan();
    return () => {
      aktif = false;
    };
  }, [langkah, kategori, komoditas, qOptTunda]);

  useEffect(() => {
    let muat: (() => Promise<Hasil<BahanAktif[]>>) | null = null;
    if (langkah === "hasilGrup" && grup) {
      const key = grup.nama_key;
      muat = () => bahanAktifGrupAction(kategori, key);
    } else if (langkah === "hasil" && komoditas && opt) {
      const kId = komoditas.id;
      const oId = opt.id;
      muat = () => bahanAktifAction(kategori, kId, oId);
    }
    if (!muat) return;
    let aktif = true;
    const ambil = muat;

    async function jalan() {
      setMemuatBahan(true);
      setGalatBahan(null);
      const r = await ambil().catch(gagal);
      if (!aktif) return;
      setBahan(r.ok ? r.data : []);
      setGalatBahan(r.ok ? null : GAGAL);
      setMemuatBahan(false);
    }

    jalan();
    return () => {
      aktif = false;
    };
  }, [langkah, kategori, komoditas, opt, grup]);

  function resetHasil() {
    setProdukBuka(false);
    setProduk(null);
    setGalatProduk(null);
    setBahan([]); // jangan sempat tampilkan bahan aktif hasil sebelumnya
  }

  function pilihKomoditas(k: KomoditasOpsi) {
    setKomoditas(k);
    setQOpt("");
    setOpt(null);
    setLangkah("opt");
  }

  function pilihOpt(o: OptOpsi) {
    setOpt(o);
    resetHasil();
    setLangkah("hasil");
  }

  function pilihGrup(g: GrupOpt) {
    setGrup(g);
    setKomoditas(null);
    setOpt(null);
    resetHasil();
    setLangkah("hasilGrup");
  }

  function keAwal() {
    setLangkah("awal");
    setKomoditas(null);
    setOpt(null);
    setGrup(null);
  }

  function kembali() {
    if (langkah === "hasil") {
      setLangkah("opt");
      setOpt(null);
    } else {
      keAwal(); // dari "opt" / "hasilGrup": kembali ke pencarian (teks tetap)
    }
  }

  async function bukaTutupProduk() {
    const buka = !produkBuka;
    setProdukBuka(buka);
    if (!buka || produk !== null) return;

    let muat: (() => Promise<Hasil<ProdukTop[]>>) | null = null;
    if (langkah === "hasilGrup" && grup) {
      const key = grup.nama_key;
      muat = () => produkTopGrupAction(kategori, key);
    } else if (langkah === "hasil" && komoditas && opt) {
      const kId = komoditas.id;
      const oId = opt.id;
      muat = () => produkTopAction(kategori, kId, oId);
    }
    if (!muat) return;

    setMemuatProduk(true);
    setGalatProduk(null);
    const r = await muat().catch(gagal);
    if (r.ok) setProduk(r.data);
    else setGalatProduk(GAGAL);
    setMemuatProduk(false);
  }

  const adaQuery = qAwalTunda.trim() !== "";

  return (
    <div className="flex flex-col gap-4">
      {/* Jejak pilihan + tombol kembali antar-langkah */}
      {langkah !== "awal" && (
        <div className="flex items-center gap-3 rounded-2xl bg-green-50 px-3 py-2.5 ring-1 ring-green-100">
          <button
            type="button"
            onClick={kembali}
            aria-label="Kembali ke langkah sebelumnya"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-green-700 shadow-sm transition hover:bg-green-100 active:scale-95"
          >
            <ArrowLeft size={16} />
          </button>
          {langkah === "hasilGrup" && grup ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-green-900">{grup.nama_umum ?? grup.nama_key}</p>
              {grup.nama_latin && <p className="truncate text-xs text-green-800/70 italic">{grup.nama_latin}</p>}
            </div>
          ) : komoditas ? (
            <div className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-green-900">
              <span className="truncate">{komoditas.nama}</span>
              {opt && (
                <>
                  <ChevronRight size={14} className="shrink-0 text-green-700/50" />
                  <span className="truncate">{opt.nama_umum}</span>
                </>
              )}
            </div>
          ) : null}
        </div>
      )}

      {langkah === "awal" && (
        <div className="flex flex-col gap-3">
          <KotakCari placeholder={`Cari komoditas atau ${labelKecil}...`} nilai={qAwal} onUbah={setQAwal} />

          {memuatAwal ? (
            <BarisKedip jumlah={5} />
          ) : galatAwal ? (
            <PesanGalat>{galatAwal}</PesanGalat>
          ) : !adaQuery ? (
            <Bagian label="Komoditas utama">
              {hasilKomoditas.map((k) => (
                <Baris key={k.id} onClick={() => pilihKomoditas(k)} utama={k.nama} />
              ))}
            </Bagian>
          ) : hasilKomoditas.length === 0 && hasilGrup.length === 0 ? (
            <PesanKosong>Komoditas atau {labelKecil} tidak ditemukan.</PesanKosong>
          ) : (
            <>
              {hasilKomoditas.length > 0 && (
                <Bagian label="Komoditas">
                  {hasilKomoditas.map((k) => (
                    <Baris key={k.id} onClick={() => pilihKomoditas(k)} utama={k.nama} />
                  ))}
                </Bagian>
              )}
              {hasilGrup.length > 0 && (
                <Bagian label={label}>
                  {hasilGrup.map((g) => (
                    <Baris
                      key={g.nama_key}
                      onClick={() => pilihGrup(g)}
                      utama={g.nama_umum ?? g.nama_key}
                      kedua={g.nama_latin ?? undefined}
                      meta={`${g.jumlah_komoditas} komoditas`}
                    />
                  ))}
                </Bagian>
              )}
            </>
          )}
        </div>
      )}

      {langkah === "opt" && (
        <div className="flex flex-col gap-3">
          <KotakCari placeholder={`Cari nama ${labelKecil}...`} nilai={qOpt} onUbah={setQOpt} />
          {memuatOpt ? (
            <BarisKedip jumlah={5} />
          ) : galatOpt ? (
            <PesanGalat>{galatOpt}</PesanGalat>
          ) : daftarOpt.length === 0 ? (
            <PesanKosong>Tidak ada data terdaftar untuk komoditas ini.</PesanKosong>
          ) : (
            <div className="flex flex-col gap-2">
              {daftarOpt.map((o) => (
                <Baris key={o.id} onClick={() => pilihOpt(o)} utama={o.nama_umum ?? "-"} kedua={o.nama_latin ?? undefined} />
              ))}
            </div>
          )}
        </div>
      )}

      {(langkah === "hasil" || langkah === "hasilGrup") && (
        <div className="flex flex-col gap-4">
          <KartuBahanAktif
            judul={langkah === "hasilGrup" ? "Top 10 Bahan Aktif" : "Bahan Aktif Terdaftar"}
            sub={langkah === "hasilGrup" ? "Dari semua komoditas, urut dari jumlah produk terbanyak" : "Urut dari yang paling banyak dipakai"}
            memuat={memuatBahan}
            galat={galatBahan}
            isi={bahan}
            kosong={langkah === "hasilGrup" ? `Belum ada bahan aktif terdaftar untuk ${labelKecil} ini.` : "Belum ada bahan aktif terdaftar untuk kombinasi ini."}
          />
          <KartuProduk buka={produkBuka} onBukaTutup={bukaTutupProduk} memuat={memuatProduk} galat={galatProduk} isi={produk} />
          <button
            type="button"
            onClick={() => {
              keAwal();
              if (langkah === "hasil") setQAwal("");
            }}
            className="self-center text-sm font-bold text-green-700 hover:underline"
          >
            {langkah === "hasilGrup" ? `Cari ${labelKecil} lain` : "Ganti komoditas"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Server Action yang gagal di jaringan (bukan galat Supabase) → bentuk Hasil yang sama. */
function gagal(): { ok: false; pesan: string } {
  return { ok: false, pesan: GAGAL };
}

function KartuProduk({
  buka,
  onBukaTutup,
  memuat,
  galat,
  isi,
}: {
  buka: boolean;
  onBukaTutup: () => void;
  memuat: boolean;
  galat: string | null;
  isi: ProdukTop[] | null;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <button type="button" onClick={onBukaTutup} aria-expanded={buka} className="flex w-full items-center justify-between px-4 py-3.5 text-left">
        <span className="text-sm font-bold text-gray-800">Lihat contoh produk</span>
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${buka ? "rotate-180" : ""}`} />
      </button>

      {buka && (
        <div className="flex flex-col gap-3 border-t border-gray-100 px-4 pt-3 pb-4">
          <p className="text-[11px] text-gray-500 italic">
            *Urutan berdasarkan izin masih berlaku & terbitan terbaru — bukan data penjualan atau efektivitas.
          </p>
          {memuat ? (
            <BarisKedip jumlah={3} />
          ) : galat ? (
            <PesanGalat>{galat}</PesanGalat>
          ) : isi && isi.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada produk terdaftar.</p>
          ) : (
            isi?.map((p) => (
              <article key={p.produk_id} className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-gray-800">{p.nama}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      p.berlaku ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                    }`}
                  >
                    {p.berlaku ? "Izin berlaku" : "Izin habis"}
                  </span>
                </div>
                {p.perusahaan && <p className="mt-0.5 text-xs text-gray-500">{p.perusahaan}</p>}
                <p className="mt-1.5 text-xs text-gray-600">
                  <span className="font-semibold">Jenis:</span> {p.jenis_pestisida}
                </p>
                {p.bahan_aktif && (
                  <p className="text-xs text-gray-600">
                    <span className="font-semibold">Bahan aktif:</span> {p.bahan_aktif}
                  </p>
                )}
                {p.dosis && (
                  <p className="text-xs text-gray-600">
                    <span className="font-semibold">Dosis:</span> {p.dosis}
                  </p>
                )}
              </article>
            ))
          )}
        </div>
      )}
    </section>
  );
}

function KartuBahanAktif({
  judul,
  sub,
  memuat,
  galat,
  isi,
  kosong,
}: {
  judul: string;
  sub: string;
  memuat: boolean;
  galat: string | null;
  isi: BahanAktif[];
  kosong: string;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-800">{judul}</h3>
      <p className="mt-0.5 mb-3 text-xs text-gray-500">{sub}</p>
      {memuat ? (
        <BarisKedip jumlah={3} />
      ) : galat ? (
        <PesanGalat>{galat}</PesanGalat>
      ) : isi.length === 0 ? (
        <p className="text-sm text-gray-500">{kosong}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {isi.map((b) => (
            <li key={b.nama} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5 ring-1 ring-gray-100">
              <span className="text-sm font-medium text-gray-800">{b.nama}</span>
              <span className="shrink-0 text-xs text-gray-500">{b.jumlah_produk} produk</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function KotakCari({ placeholder, nilai, onUbah }: { placeholder: string; nilai: string; onUbah: (v: string) => void }) {
  return (
    <div className="relative">
      <Search size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={nilai}
        onChange={(e) => onUbah(e.target.value)}
        placeholder={placeholder}
        maxLength={60}
        className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 pr-4 pl-10 text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400 focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
      />
    </div>
  );
}

function Bagian({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="px-1 text-[11px] font-bold tracking-wide text-gray-500 uppercase">{label}</h3>
      {children}
    </section>
  );
}

function Baris({ onClick, utama, kedua, meta }: { onClick: () => void; utama: string; kedua?: string; meta?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-green-300 hover:bg-green-50/40 active:scale-[0.99]"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-gray-800">{utama}</span>
        {kedua && <span className="block truncate text-xs text-gray-500 italic">{kedua}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {meta && <span className="text-xs text-gray-500">{meta}</span>}
        <ChevronRight size={16} className="text-gray-400" />
      </span>
    </button>
  );
}

function PesanGalat({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm font-medium text-red-600">{children}</p>;
}

function PesanKosong({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-gray-500">{children}</p>;
}

function BarisKedip({ jumlah }: { jumlah: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Memuat">
      {Array.from({ length: jumlah }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />
      ))}
    </div>
  );
}
