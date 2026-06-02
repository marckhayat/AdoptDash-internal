// =============================================================================
// customer.js — Customer tab renderer
// =============================================================================

var UC_GUIDE_MAP = {
  "Campus Network Automation": "https://salesresources.cisco.com/Link/Content/DCVDV84mh3TJQ8QDPD3b8W2DTcW3",
  "Campus Network Observability and Insights": "https://salesresources.cisco.com/Link/Content/DC9H9RVF89BMXGF2dXb2BFQFM7T8",
  "Campus Network Programmability and Integrations": "https://salesresources.cisco.com/Link/Content/DCc8W63BVHF4W87WV3Pf8PVcFq8P",
  "Campus Network Segmentation": "https://salesresources.cisco.com/Link/Content/DCmXHjbd8qqG284Jc2h7fhqCjXhG",
  "Campus Network Visibility": "https://salesresources.cisco.com/Link/Content/DC7RTb387qGWh8qWmHhfR494d48j",
  "Cloud Monitoring for Catalyst": "https://salesresources.cisco.com/Link/Content/DCc6fbbGg4Dhh872BFDXbjP9T3c8",
  "Internet and Cloud Visibility": "https://salesresources.cisco.com/Link/Content/DCqqQQh9MFjC7GhB4f27p3Q29Mp8",
  "Location Based Intelligence": "https://salesresources.cisco.com/Link/Content/DCXqmHdjGfcB38CCfXbBcTWMXTQV",
  "Foundational Networking and Security for Meraki": "https://salesresources.cisco.com/Link/Content/DCq946RP494fQGhMMj8Tj7DFhMFB",
  "Programmability and Integrations for Meraki": "https://salesresources.cisco.com/Link/Content/DCJFWjc8VhHmdGc27fQgm7VG8dJ8",
  "Multicloud Connectivity": "https://salesresources.cisco.com/Link/Content/DC6b33dB8DFQ7GFD884m9JCFVHRd",
  "SD-Routing": "https://salesresources.cisco.com/Link/Content/DCXpXdRBQW63287WQf7pVJm4fqFd",
  "Secure Automated WAN": "https://salesresources.cisco.com/Link/Content/DCT9mHbWqbjVq89JRmXWmcRjdF6d",
  "Network Security Analytics": "https://salesresources.cisco.com/Link/Content/DC3h72hWC28BDG2MFXj9FQWdFgd8",
  "Secure Application Access With Phishing-Resistant MFA": "https://salesresources.cisco.com/Link/Content/DChWJPjDhBHCG8cQQT4dJhGDGqXB",
  "DNS Security": "https://salesresources.cisco.com/Link/Content/DCTmhf2TBqq4WG7Xh7TVbHDTFfF3",
  "Public Cloud Security Policy and Access": "https://salesresources.cisco.com/Link/Content/DCJThRm6W4gMBGHWGRP9bRXh8Hjd",
  "Data Center Firewall Operations": "https://salesresources.cisco.com/Link/Content/DCHFpmXWT92HTGQCqH6Mfm3gCPj3",
  "Internet Edge Protection": "https://salesresources.cisco.com/Link/Content/DCCjTFMPQQWGG8WF2GjCgHCRpffB",
  "Network Access Control": "https://salesresources.cisco.com/Link/Content/DCjjXWbm7hpJPGcT9XpV7MpW47cj",
  "Simplified Operations": "https://salesresources.cisco.com/Link/Content/DC4Pd2GRgGFRg8cFdMQWMqcMFC7d",
  "Data Center Network Operations": "https://salesresources.cisco.com/Link/Content/DCMTJ82j6CjgbG9RT6pMjpgDpFXG",
  "Distributed Networking": "https://salesresources.cisco.com/Link/Content/DCbB2Mm8GbV3G8qJJgmb4qqQJJTP",
  "Distributed Networking with NDFC (DCNM)": "https://salesresources.cisco.com/Link/Content/DC7Qh9M2bJHDM8f2fjDqhPjVX6Pj",
  "Fabric Provisioning and Operations with NDFC (DCNM)": "https://salesresources.cisco.com/Link/Content/DCH4dRd8bC7q38WDVGPCqjTdgf2j",
  "Network Provisioning and Operations": "https://salesresources.cisco.com/Link/Content/DCC6qVR97QGWH8fX7DjRdCRWgHCB"
};

