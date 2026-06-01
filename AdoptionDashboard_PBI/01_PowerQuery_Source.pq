// =============================================================================
// ADOPTION DASHBOARD — Power Query: Source
// =============================================================================
// PURPOSE : Load the raw Workspan export file and expose all 56 columns.
//           This replaces the "Source_tbl" named table in the Excel workbook.
//
// HOW TO USE IN POWER BI DESKTOP:
//   1. Home → Transform Data → Manage Parameters → New Parameter
//      Name: WorkspanFilePath  |  Type: Text  |  Default: your file path
//   2. Home → New Source → Blank Query → Advanced Editor → paste this code
//   3. Name the query:  Source
//
// SUPPORTED MODES:
//   • Partner    — Workspan report 19849
//   • Distributor — Workspan report 21766
//   Both use the same column structure; set WorkspanFilePath to whichever
//   export you want to load.
// =============================================================================

let
    // ── File load ────────────────────────────────────────────────────────────
    // Replace the path below, or create a "WorkspanFilePath" parameter and
    // reference it as:  WorkspanFilePath
    FilePath = "C:\Path\To\Your\Workspan_Export.xlsx",   // <── edit or use parameter

    RawWorkbook   = Excel.Workbook(File.Contents(FilePath), null, true),
    RawSheet      = RawWorkbook{[Item="Sheet1", Kind="Sheet"]}[Data],   // <── match your sheet name
    PromotedHdrs  = Table.PromoteHeaders(RawSheet, [PromoteAllScalars=true]),

    // ── Select the 56 expected source columns ────────────────────────────────
    // If Workspan adds/removes columns in a future report, only this list needs updating.
    Selected = Table.SelectColumns(PromotedHdrs, {
        "Deal WS-ID",
        "Partner Name",
        "BE GEO ID",
        "Partner Country",
        "Partner Region",
        "CR Party Name",
        "CR Party ID",
        "Program Type",
        "Track",                                        // = Offer
        "Sub-Track",                                    // = Use Case
        "Incentive Level",
        "Deal Incentive Expiry Date",
        "Booking Date",
        "Booking Amount - Net to Cisco",
        "Booking Amount - Net to Cisco (Currency)",
        "Stage",                                        // Eligible / Expired / Not Eligible
        "Adopt Rebate Opt-In Status",                   // Opted In / Opted Out / Pending
        "Adopt Rebate Start Date",
        "Stage Completion Flag (Purchase)",
        "Stage Completion Date (Purchase)",
        "Stage Completion Flag(onboard)",
        "Stage Completion Date(onboard)",
        "Stage Completion Flag (Implement)",
        "Stage Completion Date (Implement)",
        "Stage Completion Flag(Use)",
        "Stage Completion Date(Use)",
        "Stage Completion Flag(Engage)",
        "Stage Completion Date(Engage)",
        "Stage Completion Flag(Adopt)",
        "Stage Completion Date(Adopt)",
        "Estimated Incentive Amount(Onboard)",
        "Estimated Incentive Amount(Onboard) (Currency)",
        "Estimated Incentive Amount(Use)",
        "Estimated Incentive Amount(Use) (Currency)",
        "Estimated Incentive Amount(Engage)",
        "Estimated Incentive Amount(Engage) (Currency)",
        "Estimated Incentive Amount(Adopt)",
        "Estimated Incentive Amount(Adopt) (Currency)",
        "Revised Maximum Incentive Amount",
        "Revised Maximum Incentive Amount (Currency)",
        "Task Details (Purchase)",
        "Task Details (Onboard)",
        "Task Details (Implement)",
        "Task Details (Use)",
        "Task Details (Engage)",
        "Task Details (Adopt)",
        "Maximum Incentive Deal Flag",                  // Pre-computed by Workspan
        "EA Flag",
        "Deal ID",
        "Deal CPI Portfolio",                           // Networking / Security / Cloud + AI Infrastructure / Collaboration
        "CX Customer BU ID",
        "Plan Name",
        "Cisco Relationship",
        "2T Partner Name",
        "2T Partner BE GEO ID",
        "Deal Name"
    }),

    // ── Fix known offer name change (Workspan renamed this offer) ────────────
    FixedOfferName = Table.ReplaceValue(
        Selected,
        "Integrated Secure Operations",
        "Cisco Secure Network Analytics",
        Replacer.ReplaceText,
        {"Track"}
    ),

    // ── Type all columns ─────────────────────────────────────────────────────
    TypedTable = Table.TransformColumnTypes(FixedOfferName, {
        {"Deal WS-ID",                               type text},
        {"Partner Name",                             type text},
        {"BE GEO ID",                                type text},
        {"Partner Country",                          type text},
        {"Partner Region",                           type text},
        {"CR Party Name",                            type text},
        {"CR Party ID",                              type text},
        {"Program Type",                             type text},
        {"Track",                                    type text},
        {"Sub-Track",                                type text},
        {"Incentive Level",                          type text},
        {"Deal Incentive Expiry Date",               type date},
        {"Booking Date",                             type date},
        {"Booking Amount - Net to Cisco",            type number},
        {"Booking Amount - Net to Cisco (Currency)", type text},
        {"Stage",                                    type text},
        {"Adopt Rebate Opt-In Status",               type text},
        {"Adopt Rebate Start Date",                  type date},
        {"Stage Completion Flag (Purchase)",         type text},
        {"Stage Completion Date (Purchase)",         type date},
        {"Stage Completion Flag(onboard)",           type text},
        {"Stage Completion Date(onboard)",           type date},
        {"Stage Completion Flag (Implement)",        type text},
        {"Stage Completion Date (Implement)",        type date},
        {"Stage Completion Flag(Use)",               type text},
        {"Stage Completion Date(Use)",               type date},
        {"Stage Completion Flag(Engage)",            type text},
        {"Stage Completion Date(Engage)",            type date},
        {"Stage Completion Flag(Adopt)",             type text},
        {"Stage Completion Date(Adopt)",             type date},
        {"Estimated Incentive Amount(Onboard)",      type number},
        {"Estimated Incentive Amount(Onboard) (Currency)", type text},
        {"Estimated Incentive Amount(Use)",          type number},
        {"Estimated Incentive Amount(Use) (Currency)", type text},
        {"Estimated Incentive Amount(Engage)",       type number},
        {"Estimated Incentive Amount(Engage) (Currency)", type text},
        {"Estimated Incentive Amount(Adopt)",        type number},
        {"Estimated Incentive Amount(Adopt) (Currency)", type text},
        {"Revised Maximum Incentive Amount",         type number},
        {"Revised Maximum Incentive Amount (Currency)", type text},
        {"Task Details (Purchase)",                  type text},
        {"Task Details (Onboard)",                   type text},
        {"Task Details (Implement)",                 type text},
        {"Task Details (Use)",                       type text},
        {"Task Details (Engage)",                    type text},
        {"Task Details (Adopt)",                     type text},
        {"Maximum Incentive Deal Flag",              type text},
        {"EA Flag",                                  type text},
        {"Deal ID",                                  type text},
        {"Deal CPI Portfolio",                       type text},
        {"CX Customer BU ID",                        type text},
        {"Plan Name",                                type text},
        {"Cisco Relationship",                       type text},
        {"2T Partner Name",                          type text},
        {"2T Partner BE GEO ID",                     type text},
        {"Deal Name",                                type text}
    })

in
    TypedTable
