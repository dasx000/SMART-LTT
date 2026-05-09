// =========================================================================
// FILE: Code.gs
// DESKRIPSI: Routing Utama dan Setup Web App
// =========================================================================

// Fungsi utama penjalan Web App
function doGet(e) {
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
// Jalankan fungsi ini SEKALI SAJA secara manual untuk memasang alarm otomatis
// =========================================================================
function setupTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }

  ScriptApp.newTrigger('backupDatabaseHarian')
           .timeBased()
           .atHour(23)
           .nearMinute(55)
           .everyDays(1)
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