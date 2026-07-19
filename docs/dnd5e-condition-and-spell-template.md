# 标准状态效果引擎 V1 与法术机械模板

本层以 D&D 5e 2014／SRD 5.1 为规则基线。状态变更、伤害、豁免和持续时间只能由 DM 权威 Headless 事务写入；页面、普通 JSON 和 Worker 插件都不能直接修改共享 Store。

## 标准状态效果引擎 V1

`src/rulesets/dnd5e/conditions.ts` 为标准状态提供稳定英文 ID、中文显示名、别名归一化和机械规则。V1 收录：目盲、魅惑、耳聋、恐慌、擒抱、失能、隐形、麻痹、石化、中毒、倒地、束缚、震慑和昏迷。力竭继续使用独立的 `exhaustionLevel`。

结构化持续效果保存在角色或 Token 的 `dnd5eCombatState.timedEffects` 中。每个效果保存来源角色、来源法术／行动、标准状态 ID 和结束节点。同一状态可由多个来源同时维持；某一来源结束时，只有在最后一个同状态来源也结束后才移除人物的状态标记。

当前 Headless 自动处理：

- 束缚／擒抱以及不能移动的状态把有效速度归零；
- 失能、麻痹、石化、震慑和昏迷阻止普通动作与反应；
- 目盲、中毒、倒地、束缚等状态参与攻击优势／劣势；
- 束缚使敏捷豁免劣势；麻痹、石化、震慑和昏迷自动失败力量／敏捷豁免；
- 石化提供全伤害抗性，并阻止中毒／疾病状态；
- 固定轮数、施法者下回合开始、目标下回合开始、目标回合末重复豁免四种生命周期；
- 状态免疫、中文／英文别名、多来源并存和跨端持久化。

魅惑的“不能攻击魅惑来源”、恐慌的“看见来源时攻击／检定劣势且不能主动靠近”、隐形的特殊感知，以及麻痹／昏迷的 5 尺内自动重击均提供了规则查询函数。它们需要地图权威层提供来源可见性、真实距离或特殊感官结果；调用方没有这些事实时不得自行假定。

## 房间法术 JSON 模板 V2

下载模板：`public/spell-templates/dnd5e-2014-spell-template.json`。

法术的基础字段包括：

- `castingTime`：动作、附赠动作、反应、分钟或小时；
- `components`：言语 `verbal`、姿势 `somatic`、材料 `material`、材料说明、价格和是否消耗；
- `range`：射程、范围形状与尺寸；
- `duration`：立即、固定时间、直到解除或特殊，及是否专注；
- `description` 与 `higherLevels`：规则正文与升环说明。

可选的 `mechanics` 是可校验的纯数据：

- `resolution`：法术攻击、豁免、自动生效或 DM 裁定；
- `damage`：骰数、骰面、固定调整、伤害类型、施法属性调整与戏法成长；
- `savingThrow`：豁免属性和成功结果；
- `conditions`：标准状态、触发节点和结束方式；
- `upcast.effects`：每升一环增加伤害骰、固定伤害、目标、投射物或持续轮数。

V1 文件仍可导入；V2 用于携带 `mechanics`。普通 JSON 永远是 `reference-only`。即使完整填写机械字段，也不会得到伤害、状态或 Store 写入权限。

## Rules Plugin API V2

Worker 插件可调用 `registerSpell` 注册同一套法术字段，并用 `automation: { mode: 'headless-action', actionId }` 显式绑定插件自己的 Headless action。Host 新开放的受控 capability 是：

- `dealDamage(targetId, amount, damageType)`：Host 处理抗性、易伤、免疫、临时生命与死亡；
- `applyStandardCondition(targetId, condition, duration)`：Host 处理状态免疫、多来源、回合生命周期和同步；
- 既有的 `heal` 与 `grantTemporaryHitPoints`。

插件仍不能访问 DOM、网络、浏览器存储或内部 Store。玩家提交的伤害值、目标和骰子结果仍必须先经过 DM 权威 preflight；`registerSpell` 只声明法术结构，不允许 resolver 绕过法术位、施法动作、射程、目标和骰子校验。

完整原创示例位于 `public/plugin-templates/phb-2014-compat-template.dndstars5e`。
