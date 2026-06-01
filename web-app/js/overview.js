// =============================================================================
// overview.js — Overview tab renderer
// =============================================================================

function renderOverview(data) {
  var el = document.getElementById("tab-overview");
  if (!el) return;

  // ── Helpers
  function norm(x) {
    if (x === null || x === undefined) return "";
    return String(x).replace(/\u00A0/g, " ").trim().toUpperCase();
  }
  function fmtCurrency(v) {
    if (v === null || v === undefined || isNaN(v)) return "-";
    return "$" + Math.round(v).toLocaleString();
  }
  function fmtCount(v) { return v || "-"; }
  function escHtml(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function toDate(x) {
    if (!x) return null;
    if (x instanceof Date) return isNaN(x.getTime()) ? null : x;
    if (typeof x === "number" && x > 1000) {
      var d = new Date(Math.round((x - 25569) * 86400 * 1000));
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof x === "string" && x.trim()) {
      var d2 = new Date(x);
      return isNaN(d2.getTime()) ? null : d2;
    }
    return null;
  }
  function fmtDateInput(d) {
    if (!d) return "";
    var dd = toDate(d);
    if (!dd) return "";
    return dd.toISOString().slice(0, 10);
  }

  // ── Unique values helpers
  function uniqueVals(field) {
    var s = new Set();
    data.forEach(function (r) { if (r[field]) s.add(String(r[field])); });
    return Array.from(s).sort();
  }
  function uniqueValsWhere(field, filterField, filterVal) {
    var s = new Set();
    data.forEach(function (r) {
      if (filterVal && String(r[filterField] || "") !== filterVal) return;
      if (r[field]) s.add(String(r[field]));
    });
    return Array.from(s).sort();
  }
  function dateRangeFor(field) {
    var min = null, max = null;
    data.forEach(function (r) {
      var d = toDate(r[field]);
      if (!d) return;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    });
    return { min: min, max: max };
  }

  var portfolios = uniqueVals("Deal CPI Portfolio");

  var partnerNames = uniqueVals("Partner Name");
  var beGeoIds     = uniqueVals("BE GEO ID");
  var partnerLabel = partnerNames.length === 1 ? partnerNames[0]
                   : partnerNames.length  >  1 ? partnerNames.slice(0, 3).join(", ") + (partnerNames.length > 3 ? " +" + (partnerNames.length - 3) + " more" : "")
                   : "—";
  var beGeoLabel   = beGeoIds.length === 1 ? beGeoIds[0]
                   : beGeoIds.length  >  1 ? beGeoIds.slice(0, 4).join(", ") + (beGeoIds.length > 4 ? " +" + (beGeoIds.length - 4) + " more" : "")
                   : "—";

  // ── Build HTML ─────────────────────────────────────────────────────────────
  var html = "";

  // File metadata
  var fileDateLabel = "";
  var fileDateCaption = "File Date";
  if (window.APP_FILE_META && window.APP_FILE_META.cachedAt) {
    fileDateLabel = window.APP_FILE_META.cachedAt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    fileDateCaption = "Cached";
  } else if (window.APP_FILE_META && window.APP_FILE_META.lastModified) {
    fileDateLabel = window.APP_FILE_META.lastModified.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    fileDateCaption = "File Date";
  }
  var fileName  = (window.APP_FILE_META && window.APP_FILE_META.name)  ? window.APP_FILE_META.name  : "";
  var rowsLabel = (window.APP_DATA) ? window.APP_DATA.length.toLocaleString() + " rows" : "";

  // Partner / BE GEO / file date / file info header — all in one bar
  html += '<div class="d-flex flex-wrap gap-4 align-items-center mb-3 px-1 py-2 border-bottom">';
  html += '<div><span class="text-muted small">Partner</span><br/><strong class="fs-6">' + escHtml(partnerLabel) + '</strong></div>';
  html += '<div><span class="text-muted small">BE GEO ID</span><br/><strong class="fs-6">' + escHtml(beGeoLabel) + '</strong></div>';
  if (fileDateLabel) {
    html += '<div><span class="text-muted small">' + fileDateCaption + '</span><br/><strong class="fs-6">' + escHtml(fileDateLabel) + '</strong></div>';
  }
  html += '</div>';

  html += '<div id="ovw-table-area"></div>';
  html += '<p class="text-muted small fst-italic mt-2" style="font-size:0.78rem">' +
    '<i class="bi bi-info-circle me-1"></i>' +
    'Values in columns Total UC Eligible through Missed Incentives (progressed) cannot be summed because earning is available to one use case per offer per customer.' +
    '</p>';

  el.innerHTML = html;

  renderTable();

  function getFiltered() { return data; }

  function renderTable() {
    var fd = getFiltered();

    // ── Build grouped structure: Portfolio → Offer → UC → Type
    var groups = {};
    fd.forEach(function (r) {
      var domain = r["Deal CPI Portfolio"] || "(No Portfolio)";
      var offer  = r["Track"]              || "(No Offer)";
      var uc     = r["Sub-Track"]          || "(No UC)";
      var type   = r["Incentive Level"]    || "";
      if (!groups[domain]) groups[domain] = {};
      if (!groups[domain][offer]) groups[domain][offer] = {};
      if (!groups[domain][offer][uc]) groups[domain][offer][uc] = {};
      if (!groups[domain][offer][uc][type]) groups[domain][offer][uc][type] = [];
      groups[domain][offer][uc][type].push(r);
    });

    // ── Column calculators
    function calcRow(rows) {
      function forUC(ucRows) {
        var colE_ids = new Set();
        ucRows.forEach(function (r) {
          if (!r["Offer opted-in?"] && norm(r["Stage"]) === "ELIGIBLE") colE_ids.add(r["CR Party ID"]);
        });
        var colE = colE_ids.size;

        var colF = dedupeSum(ucRows.filter(function (r) { return !r["Offer opted-in?"] && norm(r["Stage"]) === "ELIGIBLE"; }), "Potential Incentives");

        var colG_ids = new Set();
        ucRows.forEach(function (r) { if (r["UC 25-50% eligible w/o opt-in"]) colG_ids.add(r["CR Party ID"]); });
        var colG = colG_ids.size;

        var colH = dedupeSum(ucRows.filter(function (r) { return r["UC 25-50% eligible w/o opt-in"]; }), "Potential Incentives");

        var colI_ids = new Set();
        ucRows.forEach(function (r) { if (r["UC 75% eligible w/o opt-in"]) colI_ids.add(r["CR Party ID"]); });
        var colI = colI_ids.size;

        var colJ = dedupeSum(ucRows.filter(function (r) { return r["UC 75% eligible w/o opt-in"]; }), "Missed Incentives");
        var colK = dedupeSum(ucRows.filter(function (r) { return r["UC 75% eligible w/o opt-in"]; }), "Potential Incentives");

        var colL_ids = new Set();
        ucRows.forEach(function (r) { if (r["UC progressed and missed w/o opt-in"]) colL_ids.add(r["CR Party ID"]); });
        var colL = colL_ids.size;

        var colM = dedupeSum(ucRows.filter(function (r) { return r["UC progressed and missed w/o opt-in"]; }), "Missed Incentives");

        var colN = ucRows.filter(function (r) { return norm(r["Adopt Rebate Opt-In Status"]) === "OPTED IN" && norm(r["Stage"]) === "ELIGIBLE"; }).length;

        var colO = 0;
        ucRows.forEach(function (r) {
          if (norm(r["Adopt Rebate Opt-In Status"]) === "OPTED IN" && norm(r["Stage"]) === "ELIGIBLE") colO += (r["Potential Incentives"] || 0);
        });

        var colP = ucRows.filter(function (r) { return r["Earned?"] === true; }).length;

        var colQ = 0;
        ucRows.forEach(function (r) { colQ += (r["Estimated Earned Incentives"] || 0); });

        return { E: colE, F: colF, G: colG, H: colH, I: colI, J: colJ, K: colK, L: colL, M: colM, N: colN, O: colO, P: colP, Q: colQ };
      }
      return forUC(rows);
    }

    function dedupeSum(rows, field) {
      var map = {};
      rows.forEach(function (r) {
        var key = r["CRPartyID-Offer"] || "";
        var v   = r[field] || 0;
        if (map[key] === undefined || v > map[key]) map[key] = v;
      });
      var total = 0;
      Object.keys(map).forEach(function (k) { total += map[k]; });
      return total;
    }

    // ── Build table HTML
    // Column groups: E-F | G-H | I-J-K | L-M | N-O-P-Q
    var cols       = ["E","F","G","H","I","J","K","L","M","N","O","P","Q"];
    var isCurrency = { F:1, H:1, J:1, K:1, M:1, O:1, Q:1 };

    // Group membership → CSS class for shading
    var colGroup = {
      E:"cg1", F:"cg1",
      G:"cg2", H:"cg2",
      I:"cg3", J:"cg3", K:"cg3",
      L:"cg4", M:"cg4",
      N:"cg5", O:"cg5", P:"cg5", Q:"cg5"
    };

    var colHeaders = [
      "Total UC Eligible<br>w/o opt-in","Total Potential<br>Incentives",
      "UC Eligible w/o opt-in<br><small class='text-success fw-normal'><i class='bi bi-check-circle-fill'></i> Onboard &nbsp;<i class='bi bi-check-circle-fill'></i> Use</small>",
      "Potential Incentives<br><small class='text-success fw-normal'><i class='bi bi-check-circle-fill'></i> Onboard &nbsp;<i class='bi bi-check-circle-fill'></i> Use</small>",
      "UC Eligible w/o opt-in<br><small class='fw-normal'><i class='bi bi-check-circle-fill'></i> Engage</small>",
      "Missed Incentives<br><small class='fw-normal'><i class='bi bi-check-circle-fill'></i> Engage</small>",
      "Potential Incentives<br><small class='fw-normal'><i class='bi bi-check-circle-fill'></i> Engage</small>",
      "UC progressed<br>and missed","Missed Incentives<br>(progressed)",
      "Active<br>Opted-in UC","Potential Incentives<br>(opted-in)",
      "Progressed<br>opted-in UC","Est. Earned<br>Incentives"
    ];

    // Group header row
    var groupDefs = [
      { label: "Not opted-in · Eligible",    span: 2, cls: "cg1" },
      { label: "Not opted-in · 25–50%",      span: 2, cls: "cg2" },
      { label: "Not opted-in · 75%",         span: 3, cls: "cg3" },
      { label: "Not opted-in · Progressed",  span: 2, cls: "cg4" },
      { label: "Opted-in",                   span: 4, cls: "cg5" }
    ];
    var groupRow = '<tr><th class="border-end" style="min-width:240px"></th>';
    groupDefs.forEach(function (g) {
      groupRow += '<th colspan="' + g.span + '" class="text-center small fw-semibold ' + g.cls + '-hdr">' + g.label + '</th>';
    });
    groupRow += '</tr>';

    var colHeaderRow = '<tr><th style="min-width:240px">Portfolio / Offer / Use Case</th>';
    cols.forEach(function (c, i) {
      colHeaderRow += '<th class="text-end ' + colGroup[c] + '-hdr" style="min-width:90px">' + colHeaders[i] + '</th>';
    });
    colHeaderRow += '</tr>';

    var thead = '<thead>' + colHeaderRow + '</thead>';

    // Helper: render a data cell with group shading
    function td(c, v) {
      return '<td class="text-end ' + colGroup[c] + '-cell">' + (isCurrency[c] ? fmtCurrency(v) : fmtCount(v)) + '</td>';
    }

    // Build type badge HTML from the type keys present for a UC
    function typeTags(typeKeys) {
      return typeKeys.filter(function (tp) { return !!tp; }).map(function (tp) {
        var n = tp.trim().toUpperCase();
        var cls = n === "ADVANCED" ? "badge-type-advanced" : "badge-type-standard";
        return '<span class="badge-type ' + cls + '">' + escHtml(tp) + '</span>';
      }).join(" ");
    }

    var tbody = "<tbody>";
    var portfolioOrder = ["Networking", "Security", "Cloud", "Cloud + AI Infrastructure", "Collaboration"];
    var domainKeys = Object.keys(groups).sort(function (a, b) {
      var ai = portfolioOrder.indexOf(a), bi = portfolioOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    var pIdx = 0;
    domainKeys.forEach(function (domain) {
      var pKey = "p" + pIdx;
      tbody += '<tr class="ovw-domain-row" data-portfolio="' + pKey + '">' +
        '<td colspan="14"><span class="ovw-chevron">&#9660;</span>' + escHtml(domain) + '</td></tr>';

      var offerKeys = Object.keys(groups[domain]).sort();
      var oIdx = 0;
      offerKeys.forEach(function (offer) {
        var oKey = pKey + "o" + oIdx;
        tbody += '<tr class="ovw-offer-row" data-portfolio="' + pKey + '" data-offer="' + oKey + '">' +
          '<td colspan="' + (cols.length + 1) + '" style="padding-left:1.2rem"><span class="ovw-chevron">&#9660;</span>' + escHtml(offer) + '</td></tr>';

        var ucKeys = Object.keys(groups[domain][offer]).sort();
        ucKeys.forEach(function (uc) {
          var ucAllRows = [];
          var typeKeys  = Object.keys(groups[domain][offer][uc]).sort();
          typeKeys.forEach(function (tp) {
            groups[domain][offer][uc][tp].forEach(function (r) { ucAllRows.push(r); });
          });
          var ucCalc = calcRow(ucAllRows);
          tbody += '<tr class="ovw-uc-row" data-portfolio="' + pKey + '" data-offer="' + oKey + '"><td style="padding-left:2rem">' +
            escHtml(uc) + '&nbsp;' + typeTags(typeKeys) + '</td>';
          cols.forEach(function (c) { tbody += td(c, ucCalc[c]); });
          tbody += "</tr>";
        });
        oIdx++;
      });
      pIdx++;
    });
    tbody += "</tbody>";

    var tableHtml = '<div class="table-wrapper"><table class="table table-bordered table-hover mb-0">' + thead + tbody + "</table></div>";
    document.getElementById("ovw-table-area").innerHTML = tableHtml;

    // ── Collapse / expand on portfolio and offer row clicks
    var collapseState = {};
    var tableEl = document.querySelector("#ovw-table-area table");
    if (tableEl) {
      tableEl.addEventListener("click", function (e) {
        var tr = e.target.closest("tr");
        if (!tr) return;

        if (tr.classList.contains("ovw-domain-row")) {
          var pKey = tr.dataset.portfolio;
          var nowCollapsed = !collapseState["p:" + pKey];
          collapseState["p:" + pKey] = nowCollapsed;

          tableEl.querySelectorAll('.ovw-offer-row[data-portfolio="' + pKey + '"], .ovw-uc-row[data-portfolio="' + pKey + '"]').forEach(function (row) {
            if (nowCollapsed) {
              row.style.display = "none";
            } else {
              // When expanding portfolio, keep UC rows hidden if their offer is still collapsed
              if (row.classList.contains("ovw-uc-row") && collapseState["o:" + row.dataset.offer]) {
                row.style.display = "none";
              } else {
                row.style.display = "";
              }
            }
          });

          var chevron = tr.querySelector(".ovw-chevron");
          if (chevron) chevron.style.transform = nowCollapsed ? "rotate(-90deg)" : "";

        } else if (tr.classList.contains("ovw-offer-row")) {
          var oKey = tr.dataset.offer;
          var nowCollapsed = !collapseState["o:" + oKey];
          collapseState["o:" + oKey] = nowCollapsed;

          tableEl.querySelectorAll('.ovw-uc-row[data-offer="' + oKey + '"]').forEach(function (row) {
            row.style.display = nowCollapsed ? "none" : "";
          });

          var chevron = tr.querySelector(".ovw-chevron");
          if (chevron) chevron.style.transform = nowCollapsed ? "rotate(-90deg)" : "";
        }
      });
    }
  }

  function makeSelect(id, label, options) {
    var h = '<div class="d-flex flex-column"><label for="' + id + '" class="small">' + label + '</label>';
    h += '<select id="' + id + '" class="form-select form-select-sm"><option value="">All</option>';
    options.forEach(function (o) { h += '<option value="' + escHtml(o) + '">' + escHtml(o) + '</option>'; });
    h += "</select></div>";
    return h;
  }

  function makeDateRange(prefix, label, minVal, maxVal) {
    return '<div class="d-flex flex-column">' +
      '<label class="small text-center mb-1">' + label + '</label>' +
      '<div class="d-flex align-items-center gap-1">' +
      '<input type="date" id="' + prefix + '-from" class="form-control form-control-sm" value="' + minVal + '" style="width:135px"/>' +
      '<span class="text-muted small">–</span>' +
      '<input type="date" id="' + prefix + '-to"   class="form-control form-control-sm" value="' + maxVal + '" style="width:135px"/>' +
      '</div>' +
      '</div>';
  }
}

window.renderOverview = renderOverview;
