# Adoption Dashboard — Context & Calculation Reference

**File:** `Adoption dashboard v4.4.xlsm`  
**Purpose:** Helps partners identify opportunities to earn Cisco Partner Incentive (CPI) Adopt rebates by driving software adoption. Feeds into the Partner Value Index (PVI) Engagement score.

---

## Sheet Overview

| Sheet | Visible | Role |
|-------|---------|------|
| **Instructions** | ✅ | How to load data; links to Workspan report 19849 (Partners) or 21766 (Distributors) |
| **Overview** | ✅ | Summary pivot by Domain → Offer → Use Case |
| **Details** | ✅ | Row-level deal view with inline definitions |
| **PVI** | ✅ | Partner Value Index Engagement score calculator |
| **Lifecycle** | ✅ | Charts: offer lifecycle progression (last 18 months) |
| **CPI Adopt** | ✅ | Charts: all-time opt-in ratios and incentive performance |
| **Data** | 🔒 hidden | Processed/computed data table |
| **Source** | 🔒 hidden | Raw Workspan report paste target |
| **Ref** | 🔒 hidden | Lookup tables, fiscal calendar, scoring brackets, chart data |

---

## Data Flow

```
Workspan Report (Excel export)
    ↓  [Load Partner File / Load Disti File button — VBA macro]
Source sheet  (raw columns from Workspan)
    ↓  [computed columns added]
Data sheet    (structured named table)
    ↓
Overview / Details / PVI / Lifecycle / CPI Adopt
```

---

## Source Sheet — Raw Workspan Columns

- `Deal WS-ID`, `Partner Name`, `BE GEO ID`, `Partner Country`, `Partner Region`
- `CR Party Name`, `CR Party ID`
- `Program Type`
- `Track` (= Offer), `Sub-Track` (= Use Case), `Incentive Level`
- `Deal Incentive Expiry Date`, `Booking Date`, `Booking Amount - Net to Cisco`, `Booking Amount - Net to Cisco (Currency)`
- `Stage` — values: **Eligible / Expired / Not Eligible**
- `Adopt Rebate Opt-In Status` — values: **Opted In / Opted Out / Pending**
- `Adopt Rebate Start Date`
- Stage Completion Flag + Date for: **Purchase / Onboard / Implement / Use**

---

## Data Sheet — Computed/Derived Columns

| Column | Meaning |
|--------|---------|
| `CRPartyID-Offer` | Composite dedup key (CR Party ID + Offer) |
| `Offer opted-in?` | TRUE if any UC in this offer is opted-in |
| `Potential Incentives` | Incentives still earnable on this deal |
| `Missed Incentives` | Incentives that could have been earned but were not (not opted-in) |
| `Estimated Earned Incentives` | Incentives already earned |
| `Earned?` | Boolean — UC has progressed past the earning threshold |
| `UC 25-50% eligible w/o opt-in` | UC progressed 1–2 of 4 stages, not opted-in |
| `UC 75% eligible w/o opt-in` | UC progressed 3 of 4 stages, not opted-in |
| `UC progressed and missed w/o opt-in` | UC completed all 4 stages without being opted-in |
| `PVI Eligible` | In-scope for PVI score (booking within last 18 fiscal months, 1 UC/offer selected) |
| `PVI Onboard` | PVI-eligible UC that has completed the Onboard stage |
| `PVI Adopt` | PVI-eligible UC that has completed the Adopt stage |
| `Maximum Incentive Deal Flag` | "Yes" = best UC selected per offer/customer (used in charts) |
| `Revised Maximum Incentive Amount` | Normalized incentive amount for that best UC |
| `Deal CPI Portfolio` | Technology domain: Networking / Security / Cloud + AI Infrastructure |
| `Current stage` | Normalized current lifecycle stage |

---

## Overview Sheet — Column Logic

Each row = one Use Case (Domain → Offer → Use Case). Calculations follow a consistent pattern:
1. Filter `Data` to the matching Sub-Track (and other conditions)
2. Deduplicate by `CR Party ID` or `CRPartyID-Offer`
3. Count unique customers OR take `MAXIFS(incentive)` per unique pair, then `SUM`

