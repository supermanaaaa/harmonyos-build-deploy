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
    [switch]$Clean,
    [switch]$All
)

$ErrorActionPreference = "Stop"

function Write-Info { param([string]$msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success { param([string]$msg) Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err { param([string]$msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# Scan %ProgramFiles%\Huawei for DevEco Studio installations.
function Get-DevEcoRoots {
    $roots = @()
    foreach ($pf in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if (-not $pf) { continue }
        $huawei = Join-Path $pf "Huawei"
        if (-not (Test-Path $huawei)) { continue }
        Get-ChildItem -Path $huawei -Directory -Filter "DevEco*" -ErrorAction SilentlyContinue | ForEach-Object {
            $studio = Join-Path $_.FullName "DevEco Studio"
            if (Test-Path $studio) { $roots += $studio }
        }
    }
    # Newest version first
    $roots | Sort-Object { (Split-Path -Leaf (Split-Path -Parent $_)) } -Descending
}

# Cross-platform tool resolver: PATH -> DevEco install -> user-level SDK.
# $SubPath is the path under <DevEco Studio>/ (e.g. tools\hvigor\bin\hvigorw.bat).
function Find-Tool {
    param([string]$Name, [string]$SubPath, [string]$ToolchainExe)

    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    if ($SubPath) {
        foreach ($root in (Get-DevEcoRoots)) {
            $candidate = Join-Path $root $SubPath
            if (Test-Path $candidate) { return $candidate }
        }
    }

    if ($ToolchainExe) {
        $sdkRoots = @()
        foreach ($root in (Get-DevEcoRoots)) { $sdkRoots += (Join-Path $root "sdk") }
        $sdkRoots += (Join-Path $env:LOCALAPPDATA "Huawei\sdk")
        $sdkRoots += (Join-Path $env:LOCALAPPDATA "OpenHarmony\Sdk")
        foreach ($root in $sdkRoots) {
            if (-not (Test-Path $root)) { continue }
            $found = Get-ChildItem -Path $root -Recurse -Filter $ToolchainExe -ErrorAction SilentlyContinue |
                     Where-Object { $_.FullName -like "*\toolchains\$ToolchainExe" } |
                     Select-Object -First 1
            if ($found) { return $found.FullName }
        }
    }
    return $null
}

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
else {
    $hvigorCmd = Find-Tool -Name "hvigorw" -SubPath "tools\hvigor\bin\hvigorw.bat"
}
if (-not $hvigorCmd) {
    Write-Err "Cannot find hvigorw build tool"
    Write-Info "Make sure hvigorw.bat exists in project root, install DevEco Studio, or run: npm install -g @ohos/hvigor-cli"
    exit 1
}

Write-Info "Using build tool: $hvigorCmd"

# Find hdc (auto-discover under DevEco install if not on PATH)
$hdc = Find-Tool -Name "hdc" -ToolchainExe "hdc.exe"
if (-not $hdc) {
    Write-Err "Cannot find hdc tool"
    Write-Info "Install DevEco Studio or add HarmonyOS SDK toolchains to PATH"
    exit 1
}
Write-Info "Using hdc: $hdc"

# Get devices
Write-Info "Checking connected devices..."
$rawDevices = & $hdc list targets 2>&1
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
    if ($All) {
        Write-Info "Building ALL modules (mode: $BuildMode)..."
        $buildCmd = "$hvigorCmd assembleHap -p product=default -p buildMode=$BuildMode --no-daemon"
        Write-Info "Executing: $buildCmd"
        
        try {
            $output = & $hvigorCmd assembleHap -p product=default -p "buildMode=$BuildMode" --no-daemon 2>&1
            $output | ForEach-Object { Write-Host $_ }
            
            if ($LASTEXITCODE -ne 0) {
                throw "Build failed with exit code $LASTEXITCODE"
            }
            
            Write-Success "Build completed"
        }
        catch {
            Write-Err "Build failed"
            Write-Host ""
            Write-Info "Common build errors:"
            Write-Info "  1. ArkTS syntax error - check the file and line number above"
            Write-Info "  2. Missing dependency - run: ohpm install"
            Write-Info "  3. SDK version mismatch - check compileSdkVersion in build-profile.json5"
            Write-Info "  4. Signing config error - check signingConfigs in build-profile.json5"
            exit 1
        }
    }
    else {
        Write-Info "Building module '$Module' (mode: $BuildMode)..."
        $buildCmd = "$hvigorCmd assembleHap --mode module -p module=$Module@default -p product=default -p buildMode=$BuildMode --no-daemon"
        Write-Info "Executing: $buildCmd"
        
        try {
            $output = & $hvigorCmd assembleHap --mode module -p "module=$Module@default" -p product=default -p "buildMode=$BuildMode" --no-daemon 2>&1
            $output | ForEach-Object { Write-Host $_ }
            
            if ($LASTEXITCODE -ne 0) {
                throw "Build failed with exit code $LASTEXITCODE"
            }
            
            Write-Success "Build completed"
        }
        catch {
            Write-Err "Build failed"
            Write-Host ""
            Write-Info "Common build errors:"
            Write-Info "  1. ArkTS syntax error - check the file and line number above"
            Write-Info "  2. Missing dependency - run: ohpm install"
            Write-Info "  3. SDK version mismatch - check compileSdkVersion in build-profile.json5"
            Write-Info "  4. Signing config error - check signingConfigs in build-profile.json5"
            Write-Host ""
            Write-Warn "TIP: For multi-module projects, try: -All to build all modules"
            exit 1
        }
    }
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

$installOutput = & $hdc -t $Device install $hapFile 2>&1
$installOutput | ForEach-Object { Write-Host $_ }

if ($LASTEXITCODE -ne 0) {
    Write-Err "Install failed"
    Write-Host ""
    Write-Info "Common causes:"
    Write-Info "  1. Signature mismatch - certificate does not match the one used previously"
    Write-Info "  2. Device not authorized - check developer options on device"
    Write-Info "  3. Version conflict - try uninstall first: hdc -t $Device uninstall <bundleName>"
    Write-Info "  4. Insufficient storage - free up space on device"
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
        & $hdc -t $Device shell aa start -a $abilityName -b $bundleName
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "Launch failed, please open app manually"
        }
    }
    else {
        Write-Warn "Cannot get bundle name, skip launch"
    }
}

Write-Success "Deploy completed!"
