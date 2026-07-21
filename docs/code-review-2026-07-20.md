# 代码审查报告（第三轮）— 2026-07-20

审查范围：提交区间 `e16b560..HEAD`（约 22 个提交、90 个文件、+6347/−486 行），外加工作区未提交的 `src/store/characters.ts` 改动。覆盖的主题：统一骰点模式重构、权威基础动作与怪物 Schema、群体治疗与权威法术区域、权威召唤生物、自定义规则插件、迷雾/视野/寻路、角色头像。

行号为审查时的工作区行号。每条含：问题、正确行为、修复建议。

---

## 高严重度

### H1. 插件召唤特性可声明"免费行动"，无限召唤满血生物
`src/rulesets/dnd5e/pluginApi.ts:978-987`，配合 `pluginFeatureAction.ts:76-81`、`headlessCombatEngine.ts:6173/6578`

注册校验不限制带 `summon` 的行动的行动经济；`economy === 'none'` 时 prepare 和引擎都完全不消耗资源，也没有每回合次数、专注强制或在场召唤数量上限。构建器 UI 直接提供"免费行动"选项（`Dnd5eCustomPluginBuilder.tsx:206`）。玩家可在自己回合反复提交，每次生成一个满血 SRD 生物加入权威先攻（非专注时可累积，`durationRounds` 最长 14 400 轮）。
**修复**：注册时要求带 `summon` 的行动 `economy !== 'none'`，或强制专注/每回合一次限制。

### H2. 待确认 HP 编辑用跨端墙钟时间戳让权，玩家 HP 修改会被静默回滚
`src/store/characters.ts:264`（未提交改动）

`sharedUpdatedAt`（DM 机器的 `Date.now()`）与 `pending.updatedAt`（玩家机器时钟）不可比。DM 端合并对本地已存在角色整体取本地版本，DM 在轮询窗口内的任何无关编辑（改名、改笔记）都会带着更新的时间戳但携带旧 HP，玩家端据此清掉 pending 并回退 HP，绕过 `pendingHitPointsMustBeRepublished` 的自愈重发。DM 时钟快几秒时，玩家的编辑在发布前就会被自己的保存流程覆盖——时钟偏差下是确定性丢失。同文件的等级编辑保护（140-157 行）没有这个逃生口，行为正确。
**修复**：不要比较客户端墙钟；只靠回显确认 + TTL，或改用服务器单调 revision（`X-Stars-State-Revision`）。

### H3. 石化（petrified）被错误地加上"5 尺内命中自动重击"
`src/rulesets/dnd5e/conditions.ts:76`

SRD 5.1 中只有麻痹和昏迷有"5 尺内命中即重击"；石化只提供攻击优势、自动失败力/敏豁免、全伤害抗性、免疫毒素与疾病。`headlessCombatEngine.test.ts:1250` 还把这个错误行为固化成了测试。
**修复**：删掉 petrified 的 `hitsWithinFiveFeetAreCritical` 并改正测试。

### H4. 新的视线权威判定绕过妖火（faerie fire），隐形收益未被剥夺
`src/rulesets/dnd5e/headlessCombatEngine.ts:267-303`（两名审查员独立确认）

`dnd5eCombatantCanSee` 只看 `invisible` 状态和 `hiddenCheckTotal`，不检查 `srd-5.1:spell:faerie-fire` 效果，把 `passiveDefenses.ts` 中专门为妖火写的排除逻辑整个绕开。被妖火描边的隐形生物：攻击它照旧给攻击者劣势、它自己攻击照旧拿优势——妖火"受术者无法从隐形获益"的核心作用完全失效。
**修复**：`dnd5eCombatantCanSee` 对带妖火效果的目标不因 invisible/hidden 判为不可见。

### H5. 协助攻击（Help）对怪物目标完全无效
`src/rulesets/dnd5e/mapBridge.ts:346-389`（两名审查员独立确认）

