# HarmonyOS Build & Deploy

一键编译鸿蒙应用并部署到真机的自动化工具。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
[![HarmonyOS](https://img.shields.io/badge/HarmonyOS-NEXT-red.svg)]()
[![npm](https://img.shields.io/npm/v/harmonyos-deploy.svg)](https://www.npmjs.com/package/harmonyos-deploy)

## 🚀 一分钟上手

在你的鸿蒙项目根目录运行：

```bash
# 全量编译 + 安装 + 启动
npx harmonyos-deploy --all --launch

# Release 模式
npx harmonyos-deploy --all --release --launch

# 跳过编译，直接安装
npx harmonyos-deploy --all --skip-build --launch
```

## ✨ 功能特性

- 🔨 **全量编译** — 自动解析模块依赖，按正确顺序编译 HAR → HSP → HAP
- 📱 **一键部署** — 自动推送并安装到真机，支持多模块原子安装（bm install）
- 🔄 **Product 切换** — 支持多 product 变体（测试/正式环境、不同签名配置）
- 🏗️ **Build Mode** — 支持 debug / release / test / 自定义构建模式
- 🛡️ **skip-build 安全检测** — 跳过编译时自动检测构建产物与请求模式是否匹配，不匹配则阻断
- ⚡ **Force-stop** — 安装前自动停止运行中的应用，避免静默安装失败
- 📦 **第三方 HSP** — 自动收集远程 HSP 依赖包一起安装
- 📋 **自动检测** — 自动查找 hvigorw、hdc 设备、bundleName、签名包

## 📋 环境要求

- [Node.js](https://nodejs.org/) 14.0+
- [DevEco Studio](https://developer.huawei.com/consumer/cn/deveco-studio/) 或独立 HarmonyOS SDK
- hvigorw 构建工具（随 DevEco Studio 安装）
- hdc 设备连接工具（随 SDK 安装）
- ohpm 包管理器
- 已配置签名证书（真机安装必需）

## 📖 使用说明

### 方式一：npx（推荐）

无需安装，直接在项目目录运行：

```bash
# 全量编译 + 安装 + 启动（推荐多模块项目）
npx harmonyos-deploy --all --launch

# Release 模式全量编译
npx harmonyos-deploy --all --release --launch

# 指定 product（环境切换）
npx harmonyos-deploy --all -p cheng_tu_test --launch

# 跳过编译，快速安装已有产物
npx harmonyos-deploy --all --skip-build --launch

# 先卸载再安装（解决签名冲突）
npx harmonyos-deploy --all -u --launch

# 清理后重新编译
npx harmonyos-deploy -c --all --launch

# 查看可用配置
npx harmonyos-deploy --list-products
npx harmonyos-deploy --list-build-modes
```

### 方式二：全局安装

```bash
npm install -g harmonyos-deploy
harmonyos-deploy --all --release --launch
```

### 方式三：直接运行

```bash
# 将 bin/harmonyos-deploy.js 复制到项目根目录
node harmonyos-deploy.js --all --launch
```

### 方式四：Shell 脚本（基础功能）

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

## 🔧 CLI 完整参数

### 模块选择

| 参数 | 说明 |
|------|------|
| `-a, --all` | 全量编译所有模块（自动解析依赖顺序）|
| `-m, --module <n>` | 仅编译指定模块（默认: entry）|

### Product 变体

| 参数 | 说明 |
|------|------|
| `-p, --product <n>` | 选择 product（对应 build-profile.json5，默认: default）|
| `--list-products` | 列出所有可用 product 并退出 |

### 构建模式

| 参数 | 说明 |
|------|------|
| `-b, --build-mode <mode>` | 构建模式（默认: debug），支持任意值 |
| `--debug` | 等同 `-b debug` |
| `--release` | 等同 `-b release` |
| `--test` | 等同 `-b test` |
| `--list-build-modes` | 列出 build-profile.json5 中定义的 buildModeSet |
| `--debuggable` | 强制 debuggable=true |
| `--no-debuggable` | 强制 debuggable=false |

> debuggable 自动推断：release → false，其他模式 → true。可用 `--debuggable` / `--no-debuggable` 手动覆盖。

### 设备与安装

| 参数 | 说明 |
|------|------|
| `-d, --device <id>` | 指定目标设备（默认自动选择）|
| `-s, --skip-build` | 跳过编译，直接安装已有产物 |
| `-l, --launch` | 安装后自动启动应用 |
| `-u, --uninstall` | 安装前先卸载旧应用（解决签名冲突）|
| `-c, --clean` | 编译前清理 |

## ⚙️ 工作原理

1. **环境检测** — 自动查找 hvigorw（工程级）或全局 hvigor，检测 hdc 连接的设备
2. **依赖安装** — 执行 `ohpm install`
3. **依赖解析** — `--all` 模式下扫描所有模块，解析 oh-package.json5 依赖关系，拓扑排序
4. **分模块编译** — 按依赖顺序逐个编译：HAR → HSP → HAP，传递 buildMode + debuggable 参数
5. **产物收集** — 从 `build/{product}/outputs/default/` 收集 signed 的 .hap/.hsp 文件，同时扫描第三方 HSP
6. **Force-stop** — 安装前自动停止运行中的应用，避免静默安装失败
7. **推送 + 安装** — `hdc file send` 到设备 + `bm install -p` 一次性原子安装
8. **启动** — `--launch` 时执行 `aa start` 启动应用

## 🛡️ skip-build 安全检测

使用 `--skip-build` 时，脚本会读取编译器生成的 `BuildProfile.ets`，检测已有构建产物的 buildMode 和 product 是否与当前请求匹配。**不匹配时阻断安装**并提示正确命令：

```
[ERROR] Build mode mismatch: existing build is "release", but you requested "debug"

You have two options:
  1. Install the existing release build:
     node harmonyos-deploy.js --all -b release --skip-build
  2. Build and install with debug mode:
     node harmonyos-deploy.js --all -b debug
```

## 🛠️ 设备管理

#### Windows (PowerShell)

```powershell
.\scripts\device_manager.ps1 list         # 查看连接的设备
.\scripts\device_manager.ps1 info         # 设备详细信息
.\scripts\device_manager.ps1 log          # 实时日志
.\scripts\device_manager.ps1 screenshot   # 截屏
.\scripts\device_manager.ps1 restart      # 重启 hdc
.\scripts\device_manager.ps1 uninstall -Package com.example.myapp
```

#### macOS / Linux

```bash
./scripts/device_manager.sh list          # 查看连接的设备
./scripts/device_manager.sh info          # 设备详细信息
./scripts/device_manager.sh log           # 实时日志
./scripts/device_manager.sh screenshot    # 截屏
./scripts/device_manager.sh restart-hdc   # 重启 hdc
./scripts/device_manager.sh uninstall DEVICE_ID com.example.myapp
```

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
4. 尝试重启 hdc 服务：`hdc kill && hdc start`

### 签名错误

确保 `build-profile.json5` 中配置了正确的签名信息。详见 [签名配置指南](docs/signing-guide.md)。

### 安装成功但应用没更新

应用正在运行时 `bm install` 会静默失败。工具已自动在安装前 force-stop，如仍有问题请使用 `--uninstall` 先卸载。

### hvigorw 找不到

- 确保项目根目录有 `hvigorw`（macOS/Linux）或 `hvigorw.bat`（Windows）
- 或全局安装：`npm install -g @ohos/hvigor-cli`

## 📁 项目结构

```
harmonyos-build-deploy/
├── package.json                 # npm 包配置
├── bin/
│   └── harmonyos-deploy.js     # Node.js CLI 入口（主工具）
├── scripts/
│   ├── build_and_deploy.ps1    # Windows 编译部署脚本（基础功能）
│   ├── build_and_deploy.sh     # macOS/Linux 编译部署脚本（基础功能）
│   ├── device_manager.ps1      # Windows 设备管理工具
│   └── device_manager.sh       # macOS/Linux 设备管理工具
├── docs/
│   ├── signing-guide.md        # 签名配置指南
│   └── TESTING.md              # 测试指南
├── harmonyos-build-deploy.skill # Claude AI Skill 文件（可直接上传到 Claude.ai）
├── SKILL.md                    # Claude AI Skill 源文件
├── README.md
└── LICENSE
```

## 🧪 测试

详细测试步骤见 [测试指南](docs/TESTING.md)。

```bash
# 测试帮助命令
node bin/harmonyos-deploy.js --help

# 测试完整流程（需要连接设备）
node bin/harmonyos-deploy.js --all --launch
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[MIT License](LICENSE)

## 🔗 相关链接

- [HarmonyOS 开发者文档](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/application-dev-guide-V5)
- [DevEco Studio 下载](https://developer.huawei.com/consumer/cn/deveco-studio/)
- [hdc 命令参考](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/ide-hdc-V5)
