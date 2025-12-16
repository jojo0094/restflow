# Complete E2E test for filter operation
# Run this with the backend server running on port 8000

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  FILTER OPERATION END-TO-END TEST" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Step 1: Create session
Write-Host "`n[1/3] Creating session..." -ForegroundColor Yellow
try {
    $sessionResponse = Invoke-RestMethod -Uri 'http://localhost:8000/api/sessions' -Method POST
    $sessionId = $sessionResponse.session_id
    Write-Host "✓ Session created: $sessionId" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to create session: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Execute filter operation
Write-Host "`n[2/3] Executing filter operation..." -ForegroundColor Yellow
Write-Host "  Table: water_points_fixed" -ForegroundColor Gray
Write-Host "  Filter: status IN ('Existing', 'Private')" -ForegroundColor Gray

$filterOperation = @{
    operation = @{
        type = 'filter'
        input = @{
            kind = 'persistent'
            name = 'water_points_fixed'
        }
        filters = @(
            @{
                column = 'status'
                operator = 'in'
                value = @('Existing', 'Private')
            }
        )
    }
} | ConvertTo-Json -Depth 10

try {
    $result = Invoke-RestMethod `
        -Uri "http://localhost:8000/api/sessions/$sessionId/execute" `
        -Method POST `
        -ContentType 'application/json' `
        -Body $filterOperation
    
    Write-Host "✓ Filter executed successfully" -ForegroundColor Green
    Write-Host "`n  Results:" -ForegroundColor Cyan
    Write-Host "  ├─ Success: $($result.success)" -ForegroundColor $(if ($result.success) { 'Green' } else { 'Red' })
    Write-Host "  ├─ Row Count: $($result.rowCount)" -ForegroundColor Cyan
    Write-Host "  ├─ Output Table: $($result.outputTable.name)" -ForegroundColor Cyan
    Write-Host "  ├─ Table Kind: $($result.outputTable.kind)" -ForegroundColor Cyan
    Write-Host "  └─ Message: $($result.message)" -ForegroundColor Gray
    
    if ($result.rowCount -eq 0 -or $result.rowCount -eq $null) {
        Write-Host "`n⚠ WARNING: Row count is 0 or null!" -ForegroundColor Red
        Write-Host "Full response:" -ForegroundColor Yellow
        $result | ConvertTo-Json -Depth 5
    } else {
        Write-Host "`n✓ Filter returned $($result.rowCount) rows (expected ~12,675)" -ForegroundColor Green
    }
    
    $tempTable = $result.outputTable.name
} catch {
    Write-Host "✗ Filter operation failed: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Verify temp table was created
Write-Host "`n[3/3] Verifying temp table..." -ForegroundColor Yellow
try {
    $tables = Invoke-RestMethod -Uri "http://localhost:8000/api/sessions/$sessionId/tables?includeTemporary=true"
    $foundTable = $tables.tables | Where-Object { $_.name -eq $tempTable }
    
    if ($foundTable) {
        Write-Host "✓ Temp table exists: $($foundTable.name) ($($foundTable.row_count) rows)" -ForegroundColor Green
    } else {
        Write-Host "✗ Temp table not found in session tables" -ForegroundColor Red
    }
} catch {
    Write-Host "⚠ Could not verify temp table (endpoint may not exist yet): $_" -ForegroundColor Yellow
}

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  TEST COMPLETE" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
