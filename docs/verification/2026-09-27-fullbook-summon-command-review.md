# 召唤命令：接口与源规则差异

本轮为离线审阅，新增转换 API 调用为 0。依据私有原始提取清单 `fullbook-boundaryinventory-20260926/verified-inventory-run.json` 中骷髅之舞与迷你仆役的命令段落。没有修改自动生成草稿，也不认证完整法术或玩家界面。

## 已验证的共用能力

`command-owned-companion` 可由多目标 Activity 对每个选中的受控生物执行相同有限命令，外层统一消耗一次附赠动作。Host 校验所有权、来源 Activity、距离；第二个目标非法时整个请求拒绝，不保留前一个目标的命令或扣除动作。

`dnd5eSummonAndItemRouting.test.ts` 新增跨生命周期用例：通过真实注册的编译 Activity 下达两个疾走命令，JSON 保存恢复，拒绝同回合重复下令与非指定动作，依次推进两个召唤物回合，实际执行疾走并消耗各自动作，拒绝重复疾走。持续命令跨回合保留；单回合命令在各自回合结束后清除，下一轮不能继续疾走。输入状态保持不变。

本轮命令：`npx vitest run src/rulesets/dnd5e/activities/dnd5eSummonAndItemRouting.test.ts src/rulesets/dnd5e/genericCombatPrimitives.test.ts`，两个文件 26 项通过。这些是人工编写的接口用例，不是源配置自动转换成功证据。

## 仍需处理的差异

- 骷髅之舞的接令距离为 60 尺；迷你仆役为 120 尺。通用测试的 120 尺不能作为骷髅之舞距离正确的证据，转换配方必须分别取源值。
- 当前有限命令集合没有完整表达“动作与自愿移动”的组合、具体移动终点和任务完成条件。不能把持久保存一个 `attack` 或 `dash` 标记等同于完整任务执行。
- `persistent-order` 无命令时仅授权闪避，未完整表达这两项源规则允许的自卫；`turn-order` 的受攻击者记录不能直接证明另一种策略已支持自卫。
- 一般任务如取物、守卫、堆叠物品应区分可以结构化的地图/物体动作与需要裁定的语义，不能全部标记为已自动化，也不应全部简单归为 DM 叙事。
- 迷你仆役还需要实际受控实体、物体转化/还原和溢出伤害链路；命令接口不证明这些链路完成。

因此三条复合诊断 `43836e…`、`56e956…`、`6078e…` 只能记为部分解决，保留后续实现与整批重转要求。已有单独的“不能向多个召唤物下同一命令”诊断无需重复提升状态。

## 后续实现：两种策略的已受攻击自卫

后续修复将真实 `attack-resolved` 攻击者记录、自卫攻击授权和自动目标筛选扩展到 `persistent-order`。与 `turn-order` 相同，即使攻击未命中也记录攻击者。存在命令时仍服从命令；没有命令时不能攻击未记录的其他目标。

两个策略都通过真实攻击 → 地图结果应用 → JSON 保存恢复 → 自动行动规划 → 怪物攻击准备和 Host 结算测试；另验证闪避命令不能被自卫攻击绕过。召唤自动目标、注册 Activity 路由、通用原语三个测试文件共 36 项通过。

以上修复取代前文“持续命令策略完全没有自卫”的现状判断，但不等于完整自卫语义已完成：未发生攻击的威胁、非攻击敌对行为与自然语言任务仍未认证。复合诊断继续保留部分解决，不修改原始自动配方或提高源法术通过数。付费 API 调用仍为 0。

### Corpse selection diagnostic reconciliation

- Checked the extracted source entry against the current contracts and registered routing evidence. The exact claims that per-corpse skeleton/zombie choices cannot be represented, and that up to five visible Small/Medium corpses within 60 feet cannot be validated, now have local mechanism evidence. Added explicit converter guidance for corpseFormChoiceId, per-target form intent and declared visibility; did not change the original generated spell configuration.
- These findings do not certify full spell behavior, control tasks, spellcasting bonuses or upcasting. Concentration-loss corpse restoration has separate map evidence, but all termination paths remain outside this review update.

### Corpse lifetime and summon bonuses

- The compiler emits attack/damage bonuses evaluated from the Host casting modifier. Separate skeleton/zombie tests apply the map handoff, restore serialized tokens and settle actual monster attacks, verifying one bonus per attack/damage result using installed SRD profiles. This establishes interface expressibility, not source conversion success or arbitrary missing monster data support.
- Expanded mixed-corpse lifecycle checks to concentration end, expiry, defeat and dismissal; bodies restore once at current position, HP0, without summon metadata. Reconciliation before expiry retains the summons, and repeat reconciliation does not duplicate corpses. Fixed restoration losing current elevation. Map/lifecycle suites76passed after all four cases first reproduced the elevation failure.

