// =============================================================================
// main.js — Application entry point
// =============================================================================

// Global error handler — logs full stack to console for debugging
window.addEventListener("error", function (e) {
  console.error("[AdoptDash error]", e.message, "\nat", e.filename, "line", e.lineno, "\n", e.error && e.error.stack ? e.error.stack : "(no stack)");
});
window.addEventListener("unhandledrejection", function (e) {
  console.error("[AdoptDash unhandled promise rejection]", e.reason && e.reason.stack ? e.reason.stack : e.reason);
});

// Store file metadata globally so tabs can access it
var APP_DATA = null;
var APP_FILE_META = null;
var APP_FILTER_STATE = { details: null, lifecycle: null, cpiAdopt: null, customer: null, testing: null, overview: null, pvi: null, compare: null };
var APP_IS_DISTI = false;
var APP_GEO_FILTER = "";   // BE GEO ID filter — applies to all tabs
var APP_MULTI_SESSIONS = null;
var APP_EXCL_ACTIVE = false;
var APP_VERSION = "v1.4";
// Use the browser's preferred language for date formatting (respects user's browser locale setting)
var APP_LOCALE = navigator.language || undefined;
// Holds a FileSystemFileHandle from showOpenFilePicker() to be persisted after load
var PENDING_FILE_HANDLE = null;
document.addEventListener("DOMContentLoaded", function () {
  var el = document.getElementById("app-version-label");
  if (el) el.textContent = APP_VERSION;
});

// Workspan column names used to auto-detect the header row
var KNOWN_COLUMNS = [
  "Deal WS-ID", "Partner Name", "CR Party Name", "Track", "Sub-Track",
  "Stage", "CR Party ID", "BE GEO ID", "Program Type", "Booking Date",
  "Incentive Level", "Adopt Rebate Opt-In Status", "Deal Incentive Expiry Date"
];

document.addEventListener("DOMContentLoaded", init);

function init() {
  // Check IndexedDB for cached datasets and render resume cards if found
  IDB.loadAllMeta().then(function (entries) {
    restoreUploadSection(entries);
  }).catch(function () {
    restoreUploadSection([]);
  });

  document.querySelectorAll('[data-bs-toggle="tab"]').forEach(function (tab) {
    tab.addEventListener("shown.bs.tab", function (e) {
      if (!APP_DATA) return;
      // Remove CPI Adopt scroll nav when leaving that tab
      if (e.target.dataset.bsTarget !== "#tab-testing") {
        var nav = document.getElementById("cpi-scroll-nav");
        if (nav) nav.remove();
      }
      // Hide the BE GEO ID filter on the Leaderboard tab (compares all entities)
      var geoSlot = document.getElementById("ovw-begeoid-tab-slot");
      if (geoSlot) geoSlot.classList.toggle("d-none", e.target.dataset.bsTarget === "#tab-compare");
      renderActiveTab(e.target.dataset.bsTarget);
    });
  });
}

function showLoader(message) {
  var overlay = document.getElementById("loader-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "loader-overlay";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(255,255,255,0.92);z-index:9998;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem";
    document.body.appendChild(overlay);
  }
  overlay.innerHTML =
    '<div class="spinner-border text-primary" style="width:3rem;height:3rem;" role="status"></div>' +
    '<p class="text-muted mb-0" id="loader-msg">' + (message || "Loading…") + '</p>';
  overlay.style.display = "flex";
}

function updateLoaderMsg(msg) {
  var el = document.getElementById("loader-msg");
  if (el) el.textContent = msg;
}

function showRefreshToast(msg) {
  var existing = document.getElementById("refresh-toast");
  if (existing) existing.remove();
  var toast = document.createElement("div");
  toast.id = "refresh-toast";
  toast.style.cssText = "position:fixed;bottom:1.25rem;right:1.25rem;z-index:9999;background:#fff;border:1px solid #dee2e6;border-radius:.5rem;box-shadow:0 4px 16px rgba(0,0,0,.15);padding:.6rem 1rem;display:flex;align-items:center;gap:.6rem;font-size:.875rem;color:#333;min-width:200px;";
  toast.innerHTML = '<div class="spinner-border spinner-border-sm text-primary flex-shrink-0" role="status"></div><span id="refresh-toast-msg">' + (msg || "Refreshing\u2026") + '</span>';
  document.body.appendChild(toast);
}

function hideRefreshToast() {
  var t = document.getElementById("refresh-toast");
  if (t) t.remove();
}


// Find which row in the 2-D array contains the Workspan column headers.
// Returns the row index, or -1 if nothing plausible is found.
function findHeaderRowIndex(rows2d) {
  var bestIdx = -1;
  var bestScore = 0;
  for (var i = 0; i < Math.min(rows2d.length, 50); i++) {
    var row = rows2d[i];
    if (!row) continue;
    var matchCount = 0;
    for (var j = 0; j < row.length; j++) {
      var cell = row[j];
      if (cell && KNOWN_COLUMNS.indexOf(String(cell).trim()) !== -1) matchCount++;
    }
    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestIdx = i;
    }
    if (matchCount >= 3) break;  // good enough, stop early
  }
  // Accept if we found at least 1 known column, otherwise fall back to row 0
  return bestScore >= 1 ? bestIdx : 0;
}

// Convert a 2-D array (header row + data rows) to array-of-objects
function rows2dToObjects(rows2d, headerIdx) {
  var headers = rows2d[headerIdx].map(function (h) { return h === null || h === undefined ? "" : String(h).trim(); });
  var result = [];
  for (var i = headerIdx + 1; i < rows2d.length; i++) {
    var row = rows2d[i];
    if (!row) continue;
    // Skip entirely blank rows
    var hasData = false;
    for (var j = 0; j < row.length; j++) { if (row[j] !== null && row[j] !== undefined && row[j] !== "") { hasData = true; break; } }
    if (!hasData) continue;
    var obj = {};
    for (var k = 0; k < headers.length; k++) {
      if (headers[k]) obj[headers[k]] = row[k] !== undefined ? row[k] : null;
    }
    result.push(obj);
  }
  return result;
}

function handleFileUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  PENDING_FILE_HANDLE = null; // fallback path — no persistent handle
  processPartnerFile(file);
}

function processPartnerFile(file) {
  var ext = file.name.split(".").pop().toLowerCase();
  var sizeMB = file.size / (1024 * 1024);

  // Warn early for large XLSX — don't even attempt, it will crash the browser tab
  if (ext !== "csv" && sizeMB > 20) {
    var msg =
      "This Excel file is " + sizeMB.toFixed(0) + " MB, which is too large to load in the browser.\n\n" +
      "Please export your Workspan report as CSV instead:\n" +
      "  1. In Workspan, run report 19849 (Partners) or 21766 (Distributors)\n" +
      "  2. Click Export → CSV\n" +
      "  3. Upload the .csv file here\n\n" +
      "CSV files of any size work perfectly — there is no size limit.";
    alert(msg);
    PENDING_FILE_HANDLE = null;
    return;
  }

  showLoader("Reading file — this may take a moment for large files…");

  // Store file metadata for display in tabs
  APP_FILE_META = {
    name: file.name,
    lastModified: file.lastModified ? new Date(file.lastModified) : null
  };

  if (ext === "csv") {
    handleCSV(file);
  } else {
    handleXLSX(file);
  }
}


// ── CSV path: PapaParse streams the file — handles millions of rows ──────────

// Workspan CSV exports quote every field but does NOT escape inner double-quotes
// as "" (RFC 4180). The only real field-closing quote is one immediately followed
// by , \r \n or end-of-string. Every other " inside a field is a literal character
// and gets escaped as "" so PapaParse can handle it correctly.
function fixUnescapedCsvQuotes(text) {
  var out = [];
  var i = 0;
  var len = text.length;
  while (i < len) {
    var ch = text[i];
    if (ch === '"') {
      out.push('"');
      i++;
      // Scan inside a quoted field
      while (i < len) {
        var c = text[i];
        if (c === '"') {
          var next = i + 1 < len ? text[i + 1] : null;
          if (next === null || next === ',' || next === '\r' || next === '\n') {
            // Only a real field-closing quote if followed by delimiter/newline/end
            out.push('"');
            i++;
            break;
          } else {
            // Literal " inside the field — escape it
            out.push('""');
            i++;
          }
        } else {
          out.push(c);
          i++;
        }
      }
    } else {
      out.push(ch);
      i++;
    }
  }
  return out.join('');
}

function readFileAsText(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload  = function (e) { resolve(e.target.result); };
    reader.onerror = function ()  { reject(new Error('Failed to read file as text')); };
    reader.readAsText(file);
  });
}

