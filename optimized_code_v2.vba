Private Sub Worksheet_Change(ByVal Target As Range)
    ' === ALL VARIABLE DECLARATIONS ===
    Dim keyRange As Range
    Dim wsData As Worksheet
    Dim lo As ListObject
    Dim loHierarchy As ListObject
    Dim dataArr As Variant
    Dim i As Long, j As Integer, s As Integer, col As Integer, r As Integer, g As Integer
    Dim custName As String
    Dim trackHeader As String
    Dim stageName As String
    Dim progressVal As Double
    Dim maxRank As Integer, currentRank As Integer
    
    ' Arrays and collections
    Dim stages As Variant: stages = Array("Purchase", "Onboard", "Implement", "Use", "Engage", "Adopt", "Completed")
    Dim stageValues As Variant: stageValues = Array(0.05, 0.1, 0.25, 0.35, 0.5, 0.75, 1)
    
    Dim wsLoop As Worksheet
    Dim offerArr As Variant, domainArr As Variant, guideArr As Variant, useCaseArr As Variant
    Dim uniqueOffers(100) As String
    Dim offerDomains(100) As String
    Dim offerCount As Integer
    Dim alreadyExists As Boolean
    Dim offerVal As String
    
    ' Column indices
    Dim idxCust As Integer, idxTrack As Integer, idxSub As Integer, idxStage As Integer
    Dim idxOptIn As Integer, idxCurStage As Integer, idxProgress As Integer, idxPending As Integer
    Dim idxDays As Integer, idxPotential As Integer, idxEarned As Integer
    Dim idxExpiry As Integer, idxStartDate As Integer, idxWSID As Integer
    
    ' Dictionaries for optimization
    Dim customerData As Object
    Dim stageData As Object
    Dim guideDict As Object
    Dim trackKey As String, subTrack As String, stageKey As String, curStage As String
    Dim curRank As Integer
    
    ' Processing variables
    Dim vSubTrack As String
    Dim foundOptIn As Boolean
    Dim rowData(8) As Variant
    Dim rd As Variant
    Dim guideURL As String
    Dim daysInStage As Variant, daysToExpiry As Variant
    Dim barColor As Long
    Dim groupStarts As Variant
    Dim lastCol As Integer
    
    ' === MAIN LOGIC ===
    On Error Resume Next
    Set keyRange = Me.Range("Customer_CRParty")
    On Error GoTo 0

    If keyRange Is Nothing Then Exit Sub
    If Intersect(Target, keyRange) Is Nothing Then Exit Sub

    Application.ScreenUpdating = False
    Application.EnableEvents = False

    Set wsData = ThisWorkbook.Worksheets("Data")
    Set lo = wsData.ListObjects("Data")
    dataArr = lo.DataBodyRange.Value
    custName = keyRange.Value

    ' === Get column indices once ===
    idxCust = lo.ListColumns("CRPartyNameID").Index
    idxTrack = lo.ListColumns("Track").Index
    idxSub = lo.ListColumns("Sub-Track").Index
    idxStage = lo.ListColumns("Stage").Index
    idxOptIn = lo.ListColumns("Adopt Rebate Opt-In Status").Index
    idxCurStage = lo.ListColumns("Current stage").Index
    idxProgress = lo.ListColumns("Current Stage Progress").Index
    idxPending = lo.ListColumns("Current stage pending tasks").Index
    idxDays = lo.ListColumns("Days in stage").Index
    idxPotential = lo.ListColumns("Potential Incentives").Index
    idxEarned = lo.ListColumns("Estimated Earned Incentives").Index
    idxExpiry = lo.ListColumns("Deal Incentive Expiry Date").Index
    idxStartDate = lo.ListColumns("Adopt Rebate Start Date").Index
    idxWSID = lo.ListColumns("Deal WS-ID").Index

    ' === Load Hierarchy data once ===
    For Each wsLoop In ThisWorkbook.Worksheets
        For Each loHierarchy In wsLoop.ListObjects
            If loHierarchy.Name = "Hierarchy" Then
                offerArr = loHierarchy.ListColumns("Offer").DataBodyRange.Value
                domainArr = loHierarchy.ListColumns("Domain").DataBodyRange.Value
                guideArr = loHierarchy.ListColumns("Guide").DataBodyRange.Value
                useCaseArr = loHierarchy.ListColumns("Use Case").DataBodyRange.Value
                Exit For
            End If
        Next loHierarchy
        If Not loHierarchy Is Nothing Then
            If loHierarchy.Name = "Hierarchy" Then Exit For
        End If
    Next wsLoop

    ' === Build unique offers list AND guide dictionary in ONE pass ===
    offerCount = 0
    Set guideDict = CreateObject("Scripting.Dictionary")
    
    For i = 1 To UBound(offerArr, 1)
        offerVal = CStr(offerArr(i, 1))
        
        ' Build unique offers
        If offerVal <> "" Then
            alreadyExists = False
            For j = 0 To offerCount - 1
                If uniqueOffers(j) = offerVal Then
                    alreadyExists = True
                    Exit For
                End If
            Next j
            If Not alreadyExists Then
                uniqueOffers(offerCount) = offerVal
                offerDomains(offerCount) = CStr(domainArr(i, 1))
                offerCount = offerCount + 1
            End If
        End If
        
        ' Build guide lookup dictionary
        Dim ucKey As String: ucKey = CStr(useCaseArr(i, 1))
        If ucKey <> "" And Not guideDict.exists(ucKey) Then
            guideDict(ucKey) = CStr(guideArr(i, 1))
        End If
    Next i

    ' === PRE-FILTER ALL CUSTOMER DATA IN ONE PASS ===
    Set customerData = CreateObject("Scripting.Dictionary")
    Set stageData = CreateObject("Scripting.Dictionary")
    
    If custName <> "" Then
        For i = 1 To UBound(dataArr, 1)
            If dataArr(i, idxCust) = custName Then
                trackKey = CStr(dataArr(i, idxTrack))
                subTrack = CStr(dataArr(i, idxSub))
                
                ' Store opted-in customer data
                If dataArr(i, idxOptIn) = "Opted In" And _
                   (dataArr(i, idxStage) = "Eligible" Or dataArr(i, idxStage) = "Expired") Then
                    If Not customerData.exists(trackKey) Then
                        ' Store all needed values
                        rowData(0) = subTrack
                        rowData(1) = dataArr(i, idxProgress)
                        rowData(2) = dataArr(i, idxPending)
                        rowData(3) = dataArr(i, idxDays)
                        rowData(4) = dataArr(i, idxPotential)
                        rowData(5) = dataArr(i, idxEarned)
                        rowData(6) = dataArr(i, idxExpiry)
                        rowData(7) = dataArr(i, idxStartDate)
                        rowData(8) = dataArr(i, idxWSID)
                        customerData.Add trackKey, rowData
                    End If
                End If
                
                ' Build stage ranking for each sub-track
                stageKey = subTrack
                If stageKey <> "" Then
                    curStage = CStr(dataArr(i, idxCurStage))
                    If curStage <> "" Then
                        curRank = -1
                        For s = LBound(stages) To UBound(stages)
                            If stages(s) = curStage Then
                                curRank = s
                                Exit For
                            End If
                        Next s
                        
                        If curRank >= 0 Then
                            If Not stageData.exists(stageKey) Then
                                stageData.Add stageKey, Array(curRank, curStage)
                            Else
                                If curRank > stageData(stageKey)(0) Then
                                    stageData(stageKey) = Array(curRank, curStage)
                                End If
                            End If
                        End If
                    End If
                End If
            End If
        Next i
    End If

    ' === Clear output area ===
    lastCol = Me.Cells(5, Me.Columns.Count).End(xlToLeft).Column
    If lastCol < 2 Then lastCol = 2
    With Me.Range("B4:H17")
        .ClearContents
        .ClearFormats
    End With
    Me.Hyperlinks.Delete

    ' === Process columns - DATA WRITE ONLY (no formatting yet) ===
    col = 2
    Dim colsToProcess() As Integer
    ReDim colsToProcess(0 To offerCount - 1)
    Dim colCount As Integer: colCount = 0
    
    For i = 0 To offerCount - 1
        trackHeader = uniqueOffers(i)
        
        If customerData.exists(trackHeader) Then
            rd = customerData(trackHeader)
            vSubTrack = CStr(rd(0))
            
            ' Get highest stage
            stageName = ""
            progressVal = 0
            maxRank = -1
            If stageData.exists(vSubTrack) Then
                maxRank = stageData(vSubTrack)(0)
                stageName = stageData(vSubTrack)(1)
                progressVal = stageValues(maxRank)
            End If
            
            ' === WRITE ALL DATA (no formatting) ===
            Me.Cells(4, col).Value = offerDomains(i)
            Me.Cells(5, col).Value = trackHeader
            Me.Cells(6, col).Value = vSubTrack
            Me.Cells(8, col).Value = CStr(rd(1))
            Me.Cells(9, col).Value = IIf(CStr(rd(2)) <> "", rd(2), "N/A")
            Me.Cells(10, col).Value = rd(3)
            Me.Cells(11, col).Value = rd(4)
            Me.Cells(12, col).Value = rd(5)
            
            ' Dates
            If IsDate(rd(7)) Then Me.Cells(13, col).Value = CDate(rd(7))
            If IsDate(rd(6)) Then
                Me.Cells(14, col).Value = CDate(rd(6))
                Me.Cells(15, col).Value = CDate(rd(6)) - Date
            End If
            
            ' WS-ID (will add hyperlink later)
            Me.Cells(16, col).Value = rd(8)
            
            ' Guide (will add hyperlink later)
            guideURL = ""
            If guideDict.exists(vSubTrack) Then guideURL = guideDict(vSubTrack)
            If guideURL = "" Then Me.Cells(17, col).Value = "N/A"
            
            ' Stage bar (Row 7)
            If stageName <> "" Then
                Me.Cells(7, col).Value = progressVal
            End If
            
            ' Track this column for formatting
            colsToProcess(colCount) = col
            colCount = colCount + 1
            
            col = col + 1
        End If
    Next i
    
    ' === APPLY ALL FORMATTING IN BULK ===
    If colCount > 0 Then
        ReDim Preserve colsToProcess(0 To colCount - 1)
        Call FormatAllColumnsQuick(Me, colsToProcess, customerData, stageData, guideDict, uniqueOffers, stages, stageValues)
    End If

    Application.EnableEvents = True
    Application.ScreenUpdating = True
