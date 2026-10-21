# 创造小人（Create Homunculus）逐条验收

状态：未完成，固定条目 `153:3`，来源 p153–154。当前全书 54/155 条本地通过、101 待验收，12 条有限定范围双端证据。本条尚未计入。

原稿 SHA256 `c9df5158d9456c7ac851ed997954c7c10630901beb3a9062c4491fa44face2dc` 保持不变；修复另存，`manualContentRepairs: true`，API 调用 0。

## 已完成的配置步骤

`create-homunculus-candidate-r1.txt`：1 passed，进程 exit 0。候选保存于本地验收根目录 `create-homunculus-partial-r1/`，包含可重导入的 `candidate.starmod`、修复转换稿和未完成声明。

- 保留原始译名“创造小人”、6 环、一小时、接触、言语/姿势、立即且不专注。
- 不可减伤 2d4 穿刺自伤使用现有 `cannotBeReduced`。
- 引用已安装的 `srd-5.1:homunculus`，无臆造属性块；持久友方召唤、存活 bond 拒绝重复创建、主人死亡时死亡。
- 精确材料配方：黏土、灰尘、曼德拉草根各消耗；价值至少 1000 GP 的镶宝石匕首保留。
- Activity 校验、归档导出/重导入及声明一致性通过。仅为配置证据，不代表实际施放已经验收。

## 必须完成的剩余项

实际导入后的完整一小时施法、材料校验与消费、自伤防御排除、唯一性含跨地图存活召唤、控制与死亡联动。长休时的生命骰转移须限定自己的活造妖且同位面，最多一半总生命骰（含混合职业骰池），每骰加体质调整值，最大生命值至少保留 1；受益方当前和最大 HP 同步增加；下一次长休或造妖死亡解除，提前移除保护。随后验证整包导出重导入和实际双端。

已找到通用生命骰转移和召唤生命周期接口的独立测试，但它们明确是协议夹具，不作为本条法术验收证据。将这些配置接入原始条目后，仍必须进行本条的行为验证。

## 原始候选的本地创建结算

`create-homunculus-imported-r6.txt`：1 passed，进程 exit 0。读取实际 r1 包并注册后：缺黏土、999 GP 匕首均拒绝；声明施法耗时 60 分钟，显式调用 Host 长时施法启动/激活后结算 2d4=[3,4]，HP50→43，六环位1→0；三项材料消失，匕首保留。紧邻格创建持久造妖，地图序列化重载保留来源与死亡联动；主人确认死亡后，远图造妖 HP0、产生一次 instant-death。

恢复夹具材料与法术位以隔离唯一性检查后，第二次准备允许，但地图 handoff 按活造妖契约拒绝。该检查在提交阶段而非 prepare 阶段；本测试尚未证明完整事务失败回滚，不能据此宣称重复施放资源安全。测试显式启动长时施法，不模拟真实 60 分钟经过或中断，亦未覆盖防御对自伤的实际影响。

失败日志：r1/r2 为库存夹具缺 templateId 等必要字段，r3 为骰据误传数组而非 values/modifier/total，r5 将唯一性检查误断言在 prepare 阶段。r4 首次创建行为通过，r6 增补价格门槛与地图唯一性拒绝后通过。均保留，不计入最终验收。后续继续长休绑定、同位面、保护解除及实际完整事务。

## 长休转移配置及实际造妖结算（r2 候选）

`create-homunculus-partial-r2/candidate.starmod` 已另存，保留 r1 和原始资料。r2 导出重导入测试 `create-homunculus-candidate-r2.txt` 为 1 passed / exit 0。增加契约授予的长休转移 Activity，包含 d6/d8/d10/d12 四种职业生命骰、每类 0–10 枚选项、总生命骰一半预算、每骰体质加值，以及本人的存活造妖、精确来源模块和施法 Activity 校验。当前来源模块限定为候选模块；并入累计包时必须同步重写并验收此引用。

