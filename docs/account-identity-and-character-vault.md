# 账号登录 V3、房间身份与角色库

## 目标

房间席位不是角色所有权。V2 将运行时拆成三层：

1. **账号身份**：稳定 `accountId`、经验证的邮箱或手机号、用户名、密码和可撤销设备会话令牌。
2. **房间成员**：房间内的 `memberId`、席位、在线状态和当前控制角色。
3. **账号角色库**：去除 `roomId/roomMemberId` 的角色快照和兼容性清单。

当前账号与角色库由共享服务的 `lobby/accounts` 目录持久化。接口不依赖浏览器 Store 或房间状态，因此未来部署云端账号服务时，客户端只需要更换 API 基址和正式登录提供者，不需要重写角色或 Headless 规则层。

## 注册、登录与会话

- 注册支持邮箱或手机号验证码；验证码与密码只以 `scrypt` 结果落盘。
- 验证码默认 10 分钟过期并限制尝试次数，发送端点同时按 IP 和目标地址限流。
- 用户可使用用户名、已验证邮箱或已验证手机号加密码登录；浏览器只保存可撤销设备会话令牌。
- 服务端最多保留最近 12 个设备会话，退出登录会撤销当前令牌。
- 旧版恢复码接口仅供历史账号迁移；生产环境默认禁止继续创建未验证的恢复码账号。
- 房间加入以已验证的 `accountId` 恢复原 `memberId`，不再依赖同名匹配或原浏览器 `clientId`。
- 旧房间仍可用原协议；旧成员第一次通过账号进入后会增量绑定 `accountId`。

## 成员生命周期

- `online`：最近 20 秒收到心跳。
- `temporarily-offline`：心跳中断，但成员记录仍属于房间；五分钟席位宽限后可让出运行时席位。
- `left`：玩家主动离开，可用原账号再次加入。
- `removed`：被 DM 移除；原账号重新加入会被拒绝，直到 DM 恢复加入资格。

DM 心跳有 120 秒宽限。宽限期内既有玩家继续重连，原 DM 也可在新设备用账号恢复房主身份。DM 权限转让只允许目标玩家在线、规则包就绪时执行。

## 账号角色兼容清单

每个账号角色保存：

- `rulesetId`：当前必须是 `dnd5e-2014-srd-5.1`；
- `characterSchemaVersion`；
- `minimumGameProtocolVersion` 与上次保存协议版本；
- 角色保存时所需插件的 `id/version/integrity/stateSchemaVersion`。

角色带入房间前必须通过以下检查：

1. SRD 规则集完全一致；
2. 当前客户端支持角色数据和最低游戏协议；
3. 房间拥有角色需要的全部插件；
4. 每个插件版本、SHA-256 和状态 schema 完全一致。

房间可以拥有角色未使用的额外插件。缺失或不匹配会阻止“带入当前房间”，但不会修改或删除账号角色。

## DM 角色归属修复

DM 角色页不再按玩家同名自动迁移角色。引用旧成员的角色进入“待恢复角色归属”列表：

- `ownerAccountId` 与当前成员相同会给出推荐目标；
- DM 仍必须显式确认；
- 确认后同时更新 `roomMemberId`、`ownerAccountId` 和显示称呼；
- DM 不能删除或编辑玩家角色的规则内容。

## API

- `GET /api/accounts/auth/config`：读取可用验证码渠道。
- `POST /api/accounts/auth/verification`：发送注册验证码。
- `POST /api/accounts/auth/register`：验证验证码并创建用户名、密码账号。
- `POST /api/accounts/auth/login`：通过用户名、邮箱或手机号加密码签发设备会话。
- `POST /api/accounts/auth/logout`：撤销当前设备会话。
- `POST /api/accounts` 与 `POST /api/accounts/recover`：仅供旧恢复码账号兼容迁移。
- `GET /api/accounts/me`：读取账号资料。
- `GET /api/accounts/me/characters`：读取账号角色库。
- `PUT /api/accounts/me/characters/:id`：保存账号角色及兼容清单。
- `DELETE /api/accounts/me/characters/:id`：从账号角色库删除角色。

账号 API 使用 `X-Stars-Account-Token`。新建的房间成员也绑定该账号令牌；`memberId` 本身不再足以操作绑定账号的管理、心跳、离开、规则或名册端点。
