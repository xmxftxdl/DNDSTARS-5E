# 梦魇兽（Nightmare）

规则 ID：`srd-5.1:nightmare`。结论：**Headless 已验证，仍有 DM 裁定边界**。

## 已知问题与边界

- 已修复：以太步行原文允许梦魇兽选择零名同行者，因此新增“仅自身”Headless 分支。执行后会自动写入以太位面、忽略物质碰撞、不受限垂直移动与跨位面效果抑制字段；再次执行可返回物质位面。携带至多三名 5 尺内自愿生物的完整分支仍由 DM 裁定。7073/7074 双端真实 UI 已验证动作消耗、位面效果和日志同步。

当前仍有 0 个 Headless 动作未被本次目录矩阵完整确认，1 个动作使用 DM 裁定或属于非战斗能力。

## 实际 UI

本轮专项双端真实 UI 已通过；完整场景、状态字段和同步证据见下方对应小节。

> 梦魇兽 使用蹄击攻击 验证目标：蹄击 → 验证目标 10+6=16 命中；共造成 23 点伤害。

### 仅自身以太步专项 UI

- 通过：7073/7074 双端真实页面保留完整同行分支为 DM 裁定，并执行零乘客“仅自身”分支。动作余量变为 0；效果写入以太位面、物质碰撞穿越、不受限垂直移动和跨位面效果抑制，DM 与玩家日志一致。

> 梦魇兽使用以太步行：仅自身，进入以太位面。

### 传奇与特殊动作专项

- 本怪物没有本轮新增专项 UI 场景。

## 动作逐项

| 分组 | 动作 / ID | 声明 | 结算类型 | 本次运行验证 | 场景 |
| --- | --- | --- | --- | --- | --- |
| 动作 | 蹄击 / `hooves` | headless | weapon-attack | 通过 | miss、hit、critical |
| 动作 | 以太步行 / `ethereal-stride` | dm-adjudication | other | DM 裁定 / 非战斗 | — |
| 动作 | 以太步行：仅自身 / `ethereal-stride-self-only` | headless | toggle-planar-phase | 通过 | structured monster Teleport and Invisibility settles the Nightmare zero-passenger Ethereal Stride choice as a self-only toggle |

## 字段验证范围

全部字段通过目录导出和公开 schema 重新解析。武器矩阵检查未命中、命中、重击、伤害数值、动作消耗、非法骰值和射程边界；虫群另查半血伤害。范围矩阵检查声明变体、豁免与资源边界。多重攻击矩阵执行完整序列并检查一次动作消耗。

**不能将 schema 接受、一次执行成功或 UI 标签视为所有字段的分支验证。** 命中特效的持续时钟、免疫与移除、目标组合、移动地形、法术选择及跨回合组合仍需结合专项用例逐项确认。

每个动作的完整字段路径与实际运行场景保存在本怪物的 JSON 证据中，可用于继续补齐字段级断言。

## 特性

| 特性 | 自动化声明 | 结构化规则 | 本次专项矩阵 | 场景 |
| --- | --- | --- | --- | --- |
| 赋予火焰抗性 | dm-adjudication | 无结构化处理器 | DM 裁定 / 情境判断 | — |
| 照明 | dm-adjudication | 无结构化处理器 | DM 裁定 / 情境判断 | — |

特性列表表示目录现状；除上面明确列出的定向回归外，不以本次武器攻击代替回合开始、受击、死亡、重生等特性的独立触发验证。

## 复查材料

- [本怪物字段与结果证据](../evidence/nightmare.json)
- [仅自身以太步真实 UI 证据](../evidence/nightmare-ethereal-stride-ui.json)
- [总索引与运行说明](../README.md)
- 测试源码：`src/rulesets/dnd5e/monsterCatalogWeaponVerification.test.ts`、`monsterCatalogAreaVerification.test.ts`、`monsterCatalogMultiattackVerification.test.ts`；实际 UI：`e2e/monster-catalog-verification.spec.ts`。
