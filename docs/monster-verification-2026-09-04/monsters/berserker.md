# 狂战士（Berserker）

规则 ID：`srd-5.1:berserker`。结论：**本次已覆盖范围通过**。

## 已知问题与边界

- 已修复：鲁莽攻击必须在本回合显式启用；启用本身不消耗动作。攻击者优势与敌人攻击它的优势分别结算，来源下一回合开始时清除。牛头人的完整双端 UI 周期已另行手动复核。

当前仍有 0 个 Headless 动作未被本次目录矩阵完整确认，0 个动作使用 DM 裁定或属于非战斗能力。

## 实际 UI

通过：巨斧。已验证真实 DM 控制台点击、选择目标、动作消耗、玩家日志同步及玩家先攻栏 HP。HP 320 → 305/320。

> 狂战士 使用巨斧攻击 验证目标：巨斧 → 验证目标 17+5=22 命中；共造成 15 点伤害。

### 传奇与特殊动作专项

- 本怪物没有本轮新增专项 UI 场景。

## 动作逐项

| 分组 | 动作 / ID | 声明 | 结算类型 | 本次运行验证 | 场景 |
| --- | --- | --- | --- | --- | --- |
| 动作 | 巨斧 / `greataxe` | headless | weapon-attack | 通过 | miss、hit、critical |

## 字段验证范围

全部字段通过目录导出和公开 schema 重新解析。武器矩阵检查未命中、命中、重击、伤害数值、动作消耗、非法骰值和射程边界；虫群另查半血伤害。范围矩阵检查声明变体、豁免与资源边界。多重攻击矩阵执行完整序列并检查一次动作消耗。

**不能将 schema 接受、一次执行成功或 UI 标签视为所有字段的分支验证。** 命中特效的持续时钟、免疫与移除、目标组合、移动地形、法术选择及跨回合组合仍需结合专项用例逐项确认。

每个动作的完整字段路径与实际运行场景保存在本怪物的 JSON 证据中，可用于继续补齐字段级断言。

## 特性

| 特性 | 自动化声明 | 结构化规则 | 本次专项矩阵 | 场景 |
| --- | --- | --- | --- | --- |
| 鲁莽 | headless | reckless | 通过 | Berserker and Minotaur Reckless lifecycle berserker attacks normally when the optional choice is omitted、Berserker and Minotaur Reckless lifecycle minotaur attacks normally when the optional choice is omitted、Berserker and Minotaur Reckless lifecycle rejects unsupported, incapacitated, repeated and off-turn Reckless choices atomically、Berserker and Minotaur Reckless lifecycle activates berserker only by choice and grants outgoing and incoming advantage、Berserker and Minotaur Reckless lifecycle activates minotaur only by choice and grants outgoing and incoming advantage、Berserker and Minotaur Reckless lifecycle clears stale Reckless vulnerability and does not reactivate while incapacitated、Berserker and Minotaur Reckless lifecycle uses a stable initiative slot id when Host preparation validates active Reckless |

特性列表表示目录现状；除上面明确列出的定向回归外，不以本次武器攻击代替回合开始、受击、死亡、重生等特性的独立触发验证。

## 复查材料

- [本怪物字段与结果证据](../evidence/berserker.json)
- [总索引与运行说明](../README.md)
- 测试源码：`src/rulesets/dnd5e/monsterCatalogWeaponVerification.test.ts`、`monsterCatalogAreaVerification.test.ts`、`monsterCatalogMultiattackVerification.test.ts`；实际 UI：`e2e/monster-catalog-verification.spec.ts`。
