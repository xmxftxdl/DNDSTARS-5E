# 代码审查状态 — 2026-07-28

分支：`codex/p0-postgres-staging-release` @ `82fe5e4`（含约 66 文件未提交改动）  
对照：2026-07-23 审查清单 + 平台新能力抽查

健康度：`tsc` 通过；**1966 通过 / 3 失败**；另有 **4 个测试文件因重复 import 无法加载**（未提交 WIP）。

---

## 一、07-23 严重/中危清单：全部已闭合

| ID | 问题 | 状态 |
|----|------|------|
| S1 | 玩家 `adjust-currency` 正增量铸币 | 已修（仅允许 `delta < 0`） |
| S2 | 装备重掷覆盖弹药 | 已修（在扣弹后角色上再扣充能） |
| S3 | 魔法黑暗 Token 投影泄露 | 已修 |
| S4 | 场景灯海拔不一致 | 已修 |
| S5 | 法师护甲不叠盾 | 已修（`13+DEX+盾`） |
| S6 | 未鉴定物品身份泄露给物主 | 已修（投影脱敏） |
| M1 | 解除魔法用目录环级 | 已修（用 `slotLevel`） |
| M2 | 穿甲后法师护甲不清除 | 已修（装备护甲时过滤效果） |
| M3 | 火球延迟 1000 vs 1150 | 已修（两端均为 1000） |

结论：**上一轮点名的信任/规则高危主线已清完。**

---

## 二、当前仍未解决 / 新发现的问题

### P0 — 工作区测试红灯（合并前必清）

**[high] 未提交改动导致 4 个测试套件无法加载**  
`src/rulesets/dnd5e/monsterAttackAction.ts`（及连带导入链）重复声明 `mapGeometryRuntimeForMap`，oxc transform 失败：

- `MapDiceRoller.test.ts`
- `PlayerCombatHotbar.test.ts`
- `settleDnd5eCombatResult.test.ts`
- `monsterAttackAction.test.ts`

**[medium] 3 个断言失败（疑似未完成的 source-linked 擒抱/推撞工作）**

- `monsters.test.ts` — ankheg bite 结构化期望与当前 catalog 不符  
- `headlessCombatEngine.test.ts` — 咬槽占用时仍允许另一目标/Acid Spray  
- `playerBasicAction.test.ts` — 推撞成功后目标未移到合法相邻格  

这些更像**未提交半成品**，不是线上已发布回归；提交前必须修绿或回滚相关改动。

### P1 — 平台/Postgres（新能力）

**[medium] `mutateAccount` 读改写非原子（多实例会丢更新）**  
`scripts/shared-server-core.mjs:6579`：先 `readAccount`，再 `writeAccount`；进程内有文件锁，但 Postgres 路径的 `FOR UPDATE` 只包住写事务，**不把读时版本纳入 CAS**。多实例共库时后写可覆盖先写（战役/角色/插件库/会话）。  
修复：同一事务 `SELECT … FOR UPDATE` → updater → 写回，或 `expectedRevision` 冲突重试。

**[medium] 账号插件上传 `local-only` 只信请求头**  
`scripts/shared-server-core.mjs:8347-8349`：仅当 header metadata 为 `local-only` 时拒绝；未解析包内 `manifest.distributionPolicy`。客户端可省略/伪造 header，把本应仅本机的包写入账号云库。房间侧对声明式包已有 body 校验，账号侧缺失。

**[medium] 多资源 DM undo 回滚失败被空吞**  
`scripts/shared-server-core.mjs:4621-4634`：部分资源已恢复后若回滚 `.catch(() => {})`，journal 仍标 `applied`，状态与 journal 可能永久不一致。

### P2 — 产品/合规（仍未做完）

| 项 | 状态 |
|----|------|
| 终端用户 EULA / UGC 条款 | 未做（仓库仍无 EULA） |
| Steam/创意工坊 | 仍属规划；本分支偏 staging/Postgres，非壳产品化 |
| 应用内 CC-BY 署名 UI | 需确认是否已加；代码侧仍主要是常量/文档 |
| 未机械化法术「扣位+掷骰」半自动通道 | 产品 P0 项，未见专用通道 |
| 道具 `cast-spell` Headless 白名单 | 讨论过，未见落地 |

### 本轮抽查视为 OK 的方面

- 市场/插件：房间 stage/activate 需 host；生产关闭 sandbox 支付绕过；声明式包审核路径存在  
- DM undo：仅 host；恢复用 `afterRevision` CAS，玩家不能触发  
- 账号 API：`/accounts/me/*` 无跨账号 IDOR  
- 07-23 战斗/库存高危项代码路径抽查均已关闭  

---

## 三、建议下一步（按序）

1. **先绿测试**：修 `monsterAttackAction.ts` 重复 import；对齐 ankheg source-linked / 推撞位移与单测  
2. **再修平台三项**：账号 mutate CAS、`local-only` 解析包体、undo 回滚失败可见  
3. **提交或拆分**当前 66 文件未提交改动，避免 staging 分支基线继续漂移  
4. 合规/EULA、法术半自动、物品施法接口按产品优先级另排期  

---

## 四、一句话

**战斗与投影类旧债基本还清；当前阻塞是未提交 WIP 把测试弄红，以及 Postgres/账号市场路径上的并发与策略校验缺口。**
