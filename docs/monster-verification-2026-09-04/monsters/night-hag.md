# 夜鬼婆（Night Hag）

规则 ID：`srd-5.1:night-hag`。结论：**Headless 已验证，仍有 DM 裁定边界**。

## 已知问题与边界

- 保留边界：以太化本身可复用位面切换处理器，但夜巫必须持有心石才能使用；怪物物品栏尚未权威记录心石的持有、转移和失去，不能跳过这个先决条件自动结算。

当前仍有 0 个 Headless 动作未被本次目录矩阵完整确认，3 个动作使用 DM 裁定或属于非战斗能力。

## 实际 UI

通过：双爪（仅鬼婆形态）。已验证真实 DM 控制台点击、选择目标、动作消耗、玩家日志同步及玩家先攻栏 HP。HP 320 → 308/320。

> 夜鬼婆 使用双爪（仅鬼婆形态）攻击 验证目标：双爪（仅鬼婆形态） → 验证目标 15+7=22 命中；共造成 12 点伤害。

### 传奇与特殊动作专项

- 本怪物没有本轮新增专项 UI 场景。

## 动作逐项

| 分组 | 动作 / ID | 声明 | 结算类型 | 本次运行验证 | 场景 |
| --- | --- | --- | --- | --- | --- |
| 动作 | 双爪（仅鬼婆形态） / `claws-hag-form-only` | headless | weapon-attack | 通过 | miss、hit、critical |
| 动作 | 改变形态 / `change-shape` | dm-adjudication | other | DM 裁定 / 非战斗 | — |
| 动作 | 以太化 / `etherealness` | dm-adjudication | other | DM 裁定 / 非战斗 | — |
| 动作 | 梦魇纠缠 / `nightmare-haunting` | dm-adjudication | other | DM 裁定 / 非战斗 | — |

## 字段验证范围

全部字段通过目录导出和公开 schema 重新解析。武器矩阵检查未命中、命中、重击、伤害数值、动作消耗、非法骰值和射程边界；虫群另查半血伤害。范围矩阵检查声明变体、豁免与资源边界。多重攻击矩阵执行完整序列并检查一次动作消耗。

**不能将 schema 接受、一次执行成功或 UI 标签视为所有字段的分支验证。** 命中特效的持续时钟、免疫与移除、目标组合、移动地形、法术选择及跨回合组合仍需结合专项用例逐项确认。

每个动作的完整字段路径与实际运行场景保存在本怪物的 JSON 证据中，可用于继续补齐字段级断言。

## 特性

| 特性 | 自动化声明 | 结构化规则 | 本次专项矩阵 | 场景 |
| --- | --- | --- | --- | --- |
| 天生施法 | dm-adjudication | 无结构化处理器 | DM 裁定 / 情境判断 | — |
| 魔法抗性 | headless | magic-resistance | 通过 | magical、physical |
| 夜鬼婆物品 | dm-adjudication | 无结构化处理器 | DM 裁定 / 情境判断 | — |

特性列表表示目录现状；除上面明确列出的定向回归外，不以本次武器攻击代替回合开始、受击、死亡、重生等特性的独立触发验证。

## 复查材料

- [本怪物字段与结果证据](../evidence/night-hag.json)
- [总索引与运行说明](../README.md)
- 测试源码：`src/rulesets/dnd5e/monsterCatalogWeaponVerification.test.ts`、`monsterCatalogAreaVerification.test.ts`、`monsterCatalogMultiattackVerification.test.ts`；实际 UI：`e2e/monster-catalog-verification.spec.ts`。