引擎把协助标记写在被攻击目标（`helpedAttackSourceId/TurnKey`）上，而协助的目标必然是敌方怪物 Token；`planDnd5eMapResultApplication` 对怪物 Token 只按字段白名单持久化，白名单不含这两个字段。协助动作落盘即丢失，下一个攻击事务重建快照时协助已不存在——玩家花一个动作，队友得不到任何优势。
**修复**：把这两个字段加进 Token `dnd5eCombatState` 类型与持久化白名单（`store/maps.ts:145-189` 同步）。

### H6. 玩家疾走（Dash）消耗动作但得不到任何额外移动力
`src/rulesets/dnd5e/headlessCombatEngine.ts:7918-7923` + `src/pages/MapsPage.tsx:7650-7661`

引擎 `dash` 只改快照内的 `movementRemaining`，不发 `movement-granted` 事件；每个动作是独立事务，`planDnd5eMapResultApplication` 不回写回合经济，MapsPage 基础动作分支也只扣动作。地图侧实际移动依据的 `movement.current` 纹丝不动。对照：盗贼灵巧动作疾走有完整的 `movement-granted` 链路（引擎 7240-7243、MapsPage 10457-10466）。
**修复**：`dash` 发出 `movement-granted`，MapsPage 按灵巧动作的模式累加移动力。

### H7. 基础动作躲藏（Hide）无条件成功，骰点毫无意义
`src/rulesets/dnd5e/headlessCombatEngine.ts:7924-7953`

掷完隐匿直接写 `hiddenCheckTotal` 并标记 hidden，从不与敌方被动察觉比较；而 `dnd5eCombatantCanSee` 只要 `hiddenCheckTotal != null` 就判看不见。骰出 1 也稳定获得"未被看见"及后续攻击优势。对照同文件盗贼灵巧动作躲藏（7250-7272）取敌方最高被动察觉为 DC。
**修复**：与 7253 一致，用敌方最高被动察觉做 DC，失败清空 `hiddenCheckTotal`。

### H8. 玩家迷雾层探索多边形在 cover 形状之后擦除，DM 无法重新遮蔽已探索区域
`src/components/map/MapCanvas.tsx:363-373`

图层顺序是：整图 cover → `fog.shapes` → 探索多边形 `destination-out` → 视野多边形。探索擦除会把刚画的 cover 形状一起擦掉：`filled` 地图上玩家探索过区域 A 后，DM 再画 cover 想重新遮蔽 A，服务端 `fogPointState` 判 covered 并过滤 Token，玩家端底图却完全可见——与注释宣称的"后画的 cover 会重新盖住"矛盾。且探索记录无清除入口（`clearMember` 无调用者）。
**修复**：把探索擦除移到 `fog.shapes` 之前（紧跟整图 cover 矩形）。

---

## 中严重度

### M1. prepare 与引擎的优劣势来源分叉，引擎侧新增来源因骰数回退而无效
`src/rulesets/dnd5e/equipmentAttackAction.ts:262-271`

引擎新增 `dnd5eHelpAttackApplies`（优势）和 `dnd5eFrightenedAttackDisadvantage`（劣势），但 prepare 不含它们。UI 按 `prepared.attackMode` 决定掷几枚 d20；prepare 判 normal 只掷一枚，引擎判优/劣势后 `rolls = [d20, d20Second ?? d20]` 用同一枚顶替——数值上完全无效（help 还照样被消耗）。
**修复**：prepare 端补齐这两个来源，或引擎缺第二枚骰时拒绝而非静默回退。

### M2. 借机攻击 prepare 丢失攻击者自身状态劣势
`src/rulesets/dnd5e/opportunityAttackAction.ts:199-202`

