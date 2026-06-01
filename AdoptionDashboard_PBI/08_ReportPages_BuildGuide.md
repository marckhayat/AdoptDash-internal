# Adoption Dashboard — Power BI Report Pages Build Guide

> **How to use this guide**
> Power BI report layouts cannot be scripted — each page must be built manually
> in Power BI Desktop. This guide gives you the exact field, measure, and
> formatting instructions for every visual on every page, matching the Excel v5.1
> dashboard exactly.
>
> Apply the theme first: **View → Themes → Browse for themes → select `07_Theme.json`**

---

## Global Setup (do this once before building pages)

### Data model relationships
No relationships needed — the `Data` table is the single fact table.
`FiscalCalendar` and `PVI_Brackets` are connection-only (not loaded to the report).

### What-If Parameters to create (Modeling → New Parameter)
| Parameter Name | Type | Min | Max | Increment | Default |
|---|---|---|---|---|---|
| `Sim Onboard Booking NET` | Whole Number | 0 | 100,000,000 | 100,000 | 0 |
| `Sim Adopt Booking NET`   | Whole Number | 0 | 100,000,000 | 100,000 | 0 |
| `Sim Onboard Booking SEC` | Whole Number | 0 | 100,000,000 | 100,000 | 0 |
| `Sim Adopt Booking SEC`   | Whole Number | 0 | 100,000,000 | 100,000 | 0 |
| `Sim Onboard Booking CLOUD` | Whole Number | 0 | 100,000,000 | 100,000 | 0 |
| `Sim Adopt Booking CLOUD`   | Whole Number | 0 | 100,000,000 | 100,000 | 0 |

> These power the PVI Simulation section. Each parameter auto-creates a slicer visual — move them to the PVI page.

---

## Page 1 — Overview

**Purpose:** Summary of all 28 Use Cases across 4 domains with 13 incentive metrics.

### Slicers (top of page)
| Slicer | Field | Style |
|---|---|---|
| Partner Country | `Data[Partner Country]` | Dropdown |
| Partner Region  | `Data[Partner Region]`  | Dropdown |
| Program Type    | `Data[Program Type]`    | Dropdown |
| Offer           | `Data[Track]`           | Dropdown |

### Main Visual — Matrix
**Visual type:** Matrix

**Rows (in order):**
1. `Data[Deal CPI Portfolio]` — rename display to "Domain"
2. `Data[Track]`              — rename display to "Offer"
3. `Data[Sub-Track]`          — rename display to "Use Case"
4. `Data[Incentive Level]`    — rename display to "Type"

> In Format → Row headers → expand all levels by default: ON

**Values (columns E–Q, in order):**
| Column label | Measure |
|---|---|
| Total UC Eligible w/o opt-in (customer count) | `[UC Eligible w/o Opt-In]` |
| Total Potential Incentives (max per customer)  | `[Total Potential Incentives]` |
| UC 25-50% eligible w/o opt-in (customer count)| `[UC 25-50% w/o Opt-In]` |
| Potential Incentives (max per customer)        | `[Potential Incentives 25-50%]` |
| UC 75% eligible w/o opt-in (customer count)   | `[UC 75% w/o Opt-In]` |
| Missed Incentives (max per customer)           | `[Missed Incentives 75%]` |
| Potential Incentives (max per customer)        | `[Potential Incentives 75%]` |
| UC progressed and missed w/o opt-in (customer count) | `[UC Progressed and Missed]` |
| Missed Incentives (max per customer)           | `[Missed Incentives Progressed]` |
| Active Opted-in UC                             | `[Active Opted-In UC]` |
| Potential Incentives                           | `[Potential Incentives Opted-In]` |
| Progressed opted-in UC                         | `[Progressed Opted-In UC]` |
| Estimated Earned Incentives                    | `[Estimated Earned Incentives]` |

**Formatting:**
- Currency columns (F, H, J, K, M, O, Q): Format → Values → Custom format `$#,##0`
- Count columns (E, G, I, L, N, P): Format → Values → Whole number
- Column subtotals: OFF (they are meaningless for cols E–M per Excel note)
- Row subtotals: ON for Domain level only

### Text card (bottom of page)
**Visual type:** Card (multi-row) or Text box
**Text:** `"Values in columns Total UC Eligible through Missed Incentives (progressed) cannot be summed because earning is available to one use case per offer per customer."`
**Font:** 10pt, italic, color #666666

### Callout cards (top-right strip, optional)
| Card | Measure |
|---|---|
| New Eligible (last 30 days) | `[New Eligible Count]` |
| Expiring Soon (<3 months)   | `[Expiring Soon Count]` |

---

## Page 2 — Details

