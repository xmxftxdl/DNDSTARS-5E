# 典礼术实际玩家施法入口

实际隔离房间通过 DM 工坊上传 v17 `.starmod`，两端均读取已注册的典礼术。准备法术及两份银粉使用初始化夹具；没有宣称验证完整人物卡学习/准备界面。

真实界面暴露两个缺口并修复：

- 普通物品叙事分类器把 `convert-map-inventory-item` 当成整个 Activity 的纯叙事理由。典礼术包含地图水瓶分支，因此选择典礼前就发送 `dnd5e-adjudicated-spell/narrativeOnly:true`，Host 返回 invalid-action。移除该已具备具体结算的操作的叙事分类。混合典礼及纯地图物品转换均保留正常 Activity 入口，既有原生叙事名单不变。
- 玩家快照使用“类人生物”，资格条件使用 humanoid；资格收集器及执行器直接字符串 includes 导致拒绝。两处改用现有机械类型匹配函数，并补“类人生物”别名。未知类型、不死生物仍不能通过，也不能用客户端目标名称代替类型事实。

4 文件 68 项相关检查通过，覆盖入口分类、地图物品转换、受益历史、资格私有凭据、类型别名及不合格拒绝。最终类型检查会话74689退出0，见 `ceremony-cast-routing-typecheck-r2.txt`。第一轮类型检查会话65374亦退出0。生产代码本步没有其他改动待检查。

浏览器迭代日志保留：r1 是探索模式夹具错误地等待战斗权威 ready；r2/r3 已实际发起请求，显示 invalid-action，r3 请求证明确为 narrativeOnly。r4 入口修复后发送 `dnd5e-spell-cast`，选项 coming-of-age、目标 cleric，随后 target-qualification-required。r5 类型修复后仍返回 invalid-actor，没有完成预期环位扣除。浏览器五次均未通过完整施法验收，不能将局部步骤写为整条完成。

下一步定位长施法开始/发布/激活与期间观测的实际失败阶段：invalid-actor 可能来自初始 actor 校验、开始计划，或完成时未开始/连续性检查，现有证据尚不能区分。需要检查真实 Store/房间持久化经过的状态，不能通过移除 Host 连续性校验强行通过。

证据：`.codex-logs/ceremony-cast-room.spec.ts`、`ceremony-cast-room-r1.txt` 至 `r5.txt`、`ceremony-cast-routing-r2.txt`。使用新隔离目录及6873/6874，未调用付费API、未改用户5273/5274房间，v17归档保持不变。

典礼术仍partial；全书完整本地条目49/155、106待验收，7条既有限定双端条目和0纯叙事豁免不变。
