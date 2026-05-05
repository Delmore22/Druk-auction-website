param(
    [string]$JsonPath = "data/cars.json",
    [string]$PhotosDir = "cars-photos"
)

$ErrorActionPreference = "Stop"

$supabaseUrl  = "https://chllzkgugwuerlnbltay.supabase.co"
$anonKey      = "sb_publishable_rpzSMoGHXVKEIRwipYmrHg_64fqgX0y"
$bucket       = "vehicle-submission-photos"
$bucketPrefix = "inventory"
$table        = "inventory_vehicles"

$authHeaders = @{
    apikey        = $anonKey
    Authorization = "Bearer $anonKey"
}

if (-not (Test-Path -LiteralPath $JsonPath)) {
    throw "Cannot find JSON file: $JsonPath"
}
if (-not (Test-Path -LiteralPath $PhotosDir)) {
    throw "Cannot find photos directory: $PhotosDir"
}

$json = Get-Content -LiteralPath $JsonPath -Raw | ConvertFrom-Json
$cars = @($json.cars)

Write-Host "Found $($cars.Count) cars in $JsonPath"
Write-Host ""

$mimeMap = @{
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".png"  = "image/png"
    ".gif"  = "image/gif"
    ".webp" = "image/webp"
}

$uploaded = 0
$skipped  = 0
$failed   = 0

foreach ($car in $cars) {
    $localRelPath = [string]$car.photo  # e.g. "cars-photos/1967-ford-mustang-fastback.png"
    $fileName     = [System.IO.Path]::GetFileName($localRelPath)
    $localPath    = Join-Path $PhotosDir $fileName

    if (-not (Test-Path -LiteralPath $localPath)) {
        Write-Warning "  Photo file not found locally: $localPath — skipping $($car.id)"
        $skipped++
        continue
    }

    $ext      = [System.IO.Path]::GetExtension($fileName).ToLowerInvariant()
    $mimeType = if ($mimeMap.ContainsKey($ext)) { $mimeMap[$ext] } else { "application/octet-stream" }
    $storagePath = "$bucketPrefix/$fileName"
    $uploadUri   = "$supabaseUrl/storage/v1/object/$bucket/$storagePath"

    $uploadHeaders = $authHeaders.Clone()
    $uploadHeaders["Content-Type"] = $mimeType
    $uploadHeaders["x-upsert"] = "true"

    $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $localPath).Path)

    try {
        Invoke-RestMethod -Method Post -Uri $uploadUri -Headers $uploadHeaders -Body $bytes | Out-Null
    } catch {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errBody = $reader.ReadToEnd()
        Write-Warning "  Upload failed for $($car.id): $errBody"
        $failed++
        continue
    }

    $publicUrl = "$supabaseUrl/storage/v1/object/public/$bucket/$storagePath"

    # Update the photo column in inventory_vehicles
    $patchUri  = "$supabaseUrl/rest/v1/$table?id=eq.$([Uri]::EscapeDataString($car.id))"
    $patchHeaders = $authHeaders.Clone()
    $patchHeaders["Content-Type"]  = "application/json"
    $patchHeaders["Prefer"]        = "return=minimal"

    $patchBody = @{ photo = $publicUrl } | ConvertTo-Json
    $patchBytes = [System.Text.Encoding]::UTF8.GetBytes($patchBody)

    try {
        Invoke-RestMethod -Method Patch -Uri $patchUri -Headers $patchHeaders -Body $patchBytes | Out-Null
        Write-Host "  OK  $($car.id)"
        Write-Host "      $publicUrl"
        $uploaded++
    } catch {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errBody = $reader.ReadToEnd()
        Write-Warning "  DB update failed for $($car.id): $errBody"
        $failed++
    }
}

Write-Host ""
Write-Host "Done."
Write-Host "  Uploaded + updated : $uploaded"
Write-Host "  Skipped (no file)  : $skipped"
Write-Host "  Failed             : $failed"
