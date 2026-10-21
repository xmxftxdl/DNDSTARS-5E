# 典礼术：完成时点的受益历史

当前固定 155 项，已完成 49、待验收 106，有限范围双端证据 7 项，叙事豁免 0。典礼术继续为部分完成。本步骤没有调用付费 API，没有修改原始转录、v12 导出包或用户房间。

已确认的问题：Host 将长施法完成时的新增效果持续时间补偿至完整时长，但永久受益历史的 createdWorldMinute 保留施法开始时刻。成人礼、献身和婚礼都应在完成时授予受益，本步骤只将实际本次 established 事件指定的 benefit-history 移到完成时钟。旧历史、其他记录类型和其他角色资料不移动。完整快照和实体提交补丁同步修正，防止 entities 提交把旧时间写回。记录事件的显示时间也同步到完成时点。

实际读取未改动的 v12 `partial-ceremony.starmod`（SHA-256 3dce9567b47231a1749c4ee508d2815d9c69a35c026e968b540adb33ac68ea19），重新投影、注册并通过成人礼 command/commit 生成效果和历史，然后运行完成结算。原包正常 60 分钟及仪式 70 分钟均通过：时钟从 100 到 160/170，历史在 160/170 创建，保存重载后奖励仍为 14400 轮，地图提交补丁与完整快照一致，原包 hash 不变。`ceremony-completion-source-r2.txt` 两项通过。r1 误把 Node Buffer 传入要求 ArrayBuffer 的归档读取 API，测试已改为独立 ArrayBuffer，失败日志保留。

`ceremony-completion-history-final.txt` 三文件 27 项通过，包含角色与 NPC 新记录的 60/70 分钟完成、旧记录不动、原始计划不变、重复应用不改、真实 entities 提交读取正确补丁、非法时钟拒绝，以及既有完成时效果与跨地图历史回归。静态接线断言只证明调用存在，不算实际结算认证。

这些测试没有证明一小时期间持续距离、完整 Host 施法入口的环位与银粉同时消耗、资格确认交互、统一遗体/圣水选择和真实浏览器双端。新测试调用实际源配置的 Activity 命令与提交，再组合完成结算；没有把这一步称作真实完整施法通过。累计不增加。

最终补充 `ceremony-completion-history-final2.txt` 27 项与 `ceremony-completion-source-final.txt` 原包 2 项再次通过；夹具包含真正落后的完整快照及已补偿的实体补丁，避免重复应用时把快照继续留在旧时间。先前完整类型检查退出码 0；补充变化后的最终检查以 `ceremony-completion-history-typecheck-final2.txt` 为准。

最终完整类型检查 `ceremony-completion-history-typecheck-final2.txt` 已结束，运行句柄 79091 返回退出码 0。原始包和源转录保持不变，典礼术仍不计为已完成条目。
