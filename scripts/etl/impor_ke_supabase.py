"""
impor_ke_supabase.py — impor data spreadsheet lama ke Supabase (schema ltt + core).

PRASYARAT
  1. supabase/migrations/0001 s.d. 0004 sudah dijalankan di SQL Editor.
  2. python scripts/etl/transform_data.py   (menghasilkan scripts/etl/data_bersih/*.json)
  3. .env.local berisi NEXT_PUBLIC_SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY.

PAKAI
  python scripts/etl/impor_ke_supabase.py                      # SIMULASI saja (default, tidak menulis apa pun)
  python scripts/etl/impor_ke_supabase.py --jalankan           # benar-benar menulis
  python scripts/etl/impor_ke_supabase.py --jalankan --sampai 2026-11-30
      --sampai : laporan dengan tanggal >= nilai ini DILEWATI (default: hari ini WIB,
                 karena data hari berjalan belum lengkap)

ATURAN AKUN (project Supabase dipakai bersama aplikasi lain)
  - NIP sudah ada di core.profiles  → email tetap. Keputusan 28 (b): PASSWORD DI-RESET ke PIN LTT lama
    (berlaku juga untuk aplikasi lain di project bersama), wajib_ganti_password = true.
    Reset HANYA sekali: saat akun belum punya membership 'ltt'. Jalankan ulang skrip tidak akan
    menimpa password yang sudah diganti user.
  - NIP belum ada                   → akun baru: email  <nip>@AUTH_EMAIL_DOMAIN,
    password = PIN lama orang itu (dibaca dari Excel saat impor, TIDAK disimpan ke file),
    wajib_ganti_password = true.
  - Tidak ada password seragam / default di skrip ini.

AMAN DIJALANKAN ULANG
  Semua tabel di-upsert pada kunci unik (id, id_lama, bulan+desa+komoditas, dst.), jadi skrip yang
  sama dipakai lagi saat cutover tanpa membuat duplikat.
"""

import argparse
import datetime as dt
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = Path(__file__).resolve().parent / "data_bersih"
EXCEL = ROOT / "MASTER DATABASE LTT.xlsx"
BATCH = 500
WIB = dt.timezone(dt.timedelta(hours=7))

# ─── Argumen & env ─────────────────────────────────────────────────────────────
ap = argparse.ArgumentParser()
ap.add_argument("--jalankan", action="store_true", help="benar-benar menulis ke Supabase")
ap.add_argument("--sampai", help="lewati laporan dengan tanggal >= YYYY-MM-DD (default: hari ini WIB)")
ARG = ap.parse_args()
TULIS = ARG.jalankan
BATAS = dt.date.fromisoformat(ARG.sampai) if ARG.sampai else dt.datetime.now(WIB).date()


def baca_env(path: Path) -> dict:
    env = {}
    for baris in path.read_text(encoding="utf-8").splitlines():
        baris = baris.strip()
        if baris and not baris.startswith("#") and "=" in baris:
            k, v = baris.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


ENV = baca_env(ROOT / ".env.local")
URL = ENV.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
KEY = ENV.get("SUPABASE_SERVICE_ROLE_KEY", "")
DOMAIN = ENV.get("AUTH_EMAIL_DOMAIN", "smartltt.local")
if not URL or not KEY:
    sys.exit("[ERROR] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY kosong di .env.local")


# ─── HTTP ke PostgREST / Auth ──────────────────────────────────────────────────
def http(metode: str, path: str, *, skema: str = "ltt", body=None, prefer: str = "", params: dict | None = None):
    url = f"{URL}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if path.startswith("/rest/"):
        h["Accept-Profile" if metode == "GET" else "Content-Profile"] = skema
    if prefer:
        h["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=h, method=metode)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            isi = r.read().decode()
            return json.loads(isi) if isi else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} {metode} {path}: {e.read().decode(errors='replace')[:400]}") from None


def ambil(tabel: str, select: str, skema: str = "ltt", **filter_) -> list:
    hasil, dari = [], 0
    while True:
        p = {"select": select, "offset": dari, "limit": 1000, **filter_}
        isi = http("GET", f"/rest/v1/{tabel}", skema=skema, params=p) or []
        hasil += isi
        if len(isi) < 1000:
            return hasil
        dari += 1000


