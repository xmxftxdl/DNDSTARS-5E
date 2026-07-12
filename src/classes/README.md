# 职业模块

每个职业目录拥有自己的定义、技能、特性、资源、UI 扩展与 Headless resolver。

通用 `src/lib` 只提供契约、Registry、战斗阶段和受控 mutation 服务。职业 resolver 不得直接
访问 Zustand Store，也不得自行广播；它只能通过 Registry context 中的服务修改 DM 权威状态。

现有模块：

- `archer`：弓手、逐风者、影舞者职业线。
- `heavyGunner`：重炮手及弹仓专用 Action。
