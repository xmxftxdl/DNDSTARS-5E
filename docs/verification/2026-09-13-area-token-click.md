# 范围选点点击怪物误开卡

MapCanvas 的普通 Token、前景 Token 和状态标签三个入口统一调用 selectCanvasToken。范围确认在 mouse-down 阶段可能结束选点状态，后续 click 仍属于同一手势，必须消费；不再依赖 500 ms 超时。新的左键按下会释放拦截，保留下一次正常开卡和已确定范围的保护目标选择。

浏览器使用真实 MapCanvas 的 `e2e/fixtures/area-token-click.html` 验证：
- 点击怪物本体：范围确认 1，怪物卡 0。
- 再次点击本体：范围确认 1，怪物卡 1，正常开卡未被永久阻挡。
- 重新选范围后点击血量文字：范围确认 2，怪物卡仍为 1。

17 项 mapCanvasInteraction 测试通过，生产构建通过。该测试验证地图事件分发，不代表完整粉碎音波伤害结算的端到端回归。
