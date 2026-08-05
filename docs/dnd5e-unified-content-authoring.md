# D&D 5E 统一内容创作接口

## 目标

怪物、怪物动作、法术、特性、专长、职业、子职、种族、背景、物品和属性生成规则统一使用 `dndstars5e-unified-content`。所有内容使用相同外壳，同时保留各类型自己的 `payload`，避免形成一个充满无关可选字段的万能对象。

统一定义由五部分组成：

1. `payload`：该类型的资料字段，例如职业等级表、种族速度、法术学派或怪物属性。
2. `activities`：主动动作、奖励动作、反应、攻击、豁免、伤害、治疗、召唤和持续区域等可执行配方。
3. `effects`：持续时间、状态、抗性、AC、速度、优势/劣势和触发器等效果。
4. `advancements`：按等级授予特性、选择、属性提升、资源成长、施法成长、熟练项和子职选择。
5. `automation`：明确列出 Host 自动处理和仍需 DM 处理的结算阶段。

`ContentDefinition` 是内容目录与归属边界，`Activity / Effect / Advancement` 是机制边界。Headless 不根据正文猜测效果，也不因内容声称 `full` 就跳过配方校验。

## 内容类型映射

| 类型 | 主要 payload | 常用通用贡献 |
| --- | --- | --- |
| 法术 | 环级、学派、施法资料 | Activity、Effect、升环/戏法 Scaling |
| 特性、专长 | 说明、前提、静态资料 | Activity、Effect、Trigger |
| 职业、子职 | 等级、生命骰、职业资料 | Advancement、资源成长、特性授予 |
| 种族 | 体型、速度、语言等 | Effect、特性授予、先天法术 Activity |
| 背景 | 熟练项与背景资料 | Advancement、特性授予 |
| 物品 | 装备和物品资料 | Activity、Effect、充能资源 |
| 怪物 | 完整 stat block | 怪物动作 Activity、Effect、Trigger |
| 怪物动作 | 所属怪物、动作 ID、动作区段 | Activity |
| 属性生成 | 标准数组、购点或掷骰资料 | Host 属性生成流程 |

旧的 V2 `races / spells / monsters / ...` 分数组内容包仍受支持，并继续通过现有投影进入统一内容目录。新工坊和 AI 转换应以统一格式作为输出目标。

## DM 的两级扩展能力

### 1. 声明式内容包

默认工坊输出纯 JSON。DM 可以自由组合 Host 已提供的目标、公式、资源、触发器、动作和效果。这种格式适合绝大多数职业、种族、专长、法术、怪物及战斗机制，并且可以安全地进入 Headless。

声明式内容包不会执行 JavaScript，也不能直接访问 Store、DOM、网络、文件系统或可变战斗对象。

### 2. 本地受信任开发者模块

当现有 Activity operation 无法表达 DM 需要的新机制时，可单独使用 `automation-plugin`。它可以注册新的 Host operation、编辑器控件、解析器或表现层扩展，但必须与普通 JSON 内容包分开，并满足以下条件：

- 仅由本地 DM 明确安装和启用；
- 清楚显示它会执行代码以及请求的能力；
- 在隔离 Worker 中运行可隔离的计算；
- 所有实际战斗写入仍通过 Host 命令和校验器；
- 禁止隐式网络、动态远程代码、`eval` 和直接修改内部 Store；
- 模块停用后应能完整撤销注册内容。

这使 DM 获得接近传统 VTT 开发者模块的灵活度，同时保留 Astral Trace 的 Headless 权威结算与房间安全边界。

## 最小 JSON 示例

```json
{
  "format": "dndstars5e-unified-content",
  "schemaVersion": 1,
  "manifest": {
    "id": "local.example-rules",
    "name": "房间自定义规则",
    "version": "1.0.0",
    "apiVersion": 2,
    "rulesetId": "dnd5e-2014-srd-5.1",
    "publisher": "Local DM",
    "license": "自定义内容",
    "pluginKind": "content-package",
    "distributionPolicy": "local-only",
    "contentCategory": "mixed"
  },
  "assets": [],
  "definitions": [
    {
      "schemaVersion": 1,
      "id": "field-medic",
      "namespace": "local.example-rules",
      "version": "1.0.0",
      "kind": "background",
      "name": "战地医师",
      "payload": {
        "id": "field-medic",
        "name": "战地医师",
        "skillProficiencies": ["medicine", "insight"]
      },
      "automation": {
        "schemaVersion": 1,
        "level": "full",
        "supportedPhases": [
          "eligibility", "cost", "targeting", "attack-roll", "saving-throw",
          "damage", "healing", "effects", "duration", "interrupt", "persistence"
        ],
        "manualPhases": [],
        "limitations": []
      }
    }
  ]
}
```

定义的 `namespace`、`version` 必须与 manifest 一致；有本地内容 ID 的 payload 必须与定义身份一致。Activity、Effect 和 Advancement ID 在同一包内必须唯一。

## 代码入口

- `src/rulesets/dnd5e/unifiedContent.ts`：统一格式、解析、校验和现有注册 API 适配。
- `src/rulesets/dnd5e/activities/`：Activity、Effect、Advancement 的数据协议和校验器。
- `src/rulesets/dnd5e/pluginLoader.ts`：识别统一 JSON、旧 V2 内容包和受信任开发者模块。