旧的 `dnd5eUnseenTargetImposesDisadvantage` 被删除且未替换，该函数第一行覆盖攻击者中毒/束缚等 `attackRollsDisadvantage`。中毒攻击者做 OA 时 prepare 判 normal，第二枚骰回退同值，劣势实际失效（同 M1 机制）。
**修复**：prepare 劣势列表补 `dnd5eTargetIsUnseenForAttack`（顺带覆盖目标 Dodge 对 OA 的劣势）。

### M3. Dodge 在引擎内永不过期
`src/rulesets/dnd5e/headlessCombatEngine.ts:8318` + `passiveDefenses.ts:180-185`

`dnd5eTargetIsDodging` 判 `dodging === true || dodgingTurnKey != null` 但不与当前回合比较；引擎回合开始只重置 `dodging`，没有任何地方清 `dodgingTurnKey`。跨回合 headless 会话中闪避一直生效到战斗结束；地图流程的 MapsPage 兜底不覆盖怪物。
**修复**：回合开始重置 `dodging` 时一并清除 `dodgingTurnKey`。

### M4. Dodge 未给敏捷豁免优势
`src/rulesets/dnd5e/passiveDefenses.ts:60-88`

`dnd5eSavingThrowMode` 的优势来源列表没有 dodging。RAW：回避者到下回合开始前敏捷豁免有优势。
**修复**：加入与 `dnd5eTargetIsDodging` 同门槛（失能/速度 0 失效）的优势项。

### M5. 推撞（Shove）"推开"结果没有任何位移
`src/rulesets/dnd5e/headlessCombatEngine.ts:8049-8066`

`outcome: 'push'` 成功只发事件，引擎和 MapsPage 都没有代码把目标推离 5 尺。玩家消耗一次攻击只换来一行日志。
**修复**：引擎计算并在结算计划中输出新坐标。

### M6. coverOverride 的 DM 守卫建立在客户端自报的 sourceMode 之上
`src/rulesets/dnd5e/equipmentAttackAction.ts:109-110`

`sourceMode` 由客户端构造写入共享队列，DM 主机不校验来源一致性。被篡改的客户端提交 `sourceMode: 'dm'` 即可携带任意 coverOverride（如 `'none'` 消除掩护）并跳过 DM 掩护裁定询问。
**修复**：DM 主机处理共享队列动作时强制覆写为 player 来源；DM 本地动作不走玩家可写通道。

### M7. 预备动作（Ready）永远无法被触发
`src/rulesets/dnd5e/headlessCombatEngine.ts:7997-8009`

引擎实现了 `trigger-readied-action`，但全仓库（除测试）没有调用点，DM 端没有触发 UI。玩家花动作登记后，状态只会在自己下回合被静默清掉。
**修复**：为 DM 增加"触发某人预备动作"的入口。

### M8. 擒抱/推撞的对抗技能由攻击方替目标选择
`src/components/map/Dnd5eBasicActionsPanel.tsx:29,80` + `headlessCombatEngine.ts:8033`

RAW 中运动 vs 体操由被抓/被推的目标选择；现在发起方在 UI 里选 `targetDefense`，引擎照单全收，玩家会永远挑目标弱项。
**修复**：怪物目标由权威端取两者较优（模拟目标合理选择）或交 DM 裁定。

### M9. "以一次攻击替换擒抱/推撞"被 UI 闸门全部拦死
`src/pages/MapsPage.tsx:12782` + `Dnd5eClassCombatPanel.tsx:268`

第一击就把 `action.current` 归 0，随后两处 `action.current > 0` 闸门阻止一切基础动作请求；而 `prepareDnd5ePlayerBasicAction` 及其测试明确支持用剩余攻击次数做擒抱/推撞。额外攻击战士实际永远无法把第二击换成擒抱。
**修复**：对 grapple/shove 放宽为"action 可用 或 attacksUsed < attacksAllowed"。

### M10. NPC 从"友方"改判"中立"，团灭判定行为回归
`src/lib/combatTokens.ts:63-66`（提交 953e248）

