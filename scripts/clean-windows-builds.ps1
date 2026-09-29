<#
.SYNOPSIS
    Forge Wisper Windows Build Cache Cleanup Utility
.DESCRIPTION
    Safely removes build caches and temporary target artifacts (C:\t, target\, dist\, .vite\)
    with interactive confirmation protection and -Force bypass support.
#>

param (
    [Alias("f")]
    [switch]$Force,

    [Alias("h")]
    [switch]$Help
)

$ErrorActionPreference = "Continue"

if ($Help) {
    Write-Host "Usage: .\clean-windows-builds.ps1 [-Force] [-Help]" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Force, -f    Bypass confirmation prompt (non-interactive CI/CD mode)"
    Write-Host "  -Help, -h     Display this help message"
    exit 0
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       FORGE WISPER - BUILD CACHE CLEANUP               " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Get-FolderSizeString {
    param ($FolderPath)
    if (-not (Test-Path $FolderPath)) { return "Not present" }
    try {
        $measure = Get-ChildItem -Path $FolderPath -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum
        $bytes = $measure.Sum
        if (-not $bytes) { return "0 B" }
        if ($bytes -ge 1GB) { return "{0:N2} GB" -f ($bytes / 1GB) }
        if ($bytes -ge 1MB) { return "{0:N2} MB" -f ($bytes / 1MB) }
        if ($bytes -ge 1KB) { return "{0:N2} KB" -f ($bytes / 1KB) }
        return "$bytes B"
    } catch {
        return "Unknown size"
    }
}

$TargetsToClean = @(
    @{ Name = "Short Cargo Target (MAX_PATH)"; Path = "C:\t" },
    @{ Name = "Workspace Cargo Target";        Path = (Join-Path $WorkspaceRoot "target") },
    @{ Name = "Desktop Tauri Target";          Path = (Join-Path $WorkspaceRoot "apps\desktop\src-tauri\target") },
    @{ Name = "Frontend Distribution (dist)";  Path = (Join-Path $WorkspaceRoot "apps\desktop\dist") },
    @{ Name = "Frontend Vite Cache (.vite)";    Path = (Join-Path $WorkspaceRoot "apps\desktop\node_modules\.vite") }
)

Write-Host "Artifact targets identified for cleanup:" -ForegroundColor Yellow
$ExistingCount = 0

foreach ($target in $TargetsToClean) {
    $exists = Test-Path $target.Path
    if ($exists) {
        $ExistingCount++
        $size = Get-FolderSizeString $target.Path
        Write-Host "  [+] $($target.Name)" -ForegroundColor White
        Write-Host "      Path: $($target.Path)" -ForegroundColor DarkGray
        Write-Host "      Size: $size" -ForegroundColor DarkCyan
    } else {
        Write-Host "  [-] $($target.Name) (Not present)" -ForegroundColor DarkGray
    }
}

Write-Host ""

if ($ExistingCount -eq 0) {
    Write-Host "[OK] No build artifacts or caches to clean. Workspace is clean." -ForegroundColor Green
    exit 0
}

if (-not $Force) {
    $Response = Read-Host "Are you sure you want to permanently delete these build artifacts? (y/N)"
    if ($Response -notmatch "^[Yy]([Ee][Ss])?$") {
        Write-Host "[i] Cleanup cancelled by user. No files were deleted." -ForegroundColor DarkYellow
        exit 0
    }
}

Write-Host "Cleaning build artifacts..." -ForegroundColor Cyan

$SuccessCount = 0
foreach ($target in $TargetsToClean) {
    if (Test-Path $target.Path) {
        try {
            Remove-Item -Path $target.Path -Recurse -Force -ErrorAction Stop
            Write-Host "[OK] Removed: $($target.Path)" -ForegroundColor Green
            $SuccessCount++
        } catch {
            Write-Host "[!] Failed to remove $($target.Path): $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host "[OK] Cleaned $SuccessCount build artifact director(ies) successfully." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
