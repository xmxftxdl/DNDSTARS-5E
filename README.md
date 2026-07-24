# DNDSTARS-5E

基于 DNDSTARS 地图、多端同步、骰子与 DM 权威 Headless 框架开发的 D&D 5e VTT。

本仓库将通过独立 Ruleset Adapter 实现 D&D 5e SRD 规则，不沿用原项目的 AP、攻防差值和职业内容。

开始开发前请阅读：

- `HANDOFF.md`
- `docs/dnd5e-roadmap.md`
- `docs/class-extension.md`
- `docs/combat-flow.md`
- `docs/ruleset-plugins.md`
- `docs/deployment.md`

规则版本已确定为 D&D 5e 2014／SRD 5.1（CC BY 4.0）。第一阶段规则适配器位于 `src/rulesets/dnd5e/`；授权署名见 `ATTRIBUTION.md`。`dnd5e-srd-5.2.1` 仅作为旧存档迁移标识保留，不得引入 2024 修订规则。

共享服务当前使用协议 v3 握手及资源 revision/CAS。修改 `scripts/shared-server-core.mjs` 后必须停止仍占用 5273 的旧 Node 进程，再重新运行 `npm run dev:dm`；只刷新浏览器不会更新服务端协议。DM 总览页提供房间管理、多端同步诊断、按房间轮转的自动／手动／插件变更前快照，以及包含共享状态、地图图片和房间规则包的完整战役导出与预检还原。

首次创建或加入房间时，大厅会创建账号身份并只显示一次恢复码。保存恢复码后，可在另一浏览器或设备恢复原账号、房间成员身份与账号角色库。角色所有权不再依赖同名或房间码；账号角色带入房间前会核对 SRD 规则集、游戏协议以及插件版本／哈希。详见 `docs/account-identity-and-character-vault.md`。

当前 SRD 怪物目录位于 `src/rulesets/dnd5e/monsters.ts`。地图怪物选择器只显示带 `srd-5.1:` 命名空间的 5e 怪物；旧自定义怪物 ID 仅为既有存档保留。首批已接入强盗、狗头人、哥布林、骷髅、僵尸、狼、兽人、恐狼、食人魔和枭熊，并由 5e Headless 使用其 AC、HP、六属性、速度、伤害防护和结构化攻击结算。
