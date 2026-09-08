# 血肉魔像（Flesh Golem）

规则 ID：`srd-5.1:flesh-golem`。结论：**本次已覆盖范围通过**。

## 已知问题与边界

本次已完成的用例尚未确认新的怪物专属缺陷；这不代表未覆盖分支没有问题。

当前仍有 0 个 Headless 动作未被本次目录矩阵完整确认，0 个动作使用 DM 裁定或属于非战斗能力。

## 实际 UI

通过：猛击。已验证真实 DM 控制台点击、选择目标、动作消耗、玩家日志同步及玩家先攻栏 HP。HP 320 → 304/320。

> 血肉魔像 使用猛击攻击 验证目标：猛击 → 验证目标 7+7=14 命中；共造成 16 点伤害。

### 传奇与特殊动作专项

- 本怪物没有本轮新增专项 UI 场景。

## 动作逐项

| 分组 | 动作 / ID | 声明 | 结算类型 | 本次运行验证 | 场景 |
| --- | --- | --- | --- | --- | --- |
| 动作 | 多重攻击 / `multiattack` | headless | multiattack | 通过 | complete-sequence |
| 动作 | 猛击 / `slam` | headless | weapon-attack | 通过 | miss、hit、critical |

## 字段验证范围

全部字段通过目录导出和公开 schema 重新解析。武器矩阵检查未命中、命中、重击、伤害数值、动作消耗、非法骰值和射程边界；虫群另查半血伤害。范围矩阵检查声明变体、豁免与资源边界。多重攻击矩阵执行完整序列并检查一次动作消耗。

**不能将 schema 接受、一次执行成功或 UI 标签视为所有字段的分支验证。** 命中特效的持续时钟、免疫与移除、目标组合、移动地形、法术选择及跨回合组合仍需结合专项用例逐项确认。

每个动作的完整字段路径与实际运行场景保存在本怪物的 JSON 证据中，可用于继续补齐字段级断言。

## 特性

| 特性 | 自动化声明 | 结构化规则 | 本次专项矩阵 | 场景 |
| --- | --- | --- | --- | --- |
| 狂暴失控 | headless | berserk | 通过 | Flesh Golem Headless automation turns lightning damage into healing and ends Berserk at full HP、Flesh Golem Headless automation requires and resolves the low-HP d6 Berserk roll at turn start、Flesh Golem Headless automation targets a nearer allied creature while Berserk |
| 畏火 | headless | damage-aversion | 通过 | Flesh Golem Headless automation applies fire aversion to attacks and checks until the golem turn ends |
| 不变形态 | headless | immutable-form | 通过 | polymorph-immunity-and-cost |
| 闪电吸收 | headless | damage-absorption | 通过 | Flesh Golem Headless automation turns lightning damage into healing and ends Berserk at full HP |
| 魔法抗性 | headless | magic-resistance | 通过 | magical、physical |
| 魔法武器 | headless | magic-weapons | 通过 | ordinary-defenses、nonmagical-immunity |

特性列表表示目录现状；除上面明确列出的定向回归外，不以本次武器攻击代替回合开始、受击、死亡、重生等特性的独立触发验证。

## 复查材料

- [本怪物字段与结果证据](../evidence/flesh-golem.json)
- [总索引与运行说明](../README.md)
- 测试源码：`src/rulesets/dnd5e/monsterCatalogWeaponVerification.test.ts`、`monsterCatalogAreaVerification.test.ts`、`monsterCatalogMultiattackVerification.test.ts`；实际 UI：`e2e/monster-catalog-verification.spec.ts`。
