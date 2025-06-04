// --- GLOBAL VARIABLES ---
var timeZone = "Asia/Jakarta";
var dateTimeFormat = "dd/MM/yyyy HH:mm:ss"; // Format untuk log dan Last Visit
var attendanceLogSheetName = "attendance log"; // Log untuk UID terdaftar
var defaultTerminalName = "headquarter";
var mainTabName = "main tab"; // Daftar user & monitoring harian
var historyLogSheetName = "history log"; // Log untuk UID TIDAK terdaftar
var dailyReportSheetName = "daily report"; // Laporan absensi harian (Tepat Waktu, Telat, Alpha)
var cumulativeSummarySheetName = "cumulative summary"; // Ringkasan kumulatif 10 hari terakhir
var persistentDailyLogSheetName = "persistent daily log";
var absenTabName = "Absen"; 
// --- GLOBAL VARIABLES FOR OPERATIONAL HOURS ---
var absenStartHour = 5;     // Jam 05 (05:00)
var absenStartMinute = 31; // Menit 31 (05:31)

var absenEndHour = 9;       // Jam 09 (09:00)
var absenEndMinute = 0;     // Menit 00 (09:00)

var onTimeEndHour = 7;
var onTimeEndMinute = 30;
// --- END GLOBAL VARIABLES ---

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Anyboards Menu')
    .addItem('Initial Setup', 'initialSetup')
    .addItem('Register New UIDs From History Log', 'addNewUIDsFromHistoryLogUiHandler')
    .addItem('Generate Daily Report (Manual)', 'generateDailyReportManual')
    .addItem('Update Cumulative Summary (Manual)', 'updateCumulativeSummary')
    .addItem('Save Daily Report Permanently (Manual)', '_saveDailyReportToPersistentLog') // Pastikan baris ini ada
    .addToUi();
}

function addNewUIDsFromHistoryLogUiHandler() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert('All new UIDs from "' + historyLogSheetName + '" will be added to the main tab. Are you sure?', ui.ButtonSet.YES_NO);

  if (response == ui.Button.YES) {
    registerNewUIDsFromSource(historyLogSheetName);
  }
}

function registerNewUIDsFromSource(sourceSheetName) {
  var mainTab = getMainSheet();
  var mainLastRow = mainTab.getLastRow();
  // Ambil UID yang sudah terdaftar di main tab
  var registeredUIDs = [];
  if (mainLastRow >= 2) {
    registeredUIDs = mainTab.getRange(2, 1, mainLastRow - 1, 1).getValues().flat();
  }
  registeredUIDs = [...new Set(registeredUIDs)]; // Pastikan unik

  var sourceSheet;
  if (sourceSheetName === historyLogSheetName) {
    sourceSheet = getHistoryLogSheet();
  } else if (sourceSheetName === attendanceLogSheetName) {
    sourceSheet = getAttendanceLogSheet();
  } else {
    SpreadsheetApp.getUi().alert("Sumber sheet tidak dikenal untuk registrasi.");
    return;
  }

  var lastRowSource = sourceSheet.getLastRow();
  if (lastRowSource <= 1) {
    SpreadsheetApp.getUi().alert("Tidak ada UID baru yang ditemukan di '" + sourceSheetName + "' untuk diregistrasi.");
    return;
  }

  // Ambil data UID dan Date Time dari source sheet (history log)
  var dataFromSource = sourceSheet.getRange(2, 1, lastRowSource - 1, 2).getValues();

  var uniqueNewUIDs = [];

  for (var i = 0; i < dataFromSource.length; i++) {
    var uid = dataFromSource[i][1]; // Kolom UID
    var dateTime = dataFromSource[i][0]; // Kolom Date Time

    if (uid && !registeredUIDs.includes(uid)) {
      uniqueNewUIDs.push({ uid: uid, date: dateTime });
      registeredUIDs.push(uid); // Tambahkan ke daftar UID yang sudah diproses untuk menghindari duplikasi dalam satu run
    }
  }

  var startRow = mainTab.getLastRow() + 1;
  var newData = [];

  for (var i = 0; i < uniqueNewUIDs.length; i++) {
    var rowData = [];
    rowData[0] = uniqueNewUIDs[i].uid;
    rowData[1] = 'Person ' + (startRow - 1 + i); // Nama default
    rowData[2] = 'beep'; // Akses default
    rowData[3] = 0; // Visits Count
    rowData[4] = uniqueNewUIDs[i].date; // Last Visit (saat didaftarkan)
    rowData[5] = ""; // First Tap Status (kosong)
    rowData[6] = ""; // First Tap Time (kosong)
    newData.push(rowData);
  }

  if (newData.length > 0) {
    mainTab.getRange(startRow, 1, newData.length, newData[0].length).setValues(newData);
    SpreadsheetApp.getUi().alert(newData.length + " UID baru berhasil diregistrasi ke main tab dari " + sourceSheetName + ".");
    _saveDailyReportToPersistentLog()
  } else {
    SpreadsheetApp.getUi().alert("Tidak ada UID baru yang ditemukan di '" + sourceSheetName + "' untuk diregistrasi.");
  }
}

function initialSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(mainTabName)) {
    SpreadsheetApp.getUi().alert('The spreadsheet system has already been initialized (main tab exists).');
    return;
  }
  var rowDataPersistentLog = ['Date', 'UID', 'Name', 'Status Absensi', 'First Tap Time', 'Processed On'];
  var persistentDailyLogSheet = ss.insertSheet(persistentDailyLogSheetName);
  persistentDailyLogSheet.getRange(1, 1, 1, rowDataPersistentLog.length).setValues([rowDataPersistentLog]);
  persistentDailyLogSheet.setColumnWidths(1, rowDataPersistentLog.length, 150);


  // Create main sheet
  var mainSheet = ss.insertSheet(mainTabName, 0);
  var rowData = ['UID', 'Name', 'Access', 'Visits Count', 'Last Visit', 'First Tap Status', 'First Tap Time'];
  mainSheet.getRange(1, 1, 1, rowData.length).setValues([rowData]);
  mainSheet.setColumnWidths(1, rowData.length, 150);

  // Create attendance log sheet (Log semua tap dari UID terdaftar)
  var rowDataAttendance = ['Date Time', 'UID', 'Name', 'Result', 'Terminal'];
  var attendanceSheet = ss.insertSheet(attendanceLogSheetName);
  attendanceSheet.getRange(1, 1, 1, rowDataAttendance.length).setValues([rowDataAttendance]);
  attendanceSheet.setColumnWidths(1, rowDataAttendance.length, 150);

  // Initial setup for History Log Sheet (Log semua tap dari UID TIDAK terdaftar)
  var rowDataHistory = ['Date Time', 'UID', 'Name', 'Result', 'Terminal'];
  var historySheet = ss.insertSheet(historyLogSheetName);
  historySheet.getRange(1, 1, 1, rowDataHistory.length).setValues([rowDataHistory]);
  historySheet.setColumnWidths(1, rowDataHistory.length, 150);
  historySheet.hideSheet(); // Sembunyikan history log karena hanya untuk internal

  // Create Daily Report sheet (Laporan status absensi harian)
  var rowDataDailyReport = ['Date', 'UID', 'Name', 'Status Absensi', 'First Tap Time'];
  var dailyReportSheet = ss.insertSheet(dailyReportSheetName);
  dailyReportSheet.getRange(1, 1, 1, rowDataDailyReport.length).setValues([rowDataDailyReport]);
  dailyReportSheet.setColumnWidths(1, rowDataDailyReport.length, 150);

  // Create Cumulative Summary sheet (Ringkasan kumulatif)
  var rowDataCumulativeSummary = ['UID', 'Name', 'Total Tepat Waktu', 'Total Telat', 'Total Alfa', 'Hari Keberapa'];
  var cumulativeSummarySheet = ss.insertSheet(cumulativeSummarySheetName);
  cumulativeSummarySheet.getRange(1, 1, 1, rowDataCumulativeSummary.length).setValues([rowDataCumulativeSummary]);
  cumulativeSummarySheet.setColumnWidths(1, rowDataCumulativeSummary.length, 150);

  // Remove default "Sheet1" if it exists and is empty
  var defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
  }
  SpreadsheetApp.getUi().alert('Initial setup complete! All required sheets have been created.');
}

// --- Sheet Getter Functions ---
function getMainSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(mainTabName);
}

function getAttendanceLogSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(attendanceLogSheetName);
}

function getHistoryLogSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var historySheet = ss.getSheetByName(historyLogSheetName);
  if (!historySheet) { // Create if not exists (for robustness)
    var rowDataHistory = ['Date Time', 'UID', 'Name', 'Result', 'Terminal'];
    historySheet = ss.insertSheet(historyLogSheetName);
    historySheet.getRange(1, 1, 1, rowDataHistory.length).setValues([rowDataHistory]);
    historySheet.setColumnWidths(1, rowDataHistory.length, 150);
    historySheet.hideSheet();
  }
  return historySheet;
}

function getDailyReportSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dailyReportSheet = ss.getSheetByName(dailyReportSheetName);
  if (!dailyReportSheet) { // Create if not exists
    var rowDataDailyReport = ['Date', 'UID', 'Name', 'Status Absensi', 'First Tap Time'];
    dailyReportSheet = ss.insertSheet(dailyReportSheetName);
    dailyReportSheet.getRange(1, 1, 1, rowDataDailyReport.length).setValues([rowDataDailyReport]);
    dailyReportSheet.setColumnWidths(1, rowDataDailyReport.length, 150);
  }
  return dailyReportSheet;
}

function getCumulativeSummarySheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cumulativeSummarySheet = ss.getSheetByName(cumulativeSummarySheetName);
  if (!cumulativeSummarySheet) { // Create if not exists
    var rowDataCumulativeSummary = ['UID', 'Name', 'Total Tepat Waktu', 'Total Telat', 'Total Alpha'];
    cumulativeSummarySheet = ss.insertSheet(cumulativeSummarySheetName);
    cumulativeSummarySheet.getRange(1, 1, 1, rowDataCumulativeSummary.length).setValues([rowDataCumulativeSummary]);
    cumulativeSummarySheet.setColumnWidths(1, rowDataCumulativeSummary.length, 150);
  }
  return cumulativeSummarySheet;
}
// --- End Sheet Getter Functions ---

function stripQuotes(value) {
  if (typeof value === "string") {
    return value.replace(/^["']|['"]$/g, "");
  }
  return value;
}

