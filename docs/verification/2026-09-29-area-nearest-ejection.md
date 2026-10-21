# 区域最近空位排出

新增forcedMovement.mode:nearest-outside-area及成功/失败/总是时点。声明拒绝自造distanceFeet；来源DC和合成模块归档保存该字段。

共享地图事务在豁免/效果成功之后先投影当前形态与位置，再检查完整占格的最近区域外空间。选点复用Activity强制位移校验，考虑地图边界、实体阻挡和其他占格；同格距稳定选择，不随机。Headless状态、moved forced事件、地图位置和回执一起提交，失败不返回application且返回原状态，不静默丢弃排出。旧push-from-source页面分支限定原mode，避免对新mode重复推移。

4文件167项通过：area-ejection-final-20260929.txt。独立几何测试覆盖最近空位、占位、墙体、完整大体型占格、无可用空间和已在区域外；地图链路结合普通成功/自动成功与失败，验证事件、位置、移动力不消耗、重载回执及无落点时输入不变。合成模块导出/安装/执行沿用persistentAreaSourceDc.test.ts。类型检查状态见进度日志。

范围：当前同高度网格选点，不负责垂直排出、坠落和水球地表追随。不把单个二维接口证据提升为原书完整碧水球诊断已解决；来源账本保持review r29/coverage r32/batch r15。原配置不修改，自动转换不重跑，API0，真实房间不修改。当前预检仍r19：29 ready/125 blocked/1不可解析。

续接验收：完整类型检查33635退出0（area-ejection-types-confirmed-20260929.txt）。新增区域排出/标准擒抱联动，验证超出距离后状态移除、地图持久化、唯一out-of-range事件及输入不变；pluginAreas共79项通过（area-ejection-relations-final-20260929.txt，包含前述回归重叠）。首次自造怪物擒抱用例缺规则声明，已改为合法基本擒抱；没有调整生产规则使测试通过。差异检查通过。
