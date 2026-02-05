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

- One-command build and deploy for HarmonyOS apps
- Multi-module project support with dependency resolution
- Product variants and build modes (debug/release/test)
- APP packaging for AppGallery submission (--app flag)
- Real-time device log streaming
- Skip-build safety checks

## Tested

- ✅ Tested with Claude Code
- ✅ Published to npm (v2.3.1)
- ✅ Used in production Jenkins CI/CD pipelines
