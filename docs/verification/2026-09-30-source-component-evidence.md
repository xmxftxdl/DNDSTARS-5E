# PDF 施法成分来源核对

补齐导入预检对 verbal/somatic/material 的来源核对。仅对完整、明确的法术成分标题进行判断；支持中文成分及 V/S/M、换行和材料括号描述。条件式、未知文字及不完整括号不猜测。原始 AI 草稿不被修改。

实际回放确认休憩术原文为姿势、材料，原 fullbook-catnap-contract-convert-20260926 配置多了 verbal；此前效果行为测试不覆盖沉默下的施法资格，不能证明全文正确。新增预检拦截此类配置。

## 验证

- pdfSpellImport 与 pdfSpellHeadlessPreflight：2 文件 47 项通过。
- 原始全书离线回放：1 文件 1 项通过；API 调用 0。
- 私有最新预检 fullbook-consolidated-preflight-20260930-r28.json：24 ready、130 blocked、1 无可解析草稿。24/155=15.5% 是预检率，不是总体完成率。
- 最新诊断清单 fullbook-mechanism-backlog-20260930-r16.json。既有 review r39 / coverage r43 仍对应上一版诊断，不自动继承为新版全量认证。
- 先前 25 项归档与行为记录仍是历史执行证据，不再代表当前全部通过的集合。原始文件及真实房间没有改动。

完整 typecheck 进程 90718 exit 0；定向 diff 检查通过。全部验证进程已结束。
