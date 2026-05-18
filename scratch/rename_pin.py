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

# We will define a list of regexes or specific replacements to be safe.
replacements = [
    # 1. Variables / IDs / specific camelCase / lowercase
    (r"\bprofilPinLama\b", "profilPasswordLama"),
    (r"\bprofilPinBaru\b", "profilPasswordBaru"),
    (r"\bprofilPinKonfirmasi\b", "profilPasswordKonfirmasi"),
    (r"\buserPIN\b", "userPassword"),
    (r"\bpinLama\b", "passwordLama"),
    (r"\bpinBaru\b", "passwordBaru"),
    (r"\bpinKonfirm\b", "passwordKonfirm"),
    (r"\bpinFinal\b", "passwordFinal"),
    (r"\bpinDiDB\b", "passwordDiDB"),
    
    # 2. Standalone variables / parameters
    (r"\bpin\b", "password"),
    
    # 3. Uppercase PIN
    (r"\bPIN\b", "PASSWORD"),
    
    # 4. Mixed-case occurrences in comments / strings
    (r"\bPin\b", "Password"),
]

for file_path in files_to_process:
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        continue
        
    print(f"Processing {file_path}...")
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    original = content
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)
        
    if content != original:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Successfully updated {file_path}")
    else:
        print(f"No changes made to {file_path}")

print("All replacements done!")
