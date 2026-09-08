# 海妖克拉肯（Kraken）

规则 ID：`srd-5.1:kraken`。结论：**本次已覆盖范围通过**。

## 已知问题与边界

- 已修复：闪电风暴现在要求恰好分配三束闪电，同一生物可重复选择；每束独立进行 DC 23 敏捷豁免和 4d10 雷电伤害结算。普通动作只消耗一次动作，传奇版只消耗 2 点；缺束、多束或骰值不完整会原子回滚。
- 保留边界：当前地图战斗目标模型只把生物交给豁免处理器；原文允许闪电命中物体，物体作为目标时仍需 DM 裁定。
- 已修复：安全名单曾把已经完整结构化的触手、抓取关系、甩掷移动、碰撞伤害、倒地及其多重攻击和传奇引用全部降级。现已恢复 Headless；关系容量、目标体型、距离、移动、伤害骰、一次动作消耗和失败时原子回滚均由权威引擎验证。
- 已修复：啃咬现在只接受已被触手抓住的大型或更小目标；命中后结束触手抓取并建立吞咽关系，自动处理目盲、束缚、12d6 胃酸、50 点体内伤害触发的 DC 25 反刍、体内外全掩护，以及死亡后花费 15 尺移动离开尸体并倒地。

当前仍有 0 个 Headless 动作未被本次目录矩阵完整确认，0 个动作使用 DM 裁定或属于非战斗能力。

## 实际 UI

本轮专项双端真实 UI 已通过；完整场景、状态字段和同步证据见下方对应小节。

### 闪电风暴专项 UI

- 通过：7073/7074 双端真实页面显示 0/3、1/3、2/3 分配进度，并允许对同一目标连续点击三次；结算使目标 HP 200 → 176，DM 与玩家日志一致。

> 克拉肯使用闪电风暴，共造成 24 点伤害。

### 啃咬与吞咽专项 UI

- 通过：7073/7074 双端真实页面完成触手命中、回合推进和下一轮啃咬。目标 HP 200 → 175 → 144；触手擒抱被吞咽关系替换，写入目盲、束缚和 12d6 来源回合胃酸，动作余量为 0，DM 与玩家日志一致。

> 海妖克拉肯 使用触手攻击 吞咽验证目标：触手 → 吞咽验证目标 16+17=33 命中；共造成 25 点伤害。 / 海妖克拉肯 使用啃咬攻击 吞咽验证目标：啃咬 → 吞咽验证目标 16+17=33 命中；共造成 31 点伤害。

### 传奇与特殊动作专项

- 通过：闪电风暴（场景 6）

## 动作逐项

| 分组 | 动作 / ID | 声明 | 结算类型 | 本次运行验证 | 场景 |
| --- | --- | --- | --- | --- | --- |
| 动作 | 多重攻击 / `multiattack` | headless | multiattack | 通过 | complete-sequence |
| 动作 | 啃咬 / `bite` | headless | weapon-attack | 通过 | miss、hit、critical、swallow relation, total cover, internal attack, source death, movement-cost corpse exit, prone |
| 动作 | 触手 / `tentacle` | headless | weapon-attack | 通过 | miss、hit、critical |
| 动作 | 甩掷 / `fling` | headless | throw-linked-target | 通过 | relation, size, forced movement, collision damage, prone, release, rollback |
| 动作 | 闪电风暴 / `lightning-storm` | headless | area-saving-throw | 通过 | failed-save、successful-save、duplicate-target、three independent bolts, repeated targets, per-bolt saves, legendary cost, atomic rollback |
| 动作 | 多重攻击：触手 ×3 / `multiattack-two-tentacles-and-fling` | headless | multiattack | 通过 | complete-sequence |
| 动作 | 多重攻击：触手 ×3 / `multiattack-tentacle-and-two-flings` | headless | multiattack | 通过 | complete-sequence |
| 动作 | 多重攻击：甩掷 ×3 / `multiattack-flings` | headless | multiattack | 通过 | complete-sequence |
| 传奇动作 | 触手攻击或甩掷 / `legendary-tentacle-attack` | headless | other | 通过 | miss、hit、critical |
| 传奇动作 | 触手攻击或甩掷 / `legendary-fling` | headless | throw-linked-target | 通过 | relation, size, forced movement, collision damage, prone, release, rollback |
| 传奇动作 | 闪电风暴（消耗 2 动作） / `lightning-storm-costs-2-actions` | headless | area-saving-throw | 通过 | failed-save、successful-save、duplicate-target、exhausted-resource、three independent bolts, repeated targets, per-bolt saves, legendary cost, atomic rollback |
| 传奇动作 | 墨汁云（消耗 3 动作） / `ink-cloud-costs-3-actions` | headless | persistent-area | 通过 | minimum、maximum、no-resource、wrong-environment |

## 字段验证范围

全部字段通过目录导出和公开 schema 重新解析。武器矩阵检查未命中、命中、重击、伤害数值、动作消耗、非法骰值和射程边界；虫群另查半血伤害。范围矩阵检查声明变体、豁免与资源边界。多重攻击矩阵执行完整序列并检查一次动作消耗。

**不能将 schema 接受、一次执行成功或 UI 标签视为所有字段的分支验证。** 命中特效的持续时钟、免疫与移除、目标组合、移动地形、法术选择及跨回合组合仍需结合专项用例逐项确认。

每个动作的完整字段路径与实际运行场景保存在本怪物的 JSON 证据中，可用于继续补齐字段级断言。

## 特性

| 特性 | 自动化声明 | 结构化规则 | 本次专项矩阵 | 场景 |
| --- | --- | --- | --- | --- |
| 两栖 | dm-adjudication | 无结构化处理器 | DM 裁定 / 情境判断 | — |
| 行动自如 | dm-adjudication | 无结构化处理器 | DM 裁定 / 情境判断 | — |
| 攻城怪物 | dm-adjudication | 无结构化处理器 | DM 裁定 / 情境判断 | — |

特性列表表示目录现状；除上面明确列出的定向回归外，不以本次武器攻击代替回合开始、受击、死亡、重生等特性的独立触发验证。

## 复查材料

- [本怪物字段与结果证据](../evidence/kraken.json)
- [闪电风暴真实 UI 证据](../evidence/kraken-lightning-ui.json)
- [啃咬与吞咽真实 UI 证据](../evidence/kraken-bite-ui.json)
- [总索引与运行说明](../README.md)
- 测试源码：`src/rulesets/dnd5e/monsterCatalogWeaponVerification.test.ts`、`monsterCatalogAreaVerification.test.ts`、`monsterCatalogMultiattackVerification.test.ts`；实际 UI：`e2e/monster-catalog-verification.spec.ts`。
