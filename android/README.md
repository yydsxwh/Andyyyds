# Android 应用（Capacitor 壳）

将 [https://www.yydsxwh.com](https://www.yydsxwh.com) 包装为可安装的 Android APK。  
应用内 WebView 直接加载线上站点，SSR / API / 登录 / 支付 / 上传 / 点播均走真实服务。

- **框架**：Capacitor 8（`@capacitor/android`）
- **应用 ID**：`com.yydsxwh.app`
- **应用名**：歪歪滴艾斯（站点品牌）
- **配置**：根目录 `capacitor.config.ts`（`server.url` 指向官网）

## 环境要求

- Node.js 18+（与本仓库一致即可）
- JDK **21**（Capacitor 8 / 当前工程要求；推荐 Microsoft OpenJDK 21）
- Android SDK：`platform-tools`、`platforms;android-34`（或 35/36）、`build-tools;34.0.0+`
- 环境变量：
  - `JAVA_HOME` → JDK 21 根目录
  - `ANDROID_HOME` → SDK 根目录（Windows 常见：`%LOCALAPPDATA%\Android\Sdk`）

### Windows 快速安装示例

```powershell
winget install --id Microsoft.OpenJDK.21 -e
# 再安装 Android commandline-tools，并用 sdkmanager 安装 platform-tools / platforms / build-tools
```

## 常用命令

在仓库根目录：

```bash
# 同步 www + capacitor 配置到 android/
npm run app:sync

# 用 Android Studio 打开工程（需本机已装 Android Studio）
npm run app:open

# 打 debug APK，并复制到 public/app/yyds.apk
npm run app:build
```

也可手动：

```bash
cd android
./gradlew assembleDebug   # Windows: gradlew.bat assembleDebug
```

产物路径：

- Gradle：`android/app/build/outputs/apk/debug/app-debug.apk`
- 站点下载：`public/app/yyds.apk` → 访问 `/app` 或 `/app/yyds.apk`

## 功能说明（壳层）

| 能力 | 说明 |
|------|------|
| 返回键 | WebView 有历史则后退，否则退出 |
| 外链 | `weixin://`、`alipays://`、`tel:`、`mailto:`、`market:`、`intent://` 走系统 Intent |
| Cookie / 存储 | 启用第三方 Cookie、DOM Storage |
| 媒体 | `mediaPlaybackRequiresUserGesture=false`，利于视频播放 |
| 上传 | Capacitor 自带文件选择器，支持 `<input type=file>` |
| 下载 | `DownloadManager` 保存到系统「下载」目录 |
| 微信快捷登录 | 原生 `WechatLogin` 插件 + `wxapi.WXEntryActivity`；Web 调起后把 code 交给 `/api/auth/wechat/mobile` |
| 网络安全 | 默认仅 HTTPS；`network_security_config.xml` 声明站点与阿里云等域名 |

## 微信开放平台：应用签名 MD5（必填）

开放平台「移动应用」须登记 **应用包名** `com.yydsxwh.app` 与 **应用签名**（keystore 证书 MD5，32 位小写、无冒号）。

### Debug 包（`npm run app:build` 默认）

Windows 取 debug 签名示例：

```powershell
keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

在输出中找到 `MD5:` 一行，去掉冒号并改为小写，例如：

`A1:B2:C3:...` → `a1b2c3...`

本机当前 debug 签名 MD5（供开放平台登记；换机/重装 JDK 后请重新 keytool）：

`d4582c173b925386bdf19f491b001d07`

填到 open.weixin.qq.com → 管理中心 → 你的移动应用 → 开发信息 → 应用签名。

### Release / 正式上架

使用正式签名 keystore 同样用 `keytool -list -v` 取 MD5；与 debug 不同，须在开放平台再登记或改用正式应用配置。

站长还须在 Studio「系统设置 → 微信 App 快捷登录」填写该移动应用的 **AppID / AppSecret**。

## 已知限制

1. **微信 JSAPI 支付**：在独立 App 的 WebView 中通常不可用（微信要求在微信内置浏览器）。壳会尝试唤起微信 App；若商户号/授权未适配 App，请使用「打开微信」或 H5 跳转方案。
2. **调试包**：`app:build` 默认产出 **debug APK**（可用，但未做正式签名）。上架应用商店需自行配置 release 签名；开放平台签名须与安装包一致。
3. **未知来源安装**：侧载 APK 需用户在系统设置中允许安装。
4. **不要把 `android/local.properties`、keystore 密码提交到 Git。**

## 发布到网站

1. `npm run app:build` 生成 `public/app/yyds.apk`
2. 确认 `/app` 下载页可访问
3. 执行安全增量部署（示例）：

```bash
python scripts/deploy_safe_update.py
```

部署后用户可在 https://www.yydsxwh.com/app 下载安装。
