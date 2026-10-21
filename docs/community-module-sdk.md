# 社区模块 SDK 1

## 掷骰后由 DM 选择召唤种类（部分接入）

Activity 的怪物目录 choice 可以声明 `dmSelection:{afterCheckId:"table",challengeRatingByTotal:[{minimum:1,maximum:2,maximumChallengeRating:1},{minimum:3,maximum:4,maximumChallengeRating:0.5},{minimum:5,maximum:6,maximumChallengeRating:0.25}]}`。引用 check 必须是 `scope:"shared"` 的单骰 `random-roll`；各区间须按顺序覆盖全部骰值，不能重叠或缺档。仅支持 `srd-monsters`、`installed-monsters` 目录，继续应用 creatureTypes、subtype 与静态 CR 上限。

玩家预选界面跳过此 choice；Host 掷骰后按其已安装目录构造 DM 选项，取消或超时不代选。编译后的 Headless Activity 要求进程内的确认凭据，绑定行动、事务、选择和骰面；JSON 无法携带凭据，改动选择或骰面会使其失效。18 项本地校验及真实 Headless 路径测试通过，实际召唤次等恶魔配置和双端流程尚待验收，不代表该法术已完整支持。

## 物品按来源移除持续效果（待双端验收）

物品 `useActions` 可声明 `effect:{kind:"remove-active-effects",stackingKeys:["monster-area:vrock-spores"]}`，并指定 `targeting:{kind:"creature",rangeFeet:5,includeSelf:true}`。Host 按权威物品模板中的完整 stackingKey 匹配，移除匹配效果及其持续结算，不按条件名称批量清除；其他来源的同名条件及无关状态保留。不存在匹配效果或动作不足时拒绝，不消费物品；成功消费遵循该动作的 `consumeQuantity` 和 `economy`，重复 receipt 不重复消费。声明支持 JSON 往返与插件校验。角色和未绑定角色的怪物目标均已接入。怪物状态由 Host 读取地图 Token，库存接口只返回匹配目标的状态投影，使用者承担消耗；未匹配时不回退到使用者身上清除效果。地图距离及对象校验仍由权威入口执行。86 项本地相关测试及应用类型检查通过，双端验收仍在进行；此段不表示整条召唤法术已完整认证。

## 传感器继承来源视觉（部分支持）

原法术授予的后续活动（`requiresEffectGrant:true`）如果创建需要专注的区域或召唤物，其专注使用 `activity:<活动ID>`，与地图交接默认标识一致；不会把它误记成原法术重新开始专注。后续活动的动作消耗、共享次数仍正常结算。原法术中不依赖专注的持续效果不会仅因后续活动专注结束而移除。

需要按记忆在另一张地图放置传感器时，可在 `effectToken` 中声明 `remotePlacement:{memoryPrompt:"该地点是否为被囚禁者生前见过的地点？"}`。活动必须为自身目标、要求已有效果授权，并且只有一个无条件的 `create-persistent-area` 操作；传感器必须 `hiddenBody:true`、`visionFromSource:true`，区域需要有限时长的专注。Host 提供地图点选，另向 DM 收集记忆事实，并对来源身份、同位面、位置、房间版本进行校验。玩家 JSON 不能携带可用的确认凭据。

此入口已经接到地图页面的待提交批次，但仍需实际双端验收。已有同一活动传感器的替换、以太叠层目的地、远端听觉及识破隐形后的形象尚未完成；不要据此把整个法术标记为完全自动化。

`create-persistent-area.effectToken` 可声明 `shareVisionWithSource:true, visionFromSource:true`。它保留传感器的位置，在地图和 Host 玩家投影中重新计算来源的视觉范围，不把施法时的黑暗视觉等范围永久复制到传感器。不能同时指定固定的 `visionRangeFeet` 或 `darkvisionRangeFeet`；不声明继承字段的既有传感器保持原行为。没有来源 Token 和角色资料时，视觉范围归零。视野共享仍受来源角色的房间归属验证约束。

来源可位于房间中的另一张地图。Host 和客户端都先按绑定的 Token ID 查找，原 Token 不存在时只允许唯一的来源角色 Token 接续；重复身份或身份不匹配时不任意选择来源。客户端不会因为当前地图缺少施法者而覆盖服务端的来源范围。

目前验证的是视觉范围继承、跨图来源与换 Token 后接续、能力降低后的刷新、存档重载及其他成员无法取得传感器视野。此字段没有实现跨地图目的地选择、同位面资格、远端听觉、隐形传感器被识破后的显形，也不代表整项“亡者之眼”已经自动化。上述行为必须独立实现与验收，不能用固定范围或叙事提示代替。

## 按目标类型分支与伤害致死后的召唤

逐目标豁免可声明 `excludedCreatureTypes:["undead"]`。Host 在请求骰子及结算时按权威生物类型排除该豁免；它不排除该目标的其他 outcome，也不把跳过豁免当成成功或失败。对应的另一个效果可用 `when:{kind:"predicate",predicate:{kind:"creature-type",subject:"target",types:["undead"]}}`。缺少目标类型时拒绝选支，不由客户端猜测。该字段只允许 `scope:"per-target"`。

`summon.afterDamageKillOperationId` 引用同一 outcome 中更早的 `damage` operation ID，伤害必须作用于 `target`，Activity 必须以生物为目标，召唤数量必须为常量 1。Host 按该次实际伤害前后的死亡状态决定是否生成召唤请求；仅降至 0 HP、临时生命值消耗、此前已经死亡都不构成条件。请求绑定死者 Token，不能同时声明 `corpseFormChoiceId`。生成前重新检查死亡、遗体与禁止亡灵创造的保护。

`independentPersistent:true` 允许不同施放产生的永久召唤共存；要求 `persistent:true` 且不能绑定 `bondKey`。可配合 `timing:"source-next-turn-start"` 与 `autonomousBehavior:"attack-nearest-visible"`。战斗中按权威施法者回合开始触发；探索模式需另声明 `explorationDelaySeconds`（1–86400 的整数秒），按 Host 战役时钟保存到期时间，不创建虚假战斗时钟。同一批延迟召唤目前要求相同的探索延迟；未声明延迟则拒绝无战斗上下文的请求。当前本地导出重导入、施法、分钟跨界到期、原子提交冲突与幂等已验证；探索生成前施法者离场及 DM 刷新、到期生成和留图玩家刷新也已通过专项双端验证。仅独立永久、无专注、无绑定、绑定致死遗体的转化可使用 Host 队列保存的来源信息继续执行，不向地图补回施法者。战斗中删除施法者先攻项后，Host 使用入队时记录的原先攻位置，在到期后的后继边界处理；施法者仍在先攻时仍等待其实际回合。提前结束战斗时，有显式探索延迟的请求转由战役时钟到期处理；再次开始战斗不丢弃该请求。删除先攻项与提前结束战斗均已通过实际双端专项验收。


明确声明 `autonomousBehavior:"attack-nearest-visible"` 的敌方召唤物可在回合开始进入现有 Host 移动与攻击结算，无需玩家命令。此执行意图不会被保存为控制命令；完成后保存 `summonAutonomousTurnKey`，同一回合刷新不再次启动。普通怪物不因此自动行动。已有实际僵尸移动、攻击、资源消耗和双端刷新专项证据。

## 长时施法期间专注

外层 Host 法术事务将分钟/小时施法及仪式的准备、开始和完成分开。开始时用独立请求绑定的专注状态进入现有 Headless 伤害/体质豁免路径；完成前重新读取角色权威状态。伤害按已有实际伤害结算确定 DC（至少10，或伤害一半），临时生命值吸收伤害仍需检定。失败、结束专注、换成其他专注或失能都会中断当前请求；没有开始凭据或只有序列化标识不能提交完成。取消只清除当前请求的专注，不清除之后的新法术，开始旧专注已被结束的情况下也不会恢复旧专注。

作者仍按原文填写最终效果的 `duration.concentration`：立即生效的典礼术不应为了施法期间专注而改成持续专注法术。过程专注由外层 Host 提供，作者不写内部凭据。完成从新 HP、状态和资源结算，成功后解除过程专注或进入最终法术自身的持续专注。当前已有本地真实导入包结算证据；完整浏览器双端、掉线/重启过程及先攻中的逐回合施法维护仍须独立验收，不据此宣称典礼术或全书完整认证。

## 施法期间范围

法术 Activity 可声明 `castingConstraints:{maximumTargetDistanceFeet:10}`；`legacySource.kind` 必须是 `spell`。它约束 Host 观测到的整个准备后施法过程，独立于完成时目标范围。Host 私有凭据绑定本次法术和实际目标，地图/高度变化时记录是否越界；越界后返回仍拒绝。目标消失、重复身份、凭据丢失或伪造均不能继续。结算及最终应用前再核查；触碰型法术同时验证完成时五尺触及及无遮挡。接口不让作者写入过程证明，不能补出离线期间遗漏的移动，也不替代长施法专注和其他中断机制。

带此约束的 Activity 只能通过外层 Host 法术事务编译；即时特性路线不能替代。包中明确声明的 partial 仍保留 partial，运行处理器齐全不代表剩余原文规则与完整使用链路已经认证。

## 历史受益及死亡后重新受益

`establish-spell-authority`的`benefit-history`可附加`benefitRenewal:{kind:"recipient-death",match:"any"}`（或`all`）。它表示先前共同受益者中任意一位（或所有其他成员）当前被确认死亡后，允许再次受益。名单来自同次实际历史提案，至少两位独立身份；作者和玩家不能填`benefitRecipients`。历史与临时效果分离，七天结束、驱散或换施法者不清空。

长时施法的新受益历史在 Host 完成时钟创建；处理器初始记录经完成提交补偿，完整快照、实体补丁和记录日志保持一致。作者不填写创建时间，旧受益历史不随新施法移动。该时点补偿不代替施法期间范围、接触或中断校验，也不代表整条典礼术已完成认证。

两个权威执行路径都在费用前检查旧记录及本次名单；混合目标中任何不合格者使整批拒绝。0HP、昏迷、离场、删除、旧版本没有名单的历史都不能作为死亡证据；复活后不满足当前死亡条件。成功重新受益后记录新一组成员，旧成员死亡不能反复放行。稳定角色身份支持换Token，但多Token身份歧义不会猜测。

典礼术v12部分包已自动结算婚礼历史和当前场景死亡后再次受益，不再使用婚礼的泛用人工批准。成年/自愿事实仍由Host确认。Host 房间快照可读取其他地图的明确死亡记录及无 Token 的角色死亡豁免记录；0 HP 本身不作死亡证据。Host 已观察到的死亡保存为内部 deathWitnesses，已死亡 Token 删除后可沿用，确认复活后撤销。缺完整房间范围、身份重复或从未确认死亡就删除仍拒绝。法术等待骰据后再次核查最新房间，配偶复活或目标历史改变时整次取消且不消费；这些字段不接受玩家 action payload。跨模块ID历史、地图AC显示及完整施法双端尚未完成，不能标为完整认证。

## 同次效果受益者的距离 AC

`armor-class`的`add`模式可声明`cohortProximity:{maximumFeet:30,match:"all"}`，使加值仅在本次实际收到同一个Effect的其他受益者均处于指定距离内时生效；`match:"any"`要求至少一位。参与者由Host从成功提案绑定，作者/玩家不能指定名单；至少两位独立身份，只有一位、重复角色身份或非法配置在费用之前拒绝。每个Effect最多一个此类modifier。不同Effect和不同施法不合并名单。

运行实例保存`cohortArmorClass`以及参与者Token/角色身份，规范化和重载保留。攻击结算读Host当前距离，不要求视线；没有距离或角色身份对应多个Token时不猜测、不授予加值。离开范围失效，重新进入恢复，持续时间照常推进。角色更换Token时可按稳定角色身份重新识别。没有场景上下文的角色面板不将此条件加值永久加入基础AC，相关地图显示仍待完整验收。

普通Activity提交和编译Headless路径均在费用之前绑定同一套名单。典礼术v11部分包验证两位婚礼目标的七天条件+2及重载；成年/自愿资格依赖Host确认；v12已接入丧偶后再次受益历史，完整典礼施法仍待验收。模块仍为assisted，不能视为典礼术全流程已认证。

## 独立实体与垂直受阻

- `move.destinationPolicy: "adjacent-space"` 显式选择相邻地图空间，仅用于 `forced/voluntary` 且要求 `requiresDifferentDestination: true`，不能和自动方向或自动放置混用。落点必须与起点相隔一格；5/10尺网格分别按实际格距验证。`distanceFeet` 保留为预留移动预算，声明 `usesActorMovement` 的步行由 Host 用实际路径成本修正预留量，困难地形和剩余移动力仍有效。没有合法邻格时不自动原地成功或穿越障碍，调用方须处理未能完成选点的情况。此策略是模块作者选择的落点规则，不能推断所有规则文本都要求移动一格。
- `create-persistent-area.separateSelectedInstances: true` 将选定的多点模板创建为独立实体；需要 `entityProfile`，不能与自动投影定位或操作级 `instanceCount` 混用。目前仅支持非旋转、point 来源模板。目标级 `instanceCount/minimumInstanceCount` 控制选定数量，施法等级目标配置可调整上限。
- `entityProfile.destructionTerrain: { radiusFeet, squareFeetPerMinute }` 在实体 HP 降至零时留下永久地面困难地形，复用清理动作。DM 直接删除不生成碎石。
- 实体 `strength` 可省略，未声明时不提供物体力量检定；`clipHeightToMappedSolids: true` 可用于地面独立实例，将柱体高度截断至映射障碍及本次正在抬升的生物可达高度。它本身不提供柱顶支撑或豁免成功后的避让。
- `entityProfile.supportsStanding: true` 将存活、非球形体积实体的顶面纳入 Host 支撑高度计算；生物完整占格必须被同高度顶面覆盖。此声明提供支撑事实，不自动执行实体消失后的伤害事务。
- `move.stopAtMappedObstacle: true` 仅用于 `ascend`，遇到映射实体时停在首次接触高度。不会自动造成伤害或施加状态。
- `upward-clearance` 条件接受 `subject`、`distanceFeet`（正数或 `area-height`）、`blocked`。净空由 Host 根据地图实体和生物体积计算并随移动刷新，缺少净空或高度数据时不匹配。条件只覆盖地图中实际建模的墙、门窗及障碍；它不把未建模的天花板推测为障碍，也不替代持久区域本身的独立阻挡检查。

上述能力已有接口级验收，但依赖这些能力的地之骨完整施法、石柱支撑、脱离和坠落仍在逐项验收中。

目标：作者通过包内 JSON 和受控脚本增加法术、状态、特性、物品、职业及怪物，无需修改地图或 Host 的法术名称分支。联网房间由 DM 启用规则包，所有玩家使用房间锁定的版本及哈希。

## 可选生物目标

`target: {kind: "creature", relation: "any", count: 256, minimumCount: 0, rangeFeet: 30}` 允许选择零至最大数量的生物。省略 `minimumCount` 默认至少一名；原文要求目标时不可设为零。零目标仍可恢复施放者并消费一次资源，不产生受害者伤害；多目标也不会重复 actor 操作。该声明属于结算协议，各选择界面仍须验收其支持情况。

死亡豁免替代的 Host 候选发现支持已注册普通特性、专长和子职能力，后者复用实际职业等级及子职归属校验。候选不代表资源或选择已通过：提交时再次验证资格、资源、目标、骰值和触发引用。玩家选择及房间流程仍未完成认证。

休息开始触发使用 `short-rest-started` / `long-rest-started`，配合 `actor-choice`、`single-event`。授权来自真实活动休息会话的参与者及开始分钟；使用或放弃的收据与角色效果一起提交，刷新不得重用。普通插件调用不能替代 Host 休息入口，完成、打断及时间推进后旧窗口失效。统一模块和旧版 V2 模块均注册开始、完成四类休息操作入口，休息绑定区域见下文；原始扩展能力仍需独立认证。

同一特性、专长或子职业能力可以声明多个主动 Activity。导入器分别注册可执行的活动，玩家在特性面板选择；不存在唯一默认活动时，不需要虚构一个默认 `action`。各活动的 `legacySource` 必须指向所属条目，选择其他条目的活动不会获得授权。事件监听器仍从相应事件进入，效果授予、续段及休息活动仍保留各自使用条件；多入口注册不会移除这些限制。法术的初始施放入口仍按唯一入口规则检查。

死亡豁免的回合资格由 Host 在回合开始记录为 `deathSaveTurn`（先攻槽对应的 turnKey、eligible、resolved），随角色或 Token 战斗状态持久化。普通豁免与成功替代共同消耗该回合机会，非法提交不消耗；回合中降至零生命不能倒推回合开始资格。已开始但缺少记录的旧状态不补造资格，下一回合重新记录。模块不能通过自报 triggerContext 建立这项权威资格。该记录不替代原文的次数资源和其他条件校验。

## 当前回合结束的效果

`duration: {kind: "rounds", rounds: 1, expiresAt: "source-turn-end", includeCreationTurn: true}` 表示最近一次来源回合结束时到期，包含创建效果的当前回合。目标回合对应 `target-turn-end`。省略该字段或设为 `false` 保留原有跳过创建回合的语义。仅允许一轮和结束边界，不允许开始边界或完成休息奖励。普通状态和复合效果都支持，状态保存后读取保留该语义；展示文本会注明包含当前回合。

该字段不自动提供死亡豁免替代的玩家选择界面或房间提交流程；这些仍需独立验收。导入配置应按原文选择持续时间，不把“下回合结束”缩短为“当前回合结束”。

## 可直接导入的示例

`examples/community-sdk/ember.starmod` 包含一个自定义法师戏法“余烬之触”、独立的“余烬印记”状态，以及脚本注册的资源。该戏法是演示用自定义规则，不是 SRD 法术。它造成 1d4 火焰伤害并降低目标速度 5 尺，状态持续到目标回合结束。

在模块管理中导入后，将法术加入角色法术选择即可使用。编辑 `ember.json` 再构建：

```powershell
node scripts/build-community-module.mjs examples/community-sdk/ember.json examples/community-sdk/ember.starmod examples/community-sdk/main.mjs
```

最后一个参数可省略，此时生成纯声明式包。构建器验证 JSON、内容引用及归档哈希；运行时还会验证脚本贡献。独立脚本应以 `export default moduleName` 结尾，不能使用运行时 import；TypeScript 工程应先打包为单个 ESM。

## 声明式自动化

`Effect.breakOn: ["forces-saving-throw"]` 已支持统一 Activity 直接提交、插件编译执行及持续区域的有来源豁免。仅结束来源角色在本次结算前已有的匹配效果；自身豁免不触发，新授予的效果不会回溯删除。事件 `saving-throw-resolved.sourceId` 记录实际来源，缺失时不得猜测为当前动作角色。原生法术、怪物能力及重复豁免已补来源；缺少来源的旧物品区域不猜测归属。移动边界豁免失败现提交豁免但保持原位，相关 Host/地图适配测试已通过，双端界面仍待集中验收，当前不代表所有动作均已覆盖。

`Effect.sourceLink.sourceMustNotBeIncapacitated: true` 使效果在来源陷入失能（含麻痹、震慑、昏迷、石化）时结束，不附带说话要求。需要说话的能力可继续使用 `sourceMustBeConsciousAndAbleToSpeak`；来源死亡另由 `breakOn: ["source-dies"]` 声明。附赠动作或动作主动解除通过授予相应费用的 `remove-effect` Activity 实现。

`{kind: "shared-language"}` 要求使用者与目标有共同的已知语言，必要时另加 `can-hear-source`。条件读取 Host 快照，支持常用中英文名称、大小写和语言列表；明确的“所有语言”可匹配具体语言，而“任意一种语言”、缺失数据及占位符不视为匹配。描述性资料须先解析为具体语言事实，临时的语言理解能力不改写已知语言。此条件不代表具备说话能力，也不检查单独交谈的时长；这些限制仍须分别建模。

`{kind: "can-understand-source-language"}` 检查目标当前是否能理解来源的一种已知语言：共同语言、目标的理解所有口语能力、或来源让懂语言的生物理解其话语的能力均可满足；来源不能进行有意义交流或目标不能理解语言时拒绝，已暂停的效果不参与。缺失来源语言资料不能凭空视为可理解。该条件不检查听觉和发声；按原文另加相应条件。要求“共同语言”的能力不能仅以此替代 `shared-language`，需要实际理解时可同时使用两者。

`{kind: "can-speak", subject: "actor" | "target"}` 检查指定生物当前能否发声。Host 结合怪物不能说话的资料、沉默/声音抑制、麻痹/石化/昏迷和有效效果的 `actionRestriction.prohibited:["speech"]`；暂停的限制不生效。单独失能、失聪或禁止攻击不等于不能发声。此条件不表示对方听到或理解，也不适用于无声心灵交流。对话能力须按原文组合发声、听觉和语言条件；尚不能以这些瞬时条件证明连续交谈时长或私密交谈。

需要依次更新状态的多次攻击应拆成 continuation 阶段：根段声明 `nextActivityId`、原文次数 `maximumSteps` 和目标重复策略，后续段用 `requiresContinuationFrom`、`activation.kind:"free"`、空 `consumption`。每段重新获取 Host 的有效防御，首段完成后不会因后续段的无效请求撤销，也不会重复收费。单个 Activity 的 `checks` 仍是批量求值，不能代替有状态先后依赖的攻击序列。现有双 Host 路径测试覆盖有效 AC、掩护忽略、序列化续接、无效骰值和重放；这不是原始生成配置或玩家端操作的完整验收。

结束条件仅针对来源的其他盟友时，使用 `attacked-by-source-ally`、`damaged-by-source-ally`、`forced-save-by-source-ally`，明确排除来源本人。盟友按 Host 当前阵营关系判定；来源本人施加对应事件仍保留效果。攻击、正伤害和豁免分别声明，不会互相替代；这些条件与 `source-or-ally` 版本使用相同的事件时序和原子提交路径。它们仍不表示“目睹盟友受害”。

`witnesses-ally-attacked`、`witnesses-ally-damaged` 则以效果持有者为观察者，要求事件发生时能感知同阵营的另一受害者。Host 使用方向性物理遮挡、失明、黑暗及特殊感官判定，昏迷或石化者不触发；攻击无需命中，伤害必须为正，自身受害不计入。清理发生在事件当时，后续才新增的效果不会回溯删除，事务失败会回滚。来源身份不限制施害者；不要与“来源或其盟友施害”的触发器混用。上述条件不代表私密性或连续交谈时间。

`sourceLink.requiresSourceCommunication:true` 维护来源至持有者的可听、可理解通信：协调时检查来源发声、目标清醒与听觉及当前理解能力；`requiresSharedLanguage:true` 则单独维护已知语言交集。中断移除效果，恢复条件不重建旧效果。与 `completionGrant` 和下文 Host 持续交互流程组合，可记录开始、打断和完成，核验权威参与者并发放绑定授权；普通推进时间会打断准备。完整时段连续性及原文要求的私密条件由 DM 明确确认，通信字段本身不证明这些事实。

效果 `breakOn` 可声明 `attacked-by-source-or-ally`、`damaged-by-source-or-ally`、`forced-save-by-source-or-ally`：持有者受到效果来源或其同阵营生物的对应事件时结束。攻击不要求命中，伤害要求实际正伤害，豁免忽略条件免疫导致的自动成功；无归属事件不猜测来源，同次结算新施加的效果不回溯清除。原生逐次攻击和实际伤害包在事件发生后立即清理，后续攻击的 AC 与后续伤害包的抗性会重新读取；整次动作失败时仍回滚。声明式 Activity 的多个攻击检定可能先批量求值，豁免清理仍有事务收尾路径；不能据此声明所有多阶段时序已完整支持。它们不代表目睹盟友受害，也不表示仅限来源以外的盟友。

`sourceLink.targetHarmedBySourceAlly:true` 除实际伤害外，也会在来源或同阵营生物通过 Host 提交 `disposition:"debuff"` 的 Effect 时结束原有效果，无需扣除 HP 或进行豁免。有益 buff、无关来源不会解除；先清理原效果再施加新效果，新的魅惑不会解除自身。该字段单独不表示未命中攻击或强迫豁免，原文要求“任何有害行为”时应同时声明前述三项 `breakOn`。独立强制移动及物体交互等未由这些事件或负面 Effect 表达的行为须另验收，不能把此组合视为任意有害行为的完整自动判定。

Effect 可声明 `sourceAttitude:"friendly"`，将友好态度绑定到 Host 捕获的效果来源。该字段与 ActiveEffect 一起导出、保存和同步；暂停、魔法压制或效果解除时，不再提供这项友好关系。`dnd5eActiveAttitudeTowardSource` 按来源 token／角色身份查询，状态详情显示来源姓名。它表示对来源的态度，不授予控制权、不将来源的盟友一并变为朋友，也不替代 `conditions:["charmed"]` 的攻击限制及社交检定优势。字段目前只接受 `"friendly"`；目标如何回应具体社交请求仍由 DM 裁定。

若规则明确规定魅惑结束后目标知晓施法者，可另声明 `onEndAwareness:"charmed-by-source"`，且必须同时声明 `conditions:["charmed"]`。Host 在效果真正结束时保留来源身份记录，并在结束日志中说明；暂时压制不触发。记录为非魔法、无持续魅惑或友好加成的标记，同一来源去重，可保存重载，不会因移除记录再次生成。本地已验证实际归档重导入后自然到期、伤害行为解除和解除魔法的结算；该验证不代表所有双端生命周期均已验收。

`move` 操作可以显式声明 `harmful:true`。只有 Host 地图结算确认该操作确实造成位移后，才解除目标上声明 `removal.sourceLink.targetHarmedBySourceAlly` 且来源匹配的效果；普通搬运、未成功的位移和仅有提案都不触发。来源的同伴目前按 Headless 控制阵营判断。不要把所有强制移动都标为有害，也不要从玩家提交的任意文本推断该字段。地图返回的操作执行结果仅供 Host 使用，不是玩家可提交的授权凭据。

原生抓抱、推撞是特殊攻击：其成功和失败的 `contest-resolved` 都会触发 `attacked-by-source-or-ally` 或 `attacked-by-source-ally`，保留来源本人／其他盟友的区别。不会凭空生成攻击骰或命中事件，非法检定骰值不会提交解除或动作消费。推离与推倒均已验收；其它独立强制移动或物体交互仍不能仅凭“发生移动”认定为有害行为。

地图区域使用独立字段 `create-persistent-area.sourceIncapacitatedBehavior: "remove-area"`：Host 依据来源角色或怪物的状态移除区域及其投影 Token，永久区域也受此约束。束缚、失聪或禁止说话本身不触发；缺失来源资料不视为失能。该字段会随模块执行、地图保存及加载保留，省略时不改变旧行为。它仅表达失能结束，不隐含专注、主动解除或死亡条款。

主动解除区域使用 `dismiss-granting-area`（`target: "actor"`）。区域须通过 `grantedActivities` 授予当前 Activity，且区域的包、来源角色和 Token 都须与执行者匹配。为解除 Activity 单独声明原文所需的 `activation` 与 `consumption`；附赠动作费用使用 `action-economy/bonus-action`，无动作解除则不添加费用。解除移除区域及其自有投影，保留其他区域，并通过区域结束流程清理对应专注。它不触发引爆；要求爆炸的能力继续使用 `detonate-granting-area`。过期、无授权或重复请求会被拒绝；最终地图交接验证成功前不得发布暂存的资源结果。

DM 怪物也可通过自身的持续区域获得 Activity 授权。无角色资料的怪物按真实 Token ID 校验 `sourceCharacterId/sourceTokenId`，请求中的 `dm-token:…` 仅是界面代理身份，不能作为区域所有者。怪物面板支持自身操作、点击生物和地图区域选择，并区分动作与附赠动作可用性；目标选择记录地图及怪物 Token，地图切换或来源消失后不会退回玩家角色。固定对手的效果控制仍使用其来源目标。新增目标选择已接入代码及本地身份/面板测试，完整地图点击和双端同步仍待集中验收，不能视为所有能力均已行为认证。

区域授予能力的点选模板须明确测距原点：`target.rangeOrigin: "granting-area"` 从区域锚点计算 `placeRangeFeet`；省略或使用 `"actor"` 从施法者计算。准备请求、界面预览和地图校验使用相同声明，视线仍从施法者判断。移动或重塑还须按原文设置操作自身的 `maximumFeet`。此规则适用于点选区域模板；生物目标的区域授予能力继续按覆盖格到目标测距。已有本地 Host 用例验证怪物定点伤害、空地重塑、投影移动和超距拒绝，不替代双端验收。

传送若必须前往另一处，可使用 `move.requiresDifferentDestination: true`（仅 `mode: "teleport"`）。原地落点会被 Host 拒绝并从候选格中排除；省略时保留原有行为。落点占用仍按移动目标的完整体积检查，可见性通过独立的 `requiresVisibleDestination` 声明。

推开／拉近可声明 `move.directionOrigin: "area-center"`，以本次有中心的区域体积为方向原点；只用于 `push`／`pull`，不支持线形或锥形区域。Host 必须收到已校验的区域位置，缺失则拒绝结算。格对齐矩形使用完整尺寸确定中心，包括偶数格宽度产生的半格中心，不使用受遮挡后命中格的平均位置。`"actor"` 显式选择施法者；省略时保留已有方向规则。`maximumDistanceFromActorFeet` 始终以施法者测量。

一个内容定义包含 `payload`、`activities`、`effects`，Activity 的 `outcomes[].operations` 声明结算。可用操作及字段以 `src/rulesets/dnd5e/communityModuleSdk.ts` 导出的 TypeScript 类型为准：伤害、治疗、豁免、效果、持续区域、召唤、移动和触发等均经现有通用引擎校验。未定义的操作会被拒绝，不能依靠名称约定获得效果。

`legacySource` 目前用于声明 Activity 属于哪一个法术或特性，以便 Host 验证角色是否有权使用；它不要求新增内容走旧法术结算器。示例的来源是 `{kind:"spell",id:"ember-touch"}`。

统一内容包中的法术若有唯一的施放 Activity、`legacySource` 指向该法术且通过完整自动化与 Host 编译检查，导入器会将其注册到地图施法入口，并同步生物目标的阵营、是否允许自身和数量设置。没有入口或存在多个施放入口时不会猜测选择。测试覆盖了 `check-boon` 经玩家地图施法事务对自身施放，避免只验证底层 Activity 而遗漏实际施法路径。

新增独立状态使用 `kind:"condition"`，`payload` 为 `{id,name,effectId}`，并在 `effects` 内提供主 Effect。`extensionCondition` 应使用包前缀，例如 `community.ember.ember-mark`，避免不同作者的状态同名。状态的修正、持续时间、叠加和解除由 Effect 控制，不需要新增标准状态枚举。

中立资料条目对应 `type:"Condition"`。其他条目的 `automationData.conditionRefs` 可引用状态：

```json
[{"activityId":"ember-touch","conditionId":"ember-mark","packageId":"community.ember"}]
```

同包可省略 `packageId`；跨包必须在 manifest 声明依赖，并先启用依赖包。导入时展开为 Activity 自己的 Effect 副本；缺失引用或同 ID 不同效果会报错。房间投影包含展开结果。状态更新需要更新引用它的包及房间版本，不能悄悄改变正在进行的交易。

## 脚本入口

`.starmod` 清单增加：

```json
{
  "script":{"apiVersion":1,"entry":"scripts/main.mjs","stateSchemaVersion":1},
  "permissions":["compendium.write","automation.register","automation.script"]
}
```

`scripts/main.mjs` 同样受归档 SHA-256 保护。它不能与旧 V2 兼容载荷混装。包内 JSON 先注册，再执行脚本的 `setup(api)`。同包脚本的 manifest 可省略；如提供，ID 和版本必须匹配归档。脚本获得 `sdkVersion:1`：

- `registerContent(definition)`：注册完整内容，包括 Activity、Effect、Trigger 及职业成长声明，命名空间必须属于当前包。
- `registerImageAsset(asset)`：注册图片，接受现有图片格式、大小及 ID 校验。
- `registerHeadlessAction({id,rolls,resolve})`：注册特殊计算；骰子由 Host 提供，处理函数返回 `context.succeed()` 或 `context.fail(reason)`。
- 兼容注册接口：法术、物品、怪物、资源、种族、背景及属性生成方案。新自动化建议使用 `registerContent`。
- `migrations`：相邻版本的纯 JSON 状态迁移，目标版本通过 `script.stateSchemaVersion` 声明。

处理函数只读 `actor`、`target`、`targets`、`action`、`rolls`。命令接口为 `heal`、`grantTemporaryHitPoints`、`dealDamage`、`applyStandardCondition`、`spendResource`、`restoreResource`；复杂效果与触发请声明 Activity/Effect。命令由 Host 检查目标、资源和权限，并原子提交。最多 64 项命令，有超时终止与交易重放保护。

脚本不能直接改角色/地图对象、访问 DOM、网络、文件系统或执行动态导入。声明这类未支持权限会报错。房间分发会把归档转换为同一个自包含 Worker 模块，保留 JSON、图片和脚本，不会仅分发一个丢失脚本的 JSON。外部脚本不会在主线程执行。

## 验收及范围

事件后续目标支持 `target.selection: "choose-one"`，限 `origin: "event-target"`、圆形或球形、`maximumTargets: 1`。Host 筛选距离、敌我关系、视线和效果线，玩家可选择或跳过；`excludeEventTarget` 可排除最初目标。选择值不是授权，Host 会重新对照候选列表。地图高级 Activity 编辑器可配置。

移动触发的 `movement-property.movementKind` 支持 `voluntary`、`forced`、`teleport`；未标记来源的旧事件不能满足任何具体来源条件。普通主动移动由 Host 标记为 voluntary；统一法术地图位移完成后使用真实落点生成来源事件，支持 `movement-source-distance`（minimumFeet/maximumFeet）检查距离位移来源的实际距离。该事件还向来源角色开放后续 Activity，保留来源角色的等级与结算归属。它不是一个可由玩家自行提交坐标或距离的接口。

内置规则资料结构化工具已收到上述字段说明，仍须使用预览校验。完整施法内嵌武器攻击尚未接入；单独 attack-roll 或 grant-weapon-attack 不能替代它，不得将这类转换标为完整自动化。

