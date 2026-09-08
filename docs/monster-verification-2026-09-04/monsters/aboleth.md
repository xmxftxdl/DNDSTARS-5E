# 底栖魔鱼（Aboleth）

规则 ID：`srd-5.1:aboleth`。结论：**本次已覆盖范围通过**。

## 已知问题与边界

- 已修复：旧语义安全名单会把已结构化的触手重新降级，并连带禁用多重攻击。触手现使用逐次命中的持久疾病效果；三次触手各自结算体质豁免，疾病免疫会跳过豁免，多重攻击只消耗一次动作。7073/7074 双端真实 UI 已验证三次命中、疾病状态、HP 与日志同步。
- 保留边界：疾病最初 1 分钟后的“离水时不能恢复生命值”、每 10 分钟 1d12 强酸伤害、浸湿皮肤豁免，以及治疗术／6 环以上治病法术的解除限制，依赖战役时间、环境和施法来源；当前会保留来源绑定疾病记录，由 DM 处理这些跨场景分支。
- 已修复入口：传奇侦测不再错误要求 DM 手工裁定；检定骰、修正值与传奇动作点走 Headless。真实 UI 专项已验证按钮、窗口、点数消耗及双端日志。

当前仍有 0 个 Headless 动作未被本次目录矩阵完整确认，0 个动作使用 DM 裁定或属于非战斗能力。

## 实际 UI

本轮专项双端真实 UI 已通过；完整场景、状态字段和同步证据见下方对应小节。

> 底栖魔鱼 使用尾击攻击 验证目标：尾击 → 验证目标 18+9=27 命中；共造成 17 点伤害。

### 多重攻击专项 UI

- 通过：7073/7074 双端真实页面一次选择目标后完成三次触手；HP 120 → 87，写入疾病持久效果，DM 与玩家日志一致。

> 底栖魔鱼 使用多重攻击攻击 验证目标：触手 → 验证目标 10+9=19 命中；触手 → 验证目标 10+9=19 命中；触手 → 验证目标 10+9=19 命中；共造成 33 点伤害。

### 传奇与特殊动作专项

- 本怪物没有本轮新增专项 UI 场景。

## 动作逐项

| 分组 | 动作 / ID | 声明 | 结算类型 | 本次运行验证 | 场景 |
| --- | --- | --- | --- | --- | --- |
| 动作 | 多重攻击 / `multiattack` | headless | multiattack | 通过 | complete-sequence、three targets: failed save / successful save / disease immunity |
| 动作 | 触手 / `tentacle` | headless | weapon-attack | 通过 | miss、hit、critical、tentacle-disease:apply、tentacle-disease:save、persistent disease: failed save / successful save / disease immunity |
| 动作 | 尾击 / `tail` | headless | weapon-attack | 通过 | miss、hit、critical |
| 动作 | 奴役 / `enslave` | headless | saving-throw-condition | 通过 | minimum、maximum、no-resource、out-of-range |
| 传奇动作 | 侦测 / `detect` | headless | ability-check | 通过 | minimum、maximum、no-resource |
| 传奇动作 | 扫尾 / `tail-swipe` | headless | weapon-attack | 通过 | miss、hit、critical |
| 传奇动作 | 心灵汲取（消耗 2 动作） / `psychic-drain-costs-2-actions` | headless | conditioned-damage-and-healing | 通过 | minimum、maximum、no-resource、missing-condition、wrong-condition-source |

## 字段验证范围

全部字段通过目录导出和公开 schema 重新解析。武器矩阵检查未命中、命中、重击、伤害数值、动作消耗、非法骰值和射程边界；虫群另查半血伤害。范围矩阵检查声明变体、豁免与资源边界。多重攻击矩阵执行完整序列并检查一次动作消耗。

**不能将 schema 接受、一次执行成功或 UI 标签视为所有字段的分支验证。** 命中特效的持续时钟、免疫与移除、目标组合、移动地形、法术选择及跨回合组合仍需结合专项用例逐项确认。

每个动作的完整字段路径与实际运行场景保存在本怪物的 JSON 证据中，可用于继续补齐字段级断言。

## FVTT 对照

- Foundry D&D5e 的 Activities 数据模型提供 Attack、Save、Forward 与已应用效果容器，可作为动作结构化的对应层。
- Foundry D&D5e 的 SRD 5.1 怪物更新清单把底栖魔鱼的黏液云、触手与奴役标为没有适用 Active Effect；因此本仓库不能只等待 FVTT 核心补齐，而是在自身 Headless 入口实现逐击豁免和持久疾病记录。
- 参考：[Activities](https://github.com/foundryvtt/dnd5e/wiki/Activities)、[SRD 5.1 Monster Update List #6712](https://github.com/foundryvtt/dnd5e/issues/6712)。

## 特性

| 特性 | 自动化声明 | 结构化规则 | 本次专项矩阵 | 场景 |
| --- | --- | --- | --- | --- |
| 两栖 | dm-adjudication | 无结构化处理器 | DM 裁定 / 情境判断 | — |
| 黏液云 | headless | mucous-cloud | 通过 | SRD monster actions in the D&D 5e Headless engine resolves the aboleth mucous cloud only after a nearby melee hit underwater |
| 探查心灵感应 | dm-adjudication | 无结构化处理器 | DM 裁定 / 情境判断 | — |

特性列表表示目录现状；除上面明确列出的定向回归外，不以本次武器攻击代替回合开始、受击、死亡、重生等特性的独立触发验证。

## 复查材料

- [本怪物字段与结果证据](../evidence/aboleth.json)
- [多重攻击真实 UI 证据](../evidence/aboleth-multiattack-ui.json)
- [总索引与运行说明](../README.md)
- 测试源码：`src/rulesets/dnd5e/monsterCatalogWeaponVerification.test.ts`、`monsterCatalogAreaVerification.test.ts`、`monsterCatalogMultiattackVerification.test.ts`；实际 UI：`e2e/monster-catalog-verification.spec.ts`。
