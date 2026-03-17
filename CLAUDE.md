# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HarmonyOS Build & Deploy is a zero-dependency Node.js CLI tool that automates HarmonyOS application building and deployment to real devices. It supports multi-module projects with dependency resolution, product variants, and multiple build modes.

## Common Commands

```bash
# Run the CLI (from project root or any HarmonyOS project)
npx harmonyos-deploy --all --launch

# Build and deploy in release mode
npx harmonyos-deploy --all --release --launch

# Skip build, install existing artifacts
npx harmonyos-deploy --all --skip-build --launch

# List available products/build modes/devices
npx harmonyos-deploy --list-products
npx harmonyos-deploy --list-build-modes
npx harmonyos-deploy --list-devices

# View help
node bin/harmonyos-deploy.js --help
```

There are no build, test, or lint commands for this project itself - it's a single-file CLI tool.

## Architecture

**Single-file implementation:** All logic is in `bin/harmonyos-deploy.js` (~2500 lines). No external dependencies.

### Key Functions

| Function | Purpose |
|----------|---------|
| `parseArgs()` | CLI argument parsing - add new flags here |
| `showHelp()` | Help text - update when adding flags |
| `findAllModules()` | Scans for modules with oh-package.json5 |
| `getModuleBuildOrder()` | Topological sort using Kahn's algorithm |
| `buildCommand()` | Generates hvigor build commands (handles v5.x vs v6.x) |
| `findHvigor()` | Locates hvigorw: --deveco-path → local → DevEco Studio (best match) → global |
| `ensureDevEcoSdkHome()` | Auto-detects and sets DEVECO_SDK_HOME |
| `getDevices()` / `getDeviceInfo()` | Device discovery via hdc |
| `findPackageFile()` | Locates compiled .hap/.hsp artifacts (with recursive fallback) |
| `parseJson5()` | Custom JSON5 parser (handles comments, unquoted keys) |
| `diagnoseBuildError()` | Intelligent error diagnostics with actionable fix suggestions |
| `startLogStream()` | Real-time device log streaming |
| `checkVersionCompatibility()` | Pre-build version mismatch detection |
| `autoFixVersions()` | Auto-fix modelVersion/targetSdkVersion mismatches |
| `runPreflightCheck()` | Comprehensive environment check (--check) |
| `getLocalSdkVersions()` | Scans installed SDK versions |

### Build Workflow

1. Parse CLI args → 2. Detect hvigorw/hdc → 3. Auto-detect DEVECO_SDK_HOME → 4. Load build-profile.json5 → 5. Scan modules (if --all), topological sort → 6. `ohpm install` → 7. Build each module via hvigor → 8. Collect signed artifacts → 9. Force-stop app → 10. Push to device → 11. `bm install` → 12. Launch (if --launch) → 13. Stream logs (if --log)

### Module Types

- **HAP**: Application package (entry point)
- **HSP**: Shared library (dynamic)
- **HAR**: Static library

Build order: HAR → HSP → HAP (dependencies first)

## Adding a New CLI Flag

1. Add option in `parseArgs()` switch-case
2. Add default value in options object
3. Update `showHelp()` with documentation
4. Implement handler logic in `main()` or relevant function

## External Tool Dependencies

- **hvigorw**: HarmonyOS build tool (via DevEco Studio)
- **hdc**: HarmonyOS Device Connector (via SDK)
- **ohpm**: OpenHarmony package manager
- Node.js >= 14.0.0

## Platform-Specific Paths

- Windows DevEco: `C:\Program Files\Huawei\DevEco Studio`
- macOS DevEco: `/Applications/DevEco-Studio.app`
- SDK auto-detected from standard installation locations

## File Structure

```
bin/harmonyos-deploy.js   # Main CLI (all logic here)
scripts/                  # Legacy shell scripts (basic functionality)
docs/                     # Testing guide, signing guide
```