End Sub

' === BULK FORMATTING SUBROUTINE ===
Private Sub FormatAllColumnsQuick(ws As Worksheet, cols() As Integer, _
                                   custData As Object, stgData As Object, _
                                   guides As Object, offers() As String, _
                                   stages As Variant, stageVals As Variant)
    
    Dim col As Integer, i As Integer
    Dim trackHeader As String, vSubTrack As String
    Dim rd As Variant, stageName As String, progressVal As Double
    Dim maxRank As Integer, barColor As Long
    Dim daysInStage As Variant, daysToExpiry As Variant
    Dim guideURL As String, wsid As String
    Dim r As Integer, g As Integer
    Dim groupStarts As Variant: groupStarts = Array(4, 7, 11, 13, 16)
    
    ' Process each column
    For i = LBound(cols) To UBound(cols)
        col = cols(i)
        vSubTrack = CStr(ws.Cells(6, col).Value)
        trackHeader = CStr(ws.Cells(5, col).Value)
        
        If custData.exists(trackHeader) Then
            rd = custData(trackHeader)
            
            ' Get stage info
            stageName = ""
            progressVal = 0
            maxRank = -1
            If stgData.exists(vSubTrack) Then
                maxRank = stgData(vSubTrack)(0)
                stageName = stgData(vSubTrack)(1)
                progressVal = stageVals(maxRank)
            End If
            
            ' === GROUP 1: Identity (rows 4-6) ===
            With ws.Cells(4, col)
                .Font.Bold = True: .Font.Size = 9: .Font.Color = RGB(255, 255, 255)
                .Interior.Color = RGB(31, 73, 125): .HorizontalAlignment = xlCenter
            End With
            With ws.Cells(5, col)
                .Font.Bold = True: .Font.Size = 10: .Font.Color = RGB(255, 255, 255)
                .Interior.Color = RGB(68, 114, 196): .HorizontalAlignment = xlCenter: .WrapText = True
            End With
            With ws.Cells(6, col)
                .Font.Bold = True: .Font.Size = 12: .Font.Color = RGB(31, 73, 125)
                .Interior.Color = RGB(221, 235, 247): .HorizontalAlignment = xlCenter: .WrapText = True
            End With
            
            ' === GROUP 2: Progress (rows 7-10) ===
            ' Row 7: Stage bar with conditional formatting
            With ws.Cells(7, col)
                .Interior.Color = RGB(255, 255, 255): .HorizontalAlignment = xlCenter
                If stageName <> "" Then
                    .NumberFormat = """" & stageName & """"
                    Select Case stageName
                        Case "Purchase", "Onboard": barColor = RGB(255, 0, 0)
                        Case "Implement", "Use": barColor = RGB(255, 165, 0)
                        Case Else: barColor = RGB(0, 176, 80)
                    End Select
                    With .FormatConditions.AddDatabar
                        .MinPoint.Modify newtype:=xlConditionValueNumber, newvalue:=0
                        .MaxPoint.Modify newtype:=xlConditionValueNumber, newvalue:=1
                        .barColor.Color = barColor
                        .BarFillType = xlDataBarFillSolid
                    End With
                End If
            End With
            
            With ws.Cells(8, col)
                .NumberFormat = "@": .Font.Size = 10: .HorizontalAlignment = xlCenter
                .Interior.Color = RGB(242, 240, 248)
            End With
            With ws.Cells(9, col)
                .Font.Size = 9: .Font.Color = RGB(80, 80, 80): .WrapText = True
                .HorizontalAlignment = xlCenter: .Interior.Color = RGB(242, 240, 248)
            End With
            With ws.Cells(10, col)
                .Font.Bold = True: .Font.Size = 10: .HorizontalAlignment = xlCenter
                .Interior.Color = RGB(230, 224, 244)
            End With
            
            ' === GROUP 3: Financials (rows 11-12) ===
            With ws.Cells(11, col)
                .Font.Bold = True: .Font.Size = 10: .HorizontalAlignment = xlCenter
                .Interior.Color = RGB(235, 246, 238): .NumberFormat = "$#,##0"
            End With
            With ws.Cells(12, col)
                .Font.Bold = True: .Font.Size = 10: .HorizontalAlignment = xlCenter
                .Interior.Color = RGB(198, 239, 206): .NumberFormat = "$#,##0"
            End With
            
            ' === GROUP 4: Timeline (rows 13-15) ===
            With ws.Range(ws.Cells(13, col), ws.Cells(14, col))
                .Font.Size = 10: .HorizontalAlignment = xlCenter
                .Interior.Color = RGB(255, 252, 242)
            End With
            With ws.Cells(15, col)
                .Font.Bold = True: .Font.Size = 10: .HorizontalAlignment = xlCenter
                .Interior.Color = RGB(255, 243, 205)
            End With
            
            ' === GROUP 5: References (rows 16-17) ===
            With ws.Range(ws.Cells(16, col), ws.Cells(17, col))
                .Font.Size = 10: .HorizontalAlignment = xlCenter
                .Interior.Color = RGB(240, 244, 250)
            End With
            
            ' === BORDERS ===
            For r = 4 To 16
                With ws.Cells(r, col).Borders(xlEdgeBottom)
                    .LineStyle = xlContinuous: .Weight = xlThin: .Color = RGB(180, 180, 180)
                End With
            Next r
            
            For g = 0 To UBound(groupStarts)
                With ws.Cells(groupStarts(g), col).Borders(xlEdgeTop)
                    .LineStyle = xlContinuous: .Weight = xlMedium
                End With
            Next g
            
            With ws.Cells(17, col).Borders(xlEdgeBottom)
                .LineStyle = xlContinuous: .Weight = xlMedium
            End With
            
            With ws.Range(ws.Cells(4, col), ws.Cells(17, col))
                .Borders(xlEdgeLeft).LineStyle = xlContinuous
                .Borders(xlEdgeLeft).Weight = xlMedium
                .Borders(xlEdgeRight).LineStyle = xlContinuous
                .Borders(xlEdgeRight).Weight = xlMedium
            End With
            
            ' === COLOR CODING ===
            If stageName = "Completed" Then
                ws.Cells(10, col).Font.Color = RGB(200, 200, 200)
                ws.Cells(15, col).Font.Color = RGB(200, 200, 200)
            Else
                daysInStage = ws.Cells(10, col).Value
                If IsNumeric(daysInStage) And daysInStage <> "" Then
                    Select Case True
                        Case daysInStage < 90: ws.Cells(10, col).Font.Color = RGB(0, 176, 80)
                        Case daysInStage <= 180: ws.Cells(10, col).Font.Color = RGB(255, 165, 0)
                        Case Else: ws.Cells(10, col).Font.Color = RGB(255, 0, 0)
                    End Select
                End If
                
                daysToExpiry = ws.Cells(15, col).Value
                If IsNumeric(daysToExpiry) And daysToExpiry <> "" Then
                    Select Case True
                        Case daysToExpiry > 180: ws.Cells(15, col).Font.Color = RGB(0, 176, 80)
                        Case daysToExpiry >= 90: ws.Cells(15, col).Font.Color = RGB(255, 165, 0)
                        Case daysToExpiry >= 0: ws.Cells(15, col).Font.Color = RGB(255, 0, 0)
                        Case Else: ws.Cells(15, col).Font.Color = RGB(200, 200, 200)
                    End Select
                End If
            End If
            
            ' === HYPERLINKS ===
            ' WS-ID
            wsid = CStr(ws.Cells(16, col).Value)
            If wsid <> "" Then
                ws.Hyperlinks.Add Anchor:=ws.Cells(16, col), _
                    Address:="https://app.workspan.com/wsid/" & wsid, _
                    TextToDisplay:=wsid
            End If
            
            ' Guide
            If guides.exists(vSubTrack) Then
                guideURL = guides(vSubTrack)
                If guideURL <> "" Then
                    ws.Hyperlinks.Add Anchor:=ws.Cells(17, col), _
                        Address:=guideURL, TextToDisplay:="Link"
                End If
            End If
        End If
    Next i
End Sub
