# Astral Trace Windows 客户端

桌面端采用在线网游客户端结构：Electron 启动器加载本地、版本化的 React 客户端，账号、房间、DM 权威结算、实时同步和插件市场继续连接现有 HTTPS 服务器。桌面端不会启动房主服务器，也不提供局域网或离线房间。

## 本地验证

1. 启动现有服务：`npm run dev:dm`。
2. 另开终端执行 `$env:ASTRALTRACE_SERVER_ORIGIN='http://127.0.0.1:5273'`。
3. 执行 `npm run build`，然后执行 `npm run desktop:start`。

开发模式只允许连接 loopback HTTP；打包客户端强制使用 HTTPS。启动器通过 `app://astraltrace` 提供本地客户端，并把同源 `/api` 请求代理到 `desktop/release-config.json` 指定的服务器。插件市场下载的持久包通过沙箱 preload IPC 写入 AppData 下的内容寻址仓库；网页端仍使用 IndexedDB。

## 打包与发布

- `npm run test:desktop`：验证版本比较、更新清单、路径穿越防护、哈希校验和原子激活。
- `npm run desktop:client:package`：把 `dist` 生成为客户端 ZIP 和 SHA-256 清单。
- `npm run desktop:package`：构建本地客户端、更新包和 Windows NSIS 安装器。
- 推送 `desktop-v*` 标签会运行 `.github/workflows/desktop-release.yml` 并发布固定文件名的最新版安装器。

正式发布前，在仓库 Actions secrets 中配置 Ed25519 私钥 `ASTRALTRACE_DESKTOP_RELEASE_PRIVATE_KEY`，同时把对应公钥写入 `desktop/release-config.json` 的 `releasePublicKeyPem`。未配置公钥的 Beta 构建使用 HTTPS 加 SHA-256 校验；一旦配置公钥，启动器会拒绝任何未签名客户端包。

## 服务器发布控制

`GET /api/desktop/releases/latest` 是公开的更新清单端点。服务器 `.env` 可配置：

- `STARS_DESKTOP_CLIENT_VERSION`
- `STARS_DESKTOP_MINIMUM_SHELL_VERSION`
- `STARS_DESKTOP_CLIENT_URL`
- `STARS_DESKTOP_CLIENT_SHA256`
- `STARS_DESKTOP_CLIENT_SIGNATURE`
- `STARS_DESKTOP_DOWNLOAD_URL`

未配置客户端包时端点返回 `available: false`，启动器会继续查询 GitHub Releases，并在尚无 Release 时使用安装包内置客户端。无论更新源是否可用，现有在线服务器的 `/api/meta` 都必须可达且协议兼容后才能进入应用。
