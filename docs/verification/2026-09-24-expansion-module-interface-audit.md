# 扩展机制与社区模块接口核查（第一批）

## 结论和边界

当前接口**不能宣称支持所有扩展的特殊机制**。本报告是代码能力审计及第一批修复，不是全部规则书逐项验收。通用法术保持现有通路；内置专属结算兼容层不作为本批必须移除的目标。

暂以 2014 体系的正式出版扩展为范围。2024 修订、UA 和第三方内容不能混入同一条规则结论。尚未获得完整扩展规则资料；现有本地 PHB/SRD、官方公开目录、官方召唤法术介绍和 FVTT 源码不足以证明全量覆盖。

仅排除纯叙事裁量。一个机制需要 DM 判断目标意愿、是否满足触发条件或场景事实，不代表其后续消耗、豁免、伤害、持续时间可以标为纯叙事而跳过自动化。

## 来源与未完成的书目覆盖

| 来源组 | 本次证据 | 状态 |
| --- | --- | --- |
| SRD 5.1 / 本地 PHB 2014 | 项目现有内容与结算代码 | 作为现有能力基线，不等于扩展审计 |
| Tasha’s Cauldron of Everything | 官方目录、公开召唤法术介绍、CPR 2014 实现 | 局部机制比较；全书条目未核完 |
| Xanathar’s Guide to Everything | 官方目录、CPR Chaos Bolt 实现 | 局部机制比较；全书条目未核完 |
| SCAG、Elemental Evil Player’s Companion、Fizban’s Treasury of Dragons | 待收集对应版本正文和条目清单 | 未核完 |
| Wildemount、Strixhaven、Ravnica、Theros、Eberron、Acquisitions Incorporated | 待收集对应版本正文和条目清单 | 未核完 |
| Volo、Mordenkainen、Monsters of the Multiverse；Spelljammer、Planescape、Bigby、Book of Many Things | 待收集对应版本正文和条目清单 | 未核完 |
| 冒险书中的额外法术、专长、物品、怪物能力 | 尚未建立完整出版物清单 | 未核完；不能以主扩展书代替 |

以上是待核查范围索引，不是完整出版物目录。未取得正文的条目不能标为规则已验证。

官方来源：

