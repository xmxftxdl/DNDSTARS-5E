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

### 8.1 CLI 与 Engine

Docker CLI 只是客户端，本身不能构建或运行容器。执行 `docker info` 时还必须能够
连接下列任一种 Docker Engine：

- Windows 上启用 Linux 容器的 Docker Desktop；
- WSL2 Linux 发行版内安装并运行的 Docker Engine；
- 通过受保护的 Docker context 连接的远程 Linux Engine。

Windows 静态包中的 `dockerd.exe` 只能运行 Windows 容器，不能用于本项目的
Linux Node 镜像。不要把未加密的远程 Docker TCP 端口暴露到公网。

当前开发机的 CLI 安装在 `D:\study\DockerCLI`。新开的 PowerShell 会从用户 PATH
找到 `docker`；当前已打开的旧终端可临时执行：

```powershell
$env:Path = "D:\study\DockerCLI\bin;$env:Path"
$env:DOCKER_CONFIG = "D:\study\DockerCLI\config"
docker --version
docker compose version
docker info
```

### 8.2 本机启动

先创建不会提交到 Git 的部署环境文件：

```powershell
Copy-Item .env.docker.example .env
docker compose config
```

本机验证：

```powershell
docker compose up --build -d
docker compose ps
docker compose logs --tail 100 -f dndstars
```

浏览器访问 `http://localhost:8080`，健康检查地址为
`http://localhost:8080/api/healthz`。账号、房间、角色、地图、图片、规则包和
快照都写入命名卷 `dndstars-data`；重新创建容器不会清空该卷。

Compose 默认只把端口绑定到 `127.0.0.1`。需要从局域网直接测试时，才在 `.env`
中把 `STARS_BIND_ADDRESS` 改成 `0.0.0.0`，并同时配置主机防火墙和正确的
`STARS_PUBLIC_ORIGIN`。

### 8.3 公网部署

公网部署必须把 `STARS_PUBLIC_ORIGIN` 设置为玩家实际访问的 HTTPS 源，并由
Caddy、nginx、Traefik 或云负载均衡器终止 TLS：

```powershell
Copy-Item .env.docker.example .env
# 编辑 .env：
# STARS_PUBLIC_ORIGIN=https://table.example.com
# STARS_BUILD_ID=2026-07-24.1
docker compose up --build -d
```

反向代理运行在同一宿主机时，让它访问 `127.0.0.1:8080`。若代理也运行在同一个
Compose 网络中，应直接转发到 `http://dndstars:8080`，无需把应用端口公开到公网。

当前容器设计仍是单权威实例。不要把同一个数据卷同时挂载给多个副本，也不要在
没有共享数据库、分布式锁和 SSE 消息总线时直接横向扩容。

### 8.4 备份、升级与恢复

升级前先停止权威服务，避免复制到一半的 JSON 状态：

```powershell
docker compose stop
$backup = ".\backups\$(Get-Date -Format yyyyMMdd-HHmmss)"
New-Item -ItemType Directory -Force $backup | Out-Null
docker compose cp dndstars:/data "$backup\data"
# 更新 Git 工作树或切换到待发布版本后重新构建：
docker compose up --build -d
```

恢复前同样停止服务，保留当前数据副本，再把已核验的备份复制回容器 `/data`。不要使用
`docker compose down -v`，该命令会删除账号、角色、房间和地图所在的数据卷。

升级后至少检查：

```powershell
docker compose ps
docker compose logs --tail 200 dndstars
Invoke-RestMethod http://127.0.0.1:8080/api/healthz
Invoke-RestMethod http://127.0.0.1:8080/api/meta
```

`healthz` 只证明进程与权威 API 可响应；发布验收仍需使用 DM 与玩家两个账号完成
创建房间、重连、地图可见性、一次战斗和服务重启后的数据恢复。