function renderCustomer(data) {
  var el = document.getElementById("tab-customer");
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
    if (v === null || v === undefined || isNaN(v)) return "-";
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

  var today = new Date();

  // Default rows: opted-in AND (stage=ELIGIBLE or expired)
  var defaultRows = data.filter(function (r) {
    if (norm(r["Adopt Rebate Opt-In Status"]) !== "OPTED IN") return false;
    var stage = norm(r["Stage"]);
    if (stage === "ELIGIBLE") return true;
    var expiry = toDate(r["Deal Incentive Expiry Date"]);
    return expiry && expiry < today;
  });

  var html = '<div class="d-flex align-items-end gap-4 mb-3">';
  html += '<div>';
  html += '<label for="cust-name-filter" class="form-label small fw-semibold mb-1">';
  html += '<i class="bi bi-search me-1"></i>Filter by CR Party Name</label>';
  html += '<div class="position-relative" style="min-width:320px">';
  html += '<input type="text" id="cust-name-filter" class="form-control form-control-sm pe-4" placeholder="Type to filter customers…"/>';
  html += '<button id="cust-name-clear" type="button" class="btn btn-link p-0 position-absolute top-50 end-0 translate-middle-y me-2 d-none" style="font-size:0.8rem;color:#999;line-height:1" tabindex="-1"><i class="bi bi-x-lg"></i></button>';
  html += '</div>';
  html += '</div>';
  html += '<div class="text-muted small mb-1" id="cust-count-label"></div>';
  html += '</div>';
  html += '<div id="cust-table-area"></div>';

  el.innerHTML = html;

  // Consume deep-link set by navigateToCustomer (synchronous — no timing race)
  var deepLink = window._custDeepLink || "";
  window._custDeepLink = null;
  if (deepLink) {
    var filterInp = document.getElementById("cust-name-filter");
    if (filterInp) filterInp.value = deepLink;
  }

  document.getElementById("cust-name-filter").addEventListener("input", function () {
    document.getElementById("cust-name-clear").classList.toggle("d-none", this.value === "");
    renderCustomerTable(this.value.trim());
  });
  document.getElementById("cust-name-clear").addEventListener("click", function () {
    var inp = document.getElementById("cust-name-filter");
    inp.value = "";
    this.classList.add("d-none");
    inp.focus();
    renderCustomerTable("");
  });

  renderCustomerTable(document.getElementById("cust-name-filter").value.trim());

  function renderCustomerTable(nameFilter) {
    var area = document.getElementById("cust-table-area");

    var rows = defaultRows.filter(function (r) {
      if (!nameFilter) return true;
      var name = String(r["CR Party Name"] || "").toLowerCase();
      return name.indexOf(nameFilter.toLowerCase()) !== -1;
    });

    var countLabel = document.getElementById("cust-count-label");
    if (countLabel) {
      countLabel.textContent = rows.length.toLocaleString() + " record" + (rows.length !== 1 ? "s" : "");
    }

    if (rows.length === 0) {
      area.innerHTML = '<p class="text-muted mt-2">' +
        (nameFilter ? 'No records match "' + escHtml(nameFilter) + '".' : 'No opted-in eligible or expired records found.') +
        '</p>';
      return;
    }

    var has2TPartner = data.some(function (r) { return r["2T Partner Name"] && String(r["2T Partner Name"]).trim() !== ""; });

    var cols = [
      ...(has2TPartner ? [{ label: "2T Partner Name", field: "2T Partner Name" }] : []),
      { label: "CR Party Name",                     field: "CR Party Name" },
      { label: "CR Party ID",                       field: "CR Party ID" },
      { label: "CX Customer BU ID",                 field: "CX Customer BU ID" },
      { label: "Domain",                            field: "Deal CPI Portfolio" },
      { label: "Offer",                             field: "Track" },
      { label: "Use Case",                          field: "Sub-Track",                        isUC: true },
      { label: "Current Stage",                     field: "Current stage",                    isStage: true },
      { label: "Stage Progress",                    field: "Current Stage Progress" },
      { label: "Pending Tasks",                     field: "Current stage pending tasks" },
      { label: "Days in Stage",                     field: "Days in stage",                    isDays: true },
      { label: "Potential<br>Incentives",           field: "Potential Incentives",             isCurrency: true },
      { label: "Estimated<br>Earned Incentives",    field: "Estimated Earned Incentives",      isCurrency: true },
      { label: "Booking Date",                      field: "Booking Date",                     isDate: true },
      { label: "Opt-in Date",                      field: "Adopt Rebate Start Date",          isDate: true },
      { label: "Expiry Date",                       field: "Deal Incentive Expiry Date",       isDate: true, isExpiry: true },
      { label: "Stages Completed<br>Before Opt-in", field: "Missed Incentives",               isMissedFlag: true },
      { label: "Deal WS-ID",                        field: "Deal WS-ID",                       isWsId: true }
    ];

    var thead = "<thead><tr>" + cols.map(function (c) { return "<th>" + c.label + "</th>"; }).join("") + "</tr></thead>";

    var tbody = "<tbody>";
    rows.forEach(function (r) {
      var expiryObj = toDate(r["Deal Incentive Expiry Date"]);
      var isExpired = expiryObj && expiryObj < today;
      var isCompleted = norm(r["Current stage"]) === "COMPLETED";
      tbody += '<tr' + ((isExpired || isCompleted) ? ' class="row-dimmed"' : '') + '>';
      cols.forEach(function (c) {
        var val = r[c.field];
        if (c.isMissedFlag) {
          var optInDate = toDate(r["Adopt Rebate Start Date"]);
          var stagesToCheck = [
            { name: "Engage",  dateField: "Stage Completion Date(Engage)" },
            { name: "Use",     dateField: "Stage Completion Date(Use)" },
            { name: "Onboard", dateField: "Stage Completion Date(onboard)" }
          ];
          var missedParts = [];
          stagesToCheck.forEach(function(s) {
            var completionDate = toDate(r[s.dateField]);
            if (completionDate && optInDate && completionDate < optInDate) {
              missedParts.push(s.name + " - " + fmtDate(completionDate));
            }
          });
          if (missedParts.length === 0) {
            tbody += '<td class="text-muted">N/A</td>';
          } else {
            tbody += '<td><span class="text-danger fw-semibold">' + missedParts.join("<br>") + '</span></td>';
          }
        } else if (c.isWsId) {
          var wsid = escHtml(val);
          tbody += '<td>' + (val ? '<a href="https://app.workspan.com/wsid/' + wsid + '" target="_blank" rel="noopener">' + wsid + '</a>' : '') + '</td>';
        } else if (c.isExpiry) {
          var dObj = toDate(val);
          var cellStyle = "";
          if (dObj && !isExpired) {
            var daysUntil = Math.round((dObj - today) / 86400000);
            if (daysUntil > 180)     cellStyle = ' style="background:#dff6dd"';
            else if (daysUntil > 90) cellStyle = ' style="background:#fff4ce"';
            else if (daysUntil >= 0) cellStyle = ' style="background:#ffe6e6"';
          }
          tbody += '<td' + cellStyle + '>' + fmtDate(val) + '</td>';
        } else if (c.isDate) {
          tbody += '<td>' + fmtDate(val) + '</td>';
        } else if (c.isCurrency) {
          tbody += '<td>' + fmtCurrency(val) + '</td>';
        } else if (c.isUC) {
          var ucName = escHtml(val);
          var ucUrl = val ? UC_GUIDE_MAP[String(val).trim()] : null;
          tbody += '<td>' + (ucUrl ? '<a href="' + ucUrl + '" target="_blank" rel="noopener">' + ucName + '</a>' : ucName) + '</td>';
        } else if (c.isStage) {
          tbody += '<td><span class="stage-badge stage-' + escHtml(val) + '">' + escHtml(val) + '</span></td>';
        } else if (c.isDays) {
          var days = val !== null && val !== undefined ? parseInt(val) : null;
          var dayColor = days === null ? "" : days > 180 ? "color:#D13438" : days > 90 ? "color:#FF8C00" : "color:#107C10";
          tbody += '<td style="font-weight:600;' + dayColor + '">' + (days !== null ? days : "-") + '</td>';
        } else {
          tbody += '<td>' + escHtml(val) + '</td>';
        }
      });
      tbody += "</tr>";
    });
    tbody += "</tbody>";

    area.innerHTML = '<div class="table-wrapper"><table class="table table-sm table-bordered mb-0">' + thead + tbody + '</table></div>';
  }
}

window.renderCustomer = renderCustomer;
