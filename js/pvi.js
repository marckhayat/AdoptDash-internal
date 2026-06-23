// =============================================================================
// pvi.js — PVI (Partner Value Index) tab renderer
// =============================================================================

function renderPVI(data) {
  var el = document.getElementById("tab-pvi");
  if (!el) return;

  var PORTFOLIOS = ["Networking", "Security", "Cloud + AI Infrastructure"];

  function norm(x) {
    if (x === null || x === undefined) return "";
    return String(x).replace(/\u00A0/g, " ").trim().toUpperCase();
  }

  function fmtCurrency(v) {
    if (v === null || v === undefined || isNaN(v)) return "-";
    return "$" + Math.round(v).toLocaleString();
  }

  function fmtPct(v) {
    if (v === null || v === undefined || isNaN(v)) return "-";
    return (v * 100).toFixed(2) + "%";
  }

  function scoreClass(s) {
    if (s === null || s === undefined) return "";
    if (s >= 7.5) return "score-green";
    if (s >= 5.0) return "score-orange";
    return "score-red";
  }

  // Helper: sum booking amount deduplicated by Deal WS-ID
  function sumBooking(rows) {
    var seen = new Set();
    var total = 0;
    rows.forEach(function (r) {
      var dealId = r["Deal WS-ID"];
      if (dealId && seen.has(dealId)) return;
      if (dealId) seen.add(dealId);
      var amt = parseFloat(r["Booking Amount - Net to Cisco"]);
      total += (isNaN(amt) ? 0 : amt);
    });
    return total;
  }

  // ── Compute PVI metrics per portfolio
  function computeDomain(filteredData, portfolio) {
    var eligRows    = filteredData.filter(function (r) { return r["PVI Eligible"] === true && norm(r["Deal CPI Portfolio"]) === norm(portfolio); });
    var onbRows     = filteredData.filter(function (r) { return r["PVI Onboard"]  === true && norm(r["Deal CPI Portfolio"]) === norm(portfolio); });
    var adpRows     = filteredData.filter(function (r) { return r["PVI Adopt"]    === true && norm(r["Deal CPI Portfolio"]) === norm(portfolio); });

    var eligUC      = new Set(eligRows.map(function (r) { return r["CRPartyID-Offer"]; })).size;
    var eligBook    = sumBooking(eligRows);
    var onbUC       = onbRows.length;
    var onbBook     = sumBooking(onbRows);
    var adpUC       = adpRows.length;
    var adpBook     = sumBooking(adpRows);

    var onbRatio    = eligBook > 0 ? onbBook / eligBook : null;
    var adpRatio    = eligBook > 0 ? adpBook / eligBook : null;

    var onbScore    = eligBook > 0 ? lookupPVIScore(portfolio, "Onboard", onbRatio) : null;
    var adpScore    = eligBook > 0 ? lookupPVIScore(portfolio, "Adopt",   adpRatio) : null;
    var totalScore  = (onbScore !== null && adpScore !== null) ? (onbScore + adpScore) / 2 : null;

    return { portfolio, eligUC, eligBook, onbUC, onbBook, adpUC, adpBook, onbRatio, adpRatio, onbScore, adpScore, totalScore };
  }

  // ── Get unique BE GEO IDs
  var beGeoIds = [];
  data.forEach(function(r) { var v = String(r["BE GEO ID"] || "").trim(); if (v && beGeoIds.indexOf(v) === -1) beGeoIds.push(v); });
  beGeoIds.sort();

  // ── Restore previous selection
  var _prevGeo = (function() {
    var prev = document.getElementById("pvi-begeoid-sel");
    if (prev) return prev.value;
    return (window.APP_FILTER_STATE && window.APP_FILTER_STATE.pvi) ? (window.APP_FILTER_STATE.pvi.beGeoId || "") : "";
  })();

  // ── Build static HTML shell
  var geoOpts = '<option value="">— Select a BE GEO ID —</option>';
  beGeoIds.forEach(function(id) { geoOpts += '<option value="' + id.replace(/"/g, '&quot;') + '">' + id + '</option>'; });

  var html = '<div class="d-flex align-items-center gap-2 mb-3">';
  html += '<label class="text-muted small mb-0 flex-shrink-0" for="pvi-begeoid-sel">BE GEO ID</label>';
  html += '<select id="pvi-begeoid-sel" class="form-select form-select-sm" style="width:auto;font-size:0.85rem">' + geoOpts + '</select>';
  html += '</div>';

  html += '<div id="pvi-content"></div>';

  html += '<div class="mt-3 p-3 rounded" style="background:#f8f9fa;border:1px solid #dee2e6;font-size:0.82rem">';
  html += '<div class="fw-semibold mb-2">PVI Engagement calculation:</div>';
  html += '<ul class="mb-2 ps-3">';
  html += '<li>Only considers eligible UCs that have a booking date within the past 18 fiscal months.</li>';
  html += '<li>1 UC per offer is selected. Priority is given to the opted-in UC. If no UC is opted-in, the UC with the highest incentive amount is selected.</li>';
  html += '<li>A UC that completes the Adopt phase will become Not Eligible if it is not opted-in, and will not be included in PVI calculations.</li>';
  html += '</ul>';
  html += '<a href="https://ebooks.cisco.com/story/360-partner-program-partner-value-index-cisco-partner-incentive-metrics-guide/page/1" target="_blank" rel="noopener" class="small"><i class="bi bi-box-arrow-up-right me-1"></i>PVI Metrics Guide</a>';
  html += '</div>';

  el.innerHTML = html;

  // ── Render portfolio cards for a given filtered dataset
  function renderPortfolios(filteredData) {
    var contentEl = document.getElementById("pvi-content");
    if (!filteredData) {
      contentEl.innerHTML = '<div class="text-muted p-3"><i class="bi bi-arrow-up me-1"></i>Select a BE GEO ID to view PVI data.</div>';
      return;
    }

    var inner = '<div class="disclaimer-card mb-3">';
    inner += '<i class="bi bi-info-circle me-1"></i>Partners should rely on <strong><a href="https://cisco-pxp.my.site.com/pxp/s/" target="_blank" rel="noopener">PXP (Partner Experience Platform)</a></strong> for official PVI scores. ';
    inner += 'The below is an indication of the Engagement score based on current CPI performance. Score may differ slightly from PXP due to the timing of data capture.';
    inner += '</div>';

    inner += '<div class="row g-3" id="pvi-portfolios">';
    PORTFOLIOS.forEach(function (portfolio) {
      var slug = portfolio.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
      inner += '<div class="col-12 col-lg-4">';
      inner += '<div class="card h-100 shadow-sm">';
      inner += '<div class="card-header fw-bold" style="background:var(--cisco-dark);color:#fff">' + portfolio + '</div>';
      inner += '<div class="card-body p-3">';
      inner += '<div id="pvi-metrics-' + slug + '"></div>';
      inner += '<hr/>';
      inner += '<div class="mb-2"><strong class="small text-uppercase" style="letter-spacing:.04em">Simulation</strong></div>';
      inner += '<div class="mb-3 small">';
      inner += '<label class="d-flex justify-content-between"><span>Target Onboard Booking</span><strong id="sim-onb-lbl-' + slug + '">$0</strong></label>';
      inner += '<input type="range" id="sim-onb-' + slug + '" class="form-range" min="0" max="100" step="1" value="0"/>';
      inner += '</div>';
      inner += '<div class="mb-2 small">';
      inner += '<label class="d-flex justify-content-between"><span>Target Adopt Booking</span><strong id="sim-adp-lbl-' + slug + '">$0</strong></label>';
      inner += '<input type="range" id="sim-adp-' + slug + '" class="form-range" min="0" max="100" step="1" value="0"/>';
      inner += '</div>';
      inner += '<div id="sim-result-' + slug + '" class="mt-2"></div>';
      inner += '</div></div></div>';
    });
    inner += '</div>';
    contentEl.innerHTML = inner;

    // ── Populate metrics and wire sliders
    PORTFOLIOS.forEach(function (portfolio) {
      var slug = portfolio.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
      var m = computeDomain(filteredData, portfolio);

      var noData = m.eligUC === 0;
      var naStr  = '<span class="text-muted">N/A</span>';

      var metricsHtml = '<table class="table table-sm mb-0" style="font-size:0.82rem">';
      metricsHtml += '<tbody>';
      metricsHtml += '<tr><td>Eligible UCs</td><td class="text-end fw-semibold">' + m.eligUC + '</td><td class="text-end">' + fmtCurrency(m.eligBook) + '</td></tr>';
      metricsHtml += '<tr><td>Eligible UCs Onboarded</td><td class="text-end">' + m.onbUC + '</td><td class="text-end">' + fmtCurrency(m.onbBook) + '</td></tr>';
      metricsHtml += '<tr><td>Ratio Onboarded</td><td colspan="2" class="text-end">' + (noData ? naStr : fmtPct(m.onbRatio)) + '</td></tr>';
      metricsHtml += '<tr><td>PVI Engagement - Onboard (/10)</td><td colspan="2" class="text-end"><span style="font-size:1.4rem">' + (m.onbScore !== null ? m.onbScore : "N/A") + '</span></td></tr>';
      metricsHtml += '<tr><td>Eligible UCs Adopted</td><td class="text-end">' + m.adpUC + '</td><td class="text-end">' + fmtCurrency(m.adpBook) + '</td></tr>';
      metricsHtml += '<tr><td>Ratio Adopted</td><td colspan="2" class="text-end">' + (noData ? naStr : fmtPct(m.adpRatio)) + '</td></tr>';
      metricsHtml += '<tr><td>PVI Engagement - Adopt (/10)</td><td colspan="2" class="text-end"><span style="font-size:1.4rem">' + (m.adpScore !== null ? m.adpScore : "N/A") + '</span></td></tr>';
      metricsHtml += '<tr class="table-active"><td class="fw-bold">PVI Engagement Total (/10)</td><td colspan="2" class="text-end"><span class="pvi-score-total fw-bold ' + scoreClass(m.totalScore) + '">' + (m.totalScore !== null ? m.totalScore.toFixed(1) : "N/A") + '</span></td></tr>';
      metricsHtml += '</tbody></table>';
      document.getElementById("pvi-metrics-" + slug).innerHTML = metricsHtml;

      function updateSim() {
        var eligBook = m.eligBook;
        var onbPct = parseFloat(document.getElementById("sim-onb-" + slug).value) / 100;
        var adpPct = parseFloat(document.getElementById("sim-adp-" + slug).value) / 100;
        var simOnb = eligBook * onbPct;
        var simAdp = eligBook * adpPct;
        document.getElementById("sim-onb-lbl-" + slug).textContent = "$" + Math.round(simOnb).toLocaleString();
        document.getElementById("sim-adp-lbl-" + slug).textContent = "$" + Math.round(simAdp).toLocaleString();
        if (eligBook <= 0) {
          document.getElementById("sim-result-" + slug).innerHTML = '<p class="text-muted small">No eligible booking to simulate against.</p>';
          return;
        }
        var simOnbScore = lookupPVIScore(portfolio, "Onboard", onbPct);
        var simAdpScore = lookupPVIScore(portfolio, "Adopt",   adpPct);
        var simTotal    = (simOnbScore + simAdpScore) / 2;
        var simHtml = '<div class="d-flex gap-3 flex-wrap">';
        simHtml += '<div class="text-center"><div class="small text-muted">Sim Onboard</div><div style="font-size:1.4rem">' + simOnbScore + '</div></div>';
        simHtml += '<div class="text-center"><div class="small text-muted">Sim Adopt</div><div style="font-size:1.4rem">' + simAdpScore + '</div></div>';
        simHtml += '<div class="text-center"><div class="small text-muted fw-bold">Sim Total</div><div class="fw-bold ' + scoreClass(simTotal) + '" style="font-size:1.4rem">' + simTotal.toFixed(1) + '</div></div>';
        simHtml += '</div>';
        document.getElementById("sim-result-" + slug).innerHTML = simHtml;
      }

      document.getElementById("sim-onb-" + slug).addEventListener("input", updateSim);
      document.getElementById("sim-adp-" + slug).addEventListener("input", updateSim);

      if (m.eligBook > 0) {
        document.getElementById("sim-onb-" + slug).value = Math.round((m.onbBook / m.eligBook) * 100);
        document.getElementById("sim-adp-" + slug).value = Math.round((m.adpBook / m.eligBook) * 100);
      }
      updateSim();
    });
  }

  // ── Wire dropdown
  var geoSel = document.getElementById("pvi-begeoid-sel");
  geoSel.addEventListener("change", function() {
    var geo = this.value;
    window.APP_FILTER_STATE = window.APP_FILTER_STATE || {};
    window.APP_FILTER_STATE.pvi = { beGeoId: geo };
    var filtered = geo ? data.filter(function(r) { return String(r["BE GEO ID"] || "") === geo; }) : null;
    renderPortfolios(filtered);
  });

  // ── Restore and apply previous selection
  if (_prevGeo && beGeoIds.indexOf(_prevGeo) !== -1) {
    geoSel.value = _prevGeo;
    renderPortfolios(data.filter(function(r) { return String(r["BE GEO ID"] || "") === _prevGeo; }));
  } else {
    renderPortfolios(null);
  }
}

window.renderPVI = renderPVI;