**Purpose:** Row-level deal view with inline incentive totals.

### Summary cards (row at top)
| Card label | Measure / Expression |
|---|---|
| Customer count | `[Customer Count]` |
| Use case count | `[Use Case Count]` |
| Total Missed Incentives | `[Total Missed Incentives]` — format `$#,##0` |
| Total Potential Incentives | `[Total Potential Incentives Summary]` — format `$#,##0` |
| Total Estimated Earned | `[Total Estimated Earned Summary]` — format `$#,##0` |

### Slicers (left panel or top bar)
| Slicer | Field | Style |
|---|---|---|
| Stage | `Data[Stage]` | List (checkboxes) |
| Opt-In Status | `Data[Adopt Rebate Opt-In Status]` | List |
| Portfolio | `Data[Deal CPI Portfolio]` | List |
| Offer | `Data[Track]` | Dropdown |
| Partner Country | `Data[Partner Country]` | Dropdown |
| Expires <3M? | `Data[Expires <3M?]` | List |
| EA Flag | `Data[EA Flag]` | List |
| Offer Risk Level | `Data[Offer Risk Level]` | List |

### Main Visual — Table
**Visual type:** Table

**Columns (in exact order from Excel row 18):**
| Column label | Field / Measure |
|---|---|
| 2T Partner Name | `Data[2T Partner Name]` |
| CR Party Name | `Data[CR Party Name]` |
| CR Party ID | `Data[CR Party ID]` |
| CX Customer BU ID | `Data[CX Customer BU ID]` |
| Offer | `Data[Track]` |
| Use Case | `Data[Sub-Track]` |
| Current stage | `Data[Current stage]` |
| Days in stage | `Data[Days in stage]` |
| Current Stage Progress | `Data[Current Stage Progress]` |
| Current stage pending tasks | `Data[Current stage pending tasks]` |
| Deal WS-ID | `Data[Deal WS-ID]` |
| Deal ID | `Data[Deal ID]` |
| Deal Incentive Expiry Date | `Data[Deal Incentive Expiry Date]` — format `dd/mm/yyyy` |
| Sum of Missed Incentives | `Data[Missed Incentives]` — format `$#,##0` |
| Sum of Potential Incentives | `Data[Potential Incentives]` — format `$#,##0` |
| Sum of Estimated Earned Incentives | `Data[Estimated Earned Incentives]` — format `$#,##0` |

> Note: The incentive columns here use the **row-level computed columns** from the Data
> table (not the Summary measures from Section 2 of the DAX file). The row-level
> values already have the dedup logic applied in Power Query.

**Sorting:** Default sort by `Potential Incentives` descending

**Conditional formatting (optional but recommended):**
- `Current stage` → Background color rule:
  - "Purchase" or "Onboard" → #FFE6E6 (light red / High risk)
  - "Implement" or "Use" → #FFF4CE (light orange / Medium risk)
  - "Engage", "Adopt", "Completed" → #DFF6DD (light green / Low risk)
- `Expires <3M?` = "Yes" → Bold red text

---

## Page 3 — Customer

**Purpose:** Single-customer lookup showing opted-in UC details.

### Dropdown slicer (top of page)
**Visual type:** Slicer
**Field:** `Data[CRPartyNameID]`  (= "Customer Name-ID" combined key)
**Style:** Dropdown (single select)
**Label:** "Select your customer (name-ID) to get details on opted-in use-cases."

> Filter this slicer to only show customers with at least one Opted In UC:
> Add a visual-level filter: `Data[Adopt Rebate Opt-In Status]` is `Opted In`
> This prevents the dropdown from being cluttered with non-opted-in customers.

### Detail table (body of page)
**Visual type:** Table
**Visual-level filter:** `Data[Adopt Rebate Opt-In Status]` = "Opted In"

**Columns:**
| Column label | Field |
|---|---|
| Domain | `Data[Deal CPI Portfolio]` |
| Offer | `Data[Track]` |
| Use Case | `Data[Sub-Track]` |
| Current Stage | `Data[Current stage]` |
| Stage Progress | `Data[Current Stage Progress]` |
| Pending Tasks | `Data[Current stage pending tasks]` |
| Days in Stage | `Data[Days in stage]` |
| Potential Incentives | `Data[Potential Incentives]` — format `$#,##0` |
| Estimated Earned Incentives | `Data[Estimated Earned Incentives]` — format `$#,##0` |
| Booking Date | `Data[Booking Date]` — format `dd/mm/yyyy` |
| Adopt Rebate Start Date | `Data[Adopt Rebate Start Date]` — format `dd/mm/yyyy` |
| Deal Incentive Expiry Date | `Data[Deal Incentive Expiry Date]` — format `dd/mm/yyyy` |
| Stage completed before opt-in | `Data[Missed Incentives]` > 0 → "Yes" else "No"<br>*(use a calculated column in DAX: `Stage completed before opt-in = IF(Data[Missed Incentives] > 0, "Yes", "No")`)* |
| Deal WS-ID | `Data[Deal WS-ID]` |

