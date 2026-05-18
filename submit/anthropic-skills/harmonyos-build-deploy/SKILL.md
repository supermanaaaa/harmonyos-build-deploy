---
name: harmonyos-build-deploy
description: >
  Build, sign, and deploy HarmonyOS/鸿蒙 applications to real devices on Windows, macOS, and Linux.
  Auto-discovers hvigorw / hdc / ohpm / JBR from DevEco Studio so no manual PATH setup is required.
  Supports multi-module projects with dependency resolution, product variants, build modes
  (debug/release/test), tolerant SDK-version matching, real-time device logs, and APP packaging
  for AppGallery submission. Triggers on keywords: HarmonyOS, 鸿蒙, hvigor, hdc, HAP, HSP, AppGallery.
---

# HarmonyOS Build & Deploy

One-command build, sign, and deploy for HarmonyOS applications. Works on Windows, macOS, and Linux
out of the box — installing DevEco Studio is enough; the CLI locates the SDK toolchains, ohpm, and
the bundled JBR automatically.

## Requirements

- Node.js >= 14
- DevEco Studio (any 5.x or 6.x) — provides hvigorw, hdc, ohpm, and a bundled JBR
- Configured signing certificate (for real-device installation)

## Pre-flight Check

Run `npx harmonyos-deploy --check` to verify the environment (Node, DEVECO_SDK_HOME, JAVA_HOME,
hvigorw, hdc, ohpm, connected devices, signing config, modelVersion consistency, and target SDK
compatibility).

## Quick Start

```bash
npx harmonyos-deploy --all --launch           # Build all + install + launch
npx harmonyos-deploy --all --release --launch # Release mode
npx harmonyos-deploy --app --release          # Build .app for AppGallery
```

## CLI Reference

### Build Options
| Flag | Description |
|------|-------------|
| `-a, --all` | Build all modules (auto dependency order) |
| `-m, --module <n>` | Build specific module (default: entry) |
| `-p, --product <n>` | Product flavor (default: default) |
| `-b, --build-mode <mode>` | Build mode: debug, release, test |
| `--release` | Shorthand for `-b release` |

### Device Options
| Flag | Description |
|------|-------------|
| `-d, --device <id>` | Target device ID |
| `-l, --launch` | Launch app after install |
| `-u, --uninstall` | Uninstall before install |
| `--list-devices` | List connected devices |

### APP Packaging (AppGallery)
| Flag | Description |
|------|-------------|
| `-A, --app` | Build .app for AppGallery |
| `-o, --output <dir>` | Output directory |
| `-n, --name <name>` | Custom filename |

### Logging
| Flag | Description |
|------|-------------|
| `--log` | Show device log after deploy |
| `--log-only` | Only show log, skip build |
| `--filter <tag>` | Filter log by tag |

## Build Commands

```bash
# HAP/HSP (device install)
hvigorw assembleHap --mode module -p product={product} -p buildMode={mode} --no-daemon

# APP (AppGallery, always debuggable=false)
hvigorw --mode project -p product={product} -p buildMode={mode} -p debuggable=false assembleApp --no-daemon
```

## Output Paths

```
# HAP/HSP
{module}/build/{product}/outputs/default/*.hap

# APP
build/outputs/{product}/*.app
```

## Examples

```bash
# Full workflow
npx harmonyos-deploy --all --release --launch --log

# Different products
npx harmonyos-deploy --all -p production --release
npx harmonyos-deploy --all -p staging --debug

# APP for store submission
npx harmonyos-deploy --app -p production --release -o ./dist -n MyApp.app

# Debug with logs
npx harmonyos-deploy --log-only --filter MyTag
```

## Troubleshooting

- **hdc / hvigorw / ohpm not found**: v2.5+ auto-discovers them from DevEco Studio's install dir on Windows, macOS, and Linux. If detection still misses, run `--check` to see the candidate paths and fall back to adding SDK toolchains to PATH.
- **"Unable to locate a Java Runtime"** (PackageHap on macOS): v2.6+ auto-sets `JAVA_HOME` to DevEco's bundled JBR. If hit on an older version, export it manually: `export JAVA_HOME="/Applications/DevEco-Studio.app/Contents/jbr/Contents/Home"`.
- **targetSdkVersion not installed locally**: v2.6+ accepts any local SDK whose API ≥ project target (hvigor 6+ behaviour). To use the exact declared version, install it via DevEco Studio → SDK Manager.
- **Signing error**: Configure signing in `build-profile.json5`.
- **Install fails silently**: Tool auto force-stops the app before install; if still stuck, use `--uninstall` for a clean install.

## Links

- npm: https://www.npmjs.com/package/harmonyos-deploy
- GitHub: https://github.com/supermanaaaa/harmonyos-build-deploy
