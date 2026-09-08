# 吸血鬼（蝙蝠形态）（Vampire, Bat Form）

规则 ID：`srd-5.1:vampire-bat`。结论：**Headless 已验证，仍有 DM 裁定边界**。

## 已知问题与边界

- 已修复：目录原先从本体复制了当前形态不允许的传奇攻击。雾化形态不再提供传奇动作；蝙蝠形态保留移动与啃咬，移除传奇徒手打击。已验证旧动作 ID 在权威入口被拒绝，且不扣点、不伤害目标。
- 保留边界：夜之子需要户外且非日光环境、两种不同召唤表、1d4 轮延迟到达、持续一小时／来源死亡结束和奖励动作遣散；现有召唤规则只支持单一怪物类型与固定出现时机，因此继续由 DM 裁定。
- 已修复运行时与入口：传奇移动使用当前窗口内的一次可选额度，不再累加到普通移动池；翼击限定飞行。已覆盖超距、模式错误、重复和过期请求；真实 UI 专项已覆盖取消移动与完成移动。

当前仍有 0 个 Headless 动作未被本次目录矩阵完整确认，1 个动作使用 DM 裁定或属于非战斗能力。

## 实际 UI

通过：啃咬。已验证真实 DM 控制台点击、选择目标、动作消耗、玩家日志同步及玩家先攻栏 HP。HP 320 → 299/308。

> 吸血鬼（蝙蝠形态） 使用啃咬攻击 验证目标：啃咬 → 验证目标 18+9=27 命中；共造成 21 点伤害。

### 传奇与特殊动作专项

- 通过：移动（场景 4）；DM 日志：吸血鬼（蝙蝠形态）使用传奇动作移动。

## 动作逐项

| 分组 | 动作 / ID | 声明 | 结算类型 | 本次运行验证 | 场景 |
| --- | --- | --- | --- | --- | --- |
| 动作 | 啃咬 / `bite` | headless | weapon-attack | 通过 | miss、hit、critical |
| 动作 | 魅惑 / `charm` | headless | saving-throw-condition | 通过 | minimum、maximum、no-resource、out-of-range、source-blinded、target-blinded、wrong-target-type |
| 动作 | 夜之子嗣 / `children-of-the-night` | dm-adjudication | other | DM 裁定 / 非战斗 | — |
| 传奇动作 | 移动 / `move` | headless | grant-movement | 通过 | minimum、maximum、no-resource、no-points、move、move-too-far、window-expired |
| 传奇动作 | 啃咬（消耗 2 动作） / `legendary-bite-costs-2-actions` | headless | other | 通过 | miss、hit、critical |

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

- [本怪物字段与结果证据](../evidence/vampire-bat.json)
- [总索引与运行说明](../README.md)
- 测试源码：`src/rulesets/dnd5e/monsterCatalogWeaponVerification.test.ts`、`monsterCatalogAreaVerification.test.ts`、`monsterCatalogMultiattackVerification.test.ts`；实际 UI：`e2e/monster-catalog-verification.spec.ts`。
