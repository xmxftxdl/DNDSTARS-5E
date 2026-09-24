# PHB local-content 与 SRD 边界检查

## 结论

未发现本地 PHB 的 42 项额外法术进入 SRD 法术目录，未发现新增本地怪物被加入 SRD 怪物目录。但不能报告为“完全没有混入”：本轮刚增加的 TCoE 坠落碰撞规则直接进入核心引擎和发布 bundle，并误用 SRD 效果命名空间。这是额外规则实现混入 SRD 核心，不是 PHB 本地文件被复制。

本次只做检查和记录，没有修改运行时、删除本地内容或重新提交代码。

## 已核对

- `local-content/` 被 `.gitignore` 和 `.dockerignore` 排除，Git 跟踪的该目录文件数为 0。
- PHB 2014 本地合集清单：42 法术、66 Activity、28 子职业、41 专长、7 种族、12 背景、13 特性、108 物品；该合集未声明怪物类别。
- 核心 SRD 法术目录 319 项、Headless 法术 123 项、SRD 怪物目录 334 项、魔法物品目录 240 项。检查到的目录数量与既有测试一致。
- 比较 `f9bba8cf` 至当前：法术目录、法术名称表、已审校法术正文和怪物生成目录未发生变化；当前未提交改动也没有修改这些目录。
- PHB 42 个法术 ID 与 SRD 319 项目录交集为 0。对 ID、中文名、英文名进行部署源码、shared、dist、public 精确边界扫描，没有发现它们被注册为核心法术。命中仅有 `hex` 十六进制／网格术语，以及 SRD 怪物心灵感应、心灵感应头盔和其他文本中的通用名称，不是同名 PHB 法术条目。
- 对这 42 个法术中长度至少 60 字符的 9 段本地字符串做原样复制扫描，在上述部署范围未发现匹配。这不是对改写正文的全面检测。
- `audit-local-content-boundary.mjs --dist dist` 通过；SRD 来源／一致性、怪物目录、自定义插件相关 4 个测试文件共 53 项通过。
- 法术导入拒绝核心法术 ID 与 `srd-5.1:` 前缀；怪物解析要求自定义内容使用 `room-monster:` 与 `DM 自定义`，插件和房间目录入口都调用该解析。房间／插件目录与 SRD 常量数组分开。

## 发现的问题

### 1. 本次 TCoE 坠落碰撞进入核心与生产包

`src/rulesets/dnd5e/headlessCombatEngine.ts` 的碰撞逻辑使用 `rulesId: 'tcoe:falling-onto-a-creature'`，但倒地效果的 `definitionId` 为 `srd-5.1:falling:collision:prone:...`。

当前 `dist/assets/dnd5e-plugin-compiler-DN06fXji.js` 与 `dist/assets/dnd5eCombatSimulation.worker-Z16XPSdh.js` 均包含该 TCoE 规则标识。它没有经过本地内容／可选规则包启用边界。

建议：SRD 核心只保留通用坠落／碰撞扩展接口；DC、分摊与体型等额外规则声明由独立可选包提供，并使用包自己的命名空间。只改前缀或加一个默认关闭的开关，仍不能保证额外规则数据没有进入发布产物。

### 2. 现有边界脚本覆盖不足

`scripts/audit-local-content-boundary.mjs` 从 `expected` 收集私有条目标识时只接受子职业、特性和部分种族，没有覆盖法术、怪物、Activity、专长、背景、物品；其通过结果不能作为这些类别没有混入的充分证据。

此外，它依赖当前机器存在的 local-content 清单，不能单独证明 SRD 目录成员均来自已审定的 SRD 基线。建议增加独立的核心成员白名单／来源快照，以及所有本地类别的精确标识和正文片段检查，避免把 `hex` 等普通词当成内容泄漏。

### 3. 引擎派生物体与官方怪物目录的来源标签需区分

`truePolymorphObjectForms.ts` 的石雕、巨石、木椅是引擎为变形术生成的物体参数档案，使用 `source: 'SRD 5.1'` 并能通过 `getDnd5eSrdMonster` 获取。它们没有被追加到 334 项官方怪物目录，也没有发现来自 PHB 本地内容，但最好明确标记为“基于 SRD 规则的引擎派生物体”，避免 UI 把它们呈现为原书收录怪物。

`getDnd5eSrdMonster` 本身还会优先查询房间怪物目录；这是兼容运行时查询，不能用该函数是否返回值判断某条内容属于 SRD。
