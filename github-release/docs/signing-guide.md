# HarmonyOS 签名配置指南

## 签名类型

### 1. 调试签名（自动）
DevEco Studio 可自动生成调试签名，适用于开发测试。

### 2. 发布签名（手动配置）
上架应用市场需要正式签名证书。

## 获取签名证书

### 方式一：DevEco Studio 自动签名
1. File → Project Structure → Signing Configs
2. 勾选 "Automatically generate signature"
3. 登录华为开发者账号
4. 选择团队和项目

### 方式二：AppGallery Connect 手动申请
1. 访问 https://developer.huawei.com/consumer/cn/service/josp/agc/
2. 我的项目 → 选择项目 → 构建 → 证书管理
3. 申请调试/发布证书
4. 下载证书文件（.cer）和 Profile 文件（.p7b）

## build-profile.json5 签名配置

```json5
{
  "app": {
    "signingConfigs": [
      {
        "name": "default",
        "type": "HarmonyOS",
        "material": {
          // 签名证书路径（.cer 文件）
          "certpath": "签名证书/debug.cer",
          
          // 密钥库文件路径（.p12 文件）
          "storeFile": "签名证书/debug.p12",
          
          // 密钥库密码
          "storePassword": "your_store_password",
          
          // 密钥别名
          "keyAlias": "debugKey",
          
          // 密钥密码
          "keyPassword": "your_key_password",
          
          // Profile 文件路径（.p7b 文件）
          "profile": "签名证书/debug.p7b",
          
          // 签名算法
          "signAlg": "SHA256withECDSA"
        }
      }
    ],
    "products": [
      {
        "name": "default",
        "signingConfig": "default"
      }
    ]
  }
}
```

## 多环境签名配置

```json5
{
  "app": {
    "signingConfigs": [
      {
        "name": "debug",
        "type": "HarmonyOS",
        "material": {
          "certpath": "签名证书/debug.cer",
          "storeFile": "签名证书/debug.p12",
          "storePassword": "debug_password",
          "keyAlias": "debugKey",
          "keyPassword": "debug_key_password",
          "profile": "签名证书/debug.p7b",
          "signAlg": "SHA256withECDSA"
        }
      },
      {
        "name": "release",
        "type": "HarmonyOS",
        "material": {
          "certpath": "签名证书/release.cer",
          "storeFile": "签名证书/release.p12",
          "storePassword": "release_password",
          "keyAlias": "releaseKey",
          "keyPassword": "release_key_password",
          "profile": "签名证书/release.p7b",
          "signAlg": "SHA256withECDSA"
        }
      }
    ],
    "products": [
      {
        "name": "default",
        "signingConfig": "debug"
      },
      {
        "name": "release",
        "signingConfig": "release"
      }
    ]
  }
}
```

## 常见签名错误

### Error: The signature does not match
- 原因：证书与 Profile 不匹配
- 解决：确保 .cer 和 .p7b 是同一次申请的

### Error: Profile expired
- 原因：Profile 文件已过期
- 解决：重新申请并下载新的 Profile

### Error: Bundle name mismatch
- 原因：app.json5 中的 bundleName 与 Profile 不一致
- 解决：修改 bundleName 或重新申请匹配的 Profile

### Error: UDID not in profile
- 原因：设备 UDID 未添加到调试 Profile
- 解决：在 AGC 添加设备 UDID 并重新生成 Profile

## 获取设备 UDID

```bash
hdc list targets  # 显示的就是 UDID
```

或在设备上：设置 → 关于手机 → UDID