function handleCSV(file) {
  readFileAsText(file).then(function (rawText) {
    var text = fixUnescapedCsvQuotes(rawText);
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,  // keep raw strings; transform.js handles types
      complete: function(results) {
        if (!results.data || results.data.length === 0) {
          restoreUploadSection();
          alert("The CSV file appears to be empty or has no data rows.");
          return;
        }
        updateLoaderMsg("Processing " + results.data.length.toLocaleString() + " rows…");
        setTimeout(function() {
          try {
            APP_DATA = transformData(results.data);
            var _wsGeoIds = [];
            APP_DATA.forEach(function(r) { var v = String(r["BE GEO ID"] || "").trim(); if (v && _wsGeoIds.indexOf(v) === -1) _wsGeoIds.push(v); });
            _wsGeoIds.sort();
            var _wsIdbKey = _wsGeoIds.length > 0 ? "ws-geo-" + _wsGeoIds.join("_") : "ws-" + file.name;
            finishLoad(file.name, APP_DATA.length, false, _wsIdbKey);
          } catch(err) {
            restoreUploadSection([]);
            console.error(err);
            alert("Error processing data: " + err.message);
          }
        }, 50);
      },
      error: function(err) {
        restoreUploadSection();
        alert("Error reading CSV: " + err.message);
      }
    });
  }).catch(function (err) {
    restoreUploadSection();
    alert("Error reading CSV file: " + err.message);
  });
}

// ── XLSX path: runs in a Web Worker to avoid main-thread memory limits ───────
function fallbackXLSXMainThreadFromFile(file, reason) {
  if (reason) console.warn('Falling back to main-thread XLSX parse:', reason);
  updateLoaderMsg('Retrying parse on main thread…');

  var retryReader = new FileReader();
  retryReader.onload = function (evt) {
    try {
      handleXLSXMainThread(evt.target.result, file.name);
    } catch (fallbackErr) {
      restoreUploadSection();
      console.error(fallbackErr);
      alert('Error reading Excel file: ' + fallbackErr.message);
    }
  };
  retryReader.onerror = function (evtErr) {
    restoreUploadSection();
    alert('Error reading Excel file: ' + (evtErr && evtErr.message ? evtErr.message : 'Failed to read file'));
  };
  retryReader.readAsArrayBuffer(file);
}

function handleXLSX(file) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var buffer = e.target.result;
    var isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent || '');

    // Try Worker first (better memory headroom, non-blocking)
    var workerSupported = (typeof Worker !== 'undefined');

    if (workerSupported) {
      try {
        // Use a blob worker so it works from file:// protocol
        var workerSrc = 'js/xlsx-worker.js';
        var worker = new Worker(workerSrc);

        worker.onmessage = function (ev) {
          var msg = ev.data;
          if (msg.type === 'progress') {
            updateLoaderMsg(msg.msg);
          } else if (msg.type === 'done') {
            worker.terminate();
            parseCSVAndFinish(msg.csv, file.name, msg.headerIdx > 0);
          } else if (msg.type === 'error') {
            worker.terminate();
            restoreUploadSection();
            alert('Error reading Excel file:\n' + msg.msg);
          }
        };

        worker.onerror = function (err) {
          worker.terminate();
          // Worker failed (e.g. file:// blocked importScripts) — re-read safely for fallback
          fallbackXLSXMainThreadFromFile(file, err && err.message ? err.message : 'Worker runtime error');
        };

        // Firefox can report detached ArrayBuffer issues with transferable upload buffers.
        // Avoid transfer-list semantics there and let structured clone copy the data.
        if (isFirefox) {
          worker.postMessage(buffer);
        } else {
          worker.postMessage(buffer, [buffer]);
        }
        return;
      } catch (workerErr) {
        fallbackXLSXMainThreadFromFile(file, workerErr && workerErr.message ? workerErr.message : 'Worker start failure');
        return;
      }
    }

    // Fallback: run on main thread
    handleXLSXMainThread(buffer, file.name);
  };
  reader.readAsArrayBuffer(file);
}

// Main-thread XLSX fallback (same logic as worker but synchronous)
function handleXLSXMainThread(buffer, filename) {
  setTimeout(function () {
    try {
      updateLoaderMsg('Parsing Excel file…');
      var wb = XLSX.read(buffer, {
        type: 'array',
        cellDates: false,
        cellHTML: false,
        cellStyles: false,
        cellFormula: false,
        dense: true
      });

      updateLoaderMsg('Detecting data layout…');
      var sheetName = null, headerIdx = 0;

      for (var si = 0; si < wb.SheetNames.length; si++) {
        var candidateSheet = wb.Sheets[wb.SheetNames[si]];
        if (!candidateSheet || !candidateSheet['!ref']) continue;
        var preview = XLSX.utils.sheet_to_json(candidateSheet, { header: 1, defval: null, raw: true, sheetRows: 15 });
        if (!preview || preview.length === 0) continue;
        var hi = findHeaderRowIndex(preview);
        var hrow = preview[hi] || [];
        var score = 0;
        for (var ci = 0; ci < hrow.length; ci++) {
          if (hrow[ci] && KNOWN_COLUMNS.indexOf(String(hrow[ci]).trim()) !== -1) score++;
        }
        if (score > 0) { sheetName = wb.SheetNames[si]; headerIdx = hi; break; }
      }
      if (!sheetName) {
        for (var si2 = 0; si2 < wb.SheetNames.length; si2++) {
          var fs = wb.Sheets[wb.SheetNames[si2]];
          if (fs && fs['!ref']) { sheetName = wb.SheetNames[si2]; break; }
        }
      }
      if (!sheetName) {
        restoreUploadSection();
        alert('No readable sheets found. Sheets: ' + wb.SheetNames.join(', '));
        return;
      }

      updateLoaderMsg('Converting to CSV…');
      var csvString = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName], { defval: '' });
      if (headerIdx > 0) {
        var lines = csvString.split('\n');
        csvString = lines.slice(headerIdx).join('\n');
      }

      parseCSVAndFinish(csvString, filename, headerIdx > 0);
    } catch (err) {
      restoreUploadSection();
      console.error(err);
      alert('Error reading Excel file: ' + err.message);
    }
  }, 50);
}

// Shared final step: PapaParse the CSV string → transform → display
function parseCSVAndFinish(csvString, filename, headerAutoDetected) {
  if (!csvString || csvString.trim() === '') {
    restoreUploadSection();
    alert('The sheet appears to be empty after reading.');
    return;
  }
  updateLoaderMsg('Parsing rows…');
  Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    complete: function (results) {
      if (!results.data || results.data.length === 0) {
        restoreUploadSection();
        alert('No data rows found.');
        return;
      }
      updateLoaderMsg('Processing ' + results.data.length.toLocaleString() + ' rows…');
      setTimeout(function () {
        try {
          APP_DATA = transformData(results.data);
          var _wsGeoIds2 = [];
          APP_DATA.forEach(function(r) { var v = String(r["BE GEO ID"] || "").trim(); if (v && _wsGeoIds2.indexOf(v) === -1) _wsGeoIds2.push(v); });
          _wsGeoIds2.sort();
          var _wsIdbKey2 = _wsGeoIds2.length > 0 ? "ws-geo-" + _wsGeoIds2.join("_") : "ws-" + filename;
          finishLoad(filename, APP_DATA.length, headerAutoDetected, _wsIdbKey2);
        } catch (err) {
          restoreUploadSection();
          console.error(err);
          alert('Error processing data: ' + err.message);
        }
      }, 50);
    },
    error: function (err) {
      restoreUploadSection();
      alert('Error parsing sheet: ' + err.message);
    }
  });
}

