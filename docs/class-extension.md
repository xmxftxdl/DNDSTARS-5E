# 新增职业接入契约

新增职业不应直接修改 `MapsPage.tsx`、角色 Store 或 Headless 攻击分发器来识别具体技能 ID。
职业模块通过下面的 Registry 接入现有 DM 权威战斗流程。

## 1. 职业成长

在 `classProgressionRegistry.ts` 注册 `ClassProgressionAdapter`：

- `matches`：判断角色是否属于该职业线。
- `ownsSkill`：判断技能 ID 是否归该职业管理。
- `syncSkills`：按等级、已学习技能和技能阶级生成战斗技能。
- `canLearnSkill`、`canUpgradeSkillRank`、`getSkillRank`：供角色面板统一调用。
- `hasSkillTree`：控制角色面板是否显示技能树入口。

Store 只调用 `syncCharacterClassProgression`，不应导入具体职业技能树。

## 2. 特性选择

通过 `registerTraitChoiceGroup` 注册等级节点与抉择。`applies(character)` 决定所属职业，
`pendingTraitChoices` 不再限定弓手系。

新增特性键和描述仍集中在 `traitRegistry.ts`，确保存档、角色面板和战斗状态使用同一个定义。

## 3. 技能目标与范围

- `registerSkillRange`：注册单体技能的权威射程。玩家 UI 与 Headless DM 共用同一个值。
- `registerSkillAoeTargeting`：注册圆形、矩形或直线 AOE；矩形可声明 `rotatable`。
- `registerSkillTargetSelection`：注册单体、同目标多段或逐段选目标。

目标选择只产生目标 ID/格子；是否命中、豁免、伤害和状态仍由 DM 计算。

## 4. 技能效果

通过 `registerSkillEffectResolver` 注册按技能阶级生成的效果配置：

- AOE 豁免、减半、击飞、眩晕、动画类型。
- 单体效果豁免、束缚、拉近、推动、免费移动、状态移除。
- 多段攻击的同目标控制、禁止移动和逐段豁免。
- 条件额外伤害、重击附伤、CD 减少和技能前置状态。

Resolver 只生成标准效果配置。投骰由客户端动画层执行，骰值打包进 `targetPacket`，
最终 AP、伤害、状态、CD 和死亡全部由 Headless DM 应用。

## 5. 测试要求

每个新职业至少覆盖：

1. 等级同步、技能学习与升级。
2. AP、CD、每日/长休次数。
3. 单体与 AOE 射程边界。
4. 每一种豁免成功和失败结果。
5. 多目标或多段攻击只扣一次应扣资源。
6. 玩家请求、DM ACK 和第三客户端同步。
7. 战斗结束、死亡与断线重连。

`classExtensibilityBoundary.test.ts` 会阻止具体技能 ID 再次进入地图页面、攻击路由和 Headless 核心。