实际导入 r2、完成创建结算后，`create-homunculus-rest-r6.txt` 为 1 passed / exit 0：使用契约实际授予的入口，长休后选 d6、d10 各一枚，骰值 3、7，体质 +2；施法者最大 HP50→36、生命骰 [6,5]→[5,4]，造妖当前 HP 与最大 HP 增益均 +14。无 Host 休息凭证、已消费休息窗口重放、错误主人、模块、契约或施法来源均不能提交。序列化重载后，造妖确认死亡或主人下一次长休标记会清除增益并恢复主人最大 HP50。

定位并修复两个运行时断点：授予能力解析此前过滤全部 triggered Activity，现仅额外允许四种已有 Host 凭证支持的休息事件；插件骰池声明上限由 16 调整为有界的 64，允许四类各十种数量的条件骰池声明，实际仅投所选骰池。其他事件保持触发管线专用，缺休息凭证仍拒绝。

`homunculus-rest-regression-r1.txt`：5 文件、59 tests passed、exit 0，覆盖内容包、后续 Activity、休息转移、召唤契约及插件 API。`homunculus-rest-typecheck-r1.txt`：`npm run typecheck`（tsc -b）exit 0。

保留失败证据：rest-r1 为授予入口 plugin-missing；r2 为 40 个骰池声明遭 16 上限拒绝；r5 的死亡夹具只设 HP0，未确认死亡，修正为 deathRound 后 r6 通过。HP0 不等同于确认死亡。

仍待：跨地图同位面支持、实际长休 UI 的所有骰池选择/半数及 HP 底线边界、提前移除保护的本条验证、一小时经过与中断、自伤防御排除、重复施法完整事务回滚、累计包及双端。全书进度仍为 54/155、101 待验收；本条未完成。

## 生命骰边界与完整战斗施法维护

`create-homunculus-rest-r7.txt`：1 passed / exit 0。实际 r2 导入路径上，11 枚总生命骰允许 d6×2+d10×3，共 5 枚；d6×3+d10×3 共 6 枚被拒绝且没有 application。原最大 HP10 的施法者转移骰值总额 14 时，仅转出 9，双方增减一致，施法者最大 HP 保留 1。双方带保护的关联效果无法由普通移除操作删除，重复替换也拒绝。先前验证的正常转移、来源、重放和生命周期全部继续通过。UI 操作仍未验证。

`create-homunculus-casting-r4.txt`：5 passed / exit 0。读取实际 r2 包后，完整维护 600 个战斗回合的施法动作，最终消耗材料/法术位并创建造妖；599 回合提前提交和完成前专注中断均被拒绝，无 application，原房间法术位、四项材料和 HP 均未被结算消费。穿刺抗性与穿刺免疫分别由角色实际持有的测试防御特性注入，在最终结算 state 中确认仍存在，2d4=[3,4] 自伤均为 7。

保留 casting-r3 失败证据：起初只在准备快照加入防御，结算按角色重新构建后防御消失，不能作为不可减伤证据；r4 改为角色真实持有的防御特性并断言最终防御仍存在。casting-r2 的两个防御用例被此证据取代，不重复计数。

仍待完成：跨地图同位面目标及提交、实际长休选择 UI、探索模式施法时间及中断、其他减伤方式（如护盾池）的本条集成、重复造妖完整事务回滚、累计包来源引用重写和双端。当前固定进度不变。

## 唯一造妖的资源事务与零 HP 边界

新增共享 `livingSummonBond` 判定：本人、模块和契约都匹配时，只有确认死亡才释放唯一名额。零 HP 而无 deathRound 的未关联造妖仍占名额；关联角色使用角色死亡豁免记录。未知 HP、被遣散均不能证明死亡。

原地图 handoff 的检查改用该判定；法术结算也在产生 resource application 之前，以新鲜完整房间数据检查已解析的唯一召唤提案。缺少完整房间拒绝返回 application。失败返回原准备 state、空事件与 rollback transaction，避免调用者拿到已经扣除 HP/法术位/材料的成功结果。地图落点阶段继续重复校验，覆盖两个阶段之间的变更。

