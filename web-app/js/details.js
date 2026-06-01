// =============================================================================
// details.js — Details tab renderer
// =============================================================================

function renderDetails(data) {
  var el = document.getElementById("tab-details");
  if (!el) return;

  function norm(x) {
    if (x === null || x === undefined) return "";
    return String(x).replace(/\u00A0/g, " ").trim().toUpperCase();
  }

  function escHtml(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function fmtCurrency(v) {
    if (v === null || v === undefined || isNaN(v) || v === 0) return "-";
    return "$" + Math.round(v).toLocaleString();
  }

  function fmtDate(v) {
    if (!v) return "";
    var d = (v instanceof Date) ? v : (typeof v === "number" ? new Date(Math.round((v-25569)*86400*1000)) : new Date(v));
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString("en-GB");
  }

  function toDate(x) {
    if (!x) return null;
    if (x instanceof Date) return isNaN(x.getTime()) ? null : x;
    if (typeof x === "number" && x > 1000) { var d=new Date(Math.round((x-25569)*86400*1000)); return isNaN(d.getTime())?null:d; }
    if (typeof x === "string") { var d2=new Date(x); return isNaN(d2.getTime())?null:d2; }
    return null;
  }

  function epochDay(d) { return Math.floor(d.getTime() / 86400000); }

  // ── Active filters state
  var filters = {
    stage: [],
    optIn: [],
    portfolio: "",
    offer: "",
    expires: [],
    ea: [],
    risk: [],
    newEligible: false,
    expiresSoon: false,
    bkFrom: "", bkTo: "",
    rsFrom: "", rsTo: "",
    expFrom: "", expTo: ""
  };

  var PAGE_SIZE = 50;
  var currentPage = 1;
  var filteredData = [];
  var sortField = "CR Party Name";
  var sortDir   = "asc";

  // ── Summary dedup measures
  function calcSummary(rows) {
    var customers = new Set();
    var offersMap = new Set();
    var ucMap     = new Set();
    rows.forEach(function (r) {
      customers.add(r["CR Party ID"]);
      offersMap.add(r["CRPartyID-Offer"]);
      ucMap.add(String(r["CR Party ID"] || "") + "|" + String(r["Track"] || "") + "|" + String(r["Sub-Track"] || ""));
    });

    function dedupeMax(field) {
      var map = {};
      rows.forEach(function (r) {
        var k = r["CRPartyID-Offer"] || "";
        var v = r[field] || 0;
        if (map[k] === undefined || v > map[k]) map[k] = v;
      });
      var total = 0;
      Object.keys(map).forEach(function (k) { total += map[k]; });
      return total;
    }

    return {
      customers: customers.size,
      useCases:  ucMap.size,
      missed:    dedupeMax("Missed Incentives"),
      potential: dedupeMax("Potential Incentives"),
      earned:    dedupeMax("Estimated Earned Incentives")
    };
  }

  // ── Unique filter values
  function uniqueVals(field) {
    var s = new Set();
    data.forEach(function (r) { if (r[field] !== null && r[field] !== undefined && r[field] !== "") s.add(String(r[field])); });
    return Array.from(s).sort();
  }

  var portfolioOrder = ["Networking", "Security", "Cloud", "Cloud + AI Infrastructure", "Collaboration"];
  var stages     = uniqueVals("Stage");
  var optIns     = uniqueVals("Adopt Rebate Opt-In Status");
  var portfolios = uniqueVals("Deal CPI Portfolio").sort(function (a, b) {
    var ai = portfolioOrder.indexOf(a), bi = portfolioOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  var offerList  = uniqueVals("Track");
  var eaOpts     = uniqueVals("EA Flag");
  var riskOpts   = ["High","Medium","Low"];

  // Precompute date bounds for sliders
  function getDateBounds(field) {
    var mn = null, mx = null;
    data.forEach(function(r) { var d = toDate(r[field]); if (d) { if (!mn||d<mn) mn=d; if (!mx||d>mx) mx=d; } });
    return { min: mn, max: mx };
  }
  var dateBounds = {
    bk:  getDateBounds("Booking Date"),
    rs:  getDateBounds("Adopt Rebate Start Date"),
    exp: getDateBounds("Deal Incentive Expiry Date")
  };

  // ── Build initial HTML
  var html = '<div class="d-flex gap-3">';

  // Sidebar filters
  html += '<div class="filter-sidebar flex-shrink-0">';
  html += '<div class="fw-bold mb-2" style="font-size:0.8rem;color:var(--cisco-dark)"><i class="bi bi-funnel me-1"></i>Filters</div>';
  html += '<div class="filter-group"><div class="position-relative"><input type="text" id="filter-crparty" class="form-control form-control-sm pe-4" placeholder="&#128269; CR Party Name..." /><button id="det-crparty-clear" type="button" class="btn btn-link p-0 position-absolute top-50 end-0 translate-middle-y me-2 d-none" style="font-size:0.8rem;color:#999;line-height:1" tabindex="-1"><i class="bi bi-x-lg"></i></button></div></div>';

  // Quick-toggle filters
  html += '<div class="filter-group">';
  html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" id="filter-new-eligible"><label class="form-check-label" for="filter-new-eligible">New Eligible</label></div>';
  html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" id="filter-expires-soon"><label class="form-check-label" for="filter-expires-soon">Expires Soon (&lt;3M)</label></div>';
  html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" id="filter-earned"><label class="form-check-label" for="filter-earned">Earned</label></div>';
  html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" id="filter-ea"><label class="form-check-label" for="filter-ea">EA</label></div>';
  html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" id="filter-pvi-eligible"><label class="form-check-label" for="filter-pvi-eligible">PVI Eligible</label></div>';
  html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" id="filter-pvi-onboard"><label class="form-check-label" for="filter-pvi-onboard">PVI Onboard</label></div>';
  html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" id="filter-pvi-adopt"><label class="form-check-label" for="filter-pvi-adopt">PVI Adopt</label></div>';
  html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" id="filter-uc2550"><label class="form-check-label" for="filter-uc2550">UC Eligible w/o opt-in <span><i class="bi bi-check-circle-fill"></i> Onboard <i class="bi bi-check-circle-fill"></i> Use</span></label></div>';
  html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" id="filter-uc75"><label class="form-check-label" for="filter-uc75">UC Eligible w/o opt-in <span><i class="bi bi-check-circle-fill"></i> Engage</span></label></div>';
  html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" id="filter-ucmissed"><label class="form-check-label" for="filter-ucmissed">UC progressed &amp; missed w/o opt-in</label></div>';
  html += '<div class="d-flex gap-2 align-items-center mt-1 mb-0" style="font-size:0.78rem"><span class="text-muted">Offer opted-in:</span>';
  html += '<div class="form-check form-check-sm mb-0"><input class="form-check-input" type="checkbox" id="filter-offer-optedin-y" value="Y"><label class="form-check-label" for="filter-offer-optedin-y">Y</label></div>';
  html += '<div class="form-check form-check-sm mb-0"><input class="form-check-input" type="checkbox" id="filter-offer-optedin-n" value="N"><label class="form-check-label" for="filter-offer-optedin-n">N</label></div>';
  html += '</div>';
  html += '</div>';

  html += makeCheckboxGroup("Stage",          "filter-stage",     stages);
  html += makeCheckboxGroup("Opt-In Status",  "filter-optin",     optIns);
  html += '<div class="filter-group"><label class="group-label">Portfolio</label>' + makeDropdown("filter-portfolio", portfolios) + '</div>';
  html += '<div class="filter-group"><label class="group-label">Offer</label>' + makeDropdown("filter-offer", offerList) + '</div>';

  // Date filters
  html += '<div class="filter-group"><label class="group-label">Booking Date</label>'      + makeDateSlider("det-bk",  dateBounds.bk)  + '</div>';
  html += '<div class="filter-group"><label class="group-label">Rebate Start Date</label>'  + makeDateSlider("det-rs",  dateBounds.rs)  + '</div>';
  html += '<div class="filter-group"><label class="group-label">Rebate Expiry Date</label>' + makeDateSlider("det-exp", dateBounds.exp) + '</div>';

  html += makeCheckboxGroup("Offer Risk Level", "filter-risk", riskOpts);

  html += '<button class="btn btn-sm btn-outline-secondary w-100 mt-2" id="det-clear-btn"><i class="bi bi-x-circle me-1"></i>Clear filters</button>';
  html += '</div>'; // /sidebar

  // Main content
  html += '<div class="flex-grow-1 min-width-0">';
  html += '<div class="d-flex gap-2 flex-wrap mb-3" id="det-summary"></div>';
  html += '<div id="det-table-area"></div>';
  html += '<div id="det-pagination" class="mt-2"></div>';
  html += '</div>';
  html += '</div>'; // /d-flex

  el.innerHTML = html;

  // ── Slider display updater(defined here so it's available to all wiring below)
  function updateSliderDisplay(prefix) {
    var fromEl  = document.getElementById(prefix + "-from");
    var toEl    = document.getElementById(prefix + "-to");
    var fillEl  = document.getElementById(prefix + "-fill");
    var fromLbl = document.getElementById(prefix + "-from-lbl");
    var toLbl   = document.getElementById(prefix + "-to-lbl");
    if (!fromEl || !toEl) return;
    var fromVal = parseInt(fromEl.value), toVal = parseInt(toEl.value);
    var min = parseInt(fromEl.min),       max  = parseInt(fromEl.max);
    if (fillEl && max > min) {
      fillEl.style.left  = ((fromVal - min) / (max - min) * 100) + "%";
      fillEl.style.right = ((max - toVal)   / (max - min) * 100) + "%";
    }
    if (fromLbl) fromLbl.textContent = new Date(fromVal * 86400000).toLocaleDateString("en-GB");
    if (toLbl)   toLbl.textContent   = new Date(toVal   * 86400000).toLocaleDateString("en-GB");
  }

  // Wire up filters
  el.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
    cb.addEventListener("change", function () { currentPage = 1; applyFiltersAndRender(); });
  });
  document.getElementById("filter-crparty").addEventListener("input", function () {
    document.getElementById("det-crparty-clear").classList.toggle("d-none", this.value === "");
    currentPage = 1; applyFiltersAndRender();
  });
  document.getElementById("det-crparty-clear").addEventListener("click", function () {
    var inp = document.getElementById("filter-crparty");
    inp.value = "";
    this.classList.add("d-none");
    inp.focus();
    currentPage = 1; applyFiltersAndRender();
  });
  document.getElementById("filter-portfolio").addEventListener("change", function () { currentPage = 1; applyFiltersAndRender(); });
  document.getElementById("filter-offer").addEventListener("change", function () { currentPage = 1; applyFiltersAndRender(); });
  ["filter-pvi-eligible","filter-pvi-onboard","filter-pvi-adopt","filter-uc2550","filter-uc75","filter-ucmissed"].forEach(function (id) {
    // now checkboxes — handled by the global checkbox listener above
  });
  ["det-bk","det-rs","det-exp"].forEach(function (prefix) {
    ["from","to"].forEach(function (side) {
      var el2 = document.getElementById(prefix + "-" + side);
      if (!el2) return;
      el2.addEventListener("input", function () {
        var fromEl = document.getElementById(prefix + "-from");
        var toEl   = document.getElementById(prefix + "-to");
        if (fromEl && toEl && parseInt(fromEl.value) > parseInt(toEl.value)) {
          if (side === "from") fromEl.value = toEl.value;
          else toEl.value = fromEl.value;
        }
        updateSliderDisplay(prefix);
        currentPage = 1;
        applyFiltersAndRender();
      });
    });
    updateSliderDisplay(prefix);
  });
  document.getElementById("det-clear-btn").addEventListener("click", function () {
    document.getElementById("filter-crparty").value = "";
    el.querySelectorAll('input[type=checkbox]').forEach(function (cb) { cb.checked = false; });
    document.getElementById("filter-portfolio").value = "";
    document.getElementById("filter-offer").value = "";
    ["det-bk","det-rs","det-exp"].forEach(function (prefix) {
      var fromEl = document.getElementById(prefix + "-from");
      var toEl   = document.getElementById(prefix + "-to");
      if (fromEl) fromEl.value = fromEl.min;
      if (toEl)   toEl.value   = toEl.max;
      updateSliderDisplay(prefix);
    });
    currentPage = 1;
    applyFiltersAndRender();
  });

  applyFiltersAndRender();

  function applyFiltersAndRender() {
    var crPartyVal       = document.getElementById("filter-crparty").value.trim().toLowerCase();
    var stageChecked     = getChecked("filter-stage");
    var optInChecked     = getChecked("filter-optin");
    var portfolioVal     = document.getElementById("filter-portfolio").value;
    var offerVal         = document.getElementById("filter-offer").value;
    var offerOptedIn     = document.getElementById("filter-offer-optedin-y") ? document.getElementById("filter-offer-optedin-y").checked : false;
    var offerNotOptedIn  = document.getElementById("filter-offer-optedin-n") ? document.getElementById("filter-offer-optedin-n").checked : false;
    var pviEligible      = document.getElementById("filter-pvi-eligible").checked;
    var pviOnboard       = document.getElementById("filter-pvi-onboard").checked;
    var pviAdopt         = document.getElementById("filter-pvi-adopt").checked;
    var uc2550           = document.getElementById("filter-uc2550").checked;
    var uc75             = document.getElementById("filter-uc75").checked;
    var ucMissed         = document.getElementById("filter-ucmissed").checked;
    var newEligible      = document.getElementById("filter-new-eligible").checked;
    var expiresSoon      = document.getElementById("filter-expires-soon").checked;
    var earnedChecked    = document.getElementById("filter-earned").checked;
    var eaChecked        = document.getElementById("filter-ea").checked;
    var riskChecked      = getChecked("filter-risk");
    var bkFrom  = document.getElementById("det-bk-from");
    var bkTo    = document.getElementById("det-bk-to");
    var rsFrom  = document.getElementById("det-rs-from");
    var rsTo    = document.getElementById("det-rs-to");
    var expFrom = document.getElementById("det-exp-from");
    var expTo   = document.getElementById("det-exp-to");
    function sliderVal(el) { return el ? new Date(parseInt(el.value) * 86400000) : null; }
    function atMin(el)     { return !el || parseInt(el.value) === parseInt(el.min); }
    function atMax(el)     { return !el || parseInt(el.value) === parseInt(el.max); }
    var bkFromDate  = atMin(bkFrom)  ? null : sliderVal(bkFrom);
    var bkToDate    = atMax(bkTo)    ? null : sliderVal(bkTo);
    var rsFromDate  = atMin(rsFrom)  ? null : sliderVal(rsFrom);
    var rsToDate    = atMax(rsTo)    ? null : sliderVal(rsTo);
    var expFromDate = atMin(expFrom) ? null : sliderVal(expFrom);
    var expToDate   = atMax(expTo)   ? null : sliderVal(expTo);

    filteredData = data.filter(function (r) {
      if (crPartyVal && String(r["CR Party Name"] || "").toLowerCase().indexOf(crPartyVal) === -1) return false;
      if (stageChecked.length  && stageChecked.indexOf(String(r["Stage"] || "")) === -1)                      return false;
      if (optInChecked.length  && optInChecked.indexOf(String(r["Adopt Rebate Opt-In Status"] || "")) === -1) return false;
      if (portfolioVal         && String(r["Deal CPI Portfolio"] || "") !== portfolioVal)                     return false;
      if (offerVal             && String(r["Track"] || "") !== offerVal)                                      return false;
      if (offerOptedIn && !offerNotOptedIn && r["Offer opted-in?"] !== true)  return false;
      if (offerNotOptedIn && !offerOptedIn && r["Offer opted-in?"] === true)   return false;
      if (pviEligible      && !r["PVI Eligible"])   return false;
      if (pviOnboard       && !r["PVI Onboard"])    return false;
      if (pviAdopt         && !r["PVI Adopt"])      return false;
      if (uc2550           && !r["UC 25-50% eligible w/o opt-in"])       return false;
      if (uc75             && !r["UC 75% eligible w/o opt-in"])          return false;
      if (ucMissed         && !r["UC progressed and missed w/o opt-in"]) return false;
      if (newEligible      && !r["New eligible"])                                                         return false;
      if (expiresSoon      && String(r["Expires <3M?"] || "") !== "Yes")                                  return false;
      if (earnedChecked    && r["Earned?"] !== true)                                                        return false;
      if (eaChecked        && String(r["EA Flag"] || "") !== "Yes")                                         return false;
      if (riskChecked.length && riskChecked.indexOf(String(r["Offer Risk Level"] || "")) === -1)          return false;

      if (bkFromDate || bkToDate) {
        var d = toDate(r["Booking Date"]);
        if (d) {
          if (bkFromDate && d < bkFromDate) return false;
          if (bkToDate   && d > bkToDate)   return false;
        }
      }
      if (rsFromDate || rsToDate) {
        var d2 = toDate(r["Adopt Rebate Start Date"]);
        if (d2) {
          if (rsFromDate && d2 < rsFromDate) return false;
          if (rsToDate   && d2 > rsToDate)   return false;
        }
      }
      if (expFromDate || expToDate) {
        var d3 = toDate(r["Deal Incentive Expiry Date"]);
        if (d3) {
          if (expFromDate && d3 < expFromDate) return false;
          if (expToDate   && d3 > expToDate)   return false;
        }
      }
      return true;
    });

    applySort();

    renderSummary(filteredData);
    renderTable();
  }

  function applySort() {
    var stageOrder = ["Purchase","Onboard","Implement","Use","Engage","Adopt","Completed"];
    var numericFields = { "Potential Incentives": true, "Missed Incentives": true, "Estimated Earned Incentives": true, "Days in stage": true };
    var dateFields    = { "Deal Incentive Expiry Date": true };
    filteredData.sort(function (a, b) {
      var av = a[sortField], bv = b[sortField];
      if (sortField === "Current stage") {
        var ai = stageOrder.indexOf(av || ""), bi = stageOrder.indexOf(bv || "");
        if (ai === -1) ai = stageOrder.length;
        if (bi === -1) bi = stageOrder.length;
        return sortDir === "asc" ? ai - bi : bi - ai;
      } else if (numericFields[sortField]) {
        av = av || 0; bv = bv || 0;
        return sortDir === "asc" ? av - bv : bv - av;
      } else if (dateFields[sortField]) {
        var ad = toDate(av), bd = toDate(bv);
        if (!ad && !bd) return 0;
        if (!ad) return sortDir === "asc" ? 1 : -1;
        if (!bd) return sortDir === "asc" ? -1 : 1;
        return sortDir === "asc" ? ad - bd : bd - ad;
      } else {
        av = String(av || "").toLowerCase(); bv = String(bv || "").toLowerCase();
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
    });
  }

  function renderSummary(rows) {
    var s = calcSummary(rows);
    var html = "";
    html += metricCard(s.customers,          "Customers");
    html += metricCard(s.useCases,           "Use Cases");
    html += metricCard("$" + Math.round(s.missed).toLocaleString(),    "Total Missed");
    html += metricCard("$" + Math.round(s.potential).toLocaleString(), "Total Potential");
    html += metricCard("$" + Math.round(s.earned).toLocaleString(),    "Total Estimated Earned");
    document.getElementById("det-summary").innerHTML = html;
  }

  function metricCard(value, label) {
    return '<div class="metric-card flex-fill"><div class="metric-value">' + value + '</div><div class="metric-label">' + label + '</div></div>';
  }

  function renderTable() {
    var today = new Date();
    var in90  = new Date(today.getTime() + 90 * 86400000);

    var start = (currentPage - 1) * PAGE_SIZE;
    var pageRows = filteredData.slice(start, start + PAGE_SIZE);
    var totalPages = Math.ceil(filteredData.length / PAGE_SIZE);

    var has2TPartner = data.some(function (r) { return r["2T Partner Name"] && String(r["2T Partner Name"]).trim() !== ""; });

    var cols = [
      ...(has2TPartner ? [{ label: "2T Partner Name", field: "2T Partner Name" }] : []),
      { label: "CR Party Name",              field: "CR Party Name",                style: "min-width:180px" },
      { label: "CR Party ID",                field: "CR Party ID" },
      { label: "CX Customer<br>BU ID",       field: "CX Customer BU ID",            style: "min-width:80px;max-width:90px" },
      { label: "Offer",                      field: "Track",                        style: "min-width:130px" },
      { label: "Use Case",                   field: "Sub-Track" },
      { label: "Current Stage",              field: "Current stage" },
      { label: "Days in Stage",              field: "Days in stage" },
      { label: "Stage Progress",             field: "Current Stage Progress" },
      { label: "Pending Tasks",              field: "Current stage pending tasks",  style: "max-width:80px" },
      { label: "Deal WS-ID",                 field: "Deal WS-ID",                   style: "min-width:140px", isWsId: true },
      { label: "Deal ID",                    field: "Deal ID" },
      { label: "Expiry Date",                field: "Deal Incentive Expiry Date",    isDate: true },
      { label: "Missed Incentives",          field: "Missed Incentives",             isCurrency: true },
      { label: "Potential Incentives",       field: "Potential Incentives",          isCurrency: true },
      { label: "Estimated<br>Earned Incentives", field: "Estimated Earned Incentives", isCurrency: true, style: "min-width:90px;max-width:110px" },
      { label: "Status",                     field: "_status",                       isStatus: true }
    ];

    var sortableCols = {
      "CR Party Name": true,
      "Potential Incentives": true,
      "Missed Incentives": true,
      "Estimated Earned Incentives": true,
      "Deal Incentive Expiry Date": true,
      "Days in stage": true,
      "Current stage": true
    };
    var thead = "<thead><tr>" + cols.map(function (c) {
      var styleAttr = c.style ? 'style="' + c.style + (sortableCols[c.field] ? ";cursor:pointer;user-select:none" : "") + '"' : '';
      if (sortableCols[c.field]) {
        var icon = sortField === c.field ? (sortDir === "asc" ? " ▲" : " ▼") : " ⇅";
        if (!styleAttr) styleAttr = 'style="cursor:pointer;user-select:none"';
        return '<th ' + styleAttr + ' data-sortfield="' + c.field + '">' + c.label + '<span style="font-size:0.7rem;opacity:0.7">' + icon + '</span></th>';
      }
      return '<th' + (styleAttr ? ' ' + styleAttr : '') + '>' + c.label + '</th>';
    }).join("") + "</tr></thead>";

    var stageRisk= { Purchase:"risk-high", Onboard:"risk-high", Implement:"risk-medium", Use:"risk-medium", Engage:"risk-low", Adopt:"risk-low", Completed:"risk-low" };

    var tbody = "<tbody>";
    if (pageRows.length === 0) {
      tbody += '<tr><td colspan="' + cols.length + '" class="text-center text-muted py-4">No data matching current filters.</td></tr>';
    } else {
      pageRows.forEach(function (r) {
        var riskClass = stageRisk[r["Current stage"]] || "";
        tbody += '<tr class="' + riskClass + '">';
        cols.forEach(function (c) {
          var val = r[c.field];
          var cell = "";
          if (c.isCurrency) {
            cell = fmtCurrency(val);
          } else if (c.isDate) {
            cell = '<td>' + fmtDate(val) + '</td>';
            tbody += cell;
            return;
          } else if (c.field === "CR Party Name") {
            var isOptedIn2 = norm(r["Adopt Rebate Opt-In Status"]) === "OPTED IN";
            var st2 = norm(r["Stage"]);
            if (isOptedIn2 && (st2 === "ELIGIBLE" || st2 === "EXPIRED")) {
              var crNameEsc = escHtml(String(r["CR Party Name"] || ""));
              cell = '<a href="javascript:void(0)" data-crname="' + crNameEsc + '" style="color:var(--cisco-blue);cursor:pointer" onclick="if(window.navigateToCustomer)window.navigateToCustomer(this.dataset.crname)">' + escHtml(val) + '</a>';
            } else {
              cell = escHtml(val);
            }
          } else if (c.isWsId) {
            var wsid = val ? String(val) : "";
            cell = wsid ? '<a href="https://app.workspan.com/wsid/' + escHtml(wsid) + '" target="_blank" rel="noopener">' + escHtml(wsid) + '</a>' : '';
          } else if (c.isStatus) {
            var icons = [];
            if (norm(r["Adopt Rebate Opt-In Status"]) === "OPTED IN")
              icons.push('<i class="bi bi-hand-thumbs-up-fill" style="color:#0070d2" title="Opted In"></i>');
            var stg2 = norm(r["Stage"]);
            if (r["Earned?"] === true)
              icons.push('<i class="bi bi-currency-dollar fw-bold" style="color:#000" title="Earned"></i>');
            if      (stg2 === "ELIGIBLE") icons.push('<i class="bi bi-check-circle-fill" style="color:#107C10" title="Eligible"></i>');
            else if (stg2 === "EXPIRED")  icons.push('<i class="bi bi-clock" style="color:#888" title="Expired"></i>');
            else if (r["Earned?"] !== true) icons.push('<i class="bi bi-x-circle-fill" style="color:#D13438" title="Not Eligible"></i>');
            cell = '<span style="white-space:nowrap">' + icons.join(" ") + '</span>';
          } else if (c.field === "Current stage") {
            cell = '<span class="stage-badge stage-' + escHtml(val) + '">' + escHtml(val) + '</span>';
          } else if (c.field === "Days in stage") {
            cell = val !== null && val !== undefined ? val : "-";
          } else if (c.field === "Current Stage Progress") {
            var parts = val ? String(val).split("/") : [];
            var x = parseInt(parts[0]), y = parseInt(parts[1]);
            if (!isNaN(x) && !isNaN(y) && y > 0) {
              var pct = Math.round((x / y) * 100);
              cell = '<div style="min-width:80px">' +
                '<div class="progress" style="height:8px;margin-bottom:2px">' +
                '<div class="progress-bar" style="width:' + pct + '%;background:var(--cisco-blue)"></div>' +
                '</div>' +
                '<span style="font-size:0.75rem">' + x + '/' + y + '</span>' +
                '</div>';
            } else {
              cell = "";
            }
          } else {
            cell = escHtml(val);
          }
          tbody += '<td>' + cell + '</td>';
        });
        tbody += "</tr>";
      });
    }
    tbody += "</tbody>";

    var tableHtml = '<div class="table-wrapper"><table class="table table-sm table-bordered mb-0">' + thead + tbody + '</table></div>';
    document.getElementById("det-table-area").innerHTML = tableHtml;

    // Sort on header click
    document.getElementById("det-table-area").querySelectorAll("th[data-sortfield]").forEach(function (th) {
      th.addEventListener("click", function () {
        var field = th.dataset.sortfield;
        if (sortField === field) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortField = field;
          var descByDefault = { "Potential Incentives": true, "Missed Incentives": true, "Estimated Earned Incentives": true };
          sortDir = descByDefault[field] ? "desc" : "asc";
        }
        currentPage = 1;
        applySort();
        renderTable();
      });
    });

    // Pagination
    var pgHtml = '<nav><ul class="pagination pagination-sm mb-0">';
    pgHtml += '<li class="page-item' + (currentPage===1?" disabled":"") + '"><a class="page-link" href="#" data-page="' + (currentPage-1) + '">‹</a></li>';
    var startP = Math.max(1, currentPage - 2);
    var endP   = Math.min(totalPages, currentPage + 2);
    for (var p = startP; p <= endP; p++) {
      pgHtml += '<li class="page-item' + (p===currentPage?" active":"") + '"><a class="page-link" href="#" data-page="' + p + '">' + p + '</a></li>';
    }
    pgHtml += '<li class="page-item' + (currentPage===totalPages||totalPages===0?" disabled":"") + '"><a class="page-link" href="#" data-page="' + (currentPage+1) + '">›</a></li>';
    pgHtml += '</ul></nav>';
    pgHtml += '<small class="text-muted ms-2">' + filteredData.length + ' rows</small>';
    document.getElementById("det-pagination").innerHTML = pgHtml;

    document.getElementById("det-pagination").querySelectorAll("a.page-link").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var p = parseInt(a.dataset.page);
        if (p >= 1 && p <= totalPages) { currentPage = p; renderTable(); }
      });
    });
  }

  function getChecked(groupId) {
    var result = [];
    var container = document.getElementById(groupId);
    if (!container) return result;
    container.querySelectorAll('input[type=checkbox]:checked').forEach(function (cb) { result.push(cb.value); });
    return result;
  }

  function makeCheckboxGroup(label, id, options) {
    var html = '<div class="filter-group"><label class="group-label">' + label + '</label><div id="' + id + '">';
    options.forEach(function (o) {
      html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" value="' + escHtml(o) + '" id="' + id + '-' + escHtml(o).replace(/\s+/g,"-") + '">' +
              '<label class="form-check-label" for="' + id + '-' + escHtml(o).replace(/\s+/g,"-") + '">' + escHtml(o) + '</label></div>';
    });
    html += "</div></div>";
    return html;
  }

  function makeDropdown(id, options) {
    var html = '<select id="' + id + '" class="form-select form-select-sm"><option value="">All</option>';
    options.forEach(function (o) { html += '<option value="' + escHtml(o) + '">' + escHtml(o) + '</option>'; });
    return html + "</select>";
  }

  function makeDateSlider(prefix, bounds) {
    if (!bounds || !bounds.min || !bounds.max) {
      return '<div class="text-muted small fst-italic">No date data</div>';
    }
    var minDay = epochDay(bounds.min), maxDay = epochDay(bounds.max);
    return '<div class="date-slider-group">' +
      '<div class="slider-val-display">' +
      '<span id="' + prefix + '-from-lbl">' + bounds.min.toLocaleDateString("en-GB") + '</span>' +
      '<span id="' + prefix + '-to-lbl">'   + bounds.max.toLocaleDateString("en-GB") + '</span>' +
      '</div>' +
      '<div class="dual-range-wrap">' +
      '<div class="dual-range-track"></div>' +
      '<div class="dual-range-fill" id="' + prefix + '-fill"></div>' +
      '<input type="range" class="range-from" id="' + prefix + '-from" min="' + minDay + '" max="' + maxDay + '" value="' + minDay + '" step="1">' +
      '<input type="range" class="range-to"   id="' + prefix + '-to"   min="' + minDay + '" max="' + maxDay + '" value="' + maxDay + '" step="1">' +
      '</div></div>';
  }
}

window.renderDetails = renderDetails;
