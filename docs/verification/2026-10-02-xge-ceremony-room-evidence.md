# 典礼术：房间死亡证据及等待后校验

固定清单仍为 155 项，本地完成 49 项、待验收 106 项，7 项有限范围双端证据，纯叙事豁免 0。典礼术仍为部分实现，不增加完成数。本步骤沿用 v12 部分包，未修改原始转录或包配置，没有调用付费 API，没有操作用户 5273/5274 房间。

Host 房间投影读取全地图及角色资料，支持跨地图明确死亡和没有 Token 的角色死亡豁免记录。普通怪物战斗投影把 0 HP 用于死亡清理，新检查发现它不能直接用作永久受益历史的丧偶证据：房间 NPC 查询现要求保存的 deathRound 且当前确已死亡，角色要求 0 HP 且死亡豁免失败三次。完整房间查询优先于当前场景的泛用死亡判断。

Host 观察死亡后向原受益历史保存内部 deathWitnesses；证据需要 Host 时钟且不能早于原受益。保存重载及已死亡 Token 删除后可沿用；已知复活覆盖证据并在房间核对时撤销。从未观察死亡的删除、缺房间范围、重复身份不能推断丧偶。作者仅声明 benefitRenewal，不能填写受益名单或死亡证据。

实际模块法术准备与结算间可能等待骰据或确认。Host 调用结算时传最新房间数据，再检查受益者历史和 prior cohort 的死亡证据；配偶复活、新受益记录或范围缺失导致整次取消，没有法术位消费和地图补丁。完整房间数据由 Host store 读取，不来自玩家 action payload。

`ceremony-widow-room-final.txt`：5 文件 109 项通过。新 `benefitHistoryRoom.test.ts` 4 项包含实际 map projection + Activity commit、保存重载和删除/复活、稳定角色身份及元数据校验，以及实际注册导入法术 prepare/resolve 的等待后竞态。原有历史、条件 AC、map bridge 和 SDK guide 回归一并通过。测试夹具初次缺少角色时钟及 legacySource，已修正；每次失败日志保留。缺陷修正前的 0 HP 错误放行日志亦保留。

扩大 `pluginSpellTransaction.test.ts` 时还有 3 项 spell-not-headless 失败：Passwall、Knock、Arcane Lock（`ceremony-widow-room-r2.txt`）。本步骤没有把它们当作通过，也未证明其首次引入时点；需继续定位。类型检查 r1 报告了房间参数误传结束回合接口，r2 报告 readonly 数组类型错误，均已修复。最终类型检查结果以 `ceremony-widow-room-typecheck-r3.txt` 及后续最终复核为准。

尚未证明实际典礼术完整一小时施法期间的范围/接触、地图 AC 显示、统一遗体选择、其他所有者圣水、跨模块历史去重、Wish 葬礼绕过，以及真实浏览器双端闭环。房间生命周期更新只在 Host 观察到状态变化时记录事实，不能补出离线期间完全遗漏的死亡/复活历史。

最终完整类型复核 `ceremony-widow-room-typecheck-final.txt` 已结束，退出码 0（运行句柄 15881）。本地完成数仍为 49/155，剩余 106；不据此标记目标完成。
