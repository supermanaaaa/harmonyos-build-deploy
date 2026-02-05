---
name: harmonyos-build-deploy
description: >
  鸿蒙 HarmonyOS 应用自动编译、签名并部署到真机。当用户需要：(1) 编译鸿蒙项目生成 HAP/HSP 包，
  (2) 将应用安装到真机设备，(3) 一键编译+安装+启动，(4) 查看连接的鸿蒙设备，(5) 多模块项目依赖解析与全量编译，
  (6) 切换 product 构建变体（如测试/正式环境），(7) 切换 buildMode（debug/release/test/自定义），
  (8) 查看设备实时日志，(9) 打包生成 .app 文件用于上架 AppGallery，
  或提到 hvigor、hvigorw、hdc、HAP、HSP、APP、bm install、ohpm、hilog、AppGallery 等关键词时触发。
  也适用于用户需要修改、扩展或调试此部署脚本本身的场景。
---

# HarmonyOS Build & Deploy

一键编译、签名、部署鸿蒙应用到真机的 Node.js CLI 工具。

## Requirements

- Node.js >= 14
- DevEco Studio or standalone HarmonyOS SDK
- hvigorw (build tool, usually installed with DevEco)
- hdc (HarmonyOS Device Connector)
- ohpm (package manager)
- Configured signing certificate (required for real device installation)

## Quick Start

在鸿蒙项目根目录运行：

```bash
npx harmonyos-deploy --all --launch           # Build all + install + launch
npx harmonyos-deploy --all --release --launch # Release mode
npx harmonyos-deploy --all --skip-build       # Install existing build
npx harmonyos-deploy --log-only               # View device logs only
npx harmonyos-deploy --app --release          # Build .app for AppGallery
```

## Full CLI Reference

### Module Selection
| Flag | Description |
|------|-------------|
| `-a, --all` | Build all modules (auto-resolve dependency order) |
| `-m, --module <n>` | Build specific module only (default: entry) |

### Product Variant
| Flag | Description |
|------|-------------|
| `-p, --product <n>` | Product flavor from build-profile.json5 (default: default) |
| `--list-products` | List available products and exit |

### Build Mode
| Flag | Description |
|------|-------------|
| `-b, --build-mode <mode>` | Build mode (default: debug). Supports any value |
| `--debug` | Shorthand for `-b debug` |
| `--release` | Shorthand for `-b release` |
| `--test` | Shorthand for `-b test` |
| `--list-build-modes` | List build modes from build-profile.json5 |
| `--debuggable` | Force debuggable=true |
| `--no-debuggable` | Force debuggable=false |

debuggable auto-detection: release → false, others → true. Override with `--debuggable` / `--no-debuggable`.

### Device & Installation
| Flag | Description |
|------|-------------|
| `-d, --device <id>` | Target device ID (auto-select if omitted) |
| `--list-devices` | List all connected devices with details |
| `-s, --skip-build` | Skip build, install existing packages |
| `-l, --launch` | Launch app after installation |
| `-u, --uninstall` | Uninstall existing app before install |
| `-c, --clean` | Clean before build |

### Debugging & Logging
| Flag | Description |
|------|-------------|
| `--log` | Show real-time device log after deploy (Ctrl+C to stop) |
| `--log-only` | Only show device log, skip build and install |
| `--filter <tag>` | Filter log by tag (used with --log or --log-only) |

### APP Packaging (AppGallery)
| Flag | Description |
|------|-------------|
| `-A, --app` | APP packaging mode: build .app file for AppGallery (no device install) |
| `-o, --output <dir>` | Copy .app file to specified directory |
| `-n, --name <name>` | Custom output filename (e.g. `--name myapp.app`) |

```bash
npx harmonyos-deploy --app --release              # Build release .app
npx harmonyos-deploy --app -p default --release   # With specific product
npx harmonyos-deploy --app -o ./release           # Copy to output directory (auto-named: {product}_{timestamp}.app)
npx harmonyos-deploy --app -o . -n myapp.app      # Custom output filename
```

APP packaging uses `assembleApp` (project mode) with `debuggable=false`. Output: `build/outputs/{product}/*.app`

## Build Workflow

1. **Environment** — Find hvigorw/hvigor, detect hdc-connected devices
2. **Dependencies** — `ohpm install`
3. **Dependency Graph** — Scan modules, parse oh-package.json5, topological sort
4. **Compile** — Build in order: HAR → HSP → HAP, with buildMode + debuggable params
5. **Collect** — Gather signed .hap/.hsp from `build/{product}/outputs/default/`, include 3rd-party HSPs
6. **Force-stop** — Stop running app before install (prevents silent install failure)
7. **Push + Install** — `hdc file send` + `bm install -p` atomic install
8. **Launch** — `aa start` when `--launch` is set

## skip-build Safety Check

With `--skip-build`, the script reads compiler-generated `BuildProfile.ets` to extract `BUILD_MODE_NAME` and `PRODUCT_NAME`. On mismatch, installation is **blocked** with correct command suggestions.

## Build Command Format

```
# HAP/HSP/HAR (module mode - for device install)
hvigorw assembleHap --mode module -p module={name}@default -p product={product} -p buildMode={mode} -p debuggable={bool} --no-daemon

# APP (project mode - for AppGallery, always debuggable=false)
hvigorw --mode project -p product={product} -p buildMode={mode} -p debuggable=false assembleApp --no-daemon
```
HSP uses `assembleHsp`, HAR uses `assembleHar`.

## Output Path

```
# HAP/HSP (module output)
{module}/build/{product}/outputs/default/
├── {module}-default-signed.hap   # Signed HAP
└── {module}-default-signed.hsp   # Signed HSP

# APP (project output - for AppGallery)
build/outputs/{product}/
└── {AppName}-{product}_{version}_{timestamp}.app

# With -o option (auto-named)
{outputDir}/{product}_{YYYYMMDD_HHmmss}.app
```

Third-party HSPs: `build/cache/{product}/remote_hsp/`

## Legacy Scripts

| Platform | Build & Deploy | Device Manager |
|----------|---------------|----------------|
| Windows | `scripts/build_and_deploy.ps1` | `scripts/device_manager.ps1` |
| macOS/Linux | `scripts/build_and_deploy.sh` | `scripts/device_manager.sh` |

> Note: The Node.js CLI (`bin/harmonyos-deploy.js`) is the primary tool with full feature support. Shell scripts are maintained for basic compatibility.

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

### Install fails silently (app still shows old version)
The app was running during installation. The script now auto force-stops before install. If issue persists, use `--uninstall` flag.

## Modifying the Script

Single-file Node.js (~1900 lines), no external dependencies. Key functions:
- `parseArgs()` — CLI argument parsing
- `findAllModules()` — Module scanning
- `getModuleBuildOrder()` — Topological sort
- `findPackageFile()` — Artifact discovery
- `detectBuildProfile()` — Extract build metadata from BuildProfile.ets
- `getBundleName()` — Read bundleName from config
- `buildAppCommand()` — Generate assembleApp command for APP packaging
- `findAppFile()` — Locate .app file in build output (recursive, excludes unsigned)
- `formatFileSize()` — Format bytes to KB/MB for display

To add a new flag: update `parseArgs()` switch-case + options defaults + `showHelp()` text.