Effect 可声明 `{"kind":"healing-prevention","scope":"all"}` 禁止恢复生命值，或使用 `scope:"nonmagical"` 只禁止非魔法治疗。期限和解除条件由所在 Effect 控制；不会禁止获得临时生命值。编辑器中对应“禁止恢复生命值”。

一次性可选奖励骰可以声明为：

```json
{"kind":"optional-bonus-die","sides":6,"appliesTo":["ability-check","saving-throw"],"consumeOnUse":true}
```

支持 d4/d6/d8/d10/d12；每个 Effect 只能配置一项，适用类型不能重复。施加 Effect 不请求奖励骰；实际检定时沿用 Host 的可选奖励骰通路。跳过保留、使用后移除**整个 Effect**（包括同一 Effect 中的其他修正），未使用按原期限到期。不要将应继续存在的其他能力放入同一个 Effect。Host 验证效果实例、检定类型和骰面，拒绝重复使用或超骰面值。地图的角色确认窗口列出所有可用效果；无角色卡的 DM 单位也可选择或取消。

需要持续期间重复使用时声明 `consumeOnUse:false`，效果不会因本次使用被移除，仍按原期限到期；每次检定独立选择并校验骰值。该字段必须为布尔值。永久的“只能接受某种典礼一次”属于另一个历史资格限制，不能用奖励骰消耗代替。24 小时可表达为 14400 个六秒轮，战役时钟推进 1440 分钟后到期。

永久受益历史可用 `{"id":"remember-benefit","kind":"establish-spell-authority","target":"target","recordKind":"benefit-history","benefitKey":"coming-of-age"}` 与奖励效果放在同一条件分支。Host将记录保存到受益者，身份按模块ID和benefitKey组成，独立于施法者和临时效果；已有记录时，在消耗及写入前拒绝整个执行。benefitKey限1–80字符的小写字母、数字、点、下划线、冒号或连字符。历史不会因效果到期、驱散或长休删除；它不替代年龄、意愿或其他资格校验，默认不允许重新受益；规则确有死亡后再次受益时可使用上述benefitRenewal合同。不同模块ID的历史相互隔离，重新命名导入包的全局去重尚未提供。

生物目标可声明 `requiredQualifications`，也可放在选项的 `targetOverride` 中。例如 `{"id":"young-adult","label":"该生物是否刚成年？","audience":"dm","creatureTypes":["humanoid"]}`。Host先核对已知生物类型，再取得DM或目标控制者的确认；`audience`也支持`target-controller`。未知生物类型、拒绝或取消都不能赋予效果。`whenChoice:{choiceId,optionIds}`可限定声明生效的选项。每个目标声明1–12项，ID限1–80个小写标识字符，提示最多500字符。

这类确认是本次施法的事实资格输入，不是允许DM任意改写结算的Headless批准。法术和特性Host入口都将确认绑定到施法者、模块、规则动作、事务ID和选项；运行时使用私有内存凭据，导出/同步JSON不携带凭据，玩家payload中的同名字段不提供资格。再次施放重新确认。独立command接口的Host调用者须在序列化command之外提供`targetQualificationIdsByTargetId`；不要从玩家command复制该上下文。此接口不自动推断年龄或信仰，也不取代施法期间范围的连续校验。

状态提示通过 `dnd5eActiveEffectMechanicalDescription` 从生效实例生成说明，无需为法术名编写专属 UI。当前支持可选奖励骰、治疗限制和速度修正；奖励骰说明包含适用检定、骰面、使用后移除及剩余期限。地图标记和状态详情共享说明，DM 与玩家端均从同步的效果实例读取；未覆盖的修正不会自动生成说明。

可直接导入 `examples/community-sdk/check-boon.starmod`；对应 JSON 是自定义演示，不是官方法术复刻。模块赋予的奖励骰已验证用于 Host 属性检定、专注豁免；现有内置可选骰测试覆盖法术/持续区域等通路。这不代表所有自定义 Activity 检定都已接入可选骰交互，也不提供强制惩罚骰。

TypeScript 类型列出协议可表达的字段，实际可执行范围还受 Activity 运行时校验和 Host 编译器限制。SDK 当前没有通用的结算中暂停/续结算、动态再选目标或强制下一次检定惩罚骰协议，不能声称任意扩展机制已经可实现。参见[扩展机制接口核查](verification/2026-09-24-expansion-module-interface-audit.md)。

`communityModuleSdk.test.ts` 使用真实 Worker 源码在隔离 JS realm 中初始化包，然后通过实际 Host 注册、施法、结算、到期和卸载；这不是浏览器双端人工验收。测试还覆盖独立状态往返、跨包未声明依赖、脚本权限和命名空间伪造。

新增内容可以直接使用上述通用链路。原生 123 个法术仍由 `core-spell-transaction` 接入原有专属结算器；本次没有把这个兼容层冒充为已删除。彻底迁移它仍需要按各法术交互逐项实现及验证，不能删除入口来取得表面上的完成。


### 多阶段活动的可选收尾

`continuation.finishActivityId` 可指向不包含 continuation 的终止活动。该活动必须声明同一 `requiresContinuationFrom`，在首步完成后开放，达到 `maximumSteps` 后仍保留。收尾执行成功会关闭后续活动；回合结束后历史失效。

没有固定次数、但每个生物只能命中一次的连锁使用 `maximumSteps:"distinct-targets"` 和 `excludePreviousTargets:true`。Host 用实际未访问目标计算剩余步数，每步必须选择至少一个新的生物；不接受空目标、重复目标、玩家伪造历史或中途更改限制模式。循环的根活动及后续活动都使用此模式；后续活动声明同一 `requiresContinuationFrom` 并使用免费激活。`maximumDistanceFromPreviousTargetFeet` 按上一目标计算，后续活动的普通射程不能误设为同一段距离（普通射程仍以施法者为原点）。命中与相同骰值可同时作为继续条件；重新投骰的阶段不要声明 `carryRolls`。这是有限目标驱动的逐步选择，不是后台无限循环。

收尾中的 actor teleport 操作可设置 `continuationTargetRadiusFeet`，以本次执行历史中的目标限制落点距离。`distanceFeet` 仍使用公式节点。Host 从自己的历史记录注入锚点，不信任玩家提交的目标历史；地图负责二次校验占用与可见性。玩家取消落点选择时不提交该次移动。


### 法术武器与召唤物配置补充

插件装备的武器 `damage.type` 接受全部 13 种 D&D 伤害类型；`grantsProficiency: true` 只授予该武器的熟练，攻击属性仍由 `attackAbility` 决定，不自动替换为施法属性。编辑器可选择伤害类型并切换此选项。需要来源生命周期时，使用下方的来源物品与临时武器字段。

Activity `summon` 可声明 `creatureTypeOverride`（celestial/fey/fiend）、`minimumIntelligence`（1–30），以及 `shareSelfSpellsRequiresMounted`。最后一项须同时指定 `shareSelfSpellsRangeFeet`；Host 根据真实骑乘关系校验，靠近坐骑不会替代骑乘。字段经 Token 持久化进入 Headless 快照，不改写怪物目录。共享已接入原生自身法术、扩展法术编译器及直接 Activity 提交。仅以施法者为目标时，共享治疗、临时生命值、状态、可支持的属性恢复、变形和地图移动结果；不复制物品发放或资源成本。地图移动仍须完成各自的落点校验。


`weapon-enchantment.attackUses` 接受公式，Host 求值须为 1–1000 的整数；实例保存 `remainingAttacks`。普通武器攻击完整结算后扣一次，包含失手；无效命令不扣。最后一次先结算攻击再移除附魔。剩余次数随物品绑定转移，悬置附魔不消费。`weaponSlot:"ammunition-container"` 使用 Host 校验的已装填箭/弩矢容器；箭袋次数与库存弹药分别扣除。耗尽附魔不删除容器或剩余普通弹药；不要额外配置整袋删除。以太位面、已释放或不可取用容器链中的弹药不作为可用库存。已接入普通攻击、借机攻击的共同攻击结算、猎人齐射与墙段攻击。最后一发结算后结束该来源的专注，其他来源不受影响。


箭袋附魔可显式设置 `consumeOnDraw:true`（要求 `weaponSlot:"ammunition-container"` 和 `attackUses`）。此时成功取出或转交弹药也按数量扣除额度；失败事务和同容器操作不扣。已取出的附魔弹药绑定真实库存实例，保存和转交后保留来源及剩余数量；其后射击消耗自身次数，不再次扣原箭袋额度。Host 派生的 `ammunitionStack`、`drawSourceEffectId` 是运行时绑定字段，不由模块作者手填。来源专注结束会清除容器与离袋弹药附魔。未设置该选项的既有模块保留按攻击次数消耗的行为。


### 来源效果拥有的生成物品

战役时间推进后，角色名册会先处理所有角色的计时及来源效果结束，再统一清理关联物品。拆分堆叠、转交和重新载入不会改变原来源身份；其他施放批次及普通物品保留。来源角色不在当前权威名册时不推测其效果已结束。此清理只适用于声明了来源关联的生成物品，不会自动把现有普通物品改造成限时物品。

长施法及持续交互完成的结果提交也会在计时处理后执行同一清理，将接收者的库存、装备投影和必要状态补丁纳入本次提交。接收者无需在当前地图上，不依赖后续后台计时同步才移除过期物品。

`grant-inventory-item.sourceEffectId` 指向同一个 Activity 定义中的效果。该次执行必须实际给施法者施加此效果，否则整次求值失败。Host 为本次来源生成唯一关联，并同时写入效果和生成物品；不同次施放不会共用关联。模块无需自行生成或提交关联标记。

需要让新武器直接出现在装备栏时，可声明 `equipToFreeHand:true`。库存结算要求数量为 1 且模板为武器，依次检查模板允许的主手、副手空装备槽，将本次新建实例装备到首个合格槽位。没有合格空槽则拒绝整批发放，保留原库存和装备；不会替换已有武器，重复回执也不会再次发放。Headless 施法与 Activity 权威结算还会检查行动者可用手数及当前 `free-hand` 擒抱关系；新武器超过剩余手数时拒绝提交，不消耗行动资源。直接调用库存函数只做库存和装备检查，需要由调用方提供上述战斗权威校验。

已有物品变形的底层 Activity 操作为 `alter-inventory-item`，与生成物品不同：声明 `originalTemplateIds` 原物品模板白名单、`templateId` 已注册目标模板、`quantity` 公式及 `sourceEffectId`。命令只携带所选 `inventoryInstanceId`、`inventoryOwnerId` 和 `expectedInventoryRevision`，由 Host 重读施法者库存。结算保留原物品快照，效果结束后恢复普通形态；失败不会提交暂存库存。当前 Host Activity bridge、共用物品选择、法术编译及地图计划结算已接通此操作。合成法术的成功、过期版本、错误物主及数量不足路径已通过本地验收；原书转换、浏览器与完整模块往返仍须独立验收。选中物品的 charge 消耗与该操作组合目前也拒绝，避免两个库存分支覆盖彼此；本段不是完整法术支持声明。

永久物理转换在同一操作中声明 `permanent:true`，省略 `sourceEffectId` 和 `captureSpellcastingModifier`。转换不创建效果租约或可恢复快照；正常物品转交、重载和效果清理后仍是目标物品。`target:"actor"` 选择施法者库存；`target:"target"` 选择已选生物目标所绑定角色的库存，必须同时声明 `permanent:true`。物主由 Host 的目标身份映射确定，命令中的 `inventoryOwnerId` 不能指定未选角色。转换后物品仍属于原物主，材料和法术位由施法者消费。Host校验模板白名单、实例、数量、物主和库存版本，支持材料先暂存扣除后使用原观察版本结算；施法期间库存转移或版本变化拒绝结算。一次事务仍只支持一个堆叠，目标身份缺失或歧义拒绝。过期、已释放、以太、效果绑定物品及容器、充能/同调等复杂状态拒绝转换。地图物体使用下文的独立操作；临时可恢复转换仍仅支持施法者库存。典礼术v15实际导出重导入的普通/仪式、自持/他持四项本地路径通过，完整玩家选择与双端施法仍须验收。

地图模板物件的永久转换操作为 `convert-map-inventory-item`，声明 `originalTemplateIds`、`templateId` 和整数 `quantity`（1–1000）。目标为 `origin:"point"` 的5尺乘5尺矩形，明确 `placeRangeFeet`。Host核验所选点唯一合格的 `dnd5eObjectState.inventoryItem`，不根据名称猜测模板。转换物件仍在地图，保留原污染等状态；普通堆叠可拆分并保存转换收据，带有液体体积或污染附加状态的堆叠不允许部分拆分。魔法、临时创建、召唤、穿戴携带、遗骸及容器/资源/装备等复杂模板拒绝。Host复核触及距离、高差和效应线，长施法绑定原物件身份、位置和状态；观察到移除、替换或状态变化后，即使恢复，也不继续旧请求。一次事务只转换一个物件堆叠，重放不重复生成结果。地图拾取及完整玩家双端流程需另外验收。

`templateVariants` 可声明 `{ minimumCastLevel, templateId }` 列表。执行时按实际施放环阶选择已满足条件的最高档，未满足时使用基础 `templateId`。环阶范围 1–9，不可重复。V2 模块注册时，当前包中存在的物品短 ID 自动补全模块前缀；外部完整 ID 保持不变。这是运行时转换，不改写归档或签名投影。

关联字段随库存转交和持久化保留。Headless 提交与地图回写会根据来源效果是否仍存在清理生成物品、装备投影及物品附魔；有限角色快照不清理来源角色未参与快照的物品。重复发放仍由库存回执去重。`reuseSourceEffect` 允许已授予的召回 Activity 复用仍存活的来源；升环读取来源效果原始环阶，`maximumPerSource` 按房间库存检查数量。直接 Authority 调用此限额召回时必须提供 Host 的 `inventoryRoster`，不能用单个角色快照代替。

参考实现与验收边界见 [FVTT B3/B4 对照](verification/2026-09-25-fvtt-b3-b4-source-lifecycle.md)。

### 临时武器与投射物

- 武器 `advantageAgainstUnlitTargets` 从 Host 的目标光照状态获取攻击优势，并与劣势正常抵消。
- `vanishesAfterRelease`：投掷或丢弃后取消装备、禁止使用和转交，释放者回合结束时删除。来源效果仍在时可通过已授予 Activity 召回；原实例未消失前不能重复生成。
- `usesSourceSpellcastingAbility` 配合发放操作的 `captureSpellcastingModifier`，把来源施法属性写入物品实例。持有者提供熟练加值；转交不改写来源属性。不得由客户端提交该加值。
- `consumesQuantityOnAttack` 支持堆叠式武器，每次有效攻击消耗一件，包括失手；失败事务不消费。`slingRangeFeet` 可声明投石索模式，Host 校验副手实际持有投石索。
- 武器绑定与箭袋绑定的不同法术伤害可同时生效；同一法术重复副本不叠加。箭袋选择、实际耗用弹药与计数使用同一容器实例。
- `target.effectOrigin:{effectId,rangeFeet}` 可从施法者所拥有的指定绑定效果的当前持有者测距，例如武器转交后的爆发；不存在或存在多个不明确来源时拒绝。

### 召唤、控制与坐骑契约

`summon.corpseFormChoiceId` 指向骷髅/僵尸等目录选项。Host 验证小型/中型、已死亡且有遗体，支持逐个目标选择形态、尸体原位置生成、`groupInitiative` 共用先攻以及结束时恢复尸体。数量上限使用正常 Activity 升环目标配置。

`commandPolicy` 接受 `persistent-order` 或 `turn-order`。`command-owned-companion.sourceActivityId` 验证命令来源与所有权；前者保留命令，后者在召唤物回合结束后清除。`requiresSpeech` 要求施法者在自己的回合能够发声；听觉可由 `can-hear-source` requirement 校验。没有命令时，持续命令召唤物防御；回合命令召唤物仅可向攻击过自己的目标反击。

`owned-companion` 检查来源所有权，不要求永久召唤；可选 `bondKey` 仍检查指定契约。临时法术的命令入口需通过持续效果的 `grants` 实际授予施法者，并在施放分支 `apply-effect`；同属一个法术的多个 Activity 不会自动变成玩家按钮。扩展安装会注册效果/契约授予的 Headless 动作，使用时仍必须持有对应效果实例并通过 Host 权限校验。PDF 预检会报告无法从施法入口通过授予、调用或续段进入的后续活动；该静态检查不是行为认证。

导入包的 `continuation.nextActivityId` 与 `finishActivityId` 同样注册为效果授予的 Headless 动作；存在按钮定义不等于有使用权限，Host 仍校验当前续段收据、角色、版本、回合和目标历史。`distinct-targets` 连锁若已没有跳跃距离内的未访问目标，会结束并移除续击入口。

PDF 缓存恢复、重新检查与继续转换会把原文和职业目录交给当前预检器，重新核对明确的源文限制、环级、专注及目录职业；过去的检查结果不能替代本次检查。`preflightPdfSpellDraft` 的第三个参数接受 `{source, classReference}`。导出器接受每条 `source` 和全书 `classReference`，在随附报告中保存 `sourcePreflight`、已检查条目数和具体警告；资料与未完成草稿仍可导出，但 `roundTripVerified` 只代表文件再导入一致，`behaviorVerified` 与 `sourceCoverageVerified` 不因此变为 true。

预检也会核对原文明示的固定材料价格与持续时间；每轮六秒。昂贵或消耗材料须提供可执行 `components.materialRequirement`（或覆盖全部选项的条件材料配方），`materialText` 不会自动生成库存配方。价格与消耗必须由 Host 库存事务验证；不明确的逐目标价格不能猜成固定总价。

材料组件可声明 `bindEffectId`，将本次施法新建的施法者效果绑定到实际分配的物品实例。它要求 `consumed: false`、数量为 1，库存实例也必须是独立单件，不支持延迟消耗托管。Host 在材料复核通过后写入 `removal.onInventoryInstanceDestroyed`；旧效果、重复占用同一实例、找不到效果或多个匹配效果均拒绝整次结算。现已验证 `.starmod` 导出重导入后的地图法术事务与失败回滚。此入口尚不代表所有反应活动调用方都已接通；地面物品销毁及完整囚禁生命周期仍需另外验收。

绑定物品的转交保留实例 ID，绑定效果仍归原施法者。房间生命周期清理会读取角色背包、地面实例及同伴携带实例；物品缺失或实例重复不会被推定为销毁。具有明确物体战斗属性和有效最大 HP 的地面物品降至 0 HP 时，结算保存 `condition.destroyed`，解除绑定效果及其跨图依赖，并拒绝将残骸作为完好物品拾取。上述转移／销毁组合已完成本地行为验证，完整双端操作仍待验收。材料必须来自正式注册的物品模板，不能通过改写其他模板的实例快照绕过权威规范化。

一次性跨类别优势使用效果 modifier `{ kind: "next-d20-advantage", rollKinds: ["attack", "ability-check", "saving-throw"] }`，首个实际检定会移除整个效果，三类不会各获得一次。配合 `{ kind: "rounds", rounds: 1, expiresAt: "target-turn-start" }` 表示下回合开始失效。该效果使用正常效果持久化及压制规则；应单独存放，不要将需要继续保留的属性增益混入同一个效果。自动豁免不消费，失败事务不消费；连续检定必须经 Host 的顺序检定接口。

对于只有答案需要 DM 叙述的活动，可以使用 `{ id: "question", kind: "narrative-prompt", prompt: "由DM依据已知信息回答。" }`。成功结算会记录一次提示，不打开审批窗口，也不会生成答案。提示限 1–2000 字符；授权、次数和动作经济仍由正常 Activity 配置结算。这个操作不执行任何其他机械效果，不能用它代替尚未实现的状态、伤害或选择流程。

`Effect.modifiers` 可使用 `{kind:"weapon-attacks-against-target",mode:"disadvantage",delivery:"ranged"}`，只影响攻击效果持有者的远程武器攻击。`mode` 也支持 `advantage`；`delivery` 可为 `melee` 或省略以涵盖所有武器攻击。投掷武器按当次攻击方式判定，法术攻击不受影响，即使借助武器投射。效果支持序列化、反魔法暂停、到期移除；玩家武器预览、怪物预览和 Host 结算采用相同条件。它不同于 `weapon-attack-roll`（影响持有者自己发起的攻击），也不同于不区分攻击种类的 `attacks-against-target`。

怪物自动回合已接入未下令时的武器反击和失控后的最近目标追击，包含普通移动、疾走及多重攻击的逐目标限制。反击记录包含未命中的攻击，并随地图状态持久化；没有可反击目标时防御。失控目标按三维占位距离选择，排除要求的子类型及法阵保护者，忽略阵营，允许并列最近者；移动后重新校验最近目标，攻击准备与 Headless 均再次检查。自动规划仍由现有怪物回合入口启动，不是后台自行推进先攻。该路径不自动规划任意语言命令、法术或特殊辅助动作，不能据此宣称所有召唤行为已经完整自动化。

`controlSave:{ability,dc,lingerDieSides}` 创建召唤物回合末重复豁免。命令的 `controlSaveDisadvantage` 可为本轮豁免施加劣势，回合结束后复位。成功后失控，原专注仍在；提前结束专注时由 Host 掷一次延迟消失骰并持久化结果，到期/降至 0 HP 直接清理。`maximumChallengeRating` 和 `requiredCreatureSubtype` 由真实目录资料校验，缺数据不生成替代怪物。

`protectiveCircle` 创建施法者原占据空间的固定区域。区域的 `restrictedTokenIds` 与 `protectsOccupantsFromRestrictedTokens` 限制指定召唤物穿越、传送和针对圈内生物的目标/伤害；其他生物可通过，离圈后保护立即更新。该字段只表示规则结果，血液材料与真名是否真实仍由 DM 确认。

持久召唤的 `bondKey` 用于跨法术互斥，例如两种坐骑法术都使用 `steed`。Host 建立永久契约和实例 ID。`dismiss-owned-summon` 默认暂时遣散，`releaseBond:true` 永久解除；旧地图实体在同步/载入时检查同一契约实例，旧副本不能重新获得控制。未解除契约前，重新施放只能召回同一形态及类型，恢复完整生命值。

`bondDismissActivityId`、`bondActivityIds` 给施法者授予契约操作。`choices[].optionsFrom:"actor-languages"` 使用角色已知语言生成选项，召唤操作通过 `languageChoiceId` 选定；Host 从自己的快照重建候选。`open-communication.medium:"telepathy"` 支持心灵沟通事件及精神回复，配合 `owned-companion.bondKey` 和目标距离限制；具体话语仍使用房间现有沟通工具。

召唤可通过 `summon.monsterChoiceId` 引用活动中的生物选择项，选项 ID 为真实怪物 ID。`monsterId` 保留一个合法基础配置，最终使用被选中的 ID；该字段不能与 `corpseFormChoiceId` 同时使用。动态候选可以声明：

```json
{"id":"creature","label":"选择生物","optionsFrom":"srd-monsters","options":[],"monsterFilter":{"creatureTypes":["fiend"],"subtype":"demon","maximumChallengeRating":1}}
```

客户端与 Host 分别从内置 SRD 目录重建候选，不采信玩家提交的候选列表。过滤器使用标准英文生物类型，恶魔/魔鬼子类型兼容中英文目录，挑战等级支持小数。过滤器上限是静态值；法术升环时仍须用 `summon.maximumChallengeRating` 公式限定本次施放的实际上限。`requiredCreatureSubtype` 继续在地图召唤时校验。这个动态来源只包含内置 SRD 生物，不宣称扩展怪物已安装；需要其他怪物时可显式声明已安装目录的 ID。模块导出保留过滤器，重新导入时从接收方目录重建选项。

法术的条件材料可用 `components.materialRequirementByChoice`：

```json
{"choiceId":"mode","options":[{"optionId":"ordinary"},{"optionId":"special","requirement":{"label":"特殊材料","options":[{"label":"钻石","components":[{"tag":"diamond","label":"钻石","quantity":1,"consumed":true}]}]}}]}
```

该映射必须精确覆盖施放 Activity 中同名静态选择的全部选项。缺少提交选项、非法选项或缺材料时 Host 拒绝施放；无 `requirement` 的分支沿用基础材料要求，不会扣除特殊分支的材料。配方标签匹配权威库存物品的 `spellcastingMaterial.tags`，材料消耗与法术结算一并提交。映射随模块导出并在接收方重新校验。条件材料法术必须走 Activity 路径，叙事回退不能绕过选择与材料校验。

`requirement.consumptionTiming` 默认为 `cast`。设为 `spell-end` 时，应消耗的组件仍填 `consumed:true`；Host 在成功施放时把这些单位移入独立预留记录，绑定本次效果实例，不能再次使用或转交。专注结束、有限持续时间到期或战役时间推进后，预留记录转为已消耗并保留回执。必须声明 Activity 和明确的 `timed` 法术持续时间，不能用于无限期或叙事持续时间。该接口不证明材料的叙事来源或其他正文资格，也不代表任意外部物体销毁均已关联法术结束。

材料无需预先内置。可在同一模块的 `items` 中声明带有 `spellcastingMaterial.tags` 的材料模板，配方引用同一个标签；导出文件会同时携带模板与法术。未知价格与重量可以省略。声明模板不会发放库存，也不证明角色已经取得材料或满足原文的新鲜度等条件。材料来源由 DM 确认，时间限制仍需对应的实例数据与校验。

配方组件的 `requiresExpiry:true` 要求库存实例提供 `expiresAtWorldMinute`，并在分配及提交时校验权威战役时间早于截止时间。缺少时钟、缺少截止时间或已经到期均拒绝。Host 发放材料时可以记录截止时间；模板不包含某个房间的绝对时刻，也不会自动推定取得时间或死亡时间。未设置该标记的普通材料保持原规则，但已有到期时间的实例同样不能过期使用。

### 飞行限制与强制安全下降

`Effect.modifiers: [{kind: "flight-speed-limit", maximumFeet: 0}]` 仅限制飞行，包含天生、变形和魔法飞行。上限在加值后应用；暂停效果不生效，忽略魔法速度减益的能力抵消魔法来源的上限。它不改变原始速度，也不直接移动目标。

需要在禁飞时下降的规则，可另外施加 `controlled-descent` 修正，字段为 `maximumFeetPerRound:60, safeLanding:true, endsOnLanding:true, forceWhileFlightBlocked:true`。Host 在目标回合开始推进高度，即使目标有悬浮/魔法支撑；只有有效禁飞上限为0时强制生效。下降效果应与持续禁飞效果分开，避免落地移除禁飞效果。两者可共用专注期限。普通羽落不要添加强制标记。

### 仅限武器攻击的修正与消耗

`{kind:"weapon-attack-roll",mode:"advantage"|"disadvantage"}` 只影响武器攻击类别，包括自然武器和徒手打击；不影响法术攻击，包括使用投石索投射魔石的法术攻击。下一次武器攻击后移除效果使用 `breakOn:["makes-weapon-attack"]`，命中与失手均消耗。它可与 `duration:{kind:"rounds",rounds:1,expiresAt:"target-turn-end"}` 并用，保留未发动攻击时的到期清理。玩家骰子准备和怪物多重攻击准备使用相同类别；一次性效果只影响多重攻击第一击。

攻击优势若取决于效果来源的位置，可声明 `{kind:"attack-roll",mode:"advantage",sourceProximity:{rangeFeet:5,requiresMutualSight:true,requiresSourceSeeTarget:true}}`。`rangeFeet` 测量来源到攻击目标的距离；`requiresMutualSight` 要求来源与效果持有者互相可见；`requiresSourceSeeTarget` 要求来源能看见攻击目标。Host 在攻击时按当前距离、视线和效果暂停状态判断，来源缺失或距离未知时不授予优势。条件不满足不会删除持续效果，恢复条件后可再次受益。此选项仅用于无属性限制的 `attack-roll` 优势；不会自动提供心灵通信、施法目标资格或专注，这些必须另行配置及验收。


### 效果绑定的临时生命值

`temporary-hit-points` operation 支持可选 `sourceEffectId`，引用同一 Activity 的 effect。先对受益者 `apply-effect`，再执行临时生命值授予；Host 拒绝不存在或未由当前来源建立的绑定。效果最后一个组成部分移除或持续时间结束时，清除该来源剩余的临时生命值。之后换成更高的另一来源池，或同值的不绑定池，不会被旧效果结束误删。未声明时保持普通临时生命值行为；它不是治疗，也不会叠加两份池。

持续技能专精使用 Effect modifier `{kind:'skill-expertise',skill:'stealth'}`，只使已有技能熟练加倍，使用受术者当前熟练加值，不叠加已有专精，也不修改永久构筑。`skill-proficiency` predicate 接受 `subject`、系统技能 `skill` 和精确 `rank:0|1|2`（未熟练／熟练／专精）；例如 `subject:'target',rank:1` 限制为已有熟练但尚无专精。缺少 Host 资格快照时拒绝。该接口的 Host 检定、保存、压制和到期测试已接入；具体导入内容仍需施法选择及房间验收。


### 独立特性使用次数

独立 `features` 条目可声明 `resources: [{ id, label, shortLabel?, maximum, resetOn, stacking? }]`，字段与专长资源一致。`maximum` 为1–1000000的整数，`resetOn` 为 `combat`、`short-rest` 或 `long-rest`，资源ID按模块命名空间注册。仅拥有且满足特性资格的角色可用；保存或同步不会恢复已用次数，短休资源也在长休恢复。移除已安装模块内的特性后，资源随资格清理。Activity仍须声明相应资源消耗；资源字段自身不会替代行动经济或触发窗口校验。


Activity的资源引用可使用同包feature/feat的已声明本地资源ID。统一注册时仅解析这些声明的`resourceId`引用（含条件和操作），保持原包数据不变；已限定ID及未声明的核心或外部ID不会凭名称猜测。消费仍由Host按已注册资源余额校验，不允许另一模块的同名池替付。

伤害检查点中的个人反应目前支持通过通用 Activity 授予临时生命值及不含额外机制的持续时间效果。Host 在原始攻击的实际扣血检查点执行，命令必须引用该会话返回的 triggerEventId；资源与反应次数同结算提交。注册 before-damage/reaction 时若省略反应次数费用，统一注册层会补入一次 reaction 消费；已有声明不会重复添加。该会话尚未接入地图网络选择，也尚不支持抗性重算、转移伤害或触发伤害后才开启的易伤，不得把这种内部能力视为整项法术认证通过。

原始伤害阶段补充：已迁移的武器攻击、通用Activity伤害提案和脚本dealDamage入口会在类型防御计算前提供raw-typed-damage-before-defenses检查点。个人反应可在此添加类型抗性/免疫/易伤，再由原结算器处理原始分量；旧adjusted阶段仍拒绝这种防御变化。房间UI和全部伤害路径尚未迁移，不能将能力声明当作全书自动化通过。

Host可用createDnd5eActivityDamageCommitSession包装通用Activity权威输入。会话冻结原命令和Host骰值，支持多次伤害检查点暂停/接受/放弃，在整次施放完成后返回原bridge结果；只应提交最终结果。等待期间Activity注册内容变化会拒绝恢复。房间层仍需核查当前revision/库存上下文并实现玩家选择，内部会话可运行不等于网络入口已经接通。


### 伤害前玩家反应的当前接入边界（2026-09-26）

地图的直接 Headless 动作、同步 prepared facade，以及异步插件脚本的同步 capability 提交阶段，已连接个人伤害前反应的暂停/选择/恢复流程。异步 worker 在提交前运行一次；等待玩家期间不保留全局引擎监听器。Host 冻结原始骰值与命令，并在选择、反应投骰及提交前检查权威上下文是否变化。

已完成隔离 DM/攻击玩家/防御玩家三端的合成模块验收：模块导出后由 DM 上传，两玩家激活；玩家完成武器攻击投骰并经 DM 确认；受伤玩家选择导入能力；Host 一次消耗资源与反应，并同步临时生命吸收后的结果。这只证明该机制的真实房间链路，不等于任意书中条目或所有伤害来源已认证。

目前适配器仅支持受伤者对自己的临时生命与有限类型防御。类型防御要求调用点保留原始伤害分量；仅有调整后伤害的旧调用点不能再次套用抗性。重定向、盟友代受、触发伤害之后才生效的易伤及复杂生命周期仍须扩展适配器并增加逐条验收。导入预检仍保留 before-damage 条目的认证阻塞，不能仅凭 schema 合法标记完整自动化。

场景交互的类型伤害与施法后随机表的范围伤害已在抗性前开放个人反应窗口。场景交互可在非战斗状态结算；此时仅 Host 已验证的伤害检查点可授予内部 `allowInactiveDamageReactionCommit` 许可，且提交桥再次要求 `reaction` / `before-damage`。该许可不属于导入配置或玩家命令，不能用于普通战斗外动作。战斗外反应不启动战斗、不重置资源；后续效果到期仍需对应的回合或时间推进机制，此处不代表完整地图网络及持续时间验收。


个人伤害前反应现在可给 `apply-effect` 增加 `timing: "after-triggering-damage"`。该字段只允许 reaction / before-damage / actor 的组合；普通主动施放不能借用这个延后提交窗口。临时生命及其来源效果先应用，易伤、状态和速度处罚使用单独的延后效果。延后操作由 Host 收集为已解析数据，绑定到触发的具体伤害调用，完成该笔伤害后才应用；下一笔伤害可以读取新效果。禁止把尚未应用的延后效果当作先前临时生命的来源。

已验证两段各7点火焰伤害：反应先授予10临时生命，第一段之后仍有3临时生命、正常HP未损；随后应用火焰易伤和失能，第二段变为14点，扣除剩余临时生命后损失11HP。资源只扣一次，处罚在目标下回合结束时消失。这是机制回归，尚不代替书中条目自动转换、全部伤害来源或玩家网络的专属验收。


2026-09-26 的实际PDF来源验证补充：自动转换的莱维斯图斯之墓已在独立导出/重新导入后通过武器伤害的临时生命、延后处罚、到期清理及资源恢复测试，并通过隔离DM/攻击玩家/防御玩家三端上传、激活、反应选择和Host同步。该证据限定于已测场景，不认证全部伤害来源，也不认证全书。转换结果与行为报告分开保存，未经手工修改的候选仍保留其未验证项目。


### 非魔法武器附魔资格

