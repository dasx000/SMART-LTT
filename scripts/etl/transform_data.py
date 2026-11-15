"""
Transformasi dan Normalisasi Seluruh Data Mentah dari MASTER DATABASE LTT.xlsx
Output: File-file JSON bersih di folder scripts/etl/data_bersih/
CATATAN: Script ini HANYA memproses data secara lokal (dry-run). TIDAK memasukkan data ke Supabase.
"""

import os
import re
import json
import datetime as dt
from collections import defaultdict
import openpyxl

EXCEL_FILE = "MASTER DATABASE LTT.xlsx"
OUTPUT_DIR = os.path.join("scripts", "etl", "data_bersih")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def norm(s):
    return re.sub(r"\s+", " ", str(s or "").strip())

def parse_num(v):
    """Angka dari sel: 12 / 12.5 / "12,5" / "1.234,5" → float. Gagal → 0.0."""
    if v is None or v == "":
        return 0.0
    if isinstance(v, (int, float)):
        return round(float(v), 2)
    s = re.sub(r"\s+", "", str(v))
    if "," in s and "." in s:
        s = s.replace(".", "")          # titik = pemisah ribuan
    s = s.replace(",", ".")
    try:
        return round(float(s), 2)
    except ValueError:
        return 0.0


def norm_jenis(jenis, komoditas):
    """Samakan penulisan jenis LTT (spasi ganda, 'Rehap' → 'Rehab'). Palawija selalu 'LTT'."""
    if komoditas != "Padi":
        return "LTT"
    j = re.sub(r"\s+", " ", str(jenis or "").strip())
    j = re.sub(r"(?i)rehap", "Rehab", j)
    if not j or j.upper() in ("LTT", "PADI"):
        return "LTT Reguler"
    return j

def parse_tgl(v):
    if isinstance(v, dt.datetime):
        return v.strftime("%Y-%m-%d %H:%M:%S+07")
    if isinstance(v, dt.date):
        return v.strftime("%Y-%m-%d 00:00:00+07")
    s = str(v or "").strip()
    
    bln_map = {
        "januari": 1, "january": 1, "jan": 1,
        "februari": 2, "february": 2, "feb": 2,
        "maret": 3, "march": 3, "mar": 3,
        "april": 4, "apr": 4,
        "mei": 5, "may": 5,
        "juni": 6, "june": 6, "jun": 6,
        "juli": 7, "july": 7, "jul": 7,
        "agustus": 8, "august": 8, "agu": 8, "ags": 8, "agt": 8, "aug": 8,
        "september": 9, "sept": 9, "sep": 9,
        "oktober": 10, "october": 10, "okt": 10, "oct": 10,
        "november": 11, "nov": 11,
        "desember": 12, "december": 12, "des": 12, "dec": 12
    }
    # Jam opsional di belakang tanggal, mis. "November 3, 2026 06:50:10"
    jam_m = re.search(r"(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$", s)
    jam = f"{int(jam_m.group(1)):02d}:{jam_m.group(2)}:{jam_m.group(3) or '00'}" if jam_m else "00:00:00"

    m = re.match(r"^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})", s)
    if m:
        b_num = bln_map.get(m.group(1).lower())
        if not b_num:
            return None                      # nama bulan tak dikenal → dilaporkan, bukan ditebak
        return f"{int(m.group(3)):04d}-{b_num:02d}-{int(m.group(2)):02d} {jam}+07"

    m2 = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})", s)
    if m2:
        a, b, y = int(m2.group(1)), int(m2.group(2)), int(m2.group(3))
        hari, bulan = (b, a) if b > 12 else (a, b)   # sama dengan parseTanggalEPusluh_ lama
        return f"{y:04d}-{bulan:02d}-{hari:02d} {jam}+07"

    m3 = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m3:
        return f"{m3.group(0)} {jam}+07"

    return None                              # tidak terbaca → dilaporkan