function finishLoad(filename, rowCount, headerAutoDetected, idbType, loadedAt, fromCache) {
  // Sync disti flag — detect from data if transformData didn't run (cache load)
  APP_IS_DISTI = !!window.APP_IS_DISTI ||
    !!(APP_DATA && APP_DATA.length > 0 && APP_DATA.some(function(r) {
      return r["Disti name"] && String(r["Disti name"]).trim() !== "";
    }));
  window.APP_IS_DISTI = APP_IS_DISTI;

  // Extract display name from data
  var displayName = "";
  if (APP_DATA && APP_DATA.length > 0) {
    if (APP_IS_DISTI) {
      var distiNames = [];
      APP_DATA.forEach(function(r) { if (r["Disti name"]) distiNames.push(String(r["Disti name"]).trim()); });
      var uniqueDisti = Array.from(new Set(distiNames)).filter(Boolean);
      displayName = uniqueDisti.slice(0, 2).join(", ") + (uniqueDisti.length > 2 ? " +" + (uniqueDisti.length - 2) + " more" : "");
    } else {
      var partnerNames = [];
      APP_DATA.forEach(function(r) { if (r["Partner Name"]) partnerNames.push(String(r["Partner Name"]).trim()); });
      var uniquePartners = Array.from(new Set(partnerNames)).filter(Boolean);
      displayName = uniquePartners.slice(0, 2).join(", ") + (uniquePartners.length > 2 ? " +" + (uniquePartners.length - 2) + " more" : "");
    }
  }

  // Save to IndexedDB (fire-and-forget)
  if (idbType && APP_DATA) {
    var beGeoIds = [];
    APP_DATA.forEach(function(r) { var v = String(r["BE GEO ID"] || "").trim(); if (v && beGeoIds.indexOf(v) === -1) beGeoIds.push(v); });
    var _pendingHandle = PENDING_FILE_HANDLE;
    PENDING_FILE_HANDLE = null;
    IDB.save(idbType, APP_DATA, {
      filename:         filename,
      rowCount:         rowCount,
      loadedAt:         fromCache ? loadedAt : new Date().toISOString(),
      fileLastModified: APP_FILE_META && APP_FILE_META.lastModified ? APP_FILE_META.lastModified.toISOString() : null,
      displayName:      displayName,
      beGeoIds:         beGeoIds,
      isDisti:          APP_IS_DISTI,
      hasFileHandle:    !!_pendingHandle,
      scopeType:        APP_FILE_META && APP_FILE_META._scopeType  ? APP_FILE_META._scopeType  : "region",
      scopeLabel:       APP_FILE_META && APP_FILE_META._scopeLabel ? APP_FILE_META._scopeLabel : ""
    }).catch(function (e) {
      console.warn("IDB save failed (dataset too large for browser cache):", e);
      // Keep the session metadata — Resume will reload from file handle instead.
      // Only remove the card if there's no file handle to fall back on.
      if (!_pendingHandle) {
        IDB.remove(idbType);
        setTimeout(function() { alert("This dataset is too large to cache and no file handle is available.\nPlease re-upload the file each time."); }, 200);
      }
      // else: session card stays, Resume auto-reloads from file handle silently
    });
    if (_pendingHandle) {
      IDB.saveHandle(idbType, _pendingHandle).catch(function(e) { console.warn("Handle save failed:", e); });
    }
  }

  restoreUploadSection([]);  // clear upload section
  document.getElementById("upload-section").classList.add("d-none");
  document.getElementById("mainTabContent").classList.remove("d-none");
  document.getElementById("main-tab-bar").classList.remove("d-none");

  // Populate BE GEO ID global filter dropdown + partner/file date in tab bar slot
  APP_GEO_FILTER = "";
  (function() {
    var slot = document.getElementById("ovw-begeoid-tab-slot");
    if (!slot) return;

    var beGeoIds = [];
    if (APP_DATA) APP_DATA.forEach(function(r) { var v = String(r["BE GEO ID"] || "").trim(); if (v && beGeoIds.indexOf(v) === -1) beGeoIds.push(v); });
    beGeoIds.sort();

    // Build BE GEO ID → all partner names map
    var beGeoToPartners = {};
    if (APP_DATA) {
      var nameKey = APP_IS_DISTI ? "Disti name" : "Partner Name";
      APP_DATA.forEach(function(r) {
        var v = String(r["BE GEO ID"] || "").trim();
        var n = String(r[nameKey] || "").trim();
        if (v && n) {
          if (!beGeoToPartners[v]) beGeoToPartners[v] = [];
          if (beGeoToPartners[v].indexOf(n) === -1) beGeoToPartners[v].push(n);
        }
      });
    }

    // Compute partner label for display (all unique partners across all GEOs)
    var partnerNames = [];
    if (APP_DATA) {
      var nameKey2 = APP_IS_DISTI ? "Disti name" : "Partner Name";
      APP_DATA.forEach(function(r) { var n = String(r[nameKey2] || "").trim(); if (n && partnerNames.indexOf(n) === -1) partnerNames.push(n); });
      partnerNames.sort();
    }
    var partnerLabel = partnerNames.length === 0 ? ""
                     : partnerNames.slice(0, 3).join(", ") + (partnerNames.length > 3 ? " +" + (partnerNames.length - 3) + " more" : "");

    // Compute file date
    var fileDateLabel = "";
    if (APP_FILE_META && APP_FILE_META.lastModified) {
      fileDateLabel = APP_FILE_META.lastModified.toLocaleDateString(APP_LOCALE, { year: "numeric", month: "short", day: "numeric" });
    } else if (APP_FILE_META && APP_FILE_META.cachedAt) {
      fileDateLabel = APP_FILE_META.cachedAt.toLocaleDateString(APP_LOCALE, { year: "numeric", month: "short", day: "numeric" });
    }

    var html = "";
    if (partnerLabel) {
      html += '<span id="ovw-partner-label" style="font-size:0.75rem;color:#9aa5b1;white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis" title="' + partnerLabel.replace(/"/g, "&quot;") + '">' + partnerLabel + '</span>';
    }
    if (fileDateLabel) {
      html += '<span style="font-size:0.75rem;color:#9aa5b1;white-space:nowrap">' + fileDateLabel + '</span>';
    }
    if (beGeoIds.length > 0) {
      html += '<select id="ovw-begeoid-sel" class="form-select form-select-sm" style="width:auto;font-size:0.82rem;border-color:#0070d2;color:#0070d2;font-weight:600">' +
        '<option value="" data-short="All BE GEO IDs (' + beGeoIds.length + ')" data-long="All BE GEO IDs (' + beGeoIds.length + ')">All BE GEO IDs (' + beGeoIds.length + ')</option>' +
        beGeoIds.map(function(id) {
          var partners = beGeoToPartners[id] || [];
          var longLabel = partners.length > 0 ? id + ' \u2014 ' + partners.join(', ') : id;
          return '<option value="' + id.replace(/"/g, '&quot;') + '" data-short="' + id.replace(/"/g, '&quot;') + '" data-long="' + longLabel.replace(/"/g, '&quot;') + '">' + id + '</option>';
        }).join("") +
        '</select>';
    }

    if (!html) { slot.innerHTML = ""; slot.classList.add("d-none"); return; }
    slot.innerHTML = html;
    slot.classList.remove("d-none");

    if (beGeoIds.length > 0) {
      var sel = document.getElementById("ovw-begeoid-sel");

      // Swap to long labels when dropdown opens, short labels when it closes
      sel.addEventListener("mousedown", function() {
        Array.prototype.forEach.call(this.options, function(opt) {
          opt.textContent = opt.dataset.long;
        });
      });
      function restoreShortLabels() {
        Array.prototype.forEach.call(sel.options, function(opt) {
          opt.textContent = opt.dataset.short;
        });
      }
      sel.addEventListener("change", function() {
        APP_GEO_FILTER = this.value;
        restoreShortLabels();
        var activeTab = document.querySelector(".nav-link.active[data-bs-target]");
        if (activeTab) renderActiveTab(activeTab.dataset.bsTarget);
      });
      sel.addEventListener("blur", restoreShortLabels);
    }
  })();
  renderMultiPicker(); // re-render persistent session bar (highlights active, keeps others)

  var pviTab = document.getElementById("tab-pvi-btn");
  if (pviTab) pviTab.closest("li").classList.toggle("d-none", APP_IS_DISTI);
  var sb = document.getElementById("status-bar");
  sb.classList.remove("d-none");
  sb.classList.add("d-flex");
  document.getElementById("status-filename").textContent = filename;
  document.getElementById("status-rows").textContent =
    rowCount.toLocaleString() + " rows" +
    (headerAutoDetected ? " · header auto-detected" : "");
  var dateEl = document.getElementById("status-date");
  dateEl.textContent = "";

  var activeTab = document.querySelector(".nav-link.active[data-bs-target]");
  var _activeTarget = activeTab ? activeTab.dataset.bsTarget : "#tab-overview";
  ANNOTATIONS.load().then(function () {
    renderActiveTab(_activeTarget);
  }).catch(function (err) {
    console.warn("[AdoptDash] ANNOTATIONS.load() failed, rendering anyway:", err);
    renderActiveTab(_activeTarget);
  });
  // Always reset first so no dismissed state bleeds from a previous session
  window._currentSessionKey = idbType || null;
}

function restoreUploadSection(cachedEntries) {
  cachedEntries = cachedEntries || [];
  var overlay = document.getElementById("loader-overlay");
  if (overlay) overlay.style.display = "none";
  var sec = document.getElementById("upload-section");
  sec.classList.remove("d-none");
  var isChrome = typeof navigator !== 'undefined' && /chrome/i.test(navigator.userAgent || '') && !/edg/i.test(navigator.userAgent || '');

  function fmtDate(iso) {
    if (!iso) return "";
    var d = (iso instanceof Date) ? iso : new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(APP_LOCALE) + " " + d.toLocaleTimeString(APP_LOCALE, { hour: "2-digit", minute: "2-digit" });
  }

  function resumeCard(entry) {
    var key = entry.type; // e.g. "cpi-EMEA", "cpi-EMEA-th:Southern Europe", "cpi-EMEA-co:France"
    var region = key.replace(/^cpi-/, "").replace(/-(th|co|bgeo):.*$/, "");
    var scopeType  = entry.meta.scopeType  || "region";
    var scopeLabel = entry.meta.scopeLabel || "";
    var scopeStr = scopeType === "theater" ? "Theater: " + scopeLabel
                 : scopeType === "country" ? "Country: " + scopeLabel
                 : scopeType === "begeoid" ? "BE GEO IDs: " + scopeLabel
                 : "Whole Region";
    var html = '<div class="col"><div class="card border-warning mb-2 p-2">';
    html += '<div class="d-flex justify-content-between align-items-start gap-2">';
    html += '<div style="min-width:0">';
    html += '<div class="fw-semibold small">' + region + ' &mdash; ' + scopeStr + '</div>';
    html += '<div class="text-muted" style="font-size:0.72rem">' + (entry.meta.rowCount||0).toLocaleString() + ' rows</div>';
    var basename = (entry.meta.filename || '').split(/[\\/]/).pop();
    var dateStr = fmtDate(entry.meta.loadedAt);
    html += '<div class="text-muted text-truncate" style="font-size:0.72rem" title="' + entry.meta.filename + '">' + basename + '</div>';
    if (dateStr) html += '<div class="text-muted" style="font-size:0.72rem">' + dateStr + '</div>';
    html += '</div>';
    html += '<div class="d-flex gap-1 flex-shrink-0">';
    html += '<button class="btn btn-sm btn-warning idb-resume-btn py-0" data-idbtype="' + entry.type + '" title="Resume"><i class="bi bi-play-fill"></i></button>';
    if (entry.meta.hasFileHandle || isChrome) {
      html += '<button class="btn btn-sm btn-outline-primary idb-refresh-btn py-0" data-idbtype="' + entry.type + '" title="Refresh from file"><i class="bi bi-arrow-clockwise"></i></button>';
    }
    html += '<button class="btn btn-sm btn-outline-danger idb-clear-btn py-0" data-idbtype="' + entry.type + '" title="Delete"><i class="bi bi-trash"></i></button>';
    html += '</div></div></div></div>';
    return html;
  }

  // Collect cached CPI (region-level) entries
  var cpiEntries = [];
  cachedEntries.forEach(function (e) {
    if (e.type.indexOf("cpi-") === 0) cpiEntries.push(e);
  });

  // ── Compute week options: Latest, then previous weeks down to 2026W23 ─────
  var savedRegion = localStorage.getItem("AdoptDash_Internal_lci-region") || "EMEA";
  function getISOWeek(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return { year: d.getUTCFullYear(), week: Math.ceil((((d - yearStart) / 86400000) + 1) / 7) };
  }
  var now = getISOWeek(new Date());
  var weekOptions = '<option value="">Latest</option>';
  for (var w = now.week - 1; w >= 23; w--) {
    var wLabel = now.year + "W" + (w < 10 ? "0" + w : w);
    weekOptions += '<option value="' + wLabel + '">' + wLabel + '</option>';
  }

  // ── Build two-column layout ───────────────────────────────────────────────
  sec.innerHTML =
    '<div class="container-fluid py-4" style="max-width:1400px">' +
    '<div class="row g-4">' +

    // ── Left col: file picker + previous sessions ──────────────────────────
    '<div class="col-12" id="upload-left-col">' +
    '<div id="upload-left-inner" style="max-width:560px;margin:0 auto">' +

    // Cisco CPI card
    '<div class="card shadow-sm border-warning mb-3">' +
    '<div class="card-header bg-warning bg-opacity-10 fw-semibold" style="font-size:0.9rem"><i class="bi bi-lock-fill me-2 text-warning"></i>Cisco-internal</div>' +
    '<div class="card-body p-4 text-center">' +
    '<p class="small mb-3"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="16" height="16" style="vertical-align:-2px;margin-right:4px"><path d="M50,0 A50,50 0 0,1 93.3,75 L50,50Z" fill="#EA4335"/><path d="M93.3,75 A50,50 0 0,1 6.7,75 L50,50Z" fill="#FBBC05"/><path d="M6.7,75 A50,50 0 0,1 50,0 L50,50Z" fill="#34A853"/><circle cx="50" cy="50" r="33" fill="white"/><circle cx="50" cy="50" r="20" fill="#4285F4"/></svg><strong>Chrome recommended for the best experience.</strong></p>' +
    '<div class="row g-2 mb-3 align-items-end">' +
    '<div class="col-auto"><label class="form-label small fw-semibold mb-1">Region</label>' +
    '<select id="lci-region" class="form-select form-select-sm">' +
    ['EMEA','AMER','APJC','DISTI'].map(function(r){ return '<option value="'+r+'"'+(r===savedRegion?' selected':'')+'>'+r+'</option>'; }).join('') +
    '</select></div>'+
    '<div class="col-auto"><label class="form-label small fw-semibold mb-1">Week</label>' +
    '<select id="lci-week" class="form-select form-select-sm">' + weekOptions + '</select></div>' +
    '</div>' +
    '<div id="lci-error" class="alert alert-danger py-2 px-3 small mb-3 d-none"></div>' +
    '<div id="lci-session-picker" class="d-none"></div>' +
    '<div id="lci-last-file-hint" class="d-none mb-2 text-start small">' +
    '<i class="bi bi-file-earmark-check me-1 text-success"></i>' +
    '<span id="lci-last-file-name" class="fw-semibold"></span>' +
    '</div>' +
    '<div class="d-flex align-items-center gap-3 flex-wrap">' +
    '<p id="lci-onedrive-hint" class="text-muted small mb-0">Locate the <span id="lci-file-hint-text" class="fw-semibold fst-italic"></span> file in your OneDrive.</p>' +
    '<button id="lci-load-btn" class="btn btn-warning px-4"><i class="bi bi-folder2-open me-2"></i>Load CPI File…</button>' +
    '<input type="file" id="lci-file-input" accept=".csv" class="d-none" />' +
    '</div>'+
    '</div></div>' +

    '</div>' + // /upload-left-inner
    '</div>' + // /left col

    // ── Right col: scope picker (shown after file load) ────────────────────
    '<div class="col-12 col-lg-7" id="scope-panel-col" style="display:none">' +
    '<div id="scope-panel"></div>' +
    '</div>' +

    '</div>' + // /row

    // Previous CPI sessions — full width below both columns
    (function() {
      if (cpiEntries.length === 0) return '';
      return '<div class="card shadow-sm border-warning mt-2">' +
        '<div class="card-header bg-warning bg-opacity-10 fw-semibold d-flex justify-content-between align-items-center gap-2" style="font-size:0.85rem"><span><i class="bi bi-lightning-charge-fill me-2 text-warning"></i>Previous sessions</span>' +
        (isChrome ? '<button id="cpi-refresh-all-btn" class="btn btn-sm btn-outline-primary py-0 flex-shrink-0" title="Refresh all previous sessions"><i class="bi bi-arrow-clockwise me-1"></i>Refresh all</button>' : '') +
        '</div>' +
        '<div class="card-body p-2" id="cpi-prev-sessions-body"><div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-2">' +
        cpiEntries.map(resumeCard).join("") +
        '</div></div></div>';
    })()+
    // ── Clear all data button ─────────────────────────────────────────────
    '<div class="text-center mt-2 mb-1">' +
    '<p class="text-muted small mb-2"><i class="bi bi-shield-lock me-1"></i>All data is processed entirely in your browser — nothing is sent to any server.</p>' +
    '<button id="clear-all-btn" class="btn btn-sm btn-outline-danger"><i class="bi bi-trash me-1"></i>Clear all browser data</button>' +
    '</div>'+
    '</div>'; // /container

  // ── Resume / Clear cache buttons ─────────────────────────────────────────
  sec.querySelectorAll(".idb-resume-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var type = this.dataset.idbtype;
      showLoader("Loading from cache…");
      IDB.load(type).then(function (entry) {
        if (entry && entry.data) {
          // Cache hit — load normally
          APP_DATA = entry.data;
          APP_FILE_META = { name: entry.meta.filename, lastModified: entry.meta.fileLastModified ? new Date(entry.meta.fileLastModified) : null, cachedAt: entry.meta.loadedAt ? new Date(entry.meta.loadedAt) : null, _scopeType: entry.meta.scopeType || "region", _scopeLabel: entry.meta.scopeLabel || "" };
          window.APP_IS_DISTI = !!entry.meta.isDisti;
          finishLoad(entry.meta.filename, entry.meta.rowCount, false, type, entry.meta.loadedAt, true);
        } else {
          // Cache miss — try to reload from file handle
          IDB.loadHandle(type).then(function(handle) {
            if (handle) {
              refreshFromHandle(type, false).catch(function() {
                IDB.loadAllMeta().then(function(e){ restoreUploadSection(e); });
              });
            } else {
              IDB.remove(type);
              IDB.loadAllMeta().then(function(e){ restoreUploadSection(e); });
              alert("Cache not found and no file handle available. Please re-upload the file.");
            }
          });
        }
      }).catch(function (e) { IDB.loadAllMeta().then(function(en){restoreUploadSection(en);}); alert("Error loading cache: " + e); });
    });
  });

  sec.querySelectorAll(".idb-clear-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var type = this.dataset.idbtype;
      // Load session data first to collect WS-IDs, then delete annotations for them
      IDB.load(type).then(function (entry) {
        var wsIds = [];
        if (entry && entry.data) {
          entry.data.forEach(function (r) {
            var id = String(r["Deal WS-ID"] || "");
            if (id) wsIds.push(id);
          });
        }
        return IDB.remove(type).then(function () {
          IDB.removeHandle(type).catch(function() {});
          if (wsIds.length) ANNOTATIONS.clearForWsIds(wsIds);
          IDB.loadAllMeta().then(function (entries) { restoreUploadSection(entries); });
        });
      }).catch(function () {
        // Fallback: delete session even if load failed
        IDB.remove(type).then(function () {
          IDB.removeHandle(type).catch(function() {});
          IDB.loadAllMeta().then(function (entries) { restoreUploadSection(entries); });
        });
      });
    });
  });

  sec.querySelectorAll(".idb-refresh-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var type = this.dataset.idbtype;
      showRefreshToast("Refreshing\u2026");
      // Always use cacheOnly=true so the UI stays on the upload screen
      // and all session cards remain visible after refresh
      refreshFromHandle(type, true).then(function () {
        hideRefreshToast();
        if (window._currentSessionKey === type) {
          IDB.load(type).then(function(entry) {
            if (entry && entry.data) APP_DATA = entry.data;
          });
        }
        IDB.loadAllMeta().then(function(en) { restoreUploadSection(en); });
      }).catch(function () {
        hideRefreshToast();
      });
    });
  });

  var cpiRefreshAllBtn = document.getElementById("cpi-refresh-all-btn");
  if (cpiRefreshAllBtn) {
    cpiRefreshAllBtn.addEventListener("click", function () {
      refreshAllPreviousSessions();
    });
  }

  document.getElementById("clear-all-btn").addEventListener("click", function () {
    if (!confirm("This will delete all cached sessions. Continue?")) return;
    IDB.clearAll().then(function () {
      IDB.clearAllHandles().catch(function() {});
      ANNOTATIONS.clearAll();
      location.reload();
    });
  });

  function updateLciHint() {
    var region = document.getElementById("lci-region").value;
    var week   = document.getElementById("lci-week").value;
    var regionFile = region === "DISTI" ? "DISTI" : region;
    var filename = week ? "CPI_data_" + regionFile + "_" + week + ".csv" : "CPI_data_" + regionFile + ".csv";
    document.getElementById("lci-file-hint-text").textContent = filename;
  }

  ["lci-region","lci-week"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", function () {
      if (id === "lci-region") localStorage.setItem("AdoptDash_Internal_lci-region", this.value);
      updateLciHint();
      updateLastFileHint();
    });
  });
  updateLciHint();

  // ── Show last-used CPI file hint if a handle is stored ───────────────────
  var _lastHandleName = null;

  function updateLastFileHint() {
    if (!_lastHandleName) return;
    var region = document.getElementById("lci-region").value;
    var week   = document.getElementById("lci-week").value;
    var regionFile = region === "DISTI" ? "DISTI" : region;
    var fileMatchesRegion = _lastHandleName.indexOf("_" + regionFile + "_") !== -1 ||
                            _lastHandleName.indexOf("_" + regionFile + ".") !== -1;
    // Also verify the stored filename matches the selected week.
    // A specific week must appear in the filename; "Latest" (empty) must match the no-week variant.
    var fileMatchesWeek = week
      ? _lastHandleName.indexOf("_" + week + ".") !== -1 || _lastHandleName.indexOf("_" + week + "_") !== -1
      : _lastHandleName.indexOf("_" + regionFile + ".") !== -1;  // "Latest" → no week suffix
    var hintEl = document.getElementById("lci-last-file-hint");
    var nameEl = document.getElementById("lci-last-file-name");
    var onedriveHint = document.getElementById("lci-onedrive-hint");
    if (hintEl && nameEl) {
      if (fileMatchesRegion && fileMatchesWeek) {
        nameEl.textContent = _lastHandleName;
        hintEl.classList.remove("d-none");
        if (onedriveHint) onedriveHint.classList.add("d-none");
      } else {
        hintEl.classList.add("d-none");
        if (onedriveHint) onedriveHint.classList.remove("d-none");
      }
    }
  }

  IDB.loadHandle("lci-last-file").then(function (handle) {
    if (!handle) return;
    _lastHandleName = handle.name;
    updateLastFileHint();
  }).catch(function() {});

  // ── Load button: try last-used handle first, then fall back to file picker ──
  document.getElementById("lci-load-btn").addEventListener("click", function () {
    document.getElementById("lci-error").classList.add("d-none");
    openCpiFile();
  });

  function openCpiFile() {
    var region = document.getElementById("lci-region").value;
    var week   = document.getElementById("lci-week").value;

    function openPicker() {
      if (typeof window.showOpenFilePicker === "function") {
        window.showOpenFilePicker({
          types: [{ description: "CPI CSV", accept: { "text/csv": [".csv"], "application/octet-stream": [".csv"] } }],
          multiple: false
        }).then(function (handles) {
          var handle = handles[0];
          PENDING_FILE_HANDLE = handle;
          IDB.saveHandle("lci-last-file", handle).then(function () {
            _lastHandleName = handle.name;
            updateLastFileHint();
          }).catch(function() {});
          return handle.getFile();
        }).then(function (file) {
          processCpiFile(file, region, week);
        }).catch(function (err) {
          PENDING_FILE_HANDLE = null;
          if (err.name !== "AbortError") {
            console.warn("showOpenFilePicker failed, falling back:", err);
            document.getElementById("lci-file-input").value = "";
            document.getElementById("lci-file-input").click();
          }
        });
      } else {
        document.getElementById("lci-file-input").value = "";
        document.getElementById("lci-file-input").click();
      }
    }

    // Try the last-used handle only if it matches the selected region
    IDB.loadHandle("lci-last-file").then(function (handle) {
      if (!handle) { openPicker(); return; }
      // Check if the stored filename matches the selected region
      var regionFile = region === "DISTI" ? "DISTI" : region;
      var fileMatchesRegion = handle.name.indexOf("_" + regionFile + "_") !== -1 ||
                              handle.name.indexOf("_" + regionFile + ".") !== -1;
      if (!fileMatchesRegion) { openPicker(); return; }
      handle.queryPermission({ mode: "read" }).then(function (perm) {
        if (perm === "granted") return perm;
        return handle.requestPermission({ mode: "read" });
      }).then(function (perm) {
        if (perm !== "granted") { openPicker(); return; }
        PENDING_FILE_HANDLE = handle;
        return handle.getFile().then(function (file) {
          processCpiFile(file, region, week);
        });
      }).catch(function () { openPicker(); });
    }).catch(function () { openPicker(); });
  }

  // ── File selected (fallback input[type=file] path) ────────────────────────
  document.getElementById("lci-file-input").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    PENDING_FILE_HANDLE = null;
    processCpiFile(file, document.getElementById("lci-region").value, document.getElementById("lci-week").value);
  });
}

