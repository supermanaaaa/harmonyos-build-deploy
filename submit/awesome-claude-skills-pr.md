# PR: Add harmonyos-build-deploy skill

## Description

Add HarmonyOS build and deploy skill for Claude Code.

## Changes to README.md

Add the following entry to the **Individual Skills** section:

```markdown
| **[harmonyos-build-deploy](https://github.com/supermanaaaa/harmonyos-build-deploy)** | HarmonyOS/鸿蒙 app build, sign, deploy to real devices, and APP packaging for AppGallery submission |
```

## Skill Details

- **Name**: harmonyos-build-deploy
- **Repository**: https://github.com/supermanaaaa/harmonyos-build-deploy
- **npm Package**: https://www.npmjs.com/package/harmonyos-deploy
- **License**: MIT

## Features

- Cross-platform: Windows / macOS / Linux. Auto-discovers DevEco Studio's hvigorw, hdc, ohpm and bundled JBR — no PATH setup required (v2.5+ / v2.6+)
- Tolerant SDK version matching (no silent rewrites of project source)
- One-command build and deploy for HarmonyOS apps
- Multi-module project support with dependency resolution (HAR → HSP → HAP)
- Product variants and build modes (debug/release/test/custom)
- APP packaging for AppGallery submission (--app flag)
- Real-time device log streaming
- Pre-flight environment check (--check)
- Skip-build safety checks

## Tested

- ✅ Tested with Claude Code on Windows and macOS
- ✅ End-to-end on a real multi-module project (ohpm install → assembleHap → bm install → aa start)
- ✅ Published to npm (v2.6.0)
- ✅ Used in production Jenkins CI/CD pipelines
