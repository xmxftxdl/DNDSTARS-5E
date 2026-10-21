# 怪物待处理触发器的来源伤害加值

## 本批实现

`resolveDnd5ePendingMonsterMechanicTrigger` 中独立 damage 效果保留未经归零的原始骰总额，按实际机制拥有者和目标读取来源加值，再归零及防御。attack 效果命中时在其骰池修正中加入加值；暴击只增加骰数，未命中不加值。日志分组 monster-mechanic。

治疗与临时生命继续使用原有 totals，未接入伤害加值。一次性待处理快照、反应资源和机制使用记录保持原有权威事务。

## 验证

两组参数测试执行14种情形：独立伤害6种，反应攻击8种。覆盖来源匹配/不匹配、暂停、抗性、负基础修正在加值后才归零、非法骰回滚、暴击、未命中；每个成功情形验证JSON重载的快照消费及拒绝重复结算，失败不消费资源/快照/生命。

3文件321项通过（新增文件2项参数测试、现有触发器11项、主Headless308项）。完整 typecheck 通过（7843 exit 0）、定向 diff 检查通过，所有验证进程结束。日志：.codex-logs/monster-mechanic-target-bonus.txt、.codex-logs/monster-mechanic-target-bonus-types.txt。

## 入口清单与剩余审计

新增只读AST工具 `scripts/audit-damage-roll-entrypoints.mjs`。当前单文件结果43处 resolveDamage、4处 damageOrHealing、47处 applyDamage、4处公共豁免伤害调用、25处目标加值读取。输出 .codex-logs/damage-entrypoints-20260930-r1.json；这只是检索清单，不是行为完成证据，也不覆盖所有手工求和或导入的结算器。

同步 after-hit 追加效果尚未改动：需确认它与主武器伤害是否共享一次加值，不能每个附带分量都加。怪物附带豁免、特殊动作、投掷关联目标等仍待核查，完整能力登记未放开。

原始全书29/155（18.7%），API0，真实房间和原始AI配置未动。
