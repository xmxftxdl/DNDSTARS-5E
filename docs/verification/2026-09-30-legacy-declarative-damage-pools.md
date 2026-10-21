# 旧声明式能力伤害骰来源与武器共享（2026-09-30）

## 范围与行为

旧 pluginDeclarativeCompiler 的伤害效果原先把骰值直接变成最终数字，来源增伤无法参与。现由 Host 内部 claimDamageRollBonus 桥接：只有声明为 damage 且实际消耗非空骰的分量领取加值；加值在房规倍率、豁免减半与防御之前。同次能力同 rollId 同目标只领取一次，治疗骰和固定无骰分量不推断来源。

普通攻击/借机攻击 resolveWeaponAttack 产生的 Host 攻击事件关联同一伤害骰领取记录。after-attack-hit 的无独立豁免附加伤害延续记录：主伤害有骰时已领取，固定主伤害则首个实际附加骰领取；多个预激活能力不会分别增伤。有独立豁免的能力按独立池处理。其他目标也独立。

记录通过 WeakMap 保存于当前事务，协议、玩家 payload 和持久化存档不携带它。每次自动触发用临时副本，只有触发成功才更新共享领取记录，避免失败触发消耗父攻击记录。不同伤害类型的事件使用实际附加分量类型。

## 验证

新增 12 种情形：独立来源匹配/错误来源、成功豁免减半再抗性、负总额、固定伤害、同骰重复引用只加一次、非法骰回滚；两个预激活能力的固定/有骰主伤害、暴击、错误来源、非法第二骰回滚。使用 JSON 重载状态；检查伤害、资源、源状态不修改及无意外触发拒绝。

4 文件 92 项通过：declarativeSubclassAbility、battleMasterHeadless、genericCombatPrimitives、pluginSandboxRolledDamage。新测试首轮缺少既有协议必需 transactionId，补齐后通过。日志 .codex-logs/legacy-declarative-roll-bonus.txt。
全量类型检查：首轮发现新测试对只读特性数组 push，已改为新数组赋值；完整复查 session95926 exit0。全部验证进程结束。定向 git diff --check 已通过。

## 未覆盖范围

未提供可信骰池领取记录的其他旧 attack-resolved 生产入口保留原行为，不猜测一个攻击是否只含固定伤害。其 fixed-primary→声明式 after-hit 首骰分支仍需接入记录并验收；不因此开放来源增伤的 full 登记。

本报告没有证明整书生成配置已修复，没有改写原始 AI 配置，也没有对正式房间操作。当前原始全书预检 29/155（18.7%），API 调用 0，整书目标 active。


## 下一批审计入口

`.codex-logs/attack-event-ledger-audit-20260930-r1.json` 保存本轮源文件 SHA256 与单文件 AST 列出的 10 个攻击事件字面量。已有记录为 resolveWeaponAttack；下一批包括 resolveStandAgainstTideRepeat、resolveSpellCast 两处、resolveDnd5ePendingMonsterMechanicTrigger、resolveMonsterAction、resolveMonsterCoreSpell、resolveMonkUnarmedBonus、resolveMonkDeflectMissilesReturn、commitDnd5eActivityExecution。该清单不代表每条都缺机制，也不覆盖文件外事件生产者，须按实际骰来源核查；没有把语法命中标记为行为已验证。
