// =============================================================================
// cpi-adopt.js — CPI Adopt tab renderer
// =============================================================================

var _cpiChart1 = null;
var _cpiChart2 = null;
var _cpiChart3 = null;
var _cpiChart4 = null;
var _cpiChart5 = null;
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
  var html = '<div class="disclaimer-card mb-3">';
  html += '<p class="mb-1">The below charts contain <strong>all-time</strong> data for CPI Adopt. One use case per offer and CR Party ID is selected: preference is given to opted-in use cases, otherwise, the highest-incentive use case is chosen.</p>';
  html += '<p class="mb-1"><strong>Opt-in Ratio:</strong> compares the potentially available payout for eligible opted-in UCs to what can still be opted-in.</p>';
  html += '<p class="mb-0"><strong>Incentives:</strong> shows, for all opted-in UCs, the total amount of estimated earned incentives and the remaining potential.</p>';
  html += '</div>';

  html += '<div class="slicer-row mb-3">';
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

  html += '<div class="row g-4" style="align-items:stretch">';

  // ── Column 1: Opt-in Ratio + Opt-in Trend
  html += '<div class="col-12 col-lg-4 d-flex flex-column gap-4">';
  html += '<div class="card shadow-sm"><div class="card-header fw-semibold">Opt-in Ratio</div><div class="card-body">';
  html += '<div class="chart-container" style="min-height:220px;height:220px"><canvas id="cpi-chart1"></canvas></div>';
  html += '<div id="cpi-ratio-card" class="text-center mt-3"></div>';
  html += '</div></div>';
  html += '<div class="card shadow-sm flex-grow-1"><div class="card-header fw-semibold">Monthly Opt-in Trend</div><div class="card-body">';
  html += '<div class="chart-container" style="min-height:260px;height:260px"><canvas id="cpi-chart3"></canvas></div>';
  html += '</div></div>';
  html += '</div>';

  // ── Column 2: Incentives + Progression Trend
  html += '<div class="col-12 col-lg-4 d-flex flex-column gap-4">';
  html += '<div class="card shadow-sm"><div class="card-header fw-semibold">Incentives (opted-in UCs)</div><div class="card-body">';
  html += '<div class="chart-container" style="min-height:220px;height:220px"><canvas id="cpi-chart2"></canvas></div>';
  html += '</div></div>';
  html += '<div class="card shadow-sm flex-grow-1"><div class="card-header fw-semibold">Monthly Deal Progression Trend</div><div class="card-body">';
  html += '<div class="chart-container" style="min-height:260px;height:260px"><canvas id="cpi-chart4"></canvas></div>';
  html += '</div></div>';
  html += '</div>';

  // ── Column 3: Earned incentives by technology (tall)
  html += '<div class="col-12 col-lg-4 d-flex flex-column">';
  html += '<div class="card shadow-sm flex-grow-1"><div class="card-header fw-semibold d-flex justify-content-between align-items-center">';
  html += '<span>Monthly Estimated Earned Incentives </span>';
  html += '<div class="form-check form-switch mb-0 ms-3"><input class="form-check-input" type="checkbox" id="cpi-log-toggle"><label class="form-check-label small" for="cpi-log-toggle">Log scale</label></div>';
  html += '</div><div class="card-body">';
  html += '<div class="chart-container" style="min-height:580px;height:580px"><canvas id="cpi-chart5"></canvas></div>';
  html += '</div></div>';
  html += '</div>';

  html += '</div>'; // main row

  el.innerHTML = html;

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
    buildCharts(document.getElementById("cpi-portfolio").value, document.getElementById("cpi-offer").value);
  });

  buildCharts("", "");

  function buildCharts(portfolioFilter, offerFilter) {
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

    subset.forEach(function (r) {
      var maxIncentive = parseFloat(r["Revised Maximum Incentive Amount"]) || 0;
      var isEligible  = norm(r["Stage"]) === "ELIGIBLE";
      var isOptedIn   = norm(r["Adopt Rebate Opt-In Status"]) === "OPTED IN";

      if (isEligible) {
        eligPayout += maxIncentive;
        if (isOptedIn) optedPayout += maxIncentive;
      }

      if (isOptedIn) {
        estEarned += parseFloat(r["Estimated Earned Incentives"]) || 0;
        if (isEligible) potRemain += parseFloat(r["Potential Incentives"]) || 0;
      }
    });

    var notOptedPayout = Math.max(0, eligPayout - optedPayout);
    var ratio = eligPayout > 0 ? optedPayout / eligPayout : 0;

    // ── Chart 1: Horizontal stacked bar — Opted-in vs Still Available
    if (_cpiChart1) { _cpiChart1.destroy(); _cpiChart1 = null; }
    var ctx1 = document.getElementById("cpi-chart1").getContext("2d");
    _cpiChart1 = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: ["Payout"],
        datasets: [
          { label: "Opted-in",           data: [optedPayout],   backgroundColor: "#00BCF2" },
          { label: "Still available",    data: [notOptedPayout], backgroundColor: "#C7E0F4" }
        ]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            ticks: { callback: function (v) {
              if (Math.abs(v)>=1000000) return "$"+(v/1000000).toFixed(1)+"M";
              if (Math.abs(v)>=1000)    return "$"+(v/1000).toFixed(0)+"K";
              return "$"+Math.round(v).toLocaleString();
            }}
          },
          y: { stacked: true }
        },
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + ": $" + Math.round(ctx.raw).toLocaleString();
              }
            }
          }
        }
      }
    });

    // Ratio card
    document.getElementById("cpi-ratio-card").innerHTML =
      '<div class="metric-card d-inline-block px-4">' +
      '<div class="metric-value" style="color:var(--cisco-blue)">' + fmtPct(ratio) + '</div>' +
      '<div class="metric-label">Opt-in Rate (by payout value)</div>' +
      '</div>' +
      '<div class="d-flex gap-3 justify-content-center mt-2">' +
      '<small class="text-muted">Eligible: ' + fmtCurrency(eligPayout) + '</small>' +
      '<small class="text-muted">Opted-in: ' + fmtCurrency(optedPayout) + '</small>' +
      '</div>';

    // ── Chart 2: Clustered bar — Earned vs Potential Remaining
    if (_cpiChart2) { _cpiChart2.destroy(); _cpiChart2 = null; }
    var ctx2 = document.getElementById("cpi-chart2").getContext("2d");
    _cpiChart2 = new Chart(ctx2, {
      type: "bar",
      data: {
        labels: ["Incentives"],
        datasets: [
          { label: "Estimated Earned",    data: [estEarned],  backgroundColor: "#107C10" },
          { label: "Potential Remaining", data: [potRemain],  backgroundColor: "#C7E0F4" }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { font: { size: 11 } } },
          y: {
            ticks: { callback: function (v) {
              if (Math.abs(v)>=1000000) return "$"+(v/1000000).toFixed(1)+"M";
              if (Math.abs(v)>=1000)    return "$"+(v/1000).toFixed(0)+"K";
              return "$"+Math.round(v).toLocaleString();
            }}
          }
        },
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + ": $" + Math.round(ctx.raw).toLocaleString();
              }
            }
          }
        }
      }
    });

    // ── Chart 3: Opt-in trend — deals opted-in per month, per portfolio
    var PORTFOLIO_COLORS = {
      "Networking":               "#00BCF2",
      "Security":                 "#E55400",
      "Cloud + AI Infrastructure":"#6BB700",
      "Collaboration":            "#7B3F91"
    };

    // Build 12 month buckets ending with the current month
    var now = new Date();
    var monthLabels = [];
    var monthStarts = [];
    for (var mi = 11; mi >= 0; mi--) {
      var mDate = new Date(now.getFullYear(), now.getMonth() - mi, 1);
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

    // ── Chart 5: Monthly Estimated Earned Incentives (Track)
    // Logic mirrors the Excel SUMPRODUCT formula:
    // For each month and each Track, sum each stage's incentive amount where
    // Earned?=TRUE and that stage's completion date falls within the month.
    var EARN_STAGES = [
      { dateField: "Stage Completion Date(onboard)", amtField: "Estimated Incentive Amount(Onboard)" },
      { dateField: "Stage Completion Date(Use)",     amtField: "Estimated Incentive Amount(Use)"     },
      { dateField: "Stage Completion Date(Engage)",  amtField: "Estimated Incentive Amount(Engage)"  },
      { dateField: "Stage Completion Date(Adopt)",   amtField: "Estimated Incentive Amount(Adopt)"   }
    ];

    // Collect unique tracks from filtered data (MaxFlag=YES + portfolio/offer filters)
    var trackSet = new Set();
    subset.forEach(function (r) { if (r["Track"]) trackSet.add(r["Track"]); });
    var tracks = Array.from(trackSet).sort();

    // earnedByTrack[track][monthIndex] = total earned amount
    var earnedByTrack = {};
    tracks.forEach(function (t) { earnedByTrack[t] = new Array(12).fill(0); });

    subset.forEach(function (r) {
      if (!r["Earned?"]) return;
      var t = r["Track"];
      if (!t || !earnedByTrack[t]) return;
      EARN_STAGES.forEach(function (s) {
        var d = new Date(r[s.dateField]);
        if (isNaN(d.getTime())) return;
        var amt = parseFloat(r[s.amtField]) || 0;
        if (amt === 0) return;
        for (var i = 0; i < 12; i++) {
          var start = monthStarts[i];
          var end   = new Date(start.getFullYear(), start.getMonth() + 1, 1);
          if (d >= start && d < end) { earnedByTrack[t][i] += amt; break; }
        }
      });
    });

    var TRACK_PALETTE = [
      "#00BCF2","#E55400","#6BB700","#7B3F91",
      "#FF8C00","#005B99","#C00000","#00B294",
      "#D69E2E","#553C9A","#2B7A0B","#B83280"
    ];
    var earnDatasets = tracks.map(function (t, idx) {
      return {
        label: t,
        data: earnedByTrack[t],
        backgroundColor: TRACK_PALETTE[idx % TRACK_PALETTE.length]
      };
    });

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
