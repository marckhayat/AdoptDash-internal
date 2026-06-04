// =============================================================================
// cpi-adopt.js — CPI Adopt tab renderer
// =============================================================================

var _cpiChart1 = null;
var _cpiChart2 = null;
var _cpiChart2b = null;
var _cpiChart3 = null;
var _cpiChart4 = null;
var _cpiChart5 = null;
var _cpiChart6 = null;
var _cpiChart5Log = false;

function renderCPIAdopt(data) {
  var el = document.getElementById("tab-cpi-adopt");
  if (!el) return;

  function norm(x) {
    if (x === null || x === undefined) return "";
    return String(x).replace(/\u00A0/g, " ").trim().toUpperCase();
  }

  function fmtCurrency(v) {
    if (v === null || v === undefined || isNaN(v)) return "-";
    return "$" + Math.round(v).toLocaleString();
  }

  function fmtPct(v) {
    if (!v || isNaN(v)) return "0.0%";
    return (v * 100).toFixed(1) + "%";
  }

  var PORTFOLIO_ORDER = ["Networking", "Security", "Cloud + AI Infrastructure", "Collaboration"];

  // Collect unique portfolios & offers
  var portfolioSet = new Set();
  data.forEach(function (r) { if (norm(r["Maximum Incentive Deal Flag"]) === "YES" && r["Deal CPI Portfolio"]) portfolioSet.add(r["Deal CPI Portfolio"]); });
  var portfolios = Array.from(portfolioSet).sort(function (a, b) {
    var ai = PORTFOLIO_ORDER.indexOf(a), bi = PORTFOLIO_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  var offersByPortfolio = {};
  portfolios.forEach(function (p) { offersByPortfolio[p] = new Set(); });
  data.forEach(function (r) {
    if (norm(r["Maximum Incentive Deal Flag"]) === "YES" && r["Deal CPI Portfolio"] && r["Track"]) {
      if (offersByPortfolio[r["Deal CPI Portfolio"]]) offersByPortfolio[r["Deal CPI Portfolio"]].add(r["Track"]);
    }
  });

  // ── Build HTML ─────────────────────────────────────────────────────────────
  var html = '<div class="slicer-row mb-3">';
  html += '<div class="d-flex flex-column"><label for="cpi-portfolio">Portfolio</label>';
  html += '<select id="cpi-portfolio" class="form-select form-select-sm" style="min-width:220px"><option value="">All Portfolios</option>';
  portfolios.forEach(function (p) { html += '<option value="' + p.replace(/"/g,"&quot;") + '">' + p + '</option>'; });
  html += '</select></div>';

  html += '<div class="d-flex flex-column"><label for="cpi-offer">Offer</label>';
  html += '<select id="cpi-offer" class="form-select form-select-sm" style="min-width:220px"><option value="">All Offers</option>';
  var allOffers = new Set();
  portfolios.forEach(function (p) { offersByPortfolio[p].forEach(function (o) { allOffers.add(o); }); });
  Array.from(allOffers).sort().forEach(function (o) { html += '<option value="' + o.replace(/"/g,"&quot;") + '">' + o + '</option>'; });
  html += '</select></div>';
  html += '</div>';

  html += '<div class="row g-4 mb-4">';

  // ── Stat charts row: Eligible-only pie | Eligible+Expired pie | Earned by Portfolio
  html += '<div class="col-12 col-lg-4">';
  html += '<div class="card shadow-sm h-100"><div class="card-header fw-semibold">Incentives <small class="fw-normal">(eligible UCs only)</small> <i class="bi bi-info-circle text-muted ms-1" style="font-size:0.75rem;cursor:default" data-bs-toggle="tooltip" data-bs-placement="top" title="Breakdown of the total revised maximum incentive for currently Eligible deals: Earned, Missed, Potential (opted-in remaining), and Not opted-in."></i></div><div class="card-body">';
  html += '<div class="chart-container" style="min-height:220px;height:220px"><canvas id="cpi-chart2b"></canvas></div>';
  html += '<div id="cpi-ratio-elig" class="text-center mt-2"></div>';
  html += '</div></div></div>';

  html += '<div class="col-12 col-lg-4">';
  html += '<div class="card shadow-sm h-100"><div class="card-header fw-semibold">Incentives <small class="fw-normal">(eligible &amp; expired UCs)</small> <i class="bi bi-info-circle text-muted ms-1" style="font-size:0.75rem;cursor:default" data-bs-toggle="tooltip" data-bs-placement="top" title="Breakdown of the total revised maximum incentive for Eligible and Expired deals: Earned, Missed, Potential (opted-in remaining), and Not opted-in."></i></div><div class="card-body">';
  html += '<div class="chart-container" style="min-height:220px;height:220px"><canvas id="cpi-chart2"></canvas></div>';
  html += '<div id="cpi-ratio-eligexp" class="text-center mt-2"></div>';
  html += '</div></div></div>';

  html += '<div class="col-12 col-lg-4">';
  html += '<div class="card shadow-sm h-100"><div class="card-header fw-semibold d-flex justify-content-between align-items-center"><span>Total Earned by Portfolio <i class="bi bi-info-circle text-muted ms-1" style="font-size:0.75rem;cursor:default" data-bs-toggle="tooltip" data-bs-placement="top" title="Total estimated earned incentives per portfolio (all-time, not filtered by FY)."></i></span><span id="cpi-chart6-total" class="fw-normal text-muted"></span></div><div class="card-body">';
  html += '<div class="chart-container" style="min-height:220px;height:220px"><canvas id="cpi-chart6"></canvas></div>';
  html += '</div></div></div>';

  html += '</div>'; // stat charts row

  // ── Monthly charts group with shared FY toggle
  html += '<div class="card shadow-sm mb-2">';
  html += '<div class="card-header fw-semibold d-flex align-items-center justify-content-between flex-wrap gap-2">';
  html += '<span>Monthly Trends</span>';
  html += '<div class="d-flex align-items-center gap-2">';
  html += '<div class="btn-group btn-group-sm" id="cpi-fy-toggle" role="group"></div>';
  html += '<div class="form-check form-switch mb-0 ms-2"><input class="form-check-input" type="checkbox" id="cpi-log-toggle"><label class="form-check-label small" for="cpi-log-toggle">Log scale</label></div>';
  html += '</div></div>';
  html += '<div class="card-body">';
  html += '<div class="row g-4">';

  html += '<div class="col-12 col-lg-4">';
  html += '<div class="fw-semibold small mb-2">Monthly Opt-in Trend <i class="bi bi-info-circle text-muted" style="font-size:0.75rem;cursor:default" data-bs-toggle="tooltip" data-bs-placement="top" title="Number of opt-ins during the selected fiscal year."></i></div>';
  html += '<div class="chart-container" style="min-height:260px;height:260px"><canvas id="cpi-chart3"></canvas></div>';
  html += '</div>';

  html += '<div class="col-12 col-lg-4">';
  html += '<div class="fw-semibold small mb-2">Monthly Deal Progression Trend <small class="fw-normal">(opted-in UCs)</small> <i class="bi bi-info-circle text-muted" style="font-size:0.75rem;cursor:default" data-bs-toggle="tooltip" data-bs-placement="top" title="Number of UCs that have progressed during the selected fiscal year. No double-count within a month."></i></div>';
  html += '<div class="chart-container" style="min-height:260px;height:260px"><canvas id="cpi-chart4"></canvas></div>';
  html += '</div>';

  html += '<div class="col-12 col-lg-4">';
  html += '<div class="fw-semibold small mb-2 d-flex justify-content-between align-items-center">';
  html += '<span>Monthly Estimated Earned Incentives <i class="bi bi-info-circle text-muted" style="font-size:0.75rem;cursor:default" data-bs-toggle="tooltip" data-bs-placement="top" title="Amount of estimated earned incentives during the selected fiscal year."></i></span>';
  html += '<span id="cpi-chart5-total" class="text-muted fw-normal"></span>';
  html += '</div>';
  html += '<div class="chart-container" style="min-height:260px;height:260px"><canvas id="cpi-chart5"></canvas></div>';
  html += '</div>';

  html += '</div>'; // inner row
  html += '</div></div>'; // card-body + card

  el.innerHTML = html;

  // Initialise tooltips
  el.querySelectorAll("[data-bs-toggle='tooltip']").forEach(function (t) { new bootstrap.Tooltip(t, { html: false }); });

  // ── Compute available FY years from data date fields
  // FY N = Aug (N-1) → Jul N.  e.g. FY26 = Aug 2025 → Jul 2026
  var DATE_FIELDS_FOR_FY = [
    "Adopt Rebate Start Date",
    "Stage Completion Date(onboard)",
    "Stage Completion Date(Use)",
    "Stage Completion Date(Engage)",
    "Stage Completion Date(Adopt)"
  ];
  var fyYears = new Set();
  data.forEach(function (r) {
    DATE_FIELDS_FOR_FY.forEach(function (f) {
      var d = new Date(r[f]);
      if (isNaN(d.getTime())) return;
      // FY year: if month >= July (7), FY = year+1, else FY = year
      var fy = d.getMonth() >= 7 ? d.getFullYear() + 1 : d.getFullYear();
      fyYears.add(fy);
    });
  });
  var fyList = Array.from(fyYears).sort(function (a, b) { return a - b; }); // ascending (oldest left, newest right)

  // Determine current FY
  var _now = new Date();
  var _currentFY = _now.getMonth() >= 7 ? _now.getFullYear() + 1 : _now.getFullYear();
  var _selectedFY = fyList.indexOf(_currentFY) !== -1 ? _currentFY : (fyList[0] || _currentFY);

  // Build FY toggle buttons
  var fyToggleEl = document.getElementById("cpi-fy-toggle");
  fyList.forEach(function (fy) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-outline-primary" + (fy === _selectedFY ? " active" : "");
    btn.textContent = "FY" + String(fy).slice(-2);
    btn.dataset.fy = fy;
    fyToggleEl.appendChild(btn);
  });

  fyToggleEl.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-fy]");
    if (!btn) return;
    _selectedFY = parseInt(btn.dataset.fy, 10);
    fyToggleEl.querySelectorAll("button").forEach(function (b) { b.classList.toggle("active", parseInt(b.dataset.fy, 10) === _selectedFY); });
    buildMonthlyCharts(document.getElementById("cpi-portfolio").value, document.getElementById("cpi-offer").value);
  });

  // Portfolio change → refresh offer list
  document.getElementById("cpi-portfolio").addEventListener("change", function () {
    var pf = this.value;
    var offerSel = document.getElementById("cpi-offer");
    offerSel.innerHTML = '<option value="">All Offers</option>';
    var ofrs = pf ? Array.from(offersByPortfolio[pf] || []).sort() : Array.from(allOffers).sort();
    ofrs.forEach(function (o) { offerSel.innerHTML += '<option value="' + o.replace(/"/g,"&quot;") + '">' + o + '</option>'; });
    buildCharts(pf, "");
  });

  document.getElementById("cpi-offer").addEventListener("change", function () {
    buildCharts(document.getElementById("cpi-portfolio").value, this.value);
  });

  document.getElementById("cpi-log-toggle").addEventListener("change", function () {
    _cpiChart5Log = this.checked;
    buildMonthlyCharts(document.getElementById("cpi-portfolio").value, document.getElementById("cpi-offer").value);
  });

  buildCharts("", "");

  function buildCharts(portfolioFilter, offerFilter) {
    buildStatCharts(portfolioFilter, offerFilter);
    buildMonthlyCharts(portfolioFilter, offerFilter);
  }

  function buildStatCharts(portfolioFilter, offerFilter) {
    // Filter: MaxFlag=Yes, apply portfolio+offer filters
    var subset = data.filter(function (r) {
      if (norm(r["Maximum Incentive Deal Flag"]) !== "YES") return false;
      if (portfolioFilter && r["Deal CPI Portfolio"] !== portfolioFilter) return false;
      if (offerFilter     && r["Track"] !== offerFilter)                   return false;
      return true;
    });

    // Compute measures
    var eligPayout  = 0;
    var optedPayout = 0;
    var estEarned   = 0;
    var potRemain   = 0;
    var revMax      = 0;
    var missedIncent = 0;
    var totalMax    = 0; // Revised Max for all eligible/expired deals (the 100%)

    subset.forEach(function (r) {
      var maxIncentive = parseFloat(r["Revised Maximum Incentive Amount"]) || 0;
      var isEligible  = norm(r["Stage"]) === "ELIGIBLE";
      var isExpired   = norm(r["Stage"]) === "EXPIRED";
      var isOptedIn   = norm(r["Adopt Rebate Opt-In Status"]) === "OPTED IN";

      if (isEligible || isExpired) totalMax += maxIncentive;

      if (isEligible) {
        eligPayout += maxIncentive;
        if (isOptedIn) optedPayout += maxIncentive;
      }

      if (isOptedIn) {
        estEarned    += parseFloat(r["Estimated Earned Incentives"]) || 0;
        missedIncent += parseFloat(r["Missed Incentives"]) || 0;
        if (isEligible) {
          potRemain += maxIncentive;
        }
        if (isEligible || isExpired) {
          revMax += maxIncentive;
        }
      }
    });

    var notOptedPayout = Math.max(0, eligPayout - optedPayout);
    var ratio = eligPayout > 0 ? optedPayout / eligPayout : 0;

    // ── Chart 2: Pie — breakdown of total max incentive (eligible/expired)
    // 100% = totalMax; slices: Earned | Missed | Opted-in remaining | Not opted-in
    var optedInRemain = Math.max(0, revMax - estEarned - missedIncent);
    var notOptedInMax = Math.max(0, totalMax - revMax);
    if (_cpiChart2) { _cpiChart2.destroy(); _cpiChart2 = null; }
    var ctx2 = document.getElementById("cpi-chart2").getContext("2d");
    _cpiChart2 = new Chart(ctx2, {
      type: "doughnut",
      data: {
        labels: ["Earned", "Missed", "Potential", "Not opted-in"],
        datasets: [{
          data: [estEarned, missedIncent, optedInRemain, notOptedInMax],
          backgroundColor: ["#107C10", "#D13438", "#00BCF2", "#D0D0D0"],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var v = ctx.raw;
                var pct = totalMax > 0 ? " (" + Math.round(v / totalMax * 100) + "%)" : "";
                var fmt = Math.abs(v) >= 1000000 ? "$"+(v/1000000).toFixed(2)+"M"
                        : Math.abs(v) >= 1000    ? "$"+(v/1000).toFixed(1)+"K"
                        : "$"+Math.round(v).toLocaleString();
                return ctx.label + ": " + fmt + pct;
              }
            }
          }
        }
      }
    });

    // Opt-in ratio callout for eligible+expired chart
    var eligExpRatio = totalMax > 0 ? Math.round(revMax / totalMax * 100) : 0;
    document.getElementById("cpi-ratio-eligexp").innerHTML =
      '<span style="font-size:1rem;font-weight:600;color:#00BCF2">' + eligExpRatio + '% opted-in</span>' +
      '<span class="text-muted small ms-2">(' + fmtCurrency(revMax) + ' / ' + fmtCurrency(totalMax) + ')</span>';

    // ── Chart 2b: Pie — same breakdown but eligible-only (no expired)
    var eligEstEarned   = 0;
    var eligMissed      = 0;
    var eligRevMax      = 0;
    var eligTotalMax    = 0;
    subset.forEach(function (r) {
      var maxIncentive = parseFloat(r["Revised Maximum Incentive Amount"]) || 0;
      var isEligible  = norm(r["Stage"]) === "ELIGIBLE";
      var isOptedIn   = norm(r["Adopt Rebate Opt-In Status"]) === "OPTED IN";
      if (!isEligible) return;
      eligTotalMax += maxIncentive;
      if (isOptedIn) {
        eligRevMax      += maxIncentive;
        eligEstEarned   += parseFloat(r["Estimated Earned Incentives"]) || 0;
        eligMissed      += parseFloat(r["Missed Incentives"]) || 0;
      }
    });
    var eligOptedInRemain = Math.max(0, eligRevMax - eligEstEarned - eligMissed);
    var eligNotOptedIn    = Math.max(0, eligTotalMax - eligRevMax);
    if (_cpiChart2b) { _cpiChart2b.destroy(); _cpiChart2b = null; }
    var ctx2b = document.getElementById("cpi-chart2b").getContext("2d");
    _cpiChart2b = new Chart(ctx2b, {
      type: "doughnut",
      data: {
        labels: ["Earned", "Missed", "Potential", "Not opted-in"],
        datasets: [{
          data: [eligEstEarned, eligMissed, eligOptedInRemain, eligNotOptedIn],
          backgroundColor: ["#107C10", "#D13438", "#00BCF2", "#D0D0D0"],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var v = ctx.raw;
                var pct = eligTotalMax > 0 ? " (" + Math.round(v / eligTotalMax * 100) + "%)" : "";
                var fmt = Math.abs(v) >= 1000000 ? "$"+(v/1000000).toFixed(2)+"M"
                        : Math.abs(v) >= 1000    ? "$"+(v/1000).toFixed(1)+"K"
                        : "$"+Math.round(v).toLocaleString();
                return ctx.label + ": " + fmt + pct;
              }
            }
          }
        }
      }
    });

    // Opt-in ratio callout for eligible-only chart
    var eligOnlyRatio = eligTotalMax > 0 ? Math.round(eligRevMax / eligTotalMax * 100) : 0;
    document.getElementById("cpi-ratio-elig").innerHTML =
      '<span style="font-size:1rem;font-weight:600;color:#00BCF2">' + eligOnlyRatio + '% opted-in</span>' +
      '<span class="text-muted small ms-2">(' + fmtCurrency(eligRevMax) + ' / ' + fmtCurrency(eligTotalMax) + ')</span>';

    // ── Chart 6: Total Earned by Portfolio (all-time, not FY-filtered)
    var PORTFOLIO_COLORS = {
      "Networking":               "#00BCF2",
      "Security":                 "#E55400",
      "Cloud + AI Infrastructure":"#6BB700",
      "Collaboration":            "#7B3F91"
    };
    var EARN_STAGES = [
      { flagField: "Stage Completion Flag(onboard)", dateField: "Stage Completion Date(onboard)", amtField: "Estimated Incentive Amount(Onboard)" },
      { flagField: "Stage Completion Flag(Use)",     dateField: "Stage Completion Date(Use)",     amtField: "Estimated Incentive Amount(Use)"     },
      { flagField: "Stage Completion Flag(Engage)",  dateField: "Stage Completion Date(Engage)",  amtField: "Estimated Incentive Amount(Engage)"  },
      { flagField: "Stage Completion Flag(Adopt)",   dateField: "Stage Completion Date(Adopt)",   amtField: "Estimated Incentive Amount(Adopt)"   }
    ];
    var allEarnByPortfolio = {};
    var allEarnPortfolios = portfolioFilter ? [portfolioFilter] : portfolios;
    allEarnPortfolios.forEach(function (p) { allEarnByPortfolio[p] = 0; });
    subset.forEach(function (r) {
      if (!r["Earned?"]) return;
      var p = r["Deal CPI Portfolio"];
      if (!p || allEarnByPortfolio[p] === undefined) return;
      var lciStart = new Date(r["Adopt Rebate Start Date"]);
      var expiry   = new Date(r["Deal Incentive Expiry Date"]);
      if (isNaN(lciStart.getTime()) || isNaN(expiry.getTime())) return;
      EARN_STAGES.forEach(function (s) {
        if (norm(r[s.flagField]) !== "YES") return;
        var d = new Date(r[s.dateField]);
        if (isNaN(d.getTime()) || d < lciStart || d > expiry) return;
        allEarnByPortfolio[p] += parseFloat(r[s.amtField]) || 0;
      });
    });
    var chart6Portfolios = allEarnPortfolios.filter(function (p) { return allEarnByPortfolio[p] > 0; });
    chart6Portfolios.sort(function (a, b) { return allEarnByPortfolio[b] - allEarnByPortfolio[a]; });
    var chart6GrandTotal = chart6Portfolios.reduce(function (s, p) { return s + allEarnByPortfolio[p]; }, 0);
    var chart6TotalFmt = Math.abs(chart6GrandTotal) >= 1000000 ? "$"+(chart6GrandTotal/1000000).toFixed(2)+"M"
                       : Math.abs(chart6GrandTotal) >= 1000    ? "$"+(chart6GrandTotal/1000).toFixed(1)+"K"
                       : "$"+Math.round(chart6GrandTotal).toLocaleString();
    var t6El = document.getElementById("cpi-chart6-total");
    if (t6El) { t6El.textContent = "Total: " + chart6TotalFmt; t6El.style.fontSize = "1rem"; t6El.style.fontWeight = "600"; t6El.style.color = "#555"; }
    var chart6Colors = chart6Portfolios.map(function (p, idx) {
      var fallback = ["#00BCF2","#E55400","#6BB700","#7B3F91","#FF8C00","#005B99"];
      return PORTFOLIO_COLORS[p] || fallback[idx % fallback.length];
    });
    if (_cpiChart6) { _cpiChart6.destroy(); _cpiChart6 = null; }
    var ctx6 = document.getElementById("cpi-chart6").getContext("2d");
    _cpiChart6 = new Chart(ctx6, {
      type: "bar",
      data: {
        labels: chart6Portfolios,
        datasets: [{
          label: "Earned",
          data: chart6Portfolios.map(function (p) { return allEarnByPortfolio[p]; }),
          backgroundColor: chart6Colors
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            ticks: { callback: function (v) {
              if (Math.abs(v) >= 1000000) return "$"+(v/1000000).toFixed(1)+"M";
              if (Math.abs(v) >= 1000)    return "$"+(v/1000).toFixed(0)+"K";
              return "$"+Math.round(v).toLocaleString();
            }}
          },
          y: { grid: { display: false } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var v = ctx.raw;
                var fmt = Math.abs(v) >= 1000000 ? "$"+(v/1000000).toFixed(2)+"M"
                        : Math.abs(v) >= 1000    ? "$"+(v/1000).toFixed(1)+"K"
                        : "$"+Math.round(v).toLocaleString();
                return "Earned: " + fmt;
              }
            }
          }
        }
      }
    });
  }  // end buildStatCharts

  function buildMonthlyCharts(portfolioFilter, offerFilter) {
    var subset = data.filter(function (r) {
      if (norm(r["Maximum Incentive Deal Flag"]) !== "YES") return false;
      if (portfolioFilter && r["Deal CPI Portfolio"] !== portfolioFilter) return false;
      if (offerFilter     && r["Track"] !== offerFilter)                   return false;
      return true;
    });

    // ── Chart 3: Opt-in trend — deals opted-in per month, per portfolio
    var PORTFOLIO_COLORS = {
      "Networking":               "#00BCF2",
      "Security":                 "#E55400",
      "Cloud + AI Infrastructure":"#6BB700",
      "Collaboration":            "#7B3F91"
    };

    // Build 12 month buckets for the selected FY (Aug → Jul)
    // FY N: months Aug(N-1), Sep(N-1), ..., Jul(N)
    var fyStartYear = _selectedFY - 1; // Aug of this year starts the FY
    var monthLabels = [];
    var monthStarts = [];
    for (var mi = 0; mi < 12; mi++) {
      var mDate = new Date(fyStartYear, 7 + mi, 1); // month 7 = August; JS Date handles overflow into next year
      monthLabels.push(mDate.toLocaleString("default", { month: "short" }) + " '" + String(mDate.getFullYear()).slice(-2));
      monthStarts.push(mDate);
    }

    // Deals: MaxFlag=YES, Stage ELIGIBLE or EXPIRED, opted-in, apply offer filter
    var trendPortfolios = portfolioFilter ? [portfolioFilter] : portfolios;
    var trendCounts = {};
    trendPortfolios.forEach(function (p) { trendCounts[p] = new Array(12).fill(0); });

    data.forEach(function (r) {
      if (norm(r["Maximum Incentive Deal Flag"]) !== "YES") return;
      if (offerFilter && r["Track"] !== offerFilter) return;
      var st = norm(r["Stage"]);
      if (st !== "ELIGIBLE" && st !== "EXPIRED") return;
      if (norm(r["Adopt Rebate Opt-In Status"]) !== "OPTED IN") return;
      var p = r["Deal CPI Portfolio"];
      if (!p || !trendCounts[p]) return;
      var d = new Date(r["Adopt Rebate Start Date"]);
      if (isNaN(d.getTime())) return;
      for (var i = 0; i < 12; i++) {
        var start = monthStarts[i];
        var end   = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        if (d >= start && d < end) { trendCounts[p][i]++; break; }
      }
    });

    var trendDatasets = trendPortfolios.map(function (p, idx) {
      var fallbackColors = ["#00BCF2","#E55400","#6BB700","#7B3F91","#FF8C00","#005B99"];
      var color = PORTFOLIO_COLORS[p] || fallbackColors[idx % fallbackColors.length];
      return {
        label: p,
        data: trendCounts[p],
        borderColor: color,
        backgroundColor: color,
        tension: 0.35,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 6
      };
    });

    if (_cpiChart3) { _cpiChart3.destroy(); _cpiChart3 = null; }
    var ctx3 = document.getElementById("cpi-chart3").getContext("2d");
    _cpiChart3 = new Chart(ctx3, {
      type: "line",
      data: { labels: monthLabels, datasets: trendDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            ticks: { precision: 0 },
            title: { display: true, text: "# Deals Opted-in" }
          }
        },
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + ": " + ctx.raw + " deal" + (ctx.raw !== 1 ? "s" : "");
              }
            }
          }
        }
      }
    });

    // ── Chart 4: Progression trend — unique deals that progressed per month, per portfolio
    // A deal is counted in month M if any of its stage completion dates falls in month M.
    // Each deal counted at most once per month regardless of how many stages it completed.
    var STAGE_DATE_FIELDS = [
      "Stage Completion Date (Purchase)",
      "Stage Completion Date(onboard)",
      "Stage Completion Date (Implement)",
      "Stage Completion Date(Use)",
      "Stage Completion Date(Engage)",
      "Stage Completion Date(Adopt)"
    ];

    var progCounts = {};
    trendPortfolios.forEach(function (p) { progCounts[p] = new Array(12).fill(0); });

    data.forEach(function (r) {
      if (norm(r["Maximum Incentive Deal Flag"]) !== "YES") return;
      if (offerFilter && r["Track"] !== offerFilter) return;
      var st = norm(r["Stage"]);
      if (st !== "ELIGIBLE" && st !== "EXPIRED") return;
      if (norm(r["Adopt Rebate Opt-In Status"]) !== "OPTED IN") return;
      var p = r["Deal CPI Portfolio"];
      if (!p || !progCounts[p]) return;

      // Collect all valid stage completion dates for this deal
      var completionDates = [];
      STAGE_DATE_FIELDS.forEach(function (f) {
        var d = new Date(r[f]);
        if (!isNaN(d.getTime())) completionDates.push(d);
      });
      if (completionDates.length === 0) return;

      // For each month bucket, count this deal at most once if any completion date falls in it
      for (var i = 0; i < 12; i++) {
        var start = monthStarts[i];
        var end   = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        var progressed = completionDates.some(function (d) { return d >= start && d < end; });
        if (progressed) progCounts[p][i]++;
      }
    });

    var progDatasets = trendPortfolios.map(function (p, idx) {
      var fallbackColors = ["#00BCF2","#E55400","#6BB700","#7B3F91","#FF8C00","#005B99"];
      var color = PORTFOLIO_COLORS[p] || fallbackColors[idx % fallbackColors.length];
      return {
        label: p,
        data: progCounts[p],
        borderColor: color,
        backgroundColor: color,
        tension: 0.35,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 6
      };
    });

    if (_cpiChart4) { _cpiChart4.destroy(); _cpiChart4 = null; }
    var ctx4 = document.getElementById("cpi-chart4").getContext("2d");
    _cpiChart4 = new Chart(ctx4, {
      type: "line",
      data: { labels: monthLabels, datasets: progDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            ticks: { precision: 0 },
            title: { display: true, text: "# Deals Progressed" }
          }
        },
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + ": " + ctx.raw + " deal" + (ctx.raw !== 1 ? "s" : "");
              }
            }
          }
        }
      }
    });

    // ── Chart 5: Monthly Estimated Earned Incentives (Portfolio)
    // Mirror the exact per-stage conditions used in transform.js step 13:
    //   Stage Completion Flag = YES, completionDate >= lciStart, completionDate <= expiry
    var EARN_STAGES = [
      { flagField: "Stage Completion Flag(onboard)", dateField: "Stage Completion Date(onboard)", amtField: "Estimated Incentive Amount(Onboard)" },
      { flagField: "Stage Completion Flag(Use)",     dateField: "Stage Completion Date(Use)",     amtField: "Estimated Incentive Amount(Use)"     },
      { flagField: "Stage Completion Flag(Engage)",  dateField: "Stage Completion Date(Engage)",  amtField: "Estimated Incentive Amount(Engage)"  },
      { flagField: "Stage Completion Flag(Adopt)",   dateField: "Stage Completion Date(Adopt)",   amtField: "Estimated Incentive Amount(Adopt)"   }
    ];

    // Use the same portfolio list as Charts 3 & 4
    var earnPortfolios = portfolioFilter ? [portfolioFilter] : trendPortfolios;

    // earnedByPortfolio[portfolio][monthIndex] = total earned amount
    var earnedByPortfolio = {};
    earnPortfolios.forEach(function (p) { earnedByPortfolio[p] = new Array(12).fill(0); });

    subset.forEach(function (r) {
      if (!r["Earned?"]) return;
      var p = r["Deal CPI Portfolio"];
      if (!p || !earnedByPortfolio[p]) return;
      var lciStart = new Date(r["Adopt Rebate Start Date"]);
      var expiry   = new Date(r["Deal Incentive Expiry Date"]);
      if (isNaN(lciStart.getTime()) || isNaN(expiry.getTime())) return;
      EARN_STAGES.forEach(function (s) {
        if (norm(r[s.flagField]) !== "YES") return;
        var d = new Date(r[s.dateField]);
        if (isNaN(d.getTime())) return;
        if (d < lciStart || d > expiry) return;
        var amt = parseFloat(r[s.amtField]) || 0;
        if (amt === 0) return;
        for (var i = 0; i < 12; i++) {
          var start = monthStarts[i];
          var end   = new Date(start.getFullYear(), start.getMonth() + 1, 1);
          if (d >= start && d < end) { earnedByPortfolio[p][i] += amt; break; }
        }
      });
    });

    var earnFallbackColors = ["#00BCF2","#E55400","#6BB700","#7B3F91","#FF8C00","#005B99"];
    var earnDatasets = earnPortfolios.map(function (p, idx) {
      var color = PORTFOLIO_COLORS[p] || earnFallbackColors[idx % earnFallbackColors.length];
      return {
        label: p,
        data: earnedByPortfolio[p],
        backgroundColor: color
      };
    });

    // Compute grand total across all portfolios and months
    var earnTotal = 0;
    earnPortfolios.forEach(function (p) {
      earnedByPortfolio[p].forEach(function (v) { earnTotal += v; });
    });
    var earnTotalFmt = Math.abs(earnTotal) >= 1000000 ? "$" + (earnTotal / 1000000).toFixed(2) + "M"
                     : Math.abs(earnTotal) >= 1000    ? "$" + (earnTotal / 1000).toFixed(1) + "K"
                     : "$" + Math.round(earnTotal).toLocaleString();
    var totalEl = document.getElementById("cpi-chart5-total");
    if (totalEl) { totalEl.textContent = "Total: " + earnTotalFmt; totalEl.style.fontSize = "1rem"; totalEl.style.fontWeight = "600"; totalEl.style.color = "#555"; }

    if (_cpiChart5) { _cpiChart5.destroy(); _cpiChart5 = null; }
    var ctx5 = document.getElementById("cpi-chart5").getContext("2d");
    _cpiChart5 = new Chart(ctx5, {
      type: "bar",
      data: { labels: monthLabels, datasets: earnDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            grid: { display: false }
          },
          y: {
            stacked: true,
            type: _cpiChart5Log ? "logarithmic" : "linear",
            beginAtZero: true,
            ticks: {
              callback: function (v) {
                if (Math.abs(v) >= 1000000) return "$" + (v / 1000000).toFixed(1) + "M";
                if (Math.abs(v) >= 1000)    return "$" + (v / 1000).toFixed(0) + "K";
                return "$" + Math.round(v).toLocaleString();
              }
            },
            title: { display: true, text: "Estimated Earned ($)" }
          }
        },
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var v = ctx.raw;
                var fmt = Math.abs(v) >= 1000000 ? "$"+(v/1000000).toFixed(2)+"M"
                        : Math.abs(v) >= 1000    ? "$"+(v/1000).toFixed(1)+"K"
                        : "$"+Math.round(v).toLocaleString();
                return ctx.dataset.label + ": " + fmt;
              }
            }
          }
        }
      }
    });
  }
}

window.renderCPIAdopt = renderCPIAdopt;