> **Enablement Guide link:** The Excel Customer sheet references this as text.
> In Power BI, add a Web URL column or embed a fixed URL in a text card below the table,
> pointing to the relevant Cisco enablement resource.

**Conditional formatting:**
- `Days in Stage` → Data bar (blue, no axis)
- `Deal Incentive Expiry Date` → Background color: red if < TODAY() + 90 days

---

## Page 4 — PVI

**Purpose:** PVI Engagement score display + simulation for all 3 domains.

> **Distributor note:** In Excel, PVI cells show "N/A" when `Input_region = "DISTI"`.
> In Power BI: add a Slicer for `Data[Program Type]` or use a Page-level filter.
> When the data contains only Distributor records, PVI measures will return BLANK()
> because no rows will have `PVI Eligible = TRUE`.

### Disclaimer card (top of page)
**Text:** "Partners should rely on PXP (Partner Experience Platform) to get the official PVI scores. The below is an indication of the Engagement score based on current CPI performance. Score may differ slightly from PXP due to the timing of data capture."
**Font:** 10pt italic, color #666666

### PVI Score section — 3-column layout

Repeat the following visual block for each domain (Networking | Security | Cloud + AI Infrastructure):

#### Domain header card
**Visual type:** Card
**Value:** Domain name (static text box or a measure = "<Domain Name>")

#### Metrics table
**Visual type:** Multi-row card or Table with 3 columns (Count | Booking Value)

| Row label | Count measure | Booking Value measure |
|---|---|---|
| Eligible UC | `[PVI Eligible UC - <Domain>]` | `[PVI Eligible Booking - <Domain>]` |
| Eligible UC Onboarded | `[PVI Onboarded UC - <Domain>]` | `[PVI Onboarded Booking - <Domain>]` |
| Ratio Onboarded | — | `[PVI Onboard Ratio - <Domain>]` — format as % |
| PVI Engagement - Onboard (/10) | — | `[PVI Onboard Score - <Domain>]` |
| Eligible UC Adopted | `[PVI Adopted UC - <Domain>]` | `[PVI Adopted Booking - <Domain>]` |
| Ratio Adopted | — | `[PVI Adopt Ratio - <Domain>]` — format as % |
| PVI Engagement - Adopt (/10) | — | `[PVI Adopt Score - <Domain>]` |
| **PVI Engagement - Total (/10)** | — | **`[PVI Engagement Total - <Domain>]`** — bold, larger font |

Replace `<Domain>` with: `Networking`, `Security`, or `Cloud`.

**Formatting for Total score card:**
- Value font size: 28pt, bold
- Color: Green if >= 5, Orange if 3-4, Red if < 3
  *(use Conditional formatting → Font color → Rules)*

### Simulation section (below PVI scores)
**Visual type:** Per-domain block with sliders + result cards

For each domain:
1. **Slicer (slider):** `Sim Onboard Booking <Domain>` parameter — label "Target Booking Value Onboarded"
2. **Card:** `[PVI Sim Onboard Score - <Domain>]` — label "PVI Engagement - Onboard (/10)"
3. **Slicer (slider):** `Sim Adopt Booking <Domain>` parameter — label "Target Booking Value Adopted"
4. **Card:** *(create `[PVI Sim Adopt Score - <Domain>]` using same pattern as `[PVI Sim Onboard Score - Networking]` in the DAX file)*
5. **Card:** `(Sim Onboard Score + Sim Adopt Score) / 2` — label "PVI Engagement - Total (/10)"

### Footer
**Text box:** "For more details on PVI calculations, please check out the PVI metrics guide."
Include a hyperlink button to the Cisco PVI guide URL.

---

## Page 5 — Lifecycle

**Purpose:** Stacked bar chart of net booking value by lifecycle stage × fiscal month (last 18 months). Color-coded by renewal risk.

### Description text box (top)
"The charts below depict offer lifecycle progression using the net booking value of eligible SKUs. One use case per offer and CR Party ID is selected: preference is given to opted-in use cases, otherwise, the highest-incentive use case is chosen. Red/Orange/Green correlate with the renewal risk level (High/Medium/Low), as early adoption positively impacts renewal. Data covers last 18 months."

### Slicers
| Slicer | Field | Style |
|---|---|---|
| Portfolio (Domain) | `Data[Deal CPI Portfolio]` | Tiles or Dropdown |

