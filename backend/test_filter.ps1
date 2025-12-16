# Test filter operation
Write-Host "=== Step 1: Create session ===" -ForegroundColor Green
$response = Invoke-RestMethod -Uri 'http://localhost:8000/api/sessions' -Method POST
$sessionId = $response.session_id
Write-Host "Session ID: $sessionId" -ForegroundColor Cyan

Write-Host "`n=== Step 2: Execute filter operation ===" -ForegroundColor Green
$body = @{
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

Write-Host "Request body:" -ForegroundColor Yellow
Write-Host $body

$result = Invoke-RestMethod -Uri "http://localhost:8000/api/sessions/$sessionId/execute" -Method POST -ContentType 'application/json' -Body $body

Write-Host "`n=== Result ===" -ForegroundColor Green
$result | ConvertTo-Json -Depth 5
Write-Host "`nSuccess: $($result.success)" -ForegroundColor $(if ($result.success) { 'Green' } else { 'Red' })
Write-Host "Row count: $($result.rowCount)" -ForegroundColor Cyan
Write-Host "Output table: $($result.outputTable.name)" -ForegroundColor Cyan
