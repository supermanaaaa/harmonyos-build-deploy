<#
.SYNOPSIS
    HarmonyOS Build and Deploy Script (Windows PowerShell)

.PARAMETER Module
    Module name (default: entry)

.PARAMETER BuildMode
    Build mode: debug or release (default: debug)

.PARAMETER Device
    Target device ID (default: auto-select first device)

.PARAMETER SkipBuild
    Skip build, install only

.PARAMETER Launch
    Launch app after install

.PARAMETER Clean
    Clean before build

.EXAMPLE
    .\build_and_deploy.ps1
    .\build_and_deploy.ps1 -BuildMode release -Launch
    .\build_and_deploy.ps1 -SkipBuild
#>

param(
    [string]$Module = "entry",
    [ValidateSet("debug", "release")]
    [string]$BuildMode = "debug",
    [string]$Device = "",
    [switch]$SkipBuild,
    [switch]$Launch,
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

function Write-Info { param([string]$msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success { param([string]$msg) Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err { param([string]$msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

Write-Info "Working directory: $(Get-Location)"

# Check if HarmonyOS project
if (-not (Test-Path "build-profile.json5")) {
    Write-Err "Not a valid HarmonyOS project (missing build-profile.json5)"
    exit 1
}

# Find hvigor
$hvigorCmd = $null
if (Test-Path "hvigorw.bat") {
    $hvigorCmd = ".\hvigorw.bat"
}
elseif (Get-Command "hvigorw" -ErrorAction SilentlyContinue) {
    $hvigorCmd = "hvigorw"
}
else {
    Write-Err "Cannot find hvigorw build tool"
    Write-Info "Make sure hvigorw.bat exists in project root or install globally: npm install -g @ohos/hvigor-cli"
    exit 1
}

Write-Info "Using build tool: $hvigorCmd"

# Check hdc
if (-not (Get-Command "hdc" -ErrorAction SilentlyContinue)) {
    Write-Err "Cannot find hdc tool"
    Write-Info "Add HarmonyOS SDK toolchains to PATH"
    exit 1
}

# Get devices
Write-Info "Checking connected devices..."
$rawDevices = & hdc list targets 2>&1
$devices = $rawDevices | Where-Object { $_ -and ($_ -notmatch "^\[") -and ($_ -notmatch "Empty") }

if (-not $devices) {
    Write-Err "No device connected"
    Write-Info "Please check:"
    Write-Info "  1. Device connected via USB"
    Write-Info "  2. USB debugging enabled"
    Write-Info "  3. Computer authorized for debugging"
    exit 1
}

# Select device
if (-not $Device) {
    if ($devices -is [array]) {
        $Device = $devices[0]
        Write-Warn "Multiple devices found, using first: $Device"
    }
    else {
        $Device = $devices
    }
}

Write-Info "Target device: $Device"

# Clean
if ($Clean) {
    Write-Info "Cleaning build cache..."
    & $hvigorCmd clean --no-daemon 2>&1 | Out-Null
}

# Build
if (-not $SkipBuild) {
    Write-Info "Building project (mode: $BuildMode)..."
    
    $buildCmd = "$hvigorCmd assembleHap --mode module -p module=$Module@default -p product=default -p buildMode=$BuildMode --no-daemon"
    Write-Info "Executing: $buildCmd"
    
    & $hvigorCmd assembleHap --mode module -p "module=$Module@default" -p product=default -p "buildMode=$BuildMode" --no-daemon
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Build failed"
        exit 1
    }
    
    Write-Success "Build completed"
}

# Find HAP file
$hapDir = Join-Path $Module "build\default\outputs\default"
$hapFile = $null

$signedHap = Join-Path $hapDir "$Module-default-signed.hap"
$unsignedHap = Join-Path $hapDir "$Module-default-unsigned.hap"

if (Test-Path $signedHap) {
    $hapFile = $signedHap
}
elseif (Test-Path $unsignedHap) {
    $hapFile = $unsignedHap
    Write-Warn "Using unsigned HAP, may fail on real device"
}
else {
    $found = Get-ChildItem -Path $hapDir -Filter "*.hap" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $hapFile = $found.FullName
    }
}

if (-not $hapFile -or -not (Test-Path $hapFile)) {
    Write-Err "Cannot find HAP file"
    Write-Info "Expected path: $hapDir"
    exit 1
}

Write-Info "HAP file: $hapFile"

# Install
Write-Info "Installing to device $Device ..."

& hdc -t $Device install $hapFile

if ($LASTEXITCODE -ne 0) {
    Write-Err "Install failed"
    Write-Info "Common causes:"
    Write-Info "  1. Signature mismatch"
    Write-Info "  2. Device not authorized"
    Write-Info "  3. Version conflict (try uninstall first)"
    exit 1
}

Write-Success "Install completed!"

# Launch
if ($Launch) {
    $bundleName = $null
    $abilityName = "EntryAbility"
    
    $appJsonPath = "AppScope\app.json5"
    if (Test-Path $appJsonPath) {
        $content = Get-Content $appJsonPath -Raw
        if ($content -match '"bundleName"\s*:\s*"([^"]+)"') {
            $bundleName = $Matches[1]
        }
    }
    
    if ($bundleName) {
        Write-Info "Launching app: $bundleName / $abilityName"
        & hdc -t $Device shell aa start -a $abilityName -b $bundleName
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "Launch failed, please open app manually"
        }
    }
    else {
        Write-Warn "Cannot get bundle name, skip launch"
    }
}

Write-Success "Deploy completed!"
