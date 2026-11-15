"""
impor_wa_dari_ppl.py — isi nomor WhatsApp akun SMART LTT dari DASBOT database/ppl.json.

Kenapa: API /api/v1/pengguna menggantikan ppl.json untuk bot, jadi datanya tidak boleh berkurang.
Role & desa binaan di database sudah sama dengan ppl.json; yang kosong hanya nomor WA.

ATURAN
  - Dicocokkan lewat NIP (core.profiles.nip) → ltt.anggota.whatsapp.
  - HANYA mengisi yang masih KOSONG. Nomor yang sudah ada di database tidak ditimpa
    (database = acuan; perubahan nomor selanjutnya lewat menu Manajemen Penyuluh).
    Kecuali nomor rusak dari ETL lama (mis. "81279291717.0") yang angkanya SAMA dengan ppl.json:
    dirapikan ke format ppl.json.
  - Nomor disimpan apa adanya dari ppl.json (format 62…).

PAKAI
  python scripts/etl/impor_wa_dari_ppl.py                 # SIMULASI (default, tidak menulis)
  python scripts/etl/impor_wa_dari_ppl.py --jalankan      # benar-benar menulis
  python scripts/etl/impor_wa_dari_ppl.py --ppl "D:/CODING/DASBOT/database/ppl.json"
"""
import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

ap = argparse.ArgumentParser()
ap.add_argument("--jalankan", action="store_true", help="benar-benar menulis ke Supabase")
ap.add_argument("--ppl", default=str(ROOT.parent / "DASBOT" / "database" / "ppl.json"))
ARG = ap.parse_args()

env = {}
for baris in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
    baris = baris.strip()
    if baris and not baris.startswith("#") and "=" in baris:
        k, v = baris.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
URL = env.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
KEY = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not URL or not KEY:
    sys.exit("[ERROR] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY kosong di .env.local")


def http(metode: str, path: str, skema: str, body=None, params=None):
    url = f"{URL}{path}" + ("?" + urllib.parse.urlencode(params) if params else "")
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
         ("Accept-Profile" if metode == "GET" else "Content-Profile"): skema}
    if metode != "GET":
        h["Prefer"] = "return=minimal"
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers=h, method=metode)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            isi = r.read().decode()
            return json.loads(isi) if isi else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} {metode} {path}: {e.read().decode(errors='replace')[:300]}") from None


def angka_wa(v: str) -> str:
    s = v.strip()
    if s.endswith(".0"):
        s = s[:-2]
    s = "".join(c for c in s if c.isdigit())
    if s.startswith("0"):
        return "62" + s[1:]
    if s.startswith("8"):
        return "62" + s
    return s


def main():
    ppl = json.loads(Path(ARG.ppl).read_text(encoding="utf-8"))["staff"]
    wa_ppl = {str(s["nip"]).strip(): str(s.get("no_wa") or "").strip() for s in ppl}

    profil = http("GET", "/rest/v1/profiles", "core", params={"select": "id,nip,nama", "limit": 5000})
    nip_ke = {str(p["nip"]).strip(): p for p in profil if p.get("nip")}
    anggota = http("GET", "/rest/v1/anggota", "ltt", params={"select": "user_id,whatsapp", "limit": 5000})
    wa_db = {a["user_id"]: (a.get("whatsapp") or "").strip() for a in anggota}

    isi, rapikan, sudah, beda, tak_ada = [], [], 0, [], []
    for nip, wa in wa_ppl.items():
        p = nip_ke.get(nip)
        if not p or p["id"] not in wa_db:
            tak_ada.append(nip)
            continue
        if not wa:
            continue
        lama = wa_db[p["id"]]
        if not lama:
            isi.append((p["id"], p["nama"], wa))
        elif lama != wa and angka_wa(lama) == angka_wa(wa):
            rapikan.append((p["id"], p["nama"], wa, lama))
        elif lama != wa:
            beda.append((p["nama"], lama, wa))
        else:
            sudah += 1

    print("=" * 60)
    print("MODE:", "TULIS (--jalankan)" if ARG.jalankan else "SIMULASI (tidak ada yang ditulis)")
    print(f"Staf di ppl.json      : {len(wa_ppl)}")
    print(f"Akan diisi (kosong)   : {len(isi)}")
    print(f"Dirapikan (format)    : {len(rapikan)}")
    for _, nama, wa, lama in rapikan:
        print(f"   - {nama}: {lama} -> {wa}")
    print(f"Sudah sama            : {sudah}")
    print(f"Beda, TIDAK ditimpa   : {len(beda)}")
    for nama, lama, baru in beda:
        print(f"   - {nama}: database {lama} / ppl.json {baru}")
    print(f"NIP tidak ada di DB   : {len(tak_ada)} {tak_ada[:10]}")

    if not ARG.jalankan:
        print("\nSimulasi selesai. Jalankan dengan --jalankan untuk menulis.")
        return
    for uid, nama, wa in isi:
        http("PATCH", "/rest/v1/anggota", "ltt", body={"whatsapp": wa},
             params={"user_id": f"eq.{uid}", "or": "(whatsapp.is.null,whatsapp.eq.)"})
    for uid, nama, wa, lama in rapikan:
        http("PATCH", "/rest/v1/anggota", "ltt", body={"whatsapp": wa}, params={"user_id": f"eq.{uid}", "whatsapp": f"eq.{lama}"})
    print(f"\n✓ {len(isi)} nomor WA diisi, {len(rapikan)} dirapikan.")


if __name__ == "__main__":
    main()