// Fungsi pembantu untuk mengonversi string tanggal dari sheet ke objek Date
function parseDateTimeString(dateTimeStr) {
  Logger.log("[parseDateTimeString] Input: " + dateTimeStr + " (Type: " + typeof dateTimeStr + ")");
  if (typeof dateTimeStr !== 'string') {
    Logger.log("[parseDateTimeString] Bukan string, returning null.");
    return null;
  }
  // Pola untuk "dd/MM/yyyy"
  const partsWithoutTime = dateTimeStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  Logger.log("[parseDateTimeString] partsWithoutTime: " + JSON.stringify(partsWithoutTime));
  if (partsWithoutTime) {
    const year = parseInt(partsWithoutTime[3]);
    const month = parseInt(partsWithoutTime[2]) - 1; // Bulan dimulai dari 0
    const day = parseInt(partsWithoutTime[1]);
    const dateObj = new Date(year, month, day, 0, 0, 0);
    Logger.log("[parseDateTimeString] Matched format tanpa waktu, returning: " + dateObj);
    return dateObj;
  }
  // Pola untuk "dd/MM/yyyy HH:mm:ss"
  const partsWithTime = dateTimeStr.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
  Logger.log("[parseDateTimeString] partsWithTime: " + JSON.stringify(partsWithTime));
  if (partsWithTime) {
    const year = parseInt(partsWithTime[3]);
    const month = parseInt(partsWithTime[2]) - 1; // Bulan dimulai dari 0
    const day = parseInt(partsWithTime[1]);
    const hours = parseInt(partsWithTime[4]);
    const minutes = parseInt(partsWithTime[5]);
    const seconds = parseInt(partsWithTime[6]);
    const dateObj = new Date(year, month, day, hours, minutes, seconds);
    Logger.log("[parseDateTimeString] Matched format dengan waktu, returning: " + dateObj);
    return dateObj;
  }
  // Pola untuk format log yang Anda berikan sebelumnya (misal: "Tue May 27 2025 00:00:00 GMT+0700 (Western Indonesia Time)")
  // Ini dipertahankan karena ini adalah format yang mungkin dihasilkan oleh Google Sheets saat membaca Date object sebagai string.
  const partsFromLog = dateTimeStr.match(/(\w{3}) (\w{3}) (\d{2}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT([+-]\d{4}) \(([^)]+)\)/);
  Logger.log("[parseDateTimeString] partsFromLog: " + JSON.stringify(partsFromLog));
  if (partsFromLog) {
    const monthStr = partsFromLog[2];
    const day = parseInt(partsFromLog[3]);
    const year = parseInt(partsFromLog[4]);
    const hours = parseInt(partsFromLog[5]);
    const minutes = parseInt(partsFromLog[6]);
    const seconds = parseInt(partsFromLog[7]);
    const month = new Date(Date.parse(monthStr + " 1, " + year)).getMonth(); // Konversi nama bulan ke angka (0-11)
    const dateObj = new Date(year, month, day, hours, minutes, seconds);
    Logger.log("[parseDateTimeString] Matched format log, returning: " + dateObj);
    return dateObj;
  }
  Logger.log("[parseDateTimeString] Format tidak sesuai, returning null.");
  return null;
}