旧实现 npc → 'ally'；新实现经 `dnd5eCombatTokenSide`（npc 返回 undefined）→ 'neutral'。`checkCombatOutcome` 不再把存活友方 NPC 计入友方：全体 PC 倒下但护送 NPC 仍存活时立即判团灭。52 行注释与 `gridCombat.isHostileToEnemy` 的语义自相矛盾。
**修复**：`getTokenCombatSide` 对 `type === 'npc'` 显式返回 'ally'（召唤物已由 `dnd5eSummon.side` 覆盖，不受影响）。

### M11. 生命领域"受祝福的医者"按目标数重复触发
`src/rulesets/dnd5e/headlessCombatEngine.ts:4612-4614、4627-4629`

Blessed Healer 的触发单位是每次施法一次，当前实现放在逐目标循环里：群体治愈真言治 6 人时施法者回 6×5=30 点。
**修复**：移出循环，每次施法最多结算一次。

### M12. 群体医疗术允许 0 点分配，0 分配目标仍被"治疗"
`src/rulesets/dnd5e/headlessCombatEngine.ts:3858、4604-4616` + `spellAction.ts:426-429`

分配 0 点的目标仍执行 `cureHealAilments` 并白拿生命领域 +11 加成，且连锁触发 M11。极端情况：选 100 个目标全部分配 0 点，不消耗治疗池却产生大量治疗。
**修复**：要求 `amount >= 1`，或对 0 分配目标跳过治疗、领域加成与状态治愈。

### M13. 同一次移动内反复进出持续区域会重复结算
`src/rulesets/dnd5e/pluginAreas.ts:99-112` + `src/pages/MapsPage.tsx:3031-3133`

`on-enter` 收集沿路径每次"由外入内"都生成新候选，`alreadyTriggeredThisRound` 只查已落盘 receipts，批内候选互不检查，settle 循环也不复核。"进入→离开→再进入"让 `oncePerRound` 触发器同轮结算两次伤害。
**修复**：settle 循环中每个候选结算前用最新 receipts 重跑判定，或收集时对同一 (trigger, target, round) 只留首个候选。

### M14. 召唤应用基于过期地图快照，整数组覆盖回滚并发修改
`src/pages/MapsPage.tsx:9624-9629` + `pluginFeatureAction.ts:306-319`

`authorityMap` 在动作处理开始时捕获，随后经历多个 await（Interrupt 最长 300 秒）。应用时 `updateMap(..., { tokens: pluginApplication.map.tokens })` 用旧快照派生的完整数组覆盖写回，会静默回滚这段时间其他 Token 的移动、HP、新增；占位重检也用旧快照，可能产生重叠占位。
**修复**：应用时从最新 store 读 tokens、仅追加召唤 Token，并用最新地图重验占位，失败则整体拒绝。

### M15. 插件草稿校验缺少 summon 分支，构建器可导出注册必败的文件
`src/rulesets/dnd5e/customRulesPlugin.ts:144-156`

`validateDnd5eCustomRulesPluginDraft` 对 `persistentArea` 有完整校验，对 `summon` 完全没有；"持续轮数"清空得 0 也能通过草稿校验并导出，注册时才抛 `Invalid plugin summon`，插件整体加载失败且无可定位的字段错误。
**修复**：按 persistentArea 模式补 summon 校验（整数 1–14 400、monsterId 在 SRD 表内等）。

### M16. 环境黑暗时客户端揭雾与服务端 Token 下发口径不一致
`src/lib/mapGeometry.ts:1092-1095` 与 `scripts/shared-server-core.mjs:1281-1296`

