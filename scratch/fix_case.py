import re
import os

files_to_process = [
    r"d:\CODING\LTT\rancangan_update_profile.md",
    r"d:\CODING\LTT\Database.gs",
    r"d:\CODING\LTT\File_HTML_Login.html",
    r"d:\CODING\LTT\File_Javascript.html",
    r"d:\CODING\LTT\File_HTML_PPL.html",
    r"d:\CODING\LTT\File_HTML_BPP.html",
    r"d:\CODING\LTT\File_HTML_Admin.html"
]

# We want to change "PASSWORD" to "Password" when it's part of user-facing UI labels, comments or strings.
# But keep it as-is in uppercase if it was intended to be scream-case or is otherwise fine.
# Let's replace "PASSWORD" in text labels:
replacements = [
    ("PASSWORD Rahasia", "Password Rahasia"),
    ("Ubah Profil & PASSWORD", "Ubah Profil & Password"),
    ("PASSWORD Aktif Saat Ini", "Password Aktif Saat Ini"),
    ("PASSWORD Baru", "Password Baru"),
    ("Konfirmasi PASSWORD Baru", "Konfirmasi Password Baru"),
    ("Ulangi PASSWORD baru", "Ulangi Password baru"),
    ("ganti PASSWORD", "ganti Password"),
    ("Password / PASSWORD", "Password"),
    ("PASSWORD Login", "Password Login"),
    ("field PASSWORD", "field Password"),
    ("PASSWORD Aktif yang Anda masukkan salah", "Password Aktif yang Anda masukkan salah"),
    ("PASSWORD Baru minimal harus 4 karakter", "Password Baru minimal harus 4 karakter"),
    ("PASSWORD Baru dan Konfirmasi PASSWORD tidak cocok", "Password Baru dan Konfirmasi Password tidak cocok"),
    ("PASSWORD yang akan disimpan", "Password yang akan disimpan"),
    ("PASSWORD lama jika kolom PASSWORD baru kosong", "Password lama jika kolom Password baru kosong"),
    ("Validasi PASSWORD Lama", "Validasi Password Lama"),
    ("Kolom D: PASSWORD", "Kolom D: Password"),
    ("PASSWORD lama", "Password lama"),
    ("PASSWORD baru", "Password baru"),
]

for file_path in files_to_process:
    if not os.path.exists(file_path):
        continue
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    original = content
    for target, replacement in replacements:
        content = content.replace(target, replacement)
        
    # Also catch other PASSWORD in labels
    content = re.sub(r"\bPASSWORD\b", "Password", content)
    
    if content != original:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Fixed casing in {file_path}")

print("Casing fix completed!")
