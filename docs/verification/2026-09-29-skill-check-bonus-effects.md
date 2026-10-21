# 持续技能检定加值与导入验证

## 发现

当前未人工修复的 fullbook-passive-normalization-20260926 草稿中，救赎之誓的和平使节已生成 ability-check / mode:add / ability:cha / skill:persuasion / value:5。旧校验器只接受优势劣势，导致整个子职业 contentParsed:false。

## 实现及证据

新增带必填 skill 的数值加值，求值写入 skillCheckBonuses；效果提交、复制、严格校验及回读保留值。可选 ability 与技能同时匹配。公共效果求和用于角色技能显示、普通 Host 检定和 Activity 快照；现有技能对抗、挣脱选项和隐匿入口同步接入。原有环境灵光保留原逻辑，不将自身效果伪装成灵光。

skillCheckBonusEffect.test.ts 验证实际 Activity 授予、Host 提交、JSON 重载、说服/威吓/普通魅力区分、暂停、回合到期、输入不变、无效数值/选择器、负值、双次导出安装及注册 Host 执行。6文件166项通过：.codex-logs/skill-bonus-batch-20260929.txt。类型及额外引擎回归结果见进度日志。

全书离线预检 r19 只读取原文完全匹配且 manualContentRepairs:false 的保存产物，API调用0。救赎之誓现在 contentParsed:true，该加值Activity校验和Headless兼容检查通过。全书仍为29 ready、125 blocked、1 no-parseable-current-source-draft（原为29/124/2）；这是解析障碍减少，不是子职业或全书认证完成。碧水球仍无法解析，救赎之誓其他诊断和手动结算保持阻断。历史配置及报告未覆盖。

## 限制

仅技能数值加值；公式在施加时求值，不证明持续动态属性加值。原书施法/使用动作、资源和持续时间仍需原文行为验收。没有把合成测试升级为自动转换成功，没有测试真实房间，也未进行双端浏览器验收。

最终完整类型检查已通过（skill-bonus-types-final-20260929.txt）；引擎额外回归320项通过。编辑器加入数值模式及必填技能提示，尚未做新增UI浏览器验收。定向diff-check通过。