def upsert(label: str, tabel: str, baris: list, konflik: str, skema: str = "ltt", kembalikan: bool = False) -> list:
    if not baris:
        print(f"  - {label}: tidak ada data")
        return []
    if not TULIS:
        print(f"  - {label}: {len(baris)} baris (simulasi, tidak ditulis)")
        return []
    keluar = []
    for i in range(0, len(baris), BATCH):
        isi = http(
            "POST", f"/rest/v1/{tabel}", skema=skema, body=baris[i:i + BATCH],
            params={"on_conflict": konflik},
            prefer="resolution=merge-duplicates," + ("return=representation" if kembalikan else "return=minimal"),
        )
        if kembalikan:
            keluar += isi or []
        print(f"  - {label}: {min(i + BATCH, len(baris))}/{len(baris)}", end="\r")
        time.sleep(0.05)
    print(f"  - {label}: {len(baris)} baris ✓" + " " * 20)
    return keluar


def muat(nama: str) -> list:
    p = DATA / nama
    if not p.exists():
        sys.exit(f"[ERROR] {p} tidak ada. Jalankan dulu: python scripts/etl/transform_data.py")
    return json.loads(p.read_text(encoding="utf-8"))


def pin_lama() -> dict:
    """ID_User → PIN dari Excel. Hanya di memori, tidak ditulis ke disk / log."""
    import openpyxl
    wb = openpyxl.load_workbook(EXCEL, read_only=True, data_only=True)
    it = wb["Data_User"].iter_rows(values_only=True)
    h = [str(x).strip() if x else "" for x in next(it)]
    i_id, i_pin = h.index("ID_User"), h.index("PIN")
    return {str(r[i_id]).strip(): str(r[i_pin]).strip() for r in it if r and r[i_id]}


def nip_bersih(v) -> str:
    return str(v or "").split(".")[0].strip()


# ─── Langkah impor ─────────────────────────────────────────────────────────────
def impor_wilayah():
    print("\n[1] Wilayah")
    upsert("ltt.kecamatan", "kecamatan", [{"id": r["id"], "kode": r["kode"], "nama": r["nama"]} for r in muat("kecamatan.json")], "id")
    upsert("ltt.desa", "desa", [{"id": r["id"], "kode": r.get("kode"), "kecamatan_id": r["kecamatan_id"], "nama": r["nama"]} for r in muat("desa.json")], "id")
    if TULIS:
        http("POST", "/rest/v1/rpc/setel_ulang_sequence", body={})


