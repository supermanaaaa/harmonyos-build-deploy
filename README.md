# HarmonyOS Build & Deploy

一键编译鸿蒙应用并部署到真机的自动化工具。支持 Windows、macOS、Linux。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
[![HarmonyOS](https://img.shields.io/badge/HarmonyOS-NEXT-red.svg)]()

## ✨ 功能特性

- 🚀 一键编译 + 安装到真机
- 🔄 支持 Debug / Release 模式切换
- 📱 自动检测连接的设备
- 🎯 自动定位 HAP 文件
- 🚀 可选安装后自动启动应用
- 🧹 支持编译前清理
- 🖥️ 跨平台支持（Windows / macOS / Linux）

## 📋 环境要求

- [DevEco Studio](https://developer.huawei.com/consumer/cn/deveco-studio/) 或独立 HarmonyOS SDK
- hvigorw 构建工具（随 DevEco Studio 安装）
- hdc 设备连接工具（随 SDK 安装）
- 已配置签名证书（真机安装必需）

## 🚀 快速开始

### 1. 下载脚本

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/harmonyos-build-deploy.git

# 或直接下载脚本到项目根目录
```

### 2. 复制到项目

将对应平台的脚本复制到你的鸿蒙项目根目录（与 `build-profile.json5` 同级）。

### 3. 运行

**Windows (PowerShell):**
```powershell
.\build_and_deploy.ps1
```

**macOS / Linux:**
```bash
chmod +x build_and_deploy.sh
./build_and_deploy.sh
```

## 📖 使用说明

### 编译部署脚本

#### Windows (PowerShell)

```powershell
# 基本用法 - 编译并安装
.\build_and_deploy.ps1

# Release 模式
.\build_and_deploy.ps1 -BuildMode release

# 安装后自动启动应用
.\build_and_deploy.ps1 -Launch

# 清理后重新编译
.\build_and_deploy.ps1 -Clean

# 跳过编译，直接安装已有 HAP
.\build_and_deploy.ps1 -SkipBuild

# 指定模块（多模块项目）
.\build_and_deploy.ps1 -Module feature

# 指定设备（多设备连接时）
.\build_and_deploy.ps1 -Device "YOUR_DEVICE_ID"

# 组合使用
.\build_and_deploy.ps1 -BuildMode release -Launch -Clean
```

#### macOS / Linux

```bash
# 基本用法 - 编译并安装
./build_and_deploy.sh

# Release 模式
./build_and_deploy.sh -b release

# 安装后自动启动应用
./build_and_deploy.sh -l

# 清理后重新编译
./build_and_deploy.sh -c

# 跳过编译，直接安装已有 HAP
./build_and_deploy.sh -s

# 指定模块
./build_and_deploy.sh -m feature

# 指定设备
./build_and_deploy.sh -d "YOUR_DEVICE_ID"

# 组合使用
./build_and_deploy.sh -b release -l -c
```

### 设备管理工具

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
├── README.md                    # 本文件
├── LICENSE                      # MIT 许可证
├── scripts/
│   ├── build_and_deploy.ps1    # Windows 编译部署脚本
│   ├── build_and_deploy.sh     # macOS/Linux 编译部署脚本
│   ├── device_manager.ps1      # Windows 设备管理工具
│   └── device_manager.sh       # macOS/Linux 设备管理工具
└── docs/
    └── signing-guide.md        # 签名配置指南
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[MIT License](LICENSE)

## 🔗 相关链接

- [HarmonyOS 开发者文档](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/application-dev-guide-V5)
- [DevEco Studio 下载](https://developer.huawei.com/consumer/cn/deveco-studio/)
- [hdc 命令参考](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/ide-hdc-V5)
