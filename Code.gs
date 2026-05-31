// =========================================================================
// FILE: Code.gs
// DESKRIPSI: Routing Utama dan Setup Web App
// =========================================================================

// Fungsi utama penjalan Web App
function doGet(e) {
  // Jika URL GAS dipanggil untuk memuat kode Bookmarklet/Tuyul
  if (e && e.parameter && e.parameter.action) {
    if (e.parameter.action === 'target') {
      return ContentService.createTextOutput(getKodeTuyulTarget()).setMimeType(
        ContentService.MimeType.JAVASCRIPT,
      );
    }
    if (e.parameter.action === 'eltt') {
      return ContentService.createTextOutput(getKodeTuyulEltt()).setMimeType(
        ContentService.MimeType.JAVASCRIPT,
      );
    }
    if (e.parameter.action === 'migrasi') {
      var result = migrasiTargetKeV3();
      return ContentService.createTextOutput(result).setMimeType(
        ContentService.MimeType.TEXT,
      );
    }
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('SMART LTT')
    .addMetaTag(
      'viewport',
      'width=device-width, initial-scale=1, maximum-scale=1',
    )
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

var LOGO_SRC_ =
  'https://lh3.googleusercontent.com/d/1eT8hkuReypIqxGP7O8G0zGS5hGjSFrmt';

// Naikkan angka ini setiap kali ada perubahan File_HTML_*.html agar cache lama otomatis invalid
var CODE_VERSION = 63;

function include(filename) {
  var tmpl = HtmlService.createTemplateFromFile(filename);
  tmpl.logoSrc = LOGO_SRC_;
  return tmpl.evaluate().getContent();
}

// =========================================================================
// PEMICU WAKTU (TIME-DRIVEN TRIGGERS)
// Jalankan fungsi ini SEKALI SAJA secara manual untuk memasang semua alarm otomatis
// =========================================================================
function setupApp() {
  inisialisasiDatabase_();
  setupTriggers();
}

function getAppResources(role) {
  var cache = CacheService.getScriptCache();

  var needPpl = !role || role === 'Penyuluh' || role === 'Admin_BPP';
  var needBpp = !role || role === 'Admin_BPP';
  var needAdmin = !role || role === 'Admin_Kab';

  function _cachedHtml(key, filename, isTemplate) {
    var vKey = key + '_v' + CODE_VERSION;
    var hit = cache.get(vKey);
    if (hit) return hit;
    var content;
    if (isTemplate) {
      var tmpl = HtmlService.createTemplateFromFile(filename);
      tmpl.logoSrc = LOGO_SRC_;
      content = tmpl.evaluate().getContent();
    } else {
      content = HtmlService.createHtmlOutputFromFile(filename).getContent();
    }
    try {
      cache.put(vKey, content, 21600);
    } catch (e) {}
    return content;
  }

  return {
    ppl: needPpl ? _cachedHtml('res_ppl', 'File_HTML_PPL', false) : '',
    bpp: needBpp ? _cachedHtml('res_bpp', 'File_HTML_BPP', false) : '',
    admin: needAdmin ? _cachedHtml('res_admin', 'File_HTML_Admin', true) : '',
    js: HtmlService.createHtmlOutputFromFile('File_Javascript').getContent(),
  };
}

function setupTriggers() {
  // Bersihkan semua trigger lama
  ScriptApp.getProjectTriggers().forEach(function (t) {
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

      return ContentService.createTextOutput(
        JSON.stringify(result),
      ).setMimeType(ContentService.MimeType.JSON);
    }
    if (request.aksi === 'import_target_epusluh') {
      var result = importTargetEpusluh(
        request.bulan,
        request.komoditas,
        request.data,
        request.pembuat,
      );
      return ContentService.createTextOutput(
        JSON.stringify(result),
      ).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: 'Aksi tidak dikenal' }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: err.toString() }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// Fungsi pembantu untuk memicu otorisasi Google Apps Script (Jalankan ini secara manual sekali di Editor GAS)
function testWebhook() {
  var response = UrlFetchApp.fetch('http://103.245.38.96:3000/deteksi-ltt', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      data: [
        {
          kecamatan: 'Test Kecamatan',
          desa: 'Test Desa',
          jenisLTT: 'LTT Reguler',
        },
      ],
    }),
    muteHttpExceptions: true,
  });
  Logger.log('Respon VPS: ' + response.getContentText());
}
