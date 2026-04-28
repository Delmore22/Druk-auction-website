<#
.SYNOPSIS
    Migrates data and storage from Ideas Project + Vehicle-submissions into Collectors-Alliance.

.DESCRIPTION
    Step 1 — Copy brainstorming_entries rows (rewrites attachment URLs to new project)
    Step 2 — Copy vehicle_submissions rows
    Step 3 — Migrate brainstorming-images storage files
    Step 4 — Migrate vehicle-submission-photos storage files

.NOTES
    Run AFTER running collectors-alliance-schema.sql in the Collectors-Alliance SQL editor.
    Safe to re-run: existing rows are skipped (upsert on id).
#>

# ── Project configuration ─────────────────────────────────────────────────────

$IDEAS_URL      = 'https://bppzipqgjbgoujhuhumv.supabase.co'
$IDEAS_KEY      = 'sb_publishable_fhbMCTW54ZynuHRmyGoFww_wQbfEAtG'

$VEHICLES_URL   = 'https://wmmbvtxwihrbclpfukzy.supabase.co'
$VEHICLES_KEY   = 'sb_publishable_67gDlL-KhfWjH-AnrqaJGw_dh9L88RZ'

$NEW_URL         = 'https://chllzkgugwuerlnbltay.supabase.co'
$NEW_KEY         = 'sb_publishable_rpzSMoGHXVKEIRwipYmrHg_64fqgX0y'
# Service role key — bypasses RLS for migration inserts only
$NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNobGx6a2d1Z3d1ZXJsbmJsdGF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM5ODY1MCwiZXhwIjoyMDkyOTc0NjUwfQ.gC3kfs6ehgyTbW6dlEYdmMQV3SsVzgXQhTKM8oSy1rw'

# ── Helpers ───────────────────────────────────────────────────────────────────

function Get-SupabaseRows {
    param([string]$BaseUrl, [string]$Key, [string]$Table)
    $uri = "$BaseUrl/rest/v1/$Table`?select=*"
    $headers = @{
        'apikey'        = $Key
        'Authorization' = "Bearer $Key"
    }
    $resp = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get -ErrorAction Stop
    return $resp
}

function Upsert-SupabaseRows {
    param([string]$BaseUrl, [string]$Key, [string]$Table, [object[]]$Rows)
    if ($Rows.Count -eq 0) { return }
    $uri = "$BaseUrl/rest/v1/$Table"
    $headers = @{
        'apikey'         = $Key
        'Authorization'  = "Bearer $Key"
        'Content-Type'   = 'application/json'
        'Prefer'         = 'resolution=ignore-duplicates,return=minimal'
    }
    # Batch in chunks of 100 to avoid request size limits
    $chunkSize = 100
    for ($i = 0; $i -lt $Rows.Count; $i += $chunkSize) {
        $chunk = $Rows[$i..([Math]::Min($i + $chunkSize - 1, $Rows.Count - 1))]
        $body = @($chunk) | ConvertTo-Json -Depth 20 -Compress
        Invoke-RestMethod -Uri $uri -Headers $headers -Method Post -Body $body -ErrorAction Stop | Out-Null
    }
}

function List-StorageFiles {
    param([string]$BaseUrl, [string]$Key, [string]$Bucket, [string]$Prefix = '')
    $uri = "$BaseUrl/storage/v1/object/list/$Bucket"
    $headers = @{
        'apikey'        = $Key
        'Authorization' = "Bearer $Key"
        'Content-Type'  = 'application/json'
    }
    $body = @{ prefix = $Prefix; limit = 1000; offset = 0 } | ConvertTo-Json
    $resp = Invoke-RestMethod -Uri $uri -Headers $headers -Method Post -Body $body -ErrorAction Stop
    return $resp
}

function Download-StorageFile {
    param([string]$BaseUrl, [string]$Bucket, [string]$FilePath)
    $uri = "$BaseUrl/storage/v1/object/public/$Bucket/$FilePath"
    $tmpFile = [System.IO.Path]::GetTempFileName()
    Invoke-WebRequest -Uri $uri -OutFile $tmpFile -ErrorAction Stop
    return $tmpFile
}

function Upload-StorageFile {
    param([string]$BaseUrl, [string]$Key, [string]$Bucket, [string]$FilePath, [string]$LocalFile, [string]$ContentType)
    $uri = "$BaseUrl/storage/v1/object/$Bucket/$FilePath"
    $headers = @{
        'apikey'        = $Key
        'Authorization' = "Bearer $Key"
        'Content-Type'  = $ContentType
        'x-upsert'      = 'true'
    }
    $bytes = [System.IO.File]::ReadAllBytes($LocalFile)
    Invoke-RestMethod -Uri $uri -Headers $headers -Method Post -Body $bytes -ErrorAction Stop | Out-Null
}

