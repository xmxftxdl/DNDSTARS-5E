# 插件管理 P0–P2

插件中心位于 `/plugins`，兼容入口 `/plugin`。该页面不要求先加入房间，但云端插件库要求登录账号。

## 数据归属

- **账号插件库**：保存账号拥有的私有插件版本元数据。
- **插件制品**：服务端按 SHA-256 去重保存不可变 `.dndstars5e` 文件。
- **房间插件锁**：继续保存精确的插件 ID、版本、SHA-256 和状态 Schema 版本。
- **房间运行状态**：继续由房间独立保存，不写回账号插件制品。
- **浏览器缓存**：只用于本机沙箱加载；旧版本机插件可以在插件中心保存到账号。

删除账号库中的版本只移除账号引用，不会修改已经启用该版本的房间。被账号角色兼容清单或待审/已发布记录引用的版本会 fail-closed 拒绝删除。服务端暂不立即清理无引用制品，后续应由了解房间、快照和账号引用的垃圾回收任务处理。

## 账号插件 API

- `GET /api/accounts/me/plugins`
- `PUT /api/accounts/me/plugins/:pluginId/versions/:version`
- `GET /api/accounts/me/plugins/:pluginId/versions/:version`
- `DELETE /api/accounts/me/plugins/:pluginId/versions/:version`

所有端点要求 `X-Stars-Account-Token`。上传仍由客户端 Worker 先检查清单，服务端随后复核字段、大小和 SHA-256。下载后客户端再次通过现有插件沙箱校验，服务端元数据不能绕过 Host。

当前限制：

- 每个账号最多 100 个插件版本。
- 单个插件制品最多 8 MiB。
- 每个账号插件版本的逻辑总容量最多 128 MiB。
- 新上传版本默认保持 `private`；只有发布者明确提交后才进入审核。
- 相同插件 ID 和版本只能对应一个 SHA-256；不同文件必须提升版本号。

## 版本与兼容性（P1）

清单 Schema v1 增加最低游戏协议、依赖版本范围、冲突插件、Headless capability、内容分类和分发策略。房间启用前由 Host 重新检查：

- 当前客户端协议是否满足最低版本。
- 必需依赖是否存在且版本范围匹配。
- 双向冲突是否成立。
- `local-only` 和尚未实现全员授权证明的 `account-entitled` 是否被错误用于房间分发。
- 相比房间旧版本新增或移除了哪些 capability。

检查失败不会开始安装事务。DM 可以选择账号库中的旧版本执行同一条原子激活链路，实现受控回滚。

## 公开目录与审核（P2）

公开目录允许未登录访客搜索、查看发布者页和下载已发布版本。登录用户可以保存到账号库和提交举报。发布流程：

1. 发布者从自己的不可变账号版本提交 `public` 或 `unlisted` 发布申请。
2. 服务端重新读取制品并要求它是纯 JSON 的 `dndstars5e-declarative` v1 包。
3. JavaScript、分发策略不允许公开、ID/版本不一致或结构损坏时立即拒绝。
4. 生产环境进入 `pending`；开发环境可自动通过以便测试。
5. 管理员可以通过、拒绝或暂停版本；只有 `published` 版本可以公开下载。

主要 API：

- `GET /api/plugins/catalog`
- `GET /api/plugins/catalog/:pluginId`
- `GET /api/plugins/catalog/:pluginId/versions/:version/download`
- `GET /api/plugins/publishers/:accountId`
- `POST /api/accounts/me/plugins/:pluginId/versions/:version/publication`
- `POST /api/plugins/catalog/:pluginId/reports`
- `GET /api/plugins/moderation`
- `POST /api/plugins/catalog/:pluginId/versions/:version/moderate`

生产环境通过 `STARS_PLUGIN_ADMIN_ACCOUNT_IDS`（逗号分隔账号 ID）配置审核管理员。

## P3 边界

Steam Workshop 尚未接入。后续适配器应把 Workshop Item ID 映射到同一个不可变制品、manifest 与审核记录，不能建立第二套运行时权限或绕过 Worker 沙箱。网页版目录先作为唯一可信发布源。

## 启用到房间

DM 在插件中心选择“启用到房间”后，客户端执行：

1. 从账号库下载精确版本。
2. 在 Worker 沙箱中校验并本机激活。
3. 暂存到房间。
4. 读取旧插件运行状态。
5. 在沙箱中执行连续状态迁移。
6. 以房间 revision、旧版本和暂存哈希为并发条件原子激活。
7. 房间玩家按原有握手流程自动下载、校验并报告就绪。

旧的设置页直接上传入口继续保留，用于兼容已有房间和本地插件。
