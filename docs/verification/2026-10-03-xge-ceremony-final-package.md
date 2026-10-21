# 典礼术最终归档候选

逐项账本仍为 50/155。本文记录最终归档候选，不代表条目已提升。

原 v17 的六条 unsupported 文案分别描述赎罪、圣水、成人礼、献身、葬礼与婚礼尚未实现。后续证据已经覆盖其对应的阵营/检定、永久物品转换、资格与跨包历史、尸体保护与祈愿例外、婚礼距离及受益历史；这些旧文案不能继续用作当前缺口清单。年龄、意愿、宗教等事实仍由 DM 确认，Activity 的 assisted 标记保持不变。

已另存 `ceremony-final-candidate-r1/conversion-run.json`，仅清除六条旧 unsupported 文案并加入验收说明，保留 manualContentRepairs。原 v17 及原转换稿不修改。

候选包为 `ceremony-final-candidate-r1/candidate.starmod`，模块 ID `local.xge.repaired.batch21`，SHA-256 `3dfd201cbdecb91dac60aba1e44a23746c60672b35d0fb4799523c8711afc575`。1 项导出检查通过（`ceremony-final-candidate-r1.txt`）：34 法术、10 专长、7 特性；导出重导入、运行时注册/撤销、既有50条定义及典礼术所有机械定义逐项相同。该结果不证明所有51条的浏览器行为。

六类要求对应日志的通过摘要及 SHA-256 已写入私有 `requirements-audit.json`，保留每份证据的限制。新模块 ID 的各典礼分支、普通／仪式及准备入口双端批量测试正在运行，句柄 26945，日志 `ceremony-final-cast-room-r1.txt`；结果未取得前不提升典礼术，不覆盖已验收的 batch20 归档。

前置跨战斗普通／仪式两条浏览器和48项本地检查已完成；本次不重跑600/700轮完整测试。所有操作不调用付费API，不使用用户5273/5274房间。

## 最终结果

26945 退出 0，12/12 通过（8.5 分钟）。新累计模块 ID 下，成人礼、献身、仪式成人礼、角色/怪物尸体葬礼、自持/他持圣水、婚礼、地图圣水、地图尸体葬礼、赎罪成功/失败及玩家准备入口均完成上传、结算、资源和刷新断言。

典礼术提升为 `local-import-and-host-behavior-verified`。正式累计归档 `repaired-entries-batch21.starmod` 与上述候选字节一致；另存 `ceremony-final/acceptance.json` 和修改前两份账本快照。核验原始转换稿 SHA 未变，既有50条定义未变，逐项账本总数仍155。现为 **51 本地验收、104 待验收、9 条有限范围双端证据、0 叙事豁免**。这不代表累计51条全部经过同等双端测试，也不代表全书认证完成。

DM资格事实确认、浏览器测试夹具和并发冲突日志的限制继续保留；未把 assisted 配置改为无条件自动批准。下一条为控火的 Activity、地图选择与权威结算接线。
