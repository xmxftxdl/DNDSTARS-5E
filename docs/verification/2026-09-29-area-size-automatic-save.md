# 区域体型自动豁免

核对原文碧水球（0996cf1c03dffb49c5d0cf4777c0d1e4c27eda75f32dd1ff8ff82afc99ddd38b:171:5），原文明确写Huge自动通过。当前引擎rank4为Huge（界面名超大型），rank5为Gargantuan；不能仅按中文巨型字面映射rank5。

新增savingThrow.automaticSuccessMinimumSizeRank。规范化、声明转Host DC、模块安装校验、区域保存、骰子准备与Headless结算一致。首轮发现声明规范化重建save字段时丢失阈值，已修复。按规则体型匹配，与Token显示尺寸无关；自动结果没有实际d20，不消耗重掷/加骰，保留原DM调整入口。

persistentAreaSourceDc.test.ts在现有合成模块导出、安装、Activity执行、来源DC捕获中验证新字段；非法阈值拒绝。pluginAreas.test.ts对大型/Huge/Gargantuan使用同样视觉尺寸Token，经地图JSON重载、触发收集、准备、提交，证明Huge以上无豁免骰且不束缚、大型正常失败束缚、输入不变和同回合回执防重放；Host体型改小后重新要求骰子。

4文件414项通过（area-size-save-final-20260929.txt）；后续边界复查及完整类型结果见进度日志。全书原配置没有修复或重转；碧水球仍无法解析，重复豁免缺字段、容量/排出/自愿失败/携带移动/终结清理均未因此解决。本轮API0，未修改真实房间，未进行浏览器双端验收。

最终类型检查42336 exit0；自动结果事件细分为size-rule-success和dm-adjusted-automatic-failure，日志显示无需掷骰。nextD20与死亡回合/日志回归通过；旧死亡豁免测试改用正常回合推进，运行时规则未更改。详见进度日志及area-size-save-d20-final-20260929.txt；定向diff-check通过。
