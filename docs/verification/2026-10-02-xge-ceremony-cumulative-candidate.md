# XGE 典礼术累积候选包导出与重导入

终端 2712 退出 0，1 项完整候选包测试通过，日志 `.codex-logs/ceremony-cumulative-candidate-r1.txt`。输出为本地 `ceremony-bundle20-candidate-r1/candidate.starmod`，位于 `C:/Users/Doco/AppData/Local/StarsApp/local-import-tests/fullbook-entry-repairs-20260930-r1/`。

候选包包含现有已验收 49 个来源加上尚未完成整体验收的典礼术：33 条法术、10 条专长、7 条特性，共 50 个来源。模块名称明确标为候选，验收记录明确 `entryComplete:false`、`fullBookCertified:false`、`browserBehaviorVerified:false`。没有将典礼术标为完成，也没有将 50 个来源称为全书 155 条。

实际调用产品导出接口，重新读取生成的 starmod、解析内容包并注册运行时插件。逐个比较原批次 19 包所有具有 ID 的数组定义，均保留；典礼术 v17 法术和 Activity 定义相同。生成后再次验证两个原始包字节未改变。未调用付费 API。

- 候选包 SHA256：`f57043e801c304919f506101136340a0585c18fce86df702dd3c4fbc63a50484`
- 原 49 条包 SHA256：`1f4ffce5fb49e293364076026884676855025a6fc7ef62d1785ff64534547361`
- 典礼术 v17 SHA256：`4aeed1ece84e517654a8b9becd11c7267ddfda8d6b3f80fe436c49c09b34b5e7`

后续候选包浏览器验证终端 49805 退出 0，1 项通过（日志 `.codex-logs/ceremony-candidate-cast-browser-r1.txt`）。全新隔离房间实际上传候选包，两端核对全部 33 条法术 ID；玩家通过法术书准备并普通施放典礼术，验证资源消耗、成人礼效果、记录和刷新同步。这是限定范围的实际使用验证，不证明其它 49 条的完整双端行为，也不完成典礼术整体验收。

普通 600 回合旧版本长测在服务端第 399 回合发生 `state-transaction-conflict:combat`，施法被取消且法术位和材料均未消耗。终端 35352 因此被主动停止，捕获退出码 1；不能当作完整 600 回合验收。仪式 700 回合终端 59397 为避免生产修复影响旧版本测试而主动取消，捕获退出码 1；不能据此声称仪式行为失败。旧日志及隔离状态保留。累计完整条目仍为 49/155，106 条待验收，叙事豁免 0。
