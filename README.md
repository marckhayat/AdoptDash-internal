# Adoption Dashboard

A browser-based analytics tool for Cisco partners to track and optimize **CPI Adopt** rebate performance by analyzing software adoption data from Workspan.

> ⚠️ This tool is independently developed and is **not an official Cisco product**. Provided "as is" without warranty. Partners are responsible for verifying all data and results.

---

## What It Does

The Adoption Dashboard helps Cisco partners:

- Identify **eligible use cases** for CPI Adopt rebates
- Track **opt-in status** and incentive performance across deals
- Analyze **earned, potential, and missed incentives** by portfolio
- Monitor **monthly adoption trends** and lifecycle progression
- Calculate **Partner Value Index (PVI)** Engagement scores

---

## Features

| Tab | Description |
|-----|-------------|
| **Overview** | Summary pivot by Portfolio → Offer → Use Case |
| **Details** | Row-level deal view with inline definitions |
| **PVI** | Partner Value Index Engagement score calculator |
| **Lifecycle** | Offer lifecycle progression charts (last 18 months) |
| **CPI Adopt** | Incentive performance charts — earned, potential, missed, opt-in ratios |

---

## Getting Started

1. **Open the app** at [marckhayat.github.io/AdoptDash](https://marckhayat.github.io/AdoptDash/) — always the latest version, no install needed
2. **Or download** the latest release from the [Releases](https://github.com/marckhayat/AdoptDash/releases/latest) page and open `index.html` locally
3. **Load your CPI data file** — a Workspan export (report 19849 for Partners, 21766 for Distributors)
4. Explore your data across the dashboard tabs

> The app runs entirely in your browser. No data is sent to any server.

---

## Data Source

The dashboard loads data from a **Workspan export** (report 19849 for Partners, 21766 for Distributors). Data can be loaded by:

- **File upload** — drag and drop or browse for a CSV/Excel Workspan export
- **API** — connect directly to Workspan APIs to pull data without manual exports

---

## Requirements

- A modern browser (Chrome recommended for the best experience)
- The app loads several libraries from CDN (Bootstrap, Chart.js, SheetJS, xlsx-js-style, PapaParse). Without internet, the app will not load.

---

## Releases & Updates

The app automatically checks for new versions on load and notifies you if an update is available. This check only queries the public GitHub Releases API to compare version numbers — no usage data, user information, or IP addresses are ever collected or transmitted.

All releases are available on the [Releases](https://github.com/marckhayat/AdoptDash/releases) page, each with a downloadable ZIP of the full app.

---

## Disclaimer

This tool is independently developed by a Cisco employee and is **not an official Cisco product**. It is not supported by Cisco TAC. Use it at your own discretion and always verify results against official Workspan data.

---

## Community & Support

- 💬 **Community page:** [cs.co/AdoptDash](https://cs.co/AdoptDash)
- 📝 **Feedback & Support:** [cs.co/PartnerCSS](http://cs.co/PartnerCSS)
