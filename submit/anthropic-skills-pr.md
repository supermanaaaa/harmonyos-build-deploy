# PR: Add harmonyos-build-deploy skill

## Summary

Add a skill for building, signing, and deploying HarmonyOS (鸿蒙) applications to real devices.

## Skill Overview

**harmonyos-build-deploy** is a zero-dependency Node.js CLI tool that automates HarmonyOS application building and deployment. It's designed for developers working with Huawei's HarmonyOS ecosystem.

### Key Features

- **Cross-platform out of the box**: Windows, macOS, and Linux. Auto-discovers hvigorw / hdc / ohpm / JBR from DevEco Studio's install dir — no PATH setup required (v2.5+ / v2.6+).
- **Tolerant SDK version matching**: Uses any locally installed SDK whose API ≥ project target; never silently rewrites the user's `build-profile.json5`.
- **Multi-module support**: Automatically resolves dependencies and builds in correct order (HAR → HSP → HAP).
- **Product variants**: Switch between environments (test/staging/production) with different signing configs.
- **Build modes**: debug, release, test, or custom modes.
- **APP packaging**: Generate `.app` files for AppGallery submission.
- **Device management**: Auto-detect devices, real-time log streaming.
- **Pre-flight check**: `--check` validates Node, DEVECO_SDK_HOME, JAVA_HOME, hvigorw, hdc, ohpm, devices, signing, modelVersion consistency, and target SDK compatibility.
- **CI/CD ready**: Used in Jenkins pipelines for automated builds.

### Use Cases

1. Build and deploy HarmonyOS apps to physical devices
2. Generate signed APP packages for AppGallery store submission
3. Debug with real-time device log streaming
4. Automate builds in CI/CD pipelines

## Files Added

```
skills/Development & Technical/harmonyos-build-deploy/
└── SKILL.md
```

## Testing

- ✅ Tested with Claude Code on Windows and macOS (end-to-end on a real multi-module HarmonyOS project: ohpm install → assembleHap → bm install → aa start)
- ✅ Published to npm as `harmonyos-deploy` (v2.6.0)
- ✅ Used in production CI/CD environments

## External Resources

- **npm**: https://www.npmjs.com/package/harmonyos-deploy
- **GitHub**: https://github.com/supermanaaaa/harmonyos-build-deploy
- **License**: MIT

## Checklist

- [x] SKILL.md includes required frontmatter (name, description)
- [x] Description clearly explains when to trigger the skill
- [x] Examples provided for common use cases
- [x] Tested in Claude Code environment
- [x] No sensitive information included