function doGet(e) {
  if (e.parameter.mode === "data") {
    // Digunakan oleh web app untuk mengambil data monitoring harian dari main tab
    var sheet = getMainSheet();
    var data = sheet.getDataRange().getValues();
    var jsonData = [];
    if (data.length > 1) { // Pastikan ada data selain header
      for (var i = 1; i < data.length; i++) {
        var rowData = {};
        for (var j = 0; j < data[0].length; j++) {
          rowData[data[0][j]] = data[i][j];
        }
        jsonData.push(rowData);
      }
    }
    return ContentService.createTextOutput(JSON.stringify(jsonData)).setMimeType(ContentService.MimeType.JSON);
  }
   else if (e.parameter.mode === "registerUIDs") {
            registerNewUIDsFromSource(historyLogSheetName); // Langsung panggil ini
            return ContentService.createTextOutput(JSON.stringify({
              "result": "success",
              "message": "UIDs from History Log registered successfully."
            })).setMimeType(ContentService.MimeType.JSON);
   }
  var access = "beep";
  var statusFlagForArduino = 4;
  var studentNameForArduino = "Unregistered";

  var currentDateTime = new Date();
  var dateTimeFormatted = Utilities.formatDate(currentDateTime, timeZone, dateTimeFormat);

  if (!e.parameter.uid) {
    Logger.log("Missing UID parameter in doGet request.");
    return ContentService.createTextOutput("error:Error:Missing UID:4");
  }

  var uid = stripQuotes(e.parameter.uid);
  var terminal = e.parameter.terminal ? stripQuotes(e.parameter.terminal) : defaultTerminalName;

  var mainSheet = getMainSheet();
  var dataMainTab = mainSheet.getDataRange().getValues();
  var headers = dataMainTab[0];

  var uidColumnIndex = headers.indexOf("UID");
  var nameColumnIndex = headers.indexOf("Name");
  var accessColumnIndex = headers.indexOf("Access");
  var visitsCountColumnIndex = headers.indexOf("Visits Count");
  var lastVisitColumnIndex = headers.indexOf("Last Visit");
  var firstTapStatusColumnIndex = headers.indexOf("First Tap Status");
  var firstTapTimeColumnIndex = headers.indexOf("First Tap Time");

  var isRegisteredUID = false;
  var targetRowIndex = -1;
  var newVisitResultForLog = "UNKNOWN";

  // Cari UID di main tab
  for (var i = 1; i < dataMainTab.length; i++) {
    if (dataMainTab[i][uidColumnIndex] == uid) {
      isRegisteredUID = true;
      targetRowIndex = i + 1; // Baris di sheet (indeks 1-based)
      studentNameForArduino = dataMainTab[i][nameColumnIndex];
      access = dataMainTab[i][accessColumnIndex];
      // Pastikan nilai access valid
      if (typeof access !== 'string' || (access.toLowerCase() !== 'beep' && access.toLowerCase() !== 'none')) {
        access = 'beep';
      }
      break;
    }
  }

  if (isRegisteredUID) {
    // UID terdaftar, catat ke attendance log dan update main tab
    var rowData = mainSheet.getRange(targetRowIndex, 1, 1, headers.length).getValues()[0];
    var currentVisitsCount = parseInt(rowData[visitsCountColumnIndex] || 0);
    var currentFirstTapStatus = rowData[firstTapStatusColumnIndex] || '';

    var currentHour = currentDateTime.getHours();
    var currentMinute = currentDateTime.getMinutes();

    // Cek apakah di dalam jam operasional absensi
    var isWithinOperationalHours = (
      (currentHour > absenStartHour || (currentHour === absenStartHour && currentMinute >= absenStartMinute)) &&
      (currentHour < absenEndHour || (currentHour === absenEndHour && currentMinute <= absenEndMinute))
    );

    if (isWithinOperationalHours) {
      var statusBasedOnTime = "";
      if (currentHour < onTimeEndHour || (currentHour === onTimeEndHour && currentMinute <= onTimeEndMinute)) {
        statusBasedOnTime = "Tepat Waktu";
      } else {
        statusBasedOnTime = "Telat";
      }

      if (currentVisitsCount === 0) {
        // Ini tap pertama hari ini
        mainSheet.getRange(targetRowIndex, visitsCountColumnIndex + 1).setValue(1); // Set Visits Count ke 1
        mainSheet.getRange(targetRowIndex, lastVisitColumnIndex + 1).setValue(dateTimeFormatted + " " + terminal);
        mainSheet.getRange(targetRowIndex, firstTapStatusColumnIndex + 1).setValue(statusBasedOnTime);

        var firstTapTimeFormatted = Utilities.formatDate(currentDateTime, timeZone, "HH:mm:ss");
        mainSheet.getRange(targetRowIndex, firstTapTimeColumnIndex + 1).setValue(firstTapTimeFormatted);

        statusFlagForArduino = (statusBasedOnTime === "Tepat Waktu") ? 0 : 2; // 0: Tepat Waktu, 2: Telat
        newVisitResultForLog = statusBasedOnTime;

      } else {
        // Sudah pernah tap hari ini, hanya update Visits Count dan Last Visit
        mainSheet.getRange(targetRowIndex, visitsCountColumnIndex + 1).setValue(currentVisitsCount + 1);
        mainSheet.getRange(targetRowIndex, lastVisitColumnIndex + 1).setValue(dateTimeFormatted + " " + terminal);

        statusFlagForArduino = 1; // 1: Sudah Absen (tap ke-2 dst)
        newVisitResultForLog = "Sudah Absen - " + currentFirstTapStatus; // Catat status absensi pertama
      }
    } else {
      // Tap di luar jam operasional
      statusFlagForArduino = 3; // 3: Di Luar Jam Absen
      newVisitResultForLog = "OUTSIDE_ABSEN_HOURS";
    }

    // Catat semua tap ke attendance log (termasuk tap di luar jam/tap ke-2 dst)
    var attendanceSheet = getAttendanceLogSheet();
    attendanceSheet.getRange(attendanceSheet.getLastRow() + 1, 1, 1, 5).setValues([[dateTimeFormatted, uid, studentNameForArduino, newVisitResultForLog, terminal]]);

  } else {
    // UID tidak terdaftar, catat ke history log
    access = "beep"; // Default akses untuk UID tidak terdaftar
    statusFlagForArduino = 4; // 4: Tidak Terdaftar
    studentNameForArduino = "Unregistered";
    newVisitResultForLog = "UNREGISTERED";

    var historySheet = getHistoryLogSheet();
    historySheet.getRange(historySheet.getLastRow() + 1, 1, 1, 5).setValues([[dateTimeFormatted, uid, studentNameForArduino, newVisitResultForLog, terminal]]);
  }

  var finalResponse = access + ":" + studentNameForArduino + ":" + statusFlagForArduino;
  Logger.log("Final response to Arduino: " + finalResponse);
  return ContentService.createTextOutput(finalResponse);
}