`create-homunculus-duplicate-r1.txt`：1 passed / exit 0。实际导入 r2，首次创建后在另一张地图分别保留存活、昏迷、未知 HP、确认死亡的造妖；前三种新施法结算失败、无 application、无事件，输入房间/法术位/材料/HP 不变，最后一种可以重新结算。该测试覆盖应用层事务结果，并未替代真实 HTTP 房间提交及双端验证。

`create-homunculus-rest-r8.txt`：1 passed / exit 0，前述长休边界仍通过。`homunculus-bond-regression-r3.txt`：3 文件、32 tests passed / exit 0。既有召唤契约测试的“死亡”夹具原来仅设 HP0，已补明确死亡记录并新增昏迷拒绝断言，未放宽生产检查。

广泛回归 `homunculus-bond-regression-r1.txt` 有 170 passed / 5 failed，其中 2 个上述旧死亡夹具已修正通过；另 3 个 PHB 失败为 Passwall、Knock、Arcane Lock 的 `spell-not-headless`，在此前 `ceremony-casting-proximity-spell-transaction.txt` 中已有同名同原因记录，继续保留待后续 PHB 验证。

最终 `homunculus-bond-typecheck-r2.txt`：`npm run typecheck` / `tsc -b --pretty false`，进程 exit 0。

## 跨地图同位面的权威数据准备（尚未接入转移）

增加可选的 `BattleMap.dnd5ePlane`，DM 地图控制栏可填写位面名称。更新地图与迁移重载均规范化；旧地图不推断为主物质位面。不同地图的两份有效明确名称相等才返回 same，不同为 different，任一缺失为 unknown。同一地图的场景归属相同，但不代表被放逐或以太化的具体生物仍在该位面；后续目标资格必须继续检查生物状态。

`homunculus-map-plane-r2.txt`：3 passed / exit 0，覆盖保存重载、旧数据未知、不同自定义半位面、无效输入，以及 `projectMapsForPlayer` 后再重载仍保留 DM 位面数据。`homunculus-map-plane-typecheck-r1.txt`：项目 tsc -b exit 0。DM 控件已接入，但尚无实际浏览器操作证据。

该步骤仅补齐当前条目必须的位面数据。`prepareDnd5ePluginFeatureAction` 仍限定当前地图目标，`rebaseDnd5ePluginFeatureApplication` 与页面提交仍是单地图。下一步须明确远图目标 ID、校验拥有者/生物位面状态/场景位面及新鲜房间版本，并将两张地图变化原子提交；不能仅将远图 token 拼入本地图后保存。候选 r2 尚未宣称远图支持，本条不计入完成。

## 远图资格校验及昏迷目标修正

`roomCompanionTarget.ts` 增加独立 Host 房间查询：唯一地图/目标标识、角色所有权（允许施法者换图后 token ID 改变）、模块/施法 Activity/契约精确匹配、生命值已知且未确认死亡、场景位面明确相同、以太状态一致，放逐目标因目的地未知拒绝。这里只处理资格，还未接入远图结算与页面。`homunculus-room-target-r1.txt`：3 passed / exit 0。

复核发现 r2 的 HP>0 要求过严：造妖处于昏迷但尚未死亡，仍符合生存条件。r3 移除此额外要求，死亡由转移执行器校验；特性准备层原本也拒绝所有零 HP 目标，现只为明确增加当前 HP 的上限转移允许未死亡目标。`create-homunculus-partial-r3/candidate.starmod` 另存，旧候选与原稿保留；`create-homunculus-candidate-r3.txt` 导出重导入 1 passed / exit 0。

`create-homunculus-unconscious-r2.txt`：实际 r3 包创建造妖后，HP0 的未死亡造妖长休转移成功，当前 HP0→14；既有上限、凭证、错误来源、保护解除与恢复断言继续通过，1 passed / exit 0。r1 失败保留，原因是上述准备层零 HP 拒绝。`homunculus-unconscious-regression-r1.txt`：3 文件 54 passed / exit 0。当前同位面远图能力仍未宣称完成；必须接通实际目标入口、双地图提交及双端验证。

最终 `homunculus-room-target-typecheck-r2.txt` 项目 tsc -b exit 0。后续可以复用 `playerActionAckPublish` 的共享资源批量事务，需先补两地图结果拆分和并发冲突检查，再纳入该提交；现有独立查询尚未改变远图 UI 行为。

