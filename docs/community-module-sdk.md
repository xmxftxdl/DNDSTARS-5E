# 社区模块 SDK 1

目标：作者通过包内 JSON 和受控脚本增加法术、状态、特性、物品、职业及怪物，无需修改地图或 Host 的法术名称分支。联网房间由 DM 启用规则包，所有玩家使用房间锁定的版本及哈希。

## 可直接导入的示例

`examples/community-sdk/ember.starmod` 包含一个自定义法师戏法“余烬之触”、独立的“余烬印记”状态，以及脚本注册的资源。该戏法是演示用自定义规则，不是 SRD 法术。它造成 1d4 火焰伤害并降低目标速度 5 尺，状态持续到目标回合结束。

在模块管理中导入后，将法术加入角色法术选择即可使用。编辑 `ember.json` 再构建：

```powershell
node scripts/build-community-module.mjs examples/community-sdk/ember.json examples/community-sdk/ember.starmod examples/community-sdk/main.mjs
```

最后一个参数可省略，此时生成纯声明式包。构建器验证 JSON、内容引用及归档哈希；运行时还会验证脚本贡献。独立脚本应以 `export default moduleName` 结尾，不能使用运行时 import；TypeScript 工程应先打包为单个 ESM。

## 声明式自动化

一个内容定义包含 `payload`、`activities`、`effects`，Activity 的 `outcomes[].operations` 声明结算。可用操作及字段以 `src/rulesets/dnd5e/communityModuleSdk.ts` 导出的 TypeScript 类型为准：伤害、治疗、豁免、效果、持续区域、召唤、移动和触发等均经现有通用引擎校验。未定义的操作会被拒绝，不能依靠名称约定获得效果。

`legacySource` 目前用于声明 Activity 属于哪一个法术或特性，以便 Host 验证角色是否有权使用；它不要求新增内容走旧法术结算器。示例的来源是 `{kind:"spell",id:"ember-touch"}`。

新增独立状态使用 `kind:"condition"`，`payload` 为 `{id,name,effectId}`，并在 `effects` 内提供主 Effect。`extensionCondition` 应使用包前缀，例如 `community.ember.ember-mark`，避免不同作者的状态同名。状态的修正、持续时间、叠加和解除由 Effect 控制，不需要新增标准状态枚举。

中立资料条目对应 `type:"Condition"`。其他条目的 `automationData.conditionRefs` 可引用状态：

```json
[{"activityId":"ember-touch","conditionId":"ember-mark","packageId":"community.ember"}]
```

同包可省略 `packageId`；跨包必须在 manifest 声明依赖，并先启用依赖包。导入时展开为 Activity 自己的 Effect 副本；缺失引用或同 ID 不同效果会报错。房间投影包含展开结果。状态更新需要更新引用它的包及房间版本，不能悄悄改变正在进行的交易。

## 脚本入口

`.starmod` 清单增加：

```json
{
  "script":{"apiVersion":1,"entry":"scripts/main.mjs","stateSchemaVersion":1},
  "permissions":["compendium.write","automation.register","automation.script"]
}
```

`scripts/main.mjs` 同样受归档 SHA-256 保护。它不能与旧 V2 兼容载荷混装。包内 JSON 先注册，再执行脚本的 `setup(api)`。同包脚本的 manifest 可省略；如提供，ID 和版本必须匹配归档。脚本获得 `sdkVersion:1`：

- `registerContent(definition)`：注册完整内容，包括 Activity、Effect、Trigger 及职业成长声明，命名空间必须属于当前包。
- `registerImageAsset(asset)`：注册图片，接受现有图片格式、大小及 ID 校验。
- `registerHeadlessAction({id,rolls,resolve})`：注册特殊计算；骰子由 Host 提供，处理函数返回 `context.succeed()` 或 `context.fail(reason)`。
- 兼容注册接口：法术、物品、怪物、资源、种族、背景及属性生成方案。新自动化建议使用 `registerContent`。
- `migrations`：相邻版本的纯 JSON 状态迁移，目标版本通过 `script.stateSchemaVersion` 声明。

处理函数只读 `actor`、`target`、`targets`、`action`、`rolls`。命令接口为 `heal`、`grantTemporaryHitPoints`、`dealDamage`、`applyStandardCondition`、`spendResource`、`restoreResource`；复杂效果与触发请声明 Activity/Effect。命令由 Host 检查目标、资源和权限，并原子提交。最多 64 项命令，有超时终止与交易重放保护。

脚本不能直接改角色/地图对象、访问 DOM、网络、文件系统或执行动态导入。声明这类未支持权限会报错。房间分发会把归档转换为同一个自包含 Worker 模块，保留 JSON、图片和脚本，不会仅分发一个丢失脚本的 JSON。外部脚本不会在主线程执行。

## 验收及范围

`communityModuleSdk.test.ts` 使用真实 Worker 源码在隔离 JS realm 中初始化包，然后通过实际 Host 注册、施法、结算、到期和卸载；这不是浏览器双端人工验收。测试还覆盖独立状态往返、跨包未声明依赖、脚本权限和命名空间伪造。

新增内容可以直接使用上述通用链路。原生 123 个法术仍由 `core-spell-transaction` 接入原有专属结算器；本次没有把这个兼容层冒充为已删除。彻底迁移它仍需要按各法术交互逐项实现及验证，不能删除入口来取得表面上的完成。
