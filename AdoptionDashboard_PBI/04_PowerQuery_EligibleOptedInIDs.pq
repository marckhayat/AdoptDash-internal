// =============================================================================
// ADOPTION DASHBOARD — Power Query: EligibleOptedInIDs  (helper query)
// =============================================================================
// PURPOSE : Produces the distinct set of CRPartyID-Offer keys where at least
//           one Use Case has "Opted In" status.  Used by the Data query (step 11)
//           to compute the "Offer opted-in?" flag via a left-outer join.
//
//           This is a direct copy of the Excel workbook's EligibleOptedInIDs query.
//
// DEPENDS ON:  Data  (query 02) — specifically the Data query BEFORE the join step.
//             ⚠️  In Power BI, create this as a separate query that references
//             the Data query steps UP TO (but not including) the "Offer opted-in?"
//             column addition.  The simplest approach is to reference Source and
//             apply only the minimum transforms needed (CRPartyID-Offer + opt-in status).
//
// HOW TO USE:
//   Create a new Blank Query → Advanced Editor → paste this code.
//   Name the query:  EligibleOptedInIDs
//   Load to:  Connection only
// =============================================================================

let
    // Reference the Source table (already typed in query 01)
    Source_tbl = Source,

    // Add the CRPartyID-Offer key (same logic as Data query step 2)
    AddedKey = Table.AddColumn(Source_tbl, "CRPartyID-Offer",
        each Text.From([CR Party ID]) & [Track],
        type text),

    // Keep only rows where the UC is Opted In
    FilteredOptedIn = Table.SelectRows(AddedKey,
        each [#"Adopt Rebate Opt-In Status"] = "Opted In"),

    // Distinct CRPartyID-Offer keys
    SelectedKey = Table.SelectColumns(FilteredOptedIn, {"CRPartyID-Offer"}),
    Deduplicated = Table.Distinct(SelectedKey)

in
    Deduplicated