function renderMultiPicker() {
  var barEl = document.getElementById("multi-session-bar");
  if (barEl) { barEl.classList.add("d-none"); barEl.innerHTML = ""; }
}

// ── Drill-down scope picker — shown after file is parsed, before transform ────
function showDrillDownPicker(rawRows, onConfirm, options) {
  // Show the right-side panel column; remove centering from left col
  var col = document.getElementById("scope-panel-col");
  var panel = document.getElementById("scope-panel");
  var inner = document.getElementById("upload-left-inner");
  var overlay = document.getElementById("loader-overlay");
  if (overlay) overlay.style.display = "none";
  if (col) col.style.display = "";
  if (inner) { inner.style.maxWidth = ""; inner.style.margin = ""; }
  var leftCol = document.getElementById("upload-left-col");
  if (leftCol) { leftCol.className = "col-12 col-lg-5"; }
  if (!panel) return;

  var regionUpper = options && options.region ? String(options.region).toUpperCase() : "";
  var excludeNotEligibleForWholeRegion = regionUpper !== "DISTI";

  // Build theater → countries map
  var theaterMap = {};
  rawRows.forEach(function(r) {
    var t = String(r["Theater"] || "").trim();
    var c = String(r["Partner Country"] || "").trim();
    if (!t) return;
    if (!theaterMap[t]) theaterMap[t] = [];
    if (c && theaterMap[t].indexOf(c) === -1) theaterMap[t].push(c);
  });
  var theaters = Object.keys(theaterMap).sort();
  Object.keys(theaterMap).forEach(function(t) { theaterMap[t].sort(); });

  function render() {
    var theaterOpts = theaters.map(function(t) {
      var n = theaterMap[t].length;
      return '<option value="' + t + '">' + t + ' (' + n + ' countr' + (n === 1 ? 'y' : 'ies') + ')</option>';
    }).join('');

    // Build unique BE GEO IDs list with all associated Partner Names
    var beGeoIds = [];
    var beGeoToPartners = {};
    rawRows.forEach(function(r) {
      var v = String(r["BE GEO ID"] || "").trim();
      if (v) {
        if (beGeoIds.indexOf(v) === -1) beGeoIds.push(v);
        if (r["Partner Name"]) {
          var pn = String(r["Partner Name"]).trim();
          if (pn) {
            if (!beGeoToPartners[v]) beGeoToPartners[v] = [];
            if (beGeoToPartners[v].indexOf(pn) === -1) beGeoToPartners[v].push(pn);
          }
        }
      }
    });
    beGeoIds.sort();
    var beGeoCheckboxes = beGeoIds.map(function(id) {
      var partners = beGeoToPartners[id] || [];
      var partnerSuffix = partners.length > 0 ? ' <span class="text-muted">— ' + partners.join(', ') + '</span>' : '';
      return '<div class="form-check form-check-sm mb-1">' +
        '<input class="form-check-input" type="checkbox" name="begeoid-cb" id="bgcb-' + id.replace(/\W/g,'_') + '" value="' + id.replace(/"/g,'&quot;') + '">' +
        '<label class="form-check-label small" for="bgcb-' + id.replace(/\W/g,'_') + '">' + id + partnerSuffix + '</label></div>';
    }).join('');

    panel.innerHTML =
      '<div class="card shadow-sm border-primary h-100">' +
      '<div class="card-header bg-primary bg-opacity-10 fw-semibold"><i class="bi bi-funnel me-2 text-primary"></i>Select Analysis Scope</div>' +
      '<div class="card-body p-4">' +
      '<p class="text-muted small mb-3">Choose the granularity for this session. You can reload the file at any time to change it.</p>' +

      // Region
      '<div class="form-check mb-2">' +
        '<input class="form-check-input" type="radio" name="scope-level" id="scope-region" value="region" checked>' +
        '<label class="form-check-label" for="scope-region"><strong>Whole Region</strong> <span class="text-muted small">— all ' + rawRows.length.toLocaleString() + ' rows' + (excludeNotEligibleForWholeRegion ? ' <em>(will exclude non-eligible deals)</em>' : '') + '</span></label>' +
      '</div>' +

      // Theater
      (theaters.length > 0 ?
        '<div class="form-check mb-2">' +
          '<input class="form-check-input" type="radio" name="scope-level" id="scope-theater" value="theater">' +
          '<label class="form-check-label" for="scope-theater"><strong>Theater</strong> <span class="text-muted small">— ' + theaters.length + ' available</span></label>' +
        '</div>' +
        '<div id="theater-dropdown-wrap" class="ms-4 mb-2 d-none" style="max-width:340px">' +
          '<label class="form-label small fw-semibold mb-1">Theater:</label>' +
          '<select id="scope-theater-sel" class="form-select form-select-sm">' + theaterOpts + '</select>' +
        '</div>'
      : '') +

      // Country
      '<div class="form-check mb-2" id="scope-country-row">' +
        '<input class="form-check-input" type="radio" name="scope-level" id="scope-country" value="country" disabled>' +
        '<label class="form-check-label text-muted" for="scope-country" id="scope-country-label"><strong>Country</strong> <span class="small">— select a theater first</span></label>' +
      '</div>' +
      '<div id="country-dropdown-wrap" class="ms-4 mb-3 d-none" style="max-width:340px">' +
        '<label class="form-label small fw-semibold mb-1">Country:</label>' +
        '<select id="scope-country-sel" class="form-select form-select-sm"></select>' +
      '</div>' +

      // Custom BE GEO IDs
      (beGeoIds.length > 0 ?
        '<div class="form-check mb-2">' +
          '<input class="form-check-input" type="radio" name="scope-level" id="scope-begeoid" value="begeoid">' +
          '<label class="form-check-label" for="scope-begeoid"><strong>Custom BE GEO IDs</strong> <span class="text-muted small">— ' + beGeoIds.length + ' available</span></label>' +
        '</div>' +
        '<div id="begeoid-picker-wrap" class="ms-4 mb-3 d-none" style="max-width:420px">' +
          '<input type="text" id="begeoid-search" class="form-control form-control-sm mb-2" placeholder="&#128269; Search IDs...">' +
          '<div id="begeoid-cb-list" style="max-height:180px;overflow-y:auto;border:1px solid #dee2e6;border-radius:4px;padding:6px 10px">' +
            beGeoCheckboxes +
          '</div>' +
          '<div id="begeoid-pills" class="d-flex flex-wrap gap-1 mt-2" style="min-height:0"></div>' +
          '<div class="mt-1 d-flex gap-3">' +
            '<a href="#" id="begeoid-select-all" class="small">Select all</a>' +
            '<a href="#" id="begeoid-clear-all" class="small text-muted">Clear all</a>' +
            '<span id="begeoid-selected-count" class="small text-muted ms-auto"></span>' +
          '</div>' +
        '</div>'
      : '') +

      '<div class="mt-3">' +
        '<button id="scope-confirm-btn" class="btn btn-warning px-4"><i class="bi bi-play-fill me-2"></i>Continue</button>' +
      '</div>' +
      '</div></div>';

    function getSelectedTheater() {
      var sel = document.getElementById("scope-theater-sel");
      return sel ? sel.value : null;
    }

    function refreshCountryDropdown(theater) {
      var countries = theaterMap[theater] || [];
      var countryOpts = countries.map(function(c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
      var cSel = document.getElementById("scope-country-sel");
      if (cSel) cSel.innerHTML = countryOpts;

      var cRadio = document.getElementById("scope-country");
      var cLabel = document.getElementById("scope-country-label");
      var cRow   = document.getElementById("scope-country-row");
      if (cRadio) cRadio.disabled = false;
      if (cLabel) {
        cLabel.classList.remove("text-muted");
        cLabel.innerHTML = '<strong>Country</strong> <span class="small text-muted">— ' + countries.length + ' in ' + theater + '</span>';
      }
    }

    // Wire theater radio
    var theaterRadio = document.getElementById("scope-theater");
    if (theaterRadio) {
      theaterRadio.addEventListener("change", function() {
        document.getElementById("theater-dropdown-wrap").classList.remove("d-none");
        document.getElementById("country-dropdown-wrap").classList.add("d-none");
        var bw = document.getElementById("begeoid-picker-wrap");
        if (bw) bw.classList.add("d-none");
        var theater = getSelectedTheater();
        if (theater) refreshCountryDropdown(theater);
      });
    }

    // Wire theater select change
    var theaterSel = document.getElementById("scope-theater-sel");
    if (theaterSel) {
      theaterSel.addEventListener("change", function() {
        var cRadio = document.getElementById("scope-country");
        if (cRadio && cRadio.checked) {
          // If country was already selected, switch back to theater
          document.getElementById("scope-theater").checked = true;
          document.getElementById("country-dropdown-wrap").classList.add("d-none");
        }
        refreshCountryDropdown(this.value);
      });
    }

    // Wire country radio
    var countryRadio = document.getElementById("scope-country");
    if (countryRadio) {
      countryRadio.addEventListener("change", function() {
        if (!this.disabled) {
          document.getElementById("theater-dropdown-wrap").classList.remove("d-none");
          document.getElementById("country-dropdown-wrap").classList.remove("d-none");
          var bw = document.getElementById("begeoid-picker-wrap");
          if (bw) bw.classList.add("d-none");
        }
      });
    }

    // Wire region radio — hide both dropdowns
    var regionRadio = document.getElementById("scope-region");
    if (regionRadio) {
      regionRadio.addEventListener("change", function() {
        var tw = document.getElementById("theater-dropdown-wrap");
        var cw = document.getElementById("country-dropdown-wrap");
        var bw = document.getElementById("begeoid-picker-wrap");
        if (tw) tw.classList.add("d-none");
        if (cw) cw.classList.add("d-none");
        if (bw) bw.classList.add("d-none");
      });
    }

    // Wire BE GEO ID radio
    var beGeoRadio = document.getElementById("scope-begeoid");
    if (beGeoRadio) {
      beGeoRadio.addEventListener("change", function() {
        var tw = document.getElementById("theater-dropdown-wrap");
        var cw = document.getElementById("country-dropdown-wrap");
        var bw = document.getElementById("begeoid-picker-wrap");
        if (tw) tw.classList.add("d-none");
        if (cw) cw.classList.add("d-none");
        if (bw) bw.classList.remove("d-none");
        document.getElementById("begeoid-search").focus();
      });
    }

    // Wire BE GEO ID search + select/clear all
    function updateBeGeoCount() {
      var countEl = document.getElementById("begeoid-selected-count");
      var pillsEl = document.getElementById("begeoid-pills");
      var checked = Array.prototype.map.call(
        document.querySelectorAll('#begeoid-cb-list input[type=checkbox]:checked'),
        function(cb) { return cb.value; }
      );
      if (countEl) countEl.textContent = checked.length > 0 ? checked.length + " selected" : "";
      if (pillsEl) {
        pillsEl.innerHTML = checked.map(function(id) {
          return '<span class="badge rounded-pill d-inline-flex align-items-center gap-1" style="background:#0d6efd;font-size:0.75rem;font-weight:500">' +
            id.replace(/</g,'&lt;') +
            '<button type="button" data-geo="' + id.replace(/"/g,'&quot;') + '" style="background:none;border:none;color:#fff;padding:0;font-size:0.7rem;line-height:1;cursor:pointer;margin-left:2px" aria-label="Remove">&times;</button>' +
          '</span>';
        }).join('');
        pillsEl.querySelectorAll('button[data-geo]').forEach(function(btn) {
          btn.addEventListener("click", function() {
            var geo = this.dataset.geo;
            var cb = document.querySelector('#begeoid-cb-list input[value="' + geo.replace(/"/g,'\\"') + '"]');
            if (cb) { cb.checked = false; updateBeGeoCount(); }
          });
        });
      }
    }
    var beGeoSearch = document.getElementById("begeoid-search");
    if (beGeoSearch) {
      beGeoSearch.addEventListener("input", function() {
        var q = this.value.trim().toLowerCase();
        document.querySelectorAll('#begeoid-cb-list .form-check').forEach(function(row) {
          var lbl = row.querySelector('label');
          row.style.display = (!q || (lbl && lbl.textContent.toLowerCase().indexOf(q) !== -1)) ? "" : "none";
        });
      });
    }
    var selectAllBtn = document.getElementById("begeoid-select-all");
    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", function(e) {
        e.preventDefault();
        document.querySelectorAll('#begeoid-cb-list .form-check').forEach(function(row) {
          if (row.style.display !== "none") row.querySelector('input[type=checkbox]').checked = true;
        });
        updateBeGeoCount();
      });
    }
    var clearAllBtn = document.getElementById("begeoid-clear-all");
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", function(e) {
        e.preventDefault();
        document.querySelectorAll('#begeoid-cb-list input[type=checkbox]').forEach(function(cb) { cb.checked = false; });
        updateBeGeoCount();
      });
    }
    var cbList = document.getElementById("begeoid-cb-list");
    if (cbList) {
      cbList.addEventListener("change", updateBeGeoCount);
    }

    document.getElementById("scope-confirm-btn").addEventListener("click", function() {
      var level = document.querySelector('input[name="scope-level"]:checked').value;
      var filteredRows = rawRows;
      var scopeLabel = "";
      if (level === "theater") {
        var theater = getSelectedTheater();
        filteredRows = rawRows.filter(function(r) { return String(r["Theater"] || "").trim() === theater; });
        scopeLabel = theater;
      } else if (level === "country") {
        var country = document.getElementById("scope-country-sel").value;
        filteredRows = rawRows.filter(function(r) { return String(r["Partner Country"] || "").trim() === country; });
        scopeLabel = country;
      } else if (level === "begeoid") {
        var selectedGeos = Array.prototype.map.call(document.querySelectorAll('#begeoid-picker-wrap input[type=checkbox]:checked'), function(cb) { return cb.value; });
        if (selectedGeos.length === 0) { alert("Please select at least one BE GEO ID."); return; }
        filteredRows = rawRows.filter(function(r) { return selectedGeos.indexOf(String(r["BE GEO ID"] || "").trim()) !== -1; });
        scopeLabel = selectedGeos.join(",");
      } else if (level === "region") {
        if (excludeNotEligibleForWholeRegion) {
          // Drop "NOT ELIGIBLE" rows to reduce memory footprint for large regional files
          filteredRows = rawRows.filter(function(r) { return String(r["Stage"] || "").trim().toUpperCase() !== "NOT ELIGIBLE"; });
        }
      }
      var loaderMsg = "Processing " + filteredRows.length.toLocaleString() + " rows\u2026";
      if (level === "region" && excludeNotEligibleForWholeRegion && filteredRows.length < rawRows.length) {
        loaderMsg += " (" + (rawRows.length - filteredRows.length).toLocaleString() + " not-eligible rows excluded)";
      }
      showLoader(loaderMsg);
      // Hide scope panel while loading
      var _col = document.getElementById("scope-panel-col");
      if (_col) _col.style.display = "none";
      setTimeout(function() { onConfirm(filteredRows, level, scopeLabel); }, 0);
    });
  }

  render();
  // Scroll scope panel into view on small screens
  var _panelEl = document.getElementById("scope-panel");
  if (_panelEl) _panelEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ── CPI file processing — loads all rows, sessions keyed by region ───────────
function processCpiFile(file, region, week) {
  var regionFile = region === "DISTI" ? "DISTI" : region;
  var expected = week
    ? "CPI_data_" + regionFile + "_" + week + ".csv"
    : "CPI_data_" + regionFile + ".csv";
  var errEl = document.getElementById("lci-error");
  if (errEl) errEl.classList.add("d-none");

  if (file.name !== expected) {
    if (errEl) {
      errEl.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>Expected <strong>' + expected + '</strong> but got <strong>' + file.name + '</strong>. Please check your selections.';
      errEl.classList.remove("d-none");
    }
    PENDING_FILE_HANDLE = null;
    return;
  }

  showLoader("Reading CPI file…");
  readFileAsText(file).then(function (rawText) {
    Papa.parse(rawText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: function (results) {
        try {
          if (!results.data || results.data.length === 0) throw new Error("No data found in CSV.");

          var rawKeys = Object.keys(results.data[0] || {});
          var rawDistiKey = rawKeys.find(function(k) { return k.trim().toLowerCase() === "disti name"; });
          var rawIsDisti = !!(rawDistiKey && results.data.some(function(r) {
            return r[rawDistiKey] && String(r[rawDistiKey]).trim() !== "";
          }));

          fixTheaterField(results.data, region);
          showDrillDownPicker(results.data, function(filteredRows, scopeType, scopeLabel) {
            try {
              // Build a unique key per region+scope so sessions don't overwrite each other
              var scopeSlug = scopeType === "region"   ? ""
                            : scopeType === "theater"  ? "-th:" + scopeLabel
                            : scopeType === "country"  ? "-co:" + scopeLabel
                            : scopeType === "begeoid"  ? "-bgeo:" + scopeLabel.replace(/,/g, "_")
                            : "";
              var idbKey = "cpi-" + region + scopeSlug;
              APP_DATA = transformData(filteredRows);
              APP_IS_DISTI = rawIsDisti;
              APP_FILE_META = { name: file.name, lastModified: file.lastModified ? new Date(file.lastModified) : null };
              var label = file.name + " · " + region + (scopeLabel ? " · " + scopeLabel : "");
              // Stash scope info so finishLoad can persist it
              APP_FILE_META._scopeType  = scopeType;
              APP_FILE_META._scopeLabel = scopeLabel;
              finishLoad(label, APP_DATA.length, false, idbKey);
            } catch (err) {
              PENDING_FILE_HANDLE = null;
              IDB.loadAllMeta().then(function(en) { restoreUploadSection(en); });
              console.error(err);
              alert("Error processing CPI file: " + err.message);
            }
          }, { region: region });
        } catch (err) {
          PENDING_FILE_HANDLE = null;
          IDB.loadAllMeta().then(function(en) { restoreUploadSection(en); });
          console.error(err);
          alert("Error processing CPI file: " + err.message);
        }
      },
      error: function (err) {
        PENDING_FILE_HANDLE = null;
        IDB.loadAllMeta().then(function(en) { restoreUploadSection(en); });
        alert("Error reading CSV: " + err.message);
      }
    });
  }).catch(function (err) {
    PENDING_FILE_HANDLE = null;
    IDB.loadAllMeta().then(function(en) { restoreUploadSection(en); });
    alert("Error reading CPI file: " + err.message);
  });
}

