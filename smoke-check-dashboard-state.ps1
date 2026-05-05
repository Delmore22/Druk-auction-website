param(
    [string]$Root = "."
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-Contains {
    param(
        [string]$Path,
        [string]$Needle,
        [string]$Label
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return [pscustomobject]@{ Label = $Label; Passed = $false; Detail = "Missing file: $Path" }
    }

    $content = Get-Content -LiteralPath $Path -Raw
    if ($content.Contains($Needle)) {
        return [pscustomobject]@{ Label = $Label; Passed = $true; Detail = "OK" }
    }

    return [pscustomobject]@{ Label = $Label; Passed = $false; Detail = "Missing snippet: $Needle" }
}

function Test-ContainsAny {
    param(
        [string]$Path,
        [string[]]$Needles,
        [string]$Label
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return [pscustomobject]@{ Label = $Label; Passed = $false; Detail = "Missing file: $Path" }
    }

    $content = Get-Content -LiteralPath $Path -Raw
    foreach ($needle in $Needles) {
        if ($content.Contains($needle)) {
            return [pscustomobject]@{ Label = $Label; Passed = $true; Detail = "OK" }
        }
    }

    return [pscustomobject]@{ Label = $Label; Passed = $false; Detail = "Missing accepted snippets" }
}

$dashboardPath = Join-Path $Root "car-dashboard.js"

$checks = @(
    (Test-Contains -Path $dashboardPath -Needle "window.setAuctionSearchUiState(snapshot);" -Label "Search UI state is persisted")
    (Test-Contains -Path $dashboardPath -Needle "const savedState = window.getAuctionSearchUiState();" -Label "Search UI state is restored")
    (Test-Contains -Path $dashboardPath -Needle "if (event.key !== 'auctionSearchUiState') return;" -Label "Cross-tab storage sync is scoped")
    (Test-Contains -Path $dashboardPath -Needle "window.addEventListener('focus', function() {" -Label "Window focus triggers state restore")
    (Test-Contains -Path $dashboardPath -Needle "const DASHBOARD_UI_STATE_KEY = 'dashboardUiState';" -Label "Dashboard session state key exists")
    (Test-Contains -Path $dashboardPath -Needle "window.addEventListener('pagehide', persistDashboardUiState);" -Label "Dashboard state is captured on page exit")
    (Test-Contains -Path $dashboardPath -Needle "restoreDashboardUiState();" -Label "Dashboard session state is restored")
    (Test-Contains -Path $dashboardPath -Needle "currentPage = 1;" -Label "Search/view changes reset to page 1")
    (Test-ContainsAny -Path $dashboardPath -Needles @(
        "document.getElementById('prevBtn').disabled = currentPage === 1 || visibleItems.length === 0;",
        "document.getElementById('prevBtn').disabled = currentMarketTab === 'sold' || currentPage === 1 || visibleItems.length === 0;"
    ) -Label "Previous button disable guard exists")
    (Test-ContainsAny -Path $dashboardPath -Needles @(
        "document.getElementById('nextBtn').disabled = currentPage === totalPages || visibleItems.length === 0;",
        "document.getElementById('nextBtn').disabled = currentMarketTab === 'sold' || currentPage === totalPages || visibleItems.length === 0;"
    ) -Label "Next button disable guard exists")
    (Test-ContainsAny -Path $dashboardPath -Needles @(
        "document.getElementById('pageInfo').textContent = 'No results';",
        "document.getElementById('pageInfo').textContent = 'No active bidding';"
    ) -Label "No-results state messaging exists")
)

$failed = @($checks | Where-Object { -not $_.Passed })

Write-Host "Smoke check: dashboard search/filter persistence and pagination"
Write-Host "Project root: $(Resolve-Path -LiteralPath $Root)"
Write-Host ""

foreach ($check in $checks) {
    if ($check.Passed) {
        Write-Host "[PASS] $($check.Label)"
    }
    else {
        Write-Host "[FAIL] $($check.Label) - $($check.Detail)"
    }
}

Write-Host ""
if ($failed.Count -gt 0) {
    Write-Host "Result: FAILED ($($failed.Count) check(s) failed)"
    exit 1
}

Write-Host "Result: PASSED ($($checks.Count) checks)"
exit 0