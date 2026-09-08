# Local AI Bridge 配置与计费

## 首次配置

在项目目录运行：

```powershell
npm run local-ai:configure
npm run local-ai-bridge
```

旧环境变量仍在当前 PowerShell 会话中时，可以一次迁移：

```powershell
npm run local-ai:configure -- --import-env
```

后续启动不再需要设置 API Key 环境变量。

Windows 默认将公开配置写到 `%LOCALAPPDATA%\StarsApp\local-ai\config.json`，密钥使用 Windows DPAPI CurrentUser 加密，只有保存密钥的 Windows 用户可以解密。Linux/macOS 使用仅当前用户可读的 AES-256-GCM 密钥文件。配置和密钥都位于仓库之外，不会被 Git、构建产物或 Docker 镜像收集。

## 固定模型策略

- PDF 分段提取：`gpt-5.6-luna`
- PDF 全书综合：`gpt-5.6-sol`
- 工坊导入、Excel 填卡、地图语义分析及其他文本任务：`gpt-5.6-luna`
- 图片生成：`gpt-image-2`，固定 `low` 品质
- 扫描页 OCR：本机 `RapidOCR`，积分为 0

页面不再允许临时覆盖模型或图片品质。模型策略由 `shared/ai-model-policy.mjs` 统一维护。

## 积分与审计

内部换算为 `1000 积分 = ¥10`。当前保守计分率：

| 模型 | 输入/百万 Token | 输出/百万 Token |
|---|---:|---:|
| GPT-5.6 Luna | 1,000 积分 | 8,000 积分 |
| GPT-5.6 Sol | 4,000 积分 | 30,000 积分 |
| GPT Image 2 / low | 每张 250 积分 | - |

执行前的估值额外乘以 1.25 安全系数，并按 500 积分向上预留。例如预估 1300 积分时预留 1500 积分。上游返回 Token usage 后按实际 Token 结算，记录退还差额或超额。

每次任务只记录以下审计元数据，不保存提示词、PDF 原文或生成图片：

- 任务与 Job ID
- Provider 与模型
- 开始/结束时间和耗时
- 输入/输出 Token
- 预估、预留、实际、退还和超额积分
- 失败代码

Windows 默认审计文件位于 `%LOCALAPPDATA%\StarsApp\local-ai\usage.jsonl`。已配对的 DM 页面可通过 Bridge 的 `/api/usage` 查看最近记录。

玩家端不会连接 DM 的本机 Bridge，也不会接触 API Key。加入房间的玩家通过权威服务器调用两个白名单接口：Excel / AI 填卡和角色立绘生成。服务器固定使用 Luna 与 `gpt-image-2 low`，客户端不能提交模型名、任意系统提示词或 JSON Schema。玩家任务单独记录在同目录的 `player-usage.jsonl`，包括房间与成员审计标识，但不保存 Excel 内容或立绘提示词。

Docker 生产环境把配置目录固定为 `/data/local-ai`。首次部署后执行：

```bash
docker compose exec dndstars node scripts/configure-local-ai.mjs
docker compose restart dndstars
```