`weapon-enchantment` 修正可以声明 `requiresNonmagical: true`，仅适用于 `main-hand` / `off-hand`。Host 从真实装备投影固有魔法属性，并在每次执行时检查当前有效的魔化武器或武器附魔效果（包括无数值加值的附魔）。未知属性、魔法武器和不受支持的弹药容器资格会拒绝；玩家不能通过命令覆盖这些事实。省略该字段维持原有允许附魔的规则。

资格检查不修改装备。真实 Host 事务测试验证首次成功消费资源、第二次因已有附魔被拒绝且资源不变。本能力只解决武器资格，不代表已实现护甲附魔、任意背包物品选择、跨持有者转移或长休/死亡结束全部生命周期；转换结果仍应逐项声明这些限制。


### 当前穿戴护甲的物品绑定

Effect 修正 `armor-enchantment` 使用 `armorClassBonus` 公式（Host 结果须为1至3），绑定施放时目标穿戴的护甲。Host 保存护甲ID与可用的库存实例ID，命中判定仅在相同护甲仍被穿戴时应用；同类加值取最高值。可随库存实例转交，未穿戴时暂停，丢弃时清理。多个物品应使用独立Effect，不可在同一个Effect混合武器与护甲绑定。物品效果不复制给共享自身法术的坐骑。

已验证保存重读、重复施加不叠加、替换为同模板另一实例、脱甲、转交重穿及丢弃。非魔法资格、库存选择及来源生命周期的后续支持见下文；这些原语测试不等同于完整锻造祝福认证。


`armor-enchantment.requiresNonmagical: true` 现已支持。Host 从装备显式属性和库存魔法物品身份读取固有魔法信息，并在每次执行时重新检查当前有效的护甲附魔。未鉴定不表示非魔法；未知事实拒绝。普通内置护甲明确声明非魔法，其他资料应保留真实装备或库存数据。附魔结束后恢复资格。护甲腐蚀的非魔法条件也排除当前被附魔的护甲。不能据此声明完整锻造祝福自动化。

### 选择库存中的武器或护甲

`weapon-enchantment.weaponSlot: "inventory-item"` 和 `armor-enchantment.itemSelection: "inventory-item"` 可绑定目标库存中的具体实例。原有手持/穿戴模式继续有效。Activity 命令提交 `inventoryOwnerId`、`inventoryInstanceId`、`expectedInventoryRevision`；地图插件动作 payload 对应 `activityInventoryCharacterId`、`activityInventoryInstanceId`、`expectedActivityInventoryRevision`。这些字段只表达选择，物品属性由 Host 角色库存重新投影；不要在配置中填写运行时物品属性。

物品持有者必须是执行者或本次已校验的目标，实际 apply-effect 的目标必须与持有者相符。未知物品、已毁坏物品、库存版本变化、错误装备类型均拒绝。非魔法限制也检查暂停中的同实例附魔。绑定未装备物品时立即暂停加值，防止背包中的附魔影响另一件同型号装备；装备、转交、丢弃沿用库存绑定生命周期。

目前已验证 Activity 命令及编译后的 Headless 插件执行路径。法术施放与普通特性面板共用候选物品逻辑，按已选模式和效果接收者筛选；普通特性面板的浏览器点击→选择同伴武器→Headless 提交已用合成能力验证。触发确认也可返回 `inventorySelection: {ownerId, instanceId, revision}`，结算器用 Host 名册校验，过期请求不消耗资源。长休完成事件的实际派发与授权选择窗口、完整跨客户端操作尚需继续验收，不能仅凭该接口将休息触发的能力标记为完整自动化。

### 休息完成后的授权窗口（Host 基础接口）

成功的战役时间长休/短休协调记录 `Character.dnd5eRestActivityWindow`，包含受益角色、完成时间、事件身份和逐 Activity 的使用/跳过记录。首次接入旧历史只建立时间基线，不生成新窗口；冷却阻止的长休和非受益角色不会获得新窗口。世界时间离开完成时刻后窗口不可用。记录属于 Host 运行时状态，不写入可导入的内容定义。

`settleDnd5eRestActivityV1` 从 Host 时钟中的真实休息事件、角色时间水位、归属及已安装内容推导授权。成功使用时返回结算结果和 `receiptPatch`；跳过时只返回收据。调用方必须将收据与资源、效果变化原子提交，失败不得单独写入收据。重复使用或跳过后使用会拒绝。普通编译插件动作不接受休息触发能力，不能用 payload 冒充休息事件绕过此入口。

普通特性面板会读取当前休息窗口，提交事件ID、Activity选项及具体库存实例；在非战斗期间，受控角色也可提交休息能力。Host 的 `resolvePreparedDnd5ePluginFeatureAction` 使用自身时钟走专用结算，并合并效果与 `receiptPatch`。房间提交冻结 characters/maps/combat/campaign-time 版本；共享事务任一版本冲突即拒绝，不能回退为逐项保存。使用后、刷新后或时间推进后不会重开同一次选择。

非区域休息能力提供“本次不使用”，通过同一 Host 入口仅提交跳过收据，不施加效果或消耗能力资源。使用与跳过都阻止本次休息重复执行。序列化内容包中的独立特性/专长休息 Activity 可生成该操作入口；普通编译动作仍拒绝跳过 Host 的直接调用。

同一独立特性/专长可绑定多个主动或休息 Activity，导入器注册全部可执行入口，面板提供能力选择。请求携带 `payload.selectedActivityId`，Host 按当前包、原特性的 `legacySource` 绑定及角色资格重建选定能力；不能用该字段调用其他特性或攻击后等事件专属触发器。Headless 使用选定能力自己的目标、消耗和效果。每个休息 Activity 独立记录使用/跳过；同一能力多次提交仍被拒绝。区域模板开始选择时保留选定能力及选项，区域类完整端到端仍需验证。

子职的原生 Activity 使用 `legacySource: { kind: "subclass-ability", id: "本包子职ID:能力ID" }`，并保留对应的子职/能力条目作为等级和归属来源。导入器也会注册其主动及休息入口。Host 通过注册元数据映射到运行时特性，核对所选子职、对应职业等级、能力归属和子职选项；不直接替换标点或信任客户端自报的特性ID。选中的原生 Activity 使用自己的骰子和效果，不沿用旧子职动作的骰子计划。父条目为手动时，显式声明完整的子 Activity 仍可单独执行，但父条目其他机制和整子职不会自动变为已认证。

已有真实面板→结算入口的隔离浏览器验证，以及独立服务器的时钟冲突原子拒绝、玩家越权拒绝和结果读取验证；这些不是完整DM/玩家页面端到端验收。休息自动提示、多Activity/子职入口、区域休息能力与真实导出模块的双端链路仍需完成验收，不能把所有休息触发能力标记为完整自动化。


### 战斗内来源死亡

Effect 可声明 `breakOn: ["source-dies"]`。成功的 Headless 战斗事务会按权威死亡状态清除其他持有者上的相应效果，并记录正常效果移除事件；0HP/昏迷不等于死亡。优先匹配来源Token；来源Token更换后，仅在稳定角色身份唯一匹配时回溯。来源缺席或身份不唯一时保留效果，避免猜测其死亡。

已验证致命攻击、玩家第三次死亡豁免失败、其他持有者死亡、来源昏迷、Token更换及缺失来源。当前只承诺战斗事务入口；战斗外死亡和来源长休跨角色清理仍未完成，转换模型必须保留这些限制。


### 来源长休与战斗外死亡的名册协调

Effect 可声明 `breakOn: ["source-long-rest-complete"]`。Host 在施加效果时记录来源当时的 `lastLongRestWorldMinute`（null表示此前无长休），资料包不得自己填写该运行时水位。来源下一次完成长休后，角色名册协调按稳定角色身份清理所有持有者的对应效果；持有者的长休不影响来源效果。缺失或非法Host水位拒绝施加，旧持久化效果缺失来源证据则保留，不推测到期。

名册在休息前后协调，支持战斗外已确认死亡（0HP且死亡豁免失败达到3）的来源清理。会同步移除依赖效果、刷新状态投影、清除绑定在已移除效果上的临时生命值。已验证来源旧长休/新长休、null/缺失水位、持有者长休、角色顺序无关、重复协调幂等、Host施加和实际角色Store入口；完整网络房间流程与任意复杂结束后效果仍需要逐项验收。

### 休息能力的网络保存验证补充

已使用原样自动转换的子职模块，验证DM上传、玩家激活、DM完成长休、玩家选择库存护甲、Host原子保存附魔与使用收据、玩家刷新后无法重用。前后端效果结束触发名单统一到shared/active-effect-break-triggers.mjs；插件提交重新合并实体时保留显式characterPatches，避免新收据被旧角色快照覆盖。

这项证据只覆盖该模块的护甲分支。短休、跳过、武器/其他目标、来源再次长休或死亡等完整网络组合仍须逐项验证；不能把已支持字段或单一路径测试视为所有模块自动认证。
# 按目标属性值排除效果

Activity 的 creature 和 area 目标支持 `minimumAbilityScores`、`maximumAbilityScores`，键为六项属性，值为 0–30 的整数，边界包含在内。例如 `minimumAbilityScores: { int: 3 }` 表示智力 2 或更低的目标不进行该 Activity 的检定，也不承受其效果；施放资源仍按正常规则消耗。上下限同时存在时须满足全部条件。

这些条件使用 Host 当前生物快照，不能由玩家请求中的属性覆盖；缺少必要属性时拒绝结算，不把未知属性当作免疫。触发式 Activity 也在请求骰值前校验，返回可报告的 unsupported 诊断。持续区域后来产生的独立触发不会自动继承母 Activity 的目标条件，应在相应触发 Activity 中声明并验收。

### Dynamic effect dice: Maps Activity entry points

Spell and granted-feature Activity handlers collect mandatory `roll-dice` effect results before presenting each d20. The submitted `effectRollDice` is bound to the shared action ID and the exact Activity check/target slot. Host rebuilds requirements from current effects and rejects missing, extra or stale dice. UI previews and attack-dependent damage planning must use that same context. Do not store a pre-rolled persistent modifier in a module.

Current coverage includes Activity spell/feature facades and forwarding through rest settlement. It does not certify all generic weapon, monster, concentration, trigger, reaction, or repeated child-execution interfaces. These paths and actual room behavior require separate acceptance before classifying an imported entry as fully automated.

### 持续完成后的短休收益（Effect）

`completionReward: { kind: "short-rest", requiresCondition: "unconscious" }` 表示指定状态完整持续后获得短休收益，并记录同来源效果在长休前不能再次受益的回执。配套一个相同的 `conditions` 状态和 `duration.kind: "rounds"`；不支持该字段与专注、extensionCondition 或 castLevelProfiles 混用。持续轮数必须来自原文，例如十分钟为100轮。

Effect 的 `modifiers: [{ kind: "prevent-rest-benefits" }]` 阻止有效期间的短休、长休及效果授予的短休收益，包括恢复和受益回执；强制忽略长休冷却不会绕过此限制。它不会暂停世界时间，也不会阻止独立的黎明充能。效果的结束时机仍需配置对应生命周期；此修正本身不代表睡眠、醒来、噩梦伤害或完整托梦术实现。

受伤或被唤醒结束应分别声明 `breakOn: ["takes-damage", "awakened"]`。Host 自行维护中断历史，模块不提供运行时 interrupted 值，也不再额外声明一次恢复资源操作。状态消失、中断或提前成功豁免不产生完成收益。完成记录在已知战役时间时开启角色的短休特性窗口。

当前证据覆盖公开Activity JSON、Headless施放/自然到期、地图角色投影、提交前回执拦截、实际受击中断及玩家唤醒请求。进入反魔法区域会永久记录本次持续中断，离开区域不会恢复完成资格。外层法术事务取消、生成模块导入和浏览器玩家房间验收仍须验证，不能仅凭声明此字段标记法术已完成自动化认证。


### Movement that does not provoke opportunity attacks

A temporary Effect can declare `modifiers: [{kind: "prevent-movement-opportunity-attacks"}]` with its normal duration and concentration lifecycle. The Host persists the corresponding boolean modifier, excludes suppressed Effects, rejects movement opportunity attacks before reaction spending, and blocks a spell replacing that opportunity attack. This is independent of Disengage and cannot be bypassed by an attacker ignoring Disengage. Independent reaction attacks, such as Berserker Retaliation, remain eligible under their own rules.

Public Activity-to-Host tests cover serialization, invalid boolean rejection, authoritative rejection without reaction/HP changes, suspension, expiry, independent retaliation, and a War Caster replacement spell. Map bridge tests cover player movement detection and pre-prompt rejection. These are interface tests, not certification of an automatically generated source spell or browser acceptance.


### Turn ownership requirements

Use `requirements: [{kind: "turn-owner", owner: "actor"}]` for an Activity usable only during its user's turn, or `owner: "other"` for another creature's turn. This is distinct from `once-per-turn`; declare both when the source requires both. Neither predicate succeeds without a known live combat turn. The registered Activity authority and compiled plugin executor derive the turn owner from Host initiative state; the wire command cannot provide this authority fact. Permanent tests cover missing context, both selectors, malformed selectors, forged command/payload fields and an explicitly off-turn-enabled plugin action.


### Attack-correlated speed and one-use grants

An Effect modifier `{kind: "speed-after-own-turn-weapon-attack", bonusFeet: 30}` grants walking speed after the bearer's weapon attack on its own turn, whether it hits or misses. The Host captures effective participating Effects before attack cleanup and creates a source-linked speed Effect ending at that turn's end. Spell attacks, off-turn attacks and suppressed Effects do not activate it. Combine it with `breakOn: ["makes-weapon-attack"]` for one enhanced attack, weapon attack advantage and delayed on-hit damage as needed.

A once-per-cast option can use a separate authorization Effect, linked to the main spell and granting the enhancement Activity. That Activity requires the authorization, removes it, and applies the enhancement linked to the main spell. The main Effect must not independently grant the consumed option. This preserves the original spell while consuming only its optional enhancement. Runtime tests exercise the registered entitlement path, repeat-use rejection, hit/miss/critical damage, turn expiry and actual failed concentration cleanup. They do not certify a source-generated module or browser flow.

### 随来源移动的条件性困难地形

`create-persistent-area` 可组合 `anchorMode: "source-token"`、`movementCostMultiplier: 2` 和 `movementRequiresGroundedSource: true`。最后一个字段只约束区域的移动耗费：Host 按来源 Token 当前海拔与当地地形表面比较，接触地面才增加移动耗费，起飞停止、落地恢复，来源不存在时不生效。它不会自动关闭同一区域的伤害、遮蔽或其他效果。

敌我范围由 Activity 的区域目标声明控制，例如 `origin: "self"`、`relation: "enemy"`、`includeSelf: false` 与规则要求的半径；垂直覆盖另用现有区域垂直声明限定。字段在执行提案、地图持久化和客户端同步中保留，不能由玩家伪造 grounded 布尔值代替 Host 地形检查。此接口不代表支持冰雪等指定材质的困难地形豁免。


### Timed completion grants (combat boundary support)

`Effect.completionGrant: { activityIds: ['follow-up'], availableRounds: 10 }` grants registered same-package Activities to the effect bearer only after the preparation effect naturally completes its `rounds` duration. This is separate from `grants`, which grants immediately. A live source is required; removal and suppression interrupt preparation. The applying turn does not count as a completed round. The completion receipt preserves package/source provenance and expires after `availableRounds` target turn ends. A compound effect produces one receipt, not one per projected condition/modifier.

The public validator rejects duplicate/invalid Activity IDs, invalid availability durations, concentration, cast-level duration overrides and concurrent short-rest completion rewards. Module compilation includes these delayed Activities and rejects unresolved references. Receipt expiry revokes access; one-use behavior uses `singleUse:true` with a guarded follow-up Activity, as described below. This interface does not itself prove private conversation, and ordinary campaign-time jumps interrupt preparation. Use the Host interaction workflow for confirmed noncombat completion and explicit participant binding for target-scoped completion. Do not certify an entire source rule solely because this timer passes.

Preparation continuity is checked before natural expiry, including missing communication participants. Ordinary positive campaign-time advancement interrupts a pending completionGrant preparation rather than banking partial preparation time. The authenticated Host interaction workflow below provides a separate atomic completion path after explicit continuity confirmation. Existing completion receipts age normally.


A completion grant may set `recipient:'source'` to place its receipt on the original source rather than the preparation bearer. `bindTarget:'bearer'|'source'` records the original participant ID in the Host receipt's `grantedActivityTargetIds`. Actual direct and plugin execution check every supplied target against this scope, including conflicting single/multiple target fields; omission of targets is allowed only for UI availability queries. For example, `{activityIds:['follow-up'],availableRounds:10,recipient:'source',bindTarget:'bearer'}` grants the initiator an action against the original listener. Persisted grants preserve this scope and reject malformed scopes. Consuming the corresponding source-scoped completion effect can make this one-use. These bindings do not prove privacy or uninterrupted noncombat interaction.

### Noncombat interaction record groundwork

Campaign time now accepts Host/DM-only `start-interaction` and `interrupt-interaction` mutations through its existing atomic mutation endpoint. A start identifies the original source, bearer, package, effect instance and required rounds; the server stamps the monotonic start minute and authenticated member. The record ID is idempotent, conflicting identity reuse is rejected, and interrupted IDs cannot restart. An expected clock minute rejects stale starts/interruptions. Records currently cap at 128 and are not silently evicted, preserving retry guards.

These records do not grant activities or attest that a conversation completed. Ordinary advancement/rest/time-setting interrupts pending records; they cannot turn an unverified interval into progress. The runtime still requires future Host effect/participant validation and a dedicated verified progression path before issuing completion receipts. This groundwork is not full noncombat automation or a completed import acceptance.

Interaction starts now require a matching server-read participant/effect snapshot: exact original source and package, exact bearer effect instance, unsuspended completion timer, and matching remaining rounds. Missing or ambiguous participants/effects reject the start. The endpoint reads shared characters/maps itself; submitted snapshots are ignored. This is a reference check, not proof of continuous speech or privacy.

`useCampaignTimeStore.startInteraction` runs `prepareDnd5eCampaignInteractionStart` against Host combatant snapshots before submitting. It derives identity/duration from the actual effect and checks noncombat state, living participants and canonical communication/distance links without mutating its input. Rechecking a persisted interrupted record returns `interaction-not-active`. The atomic record mutations now explicitly report changed/no-change, and filesystem tests verify persistence plus revision-preserving retries. The Host campaign clock now exposes start/interrupt/complete controls through campaignInteractionController; browser acceptance is still pending.

### Noncombat completion planning

`planDnd5eCampaignInteractionCompletion` produces an unpublished clock/application bundle after Host continuity confirmation and current participant/effect checks. It advances the required duration, marks the record complete and settles its scoped receipt, including minute-precision overshoot. Character and creature durations plus entity patches are reconciled together. The caller must publish all resources atomically against their original revisions; the helper does not send requests or update stores. publishDnd5eCampaignInteractionCompletion commits characters, maps and clock atomically, with original write revisions and read-only combat/map-geometry revision guards. The Host controller reads the revisions from each returned snapshot and passes explicit geometry through projection and result mapping. Transaction integration and an installed synthetic package have been verified in isolated DM/player browsers: preparation, Host completion, wrong-target rejection, bound-target settlement and single-use receipt consumption. This verifies the mechanism, not original-source conversion. Explicit continuity confirmation covers facts outside snapshots; it must not be supplied as an untrusted player claim.

Completed interaction records survive bounded clock-history trimming and cannot restart. For precise per-grant consumption, use completionGrant.singleUse:true and requiresEffectGrant:true on each granted Activity, as described below. Broad remove-effect recipes may remove other simultaneous same-definition receipts.


`completionGrant.singleUse:true` stamps the completed receipt with `grantedActivitiesSingleUse:true`. Direct Activity, compiled plugin and sandbox Worker settlement remove only the preexisting authorizing receipt after success; failed/rolled-back actions retain it. Target-scoped receipts for other participants remain. Direct execution selects an eligible preexisting grant from Host state; plugin execution honors its explicit Host entitlement ID. Put `requiresEffectGrant:true` on every such follow-up Activity so ordinary parent spell/feature ownership cannot authorize it after the receipt is consumed. Content package registration rejects single-use completion references whose Activity omits this guard. Do not additionally remove all same-definition effects in the outcome to simulate consumption.

The DM campaign clock’s 持续交互 section lists completionGrant preparations on the selected map. Start the interaction, then confirm continuous requirements (including any narrative privacy requirement) before choosing 完成并推进时间. 打断 ends the record without issuing a receipt. Ordinary time advancement interrupts unverified preparations. Missing or stale snapshots fail closed; refresh the list and re-evaluate instead of reusing newer revisions with an old result.

### Spell follow-up authorization

For an action available only while a spell effect lasts, the casting Activity must actually apply the Effect containing `grants`. Merely declaring an Effect or giving two Activities the same `legacySource` does not establish this lifecycle. Set `requiresEffectGrant:true` on the effect-only follow-up, not the initial casting Activity; otherwise ordinary ownership of the spell can independently authorize execution. Area grants, summon bonds and continuations have different authorization routes and should not receive this flag indiscriminately.

`src/rulesets/dnd5e/activities/dnd5eGrantedSpellAuthoringExample.ts` is a synthetic, executable two-Activity example included in conversion guidance. Its test verifies rejection before casting despite spell ownership, actual effect application, action/bonus-action consumption, persistence round-trip and rejection after natural expiry. This is Headless mechanism evidence, not original-source conversion or browser acceptance. Replace illustrative values with source values and retain the normal outer spell-slot transaction.

已有物品变形的后续接线进度：`pluginSpellTransaction` 与 `pluginFeatureAction` 已在地图计划生成前调用同一 Host 库存结算器，支持在本次材料消耗后的库存上校验和应用，并以原库存为提交基线。编译器交接字段及机制注册表均已接通，合成法术的完整编译路径已通过本地测试。可用接口不等于每个原始法术已正确转换，仍需逐项规则覆盖与导出导入验收。

### Activity condition-immunity target exclusion

Creature/area targets may declare `excludedConditionImmunities: ['charmed']`. Any matching Host-derived condition immunity excludes that target from this Activity's dice requests and target effects, including effects without an initial saving throw. Consumption remains independent of the filtered target set. Missing immunity facts reject instead of guessing. Import validation rejects empty, unknown or duplicate conditions.

Host combat snapshots, compiled Activity execution, per-target dice and triggered Activity dice use the shared defense helper, including temporary, suspended and source-relative immunity. This field does not automatically propagate into separately authored persistent-area triggers. It does not mean an ordinary damage immunity excludes a target. Synthetic behavior evidence is separate from certification of original imported spells.

### Native feature/feat Activity entry projection

A native unified feature or feat can omit the legacy `payload.action` when its payload and envelope both declare full automation and it owns exactly one active root Activity. The installer derives the map action shell from that Activity and registers its compiled Headless recipe. This is a runtime projection: exported source data stays unchanged.

Inference requires the Activity's declared and analyzed automation to be full and its recipe to be compilable. It never selects among multiple roots, promotes assisted/manual content, treats an event-triggered Activity as an ordinary button, or exposes an effect-granted/continuation-only Activity as a root. Explicit actions keep their existing matching-source validation. Multiple-root UI and event-triggered workflows require their own entry handling.

### Damage source and casting-class filters

`damage-dealt` is the committed positive-damage window for the source actor; `after-damage` remains the victim window. Source-side suppression prevents recursive outgoing triggers. Explicit Activity damage provenance takes precedence over correlation with earlier attacks.

Use `requirements: [{ kind: 'spell-used', castingClassIds: ['wizard'] }]` to require a known casting class. The optional list must be nonempty, unique and contain valid IDs. It combines with spell ID, school and level filters. Missing casting-class evidence fails the filter; the Host never infers it from the character's main class or a spell's allowed class list.

Prepared compiled-Activity spell damage currently supplies validated casting class to these contexts. This is not a guarantee for all core, periodic, granted follow-up or spell-cast event producers. Declare resource costs and per-turn limits separately. Synthetic and native spell regression evidence does not certify original imported book configurations.

### Temporary HP recipient event (offline batch)

`temporary-hit-points-gained` exposes the actual recipient as both eligible actor and target. Activity grants retain event provenance independently of temporary-HP lifetime binding. A combat event-source predicate can match its source rules ID. Equal/lower offers do not produce this event; this is not certification of all temporary-HP replacement rules. Immediate optional reaction movement, destination selection and one-use grant cleanup still require separate integration coverage.

### Direct single-use Activity grants

A canonical effect may declare `grants: ["follow-up"]` and `grantsSingleUse: true`. The flag requires a nonempty grant list; false and orphan flags are rejected. Successful use removes the effect carrying the grant. Any other modifiers on that effect also end, so use a separate marker effect when the one-use choice should not remove an ongoing benefit. Declining is not consumption; configure duration separately. Reaction activation also needs an explicit availability predicate and reaction consumption.

The flag is carried through resolution proposals, compiler reconstruction and condition/mechanical/extension/marker effect creation. Offline recipient movement tests now create the grant from serialized canonical configuration, not a hand-created engine effect. Content-package parse preservation is tested; this does not certify full original-book archive or browser workflows.

Synthetic `.starmod` archive acceptance now covers marker, condition, modifier and extension grant carriers. Each is exported/read/installed, used through registered Host commands, disposed, re-exported and independently installed again. JSON-persisted combat state retains the one-use behavior. This covers archive transport and Host execution, not source-PDF conversion or live client UI acceptance.

`summon.uncontrolledLinger`声明失控后提前失去专注的滞留计时：`{count:3,sides:6,unit:"minute"}`。单位为 `round` 或 `minute`（一分钟十轮）；Host 保存各骰结果、总和及截止轮次，重复清理不重掷。默认允许滞留超过原召唤到期时间；仅规则要求截断时声明 `capAtOriginalExpiry:true`。旧 `controlSave.lingerDieSides` 保持一骰回合与原期限截断语义。

此字段仅控制已经失控的召唤物如何计时，不创建控制检定，也不自动将命令失败解释为失控。提前失去专注时记录绝对战役分钟期限，服务器推进战役时间时一并清理；计时字段本身不能证明某个原文法术完整自动化。

`end-owned-companion-control` 是独立操作，指定 `target:"target"` 和必填的 `sourceActivityId`。可以放在 `opposed-ability-check` 的失败 outcome 中：Host 校验存活、施术者所有权、召唤来源及命令策略，然后清除当前命令、交还 DM 控制，并持久化 `controlEnded`。该操作不移除召唤物或专注，后续命令会被拒绝。`requiresSpeech:true` 校验施术者当前回合和发声条件；仅原文规定立即敌对时设置 `becomesHostile:true`，否则保留原阵营。重建地图不会恢复命令权。

对抗检定的 `sourceModifier` 可用 `{kind:"reference",reference:{kind:"actor-skill-check-modifier",skill:"deception"}}`，读取 Host 的完整技能加值（包括熟练/专精），不要写死为属性调整值；`target-skill-check-modifier` 对应目标。只接受标准技能键，缺 Host 快照会拒绝结算。该引用只提供数值，不代替技能专属优势、重掷或其他事件规则。现有合成模块测试覆盖双方检定、失败转移、保存重载及后续命令拒绝，不代表原 PDF 自动转换或任意自然语言命令已验收。

施法者自己的 `ability-check`、`skill-check`、`concentration-check` 可声明 `appliesWhenChoice:{choiceId,optionIds:[合法选项ID]}`。选中分支才请求及结算骰子，其他选项不要求该骰。共享检定使用 `scope:"shared"`，归施法者并读取其真实加值和骰子模式；`scope:"per-target"` 按既有逐目标协议处理。成功效果同时用 `when.kind:"all"` 组合选择条件和检定结果，资格确认不替代检定。该字段不会自动创建原始阵营记录或恢复状态，须另外实现对应效果。

阵营恢复使用 `{"id":"restore","kind":"restore-original-alignment","target":"target"}`。操作不得携带替换阵营，Host只读取目标的当前阵营及明确记录的原始阵营。角色页DM可以记录或清除`dnd5eOriginalAlignment`，没有记录的旧角色不会被自动填充；玩家共享写入既不能覆盖已有记录，也不能通过新上传角色伪造记录。两项阵营须是系统九阵营且不同，成功结算后写回角色并发出`original-alignment-restored`事件。历史缺失/无效或已经恢复时拒绝提交成本和效果；检定失败则正常完成施放但不恢复。当前字段使用角色系统的九个中文阵营值，完整法术双端验收仍待处理。

独立怪物的DM管理页可明确记录Token的`dnd5eAlignment`与`dnd5eOriginalAlignment`；快照使用同一恢复操作，结果写回当前阵营，地图规范化与重载保留原始记录。此记录独立于怪物模板，不从模板当前阵营猜测历史。玩家投影不公开原始阵营记录，关闭怪物详情时也隐藏当前阵营。资格确认、检定、耗时材料和完整来源法术行为仍须独立验收。

对抗检定声明 `sourceRollMode:"host-derived"` 时，Host 现在会从直接的 `actor-skill-check-modifier` 引用识别技能并应用已有技能优势/劣势效果。复杂数值公式可另外声明 `sourceSkill`；它不增加熟练加值，不得与直接技能引用冲突。防守方多个 `targetOptions` 的掷骰模式按实际最高加值选项计算，与结算保持一致。编译入口、公共 Host 命令、逐目标骰子声明和触发掷骰均使用相同 Host 模式；公共命令的额外模式参数不能覆盖 Host 判断。此补充没有实现任意技能专属重掷或叙事条件识别。

对抗检定中的明确 `advantage` / `disadvantage` 是额外规则来源，也必须与 Host 已有状态一起计算；`normal` 不会禁用疲乏或技能效果。计算先合并来源，再统一按“任一优势与任一劣势抵消”处理，不能先抵消一部分，再用额外优势重新获得优势。体型条件只应用一次。Host 内部传递最终模式以保持显示、触发骰与结算一致；这些内部模式键不是内容作者或玩家授予优势的接口。

### 区域条件的来源 DC

区域声明中的 `triggers[].savingThrow.dc`、`triggers[].condition.duration.saveDc` 和 `triggers[].condition.escapeCheck.dc` 接受数值或 `"source-save-dc"`。Host 创建区域时一次性解析为有效整数 DC（1–40）；引用缺少有效来源值时拒绝创建，不使用默认 DC。保存后的区域只保留数值，后续来源属性变化不改变既有区域的重复豁免和挣脱难度。此能力本身不包含第三方协助挣脱、侦测陷阱或悬吊位置规则。

束缚区域可声明 `triggers[].condition.endsWithArea: true`（目前只支持 `restrained`）。Host 成功应用束缚后绑定地图、区域和来源；区域被删除或到期后，现有区域生命周期协调器解除对应束缚，重载时也能清理残留。离开区域本身不会解除该状态。省略此字段保持原有持续时间规则；其他状态或非布尔值会被拒绝。

固定方向区域可使用 `triggers[].forcedMovement: { mode: "push-fixed-direction", direction: { dc: 0, dr: 1 }, distanceFeet: 15, appliesOn: "failed-save" }`。方向必须是有限单位向量，距离为1—1000尺整数；失败／成功豁免触发必须同时声明豁免。方向随区域快照保存，不跟随施法者之后的位置；实际推离沿用Host网格移动与碰撞检查。这个声明只负责推离，不会自动创建风场、增加逆风移动消耗或处理光源。

Use `requirements: [{kind: "combat-active"}]` when the source requires active combat independently of whose turn is currently selected. Missing Host combat state fails this predicate. `turn-end` maps the committed `turn-ended` event to its original actor, even after initiative advances; a current `turn-owner:actor` requirement is not a substitute for combat scope on that event. Registered authority and compiler derive `combatActive` from Host state, never from the submitted command or payload.

### Other-creature turn-end windows

`other-turn-end` is distinct from the owner's `turn-end`. The Host emits an independent window for each other combatant, then filters registered activities by entitlement. The eligible target is the creature whose turn ended, not the next initiative holder. Each observer has its own event receipt, so one holder's execution cannot suppress another holder and restored-state replay cannot charge the same reaction again.

To constrain a reaction to an enemy within 5 feet, use a creature target with `relation: 'enemy'`, `count: 1`, and `rangeFeet: 5`; operations may still affect `actor`. Declare reaction consumption explicitly. Target validity is checked by authority; discovery is not proof of range eligibility. This event alone does not implement movement selection or certify any full source feature.

Activity `move` now supports `mode: 'voluntary'` for self-directed movement granted outside ordinary turn movement (for example a reaction). It uses Host pathfinding and terrain cost against `distanceFeet`; the formula may multiply `actor-speed` by 0.5. It emits voluntary movement provenance, preserving downstream event semantics. It does not automatically consume a reaction or the ordinary movement pool: declare action-economy consumption separately. Opportunity attacks default on for this mode; explicitly set `ignoresOpportunityAttacks: true` for rules that waive them. Do not encode optional self-movement as `forced` merely to reuse destination selection.

`create-persistent-area.groundOnly: true` persists the residual area with `vertical: { mode: 'ground' }`. This leaves the initial Activity target volume unchanged: an initial volume can damage airborne occupants while the remaining terrain affects only creatures touching the Host terrain surface. Omit the property to retain the existing volume behavior. It does not implement terrain clearing, elapsed clearing time, or nonmagical-remnant dispel policy; those need separate declarations and verification.

For hand-cleared residual ground, add `terrainClearing: { squareFeetPerMinute: 25 }` to the same operation. It requires `groundOnly: true`, `permanent: true`, `concentration: false` and a fixed anchor. The imported declaration survives map saving and room synchronization. During exploration, DM and players can open the area and click an eligible map cell to clear it. Host recomputes reach, ground contact, obstruction, availability and elapsed time from authoritative state. Map removal and the corresponding campaign clock advance commit together with map/clock revision checks and read guards for characters, combat and geometry. A 5-by-5-foot cell takes one minute at this rate; a 10-by-10-foot cell takes four. Other overlapping areas remain intact. No spell slot is spent to clear terrain.

During combat, the current creature can spend one action to work on one reachable cell. Work is persisted as `terrainClearingProgress`; the same cell can gain at most one work-round per combat round, including when another worker or an extra action is available. Required work-rounds equal `ceil(cell square feet * 10 / squareFeetPerMinute)`. This implements clearing time as accumulated work, with interruptions retaining progress. Only completion removes the cell. Host commits map progress and action consumption together, guards the combat identity/round and shared revisions, and does not advance the campaign clock again. Exploration clearing credits saved work and rounds the remaining time up to a whole minute. The declaration does not itself establish immunity to dispelling or antimagic. Do not certify a full spell solely from this capability.

