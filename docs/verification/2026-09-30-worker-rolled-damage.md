# Worker 脚本伤害骰来源接口验收（2026-09-30）

## 修改

旧 `dealDamage(targetId, amount, type)` 保持最终/固定数值能力，Host 不推测数值是否曾经掷骰。
新增 Worker SDK `dealRolledDamage(targetId, rollId, multiplier?)`，返回 void，只提交骰池引用；注册骰声明用 `damageType` 标明伤害池。
Host 从已安装声明取得伤害类型，从已验证 action.rolls 取得实际骰值，从实际执行者取得来源。
按原始总额加来源修正→归零→倍率向下取整→目标防御→扣血计算。不能把检定/豁免骰仅凭数字当作伤害骰。
同次执行同一 rollId 对同一目标重复应用直接拒绝；共享池可对不同目标分别结算，Host 展开的 perTargetRolls 不可串用其他目标的骰。
新增事件分组 plugin-worker。注册器验证/保留 damageType，Worker、消息接收边界、Host 均支持新操作。

## 验证

5 文件 47 项测试通过：pluginSandboxRolledDamage、pluginSandboxCapabilities、pluginSandbox、communityModuleSdk、pluginApi。
覆盖正确/错误来源、暂停标记、减半叠加抗性、负总额先加值、共享池与逐目标池、未声明/非伤害骰、非法骰、非法倍率、越权目标、重复应用拒绝；动作及 HP 不因被拒绝的新操作改变；JSON 重载和动作重放验证。
真实 Worker 源码在 VM 执行，序列化操作由 Host 结算；单独验证 Worker 响应消息接收校验。旧数值接口不误加来源奖励。
最初失败包括注册克隆遗漏新字段及测试 VM 跨域对象未按真实消息反序列化，均已修复。
日志：.codex-logs/worker-rolled-damage.txt。
全量类型检查：首轮发现新测试 action.rolls 联合类型推断问题，已补 Dnd5ePluginAction 注解；复查 session 24860 exit 0。定向 git diff --check 通过，全部验证进程已结束。

## 作者用法

```js
api.registerHeadlessAction({
  id: 'ember',
  rolls: [{ id: 'burn', label: 'Fire damage', count: 2, sides: 6, damageType: 'fire' }],
  resolve(ctx) {
    ctx.dealRolledDamage(ctx.target.id, 'burn');
    return ctx.succeed();
  }
});
```

仍需按既有模块格式注册法术/特性、目标权限和动作消耗。倍率仅限 0.5/1/2；2 表示对完整伤害乘二，不表示 D&D 暴击（暴击须在骰声明中增加骰数）。成功豁免不受伤时不提交伤害操作。接口不返回最终扣血量；最终值以 Host 事件为准。

## 范围

不自动迁移旧脚本，不据此宣称旧脚本已具备伤害骰来源。不新增多分量共用池建模、不自动裁决命中/豁免；原生旧声明编译器数值路径与其他手工汇总入口仍待审计。
不开放来源增伤完整能力登记。本轮未改原始 AI 配置，未调用付费 API，未操作真实 5273/5274 服务或房间。原始全书预检仍 29/155（18.7%），整书目标未完成。