### Source-specific summon expiry review

- Re-read extracted Summon Lesser Demons and Infernal Calling entries. Generic summon lifecycle already removes every bound token at HP0, duration expiry or concentration end; existing summonedCreatures lifecycle test covers these boundaries, and current implementation iterates the map's complete bound token set.
- Lesser Demons' exact cleanup claim is expressible using normal concentration/duration bindings. This does not certify its random count, catalogue, ward, AI or original generated configuration.
- Infernal Calling must remain partial: ordinary cleanup is supported, but its control-failure exception allows 3d6 minutes after premature concentration loss. Current controlSave.lingerDieSides/lingerRoll interface describes one die of rounds and is tied to control-save release. It is not proof of opposed-check command immunity or the multi-die minute timer. Do not substitute Summon Greater Demon's 1d6-round behavior.

### Opposed command failure and independent linger integration

- The preceding limitation is partly superseded: `end-owned-companion-control` now transfers command authority to DM without ending concentration or deleting the summon. It is a closed, source-bound operation usable in an opposed-check failure outcome. Both the registered compiler and direct Activity authority validate ownership, source, life and optional speech/current-turn conditions. It clears the existing order and persists control loss through map migration.
- Added Host formula references for actor/target standard skill check modifiers. The synthetic archive uses source Deception versus target Insight; it verifies proficiency changes the result and a tied total fails. This provides a numeric modifier, not a complete implementation of every skill-specific advantage/reroll feature.
- Synthetic `.starmod` export/read/install checks exercise success, subsequent failure, command rejection before and after map reload, unchanged versus explicitly hostile allegiance, invalid owner/source/dead target, public Activity commit, and source-state immutability. The non-hostile branch then invokes server concentration cleanup with 3d6-minute policy and checks absolute expiry at minute489. The no-linger branch disappears normally when concentration ends. Initial failure exposed the compiler's separate settlement path; it now shares the new operation's settlement.
- These are deterministic module/helper tests, not converted Infernal Calling configuration or live-client certification. General task selection, arbitrary oral commands, automatic command-eligibility interpretation, talisman behavior and skill-specific effects still require review. The source-specific lifecycle diagnostic stays partial pending broader source-flow validation; no original recipe or passing source count was changed. API0.

### Skill-aware opposed check modes

- Re-read the exact extracted Infernal Calling entry: the source allows CHA Deception/Intimidation/Persuasion against WIS Insight, failed commands cause immunity for the remaining spell, true name gives advantage, and willing/talisman cases can bypass the contest. These are separate obligations; the numerical contest does not certify them all.
- Host-derived source modes now infer standard skill context from a direct actor-skill-check-modifier reference, or use explicit sourceSkill for complex formulas. Validation rejects unknown skills and contradictions with a direct reference. Public Host authority recomputes these modes from state rather than accepting contradictory mode parameters.
- Compiler and per-target dice presentation now choose the defender option with the actual best modifier rather than blindly using targetOptions[0]; trigger dice use the same source skill context. The archive fixture deliberately puts a weaker STR option first (with advantage), followed by the winning Insight option (with disadvantage), proving declaration order does not select the wrong dice mode.
- Six archive cases cover three source skills × unchanged/hostile allegiance, inferred/explicit source skill, numeric proficiency, Host skill advantage/disadvantage, two-die presentation, public and compiled execution, triggered dice, failed command persistence and the subsequent lifetime path. Broader authority/roll-dice/ability-targeting batch64passed before expansion to all three skills; final six-case archive rerun passed. These are synthetic tests, not source conversion or browser E2E.
- Exact diagnostic1c9201… can now be marked expressible for its numerical opposed-check claim. Composite846224… remains partial: command immunity and finite persistent orders have evidence, but true-name interaction, free-form task completion/reporting and related source conditions remain unverified. No original configuration or source pass count is altered.

### Declared and Host opposed flags combine once

- Follow-up inspection found explicit opposed advantage/disadvantage bypassed Host states, while a trigger's already-combined size mode could be applied again by settlement. The shared helper now aggregates declared/size flags before Host mode reduction. Final authority modes pass through internal final-mode keys, avoiding repeat size application while retaining compatibility for low-level callers that supply only old base modes.
- Six synthetic imported-module cases cover declared advantage with exhaustion, declared advantage plus simultaneous skill advantage/disadvantage, normal declaration with Host skill advantage/disadvantage, size disadvantage canceling Host advantage, and declared advantage plus size disadvantage despite additional Host flags. Every case compares compiled execution, public Activity authority, per-target dice and trigger dice. Combined with companion archives12passed; targeted old opposed/Telekinesis regression5passed,178skipped.
- This verifies numeric flag interaction relevant to true-name advantage. It does not verify knowledge of a name, the actual source activity's conditional UI, talisman exceptions, or general tasks. Composite source diagnostic remains partial. API0.