| Column | Metric | Filter Conditions |
|--------|--------|-------------------|
| E | **Total UC Eligible w/o opt-in** (customer count) | Sub-Track match + `Offer opted-in?`=FALSE + Stage=Eligible → unique `CR Party ID` count |
| F | **Total Potential Incentives** | Same as E but MAXIFS(`Potential Incentives`) per unique `CRPartyID-Offer`, then SUM |
| G | **UC 25-50% eligible w/o opt-in** (count) | `UC 25-50%`=TRUE → unique `CR Party ID` count |
| H | **Potential Incentives (25-50%)** | `UC 25-50%`=TRUE → MAXIFS(`Potential Incentives`) per unique pair, SUM |
| I | **UC 75% eligible w/o opt-in** (count) | `UC 75%`=TRUE → unique `CR Party ID` count |
| J | **Missed Incentives (75%)** | `UC 75%`=TRUE → MAXIFS(`Missed Incentives`) per unique pair, SUM |
| K | **Potential Incentives (75%)** | `UC 75%`=TRUE → MAXIFS(`Potential Incentives`) per unique pair, SUM |
| L | **UC progressed and missed** (count) | `UC progressed and missed`=TRUE → unique `CR Party ID` count |
| M | **Missed Incentives (progressed)** | `UC progressed and missed`=TRUE → MAXIFS(`Missed Incentives`) per unique pair, SUM |
| N | **Active Opted-in UC** | Opt-In Status="Opted in" AND Stage=Eligible → COUNT rows |
| O | **Potential Incentives (opted-in)** | Opt-In Status="Opted in" AND Stage=Eligible → SUM(`Potential Incentives`) |
| P | **Progressed opted-in UC** | `Earned?`=TRUE → COUNT rows |
| Q | **Estimated Earned Incentives** | Filter by Sub-Track → SUM(`Estimated Earned Incentives`) |

---

## Details Sheet

Row-level deal view. Key summary formulas in row 17:
- **Customer count** = `COUNTA(UNIQUE(CR Party IDs))`
- **Use case count** = unique combinations of `CR Party ID | Use Case`
- **Total Missed / Potential / Estimated Earned** = `SUM(BYROW(UNIQUE(customer+offer pairs), LAMBDA → MAXIFS))` — picks the best incentive per customer+offer pair

### Column Headers (row 18)
`CR Party Name` | `CR Party ID` | `CX Customer BU ID` | `Offer` | `Use Case` | `Current stage` | `Days in stage` | `Current Stage Progress` | `Current stage pending tasks` | `Deal WS-ID` | `Deal ID` | `Deal Incentive Expiry Date` | `Sum of Missed Incentives` | `Sum of Potential Incentives` | `Sum of Estimated Earned Incentives`

### Definitions (from sidebar in Details sheet)
| Term | Definition |
|------|-----------|
| Level | Standard vs Advanced. Advanced UCs have higher incentive values. |
| Expires <3M? | Deal where incentive expires in less than 3 months |
| EA Flag | Enterprise Agreement deal |
| Stage: Eligible | Can earn incentives on this deal |
| Stage: Expired | Incentive has passed expiry date |
| Stage: Not Eligible | Not eligible (e.g. all stages completed, or another UC already opted-in for this offer) |
| Opt-in: Opted In | Deal selected for CPI |
| Opt-in: Opted Out | Deal de-selected |
| Opt-in: Pending | Opt-in is possible |
| Offer opted-in | Any UC opted-in within this offer |
| Earned? | Whether incentives have been earned on that UC |
| Deal CPI Portfolio | Technology domain encompassing offers and UCs |
| Offer | Main solution sold to the customer |
| Use Case | Capabilities of a Cisco solution; actions to progress through lifecycle and achieve business outcomes |
| UC 25-50% | UC progressed 1–2 stages out of 4, not opted-in yet |
| UC 75% | UC progressed 3 stages out of 4, not opted-in yet |
| UC progressed and missed | UC completed all 4 earned stages in CPI (without opt-in) |
| Offer Risk Level: High | UC is in Purchase/Onboard stage |
| Offer Risk Level: Medium | UC is in Implement/Use stage |
| Offer Risk Level: Low | UC is in Engage/Adopt/Completed stage |
| Adopt Rebate Start Date | When the deal was opted-in |
| Booking Date | Deal booking date |
| PVI Eligible/Onboard/Adopt | UCs included in PVI Engagement score calculations |

---

## PVI Sheet — Score Calculation

Calculated separately for **Networking**, **Security**, and **Cloud + AI Infrastructure**.

