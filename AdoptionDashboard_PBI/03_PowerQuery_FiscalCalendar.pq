// =============================================================================
// ADOPTION DASHBOARD — Power Query: FiscalCalendar
// =============================================================================
// PURPOSE : Provides the Cisco fiscal calendar used for:
//           • 18-month PVI lookback window
//           • Lifecycle chart fiscal month axis
//
// DATES  : Exact start/end dates extracted from the Ref sheet of the
//          Excel workbook (v5.1).  Covers FY24M1 through FY27M12.
//
// HOW TO USE:
//   Create a new Blank Query → Advanced Editor → paste this code.
//   Name the query:  FiscalCalendar
//   Load to:  Connection only  (referenced by the Data query)
//
// NOTE: The "Count" column is the sequential month number (1=FY24M1, 48=FY27M12).
//       This matches the column used in the original FiscalDates Excel query.
// =============================================================================

let
    // Serial date → Power Query date
    // Excel serial dates use epoch of 30-Dec-1899
    ToDate = (serial as number) as date => Date.AddDays(#date(1899, 12, 30), serial),

    // Exact serial dates from the Ref sheet of Adoption dashboard v5.1
    RawTable = #table(
        type table [
            #"Fiscal Month" = text,
            Start           = number,
            End             = number,
            Count           = Int64.Type
        ],
        {
            // ── FY24 ─────────────────────────────────────────────────────────
            {"FY24M1",  45137, 45164,  1},
            {"FY24M2",  45165, 45192,  2},
            {"FY24M3",  45193, 45227,  3},
            {"FY24M4",  45228, 45255,  4},
            {"FY24M5",  45256, 45283,  5},
            {"FY24M6",  45284, 45318,  6},
            {"FY24M7",  45319, 45346,  7},
            {"FY24M8",  45347, 45374,  8},
            {"FY24M9",  45375, 45409,  9},
            {"FY24M10", 45410, 45437, 10},
            {"FY24M11", 45438, 45465, 11},
            {"FY24M12", 45466, 45500, 12},
            // ── FY25 ─────────────────────────────────────────────────────────
            {"FY25M1",  45501, 45528, 13},
            {"FY25M2",  45529, 45556, 14},
            {"FY25M3",  45557, 45591, 15},
            {"FY25M4",  45592, 45619, 16},
            {"FY25M5",  45620, 45647, 17},
            {"FY25M6",  45648, 45682, 18},
            {"FY25M7",  45683, 45710, 19},
            {"FY25M8",  45711, 45738, 20},
            {"FY25M9",  45739, 45773, 21},
            {"FY25M10", 45774, 45801, 22},
            {"FY25M11", 45802, 45829, 23},
            {"FY25M12", 45830, 45864, 24},
            // ── FY26 ─────────────────────────────────────────────────────────
            {"FY26M1",  45865, 45892, 25},
            {"FY26M2",  45893, 45920, 26},
            {"FY26M3",  45921, 45955, 27},
            {"FY26M4",  45956, 45983, 28},
            {"FY26M5",  45984, 46011, 29},
            {"FY26M6",  46012, 46046, 30},
            {"FY26M7",  46047, 46074, 31},
            {"FY26M8",  46075, 46102, 32},
            {"FY26M9",  46103, 46137, 33},
            {"FY26M10", 46138, 46165, 34},
            {"FY26M11", 46166, 46193, 35},
            {"FY26M12", 46194, 46228, 36},
            // ── FY27 ─────────────────────────────────────────────────────────
            {"FY27M1",  46229, 46256, 37},
            {"FY27M2",  46257, 46284, 38},
            {"FY27M3",  46285, 46319, 39},
            {"FY27M4",  46320, 46347, 40},
            {"FY27M5",  46348, 46375, 41},
            {"FY27M6",  46376, 46410, 42},
            {"FY27M7",  46411, 46438, 43},
            {"FY27M8",  46439, 46466, 44},
            {"FY27M9",  46467, 46501, 45},
            {"FY27M10", 46502, 46529, 46},
            {"FY27M11", 46530, 46557, 47},
            {"FY27M12", 46558, 46599, 48}
        }
    ),

    // Convert serial numbers to proper date columns
    ConvertedDates = Table.TransformColumns(RawTable, {
        {"Start", each ToDate(_), type date},
        {"End",   each ToDate(_), type date}
    }),

    // Add FY and FM columns for convenience in Power BI visuals
    AddedFY = Table.AddColumn(ConvertedDates, "FY",
        each Text.Start([#"Fiscal Month"], 4),
        type text),
    AddedFM = Table.AddColumn(AddedFY, "FM",
        each Number.From(Text.Middle([#"Fiscal Month"], 5)),
        Int64.Type),

    // Final column order
    Reordered = Table.ReorderColumns(AddedFM, {
        "Fiscal Month", "FY", "FM", "Start", "End", "Count"
    })

in
    Reordered
