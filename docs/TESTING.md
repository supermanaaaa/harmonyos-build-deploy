# 测试指南

在发布前，请按以下步骤测试各环境是否正常工作。

## 前置条件

- [ ] 已安装 DevEco Studio 或 HarmonyOS SDK
- [ ] hdc 命令可用（`hdc version` 能输出版本号）
- [ ] 有一个可编译的鸿蒙项目
- [ ] 真机已连接并开启 USB 调试

## 测试步骤

### 1. 测试 Node.js 版本

```bash
# 进入鸿蒙项目目录
cd your-harmonyos-project

# 测试帮助命令
node path/to/bin/harmonyos-deploy.js --help

# 测试设备检测（跳过编译）
node path/to/bin/harmonyos-deploy.js --skip-build

# 完整测试：编译 + 安装 + 启动
node path/to/bin/harmonyos-deploy.js --launch

# 测试 Release 模式
node path/to/bin/harmonyos-deploy.js --release --launch

# 测试清理编译
node path/to/bin/harmonyos-deploy.js --clean --launch
```

**预期结果：**
- `--help` 显示完整帮助信息
- `--skip-build` 能检测到设备，尝试安装已有 HAP
- `--launch` 编译成功并在设备上启动应用

---

### 2. 测试 PowerShell 版本 (Windows)

```powershell
# 进入鸿蒙项目目录
cd your-harmonyos-project

# 复制脚本到项目目录（或使用完整路径）
Copy-Item path\to\scripts\build_and_deploy.ps1 .\

# 测试基本编译部署
.\build_and_deploy.ps1

# 测试 Release 模式 + 启动
.\build_and_deploy.ps1 -BuildMode release -Launch

# 测试跳过编译
.\build_and_deploy.ps1 -SkipBuild

# 测试清理编译
.\build_and_deploy.ps1 -Clean
```

**如果提示脚本执行策略问题：**
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

---

### 3. 测试 Bash 版本 (macOS/Linux)

```bash
# 进入鸿蒙项目目录
cd your-harmonyos-project

# 复制脚本到项目目录
cp path/to/scripts/build_and_deploy.sh ./

# 添加执行权限
chmod +x build_and_deploy.sh

# 测试基本编译部署
./build_and_deploy.sh

# 测试 Release 模式 + 启动
./build_and_deploy.sh -b release -l

# 测试跳过编译
./build_and_deploy.sh -s

# 测试清理编译
./build_and_deploy.sh -c
```

---

### 4. 测试错误处理

故意制造错误，验证能否输出详细信息：

#### 4.1 编译错误测试
```typescript
// 在 Index.ets 中添加语法错误
let x: number = "string"; // 类型错误
```

运行编译，应该看到：
```
[ERROR] Build failed

========== BUILD ERROR DETAILS ==========
ERROR: ArkTS:ERROR File: entry/src/main/ets/pages/Index.ets:xx:xx
  Type 'string' is not assignable to type 'number'.
========== END OF ERROR DETAILS ==========
```

#### 4.2 安装错误测试
```bash
# 使用错误的设备 ID
node bin/harmonyos-deploy.js --device FAKE_DEVICE_ID --skip-build
```

应该看到安装错误详情。

#### 4.3 设备未连接测试
```bash
# 断开设备后运行
node bin/harmonyos-deploy.js
```

应该提示"No device connected"并给出检查建议。

---

### 5. 测试 npx 方式（本地模拟）

```bash
# 在项目根目录（有 package.json 的目录）
npm link

# 去鸿蒙项目目录测试
cd your-harmonyos-project
harmonyos-deploy --help
harmonyos-deploy --launch
```

---

## 测试检查清单

| 测试项 | Node.js | PowerShell | Bash |
|--------|---------|------------|------|
| `--help` 显示帮助 | ☐ | ☐ | ☐ |
| 检测已连接设备 | ☐ | ☐ | ☐ |
| Debug 编译成功 | ☐ | ☐ | ☐ |
| Release 编译成功 | ☐ | ☐ | ☐ |
| 安装到真机成功 | ☐ | ☐ | ☐ |
| 启动应用成功 | ☐ | ☐ | ☐ |
| 编译错误有详细输出 | ☐ | ☐ | ☐ |
| 安装错误有详细输出 | ☐ | ☐ | ☐ |
| 无设备时有提示 | ☐ | ☐ | ☐ |

---

## 常见问题

### hdc 命令找不到
```bash
# 检查 hdc 是否在 PATH 中
hdc version

# 如果找不到，添加到 PATH：
# Windows: C:\Users\<用户名>\AppData\Local\OpenHarmony\Sdk\<版本>\toolchains
# macOS: ~/Library/OpenHarmony/Sdk/<版本>/toolchains
```

### hvigorw 找不到
```bash
# 确保在项目根目录（有 build-profile.json5 的目录）运行
# 或全局安装
npm install -g @ohos/hvigor-cli
```

### 签名错误
检查 `build-profile.json5` 中的 `signingConfigs` 配置是否正确。
