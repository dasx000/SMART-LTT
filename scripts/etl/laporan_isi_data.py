"""
Laporan isi data spreadsheet lama (Fase 0, keputusan C).
Membaca ekspor .xlsx, menulis ringkasan AGREGAT ke docs/laporan-isi-data.md.
TIDAK menulis nama, NIP, password, atau isi baris apa pun — hanya hitungan & nilai kategori.

Pakai:  python scripts/etl/laporan_isi_data.py "MASTER DATABASE LTT.xlsx"
"""
import re
import sys
import datetime as dt
from collections import Counter, defaultdict

import openpyxl

SUMBER = sys.argv[1] if len(sys.argv) > 1 else "MASTER DATABASE LTT.xlsx"
KELUARAN = "docs/laporan-isi-data.md"

ABAIKAN = {"Copy of Data_User", "Copy of Data_LTT", "Copy of Ringkasan_Harian", "Target",
           "Ringkasan_Harian", "Data_Produktivitas_Kec_Arsip"}

wb = openpyxl.load_workbook(SUMBER, read_only=True, data_only=True)


def baca(nama):
    ws = wb[nama]
    it = ws.iter_rows(values_only=True)
    header = [str(h).strip() if h is not None else "" for h in next(it)]
    rows = []
    for r in it:
        if any(c not in (None, "") for c in r):
            rows.append(dict(zip(header, r)))
    return header, rows


def norm(s):
    return re.sub(r"\s+", " ", str(s or "").strip().lower())


def jenis_tanggal(v):
    if isinstance(v, dt.datetime):
        return "Date"
    s = str(v or "").strip()
    if not s:
        return "kosong"
    if re.match(r"^\d{1,2}[/-]\d{1,2}[/-]\d{4}", s):
        return "teks a/b/yyyy"
    if re.match(r"^\d{4}-\d{2}-\d{2}", s):
        return "teks ISO"
    if re.match(r"^[A-Za-z]+\s+\d{1,2},\s*\d{4}", s):
        return "teks 'Bulan d, yyyy'"
    return "lain"


def angka_buruk(v):
    if v in (None, ""):
        return False
    if isinstance(v, (int, float)):
        return v < 0
    s = str(v).strip().replace(",", ".")
    try:
        return float(s) < 0
    except ValueError:
        return True


out = []
p = out.append
p("# Laporan Isi Data Spreadsheet Lama\n")
p(f"> Dibuat otomatis oleh `scripts/etl/laporan_isi_data.py` dari `{SUMBER}` pada "
  f"{dt.datetime.now():%d %b %Y %H:%M}. Hanya angka agregat — tidak ada data pribadi.\n")

# ---------------- Master wilayah ----------------
_, geo = baca("Data_Geografi")
kec_geo = Counter(norm(r["Nama_Kecamatan"]) for r in geo)
desa_geo = {(norm(r["Nama_Kecamatan"]), norm(r["Nama_Desa"])) for r in geo}
desa_saja = Counter(norm(r["Nama_Desa"]) for r in geo)
p("## 1. Wilayah (`Data_Geografi`)\n")
p(f"- {len(kec_geo)} kecamatan, {len(geo)} baris desa, {len(desa_geo)} pasangan kecamatan+desa unik.")
kembar = [d for d, n in desa_saja.items() if n > 1]
p(f"- Nama desa yang sama di lebih dari satu kecamatan: **{len(kembar)}** "
  "(karena itu desa selalu dicocokkan bersama kecamatannya).")
p("- Jumlah desa per kecamatan: " + ", ".join(f"{k.title()} {n}" for k, n in sorted(kec_geo.items())) + "\n")