function Guess-ContentType {
    param([string]$FileName)
    $ext = [System.IO.Path]::GetExtension($FileName).ToLower()
    switch ($ext) {
        '.jpg'  { return 'image/jpeg' }
        '.jpeg' { return 'image/jpeg' }
        '.png'  { return 'image/png' }
        '.gif'  { return 'image/gif' }
        '.webp' { return 'image/webp' }
        '.pdf'  { return 'application/pdf' }
        default { return 'application/octet-stream' }
    }
}

function Get-AllStorageFiles {
    param([string]$BaseUrl, [string]$Key, [string]$Bucket, [string]$Prefix = '')
    $items = List-StorageFiles -BaseUrl $BaseUrl -Key $Key -Bucket $Bucket -Prefix $Prefix
    $allFiles = @()
    foreach ($item in $items) {
        if (-not $item.name -or $item.name -eq '') { continue }
        $fullPath = if ($Prefix) { "$Prefix/$($item.name)" } else { $item.name }
        # If item has no id it's a folder prefix — recurse into it
        if (-not $item.id) {
            $allFiles += Get-AllStorageFiles -BaseUrl $BaseUrl -Key $Key -Bucket $Bucket -Prefix $fullPath
        } else {
            $allFiles += $fullPath
        }
    }
    return $allFiles
}

function Migrate-StorageBucket {
    param([string]$SrcUrl, [string]$SrcKey, [string]$DstUrl, [string]$DstKey, [string]$Bucket)
    Write-Host "`n  Scanning $Bucket (recursive) ..." -ForegroundColor Cyan
    $allFiles = Get-AllStorageFiles -BaseUrl $SrcUrl -Key $SrcKey -Bucket $Bucket
    Write-Host "  Found $($allFiles.Count) file(s)" -ForegroundColor Cyan

    foreach ($filePath in $allFiles) {
        Write-Host "  Copying $filePath ..." -NoNewline
        try {
            $tmp = Download-StorageFile -BaseUrl $SrcUrl -Bucket $Bucket -FilePath $filePath
            $ct  = Guess-ContentType -FileName $filePath
            Upload-StorageFile -BaseUrl $DstUrl -Key $DstKey -Bucket $Bucket -FilePath $filePath -LocalFile $tmp -ContentType $ct
            Remove-Item $tmp -Force -ErrorAction SilentlyContinue
            Write-Host " OK" -ForegroundColor Green
        } catch {
            Write-Host " FAILED: $_" -ForegroundColor Red
        }
    }
}

# ── Step 1: Migrate brainstorming_entries ─────────────────────────────────────

Write-Host "`n[1/4] Migrating brainstorming_entries from Ideas Project..." -ForegroundColor Yellow

$rows = Get-SupabaseRows -BaseUrl $IDEAS_URL -Key $IDEAS_KEY -Table 'brainstorming_entries'
Write-Host "  Found $($rows.Count) row(s)"

# Rewrite attachment URLs to point to new project
$updated = $rows | ForEach-Object {
    $row = $_
    if ($row.attachments) {
        $attJson = $row.attachments | ConvertTo-Json -Depth 10 -Compress
        $attJson = $attJson -replace [regex]::Escape($IDEAS_URL), $NEW_URL
        $row.attachments = $attJson | ConvertFrom-Json
    }
    $row
}

Upsert-SupabaseRows -BaseUrl $NEW_URL -Key $NEW_SERVICE_KEY -Table 'brainstorming_entries' -Rows $updated
Write-Host "  Done." -ForegroundColor Green

# ── Step 2: Migrate vehicle_submissions ───────────────────────────────────────

Write-Host "`n[2/4] Migrating vehicle_submissions from Vehicle-submissions..." -ForegroundColor Yellow

$rows = Get-SupabaseRows -BaseUrl $VEHICLES_URL -Key $VEHICLES_KEY -Table 'vehicle_submissions'
Write-Host "  Found $($rows.Count) row(s)"

Upsert-SupabaseRows -BaseUrl $NEW_URL -Key $NEW_SERVICE_KEY -Table 'vehicle_submissions' -Rows $rows
Write-Host "  Done." -ForegroundColor Green

# ── Step 3: Migrate brainstorming-images storage ──────────────────────────────

Write-Host "`n[3/4] Migrating brainstorming-images storage..." -ForegroundColor Yellow
Migrate-StorageBucket -SrcUrl $IDEAS_URL -SrcKey $IDEAS_KEY -DstUrl $NEW_URL -DstKey $NEW_SERVICE_KEY -Bucket 'brainstorming-images'

# ── Step 4: Migrate vehicle-submission-photos storage ─────────────────────────

Write-Host "`n[4/4] Migrating vehicle-submission-photos storage..." -ForegroundColor Yellow
Migrate-StorageBucket -SrcUrl $VEHICLES_URL -SrcKey $VEHICLES_KEY -DstUrl $NEW_URL -DstKey $NEW_SERVICE_KEY -Bucket 'vehicle-submission-photos'

Write-Host "`nMigration complete!" -ForegroundColor Green
Write-Host "Next step: update brainstorming.supabase-config.js and add-vehicle.supabase-config.js with the new project URL and key." -ForegroundColor Cyan
