# Activity 重击分支与实际伤害目标（2026-09-30）

## 复现与修复

新增反例先运行，5项均失败：同目标检查A重击而B普通命中时，B也被按重击读取；always分支、攻击者自身伤害以及all-targets中的普通目标错误继承其他检查/目标重击。修复前证据 `.codex-logs/activity-critical-branch-before.txt`。

Executor 现在从当前 outcome 的明确成功攻击条件建立检查集合，按每个实际受伤目标取重击结果。operationProposals 内的伤害及 mechanic 在实际目标确定后才取得重击状态，避免 all-targets 借用首个循环目标状态。独立检查分支不继承另一个检查或传入触发事件的重击；没有本地检查的触发附加仍可对 Host eligibleTargetIds 中的目标继承原重击。

伤害提案新增可选 attackCheckKeys，只记录当前成功攻击检查的真实 key。注册直达与旧编译桥均把它保存在 activity-formula-roll-resolved 事件中，后续无需解析中文日志来推测伤害归属。不向用户开放新的来源身份输入。

## 验证

新增9项测试：两次攻击精确骰/兼容较大骰池、always/actor/all-targets归属、模块导出重导入后的registered/compiled两条Host路径、合法触发目标与自身伤害的重击继承。断言实际HP、检查关联、实际消耗骰数量与源状态不修改。

旧 mixed-dice 验证原本将依赖命中的伤害写成 always；改为明确关联 attack success，保留其验证重击伤害翻倍而最大HP骰不翻倍的目的。新增反例继续确保 always 伤害不继承无关重击。

6文件109项通过：dnd5eActivityCriticalBranch、CriticalHitParity、AttackDamageOrigin、RollRecipe、Executor、targetCriticalThreshold。日志 `.codex-logs/activity-critical-branch.txt`。触发测试补正了当前 schema 的 attack-hit 事件与 system 自动确认身份。
全量类型检查：首轮发现新集成测试未对联合失败结果做类型收窄，已补明确失败分支；完整复查session6340 exit0，定向diff通过，全部验证进程结束。

## 后续和限制

旧编译路径仍可按原协议预备 critical-sized superset（任一检查重击时），实际普通分支只消耗基础骰；本轮兼容并验证，不把未消费的多余骰计入伤害。逐检查优化骰子预备属于后续改进，不能仅改变接收骰数破坏既有UI/Host一致性。

attackCheckKeys 已贯通提案与实际结算证据，但 Activity 多检查的父攻击共享领取记录仍需使用它继续衔接。没有据此开放全部来源增伤 full 登记，也未重新生成原始AI配置。

原始全书预检仍29/155（18.7%），API0，5273/5274真实房间未改，整书目标active。
