# 伤害入口分类与第二目标战技修复

## 当前审计边界

只读AST清单含43处 resolveDamage、47处 applyDamage，新增按入口分类的证据文件 `.codex-logs/damage-entrypoint-classification-20260930-r1.json`，保存源文件SHA256。分类是代码阅读索引，不是完整行为证明；每项 behaviorVerified 仍为 false，避免把存在处理器当作验收。

已区分：已有来源增伤路径、治疗/临时生命、能力值降低骰、无可信来源的捕兽夹、需要明确归属政策的Overchannel自伤。固定神圣光环、守护之链转移、按已受伤害反射，以及DM最终数值不应在通用applyDamage里再次加值。

当前确认仍需处理：固定主伤害后战技骰的共享领取（含反击/指挥攻击）；脚本deal-damage最终数值与真实骰来源；手工求和及导入结算器；自伤骰来源边界。因此不开放完整能力登记。

## 本批修复与验证

第二目标战技伤害是独立目标骰池，现按第二目标上的实际攻击者来源加值，再归零和防御；不会把第二目标标记加到原目标。未修改现有战技命中资格配置。

新增5项来源匹配/不匹配、抗性、负修正归零和第二目标未命中验证，同时检查主目标HP、资源消耗及输入状态。3文件337项通过（本地战技文件存在并实际执行，没有跳过）。完整typecheck通过（47225 exit0），定向diff通过，所有验证进程结束。日志 .codex-logs/secondary-maneuver-source-bonus.txt、.codex-logs/secondary-maneuver-source-bonus-types.txt。

原始全书预检29/155（18.7%），API0，原始AI配置及真实房间未动。