## 跨地图结算与结果拆分（尚未接页面提交）

新增显式 `target.roomCompanion` 声明，r4 导入包包含本人契约和来源 Activity；r3 保留。`create-homunculus-candidate-r4.txt`：1 passed / exit 0。`roomCompanionRestAction` 从已注册 Activity 获取权威定义，只接受无距离的单一生物、免费长休完成事件、apply-effect 与最大 HP 转移操作，不用调用者临时 Activity 内容替代注册规则。

准备时核验全房间目标，以临时结算投影和临时参与者记录接入既有 Headless；返回时移除原图中的远图投影，恢复原坐标及召唤身份，输出两个地图结果与同一份角色/休息凭证。地图本体、目标状态、位面或角色在掷骰期间变化时拒绝。该函数输出待提交写集，不自行发送或持久化，不代表页面已经原子提交。

`create-homunculus-remote-r4.txt`：实际 r4 包完整创建后，将造妖置于远图，施法者和造妖来源 token ID 不同但角色 ID 相同。跨图转移成功，施法者最大 HP 减 14、d6/d10 各消耗 1；远图造妖 HP 加 14，坐标 (325,225) 与旧 sourceTokenId 保留；原图无造妖副本；原房间不变。位面变化、造妖 HP 变化、角色 HP 变化都拒绝。重载两个结果地图后，远图造妖确认死亡能恢复施法者上限并清除远图增益。既有本地图长休断言同测通过。r1 失败为快照缺远图参与者，r2 起已补，r4 为最终生命周期证据。

`homunculus-remote-regression-r1.txt`：3 文件、111 passed / exit 0；`homunculus-remote-typecheck-r1.txt`：项目 tsc -b exit 0。仍待接入页面的远图选择、真实批量提交和最后提交时冲突复核，以及完整双端与累计包验证；固定进度仍 54/155。

## 页面入口及共享提交接线（待实际双端验证）

玩家授予能力入口现会让持有者选择同位面的本人造妖（标签带地图名），附带 restEventId、targetMapId 和原契约 effectId。DM 路由读取已安装 Activity 的 roomCompanion 声明，使用全房间权威资料准备与结算。结果通过两次同步的本地 authority application 进入同一玩家动作 ACK 批次，使用既有 maps/characters/combat/campaign-time 期望版本提交；没有单独发送远图更新。结算返回后、应用之前再次检查两图与角色快照，变化则拒绝。

`create-homunculus-remote-r7.txt`：1 passed / exit 0，包含实际 r4 导入后生成玩家操作栏按钮及 use-persistent-area-activity 命令的静态渲染、两地图数值、等待和结算后变更拒绝、序列化生命周期。静态渲染不是浏览器点击或 HTTP 提交证据。

`homunculus-page-regression-r1.txt`：62 passed / 1 failed。失败为 PlayerCombatHotbar 的光亮术测试期待 none、实际 configure；之前 `beast-controls-regression.txt` 已有同名同原因，保留，不计作本次全绿。`homunculus-page-typecheck-r1.txt` 发现 JSON payload targetMapId 未收窄的类型错误，已补对象/数组检查；r2 是修复后的类型检查日志。

尚需在隔离双端实际点击、点选生命骰及远图造妖、验证原子提交/冲突/重放；r4 累计包未推广，全书仍 54/155。

修复后的 `homunculus-page-typecheck-r2.txt` 项目 tsc -b 已终止，exit 0。

## 2026-10-04 隔离双端长休转移

`homunculus-rest-room-r6.txt`：Playwright 1 passed，进程 exit 0。7273/7274 新建隔离房间，DM 通过文件输入导入 r4 原候选，双方确认注册。测试前置状态来自真实导入、Headless 创建和长休处理的 `homunculus-browser-fixture-r1.txt`（1 passed），再赋予测试玩家所有权；本次不声称浏览器已走完一小时施法或长休按钮。