Creature targeting supports `requiresTargetSeeActor: true`: the selected creature must perceive the actor using the Host's directional perception state. `requiresLineOfSight: true` checks the opposite direction. Use both only when the source requires mutual visibility. This field survives ordinary, choice-overridden and cast-level-profile targets and is checked before commit in both registered and compiled Activity authority. This does not imply the UI filters every ineligible choice before selection.

A controller's explicit decline closes that concrete Activity event: the Host saves an event receipt without consuming the reaction, removing the granted effect or undoing the original benefit. Replaying the same saved event does not offer it again. This does not expire a grant against future, distinct events; content requiring an immediately-only authorization still needs its grant lifecycle bound to the originating event.

Triggered Activities requiring an effect grant may opt into `invocation.releaseSingleUseGrantOnDecline: true`. With an explicit controller/DM decision, declining removes the matching `grantsSingleUse` effect through normal effect cleanup while preserving the benefit and reaction. Ordinary grants are not removed. Automatic confirmation and missing `requiresEffectGrant` are invalid configurations. Omission preserves existing decline behavior. This is not an origin-execution binding and does not expire unoffered or failed-map windows against later events.

For a reaction granted by the execution that produced a temporary-HP event, set `invocation.effectGrantScope: 'trigger-execution'` together with `requiresEffectGrant: true`. Discovery and registered Host authority require an exact match between the granting effect's Host-stamped execution ID and the event's origin execution ID. A newer cast cannot authorize an older event; a grant lacking provenance cannot authorize a bound reaction. Successful single-use consumption and optional decline release select that exact grant even if another execution also granted the same Activity. Raw compiled plugin actions cannot substitute a grant ID for the Host event context. This binds authorization; it does not itself close an unoffered window or expire a retryable failed map transaction. Omit it for ordinary ongoing granted actions. Modules must never author execution IDs themselves.

For an immediate temporary-HP reaction that must end with the offer, opt into `invocation.expireGrantAtWindowEnd: true`, with `retention: 'single-event'` and the execution binding above. After a full event batch is processed, Host expires the matching recipient's remaining single-use grant, including unavailable reactions, cancelled selection, and unsuccessful map placement. It preserves the temporary HP and does not charge the reaction; the expired choice cannot be retried in a later round. A batch stopped by the resolution limit is not closed early. Use a dedicated `grantsSingleUse` effect: nonsingle-use grants and effects sharing ordinary ongoing Activities are preserved. This currently supports `temporary-hit-points-gained` only, requires actual event provenance, and does not replace normal duration cleanup for a grant whose execution produced no temporary-HP event. Removal events pass through the regular nested trigger settlement.

`movement-distance` defaults to the current committed event's distance. Set `basis: 'straight-streak'` to check Host-recorded contiguous, voluntary or mounted, straight movement in three dimensions during the same combat turn. Two collinear five-foot commits can satisfy a ten-foot threshold. Corners, reversals, disconnected starts, unknown paths, forced movement, teleportation and turn changes do not inherit the earlier distance. The Host stores this ledger for both player characters and independent tokens, and exposes its value as movement event `straightDistanceFeet`; content cannot supply it. Height-changing movement requires explicit Host endpoint heights and a straight sampled path in three dimensions. The player path validator rejects intermediate hills and backtracking, even if the 2D projection is collinear. Map Activity movement lacking authoritative straight-path evidence does not qualify. Native movement with a valid riding relation emits a separate mounted movement event for the rider, with sourceActorId identifying the mount, without spending rider movement. Other coupled movement is forced. A movement-property voluntary predicate excludes mounted movement; content must choose the appropriate provenance. This does not establish ability timing across separate rider/mount turns or permit teleportation as qualifying movement.
# 指定伤害类型的抗性抑制

持续 Effect 的 `modifiers` 支持 `{kind:"suppress-damage-resistance",damageType:"fire"}`。Host 在该效果有效期间忽略目标对指定类型的基础、条件、职业及活动效果抗性，保留原有来源；效果结束或被暂停后恢复。免疫、易伤及其他类型抗性不变。多个类型需分别声明，不能用赋予易伤代替抗性抑制。这一字段只处理抗性，额外伤害和每回合限制需使用独立触发规则。

`conditional-damage-resistance` 可使用 `attackOnly: true` 限定攻击伤害。例如 `{ "kind": "conditional-damage-resistance", "damageTypes": ["bludgeoning", "piercing", "slashing"], "sourceMagical": false, "attackOnly": true }` 对原生武器攻击和 Activity 成功攻击分支产生的非魔法伤害生效，不减免普通非攻击伤害。`attackOnly` 省略或为 `false` 时不增加攻击限制；如同时指定 `deliveries`，两种限制必须同时满足。攻击身份由 Host 的真实攻击分支与目标绑定记录确定，伤害类型或来源名称不能代替攻击身份。字段随模块导出、重导入和活动效果状态序列化保留，非布尔值会被拒绝。


## 授予效果的伤害来源

`requiresEffectGrant:true` 的 Activity 可在 `damage` 操作声明 `damageSource:"grant-source"`。Host 从同包当前有效、目标资格匹配且实际授予该 Activity 的效果读取来源角色、规则 ID 和环级。不同效果片段具有相同来源信息时允许合并识别；来源不唯一或来源角色不在权威战斗状态中时拒绝结算，不猜测角色、不消耗使用次数。省略字段保持伤害归属执行者的原行为。

此字段只改变伤害来源及其结算上下文；公式中的 `actor`、使用次数和资源仍属于执行者。它不自动继承来源角色的公式属性、施法职业或升级骰池。受伤后追加伤害仍需单独声明伤害类型条件和每回合次数限制。

## 特定生物的豁免修正

统一 Activity 的 `saving-throw` 检定支持 `rollModeByStatBlock: { statBlockIds: ["srd-5.1:water-elemental"], mode: "disadvantage" }`。该字段精确比较 Host 生物的 `statBlockId`，不比较 Token 显示名称，不把同类型的其他生物一并纳入。可与 `rollModeByCreatureType`、体型修正及其他优势／劣势组合；同时有优势和劣势时抵消。

ID 必须来自已安装的生物目录。改名不影响匹配；缺少 ID、其他命名空间下的同名生物不会自动命中。资料导入工具应保留未能解析的目录依赖，不能自行猜 ID 或扩大生物类型。该字段属于统一 Activity，旧式 declarative savingThrows 不接受此字段。
## 一次性 d20 优势的期限

声明式特性机制 `next-d20-advantage` 支持可选的 `expiresAt: "next-turn-start"`。未使用的优势会在持有者下回合开始时清除，早于该回合开始的豁免；其他角色回合和同回合重复进入不会清除。Host 将授予时的回合身份随状态保存，刷新后仍按原期限处理。省略该字段保留原有等待首次符合掷骰的行为。

这是声明式特性机制的期限配置，不能当作任意统一 Activity 效果的字段。持续优势与一次性优势仍须分开配置。原生攻击、豁免和检定在各自结算边界立即消耗该标记，后续步骤不再沿用，事务失败时整体回滚。自动检定结果、因免疫自动成功和自愿不抵抗的豁免不会消耗。已验证原生守护豁免后攻击的顺序。统一 Activity 的 Host 派生豁免、属性/技能检定、专注检定及对抗检定在直接与编译入口按已完成的实际检定重新计算一次性优势，准备阶段不修改 Host 状态，对抗检定分别消耗双方符合条件的标记。连续豁免、普通检定、专注检定和对抗检定已有合成测试；统一 Activity 的连续攻击、跨续接历史、外部插件事件及掷骰界面对前序结果的预测仍需独立验证，不能据此宣称完整多阶段自动化已通过。

`concentration-check` 使用执行者的豁免加值，Host 模式包含专注优势和待生效的专注劣势，不再沿用普通属性检定加值。共享或逐目标作用域均可编译；逐目标作用域表示执行者为每个目标分别检定，并不把掷骰者改成目标。专注检定归入一次性效果的 `saving-throw` 类别，提交 `concentration-resolved` 事件；Activity 事件附带 `activityId/checkId`，日志可区分同一活动的多次专注检定。失败后的规则效果仍由 Activity 结果分支声明。
## Hit point maximum increases

`hit-point-maximum` modifiers are nonnegative increases, bounded at 1,000,000.
Negative values cannot encode reductions. Static negative constants fail schema
validation; invalid evaluated values fail execution rather than silently becoming
zero. Effect-owned HP reductions require the separate reduction ledger; do not
declare them automated by placing a negative value in this bonus modifier.

## Effect-owned maximum reductions

`reduce-hit-point-maximum` is a separate operation with `target`, formula
`amount`, `owningEffectId` and optional positive integer `minimumMaximum`
(default 1). Apply the owning effect to that target first. Its ID references an
effect declared in the same Activity; use a dedicated marker that creates one
instance, not a combined effect that expands into several instances. The Host
requires exactly one matching source/namespace instance and records its actual
ID in the reduction ledger. A second execution of the same operation against
that instance is rejected, with costs rolled back.

The effective reduction is limited by the specified minimum. Removing the owner
restores only its entries, including finite-round expiry through campaign time.
Restoration never heals current HP. Ordinary recovery magic or long rest cannot
directly clear these entries: any intended ending must be declared through the
owner's lifecycle. Export/reimport, player spell settlement and save/reload are
covered by synthetic tests. Equal transfers to another creature and selected
Hit Dice rolls are separate mechanisms and are not supplied by this operation.

## Activity Hit Dice consumption

For a real pool selector, declare a choice with `optionsFrom: "actor-hit-dice"`
and `options: []`. Available IDs are `hit-die:d6`, `hit-die:d8`, `hit-die:d10`,
and `hit-die:d12`; the shared choice resolver rebuilds the menu from the actor's
actual remaining pools. Missing, exhausted or ambiguous pools are unavailable.
The Host reconstructs this menu independently, so stale or injected options do
not authorize a cost. Declare a matching outcome and `whenChoice` consumption
branch for each supported die size, including the appropriate dice formula and
any per-die ability modifier. The selector does not infer trigger timing, roll
the dice itself, or implement an arbitrary mixed-pool quantity editor.

To allocate quantities across several pools, declare one choice per pool with
`optionsFrom: "actor-hit-die-count"`, `hitDieSides: 6` (or 8/10/12),
`hitDieMaximumCount` (default 20, maximum 511), `options: []`, and optionally
`defaultOptionId: "0"`. The shared resolver generates integer-string IDs from
`"0"` through the smaller of the declared ceiling and remaining pool count.
A known absent/empty pool offers only zero; missing or malformed actor data
offers no choice. The trigger prompt skips a sole zero option and safely declines
an empty menu. Spell and feature prompts use the same generated choices.

Each positive count through the declared ceiling must bind exactly one guarded
`hit-die` cost for that pool with a constant amount equal to the option ID; zero
must bind no cost. Import validation rejects incomplete or mismatched cost
branches. Declare the corresponding outcome/dice formula per positive count;
selection alone does not generate its benefit. Use `maximumTotalFraction` on
costs when the rule imposes a shared budget: the Host aggregates selected costs
across pools and rejects the whole transaction if over budget. This supports
composed quantity menus within the declared ceilings, not unbounded numeric input.

The authoring-only `hit-dice-benefit` pattern generates these repeated branches.
Declare `pools: [{ sides: 6, maximumCount: 20 }, ...]` (unique canonical sizes,
each ceiling 1..100), optional `abilityPerDie`, `maximumTotalFraction`, and a
`result` of `healing` or `transfer-hit-point-maximum` without `id` or `amount`.
It produces the selected fixed dice formula plus count times the declared ability
modifier. Optional `minimumPerPoolAmount` floors each pool's combined benefit;
it is neither a per-die floor nor a floor on the total across pools. Each pool
settles as a separate benefit operation, including separate healing events.

Optional `setup` operations run once before the first nonzero pool, and never
when all pools select zero. A transfer must explicitly define and apply both
owning effects and state their correct lifecycle. Source invocation/eligibility
is still required; the pattern does not infer Dodge or rest authorization.
Import expands it into ordinary Activities; exported archives require no pattern
compiler. Use the lower-level interface for rules with different aggregation.

Dispel Magic candidate discovery uses the source spell's duration, not the
remaining duration of an effect that records its result. Imported spells marked
`duration.type: "instantaneous"` are not ongoing dispellable spells, including
when legacy state contains a stale concentration reference. Native SRD spells
use their reviewed duration metadata. This does not block other specifically
authorized restoration or lifecycle operations. Keep the source spell duration
faithful; do not change it to `timed` merely because a resulting state persists.

Maximum transfers may opt into `protectLinkedLifetime: true` together with
`linkLifetimes: true`. Both declared owners must be independent permanent marker
effects, without conditions, authored modifiers, concentration or source-link
removal. The Host records protected reciprocal links on both instances. Ordinary
ID/tag removal and stacking replacement cannot remove those anchors; repeated
funding must retain the same protection policy. Declared source lifecycle events
and confirmed peer death still remove both anchors and restore the exact ledger.
Protection survives saved state and module-based settlement. It restricts rules
operations, not deliberate out-of-band DM state correction, and does not invent
the source's allowed end conditions or provide arbitrary protected status effects.

For a closed quantity selection, add ordinary `choices` and guard each Hit Die
cost with `whenChoice: { choiceId, optionIds }`. The guard must reference declared
options. Only selected costs reach the aggregate budget check and spending
step. Use matching choice conditions on outcomes, distinct roll IDs per branch,
and the matching fixed dice count. Per-die Constitution can be expressed as
`dice sum + selected count * actor-ability-modifier(con)` using normal formulas.

The shared formula recipe removes branches contradicted by submitted choices;
unresolved choices retain their possible dice until resolved. The existing
player choice UI, active Host action recipe and triggered roll collection use
the same choices. A cost-bound choice cannot be hidden as irrelevant. Tests
cover one/two dice, rejection of forged options and mismatched dice counts,
the half-total budget, save/reload and portable player spell settlement.
This is a closed menu, not an automatic arbitrary multiclass quantity editor.
Evidence for mixed-pool funding and rest receipts is described below.

Mixed-pool funding can use distinct transfer operations against the same effect
pair. Only reciprocal links with identical actor, character and effect IDs can
be reused; a different peer or a partial link is rejected. Aggregate Hit Die
costs still share one budget. Local tests spend one d6 plus one d10 and transfer
10 then 19 after a floor-limited request, retaining two exact debit entries.
Removing the owner restores both entries once.

Closed quantity choices also work through `settleDnd5eRestActivityV1`. Only after
the Host verifies the completed rest, owner, current time, entitlement and
unused receipt may that entry commit to an inactive combat snapshot. It does
not start combat or alter combat predicates. Failed resolution returns no receipt
patch; success or decline consumes the existing one-use rest record. The caller
must atomically persist that record with the resource/effect changes. The portable
rest-transfer fixture exercises the production player feature/Host route together:
mixed pools, per-die CON, exact transfer, atomic application, save/reload and replay
rejection. Own-source rest expiry restores the maximum before long-rest healing;
recipient death restores it without healing. This synthetic protocol evidence
does not certify the original book feature, same-plane eligibility, missing
creature statistics or its browser interaction.

See the independent transfer operation below for moving maximum HP; spending
Hit Dice alone does not implement its choices or rolls.

Activity `consumption.kind: "hit-die"` uses `resourceId: "hit-die:d6"`
(or d8/d10/d12). It spends the character's real `hitPointDice` pool, including
through compiled plugin activities, and map application persists the remainder.
A same-named class resource cannot substitute for a Hit Die. Multiple costs for
one pool are checked together. `maximumTotalFraction: 0.5` on a Hit Die cost caps
all applicable Hit Die costs in that execution at half the sum of pool maxima,
rounded down, including costs split across different die sizes. Each pool must
also have enough remaining dice.

Formula references `actor-hit-dice` / `target-hit-dice` read `field: "current"`
or `"maximum"`, optionally filtered by `sides: 6|8|10|12`. A known missing die
size yields zero; an unavailable or corrupt ledger rejects evaluation. These
references use Host snapshots. Rolling selected dice, Constitution modifiers,
choice UI and HP transfer still require separate mechanisms; this does not
implement a whole rest feature.

## Atomic maximum HP transfers

The reduction/transfer `amount` and `hit-point-maximum` modifier `value` may
contain ordinary dice formulas. Their dice are included in the shared Host/UI
roll recipe. Missing, excess or out-of-range dice reject settlement. Critical
hits double only roll IDs declared by `damage` operations with
`critical: "double-dice"`; independent maximum-HP dice retain their original
counts. This supports fixed declared pools, not a selected Hit Dice interface.

`transfer-hit-point-maximum` debits the actor and credits a distinct `target`.
It accepts formula `amount`, `owningEffectId` on the actor,
`beneficiaryEffectId` on the recipient, optional `minimumMaximum` (default 1),
and optional `increaseCurrentHp` (default false). Apply both dedicated owning
effects before this operation. Each side must resolve to one instance from the
same Activity/source/module. The recipient's effect receives the actual Host
debit as `hitPointMaximumBonus`; a floor-limited debit never grants the larger
requested amount. With `increaseCurrentHp: true`, current HP increases by that
same actual amount. Invalid recipients or reduction immunity roll back costs
and effects along with the transfer. Repeating an already funded debit fails.

The effects retain their separately declared lifecycles. Set `linkLifetimes:
true` only when the source rule makes either effect ending or either bearer
dying end both effects. Host-created links retain exact effect IDs and stable
character identity through saves and token changes. Known absent effects and
confirmed deaths trigger cleanup; missing or ambiguous peers do not. Combat
settlement and authoritative character-roster reconciliation iterate until
linked expiry settles, independent of roster order. The DM map workspace's
room-wide lifecycle lane reads all saved maps and the character roster, including
non-character companions on unopened maps and characters absent from every map.
Map order does not affect settlement; duplicate token IDs across maps remain
ambiguous. It persists only changed actors and maps. This path has local
save/reload tests; browser synchronization and a disconnected Host are not
certified by those tests.
Same-plane eligibility, rest timing and selected Hit Dice rolls remain
independently required by the source rule. Finite expiry restores the donor's maximum without healing it and
removes the recipient's maximum bonus, clamping current HP to the remaining
maximum. Synthetic tests cover direct/compiled execution and independent
archive installs through player spell settlement, not complete book conversion.

## Summon source death


The summon operation accepts `sourceDeathBehavior: "die"`. A confirmed death of
the source combatant triggers an instant-death effect on the bound summon in the
same successful Headless transaction. Unconsciousness does not trigger it, and
loss of command authority does not remove this lifetime binding. Death Ward can
prevent the effect. The handled marker is persisted so loading a saved map does
not apply the same death effect again; a killed summon remains as a corpse.

Source characters are resolved by stable character ID when their token changes.
The Host map reconciliation also reads confirmed death from its character roster
when the owner is absent from that map. Unknown sources do not imply death or
dismiss a persistent death-bound companion. While the DM map workspace is
mounted, its authority lane reconciles these character bindings across all room
maps, including unopened maps. A surviving companion is rearmed after the Host
observes its source alive again; missing or unconscious source data cannot rearm
it. Dead companions retain their corpse receipt. Map save/reload preserves both
the handled and rearmed states. This is state reconciliation, not an event
history: death/resurrection transitions entirely missed while the Host was
offline are not reconstructed. Cross-map monster-only sources and dual-client
acceptance remain unverified. This does not certify an entire companion spell.

### 召唤来源的模块隔离

`command-owned-companion.sourceActivityId` 和 `end-owned-companion-control.sourceActivityId` 在当前模块命名空间内解析。Host 同时核对主人、来源模块与活动 ID；同一主人通过其他模块的同名活动创建的召唤物也不能被误控或解除控制。地图快照及战斗模拟保留召唤元数据中的 `pluginId`，无需作者另填或由玩家传入来源模块。缺少来源模块的旧快照只按原生 `srd-5.1` 处理，不授权给导入模块。

目标资格可使用 `owned-companion` 的可选 `source: { packageId, activityId }`，同时匹配主人和完整来源。适用于限定同源伙伴的命令、治疗或强化；省略 `source` 仍表示任意自有伙伴。这个条件只筛选目标，不授予跨模块命令权限，也不表示召唤数量上限。来源值来自 Host 快照；模块导出和重新安装保留该条件。

### 召唤落点约束

`summon.placementRangeFeet` 可显式指定落点距离（0–100000 的整数尺），`requiresVisiblePlacement: true` 要求施法者在提交时看见落点。省略距离时沿用区域的 placeRangeFeet、单体的 rangeFeet，其他情况为 30 尺。三个公共召唤选点入口读取本批声明的最大距离；每个召唤仍由 Host 分别校验自己的距离，混合不同距离的批次不能借最长距离绕过限制。界面距离提示不代替 Host 检查。

Host 按实际召唤物占地与施法者占地距离检查，并继续检查地图边界、占位、墙体和效果线。可见性使用最新角色状态和地图照明，包括黑暗视觉、失明及已接入的感官；它独立于“未被占据”。普通召唤、尸体转化和物体转化的落点提交都经过最终检查。普通召唤选格逐只预览合法落点，计入已选成员、当前成员的独立距离和视野要求；每次点击重查地图与角色视野。预览不代替最终 Host 复核，失败不会返回部分落图。尸体来源召唤沿用尸体落点；已选区域的单只召唤仍由最终提交校验。

持续召唤的替换仅作用于本次地图提交前已存在、且符合来源匹配的旧召唤物。同一次 Activity 中，单个 summon 的多只数量和多个 summon 操作会共同保留；后续落点必须避开本次已放置成员。后续成员放置失败会拒绝整个地图结果，不返回部分创建或部分删除。此规则不代替特定法术的唯一伙伴资格限制。

`summon.timing: "source-next-turn-start"` 使用战斗内的持久化 Host 队列。提交时确定落点与先攻结果，来源 Token 下一次回合开始时重新验证资格和位置，创建 Token 并加入先攻；持续时间从出现时开始。战斗外或尚无权威回合时钟时拒绝，不按页面刷新或系统时间推算。旧战斗被替换、来源离场或必需的专注结束会取消任务，终态收据保留以防重复执行；位置失效保留 `blocked`，不擅自换位或自动重试。该时机只表示来源下一回合，不隐含死亡触发、尸体转换或指定目标下一回合等其他规则。模块必须分别声明这些行为并验证完整事件链。

召唤预览先按当前成员的施放距离、施法者占地和召唤物实际体型计算候选包围范围，再调用提交规则逐格验证。大型生物左上角可位于距离边界外而其身体仍在范围内，预览会保留这些合法落点；短距离预览的扫描数量不随整张地图面积增长。最终校验仍检查地图边界、占位与视野。

`alternate-resource-spellcasting.ignoreMaterialComponents` 来自角色实际拥有的授予定义；不免除言语、姿势或资源成本。原生守护之链的目标戒指检查及持续期间材料检查遵守这项免除，并在保存的效果中保留授权结果。它不是“目标具有复活材料豁免”接口。导入法术的正式 plugin spell transaction 已支持特性资源授予：spellId 可为命名空间 ID，Host 根据真实特性定义重新校验授权、施法属性与资源成本，并在 Activity 成功后原子扣除特性资源，不扣普通法术位。目标法术仍须具有可执行入口；这不保证缺少实现的法术可执行，也不代表玩家选择界面或全书转换已通过验收。

资源施法快捷栏按已拥有的授予及允许环级生成入口，显示各环级资源成本；角色无需普通职业施法列表也可选择。失去特性、资源耗尽或缺少自动法术定义时不可用。请求只携带 featureId/grantId，Host 重新读取授权与成本。该入口已通过本地组件渲染及事务回归，尚不作为完整房间网络验收证据。

目标的复活材料免除可声明 `declarativeAbility.mechanic: { kind: 'revival-material-waiver' }`，并用特性的职业、等级和来源资格限制拥有者。Host 从实际目标的特性重新核验；只有所有 Activity 结果操作都为指向目标的 `revive` 时适用。混合效果、多目标中存在无此资格者、缺失目标或召唤不死生物不适用。免除材料不会免除言语、姿势、施法时间或普通法术位，也不会放宽尸体、灵魂、死亡时间等复活条件。目前测试覆盖正式 Resurrection 事务及混合目标/效果拒绝；未声明全书转换或网络验收完成。

### 等值物品制作仪式

`exchange-inventory-items` 声明产物模板、数量公式及材料/产物标签、价值上限、是否必须持有原件。价格和标签由 Host 安装的物品目录读取。玩家只选择材料实例、数量、货币、原件和可选地图落点，不提交可信价格、完成时间或最终背包。

当前可用形状由 `dnd5eActivityHasInventoryExchangeRitualProfile` 校验：minute/hour、self、单个 always outcome 中仅有一个 exchange 操作、无选项/检查/缩放、仅确定性 resource 消耗的非施法 Activity。其他组合仍报告未支持，包括随机数量或费用、混合操作、多分支和施法入口。普通 Headless 即时调用拒绝该操作，必须经过持久仪式路由。

玩家按钮会选择材料及数量，再向 Host 发送 `inventoryExchangeRitual: { decision, selection, ritualId? }`。开始不传 ritualId；完成或取消使用保存的 commandId。刷新后从持久记录恢复选择和剩余时间。完成时可通过地图点选指定产物位置。

`settleDnd5eInventoryExchangeRitualV1` 提供 begin、cancel、complete 事务准备。开始与完成需要当前版本和使用资格；底层取消支持特性撤销后的清理，但撤销后的玩家入口尚未验收。开始不扣材料，完成才结算资源和库存。地图页面捕获地图、角色、战斗与战役时间版本，使用既有原子发布流程。Host 独立核验所有选择、归属、时间、落点和金额。

已验证范围：合成配方 starmod 导出、读取、安装、自动按钮和正常 prepare/resolve；隔离 DM/玩家浏览器已通过上传、同步、开始仪式、刷新恢复、取消且材料不变。隔离双端还已通过到期完成、扣费、指定地图产物及玩家同步；自由产物选择、产物拾取仍待实现，不能据此声明源 PDF 自动转换或全书认证完成。

### 显式不可减伤的伤害操作

Activity 的 `damage` 操作可声明 `cannotBeReduced: true`，仅供原文明示伤害不能被降低的规则使用。直接 Activity 提交与编译后的可信插件伤害入口均传递该字段；已验证抗性、免疫、固定被动减伤会被绕过，易伤仍保留，临时生命值按现有伤害流程吸收，伤害事件仍发出。省略或 false 保持原有规则，非布尔值不能通过协议校验。

另已验证条件免疫与易伤组合、伤害检查点临时获得免疫，以及绕过护盾池但不消耗其余额。目标资格与来源保护仍由原有规则判断，该字段不提供额外攻击权限。检查点仍发出，不会禁用其他合法反应。上述为接口行为测试，不是完整源法术或玩家反应 UI 认证；不能因此将整条法术的自动化等级提升为 full。沙箱脚本的三参数 dealDamage 尚未增加此选项。

### 职业选项前置条件

独立特性和专长可声明 `classChoiceRequirements: [{ classId: "warlock", groupId: "pact-boon", anyOf: ["chain"] }]`。所有条款均须满足；每个条款接受 `anyOf` 中任意一项。现有契约选项 ID 为 `chain`、`blade`、`tome`，职业等级要求继续独立使用 `classRequirements`。

Host 读取角色实际职业及保存的选择，不授予选项，也不把其他职业的残留选择当作资格。条件检查先于构筑授予快捷路径；在重新生成权威角色快照时，已撤销前置选择的特性不再获得活动权限。此声明随原生模块导出和导入保留。它适用于有稳定选择组 ID 的职业选择，不等于通用已知法术、任意描述中的能力或尚未绑定 ID 的内容依赖检查。

### 已学会法术前置条件

独立特性或专长可声明 `requiredKnownSpellIds: ["eldritch-blast"]`，所有列出的法术都须已学会。Host 从有效职业/子职学习记录、法师法术书、构筑 known/cantrip 授予、种族戏法及其他已拥有且合格特性的 cantrip 授予核验。仅存在于职业列表、准备列表或有限次施放授权不作为学习证据；这不替代具体施放时的法术位、成分等资格检查。

判断保留精确法术 ID。自身授予不能满足自身前置；缺少外部学习来源的循环授予拒绝，存在独立合格来源时可满足。循环检测仅在一次同步判断中生效，不缓存结果；角色撤销或重新学习后重新核对。模块导出/导入和 Host 活动授权已纳入测试，未将该接口测试当作源特性完整行为认证。需要替代分支时使用下述 eligibility；对“某类特性”的完整依赖识别仍需原文与实际内容 ID 证据。

### 组合前置条件

`eligibility` 支持 `all`/`any` 节点，其 `requirements` 数组组合 `known-spell`（spellId）、`feature`（featureId）、`class-level`（classId/minimumLevel）及 `class-choice`（classId/groupId/anyOf）叶节点。它与已有前置字段同时使用时仍需全部满足。树限制为 8 层、128 节点，拒绝空分支、未知类型及循环对象。

特性引用使用真实 ID；局部 ID 归属当前包，跨包 ID 必须包含命名空间。Host 检查依赖特性实际拥有且合格，沿用循环资格保护。包外或派生特性引用会在导出报告、单条预检中列为需核验依赖，不按显示名称猜测。无法穷尽“具有某类能力”的合法来源时仍须报告该限制。原生包导入与 Host 活动测试覆盖两个替代分支、共同等级要求、缺少依赖、不合格依赖及循环依赖。

### 按能力类别判断前置条件

`eligibility` 可使用 `{ kind: "rule-capability", capabilityId: "dnd5e:curse", classId: "warlock" }`。提供者为独立特性/专长时声明 `ruleCapabilities: [{ id: "dnd5e:curse", classId: "warlock" }]`；声明式子职能力使用 `ruleCapabilityIds: ["dnd5e:curse"]`，编译器将其绑定所属职业。原生凶兆之印职业选项已有对应标识，仍检查实际选择和职业等级。

能力标识须有规则来源支持，只用于资格判断，不执行任何效果、不表示目标已被诅咒，也不授予提供者特性。Host 要求提供者实际拥有且合格，声明的职业必须存在；自我依赖和无根循环不能授权。若包内没有独立提供者，预检/导出会提示核验职业选项、子职或外部来源。原生选项、独立声明、编译子职以及不合资格拒绝路径已有原生包和 Host 测试；原始 PDF 配置仍需自动转换与逐项行为验证。

### 半血计算规则

`hp-value` 支持 `comparison: "below"` 和公式阈值。严格低于一半使用 `actor-max-hp × 0.5`，门槛不取整；`healing.amount` 的恢复半数公式则用 `floor`。直接提交及编译路径已验证 29/60、30/60、30/61、31/61 四个边界，检查成功扣一次资源、拒绝不扣资源及不修改输入状态。插件路径还要求真实资源定义和职业资格，不能仅添加同名账本余额。

### 原生房间临时运行包投影

统一内容包的 `room-ephemeral` 分发使用 `dnd5eRoomRuntimeProjectionBytes` 生成运行副本。原文件保留，副本移除定义来源并替换说明原文，带有 `runtimeProjection: "room-runtime-mechanics"` 标记。服务端拒绝缺少标记、包含原文说明或定义来源的临时包；房间关闭后清理托管文件。该路径已通过隔离双端上传同步，不改变 local-only 分发限制。

### 休息绑定区域

`create-persistent-area.bindToRestSession: true` 限于 `short-rest-started` / `long-rest-started` 的 Host 授权入口。模块只声明绑定策略，不携带运行时会话 ID。地图创建时再次校验当前会话、参与者、事件种类和开始分钟，过期选择不能绑定到下一次休息。

会话完成、打断或普通时间推进时，服务端与时钟原子提交区域和效果 Token 清理；缺失会话或不再属于参与者的存档绑定也被移除。`sourceExitBehavior: 'remove-area'` 继续通过地图移动协调处理来源离开。若区域只随会话/离开结束，可同时声明 `permanent: true` 关闭独立轮数到期；它不会绕过会话清理。作者界面提供绑定选项。完整能力的区域内加值、掩蔽、光照等仍需分别验证。

### 区域内技能检定加值

`occupantModifiers.skillCheckBonuses` 接受标准技能 ID 与 1–30 整数加值，例如 `{ "stealth": 5, "perception": 5 }`。加值由实际地图占据、关系、自身和高度规则投影，来源相同的多个区域取最大值，不同功能累加；离开/删除后不残留到角色熟练。察觉、调查也更新对应被动值，反魔法压制区域加值。

`occupantModifiers.requiresLineOfEffectFromAnchor: true` 从固定区域锚点检查全掩蔽，支持墙、地形及区域屏障，缺失锚点时不给效果。它不直接提供光源屏蔽；另用下文的 `concealsFlameLightFromOutside`。现有 `skill-check-bonus-aura` 同时修复非隐匿技能的执行，并使用标准技能白名单保留 `sleightOfHand` 等 ID。

### 明火对区域外隐藏

`create-persistent-area.concealsFlameLightFromOutside: true` 声明来源中立的明火遮蔽区域。内部明火不照亮区域外；外部观察者也不能依靠该光看清内部目标。其他光源、环境照明和黑暗视觉仍按原规则处理。可与 `requiresLineOfEffectFromAnchor` 和休息绑定组合。

地图灯和 Token 光源支持 `flame: true/false`；未显式指定时，火把、蜡烛、油灯、附盖提灯预设视为明火，自定义和法术光源不推测。DM 光源编辑器有“明火光源”开关。模型不得通过光源颜色猜测来源。

Host 过滤与客户端照明使用同一遮蔽策略。匿名 `lightingOnly` 区域只供玩家计算遮光，不带施法者、规则名称或交互效果，也不绘制轮廓。玩家光照多边形与点照明均受区域边界约束。原始扩展配置的自动生成与双端完整能力仍须另行验收。

### 按属性和技能筛选持续检定修正

Effect 的 `ability-check` 修正同时声明 `ability` 与 `skill` 时，两者必须同时匹配。
可用 `excludedSkills` 排除本条修正的技能；不影响其他效果的优势或劣势。

