# HarmonyOS Build & Deploy

一键编译鸿蒙应用并部署到真机的自动化工具。支持 Windows、macOS、Linux。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
[![HarmonyOS](https://img.shields.io/badge/HarmonyOS-NEXT-red.svg)]()
[![npm](https://img.shields.io/npm/v/harmonyos-deploy.svg)](https://www.npmjs.com/package/harmonyos-deploy)

## 🚀 一分钟上手（推荐）

在你的鸿蒙项目根目录运行：

```bash
# 编译并安装到真机
npx harmonyos-deploy

# Release 模式 + 安装后启动
npx harmonyos-deploy --release --launch

# 跳过编译，直接安装
npx harmonyos-deploy --skip-build
```

无需安装，开箱即用！

## ✨ 功能特性

- 🚀 一键编译 + 安装到真机
- 🔄 支持 Debug / Release 模式切换
- 📱 自动检测连接的设备
- 🎯 自动定位 HAP 文件
- 🚀 可选安装后自动启动应用
- 🧹 支持编译前清理
- 🖥️ 跨平台支持（Windows / macOS / Linux）

## 📋 环境要求

- [Node.js](https://nodejs.org/) 14.0+（推荐，用于 npx 方式）
- [DevEco Studio](https://developer.huawei.com/consumer/cn/deveco-studio/) 或独立 HarmonyOS SDK
- hvigorw 构建工具（随 DevEco Studio 安装）
- hdc 设备连接工具（随 SDK 安装）
- 已配置签名证书（真机安装必需）

## 📖 使用说明

### 方式一：npx（推荐）

无需安装，直接在项目目录运行：

```bash
# 基本用法 - 编译并安装
npx harmonyos-deploy

# Release 模式
npx harmonyos-deploy --release

# 安装后自动启动
npx harmonyos-deploy --launch

# 清理后重新编译
npx harmonyos-deploy --clean

# 跳过编译，直接安装
npx harmonyos-deploy --skip-build

# 指定模块（多模块项目）
npx harmonyos-deploy --module feature

# 指定设备
npx harmonyos-deploy --device YOUR_DEVICE_ID

# 组合使用
npx harmonyos-deploy --release --launch --clean
```

### 方式二：全局安装

```bash
npm install -g harmonyos-deploy

# 然后直接运行
harmonyos-deploy --release --launch
```

### 方式三：Shell 脚本

如果不想用 Node.js，也可以使用原生脚本：

**Windows (PowerShell):**
```powershell
.\scripts\build_and_deploy.ps1
.\scripts\build_and_deploy.ps1 -BuildMode release -Launch
```

**macOS / Linux:**
```bash
bash scripts/build_and_deploy.sh
bash scripts/build_and_deploy.sh -b release -l
```

## 🔧 CLI 参数对照表

| 功能 | npx / 全局安装 | PowerShell | Bash |
|------|---------------|------------|------|
| 编译+安装 | `npx harmonyos-deploy` | `.\build_and_deploy.ps1` | `./build_and_deploy.sh` |
| Release 模式 | `--release` | `-BuildMode release` | `-b release` |
| 安装后启动 | `--launch` 或 `-l` | `-Launch` | `-l` |
| 清理编译 | `--clean` 或 `-c` | `-Clean` | `-c` |
| 跳过编译 | `--skip-build` 或 `-s` | `-SkipBuild` | `-s` |
| 指定模块 | `--module <n>` | `-Module <n>` | `-m <n>` |
| 指定设备 | `--device <id>` | `-Device <id>` | `-d <id>` |

## 🛠️ 设备管理

#### Windows (PowerShell)

```powershell
# 查看连接的设备
.\device_manager.ps1 list

# 查看设备详细信息
.\device_manager.ps1 info

# 查看设备日志（实时）
.\device_manager.ps1 log

# 截取设备屏幕
.\device_manager.ps1 screenshot

# 重启 hdc 服务
.\device_manager.ps1 restart

# 卸载应用
.\device_manager.ps1 uninstall -Package com.example.myapp
```

#### macOS / Linux

```bash
# 查看连接的设备
./device_manager.sh list

# 查看设备详细信息
./device_manager.sh info

# 查看设备日志
./device_manager.sh log

# 截取设备屏幕
./device_manager.sh screenshot

# 重启 hdc 服务
./device_manager.sh restart-hdc

# 卸载应用
./device_manager.sh uninstall DEVICE_ID com.example.myapp
```

## 🔧 参数对照表

| 功能 | Windows (PowerShell) | macOS / Linux |
|------|---------------------|---------------|
| 编译+安装 | `.\build_and_deploy.ps1` | `./build_and_deploy.sh` |
| Release 模式 | `-BuildMode release` | `-b release` |
| 安装后启动 | `-Launch` | `-l` |
| 清理编译 | `-Clean` | `-c` |
| 跳过编译 | `-SkipBuild` | `-s` |
| 指定模块 | `-Module <name>` | `-m <name>` |
| 指定设备 | `-Device <id>` | `-d <id>` |

## ❓ 常见问题

### hdc 找不到

确保 HarmonyOS SDK 的 toolchains 目录已添加到系统 PATH：

- **Windows**: `C:\Users\<用户名>\AppData\Local\OpenHarmony\Sdk\<版本>\toolchains`
- **macOS**: `~/Library/OpenHarmony/Sdk/<版本>/toolchains`
- **Linux**: `~/OpenHarmony/Sdk/<版本>/toolchains`

### 设备连接不上

1. 检查 USB 线连接是否正常
2. 在设备上开启 USB 调试：设置 → 系统 → 开发者选项 → USB 调试
3. 在电脑上授权调试
4. 尝试重启 hdc 服务：
   ```bash
   hdc kill
   hdc start
   ```

### 签名错误

确保 `build-profile.json5` 中配置了正确的签名信息。详见 [签名配置指南](docs/signing-guide.md)。

### hvigorw 找不到

- 确保项目根目录有 `hvigorw`（macOS/Linux）或 `hvigorw.bat`（Windows）
- 或全局安装：`npm install -g @ohos/hvigor-cli`

### PowerShell 脚本执行策略

如果 Windows 提示脚本无法执行，运行：
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

## 📁 项目结构

```
harmonyos-build-deploy/
├── package.json                 # npm 包配置
├── bin/
│   └── harmonyos-deploy.js     # Node.js CLI 入口
├── scripts/
│   ├── build_and_deploy.ps1    # Windows 编译部署脚本
│   ├── build_and_deploy.sh     # macOS/Linux 编译部署脚本
│   ├── device_manager.ps1      # Windows 设备管理工具
│   └── device_manager.sh       # macOS/Linux 设备管理工具
├── docs/
│   └── signing-guide.md        # 签名配置指南
├── SKILL.md                    # Claude Skills 配置
├── README.md
└── LICENSE
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[MIT License](LICENSE)

## 🔗 相关链接

- [HarmonyOS 开发者文档](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/application-dev-guide-V5)
- [DevEco Studio 下载](https://developer.huawei.com/consumer/cn/deveco-studio/)
- [hdc 命令参考](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/ide-hdc-V5)