- [Tasha 官方目录](https://www.dndbeyond.com/sources/dnd/tcoe)
- [Xanathar 官方目录](https://www.dndbeyond.com/sources/dnd/xgte)
- [官方 Tasha 召唤法术介绍](https://www.dndbeyond.com/posts/924-spell-spotlight-new-summoning-spells-from-tashas)：确认需要按形态和施法参数派生召唤物属性；文章不替代每个法术最终正文。

## FVTT 对照方法

固定参考 Chris’s Premades **1.5.48 的 `scripts/macros/2014`**，不使用正在重构的 main，不混入 2024 目录。代码只用来判断自动化架构如何实现；规则正确性仍需对应版本正文。

| 参考实现 | 可观察的技术机制 | 对本项目的要求 |
| --- | --- | --- |
| [Chaos Bolt](https://github.com/chrisk123999/chris-premades/blob/1.5.48/scripts/macros/2014/spells/chaosBolt.js) | 读取两颗伤害骰，提供伤害类型选择，保存已命中名单，重新选目标并启动后续攻击 | 不仅需要伤害总值，还需要骰池明细、结算中选择和可恢复的连锁执行状态 |
| [Summon Beast](https://github.com/chrisk123999/chris-premades/blob/1.5.48/scripts/macros/2014/spells/summonBeast.js) | 读取形态与施法环阶，构造召唤物属性和攻击，再创建召唤物 | 模板、来源属性绑定、专注清理与指令规则必须一起验收 |
| [Spirit Shroud](https://github.com/chrisk123999/chris-premades/blob/1.5.48/scripts/macros/2014/spells/spiritShroud.js) | 命中伤害阶段核查距离、附加伤害与禁止治疗；附近目标回合开始处理减速 | 命中附带效果需覆盖适用攻击类型和距离，附近回合触发必须带来源语义 |
| [Mind Sliver](https://github.com/chrisk123999/chris-premades/blob/1.5.48/scripts/macros/2014/spells/mindSliver.js) | 此文件只有名称、版本声明 | **不能**据此声称其延迟骰机制已核实；需要继续追踪数据包/DAE 等实际实现 |

本批没有复制第三方实现到运行时，也没有把第三方脚本的家规开关视为正式规则。

## 接口能力核查

状态含义：**已接通**有本批执行证据；**已有基础**有代码但未完成全部扩展组合验收；**缺口**不能用当前通用接口完整表达；**待核实**需要继续追踪实际通路。

| 机制族 | 状态 | 代码证据与限制 | 完成验收需要什么 |
| --- | --- | --- | --- |
| 基础伤害、豁免、状态、资源、持续时间 | 已有基础 | Activity operation / Effect / Host 编译通路已存在 | 对具体扩展组合补测试，不以枚举数量代表覆盖率 |
| 自定义状态与到期解除 | 已接通 | `.starmod` → Worker 内容注册 → Activity → Host → JSON 恢复 → 到期解除 | 已有合成模块执行测试；尚不等于浏览器双端验收 |
| 禁止全部或非魔法治疗 | 已接通（本批新增） | `healing-prevention` 暴露已有 Host 禁疗机制；效果期限沿用通用 Effect | 合成模块测试区分两种 scope，并验证期限结束恢复治疗 |
| 数值修正模式校验 | 已修复一部分 | `speed/armor-class/attack-roll/saving-throw/weapon-damage-roll/hit-point-maximum` 拒绝无效 mode | 后续对所有修正字段建立同等的语义校验 |
| 下一次检定才掷骰、修正一次后移除 | 部分接通 | 后续批次开放 `optional-bonus-die`，复用 Host 可选奖励骰；常规 `saving-throw` 加值仍在应用时求值，强制惩罚骰仍缺失 | 补强制消费、多检定定位和任意 Activity 检定入口；不能将可选奖励骰等同强制下一次豁免减值 |
| 骰面驱动的伤害类型及连锁攻击 | 缺口 | Formula 可以求和、取整和缩放；SDK 可读已声明骰子，但没有后续选目标/再攻击的完整受控协议 | 骰面查询、动态合法选项、已访问目标集、逐段执行与恢复；不能仅增加一个公式类型 |
| 可暂停的结算前反应窗口 | 待核实 / 通用 SDK 缺口 | Trigger 有 before/after 枚举；`dnd5eActivityTriggerWindows` 主要转换已发生的战斗事件；Worker action context 没有通用暂停、改写未提交结果的 API | 每个窗口证明暂停发生在提交前；处理所有权、多人竞争、取消和重复提交 |
| 移动 / 动作 / 附赠动作互斥 | 缺口 | 现有动作限制和 Slow 的 action-or-bonus-action 不能据此推导三者互斥 | Host 在移动和所有动作入口共同消费选择锁，回合结束清理，取消不消费 |
| 按来源和环阶缩放召唤物 | 已有基础，未全验收 | summon 已有 HP 下限、AC/攻击/伤害加值、攻击次数公式等；不能直接当成所有属性精确覆盖与继承 | 对 AC/HP/攻击值的加值和覆盖区别、PB、形态、指令、先攻、专注与失控逐项证明 |
| 限距离的全攻击命中附带效果 | 缺口 | `on-hit-bonus-damage` 目前面向武器攻击；target rider 为封闭的显形/光照字段 | 允许受控的攻击类别与距离过滤，以及引用通用 target Effect；不能因能单独禁疗就标 Spirit Shroud 全支持 |
| 移动区域、进入/离开、路径触发 | 已有基础，组合待核实 | 持续区域、移动、重定位和触发机制存在 | 主动/强迫移动区分、每回合频次、跨多个格子去重、传送语义、双端同步 |
| 变形、复制、替换资料卡 | 已有基础，组合待核实 | transform / duplicate operation 存在 | 装备、专注、职业能力保留、临时形态 HP 溢出、结束恢复与保存重载 |
| 临时动作、攻击、物品与资源 | 已有基础，组合待核实 | granted activity / attack / inventory / resource 通路存在 | 所有权、消耗顺序、到期撤销、卸载清理、装备绑定与并发 |
| 脚本级事件订阅和持久执行状态 | 缺口 | SDK 提供内容注册和受控 action；action context 没有通用 hook 注册、执行 continuation 或状态读写接口 | 版本化状态命令、来源/实例命名空间、Host 验证、事务回滚与断线续结算 |
| 职业、专长、怪物与物品扩展的特殊机制 | 未完成覆盖 | 有若干通用及内置能力，但尚无全扩展清单 | 同样纳入逐条机制映射，不能只统计法术 |

关键代码入口：

- `src/rulesets/dnd5e/communityModuleSdk.ts`
- `src/rulesets/dnd5e/pluginSandbox.worker.ts`
- `src/rulesets/dnd5e/activities/dnd5eActivityContracts.ts`
- `src/rulesets/dnd5e/activities/dnd5eEffectContracts.ts`
- `src/rulesets/dnd5e/activities/dnd5eActivityValidation.ts`
- `src/rulesets/dnd5e/activities/dnd5eActivityExecutor.ts`
- `src/rulesets/dnd5e/activities/dnd5eActivityHeadlessCompiler.ts`
- `src/rulesets/dnd5e/activities/dnd5eActivityTriggerWindows.ts`
- `src/rulesets/dnd5e/activities/dnd5eFormula.ts`

注意：AC 的非 add 模式虽出现在 Effect 类型里，Activity 运行时校验会限制可执行模式。不能把类型声明等同于支持，也不能把被拒绝的模式描述成已执行错误。

## 本批落地与验证

1. 新增 `healing-prevention` modifier，scope 为 `all` 或 `nonmagical`；接通 schema、校验、能力注册、执行器和可视编辑器。
2. 复用 Host 的 `preventHealing` / `preventNonmagicalHealing`，不新建按法术名称分支。
3. 增加错误 mode、缺少加值公式、错误禁疗 scope 的拒绝测试。
4. 修正 SDK 示例速度 mode 为 `add` 并重新生成 `.starmod`。此前未知 speed mode 会落入加法分支，并非完全无效；问题是错误值被静默接受。
5. 合成包通过真实 Worker 源码的隔离 VM 初始化，再经真实模块注册及 Host 结算，验证伤害、自定义状态、速度惩罚、禁疗、存档恢复及到期解除。此测试不冒充真实浏览器 Worker / 双客户端 E2E。
6. 本批相关回归：34 个文件、318 项测试通过；`tsc -b` 和 Vite 前端构建通过。修改文件 ESLint 无错误，编辑器原有的 `useMemo` 依赖警告仍在。没有将本批结果写成整个仓库的全部检查通过。

## 全量完成门槛

后续批次已将一次性可选奖励骰开放给社区 Effect 和编辑器，并补多效果选择、DM 无角色卡单位选择/取消。合成模块测试验证无预掷、跳过、d6 实际应用、存档恢复、错误骰值不消费、已消费实例拒绝复用；34 文件 325 测试通过。新增可导入的 `examples/community-sdk/check-boon.starmod`。尚未进行真实浏览器双端人工验收，强制惩罚骰与自定义 Activity 的统一检定交互仍未完成。

每条非纯叙事规则必须有：版本及正文来源、确定性机制拆分、对应接口、合法/非法输入测试、Host 结算测试、持续与重放测试；涉及交互还需 DM/玩家双端验收。实现一个代表性机制不代表整本扩展已完成。

下一批优先补：延迟骰与一次性消费；结算中暂停及合法选择；多段执行状态；动作互斥；召唤物来源参数。上述未实现项目仍是缺口，不因列入设计或注册类型而更改完成状态。