### Main Visual — Clustered/Stacked Bar Chart

> **Note on X-axis (fiscal month):**
> Because the Lifecycle measures use a calendar date cutoff (not the FiscalCalendar
> table), the simplest approach is to:
> 1. Add a calculated column to Data: `Fiscal Month = LOOKUPVALUE(FiscalCalendar[Fiscal Month], FiscalCalendar[Start], MINX(FILTER(FiscalCalendar, FiscalCalendar[Start] <= Data[Booking Date] && FiscalCalendar[End] >= Data[Booking Date]), FiscalCalendar[Start]))`
> 2. Use `Data[Fiscal Month]` on the X-axis, sorted by `FiscalCalendar[Count]`.

**Visual type:** Stacked bar chart

**X-axis:** `Data[Fiscal Month]` — sorted ascending by SeqMonthNumber
  - Apply visual-level filter: only show months within 18-month window
  - Filter: `Data[Booking Date]` is in the last 18 months (relative date filter)

**Y-axis:** `[Lifecycle Booking by Stage]`

**Legend (stack):** `Data[Current stage]`

**Stack color mapping** (set manually via Format → Data colors):
| Stage | Color | Risk |
|---|---|---|
| Purchase | #D13438 | High 🔴 |
| Onboard | #F87171 | High 🔴 |
| Implement | #FF8C00 | Medium 🟠 |
| Use | #FFB347 | Medium 🟠 |
| Engage | #107C10 | Low 🟢 |
| Adopt | #54A354 | Low 🟢 |
| Completed | #A9D18E | Low 🟢 |

**Tooltip:** Stage, Booking Amount, Risk Level

---

## Page 6 — CPI Adopt

**Purpose:** All-time CPI Adopt performance — opt-in ratio and incentives charts.

### Description text boxes (top)
Line 1: "The below charts contain all-time data for CPI Adopt. One use case per offer and CR Party ID is selected: preference is given to opted-in use cases, otherwise, the highest-incentive use case is chosen."
Line 2: "Opt-in Ratio: compares the potentially available payout for eligible opted-in UCs to what can still be opted-in."
Line 3: "Incentives: shows, for all opted-in UCs, the total amount of estimated earned incentives and the remaining potential."

### Slicers (matching Excel CPI Adopt dropdowns)
| Slicer | Field | Style | Default |
|---|---|---|---|
| Select Portfolio | `Data[Deal CPI Portfolio]` | Dropdown | Networking |
| Select Offer | `Data[Track]` | Dropdown | Catalyst Center |

> The Offer slicer should be filtered to only show offers within the selected Portfolio.
> Set this as a cross-filter: Portfolio slicer → Edit interactions → filter the Offer slicer.

### Chart 1 — Opt-in Ratio (left half)
**Visual type:** Stacked bar chart (horizontal, single bar) **or** 100% Stacked bar

**Title:** "Opt-in Ratio"

**Values (3 segments):**
| Segment | Measure | Color |
|---|---|---|
| Opted-in | `[CPI Opted-In Payout]` | #00BCF2 (Cisco blue) |
| Still available to opt-in | `[CPI Potential Not-Yet-Opted-In]` | #C7E0F4 (light blue) |

> The ratio percentage label: add a Card visual below showing:
> `DIVIDE([CPI Opted-In Payout], [CPI Eligible UC Payout])` formatted as %

### Chart 2 — Incentives (right half)
**Visual type:** Clustered bar chart or Stacked bar

**Title:** "Incentives (opted-in UCs)"

**Values:**
| Series | Measure | Color |
|---|---|---|
| Estimated Earned | `[CPI Estimated Earned]` | #107C10 (green) |
| Potential Remaining | `[CPI Potential Remaining]` | #C7E0F4 (light blue) |

**Formatting for both charts:**
- X-axis: Currency format `$#,##0`
- Data labels: ON, format `$#,##0`
- Legend: bottom

---

## Final Checklist Before Publishing

- [ ] Apply `07_Theme.json` theme (View → Themes → Browse)
- [ ] Set all currency measures to format `$#,##0` in the Format pane
- [ ] Verify PVI score cards show correct values against Excel (validation step)
- [ ] Set page navigation buttons or tab order to match Excel sheet order:
      Overview → Details → Customer → PVI → Lifecycle → CPI Adopt
- [ ] Set report-level filter: hide rows where `Data[Deal WS-ID]` is blank (placeholder row)
- [ ] For Distributor use: add a page-level note "PVI not applicable to Distributors"
      and use a bookmark/button to toggle PVI visibility, OR rely on BLANK() from measures
- [ ] Publish to Power BI Service and set scheduled refresh (if SharePoint data source is configured)
