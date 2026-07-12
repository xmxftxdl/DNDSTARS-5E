# 新增职业接入契约

新增职业不应直接修改 `MapsPage.tsx`、角色 Store 或 Headless 攻击分发器来识别具体技能 ID。
职业模块通过下面的 Registry 接入现有 DM 权威战斗流程。

## 1. 统一职业定义

每个职业线通过 `registerClassDefinition` 注册一份 `ClassDefinition`。定义集中提供：

- 可匹配的职业名称与成长适配器。
- 通用技能树 ViewModel 生成器。
- 物理/魔法攻防、生命和暴击公式。
- 默认装备与该职业可选装备目录。
- 职业资源（气、法力、怒气等）的名称、上限、可用条件与恢复时机。

注册定义后，角色 Store、角色面板、装备面板和战斗数值计算会自动发现该职业。

## 2. 职业成长

在 `classProgressionRegistry.ts` 注册 `ClassProgressionAdapter`：

- `matches`：判断角色是否属于该职业线。
- `ownsSkill`：判断技能 ID 是否归该职业管理。
- `syncSkills`：按等级、已学习技能和技能阶级生成战斗技能。
- `canLearnSkill`、`canUpgradeSkillRank`、`getSkillRank`：供角色面板统一调用。
- `hasSkillTree`：控制角色面板是否显示技能树入口。

Store 只调用 `syncCharacterClassProgression`，不应导入具体职业技能树。

## 3. 技能树界面

职业定义中的 `skillTree.buildView(character)` 返回 `ClassSkillTreeView`：分区、节点坐标、
前置关系、技能点、学习/升级状态和各阶描述都在 ViewModel 中生成。

`SkillTreeTab.tsx` 只负责渲染 ViewModel，不得导入具体职业技能树类型。

## 4. 职业数值与装备

`ClassCombatStatProfile` 配置物理攻击、防御、魔法攻击、魔法防御、生命和暴击公式使用的
属性与倍率。未注册职业沿用当前兼容公式，敌人计算也不受影响。

`defaultEquipment` 在角色没有装备时应用；`knownEquipment` 决定角色装备页显示的可选目录。

## 5. 职业资源

在职业定义的 `resources` 中注册 `ClassResourceDefinition`。角色只保存通用的
`classResources[key] = { current, max }`，Store、Headless DM、长休和资源栏统一通过
`classResources.ts` 读写。资源消费在结算管线中生成 `spend-class-resource` mutation，
由 DM authority 验证余额并扣除。

旧存档中的影舞者 `qi` 字段会自动迁移并暂时双写；新增职业不得增加新的顶层资源字段。

## 6. 特性选择

通过 `registerTraitChoiceGroup` 注册等级节点与抉择。`applies(character)` 决定所属职业，
`pendingTraitChoices` 不再限定弓手系。

新增特性键和描述仍集中在 `traitRegistry.ts`，确保存档、角色面板和战斗状态使用同一个定义。
新职业模块可以通过 `registerClassFeatureDef` 注册定义，并通过 TypeScript module augmentation
扩展 `ClassFeatureKeyExtensions`，不需要修改核心特性键联合类型。

主动特性还需通过 `registerFeatureActivationContract` 注册 AP、职业资源、次数、切换状态和
UI ViewModel，并通过 `registerHeadlessFeatureActivationResolver` 注册 DM 权威效果。
`FeaturesTab.tsx` 与 Headless 主分发器不得判断具体 `featureKey`。

## 7. 技能目标与范围

- `registerSkillRange`：注册单体技能的权威射程。玩家 UI 与 Headless DM 共用同一个值。
- `registerSkillAoeTargeting`：注册圆形、矩形或直线 AOE；矩形可声明 `rotatable`。
- `registerSkillTargetSelection`：注册单体、同目标多段或逐段选目标。

目标选择只产生目标 ID/格子；是否命中、豁免、伤害和状态仍由 DM 计算。

## 8. 技能效果

通过 `registerSkillEffectResolver` 注册按技能阶级生成的效果配置：

- AOE 豁免、减半、击飞、眩晕、动画类型。
- 单体效果豁免、束缚、拉近、推动、免费移动、状态移除。
- 多段攻击的同目标控制、禁止移动和逐段豁免。
- 条件额外伤害、重击附伤、CD 减少和技能前置状态。

Resolver 只生成标准效果配置。投骰由客户端动画层执行，骰值打包进 `targetPacket`，
最终 AP、伤害、状态、CD 和死亡全部由 Headless DM 应用。

## 9. 职业专用 Action

弹仓、变身牌组等不属于普通技能的职业操作，在 `ClassDefinition.combatActions` 中声明，
并通过 `registerHeadlessClassCombatActionResolver` 注册。Headless 核心先查询职业 Action
Registry，再进入通用战斗 action switch；不得直接比较职业名称。

## 10. 测试要求

每个新职业至少覆盖：

1. 等级同步、技能学习与升级。
2. AP、CD、每日/长休次数。
3. 单体与 AOE 射程边界。
4. 每一种豁免成功和失败结果。
5. 多目标或多段攻击只扣一次应扣资源。
6. 玩家请求、DM ACK 和第三客户端同步。
7. 战斗结束、死亡与断线重连。

`classExtensibilityBoundary.test.ts` 会阻止具体技能 ID 再次进入地图页面、攻击路由和 Headless 核心。
