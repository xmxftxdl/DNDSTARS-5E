# 吸血鬼（雾化形态）（Vampire, Mist Form）

规则 ID：`srd-5.1:vampire-mist`。结论：**本次已覆盖范围通过**。

## 已知问题与边界

- 已修复：目录原先从本体复制了当前形态不允许的传奇攻击。雾化形态不再提供传奇动作；蝙蝠形态保留移动与啃咬，移除传奇徒手打击。已验证旧动作 ID 在权威入口被拒绝，且不扣点、不伤害目标。

当前仍有 0 个 Headless 动作未被本次目录矩阵完整确认，0 个动作使用 DM 裁定或属于非战斗能力。

## 实际 UI

已打开真实怪物控制台；该怪物无可直接执行的 Headless 武器动作，此用例未宣称完成战斗结算。

### 传奇与特殊动作专项

- 通过：无可用传奇动作（场景 5）

## 动作逐项

| 分组 | 动作 / ID | 声明 | 结算类型 | 本次运行验证 | 场景 |
| --- | --- | --- | --- | --- | --- |

## 字段验证范围

全部字段通过目录导出和公开 schema 重新解析。武器矩阵检查未命中、命中、重击、伤害数值、动作消耗、非法骰值和射程边界；虫群另查半血伤害。范围矩阵检查声明变体、豁免与资源边界。多重攻击矩阵执行完整序列并检查一次动作消耗。

**不能将 schema 接受、一次执行成功或 UI 标签视为所有字段的分支验证。** 命中特效的持续时钟、免疫与移除、目标组合、移动地形、法术选择及跨回合组合仍需结合专项用例逐项确认。

每个动作的完整字段路径与实际运行场景保存在本怪物的 JSON 证据中，可用于继续补齐字段级断言。

## 特性

| 特性 | 自动化声明 | 结构化规则 | 本次专项矩阵 | 场景 |
| --- | --- | --- | --- | --- |
| 变形生物 | dm-adjudication | 无结构化处理器 | DM 裁定 / 情境判断 | — |
| 传奇抗性 | headless | legendary-resistance | 通过 | choose、decline、exhausted |
| 雾化逃脱 | dm-adjudication | 无结构化处理器 | DM 裁定 / 情境判断 | — |
| 再生 | headless | regeneration | 通过 | injured、full-hp、suppressed |
| 蛛行 | dm-adjudication | 无结构化处理器 | DM 裁定 / 情境判断 | — |
| 吸血鬼弱点 | dm-adjudication | 无结构化处理器 | DM 裁定 / 情境判断 | — |

特性列表表示目录现状；除上面明确列出的定向回归外，不以本次武器攻击代替回合开始、受击、死亡、重生等特性的独立触发验证。

## 复查材料

- [本怪物字段与结果证据](../evidence/vampire-mist.json)
- [总索引与运行说明](../README.md)
- 测试源码：`src/rulesets/dnd5e/monsterCatalogWeaponVerification.test.ts`、`monsterCatalogAreaVerification.test.ts`、`monsterCatalogMultiattackVerification.test.ts`；实际 UI：`e2e/monster-catalog-verification.spec.ts`。