两个方向都能复现：① 客户端只在 `vision.enabled === true` 时应用黑暗限制，服务端只要 `ambientLight === 'darkness'` 就应用——动态视野关+盖迷雾时，玩家看到被掀开却空无一物的区域；② 黑暗+动态视野开时，服务端把被任意光源照亮的 Token 下发，客户端揭雾半径只取 `max(darkvision, 自带光源)`——举火把的怪物在 25 尺外时数据已到玩家端但被迷雾盖死。另服务端照明循环忽略 `geometry.lights` 场景光源。
**修复**：统一口径——`enabled=false` 时两端一致忽略 ambientLight；客户端在黑暗下对每个光源多边形额外揭雾（或服务端收紧到与客户端相同）；服务端把 `geometry.lights` 纳入照明判定。

### M17. 寻路：单个相邻生物即封锁对角线，比注释意图更严格
`src/lib/mapPathfinding.ts:142-151`

注释写"两个被占格之间不能穿角"，代码却任一角格被占就封锁。仅一侧有生物（哪怕队友）、另一侧全空时对角也被判非法；5e 中生物不切断对角，穿过友方空间也合法。预览与权威路径一致地多耗移动力。
**修复**：占用检查要求两个角格都被占才封锁；墙体双腿检查保持现状。

### M18. 探索多边形按"当前"最大视野范围回溯过滤，丢弃合法历史探索
`src/pages/MapsPage.tsx:2603-2622`

用当前时刻视野源的范围过滤所有已存储探索多边形：录制时合法（当时举火把、后来移除的侦察 Token、DM 调低 defaultRangeFeet）的多边形在范围缩小后被静默滤掉，已探索区域凭空变黑。加载早期 `visionSourceTokenIds` 为空时上限只剩几像素，所有探索区域瞬时闪黑。
**修复**：尺寸校验移到录制时刻（入库前用当时范围校验），渲染端不用实时范围反推历史合法性。

### M19. 短休的 `hitPointDice` 不在 pending 保护范围，可被旧快照部分回滚
`src/store/characters.ts:1213-1225`（未提交改动，配合 216-229）

短休同时写 `currentHp` 和 `hitPointDice`，但 pending 只记录 HP 三项。旧共享快照在 30 秒窗口内到达时保住治疗后的 HP、却把生命骰回退到消耗前——白拿治疗且骰可再花；自愈重发还会把这份不一致状态发布为权威。
**修复**：把 `hitPointDice` 纳入 pending 记录、确认判断与合并回写。

### M20. 头像内联进 characters 共享状态，聚合体积无上限，撞限额时全量同步静默死亡
`src/lib/characterPortrait.ts:4` + `src/lib/sharedApi.ts:259`

单头像限 600KB，但整个 characters payload 无聚合限制；服务器对 state PUT 硬限 8 MiB（413），而保存失败对非 404/409/422 只是静默 continue。约 13 个满额头像就让所有角色数据（含 HP、装备）永久无法同步且无任何可见错误；zustand persist 写 localStorage（约 5MB 配额）会更早静默失败。
**修复**：至少对 413 调 `reportSharedIntegrityIssue`；更好的做法是头像走已有 `putSharedImage` 通道，characters 里只存图片 id。

---

## 低严重度

### L1. 擒抱/推撞缺体型限制，且没有挣脱擒抱的动作
`src/rulesets/dnd5e/headlessCombatEngine.ts:8019-8070` — RAW 要求目标体型不超过自己一级；grappled 以 permanent 效果落地，引擎中不存在挣脱对抗检定，被抓者只能等 DM 手动移除。

### L2. `persistentArea.label` 与 `summon.label` 无长度上限
`src/rulesets/dnd5e/pluginApi.ts:973、984` — 触发器 label 有 120 字上限，这两处只验证非空；恶意插件文件可携带数 MB label 进入共享状态同步给所有客户端。

### L3. 召唤占位不检查地图几何与视线
`src/rulesets/dnd5e/summonedCreatures.ts:54-66` — 只看边界和占用，可把召唤物放进墙体或封闭房间。

### L4. `validateDnd5eSummon` 轮数无上限
`src/lib/sharedResourceValidation.ts:155-158` — `expiresAfterRound` 接受任意大整数，伪造/损坏的 host 状态可产生永不过期的召唤物或区域。建议补 14 400 量级上限。