实际玩家点击特性栏授予的长休能力，选择 2d6、其余不消耗及远图造妖，确认掷骰。权威房间中的生命骰减少 2、法师最大 HP 减少 2d6+4、远图造妖当前 HP 增加同值，原图没有远图副本；DM/玩家各自刷新后读取角色上限一致。它证明真实页面到 Host 及共享提交的成功路径，不替代 HTTP 并发冲突和重放验收。

r5 揭示实际缺口：远图没有己方视野时，玩家投影把本人的契约造妖也删除，导致目标选择提示“没有可用目标”。共享服务投影现为拥有者保留具备有效引用契约的永久友方召唤物；不增加该场景视野、不额外暴露其他生物，仍尊重 DM 隐藏。针对性 `homunculus-projection-r1.txt` 1 passed，覆盖本人/其他成员、远图敌人、DM 隐藏、敌对及契约移除。已增加仓库回归 `bondedCompanionProjection.test.ts`。

r1/r2 是测试页签及选项定位错误；r3 被主动终止修正正则；r4 暴露夹具职业与混合生命骰不一致而主动终止。双端采用纯法师实际 d6 池，混合生命骰仍由现有本地测试覆盖。原失败记录保留。无付费 API 调用，5273/5274 用户房间未修改。

仍待完成：探索施法与中断、本条其他减伤集成、HTTP 冲突/重放、累计包来源重写与导出重导入。创造小人仍待验收，全书已接受 54/155 不变。

`homunculus-projection-regression-r1.txt`：共享服务、契约投影与远图资格 3 文件共 181 tests passed，exit 0。

## 2026-10-04 探索施法及其他减伤集成

`create-homunculus-exploration-r1.txt`：实际 r4 候选，4 tests passed / exit 0。无战斗 ID 的探索施法在 Host 启动后完成，消耗一次六环法术位、三种耗材、保留千金币匕首，并产生永久造妖。未启动、启动后失去专注、启动后 HP0 均拒绝，无 application，房间资源保持输入值。此处验证的是准备/结算层；页面在成功提交时通过 `advanceCampaignTimeSnapshot` 累加 60 分钟，不等待现实时间。该页面时钟提交还需浏览器证据，不能把这个局部测试称作已证明一小时的实际提交。

`create-homunculus-defenses-r2.txt`：实际 r4 候选，3 tests passed / exit 0。经过 600 个实际维护动作后，自伤骰 3+4 仍产生 amount7 伤害事件；已安装的固定减伤能力不能抵消，已登记的 5 点护盾池保持 5，角色普通 HP50→43。另例有 2 点临时生命值时，伤害事件仍是 7，临时生命值2→0、普通 HP50→45；临时生命值吸收不等于减少伤害总值。材料、召唤、唯一契约及死亡生命周期既有断言同测通过。r1 失败为防御测试插件传空 passiveEffects 数组，改为未声明后通过；未更改生产规则来迎合测试。

累计包重写/导出、探索页面施法及时钟、HTTP 冲突/重放仍未完成，固定已接受计数保持 54/155。

## 2026-10-04 玩家探索施法与战役时钟双端验收

`homunculus-cast-room-r1.txt`：Playwright 1 passed / exit 0（57.3 秒）。独立 7273/7274 房间导入原 r4 候选，双方注册成功。角色初始状态为准备该法术、材料齐全且尚无造妖；测试通过玩家法术栏施放、实际 UI 确认掷骰及地图召唤落点，再读取权威房间状态。

断言通过：六环法术位恰好扣 1，普通 HP 减少 2–8，消耗 clay/ash/mandrake-root 并保留 jewel-encrusted-dagger，战役时钟 100→160，恰好创建一个造妖，DM 与玩家刷新后各自 store 仍有一个造妖。此测试覆盖探索施法成功路径和页面时间提交；施法准备/中断拒绝已有上一节本地证据，本次没有额外宣称浏览器中断验收。

当前仍未完成 HTTP 冲突/重放与累计包来源引用重写、导出重导入；固定已接受进度 54/155 不变。

## 2026-10-04 累计 55 项候选导出及实际重导入