function doPost(e) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var mainSheet = ss.getSheetByName(mainTabName);

    if (!e.parameter.mode) {
        return ContentService.createTextOutput(JSON.stringify({
            "result": "error",
            "message": "Mode parameter is required."
        })).setMimeType(ContentService.MimeType.JSON);
    }

    if (e.parameter.mode === "add") {
        // Mode untuk menambahkan siswa baru
        if (!e.parameter.name || !e.parameter.absen) { // Ubah validasi
            return ContentService.createTextOutput(JSON.stringify({
                "result": "error",
                "message": "Name and Absen parameters are required for add mode."
            })).setMimeType(ContentService.MimeType.JSON);
        }

        var name = stripQuotes(e.parameter.name);
        var absen = stripQuotes(e.parameter.absen);

        // Generate UID (Anda bisa sesuaikan logika ini)
        var uid = generateUID();

        // Cek apakah Nomor Absen sudah ada
        var mainTabData = mainSheet.getDataRange().getValues();
        var headers = mainTabData[0];
        var absenColumnIndex = headers.indexOf("Absen");
        for (var i = 1; i < mainTabData.length; i++) {
            if (mainTabData[i][absenColumnIndex] == absen) {
                return ContentService.createTextOutput(JSON.stringify({
                    "result": "error",
                    "message": "Nomor Absen already exists."
                })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        // Tambahkan siswa baru
        var newRow = [uid, name, "beep", 0, Utilities.formatDate(new Date(), timeZone, dateTimeFormat), "", "", absen]; // Tambahkan absen
        mainSheet.appendRow(newRow);
        return ContentService.createTextOutput(JSON.stringify({
            "result": "success",
            "message": "Student added successfully. UID: " + uid
        })).setMimeType(ContentService.MimeType.JSON);

    } else if (e.parameter.mode === "edit") {
        // Mode untuk mengedit siswa
        if (!e.parameter.uid || !e.parameter.name || !e.parameter.absen) { // Ubah validasi
            return ContentService.createTextOutput(JSON.stringify({
                "result": "error",
                "message": "UID, Name, and Absen parameters are required for edit mode."
            })).setMimeType(ContentService.MimeType.JSON);
        }

        var uid = stripQuotes(e.parameter.uid);
        var name = stripQuotes(e.parameter.name);
        var absen = stripQuotes(e.parameter.absen);

        var mainTabData = mainSheet.getDataRange().getValues();
        var headers = mainTabData[0];
        var uidColumnIndex = headers.indexOf("UID");
        var nameColumnIndex = headers.indexOf("Name");
        var absenColumnIndex = headers.indexOf("Absen");
        var isUidFound = false;

        for (var i = 1; i < mainTabData.length; i++) {
            if (mainTabData[i][uidColumnIndex] === uid) {
                mainSheet.getRange(i + 1, nameColumnIndex + 1).setValue(name); // Update Nama
                mainSheet.getRange(i + 1, absenColumnIndex + 1).setValue(absen); // Update Absen
                isUidFound = true;
                break;
            }
        }

        if (isUidFound) {
            return ContentService.createTextOutput(JSON.stringify({
                "result": "success",
                "message": "Student updated successfully."
            })).setMimeType(ContentService.MimeType.JSON);
        } else {
            return ContentService.createTextOutput(JSON.stringify({
                "result": "error",
                "message": "UID not found."
            })).setMimeType(ContentService.MimeType.JSON);
        }

    } else if (e.parameter.mode === "delete") {
        // Mode untuk menghapus siswa
        if (!e.parameter.uid) {
            return ContentService.createTextOutput(JSON.stringify({
                "result": "error",
                "message": "UID parameter is required for delete mode."
            })).setMimeType(ContentService.MimeType.JSON);
        }

        var uid = stripQuotes(e.parameter.uid);
        var mainTabData = mainSheet.getDataRange().getValues();
        var headers = mainTabData[0];
        var uidColumnIndex = headers.indexOf("UID");
        var isUidFound = false;

        for (var i = 1; i < mainTabData.length; i++) {
            if (mainTabData[i][uidColumnIndex] === uid) {
                mainSheet.deleteRow(i + 1);
                isUidFound = true;
                break;
            }
        }

        if (isUidFound) {
            return ContentService.createTextOutput(JSON.stringify({
                "result": "success",
                "message": "Student deleted successfully."
            })).setMimeType(ContentService.MimeType.JSON);
        } else {
            return ContentService.createTextOutput(JSON.stringify({
                "result": "error",
                "message": "UID not found."
            })).setMimeType(ContentService.MimeType.JSON);
        }

    } else if (e.parameter.mode === "editHeader") {
        // Mode untuk mengedit header
        // ... (Kode editHeader Anda sebelumnya)

    }

    return ContentService.createTextOutput(JSON.stringify({
        "result": "error",
        "message": "Invalid mode."
    })).setMimeType(ContentService.MimeType.JSON);
}



function generateUID() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var uid = '';
    for (var i = 0; i < 6; i++) {
        uid += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    Logger.log("Generated UID: " + uid);  // Log UID
    return uid;
}


function stripQuotes(value) {
    if (typeof value === 'string' || value instanceof String) {
        return value.replace(/^"(.*)"$/, '$1');
    }
    return value;
}


// Fungsi untuk menjadwalkan reset harian dan pembuatan laporan (Hanya untuk membuat trigger awal)
function createDailyResetTrigger() {
  // Hapus semua trigger yang sudah ada agar tidak duplikat
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() == "resetDailyVisits") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // Buat trigger baru untuk dijalankan setiap hari pada waktu tertentu (misal: 00:00 - 01:00)
  ScriptApp.newTrigger("resetDailyVisits")
    .timeBased()
    .atHour(4) // Jam 4 pagi (sesuai setting Anda)
    .nearMinute(0) // Sekitar menit 0
    .everyDays(1)
    .create();
  Logger.log("Daily reset trigger created.");
}

function resetDailyVisits() {
  Logger.log("resetDailyVisits: START - " + new Date());

  var mainSheet = getMainSheet();
  Logger.log("resetDailyVisits: mainSheet = " + mainSheet.getName());

  var dailyReportSheet = getDailyReportSheet();
  Logger.log("resetDailyVisits: dailyReportSheet = " + dailyReportSheet.getName());

  var persistentLogSheet = getPersistentDailyLogSheet();
  Logger.log("resetDailyVisits: persistentLogSheet = " + persistentLogSheet.getName());

  // 1. Generate Daily Report untuk HARI SEBELUMNYA
  Logger.log("resetDailyVisits: Generating daily report...");
  generateDailyReport(false);
  Logger.log("resetDailyVisits: Daily report generated.");

  // 2. Simpan data dari daily report ke persistent daily log
  Logger.log("resetDailyVisits: Saving daily report to persistent log...");
  var dailyReportLastRow = dailyReportSheet.getLastRow();
  Logger.log("resetDailyVisits: dailyReportLastRow = " + dailyReportLastRow);

  if (dailyReportLastRow > 1) {
    var dailyReportData = dailyReportSheet.getRange(2, 1, dailyReportLastRow - 1, dailyReportSheet.getLastColumn()).getValues();
    var now = new Date();
    var processedOn = Utilities.formatDate(now, timeZone, dateTimeFormat);
    var persistentLogData = dailyReportData.map(row => [...row, processedOn]);

    persistentLogSheet.getRange(persistentLogSheet.getLastRow() + 1, 1, persistentLogData.length, persistentLogData[0].length).setValues(persistentLogData);
    Logger.log("resetDailyVisits: Data saved to persistent log.");

    // Kosongkan daily report setelah disimpan
    dailyReportSheet.getRange(2, 1, dailyReportLastRow - 1, dailyReportSheet.getLastColumn()).clearContent();
    Logger.log("resetDailyVisits: Daily report sheet cleared.");
  } else {
    Logger.log("resetDailyVisits: No data to save to persistent log.");
  }

  // 4. Reset status absensi di main tab (INI DIPINDAHKAN KE ATAS)
  Logger.log("resetDailyVisits: Resetting main tab...");
  var lastRow = mainSheet.getLastRow();
  Logger.log("resetDailyVisits: mainTab lastRow = " + lastRow);

  if (lastRow > 1) {
    var headers = mainSheet.getRange(1, 1, 1, mainSheet.getLastColumn()).getValues()[0];

    var visitsCountCol = mainSheet.getRange(2, headers.indexOf("Visits Count") + 1, lastRow - 1, 1);
    var lastVisitCol = mainSheet.getRange(2, headers.indexOf("Last Visit") + 1, lastRow - 1, 1);
    var firstTapStatusCol = mainSheet.getRange(2, headers.indexOf("First Tap Status") + 1, lastRow - 1, 1);
    var firstTapTimeCol = mainSheet.getRange(2, headers.indexOf("First Tap Time") + 1, lastRow - 1, 1);

    visitsCountCol.setValues(visitsCountCol.getValues().map(row => [0]));
    lastVisitCol.setValues(lastVisitCol.getValues().map(row => [""]));
    firstTapStatusCol.setValues(firstTapStatusCol.getValues().map(row => [""]));
    firstTapTimeCol.setValues(firstTapTimeCol.getValues().map(row => [""]));

    Logger.log("resetDailyVisits: Main tab reset.");
  } else {
    Logger.log("resetDailyVisits: No data to reset in main tab.");
  }

  // 5. Kosongkan attendance log
  Logger.log("resetDailyVisits: Clearing attendance log...");
  copyAndClearAttendanceLog();
  Logger.log("resetDailyVisits: Attendance log cleared.");

  // 3. Update Cumulative Summary (DIPINDAHKAN KE BAWAH)
  Logger.log("resetDailyVisits: Updating cumulative summary...");
  updateCumulativeSummary();
  Logger.log("resetDailyVisits: Cumulative summary updated.");

  Logger.log("resetDailyVisits: END - " + new Date());
}

// Fungsi pembungkus untuk memanggil generateDailyReport secara manual dari menu
function generateDailyReportManual() {
  generateDailyReport(false); // Panggil dengan false agar tidak mengosongkan attendance log
}

function generateDailyReport(isAutomatedTrigger = false) {
  Logger.log("Starting generateDailyReport (isAutomatedTrigger: " + isAutomatedTrigger + ")...");
  var today = new Date();
  // Laporan untuk HARI SEBELUMNYA.
  today.setDate(today.getDate() - 1);
  var reportDate = Utilities.formatDate(today, timeZone, "dd/MM/yyyy");

  var mainSheet = getMainSheet();
  var dailyReportSheet = getDailyReportSheet();
  var attendanceSheet = getAttendanceLogSheet();

  var mainLastRow = mainSheet.getLastRow();
  var mainData = [];
  if (mainLastRow > 1) {
    mainData = mainSheet.getRange(2, 1, mainLastRow - 1, mainSheet.getLastColumn()).getValues();
  } else {
    Logger.log("Main tab is empty or only has headers. No daily report can be generated from main data.");
  }

  var attendanceLastRow = attendanceSheet.getLastRow();
  var attendanceDataToday = [];
  if (attendanceLastRow > 1) {
    attendanceDataToday = attendanceSheet.getRange(2, 1, attendanceLastRow - 1, attendanceSheet.getLastColumn()).getValues();
  }

  var reportRows = [];
  var reportedUIDsForThisRun = {}; // Untuk melacak UID yang sudah ditambahkan di run ini

  // Ambil data yang sudah ada di daily report untuk mencegah duplikasi
  var dailyReportExistingData = [];
  if (dailyReportSheet.getLastRow() > 1) {
    dailyReportExistingData = dailyReportSheet.getRange(2, 1, dailyReportSheet.getLastRow() - 1, 2).getValues();
  }
  var existingReportKeys = new Set();
  dailyReportExistingData.forEach(row => existingReportKeys.add(row[0] + "|" + row[1])); // "Date|UID"


  // Filter attendanceDataToday untuk tanggal laporan yang relevan
  var filteredAttendanceData = attendanceDataToday.filter(function(row) {
    var dateTimeFromLog = row[0];
    var d = null;
    if (dateTimeFromLog instanceof Date) {
      d = dateTimeFromLog;
    } else {
      d = parseDateTimeString(String(dateTimeFromLog));
    }
    return d && Utilities.formatDate(d, timeZone, "dd/MM/yyyy") === reportDate;
  });

  // Proses setiap UID yang terdaftar di main tab
  for (var i = 0; i < mainData.length; i++) {
    var uid = mainData[i][0];
    var name = mainData[i][1];

    // Lewati jika UID dan tanggal laporan ini sudah ada di daily report
    if (existingReportKeys.has(reportDate + "|" + uid)) {
      continue;
    }

    var statusAbsensi = "Alfa"; // Default status jika tidak ada tap valid
    var firstTapTimeForReport = "";

    var tapsForUIDToday = filteredAttendanceData.filter(function(row) {
      return row[1] === uid; // row[1] adalah UID di attendance log
    });

    if (tapsForUIDToday.length > 0) {
      // Urutkan tap berdasarkan waktu untuk menemukan tap pertama
      tapsForUIDToday.sort(function(a, b) {
        var dateA = (a[0] instanceof Date) ? a[0] : parseDateTimeString(String(a[0]));
        var dateB = (b[0] instanceof Date) ? b[0] : parseDateTimeString(String(b[0]));
        return dateA.getTime() - dateB.getTime();
      });

      var firstValidTap = null;
      for (var j = 0; j < tapsForUIDToday.length; j++) {
        // Hanya pertimbangkan tap yang berada di dalam jam absensi
        if (tapsForUIDToday[j][3] !== "OUTSIDE_ABSEN_HOURS" && tapsForUIDToday[j][3] !== "UNREGISTERED") {
          firstValidTap = tapsForUIDToday[j];
          break;
        }
      }

      if (firstValidTap) {
        var tapDateTime = (firstValidTap[0] instanceof Date) ? firstValidTap[0] : parseDateTimeString(String(firstValidTap[0]));
        firstTapTimeForReport = Utilities.formatDate(tapDateTime, timeZone, "HH:mm:ss");
        statusAbsensi = firstValidTap[3]; // Ambil status absensi dari tap pertama yang valid
      } else {
        statusAbsensi = "Alfa"; // Semua tap yang ada di log adalah di luar jam absensi
      }
    }

    // Tambahkan ke laporan jika belum dilaporkan untuk UID ini di run ini
    if (!reportedUIDsForThisRun[uid]) {
      reportRows.push([
        reportDate,
        uid,
        name,
        statusAbsensi,
        firstTapTimeForReport
      ]);
      reportedUIDsForThisRun[uid] = true;
    }
  }

  // Tulis laporan harian ke sheet daily report
  if (reportRows.length > 0) {
    dailyReportSheet.getRange(dailyReportSheet.getLastRow() + 1, 1, reportRows.length, reportRows[0].length).setValues(reportRows);
    Logger.log("Daily report generated for " + reportDate + ": " + reportRows.length + " entries.");
  } else {
    Logger.log("No new entries to generate daily report for " + reportDate + ".");
  }

  // JANGAN kosongkan attendance log di sini.
}

function updateCumulativeSummary() {
  Logger.log("Starting updateCumulativeSummary (from persistent log with deduplication)...");
  var mainSheet = getMainSheet();
  var persistentLogSheet = getPersistentDailyLogSheet();
  var cumulativeSummarySheet = getCumulativeSummarySheet();

  var mainLastRow = mainSheet.getLastRow();
  var mainData = mainSheet.getRange(2, 1, mainLastRow - 1, 2).getValues();
  var cumulativeMap = {};
  mainData.forEach(row => cumulativeMap[row[0]] = { name: row[1], tepatWaktu: 0, telat: 0, alpha: 0, hariKeberapa: 0 });

  var persistentLogLastRow = persistentLogSheet.getLastRow();
  if (persistentLogLastRow > 1) {
    var persistentLogData = persistentLogSheet.getRange(2, 1, persistentLogLastRow - 1, persistentLogSheet.getLastColumn()).getValues();
    var thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    Logger.log("Tanggal batas bawah untuk kumulatif (30 hari): " + Utilities.formatDate(thirtyDaysAgo, timeZone, "dd/MM/yyyy"));

    var hariKeberapaMap = {};
    var processedKeys = new Set(); // Untuk melacak data yang sudah diproses

    for (var i = 0; i < persistentLogData.length; i++) {
      var row = persistentLogData[i];
      var reportDateValue = row[0]; // Kolom Tanggal
      var reportDateObj = null;
      var uid = row[1]; // Kolom UID
      var status = row[3]; // Kolom Status Absensi

      // Parsing tanggal
      if (reportDateValue instanceof Date) {
        reportDateObj = reportDateValue;
      } else if (typeof reportDateValue === 'string') {
        reportDateObj = parseDateTimeString(reportDateValue + " 00:00:00");
      } else {
        continue;
      }

      if (reportDateObj && reportDateObj.getTime() >= thirtyDaysAgo.getTime() && cumulativeMap.hasOwnProperty(uid)) {
        // Buat kunci unik untuk identifikasi duplikasi
        var key = Utilities.formatDate(reportDateObj, timeZone, "dd/MM/yyyy") + "|" + uid;
        if (processedKeys.has(key)) {
          Logger.log("Data duplikat ditemukan dan dilewati: " + key);
          continue; // Lewati jika sudah diproses
        }
        processedKeys.add(key); // Tandai sebagai sudah diproses

        switch (status) {
          case "Tepat Waktu":
            cumulativeMap[uid].tepatWaktu++;
            break;
          case "Telat":
            cumulativeMap[uid].telat++;
            break;
          case "Alfa":
            cumulativeMap[uid].alpha++;
            break;
        }

        if (!hariKeberapaMap.hasOwnProperty(uid)) {
          hariKeberapaMap[uid] = 1;
        } else {
          hariKeberapaMap[uid]++;
        }
        cumulativeMap[uid].hariKeberapa = hariKeberapaMap[uid];
      }
    }

    var newCumulativeData = Object.keys(cumulativeMap).map(uid => [
      uid,
      cumulativeMap[uid].name,
      cumulativeMap[uid].tepatWaktu,
      cumulativeMap[uid].telat,
      cumulativeMap[uid].alpha,
      cumulativeMap[uid].hariKeberapa
    ]);

    // Bersihkan data lama (kecuali header)
    var lastRowCumulative = cumulativeSummarySheet.getLastRow();
    if (lastRowCumulative > 1) {
      cumulativeSummarySheet.getRange(2, 1, lastRowCumulative - 1, cumulativeSummarySheet.getLastColumn()).clearContent();
    }

    // Tulis data baru
    if (newCumulativeData.length > 0) {
      cumulativeSummarySheet.getRange(2, 1, newCumulativeData.length, newCumulativeData[0].length).setValues(newCumulativeData);
      Logger.log("Cumulative summary (from persistent log with deduplication) updated with " + newCumulativeData.length + " entries.");
    } else {
      Logger.log("Tidak ada data baru untuk memperbarui cumulative summary (from persistent log with deduplication).");
    }

  } else {
    Logger.log("Persistent daily log is empty.");
    cumulativeSummarySheet.getRange(2, 1, cumulativeSummarySheet.getLastRow() - 1, cumulativeSummarySheet.getLastColumn()).clearContent();
  }
}

function copyAndClearAttendanceLog() {
  // Fungsi ini kini hanya mengosongkan attendance log setelah laporan harian dibuat.
  // Tidak perlu menyalin ke history log karena history log sudah mencatat UID tak terdaftar.
  // Dan attendance log ini isinya cuma log absensi hari ini untuk UID terdaftar.
  var attendanceSheet = getAttendanceLogSheet();
  var lastRowAttendance = attendanceSheet.getLastRow();

  if (lastRowAttendance <= 1) {
    Logger.log("No attendance log data to clear.");
    return;
  }

  attendanceSheet.getRange(2, 1, lastRowAttendance - 1, attendanceSheet.getLastColumn()).clearContent();
  Logger.log("Attendance log data cleared.");
}

function getPersistentDailyLogSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var persistentDailyLogSheet = ss.getSheetByName(persistentDailyLogSheetName);
  if (!persistentDailyLogSheet) {
    var rowDataPersistentLog = ['Date', 'UID', 'Name', 'Status Absensi', 'First Tap Time', 'Processed On'];
    persistentDailyLogSheet = ss.insertSheet(persistentDailyLogSheetName);
    persistentDailyLogSheet.getRange(1, 1, 1, rowDataPersistentLog.length).setValues([rowDataPersistentLog]);
    persistentDailyLogSheet.setColumnWidths(1, rowDataPersistentLog.length, 150);
  }
  return persistentDailyLogSheet;
}