```
Step 1: Eligible UC Booking Value
    = SUM(Booking Amount) where PVI Eligible=TRUE AND Deal CPI Portfolio=<domain>

Step 2: Onboarded Booking Value
    = SUM(Booking Amount) where PVI Onboard=TRUE AND Deal CPI Portfolio=<domain>
    Ratio = Onboarded / Eligible
    → XLOOKUP(ratio, Net_onboard_perc, Net_Onboard_score, 10, match_type=1, search_mode=1)
    → Onboard Score (out of 10)

Step 3: Adopted Booking Value
    = SUM(Booking Amount) where PVI Adopt=TRUE AND Deal CPI Portfolio=<domain>
    Ratio = Adopted / Eligible
    → XLOOKUP(ratio, Net_adopt_perc, Net_Adopt_score, 10, match_type=1, search_mode=1)
    → Adopt Score (out of 10)

Step 4: PVI Engagement Total = (Onboard Score + Adopt Score) / 2
```

A **Simulation** section allows entering target booking values to preview what PVI score would result.

> Note: Score may differ slightly from PXP (Partner Experience Platform) due to timing of data capture. PXP is the official source.

### PVI Scoring Rules
- Only considers UCs with a booking date within the **past 18 fiscal months**
- **1 UC per offer** is selected: opted-in UC takes priority; if none, the UC with the highest incentive is chosen
- A UC that completes the Adopt phase **without being opted-in** becomes Not Eligible and is excluded from PVI

---

## Lifecycle Sheet

Charts showing offer lifecycle progression using **net booking value** of eligible SKUs.  
- 1 UC per offer per CR Party ID is selected (opted-in preferred; else highest incentive)
- Color-coded by renewal risk: 🔴 High (Purchase/Onboard) / 🟠 Medium (Implement/Use) / 🟢 Low (Engage/Adopt/Completed)
- Data covers last **18 fiscal months**

**Backend data** (Ref sheet, columns R–T): `SUMIFS(Booking Amount, Track, stage, Maximum Incentive Deal Flag="Yes", Booking Date > 18 months ago)` — grouped by lifecycle stage × portfolio.

---

## CPI Adopt Sheet

Charts showing **all-time** CPI Adopt performance.  
- Same 1-UC-per-offer-per-customer selection logic
- **Opt-in Ratio**: compares potentially available payout for eligible opted-in UCs to what can still be opted-in
- **Incentives chart**: for all opted-in UCs — estimated earned incentives vs remaining potential
- Two dropdown filters: Portfolio and Offer

**Backend data** (Ref sheet):

| Row | Metric | Formula |
|-----|--------|---------|
| Eligible UC payout | `Revised Maximum Incentive Amount` | SUMIFS where `Maximum Incentive Deal Flag`="Yes" + Stage=Eligible + Track |
| Opted-in payout | Same | + `Adopt Rebate Opt-In Status`="Opted In" |
| Potential (not opted-in) | Eligible − Opted-in | |
| Estimated Earned | `Estimated Earned Incentives` | SUMIFS where opted-in + Maximum Incentive Deal Flag="Yes" |
| Potential remaining | `Potential Incentives` | SUMIFS where opted-in + Eligible + Maximum Incentive Deal Flag="Yes" |

---

## Ref Sheet — Supporting Data

| Section | Contents |
|---------|----------|
| `Max_rows` | `=ROWS(Data)+50` — anchors all dynamic array formulas |
| Fiscal calendar | FY24M1–FY27M12 with start date, end date, sequential month number |
| PVI scoring brackets | Step-lookup tables (score 0–10) for each domain × metric (onboard/adopt): `Net_onboard_perc`, `Net_Onboard_score`, `Net_adopt_perc`, `Net_Adopt_score`, `Sec_*`, `Cloud_*` |
| Lifecycle chart data | SUMIFS by stage × portfolio, last 18 months |
| CPI Adopt chart data | Driven by dropdowns; HLOOKUP into portfolio×offer summary table |
| Week list | Current weeks filtered between 2026W11 and today, sorted descending |

---

## Key Business Rules

1. **One UC per offer per customer** — `CRPartyID-Offer` composite key used for deduplication throughout
2. **Opted-in UC takes priority** in all selection logic; otherwise, highest-incentive UC is selected
3. **Only one UC per offer can be opted-in** — tracked by `Offer opted-in?` flag
4. **PVI requires ≥5** to start earning CPI Adopt rebates
5. **A UC completing Adopt without opt-in becomes Not Eligible** — excluded from PVI calculations
6. **Incentive expiry** is tracked; `Expires <3M?` flags deals expiring within 3 months
7. **EA Flag** marks Enterprise Agreement deals
8. **PVI scope**: booking date within the **last 18 fiscal months** only

---

## Partner vs Distributor Mode

| | Partners | Distributors |
|--|---------|-------------|
| Workspan report | 19849 | 21766 |
| Load button | Load Partner File | Load Disti File |
| PVI sheet | Shows scores | Shows "N/A" (PVI not applicable to Distis) |
