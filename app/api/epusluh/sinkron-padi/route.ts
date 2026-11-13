import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseSiap } from "@/lib/env";

/**
 * Endpoint Ingest Data Padi Otomatis dari Bot VPS Playwright (DASBOT)
 * Menggantikan `doPost` aksi `sinkron_padi` pada Google Apps Script lama.
 */
export async function POST(req: NextRequest) {
  // 1. Verifikasi Token Keamanan
  const secret = process.env.EPUSLUH_INGEST_TOKEN || "smartltt-epusluh-secret-token";
  const authHeader = req.headers.get("x-ingest-token") || req.headers.get("authorization")?.replace("Bearer ", "");

  if (!authHeader || authHeader !== secret) {
    return NextResponse.json({ error: "Unauthorized: Token tidak valid." }, { status: 401 });
  }

  if (!supabaseSiap() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Database belum terkonfigurasi." }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { data: rows, logData } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ pesan: "Data kosong, tidak ada baris yang diproses." }, { status: 200 });
    }

    const admin = supabaseAdmin();

    // 2. Ambil master desa untuk pemetaan cepat
    const { data: desas } = await admin
      .from("desa")
      .select("id, nama, kecamatan:kecamatan_id(nama)");

    const mapDesa = new Map<string, number>();
    if (desas) {
      for (const d of desas) {
        const kec = (d.kecamatan as unknown as { nama: string } | null)?.nama?.toLowerCase().trim() || "";
        const des = d.nama.toLowerCase().trim();
        mapDesa.set(`${kec}___${des}`, d.id);
      }
    }

    // 3. Ekstraksi tanggal-tanggal laporan untuk aturan "timpa per tanggal"
    const tanggalSet = new Set<string>();
    const barisBersih: Array<{
      id_lama: string | null;
      tanggal_lapor: string;
      desa_id: number;
      komoditas: string;
      target_tanam: number;
      target_panen: number;
      luas_bera: number;
      realisasi_olah: number;
      realisasi_tanam: number;
      realisasi_panen: number;
      metode_penanaman: string | null;
      keterangan: string | null;
      sumber: string;
    }> = [];

    let totalNihil = 0;
    let totalBerisi = 0;

    for (const r of rows) {
      // r bisa berupa array 18 kolom atau objek
      const isArr = Array.isArray(r);
      const idLaporan = isArr ? r[0] : r.ID_Laporan;
      const waktuLapor = isArr ? r[1] : r.Waktu_Lapor;
      const kec = (isArr ? r[3] : r.Kecamatan || r.Nama_Kecamatan || "").toString().toLowerCase().trim();
      const des = (isArr ? r[4] : r.Desa || r.Nama_Desa || "").toString().toLowerCase().trim();
      const tanam = Number(isArr ? r[11] : r.Realisasi_Luas_Tanam) || 0;
      const panen = Number(isArr ? r[12] : r.Realisasi_Luas_Panen) || 0;
      const bera = Number(isArr ? r[9] : r.Luas_Lahan_Bera) || 0;
      const olah = Number(isArr ? r[10] : r.Realisasi_Olah_Lahan) || 0;
      const targetTanam = Number(isArr ? r[7] : r.Target_Tanam_Bln_Ini) || 0;
      const targetPanen = Number(isArr ? r[8] : r.Target_Panen_Bln_Ini) || 0;
      const ket = isArr ? r[13] : r.Keterangan;
      const metode = isArr ? r[17] : r.Metode_Penanaman;

      const desaId = mapDesa.get(`${kec}___${des}`);
      if (!desaId) continue;

      let tglIso: string;
      try {
        tglIso = new Date(waktuLapor).toISOString();
      } catch {
        tglIso = new Date().toISOString();
      }

      const tglHanya = tglIso.split("T")[0];
      tanggalSet.add(tglHanya);

      if (tanam > 0 || panen > 0) {
        totalBerisi++;
      } else {
        totalNihil++;
      }

      barisBersih.push({
        id_lama: idLaporan ? String(idLaporan) : null,
        tanggal_lapor: tglIso,
        desa_id: desaId,
        komoditas: "Padi",
        target_tanam: targetTanam,
        target_panen: targetPanen,
        luas_bera: bera,
        realisasi_olah: olah,
        realisasi_tanam: tanam,
        realisasi_panen: panen,
        metode_penanaman: metode && String(metode).toUpperCase().includes("AAS") ? "PM AAS" : "Regular",
        keterangan: ket ? String(ket) : null,
        sumber: "epusluh",
      });
    }

    // 4. Hapus data Padi lama yang bertanggal sama (aturan timpa)
    for (const tgl of tanggalSet) {
      await admin
        .from("laporan_ltt")
        .delete()
        .eq("komoditas", "Padi")
        .eq("sumber", "epusluh")
        .gte("tanggal_lapor", `${tgl}T00:00:00`)
        .lte("tanggal_lapor", `${tgl}T23:59:59`);
    }

    // 5. Masukkan data baru
    if (barisBersih.length > 0) {
      const { error: errInsert } = await admin.from("laporan_ltt").insert(barisBersih);
      if (errInsert) {
        throw new Error(errInsert.message);
      }
    }

    // 6. Catat log ke ltt.logs_sinkron
    await admin.from("logs_sinkron").insert({
      total_tarik: rows.length,
      data_berisi: totalBerisi,
      data_nihil: totalNihil,
      tanggal_laporan: Array.from(tanggalSet)[0] || new Date().toISOString().split("T")[0],
      status: "Sukses",
      keterangan: logData || { jumlah_injeksi: barisBersih.length },
    });

    return NextResponse.json({
      sukses: true,
      total_diterima: rows.length,
      total_disimpan: barisBersih.length,
      data_berisi: totalBerisi,
      data_nihil: totalNihil,
      tanggal_ditimpa: Array.from(tanggalSet),
    });
  } catch (err: unknown) {
    const errorPesan = err instanceof Error ? err.message : "Terjadi kesalahan internal.";

    // Catat log kegagalan
    try {
      await supabaseAdmin().from("logs_sinkron").insert({
        status: `Error: ${errorPesan}`,
      });
    } catch {
      // ignore log error
    }

    return NextResponse.json({ error: errorPesan }, { status: 500 });
  }
}