### L5. 插件区域 `oncePerRound` 与 SRD"每回合首次"语义不同
`src/rulesets/dnd5e/pluginAreas.ts:45-55` — receipt 按轮去重；同轮内另一生物回合被强制推入时 RAW 应再次结算。日后用它实现灵体守卫/刃障类法术时时机会偏保守。

### L6. 召唤物生命周期锚定在玩家可写的 characters 资源上
`src/rulesets/dnd5e/summonedCreatures.ts:126-135` — 恶意客户端可改写专注字段无限维持召唤或掐断他人专注。既有信任模型的延伸，新功能扩大了影响面。

### L7. `e2e/player-vision.spec.ts` 未真正断言"30 尺"边界
`e2e/player-vision.spec.ts:82-96` — 只断言存在 >100 个亮像素；揭雾半径错误、迷雾不透明度 <1、cover 未渲染等回归都抓不住。建议在 30 尺外取样断言暗色，并放远处敌人断言玩家端不存在它。

### L8. 只读模式下头像上传/移除按钮可点但静默无效
`src/components/character/CharacterPortraitEditor.tsx:60-70` + `CharacterSheet.tsx:194-200` — 编辑器未接收 `readOnly`，走完整个裁剪压缩流程后 patch 被静默丢弃。传 `disabled={readOnly}` 即可。

---

## 交叉确认与已验证无问题的方面

- H4（妖火）与 H5（协助攻击）由两名独立审查员分别发现，交叉确认为真。
- **rollMode 统一重构**：优劣势不叠加、优+劣全抵消符合 5e；Protection 反应移入引擎后 UI/引擎两端一致，无双重施加。
- **抗性/易伤顺序**：修正为免疫→抗性减半（向下取整）→易伤×2，与 SRD 一致。
- **命中/重击核心**：天然 20/1、扩展重击阈值、麻痹/昏迷 5 尺自动重击（以命中为前提）、全掩护不被天然 20 绕过，均正确。
- **新增 21 个法术的 SRD 数据**：骰子、目标数、范围、职业表、专注时长、升环全部核对正确；地狱叱喝、死亡防护、树肤术、曳光弹、定身术等细节实现正确。
- **基础动作权威性**：payload 不含骰点字段，d20 全部由 DM 端产生；回合/归属校验严格，无冒名或重放缝隙。
- **fogPointState 客户端/服务端镜像**：逐行一致（rect/circle/polygon/brush、filled、绘制顺序）。
- **服务端投影 needVision**：covered 需视野、revealed 放行、neutral 由动态视野决定，与设计一致且有测试覆盖。
- **插件沙箱**：导入插件强制 worker 执行；summon/persistentArea 是纯声明数据，Worker 无法注入脚本；注册失败完整回滚；加载器有 SHA-256 完整性校验。
- **头像管线**：裁剪数学正确、dataURL 白名单（拒绝 SVG/HTML）、读入路径强制归一化。
- **maps 合并改动**：删除陈旧本地 Token + 追加共享新 Token 是收敛性改进，玩家端无越权删除回归。
- 范围内单元测试（含新加用例）全部通过。

## 修复优先级建议

1. **先修会丢玩家数据/破坏信任模型的**：H2（HP 丢失）、H1（无限召唤）、M6（sourceMode 信任）、M14（快照覆盖回滚）。
2. **再修玩家立即感知的规则失效**：H6（疾走无移动）、H7（躲藏必成）、H5（协助无效）、H3（石化重击）、H8（迷雾无法重新遮蔽）。
3. **然后是数值正确性**：M1/M2（优劣势骰数分叉）、M11/M12（群体治疗）、H4（妖火）、M3/M4（Dodge）。
4. 其余按低成本顺手修：M10（NPC 阵营）一行即可；L8、L2、L4 都是小改。
