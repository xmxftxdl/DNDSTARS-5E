# 新转换结果：PDF 到自动化模块验收

## 结论

未通过。目前不能宣称用户上传这份 PDF 后，就能一键获得可安装并自动结算的完整资料包。

用户授权复用现有 AI 服务后，使用配置中的 `gpt-5.6-luna` 进行了新调用。没有使用人工修复后的法术配置，没有改写模型生成的配置，没有修改现有房间。发现上游阻断后，只做了明确标注的下游诊断，没有把诊断当作整书流程成功。

## 实际运行

### 1. 完整 PDF 读取：阻断，尚未调用 AI

通过应用的 `extractPdfDocuments` 和 `pdfSpellWindows` 读取原始 PDF。测试在 Node 中只将 PDF.js worker 换为同版本 legacy worker 以适配运行环境，没有模拟 PDF 文本。

194 页，提取 291,248 字符。23 页被标记为未解决：1、2、7、77、147、177–194。`pdfSpellWindows` 拒绝缺页文档，因此无法进入整书目录生成。

已渲染并检查这些页面的联系表：包括封面、扉页、整页插图和书后姓名表。不能一概当作空白页。当前法术导入组件调用读取器时没有传入已有的 OCR provider，也没有供用户明确排除非规则页的范围流程。

### 2. 法术章节目录诊断：失败

独立诊断输入新读取的第 151–154 页，其中 151–152 页拥有条目，153–154 页只能用于跨页补全。使用生产 `extractPdfSpellWindow`，开启法术和角色选项提取。

模型返回了 15 个条目，但把起始页为 153 的“控火”等也包含进来，触发 `法术页码超出提取范围：控火 CONTROL FLAMES`。整个窗口被拒绝，符合当前产品的校验逻辑。没有删除越界项后将此窗口标记为成功。

### 3. 两条合法来源的转换诊断：可读取，但自动化不完整

从同一次新响应中选取前两条，并逐条通过生产原文/页码校验，然后分别调用当前转换器。该步骤属于人工选择诊断样本，不是整书目录成功；生成的法术配置保持原样。

| 条目 | 新模型结果 | Headless 预检 |
| --- | --- | --- |
| 亚比达奇凋死术 | `partial`；未生成显式 Activity/headlessAction；特殊生物免疫、豁免劣势和植物效果列入 unsupported | blocked |
| 吸收元素 | `reference-only`；伤害类型选择、反应抗性、下一次近战命中伤害和清理未生成执行配置 | blocked |

预检中的投影 Activity 数量不代表这些特殊机制已经实现。模型报告“不能表达”也不是接口能力的权威判定；此处能证明的是模型没有生成相应执行配置。

### 4. 导出与接收端安装：发现真实注册不一致

两条原样配置通过 `exportPdfContentModule` 导出为 `two-spells-diagnostic.starmod`，导出器内部读回比对通过。再从磁盘读取字节，经过 `projectDnd5eStarModRuntime` 和 `parseDnd5eContentPackageV2`，均成功。

随后调用实际 `registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(...))`，失败：

`Invalid plugin spell automation mode: local.xge.fresh.diagnostic:abi-dalzims-horrid-wilting`

接收端运行时只接受对应的运行模式，前面的包解析/导出流程却允许该 `partial` 条目通过。接收端注册失败，后面的玩家学习/施放、Host 结算和网络同步均未到达，不能标为通过。

## 真实消耗

| 阶段 | API 调用 | 输入 token | 输出 token |
| --- | ---: | ---: | ---: |
| 完整 PDF 本地读取 | 0 | 0 | 0 |
| 章节目录诊断 | 1 | 5,996 | 5,197 |
| 两条法术新转换 | 2 | 73,381 | 1,367 |
| 合计 | 3 | 79,377 | 6,564 |

总计 **85,941 token**，来自服务返回的 usage。不是整本转换成本，也不是货币账单；未继续批量转换失败路径。

## 证据

本地私有目录（资料及模型响应未纳入公共源码）：

- `C:/Users/Doco/AppData/Local/StarsApp/local-import-tests/xge-fresh-20260926`：PDF 哈希、新文本及未提取页面、联系表、完整流程阻断。
- `C:/Users/Doco/AppData/Local/StarsApp/local-import-tests/xge-fresh-20260926-chapter-diagnostic`：目录请求、原始响应、usage、越界失败。
- `C:/Users/Doco/AppData/Local/StarsApp/local-import-tests/xge-fresh-20260926-conversion-diagnostic`：两次转换请求/原始响应、草稿和预检、诊断包。

运行脚本与日志：`.codex-logs/xge-fresh-pipeline.*`、`xge-fresh-chapter.*`、`xge-fresh-conversion.*`、`xge-fresh-receiver.*`。

前三个脚本记录业务阻断后正常退出，不能解读为业务验收通过。接收端脚本保留实际失败，未修改断言掩盖问题。未执行 DM/玩家双浏览器操作；生产解析/注册函数测试不能替代网络和 UI 验收。

## 修复顺序

1. PDF 上传接入 OCR，并提供可审阅的非规则页排除机制，明确资料范围，不能静默丢页。
2. 目录提取对跨页补全文本的范围约束与重试处理，保留错误原始响应。
3. 转换器对确定性机制生成 Activity，并区分叙事限制和缺少自动化；用行为验证约束结果，不能仅依赖模型的 full/partial 标签。
4. 导出门禁与接收端注册保持一致，阻止“能导出但不能安装”的包，并补注册回归。
5. 以上通过后，再进行完整新批次和隔离房间内的 DM/玩家双端验收。
