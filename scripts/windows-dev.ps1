<#
.SYNOPSIS
    Forge Wisper Windows Development Environment Launcher
.DESCRIPTION
    Discovers installed toolchains (Rust, MSVC, CMake, Vulkan), configures
    MAX_PATH-resistant cargo target directory (C:\t), and starts the Tauri dev server.
#>

param (
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$PassThruArgs
)

$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       FORGE WISPER - WINDOWS DEV ENVIRONMENT           " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Rust Toolchain Discovery
$RustPaths = @(
    "$env:USERPROFILE\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin",
    "$env:USERPROFILE\.cargo\bin"
)

foreach ($p in $RustPaths) {
    if ((Test-Path $p) -and ($env:PATH -notlike "*$p*")) {
        $env:PATH = "$p;$env:PATH"
    }
}

try {
    $RustVersion = (& rustc --version 2>&1).Trim()
    $CargoVersion = (& cargo --version 2>&1).Trim()
    Write-Host "[OK] Rust Toolchain:  $RustVersion" -ForegroundColor Green
    Write-Host "[OK] Cargo Package:   $CargoVersion" -ForegroundColor Green
} catch {
    Write-Host "[!] Rust toolchain not detected in PATH or standard rustup folders." -ForegroundColor Red
    Write-Host "    Install Rust via: https://rustup.rs" -ForegroundColor Yellow
    exit 1
}

# 2. CMake Discovery
$CmakePaths = @(
    "C:\Program Files\CMake\bin",
    "C:\Program Files (x86)\CMake\bin"
)

foreach ($p in $CmakePaths) {
    if ((Test-Path $p) -and ($env:PATH -notlike "*$p*")) {
        $env:PATH = "$p;$env:PATH"
    }
}

try {
    $CmakeVer = (& cmake --version 2>&1)[0].Trim()
    Write-Host "[OK] CMake Engine:    $CmakeVer" -ForegroundColor Green
} catch {
    Write-Host "[!] CMake not detected. Local whisper C++ compilation may require CMake." -ForegroundColor Yellow
}

# 3. MSVC Build Tools & Linker Discovery
$VSLocations = @(
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools",
    "C:\Program Files\Microsoft Visual Studio\2022\BuildTools",
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\Community",
    "C:\Program Files\Microsoft Visual Studio\2022\Community",
    "C:\Program Files\Microsoft Visual Studio\2022\Professional",
    "C:\Program Files\Microsoft Visual Studio\2022\Enterprise"
)

$MsvcBinFound = $false
foreach ($vs in $VSLocations) {
    $MsvcToolsDir = Join-Path $vs "VC\Tools\MSVC"
    if (Test-Path $MsvcToolsDir) {
        $LatestVersion = Get-ChildItem -Path $MsvcToolsDir | Sort-Object Name -Descending | Select-Object -First 1
        if ($LatestVersion) {
            $MsvcBin = Join-Path $LatestVersion.FullName "bin\Hostx64\x64"
            if ((Test-Path (Join-Path $MsvcBin "link.exe")) -and ($env:PATH -notlike "*$MsvcBin*")) {
                $env:PATH = "$MsvcBin;$env:PATH"
                $VerName = $LatestVersion.Name
                Write-Host "[OK] MSVC Linker:     $VerName (Hostx64\x64\link.exe)" -ForegroundColor Green
                $MsvcBinFound = $true
                break
            }
        }
    }
}

if (-not $MsvcBinFound) {
    try {
        $LinkVer = (& link.exe /? 2>&1)[0].Trim()
        Write-Host "[OK] MSVC Linker:     $LinkVer" -ForegroundColor Green
    } catch {
        Write-Host "[i] Visual Studio MSVC linker not found in standard paths; relying on system linker." -ForegroundColor DarkGray
    }
}

# 4. Vulkan GPU Runtime Check
$VulkanDll = "C:\Windows\System32\vulkan-1.dll"
if (Test-Path $VulkanDll) {
    Write-Host "[OK] Vulkan Runtime:  Present ($VulkanDll)" -ForegroundColor Green
} else {
    Write-Host "[!] Vulkan driver runtime not found in System32. GPU acceleration might be disabled." -ForegroundColor Yellow
}

# 5. MAX_PATH Bypass: Short Target Directory (C:\t)
$TargetDir = "C:\t"
try {
    if (-not (Test-Path $TargetDir)) {
        New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    }
    $env:CARGO_TARGET_DIR = $TargetDir
    Write-Host "[OK] Target Cache:    $TargetDir (MAX_PATH bypass active)" -ForegroundColor Green
} catch {
    $FallbackDir = Join-Path $PSScriptRoot "..\target"
    $env:CARGO_TARGET_DIR = $FallbackDir
    Write-Host "[i] Target Cache:    $FallbackDir (Default workspace target)" -ForegroundColor Yellow
}

Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host "Launching Forge Wisper Tauri Dev Server..." -ForegroundColor Cyan
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan

$WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location (Join-Path $WorkspaceRoot "apps\desktop")

$TauriArgs = @("tauri", "dev")
if ($PassThruArgs -and $PassThruArgs.Count -gt 0) {
    if ($PassThruArgs[0] -eq "dev") {
        $SubArgs = $PassThruArgs | Select-Object -Skip 1
        if ($SubArgs) { $TauriArgs += $SubArgs }
    } else {
        $TauriArgs += $PassThruArgs
    }
}

& npx @TauriArgs