优势／劣势修正还可声明 `sense: "hearing" | "sight"`，仅匹配指定感官的检定；未声明感官的普通检定不会应用该修正。例如 `{ kind: "ability-check", mode: "advantage", skill: "perception", sense: "hearing" }`。远端听觉请求由 Host 验证来源、耳聋、静音及有效期后生成 `hearing` 上下文，预览和结算使用同一上下文；该字段不赋予听觉，也不能绕过不可听判定。`add` 数值加成模式暂不支持此条件，会在导入校验时报错。Activity 自带的无感官检定不会自动推断听觉或视觉。
例如一个效果可同时声明魅力（威吓）优势，以及魅力检定劣势且排除威吓。
原有只指定属性、只指定技能或不指定筛选的配置继续支持。
Activity 内部检定应使用 `rollMode:"host-derived"` 读取 Host 当前状态。

区域触发可声明 `requiresSourceLineOfEffect:true`，按当前来源 Token 到目标的全掩护检查候选与 Host 结算；与 `requiresSourceVision` 独立。此条件面向来源中心灵光，不是固定区域中心的传播条件。零骰数伤害可结合 `modifierFormula` 引用来源属性调整值，结算伤害最低为 0。

### 按所属伙伴距离决定治疗骰最大值

Activity 效果可声明 `{"kind":"maximize-healing-dice","whenOwnedCompanionWithin":{"maximumDistanceFeet":100,"bondKey":"familiar"}}`。也可通过 `source:{packageId,activityId}` 限定创建伙伴的模块和活动；同时填写 bondKey 与 source 时要求全部匹配。此处 ID 必须引用模块实际建立的伙伴绑定，不能用显示名称猜测。

条件保存在效果上，不得预先转换为永久的 `maximizeHealingDice:true`。Headless 读取 Host 地图事务快照，包含未参加先攻的伙伴，并叠加本事务内的移动、死亡和控制变化。缺少地图、所属伙伴或到期判断所需的世界时间时，条件不成立；仅距离条件不附加视线要求。直接注册 Activity、编译插件和原生治疗入口使用相同判断，药水另由 Host 传入受治疗者上下文。

这项条件不会替作者补齐资格前提。职业、魔契等资格应另行声明；短休界面的地图授权来源仍待接入。能表达条件不等于某来源条目的自动转换已完成认证。

### 具体武器的职业法器资格

`weapon-enchantment.spellcastingFocusClassIds` 接受非空、无重复的职业 ID 数组（最多32项）。Host 将其绑定到实际库存实例；无库存实例的装备及弹药容器不能授予此资格。支持手持槽或明确库存选择，背包中的武器只有持握后才可提供材料。

施法材料检查要求该实例仍在施法者库存、已持握、已鉴定、满足同调且绑定效果有效；悬置、结束、收起或失去实例停止提供法器。其他同名武器和其他职业不会继承。昂贵/消耗材料仍需原材料机制，无材料法术的姿势要求保持不变。字段随效果存档和物品绑定生命周期保存，不永久改写物品模板。

这只实现职业法器资格；契约武器选择、先决条件、既有魔法加值的适用规则仍须独立表达和验证，不能据此认证完整扩展能力。

### 重骰的自然骰值触发条件

`d20-choice-reroll.triggerD20Values` 可声明1–20范围内的非空、无重复自然骰值列表。Host 自身投骰与被攻击方重骰入口都传入本次采纳、未加调整值的 d20；条件不匹配或缺少上下文时不提供该特性。省略字段保持原有不限点数行为。

无次数消耗的重骰显式声明 `cost: { economy: 'none' }`（或空 `resources`）。专长不需要伪造次数池，导入与编辑保存保留这一语义；有消耗的专长仍只能引用自身已声明资源。Host 提供的重骰选项包含明确的空 `resourceCosts` 数组，完成记录仍原子持久化并防止重复结算。此支持不包含反应消耗、优势或攻击属性限定、盟友范围及使用后禁用等附加条件，不能据此将整项复杂特性标记为已完成。

这个条件不表示“优势/劣势骰池中任意一枚”，也不使用最终检定总值。`selection: "must-use-latest"` 仍由 Host 强制使用新结果，玩家不能通过选择原结果绕过。可视化专长编辑保存时保留导入的骰数、选择策略及点数限制。

盟友范围、反应动作、暂时禁用其他幸运能力、优势下按攻击属性限定等机制不能由该字段代替；不得把具备这些条件的来源直接标为完整自动化。

### 优势攻击的额外重骰条件（部分入口已接入）

`d20-choice-reroll` 可声明 `requiresAdvantage: true` 和 `attackAbilities: ['dex','int','wis','cha']`。前者目前只允许 `rollKinds:['attack']`、`scopes:['self-roll']`、`additionalDice:1`、`selection:'highest'` 组合。Host 使用实际生效的优势模式与攻击使用的属性校验，不从骰面、角色最高属性或玩家输入猜测；缺少上下文时不提供能力。

普通武器及借机攻击路径已传递实际武器属性，优势双骰完成后开放一次额外重骰决定，取原优势结果与新骰的较高值。原较低骰保留，原骰与追加骰分别记录。普通/劣势投骰不触发此声明；激励仍不与优势叠加。编辑器保留导入条件。

原生及插件法术的常规攻击入口、Activity 逐目标攻击现已传递属性并接入优势双骰后的追加骰窗口。Activity 的 `attackBonus` 使用明确属性引用或施法攻击引用（可与常数、熟练加值相加）时，从 Host 当前施法来源推导属性；固定加值、竞争属性或其他含糊公式不猜测。固定加值魔法物品不因内部占位属性被视为属性攻击。

编译 Activity 的攻击与目标豁免要求 `scope:'per-target'`（单目标也一样）；共享攻击配置仍明确拒绝。逐目标检定支持显式优势/劣势，常规攻击继续使用 `host-derived` 以保留当前状态的影响。共享属性、技能及专注检定的骰子配方由 Host 当前状态决定，法术和特性入口均收集一次，再供全部目标复用；普通模式一枚骰，优势/劣势两枚骰，旧版普通模式的双骰记录仍可读取。

部分特殊攻击入口及双端浏览器/中断恢复验收仍待补齐。因此不能只凭这些字段将完整“精灵之准”源条目认证为自动化通过。一般重骰对任意优势骰单独重骰的语义仍不在此接口范围内。

### 新战斗投先攻时的条件资源恢复

声明式子职、独立特性、专长的资源可声明 `combatStartRecovery`：

```json
{
  "mode": "restore",
  "amount": 1,
  "onlyWhenEmpty": true,
  "minimumClassLevel": { "classId": "fighter", "level": 10 }
}
```

Host 在该角色参加新战斗投先攻时读取真实资源余额与职业等级。`minimumClassLevel` 可省略；不能用兼职总等级替代指定职业等级。`mode` 支持 `restore`（增加，最高到上限）或 `set`（设为指定余额，也可能减少）。`onlyWhenEmpty` 限制为余额等于0时执行。所有数值和门槛必须来自原文。

该策略覆盖同一资源在战斗开始时的默认回满规则，包括 `restoreOnCombatStart`；短休、长休仍使用原有 `restRecovery` / `resetOn`。刷新、同步资源、重新导入和普通回合切换不触发恢复。只恢复已拥有并满足可用条件的资源，不授予其他特性。导出/重新导入保留该策略。此接口不是任意先攻触发 Activity 调度器，也不代表完整来源条目已通过自动转换认证。

### 导入时引用既有种族资源

转换参考目录与运行时共用静态种族资源标识，包含龙裔吐息和半兽人顽强。目录只证明 ID 存在，不授予种族、祖先选择、能力所有权或使用次数。Activity 的 `resource` 消耗引用真实 ID，Host 按当前角色快照检查并扣除；替代使用不自动执行原能力效果，也不创建另一套同名次数。动态先天法术资源不能据此臆造，生命骰仍使用专用 `hit-die` 协议。

### 命中附伤的结束时点

`on-hit-bonus-damage.consumeEffectOnHit` 显式控制命中后是否移除承载效果：`true` 用于一次命中的附伤，`false` 用于持续期间反复生效。可同时设置 `oncePerTurn:true`，以保留效果但限制每回合一次；未命中不消耗，正常持续时间、专注及其他 `breakOn` 仍独立有效。伤害类型继承使用 `damageType:"inherit-primary"`。

旧包省略该字段时保留原行为：有限持续效果在命中后消耗，永久效果不消耗。新配置应显式填写。被移除的是整个 Effect，需保留的其他增益应放入关联的独立 Effect。此接口不代表动态武器骰、目标绑定或命中后的可选使用窗口已实现。

### 从本次攻击读取武器骰

命中附伤 Effect 可使用 `amount:{kind:"weapon-dice",count:1}`，可选固定 `bonus`。Host 在实际命中时从攻击的武器配置读取骰面，换武器或改变握持后重新读取；不在施加效果时锁死骰面或提前投骰。`count` 是额外骰数，不复制武器的整组骰池；`damageType:"inherit-primary"` 继承主伤害类型，重击规则仍由 `doubleDiceOnCritical` 控制。

此形状仅支持 `on-hit-bonus-damage.amount`，不能填入普通公式或由内容声明骰面。无效武器骰面拒绝结算，法术攻击不获得此动态武器附伤。它不自动实现简单/军用武器资格、命中后可选使用、资源消耗或目标绑定，完整能力仍需组合和验证。

### 按实际武器分类限制触发

`attack-weapon-category` 谓词接受 `categories: ['simple', 'martial']` 或其中一种，适用于命中等攻击触发窗口。分类来自 Host 本次所用装备，经过攻击事件传入上下文；不按武器名称或是否熟练猜测。法术攻击、徒手和分类未知的攻击不匹配。该谓词只限制资格，不提供额外伤害、消耗或选择窗口，仍需分别声明 Activity 的触发、确认与结算。

### 命中事件中的原始武器骰

Host 武器攻击触发上下文可提供 `source.weaponDamageDice: { count, sides }`，保存该次攻击的基础骰组，尚未因重击翻倍。重击从同一上下文的 `source.result` 读取，伤害类型仍为 `source.damageType`。此数据是攻击发生时的快照，不能用当前装备替代，也不能把 2d6 武器的额外一枚骰误算成完整 2d6。法术攻击或缺失武器证据时不提供此快照。它目前是触发证据接口，并不自动产生额外伤害；命中后可选附伤的完整执行链仍在实现。

### 命中后读取武器骰的伤害操作

触发于 `attack-hit` 的 `damage` operation 可声明 `weaponDiceFromTrigger: { rollId, count }`，同时使用 `amount: { kind: 'constant', value: 0 }`、`target: 'target'`、`damageType: 'inherit-primary'`。Host 从当次命中事件读取骰面；count 是额外骰数，不乘原武器骰数。声明 `critical: 'double-dice'` 时沿用该命中的重击结果。缺少有效Host武器命中证据时拒绝；作者不能自行指定骰面替代。确认、资源消耗和事件回执仍由标准触发Activity负责。

地图的伤害驱动已接入防御前命中选择：`activation: free`、`invocation: attack-hit / actor-choice（或 automatic）`、单个 always outcome 和单个此类 damage operation，可在玩家确认后与原武器攻击合并结算。可选资源消费必须为 `resource`、`consumeOn: resolve`，其公式不能依赖待投骰。多个能力按剩余资源依次筛选，合并后才处理受击者的伤害反应和最终扣血；接受或拒绝均生成处理回执，避免随后重复触发。

这条适配路径不接受 choices、checks、effects、authorityBinding，以及 damageSource、cannotBeReduced 覆盖。其他形状仍须补充对应原子适配，不得删除其规则来强行匹配。单独调用通用事后触发结算器仍提交独立伤害，不能替代防御前驱动。内部直接调用 Headless 也不会自行等待玩家选择。

本地测试已覆盖两个命中能力共用资源、受击反应、拒绝、异步等待期间权威状态或定义变化，以及非法骰值。浏览器双端和原书配置认证仍待完成，不能仅凭该字段认定整个来源能力已经验收。


### 命中附伤的每回合限制

防御前命中附伤适配接受 `requirements: [{ kind: 'once-per-turn', key: 'your-module:hit-use' }]`，复用 `declarativeUsedTurnKeys`。使用记录与伤害、资源原子提交；拒绝不占次数，失败或取消不留下记录。多个 Activity 可共享同一个 key，任一选项接受后其余选项立即失去资格；不同 key 独立计次。使用 key 应包含模块命名空间，避免无关能力碰撞。

该限制按当前实际回合标识判断，不是每轮一次，也不会自动限制为角色自己的回合；如原文要求自己的回合，另加 `turn-owner`。刷新和序列化保留使用记录。此支持不自动补全动态职业骰、武器资格、位移或护甲效果等其他规则。


### 同次武器攻击中的普通附伤公式

防御前命中附伤也接受普通 `damage.amount` 公式，不必声明 `weaponDiceFromTrigger`。适用范围仍为单个目标、单个 damage 操作，其他资格、资源和每回合限制照常校验。公式可组合多个独立骰池、固定数值和职业等级引用；Host 使用通用 Activity 公式求值及重击骰数规划，固定加值不随重击翻倍。纯数值公式不请求额外骰子。

公式结果在原攻击防御前合并，不能由玩家提交附伤总值。额外效果、位移、选择等仍不在此窄适配范围，不能省略这些规则假造支持。此接口测试包含 `.starmod` 导出安装和生产驱动本地运行，尚未代表全书来源转换或浏览器双端验收。


### 同次攻击的伤害类型与魔法属性

防御前附伤支持普通公式操作中的固定伤害类型及 `magical` 属性。Host 将这些结果作为原攻击的伤害分项，分别处理相应抗性、免疫或易伤，再统一处理最终扣血与受伤后事件；伤害事件保留新增类型，不能把光耀附伤误当成武器挥砍伤害。

`magical` 不声明时沿用原武器攻击来源；显式 true/false 则按该属性判断附伤防御。`inherit-primary` 且无魔法属性覆盖的普通附伤仍直接合并主伤害；显式类型分项进入既有同类型、同魔法属性的合并规则。不能减免、改变伤害来源、额外状态或多个 outcome 的机制仍需单独适配。此机制已接入本地生产驱动测试，浏览器及原书整条规则仍须验收。


### 自动与可选命中附伤

上述防御前命中适配同时支持 `invocation.confirmation: automatic` 和 `actor-choice`。automatic 由 Host 以 system 身份解析，不弹出“是否使用”；若公式包含骰子，仍走既有权威投骰请求。actor-choice 保留玩家选择，拒绝不消耗资源和每回合次数。两者都校验所有权、条件、资源、使用记录和等待期间的定义/房间状态。

只有原文规定必然触发的能力才声明 automatic；不能为绕开交互把“可以”或需要选择的能力改成 automatic。这里没有新增 DM 叙事判断，也不支持用 automatic 略去原文中的模式选择、特殊目标或附带操作。


### 命中附伤的等级进阶

防御前附伤可使用现有 `scaling` 增加本 damage operation 的骰数或固定加值，依据包括角色等级、职业等级、熟练加值、属性调整值及自定义表，并遵守 `maximumSteps`。Host 骰子规划与实际求值使用同一角色快照；额外武器骰先从本次命中取得骰面，再应用进阶。固定加值不因重击翻倍。

没有有效 Effect 授予时，这条入口没有已授权的施法环级，因此拒绝 slot-level 进阶；由 Effect 授予的活动可读取同一实例保存的 source.spellLevel，不能使用玩家补交的环级。增加目标、投射物、范围、次数或持续时间的调整不由该单目标附伤适配承担。

`scaling.adjustments[].diceSidesPerStep` 按步数增加骰面，例如基础 d4、每步增加 2 个面。通过 `custom-table` 和 `classId` 声明原文支持的职业等级阶梯，`table.value` 是累计步数；不会按角色总等级代替职业等级。公式调整第一个实际骰池，跳过仅包含数值或引用的嵌套表达式，其余骰池和固定加值保持独立。可与骰数和固定加值进阶组合。Host 投骰规划和执行使用同一缩放结果；重击仅翻倍骰数。

该字段也应用于对应操作的持续区域伤害/治疗骰、复活生命骰，以及 apply-effect 关联效果的周期伤害、豁免失败伤害、固定公式命中附伤和减伤。持续骰在创建时保存参数，不提前投掷。禁止用于读取实际武器骰的 `weaponDiceFromTrigger`/`weapon-dice`，也禁止改变伤害类型查表骰的面数。每步增量须为 0–100 的整数；最终骰面超出 2–10000 则拒绝，不能静默截断。

可配置骰面进阶不代表原书的武艺骰资格、武器绑定及攻击流程已完整验收。资料未提供进阶表时必须保留缺失依赖，不从记忆补造规则。

每个自己的回合一次须同时声明 `turn-owner: actor` 与 `once-per-turn`，后者单独使用也允许在其他生物回合各触发一次。Host 已明确结束战斗时，残留的先攻位置不能满足 turn-owner。`attack-weapon.weaponIds` 默认读取当次攻击的 Host 背包武器实例 ID（`identity: "instance"`）；限制长弓、短弓等基础类型时应明确设置 `identity: "base"`，使用 Host 攻击事件的 `weaponBaseId`。缺少该字段时不回退为实例 ID，也不按名称猜测。静态 ID 清单不代替角色升级时选择武器类型的配置、保存与授权流程。

### 区域对远程武器攻击轨迹的劣势

`create-persistent-area.blocking.rangedWeaponAttackDisadvantage` 接受 `occupancy` 或 `boundary`。前者作用于接触区域空间的攻击轨迹，包括完全处于区域内的攻击；后者要求穿越边界，处于同一连续区域内的攻击不受影响。两个端点都在外部但穿过区域同样触发；两个端点都在区域内但穿过区域间隙也算跨越边界。

Host 的玩家和怪物武器攻击准备路径使用同一格子/高度相交检查。该标记提供普通劣势理由，按既有规则与优势抵消；不会阻挡移动或视线，也不等于普通飞射物自动未命中，不应用于法术攻击。区域删除后下次准备攻击不再附加该理由。字段经过声明校验、模块导出安装、地图创建及保存恢复保留。

普通区域采用已保存格子与垂直体积，格子轨迹使用线段与格子的相交区间，避免短距离擦角被固定步长采样漏掉。非贴格矩形另外使用保存的实际长宽、锚点及旋转方向裁剪相交区间；例如 1 尺厚的墙不会把整个选中格都作为攻击干扰空间，已清除的格子也不会被精确矩形重新补回。

非贴格矩形的平面尺寸按声明的上下限校验，不强制为 5 尺倍数；`gridAligned:true` 仍要求贴格尺寸。立方体默认贴格。该实现不代表任意曲线薄墙、完整风模式切换、逆风移动、飞行豁免或原始法术配置已完成；这些条款仍须分别验证。

### 区域移动耗费的来源豁免

同一区域若包含“所有生物受状态影响、来源不受移动耗费影响”，应使用 `target.includeSelf:true`，并在 `create-persistent-area` 操作声明 `movementExcludesSource:true` 和相应的 `movementCostMultiplier`。该字段仅豁免与该区域 `sourceTokenId` 相同的 Token；不会取消耳聋等占据者状态，也不豁免其他施法者创建的困难地形。`includeSelf:false` 仍表示排除来源的全部区域效果，不能用于混合目标范围的替代配置。来源豁免随区域移动、导出安装和地图保存恢复保留，删除区域即停止提供该区域的地形影响。

### 不限目标数的区域命令

当规则影响区域内每个合格生物时，省略 `target.maximumTargets`。注册 Activity 的 Host 命令边界使用权威地图计算出的区域目标数量，而不是通用命令的默认 256 个目标限制；提交名单仍必须与 Host 区域名单完全一致，客户端不能自行扩大上限、遗漏目标、夹带区域外目标或重复目标。普通非区域命令保留原有校验。合成模块已验证 0、3、300 个目标的地图选择、独立豁免、一次共享伤害骰及最终 HP 结算；这不是无限规模性能保证，也不代替具体法术完整条款和双端验证。

### 专注期间的被动防御

声明式 `passive-defense` 支持 `concentrationBonuses: { armorClass: 2, savingThrows: 2 }`。两个字段可分别省略，但至少提供一项；值必须为 1–10 的整数。该能力不消耗动作，也不创建新的专注来源。角色必须拥有该能力并达到授予等级，且正在专注于法术，加值才生效。

Host 在每次攻击与豁免结算时读取当前专注状态；专注豁免自身可获得此加值，失败或主动结束专注后立即失去。基础 AC 与基础豁免中不保存此条件加值，避免重载或再次生成战斗快照时重复叠加。AI 转换时不得用无条件 `staticModifiers` 替代该条件。

### 多阶段检定的条件字段

`appliesWhenCheck` 仅用于豁免检定，引用之前成功的攻击检定；随机表的 `appliesWhenSave` 引用之前的豁免结果，`appliesWhenCheckTotal` 引用之前随机表的数值。`minimumTargetSpeedFeet` 仅用于随机表。把这些字段放在其他检定类型上会被拒绝，不能依靠未声明字段隐式改变执行顺序。一次命中后先豁免、豁免失败后再查表，应明确声明这三个阶段。

条件检定的骰子按当前 Host 状态收集。专注提供的 AC／豁免加值改变前一阶段结果时，后续骰子需求必须同步改变；不需要的额外骰子和缺少的必要骰子均被拒绝。

### 来自属性调整值的先攻加值

永久 Effect 可声明 `{kind:"character-capability", capability:"initiativeBonusFromAbility", value:"int"}`，属性键允许 `str/dex/con/int/wis/cha`；兼容字段为 `staticModifiers.initiativeBonusFromAbility`。它额外加入所选属性的当前调整值，保留负数，并与敏捷、手动先攻加值及原文允许的固定加值组合，不将动态结果写回角色存档。职业、子职和等级条件由能力自身的授予与资格声明控制。

该值在角色卡、地图先攻掷骰及战斗快照生成时计算。属性变化、临时属性降低、能力移除或不再满足职业等级后，重新生成先攻时立即反映变化；不追改已经确定的本场先攻顺序。

### 已有移动方式的速度加值

永久 Effect 支持 `{kind:"character-capability", capability:"existingMovementSpeedBonuses", value:{walk:10,climb:10,swim:10}}`，兼容字段为同名 `staticModifiers` 对象。允许 `walk/climb/swim/fly`，每项为 1–1000 整数。它只增加当前已有的对应速度，不授予缺失或零速度的模式，也不增加未列出的模式。职业等级与持有资格仍由 feature 的资格声明控制。

永久技能检定加值可声明 modifier：`{kind:"ability-check",mode:"add",ability:"cha",skill:"persuasion",value:{kind:"reference",reference:{kind:"actor-ability-modifier",ability:"wis"}}}`。兼容字段为 `staticModifiers.skillCheckAbilityBonuses: [{skill:"persuasion",ability:"cha",bonusAbility:"wis"}]`。角色卡和 Headless 按当前来源属性计算调整值，保留负数；不把计算结果固化到角色基础技能值。`ability` 指检定所用属性，指定时仅匹配该属性；技能必须指定。资格仍由特性持有、职业与等级条件决定。独立声明的子职附属特性使用 `grantedBySubclass:true`、`sourceClassId` 和带包命名空间的 `sourceSubclassId`；导入器先注册所属子职，再校验并注册附属特性，缺失或错误的归属仍会拒绝。

运行时重新计算移动方式与回合额度；同一步行绑定的攀爬／游泳速度不重复加入步行和对应模式的同额加值。完全替换属性的 polymorph / true-polymorph 停用此原角色能力，wild-shape / shapechange 保留能力。导出、再次导入和 JSON 重载不把结果写回基础速度。

验证范围：合成模块往返、角色面板与 Host 数值一致、资格移除、加速／减速、束缚及速度归零、移动与疾走、四类形态。负重与种族能力的组合仍需单独扩展验收；不能仅凭此接口的测试结果认证整份来源资料。

疲劳在基础速度与加值组合后统一应用于当前移动方式。变形进入、恢复原形及初始化战斗额度均使用当前有效速度。Host 的 Activity 疲劳增减与狂暴结束会更新本回合剩余移动额度，保留已消耗距离和原有额外移动量；速度降为零时剩余额度归零。恢复速度不会返还已消耗距离。合成模块测试也覆盖固定永久步行加值与按已有模式加值的组合。

### 条件黑暗视觉与观察者相关隐形

`{kind:"darkvision",rangeFeet:30,ifAbsent:true}` 只在缺少既有黑暗视觉时授予范围，不把原有 15 尺提高到 30 尺。可选 `existingBonusFeet` 为既有范围加值；若仅增强种族来源，增加 `existingRangeSource:"race"`。例如 60 尺种族范围加 30 尺，同时另有临时 120 尺视觉，最终取 120 尺。基础来源与派生结果分开保存，重复投影、导出重载不重复增加。

`{kind:"darkvision-concealment"}` 声明“黑暗中对依赖黑暗视觉的观察者隐形”，可用于永久或临时 Effect。它不授予全局 `invisible`，也不授予视觉范围。Host 按目标光照、观察者感官及距离判断；普通黑暗视觉不能看见目标，而范围内真视、盲视或不依赖黑暗视觉的黑暗视力可以。识破隐形与已接入的妖火显形亦参与判断。明亮与微光不触发。

该判定用于 Host 视线、未见攻击者优势及未见目标劣势。服务器按玩家实际观察者隐藏目标身份；多人共享视野只要有一位合格观察者看见目标即可保留身份。匿名位置标记沿用现有“位置已知但未看见”语义，不代表能看见目标或满足要求可见目标的法术。隐匿、墙体与感官距离限制仍独立适用。

已验证合成模块归档往返、临时 Effect 提交/移除、暂停和服务器多观察者投影。原书的等级授予、完整重新转换、真实房间与全部变形组合仍须独立验收。

### 临时豁免熟练

Effect 可声明 `{kind:"saving-throw-proficiency",ability:"con"}`，多个属性分别列出。运行时保存独立的熟练授予，使用目标当前熟练加值；同属性多来源或同一 Effect 重复声明只加一次，已有永久熟练不额外加值。移除某个来源后，其他来源仍有效；暂停或到期后停止授予。临时授予不改写角色永久 `savingThrows`。

永久构筑选择 `select.options` 支持 `requiresSavingThrowProficiency: [{ability:"wis",proficient:true}]`。各条件均需满足，`false` 表示未熟练，属性不得重复；只检查此内容授予前的永久 `savingThrows`，不计临时 Effect，也不让本内容的固定或选定授予满足自身条件。与 `requires` 的先前选择依赖同时生效。

持续区域的来源数量限制使用 `create-persistent-area.sourceLimit:{groupId:"shared-mode-group",maximum:2}`。同包不同模式共享组 ID；Host 使用完整地图快照统计同一角色在各地图中的未到期区域，超限拒绝整笔地图提交。它不自动替换旧效果；通过区域授予的 `dismiss-granting-area` 解除或自然到期后释放数量。即时操作不创建区域，不计入上限。自定义 Host 集成必须传入当前完整 `sourceLimitMaps`，缺失时拒绝受限创建，不能传玩家请求中的列表；地图快照不写入延迟召唤队列。参见 [验证范围](verification/2026-09-29-persistent-area-source-limit.md)。

持久召唤可声明 `existingBondPolicy:"reject-living"`，同时要求 `persistent:true` 与 `bondKey`。它在原有重施替换之前读取同一 Host 地图集合，按模块、契约和来源角色检查已有伙伴；正 HP、HP 未知或暂时遣散都阻止新建。同一事务该契约创建数量必须为一。当前底层沿用召唤系统的 0 HP 败退边界，不能用于需要独立死亡豁免／复活状态却未提供该状态的模型。省略此字段保留既有重施替换语义；原书完整规则仍需来源行为验收。

例如“获得感知豁免熟练；已有则改选智力或魅力”可建一个 `count:1` 的 select：感知选项要求 `wis=false`，智力与魅力选项要求 `wis=true`，三个选项分别授予相应的 `proficiency/saving-throw`。不要另加固定感知授予。升级界面按前面已经有效选择的专长和构筑内容更新候选，Host 提交时重新校验；修订升级使用还原后的升级前人物卡。

该语义贯通直接及已注册 Activity 的 Host 结算、专注豁免与战役定时豁免。旧存档的纯数字 `savingThrowBonusByAbility` 仍按固定加值处理，不根据来源名字猜测为熟练；重新施加原生熟练 Effect 后使用新语义。永久构筑授予使用 Advancement；已有熟练时改选另一熟练属于独立的选择资格机制。

### Existing core fighter resource identifiers

Persisted fighter resources retain the case-sensitive IDs `fighterSecondWind`, `fighterActionSurge`, and `fighterIndomitable`. Declarative subclass costs and resource prerequisites may reference these IDs only with `scope: "core"`; do not create replacement plugin resources or lowercase these persisted keys. Activity resource consumption, restoration, capacity predicates and resource modifiers accept these existing keys. The Host still checks ownership and available quantities. Plugin-local identifiers retain the ordinary lowercase format.

### Attack-only damage mitigation

`damage-mitigation-interrupt` accepts `attackOnly: true`. The Host checks the origin of the damage, so weapon and spell attacks qualify, while automatic, area-save and unrelated damage do not. Imported Activity damage receives this origin only when its outcome explicitly depends on a successful attack check against that same target. Having an attack check elsewhere in the Activity is insufficient. Script authors can pass `attackDamage` in the Host damage capability options for actual attack damage; this is not a player action field.

Reduction-mode interrupts may declare `preventedAttackRetaliation: { minimumClassLevel: 14, damageType: 'force', magical: true }`. The Host uses the owning feature's class level, requires an authoritative attack damage source and an actual attacker, and returns only the amount this interrupt prevented. The rolled allowance is capped by remaining damage and shared across the transaction; it is not the retaliation amount. Retaliation resolves after the protected damage, applies the attacker's damage defenses, and is feature damage rather than another attack. This rider does not limit the underlying protection to attacks: non-attack damage can still be reduced without retaliation. It requires a class-owned feature; it does not infer a class from total character level. Local import and Host checks cover the current implementation; actual dual-client acceptance for the XGE subclass remains pending.

The option constrains the trigger only. It does not turn one damage packet into a turn-long resistance effect or certify every clause of a source feature. Any longer duration or later damage from the same attack needs its own provenance and lifecycle contract.

### 按装备类别限定攻击优势或劣势

持续 Effect 的武器攻击修正可声明 `{kind:"weapon-attack-roll",mode:"advantage",weaponCategories:["simple","martial"]}`。只列一种类别也可；省略 weaponCategories 保留原先包含徒手和天生武器的武器攻击语义。传空数组、重复类别或未知类别会被拒绝。

限定类别时，Host 采用本次攻击的装备元数据；法术攻击（即使由武器投射）、徒手、未知类别不满足。玩家装备攻击预览与 Host 共用判断，Effect 暂停、移除后不再授予。此修正不会授予装备熟练，也不从怪物攻击名称推测装备分类。自定义怪物的原生攻击若没有装备分类，不能因此宣称已经支持该受限增益。

### 持续技能检定数值加值

Effect 支持 `{kind:"ability-check",mode:"add",skill:"persuasion",ability:"cha",value:{kind:"constant",value:5}}`。skill 必填；ability 可省略，填写时与技能条件同时匹配。value 使用合法公式，在效果施加时求值；这不是持续随属性改变重新计算的公式。负值可表达减值。

效果随正常期限、暂停与移除处理，不改变角色永久熟练或技能值；角色技能显示、普通 Host 技能检定和 Activity 技能快照读取相同活动状态。不要用优势、熟练或假造零半径灵光代替固定数值加值。此 add 形式不接受省略 skill 的泛属性检定，也不覆盖工具检定；这些范围不得静默扩大。

### 区域豁免的体型自动成功

`savingThrow.automaticSuccessMinimumSizeRank` 接受0到5的整数：微型、小型、中型、大型、Huge、Gargantuan。设置4表示Huge及更大自动成功，Host使用规则体型而非Token图片尺寸。满足阈值时准备阶段不请求豁免骰，结算重新检查体型，并发出带automaticOutcome的结果和区域触发回执；未满足时仍须正常豁免。旧请求携带的d20不改变自动结果，也不消耗豁免加骰资源。

这只改变豁免结果，不表示免疫整个区域；容量、推出位置、自愿失败、携带移动、区域结束效果必须另行声明和验证。区域原有DM结果调整入口保持不变。

### 区域触发后的最近空位排出

`forcedMovement:{mode:"nearest-outside-area",appliesOn:"successful-save"}` 在共享地图结算中把目标完整占格移到区域外最近合法位置；也可选择failed-save或always。不要提供distanceFeet。距离按当前格距规则计算，同距按行、列稳定选点；目标位置已在区域外时无需再次移动。

可选 `maximumOutsideDistanceFeet` 为 1–1000 的整数，限制落点占格与区域格之间的最近距离。例如 5 表示必须在区域外 5 尺内，不是从目标起点最多移动 5 尺。无合规落点时整笔触发拒绝，状态、伤害与回执不会部分提交。此字段不支持 push-from-source。容量与随机排出仍不能仅用该字段表达。

束缚触发器可另外声明 `capacity:{maximumUnits:4,unitsBySizeRank:[1,1,1,4,null,null],overflow:"random-existing-until-fits",maximumOutsideDistanceFeet:5,proneOnExpulsion:true}`。体型数组按微型到超巨型排列，null 表示不能容纳该体型；必须结合相应的资格或自动豁免规则，不能把拒绝容量当成成功豁免。此策略保留刚被束缚的目标，随机排出现有的同实例束缚目标直至单位容量满足。它明确允许混合体型导致多次排出，不能据此推断所有法术原文都采用此策略。

Host 通过 `createDnd5ePersistentAreaCapacityCoordinator` 收集所需随机结果。同一事务和相同候选集合复用结果，只有一个候选时不掷骰。排出只移除来源实例的束缚，保留其他来源，并通过标准状态入口处理倒地免疫。落点、效果移除、强制位移及触发回执一起提交，任意目标失败都不提交。实际先攻不包含的乘员只加入临时结算快照。当前限同高度排出，不含坠落、结束时落地、普通火焰熄灭或沿途区域级联。

