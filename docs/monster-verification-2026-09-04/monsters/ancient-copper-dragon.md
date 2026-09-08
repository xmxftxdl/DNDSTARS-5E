# 远古赤铜龙（Ancient Copper Dragon）

规则 ID：`srd-5.1:ancient-copper-dragon`。结论：**Headless 已验证，仍有 DM 裁定边界**。

## 已知问题与边界

- 已修复入口：传奇侦测不再错误要求 DM 手工裁定；检定骰、修正值与传奇动作点走 Headless。真实 UI 专项已验证按钮、窗口、点数消耗及双端日志。
- 已修复运行时与入口：传奇移动使用当前窗口内的一次可选额度，不再累加到普通移动池；翼击限定飞行。已覆盖超距、模式错误、重复和过期请求；真实 UI 专项已覆盖取消移动与完成移动。

当前仍有 0 个 Headless 动作未被本次目录矩阵完整确认，1 个动作使用 DM 裁定或属于非战斗能力。

## 实际 UI

通过：啃咬。已验证真实 DM 控制台点击、选择目标、动作消耗、玩家日志同步及玩家先攻栏 HP。HP 320 → 307/320。

> 远古赤铜龙 使用啃咬攻击 验证目标：啃咬 → 验证目标 13+15=28 命中；共造成 13 点伤害。

### 传奇与特殊动作专项

- 本怪物没有本轮新增专项 UI 场景。

## 动作逐项

| 分组 | 动作 / ID | 声明 | 结算类型 | 本次运行验证 | 场景 |
| --- | --- | --- | --- | --- | --- |
| 动作 | 多重攻击 / `multiattack` | headless | multiattack | 通过 | complete-sequence |
| 动作 | 啃咬 / `bite` | headless | weapon-attack | 通过 | miss、hit、critical |
| 动作 | 爪击 / `claw` | headless | weapon-attack | 通过 | miss、hit、critical |
| 动作 | 尾击 / `tail` | headless | weapon-attack | 通过 | miss、hit、critical |
| 动作 | 骇人威仪 / `frightful-presence` | headless | area-saving-throw | 通过 | failed-save、successful-save、duplicate-target |
| 动作 | 吐息武器 / `breath-weapons` | headless | area-saving-throw | 通过 | failed-save、successful-save、duplicate-target、exhausted-resource |
| 动作 | 改变形态 / `change-shape` | dm-adjudication | other | DM 裁定 / 非战斗 | — |
| 动作 | 多重攻击: Weapons Only / `multiattack-weapons-only` | headless | multiattack | 通过 | complete-sequence |
| 传奇动作 | 侦测 / `detect` | headless | ability-check | 通过 | minimum、maximum、no-resource |
| 传奇动作 | 尾击攻击 / `tail-attack` | headless | weapon-attack | 通过 | miss、hit、critical |
| 传奇动作 | 翼击（消耗 2 动作） / `wing-attack-costs-2-actions` | headless | legendary-wing-attack | 通过 | failed-save、successful-save、no-points、out-of-range、behind-wall、invalid-dice、move、move-too-far、wrong-mode、window-expired |

## 字段验证范围

全部字段通过目录导出和公开 schema 重新解析。武器矩阵检查未命中、命中、重击、伤害数值、动作消耗、非法骰值和射程边界；虫群另查半血伤害。范围矩阵检查声明变体、豁免与资源边界。多重攻击矩阵执行完整序列并检查一次动作消耗。

**不能将 schema 接受、一次执行成功或 UI 标签视为所有字段的分支验证。** 命中特效的持续时钟、免疫与移除、目标组合、移动地形、法术选择及跨回合组合仍需结合专项用例逐项确认。

每个动作的完整字段路径与实际运行场景保存在本怪物的 JSON 证据中，可用于继续补齐字段级断言。

## 特性

| 特性 | 自动化声明 | 结构化规则 | 本次专项矩阵 | 场景 |
| --- | --- | --- | --- | --- |
| 传奇抗性 | headless | legendary-resistance | 通过 | choose、decline、exhausted |

特性列表表示目录现状；除上面明确列出的定向回归外，不以本次武器攻击代替回合开始、受击、死亡、重生等特性的独立触发验证。

## 复查材料

- [本怪物字段与结果证据](../evidence/ancient-copper-dragon.json)
- [总索引与运行说明](../README.md)
- 测试源码：`src/rulesets/dnd5e/monsterCatalogWeaponVerification.test.ts`、`monsterCatalogAreaVerification.test.ts`、`monsterCatalogMultiattackVerification.test.ts`；实际 UI：`e2e/monster-catalog-verification.spec.ts`。