// ── Refresh a session from its stored FileSystemFileHandle ───────────────────
function refreshFromHandle(type, cacheOnly) {
  if (typeof window.showOpenFilePicker === "undefined" && typeof FileSystemFileHandle === "undefined") {
    alert("Your browser does not support the File System Access API. Please use Chrome or Edge to use this feature.");
    return Promise.reject(new Error("File System Access API not supported."));
  }
  return IDB.loadHandle(type).then(function (handle) {
    if (!handle) {
      alert("No file handle saved for this session. Re-upload the file to enable one-click refresh.");
      throw new Error("No file handle saved for this session.");
    }
    return handle.queryPermission({ mode: "read" }).then(function (perm) {
      if (perm === "granted") return perm;
      return handle.requestPermission({ mode: "read" });
    }).then(function (perm) {
      if (perm !== "granted") throw new Error("Permission to read the file was denied.");
      return handle.getFile();
    }).then(function (file) {
      // Load saved meta to recover scope
      return IDB.loadAllMeta().then(function(entries) {
        var entry = entries.find(function(e) { return e.type === type; });
        var meta = entry && entry.meta ? entry.meta : {};
        var scopeType  = meta.scopeType  || "region";
        var scopeLabel = meta.scopeLabel || "";
        PENDING_FILE_HANDLE = handle;
        return refreshCpiFromHandle(file, type, scopeType, scopeLabel, cacheOnly);
      });
    });
  }).catch(function (err) {
    if (err && err.name === "AbortError") return;
    alert("Could not refresh from file: " + err.message);
    throw err;
  });
}

