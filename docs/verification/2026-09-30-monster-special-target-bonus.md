# 怪物特殊吸取与传奇翼击的来源伤害

## 改动

- saving-throw-damage-and-max-hp-reduction：来源加值写入原伤害骰池，再减半和防御；生命上限降低继续按实际受到的伤害计算。
- conditioned-damage-and-healing：同样在归零和防御前加值；施术者恢复量继续来自目标实际受到的伤害，不给治疗骰额外加值。
- legendary-wing-attack：共享基础骰池，每个失败豁免目标单独读取来源加值；成功豁免无伤害也无加值事件。摘要 damage 字段继续表示未加值基础池，逐目标事件记录实际值。

## 验证

新增6项参数测试，执行14种情形：两种特殊动作各5种，翼击4种。覆盖来源隔离、抗性、豁免减半、实际生命上限减少/治疗、后续目标非法骰及资源/伤害回滚。翼击同一共享池中另一成功豁免目标不受影响。

首次fixture只搜索普通动作，遗漏传奇动作；随后发现fixture附加魅惑效果但未同步其条件投影，补齐一致状态后通过。没有放宽运行资格校验。

最终4文件781项通过（特殊动作、传奇目录及Headless主回归）。首轮typecheck发现fixture把效果实例当构造参数，修正为按目标构造后新增6项复跑通过；完整typecheck复跑通过（41345 exit0）。全部验证进程结束。日志：.codex-logs/monster-special-target-bonus-final.txt、.codex-logs/monster-special-target-bonus-fixture-final.txt、.codex-logs/monster-special-target-bonus-types-final.txt。定向diff通过。

## 未解决回归及范围

扩展运行 monsterTeleportInvisibility.test.ts 有一项失败：keeps flyers airborne and routes an unsupported aerial arrival through deterministic fall dice，预期invalid-dice却返回ok。尚未定位原因，不宣称完整回归通过；初次日志 .codex-logs/monster-special-target-bonus.txt 保留该证据。

本批未修改投掷碰撞和其他尚未审计路径，完整来源增伤登记未放开。原始整书仍29/155（18.7%），API0、原始配置及真实房间未动。

后续更新：该空中传送失败已在2026-09-30-monster-teleport-airborne-arrival.md修复并通过334项相关回归及完整类型检查；保留以上发现时记录。
