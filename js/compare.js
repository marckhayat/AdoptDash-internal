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
  var useBeGeoKey = (scopeType !== "region" && scopeType !== "theater");
  var dimField  = scopeType === "region"  ? "Theater"
                : scopeType === "theater" ? "Partner Country"
                : "BE GEO ID";
  var dimLabel  = scopeType === "region"  ? "Theater"
                : scopeType === "theater" ? "Country"
                : "Partner";

  // ── Build BE GEO ID → partner names map (from full dataset) ──────────────
  var beGeoLabelMap = {};
  if (useBeGeoKey) {
    data.forEach(function(r) {
      var geoId = String(r["BE GEO ID"] || "").trim();
      var pname = String(r["Partner Name"] || "").trim();
      if (!geoId || !pname) return;
      if (!beGeoLabelMap[geoId]) beGeoLabelMap[geoId] = new Set();
      beGeoLabelMap[geoId].add(pname);
    });
  }

  // ── Unique portfolios + offers in data ─────────────────────────────────────
  var portfolioSet = new Set();
  var offersByPortfolio = {};
  data.forEach(function(r) {
    if (norm(r["Maximum Incentive Deal Flag"]) !== "YES") return;
    var p = r["Deal CPI Portfolio"];
    if (!p) return;
    portfolioSet.add(p);
    if (!offersByPortfolio[p]) offersByPortfolio[p] = new Set();
    if (r["Track"]) offersByPortfolio[p].add(r["Track"]);
  });
  var portfolios = Array.from(portfolioSet).sort(function(a, b) {
    var ai = PORTFOLIO_ORDER.indexOf(a), bi = PORTFOLIO_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1; if (bi === -1) return -1;
    return ai - bi;
  });

  // ── FY detection (using Cisco fiscal calendar) ─────────────────────────────
  function getFyNum(dateVal) {
    // dateVal may be an Excel serial number, string, or Date
    var d;
    if (typeof dateVal === "number" && dateVal > 1000) {
      d = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
    } else if (dateVal instanceof Date) {
      d = dateVal;
    } else if (typeof dateVal === "string" && dateVal.trim()) {
      d = new Date(dateVal);
    }
    if (!d || isNaN(d.getTime())) return null;
    // Try fiscal calendar lookup first
    if (window.getFiscalMonth) {
      var fm = window.getFiscalMonth(d);
      if (fm) return parseInt(fm.fy.replace("FY", ""), 10) + 2000;
    }
    // Fallback: Cisco FY starts ~late July (month index 6)
    return d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear();
  }

  var fyYears = new Set();
  data.forEach(function(r) {
    var fy = getFyNum(r["Adopt Rebate Start Date"]);
    if (fy) fyYears.add(fy);
  });
  var fyList = Array.from(fyYears).sort(function(a, b) { return a - b; });
  var _now = new Date();
  var _currentFY = getFyNum(_now) || (_now.getFullYear() + 1);
  var _saved = window.APP_FILTER_STATE && window.APP_FILTER_STATE.compare;
  var _selectedFY        = (_saved && _saved.fy != null) ? _saved.fy : (fyList.indexOf(_currentFY) !== -1 ? _currentFY : (fyList[fyList.length - 1] || _currentFY));
  var _selectedPortfolio = (_saved && _saved.portfolio) || "";
  var _selectedOffer     = (_saved && _saved.offer)     || "";
  var showAll = true;

  function getOfferOptions(pf) {
    var opts = pf ? Array.from(offersByPortfolio[pf] || []) : (function() {
      var all = new Set();
      portfolios.forEach(function(p) { offersByPortfolio[p].forEach(function(o) { all.add(o); }); });
      return Array.from(all);
    })();
    return opts.sort();
  }

  // ── Build HTML ──────────────────────────────────────────────────────────────
  var html = '<div class="p-3">';

  // Controls row
  html += '<div class="slicer-row mb-4">';

  // FY toggle
  html += '<div class="d-flex flex-column"><label class="small text-muted mb-1">Fiscal Year</label>';
  html += '<div class="btn-group btn-group-sm" id="cmp-fy-toggle">';
  html += '<button type="button" class="btn btn-outline-primary' + (_selectedFY === "all" ? ' active' : '') + '" data-fy="all">All Time</button>';
  if (fyList.length === 0) {
    html += '<button type="button" class="btn btn-outline-primary' + (_selectedFY === _currentFY ? ' active' : '') + '" data-fy="' + _currentFY + '">FY' + String(_currentFY).slice(-2) + '</button>';
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

  // Offer filter
  html += '<div class="d-flex flex-column"><label class="small text-muted mb-1">Offer</label>';
  html += '<select id="cmp-offer" class="form-select form-select-sm" style="min-width:200px">';
  html += '<option value="">All Offers</option>';
  getOfferOptions(_selectedPortfolio).forEach(function(o) { html += '<option value="' + escHtml(o) + '"' + (o === _selectedOffer ? ' selected' : '') + '>' + escHtml(o) + '</option>'; });
  html += '</select></div>';

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
  html += '<div class="card-body p-3" id="cmp-optin-body" style="min-height:280px;height:280px"><canvas id="cmp-chart-optin"></canvas></div>';
  html += '</div></div>';

  html += '<div class="col-12 col-xl-6"><div class="card shadow-sm">';
  html += '<div class="card-header fw-semibold d-flex align-items-center justify-content-between">';
  html += '<span><i class="bi bi-cash-stack me-2 text-warning"></i>Estimated Earned Incentives</span>';
  html += '<span id="cmp-earned-total" class="fw-normal text-muted" style="font-size:0.82rem"></span></div>';
  html += '<div class="card-body p-3" id="cmp-earned-body" style="min-height:280px;height:280px"><canvas id="cmp-chart-earned"></canvas></div>';
  html += '</div></div>';

  html += '</div></div>'; // end row + p-3
  el.innerHTML = html;

  var EARN_STAGES = [
    { flagField: "Stage Completion Flag(onboard)", dateField: "Stage Completion Date(onboard)", amtField: "Estimated Incentive Amount(Onboard)" },
    { flagField: "Stage Completion Flag(Use)",     dateField: "Stage Completion Date(Use)",     amtField: "Estimated Incentive Amount(Use)"     },
    { flagField: "Stage Completion Flag(Engage)",  dateField: "Stage Completion Date(Engage)",  amtField: "Estimated Incentive Amount(Engage)"  },
    { flagField: "Stage Completion Flag(Adopt)",   dateField: "Stage Completion Date(Adopt)",   amtField: "Estimated Incentive Amount(Adopt)"   }
  ];

  function dateInFY(d, fyNum) {
    if (!d || isNaN(d.getTime())) return false;
    if (window.getFiscalMonth) {
      var fm = window.getFiscalMonth(d);
      return fm && (parseInt(fm.fy.replace("FY", ""), 10) + 2000) === fyNum;
    }
    var fy = d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear();
    return fy === fyNum;
  }

  // ── Data computation ────────────────────────────────────────────────────────
  function computeData() {
    var portfolio = document.getElementById("cmp-portfolio").value;
    var offer     = document.getElementById("cmp-offer").value;

    // Save state
    if (window.APP_FILTER_STATE) {
      window.APP_FILTER_STATE.compare = { fy: _selectedFY, portfolio: portfolio, offer: offer };
    }

    // Filter: eligible rows (MaxFlag=YES), optional portfolio + offer
    var eligRows = data.filter(function(r) {
      if (norm(r["Maximum Incentive Deal Flag"]) !== "YES") return false;
      if (portfolio && r["Deal CPI Portfolio"] !== portfolio) return false;
      if (offer     && r["Track"]              !== offer)     return false;
      return true;
    });

    // Opt-ins: keyed by Adopt Rebate Start Date falling in FY (matches cpi-adopt chart 3)
    var optInRows = eligRows.filter(function(r) {
      if (!r["Offer opted-in?"]) return false;
      if (_selectedFY === "all") return true;
      var d = new Date(r["Adopt Rebate Start Date"]);
      return dateInFY(d, _selectedFY);    });

    // Earned: keyed by Stage Completion Date falling in FY (matches cpi-adopt chart 5)
    // Uses per-stage amounts, checks Earned? flag and lciStart/expiry bounds
    var entityMap = {};

    // First pass: opt-ins
    optInRows.forEach(function(r) {
      var entity = String(r[dimField] || "").trim() || "(unknown)";
      if (!entityMap[entity]) entityMap[entity] = { eligKeys: new Set(), optInKeys: new Set(), optInByP: {}, earnedByP: {} };
      var key = String(r["CRPartyID-Offer"] || "");
      entityMap[entity].eligKeys.add(key);
      var p = r["Deal CPI Portfolio"] || "Other";
      if (!entityMap[entity].optInKeys.has(key)) {
        entityMap[entity].optInByP[p] = (entityMap[entity].optInByP[p] || 0) + 1;
      }
      entityMap[entity].optInKeys.add(key);
    });

    // Second pass: earned incentives by stage completion date
    eligRows.forEach(function(r) {
      if (!r["Earned?"]) return;
      var p = r["Deal CPI Portfolio"] || "Other";
      if (portfolio && p !== portfolio) return;
      var entity = String(r[dimField] || "").trim() || "(unknown)";
      if (!entityMap[entity]) entityMap[entity] = { eligKeys: new Set(), optInKeys: new Set(), optInByP: {}, earnedByP: {} };
      var lciStart = new Date(r["Adopt Rebate Start Date"]);
      var expiry   = new Date(r["Deal Incentive Expiry Date"]);
      if (isNaN(lciStart.getTime()) || isNaN(expiry.getTime())) return;
      EARN_STAGES.forEach(function(s) {
        if (norm(r[s.flagField]) !== "YES") return;
        var d = new Date(r[s.dateField]);
        if (isNaN(d.getTime()) || d < lciStart || d > expiry) return;
        if (_selectedFY !== "all" && !dateInFY(d, _selectedFY)) return;
        var amt = parseFloat(r[s.amtField]) || 0;
        if (amt === 0) return;
        entityMap[entity].earnedByP[p] = (entityMap[entity].earnedByP[p] || 0) + amt;
      });
    });

    var entries = Object.keys(entityMap).map(function(entity) {
      var m = entityMap[entity];
      var totalEarned = Object.keys(m.earnedByP).reduce(function(s, k) { return s + m.earnedByP[k]; }, 0);
      var label;
      if (useBeGeoKey) {
        var names = beGeoLabelMap[entity] ? Array.from(beGeoLabelMap[entity]) : [entity];
        label = names.length === 1 ? names[0] : names;
      } else {
        label = entity;
      }
      return { entity: entity, label: label, eligible: m.eligKeys.size, optIn: m.optInKeys.size, optInByP: m.optInByP, earnedByP: m.earnedByP, totalEarned: totalEarned };
    });

    var pfList = portfolio ? [portfolio] : portfolios;
    var byOptIn  = entries.slice().sort(function(a, b) { return b.optIn       - a.optIn;       });
    var byEarned = entries.slice().sort(function(a, b) { return b.totalEarned - a.totalEarned; });
    return { byOptIn: byOptIn, byEarned: byEarned, pfList: pfList };
  }

  // ── Chart renderers ─────────────────────────────────────────────────────────
  function fmtTick(v) {
    if (Math.abs(v) >= 1e6) return "$" + (v/1e6).toFixed(1) + "M";
    if (Math.abs(v) >= 1e3) return "$" + (v/1e3).toFixed(0) + "K";
    return "$" + Math.round(v).toLocaleString();
  }

  function renderOptInChart(entries, pfList) {
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

    var datasets = pfList.map(function(p, i) {
      return {
        label: p,
        data: entries.map(function(e) { return e.optInByP[p] || 0; }),
        backgroundColor: PORTFOLIO_COLORS[p] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]
      };
    });

    var ctx = document.getElementById("cmp-chart-optin").getContext("2d");
    _cmpChartOptin = new Chart(ctx, {
      type: "bar",
      data: {
        labels: entries.map(function(e) { return e.label; }),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 45 } },
          y: { stacked: true, beginAtZero: true, ticks: { font: { size: 10 } }, title: { display: true, text: "Unique Offer Opt-ins" } }
        },
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              footer: function(items) {
                var e = entries[items[0].dataIndex];
                return "Total opted-in: " + e.optIn;
              }
            }
          }
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
    if (totalEl) totalEl.textContent = fmtTick(grand) + " total";

    var datasets = pfList.map(function(p, i) {
      return {
        label: p,
        data: entries.map(function(e) { return e.earnedByP[p] || 0; }),
        backgroundColor: PORTFOLIO_COLORS[p] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]
      };
    });

    var ctx = document.getElementById("cmp-chart-earned").getContext("2d");
    _cmpChartEarned = new Chart(ctx, {
      type: "bar",
      data: { labels: entries.map(function(e) { return e.label; }), datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 45 } },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { font: { size: 10 }, callback: fmtTick },
            title: { display: true, text: "Estimated Earned ($)" }
          }
        },
        plugins: {
          legend: { display: true, position: "bottom" },
          tooltip: {
            callbacks: {
              label: function(ctx) { return " " + ctx.dataset.label + ": " + fmtTick(ctx.raw); },
              footer: function(items) {
                if (pfList.length > 1) return "Total: " + fmtTick(entries[items[0].dataIndex].totalEarned);
                return "";
              }
            }
          }
        }
      }
    });
  }

  function render() {
    var d = computeData();
    renderOptInChart(d.byOptIn, d.pfList);
    renderEarnedChart(d.byEarned, d.pfList);
  }

  // ── Wire controls ───────────────────────────────────────────────────────────
  document.getElementById("cmp-fy-toggle").addEventListener("click", function(e) {
    var btn = e.target.closest("button[data-fy]");
    if (!btn) return;
    _selectedFY = btn.dataset.fy === "all" ? "all" : parseInt(btn.dataset.fy, 10);
    this.querySelectorAll("button").forEach(function(b) {
      b.classList.toggle("active", b.dataset.fy === String(_selectedFY));
    });
    render();
  });

  var pfSelEl = document.getElementById("cmp-portfolio");
  var ofSelEl = document.getElementById("cmp-offer");

  if (pfSelEl) pfSelEl.addEventListener("change", function() {
    var pf = this.value;
    // Repopulate offer dropdown
    var offers = getOfferOptions(pf);
    ofSelEl.innerHTML = '<option value="">All Offers</option>';
    offers.forEach(function(o) { ofSelEl.innerHTML += '<option value="' + escHtml(o) + '">' + escHtml(o) + '</option>'; });
    render();
  });

  if (ofSelEl) ofSelEl.addEventListener("change", render);

  render();
}

window.renderCompare = renderCompare;
