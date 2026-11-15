import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseSiap } from "@/lib/env";
import { parseTanggalEpusluh } from "@/lib/tanggal-epusluh";
import { SELECT_DESA, angka, jenisLtt, idValid, keterangan, kunciNama, metode, nihil as barisNihil, petaDesa as bentukPetaDesa, teks } from "@/lib/epusluh";

/**
 * POST /api/epusluh/sinkron-padi — pengganti doPost aksi=sinkron_padi (GAS lama).
 * Dipanggil bot VPS (DASBOT/scripts/run_tarik_data.py) 4x sehari.
 *
 * Header : Authorization: Bearer <EPUSLUH_INGEST_TOKEN>
 * Body   : { data: Baris18Kolom[], logData?: {...} }   (dataVPS diabaikan)
 * Kolom  : 0 ID, 1 Waktu_Lapor, 2 Pelapor, 3 Kecamatan, 4 Desa, 5 Komoditas, 6 Jenis_LTT,
 *          7-8 target, 9 Bera, 10 Olah, 11 Tanam, 12 Panen, 13 Keterangan, 14 Status,
 *          15-16 waktu, 17 Metode_Penanaman
 * Aturan : sama dengan impor Excel (ltt.sinkron_padi → ltt.upsert_padi_epusluh, 0008):
 *          dicocokkan lewat ID asli e-Pusluh — ID baru ditambah, ID lama diperbarui, tidak ada yang
 *          dihapus. Baris nihil & baris tanpa ID asli dilewati. Satu transaksi.
 */

const BATAS_BARIS = 5000;

const skemaBody = z.object({
  data: z.array(z.array(z.unknown()).min(13)).max(BATAS_BARIS),
  logData: z.record(z.string(), z.unknown()).optional(),
});

function tokenCocok(dikirim: string | null, rahasia: string): boolean {
  if (!dikirim) return false;
  const a = Buffer.from(dikirim);
  const b = Buffer.from(rahasia);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  // 1. Token WAJIB dari env. Tanpa env → endpoint mati (tidak ada token cadangan).
  const rahasia = process.env.EPUSLUH_INGEST_TOKEN;
  if (!rahasia || rahasia.length < 24) {
    return NextResponse.json({ status: "error", pesan: "Endpoint belum dikonfigurasi." }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  const dikirim = auth?.startsWith("Bearer ") ? auth.slice(7) : req.headers.get("x-ingest-token");
  if (!tokenCocok(dikirim, rahasia)) {
    return NextResponse.json({ status: "error", pesan: "Token tidak valid." }, { status: 401 });
  }
  if (!supabaseSiap() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ status: "error", pesan: "Database belum dikonfigurasi." }, { status: 503 });
  }

  // 2. Validasi body
  let body: z.infer<typeof skemaBody>;
  try {
    body = skemaBody.parse(await req.json());
  } catch {
    return NextResponse.json({ status: "error", pesan: "Format data tidak valid." }, { status: 400 });
  }

  // Tidak ada baris → tidak ada yang ditimpa; jangan sentuh database sama sekali.
  if (body.data.length === 0) {
    return NextResponse.json({ status: "success", diterima: 0, disimpan: 0, pesan: "Tidak ada data." });
  }

  const admin = supabaseAdmin();
  const logData = body.logData ?? {};

  try {
    // 3. Peta desa: "kecamatan|desa" → id (nama desa kembar di kecamatan lain, jadi pakai keduanya)
    const { data: desas, error: errDesa } = await admin.from("desa").select(SELECT_DESA).limit(2000);
    if (errDesa) throw new Error(errDesa.message);
    const petaDesa = bentukPetaDesa(desas ?? []);

    // 4. Normalisasi baris
    const baris: Record<string, unknown>[] = [];
    const desaTakCocok = new Set<string>();
    const idTerpakai = new Set<string>();
    let tanggalGagal = 0;
    let nihil = 0;
    let idTidakValid = 0;

    for (const r of body.data) {
      const id = teks(r[0]);
      if (!idValid(id) || idTerpakai.has(id)) {
        idTidakValid++;
        continue;
      }
      const desaId = petaDesa.get(`${kunciNama(r[3])}|${kunciNama(r[4])}`);
      if (!desaId) {
        desaTakCocok.add(`${teks(r[3])} / ${teks(r[4])}`);
        continue;
      }
      const tanggal = parseTanggalEpusluh(r[1]);
      if (!tanggal) {
        tanggalGagal++;
        continue;
      }
      const tanam = angka(r[11]);
      const panen = angka(r[12]);
      const bera = angka(r[9]);
      const olah = angka(r[10]);
      if (barisNihil({ tanam, panen, bera, olah })) {
        nihil++;
        continue;
      }

      idTerpakai.add(id);
      baris.push({
        id_sumber: id,
        tanggal_lapor: tanggal,
        nama_pelapor: teks(r[2]) || null,
        desa_id: desaId,
        jenis_ltt: jenisLtt(r[6]),
        luas_bera: bera,
        realisasi_olah: olah,
        realisasi_tanam: tanam,
        realisasi_panen: panen,
        metode_penanaman: metode(r[17]),
        keterangan: keterangan(r[13]),
      });
    }

    // 5. Tambah / perbarui per ID dalam satu transaksi
    let hasil = { ditambah: 0, diperbarui: 0, dilewati: 0, wilayah_dilewati: [] as string[] };
    if (baris.length > 0) {
      const { data, error } = await admin.rpc("sinkron_padi", { p_rows: baris });
      if (error) throw new Error(error.message);
      const h = Array.isArray(data) ? data[0] : data;
      hasil = {
        ditambah: h?.ditambah ?? 0,
        diperbarui: h?.diperbarui ?? 0,
        dilewati: h?.dilewati ?? 0,
        wilayah_dilewati: h?.wilayah_dilewati ?? [],
      };
    }
    const tanggal = [...new Set(baris.map((b) => String(b.tanggal_lapor).slice(0, 10)))].sort();

    const ringkas = {
      diterima: body.data.length,
      ditambah: hasil.ditambah,
      diperbarui: hasil.diperbarui,
      dilewati_data_lama: hasil.dilewati,
      wilayah_dilewati: hasil.wilayah_dilewati,
      nihil,
      id_tidak_valid: idTidakValid,
      desa_tidak_cocok: [...desaTakCocok],
      tanggal_tidak_terbaca: tanggalGagal,
      tanggal,
    };
    const adaMasalah = desaTakCocok.size > 0 || tanggalGagal > 0 || idTidakValid > 0;

    await admin.from("logs_sinkron").insert({
      total_tarik: Number(logData.totalTarik) || body.data.length,
      data_berisi: Number(logData.dataBerisi) || baris.length,
      data_nihil: Number(logData.dataNihil) || nihil,
      tanggal_laporan: tanggal[0] ?? null,
      status: adaMasalah ? "Sukses (ada baris dilewati)" : "Sukses",
      keterangan: { ...ringkas, id_sync: logData.idSync ?? null },
    });

    return NextResponse.json({ status: "success", ...ringkas });
  } catch (err) {
    const pesan = err instanceof Error ? err.message : "Kesalahan internal.";
    await admin
      .from("logs_sinkron")
      .insert({ status: `Error: ${pesan}`.slice(0, 500), keterangan: { id_sync: logData.idSync ?? null } })
      .then(
        () => undefined,
        () => undefined,
      );
    return NextResponse.json({ status: "error", pesan: "Sinkron gagal, tidak ada data yang diubah." }, { status: 500 });
  }
}