容量区域明确结束时，同实例束缚通过 `reconcileDnd5eEndedAreaCaptives` 解除，包括暂停中的效果。它依据区域删除前后快照，不因当前地图缺失区域就推断跨地图区域已结束。共享区域对账/回合到期及 DM 手动删除路径调用此清理；普通区域施加的独立持续状态不受影响。该入口处理当前地图仍有 Token 的目标；跨地图对账见下段，区域结束时落地仍需额外生命周期支持。

新容量束缚由 Host 自动保存 `areaLifetime:{mapId,areaId,sourceActorId}`，转换配置无需填写此运行时字段。房间生命周期对账使用完整已加载地图列表：来源地图唯一且对应来源实例已不存在时，清理其他地图的目标及普通离图角色。来源地图缺失/重复、字段与来源标签不符或旧状态缺少该字段时不猜测结束；旧状态仍可通过明确删除前后快照在原地图清理。离图角色若有自定义 `afterEffectEnds`，保留待真实 Token 出现后再通过 Headless 处理，避免伪造位置或跳过结束后效果。尚不代表区域落地、熄火或来源地图删除后的全量恢复策略已经完成。

地图资源另保存 `deletedMapIds`。Host 删除真实存在的地图时记录，服务端根据已提交地图与新地图列表之差独立生成并保留记录；客户端自报的未知删除 ID 不作为服务端证据。普通保存、事务保存及冲突重试保留历史。来源地图缺失但有此明确记录时可结束关联束缚，仍存在的同 ID 地图则优先检查其区域实例。删除最后一张地图后也会运行房间角色清理。旧版本中没有记录的历史删除不反推，整份地图资源被外部清空/替换的恢复策略仍需另行验证。

选点复用Activity强制位移的实体阻挡、占位和地图边界校验，不是传送，也不消耗移动力。区域触发结果与位移及回执一起提交，没有合法落点则不返回可提交结果。Headless裸区域触发函数只算豁免/效果，带位移声明的区域应调用prepare/resolvePreparedDnd5ePersistentAreaTrigger地图事务。

当前搜索保持目标所在高度，不负责悬空区域的垂直落点、坠落与地表追随；这不是碧水球全部三维规则的认证。容量、随机排出、倒地和携带移动仍需各自机制。

### 区域推离的共享事务

`forcedMovement:{mode:"push-from-source",distanceFeet:10,appliesOn:"failed-save"}` 由 `resolvePreparedDnd5ePersistentAreaTrigger` 和最近区域外排出一起处理。成功、失败或总是触发使用同一结果事件判断；`sourceMayDecline` 被拒绝时即使 `appliesOn:"always"` 也不移动。

事务投影最终形态，复用 Activity 地图方向、边界、完整占格和实体阻挡校验，写入 Headless 位置与实际距离的 `moved`（`movementKind:"forced"`）事件，并同步地图、关系清理和区域回执。不会扣移动力。完全受阻时保留原位，不生成位移事件，其他效果仍结算；缺少地图 Token 的快照返回 `invalid-target`，不提交任何效果或回执。页面不再二次推移。

`mode:"push-from-area-anchor"` 从保存的区域锚点推离，不使用施法者位置。体积区域以区域中心和目标身体中心计算三维方向，逐步校验地面、占位和实体阻挡；没有体积声明时沿用平面推移。高处被推出且失去支撑的目标由 Host 既有坠落流程继续掷骰、结算并落地。地图事务输出强制移动的起止高度事件，玩家不能用请求字段跳过坠落。此模式不声明沿途新区域触发级联；无地图的底层区域骰值解析函数不独立执行地图位移。

持续区域的回合开始／结束触发可用 `proximityFeet` 扩大触发距离而不扩大区域本体；`requiresAnchorLineOfEffect:true` 从当前区域锚点检查实体遮挡，与从施法者出发的效果线不同。

### 持续区域三维移动与地表扬尘

`movement.allowVertical:true` 为固定、统一高度的体积区域启用移动高度选择。Host 同时校验水平距离与高度差、移动资源和实体阻挡；省略目标高度时保持绝对高度。此选项不能与携带乘员混用，也不支持逐格高度列。

`movement.surfaceCloud:{materials:["sand","dust","loose-earth","gravel"],radiusFeet:10}` 在移动路径接触 DM 明确标注的地表材质时生成独立重度遮蔽子区域，不增加本体的伤害范围。子区域随本体移动，在施法者下回合开始时消失；本体或专注结束时一并清理。`lifecycle.expireAfterAdvances:1` 声明该回合生命周期，`linkedParentAreaId` 是 Host 生成的实例归属，导入作者无需预填实例 ID。

扬尘按完整占格扫过的面积检查地表，包括中心路径未经过的狭窄材质区域；材质使用后画覆盖和地面高度规则。升降移动只检查区域底面达到对应地表高度时的占格位置，不把悬空经过当作接触。

探索时间可通过 DM 的 `advance-seconds` 时钟操作推进（界面提供“+6 秒”），`worldSecondRemainder` 保存当前分钟内的余秒，满六十秒进位。新扬尘子区域保存 `remainingExplorationSeconds:6`；重新扬尘刷新剩余时间，仅移动现有尘云不刷新。服务端在一次原子事务中推进时钟并扣减／移除到期区域，旧的整分钟推进同样适用。真实等待和刷新不推进游戏时间；战斗中的下回合开始清理仍保留。该字段是运行时状态，不代表所有既有分钟级效果都已迁移为秒级计时。

启用三维移动的区域还按完整方形占格与体积高度连续检查地图实体：短墙角和两端均已越过的薄天花板不能穿过；沿墙面移动和刚好贴住天花板不算穿透。球形与半球形力场壳也检查整个立方的连续扫描，包含两端均安全但中途角落进入外壳的路径；球内移动和半球底部开口保持可用。该检查不改变角色的碰撞尺寸。其他魔法区域屏障仍经过既有区域屏障判定，地图屏障与穿墙开口的组合需单独验收。

### 区域豁免的自愿失败

只有原文允许时才声明 `savingThrow.allowWillingFailure:true`。它为目标控制者提供「进行豁免／自愿失败」选择，不是自动失败，也不是施法者替目标同意。Host使用既有共享选择窗口，角色目标路由到该角色，未绑定角色的目标交给DM；默认、超时或未确认均继续正常豁免。

同一事务的批量豁免与提交共用一次选择，不继承到下一次触发。来源可拒绝触发的区域不预先要求目标掷骰；先确认来源是否触发。`resolvePreparedDnd5ePersistentAreaTrigger` 只接收Host取得的 `willingFailure` 决策，并再次验证规则允许；体型自动成功优先，不能通过此字段强行失败。

自愿失败无需d20，不消耗预备的下次d20优势，正常执行失败分支的伤害、状态和位移。日志明确显示无需掷骰。保存/导出保留规则许可，不保存永久自愿选择；原有DM调整仍为单独语义。这不意味着所有D&D豁免都可以自愿失败。

### 持续区域状态的实例归属

持续区域触发施加的标准状态现在记录 `persistent-area:<areaId>` 标签，并使用包含区域ID、来源与状态的独立叠加键。同一实例重复触发只刷新自己的效果；不同实例不会互相覆盖，投影出的标准状态仍按既有规则合并。

`skipSaveWhenSourceConditionActive` 只接受当前区域、当前来源的有效状态；暂停的状态或另一实例的同名状态不能跳过豁免。新的实例标签优先于旧法术ID。没有实例标签的旧原生法术效果仅在兼容豁免/蛛网清理路径保留原先的施法者匹配，不得据此判定一个对象可以被某区域携带。

`dnd5ePersistentAreaConditionEffects` 默认执行严格实例筛选，兼容原生效果必须显式给出legacyCoreSpellId。这是携带和生命周期处理所需的来源证据，本次尚未新增携带移动操作或容量规则。

### 命令移动时携带区域束缚目标

`movement:{economy:"action",maximumFeet:30,carryRestrainedTargets:true}` 使普通区域移动及 `relocate-granting-area` 携带被该区域实例施加 `restrained` 的目标。目标必须仍在区域内，状态不能已暂停；旧的无实例标签状态不会被推断为携带对象。角色状态以Host角色快照为准，角色资料不完整时拒绝规划。

所有乘员按区域锚点偏移保持相对位置。完整占格、地图边界、墙体及非乘员落点占位一起校验；任一失败拒绝整笔事务。提交时重新校验，位置和forced moved事件同步，不扣乘员移动力、不产生借机攻击。普通命令会将未参加先攻的乘员纳入临时Headless快照，不为其增加实际先攻回合。

当前仅支持同高度命令平移。区域或地表高度变化会被拒绝，尚不能表达安全下落、悬浮地表追随及结束落地。与source-token/target-token锚定、sourceFollower、自动translateAwayFromSourceFeet组合无效，不能通过自动移动路径静默绕过携带。容量限制、随机排出及沿途撞击/触发级联仍需各自机制，不包含在本字段内。

### Area occupant visibility

`target.requiresVisibleTargets: true` on an area Activity filters occupants using the actor's Headless perception, independently of `requiresLineOfSight` (anchor visibility for map placement). Filtering precedes `maximumTargets`. Both registered and compiled Host settlement reject a submitted target that is no longer visible before spending resources. Event-centered trigger selection honors the same flag; existing event-centered `requiresLineOfSight` behavior remains compatible.

Invisibility, blindness, special senses and current spatial relations use the existing perception engine. Missing bound character data does not become assumed visibility. Leave the flag absent for effects that also affect unseen occupants. Choice target overrides and cast-level target profiles may declare the field; it survives `.starmod` export/import. This does not certify an entire source spell or its later persistent-area triggers.

Target overrides and cast-level profiles use the same effective target contract at command validation and execution. Area placement and Host member equality, creature pairwise separation, and source-relative immunity exclusions follow the selected/scaled target rather than the base definition. A choice changing target kind does not authorize arbitrary area subsets: the full Host-computed membership is still required unless a separate supported selection mechanism applies.

### Selecting area occupants

Declare `target.selection: "choose-any"` when the rule explicitly lets its owner choose affected creatures. `minimumTargets` defaults to 0; omit `maximumTargets` if the rule has no count limit. The candidate pool is not truncated before selection. Choice overrides and cast-level profiles may carry these fields, and module archives preserve them.

Spell requests carry an explicit `targetTokenIds` array, feature requests use their top-level `targetTokenIds`, and registered Activity commands use `targetIds`. Missing selection, duplicates, out-of-area or newly invisible candidates, and invalid counts reject before consumption. Ordinary areas continue to affect the complete Host-derived set. Explicit `[]` is a confirmed zero-target use, not cancellation; it can still consume the action/spell slot and execute actor-only outcomes. Cancelling the chooser submits no use.

The trigger coordinator exposes `selectTargets`; production uses controller-owned room choice windows. Pure simulations without a selection provider decline instead of automatically choosing a target. Immediate subset choices do not make a persistent region affect only those creatures forever; persistent trigger exemptions are a different declared mechanism.

### Alternative existing-effect requirements

An `active-effect` predicate may use `anyOf` instead of the legacy single `effectId`:

```json
{"kind":"active-effect","subject":"target","source":"self","present":true,"anyOf":[{"effectId":"named-mark"},{"tags":["curse","example:class-curse"]}]}
```

The alternatives are OR. Within a tag alternative, every tag must occur on the same unsuspended Host effect; the source requirement applies to that exact effect. `self` means the effect's source actor is the current Activity actor, not merely an effect carried by the actor. Tags or ownership from different effects cannot be combined. `present:false` negates the completed match. An unknown subject never satisfies the predicate.

There must be 1–32 alternatives, each containing exactly an effect ID or 1–32 unique semantic tags (maximum 80 characters per tag). Named alternatives match the exact definition ID or its colon-delimited suffix, including Activity wrappers; they do not match an ID appearing only in the middle of another definition ID. New `anyOf` selectors exclude suspended effects, including name matches. Existing single-effect declarations retain their previous behavior for compatibility.

Declare semantic tags on the originating Effect definition. Names, UI labels, or client claims do not classify an effect. If the source module does not implement the prerequisite effect or provide its required tag, report the unresolved dependency. This predicate provides eligibility only: area anchoring, compulsory primary-target damage, optional neighbors, and invocation timing must be separately declared and verified. The examples are synthetic interface data, not certified conversions of source material.

### Primary target followed by optional nearby targets

A root Activity can validate a single primary target, spend one action resource, damage that target, and apply a single-use grant to the actor. A granted follow-up can listen to `feature-used` (or `spell-resolved` for a spell), require `effectGrantScope: "trigger-execution"`, and filter its `event-source.activityId` to the root. Use an `event-target` area with `selection: "choose-any"` and `excludeEventTarget: true` to select nearby recipients without damaging the primary twice. Declare range, visibility, inclusion of the actor and line of effect according to the source.

Both registered and compiled Activity completion events carry Host execution provenance. Cast notifications paired with a completion from the same actor, spell and execution produce a single resolved window. An execution-bound follow-up inherits the casting level of its exact granting effect, not another concurrently active grant.

`expireGrantAtWindowEnd: true` now supports `feature-used`, `spell-resolved`, `item-used` and `action-resolved`, in addition to `temporary-hit-points-gained`. It requires `retention: "single-event"` and execution binding. At normal completion of the window, only matching single-use grants on the actor or original targets expire. Grants from other executions or grants shared with ordinary ongoing actions remain. The existing resolution-budget safeguard preserves unfinished windows.

The primary has already resolved when secondary choices are presented: selecting zero targets or cancelling the optional portion does not undo primary damage or refund its action. The secondary Activity should not charge the root action again. Do not use this pattern for a rule requiring a simultaneous, all-or-nothing primary/secondary choice; such a rule needs a combined transaction. Serialized Host state and committed events preserve provenance, but production browser persistence and interaction still require separate verification.

### Custom text in advancement selections

A `kind: "select"` advancement may declare `customTag: { key: "language", label: "自定义语言" }` alongside its ordinary `options`. This adds one text choice to the same selection count; it does not grant an additional choice. An empty options list is allowed when this declaration is present. The character creation and level-up dialog displays the declared input. For a single choice, entering text replaces a fixed option and choosing a fixed option clears the text.

Selections encode the value as `$custom:<text>`. The Host accepts it only for an advancement declaring `customTag`, trims the value, and requires 1–80 characters without control characters. At most one custom value is accepted per advancement. It grants only `{ kind: "tag", key: customTag.key, value }`; entered text cannot specify operations or other grants. The tag and original selection persist in the ordinary content-choice receipt. Replacing that receipt removes its previous grant. Modules still need to declare and validate the complete rule separately; this input is suitable for campaign-specific language names.

### Target-specific opportunity attack protection

For target-specific movement protection, permanent character-capability Effects may declare `preventOpportunityAttacksFromMeleeAttackTargets: true`. The map bridge uses the same capability projection as character construction. A shared Host recorder tracks each melee target, including misses, only on the attacker's own turn; the list expires at turn end. Weapon attacks, unarmed strikes, the monk composite action and native melee spells use their resolved delivery. Imported Activity attack checks must declare `delivery: "melee"`; registered and compiled entries preserve it. Ranged or unspecified delivery does not grant protection. Direct movement opportunity attacks and spell replacements enforce the list without suppressing independent retaliation. Failed transactions roll the record back along with the rest of the action. Module entitlement, level requirements and source-wide certification still require their own validation.

Subclass-specific permanent capabilities can be packaged as a separate feature with a character-capability Effect and granted by a subclass `advancements` entry (`kind: "build-grant"`, `level`, then `grants: [{kind: "feature", featureId}]`). Give the feature a matching class-level requirement. This uses the production subclass selection and advancement path; do not simulate the grant by adding a permanent feature ID to every character. Total character level does not replace the required class level.

### Typed map consumable purification

`purify-map-consumables` now applies its declared `contaminants` to obstacle tokens with a valid Host-owned `dnd5eObjectState.consumable` food/drink payload in the selected Activity area. Magical objects are excluded. The write boundary checks occupied cells, current barriers and vertical extent; it never infers food, contamination or magical status from an object label. Other contaminants and object metadata are preserved. Unmodeled objects remain unchanged. The result is a cloned map with changed token IDs; unsuccessful later handoffs do not mutate the input map. Reapplying purification is idempotent. Inventory purification remains a separate operation. This support does not enable locks, lights, object enchantments or barrier suppression, which retain their existing runtime limitations.

### Source-specific critical range on a marked target

Apply an Effect to the defender with `{ "kind": "attacks-by-source-critical-threshold", "threshold": 19 }` in `modifiers`. The integer threshold is 2–20. Only attacks by that effect’s `source.actorId` benefit; the actual defender is checked again after redirection. Suspended or removed effects do not apply. Multiple ranges use the lowest threshold, without adding their values. Native attacks and registered/compiled Activities use the same threshold, including critical damage dice preparation. The source and threshold survive module export/import and combat-state serialization. This modifier does not declare bonus damage, death rewards, uses or duration; declare those separately. It expands the critical-hit range and is distinct from automatic criticals conditional on a hit.

### Activity damage dice evidence

Host-generated `activity-formula-roll-resolved` events also support `kind: "damage"`. They identify the Activity, operation, target and attributed damage source (`actorId`); `executorId` records the combatant executing the Activity, which may differ for `damageSource: "grant-source"`. Such grants retain their source spell level. `total` is the evaluated formula amount before target defenses, not HP lost.

Each dice entry retains its `rollId`, actual consumed `count`, `sides`, `submittedCount`, `rawValues`, and effective `values` after supported die transforms. Non-critical targets consuming a critical-sized shared pool record only their consumed dice. `formulaAdjustment` reconciles the effective dice sum with the final formula amount, including constants, multiplication, division and rounding. Fixed damage without dice emits no dice event; a rolled formula evaluating to zero still has evidence. Actual applied damage remains in `damage-applied`.

These entries are formula-node evidence, not independently eligible damage rolls. Repeated roll IDs across targets can identify one shared pool; repeated uses within arithmetic do not authorize multiple bonuses. Do not add damage once per event, die or node. Generic source-linked damage bonuses remain unavailable until grouping, qualification and native-route integration are implemented and verified.

### Explicit damage-roll boundary (partial integration)

Activity formulas may declare `{ "kind": "damage-roll", "rollId": "primary", "value": { "kind": "dice", "rollId": "damage", "count": 1, "sides": 6 } }`. The boundary marks where a qualifying damage-roll bonus belongs. Put save-halving arithmetic outside it. Criticals multiply the inner dice, while a fixed bonus is added once. The Host grants at most one bonus for the same boundary ID, target and attribution in one resolution; use distinct IDs for genuinely distinct damage rolls. A nested boundary does not add another bonus. A boundary containing only fixed amounts or zero consumed dice receives none.

The target Effect modifier `{ "kind": "damage-rolls-by-source-bonus", "value": { "kind": "reference", "reference": { "kind": "actor-proficiency-bonus" } } }` captures the bounded integer bonus at application. Registered and compiled Activities derive eligibility from current target effects and the actual damage source, including grant-source attribution. Suspended, removed and foreign-source effects do not apply; duplicate definitions use the strongest value instead of summing copies.

This integration currently covers explicitly declared Activity damage-roll boundaries. Native damage paths and unwrapped legacy formulas are not yet complete, so the modifier is deliberately not registered as fully supported. Keep imported source features with this outstanding dependency partially supported until native integration and source-level validation are finished. The wire command cannot provide the Host's bonus callback or its per-resolution consumed-group set.

The common native weapon/opportunity attack settlement also applies this bonus once across its primary and on-hit components. It selects the first component with verified consumed dice; fixed components do not qualify. Host-resolved on-hit Activities retain this qualification through reaction replay, including typed replacement damage. The bonus participates before weapon pool subtraction, outgoing damage multipliers and target defenses, and is not doubled by a critical. Its `damage-roll-bonus-applied` event records the source, target, amount and receiving damage type. Specialized redirected attacks, monster paths, spells and periodic damage still require their own integration; the full-support registration remains withheld.

Common ActiveEffect `periodicDamage` now also qualifies its validated dice pool using the actual effect source. It adds the bonus inside the raw roll before zero-clamping, then applies the saving throw, then target defenses. Source-turn start, target-turn start and target-turn end are supported by this common path. Separate periodic effects have separate rolls; the existing turn-key replay guard prevents repeated settlement. Audit events use `group: "periodic-damage"` and retain `effectId`. This does not imply coverage of separate legacy delayed-spell, persistent-area or monster-specific damage implementations.

Native single-target spell attacks and separately rolled multi-attack sequences also qualify their own damage pools against the actual target. The bonus is added before clamping, Cutting Words, damage multipliers and defenses; criticals do not multiply it. Half-damage-on-miss attacks include it before halving. Events use `group: "spell-attack"`. This does not cover shared saving-throw/automatic spell pools, later stored delayed damage or specialized redirection paths. Full-support registration remains withheld.

Native cast-spell saving-throw damage also supports source-linked target bonuses. Shared primary/additional dice pools are validated once; each recipient receives an independent derived pool. Only the first component with dice receives the bonus, before zero-clamping, shared Cutting Words reduction, saves and defenses. The reaction is consumed once, not per recipient. Audit events use `group: "spell-save"`. This does not extend support to separate monster or persistent-area resolvers.

Native automatic-damage spells now use the shared recipient pool as well, including fresh bonus-action Heat Metal rolls. Player and monster core Magic Missile paths qualify each existing projectile pool separately. Shield and limited-magic-immunity branches do not apply a bonus. The projectile event retains optional `targetBonus` independently of class `featureBonus`; zero values are omitted for event compatibility. Bonus events use `group: "spell-automatic"`. Other monster and area/legacy delayed implementations remain separate integration work.

Monster core spell attacks and shared saving-throw spells also derive source-qualified bonuses from each recipient. Common monster weapon attacks claim once across their primary, extra-critical and trait dice components; fixed components do not qualify. These use the existing `spell-attack`, `spell-save` and `weapon-attack` audit groups. Separate monster area/death/lair/special and on-hit-save damage remain distinct paths; this is not full modifier certification.

Common monster area actions now support source-qualified bonuses, with `group: "monster-area"` audit events. Shared pools derive independent target totals; separately rolled selections, including repeated targets, each qualify independently. One component receives the bonus per pool, before clamping, combined-pool save modification and defenses. Separate death/lair/special/on-hit-save implementations remain outside this integration.

Monster death-area snapshots and Dragonborn breath also qualify their validated pools using the actual source, before saves and defenses. Audit groups are `monster-death` and `racial-breath`. Death snapshot replay remains rejected. DM-adjudicated final-effect interfaces, including the legacy lair-action interface, have no raw dice evidence and do not receive another automatic roll bonus.

The persistent-area trigger resolver applies source-qualified bonuses to positive-count damage dice before clamping, saves and defenses, including creation, entry and turn-boundary rolls. Audit events use `persistent-area`; damage evidence includes the modified roll modifier. Fixed damage and healing do not qualify. The caller remains responsible for trigger eligibility and replay de-duplication. Stored legacy/maximized delayed-damage potency has no explicit roll provenance yet and is not certified by this integration.

New maximized Acid Arrow delayed effects now retain runtime `maximizedDamageRoll` dice provenance alongside base potency. The Host validates their agreement and resolves current source-qualified bonuses at the delayed boundary (`group: "delayed-damage"`). Existing potency-only records intentionally retain legacy totals without inferred new bonuses. This metadata is not an independent scheduling operation and does not certify arbitrary imported effects.

Stand Against the Tide repeats use the original attacker for source-linked damage bonuses; the reacting hunter cannot supply their own source identity. A repeat claims once across rolled damage components, excluding subtract-from-weapon dice. Monk unarmed bonus attacks also qualify their own pools, including separate Flurry hits. Both use the `weapon-attack` audit group; remaining independent special/save damage paths still prevent full certification.

Repeat-save `damageOnFailure` qualifies only when the current saving throw fails, including effects requiring several successful saves to end. It uses actual effect source identity and `repeat-save` audit events. Hellish Rebuke also includes the source bonus before its save-halving and defenses. These additions do not certify remaining independent damage routes or unrelated capability gates.


### 原生特殊伤害及地图能力边界（2026-09-30）

`damage-rolls-by-source-bonus` 现覆盖 Quivering Palm 成功豁免后实际掷出的伤害，以及 Deflect Missiles 返回攻击；伤害来源为武僧。直接降至零生命、未命中和放弃反击不产生加值。全原生入口的完整支持登记仍待剩余路径核查。

地图锁、物体光源、物体附魔和穿墙通道目前在最终地图写入层被跳过，相关 Activity 仍为 assisted。已注册操作处理器只代表能生成交接数据，不保证地图效果被执行。验收见 `docs/verification/2026-09-30-map-rating-monk-target-bonus.md`。


### 随机表共享伤害池（2026-09-30）

施法后随机表的 `self-centered-core-spell` 结算已接入 `damage-rolls-by-source-bonus`：共享基础骰池，每个目标独立加值，然后豁免与防御；不新增共享骰，也不重复结算已消费的表事件。未知表项仍保留原有限制，其他原生入口的完整支持登记继续等待审计。验收见 `docs/verification/2026-09-30-random-table-target-bonus.md`。


### Hurl Through Hell 延迟骰来源（2026-09-30）

新状态保留 `hurlThroughHellPendingRolls` 的10d10基础骰池，地图及角色保存重载后仍在返回时读取当前 `damage-rolls-by-source-bonus`。邪魔不受该次伤害。旧总额状态保持原结算；新骰池若数量、骰面或总和损坏，返回事务拒绝而不默默降级。现有预掷骰交互保持不变。验收见 `docs/verification/2026-09-30-hurl-delayed-damage-provenance.md`。


### 待处理怪物触发器（2026-09-30）

Host待处理机制快照的独立伤害及反应攻击已接入来源限定伤害骰加值，按机制拥有者匹配目标效果，归零与防御之前加入；治疗/临时生命不受影响。快照重复提交继续拒绝。同步命中后附带伤害仍需核实与主攻击的骰池归属，完整支持登记尚未放开。验收见 `docs/verification/2026-09-30-monster-mechanic-target-bonus.md`。


### 命中后独立豁免伤害（2026-09-30）

怪物 `saving-throw-damage` 每个独立豁免骰池仅领取一次来源加值，主武器攻击池独立；在首个实际有骰分量加值后做汇总豁免与防御。固定分量和能力值降低骰不触发，暴击不翻倍独立豁免骰。同步自定义 after-hit 追加机制仍待核查，完整登记未放开。验收见 `docs/verification/2026-09-30-monster-on-hit-save-target-bonus.md`。


### 特殊吸取和传奇翼击（2026-09-30）

特殊吸取的伤害骰已接入来源加值，上限降低与治疗仍取实际伤害；传奇翼击按失败豁免的目标分别加值，成功豁免不产生加值。共享基础池不修改，其他治疗骰不加值。完整来源增伤登记仍待剩余入口核实，验收见 `docs/verification/2026-09-30-monster-special-target-bonus.md`，其中另行记录尚未解决的空中传送回归。


### 投掷碰撞及同步命中后分量（2026-09-30）

真实投掷碰撞骰按投掷者来源加值，无碰撞不领取。同步怪物after-hit分量与原攻击目标的主武器池共享一次领取记录，首个有骰分量领取，多个追加分量不重复增伤。旧陷阱接口缺可信来源时不猜测身份。完整登记仍待入口审计，验收见 `docs/verification/2026-09-30-fling-synchronous-target-bonus.md`。


### 战技第二目标骰池（2026-09-30）

第二目标战技伤害读取第二目标上归属于实际攻击者的来源增伤，先加值归零再应用防御，不影响原目标。其余战技共享及脚本数值来源仍在审计，未据此开放完整能力登记。分类与验证见 `docs/verification/2026-09-30-damage-entrypoint-classification.md`。


### 武器与战技共享领取（2026-09-30）

Host内部攻击骰池记录已覆盖普通战技、反击和指挥攻击：主伤害固定且无骰时，实际追加战技骰领取一次来源加值；主攻击已有骰则不重复领取。指挥攻击来源为盟友。内部记录不接受玩家输入。脚本骰来源等剩余审计尚未完成，验收见 `docs/verification/2026-09-30-maneuver-shared-roll-budget.md`。


### Worker 的明确伤害骰接口（2026-09-30）

脚本可在 rolls 声明上设置 `damageType`，然后调用 `ctx.dealRolledDamage(targetId, rollId, multiplier?)`。Host 校验真实骰值、目标绑定、来源标记并结算；返回 void，最终扣血由 Host 事件报告。倍率限 0.5/1/2，乘二不是暴击；暴击应增加声明的骰数。省略伤害操作表示不受伤。
同骰池同目标一次执行只能提交一次；旧 `dealDamage` 仍为固定/最终数值，不猜测骰来源。注册法术/特性、动作消耗、命中/豁免分支仍由模块显式声明。示例与边界见 `docs/verification/2026-09-30-worker-rolled-damage.md`。旧脚本不会被自动重写，完整能力登记未放开。


### 旧声明式能力的伤害池（2026-09-30）

旧声明式 `damage` 效果现按真实伤害骰在倍率与防御前领取来源加值，同池同目标只领取一次。普通武器攻击产生的无独立豁免 after-hit 追加与主攻击共享领取；固定主伤害后的第一组追加骰也能领取。记录仅限 Host 当前事务，不能由脚本或玩家伪造。其余未携带领取记录的旧攻击入口仍待审计，完整能力登记保持受限。详见 `docs/verification/2026-09-30-legacy-declarative-damage-pools.md`。


### 原生攻击的父伤害衔接（2026-09-30）

怪物、重定向、原生法术和武僧等攻击事件已补实际伤害类型与 Host 内部骰池记录。旧声明式固定命中后伤害可用 `parent-weapon`（仅 after-attack-hit、count=0 且无缩放），按父事件类型结算；正骰池仍需既有 Host roll 授权，不能因此在任意攻击事件后自动生成骰值。Activity 多检查与伤害池的明确连接仍待核查，完整能力登记未放开。验证见 `docs/verification/2026-09-30-native-parent-damage-ledgers.md`。


### 多攻击重击归属（2026-09-30）

要让伤害继承某次本地攻击的重击，outcome 必须明确关联该攻击检查的 success/critical-success，不能用 always 借用 Activity 中任意攻击的重击。实际受伤目标分别判定，actor/all-targets 不会继承无关目标结果。没有本地检查的已授权触发附加仍可在 Host 允许的目标范围内继承原重击。
伤害提案及结算证据的 `attackCheckKeys` 保留关联，编译路径的较大共享骰池兼容仍只消费当前分支应有骰数。验收见 `docs/verification/2026-09-30-activity-critical-branch-attribution.md`。


### Activity 父攻击伤害记录

Host 使用 `attackCheckKeys` 关联成功攻击与实际受伤目标，在 registered/compiled 路径提供事务内共享记录。独立检查分别记录，联合结果共享；固定伤害不占用有骰记录。记录不序列化、不接受客户端提供。缺少关联的旧提案采用保守处理；grant-source 不借用执行者身份重新领取。此项不扩大普通未包装公式的伤害加值语义，也不宣称所有后续攻击骰收集入口已完整支持。验收见 `docs/verification/2026-09-30-activity-parent-damage-budget.md`。


### 攻击前直线移动

`{kind:'movement-distance',basis:'before-attack-straight-streak',minimumFeet:10}` 在 attack-hit/attack-resolved 等攻击上下文读取 Host 的 `precedingStraightMovementFeet` 快照。只给紧接已提交连续移动的第一次攻击；失手也清除该移动累计。分段直线可累计，转弯只计算新方向，跨回合/强制位移/传送不保留旧累计。registered/compiled均支持，旧event/straight-streak只用于移动事件的含义不变。

该条件不代替获得等级、每回合次数、攻击类别、豁免或动作间隔限制；不要用整回合准备效果冒充实时移动资格。其他动作间隔以及骑手自身回合内的完整坐骑控制需按具体来源另验收。验收见`docs/verification/2026-09-30-attack-movement-snapshot.md`。


### 持续区域的封闭模式与暂停恢复

`create-persistent-area.modes` 声明 1–16 个唯一 ID 的模式。每个模式可包含 `blocking`、`movementCostMultiplier`、`directionalMovementCost`、`occupantModifiers`、`obscuration` 和 `triggers`。`initialModeId` 指定一个模式，或用 `initialModeChoiceId` 引用 Activity 的选择项；只能声明其中一个。模式字段不与对应基础字段、自动演化 `lifecycle`、`castLevelProfiles`、Hallow/Symbol 或地图物件附魔混用。区域原有范围、移动控制、到期时间、专注和后续活动授权仍属于同一实体。

区域授予的后续 Activity 使用 `{id:"change",kind:"change-granting-area-mode",target:"actor",change:"select",modeChoiceId:"mode"}`。也可用固定 `modeId`。`change:"pause"` 与 `change:"resume"` 不带模式参数；它们分别关闭和恢复上述六类模式字段，保留区域实体和后续动作入口。选择新模式会替换旧模式并恢复效果。需要消耗动作时，后续 Activity 必须声明正常的 action-economy 消耗；该操作本身不绕过资源结算。

Host 核验来源角色、Token、包、该区域授予的活动与有效期限。重复同一事务不会回退之后的模式；暂停不重置专注或期限。刷新、跨战斗以及切换到无触发器的模式都保留有限总次数和每目标一次的触发记录。升环对所有模式的触发骰池、固定值、总次数与共享区域期限只应用一次，施放时的触发豁免名单保留在模式快照中。详见 [本地验证范围](verification/2026-09-30-persistent-area-modes.md)。

该协议只验证封闭模式的生命周期，不代表某个原始法术已完整自动转换。模式目前不切换光照、召唤属性或武器附伤，也不据此推导独立风向、飞行条件触发或区域内摔落减伤。


### 飞行资格的区域触发

`triggers[].requiresTargetFlying:true` 只用于 `on-enter` 和 `turn-start`。Host 的收集器需要以真实角色/怪物快照生成的 `flightCapableTokenIds`，并按路径点或当前位置检查生物底部高于地形；缺少证据不触发。普通移动、强制移动和回合开始已接入；准备骰子及 Headless 再次核验有效飞行速度、已接受的移动方式与离地状态，拒绝过期资格。

两个触发器可共用 `frequencyGroupId` 和 `oncePerTurn:true`，使每个目标在同一权威回合内只触发一次。豁免失败倒地仍用已有永久 prone 条件，至规则动作移除；地图的最终结算传入触发前状态，使非悬浮生物失去支撑后进入现有坠落、HP 和地图投影流程，悬浮按既有规则保留。

