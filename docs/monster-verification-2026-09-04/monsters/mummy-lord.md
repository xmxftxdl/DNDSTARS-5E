# 木乃伊领主（Mummy Lord）

规则 ID：`srd-5.1:mummy-lord`。结论：**本次已覆盖范围通过**。

## 已知问题与边界

- 已修复：命中特效声明的每 24 小时降低生命值上限原先被运行状态丢弃，时钟也未执行。现已覆盖状态持久化、时间边界、重复同步去重、连续两次恶化、重施不推迟原时钟、治愈后的上限恢复，以及木乃伊诅咒将上限降至零时的遗体毁灭。
- 已修复：沙旋风现在以 Headless 传奇移动窗口结算，固定授予 60 尺可选移动并扣除 2 点；移动窗口内免疫所有伤害及擒抱、石化、倒地、束缚、震慑，移动完成或先攻边界改变时立即清除。7073/7074 双端真实 UI 已验证点数、落点、状态和日志同步。
- 已修复运行时与入口：传奇移动使用当前窗口内的一次可选额度，不再累加到普通移动池；翼击限定飞行。已覆盖超距、模式错误、重复和过期请求；真实 UI 专项已覆盖取消移动与完成移动。

当前仍有 0 个 Headless 动作未被本次目录矩阵完整确认，0 个动作使用 DM 裁定或属于非战斗能力。

## 实际 UI

本轮专项双端真实 UI 已通过；完整场景、状态字段和同步证据见下方对应小节。

> 木乃伊领主 使用腐烂拳击攻击 验证目标：腐烂拳击 → 验证目标 4+9=13 命中；共造成 26 点伤害。

### 沙旋风专项 UI

- 通过：7073/7074 双端真实页面完成传奇窗口选择、2 点传奇动作扣除和地图移动。传奇点 3 → 1；授予 60 尺移动、全伤害免疫与五项状态免疫，移动后临时窗口已清除，DM 与玩家日志一致。

> 木乃伊领主使用传奇动作沙旋风（消耗 2 动作）。

### 传奇与特殊动作专项

- 本怪物没有本轮新增专项 UI 场景。

## 动作逐项

| 分组 | 动作 / ID | 声明 | 结算类型 | 本次运行验证 | 场景 |
| --- | --- | --- | --- | --- | --- |
| 动作 | 多重攻击 / `multiattack` | headless | multiattack | 通过 | complete-sequence |
| 动作 | 腐烂拳击 / `rotting-fist` | headless | weapon-attack | 通过 | miss、hit、critical、rotting-fist-mummy-rot:apply、rotting-fist-mummy-rot:save、calendar-boundary-replay-and-cure |
| 动作 | 恐怖凝视 / `dreadful-glare` | headless | saving-throw-condition | 通过 | minimum、maximum、no-resource、out-of-range、source-blinded、target-blinded |
| 动作 | 多重攻击: 腐烂拳击 / `multiattack-rotting-fist-only` | headless | multiattack | 通过 | complete-sequence |
| 传奇动作 | 攻击 / `attack-rotting-fist` | headless | other | 通过 | miss、hit、critical |
| 传奇动作 | 攻击 / `attack-dreadful-glare` | headless | saving-throw-condition | 通过 | minimum、maximum、no-resource、out-of-range、source-blinded、target-blinded |
| 传奇动作 | 致盲尘土 / `blinding-dust` | headless | area-saving-throw | 通过 | failed-save、successful-save、duplicate-target、exhausted-resource |
| 传奇动作 | 渎神真言（消耗 2 动作） / `blasphemous-word-costs-2-actions` | headless | area-saving-throw | 通过 | failed-save、successful-save、duplicate-target、exhausted-resource |
| 传奇动作 | 引导负能量（消耗 2 动作） / `channel-negative-energy-costs-2-actions` | headless | automatic-area-active-effect | 通过 | minimum、maximum、no-resource |
| 传奇动作 | 沙旋风（消耗 2 动作） / `whirlwind-of-sand-costs-2-actions` | headless | grant-movement | 通过 | minimum、maximum、no-resource、no-points、move、move-too-far、window-expired |

## 字段验证范围

全部字段通过目录导出和公开 schema 重新解析。武器矩阵检查未命中、命中、重击、伤害数值、动作消耗、非法骰值和射程边界；虫群另查半血伤害。范围矩阵检查声明变体、豁免与资源边界。多重攻击矩阵执行完整序列并检查一次动作消耗。

**不能将 schema 接受、一次执行成功或 UI 标签视为所有字段的分支验证。** 命中特效的持续时钟、免疫与移除、目标组合、移动地形、法术选择及跨回合组合仍需结合专项用例逐项确认。

每个动作的完整字段路径与实际运行场景保存在本怪物的 JSON 证据中，可用于继续补齐字段级断言。

## 特性

| 特性 | 自动化声明 | 结构化规则 | 本次专项矩阵 | 场景 |
| --- | --- | --- | --- | --- |
| 魔法抗性 | headless | magic-resistance | 通过 | magical、physical |
| 复苏 | dm-adjudication | 无结构化处理器 | DM 裁定 / 情境判断 | — |
| 施法 | dm-adjudication | 无结构化处理器 | DM 裁定 / 情境判断 | — |

特性列表表示目录现状；除上面明确列出的定向回归外，不以本次武器攻击代替回合开始、受击、死亡、重生等特性的独立触发验证。

## 复查材料

- [本怪物字段与结果证据](../evidence/mummy-lord.json)
- [沙旋风真实 UI 证据](../evidence/mummy-lord-whirlwind-of-sand-ui.json)
- [总索引与运行说明](../README.md)
- 测试源码：`src/rulesets/dnd5e/monsterCatalogWeaponVerification.test.ts`、`monsterCatalogAreaVerification.test.ts`、`monsterCatalogMultiattackVerification.test.ts`；实际 UI：`e2e/monster-catalog-verification.spec.ts`。
