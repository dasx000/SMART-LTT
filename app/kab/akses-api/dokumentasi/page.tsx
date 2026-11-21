import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { IZIN } from "@/lib/api";

export const metadata: Metadata = { title: "Dokumentasi API — SMART LTT" };

export default function HalamanDokumentasiApi() {
  return (
    <KerangkaHalaman judul="Dokumentasi API" role={["admin_kab"]} gaya="kab">
      <Isi />
    </KerangkaHalaman>
  );
}

// ─── Komponen tampilan ────────────────────────────────────────────────────────

function Kode({ children, judul }: { children: string; judul?: string }) {
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
      {judul && <p className="border-b border-gray-700 px-4 py-1.5 text-[10px] font-bold tracking-wide text-gray-400 uppercase">{judul}</p>}
      <pre className="overflow-x-auto p-4 text-[12px] leading-relaxed text-green-100">
        <code>{children.trim()}</code>
      </pre>
    </div>
  );
}

function K({ children }: { children: ReactNode }) {
  return <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[12px] text-gray-800">{children}</code>;
}

function Bagian({ id, judul, children }: { id: string; judul: string; children: ReactNode }) {
  return (
    <section id={id} className="mb-6 scroll-mt-24 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="mb-3 text-base font-bold text-gray-800">{judul}</h3>
      <div className="space-y-3 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}

type Baris = [nama: string, wajib: string, ket: ReactNode];
function TabelParam({ baris, kolom = ["Parameter", "Wajib", "Keterangan"] }: { baris: Baris[]; kolom?: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
            {kolom.map((k) => (
              <th key={k} className="p-2.5 text-left">{k}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {baris.map(([n, w, k]) => (
            <tr key={n}>
              <td className="p-2.5 align-top font-mono text-[12px] font-bold whitespace-nowrap text-gray-800">{n}</td>
              <td className="p-2.5 align-top whitespace-nowrap text-gray-500">{w}</td>
              <td className="p-2.5 align-top text-gray-600">{k}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Endpoint({ metode, jalur, izin }: { metode: "GET" | "POST"; jalur: string; izin: keyof typeof IZIN }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
      <span className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold ${metode === "GET" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{metode}</span>
      <span className="font-mono text-sm font-bold text-gray-800">{jalur}</span>
      <span className="ml-auto rounded bg-green-50 px-2 py-0.5 font-mono text-[10px] text-green-700">izin: {izin}</span>
    </div>
  );
}

const DAFTAR_ISI = [
  ["mulai", "Mulai Cepat"],
  ["autentikasi", "Autentikasi & Izin"],
  ["format", "Format Balasan"],
  ["galat", "Kode Galat"],
  ["pengguna", "GET /pengguna"],
  ["wilayah", "GET /wilayah"],
  ["laporan-baca", "GET /laporan"],
  ["laporan-kirim", "POST /laporan"],
  ["epusluh", "POST /epusluh/padi"],
  ["unduh", "GET /unduh/…"],
  ["backup", "GET /backup"],
  ["contoh", "Contoh Kode"],
  ["catatan", "Catatan Perilaku"],
] as const;

// ─── Halaman ──────────────────────────────────────────────────────────────────

async function Isi() {
  await wajibRole("admin_kab");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "nama-aplikasi.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const BASE = `${proto}://${host}`;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-800"><BookOpen size={20} className="text-green-600" /> Dokumentasi API v1</h2>
          <p className="text-[11px] text-gray-500">Untuk pembuat bot / aplikasi luar yang mengakses data SMART LTT.</p>
        </div>
        <Link href="/kab/akses-api" className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50">
          <ArrowLeft size={16} /> Akses API
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[13rem_1fr]">
        <nav className="hidden xl:block" aria-label="Daftar isi">
          <div className="sticky top-24 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="mb-2 text-[10px] font-bold tracking-wide text-gray-400 uppercase">Daftar Isi</p>
            <ul className="space-y-1 text-xs">
              {DAFTAR_ISI.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="block rounded px-2 py-1 text-gray-600 hover:bg-green-50 hover:text-green-700">{label}</a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="min-w-0">
          <Bagian id="mulai" judul="Mulai Cepat">
            <ol className="list-decimal space-y-1 pl-5">
              <li>Admin Kab membuat kunci di menu <b>Akses API</b> dengan izin seperlunya. Kunci lengkap hanya tampil sekali, jadi langsung salin.</li>
              <li>Simpan kunci di file <K>.env</K> aplikasi klien. Jangan menulisnya langsung di kode, membagikannya di grup, atau meng-commit-nya ke GitHub.</li>
              <li>Kirim setiap permintaan ke alamat dasar di bawah dengan header <K>Authorization</K>.</li>
            </ol>
            <Kode judul="Alamat dasar">{BASE + "/api/v1"}</Kode>
            <Kode judul=".env klien (contoh)">{`SMART_LTT_URL=${BASE}\nSMART_LTT_API_KEY=sltt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</Kode>
            <Kode judul="Uji cepat (curl)">{`curl -H "Authorization: Bearer $SMART_LTT_API_KEY" ${BASE}/api/v1/wilayah`}</Kode>
          </Bagian>

          <Bagian id="autentikasi" judul="Autentikasi & Izin">
            <p>
              Setiap permintaan wajib membawa header <K>Authorization: Bearer &lt;kunci&gt;</K>. Kunci berawalan <K>sltt_</K>. Kunci yang salah atau sudah
              dicabut ditolak dengan <K>401</K>.
            </p>
            <p>Setiap kunci hanya bisa memakai endpoint yang izinnya diberikan saat kunci dibuat. Endpoint tanpa izin ditolak dengan <K>403</K>.</p>
            <TabelParam
              kolom={["Izin", "", "Untuk"]}
              baris={(Object.entries(IZIN) as [string, string][]).map(([k, v]) => [k, "", v])}
            />
            <p>Setiap panggilan dicatat (klien, permintaan, status, durasi) dan bisa dilihat Admin Kab di halaman Akses API.</p>
          </Bagian>

          <Bagian id="format" judul="Format Balasan">
            <p>Semua balasan berupa JSON dengan kolom <K>status</K>. Tanggal dan waktu memakai zona <b>WIB (+07:00)</b>.</p>
            <Kode judul="Berhasil">{`{ "status": "success", ...isi }`}</Kode>
            <Kode judul="Gagal">{`{ "status": "error", "pesan": "Kalimat penjelasan yang bisa langsung ditampilkan ke pengguna." }`}</Kode>
          </Bagian>

          <Bagian id="galat" judul="Kode Galat">
            <TabelParam
              kolom={["Kode HTTP", "", "Arti & yang perlu dilakukan"]}
              baris={[
                ["200 / 201", "", "Berhasil. 201 = laporan baru tersimpan (POST)."],
                ["400", "", "Isian atau parameter salah, misalnya format tanggal, kode desa bukan 10 angka, atau komoditas tidak dikenal. Baca kolom pesan."],
                ["401", "", "Kunci tidak ada, salah, atau sudah dicabut. Minta kunci baru ke Admin Kab."],
                ["403", "", "Kunci tidak punya izin untuk endpoint ini, akun PPL nonaktif, atau desa bukan desa binaan PPL tersebut."],
                ["404", "", "NIP, kode desa, atau kode kecamatan tidak ditemukan."],
                ["500", "", "Kesalahan di server. Coba lagi beberapa saat; untuk POST kirim ulang dengan id_kirim yang sama."],
                ["503", "", "Layanan belum dikonfigurasi di server."],
              ]}
            />
          </Bagian>

          <Bagian id="pengguna" judul="Data Pengguna">
            <Endpoint metode="GET" jalur="/api/v1/pengguna" izin="pengguna:baca" />
            <p>
              Daftar akun PPL, Admin BPP, Admin Kab, dan Viewer beserta desa binaan dan nomor WA. Data kecamatan &amp; desa lengkap ada di{" "}
              <a href="#wilayah" className="font-semibold text-green-700 hover:underline">GET /wilayah</a>.
            </p>
            <TabelParam
              baris={[
                ["role", "tidak", <>Satu atau beberapa, dipisah koma: <K>penyuluh</K>, <K>admin_bpp</K>, <K>admin_kab</K>, <K>viewer</K>. Bawaan: semua role. Mis. hanya PPL &amp; BPP: <K>role=penyuluh,admin_bpp</K>.</>],
                ["kecamatan", "tidak", <>Kode Kemendagri 6 angka, mis. <K>180801</K>.</>],
                ["nip", "tidak", "Ambil satu orang saja."],
                ["aktif", "tidak", <>Isi <K>semua</K> untuk ikut menampilkan akun nonaktif. Bawaan: hanya aktif.</>],
              ]}
            />
            <Kode judul="Permintaan">{`GET ${BASE}/api/v1/pengguna?kecamatan=180801`}</Kode>
            <Kode judul="Balasan 200">{`{
  "status": "success",
  "total_staff": 1,
  "last_updated": "16-11-2026 09:15",
  "staff": [
    {
      "nip": "198001012010011001",
      "nama": "NAMA PENYULUH, S.P.",
      "desa_binaan": ["1808011005-Blambangan Umpu", "1808012006-Lembasung"],
      "no_wa": "6281234567890",
      "role": "penyuluh",
      "kecamatan": { "kode": "180801", "nama": "Blambangan Umpu" },
      "aktif": true
    }
  ]
}`}</Kode>
            <TabelParam
              kolom={["Kolom", "", "Keterangan"]}
              baris={[
                ["role", "", <><K>penyuluh</K>, <K>admin_bpp</K>, <K>admin_kab</K>, atau <K>viewer</K>.</>],
                ["desa_binaan", "", <>Format <K>&quot;kode-nama&quot;</K>, urut kode. Kosong untuk Admin Kab / Viewer.</>],
                ["no_wa", "", <>Hanya angka, awalan <K>62</K>. String kosong bila belum diisi.</>],
                ["kecamatan", "", <>Wilayah kerja; <K>null</K> untuk akun tingkat kabupaten.</>],
              ]}
            />
          </Bagian>

          <Bagian id="wilayah" judul="Data Wilayah">
            <Endpoint metode="GET" jalur="/api/v1/wilayah" izin="wilayah:baca" />
            <p>
              Semua kecamatan dan desa dengan kode Kemendagri, urut kode. Isi <K>data</K> sama dengan <K>database/master_desa.json</K> DASBOT. Tidak ada
              parameter.
            </p>
            <Kode judul="Balasan 200">{`{
  "status": "success",
  "total_kecamatan": 15,
  "total_desa": 227,
  "data": [
    {
      "id_kecamatan": "180801",
      "nama_kecamatan": "Blambangan Umpu",
      "desa": [
        { "id_desa": "1808011005", "nama_desa": "Blambangan Umpu" },
        { "id_desa": "1808012006", "nama_desa": "Lembasung" }
      ]
    }
  ]
}`}</Kode>
          </Bagian>

          <Bagian id="laporan-baca" judul="Membaca Laporan LTT">
            <Endpoint metode="GET" jalur="/api/v1/laporan" izin="laporan:baca" />
            <p>Laporan Padi, Jagung, dan Ubi Kayu, terbaru di atas. Laporan yang sudah dihapus tidak ikut.</p>
            <TabelParam
              baris={[
                ["dari", "tidak", <>Tanggal awal <K>YYYY-MM-DD</K> (WIB). Bawaan: hari ini.</>],
                ["sampai", "tidak", <>Tanggal akhir <K>YYYY-MM-DD</K>, ikut dihitung. Bawaan: sama dengan dari. Rentang maks. <b>92 hari</b>.</>],
                ["komoditas", "tidak", <><K>Padi</K>, <K>Jagung</K>, atau <K>Ubi Kayu</K>.</>],
                ["kecamatan", "tidak", "Kode 6 angka."],
                ["desa", "tidak", "Kode 10 angka."],
                ["sumber", "tidak", <><K>manual</K> (input PPL / API) atau <K>epusluh</K> (padi dari e-Pusluh).</>],
                ["nip", "tidak", "Laporan satu PPL."],
                ["halaman", "tidak", "Mulai 1. Bawaan 1."],
                ["per", "tidak", <>Baris per halaman. Bawaan 500, maks. <b>1000</b>.</>],
              ]}
            />
            <Kode judul="Permintaan">{`GET ${BASE}/api/v1/laporan?dari=2026-11-01&sampai=2026-11-16&komoditas=Jagung&halaman=1`}</Kode>
            <Kode judul="Balasan 200">{`{
  "status": "success",
  "dari": "2026-11-01",
  "sampai": "2026-11-16",
  "halaman": 1,
  "per": 500,
  "total": 1,
  "jumlah_halaman": 1,
  "data": [
    {
      "id": 15201,
      "id_sumber": null,
      "sumber": "manual",
      "tanggal_lapor": "2026-11-16T09:12:30+07:00",
      "komoditas": "Jagung",
      "jenis_ltt": "LTT",
      "metode_penanaman": null,
      "kecamatan": { "kode": "180801", "nama": "Blambangan Umpu" },
      "desa": { "kode": "1808011005", "nama": "Blambangan Umpu" },
      "pelapor": { "nama": "NAMA PENYULUH, S.P.", "nip": "198001012010011001" },
      "luas_bera": 0,
      "realisasi_olah": 0,
      "realisasi_tanam": 2.5,
      "realisasi_panen": 0,
      "keterangan": "via WA",
      "dibuat": "2026-11-16T02:12:30.123+00:00",
      "diperbarui": "2026-11-16T02:12:30.123+00:00"
    }
  ]
}`}</Kode>
            <TabelParam
              kolom={["Kolom", "", "Keterangan"]}
              baris={[
                ["id", "", "ID laporan di SMART LTT."],
                ["id_sumber", "", <>ID di sistem asal: ID e-Pusluh (angka), <K>SYNC-…</K> (bot lama), <K>LTT-…</K> (sheet lama), <K>api:…</K> (kiriman API dengan id_kirim), atau <K>null</K>.</>],
                ["tanggal_lapor", "", "Waktu laporan (WIB)."],
                ["jenis_ltt / metode_penanaman", "", "Jenis LTT (mis. LTT Reguler, LTT CSR 2026) dan metode padi (Regular / PM AAS). Jagung & Ubi Kayu: jenis \"LTT\", metode null."],
                ["pelapor", "", "Laporan e-Pusluh hanya punya nama; nip null."],
                ["luas_* / realisasi_*", "", "Hektare (angka desimal)."],
                ["dibuat / diperbarui", "", "Waktu catatan dibuat / terakhir diubah di database (UTC)."],
              ]}
            />
            <p>
              <b>Data banyak:</b> ulangi permintaan dengan <K>halaman=2</K>, <K>3</K>, … sampai <K>halaman</K> = <K>jumlah_halaman</K>. Untuk rentang lebih dari
              92 hari, pecah per bulan.
            </p>
          </Bagian>

          <Bagian id="laporan-kirim" judul="Mengirim Laporan Jagung / Ubi Kayu">
            <Endpoint metode="POST" jalur="/api/v1/laporan" izin="laporan:tulis" />
            <p>
              Mengirim laporan atas nama PPL, dengan aturan yang sama seperti form PPL di aplikasi. Laporan <b>padi tidak bisa</b> dikirim lewat sini karena
              padi masuk dari e-Pusluh. Waktu lapor diisi waktu server saat diterima.
            </p>
            <TabelParam
              kolom={["Kolom body (JSON)", "Wajib", "Keterangan"]}
              baris={[
                ["nip", "ya", "NIP PPL atau Admin BPP pelapor. Akun harus aktif."],
                ["desa", "ya", "Kode desa 10 angka. Harus desa binaan pelapor."],
                ["komoditas", "ya", <><K>Jagung</K> atau <K>Ubi Kayu</K>.</>],
                ["realisasi_tanam", "ya", <>Hektare, ≥ 0. Boleh angka atau teks (<K>&quot;2,5&quot;</K> diterima).</>],
                ["realisasi_panen", "ya", "Hektare, ≥ 0. Laporan bernilai 0 tetap diterima."],
                ["keterangan", "tidak", "Maks. 500 karakter."],
                ["id_kirim", "tidak", <>Kunci unik dari pengirim (mis. ID pesan WA), maks. 100 karakter. <b>Sangat disarankan.</b></>],
              ]}
            />
            <Kode judul="Permintaan">{`POST ${BASE}/api/v1/laporan
Authorization: Bearer sltt_...
Content-Type: application/json

{
  "nip": "198001012010011001",
  "desa": "1808011005",
  "komoditas": "Jagung",
  "realisasi_tanam": 2.5,
  "realisasi_panen": 0,
  "keterangan": "via WA",
  "id_kirim": "3EB0A1B2C3D4E5F6"
}`}</Kode>
            <Kode judul="Balasan 201 (tersimpan)">{`{
  "status": "success",
  "duplikat": false,
  "pesan": "Laporan Jagung desa Blambangan Umpu tersimpan.",
  "data": { "id": 15202, "id_sumber": "api:1a2b3c4d:3EB0A1B2C3D4E5F6", "...": "format sama dengan GET /laporan" }
}`}</Kode>
            <Kode judul="Balasan 200 (kiriman ulang, id_kirim sama)">{`{
  "status": "success",
  "duplikat": true,
  "pesan": "Laporan dengan id_kirim ini sudah tersimpan sebelumnya.",
  "data": { "id": 15202, "...": "laporan yang sudah ada" }
}`}</Kode>
            <Kode judul="Balasan 403 (contoh)">{`{ "status": "error", "pesan": "Desa Lembasung bukan desa binaan NAMA PENYULUH, S.P.." }`}</Kode>
            <p>
              <b>Kenapa id_kirim penting:</b> kalau jaringan putus setelah server menyimpan tetapi sebelum balasan diterima, klien biasanya mengirim ulang. Dengan{" "}
              <K>id_kirim</K> yang sama, server mengembalikan laporan yang sudah ada (<K>duplikat: true</K>) dan tidak membuat laporan ganda. Tanpa id_kirim,
              setiap kiriman menjadi laporan baru.
            </p>
          </Bagian>

          <Bagian id="epusluh" judul="Sinkron Padi e-Pusluh (Bot)">
            <Endpoint metode="POST" jalur="/api/v1/epusluh/padi" izin="epusluh:tulis" />
            <p>
              Dipakai bot VPS (<K>DASBOT/scripts/run_tarik_data.py</K>) untuk mengirim hasil tarikan laporan padi e-Pusluh. Format body sama dengan kiriman lama
              ke GAS (<K>aksi</K> dan <K>dataVPS</K> boleh ikut, tetapi diabaikan). Setiap kiriman dicatat di menu <b>Log Sinkronisasi</b>.
            </p>
            <TabelParam
              kolom={["Kolom body (JSON)", "Wajib", "Keterangan"]}
              baris={[
                ["data", "ya", <>Array baris, tiap baris array 18 kolom (min. 13), maks. 5000 baris. Urutan kolom di bawah.</>],
                ["logData", "tidak", <>Info tarikan untuk Log Sinkronisasi: <K>idSync</K>, <K>totalTarik</K>, <K>dataBerisi</K>, <K>dataNihil</K>.</>],
              ]}
            />
            <TabelParam
              kolom={["Indeks", "", "Isi kolom"]}
              baris={[
                ["0", "", <>ID laporan e-Pusluh (<b>angka</b>). Baris tanpa ID asli ditolak.</>],
                ["1", "", <>Waktu lapor, mis. <K>Nov 16, 2026 09:12:30</K> atau <K>16/11/2026 09:12</K> (dibaca sebagai WIB).</>],
                ["2 / 3 / 4", "", "Pelapor / Kecamatan / Desa. Kecamatan + desa harus cocok dengan master (huruf besar-kecil diabaikan)."],
                ["5 / 6", "", <>Komoditas (diabaikan, selalu Padi) / Jenis LTT (<K>-</K> atau kosong = LTT Reguler).</>],
                ["7–8", "", "Target (diabaikan)."],
                ["9 / 10 / 11 / 12", "", "Bera / Olah / Tanam / Panen (ha)."],
                ["13", "", <>Keterangan (<K>-</K> = kosong).</>],
                ["14–16", "", "Status & waktu verifikasi (diabaikan)."],
                ["17", "", "Metode penanaman (Regular / PM AAS)."],
              ]}
            />
            <Kode judul="Permintaan">{`POST ${BASE}/api/v1/epusluh/padi
Authorization: Bearer sltt_...
Content-Type: application/json

{
  "data": [
    ["49758007", "Nov 16, 2026 09:12:30", "NAMA PENYULUH, S.P.", "Blambangan Umpu", "Lembasung", "Padi",
     "LTT Reguler", 0, 0, 0, 0, 2.5, 0, "-", "Diajukan", "", "", "Regular"]
  ],
  "logData": { "idSync": "SYNC-1794800000000", "totalTarik": 337, "dataBerisi": 65, "dataNihil": 272 }
}`}</Kode>
            <Kode judul="Balasan 200">{`{
  "status": "success",
  "diterima": 1,
  "ditambah": 1,
  "diperbarui": 0,
  "dilewati_data_lama": 0,
  "wilayah_dilewati": [],
  "nihil": 0,
  "id_tidak_valid": 0,
  "desa_tidak_cocok": [],
  "tanggal_tidak_terbaca": 0,
  "tanggal": ["2026-11-16"]
}`}</Kode>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><b>Aturan simpan</b> (sama dengan impor Excel): ID baru ditambah, ID yang sudah ada diperbarui, <b>tidak ada yang dihapus</b>. Kirim ulang tarikan yang sama aman, tidak membuat ganda.</li>
              <li><b>Dilewati</b>: baris nihil (semua luas 0), ID bukan angka atau ganda dalam satu kiriman, desa tidak dikenal, waktu tak terbaca. Jumlahnya dilaporkan di balasan.</li>
              <li><b>Data lama</b>: tanggal + kecamatan yang masih berisi data bot lama ber-ID <K>SYNC-…</K> dilewati agar tidak ganda (<K>dilewati_data_lama</K>, <K>wilayah_dilewati</K>).</li>
              <li>Semua baris diproses dalam satu transaksi: kalau gagal di tengah (<K>500</K>), tidak ada data yang berubah. Kirim ulang aman.</li>
            </ul>
          </Bagian>

          <Bagian id="unduh" judul="Unduh Excel (Rekap Dinas, LTT Provinsi & Laporan)">
            <Endpoint metode="GET" jalur="/api/v1/unduh/rekap-dinas" izin="unduh:baca" />
            <Endpoint metode="GET" jalur="/api/v1/unduh/ltt-provinsi" izin="unduh:baca" />
            <Endpoint metode="GET" jalur="/api/v1/unduh/laporan" izin="unduh:baca" />
            <p>
              Mengembalikan <b>spesifikasi Excel</b> yang sama persis dengan tombol unduh di aplikasi (judul, kolom, baris, total, gaya). Server tidak membuat
              file .xlsx; klien merakitnya sendiri dengan ExcelJS (contoh perender: <K>lib/excel.ts</K> di aplikasi, atau <K>DASBOT/lib/smartltt-excel.js</K>).
              Dengan begitu angka dan format di file bot selalu sama dengan unduhan aplikasi.
            </p>
            <TabelParam
              baris={[
                ["rekap-dinas: tanggal", "tidak", <>Rekap <b>satu hari</b> <K>YYYY-MM-DD</K> (WIB). Kalau diisi, tahun & bulan diabaikan.</>],
                ["rekap-dinas: tahun, bulan", "tidak", "Rekap satu bulan. Bawaan: bulan berjalan."],
                ["ltt-provinsi: tahun, bulan", "tidak", <>Bawaan: bulan berjalan → realisasi <b>hari ini</b> + kumulatif <b>1 s.d hari ini</b>, target & persentase (sama dengan tabel LTT Padi format Provinsi di dashboard). Bulan lalu → s.d tanggal terakhir bulan itu.</>],
                ["laporan: dari, sampai", "tidak", <>Rentang <K>YYYY-MM-DD</K>. Bawaan: hari ini. Maks. <b>92 hari</b>.</>],
                ["laporan: komoditas", "tidak", <><K>Padi</K>, <K>Jagung</K>, atau <K>Ubi Kayu</K>. Bawaan: semua.</>],
                ["laporan: kecamatan", "tidak", "Kode 6 angka. Bawaan: semua kecamatan."],
              ]}
            />
            <Kode judul="Permintaan">{`GET ${BASE}/api/v1/unduh/rekap-dinas?tanggal=2026-11-17`}</Kode>
            <Kode judul="Balasan 200 (dipendekkan)">{`{
  "status": "success",
  "namaFile": ["Rekap_LTT", "2026-11-17"],
  "lembar": [
    {
      "nama": "Rekap LTT",
      "judul": "LAPORAN REKAPITULASI LUAS TAMBAH TANAM (LTT)",
      "info": ["Tanggal Laporan: 17 November 2026"],
      "kolom": [{ "judul": "NO", "lebar": 5, "jenis": "bulat" }, "..."],
      "blok": [{ "t": "header", "baris": [["NO", "KECAMATAN", "LTT PADI REGULER", "..."]] }, { "t": "data", "baris": [[1, "Baradatu", 12.5, 0, "..."]] }, { "t": "total", "nilai": ["JUMLAH", "", "..."] }]
    }
  ]
}`}</Kode>
            <p>
              Nama file yang dipakai aplikasi: <K>SMART-LTT_</K> + isi <K>namaFile</K> digabung garis bawah + <K>.xlsx</K>. Beberapa spesifikasi boleh digabung
              menjadi satu file dengan menggabungkan array <K>lembar</K>.
            </p>
          </Bagian>

          <Bagian id="backup" judul="Unduh Backup Data (Cronjob / Bot VPS)">
            <Endpoint metode="GET" jalur="/api/v1/backup" izin="backup:baca" />
            <p>
              Mengunduh salinan seluruh data SMART LTT sebagai file <K>.json.gz</K>, isinya sama dengan tombol <b>Unduh Backup</b> di menu Backup Data.
              Cocok untuk cronjob harian di VPS. Tanpa parameter. Kunci yang diberi izin ini bisa membaca <b>semua data</b>, jadi simpan dengan hati-hati.
            </p>
            <Kode judul="Permintaan (curl)">{`curl -fL -H "Authorization: Bearer $SMART_LTT_API_KEY" \\
  -o SMART-LTT-backup-$(date +%F).json.gz ${BASE}/api/v1/backup`}</Kode>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Balasan berupa <b>berkas biner</b> (<K>application/gzip</K>), bukan JSON. Galat (401/403/500) tetap berupa JSON seperti endpoint lain.</li>
              <li>Dikirim bertahap (stream), bisa memakan waktu puluhan detik. Beri <K>timeout</K> klien minimal 120 detik. Kalau koneksi putus, berkas tidak utuh: ulangi.</li>
              <li>Dicatat di riwayat backup sebagai <K>Bot: &lt;nama kunci&gt;</K>, sehingga pengingat backup di dashboard ikut diperbarui.</li>
              <li>Password tidak ikut (ada di Supabase Auth). Daftar tabel sama dengan backup manual.</li>
            </ul>
          </Bagian>

          <Bagian id="contoh" judul="Contoh Kode">
            <Kode judul="Node.js (axios)">{`const axios = require('axios');
const api = axios.create({
  baseURL: process.env.SMART_LTT_URL,
  headers: { Authorization: \`Bearer \${process.env.SMART_LTT_API_KEY}\` },
  timeout: 30000,
});

const ppl = (await api.get('/api/v1/pengguna')).data;            // ppl.staff, ppl.total_staff
const desa = (await api.get('/api/v1/wilayah')).data.data;       // sama dengan master_desa.json

try {
  const r = await api.post('/api/v1/laporan', {
    nip: '198001012010011001', desa: '1808011005', komoditas: 'Jagung',
    realisasi_tanam: 2.5, realisasi_panen: 0, id_kirim: msg.key.id,
  });
  console.log(r.data.pesan);
} catch (e) {
  console.log(e.response?.data?.pesan ?? e.message);           // pesan galat siap tampil
}`}</Kode>
            <Kode judul="Python (requests)">{`import os, requests

URL = os.getenv("SMART_LTT_URL")
H = {"Authorization": f"Bearer {os.getenv('SMART_LTT_API_KEY')}"}

semua, halaman = [], 1
while True:
    r = requests.get(f"{URL}/api/v1/laporan", headers=H, timeout=30,
                     params={"dari": "2026-11-01", "sampai": "2026-11-16", "halaman": halaman})
    j = r.json()
    if j["status"] != "success":
        raise RuntimeError(j["pesan"])
    semua += j["data"]
    if halaman >= j["jumlah_halaman"]:
        break
    halaman += 1`}</Kode>
            <Kode judul="curl">{`curl -X POST ${BASE}/api/v1/laporan \\
  -H "Authorization: Bearer $SMART_LTT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"nip":"198001012010011001","desa":"1808011005","komoditas":"Ubi Kayu","realisasi_tanam":1,"realisasi_panen":0}'`}</Kode>
          </Bagian>

          <Bagian id="catatan" judul="Catatan Perilaku">
            <ul className="list-disc space-y-1.5 pl-5">
              <li><b>Data padi e-Pusluh</b> masuk lewat bot sinkron atau impor Excel. Laporan nihil (semua luas 0) dari e-Pusluh tidak disimpan, jadi tidak muncul di GET /laporan.</li>
              <li><b>Laporan yang dihapus</b> di aplikasi tidak ikut di GET /laporan.</li>
              <li><b>Data selalu terbaru</b>: balasan tidak di-cache. Untuk data yang jarang berubah (pengguna, wilayah), klien sebaiknya menyimpan salinan dan menyegarkannya berkala (mis. tiap 3 jam), bukan setiap pesan.</li>
              <li><b>Batas</b>: rentang tanggal maks. 92 hari, maks. 1000 baris per halaman. Belum ada batas jumlah panggilan, tetapi gunakan secukupnya.</li>
              <li><b>Kode wilayah</b> mengikuti Kemendagri (kecamatan 6 angka, desa 10 angka) dan tidak berubah walau nama desa diperbaiki.</li>
              <li><b>Versi</b>: semua endpoint berada di <K>/api/v1</K>. Perubahan yang merusak format akan dibuat di versi baru (<K>/api/v2</K>), sehingga klien lama tetap jalan.</li>
              <li><b>Keamanan</b>: kunci hanya disimpan sebagai hash. Kalau kunci bocor, segera <b>Cabut</b> di halaman Akses API lalu buat kunci baru.</li>
            </ul>
          </Bagian>
        </div>
      </div>
    </>
  );
}