Token 的 `dnd5eTraversalMode` 由成功的 Host 移动结算保存。飞行资格必须同时满足 `fly`、有效飞行速度及离地高度；兼有两种能力但正在攀爬的生物不触发，坠落/落地会更新方式。此字段属于 Host 状态，不是 Activity 或玩家可提交的证明。旧存档如果缺少方式记录，不从高度猜测，接受一次有效飞行移动后才启用飞行专属触发；原有高度和普通坠落流程保持。

飞行途中进入区域、同一次移动最终落地的路径仍需补进入点中断。当前准备阶段核验最终状态，会保守关闭该路径的飞行触发；不能把这种拒绝当作完整进入行为。也尚未认证倒地在途时对后续路径的中断，以及任意独立风向、上升气流区域内的摔落减伤。详见 [验证及剩余缺口](verification/2026-09-30-persistent-area-flight.md)。

效果结束条件支持 Effect.breakOn 中的 deals-damage：使用已提交、正数且具有来源的伤害事件结束造成伤害者的匹配效果。零伤害和完全免疫不触发；持续伤害沿用其来源。Activity 操作依顺序结算，伤害后才授予的效果不会因之前的伤害结束。直接 Activity、编译插件和回合末持续伤害已有回归测试；该记录不代表所有第三方调用路径已验证。

专长 prerequisite.raceSizes 支持 small/medium，以种族定义的原始体型判断；与 raceIds 同时出现时为或关系，不读取临时变形体型。staticModifiers.grappleEscapeAdvantage（或对应 character-capability）只在脱离擒抱的力量运动/敏捷特技检定中提供优势，包括固定DC和对抗；普通技能检定及非擒抱的束缚解除不受影响。

持续区域 lighting 的魔法黑暗可声明 `lightSuppressionScope: 'within-area'`：仅在黑暗覆盖位置抑制普通照明及不高于 `suppressesMagicalLightThroughLevel` 的法术光照，不销毁低环光源。高于阈值的法术光按自身亮光/微光半径和视线遮挡局部照亮；其他重叠黑暗仍独立生效。省略此字段保留原有解除整个来源的语义。持续球形 Activity 自动保存 `vertical.shape: 'sphere'` 与直径/底高；距离检查考虑生物体积及移动锚点，重载不得退化为无限高柱体。

持续区域可声明 `lighting: { kind: 'reduce-light', radiusFeet: 10, spellLevel: 4 }`，在汇总环境与现场光源后将明亮降为微光、微光降为黑暗；多个降光区域不重复降级，也不会解除光源或把既有魔法黑暗改成普通黑暗。移动区域按实时锚点与三维距离判定。`obscuration: { kind: 'heavy', scope: 'source-token' }` 只遮蔽来源生物，不生成整片区域的遮挡边界；来源向外观察及同格旁人不受此遮蔽影响，盲视可穿过这层遮蔽。省略 `scope` 继续使用区域遮蔽语义。需要创建持续区域的 Activity 应声明自中心区域目标，并将准备阶段的区域选择和法术专注 ID 传入地图交接。昂贵材料需另声明可执行的 `materialRequirement`，不能只写材料说明或价格。隐藏来源的照明由 Host 投影为匿名 `lightingOnly` 数据；模块不应自行创建投影字段。该组合的浏览器双端与复杂地形显示验收仍在进行。

永久特性可声明 `staticModifiers.maximizeHealingDiceNearCompanion`，或在永久 Effect 中使用已有 `maximize-healing-dice` 与 `whenOwnedCompanionWithin`。导出和导入保留条件查询；角色必须持有且满足特性资格，Host 每次按受治疗者自己的魔宠及实时地图距离判断。已接入原生治疗法术、直接/编译 Activity、药水和短休生命骰；不把“魔宠当前在附近”保存为可由玩家提交的永久布尔值。缺少可靠场景时不启用条件收益。

同批事件中的 `once-per-turn` 特性会在每次询问前重新读取已提交次数；接受第一束命中后不再为第二束重复询问，拒绝第一束不消耗本回合次数。最终提交仍保留原有权限和次数校验。
`create-persistent-area.sourceAbilityCheckRules` 为区域来源角色投影检定规则（沿用 abilityCheckRules 的 ability、skill、excludedSkills、mode）。仅区域存在且来源满足存续条件时有效，随地图保存恢复；不会写回角色永久效果。适用于随身光环的来源检定修正，与区域内其他目标的效果分开声明。独立特性的本包 resources 可由主动 Activity consumption 消费；编译入口使用注册后的限定 ID，并校验来源角色持有该特性，不把任意同名余额当作资格。
`rollModeIfOpposed` 只比较已知控制方是否不同，不代表正在交战。不要将“施法者或同伴正在与目标战斗才有优势”的法术直接标记为已完成自动化；探索施法也复用临时 Headless 快照，state.active 不能单独证明发生了战斗。

逐目标豁免现在可声明 `rollModeByHostFact:{id:"fighting-source-or-allies",label:"目标现在是否正在与施法者或其同伴战斗？",mode:"advantage"}`，同时使用 `scope:"per-target"` 及 `rollMode:"host-derived"` 保留目标自身防御。Host 在请求骰子前让 DM 对每个目标选择是、否或取消；否是有效事实，并不取消施法，是才加入声明的优势／劣势，取消或超时不授予回执。事实与其它优势／劣势共同抵消，骰子请求与结算使用同一判定。`id` 使用有效标识，提示非空且最多500字符，`mode` 只接受 advantage/disadvantage。

事实通过私有 Host 回执绑定施法者、规则包、Activity、事务、目标选择和施法选择；受信对象展开保留回执，JSON 序列化移除回执。玩家命令／payload 自报事实无效。直接 Activity authority 仅从受信 Host 参数 `saveFactsByTargetId` 读取，绝不从 command 读取。该接口为缺少地图权威事实的规则提供明确 DM 判断，不声称系统能自动推断是否正在交战；不替代要求必须为真的 `requiredQualifications`。魅惑怪物 v7 的本地模块事务、回执隔离及回归已验收，实际双端确认界面及全条法术仍待验收。

范围内非生物植物枯死可声明 always outcome 操作 `{id, kind: 'wither-map-vegetation'}`。Host 要求 areaSelection，并按占用格、遮挡和高度筛选地图物体；仅将 obstacle 上明确标注的 `dnd5eObjectState: {schemaVersion: 1, vegetation: 'living'}` 改为 `vegetation: 'dead'`，跳过魔法物体。DM 在物体详情中标注植物，系统不从背景图片或名称推测。死亡状态保存后可恢复，重复执行不产生额外改变；树干等实体、HP 和物理障碍仍保留。植物生物的豁免及伤害用独立操作结算，此操作不会代替生物伤害。

攻击事件的 `attack-delivery` 条件区分 melee/ranged，独立于 weapon/spell 分类。原生法术和统一 Activity 的直接、编译入口保留 Host 判定的送达方式；武器与徒手事件可以从已知模式推导，缺少信息的旧 spell 事件不会被猜成近战。`attack-mode: spell` 本身不能表达近战法术攻击。

个人伤害前反应允许 Effect 保存 `grants`、`grantsSingleUse` 和 `suspendWhileEffectId`：先结算防御，后续活动在关联效果结束后才可用。该反应适配器只保存个人效果，不立即执行授予的活动。后续附伤仍需单独声明命中、送达方式、回合归属和来源效果条件，并测试升环、消费、结束与重复事件；尚不能由这一形状推断连击附伤、专注检定及所有伤害入口均已正确合并。

命中伤害提交前的 Activity 适配器现支持由有效 Effect 授予的单个纯伤害操作：Host 从同一个授予实例读取施法环级、检查目标、计划骰池并消费单次权限，玩家不能另交环级。武器/徒手、原生单次/逐发法术攻击，以及带 Host 攻击检定证据的导入 Activity（直接和编译入口），可以合并附伤后再处理防御、HP 和专注；处理过的活动写入攻击事件，后置触发器不再重复应用。导入活动只在该攻击检定关联的首次伤害操作中处理授予，不能据此推断多伤害操作已合并为一个伤害包。具有位移、治疗或其他副作用的活动仍需自己的原子结算适配，不能静默丢弃这些操作。

伤害关联治疗的 damageResult 只读取对应原始 damage 操作分摊到的伤害，不把独立授予的附伤计入该操作。原生按伤害类型回血的攻击读取相应类型的结算伤害；其他类型附伤仍伤害目标，但不会扩大该治疗。


### 盟友或当前施法者的魅惑目标

Activity 的 requirements 可使用 `{kind:"target-relation",relation:"ally",orCharmedByActor:true}`；target.relation 应为 any，避免在执行条件前排除敌方目标。盟友沿用现有阵营关系；替代条件由 Host 的当前有效魅惑效果及 source.actorId 决定。他人魅惑、暂停和受反魔法压制的法术魅惑不满足，客户端不能提交 charmedByActorIds 作为授权事实。该选项仅能与 ally 和字面值 true 搭配。不改变目标阵营、不授予魅惑，也不自动结束已附加的持续效果。


### 持有者向效果来源执行动作

`active-effect` 条件可使用 `subject:"actor",source:"target"`，表示行动者持有的有效效果必须来自本次所选目标。该来源选择器不允许 subject:target；没有目标身份、来源不匹配或效果暂停时拒绝。可用在持续链接的回传动作，并单独配置 requiresLineOfSight 与 requiresTargetSeeActor；不要用 source:any 将通信对象放宽到其他角色。导入后的效果可能拆分出 modifiers 后缀，需要精确识别时可使用 anyOf 的标签选择器。该接口只判定授权，不直接发送聊天内容。
# 实体压顶束缚绑定

`create-persistent-area.bindRestraintEffectIds` 可声明需要随本实体结束的束缚效果 ID（需同时声明 `entityProfile`）。Host 按创建时占格、施法者和规则来源匹配已经应用的 restrained 效果，绑定到对应独立实体；销毁该实体只解除与其精确绑定的效果。角色档案与地图 Token 同步保存绑定。普通施法和特性提交路径已接入；插入结算及延迟执行路径尚未验收，不能据此认定所有入口均支持。

### 遗骸的不死生物制造保护（部分接入）

Effect 可声明 `undeadCreationProtection:{minimumPower:"wish"}`。七天持续时间使用 `duration:{kind:"rounds",rounds:100800,expiresAt:"source-turn-end"}`，沿用战役时钟推进及正常效果解除。施加时要求 Host 确认目标已死亡且尸体仍在；仅有0 HP不满足。只有选中包含该效果的分支才允许死亡目标，不扩展其他典礼的目标资格。

当前原生操纵死尸/创造不死生物及扩展 `summon.corpseFormChoiceId` 都检查此保护；任一受保护尸体使普通批次拒绝，不扣资源或移除其他尸体。升环、客户端名称及自报来源不构成祈愿术级别权限。原生祈愿术可通过规范化的复制声明调用操纵死尸或唤起死灵，并跨过此保护；仍校验真实施法来源、九环资源及合法遗骸，数量按被复制法术基础等级计算，不能用九环位扩大数量。该路径不要求被复制法术的材料；目前仅支持这两个复制分支，扩展召唤不能自报权限。当前配置、持久化、已确认死亡生物Token及遗骸物体的局部结算已验证，完整葬礼浏览器事务仍待验收，不能把本字段视作葬礼全流程已完成。

原生祈愿复制这两个分支的快捷栏、目标选择、Host自动提交、九环位单次消费及双端/玩家刷新已用预置合法保护尸体验证。实际导入典礼术产生保护另有本地证据；不将预置夹具的浏览器测试视作完整典礼施放或任意祈愿复制认证。

地图遗骸入口现可声明 `{id:"ward",kind:"protect-map-remains",durationMinutes:10080,minimumPower:"wish"}`，配合点选区域目标（例如5尺放置距离、5×5×5尺矩形）。Host 重建选点，要求该空间恰有一具明确分类为`humanoid-corpse`或`creature-corpse`的地图物体，并复核实际距离、高度与效果连线；不凭0 HP、名称或骨骸图标推断尸体。`creature-corpse`要求显式六种原体型之一，支持可选生物类型；此资料不会自动满足原生操纵死尸的小型/中型类人生物资格。同格多具尸体暂拒绝，不能自动猜最近的一具。客户端不能给操作直接填尸体ID或过期时间。

记录写入`dnd5eObjectState.undeadCreationProtection`，绑定Host来源及战役创建/到期分钟。原生制造不死生物在准备和提交时读取记录，时钟未知时不视为已到期。战役时钟到期只清除保护，保留尸体，并沿用现有房间地图保存路径。典礼术部分包用两个目标表示呈现同一葬礼：角色/怪物尸体与地图尸体；这不是新增宗教典礼。v10实际包的Command、Headless与地图写入，以及立即结果在反魔法地图中的保留和解除魔法候选排除已本地验证。此政策依据立即法术结果的通则，不能泛化为所有保护效果都不可驱散。导入法术效果来源保留注册法术ID，Activity定义与堆叠标识独立保留；持续时间从实际安装法术读取。v14实际包产生的葬礼效果与原生祈愿复制制造亡灵的例外已本地验证；完整典礼双端、统一选尸体入口和分类界面实际操作仍待完成，不构成完整认证。
# 受益历史的跨包身份

`establish-spell-authority` 的 `recordKind:"benefit-history"` 可显式声明 `benefitScope:"ruleset"`，让相同 `benefitKey` 的受益记录在同一规则集的不同导入包间共享。默认仍按 package 隔离。共享声明同时识别旧包中尚无 scope 的同名历史；换包、更换施法者或临时效果到期不能重获一次性奖励。作者应为不同能力使用不同稳定 key，仅对同一个规则中的能力共用 key。

已有共享历史不能通过省略 scope 降回包内范围。合法续期必须通过原有 Host 死亡证据政策；提交会合并被替代的同名历史并保留其他能力记录。类型仅允许 `package`、`ruleset`；玩家不能直接写历史。此接口局部验证不等于导入法术全流程认证。

## 召唤物物件命令：破门检定

`command-owned-companion` 使用 `requiresObjectInteraction: true` 时，玩家选择参数 `companionObjectInteractions[operationId]` 可提交 `{ mapId, doorId, operation: "break" }`。参数只引用门，不接受客户端提交 DC、成功结果或门状态。普通“操作物件”和“预备操作物件”的地图选择器均提供破门选项。

Host 执行时读取当前门、距离和法术锁，使用执行召唤物自己的力量检定及优势／劣势。普通破门消耗动作，不能抵扣免费物件交互；失败保留持续命令以便后续回合重试，成功更新门的开启和破损状态并结束已完成的命令。预备时消耗动作并保存门引用，触发时才掷骰、重新检查当前门并消耗反应；不再次消耗动作。失控的召唤物不能继续执行旧门命令。

这项操作处理门几何，不代表已支持场景互动点的奖励、机关效果或任意自定义物件操作。

## 召唤物命令：场景交互点（部分支持）

普通 `use-object` 命令可选择 `{ mapId, sceneId, interactionPointId, operation: "interact-point" }`，仍通过 `companionObjectInteractions[operationId]` 提交。参数不得包含 DC、成功与否或效果；Host 从当前场景读取私有配置。地图选择器只显示启用且对玩家可见的点，执行时再次检查当前距离、高度、墙体、控制权、存活和动作。

执行使用召唤物自己的属性／技能检定及优势、劣势，消耗动作并保留免费物件交互。成功或失败分支确定后，只请求该分支需要的伤害骰；伤害、抗性、免疫及状态通过 Headless 落到执行者。唯一交互记录复用房间角色的权威收据集合，但不会因此给施法者发放物品。`once` 在全组共享，`per-character` 按执行 Token 区分；`always` 失败保留命令。地图Host为每次执行生成独立`attemptId`，在收集检定骰、结果伤害骰与日志阶段始终复用该编号。同回合再次获得可用的普通动作后可以发起新尝试；重复提交同一编号会被拒绝，新编号也不能绕过动作检查或once/per-character限制。这个编号仅供Host事务调用，不能放入玩家的场景点选择参数；旧内部调用省略编号时仍使用按回合的保守去重键。

普通场景点现支持伤害、状态、讲义及任务结果（或空结果）。讲义／任务依赖由Host从当前房间日志读取，私密讲义接收者取召唤者角色的房间成员身份；缺失讲义、任务或必要接收者时拒绝整次结果。结果生成的日志变更与地图、角色收据、回合资源通过同一服务器事务提交，版本冲突时均不落库，收据阻止重复分发。成功／失败分支只投递各自配置的结果。

自动执行仍保持每个先攻槽位最多一次。DM选中当前回合、已有未完成场景点命令的召唤物后，可用“再次执行场景交互”显式重试；按钮要求仍有普通动作，提交时再次检查当前回合、存活、控制权和命令身份，不清除自动执行检查点。伤害骰明确绑定执行亡灵。事务层的attemptId能力本身不等同于界面可重试；该DM入口另有实际双端验证。

带物品奖励或货币效果的点仍会拒绝执行，不会悄悄丢弃这些结果；它们的持有与投递、预备场景点及完整物品生命周期仍待接通。此局部能力不代表完整骷髅之舞或全书已验收。

预备场景交互沿用 `interact-point` 引用，可由 `ready` 物件命令选择。Host触发时重查场景并使用执行者自己的检定及伤害骰归属，消耗反应而非第二个动作；伤害、状态及日志结果随权威事务保存。准备回合身份用于防止重复结算，触发不改变实际先攻位置。物品与货币奖励仍显式拒绝，不能视为已经支持。

同伴场景交互的普通物品奖励现投递给实际执行者，使用实体持有物品及既有法术结束掉落流程，成功分支按数量发放并验证容量。结果补丁须与角色收据及回合资源一起保存。货币、魔法物品和容器奖励仍显式拒绝；本步不提供持有装备使用入口。地图物品可保存可选identified，进入角色背包后继续采用该背包的既有鉴定规则。

同伴实体物品支持Host保存 `wieldedWeapon: { proficient: boolean }`；每个生物至多一个该标记。现有入口限战斗外准备普通单手近战武器，熟练由DM明确指定。动作投射保留物品实例身份，自动同伴攻击命令优先使用持用武器，原生资料卡不改写。双手、弹药、护甲和战斗中换装等仍未覆盖，不能将本接口标记当作完整装备系统。

### 守卫预备动作的自定义条件

`command-owned-companion` 的 `command: "ready"` 可声明 `allowsReadyTrigger: true`。仍须提供 `ready.trigger` 默认文本及 `ready.actionKind`。玩家输入通过 `companionReadyTriggers[operationId]` 提交，Host 校验非空且不超过 320 字，并只替换触发条件；行动种类仍由模块声明。未启用此字段的固定条件不能被请求覆盖。取消输入或输入期间切换地图、回合、房间身份不会提交。此文本是可察觉触发条件的声明，不是自动执行的脚本；实际触发与反应消耗继续走 Host 的预备动作结算。

`launch-map-object` 可声明 `harmlessPush:true` 来移动无人持握的地图物体：必须使用零值 `amount`，不得声明 `savingThrowCheckId`。选择点位后，Host 从施法者到物体的位置计算向外方向，忽略客户端角度与俯仰；重量范围及距离仍使用 `limits`。这种模式遇到生物或实体边界停止，不产生豁免、冲击伤害或离图投射物。选中的分支须提供 point 区域目标。未声明该选项的投射法术保持原有有序豁免与撞击行为。

## 地面武器附魔（Activity）

`enchant-map-weapon` 操作通过 `effectId` 引用同一 Activity 的效果定义。选择地图武器时使用有明确 `placeRangeFeet` 的区域目标；可通过选项的 `targetOverride` 在角色库存与地图落点之间切换。Host 要求落点恰好对应一个登记为库存物品的地面对象，或怪物 `dnd5eCarriedObjects` 中标记为 `wieldedWeapon` 的物品，并核查距离、遮挡、数量为一、真实武器类别及实例唯一性。多个候选同格时拒绝歧义选择。普通绘图、天然攻击和未登记的装饰物不作为武器处理。

怪物持用物品的效果保存在该物品的 `objectState.inventoryItem.boundEffects`，不写入共享怪物目录。效果来源范围使用持用者的当前坐标；持用物品不会额外创建生物或加入先攻。专注结束后，地图提交会清理持用物品的对应效果。

目前地面效果支持专注持续时间、一个 `weapon-enchantment`（`weaponSlot:"inventory-item"`）及可选的 `emitted-light`。加值公式仅有施法者与施法环阶上下文；物品没有生物属性。不支持的状态、次数消耗、焦点绑定及其他生物机制会明确拒绝，不能通过这个操作默默略过。转换后的物品实例及附魔由 Host 保存，拾取后沿用同一实例；模块无需填写运行时物品 ID。

接口当前已有真实地面施法与双端刷新验证。完整法术验收仍需覆盖模块自身的资源、持续期、控制动作及失败提交；不能把操作可用视为整条法术自动化验收通过。


### 按地表材质豁免困难地形

Effect 的 `environmental-capability` 支持 `ignoreDifficultTerrainMaterials: ["ice", "snow"]`。材质取值为 `solid`、`sand`、`dust`、`loose-earth`、`gravel`、`stone`、`ice`、`snow`，数组必须非空、无重复。DM 可在地图地表材质中标记冰面或积雪；未标注时不会根据地图图片猜测。

该能力只豁免对应材质区域自身的困难地形成本，仍保留重叠其他困难地形、持续法术区域及独立减速成本。它不等于 `ignoreDifficultTerrain: true`。能力随状态保存与重载，在反魔法压制时失效；玩家、怪物的移动结算及移动预览使用相同材质筛选。


### 持续区域授予的束缚效果生命周期

`Dnd5eEffectDefinitionV1.bindToGrantingArea: true` 可用于仅包含 `restrained` 的效果。通过持续区域授予的活动执行时，Host 将本次新施加或刷新的束缚绑定到该区域的地图 ID、区域 ID 和来源 Token ID；未获得区域授权时拒绝结算。客户端不能指定绑定来源。区域结束后的既有跨地图清理可据此释放目标，不改变原区域的到期时间。此字段当前接入 `prepareDnd5ePluginFeatureAction` / `resolvePreparedDnd5ePluginFeatureAction` 路径；直接调用底层 Activity executor 不会替代地图生命周期绑定。

`grantedActivities[].activationWindow: "creation-turn"` 与 `activateOnCreate: true` 配合，将免费首次指令限制在 Host 记录的创建回合；探索模式使用同一 6 秒时段。区域的 `creationActivationScope` 为 Host 生成并持久化的数据。缺少创建时窗、跨时窗或已有使用回执时，后续指令仍可按正常动作费用执行，不再免动作。省略该字段保留旧模块行为。


### 区域控制释放旧绑定

`grantedActivities[].releaseBoundEffects: true` 表示此控制成功结算后，解除该授权区域先前绑定的束缚（含其他已加载房间地图和无地图角色卡）。配合效果 `bindToGrantingArea: true`，本次新施加的束缚绑定新版本，不会被同次清理移除。适用于更换抓取目标或移动施法造物；新目标豁免成功仍属于成功结算，会释放旧目标，非法目标或事务失败不发布版本变更。

Host 持久化 `area.boundEffectGeneration` 和 `effect.areaLifetime.generation`，缺省均为 0；客户端不提供或选择版本。当前仅支持通过 `pluginFeatureAction` 执行的区域授权控制及 `restrained` 效果，跨地图清理由既有房间权威生命周期协调器执行；未知或歧义来源地图仍保留效果，不能用纯 Activity executor 的通过结果替代整条链路验收。


### 有限效果的多次数消耗

Activity 可设 `effectGrantChargeCost: 2`（1–1000 整数，必须 `requiresEffectGrant: true`）。Host 从已注册定义取消耗，不接受客户端覆写；需要施行者自身的有限次数效果，余量不足或无次数池时拒绝。成功结算才扣指定数量，归零沿用 `endWhenEmpty` 清理；未声明字段保持原有每次扣1的行为。字段仅表达次数，不代表多次攻击/爆炸自动重复；每次命中与范围结算仍须单独配置和验证。


### Point projectile impact

An actor-origin point circle or sphere may declare `target.projectileImpact: "first-solid"` (one instance). The Host validates the requested anchor range, resolves the first mapped physical barrier, and recomputes the explosion footprint and occupants at that contact point. `anchorCell` retains the requested destination; `areaPlacement` contains the actual contact position. A small incoming-side propagation offset prevents a wall-contact explosion from leaking through the wall. This does not authorize arbitrary client impact coordinates or ignore explosion cover. Map UI preview and all consuming entry points require verification before claiming full automation.

### 原始占位捕获（部分接入）

`Dnd5eEffectDefinitionV1.captureInitialSpace: true` 在 Headless 施加效果时，根据 Host 地图、目标中心、实际占格宽度及占位高度写入 `ActiveEffect.initialSpaceBoundary`。缺少有效地图或占格数据会拒绝事务；模块不能提供边界坐标。此快照支持状态保存和恢复。该字段本身尚不实施视听阻隔、越界伤害或移动限制，不能据此将精神监狱标记为完整自动化。

上述原始边界已接入 Headless 生物间视觉及来源听觉判定：仅限制效果持有者，暂停效果不参与判定；听觉调用须传入 Host 地图 ID。地图视野渲染、空间实体分支和越界结算尚未完成，因此当前仍为部分实现。

`Activity.endsGrantSourceConcentration: true` 需配合 `requiresEffectGrant`。成功消耗单次授权时，Host 仅结束该授权效果记录的、仍匹配的来源专注；拒绝触发不走此结束路径。无专注 ID 的旧授权不会据此终止未知专注。精神监狱的跨界活动使用此能力；它不适用于“耗完次数后仍须保持专注”的法术。

### 堡垒供餐配置（结构 Activity）

`create-persistent-area` 使用 `utilityProjectionId: "mighty-fortress"` 时，可声明：

```json
"structureServices": {
  "mealTemplateId": "fortress-feast"
}
```

模板必须由已加载模块注册，类别为 `consumable`，且支持地图物品拾取。引用本模块 `items` 中的条目时使用本地 ID，运行时自动解析为模块命名空间；外部模板使用已注册的完整 ID。Host 在建筑创建时校验模板，将其保存到建筑服务记录；供餐请求仅提交建筑 ID、人数和预期战役日期，不能选择或覆盖物品模板。模板未配置时供餐面板禁用。食物的名称、消耗效果等由模板定义，不自动继承造粮术的变质规则。

施法时选择的仆役授权生物会随 Activity 创建写入服务记录。供餐每日最多 100 人份，食物与额度通过同一原子事务提交，重复请求不重复生成；物品来源标记在拾取、转交和丢弃中保留。此接口接线不代表坚固堡垒的 100 名仆役、内部布局及整条法术已完成验收。

### 区域豁免失败：来源力竭与显形光效

持续区域的 trigger 在声明 `savingThrow` 后可附加以下字段；只在该次豁免失败时施加：

```json
{
  "exhaustionOnFailedSave": { "levels": 1, "endsWithArea": true },
  "visibilityOnFailedSave": {
    "dimRadiusFeet": 5,
    "color": "#a3e635",
    "suppressInvisibilityBenefits": true,
    "endsWithArea": true
  }
}
```

`levels` 必须为 1–6 的整数，`dimRadiusFeet` 为 1–1000 的整数，颜色使用六位十六进制色值。两个 `endsWithArea` 以及 `suppressInvisibilityBenefits` 均须为 `true`。来源的地图、区域和施法者身份由 Host 提供，模块不能用自填来源身份移除其他区域的效果。普通力竭和各区域贡献分开保存；来源结束只清除自己的贡献，不回滚已经受到的伤害。力竭免疫阻止力竭增量，不阻止独立伤害和光效。达到四级时最大生命值减半，解除后恢复最大值但不治疗；本区域增量达到六级时接死亡处理及死亡防护。

显形光效抑制隐形带来的相关收益，保留原隐形状态，结束时可恢复其收益；它本身不赋予额外攻击优势。区域自身照明仍应单独声明 `lighting`。首次进入和回合开始若共享每回合一次的限额，必须声明相同的 `frequencyGroup` 和 `oncePerTurn: true`。绕角传播由区域目标的 `spreadsAroundCorners: true` 声明，不代表可以穿透封闭墙体。

区域目标可用 `propagationCover: 'opaque-only'` 声明从区域起点传播时只受不透光实体屏障阻挡。该策略检查同一屏障的视线与效果线阻挡能力：透明实体墙和仅遮蔽视线的雾不触发此排除，二者也不组合成一堵不透光墙。映射墙、门及持久区域采用相同策略，保留高度和开关门处理。这个字段不放宽施放者到落点的 `requiresLineOfEffect`，也不等于施放者必须看见每个目标。

可选资源消耗应放在 `consumption` 中：`{kind:'resource',resourceId:'module:energy',amount:{kind:'constant',value:2},consumeOn:'resolve',whenChoice:{choiceId:'power',optionIds:['two']}}`。`whenChoice` 必须引用已声明的非空、无重复选项；所选成本每次执行只提交一次，包括空区域和多个目标。不要把施放成本写为逐目标 outcome 的资源操作，否则会随目标数量重复提交。选择项可另外声明资源最低值，提前过滤无法支付的选项；最终资源余额仍由 Host 提交时校验。

这些字段已通过本地来源清理、持久化，以及独立包和累计包的实际双端施放、失败豁免、刷新、玩家主动结束专注后的清理验证。浏览器验证一个怪物目标；高等级力竭、跨地图清理和绕角等边界由本地测试覆盖。光效状态同步已验证，未声称逐像素照明渲染认证。全书认证仍未完成。


### 矩形范围灭火（验收进行中）

extinguish-area-flames 操作接收 groundSpreadFeet（0–1000），要求声明具有显式高度的 rect 区域。Host按实际缩放、旋转后的矩形处理明确火源与受保护标记，返回Token变更及geometryLightUpserts，由既有地图事务提交；不依赖生物目标数量，也不制造强风区域。受保护火源和显式非火照明不变。

灭火外扩距离从实际矩形边界计算，不累计绕墙的路径长度；障碍连通性检查仍限制在该外扩范围内。当前已验证矩形体积、绕墙角与燃烧蛛网格清理，并补充按地形边界分段的贴地线效检查：允许低地传播，保留实体突起阻挡。导入施放灭火已有一次限定双端验证；最新地形改动、完整条目及累计包仍待最终验收。不要将此接口的存在视为潮涌或全书已经完整自动化。

### 每个不同目标独立的伤害骰

`damage` operation 可声明 `perTarget: true`，用于对不同生物分别攻击、分别投掷伤害的 Activity。此时 `target` 必须为 `target`，Activity 必须使用 creature 目标且不能启用 `allowDuplicateTargets`；不能与 `perProjectile` 混用。省略此字段保留原有共享伤害池行为。

例如 `{ "kind": "damage", "id": "damage", "target": "target", "perTarget": true, "critical": "double-dice", "damageType": "force", "amount": { "kind": "dice", "rollId": "damage", "count": 6, "sides": 10 } }`。运行时骰值键为 `damage:<targetId>`；普通命中要求六颗 d10，重击目标要求十二颗，未命中不需要伤害骰。客户端与 Host 使用相同的目标结果推导骰子数量；不能用共享 `damage` 骰替代目标骰。每次命中的目标分别结算，只有对应目标的攻击重击才翻倍。导出保留此字段；静态编译读取未展开的骰子声明，运行时需要实际目标列表。

Creature 目标可使用 `rangeOrigin: "granting-area"`，让 `rangeFeet` 从授予当前活动的 Host 区域锚点计算，而非区域边缘或施法者。必须有真实、自有、有效的 persistent-area 授权，不可与物品 `effectOrigin` 混用。Host 准备流程按区域锚点与目标占据空间计算水平及高度距离；球体中心高度为底面高度加半径。实际施法生成区域与界面完整流程仍需逐条验收。



### 可逆材质体积转换（`materialTransformation`）

`create-persistent-area` 可以声明由 Host 执行的材质转换。公共声明只描述规则；原始地形、恢复记录和落泥高度由 Host 从当前地图生成，不能由模块或玩家提交。

```json
{
  "kind": "create-persistent-area",
  "id": "material-volume",
  "label": "材质转换",
  "durationRounds": 1,
  "permanent": true,
  "concentration": false,
  "anchorMode": "fixed",
  "materialTransformation": {
    "mode": "ceiling-rock-to-mud",
    "depthFeet": "selected-height"
  }
}
```

- `mode` 支持 `rock-to-mud`、`mud-to-rock` 和 `ceiling-rock-to-mud`；`depthFeet` 为正数或 `selected-height`。
- 目标须为固定的 `rect` 或 `cube`，宽、长、转换深度各不超过 40 尺；`mud-to-rock` 的转换深度不超过 10 尺。
- 地面两模式要求 `groundOnly: true`、`requireNonmagicalSurfaceMaterials: true`、`requireAllSurfaceMaterials: true` 和相应 `surfaceMaterials`。选择高度是转换体积的顶面，深度向下延伸。
- 天花板模式不得声明地面材质字段或地面放置限制。选择高度是源岩石暴露底面，转换深度向上延伸。Host 仅转换显式标为非魔法的岩石，并按地面、实体平台和楼梯坡度生成下落范围。
- `materialTransformation` 本身不自动添加伤害、豁免、移动成本或束缚。模块应通过区域 `triggers` 等独立声明这些规则；天花板的一次落下效果使用 `on-create`，需要防重复时加 `oncePerTarget: true`。
- 如规则要求能看见目标，应在目标声明中设置 `requiresLineOfSight: true`；各模式的 `targetOverride` 也需保留这一要求。
- Host 必须支持地形与区域的原子提交。地图材质未知、源几何不符合转换要求、恢复碎片被其他编辑改动时会拒绝，不从背景图片推测材质。
- 解除转换通过 Host 保存的恢复记录还原原始体积。共享给玩家的 `materialTransformationAvailable` 只是选择提示，不构成恢复权限。斜面泥浆与下落范围由运行时持久化，模块不应自行填写这些内部字段。

### 区域授予的岩石投射能力（验收中）