# ---------------- User ----------------
hdr, users = baca("Data_User")
p("## 2. Pengguna (`Data_User`)\n")
p(f"- {len(users)} baris. Kolom: {', '.join(hdr)}.")
p("- Role: " + ", ".join(f"{k or '(kosong)'} {n}" for k, n in Counter(str(u.get('Role') or '').strip() for u in users).most_common()))
p("- Status: " + ", ".join(f"{k or '(kosong)'} {n}" for k, n in Counter(str(u.get('Status_Aktif') or '').strip() for u in users).most_common()))
nips = Counter(str(u.get("NIP") or "").strip() for u in users)
p(f"- NIP kosong: {nips.get('', 0)}; NIP dobel: {sum(1 for k, n in nips.items() if k and n > 1)}.")
p(f"- NIP berisi selain angka: {sum(1 for k in nips if k and not k.isdigit())}.")
pin_pendek = sum(1 for u in users if len(str(u.get('PIN') or '')) < 6)
p(f"- Password (`PIN`) < 6 karakter: **{pin_pendek}** (Supabase Auth mensyaratkan min. 6 → perlu password sementara).")
kec_user_tak_cocok = Counter()
desa_tak_cocok = 0
total_desa_binaan = 0
for u in users:
    k = norm(u.get("Kecamatan"))
    if k and k not in kec_geo:
        kec_user_tak_cocok[k] += 1
    for d in str(u.get("Desa_Binaan") or "").replace(";", ",").split(","):
        d = norm(d)
        if not d:
            continue
        total_desa_binaan += 1
        if (k, d) not in desa_geo:
            desa_tak_cocok += 1
p(f"- Kecamatan user yang tidak ada di `Data_Geografi`: {sum(kec_user_tak_cocok.values())} "
  f"({', '.join(kec_user_tak_cocok) or '-'}).")
p(f"- Desa binaan: {total_desa_binaan} entri, **{desa_tak_cocok}** tidak cocok dengan kecamatan+desa di `Data_Geografi`.")
p(f"- Kolom WhatsApp terisi: {sum(1 for u in users if str(u.get('WhatsApp') or '').strip())}.\n")

# ---------------- Laporan LTT ----------------
p("## 3. Laporan LTT\n")
p("| Sheet | Baris | Komoditas | Format tanggal | Desa tak cocok | Angka negatif/bukan angka |")
p("|---|---|---|---|---|---|")
status_all = Counter(); jenis_padi = Counter(); jenis_pal = Counter(); metode = Counter()
bulan_rows = defaultdict(int); id_dobel = Counter(); kom_all = Counter()
for ws in wb.worksheets:
    n = ws.title
    if not n.startswith("Data_LTT") or n in ABAIKAN:
        continue
    hdr, rows = baca(n)
    kk = "Kecamatan" if "Kecamatan" in hdr else "Nama_Kecamatan"
    kd = "Desa" if "Desa" in hdr else "Nama_Desa"
    padi = "Padi" in n
    kom = Counter(str(r.get("Komoditas") or "").strip() for r in rows)
    kom_all.update(kom)
    fmt = Counter(jenis_tanggal(r.get("Waktu_Lapor")) for r in rows)
    tak = sum(1 for r in rows if (norm(r.get(kk)), norm(r.get(kd))) not in desa_geo)
    buruk = sum(1 for r in rows for c in ("Luas_Lahan_Bera", "Realisasi_Olah_Lahan",
                                          "Realisasi_Luas_Tanam", "Realisasi_Luas_Panen")
                if angka_buruk(r.get(c)))
    for r in rows:
        status_all[str(r.get("Status_Verifikasi") or "").strip()] += 1
        id_dobel[str(r.get("ID_Laporan") or "")] += 1
        (jenis_padi if padi else jenis_pal)[str(r.get("Jenis_LTT") or "").strip()] += 1
        if padi:
            metode[str(r.get("Metode_Penanaman") or "").strip()] += 1
    bulan_rows[n] = len(rows)
    p(f"| `{n}` | {len(rows)} | {', '.join(f'{k or chr(8212)} {v}' for k, v in kom.most_common())} | "
      f"{', '.join(f'{k} {v}' for k, v in fmt.most_common())} | {tak} | {buruk} |")
