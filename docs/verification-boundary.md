# 验证边界

## 必须通过的自动化门槛

| 检查 | 命令 | 要求 |
| --- | --- | --- |
| ESLint 基线 | `npm run lint:ratchet` | 不允许新增 error 或突破 warning 基线 |
| 单元测试 | `npm test -- --run` | 全部通过，不依赖本地服务器 |
| SRD 发布内容 | `npm run audit:srd-content` | 数量、署名、审校状态和 Headless 清单一致 |
| 生产依赖 | `npm run audit:production` | 无新增公告；受控例外的版本和使用边界不得变化 |
| 类型与生产构建 | `npm run build:check` | TypeScript、Vite 和包体预算全部通过 |
| Docker 镜像 | `docker build .` | Node 22 生产镜像可重复构建 |
| 补丁格式 | `git diff --check` | 无空白错误 |

## 自动覆盖范围

- Headless DM 引擎：5e 行动经济、伤害、AC、临时生命、状态、资源、回合推进和死亡。
- 玩家请求 authority：战斗 ID、回合、当前角色、重复消息和动作类型路由。
- 单体、多段、AOE target packet：共享伤害骰、逐目标豁免和额外伤害。
- 移动两阶段提交：距离、障碍物、移动力、借机攻击和死亡中断。
- 敌方移动、攻击、闪避、豁免和动作／附赠动作／反应。
- Interrupt queue：确认、响应去重、过期和 DM settlement。
- 广播协议：动作 ack、结果摘要、快照合并和旧消息丢弃。
- 迁移边界：页面不得直接调用核心 resolver 或旧 mutation pipeline。

## 仍需手动或 E2E 验证

- Three.js 骰子最终朝向、材质、重叠和多端动画同步。
- DM/多个玩家浏览器同时在线时的真实网络时序和重连。
- Token 拖拽、AOE 高亮、技能栏滚动、弹窗层级等浏览器交互。
- 长时间战斗中的定时器、动画回调和页面切换。

CI 会运行稳定的账号注册登录、插件目录和人工审核浏览器门禁。完整浏览器测试使用
`npm run e2e`，仍作为发布前本地全量门禁；骰子视觉、长时间多端运行和云服务真实验证码
需要在真实 HTTPS 部署上继续执行人工冒烟测试。