单生物目标可声明 `requiresInsideGrantingArea: true` 和
`mappedObjectOrigin: { naturalFeature: 'rock', withinGrantingArea: true }`，并设置 `count: 1`。
能力必须由当前施法者拥有的有效持续区域授予。目标和岩石都必须在该区域内；
如目标必须可见，另设 `requiresLineOfSight: true`，该视线仍从施法者判断。

DM 在地图物体中显式设置 `naturalFeature: 'rock'`、`attached: false`、
`wornOrCarried: false`；未知信息不等于合格岩石。玩家/DM 先选择岩石，再选择目标。
请求只传 `mappedObjectOriginTokenId`，Host 从当前场景重新读取岩石与区域，
不接受客户端指定来源坐标。攻击加值仍属于施法者，掩护与伤害路径使用岩石位置。

伤害操作可显式设置 `magical: false`，即使能力由法术授予，也按非魔法伤害进行防御结算。
省略该字段保留来源的默认属性。此接口当前有本地导入、几何和交互测试；
整条法术的实际双端生命周期验收仍在进行，不表示任意自定义投射机制均已覆盖。

攻击检定可用 `attackType: 'spell' | 'weapon'` 显式指定攻击类别，`delivery` 仍表示近战或远程。
由特性或持续区域授予的法术攻击应声明 `attackType: 'spell'`；它与伤害操作的 `magical` 独立。
例如岩石投射可以同时是远程法术攻击和非魔法钝击伤害。界面后续骰值规划与执行器使用同一类别选择掩护防御。
省略攻击类别时保留原有来源推断，以免改变既有模块。

### Resource grants for native adjudicated spells

`Dnd5eAdjudicatedSpellPayload.alternateResourceSpell` accepts the owned feature ID and grant ID, like the structured spell route. The Host validates the installed grant, selected spell and level, class/subclass eligibility and resource balance. It waives materials only when the grant declares that waiver; verbal/somatic requirements remain. The resource replaces the spell slot and cannot be combined with a caller-supplied casting class or ritual request. A grant does not insert the spell into the character's prepared list. The ordinary player fallback now forwards this reference. This enables resource settlement, not missing spell effects: a sensor or other mechanical outcome still needs an implementation and end-to-end acceptance.

### Exclusive sensor senses

A source-derived effect token can declare `sensorSense: 'sight' | 'hearing'` with both `visionFromSource: true` and `hearingFromSource: true`. Omission retains the existing combined-sense behavior. An owned area-granted Activity can use `set-granting-area-senses` with `mode: 'projection-sight'` or `'projection-hearing'`; declare its action cost in the Activity. The Host checks the granting area's owner and the sensor's capabilities. The selected sense survives map persistence. Hearing mode contributes no visual, darkvision, truesight, blindsight or tremorsense coverage; sight mode fails remote-hearing checks. These primitives do not by themselves implement Clairvoyance placement, casting time, range, concentration or its source feature's resource grant; those need explicit content and acceptance.

### 法术落点的 Host 事实确认

点选范围法术可以声明 `target.placementQualification: { prompt: "该地点是否熟悉或明显？" }`。目前仅用于 `legacySource.kind: "spell"` 的法术准备入口；普通特性声明会被拒绝。Host 在开始长时施法之前收集确认，并在结算时复验本次请求、施法者、地图、落点、高度、选项和法术参数。取消不开始施法；JSON 序列化不能携带确认，可信 Host 事务克隆可以保留。此声明只确认叙事地点事实，不取代射程、视线、持续时间或其他机械校验，也不提供跨地图距离推断。

仅通过授权使用的插件法术可将 `classes` 设为 `[]`。它不会进入普通职业学习列表；Host 的插件施法入口只接受已校验归属的种族天赋或替代资源施法授权。普通已知、已准备或魔法奥秘选择不能赋予此法术施放资格。该规则不影响 `classes` 非空的既有职业法术。

### 狂暴首次命中保护

子职被动能力可声明 `mechanic: { kind: 'rage-first-hit-protection' }`，配合 `trigger: { kind: 'passive' }`、`targeting: { kind: 'self' }`、`effects: []`。Host 按所属职业等级与子职资格验证来源，在狂暴期间自己回合首次攻击命中生物时自动记录目标；未命中、攻击物体、回合外攻击不触发。被标记者攻击来源之外的目标具有劣势；攻击命中其他生物时，对应攻击伤害获得抗性，按既有抗性规则合并，不重复减半。标记在来源下回合开始或狂暴结束时失效。

此机制固定采用上述时序，不接受额外资源、骰子、选择、条件或自定义持续时间，避免导入声明了实际不会执行的附加规则。Host 的 `rageAttackMark` 与 `rageAttackMarkUsedTurnKey` 属于持久化结算状态，不由玩家请求提供。当前已验证真实导出重导入、本地攻击结算、玩家攻击后两端徽章及刷新恢复、被标记怪物攻击第三者时的劣势与抗性，以及来源下一回合的双端清除。该范围不代替完整子职及其他能力验收。

永久游泳速度可使用 character-capability 的 swimSpeedMinimumFeet（0–1000 整数，0 不授予）；它保留更高的原速度，并应用移动限制与力竭。子职业 passive-defense 可声明 swimSpeedMinimumFeet（1–1000）及 canBreatheWater，由能力等级与 subclassChoices 控制资格；导出时转换为永久 Effect，供角色和 Headless 一致读取。

### 狂暴开始事件与状态条件

Activity 的 `invocation.event: "rage-start"` 由 Host 已提交的进入狂暴事件产生，仅授权该狂暴角色；狂暴结束不触发。首次附带效果可声明 `activation.kind: "free"`，避免再次消耗已经用于狂暴的附赠动作。后续主动能力单独声明附赠动作消费，并用 `requirements: [{kind: "rage-state", subject: "actor", active: true}]` 检查 Host 当前狂暴状态。该条件也支持 target；缺少权威状态时不满足条件。具体范围、目标、伤害和生命值仍由 Activity 声明并接受现有 Host 校验。

### 子职选择的升级替换

子职 `choiceGroups` 可声明 `replaceOnClassLevelGain: true`。所属职业每升一级，升级面板允许保留现有选择或替换至多一个选项；其他职业升级不开放该组。已选择的组在人物卡常规编辑中锁定。此字段不授予额外选项，原有选择上限和资格检查仍然生效。

### Touch ignition of one unattended object

An Activity may declare `{"id":"touch","kind":"control-map-flame","change":{"kind":"ignite-touch"}}`.
The existing shared object picker returns one light/fuel ID. Host rechecks explicit
`controlledFlame.fuelAvailable: true`, `custody: "unattended"`, and an unlit physical
fuel object, then checks 5-foot reach from the actor's body and an unobstructed effect
line using current scene geometry. Names, colors, and absent custody are not fuel facts.
Carried or worn objects are rejected. Other objects in the same cell remain unchanged.
Ignition is a physical change without a timed expiry. The declaration's action cost,
class qualification, and environment choice belong to its Activity/feature definition.
The caller must commit the map change and action expenditure together only after the
selection remains valid; cancellation or a stale choice must not spend the action.
This interface's local coverage does not certify the entire importing feature.

### Source-bound conditional resistance

`conditional-damage-resistance` accepts optional
`sourceAura: { radiusFeet: 10, requiresRage: true, requiresLineOfEffect: true }`.
The Effect's Host-bound `source.actorId` identifies the aura source; a package must
not supply a replacement actor ID in `sourceAura`. Damage settlement rechecks the
source, its current rage state, map-derived distance, and directed line of effect.
Missing source/distance cannot grant resistance. The same check applies to weapon
and direct Activity damage, and the metadata survives Effect serialization.
When rage ends in the combat state, rules requiring that source's rage are removed
from its recipients. Other sources and unrelated modifiers on mixed Effects remain.
This field does not select beneficiaries. Recipient selection, map presentation,
and the importing feature's full lifecycle still require integration and validation
before that feature can be marked fully automated.

### Feature-owned spell invocation (provisional)

An Activity that casts an installed spell as part of a feature can declare
`spellInvocation: { spellId, castAtLevel, operationIds }`. The listed operation IDs
must exist in that Activity and must identify only the spell's effects. Keep the
feature's own activation effects outside this list. Action economy and resource
costs remain explicit Activity consumption; this field does not spend a spell slot.

Host checks the installed spell and casting level, applies spell-turn restrictions,
collects spellcasting gates and Counterspell, and records the spell-cast event.
An interrupted invocation removes the listed effects and their exclusive checks;
independent feature effects and declared costs remain. Checks still required by
independent feature outcomes remain required. Reaction/save values are collected by
Host, not trusted from a player payload. Preview does not consume resources.

This interface is provisional: its full client interruption flow is still under
acceptance testing. Component rules, source attribution for operation kinds other
than applied effects, and complex shared/check dependencies require explicit
integration and verification before certifying a new feature. Declaring this field
alone is not evidence that every rule of an arbitrary spell has been implemented.

### Concentration timing for declared effect activities

For a concentration effect with `duration: { kind: "rounds", rounds: 10, expiresAt: "source-turn-start" }`, both feature-owned and spell Activity execution retain the declared source-start boundary. The creation turn is excluded; the tenth subsequent source turn start ends concentration and removes linked grants. The Host persists the last processed turn key to avoid duplicate ticking after reload. An omitted/source-end boundary keeps existing source-end behavior. A concentration group mixing effect boundaries, or including areas, summons, or transformations, currently retains source-end timing; this is not a declaration of support for independent mixed deadlines. Ending or replacing concentration clears the boundary receipt.

### 制作仪式的产物选择

`exchange-inventory-items` 可以声明可选的 `templateOptions: string[]`。列表必须包含默认 `templateId`，不能有重复项，最多 1000 个已注册物品引用；导入时本包引用会与默认产物一同加上包命名空间。未声明时继续使用固定产物。

玩家选择通过 `inventoryExchange.outputTemplateId` 提交，Host 只接受列表内的标识，再按 `policy` 校验材料标签、非魔法资格、总价值上限及等值消耗。选择不会携带物品规则或价格。产物标识随仪式记录持久化；完成时改选产物会被拒绝，须取消后重新开始。界面在超过八个可选产物时提供搜索。此接口不为缺少价值或材料事实的任意物体编造数据，内容包需先注册相应物品。

制作仪式可用 `templateSource: "registered-items"` 或 `"registered-ammunition"` 替代 `templateOptions`。前者筛选非弹药，后者仅弹药；两者互斥，均由 Host 当前安装的物品模板与 `policy.outputTags` 校验，继续执行价值上限、非魔法资格、数量、原件和等值材料校验。客户端必须明确提交 `inventoryExchange.outputTemplateId`，不能自行提交材质事实。新导入且满足政策的物品自动进入选择列表；已开始仪式仍锁定准确产物，不能中途替换。模块作者应给经过确认的金属物品标注 `spellcastingMaterial.tags: ["material:contains-metal"]` 并提供实际规则价值；未确认材质的物品不要加此标签。

施法者侧条件治疗骰候选接口：子职被动机制 `spell-healing-dice-maximum` 的 `targetHp: "zero"` 仅作用于该施法者对当前 0 HP 目标的法术治疗骰。Host 核对能力归属及子职等级；固定加值保持原值，非施法能力不因此获得最大化。它与受治疗者侧的 `maximize-healing-dice` 不同。当前有原生治疗与 Activity 结算测试；多阶段治疗及完整来源能力仍需独立验收，不可仅凭此机制将整个能力标为完成。


### 持续侦测的隐私与回合期限

core.persistent-detection 新增 mode=undead-presence：仅查询范围内未受预言防护且未受物理遮挡的亡灵，战斗日志仅报告存在与否，不显示身份或能力。range-feet 指定范围。duration-mode 默认为 concentration（保留原行为）；source-turn-end 配合 duration-rounds 可创建非专注的来源回合结束期限。它不会自动消耗动作或职业次数；Activity 必须明确声明 consumption 和 resource requirements，由 Host 校验并结算。


### 从事件目标计算治疗量，另选受治疗者

healing 可声明 recipientChoice: { choiceId, rangeFeet }，关联 optionsFrom=combat-creatures 的选择。Activity 必须是单生物目标且没有远程效果原点；amount 中的 target 引用仍指 Activity 原目标，治疗交给所选生物。Host 从完整战斗快照复核选择、距施用者的距离及死亡状态；未知对象、距离未知或超距、尸体均拒绝。该接口不自行建立死亡触发或使用频率限制，仍需显式声明 invocation 和相应资格约束。


生命骰公式支持 d4/d6/d8/d10/d12/d20。Host 可从已注册怪物资料的单一生命骰表达式读取总数，供 `actor-hit-dice` / `target-hit-dice` 的 `maximum` 使用；固定体质加值不计入骰数。此只读总量不产生 `current`，不增加可消耗生命骰；缺少当前池时读取 `current` 仍失败。已有实际池优先。未知资料或非法生命骰表达式不从 HP/CR 推断。

公开 Effect 可声明 `removalAction: { label: "结束效果", economy: "free", selfOnly: true, maxDistanceFeet: 0 }`。免费解除仅允许效果承受者本人，不能附带 `abilityCheck`；非法声明会被拒绝。普通解救仍使用 `economy: "action"`。Headless 结算与玩家请求准备支持免费解除；玩家面板及非本人回合的请求路由已接入，并验证归属、当前战斗快照及防重放；托梦实例已通过探索及非本人回合的实际玩家点击、双端同步和刷新验收；这不代表其他使用该接口的能力自动获得完整验收。

### 降至零生命值时的被动执行

`self-dropped-to-zero` 指持有者自身从正生命值降至零，包含普通伤害和直接归零效果；已为零时再次受伤不触发。它与攻击者的 `creature-dropped-to-zero` 分开。此类特性可声明 `usableWhileIncapacitated: true`，但必须使用 `free` 激活、`self` 目标和对应的 triggered invocation。许可只在 Host 处理已提交事件的同步执行范围内有效；客户端直接提交相同 Activity 或触发上下文不能绕过失能限制，死亡角色不能借此行动。也支持 `self-involuntarily-incapacitated`：状态施加必须由 Host 明确记录 `involuntary: true`，并且实际由可行动变为失能。自愿、意愿未知、免疫、已失能后的重复施加均不生成该事件。目前怪物豁免失败后的标准状态入口已记录该事实。扩展 Activity 的失败豁免分支也会按目标生成该事实并传入 apply-standard-condition / apply-effect；明确自愿目标和 allied-unresisted-failure 不视为非自愿。其余未接入的来源不自动推断。

### 特性获得召唤法术效果

召唤 operation 可声明 `spellEffectSourceId`，例如 `conjure-animals`。它用于法术召唤加成资格与保存后的来源识别，不表示施放该法术，不发出 spell-cast、不触发反制、不自动消耗法术位。数量、持续时间、专注、范围和特性资源仍须由 operation/Activity 明确声明。普通施法继续使用原有法术入口；特性实际施法继续使用 spellInvocation。

### 解消临时召唤

`dismiss-owned-temporary-summons` 接受 `sourceActivityIds`（1–16 个不同的来源 Activity ID）。Host 按当前角色、同一模块、指定来源且非 persistent 的召唤物生成解消事件，由地图发布与生命周期清理移除。费用由 Activity 自己声明；免费解消可用 free 激活且不声明资源消耗。它不解除永久伙伴契约，也不授权失能角色执行普通动作。

### 区域侦测与被动察觉

持续区域的 creatureDetectionAdvantage: 'source-and-allies' 按被侦测生物是否处于区域内判定，观察者可以在区域外。带明确生物目标的主动检定沿用优势骰；普通躲藏及职业附赠动作躲藏的对抗使用逐观察者、逐目标计算的被动察觉，优势 +5、劣势 −5，抵消后不调整，同类优势不叠加。区域到期、移除、来源失能或魔法被压制后不再授予该优势。未指定生物的普通区域搜索不会据此获得统一优势，以免对区域外生物或物体错误加值。

### 被动升级与已有 Activity 分支的关联

当一个被动子职能力的全部机械效果已经由同子职另一个能力的 Activity 高等级分支执行时，可在被动能力上声明 `activityOutcomeReferences: [{ activityId: "area", outcomeId: "upgraded" }]`。这是验收报告用的关联，不会增加动作、触发器或重复执行效果。

报告会核查每个引用：Activity 必须属于同子职的另一能力，引用分支必须存在且有操作，分支必须以所属职业 `class-level` 的 `minimum` 等于该被动能力等级、无 `maximum` 的条件启用，整个 Activity 必须通过完整自动化分析。引用能力还必须是没有额外成本、效果、条件或钩子的自身被动摘要。任何一项不符都会保留手动状态；名称、说明和作者写的 `full` 不能替代这些检查。复杂等级条件目前不在此关联识别范围内。

固定语言和生物类型交流授予可使用与被动能力同 ID、同等级的 `build-grant`，分别授予 `language` 与 `creature-communication` 标签。此处的完整自动化指语言和交流资格的机械判定，不代表自动生成对话或决定生物态度。

### 限定武器的魔法攻击资格

`passive-defense.weaponAttacksMagical` 可附带 `weaponBaseIds` 和 `attackMode`，例如 `{ while: "always", weaponBaseIds: ["dnd5e-longbow", "dnd5e-shortbow"], attackMode: "ranged" }`。Host 用实际装备攻击快照中的基础装备 ID 匹配，背包实例 ID 不影响判断；缺少匹配上下文时不授予资格。此配置只改变当前武器攻击的魔法伤害来源判定，不把物品永久改为魔法物品，也不增加命中或伤害数值。等级与子职资格仍由能力本身控制。未设置筛选的既有规则保持原语义。

### 命中附伤与豁免后的武器减伤

命中触发 Activity 可将额外伤害与一次目标豁免合并进原攻击：第一个 outcome 为 always、仅对命中目标造成伤害；第二个 outcome 以该 saving-throw 失败为条件，仅对目标 apply-effect。当前支持一个 per-target 豁免，以及 stacking:replace、1轮、source-turn-start 到期、单个 weapon-damage-multiplier 的效果。该倍率作用于武器攻击，不作用于法术攻击。伤害骰 critical:double-dice 继承本次命中的重击。

Host 在玩家确认后请求骰值，豁免由目标掷骰，host-derived 模式读取目标实际优势/劣势；取消不掷骰、不扣资源。附伤与原攻击合并为一次伤害提交和一次专注检查，已处理的 Activity 在后续命中事件中跳过。该支持范围不表示所有含豁免和效果的命中 Activity 都可原子结算；其他结构仍需单独验证。

### 视觉距离上限

Effect modifier `{kind:"sight-range-limit",rangeFeet:5}` 限制受影响者的视觉距离，不添加 blinded 状态；多项上限取最小值。普通视野、黑暗视觉、真视和场景照明不能越过这个上限，盲视作为非视觉感知独立判定。Host 目标判定、地图点可见性、个人遮罩和服务端角色过滤共用限制；关闭动态视野也不跳过角色过滤。用 effect.magical:true 显式声明魔法效果，持续时间由普通 Effect duration 控制，暂停/移除后恢复。命中提交前适配器支持一次目标豁免失败施加单个 sight-range-limit，结构与上一节武器减伤相同。


运动检定解除：Effect 的 `removalAction.abilityCheck` 支持 `skill: "athletics"`，通常配合 `ability: "str"`。声明 `economy: "action"` 和接触距离后，可由承受者或范围内其他角色花动作尝试；Host 使用解除者的运动熟练加值，失败也消耗动作，成功才移除指定效果。DC 在应用效果时计算并保存。此接口不自动包含移动触发伤害或再次施放替换旧目标。


武器命中合并结算还支持受限的关联持续效果组合：单个 always outcome 内按顺序声明目标 damage、actor remove-effect（source:self）、actor apply-effect 控制器、target apply-effect 关联效果。控制器和目标效果均 replace、1–100 回合并在 source-turn-start 到期；目标通过 sourceRequiresEffectSameApplication 绑定本次控制器，modifier 为恒定非正 speed/add，可携带 grants 和 removalAction。此路径由 Host 完整解析后提交效果，伤害和资源留在原攻击中合并，避免重复扣血/专注。其他效果组合仍需单独支持和验收，不代表任意 apply-effect 都可合并。


怪物控制栏也支持带 abilityCheck 的动作型 removalAction：按当前效果显示解除入口，以声明技能计算检定，成功/失败均消耗动作，成功移除指定效果并同步地图。无需额外声明 restrained 或重复添加 escapeCheck。玩家协助解除仍走基础动作面板的目标效果选择。

指定魅惑对象：`apply-effect.charmedSourceChoiceId` 引用 `optionsFrom: "combat-creatures"` 的选择，且 Effect 必须只含 `charmed` 条件。Host 拒绝缺失、不在场、目标自身及预注入 condition-entity 标签；此字段不能与 frightenedSourceChoiceId 同时声明。状态所指生物来自选择，但效果作者、归属和 source-turn-start 持续时间仍属于施加者。该接口本身不声明选项距离、盟友资格或伤害提前解除规则，内容必须分别配置并验收。

仅由选定状态对象触发的提前解除使用 `breakOn: ["attacked-by-condition-entity", "damaged-by-condition-entity", "forced-save-by-condition-entity"]`，按需要选取。Host 将已提交事件的行为者与 condition-entity 绑定比较，不扩大到作者或同阵营其他生物；没有绑定时不推断。攻击未命中也触发攻击条件，零伤害不触发伤害条件。同一事务新加的效果不被此前的攻击或伤害追溯解除。

选择对象与受影响目标之间的距离可用 `apply-effect.conditionSourceMaximumDistanceFeet` 限制，须搭配 charmedSourceChoiceId 或 frightenedSourceChoiceId。两条 Host 路径均从权威生物距离表取值；缺少距离、非有限值、负值或超距均拒绝，不读取玩家 payload 的距离声明。此字段不是施加者到目标的射程，也不自动要求盟友关系。

装备伤害绑定（目前仅 Executor 和注册 Activity 的 Host 入口）：`damage.equipmentWeaponDamage: { rollId, weaponBaseIds, multiplier?: 1 | 0.5 }` 使用 Host 独立提供的装备伤害快照。`amount` 是额外伤害公式，先与武器骰及固定加值合并，再应用 multiplier 并向下取整；`damageType` 须为 `inherit-primary`。不得混用 `weaponDiceFromTrigger`、伤害类型选择/查表或暴击加倍。命令中的同名快照不可信，缺少 Host 快照会拒绝执行。此接口尚未接通地图攻击替换、自动武器骰请求与单次攻击/弹药消费，不能据此将穿梭矢声明为完整自动化。

Host 准备骰子可向 `collectDnd5eActivityFormulaRollDeclarationsV1` 的第五参数传入同一可信装备快照（底层 collector 为 options.equipmentWeaponDamage）。收集器与 Executor 均先应用等级进阶，再拼入武器骰，因此 scaling 只修改声明的额外伤害，不增加实际武器骰数。静态编译时没有装备快照的声明不代表完整运行时骰子请求；地图入口仍须完成该快照接线。


### 追加攻击的原目标约束与弹药复用

`grant-weapon-attack.differentTargetWithinFeetOfEventTarget` 将授权绑定到Host攻击事件的原目标，只允许该距离内另一目标；地图准备和Headless提交都会校验。`reuseMissedProjectile: true` 仅支持一次附赠攻击，并必须同时声明原目标距离限制。它要求Host事件为远程弹药攻击未命中，绑定具体weaponId，成功复用时不再次消耗弹药。客户端不能提供原目标或复用凭据。

可用 `{kind:"attack-magical", magical:true}` 限定Host认定的魔法攻击；事件未提供该事实时不满足条件。以上接口已有本地集成验证，完整原攻击数值快照及曲射双端验收尚未完成。

### Recent creature sighting qualification

Creature targets may declare `requiresSeenWithinSeconds: 60` (integer 1–60). The Host checks current perception or its own timestamped sighting history for the actor, target and current map. An unseen target without a valid scene clock or unexpired record is rejected before spending resources. This condition does not grant line of effect, a homing route, target coordinates, or permission to ignore cover; those mechanics require separate implementation. The current recording hooks observe projected creatures when a timestamped map snapshot is constructed; continuous observation of every scene creature is not yet certified.

### Equipment homing projectile (partial)

`equipmentHomingProjectile: true` declares a single-creature equipment replacement Activity. The registered Host authority computes reachability from its scene and equipped ranged weapon maximum range, without accepting path claims from the command. No route or an overrange route consumes the shot's declared resources and attack/ammunition budget, with no checks or outcomes. Preparation uses the equipment origin rather than applying ordinary straight-line weapon restrictions to the destination. Current implementation supports same-elevation routes only; differing elevations are rejected pending volume search. This does not implement a hidden-target selector, failed-save location disclosure, or UI dice-prompt suppression for a vanished arrow.

Activity 操作 reveal-target-location（target: target）由 Host 保存一次性的目标位置到施术者 knownCreatureLocations；不能提交坐标，不授予视野或持续定位。记录仅所属角色和 DM 可读，其他角色与公开 Token 投影移除。可放入豁免失败 outcome，界面可本地查看历史位置。


### 放弃优势换取同目标追加攻击（待完整双端验收）

DeclarativeAbility 的 `mechanic` 可声明 `{kind:"advantage-for-extra-attack",requiresOwnAttackAction:true,bindSameTarget:true,usesPerTurn:1}`，配合 `trigger.kind:"before-attack-roll"`、自身目标及无动作消耗。投骰前由拥有者选择，Host 核验实际优势、自己的攻击动作及本回合使用记录；客户端不能通过声明优势或传入较高骰值获得追加攻击。

成功交换后，Host 保存绑定原目标的免费追加武器攻击授权，不消耗附赠动作。它不是任意目标攻击授权，也不是获得一个完整攻击动作。导入、资格拒绝、同目标约束和次数限制已有本地测试，完整玩家界面闭环仍在验收，不应仅凭声明通过就标记全部自动化完成。

### 降至零生命时插入回合（partial）

`mechanic:{kind:"zero-hit-point-extra-turn"}` 要求 `trigger.kind:"before-drop-to-zero"`、自身目标、`cost.economy:"reaction"` 及显式 `cost.resources`；不得另加 `limits` 形成重复次数账本。次数恢复由相应资源声明管理。

Host 在最终伤害使正生命降至零、且不符合直接死亡条件时请求拥有者选择；缺资源、无反应或受伤前已失能时不提供选择。接受结果在同一未提交伤害事务中扣费，保存暂停回合并开始一次性额外回合；缺少回合开始所需骰值时保持待结算，不能提前发布角色结果。声明方不得直接写入 `zeroHitPointExtraTurn` 或 `interruptedTurnResume`，两者是 Host 生成的恢复状态。

额外回合允许在零生命时行动，后续零生命伤害仍累计死亡豁免失败。结束时若仍为零生命则恢复相应倒地状态，并恢复被中断回合的预算；刷新重载必须保留恢复凭据。当前具有本地单目标、范围多目标与嵌套恢复证据，三端闭环仍在验收；现有引擎对玩家巨量伤害直接死亡的策略差异尚待解决，因此不得据此声称规则全部通过。

### 同一次豁免伤害中的多个类型（damageGroup）

单目标 `damage` 操作可用相同的 `damageGroup: { id, multiplier: 0.5 | 1 }` 声明同一次伤害。组内各操作的 `amount` 保留完整伤害，成功豁免由组倍率减半；不要再在公式中减半或给 `equipmentWeaponDamage` 设置半伤倍率。组内须为同一 outcome 中相邻的 2–16 个操作，目标均为 `target`，使用相同的 magical 声明与倍率；组 ID 在不同 outcome 间不可重复。

Host 在一次扣血事务中逐类型应用免疫、抗性与易伤，保留未取整分量直到合计，输出每个操作的原始骰值记录。比如 9 穿刺加 3 力场、成功豁免且无防御时扣 6 点；仅穿刺免疫时扣 1 点，不能把免疫类型的小数转移给其他类型。单独伤害操作保持原有行为。

当前接口只接受一个生物目标、豁免检查或无检查，不支持逐弹、多目标、攻击检定、授予者归因、致死身体操作或引用组中单项伤害来治疗。其余形式应单独建模，不能用此声明声称已支持。分量分别显示骰值，但一起扣血；底层 `resolveDnd5eDamageGroup` 的分量结果可含小数，不能逐分量提交 HP。


### 疾风连击使用后的回合内加速

`attack-action-speed` 的可选 `triggerOn: "flurry-of-blows"` 将触发点限定为 Host 成功消耗气与附赠动作使用疾风连击。`disengage: true` 同时赋予本回合撤离；此字段仅允许与该触发点配合。`bonusFeet` 增加步行速度，使用既有回合结束清理与同源刷新规则，不叠加重复加速。省略 `triggerOn` 保留原攻击动作触发行为。

声明仍为 `trigger: {kind: "passive"}`、自身目标和无额外成本，气与附赠动作由疾风连击本身扣除。无需另建激活动作。当前已验证导出重导入、2/3/6级界限、疾风连击与普通武艺区分、未命中触发、资源不足拒绝与序列化后到期；地图和双端验收仍待完成。


### 疾风连击的可选额外攻击

子职可声明被动 `mechanic: { kind: "flurry-extra-attacks", additionalAttacks: 3, distinctTargets: true }`，配合 `trigger: passive`、`targeting: self`、无独立动作成本。该能力不会增加攻击动作的攻击次数。Host 校验实际子职、职业等级及特性归属；普通两次疾风连击保留原行为，选择三至五次时要求全部目标不同。整组消耗一次附赠动作及一点气，震慑拳等附加成本按实际攻击数计算。玩家界面提供额外目标复选框。地图入口和 Headless 拒绝重复目标、超过上限和低等级的额外攻击；仍待实际双端浏览器验收。

特性可以通过永久 `character-capability` 声明 `inherentLight`，值为 `{brightRadiusFeet:30,dimRadiusFeet:30,color:'#ffdd88',disabledByEffectTag:'your.module:light-off'}`。拥有且满足资格的角色默认发光；地图显示与Host照明投影均使用当前资格，失去特性、卸载模块或不再满足职业等级会清除派生光源。该能力是魔法光，不默认视为日光。关闭标记独立保存在活动效果中，避免刷新后重新开启。

派生光源的标签为 `feature-light:<完整特性ID>`。开关Activity需要声明自己的动作成本：关闭时移除该光源标签并施加关闭标记；开启时移除关闭标记和旧光源，再施加同标签的emitted-light效果，使当前Headless事务立即生效。下次角色/地图投影会从资格重新生成唯一光源。`feature-light:`标签保留给这种拥有者自身光源，不能用来给其他角色赋予照明。不要省略关闭标记，也不要让再次开启叠加多份光源。

### Attack-action feature replacements

An Activity may declare `usesAttackActionAttack: true` for a free, single-creature attack with exactly one per-target attack check. It cannot also declare a spell invocation, triggered invocation, native authority binding, or action-economy cost. The Host supplies `featureAttackBudget` from its existing turn attack ledger, spends the action for the first attack, and returns the shared attack slot for persistence alongside weapon attacks. Subsequent attacks require the current turn's Attack-action marker. Missing, exhausted, off-turn, or unearned budgets are rejected; the legacy plugin-action entry point cannot bypass this requirement. Unlike equipment replacements, these feature attacks do not consume ammunition. This capability does not itself grant additional attacks or implement a feature's bonus-action follow-up.

### Effect-bound temporary hit point requirement

Use `{ "kind": "effect-bound-temporary-hit-points", "subject": "actor", "effectId": "ward" }` when an Activity requires remaining temporary hit points from a particular effect. The Host checks a positive remaining pool, its recorded effect definition and source actor, and the matching live, unsuspended effect. Temporary HP from a replacement source does not satisfy the requirement. `subject` may also be `target`. Pair this with the existing `temporary-hit-points.sourceEffectId` operation after applying the owning effect; client choices cannot supply the pool provenance.

Automatic, no-choice, no-dice, no-cost single-target damage Activities on the defender's `reaction-window` now resolve at confirmed hit time before the incoming attack's damage. Successful Activities are marked on the attack event to prevent post-commit replay. Interactive reactions remain on their existing interrupt path. This supports bound-pool retaliation on the hit that exhausts the pool without granting retaliation on later hits.

`usableWhileIncapacitated: true` also supports automatic `reaction-window` retaliation with `requiresEffectGrant: true`, an actor `effect-bound-temporary-hit-points` requirement, free/special activation, no costs/choices/checks and fixed single-target damage. Host requires the same live, unsuspended Effect to own the remaining pool and grant the Activity. This authority exists only inside the Host trigger scope; ownership or a directly submitted trigger context cannot bypass the normal incapacitated-actor check. The bound grant supplies its original spell level for scaling; no reaction resource is implicitly consumed. Existing self-drop and involuntary-incapacitation triggers retain their rules.
### Temporary HP source choice

An Activity `temporary-hit-points` operation may set `replacement: "replace"` to adopt the offered pool, including when it is lower than the current pool. This replaces both the value and its effect binding; it never adds the pools together. Omit the field to retain the existing maximum-value policy.

Use an Activity choice with separate outcomes for “keep current” and “use new source”. The keep outcome must omit both the new pool and its associated effect grant. The replace outcome applies the new effect first, then grants the pool with `sourceEffectId` and `replacement: "replace"`. For self-targeted spells this uses the existing spell Activity choice UI; recipient-owned choices on other targets still require the recipient choice workflow. This field alone does not authorize a caster to decide another player's choice.

### 位面传送门查询（Activity 结算接口；玩家展示仍在接入）

`{ id: 'survey', kind: 'detect-planar-portal', target: 'actor', rangeFeet: 5280 }`

只允许自身查询，范围为1–10000尺。模块不能提供入口、目标位面或完整性布尔值。Host以场景 `planarPortalSurvey` 的三维覆盖区域、补录的地图外入口和标记为 `isPortal` 的场景传送动作计算最近结果；目标地图的位面资料也来自Host快照。完整资料下没有入口是正常成功结果；资料不足在消费之前失败。此操作不自动声明动作/次数成本，模块仍须在Activity的 `activation` / `consumption` 中配置。

结果存于使用者 `classState.planarPortalReports[activityId]`，包含来源Activity、观察位置/范围、轮次/游戏时间及 `none` 或距离/水平方位/仰俯角。它是历史报告，不是追踪效果。其他玩家角色投影及地图Token投影移除报告。实际房间使用仍需完成Host场景修订绑定和玩家报告展示验收，当前不能把此结算接口通过等同于边界行者完整自动化。