`create-homunculus-final-candidate-r1/candidate.starmod` 是累计第二十五批候选（38 法术、10 专长、7 特性），不是已接受的新批次。`create-homunculus-bundle25-r1.txt`：1 passed / exit 0，验证既有 batch24 文件 SHA 与所有原定义不变、导出重导入及运行时注册。创造小人内容只将旧模块自引用重写为 `local.xge.repaired.batch25`，尤其 owned-companion 来源要求；所有其他本条定义与 r4 一致，原始来源资料不变。

`create-homunculus-bundle25-behavior-r1.txt`：2 文件 5 tests passed / exit 0。在新模块命名空间下实际创建、本人契约、远图长休上限转移、生命周期以及探索中断拒绝通过。测试生成的双端前置 fixture 也已改为新包来源，不能再与旧 r4 模块混用。

`homunculus-bundle25-room-r1.txt`：2 Playwright tests passed / exit 0。两个全新隔离房间分别上传同一最终候选文件，复验玩家探索施法和长休远图转移；前者验证资源、自伤、时钟与双方刷新，后者验证生命骰、两地图 HP 变化及双方刷新。不调用付费 AI API、不修改用户房间。

候选包仍未推广为正式已接受 batch25：HTTP 冲突/重放与最终逐项审计未完成，浏览器法术书学习也没有在上述种子角色测试中覆盖。已接受 54/155 保持不变。

## 2026-10-04 法术书学习与长休凭证重复提交

`homunculus-final-gates-room-r1.txt` 中学习/施法用例通过：从空 wizard-spellbook 与 spell-prepared 开始，玩家实际搜索“创造小人”、加入法术书、选择六环并准备，权威角色选择记录均包含 batch25 法术 ID；随后玩家施法，资源、60 分钟时钟、造妖及双端刷新检查通过。该次总运行 1 passed / 1 failed，不声称整次全绿，失败属于后续重复提交测试。

`homunculus-replay-room-r5.txt`：1 passed / exit 0。累计包长休转移成功后，捕获真实玩家动作，通过真实传输以新请求 ID 和递增 seq 重用同一 restEventId，完成再次骰子确认。新请求获得对应 rejected 回执，既有 feature adapter 将长休失败统一映射为 invalid-plugin-action（本地 settlement 保留 rest-choice-already-consumed）。权威角色最大 HP、生命骰与远图造妖 HP 均不再改变，之后双端刷新仍一致。

失败记录保留：r1 在刷新后立即重放未完成请求，r2 加入了不适用于探索模式的战斗就绪字段检查，r3 未处理第二次骰子等待，r4 已得到拒绝但测试预期细分错误码；r5 按实际接口并检查资源不变后通过。上述过程没有修改生产结算来迎合测试。尚需受控并发冲突验收与最终逐项审计，完成数仍 54/155。

## 最终接受：55/155

`homunculus-conflict-room-r1.txt`：1 passed / exit 0。在真实双端长休掷骰等待期间，通过 DM HTTP 状态写入将远图造妖 HP 改成 4，等待 Host 收到后继续骰子确认；请求返回 plugin-commit-conflict，法师普通/最大 HP、生命骰和长休凭证不变，远图保留新 HP4，原图无投影副本。该验收覆盖等待期间的实际并发变更，不宣称穷尽所有网络故障时序。

最终按原文逐项审计，`create-homunculus-final/requirements-audit.json` 与 `acceptance.json` 记录需求、日志哈希和证据边界，原稿 SHA 及来源正文不变。正式累计包为 `repaired-entries-batch25.starmod`，SHA256 `80d0917326b28a70afa10d2891fd78289a11efd8503595b2c40f7393c24ecc0e`。账本已接受 55、待验收 100；13 项具有限定范围双端行为证据，纯叙事豁免仍为 0。全书目标尚未完成，下一条为众星冠冕（Crown of Stars）。

保留限制：长休事件由实际本地 Headless 夹具提供，未单独认证长休按钮；混合骰/生命下限/防御/部分生命周期采用本地导入行为证据；重复请求仍会先询问骰子再返回通用拒绝。后续累计导出必须将本条 owned-companion 来源 packageId 改写为新包标识，不能复制 batch25 的自引用不变。


