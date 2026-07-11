# 验证边界

## 必须通过的自动化门槛

| 检查 | 命令 | 要求 |
| --- | --- | --- |
| ESLint 基线 | `npm run lint:ratchet` | 不允许新增 error 或突破 warning 基线 |
| 单元测试 | `npm test -- --run` | 全部通过，不依赖本地服务器 |
| 类型与生产构建 | `npm run build` | TypeScript 和 Vite 构建成功 |
| 补丁格式 | `git diff --check` | 无空白错误 |

## 自动覆盖范围

- Headless DM 引擎：AP、伤害、防御修正、临时生命、状态、冷却、次数、回合推进和死亡。
- 玩家请求 authority：战斗 ID、回合、当前角色、重复消息和动作类型路由。
- 单体、多段、AOE target packet：共享伤害骰、逐目标豁免和额外伤害。
- 移动两阶段提交：距离、障碍物、AP、借机攻击和死亡中断。
- 敌方移动、攻击、闪避、豁免和回合 AP。
- Interrupt queue：确认、响应去重、过期和 DM settlement。
- 广播协议：动作 ack、结果摘要、快照合并和旧消息丢弃。
- 迁移边界：页面不得直接调用核心 resolver 或旧 mutation pipeline。

## 仍需手动或 E2E 验证

- Three.js 骰子最终朝向、材质、重叠和多端动画同步。
- DM/多个玩家浏览器同时在线时的真实网络时序和重连。
- Token 拖拽、AOE 高亮、技能栏滚动、弹窗层级等浏览器交互。
- 长时间战斗中的定时器、动画回调和页面切换。

本地双端冒烟测试使用 `npm run dev:dm` 与 `npm run dev:player1`。完整浏览器测试使用 `npm run e2e`；它不是当前 CI 的硬门槛。
