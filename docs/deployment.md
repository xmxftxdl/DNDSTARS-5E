# DNDSTARS-5E 网络部署基线

本文档描述 P1 生产安全边界。当前服务适合单实例部署；多实例、外部数据库、对象存储和自动备份属于后续阶段。

## 1. 构建

生产与构建环境使用 Node.js 22 或更高版本。

```powershell
npm ci
npm run build:check
```

生产服务器同时提供 `dist` 静态文件与同源 `/api`。浏览器默认只访问当前站点的 `/api`，不再把 5273 当作生产后端。

## 2. 必需环境变量

```powershell
$env:STARS_SECURITY_MODE = "production"
$env:STARS_PUBLIC_ORIGIN = "https://table.example.com"
$env:STARS_SHARED_ROOT = "D:\DNDSTARS\data"
$env:STARS_BUILD_ID = "2026-07-24.1"
node scripts/static-server.mjs --host 127.0.0.1 --port 8080 --root dist
```

- `STARS_SECURITY_MODE=production`：启用生产 fail-closed 策略。
- `STARS_PUBLIC_ORIGIN`：玩家实际访问的 HTTPS 源，只能包含协议、主机和可选端口。
- `STARS_SHARED_ROOT`：账号、房间、角色、地图、图片、规则包和快照的持久化目录。不得指向临时目录。
- `STARS_BUILD_ID`：可选部署版本号，会出现在 `/api/meta` 与 `/api/healthz`。

生产模式缺少公开源或持久化目录时，服务器会拒绝启动。除 localhost 测试外，公开源必须使用 HTTPS。

## 3. CORS 与反向代理

推荐由 Caddy、nginx、Traefik 或云平台负载均衡器终止 TLS，再把同一域名的全部请求转发到此 Node 进程。静态页面、`/api/state`、`/api/events`、`/api/images`、`/api/accounts` 和 `/api/rooms` 必须保持同源。

如果确实需要额外前端源，可显式设置：

```powershell
$env:STARS_ALLOWED_ORIGINS = "https://dm.example.com,https://players.example.com"
```

生产模式禁止 `*`。未列入白名单的跨源请求和预检会返回 `403 origin-not-allowed`。

反向代理需要：

- 关闭 SSE 响应缓冲，保留长连接；
- 允许较长的请求时间，以支持规则包、地图和音频上传；
- 把 `/api/healthz` 用作存活检查；
- 不记录查询字符串中的房间 SSE bearer token；
- 对外只开放 HTTPS，不直接暴露 Node 监听端口。

## 4. 身份与权限

生产模式执行以下规则：

- 创建或加入房间前必须先创建或恢复平台账号；
- 默认的无房间共享状态入口被禁用；
- 房间资源必须携带不可猜测的成员 ID 与房间会话 token；
- 服务端根据房间记录重新判断 DM、玩家或观战者权限；
- DM 状态写入不依赖任何浏览器可见的全局密钥；
- 玩家只能写入白名单资源，观战者只读；
- 房间外访问返回 `room-session-required` 或 `forbidden`。

不要设置 `VITE_STARS_SHARED_SECRET` 或 `VITE_STARS_ACCESS_TOKEN`。所有 `VITE_*` 值都会进入公开浏览器包，不能作为秘密。旧的 `STARS_SHARED_SECRET`、`STARS_DM_TOKEN` 和 `STARS_PLAYER_TOKEN` 只为本地旧流程兼容，不是生产鉴权方案。

## 5. 安全响应头

生产服务器默认发送：

- Content Security Policy；
- HSTS；
- `X-Content-Type-Options: nosniff`；
- `Referrer-Policy: no-referrer`；
- Permissions Policy；
- Cross-Origin Opener/Resource Policy；
- `X-Frame-Options: SAMEORIGIN`。

CSP 允许同源脚本、接口、SSE 和 3D 骰子 iframe，以及应用内部使用的 `blob:` Worker、图片和音频；不允许第三方页面嵌入应用，也不允许外部脚本或任意网络连接。

## 6. 发布前检查

```powershell
npm test
npm run lint:ratchet
npm run build:check
npm audit
```

还应从真实 HTTPS 域名验证：

1. 创建账号并保存恢复码；
2. DM 创建房间，玩家从另一设备加入；
3. 上传地图、立绘、规则包和场景音频；
4. 进行一轮战斗并刷新、断线重连；
5. 验证玩家看不到 DM 暗骰、隐藏 Token 和私人讲义；
6. 验证服务重启后账号、房间和角色仍存在；
7. 验证异源网页不能读取或写入 API。

## 7. 当前部署限制

- 文件系统是唯一持久化后端，因此当前只允许一个权威服务实例。
- SSE backlog 和在线状态保存在进程内存中，进程重启后客户端会通过完整状态恢复。
- 尚未提供自动备份、跨区域容灾、集中日志、指标告警和数据库迁移。
- 房间 token 目前由浏览器保存；部署必须防止 XSS、使用 HTTPS，并避免代理访问日志记录 SSE 查询字符串。

## 8. Docker 单实例部署

仓库根目录提供 `Dockerfile` 与 `docker-compose.yml`。容器继续使用同一个
Node 进程提供前端、SSE 与权威 API，避免跨域配置和多实例内存状态分叉。

本机验证：

```powershell
$env:STARS_PUBLIC_ORIGIN = "http://localhost:8080"
docker compose up --build
```

浏览器访问 `http://localhost:8080`，健康检查地址为
`http://localhost:8080/api/healthz`。账号、房间、角色、地图、图片、规则包和
快照都写入命名卷 `dndstars-data`；重新创建容器不会清空该卷。

公网部署必须把 `STARS_PUBLIC_ORIGIN` 设置为玩家实际访问的 HTTPS 源，并由
Caddy、nginx、Traefik 或云负载均衡器终止 TLS：

```powershell
$env:STARS_PUBLIC_ORIGIN = "https://table.example.com"
$env:STARS_BUILD_ID = "2026-07-24.1"
docker compose up --build -d
```

当前容器设计仍是单权威实例。不要把同一个数据卷同时挂载给多个副本，也不要在
没有共享数据库、分布式锁和 SSE 消息总线时直接横向扩容。