function refreshAllPreviousSessions() {
  var body = document.getElementById("cpi-prev-sessions-body");
  if (!body) return;
  var types = Array.prototype.map.call(body.querySelectorAll(".idb-refresh-btn[data-idbtype]"), function (btn) {
    return btn.dataset.idbtype;
  }).filter(Boolean);
  if (types.length === 0) {
    alert("No previous sessions with saved file handles were found.");
    return;
  }
  var total = types.length;
  var completed = 0;
  showLoader("Refreshing sessions\u2026 (0\u00a0/\u00a0" + total + ")");
  types.reduce(function (chain, type) {
    return chain.then(function () {
      return refreshFromHandle(type, true).catch(function (err) {
        console.warn("Refresh failed for " + type + ":", err);
      }).then(function () {
        completed++;
        updateLoaderMsg("Refreshing sessions\u2026 (" + completed + "\u00a0/\u00a0" + total + ")");
      });
    });
  }, Promise.resolve()).then(function () {
    IDB.loadAllMeta().then(function (en) { restoreUploadSection(en); });
  });
}

function refreshCpiFromHandle(file, idbKey, scopeType, scopeLabel, cacheOnly) {
  var region = idbKey.replace(/^cpi-/, "").replace(/-(th|co):.*$/, "");
  if (!cacheOnly) showLoader("Re-reading CPI file…");
  return readFileAsText(file).then(function (rawText) {
    return new Promise(function (resolve, reject) {
      Papa.parse(rawText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: function (results) {
          try {
            if (!results.data || results.data.length === 0) throw new Error("No data found in CSV.");
            var rawKeys = Object.keys(results.data[0] || {});
            var rawDistiKey = rawKeys.find(function(k) { return k.trim().toLowerCase() === "disti name"; });
            var rawIsDisti = !!(rawDistiKey && results.data.some(function(r) {
              return r[rawDistiKey] && String(r[rawDistiKey]).trim() !== "";
            }));

            // Fix Theater before re-applying scope filter
            fixTheaterField(results.data, region);

            var regionUpper = String(region || "").toUpperCase();

            // Re-apply the same scope filter
            var rows = results.data;
            if (scopeType === "theater" && scopeLabel) {
              rows = results.data.filter(function(r) { return String(r["Theater"] || "").trim() === scopeLabel; });
            } else if (scopeType === "country" && scopeLabel) {
              rows = results.data.filter(function(r) { return String(r["Partner Country"] || "").trim() === scopeLabel; });
            } else if (scopeType === "begeoid" && scopeLabel) {
              var _bgGeos = scopeLabel.split(",");
              rows = results.data.filter(function(r) { return _bgGeos.indexOf(String(r["BE GEO ID"] || "").trim()) !== -1; });
            } else if (scopeType === "region" && regionUpper !== "DISTI") {
              rows = results.data.filter(function(r) { return String(r["Stage"] || "").trim().toUpperCase() !== "NOT ELIGIBLE"; });
            }

            var _handle = PENDING_FILE_HANDLE;
            var displayLabel = region + (scopeLabel ? " · " + scopeLabel : "");
            if (cacheOnly) {
              var transformed = transformData(rows);
              IDB.save(idbKey, transformed, {
                filename:         file.name + " · " + displayLabel,
                rowCount:         transformed.length,
                loadedAt:         new Date().toISOString(),
                fileLastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
                isDisti:          rawIsDisti,
                hasFileHandle:    !!_handle,
                scopeType:        scopeType,
                scopeLabel:       scopeLabel
              }).then(function() {
                if (_handle) IDB.saveHandle(idbKey, _handle).catch(function(e) { console.warn("Handle save failed:", e); });
                PENDING_FILE_HANDLE = null;
                resolve();
              }).catch(function(e) {
                console.warn("IDB save failed:", e);
                PENDING_FILE_HANDLE = null;
                resolve();
              });
            } else {
              window.APP_IS_DISTI = rawIsDisti;
              APP_DATA = transformData(rows);
              APP_FILE_META = { name: file.name, lastModified: file.lastModified ? new Date(file.lastModified) : null, _scopeType: scopeType, _scopeLabel: scopeLabel };
              finishLoad(file.name + " · " + displayLabel, APP_DATA.length, false, idbKey);
              resolve();
            }
          } catch (err) {
            PENDING_FILE_HANDLE = null;
            IDB.loadAllMeta().then(function(en) { restoreUploadSection(en); });
            alert("Error refreshing CPI data: " + err.message);
            reject(err);
          }
        },
        error: function (err) {
          PENDING_FILE_HANDLE = null;
          IDB.loadAllMeta().then(function(en) { restoreUploadSection(en); });
          alert("Error reading file: " + err.message);
          reject(err);
        }
      });
    });
  }).catch(function (err) {
    PENDING_FILE_HANDLE = null;
    IDB.loadAllMeta().then(function(en) { restoreUploadSection(en); });
    alert("Error reading file: " + err.message);
    throw err;
  });
}

