---
name: gas-html-cache
description: HTML PPL/BPP/Admin di-cache 6 jam di GAS server — perubahan HTML tidak langsung terlihat tanpa clear cache
metadata:
  node_type: memory
  type: project
  originSessionId: 85c2cd31-4538-4501-88bb-aa0183d37079
---

`Code.gs` → `getAppResources` cache HTML dengan key `res_ppl_v{CODE_VERSION}` selama 6 jam.

**Aturan:** Setiap kali ada perubahan `File_HTML_*.html`, **naikkan `CODE_VERSION`** di `Code.gs` (saat ini `= 2`).

**Why:** Tanpa ini, server kirim HTML lama → elemen modal tidak ada di DOM → fungsi JS crash diam-diam saat `getElementById` return `null`.

**How to apply:** Ingatkan user untuk naikkan `CODE_VERSION` setiap deploy HTML baru. JS (`File_Javascript.html`) tidak di-cache, langsung berlaku.
