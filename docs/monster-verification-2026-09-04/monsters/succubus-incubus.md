# 魅魔／梦魔（Succubus/Incubus）

规则 ID：`srd-5.1:succubus-incubus`。结论：**本次已覆盖范围通过**。

## 已知问题与边界

- 已修复：以太化现在通过与幽灵相同的自身位面切换事务自动结算，并保留其“魔法”来源字段。怪物控制栏提供无目标执行按钮，进入／返回都会消耗一次动作并同步地图状态。
- 已修复：吸命之吻现在验证 5 尺距离，以及“被同一来源魅惑或由 DM 明确确认自愿”的目标资格；随后自动完成 DC 15 体质豁免、5d10+5 心灵伤害、成功减半、按实际承受伤害降低生命上限、长休恢复记录，以及生命上限降至 0 时立即死亡。

当前仍有 0 个 Headless 动作未被本次目录矩阵完整确认，0 个动作使用 DM 裁定或属于非战斗能力。

## 实际 UI

通过：爪击（仅邪魔形态）。已验证真实 DM 控制台点击、选择目标、动作消耗、玩家日志同步及玩家先攻栏 HP。HP 320 → 312/320。

> 魅魔／梦魔 使用爪击（仅邪魔形态）攻击 验证目标：爪击（仅邪魔形态） → 验证目标 5+5=10 命中；共造成 8 点伤害。

### 传奇与特殊动作专项

- 本怪物没有本轮新增专项 UI 场景。

## 动作逐项

| 分组 | 动作 / ID | 声明 | 结算类型 | 本次运行验证 | 场景 |
| --- | --- | --- | --- | --- | --- |
| 动作 | 爪击（仅邪魔形态） / `claw-fiend-form-only` | headless | weapon-attack | 通过 | miss、hit、critical |
| 动作 | 魅惑 / `charm` | headless | saving-throw-condition | 通过 | minimum、maximum、no-resource、out-of-range、source-blinded、wrong-target-type |
| 动作 | 吸能之吻 / `draining-kiss` | headless | saving-throw-damage-and-max-hp-reduction | 通过 | structured monster Teleport and Invisibility settles Draining Kiss damage, half damage, maximum-HP loss, and target eligibility、structured monster Teleport and Invisibility kills when Draining Kiss reduces maximum HP to zero |
| 动作 | 以太化 / `etherealness` | headless | toggle-planar-phase | 通过 | structured monster Teleport and Invisibility publishes Ghost and Succubus/Incubus Etherealness as validated self toggles、structured monster Teleport and Invisibility toggles Etherealness atomically and blocks cross-plane attacks、structured monster Teleport and Invisibility prepares a no-target Etherealness map transaction for the manual UI route |

## 字段验证范围

全部字段通过目录导出和公开 schema 重新解析。武器矩阵检查未命中、命中、重击、伤害数值、动作消耗、非法骰值和射程边界；虫群另查半血伤害。范围矩阵检查声明变体、豁免与资源边界。多重攻击矩阵执行完整序列并检查一次动作消耗。

**不能将 schema 接受、一次执行成功或 UI 标签视为所有字段的分支验证。** 命中特效的持续时钟、免疫与移除、目标组合、移动地形、法术选择及跨回合组合仍需结合专项用例逐项确认。

每个动作的完整字段路径与实际运行场景保存在本怪物的 JSON 证据中，可用于继续补齐字段级断言。

## 特性

| 特性 | 自动化声明 | 结构化规则 | 本次专项矩阵 | 场景 |
| --- | --- | --- | --- | --- |
| 心灵联结 | dm-adjudication | 无结构化处理器 | DM 裁定 / 情境判断 | — |
| 变形生物 | dm-adjudication | 无结构化处理器 | DM 裁定 / 情境判断 | — |

特性列表表示目录现状；除上面明确列出的定向回归外，不以本次武器攻击代替回合开始、受击、死亡、重生等特性的独立触发验证。

## 复查材料

- [本怪物字段与结果证据](../evidence/succubus-incubus.json)
- [总索引与运行说明](../README.md)
- 测试源码：`src/rulesets/dnd5e/monsterCatalogWeaponVerification.test.ts`、`monsterCatalogAreaVerification.test.ts`、`monsterCatalogMultiattackVerification.test.ts`；实际 UI：`e2e/monster-catalog-verification.spec.ts`。
