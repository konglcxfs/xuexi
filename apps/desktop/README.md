# xuexi 桌面端 · 多平台分发

> 把统一学习引擎封装进 Electron 桌面壳，支持 macOS / Windows / Linux 三端。

## 目标平台

| 平台 | 产物 | 架构 |
|---|---|---|
| macOS | `.dmg` + 增量 blockmap | x64, arm64 |
| Windows | NSIS `.exe` + 增量 blockmap | x64, arm64 |
| Linux | AppImage + `.deb` | x64, arm64 |

## 本地开发

```bash
# 1. 装 electron 二进制（首次需要联网）
pnpm install
pnpm --filter @xuexi/desktop exec electron --version   # 触发下载

# 2. 把 vite dev server + electron 主进程一起跑（推荐）
pnpm --filter @xuexi/desktop dev

# 3. 或者分别跑：
#    - vite dev server: http://localhost:5173
pnpm --filter @xuexi/web dev
#    - Electron 主进程（连 dev server）
XUEXI_API_PORT=4310 pnpm --filter @xuexi/api dev   # 终端 1
XUEXI_DEV_SERVER_URL=http://localhost:5173 \
  XUEXI_API_PORT=0 \
  pnpm --filter @xuexi/desktop dev                  # 终端 2
```

> 提示：开发模式下，`apps/desktop/src/main.ts` 会 fork `apps/api` 子进程，
> 端口随系统分配，并在 `mainWindow.loadURL` 阶段注入。生产模式会直接跑 `apps/api/dist/index.esm.js`。

## 打包

```bash
# 全量三端（推荐走 CI）
pnpm --filter @xuexi/desktop build:debug   # 跳过 electron-builder，只产出 dist + web + api
pnpm --filter @xuexi/desktop build:dir     # electron-builder --dir，只解包不签名
pnpm --filter @xuexi/desktop build         # electron-builder 全量（含 dmg/AppImage 等）

# 在 macOS 上只跑 mac，在 linux 上加 --linux：
cd apps/desktop && npx electron-builder --mac --x64 --arm64
```

打包产物在 `apps/desktop/release/`。

## 自动更新（electron-updater）

更新配置文件位于 `apps/desktop/package.json::build.publish`：

```json
"publish": [
  { "provider": "github", "owner": "yourname", "repo": "xuexi" }
]
```

适用三种发布方式：

1. **GitHub Releases**（默认）：应用启动时拉 `latest-mac.yml` / `latest.yml` / `latest-linux.yml`，对比 version 后下载新版本。CI 里已经接好，见 `.github/workflows/desktop-build.yml`。
2. **自托管 generic provider**：构建时把 `latest-*.yml` 放到你的服务器，改 `publish` 为：
   ```json
   "publish": [{ "provider": "generic", "url": "https://updates.example.com/" }]
   ```
3. **本地测试**：用 `electron-builder --publish never` 跳过发布检查。

### macOS 公证

未签名 dmg 在 macOS 上首次打开需要右键 → "打开"。在 CI 上你需要：

```bash
export CSC_LINK=/path/to/cert.p12
export CSC_KEY_PASSWORD=...
export APPLE_ID=...
export APPLE_APP_SPECIFIC_PASSWORD=...
export APPLE_TEAM_ID=...
```

## 安全模型

- `nodeIntegration: false`
- `contextIsolation: true`
- 渲染进程只能通过 `preload.ts` + `contextBridge` 拿到的 `window.desktop` API 触达主进程
- AI apiKey 用 Electron `safeStorage`（macOS Keychain / Windows DPAPI / Linux libsecret）加密
- 主进程生成的 AES-256 密钥每次启动随机，把 safeStorage 的密文再做一次对称加密写到 sqlite

## 文件布局

```
apps/desktop/
├── src/
│   ├── main.ts        主进程（IPC、窗口、内嵌 Fastify、子进程、自动更新）
│   ├── preload.ts     context bridge
│   └── local-source.ts  本地采集源：fs / watch → SourceAdapter
├── resources/         应用图标（icon.icns / icon.ico / icon.png）
├── dist/              tsc 编译产物
└── release/           electron-builder 打包产物
```

## 故障排查

| 症状 | 处理 |
|---|---|
| electron-builder 报 "code signing" | macOS 没装 Developer ID；本地用 `CSC_IDENTITY_AUTO_DISCOVERY=false` 跳过 |
| 主进程 fork 起不来 | 看 `apps/desktop/main.ts` 里 fork 的 stdout，常见是 `apps/api/dist/index.esm.js` 缺，先跑 `pnpm --filter @xuexi/api build` |
| safeStorage 在 Linux 不可用 | 安装 libsecret：`apt install libsecret-1-dev` |
| AppImage 启动报 fuse 缺失 | 装 `libfuse2` 或用 `AppImage --appimage-extract-and-run` |
| Windows 上 SmartScreen 拦了安装包 | 需要 EV 代码签名证书；CI 里设 `CSC_LINK` + `CSC_KEY_PASSWORD` |

## 单平台说明

### macOS

- 目标：`xuexi-{version}-{arch}.dmg`
- 默认装到 /Applications
- 公证：见上

### Windows

- 目标：`xuexi Setup {version}.exe`（NSIS）
- 自动选择安装目录、创建桌面快捷方式
- SmartScreen：见上

### Linux

- AppImage：双击即用，免安装
- deb：Debian / Ubuntu 系；rpm 可在 `package.json::build.linux.target` 加 `["deb","rpm"]` 启用

