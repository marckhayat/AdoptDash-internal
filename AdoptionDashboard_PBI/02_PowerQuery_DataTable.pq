// =============================================================================
// ADOPTION DASHBOARD — Power Query: Data  (main transformation query)
// =============================================================================
// PURPOSE : Transforms the Source table into the full computed Data table.
//           This is a direct adaptation of the Excel workbook's "Data_Base"
//           and "Data" queries, merged into one Power BI query.
//
// DEPENDS ON:  Source  (query 01)
//              FiscalCalendar  (query 03)
//
// HOW TO USE:
//   Create a new Blank Query, open Advanced Editor, paste this code.
//   Name the query:  Data
//   Load to:  Report (this will be your main fact table)
// =============================================================================

let
    // =========================================================================
    // HELPER FUNCTIONS  (adapted directly from the workbook's Data query)
    // =========================================================================

    // Normalize text: trim, remove non-breaking spaces, uppercase
    NormalizeText = (x as any) as text =>
        let
            t0 = try Text.From(x) otherwise "",
            t1 = Text.Replace(t0, Character.FromNumber(160), " "),
            t2 = Text.Trim(t1),
            up = Text.Upper(t2)
        in up,

    SafeText = NormalizeText,

    // Coerce any value to logical (handles text "TRUE"/"YES"/"1")
    SafeBool = (x as any) as logical =>
        let
            v   = try x,
            val = if v[HasError] then null else v[Value]
        in
            if val = null then false
            else if Value.Is(val, type logical) then val
            else
                let s = SafeText(val) in (s = "TRUE") or (s = "YES") or (s = "1"),

    // Coerce any value to number, defaulting to 0 on error
    SafeNum = (x as any) as number =>
        let n = try Number.From(x) in if n[HasError] then 0 else n[Value],

    // Safe date conversion
    ToDate = (x as any) as nullable date =>
        try Date.From(x) otherwise null,

    // Compare dates: a >= b (both must be non-null)
    DateGT = (a as any, b as any) as logical =>
        let
            da = try Date.From(a) otherwise null,
            db = try Date.From(b) otherwise null
        in da <> null and db <> null and da >= db,

    // Compare dates: a < b (both must be non-null)
    DateLT = (a as any, b as any) as logical =>
        let
            da = try Date.From(a) otherwise null,
            db = try Date.From(b) otherwise null
        in da <> null and db <> null and da < db,

    // Extract pending tasks from a Task Details text block.
    // Task Details format: "Task name - Y" or "Task name - N" per task.
    fxGetPendingTasks = (sourceValue as any) as nullable text =>
        if sourceValue = null or not (sourceValue is text) or Text.Trim(sourceValue) = ""
        then null
        else
            let
                tempText    = Text.Replace(
                                  Text.Replace(sourceValue, " - Y", " - Y#|#"),
                                  " - N", " - N#|#"),
                taskList    = Text.Split(tempText, "#|#"),
                pending     = List.Select(taskList, each Text.EndsWith(Text.Trim(_), " - N")),
                result      = Text.Combine(pending, "; ")
            in
                if result = "" then null else result,

    // =========================================================================
    // FISCAL CALENDAR WINDOW  (18-month PVI lookback)
    // =========================================================================
    Today         = Date.From(DateTime.LocalNow()),
    CurrentFMRow  = Table.SelectRows(FiscalCalendar, each [Start] <= Today and [End] >= Today),
    CurrentCount  = try CurrentFMRow{0}[Count] otherwise null,
    TargetCount   = if CurrentCount <> null then CurrentCount - 17 else null,
    Month18AgoRow = if TargetCount <> null
                    then Table.SelectRows(FiscalCalendar, each [Count] = TargetCount)
                    else #table({"Start"}, {}),
    Month18AgoStart = try Month18AgoRow{0}[Start] otherwise null,

    // =========================================================================
    // STEP 1 — BASE TABLE  (from Source query)
    // Drop columns not needed downstream; fix types already set in Source.
    // =========================================================================
    Source_tbl = Source,

    // Remove columns not carried into the Data table
    Base = Table.RemoveColumns(Source_tbl, {
        "Partner Name",
        "Partner Country",
        "Partner Region",
        "Program Type",
        "Booking Amount - Net to Cisco (Currency)",
        "Estimated Incentive Amount(Onboard) (Currency)",
        "Estimated Incentive Amount(Use) (Currency)",
        "Estimated Incentive Amount(Engage) (Currency)",
        "Estimated Incentive Amount(Adopt) (Currency)",
        "Revised Maximum Incentive Amount (Currency)"
    }),

    // =========================================================================
    // STEP 2 — ADD CRPartyID-Offer  (composite dedup key)
    // =========================================================================
    AddedKey = Table.AddColumn(Base, "CRPartyID-Offer",
        each Text.From([CR Party ID]) & [Track],
        type text),

    // =========================================================================
    // STEP 3 — ADD OriginalIndex
    // =========================================================================
    AddedIndex = Table.AddIndexColumn(AddedKey, "OriginalIndex", 1, 1, Int64.Type),

    // =========================================================================
    // STEP 4 — ADD Current stage  (6-stage progression logic)
    // Stage is the NEXT uncompleted stage after the last completed one.
    // =========================================================================
    AddedCurrentStage = Table.AddColumn(AddedIndex, "Current stage",
        each
            try
                if      [#"Stage Completion Flag(Adopt)"]       = "Yes" then "Completed"
                else if [#"Stage Completion Flag(Engage)"]      = "Yes" then "Adopt"
                else if [#"Stage Completion Flag(Use)"]         = "Yes" then "Engage"
                else if [#"Stage Completion Flag (Implement)"]  = "Yes" then "Use"
                else if [#"Stage Completion Flag(onboard)"]     = "Yes" then "Implement"
                else if [#"Stage Completion Flag (Purchase)"]   = "Yes" then "Onboard"
                else "Purchase"
            otherwise "N/A",
        type text),

    // =========================================================================
    // STEP 5 — STAGE PROGRESS  (X/Y completed tasks per stage)
    // Task Details columns format: "Task label - Y" or "Task label - N"
    // =========================================================================

    // Helper: count completed (Y) and total tasks from a Task Details cell
    CalcProgress = (textValue as any) as text =>
        let
            yCount     = if textValue <> null and (textValue is text)
                         then List.Count(Text.Split(textValue, " - Y")) - 1 else 0,
            nCount     = if textValue <> null and (textValue is text)
                         then List.Count(Text.Split(textValue, " - N")) - 1 else 0,
            totalCount = yCount + nCount
        in
            if totalCount = 0 then "0/0" else Text.From(yCount) & "/" & Text.From(totalCount),

    AddedPurchaseProgress  = Table.AddColumn(AddedCurrentStage,    "Purchase Progress",  each CalcProgress([#"Task Details (Purchase)"]),  type text),
    AddedPendingPurchase   = Table.AddColumn(AddedPurchaseProgress, "Pending Tasks Purchase",  each fxGetPendingTasks([#"Task Details (Purchase)"]),  type text),
    AddedOnboardProgress   = Table.AddColumn(AddedPendingPurchase,  "Onboard Progress",   each CalcProgress([#"Task Details (Onboard)"]),   type text),
    AddedPendingOnboard    = Table.AddColumn(AddedOnboardProgress,  "Pending Tasks Onboard",   each fxGetPendingTasks([#"Task Details (Onboard)"]),   type text),
    AddedImplementProgress = Table.AddColumn(AddedPendingOnboard,   "Implement Progress", each CalcProgress([#"Task Details (Implement)"]), type text),
    AddedPendingImplement  = Table.AddColumn(AddedImplementProgress,"Pending Tasks Implement", each fxGetPendingTasks([#"Task Details (Implement)"]), type text),
    AddedUseProgress       = Table.AddColumn(AddedPendingImplement, "Use Progress",       each CalcProgress([#"Task Details (Use)"]),       type text),
    AddedPendingUse        = Table.AddColumn(AddedUseProgress,      "Pending Tasks Use",       each fxGetPendingTasks([#"Task Details (Use)"]),       type text),
    AddedEngageProgress    = Table.AddColumn(AddedPendingUse,       "Engage Progress",    each CalcProgress([#"Task Details (Engage)"]),    type text),
    AddedPendingEngage     = Table.AddColumn(AddedEngageProgress,   "Pending Engage Tasks",    each fxGetPendingTasks([#"Task Details (Engage)"]),    type text),
    AddedAdoptProgress     = Table.AddColumn(AddedPendingEngage,    "Adopt Progress",     each CalcProgress([#"Task Details (Adopt)"]),     type text),
    AddedPendingAdopt      = Table.AddColumn(AddedAdoptProgress,    "Pending Adopt Tasks",     each fxGetPendingTasks([#"Task Details (Adopt)"]),     type text),

    // Current Stage Progress = the progress column for the active stage
    AddedCurrentProgress = Table.AddColumn(AddedPendingAdopt, "Current Stage Progress",
        each
            if      [Current stage] = "Purchase"  then [Purchase Progress]
            else if [Current stage] = "Onboard"   then [Onboard Progress]
            else if [Current stage] = "Implement" then [Implement Progress]
            else if [Current stage] = "Use"        then [Use Progress]
            else if [Current stage] = "Engage"     then [Engage Progress]
            else if [Current stage] = "Adopt"      then [Adopt Progress]
            else if [Current stage] = "Completed"  then "N/A"
            else null,
        type text),

    // Current stage pending tasks = the pending tasks for the active stage
    AddedCurrentPending = Table.AddColumn(AddedCurrentProgress, "Current stage pending tasks",
        each
            if      [Current stage] = "Purchase"  then [Pending Tasks Purchase]
            else if [Current stage] = "Onboard"   then [Pending Tasks Onboard]
            else if [Current stage] = "Implement" then [Pending Tasks Implement]
            else if [Current stage] = "Use"        then [Pending Tasks Use]
            else if [Current stage] = "Engage"     then [Pending Engage Tasks]
            else if [Current stage] = "Adopt"      then [Pending Adopt Tasks]
            else null,
        type text),

    // =========================================================================
    // STEP 6 — REPLACE NULL FLAGS WITH "NULL" (matches Excel behaviour)
    // =========================================================================
    ReplacedNullFlags = Table.ReplaceValue(
        AddedCurrentPending,
        null, "NULL",
        Replacer.ReplaceValue,
        {
            "Stage Completion Flag (Purchase)",
            "Stage Completion Flag(onboard)",
            "Stage Completion Flag (Implement)",
            "Stage Completion Flag(Use)",
            "Stage Completion Flag(Engage)",
            "Stage Completion Flag(Adopt)"
        }
    ),

    // =========================================================================
    // STEP 7 — DROP intermediate task-progress columns (no longer needed)
    // =========================================================================
    DroppedIntermediateCols = Table.RemoveColumns(ReplacedNullFlags, {
        "Task Details (Purchase)", "Task Details (Onboard)", "Task Details (Implement)",
        "Task Details (Use)",      "Task Details (Engage)",  "Task Details (Adopt)",
        "Purchase Progress",       "Pending Tasks Purchase",
        "Onboard Progress",        "Pending Tasks Onboard",
        "Implement Progress",      "Pending Tasks Implement",
        "Use Progress",            "Pending Tasks Use",
        "Engage Progress",         "Pending Engage Tasks",
        "Adopt Progress",          "Pending Adopt Tasks"
    }),

    // =========================================================================
    // STEP 8 — DAYS IN STAGE
    // Start date depends on which stage is current.
    // =========================================================================
    AddedDaysInStage = Table.AddColumn(DroppedIntermediateCols, "Days in stage",
        each
            let
                TodayVal  = Date.From(DateTime.LocalNow()),
                Stage     = [Current stage],
                StartDate =
                    if      Stage = "Purchase"  then ToDate([Booking Date])
                    else if Stage = "Onboard"   then ToDate([#"Stage Completion Date (Purchase)"])
                    else if Stage = "Implement" then ToDate([#"Stage Completion Date(onboard)"])
                    else if Stage = "Use"        then ToDate([#"Stage Completion Date (Implement)"])
                    else if Stage = "Engage"     then ToDate([#"Stage Completion Date(Use)"])
                    else if Stage = "Adopt"      then ToDate([#"Stage Completion Date(Engage)"])
                    else if Stage = "Completed"  then ToDate([#"Stage Completion Date(Adopt)"])
                    else null
            in
                if StartDate <> null then Duration.Days(TodayVal - StartDate) else null,
        Int64.Type),

    // =========================================================================
    // STEP 9 — 1st stage?
    // Collaboration offers (Webex Suite, Cisco Contact Center) use Use as the
    // first earning stage; all others use Onboard.
    // =========================================================================
    Added1stStage = Table.AddColumn(AddedDaysInStage, "1st stage?",
        each
            if SafeText([Track]) = "WEBEX SUITE" or SafeText([Track]) = "CISCO CONTACT CENTER"
            then SafeText([#"Stage Completion Flag(Use)"]) = "YES"
            else SafeText([#"Stage Completion Flag(onboard)"]) = "YES",
        type logical),

    // =========================================================================
    // STEP 10 — Expires <3M?
    // =========================================================================
    AddedExpires = Table.AddColumn(Added1stStage, "Expires <3M?",
        each
            try
                if ToDate([Deal Incentive Expiry Date]) < Date.AddMonths(Date.From(DateTime.LocalNow()), 3)
                then "Yes" else "No"
            otherwise "No",
        type text),

    // =========================================================================
    // STEP 11 — Offer opted-in?
    // Join against EligibleOptedInIDs (the set of CRPartyID-Offer keys where
    // any UC has Opted In status).  Left outer join — match = opted in.
    // =========================================================================
    MergedOptedIn = Table.NestedJoin(
        AddedExpires,
        {"CRPartyID-Offer"},
        EligibleOptedInIDs,
        {"CRPartyID-Offer"},
        "EligibleOptedInIDs",
        JoinKind.LeftOuter
    ),
    ExpandedOptedIn = Table.ExpandTableColumn(
        MergedOptedIn,
        "EligibleOptedInIDs",
        {"CRPartyID-Offer"},
        {"EligibleOptedInIDs.CRPartyID-Offer"}
    ),
    AddedOfferOptedIn = Table.AddColumn(ExpandedOptedIn, "Offer opted-in?",
        each [#"EligibleOptedInIDs.CRPartyID-Offer"] <> null,
        type logical),

    // =========================================================================
    // STEP 12 — Missed Incentives
    // Stages are: Onboard, Use, Engage, Adopt (4 earning stages, not Purchase).
    // partA: not opted-in at all → all completed stage incentives are missed.
    // partB: opted-in AFTER stage completion → those stage incentives are missed.
    // =========================================================================
    AddedMissed = Table.AddColumn(AddedOfferOptedIn, "Missed Incentives",
        each
            try
                let
                    book     = [#"Booking Date"],
                    lciStart = [#"Adopt Rebate Start Date"],
                    partA =
                        (if SafeText([#"Stage Completion Flag(onboard)"])    = "YES" and DateGT([#"Stage Completion Date(onboard)"],    book) then SafeNum([#"Estimated Incentive Amount(Onboard)"]) else 0)
                      + (if SafeText([#"Stage Completion Flag(Use)"])        = "YES" and DateGT([#"Stage Completion Date(Use)"],        book) then SafeNum([#"Estimated Incentive Amount(Use)"])    else 0)
                      + (if SafeText([#"Stage Completion Flag(Engage)"])     = "YES" and DateGT([#"Stage Completion Date(Engage)"],     book) then SafeNum([#"Estimated Incentive Amount(Engage)"]) else 0)
                      + (if SafeText([#"Stage Completion Flag(Adopt)"])      = "YES" and DateGT([#"Stage Completion Date(Adopt)"],      book) then SafeNum([#"Estimated Incentive Amount(Adopt)"])  else 0),
                    missedA = if SafeText([#"Adopt Rebate Opt-In Status"]) <> "OPTED IN" then partA else 0,
                    partB =
                        (if SafeText([#"Stage Completion Flag(onboard)"])    = "YES" and DateLT([#"Stage Completion Date(onboard)"],    lciStart) and DateGT([#"Stage Completion Date(onboard)"],    book) then SafeNum([#"Estimated Incentive Amount(Onboard)"]) else 0)
                      + (if SafeText([#"Stage Completion Flag(Use)"])        = "YES" and DateLT([#"Stage Completion Date(Use)"],        lciStart) and DateGT([#"Stage Completion Date(Use)"],        book) then SafeNum([#"Estimated Incentive Amount(Use)"])    else 0)
                      + (if SafeText([#"Stage Completion Flag(Engage)"])     = "YES" and DateLT([#"Stage Completion Date(Engage)"],     lciStart) and DateGT([#"Stage Completion Date(Engage)"],     book) then SafeNum([#"Estimated Incentive Amount(Engage)"]) else 0)
                      + (if SafeText([#"Stage Completion Flag(Adopt)"])      = "YES" and DateLT([#"Stage Completion Date(Adopt)"],      lciStart) and DateGT([#"Stage Completion Date(Adopt)"],      book) then SafeNum([#"Estimated Incentive Amount(Adopt)"])  else 0),
                    missedB = if SafeText([#"Adopt Rebate Opt-In Status"]) = "OPTED IN" then partB else 0
                in
                    missedA + missedB
            otherwise 0),

    // =========================================================================
    // STEP 13 — Potential Incentives
    // Sum of earning-stage incentives not yet completed, for Eligible deals.
    // =========================================================================
    AddedPotential = Table.AddColumn(AddedMissed, "Potential Incentives",
        each
            try
                let eligible = SafeText([Stage]) = "ELIGIBLE" in
                  (if eligible and SafeText([#"Stage Completion Flag(onboard)"]) <> "YES" then SafeNum([#"Estimated Incentive Amount(Onboard)"]) else 0)
                + (if eligible and SafeText([#"Stage Completion Flag(Use)"])     <> "YES" then SafeNum([#"Estimated Incentive Amount(Use)"])    else 0)
                + (if eligible and SafeText([#"Stage Completion Flag(Engage)"])  <> "YES" then SafeNum([#"Estimated Incentive Amount(Engage)"]) else 0)
                + (if eligible and SafeText([#"Stage Completion Flag(Adopt)"])   <> "YES" then SafeNum([#"Estimated Incentive Amount(Adopt)"])  else 0)
            otherwise 0),

    // =========================================================================
    // STEP 14 — Estimated Earned Incentives
    // Opted-in UCs where a stage was completed AFTER opt-in and BEFORE expiry.
    // =========================================================================
    AddedEstEarned = Table.AddColumn(AddedPotential, "Estimated Earned Incentives",
        each
            try
                let
                    isEligible  = SafeText([#"Adopt Rebate Opt-In Status"]) = "OPTED IN"
                                  and SafeText([Stage]) <> "NOT ELIGIBLE",
                    lciStart    = [#"Adopt Rebate Start Date"],
                    expiryDate  = [#"Deal Incentive Expiry Date"]
                in
                  (if isEligible and SafeText([#"Stage Completion Flag(onboard)"]) = "YES" and DateGT([#"Stage Completion Date(onboard)"], lciStart) and DateLT([#"Stage Completion Date(onboard)"], expiryDate) then SafeNum([#"Estimated Incentive Amount(Onboard)"]) else 0)
                + (if isEligible and SafeText([#"Stage Completion Flag(Use)"])     = "YES" and DateGT([#"Stage Completion Date(Use)"],     lciStart) and DateLT([#"Stage Completion Date(Use)"],     expiryDate) then SafeNum([#"Estimated Incentive Amount(Use)"])    else 0)
                + (if isEligible and SafeText([#"Stage Completion Flag(Engage)"])  = "YES" and DateGT([#"Stage Completion Date(Engage)"],  lciStart) and DateLT([#"Stage Completion Date(Engage)"],  expiryDate) then SafeNum([#"Estimated Incentive Amount(Engage)"]) else 0)
                + (if isEligible and SafeText([#"Stage Completion Flag(Adopt)"])   = "YES" and DateGT([#"Stage Completion Date(Adopt)"],   lciStart) and DateLT([#"Stage Completion Date(Adopt)"],   expiryDate) then SafeNum([#"Estimated Incentive Amount(Adopt)"])  else 0)
            otherwise 0),

    // =========================================================================
    // STEP 15 — Earned?
    // =========================================================================
    AddedEarned = Table.AddColumn(AddedEstEarned, "Earned?",
        each try SafeNum([#"Estimated Earned Incentives"]) > 0 otherwise false,
        type logical),

    // =========================================================================
    // STEP 16 — UC 25-50% eligible w/o opt-in
    // Offer NOT opted-in + 1st earning stage complete + Engage NOT complete + Eligible
    // =========================================================================
    AddedUC2550 = Table.AddColumn(AddedEarned, "UC 25-50% eligible w/o opt-in",
        each
            try
                let
                    optOut       = not SafeBool([#"Offer opted-in?"]),
                    firstStage   = SafeBool([#"1st stage?"]),
                    engageNotYes = SafeText([#"Stage Completion Flag(Engage)"]) <> "YES",
                    eligible     = SafeText([Stage]) = "ELIGIBLE"
                in
                    optOut and firstStage and engageNotYes and eligible
            otherwise false,
        type logical),

    // =========================================================================
    // STEP 17 — UC 75% eligible w/o opt-in
    // Offer NOT opted-in + Eligible + Engage complete + Adopt NOT complete
    // =========================================================================
    AddedUC75 = Table.AddColumn(AddedUC2550, "UC 75% eligible w/o opt-in",
        each
            try
                let
                    optOut       = not SafeBool([#"Offer opted-in?"]),
                    eligible     = SafeText([Stage]) = "ELIGIBLE",
                    engageYes    = SafeText([#"Stage Completion Flag(Engage)"]) = "YES",
                    adoptNotYes  = SafeText([#"Stage Completion Flag(Adopt)"]) <> "YES"
                in
                    optOut and eligible and engageYes and adoptNotYes
            otherwise false,
        type logical),

    // =========================================================================
    // STEP 18 — UC progressed and missed w/o opt-in
    // (1st stage + Expired + not opted-in + missed incentives > 0)
    // OR (Adopt complete + not Expired + not opted-in + missed > 0)
    // =========================================================================
    AddedUCMissed = Table.AddColumn(AddedUC75, "UC progressed and missed w/o opt-in",
        each
            try
                let
                    firstStage = SafeBool([#"1st stage?"]),
                    expired    = SafeText([Stage]) = "EXPIRED",
                    optOut     = not SafeBool([#"Offer opted-in?"]),
                    missedNZ   = SafeNum([#"Missed Incentives"]) <> 0,
                    adoptYes   = SafeText([#"Stage Completion Flag(Adopt)"]) = "YES"
                in
                    (firstStage and expired and optOut and missedNZ) or
                    (adoptYes and (not expired) and optOut and missedNZ)
            otherwise false,
        type logical),

    // =========================================================================
    // STEP 19 — Standardize EA Flag  (Y→Yes, N→No)
    // =========================================================================
    StandardizedEA = Table.TransformColumns(AddedUCMissed, {
        {"EA Flag", each if _ = "Y" then "Yes" else if _ = "N" then "No" else _, type text}
    }),

    // =========================================================================
    // STEP 20 — Offer Risk Level
    // Only set for Maximum Incentive Deal Flag = "Yes" deals within 18 months.
    // =========================================================================
    AddedRiskLevel = Table.AddColumn(StandardizedEA, "Offer Risk Level",
        each
            let
                bookingDate   = Date.From([Booking Date]),
                todayVal      = Date.From(DateTime.LocalNow()),
                past18Months  = Date.AddMonths(todayVal, -17),
                isRecent      = bookingDate >= Date.StartOfMonth(past18Months)
                                and bookingDate <= todayVal
            in
                if [Maximum Incentive Deal Flag] = "Yes" and isRecent
                   and List.Contains({"Purchase", "Onboard"}, [Current stage])        then "High"
                else if [Maximum Incentive Deal Flag] = "Yes" and isRecent
                        and List.Contains({"Implement", "Use"}, [Current stage])      then "Medium"
                else if [Maximum Incentive Deal Flag] = "Yes" and isRecent
                        and List.Contains({"Engage", "Adopt", "Completed"}, [Current stage]) then "Low"
                else null,
        type text),

    // =========================================================================
    // STEP 21 — Is within 18 FM  (booking date on or after the 18-month window)
    // =========================================================================
    AddedIn18FM = Table.AddColumn(AddedRiskLevel, "Is within 18 FM",
        each
            let bookDate = ToDate([Booking Date])
            in if bookDate = null or Month18AgoStart = null
               then false
               else bookDate >= Month18AgoStart,
        type logical),

    // =========================================================================
    // STEP 22 — PVI Eligible
    // Within 18 FM + Maximum Incentive Deal Flag = Yes + Stage = Eligible +
    // NOT Collaboration portfolio
    // =========================================================================
    AddedPVIEligible = Table.AddColumn(AddedIn18FM, "PVI Eligible",
        each
            [Is within 18 FM] = true and
            [Maximum Incentive Deal Flag] = "Yes" and
            SafeText([Stage]) = "ELIGIBLE" and
            SafeText([Deal CPI Portfolio]) <> "COLLABORATION",
        type logical),

    // =========================================================================
    // STEP 23 — PVI Onboard
    // PVI Eligible conditions + Onboard stage complete
    // =========================================================================
    AddedPVIOnboard = Table.AddColumn(AddedPVIEligible, "PVI Onboard",
        each
            [Is within 18 FM] = true and
            [Maximum Incentive Deal Flag] = "Yes" and
            SafeText([Stage]) = "ELIGIBLE" and
            SafeText([#"Stage Completion Flag(onboard)"]) = "YES" and
            SafeText([Deal CPI Portfolio]) <> "COLLABORATION",
        type logical),

    // =========================================================================
    // STEP 24 — PVI Adopt
    // PVI Eligible conditions + Adopt stage complete
    // =========================================================================
    AddedPVIAdopt = Table.AddColumn(AddedPVIOnboard, "PVI Adopt",
        each
            [Is within 18 FM] = true and
            [Maximum Incentive Deal Flag] = "Yes" and
            SafeText([Stage]) = "ELIGIBLE" and
            SafeText([#"Stage Completion Flag(Adopt)"]) = "YES" and
            SafeText([Deal CPI Portfolio]) <> "COLLABORATION",
        type logical),

    // =========================================================================
    // STEP 25 — CRPartyNameID  (for Customer page dropdown)
    // =========================================================================
    AddedCRPartyNameID = Table.AddColumn(AddedPVIAdopt, "CRPartyNameID",
        each [CR Party Name] & "-" & Text.From([CR Party ID]),
        type text),

    // =========================================================================
    // STEP 26 — New eligible
    // Eligible + Pending opt-in + booked within last 30 days
    // =========================================================================
    AddedNewEligible = Table.AddColumn(AddedCRPartyNameID, "New eligible",
        each
            SafeText([Stage]) = "ELIGIBLE" and
            SafeText([#"Adopt Rebate Opt-In Status"]) = "PENDING" and
            ToDate([Booking Date]) >= Date.AddDays(Date.From(DateTime.LocalNow()), -30) and
            ToDate([Booking Date]) <= Date.From(DateTime.LocalNow()),
        type logical)

in
    AddedNewEligible
