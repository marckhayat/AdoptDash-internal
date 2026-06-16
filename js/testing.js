// testing.js — TESTING tab: Pareto analysis of Potential Incentives
var _paretoChart = null;

function renderTesting(data) {
  var el = document.getElementById("tab-testing");
  if (!el) return;

  var isDisti = !!window.APP_IS_DISTI;
  var dimField = isDisti ? "2T Partner Name" : "CX Customer BU ID";
  var nameField = isDisti ? "2T Partner Name" : "CR Party Name";
  var dimLabel = isDisti ? "2T Partner" : "Customer";

  function norm(x) {
    if (x === null || x === undefined) return "";
    return String(x).replace(/\u00A0/g, " ").trim().toUpperCase();
  }
  function fmtCurrency(v) {
    if (!v || isNaN(v)) return "$0";
    return "$" + Math.round(v).toLocaleString();
  }
  function escHtml(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // ── Unique portfolios & offers for slicers ─────────────────────────────────
  var portfolioSet = new Set();
  var offersByPortfolio = {};
  data.forEach(function (r) {
    var p = r["Deal CPI Portfolio"];
    if (p) {
      portfolioSet.add(p);
      if (!offersByPortfolio[p]) offersByPortfolio[p] = new Set();
      if (r["Track"]) offersByPortfolio[p].add(r["Track"]);
    }
  });
  var PORTFOLIO_ORDER = ["Networking", "Security", "Cloud + AI Infrastructure", "Collaboration"];
  var portfolios = Array.from(portfolioSet).sort(function(a, b) {
    var ai = PORTFOLIO_ORDER.indexOf(a), bi = PORTFOLIO_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  var allOffers  = Array.from(new Set(data.map(function(r){ return r["Track"]; }).filter(Boolean))).sort();

  // ── Build HTML ─────────────────────────────────────────────────────────────
  var html = '<div class="p-3">';
  html += '<h5 class="mb-3"><i class="bi bi-bar-chart-steps me-2"></i>Pareto – Potential Incentives by ' + dimLabel + '</h5>';
  html += '<p class="text-muted small mb-3">Ranks ' + dimLabel.toLowerCase() + 's by potential incentives. The line shows the cumulative share — the 80% threshold is highlighted.</p>';

  // Slicers
  html += '<div class="d-flex flex-wrap gap-3 mb-4 align-items-end">';

  html += '<div class="d-flex flex-column"><label class="small text-muted mb-1" for="pareto-mode">View</label>';
  html += '<select id="pareto-mode" class="form-select form-select-sm" style="min-width:220px">';
  html += '<option value="eligible">Eligible (1 per offer per CR)</option>';
  html += '<option value="optedin" selected>Opted-in</option>';
  html += '</select></div>';
  html += '<div class="d-flex flex-column"><label class="small text-muted mb-1" for="pareto-portfolio">Portfolio</label>';
  html += '<select id="pareto-portfolio" class="form-select form-select-sm" style="min-width:180px"><option value="">All Portfolios</option>';
  portfolios.forEach(function(p){ html += '<option value="' + escHtml(p) + '">' + escHtml(p) + '</option>'; });
  html += '</select></div>';

  html += '<div class="d-flex flex-column"><label class="small text-muted mb-1" for="pareto-offer">Offer</label>';
  html += '<select id="pareto-offer" class="form-select form-select-sm" style="min-width:180px"><option value="">All Offers</option>';
  allOffers.forEach(function(o){ html += '<option value="' + escHtml(o) + '">' + escHtml(o) + '</option>'; });
  html += '</select></div>';

  html += '<div class="d-flex flex-column"><label class="small text-muted mb-1" for="pareto-topn">Show top</label>';
  html += '<select id="pareto-topn" class="form-select form-select-sm" style="min-width:100px">';
  [10, 20, 30, 50].forEach(function(n){ html += '<option value="' + n + '"' + (n===20?' selected':'') + '>' + n + '</option>'; });
  html += '</select></div>';
  html += '</div>';

  var STAGE_ORDER = ["Purchase", "Onboard", "Implement", "Use", "Engage", "Adopt", "Completed"];
  var stageMaxIdx = STAGE_ORDER.length - 1;

  function stageBadgeHtml(name) {
    return '<span class="stage-badge stage-' + escHtml(name) + '">' + escHtml(name) + '</span>';
  }
  function makeStageSliderHtml(prefix) {
    return '<div class="date-slider-group">' +
      '<div class="slider-val-display">' +
      '<span id="' + prefix + '-from-lbl">' + stageBadgeHtml(STAGE_ORDER[0]) + '</span>' +
      '<span id="' + prefix + '-to-lbl">'   + stageBadgeHtml(STAGE_ORDER[stageMaxIdx]) + '</span>' +
      '</div>' +
      '<div class="dual-range-wrap">' +
      '<div class="dual-range-track"></div>' +
      '<div class="dual-range-fill" id="' + prefix + '-fill"></div>' +
      '<input type="range" class="range-from" id="' + prefix + '-from" min="0" max="' + stageMaxIdx + '" value="0" step="1">' +
      '<input type="range" class="range-to"   id="' + prefix + '-to"   min="0" max="' + stageMaxIdx + '" value="' + stageMaxIdx + '" step="1">' +
      '</div></div>';
  }

  // Chart + KPI strip
  html += '<div class="row g-3 mb-3">';
  html += '<div class="col-12 col-md-4 col-lg-3">';
  html += '<div class="card shadow-sm h-100"><div class="card-body d-flex flex-column gap-3">';
  html += '<div><div class="small text-muted mb-1">Current Stage</div>' + makeStageSliderHtml("pareto-cs") + '</div>';
  html += '<div id="pareto-kpis"></div>';
  html += '</div></div>';
  html += '</div>';
  html += '<div class="col-12 col-md-8 col-lg-9">';
  html += '<div class="card shadow-sm"><div class="card-body" style="position:relative;height:380px"><canvas id="pareto-chart"></canvas></div></div>';
  html += '</div>';
  html += '</div>';

  html += '</div>';
  el.innerHTML = html;

  // ── Render function ────────────────────────────────────────────────────────
  function renderPareto() {
    var portfolioFilter = document.getElementById("pareto-portfolio").value;
    var offerFilter     = document.getElementById("pareto-offer").value;
    var topN            = parseInt(document.getElementById("pareto-topn").value, 10) || 20;
    var mode            = document.getElementById("pareto-mode").value;
    var csFromEl        = document.getElementById("pareto-cs-from");
    var csToEl          = document.getElementById("pareto-cs-to");
    var csFromIdx       = csFromEl ? parseInt(csFromEl.value) : 0;
    var csToIdx         = csToEl   ? parseInt(csToEl.value)   : stageMaxIdx;
    var csActive        = !(csFromIdx === 0 && csToIdx === stageMaxIdx);

    // Filter based on selected mode
    var filtered = data.filter(function(r) {
      if (norm(r["Stage"]) !== "ELIGIBLE") return false;
      if (mode === "eligible") {
        if (norm(r["Maximum Incentive Deal Flag"]) !== "YES") return false;
      } else {
        if (norm(r["Adopt Rebate Opt-In Status"]) !== "OPTED IN") return false;
      }
      if (portfolioFilter && r["Deal CPI Portfolio"] !== portfolioFilter) return false;
      if (offerFilter && r["Track"] !== offerFilter) return false;
      if (csActive) {
        var si = STAGE_ORDER.indexOf(String(r["Current stage"] || ""));
        if (si === -1 || si < csFromIdx || si > csToIdx) return false;
      }
      return true;
    });

    // Aggregate Potential Incentives by dimension, de-duped at CRPartyID-Offer level
    var seenKeys    = {};
    var totals      = {};
    var dealCounts  = {};
    var dimNames    = {};
    var dealValueMap = {}; // dim → { key: {value, optedIn} }
    filtered.forEach(function(r) {
      var dim  = String(r[dimField] || "(Unknown)").trim();
      var name = String(r[nameField] || dim).trim();
      if (!dim) return;
      var key = String(r["CRPartyID-Offer"] || r["Deal WS-ID"] || "");
      var dedupeKey = dim + "||" + key;
      if (key && seenKeys[dedupeKey]) return;
      if (key) seenKeys[dedupeKey] = true;
      var val = parseFloat(r["Potential Incentives"]) || 0;
      var optedIn = norm(r["Adopt Rebate Opt-In Status"]) === "OPTED IN";
      totals[dim]     = (totals[dim]     || 0) + val;
      dealCounts[dim] = (dealCounts[dim] || 0) + 1;
      if (!dimNames[dim])    dimNames[dim]    = {};
      if (!dealValueMap[dim]) dealValueMap[dim] = {};
      dimNames[dim][name] = (dimNames[dim][name] || 0) + 1;
      dealValueMap[dim][key] = { value: (dealValueMap[dim][key] ? dealValueMap[dim][key].value : 0) + val, optedIn: optedIn };
    });

    // Build primary label (most frequent name) and full name list per dim
    function primaryLabel(dim) {
      if (isDisti) return dim;
      var counts = dimNames[dim] || {};
      return Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a]; })[0] || dim;
    }
    function allNames(dim) {
      if (isDisti) return [dim];
      return Object.keys(dimNames[dim] || {}).sort();
    }

    // Sort descending
    var entries = Object.keys(totals).map(function(k){
      var dvals = Object.values(dealValueMap[k] || {}).sort(function(a,b){ return b.value - a.value; });
      return { id: k, label: primaryLabel(k), names: allNames(k), value: totals[k], deals: dealCounts[k] || 0, dealValues: dvals,
               hasOptedIn: dvals.some(function(d){ return d.optedIn; }) };
    });
    entries.sort(function(a,b){
      if (b.value !== a.value) return b.value - a.value;
      if (mode === "eligible" && a.hasOptedIn !== b.hasOptedIn) return a.hasOptedIn ? -1 : 1;
      return a.label.localeCompare(b.label);
    });

    var grandTotal  = entries.reduce(function(s,e){ return s + e.value; }, 0);
    var grandDeals  = entries.reduce(function(s,e){ return s + e.deals; }, 0);
    var top         = entries.slice(0, topN);
    var topDeals    = top.reduce(function(s,e){ return s + e.deals; }, 0);

    // Cumulative % and cumulative amounts
    var cumSum = 0;
    var cumAmounts = [];
    var cumPcts = top.map(function(e){
      cumSum += e.value;
      cumAmounts.push(cumSum);
      return grandTotal > 0 ? (cumSum / grandTotal) * 100 : 0;
    });

    // 80% cutoff index
    var cutoff80   = cumPcts.findIndex(function(v){ return v >= 80; });
    var pct80Count = cutoff80 >= 0 ? cutoff80 + 1 : top.length;
    var deals80    = top.slice(0, pct80Count).reduce(function(s,e){ return s + e.deals; }, 0);

    // Save filter state
    if (window.APP_FILTER_STATE) {
      window.APP_FILTER_STATE.testing = { portfolio: portfolioFilter, offer: offerFilter, topN: String(topN), mode: mode, csFrom: csFromIdx, csTo: csToIdx,
        optedInHidden: !!(window.APP_FILTER_STATE.testing && window.APP_FILTER_STATE.testing.optedInHidden),
        notOptedInHidden: !!(window.APP_FILTER_STATE.testing && window.APP_FILTER_STATE.testing.notOptedInHidden) };
    }

    // KPIs
    var kpiEl = document.getElementById("pareto-kpis");

    function buildPreset(optedInHidden, notOptedInHidden) {
      var p = { stage: ["Eligible"], sortField: "Potential Incentives", sortDir: "desc" };
      if (mode === "eligible") {
        p.maxIncentive = true;
        if (notOptedInHidden && !optedInHidden)  p.optIn = ["OPTED IN"];
        if (optedInHidden    && !notOptedInHidden) p.optIn = ["PENDING"];
      } else {
        p.optIn = ["OPTED IN"];
      }
      if (portfolioFilter) p.portfolio = portfolioFilter;
      if (offerFilter)     p.offer     = offerFilter;
      if (csActive) { p.csFrom = csFromIdx; p.csTo = csToIdx; }
      return p;
    }

    function updateDeepLink(optedInHidden, notOptedInHidden) {
      _deepLinkPreset = buildPreset(optedInHidden, notOptedInHidden);
    }

    var _deepLinkPreset = buildPreset(false, false);

    kpiEl.innerHTML =
      '<div class="d-flex justify-content-between align-items-baseline"><span class="text-muted small">Total Potential</span><span class="fw-bold">' + fmtCurrency(grandTotal) + '</span></div>' +
      '<div class="d-flex justify-content-between align-items-baseline"><span class="text-muted small">' + dimLabel + 's in top ' + topN + '</span><span class="fw-bold">' + top.length + ' <span class="text-muted fw-normal" style="font-size:0.75rem">(' + topDeals + ' WS deals)</span></span></div>' +
      '<div class="d-flex justify-content-between align-items-baseline"><span class="text-muted small">' + dimLabel + 's driving 80%</span><span class="fw-bold text-warning">' + pct80Count + ' <span class="text-muted fw-normal" style="font-size:0.75rem">(' + deals80 + ' WS deals)</span></span></div>' +
      '<div class="d-flex justify-content-between align-items-baseline"><span class="text-muted small">Their share</span><span class="fw-bold text-danger">' + (grandTotal > 0 ? ((top.slice(0,pct80Count).reduce(function(s,e){return s+e.value;},0)/grandTotal*100).toFixed(1)) : "0.0") + '%</span></div>' +
      '<div class="mt-auto pt-2 border-top"><a href="#" id="pareto-deeplink" class="small"><i class="bi bi-box-arrow-up-right me-1"></i>Open in Details tab</a></div>';

    document.getElementById("pareto-deeplink").addEventListener("click", function(e) {
      e.preventDefault();
      window.navigateToDetails(_deepLinkPreset);
    });

    // Chart — stacked bars (one dataset per deal rank)
    if (_paretoChart) { _paretoChart.destroy(); _paretoChart = null; }
    var ctx = document.getElementById("pareto-chart").getContext("2d");

    var hasOptedIn = mode === "eligible" && top.some(function(e){ return e.dealValues.some(function(d){ return d.optedIn; }); });

    var barDatasets = [];

    if (mode === "eligible") {
      // Split into two separate stacks: opted-in and not-opted-in
      var maxOptedIn    = top.reduce(function(m,e){ return Math.max(m, e.dealValues.filter(function(d){ return  d.optedIn; }).length); }, 0);
      var maxNotOptedIn = top.reduce(function(m,e){ return Math.max(m, e.dealValues.filter(function(d){ return !d.optedIn; }).length); }, 0);

      // Not opted-in layers (yellow)
      for (var di = 0; di < maxNotOptedIn; di++) {
        (function(idx) {
          barDatasets.push({
            type: "bar", order: 2, stack: "deals",
            label: idx === 0 ? "Not opted-in" : "_no" + idx,
            _group: "notopted",
            data: top.map(function(e){
              var dv = e.dealValues.filter(function(d){ return !d.optedIn; });
              return dv[idx] ? dv[idx].value : 0;
            }),
            backgroundColor: top.map(function(e, i){
              var dv = e.dealValues.filter(function(d){ return !d.optedIn; });
              if (!dv[idx]) return "rgba(0,0,0,0)";
              return (cutoff80 === -1 || i <= cutoff80) ? "rgba(255,193,7,0.75)" : "rgba(108,117,125,0.45)";
            }),
            borderColor: "rgba(255,255,255,1)",
            borderWidth: { top: 2, right: 0, bottom: 0, left: 0 },
            yAxisID: "y"
          });
        })(di);
      }
      // Opted-in layers (green)
      for (var di2 = 0; di2 < maxOptedIn; di2++) {
        (function(idx) {
          barDatasets.push({
            type: "bar", order: 2, stack: "deals",
            label: idx === 0 ? "Opted-in" : "_oi" + idx,
            _group: "optedin",
            data: top.map(function(e){
              var dv = e.dealValues.filter(function(d){ return d.optedIn; });
              return dv[idx] ? dv[idx].value : 0;
            }),
            backgroundColor: top.map(function(e, i){
              var dv = e.dealValues.filter(function(d){ return d.optedIn; });
              if (!dv[idx]) return "rgba(0,0,0,0)";
              return (cutoff80 === -1 || i <= cutoff80) ? "rgba(25,135,84,0.80)" : "rgba(25,135,84,0.40)";
            }),
            borderColor: "rgba(255,255,255,1)",
            borderWidth: { top: 2, right: 0, bottom: 0, left: 0 },
            yAxisID: "y"
          });
        })(di2);
      }
    } else {
      // Opted-in mode: all deals green
      var maxDeals = top.reduce(function(m,e){ return Math.max(m, e.dealValues.length); }, 0);
      for (var di3 = 0; di3 < maxDeals; di3++) {
        (function(idx) {
          barDatasets.push({
            type: "bar", order: 2, stack: "deals",
            label: idx === 0 ? "Opted-in" : "_d" + idx,
            _group: "optedin",
            data: top.map(function(e){ return e.dealValues[idx] ? e.dealValues[idx].value : 0; }),
            backgroundColor: top.map(function(e, i){
              if (!e.dealValues[idx]) return "rgba(0,0,0,0)";
              return (cutoff80 === -1 || i <= cutoff80) ? "rgba(25,135,84,0.80)" : "rgba(25,135,84,0.40)";
            }),
            borderColor: "rgba(255,255,255,1)",
            borderWidth: { top: 2, right: 0, bottom: 0, left: 0 },
            yAxisID: "y"
          });
        })(di3);
      }
    }

    _paretoChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: top.map(function(e){ return e.label; }),
        datasets: barDatasets.concat([{
          type: "line",
          label: "Cumulative %",
          order: 1,
          data: cumPcts,
          borderColor: "rgba(220,53,69,0.85)",
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.2,
          yAxisID: "y2",
          fill: false
        }])
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          title: {
            display: true,
            text: "Potential Incentives",
            align: "start",
            font: { size: 12, weight: "600" },
            padding: { bottom: 6 }
          },
          legend: {
            position: "top",
            align: "center",
            labels: {
              font: { size: 11 },
              generateLabels: function(chart) {
                var labels = [];
                function groupHidden(group) {
                  return chart.data.datasets.every(function(ds, i){
                    return ds._group !== group || chart.getDatasetMeta(i).hidden;
                  });
                }
                if (mode === "eligible") {
                  labels.push({ text: "Opted-in",     fillStyle: "rgba(25,135,84,0.80)", strokeStyle: "rgba(255,255,255,1)", lineWidth: 1, hidden: groupHidden("optedin") });
                  labels.push({ text: "Not opted-in", fillStyle: "rgba(255,193,7,0.75)", strokeStyle: "rgba(255,255,255,1)", lineWidth: 1, hidden: groupHidden("notopted") });
                } else {
                  labels.push({ text: "Opted-in",     fillStyle: "rgba(25,135,84,0.80)", strokeStyle: "rgba(255,255,255,1)", lineWidth: 1, hidden: groupHidden("optedin") });
                }
                // Line entry
                chart.data.datasets.forEach(function(ds, i) {
                  if (ds.yAxisID === "y2") {
                    var meta = chart.getDatasetMeta(i);
                    labels.push({ text: ds.label, fillStyle: ds.borderColor, strokeStyle: ds.borderColor, lineWidth: 2, hidden: meta.hidden, lineDash: [], datasetIndex: i, pointStyle: "line" });
                  }
                });
                return labels;
              }
            },
            onClick: function(e, legendItem, legend) {
              var chart = legend.chart;
              if (legendItem.text === "Cumulative %") {
                Chart.defaults.plugins.legend.onClick.call(this, e, legendItem, legend);
                return;
              }
              var group = legendItem.text === "Opted-in" ? "optedin" : "notopted";
              var anyVisible = chart.data.datasets.some(function(ds, i){
                return ds._group === group && !chart.getDatasetMeta(i).hidden;
              });
              chart.data.datasets.forEach(function(ds, i){
                if (ds._group === group) chart.getDatasetMeta(i).hidden = anyVisible;
              });
              chart.update();
              // Update deep link and persist legend state
              var optedInHidden    = chart.data.datasets.every(function(ds,i){ return ds._group !== "optedin"  || chart.getDatasetMeta(i).hidden; });
              var notOptedInHidden = chart.data.datasets.every(function(ds,i){ return ds._group !== "notopted" || chart.getDatasetMeta(i).hidden; });
              updateDeepLink(optedInHidden, notOptedInHidden);
              if (window.APP_FILTER_STATE && window.APP_FILTER_STATE.testing) {
                window.APP_FILTER_STATE.testing.optedInHidden    = optedInHidden;
                window.APP_FILTER_STATE.testing.notOptedInHidden = notOptedInHidden;
              }
            }
          },
          tooltip: {
            filter: function(item) {
              return item.dataset.yAxisID === "y2" || item.dataset.label === "Opted-in" || item.dataset.label === "Not opted-in";
            },
            callbacks: {
              label: function(ctx) {
                if (ctx.dataset.yAxisID === "y2") {
                  var amt = cumAmounts[ctx.dataIndex];
                  return " Cumulative: " + ctx.parsed.y.toFixed(1) + "% (" + fmtCurrency(amt) + ")";
                }
                var entry = top[ctx.dataIndex];
                var deals = entry ? entry.deals : 0;
                var names = entry ? entry.names : [];
                var lines = [" Total: " + fmtCurrency(entry ? entry.value : 0), " WS deals: " + deals];
                if (names.length > 1) {
                  lines.push(" ─ Names:");
                  names.forEach(function(n){ lines.push("   · " + n); });
                }
                return lines;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: {
              maxRotation: 45,
              font: { size: 10 },
              callback: function(val, i) {
                var lbl = top[i] ? top[i].label : "";
                return lbl.length > 20 ? lbl.slice(0, 18) + "…" : lbl;
              }
            }
          },
          y: {
            stacked: true,
            position: "left",
            ticks: {
              font: { size: 10 },
              callback: function(v) { return "$" + (v >= 1e6 ? (v/1e6).toFixed(1)+"M" : v >= 1e3 ? (v/1e3).toFixed(0)+"K" : v); }
            }
          },
          y2: {
            position: "right",
            min: 0,
            max: 100,
            title: { display: true, text: "Cumulative %", font: { size: 11 } },
            ticks: { font: { size: 10 }, callback: function(v){ return v + "%"; } },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });

    // Restore legend hidden state
    var _fs = window.APP_FILTER_STATE && window.APP_FILTER_STATE.testing;
    if (_fs && mode === "eligible") {
      if (_fs.optedInHidden || _fs.notOptedInHidden) {
        _paretoChart.data.datasets.forEach(function(ds, i) {
          if (_fs.optedInHidden    && ds._group === "optedin")  _paretoChart.getDatasetMeta(i).hidden = true;
          if (_fs.notOptedInHidden && ds._group === "notopted") _paretoChart.getDatasetMeta(i).hidden = true;
        });
        _paretoChart.update();
        updateDeepLink(_fs.optedInHidden, _fs.notOptedInHidden);
      }
    }
  }

  // ── Stage slider ───────────────────────────────────────────────────────────
  var _csLastMoved = {};

  function updateStageSliderDisplay() {
    var fromEl  = document.getElementById("pareto-cs-from");
    var toEl    = document.getElementById("pareto-cs-to");
    var fillEl  = document.getElementById("pareto-cs-fill");
    var fromLbl = document.getElementById("pareto-cs-from-lbl");
    var toLbl   = document.getElementById("pareto-cs-to-lbl");
    if (!fromEl || !toEl) return;
    var fromVal = parseInt(fromEl.value), toVal = parseInt(toEl.value);
    var min = parseInt(fromEl.min), max = parseInt(fromEl.max);
    if (fillEl && max > min) {
      fillEl.style.left  = ((fromVal - min) / (max - min) * 100) + "%";
      fillEl.style.right = ((max - toVal)   / (max - min) * 100) + "%";
    }
    if (fromVal === toVal) {
      var last = _csLastMoved["pareto-cs"] || "from";
      fromEl.style.zIndex = (last === "from") ? "5" : "";
      toEl.style.zIndex   = (last === "to")   ? "5" : "";
    } else {
      fromEl.style.zIndex = "";
      toEl.style.zIndex   = "";
    }
    if (fromLbl) fromLbl.innerHTML = stageBadgeHtml(STAGE_ORDER[fromVal] || "");
    if (toLbl)   toLbl.innerHTML   = stageBadgeHtml(STAGE_ORDER[toVal]   || "");
  }

  ["pareto-cs-from", "pareto-cs-to"].forEach(function(csId) {
    var csEl = document.getElementById(csId);
    if (!csEl) return;
    csEl.addEventListener("input", function() {
      var side = csId === "pareto-cs-from" ? "from" : "to";
      _csLastMoved["pareto-cs"] = side;
      var fromEl = document.getElementById("pareto-cs-from");
      var toEl   = document.getElementById("pareto-cs-to");
      if (fromEl && toEl && parseInt(fromEl.value) > parseInt(toEl.value)) {
        if (csId === "pareto-cs-from") fromEl.value = toEl.value;
        else toEl.value = fromEl.value;
      }
      updateStageSliderDisplay();
      renderPareto();
    });
  });
  updateStageSliderDisplay();

  // ── Restore saved filter state ─────────────────────────────────────────────
  var _saved = window.APP_FILTER_STATE && window.APP_FILTER_STATE.testing;

  // Initial render
  renderPareto();

  // Restore slicer values after initial render (DOM now exists)
  if (_saved) {
    var pfSel = document.getElementById("pareto-portfolio");
    if (_saved.portfolio && pfSel) {
      pfSel.value = _saved.portfolio;
      var offerSel2 = document.getElementById("pareto-offer");
      offerSel2.innerHTML = '<option value="">All Offers</option>';
      var savedOffers = _saved.portfolio ? Array.from(offersByPortfolio[_saved.portfolio] || []).sort() : allOffers;
      savedOffers.forEach(function(o){ offerSel2.innerHTML += '<option value="' + escHtml(o) + '">' + escHtml(o) + '</option>'; });
    }
    if (_saved.offer)  document.getElementById("pareto-offer").value  = _saved.offer;
    if (_saved.topN)   document.getElementById("pareto-topn").value   = _saved.topN;
    if (_saved.mode)   document.getElementById("pareto-mode").value   = _saved.mode;
    if (_saved.csFrom !== undefined) { var _csf = document.getElementById("pareto-cs-from"); if (_csf) _csf.value = _saved.csFrom; }
    if (_saved.csTo   !== undefined) { var _cst = document.getElementById("pareto-cs-to");   if (_cst) _cst.value = _saved.csTo;   }
    if (_saved.portfolio || _saved.offer || _saved.topN || _saved.mode || _saved.csFrom !== undefined) {
      updateStageSliderDisplay();
      renderPareto();
    }
  }

  // Slicer events
  document.getElementById("pareto-mode").addEventListener("change", renderPareto);
  document.getElementById("pareto-portfolio").addEventListener("change", function() {
    var pf = this.value;
    var offerSel = document.getElementById("pareto-offer");
    offerSel.innerHTML = '<option value="">All Offers</option>';
    var offers = pf ? Array.from(offersByPortfolio[pf] || []).sort() : allOffers;
    offers.forEach(function(o){ offerSel.innerHTML += '<option value="' + escHtml(o) + '">' + escHtml(o) + '</option>'; });
    renderPareto();
  });
  document.getElementById("pareto-offer").addEventListener("change", renderPareto);
  document.getElementById("pareto-topn").addEventListener("change", renderPareto);
}

window.renderTesting = renderTesting;