def main():
    print(f"Membaca {EXCEL_FILE}...")
    wb = openpyxl.load_workbook(EXCEL_FILE, data_only=True)

    # 1. WILAYAH (Data_Geografi)
    print("1. Memproses Wilayah (Data_Geografi)...")
    ws_geo = wb["Data_Geografi"]
    rows_geo = list(ws_geo.iter_rows(values_only=True))
    header_geo = [norm(h) for h in rows_geo[0]]
    kecamatan_set = {}
    desa_list = []
    
    kec_id_map = {}
    kec_counter = 1
    desa_id_map = {}
    desa_counter = 1

    for r in rows_geo[1:]:
        if not any(r): continue
        d = dict(zip(header_geo, r))
        kec = norm(d.get("Nama_Kecamatan"))
        desa = norm(d.get("Nama_Desa"))
        id_kec_kemendagri = str(int(d.get("ID_Kecamatan"))) if d.get("ID_Kecamatan") else None
        id_desa_kemendagri = str(int(d.get("ID_Desa"))) if d.get("ID_Desa") else None
        if not kec or not desa: continue
        
        if kec not in kec_id_map:
            kec_id_map[kec] = kec_counter
            kecamatan_set[kec] = {
                "id": kec_counter,
                "kode": id_kec_kemendagri,
                "nama": kec
            }
            kec_counter += 1
            
        k_id = kec_id_map[kec]
        key_kd = f"{kec}___{desa}".lower()
        if key_kd not in desa_id_map:
            desa_id_map[key_kd] = desa_counter
            desa_list.append({
                "id": desa_counter,
                "kode": id_desa_kemendagri,
                "kecamatan_id": k_id,
                "nama": desa
            })
            desa_counter += 1

    kec_id_lower = {k.lower(): v for k, v in kec_id_map.items()}
    dibuang = defaultdict(int)   # alasan → jumlah baris yang tidak ikut / tidak cocok

    # 2. PENGGUNA (Data_User)
    print("2. Memproses Pengguna (Data_User)...")
    ws_user = wb["Data_User"]
    rows_user = list(ws_user.iter_rows(values_only=True))
    header_user = [norm(h) for h in rows_user[0]]
    user_list = []

    for r in rows_user[1:]:
        if not any(r): continue
        d = dict(zip(header_user, r))
        id_lama = norm(d.get("ID_User"))
        nama = norm(d.get("Nama_Penyuluh"))
        nip = norm(d.get("NIP"))
        role = norm(d.get("Role"))
        # Sheet Data_User memakai kolom "Kecamatan" (bukan "Nama_Kecamatan")
        kec = norm(d.get("Kecamatan") or d.get("Nama_Kecamatan"))
        desa_binaan_raw = norm(d.get("Desa_Binaan"))
        aktif = norm(d.get("Status_Aktif")).lower() == "aktif"
        wa = norm(d.get("WhatsApp"))

        kec_id = kec_id_lower.get(kec.lower())
        if kec and not kec_id and role in ("Penyuluh", "Admin_BPP"):
            dibuang["pengguna: kecamatan tidak cocok"] += 1

        desa_binaan_ids = []
        if desa_binaan_raw and desa_binaan_raw != "-":
            for dn in re.split(r"[,;]", desa_binaan_raw):
                dn_clean = norm(dn)
                if not dn_clean:
                    continue
                k_key = f"{kec}___{dn_clean}".lower()
                if k_key in desa_id_map:
                    if desa_id_map[k_key] not in desa_binaan_ids:
                        desa_binaan_ids.append(desa_id_map[k_key])
                else:
                    dibuang[f"desa binaan tidak cocok: {kec} / {dn_clean}"] += 1

        user_list.append({
            "id_lama": id_lama,
            "nama": nama,
            "nip": nip,
            "role": role,
            "kecamatan_id": kec_id,
            "desa_binaan_ids": desa_binaan_ids,
            "aktif": aktif,
            "whatsapp": wa if wa and wa != "-" else None
        })

    # 3. LAPORAN LTT (Padi & Palawija seluruh sheet)
    print("3. Memproses Laporan LTT (14 Sheet)...")
    laporan_sheets = [
        ("Data_LTT_2026_10", "palawija"),
        ("Data_LTT_Padi_2026_10", "padi"),
        ("Data_LTT_2026_09", "palawija"),
        ("Data_LTT_Padi_2026_09", "padi"),
        ("Data_LTT_2026_08", "palawija"),
        ("Data_LTT_Padi_2026_08", "padi"),
        ("Data_LTT_2026_07", "palawija"),
        ("Data_LTT_Padi_2026_07", "padi"),
        ("Data_LTT_2026_06", "palawija"),
        ("Data_LTT_Padi_2026_06", "padi"),
        ("Data_LTT_Padi_2026_04", "padi"),
        ("Data_LTT_Padi_2026_05", "padi"),
        ("Data_LTT_Padi", "padi"),
        ("Data_LTT", "palawija"),
    ]

    laporan_list = []
    seen_ids = set()

    for s_name, jenis_sheet in laporan_sheets:
        if s_name not in wb.sheetnames: continue
        ws = wb[s_name]
        rows = list(ws.iter_rows(values_only=True))
        if not rows or len(rows) < 2: continue
        header = [norm(h) for h in rows[0]]

        for r in rows[1:]:
            if not any(r): continue
            d = dict(zip(header, r))
            id_laporan = norm(d.get("ID_Laporan"))
            if not id_laporan:
                dibuang["laporan: ID kosong"] += 1
                continue
            if id_laporan in seen_ids:
                dibuang["laporan: ID dobel"] += 1
                continue
            seen_ids.add(id_laporan)

            kec = norm(d.get("Nama_Kecamatan") or d.get("Kecamatan"))
            desa = norm(d.get("Nama_Desa") or d.get("Desa"))
            k_key = f"{kec}___{desa}".lower()
            desa_id = desa_id_map.get(k_key)
            if not desa_id:
                dibuang["laporan: desa tidak cocok"] += 1
                continue

            komoditas_raw = norm(d.get("Komoditas")).upper()
            if "JAGUNG" in komoditas_raw:
                komoditas = "Jagung"
            elif "UBI" in komoditas_raw:
                komoditas = "Ubi Kayu"
            else:
                komoditas = "Padi"

            tgl_lapor = parse_tgl(d.get("Waktu_Lapor"))
            if not tgl_lapor:
                dibuang["laporan: tanggal tidak terbaca"] += 1
                continue
            pelapor = norm(d.get("Pelapor"))
            nip = norm(d.get("NIP_Pelapor") or "")
            metode = norm(d.get("Metode_Penanaman") or "")

            laporan_list.append({
                "id_lama": id_laporan,
                "tanggal_lapor": tgl_lapor,
                "nama_pelapor": pelapor if pelapor else None,
                "nip_pelapor": nip if nip else None,
                "desa_id": desa_id,
                "komoditas": komoditas,
                "jenis_ltt": norm_jenis(d.get("Jenis_LTT"), komoditas),
                "target_tanam": parse_num(d.get("Target_Tanam_Bln_Ini")),
                "target_panen": parse_num(d.get("Target_Panen_Bln_Ini")),
                "luas_bera": parse_num(d.get("Luas_Lahan_Bera")),
                "realisasi_olah": parse_num(d.get("Realisasi_Olah_Lahan")),
                "realisasi_tanam": parse_num(d.get("Realisasi_Luas_Tanam")),
                "realisasi_panen": parse_num(d.get("Realisasi_Luas_Panen")),
                "metode_penanaman": "PM AAS" if "AAS" in metode.upper() else ("Regular" if "REG" in metode.upper() else None),
                "keterangan": norm(d.get("Keterangan") or "") or None,
                "sumber": "epusluh" if jenis_sheet == "padi" else "manual"
            })

    # 4. TARGET DESA (Padi, Jagung, Ubi Kayu)
    print("4. Memproses Target Desa...")
    target_desa_list = []
    
    # Target Padi
    if "Target_Desa_Padi" in wb.sheetnames:
        ws_tp = wb["Target_Desa_Padi"]
        rows_tp = list(ws_tp.iter_rows(values_only=True))
        h_tp = [norm(h) for h in rows_tp[0]]
        for r in rows_tp[1:]:
            if not any(r): continue
            d = dict(zip(h_tp, r))
            kec = norm(d.get("Nama_Kecamatan"))
            desa = norm(d.get("Nama_Desa"))
            k_key = f"{kec}___{desa}".lower()
            desa_id = desa_id_map.get(k_key)
            if not desa_id: continue
            
            bln = int(float(d.get("Bulan") or 1))
            # Rincian per jenis (kolom tanam & panen per jenis di sheet lama)
            rincian = []
            for jenis, k_tanam, k_panen in (
                ("LTT Reguler", "LTT_Reguler", "Panen_Reguler"),
                ("LTT Padi Gogo", "Padi_Gogo", "Panen_Padi_Gogo"),
                ("LTT Oplah 2024", "Oplah_2024", "Panen_Oplah_2024"),
                ("LTT Oplah 2025", "Oplah_2025", "Panen_Oplah_2025"),
                ("LTT CSR", "CSR", "Panen_CSR"),
                ("LTT Rehab Bencana", "Rehab_Bencana", "Panen_Rehab_Bencana"),
            ):
                t, p = parse_num(d.get(k_tanam)), parse_num(d.get(k_panen))
                if t > 0 or p > 0:
                    rincian.append({"jenis_ltt": jenis, "target_tanam": t, "target_panen": p})
            target_desa_list.append({
                "bulan": bln,
                "desa_id": desa_id,
                "komoditas": "Padi",
                "target_tanam": parse_num(d.get("Total_Target_Tanam")),
                "target_panen": parse_num(d.get("Total_Target_Panen")),
                "ip_eksisting": parse_num(d.get("IP_Eksisting")),
                "luas_baku": parse_num(d.get("Luas_Baku_Sawah")),
                "luas_standing_crop": parse_num(d.get("Luas_Standing_Crop")),
                "rincian": rincian,
            })

    # Target Jagung & Ubi Kayu
    for sheet_t, komoditas_t in [("Target_Desa_Jagung", "Jagung"), ("Target_Desa_UbiKayu", "Ubi Kayu")]:
        if sheet_t in wb.sheetnames:
            ws_t = wb[sheet_t]
            rows_t = list(ws_t.iter_rows(values_only=True))
            h_t = [norm(h) for h in rows_t[0]]
            for r in rows_t[1:]:
                if not any(r): continue
                d = dict(zip(h_t, r))
                kec = norm(d.get("Nama_Kecamatan"))
                desa = norm(d.get("Nama_Desa"))
                k_key = f"{kec}___{desa}".lower()
                desa_id = desa_id_map.get(k_key)
                if not desa_id: continue
                
                bln = int(float(d.get("Bulan") or 1))
                target_desa_list.append({
                    "bulan": bln,
                    "desa_id": desa_id,
                    "komoditas": komoditas_t,
                    "target_tanam": parse_num(d.get("Total_Target_Tanam")),
                    "target_panen": parse_num(d.get("Total_Target_Panen")),
                    "ip_eksisting": parse_num(d.get("IP_Eksisting")),
                    "luas_baku": parse_num(d.get("Luas_Baku")),
                    "luas_standing_crop": 0.0
                })

    # 5. TARGET KECAMATAN
    print("5. Memproses Target Kecamatan...")
    target_kec_list = []
    if "Target_Kecamatan" in wb.sheetnames:
        ws_tk = wb["Target_Kecamatan"]
        rows_tk = list(ws_tk.iter_rows(values_only=True))
        h_tk = [norm(h) for h in rows_tk[0]]
        for r in rows_tk[1:]:
            if not any(r): continue
            d = dict(zip(h_tk, r))
            kec = norm(d.get("Nama_Kecamatan"))
            kec_id = kec_id_map.get(kec)
            if not kec_id: continue
            
            bln = int(float(d.get("Bulan") or 1))
            kom = norm(d.get("Komoditas"))
            if "JAGUNG" in kom.upper(): kom = "Jagung"
            elif "UBI" in kom.upper(): kom = "Ubi Kayu"
            else: kom = "Padi"

            target_kec_list.append({
                "bulan": bln,
                "kecamatan_id": kec_id,
                "komoditas": kom,
                "target_tanam": parse_num(d.get("Total_Target_Tanam")),
                "target_panen": parse_num(d.get("Total_Target_Panen"))
            })

    # Target provinsi per kecamatan MENIMPA target tanam hasil jumlah desa (aturan lama,
    # logika-bisnis §17a). Di sistem baru angka kecamatan diisi Admin BPP.
    if "Target_Kecamatan_Provinsi" in wb.sheetnames:
        idx_tk = {(t["bulan"], t["kecamatan_id"], t["komoditas"]): t for t in target_kec_list}
        rows_tp = list(wb["Target_Kecamatan_Provinsi"].iter_rows(values_only=True))
        h_tp = [norm(h) for h in rows_tp[0]]
        for r in rows_tp[1:]:
            if not any(r): continue
            d = dict(zip(h_tp, r))
            kec_id = kec_id_map.get(norm(d.get("Nama_Kecamatan")))
            if not kec_id:
                dibuang["target provinsi: kecamatan tidak cocok"] += 1
                continue
            kom = norm(d.get("Komoditas"))
            kom = "Jagung" if "JAGUNG" in kom.upper() else ("Ubi Kayu" if "UBI" in kom.upper() else "Padi")
            kunci = (int(float(d.get("Bulan") or 1)), kec_id, kom)
            tanam = parse_num(d.get("Total_Target_Tanam"))
            if kunci in idx_tk:
                idx_tk[kunci]["target_tanam"] = tanam
            else:
                baris = {"bulan": kunci[0], "kecamatan_id": kec_id, "komoditas": kom,
                         "target_tanam": tanam, "target_panen": 0.0}
                target_kec_list.append(baris)
                idx_tk[kunci] = baris

    # 6. PRODUKTIVITAS & SARANA DESA
    print("6. Memproses Produktivitas & Sarana Desa...")
    produktivitas_list = []
    bln_cols = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
    if "Data_Produktivitas_Desa" in wb.sheetnames:
        ws_prod = wb["Data_Produktivitas_Desa"]
        rows_prod = list(ws_prod.iter_rows(values_only=True))
        h_prod = [norm(h) for h in rows_prod[0]]
        for r in rows_prod[1:]:
            if not any(r): continue
            d = dict(zip(h_prod, r))
            kec = norm(d.get("Kecamatan"))
            desa = norm(d.get("Desa"))
            k_key = f"{kec}___{desa}".lower()
            desa_id = desa_id_map.get(k_key)
            if not desa_id: continue
            
            kom = norm(d.get("Komoditas"))
            if "JAGUNG" in kom.upper(): kom = "Jagung"
            elif "UBI" in kom.upper(): kom = "Ubi Kayu"
            else: kom = "Padi"

            tahun = int(float(d.get("Tahun") or 0))
            if not 2000 <= tahun <= 2100:
                dibuang["produktivitas: tahun tidak valid"] += 1
                continue
            for idx, b_name in enumerate(bln_cols, start=1):
                nilai = parse_num(d.get(b_name))
                if nilai > 0:                  # 0 / kosong = belum diisi (aturan lama)
                    produktivitas_list.append({
                        "tahun": tahun,
                        "bulan": idx,
                        "desa_id": desa_id,
                        "komoditas": kom,
                        "nilai": nilai
                    })

    sarana_list = []
    if "Data_Sarana_Desa" in wb.sheetnames:
        ws_sarana = wb["Data_Sarana_Desa"]
        rows_sarana = list(ws_sarana.iter_rows(values_only=True))
        h_sarana = [norm(h) for h in rows_sarana[0]]
        for r in rows_sarana[1:]:
            if not any(r): continue
            d = dict(zip(h_sarana, r))
            kec = norm(d.get("Kecamatan"))
            desa = norm(d.get("Desa"))
            k_key = f"{kec}___{desa}".lower()
            desa_id = desa_id_map.get(k_key)
            if not desa_id: continue
            
            sarana_list.append({
                "desa_id": desa_id,
                "gudang_gabah": int(parse_num(d.get("Gudang_Gabah"))),
                "embung": int(parse_num(d.get("Embung"))),
                "lantai_jemur": int(parse_num(d.get("Lantai_Jemur"))),
                "mesin_pengering": int(parse_num(d.get("Mesin_Pengering")))
            })

    # Simpan Seluruh JSON Bersih di Disk Lokal
    with open(os.path.join(OUTPUT_DIR, "kecamatan.json"), "w", encoding="utf-8") as f:
        json.dump(list(kecamatan_set.values()), f, indent=2, ensure_ascii=False)
    with open(os.path.join(OUTPUT_DIR, "desa.json"), "w", encoding="utf-8") as f:
        json.dump(desa_list, f, indent=2, ensure_ascii=False)
    with open(os.path.join(OUTPUT_DIR, "pengguna.json"), "w", encoding="utf-8") as f:
        json.dump(user_list, f, indent=2, ensure_ascii=False)
    with open(os.path.join(OUTPUT_DIR, "laporan_ltt.json"), "w", encoding="utf-8") as f:
        json.dump(laporan_list, f, indent=2, ensure_ascii=False)
    with open(os.path.join(OUTPUT_DIR, "target_desa.json"), "w", encoding="utf-8") as f:
        json.dump(target_desa_list, f, indent=2, ensure_ascii=False)
    with open(os.path.join(OUTPUT_DIR, "target_kecamatan.json"), "w", encoding="utf-8") as f:
        json.dump(target_kec_list, f, indent=2, ensure_ascii=False)
    with open(os.path.join(OUTPUT_DIR, "produktivitas_desa.json"), "w", encoding="utf-8") as f:
        json.dump(produktivitas_list, f, indent=2, ensure_ascii=False)
    with open(os.path.join(OUTPUT_DIR, "sarana_desa.json"), "w", encoding="utf-8") as f:
        json.dump(sarana_list, f, indent=2, ensure_ascii=False)

    print(f"\n==========================================")
    print(f"  HASIL EKSTRAKSI LOKAL (BERSIH 100%)")
    print(f"==========================================")
    print(f"- Kecamatan        : {len(kecamatan_set)} kecamatan")
    print(f"- Desa             : {len(desa_list)} desa")
    print(f"- Pengguna         : {len(user_list)} orang")
    print(f"- Laporan LTT      : {len(laporan_list)} baris")
    print(f"- Target Desa      : {len(target_desa_list)} baris")
    print(f"- Target Kecamatan : {len(target_kec_list)} baris")
    print(f"- Produktivitas    : {len(produktivitas_list)} baris")
    print(f"- Sarana Desa      : {len(sarana_list)} baris")
    print(f"- Baris dibuang    : {sum(dibuang.values())}" + ("" if not dibuang else " → " + "; ".join(f"{k} {v}" for k, v in sorted(dibuang.items()))))
    print(f"Lokasi file bersih : {OUTPUT_DIR}/")
    print(f"Catatan            : TIDAK ada data yang dikirim/dimasukkan ke Supabase.")
    print(f"==========================================")

if __name__ == "__main__":
    main()