function _saveDailyReportToPersistentLog() {
  // var ui = SpreadsheetApp.getUi();
  var persistentDailyLogSheetName = "persistent daily log"; // Definisikan di sini

  var response = ui.alert(
    'Apakah Anda yakin ingin menyimpan data laporan harian ke "' + persistentDailyLogSheetName + '"?',
    ui.ButtonSet.YES_NO
  );

  if (response == ui.Button.YES) {
    var dailyReportSheet = getDailyReportSheet();
    var persistentLogSheet = getPersistentDailyLogSheet(); // Gunakan fungsi ini
    var dailyReportLastRow = dailyReportSheet.getLastRow();

    if (dailyReportLastRow > 1) {
      var dailyReportData = dailyReportSheet.getRange(2, 1, dailyReportLastRow - 1, dailyReportSheet.getLastColumn()).getValues();
      var now = new Date();
      var processedOn = Utilities.formatDate(now, timeZone, dateTimeFormat);
      var persistentLogData = dailyReportData.map(row => [...row, processedOn]); // Tambahkan kolom "Processed On"

      persistentLogSheet.getRange(persistentLogSheet.getLastRow() + 1, 1, persistentLogData.length, persistentLogData[0].length).setValues(persistentLogData);
      ui.alert(dailyReportData.length + " entri berhasil ditambahkan ke '" + persistentDailyLogSheetName + "'.");
    } else {
      ui.alert("Tidak ada data di '" + dailyReportSheetName + "' untuk disimpan.");
    }
  } else {
    ui.alert("Penyimpanan laporan harian dibatalkan.");
  }
}