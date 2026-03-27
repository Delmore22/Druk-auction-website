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

$dashboardPath = Join-Path $Root "car-dashboard.js"
$detailsPath = Join-Path $Root "car-details.js"

$checks = @(
    (Test-Contains -Path $dashboardPath -Needle "dashboardWelcomeShown" -Label "Banner runs once per tab session")
    (Test-Contains -Path $dashboardPath -Needle "item.rel = 'opener'" -Label "Details link preserves opener for close-and-return")
    (Test-Contains -Path $detailsPath -Needle "var trustedOpener = null;" -Label "Back flow uses trusted opener gate")
    (Test-Contains -Path $detailsPath -Needle "openerWindow.location.origin === window.location.origin" -Label "Opener is same-origin validated")
    (Test-Contains -Path $detailsPath -Needle "window.close();" -Label "Details tab attempts self-close")
    (Test-Contains -Path $detailsPath -Needle "window.setTimeout(function () {" -Label "Close-block fallback is present")
)

$failed = @($checks | Where-Object { -not $_.Passed })

Write-Host "Smoke check: dashboard/details back-navigation guardrails"
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