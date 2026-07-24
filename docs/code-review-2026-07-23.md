# 代码审查报告（第五轮）— 2026-07-23

审查范围：
- 提交 `b03f788..HEAD`（约 30+ 提交，269 文件，+56k/−10k）
- 工作区未提交改动（约 150 文件，+13k/−1k）

主题覆盖：海拔视线与移动、场景编排/房间音频、库存货币弹药鉴定、SRD 中文审校与去非 SRD、法术自动化（护盾/反制/朦胧/法师护甲/解除魔法/七彩喷射/神恩等）、怪物通用资源、战斗热键栏与演出、结算模式。

健康度：`tsc --noEmit` 通过；**196 文件 / 1462 测试**全部通过。

---

## 严重 / 高（优先修）

### S1. 玩家可通过 `adjust-currency` 自造货币
`src/lib/inventoryAuthority.ts:140` + `src/rulesets/dnd5e/items.ts:681-690`

玩家 mutation 白名单含 `adjust-currency`；事务只拒绝余额为负，**正增量任意放行**。角色页装备栏默认可编辑币值 → 玩家可把自有角色货币调到任意非负整数。
**修复**：玩家通道只允许负增量（消费）或完全改由 DM `grant`；正增量必须走权威发放收据。

### S2. 装备攻击重掷会把已扣弹药写回去
`src/pages/MapsPage.tsx:13579-13587`（配合 `13182`、`13253`）

`resolvePreparedDnd5eEquipmentAttack` 已从 actor 扣弹药；随后 `resourceSpentActor` 来自**扣弹前**快照上的 `spendDnd5eInventoryResource`，应用时用其 `dnd5eInventory` **整表覆盖**结算结果 → 远程攻击在消耗 `attack-roll-reroll` 时可不耗弹药。
**修复**：在扣弹药后的角色上再扣充能；或合并库存时按 instance 合并资源，勿整表覆盖。

### S3. 服务端投影未过滤魔法黑暗内 Token（信息泄露）
`scripts/shared-server-core.mjs:3441` 一带

客户端 `mapGeometryCanSeeToken` 已拒绝魔法黑暗；`playerCanSeeToken` 未处理 `magicalDarkness` / `lighting.kind === 'magical-darkness'`。黑暗术区域内敌人 Token（坐标/标签/HP）仍下发给玩家，`MapCanvas` 全量绘制。
**修复**：服务端照明/视线与客户端对齐，魔法黑暗内无真视等则不下发。

### S4. 场景灯海拔与客户端不一致 → 投影多放行
`scripts/shared-server-core.mjs:3498`

Token 灯已用「海拔 + 半身高」；场景灯仍传原始 `elevationFeet`，且未做地形绝对海拔。矮墙等情况下服务端可判照亮并下发，客户端仍视为黑暗。
**修复**：场景灯与客户端同用 `terrain max + 默认眼高 2.5`。

### S5. 法师护甲 AC 未叠盾牌（少约 2 AC）
`src/rulesets/dnd5e/headlessCombatEngine.ts:3633-3641`

`Math.max(armorClass, 13+DEX)`：持盾时 `armorClass` 已含 +2，但法师护甲分支不含盾。DEX 16+盾 → 应为 18，现为 16。
**修复**：`13+DEX+(持盾?2:0)`，并处理护腕等非护甲加值；勿与整份 AC 简单取 max。

### S6. 未鉴定物品真实身份仍同步到物主玩家端
`scripts/shared-server-core.mjs` 角色投影 + `normalizeDnd5eInventory` 回填

UI 仅遮罩显示名；自有角色库存仍带完整 `templateId`/`rulesText`/稀有度。与「DM 权威隐藏」不符。
**修复**：对 `identified === false` 的条目在玩家投影中剥离模板身份，仅保留占位元数据；归一化勿用 templateId 回填正文。

---

## 中

### M1. 解除魔法按目录基础环级，不按施法环位
`headlessCombatEngine.ts:5017-5057` — 升环隐形等会被低环解除误杀。效果上应持久化 `castSlotLevel`。

### M2. 穿甲后法师护甲效果不移除
仅施法时拒着甲、AC 计算时忽略效果，脱甲后效果「复活」。应在着甲变为 true 时清除效果。

### M3. 客户端/服务端火球演出延迟不一致，演出被丢弃
`src/lib/combatPresentation.ts:7` 仍为 `1000`；服务端为 `650+500=1150`。严格相等校验 → 火球 presentation 全部 `null`。
**修复**：共享同一常量（或客户端接受服务端下发的 `animationStartsAt` 而不重算差值）。

### M4.（抽查提醒）上一轮中危若未闭环
困难地形倍率通道、炽焰法球路径撞击、工坊编辑丢字段、机翻残余等 — 本轮未全量复扫，修 S/M 时顺带核对清单 `docs/code-review-2026-07-21.md`。

---

## 低 / 观察

- 热键栏、结算模式切换、dice-box-frame 抽出布局：未见权威绕过或 XSS。
- 反制/护盾/朦胧/七彩喷射/神恩/冻寒之触时长：抽查符合 SRD；fail-closed 路径正常。
- SRD 运行时文案：已切到 `*.reviewed.generated`，旧 PHB/generated 回退路径已切断（Steam 合规前进了一大步；EULA 仍缺）。
- 场景编排/房间音频写权限与玩家投影剥离：抽查未见越权写。

---

## 已验证无问题（摘要）

| 领域 | 结论 |
|------|------|
| 测试/类型 | 1462 测试、tsc 全绿 |
| 法术 interrupt | 护盾/反制硬化与回放保留方向正确 |
| 海拔主路径 | Token 海拔 `max(terrain, stored)` 两端对齐；步行短台阶不误判坠落 |
| 鉴定发放 | `identify`/`grant` 不在玩家 mutation 白名单 |
| 非 SRD 打包 | `c6b23f0` 方向正确，核心包更干净 |

---

## 修复优先级

1. **S1 铸币**、**S2 弹药回滚**、**S3 魔法黑暗泄露**（信任与保密）
2. **S4 场景灯海拔**、**S5 法师护甲 AC**、**S6 未鉴定脱敏**
3. **M3 火球常量**（一眼能修）、**M1/M2 解除/护甲生命周期**
4. 提交或拆分当前约 150 文件未提交工作区，避免审查基线继续漂移

未提交改动主题一句话：战斗演出（火球/击杀连击）、场景编排交互点、结算模式收敛、热键栏升环/修饰预激活，以及若干规则/内容收尾。
