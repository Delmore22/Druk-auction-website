param(
    [string]$JsonPath = "data/cars.json"
)

$ErrorActionPreference = "Stop"

$config = @{
    Url = "https://chllzkgugwuerlnbltay.supabase.co"
    Table = "inventory_vehicles"
}

# Uses the public anon key — RLS policies allow anon INSERT/UPDATE on inventory_vehicles
$anonKey = "sb_publishable_rpzSMoGHXVKEIRwipYmrHg_64fqgX0y"

if (-not (Test-Path -LiteralPath $JsonPath)) {
    throw "Could not find JSON file: $JsonPath"
}

function Get-InventoryStatus([string]$marketStatus) {
    $normalized = [string]$marketStatus
    $normalized = $normalized.Trim().ToLowerInvariant()
    if ($normalized -eq "sold") { return "Sold" }
    if ($normalized -eq "pending") { return "Pending" }
    return "Active"
}

$json = Get-Content -LiteralPath $JsonPath -Raw | ConvertFrom-Json
$cars = @($json.cars)
if (-not $cars.Count) {
    Write-Host "No cars found in $JsonPath"
    exit 0
}

$rows = foreach ($car in $cars) {
    [ordered]@{
        id = [string]$car.id
        vin = [string]$car.vin
        year = if ($null -ne $car.year) { [int]$car.year } else { $null }
        make = [string]$car.make
        model = [string]$car.model
        engine = [string]$car.engine
        transmission = [string]$car.transmission
        body_style = [string]$car.bodyStyle
        mileage = [string]$car.mileage
        condition = [string]$car.condition
        description = [string]$car.description
        photo = [string]$car.photo
        starting_bid = if ($null -ne $car.startingBid) { [decimal]$car.startingBid } else { $null }
        current_bid = if ($null -ne $car.currentBid) { [decimal]$car.currentBid } else { $null }
        reserve_price = if ($null -ne $car.reservePrice) { [decimal]$car.reservePrice } else { $null }
        buy_now_price = if ($null -ne $car.buyNowPrice) { [decimal]$car.buyNowPrice } else { $null }
        market_status = [string]$car.status
        inventory_status = Get-InventoryStatus -marketStatus ([string]$car.status)
        listing_type = $null
        time_remaining = [string]$car.timeRemaining
        seller = [string]$car.seller
        location = [string]$car.location
        pickup = [string]$car.pickup
        auction_start_at = if ([string]::IsNullOrWhiteSpace([string]$car.auctionStartAt)) { $null } else { [string]$car.auctionStartAt }
        auction_end_at = if ([string]::IsNullOrWhiteSpace([string]$car.auctionEndAt)) { $null } else { [string]$car.auctionEndAt }
        is_demo = $true
        is_archived = $false
    }
}

$endpoint = "{0}/rest/v1/{1}" -f $config.Url.TrimEnd('/'), $config.Table
$headers = @{
    apikey = $anonKey
    Authorization = "Bearer $anonKey"
    Prefer = "resolution=merge-duplicates,return=minimal"
    "Content-Type" = "application/json"
}

$payload = @($rows) | ConvertTo-Json -Depth 8
$payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($payload)

try {
    Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -Body $payloadBytes | Out-Null
    Write-Host "Upserted $($rows.Count) inventory vehicles into $($config.Table)."
} catch {
    Write-Host "Error details: $($_.Exception.Message)"
    throw
}
