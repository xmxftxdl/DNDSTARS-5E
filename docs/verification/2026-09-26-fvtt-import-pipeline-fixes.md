# FVTT 参考：资料导入与执行边界修复

## 参考与范围

阅读了 [Foundry DataModel 的迁移、清洗和校验流程](https://foundryvtt.com/api/v13/classes/foundry.abstract.DataModel.html) 和 [官方 D&D5e BaseActivityData 实现](https://raw.githubusercontent.com/foundryvtt/dnd5e/6.0.x/module/data/activity/base-activity.mjs)。参考其将来源资料、执行 Activity、消耗、持续时间及目标字段分别建模的方式，没有复制 FVTT 私有实现或扩展正文。上游链接为分支/版本文档，不是锁定提交的依赖。

本次修复的是已发现的导入流程与运行模式不一致。没有宣称任意 PDF 都能生成完整自动化。

## 已实现

- 保留包内 `partial/full` 等覆盖说明；运行模式按真实 Activity 映射。有执行活动时使用 Headless，否则明确作为 `reference-only` 安装。报告记录没有显式 Activity 的完整度声明，避免把资料安装成功当作自动化成功。
- 浏览器导出完成读回后，在独立 Worker 内使用实际插件注册器进行接收端预检，成功或失败后终止 Worker，不向当前房间注册内容。无 Worker 的 Node 环境明确报告 `unavailable`，不伪造验证结果；测试另执行实际注册。
- PDF 导入接入现有 RapidOCR provider；服务不可用且存在未识别页时，列出具体页码。支持明确填写排除页码，拒绝非法范围与跨越被排除页的条目；排除范围进入缓存身份、恢复结果和导出报告。
- AI 提取到后续补全页条目时，先验证原文，再标记由其所属窗口处理；本窗口保留合法条目。伪造原文、越界页码仍拒绝。没有自动将任意失败条目当成成功。
- AI 转换拒绝“full/partial 却没有绑定 Activity”的草稿；禁止 AI 发明 `authorityBinding` 原生执行绑定。法术可携带物品依赖，以支持临时武器等机制。
- 法术提示移除无关的怪物、种族/职业模板和旧 mechanics 实现段；根据原文保留区域协议。完整 Activity/Effect 协议仍较大，此次不是完整的机制检索系统。
- 已有草稿可点击“按预检反馈重试此项（消耗积分）”。反馈包含具体缺口及旧草稿；每次只处理所选项，失败保留旧草稿，不自动无限付费重试。

## 验证

- 7 个测试文件、145 项通过：资料包、PDF、缓存、AI 导入、实际施法事务和墙段攻击。
- 真实 PDF 保存文本及失败响应的离线回放通过：明确排除已检查的 23 页后能建立窗口；原失败窗口保留 11 条本页条目，4 条后续页条目明确延后。此为响应回放，不是整本重新 AI 提取。
- 上次两条原样草稿重新导出、从磁盘读取、注册成功；玩家施法仍正确返回 `spell-not-headless`，不误报可执行。
- 构建出的 Worker 在独立 Node worker 中验证：有效包注册成功，非法插件 ID 被拒绝。使用消息桥适配 Worker 环境，不是双浏览器 UI 验收。
- TypeScript、Vite 构建、私有资料边界检查、生产包预算通过。Worker 为按需加载，构建大小约 7 MB，尚可进一步减少验证器依赖。

日志：`.codex-logs/fvtt-import-final-tests.log`、`fvtt-import-build-final.log`、`fvtt-import-typecheck-final.log`、`fvtt-built-worker.log`、`fvtt-pdf-replay.log`、`fvtt-fresh-receiver.log`。

## AI 真实重试：仍有失败

本轮没有人工改写新生成配置。两轮、每轮两个样本，共 4 次服务调用，模型仍为配置中的 `gpt-5.6-luna`。

| 轮次 | 输入 token | 输出 token | 结果 |
| --- | ---: | ---: | --- |
| 按错误反馈重试 | 73,136 | 1,302 | 一条内部 JSON 语法错误；一条虚构伤害类型，均拒绝 |
| 移除无关模板后重试 | 70,836 | 1,884 | 一条生成 Activity，但仍有规则缺口并发明原生绑定；另一条无绑定 Activity，被拒绝 |
| 合计 | 143,972 | 3,186 | 147,158 token；没有完整自动化通过样本 |

随后增加了禁止 AI 原生绑定的硬校验，未继续付费重试。不能把这些失败归结为“接口一定不支持”；它们证明当前生成器仍不能稳定选择正确接口。后续需要更精确的机制检索、结构化输出和行为夹具，再验证整书覆盖。

私有新响应位于 `C:/Users/Doco/AppData/Local/StarsApp/local-import-tests/xge-fvtt-retry-20260926` 与 `xge-fvtt-focused-20260926`，未进入公共源码。现有房间没有安装或替换模块。

## 未完成的验收

没有全书新转换成功结果，没有 OCR 服务实际运行或 DM/玩家双浏览器验收。历史架构审计中的大文件/分层超限也不由本次修复解决。上述限制保留，不能将流程修复描述为“珊娜萨所有内容已一键自动化”。
