// =============================================================================
// pvi.js — PVI (Partner Value Index) tab renderer
// =============================================================================

function renderPVI(data) {
  var el = document.getElementById("tab-pvi");
  if (!el) return;

  var DOMAINS = ["Networking", "Security", "Cloud + AI Infrastructure"];

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

  // ── Compute PVI metrics per domain
  function computeDomain(domain) {
    var eligRows    = data.filter(function (r) { return r["PVI Eligible"] === true && norm(r["Deal CPI Portfolio"]) === norm(domain); });
    var onbRows     = data.filter(function (r) { return r["PVI Onboard"]  === true && norm(r["Deal CPI Portfolio"]) === norm(domain); });
    var adpRows     = data.filter(function (r) { return r["PVI Adopt"]    === true && norm(r["Deal CPI Portfolio"]) === norm(domain); });

    var eligUC      = new Set(eligRows.map(function (r) { return r["CRPartyID-Offer"]; })).size;
    var eligBook    = sumBooking(eligRows);
    var onbUC       = onbRows.length;
    var onbBook     = sumBooking(onbRows);
    var adpUC       = adpRows.length;
    var adpBook     = sumBooking(adpRows);

    var onbRatio    = eligBook > 0 ? onbBook / eligBook : null;
    var adpRatio    = eligBook > 0 ? adpBook / eligBook : null;

    var onbScore    = eligBook > 0 ? lookupPVIScore(domain, "Onboard", onbRatio) : null;
    var adpScore    = eligBook > 0 ? lookupPVIScore(domain, "Adopt",   adpRatio) : null;
    var totalScore  = (onbScore !== null && adpScore !== null) ? (onbScore + adpScore) / 2 : null;

    return { domain, eligUC, eligBook, onbUC, onbBook, adpUC, adpBook, onbRatio, adpRatio, onbScore, adpScore, totalScore };
  }

  // ── Build HTML
  var html = '<div class="disclaimer-card mb-3">';
  html += '<i class="bi bi-info-circle me-1"></i>Partners should rely on <strong>PXP (Partner Experience Platform)</strong> for official PVI scores. ';
  html += 'The below is an indication of the Engagement score based on current CPI performance. Score may differ slightly from PXP due to the timing of data capture.';
  html += '</div>';

  html += '<div class="row g-3" id="pvi-domains">';
  DOMAINS.forEach(function (domain, i) {
    var slug = domain.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
    html += '<div class="col-12 col-lg-4">';
    html += '<div class="card h-100 shadow-sm">';
    html += '<div class="card-header fw-bold" style="background:var(--cisco-dark);color:#fff">' + domain + '</div>';
    html += '<div class="card-body p-3">';
    html += '<div id="pvi-metrics-' + slug + '"></div>';
    html += '<hr/>';
    html += '<div class="mb-2"><strong class="small text-uppercase" style="letter-spacing:.04em">Simulation</strong></div>';
    html += '<div class="mb-3 small">';
    html += '<label class="d-flex justify-content-between"><span>Target Onboard Booking</span><strong id="sim-onb-lbl-' + slug + '">$0</strong></label>';
    html += '<input type="range" id="sim-onb-' + slug + '" class="form-range" min="0" max="100" step="1" value="0"/>';
    html += '</div>';
    html += '<div class="mb-2 small">';
    html += '<label class="d-flex justify-content-between"><span>Target Adopt Booking</span><strong id="sim-adp-lbl-' + slug + '">$0</strong></label>';
    html += '<input type="range" id="sim-adp-' + slug + '" class="form-range" min="0" max="100" step="1" value="0"/>';
    html += '</div>';
    html += '<div id="sim-result-' + slug + '" class="mt-2"></div>';
    html += '</div></div></div>';
  });
  html += '</div>';

  el.innerHTML = html;

  // ── Render each domain
  DOMAINS.forEach(function (domain) {
    var slug = domain.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
    var m = computeDomain(domain);

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

    // Wire up simulation sliders (0–100% of eligible booking)
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
      var simOnbScore = lookupPVIScore(domain, "Onboard", onbPct);
      var simAdpScore = lookupPVIScore(domain, "Adopt",   adpPct);
      var simTotal    = (simOnbScore + simAdpScore) / 2;
      var html = '<div class="d-flex gap-3 flex-wrap">';
      html += '<div class="text-center"><div class="small text-muted">Sim Onboard</div><div style="font-size:1.4rem">' + simOnbScore + '</div></div>';
      html += '<div class="text-center"><div class="small text-muted">Sim Adopt</div><div style="font-size:1.4rem">' + simAdpScore + '</div></div>';
      html += '<div class="text-center"><div class="small text-muted fw-bold">Sim Total</div><div class="pvi-score-total fw-bold ' + scoreClass(simTotal) + '">' + simTotal.toFixed(1) + '</div></div>';
      html += '</div>';
      document.getElementById("sim-result-" + slug).innerHTML = html;
    }

    document.getElementById("sim-onb-" + slug).addEventListener("input", updateSim);
    document.getElementById("sim-adp-" + slug).addEventListener("input", updateSim);

    // Set sliders to current actual values, then show initial simulation
    if (m.eligBook > 0) {
      document.getElementById("sim-onb-" + slug).value = Math.round((m.onbBook / m.eligBook) * 100);
      document.getElementById("sim-adp-" + slug).value = Math.round((m.adpBook / m.eligBook) * 100);
    }
    updateSim();
  });
}

window.renderPVI = renderPVI;