p("")
p(f"- **Total baris laporan:** {sum(bulan_rows.values())}.")
p(f"- ID laporan dobel (lintas sheet): {sum(1 for k, v in id_dobel.items() if k and v > 1)}; ID kosong: {id_dobel.get('', 0)}.")
p("- Komoditas (semua sheet): " + ", ".join(f"`{k or '(kosong)'}` {v}" for k, v in kom_all.most_common()))
p("- Status verifikasi: " + ", ".join(f"`{k or '(kosong)'}` {v}" for k, v in status_all.most_common()) +
  " → **tidak dimigrasi** (fitur verifikasi dihapus).")
p("- Jenis LTT padi: " + ", ".join(f"`{k or '(kosong)'}` {v}" for k, v in jenis_padi.most_common()))
p("- Jenis LTT palawija: " + ", ".join(f"`{k or '(kosong)'}` {v}" for k, v in jenis_pal.most_common()))
p("- Metode penanaman (padi): " + ", ".join(f"`{k or '(kosong)'}` {v}" for k, v in metode.most_common(15)) + "\n")

# ---------------- Target ----------------
p("## 4. Target\n")
for n, kd in (("Target_Desa_Padi", "Nama_Desa"), ("Target_Desa_Jagung", "Nama_Desa"), ("Target_Desa_UbiKayu", "Nama_Desa")):
    _, rows = baca(n)
    bulan = Counter(str(r.get("Bulan")) for r in rows)
    kunci = Counter((str(r.get("Bulan")), norm(r.get("Nama_Kecamatan")), norm(r.get(kd))) for r in rows)
    tak = sum(1 for r in rows if (norm(r.get("Nama_Kecamatan")), norm(r.get(kd))) not in desa_geo)
    dobel = sum(1 for v in kunci.values() if v > 1)
    p(f"- `{n}`: {len(rows)} baris; bulan: {', '.join(f'{k}:{v}' for k, v in sorted(bulan.items(), key=lambda x: (len(x[0]), x[0])))}; "
      f"desa tak cocok {tak}; kunci (bulan+kec+desa) dobel {dobel}.")
    if n == "Target_Desa_Padi":
        selisih = 0
        for r in rows:
            try:
                jml = sum(float(r.get(c) or 0) for c in ("LTT_Reguler", "Padi_Gogo", "Oplah_2024", "Oplah_2025", "CSR", "Rehab_Bencana"))
                if abs(jml - float(r.get("Total_Target_Tanam") or 0)) > 0.01:
                    selisih += 1
            except (TypeError, ValueError):
                selisih += 1
        p(f"  - Baris yang Total_Target_Tanam ≠ jumlah rincian per jenis: **{selisih}**.")
for n in ("Target_Kecamatan", "Target_Kecamatan_Provinsi", "Target_Kabupaten", "Target_PmAas_Kabupaten"):
    _, rows = baca(n)
    p(f"- `{n}`: {len(rows)} baris; bulan: {', '.join(sorted({str(r.get('Bulan')) for r in rows}, key=lambda x: (len(x), x)))}"
      + (f"; komoditas: {', '.join(sorted({str(r.get('Komoditas')) for r in rows}))}" if rows and "Komoditas" in rows[0] else "") + ".")
p("")

# ---------------- Lain-lain ----------------
p("## 5. Lain-lain\n")
for n in ("Jenis_LTT", "Data_Produktivitas_Desa", "Data_Sarana_Desa", "Logs_Sinkron"):
    _, rows = baca(n)
    extra = ""
    if n == "Jenis_LTT":
        extra = "; nilai: " + ", ".join(f"`{r.get('Nama_Jenis_LTT')}` ({r.get('Komoditas')})" for r in rows)
    p(f"- `{n}`: {len(rows)} baris{extra}.")
p("- Tidak dimigrasi: " + ", ".join(f"`{x}`" for x in sorted(ABAIKAN)) + ".")

with open(KELUARAN, "w", encoding="utf-8") as f:
    f.write("\n".join(out) + "\n")
print(f"Ditulis: {KELUARAN}")
