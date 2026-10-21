# A 类自动化接口与验证

## 导入入口

本地内容 JSON 支持 `activityPatterns` 数组；完整包可放在 `content.activityPatterns`。二者不可同时出现。导入时编译为原有 `activities`，执行仍走 Host/Headless；导出的 `.starmod` 保存原生 Activity，不要求接收者安装另一套解释器。AI 转录 SDK 已加入该接口。

接口声明：`src/rulesets/dnd5e/activities/dnd5eActivityPatterns.ts`。

| 类别 | 声明与组合方式 |
| --- | --- |
| A1 攻击、豁免、伤害、治疗、升环 | `roll-effect`，`check`，`saveSuccess`，`scaling`；公式和重击沿用原生协议 |
| A2 状态、持续、重骰、解除 | `condition`；复杂状态用 `timed-effect` 的原生 Effect：持续时间、重复豁免、受伤/移动解除、主动挣脱、专注关联 |
| A3 模式与目标选择 | `choice.branches`，每个分支可指定 `targetOverride`，未选择分支不结算 |
| A4 资源与次数 | `resource` 支出/恢复、`consumption` 的资源/弹药/骰池消耗；恢复周期和上限在专长或职业/子职业资源定义中声明 |
| A5 延迟、每回合、下次命中 | `timed-effect` 的周期伤害；临时授予 triggered Activity，使用事件谓词、触发次数限制和结算后的移除操作 |
| A6 临时后续动作 | `grant-actions.actionIds` 引用同包 Activity；自动补效果存在要求，来源包隔离，效果结束撤销授权；法术默认 DC/攻击加值使用原施法者来源 |
| A7 持续区域 | `area` 透传原生区域创建参数，支持进入/回合边界触发、每回合去重、持续与专注 |
| A8 普通位移与区域移动 | `movement`：原生 `move` 或 `relocate-granting-area`，由 Host 校验地图与落点 |

所有模板都可指定动作经济、调用方式、前置条件、资源消耗和升环。复杂组合仍可直接写原生 `activities`，并与模板共存。资源模板操作已经声明的 Host 资源，不会凭空创建任意临时资源池。

## 本次修复的执行缺口

- 没有标准状态的周期伤害此前没有保存到机械效果/标记效果；现在保存，并确保同一逻辑效果的多个状态投影只附带一次伤害。
- 受益者获得临时动作后，此前可能因不拥有原法术被拒绝；现在按活动效果中的授予记录授权，并隔离来源包、排除暂停效果。
- 临时动作不会因共享原法术来源而永久可用；法术授予的默认豁免 DC 不再误用受益者属性。
- 重复 Activity ID、缺失授予引用、冲突的授予来源和非法生成结果在导入时拒绝。

## 验证范围

`dnd5eActivityPatterns.test.ts` 覆盖真实伤害/治疗提交、专注解除、模式防伪、资源不足拒绝、回合结束才掷延迟伤害、不同受益者执行临时动作、原施法者 DC、跨包拒绝、撤销授权，以及导入→导出→接收端解析。

区域和位移模板测试检查生成的 Host 提案；实际地图执行使用既有 ActivityMapInteraction、ForcedMovementPersistentAreaCoordinator、persistentAreaTurnBoundary 等回归测试。13 个相关测试文件共 239 项通过。

此验收针对通用接口和上述组合链路。不是对 XGE 每个法术的文字转录、全部交互分支或整本自动化的认证。导出模块仍需逐项通过行为验收，不能仅凭 JSON 合法便标记整本认证成功。

可导入的原创测试文件：`examples/activity-pattern-healing.json`（通过本地 JSON 导入入口验证）。

全项目 TypeScript 检查、Vite 生产构建、修改的 Activity 文件 ESLint、私有内容边界审计、生产包预算通过。标准构建的 architecture 前置审计仍被既有地图大文件/依赖边界超限阻止；本次没有修改审计阈值，独立执行 Vite 完成产物验证。
