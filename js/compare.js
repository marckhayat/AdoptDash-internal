// =============================================================================
// compare.js — Leaderboard tab: compare performance across theaters/countries/partners
// =============================================================================

var _cmpChartOptin  = null;
var _cmpChartEarned = null;

function renderCompare(data) {
  var el = document.getElementById("tab-compare");
  if (!el) return;

  function norm(x) {
    if (x === null || x === undefined) return "";
    return String(x).replace(/\u00A0/g, " ").trim().toUpperCase();
  }
  function fmtCur(v) {
    if (!v || isNaN(v)) return "$0";
    return "$" + (v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? (v / 1e3).toFixed(0) + "K" : Math.round(v));
  }
  function escHtml(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  var PORTFOLIO_ORDER  = ["Networking", "Security", "Cloud + AI Infrastructure", "Collaboration"];
  var PORTFOLIO_COLORS = {
    "Networking":                "rgba(0, 114, 198, 0.80)",
    "Security":                  "rgba(220, 53, 69, 0.80)",
    "Cloud + AI Infrastructure": "rgba(25, 135, 84, 0.80)",
    "Collaboration":             "rgba(255, 193, 7, 0.85)"
  };
  var FALLBACK_COLORS = ["rgba(108,117,125,0.75)","rgba(102,16,242,0.75)","rgba(253,126,20,0.75)","rgba(13,202,240,0.75)"];

  // ── Determine comparison dimension ─────────────────────────────────────────
  var scopeType = (window.APP_FILE_META && window.APP_FILE_META._scopeType) || "region";
  var dimField  = scopeType === "region"  ? "Theater"
                : scopeType === "theater" ? "Partner Country"
                : "CR Party Name";
  var dimLabel  = scopeType === "region"  ? "Theater"
                : scopeType === "theater" ? "Country"
                : "Partner";

  // ── Unique portfolios in data ───────────────────────────────────────────────
  var portfolioSet = new Set();
  data.forEach(function(r) {
    if (norm(r["Maximum Incentive Deal Flag"]) === "YES" && r["Deal CPI Portfolio"]) portfolioSet.add(r["Deal CPI Portfolio"]);
  });
  var portfolios = Array.from(portfolioSet).sort(function(a, b) {
    var ai = PORTFOLIO_ORDER.indexOf(a), bi = PORTFOLIO_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1; if (bi === -1) return -1;
    return ai - bi;
  });

  // ── FY detection ────────────────────────────────────────────────────────────
  var fyYears = new Set();
  data.forEach(function(r) {
    var d = r["Adopt Rebate Start Date"];
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return;
    var fy = d.getMonth() >= 7 ? d.getFullYear() + 1 : d.getFullYear();
    fyYears.add(fy);
  });
  var fyList = Array.from(fyYears).sort(function(a, b) { return a - b; });
  var _now = new Date();
  var _currentFY = _now.getMonth() >= 7 ? _now.getFullYear() + 1 : _now.getFullYear();
  var _saved = window.APP_FILTER_STATE && window.APP_FILTER_STATE.compare;
  var _selectedFY        = (_saved && _saved.fy)        || (fyList.indexOf(_currentFY) !== -1 ? _currentFY : (fyList[fyList.length - 1] || _currentFY));
  var _selectedPortfolio = (_saved && _saved.portfolio) || "";
  var _selectedTopN      = (_saved && _saved.topN != null) ? _saved.topN : 20;
  var showAll = scopeType === "region" || scopeType === "theater"; // small # of entities, always show all

  // ── Build HTML ──────────────────────────────────────────────────────────────
  var html = '<div class="p-3">';

  // Controls row
  html += '<div class="slicer-row mb-4">';

  // FY toggle
  html += '<div class="d-flex flex-column"><label class="small text-muted mb-1">Fiscal Year</label>';
  html += '<div class="btn-group btn-group-sm" id="cmp-fy-toggle">';
  if (fyList.length === 0) {
    html += '<button type="button" class="btn btn-outline-primary active" data-fy="' + _selectedFY + '">FY' + String(_selectedFY).slice(-2) + '</button>';
  } else {
    fyList.forEach(function(fy) {
      html += '<button type="button" class="btn btn-outline-primary' + (fy === _selectedFY ? ' active' : '') + '" data-fy="' + fy + '">FY' + String(fy).slice(-2) + '</button>';
    });
  }
  html += '</div></div>';

  // Portfolio filter
  html += '<div class="d-flex flex-column"><label class="small text-muted mb-1">Portfolio</label>';
  html += '<select id="cmp-portfolio" class="form-select form-select-sm" style="min-width:200px">';
  html += '<option value="">All Portfolios</option>';
  portfolios.forEach(function(p) { html += '<option value="' + escHtml(p) + '"' + (p === _selectedPortfolio ? ' selected' : '') + '>' + escHtml(p) + '</option>'; });
  html += '</select></div>';

  // Top N (for partner-level scope)
  if (!showAll) {
    html += '<div class="d-flex flex-column"><label class="small text-muted mb-1">Show top</label>';
    html += '<select id="cmp-topn" class="form-select form-select-sm" style="width:auto">';
    [10, 20, 30, 50, 0].forEach(function(n) {
      html += '<option value="' + n + '"' + (n === _selectedTopN ? ' selected' : '') + '>' + (n === 0 ? 'All' : String(n)) + '</option>';
    });
    html += '</select></div>';
  }

  html += '</div>'; // end slicer-row

  // Scope context badge
  var scopeLabel = (window.APP_FILE_META && window.APP_FILE_META._scopeLabel) || "";
  var scopeDesc = scopeType === "region"  ? "Comparing all <strong>Theaters</strong>"
                : scopeType === "theater" ? "Comparing all <strong>Countries</strong> in " + escHtml(scopeLabel)
                : scopeType === "begeoid" ? "Comparing <strong>Partners</strong> across BE GEO IDs: " + escHtml(scopeLabel)
                : "Comparing <strong>Partners</strong> in " + escHtml(scopeLabel);
  html += '<div class="alert alert-light border small py-2 mb-4"><i class="bi bi-bar-chart-line me-2 text-primary"></i>' + scopeDesc + '</div>';

  // Charts row
  html += '<div class="row g-4">';

  html += '<div class="col-12 col-xl-6"><div class="card shadow-sm">';
  html += '<div class="card-header fw-semibold d-flex align-items-center justify-content-between">';
  html += '<span><i class="bi bi-hand-thumbs-up-fill me-2 text-success"></i>Opt-in Count by ' + dimLabel + '</span>';
  html += '<span id="cmp-optin-total" class="fw-normal text-muted" style="font-size:0.82rem"></span></div>';
  html += '<div class="card-body p-3" id="cmp-optin-body"><canvas id="cmp-chart-optin"></canvas></div>';
  html += '</div></div>';

  html += '<div class="col-12 col-xl-6"><div class="card shadow-sm">';
  html += '<div class="card-header fw-semibold d-flex align-items-center justify-content-between">';
  html += '<span><i class="bi bi-cash-stack me-2 text-warning"></i>Earned Incentives by ' + dimLabel + '</span>';
  html += '<span id="cmp-earned-total" class="fw-normal text-muted" style="font-size:0.82rem"></span></div>';
  html += '<div class="card-body p-3" id="cmp-earned-body"><canvas id="cmp-chart-earned"></canvas></div>';
  html += '</div></div>';

  html += '</div></div>'; // end row + p-3
  el.innerHTML = html;

  // ── Data computation ────────────────────────────────────────────────────────
  function computeData() {
    var portfolio = document.getElementById("cmp-portfolio").value;
    var topNEl    = document.getElementById("cmp-topn");
    var topN      = showAll ? 0 : (topNEl ? parseInt(topNEl.value) : 20);

    // Save state
    if (window.APP_FILTER_STATE) {
      window.APP_FILTER_STATE.compare = { fy: _selectedFY, portfolio: portfolio, topN: topN };
    }

    // Filter: eligible + in selected FY + optional portfolio
    var fyRows = data.filter(function(r) {
      if (norm(r["Maximum Incentive Deal Flag"]) !== "YES") return false;
      var d = r["Adopt Rebate Start Date"];
      if (!d || !(d instanceof Date) || isNaN(d.getTime())) return false;
      var fy = d.getMonth() >= 7 ? d.getFullYear() + 1 : d.getFullYear();
      if (fy !== _selectedFY) return false;
      if (portfolio && r["Deal CPI Portfolio"] !== portfolio) return false;
      return true;
    });

    // Group by entity
    var entityMap = {};
    fyRows.forEach(function(r) {
      var entity = String(r[dimField] || "").trim() || "(unknown)";
      if (!entityMap[entity]) entityMap[entity] = { eligKeys: new Set(), optInKeys: new Set(), earnedByP: {} };
      var key = String(r["CRPartyID-Offer"] || "");
      entityMap[entity].eligKeys.add(key);
      if (r["Offer opted-in?"]) entityMap[entity].optInKeys.add(key);
      if (r["Earned?"]) {
        var p = r["Deal CPI Portfolio"] || "Other";
        entityMap[entity].earnedByP[p] = (entityMap[entity].earnedByP[p] || 0) + (parseFloat(r["Estimated Earned Incentives"]) || 0);
      }
    });

    var entries = Object.keys(entityMap).map(function(entity) {
      var m = entityMap[entity];
      var totalEarned = Object.keys(m.earnedByP).reduce(function(s, k) { return s + m.earnedByP[k]; }, 0);
      return { entity: entity, eligible: m.eligKeys.size, optIn: m.optInKeys.size, earnedByP: m.earnedByP, totalEarned: totalEarned };
    });

    var pfList = portfolio ? [portfolio] : portfolios;
    var byOptIn   = entries.slice().sort(function(a, b) { return b.optIn   - a.optIn;   });
    var byEarned  = entries.slice().sort(function(a, b) { return b.totalEarned - a.totalEarned; });
    if (topN > 0) { byOptIn = byOptIn.slice(0, topN); byEarned = byEarned.slice(0, topN); }
    return { byOptIn: byOptIn, byEarned: byEarned, pfList: pfList };
  }

  // ── Chart renderers ─────────────────────────────────────────────────────────
  function barChartH(n) { return Math.max(280, n * Math.max(24, Math.min(44, Math.floor(500 / Math.max(n, 1))))); }

  function renderOptInChart(entries) {
    if (_cmpChartOptin) { _cmpChartOptin.destroy(); _cmpChartOptin = null; }
    var totalEl = document.getElementById("cmp-optin-total");
    var bodyEl  = document.getElementById("cmp-optin-body");
    if (!entries.length) {
      if (bodyEl) bodyEl.innerHTML = '<p class="text-muted small">No opt-in data for this selection.</p>';
      if (totalEl) totalEl.textContent = "";
      return;
    }
    var total = entries.reduce(function(s, e) { return s + e.optIn; }, 0);
    if (totalEl) totalEl.textContent = total.toLocaleString() + " total opted-in";

    var h = barChartH(entries.length);
    var canvas = document.getElementById("cmp-chart-optin");
    canvas.style.height = h + "px"; canvas.height = h;

    _cmpChartOptin = new Chart(canvas, {
      type: "bar",
      data: {
        labels: entries.map(function(e) { return e.entity; }),
        datasets: [
          { label: "Opted-in",              data: entries.map(function(e) { return e.optIn; }),                        backgroundColor: "rgba(25,135,84,0.82)",  borderRadius: 3 },
          { label: "Eligible (not opted-in)", data: entries.map(function(e) { return Math.max(0, e.eligible - e.optIn); }), backgroundColor: "rgba(255,193,7,0.55)",  borderRadius: 3 }
        ]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { font: { size: 11 } } },
          tooltip: {
            callbacks: {
              footer: function(items) {
                var e = entries[items[0].dataIndex];
                var pct = e.eligible > 0 ? " (" + Math.round(e.optIn / e.eligible * 100) + "% opted-in)" : "";
                return "Total eligible: " + e.eligible + pct;
              }
            }
          }
        },
        scales: {
          x: { stacked: true, ticks: { font: { size: 10 } }, grid: { color: "rgba(0,0,0,0.06)" } },
          y: { stacked: true, ticks: { font: { size: 10 }, autoSkip: false } }
        }
      }
    });
  }

  function renderEarnedChart(entries, pfList) {
    if (_cmpChartEarned) { _cmpChartEarned.destroy(); _cmpChartEarned = null; }
    var totalEl = document.getElementById("cmp-earned-total");
    var bodyEl  = document.getElementById("cmp-earned-body");
    if (!entries.length) {
      if (bodyEl) bodyEl.innerHTML = '<p class="text-muted small">No earned data for this selection.</p>';
      if (totalEl) totalEl.textContent = "";
      return;
    }
    var grand = entries.reduce(function(s, e) { return s + e.totalEarned; }, 0);
    if (totalEl) totalEl.textContent = fmtCur(grand) + " total";

    var h = barChartH(entries.length);
    var canvas = document.getElementById("cmp-chart-earned");
    canvas.style.height = h + "px"; canvas.height = h;

    _cmpChartEarned = new Chart(canvas, {
      type: "bar",
      data: {
        labels: entries.map(function(e) { return e.entity; }),
        datasets: pfList.map(function(p, i) {
          return {
            label: p,
            data: entries.map(function(e) { return e.earnedByP[p] || 0; }),
            backgroundColor: PORTFOLIO_COLORS[p] || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
            borderRadius: 3
          };
        })
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: function(ctx) { return " " + ctx.dataset.label + ": " + fmtCur(ctx.raw); },
              footer: function(items) { return "Total: " + fmtCur(entries[items[0].dataIndex].totalEarned); }
            }
          }
        },
        scales: {
          x: { stacked: true, ticks: { font: { size: 10 }, callback: function(v) { return fmtCur(v); } }, grid: { color: "rgba(0,0,0,0.06)" } },
          y: { stacked: true, ticks: { font: { size: 10 }, autoSkip: false } }
        }
      }
    });
  }

  function render() {
    var d = computeData();
    renderOptInChart(d.byOptIn);
    renderEarnedChart(d.byEarned, d.pfList);
  }

  // ── Wire controls ───────────────────────────────────────────────────────────
  document.getElementById("cmp-fy-toggle").addEventListener("click", function(e) {
    var btn = e.target.closest("button[data-fy]");
    if (!btn) return;
    _selectedFY = parseInt(btn.dataset.fy, 10);
    this.querySelectorAll("button").forEach(function(b) { b.classList.toggle("active", parseInt(b.dataset.fy) === _selectedFY); });
    render();
  });
  document.getElementById("cmp-portfolio").addEventListener("change", render);
  var topNEl = document.getElementById("cmp-topn");
  if (topNEl) topNEl.addEventListener("change", render);

  render();
}

window.renderCompare = renderCompare;
