<#
.SYNOPSIS
    HarmonyOS Device Manager (Windows PowerShell)

.PARAMETER Command
    Command: list, info, log, screenshot, restart, uninstall

.PARAMETER Device
    Target device ID

.PARAMETER Package
    Package name (for uninstall)

.EXAMPLE
    .\device_manager.ps1 list
    .\device_manager.ps1 info
    .\device_manager.ps1 screenshot
    .\device_manager.ps1 uninstall -Package com.example.app
#>

param(
    [Parameter(Position=0)]
    [ValidateSet("list", "info", "log", "screenshot", "restart", "uninstall")]
    [string]$Command = "list",
    [string]$Device = "",
    [string]$Package = ""
)

function Write-Info { param([string]$msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success { param([string]$msg) Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-Err { param([string]$msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# Find hdc: PATH first, then DevEco Studio sdk\...\toolchains\hdc.exe
function Find-Hdc {
    $cmd = Get-Command "hdc" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $sdkRoots = @()
    foreach ($pf in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if (-not $pf) { continue }
        $huawei = Join-Path $pf "Huawei"
        if (-not (Test-Path $huawei)) { continue }
        Get-ChildItem -Path $huawei -Directory -Filter "DevEco*" -ErrorAction SilentlyContinue | ForEach-Object {
            $studio = Join-Path $_.FullName "DevEco Studio\sdk"
            if (Test-Path $studio) { $sdkRoots += $studio }
        }
    }
    $sdkRoots += (Join-Path $env:LOCALAPPDATA "Huawei\sdk")
    $sdkRoots += (Join-Path $env:LOCALAPPDATA "OpenHarmony\Sdk")

    foreach ($root in $sdkRoots) {
        if (-not (Test-Path $root)) { continue }
        $found = Get-ChildItem -Path $root -Recurse -Filter "hdc.exe" -ErrorAction SilentlyContinue |
                 Where-Object { $_.FullName -like "*\toolchains\hdc.exe" } |
                 Select-Object -First 1
        if ($found) { return $found.FullName }
    }
    return $null
}

$hdc = Find-Hdc
if (-not $hdc) {
    Write-Err "hdc not found. Install DevEco Studio or add HarmonyOS SDK toolchains to PATH."
    exit 1
}

# Get first device if not specified
function Get-FirstDevice {
    $devices = & $hdc list targets 2>&1 | Where-Object { $_ -and ($_ -notmatch "^\[") -and ($_ -notmatch "Empty") }
    if ($devices -is [array]) { return $devices[0] }
    return $devices
}

switch ($Command) {
    "list" {
        Write-Info "Connected devices:"
        $devices = & $hdc list targets 2>&1 | Where-Object { $_ -and ($_ -notmatch "^\[") -and ($_ -notmatch "Empty") }
        if (-not $devices) {
            Write-Err "No device connected"
        }
        else {
            $devices | ForEach-Object { Write-Host "  $_" }
        }
    }

    "info" {
        if (-not $Device) { $Device = Get-FirstDevice }
        if (-not $Device) { Write-Err "No device connected"; exit 1 }

        Write-Info "Device info: $Device"
        Write-Host "----------------------------------------"
        # HarmonyOS uses `param get`; Android's `getprop` returns empty on HarmonyOS devices.
        $brand   = & $hdc -t $Device shell param get const.product.brand 2>&1
        $model   = & $hdc -t $Device shell param get const.product.model 2>&1
        $version = & $hdc -t $Device shell param get const.product.software.version 2>&1
        $api     = & $hdc -t $Device shell param get const.ohos.apiversion 2>&1
        Write-Host "Brand: $brand"
        Write-Host "Model: $model"
        Write-Host "System Version: $version"
        Write-Host "API Version: $api"
    }

    "log" {
        if (-not $Device) { $Device = Get-FirstDevice }
        if (-not $Device) { Write-Err "No device connected"; exit 1 }

        Write-Info "Viewing device log (Ctrl+C to exit)..."
        & $hdc -t $Device hilog
    }

    "screenshot" {
        if (-not $Device) { $Device = Get-FirstDevice }
        if (-not $Device) { Write-Err "No device connected"; exit 1 }

        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $filename = "screenshot_$timestamp.png"

        Write-Info "Taking screenshot..."
        & $hdc -t $Device shell snapshot_display -f /data/local/tmp/screen.png
        & $hdc -t $Device file recv /data/local/tmp/screen.png ".\$filename"
        & $hdc -t $Device shell rm /data/local/tmp/screen.png
        Write-Success "Screenshot saved: $filename"
    }

    "restart" {
        Write-Info "Restarting hdc service..."
        & $hdc kill 2>&1 | Out-Null
        Start-Sleep -Seconds 1
        & $hdc start
        Start-Sleep -Seconds 2
        Write-Success "hdc service restarted"
        & $hdc list targets
    }

    "uninstall" {
        if (-not $Device) { $Device = Get-FirstDevice }
        if (-not $Device) { Write-Err "No device connected"; exit 1 }
        if (-not $Package) { Write-Err "Please specify package name: -Package com.example.app"; exit 1 }

        Write-Info "Uninstalling $Package ..."
        & $hdc -t $Device uninstall $Package
        Write-Success "Uninstall completed"
    }
}
