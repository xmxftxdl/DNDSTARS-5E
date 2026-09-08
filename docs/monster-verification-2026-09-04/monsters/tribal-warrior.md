# 部落战士（Tribal Warrior）

规则 ID：`srd-5.1:tribal-warrior`。结论：**本次已覆盖范围通过**。

## 已知问题与边界

- 已修复：长矛的近战／投掷与双手近战分支已拆成明确 Headless 动作。单手分支保留 5 尺触及、20/60 尺射程与 1d6 伤害；双手近战分支限定近战并使用 1d8，不再因选择字段而整体交给 DM。

当前仍有 0 个 Headless 动作未被本次目录矩阵完整确认，0 个动作使用 DM 裁定或属于非战斗能力。

## 实际 UI

本轮专项双端真实 UI 已通过；完整场景、状态字段和同步证据见下方对应小节。

### 战斗动作 UI 补验

- 通过：7073/7074 双端真实页面执行长矛 (Two-Handed Melee)。目标 HP 320 → 314，动作余量变为 0，DM 与玩家日志一致。

> 部落战士 使用长矛 (Two-Handed Melee)攻击 验证目标：长矛 (Two-Handed Melee) → 验证目标 14+3=17 命中；共造成 6 点伤害。

### 传奇与特殊动作专项

- 本怪物没有本轮新增专项 UI 场景。

## 动作逐项

| 分组 | 动作 / ID | 声明 | 结算类型 | 本次运行验证 | 场景 |
| --- | --- | --- | --- | --- | --- |
| 动作 | 长矛 / `spear` | headless | weapon-attack | 通过 | miss、hit、critical |
| 动作 | 长矛 (Two-Handed Melee) / `spear-two-handed-melee` | headless | weapon-attack | 通过 | miss、hit、critical |

## 字段验证范围

全部字段通过目录导出和公开 schema 重新解析。武器矩阵检查未命中、命中、重击、伤害数值、动作消耗、非法骰值和射程边界；虫群另查半血伤害。范围矩阵检查声明变体、豁免与资源边界。多重攻击矩阵执行完整序列并检查一次动作消耗。

**不能将 schema 接受、一次执行成功或 UI 标签视为所有字段的分支验证。** 命中特效的持续时钟、免疫与移除、目标组合、移动地形、法术选择及跨回合组合仍需结合专项用例逐项确认。

每个动作的完整字段路径与实际运行场景保存在本怪物的 JSON 证据中，可用于继续补齐字段级断言。

## 特性

| 特性 | 自动化声明 | 结构化规则 | 本次专项矩阵 | 场景 |
| --- | --- | --- | --- | --- |
| 集群战术 | headless | pack-tactics | 通过 | adjacent-ally、distant-ally、dead-ally、incapacitated-ally |

特性列表表示目录现状；除上面明确列出的定向回归外，不以本次武器攻击代替回合开始、受击、死亡、重生等特性的独立触发验证。

## 复查材料

- [本怪物字段与结果证据](../evidence/tribal-warrior.json)
- [战斗动作真实 UI 证据](../evidence/tribal-warrior-combat-ui.json)
- [总索引与运行说明](../README.md)
- 测试源码：`src/rulesets/dnd5e/monsterCatalogWeaponVerification.test.ts`、`monsterCatalogAreaVerification.test.ts`、`monsterCatalogMultiattackVerification.test.ts`；实际 UI：`e2e/monster-catalog-verification.spec.ts`。
