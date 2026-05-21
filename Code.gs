// =========================================================================
// FILE: Code.gs
// DESKRIPSI: Routing Utama dan Setup Web App
// =========================================================================

// Fungsi utama penjalan Web App
function doGet(e) {
  // Jika URL GAS dipanggil untuk memuat kode Bookmarklet/Tuyul
  if (e && e.parameter && e.parameter.action) {
    if (e.parameter.action === 'target') {
      return ContentService.createTextOutput(getKodeTuyulTarget()).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    if (e.parameter.action === 'eltt') {
      return ContentService.createTextOutput(getKodeTuyulEltt()).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
  }

  inisialisasiDatabase_(); // Auto-setup: pastikan semua sheet ada
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('e-LTT Palawija')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

var LOGO_SRC_ = 'https://lh3.googleusercontent.com/d/1eT8hkuReypIqxGP7O8G0zGS5hGjSFrmt';

function include(filename) {
  var tmpl = HtmlService.createTemplateFromFile(filename);
  tmpl.logoSrc = LOGO_SRC_;
  return tmpl.evaluate().getContent();
}

// =========================================================================
// PEMICU WAKTU (TIME-DRIVEN TRIGGERS)
// Jalankan fungsi ini SEKALI SAJA secara manual untuk memasang semua alarm otomatis
// =========================================================================
function setupTriggers() {
  // Bersihkan semua trigger lama
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });

  // Trigger 1: Arsip Bulanan (setiap tanggal 1 jam 01:00)
  ScriptApp.newTrigger('arsipBulanan')
    .timeBased()
    .onMonthDay(1)
    .atHour(1)
    .create();
}

function doPost(e) {
  try {
    var request = JSON.parse(e.postData.contents);
    if (request.aksi === 'sinkron_padi') {
      var result = terimaSinkronPadi(request.data, request.logData);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Aksi tidak dikenal' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
