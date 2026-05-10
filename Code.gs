// =========================================================================
// FILE: Code.gs
// DESKRIPSI: Routing Utama dan Setup Web App
// =========================================================================

// Fungsi utama penjalan Web App
function doGet(e) {
  inisialisasiDatabase_(); // Auto-setup: pastikan semua sheet ada
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('e-LTT Palawija')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
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