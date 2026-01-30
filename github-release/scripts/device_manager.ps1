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

# Check hdc
if (-not (Get-Command "hdc" -ErrorAction SilentlyContinue)) {
    Write-Err "hdc not found, please add HarmonyOS SDK toolchains to PATH"
    exit 1
}

# Get first device if not specified
function Get-FirstDevice {
    $devices = & hdc list targets 2>&1 | Where-Object { $_ -and ($_ -notmatch "^\[") -and ($_ -notmatch "Empty") }
    if ($devices -is [array]) { return $devices[0] }
    return $devices
}

switch ($Command) {
    "list" {
        Write-Info "Connected devices:"
        $devices = & hdc list targets 2>&1 | Where-Object { $_ -and ($_ -notmatch "^\[") -and ($_ -notmatch "Empty") }
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
        $model = & hdc -t $Device shell getprop ro.product.model 2>&1
        $version = & hdc -t $Device shell getprop hw_sc.build.platform.version 2>&1
        $api = & hdc -t $Device shell getprop const.ohos.apiversion 2>&1
        Write-Host "Model: $model"
        Write-Host "System Version: $version"
        Write-Host "API Version: $api"
    }
    
    "log" {
        if (-not $Device) { $Device = Get-FirstDevice }
        if (-not $Device) { Write-Err "No device connected"; exit 1 }
        
        Write-Info "Viewing device log (Ctrl+C to exit)..."
        & hdc -t $Device hilog
    }
    
    "screenshot" {
        if (-not $Device) { $Device = Get-FirstDevice }
        if (-not $Device) { Write-Err "No device connected"; exit 1 }
        
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $filename = "screenshot_$timestamp.png"
        
        Write-Info "Taking screenshot..."
        & hdc -t $Device shell snapshot_display -f /data/local/tmp/screen.png
        & hdc -t $Device file recv /data/local/tmp/screen.png ".\$filename"
        & hdc -t $Device shell rm /data/local/tmp/screen.png
        Write-Success "Screenshot saved: $filename"
    }
    
    "restart" {
        Write-Info "Restarting hdc service..."
        & hdc kill 2>&1 | Out-Null
        Start-Sleep -Seconds 1
        & hdc start
        Start-Sleep -Seconds 2
        Write-Success "hdc service restarted"
        & hdc list targets
    }
    
    "uninstall" {
        if (-not $Device) { $Device = Get-FirstDevice }
        if (-not $Device) { Write-Err "No device connected"; exit 1 }
        if (-not $Package) { Write-Err "Please specify package name: -Package com.example.app"; exit 1 }
        
        Write-Info "Uninstalling $Package ..."
        & hdc -t $Device uninstall $Package
        Write-Success "Uninstall completed"
    }
}