// Returns APP_DATA filtered by GEO and excluded records
function getActiveData() {
  if (!APP_DATA) return APP_DATA;
  var d = APP_DATA;
  if (APP_GEO_FILTER) d = d.filter(function (r) { return String(r["BE GEO ID"] || "") === APP_GEO_FILTER; });
  if (!window.APP_EXCL_ACTIVE) return d;
  var excludedIds = ANNOTATIONS.getExcludedWsIds();
  if (excludedIds.length === 0) return d;
  var idSet = {};
  excludedIds.forEach(function (id) { idSet[id] = true; });
  return d.filter(function (r) { return !idSet[String(r["Deal WS-ID"] || "")]; });
}

function renderActiveTab(target) {
  switch (target) {
    case "#tab-overview":  renderOverview(getActiveData());  break;
    case "#tab-details":   renderDetails(getActiveData());   break;
    case "#tab-pvi":       renderPVI(getActiveData());       break;
    case "#tab-testing":   renderInsights(getActiveData());  break;
    case "#tab-compare":   renderCompare(window.APP_DATA);   break;
  }
}

function resetApp() {
  APP_FILE_META = null;
  var sb = document.getElementById("status-bar");
  sb.classList.remove("d-flex");
  sb.classList.add("d-none");
  document.getElementById("main-tab-bar").classList.add("d-none");
  var cpiNav = document.getElementById("cpi-scroll-nav");
  if (cpiNav) cpiNav.remove();

  // Reset disti mode — restore PVI tab
  APP_IS_DISTI = false;
  window.APP_IS_DISTI = false;
  var pviTab = document.getElementById("tab-pvi-btn");
  if (pviTab) pviTab.closest("li").classList.remove("d-none");

  // Clear all tab panes and hide tab content until data is loaded
  APP_DATA = null;
  window.APP_DATA = null;
  APP_FILTER_STATE = { details: null, lifecycle: null, cpiAdopt: null, testing: null, overview: null, pvi: null, compare: null };
  document.getElementById("mainTabContent").classList.add("d-none");
  ["tab-overview","tab-details","tab-pvi","tab-testing","tab-compare"].forEach(function (id) {
    var pane = document.getElementById(id);
    if (pane) pane.innerHTML = "";
  });

  // Reload cache entries so resume cards show after reset
  IDB.loadAllMeta().then(function (entries) {
    restoreUploadSection(entries);
  }).catch(function () {
    restoreUploadSection([]);
  });

  // Activate overview tab
  var overviewBtn = document.getElementById("tab-overview-btn");
  if (overviewBtn) {
    var bsTab = new bootstrap.Tab(overviewBtn);
    bsTab.show();
  }
}

window.APP_DATA        = APP_DATA;
window.APP_FILTER_STATE = APP_FILTER_STATE;
window.APP_EXCL_ACTIVE  = APP_EXCL_ACTIVE;
window.resetApp        = resetApp;
window.renderActiveTab = renderActiveTab;
window.renderOverview  = renderOverview;
window.getActiveData   = getActiveData;

window._currentSessionKey = null;

// Navigate to Details tab with a preset filter
window.navigateToDetails = function (preset) {
  window.APP_FILTER_STATE = window.APP_FILTER_STATE || {};
  window.APP_FILTER_STATE.details = null; // clear saved state so preset takes over
  if (window.APP_EXCL_ACTIVE) preset = Object.assign({}, preset, { hideExcluded: true });
  window._detDeepLink = preset;
  var btn = document.querySelector('[data-bs-target="#tab-details"]');
  if (!btn) return;
  var detPane = document.getElementById("tab-details");
  if (detPane && detPane.classList.contains("active")) {
    renderDetails(APP_DATA);
  } else {
    new bootstrap.Tab(btn).show();
  }
};
