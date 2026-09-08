# 闪现犬（Blink Dog）

规则 ID：`srd-5.1:blink-dog`。结论：**Headless 已验证，仍有 DM 裁定边界**。

## 已知问题与边界

- 已修复：传送原文中的啃咬是可选项，因此新增“不啃咬、仅传送”的完整 Headless 分支。普通怪物传送现已接入地图落点选择，并由 Host 重新检查 40 尺范围、可见、未占据、地图边界和几何阻挡；成功后消耗动作与充能。原先包含传送前／后啃咬顺序的复合入口仍由 DM 裁定。7073/7074 双端真实 UI 已验证移动 40 尺、HP 不变、充能消耗和日志同步。

当前仍有 0 个 Headless 动作未被本次目录矩阵完整确认，1 个动作使用 DM 裁定或属于非战斗能力。

## 实际 UI

本轮专项双端真实 UI 已通过；完整场景、状态字段和同步证据见下方对应小节。

> 闪现犬 使用啃咬攻击 验证目标：啃咬 → 验证目标 15+3=18 命中；共造成 5 点伤害。

### 仅传送专项 UI

- 通过：7073/7074 双端真实页面保留原复合动作为 DM 裁定，并执行“不啃咬、仅传送”分支。闪现犬从 (175, 245) 移至 (735, 245)，HP 保持 22，动作余量变为 0，充能标记为已消耗，DM 与玩家日志一致。

> 闪现犬使用传送：仅传送，传送 40 尺。

### 传奇与特殊动作专项

- 本怪物没有本轮新增专项 UI 场景。

## 动作逐项

| 分组 | 动作 / ID | 声明 | 结算类型 | 本次运行验证 | 场景 |
| --- | --- | --- | --- | --- | --- |
| 动作 | 啃咬 / `bite` | headless | weapon-attack | 通过 | miss、hit、critical |
| 动作 | 传送 / `teleport` | dm-adjudication | other | DM 裁定 / 非战斗 | — |
| 动作 | 传送：仅传送 / `teleport-only` | headless | teleport | 通过 | minimum、maximum、no-resource、structured monster Teleport and Invisibility settles the Blink Dog teleport-only choice without fabricating its optional Bite |

## 字段验证范围

全部字段通过目录导出和公开 schema 重新解析。武器矩阵检查未命中、命中、重击、伤害数值、动作消耗、非法骰值和射程边界；虫群另查半血伤害。范围矩阵检查声明变体、豁免与资源边界。多重攻击矩阵执行完整序列并检查一次动作消耗。

**不能将 schema 接受、一次执行成功或 UI 标签视为所有字段的分支验证。** 命中特效的持续时钟、免疫与移除、目标组合、移动地形、法术选择及跨回合组合仍需结合专项用例逐项确认。

每个动作的完整字段路径与实际运行场景保存在本怪物的 JSON 证据中，可用于继续补齐字段级断言。

## 特性

| 特性 | 自动化声明 | 结构化规则 | 本次专项矩阵 | 场景 |
| --- | --- | --- | --- | --- |
| 敏锐听觉与嗅觉 | dm-adjudication | 无结构化处理器 | DM 裁定 / 情境判断 | — |

特性列表表示目录现状；除上面明确列出的定向回归外，不以本次武器攻击代替回合开始、受击、死亡、重生等特性的独立触发验证。

## 复查材料

- [本怪物字段与结果证据](../evidence/blink-dog.json)
- [仅传送真实 UI 证据](../evidence/blink-dog-teleport-ui.json)
- [总索引与运行说明](../README.md)
- 测试源码：`src/rulesets/dnd5e/monsterCatalogWeaponVerification.test.ts`、`monsterCatalogAreaVerification.test.ts`、`monsterCatalogMultiattackVerification.test.ts`；实际 UI：`e2e/monster-catalog-verification.spec.ts`。