def impor_pengguna() -> dict:
    print("\n[2] Pengguna")
    pengguna = muat("pengguna.json")
    profil = ambil("profiles", "id,nip", skema="core")
    nip_ke_id = {nip_bersih(p["nip"]): p["id"] for p in profil if p.get("nip")}
    sudah_ltt = {m["user_id"] for m in ambil("memberships", "user_id", skema="core", app_slug="eq.ltt")}

    lama = [u for u in pengguna if nip_bersih(u["nip"]) in nip_ke_id]
    baru = [u for u in pengguna if nip_bersih(u["nip"]) not in nip_ke_id]
    reset = [u for u in lama if nip_ke_id[nip_bersih(u["nip"])] not in sudah_ltt]
    print(f"  - akun sudah ada di core: {len(lama)} (password di-reset ke PIN lama: {len(reset)}, "
          f"sudah terdaftar di LTT, tidak diubah: {len(lama) - len(reset)})")
    print(f"  - akun baru dibuat: {len(baru)}")

    pins = pin_lama() if (baru or reset) else {}
    wajib_ganti = set()  # NIP yang password-nya diset/di-reset pada run ini

    for u in reset:
        nip = nip_bersih(u["nip"])
        pin = pins.get(str(u["id_lama"]), "")
        if len(pin) < 6:
            print(f"  ! {u['id_lama']}: PIN lama < 6 karakter, password TIDAK di-reset (atur manual)")
            continue
        if TULIS:
            try:
                http("PUT", f"/auth/v1/admin/users/{nip_ke_id[nip]}", body={"password": pin})
            except RuntimeError as e:
                print(f"  ! {u['id_lama']}: gagal reset password ({str(e)[:120]})")
                continue
        wajib_ganti.add(nip)
    for u in baru:
        nip = nip_bersih(u["nip"])
        pin = pins.get(str(u["id_lama"]), "")
        if len(pin) < 6:
            print(f"  ! {u['id_lama']}: PIN lama < 6 karakter, akun DILEWATI (atur manual)")
            continue
        if not TULIS:
            continue
        email = f"{nip.lower()}@{DOMAIN}"
        try:
            akun = http("POST", "/auth/v1/admin/users", body={"email": email, "password": pin, "email_confirm": True})
        except RuntimeError as e:
            print(f"  ! {u['id_lama']}: gagal membuat akun ({str(e)[:120]})")
            continue
        http("POST", "/rest/v1/profiles", skema="core", body=[{"id": akun["id"], "email": email, "nama": u["nama"], "nip": nip}],
             params={"on_conflict": "id"}, prefer="resolution=merge-duplicates,return=minimal")
        nip_ke_id[nip] = akun["id"]
        wajib_ganti.add(nip)

    # Dua kelompok upsert: yang baru diset passwordnya (wajib_ganti_password = true) dan sisanya
    # (kolom wajib_ganti_password tidak dikirim, jadi nilai di database tidak tertimpa saat run ulang).
    anggota_wajib, anggota_lain, membership, desa_binaan = [], [], [], []
    for u in pengguna:
        nip = nip_bersih(u["nip"])
        uid = nip_ke_id.get(nip)
        if not uid:
            continue  # simulasi (akun baru belum dibuat) atau gagal dibuat
        baris = {
            "user_id": uid, "kecamatan_id": u.get("kecamatan_id"), "whatsapp": u.get("whatsapp") or None,
            "aktif": bool(u.get("aktif", True)), "id_lama": str(u["id_lama"]),
        }
        if nip in wajib_ganti:
            anggota_wajib.append({**baris, "wajib_ganti_password": True})
        else:
            anggota_lain.append(baris)
        if uid not in sudah_ltt:
            membership.append({"user_id": uid, "app_slug": "ltt", "role": u["role"]})
        desa_binaan += [{"user_id": uid, "desa_id": d} for d in u.get("desa_binaan_ids", [])]

    if not TULIS:
        print(f"  - (simulasi) anggota {len(pengguna)}, desa binaan {sum(len(u.get('desa_binaan_ids', [])) for u in pengguna)}")
    upsert("ltt.anggota (wajib ganti password)", "anggota", anggota_wajib, "user_id")
    upsert("ltt.anggota (lainnya)", "anggota", anggota_lain, "user_id")
    # memberships: hanya yang belum punya app 'ltt' (tabel bersama, tidak di-merge)
    if TULIS and membership:
        for i in range(0, len(membership), BATCH):
            http("POST", "/rest/v1/memberships", skema="core", body=membership[i:i + BATCH], prefer="return=minimal")
        print(f"  - core.memberships (ltt): {len(membership)} ✓")
    upsert("ltt.anggota_desa", "anggota_desa", desa_binaan, "user_id,desa_id")
    return nip_ke_id


def peta_jenis() -> dict:
    return {(j["nama"], j["komoditas"]): j["id"] for j in ambil("jenis_ltt", "id,nama,komoditas")}


def impor_laporan(nip_ke_id: dict):
    print(f"\n[3] Laporan LTT (lewati tanggal >= {BATAS})")
    laporan = muat("laporan_ltt.json")
    jenis = peta_jenis()
    hilang = {(r["jenis_ltt"], r["komoditas"]) for r in laporan} - set(jenis)
    if hilang:
        print(f"  - jenis LTT baru didaftarkan: {sorted(hilang)}")
        upsert("ltt.jenis_ltt", "jenis_ltt", [{"nama": n, "komoditas": k, "urutan": 50} for n, k in hilang], "nama,komoditas")
        if TULIS:
            jenis = peta_jenis()

    baris, lewat = [], 0
    for r in laporan:
        if dt.date.fromisoformat(r["tanggal_lapor"][:10]) >= BATAS:
            lewat += 1
            continue
        baris.append({
            "id_lama": r["id_lama"],
            "tanggal_lapor": r["tanggal_lapor"].replace(" ", "T", 1).replace("+07", "+07:00", 1),
            "pelapor_id": nip_ke_id.get(nip_bersih(r.get("nip_pelapor"))),
            "nama_pelapor": r.get("nama_pelapor"),
            "nip_pelapor": nip_bersih(r.get("nip_pelapor")) or None,
            "desa_id": r["desa_id"],
            "komoditas": r["komoditas"],
            "jenis_ltt_id": jenis.get((r["jenis_ltt"], r["komoditas"])),
            "target_tanam": r["target_tanam"], "target_panen": r["target_panen"],
            "luas_bera": r["luas_bera"], "realisasi_olah": r["realisasi_olah"],
            "realisasi_tanam": r["realisasi_tanam"], "realisasi_panen": r["realisasi_panen"],
            "metode_penanaman": r.get("metode_penanaman"), "keterangan": r.get("keterangan"),
            "sumber": r["sumber"],
        })
    print(f"  - dilewati (tanggal >= {BATAS}): {lewat}")
    upsert("ltt.laporan_ltt", "laporan_ltt", baris, "id_lama")
    return len(baris)


