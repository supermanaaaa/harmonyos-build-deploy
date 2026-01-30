---
name: harmonyos-build-deploy
description: HarmonyOS build and deploy automation. Compile HarmonyOS apps and install to real devices with one command. Supports Windows (PowerShell), macOS, and Linux. Use when user needs to: (1) Build HarmonyOS project to generate HAP/APP package, (2) Install app to real device, (3) One-click build + install, (4) View connected HarmonyOS devices, or mentions hvigor, hdc, HAP installation.
---

# HarmonyOS Build & Deploy

Automate HarmonyOS app compilation, signing, and deployment to real devices. Cross-platform support for Windows, macOS, and Linux.

## Requirements

- DevEco Studio or standalone HarmonyOS SDK
- hvigorw (build tool, usually installed with DevEco)
- hdc (HarmonyOS Device Connector)
- Configured signing certificate (required for real device installation)

## Quick Commands

### List connected devices
```bash
hdc list targets
```

### Build project (Debug)
```bash
# macOS / Linux
./hvigorw assembleHap --mode module -p product=default -p buildMode=debug --no-daemon

# Windows (PowerShell)
.\hvigorw.bat assembleHap --mode module -p product=default -p buildMode=debug --no-daemon
```

### Install to device
```bash
hdc -t <device-id> install <path-to-hap>
```

### Launch app
```bash
hdc -t <device-id> shell aa start -a <AbilityName> -b <bundleName>
```

## Scripts

| Platform | Build & Deploy | Device Manager |
|----------|---------------|----------------|
| Windows | `scripts/build_and_deploy.ps1` | `scripts/device_manager.ps1` |
| macOS/Linux | `scripts/build_and_deploy.sh` | `scripts/device_manager.sh` |

### Windows (PowerShell)
```powershell
.\scripts\build_and_deploy.ps1                    # Build and install
.\scripts\build_and_deploy.ps1 -BuildMode release # Release mode
.\scripts\build_and_deploy.ps1 -Launch            # Launch after install
.\scripts\build_and_deploy.ps1 -Clean             # Clean before build
.\scripts\build_and_deploy.ps1 -SkipBuild         # Skip build, install only
```

### macOS / Linux
```bash
bash scripts/build_and_deploy.sh                  # Build and install
bash scripts/build_and_deploy.sh -b release       # Release mode
bash scripts/build_and_deploy.sh -l               # Launch after install
bash scripts/build_and_deploy.sh -c               # Clean before build
bash scripts/build_and_deploy.sh -s               # Skip build, install only
```

## Troubleshooting

### hdc not found
Add HarmonyOS SDK toolchains to system PATH:
- Windows: `C:\Users\<username>\AppData\Local\OpenHarmony\Sdk\<version>\toolchains`
- macOS: `~/Library/OpenHarmony/Sdk/<version>/toolchains`

### Device not connected
1. Enable USB debugging: Settings → System → Developer Options → USB Debugging
2. Restart hdc service: `hdc kill && hdc start`

### Signing error
Configure signing in `build-profile.json5`. See `docs/signing-guide.md` for details.

## Output Path

Build artifacts are located at:
```
entry/build/default/outputs/default/
├── entry-default-signed.hap      # Signed HAP
└── entry-default-unsigned.hap    # Unsigned HAP
```
