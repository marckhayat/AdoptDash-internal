// =============================================================================
// ADOPTION DASHBOARD — Power Query: PVI_Brackets
// =============================================================================
// PURPOSE : PVI step-scoring lookup table.
//           Exact values extracted from the Ref sheet of Adoption dashboard v5.1.
//
// HOW TO USE:
//   Create a new Blank Query → Advanced Editor → paste this code.
//   Name the query:  PVI_Brackets
//   Load to:  Connection only  (referenced by DAX measures)
//
// STRUCTURE:
//   Domain     — "Networking" | "Security" | "Cloud + AI Infrastructure"
//   Metric     — "Onboard" | "Adopt"
//   Score      — integer 1–10
//   MinRatio   — minimum ratio (as decimal) needed to reach this score
//
// SCORING LOGIC (mirrors Excel XLOOKUP with match_mode=1, search_mode=1):
//   Find the row where MinRatio is the smallest value >= the actual ratio.
//   All three domains share identical bracket values.
//
// ONBOARD brackets:
//   Score 1  → any ratio >= -0.01  (i.e. any eligible booking exists)
//   Score 2  → ratio >= 10%
//   Score 3  → ratio >= 15%
//   ...
//   Score 10 → no upper threshold (default when ratio >= 45%)
//
// ADOPT brackets (back-loaded — scores 1-4 share the same low threshold):
//   Scores 1-4 → any ratio >= -0.01
//   Score 5  → ratio >= 3%
//   Score 6  → ratio >= 6%
//   ...
//   Score 10 → no upper threshold (default when ratio >= 15%)
// =============================================================================

let
    BracketTable = #table(
        type table [
            Domain   = text,
            Metric   = text,
            Score    = Int64.Type,
            MinRatio = number
        ],
        {
            // ── NETWORKING — ONBOARD ─────────────────────────────────────────
            {"Networking", "Onboard",  1, -0.01},
            {"Networking", "Onboard",  2,  0.10},
            {"Networking", "Onboard",  3,  0.15},
            {"Networking", "Onboard",  4,  0.20},
            {"Networking", "Onboard",  5,  0.25},
            {"Networking", "Onboard",  6,  0.30},
            {"Networking", "Onboard",  7,  0.35},
            {"Networking", "Onboard",  8,  0.40},
            {"Networking", "Onboard",  9,  0.45},
            {"Networking", "Onboard", 10,  1.01},  // sentinel: score 10 is the XLOOKUP default

            // ── NETWORKING — ADOPT ───────────────────────────────────────────
            {"Networking", "Adopt",  1, -0.01},
            {"Networking", "Adopt",  2, -0.01},
            {"Networking", "Adopt",  3, -0.01},
            {"Networking", "Adopt",  4, -0.01},
            {"Networking", "Adopt",  5,  0.03},
            {"Networking", "Adopt",  6,  0.06},
            {"Networking", "Adopt",  7,  0.09},
            {"Networking", "Adopt",  8,  0.12},
            {"Networking", "Adopt",  9,  0.15},
            {"Networking", "Adopt", 10,  1.01},

            // ── SECURITY — ONBOARD ───────────────────────────────────────────
            {"Security", "Onboard",  1, -0.01},
            {"Security", "Onboard",  2,  0.10},
            {"Security", "Onboard",  3,  0.15},
            {"Security", "Onboard",  4,  0.20},
            {"Security", "Onboard",  5,  0.25},
            {"Security", "Onboard",  6,  0.30},
            {"Security", "Onboard",  7,  0.35},
            {"Security", "Onboard",  8,  0.40},
            {"Security", "Onboard",  9,  0.45},
            {"Security", "Onboard", 10,  1.01},

            // ── SECURITY — ADOPT ─────────────────────────────────────────────
            {"Security", "Adopt",  1, -0.01},
            {"Security", "Adopt",  2, -0.01},
            {"Security", "Adopt",  3, -0.01},
            {"Security", "Adopt",  4, -0.01},
            {"Security", "Adopt",  5,  0.03},
            {"Security", "Adopt",  6,  0.06},
            {"Security", "Adopt",  7,  0.09},
            {"Security", "Adopt",  8,  0.12},
            {"Security", "Adopt",  9,  0.15},
            {"Security", "Adopt", 10,  1.01},

            // ── CLOUD + AI INFRASTRUCTURE — ONBOARD ──────────────────────────
            {"Cloud + AI Infrastructure", "Onboard",  1, -0.01},
            {"Cloud + AI Infrastructure", "Onboard",  2,  0.10},
            {"Cloud + AI Infrastructure", "Onboard",  3,  0.15},
            {"Cloud + AI Infrastructure", "Onboard",  4,  0.20},
            {"Cloud + AI Infrastructure", "Onboard",  5,  0.25},
            {"Cloud + AI Infrastructure", "Onboard",  6,  0.30},
            {"Cloud + AI Infrastructure", "Onboard",  7,  0.35},
            {"Cloud + AI Infrastructure", "Onboard",  8,  0.40},
            {"Cloud + AI Infrastructure", "Onboard",  9,  0.45},
            {"Cloud + AI Infrastructure", "Onboard", 10,  1.01},

            // ── CLOUD + AI INFRASTRUCTURE — ADOPT ────────────────────────────
            {"Cloud + AI Infrastructure", "Adopt",  1, -0.01},
            {"Cloud + AI Infrastructure", "Adopt",  2, -0.01},
            {"Cloud + AI Infrastructure", "Adopt",  3, -0.01},
            {"Cloud + AI Infrastructure", "Adopt",  4, -0.01},
            {"Cloud + AI Infrastructure", "Adopt",  5,  0.03},
            {"Cloud + AI Infrastructure", "Adopt",  6,  0.06},
            {"Cloud + AI Infrastructure", "Adopt",  7,  0.09},
            {"Cloud + AI Infrastructure", "Adopt",  8,  0.12},
            {"Cloud + AI Infrastructure", "Adopt",  9,  0.15},
            {"Cloud + AI Infrastructure", "Adopt", 10,  1.01}
        }
    )

in
    BracketTable