def impor_target():
    print("\n[4] Target")
    target = muat("target_desa.json")
    kolom = ("bulan", "desa_id", "komoditas", "target_tanam", "target_panen", "ip_eksisting", "luas_baku", "luas_standing_crop")
    hasil = upsert("ltt.target_desa", "target_desa", [{k: t.get(k) for k in kolom} for t in target],
                   "bulan,desa_id,komoditas", kembalikan=True)
    rincian_n = sum(len(t.get("rincian", [])) for t in target)
    if TULIS:
        id_target = {(h["bulan"], h["desa_id"], h["komoditas"]): h["id"] for h in hasil}
        jenis = peta_jenis()
        rincian = [
            {"target_desa_id": id_target[(t["bulan"], t["desa_id"], t["komoditas"])],
             "jenis_ltt_id": jenis[(x["jenis_ltt"], "Padi")],
             "target_tanam": x["target_tanam"], "target_panen": x["target_panen"]}
            for t in target for x in t.get("rincian", [])
        ]
        upsert("ltt.target_desa_rincian", "target_desa_rincian", rincian, "target_desa_id,jenis_ltt_id")
    else:
        print(f"  - ltt.target_desa_rincian: {rincian_n} baris (simulasi, tidak ditulis)")
    upsert("ltt.target_kecamatan", "target_kecamatan", muat("target_kecamatan.json"), "bulan,kecamatan_id,komoditas")


def impor_prod_sarana():
    print("\n[5] Produktivitas & sarana")
    upsert("ltt.produktivitas_desa", "produktivitas_desa", muat("produktivitas_desa.json"), "tahun,bulan,desa_id,komoditas")
    upsert("ltt.sarana_desa", "sarana_desa", muat("sarana_desa.json"), "desa_id")


def cek(jml_laporan: int):
    print("\n[6] Cek jumlah baris di Supabase")
    harapan = {
        "kecamatan": len(muat("kecamatan.json")), "desa": len(muat("desa.json")),
        "anggota": len(muat("pengguna.json")), "laporan_ltt": jml_laporan,
        "target_desa": len(muat("target_desa.json")), "target_kecamatan": len(muat("target_kecamatan.json")),
        "produktivitas_desa": len(muat("produktivitas_desa.json")), "sarana_desa": len(muat("sarana_desa.json")),
    }
    semua_ok = True
    for tabel, n in harapan.items():
        req = urllib.request.Request(f"{URL}/rest/v1/{tabel}?select=*", method="HEAD", headers={
            "apikey": KEY, "Authorization": f"Bearer {KEY}", "Accept-Profile": "ltt", "Prefer": "count=exact"})
        with urllib.request.urlopen(req) as r:
            ada = int(r.headers.get("Content-Range", "*/0").split("/")[-1])
        ok = ada == n
        semua_ok &= ok
        print(f"  {'✓' if ok else '✗'} {tabel}: {ada} (harapan {n})")
    print("\nSEMUA COCOK" if semua_ok else "\nADA SELISIH — periksa di atas")


def main():
    print("=" * 60)
    print(f"IMPOR SMART LTT → {URL}")
    print("MODE:", "TULIS (--jalankan)" if TULIS else "SIMULASI (tidak ada yang ditulis)")
    print("=" * 60)
    impor_wilayah()
    nip_ke_id = impor_pengguna()
    n = impor_laporan(nip_ke_id)
    impor_target()
    impor_prod_sarana()
    if TULIS:
        cek(n)
    else:
        print("\nSimulasi selesai. Jalankan dengan --jalankan untuk menulis ke database.")


if __name__ == "__main__":
    main()
