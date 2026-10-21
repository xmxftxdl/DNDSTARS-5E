# 全书自动导入：进行中的验证记录

目标仍在进行，不能据此宣称全书自动化已完成。最终验收包含原始 PDF 读取、结构化转换、模块导出/导入、玩家使用、Host 结算与同步。

## 已取得的实际结果

- 原始 PDF 共 194 页；使用生产 PDF 提取函数得到文字层，本地 RapidOCR 处理 23 个原先无法读取的页面。
- OCR 后仍需检查的第 7、77、147、194 页经过图像分类，分别判为纯插图或空白，保留分类理由。没有把 OCR 失败直接等同于空白。
- 97 个提取窗口已全部通过当前来源校验，得到 **95 个法术、31 个子职业、15 个专长、14 个独立特性，共 155 项**。这表示目录与当前原文边界检查通过，不表示每条规则的完整语义已获认证。
- 提取器由模型重抄正文改为返回页内行号，再由 Host 截取原文；保留旧引用响应的回放能力。
- 独立检查施法字段、子职特性表及先决条件，拦截漏项、重复子能力、截断正文以及一个法术吞入另一个法术的错误。接受 PDF 双栏顺序造成的末尾特性表。
- 界面增加连续处理、有限自动重试、失败隔离；可选的页面图像检查会明确说明发送图像和消耗积分，记录进入缓存与导出报告。
- 新模型输出使用 JSON 对象，避免 JSON 字符串再嵌套 JSON；开放内容对象使用 JSON object 模式，封闭协议保持结构化 schema。
- 通用配置指南提供编译器验证过的虚构示例、真实伤害/状态枚举，以及已注册 mechanic handler 的公开参数白名单。
- 修复 `roll-effect` 编译器：当来源结果具有升环调整时，自动补全派生的豁免成功分支调整，保留作者已有的显式分支调整。

## 真正执行过的行为验证

新提取、新转换的喷火术草稿没有人工修改配置。它经过 `.starmod` 导出、磁盘重新读取、接收端解析，然后进入 Activity 执行器：

| 施法环级 | 豁免 | 骰值 | 预期伤害 | 结果 |
| --- | --- | --- | --- | --- |
| 2 | 失败 | 2、3、4 | 9 | 通过 |
| 2 | 成功 | 2、3、4 | 4 | 通过 |
| 3 | 失败 | 2、3、4、5 | 14 | 通过 |
| 3 | 成功 | 2、3、4、5 | 7 | 通过 |

这四个用例验证了实际生成产物的伤害/豁免/升环，不代替浏览器双端、网络权限、学习资格、地图几何或整书验收。

## 当前缺口与下一步

整书转换首批暴露了系统性配置错误，已停止该批重复请求；目标没有暂停。保留原始响应，本地重放不消耗 API。

1. 将生成协议进一步限制为真实存在的 Activity 模式与字段，避免虚构模式、处理器、伤害类型表达或事件引用。已提供真实枚举和白名单，但仍需用新输出验证。
2. 为目标类型排除、持续期间资格变化、反应中的伤害处理、物品/召唤依赖等机制逐项核查实际 Host 接口；不能仅因模型声称“不支持”就认定接口缺失。
3. 一条原始法术必须维持一个法术条目；多模式和后续动作应绑定到原条目，不能复制成多个法术来绕过校验。
4. 继续转换剩余法术、子职、专长与特性；检查法术引用的附属怪物数据，例如正文不连续的附属资料，应单独提取并建立依赖，不能把中间的其他法术混进原文。
5. 扩展逐机制行为验证、合并包依赖、独立接收端安装与玩家/DM 双端验证。所有这些完成前，不能把预检通过叫作全自动认证。

## 检查

- 9 个相关测试文件、147 项测试通过。
- TypeScript 检查通过。
- Vite 生产构建通过；仍有大块文件提示。
- 私有资料边界审计与生产包预算检查通过，入口 56.2 KiB。
- 构建出的独立接收端 worker 另用新生成的单法术包验证；测试脚本同时检查非法包 ID 被拒绝。

## 私有证据与恢复位置

以下均为用户本机私有测试目录，PDF 原文和转换内容没有加入公共示例：

根目录：`C:/Users/Doco/AppData/Local/StarsApp/local-import-tests/`

- `xge-fresh-20260926/documents.json`：生产 PDF 文字提取结果。
- `xge-fullbook-ocr-20260926/`：逐页 OCR 图像、原始结果和检查报告。
- `fullbook-fieldinventory-20260926/inventory-run.json`：完整 155 项目录，含所有有限重试的请求、响应及来源。
- `fullbook-examples-convert-20260926/conversion-run.json`：停止的转换批次；未返回调用标记为 `interrupted-usage-unknown`。
- 同目录 `replay-run.json`：原始响应经当前 Host 的离线重放，零新增 API 调用。
- 同目录 `fresh-scorcher.starmod`、`runtime-package.json`、`artifact-scorcher-behavior.json`：新产物的隔离行为测试证据。
- `fullbook-usage-20260926.json`：当前目标各批次按 job ID 去重的用量。已知输入 **2,864,026**、输出 **115,981** token；另有 **2 次调用用量未知**，没有按零计费处理。此计数不含此前目标开始前的试验。

恢复脚本在 `.codex-logs/fullbook-*.test.ts`，所有付费脚本均有显式环境变量开关及调用上限。不要把脚本测试进程退出码当作全书成功，必须检查报告中的逐项状态和行为证据。现有房间没有被覆盖。

## 后续进展：原文正文完整性与通用排除接口

本轮仍未完成全书自动化认证，目标保持 active。

- GPT-5.6-Luna 转换请求新增受限 reasoningEffort=medium；默认其他请求仍为 none。JSON object 模式现在也获得实际输出 schema。3 条原文探针均产生可解析草稿，但仅 1 条通过自动化预检，不能据此声称整书成功。
- 连续处理会重新预检已有草稿，重试 blocked 条目，使用同轮最新反馈，且每条仍最多 3 次；不会仅因存在草稿而跳过。
- 通用 Activity target 新增 excludedCreatureTypes。Host 按真实生物类型排除对应目标的豁免和效果，其他目标继续；普通逐目标骰配方和触发结算也接入。测试包含构装生物混在正常目标中，以及非法空类型列表被拒绝。
- 混合类型探针揭示旧目录的语义遗漏：先祖守卫只含介绍及等级表。已加入子职等级表与实际能力标题/正文的完整性检查，并限制在当前子职范围，避免下一子职同名能力导致误报。完全包含于子职原文的重复能力自动合并，并输出记录。
- fresh inventory 当前 lineBoundaryRevision=7，97 窗口全部通过，仍为 95 法术、31 子职、15 专长、14 独立特性；这是原文检查，不代表机制完整性或行为认证。
- 当前回归 6 文件 80 测试通过，类型检查通过。日志 fullbook-round-tests.log / fullbook-round-typecheck.log。后续提取去重修改仍应在最终回归覆盖。
- 新私有探针目录 fullbook-reasoning-convert-20260926 和 fullbook-mixed-convert-20260926；混合探针因发现原文缺失主动停止，未返回用量单独标未知。此前用量汇总尚未纳入本轮，不应当作累计最新值。

下一步：使用修复后的 source.text 继续各类型转换；进一步验证免疫类型接口的真实自动生成；补足被动能力、触发资格/期限、依赖数据，并完成模块接收端及双端实际行为验证。

补充恢复点：修复后原文的混合转换批次正在 fullbook-mixed-repaired-source-20260926 运行（.codex-logs/fullbook-mixed-repaired-source.test.ts，最多 9 条、各 2 次）。截至本轮末，三个子职仍有自动化缺口，不要将其称为成功。Activity 导入校验增加顶层形状检查，防止子职声明误放 activities 后仅返回 undefined.kind，新增对应测试。构建在本轮前一组改动后通过；这一最后校验修改需继续正常验证。

本轮结束核对：mixed-repaired-source 的 9 条转换已结束，0 条达到预检 ready（各自仍保存原始结果与失败原因）。这不是全书转换成功。发现 AI 未得到专长/特性的根协议，已补入实际 Feature/Feat、静态修正、被动效果与构筑 advancement 协议，并明确字符串 automation、完整 declarativeAbility 与 Activity 的区别；尚待新付费探针验证。最后新增校验回归 3 文件 41 测试通过；feature-guide 相关测试通过；fullbook-corrected-typecheck.log 对应进程退出码 0，确认最终类型检查通过（早先测试快照 controller 类型错误已经修正）。

## 通用按骰值减伤（后续轮次）

新增 damage-mitigation-interrupt.reductionDice 与 requiresRage。reductionDice 可指定 count/sides 及按明确 classId 的等级 upgrades。Host 验证实际骰值数量和范围，在同一伤害事务中只消费一次减伤额度与反应；非法提交回滚，狂暴结束不能继续使用。三个地图入口（怪物攻击、法术伤害、玩家武器攻击）在接受反应后投骰并传递结果。新增实测覆盖 6/10/14 级、总等级 20 的多职业隔离、非法骰、狂暴资格及原始状态不变。

验证：damageMitigationInterrupt/advancedDefenseMechanics 共 12 测试通过；加入 localContentAiImport 后 31 测试通过。fullbook-rolled-mitigation-types.log 对应进程退出码 0，Vite build 通过。尚未做双端可视 UI 验收，不能将三个入口的代码接入等同网络流程验收。

自动转换证据：fullbook-feature-contracts-20260926 的 6 条探针仍全部 blocked，但专长根结构错误有所减少；不能称为已完成。fullbook-rolled-mitigation-convert-20260926 与 fullbook-rolled-mitigation-guided-20260926 原始响应已自动生成 reductionDice/requiresRage，但仍误报 includeSelf 排除能力和错误生成条件，因此整个子职未通过、不能作为完整行为成功证据。已继续补全 Host 绑定边界提示及虚构减伤结构示例，等待新的原文转换验证。

最新用量快照：fullbook-usage-latest-20260926.json。已知输入 4,993,118、输出 217,658 token，292 次有用量调用，另 3 次历史用量未知（不计为零）。.codex-logs/fullbook-usage-snapshot.mjs 可按 jobId 去重重算。上述所有新付费探针已结束，没有背景转换进程需要等待。

## 协议检索与自动产物反应结算验证

新增有限的两阶段转换：PDF 子职/专长/特性先从实际 TypeScript 声明构成的机制索引检索，再将选中机制及共享协议提供给作者模型。只允许索引内 kind，拒绝重复/虚构项；检索不授予权限、不认证规则覆盖。检索和生成均记录为独立 provider 请求，返回估算积分包含两步。普通单条编辑默认不增加检索调用。生产 PDF 连续转换已启用。

真实原文探针 fullbook-planned-convert-20260926 已结束。初次输出含非法 choice.description；自动重试生成了正确减伤机制但漏 cost。Host 通用规范化现仅在 before-damage-taken + damage-mitigation-interrupt 且完全没有 cost 时补 reaction，这是该已声明机制的唯一合法成本，绝不覆盖显式冲突成本或猜伤害数值，并记录说明。该正常转换逻辑已用原始响应离线重放，不改写私有配置。

产物验证脚本 .codex-logs/fullbook-planned-behavior.test.ts：整份自动输出经生产规范化导出 generated-reaction.starmod，再从磁盘读回并通过接收端 parser 安装插件；测试该产物中的精魂之盾在 6/10/14 级对友方及非友方目标减伤、消耗反应、排除自身和未狂暴情况。6 组实测均通过。报告在 fullbook-planned-convert-20260926/generated-reaction-behavior.json。整个子职仍有未自动化能力，报告明确 wholeSubclassVerified=false，不能据此宣称整书完成。没有更改真实房间。

本轮 5 文件 42 测试通过，生产构建、私有资料边界审计、入口预算检查通过。最终类型检查见 fullbook-plan-final-types.log（本段记录时进程仍在运行，应核对退出码后确认）。最新 token 快照已知输入 5,079,659、输出 223,709，共 296 次已知用量；3 次历史中断用量未知。所有本轮付费转换均已结束。

下一步优先补足实际机制和依赖并扩大全书转换：先祖护卫的标记/攻击包抗性、减伤实际数值反击、免法术位与材料的施法授权、专长/魔能祈唤对已有种族及职业资源的引用。不要因字段/协议误用继续盲目扩大全批付费重试；也不要把模型的 unsupported 文字直接等同引擎缺口。
最终核对：fullbook-plan-final-types.log 对应类型检查进程已退出，退出码 0；本轮类型检查确认通过。

## 被动条目的预检修正

PDF 预检现在区分 Activity、static-modifiers、passive-effects 和 advancement 执行路径。纯被动 full 特性/专长不再因没有 Activity 而误拦截，但依然只是 ready-for-behavior-tests、behaviorVerified=false。partial/manual、unsupported 和未覆盖的 declarativeAbility 仍阻止通过，不用一个静态字段掩盖其他未验证行为。

负例测试发现既有静态属性校验会忽略未知字段。现已复用实际注册时的字段与值校验到特性/专长导入，并令注册器拒绝未知字段；杜绝虚构字段被静默丢弃后误报可执行。测试覆盖合法静态先攻、构筑属性升级、partial、缺口、未知字段和越界数值。

验证日志：fullbook-passive-validation-tests.log（3 文件 25 项）；fullbook-passive-runtime-tests.log（contentPackageV2 16 项，含种族/专长注册后投影到 Headless 的实测）；fullbook-passive-final-tests.log（新增预检用例）；fullbook-passive-build.log（构建通过）。类型检查见 fullbook-passive-types.log，需以进程退出状态为准。此轮无新增付费调用，未操作真实房间。

## 全条目转换与真实多目标行为修复

已核对上一节类型检查退出码为 0。启动 fullbook-all-current-20260926，对修正后的 155 条源资料运行生产转换；每条最多两次、总请求上限 600（包含机制规划），逐项断点记录。此批进程在本节写入时仍运行，约 27 条已进入处理、仅 2 条结构预检通过；不是完整转换成功。该批加载的是启动时的协议，下面新字段不会热加载，应在批次结束后用新协议重试对应失败项，不应启动重复全量批次。日志 fullbook-all-current.log，报告保存在私有 local-import-tests 目录。

新增未穿甲 AC 基础公式接口 unarmoredArmorClassBase 与显式持盾资格 unarmoredArmorClassAllowsShield。角色实际持有的种族/特性/专长参与计算；公式取最高适用值，不叠加，穿甲时停用，盾牌只加一次。装备回归覆盖所有权移除、穿甲/卸甲、负敏捷、多个公式及野蛮人既有公式。自然武器仍是独立待办，不能将这部分标为整个相关专长已完成。

新增 Activity target.maximumTargetSeparationFeet；Host 从地图成对距离提供事实，全部目标两两校验，未知/非有限/负距离及超限拒绝。客户端命令不能提供此授权数据。已接入普通 Activity 权限入口及法术编译器，覆盖三目标后两者超限和伪造客户端距离负例。

新原文转换探针 fullbook-pair-limit-convert-20260926：造成恐惧第二次自动反馈重试结构通过（第一次产生空成功分支，未手改配置）。导出 generated-fear.starmod，磁盘读取、接收端解析并安装，使用实际 prepareDnd5ePluginSpellCast/resolvePreparedDnd5ePluginSpellCast 验证。真实产物揭露 unique-by-source 原来会全场移除同源效果，导致第二目标擦除第一目标。修正为每个承受者单独替换同来源副本，同时限制 definitionId 前缀边界，避免擦除相似 ID。通用回归验证多目标共存、同目标刷新、不同来源副本共存。

generated-fear-behavior.json 已通过：单目标、升环双目标失败/成功、亡灵跳过、目标两两距离超限拒绝且不扣法术位、合法施法恰扣一次法术位、目标回合末重复豁免仅解除该目标、结束专注清理另一目标。没有手改自动产物。此为生产玩家施法事务与 Host 的隔离测试，尚不是真实房间网络/界面双端验收。

验证：fullbook-pair-regression.log 四文件 165 项通过；fullbook-pair-behavior.log 私有自动产物验证通过；fullbook-pair-final-types.log 已确认退出码 0；fullbook-pair-build.log 生产打包通过。最新已知 token 快照（06:46 UTC）输入 7,074,119、输出 339,879，352 次已返回用量；另 1 次正在调用及 3 次历史中断用量未知。整书自动化目标仍未完成，不能用当前少量成功案例替代剩余条目的验收。

## 召唤依赖、永久期限与伤害选项

全量转换进程已再次按真实进程验证仍在运行。新增 fullbook-status-matrix.mjs 从原始 155 项清单和实际转换报告生成私有逐项索引，明确区分尚未处理、转换错误、覆盖阻塞及仅结构就绪，全部不冒充行为认证。07:00 UTC 附近快照：114 项尚未进入、16 项转换错误、23 项覆盖阻塞、2 项结构就绪；进行中的重试可能仍带上次错误，必须结合批次未结束标记阅读。

转换请求现在检索实际内置 SRD 怪物目录，只提供原文提及且可解析的 ID/名称/类型/CR，不生成不存在的属性块，也不因为已有内置数据未在 PDF 重述就断言缺资料。缓存配方已更新。fullbook-dependency-convert-20260926 两次付费探针已结束：第二次开始引用五种真实怪物，但整体仍失败，不能算获得高等坐骑转换成功。鹿鹰兽未在已安装引用中，确实仍需额外资料；生成稿还有活动格式及语义问题。

探针暴露永久召唤必须填写虚构持续轮数的问题。现在 persistent:true 可省略 durationRounds，临时召唤仍要求有效轮数。内部旧地图协议的数字时钟保留适配值，persistent 标记明确禁用到期判断；编辑器在长期伙伴模式隐藏轮数。相关编译/永久召唤生命周期/缓存回归 4 文件 65 项通过。类型检查曾指出编辑器仍要求 number，已修正该输入；最终 fullbook-dependency-verified-types.log 对应进程在本节写入时仍运行，不能把只有标题的日志当通过。

新增 damageTypeChoiceId：直接引用以伤害类型为 option id 的闭合选择；与按骰点决定类型的 damageTypeFromRoll 互斥。Host 验证选项及实际选中值，继续按最终类型处理伤害。测试覆盖两种合法类型、未提供选择、未列入类型、缺失引用，3 文件 42 项通过。修复 automation capability 缺 limitations 时抛 undefined.length，改为返回具体字段错误，并验证等级枚举；不得吞掉缺口文字。

fullbook-dependency-final-tests.log 4 文件 34 项通过；fullbook-dependency-last-tests.log 最后选择/校验回归通过。fullbook-dependency-build.log 构建通过，但之后编辑器与最后字段校验有小改，应最终再构建。边界审计与入口预算已通过当前 dist。06:58 UTC 已知用量输入 8,023,619、输出 409,769；378 次已返回用量、1 次正在调用、3 次历史中断未知。未修改真实房间。后续应继续全量批次、修复实证缺口，并对最终代码再做类型/构建核对，不要重启仍活着的全量转换进程。

## 缓存分层、动态形态与实际伤害依赖

已确认上一节 fullbook-dependency-verified-types.log 退出码 0。修复 cone 的 rotatable 校验与既有执行器不一致；仅将无歧义的 automation phase movement 归一到 effects，保留手动阶段及限制。相关 58 项通过。

PDF 缓存现在独立保存来源提取结果与转换草稿。SDK/提示版本变化可复用同一 PDF、相同排除页及提取版本的来源结果，但不恢复旧草稿、旧预检或错误状态；来源版本变化及当前缓存损坏仍拒绝恢复。UI 明确提示需重新转换。缓存 7 项通过，未迁移没有来源版本标识的旧缓存。

新增 choices.optionsFrom=srd-beast-forms，由 Host 实际内置野兽资料生成选项，拒绝伪造形态；玩家法术准备与执行器均解析动态选项。transformation 模板支持 formsFrom 和 check.allowWillingFailure，同一次施放的不同目标可选不同形态。模板回归 23 项通过；最终形态/选项/缓存相关 4 文件 29 项通过。两个新群体变形术自动探针仍失败：第一个误判已有能力缺失；第二个开始使用动态目录，但漏 transformation.target 且仍含限制。没有手改草稿来冒充转换成功。补充了具体字段错误及异常选项的可修复诊断，缺 label/options 不再抛 undefined.trim/some。

实际导出再导入的旧“生命转换”草稿揭露语义错误：施法者有暗蚀抗性时受到 7 点伤害却治疗 28 点。失败报告保留在私有 fullbook-all-current-20260926/generated-life-behavior.json。新增通用 healing.damageResult（operationId、subject、multiplier），引用同 outcome 中更早的伤害操作，amount 要求 constant 0。Host 在抗性、免疫、减伤后记录真实伤害；后续治疗向下取整，沿用一百万上限。直接提交与安装插件编译器两条路径都接入；引用必须来自本次更早的对应目标操作，拒绝前向、缺失或错主体引用。测试覆盖抗性、免疫、易伤、临时生命值吸收、减半取整与失败前不修改状态。

fullbook-life-result-convert-20260926 从原文重新自动生成，正确使用 damageResult，未人工改配置。导出 generated-life.starmod，再读入执行：3/4 环 × 有/无抗性四例通过。此探针验证隔离 Activity/Host 行为；尚未验证真实房间网络。通用插件编译器路径另有实际安装测试。fullbook-damage-result-regression.log 53 项、fullbook-damage-result-final-tests.log 133 项通过；fullbook-damage-result-final-types.log 明确退出码 0。npx vite build 通过（fullbook-damage-result-build.log）。标准 npm run build 则被架构审计拦住，包含页面行数/依赖预算及分层依赖违规，详见 fullbook-beast-pattern-build.log；不能把单独打包通过写成完整构建通过。

07:29 UTC 全量转换仍未结束：155 项中 74 尚未进入，23 转换错误，51 覆盖阻塞，7 仅结构就绪。进行中条目可能保留前次错误。最新已知输入 10,980,186 token、输出 604,272，461 次已返回用量；1 次进行中及 3 次历史中断用量未知。新协议不会热加载进仍运行的全量批次，后续应按实际失败类别定向重试。尚未完成整书导出、全条目行为认证或双端房间验收。

## 分段成长与 PDF 内生物依赖

本轮开始通过实际进程确认全量转换仍运行（node 4304/63120），未重复启动。补充经过真实执行器验证的阶梯成长示例：custom-table 的 value 表示累计新增步数，测试覆盖 1/4/5/10/11/16/17/20 级。第一轮亡者丧钟探针解决了成长误判，但又将“受伤目标”误写成历史受伤记录。补充当前 HP 与最大 HP 比较的已有谓词说明后，fullbook-tier-hp-convert-20260926 自动生成两个正确条件分支。原样导出 generated-cantrip.starmod、从磁盘重读，32 例覆盖两个 HP 分支、豁免成功/失败及全部等级边界；仅需要所选分支的伤害骰，成功豁免不要求伤害骰。没有人工改配置。此为隔离 Activity 行为验收，尚非真实房间/完整玩家事务认证。

发现原始 PDF 的迷你仆役属性块在第 170 页，而法术正文位于第 169 页，之前没有传给转换器。新增 pdfSpellAdjacentStatBlocks：从同文档原文页检索明确同名的相邻生物属性块，要求体型、AC、HP 证据，保留页码，去除重叠窗口重复，并在下个条目前停止；相似名称、缺证据及远处页面不匹配。Dnd5ePdfSpellImporter 已接入，转换缓存版本升至 pdf-content-9-adjacent-stat-evidence，来源缓存保留。24 项 PDF/缓存测试通过，实际 PDF 离线证据测试证明找回 AC15、HP10 和挥击原文，且未夹带亡者丧钟或转化岩石。

fullbook-adjacent-convert-20260926 仍转换失败，生成的怪物字段不合协议，另有 bondKey/期限和自动化等级错误；不能把“已找到资料”当成“召唤已可自动化”。修复法术路径无条件删掉怪物协议的问题：附有明确属性块证据时保留怪物字段说明，普通法术仍不附带。相关最终 3 文件 51 项通过。fullbook-adjacent-schema-convert-20260926 是使用修复后协议的两次上限探针，本节写入时仍运行。

fullbook-adjacent-types.log 类型检查、fullbook-adjacent-build.log 单独 Vite 打包均已核实退出码 0；最后怪物协议调整后另启 fullbook-adjacent-final-types.log 和 fullbook-adjacent-final-build.log，尚须轮询真实退出码。标准 npm run build 的架构审计失败仍保留，未提高预算掩盖问题。

07:43 UTC 主批次已进入第 96 条（开始子职业）：59 未开始、1 处理中、28 转换错误、59 覆盖阻塞、8 仅结构就绪。已知累计输入 12,271,882 token，输出 688,059；497 次已返回用量，另 1 正在调用、3 历史中断未知。所有新的成功案例和失败证据均在私有 local-import-tests，未修改用户现有房间。

### 拒绝稿完整修复上下文

已核实 fullbook-adjacent-final-types.log 与 fullbook-adjacent-final-build.log 退出码均为 0，随后边界/包预算通过。fullbook-adjacent-schema-convert-20260926 已结束但不成功：第二次返回 unknown automation level: partial；前次怪物字段错误已减少，仍不能认证整个召唤机制。

进一步发现重试缺陷：Host 拒绝的完整草稿被丢弃；即使上层拼进 repairFeedback，也会被错误文字的 2000 字符上限截断。新增 Dnd5eLocalContentAiDraftError.rejectedDraft 与独立 repairDraft 数据文档；保留完整 JSON，不把草稿当系统指令；内部模型回退同样带上拒绝稿，并计入输入 token 估算。PDF 上层的原文元数据校验失败也保留候选稿。缓存明确保存 rejectedDraft，但不计成功、不供导出；协议升级只恢复来源时仍清除它。作者配方更新为 pdf-content-10-rejected-draft-repair。

fullbook-repair-final-tests.log 两文件 31 项通过，包括超过 4000 字符草稿末尾仍完整进入下一次请求，以及缓存恢复不会把拒绝稿提升为成功草稿。类型检查曾因项目 erasableSyntaxOnly 不允许构造函数参数属性而失败，已改为显式字段；fullbook-repair-final-types.log 对应进程在此段写入时仍运行，不提前声称通过。fullbook-repair-context-build.log 单独 Vite 打包通过，但之后有缓存字段投影和类字段的小修，仍需最终构建核对。全量主进程仍活跃，不应重启。

## 子职装备条件防御与协议可见性

已轮询确认 fullbook-repair-final-types.log 退出码为 0，主批进程仍在运行。根据锻造领域的实际失败记录，扩展通用 passive-defense：armorClassBonus 支持数值及 requiresHeavyArmor；damageResistance 支持 requiresHeavyArmor，与既有 delivery/magical 条件共同作用；damageImmunities 提供独立的无条件免疫。装备 AC 与角色战斗快照都接入真实能力所有权，卸甲或移除能力后不保留装备条件加值；损坏护甲不会保留条件抗性。这里未新增免疫的装备条件，不能把字段能力描述成超过实际协议。

fullbook-armor-passive-tests.log 两文件 37 项通过，包括重甲、轻甲、未穿甲、能力移除、免疫保留及既有通用防御行为。fullbook-armor-passive-types.log 退出码 0。fullbook-armor-passive-convert-20260926 使用新协议尝试完整子职，第一次因共享资源消耗写法失败，第二次机制规划服务失败；整个子职仍未通过，没有以局部通过代替整项完成。

补充子职转换上下文中原先缺失的 Dnd5eAdvancementDefinitionV1（已有升级事务支持）；这些类型此前仅附在专长/特性指南中。规划裁剪后也保留构筑协议，子职升级事务回归通过。新增从真实 classDefinitions.ts 的字面量声明读取共享职业资源 ID/名称，去重后只提供数据参考，避免复制执行函数或创造新资源。指南明确区分 cost.resources（scope:core）与独立 cost.uses/limits.uses；资源资格和余额仍由 Host 校验。

对 Activity 的 partial 元数据别名只做保守规范为 assisted，保留 manualPhases、limitations、unsupported，不提升覆盖等级，也不吞掉缺字段错误。相关转换器测试通过。最新 fullbook-armor-final-types.log 与 fullbook-armor-final-build.log 在此段写入时仍运行，须核实退出码；标准构建的架构审计失败仍未修复。

08:03 UTC 主批：47 未开始、1 处理中、34 转换错误、65 覆盖阻塞、8 仅结构就绪。已知输入 13,478,772 token，输出 767,688，546 次已返回用量；另 1 正在调用、2 次服务失败无用量、3 次历史中断未知。总账未将未知用量算成零。目标仍未完成。

## 子职成长声明在统一内容投影中的保留

已核实 fullbook-armor-final-types.log 与 fullbook-armor-final-build.log 均退出 0。发现 subclass.advancements 在旧运行时注册路径存在，但统一内容投影只生成能力 grant 和施法进度，丢失显式 build-grant/select。现保留原始成长声明，与合成 grant 一并通过 definition 的深拷贝进入统一定义；未修改不同结构的 DeclarativeClassAdvancementV1，也未声称职业进度迁移已全部覆盖。

fullbook-subclass-projection-tests.log 两文件 31 项通过：字节序列导入、显式选择与固定授予保留、缺选择时无部分修改、选择后获得两个熟练项、独立对象及包安装。第一次测试因将字符串误传给 ArrayBuffer 解析接口而失败，已修正并重新通过。fullbook-subclass-projection-types.log 类型检查仍在运行，需轮询退出码。

新隔离探针 fullbook-subclass-repair-convert-20260926 使用最新被动防御、成长接口、核心资源参考与完整 rejectedDraft/repairDraft 通路，针对锻造领域重新自动转换，最多 2 次尝试、8 次调用；没有编辑生成配置。主批次仍独立运行，未重启或覆盖。该探针尚未完成，不能记作成功。08:12 UTC 已知总用量输入 13,942,828、输出 801,059 token，567 次有用量；2 次调用中，2 次失败和 3 次历史中断用量未知。

## 子职切片边界与被动机制校验

上一轮 fullbook-subclass-projection-types.log 确认失败，原因是新增测试将 readonly 数组传给 Vitest 的可变数组参数，已改为复制数组；之后 fullbook-source-boundary-final-types.log 核实退出 0。

主批实际产物显示征服之誓切片包含了救赎之誓，魔射手也混入骑兵。新增基于双语标题及同名特性表的独立边界校验，并返回可核对的最晚 endPage/endLine，普通子能力标题不会当成新子职。来源配方升级 pdf-source-8-subclass-boundaries，完整配方升级 pdf-content-11-subclass-source-boundaries，旧来源缓存不得自动标为通过。未修改主批正在读取的历史清单。

隔离 fullbook-boundaryinventory-20260926 从旧清单逐窗口重验，仅重新调用不合格窗口。第一次 3 次调用修复了部分窗口；加入明确行号后再用 2 次有界尝试，仍剩第 29 页窗口错误（模型将遮影矢子能力当作独立条目并无法通过原文核对）。当前 complete=false，155 是旧/新混合候选数量，不是全书完整认证。对应原始请求、响应和错误均保留；不得把测试进程退出 0 当作清单完整。

实际渲染检查 PDF 第 23、24 页：隐匿通途仅出现在梦境结社等级表中，两页正文直接从月光阴影的炉心接到梦境行者，原 PDF 确实缺这一能力正文。图像私存 fullbook-page23-review.png、fullbook-page24-review.png；缺资料限制必须保留，不从模型记忆补写。

fullbook-subclass-repair-convert-20260926 终止于被动能力校验，不成功。最新拒绝稿已采用成长声明和共享资源，但 passive-defense 的 passive 触发器被旧的“被动资料必须 manual”分支误拒绝。现仅允许明确 passive-defense 机制进入该触发器，仍拒绝无机制的 full 被动条目和未执行 effects；修复仅 armorClassBonus 或 damageImmunities 时误判 no effect。真实装备/角色快照测试改用 passive 触发器以验证导入后的运行路径。

fullbook-source-passive-final-tests.log 四文件 91 项通过。最新 fullbook-source-passive-final-types.log（会话 96850）和 fullbook-source-passive-final-build.log（会话 80130）仍待核实。标准构建的架构审计问题仍未修复，单独 Vite 构建不能代替它。全书主批仍活跃；当前 39 未开始、1 处理中、38 转换错误、69 覆盖阻塞、8 仅结构就绪。

## 全部窗口重新校验与原始响应重放

已核实 fullbook-source-passive-final-types.log 和 fullbook-source-passive-final-build.log 退出码 0。第 29 页失败不只是尾部越界：模型重复输出子能力，遮影矢标题与前段末句共用一行，重复项因此不能满足“以标题开头”的校验。

resolvePdfExtractionAnchors 现在仅利用同名特性表确认的下一子职双语标题校正过长结束边界；必须是原文切片内唯一完整行，不按散落叙事提及裁切。最终完整性与原文证据校验仍执行。finalizePdfExtractionOutput 将同一流程开放给原始响应重放：先验证父子职原文，再合并页面范围和全文均包含在父条目内的重复 feature，未在原文出现的名称仍拒绝，不丢弃真正独立的能力。

fullbook-boundary-replay.log 实际重放模型原始 pdf-spells-96be9cf3-bcc2-4d82-a8fa-2f77dfe0407f.response.json，未手工修改原始响应或生成配置，未新增 AI 调用。私有 fullbook-boundaryinventory-20260926/verified-inventory-run.json 已对全部 97 个窗口重新校验通过，155 项（95 法术、31 子职、15 专长、14 独立特性）。这证明边界/完整性检查通过，不证明 PDF 自身无缺文或所有语义与机制已完备。下一批应使用 verified-inventory-run.json 与同目录 documents.json，不再复用主批旧的混入切片。

来源配方升级 pdf-source-9-verified-parent-boundaries，完整配方 pdf-content-12-verified-parent-boundaries；旧缓存不自动通过。fullbook-anchor-finalizer-tests.log、fullbook-verified-boundary-tests.log 通过，包括相邻子職、重复子能力、捏造名称拒绝。最新 fullbook-verified-boundary-types.log（6825）和 fullbook-verified-boundary-build.log（69031）待轮询。

fullbook-passive-replay.log 对原封不动的锻造领域拒绝稿做当前预检：被动防御旧错误已消失，仍停在 weapon-damage-rider targeting.relation=any 被仅允许 enemy 的校验拒绝；另保留锻造祝福物品绑定、铁匠祝福物品生成的真实缺口。未将该子职计为自动化成功。发现 Headless rider 路径本身也未读取 relation，可作为后续机制一致性修复点，需要真实友敌攻击测试后调整，不能仅放宽 schema。

08:25 UTC 已知输入 14,690,898、输出 844,297 token，604 次有用量；1 次调用中、3 次服务失败及 3 次历史中断用量未知。主批继续运行，未重启，整本目标未完成。

## 武器追加伤害的目标关系与被动预检

已核实 fullbook-verified-boundary-types.log 与 fullbook-verified-boundary-build.log 退出 0。锻造领域原始自动稿的 weapon-damage-rider 使用 relation:any，原验证器仅允许 enemy；实际 rider 取值路径又未判断目标阵营，造成 schema 与运行语义不一致。现允许明确 enemy/ally/any，并将真实目标传入 Headless rider 选择，按既有 controller 友敌关系执行。新增六组实际攻击用例，分别验证候选骰及最终伤害；不只是放宽验证器。

预检对 passive-defense 的识别现在要求 authorityBinding 指向包内实际存在、同 ID 的子职业能力，且该能力为 passive-defense、执行路径为 headless-event-engine；这种被动快照能力无须再作为主动法术编译。仍保留其行为未验证状态和独立 unsupported 阻塞，未泛化为信任任意 authorityBinding。

原封不动的锻造领域拒绝稿再次重放，current-preflight.json 现在可读取 5 个 Activity、识别 passive-effects；仍 blocked，剩余为锻造祝福和铁匠祝福手动结算及其声明限制，未将其认证成功。这里未增加 AI 调用，未编辑生成配置。

fullbook-rider-relation-tests.log 和 fullbook-rider-passive-tests.log 通过。fullbook-rider-final-tests.log 已核实退出 0，覆盖通用战斗与完整 headlessCombatEngine 测试。最终 fullbook-rider-final-types.log（99071）、fullbook-rider-final-build.log（73231）仍待轮询。全书主批仍在运行，整体目标未完成。

## 生成范围法术的真实施放链路

已核实 fullbook-rider-final-types.log、fullbook-rider-final-build.log 退出 0。对主批原始雪球群生成稿执行导出 .starmod、磁盘读取、解包、安装插件、玩家准备、Host 结算，首次实际失败：范围内只有 first 被保留，提供两个目标的骰值则 invalid-dice。将 second 移到同格仍失败，故不是边缘几何问题。

根因是 pluginSpellTransaction 仅从 creature Activity 读取目标上限；area Activity 尽管声明 maximumTargets=256，仍回落到旧 spell.targeting 缺省的 1。此外区域筛选也读取旧 includeSelf/relation，没有采用 Activity。现统一从已缩放 area target 获取上限与敌友/自身规则，保持 Host 根据真实地图区域选取目标，不信任客户端给的列表。

fullbook-area-target-tests.log 84 项通过，新增 synthetic imported Activity 的 any/ally/enemy 三组真实准备与结算，验证自身纳入、多目标保留、范围外排除。fullbook-snowball-behavior.log 实际原始稿恢复 second 在相邻格后也通过：2/3 环、同次施法两个不同豁免、伤害分别 9/4 和 14/7、范围外不受伤、法术位仅消耗一次、原始角色输入不被修改。私有 fullbook-generated-snowball-20260926/generated-snowball.starmod 与 generated-behavior.json 保留证据；未改写生成配置，未新增 AI 调用。验证范围是玩家请求到 Host 的隔离事务，不包含真实双客户端网络同步。

fullbook-area-target-final-types.log（41371）与 fullbook-area-target-final-build.log（49848）仍待核实。全书主进程确认仍活跃；旧诊断批当前 25 未开始、1 处理中、41 转换错误、80 覆盖阻塞、8 仅结构就绪。新的范围行为成功是独立证据，未擅自将全书状态提升为成功。

## 升阶引用完整性与攻击戏法行为反馈

已核实 fullbook-area-target-final-types.log 和 fullbook-area-target-final-build.log 退出 0。原主批“结构就绪”的吸收元素把 scaling.operationId 指向其他 Activity，原初蛮击把阶梯表放在 character-level（运行时按线性等级增长）而非 custom-table。新增结构校验：缩放操作引用必须在当前 Activity；table 只允许 custom-table，要求数字递增等级和非负整数步数；畸形 scaling/adjustments 不抛空指针。原生 core-spell-transaction 的 host-settlement 目标/投射物计数凭据有明确窄例外，不能借此允许普通导入 Activity 引用缺失操作。初轮回归因漏掉此原生约定失败，修正后 fullbook-scaling-gate-tests.log 110 项通过。

fullbook-primal-repair-convert-20260926 自动接收原始拒绝稿及新校验错误，未手工修改配置；模型正确生成 custom-table 的 0/1/2/3 新增步数。实际导出重装和玩家事务测试随后发现重击缺 critical:double-dice。未命中测试开始未提供伤害骰，当前统一骰协议预先验证声明骰池而返回 invalid-dice；按该协议提供骰池后未命中正确不扣伤害，仍未声称实现命中后才掷伤害的分阶段流程。

fullbook-primal-critical-convert-20260926 根据实际失败自动修复，但生成两个 success/critical-success outcome，共用骰池而 critical 设置冲突，重击仍 invalid-dice。指南补充：success 包含 critical-success，普通命中伤害只需一个 success outcome 搭配 damage.critical:double-dice，原文独立额外重击效果才另建分支。fullbook-primal-final-convert-20260926（会话 64593）正在使用完整拒绝稿继续有界重试；未将上述任一部分证明为完整行为通过。

fullbook-scaling-final-types.log（10705）和 fullbook-scaling-final-build.log（86586）仍待核实。原全书主批仍运行；此轮未重启主批、未改写用户房间。下一步应先核实 primal-final 实际结果，再将 .codex-logs/fullbook-primal-critical-behavior.test.ts 的私有输入目录指向新的自动稿，原有 24 个等级/攻击结果预期保持不变。

补记：64593 已结束。fullbook-primal-final-behavior.log 已核实退出 0，同一 24 组 1/4/5/10/11/16/17/20 级 × 命中/未命中/重击测试通过；导出重装并走实际玩家准备与 Host 事务，未改写新自动稿或降低预期。产物保存在 fullbook-primal-final-convert-20260926/generated-primal.starmod 与 generated-primal-behavior.json。该证据仍不覆盖真实网络同步及优劣势等未列出的场景。

## 构筑语言授予接入玩家与 Host

已核实 fullbook-scaling-final-types.log 和 fullbook-scaling-final-build.log 退出 0。主批专长错误显示 language 构筑标签此前只被保存，没有成为已知语言；多个条目同时错误填写 advancement.level:0 或把短休恢复不包含长休当作缺口。

新增 dnd5eCharacterKnownLanguagesV1，合并既有 common、背景语言和已授予 language 标签，统一去空白、小写、去重。地图权威快照、pluginSpellTransaction 语言选项及 MapsWorkspacePage 的三个玩家语言选择入口均使用此函数；移除构筑 receipt 后不保留该语言，不把授予写入背景字段。此修改没有声称补齐种族目录中所有语言来源。

指南明确专长获得时构筑 advancement.level:1，与 prerequisite.minimumLevel 分离；语言使用 tag key:language，技能专精用 skill-expertise；short-rest 资源长休也恢复。上述恢复行为已核对 classResources.ts 的真实条件，未新增规则例外。

fullbook-language-grants-tests.log 三文件 149 项通过（地图快照、构筑选择、法术事务），新增实际授予与移除测试。fullbook-language-final-types.log 与 fullbook-language-final-build.log 已启动，须轮询实际退出码。原全书主批尚未结束，旧批快照为 11 未开始、1 处理中、48 转换错误、87 覆盖阻塞、8 结构就绪；结构就绪数未使用新校验重算，不能作为当前真实通过数。

## 状态豁免优势与自动生成专长验收

已核实 fullbook-language-final-types.log（40958）和 fullbook-language-final-build.log（10735）退出 0。用最新校验对旧主批快照离线重查：110 blocked、6 ready-for-behavior-tests、29 no-valid-draft、1 source-changed、9 not-started；报告 fullbook-current-preflight-20260926.json，所有 behaviorVerified=false，未合并独立修复探针。旧主批的 8 项结构就绪不能沿用。

新增 passive-defense.savingThrowAdvantageAgainstConditions 标准状态数组；验证非空、合法 ID、去重要求，投射到角色与 Host combatant，并在克隆状态保留。仅对抗匹配状态的豁免具有优势，不赋予状态免疫，不改变无状态的同伤害类型豁免。69 项相关测试通过（含错误状态/空数组/重复值、所有权移除、角色至 Host 投射），日志 fullbook-condition-defense-tests.log。fullbook-condition-defense-types.log（82062）退出 0。

自动转换炼狱体质（fullbook-condition-feat-convert-20260926）两次有界尝试，生成正确的体质构筑授予、寒冷毒素抗性和中毒豁免优势。暴露 preflight 未识别专长 passive-defense 执行路径；现以经过包验证、明确 passive trigger/full 的 passive-defense 纳入待行为测试，不允许任意声明式能力绕过验证。fullbook-condition-preflight-tests.log 通过。

fullbook-condition-feat-behavior.log 通过：原稿未修改，导出 generated-feat.starmod、重新读取安装、体质14→15且原角色不被修改、Host 寒冷毒素抗性及中毒豁免优势、无关状态正常、移除专长优势消失。初轮测试角色缺 dnd5eRaceId，前置资格校验正确拒绝；补齐测试角色 tiefling ID 后通过，未修改生成稿。generated-feat-behavior.json 明确仅隔离构筑与 Host 投射，不声称真实多人同步或前置条件 UI 验收。

最终 typecheck fullbook-condition-final-types.log（6678）运行中，须核实退出。原全书旧主批仍未宣布结束，继续按原始证据和实际行为推进，不覆盖用户房间。

## 独立施法的短休次数与第二轮自动转换

前轮 fullbook-condition-final-types.log（6678）已核实退出 0。旧主批会话 44848 已实际退出 0，conversion-run.finished=2026-09-26T08:59:37.037Z。原始诊断结果97覆盖阻塞、50转换错误、8旧结构就绪；主批完成只说明循环终止，不是整书成功。

新增构筑法术 mode:once-per-short-rest（固定授予与目录选择均接受）。独立施法投射保留 short-rest 恢复类型，资源定义不再全部硬编码 long-rest；玩家普通法术 prepare 接受短休资源，Host 继续沿用独立次数消耗且不扣职业法术位。指南明确引用已安装法术、施法属性和施法环阶，无需复制原法术或发明资源。短休资源长休也恢复沿用既有规则。

fullbook-short-rest-grants-tests.log 三文件219测试通过，其中新增真实玩家 prepare→Host resolve、次数扣除、耗尽拒绝、无职业法术位和短/长休各恢复一次。类型检查 fullbook-short-rest-types.log（4547）和 Vite build fullbook-short-rest-build.log 仍需轮询退出；标准 build 架构审计失败没有被解决或隐去。

两个新的有界自动批次使用 verified-inventory-run.json：fullbook-feats-current-convert-20260926（67795，14项专长，64调用上限，两次/条）和 fullbook-spells-current-repair-20260926（83325，95法术，400调用上限，两次/条）。后者从旧批完整 draft 开始并用最新 preflight 错误反馈，捕获 rejectedDraft，未手动修改配置。专长批启动早于本轮 short-rest 接口，因此本轮新接口不会热加载；其失败应在后续针对性重跑，不可误当最新能力结论。早期专长结果仍暴露盟友天然1反应、天生武器等真实缺口及部分对SDK的误解，继续处理。

## 无限次有环阶法术授予

已核实 fullbook-short-rest-types.log（4547）及 fullbook-short-rest-build.log（15008）退出 0。新的专长自动稿指出 at-will 有环阶法术尚缺构筑模式。新增 mode:at-will，独立施法保留显式 castAtLevel；不生成次数资源，玩家 spellAction 不再拒绝有环阶 at-will，Host 原有独立施法路径仍校验环阶且正常消耗动作。移除授予后玩家请求被拒绝。

fullbook-at-will-grants-tests.log 三文件220测试通过，含有环阶法术玩家准备/Host结算、无次数资源/法术位扣除、动作消耗及移除权限。fullbook-at-will-types.log（10398）和 fullbook-at-will-build.log 尚运行，需核实退出。

fullbook-independent-feats-convert-20260926（22365）使用最新接口对高等卓尔魔法、妖精传送有界转换。已生成正确 at-will/long-rest grant，但第一项仍被模型“没有职业信息”这一非需求阻塞；保留原稿和错误，指南明确独立专长不需要职业，没有静默删除 unsupported 来提升状态。下轮需读取最终结果并按新指南自动反馈修复与真实行为验收。

## 独立施法配置完整性与两项自动专长重装验证

fullbook-at-will-types.log（10398）与 fullbook-at-will-build.log（17806）已核实退出 0。自动稿第二次修复遗漏 castAtLevel，会让浮空术/解除魔法错误回落到1环；新增独立施法 grant 的 ability、1..9 castAtLevel 必填验证，避免结构就绪掩盖此错误。fullbook-grant-metadata-tests.log 三文件30测试通过。

fullbook-independent-feats-repair-20260926（49900）已结束，使用完整旧稿和新错误有界修复，未修改配置。fullbook-independent-feats-behavior.log 退出0：两项均导出 starmod、重装注册并执行真实构筑授予；高等卓尔魔法获得1环无限侦测魔法、2环浮空术及3环解除魔法的独立长休次数，均魅力；妖精传送选择智力+1、获得木族语和2环智力迷踪步的短休次数。无限施法未生成次数资源。证据 generated-grants-behavior.json 明确仅隔离包/构筑/施法资格/资源投射，不是这五项法术各自实际施放或真人房间网络验证。

fullbook-grant-metadata-types.log（63624）仍需核实退出。14项专长批（67795）及95法术批（83325）仍运行；未改用户房间，未改目标范围。

## 全批次当前结构状态合并

fullbook-grant-metadata-types.log（63624）已核实退出0。新增 .codex-logs/fullbook-consolidated-preflight.test.ts，遍历明确 manualContentRepairs:false 的 fullbook 转换批次，要求来源 kind/name/text 与155项权威清单完全一致，逐个重新执行当前 preflight。只汇总结构状态，所有 behaviorVerified:false，不信任历史 ready 字段、不把行为证据或最新稿自动等同全书认证。

fullbook-consolidated-preflight.log 退出0；私有 fullbook-consolidated-preflight-20260926.json 覆盖29批，快照结果119 blocked、13 ready-for-behavior-tests、23 no-current-source-draft。13项：吸收元素、阿迦纳萨喷火术、造成恐惧、高等卓尔魔法、妖精传送、炼狱体质、生命转换、原初蛮击、原初守护、史尼洛雪球群、鸣雷破、亡者丧钟、光耀祷词。运行中的批次仍是快照，不能宣称全部处理完毕。

天生武器调查：equipment.ts 仅有变身术专属虚拟武器ID/特定标签覆盖，普通 equipmentAttackAction 从主/副手重建攻击并校验 damage source，武僧徒手也为专用路径。不能仅给导入配置添加展示名称或假装备就声称通用天生武器可用；需要通用授予、选择入口、Host重建及失去授予后的拒绝。此轮尚未实现该机制，继续保留阻塞。

## 通用天生武器攻击链路

新增 staticModifiers.naturalWeapons，封闭局部id/name/单骰面/物理伤害类型/magical协议，Host命名空间自动派生武器ID；限制数组大小、ID重复、骰面及伤害类型。注册克隆与读回保留字段。equipment.dnd5eNaturalWeaponProfiles 从当前拥有的特性计算力量+熟练、伤害、武僧武艺/气击与狂暴修正。玩家热栏提供每个天生武器的攻击入口，wire只提交naturalWeaponId；equipmentAttackAction从权威快照pluginFeatureIds过滤后重建，拒绝不存在/失去授予及副手/橡棍术/特殊Activity攻击授予混用。不覆盖原装备。

fullbook-natural-tests.log 三文件89测试通过：已有装备回归、新增1d4利爪/普通熟练加值、非魔法伤害源、重击2骰及实际HP扣除、移除特性后拒绝、伪造武器ID拒绝。尚未单独新增武僧/狂暴组合及网络UI行为测试，不据此声称全规则组合认证。

fullbook-natural-types.log（98898）与fullbook-natural-build.log运行中，须核实退出。fullbook-natural-feat-convert-20260926（26157）正在按最新SDK自动转换龙之鳞爪，尚未验收自动稿导出重装；该步骤需要继续完成。既有14专长/95法术批次仍运行，指南与代码不会热加载到先前启动的批次。

## 天生武器组合回归及自动稿待验收

fullbook-natural-types.log（98898）和 fullbook-natural-build.log（40777）已核实退出0。新增武僧/狂暴组合回归：武僧6级敏捷18的利爪为+7命中、1d6+4且气击魔法；持盾停用武艺后回到力量与1d4；5级野蛮人狂暴加2伤害，穿重甲时该加值停用；Host显式空授权列表不产生天生武器。fullbook-natural-combination-tests.log 两文件76测试通过。

已写 .codex-logs/fullbook-natural-feat-behavior.test.ts/config.mjs，覆盖原始自动稿导出重装、构筑力量选择、无甲AC/盾牌/穿甲停用、实际玩家准备与Host攻击伤害、移除专长拒绝。尚未执行：转换会话26157仍真实运行，首个AI调用09:11:44.824Z开始仍无返回，不凭等待时间重启或并发复制请求。下一轮先轮询原句柄，完成后执行该测试，失败按实际原因处理，不改生成配置或降低预期。

## 天生武器地图目标链路修复

检查真实UI入口发现 PlayerCombatHotbar 虽已加入naturalWeaponId，MapsWorkspacePage 的目标高亮和点击距离检查仍只调用手持武器profile；空手时不能选目标。两处现在按naturalWeaponId解析天生武器profile，提交时也不为天生武器弹橡棍术属性窗口（该字段与天然武器请求不兼容）。未用后端单测冒充浏览器验收。

fullbook-natural-target-tests.log 两文件76测试通过；fullbook-natural-target-types.log（55624）及fullbook-natural-target-build.log仍需核实退出。自动转换26157首调用09:15:40.840Z已返回，第二调用09:15:40.858Z正在运行，未重启请求。专长批67795已完成，95法术批83325仍需继续观察。自然武器自动稿行为测试文件已准备，待转换完成运行。

## 龙之鳞爪自动稿重装结算通过与统一效果缺口

转换26157已完成且结构就绪。首次 fullbook-natural-feat-behavior.test.ts 实际重装失败：统一效果白名单缺 unarmoredArmorClassBase/unarmoredArmorClassAllowsShield/naturalWeapons。修复 Effect capability 类型、白名单、数值/天生武器数组验证和数组深拷贝，保留同一未编辑自动稿复测通过。

fullbook-natural-feat-behavior.log 退出0：generated-natural.starmod重装、力量16→17、无甲AC15/持盾17/穿皮甲13、利爪+5命中1d4+3挥砍非魔法、玩家准备→Host命中扣7HP、移除专长拒绝。generated-natural-behavior.json明确隔离测试，非真实网络。

预检新增校验转换后的所有统一永久Effect，避免原稿结构通过但安装才失败。fullbook-natural-unified-tests.log 33项通过；另新增仓库常驻合成包测试验证统一效果注册及拥有/移除，fullbook-natural-permanent-tests.log通过。fullbook-natural-target-types.log（55624）及target-build（69092）已核实退出0。新的unified-types（94430）与unified-build待核实；常驻包测试新增晚于94430启动，下一轮类型检查应覆盖最终修改。

## 后续自动转换协议说明与最终检查

fullbook-natural-unified-build.log（77451）已核实退出0。95法术批83325仍真实运行，快照28项已开始、3项结构就绪。当前发现渺远步错误填 automation phase:movement，且把已存在落点检查误报为缺口。核对 dnd5eActivityMapInteraction.ts：Host拒绝占用、越界、地形阻挡，requiresLineOfSight检查效果线。指南明确移动属于effects阶段、无需发明unoccupied字段，并明确效果线不等于所有视觉规则，未宣称完整感官支持。

新增最终 typecheck fullbook-natural-final-types.log（本轮返回句柄待核实）覆盖上一轮最后添加的常驻包测试；unified-types94430同样须看实际退出。后续应减少对已结构就绪条目重复AI转换，优先处理缺口机制和进行行为验收；新指南不会热加载到83325。
补记：94430退出1，发现preflight错误消息直接读取unknown effect.id；已补显式Effect类型收窄。最终检查54356启动先于此修复，需再核实并在必要时重跑，不能宣称typecheck通过。

## 熟练选择声明接入真实构筑执行

发现已有 advancement.kind:proficiency 协议通过验证但 selectionAdvancements 仅处理select/spell-select，导致这种声明被静默忽略。现在将熟练choices映射为封闭构筑选择，选择列表显示已有技能/豁免中文名称，Host拒绝缺选及越界选项，选中技能实际写入角色与receipt。fullbook-proficiency-advancement-tests.log 两文件25测试通过。SDK附系统SKILLS真实目录，避免模型以原文未列所有技能为缺口；工具/语言全目录及专精资格仍未补齐，不能将天赋异禀视为已完成。

54356类型检查仍真实运行，未见终态；本轮修改后应重新检查最终类型。95法术批83325仍需核实后续进度。

## 技能专精授予资格校验

新增 dnd5eBuildChoiceExpertiseAvailableV1：skill-expertise必须是系统技能且角色已熟练；允许本次其他grants刚授予的熟练；拒绝已有职业selections.expertise、其他构筑receipt专精及本次重复专精。apply构筑在写入角色前执行，界面选择同时以当前角色及其他已选grants禁用无效项。指南明确运行时资格无需原文包含角色熟练清单。fullbook-expertise-tests.log 构筑及升级两文件22测试通过。

54356已退出1，仍是修复前preflight effect.id unknown旧诊断；代码已改，现启动fullbook-expertise-types.log（49979）覆盖最终修复。fullbook-expertise-build.log已启动待核实。尚未补齐工具/语言完整目录及其他来源的非标准双倍熟练能力，因此不宣称天赋异禀完整行为通过。

## 构筑工具/语言目录

核对官方2014工具表：https://www.dndbeyond.com/sources/dnd/basic-rules-2014/equipment（工具名称、类别；未复制规则正文）。新增buildChoiceCatalogs.ts包含39项工具/载具熟练id及中文标签、现有车卡16种语言的规范id。工具熟练选择显示中文；SDK提供真实闭合目录，明确工具熟练不赠实物、语言选项仍受原文/房间限制，不把秘密语言默认为可选。工具检定实际加值尚待独立验证，未凭目录存在宣称自动结算。

启动fullbook-prodigy-convert-20260926自动转换天赋异禀（本轮工具返回句柄），使用最新熟练/专精接口和目录，两次重试上限，不手工改配置。下一轮应核实自动稿并用真实技能加值及资源投射测试；语言目录暂未替换CharacterSetupDialog现有显示数组，避免在无必要时改动用户流程。

## 工具熟练接入通用属性检定

新增能力检定toolId（与skill/context互斥、只接受共享目录），将构筑工具熟练投射到Dnd5eCharacter与Host combatant并复制快照。Host从toolProficiencies决定熟练rank，不信任请求中的加值；事件记录toolId。未熟练仍走正常未熟练检定（例如吟游诗人万事通），不把没有熟练误当不能尝试工具检定。

fullbook-tool-check-tests.log 两文件19测试通过：14级吟游诗人智力工具检定有构筑熟练时+5，移除后万事通+2，实际Host事件总值正确，tool+skill混合请求拒绝。仅接入构筑receipt来源，原有背景/种族/职业工具熟练聚合、界面工具选择与日志显示仍待补；不能据此声称所有工具检定完成。

fullbook-tool-check-types.log（73274）运行中。fullbook-prodigy-convert-20260926（59209）快照已ready，需核实进程终态，再运行未编辑稿的导出重装/构筑/专精/语言/工具检定行为验证。

## 天赋异禀自动稿及玩家工具检定入口

fullbook-prodigy-convert-20260926（59209）已核实退出0。未编辑自动稿经导出generated-prodigy.starmod、重新安装与构筑选择，奥秘熟练/专精、炼金工具熟练、矮人语均可读取。四级战士智力14：奥秘+6，工具检定+4；实际prepare→Host掷骰10得到14。原角色不被原地修改。证据generated-prodigy-behavior.json，fullbook-prodigy-behavior.test.ts通过；尚不是真实网络房间验收。

MapDiceRoller增加共享目录工具选择及使用属性，玩家请求传递toolId，Host继续从权威熟练数据计算加值。DM命名动作提示、公开/秘密结算日志均显示工具中文名称。fullbook-tool-ui-tests.log两文件50测试通过；此前工具backend类型73274已核实退出0，tool-ui-build.log记录Vite成功14.71s。最终类型98234仍待退出核实。工具熟练目前仅聚合构筑receipt来源，原生背景/种族/职业来源仍待完善；未声称完整工具规则完成。

重新执行全候选自动稿审计：2026-09-26T09:34:51Z为155项中123blocked、17ready-for-behavior-tests、15no-current-source-draft。ready仅表示结构就绪，不代表全行为验证。95法术批83325仍运行；新发现持续区域治疗仅支持固定amount而不支持治疗骰，这是真实共享接口缺口，后续应补齐并联动掷骰、验证与频率，而非手工填平均治疗值。

## 持续区域治疗骰

扩展trigger.healing为amount固定加值加可选dice:{count,sides}，保留旧固定治疗。规范化拒绝零/超限骰数、非法面数及字符串骰面；Host在效果结算前校验治疗骰数量/整数/范围和固定值。pluginAreaTransactions透传healingRolls；地图实际触发时独立掷治疗骰并传入事务，重试沿用同次rollInput，未在施法时预掷。结算事件保留healingRoll，日志同时显示骰值、总值和实际治疗；生命值上限与onlyIfAtZero继续生效。

fullbook-area-healing-tests.log初轮两文件70测试通过；最终fullbook-area-healing-final-tests.log增加日志回归亦通过，测试覆盖规范化、实际回血、源快照不变、超额治疗、零生命限定及错误骰值拒绝。tool-ui-final-types98234已核实退出0。area-healing-types44851仍待终态且启动早于最后日志补丁，需最终类型检查。未将此项等同治愈之魂完整自动化：目标类型排除、共享频率、移动视觉语义仍需核查与自动稿验收。

## 区域目标类型与治疗升环

新增trigger includedCreatureTypes/excludedCreatureTypes（14种标准英文id、拒绝未知及重复项），地图收集、prepare和Host结算共同过滤；中文怪物类型可对应标准类型。新增治疗升环支持：create-persistent-area的diceCountPerStep同时调整治疗dice.count，flatAmountPerStep调整固定治疗值。共享frequencyGroupId/oncePerTurn已存在且现有测试覆盖跨触发时点，不另造协议；SDK说明避免模型误报。

area-healing-types44851退出2，暴露上轮it.each数组会被展开为多个参数的问题，已改为对象包裹数组，使非法骰数量/范围测试确实传入所列数组。此前Vite18682退出0不替代类型检查。fullbook-area-filter-final-tests.log三文件117测试通过，新增类型排除、白名单、规范化和2环升4环得到3d6持续治疗。area-filter-types75403仍需核实最终退出；最后升环测试后仍需最终类型检查。

启动fullbook-healing-area-repair-20260926（85486），仅治愈之魂，沿用95法术批的上次自动稿和诊断，最多两次自动修复，不编辑配置。95法术批83325本轮再次确认仍运行。待核实治疗稿结果，不能将接口测试等同该法术完整验收。

## 区域触发的来源可见性

治愈之魂自动修复85486已退出0但未ready：模型仍误报治疗升环（修复批启动早于对应实现）、逐目标可见性与移动到不同空间。原PDF源文确实要求“你或者一个你可以看见的生物”且治疗可选择，不可将所有占据者无条件自动治疗视为完成。

新增trigger.requiresSourceVision，规范化严格布尔；prepare与Host在触发时调用现有dnd5eCombatantCanSee，来源自身例外。测试可见→遮挡拒绝→恢复可见，且自疗不因对其他目标的遮挡受影响。area-vision-tests.log两文件通过，现有共享频率测试一并运行。SDK补充真实升环配置及可见性字段。area-filter-final-types30989已核实退出0；本轮area-vision-types运行中。

剩余待处理：来源选择是否治疗的通用可选触发窗口（现有sourceChoosesTargets限source-turn-start且缺少放弃选项，不能直接冒充已覆盖）；区域移动不同落点语义；重新自动生成并导出重装行为验证。不以接口单测替代法术完整验收。

## 区域效果可选触发

新增trigger.sourceMayDecline，Host要求显式sourceConsent；未提供拒绝结算，false不掷骰、不治疗，true正常校验/结算。地图在有效目标prepare后向来源控制者发共享选择窗口，默认放弃而非超时自动治疗。放弃经正常事务写入declined触发receipt，保留每回合首次机会；maximumTotalUses统计排除declined，地图归一化保存该字段。

fullbook-area-consent-final-tests.log两文件80测试通过，包括同回合放弃不再提示、下一回合仍可使用、真正使用后达到总次数限制。area-vision-types67313退出0。area-consent-types35583运行中（启动早于最后receipt测试）。尚未验证真实玩家网络选择窗口，也未完成同时多目标且可放弃时的总次数分配，因此不宣称所有可选区域规则已完成。治疗原文这版无总次数限制，但通用接口仍需多目标场景完善。

## 区域移动锚点与可选多目标分配

relocate-granting-area新增requiresDifferentAnchor，声明验证、执行proposal、Host地图事务均贯通；同地图格原地移动拒绝，正常移至另格通过且失败不改变区域位置。明确仅平面锚点，不宣称完整三维移动。fullbook-area-anchor-tests.log两文件57测试通过。

修复可选多目标波次在收集时提前预占maximumTotalUses的问题：sourceMayDecline不预占，实际prepare根据当前区域receipt检查未放弃使用数。已有目标放弃后不排除其他候选，实际次数耗尽仍拒绝prepare。fullbook-area-optional-wave-tests.log区域/治疗/回合三文件通过；新增一次总额度仍收集两个可选候选，避免第一个放弃使第二个丢失机会。

area-consent-types35583日志EXIT_CODE=0；area-anchor-types50196运行中，早于最终波次修复。启动fullbook-healing-area-final-20260926（91813）沿用上次自动稿，最多两次修复，包含当前治疗骰、升环、类型、可见性、可选触发和不同锚点指南。不编辑自动配置，等待结构及行为验收。

## 治愈之魂自动稿结构就绪后的真实缺口

healing-area-final91813已退出0、自动稿ready。fullbook-healing-movement-audit.test.ts从未编辑contentJson导出generated-healing.starmod、重新读取V2包，实际调用resolveDnd5eActivityAreaMapSelectionV1验证移动选点。导出重装通过，但确认move target.placeRangeFeet:30仍从caster计算：caster第0列、精魂原在第7列时，第8列明明仅距精魂5尺却无法选中。generated-movement-audit.json明确behaviorComplete:false，不能将结构就绪当作法术已完成。

area-anchor-types50196退出0。下一步增加区域移动距离参照点（从授予活动的区域，而非施法者），同时保留施法者视觉校验及Host最大移动距离限制。必须贯通选点UI与Host，不仅改AI提示或放大任意施法距离。外观选择虽已进入自动稿choices，仍需确认持久显示绑定；目前未完整验收。

## 区域距离参照接口及上一轮结论范围纠正

新增area target.rangeOrigin:'granting-area'，通用选点从唯一归属actor且授予该activity的区域锚点计算placeRangeFeet及areaPlacementDistanceFeet，视线/效果线仍从actor计算。缺区域、归属错误或多个匹配区域未指定id时拒绝。通用React选点session保存rangeOriginCell用于范围显示，确认时重新查询区域。测试actor第1列/区域第10列可移动第11列且距离为5，超出30尺拒绝，重名grant歧义和其他来源拒绝。fullbook-area-origin-final-tests.log 38测试通过；area-origin-types80850待核实（启动早于最后距离返回修正）。

重要范围纠正：检查pluginFeatureAction.ts发现常规persistentAreaGrant已有casterCell=grant.anchorCell和对应horizontalDistance逻辑，因此上一轮generated-movement-audit仅证明通用helper默认actor原点，并未证明实际所有玩家授予活动路径有相同错误。保留原证据但不得扩大其结论；后续必须通过prepareDnd5ePluginFeatureAction真实路径验证自动稿。新增rangeOrigin解决通用接口语义表达，不替代该生产链验证。

## 自动稿真实玩家施放与空格区域移动

area-origin-types80850退出2：rangeOrigin校验误置在operation分支导致target未定义，已移入area target校验。area-origin-fixed-types66088仍待终态，且启动早于后续空格移动补丁。

fullbook-healing-player.test.ts读取未编辑generated-healing.starmod并注册，实际玩家德鲁伊施放4环，Host生成治疗骰3d6区域。prepareDnd5ePluginFeatureAction从原第7列移动第8列，真实distanceFeet=5，进一步证实常规授权入口已有区域原点。

继续resolve发现真实缺口：area目标没有生物时，relocate-granting-area通用target迭代生成零proposal，事务成功却不移动。已为有areaPlacement的区域移动生成一次actor归属proposal，地图handoff使用areaSelection.anchorCell（不再依赖生物位置）。未编辑自动稿验收现在确认：1个移动proposal、地图区域锚点实际变为第8列。fullbook-healing-player.log通过，generated-player-move-settled.json保留证据。Executor/MapInteraction回归fullbook-area-empty-move-tests.log通过。仍未完整验证治疗触发和专注清理、外观持久化及真实网络房间。

## 导入法术持续区域来源标识与真实治疗

上一轮类型66088/32475退出2，均为新area-origin测试fixture缺expiresAfterRound引发后续undefined推断，已补真实到期轮次；本轮area-source-types45739运行中。

扩展未编辑自动包测试实际调用collect→prepare→resolve区域治疗。先纠正fixture：使用真实resolved.application角色/地图、result.activityDefinition以及生产调用传入的concentrationId，而不是原始施法前角色。仍发现真实缺口：区域coreSpellId来自legacySource短id（healing-spirit），Host插件查找需要package限定id，导致invalid-plugin-action。MapHandoffs创建区域时现只在对应package限定法术实际注册时使用该限定id，原生法术与已限定id保留原值，避免凭空改写。

fullbook-healing-player.log现在通过：自动稿导出重装、实际4环施放、3d6触发以[2,3,4]使患者HP5→14、同turnKey不重复触发、专注缺失后reconcile清理区域、空格移动proposal及地图位置更新。治疗完整事务保留generated-healing-trigger.json。area-source-tests.log地图、区域、包回归通过。仍缺真实网络/UI验收和外观选择持久显示；没有将全书/此法术标为完全认证。

## 保存重载与全书批次收束快照

fullbook-area-persistence-tests.log两文件28测试通过：JSON→migrateMapsState→JSON→migrateMapsState保留治疗dice、excludedCreatureTypes、requiresSourceVision、sourceMayDecline与declined receipt且二次结果稳定。这仅是存储/快照规范化，非真实网络端到端验证。area-source-types45739已核实退出0（本轮新增存储测试之前）。

95法术最新批83325已核实退出0、95全部尝试、11本批结构就绪。合并所有未手改且源文一致候选重新审计：2026-09-26T10:10:59Z，155项中18ready-for-behavior-tests、125blocked、12no-current-source-draft。12项为11子职（剑舞学院、牧人结社、魔射手、醉拳宗、剑圣宗、日魂宗、征服之誓、救赎之誓、怪物杀手、风流剑客、天界）及尘卷风。尚无全书自动化完成证据。

usage快照2026-09-26T10:12:02Z，按jobId去重的已知API输入27,215,758、输出1,439,302，1014已知usage调用，6未知usage调用。未知不是零；这是目标相关报告中的API用量，不是线程推理token，不含任何未记录请求。不要重复启动已终止的大批全量转换；优先定位具体失败并验证现有自动稿。

## 召唤/变形依赖目录按类别检索

最新95法术批将召唤高等恶魔阻塞为“只有幽影，没有恶魔monsterId”。实际Host目录有恶魔，根因localContentAiDependencies仅按完整怪物名字匹配正文，且40条截断无完整性说明。已在召唤/变形相关原文中按实际类型与恶魔/魔鬼子类型检索，输出真实subtypes及CR，保留具名命中，不臆造数据。目录本地化后subtypes是恶魔/魔鬼，初轮测试暴露英文匹配不足，已兼容中英文。去除无说明的40项截断，候选仍只来自内置真实目录。

fullbook-monster-category-tests.log 6测试通过：无具名怪物的恶魔/魔鬼召唤能检索完整已安装子类，野兽形态全部引用可解析；原无关文段和职业清单隔离测试仍通过。fullbook-monster-category-types42744运行中。只修复资料检索，未宣称恶魔失控、命令、生命周期等机制已自动验收；未重启全量API转换。

## 召唤控制接口核验与单项自动重试

核对summonedControl、summonedCreatures及Headless命令路径：controlSave创建目标回合末豁免，失控后提前断专注按lingerDieSides记录一次滞留骰和期限；maximumChallengeRating/requiredCreatureSubtype、protectiveCircle、commandPolicy及command-owned-companion已有受测路径。指南补实际闭合字段、法术DC公式reference:{kind:'actor-spell-save-dc'}与已有命令枚举，不把开放式命令宣称全覆盖。fullbook-summon-contract-tests.log两文件24测试通过；monster-category-types42744退出0。

启动fullbook-greater-demon-catalog-20260926（42628），仅召唤高等恶魔，使用上批自动稿和诊断、修复后的真实分类目录与已验证接口说明，最多两次自动修复。未手改配置、未重启全量转换。后续需看自动稿剩余缺口及实际导出重装行为，不能凭既有控制测试认定原法术全部完成。

## 召唤自动稿二次诊断与已编译示例

greater-demon-catalog42628已退出0，未就绪。最新rejectedDraft已引用真实怯魔/夸塞魔，原始preflight.issues仍是上批旧稿，不能把旧“缺恶魔目录”当最新结论。实际新阻塞为临时summon误填bondKey（仅persistent契约允许），并且仅覆盖少量固定候选；未命令默认攻击、条件真名、完整失控追逐及法阵条件材料仍在unsupported。

新增真实编译器校验的虚构controlled-summon模式示例，包含合法cube尺寸、已存在怪物id、CR/子类型、控制豁免和临时生命周期；数字标明示例不能覆盖原文。fullbook-summon-example-tests.log 12测试通过。SDK明确临时召唤命令用sourceActivityId，不要误设永久bondKey。当前协议仍需核查是否应提供选择monsterId的通用入口，避免对每个候选复制整套活动；不以示例存在宣称召唤高等恶魔完成。

## 通用召唤候选选择

新增summon.monsterChoiceId引用Activity选择项，option.id为真实monsterId；Executor校验所选值属于声明列表并传入原summon proposal，保留原CR/子类型/控制生命周期字段。声明校验拒绝未知choice引用及与corpseFormChoiceId混用，原monsterId字段保持兼容。已编译示例改为同一活动选择怯魔/夸塞魔；SDK要求从实际目录完整覆盖可用候选而非只取两例。

fullbook-summon-choice-final-tests.log实际注册B3/B4路径及模式编译两文件通过：不同选择生成对应怪物handoff，未声明balor请求拒绝；不是仅字符串映射测试。后续仍需导出重装/候选全量CR边界与自动稿验收，不能据此宣称完整召唤法术完成。fullbook-summon-choice-types1102运行中。

## 动态召唤目录与可移植配置

新增choices.optionsFrom:srd-monsters与monsterFilter（标准生物类型、子类型、静态CR上限），客户端与Host从内置目录重建完整匹配候选。过滤器在导入时校验，拒绝非法类型、空/重复类型、非法CR等。小数CR边界覆盖狼1/4与猿1/2；注入balor候选不会改变权威目录。召唤分支未选中时不再要求无关生物选择。已编译示例、AI指南及社区SDK说明同步更新。此来源只覆盖内置SRD；静态筛选上限不代替召唤操作的施放等级CR公式。

导出starmod→解析重装后，动态来源及筛选条件保留，重新生成相同候选。实际注册Headless路径仍验证选择怯魔/夸塞魔，拒绝超限balor。核查地图召唤发现devil不匹配本地化“魔鬼”，已统一选择与召唤的子类型匹配函数，合法小魔鬼可召唤、恶魔不能冒充魔鬼。

fullbook-monster-selector-combined-tests.log四文件53测试通过，包含候选、导出重装、模式编译及召唤生命周期。之前summon-choice-types1102、monster-selector-types66373均退出0。最终追加导出与子类型测试后的类型检查7088写入fullbook-monster-selector-final-types.log，已确认退出0。未调用新AI转换，未标记召唤高等恶魔或全书完成；仍缺自动生成稿的逐条完整机制验收及真实DM/玩家同步验证。

## 逐回合口头命令与真实材料缺口

核查原始PDF召唤高等恶魔：每回合重新口头下令，真名仅影响当次回合末豁免。控制召唤示例改用turn-order，SDK区分持续命令和逐回合命令。实际注册Headless测试覆盖普通/真名闭合选择、free不消耗动作、非施法者回合拒绝、20与1在劣势下豁免失败、目标回合结束清除劣势及命令。

测试发现requiresSpeech只检查语言栏“不能说话”，未检查沉默与地图soundSuppressed。新增CanSpeakAudibly并用于直接结算和插件命令结算两路径；测试包含持久沉默效果、地图静音区域及不能说话语言标记。初次测试直接修改派生conditions，Host按activeEffects重建导致夹具无效，改用实际沉默效果后通过。fullbook-spoken-command-final-tests.log三文件40测试通过。20632最终类型检查已退出0（fullbook-spoken-command-types.log）。

材料原文明确仅使用法阵时在法术结束消耗血液；pluginSpellTransaction现有spellMaterialPlan在施放成功结算阶段扣除，尚不支持按Activity分支锁定材料并在结束时消耗。该缺口需要生命周期库存方案，不能改成施放即扣除或无条件扣除；指南明确禁止这种语义替换。未重试AI，未手改自动稿，未宣称高等恶魔全流程完成。

## 条件材料配方：导入、Host选择与导出

新增components.materialRequirementByChoice:{choiceId,options:[{optionId,requirement?}]}。spellbook导入校验结构、重复项及配方；模块注册与Host施放要求精确覆盖一个静态Activity choice。Host强制提交合法选项，所选分支的配方进入现有权威库存材料规划/结算，无配方分支沿用基础材料规则。禁止经叙事fallback绕过条件选择。SDK与AI指南已同步，仅声明实际支持的即时结算语义。

conditionalSpellMaterials.test.ts通过真实导入/注册/玩家施放/Host结算：缺选项、伪造选项、缺材料拒绝；普通分支保留钻石，特殊分支消耗一颗；均消耗一次法术位，输入角色未变异；映射缺失/多余/不存在的选择在注册时拒绝。独立starmod导出→解析→重新注册测试保留配方。fullbook-conditional-material-final-tests.log四文件153测试通过（含原施放及裁定回归）；之后新增导出及原对象不变断言，fullbook-conditional-material-export-tests.log三测试通过。类型检查93480退出0，后追加的测试断言未重跑全量类型检查。

尚未增加延期消耗字段或声称法阵材料结束结算已支持。下一步需持久的材料保留记录、重复提交幂等、库存转移/拆分限制及与专注中断/到期/清理的原子结算；不能靠延迟回调或重新检查旧inventoryRevision冒充可靠生命周期。未执行新AI调用，自动稿和全书验收状态仍未提升。

## 延期材料库存基础层

新增inventory.spellMaterialEscrows，保存施法请求ID、法术ID、精确效果实例ID、预留材料快照与reserved/consumed状态。reserveDnd5eSpellMaterials复用现有revision及材料标签/数量验证，把指定单位从可用库存移到预留记录；不生成第二份可使用物品。结束结算只清除预留快照并保留身份回执，同一请求重放不重复取材料、结束重放不重复消费，旧效果结束不会误处理新效果的记录。normalizeDnd5eInventory及通用inventoryWithEntries保留记录。

spellMaterialEscrow.test.ts覆盖JSON保存/恢复、重复预留、重复结束、同ID不同绑定拒绝、旧revision拒绝、剩余单位二次合法分配、不能转交已预留数量、其他库存变动不丢失记录。fullbook-material-escrow-tests.log三文件63测试通过。追加验证合法转交剩余单位不带走预留记录，fullbook-material-escrow-transfer-tests.log两测试通过。55568类型检查退出0（fullbook-material-escrow-types.log），追加转交断言未重跑全量类型检查。

该基础层尚未连到真实施放或地图生命周期，未向SDK开放“结束消耗”声明。接线时必须绑定实际生成的效果实例，并从Host完整效果状态结算，不能拿玩家视图缺失当作效果已结束。后续还需用户可见的预留/消耗明细、时间推进、专注替换、事务回滚与同步验证。未调用AI，未提升全书完成状态。

## 地图效果结束与预留结算接线

mapBridge.planDnd5eMapResultApplication在权威效果更新后结算当前快照中真实角色拥有的材料预留，写入characterPatches.dnd5eInventory。只处理由当前combatant明确映射的角色，排除拟像投影和地图外角色，避免缺少视图导致错误消费。角色自己的完整activeEffects实例ID是有效集合。

实际map snapshot→endDnd5eConcentration→结果角色补丁测试通过；另用resolveDnd5eHeadlessAction(end-turn)驱动一轮效果自然到期，确认预留标记consumed。重复应用同一结束结果不增加库存revision，地图外相同预留保持reserved。fullbook-escrow-map-regression.log三文件68测试通过，追加自然到期后fullbook-escrow-map-lifecycle-tests.log四测试通过。1147类型检查退出1，仅新增测试characterPatches可选字段访问未守卫，已修正；48875复查运行中（fullbook-escrow-map-final-types.log）。

预留创建仍是内部原语，未接入实际spell cast，未开放结束消耗配方字段。下一步需绑定新生成的效果实例（原生Activity效果definitionId带activity:rulesId:effectId及分片后缀，不能仅按法术名匹配），失败应回滚法术位与材料；还需非战斗时间推进、预留UI与真实网络同步。未调用AI，未宣称完整法阵或全书完成。

## 延期材料实际施放与单项自动稿验证

配方新增consumptionTiming:cast|spell-end，传递到权威材料计划。spell-end必须有Activity和明确timed持续时间；Host施放成功时预留，并创建material-lifetime:actionId独立效果，按本次法术持续时间/专注生命周期结束。旧即时消耗接口拒绝spell-end，避免其他路径静默提前扣除；条件分支未选择时不会预留特殊材料。库存版本变化导致整体施放失败并返回原状态，不提交法术位或材料改变。战役时间推进在效果更新后结算预留。

真实导入→注册→施放→预留→end-turn自然到期，以及专注主动结束、战役时间推进均有行为测试。专注计时沿用既有“不在施放当回合扣一整轮”行为，测试走完整后续回合。fullbook-deferred-material-regression.log六文件152测试通过，fullbook-deferred-material-concentration-tests.log五测试通过。之后增加延期配方的starmod导出/重新注册、缺有限持续时间拒绝，最终fullbook-deferred-material-final-tests.log两文件26测试通过。上轮中断后已核实没有存活tsc/vitest再重跑；19985类型检查退出0。更早48875/72158类型检查亦退出0。

EquipmentTab加入SpellMaterialEscrows只读明细，地图与角色物品栏共用：显示预留材料数量及最近五项已消费记录，无使用/转交入口。尚未做实际浏览器与网络验证；69395最终UI类型检查运行中（fullbook-material-ui-types.log）。

fullbook-greater-demon-deferred-20260926使用原始验证源文、前次自动拒绝稿、最新指南，最多两次修复；8047已退出0，未手改配置，仍blocked。新稿使用srd-monsters动态恶魔选择、升环CR公式、turn-order、初次真名选择、protectiveCircle以及后续命令，但未生成条件血液材料，仍报告自动反击/追逐、法阵完整边界和目录覆盖缺口。源码阅读还发现后续命令没有真名选择，不能仅凭unsupported清单认为已完整覆盖真名机制。不会将测试脚本退出0视为法术验收成功。

本次两调用已知输入93005、输出9021 token。2026-09-26T11:36:16Z全目标去重快照：已知输入27,396,774、输出1,457,473，1018已知调用、6未知usage（未知不是零）。继续优先处理真实机制/依赖缺口，未重启全书批量转换，未宣称全书完成。

## 同包材料依赖与实例时效校验

新增行为证据证明spell集合导入可以同时携带items材料定义，无需材料预先内置。扩展conditionalSpellMaterials测试使用同包synthetic:reagent标签，未知价格/重量均省略；Host从注册模板发放材料，真实条件施放预留、到期/中断消耗以及starmod导出重装仍通过。不是手改实际自动法术稿，仅用虚构材料验证通用接口。AI指南明确可共同声明模板，不得误称已发放库存或编造既有目录。

发现spellMaterials此前不直接检查实例expiresAtWorldMinute，已在规划与提交两阶段过滤已过期材料；有截止时间但权威角色时钟未知时拒绝。新增组件requiresExpiry:true，要求实际实例有有效截止时间，保存在分配计划中并在提交时再次验证，防止移除时限后绕过。导入解析及导出保留该字段。DM发放仍负责记录真实截止时间，接口不推测材料取得/死亡时刻；模板导入不自动重置新鲜度。

fullbook-bundled-material-tests.log九测试通过；fullbook-material-freshness-tests.log四文件46测试通过。追加同包材料使用requiresExpiry及实际Host grant bundle时限后，fullbook-material-freshness-final-tests.log三文件42测试通过。此前UI类型检查69395和同包测试类型检查51877退出0，时效修改后的38063类型检查运行中（fullbook-material-freshness-types.log）。本轮未调用AI，尚未把真实召唤高等恶魔标为可完整自动化。

## 召唤物自动武器反击与失控追击

38063材料时效类型检查已退出0。新增summonAutomaticTargets供怪物自动回合和攻击准备共用：未下令turn-order按攻击者历史反击，无目标防御；controlSave失控后忽略阵营，排除指定子类型及法阵保护者，按三维占位距离选择最近者。移动候选落点和多重攻击分配重新计算合法目标；有可执行攻击时优先攻击，远处目标可疾走接近。地图重建此前在requiredCreatureSubtype缺省时漏掉失控限制，已按现有控制解除规则补回demon默认值；Host子类型匹配复用中英规范化函数。

真实测试覆盖：未命中攻击→Headless攻击者记录→地图应用→JSON往返→自动规划→攻击准备→Host武器结算；失控移动后攻击同阵营最近者、拒绝更远目标；排除恶魔、法阵保护者；并列最近目标、移动后重新选择、旧反击历史不覆盖失控规则、远距离疾走。fullbook-summon-planner-final-tests.log四文件81测试通过。最初4851类型检查发现Token缺少早已在MapBridge持久化的companionCommand/summonAttackerIds声明，已补类型；45351后续检查退出0，最后追加测试后的59439运行中（fullbook-summon-planner-verified-types.log）。

monsterTurnPlanner整组67测试中两项飞行落点/移动距离断言失败（fullbook-summon-planner-tests.log）；关闭新增召唤约束的隔离配置仍重现两项相同失败（fullbook-summon-planner-disabled.log），未修改期待值掩盖。待后续核实既有飞行几何/规划，不视为本轮全回归通过。

此路径仍依赖现有怪物自动回合入口，不会后台推进先攻；未实现任意自然语言命令或所有法术/特殊辅助动作的自动选择。没有真实网络验收。最新单项自动转换fullbook-greater-demon-pursuit-20260926使用上次自动稿、最新指南及原验证源文，最多两次生成修复，43944运行中；未手改真实法术配置，暂不计为验收成功。

59439最终类型检查退出0。43944单项转换退出0但条目仍blocked：两调用输入92,381、输出7,021。自动稿已生成同包血液模板、circle条件requiresExpiry:true及spell-end配方；仍声明开放式行动选择和非SRD目录缺失。额外源码配置审查发现静态monsterFilter.maximumChallengeRating:5屏蔽升环更高CR候选，后续五命令仍无真名choices；预检未主动识别这两项，不能只看unsupported清单验收。指南已进一步明确动态CR候选覆盖和每次命令的真名分支，未立刻重复调用。2026-09-26T12:01:17Z累计已知输入27,489,155、输出1,464,494，1020已知调用、6未知usage。

## 召唤候选覆盖预检与自动稿实际导出施放

新增dnd5eSummonChoiceCoverageIssues并接入PDF预检：对仅依赖常量/环级的召唤CR公式，逐环对照真实已安装候选，检测静态过滤挡住公式允许的生物。其他角色属性/骰值依赖及额外谓词不猜测。fullbook-summon-coverage-tests.log两文件22测试通过，28046类型检查退出0。真实未编辑pursuit稿在新的current-preflight.json明确报告5环时被挡住的vrock，fullbook-summon-source-audit.log通过。

fullbook-greater-demon-coverage-20260926仅进行一次自动修复（93300退出0），输入46,440、输出4,437；实际移除错误静态CR过滤，并为五个后续命令增加true-name choices及false/true控制豁免分支。仍blocked，保留开放式行动/目录依赖说明。没有手改实际法术配置。12:07:07Z累计已知输入27,535,595、输出1,468,931，1021已知调用、6未知usage。

.codex-logs/fullbook-demon-material-player.test.ts分别读取pursuit和coverage未编辑稿，导出single-entry-verification.starmod、真实重装、玩家prepare/Host cast、材料缺失/过期拒绝、施放预留、召唤和法阵地图handoff、一小时推进消耗均通过；单条测试导出明确不是全书包或整法术认证。最新报告circle-material-player-verification.json记录命令玩家入口探测失败feature-not-selected：自动稿生成了后续活动但没有授予效果，Maps玩家入口无法使用。指南已补明确的效果grants与施放apply-effect规则，下一步需补活动可达性预检及实际命令成功链，不能把仅生成命令分支算完成。

12:09:33Z重新执行全书合并预检：155项仍18结构可验、125blocked、12无当前源文自动稿。该计数不等于行为通过或网络通过，完整目标仍未完成。

## 后续活动可达性、临时伙伴与效果授予执行注册

新增dnd5eSpellActivityReachabilityIssues，按现有法术首个active注册入口追踪实际apply-effect.grants、区域授予、持久契约、invoke和continuation；孤立循环或仅声明未应用的grant不算可达。接入PDF预检，两文件9测试通过，27831类型检查退出0。

fullbook-greater-demon-grants-20260926仅一次自动修复，45281退出0；输入47,605、输出4,620。自动稿补上施法者持续命令权限及四施放分支apply-effect，仍保留两项unsupported，没有手改原稿。实际玩家入口测试初次漏activeEffectId（真实UI会提交），修正测试后暴露真正的owned-companion错误：原谓词只接受永久召唤。已改为检查来源所有权，与持续时间解耦，保留bondKey；新增临时/永久、外人/失控、契约不匹配测试。

随后实际Headless返回invalid-plugin-action：contentPackageV2只编译法术主动作和区域授予，漏掉自定义效果授予/契约授予的动作。新增效果/契约授予活动注册，保持原根法术outerSpellTransaction优先，仍依赖运行时效果实例及所有权校验；测试覆盖注册、卸载和缺失活动拒绝。未经手改的grants稿最终完整走通导出/重装→玩家施法→效果授予→玩家命令→Host设置attack命令及本轮真名控制豁免劣势；报告commandSettled:true，fullSpellVerified/networkVerified仍false。

fullbook-granted-command-regression.log四文件70测试通过。33810类型检查指出新增测试的rounds duration缺expiresAt及可选activities索引，已修正测试；47048最终类型检查运行中（fullbook-granted-command-final-types.log）。真实单项fullbook-demon-grants-player.log通过。12:19:53Z累计已知输入27,583,200、输出1,473,551，1022已知调用、6未知usage。

12:20:13Z更严格全书预检为17结构可验、126blocked、12无当前源文自动稿。旧稿中发现孤立后续活动的条目包括骷髅之舞、龙息术、汲能术、神圣武器、炽焰/寒冰/磐石赋权、麦克斯米利安的地之攫、马友夫微流星、灵魂牢笼、召唤高等恶魔、碧水球、旋风、自然之怒。新召唤高等恶魔grants稿已解决该入口问题；其他条目下一步需依据新预检自动修复并逐项实际验证。全书和真实网络目标继续保持未完成。

## 后续活动批次、触发授予与移动地形复核

47048最终类型检查退出0。效果授予注册补充triggered边界：触发活动保留统一事件注册，不错误编译成主动Headless功能；不存在的引用及authorityBinding仍拒绝。contentPackageV2测试19项通过，59903类型检查退出0。

fullbook-orphan-followups-20260926从未手改且源文一致的最佳自动稿选取7条，各限一次修复；28198退出0。7调用输入304,685、输出16,767。汲能术、寒冰赋权、磐石赋权、马友夫微流星、碧水球产出可接收稿；炽焰赋权格式校验失败，旋风包含非法automation阶段roll。失败不能计作成功转换。5份接收稿均经过实际导出、接收端解析、注册和卸载，export-install-audit.json记录installed；fullbook-followup-export.log通过。它们仍有各自机制缺口，不等于完整行为认证。

寒冰赋权自动报告的“随源移动且排除源的困难地形无接口”经核查属于误判：现有Activity区域目标、source-token锚点、movementCostMultiplier可组合。新增persistentAreaMovingTerrain.test.ts验证自定义区域对友军/敌军加倍、排除施法者、源移动后旧位置解除、新位置生效及JSON恢复；测试通过。SDK转换指引明确这些字段分别属于Activity.target或create-persistent-area操作，并提示材质限定的困难地形豁免仍需单独核查，不能混同。也明确roll不是automation阶段。69610执行正式npm run typecheck，结果待续记录（此前tsc --noEmit根配置无输入，不计作类型验证）。

12:33:50Z全书预检仍17结构可验、126blocked、12无当前源文自动稿。12:26:54Z累计已知输入27,887,885、输出1,490,318，1029已知调用、6未知usage。尚未全书结算认证或真实房间网络验证；目标继续有效。

69610正式npm run typecheck最终退出0。下一项已定位：Activity执行器支持共享的施法者属性/技能检定，但Headless编译器目前仅接受per-target（共享random-roll除外）；不能只放开预检，必须补Host骰子声明、host-derived优势/劣势及结算一致性测试。旋风逃脱等自动稿遇到这一真实边界。

## 共享属性/技能检定与自动转换复核

本轮分类为进展。Headless编译器现在为shared（含默认scope）的ability-check/skill-check声明单组d20，normal为1骰，host-derived或明确优势/劣势为2骰；Host从施法者实际状态计算模式。执行器共享结果不再错误归属首个目标，使同次检定控制全部选中目标的结果。目标豁免仍为per-target；未将concentration-check扩大到此路径。SDK指引同步说明。

新增dnd5eSharedActorCheck.test.ts走已安装插件的真实Headless事务，覆盖两种检定、多目标同次成功/失败、普通/帮助优势/力竭劣势/相互抵消、非法骰和缺骰拒绝。初版测试漏掉插件骰结果必需modifier/total，被Host正确拒绝；补齐测试信封后，连同随机表及高级Activity回归共18项通过，最终fullbook-shared-check-final.log通过。74558类型检查发现测试fixture缺temporaryHp，已补0；97982最终类型检查待记录。

fullbook-shared-check-repair-20260926对寒冰赋权和旋风各自动修复一次，14207退出0，共输入88,932、输出4,949。两项都生成可接收稿且无人工修改，fullbook-shared-check-export.log通过，export-install-audit.json记录两项安装成功。旋风不再有shared ability-check编译阻塞，但吸物、连锁豁免、逐回合上升、联动、掉落及随机抛离仍未完整实现。寒冰赋权仍将已支持的移动困难地形误报为缺口；已确认实际请求中包含新指引，不能声称上下文缺失，也不能手删unsupported计作自动成功。材质限定地形豁免仍是真实缺口。

12:43:12Z累计已知输入27,976,817、输出1,495,267，1031已知调用及6未知usage。结构可安装不代表全书行为或网络验收完成，目标继续保持有效。

97982最终npm run typecheck退出0。新增自动稿后的全书预检重新运行通过；详细逐项结果仍保存在fullbook-consolidated-preflight-20260926.json。

## 缺稿批次、分类协议与检索容错

本轮分类为进展。重新核查12项无当前源文有效自动稿：旧魔射手/怪物杀手因非法manifest.contentCategory失败。SDK现在直接导入shared/plugin-content-category.mjs的实际目录，给所有规则转换显式合法枚举，不从条目名猜分类；4个目标类型的指引测试通过。新增虚构example-moving-terrain，使用既有area pattern展示source-token锚点、非自身目标及移动耗费倍数。与既有模式编译和移动地形测试合计18项通过，40567类型检查退出0。

启动fullbook-missing-current-repair-20260926，使用verified boundary inventory当前原文，仅选择12项缺稿，每项一次、最多26次实际调用，逐调用及逐条目保存用量和断点；没有手动修改生成稿。运行会话91491已确认仍活跃，最后观察12calls/7entries、已知输入316,429及输出21,767，尚未终结。尘卷风、牧人结社、魔射手已有可接收但blocked稿；剑舞学院仍有被动效果伪自动校验错误，醉拳宗仍有missed melee redirection错误。运行中条目的error可能是用于反馈的旧错误，不得当作最终失败。后续应先poll 91491，不重启此批次。批次未包括启动后新增的示例与容错代码，不能宣称验证了这些后续改动。

协议检索是advisory prompt裁剪，不应成为自动转换的硬性依赖。generateDnd5eLocalContentAiDraft现在只针对rule-mechanism-plan-failed错误回退到完整SDK，保留其他异常、正常配置Host gate及失败返回；成功稿assumptions明确记录检索失败和完整协议路径。localContentAiImport及mechanismPlan两文件28测试通过，包括计划失败后正常转换、仍拒绝非法配置、原文不变和两次调用上限。26856正在执行最终npm run typecheck（fullbook-advisory-fallback-types.log），需后续确认结束状态。

全书自动化尚未完成；有效草稿及可安装不等于规则行为认证。没有覆盖现有房间，也未将人工条目算为确定性自动化。

## 缺稿批次终结与机制索引遗漏修复

本轮分类为进展。91491已确认退出0，fullbook-missing-current-repair-20260926于12:54:55Z完成12项，23次调用，输入633,925、输出40,244。尘卷风、牧人结社、魔射手、怪物杀手生成有效自动稿，其余8项仍校验失败；不存在手动修稿。35982逐项导出/接收端解析/注册/卸载验证退出0，private export-install-audit.json记录4项installed。68352全书复核退出0，12:55:19Z为17结构可验、130blocked、8无当前源文有效稿；blocked增加来自原缺稿归类，不是通过自动化认证。累计已知输入28,610,742、输出1,535,511，1054已知调用、6未知usage。

26856上一轮检索容错最终类型检查退出0。本轮发现missed-melee-redirection是mechanic联合中的内联类型，而AI机制索引只收录命名MechanicV1声明，导致此能力不在检索候选。已改为等价DeclarativeMissedMeleeRedirectionMechanicV1，保留原验证与结算；声明包含触发after-attack-miss、reaction、self约束。weapon-damage-rider与spell-damage-ability-modifier声明也补上跨字段约束，并使三项既有错误提供要求字段，不放宽验证。

新增索引包含/裁剪测试，与advancedDefenseMechanics和genericCombatPrimitives共19测试通过（17963退出0）。33658正在运行最终类型检查，日志fullbook-mechanic-index-types.log，后续应先确认状态。上述索引及诊断变化发生在转换批次加载之后，该批次不能证明AI已使用新索引。下一步可对相关失败稿进行携带完整rejectedDraft的有界修复，仍需验证原文规则覆盖与真实结算。

33658最终类型检查已确认退出0；本轮已启动的转换、测试与类型检查均终结。

## 两项拒绝稿自动修复与导入后攻击转移验收

本轮分类为进展。fullbook-indexed-mechanics-repair-20260926仅选醉拳宗、剑圣宗，以新机制索引、当前预检反馈和完整原始rejectedDraft各自动修复一次。70066退出0，4调用（含检索），输入104,728、输出5,208。两项成为可接收配置，但大量机制仍manual，不能计完整自动化。新增索引全量覆盖测试，确保子职mechanic联合每个命名声明均在索引且不存在不可见的内联替代项；同时补充子职targeting与Activity.target不可混用的指引。相关转换/检索测试30项通过。

醉拳宗新稿暴露真实内部错误：Host投影出的missed-melee-redirection authorityBinding被Activity自己的名单拒绝。修复遗漏的missed-melee-redirection及attack-tradeoff；保持来源、活动ID、执行类别等其他绑定检查。新增合法能力→Host投影→Activity校验回归，与战斗防御及通用原语共21项通过；15160最终类型检查退出0。原始生成稿没有被手动改写。

fullbook-indexed-export.log验证两项原始自动稿导出、解析、注册及卸载成功。进一步读取磁盘entry-0.starmod重新导入，构造隔离6级武僧战斗，实际执行自动稿中的redirect-attack：未命中后自动命中重定向目标（AC99仍命中）、伤害9、消耗1气及反应、10尺越界拒绝。fullbook-drunken-imported.log通过，private redirection-behavior-audit.json记录结果；初版测试把Node Buffer直接传入浏览器ArrayBuffer API导致失败，已按真实上传字节类型转换测试输入。没有更改配置，fullSubclassVerified/networkVerified保持false。

13:03:00Z全书预检17结构可验、132blocked、6无当前源文有效稿。13:03:01Z累计已知输入28,715,470、输出1,540,719，1058已知调用、6未知usage。全部本轮进程已终结；目标仍未完成。下一步需处理剩余目标协议/被动效果/检定触发配置错误及已列出的实际机制缺口，不能把通过的单项攻击转移扩展为完整子职认证。

## 子职目标协议修复、被动授予上下文与资料规范化

本轮分类为进展。fullbook-target-protocol-repair-20260926针对日魂宗、救赎之誓、天界各一次自动修复，15247退出0，6调用（含检索），输入172,482、输出7,563。日魂宗有效并通过fullbook-target-export导出/重装；救赎之誓缺少无效果manual passive的targeting，天界引用未声明searing-vengeance资源，未视为成功。

发现子职转换上下文原先省略featureGuide，导致模型看不到同包features/staticModifiers组合。SDK现在为subclass包含该协议，并说明通过指定等级的build-grant授予特性；对应起身耗费接口本来已存在，不是新造规则。levelAdvancement回归扩展为等级前无能力、升级授予feature、角色快照获得standFromProneMovementCostFeet=5；与上下文及索引测试共23项通过。58936该阶段类型检查退出0。

normalizeDnd5eLocalContentAiSyntax新增严格的展示元数据规范化：仅trigger=passive、automation=manual、effects=[]、无mechanic/cost/activityEffects/rolls且targeting为undefined，补targeting:self。主动、自动或带执行数据的条目不补，显式目标不覆盖，unsupported及manual保留；对应31项导入/检索测试通过。fullbook-passive-normalization.test以原始救赎之誓rejectedDraft重放生产规范化→prepare→export→接收端安装，通过。结果保存fullbook-passive-normalization-20260926（无新AI调用），记录原始拒绝稿、规范化稿、parentRun及未行为/网络认证标记；这是可追溯生产格式转换，不是人工修改法术配置。

13:09:54Z全书预检17结构可验、134blocked、4无当前源文有效稿。13:09:55Z累计已知输入28,887,952、输出1,548,282，1064已知调用、6未知usage。79951最终类型检查仍在运行（fullbook-passive-normalization-types.log），下一轮先poll同一会话。目标保持未完成；此次降低的是格式缺稿数量，不是自动结算缺口数量。

## 被动额外攻击、最终缺稿批次及整书格式审计纠正

本轮分类为进展。79951类型检查确认退出0。fullbook-final-missing-repair-20260926对剑舞学院、征服之誓、风流剑客、天界各一次，88263退出0，8调用。征服之誓、风流剑客、天界有效并通过逐条导出/安装；剑舞学院仍被拒，原因是其attacks-per-action使用passive，而Host实际按被动读取该机制却仅接受active-use声明。

为attacks-per-action增加passive支持，保持既有active-use兼容、self目标、无动作消耗、合法次数及无额外被动effects限制。对应真实通用攻击原语测试改为passive，额外覆盖拒绝主动成本/未执行effects，两文件45测试通过。46740诊断类型检查和8974被动攻击类型检查退出0。剑舞学院原始拒绝稿未经人工修改，经生产流程重放解析、导出和安装通过，保存在fullbook-passive-extra-attack-20260926；仍未完整子职认证。另为子职校验错误加入能力序号及ID，59测试通过，方便自动修复定位。

整书合并导出尝试未成功，重要审计纠正：旧汇总把“存在自动稿但当前无法解析”与“格式有效、机制未完成”混为blocked，按问题数量选中了非法manual Activity等级的幽魂凝视稿。生产PDF预检新增contentParsed（仅格式解析证据，不是安装/行为认证）；汇总与整书候选选择严格区分。9项预检/汇总测试通过。13:18:18Z真实结果：17结构可验、136机制blocked、2无可解析当前源文稿（幽魂凝视：非法Activity automation.level=manual；木精灵魔法：两个授予法术缺castAtLevel）。旧0缺稿计数不能作为整书可导入证明。整书测试坚持155项全部参与，缺少可解析候选就失败，没有跳过条目。

13:16:01Z累计已知输入29,132,214、输出1,558,020，1072已知调用、6未知usage。33679最终格式预检类型检查仍在运行（fullbook-parseability-types.log），下一轮先poll同一会话。下一步解决两项格式问题后重新做整书合并导出，再检查潜在ID/依赖冲突；134/136等blocked计数变化不代表更多机制已自动化。全书及真实网络目标仍未完成。

## 整书格式恢复、逐项注册审计与大骰池修复

本轮分类为进展。上一轮33679类型检查确认退出0。fullbook-parseability-repair-20260926完成4调用，输入110,931、输出2,850：木精灵魔法生成可解析新稿，幽魂凝视新稿仍含Activity automation.level=manual。生产格式规范化新增manual→dm-adjudication，仅规范既有枚举别名，保留phases/limitations/operations/unsupported，不授予自动执行能力；32项相关测试通过。幽魂凝视原始拒绝稿规范化后的单条重放仍因不存在的子职业来源注册失败，未写成功证书。不要把该重放计为安装成功。后续最终类型检查57836与23251均退出0。

当前精确源文清单155项均存在可解析候选，预检17项ready-for-behavior-tests、138项blocked。这仅是格式恢复，非全书自动化。整书合包注册先发现持续区域授权仅接受full，而普通入口支持带显式manual-adjudication的assisted。已共用同一可执行能力判断，保留主动调用/authority边界，区域控制feature以partial反映assisted。回归覆盖注册、人工批准操作保留、卸载及拒绝triggered区域主动控制。整包继续遇到shared attack-roll不兼容，未成功。

新增隔离逐项接收端注册审计fullbook-registration-audit-20260926，全部155项均参与，没有丢弃失败。初次149成功、6失败。心灵尖啸14d6被pluginApi旧12骰上限错误拒绝；将有限上限统一至公式常用上限1000，仍限制整数/面数/总声明数。新增真实注册→Host结算14d6=42伤害，并拒绝13/15颗骰、越界点数及1001颗声明。与contentPackageV2/pluginApi共38测试通过，23251最终类型检查退出0；首次测试单参战者导致combat-ended，修正隔离夹具加入对手后通过。

fullbook-registration-repair-20260926用6项实际注册错误进行每项一次自动修复，81765退出0，13:33:11Z结束，9调用，输入290,849、输出12,509。5项返回有效稿，莱维斯图斯之墓仍duration/value公式格式错误。新稿独立导出安装仅3项通过（心灵尖啸、光墙、进阶契约武器）；混乱箭暴露random-roll与formula同rollId重复声明，幽魂凝视仍引用未安装子职业。错误完整记录export-install-audit.json，没有人工修改配置或伪称五项成功。

合包/逐项候选选择增加已有export-install-audit接收端证据排序，仍对精确源文候选做当前实际注册。83488复核152安装成功、3失败：混乱箭（所选旧稿shared attack-roll，较新稿则重复dice declaration）、幽魂凝视（不存在的子职业来源）、莱维斯图斯之墓（旧稿feature automation level）。全书合包重验27981运行中，日志fullbook-combined-current.log，下一轮先收尾；预计仍被混乱箭阻塞，不能假定成功。注册审计通过的含义是完整记录155项结果，不是全部内容通过。

13:35:34Z累计已知输入29,533,994、输出1,573,379，1085已知调用、6未知usage。没有本轮未结束AI请求；不应无限重试同一反馈。下一步检查共享骰声明编译边界及两项特性来源/枚举协议，再修复并验证。整书安装、完整确定性机制行为认证、真实房间DM/玩家同步仍未完成；目标保持active。

27981已确认退出1：整书合包仍被chaos-bolt-cast的attack-roll/shared阻塞。该测试失败已记录，所有本轮已启动进程均终结，未获得完整合包可安装证明。

## 155项整书合包首次通过接收端注册

本轮分类为进展。基于上一轮实际文件重新核查，混乱箭的新稿重复声明random-roll与formula骰池；幽魂凝视PDF跨页正文夹入咒剑旁白，模型误推断子职业归属。SDK通用说明补充骰池复用、主动攻击per-target，以及独立特性来源字段不是先决条件、不可由旁白推断归属。编译兼容性检查提前返回duplicate shared dice declaration，并捕获不一致公式骰声明为兼容性原因，未静默丢弃随机检查。新增相应测试与SDK指引测试，10项通过，12222类型检查退出0。

fullbook-registration-protocol-repair-20260926以最新拒绝稿和真实注册错误修复3项，57382退出0，13:40:10Z完成5调用，输入151,399、输出5,653。三项格式接收，混乱箭及幽魂凝视成功导出安装；莱维斯图斯之墓仍把sourceClassId放在独立特性上。prepareDnd5eLocalContentJson新增无副作用的独立feature来源字段检查，覆盖V2输入及简写/合集，和运行时既有拒绝规则一致，不改规则配置。测试覆盖拒绝sourceClassId/sourceSubclassId以及合法独立feature实际注册。

fullbook-feature-binding-repair-20260926使用最新原稿及新接收门错误再次自动修复，仅1条2调用，输入55,800、输出2,238，72254退出0，13:42:40Z结束；生成莱维斯图斯之墓原稿经导出/重装成功。没有手动修改实际转换配置。扩大测试结果23通过、1失败：localContentCollection.test的旧私有PHB资料在原compile→parse路径报7个activity缺manualPhases；新来源检查不在该失败调用路径。日志fullbook-feature-source-tests.log。不要宣称全套回归通过。79262最终类型检查仍运行，日志fullbook-feature-source-types.log，下一轮先poll。

16803整书合包测试退出0，52381逐项注册审计退出0。fullbook-registration-audit-20260926为155成功/0失败。private fullbook-combined-current-20260926/fullbook.starmod于13:43:31Z生成，542,753字节；全部155精确源文条目参与，无丢弃。接收端重新解析内容相等、注册及卸载成功。包内95 spells、31 subclasses、15 feats、15 features、1 item、129 activities；源清单14独立features，额外feature为转换产生的辅助内容，并非新增书本清单项目。report.roundTripVerified及recipientInstalled均true；behaviorVerified/networkVerified仍false。

全书静态预检保持17 ready/138 blocked。进一步将当前实际安装候选逐一映射到preflight，而非只取历史最优候选，生成private fullbook-selected-mechanic-backlog-20260926.json；实际选中配置也为17 ready、138 blocked。后续必须围绕该实际导出包补行为/机制缺口与网络验证，不应把整包安装成功等同全书自动化。

13:44:08Z累计已知输入29,741,193、输出1,581,270，1092已知调用、6未知usage。所有AI批次与合包测试已终结；类型检查79262待确认。目标保持active，未完成。

79262最终类型检查已确认退出0。本轮已启动的转换、测试及类型检查均终结。

## 实际整书包行为验证揭示候选回退并修正预检

本轮分类为进展；上一轮79262最终类型检查已结束。先读取当前实际包选择与138项待办，未把“接口不支持”的模型声明自动当成真实接口缺失。本轮无AI调用，未改变实际生成规则配置。

新增直接读取fullbook-combined-current-20260926/fullbook.starmod的行为夹具。首次原初蛮击测试失败invalid-dice：候选选择原先按注册证据/静态问题数排序，平局采用目录顺序，选中旧critical-convert的重复普通/重击分支。加入转换完成时间平局排序后仍失败，因更新的spells-current-repair稿漏掉critical:double-dice。时间不能替代规则验证。

生产pdfSpellHeadlessPreflight新增法术攻击重击风险检查：对attack-roll的success分支中含骰伤害未声明double-dice给出阻塞；critical-success与success复用伤害骰池标出重复风险。检查仅用于预检，不自动改写规则或抹掉特殊分支。新增合法单分支、遗漏重击、重复伤害回归，9项预检测试通过。29353最终npm run typecheck退出0。

审计候选排序调整为当前ready优先、接收端证据、问题数、完成时间。预检排除两份错误稿后选择原初蛮击fullbook-primal-final-convert-20260926，未手改配置。73693全155条目重新合包、导出、解析、注册、卸载通过。17静态ready/138blocked计数不变，因为原初蛮击仍有合格旧稿。

实际整包行为结果：83715两个测试通过，原初蛮击8等级×命中/未命中/重击24组合正确，史尼洛雪球群2/3环混合豁免、范围外不受伤、法术位扣一次通过；33125两项专长测试通过，龙之鳞爪构筑加属性、未穿甲/持盾/穿甲AC、真实天生武器攻击及失去专长后拒绝入口，天赋异禀技能/专精/语言/工具Host检定通过。生命转换真实整包直接Activity→Host结算4组合（3/4环×有无抗性）通过，治疗按实际承受伤害×2；首次夹具仍用旧rollId导致invalid-rolls，修正为从当前声明读取ID并仍断言4d8及独立伤害/治疗数值，非改配置或放宽结果。

生成private fullbook-combined-behavior-index-20260926.json，五份证据均绑定同一SHA256 90f96e7d0d52b0035d04ab1a1d4839f3bba5f5b6433e5aee0c984eb8583a0331；24+2+4数值组合及两项综合专长行为。不将有限用例计为整书行为认证；生命转换该用例非玩家网络事务。fullbook-selected-mechanic-backlog-20260926.json已按新整包候选与hash刷新。实际房间网络/同步仍未验证，fullBookBehaviorVerified与networkVerified均false。

本轮全部已启动进程终结，无新增API token。下一步继续当前包其他ready条目以及138项机制缺口，并建立隔离DM/玩家实际同步验证。目标保持active。

## 隔离DM/玩家整书上传、学习及真实网络结算验证通过

本轮分类为进展，无新增AI调用、无修改实际转换配置。新增.codex-logs/fullbook-room-sync.spec.ts及config.ts，使用6773/6774两个Vite服务，独立stars-fullbook-isolated-<timestamp>临时数据根与全新浏览器上下文。未使用5273/5274现有数据或清空任何已有房间；每次创建独立测试房间，服务由Playwright回收。

16083首次网络测试退出0：DM通过真实工坊文件input上传整书starmod，玩家侧自动激活同版本，服务器requiredPlugins包含local.fullbook-current-audit@1.0.0。80809扩展测试退出0：为独立玩家创建空白5级法师，玩家在法术书界面搜索史尼洛雪球群，点击加入法术书、2环、准备；玩家拥有的角色选择通过真实网络保存至房间。原始包hash仍为90f96e7d0d52b0035d04ab1a1d4839f3bba5f5b6433e5aee0c984eb8583a0331。

继续施放测试先暴露夹具问题：8175把尚未生成回执的404立即断言失败，已仅对待生成player-action-ack返回null继续等待。36034实际Host拒绝material-component-unavailable，证据保存private fullbook-room-network-material-rejection-20260926.json。14859仍拒绝，因为夹具把材料包写入inventory而非正式dnd5eInventory；纠正测试角色字段，没有绕过或放松应用成分校验。42609无最终ack，失败截图显示DM地图骰盘正等待豁免确认；夹具之前仅查询d20-roll-continue旧入口，现追加实际骰盘确认及玩家伤害投掷按钮，不修改骰面。

4358最终完整测试退出0，日志fullbook-room-sync.log显示1 passed(1.3m)。整包上传→玩家自动激活→UI学习/准备→玩家真实publishPlayerActionFromPage传输请求→DM确认目标豁免→Host accepted→二环法术位3降2→目标HP30降21→玩家通过自己页面的生产sharedApi读取相同受伤地图。UI热栏出现已验证，但本次施放请求使用生产传输helper发出，未覆盖点击热栏法术及手动放置模板交互；不应宣称这些交互通过。没有mock API或模拟Host结算。

private fullbook-room-network-audit-20260926.json记录archive hash、房间requiredPlugins投影integrity、角色学习、lastAck、玩家读取到的地图和明确范围；testedSpell仅snillocs-snowball-swarm，fullBookBehaviorVerified=false。整包传输/激活成功不等于95法术/31子职等每项都已行为认证。所有本轮进程终结，没有需要poll的live会话。上一轮静态17 ready/138 blocked及其他机制缺口仍在；目标保持active，下一步继续实际整包逐项机制收敛。

## 持续区域缩放与触发语义修复

本轮为进展，目标保持active。实际Activity执行器本已支持create-persistent-area触发伤害的等级/升环缩放；新增合成阶梯1/4/5/10/11/16/17/20与升环执行回归，39项执行器测试通过，72385类型检查退出0。补充生产AI SDK说明将scaling.adjustments.operationId绑定区域操作，同时绑定初始伤害操作，未手工改生成配置。

自动重新转换创造篝火与光墙（fullbook-area-scaling-repair-20260926，2次调用）修正缩放，但逐项源文复核发现篝火on-enter与turn-end共享frequencyGroupId会漏算结束回合伤害，光墙错误source-token锚定会跟随施法者。SDK新增独立限次及fixed锚定说明。生产pluginAreas增加首次进入、同回合重复进入拒绝、结束回合独立触发、下个生物回合重新进入测试，与SDK测试共68项通过。

第二批fullbook-area-semantics-repair-20260926（2次调用）仍失败：篝火把区域savingThrow.dc写为Activity公式对象被验证器拒绝；光墙额外新增无豁免on-create伤害，与既有初始outcome重复。没有将这些稿件当作成功。SDK补充区域DC类型及初始伤害二选一表达，第三批fullbook-area-semantics-final-20260926自动重转（2次调用）通过解析，保留所有真实缺口。

新增private生成包areas.starmod及behavior-audit.json：真实exportPdfContentModule→接收端解析→注册/卸载→Activity执行。篝火8等级的所有触发伤害骰1/2/3/4d8，真实地图触发收集与收据验证进入/结束回合各一次；光墙5/6/9环持续伤害4/5/8d8、固定锚定、无重复on-create伤害，共11组通过。此检查覆盖执行提案和地图触发收集，不是完整伤害Host事务或网络施放；不宣称两法术完整认证。整书旧包与其网络验证hash未替换。

仍有可燃物点燃及地面条件、倾斜/三维光墙、射线缩短墙长及归零结束的真实缺口。不能把这些视为DM叙事而跳过。当前整书17静态ready/138blocked统计尚未重新汇总，也未声称减少。

本轮三批共新增已知271158 input/13022 output tokens。累计快照2026-09-26T14:22:15Z：30012351 input /1594292 output，1098 known calls；6次历史调用usage未知，不按0计。无原房间修改。
最终48752 npm run typecheck退出0。本轮全部进程已结束。下一步优先核查并补齐通用持续区域缩短/归零结束来源的接口，再对光墙射线做实际Host事务与地图清理验证；已定位ActivityContracts/Executor/HeadlessCompiler/MapInteraction及headlessCombatEngine的areaRelocations链路，可参照但不能把移动接口冒充缩短接口。

## 通用持续矩形区域保留几何信息

上一轮为进展：已改SDK并完成生成包区域缩放/触发行为验证。本轮核查缩墙链路，发现普通Dnd5ePluginArea仅保留cells，没有矩形原始尺寸与方向；不能从裁剪后cells数目推断墙长。先补真实数据生命周期，不直接宣称缩墙已完成。

新增persistentAreaRectGeometry.ts的有界几何类型与规范化；Host区域选择从实际cellsForAoe使用的模板及orientFrom捕获widthFeet/lengthFeet、单位方向、gridAligned。持续区域创建复制此数据，reshape-granting-area更新/清空几何，平移依旧保留相对方向。地图normalize/migrate保留并校验此字段，旧存档缺省不猜测，非法长宽/零方向/非单位方向拒绝该非法区域。普通存储/房间同步整体传递map，不需要独立请求；本轮未新增网络测试。

fullbook-rect-geometry.config.mjs覆盖地图handoff与mapsMigrate，67项通过，包含4方向创建/JSON保存/恢复、原始覆盖格相等、无输入突变及非法/旧存档处理。不是缩短操作验收：尚需新增shrink-granting-area声明、验证、执行提案、编译器/直接Headless handoff、Host地图权限/尺寸处理、零长度来源清理、UI handoff识别，再将光墙自动重转并验证命中/未命中都缩短及最后一次结束。

已确认可复用reconcileDnd5ePluginAreasAndConcentrationOnMap，必须同时提供移除前/后map，避免错误清理同施法者的新专注；目前MapsWorkspacePage的detonatedAreaIds路径有现成正确范例。普通区域只存cells这一缺口本轮已修复，缩墙完整流程仍未完成。本轮无AI调用、未替换整书验证包、未改已有房间，目标active。
最终76822 npm run typecheck退出0；28503重新运行67项相关测试退出0。所有本轮进程已终结，无待轮询会话。

## 通用缩墙操作与自动生成光墙包执行验证

上一轮为进展（真实矩形几何持久化）；本轮新增shrink-granting-area通用操作，target actor、lengthFeet公式，接入声明/验证/骰公式收集、Activity执行提案、安装后的Headless编译器与直接commitDnd5eActivityExecution、机制目录和地图handoff。Host重新核对来源Token/角色及授予活动，拒绝无几何、非法长度、越权。以原方向/中心收缩，只检测原有格子避免恢复障碍裁剪格和大矩形网格枚举。形变收据保留最近256项并随地图存储，重复同actionId/operationId不再次缩短；外层动作事务仍负责资源幂等，未宣称无限历史防重。

归零移除区域及其独立effect-token，返回endedAreaIds。玩家授予活动结算路径将移除前/后map交给既有来源匹配专注reconciler，更新角色和受影响Token变更集合，保留施法者后来开启的新专注。此操作只终止该区域；有其他同来源区域存活时既有reconciler保留来源专注。未将多个区域的法术整体终止策略默认为本接口语义。

核查实际UI发现areaSelection会手动由已解析areaPlacement重建，缺少上一轮新增的rectGeometry。因此创建/重塑时增加从Host尺寸、角度和Actor地图锚点恢复几何的后备路径；不是信任客户端随意提交的尺寸。测试覆盖缺metadata的UI形状。

新增dnd5eActivityAreaShrink.test.ts：普通失败/命中/重击都产生一次缩短，水平/垂直/斜墙连续六次由60减到0、裁剪格不恢复、JSON恢复后重放不重复、非法请求不修改输入，最后移除对应专注且不清理新专注；安装后和直接Headless均保留handoff。首次Headless夹具只有玩家导致combat-ended，补真实敌方单位；随后精确对象断言遗漏Host logTrigger元数据，改为保持核心字段断言。20119最终相关75项通过。73208类型检查只报新增测试未收窄ok判别联合，已修复并启动3625最终类型检查。

更新AI SDK后单次自动重转光墙fullbook-wall-shrink-convert-20260926（无手改内容）：生成always分支shrink操作并删除旧人工缩墙步骤。新稿仅报告射线距离须从墙计算而非施法者，当前creature目标协议缺此能力；模型移除了原有三维倾斜限制，不能由此推断已支持，行为报告继续明确未验证三维放置。

fullbook-generated-wall-shrink.test.ts通过实际export/import/register并执行生成的区域创建与六次射线提案到Host地图：1/15/20/1/15/1攻击骰，每次减少10尺，第六次endedAreaIds并清空墙。private wall.starmod及shrink-behavior-audit.json绑定artifact hash与six-case证据。范围是生成Activity到地图，不是完整玩家UI/网络、射线距离或伤害结算认证。未替换整书旧包/其网络hash。

本轮新增AI input46250/output2923，一次调用；累计2026-09-26T14:40:27Z input30058601/output1597215，1099known calls，6次usage未知。目标active。下一步优先完成creature射线范围从授予区域测量与Host资格校验，再重转验证光墙；仍需保留三维几何与全书其他缺口。
最终3625 npm run typecheck退出0，65654含UI缺metadata后备路径的75项测试退出0。所有本轮进程终结，无live会话。

## 区域来源测距已存在：修正转换能力说明并验证实际生成包

上一轮为进展（shrink通用链路及生成包通过）。本轮以当前代码为证据，发现此前“生物目标缺rangeOrigin字段所以光墙射线无法从墙测距”判断错误：pluginFeatureAction.ts的persistentAreaGrantForAction核对来源、插件、授予关系，single/multiple-creature分支已有persistentAreaDistanceFeet，按区域覆盖格至目标占据格最短距离；hostDistanceFeetByTargetId传入Headless编译器及最终结算。UI区域授予入口提供persistentAreaId，不需要再造字段。未重复新增测距接口。

生产修改仅拒绝cells为空的区域作为授权来源（此前距离辅助函数会回退0,0）；SDK说明已有隐式区域测距机制，保留施法者视线条件与仅限真实区域授权的边界。扩充pluginFeatureAction边界测试：距区域30尺但远离施法者可用，35尺拒绝，靠近施法者但距区域95尺拒绝，空区域拒绝。31227相关28项通过。

直接读取上一轮wall.starmod，通过安装后的真实区域控制feature和prepare/resolvePreparedDnd5ePluginFeatureAction：区域格20..31、目标格43为距墙60尺/距施法者215尺，Host命中造成12伤害并产生缩墙handoff；格44距墙65尺拒绝，格1距施法者5尺但距墙95尺拒绝，格31在墙内0尺接受。玩家payload伪造hostDistance0无效，空/他人/不存在区域拒绝。private range-behavior-audit.json记录hash及范围，属于玩家事务至Host，非浏览器网络或遮挡场景验证。

单次自动再转换fullbook-wall-origin-convert-20260926，输入46063/output2665。修复反馈引用已执行的能力，并明确保留任意倾斜三维墙体缺口。新稿成功移除射线测距unsupported，保留倾斜三维限制；没有手工修改配置。新wall.starmod再次实际导出/重新导入/安装，六次缩墙测试和相同范围/伤害Host测试均通过（15852最终范围测试退出0）。新artifact的shrink/range报告及export-install-audit.json明确fullSpellBehaviorVerified false。旧整书包和网络hash未覆盖，17/138全书统计未重新计算。

累计2026-09-26T14:47:01Z input30104664/output1599880，1100known calls，6次历史usage未知。目标active。下一步回到全书机制清单识别类似误报与真实缺口，同时不能将光墙三维倾斜几何默认为叙事或已实现。
最终12587 npm run typecheck退出0。本轮所有进程终结，无待轮询会话。

## 后续活动入口：炽焰赋权实际施放与火线结算通过

上一轮为进展（区域来源测距真实生成包验证）。本轮继续全书待办，读取原PDF来源后选中渺远步和炽焰赋权的临时活动授予缺口。fullbook-followup-entry-repair-20260926限2调用自动修复：渺远步apply-effect授予repeat-teleport，炽焰赋权根施放改为self-origin 5尺区域、Effect与区域授予火线，并保留独立首次进入/回合结束触发。未人工改配置。

发现炽焰赋权把30尺明亮＋额外30尺微光写成30/60；真实mapGeometry按bright+dim计算外边界，会扩大至90尺。生产SDK与Effect协议注释明确dimRadiusFeet是额外距离。fullbook-flame-light-repair-20260926一次重转被验证器拒绝（火线damageType非法），保留rejectedDraft；fullbook-flame-final-repair-20260926一次错误反馈重试成功，未手工修字段。

fullbook-flame-entry-behavior通过实际导出/接收端解析/注册，然后玩家prepare/resolvePluginSpellCast：六环法术位2→1，专注Effect实际授予line。首次测试把所有修正误以为在同一modifier数组中，引擎实际拆为三份Effect（emittedLight、damageImmunity、damageResistance）；修正测试读取真实结构，保持分别断言火免/冷抗/30+30照明。下一回合实际玩家prepare/resolvePluginFeatureAction，目标DEX失败火线4d8=12，HP100→88，不再消耗六环法术位。清除授予Effect后入口请求被拒绝。private flame.starmod、entry-behavior-audit.json及export-install-audit.json绑定SHA256；尚未验证持续光环移动触发、自然到期清理/专注结束、全部伤害防御实际效果与网络，fullSpellBehaviorVerified=false。

渺远步不能凭assisted标签推断无按钮：实际export/import/register的far-step-entry-audit.json证明effect-control存在，生成稿没有显式manual-adjudication操作。此前“可能无法生成按钮”只是待验证猜测，已由安装审计排除。仍须实际首施放/后续附赠动作、可见空位与60尺边界、到期/专注结束清理验证；源稿保留精确可见性限制，未认证全法术。

SDK7项测试通过；本轮生产变更仅协议注释与SDK文字，无运行逻辑变化，未重新跑全量typecheck。所有本轮进程终结，无live句柄。新增4次已知AI调用input175736/output8542；累计2026-09-26T14:56:20Z input30280400/output1608422，1104known calls，6次历史unknown usage。旧整书导出包与网络验证hash未覆盖。目标active，下一步完成渺远步行为和炽焰赋权光环/结束清理，再更新全书机制审计。

## 渺远步真实传送与炽焰赋权光环/防御/到期验证

上一轮为进展。本轮不调用AI、不更改自动生成配置，读取现有候选并扩展真实行为验证。

fullbook-far-step-behavior.test.ts从fullbook-followup-entry-repair自动稿导出far-step.starmod、重新导入注册，走玩家法术prepare/resolve和地图handoff：首次施放五环法术位2→1、bonusActionAvailable false而actionAvailable true；60尺落点成功，65尺/已有生物占据/视觉墙遮挡落点失败；下一回合原Effect授予的repeat活动经玩家feature prepare/resolve成功，再传送60尺且法术位保持1；附赠动作耗尽时拒绝；advanceDnd5eCampaignTimedActiveEffects推进1分钟使原授予Effect消失，再次使用被拒绝。完整检查通过，private far-step-behavior-audit.json绑定输出hash。不覆盖黑暗/特殊感官、真实UI网络、全部专注中断情况，fullSpellBehaviorVerified false。

扩充fullbook-flame-entry-behavior.test.ts：用实际生成根施放的persistent-area handoff落图，目标首次进入5尺光环触发实际prepare/resolvePersistentAreaTrigger，1d10骰7使HP100→93；同回合再次进入无候选；同回合结束独立触发骰3使HP93→90。施法者自身回合结束无候选。来源从col5移到col10后调用生产来源移动协调器，区域anchorCell跟随至10,5；推进10分钟再用生产区域/专注协调器清除区域，后续火线请求失去权限。真实生成状态上以合成固定10伤害Activity作为探针提交Host，fire0/cold5/force10，验证实际免疫/抗性而非仅元数据。全部通过。报告保留有限范围，未宣称特殊光照渲染、网络或全法术穷尽认证。

刷新两份输出artifact hash与export-install-audit证据；仅本地测试产物，未改原房间/旧整书输出。全书consolidated-preflight重新跑通过，2026-09-26T15:01:45Z静态18 ready-for-behavior-tests /137 blocked，比旧统计多1 ready（炽焰赋权）。不能将静态ready数当成已完成法术数；全部155条目仍纳入清单。旧fullbook-selected-mechanic-backlog基于旧整包，还没整体替换。

本轮无生产代码更改、无AI token增加；未额外执行typecheck（仅scratch行为夹具/证据变化）。所有进程终结，无live句柄。目标active。下一步应按刷新候选审计其他真实缺口与误报，并在合包更新前保留旧网络已验证artifact供回溯；光墙三维倾斜、渺远步精确可见性等仍未完成。

## 地缚：通用飞行上限、受控强制下降与生成包行为验证

新增 Effect modifier `flight-speed-limit.maximumFeet`（0..1000），覆盖天生/变形/魔法飞行而不改写基础属性，速度加值后封顶；归一化保留0，共享资源严格校验、Activity执行器、Headless提交、脚本effect白名单、mechanic registry、角色移动投影和快速面板均接入。自由行动忽略魔法速度限制，非魔法上限仍有效，暂停效果不参与。测试发现Headless机械效果提交中字段遗漏并修复。

新增 controlled-descent.forceWhileFlightBlocked:true，仅当有效飞行上限为0时，突破悬浮/魔法支撑在目标回合开始安全下降。下降Effect与禁飞Effect分离，endsOnLanding只清除前者；专注结束清除两者。未更改普通羽落/御风行结束后的下降语义。巨鹰等怪物speed保存最快原始模式，因此禁飞后的movement pool必须从剩余模式重新计算，避免仍保留80尺飞行额度；独立walkSpeed保持10尺。

生产 dnd5eFlightSpeedLimit.test.ts等3文件60项通过，覆盖Activity实际提交、0序列化、叠加、魔法/非魔法、暂停、变形、原最快移动池、100→40→0安全下降、落地保留禁飞以及专注恢复。额外4文件81项通过，覆盖traversal、playerBasicAction、Activity authority和SDK。最终typecheck见fullbook-flight-final-types.log（需等待进程最终退出；此记录不提前声称通过）。

fullbook-earthbind-flight-repair-20260926仅1次已授权API自动修复，input40323/output1279，未手改配置。初次preflight暴露mechanic registry漏列新modifier，修正生产registry后重跑同一未编辑draft即可ready，无额外API。fullbook-earthbind-behavior导出earthbind.starmod并重新解析/注册，真实玩家prepare/resolve：巨鹰失败力量豁免后飞行80→禁用、步行10、移动池10，成功豁免不受影响；二环位2→1；回合推进高度100→40→0无伤害，触地禁飞保持，专注结束恢复80。私有behavior-audit/export-install-audit绑定artifact SHA。测试夹具初次使用错误monsterId（应poolId）和rolls字段（应activityRolls）已修正。fullSpellBehaviorVerified=false，尚未验证真实双端网络/渲染及全部边界。

2026-09-26T15:20Z静态审计19 ready-for-behavior-tests /136 blocked，155条均保留。累计已知API input30320723/output1609701，1105known calls，6unknown；unknown不是0。旧整书文件未替换，既有网络证据hash仍有效。全书目标仍active，不将单项通过当成全书自动化完成。

## 霜噬：下一次武器攻击类别与导入包验证

上一轮地缚 final typecheck 已在 session28028 退出0，本轮开始确认上一轮为progress。新增 `weapon-attack-roll`（优势/劣势）和 `makes-weapon-attack` 生命周期事件；ActiveEffect规范化/严格边界、Activity协议/校验/执行、Host提交、注册白名单、脚本effect白名单和效果详情中文说明接入。玩家装备攻击准备读取相同修正；怪物多重攻击准备只在第一击保留一次性修正，持续型修正仍作用后续攻击。通用attack事件增加可选attackCategory，防止投石索魔石虽走装备路径却按武器攻击消耗效果。

生产4文件116tests通过，包括真实Activity施加后火焰箭不消耗、投石索法术攻击不消耗、武器命中/失手消耗，flags序列化和暂停，玩家预览与Host相同劣势，以及棕熊多重攻击预览['disadvantage','normal']。测试夹具修正了错误duration字段、同阵营目标、法术事件未声明rollMode，以及ranged fixture缺少distanceFeet/normalRange造成的无关劣势。未将这些夹具失败算作生产问题。

fullbook-frostbite-weapon-repair-20260926用已授权模型1次自动修复，input40637/output1305，稿件未手工改写；preflight ready。fullbook-frostbite-behavior导出frostbite.starmod并重新解析注册，经真实玩家prepare/resolvePluginSpellCast：等级1/4/5/10/11/16/17/20各自失败/成功CON豁免共16组合，伤害按1/2/3/4d6，成功无伤害无状态；失败状态在下一次武器失手后清除，或未使用时目标回合结束清除。单包behavior-audit/export-install-audit绑定SHA。仍未覆盖真实网络/渲染及所有可见性边界，不称全法术穷尽认证。

2026-09-26T15:36Z全书静态20 ready /135 blocked，均有源稿155条。累计已知API input30361360/output1611006，1106known calls，6unknown。原整书网络证据文件保持不动，另生成fullbook-combined-flight-weapon-20260926（version1.1.0）用于收纳新候选；其安装检查与本轮最终typecheck须读取最终进程结果后确认。全书goal仍active。

本轮终态确认：fullbook-weapon-final-types.log对应session89765退出0；combined-flight-weapon对应session75604退出0。新整包155源条目全部保留，recipientInstalled=true，地缚/霜噬选择本轮未手编辑自动稿。新包SHA256 747b83d270cd91353d8fc22c01eefcedca631fc58e7e59351b7c79bfd582a86c，artifact-sha256.json明确networkVerified=false；旧90f96...网络已验证包不变。本轮全部进程终结，无live句柄。下一步按20/135静态审计继续排除旧配置误报并补真实机制，需对新整包再做跨端验证，不能沿用旧包网络证据。

## 新整包1.1.0的隔离双端验证

上一轮为progress。本轮未修改生产代码/配置稿、未调用AI，针对新包747b83d270cd91353d8fc22c01eefcedca631fc58e7e59351b7c79bfd582a86c重跑实际浏览器链路，不沿用旧包证据。隔离Vite6773/6774、独立临时shared root与新房间，无5273/5274原房间写入。

fullbook-room-flight-weapon首轮terminal exit1，原因是复制夹具仍断言已激活v1.0.0，实际新包v1.1.0；日志保留fullbook-room-flight-weapon-stale-version.log。修正该断言后，在确认首轮终止后重跑；session55976退出0，1 test passed（1.4m）。DM工坊UI上传整包，玩家扩展页精确版本激活，requiredPlugins版本1.1.0/integrity sha256-6hUSEocT95zM0LvXBevnMU+PGxIjBLxZSkwfU5EOjiI=；玩家角色页UI学习/准备雪球群；生产submitPlayerActionFromPage发送请求（非全程点击hotbar与区域模板），真实DM骰子确认/玩家伤害确认后Host accepted，二环法术位3→2，玩家页面sharedApi读回目标HP30→13。fullbook-room-network-flight-weapon-audit-20260926.json记录精确artifact hash与测试范围。只验证雪球群一项，不把整包同步等同全书机制通过，也未覆盖地缚/霜噬的真实双端行为。旧包及旧网络记录保留。

独立源码审计确认下一通用缺口：persistentAreaTypes的occupantModifiers只支持防护/环境布尔与免疫，没有区域持续施加标准状态；沙墙要求区域内目盲、离开解除，守护之风要求区域内耳聋。mapBridge applyPersistentAreaOccupantModifiers可投射瞬态Effect，persistentActiveEffectsWithoutTransientAreaSuspension过滤persistent-area-occupant来源；但token.conditions（约1517行）与character.conditions（约1843行）直接写回combatant.conditions，若新增投射状态必须同步处理这两处，避免离开残留和重叠区域清理误删。下一步需要覆盖双方、状态免疫、多个区域和独立同名状态。此项仅完成定位，尚未修改生产代码。

本轮所有进程terminal，无live句柄；全书静态仍20 ready/135 blocked，155源条目，累计API不变。goal active。

## 区域持续标准状态与自动沙墙模块验证

新增 occupantModifiers.conditions 闭集字段，复用区域关系、自身排除、相交与高度判定，并投射为 persistent-area-occupant 来源的临时状态。Headless 读取免疫，反魔法抑制；写回角色和 Token 时剔除仅来自区域的状态，保留独立同名来源。SDK 指引明确区分占据期间状态与进入触发的定时状态。

fullbook-area-conditions 的 4 个文件共 88 tests passed；包括重叠区域、玩家/怪物、独立目盲、免疫、反魔法、离开与移除区域。最终 typecheck session59373 exit0，日志 fullbook-area-condition-final-types.log。初次 typecheck 的非法 label 字段已删除，未将初次失败计为通过。

未手改源稿，调用已授权 AI 一次生成 fullbook-sand-occupant-repair-20260926，input45324/output1480。自动沙墙稿准确生成 blinded、三倍移动消耗与视觉阻挡；仍显式 blocked 于可见地面点验证及可变较小尺寸等限制，不宣称完整法术自动化。fullbook-sand-behavior 测试导出 sand.starmod、重新导入注册、Activity resolution/map handoff、实际 Headless 区域目盲与离开解除通过。该测试从 executor proposals 组装 map handoff，不覆盖玩家施法资源、完整 compiler 执行、网络与 UI；behavior-audit 明示范围且 fullSpellBehaviorVerified=false。夹具首轮缺少 areaPlacementDistanceFeet 失败，补上真实地图选择结果后重跑通过；没有修改生成配置。

累计已知 API input30406684/output1612486，1107 known calls、6 unknown calls；未知不算零。整包1.1.0未重写，本次新沙墙候选尚未合入并重新验证全书包。

后续必须继续补地图 Token 状态展示和地图操作条件读取：当前 MapViewportLayer / MapsWorkspacePage 只读取持久化效果，尚未投射新区域条件。不可为了显示调用会推进开始回合的完整 snapshot，需共用无副作用的防护/区域投射层，并覆盖免疫与反魔法。新通用接口的现有结算测试通过不等于 UI 和全部规则完成。所有本轮进程已终止，goal 保持 active。

## 区域状态地图投射与免疫顺序

上一轮为progress。本轮将mapBridge构造combatants/应用防护区域的部分提取为projectDnd5eMapCombatants；原createDnd5eMapCombatSnapshot继续调用该共用路径，然后才启动Headless及计算成对距离/视线。新增projectDnd5eMapAreaStatusEffects只在有occupantModifiers.conditions的地图投射，供MapViewportLayer与MapsWorkspacePage的状态读取使用，不启动回合，不保存临时效果，不构建完整成对战斗快照。

发现并修正计算顺序：区域标准状态必须等职业/效果光环免疫计算之后再应用。其他区域修正先参与防护，新增applyPersistentAreaOccupantConditions在光环之后应用，反魔法状态带suspendedBy。新增勇气光环抵挡区域恐慌测试。

fullbook-area-ui最终95tests/3files passed（session85723 exit0），覆盖既有mapBridge、既有视图标记、临时区域状态、重叠与独立来源，以及新增双类Token进出区域标记、免疫/反魔法、重复渲染不会消耗target-turn-start持续效果且不修改原map/character。第一轮94tests也通过，新增光环顺序调整后重跑95。这是presentation输出测试，尚无新区域标记的真实浏览器截图/跨端验收，不能充当全书完成证明。

全书静态审计重新运行通过，仍20 ready-for-behavior-tests/135 blocked，155源条目；沙墙的新自动稿已被审计发现，但仍有真实几何/放置限制。没有额外AI调用，API累计不变。后续定位：ActivityContracts已有minimumLength/Width/Height，executor支持可变尺寸；地图rect template用height表示二维length（MapInteraction约193），UI也按二维高度调整长度。不能将该字段误当实际三维垂直高度；沙墙可变高度和可见地面点需要核对整个Host路径后再修复/重新转换。
`n最终 typecheck session91232 exit0（fullbook-area-ui-final-types.log）；所有本轮句柄已终止。目标继续 active。

## 区域锚点视线与高度一致性

上一轮为progress。本轮核查完整主施法准备链，发现pluginSpellTransaction仅验证区域锚点效果线，没有执行Activity target.requiresLineOfSight。现逐个anchor检查mapGeometryLineOfSightBlocked，失败返回spell-target-not-visible；不把关闭requiresLineOfEffect当作可无视视觉障碍。测试明确包括requiresLineOfSight=true/false，阻挡视觉但不阻挡效果线的门，以及空锚点（附近有合法受伤目标），并验证拒绝不写回资源/地图。最初即时伤害夹具整区域没有目标而先invalid-target失败；添加附近目标后验证通过，生产逻辑没有放宽目标要求。

另修复两个高度问题：rect的minimumHeightFeet只在未声明lengthFeet的旧二维回退下映射为平面最小长度；显式三维length存在时不把最小垂直高度当成最小平面长度。主施法activityAreaPlacement及instances现在与效果线检查共用spellAreaPointElevation（self保留施法者高度），不再无条件记录actorToken.elevationFeet。MapInteraction返回areaPlacement也复用其已经验证的elevation。测试施法者40尺、锚点5尺，实际提交volume及instance都为5尺。

最终fullbook-area-anchor-final测试129passed/2files（session53358 exit0），此前仅LoS修改时129也通过（62111 exit0）。沙墙未手改自动稿的导出/重新导入/真实区域结算测试再次通过；本轮无AI调用。新生成sand.starmod/hash仅属私有单法术验证，不改1.1.0已验证整包。

范围仍有限：此处只补物理/持续区域视觉遮挡，不等同全部照明/特殊感官/占据区域目盲后的地面点可见性；Activity契约仍缺ground-only放置约束。feature区域准备链另需核查（pluginFeatureAction约518已有正确区域高度，但没有直接requiresLineOfSight分支）。三维高度的用户可选控件与完整Host上下限链仍待补齐，不标记沙墙完整自动化或整书完成。

下一处已定位：pluginFeatureAction 的 activityAreaPlacement（约528–540行）仍把rect template.heightFeet写到Activity.heightFeet且不设置lengthFeet，与主施法已区分二维/三维的路径不一致。后续应针对授予Activity/区域控制入口修复并验收，避免仅主施法正确。point visibility也应形成统一可见性判断而非散落互不一致的分支；当前mapGeometryLineOfSightBlocked提供遮挡，mapGeometryCanSeeToken还有照明/感官逻辑但会扩大目标采样，不能直接把空地点伪装为1格Token而误判可见。

最终类型检查session34692退出0。所有本轮测试/类型进程已终止，goal active；全书静态仍20/135，不宣称整个流程全部完成。

## 授予 Activity 的区域入口修复

上一轮为progress。本轮修复pluginFeatureAction的授予Activity路径：rect模板的二维height映射到Activity.lengthFeet，垂直heightFeet来自Activity契约；显式height也保留给其他形状。点放置逐项执行requiresLineOfSight与默认开启/显式关闭的requiresLineOfEffect检查，拒绝在花费动作或写回状态之前发生。旧无Activity契约的feature模板继续使用旧兼容路径。

进一步发现授予区域的目标筛选调用verticalCombatGeometry时使用二维矩形最大边作为高度。新增可选effectHeightFeet表示Activity声明的box/cylinder垂直范围，rect/cube/cylinder授予入口传入契约height，避免长墙误伤高空对象。现有SRD/无显式高度调用保持原行为。

新增完整测试模块注册Activity与真实Headless action，以活跃Effect授权，验证30×10×5区域放在10尺高度，Headless执行成功；12尺目标入选、30尺目标排除；视觉挡板与效果线挡板分别拒绝，输入character/map/request不被修改。测试初次读取了错误的headlessAction.areaPlacement字段（应为activityAreaPlacement），修正后又暴露夹具缺Headless注册；补正常注册后通过，没有删去结算验证。

最终fullbook-feature-area-final共31tests/2files passed，包括原featureAction及verticalCombatGeometry回归。初轮typecheck24234exit0，最终types仍需读取47055终态。本轮无AI调用、无全书候选改写、无5273/5274写入。

后续核查发现主spellTransaction和通用MapInteraction的obstruction.affectsToken只是射线过滤，不是声明Activity高度的完整体积过滤；executor主要验证dimension上下限、关系/数量，不会替Host重新筛选每个目标的Z。应将同一显式垂直范围筛选扩至这些入口并补双端/导入验证，然后继续ground-only、可见性照明、可变垂直高度控件。不能只凭本轮31项测试宣称所有区域法术自动化完成。全书目标仍active。

最终类型检查47055退出0（fullbook-feature-area-final-types.log）；全部进程已终止。本轮未调用AI，goal active。

## 主法术与通用选择的垂直目标筛选

上一轮为progress。本轮新增共用dnd5eAreaVerticalExtentIntersectsToken并让现有instantAoe显式高度分支复用。spellAreaObstruction接收可选heightFeet，对声明垂直体积的目标先进行高度相交检查，忽略墙壁也不能忽略高度。pluginSpellTransaction及MapInteraction为rect/cube/cylinder传入Activity.heightFeet，授予Activity已有调用共用同一判定。未为sphere等形状擅加圆柱模型；无声明高度的旧兼容调用不改变。

fullbook-area-volume：5files/170tests通过（session45348exit0）。新增障碍辅助函数测试高度10～15时地面/30尺排除、12尺包含、8尺底部但身体相交包含；ignoresWalls两种值相同。新增通用选择测试30尺平面长度与5尺垂直高度区分。新增实际导入的矩形即时伤害模块经Host准备及Headless执行，只将12尺目标HP30→28，地面与30尺均保持30，非仅查看生成配置。

更新后再次运行未手改自动稿沙墙和火焰化身导入行为测试，两者通过；后者session82750exit0。本轮无API调用、无原房间修改；重生成的单法术测试产物仍在本地私有目录。整包1.1.0网络证据未被改写或借用于这些新机制。

最终typecheck进程40256尚需确认终态。后续仍需完整ground-only/可见性/可变垂直尺寸与全书剩余机制，不将170项测试视为全书完成。

最终typecheck40256退出0（fullbook-area-volume-types.log）。所有本轮进程终止，goal保持active。

## 通用地面锚点约束

上一轮为progress。新增Activity area target.placementSurface:'ground'，验证限制为point origin及点体积（rect/cube/circle/sphere/cylinder）；不将line/cone方向起点与落点混用。SDK注明只约束每个锚点落地，不代表整块体积贴合崎岖地形、不代替可见性。

dnd5eAreaPlacementMatchesSurface复用Host地形高度，未声明高度默认地面，非有限/悬空/地下值拒绝。主spellTransaction逐个anchor校验，featureAction校验实际区域落点，MapInteraction通用选择校验默认地面。持久区域提交再次校验areaInstance及instances；ground主实例缺高度时补为实际地形高度，避免回退施法者高度。

新增真实导入的ground矩形伤害法术测试：0尺通过，-5/10尺拒绝且法术位未扣；合法结算正常。新增持续区域handoff拒绝非法高度且原地图不被修改；授予Activity入口空中拒绝/地面接受；高台20尺时省略高度与20尺通过、0/25/NaN拒绝；契约无效surface/self-origin拒绝。第一轮基础172tests通过，扩展测试曾因重复注册Activity夹具失败；先dispose原fixture注册后重跑，最终fullbook-ground-final为181tests/6files通过（session64823exit0）。未删除失败断言或放宽生产规则。

初次typecheck12720 exit1仅测试actor.classResources可能undefined；加明确非空标注后启动最终32134，待确认终态。没有AI调用，没有手改全书自动稿，也没有改原房间。

下一步应利用新ground契约自动重转换沙墙，保留可见性/变尺寸控件真实剩余缺口；不能仅在SDK上写支持就宣称生成配置与玩家UI全部完成。全书仍20 ready静态/135blocked（本轮未重转换，未重新计算为完成项），goal active。

已准备并启动fullbook-sand-ground-repair-20260926自动转换，seed为exact-source未手改sand-occupant稿，新ground反馈，严格1call；session46881日志fullbook-sand-ground-repair.log，尚待结果。不是手改配置。本轮32134终态也尚待确认。

最终typecheck32134退出0。转换46881仍为唯一待确认进程，下一轮必须先轮询同一handle，不得因等待重启或重复API。

终态补充：46881转换退出0，唯一API调用input45734/output2002。新沙墙自动稿实际包含target.placementSurface:ground；preflight仅剩完整可见地表点判断及可变垂直尺寸两类缺口，仍blocked。fullbook-sand-ground-behavior复用真实导出/安装/Activity地图handoff/占据目盲与离开清理测试，通过；额外断言导入后ground字段保留，未改生成稿。产物在fullbook-sand-ground-repair-20260926/sand.starmod及behavior-audit/export-install-audit，未做新真实网络证明。累计API30452418input/1614488output，1108known calls+6unknown。所有本轮进程terminal，无live句柄，goal active。

## 精确点可见性与Host接入

上一轮为progress。mapGeometry新增mapGeometryCanSeePoint，复用照明/感官/射线逻辑但不借用Token的0.4格轮廓余量，不采样周围角点，不把地面目标抬到生物眼高；强制执行规则可见性，即使动态视野UI关闭。点坐标非有限值拒绝。重遮蔽终点按点高度检查；普通/魔法黑暗按不同感官范围判断；可显式传viewerBlinded，盲视可覆盖其范围内感知，震颤感知不当作视觉。

新增activityPointVisibility Host适配，读取迁移后的角色/怪物感官、活动效果和区域投射目盲，保留旧conditions兼容。主spellTransaction、featureAction和MapInteraction共用；浏览器通用区域选择传入当前角色。主法术保留SRD审计的可见性要求，不能只看某个Activity是否漏写requiresLineOfSight。

新增测试：狭窄墙后Token角落可见但精确地面点不可见、低墙挡地面而不挡生物眼高、关闭动态视野仍判黑暗、精确感官边界、目盲/盲视/震颤感知、魔法黑暗与真实视觉、角色效果感官以及区域目盲进出。首次198回归中的旧major-image盲目施放失败，原因是漏读旧conditions与SRD可见性要求，已修复；初次感官夹具使用了未授权的raw character.darkvisionRangeFeet（迁移会重建），改为正常机械Effect声明感官后通过，不放宽生产迁移。

最终测试verified日志为200tests/5files；进程28819需确认terminal。早期typecheck45005通过；中间57655失败是把Dnd5eCharacter当作持久Character读取dnd5eCombatState，已改为linked来源与classState镜像，最终96964待终态。新增SDK解释精确落点判断，不自动推断可见性。尚未重新调用AI转换沙墙。

仍需核查：暂停感官效果（shared vision profile目前未筛suspendedBy）、反魔法与感官来源、世界时钟/临时光源到期。这些不能以本轮基础可见性测试替代。当前点距离沿用地图已有水平感官距离规则，未证明任意三维感官极限。继续按实际缺口完善，不能宣称全书/全部可见性完成。

最终typecheck96964退出0，200项测试进程28819退出0。全部本轮进程terminal，无新API调用。goal保持active，下一轮从暂停/反魔法感官及剩余可变高度核查继续。

## 暂停与反魔法感官修复

上一轮为progress。本轮shared/dnd5e-vision-profile activeEffectsFrom统一过滤suspendedBy非空的效果；覆盖token/character下dnd5eCombatState/classState四种形态，未改自然/静态感官范围。mapBridge.projectDnd5eMapAreaStatusEffects的快速跳过条件扩展到suppressesMagic区域，即使该地图没有区域目盲，也投射反魔法暂停效果供Host可见性和地图显示读取。

fullbook-sense-suppression 80tests/4files通过（12597 exit0），包括darkvision/truesight效果手动暂停、反魔法内失效、离开恢复，原始map/character不被修改，天然黑暗视觉与显式nonmagical效果保留；既有地图/区域/UI标记回归通过。fullbook-sense-extra最终16tests/3files通过，新增四种状态载体suspended效果过滤，原有效视野/隐形/玩家视野测试通过。初轮types23784 exit0；新增共享载体测试后最终types需读取新进程终态。本轮无API。

后续真实缺口：activityPointVisibility未传worldMinute，mapGeometryCanSeePoint/Token中的carriedLight与illuminations会按默认0判断临时光源。权威时间目前在src/store/campaignTime.ts，使用hydratedRoomId保护异步房间切换；规则层不应直接依赖浏览器store。需传入Host时间或提取与该store同步、区分房间且fail-closed的只读时钟快照，再验证过期光源和房间切换。不要把此项当成现有可见性全部完成。可变垂直尺寸仍未完成，下一次沙墙转换不应假装这些约束已实现。goal active。

## 临时光源与房间时钟传递

本轮继续完成了上述时钟缺口，无规则层对浏览器store的反向依赖。browserSceneClock新增readBrowserSceneWorldMinute，只返回hydratedRoomId与当前roomId一致的世界时间；本地使用__local__。MapsWorkspacePage两处Host准备入口和通用区域选择显式传worldMinute，经spell/feature/MapInteraction流入activityPointVisibility。缺少同步时间时有限期光源不能授予视野，永久光源不受影响。

新增时钟房间A/B切换、未加载、本地验证；到期前9分钟可见、10分钟到期不可见、未知时间不可使用限时光源、永久光源仍可见。实际导入法术的Host准备也覆盖该边界，requiresLineOfSight=false不会被不相关照明限制误拒绝。fullbook-point-clock最终115tests/4files通过（3618exit0），先前57679也通过；生产+早期测试types76650exit0，最后新增Host时钟断言后再次运行最终types，待终态。感官测试80与额外16均通过，测试组有重叠，不累计为独立法术数。

本轮无AI调用，原整包与网络证据不变。新的可见性接口已比上一轮完整，但三维感官距离仍沿用既有地图水平规则；不以现在的测试宣称全部空间感官规则已验证。下一步可变垂直尺寸及点距离/感官约束继续推进，完成后再用一次有界API重转换沙墙，避免在已知缺口未补齐前重复付费转换。goal active。

最终typecheck76095退出0（fullbook-point-clock-final-types.log），所有本轮进程terminal。下一处可变高度接入定位sharedCombatTypes.ts约329、WallOfFireTargetingControls约144、spellAreaSpatialTargets约24；areaTargetHeightFeet是平面长度，须独立垂直尺寸字段并贯通UI/请求/Host。goal active。


### 独立垂直高度与沙墙重新自动转换

- 新增模板 volumeHeightFeet/minimumVolumeHeightFeet 和施法请求 areaTargetVolumeHeightFeet。原 areaTargetHeightFeet 仍是平面第二尺寸。矩形/cube/cylinder 的高度独立映射，UI 显示“垂直高度”，Host 校验上下限，预览与 Host 使用同一竖直体积。
- 通用 Activity 地图选择支持 dimensions；触发选择与授予动作的用户控件尚未全部接入，不把这一底层能力宣称为所有入口已完成。
- 6 个测试文件 177 项通过（fullbook-volume-height-tests-final.log）；追加通用选择后重新运行 fullbook-volume-height-regression.log。测试包含伪造高度被 Host 拒绝、选择 5/30 尺影响不同目标、平面格子不变、UI 标签及请求转发。此前新增测试第一次因空先攻列表导致 combatant-missing，修正测试夹具后验证真实 invalid-target 原因。
- 新自动候选 fullbook-sand-volume-repair-20260926，源文本不变，无人工配置修复；1 次 API，45,845 input /1,944 output，通过结构预检。累计已知 30,498,263 input /1,616,432 output，1109 次已知调用、6 次用量未知。
- 沙墙实际导出/安装/Activity 结算/区域落地测试通过：选择 5 尺后持久区域确为 5 尺，15 尺被拒绝；区域内 blinded、离开清理、移动倍率 3 均通过。sand.starmod SHA256 cd27d3d7572f3eb3b832080123ec28617cc93d3acff68f0fc27cf984d1836109。该证据不包含真实玩家施法资源及网络全过程。
- 更新总预检：155 项中 21 ready-for-behavior-tests、134 blocked；不能称全书自动化完成。现有合并 1.1.0 包未被此单项验证覆盖或替换。
- 下一轮继续核查剩余阻塞：一些仍是旧转换不认识新接口；另外有把视觉叙事误列为自动化阻塞的条目，应通过转换语义分类修复，并保留真正的机械行为缺口。

最终补充证据：fullbook-volume-height-regression.log 的 177 项、fullbook-volume-legacy.log 的 213 项全部通过；fullbook-volume-height-complete-types.log 对应 npm run typecheck 已终止，退出码 0（会话 27010）。全部本轮测试与转换进程均已结束。


### 叙事分类与专长独立施法路径核查

- 转换提示明确区分纯外观/动画和有机械后果的光照、感知、对象变化；纯表现保留 description/assumptions，不放入 unsupported。未放宽预检、未删除生成配置中的机械缺口。
- fullbook-narrative-feat-repair-20260926 浓酸球自动转换通过结构检查，并删除原文没有的落点必须可见限制。真实导出重导入后的玩家请求→Host 结算测试覆盖 4–9 环、混合豁免、范围外目标、单次资源、失败目标回合结束才请求并扣固定 5d4，成功目标没有后续伤害；29 项测试通过（含 localContentAiImport.test.ts），不含网络/UI。
- 同批木精灵魔法因机制规划消耗调用额度而触发有界 call-limit，保留原记录；单独 fullbook-wood-feat-repair-20260926 自动修正 castAtLevel1/2，仍标 partial。没有手改配置来通过预检。
- 木精灵魔法行为测试暴露真实接口缺口：构筑授予、长步奔行旧路径的独立次数与长休恢复可运行，但行动无踪 Activity 路径在 prepareDnd5ePluginSpellCast 强制要求职业施法，返回 spell-not-known-or-prepared。private behavior-blocker.json 保存范围及下一步。不能将此候选标为全自动化成功。
- 最终类型检查 fullbook-narrative-types.log 已退出 0（81672）。已知累计 30,609,815 input /1,619,982 output，1113 次已知调用、6 次未知。两次有界转换分别 53,593/1,777 与 57,959/1,773 token。
- 下一步优先补独立施法授权跨 Activity/Headless 事务的接口：Host 核实真实 build/race 授予、指定属性与环级，消费正确免费资源，并测试伪造授权、免费次数耗尽、长休恢复、角色无施法职业的合法施放。全书目标仍未完成。


### Activity 法术独立施法授权与资源事务

- 修复 pluginSpellTransaction 的职业强制要求：请求独立施法时，Host 从角色已登记的 race/build grant 中重建授权，核对精确环级、拒绝混用职业/仪式/其他资源；使用授予属性计算 DC/修正，按法术独立次数消费，at-will 不创建资源。
- plugin-spell-activity 与其外层 adjudicated-spell 事务传递 racialInnate（现有协议名称），Headless 再核实真实 snapshot 授予和次数；反魔法分支同样消费正确的免费次数，不创建法术效果。spell-cast 事件标记 slotConsumed:false。没有把战士伪装成施法职业。
- 325 项测试通过，日志 fullbook-independent-activity-final-tests.log：包含伪造授权、错误环级、混用职业、仪式、次数耗尽、at-will、反魔法及授权移除后的原子回滚。
- 实际生成的 wood.starmod 导出重导入后，木精灵魔法选择德鲁伊戏法、免费施放 longstrider/pass-without-trace、分别消耗次数、没有职业法术位、短休不恢复/长休恢复已通过。SHA256 af701e8e4f968264746fbe571b427af838bf6a307049c0e961b2d421e8073850。未人工改配置，原候选仍 partial；未声称玩家 UI/网络已验证。
- 下一阻塞已查实：PlayerCombatHotbar.tsx descriptors 只枚举 dnd5eEffectiveSpellcastingSources；Dnd5eCombatActionCommand cast-spell 强制 castingClassId，MapsWorkspacePage beginDnd5eSpellCast 的 pluginSpell 分支也直接拒绝缺职业。必须补独立授予法术入口、固定免费环级/剩余次数、传递 racialInnate 至 self-target 与 targeting session，然后做真实玩家 UI/网络验证。
- 本轮没有 API 调用；全书结构统计仍为22 ready/133 blocked，未据后端测试擅自提升候选状态或重写转换结果。

最终类型证据：fullbook-independent-activity-complete-types.log 对应 npm run typecheck 已退出 0（会话4740）；先前 banner 可空职业及测试 snapshot 可空断言错误均已修复。本轮所有进程终止，下一轮可直接继续玩家入口，无需重新转换或重复 API。


### 玩家独立施法快捷栏入口

- 新增 independentSpellHotbarSources：从实际 race/build grants 生成独立按钮，保持固定授予环级、显示独立免费次数、at-will 不显示虚假次数；无职业施法来源的角色也可使用。次数耗尽禁用，授予移除后按钮消失。尚未支持自动结算的条目保留禁用说明，不借此开启叙事结算。
- 新命令 cast-independent-spell 经 MapsWorkspacePage 重新核查授予和环级，再进入现有 spell targeting。自身直接提交、插件范围/生物选取以及旧核心法术 session 均传递 racialInnate；不伪造职业，不弹职业升环选择，不应用已挂起职业施法修正。独立按钮同样遵守禁止施法的形态限制。
- 162 项回归通过（fullbook-independent-ui-tests-complete.log），包括真实 PlayerCombatHotbar 服务端渲染、描述符授权/次数、原有施法 targeting、Host 事务及实际导入包行为。
- 原始生成的木精灵魔法包在 fullbook-wood-ui-behavior.log 通过：实际 build choices 解析后，两个免费法术均生成 available 的独立快捷栏命令，随后 Host 结算消耗与休息恢复通过。证据是渲染/描述符/函数链路，尚非真实浏览器点击→网络端到端。
- 初次测试错误已修正：法术目录必须提供插件集合；CanUseStructuredCastRoute 仅代表部分自动化桥接，完整法术需同时检查 HasFullHeadlessAutomation。没有放宽机械预检，也没有手改转换配置。
- 下一步：使用隔离房间验证真实玩家点击独立按钮、目标选择、DM 接受和免费次数同步（复用 fullbook-room-flight-weapon Playwright 框架，但不能再用 submitPlayerActionFromPage 代替本次点击入口）。检查导入/选择专长后的资源初始化，不能在端到端夹具里靠手动填次数掩盖缺口。现有 5273/5274 房间保持不变。
- 本轮无 API；全书仍 22 项结构 ready /133 blocked。木精灵候选仍 partial，待完整链路证据后用自动转换更新。

最终类型检查 fullbook-independent-ui-complete-types.log 已退出 0（54257）。所有进程终止。资源初始化定位：levelAdvancement.ts:845 以及 store/characters.ts:1488 均调用 syncCharacterClassResources；下轮端到端应使用这些生产入口生成资源，并检查房间持久化，不手动写免费次数。

### 独立施法真实点击与自动配置重新验收

- 原木精灵魔法包的隔离端到端通过（fullbook-room-independent-click.log，86589 退出 0）：DM 上传实际自动生成包，玩家激活，从安装目录读取构筑定义，经生产 applyDnd5eContentBuildChoicesV1、角色 importCharacter/saveSharedNow 初始化次数。点击职业特性中的行动无踪按钮，Host 接受并同步玩家剩余次数 1→0；长步奔行仍 1，没有职业法术位。未手动填写免费次数，未调用 submitPlayerActionFromPage 代替点击。该次包 SHA256 c8459a939bacc1fb44388d0f71b9608dce405c1653952bb5f873b5a6d8da206d。
- 构筑选择通过生产函数调用，未验证真实选专长 UI（buildChoiceUiVerified:false）；自身法术点击也不代表地图落点/其他目标选择全部通过。隔离使用 6773/6774 及随机临时共享目录，未修改用户 5273/5274 房间。
- fullbook-wood-supported-repair-20260926 自动转换尝试失败：AI 生成空 select.options[].grants，校验器拒绝。保留 rejectedDraft 与调用记录，没有放宽校验或手改配置。SDK 指南补充非空来源 tag 的合法表达方式，明确来源标签不授予职业或职业等级。
- fullbook-wood-schema-repair-20260926 重新自动转换通过结构预检。新生成包重新导出、重导入后的法术选择/独立次数/长短休/Host 行为和相关回归共 37 项通过（fullbook-wood-schema-behavior.log，30761 退出 0）。新包再跑真实点击网络端到端通过（fullbook-room-independent-schema.log，16378 退出 0），SHA256 767637d66f20ec07086f5a660bd59d17a45ca14e6a1a81c8e31340eb7ae9121d。没有沿用旧包哈希的网络认证。
- npm run typecheck 已退出 0（98121，fullbook-wood-schema-types.log）；所有本轮进程已终止。两次转换分别 58,007/1,888 和 58,089/1,634 input/output token。累计已知 30,725,911 input /1,623,504 output，1117 次已知调用及 6 次未知；未知费用不按零计算。
- 全书结构预检现为 23 ready-for-behavior-tests /132 blocked；结构通过不等于行为全部通过。155 条目合并包尚未重新发布，不能声称全书完成。
- 后续已定位独立施法授权缺口：诡术师的逃脱术原文明确只能以自己为目标，当前 Dnd5eBuildGrantV1 spell 与 Dnd5eRacialInnateSpellGrant 尚无目标限制字段。需贯通构筑授予、角色快照、玩家入口、旧核心与 Activity Host/Headless 校验，拒绝伪造其他目标且保证事务回滚，然后再进行自动转换。深海赠礼、阴影环绕也应复核真实机制支持后自动重转，不能直接删旧 unsupported。

### 独立授予的自身目标限制与独立特性缺口

- Dnd5eBuildGrantV1 spell 新增 targetRestriction:self，仅限独立施法模式；非法枚举及 known 模式携带此限制会被拒绝。角色 racialRules 快照保留限制。限制属于授予来源，没有修改被引用法术或普通职业施法。
- MapsWorkspacePage 独立授予直接自身施法；核心与 Activity Host 同时检查请求各目标字段及实际解析目标。Headless 再核查目标，包括被篡改的嵌套 Activity，以及反魔法分支。拒绝时输入状态与返回状态均保持原样，不扣次数。没有将客户端声明当作授权。
- fullbook-self-grant.log 124 项通过（28653 退出 0）；fullbook-self-core.log 207 项通过（命令终止退出 0）。包含自身合法施放、单目标/多目标/投射物/envelope 伪造、正常与反魔法下嵌套目标篡改、核心法术结算前目标篡改回滚。尚未对本次新增限制做真实浏览器点击验收。
- fullbook-self-grant-types.log 对应 npm run typecheck 已退出 0（64348）。所有本轮转换及类型测试已终止。
- 有界自动转换 fullbook-independent-invocations-20260926 使用 90,698 input /3,883 output，4 次调用。阴影环绕被拒绝“自动化特性缺少战斗行动”；诡术师的逃脱术仍 partial，指出施法属性与环级上下文不足。保留失败及 rejectedDraft，没有手动改配置、绕过校验或标记认证通过。
- 真实新缺口已查实：pluginApi.ts 的 Dnd5ePluginFeatureDefinition 没有 feats 所有的 advancements，pdfSpellHeadlessPreflight.ts 也只给 feat 的 advancements 计入执行路径。下一步应给独立特性提供真正的已拥有特性→独立法术授予执行路径（含获得/移除、资格、资源及存档/导入），并补安装法术目录与对应职业规则的来源上下文；不能靠 prompt 声称 build-grant 已适用于所有独立特性，也不能为未知属性随意填值。

### 独立特性法术授予、职业资格与实际新包验收

- 增加 features[].spellGrants 固定独立施法协议与严格校验，不伪造 action 或 advancements。Host 从当前已安装、已拥有的特性投射授予；移除特性或卸载包后授权消失。授予进入既有独立施法/组件/次数/休息/自身目标限制路径。Unified Content payload 与 .starmod 往返保留字段。
- classRequirements:[{classId,minimumLevel}] 单独表达指定职业等级资格，不复用 sourceClassId 的子职业归属含义；对总等级足够但指定职业等级不足的多职业角色拒绝授权。此限制在构筑授予特性也会核查，不因 build receipt 跳过。
- PDF 转换附带实际魔能祈唤章节引言，证明等级要求指邪术师等级；不复制相邻特性正文。AI 依赖上下文读取实际 SRD 法术目录的环级及明确提及职业的施法属性，明确这些目录不证明机制已自动化，也不能据法术 classes 推定角色职业。
- fullbook-feature-grants-final.log 6 文件 68 项通过（66367 退出 0）；覆盖协议无效值、实际模块导出重导入、存档恢复、特性与模块移除、等级/职业等级、Host 合法自身施法和伪造目标、次数与休息。初次空数组用例错误是 it.each 展开参数导致 undefined，修正夹具后全部通过。fullbook-feature-grants-types.log 类型检查退出 0（30464）。
- fullbook-feature-spell-grants-20260926 自动转换两项：阴影环绕=warlock15、invisibility2、cha、at-will；诡术师的逃脱术=warlock7、freedom-of-movement4、cha、once-per-long-rest、targetRestriction:self。没有手改生成内容。4 次调用 92,367 input /2,555 output。
- 实际新包行为验证 fullbook-feature-grants-behavior.log 通过：导出安装、两项职业资格、存档、核心隐形术与 Activity 行动自如结算、职业法术位不变、免费次数与长休、移除授权和非法其他目标。包 invocations.starmod SHA256 fae2562d8ede736b723617b5b6002eb6d168f6c34d9f66e371edce43e5680fa3。
- 同一哈希的真实隔离网络测试 fullbook-room-feature-grants.log 通过（93179 退出 0，1 分钟）：DM UI 上传→玩家激活→角色生产导入初始化资源→点击职业特性下行动自如独立按钮→自身提交→Host accepted→玩家次数1→0，职业法术位不变。未调用直接提交请求代替按钮。特性所有权通过角色导入种子设置，未验证真实学习/选择特性 UI；隐形术没有在这次网络测试中点击。5273/5274 原房间不受影响。
- 当前 155 项为25 ready-for-behavior-tests /130 blocked；仍未完成全书。累计已知30,908,976 input /1,629,942 output，1125次已知调用、6次未知。合并全书包尚未更新。所有本轮进程终止，下一轮应继续剩余真实机械缺口（例如深海赠礼的水下呼吸及等同步行的游泳速度），并最终合并新候选与端到端全流程验证。

### 持续水下能力与深海赠礼自动转换

- 增加 staticModifiers.canBreatheWater / swimSpeedEqualsWalking，通过已验证的 character-capability 永久效果投射到角色及 Headless 快照；字段随特性资格撤销，不写成存档中无法清理的临时效果。地图移动预览、玩家/怪物移动和武器水下判定读取有效能力。
- 修复 dnd5eEffectiveOptionalMovementSpeed 重复应用速度倍率：等同步行时读取有效步行速度，与单独计算的原生游泳/攀爬速度取大值，不再把已经减速的步行速度再乘一次倍率。30尺步行减速后对应15尺游泳，不是7尺。
- fullbook-aquatic.log 5文件120项通过（72043退出0），覆盖实际模块往返后的被动能力、移除能力、减速、角色移动及武器/玩家/怪物移动相关回归。最终 fullbook-aquatic-final-types.log 类型检查退出0（57469）；此前17252发现布尔能力类型联合缺项，已补并重新通过。
- fullbook-depths-grant-20260926 是未手工修复的自动转换，2次调用46,110 input /1,429 output，结构通过。实际 depths.starmod 导出重装行为测试通过（fullbook-depths-behavior-final.log）：邪术师5级资格、存档、持续游泳/呼吸能力、对自身及另一个角色施加水下呼吸、独立次数1→0、长休恢复/短休不恢复、职业法术位不变。首次失败是夹具漏将受术者放入 initiativeOrder 导致 combatant-missing，补齐测试房间后通过，未改变生产授权去绕过错误。
- depths.starmod SHA256 351a29a27d02bb2b008c5b98e94fedc0ca03c8b99a1427a9e098c97ee16cb7d7；本次尚未做真实浏览器多目标选择验证，不能沿用其他法术的网络证据。后续可复用 fullbook-room-feature-grants 框架与 e2e/cover-preview.spec.ts 的 map-canvas 实际点击方式，检查目标选择、提交、玩家效果同步。
- 全书结构统计26 ready-for-behavior-tests /129 blocked，目标未完成；累计已知30,955,086 input /1,631,371 output，1127已知调用及6未知。所有本轮进程已终止，现有全书合并包仍待整合新候选并验收。

### 双目标真实点击与全书合并测试包 1.2.0

- fullbook-room-depths.log 通过（74517退出0）：使用实际 depths.starmod，DM 上传→玩家激活→角色生产导入初始化→点击独立水下呼吸按钮→map-canvas 点击施法者与另一角色→确认施放→Host 接受→两角色均出现 activity:water-breathing 效果，免费次数1→0且职业法术位不变。源文件哈希仍351a29a27d02bb2b008c5b98e94fedc0ca03c8b99a1427a9e098c97ee16cb7d7。所有权通过导入种子设置，未证明特性学习UI；无直接提交玩家施法请求替代点击。
- 合并 fullbook-combined-independent-aquatic-20260926/fullbook.starmod，版本1.2.0，包ID local.fullbook-current-audit。按原始155条清单逐项选择确切原文匹配、manualContentRepairs:false 的候选，保留未解决条目及警告；导出和接收端安装通过（37373退出0）。SHA256 9e1036a389395885f8597bdc8d88380b3c15c8a298a520b14644cb047071012d。
- 合并包真实隔离网络测试 fullbook-room-combined-aquatic.log 通过（51105退出0，1.1分钟）：DM 上传整包、玩家激活v1.2.0、真实按钮/双目标/确认施放、Host结算、双方效果和资源同步均通过。该测试只证明合并包加载及水下呼吸这条执行路径，不证明155项全部机制。旧用户房间与旧导出文件未覆盖。
- 本轮无生产代码修改与API调用，不重复类型检查；全书仍26结构ready/129blocked。全部进程终止。
- 下一个真实机制缺口已核实，不能当作过期报告删除：渺远步的移动落点在 dnd5eActivityMapInteraction.ts:396 只用 requiresLineOfSight + mapGeometryLineOfSightBlocked；同文件267行的完整 dnd5eActivityPointVisible 只用于区域模板落点，没有接入移动落点。因此目盲/黑暗/特殊感官限制仍未完成。应增加清晰的可见目的地契约并贯通 move operation、handoff、预览和提交时Host复核；保留仅要求几何视线的既有行为，再自动重转及验证渺远步等受影响条目。

### 可见传送落点与渺远步自动重转

- move operation 增加 requiresVisibleDestination:boolean，仅用于 teleport；保持 requiresLineOfSight 的几何效果线含义。Executor/handoff 保留字段，地图提交按 actor（不是被移动目标）的精确目的地调用 dnd5eActivityPointVisible，包含传入角色、地图区域状态和场景时间。
- dnd5eActivityContinuationTeleportCells 同时用于可见传送候选格：共用实际落点判定并包含距离、占用、遮挡及可见性。主法术和授予Activity两条 MapsWorkspacePage 路径传递允许格、角色及同步时钟；玩家来源请求通过现有 placement 消息让施法者选点。
- fullbook-visible-movement.log 3文件89项通过（23922退出0）：黑暗不可见拒绝、普通几何模式仍可用、15尺黑暗视觉精确边界、目盲后拒绝此前合法落点、15尺盲视允许/10尺拒绝，以及输入地图不被失败提交修改。fullbook-visible-movement-types.log 类型检查退出0（70687）。
- fullbook-farstep-visible-20260926 使用真实旧自动候选与接口反馈重转，结构通过；实际1次有token记录调用41,366 input /1,363 output。首次与持续授予的传送操作均声明 requiresVisibleDestination:true，没有手工补配置。
- fullbook-farstep-visible-behavior.log 实际生成包导出/安装及行为通过：首次扣5环1次、再次不扣、附赠动作、60尺允许/65尺拒绝、占用及墙拒绝、1分钟到期清理；新增黑暗、60尺黑暗视觉、目盲、60尺/55尺盲视边界，持续操作保留同一可见性要求。far-step.starmod SHA256 e5a7c81fa86b47e4dae7c6f1ef785d24272450c3f3948f0dc63451699a6e143d。
- 尚未做本次渺远步真实浏览器选点/再次施法网络验收；尤其应核查异步选点期间角色或地图变化时是否取得最新状态再提交，当前单元验证证明的是传入状态改变后的重检，不能代替真实房间并发证据。
- 全书27结构ready/128blocked，仍未完成。累计已知30,996,452 input /1,632,734 output，1128次已知调用和6次未知。所有本轮进程终止；全书1.2.0合并包尚未包含本轮渺远步新候选。

### 异步选点的状态过期保护

- 新增 activityPlacementAuthority.ts，首次法术及授予 Activity 在准备结算前记录地图、角色、几何与场景时间的值快照；等待选点返回后重新比对 Host 实际状态。发生变化则以 movement-placement-stale 拒绝，不提交旧结算。采用保守的整场景比较，其他角色的无关变化也可能要求重选，尚未缩窄依赖集合。
- fullbook-placement-authority.log：3文件56项通过（58728退出0）。包含等待期间失明、目的地占用、雾区、关门、光照、时间和资源变化；纯函数测试不单独作为房间结算证据。fullbook-placement-authority-types.log 的 npm run typecheck 9135退出0。
- 真实网络测试使用已有自动生成 far-step.starmod，SHA256 e5a7c81fa86b47e4dae7c6f1ef785d24272450c3f3948f0dc63451699a6e143d。DM上传、玩家激活和实际法术按钮，等待远程选点Overlay后经正式角色更新入口添加失明，并确认服务端持久化，再点旧合法格。fullbook-room-farstep-stale-rerun.log 通过（41488退出0，48.3秒）：Host明确拒绝过期选点，5环位仍2，位置仍25，失明保留。
- 首轮73377失败：测试直接setState后保存，没有先确认失明已持久化，收到accepted；该失败保留在 fullbook-room-farstep-stale.log，不能算通过或宣称原实现场景已复现。改用store.update并在服务端验证状态后，未再改生产代码，重跑通过。
- 本轮没有API调用；全书仍27结构ready/128blocked。新守卫尚未覆盖全部地图交互入口，且多个后续异步触发与外部几何副作用的一体化事务仍需继续审查；本轮证据限定于渺远步首次远程落点等待。
- 正常路径对照 fullbook-room-farstep-valid.log 通过（69307退出0，59秒）：同一自动包、实际玩家按钮和远程点格，状态未变化时Host accepted、角色x25→325、5环位2→1。不是仅证明失败分支；法术学习/准备由夹具设置，不能宣称学习UI也已通过。本轮所有测试进程已结束。

### 通用效果绑定临时生命值

- 上一轮为进展：真实选点过期与正常路径已分别通过。本轮重新核查全书阻塞，选择共享的“效果结束清理其临时生命值”能力，未把结构ready作为行为完成。
- temporary-hit-points operation 新增 sourceEffectId（须引用本Activity效果），贯通执行提案、统一Activity直接Headless结算以及兼容编译路径。Host验证对应来源效果已存在，再记录临时生命池的效果定义及施加者。声明顺序必须先apply-effect后授予；错误顺序拒绝。既有原生来源追踪保留。
- 通用效果移除、回合边界到期与探索时间推进会清理该来源剩余临时生命值；复合效果仍有组件时保留池；高值替代池及同值的不绑定替代池不被旧效果删除。SDK与AI转换指南已加入声明方式。
- fullbook-bound-thp-boundary.log：2文件53项通过（6106退出0），包含来源移除、部分损耗后的剩余清理、4点同值替换及12点更高替换、错误操作顺序拒绝、回合到期与探索到期。损耗值在该夹具中直接设为4，不宣称已验证莱维斯图斯之墓的真实伤害反应窗口。
- fullbook-bound-thp-native.log：2项原生临时生命值回归通过、496跳过（16902退出0），不能表述成498项全通过。最终 npm run typecheck 通过（40560退出0，fullbook-bound-thp-verified-types.log）。早期测试漏targetIds和误用expiresAt已修复；早期测试还发现直接Activity路径未绑定来源，补齐后通过。
- 自动重转 fullbook-bound-thp-convert-20260926，原文和配置未手工修改，12733退出0只表示转换任务结束。2次调用59,197 input /2,648 output。rejectedDraft实际包含正确sourceEffectId，但因模型生成非法manifest.contentCategory被拒，且仍报告独立feature缺专属次数资源声明；候选未通过、不可计入ready。后续应补独立feature资源或declarativeAbility的绑定能力，不将该规则冒充feat，也不放宽分类校验。
- 当前全书27结构ready/128blocked不变。累计已知31,055,649 input /1,635,382 output，1130已知调用、6未知。没有覆盖用户房间。本轮所有进程已结束；尚需本次机制真实自动包导出/安装及反应伤害网络验收。

### 独立特性资源声明与自动包往返

- 上一轮为进展：共享临时生命值生命周期完成并经测试，新自动候选明确暴露资源入口缺口。本轮新增独立features.resources，沿用专长资源的id/label/maximum/resetOn/stacking契约，注册时验证、复制并按包命名空间隔离。
- 角色资源目录纳入所有已注册特性的资源定义，isAvailable依当前拥有与资格检查；不能先按拥有过滤掉定义，否则sync会把失去特性的旧池误当未知自定义资源保留。回归实际发现并修复该残留问题。继承、专长派生特性不重复注册专长自己的资源。
- fullbook-feature-resources-final.log：2文件25项通过（17747退出0）；涵盖实际.starmod导出/接收安装后初始化、花费后的序列化不回满、短/长休恢复、等级资格、失去特性。最终类型检查38949退出0（fullbook-feature-resources-final-types.log）。早期夹具漏同步及可选classResources访问已修复。
- fullbook-feature-resources-convert-20260926 自动重转2次调用59,643 input /2,434 output，无手工配置修复，84324退出0。候选正确声明warlock5资格、1次short-rest资源、before-damage反应窗口、消费及sourceEffectId，但仍诚实标记触发伤害之后才开启火焰易伤的时序缺口；不计ready或完整自动化完成。
- fullbook-feature-resources-behavior-final.log 实际自动候选导出/安装与资源生命周期通过（进程退出0）；产物tomb-resource-audit.starmod、resource-behavior-audit.json位于该私有目录。验证首次资源1、消耗1→0、再次消耗拒绝、序列化不回满、休息恢复、资格撤销；未执行完整伤害反应或浏览器网络流程。首次产物写入ArrayBuffer类型失败，修正测试文件输出为Uint8Array后重跑，未更改生成内容。
- 下一处已知关键缺口是before-damage后续效果时序（并需核对原文对失能/速度/易伤的适用顺序）。不能把这些效果提前影响触发伤害后仍宣称完成。全书仍27结构ready/128blocked。累计31,115,292 input /1,637,816 output，1132已知调用及6未知。所有本轮测试进程已终止，没有覆盖现有房间。

### 伤害前触发入口审计：纠正结构误报

- 上一轮为进展（独立特性资源和实际自动包往返通过）。本轮追踪莱维斯图斯之墓的时序问题，发现首要缺口不只是延后启用易伤：dnd5eActivityTriggerWindows 从 damage-applied 仅产生 after-damage，通用before-damage选择与暂停/恢复路径尚未接通。原生damage-mitigation-interrupt专用路径不能当作任意Activity的执行证据。
- 新增真实Headless攻击用例：给被攻击者注册并持有before-damage护盾Activity，火焰攻击结算HP20→14、临时生命值0，已提交事件窗口不包含该护盾。该测试记录现状缺口，不是目标成功用例；将来接通伤害前流程时须替换为真正保护和时序验收。
- pdfSpellHeadlessPreflight 增加before-damage入口阻塞，AI SDK明确不能把after-damage或提前手动激活替代原规则。fullbook-before-damage-preflight-final.log 2文件34项通过（11213退出0），包含结构合法但不可触发的反应被阻塞。首次类型检查11139退出0；最终增量检查另记。
- fullbook-before-damage-consolidated.log 75019退出0，155项原文匹配自动候选全量复查：26 ready-for-behavior-tests /129 blocked。原初守护此前结构ready被撤回，因为其反应无实际伤害前入口；不是已实现功能回退。相关诊断也覆盖先祖守卫、坟墓、救赎、边界行者、咒剑、莱维斯图斯之墓，但不据此否定已有专用原生机制。
- 下一步实现必须提供可验证的伤害提交前事务窗口、Host绑定的待决伤害与骰值、反应/资源恰好一次消耗、拒绝过期请求、恢复原伤害后再启用延后效果，并通过实际攻击/法术伤害及DM玩家验证。仅添加一个效果延迟字段不能解决当前入口缺失。
- 本轮无API调用，累计token不变。原有房间未修改，目标继续；不得以新增阻塞检查冒充before-damage机制完成。
- 最终类型检查 fullbook-before-damage-verified-types.log 87202退出0；此前81147发现新增运行时夹具对readonly数组用了push，已改为创建新数组后重跑。所有本轮进程结束。后续中断应参考Dnd5eActionResult.attackDecoyRollRequirement已有缺输入/原动作重放模式，而非从已扣血事件伪造before-damage。

### 伤害提交检查点基础：真实暂停与放弃重放

- 上一轮为进展：撤回原初守护的结构误报并确证通用伤害前入口缺失。本轮增加damageCommitCheckpoint.ts和damageCommitSession.ts，并在Headless applyDamage扣HP前接入可选同步Host检查点。普通结算未开启会话时行为不变；未接入MapsWorkspacePage选择UI，不宣称通用before-damage已经完成。
- 检查点明确phase=adjusted-damage-before-hit-points：调用applyDamage之前已完成部分类型抗性/易伤计算。因此它不能直接接受新增免疫然后对现有amount再次修正；接受反应后的正确重算与延后效果仍是下一步。
- 会话冻结原始动作（含Host骰值）和源状态。暂停抛出的信号在宽泛骰子catch捕获后仍于Headless最外层重新抛出，避免被误识别成invalid-dice或产生完成观察事件；同步作用域finally清理监听器。待决会话仅支持检查、放弃继续和取消，尚不支持执行被接受的Activity。
- 放弃后重放被冻结的原动作；当前权威状态与基线不一致则拒绝，篡改checkpoint拒绝，已终结会话拒绝重复恢复。调用方仍负责将唯一resolved结果提交到房间；这里没有伪造持久化层的恰好一次承诺。
- fullbook-damage-checkpoint-verified.log：3文件36项通过（51239退出0），包括真实攻击暂停时原HP及行动经济不变、放弃后HP20→14且一次伤害事件、外部改骰不影响原动作、未命中无检查点、过期/篡改回复拒绝、取消后不可恢复、监听器不泄漏、现有减伤与Activity回归。
- 初次测试3失败暴露暂停信号被宽泛catch吞掉，已补最外层重抛；首次类型检查发现erasableSyntaxOnly不允许参数属性，已改显式字段。最终类型检查结果另记。
- 没有AI调用、未改原用户房间，26结构ready/129blocked保持。此基础尚缺：从当前状态发现可用Activity、接受/拒绝选择的Host授权与资源原子结算、类型伤害重算、触发伤害后的延后启用、玩家网络选择与完整法术验收。preflight before-damage阻塞保留。
- 最终 fullbook-damage-checkpoint-final-types.log 类型检查80147退出0；所有本轮测试进程已终止。

### Activity资源引用解析与真实Headless消费

- 上一轮为进展（伤害暂停/放弃会话及36项回归通过）。本轮准备接入伤害反应资格发现时发现真实阻塞：独立feature资源已按packageId命名空间注册，但生成Activity可仍用本地resourceId，先前资源生命周期验证没有覆盖这次消费入口。
- dnd5eUnifiedContentRegistry在统一注册时扫描同包feature/feat payload声明的resources，仅将Activity内对应resourceId引用解析为与registerFeature/registerFeat一致的完整ID；不改原始内容包，不猜测其他包或未声明资源。更新SDK和AI指南允许使用声明过的本地ID。
- independentSpellGrants.test扩展实际模块导出→安装→统一Activity→Headless：检查原包仍保留ward-use，注册贡献为local.test.feature-uses:ward-use；第一次提交生成4临时生命值并将资源1→0，第二次拒绝；即便另一模块同名池有99也不能替付。此前仅资源对象的直接spendClassResource测试不能代替该证据。
- fullbook-resource-reference-generated.log 实际未手工编辑的莱维斯图斯之墓候选再次导出/安装验证通过（进程退出0），确认已注册反应Activity的消费引用准确指向自有资源。仍未执行该包的真实before-damage反应，不移除完整机制阻塞。
- 新夹具最初错误传initiative/id到角色快照函数，已改用initiativeD20与position、在生成战斗体后设置tokenID；没有为测试放宽生产规则。最终测试/类型状态另记。
- 本轮没有API调用，仍26结构ready/129blocked，累计token不变。后续还需检查点的当前状态资格发现、接受反应、伤害重新计算、延后启用和玩家网络入口；本轮资源消费修复是这些入口的前置修复，不宣称原计划已全部接通。

### 扣血前个人反应的实时资格发现

- 前轮最终资源消费测试日志确认2文件25项通过；旧类型检查进程句柄已失效且日志只有tsc标题，不将其单独作为退出0证据。本轮重新执行整体类型检查。
- damageCommitCheckpoint为作用域监听器提供扣血前战斗快照的深复制，damageCommitSession将其交给资格判断。无活动监听器时不复制；监听器不能借此修改结算中的真实对象。
- 新增listDnd5ePersonalDamageCheckpointActivitiesV1：仅发现受伤者自己的self before-damage Activity，检查特性归属/效果授予、根条件、反应可用性和失能、同包准确资源余额；重复资源声明累计计算。无法解析的成本及需要尚未提供的选择不推测。队友拦截、原始攻击上下文和其他成本尚不在此入口支持范围。
- fullbook-checkpoint-discovery-verified.log：3文件37项通过，62605退出0。真实攻击检查点中HP仍20，未选择反应时结算为14；未拥有、资源耗尽（另包99次不可替付）、反应已使用、失能均不提供候选；修改传出的快照不影响真实结算。初次失能夹具直接写派生conditions被引擎重建，改用生产状态效果API后通过。
- 这是资格发现而非接受反应执行。尚未接入地图/网络选择，未重算原始类型伤害，未实现触发伤害后才启用的效果；before-damage预检阻塞保留，26 ready-for-behavior-tests /129 blocked不变，没有新AI调用。
- 最终整体类型检查 fullbook-checkpoint-discovery-final-types.log：56927退出0。前次检查捕获已修复夹具的只读conditions.push错误；最终检查针对修复后内容。37项回归与最终类型检查均完成。

### 个人临时生命值反应的检查点内接受与恢复

- 前轮为进展：资格发现已落地且37项/整体类型检查通过。本轮以当前代码为依据，进一步接通接受选择，而非重述完成状态。
- damageCommitSession.accept核对原始战斗签名、准确checkpoint及Host生成triggerEventId；冻结选择和Host骰值，记录注册Activity签名，重放至原伤害发生处重新核查资格并原子执行。错误选择允许重新选择/放弃；过期状态和已结束会话拒绝。原始输入不被修改。
- 新damageCommitReaction适配器调用统一resolveRegisteredDnd5eActivityInCombatV1，使用实际检查点快照与Host触发上下文，不接受玩家提供HP/资源/触发上下文。当前仅支持个人临时生命值以及无附加机制的生命周期效果；检测到其他战斗状态变化或防御修改则拒绝。applyDamage在原有对象身份上合并已验证反应结果和事件，再继续扣血，不将反应提前应用到命中判断前。
- 测试发现并修复两个缺口：命令必须引用Host触发事件；activation.kind=reaction本身不消费反应。统一注册层对before-damage reaction补齐缺失的action-economy reaction费用，保留显式声明且不改原始导出数据。
- fullbook-checkpoint-accept-final.log：3文件40项通过（44645退出0）。真实攻击20HP、伤害6，接受4临时HP后剩18HP、临时HP0，资源1→0、reaction=false、各一个Activity/伤害/反应消费事件；显式费用与省略费用都验证，无重复扣除；错误施放者、过期revision、错误triggerEventId、结束后重复accept拒绝；抗性效果unsupported且放弃后原伤害6正常结算、资源不消耗。
- 早期失败日志保留：缺触发事件ID、缺反应费用；修复后没有降低断言。最终整体类型检查结果另记。
- 尚未接地图/玩家网络选择；抗性重算、伤害转移、延后启用等仍待接入原始类型伤害阶段。全书preflight before-damage阻塞保持，不能因此将莱维斯图斯之墓等标为通过。没有API调用、没有改用户房间、没有重新打包全书；总体26 ready-for-behavior-tests/129 blocked未提升。
- 最终测试版本整体类型检查 fullbook-checkpoint-accept-complete-types.log：33612退出0；先前47303也退出0，但追加测试后再次确认。下一步原始伤害入口定位：武器攻击先在adjustDnd5eDamageComponents调整类型伤害，再调用applyDamage；必须保留调整前分量，不能从adjusted amount反推或重复应用抗性。

### 原始类型伤害阶段的个人防御反应

- 前轮为进展：个人临时HP反应在真实扣血检查点接受/消费/恢复已验证40项。当前轮检查实际实现后推进到类型防御，而不是反复对已调整值减半。
- damageCommitCheckpoint新增raw-typed-damage-before-defenses阶段；amount表示反应前当前防御下预计承受伤害，原始分量留在权威结算器。已有免疫使预计伤害为0则不询问反应。检查点本身不接受玩家上传原始伤害值。
- 武器attack的伤害分量在整体减伤之后、adjustDnd5eDamageComponents之前开启检查点；通用Activity deal-damage提案、脚本dealDamage也在adjustDamageForTarget之前开启。反应改变目标后由原函数从原始伤害计算一次抗性/免疫/易伤；applyDamage显式跳过这次已访问的检查点，避免二次提示。无活动会话时不做额外防御预测或状态复制。
- 个人反应适配器允许raw阶段的damage-resistance/conditional-damage-resistance/damage-immunity/damage-vulnerability，并支持纯防御效果无需伪造临时HP。adjusted阶段继续拒绝这些修正；其他作用范围/转移/延后效果仍不支持。
- fullbook-raw-damage-checkpoint-verified.log：3文件45项通过（25320退出0）。新增已有免疫不询问、已有火抗6仍只减半到3且只有一条防御事件、纯效果反应、通用Activity连续7火+5冷伤害只改变火部分：抗性后HP12、免疫后HP15、易伤后HP1；反应消费一次。原来的生命值/资源/伪造事件/过期状态/重复提交断言保留。
- 扩展测试首次失败是夹具手工写了错误的距离pair key，已改用生产dnd5eCombatantPairKey，未放宽射程验证。原失败日志保留。脚本dealDamage入口已改代码，但本轮没有新增脚本路径专属行为证据，不据此宣称所有调用路径验收通过。
- 尚未迁移所有SRD/怪物/持续区域/环境伤害路径，尚未接通房间玩家选择与原始Activity会话，伤害转移及触发伤害后的延后启用未完成。before-damage预检总体阻塞保留，26 ready-for-behavior-tests/129 blocked不变；没有新API调用或现有房间写入。
- 最终整体类型检查 fullbook-raw-damage-checkpoint-final-types.log：56423退出0。此前29457也退出0；最终版本含新增类型防御与混合伤害测试。所有本轮已启动检查均已终止。

### 通用Activity施放的伤害暂停/恢复会话

- 上一轮为进展：原始类型伤害检查点及45项回归通过。本轮从实际damageCommitSession只有Dnd5eAction入口这一缺口继续：此前通用Activity测试只是同步检查点内直接返回反应，不能证明施放可等待玩家选择。
- 提取私有泛型createDamageReplaySession，普通攻击保留原API；新增createDnd5eActivityDamageCommitSession接收统一Activity的Host权威输入，冻结原命令、骰值、角色/物品上下文，调用现有resolveRegisteredDnd5eActivityInCombatV1。保留原有bridge结果，不把库存/结算失败伪装成成功。
- 首次保存已注册Activity签名；等待期间内容包卸载/配方改变会拒绝恢复，原因changed-activity。房间调用方仍须核查最新revision和独立库存上下文，并且只发布最终结果，本会话没有假称已完成网络事务。
- fullbook-activity-damage-session-verified.log：3文件45项通过（84832退出0）。将前轮3个混合伤害直接回调测试升级为实际会话：第一段7火暂停→接受防御→第二段5冷暂停→放弃→最终提交；期间原状态完全不变、触发ID不同、主施放资源1→0且只出现一次主Activity/反应Activity事件；提交对象在等待时被改为不存在的actor仍按冻结原命令执行；完成后重复恢复拒绝。补充等待期间卸载内容包后恢复拒绝且不消耗资源。
- 这验证内部通用施放会话，尚非DM/玩家网络UI验收。未重新转换或打包全书，没有API调用，未写用户房间；26 ready-for-behavior-tests/129 blocked不变。下一步仍是其余伤害路径、延后生效机制与真实房间选择/提交。
- 最终整体类型检查 fullbook-activity-damage-session-final-types.log：27469退出0，包含目录变更拒绝新增断言；此前85966也退出0。本轮所有检查已终止。已定位下一步地图接入点：resolveDnd5eHeadlessActionWithAirborneFalls与requestRegisteredDnd5eActivityTriggerChoice/shared choice；目前仅查阅，未接入网络。

### 地图伤害反应共享选择入口接入（网络验收未完成）

- 前轮为进展：通用Activity暂停/恢复45项及类型检查通过。本轮核查MapsWorkspacePage实际调用，复用requestRegisteredDnd5eActivityTriggerChoice与requestSharedChoiceWindow而非另建权限系统。
- 新damageReactionFlow异步Host流程：在实时检查点发现并过滤当前支持的个人反应，生成准确事件引用，等待既有共享确认窗口，复用通用Activity掷骰收集器，由Host提供骰值/检定模式后接受并重放；放弃则继续原伤害。所有路径finally终止会话，限定128检查点，只有最终结果可交给房间提交。
- 现有authoritativeRolls提取公开名rollDnd5eActivityTriggerDiceV1供复用；反应选择增加Host checkRollModes传递，普通Headless会话保留transaction options。没有绕过既有权限/事件校验。
- MapsWorkspacePage.resolveDnd5eHeadlessActionWithAirborneFalls两个最终解析点改用新流程；构建玩家角色对应表、复用现有骰窗/选择窗。等待期间重读完整map/characters/geometry、先攻轮次/顺序/index和worldMinute；确认后与每次掷骰后变化则抛damage-reaction-stale-authority，禁止旧结果覆盖更新。修正before-damage共享选择的phase标记。
- fullbook-damage-reaction-flow.log：4文件49项通过（40717退出0）。新增异步确认测试：确认尚未返回时原状态无变化；接受d6=4后HP20→18、资源1→0和反应消耗；放弃则HP14且资源不耗；确认后/掷骰后权威变化均拒绝且不改输入；transactionId保留。没有把这些回调测试称为真实玩家网络验证。
- 启动6773/6774隔离Far Step原有DM上传/玩家施放回归，仅验证既有房间流程未被地图改动破坏，不作为新反应UI端到端证据。专用反应窗口网络用例和其他伤害路径、延后效果仍需继续；本轮未使用AI API，未写现有5273/5274房间，26/129认证统计不提升。
- 最终整体类型检查 fullbook-damage-reaction-flow-types.log：72658退出0；隔离既有Far Step回归 fullbook-damage-reaction-room-regression.log：45679退出0，1项通过（用例47.7秒）。此网络证据仅覆盖原施放流程，不覆盖新反应选择。所有本轮已启动检查已终止。

### 预处理施放及异步脚本提交入口补齐与三端验收准备

- 前轮为进展：地图直接Headless路径接入共享选择，49项回归及隔离Far Step回归通过。本轮继续真实DM/攻击者/防御者三端验证，未把前轮原有法术回归当作新窗口证据。
- 新建明确syntheticFixture标记的反应模块，通过exportPdfContentModule真实导出starmod，DM上传及两个玩家按版本激活。合成模块只是通信夹具，不属于全书AI转换验收或人工修复书中法术。
- 代码检查发现玩家装备攻击与多数法术走resolveDnd5eFacadeWithAirborneFalls，不经过前轮直接Headless包装。新增createDnd5ePreparedDamageCommitSession及通用异步驱动，使同步prepared facade也能暂停、选择、恢复并返回完整application；冻结原输入并校验目录变化。准备阶段先初始化core catalog，避免自身懒加载被误判为内容变更。
- 伤害预览必须保持无反应副作用：headlessAirborneFallPreviewDepth>0时不访问伤害检查点，防止preview与正式结算各询问一次。damageReactionFlow.test对直接入口与含airborne预览的prepared入口分别验证接受/放弃/确认后过期/骰后过期，单次掷骰与transactionId保留。
- pluginFeatureAction是真正异步入口，不能让全局监听器跨await。新增Host resolveDamageBoundary回调：worker先运行一次并产生capability操作，再在同步提交阶段进入暂停会话；普通脚本特性同步提交同样接入。地图明确标识内部已有该边界的异步facade，不对整个Promise加全局scope。worker回归验证边界回调可等待，预览/恢复仍只执行一次worker。
- 初次类型检查暴露异步特性函数与同步facade签名不兼容，已采用上述内部提交回调解决，而非把Promise当同步返回。75项回归日志fullbook-damage-reaction-facade-verified.log通过（37569退出0），类型检查31102退出0；最后bootstrap修改后再次运行的检查结果另记。
- 网络夹具失败记录保留：首次仅normalizeCharacter未同步资源，已调用syncCharacterClassResources；随后坐标未换算视口及手写武器缺触及，改用map viewport变换和系统DND5E_LONGSWORD，未修改生产距离规则；正式武器流程随后停在攻击者“确认并投掷”，已补正常玩家的命中/伤害确认操作继续测试。尚不能将这些失败说成新反应窗口通过。
- 仍有全部伤害入口迁移、延后效果、原始书中条目自动转换与专属验收待完成。整体26/129统计不提升，无API调用，无5273/5274房间写入。
- bootstrap修复后 fullbook-damage-reaction-facade-complete.log：47282退出0、5文件75项通过；fullbook-damage-reaction-facade-complete-types.log：29798退出0。网络测试当前进一步补齐既有骰窗双方交互：玩家“确认并投掷”后仍需DM“确认”，前次未进行DM操作而停在命中骰，不是反应验证失败的结算证据。

### 三端伤害前反应首次实际通过

- 92029网络用例退出1，最终ACK为invalid-dice；保留失败，未据此修改骰值校验。10176未取得ACK；42119实际ACK accepted、无伤害变化，用例却仍等待第二次骰窗，属于未命中分支与测试假设不符，不能称为同步失败。
- 将合成通信夹具的骰面固定（仅Playwright响应替换DiceBoxRollOverlay模块，保留真实玩家投骰、DM确认、Host校验和房间提交），排除随机未命中/重击导致此专门反应用例无法走到预期分支。生产掷骰逻辑未改。
- fullbook-room-reaction-fixed-dice.log：86202退出0，1项通过（1.4分钟）。DM导入starmod、两玩家激活；攻击者命中及伤害两次投骰、DM两次确认；防御者出现“使用能力”，等待时HP28/资源1；接受后HP28、临时HP29、资源0、反应0，Host ACK accepted且同步完成。证据 fullbook-reaction-transport-audit-20260926.json 明确syntheticFixture/deterministicDice/fullBookCertified:false。
- 临时引擎诊断看到内部旧catch将暂停异常暂映射为invalid-dice，但根事务按已有rethrow机制恢复为玩家选择；此次最终ACK成功，不能把这条内部诊断说成新的失败。已移除诊断，启动干净版本复核，结果后记。
- 导入预检before-damage提示修正为“入口仅部分支持，需逐条验证所有伤害来源/时序/生命周期”，阻止错误声称完全没有入口；保留blocked，26/129统计不变。没有API调用，没有写5273/5274房间。

- 去掉引擎诊断后 fullbook-room-reaction-final.log：99570退出0、1项通过，防御者HP28/临时HP23/资源0/反应0、ACK accepted。发现测试骰值注入仍保留suppliedValues（上次临时HP29，本次23），所以前述“固定骰面”准确含义仅为未提供骰值时的fallback，不能把两次结果当固定数值回归。已继续收紧测试注入为统一固定骰面并断言模块确实被替换，最后结果后记。

- 最终 fullbook-room-reaction-deterministic.log：17119退出0、1项通过（1.7分钟）；模块替换断言实际7次，HP28、临时HP23、资源0、反应0、ACK accepted。进一步限定证据：替换的是骰子展示组件，尚未对Host权威骰账本逐值断言，因此工件标记改为overlayDiceFixture:true/fixedAuthoritativeDiceVerified:false，不声称全链固定18/4；网络反应及一次资源消耗断言确实通过。三次成功均为合成模块通信证据。
- 预检提示对应现有10项回归通过：fullbook-preflight-reaction-message.log，93539退出0；保留before-damage blocked断言。生产改动只涉及此提示文案，本轮未重复整体类型检查；此前prepared/异步提交功能的75项回归及整体类型检查已通过。所有本轮进程终止。
- 下一步：从实际书中反应特性的延后生效机制继续，不把合成ward等同于Tomb of Levistus，也不因个人临时生命成功而放开全部before-damage认证。

### 个人反应效果在触发伤害后生效

- 上一轮属于进展：个人临时生命反应三端网络通过。本轮从实际Tomb of Levistus候选仍缺少延后处罚的阻塞继续，没有人工修复该候选配置或提升全书认证。
- Activity apply-effect新增可选timing:after-triggering-damage，经executor保留到已解析proposal。validation限制reaction + triggered before-damage + actor；新增反例拒绝普通动作、缺触发及非actor目标。AI SDK说明同步介绍立即临时生命/独立延后处罚的写法与验收限制。
- Host反应适配器在同步解析范围收集已解析效果数据；无该收集范围的延后apply-effect拒绝。引擎共用applyDnd5eResolvedActivityEffect负责收集，因此直接Activity提交与脚本编译提交都经过相同边界。最初只接脚本context时测试证实第一段就被易伤，已修正共用入口。
- applyDamage包装每一笔伤害，完成后应用绑定的延后效果；原始伤害路径将延后数据显式传到具体applyDamage调用，避免按目标保存的全局待处理项被嵌套伤害抢先使用。调整后伤害路径使用嵌套调用帧隔离。异常路径不发布最终结果；等待期间原状态不变。
- 生命周期回归暴露原有applyResolvedEffect将反应者作为appliedTurnKey的回合所有者，反应在他人回合触发时错误跳过目标当轮结束。该共用效果入口改为实际currentActorId的回合键；连续伤害后的失能现按目标下回合结束清除。
- fullbook-deferred-damage-verified.log：7文件115项通过，涵盖两段7火伤、立即10临时HP、第一段不受新增易伤、第二段14、最终HP20→9/临时HP0、资源1→0、一次reaction事件及目标下回合结束移除失能。此前失败及修复日志initial/behavior/boundary/expiry保留；类型检查最初仅发现新增测试缺少commit阶段类型收窄，已修复并重跑，最终结果另记。
- 未调用AI，没有重新转换或打包全书，26 ready-for-behavior-tests/129 blocked不变；未写5273/5274房间。下一步为实际来源条目自动再转换及逐项行为验收，不能把该机制测试当作Tomb或全书已认证。

- 最终确认：74600退出0，fullbook-deferred-damage-verified.log为115项通过；14544退出0，fullbook-deferred-damage-final-types.log整体tsc通过。36898早先115项也退出0。当前没有遗留运行检查。

### 实际莱维斯图斯之墓自动重转换及导出后验收

- 上轮为进展：新增延后效果接口115项及tsc通过。本轮复用已授权服务gpt-5.6-luna，使用已核实PDF原文和上一份自动候选做一次有界重转换，未手工改配置。
- fullbook-deferred-feature-convert-20260926/conversion-run.json：两次请求60533输入/2062输出token，manualContentRepairs:false。候选自动生成即时生命周期效果、按邪术师等级×10的绑定临时HP，以及独立timing:after-triggering-damage处罚（火焰易伤/速度0/失能）。AI仍带有旧的“字段缺失”文字及未验收限制，结构预检保持blocked，不能把这些文字当作实际运行证据。
- 真实导出starmod再project/parse/register后的行为测试发现适配器误拦截disposition:debuff；只放行该显示分类字段并补合成回归，不改生成配置。fullbook-deferred-feature-behavior-metadata.log通过：职业5级/资源所有权与短长休恢复、立即50临时HP、首笔7火伤后43、后续7火伤放大到14后29、目标下回合结束临时HP清零/失能移除/速度恢复，之后火伤不再加倍。原始状态在暂停/接受期间不变。
- 独立包 fullbook-deferred-feature-convert-20260926/tomb-resource-audit.starmod SHA256 3dae660f005a379f4ef386e5294e5eeaa055fc7edbf1abf62f6d10e69889d714；resource-behavior-audit.json仍fullFeatureBehaviorVerified:false，当前只证明所测伤害路径。
- fullbook-deferred-feature-regression.log：64416退出0、115项通过。fullbook-deferred-feature-types.log：42017退出0。全书预检10086退出0、纳入新候选，仍26 ready-for-behavior-tests/129 blocked；usage快照更新为已知31175825输入/1639878输出、1134次已知调用，另6次未知用量。
- 真实三端最初测试未点击带描述的“使用能力”按钮：精确可访问名称不匹配，30秒默认decline后普通伤害照常提交。40022/61494诊断证实地图等级warlock5、资源1、reaction可用、supported:true，并在实际伤害检查点发现1个窗口；不是能力未发现。改用已有data-testid shared-plugin-choice-use，删除临时浏览器诊断，最终网络结果后记。未写用户5273/5274房间。

- 最终网络复核 fullbook-room-tomb-final.log：83367退出0，1项通过（1.8分钟），已移除临时诊断。DM真实上传自动生成的独立starmod，两玩家激活；攻击命中/伤害经玩家投骰和DM确认；防御玩家通过shared-plugin-choice-use选择本特性，Host同步HP28、剩余临时HP33、资源0、反应0，ACK accepted。fullbook-tomb-room-audit-20260926.json记录automaticSourceConversion:true/fullBookCertified:false；人物与房间为隔离测试夹具，并非验证了全部车卡/学习UI或全部伤害路径。
- 此三端成功与独立导出后Headless测试共同证明实际PDF条目可自动生成、导出再导入并在玩家反应流程执行；仍不能据此宣称全书完成。现有所有测试进程均已终止，没有覆盖原房间。下一步继续其余伤害入口与剩余条目，且需区分“机制未实现”与“尚未验收”两种报告状态，避免转换模型把测试待办误填为必须手动结算。


### 被动机制转换提示修复与真实子职业导出验收

- 发现生产格式提示仍声称所有 passive 子职能力只能 manual，与校验器已支持 passive-defense / attacks-per-action 冲突。允许列表改为校验器与提示共用，不扩大能力权限；明确机制缺口与独立行为验收待办的区别，仍保留预检与认证门槛。
- localContentAiImport 新增真实 schema 的规范化、包准备回归，自动化被动声明不降级、不删机制。fullbook-passive-guide-tests.log：62项通过；fullbook-passive-guide-types.log：34937退出0，整体tsc通过。
- 对 verified-inventory 中剑舞学院、锻造领域原文进行无人工配置修改的新转换。fullbook-passive-guide-convert-20260926/conversion-run.json：53555退出0，4次有界API调用，127407输入/6015输出token。自动生成剑舞学院6级额外攻击；锻造领域6级重甲AC+1/火焰抗性、17级火焰免疫及穿重甲非魔法武器物理抗性。其他能力的真实缺口仍保留，不能称两子职业整体完成。
- fullbook-passive-guide-behavior-final.log：实际草稿导出starmod、重新解析注册，等级5/6与子职归属控制额外攻击；护甲有无、等级5/6/17、火焰及物理类型、魔法/非魔法攻击组合通过。前两次夹具失败分别是普通职业选择应位于dnd5eClassChoices.classes、伤害防御函数参数应为immunities/resistances；修正夹具而非生产机制或AI配置，保留失败日志。
- 独立包 fullbook-passive-guide-convert-20260926/passive-guide-audit.starmod SHA256 ae1e3b9b79b2f87bb0ad37cbf53854e0f823b8a3ab0133ecac3808212c68e4cb；passive-behavior-audit.json 标记 wholeSubclassVerified:false。无用户房间改动。聚合预检更新后 {'blocked': 129, 'ready-for-behavior-tests': 26}，不能将单项行为通过提升为全书认证。
- 用量快照：已知31303232输入/1645893输出，1138次有用量调用，另6次未知。物品绑定协议检查确认目前weapon-enchantment仅支持持用武器槽，不能据此宣称覆盖锻造祝福的护甲选择、非魔法资格与完整长休/死亡生命周期；这一缺口需后续实现。


### 非魔法武器资格协议与 Host 提交验证

- 前轮是真实进展：被动提示修复、两份自动转换及导出再导入单项行为验证。当前检查确认旧 weapon-enchantment 无非魔法资格限制，不能完整表达锻造祝福等物品机制。
- 新增 requiresNonmagical:true（仅持用武器槽）。Character 投影固有魔法事实；三处 Activity/Headless 快照每次从 classState.activeEffects 重建当前临时魔法绑定，包含零加值附魔。未知事实拒绝。未扩充任意物品/护甲/生命周期权限。
- 新增 dnd5eWeaponBindingEligibility.test.ts：普通/固有魔法/未知属性、临时附魔移除、其他武器及暂停效果、不支持的容器声明；真实注册 Activity 提交首次消费一次资源，第二次拒绝且输入和资源不变。
- 初轮类型检查暴露将效果误从combatant.activeEffects读取，已修正所有三处为真实classState.activeEffects；同时修正测试缺少stacking/position。最初事务夹具只有一名角色会结束战斗，补正常敌方后 fullbook-weapon-eligibility-transaction.log 5项通过。未放宽生产事务校验。fullbook-weapon-eligibility-verified.log此前4文件69项通过，完整最终检查结果另记。
- 本轮无API请求、无用户房间写入、无手工修改自动配置。全书26 ready-for-behavior-tests/129 blocked不变。下一步仍需任意物品/护甲绑定及来源长休或死亡清理，再以真实原文自动转换验证，不能把当前原语当作完整锻造祝福认证。

- 最终检查：fullbook-weapon-eligibility-complete.log 4文件70项通过（f04d92退出0）；fullbook-weapon-eligibility-final-types.log 73617退出0，整体tsc通过。当前无遗留运行检查。


### 当前穿戴护甲绑定与真实库存生命周期

- 上轮有实质进展：非魔法武器资格协议、Host事务及70项回归通过。本轮检查护甲加值原先只能依附角色，新增armor-enchantment闭合修正与Host护甲/库存实例投影。
- Effect保存与严格验证保留armorEnchantment；Host命中判定仅匹配当前穿戴的护甲ID/实例ID，同类加值取最高。clone隔离护甲快照；库存协调扩展为护甲绑定转交、未穿戴暂停、丢弃清理；物品拆分保护、绑定效果来源与自身法术共享排除同步覆盖护甲。
- 第一次真实提交测试发现applyMechanicalEffect字段映射遗漏，效果在提交时丢失绑定字段；已增加显式参数与映射，保留失败日志fullbook-armor-binding-debug.log，没有降低断言。
- fullbook-armor-binding-transfer.log：5文件71项通过，覆盖武器回归、护甲保存重读/不叠加/替换实例/脱甲以及真实inventory mutation转交重穿和丢弃。新增同一Effect最多绑定一个物品校验，避免复合绑定转交歧义；fullbook-armor-binding-final.log：4文件102项通过（包含items及Activity验证/执行回归）。
- 本轮未调用AI或改自动候选配置，未写用户房间。仍缺非魔法护甲资格、任意未穿戴物品选择、来源长休/死亡生命周期及原文自动重转换验收；全书预检26/129不变，未声明任何完整条目新增认证。整体类型检查最终结果后记。

- 44342类型检查退出1：库存协调flatMap新增护甲/武器分支导致TypeScript过窄推断；明确flatMap<Dnd5eActiveEffectInstance>后重跑82853。未改变运行时逻辑。

- 最终整体类型检查 fullbook-armor-binding-complete-types.log：82853退出0。所有本轮检查均已结束；护甲绑定接口和行为验证完成，全书目标继续保持active。


### 非魔法护甲资格及腐蚀交互

- 上轮进展是护甲实例绑定及转交/脱甲/丢弃验证。本轮补armor-enchantment.requiresNonmagical:true、护甲固有magical字段、库存魔法物品优先投影及三处Host快照的当前附魔检查。普通内置护甲明确false；库存魔法身份（含未鉴定类别）不能被装备false覆盖；未知资料拒绝。
- 新增真实Host事务验证首次普通护甲施加、重复附魔拒绝、移除后重新允许；魔法/未知护甲拒绝且原状态不变。投影验证显式魔法护甲与未鉴定库存魔法护甲。
- 现有腐蚀条件同时检查临时护甲绑定，避免附魔后仍被当成非魔法。初次编译发现input.target误写target已修复；新增怪物测试的d20=10因AC+1转为未命中，修改夹具为15确保测试腐蚀路径，不放宽命中或骰值校验。失败日志均保留。
- fullbook-armor-eligibility-complete.log：5文件67项通过。22997类型检查因前述target变量退出1，修复后58915重跑，最终结果后记。无API请求，无用户房间写入。完整锻造祝福仍有任意物品选择、来源长休/死亡生命周期及自动转换验收缺口；26/129统计不变。

- 最终整体类型检查 fullbook-armor-eligibility-final-types.log：58915退出0。所有本轮测试进程均已结束。


### 战斗内来源死亡生命周期

- 上轮是非魔法护甲资格/腐蚀交互的已验证进展。本轮新增闭合breakOn source-dies，接入声明校验、持久化和状态详情标签。
- 成功Headless动作完成时，按source.actorId优先、唯一稳定characterId回溯，移除确定死亡来源在其他持有者上的相应效果；使用正常移除路径和事件。来源缺席/不唯一不猜测死亡。未把0HP当作死亡。
- 初次致命攻击夹具使用玩家默认死亡豁免配置，现有引擎未将其判为即死，故拆为明确不使用死亡豁免的致命攻击与实际玩家第三次death-save失败两条路径，不修改原有死亡规则。两者通过，并验证原输入不变、其他无关效果保留、持有者死亡和来源仅昏迷不清理、Token替换回溯及未知来源保留。
- 17464类型检查退出1指出结果events只读；改为复制后追加生命周期移除事件。fullbook-source-death-final.log重跑通过，83372整体类型检查进行中，结果后记。此前失败日志保留。
- 此次尚未做来源长休及战斗外死亡的跨角色协调，也未调用AI重转换或修改用户房间。全书统计仍26/129，不能以本原语测试宣称锻造祝福或全书完成。

- 最终：fullbook-source-death-final.log 4文件68项通过；fullbook-source-death-final-types.log 83372退出0。当前无遗留运行检查，完整目标保持active。


### 来源长休水位、名册清理及真实锻造领域重转换

- 上轮有真实战斗内来源死亡进展。本轮新增source-long-rest-complete闭合break trigger，Host Character→Combatant→Effect.source传递施放时来源长休水位。null是无历史长休；缺失/负数/NaN拒绝新施加，严格持久化检查拒绝损坏水位。标准状态和机械效果均记录稳定来源角色身份。
- campaignTimeRules新增完整名册协调：来源的新长休或确定死亡触发跨持有者清理；既有长休、持有者休息、未知来源不误删。采用已有依赖效果移除和状态投影，并清理结束来源绑定的临时HP。Store本地长休、同步/异步战役时间协调在休息前后接入，避免名册迭代顺序及旧changed:false隐藏变化。
- fullbook-source-lifecycle-complete.log：5文件50项通过，涵盖Host捕获/拒绝水位、来源休息与持有者休息区分、初次休息、缺失来源、战斗外死亡/昏迷、依赖清理、THP结束、重复协调及真实useCharacterStore.reconcileCampaignTime入口。54172与75955整体tsc退出0；最后追加非法水位guard后完整tsc另跑，结果后记。
- 复用授权gpt-5.6-luna服务对verified-inventory中的锻造领域原文重新转换，最多两次尝试/4请求。fullbook-source-lifecycle-convert-20260926：首次生成神圣打击hostRoll.resource-die引用未声明资源，被校验阻止；第二次仅依据真实校验错误自动修复，通过解析但仍blocked。无人工修改配置。4请求128047输入/5887输出token。
- 最终候选保留锻造祝福和铁匠祝福manual：任意武器/护甲选择及长休完成时使用入口、造物材料/价值/时间/空间条件仍缺完整执行；生命周期提示仍较笼统，不能以AI文字否定已通过的局部行为，也不能据局部原语证明整条能力完成。领域两项法术依赖缺失仍记录。
- 聚合预检91923c退出0，纳入新候选后仍26 ready-for-behavior-tests/129 blocked。用量快照31431279已知输入/1651780输出、1142次有用量调用、另6次未知。未写用户5273/5274房间。下一步优先检查长休事件执行入口和任意库存物品选择，继续真实来源自动转换与导出验收；完整目标保持active。

- 最终完整类型检查 fullbook-source-lifecycle-complete-types.log：78478退出0。自动转换72280/85666、聚合与所有检查均已终止，没有遗留运行任务。

### 库存实例选择与两条 Host 执行路径

- 新增 weaponSlot:inventory-item / armor itemSelection:inventory-item。Activity命令携带持有者、实例ID、库存版本；Host以当前名册校验唯一持有者及目标，不读取客户端物品属性。共享库存投影排除数量为零、毁坏及非武器/护甲物品。
- Character→Combatant装备快照增加Host库存投影，编译后的Headless插件动作校验同样的实例/版本/目标约束；法术事务传递库存版本，地图法术界面提供物品选择按钮。不同模式的未选中Effect不会强制要求库存输入。
- 当前临时附魔按实例识别，包括未装备而暂停的附魔。未装备绑定在Host施加时立即暂停，避免同模板武器加值泄漏；装备该实例后沿用库存协调恢复。穿戴护甲、手持武器及弹药容器旧接口保留。
- 新增真实库存grant→Host绑定→equip→AC行为测试，及注册插件编译执行的武器/护甲测试；验证旧库存版本、未知物品、外部持有者、伪造物品属性、重复附魔、默认跳过分支、输入状态不变。fullbook-inventory-binding-complete.log：5文件121项通过。前一版完整tsc63576及41765退出0，最终helper分支调整后的完整tsc20984结果另记。
- 尚未做真实浏览器按钮与双端同步验收；普通特性面板目前主要读取declarativeAbility选项，仍需统一Activity库存选择。long-rest-complete已有事件声明，但Store长休路径尚未把休息完成生成可消费的能力选择窗口。不能把现有后端接口视为完整锻造祝福或全书成功。
- 本轮没有AI请求、没有修改候选配置、没有触碰用户5273/5274房间。全书预检仍26 ready-for-behavior-tests /129 blocked。继续优先补特性入口和休息事件，再用实际来源重新自动转换并验证导出包；目标保持active。
- 最终 fullbook-inventory-binding-complete-types.log：20984退出0；121项测试34351退出0。当前没有遗留运行检查。

### 普通特性面板与触发确认的库存选择

- 上轮是有效进展。本轮检查实际代码后发现普通特性面板只读旧declarativeAbility选项，触发确认只返回choices。现面板优先读取注册Activity的选项，按目标、所选分支和apply-effect接收者提供具体物品选择，并提交实例/持有者/库存版本。无候选时禁用执行。
- dnd5eActivityInventorySelectionOptions统一候选生成，法术和普通特性共用；选择别人的物品必须绑定在相应目标上，选择actor效果时只提供actor物品。Host仍独立核验。
- trigger confirmation新增inventorySelection；共享选择窗口只让客户端回传候选选项，Host捕获对应实例和版本。TriggerSettlement将选择传入正式命令并携带Host角色名册。使用真实attack→after-damage触发测试，过期库存请求不消耗focus，正确请求消耗一次并绑定实际实例。
- 隔离6783浏览器组件测试feature-inventory-ui：注册合成Activity（非AI/全书条目），点击普通特性面板切换同伴及武器模式，实际提交到注册Headless插件，断言请求/效果实例一致且背包附魔暂停加值。首轮测试夹具缺少外层插件distanceFeet，被Host正确拒绝；补齐夹具中已知5尺距离后通过。fullbook-feature-inventory-browser.log：68903退出0，1项通过。该测试不是DM/玩家网络验收。
- fullbook-feature-trigger-inventory-final.log：28141退出0，4文件56项通过；早先面板相关回归38项通过。fullbook-trigger-inventory-types.log：42947完整tsc退出0（前置73075、99839也退出0）。所有进程已终止。
- SDK与AI指南已说明库存接口及其边界。本轮没有调用AI或人工修改转换候选，未修改用户房间，全书预检没有重新计算，最近证据仍26待行为验证/129阻塞。
- 下一关键步骤：campaignTimeRules/Store成功长休时生成可证明来源、可持久化、可消费一次的rest事件窗口；目前这里只清理效果/恢复资源，并未自动派发Activity触发。需要处理刷新/重试幂等、旧历史不回放、角色归属和库存版本、玩家确认及跨端提交，再对真实原文自动重转换。完整目标保持active。

### 休息记录、Host授权和防重复收据

- 上轮为有效进展，本轮继续补休息链路。成功长休及带权威时间的短休现在由campaignTimeRules记录dnd5eRestActivityWindow。记录受益角色、完成时刻、事件ID及逐包/Activity使用或跳过收据；normalizeCharacter严格读取，损坏记录不作为授权，重放同一次记录不清空已有收据。
- 首次同步旧历史只建立基线；冷却阻止的长休、非受益角色没有新窗口；世界时间离开完成时刻后旧窗口不可用。长休窗口还要求角色lastLongRest水位匹配。记录是Host运行状态，不是内容包可声明数据。
- 新settleDnd5eRestActivityV1从真实Host clock.advances、受益人、角色水位、当前注册版本、能力归属及invocation校验授权，然后经正式Activity命令提交。成功返回效果/资源结果与receiptPatch，跳过只返回receiptPatch；调用方必须在房间事务中合并提交。错误库存版本不消费资源或收据。
- 普通编译插件动作拒绝直接调用长/短休触发能力，不能通过普通payload绕过休息授权。战斗提交无显式补丁时保留当前休息收据，避免旧快照重开已消费能力；显式收据补丁合并完整快照与characterPatches。
- fullbook-rest-window-complete.log：4文件43项通过（含真实Store同步、保存重读、过期/非受益/旧历史、重复与跳过、Host库存效果结算）。fullbook-rest-window-commit.log：18项通过。fullbook-rest-window-preflight.log：12项通过，休息触发在房间调度/提交验收之前仍阻止自动化认证。类型检查首次发现测试中可选resolve未收窄，已加明确检查；38914修复后退出0，最终后续补丁完整检查98517结果另记。
- 尚未接入MapsWorkspace房间休息事件派发和收据/效果原子提交。下一步可复用requestRegisteredDnd5eActivityTriggerChoice与库存选择、createDnd5eMapCombatSnapshot、mergeDnd5eCharacterPatchIntoResult和现有共享事务，但必须把当前时钟版本也纳入提交校验，不能先单独保存receiptPatch。仍需真实DM/玩家确认、重试/刷新及并发提交验收。
- 本轮没有AI请求、没有改写自动转换候选、没有修改用户房间。正在以新休息预检限制重跑现有155项候选聚合；完整目标保持active。
- 最终完整类型检查fullbook-rest-window-closed-types.log：98517退出0。聚合ca99d9退出0，仍26 ready-for-behavior-tests /129 blocked；本轮相关测试合计73项通过（43+18+12），没有遗留运行检查。后续房间原子提交可检查src/lib/playerActionAckPublish.ts及MapsWorkspace的ack snapshots.campaignTime路径，不能把其存在视为休息选择已经接通。

### 休息特性入口、房间提交版本与导入注册

- 本轮继续有效进展。resolvePreparedDnd5ePluginFeatureAction对注册的长/短休Activity使用Host clock和combatRevision走专用settleDnd5eRestActivityV1，成功后把receiptPatch与效果/资源结果同时合并到完整角色和characterPatches。普通编译动作仍拒绝休息触发。使用与decline都防重放；decline仅提交收据，不消耗能力资源或应用效果。
- 普通特性面板读取休息窗口，发送restEventId、选项及库存实例。非战斗期间受控角色可用独立canUseRestActivities入口；DM选择的角色通过明确actorCharacterId提交，避免默认回到当前玩家角色。非区域能力新增“本次不使用”按钮。时间推进、使用或跳过之后按钮关闭；保存刷新不重开。
- MapsWorkspace在请求准备时冻结characters/maps/combat/campaign-time共享版本，结算读Host时钟，把同一时钟加入最终原子提交。sharedApi允许显式expectedRevision，不能因后续读取提高全局水位而替换；ACK发布要求原子提交且不对冻结combat版本自动重基。服务器拒绝任一版本冲突，不能写入半份效果或收据。
- contentPackageV2原来只为active Activity生成独立特性/专长按钮，现允许长/短休Activity注册薄界面入口，法术及其他触发器保持原有分派。已验证序列化→解析→注册→释放及普通编译入口拒绝绕过休息授权。这不是实际XGE自动转换成功的替代证据。
- fullbook-rest-route-complete-final.log：6文件114项通过（含真实特性prepare/resolve、效果/receipt合并、无Host时钟拒绝、时钟过期、已消费/已跳过拒绝、冻结版本ACK、序列化包入口）。fullbook-rest-server-closed.log：26项通过，其中独立HTTP服务器新增时钟版本冲突全体回滚、玩家伪造事务拒绝、Host成功提交后玩家读取receipt与效果。首轮服务器夹具用了不完整Effect被422拒绝；改为真实createDnd5eMechanicalEffect，后续类型检查纠正了测试修饰符acBonus→armorClassBonus，未放宽生产校验。
- fullbook-rest-decline-browser-final.log：59689退出0，3项通过。隔离6783真实Panel→探索态权威上下文→prepare/resolve，验证使用/跳过/刷新与时间推进。首轮探索夹具直接传空initiativeOrder导致combatant-missing；修正为生产dnd5eSpellAuthorityResolutionContext生成探索快照后通过。此浏览器夹具使用局部存储，不是完整DM/玩家网络页面；HTTP事务测试是另外一条独立证据，不能拼称整体端到端通过。
- 完整tsc最初19179退出0；后续新增测试的Character构造和Effect修饰符类型问题均已纠正；99080中间检查退出0，最终55883正在运行，完成结果另记。没有AI请求、没有人工修复自动转换候选、没有修改用户5273/5274房间。155项聚合本轮未重算，最近26待行为验证/129阻塞仍不能作为认证数量。
- 下一步：真实导出模块的DM/玩家页面端到端、子职与同一特性多个Activity的休息入口、自动休息提示/事件调度、区域休息能力及复杂骰子/手动边界。当前合成独立特性不代表锻造领域已自动完成；预检继续保留房间事件调度限制，目标保持active。

- 最终完整类型检查fullbook-rest-route-closed-types.log：55883退出0。休息预检回归fullbook-rest-route-preflight-final.log：12项通过。最终相关验证合计155项（114+26+3+12），没有遗留运行检查；没有全书成功认证或新增AI费用。

### 同一特性的多 Activity 导入与选择

- 上轮是有效进展。本轮核实contentPackageV2的find只注册每个feature/feat第一项Activity。现新增集合查询，注册全部可投影的主动/休息Activity；已有legacy主action仍保留，额外原生Activity也可注册。法术主施放入口未被改成任意触发器。
- 新dnd5eFeatureActivityControls只读取所属包，以原feature或feat的legacySource绑定列出已注册、无authorityBinding、可执行的主动/休息控制。保留默认action的原始中断等元数据，避免薄适配器覆盖既有行为。子职暂不走此helper；不能认为子职已完成。
- Panel增加能力选择，仍以原featureId进行归属校验，payload.selectedActivityId指定当前能力。prepareDnd5ePluginFeatureAction从Host注册表重新选择action；未知ID、别的特性、攻击后触发器不可选择。Headless引擎同样支持所属能力，而非只接受默认actionId；仍检查actor拥有原特性，目标、行动消耗、中断均读取所选能力。区域选择会保留选定能力/选项/休息事件payload，区域结算还未独立验收。
- contentPackageV2新增序列化导入→注册全部→探索态prepare/resolve行为测试：第一项free治疗1，第二项action治疗2，实际选第二项HP5→7且动作消耗；无归属、未知、其他特性、事件触发均拒绝，并直接测试Headless伪造其他特性的actionId拒绝。模块释放后第二项注册清除。初次执行失败揭示引擎默认actionId限制，已修复，没有改窄测试来绕过该问题。
- fullbook-multi-activity-closed.log：5文件63项通过。fullbook-multi-activity-browser-final.log：7163退出0，4项通过，隔离6783真实Panel选择第二个休息能力，独立收据与第一个能力共存，刷新仍不可重复；其他使用/跳过/时间推进回归通过。浏览器夹具为合成规则加局部存储，不是实际XGE导出包的DM/玩家网络验收。
- 初始完整tsc73009退出0；最终14854运行结果另记，之后若有代码修订会补最终检查。没有AI调用，没有人工修改XGE转换候选，没有写用户房间。仍需子职native Activity入口、区域复杂流程及真实模块双端验证。全书预检仍保留阻塞，本轮未重算155候选；完整目标保持active。
- 最终候选查询改为只读所属包的统一Activity目录，避免每个特性渲染时复制所有包。fullbook-multi-activity-final.log：63项仍通过。14854完整tsc退出0，最终helper调整后1657完整tsc运行中。7163浏览器4项已退出0。
- 已定位下一步具体入口：contentPackageV2只在尾部调用registerDeclarativeSubclass；pluginApi.registerDeclarativeSubclass为每项能力创建decl.{subclass}.{ability}动作和{package}:{subclass}.{ability}特性。Unified Content的子职来源却使用legacySource.kind=subclass-ability、id={subclass}:{ability}。dnd5eActivityEntitlements目前仅直接比较source.id候选，须核对原角色子职、等级及能力资格后做正确身份映射，不能仅换字符串放宽权限。面板现有feature.action.trigger筛选也会隐藏休息子职能力；额外native Activity注册及原生/legacy主action元数据优先级需一起验证。

- 最终完整类型检查fullbook-multi-activity-closed-types.log：1657退出0。当前没有遗留运行检查；本轮最终63项回归+4项浏览器通过。完整全书目标保持active，不能将合成规则验证计为XGE条目自动转换认证。

### 子职原生 Activity 的注册、身份与操作入口

- 上轮为有效进展。本轮修复subclass-ability来源{本包子职}:{能力}与运行时特性{package}:{子职}.{能力}身份差异。dnd5eRegisteredSubclassActivityFeature通过已注册元数据精确对应，拒绝未知/歧义来源；Host复核对应职业等级（不能用总等级替代）、所选子职、实际featureIds、子职选项，给定Character时还复核其资格。活动效果明确授予的Activity保留原授权语义。
- contentPackageV2注册每个子职能力绑定的原生主动/休息Activity，dnd5eFeatureActivityControls提供多能力入口。面板允许显示有可执行子Activity的能力，即使原父条目仍标manual；只对选定Activity使用其full/assisted能力，不把整子职改成完成。没有注册/归属的ID不能调用。
- 选择原生Activity后prepare和Headless使用其自己的action与骰子定义，避免继承旧declarativeAbility骰子计划。根要求读取真正选择的注册Activity。原子休息结算按原子职资格授权，效果和receipt一起提交，重复调用拒绝。
- 新测试真实registerDeclarativeSubclass→Character迁移→Combatant授权，覆盖不同标点、错误包、未知能力、无拥有、职业等级不足、NaN等级、不同子职和模块卸载。内容包测试覆盖JSON序列化/解析/注册、父能力full和manual两种状态、探索prepare→Host休息结算、HP5→9、无旧骰子及收据防重放。初次低等级夹具只改总level而保留fighter3，被正确允许；已改为真实fighter2检验拒绝。
- fullbook-native-subclass-closed.log：6文件132项通过。22092与84278前置完整tsc退出0；最终57039结果另记。浏览器合成序列化子职包夹具subclass-rest-harness初轮发现父manual隐藏可执行子Activity，已修复；其中HMR重新注册错误来自测试期间源文件变化，不是持久房间复现。复制的旧测试假定默认选bless，而注册目录默认recovery，现明确选择和刷新后重选目标能力，仍断言同一能力不能重复。37994最终浏览器复测运行中。
- 此轮没有调用AI、没有改写XGE转换候选、没有修改5273/5274用户房间。最近全书候选仍26待行为验证/129阻塞，不能把本轮合成子职验证算作完整锻造领域成功。下一步是实际DM/玩家网络页面、完整导出再导入及来源重转换；复杂区域/确认/骰子边界仍需逐项验收。目标保持active。
- 浏览器诊断进一步发现armor-enchantment虽已有Host执行、库存绑定和装备行为验证，但pluginMechanicsRegistry漏注册，内容包contentActivityHasExecutableAutomation将其判assisted且无manual操作，故未编译按钮。该遗漏已补齐，并增加覆盖测试。不能仅依据合成直接注册的旧测试声称真实导入也接通。
- 最终fullbook-subclass-rest-browser-closed.log：38444退出0，4项通过。真实序列化子职包→注册→Panel具体护甲选择→Host休息结算→保存/刷新；两个Activity独立receipt，使用/跳过/时间过期回归通过。首两轮浏览器失败已保留日志；第二轮仍缺selector的根因是护甲handler遗漏，而不只是默认排序，前文初步诊断以此为准。
- fullbook-native-subclass-complete.log：7文件135项通过。最终56908完整tsc运行结果另记（57039中间版本退出0）。额外AST只读审计effect-registry-audit.json扫描Dnd5eEffectModifierV1的69个顶层变体，全部识别、当前missing=[]；该审计只证明声明覆盖，没有把69种效果都认证为端到端完整。正在重算既有155候选聚合，不做AI请求。

- 最终完整类型检查fullbook-native-subclass-complete-types.log：56908退出0。全书重预检d4ec3d退出0，计数为 {"blocked":129,"ready-for-behavior-tests":26}。当前没有遗留运行检查，保持完整目标active。

### 转换器对子职原生 Activity 的路径选择

- 本轮首先修订原生子职与休息窗口指引。fullbook-native-rest-convert 自动两次尝试仍生成空 activities，将已实现的物品绑定/休息窗口判为 manual；不能视为成功。调用 4 次，输入133384、输出5714 token，原始请求和响应保存在私有本地目录，manualContentRepairs=false。
- 进一步发现 SDK 的旧句“不要把子职能力直接放进 activities”与原生 Activity 路径说明存在歧义。现区分 DeclarativeSubclassAbility 对象与合法 Activity 的类型，子职目标指引明确先检查旧 mechanic 和通用 Activity 两条路径。增加虚构、类型检查的休息护甲 Activity 示例；按原文出现休息机制附在指引末尾，并说明择一效果须用一个 Activity 的 choices，不能拆成各有一次收据的多项能力。
- 新例通过真实 prepareDnd5eLocalContentJson → 包注册 → 子职控制查询，确认不只是可序列化文本。fullbook-native-example-convert 只做一次原始来源转换（2个调用），无人工改生成配置，实际生成锻造祝福的护甲/武器 choices、库存绑定、来源死亡/下次长休清理。输入68734、输出4098 token。仍声明武器类别限制及铁匠祝福制作、部分法术依赖未支持；没有全子职认证。
- 核查实体装备契约 weapon.category 只有 simple/martial；库存快照再明确拒绝保存的未知类别，天生武器/徒手攻击档案不成为库存候选。转换指引说明“简易或军用”无需虚构新字段，但不推断仅简易、仅近战等更窄筛选均支持。首次类别测试修改已注册SRD实例被规范化恢复，符合Host权威模板行为；改用未注册保留模板验证异常旧快照拒绝，最终38项通过。未手工抹掉自动候选的原unsupported说明，须后续重新转换检验。
- 自动候选原样导出 entry-0.starmod，并独立重新解析/安装通过；私有目录 fullbook-native-example-convert-20260926/export-install-audit.json 保留报告。roundTripVerified=true；sourceCoverageVerified=false、behaviorVerified=false。这只是锻造领域单项验证包，不是全书或玩家网络验收。
- fullbook-native-example-final-tests.log：3文件38项通过。fullbook-native-example-export.log 与 fullbook-native-example-preflight.log 各1项通过。中间完整类型检查83897退出0；最终32475另记。全书聚合仍26待行为验证/129阻塞，不能把提示词修订算作已重转换所有资料。
- 更新累计已知AI使用为31633397输入、1661592输出token，1148个有usage调用，6个未知usage调用不能按0计。未操作5273/5274用户房间。完整目标保持active；下一步仍需实际模块DM/玩家休息入口、确定性制作机制、源文重新转换与逐项行为覆盖。
- 最终完整类型检查fullbook-native-example-final-types.log：32475退出0。新增实际自动导出包的DM/玩家休息流程浏览器验证正在隔离6773/6774运行；其结果另记，不能将启动当作通过。

### 自动生成子职包的真实双端休息结算

- fullbook-room-native-rest.spec.ts 使用原样自动生成、导出并重装的 entry-0.starmod，在隔离6773/6774服务创建新房间。测试角色构筑和初始链甲为固定夹具，能力配置不是人工修复。真实DM上传、玩家激活、DM界面完成8小时长休、玩家关闭恢复结果并在职业特性页进入技能栏、选择护甲并提交。
- 初始测试导航及夹具错误均保留日志：侧边栏默认收起、技能栏入口位于职业特性页、恢复结果弹窗、非战士子职必须置于dnd5eClassChoices.classes.cleric。此前临时判断“探索态更多动作禁用阻止入口”不成立，该按钮实际扣除战斗动作，未改动其行为。
- 第六次运行实际进入Host结算，服务器拒绝invalid-active-effect。shared-server-core仍使用旧breakOn白名单，漏掉makes-weapon-attack、source-dies、source-long-rest-complete。现新增shared/active-effect-break-triggers.mjs作为前后端共用运行时名单，activeEffects类型来自相应声明。HTTP事务测试验证这些触发可持久化、未知值422拒绝且不写角色状态；时钟冲突和玩家越权拒绝仍通过。
- 协议修复后真实网络提交200，但trace显示效果已写入、休息receipts仍为空。定位rebaseDnd5ePluginFeatureApplication返回重建计划时丢弃characterPatches/tokenPatches；最终mergeDnd5eCombatCharacterResult因没有显式patch而保护旧休息窗口，覆盖新收据。现保留已验证实体的显式补丁。新增rebase→真实commit adapter→merge行为回归验证收据和HP同时保留、原角色未被提前修改。
- fullbook-rest-break-protocol-final-tests.log：4文件84项通过；fullbook-rest-receipt-rebase-tests.log：2文件42项通过；中间64973完整类型检查退出0，最终41030另记。
- fullbook-room-native-rest-receipt-fixed.log：26445退出0，1项真实浏览器测试通过，56.8秒。私有fullbook-native-rest-room-audit-20260926.json记录四步通过及errors=[]：模块上传与玩家激活、真实DM长休窗口、玩家请求后Host效果及收据、刷新不能重复使用。没有绕过Host直接写最终结果，没有修改自动生成配置，没有改用户5273/5274房间。
- 本次仅认证该候选护甲分支的双端使用及防重放，不认证完整锻造领域、武器分支、任意短休/区域/跨持有者生命周期或全书。预检说明更新为已验证具体链路、其他条目仍需独立行为验收，保持阻塞门槛。全书聚合最近仍26待行为验证/129阻塞；目标active。
- 最终完整类型检查fullbook-rest-network-final-types.log：41030退出0；休息预检文字与阻塞回归fullbook-rest-network-preflight-tests.log退出0。当前没有遗留检查进程，完整目标仍保持active。
# 目标属性门槛与原文再转换验证

- 增加 creature/area 目标的 minimumAbilityScores、maximumAbilityScores。六项属性整数 0–30、非空对象、上下界校验；Host 筛选不合格目标，跳过检定及效果而保留正常资源消耗。客户端投骰配方及 Maps 两处目标快照补充 abilities，Headless 使用真实 combatant 数据，不采信请求属性。
- 触发投骰路径在任何骰值请求前校验目标事实；缺失/非有限属性返回 unsupported 诊断，避免异步抛出导致整个触发链中断。该条件不自动继承到另一个持续区域 Activity。
- fullbook-ability-filter-final-tests.log：3 文件 53 项通过。真实 prepare→序列化→重新解析→注册→Headless 测试验证伪造属性无效、智力边界、免疫目标不受伤、合法目标扣血及资源；提交前 Host 属性改变而缺少对应骰值时拒绝且不扣资源。初始测试骰值对象及资源夹具错误已修正，没有放宽生产权限校验。
- fullbook-ability-filter-trigger-tests.log：2 文件 26 项通过（含现有 ActivityCombatE2e）。新增区域触发投骰验证上下边界、超界排除及未知属性在投骰前返回诊断；不等同实际地图区域双端验收。最终完整类型检查 fullbook-ability-filter-trigger-types.log：20586 退出 0。
- fullbook-ability-filter-convert-20260926 使用核实清单中的突触静止原文，一次调用、无人工配置修补。模型 gpt-5.6-luna，输入 46615、输出 2011 token；转换器实际生成 minimumAbilityScores.int=3，保留每次攻击/属性检定/专注豁免重新掷 d6 扣值为 unsupported。不能将目标筛选修复称为该法术完全自动化。
- 原候选原样导出 entry-0.starmod，独立重新解析和注册通过（fullbook-ability-filter-export.log），保留未支持说明。全书聚合重新计算仍为 26 待行为验证、129 阻塞；导出通过不等于全书或该法术行为认证。
- 累计已知 AI 使用 31680012 输入、1663603 输出 token，1149 个有 usage 调用，另 6 个未知 usage 调用。未覆盖用户房间。目标保持 active；下一项共用缺口是每次检定动态骰值修正，已有可选一次性 bonus die 和反应 post-d20-adjustment 不能直接冒充强制持续惩罚。
# 持续动态骰值修正的底层契约

- 新增 rollDiceModifiers 内部效果字段，声明 count/sides/direction/appliesTo；区分攻击、属性检定、普通豁免、专注豁免。普通 saving-throw 覆盖专注豁免，显式 concentration-save 不影响其他体质豁免，两种范围重叠仅结算一次。不复用会消耗的一次性 optionalBonusDie 或反应型 post-d20-adjustment。
- shared/roll-dice-modifiers.mjs 提供服务器与客户端共同校验，拒绝空列表、非法骰型/数量、重复或未知范围和额外字段。ActiveEffect 创建、克隆、规范化及严格验证保留未投掷的声明；没有施法时提前掷骰，也没有缓存惩罚数值。
- rollDiceModifiers.ts 根据 Host 当前效果生成逐次检定的骰子清单。键包含调用方提供的事件标识、受影响生物、检定类型、效果实例/应用时间及骰子声明；结算重建清单并验证全部面值。缺骰、多骰、旧事件骰值、移除/抑制后的骰值和修改声明后的旧骰值均拒绝。多个独立效果按符号求和，返回审计信息，不修改或消耗持续效果。事件标识必须由后续 Host 调用链提供；该纯函数自身不是网络重放收据。
- fullbook-roll-dice-persistence-tests.log：3 文件 93 项通过。包括多次检定重新投骰、普通/专注范围、加减叠加、畸形持久化、真实隔离 HTTP 状态事务写入和玩家读取；非法更新 422、原数据与 revision 不变。首次 it.each 空数组被展开成 undefined 的测试夹具已改为命名参数，未改变生产校验。中间完整类型检查 4289 退出 0；最终 fullbook-roll-dice-persistence-types.log 77073 退出 0。
- 尚未接入正式攻击、检定、豁免 UI/Host 全路径，未暴露给 AI 作者指南、未把任何原文候选改为 full。下一步应接入实际事务事件标识与骰值审计、核心及 Activity 两套检定入口、玩家骰子请求，再从原文重新转换验证。现有 Headless resolveGeneralAbilityCheck、resolveSavingThrowWithClassReroll 和 9 处 rules.resolveAttack 调用，以及 ActivityExecutor 的独立检查路径，必须逐项覆盖，不能只改一个伤害预览或事后改日志总值。
- 本轮没有 AI 调用、没有改用户 5273/5274 房间。全书目标仍 active，聚合检查沿用最近 26 待行为测试/129 阻塞，底层字段新增不改变认证数量。
# 动态骰值接入核心 Headless 检定

- 新增同步 rollDiceTransaction 作用域。以 Host CombatTransaction.id 和生物/检定类型/次数生成事件标识，嵌套动作共享同一骰值账本；每项骰值必须被实际检定消费。成功前发现多余骰值则拒绝整个动作；异常后 finally 清理上下文，不能污染下一笔请求。
- Dnd5eAction.effectRollDice 接收逐次骰值；Host 从当前效果重新生成声明，不能使用客户端总修正值。真实账本记录效果、骰型、面值、方向和受影响角色。核心武器、法术、怪物、反击、徒手等 9 处 resolveAttack 调用接入同一修正函数；普通属性检定 resolveGeneralAbilityCheck 和共用 resolveSavingThrowWithClassReroll 接入。专注入口显式区分普通豁免，天然 20/1 命中规则保持原有判定。
- 不是完整 UI 或 Activity 接入。独立 ActivityExecutor 检定、对抗/特殊属性检定、独立区域结算入口和 Host 投骰准备仍需逐路径补齐；当前没有在 AI 指南暴露新 modifier，也没有认证突触静止已完整自动化。调用方必须保留同一个 Host 事务 ID；旧事务骰值会被拒绝，不能让客户端自行决定效果修正。
- rollDiceHeadless 测试验证实际攻击总值与命中、天然 20、检定/专注失败、账本记录、持续效果不消耗、缺骰/多骰/旧事务拒绝和作用域清理。疾风连击用两个独立骰，第一击命中而第二击失败；第二个骰缺失会回滚第一击 HP、气与附赠动作。最初给未命中第二击附带伤害骰导致既有校验拒绝，已修正夹具为不掷该伤害，未放宽生产规则。
- fullbook-roll-dice-headless-final-tests.log：5 文件 41 项通过。首次类型检查 24313 发现可选基础修正值及怪物触发攻击分支应使用 owner 两处问题，均修正。fullbook-roll-dice-core-regression.log：3 文件 307 项通过，覆盖原有核心战斗、怪物触发与新增行为；最终类型检查 fullbook-roll-dice-headless-final-types.log 52082 退出 0。
- 本轮未调用 AI、未覆盖用户房间，未重算或提升全书认证数。目标继续 active，后续需补齐实际投骰准备、Activity 结算与双端使用后，再重转原文检验。
# 动态骰值接入导入 Activity

- EffectModifier 新增闭合声明 `{kind:'roll-dice',dice:{count,sides,direction,appliesTo}}`。复用持久化层校验，单效果最多16项；编译为未投掷的 ActiveEffect.rollDiceModifiers，不在施法时固定面值。新类型加入执行能力登记，但尚未加入 AI 提示词，也不提升任何全书条目的行为认证。
- 补齐 ActivityExecutor、独立 CombatAuthority、HeadlessCompiler 与核心桥接的 Host 效果快照；只从当前 combatant 复制有动态骰值的效果实例，保留抑制和应用时间。初次真实导入测试发现 applyDnd5eMechanicalStatusEffect 的显式字段清单丢掉 rollDiceModifiers，现已补齐输入与输出字段。
- Activity 攻击、属性/技能、普通豁免、专注检查、对抗双方的修正进入各自总值和成功判定；自动成功/自愿失败的豁免不消费动态骰值。独立注册 Activity 权威入口使用 commandId 建立同步事务作用域，接受独立 authoritativeEffectRollDice 并返回 rollDiceAudit，未从客户端目标属性读取修正。
- 新 dnd5eActivityRollDice.test.ts 使用真实 prepare→JSON往返→注册→施加效果→后续检定，分别覆盖常规 plugin Headless 与独立 Activity authority，两条路径均验证攻击、属性、豁免、专注及对抗结果；缺少骰值拒绝。对抗双方独立骰值，不复用施法者骰值。测试是虚构条目，不冒充原文自动转换。
- 调试过程中修复一处新增上限校验被补丁误放到 validateTarget 的位置；夹具 duration 改用协议 expiresAt，目标检定使用 compiler 要求的 per-target scope 和对应骰值键。临时诊断输出及重复 probe 已删除。未通过放宽注册或骰值校验让测试通过。
- fullbook-roll-dice-activity-final-tests.log：4文件121项通过（新增5种检定，既有 Executor、CombatE2e、HeadlessAuthorityBridge）。中间完整类型检查70063退出0；最终 fullbook-roll-dice-activity-final-types.log 98396退出0。
- 仍待处理：Activity 预览和条件骰配方会调用同一检查函数，必须确保不推进正式消费次数；多目标与重复子活动的事件键需稳定一致。玩家/Host投骰准备、独立区域和特殊核心属性检定、实际双端执行与原文重转换未完成。不能以目前121项测试声明所有检定入口或突触静止完全自动化。本轮无AI调用、未操作用户5273/5274房间，目标保持active。
# 动态骰值预览与按需准备

- Activity 骰值键加入 activity/check/目标角色槽位，同一事务下不同目标不依赖预览顺序；同一 Activity 重复执行仍按槽位次数使用新骰。核心 Headless 的既有次数键保持不变。公开预览函数和条件攻击成功键计算使用复制的作用域，不推进正式次数、不记录审计或消费；条件骰配方计入当前持续效果惩罚。
- effectDicePreview 仅供预览，正式 resolver 不读取它来授权骰值。测试验证反复以反向目标顺序预览、条件命中集合与正式结果一致、审计只产生两项、同一活动第二次执行产生另两项不同键；只提供预览上下文不能执行正式 Activity。
- 新 captureDnd5eMissingEffectDice 捕获同步试算缺少的真实骰子声明，不替换数值。prepareDnd5eEffectRollDice 在固定 Host 快照/事务身份下重试纯 resolver，逐次请求实际缺骰，保留已投骰并设置请求上限；缺乏有效声明、用户取消、骰值非法和达到上限均终止。它不提交状态；调用方仍需最终 revision 校验和原子提交，尚未接入 Maps 的完整请求流程。
- 实际 Headless 测试验证检定需要一次补骰、疾风连击需两次独立补骰且前一次不会重复掷；缺第二骰时前一击和资源仍回滚；取消/非法骰/不存在角色不修改原状态，旧事务骰值不能用于新事务。初始预览测试把能力操作名 damage 与执行提案 deal-damage 混淆，已修正断言，未改变生产结算。
- UI 预览适配器在尚未拿到必需动态骰值时返回无预览，避免错误成功标签或回调抛出；拿到 effectDicePreview 后可按完整修正计算。此保护不是实际玩家投骰已接通的证明。
- fullbook-roll-dice-prepare-final-tests.log：5文件46项通过。fullbook-roll-dice-preview-ui-tests.log：3文件18项通过，验证展示保护及底层路径。中间完整类型检查26276、75532退出0；最终 fullbook-roll-dice-preview-ui-final-types.log：3124退出0。本轮无AI调用，未操作用户房间；尚需 Maps 端事务身份、骰子请求、准备与提交，以及原文重转换和实际双端验收。目标保持active。

### Maps Activity mandatory effect dice integration

- Added `activityEffectDiceRecipes` to map each declared d20 to the same Activity check slot, source/target and transaction identity used by Host. Attack, ability, skill, concentration, ordinary save and both sides of opposed checks are supported for the first execution of an Activity. Automatic immunity/willing/allied saves do not request unused dice.
- Maps spell and granted-feature handlers request effect dice before d20 presentation, retain results under the shared action ID, and pass them into previews and final settlement. Spell conditional damage planning uses the adjusted attack result. Spell facade and feature facade now preserve `effectRollDice`; the rest-feature authority forwards it as `authoritativeEffectRollDice`. Existing transaction identities were verified: spell uses prepared transaction/action ID, plugin feature uses its transactionId.
- `fullbook-effect-dice-map-tests.log`: 4 files / 23 tests passed, including UI-generated recipes through actual imported Activity authorities and immune/willing/allied exclusions. `fullbook-effect-dice-facade-final-tests.log`: 2 files / 131 tests passed; added a spell save changed from success to failure by d6 and granted Telekinesis follow-up with mandatory opposed-check penalty. Both reject missing effect dice and accept the same action-bound UI recipe.
- Initial full typecheck session72464 exited0. Final typecheck is tracked separately; do not interpret intermediate logs as completion.
- This is not yet browser/network acceptance. Generic weapon/monster/check/concentration UI paths, repeated child executions and trigger/reaction paths still require integration and testing. Feature conditional damage sequencing also requires review. No AI reconversion this round, no source candidate upgraded to full automation, no changes to user5273/5274 rooms. Fullbook goal remains active.
- Final typecheck54993 exited0; an additional complete-tree typecheck was started after the final follow-up feature test edit (session14485, fullbook-effect-dice-map-complete-types.log).
- Next integration points inspected: Maps ability-check route25271+, abilityCheckAction.ts preview/resolve currently allocate implicit transaction IDs and lack effect dice; settleDnd5eCombatResult.ts concentration path601+ likewise requires a stable event identity before interrupt/preview and final commit. Monster/equipment/class-feature attack facades have independent previews and conditional damage, so a late blind dice append would be incorrect.
- Complete-tree typecheck14485 exited0 after all edits. This round total targeted acceptance: 23 UI/Activity/kernel tests plus131 facade/module tests. No live processes from these checks remain.

### General ability-check entry point

- `abilityCheckAction.ts` now uses the shared request ID for both preview and settlement, and exposes Host-owned per-check effect recipes. Maps collects these dice before the d20/optional-bonus interrupt sequence and supplies the same values to both previews and final commit. This includes skill/tool/total-only requests routed through this facade; values are not baked into persistent effects.
- `fullbook-ability-dice-tests.log`: 2 files /20 tests passed. New integration test verifies repeated previews agree with final failed check, missing dice reject without consuming action, the valid failed check consumes its requested action, next-request replay and removed-effect dice reject.
- Follow-up investigation: `settleDnd5eCombatResult.ts` concentration checks call a separate saving-throw interrupt pipeline that computes preview and optional-bonus totals directly. Both that pipeline and the later Headless action must receive the same validated modifier/transaction identity; collecting dice only at commit is insufficient. This path remains unimplemented this round.
- No AI calls or user-room changes. Goal remains active; fullbook coverage unchanged. Complete typecheck tracked in fullbook-ability-dice-types.log session27352.
- Complete typecheck27352 exited0. No live validation processes remain for this round.

### Concentration follow-up dynamic dice

- `settleDnd5eCombatResult.ts` collects mandatory concentration dice before the saving-throw interrupt pipeline. Occurrence identity is derived from the parent transaction (or a fresh Host UUID for an untransactioned authority result), concentration event index and target. The same ID/dice are supplied to Headless final settlement, including airborne-fall replay.
- `dnd5eRollInterruptPipeline.ts` accepts a Host-validated effect modifier for both d20 preview and running totals used by optional bonus/reroll offers. Persistent effects still contain declarations, never pre-rolled modifiers. This new optional parameter does not independently authorize Headless settlement.
- Successful concentration child ledgers are merged into the returned parent result with occurrence-prefixed entry IDs; repeated d20 records no longer collide. Failed concentration settlement now throws instead of silently continuing and publishing an unsettled result.
- `fullbook-concentration-dice-final-tests.log`: 3 files /29 tests passed. New end-to-end settlement test checks effect-before-d20 ordering, independent1/6 penalties, preview and optional-bonus totals14/9, concentration loss on second event, independent d20/effect audit records, and invalid-face rejection with unchanged input state. Initial20tests also passed.
- This does not certify all saving throw pathways, generic attacks or browser/network behavior. No AI calls, source-package upgrades or user5273/5274 room modifications. Fullbook goal remains active. Typecheck15611 is tracked until terminal completion.
- Follow-up fix discovered during inspection: airborne support preview ran Headless without the original transaction identity, causing dynamic dice to fail only when elevated creatures were present. `previewDnd5eUnsupportedAirborneFalls` now accepts transaction options; the generic airborne facade and concentration settlement forward them, deriving preview identity from an existing transaction when present. Preview still produces no audit/commit.
- Added Fly test variant: d20=15 minus6 fails DC10, then requests3d6 fall damage and settles descent. `fullbook-concentration-fall-dice-tests.log`:3files30passed. `fullbook-concentration-facade-regression.log`:2files117passed. Additional airborne facade regression logged separately. Intermediate typechecks15611 and30249 exited0; final37727 remains tracked through completion after the fall fix.
- Final full typecheck37727 exited0. Airborne facade regression2passed; this round final targeted suites total149tests. No live validation processes remain. Next work: equipment/monster attack previews and conditional damage need mandatory dice before d20, and generic/triggered ordinary saves still need end-to-end collection.

### Equipment weapon attack dynamic dice

- Equipment attack facade exposes Host-owned attack effect context and accepts request-bound `effectRollDice`. Final settlement and airborne preview use the prepared shared request ID, preserving a supplied transaction when present.
- Maps ordinary weapon route collects attack effect dice before the d20 and passes them through live preview, post-roll hit/optional-bonus planning and facade settlement. Tranquility-blocked attacks collect no unused attack dice. Existing natural20 and critical rules remain intact.
- `fullbook-weapon-dice-tests.log`:2files57passed. New actual preparation/facade test checks formerly successful attack becomes a miss after6 penalty, preview and final totals agree, natural20 remains critical, missing dice reject, target HP remains unchanged on miss and prior-request dice reject.
- Remaining: monster/multiattack uses a separate preview and partial/composite settlement path; occurrence indices must correspond to actually executed attacks rather than blindly reusing UI indices. Native spell/class-feature/reaction and other ordinary save routes still need integration. No AI calls or user-room edits. Fullbook goal remains active. Typecheck65355 is tracked until terminal.
- Full typecheck65355 exited0 after all production/test edits. No live validation processes remain for this round.

### Monster multiattack effect dice

- Monster facade now accepts an explicit Host transaction ID and effect dice; airborne preview shares that ID. Each preview selects only the recipe for its actual attack occurrence from the aggregate submitted dice.
- DM monster route allocates one Host execution UUID and retains effect dice through staged-prefix and final settlement. Actual rolled attacks advance the occurrence; skipped/dead/out-of-range branches and Tranquility-blocked attacks do not request attack dice. Player wild-shape monster route uses the shared player request ID and the same counter/preview mechanism.
- `fullbook-monster-dice-final-tests.log`:2files57passed. New brown-bear fixture verifies independent6/1 penalties, reverse/repeated preview order, staged first attack and complete two-attack settlement, first miss/second hit, two audit entries, missing-second rejection and stale transaction rejection. Initial fixture assumed displayed AC16; corrected to derive boundary from authoritative prepared AC (character equipment recalculation changes AC).
- Complex composite children that themselves make attacks, reaction attacks interleaved with the same actor, and effects added/removed during a multiattack require dedicated verification; this is not blanket certification of all monster mechanisms. Actual browser/network remains outstanding. No AI calls or user-room changes. Fullbook goal active. Typecheck99418 tracked to completion.
- Full typechecks99418 and final89251 exited0. `fullbook-monster-dice-shape-regression.log`:2files8passed (existing wild-shape/composite regression, not dynamic composite certification). This round65targeted tests passed. No live validation processes remain.

### Monster continuation and effect expiry evidence

- Normal staged monster attacks now retain the authoritative effect state returned by each successful prefix settlement. Subsequent mandatory-dice collection and preview use that state, while final replay still starts from the original transaction snapshot. This prevents requesting a second die for an effect removed by the first weapon attack.
- `fullbook-monster-effect-lifecycle-tests.log` and `fullbook-monster-continuation-dice-tests.log`: targeted monster suite passed. Added one-shot effect variant verifies only first attack requests its penalty, next preview uses cleared effects, final audit contains one penalty and extra expired-effect dice reject.
- Added actual map/character continuation variant: first action settles1attack with its own dice, a new preparation uses the persisted continuation receipt and spent action economy, second request gets fresh occurrence0 under a new transaction ID, old first-request dice reject. Full same-request replay uses occurrences0/1. This verifies the distinction between sequence index and transaction occurrence.
- Remaining lifecycle caveat: branches that cannot stage a prefix (complex/composite/on-hit mechanics), and wild-shape whole-action loops still need authoritative intermediate-effect projection; the staged ordinary monster fix is not evidence for those branches. No AI conversion or user-room modifications. Fullbook goal remains active; typecheck97156 tracked to completion.
- Final monster continuation suite50passed. Full typecheck97156 exited0 after all edits. No live validation processes remain for this round.

### Wild-shape intermediate effect projection

- The player wild-shape monster attack loop now replays each completed attack prefix in Host when the actor has dynamic dice effects. The replay is pure: no map application/persistence occurs. Subsequent effect collection/preview reads the replayed effect state; final settlement still replays the original action atomically. Invalid prefix resolution rejects instead of using stale effects.
- `fullbook-shape-effect-prefix-tests.log`:2files54passed (monster prefix/lifecycle/continuation tests plus wild-shape regressions). This is underlying resolver and regression evidence, not a browser test of the new branch.
- Inspection confirmed a remaining composite ordering gap: Maps currently collects weapon rolls first and constructs area/spell/special children afterward (around18740+), while Host executes child order. Correct arbitrary effect changes and same-actor child attack occurrences require ordered child preparation and authoritative prefix projection, not just more dice fields. Pending falls/reaction/trigger effects also require their own ordered acceptance.
- No AI calls, no user-room modifications. Fullbook goal remains active. Full typecheck10355 tracked until terminal.
- Full typecheck10355 exited0 after all edits. No live validation processes remain for this round.

### Host-only composite prefix preview

- Added `previewDnd5eMonsterCompositePrefix`: synchronous speculative execution using the same composite child validation and ordered Host settlement, bound to a caller-supplied transaction ID. It returns a preview-specific result without a transaction/application. The partial-step allowance is private scoped state, restored in finally; ordinary Headless submission still requires the full declared sequence. Existing airborne preview scope suppresses transaction creation and damage checkpoint side effects during speculation.
- Prefix validation checks each supplied child against its required position, including normal skip/resource/target constraints. Prefix results preserve parent action availability while showing settled child state and events; full commit retains normal resource consumption.
- `fullbook-composite-prefix-final-tests.log`:3files61passed. New dragon test verifies Frightful Presence affects target before weapon preparation, one-shot dynamic effect disappears after first weapon, repeated source stays unchanged, bad child order fails, preview returns no transaction, partial ordinary commit rejects, and complete commit executes3attacks. Initial test corrected optional empty effect array expectation from false to falsy; production behavior unchanged.
- This is a Host foundation, not yet a Maps ordered-preparation implementation. Maps still needs extraction of its weapon preparation callback and sequential child preparation using these snapshots. No AI calls or user-room modifications. Fullbook goal active. Typecheck73461 tracked until terminal.
- Full typecheck73461 exited0. No live validation processes remain for this round.

### Ordered composite UI preparation

- Extracted existing monster weapon preparation into an async occurrence callback; extracted each composite child preparation into an async child callback. AST-guided edit converted only continues owned by the extracted outer loops (2weapon/10child); nested loop/function control flow remained intact. Ordinary noncomposite attacks still call occurrences in their original loop order.
- Composite preparation now calls the weapon callback at its declared child position, rather than collecting all weapon rolls before area/special children. After each prepared child, Host prefix preview validates and produces the state used for the next child's effect dice, target combatant checks, reaction calculations and resource checks. Prefix states are speculative and final replay retains the original source snapshot.
- Weapon rolls are stored by prepared occurrence index so skipped children do not shift subsequent rolls. Moved after-hit mechanic preparation after the child sequence so it sees actual hit results.
- `fullbook-ordered-composite-ui-tests.log`:3files61passed (underlying Host composite/prefix and monster facade regressions). This is not browser acceptance of the extracted callbacks. Intermediate typecheck52824 exited0; final5021 tracked after state/index/ordering edits.
- Remaining: prepared target AC/roll-mode and map geometry/positions still have cached preparation fields; arbitrary movement/effect changes from earlier children need refreshed planning, and ordinary save dynamic dice in area/special children need UI collection. Full network/UI acceptance remains required. No AI calls or user-room modifications. Goal remains active.
- Final full typecheck5021 exited0 after all extraction, state and indexing edits. No live validation processes remain for this round.

### Composite preparation spatial and combat refresh

- Added pure map/character projection from a cloned speculative Host state. Added per-occurrence re-preparation via the existing single-child monster preparation rules; updates target AC, roll mode, distance, affected tokens, Bless/Bane and size damage flags while preserving parent sequence/resource identity for final replay.
- Ordered composite weapon callbacks use refreshed preparation; nonweapon callbacks use projected actor/target positions and current state. Actual chosen target and prepared mode remain attached to each weapon roll instead of being overwritten from the old parent snapshot. Dead prior targets retain the existing skip handling.
- `fullbook-composite-refresh-tests.log`:3files61passed. Added assertions for target AC+3, actor restrained disadvantage, preserved sequence index, updated map position, moved target rejected as out of reach, and unchanged source state. Existing composite/prefix/monster tests also passed. Browser acceptance remains outstanding.
- Remaining: ordinary save effect-dice collection inside composite area/special children and ordered pending reactions/falls need explicit acceptance; newly invalid range currently rejects rather than offering a fresh destination/retarget choice. No AI calls or user-room changes. Fullbook goal active. Typecheck64469 tracked to terminal.
- Full typechecks64469 and final71321 exited0. No live validation processes remain for this round. Located existing e2e/monster-catalog-verification.spec.ts and private6973/6974 controller as reference for a new current-code isolated composite UI scenario; do not run it against user rooms or assume old snapshot fixtures prove current behavior.

### Authenticated composite DM/player browser acceptance

- Added `.codex-logs/fullbook-composite-room.spec.ts` with fresh isolated shared root, strict ports6773/6774, actual room creation/join and character membership. Seeds only encounter data; UI performs target selection, player save dice, DM confirmations and full composite settlement. User5273/5274 remain untouched.
- Earlier local-bypass attempt could not route player dice; authenticated setup resolved this. Fixture-only issues corrected: CAS retries, no unauthorized queue seeding, public-page campaign navigation, and origin guard for localStorage on about:blank. These failures were not presented as production settlement bugs.
- Found and fixed the separate composite `saving-throw-condition` UI path marking both normal/advantage d20 as ability-check; it now uses saving-throw ownership/presentation. The dragon browser scenario exercises the area-save branch, so it is not specific browser certification of this special-condition branch.
- `fullbook-composite-room-final.log`:1 browser test passed, no page errors. Actual recorded sequence: Frightful Presence WIS9 vsDC16 failed; frightened applied; bite/claw/claw dealt28+14+13, authoritativeHP220→165; player UI displayed165. All four children completed, no skips. Private audit: `fullbook-composite-room-audit-20260926.json` under local-import-tests. SeedHP200 is distinguished from normalized encounterHP220; audit initialHP corrected from its authoritative damage ledger. Future fixture reads initial map HP before action.
- `fullbook-composite-room-regression.log`:3files61tests passed. Typecheck23006 tracked until terminal. This adds authenticated browser proof for one composite; dynamic save dice, other special children and fullbook raw conversion are not certified. No AI calls. Goal remains active.
- Full typecheck23006 exited0. No live validation processes remain for this round. Browser audit records the exact tested run; the later fixture-only initialHP capture change has not been rerun.

### Composite dynamic saving-throw dice and conversion contract

- `rollDiceTransaction` now exposes capture of successful root occurrence counts, including checks without effect dice. Speculative previews copy counters; nested actions share the root; failed resolutions do not expose a successful ledger. Composite prefix results return these counts so UI indices follow actual Host execution rather than child/target click indices.
- Maps composite area saves and saving-throw-condition children collect mandatory effect pools with the root transaction identity, use the actual target's current effects and include their modifier in save previews. Prefix replay refreshes per-target save and actor attack counters. Special condition children also submit Bless/Bane dice rather than omitting them.
- Actual browser run uncovered a separate event/log error: final total included effect dice but several save events still exposed the pre-resolution modifier. All direct `d20:save.roll.d20, modifier` event emissions now use `save.roll.modifier`; regression asserts16-6=10.
- AI SDK guide includes the imported effect-dice type and authoring rules for independent per-check dice, scope/concentration semantics and avoiding a single fixed roll at cast time. This is conversion support, not blanket runtime certification. No AI calls this round.
- `fullbook-composite-save-dice-final-tests.log`:6files80passed. Added no-effect/preview/nested/slot/failed-root occurrence tests, plus real dragon prefixes and final commit with target penalty, missing/wrong occurrence rejection and immutable source. `fullbook-composite-save-dice-final-typecheck.log`: full typecheck4560 exited0 (earlier55233 also exited0).
- `fullbook-composite-save-dice-final-browser.log`:1 authenticated DM/player test passed. Player supplied independent d6 penalty; WIS d20 3 minus1=2 failed; all Frightful Presence/bite/claw/claw children completed;HP220→169; player UI confirmed169, zero page errors. Private evidence `fullbook-composite-room-save-dice-audit-20260926.json`. Prior failed run had completed correctly but exposed the log inconsistency; it was fixed rather than weakening the assertion.
- Fullbook remains incomplete. Next: fresh raw-source Synaptic Static conversion with the new guide, no manual draft edits; then its own module import/runtime behavior certification. Other ordinary/reaction/native save entry points, interleaved triggers and special composite branches still require coverage; this browser scenario proves the area-save composite path. No user-room changes. No live validation handles remain.

### Fresh Synaptic Static conversion, unbounded areas and source checks

- Reused authorized gpt-5.6-luna through saved config; no credential values printed or changed. Five calls across `fullbook-save-dice-convert-20260926` (2) and `fullbook-concentration-scope-convert-20260926` (3), with saved requests/responses/reports and finite retries. This round238,411input +7,763output tokens. Updated known goal total31,918,423input/1,671,366output,1154known calls,6unknown-usage calls unchanged.
- First raw conversion refused to invent a maximum target count for “every creature”. Area Activity maximumTargets is now optional, meaning all eligible occupants. Validation, executor, scaling, map selection, feature normalization/selection and spell Host/UI capacity retain this meaning; explicit limits and choose-one=1 remain enforced. Unlimited audited areas override legacy projectile metadata. Added300-occupant map/executor tests; existing finite limits still reject excess. `fullbook-unbounded-area-final-tests.log`:237passed; initial test corrected proposal kind from damage to deal-damage (not a runtime defect).
- Second conversion passed structural gates but applied penalty to ordinary saving throws. Preserved raw output and negative source-behavior audit; updated generic guide to distinguish concentration-only scope. Next fresh conversion omitted INT<=2 immunity. Added conservative source constraint checks for explicit Chinese spell-wide ability immunity clauses; checks reject omitted/weakened/stronger boundaries without rewriting drafts. They deliberately do not claim general semantic certification.
- Automatic feedback restored immunity but chose a self-referential effect-source DC before the effect exists; actual facade rejected invalid-dice. Added Activity validation for this creation-time cycle, allowing a genuinely existing actor-effect requirement for followups. Guide explains initial actor-spell-save-dc and stored repeat DC. Final automatic retry passed; no contentJson edits made manually.
- `.codex-logs/fullbook-synaptic-behavior.test.ts` exports the generated raw draft to an actual .starmod archive, reads it back through StarMod projection/package parser, registers it, prepares a player spell through Host facade and executes it. Verified failed/successful saves take16/8 psychic damage with8d6 faces2, INT2 rat and outside occupant untouched, one slot consumed, penalty only on failed-save target, independent attack/check/concentration penalties, ordinary save excluded and end-turn INT success removes effect. This is not live-room UI certification or a complete duration-expiry test.
- Private artifact: `fullbook-concentration-scope-convert-20260926/generated-synaptic.starmod`; SHA256 b0719b3447e582d708ad8cece0d0a4e269da757d6d79e9078ec88df84a82babd. `generated-behavior.json` records exact verified scope. `fullbook-synaptic-behavior-final.log`:1passed. Source/validation/AI guide regressions57passed. Earlier typechecks98562,95791,74209 exited0; final74360 tracked until terminal.
- Consolidated preflight now checks source constraints and known single-entry negative source audits instead of counting a known wrong artifact as ready. Current155entry snapshot:27ready-for-behavior-tests/128blocked, behavior certification remains separate. Synaptic's only ready run is the final concentration-scope run. Fullbook goal active; no user-room changes. Next: actual DM upload/player learning-casting of this exported module and remaining runtime/fullbook gaps.
- Final full typecheck74360 exited0. All conversion, behavior and validation processes for this round are terminal; no live handles remain.

### Generated Synaptic module: actual room import and player casting

- Added isolated browser acceptance in `.codex-logs/fullbook-synaptic-room.spec.ts` with fresh storage, ports6773/6774 and authenticated room membership. DM uploads the exact generated .starmod, player receives the required version, learns it through the spellbook UI and prepares it. No spell is directly granted by the fixture.
- First attempt exposed fixture timing: cast was clicked while DM authority was loading. Second attempt exited on the temporary404 for the readiness resource. The test now treats that absent resource as not ready and waits for matching combat authority before casting; no production changes were needed.
- `fullbook-synaptic-room-ready2.log`:1passed. Player casts through map placement/dice UI; Host applies damage and generated effect to the target while INT2 rat is immune. Private audit preserves exact artifact hash and room evidence. This is one spell's actual-room acceptance, not fullbook certification.
- Added original-source duration acceptance to `.codex-logs/fullbook-synaptic-behavior.test.ts`: ten consecutive failed target end-turn saves retain the generated effect for nine turns and remove it on the tenth. `fullbook-synaptic-expiry-final.log`:1passed; exported `generated-behavior.json` now records tenFailedTurnExpiry.
- Strengthened browser test also checks exactly one5th-level slot consumed and both DM/player actual map stores have the Host HP/effects. Final run58267 is tracked until terminal. No AI calls or user-room edits this round; fullbook goal remains active.
- Final strengthened browser run58267 exited0:1passed in1.7m. Both real client stores matched Host HP and generated effects, INT2 immunity held, and the5th-level resource decreased exactly once. All handles in this round are terminal. Next work continues with blocked source mechanics and remaining generic save/reaction routes; current27/155 structural readiness is not whole-book automation.
- Exact-file rerun73114 exited0 (fullbook-synaptic-room-exact-artifact.log:1passed). Archive export embeds changing metadata, so the preceding behavior re-export changed hashes while room tests used an earlier export. Final rerun performed no export and matches generated-behavior.json SHA25635f327f6f55b27cacb033b32742207467d8288b25cd9aee7b44709884c8f5c6b. This exact archive is preserved under private verified-artifacts/<hash>.starmod. Both client stores, resource consumption, source behavior and duration tests now refer to that artifact. No live handles remain.

### Automatic source verification for concentration-only penalties

- Previous goal turn classified as progress: exact generated archive room casting and duration expiry gained terminal evidence. No live processes were carried into this turn.
- Extended production `localContentSourceConstraints` to recognize the complete explicit Chinese clause listing attack checks, ability checks and Constitution saves to maintain concentration. A matching1dN subtract modifier must preserve exactly attack/ability-check/concentration-save. Missing or broader ordinary-saving-throw scopes reject with actionable feedback; partial unrelated concentration prose is not interpreted.
- The production converter already calls this guard before Host structural acceptance. Added a converter-level test proving it returns a rejected draft without silently changing the faulty dice scopes. Recognition is conservative and clause-specific, not a claim of general source semantic equivalence or fullbook certification.
- `fullbook-source-scope-final-tests.log`:2files35passed. `fullbook-source-scope-artifacts.log`:1passed against preserved real conversions: the older wrong draft is rejected directly by production source validation without relying on its historical manual negative audit, while the accepted concentration-scope draft passes. Private `fullbook-source-scope-audit-20260926.json` records both.
- Current fullbook preflight rerun passed; readiness remains27/155. No AI requests, exports, user-room edits or conversion payload changes. Typecheck5004 tracked to terminal. The broader remaining runtime gaps, including willingness qualification and delayed rest-benefit settlement, are not claimed complete.
- Full typecheck5004 exited0. All handles in this turn are terminal; goal remains active.

### Explicit willing creature targets

- Previous turn classified as progress: production source checks and direct preserved-artifact validation completed. No carried live processes.
- Added `target.requiresWilling` for creature Activities with schema validation and executor enforcement for every selected creature, including self and allies. Controller/relation is never treated as consent. This is a Host decision input, not something content authors populate as runtime payload.
- Ordinary map spell Host handling now requests fresh target-controller choices; NPCs go to DM. It overwrites casting-client willingness, defaults to refusal, and rejects/cancels before committing resources on refusal/timeout. Added a specific target-not-willing player message. Transformation activities that also require willingness do not ask the old optional waiver question twice.
- `fullbook-willing-tests.log`:2files60passed. `fullbook-willing-facade.log`:107passed. New imported synthetic spell passes through actual package normalization/registration, preserves the target flag, rejects missing consent without HP/slot changes, and applies its effect with exactly one slot spent when Host consent is provided. This synthetic fixture is API acceptance, not a manually repaired PDF conversion.
- AI SDK guide documents the field and current limits. Separate feature/trigger consent UI and actual target-player browser/network acceptance remain outstanding; Catnap still needs delayed rest-benefit settlement and long-rest lockout, so no full-spell or fullbook completion claim. No AI calls, no user-room edits.
- Intermediate full typecheck9822 exited0; final post-test/guide typecheck is tracked to terminal.
- Final full typecheck13336 exited0 after all source/test/guide edits. All handles terminal. Next: isolated target-controller acceptance/refusal/timeout browser evidence, then feature/trigger consent routes and delayed rest-benefit lifecycle. Existing applyDnd5eShortRestBenefits also resolves attunement, so a synthetic short-rest grant must not blindly reuse it without checking the source semantics and completion evidence.

### Target-controller consent: isolated browser acceptance

- Previous turn classified as progress: new willing-only target schema, executor enforcement and spell Host handling, imported facade tests and terminal typechecks.
- Exported an explicitly synthetic consent-only spell module for interface acceptance (`consent-acceptance.starmod`), without modifying PDF conversion drafts or using AI. Added `.codex-logs/fullbook-consent-room.spec.ts/config.ts`: fresh shared storage and ports6773/6774, separate DM/caster/target browser contexts and different room owners. DM uploads module through UI; both players activate it. Character preparation is fixture-seeded here, since this test specifically validates consent authority rather than relearning the already-tested spellbook flow.
- Caster sends each request through the real player transport, including a deliberately asserted activityWillingTargetIds. Test checks only target player gets the actual choice, explicit refusal and real60second timeout reject without HP/slot changes, and acceptance applies2damage with one slot spent. This does not certify Catnap's still-missing delayed-rest lifecycle or fullbook automation.
- Initial94989 failed before consent: synthetic request omitted combatId, correctly rejected stale-combat. Fixture corrected to include current combatId and compare normalized character HP instead of overriding class-derived HP. Second run57057 currently tracked; explicit refusal branch has passed with target-not-willing and no resource/state change.
- Run57057 reached and passed explicit refusal, then exited on read ECONNRESET while observing timeout. Persisted interrupts show rollback/republication around development reload; that run does not certify timeout. Added limited3retries only to idempotent state GET observations and made no workspace writes during the final browser run.
- Final29556 exited0: `fullbook-consent-room-retry.log`1passed in2.1m. Three separate live branches passed: refusal and real60second timeout acknowledged target-not-willing with unchanged target HP/slot count; acceptance acknowledged accepted, applied2damage and spent exactly one5th-level slot. The choice appeared for target member and was absent for caster despite caster-supplied activityWillingTargetIds. No page errors.
- Private audit `fullbook-consent-room-audit-20260926.json`, exact synthetic archive SHA25667a5cc34756d4c43bef5122fa3bffe21a3e86c53ae4136dcfdb7409a36fd2be4. This validates the ordinary spell consent route; feature/trigger routes, DM-owned NPC branch, disconnect/reload recovery and Catnap delayed benefits remain separate work. This turn changed acceptance fixtures/docs only, no production changes or AI requests. All process handles terminal; fullbook goal active.

### Willingness in active features and combat triggers

- Previous turn classified as progress: isolated ordinary-spell refusal/timeout/acceptance network evidence completed. No live handles carried into this turn.
- Maps active-feature Host route now asks each recipient controller before collecting dice; declines acknowledge target-not-willing and commit nothing. Host-obtained IDs replace client assertions in both ordinary prepared payload and any authoritative payload override. Generated spell consent behavior remains unchanged.
- Combat event trigger settlement adds a separate Host `confirmTargetWillingness` callback after selecting targets and before requesting dice. Actor activation confirmation is not target consent, including automatic triggers. Missing callback is explicitly unsupported; refusal declines. Accepted IDs are passed to the execution command. Production Maps adapter routes the separate shared choice to recipient character owner or DM for NPCs, with refusal default.
- `fullbook-willing-trigger-final.log`:2files51passed. Added three real trigger-settlement cases (missing provider/refused/accepted): no damage dice/HP/resource changes without consent, and exactly one die request,4damage and one focus resource spent on acceptance; original input state remains unchanged. Existing feature facade regression suite also passed. This is not active-feature UI or trigger UI network evidence.
- SDK guide now separates tested ordinary-spell network coverage from feature/trigger paths still needing network acceptance. Retained rest-event settlement is separate and not claimed covered. No AI calls or user-room edits; fullbook goal remains active. Full typecheck6107 tracked until terminal.
- Full typecheck6107 exited0. All handles terminal. Verified Catnap source requires full10minutes uninterrupted unconsciousness, cancellation on damage or another creature using an action to awaken, then short-rest benefits and immunity to this spell until a completed long rest. These remain explicit next lifecycle requirements; target consent alone does not complete Catnap.

### Separating granted short-rest recovery from performed rest activities

- Previous goal turn classified as progress: active-feature/combat-trigger consent integration, trigger acceptance tests and terminal typecheck. No live handles carried over.
- Source/lifecycle inspection confirms Catnap needs an uninterrupted timed-effect completion path, damage/awaken cancellation, short-rest recovery, and a target-side lockout until long rest. Current Headless turn ticking and campaign-time ticking are separate; expiry-only completion must be implemented in both and must not fire for dispel/manual removal/interruption. These are still outstanding.
- Extracted `applyDnd5eGrantedShortRestBenefits` from existing recovery: retains short-rest resource, inventory recharge, recovery-ledger and effect cleanup, optionally records the authorized completion event, but does not complete a separately prepared attunement. Ordinary `applyDnd5eShortRestBenefits` wraps it and continues completing attunement. Neither helper advances campaign time or automatically spends Hit Dice/heals. This is the recovery primitive only, not an exposed/finished Catnap Activity.
- Added actual inventory fixture with a prepared ring-of-protection attunement: magical recovery restores Second Wind, preserves pending unattuned item/HP/Hit Dice/world-time watermark and input state; normal rest completes attunement. `fullbook-granted-rest.log`:3files40passed.
- Found existing `characters.map(applyDnd5eShortRestBenefits)` accidentally passed array index as completionWorldMinute. Replaced with an explicit one-argument callback so the legacy no-clock operation cannot fabricate rest timestamps. This small call-site correction was inspected; it has no separate mirror test.
- No AI calls, user-room changes, archive changes or readiness inflation. Fullbook goal remains active. Typecheck76021 tracked to terminal; final store callback edit also needs final type verification.
- Typechecks76021 and final66257 both exited0. All handles terminal. Next lifecycle implementation must preserve uninterrupted-condition evidence (including suspension/condition removal), distinguish natural expiry from premature removal, grant recovery once in both combat and campaign-time paths, and retain the long-rest lockout; the new recovery helper alone is not spell automation.

### Uninterrupted completion history

- Previous turn classified as progress: separated granted recovery from attunement, fixed accidental array-index rest timestamps, and completed tests/typechecks. No carried live handles.
- Added runtime ActiveEffect completionRequirement metadata (standard condition plus interrupted flag), preserved by both factories and normalization and rejected by strict validation when malformed. This is Host runtime state, not yet an authoring operation or a completion reward declaration.
- Added a monotonic completion eligibility reconciler: loss of the required condition or suspension of the tracking effect marks it interrupted. Restoring the condition does not clear it. Headless effect commits compare the previous same-instance state so ordinary replacement cannot reset an interrupted flag; new/remade effects remain distinguishable by instance/removal lifecycle. Effects with no completion requirement take a fast path.
- Wired reconciliation into actual Headless effect commits and campaign timed-effect advancement. Added JSON roundtrip/strict-invalid, active/suppressed/resumed, independent required-condition removal, actual Headless replacement and campaign advance/resume tests. `fullbook-completion-history-verified.log`:3files83passed. Original effect inputs remain unchanged.
- Completion reward dispatch, expiry vs premature removal, once-only reward receipts, Catnap long-rest lockout and source-generated authoring/room acceptance are still outstanding. This metadata prevents false full-duration qualification but does not yet grant recovery or claim a completed spell. No AI calls or user-room changes. Typecheck66759 tracked until terminal; fullbook goal remains active.
- Full typecheck66759 exited0. All handles terminal. Next work remains the actual completion/recovery handoff and receipts rather than treating eligibility history as finished automation.

### Campaign-time completion rewards and durable receipts

- Previous turn classified as progress: persisted uninterrupted-condition eligibility, actual Headless/campaign reconciliation, tests/typecheck. No carried live handles.
- Added Host runtime completionReward:{kind:short-rest}; strict effect validation requires a known reward, finite round duration and completionRequirement. This is not yet the public Effect authoring contract/compiler.
- Added `planDnd5eExpiredRestCompletions`: accepts only caller-established naturally expired effect IDs, checks uninterrupted/effective status, and creates a target-side rule-state receipt independent of caster identity. Existing receipt prevents duplicate recovery and is removed by normal long-rest completion. Missing reward/requirement, interrupted or suspended effects never qualify.
- Campaign timed-effect advancement now projects receipts with remaining effects and applies the existing granted short-rest recovery after valid natural expiry. Completion timestamp derives from the prior authoritative world-time watermark and remaining duration, rather than claiming the whole elapsed interval was a rest. No automatic HP healing, Hit Dice use or attunement completion.
- Tests verify9minutes yields no recovery, final minute restores one resource and removes unconsciousness, repeated completion from a different caster cannot restore a newly spent resource, long rest clears receipt and permits a new benefit, and removed/interrupted/suppressed effects do not grant. Added strict malformed reward coverage and receipt normalization validation.
- During testing fixed optional empty effect projection handling and an incorrect use of authoring stacking enum unique-by-source in the runtime constructor (runtime requires reject); the latter made receipts fail normalization. Tests now assert receipt persistence explicitly. `fullbook-rest-completion-strict.log`:3files88passed.
- Still required: Headless combat expiry path/resource handoff (including NPCs), public declaration/compiler, cast-time lockout enforcement (receipt currently prevents repeated reward, not reselection), awaken action integration, actual raw-source conversion and room evidence. No readiness inflation, AI calls or user-room changes. Fullbook goal active; typecheck10639 tracked until terminal.
- Typecheck10639 found only a test call missing the required long-rest completion minute; corrected to970 and verified a subsequent granted-rest completion at980. Typecheck35572 then exited0. Final receipt classification uses system/nonmagical source (not a dispellable spell buff), tested explicitly; fullbook-rest-completion-receipt.log remains88passed. A final typecheck for that receipt classification is running and must be polled by its exact returned session handle; do not restart it on observation timeout.
- Live final receipt typecheck handle:56147, log .codex-logs/fullbook-rest-completion-receipt-typecheck.log. All other handles this turn are terminal.

### Headless rest-completion reapplication guard

- Previous turn classified as progress: campaign natural-expiry recovery and durable long-rest receipts plus tests. Carried final receipt typecheck56147 was polled to terminal exit0 this turn; no restart.
- Added a shared source-identity lockout lookup and wired it into `applyDnd5eStandardConditionEffect` for completionReward short-rest effects. A matching completed receipt prevents reapplying that reward-bearing condition before mutation, independent of the caster; ordinary unconscious effects remain valid. Receipt lookup is not defeated by presentation suspension. Condition factory handoff now retains reward/requirement metadata.
- `fullbook-rest-target-lockout.log`:3files89passed. New actual Headless condition application test rejects a repeated reward, reports condition-attempted/prevented, leaves the target conscious, allows unrelated ordinary sleep, and allows reward application after receipt removal with metadata retained. Campaign tests continue proving actual long-rest cleanup.
- This is the final condition-application guard, not yet full player selection/preflight: actor resource cancellation and multi-target selection still need the public Activity/compiler and facade integration. Combat expiry reward dispatch/NPC recovery and source-generated Catnap acceptance remain outstanding. No AI calls, user-room changes or readiness inflation. Fullbook goal active; current typecheck tracked separately.
- Live verification handle52186: npm run typecheck, log .codex-logs/fullbook-rest-target-lockout-typecheck.log. Poll this exact handle next; all other handles are terminal. Combat snapshots currently retain only resource current/max (Dnd5eCharacter and Dnd5eCombatant), so correct combat short-rest recovery needs Host-owned reset definitions or a full character recovery handoff rather than guessing reset behavior from resource names.

### Host-derived combat resource reset declarations

- Carried typecheck52186 completed with exit0. Added optional classResourceResets to migrated Dnd5eCharacter and Dnd5eCombatant, derived from classResourceDefinitions on the authoritative Character. Constructor and state clone copy the map independently. Legacy snapshots without declarations remain unspecified; resource names do not infer a rest cycle.
- Native fighter short-rest versus long-rest resources, unknown resource preservation, independent snapshot mutation, plugin short-/long-rest resources and unavailable plugin resources verified in character boundary tests. .codex-logs/fullbook-resource-resets-final.log:3 files59 tests passed. Typecheck80506 completed exit0 (.codex-logs/fullbook-resource-resets-typecheck.log). No live handles remain.
- This is recovery metadata infrastructure, not completed combat rest dispatch. Full granted short-rest recovery also requires item resources (including dice recovery), short-rest ability-reduction cleanup, class-specific partial restoration, effect break triggers, rest activity windows and persistent NPC/character synchronization. Do not issue a completion receipt for a partial recovery. Simulacrum spell-slot recovery restrictions must also remain enforced.
- Next: complete combat recovery handoff/atomicity using these declarations and full inventory data, then public Activity/compiler completion contract, preflight target lockout, awaken action, raw-source Catnap conversion and isolated room acceptance. Whole-book readiness remains27/155 ready for behavior tests,128 blocked; this work does not certify additional entries. No AI calls or changes to user rooms. Goal remains active.

### Complete inventory resource snapshots for combat rest recovery

- Previous turn classified as progress: Host-derived resource reset metadata and passing boundary tests. This turn added Dnd5eInventoryResourceSnapshot (instance ID + resource states only), populated from all inventory entries, including unequipped items without Headless combat effects. Character migration, combatant constructor and state clone preserve independent copies.
- Map result projection merges full resource snapshots with effect resource snapshots in one application; equipment spending also updates the full snapshot, so both views agree. Older/equal inventory revisions cannot overwrite a newer resource state. Reaction-spell snapshots remain separate quantity bookkeeping (not a resource-charge projection).
- Added actual map snapshot-to-character round-trip test covering backpack charge recovery projection, source immutability, equipped-resource spend merge and stale revision rejection. Existing on-hit bonus-damage test now checks full snapshot charge decrement and original snapshot immutability. .codex-logs/fullbook-inventory-resources-final.log:4 files135 tests passed. These tests verify snapshot transport, not natural-expiry rest recovery.
- Typecheck74479 completed exit0. A final incremental typecheck is running after the subsequent spend-sync/stale-revision edits; poll its returned handle rather than restarting. No other processes are live.
- Inventory dice recovery currently supports dawn only (Dnd5eInventoryResourceDiceRecovery.trigger is dawn); short-rest item resources can therefore restore deterministically under the current schema. Next implement unified combat short-rest recovery over classResourceResets and inventoryResourceSnapshots, synchronizing equipment effect snapshots when restoring. Also retain simulacrum slot restriction, sorcerer partial-rest feature, ability-ledger/effect cleanup, rest activity windows and NPC handling before issuing completion receipts. Public Activity/compiler/preflight, awaken action and generated Catnap evidence remain outstanding.
- No AI calls, changes to user rooms, or readiness promotion. Fullbook goal remains active.
- Live final typecheck handle14278: .codex-logs/fullbook-inventory-resources-final-typecheck.log. All other handles terminal.

### Combat granted-rest resource and cleanup core

- Previous turn classified as progress: all inventory resources now cross the combat/map boundary with spending synchronization and stale-version protection. Carried final typecheck14278 was polled to terminal exit0.
- Added restoreDnd5eCombatShortRestResources: restores only declared short-rest class resources, preserves unknown/long-rest resources, keeps the existing simulacrum spell-slot restriction, applies capped level20 sorcerer recovery, restores backpack and every equipped shared-charge projection together, increments inventory revision once only when needed. No HP, Hit Dice or action economy changes.
- Added applyDnd5eGrantedCombatShortRestBenefits in Headless: composes resource recovery with short-rest breakOn effect cleanup, only short-or-long-rest ability-ledger recovery (including saving throw modifier changes), and Relentless Rage DC reset. Extended the existing ability-recovery helper with an optional recovery filter and accurate short-rest event reason; existing magical restoration callers retain their behavior.
- .codex-logs/fullbook-combat-rest-resources-final.log:3files46tests passed. Coverage includes simultaneous resources, unknown-resource preservation, source snapshot immutability, shared item views, repeated full-resource no-op, simulacrum/pact restriction, sorcerer cap/level threshold, rest-only condition cleanup and retaining magic-only ability reduction.
- This is a callable settlement core, NOT yet wired to natural-expiry lifecycle. Completion receipts/rest activity windows, lifecycle suppression/interruption qualification, NPC per-rest mechanics and full raw-source Catnap certification are not proven. Do not mark Catnap or additional book entries ready based on these tests. Next connect this core through genuine natural-expiry settlement with durable once-only receipts and Host rest-trigger delivery; preserve public Activity/preflight and awaken-action remaining work.
- Typecheck54056 is live (.codex-logs/fullbook-combat-rest-resources-typecheck.log); regression verification for existing authority restoration is tracked separately. No AI calls or user-room changes; fullbook goal remains active.
- Authority restoration regression49964 completed exit0: .codex-logs/fullbook-rest-ability-regression.log,2files50tests passed. Only typecheck54056 remains live; poll exact handle next. Native monster sources inspected expose ability-reduction short-or-long-rest recovery, but no generic short-rest recharge declarations were found in the bounded sources; do not infer recharge from names.
- Final typecheck54056 completed exit0 after the preceding log entry. All processes terminal; no carried live handles.

### Natural combat expiry now settles granted short-rest benefits

- Previous turn classified as progress: callable resource/cleanup core and regression evidence. No carried live processes at turn start.
- Wired genuine normal turn-boundary duration expiry into planDnd5eExpiredRestCompletions using the eligible pre-removal effects and only directly expired IDs (not cascade removals). Recovery uses the shared core, then persists nonmagical long-rest lockout receipts. A shared settlement function also handles repeat-save duration expiry; successful early save removal does not grant benefits.
- Added lastGrantedShortRest receipt identity and optional authoritative campaignWorldMinute in combat/character state. Map projection persists the marker for tokens and characters, and opens a rest activity window for a newly seen receipt with a known minute. Replayed projection retains already-used activity receipts. Unknown campaign minutes are not invented. Actual clock advancement timing and NPC optional-rest-activity delivery still need complete acceptance.
- .codex-logs/fullbook-rest-expiry-final.log:5files102tests passed. New actual end-turn tests prove no early recovery, expiry resource/charge restoration, original-state immutability, prevention of a second grant from another caster, no grant for recorded interruption/removal, and repeat-save success vs failure/expiry. Actual map result application test proves class-resource recovery and a persisted rest activity window with replay-preserved used receipt. Damage-interruption/awaken UI and suppressed effect acceptance still need explicit end-to-end evidence; do not describe the direct interrupted-flag fixture as a damage test.
- Initial typecheck40941 completed exit0. Final typecheck33732 is live after the marker/map/repeat-save edits: .codex-logs/fullbook-rest-expiry-final-typecheck.log. Poll that exact handle; all test sessions terminal.
- Remaining: public Activity effect completion contract/compiler, preflight long-rest target lockout/resource cancellation and willing target flow, awaken action, all short-rest NPC mechanics supported by supplied stat blocks, raw-source Catnap conversion/export/isolated player-room acceptance. No additional book entries certified; fullbook goal remains active. No AI calls or user-room changes this turn.

### Public completion-reward contract and commit preflight

- Previous turn classified as progress: natural expiry dispatch, durable completion receipts and character rest window projection. Carried final typecheck33732 exited1 with a test-only readonly events mismatch in mapBridge.test.ts; fixed by copying result.events into the mutable projection input. Subsequent typecheck4370 exited0.
- Added Effect completionReward:{kind:'short-rest',requiresCondition:<standard condition>} to public authoring contracts, validation, executor proposal and compiler reconstruction. Validator requires exactly one matching condition, fixed rounds, no concentration/extensionCondition/castLevelProfiles. Runtime maps it to a Host-created uninterrupted completion requirement; imported data cannot set its interrupted history. AI SDK guide and community SDK documentation now describe the contract and outstanding verification limits.
- Activity commit checks matching source/package completion receipts for every resolved reward proposal before costs/effects, returning invalid-target without spending on a locked target. This proves the direct Activity commit boundary, not yet all outer spell/material reservation flows or UI reselection.
- Public JSON round-trip test resolves the Activity, commits it, runs real turns, verifies recovery and metadata, and rejects a second cast while preserving action/resource state. It also proves initial action/slot cost once and malformed completion definition rejection. Test found the compiler's one-round optimization changed rounds to until-turn-boundary, preventing completion recognition; reward-bearing fixed-round effects now preserve their counted duration even for one round. Source spells retain source durations (ten minutes=100 rounds); the synthetic one-round fixture is not source-generated Catnap.
- .codex-logs/fullbook-rest-contract-final.log:3files23tests passed. .codex-logs/fullbook-rest-contract-regression.log:3files112tests passed, including existing authority and map projection. Initial fixture compiler call lacked outerSpellTransaction for spell-slot consumption; corrected the fixture to use the actual spell compiler mode.
- Final typecheck9586 live after the final counted-duration/preflight/test edits: .codex-logs/fullbook-rest-contract-final-typecheck.log. All other handles terminal. Poll exact handle next.
- Remaining: actual damage/awakening and suppression lifecycle acceptance, outer spell preflight/material cancellation and target reselection, full awaken interaction, supplied NPC rest declarations, AI raw-source conversion/export/import/isolated room proof. Readiness counts unchanged; no AI calls or user-room changes. Goal remains active.

### Actual interruption and player wake verification

- Previous goal turn classified as progress: public completion contract/compiler handoff and commit preflight. Carried final typecheck9586 polled to terminal exit0.
- Confirmed existing wake UI/Headless uses breakOn awakened generically, not only native Sleep; no duplicate spell-specific wake interaction added. Public Activity fixture now casts the configured rest and resolves real weapon damage or wake-sleeping-creature, proving action use, condition removal, no subsequent recovery and no completion receipt. Initial fixture omitted Host pair distance; supplied actual5ft authority distance instead of weakening validation.
- Added playerBasicAction request/preparation/resolution/map projection test for a plugin-owned100round rest effect, proving the existing player wake request consumes an action and leaves no completion marker or receipt. This is the player action bridge, not a browser/network acceptance claim.
- Actual map antimagic test exposed lost completion interruption history: transient suspension was stripped before history persisted. Fixed map occupant projection to reconcile uninterrupted completion requirements immediately after magical suppression. Test now proves interrupted=true persists after removing transient suspension and after rebuilding the outside-area snapshot. Ordinary magical effects still clear transient suppression as before.
- .codex-logs/fullbook-rest-interruption-map.log:3files114tests passed. .codex-logs/fullbook-rest-wake.log:3files94tests passed. SDK docs distinguish verified wake bridge/actual damage from remaining browser acceptance.
- Typecheck38055 live (.codex-logs/fullbook-rest-interruption-typecheck.log) after production suppression fix, before final player bridge test addition; poll exact handle. All test sessions terminal. Remaining next: source-driven Catnap conversion through the updated guide, inspect generated definition and source guard, full duration/target/upcast behavior, export/import and isolated room; also audit outer spell preflight/material reservation cancellation and supported NPC declarations. No AI calls or user-room changes this turn. Goal active, no readiness promotion.
- Typecheck38055 completed exit0. All prior handles terminal. Started fresh source-driven Catnap (休憩术) conversion with already-authorized configured AI service, production SDK guide and max3 recorded provider calls, resumable report. Source inventory ID ends :151:6. New harness .codex-logs/fullbook-catnap-contract-convert.test.ts; private output fullbook-catnap-contract-convert-20260926. Do not restart while returned session is live; token totals must be read from conversion-run.json on completion.
- Live conversion session47280 confirmed running via write_stdin. Provider model gpt-5.6-luna, first request local-rule-import-15787099-1ded-467c-8854-5b809ee55e0b started2026-09-27T04:58:23.841Z; no usage returned yet. Poll exact session on continuation, then inspect private conversion report. Do not duplicate/restart request. All other processes terminal.
- Conversion47280 completed exit0 (supersedes prior live entry). Private fullbook-catnap-contract-convert-20260926/conversion-run.json contains2 successful gpt-5.6-luna calls,86,726 input /2,810 output tokens; attempts2, ready-for-behavior-tests=true, behaviorVerified=false. No manual content repairs. Generated catnap-cast uses3 visible willing creatures at30ft,100 target-end rounds, completionReward short-rest/unconscious, takes-damage/awakened breakOn, slot-level additionalTargetsPerStep1. Spell level3, ten-minute nonconcentration duration and bard/sorcerer/wizard lists retained. Inspect exact unedited draft and run actual module export/import/pluginSpellTransaction behavior next; preflight is not certification. Known cumulative provider usage now32,005,149 input /1,674,176 output,1156 known calls plus6 unknown-usage calls. All processes terminal.

### Generated Catnap archive and actual spell transaction behavior

- Previous goal turn classified as progress: real interruption/suppression fix, source conversion with recorded usage. No carried live processes at turn start. No new AI calls this turn.
- Added .codex-logs/fullbook-catnap-behavior.test.ts: takes the unedited generated draft, exports .starmod, rereads/project/parses it, installs its runtime, prepares and resolves actual plugin spell transactions with Host consent facts. Tests500 real end-turn actions covering100 complete target rounds, no early recovery, three fighters' Second Wind recovery at final expiry, unaffected fourth target, refusal without slot cost,3rd-level capacity rejection, range rejection,4th-level four targets, repeated cast and mixed eligible/locked cast without cost or partial effects. All passed (.codex-logs/fullbook-catnap-behavior.log). This is not browser/network evidence or exhaustive source certification.
- Generated facade test initially failed repeat-cast rejection: direct Activity commit preflight did not cover the installed compiler/outer plugin spell entry point. Added optional Host canReceiveRestCompletion capability on plugin context with authority-owned source/package identity; compiler preflights every resolved reward proposal before effect/cost iteration. Permanent test installs a compiled synthetic plugin with an eligible first target and locked second target, proving no partial effect or action spending. .codex-logs/fullbook-rest-plugin-preflight.log:3files115tests passed.
- Private generated-behavior.json reports manualConfigurationEdits=false and roundTripVerified=true. Final archive SHA256 b03503ee7bd4ada40e46471b2dca6f4464417b5a8a6f33171607e2fca24995db, copied to private verified-artifacts/<sha>.starmod. Browser acceptance must use this exact archive; do not re-export while browser testing (export metadata changes hashes). Current path fullbook-catnap-contract-convert-20260926/generated-catnap.starmod matches this hash.
- Typecheck88086 remains tracked after production compiler/context changes (log .codex-logs/fullbook-rest-plugin-preflight-typecheck.log), before final permanent test addition. All test handles terminal. Remaining next: actual isolated browser module import, player learning/preparation/consent/casting/sync, generated source sight/long-rest eligibility and all supplied NPC rest mechanisms, final behavioral/readiness aggregation. Preserve room5273/5274. No global fullbook completion/readiness promotion.
- Typecheck88086 finished exit1: Token.dnd5eCombatState declaration lacked lastGrantedShortRest although the runtime projection already wrote it. Added the matching field to src/store/maps.ts. Final typecheck52454 live, .codex-logs/fullbook-rest-plugin-preflight-final-typecheck.log; poll exact handle next. This also checks the final permanent preflight regression test. All other handles terminal.

### Generated Catnap isolated browser acceptance

- Previous turn classified as progress: generated archive/facade verification and compiler preflight fix. Carried final typecheck52454 completed exit0, including Token lastGrantedShortRest declaration and final permanent preflight regression.
- Added .codex-logs/fullbook-catnap-room.spec.ts/config.ts using a fresh STARS_SHARED_ROOT, fresh room, separate DM/player browser contexts and strict6773/6774 ports. Uses exact preserved archive b03503ee7bd4ada40e46471b2dca6f4464417b5a8a6f33171607e2fca24995db; no workspace edits during a running test. User5273/5274 rooms untouched.
- First run75254 failed at material gating, before consent/settlement. Initial commentary attributed it to occupied hands based on generic UI text; exact inventory diagnosis did not establish that. Correct test fixture explicitly grants a component pouch and leaves hands free. No production material validation was weakened.
- Retry66679 completed exit0,1passed1.3m (.codex-logs/fullbook-catnap-room-retry.log). Browser proof: DM .starmod upload, player exact-version activation, actual spellbook learning/preparation, hotbar/map cast, NPC consent exclusively on DM, slot unchanged before consent and spent once after it,100-round unconscious reward effect, unchanged target HP, identical actual DM/player effect stores and no page errors.
- Private fullbook-catnap-room-audit-20260927.json records roomG8S6J5 and the exact same artifact hash as generated-behavior.json. FullBookCertified remainsfalse;100-round expiry was exercised in the independent generated spell facade test, not by pretending the browser advanced100 rounds. Browser scope is ordinary casting/consent/sync, not all spell outcomes or NPC rest mechanics.
- Running consolidated structural preflight over all exact-source unedited candidates to refresh global counts after Catnap. Track its returned handle; all previous handles terminal. No AI calls this turn. Next select remaining blockers from fresh report; preserve Catnap's separate source/archive/browser evidence without treating it as certification of the entire book.


### Movement opportunity protection contract

- Consolidated preflight56675 completed exit0,1passed7.67s. Fresh exact-source structural counts:28 ready-for-behavior-tests,127 blocked across155 entries. This supersedes the previous running audit entry and does not confer behavior certification.
- Added public Effect modifier prevent-movement-opportunity-attacks, executor/runtime normalization and strict validation, plugin whitelist and Host modifier projection. The map detector checks the authoritative snapshot before suppressing a movement reaction; attack preparation and Host commit also reject. Disengage bypass does not override this protection. Suppression and expiry restore ordinary reactions; independent reaction attacks remain separate.
- Permanent dnd5eMovementProtectionContract test exercises public Activity validation/compilation/resolution/commit, serialized effect boundary, malformed boolean, no-cost rejection, suspension, expiry, independent Berserker Retaliation and War Caster spell replacement. Existing map opportunity tests include detector and pre-prompt protection. Initial fixture used creature targeting for self; corrected to explicit self/actor targeting. Two-round effect respects the engine's application-turn boundary and expires after subsequent counted boundaries.
- Test exposed an existing off-turn gate rejecting an opportunityAttackSpell before the dedicated spell validation. Added this Host action flag to off-turn routing; dedicated ability/spell/target/reaction checks remain. Ordinary off-turn spell casts are still rejected. Replacement spell is rejected while movement protection is effective and accepted after removal.
- .codex-logs/fullbook-movement-protection-regression-retry.log:4files79tests passed. The requested warCasterOpportunitySpell.test.ts filename does not exist; actual War Caster regression is featHeadlessPrimitives.test.ts plus the new public contract test. No claim of a fifth suite.
- First typecheck30661 completed exit0. Typecheck94684 started before final off-turn routing/test changes; track completion, then run one final check for final edits. No AI calls, no source configuration edits, no user-room writes. This does not certify Zephyr Strike: own-turn enhancement, generated archive and room acceptance remain outstanding. Goal remains active.

- Typecheck94684 completed exit0. Final post-routing check35989 running in .codex-logs/fullbook-movement-protection-complete-typecheck.log; no other live test processes. Regression51030 terminalexit0,79passed. Next interface work: an explicit Host turn-owner predicate for own-turn-only enhancements, carried from combat state through dnd5eActivityCombatAuthority/Command and compiled plugin execution, never supplied by player command JSON. Investigated entry points but not yet implemented or source-certified.
- Final typecheck35989 completed exit0, including all movement protection, off-turn routing and final tests. All tracked processes terminal. No source conversion calls this turn; global counts remain28 structural-ready/127 blocked. Goal stays active; continue own-turn predicate and source-generated acceptance next.


### Host turn-owner predicate and Zephyr Strike source conversion

- Previous goal turn classified as progress: movement protection contract, Host routing fix and79passing regressions/typecheck. Inspected current report and sources; all prior processes terminal.
- Added public predicate {kind:'turn-owner',owner:'actor'|'other'}, strict selector validation, readable log labels and SDK guidance. Resolver requires a nonempty Host currentTurnActorId; missing turn context satisfies neither selector. Registered combat authority and compiled plugin executor derive it from active Host initiative state. Command input is kept separate from the wire command, which cannot supply the trusted value.
- Permanent dnd5eTurnOwnerContract.test.ts covers both selectors/missing context, malformed owner, registered Host path ignoring a forged command field, compiled plugin path ignoring a forged payload even when explicitly allowOffTurn. First fixture accidentally used a numeric amount rather than a constant formula; fixed fixture without weakening validation.
- .codex-logs/fullbook-turn-owner-regression.log:3files35tests passed, session68922terminalexit0. Typecheck86490 running in .codex-logs/fullbook-turn-owner-typecheck.log; poll same handle.
- Started unedited source-driven Zephyr Strike conversion from verified PDF source ID ending:171:9 using production guide, authorized AI provider, max3calls and resumable private report. Harness .codex-logs/fullbook-zephyr-turn-convert.test.ts/config.mjs; output fullbook-zephyr-turn-convert-20260927/conversion-run.json. Process39709 live; do not restart while live. Usage pending; prior cumulative32,005,149input/1,674,176output,1156knowncalls+6unknown. No source draft hand edits or user-room changes. New contract tests are not generated-source or fullbook certification.

- Conversion39709 completed exit0 after3returned gpt-5.6-luna calls:133,043input/8,587output tokens,attempts3,ready=false. Cumulative known provider usage32,138,192input/1,682,763output,1159knowncalls+6unknown-usage calls. No manual draft edits.
- Source conversion exposed the new predicate missing from pluginMechanicsRegistry's core handler list. Registered predicate:turn-owner and added missingComponents assertion to the permanent contract test. The already-running converter retained its loaded older registry; did not restart or incur more calls. A new read-only .codex-logs/fullbook-zephyr-preflight.test.ts rechecks its exact unedited draft with current registry; passed, private current-preflight.json now retains only two real source lifecycle blockers.
- Generated source uses concentration movement protection and a granted own-turn weapon-boost activity, with weapon advantage/on-hit1d8force/makes-weapon-attack cleanup. Remaining explicit limitations: bind the after-attack30ftspeed bonus to precisely the enhanced attack, and enforce shared once-per-cast entitlement across enhancement/bonus damage/speed. Must also audit when the extra damage dice are rolled and whether all granted controls become unusable on concentration end. No source certification or ready-count promotion.
- Final regression37294 completed exit0,3files35tests passed (.codex-logs/fullbook-turn-owner-final.log). First typecheck86490exit0; final typecheck90526 running after registry/test changes (.codex-logs/fullbook-turn-owner-final-typecheck.log). All other tracked processes terminal. Goal active.
- Final typecheck90526 completed exit0. All tracked processes terminal. Next concrete blocker: generic once-per-grant/cast enhancement consumption plus an attack-correlated post-attack speed effect. Existing afterEffectEnds only supports action/movement restrictions and descent; do not misuse it or a generic after-attack trigger to claim correlation. Generated weapon boost currently has no per-cast consumption, and its next-attack dice/lifecycle must be behavior-tested. Preserve the unedited draft and failed status; no additional AI retries until the missing contract exists.


### Attack-correlated speed, one-use authorization and generated lifecycle defect

- Previous goal turn was progress: Host turn-owner predicate and source conversion exposed correlated-attack lifecycle gaps. Current implementation inspected before proceeding; no carried live processes.
- Added public speed-after-own-turn-weapon-attack modifier with bounded bonusFeet, runtime normalization/strict validation, executor projection, plugin handler registration and Host projection. Attack event captures effective participating modifiers before ordinary makes-weapon-attack cleanup, then grants source-linked walking speed until the bearer's current turn ends. It ignores spell/off-turn attacks and suspended modifiers; hit and miss both activate it. No per-spell name dispatch.
- Permanent dnd5eAttackSpeedContract.test.ts verifies public Activity execution, hit/miss, current movement budget, expiry, suspension, spell/off-turn exclusion, actual registered one-use authorization consumption while retaining the main spell, repeat-use rejection and failed concentration cleanup. Additional cases prove next-weapon advantage and delayed1d8damage on hit, doubled critical dice and removal after the attack. No upfront damage dice used to arm the effect. Test fixture first lacked required legacySource and initially called the low-level concentration mutator rather than the complete action/lifecycle path; corrected to actual concentration-save resolution, without changing production cleanup semantics.
- 3files64tests passed in fullbook-attack-speed-final.log (66543exit0); first typecheck17082exit0 and final63720exit0. These preceded the final preflight guard described below.
- Fresh raw-source conversion fullbook-zephyr-lifecycle-convert-20260927 initially used1gpt-5.6-luna call43,378input/2,217output, structural-ready. Cumulative before repair32,181,570input/1,684,980output,1160knowncalls+6unknown. It adopted new movement/turn/attack-speed primitives, but generated the authorization itself as a concentration effect.
- New .codex-logs/fullbook-zephyr-behavior.test.ts exported/reimported the unedited draft, installed the plugin and executed actual ranger spell transaction and registered enhancement. It proved slot consumption and caught a semantic failure: consuming the authorization ends the entire concentration. Failed exported artifact hash efb8112a53064422152e1bf61791699eded49699938de48e493b9d4b2e1285fb, archived privately alongside generated-behavior-before-repair.json and conversion-before-repair.json. This is failed behavior evidence, not certification. The harness currently stops at concentration-preservation and must be expanded to all generated hit/miss/critical/lifetime branches after repair.
- Added generic dnd5eConcentrationChildConsumptionIssues preflight: rejects an outcome that removes a self concentration child while applying another child dependent on the same parent. Intentional dismissal and non-concentration source-linked authorization remain valid. SDK now explicitly requires non-concentration rounds for consumable authorization. 2files9tests passed (fullbook-attack-speed-preflight.log).
- Resumed the existing converter using refreshed production preflight and its existing3-call total cap, no manual draft edits. Repair process15395 live; private conversion-run.json contains usage when complete. Previous conversion46260terminalexit0. Final typecheck89425 live in fullbook-attack-speed-complete-typecheck.log. Preserve all handles; no browser/user-room work this turn. Goal remains active.

- Repair15395 completed exit0, total2calls in this run88,102input/3,827output; one automatic feedback repair beyond the original candidate, no manual draft edits. Known cumulative32,226,294input/1,686,590output,1161knowncalls+6unknown. New configuration uses a non-concentration authorization; original failed artifact/report preserved.
- Generated behavior retry13666exit0, then expanded facade proof alsoexit0 (.codex-logs/fullbook-zephyr-behavior-full.log): actual ranger plugin spell cast spends one slot, enhancement preserves concentration/main movement immunity, repeated/off-turn enhancement rejected, real weapon miss/hit/critical resolve correct damage30/23/14targetHP, speed60afterattack and30atendturn, main concentration remains until actual failed concentration action clears linked effects. This is archive+Host facade evidence, not browser or exhaustive ten-round expiry/recast acceptance.
- Current exact generated artifact SHA256d65c7eb9d82c440433788e409d2609d740913f30baca045c779c9d01472dae98, copied to private verified-artifacts/<sha>.starmod. Browser must use this preserved version; rerunning the export changes metadata/hash. Private generated-behavior.json matches and states fullBookCertified:false.
- Final typecheck89425exit0 after new preflight helper/tests. All prior handles terminal. Started consolidated preflight refresh after repaired candidate; inspect its process result and counts before reporting. Next meaningful work: same artifact isolated DM upload/player activation/learning or known selection/casting/enhancement UI/sync, preserving5273/5274. Also verify full source duration and fresh recast entitlement separately. Goal remains active.
- Consolidated refresh completed exit0. Current structural counts: {"blocked":126,"ready-for-behavior-tests":29}. All processes terminal. Structural readiness remains separate from behavior/browser evidence.


### Zephyr isolated room acceptance and player-entry turn context

- Previous turn was progress: generic attack-speed lifecycle, automatic concentration-child repair and exact archive Host behavior. Re-read current generated proof and report; no live prior processes. Preserved artifact d65c7eb9d82c440433788e409d2609d740913f30baca045c779c9d01472dae98 used unchanged.
- Added fullbook-zephyr-room.spec.ts/config.ts with fresh shared root, strict6773/6774, separate DM/player contexts. First browser62856exit1 completed DM upload, exact-version activation, ranger learning through UI and map self-cast costing one slot. Stopped at a test-only granted button internal-id selector mismatch; visible button evidence confirmed the control existed. Updated selector to exact accessible button name; no production change for this first failure.
- Retry45842exit1 reached actual player enhancement request and received feature-unavailable. Located real integration gap: pluginFeatureAction's root requirement preflight omitted currentTurnActorId, although registered/compiled execution had it. Added context derived from live combat identity and initiative entry; exploration does not invent a turn. Also passed state-derived turn to the personal damage checkpoint root preflight, the other discovered caller.
- Permanent pluginFeatureAction test installs a compiled granted control, proves player preparation and actual3THP resolution on own turn, rejection on another turn and in exploration despite a forged payload currentTurnActorId. 2files29tests passed in fullbook-turn-owner-entry.log; requested ActivityTriggerWindows.test.ts does not exist, so separately running actual damageCommitSession.test.ts for checkpoint regression. First two browser audits retained; roomsTMF2LB andMLVTZA are isolated test rooms only.
- Typecheck95980 running in fullbook-turn-owner-entry-typecheck.log. Track checkpoint test handle then rerun exact browser after terminal checks; do not write workspace files while browser is active. No AI calls or generated config edits. Goal active, not browser-certified yet.

- Entry typecheck95980exit0. Checkpoint regression86112exit0,14tests passed. No source artifact edits. Duration harness36031exit1 found concentration still active after10 complete two-actor rounds from the cast; private generated-duration.json records failure against the same preserved SHA. Need inspect actual remaining ticks and source-turn boundary convention before changing engine or accepting a different expiry; do not weaken the assertion solely to pass. Recast branch not yet reached.
- Starting third fresh browser run with the fixed player-entry turn context; all previous processes terminal. No workspace writes until it terminates. This browser scope covers import/learn/cast/enhancement/sync, independently of the unresolved full-duration assertion.

- Third browser50982 completed exit0,1passed1.3m in fullbook-zephyr-room-fixed.log. Private audit roomDXK7UY records exact preserved SHA d65c7eb9d82c440433788e409d2609d740913f30baca045c779c9d01472dae98, DM upload, player activation/UI learning/map self-cast, once-only enhancement preserving main concentration, identical DM/player effects and zero page errors. User5273/5274 untouched.
- Duration investigation found the existing documented engine boundary convention: application turn preserves the initial concentration counter; subsequent source-turn-end boundaries decrement it. Added explicit initial10, application-turn10 and each subsequent9..1 assertions before expiry, rather than simply extending a loop without evidence. Same archive duration/recast test passed (fullbook-zephyr-duration-boundaries.log,1test); expiry clears main and linked authorization, actual recast spends next slot and grants usable new authorization. Original failed duration audit preserved as generated-duration-initial-boundary-failure.json. This validates the engine's full-round boundary convention; no claim of sub-turn real-time precision.
- No AI calls this turn. Global structural counts remain29ready/126blocked; these source-specific acceptance results do not certify whole-book import. All tracked processes terminal; goal remains active.

### Ground-contact moving terrain and generated-source omission guard

- Added public create-persistent-area.movementRequiresGroundedSource boolean. It passes through Activity execution/handoffs, map persistence and restored rooms. Movement-cost evaluators compare the live source Token against Host terrain elevation, including raised platforms; flight suspends the cost, landing restores it, a missing source disables it. Combined with existing enemy relation/source-token anchoring, this supports conditional moving enemy difficult terrain without spell-name dispatch. It only conditions movement cost, not unrelated area damage/obscuration.
- Permanent tests cover execution/proposal, strict malformed-field rejection, actual map handoff, enemy/ally/self filtering, raised terrain, flight/landing, missing source, movement and production map migration. Initial added test expected validation to return an error but the pattern compiler already throws; corrected the test to assert the throw. Final fullbook-grounded-terrain-final.log:3files63tests passed. Initial typecheck23369exit0. SDK and production AI guide updated with scope and limitations.
- Source-driven Guardian of Nature conversion47525exit0 used3authorized gpt-5.6-luna calls,162,903input/6,676output tokens, no draft edits. Cumulative known usage32,389,197input/1,693,266output,1164knowncalls+6unknown-usage calls. Run fullbook-guardian-ground-convert-20260927 exhausted its3-call cap. Last candidate reported structural ready, but omitted movementRequiresGroundedSource despite the original explicit ground-contact clause. Do not certify it or spend unbounded retries.
- Added narrow name-independent source constraint for the explicit Chinese source-grounded enemy terrain sentence, recognizing PDF line breaks, self/enemy radius, source anchoring and movementRequiresGroundedSource:true. This rejects the omission instead of rewriting the draft. 2files13tests passed in fullbook-grounded-source-guard.log. Existing production AI conversion already consumes this guard's issues as automatic repair feedback. It is not general semantic certification; unrelated ground mentions do not trigger it.
- Consolidated current preflight completed exit0; current source guard keeps this generated candidate blocked. Added separate source-behavior-audit.json against the unedited draft, preserving original conversion result and clearly distinguishing structural parsing from source constraints. No archive/browser acceptance yet for Guardian. Final typecheck1383 running in fullbook-grounded-source-final-typecheck.log; poll same handle. Goal active, user rooms untouched.
- Final typecheck1383 completed exit0. Guardian source-constraint audit completed exit0,1test (fullbook-guardian-ground-audit.log), proving the unedited candidate is rejected for omitted ground contact. Consolidated counts remain29structural-ready/126blocked. All tracked processes terminal. Next work must preserve this3-call capped failure and source evidence; complete source-driven conditional-area configuration and actual archive/form/terrain/attack/lifecycle acceptance before certification. Goal remains active.

### Guardian source repair and attack semantics

- Previous goal turn was progress: conditional terrain interface and source omission guard. Rechecked current report/code; no carried live processes. Preserved the old three-call capped failure, then ran one explicitly capped automatic feedback repair against the new production source guard in fullbook-guardian-source-guard-repair-20260927. No draft edits. Process33803exit0, one gpt-5.6-luna call55,068input/2,498output; cumulative known32,444,265input/1,695,764output,1165knowncalls+6unknown-usage calls. The new candidate includes movementRequiresGroundedSource:true and passes current structural/source constraints.
- Exported/reimported the unedited candidate and executed actual ranger fourth-level spell transactions for both forms. Primal speed/darkvision and tree temporary HP/map handoff/grounded enemy cost/self exclusion/flight suspension passed. Harness initially read pkg.activities instead of the production package projection; corrected harness only. Trigger test initially supplied actor/automatic rather than the API's system confirmation and a later fixture incorrectly expected ranged advantage while threatened; corrected these fixtures without weakening rules.
- Actual generated critical attack exposed attack-result:hit excluding critical-hit. Changed generic contextual predicate so hit/miss include their critical variants; exact critical selectors remain exact. Added full result matrix/missing/nonattack context tests. Actual generated weapon attacks now resolve delayed bonus damage on normal/critical hits, exclude misses/ranged attacks and preserve concentration until a failed save.
- Actual generated strength attacks also exposed silent loss of ability-scoped advantage. Added runtime attackRollAdvantageAbilities, public executor projection, Host mechanical projection, both creation/normalization/persistence paths, strict validation and effective flags. Equipment and spell preparation now supply the actual attack/casting ability. Native spell settlement uses its authoritative class ability; imported spell transactions carry Host-derived class/racial ability through internal options to nested Activity roll-mode/critical/dice validation. Monster core spell preparation/settlement pass the known spellcasting ability. No player-provided ability override added.
- Permanent tests cover public Activity -> commit -> serialized effects, all six ability selectors/unknown ability, suspension, malformed persisted ability, strength versus dexterity weapons, native spell matching/mismatching attribute, and imported wizard/druid attack preparation plus actual settlement. Initial native miss fixture supplied unused damage dice and imported fixture used the wrong character effect field/d20 total; corrected fixtures. One cmd test-name quoting attempt skipped tests; not counted as passing acceptance. Final targeted imported spell test passed2/2 (107unselected); native/weapon contract passed6; invocation/combat/weapon regression passed38 before the final two native cases. First typecheck29641 caught test-only incomplete event contexts; fixed required mode/id/level. Intermediate36951exit0; final85870 running after spell-path changes and new tests.
- Final generated facade66900exit0. Exact artifact SHA2568c3b3bc00d80f3cf2f56ede535a7ea3509e514af6624115ce9cc3b8184ed5b90 preserved under private verified-artifacts/<sha>.starmod, matching generated-behavior.json. Browser must use this preserved version, not rerun export. This is not complete Guardian certification: browser room import/learning/form choice/sync, full duration/recast/tree cleanup, and negative melee-spell/unarmed trigger cases remain to verify. Do not infer all these from the passing narrow facade.
- Consolidated refresh24399 running; track it and final typecheck85870. User5273/5274 unchanged; no browser launched this turn. Goal remains active.
- Consolidated refresh24399 and final typecheck85870 both completed exit0. All tracked processes terminal. Next: preserve exact Guardian archive and exercise remaining source-specific negative attack/lifecycle cases plus isolated DM/player form-choice acceptance; keep structural readiness distinct from whole-book certification.

### Attack categories, generated Guardian boundaries and live target-choice repair

- Corrected the proposed unarmed negative case against official 2014 Sage Advice: unarmed strikes count as melee weapon attacks; melee spell attacks do not. Added public attack-category weapon/spell predicate, strict validation, registry/log/SDK support and Host-derived event category. Combined with attack-mode melee/unarmed it expresses this distinction without spell-name dispatch. Default unarmed attacks now use Strength for ability-scoped advantage.
- Preserved old artifact 8c3b3bc00d80f3cf2f56ede535a7ea3509e514af6624115ce9cc3b8184ed5b90 and proved its unarmed rider omission. Added a narrow source guard for explicit melee-weapon extra-dice clauses. One automatically fed-back repair in fullbook-guardian-category-repair-20260927 used 55,433 input / 2,235 output tokens, no draft edits. Cumulative known provider usage 32,499,698 input / 1,697,999 output, 1166 known calls plus 6 unknown-usage calls. New exact archive SHA256 4cece048191bcf1ba37cd78fcf9fc49cf6a6890e2ced45a06dffc3aa5c27adae is preserved under private verified-artifacts.
- Attack/category/source regressions passed 4 files / 24 tests; typecheck20716 exit0. New artifact facade verifies normal and critical melee weapon/unarmed riders, miss/ranged/melee-spell exclusion, both forms, grounded enemy terrain and application-turn plus ten counted boundaries. Further same-archive lifecycle test verifies bound temporary HP clear on failed concentration and expiry. First added concentration fixture omitted the second d20 required by tree advantage; corrected fixture, final68706 exit0. No regenerated archive or hand-edited content.
- Isolated browser45925 failed because test omitted map placement confirmation. After adding actual canvas placement, browser43398 reproduced a real Host invalid-target rejection in room EEEUV6; slot remained unspent. Private shared root stars-guardian-isolated-1790492189030 retains the submitted request. A focused replay proves preparation and direct Activity execution succeed but compiled Host execution failed with an empty enemy target list.
- Fixed dnd5eActivityHeadlessCompiler to resolve choices before selecting fallback targets. A base self Activity switched to an enemy area previously fabricated the actor when no enemies were present, then rejected its own includeSelf:false contract. The compiler now uses the selected target contract and shares the same resolved choices with execution. Exact failed browser request replay now passes. Permanent dnd5eChoiceTargetFallback test covers self/empty area success, forged self exclusion and invalid-choice rejection. Initial synthetic fixture had no opposing combatant and combat had ended; corrected fixture. Combined choice/turn-owner tests: 2 files / 5 passed.
- Consolidated refresh97353 exit0: 30 structural-ready / 125 blocked, still not whole-book certification. Typecheck27976 remains running in fullbook-choice-target-typecheck.log. Next: exact-artifact browser rerun after compiler repair; full map cleanup/recast acceptance remains unverified. User rooms5273/5274 untouched. Goal remains active.
- Typecheck27976 exit0. Third browser98650 reached actual successful player cast, one slot spent and10temporary HP, then caught a second real defect: the persistent area was saved relation:any rather than enemy. The compiled result returned the base Activity definition rather than the selected target override. Changed the returned activityDefinition to the same selected definition and extended permanent regression to assert its target contract;5tests pass. Updated generated facade to consume the actual returned definition rather than constructing the expected selected definition in the harness. Final typecheck52124 running. Browser acceptance remains incomplete until rerun passes; do not count the successful cast alone as full synchronization/terrain certification.
- Same-archive updated handoff test20881 and added actual map-bridge/concentration-reconciliation test82741 both exit0. Bound temporary HP and generated tree persistent area clear after a failed concentration save; both forms expire after ten counted boundaries. Typecheck52124 remains pending; no browser running. These generated lifecycle checks do not certify recast or the other125blocked entries.
- Final typecheck52124 exit0. Fourth browser92841 exit0,1passed1.3m (fullbook-guardian-room-final.log), isolated room YVYD7V. Exact unchanged archive 4cece048191bcf1ba37cd78fcf9fc49cf6a6890e2ced45a06dffc3aa5c27adae: DM upload/player exact-version activation/UI learning/great-tree form choice/map cast/one slot spent/10temporary HP/Host enemy-only grounded terrain/identical DM and player effects plus map areas, zero page errors. Private fullbook-guardian-room-audit-20260927.json records evidence. All tracked processes terminal; goal remains active. Next: remaining source lifecycle/recast and unverified or blocked inventory entries; 30structural-ready/125blocked is not a whole-book success claim.

### Temporary skill expertise contract and source conversion failure evidence

- Previous goal turn classified as progress: two real choice-targeting fixes and successful isolated Guardian room acceptance. Rechecked current inventory and source. Skill Empowerment's old willingness blocker is obsolete, but temporary expertise and exact skill qualification were real generic gaps.
- Added public Effect modifier skill-expertise with strict system-skill validation, runtime persistence/normalization, mechanical projection, handler registration and nonstacking Host proficiency rank. Only already-proficient skills become rank2; no free proficiency. Rank uses current target proficiency bonus; suppression and removal restore ordinary rank. Added skill-proficiency predicate (subject, skill, exact rank0/1/2), Host snapshots in registered/compiled paths, fail-closed missing snapshot, validation and readable label. Updated ordinary checks, rogue skill actions, compiled Activity skill checks, triggered opposed-check choice and character-facing skill modifier calculation to read current expertise.
- Permanent dnd5eSkillExpertiseContract test covers public Activity execution, qualification/recast rejection, no proficiency grant, current PB changes, existing expertise nonstacking, strict persisted selector, suppression, application-turn boundary then expiry. checks.test adds character-facing stealth and camelCase sleightOfHand coverage. Initial validation insertion was placed in the wrong function; test caught missing rejection and it was moved. Initial expiry fixture omitted the documented application-turn convention; corrected with explicit still-active assertion. Character fixture initially omitted required targetId/label and was corrected. Final fullbook-skill-expertise-complete.log:3files22tests passed. Earlier typechecks85099 and51062 exit0; final71002 running in fullbook-skill-expertise-complete-typecheck.log after all runtime routes and tests.
- Source-driven fullbook-skill-empowerment-convert-20260927 used its full2-call cap, 88,529input/2,361output. Both returned, conversion5004exit0 but entry ready=false. First candidate retained manual skill selection; second was rejected for empty outcomes. No hand edits. Known cumulative32,588,227input/1,700,360output,1168knowncalls+6unknown-usage calls. These failed attempts are not automated acceptance or a ready-count increase.
- Inspected actual saved request payloads: new contract names present but temporary expertise instructions absent. The paragraph had been placed in featureGuide, omitted from spell prompts. Moved it plus the actual skill catalog/closed choice-outcome mapping into coreGuide. New SDK guide regression verifies the actual spell prompt contains the paragraph, predicate, camelCase skill and static-branch guidance. fullbook-skill-guide.log passed. Preserve capped failure; next automatic feedback repair must use the corrected prompt, then export/reimport and verify willingness, skill eligibility, actual checks and lifetime before any source certification. No browser/user-room edits or additional calls this turn. Goal active.
- Final runtime typecheck71002 exit0. One capped source repair after the verified prompt fix (85559exit0, fullbook-skill-guide-repair-20260927) used45,231input/3,725output. Cumulative known32,633,458input/1,704,085output,1169knowncalls+6unknown-usage calls. It generated concrete skill choices/effects but failed ID validation for camelCase skill keys used as option IDs (options1and15). Original2-call failure preserved and this one-call run preserved; neither is certified. Corrected production catalog guidance to distinguish canonical camelCase skill keys from lowercase-kebab option/effect IDs and supplied explicit optionId mappings. Next: recheck the failed draft/reference mapping and run bounded automatic feedback under the corrected guide, no manual content edits. All tracked processes terminal. Goal active; current31-style promotion is not justified, existing structural count30/125 remains last verified count. Character/Activity routes updated this turn; monster planner estimates still warrant inspection before broad all-entry claims.

### Skill Empowerment source conversion and creature-target authority

- The one-call production feedback repair in fullbook-skill-id-repair-20260927 passed structural/source gates without manual draft edits. Usage:48,179 input/3,541 output; cumulative known32,681,637 input/1,707,626 output across1170knowncalls plus6unknown-usage calls. The guide now separates lowercase option IDs from canonical camelCase skill keys.
- Exported and reimported exact archive SHA256e1a63bd9365be9bf15853a13834b3eeba16e089e3a2cfeaf42b2f2fe43425309, preserved privately under verified-artifacts. Generated facade exercises all18skills, actual target-level proficiency bonus, consent-before-cost, concentration failure,600countedround expiry, untrained/existing-expertise rejection and touch range. fullbook-skill-behavior.log passed. This is not whole-book certification.
- Isolated browser84391 failed on a test-only Chinese label mismatch; corrected fixture. Browser10810 in roomQSUEZM exposed a real Host invalid-target rejection for an Activity explicitly allowing self. Import/learn/prepare already succeeded; no consent or effect was applied and no slot was consumed.
- Fixed generic creature target checks in pluginSpellTransaction to use the choice-resolved/scaled Activity contract, with legacy metadata only as fallback. Six permanent cases verify explicit self inclusion/exclusion and enemy/ally relations against deliberately conflicting legacy metadata. Full transaction suite115tests passed. Exact saved browser request replay also passed, including refusal-before-cost and accepted self-target expertise. Typecheck37856 remains running at this checkpoint; next step is exact-archive browser acceptance. No changes to user5273/5274 rooms.
- Final typecheck37856exit0. Exact-archive browser74387exit0,1passed(1.3m),roomN875X8. Verified DM upload/player activation, UI learning and preparation, skill choice, self target, owner willingness, no pre-consent cost, exactly one slot afterward, identical effects and skill modifier10 on both clients. No page errors. Audit stored privately as fullbook-skill-room-audit-20260927.json. Goal still active; this certifies only the stated Skill Empowerment path, not all155entries.

### Distinct-target chains, mixed-dice packets and imported continuation controls

- Added continuation.maximumSteps:"distinct-targets" with required exclusion and Host-derived remaining target count. Every stage must add new real targets; empty/duplicate/replayed/expired requests and changes to the root bound mode are rejected. The chain has no invented64-target rules cap. Numeric limits retain2..64validation. Permanent tests settle71distinct targets through the authority, serialize between steps and reject duplicate/out-of-range/forged attempts. Four related suites30tests passed; typecheck13315exit0.
- Automatic source conversion fullbook-chaos-distinct-repair-20260927 used onecall46,295input/2,479output. It passed structural gates but the exact exported archive04e14d9a8982c6ff7a14885aaadb1ec47a26ebb6c98d40dfe9b7a41c88215017 failed actual resistance settlement:6same-type damage was split into two3-point operations and halved separately, dealing2instead of3. Preserved failed artifact/report and source-behavior-audit.json. Added narrow source guards for the explicit rolled-type2d8+1d6clause, preserving one damage packet, live ranged attack mode and legal self selection. This is not general semantic certification.
- Production guide explains mixed formula ordering for scaling, natural target bounds, fresh versus carried dice, and numeric zero-based dice-choice IDs. The next capped repair used47,229input/2,068output but named its index choices first-d8/second-d8; validator now reports the required zero-based IDs explicitly. A further onecall47,000input/1,858output corrected IDs but omitted the required legacy base damageType. Original outputs and failures remain intact. Cumulative known usage32,822,161input/1,714,031output,1173knowncalls plus6unknown-usage calls.
- Added production syntax normalization for an omitted base damageType only when a valid explicit damageTypeFromRoll table already determines the result. It copies a declared type without changing actual mapped resolution, records the normalization assumption, does not change explicit values or unsupported notes, and leaves malformed mappings rejected. Actual tests confirm the selected type overrides the base and absent/invalid dice or choices fail rather than using a fallback. Final normalization/rolled-choice suites38tests passed. Typechecks52139and76743exit0 (before the later registration change).
- Revalidated the exact saved AI output through production normalization without another API call or manual rule edits. Run fullbook-chaos-normalized-20260927 records originalDraft and itsSHA256 plus normalized assumptions. Exported archiveSHA256b117710d6b4ccb061be6377aabd5e03a55f9030c5db4b83f0dbf324ac9990b75 is preserved under private verified-artifacts.
- Actual archive testing exposed a second runtime issue: imported continuation Activities were reachable in the schema but absent from the native Headless registry. Extended effect-backed control registration to include nextActivityId and finishActivityId. A permanent imported-package regression checks both registrations and rejects a forged effect grant without a live continuation receipt.
- Exact normalized archive facade now passes single-packet resistance, normal/miss/critical attacks, third-level scaling, matching-dice continuation, fresh followup dice, a target140feet from caster but20feet from previous target, no second spell slot, duplicate/far/replay rejection and turn expiry. The previous registry failure is retained in fullbook-chaos-continuation-registration.log. No spell-specific runtime dispatch or authored archive edits. Browser acceptance is next; typecheck84096 and consolidated refresh3323 running at this checkpoint. User5273/5274 untouched; goal remains active.
- Typecheck84096exit0. Consolidated refresh3323exit0 found32structural-ready/123blocked. Stronger refresh80579alsoexit0 with32/123 after supplying verified source metadata and class reference to the current public preflight. All155inventory entries remain accounted for; these counts do not confer behavior certification.
- Exact Chaos archive browser47091exit0,1passed(1.7m),roomBGV7A2. DM upload/player activation, sorcerer learning through UI, first cast, both rolled-type choices, continuation button and actual map target click, fresh followup roll, one slot total, and both-client HP57/57 synchronization passed. No page errors. This harness substitutes the3D dice frame and deterministic dice; it is not animation acceptance. Unconditional Math.random caused test-only Konva color warnings; removed that override for the followup harness while retaining deterministic dice via crypto.
- Added fresh source context to public PDF preflight. Browser cache restore, check and continue paths now recheck source constraints, level, concentration and class-directory inclusion instead of trusting a prior structural status. Export reports accept original source context and record fresh per-entry sourcePreflight, sourcePreflightCount and warnings; incomplete/reference exports remain possible and neither behaviorVerified nor sourceCoverageVerified is promoted. Two suites21tests passed; source-report typecheck56978exit0.
- Natural distinct-target chains now close when no unused creature remains within the declared jump distance, removing the stale continuation control. Permanent range test plus existing continuation/import tests17passed. Final typecheck17711 running; next isolated browser run will additionally assert the exhausted continuation button disappears. No user rooms changed; goal remains active.
- Final typecheck17711exit0. Browser5733exit0,1passed(1.6m),freshroomUT5NHU using the same b117710d... archive and the final runtime. It repeated both real UI actions/roll choices and both-client HP synchronization, and additionally proved the continuation button disappears when no unused target is in jump range. No page errors or test-induced Konva color warnings; only existing layer-count warnings. All tracked processes are terminal at this checkpoint. Full-book goal remains active with32current-preflight-ready/123blocked, not complete.

### Generated Invulnerability and source material gates

- Initial one-call conversion fullbook-invulnerability-repair-20260927 used45,846input/1,482output. It composed all13immunities but omitted an executable reagent recipe. Actual Host component check with the source-required500gp ingredient returned unsupported-costly-material. The original candidate and failed material-behavior.json remain preserved; structural readiness was insufficient.
- Public preflight now rejects costly/consumed materials without executable inventory recipes, including missing fallback recipes for conditional options. Source metadata additionally checks explicit single flat component prices and exact duration units; ambiguous per-target/per-level prices are not guessed. Current cache restore and export report paths already use this shared preflight. SDK guide explains recipes, price aggregation, consumed flags and six-second rounds.
- One capped production feedback repair fullbook-invulnerability-material-repair-20260927 used46,218input/1,351output, without hand-editing the generated configuration. Cumulative known usage32,914,225input/1,716,864output across1175knowncalls plus6unknown-usage calls. New candidate passed source/preflight gates. Four permanent suites54tests passed, typecheck31720exit0.
- Exact exported/reimported archiveSHA256dd74dc979e0c667c74cdb6f641c61f47ba0eb0e44ebf4aa31a65c9da373964d0 passed actual spell facade: missing/wrong-kind/underpriced ingredients reject before spending; one9thslot and one500gp ingredient consumed; all13damage types immune; all13resume damage after concentration ends; immunity expires after100countedround boundaries. Source-derived reagent fixture uses the generated explicit ingredient tag; no module configuration edits. Artifact preserved under private verified-artifacts. Browser acceptance is next. Full-book goal remains active, with no claim that these results certify the remaining entries.
- Exact immunity archive browser43471exit0,1passed(1.1m),freshroomBMV7DK. Verified DM upload/player exact-version activation, UI learning and preparation, hotbar self-cast, one9thslot and source-required ingredient consumed, and all13immunity effects plus inventory identical on both clients. No page errors; only existing Konva layer-count warnings. Audit fullbook-invulnerability-room-audit-20260927.json preserved privately. User5273/5274 untouched; goal remains active.

### Incoming weapon attack filters and remaining Wind conversion gaps

- Added public Effect modifier weapon-attacks-against-target with advantage/disadvantage and optional melee/ranged delivery. The Host uses the actual attack category and delivery, so thrown weapons are ranged but weapon-delivered spell attacks are excluded. Repeated entries survive serialization; invalid delivery rejects at public and stored-state boundaries. Antimagic suspension and expiry remove the modifier normally.
- Wired native weapon/unarmed/opportunity resolution, monster actual attacks and monster preview. A followup inspection also found the player equipment preview needed the same contextual target flags; it now requests the correct dice before settlement. Imported-package execution, melee/ranged/spell matrix, native spell exclusion, storage, suspension and expiry tests passed; monster preview/commit tests passed. Five suites120tests and equipment preview50tests passed; final focused two suites53tests passed. Typecheck28499exit0 before the final player-preview edit; final typecheck52420 is running.
- Automatic Wind conversion fullbook-wind-defense-repair-20260927 used onecall51,921input/1,876output. Cumulative known32,966,146input/1,718,740output across1176knowncalls plus6unknown-usage calls. Generated config uses the new defensive modifier and60ft flight correctly without manual edits. It remains blocked: ambiguous translated15cubic-feet area, missing granted followup control, and a claimed unsupported flight-ending fall. Existing generic airborne machinery suggests the last claim needs behavior verification rather than a new spell-specific handler. No claim of full Wind automation or whole-book completion.
- Current consolidated source/material preflight after immunity acceptance is33ready/122blocked, all155inventory entries accounted for. This is structural/source readiness only; no blanket behavior certificate. Last browser run remains the passing immunity archive in freshroomBMV7DK. No user5273/5274 rooms changed.
- Final typecheck52420exit0. Exact automatically generated partial Wind archive then passed root spell facade,60ft flight, weapon-only ranged disadvantage, atomic3d6fall after concentration loss, and preservation of independent40ft native flight. Partial audit deliberately retains behaviorVerified:false/fullSpellCertified:false and all unverified gust issues; this does not certify the whole spell. SDK guidance now describes existing automatic fall handling rather than inventing an unconditional damage callback.
- Source clarification research: D&D Beyond primary legacy Investiture of Wind page https://www.dndbeyond.com/spells/2389-investiture-of-wind specifies a15-foot cube. This resolves the PDF translation's ambiguous15cubic-feet wording as edge length15ft. The correction has NOT been silently applied to the PDF or generated draft. Further conversion must preserve this external reference and distinguish supplemented-source validation from PDF-only automatic conversion. Remaining gust work includes proper granted control and pushing from the area center, not necessarily from the caster.
- Flight guide regression passed after final typecheck; no contract/runtime edits after52420. No tracked processes are live. Next bounded task: expose source/area-centered push/pull origin generically through Activity move, Host map handoffs and all three map UI planning paths. Existing directionOriginCell supports persistent area grants, but instantaneous area actions still default to caster and their areaSelection is currently omitted unless persistent/map-object handoffs exist. Preserve existing actor-origin defaults and final Host placement rejection; include even-sized grid rectangle center and source-independent center tests. Whole-book goal remains active.

### User-directed workflow change: local implementation first, paid conversion later

2026-09-27: The user explicitly asked to stop calling the API immediately after each individual fix. Follow `2026-09-27-fullbook-batch-workflow.md`: inventory all remaining gaps by shared mechanism, reuse saved source/drafts, implement and run local regression first, align the SDK and conversion guide, then conduct a concentrated conversion/acceptance phase. A single completed spell or mechanism is not sufficient to start another paid repair call. Do not restore the former per-spell conversion loop after context compaction. No API calls were made for this workflow change; known cumulative usage remains32,966,146input/1,718,740output across1176knowncalls plus6unknown-usage calls.

The latest local inventory contains807distinct issue strings across122blocked entries, including repeated generic manual-operation and reachability findings. These strings are not807independent engine gaps; deduplicate by mechanism and check stale unsupported claims locally before deciding what to implement. Original full-book goal stays active. Existing rooms and source-generated artifacts remain unchanged.

### Local batch implementation: inventory and centered movement

- Added the offline `scripts/audit-fullbook-mechanism-backlog.mjs` inventory builder and two passing Node tests. Private report `fullbook-mechanism-backlog-20260927-r1.json` accounts for all155entries,33ready/122blocked,807distinct diagnostics and913entry links. Keyword mechanism routing remains explicitly unreviewed; it does not certify support or classify narrative exclusions. Outputs are exclusive-create and original generated artifacts remain unchanged.
- Added public `move.directionOrigin: actor | area-center` to the Activity contract, executor projection, validation and final Host map placement. Region centers use the declared full volume, including even-size grid rectangles; actor-distance limits remain measured from the actor. Missing area placement fails Host validation. Connected all three map planning paths and retained instantaneous area selection for directional movement. Explicit actor origin and omitted-field legacy grant origin remain distinct.
- Updated SDK and conversion guidance. Local map/validation/guide suites passed74tests, including area-center push toward the caster, rejection of the opposite direction, missing-area rejection, even-grid center and legacy behavior. These are authored local mechanism tests, not automatic conversion or full-book acceptance. Typecheck41320 was launched after runtime edits; completion pending at this checkpoint.
- This batch made zero paid API calls. No browser room was started or user5273/5274 changed. Continue shared mechanism implementation before any concentrated paid validation; full-book goal remains active.
- Typecheck41320 caught a readonly-array mutation in the new validation test only. Replaced the entire operation array; validation suite13tests passed again. Final typecheck15607exit0. All tracked checks are terminal; no paid conversion was attempted.

### Offline gap review: distinct teleport destination

- Previous goal turn made concrete progress (centered movement, inventory, tests), not a wait-only or blocked turn. Rechecked the current backlog and implementation before selecting the next gap.
- Added public `move.requiresDifferentDestination: true`, restricted to teleport. The executor carries it into Host handoffs; live map validation rejects a zero-distance destination. Candidate cell generation excludes the source and occupied cells, and all three map interaction paths use the candidate helper for this requirement. Legacy omitted-field behavior remains unchanged. SDK and AI guide updated without an API call.
- Local map/validation/guide suites76tests passed. New cases cover unchanged-position rejection, legal alternate placement, occupied destination, an occupant arriving after candidate generation, and backwards compatibility. Typecheck29472 was launched after runtime/UI edits; completion pending at this checkpoint.
- Private review `fullbook-mechanism-review-20260927-r1.json` links two exact diagnostic hashes (area-centered pull and distinct shadow teleport) to runtime/test evidence. These are mechanism-level reviews only: existing generated configurations still require regeneration, and neither spell nor full-book behavior certification was granted. No source artifact or user room was modified. Added paid calls:0.
- Final typecheck29472exit0; no tracked process remains live. Next batch should continue unresolved source-linked lifecycle and contextual checks from the backlog, retaining the no-paid-conversion development gate. Goal remains active.

### Offline lifecycle batch: incapacity without a speech requirement

- Rechecked backlog lifecycle diagnostics and the actual continuous source-link resolver. Existing `sourceMustBeConsciousAndAbleToSpeak` conflated two distinct requirements. Added `Effect.sourceLink.sourceMustNotBeIncapacitated: true` across public contract, validation, persisted active-effect normalization and continuous Host reconciliation. Executor/Host source-link projection already preserves all declared fields via spreads. Source-death and authored action-cost dismissal remain separate mechanisms; no concentration requirement was invented.
- Regression cases exercise source incapacitated/stunned/paralyzed/unconscious/petrified conditions, emitted removal event and cleanup, speech prohibition without incapacity, JSON round-trip and rejection of malformed flag values. Initial five assertions expected an empty array where existing cleanup returns undefined; corrected assertions to accept the canonical absence of effects. No runtime failure was hidden.
- Headless engine, validation and guide suites323tests passed. Added standalone public-contract validation case afterward; validation suite15tests passed. Typecheck25111 is pending at this checkpoint. SDK documentation and conversion guidance describe the difference between speech and incapacity.
- Paid API calls0; no generated spell artifact or existing room changed. These tests verify a shared lifecycle primitive, not complete automation of any source option or the full book. Next inspected gap: shared `ACTIVE_EFFECT_BREAK_TRIGGERS` lacks a forcing-another-creature-to-save event; provenance must be traced through saving-throw resolution before adding it, so self saves or unrelated environmental saves cannot break the wrong actor's effect.
- Typecheck25111 caught widened string literals in the new parameterized condition test; changed its condition array to `as const`. Final typecheck61630exit0. All tracked checks are terminal. Further inspection confirmed the `saving-throw-resolved` event currently lacks source identity; do not infer the forcing actor from the current action's actor (reactions/environment/ongoing saves can differ). Goal remains active, paid conversion gate remains closed.

### Offline lifecycle batch: forcing another creature to save

- Added shared/persisted `forces-saving-throw` break trigger and optional authoritative `saving-throw-resolved.sourceId`. Compiler-produced saves attribute the Activity actor. Root transaction cleanup only removes preexisting effects of that source, excludes self saves and condition-immunity automatic success, and never guesses missing provenance.
- Actual direct Activity acceptance initially showed no saving-throw event at all: `commitDnd5eActivityExecution` only emitted opposed/ability-check events. Added saving-throw events from resolved checks and matching source-effect cleanup at successful direct commit. This closes a real event-dispatch gap rather than assuming compiler coverage suffices.
- Persistent-area resolution now records its source and applies the same preexisting/self-save rule after validation succeeds. Tests exercise both direct and installed/compiled Activity execution, invalid dice without source mutation, self versus other target, preservation of newly granted effects and saving target effects, plus persistent-area attribution. Fixture corrections were necessary for the public armor-class formula and compiled transport's required distance/modifier/total fields; these did not bypass validation.
- Five related suites401tests passed (Activity combat, authority bridge, Headless engine, validation, SDK guide). Typecheck45726 pending. Added API calls0; no source-generated artifact or user room changed.
- Coverage is explicitly partial across older native events, documented in SDK guidance. Next batch: annotate known native sources and ongoing saves from their owning effect, not from action.actorId. Inspected sites include spell event around7078(actor), periodic event around7769(effect/source context), repeat-effect event around7992(effect.source.actorId), damage-repeat save around37549(effect source). Audit provenance and direct exported settlement paths before claiming full lifecycle coverage.
- Typecheck45726 found the missing new lifecycle label in `Dnd5eActiveEffectDetailsDialog`; added Chinese text there and in combat log reason labels. Final typecheck73588 pending. No runtime changes after the401-test regression result.
- Final typecheck73588exit0; all tracked checks terminal. Whole-book goal remains active; do not regenerate paid configurations until the planned shared mechanisms have converged.

### Offline provenance batch: native and recurring saves

- Inspected every `saving-throw-resolved` construction in the engine and the other production emitters. Annotated40old engine emissions and the legacy declarative plugin compiler with their actual local source: spell/monster/feature actor, reaction owner, stored effect source, movement requirement source, or swallowed creature whose tracked internal damage caused regurgitation. Undead Fortitude is explicitly self-originated. The legacy item-area command has no authenticated creator identity and remains unattributed with an explanatory comment.
- Sanctuary source attribution now comes from the ward's stored caster. Tranquility/Nature Sanctuary use the feature owner. Never substitute the ward bearer or attacking/current-turn actor for a third-party caster.
- New actual Headless tests cover repeat saves from another creature, self-originated and unattributed repeated saves, and a failed Sanctuary targeting save involving a distinct caster/bearer/attacker. Source-only effect removal, other actors' effect preservation, and original state nonmutation passed. Five suites388tests passed (Headless, monster advanced abilities, monster attack-effect authority, Activity combat and authority bridge). Typecheck34353 pending at this checkpoint.
- Newly found remaining semantic issue: `move` returns failure `movement-boundary-save-failed` after a real save, causing root rollback to discard the roll/effect lifecycle. Do not simply return ok:true: MapsWorkspacePage's monster move path builds a fallback movement trace from the requested destination when traces are absent. Next batch must preserve settled saves and resource effects while explicitly representing blocked movement, and ensure player/monster map applications do not animate or apply the forbidden destination. Existing user-facing failure text is in useMapsPlayerActionTransport. Investigate playerMoveAction/monsterMoveAction and their wrappers together.
- Documentation now reflects native/recurring source coverage while retaining the unowned item-area and failed-movement caveats. Added paid calls0. No generated artifact or user5273/5274 room changed; goal remains active.
- Typecheck34353 caught a wrong local identifier in the newly annotated death-area save (`actor` instead of the actual exploding `source`). Corrected provenance to `source.id`; death-area runtime and catalog suites14tests passed. Final typecheck76859 pending. This additional branch was not covered by the initial388-test batch.
- Final typecheck76859exit0; all tracked checks terminal. Next bounded work is the failed movement-save commit/map boundary described above; no paid API requests until the shared-mechanism batch has converged.

### Offline movement batch: committed failed save without displacement

- Headless now distinguishes a committed movement save failure (`ok:true`, `movementBlocked:saving-throw`) from an invalid request. All supplied boundary saves resolve, ordinary movement validity/cost checks still run, and blocked results return before movement spending, standing or displacement. Root transaction lifecycle retains actual saving-throw events, consumed inspiration and forcing-source effect removal. Invalid dice continue to roll back atomically.
- Monster map adaptation returns zero distance, an empty movement trace/door list and an application of the settled rules state before any carried-token projection. Existing prior dash/disengage events remain committed. Player adaptation restores tentatively removed automatic-escape constraints when movement is blocked and emits no escaped event.
- Player UI applies the settled rules result and ACKs the actual old position before hazards, path animation, fog exploration or movement spending. Manual and legendary monster paths skip opportunity attacks for blocked movement; manual drag preview stays at the original point. Monster logs describe the blocked save rather than claiming movement.
- Three suites368tests passed. Extended the existing automatic escape test afterward to prove a blocked move restores grapple, preserves movement and produces no escape event; that focused test passed. Core checks also verify failed saves consume used Bardic Inspiration, remove the forcing source's break-on-save effect and keep both coordinates/movement intact; invalid d20 preserves the resource and original snapshot.
- Typecheck50429 caught TypeScript narrowing lost inside the async manual-monster closure. Captured the narrowed blocked flag before the closure; final typecheck66426 pending. Browser integration remains unverified and is reserved for concentrated acceptance. Added paid API calls0, no original generated config or user5273/5274 room changed. Full-book goal remains active.
- Final typecheck66426exit0; all tracked checks terminal. Last inspection found one additional coupled cost to address next: monsterMoveAction pre-spends `interact-object` for an auto-opened door before resolving the move. The new blocked branch correctly returns doorsToOpen:[] but currently carries that interaction cost/event. Defer or restore only the unperformed door interaction without undoing actually used save resources or explicitly chosen Dash/Disengage. Add a blocked-door regression before considering this boundary complete. Do not claim full blocked-path acceptance yet.

### Offline movement batch: unperformed automatic door interaction

- Blocked monster movement now restores the original free-object interaction availability and removes only the unperformed automatic door interaction events. Settled saves and explicitly chosen Dash/Disengage remain committed; no door is returned for opening.
- Monster map movement suite20tests passed, including blocked movement with/without a door, a door plus Dash (action spent, movement allowance retained), and existing successful door traversal. No paid API calls or user-room changes. Browser acceptance remains deferred to the concentrated batch.
- Final typecheck83746exit0. All checks from this batch are terminal; whole-book automation remains in progress and the paid conversion gate remains closed.

### Offline area lifecycle batch: source incapacity

- Backlog diagnostic e169d4b96c7a45e1867b07a36f9957eb88a8e4cc2f78346298a46c978761ff5e includes an area ending when its source becomes incapacitated. The prior Effect.sourceLink implementation does not cover map entities. Added separate create-persistent-area.sourceIncapacitatedBehavior:remove-area across public contracts, validation, executor proposal, Host map handoff, map migration and authoring UI; conversion guidance and SDK describe the precise scope.
- Reconciliation checks authoritative character conditions/active effects for player sources and Token rules state for monster sources, including the legacy stunnedByActorId state. It handles incapacitated/stunned/paralyzed/unconscious/petrified, preserves ordinary restraint/deafness, respects linked character state over stale Token projections, and does not infer incapacity from missing source data. Permanent areas can end this way without inventing concentration. Existing map reconciliation removes owned projection Tokens and preserves unrelated areas/Tokens.
- Initial local test incorrectly constructed a mechanical effect with an unsupported conditions field; changed the fixture to the actual createDnd5eConditionEffect factory. Six suites218tests then passed (areas, Activity executor, map handoff, validation, map migration, SDK guide). Typecheck67274 pending. DM integration inspection confirms the existing effect watches characters/maps and persists authoritative reconciled maps; live browser acceptance remains deferred.
- This is partial mechanism coverage of the original diagnostic: active dismissal and other full-option requirements still require separate evidence. No original source-generated configuration modified, no user room touched, paid API calls0. Goal remains active.
- Follow-up code inspection confirms active area dismissal is a real remaining gap: detonate-granting-area handoff at dnd5eActivityMapInteraction requires an on-detonate trigger, so it cannot serve as a generic dismiss operation. Do not generate fake detonation triggers to bypass this requirement. Next area lifecycle work should introduce/verify an owner-and-grant-authorized removal path, correct action cost, projection cleanup and stale/replayed-request rejection.
- Typecheck67274 identified a character/Token combat-state union access: only Token combat state has the legacy conditions array. Narrowed that fallback through sourceToken.dnd5eCombatState; character conditions continue coming from the sheet. Final typecheck79264 pending.
- Final typecheck79264exit0. All tracked checks terminal; paid conversion remains deferred and whole-book goal active.

### Offline area lifecycle batch: authorized active dismissal

- Added dismiss-granting-area as a distinct public Activity operation, executor proposal, installed/compiler and direct Headless handoff, mechanics registration, validation and editor option. Host map settlement checks the live granting area, package, source character/Token and granted Activity, then removes the area without running detonation. Only its own unshared projection Token is removed; endedAreaIds reuses the existing final-area concentration cleanup in the player feature transaction.
- Added dedicated local behavior tests for saved permanent non-concentration areas, projection and unrelated-area preservation, package/source/grant violations, stale/replayed area requests, exact-spell concentration cleanup, installed and direct bonus-action consumption, and Host preparation from a real persistent-area entitlement (no permanently selected feature). After dismissal the same preparation is rejected before settlement. Initial assertion omitted the executor's logTrigger metadata; changed it to structural matching without changing production behavior.
- Six suites120tests passed (dismissal, shrink, validation, map handoff, player feature authority and SDK guide). Typecheck launched after this batch; outcome recorded below. Conversion guidance explicitly distinguishes dismissal from detonation and requires authored activation plus consumption. Paid API calls0, no generated source configuration or user5273/5274 room modified. Browser acceptance remains deferred; this does not certify a full source option.
- Follow-up inspection: persistentAreaGrantForAction currently runs only for linked character actors; DM monster sources receive a synthetic actor for active-effect grants but not persistent-area grants. Map dismissal itself supports Token ownership, yet a complete monster area-control route remains to be checked rather than claimed from map-only tests.
- Final typecheck91492exit0. All tracked checks terminal; paid API calls remain0 and full-book goal remains active.

### Offline monster area controls: authorization and self-target UI

- Removed the linked-character-only restriction on persistent-area grants. Ownership now derives from the actual Token/character association, never the synthetic dm-token request identity. Existing DM-only unlinked actor admission remains intact. Actual preparation and settlement tests cover captured DC/cast level, bonus-action spending, empty Character application, area dismissal, stale grants, foreign owners/packages and rejected player impersonation.
- Inspection found a second gap: monster control projection and its UI callback only handled active-effect IDs. Shared area-control projection now feeds the monster panel and self controls submit persistentAreaId. Buttons use per-control action/bonus-action/reaction availability instead of disabling every control after the action is spent. Existing creature controls with natural source targets remain intact; arbitrary creature/area target selection for monster area controls is still unimplemented and explicitly documented.
- Four suites65tests passed (dismissal, plugin feature authority, control projection, monster panel). Initial new UI fixture needed a registered Headless action to satisfy full-automation validation; initial rendered-button assertion confused a CSS disabled variant with an actual disabled attribute. Both fixtures corrected; no failing production behavior hidden. Final typecheck outcome to follow. No paid API calls, generated source artifacts or user rooms changed.
- Typecheck96426 found the guarded UI payload still had an optional activeEffectId in its inferred JSON type; made the already-checked non-null branch explicit. Further inspection locates remaining targeting in useMapActionTargetingState and the character-only sendPlayerDnd5ePluginActionRequest route. A monster implementation must carry a real actorTokenId and DM source through both preview and submission, not spoof a Character ID. Final typecheck rerun pending.
- Final typecheck33972exit0. All tracked processes terminal. Full-book goal stays active; new paid API calls0.

### Offline monster targeting: map interaction wiring

- Targeting sessions now carry optional explicit DM actor identity (real Token ID plus map ID). A shared resolver rejects stale maps, removed actors, obstacle Tokens and character-linked substitutes, with no fallback to the active player. Area preview/cell selection and creature selection use this resolver; player sessions keep their character lookup.
- Monster granted controls now resolve declared choices, dispatch self/fixed-counterparty actions directly, or enter existing creature/area map targeting. A single DM submission branch carries actor identity, targets, area cell/orientation and choices into the existing authoritative transaction. DM admission, pending action and active-turn checks stay at submission; Headless still validates grants, range and costs. Panel buttons no longer require a predetermined target to start selection. Effect-granted area controls must enter area targeting even when their sourceActorTokenId exists (fixed source shortcut is creature-only).
- Five local suites72tests passed (targeting identity, monster panel, area dismissal, plugin feature authority, granted-control projection). Coverage includes actor/map identity and rendered button availability; it does not simulate the complete workspace click interaction. Browser/double-client validation remains deferred. Typecheck10894 launched; outcome recorded below. Paid API calls0; no source-generated configuration or existing room modified.
- Final typecheck10894exit0. All tracked checks terminal. Next local acceptance should exercise monster creature-target settlement and empty-ground area handoff with these exact request fields, before the concentrated browser batch. Full-book goal remains active.

### Offline monster area execution: concrete targets and range-origin consistency

- Added registered-content Host workflow tests using the same DM request fields as the new UI: real monster Token, synthetic request character identity, persistent area ID, target Token or empty target list/cell/orientation. Creature damage resolves from area distance and updates only the selected monster. Empty-ground reshape spends the bonus action, relocates the area/projection and preserves caster position without inventing a Character row.
- Initial reshape fixture omitted the existing target.rangeOrigin:granting-area declaration, exposing inconsistent behavior: feature preparation unconditionally used the granting area while the canonical map selector used the declared/default actor origin. Fixed preparation and workspace preview to obey declared rangeOrigin. Explicit/default actor range rejects this distant anchor; granting-area range accepts it. Legacy non-Activity feature templates retain prior behavior. Missing area origins no longer fall back to actor preview. Sight remains actor-based.
- Added negative cases for far creature targets and explicit/default actor-origin area placement, including source snapshot nonmutation. Four suites84tests passed (new actual monster settlement, feature authority, map handoff, targeting identity). SDK and conversion guide now distinguish creature range from point-template range and describe reshape displacement limits. Paid API calls0; browser acceptance remains deferred. Typecheck outcome follows.
- Final typecheck52286exit0. Wrote private fullbook-mechanism-review-20260927-r2.json using exclusive creation, preserving both prior reviews and adding exact diagnostic e169d4b96c7a45e1867b07a36f9957eb88a8e4cc2f78346298a46c978761ff5e as expressible-by-current-runtime. Original source-generated configuration still requires regeneration; behaviorVerified/fullBookCertified remain false. This records only the lifecycle gap, not full source-option acceptance. All tracked checks terminal; full-book goal remains active.

### Offline social-mechanism batch: shared known language

- Backlog items28b4639e/662e9654/6d9b87b4 include common-language requirements. Added shared-language predicate to public Effect/Activity contract, validation, executor, capability registry and readable log labels. Both execution routes use existing Host language snapshots, not player payload facts. Hearing remains a separate can-hear-source requirement.
- Added a dedicated exact-language normalizer: common Chinese/English aliases, case and delimited lists, named custom languages and explicit all-languages facts; Undercommon never matches Common by substring. Missing data, unspecified any-language choices, placeholders and descriptive language prose do not establish shared language. This intentionally does not reinterpret temporary magical understanding as learned language; unparsed stat-block prose still needs structured source data.
- Four suites91tests passed (new language contract through installed and registered Host execution, executor, validation, SDK guide). Tests prove missing/unshared languages and deafness reject without spending actions, matching audible targets receive effects, forged command languages/hearing are ignored, and source states remain unchanged. Initial fixture lacked the plugin distance field and represented deafness without a canonical ActiveEffect; corrected it to the actual request/state contract. Typecheck outcome follows.
- SDK/conversion instructions describe the exact semantic boundary. These multi-clause source diagnostics remain only partially addressed (conversation duration, witnessing and source/ally break rules still need evidence); no source artifact reclassified as accepted. New paid API calls0; user rooms untouched; full-book goal active.
- Final typecheck99363exit0. All tracked checks terminal. Continue offline mechanism batches under the full-book batch workflow; paid conversion remains gated until shared implementation, contracts and local coverage have converged.

### Offline social mechanism batch: current language comprehension

- Added can-understand-source-language as a separate public predicate rather than changing shared-language knowledge semantics. Both Host snapshot builders derive current capabilities from effective ActiveEffects. Known-language overlap, target spoken-language comprehension and source universally intelligible speech can satisfy comprehension; target understanding restrictions and source communication restrictions take precedence. Suspended effects do not apply, and missing source language facts remain insufficient.
- Aligned contract, validation, executor, capability registry, log labels, SDK documentation and conversion guide. Source/target language facts and capabilities are never accepted from player command/payload fields.
- Four local suites103tests passed, covering both actual registered and plugin execution routes, magical grants versus learned language, restrictions overriding grants, suspended grants/restrictions, missing facts, deafness, forged inputs and action-cost rejection. Initial negative fixtures supplied incomplete languageRestriction objects; corrected them to the existing canonical two-field restriction contract (no runtime restriction schema change).
- Hearing and speech production remain separate from linguistic comprehension. Inspection confirms can-hear-source handles sound suppression/deafness, but the Activity predicate contract has no general speech-production condition yet; conversational duration and witnessing likewise remain unresolved. No full source ability reclassified, no paid API conversion, no generated source artifact or user room changed. Typecheck21363 running; terminal result to follow.
- Final typecheck21363exit0. All tracked checks terminal. Existing dnd5eCombatantCanSpeakAudibly covers stat-block speech prohibition and silence, but does not itself include ActiveEffect actionRestriction speech; a future public speaking predicate must combine these authoritative facts rather than alias hearing. Full-book goal remains active and paid conversion remains gated.

### Offline social mechanism batch: speech production

- Added can-speak with an explicit actor/target subject through contract, validation, capability registry, executor and both Host snapshot builders. A shared speech projection combines existing stat-block/silence checks with paralysis, petrification, unconsciousness and effective actionRestriction speech. Incapacitation alone, deafness and attack-only restrictions do not incorrectly prohibit speech. Suspended restrictions do not apply; client canSpeakAudibly fields are ignored.
- Four suites119tests passed, including 15 new real Host route cases and invalid speaking subjects. SDK and conversion guide distinguish speech production, hearing, understanding and learned-language overlap. No source-generated configuration altered or reclassified, API calls0, user rooms untouched. Typecheck38833 running; terminal result below.
- Follow-up inspection: Activity activation supports minute/hour, but completionDelayRounds is a completion compensation input, not evidence of continuous interaction. Existing map long-cast progression advances campaign time atomically and compensates newly created effects; it does not establish uninterrupted private conversation. Do not mark one-minute conversation diagnostics solved merely by setting activation.minute. Duration/interruption/privacy remain open for the next shared mechanism batch.
- Typecheck38833 caught a test-only push into readonly conditions; replaced with immutable assignment. Communication suite43tests passed again; final typecheck4612exit0. All checks terminal. Created private fullbook-social-mechanism-evidence-20260927-r1.json exclusively, mapping the three exact social diagnostics to partial mechanism evidence without declaring any generated source configuration accepted. Full-book goal active; no paid API calls.

### Offline social lifecycle batch: source or ally harmful events

- Added attacked-by-source-or-ally, damaged-by-source-or-ally and forced-save-by-source-or-ally to shared persisted vocabulary, Effect contract, validation and UI labels. Successful root, direct Activity and persistent-area settlement remove matching preexisting bearer effects with canonical cleanup; unknown source, enemy source and zero damage preserve them. Source/ally identity uses Host controller relationship. Condition-immunity automatic saves and self-origin events are excluded. No inference from client payload.
- Actual dual-route tests found the direct Activity commit omitted attack-resolved events although the plugin route emitted them. Added the missing direct event projection from resolved attack checks; missed attacks now produce the expected event and break the selected effect. Other trigger kinds and newly applied effects remain intact; duplicate root/direct cleanup emits a single removal and original snapshots stay unchanged.
- Five local suites376tests passed, including 16 new source/ally lifecycle cases, Activity combat E2E/validation, engine regression and SDK guide. Typecheck73298 running. Paid API0, no generated source option changed or certified, no user room changed.
- Still incomplete: cleanup currently runs at successful transaction boundaries. Native emitDnd5eAttackResolved and apply-damage paths already contain earlier native charm/source-link cleanup points; new triggers need per-occurrence integration and multiattack tests before claiming correct intermediate resolution. Ally-only (excluding source) and witnessed ally harm are also distinct unresolved contracts. SDK/AI guide explicitly preserves these limitations; no source diagnostic closed.
- Typecheck73298 found fixture omissions: required rollMode and an inferred optional undefined dice-table entry. Added explicit normal roll mode and a concrete roll-map type; focused16tests passed again. Final typecheck16836 running. Next timing test can reuse native Owlbear Multiattack fixture at headlessCombatEngine.test.ts (Hunter Multiattack Defense): attach a source-owned AC effect to the target and assert the second attack sees the removed modifier, with failed later rolls rolling back the transaction.
- Final typecheck16836exit0. All tracked checks terminal. Full-book goal remains active; newly added transaction-boundary lifecycle support is partial until intermediate event ordering is implemented and verified. Paid API calls remain0.

### Offline harmful-event ordering: native Multiattack and damage packets

- Added failing-first native Owlbear Multiattack acceptance for attack-triggered and damage-triggered source effects. Both initially observed AC19 on the second attack instead of AC15. Hooked canonical native attack emission and actual damage emission into source/ally cleanup at the event boundary. Second attacks now observe removed AC effects; invalid later damage dice roll back HP and effects for the entire action, with original source snapshots unchanged.
- Strengthened both direct/compiled Activity damage tests to apply two damage packets against a source-owned all-damage resistance. Eligible source/ally damage now applies1 then3 HP damage instead of1 then1; unrelated/enemy sources keep resistance. Fresh effects applied after these packets survive. Focused18tests pass, and four broader suites362tests pass (new ordering, Activity combat E2E, engine regression, conversion guide).
- Updated SDK/AI guide with verified scope and remaining limits: Activity executor resolves its check list before committing outcomes, and compiler currently publishes those checks after execution. Multi-check declarative attack snapshots and intermediate saving throws therefore still need separate sequential semantics; native per-occurrence fixes are not proof of universal multi-stage coverage. No source-generated options reclassified. Paid API0; no user room changed. Typecheck21432 running; terminal result follows.
- Final typecheck21432exit0. All tracked checks terminal. Full-book goal remains active; concentrated paid conversion remains gated on unresolved shared mechanics and complete offline evidence.

### Offline sequential Activity acceptance and effective attack defenses

- Tested existing continuation stages against changing defenses rather than assuming a checks array implies sequential settlement. Failing-first evidence exposed both Host Activity snapshots using base armorClass without effective armor modifiers. Added source-relative attackArmorClasses to Host target projections, computed through the native dnd5eTargetArmorClassForAttack function; executor selects spell versus melee/ranged/default defense per check. Pure executor snapshots without a Host projection retain their explicit armorClass fallback.
- Four direct/plugin continuation cases now verify first-stage miss and effect expiry, second-stage fresh AC, directional cover and ranged cover ignoring, serialization between stages, no second action charge, no bypass before root, rejection of invalid second-stage dice and replay/over-limit requests. Tests use the actual plugin active-effect entitlement for a granted continuation; initial fixture omitted it and initially supplied a noncanonical roll modifier, corrected to the Host contract.
- An initial malformed fixture used outcome.when.kind:check-success. Inspection found validation silently accepted this unknown condition although execution produced no outcome. Tightened outcome validation for unknown kinds, invalid result enums, missing all.conditions and malformed nested entries. Six negative cases now reject rather than silently accepting a no-op. The valid form is kind:check with result:success.
- Six suites137tests passed (source/ally and continuation behavior, Activity E2E, validation, executor, advanced patterns, distinct-target continuation). SDK/conversion guidance now directs dependent sequential attacks into bounded continuation stages and explicitly rejects treating batch checks as equivalent. No manually edited source-generated configuration, no new API calls, no existing room changes. Typecheck38352 running; terminal result follows.
- Final typecheck38352exit0. All tracked checks terminal. Full-book goal remains active. Native sequential actions and explicit continuation stages have evidence; arbitrary check arrays are still simultaneous snapshots and must not be certified as sequential source mechanics without correct conversion.

### Offline social lifecycle batch: allies excluding the source

- Added attacked-by-source-ally, damaged-by-source-ally and forced-save-by-source-ally as distinct persisted/public triggers. Reused canonical event cleanup, but explicit source identity is excluded while other same-controller combatants qualify. Existing source-or-ally behavior remains available. Validation, shared declarations, display labels and SDK/AI guide are aligned.
- Expanded actual direct/plugin matrix to both inclusion policies, all three event kinds plus zero damage, and source/ally/enemy/missing-source relationships. Original source behavior is now explicitly proven not to end ally-only effects; eligible damage still removes resistance between packets, fresh effects survive and inputs remain unchanged. Five suites404tests passed. Typecheck13690 running; no paid API calls, no generated source config edits and no room changes.
- Next witness audit found an exported dnd5eCombatantCanSee backed by conditions, senses and directional line-of-sight facts. Native Calm Emotions damage cleanup currently loops same-controller witnesses without a sight check; it is not suitable evidence that general witness-trigger support already exists. Witness scope, visibility at event time and same-transaction effect provenance must be tested separately before closing the social-source diagnostics.
- Typecheck13690 found an unused former test trigger list after parameterizing both policies; removed that declaration only. Final typecheck2886 running. Exclusively created private fullbook-social-mechanism-evidence-20260927-r2.json, preserving r1 and marking all original source options uncertified while listing new lifecycle and sequential primitive evidence. Paid API calls0.
- Final typecheck2886exit0. All tracked checks terminal. Full-book goal remains active; witness and sustained interaction mechanisms remain unresolved.

### Offline social lifecycle batch: witnessed ally harm

- Added witnesses-ally-attacked and witnesses-ally-damaged across persisted/public vocabulary, validation, labels and guidance. Canonical native attack, actual damage, direct Activity attack and compiled Activity attack paths evaluate same-controller observers other than the victim, using authoritative sight/senses. Unconscious/petrified observers cannot witness. Misses count as attacks; zero/absorbed damage does not count as injury.
- Cleanup runs at the event boundary, not by scanning final transaction visibility. Further inspection caught a victim becoming visible as damage ends an invisibility effect: damage now captures observer/effect IDs before damage and applies that capture only after positive damage, before deferred new effects. Attack witnessing precedes attack-trigger cleanup that might similarly reveal the victim. No player witness list is accepted.
- Dual-route tests cover walls, blindness, qualifying blindsight, magical darkness, zero HP, positive-HP unconsciousness, petrification, other-side observers, victim exclusion, new effects after the event, and invisible victims revealed by damage. Native Multiattack tests additionally verify witness effect rollback on invalid later dice. Initial assertions needed to treat an omitted empty ActiveEffects array as false. Five suites406tests passed before the perception-timing refinement; three affected suites368tests passed after it. Initial typecheck3325exit0, but source changed during that run, so a final typecheck was started against the completed batch and its outcome follows.
- Private interaction duration/privacy remain unresolved; no original source ability marked accepted, no source configuration hand-edited, API calls0 and user rooms untouched. Existing native Calm Emotions-specific behavior was not used as a substitute for these generic interface tests.
- Final typecheck92739exit0. All tracked checks terminal. Sustained-interaction audit still needs a Host-owned start/participants/interruption record: campaignTimeRules currently supplies elapsed-time effect aging, not continuous conversation evidence. Full-book goal remains active.

### Offline sustained interaction foundation: continuous communication requirements

- Added Effect.sourceLink.requiresSourceCommunication and requiresSharedLanguage to public/persisted contracts, strict normalization and validation. Combat source-link reconciliation now combines audible speech, speech restrictions, conscious listener/hearing, active linguistic comprehension and independent learned-language overlap; loss removes the effect with invalid-relation. Direct Activity commit now also runs continuous source reconciliation, matching root Headless settlement.
- Local tests verify serialization and normalization, invalid non-true opt-ins, silence, prohibited speech, deafness, unconsciousness, lost language, magical understanding without learned-language substitution, suspended restrictions and no resurrection of interrupted effects when communication returns. Initial duration fixture omitted the required expiresAt, corrected to source-turn-end. Five suites398tests passed. Typecheck8784 running; outcome follows.
- This is an interruption primitive, not a completed timed-interaction engine. Existing completionReward is a closed short-rest profile and afterEffectEnds only creates closed transition restrictions; neither grants an arbitrary completion Activity. Host start/participants, completion entitlement, privacy and campaign-time-jump evidence remain open. Source absence is still handled by existing source-link semantics and must not be taken as proof of uninterrupted conversation. SDK/AI guide explicitly keeps these limits. No source configuration altered or certified, no API calls and no existing room changed.
- Final typecheck8784exit0. All tracked checks terminal. Full-book goal remains active; next required implementation is authenticated timed completion rather than treating expiry alone as completed conversation.

### Offline timed completion foundation

- Added a persisted completionGrant timer and Host-only natural-expiry planner. A live source and unsuspended timer are required; interrupted/deleted timers do not grant an Activity. Completion creates a bounded-duration receipt, preserves source/package provenance and deduplicates existing receipts. Combat boundary reconciliation cancels suppressed preparation timers permanently.
- Four affected suites passed: 81 tests, including five new completion tests. Actual two-combatant turn boundaries, serialization, premature activation denial, deletion/suppression interruption, receipt consumption and repeat denial are covered. Initial one-combatant fixture correctly failed because combat was inactive; corrected the fixture to advance both participants.
- This remains an internal runtime foundation: public Effect SDK/compiler wiring, participant/target binding, private conversation evidence and campaign-time progression are not yet certified. The single-use example explicitly consumes its receipt; arbitrary completion grants are not inherently single-use. No original source ability or full-book workflow newly accepted. Paid API calls: 0; existing rooms unchanged.
- Typecheck16920 pending; append terminal result before closing this batch.
- Final typecheck16920exit0. All tracked checks terminal. Full-book goal remains active; the runtime completion primitive does not certify uninterrupted private interaction.

### Offline timed completion public contract and module integration

- Exposed Effect.completionGrant through Activity contracts, executor proposals, compiled Headless effect reconstruction, condition/mechanical factories and canonical settlement. Exactly one projected row owns completion for compound effects. Delayed grants remain distinct from immediate grants.
- Added validation for same-package Activity ID syntax/uniqueness, bounded availability, unsupported concentration/profile/reward combinations and unexpected grant fields. Module control registration, missing-reference rejection, pattern references and spell-entry reachability now follow delayed grants. Updated public SDK and AI guidance without invoking AI.
- Five suites78tests passed: both direct and compiled plugin settlement across marker/condition/modifier/compound effects; no premature entitlement; JSON persistence; one completion receipt; availability expiry; module byte serialization/reimport, registration/disposal and missing references. A first boundary assertion was corrected to respect the established applied-turn exclusion. A scoped test-edit error was fixed before the final successful suite. Initial typecheck54141 found three new-test result-union narrowing errors; fixed with explicit success guards. Final typecheck41891 pending.
- This is combat-boundary completion support, not uninterrupted private-conversation certification. Campaign time currently ages/removes timers without authenticated participant continuity. Original participant binding, private interaction and campaign progression remain open. No source recipe hand-edited/certified, no existing room changed, paid API calls0. Full-book goal stays active.
- Final typecheck41891exit0. All tracked checks terminal. Next work remains authenticated participant continuity and target binding; public combat timer support is verified but is not full-source acceptance.

### Offline preparation continuity at the completion boundary

- Found a settlement ordering gap: continuous source links were reconciled after boundary expiry, allowing an invalid final interval to create a completion receipt. Reconciliation now runs before boundary aging. Missing sources remove pending completion timers and explicit communication/language links rather than preserving a resumable preparation.
- Added final-boundary checks for missing/silent/unconscious source, deaf bearer, lost common language, excess distance and valid completion. Tests restore participants/conditions and assert no receipt appears later. Corrected fixtures to provide authoritative distances and a persisted deaf condition. Strengthened earlier communication restoration tests to retain any erroneously surviving conversation effect instead of clearing all effects themselves.
- Campaign jumps have no authenticated participant-continuity record yet. They now interrupt pending completionGrant timers rather than subtracting an unverified interval and permitting later combat completion; ordinary effects and already-issued receipts still age normally. Added partial/full jump and JSON-resumption cases with unrelated effect aging and immutable input assertions. Updated SDK/AI guidance.
- Four suites88tests plus two boundary-related suites8tests passed (96 total). Typecheck30517 pending. No new source ability certified, no hand-edited source recipe, no API calls and no existing room changed. Full-book goal remains active; participant-bound completion and authenticated noncombat interaction progression still require implementation.
- Final typecheck30517exit0. All checks terminal. Next integration evidence: CampaignTimeAdvance carries interval/reason/rest beneficiaries only, and Dnd5eCampaignTimeReconcileContext only airborne; neither currently records authenticated interaction participants or interruptions.

### Offline participant-bound completion grants

- completionGrant now supports recipient:source and bindTarget:bearer|source. The Host resolves original participant IDs at natural completion, delivers the receipt to the correct combatant, and preserves source/package identity. Default bearer behavior remains. Persisted grantedActivityTargetIds scopes the receipt and rejects malformed IDs/scopes; module byte roundtrip preserves the public options.
- Direct Activity entitlement and both native plugin entitlement checks enforce the target scope against concrete submitted targets. Single/multiple field conflicts cannot use a permitted targetIds array to conceal a forbidden targetId. Suspended receipts do not authorize execution. UI availability calls may omit targets; execution calls supply them.
- Added source-recipient/bearer-target tests through both actual Host routes: premature use denied, target swap/mixed target rejection, serialization, scoped receipt validation, one-use source-scoped consumption, no foreign target effect and replay denial. Existing public Activity setup tests now carry source binding through executor/compiler paths.
- Initial five suites155tests had one detection regression: continuous-link reconciliation from earlier work normalized unrelated actors and removed a fixture's poisoned status. Limited reconciliation to actors with a relevant source link/completion timer; three affected suites79tests then passed, including the original detection assertion unchanged. Other initial suites passed. Typecheck96688 still running, but code changed during it; final typecheck must run after terminal result.
- No original source recipe newly certified, no API calls or room changes. Private conversation and authenticated campaign-time progression remain unimplemented. The full-book objective remains active.
- Typecheck96688 found a test confirmedBy role literal (source instead of actor), corrected; the focused22tests passed again. Final typecheck27897 running. Next authority integration is scripts/shared-server-core.mjs mutateCampaignTimeState, already gated to DM/Host; records currently lack interaction participants/continuity.
- Final typecheck27897exit0. All tracked checks terminal. Participant-bound combat completion is verified locally; full-source and whole-book acceptance remain open.

### Offline noncombat interaction records and authority

- Added shared campaign-interaction record validation and idempotent Host/DM start/interrupt mutations, wired through the existing atomic campaign-time mutation endpoint and typed client store contract. Records preserve source/bearer/effect/package identities, required rounds, server-stamped start minute/member, interruption minute/reason. Conflicting ID reuse, duplicate active effect registration, stale clock and malformed persisted records are rejected. Interrupted IDs cannot restart. A bounded record limit preserves replay guards instead of silently evicting them.
- Ordinary advance, rests and forward time-setting interrupt active records. Atomic forward-clock snapshots mirror that behavior; serialization and client/server validation preserve records. No completion receipt is minted from these records yet: authoritative runtime effect/participant matching, verified progression and UI integration remain required.
- Found and corrected a permission edge case in mutateCampaignTimeState: absent member and absent host IDs previously compared equal. An authenticated nonempty member ID is now required before Host/DM role acceptance. The normal local-open endpoint supplies its explicit local DM identity as before.
- New record tests plus campaign-time tests15passed. Expanded four-suite run224tests:223passed, one unresolved map-geometry failure at sharedServerCore.test.ts1850 (scene light on elevated terrain expected target visibility across a low wall). No geometry code changed this batch; attribution is not established, and the full suite is not reported green. Focused existing authoritative-campaign-time group6passed. Typecheck90765 pending.
- No API calls, source conversion/certification or room mutation. Full-book goal remains active; records alone are not completed sustained-interaction automation.
- Typecheck90765 failed on new-test mutation/result type narrowing. Added explicit successful-state parsing and aligned the server declaration with its nullable-member rejection boundary. Focused interaction tests7passed again; final typecheck16092 running. The separate elevated-light projection failure remains unresolved.
- Final typecheck16092exit0. All tracked checks terminal. Noncombat record foundation is locally verified; runtime participant validation/progression/UI and the unrelated light-projection failure remain open. Full-book goal remains active.

### Offline interaction references, Host preflight and actual persistence

- Wired new starts to server-read character/map participant snapshots inside the existing campaign clock lock. Rejects missing/ambiguous identity or effect, substituted source/package, mismatched remaining rounds and suspended timers; mutation-supplied snapshots are ignored. Exact idempotent retries still return their original terminal record. Reads are a start reference check, not cross-resource completion proof.
- Added read-only dnd5eCampaignInteractionIssue/prepareDnd5eCampaignInteractionStart using canonical source-link reconciliation on a clone. Noncombat/live participants are required, identities/duration come from Host effects, interrupted records reject revalidation. Client store startInteraction now uses this preflight before the authenticated mutation route.
- Found missing changed flags in previous record mutations: atomicMutateJsonStateLocked skips persistence unless changed is true. Corrected new mutations/retries and added actual temporary-file start/reload/retry/interrupt tests. Retries preserve exact disk bytes/revision. Test cleanup removes only the known file and empty unique temporary directory.
- Five suites59tests passed, including semantic Host preflight and actual persistence. Subsequent reference-guard hardening reran the record suite8passed. Typecheck85138 running. Shared JS hardening did not alter TS signatures. No API calls, live room changes or original source certification. UI/progression/receipt settlement and the previously recorded light-projection failure remain open; full-book goal active.
- Typecheck85138 found the preexisting exported atomicMutateJsonStateLocked lacked a TypeScript declaration. Added its async-updater signature, giving the new disk-test callbacks proper unknown input types. Final typecheck76640 running. Verified next integration reference: MapsWorkspacePage long-cast settlement builds an unpublished advanceCampaignTimeSnapshot and commits it with effects; interaction completion should use the same atomic approach.
- Final typecheck76640exit0. All tracked checks terminal. Host preflight, server reference checks and record persistence are verified locally; noncombat progression/atomic receipt commit and UI remain open. Full-book goal active.

### Offline noncombat completion result planning

- Added an unpublished completion planner combining a checked active interaction, explicit Host continuity attestation, forward clock snapshot, completed record and Headless receipt settlement. Failures return no clock/application. Validated participants must be present on the map; ordinary elapsed time cannot substitute for the attestation. This is a planner, not yet a published UI/transaction path.
- Completion removes the actual preparation effect, delivers the scoped receipt to its original recipient and subtracts minute-granularity overshoot from availability; an already-expired receipt is not issued. Reused long-cast compensation with an explicit ageAllActors mode to age other characters/creatures and update both full snapshots and entity patches. Existing callers retain their previous default. Revision-checked atomic publication is still required because this mode produces complete actor snapshots.
- Completed records retain their advance identity; validation requires a matching retained interval or a completion predating the retained history window. Replays/interrupt requests cannot reopen completed records. A513-advance retention test proves old completed status survives history trimming.
- Six suites74tests passed, plus focused completion8tests after the retention case. Covers character/creature recipient, target binding, other effect aging, no double aging after reload, missing confirmation, lost speech, removed effect, unverified elapsed clock, interrupted/completed replay and precision overshoot. Typecheck71809 running; TS changed during that check, so a final check is required afterward.
- Still open: actual revision-checked multi-resource commit/UI, precise consumption when one ability has several simultaneous target-bound receipts, and full-source/end-to-end acceptance. No API calls or live room changes. Full-book goal remains active; light-projection regression remains recorded.
- Typecheck71809exit0; final check76146exit0 after the retention test and planner cleanup. All tracked checks terminal. Completion bundle planning is locally verified, but actual atomic publication/UI and exact per-receipt consumption remain open; no full-source acceptance added.

### Offline exact single-use completion receipt consumption

- Added completionGrant.singleUse:true through public contracts, validation, compiler/executor persistence and completed receipts. Runtime grantedActivitiesSingleUse is validated and normalized. Successful direct, compiled plugin and sandbox Worker settlement removes the exact preexisting authorizing receipt by instance ID; failure/rollback does not consume it. Target-scoped grants for other participants remain.
- Added Activity.requiresEffectGrant:true. Direct authority (including continuation bypass checks), compiled plugins and Worker authority enforce it, preventing ordinary parent feature/spell ownership from bypassing spent temporary grants. Package registration rejects single-use completion references without this guard; byte roundtrip preserves both fields. Updated SDK and AI guidance; broad remove-effect outcomes are no longer needed for this mechanism.
- Dual-route tests now hold two same-definition target-bound receipts, deliberately give the actor the underlying feature, reject premature/foreign/mixed targets, preserve both on resource failure, consume one, and then independently use the other. Worker fall settlement tests preserve the selected receipt on missing fall dice and consume only that receipt after complete success. Strict persisted/public false-flag rejection and missing package guard are covered.
- Initial six suites182tests passed. After adding the ownership guard, focused two suites25tests and package/validation48tests passed; final broader run97397 pending. Initial typecheck94935exit0 but source changed during it; final typecheck98279 running.
- No API calls, original source certifications or live-room changes. Exact receipt consumption gap is addressed locally; actual noncombat atomic publication/UI and full-book acceptance remain open. Light-projection failure remains separately recorded.
- Final broader suite97397 completed:7files204tests passed. Final typecheck98279 remains live; no checks restarted on timeout.
- Final typecheck98279exit0. All tracked checks terminal. Exact single-use grant consumption plus ownership guard are verified locally; noncombat publication/UI and full-book acceptance remain open.

### Offline completion publication boundary

- Added a publication function for the planned interaction result. It sends characters, maps and campaign-time in one existing atomic transaction, with explicit original snapshot revisions for every resource; missing revisions or a missing/duplicate target map fail before writes. The room gateway port now exposes the expectedRevision already supported by the HTTP adapter.
- Conflict handling never replaces revisions or blindly retries stale snapshots. A lost reply can be recovered only by reading the exact durable completed interaction record from a valid clock; this avoids restoring a reward already consumed after the original successful commit.
- Focused suite: 12 tests passed, including bundled writes, missing revision rejection, stale-snapshot rejection and lost-reply recovery after further time advancement. These publication tests use an injected gateway; they do not constitute real server rollback or browser acceptance. Typecheck74148 pending.
- No paid API calls, source certifications, or live-room changes. UI orchestration, actual transaction integration coverage, and whole-book acceptance remain unfinished. Continue batch local convergence before concentrated paid conversion.
- Typecheck74148 exposed a generic mocked reader signature mismatch. Narrowed the publisher's read dependency to the only resource it reads (campaign-time), corrected the mock, reran all 12 focused tests successfully, and final typecheck34315 exited0. All checks terminal; UI/server integration acceptance is still outstanding.

### Isolated server completion transaction verification

- Extracted the synthetic interaction fixture for shared use by planner and actual HTTP server tests. Added an integration case using the real planner and publisher against a temporary shared root/new room, with DM and player authentication. Existing user rooms/ports5273/5274 were untouched.
- Verified an intervening map revision rejects all three stale writes: character/reward and campaign clock stay unchanged, while the concurrent map edit survives. The test refreshes and replans before submitting the newer revision. Player-forged terminal clock submission returns403.
- Valid completion advances time and replaces the preparation with a target-bound reward visible through the player character endpoint. Simulated lost HTTP reply is recovered from the persisted terminal clock record. Replay leaves all resource data and revisions unchanged. Empty effect arrays are normalized away by the server; the assertion checks absence rather than requiring a serialized empty array.
- Full transaction suite plus planner/publication suite:40tests passed (2files). This is real HTTP/storage integration coverage, not browser UI or source conversion certification. Typecheck23676 pending. No paid API calls. Next: Host UI/controller must build fresh map/character/clock snapshots and invoke this verified path; whole-book acceptance remains open.
- Final typecheck23676exit0; all checks terminal. Before UI integration, include read dependencies such as combat state (and separately stored geometry when used) in the transaction's revision guards: characters/maps/clock CAS alone does not prove that combat has not started since planning. This dependency guard remains open, along with UI and source/end-to-end acceptance.

### Atomic read dependency guards

- Added optional readRevisions to the room transaction transport/port. The server validates allowed resource names, bounded count, safe integer revisions, and disallows overlap with writes/journal mutations. Dependencies are checked after recovery inside the same room transaction lock, before any writes. They do not produce writes, revision increments, undo records or mutation events.
- Completion publication now requires original combat and map-geometry revisions in addition to character/map/clock write revisions. Missing/invalid revisions reject before publication. HTTP adapter forwards the guards unchanged.
- Real server tests cover concurrent combat/geometry changes rejecting the entire write, malformed guards rejecting, and successful read checks preserving exact dependency data/revisions. Combined server transactions, publisher/planner, and client transport:3files64tests passed. Typecheck89750 pending; no paid API calls or live-room changes.
- UI/controller is still pending. Snapshot construction currently obtains geometry via mapGeometryRuntimeForMap in mapBridge; integration must ensure that geometry is the exact freshly read guarded snapshot, not a newer/older unrelated runtime cache. Use the existing room authority scheduler and fresh authoritative resources. No new source or browser acceptance claimed.
- Final typecheck89750exit0; all checks terminal. Read dependency transaction protection is locally verified; fresh-snapshot orchestration, UI and whole-book acceptance remain open.

### Host interaction orchestration and clock panel

- Added explicit geometry snapshots (including null for verified absence) to map combat projection and result mapping. Existing callers retain runtime fallback; the new interaction path passes the exact read geometry through both stages, avoiding cache substitution during source-link checks.
- Added Host controller reading characters/maps/clock/combat/geometry and taking each revision from its own returned _sync metadata, rather than mutable global watermarks. Unversioned resources reject. Authority operations use the shared room scheduler, re-read before acting, preserve authoritative combat activity, and guard against room/role changes. Completion uses the planner plus atomic publisher/read dependency guards. Start and interrupt use the existing authenticated clock mutation route.
- Added a DM-only persistent-interaction section in the campaign clock. It lists current-map preparations, participant names/duration, starts or interrupts records, and requires an individual continuity checkbox before completion. Invalid active records remain interruptible. The checkbox describes continuous communication/distance/privacy requirements; it is not a claim the engine can infer narrative privacy.
- Snapshot/controller, completion, and map bridge regression:3files86tests passed. Tests verify exact revisions, rejection of unversioned reads, authoritative combat state, and explicit fresh geometry overriding contradictory runtime geometry before and after result mapping. Initial typecheck2008exit0; test file and small UI loading-state fix were added during/after it, so final typecheck pending.
- No paid API calls or existing-room changes. UI is implemented but not browser-accepted; controller action flows still need isolated integration coverage. Full-source automatic conversion and whole-book acceptance remain open.
- Final typecheck38280exit0; all tracked checks terminal. SDK documentation now describes the actual Host panel/controller and atomic publisher while retaining the pending browser acceptance limitation.

### Controller HTTP integration and mirrored-effect fix

- Exercised loadCampaignInteractionChoices/runCampaignInteraction with their actual planner, Host scheduler and store reload, replacing only the browser transport with authenticated requests to the temporary HTTP server. Uses a new room/player and character-bound source/bearer; no existing-room state is changed.
- The test found a real failure: server start-reference snapshots concatenated character effects with Token mirrors, treating one preparation as ambiguous duplicates. Interaction-specific projection now matches Headless ownership: normal bound tokens use character effects; independent tokens/simulacra use token effects; missing player character data cannot fall back to token mirrors. Other tokenActiveEffects consumers are unchanged.
- Negative evidence: removing the authoritative character effect while leaving its Token mirror rejects a start with409/interaction-effect-unavailable. Restoring the actual character effect allows start. Completion requires continuity confirmation, advances/publishes once, is visible through the authenticated player character endpoint, and repeat completion rejects without a second transaction. Interrupt preserves world time, grants no reward, and cannot later complete.
- Three suites48tests passed (full server transaction suite, controller snapshots, interaction records). Initial focused failure included a test transport using POST instead of the route's PATCH; that adapter was corrected before investigating/fixing the actual mirror bug. Typecheck77905 pending. No paid API calls or original-source/browser certification. Actual panel clicks and player follow-up Activity use remain to be browser-verified.
- Typecheck77905exit0; all checks terminal. The only edit during that check changed a test's expected HTTP status literal from400 to the observed, source-confirmed409; the full48-test run after that correction passed. Mirror ownership and controller HTTP paths are locally verified; full-book and browser acceptance remain open.

### Isolated Host/player browser verification of preparation completion

- Built the current application into private local-import-tests/interaction-ui-20260927/dist with Vite (exit0). This is an isolated preview build, not a claim that the separately recorded full architecture/release checks pass. Started static servers6773/6774 with a unique shared root and empty AI/voice configuration directories; AI reported disabled. Existing5273/5274 rooms were untouched.
- Through browser UI created local development-only DM/player accounts, campaignSRE9KZX2JEH7 and roomQB5BVZ; player joined normally. No external verification delivery: auth config reported developmentDelivery:true. A synthetic fixture equivalent to integration tests was seeded only into that new campaign before the UI operation. Fixture exporter and fixture JSON are archived privately; no source conversion credit is claimed.
- Actual Host clicks: open clock → preparation listed → start → completion disabled until continuity checkbox → check → complete. Clock changed08:00→08:01 and pending preparation disappeared. Player synchronized to08:01 without manual refresh, had a read-only clock dialog, and its quick character sheet displayed Prepare（已完成） with10remaining rounds. A full player reload preserved the same10rounds.
- Persisted audit confirms one completed interaction, worldMinute481, and receiptprepare:completed scoped to bearer with10rounds. Private report: C:/Users/Doco/AppData/Local/StarsApp/local-import-tests/interaction-ui-20260927/browser-audit.json. The synthetic receipt references an uninstalled test Activity, so this verifies preparation/receipt presentation and synchronization ONLY; player follow-up execution still needs an installed test package and is not accepted.
- Initial Vite SSR fixture export terminated on its module transport timeout, before writing fixture data. Used the existing Vitest transform path successfully to generate it, archived the temporary exporter privately, and removed that temporary test from the repository. Application build remained frozen during UI verification.
- No paid conversion API calls or new source certifications. Current CUA tabs1/2 and server sessions74087/88586 are retained for follow-up isolated validation; goal remains active.

### Installed synthetic preparation and single-use follow-up, browser verification

- Added `e2e/fixtures/interaction-completion.dndstars5e`, a raw V2 synthetic package with owned prepare Activity and a guarded, target-bound, single-use completion Activity. Package parse/export/reimport test verifies the grant contract; this is not converted publication content.
- Imported through the isolated Host workshop. Player extensions showed matching version and integrity. Initial missing panel was a lazy-loading observation; after loading, the actual defect was an active Activity button disabled outside combat. Added a distinct exploration permission for owned actors, restricted to active registered Activities and excluding reaction economy; rest/event gates and Host authority remain enforced.
- Actual player prepare request succeeded, Host clock listed the new preparation, start/continuity confirmation/complete advanced 08:01 to 08:02. Player hotbar gained the completion Activity. Clicking an unbound creature was rejected with invalid-plugin-action and preserved the receipt. Clicking the bound target succeeded: target tempHp=3, source tempHp=0, exact receipt removed, and follow-up button disappeared.
- Isolated Vite build exit0; package roundtrip and invocation suites 8 tests passed; typecheck1714 exit0. Paid conversion API calls remain0. Audit: C:/Users/Doco/AppData/Local/StarsApp/local-import-tests/interaction-ui-20260927/installed-activity-browser-audit.json. This proves the synthetic installed mechanism path only; no additional original-source certification or full-book completion is claimed.

### Batch review and conversion-guide alignment

- Previous turn classified as progress: real player preparation and bound one-use follow-up were verified. This turn re-read the current 155-entry backlog (33 preflight ready, 122 blocked, 807 diagnostic strings); no conversion requests were made.
- Found stale AI guidance claiming that noncombat preparation completion was unavailable despite the implemented Host workflow. Updated generation guidance and SDK prose to distinguish ordinary time advancement (interrupts) from authenticated interaction completion (atomic advancement and receipt), and to preserve DM confirmation of narrative privacy/continuous conditions. Replaced old broad remove-effect consumption advice with singleUse plus requiresEffectGrant. No source-generated configuration was rewritten.
- Re-examined exact missing forces-saving-throw diagnostic against direct and compiled Host tests covering other/self target attribution, invalid-roll rollback and same-action new effects. Private review r3 preserves r2 and adds that one expressible diagnostic plus three explicitly partial communication/preparation compound diagnostics (seven reviewed strings total). Partial reviews do not certify all clauses; source regeneration and rule-specific acceptance remain outstanding.
- Current local guide plus Activity combat suites: 41 tests passed. Added a guide regression for the supported Host workflow and its trust boundary; final focused guide suite: 13 passed. Only guidance/docs/test strings changed this turn, no repeated production build/typecheck. All checks terminal; API calls0, source certification counts unchanged. Private review: fullbook-mechanism-review-20260927-r3.json.

### Group summon orders and transferable item snapshots

- Previous guide-alignment turn was progress. Current work re-read B3/B4 diagnostics against actual runtime; paid API calls remain0.
- Added compiled-plugin group command regression: one Activity orders two owned summons with one bonus action. Invalid second-target ownership, source Activity or distance rejects the group and preserves the original state. Entire summon/item routing suite12passed. This addresses the exact single-recipient protocol diagnostic, not arbitrary natural-language tasks or separate per-creature movement/action programming.
- Strengthened the transferable stone-like item regression: instead of manually supplying creator modifier4, a conjured-item Activity captures it through captureSpellcastingModifier. Its actual proposal feeds inventory grant, transfer and equipment projection; receiver attack modifier6, damage bonus4, range60 and one-unit consumption pass. Temporary-weapon lifecycle suite3passed. This is synthetic mechanism evidence; spell-attack delivery, sling use and conversion of existing objects are not proved. equipment.ts has special handling for source modifiers but these tests do not establish correct attack delivery across all Host paths; audit that next rather than declaring the original spell complete.
- Conversion guide now documents group command composition and creator-modifier item binding, including the unverified limits. Guide suite13passed. Private review r4/r5 preserves earlier decisions and brings exact reviewed diagnostic strings to10; item entries remain partial. All155source entries retain their previous certification status. First typecheck79420exit0; final typecheck11999 includes the strengthened item test and is pending.
- Final typecheck11999exit0; all checks terminal. Further source inspection found equipmentAttackAction.ts already maps usesSourceSpellcastingAbility to spellAttack:true; guide now accurately mentions that adapter while retaining the unverified full attack/sling/object-conversion boundary. Do not reimplement the flag; verify real attack behavior next. No paid calls, production-room changes or full-book certification.

### Actual source-powered projectile attack and sling settlement

- Previous turn was progress. Added a registered synthetic projectile fixture to equipmentAttackAction tests: grant to creator, transfer to a different level5 user, equip and prepare through the actual map authority adapter. Source modifier4 plus recipient proficiency3 yields attack7 and damage bonus4. Weapon-only ranged disadvantage does not affect the spell attack; hit deals7, miss deals0, each accepted attack consumes one of three items. Invalid damage dice produce no application and preserve the source inventory.
- Extended the same fixture through the existing useSling route: no off-hand sling rejects; real sling plus declared slingRangeFeet gives30/120, spellAttack and spellDeliveredByWeapon remain true, 100-foot shot has disadvantage and deals7/consumes1 on success. Beyond120 fails; hand-thrown beyond60 also fails. Both existing UI class panels expose the sling action and map preview reads its selected range, but these UI paths were only inspected, not browser-certified.
- Final related run: equipment attack51 + temporary lifecycle3 + guide13 =67tests passed. Typecheck20981exit0; its run overlapped subsequent test-only sling/range assertions and guide text updates, so it is not claimed as a distinct full check after every final test edit. No production runtime changed and no repeated build. All handles terminal.
- Private r6 review strengthens the two existing partial item diagnostics without converting them into source certification. Updated converter guidance with the verified attack/sling mechanism. Original generated configuration, complete object transformation/source material handling, lifetime across all transfers and actual browser import/use remain open. Added API calls0, existing rooms untouched, goal active.

### Campaign-time expiry of transferred generated inventory

- Previous turn was progress. Current source inspection found a real lifecycle gap: map result application cleaned source-bound inventory, but the post-clock roster pass only reconciled active effects. After a source timer expired outside combat, transferred generated stacks could remain in recipients' inventory.
- Added regression first; both roster-order variants failed with all three expired stack fragments still present. Fixed reconcileDnd5eCampaignRosterSourceEffects to collect live tags after all characters' time/source reconciliation, then apply existing source-bound cleanup with the known owner set. Changed recipients are marked for persistence even if their own effects did not change. Incomplete rosters preserve unknown sources.
- Regression creates three linked stack units, splits/transfers across three characters, persists/reloads, expires the source, and verifies all fragments removed in either roster order while a second casting and ordinary items remain; repeat reconciliation is stable. This tests generated inventory, not enchanting/restoring preexisting mundane objects.
- Source inventory/campaign rules/store long-rest suites47passed; source lifecycle suite6passed; updated guide suite13passed. Converter and SDK guidance now explain explicit sourceEffectId binding versus independent minute expiry. Typecheck73675 pending; no paid API or room mutations, original source certification unchanged.
- Typecheck73675exit0; all checks terminal. Runtime/test edits were complete before that check; only subsequent documentation and guide text changed. Full-book goal remains active.

### Completion transactions include off-map inventory cleanup

- Previous turn fixed ordinary campaign roster processing. Current callsite audit found long-cast/interaction completion reconciled character clocks inside its application bundle without the roster cleanup. Factored the existing cleanup into expireDnd5eSourceBoundInventoryRoster and reused it after all completion character timers settle.
- Completion now records changed off-map recipients and includes inventory/equipment/combat-state patches in the same application, both ordinary long-cast mode and ageAllActors mode. It does not rely on a later background clock reconciliation. Pure input snapshots remain unchanged. Independent rest-recovery callsite inspected is preview-only, not a persistence path.
- Added two completion tests with a source-bound equipped weapon transferred to an off-map holder, source expiring during completion and explicit recipient patches. Commit/source inventory/interaction suites40passed; campaign/source lifecycle/store rest suites47passed. Typecheck43753 pending. Diff check found and removed an extra EOF blank line in campaignTimeRules. No paid API, browser assertions or original-source certification added.
- Typecheck43753exit0 and scoped diff checkexit0; all checks terminal. Goal remains active.

### Executable batch review coverage report

- Previous runtime turn was progress. Added offline review coverage tool and tests to join exact saved diagnostic reviews to the full155entry backlog without altering source artifacts or promoting mechanism evidence to certification. Validates diagnostic hashes/text, source scopes, duplicates, allowed review decisions and evidence presence; CLI checks named backlog, hashes current evidence files within the workspace and exclusively creates a new report.
- Shared diagnostic reviews apply only to their explicit sourceIds. Partial rows stay unresolved; even an entry with all current diagnostics expressible only awaits batch regeneration. Preflight-ready entries still require independent artifact/behavior acceptance. paidConversionGatePassed remains false; this coverage tool cannot authorize API calls or certify source conversion.
- Five Node tests passed across backlog/coverage tools. Actual private report fullbook-review-coverage-20260927-r1.json:155entries,807distinctdiagnostics,10reviewed,913links;903unreviewed,5partial,5expressible. All122blocked entries still require mechanism review;0entries awaiting batch regeneration. These counts describe saved review coverage, not the number of missing engine mechanisms.
- Largest shared diagnostics: explicit DM operation affects68entries; partial/manual feature declaration20; missing executable binding15; independent execution verification7. They are configuration/acceptance symptoms and must be expanded into source-specific deterministic/narrative clauses, not mass-cleared. No paid calls, source certification or user-room mutations. All tools terminal; no TypeScript/runtime files changed this turn.

### Expand shared manual-boundary diagnostics to actual generated declarations

- Added offline scripts/audit-fullbook-manual-boundaries.mjs and two passing Node tests. It loads only selected automatic runs with manualContentRepairs:false and exact verified source ID/kind/name/text, retains JSON paths and full declarations, hashes provenance and exclusively creates a private report. It does not infer narrative status from keywords or modify drafts.
- Initial extraction found13entries without string manual/partial markers. Inspection identified object automation.mode:reference-only; extractor/test updated accordingly. Final private fullbook-manual-boundaries-20260927-r2.json accounts for all68affected entries/68candidates:218boundaries,40explicit operations,178declarations,0unlocated entries. Earlier r1 retained for provenance. Source excerpts/configuration remain private.
- Found a concrete semantic defect that structural full status misses: source spirit-shield values2d6/3d6/4d6 versus generated reductionDice1d6/2d6/3d6. Verified original source lines; saved fullbook-source-numeric-review-20260927-r1.json. No manual config repair or source certification performed. Next action is source-aware numeric validation and batch regeneration coverage, not marking full declarations accepted.
- No paid calls or runtime edits. Two extractor tests passed after reference-only support; all commands terminal; goal remains active.

### Source-table reduction dice validation

- Previous turn located a genuine generated/source mismatch. Added a generic named subclass-table validator for explicit damage-mitigation reductionDice: matches ability name and acquisition level, compares base dice and subsequent thresholds, rejects changed count/sides, early upgrades and omitted upgrades. Duplicate/ambiguous, unnamed or prose-only tables are not guessed. Malformed upgrades do not crash source validation; structural validity remains the existing validator's responsibility.
- Integrated through localContentSourceConstraints, already called by AI draft validation and source-aware PDF preflight. No generated draft is repaired. Synthetic tests use different names/levels/dice rather than hardcoding the publication example; source-constraint suites9passed.
- Offline private replay of all31subclass selected automatic candidates uses exact source matches and manualContentRepairs:false. It reports the known three spirit-shield level errors in1entry. The other30entries are not certified: this check covers only recognized named reduction progression tables. Report fullbook-source-dice-offline-20260927-r1.json; reusable replay files in .codex-logs/fullbook-source-dice-offline.*. Paid calls0.
- Typecheck66612 pending; an added malformed-upgrade guard/test landed during the run. Goal and original source certification unchanged.
- Typecheck66612exit0. Started final check51630 after the guard edit; confirmed running and retained for the next continuation. Do not restart it merely because the turn ends. No further code edits pending in this batch.

### Refresh offline gates without paid regeneration

- Final typecheck51630 exited0. Replayed all existing explicitly unedited automatic candidates against exact verified source and current structural/source gates; Vitest1passed. No API requests. Updated the local replay harness to use a validated revision filename and exclusive creation, preserving earlier consolidated evidence.
- New private fullbook-consolidated-preflight-20260927-r2.json and mechanism-backlog-20260927-r2.json retain155entries,33preflight-ready and122blocked;810distinct diagnostics and916links. Compared with the prior backlog, three source-table reduction errors are new. The already-existing wind-defense candidate replaces the prior wind candidate, replacing three diagnostic texts; no new conversion was performed. Counts are diagnostics, not independent missing runtime mechanisms or certified spells.
- Carried the10existing reviews into private mechanism-review-20260927-r7.json only after exact diagnostic/source-scope validation and unchanged selected-run checks for reviewed sources. Migration retains prior/new report hashes. New numeric diagnostics remain unreviewed. Review coverage r2:906unreviewed links,5partial,5expressible;122entries still await mechanism review,0await batch regeneration. The paid conversion gate remains false.
- Source certification unchanged, user rooms untouched, paid calls0. All commands terminal. Continue batching shared mechanism/configuration work offline before any concentrated conversion validation.

### Executable follow-up authorization authoring example

- Previous turn made progress by refreshing exact-source offline diagnostics. Inspected current spell reachability and entitlement code: shared legacySource is an ownership binding, not a lifecycle grant. Effect-only follow-ups need requiresEffectGrant so owning the spell cannot bypass expiration. Area/summon/continuation authorization differs and must not receive this guard mechanically.
- Added a synthetic two-Activity authoring example to actual AI SDK guidance and SDK documentation. Casting applies a real grants Effect; the follow-up is guarded and spends its own bonus action. No original imported configuration was rewritten or certified.
- Direct registered Headless execution test verifies pre-cast denial despite owning the spell, cast action consumption, persisted effect authorization, successful follow-up and bonus-action consumption, natural expiry and post-expiry rejection without mutation. Initial fixture used a single combatant and correctly failed because combat was inactive; changed to a real two-participant combat. Final three suites18tests passed, including existing reachability checks and guide inclusion. No paid calls.
- Typecheck82534 is still running; preserve and poll its handle on continuation. No runtime engine behavior changed. Full-book goal remains active; source-certified counts unchanged.

### Keep effect-only follow-ups out of spell casting entry selection

- Previous turn made progress with an executable authoring example. Typecheck82534 completed with two test-only union narrowing errors; added explicit failed-result guards before reading state. No runtime error was hidden by a cast.
- Found a real ordering dependency: content-package spell registration selected the first executable active Activity, including requiresEffectGrant follow-ups. It now excludes those from initial spell entry selection while retaining their registration for real grants. Spell transaction Activity lookup independently rejects them as casting entries. Reachability follows the same exclusion and explicitly reports a bound spell with no full unguarded active entry instead of silently returning no issues.
- Added package registration tests for cast-first, follow-up-first and follow-up-only arrays; guarded-only stays reference-only, both orders with a cast select that cast, and explicit spell lookup cannot route to the guarded follow-up. Reachability tests cover reordered graphs and missing entry. No source configuration rewriting or API calls.
- Four suites149tests passed before the last explicit lookup assertion; package/preflight43tests passed after it. Final reachability/preflight19tests passed after missing-entry diagnostics. Typecheck63362 remains live; last small reachability edits landed during this check, so verify the terminal result and freshness before reporting full typecheck acceptance. Original-source certification remains unchanged.

### Close legacy mechanics fallback around effect-only spell actions

- Previous turn made progress fixing entry selection. Typecheck63362 completed0. Added a regression with both a requiresEffectGrant Activity and legacy damage mechanics: before the fix, two ordering cases incorrectly reported automatic spell support despite rejecting the Activity as an entry. Added an early explicit authorization guard to dnd5ePluginSpellAutomationSupported so mechanics fallback cannot promote it. Full-auto routing consequently rejects it too.
- Package and spell-transaction suites144tests passed after the fix, retaining ordinary legacy spell regressions. Offline consolidated replay1test passed; new immutable private consolidated/backlog r3 reports155entries,32preflight-ready,123blocked,839diagnostics/945links. No paid conversion or source edits.
- The readiness decrease is absorb-elements: its previously ready automatic candidate has no full active casting entry (only triggered behavior). Current package selection excludes triggered spells, so the prior readiness was not evidence of a player casting path. Keep it blocked for configuration/entry review; do not weaken this gate to preserve counts. Other28missing-entry diagnostics affect already blocked entries. Existing review snapshots remain intact and tied to older backlog hashes.
- Typecheck2349 is running against the final runtime change. Preserve the handle; no further code edits since it began. Source behavior certification unchanged; user rooms untouched; API calls0.

### Reaction spell checkpoint boundary audit

- Previous turn made progress closing legacy fallback; typecheck2349 exited0. Inspected the unedited absorb-elements candidate: its entry uses reaction-window, declares no consumption, and its hit followers use attack-hit. Current reaction-window is emitted after attack resolution, not at raw incoming damage. The personal before-damage discovery path rejects spell-slot costs and does not run the outer component transaction. Merely relabeling this candidate would not produce a correct reaction spell.
- Corrected stale AI SDK guidance that claimed no before-damage pause/choice window existed. It now describes actual personal temporary-HP/type-defense support, raw damage requirements, supported resource/economy costs, deferred effects and the explicit spell-slot/component boundary. Prohibits free or fixed-resource substitutions for missing reaction spell selection. This changes future batch conversion instructions, not existing source configurations.
- Added runtime discovery tests for before-damage versus reaction-window and selected spell-slot rejection even with a learned spell, sufficient slots and an available reaction; discovery leaves state unchanged. Guide/flow suites26tests passed. These synthetic boundary tests do not certify the original spell or complete the missing interface.
- Next implementation requirement: selectable slot level and atomic spell resource/component settlement inside the personal damage checkpoint, with cast-level propagation, controller choice cancellation and stale authority handling. Keep blocked source configuration unchanged until that path and actual spell lifecycle are verified. No paid calls; no user-room edits. Final typecheck14617 live after this batch; preserve handle.

### Shared authoritative slot eligibility before reaction-window integration

- Previous turn made progress correcting stale guidance and verifying the checkpoint boundary. Typecheck14617 exited0. Inspection of the existing generic Activity commit found that any positive pact slot could satisfy any requested cast level; this cannot be reused safely for reaction spell selection.
- Added activitySpellSlots helpers to enumerate actual available levels and select their resource. Standard slots retain existing priority; pact fallback requires a registered pact class and exact class-derived slot level, not total character level. Invalid/fractional/out-of-range requests and missing class evidence reject. Both preflight and consumption in commitDnd5eActivityExecution now use the same helper, so eligibility cannot drift between those phases.
- New synthetic tests exercise multiclass total/class level distinction, standard/pact priority, empty/invalid levels and authoritative commits at levels1/2/3/9 with a level-three pact caster. Only its real second-level request succeeds, consumes one slot and applies benefit; all requests preserve input. Slot/rest suites10tests and core-spell/damage-reaction suites94tests passed. No automatic source artifact changed.
- This is the shared resource foundation, not completed reaction-spell UI/component integration. The damage checkpoint still rejects spell-slot activities until selected-level/controller/component handling is wired. No paid calls or user-room changes. Final typecheck3306 is live against these edits; retain handle. Goal remains active.
- Diff whitespace check reports an existing blank line at headlessCombatEngine.ts EOF, outside this turn's edited sections; it was left unchanged. Do not report a clean whole-file whitespace check.

### Controller slot-choice plumbing

- Previous turn made progress on authoritative slot eligibility. Typecheck3306 exited0. Inspected ordinary spell preparation/component checks and the damage flow: slot selection must be separate from feature confirmation and later revalidated at the live checkpoint, not inferred from a client payload.
- Added optional Host-derived availableCastLevels to trigger choice requests and untrusted castLevel to confirmations. The map's shared controller-choice adapter now presents those offered levels with explicit cancellation before activity choices; timeout/unoffered values reject. Without offered levels ordinary feature flow is unchanged. Selection is not authority and no reaction spell is enabled yet: damage discovery still excludes spell-slot costs until component/class/selected-level checks and replay are connected.
- Added UI adapter tests for cancellation, malformed options, exact offered selection and preserving ordinary features. Fixed a test-table nesting mistake (empty array had been spread into no test argument). Final UI/damage-flow suites24tests passed. No original-source configuration changes or paid calls. Current map UI has not been browser-verified.
- Final typecheck66619 is live after all edits. Remaining work: Host reaction-spell preparation (known/prepared class and effective component state), populate choices, validate selected level again before rolling/commit, carry cast level through scaling/replay, then atomic material consequences and isolated network acceptance. Do not treat this UI contract as a completed reaction spell implementation.

### Host reaction-spell preparation helper

- Previous turn made progress on controller choice plumbing; typecheck66619 exited0. Added prepareDnd5eDamageReactionSpell as a nonmutating preparation helper, not yet enabled in damage-window discovery. It resolves exact registered spell/package metadata, requires a before-damage reaction entry with one matching spell-slot declaration, verifies known/prepared casting class and current combat class level, reaction availability, armor/rage/transformation restrictions, effective speech and ordinary inventory/hand component rules, then enumerates actual slot levels.
- It reuses ordinary plugin spell component evaluation and returns the component/material plan for later atomic handling; it does not claim that inventory consumption, conditional choices or material timing have been committed. Effective combat silence overrides stale sheet conditions. Class-bound spellcasting is covered; innate/free-cast and monster spellcasting routes still need separate treatment.
- Eleven synthetic tests passed: valid preparation, missing character, unprepared spell, live silence, occupied hands, no slots/reaction, wrong event, missing/mismatched slot declaration and rage; all preserve inputs. No original automatic draft changed, no paid calls, no room mutations. It is a tested helper; the live reaction discovery/confirmation/replay still awaits integration and browser acceptance.
- Final typecheck77835 is live after the helper/tests. Continue with live discovery and commit revalidation, cast-level scaling and material atomicity rather than treating helper coverage as completed spell automation.

### Integrate selected reaction spell levels into live damage replay

- Previous turn made progress on Host preparation; typecheck77835 exited0. Personal damage discovery now calls that helper for spell-slot costs and unguarded spell entries, rejecting free/malformed spell entries. Existing effect-only follow-ups and ordinary feature resource paths remain separate. Material plans stay blocked because the replay adapter currently persists only the combatant, not character inventory.
- Damage flow offers authoritative availableCastLevels through the controller request, validates the returned level before rolling, scales the dice recipe using that exact level and forwards castLevel into the replay command. Checkpoint acceptance reruns preparation against its live state/character and chosen options, rejecting missing/unavailable levels and material plans before commit. Explicit actor-choice is required for spell preparation; no automatic choice guesses a level.
- New six-case integration suite verifies real incoming damage: selected second-level spell rolls2d4, absorbs4 of6damage, consumes only one second-level slot and reaction; decline/silence preserve slots; missing/forged levels and stale authority throw without publishing or mutating inputs. Preparation/flow suites28tests passed; guide/controller suites28tests passed. Guidance now accurately describes limited class-spell slot support and retained material/innate/monster/network boundaries. No API calls or original draft edits.
- Final typecheck44894 live after runtime changes (subsequent edits only updated guide text/assertions). Remaining work includes material inventory atomicity, reaction-entry preflight representation, full spell effects/lifecycle, innate/monster source paths and isolated controller/Host browser verification. Do not certify original absorb-elements or the full book from this synthetic temporary-HP test.

### Represent event-driven reaction spell entries in import gates

- Previous turn made progress integrating selected-slot replay; typecheck44894 exited0. Added a shared static damage-reaction entry contract used by Host preparation and spell graph preflight. It requires reaction metadata, before-damage/actor-choice, no effect-only or native-authority binding and exactly one matching base-level slot consumption. This only identifies a possible event entry; it does not certify live component/resource/behavior eligibility.
- Reachability still prefers the normal active cast. With explicit spell metadata it can start from a full contracted reaction instead; missing metadata, wrong event, automatic confirmation, no slot, mismatched minimum or wrong casting time do not qualify. Package active-cast selection is unchanged: the reaction is delivered by the damage checkpoint, not a normal casting button.
- Four suites42tests passed; added integrated PDF preflight test then preflight15tests passed. The synthetic valid event entry no longer gets a false missing-entry error but remains blocked by the independent before-damage behavior boundary, with behaviorVerified:false. Existing absorb-elements source uses reaction-window/no slot and is not promoted or edited. No API calls, user-room writes or certification count changes.
- Final typecheck86736 live after all code/test edits. Continue material atomicity and full reaction lifecycle/network validation. Saved consolidated r3 predates this contract change and must be refreshed at the next batch audit, not treated as fresh evidence.

### Distinguish retained materials from material inventory writes

- Previous turn made progress on event-entry preflight; typecheck86736 exited0. Inspected the actual material settlement and damage replay: material plans may be read-only requirements, while the replay only carries a combatant and cannot silently drop character inventory changes. Host map authority guard already snapshots characters as well as map/geometry/time across remote choices.
- Reaction preparation now validates the selected material allocation with the existing immutable inventory settlement helper and reports requiresInventoryWrite. A nonconsumed retained material can execute without an inventory write; consumed allocations and spell-end escrow remain blocked at discovery, confirmation and commit. No material is actually consumed by preparation. Invalid allocation/revision rejects before slot spending.
- Expanded live damage flow tests: retained250gp component permits the selected reaction while preserving the entire original character/inventory; absent component never offers it; consumed component stays unavailable and leaves slots/reaction untouched. Initial synthetic spell omitted required materialText and correctly failed registration; fixture corrected. Flow/preparation20tests passed.
- No paid API calls, source artifact edits or user-room changes. Consumed/escrow materials still require a transaction-wide character settlement ledger and integration with all direct/prepared map commits; do not claim material automation complete. Final typecheck27774 live after these changes. Original-source certification unchanged.

### Transaction-local material ledger foundation

- Previous turn made progress on retained-component execution; typecheck27774 exited0. Inspected direct/prepared damage replay and map applications: a combatant-only continuation cannot safely publish inventory changes, and replays must reconstruct staged costs rather than mutate room characters while waiting.
- Added createDnd5eDamageReactionMaterialLedger, a transaction-local immutable-source helper. It canonicalizes shared ownership across multiple tokens, rejects conflicting owner snapshots, applies existing material allocation/revision validation, deduplicates exact receipt replay, rejects changed receipts/stale allocation plans and returns one inventory/equipment change per owner with original inventory/revision provenance. Cancellation drops all staged data; finish closes the ledger. Retained materials produce no write and spell-end escrow remains explicitly unsupported here.
- Three tests passed covering shared owner sequential costs, exact replay, stale revision/receipt conflicts, preserving unrelated equipment, cancellation, owner snapshot conflict, retained materials and escrow rejection. Initial test wrongly expected the normalized wizard's entire inventory to become empty; corrected to verify only the material instance is removed and unrelated entries survive.
- The ledger is not yet wired into damage sessions or final map/character publication; consumed reaction materials remain blocked. Next step is replay-local ledger reconstruction and carrying final staged changes through direct/prepared result publication with revision checks. No paid calls, original config changes or user-room writes. Final typecheck93605 live; retain handle.

### Opt-in damage replay material staging

- Previous turn made progress adding the immutable material ledger; typecheck93605 exited0. Added Host-only opt-in material context to direct damage sessions and generic prepared sessions. Each replay reconstructs its ledger from frozen original characters, exposes cloned staged participants at the pending checkpoint, and only returns final materialChanges when the owning resolver reports success. Cancel/failure discards staging. Default sessions and live UI remain unchanged until publication integration is added.
- Checkpoint reaction settlement accepts an internal ledger, uses its canonical current character for eligibility/components, then stages material consumption only after Activity commit and personal-state scope validation succeed. Material-writing discovery is an explicit Host capability; spell-end escrow still rejects. Preview acceptance uses a separate disposable ledger, preventing preview plus replay from charging twice. No untrusted action payload can provide a ledger.
- Added an integration case using a real consumed material, two-level reaction, raw incoming damage and authoritative dice. Completed replay returns the expected HP/slot state and exactly one inventory patch with original revision; source character and combat state remain unchanged, and a completed session rejects rerun. Existing flow/session/ledger suites27tests passed. Generic prepared session support still needs dedicated material acceptance tests and actual caller publication wiring.
- No API calls, original draft edits or user-room mutations. Material-capable sessions are not yet used by live damageReactionFlow, so consumed materials remain blocked in user flows. Next: merge staged character changes into direct/prepared map applications under original revisions and verify cancellation/failure/network paths. Final typecheck29210 live; retain handle.

### Material-aware prepared facade and pre-publication merge

- Previous turn made progress on opt-in replay staging; typecheck29210 exited0. Ledger changes now retain original equipment as well as inventory. Added mergeDnd5eReactionMaterialsIntoMapPlan: validates all owners, inventory revisions/content and equipment before constructing an immutable combined application; preserves HP/class-resource patches and adds material-only owners to changedCharacterIds. Repeated merging or competing inventory/equipment changes reject rather than overwrite or spend twice. Same-transaction competing inventory edits currently require explicit composition and are not silently rebased.
- Added resolveDnd5ePreparedWithMaterialDamageReactions, an opt-in typed facade for resolvers returning a result plus map application. It passes staged characters through discovery/confirmation, enables material-writing checkpoints only when the final merger is present, and merges successful material changes before returning. Failed results publish no staged materials; success without an application throws. Existing callers have not yet switched to this facade, so user-facing consumed materials remain blocked.
- Initial application/ledger/flow suites19tests passed. Extended integration test then flow/ordinary-flow/application suites28tests passed: actual damage pause, selected second-level spell, consumed material, and returned combined application retain18HP/zero second-level slots and remove exactly the material, without mutating source characters. Tests also reject inventory revision/content/equipment conflicts, absent/duplicate owners and double application.
- Final typecheck38741 live after all edits. Remaining: use the opt-in facade at appropriate real prepared callers, provide equivalent finalization for direct result callers, reconcile internal nested damage boundaries and competing main-action inventory costs, then server CAS/rollback and browser acceptance. No API calls or original source certification changes.

### Prepared page damage reactions now carry material application changes

- Previous goal turn only restated the batch policy (no progress). Revalidated the live tree and recovered terminal success for prior typecheck38741 before editing. No paid API calls.
- Switched the synchronous prepared branch of MapsWorkspacePage.resolveDnd5eFacadeWithAirborneFalls to resolveDnd5ePreparedWithMaterialDamageReactions; generic facade typing now carries optional application/result. A successful consumed-material reaction without an application rejects before return. Failed or absent action results discard material staging. Direct raw-result and nested internal boundaries retain their previous material-blocking behavior pending explicit carry-through integration.
- Added material facade failure cases: missing application, competing inventory revision, authority change during confirmation, downstream action failure. Existing flow/application suites32 tests passed. Then replaced the manually assembled successful application fixture with the actual planDnd5eMapResultApplication function, verifying character HP18, Token HP18, second-level slot0, and removed material in character patches. First run found the test map omitted the attacker token; corrected the fixture. Final reaction spell suite15 passed; source character and combat state remain unchanged in all cases.
- Updated AI SDK guide to describe the limited prepared-entry support and outstanding direct/nested, spell-end and competing-inventory boundaries; guide15 tests passed. This is synthetic mechanism evidence, not original PDF conversion certification or server/browser acceptance.
- Typecheck67298 reported one optional inventory revision in the new conflict fixture. Fixed with explicit null-default increment. Final typecheck68455 running; retain handle. No real room writes, API requests or original draft edits. Next: direct/nested application carry, main-action material coexistence, authoritative publish/CAS failure tests, and isolated browser acceptance. Common application construction alone does not prove atomic server publication.

### Nested feature damage boundaries carry materials to the outer application

- Previous turn made progress wiring prepared callers. Recovered typecheck68455 exit0 before this batch. No paid API calls.
- Added Host-only resolveDnd5eDamageBoundaryWithMaterials returning result plus staged material changes. Its success predicate is supplied by the owning facade, not plugin/player payloads. The plugin feature facade now supports this boundary for both worker capability commits and normal synchronous action commits, discards changes on failure, and merges them only into the final map application. The page now supplies this boundary; the worker still executes outside replay scope. Legacy callback support remains for existing callers.
- Worker integration fixture now runs legacy and material-aware variants: missing fall dice produces no application; later success retains HP/condition/elevation changes and merges a real material ledger removal into the enemy character patch, with original character unchanged and worker resolve count1 across retry. This fixture supplies trusted synthetic staged changes to isolate the facade integration; it does not itself prove spell-choice behavior.
- Feature/spell suites41 tests passed. Added a separate actual selected reaction-spell integration through the new nested boundary plus real map application planner: final reaction spell suite16 passed. It verifies consumed material, slot2 depletion, character/Token HP18 and immutable inputs. Together these are local mechanism evidence, not original source conversion or browser/server certification.
- AI SDK guide now distinguishes supported nested feature boundaries from still-pending direct-result boundaries, spell-end escrow and competing main-action inventory writes. Final typecheck17906 live; preserve handle. Remaining fullbook scope and API batch gate unchanged; original drafts and user rooms untouched.

### Direct action material application adapter and first page routes

- Previous goal turn made progress on nested feature settlement; recovered typecheck17906 exit0. No paid API calls.
- Audited raw result callers: single legendary actions, manual monster adjudication, item-area loops, deflect-return followups and death-save concentration settlement construct applications differently. Do not enable material-writing for every raw caller before its downstream application actually carries changes.
- Added resolveDnd5eActionWithMaterialDamageReactions with explicit map/character/mapping context. It derives reaction character inventory from that context (including staged characters), uses the real map planner for successful results, merges reaction material changes and returns application alongside the raw action result. Failed results have no application. This avoids putting inventory metadata on persisted combat states or relying on a hidden WeakMap.
- The private page airborne helper accepts optional material context, keeping unswitched callers blocked for consumed materials. Legendary movement and legendary check branches now pass their snapshots and use the returned application. Remaining raw paths, including area loops and deflect/concentration chaining, are not claimed complete.
- Actual reaction spell direct-adapter integration added to the same map-planner fixture. Spell/ordinary-flow suites28 tests passed, including selected slot depletion, consumed inventory, character and Token HP changes, immutable inputs, and earlier failure paths. AI SDK guide records the precise limited route coverage.
- Final typecheck24905 live; preserve handle. Main-action/reaction competing inventory consumption still rejects rather than rebases, spell-end escrow remains unsupported here, and server CAS/browser acceptance remain outstanding. No original PDF configurations changed; these local synthetic tests are not conversion certification. No user-room writes.

### Direct caller sweep and concentration patch preservation

- Previous turn made progress adding the direct adapter; recovered typecheck24905 exit0. No paid API calls.
- Switched remaining page direct-action paths: both manual monster adjudication variants, legendary teleport/adjudication, all three deflect-return routes, death-save turn, and item-area movement sequence. Follow-up concentration settlement receives the returned map/characters plus priorApplication. Item-area sequences carry staged characters and map to subsequent triggers, then compare final changes with original characters. The helper now requires explicit material map context; no silent fallback to material-blocking raw flow remains on this page.
- TypeScript AST audit found all11 calls to resolveDnd5eHeadlessActionWithAirborneFalls have5 arguments with explicit context. This is wiring evidence, not per-action UI acceptance.
- Found and fixed a shared follow-up bug in settleDnd5eConcentrationChecks: spreading patch records replaced an entire character/token patch when the same entity received later changes. Merge each entity's fields instead, retaining prior inventory changes while newer combat-state fields win.
- Added a real direct reaction + actual concentration settlement case: failed concentration changes combat state without losing consumed inventory in the final character patch. Spell/concentration suites36 tests passed. Added a second direct settlement using consumed staged inventory with reset combat eligibility to isolate material availability: no reaction choice or roll is offered and inventory stays consumed. Final spell/guide suites34 tests passed (19spell,15guide).
- Typecheck70170 is still running; final required-context signature and sequence-test edits happened after it started, so a final incremental check will be required after completion. No original PDF configs or live-room writes. Remaining: concurrent main-action inventory plans, spell-end material lifecycle, server commit/CAS/rollback and isolated browser acceptance. Original source conversion counts unchanged.

### Reserve primary spell material cost before damage reaction discovery

- Previous goal turn made progress sweeping raw page callers and fixing per-entity concentration patch merge. Recovered typecheck70170 exit0, then started the present batch; the final check here includes its later required-context edits. No paid API calls.
- Inspection found prepared spell resolvers apply their primary material plan after Headless damage returns. Previously a reaction could see materials that the original cast had already committed to consume, then collide with the primary inventory revision at final application merge.
- Added prepareDnd5eDamageReactionMaterialCharacters. It takes a cloned prepared roster, privately applies a cast-time primary spellMaterialPlan, and uses the resulting inventory for all tokens sharing that character. The original resolver still settles its original plan once; the reaction ledger's baseline now matches that primary settlement. Invalid/missing primary ownership rejects before reaction discovery. Spell-end plans are not converted to immediate consumption. No stores, input characters, or plan revisions are rewritten.
- Prepared material-aware flow now uses that baseline. Synthetic compound-action integration verifies two units can pay primary and reaction costs exactly once (revision+2); one unit pays only primary cost, produces no reaction choice/roll, retains its reaction/slot and takes full incoming damage (revision+1). Spell flow21 tests passed. Added4 preparation tests covering token aliases, staged roster preference, stale/missing primary context, immutable inputs and spell-end non-consumption.
- Preparation/application/plugin-spell suites19046 and final typecheck40993 were running at this note; retain handles. SDK guide describes cast-time primary-plan coexistence without claiming arbitrary inventory writes or spell-end lifecycle complete. Still need original spell source configurations, full publish/CAS and isolated browser acceptance; no source certification count changed and no live-room mutation.
- Preparation/application/plugin-spell suites19046 completed:125tests passed. Final typecheck40993 remains live.

### Primary spell-end reservation and indirect map-interaction callback

- Previous turn made progress on primary cast-time material ordering. Typecheck40993 terminated with TS2322: the required fifth material context was incompatible with mapInteractionActionProcessor's callback signature. The preceding direct-call-only audit missed this indirect use; do not treat that audit as complete callback coverage.
- Extended the map interaction callback contract to require material context and carry optional application. Both interact-object economy and scene-interaction-outcome calls pass staged map/characters. Successful results update that staged context; final map planning uses original characters as baseline before inventory rewards. This resolves the missing callback integration without reintroducing a material-blocking fallback.
- Primary spell-end materials now reserve in the reaction roster using the same shared dnd5eSpellMaterialEscrowBinding as pluginSpellTransaction. The original cast still owns lifetime creation and escrow finalization. Missing binding rejects before discovery; no immediate destruction is substituted. The preparation test compares its exact reserved character with the actual reserveDnd5eSpellMaterials result and checks original inventory remains unchanged.
- Material preparation/escrow/plugin-spell/map-interaction suites125tests passed. The map-interaction file's existing tests only cover adjudication decisions, not full inventory-through-interaction behavior; new callback integration is not yet behavior/browser certified. Primary spell-end plus an actual reaction still needs a full compound lifecycle test. Reaction-owned spell-end materials remain blocked.
- Final typecheck35379 live; preserve handle. SDK guide clarifies primary reservation versus reaction lifecycle support. No paid API calls, original source conversion changes, or user-room writes. Remaining server CAS/rollback and fullbook acceptance scope unchanged.

### Compound material lifetime and real HTTP publication evidence

- Previous turn made progress adding primary spell-end reservations and fixing the indirect map-interaction callback. Recovered typecheck35379 exit0. No paid API calls.
- Extended the synthetic reaction flow integration with a primary spell-end escrow plus a cast-time reaction using the same two-unit material stack. The resolver installs a synthetic primary lifetime effect and uses the real escrow reserver; selected reaction consumes only the remaining unit. Actual end-turn actions expire the lifetime, actual map planning finalizes the reserved unit, and a JSON round-trip plus repeated planning does not increment revision or consume again. Final reaction spell suite22 tests passed. This uses a synthetic primary resolver, not an imported original spell or full plugin UI.
- Added a focused real HTTP transaction test in sharedServerCombatTransactions.test.ts. It runs the existing disposable5492 server with a temporary shared root and disabled AI/voice config, creates a test room and player, generates a real material ledger change and merged application, and submits characters/maps together. Stale map revision returns409 with both prior snapshots unchanged; player-authored transaction returns403; Host commit succeeds; player reads depleted inventory, HP18 and slot0; stale retry returns409 without another change. One focused test passed,32 unrelated tests skipped. HP/slot values in this server fixture are synthetic; actual reaction arithmetic is covered by the separate flow test, so this is composed mechanism evidence, not an end-to-end imported spell certification.
- Final typecheck2881 running. No user5273/5274 room mutation. Still outstanding: reaction-owned spell-end lifetime, arbitrary concurrent inventory operations, full map-interaction controller behavior, browser accepted flow and original fullbook source conversion/regeneration/acceptance. Goal remains active.

### Fresh whole-book offline audit and exact diagnostic reviews

- Previous goal turn made progress on compound lifetime and HTTP publication tests; recovered final typecheck2881 exit0. This turn returns to whole-book scope rather than treating synthetic material coverage as source acceptance.
- Replayed all exact-source unedited automatic candidates through current preflight with FULLBOOK_OFFLINE_REPORT=fullbook-consolidated-preflight-20260927-r4.json. Offline audit passed,155entries:32ready-for-behavior-tests,123blocked. Generated immutable fullbook-mechanism-backlog-20260927-r4.json:839distinct diagnostics/945source links. These are saved configuration diagnostics, not839 missing engine mechanisms. Counts remain unchanged because source drafts were not regenerated or manually edited.
- Inspected highest-sharing diagnostics:68entries explicitly contain DM adjudication operations;20 feature/feat drafts declare partial/manual;15 lack executable binding. These statements identify draft requirements for review, not permission to delete manual boundaries or classify deterministic rules as narrative.
- Migrated exact unchanged diagnostic/source/candidate scopes from reviewr7 (backlogr2) to reviewr8 (backlogr4). Added a narrowly scoped Absorb Elements eligible-entry review: the current before-damage actor-choice/selected-slot contract can express the missing entry, while the original reaction-window/free-cost draft remains invalid. Refined the pre-existing Magic Stone 60-foot-range review to expressible for that exact clause; object transformation/lifecycle/full source remain uncertified. Initial write attempt correctly failed duplicate-review validation, wrote no output; corrected by updating that existing row rather than duplicating it.
- Reachability/equipment authority suites62tests passed. Generated fullbook-review-coverage-20260927-r3.json with evidence hashes:11reviewed diagnostics,7expressible links,4partial,934unreviewed;122entriesawaitmechanismreview,1awaitbatchregeneration,32existingpreflightready. paidConversionGatePassed remainsfalse. A queued regeneration entry is not a complete spell and does not authorize starting the paid batch early.
- Updated batch workflow's stale33/122 opening count to32/123 and documented why the stricter entry check revoked the older Absorb Elements preflight. All reports private under existing local-import-tests root; APIcalls0, no source edits or real-room writes. Fullbook goal remains incomplete.

### Separate unsupported source claims from engine gaps

- Previous goal turn made progress with the fresh155-entry audit and r8 reviews. This turn inspected the actual Magic Stone source text from the verified user PDF inventory, rather than accepting the generated unsupported statements as requirements.
- Found an added restriction in the old diagnostic: unworn/unheld stones. That restriction is not in this extracted spell text. Documented exact source ID/text SHA-256 and limited interpretation in docs/verification/2026-09-27-fullbook-source-claim-review.md. This does not prove generic object selection or existing-pebble transformation exists, and does not silently remove the diagnostic.
- Extended review coverage with source-claim-not-supported and a separate sourceCorrectionLinks count. This category stays unresolved, cannot become runtime support, cannot advance an entry to batch-ready or source certification, and does not pass the paid gate. Four tool tests passed including these invariants.
- Reviewed actual equipment attack evidence: source ability snapshot after transfer, correct 1d6+source damage, and thrown versus sling delivery with possession/range validation. Added two exact-clause runtime reviews, refined the pre-existing source-modifier review, and added one source-correction row. Did not certify magic ending on existing stones: consuming/deleting a temporary projectile is not proof that the ordinary original stone survives. Recast cleanup and full source lifecycle remain outstanding.
- Immutable reviewr9/coverager4 against backlogr4 saved.14reviewed diagnostics:10expressible links,3partial,1source correction,931unreviewed;122entriesawaitmechanismreview,1awaitbatchregeneration. First generation attempt rejected an existing source-modifier review rather than duplicating it; corrected by updating that scoped row, retaining evidence. No preflight readiness or source acceptance count changed.
- No paid API calls, original draft rewrites or live-room mutation. Next prioritize actual existing-object transformation/lifecycle gaps and batch diagnosis of manual boundaries rather than infer support from item generation alone.

### Existing inventory object alteration foundation

- Previous turn made progress separating source corrections from runtime gaps. Inspected item generation/expiry/attack consumption and confirmed deletion of a generated item cannot represent ending magic on an existing mundane object.
- Added Host-only immutable alterDnd5eInventoryItem/restoreDnd5eInventoryItem primitives and spellAlteration original-form metadata. Transformation validates inventory revision, quantity, split identity, binding and source modifier; splits selected units, preserves unselected ones, stores an original form, and never mutates input. Restoration preserves current instance identity, quantity, holder/container placement and acquired time, and does not re-equip an obsolete original slot or duplicate the pre-split stack quantity.
- Existing transfer now preserves the stable original-form record on the whole selected altered stack, as with other bound objects. Source-effect expiry restores altered existing objects while continuing to delete genuinely conjured items. Unknown source owners remain unknown; their objects are not prematurely restored.
- New tests cover durable JSON/normalization, split/restore quantity conservation, stale and invalid requests, real cross-character transfer, restoration at the current holder, unknown-owner preservation and repeated expiry. Initial test found legacy remainingCharges was not rejected with resource-bearing objects; fixed. Item/temporary-weapon/alteration suites60tests passed.
- Deliberate current limitations: these primitives are not yet exposed as an Activity operation or player selector; partial transfer of an altered stack follows the existing bound-object full-stack restriction; attack consumption has not yet restored individual used projectiles; nested/charged/container/attuned transformations reject rather than guess recovery semantics. Shared payload validation/projection and real import/export/browser acceptance still need explicit checks. Do not count Magic Stone or any original source as complete.
- Final typecheck4152 live. No paid API calls, source configuration edits or live-room writes. Next wire individual attack restoration and Activity authoring/Host selection, then validate persistence and lifecycle composition.

### End magic on one resolved projectile without deleting the ordinary object

- Previous turn made progress with existing-object alteration and source-end restoration; recovered typecheck4152 exit0. No paid API calls.
- Added releaseDnd5eAlteredProjectile: a successful attack ends the alteration on one selected unit, preserves other altered units, and stores the original mundane form in releasedObjects outside usable inventory. This does not silently retrieve a thrown stone into the hand/backpack. Final-unit release removes the altered slot/equipment; deterministic released identity derives from instance+inventory revision and duplicate collisions reject.
- consumeDnd5eWeaponAmmunition now routes altered source-powered projectiles through that primitive. Generated projectiles keep their existing consume/delete semantics. Inventory normalization and JSON round-trip retain released mundane objects as unequipped/uncontained records without making them usable stock.
- Parameterized actual equipment authority test with generated versus altered objects. The altered case transforms original registered material into a synthetic projectile, maintains an actual source effect, transfers/equips it, and runs Host hit/miss/invalid-roll/thrown/sling flows. Hit and miss preserve one ordinary released object and two altered usable units; invalid resolution has no application. Item/alteration/equipment suites109tests passed. Added three-unit repeated-release/normalization test; final alteration suite9passed, verifying unique released identities, final-unit exhaustion, source cleanup preservation and no repeat use.
- This is synthetic item mechanism evidence, not original Magic Stone certification. Still missing Activity operation/selection and host template authorization, partial altered-stack transfers, shared payload validation/projection, visible release/recovery handling and exact location/recovery adjudication. No arbitrary recovery position is invented. New records must be fully validated before exposing player authoring.
- Final typecheck24332 live. No original source config edits or user-room writes; fullbook counts unchanged.

### Shared validation and player projection for altered objects

- Recovered prior typecheck24332 exit0. Kept all work offline; paid API calls0 and original source drafts unchanged.
- Added shared inventoryAlterationIssue validation to both server shared-state validation and client migration validation. Rejects mismatched source bindings, nested alterations, quantities exceeding the original, invalid released-object arrays, equipped/container-bound released objects and duplicate released identities. Legacy inventories without the new fields remain readable.
- Player projection now redacts unidentified original-form snapshots and released objects, preserving ordinary public form information without exposing hidden item templates or rules. Host input is not mutated.
- Initial new test mistakenly expected the client validator's return shape to have ok; corrected assertions to its existing status contract. Four targeted suites passed86tests: shared alteration validation/projection, shared-resource validation, alteration lifecycle and equipment attack authority. Existing shared-server character/unidentified projection subset passed4tests,167skipped. This is local mechanism evidence, not full HTTP/browser or original-source spell certification.
- Final typecheck35541 started after implementation and remains tracked pending completion. Activity authoring/selection, template authority, partial transfers and visible recovery remain outstanding; whole-book acceptance counts and paid-conversion gate are unchanged.
- Final typecheck35541 completed exit0; targeted diff whitespace check passed. No additional API calls or acceptance-count changes.

### Registered Activity operation for existing-object alteration

- Previous goal turn made progress with shared validation/projection; final typecheck35541 was verified exit0. Continued offline only.
- Added alter-inventory-item contract and structural validation: actor-owned selected original, explicit nonempty unique original-template allow-list, registered replacement template, quantity formula and required source effect. Executor generates the lease tag on the actual actor effect applied by this execution, using the same lease allocator as generated items; missing applied parent fails.
- Wired the Host Activity authority bridge to reload and normalize the selected inventory, validate instance/revision/owner/template, stage the immutable alteration primitive, strip its handled proposal and commit the actual Headless effect/action. Failed commit returns no inventoryOwner. Stale replay cannot create more objects. Selected item-charge plus alteration currently rejects rather than allowing the charge branch to overwrite the staged alteration.
- New synthetic Activity tests exercise selected-stack split, actual source tag, action consumption, stale replay, ordinary-form restoration, missing/stale/wrong-owner/unknown-replacement/excess-quantity/missing-source/failed-action rejection and definition validation. First fixture accidentally selected default starter equipment and assumed an obsolete action shape; corrected fixture to explicit empty inventory and actual actionAvailable/action-economy contract. Three targeted Activity suites passed77tests.
- Deliberately kept plugin Headless compiler compatibility false for this new operation until its spell/map handoff and selector are wired. SDK describes the exact current boundary. This is a real registered Activity bridge capability, not yet original Magic Stone or imported fullbook spell acceptance. No source draft edits, paid API calls or live-room writes; acceptance counts unchanged.
- Final typecheck79027 running; preserve handle. Next wire the common selection UI and compiled spell/application route with Host inventory authority rather than exposing a partially handled operation.
- Added wrong-original-template rejection and asserted the exact failing phase so negative tests cannot pass merely on an unrelated command failure. Final focused suite10passed (the preceding broader run had77passed). Typecheck79027 completed exit0 and scoped whitespace check passed. Goal remains active and no paid calls were made.

### Common inventory selector and Host character identity

- Previous turn added a real registered Activity alteration operation and passed typecheck79027. This turn connected alteration to the common inventory selection helpers already used by trigger confirmation, the plugin panel and spell targeting UI. Chosen outcomes control whether selection is required; ordinary allowed objects now appear with current quantity and inventory revision. Equipment-only snapshot checks remain separate, so a mundane object is not rejected merely for lacking weapon/armor data.
- Selector excludes already bound, destroyed, charged, attuned and container objects and checks available quantity for constant formulas. Host retains independent authority checks; quantity formulas still resolve there. Added primitive rejection of destroyed originals.
- A failing selector test exposed normalization dropping legacy remainingCharges on a mundane template. Both selector and Host bridge now inspect this field before normalization can erase it. The corrected three-suite run passed30tests; later focused suite18passed including exact rejection phases, chosen-branch selection, forged owner, legacy charges, and real selector-to-bridge submission.
- Host alteration now uses actor.characterId from its trusted snapshot when the acting combatant/token id differs from the character inventory owner. A dedicated token-actor versus actor test verifies the real effect tag and character-owned original-form record. This does not accept a client-supplied character mapping.
- Compiled plugin spell support remains explicitly blocked until the compiler handoff and map/application settlement are wired. Common UI data plumbing is tested locally, not browser-certified. No automatic source drafts modified, original spell certified, paid API calls or real-room writes. Wholebook goal remains active.
- Typecheck70435 is running. Some identity changes occurred after its start; verify its terminal result then run an incremental final check for the latest state if needed. Scoped whitespace check passed.
- Typecheck70435 completed exit0. Started final incremental typecheck74293 because the Host character-id mapping changed after the earlier check began; handle confirmed live, no terminal result yet. Next compiled-route work must provide Host ordinary-object facts (current activityEquipment.inventory snapshots contain only weapon/armor), add alteration handoff settlement to both spell application paths, and only then remove the compatibility rejection. Existing pluginSpellTransaction already forwards selected instance/revision payloads.

### Central spell and feature inventory handoff settlement

- Previous turn made progress with shared selector and Host identity. Recovered typecheck74293 exit0; no paid API calls.
- Added settleDnd5eActivityInventoryAlterations as a Host-only staged handoff. It checks exactly one baseline/current owner, the player's observed baseline revision, selected instance/owner, registered replacement and original allow-list, plus the actual source tag on the resolved combatant effect. It applies alteration to the current staged inventory, so earlier cast-time material consumption is preserved and can make the requested alteration insufficient. Legacy charge checks precede normalization. Failure returns no changed roster.
- Added inventoryAlterations handoff type and compiler extraction. The compiler uses equipment-only selection checks only for equipment enchantments; ordinary-object authority belongs to the Host settlement. Kept the explicit compiler compatibility rejection until a complete compiled spell/feature route is behavior-tested, so new automatic imports still cannot advertise this as supported prematurely.
- Wired the helper before map planning in both pluginSpellTransaction's Activity path and pluginFeatureAction. Spell settlement uses the already staged material roster plus original baseline; invalid alteration returns original combat state/empty events and a rolled-back transaction. Feature failure returns original state and no application. Planner receives original baseline so inventory changes become publication patches instead of being silently treated as unchanged input.
- Five new synthetic handoff tests use an actual registered Activity resolution and actual Headless effect commit, then a staged material-cost inventory: success preserves the earlier quantity/revision change; stale baseline, missing source effect, insufficient post-cost stock and wrong owner fail without input mutation. Three suites (alteration, plugin feature and plugin spell) passed164tests. The old feature/spell suites are regression evidence, not a new compiled original-source flow certificate.
- Final typecheck25745 running, scoped whitespace check passed. Remaining compiled route testing/compatibility enabling, plugin authoring/import dependency coverage, recast/recovery lifecycle and wholebook acceptance still incomplete. No source drafts modified, user-room writes or paid API calls.

### Compiled spell route and module item reference verification

- Previous turn made progress with handoff settlement. Recovered typecheck25745 failure: plugin payload is a JSON union, so property access required an object/non-array guard. Added guards in both feature/spell settlement; no unsafe casts or trusting primitive payloads.
- Enabled compiler compatibility for alter-inventory-item and added the operation to the core mechanics registry. First full-route test failed spell-not-headless despite successful compilation; registry omission was the cause. After registration, four compiled spell tests passed: success publishes the changed inventory alongside the actual effect, spends one action/slot, and captures the caster modifier; stale revision, wrong owner and insufficient stock return original state/empty events/no application. Uses real registered synthetic plugin, character preparation, compiled action and pluginSpellTransaction; not an original-source or browser certification.
- Broader four-suite regression passed171tests (spell, feature, alteration and mechanics registry). Added runtime local-item namespace resolution for both replacement and originalTemplateIds in ContentPackageV2. External qualified IDs remain intact and signed archive input is unchanged; resolution is idempotent. ContentPackageV2 suite29passed. Export/import full-module roundtrip and a dedicated compiled feature alteration flow remain to verify.
- Updated the local AI SDK guide with the operation and its actual boundaries; no conversion was invoked. Wholebook source readiness counts remain unchanged. Final typecheck96530 live; item reference and guide changes occurred after it started, so latest-state incremental validation remains to confirm. No paid calls or live-room mutation.
- Typecheck96530 completed exit0. Documentation now reflects enabled compilation and the verified synthetic spell route rather than the earlier temporary rejection. An incremental check after the final item-reference/SDK edits remains for the next batch; no live check is left running.

### Real archive roundtrip exposed and fixed Activity-only feature installation

- Previous turn made progress with compiled spell behavior and local item reference resolution. Continued offline; no paid API calls.
- Added a synthetic complete ContentPackageV2 feature module, exported through exportLegacyDnd5eStarMod, decoded through readLegacyDnd5eStarMod, installed through dnd5eRulesPluginFromContentPackageV2 and executed through prepare/resolvePreparedDnd5ePluginFeatureAction. Initial fixture omitted two required empty contribution arrays; fixed the fixture before diagnosing actual runtime failures.
- Real failure1: customRulesPlugin draft validation required every referenced action in legacy headlessActions even when a validated, compilable Activity with the same id existed. It now accepts that compiled recipe while still rejecting missing/uncompilable references. Negative archive export assertions exercise both cases.
- Real failure2: ContentPackageV2 skipped Activity compilation whenever its id matched the feature/feat action id, assuming a legacy action already existed. It now skips only when a matching legacy recipe actually exists. This retains legacy handling and enables explicit Activity-bound features/feats.
- Roundtrip test verifies unmodified source archive data, retained activity, actual inventory/effect publication by the installed compiled feature, quantity conservation and stale-selection rejection. Uses real map facade with distinct token/character IDs. It is a synthetic V2 compatibility .starmod roundtrip, not a native unified module, original-source conversion or browser/HTTP certification.
- Four suites (plugin feature, ContentPackageV2, custom rules validation, community module SDK) passed75tests. After adding negative reference assertions, focused archive/feature test passed again. Typecheck83167 live, started after all code changes; preserve handle. Fullbook goal and acceptance counts remain unchanged, no live room writes.

### Native .starmod local-item references and description preservation

- Previous turn made progress with the V2 compatibility archive and feature route. Recovered typecheck83167 exit0. All current work remained offline, with no paid conversion or live-room writes.
- Changed the compiled alteration spell integration fixture to actually export/read a native unified .starmod and install that decoded bundle before preparing/resolving the cast. The archive contains its own original and replacement item definitions, and the Activity refers to them by local IDs. Host still receives only character/instance/revision selection. This is a synthetic module, not original PDF conversion evidence.
- First native export/read failed because a valid payload-only description was replaced by an empty localization string. exportDnd5eStarMod now falls back to payload.description when the envelope description is absent, retaining explicit envelope text precedence. No copyrighted source text added.
- After description repair, successful settlement still failed because unified bundle installation did not resolve local item references (V2 had been fixed separately). The unified runtime adapter now clones the bundle and resolves declared local grant/alter templates, template variants and original allow-lists; external qualified IDs remain unchanged. Source archive and decoded input remain immutable.
- Initial native route four modes passed after fixes. Strengthened the fixture to include a local original template as well as a local replacement, and assert restored payload description plus input immutability. Full spell/unified/SDK/archive suites running as90719; final typecheck93910 running. Wholebook counts remain unchanged; browser and real-room/network acceptance are not claimed.
- Full native spell/unified/SDK/archive regression completed142tests passed. Ran current exact-source offline preflight with a new immutable r5 report:155entries,32ready-for-behavior-tests/123blocked,apiCalls0. Counts remain unchanged because saved automatic drafts were not regenerated or manually repaired; implemented mechanisms do not retroactively certify those drafts. Report: local-import-tests/fullbook-consolidated-preflight-20260927-r5.json. Typecheck93910 remains tracked live.

### Native feature and feat action registration

- Previous goal turn made progress on native spell/item archive routing. Recovered typecheck93910 exit0; current work is offline only.
- Parameterized the actual module export/import/compiled feature map-facade test with legacy V2, native feature and native feat forms. Native feature initially failed at validation because legacyDraftFromBundle omitted its Activities; the legacy action-reference validator could not see the real recipe. Passing the bundle's Activities to that adapter fixes this without inventing legacy effects.
- Installation then exposed missing Headless registration for native feature/feat payload actions. The native adapter now registers exactly one matching, compilable Activity owned by that feature/feat before registering its payload. Wrong source, missing/ambiguous match, authority-bound or incompatible actions reject; it does not infer an arbitrary action or promote assisted content to full automation.
- Native feat initially failed because the test used the feat ID as its feature-control ID. Corrected the test to use the actual registered feat.featureId and grant the actual dnd5eFeatIds ownership, preserving existing entitlement checks. All three archive routes now publish the altered inventory and source effect, preserve quantity and reject stale selection.
- Four suites (feature, native unified, community SDK, spell) passed162tests. Scoped diff whitespace check passed. Typecheck1931 running after all code changes; preserve handle. These are synthetic in-process module/facade tests, not an original PDF conversion or isolated browser/network acceptance. No paid API calls, live-room writes or fullbook acceptance-count changes.

### Offline batch review: relation terrain and composed save DC

- Recovered final typecheck1931 exit0. Continued the batch-first workflow with no paid API calls or live-room writes.
- Added generic Activity executor tests for Host-derived save DC = 8 + actor proficiency + CHA modifier, checking success/failure boundaries for two actor profiles. First fixture lacked required Host roll-mode context; corrected it. Executor and moving-terrain suites passed52tests.
- Rebuilt immutable backlog r5 from preflight r5 and compared entry/candidate/diagnostic links against r4: unchanged. Migrated exact scoped review r9 to r10 and added two narrow capability reviews: enemy-only difficult terrain (Nature Wrath) and generic Activity composed DC (Dragon Fear). Neither certifies the saved automatic draft or whole source item; the latter explicitly requires generic Activity regeneration instead of the old feat shorthand.
- Coverage r5:155entries,839distinct diagnostics,945links,16reviewed diagnostics,12expressible links,3partial,1source correction,929unreviewed links;122entries await mechanism review,1awaits batch regeneration. Paid conversion gate remains false. Preflight remains32ready/123blocked and fullbook goal remains incomplete.

### Shared target exclusion for condition immunity

- Previous goal turn made evidence progress; continued offline with zero paid calls and no live-room changes. Implemented creature/area excludedConditionImmunities across contracts, import validation, shared target filtering and conversion SDK guidance.
- Direct Activity Host snapshot was missing condition immunities; added authoritative data. Connected direct/compiled execution, per-target dice and trigger dice to the existing source-relative defense helper, including active/suspended effects. Missing immutable defense facts fail closed. Existing automatic-success-on-save is not substituted for complete target exclusion.
- Synthetic tests cover mixed eligible/immune targets, no initial save, temporary/suspended immunity, source-specific immunity, and action/resource consumption even when every target is excluded. Fixture corrections: area placement is required; consumption must be explicitly authored; conditional immunity uses sourceCreatureTypes. Initial typecheck76533 caught overly broad fixture controller types, corrected to minimal roll snapshots.
- Three focused suites passed91tests before adding source-relative cases; final93test run98084 live. Final typecheck46855 live (last source-specific fixture correction may postdate its read). No original drafts regenerated; no source/fullbook behavior certification or paid gate change. Persistent-area authored trigger inheritance, actual original configuration conversion and isolated player UI remain independent verification work.
- Final focused regression completed93tests passed; typecheck46855 completed exit0. Scoped whitespace check passed. Last fixture-only sourceCreatureTypes correction was exercised by the final tests; production implementation was in place before the final typecheck began. No live check remains running. Review counts and preflight32/123 remain unchanged because no automatic source artifact was converted or certified.

### Persistent-area target count audit

- Previous turn completed shared immunity filtering and local evidence. Current work remains offline, apiCalls0, no live-room changes.
- Inspected persistent trigger collection and wave settlement: no semantic256target cap exists. Added a synthetic300occupant test that verifies complete collection, all300save results, one shared damage pool, and actual prepared Host map transactions for occupants256,257,300. It does not claim all300 sequential state applications or browser performance were verified.
- Initial fixture had no initiative entries, so the authoritative snapshot correctly returned combatant-missing; supplied the real301entry roster. Large-map preparation exceeded the default5second test timeout; explicitly bounded this stress case at30seconds. Full pluginAreas suite68tests passed in21.77seconds, with15.46seconds in tests. This exposes material large-roster cost rather than a rule target cap.
- Updated conversion guidance to omit area maximumTargets for every eligible creature and distinguish explicit creature.count limits from persistent trigger enumeration. No original draft modified or converted.
- Exact scoped reviewr11 / coverager6 adds the prior immunity-exclusion mechanism and this target-cap audit.18reviewed diagnostics,14expressible links,3partial,1source correction,927unreviewed links;122entries still await mechanism review and1awaits batch regeneration. Preflight32ready/123blocked, paid gatefalse, original-source certification unchanged.
- Typecheck35195 running after new test (latest guide-only string update followed its start); preserve handle. Fullbook goal remains incomplete.
- Next common-path audit located15saved entries without executable bindings (8invocations,7feats). The current preflight intentionally does not certify arbitrary declarative abilities; only proven passive-defense and registered execution routes qualify. Do not relax this gate or promote partial drafts merely to improve counts. Inspect native feature/feat binding and triggered entry reachability next.
- Typecheck35195 completed exit0; scoped whitespace check passed. No live validation process remains. Latest guidance change only adds a string to the existing conversion instructions.

### Native feature/feat implicit active entry

- Previous turn made verified progress on persistent target count. Continued offline without paid API or user-room mutations.
- Found a shared native import gap: a feature/feat with one full active Activity but no duplicate legacy payload.action was downgraded to manual in the legacy catalog shell, so no map control existed. Added a guarded runtime projection using the existing Activity-to-feature-action adapter, and compile/register that exact owned recipe before catalog registration. No source bundle mutation or guessed effects.
- Only one owned active root may be inferred; payload/envelope and Activity must explicitly declare full automation, analysis must agree, and compiler compatibility must pass. Triggered, grant-only, continuation-only, ambiguous and authority-bound candidates are not guessed. Existing explicit binding behavior remains.
- Expanded actual native archive export/read/install and map-facade settlement to inferred feature and feat forms, alongside legacy/explicit-native routes:5modes passed, including quantity/effect application and stale selection rejection. Missing/ambiguous/triggered/manual/assisted/grant-required negatives verify no accidental button. First assisted negative caught analysis recalculating an authored partial capability as full; retained a separate authored-level guard.
- Feature/unified/SDK suites passed50tests before the last grant-required negative; final unified suite15tests passed. Typecheck28958 running; final grant/continuation guard and test were added after it began. No original PDF configuration certified; the15missing-binding entries still need per-mechanism review/regeneration rather than blanket promotion. Fullbook goal remains active, paid gatefalse.
- Typecheck28958 completed exit0; scoped whitespace check passed. No live check remains. Last root grant/continuation guard and its negative test passed the focused unified suite; no paid validation was invoked.

### Exact-source missing-binding inventory

- Previous turn made a real native import/entry fix. This turn inspected all15saved candidates for the missing-executable-binding diagnostic: every candidate has zero Activities. Thus the native entry projection cannot repair those saved declarations by itself; original acceptance counts remain unchanged.
- Extended the existing manual-boundary audit CLI with an optional exact diagnostic selector and an execution-declaration summary. It preserves exact-source matching, explicitly unedited run provenance, hashes and exclusive-create outputs. It does not infer narrative status or executable support from declarations. Three Node tests passed, including immutable summary and exact-source rejection.
- Generated private fullbook-missing-bindings-20260927-r1.json:15entries/15candidates/22manual-partial boundaries,0explicit operations. Added docs/verification/2026-09-27-fullbook-feature-binding-audit.md grouping all15by actual required mechanisms and recording that no Activity was generated. Independent generic Activities do not inherently require inventing class/level, but resource/entity prerequisites still need verified references.
- Next concrete check: source-specific hit events retain the original target, enforce once-per-turn and expire source-turn effects for the two invocation patterns. No paid API, live-room changes, or fullbook certification. No processes running.

### Spell attack provenance for Activity triggers

- Previous turn produced exact-source binding evidence. Current offline inspection found spell attack events lost the concrete spell identity: attack-hit windows only carried generic spell attack mode, preventing a reliable sourceId match for specific-spell invocation follow-ups.
- Added optional Host spellId/activityId provenance to attack-resolved events. Core single/multi-target spell attack paths emit their resolved spell definition ID; generic Activity commits emit their actual source spell and Activity ID. Trigger contexts retain the attack event kind/result/target while exposing that exact source ID, enabling event-source {source:'attack',sourceId:'...'} filtering.
- Expanded the real prepared Eldritch Blast multi-projectile test to check both committed events, original target identity, matching Eldritch Blast predicate and rejecting Scorching Ray predicate. SpellAction/ActivityCombatE2e/Invocation suites passed249tests. No client-supplied source names or inferred chat text used.
- This is source provenance evidence, not completed Grasp of Hadar/Lance of Lethargy certification. Once-per-turn, actor-choice, map pull and source-turn-end effect combination still needs dedicated integration coverage; those exact-source drafts stay blocked. No API calls or real-room changes. Typecheck46155 running; preserve handle.

### Specific-spell hit follow-up lifecycle

- Previous turn repaired real spell attack provenance. Recovered typecheck46155 exit0. This turn added a synthetic registered Actor-choice/free attack-hit follow-up using exact spell source, once-per-turn key and a speed penalty until next source-turn-end.
- Test verifies wrong spell and misses do not open the ability; forged target rejected; actual original target receives the effect; JSON reload retains use; direct repeat execution rejects; next source turn re-enables use; effect survives application turn end and expires at next source turn end. Fixture originally asserted speedBonus rather than the actual speedPenaltyFeet representation; corrected.
- Found real discovery gap: once-per-turn remained visible on later attacks although authority correctly rejected execution. Trigger discovery now filters already-spent direct once-per-turn requirements using the same Host turn key and stored usage as command settlement. It does not replace authoritative validation. Composite predicates and damage-checkpoint discovery are not newly claimed here.
- SpellAction/CombatE2e/Invocation regression250tests passed. Scoped exact diagnostic reviewr12/coverager7 marks original-target plus source-turn slow duration expressible, while source configuration and whole-feature certification remain false.19reviewed diagnostics/15expressiblelinks/926unreviewedlinks,122entries await mechanisms/1awaits batch regeneration. Preflight32/123 unchanged.
- Typecheck75346 running after all code/test changes; preserve handle. Next needed integration is actual map pull plus source-specific hit lifecycle (Hadar-style), and imported original feature/prerequisite/dual-client coverage. API0, no live-room changes, fullbook goal incomplete.

### Spell-hit pull map handoff integration

- Previous turn verified the source-specific slow lifecycle and repeat suppression. Recovered typecheck75346 exit0. Continued offline only.
- Added dnd5eSpellHitPullIntegration.test.ts connecting registered attack-hit discovery/confirmation/settlement to the real automatic directional destination helper and applyDnd5eActivityMapHandoffsV1. Accept moves the original target10feet toward its source; decline keeps map and usage unchanged; a closed movement-blocking door prevents passage while the accepted use is recorded. Source token and input map remain unchanged.
- The first fixture used an unregistered character feature ID, which normalization correctly discarded. Explicitly seeded synthetic Host entitlement and documented it in the test; this test does not certify character catalog acquisition, original-source import, UI callback state refresh or network atomicity. Those remain separate necessary checks. No source draft was manually repaired.
- Pull integration + map interaction suites running58484 reported both files passed; final count to recover. Typecheck24168 running after final fixture/door additions; preserve handle. No paid API, live-room edits or fullbook acceptance-count changes.
- Final pull/map regression53tests passed. Next validation must replace synthetic entitlement with actual imported native triggered feature ownership, then exercise UI map-state refresh and isolated room commit. Typecheck24168 remains tracked live.

### Native triggered feature/feat ownership and map state synchronization

- Previous turn added the map handoff fixture. Recovered typecheck24168 exit0. Replaced synthetic Host entitlement with actual native .starmod export/read/install, normalized character ownership and authoritative map snapshot. Tested both feature and feat definitions, accepted/declined/blocked movement and unowned characters (8modes). Triggered definitions deliberately do not gain a normal active button. Source bundle remains unchanged.
- Eight ownership/archive modes passed. This resolves the earlier fixture limitation for in-process native module installation; still not original PDF conversion or browser/network acceptance.
- Inspection found a real MapsWorkspacePage callback gap: accepted triggered movement replaced workingMap but left committed Headless positions/spatial relations unchanged and omitted movement events. Added synchronizeDnd5eActivityMapMovement to update moved combatants only, emit actual forced-movement events and refresh spatial relations before subsequent trigger discovery. UI callback and integration tests use the same helper.
- Native trigger/pull and map interaction suites passed58tests, including final Headless coordinate/distance agreement, actual movement events, ownership rejection and closed-door behavior. Typecheck25323 running after all code/test changes; preserve handle. No paid API or live-room writes; fullbook preflight/certification counts unchanged. Next required checks include isolated room atomic commit/player confirmation and original regenerated content.

### Trigger handoff failure and repeat boundaries

- Previous turn connected real native feature/feat ownership and map movement synchronization. Recovered typecheck25323 failure: committed.events is readonly. Changed movement synchronization to return a new event list, then assign it to the staged commit; callers no longer mutate the original list. Test passes a frozen prior event list to enforce that contract.
- Extended native archive integration with failed map handoff for both feature/feat. Failure leaves source combat state, position, use record, revision and appended events unchanged. Successful settlement followed by JSON reload and same-event/same-turn replay requests neither confirmation nor another map write; this uses the real once-per-turn guard.
- The repeat evidence is scoped: it does not prove a general durable event receipt for arbitrary triggers or delayed replay after turn advancement. Local settlement consumed IDs are per invocation; shared-server transaction idempotency and stale-event handling require separate verification. Do not call this network atomicity certification.
- A shell edit failed before updating callers while return-value tests were already running, producing4expected missing-movement-event failures; corrected both callsites and reran only the affected suites. Final tests30800 running; typecheck93363 running (caller fix followed its start), preserve handles. No API calls, live-room changes or original-source certification.
- Final affected regression60tests passed; scoped whitespace check passed. No test process remains. Typecheck93363 remains running and must be recovered before any subsequent restart.

### Isolated HTTP receipt and coupled feature-use persistence

- Previous turn progressed rollback/readonly-event handling. Recovered typecheck93363 exit0. Inspected server command/receipt handling before introducing any extra Activity receipt ledger: the room already persists paired command receipts with idempotency handling.
- Extended the existing real HTTP lost-response retry test to write a character feature-use record in the same transaction as map movement and command acknowledgment. Verified the player projection reads that record and character revision increments exactly once across the identical transaction retry; existing assertions verify replayed terminal receipt, map revision and continuation command acceptance.
- Checked port5492 was free, then used the test's new temporary server root and room, empty AI/voice config, and automatic teardown. Focused test passed1test/32skipped. No user5273/5274room touched, no paid API. Fixture authors a synthetic use record and movement; it does not run the original PDF spell or browser confirmation, so it proves room protocol coupling/replay only.
- General late event replay inside local Activity settlement is not separately certified. Existing outer command receipt avoids duplicate network application; UI event-batch identity and refresh/turn-boundary interactions still need end-to-end coverage. Fullbook remains incomplete with preflight32/123 unchanged. No tracked live validation process remains.

### Batched rest-resource evidence and conversion guidance

- The preceding reply only restated the batching policy and made no implementation progress. Resumed offline inspection of resource declarations and real campaign rest reconciliation; no blocker prevents work.
- Added registered feature and feat scenarios covering short-rest resources restored by either rest, long-rest-only resources preserved on short rest, unavailable resources without ownership, beneficiary filtering, immutable spent input, and spending again followed by JSON reload/replay of the same rest without another recovery. These exercise actual campaign-time reconciliation, not only enum validation or recovery report text.
- Four related suites passed 62 tests; conversion-guide suite passed 15 tests. Expanded the shared conversion guidance with the explicit feature/feat resources declaration and exclusions for combat-start, conditional and partial recovery. No new engine enum was needed.
- Review r13 and coverage r8 resolve only the exact resource-declaration/reset diagnostics for 飞蝇斗篷 and 幽魂凝视. Coverage now 21 reviewed diagnostics / 17 expressible links / 924 unreviewed links. Original drafts still require batch regeneration; no original feature or full-book certification was added. Mixed claims involving other mechanics, including 花开二度 and 魔力潮涌, remain unresolved.
- Paid API calls this turn: 0. No live-room writes. Preflight remains 32/123; paid conversion gate remains false. No validation process remains running. Production change is conversion-guide text only; no new full typecheck was launched for this batch.

### Actual combat-start recovery wiring

- Previous turn made progress with registered rest-resource evidence. Continued inspecting mixed reset/conditional recovery claims; discovered the existing resetOn:combat declaration was not applied by the production combat-start path. That path only applied native bard/monk initiative benefits and did so before filtering characters to the current map.
- Added recoverDnd5eCombatStartResources, combining existing generic combat-reset restoration with native initiative benefits. Wired the map start preparation/commit helper after the player/enemy token check. No recovery was inserted into startDnd5eHeadlessCombat: that function is also used to rebuild snapshots, where restoration would incorrectly refill spent resources.
- Added registered feature/feat tests for actual combat-reset restoration, no short/long-rest reset during combat start, source immutability, absent ownership, and no refill during ordinary persistence/normalization. A later explicit new-combat call restores again. This is not a durable transaction replay certification; the caller's start/commit guard remains responsible for that boundary.
- Three related suites passed 64 tests. Typecheck session 21120 is still running and must be recovered before any restart. No paid API, live-room writes, or changes to original draft certification. Mixed combat/short-rest resets and conditional/partial resource recovery remain open; fixing combat-only declarations does not certify 花开二度 or 魔力潮涌.

### Combined combat and rest resource recovery

- Recovered typecheck21120 exit0. Added optional restoreOnCombatStart:boolean to feature/feat/class plugin resource declarations and declarative subclass resources. It supplements the existing resetOn cadence; resource restoration still occurs through the authoritative combat-start entry, not snapshot reconstruction.
- Propagated the field through registration, runtime catalog projection, strict subclass keys, feat preflight validation and resource merging. A shared pool enables combat restoration only from a currently qualified contribution. Runtime registration rejects non-boolean values. Default behavior remains unchanged when omitted.
- Registered feature/feat tests verify a single pool restores at combat start, short rest and long rest. Parameterized subclass behavior verifies both enabled and disabled cases while retaining actual resource spending and rest recovery. Initial five suites passed115tests; affected subclass/package suites then passed48tests. These counts overlap and are not a distinct coverage total.
- Added conversion guidance. Review r14/coverage r9 resolves only the exact 花开二度 mixed-reset diagnostic:22 reviewed diagnostics,18expressible links,923unreviewed links. Original feat and its reaction flow remain uncertified. Conditional/partial restoration is still unresolved.
- Typecheck82147 remains running; later changes added feat preflight validation and subclass test assertions, so its result alone must not be claimed as a fresh check of those later edits. Paid API0; user rooms unchanged; fullbook remains active/incomplete with preflight32/123 unchanged.

### Conditional and partial rest recovery implementation

- Recovered typecheck82147 exit0. Added a strict resource restRecovery contract: per short/long rest, set replaces the balance, restore adds up to its maximum, and onlyWhenEmpty gates either operation. An explicit rule overrides default full recovery only for its declared rest event. This preserves distinctions needed by conditional resources rather than introducing spell-specific resource code.
- Connected resource registration, feature/feat catalogs, declarative subclass validation/registration, character restoration and combat short-rest benefits. Authoritative character migration projects recovery metadata into independently cloned combat snapshots; ordinary JSON persistence retains it. Recovery reports describe exact or conditional restoration instead of incorrectly promising a full refill. Added feat preflight checks and AI contract guidance.
- Synthetic registered feature/feat matrix covers starting balances 0/2/5, empty-only short-rest restoration, long-rest setting to1 (including reducing a larger balance), actual character-to-combat projection, JSON reload and unchanged source snapshots. Strict policy tests reject malformed cadence, modes/amounts/booleans and unknown fields. First batch87tests passed; separate protocol/guide/report batch85tests passed.
- No original draft certification or additional diagnostic review decision yet: dedicated subclass policy behavior, full rest-event replay with these policies and original regenerated content still require evidence. Resource initialization and arbitrary event-driven gains are separate mechanics, not proven by rest recovery. Paid API0; user rooms unchanged. Typecheck33391 is running after the production changes; recover this handle before any restart.

### Conditional recovery registration and real rest-event evidence

- Previous turn implemented the conditional recovery primitive. Recovered typecheck33391 exit0 for that production implementation. This turn only added test cases and evidence records; no new full typecheck was launched for those later test edits.
- Extended registered feature/feat campaign-rest tests with empty and populated conditional pools: short rest restores only empty pools, long rest sets both to1, non-beneficiaries retain their balances, and spending after recovery followed by JSON reload/reconciliation of the same rest cannot grant another use.
- Added dedicated subclass policy validation/registration evidence. Invalid boolean policy is rejected, resource balances0/2 follow short/long-rest semantics, combat start does not invoke a rest-only policy, and mutating the imported definition after registration does not change Host recovery. The fixture uses JSON round-trip and registration; it does not assert a .starmod archive/browser import certification.
- Affected suites passed75tests. Review r15/coverage r10 marks only the precise 魔力潮涌 rest-recovery diagnostic expressible, leaving its other rules and original draft uncertified. Current review coverage23diagnostics/19expressiblelinks/922unreviewedlinks. Preflight32/123 unchanged; paid conversion gate remains false.
- Paid API0, user rooms unchanged, no running test/typecheck handle remains. Next work should batch remaining resource initialization/gain/spending and other shared mechanism gaps; this evidence does not authorize a one-off paid conversion.

### Native archive recovery-policy round trip

- Previous turn progressed real rest-event and subclass evidence. Added feature/feat native .starmod export/read/install/re-export/dispose/reinstall fixtures with resource policy assertions after each independent installation, preserving the authored bundle.
- First run exposed a real mismatch: native module preflight rejected automatic resource-only features/feats even though the runtime supports their owned resources. Allowed a nonempty resource declaration as a concrete automatic contribution and shared strict resource validation between features and feats. Empty declarations, malformed conditional recovery and zero maxima still fail archive export validation; no dummy combat action is added.
- Second run exposed a fixture omission: normalizeCharacter alone does not initialize resource pools (production finalizeCharacter follows it with syncCharacterClassResources). Used that same normalization/resource synchronization sequence. Final archive, custom-package and unified-content suites passed31tests; added malformed archive cases and reran the affected2tests, both passed.
- The fixture proves actual native archive round trip and runtime policy preservation for feature/feat resources, not browser/room installation or original wholebook conversion. No original source draft was edited. Source preflight counts have not been recomputed and remain last-observed32/123, not a claim they could not change after this gate fix.
- Paid API0; user rooms unchanged. Typecheck26126 running after production/test edits; recover this handle before restarting. Wholebook still incomplete and paid conversion gate remains false.

### Post-resource-batch wholebook offline recheck

- Previous turn repaired native archive validation and completed round-trip evidence. Recovered typecheck26126 failure: the malformed archive fixture wrote resources through a broad payload union. Changed that intentionally invalid wire-data mutation to Object.assign; production code was not changed for this failure. Fresh typecheck95858 is running and must be recovered before restarting.
- Read the offline audit before running it: it uses only exact-source unedited automatic candidates, current preflight/source constraints and exclusive output creation, with no AI call. Ran .codex-logs/fullbook-consolidated-preflight.config.mjs with FULLBOOK_OFFLINE_REPORT=fullbook-consolidated-preflight-20260927-r6.json; audit passed and session30814 subsequently exited0.
- Fresh fullbook counts remain155entries,32ready-for-behavior-tests/123blocked. No entry changed overall status after the resource batch. Generated mechanism backlogr6; its entries and issues are byte-equivalent after JSON serialization to backlogr5, allowing exact-scope migration of reviewr15 to reviewr16 without adding any support claims. Coverager11 remains23revieweddiagnostics/19expressiblelinks/922unreviewedlinks.
- This confirms current saved automatic drafts still require regeneration or further fixes, despite mechanism-level improvements. No manual source-draft repair, no paid API, no room writes, no fullbook certification. Paid conversion remains gated on completing the broader offline work.

### Explicit initial resource balances

- Previous turn produced a fresh wholebook audit. Recovered typecheck95858 exit0. Inspection found missing resource balances always defaulted to maximum both in getClassResource and synchronization, preventing explicitly non-full initial pools.
- Added optional initialCurrent to class/plugin feature/feat/subclass resource definitions and propagated it through registration, validation, catalog projection and initialization. It is a nonnegative integer capped by the current maximum; omitted retains legacy full initialization. Persisted current values, including0, take precedence. This is a generic capability, not a claim that a particular XGE resource must initialize at0.
- Extended actual native archive round trips for feature/feat with omitted versus zero initial values; verified ordinary JSON reload preserves a spent0 balance. Added non-full direct resource lookup and upgrade tests (maximum increases while spent balance remains0). Invalid negative initial values fail native export validation. Conversion guidance explicitly requires source support for any initial value.
- First four-suite batch passed65tests; subsequent affected archive/resource/guide batch passed31tests (overlapping counts). No fullbook preflight status or diagnostic review was promoted from these synthetic tests. Initial balance does not implement event-driven resource gains or arbitrary triggers.
- Paid API0, user rooms unchanged. Typecheck75240 running after the production/test changes; recover before any restart. Fullbook remains active/incomplete.

### Successful spell-termination Activity events

- Previous turn implemented explicit initial balances. Recovered typecheck75240 exit0. Inspected existing Host counterspell-resolved and spell-dispelled events: they carry explicit success facts but were not mapped into Activity trigger contexts.
- Added canonical spell-countered and spell-dispelled lifecycle events and success-only context mapping. Actor is the creature performing the interruption/removal; source spell id/level describes the terminated spell (never a guessed Counterspell/Dispel Magic casting slot). Existing generic resource restore operations can consume these contexts.
- New8case matrix registers a synthetic feature and Activity, feeds success/failure Host result events, and performs actual automatic Activity settlement. Only successful events with ownership restore the actor's resource; target and original state remain unchanged and no confirmation is requested. Initial test cleanup mistakenly treated an Activity registration object as a disposer; fixed cleanup and reran:15tests passed across trigger/invocation suites, then15SDKguide tests passed.
- This is downstream committed-event integration, not a real Counterspell/Dispel Magic roll pipeline certification. Dispel events currently represent individual effect results; grouping multiple effects from one casting, durable late replay and full spell/subclass behavior remain outstanding. Guidance explicitly preserves these limits. No mixed 魔力潮涌 diagnostic was promoted from this partial mechanism work.
- Paid API0, no user-room writes. Typecheck11040 running after production/test changes; preserve handle. Fullbook remains active and incomplete.

### Real termination outcomes and imported spell dispel support

- Recovered typecheck11040 exit0. Inspected dnd5eDispelMagicEffectsOnTarget before adding deduplication: it already groups active-effect records by source actor and spell ID. Extended the actual engine dispel test with two records from one caster plus another caster's instance; verified two successful contexts, failed higher-level effect preserved, and distinct event IDs. Extended the real prepared Spiritual Weapon/Counterspell test with reactor identity and terminated spell level assertions. Focused2tests passed (508unrelated skipped).
- Found a real import gap: the canonical dispel inventory consulted only the SRD catalog for both active effects and concentration records. Added installed plugin spell lookup fallback to both paths. A synthetic installed non-SRD ward with two records and stored casting level6 is now recognized, checked by actual Dispel Magic, removed and emitted as exactly one success context. Unknown uninstalled spell definitions still are not guessed.
- New test initially expected [] while effect cleanup normalizes an empty list to undefined; corrected assertion to the existing normalized representation. Final termination suite9tests passed. Updated conversion guidance to describe the verified grouping and retain limitations for missing/casting-instance identity, scene objects/areas and late replay. This fixture registers the imported spell definition and seeds its effects; it does not certify that spell's original cast implementation or wholebook conversion.
- Paid API0, no room writes. Typecheck99188 running after code/test edits; a later guide-only text change is not covered by its start snapshot. Fullbook remains active/incomplete and no mixed diagnostic was promoted.

### Imported concentration dispel lifecycle

- Previous turn fixed installed spell recognition in dispel inventory. Recovered typecheck99188 exit0 for that production/test batch. Inspected the existing target-scoped concentration cleanup before changing behavior; it already preserves other targets and ends the source concentration when the final target is removed.
- Expanded the actual imported-spell dispel fixture across absent caster, last concentration target, and multiple concentration targets. Each target starts with two mechanical records and a granted follow-up Activity. Verified the selected target loses its effects/grants and source link, the last target ends source concentration, while another target retains both effects/grants and remains in the source target list. Stored casting level6 and one success context remain verified in all modes.
- Termination suite passed11tests. No production change was necessary for this lifecycle path. The fixture still seeds initial effects; original plugin spell casting, map-area/summon/scene-object cleanup, and browser authority synchronization remain separate acceptance work. This does not certify a complete book entry.
- Paid API0, no user-room writes. No live test/typecheck process remains. Fullbook remains active/incomplete; exact-source preflight last observed32/123 and paid gate false.

### Damage provenance foundation for imported Activities

- Previous turn completed scoped concentration lifecycle evidence. Inspection of outgoing damage found damage-applied events retained source combatant and damage types but discarded specific Activity/spell provenance. The current after-damage discovery can only correlate prior attack events; casting-class-specific damage requirements therefore remain unproven.
- Added optional Dnd5eDamageOrigin to committed damage events. The central Activity deal-damage path passes the actual Host source kind/id, Activity id, and spell cast level when known into the damage application. Both ordinary and absorbed damage records copy the metadata. No identity is inferred from actor class or unrelated prior attacks, and unspecified origins remain unspecified. Nested damage calls do not inherit the origin implicitly.
- Added5source cases (spell, feature, item, action, absent) through actual Activity execution commit: event origin and JSON persistence verified, nonspell sources do not gain a spell level, damage arithmetic and original-state isolation remain correct. Authority bridge suite passed51tests. An initial patch failed before mutation due to the event union's opening parenthesis; corrected the patch context.
- This is a provenance foundation, not completed outgoing-damage automation: casting class, core/monster/periodic damage producers, contextual predicates, source-side trigger discovery and full mixed-rider attribution still require implementation/evidence. No XGE diagnostic was promoted and no API conversion was run.
- Paid API0, user rooms unchanged. Typecheck72373 is running after production/test edits; preserve handle. Wholebook goal remains active/incomplete.

### Source-side damage trigger contexts

- Recovered typecheck72373 exit0. Added canonical damage-dealt lifecycle event alongside existing victim-side after-damage. Committed positive damage offers the outgoing window to its source actor and targets the damaged creature; absent source or suppressAfterDealtDamageTrigger suppresses the outgoing window. Zero damage produces neither damage context.
- Explicit Activity provenance takes precedence over heuristic correlation with an earlier attack. Spell origins require a known casting level to expose a spell context; absent level falls back to a nonspell combat context, without inventing0. Feature/item/action kinds remain distinct. Shared damage facts are now representable for those source kinds and preserve existing damage predicates.
- Expanded actual Activity-commit origin tests to verify both actor perspectives, targets, source-kind predicates, positive damage facts, zero damage and suppression. Authority/CombatE2e/Invocation suites passed94tests; test session77570 subsequently exited0. Guide documents the new event and incomplete casting-class/producer coverage.
- No complete source-specific bonus-damage ability was certified. Core/monster/periodic damage provenance, casting class, fully composed source-side settlement/replay and mixed damage attribution remain open. No original draft change or diagnostic promotion. Paid API0, user rooms unchanged. Typecheck32272 running after this batch; recover handle before restarting.

### Compiled spell damage source propagation

- Recovered typecheck32272 exit0. Traced prepared spell selection through plugin-spell-activity into the compiled plugin callback. That callback previously treated spell damage as nonmagical other damage and omitted the origin, independently of the central Activity bridge fixed earlier.
- Propagated the Host-validated castingClassId into direct spell execution (racial innate casting leaves it absent). The compiled spell callback now supplies spell delivery, magical status and cast level to damage checkpoints/defenses and records spell ID, Activity ID, cast level and known casting class on damage events. Granted follow-up spell identity uses its granting effect when available; no casting class is guessed for follow-ups.
- Extended the existing actual Fire Storm prepare/resolve test: both failed/successful save damage records preserve fire-storm, level7 and cleric provenance. Focused test passed; complete pluginSpellTransaction suite passed119tests. This is native compiled-Activity evidence, not original XGE conversion certification or proof of every damage-defense branch.
- Casting-class predicates/context exposure and complete core/monster/periodic provenance remain open. Original drafts unchanged; no diagnostic promotion. Paid API0; user rooms unchanged. Typecheck86984 remains running after this batch; recover before restarting.

### Casting-class damage predicates

- Prior turn is progress: actual compiled spell source propagation and119passing transaction tests. Recovered typecheck86984 exit0 before starting the next check.
- Extended spell-used with optional castingClassIds, strict nonempty/unique/valid-ID validation, and fail-closed matching against Host spell context. Damage-origin contexts now preserve known casting class; no actor-class or spell-list inference. Unfiltered existing predicates retain behavior.
- Extended actual Fire Storm prepare/resolve evidence through outgoing damage context: cleric matches, wizard does not, an incompatible minimum level does not, and absent class does not match. Added malformed configuration coverage. Validation/Invocation/PluginSpellTransaction/SDK-guide suites passed164tests.
- SDK conversion guidance describes the predicate, missing-source behavior and producer limits. This does not certify multiclass UI selection, original XGE drafts, later granted actions, all spell-cast events or all core/periodic damage producers. No diagnostic promoted; fullbook preflight remains32/123 last observed.
- Paid API0, original drafts and user rooms unchanged. Typecheck43009 is running after this batch; recover before restarting. Goal remains active/incomplete.

### Composed outgoing damage settlement

- Previous turn is progress: casting-class predicate implementation and164passing tests. Recovered typecheck43009 exit0. Added a synthetic owned feature with optional damage-dealt invocation, wizard-source requirement, one-charge consumption, force-damage rider and once-per-turn limit.
- Five cases verify accepted, declined, empty resource, wrong casting class and unowned feature. Actual trigger discovery/choice/Host commit applies exactly4damage and one charge only on accepted eligible execution. Original snapshots remain unchanged. JSON-reloaded state rejects both same-batch and different-batch additional use in the same turn; actual end-turn transitions permit a fresh next-turn use with another charge.
- Initial accepted fixture failed invalid-target because it omitted authoritative distance. Added the required pair distance; no production validation was weakened. Damage rider and spell-termination suites passed16tests. Source damage events are explicitly synthetic; prepared spell provenance is separately tested in pluginSpellTransaction. No proof of durable old-event rejection across turns, browser authority delivery or original XGE source conversion is claimed.
- No production change necessary for this composed settlement. Paid API0; user rooms and original drafts unchanged. Typecheck35348 remains running for the new test; recover before restarting. Wholebook goal remains active/incomplete; no diagnostic/status promotion.

### Persisted Activity trigger receipts

- Previous turn produced composed settlement evidence. Recovered typecheck35348 exit0. Inspection found the settlement-local consumed set disappears between calls; per-turn usage alone cannot prevent an already-settled source event from repeating after a turn boundary.
- Added actor class-state activityTriggerReceipts scoped to combatId, retained without eviction within that combat and replaced on the next combat's first successful trigger. Character/token types and map projection carry the ledger; Headless clone copies it. Discovery settlement checks receipts before confirmation. Successful candidate state includes its receipt before atomic map handoff; failed handoff discards candidate and receipt together. Declined/rejected executions do not gain receipts.
- Added JSON-reload and actual turn-advance test: old batch does not prompt or apply damage/cost again; a new batch can legitimately resolve on the new turn. Added map-handoff receipt success/failure assertions. Initial pre-handoff-order batch passed26tests; final-order damage/pull integration tests passed15tests. Source event fixtures remain synthetic, with actual prepared spell provenance separately covered.
- Protection requires callers to retain the same authoritative eventBatchId for redelivery. It does not authenticate a newly fabricated batch ID, prove concurrent Host serialization, or certify browser reconnect delivery. No original configuration promotion or API calls. Typecheck75028 is running; clone/test additions occurred after its start, so its result alone may not cover those last edits. Goal remains active/incomplete.

### Trigger receipt persistence through map rebuild

- Prior turn made concrete progress with persisted receipts and15passing settlement tests. Recovered typecheck75028 exit0; rerunning typecheck68924 covers the final clone edits and this turn's tests.
- Upgraded synthetic native .starmod feature/feat pull integration: successful settlement is projected through planDnd5eMapResultApplication, serialized as map+characters, and rebuilt through createDnd5eMapCombatSnapshot at round2. Receipts survive and the old event batch cannot prompt or write map movement again. All10cases passed, including decline, ownership, obstruction and failed handoff.
- Added independent monster-token persistence test, asserting the emitted token patch, JSON map reload and rebuilt Host ledger; original map remains unmodified. Focused map test passed1 with64unrelated tests skipped.
- These cover actual map/character projection functions, not browser/server reconnect or concurrent Host serialization. No original source item certified, no paid API calls, no user-room writes. Typecheck68924 remains running. Fullbook goal active/incomplete.

### Deferred damage timing diagnostic review

- Previous turn produced persistence evidence. Typecheck68924 exited1 on the new monster persistence test's optional tokenPatches access; changed to optional access (the equality assertion still fails if the expected patch is absent).
- Rechecked the exact tomb diagnostic claiming no generic deferred timing field. Existing apply-effect timing after-triggering-damage, deferred collector and personal damage reaction commit already implement that field. Reran the existing focused damageCommitSession test:1passed/13skipped. Evidence includes first fire damage7, later damage14 after vulnerability, temporary HP, resource consumption, no input mutation and incapacity expiry.
- Wrote exclusive review r17 and coverage r12 against unchanged backlog r6. Only that precise missing-field claim is expressible; source configuration and full feature remain uncertified. Counts:24reviewed diagnostics,20expressible links,3partial,1source correction,921unreviewed links;122entries still await mechanism review and1awaits batch regeneration. Paid conversion gate false;32/123preflight unchanged.
- Paid API0, no original draft edits and no room writes. Typecheck24565 is running after the test typing correction; recover before restarting. Fullbook goal remains active/incomplete.

### Combined temporary HP and deferred penalty lifecycle

- Previous turn made progress by correcting the exact stale timing-field diagnostic and a test typing error. Typecheck24565 was still live when polled; no duplicate typecheck was started.
- Inspected related temporary-HP and before-damage diagnostics together. Many explicitly require full source/lifecycle acceptance or include ally interception and critical cancellation; they cannot be promoted from personal deferred-effect evidence.
- Expanded the existing damageCommitSession fixture to use an immediate lifetime effect and sourceEffectId-bound temporary HP, plus a separate after-triggering-damage penalty effect. Tested pools10/30: first fire damage7 stays undoubled, next damage14 observes vulnerability; remaining HP is9/20 and temporary HP0/9 respectively. Actual turn-end cleanup removes incapacity and any remaining bound temporary HP/source. Single resource use and input isolation remain asserted.
- Complete damageCommitSession and ActivityCombatE2e suites passed51tests. No production change needed, no original source configuration certified and no additional diagnostic promotion. Typecheck24565 subsequently exited0; it predates this test-only expansion. No live process remains. Paid API0 and user rooms unchanged; fullbook goal active/incomplete.

### Class-specific progression tables

- Previous turn produced compound lifecycle evidence. Batch-inspected level/target-count diagnostics. Found custom-table always reads total character level and ignores optional classId, unlike linear class-level scaling; this prevents correct class-specific stepped progression for multiclass characters.
- custom-table now uses the specified class level when classId is present, otherwise retains total-level behavior. Missing class contributes0 and retains base value. Validation rejects missing classId for class-level basis and malformed identifiers when supplied. The shared scaling function already serves authoritative executor/recipes; no spell-specific branch added.
- Added executor tests for fixed temporary-HP progression at class levels0/4/5/9/10/14/15/20 while total level stays20; verified class-specific thresholds, unchanged total-level tables and absent class. Added validation cases and updated conversion guidance. Executor/Validation/SDK-guide suites passed99tests.
- This does not grant class eligibility or complete dynamic ability-based target counts, recipient reaction movement, or any original subclass configuration. No diagnostic promoted. Paid API0; user rooms and original drafts unchanged. Typecheck55799 running after this batch. Fullbook goal active/incomplete.

### Ability-based scaling foundation

- Recovered typecheck55799 exit0. Added ability-modifier scaling basis with ability key; existing nonnegative step calculation supports count1 plus max(0,CHA modifier-1). Shared scaling feeds target count/area cap and normal operation adjustments. Missing/nonfinite required ability fails explicitly; executor returns invalid-actor. Validation requires a valid ability key and rejects an ability on other bases.
- Forwarded actor abilities through explicit compiled-Activity, prepared-spell and map spell-selection scaling contexts; existing full actor contexts already carry abilities. Added executor cases CHA6/10/12/16/20 verifying allowed target counts, excess target rejection, correct proposal count and invalid actor rejection. Executor/Validation suites passed89tests.
- SDK guide includes dynamic count example and scope limits. All feature selection interfaces, triggered target selection and recipient reaction movement are still open; no whole ability or original configuration is promoted. Paid API0; user rooms unchanged. Typecheck61994 is running after production changes; recover before restarting. Fullbook goal active/incomplete.

### Dynamic feature targets through prepared Host settlement

- Recovered typecheck61994 exit0. Added optional actor scaling context to feature control projection, retaining raw Activity definitions and only replacing the action targeting metadata. Player feature panel, linked-character feature preparation and final plugin Headless targeting now use the shared projection. Final execution recomputes from Host combatant attributes. Panel disallows submitting a stale selection above the new cap.
- Added actual content-package import/register/control/prepare/resolve fixture with CHA16 and a base single-target healing Activity. First attempt exposed final Headless's legacy single-target shell dropping two selected targets despite successful preparation; fixed that boundary to use scaled controls. Three recipients now heal2 each, fourth unchanged; selecting four is rejected, source package still has base count1. Added direct forged-Host target count rejection.
- ContentPackageV2/PluginFeatureAction suites passed61tests before the final forged-target assertion. Focused final result is recorded in tool output. Synthetic source, not XGE conversion certification. Effect-granted/monster preparation, triggered selection and full browser interaction remain separate work. Paid API0; original drafts and user rooms untouched.
- Typecheck58354 running; last panel guard/test addition followed its start. Goal remains active/incomplete.

### Effect-granted dynamic target preparation

- Recovered typecheck58354 exit0. Prior turn is progress: linked-character dynamic controls and actual multi-target settlement. Changed scaled feature preparation to build/reuse the authoritative map combat snapshot before target validation, reading actual combatant attributes rather than the narrow synthetic Character used for monster grant entitlement.
- Registered/effect-granted Activity targeting now projects directly from the scaled Activity in preparation and final Headless validation; it no longer depends on finding an owned feature's ordinary active controls. Area limits also use the scaled Activity target. Raw Activity definitions remain unchanged.
- Existing ContentPackageV2/PluginFeatureAction suites passed61tests. Extended native content-package fixture to both owned feature and live effect-only grant (no feature ownership), proving3recipients healed and excess target rejection in both paths;2focused cases passed/29skipped. This is not a monster-specific dynamic fixture or browser grant-control acceptance yet.
- Paid API0; original source artifacts and user rooms unchanged. Typecheck14613 is running after this batch; recover before restarting. Goal active/incomplete.

### Monster dynamic grant acceptance

- Prior turn is progress: snapshot-based preparation and effect-only dynamic targets. Typecheck14613 remains live when polled; no duplicate check started.
- Extended native content-package fixture to a DM-controlled independent token backed by the installed SRD noble catalog entry. Inspected catalog CHA16, then asserted projected Host ability16; no Character row for the monster. Three target healing succeeds, four targets are rejected in preparation and direct Host execution, original package target count stays1. Removing the effect revokes both character and monster grant access.
- Focused fixture passed3cases/29skipped: ordinary ownership, character effect grant and monster effect grant. This proves actual import/preparation/Headless/application functions, not browser acceptance.
- UI inspection found DM granted-Activity map controls still route creature targeting through one-click persistent-area activity targeting. Multi-target selection and scaled area metadata on that control remain next integration work. No original source certification or diagnostic promotion. Paid API0 and user rooms unchanged. Typecheck14613 subsequently exited0; it predates this test-only expansion. No live process remains. Goal active/incomplete.

### Granted-action map multi-selection wiring

- Prior turn produced independent monster preparation evidence. Added browser targeting-session selected IDs and maximum count. The shared character/DM creature-grant map click path reads a map combat snapshot and scaled Activity limit, toggles selection for multi-target controls, displays selected names/count and submits the full target ID list only on confirmation.
- Confirmation rechecks source grant existence, current dynamic count and target presence before sending; Host remains authoritative for entitlement, distance and relations. A session whose capacity shrinks to1 stays in explicit selection mode so it does not silently submit on the next map click. Existing single-target first-click submission is retained.
- Existing render-isolation suite passed37tests before the last shrink-to1 guard; these are source/render-boundary checks, not live interaction certification. Actual browser selection, scaled area-control initialization and recipient reaction movement remain unverified/open. Paid API0; no original configuration promotion or user-room writes.
- Typecheck28179 running after main wiring; final selection-mode guard followed its start. Goal active/incomplete.

### Granted selection boundary checks

- Previous turn made progress with shared map selection wiring. Recovered typecheck28179 exit0. Inspected existing isolated Playwright configuration (separate temporary roots/ports), but did not launch or claim browser acceptance in this turn.
- Extracted the actual UI selection toggle/confirmation helpers. Confirmation now rejects obstacles, removed targets, duplicate IDs and IDs redirected to another creature, not merely truthy token lookup. This closes a stale-target presentation gap while Host retains full rules validation.
- Tests cover addition cap, deselection, removing choices after a cap shrinks, empty/duplicate/missing/obstacle targets and a selected creature changing into an obstacle. Selection plus render-isolation suites passed42tests. Existing snapshot input remains unmodified.
- No live browser/dual-client acceptance, original draft certification or diagnostic promotion. Paid API0 and user rooms unchanged. No process remains running; most recent typecheck predates this helper extraction. Wholebook goal active/incomplete.

### Consolidated offline preflight after dynamic targeting

- Prior turn made progress on UI selection boundary checks. Re-read the offline audit runner: only exact-source automatic runs with manualContentRepairs:false, no API conversion. Ran exclusive preflight r7;155entries remain32ready-for-behavior-tests/123blocked. Candidate diagnostics exactly match r6; no regression and no original draft becomes certified merely from runtime additions.
- Generated backlog r7, verified serialized entries/issues equal r6 before migrating review scope to r18 and coverage r13. Added scoped partial review for the glamour-college mixed target-count/progression/reaction-movement claim in r19/coverage r14: dynamic count and class-specific step tables now expressible, recipient reaction movement/exemption and complete original ability unproven.
- Latest coverage:25reviewed diagnostics,20expressible links,4partial,1source correction,920unreviewed links;122entries still need mechanism review and1awaits batch regeneration. These are diagnostic counts, not engine gap counts or completed entries. Paid gate remains false.
- Audit session22275 exited0; typecheck31098 remains running after accumulated UI/helper changes. Paid API0, original source artifacts and user rooms unchanged. Fullbook goal active/incomplete.

### Recipient temporary-HP trigger bridge

- Recovered prior typecheck31098 exit0. Added canonical temporary-hit-points-gained event and recipient trigger context. Positive actual gains retain source provenance in central Activity commits and compiled plugin grants, without binding ordinary temporary HP to an effect lifetime. Equal/lower offers do not emit a gain event.
- Added four actual Headless commit cases (prior pools0/5/10/15): maximum-pool behavior, input immutability, recipient rather than caster eligibility, source predicate match/mismatch, JSON event preservation and zero-gain rejection. Focused4 passed; consolidated authority/validation/SDK-guide suites94 passed, command exit0. No new full typecheck after these additions.
- Updated SDK explanation with explicit limits. Recipient reaction movement and original glamour ability remain unverified; no review promotion or original configuration certification. API0, paid gate false, existing user rooms unchanged. Batch-first workflow remains in force; fullbook goal incomplete.

### Recipient reaction movement integration (synthetic, offline)

- Previous turn made progress by implementing sourced temporary-HP recipient events. Exercised those actual committed events through trigger settlement and map movement, rather than fabricating an already-resolved movement result.
- Found and fixed missing effective speed in dnd5eActivityActorSnapshotFromCombatantV1. Actor/target-speed formulas now receive Host-derived dnd5eEffectiveSpeed, not a client value or assumed30feet.
- New dnd5eTemporaryHpReactionIntegration.test.ts verifies recipient choice and explicit reaction requirement/consumption, actual map movement and no opportunity provocation flag, decline, unavailable reaction, unrelated source and atomic map failure rollback. Existing source temporary HP remains committed when the optional follow-up fails. Synthetic owned-feature fixture only; effect-granted entitlement/lifetime and original ability remain separate open work.
- Consolidated new reaction integration plus existing spell-hit pull integration:15passed, session92746 exit0. Initial failures exposed the speed defect plus fixture omissions (explicit reaction cost/requirement and col/row cell shape), all corrected. Paid API0; no original draft edits/certification or user-room writes. Full typecheck97090 is running; recover its handle before another check.

### Granted recipient reaction lifecycle evidence

- Previous turn made concrete progress on Host effective-speed projection and recipient movement settlement. Recovered typecheck97090 exit0.
- Expanded the synthetic reaction integration to12 cases across owned feature and temporary effect grant. Valid effect fixtures include label and targetId; an initial malformed fixture was corrected before acceptance. Verified successful single-use grant removal, preservation on decline/failed map handoff, absence of authorization, reaction/source filters and JSON-persisted replay suppression even after restoring the reaction.
- Exercised actual caster/recipient end-turn actions after declining: the unused one-round grant expires, subsequent events cannot offer movement, and unrelated temporary HP remains5. Final session15597 exit0:12passed. No original ability certification or browser claim.
- Important remaining authoring gap: canonical effect schema currently exposes grants and completionGrant.singleUse, but direct grants do not expose grantedActivitiesSingleUse through the canonical proposal/commit path. This test uses an engine-created effect, so it is not proof that an imported module can author this exact one-use grant. Inspect complete proposal-to-effect propagation before adding that field; immediate-event decline retention also remains separate.
- Paid API0, no original artifact edits or room changes. Latest typecheck95492 running after test expansion; recover it before restarting. Wholebook goal remains active/incomplete.

### Canonical direct single-use grant configuration

- Previous turn completed engine-grant lifecycle evidence and identified the canonical authoring gap. Recovered typecheck95492 exit0.
- Added effects[].grantsSingleUse:true with nonempty grants validation. Forwarded through executor proposal, compiled effect reconstruction, both Headless effect helper inputs, and all four condition/modifier/extension/marker application branches, keeping the flag only on the effect that receives grants.
- Replaced the integration fixture's direct engine effect with JSON-serialized canonical Activity resolution and actual commit.12 cases still pass including use/decline/reaction denial/unrelated source/removal/atomic rollback, JSON replay and real turn expiry. Added rejection assertions for false, absent and empty grants. Content-package parse preservation includes the new flag; complete .starmod archive plus original source recipe remains unverified.
- Updated AI SDK guide and public SDK semantics, including the effect-removal scope and explicit reaction cost. Consolidated integration/content-package/validation/guide suites83passed, session64669 exit0. No promotion of original configuration or fullbook claim. Paid API0; user rooms untouched.
- Latest typecheck71579 running after implementation; recover this process before launching another check. Fullbook goal active/incomplete. Immediate-event decline retention and complete original recipient ability still need work.

### Single-use grant archive acceptance (synthetic)

- Previous turn completed canonical grantsSingleUse propagation and83 local tests. Recovered full typecheck71579 exit0; it covers production implementation, preceding this turn's new archive test.
- Added dnd5eSingleUseGrantArchive.test.ts covering marker, standard condition, modifier and extension carriers. Each fixture is exported as an actual .starmod, read and installed, exercised via registered Host Activity commands, uninstalled, re-exported and independently installed/exercised again. Field retention, absent grant denial, successful grant/use, JSON combat persistence, second-use denial, registry cleanup and source bundle immutability are asserted.
- Initial one-combatant fixture correctly produced inactive combat and was corrected to include an opposing combatant; no production workaround. Combined archive and recipient reaction suites16passed (session65984 exit0).
- This proves synthetic native archive/Host behavior for the field, not raw-PDF conversion, original glamour-college ability, player UI or separate network-client certification. Immediate decline retention and full original ability remain open. No original diagnostic promotion, paid API0, user rooms untouched. No live tool process remains. Fullbook goal active/incomplete.

### Batched material-diagnostic review

- Previous turn made progress on native archive/Host tests. Revisited r7 backlog and r19 scoped reviews before choosing a group; forces-saving-throw was already reviewed, so did not repeat that work.
- Inspected10 missing materialRequirement diagnostics against current recipe/schema, custom material module tests and local extracted source material paragraphs. Nine exact missing-recipe claims are expressible by existing interfaces; druid-grove remains partial because harvesting history is not machine-verified. Separate object/lifetime/remaining spell mechanics are explicitly excluded from this finding.
- spellMaterials/conditionalSpellMaterials/spellComponents35tests passed, command exit0. Added fullbook-material-review.md. Created exclusive private review r20 and coverage r15:35reviewed diagnostics,29expressible links,5partial,1source correction,910unreviewed links.122entries still require mechanism review and1awaits batch regeneration; no source behavior promotion.
- Existing sourceId page-index differences between old drafts and boundary-refined inventory were noted, not silently rewritten. Source drafts untouched. Paid API0 and gatefalse; user rooms untouched. No live process. Fullbook goal active/incomplete.

### Recovery-source correction and dice-progression review

- Previous turn made progress by reviewing10 material diagnostics. Inspected remaining recovery/scaling diagnostics against current implementation and original extracted subclass text.
- Corrected diagnostic interpretation only: Faithful Summons source permits long-rest recovery, not short-or-long; Spirit Totem elsewhere in the same source has the latter condition. Recorded source-claim-not-supported without changing original drafts or adding incorrect short-rest behavior.
- Reviewed three Spirit Shield dice mismatches: source table6/10/14 class levels maps to2/3/4d6; current reductionDice classId/upgrades and source-table checker express these exact values. Does not certify whole ability.
- Runtime mitigation, source progression and class resource suites22passed. Exclusive review r21/coverage r16:39reviewed diagnostics,32expressible links,5partial,2source corrections,906unreviewed links;122entries still require review and1awaits batch regeneration. API0, source drafts/rooms unchanged; paid gatefalse. No live processes. Goal active/incomplete.

### Fixed skill training versus selectable expertise

- Previous turn corrected source recovery claims and reviewed scaling. Inspected skill-grant path for the outstanding Survivalist diagnostic. Existing advancement proficiency plus skill-expertise tags project into Host, but fixed expertise rejected characters already expert, blocking valid fixed subclass training.
- Fixed build-grant expertise now retains existing expertise without stacking; selected expertise stays strict. Proficiency and valid skill identity are still required. Resolver derives fixed prefix length internally; UI option filtering includes fixed grants so learned proficiency and existing fixed expertise use the same checks.
- Extended build-choice tests: fixed overlap succeeds, selected overlap fails, same-build proficiency works, duplicate fixed tags deduplicate. JSON persistence → character migration → real Host ability check confirms only double proficiency (10+4=14). Build-choice and advancement suites22passed. SDK guide updated.
- No original source recipe certification; complete native subclass import and live UI verification remain pending. API0, original artifacts and rooms unchanged. Typecheck56241 running, started before the final UI/guide adjustment; recover before any follow-up check. Goal remains active/incomplete.

### Fixed skill training archive and subclass level-up

- Previous turn repaired fixed expertise overlap and verified direct Host checks. Recovered typecheck56241 exit0; it began before the final UI/guide changes, so not claimed to cover those edits or this turn's new test.
- Added fixedSkillTrainingArchive.test.ts: actual native archive export/read/re-export/read/install, synthetic subclass2→3 advancement, JSON persistence and actual nature/survival Host ability checks for untrained and already-expert characters. Both2cases passed; source character and module unchanged. A separate synthetic passive exists in the fixture; it is not a recreation or certification of the source subclass.
- Recorded exact Survivalist skill-projection diagnostic as expressible by subclass build-grant proficiency plus expertise tags. Created exclusive review r22/coverage r17:40reviewed,33expressible links,5partial,2source corrections,905unreviewed links.122entries need review and1awaits batch regeneration; no original draft change or certification.
- Paid API0; user rooms untouched; no live tool processes. Fullbook goal active/incomplete. Later consolidated typecheck should include final UI and new archive test.

### Guarded trigger reachability and consolidated offline recheck

- Previous turn completed fixed skill archive evidence. Grouped current unreviewed reachability findings:28missing root,12orphan follow-up diagnostics; these are structural findings, not40mechanisms or completed items.
- Found and fixed false reachability: requiresEffectGrant triggered listeners were seeded as independent roots, letting their downstream actions bypass grant reachability checks. They now require a path from the cast or legitimate unguarded event entry, and orphan guarded listeners themselves produce issues. New test covers unapplied definitions, actual application, downstream grant and disconnected/self-cycle behavior without modifying input.
- Reachability/example/Headless preflight suites28passed. Re-read and ran offline fullbook runner against exact-source unedited automatic artifacts only: r8 remains32ready-for-behavior-tests/123blocked, no entry/candidate changes fromr7. API0. Generated backlogr8, verified exact entries/issues equality before migrating reviewr23/coverager18;40reviewed/905unreviewed links remains unchanged. No source success promotion.
- Typecheck68003 running after accumulated changes including final skill UI/new archive test and reachability fix. Recover same handle before restarting. User rooms untouched; fullbook goal active/incomplete.

### Invalid map-coordinate rejection at the Activity boundary

- Previous turn fixed guarded-trigger reachability and rechecked all original drafts offline. Recovered typecheck68003 exit0; it covers the accumulated skill UI/archive/reachability batch, preceding this turn's map changes.
- Followed the earlier malformed-coordinate fixture observation into the actual map authority: NaN/undefined could bypass ordinary comparisons. Added finite numeric destination, source token, directional origin and movement-distance validation before placement. Area selection similarly validates resolved Host center/range origin and rotation before geometry calculations; self-centered spheres still use their Host-owned center rather than client anchor.
- Tests cover malformed/missing/wrong-key/string/null/nonfinite destinations across forced/teleport/push/pull and atomic rejection after an earlier valid movement in the candidate. Area tests cover nonfinite coordinates/rotation and preserved self-center canonicalization. No source-map mutation.
- Movement plus recipient integration66passed; after the final area guard, complete map-interaction suite55passed. API0, no original artifact promotion or room writes. No live process; latest full typecheck predates only this map batch. Fullbook goal active/incomplete.

### Group command lifecycle and source-control review

- Previous conversational turn only confirmed batching policy: no progress. Revalidated current review; the single group-command diagnostic was already reviewed, so did not count it twice.
- Added registered Activity lifecycle cases for persistent-order and turn-order: group command, JSON round-trip, reject repeated bonus-action request, actual ordered Dash for both companions with individual action consumption, deny other actions/repeated Dash, advance turns and validate order persistence/expiry. Routing and generic primitives suites26passed.
- Inspected exact private inventory paragraphs for Danse Macabre and Tiny Servant. Recorded incomplete voluntary movement/task completion and persistent-order self-defense, plus entity lifecycle limits; finite command persistence is not full source behavior. Source distances60/120 remain distinct.
- Added summon-command review evidence, exclusive reviewr24/coverager19:43reviewed diagnostics,902unreviewed links,8partial,33expressible,2source corrections.122entries still need review;1awaits batch regeneration. Three composite diagnostics are partial only; no original recipe promotion.
- API0, no original artifacts or user rooms changed; no running process. Latest full typecheck predates map guards and these new tests. Fullbook goal active/incomplete.

### Persistent-order self-defense through map and Host

- Previous turn made progress with group-order lifecycle tests and three scoped partial reviews. This turn repaired the identified persistent-order self-defense gap, without changing source recipes.
- Host records actual attack-resolved aggressors for both summon command policies (including misses), permits uncommanded retaliation only against those recorded attackers, and preserves active command priority. Automatic map target selection now uses retaliation for persistent-order too.
- Both policies tested through actual incoming attack, map application, JSON persistence, monster turn plan, attack preparation and Host resolution; additional tests deny unprovoked targets and deny retaliation contrary to an existing Dodge order. Three related suites36passed; updated conversion guide suite15passed.
- Arbitrary threat judgment, non-attack hostility and movement/task completion remain unresolved; original composite diagnostics remain partial. No increase in source certification or source conversion count. API0; rooms untouched.
- Consolidated typecheck47849 is running for the accumulated map/command batch. Recover same handle before restarting. Fullbook goal active/incomplete.

### Ordered Dodge planning and typecheck cleanup

- Previous turn made progress on persistent-order self-defense. Recovered typecheck47849: exit1 with one TS2367 unreachable mode comparison in summonAutomaticTargets after that change. Removed the dead comparison and narrowed local mode type.
- Found an actual planning/settlement mismatch: any valid summon order previously disabled summon target constraints, so Dodge orders could plan ordinary attacks that Host rejected. A valid Dodge now explicitly returns Dodge-only automatic mode and the planner produces a stationary Dodge plan.
- Added both-policy tests covering JSON-restored Dodge orders despite an available recorded aggressor, real map snapshot and Host Dodge settlement, action consumption, duplicate-action rejection and unchanged source map. Automatic target + registered routing suites26passed before the type-only dead-branch cleanup.
- API0; source recipes and rooms untouched. Movement destinations, Help targets and task completion remain open; no original source promotion. Consolidated typecheck99545 is live after cleanup and this turn's edits; recover it before another run. Fullbook goal active/incomplete.

### Ordered attack planning matches Host command authorization

- Previous turn fixed Dodge planning and removed the dead mode branch. Recovered consolidated typecheck99545 exit0; it was started before this turn, so not claimed as verification of this turn's later edits.
- Attack orders previously bypassed summon-specific candidate constraints entirely. Added explicit attack targeting mode using existing opposing-side rules, excluding protected/dead/obstacle targets. Planner now filters spells, special/support actions, unauthorized bonus actions, Dash and Dodge for an attack order; no legal target yields a no-action plan instead of an unauthorized Dodge.
- Both persistent and turn orders tested after JSON restoration through target selection, actual planner, monster attack preparation and Host settlement. Tests cover allies, absent targets and distant targets without unauthorized Dash/Dodge. Two related suites28passed.
- This does not implement specified movement destinations or natural-language task completion. Out-of-reach attack orders are not silently interpreted as permission to Dash; a dedicated movement instruction remains necessary. No claim of complete source spell behavior.
- API0, original recipes/rooms unchanged, no live process. Source diagnostics remain partial. Fullbook goal active/incomplete.

### Existing movement and Help settlement verified for summon orders

- Previous turn made progress aligning attack plans with Host authorization. This turn inspected remaining Dash/Disengage/Help paths rather than adding a duplicate movement engine.
- Added four real-map tests (two policies x Dash/Disengage): explicit destination, actual path/Host move, action consumption, map application and JSON persistence, unchanged input, rejection without command. Dash destination exceeds ordinary Dretch speed; Disengage uses normal movement. These fixtures begin with a saved order; they do not certify UI order parameter collection.
- Added two registered Activity Help cases: caster spends a bonus action to command, helper's subsequent turn executes Help with 5-foot validation and its own action cost; invalid distance/repeat use rejected, subsequent allied attack actually uses the higher die and consumes Help. Both policy lifetimes covered.
- Two affected suites34passed. Guide now distinguishes command issuance from the already available later movement/Help settlement. Remaining integration is command-time destination/Help target capture, persistence and planner routing, plus completion semantics; do not count primitive execution as full spell automation.
- API0; no original source artifacts or user rooms altered. No live process. Latest successful typecheck99545 predates attack-planning edits and this turn's tests/guide. Fullbook goal active/incomplete.

### Explicit Help target capture in compiled Activities

- Previous turn established that primitive movement and Help settlement already work. This turn added an actual invocation contract rather than treating inferred targets as submitted choices.
- command-owned-companion may declare requiresHelpTarget:true (only valid for Help). Compiled action accepts payload.companionHelpTargets keyed by operation id; executor validates selected target against the Host full encounter, rejects self-target and invalid Help kind, then projects helpTargetId/helpKind into command proposals and saved map/character/Host state.
- Both direct and compiled settlement paths retain fields and validate paired values; Headless refuses a Help action that switches target or kind. No early Help effect or summon-action consumption occurs when the caster issues the order. Legacy unbound commands remain supported.
- Both policy integration tests now issue actual bound commands, reject malformed/missing/unknown/self selections without bonus-action loss, JSON restore binding, reject substitutions, validate actual Help and subsequent attack advantage. Routing + automatic movement suites34passed; guide + validation suites39passed.
- Selection UI, planner consumption, movement destination binding and task completion remain incomplete; no source draft certification. API0, original recipes/rooms untouched. Consolidated typecheck71394 running after accumulated attack-planner and binding changes; recover same handle. Goal active/incomplete.

### Plugin panel Help target selection

- Previous turn implemented bound Help parameters and Host enforcement. This turn connected the generic plugin combat panel to that contract: explicit attack/check Help selector, explicit creature selector, operation-keyed payload for ordinary and area dispatch, and submission disabled until all relevant selections are valid.
- Choices are scoped by feature and Activity. Only currently possible choice branches request Help parameters. Command recipients, obstacles and dead tokens are excluded; removed/stale selections are not silently replaced. Helper creates a fresh payload and drops inactive branch values.
- New selection helper tests plus registered Host routing20passed. UI is wired but not browser-verified; other spell/effect-grant entry points and automated Help planning remain pending.
- Recovered typecheck71394 exit1: one invalid test JSON union containing undefined. Changed malformed input fixture to actual JSON serialization (missing value becomes omitted) and guarded optional UI payload before sending. Typecheck88071 running for accumulated binding/UI changes; recover before restarting.
- API0; no source recipes or user rooms changed. Fullbook goal active/incomplete.

### Bound Help planning and restored monster check advantage

- Previous turn wired plugin panel selection. Added help plan contract, planner consumption of valid bound orders, reusable monster map Help settlement, and simulation decision/execution dispatch. Planner previews Host validity on a cloned map snapshot; missing/unbound/out-of-range orders wait without substitution. Automatic approach movement remains incomplete.
- Four both-policy/both-kind tests exercise JSON-restored order, plan, actual map Help application and original-map immutability. This exposed a real bug: monster ability-check Help fields were omitted from map state/application. Added both source id/turn key fields; rebuilt map snapshot and actual subsequent check now picks18 over2 with advantage and consumes Help.
- Summon targets/basic actions/UI selection suites29passed after final checks. Simulation Help dispatch is wired but not independently certified by these map tests; live browser and other spell/effect entry routes remain pending.
- Recovered typecheck88071 exit1 with two fixture/UI issues: incomplete Activity fixture cast and duplicate default field spreads. Replaced fixture with typed outcome-only input and default-before-patch expression. Typecheck64983 running after fixes and current plan/map/simulation edits; latest guide wording adjustment followed launch.
- API0; no original source recipes or user rooms changed. Goal active/incomplete.

### Simulation command state handoff and lifetime

- Previous turn added Help planning/map settlement and repaired lost monster check Help. Recovered typecheck64983 exit0; it predates this turn's later simulation state edits.
- Found that simulation construction omitted summon source/policy/commands, and later map projection could keep stale commands. Added cloned initial summon and command state, authoritative Headless-to-actor command/Help projection, and actor-to-map projection. Help decisions now log the actual Help action name.
- New public simulation cases run two rounds with both policies, actual bound target and owner on the map: Help executes with a committed transaction and no attack rolls; persistent orders Help twice, turn orders only once. Source map unchanged. Multiattack simulation suite5passed (including prior cases).
- Broader combatSimulation + summonAutomaticTargets regression session93272 completed exit0:69passed. No live process. API0; original recipes/rooms unchanged; complete import/browser certification still pending. Goal active/incomplete.

### Bound companion commands through archive and public command authority

- Previous turn completed simulation command handoff/lifetime tests. This turn found the independent public Activity command path did not forward Help selections or a full authoritative encounter; the compiled plugin path alone was insufficient.
- Added bounded, validated companionHelpTargets to Dnd5eExecuteActivityCommandV1. Its authority forwards Host-owned combatant snapshots separately from submitted intent, enabling executor target checks without accepting client actor data.
- New native synthetic archive test performs export/read/install/issue-command/uninstall/re-export/independent reinstall. RequiresHelpTarget survives; nonexistent target fails, valid bound Help commits with bonus-action cost, JSON restores binding, changed target/kind is denied, actual Help succeeds on the helper turn. Source bundle/state unchanged and registry cleaned after each install.
- Archive and command-boundary suites6passed, including malformed selection shape/type/key and >64 entries. The requested CombatAuthority.test.ts path did not select a file; no claim that a third suite ran. These are synthetic module/interface proofs, not original PDF conversion certification.
- API0, original recipes/rooms untouched. Consolidated typecheck70080 running covering accumulated simulation and archive/public-command changes. Recover same handle. Fullbook goal active/incomplete.

### Spell transaction forwards bound Help selections

- Previous turn repaired public Activity command authority and archive proof. Recovered typecheck70080 exit0; it predates current spell transport edits.
- Inspected shared spell request and preparation: the spell transaction reconstructed a whitelist-like plugin payload and dropped the new Help selection. Added companionHelpTargets to the shared spell intent type and copied it into compiled activity invocation payload.
- Added actual native unified synthetic spell registration and prepare/resolve spell-transaction cases. Valid selection persists the companion binding and spends one spell slot; nonexistent Help target fails with no application and prepared/source state unchanged. Two cases passed;119 unrelated tests skipped by explicit name filter, not claimed as full suite.
- Corrected initial test fixture schema mistakes (range is distance/feet; map summon side is player/enemy, not Activity ally/enemy). No runtime weakening to accept those invalid forms.
- API0; no user room/source recipe changes. No live process. Actual room network and browser spell selection still unverified; new field plumbing alone is not complete UI integration. Fullbook goal active/incomplete.

### Granted-ability entry points collect Help parameters

- Previous turn repaired spell payload forwarding. Added reusable asynchronous explicit Help-kind/target choice collection and integrated it at the shared plugin action submission entry for player and DM grants, after recipients are known. Existing panel-supplied parameters bypass the prompt.
- Cancellation/invalid/no candidates returns without submission. A pending prompt guard prevents duplicates. Completion checks map identity, room membership and combat/round/initiative identity before dispatch, avoiding a delayed choice becoming a request on a different turn. No action/resource mutation occurs while asking.
- Choice helper + archive + registered routing22passed, including multi-operation selections, cancellation and invalid target answers. No browser or real shared-room certification from these tests; direct spell selection UI and movement/task parameters remain pending.
- API0, no source recipe/user room changes. Consolidated typecheck66714 running for accumulated spell/request/UI edits; recover same handle. Latest guide wording update followed launch. Goal active/incomplete.

### Spell selection and real dialog integration

- Previous turn connected effect-granted plugin entry points. Added corresponding final spell-submission choice collection after actual spell recipients are known, sharing the existing Help choice helper and pending guard. Supplied selections bypass prompts; cancellation, changed map/member/turn prevents deferred submission.
- Added real application dialog-store + AppDialogHost rendering integration: both Help kinds shown as choices, target label appears on second dialog, settled ids produce exact operation-keyed intent, cancel returns null and closes the dialog. No search/number prompt. Dialog + selection suites12passed; this is SSR/dialog integration, not browser/network E2E.
- Recovered typecheck66714 exit1: shared chooser callback message was optional while AppActionChoiceOptions requires it. Made helper contract message required and supplied the first prompt message. Typecheck17655 running after accumulated plugin/spell/dialog fixes; recover same handle. Guide wording followed launch.
- API0, original recipes/user rooms unchanged. Movement parameterization, task completion and fullbook source/browser certification remain incomplete. Goal active/incomplete.

### Corpse-target routing and consolidated offline workflow

- Recovered typecheck17655 exit0 before the corpse-routing change. Registered feature validation previously rejected all 0 HP targets before the declared corpse summon executor could validate them. Reused the existing declared revive/corpse exception for single and multiple feature targets; ordinary activities retain the HP guard.
- Added a synthetic registered Activity case selecting separate declared skeleton/zombie forms per corpse, with invalid second-corpse cases checking atomic rejection. Routing and map interaction suites completed exit0:73passed. This does not certify visibility, source spell scaling or original PDF conversion.
- User batching constraint remains in force: finish mechanism groups and offline verification before consolidated paid conversion. This verification used no AI API; original automatic drafts and rooms5273/5274 remain unchanged. No fullbook completion claim.

### Corpse group limits and shared sight authority

- Previous goal turn classified as progress: recovered 73 passing routing/map cases and recorded the corpse-target routing repair. This turn inspected current contracts and call sites before extending coverage.
- Registered corpse summon coverage now exercises five distinct corpses, atomic rejection of a sixth, duplicate ids producing only one summon each, and separate ordinary single/multiple feature regressions retaining their existing 0 HP guard.
- Found creature requiresLineOfSight was enforced at map selection/trigger paths but not uniformly in the active Headless plugin branch. Added a shared creature-target check against Host combat state using existing dnd5eCombatantCanSee, after targets resolve and before effects/resource settlement. No sight requirement is inferred for activities that omit it. Added blocked physical sight and ordinary darkness cases for the second corpse with unchanged input state.
- Consolidated routing, map interaction and companion archive suites exit0:76passed. Synthetic proofs only; no source conversion or browser certification. Current changes have not yet had a new consolidated typecheck. No live test process. Paid API0, original drafts and rooms unchanged. Fullbook goal remains active/incomplete.

### Converter guidance and exact diagnostic review r25

- Previous goal turn was progress: shared creature sight authority and 76 passing local cases. Inspected the actual extracted source, contracts, routing tests and map lifecycle evidence before reviewing diagnostics.
- Added converter guidance for corpse form choices, per-target form intent, count/range/visibility and atomic validation. The original automatic configuration remains unchanged; no paid conversion.
- New private immutable review r25 / coverage r20 reconcile two exact corpse-selection claims. Coverage:45 reviewed distinct diagnostics,35 expressible links,8 partial,2 source corrections,900 unreviewed links. There are still122 entries awaiting mechanism review and1 awaiting batch regeneration; these are review categories, not completed spell counts. Paid gate remains false.
- Concentration-loss restoration evidence inspected but not generalized to all end conditions. Full source spell, upcasting, attack bonuses and browser flow remain uncertified.
- Consolidated typecheck started: session40985 is confirmed running with no output beyond compiler startup. Recover this handle rather than starting another. API0; rooms and source drafts unchanged. Goal remains active.

### Summon casting-modifier bonus evidence

- Recovered consolidated typecheck40985 exit0; it covers the previous routing/sight/guide changes, not the test edits below. Previous turn classified as progress (converter guide and immutable review reconciliation), with a verified compiler wait.
- Extended the actual registered corpse Activity fixture with actor-spellcasting-ability-modifier attack/damage formulas: Host DC15 and proficiency3 yield +4 in each corpse handoff.
- Added separate skeleton/zombie map tests consuming summon handoffs, serializing/restoring generated tokens and executing real prepared monster attacks. Against identical rolls and targets, +4 gives exactly +4 attack total and +4 damage compared with zero bonus. Original map remains unchanged. These are complementary compiler and map/attack proofs, not a single source-generated end-to-end test.
- Routing/map suites77passed. SRD skeleton/zombie profiles are available for these tests; do not generalize to missing external monster definitions. Original configuration, full spell upcasting/control, import and browser certification remain unverified.
- API0; no paid conversion, original recipe or user-room changes. No live compiler/test process. Goal active/incomplete.

### Corpse lifecycle boundaries and review r26

- Previous turn progress: compiler bonus and actual monster attack proofs,77passing local cases. Current authoritative code retained only corpse x/y when restoring, losing current elevation.
- Expanded mixed-corpse test across concentration loss, expiry, defeat and dismissal, with serialized restoration, expiry boundary, moved elevation and repeated cleanup. All4 initially failed the elevation assertion. Shared restore now preserves current elevation (fallback original); map/lifecycle suites76passed.
- Private review r26 / coverage r21 reconcile exact installed-profile bonus and corpse-end-state claims:47reviewed diagnostics,37expressible links,898unreviewed links. Remaining broad command/task and whole-source requirements unchanged. No paid gate, fullbook or original source certification.
- API0; original drafts and rooms untouched. No live process. Latest runtime/test changes await the next accumulated typecheck. Goal active/incomplete.

### Public Activity authority sight parity

- Previous turn progress: corpse elevation fix, lifecycle tests and review reconciliation. Current inspection found public registered Activity combat authority did not enforce creature requiresLineOfSight even though the plugin branch now does.
- Extended native archive/independent-install command tests with both sight-required and unrestricted declarations. Required-sight case first failed because blocked target still committed. Added Host dnd5eCombatantCanSee validation before command resolution/commit, returning target-snapshot-mismatch without spending resources. Unrestricted actions retain their behavior.
- Archive, public command and registered routing suites27passed after the fix. Evidence covers two independent installs and input-state immutability; not browser/room network certification. API0, original recipes and user rooms unchanged.
- No live process. Public authority plus recent lifecycle/test changes await next consolidated typecheck. Fullbook goal active/incomplete.

### Corpse scaling through native module import

- Previous turn progress: fixed public Activity sight authority with27passing cases. Current turn broadened corpse routing into five slot-level cases,5through9, using declared +2targets per level scaling. Target maxima5/7/9/11/13 resolve, one extra target rejects atomically, and per-corpse form, modifier, sight/range/body checks remain covered.
- Replaced direct fixture registration for these cases with a native synthetic unified module export/read/install. Actual imported module registrations perform the Headless requests. Source bundle unchanged and registry disposed after each case. This is artifact/engine integration evidence, not an original PDF-generated spell or room-network/browser proof.
- Registered routing suite24passed. No paid API, source recipe or user-room changes. Fullbook remains active/incomplete. Current accumulated test/runtime changes due for consolidated typecheck.
- Consolidated typecheck now running as session74655; recover this handle. No terminal result yet.

### Declared creature line-of-effect parity

- Previous turn progress: native archive corpse scaling5through9 and24passing cases. Continued the same pending typecheck74655 (still running at last observation); current authority edits postdate its start.
- Found explicit creature requiresLineOfEffect was not checked by public Activity authority or the active plugin path. Archive matrix first reproduced failures for both sight/effect combinations requiring line of effect. Added checks from Host effect origin and authoritative blocked directed pairs before settlement in both paths. Sight remains actor-based and independent; omitted/false line-of-effect declaration retains existing behavior.
- Archive tests cover all four sight/effect flag combinations through independent installations. Bound-weapon registered test proves caster-to-target obstruction does not block a holder-origin effect, while holder-to-target obstruction rejects without mutation. Archive, routing and command suites33passed.
- API0; source drafts and rooms untouched. Original conversion/browser certification still pending. Goal active/incomplete; recover compiler74655 rather than duplicate it.
- Terminal result recovered: typecheck74655 exit0. No compiler remains running. The current line-of-effect edits postdate compiler launch, so they still require the next consolidated check.

### Per-target form intent through the spell entry

- Previous turn progress: line-of-effect parity with33passing cases. Inspected real shared choice UI, command DTO and spell preparation whitelist. UI collects forms, but preparation omitted activityTargetFormIds; direct/non-UI preparation silently used the default form for every corpse.
- New synthetic registered spell transaction reproduced skeleton+skeleton instead of requested skeleton+zombie. Preserve a cloned per-target form map in compiled spell payload. No willingness/consent bypass was added.
- Valid/undeclared-form spell cases now test actual preparation/resolution: distinct forms survive, one spell slot is spent on success, undeclared form fails without application, and prepared/source state remains unchanged. Combined with bound Help transport regression:4passed,119unrelated skipped explicitly. No claim of whole suite or browser certification.
- API0, original drafts/rooms unchanged. No live process. Current transport and recent line-of-effect changes await next consolidated typecheck. Goal active/incomplete.

### Choice-aware per-target form UI

- Previous turn progress: fixed per-target form transport and four spell-entry tests. Current UI inspection found it chose the first transform/corpse operation across all outcomes, including a mode the caster did not select.
- Added choice-aware form-operation lookup using the existing closed-choice predicate semantics and used it in the real shared spell flow. Inactive form modes no longer prompt or overwrite the selected mode's form map; unresolved Host check conditions remain eligible for input collection.
- Choice suite16passed. Corrected a test fixture condition to the actual check/failure schema before final rerun. This is local branch-selection evidence, not rendered browser/room acceptance; simultaneous independently parameterized form operations still share the existing per-target map contract.
- Consolidated typecheck running session49259 after line-of-effect, spell transport and current UI edits; recover that handle. API0, original drafts/rooms unchanged. Fullbook goal active/incomplete.

### Effective target restrictions after choices and scaling

- Previous turn progress: choice-aware form UI and16passing cases. Archive restriction matrix expanded to direct, chosen target override and cast-level target profile. Six cases first reproduced bypasses because Host spatial validation read only the base declaration.
- Added shared scale-then-choice target projection matching executor order. Public Activity authority and plugin path now check sight/line-of-effect and resolve bound effect origin against that effective target. No inference of unrequested restrictions.
- Archive/routing suites36passed; source artifacts and browser workflows remain independently uncertified. API0, rooms/drafts unchanged. Current effective-target edits postdate pending compiler49259 launch; recover its result separately and avoid claiming it covers these changes. Goal active/incomplete.
- Recovered typecheck49259 exit0. No live compiler remains; effective-target edits still await next consolidated check.

### Feature route target projection parity

- Previous turn progress: effective sight/effect checks and36passing cases. Extended native archive matrix to call both public authority and compiled plugin feature, with base range5 and choice/slot range120. Eight cases reproduced the feature route rejecting valid targets due to its stale base projection.
- Feature target projection now uses the same effective target (scale then choice) as spatial validation, including cast-level profiles without a scaling array. Both imported invocation paths accept the same valid10-foot target and enforce declared sight/effect restrictions.
- Archive/routing suites36passed; affected pluginFeatureAction/adapter suites32passed. No source-generated or browser certification inferred. No paid API, original recipe or room changes. Goal active/incomplete; current effective target/projection edits await next accumulated typecheck.

### Remaining mechanism grouping and source exception r27

- Previous turn progress: effective feature projection and68passing local checks. This turn inspected remaining source diagnostics by mechanism family (overlapping labels, not counts of independent missing engine features), then compared two cleanup claims with extracted source and runtime.
- Review r27 / coverage r22:49reviewed distinct diagnostics,38expressible links,9partial,2source corrections,896unreviewed links. Lesser Demons basic cleanup is expressible. Infernal Calling retains its actual exception: opposed-command failure immunity and3d6minutes after premature concentration loss cannot be certified by existing single-die round control-save linger.
- Existing lifecycle tests and code were inspected; no unchanged suites rerun and no new whole-spell acceptance claimed. Next implementation should separate post-control expiry policy from the current control-save-only timer and preserve Host-owned rolling/persistence. Catalogue and narrative behavior remain distinct.
- API0, original drafts/rooms untouched. No live process; recent effective-target edits await next consolidated typecheck. Goal active/incomplete.

### Independent uncontrolled linger policy

- Previous turn progress: exact source exception review r27. Added summon.uncontrolledLinger independent of controlSave: bounded dice count/sides, round/minute units and explicit original-expiry cap. Activity contract/validation/executor, map handoff, summon plan, persisted token normalization and both early concentration cleanup routes forward it.
- Host detachment persists every die, sum and deadline; minute totals become ten rounds each. Default policy can extend beyond original expiry, while legacy controlSave.lingerDieSides retains capped single-die rounds. Invalid rolls/policies reject and repeat detachment cannot reroll after concentration id clears.
- New lifecycle proof:3d6=[2,3,4] at round599 yields deadline689 despite original600; JSON restore preserves rolls, no repeat roll, removed exactly at689 or immediately on HP0. Summon/map suites77passed. No complete Infernal Calling claim: opposed command failure/control immunity, noncombat-time integration and full source conversion remain pending.
- API0, source drafts/rooms unchanged. Recent effective-target plus new timer interfaces await consolidated typecheck. Goal active/incomplete.
- Consolidated typecheck running session32885; recover this handle. No terminal result yet.

### Lost-control persistence boundary

- Previous turn progress: independent multi-die minute timer and77passing cases. Recovered typecheck32885 exit0; it predates current persistence edits.
- Found shared validation rejected every controlEnded+concentrationId token, contrary to legitimate control-save state, and map migration only allowed this state with controlSave, dropping new independent linger policies. Added bounded control-save validation and permitted ongoing concentration only with declared valid control-save/linger policy; malformed declarations remain rejected.
- Shared resource/map migration/summon suites59passed. Enhanced actual minute timer test to pass both pre-detachment and detached tokens through migrateMapsState, verifying policy, concentration, dice and deadline persist; updated summon suite17passed.
- Further authoritative gap found: scripts/shared-server-core.mjs removeCharacterConcentrationEffectsFromMaps unconditionally deletes ordinary concentration summons, bypassing both old/new linger and animated-corpse restoration. Must repair this server cleanup with Host time/context before claiming shared-room lifecycle support. Noncombat campaign-time deadlines remain pending.
- API0; rooms/source drafts unchanged. No live process. Current persistence edits await next consolidated typecheck. Goal active/incomplete.

### Server concentration cleanup restores animated bodies

- Previous turn progress: shared control-state persistence and migrated timer tests. Inspected server end-concentration transaction: it atomically loads character/map resources but not combat time, and cleanup deleted animated corpse summons without restoring their originals.
- Added animatedCorpse restoration to server cleanup, preserving current x/y/elevation and HP0 before the existing object-polymorph branch. New test checks exact original body restoration, other caster isolation, source immutability and repeat cleanup after serialization.
- Targeted server tests2passed,170unrelated tests explicitly skipped. No full server-suite claim. Linger remains pending in server cleanup: the transaction must load authoritative combat/time context before sharing the Host timer algorithm; do not use client round or silently guess elapsed noncombat time.
- API0, user rooms/source drafts untouched. No live process. Current server/persistence and earlier effective-target changes await next accumulated typecheck. Goal active/incomplete.

### Shared server linger transition

- Previous turn progress: server animated-corpse restoration with2targeted passing cases. Extracted existing linger policy validation/detachment into shared/summon-linger.mjs with typed declarations; browser runtime reexports the same implementation, avoiding separate dice/deadline algorithms.
- Server concentration cleanup now retains eligible living, unexpired, uncontrolled summons using Host round and saves dice/deadline. End-concentration transaction reads combat alongside maps/characters under its write lock; missing/invalid timing returns409 without publishing either mutation. Roll injection is internal test/authority context only, never copied from player payload.
- Server tests4passed,170unrelated skipped: legacy cap,3d6minutes exceeding original expiry, missing time rejection with immutable source, serialization/replay, expiry and defeat. Existing corpse restoration tests remain included. Noncombat campaign-time expiry and actual HTTP/client flow remain unverified.
- API0; source recipes/rooms unchanged. Current shared-module/server changes await accumulated typecheck. Goal active/incomplete.

### Absolute exploration linger deadline

- Previous turn progress: shared server/browser linger transition and38passing checks. Added optional Host worldMinute to shared detachment, recording dismissAtWorldMinute alongside the combat deadline; fractional minutes preserve six-second dice timing within the minute-resolution clock.
- Persist/validate the absolute deadline through maps and shared resource boundary. Server end-concentration reads validated campaign clock under the transaction lock and rejects corrupted time. Browser map handoff/reconciliation passes scene clock. DM CampaignTimeSystem expires linger tokens while reconciling clock advances, preserving corpse restoration when applicable.
- Lifecycle test now uses actual map migration and checks480+9=>489, not removed at488, removed at489, repeat expiry idempotent. Summon, CampaignTimeSystem and shared validation suites44passed. Current evidence is helper/component regression; no new real HTTP transaction or two-client acceptance claim. Clock advances while DM offline/server-only cleanup and command-failure control still need verification/implementation.
- API0, drafts/user rooms unchanged. Compiler42694 started before this turn's absolute-deadline edits; its result cannot certify them. Goal active/incomplete.
- Recovered typecheck42694 exit0. No live process; absolute deadline changes await next consolidated check.

### Server clock transaction expires stored summon deadlines

- Campaign-time mutation now uses the shared multi-resource transaction lock and journal. Stored absolute summon deadlines are reconciled on the server; changed clock/maps are committed together, and both undo entries receive the same group id. The existing change notifications publish after the transaction.
- New disk-backed transaction suite: 4 passed. Covers before/at deadline, no-op and later advances without rewriting maps, concurrent advances without losing clock increments, denied authority/invalid clock leaving both resources untouched, and invalid map output rejecting before clock creation. These are direct transaction-helper tests, not HTTP or browser acceptance; injected filesystem failure and undo UI were not tested in this batch.
- Updated AI SDK guidance to distinguish independent minute/round linger policy from the still-missing opposed-command failure/immunity trigger. No source recipe promoted and no full Infernal Calling certification claimed.
- New paid API calls: 0. Source drafts and user rooms unchanged. Consolidated typecheck72984 running; goal remains active/incomplete.

### Opposed companion command failure interface

- Previous goal turn classified as progress: atomic server clock/map expiry and four disk-backed transaction tests. Recovered typecheck72984 exit0; it preceded this turn's new control-operation edits.
- Added `end-owned-companion-control` across contracts, validation, executor, mechanic registry, shared compiler settlement, direct authority settlement and map persistence. This closes the state transition after a declared failed opposed check; it does not infer when a narrative order warrants a check. Optional hostility remains separate from control loss; concentration and creature lifetime remain intact.
- Added actor/target Host skill-modifier formula references to avoid replacing skill checks with raw ability modifiers. Missing Host data and unknown skill keys reject. Converter guidance and SDK documentation describe the narrower guarantees.
- Related archive/formula/summon-routing/map suites97passed. Earlier command-archive/shared validation batch31passed. Final integrated archive rerun2passed after adding actual server concentration cleanup followed by absolute linger expiry. All fixtures explicitly synthetic; no PDF recipe promoted, no room modified, no API called.
- Typecheck12616 started after runtime changes and is still being observed; later test-only lifecycle additions are outside its start snapshot. Full-book goal active, paid batch gate still closed.
- Typecheck12616 finished with two categories of new errors: a non-discriminated formula reference union and the public-result test lacking a commit-phase guard. Split the formula references and added the guard; consolidated check57331 now running. Reviewr28/coverager23 refresh the partial lifecycle evidence without promoting any source:49reviewed diagnostics,896unreviewed links,9partial,38expressible,2source corrections. Paid gate remains false.
- Final validation/archive/formula batch32passed after those fixes. Compiler57331 was polled live with no new output; do not restart it merely because observation returns without completion.

### Shared opposed-check skill context and defender choice

- Previous goal turn classified as progress: control-loss operation, skill formula references and synthetic module lifecycle proof. Recovered compiler57331 exit0; it does not certify this turn's later mode changes.
- Added optional sourceSkill context with direct skill-formula inference and validation. Shared Host mode helper now feeds compiler, per-target dice and trigger-source modes. Public registered-command authority derives opposed Host modes from state, overriding contradictory extra mode input. Opposed log events retain source skill. Fixed compiler/presentation choosing the first defensive option while settlement chose the best-modifier option.
- Synthetic archive expanded to Deception/Intimidation/Persuasion × two allegiance outcomes. Six final cases passed, covering actual installed-module execution, public authority, displayed dice count, triggered dice, contradictory input modes, skill advantage and inferior first defender option. Related64-test batch also passed before the six-case expansion.
- Re-read extracted source159:1; numerical opposed-check diagnostic can be classified expressible, while composite command/task diagnostic stays partial. Source conversion, arbitrary tasks, true-name/talisman semantics and dual-client acceptance remain separate. API0, original drafts and rooms unchanged.
- Compiler73977 running after runtime changes; final parameterized test expansion happened later. Goal active, whole-book paid gate remains closed.
- Compiler73977 completed with an unused trigger import and two missing required recipe-test callbacks. Removed the import, supplied neutral unrelated save/attack callbacks and started5892. Defender scoring also explicitly matches the executor's standard skill snapshot rather than substituting an option ability for a skill modifier. Reviewr29/coverager24:51reviewed diagnostics,894unreviewed links,10partial,39expressible,2source corrections; source/full-book certification remains false.

### Opposed flag cancellation across authorities

- Previous turn classified as progress: common skill-aware modes and exact diagnostic review. Recovered compiler5892 exit0. Found explicit advantage/disadvantage bypassing Host flags and trigger size conditions subject to double application.
- Shared opposed mode calculation now combines declared/size flags with Host effects before reduction; final Host mode keys prevent applying a size rule twice. All registered authorities derive final modes. Numeric tests cover exhausted and skill-disadvantaged actors, simultaneous advantage/disadvantage sources, ordinary declarations retaining Host effects, and size cancellation.
- Imported-module mode suite plus archive suite12passed; existing opposed/Telekinesis tests5passed,178skipped. These are local synthetic/runtime checks, not new source or browser certificates. Updated SDK/AI guidance. No paid API requests, source recipe changes or room changes.
- Compiler75486 running after the implementation and test batch. Full-book goal remains active; narrative/conditional-source UI/talisman/general task obligations are not inferred complete from numeric tests.

### Persistent area source DC across registration and settlement

- Aligned declaration, saved snapshot, map interaction and legacy feature settlement for initial-save, repeat-save and escape-check `source-save-dc` references. Host captures a valid integer DC at creation; missing/invalid values reject instead of guessing 10. Saved snapshots reject unresolved references and malformed conditions.
- Plugin registration now accepts nested source references, validates the condition through the shared declaration normalizer and clones escape-check data. Explicit source DC survives effect creation for plugin sources as well as spell sources.
- Local batch: 4 files / 111 tests passed, including actual legacy feature registration and area creation, map reload, invalid Host DC rejection, and repeated saves after the caster DC changes. These are synthetic runtime tests, not source-book conversion or browser certification. Native archive round-trip evidence for this new nested-field path is still pending.
- Earlier compiler75486 issues fixed (unused import and test narrowing); compiler46409 result was unavailable. Fresh consolidated compiler58731 is running. SDK and conversion guidance document all three fields. No paid API calls, source-draft edits or room changes; reviewr29/coverager24 remain unchanged.

### Native module round-trip and remaining area DC consumers

- Previous goal turn classified as progress: registration and Host settlement aligned, 111 local tests passed. Compiler58731 then completed with errors in the builder, native area snapshot construction and two Web fixtures; these exposed additional consumers of the widened declaration type.
- Added a synthetic `.starmod` export/read/install/uninstall test that executes the installed Activity and verifies initial/repeat/escape DC references survive into its area proposal and resolve numerically. Three source-DC tests pass. This is module-path evidence, not an automatically converted source spell.
- Builder now represents repeat-save DC as either fixed or source-derived and preserves hidden condition fields (including escape checks) when rebuilding the visible condition. Native area generation resolves nested duration DC; Web fixtures explicitly create numeric snapshots.
- Related batch: 4 files / 53 tests passed. Builder's existing test only covers draft metadata migration, not rendered UI or the new selector; no browser acceptance claimed. Compiler49240 running after corrections. API0; original drafts, rooms and review classification unchanged.

### Area DC review evidence recorded

- Previous turn classified as progress: native module round-trip test and remaining declaration consumers fixed. Re-polled live compiler49240 until terminal exit0; consolidated typecheck passed.
- Reviewr30/coverager25 classifies only the exact repeat-save source-DC diagnostic as expressible, based on installed synthetic Activity, Host numeric snapshot, map persistence and Headless repeat-save behavior. Original source-generated recipe still requires batch regeneration and remains behaviorVerified:false. Other Snare mechanics are not promoted.
- Coverage:52reviewed diagnostics,893unreviewed links,10partial,40expressible,2source corrections;122entries still need mechanism review. Paid conversion gate remains closed. API0, original source drafts and user rooms unchanged.

### Installed effect-granted follow-up actions

- Previous goal turn classified as progress: typecheck49240 exit0 and exact area-DC review evidence recorded. New synthetic flight module tests exposed a genuine native unified bundle gap: effect-granted Activities existed in the catalog but their Headless actions were not compiled during installation.
- Unified installer now registers compilable authored-effect/completion/continuation controls, skips event listeners (trigger pipeline) and avoids duplicate action registration. Invalid/missing/authority-bound references fail installation rather than silently yielding a dead control.
- Seven synthetic archive cases pass: bonus-action dismissal with a real grant and action-economy checks; five incapacitating conditions; lethal damage. Initial no-grant dismissal is rejected, persistent state is JSON-restored before termination. Tests use generated effect-control feature IDs and Host effect entitlements. No source recipe is promoted; area controls, summon bond controls and full source behavior remain separate verification work.
- Related module regressions and consolidated typecheck started after the installer fix. No paid API calls or room changes.
- Final related batch:4files/26tests passed. Compiler61090 is the live consolidated check. Reviewr30/coverager25 unchanged; flight source diagnostic remains unreviewed until source-specific evidence is assembled.

### Unified area/bond controls and entry-point inference

- Previous goal turn classified as progress: effect follow-up registration fixed with installed-module lifecycle tests. Compiler61090 subsequently completed exit0.
- Unified installer now includes persistent-area grants and persistent summon bond/dismiss controls in its compilation set. Shared grant-ID collection excludes follow-ups from inferred feature/spell initial entry points; triggered and continuation-only Activities are also excluded from spell initial casting selection.
- Existing DM monster area-control test now runs through both direct registration and an actual exported/read/installed synthetic module. The archive case uses inferred initial action (no hand-authored legacy action), validates Host source/slot/DC capture, action cost, area removal, repeat-use rejection and ownership/package/grant rejection. This tests real preparation, Headless settlement and map handoff, not a browser client.
- Final related batch4files/36tests passed. The new bond control registration branch is not yet backed by a complete exported-summon lifecycle test, and spell entry-point filtering needs an explicit spell archive regression. Compiler82310 is running for this batch. API0; original source recipes, rooms and source-review counts unchanged.

### Spell archive entry-point regression

- Previous goal turn classified as progress: area/bond registration and shared entry-point inference fixed,36tests passed. Compiler82310 is still the previous batch check and does not certify this turn's new test additions.
- Added parameterized synthetic spell archive cases for authored-effect, persistent-area and summon-bond grants. Actual export/read/install verifies the original cast remains the spell Headless entry point, all expected native control actions and generated feature adapters exist, and uninstall removes the actions.
- Unified content suite18passed. Bond follow-up operations in this fixture are deliberately synthetic; this is registration/entry-point evidence only, not a claim that an actual summon/command/dismiss lifecycle has passed. Effect/area execution evidence remains in the separate archive tests. No API requests or source/room modifications; full-book completion remains unproven.

### Persistent summon bond after module/map round-trip

- Previous goal turn classified as progress: three spell archive registration cases added; compiler82310 completed exit0 for its earlier batch.
- New installed-module lifecycle fixture exposed missing source.pluginId on summon-bond effects. Effect-granted control authorization correctly rejected the restored contract as belonging to no matching package. Both compiler settlement and direct Activity commits now preserve the authoritative package on the bond source.
- Synthetic module now creates an SRD wolf through the installed action, commits map handoffs, JSON-migrates/reloads the map, and dismisses via the real effect-control action. Both retained-bond and released-bond branches pass; released grants reject reuse, forged effect IDs and different package ownership reject. Public Activity authority also creates a package-attributed bond. The input map remains unchanged. Dismissal persists as the existing dismissed-token state; no claim of physical token deletion.
- Related summon/item batch26passed; expanded archive2cases passed after adding direct-authority and wrong-package assertions (session40931 printed all tests passed; terminal handle can be polled). Compiler37864 running after runtime corrections, before final test expansion. No API, original draft or user room changes. Command execution/re-summon behavior is not claimed by this dismiss fixture; full source and browser acceptance remain separate.

### Recall map replacement respects module ownership

- Previous goal turn classified as progress: persistent bond source attribution fixed and both installed/direct authority paths tested. Compiler37864 completed exit0 for that earlier batch.
- Recall inspection found persistent-summon replacement matched only the owner and feature/bond name, allowing another module's same-named summon to be removed. Map replacement now also requires the owning pluginId.
- Expanded installed-module bond fixture to recall after both retained/released dismissal branches, replace the old owned summon, preserve a foreign-module same-key summon, and ensure the recalled token is no longer dismissed. This is map replacement isolation only: bond-effect IDs and summon-dismissed event matching still use bare bondKey and need a separate end-to-end cross-module isolation fix. Do not classify the entire multi-module lifecycle as complete.
- API0; source-review counts and user rooms unchanged. Related recall/map regression process97748 started after the change; compiler37864 does not certify new test additions or the map comparison.

### Cross-package bond state and dismissal isolation

- Previous goal turn classified as progress: map recall replacement scoped to package and63tests passed. All earlier observed compiler processes were terminal before this batch.
- Bond lookup, replacement, recall-form validation and release now match package ownership. Stable effect IDs and stacking keys include the package, while the existing semantic definitionId remains recognizable. Source-less legacy bonds belong to SRD scope; custom modules cannot silently claim them. Updated the old hand-authored custom test fixture to include its actual package.
- Dismissal events carry packageId, and map application checks it. Direct Activity commits share the same summon/dismiss settlement as the compiler, removing the duplicate implementation. Package-less legacy events target SRD summons only.
- Installed-module tests create two actual same-key bonds for one actor using two registered packages, round-trip state, and verify dismissing/releasing one preserves the foreign bond and map token. Recall isolation remains covered. Final batch3files/43tests passed. Compiler started after these changes; full source conversion and browser certification remain unproven. No API calls or user-room/source-draft edits.

### Source review of sustained flight lifecycle

- Previous goal turn classified as progress: cross-package bond state and dismissal isolation implemented with43tests passing. Compiler96783 remains live on repeated polls, with no output yet; do not restart it solely for observation timeouts.
- Re-read extracted source51:0 and39:0. Recorded only Otherworldly Wings' exact lifecycle diagnostic as expressible after matching its bonus-action activation/dismissal and incapacity/death clauses to installed synthetic archive evidence. Source recipe conversion, class-level entitlement, visual choice, falling and actual browser behavior are not inferred complete.
- Reviewr31/coverager26:53reviewed diagnostics,892unreviewed links,10partial,41expressible,2source corrections;122entries still await mechanism review. Protective Spirit's combat-only trigger scope remains unresolved rather than assumed from turn-end behavior. Paid gate remains closed; API0 and original drafts/rooms unchanged.

### Combat-only trigger audit and compiler repair

- Previous goal turn classified as progress: exact source lifecycle review and coverage snapshot advanced. Compiler96783 completed with two errors: a nonexistent imported effect type and mutating a readonly pluginFeatureIds array in the new archive fixture. Replaced the type with the combatant's actual active-effect element type and used an immutable array replacement; compiler53416 now running.
- Existing turn-owner predicate rejects inactive Host combat state in both direct authority and compiled plugin paths even if the caller supplies a forged turn owner. Added those assertions;4turn-owner tests passed.
- This does not yet close the Protective Spirit combat-only diagnostic. Own-turn predicates are not automatically equivalent to combat scope at post-turn event settlement, where initiative may already have advanced. Keep that source unresolved pending trigger-pipeline evidence or an explicit Host combat-scope predicate. Reviewr31/coverager26 unchanged. API0; source drafts and rooms unchanged.

### Explicit combat scope and committed turn-end dispatch

- Previous goal turn classified as progress: inactive-combat regression and compiler corrections. Compiler53416 completed exit0 for that earlier batch.
- Added closed combat-active predicate with Host-only input through command authority, compiler and preflight paths; validation, capability analysis, log explanation and SDK conversion guidance are aligned. Missing state fails rather than assuming active combat.
- Trigger-pipeline test exposed missing turn-ended dispatch. Unified event conversion now emits turn-end using the original actor while current initiative may have advanced. Test executes the actual Headless end-turn action and settles its returned event batch, checks the original actor receives the benefit only in active combat, leaves the other actor untouched and rejects missing/false combat context.
- Related turn-scope/termination tests17passed (process66101 printed pass; poll terminal if needed). Fresh compiler started after the implementation. This proves the generic combat-scope/turn-end path, not Protective Spirit's full class entitlement, HP threshold/healing or source recipe. API0, rooms/source drafts/reviewr31 unchanged.

### Turn-end healing boundary composition and pre-roll eligibility

- Previous goal turn classified as progress: explicit Host combat scope and committed turn-end dispatch. Compiler49500 completed exit0 for that implementation batch.
- Added synthetic healing composition: active combat, paladin15+ independent of total level20, HP strictly below half, no incapacitation,1d6 plus floored half class level. The test runs actual end-turn and trigger settlement, checks half-HP exclusion, low class level, inactive combat, incapacitated/stunned, missing ownership and JSON-restored replay.
- Tests exposed unnecessary healing dice before failed root requirements. Trigger settlement now preflights only actor-local gates that do not depend on target/choice/dice selection before prompts/rolls; all requirements are still checked by final authority. HP formulas containing dice remain deferred. A first draft passed a scalar to the formula collector; corrected to its array API.
- Related healing/turn/termination/temporary-HP regression process51600; typecheck restarted only after previous compiler was terminal and runtime changed. No source recipe promoted, API0, user rooms unchanged. Exact Protective Spirit source diagnostic remains pending review update after combined evidence.
- Final composition batch3files/36tests passed. Incapacity preflight now uses Host-derived incapacity, so stunned also suppresses the roll; corrected the initial helper import to passiveDefenses. Eligible healing uses paladin15 rather than total20 (3+floor(15/2)=10), exact-half HP does not trigger, and replay does not reroll. Compiler26461 remains live; its starting snapshot preceded the final incapacity/import corrections, so do not claim those changes typechecked yet.

### Installed turn-healing recipe and selection-dependent preflight

- Previous goal turn classified as progress: healing composition tests and pre-roll gates implemented. Compiler26461 completed exit0; final follow-up changes are checked separately.
- Healing scenarios now export/read/install an actual synthetic unified module before executing end-turn and trigger settlement, with disposal in finally.13archive/turn tests passed before adding target-threshold case.
- Limited early HP formula checks to known actor-local references and recursively safe arithmetic; target, cast-level, resource and dice dependencies wait for final authority instead of being rejected with missing selection context. Added a target-max-HP threshold scenario to prove that deferral.
- Related final batch29975 and fresh consolidated compiler started after changes. No original source configuration promoted, API0, user rooms unchanged. This remains synthetic mechanism evidence; full-book certification and source conversion are pending.
- Final related batch3files/37tests passed. Compiler42323 running. Reviewr32/coverager27 closes only the exact combat-scope diagnostic as expressible:54reviewed diagnostics,891unreviewed links,42expressible,10partial,2source corrections. Original source behavior stays unverified and the paid gate remains closed.

### Other-creature turn-end dispatch (offline)

Previous continuation made concrete progress by fixing the incapacitated-condition literal type. Its typecheck process 41129 finished successfully. Added `other-turn-end` to the shared event contract/lifecycle catalog and Host event adapter, without broadening the existing own-turn event. The ended creature remains the target after initiative advances. Observer-specific event receipts avoid cross-holder suppression.

Local synthetic regression: `dnd5eTurnOwnerContract.test.ts`, 18/18 passed. Four added scenarios cover two independent entitled observers, 5-foot enemy eligibility, out-of-range rejection, same-controller rejection, missing entitlement, reaction consumption, self exclusion and JSON-restored replay. These are registered-activity tests, not original-PDF conversion or browser acceptance. Distance/relation rejection currently occurs at authority settlement; discovery can still offer an ultimately invalid choice. Scout reaction movement, path selection and opportunity-attack suppression remain unverified; its complete source diagnostic has not been promoted. SDK guidance updated. API calls and paid tokens this continuation: 0. Original source drafts and rooms remain unchanged.

Additional related regression: `dnd5eActivityInvocation.test.ts` and `pluginMechanicsRegistry.test.ts`, 10/10 passed (28 tests total across this continuation's three files). Final post-event-change typecheck is still running under session 78869; do not infer its result from the earlier successful compiler run or restart it without checking that handle.

### Observer reaction movement: installed archive and voluntary path semantics

Re-read the private inventory Scout source (47:1): Skirmisher is an optional reaction when an enemy ends its turn within 5 feet, at most half speed, without opportunity attacks. Existing forced movement was insufficient evidence: its map path did not use ordinary path cost and its emitted provenance was forced. Added explicit `move.mode: voluntary` across contract, validator, executor proposal, map path validation and emitted movement events. Voluntary movement uses legal-path cost and defaults to provoking opportunity attacks unless explicitly waived. Reaction cost remains a separate declaration; the ordinary movement pool is not implicitly charged.

Added `dnd5eOtherTurnMovementArchive.test.ts`, a clearly synthetic module exported to .starmod, read back and installed through the real package adapter. Seven cases cover successful half-speed movement, changed speed, excess distance, difficult terrain, decline, failed map commit and unavailable reaction. Successful cases assert voluntary movement provenance, no opportunity path, map/combat alignment and JSON-restored replay after renewing the reaction; failures preserve position and reaction. Related local batch: 3 files / 80 tests passed, including existing map interaction and temporary-HP reaction tests. This does not certify original generated Scout configuration, class-level entitlement, player-side route UI or all movement modes.

Compiler 78869 completed with a missing amount/consumeOn declaration in the preceding synthetic observer test; corrected both required fields. Final compiler session 74770 is running after these changes. Do not infer completion from the older compiler or restart while this handle is live. No paid API calls, no source draft modifications, no changes to existing rooms. Full-book goal remains incomplete and the paid conversion gate remains closed.

### Consumption import validation and observer review record

Review r33 / coverage r28 adds the exact Scout event/distance/opportunity diagnostic as expressible by the runtime, while leaving source behavior uncertified and configuration regeneration required. Coverage: 55 reviewed diagnostics, 890 unreviewed source links, 10 partial, 43 expressible, 2 source-correction links. 122 entries still need mechanism review; 1 awaits eventual batch regeneration. Paid gate remains closed.

Added four map-path assertions: voluntary movement defaults to provoking, explicit waiver suppresses, waiver wins over a conflicting provokes flag, existing forced movement default stays unchanged. Map interaction suite: 65/65 passed.

Compiler74770 failed on the map handoff log's separate movement-mode type; included voluntary there. Also tightened imported Activity consumption validation after an earlier malformed synthetic reaction declaration passed runtime validation: closed kinds, correct action economy, amount=1 for action/slot, selected slot with minimum1..9, allowed commit timing, required formula/resource IDs, and safe item allowlist shape. Added15 malformed-consumption cases. Related batch initially had three overly-specific expected error-path failures (shape errors correctly occur before element errors); corrected expectations. Final evidence: validation39/39, plus155 previously passing related executor/core-spell/installed-movement tests =194 passing. No changed production code after those tests except none; final typecheck99965 is running, not yet certified. Source drafts were not rewritten; stricter import validation may surface additional invalid generated costs and must be reflected in the next offline preflight. API0; rooms unchanged.

### Current full-book offline preflight r9

Compiler99965 completed successfully after consumption validation and movement log type fixes. Re-read the offline runner to confirm it only uses exact-source unedited saved drafts and local preflight; ran it once with exclusive report r9.155entries:32ready-for-behavior-tests,122blocked with parsed content,1no-parseable-current-source-draft. Total123notready unchanged. Only changed entry was Watery Sphere: three incomplete condition repeat-save declarations now reject instead of silently losing their condition. This comes from the earlier nested-area-condition validation, not newly added consumption gates. Its old generated drafts contain target-turn-end-save without saveAbility/saveDc; these drafts remain untouched.

Generated backlogr9:840distinct diagnostics/946links, one additional diagnostic and none removed. Migrated reviewr34 only after validating every existing exact diagnostic/source link; coverager29:55reviewed,891unreviewedlinks,10partial,43expressible,2sourcecorrections. No automatic-source success was promoted. Added three regression cases for missing repeat-save ability/DC; persistentAreaSourceDc6/6passed. Updated converter guidance with mandatory consumption fields and repeat-save pairs to prevent another paid trial from discovering these structural mistakes. This is local guidance and validation, not a successful re-conversion. API0, no room writes, full-book goal incomplete.

### Dynamic target controls through installed feature modules

Inspected existing ability-modifier scaling, feature-control projection, map preparation and compiled Host path rather than adding a duplicate target-count interface. Added synthetic `dnd5eFeatureTargetScalingArchive.test.ts`: real export/read/install, the same control projection used by the feature panel, then compiled plugin execution. Scenarios cover Charisma6/16/20 =>1/3/5targets, bard3/10/15 with totallevel20 =>5/15/20temporaryHP, forged payload limits ignored, extra target rejection, unchanged unselected creatures and atomic bonus-action cost.

The integration exposed a genuine edge: once scaled targeting is single-creature, the compiled Host route silently ignored extra targetIds and spent the action on the first target. It now rejects extra IDs differing from targetId before consumption. This also covers a stale multi-selection after the allowed count shrinks. Existing legacy single-target shape remains accepted. Related three-suite batch35/35passed (feature target archive, feature action, adapter). Initial fixture failures from omitted authoritative single-target distance/targetId were corrected separately before identifying the extra-ID issue; they were not treated as product failures.

This is local installed-module evidence, not rendered panel/browser acceptance or original generated Mantle configuration certification. Recipient reaction lifecycle integration still needs the combined source recipe; no full-source diagnostic promoted. Typecheck79907 running; previous99965 already passed. API0; original drafts and rooms unchanged.

### Combined scaled benefit and recipient reaction archive

Compiler79907 completed successfully. Extended the installed synthetic target-scaling module to grant recipient-owned single-use voluntary reaction movement, then settled actual compiled temporary-HP events through the map handoff/synchronization path. Multiple recipients choose independently; actor2 declines, actor3 has a simulated map conflict, later recipients still move. Failed/declined recipients retain reaction and temporaryHP; successful recipients lose the single-use grant, move in both map/combat state and suppress opportunity paths. An unrelated temporaryHP source cannot reuse the remaining grants.

Re-read source15:0 and changed the synthetic scaling increments to its actual5/8/11/14 tier values, adding bard5 coverage; earlier5/15/20 values were generic test data, not source values. Final combined archive4/4passed; preceding related temporaryHP integration12/12passed. Reviewr35/coverager30 adds evidence but keeps this mixed diagnostic partial: original subclass, mutual visibility, Bardic Inspiration spending, immediate-only expiration for declined grants and real player UI still need proof. Counts unchanged. Final compiler55343running after the test expansion. API0; no source drafts or live-room state touched.

### Host-owned reverse visibility

Compiler55343completed0. Added creature-target requiresTargetSeeActor:boolean, validation, registered Activity authority and compiled plugin authority checks using dnd5eCombatantCanSee(target,actor). This is independently directional from requiresLineOfSight. Existing effective-target projection handles choices/scaling before both gates. Failed visibility returns before resource/effect commit.

Expanded installed companion archive tests to18cases covering direct/choice/cast-level target projections, forward/reverse sight and line of effect, two export/install cycles and both authority routes. Added malformed reverse-flag validation. The combined scaled benefit recipe now requests mutual visibility. Related18+44=62tests passed. SDK contract and conversion guidance updated; no original source config changed. Current compiler86284running, do not restart without checking. Source review remains partial: immediate-only declined reaction authorization and resource-use fidelity still need work; no claim of full feature or browser acceptance. API0; rooms unchanged.

### Existing Bardic Inspiration ledger consumption

Compiler86284completed0. The installed combined benefit recipe exposed a real integration gap: executor could read native Bardic Inspiration, but compiled plugin spendResource rejected it because it was not a plugin-owned definition. Added explicitly scoped native dnd5e-bardic-inspiration spending with bard class-level>=1 and the existing atomic ledger. This does not grant arbitrary native-resource mutation or restoration; plugin-owned resource checks remain intact. Applied the same bard qualification to direct Activity consumption/spend proposals.

Synthetic installed recipe now spends one real inspiration plus one bonus action, and tests exhausted resource, extra targets, copied ledger without bard levels, direct and compiled routes, independent recipient outcomes and unchanged source state. Initial native spend failed before the runtime fix. Related feature action plus combined recipe35passed before the final direct-route qualification test extension. Source-level>=3 and immediate-only reaction lifetime still require recipe/lifecycle work; do not treat this as complete subclass certification. No original drafts modified. API0, no live room changes. Compiler39467 was launched before the final direct-route edits; its result must not be described as covering all subsequent edits.

Final combined archive4/4passed after direct-route assertions were added. Compiler39467 remains confirmed live and must be polled before any replacement check.

### Persist explicit declined-window receipts

Compiler39467completed0 (started before the last direct-resource edits; new compiler14316covers current batch and is running). Trigger settlement previously recorded receipts only for successful executions; a declined saved event could be offered again after reload. It now stores an immutable per-actor event receipt and advances revision on explicit decline, without charging resources, mutating the caller snapshot or removing the underlying grant. Failed map transactions remain retryable; they are not misclassified as voluntary decline.

Extended owned/effect-granted temporaryHP reaction tests to restore state and replay a decline with callbacks that fail if asked again; reaction/temporaryHP stay intact and source state remains unchanged. Related trigger/combined/archive batch23passed. Added a production settlement/application test proving a receipt-only change survives into the persisted token with no new combat events; page settlement suite19passed. Total42related tests passed. This fixes same-event replay, not future-event authorization expiry, and does not close the full source feature diagnostic. API0; source drafts and rooms unchanged.

### Optional single-use grant release on explicit decline

Compiler14316completed0. Inspection confirms effect provenance currently identifies ability/source but not a unique execution; do not misrepresent it as a full event-bound grant. Added explicit triggered invocation.releaseSingleUseGrantOnDecline:true for requiresEffectGrant Activities with a nonautomatic decision. On decline, clone candidate state and consume the matching preexisting single-use grant through existing effect cleanup; do not spend reaction or undo temporaryHP. Defaults preserve prior behavior; nonsingle-use grants are retained. Reject false/automatic/no-required-grant contract combinations.

Combined installed archive now opts in and verifies declining actor2 loses only the movement grant, failed map actor3 retains it, later actors still resolve, and unrelated temporaryHP cannot trigger remaining grants. Combined+legacy reaction16passed; validator43passed,59total. This does not bind unoffered/failed-map grants to their source execution or handle every simultaneous-grant ambiguity. Full-source status remains partial. No paid API, original draft or live room changes. New compiler launched after this batch should be tracked separately.

### Execution provenance foundation for event-bound grants

Compiler36282completed0. Confirmed that source.rulesId alone cannot distinguish repeated uses of the same ability. Added Host-stamped source.executionId for Activity grants newly applied/refreshed by the current committed event list, and matching provenance on temporary-hit-points-gained events. Root Headless execution uses its transaction ID; registered Activity bridge uses combatId/currentRevision/validated commandId. TemporaryHP trigger context retains this origin ID instead of replacing it with the dispatch batch ID. Untouched older grants are not stamped. This is provenance only, not yet an authorization or expiration rule.

Installed combined archive assertions verify event/grant matching for both direct and compiled routes, distinct IDs on separate compiled executions, and JSON persistence. Related combined/legacy16passed; final direct-route assertion rerun tracked19875. New compiler49893running. Required next work: grant eligibility must compare provenance and close an origin-bound window without deleting an unrelated/newer grant; current tests do not prove that authorization yet. No source success promotion, API calls or live-room writes.

### Batch workflow continuation and compiler correction

Compiler49893 completed with two TS2345 errors: callers expose readonly event arrays while the provenance helper accepted a mutable array. Updated the helper parameter to readonly Dnd5eCombatEvent[]; it does not add, remove or reorder events. This preserves the existing event-object stamping behavior. Compiler69886 is the current follow-up check; its completion must be confirmed before reporting a typecheck pass. No authorization or full-source certification is added by this signature correction.

The user's batch-first requirement remains in force. The existing workflow document and review audit retain the closed paid-conversion gate. No conversion API was called in this continuation; original source drafts and rooms5273/5274 were not changed.

### Execution-bound reaction authorization

Compiler69886 completed0. Added triggered invocation.effectGrantScope:'trigger-execution', requiring requiresEffectGrant. The Host compares the grant's source.executionId with the actual trigger context's source.executionId in both discovery and registered Activity authority. Missing provenance fails closed. Compiled/raw plugin routes lack this Host event context and reject bound reactions even with an effect entitlement. Existing ordinary grants keep their behavior.

Successful single-use consumption and optional explicit-decline release select the matching execution's effect ID; simultaneous grants from another execution remain untouched. Installed synthetic archive tests now cover old events against a later cast, provenance missing after persistence, raw plugin bypass, exact grant consumption on success/decline, and the original per-recipient map rollback cases. Validator46passed; final combined archive/legacy reaction/entitlement/SDK guide batch32passed (78 distinct tests across these suites). SDK contract and conversion guidance updated. Compiler23982 is running for this batch; do not claim it passed until terminal evidence.

This is authorization binding, not automatic closure of unoffered windows or failed-map retries. Original source configurations, source level qualification, and player browser acceptance remain unverified. No source diagnostic promoted, no original draft repaired, no paid API calls, no live-room changes.

### Explicit immediate-window grant expiration

Compiler23982 completed0. Added invocation.expireGrantAtWindowEnd:true, restricted to execution-bound, single-event temporary-hit-points-gained Activities. When a full trigger batch finishes, expire only remaining single-use grants for that event's recipient and execution. Cleanup uses normal effect removal, preserves resources and temporaryHP, and sends removal events through nested trigger settlement. Unavailable reactions and unsuccessful placement close an opted-in offer; omitted flags preserve retryable legacy behavior. Resolution-budget interruption does not close unfinished windows. Nonsingle-use grants and effects also granting ordinary ongoing actions are preserved; authors must use a dedicated effect.

Installed combined archive covers no reaction, later-round JSON replay, input immutability, zero-resolution budget, shared/ongoing preservation, independent map failure and exact-execution selection. Initial local failures exposed an actorId/targetId mismatch in the new cleanup, corrected before passing; a test expectation also needed to accept the engine's absent empty effect list. Expanded archive exceeded the default5second per-test limit during concurrent typecheck, so the integration test now has an explicit20second budget; final4/4passed. Legacy reaction12/12 and validator51/51passed; SDK guide15/15passed. Compiler20681 is running for this batch; its result must be confirmed separately.

Reviewr36/coverager31 updates the existing partial Mantle diagnostic evidence without promoting original source conversion. Counts remain55reviewed/891unreviewedlinks,10partial,43expressible,2sourcecorrection;122entries still need mechanism review and1awaits batch regeneration. Remaining limitations include grants with no temporaryHP event, original subclass configuration and qualifications/target relations, and actual player UI acceptance. Source drafts untouched, API0, live rooms unchanged.

### Batch diagnostic routing instead of per-spell implementation loops

Compiler20681completed0. Inspected the actual preflight diagnostic emitters and separated status/connectivity evidence from named rule mechanisms. Added scripts/plan-fullbook-mechanism-batches.mjs and scoped tests; combined planner/review-audit6passed. The planner validates existing reviews, preserves all source links and blockers, hashes inputs, uses exclusive output files, and never calls API or marks certification. Unknown diagnostic text stays in mechanism/source review; DM-operation markers are not automatically declared narrative.

Re-ran reachability, published grant lifecycle and installed single-use archive suites17passed. Reviewr37 records12orphan-follow-up diagnostics as expressible by existing connectivity contracts, strictly for that diagnostic shape: original Activities and spell effects remain unverified and need source-aware batch regeneration. In particular, a cast Activity misidentified as a follow-up must be classified correctly instead of being blindly granted. Coverager32:67reviewed,879unreviewedlinks,10partial,55expressible,2sourcecorrection;122entries still need mechanism review and1awaits batch regeneration. No source success promotion.

Batchplanr3 partitions all840distinctdiagnostics:594mechanism/source diagnostics,29cast-entry,12follow-up-link,2execution-binding,202status-marker,1manual-boundary. Remaining links by group are552/28/0/22/221/68 respectively (891total unresolved links, including partial/source-correction). This replaces misleading flat-issue prioritization without deleting any failure. Explicit manual boundaries still require source/body inspection. Next work should use mechanism batches and the configuration review queues, not redo paid conversions per item. API0; original drafts and live rooms unchanged.

### Movement-to-attack composition and duration import validation

Re-read source31:0 and tested the public movement-completed → grant → attack-hit → STRsave → prone chain against actual Headless movement/attack events. Synthetic recipe validates fighter15, single committed voluntary straight movement>=10feet, target-owned saves with DC8+PB+STR, miss/short/curved/low-level rejection, JSON replay, explicit turn-end cleanup, and no rearming after a resolved save in the same turn. Seven scenarios passed. This is not an installed/regenerated original subclass; split collinear moves and mounted attribution remain gaps. Source reviewr38 therefore stays partial; coverager33 has68reviewed/878unreviewedlinks,11partial,55expressible,2sourcecorrection, with122entries awaiting mechanism work.

The test exposed two authoring hazards: apply-standard-condition requires duration, and rounds1 is not a current-turn-end expiry. The recipe now uses explicit turn-end removal and guidance documents that distinction. Malformed missing/null/nonobject duration previously threw inside validateDuration; it now returns a validation error instead of crashing import. Validator56/56 and movement-chain7/7passed together (63total). Compiler32265running; final guide-only text was added after its launch. No source drafts repaired, paid API0, live rooms untouched.

### Host straight-movement streaks across commits

Compiler32265completed0. Added straightMovementStreak Host ledger and committed moved.straightDistanceFeet metadata. Root Headless successful transactions record contiguous same-turn horizontal voluntary straight segments; native forced/teleport/unknown movement clears the streak. Map Activity handoff synchronization also updates/reset the ledger from accepted movement events, but does not invent straightness from endpoints. Corners, reversal, discontinuous start, changed turn and vertical batches never inherit earlier distance. Unknown/malformed prior data cannot crash streak matching. Player class state and independent token persistence now retain the ledger.

New movement-distance basis:'straight-streak' consumes only this Host event metadata; omitted/event basis remains per-event. Added validation, SDK guidance and tests. Final chain8passed including two5foot moves separated by JSON restore; tracker11, invocation7, map persistence2, validator57 and SDK guide15passed (100distinct focused cases). Compiler7067completed0; it started before final test/assertion and guide-only edits, so do not imply it covered later source snapshots. No process remains pending from this batch.

Reviewr39/coverager34 retains the source31:0 diagnostic as partial, now excluding horizontal split-move accumulation from remaining gaps. Mounted attribution, vertical/3D geometry, original subclass installation and browser interaction are still unverified. Counts unchanged68reviewed/878unreviewedlinks,11partial,55expressible,2sourcecorrection. No source draft changes, API0, live rooms unchanged.

### Mounted movement provenance

Native movement previously emitted unclassified coupled movement for both riding and dragging. It now labels valid riding-slot attachments as movementKind:mounted, with sourceActorId identifying the moving mount and Host straightLine provenance. Other coupled movement is forced. The straight-streak ledger accepts mounted movement; voluntary predicates explicitly exclude it. SDK contracts, validation and authoring guidance distinguish the categories. No assumption was added about ability entitlement across separate rider/mount turns.

Real native movement tests cover valid riding and basic grapple dragging over two5foot commits with JSON restoration, rider position and unchanged movement budget, and correct mounted-only trigger discovery. Initial fixtures needed the authoritative pair distance and a real grapple condition instead of an invalid mechanical grapple; corrected tests2/2passed. Tracker/invocation/guide plus mounted tests35passed, and existing mounted feat regressions2passed. Compiler43917completed0, launched before final fixture/guide-only edits. No pending process remains.

Reviewr40/coverager35 keeps source31:0 partial: native mounted provenance is now evidenced, but cross-turn ability timing, vertical paths, original subclass package and browser acceptance remain unverified. Counts unchanged. API0; original drafts and live rooms untouched.

### Spatial straight-path validation and batch checkpoint

Player movement now checks every sampled path point and elevation for monotonic 3D collinearity. Hills, backtracking and missing height evidence cannot be declared straight merely from planar endpoints. Committed native movement carries endpoint elevations; the straight-streak ledger supports contiguous vertical and sloped movement, including JSON persistence, and resets on direction changes or unknown height transitions. Map Activity paths without straightness evidence remain ineligible.

Path/player-movement/tracker batch66passed; the expanded tracker/path/mounted batch reported23passed before its session disappeared. Compiler52601 was explicitly polled to completion with exit0; final guide-only edits followed its launch. These are local mechanism tests, not source-package acceptance.

Offline preflightr10 remains32ready,122blocked,1without a parseable current-source draft. Backlogr10 preserves the same840diagnostic IDs asr9. Reviewr41/coverager36 and batchplanr4 reference that snapshot; source31:0 remains partial because mounted cross-turn timing, original subclass installation and player browser acceptance are not established. Coverage remains68reviewed diagnostics,878unreviewed links,11partial,55expressible and2source corrections. Paid conversion gate remains closed; API0, original drafts and live rooms untouched. Continue shared-mechanism batches before a consolidated conversion run.

### Structured cast-entry diagnosis across the cached book

Added spellEntryAudit to actual PDF preflight results and reused its selection logic in reachability. It distinguishes computed automation incompleteness, effect-grant authorization, native authority and reaction event/definition/slot contracts. Existing textual blocker messages and selection preference are preserved. No configuration is rewritten or certified. Initial fixture incorrectly assumed the declared partial label controlled computed capability; corrected it to contain a real manual operation. Reachability and PDF preflight29/29passed, including reaction integration and immutable source checks.

Consolidated offline r11 includes the new structured audit for each matched automatic candidate and completed with exit0. Counts remain32ready/122blocked/1unparseable. Selecting the latest timestamped audited candidate per source finds29without a valid entry;28include automation-not-full,3include reaction entry and slot errors,1includes reaction-definition mismatch (overlapping categories). This changes prioritization: most missing-entry diagnostics are consequences of incomplete Activity bodies, not missing player buttons. Original reports/reviews remain intact; no whole-book certification, no full typecheck for this small diagnostic batch, API0 and live rooms unchanged.

### Typed temporary resistance suppression

Inspected current automatic Activity blockers for several spells. Elemental Bane's missing resistance-removal mechanism is now expressible via Effect modifier suppress-damage-resistance with one concrete damageType. Added public contract, validation, handler registration, executor projection, Active Effect persistence/strict validation and native damage resolution. Suppression affects the matching resistance calculation (including qualified defense rules and dynamic effects) without deleting sources, touching immunity/vulnerability, or suppressing other types. Existing effect suspension and concentration cleanup restore normal defenses. SDK and conversion guidance explain the distinction from vulnerability and separate extra-damage triggers.

New local suite11passed: base/effect/conditional/qualified resistance, immunity, vulnerability, other-type, removed/suspended effects, real concentration termination, JSON persistence, source immutability, public projection and invalid-type rejection. Existing conditional-resistance native regression1passed; SDK guide15passed. Compiler12619completed0; final additional test cases followed its launch. Initial public fixture lacked its required automation field and was corrected. This proves the primitive, not the whole original spell or its once-per-turn damage chain. No original configuration modified, no review promoted, API0; live rooms untouched.

### Recipient damage rider and actual current-turn identity

Added an integrated synthetic recipient-granted after-damage rider with typed resistance suppression,2d6 extra damage and once-per-turn use. Native attack starts the chain; additional recipient/checkpoint and later-turn inputs are explicitly synthetic. Tests cover no recursive extra damage, source-batch replay after JSON persistence, independent recipients, wrong damage type, missing grant and suspended effect. Initial fixture lacked required legacySource authorization and replayed a shortened batch with a changed event index; corrected both without weakening runtime authorization or receipt identity.

The new cross-turn test exposed classFeatureTurnKey falling back to the effect holder when no explicit initiative slot existed. It now falls back to the current initiative actor before the owner; declarative compiler uses the same ordering, and movement-trigger dash comparison uses the shared helper. Two reaction-spell tests now correctly expect the active attack/cast turn rather than the reactor's identity. Existing declined-rider test was stale relative to explicit-decline receipt persistence and now asserts the receipt while retaining resource checks.

Combined recipient rider4,source rider5,Headless engine303,declarative subclass35:347passed. Typecheck54346completed0; guide-only clarification was added after launch. No claim of original Elemental Bane acceptance: recipient-owned damage attribution, source configuration/archive and player interaction remain independently unverified. Compiler damage settlement currently calls context.dealDamage with the acting recipient, so caster attribution requires explicit further work rather than assuming the granting effect changes it. API0, no original draft or live-room changes.

### Damage attribution from authoritative effect grants

Added damage.damageSource:'grant-source' with requiresEffectGrant validation, proposal propagation and native/direct Host settlement. The shared lookup requires an effective same-package grant allowing the target and a source actor present in state. Equivalent source fragments are deduplicated by actor/kind/rulesId/spellLevel/magical metadata; conflicting or missing sources reject instead of choosing an arbitrary caster. Source actor, stored rules ID and spell level feed damage checkpoints and committed events. Default attribution remains unchanged. The option does not rewrite formula actor, resources, dice scaling or invent missing casting-class metadata; SDK guidance explicitly preserves these limits.

Initial integration exposed that trigger settlement uses the direct Activity commit route rather than the compiled plugin route; both are now covered. Public triggered tests include matching source, wrong type, absent/suspended grant, missing source and conflicting casters. Compiled native tests cover correct source and missing-source rejection. Validation covers unknown attribution and absent effect-grant requirement. Recipient8/validator60/executor65:133passed; native engine303 and SDK guide15:318passed. Typecheck87464completed0. This remains synthetic mechanism evidence, not original source package/browser certification. API0, original drafts and live rooms untouched.

### Installed damage-rider archive lifecycle

Added a synthetic feature module with an actual casting Activity applying the suppress-resistance effect and granting the after-damage rider. The archive is exported/read/installed, executed, uninstalled, re-exported and independently reinstalled twice, for both public direct and compiled native cast routes. Definition equality checks verify wire preservation without rewriting source. Combat JSON reload, native attack, automatic rider attribution, real concentration termination, later-turn resistance restoration and absence of expired triggers are asserted. This is a synthetic feature mechanism package, not an automatically converted original spell.

The test exposed a real integration defect missed by earlier manually-created Active Effect fixtures: applyDnd5eMechanicalStatusEffect did not forward suppressDamageResistance from resolved modifier groups. Added the missing input type and constructor forwarding. An initial fixture also needed authoritative pair distance. Final archive2/2passed (four independent installations); the suppression primitive suite11passed in the earlier combined run. No full typecheck repeated for this two-field forwarding change; prior compiler87464 covered the preceding snapshot only. No original content changes or certification promotion, API0, live rooms untouched.

### Complete Host modifier-field forwarding

Compared all102Dnd5eActiveEffectModifiers fields with the Host mechanical-effect input and constructor object using TypeScript AST. Normalization and strict-validation functions reference all102fields. Host forwarding still lacked climbingCheckAdvantage and poisonSavingThrowAdvantage; both are legacy resolved modifier fields (not new public DSL operations). Added both and a satisfies Record<keyof Dnd5eActiveEffectModifiers,unknown> constraint on the complete constructor object. Future optional modifier additions now cause compilation failure unless this forwarding map is updated.

Trusted resolved-modifier tests now pass through actual Activity commit, JSON normalization and subsequent ability/save behavior: climbing-only Athletics advantage and poison-only saving throw advantage are preserved without broadening other checks. Initial one-actor fixture created an inactive combat; added a second combatant. Forwarding2 plus ability-check11passed, archive2passed in the earlier batch. Compiler16381completed0 covering the runtime map and preceding archive changes; final new fixture edits followed launch. No source certification, no API calls, no original drafts or live rooms changed.

### Batch review of creature visibility and size eligibility

Read verified local source excerpts for Charm Monster, Mind Spike and Gust; scoped review to their initial visible-creature and medium-or-smaller eligibility claims only. Expanded the existing installed command archive matrix with invisible recipients, see-invisible restoration and blinded actor checks across ordinary targets, choice overrides and cast-level profiles, through public/direct and compiled paths. All18matrix casespassed, each retaining the two-installation archive cycle. Added7size-boundary cases (Tiny through Gargantuan and absent Host size); target size-rank maximum2 accepts only known Medium-or-smaller and rejects missing size.

Reviewr42/coverager37 records these three exact source-scoped diagnostics as expressible. No blanket claims for area visibility, object/terrain targets, movement, saves, ongoing tracking or full spell behavior. Counts71reviewed/875unreviewedlinks,11partial,58expressible,2sourcecorrections;122entries still need mechanism work and1awaits batch regeneration. Source configurations remain unchanged and unverified. Tests-only batch: no repeated full typecheck or paid conversion; API0 and live rooms untouched.

### Host target requirements before trigger dice

Trigger dice preparation previously applied area exclusion filters but deferred root size/type requirements until after formula and saving-throw prompts. It now first rejects missing Host actor/targets and evaluates size-rank/creature-type root predicates from authoritative snapshots. A mixed invalid selection rejects as a whole, matching final executor requirements; this does not silently turn a root requirement into a per-target exclusion. Choice/roll-dependent predicates remain outside this early check and final authority still revalidates.

Added pre-roll cases for valid selection, oversized target, wrong creature type, mixed valid/invalid targets and missing actor/target. Invalid cases request zero shared or save dice; valid case preserves normal dice sequence. Corrected the new fixture's creature predicate field to types and added schema validation. Final size suite13passed; ability-targeting2 and damage-rider8passed in the preceding22case batch (23distinct cases after mixed-selection addition). No repeated full typecheck for this scoped change. No original source rewrite, no certification promotion, API0 and live rooms untouched.
### Exact stat-block saving-throw overrides

Added unified Activity saving-throw rollModeByStatBlock with exact Host statBlockIds and advantage/disadvantage. Validation, per-target dice recipes, trigger dice, executor and compiled declaration agree; names and broad elemental type do not substitute for identity. Existing generated SRD catalog confirms srd-5.1:water-elemental. The verified local source excerpt for source151:0 names water elementals and plants separately; no original draft was modified.

Synthetic tests cover matching and renamed creatures, another elemental, missing ID, same suffix under another namespace, cancellation against a creature-type advantage, and five malformed configurations. Each valid case checks dice count/mode, direct execution and registered compiled native HP settlement. Final related suite98/98passed. Initial fixtures used the wrong outcome discriminator/import and an unsupported fixed advantage in the compiled path; corrected the fixture to the supported creature-type advantage combination. Typecheck11303 found only two fixture controller-type errors; narrowed the known DM test inputs. Replacement typecheck66059completed0.

SDK and conversion guide now document exact identity and unresolved catalog dependencies. Reviewr43/coverager38 marks only the water-elemental identity diagnostic expressible; original spell behavior, noncreature plants, transformed identity and archive/browser verification are not certified. Coverage72reviewed/874unreviewedlinks,11partial,59expressible,2sourcecorrections. API0; source drafts and live rooms untouched.
### Installed sustained group-roll benefits

Read the verified local Zealous Presence source excerpt. Added a synthetic unified feature archive exercising hearing-gated group benefits through both registered direct Activity and compiled native action, each exported/reinstalled twice. Seven scenarios per route/installation cover ordinary recipients, exactly10targets, deaf recipient, silent source, distance65versus60, self-selection and11targets. Failed selections preserve the input state and do not spend the bonus action; successful selection spends it once.

After JSON reload, the test checks all six ability save modes, two actual attacks using advantage, an unaffected ability check, a real concentration save, and an isolated death-save branch. Effects survive both the source's current turn ending and recipient turns, and expire together only at the source's next turn start, including a full10recipient initiative cycle. Explicit death-saving-throw modifier is necessary because saving-throw without ability covers the six ability keys; the conversion guide now states this and distinguishes sustained effects from next-roll benefits.

New archive2passed (28scenario executions); shared-language43 and next-d20-advantage5passed in the combined50test run; after maximum-target and guide changes archive2+guide15passed. Initial test fixtures assumed empty effect arrays instead of optional fields and a state property on a preparation rejection; corrected fixtures without changing runtime behavior. No repeated full typecheck for this test/guide-only batch; prior66059covers the preceding runtime. Reviewr44/coverager39 marks only the existing hearing/group-benefit diagnostic expressible. Original subclass conversion, long-rest usage configuration and map acoustic obstructions remain unverified. No paid API calls or original draft/live room changes.
### Communication and target eligibility before trigger dice

Extended the existing Host-only trigger pre-roll gate beyond size/type to can-hear-source, shared-language, can-understand-source-language, can-speak, target-identity, owned-companion, condition and ability-score predicates. Target snapshots now receive the actual Host source so source-relative hearing is available. These root predicates reject the entire selection before formula or save dice; choice-, resource-formula-, map- and roll-dependent requirements remain at their existing authoritative boundaries, and final execution still rechecks all requirements.

Added nine parameterized communication/identity/state cases, each with valid and invalid Host facts; invalid cases request zero dice and all cases preserve input state. Communication9+size13+language43passed. Additional companion-control/opposed-roll/damage-rider/group-archive regression22passed. Consolidated typecheck96405completed0, including the preceding group archive fixture and current pre-roll changes. No original configurations changed, no paid API calls, no live-room changes or certification promotion.
### Optional expiry for prearmed next-d20 advantage

The existing declarative next-d20-advantage mechanism consumed its marker after a qualifying roll but had no unused-effect deadline. Added optional expiresAt:next-turn-start to the contract/strict validation. Compiler records expiresAfterTurnKey in the Host marker; character/map/engine types preserve it, and turn-start lifecycle clears it before start-of-turn saves after the idempotent turn-start guard. A marker armed in the current turn is not cleared by same-turn begin-turn reentry. Untimed legacy markers remain unchanged.

Native tests cover activation, Host turn-key persistence through JSON reload, same-turn reentry, survival through another creature's turn/check, expiration on the next owner turn with one state event, legacy no-expiry behavior and invalid expiry values. Initial timed fixture omitted the declarative compiler's required transactionId; corrected fixture and retained the authority requirement. Next-d20/native-engine/declarative-contract/guide360tests passed; typecheck25951completed0. No original source certification or paid conversion.

The Soul Cage cached diagnostic describes separate bonuses for each roll category. Local translated source uses an ambiguous conjunction; external search excerpts suggest a single next eligible roll instead (https://dnd5e.wikidot.com/spell%3Asoul-cage and https://www.thievesguild.cc/spells/spell?spellid=399). Attempt to open the English book mirror failed. No authoritative source correction or original-spell review promotion was made. Current change only supplies the independently useful expiry primitive; generic Activity exposure and multiple d20 resolutions within one transaction still require separate work/evidence. Live rooms and saved drafts untouched; API0.
### One-roll advantage at native attack boundaries

Reproduced a native composite-action defect with Flurry: both attacks selected18from[2,18] because pending advantage was consumed only after the entire root transaction. Added consumption to the central emitDnd5eAttackResolved boundary, before later attacks resolve; existing root rollback restores provisional marker/resource/HP changes if a subsequent step fails. Consumption also now ignores automatic ability-check events and saves marked condition-immunity-success or allied-unresisted-failure.

Updated monk, hunter and sequential-spell preparation so this one-roll source is only included for the first planned attack. Native test proves firsthit/secondmiss, one consume event and full rollback on an invalid second target. The valid fixture now supplies no damage dice for its expected miss, retaining strict Host dice validation. A real registered synthetic monk subclass exercises map preparation, first/second preview modes and final Headless results. Mixed sequences with an intervening save or a ward preventing an attack remain outside this evidence; generic Activity precomputed multi-check paths remain incomplete.

Next-d20/class-feature/hunter60tests passed, targeted new map-preview test1passed, spellAction207passed, and native engine303passed in the earlier combined run. An unrelated existing Open Hand assertion omitted the already-present straightDistanceFeet:0 field; updated that exact expected event. Compiler98914completed0 covers runtime and initial tests; the final added map-preview test was edited after compiler launch. API0; no original source rewrite, review promotion or live-room changes.
### Native mixed-roll consumption boundaries

Reproduced a ward-save-then-attack defect: pending advantage applied to both the preceding Wisdom save and later attack. Introduced emitDnd5eResolvedRoll and migrated52literal native saving-throw, ability-check, concentration, relentless-rage and death-save result emissions. The attack emitter delegates to the same boundary. Each real resolution immediately consumes its owner's qualifying marker; automatic outcomes remain excluded. Rogue check helper now receives its actual Host state. AST audit finds0remaining direct literal emissions of these five result types and53shared-boundary calls; this audit does not cover dynamic/external plugin events or claim all paths have behavioral tests.

Native ward tests cover success followed by a normal attack, failed save preventing the attack, and later malformed damage rolling back both consumption and all provisional events. Final next-d20 suite13passed; native engine303passed in the preceding315test batch; spell/class-feature/group-archive/companion-archive262passed. Typecheck54042completed0 covers runtime; final extra rollback test was edited after launch. No source certification promotion: unified Activity precomputed checks and UI prediction around preceding ward saves still need separate treatment. No API calls, cached draft changes or live-room changes.

### Sequential Activity saving throws

Added an internal Host-only sequential-mode hook to Activity execution and authority forwarding. Direct registered and compiled Headless entry points derive each host-derived saving throw from the actual prior resolved checks, projecting away a consumed next-d20 marker without mutating the live preparation state. Automatic outcomes do not consume; inactive or prerequisite-skipped checks never enter the resolved-check list. This callback is not part of serialized content or client commands.

Synthetic cases exercise two saves in one execution, first-save condition immunity, and an invalid later d20 through both entry points. Ordinary sequence selects18then2 from the same [2,18] dice and applies5damage; immune first save leaves advantage for the second. Commit consumes once; failures preserve the original marker/state. Next-d2015 plus stat-block11 tests passed; executor/command/authority/per-target/group-archive133 passed. Typecheck55832 found a readonly-array push in the new test fixture, corrected to an immutable list replacement; replacement compiler38794completed0. No new source review promotion or changed generated configuration.

Other sequential check kinds, continuation history and UI dice recipe/preview ordering are not certified by this save-specific batch. Concentration-check event classification also needs independent alignment with saving-throw consumption. The batch workflow and closed paid-conversion gate remain in force; conversion API calls0 and live rooms unchanged.

### Actor, concentration and opposed Activity checks

Expanded the Host sequential projection to actor ability/skill checks, concentration checks and both owners of opposed checks. Concentration now reads the actor saving-throw modifier rather than the ordinary ability-check modifier, uses the Host concentration mode (including concentration-only advantage and pending disadvantage), and emits concentration-resolved. Shared concentration checks are accepted and declared by the compiler; shared actor checks now emit their result instead of being missed by the compiler's per-target-only event lookup. A pending concentration disadvantage projects away after the first real concentration check and clears on successful commit, matching the native one-use lifetime.

Opposed result events consume each eligible owner's next-d20 marker. A new direct-path test exposed a missing immediate consumption boundary for these events; fixed that direct boundary. Synthetic two-check sequences exercise shared ordinary checks, shared concentration saves with a distinct +7 saving bonus, and opposed checks where both creatures begin with a pending benefit. Marker rollKinds are narrowed to ability-check or saving-throw to verify category ownership. Both direct and compiled paths select the advantaged first roll and ordinary second roll, preserve input state, apply the expected outcome damage and consume the marker. Additional concentration cases without advantage select2then18from[18,2], proving pending disadvantage expires before the second check.

Concentration Activity events include optional activityId/checkId. Map handoff log text and structured evidence match each concentration result separately, including both distinct totals in one Activity. Existing native concentration events remain accepted. The Activity check only supplies the result; failure consequences still belong in its outcome operations.

Combined next-d20/dice/authority/executor/per-target/native-engine suite451passed. Focused command/log/next-d20 suite30passed; later next-d20/log/guide suite40passed; final expanded pending-disadvantage next-d20 suite17passed. These totals overlap and are not independent certifications. Compiler64394completed0 for the first runtime batch; compiler64635completed0 after log metadata/guide changes, with the final pending-disadvantage projection/test edited during that run (not separately recompiled afterward). No original source review promotion, no paid API call, no live-room change.

Remaining: sequential Activity attacks and critical-dice preparation, general UI recipe/preview order, cross-continuation history, and source-configuration regeneration/installed/browser certification. The monster spell attack base mode was found to omit the next-d20 marker; it is not silently changed in this batch because adding it without matching sequential attack/critical preparation would grant or validate the wrong later dice. Whole-book goal remains active and paid conversion remains gated.

### Installed mixed and deferred material recipes

Revisited the whole-book backlog rather than continuing one-roll mechanics indefinitely. Inspected current runtime material contracts and verified original local excerpts for Create Homunculus and Summon Lesser Demons. Three old diagnostics concern mechanisms already present: a priced reusable component, different consumed flags within one recipe, and choice-dependent consumption at spell end. No source draft or automation status was rewritten.

Changed the synthetic conditional-material lifecycle tests to execute the package produced by actual portable module export and reinstall. Six cases cover immediate/deferred consumption, concentration/timed lifetime, custom expiring reagent and mixed consumed/reusable material. Mixed cases reject a missing catalyst and a same-tag999GP catalyst, accept1000GP, consume/reserve only the reagent and preserve the catalyst. Existing assertions verify forged/missing choices, stale inventory revision without spending a slot, concentration interruption, turn/clock expiry, and idempotent consumption. Export preserves the recipe and does not mutate the source package.

Material/escrow/conditional suites29passed; final mixed-value and module-export batch37passed. Compiler52856completed0 after final edits, also covering the late pending-concentration-disadvantage edits from the previous batch. Reviewr45/coverager40 adds only these three exact diagnostics as expressible;76reviewed,870unreviewedlinks,11partial,63expressible,2sourcecorrections. Updated batchplanr6 uses reviewr45;122entries still require mechanism review and1awaits batch regeneration. These counts are review coverage, not source conversion or full-spell certification. Demon circle behavior, creature data, source ingredient provenance and original configurations remain independently unverified. API0, live rooms unchanged, paid gate closed.

### Combined area lifecycle evidence after archive and save reload

Verified the local Cloak of Flies excerpt and located the existing lifecycle review e169d4b96c7a45e1867b07a36f9957eb88a8e4cc2f78346298a46c978761ff5e. It was already expressible, so this batch adds no reviewed/completed item. Expanded the synthetic area-dismiss archive fixture to preserve permanent:true, sourceIncapacitatedBehavior:remove-area and the granted bonus-action dismissal together. It checks map migration after JSON save, no arbitrary timeout at round10000, actual DM monster authority after reload, and five incapacitating conditions versus restrained. Incapacitation clears the area, projection and granted authority while preserving an independent area; valid bonus-action dismissal still spends its cost and cannot be reused.

Area-dismiss/plugin-area/validation139tests passed. This is stronger combined evidence for an already-known interface, not original Cloak of Flies certification, root area creation end-to-end certification, or a full-book completion-count increase. No new runtime field, API request or live-room mutation; no full typecheck repeated for this test-only batch. Latest complete compiler remains52856.

Fresh lifecycle audit also distinguished two real unresolved boundaries: source-dies removes effects but does not itself declare death of an owned summoned creature (Create Homunculus diagnostic d0ace1d79d9362a69b403fa75af33aafab6d1bdb93c277de008bb62978a00842); same-map communication and planarPhase projections do not establish arbitrary same-plane identity across scenes (Create Homunculus/Mind Spike diagnostics). Existing effect cleanup must not be used as false evidence for these separate mechanisms. Reviewr45/coverager40 remain the current reviewed scope.
## Source-bound summon death: local runtime batch

Added `sourceDeathBehavior: "die"` across the summon contract, validation,
executor proposal, map placement and save metadata. Successful Headless commits
settle confirmed source death, retaining the binding after command control ends.
The instant-death handler preserves Death Ward behavior. Saved handled markers
prevent duplicate application, and confirmed deaths of player-controlled summon
tokens are restored from persisted death boundaries.

Offline checks: `summonSourceDeath.test.ts`, `summonedCreatures.test.ts` and
`activities/dnd5eActivityMapInteraction.test.ts`: 87 passed. Cases cover third
death failure from damage, unconscious source, ward prevention, invalid damage
rollback, control loss, map save/reload and corpse retention. `npm run typecheck`
also passed after the runtime edits. No paid API calls.

Follow-up: stable character identity and authoritative roster deaths now cover
source token replacement and owners absent from the open map. A Host-only
lifecycle transaction reuses instant-death settlement without advancing a turn
or spending an action. Map projection persists only changed combatants, and the
existing serialized DM summon reconciliation invokes it before dismissal.
Unknown owners preserve persistent death-bound companions. Three focused files
(`summonSourceDeath`, `summonedCreatures`, `sourceDeathEffectLifecycle`) passed
32 tests, including absent/replaced owners, missing roster, Death Ward,
unconsciousness, unrelated token preservation and replay.

Final batch validation also included `dnd5eActivityMapInteraction.test.ts`: 97
tests across four files passed. `npm run typecheck` completed successfully after
the Host map hook and roster projection changes.

Further lifecycle batch: observing a living source rearms a surviving companion;
an absent/unconscious source cannot clear its receipt, and a dead companion keeps
its corpse receipt. Tests exercise Death Ward, missing-source replay, observed
resurrection, saved rearm, a second source death and corpse preservation. The
DM map workspace authority lane now applies this roster reconciliation to all
room maps, persisting unopened maps without changing their initiative. Tests
also exercise two unopened maps with a companion-free active map, both map
orders and replay. The same four-file batch passed 97 tests with these added
assertions. `npm run typecheck` also passed after the rearm and all-map authority
changes.

Not complete: dual-client acceptance, transitions wholly missed while the Host
is offline, cross-map monster-only sources and full imported companion spell
behavior. The browser authority hook has not undergone dual-client acceptance.
No source configuration, review status or book completion count was promoted.
Paid API calls remain zero.

### Portable summon declaration and player cast evidence

`summonSourceDeathArchive.test.ts` exports a synthetic spell to `.starmod`, reads
and independently registers the same bytes twice, then uses the normal player
spell preparation and Host resolution APIs. It verifies spell-slot consumption,
the executor's summon handoff, map placement, JSON migration and an off-map
source death. It also rejects another cast after the slot is exhausted. The
fixture explicitly is not a converted book spell. The AI authoring guide now
documents the declaration and its remaining boundaries.

Focused archive/lifecycle/guide/module-export batch: 35 tests passed in four
files. Source evidence was reread from verified inventory entry `153:3`.
Private review r46 records the source-death diagnostic as partially addressed;
coverage r42 reports 77 reviewed diagnostics, 869 unreviewed links and 12 partial
links. Mechanism batch plan r7 incorporates it. All 155 entries remain in scope;
no original configuration or full-book certification was promoted. API calls: 0.

The archive fixture's spell payload enum was corrected to `reference-only` (its
Activity supplies the compiled Headless implementation); the archived player
cast test passed again and `npm run typecheck` then passed. Coverage r42 records
the final evidence hashes after that correction.

### Real Hit Dice consumption foundation

Audit found `hit-die` present in the protocol but rejected by compiled actions,
while direct commits could fall through to ordinary class-resource spending.
The Host now carries a copied `hitPointDice` pool from the character and spends
canonical `hit-die:d6/d8/d10/d12` costs against it. The feature adapter and
compiled Activity context support that cost; map application saves its remainder.
Direct commits aggregate repeated costs before mutation. Validation rejects
arbitrary pool names; ambiguous/invalid pools fail closed. Same-named class
resources cannot fund this cost. Resource logs label the actual die size.

Synthetic direct/compiled tests verify saved character projection, spending,
no input mutation, insufficient dice, duplicate cost rejection, counterfeit
class resources and reload. Hit Dice/rest/character batch: 24 passed. Activity
validation/compiler regression batch: 61 passed. `npm run typecheck` passed after
all runtime, adapter and persistence changes. No paid API calls or generated
configuration edits.

Still incomplete for Create Homunculus: per-die Constitution calculation,
player choice of dice across classes, half-pool limits, same-plane eligibility,
linked maximum-HP transfer and protected expiry. This foundation is not full
rest-feature or original-spell certification; review completion counts unchanged.

### Hit Dice pool formulas and aggregate budget

Added Host-projected `actor-hit-dice` and `target-hit-dice` formula references for
remaining/maximum dice, optionally by die size. Missing ledger data rejects
evaluation; a known ledger without a requested die size yields zero. Both direct
and compiled Activity snapshots carry copied pools.

`hit-die.maximumTotalFraction` caps the total applicable cost across all die
sizes and repeated costs, rounding down from total pool maxima. Both authority
paths check this before mutating costs or benefits. Tests cover mixed pools,
odd maxima, splitting costs, invalid fractions, absent data and formula use in
real Headless outcomes. The Hit Dice/formula/validation batch passed 71 tests in
three files. After splitting actor/target formula references into distinct
discriminated union branches, `npm run typecheck` passed. No generated
configuration changes or API calls.

This resolves the budget primitive, not selection UI, rolled per-die benefits,
same-plane requirements or linked HP transfer. Original spell certification and
review counts remain unchanged.

### Maximum-HP transfer audit: reject false negative bonuses

Current `hit-point-maximum` modifiers express increases only. Audit found the
executor silently clamped negative results to zero, while values above the
persisted modifier limit could later be discarded by normalization. Static
negative/out-of-range constants now fail validation; evaluated negative or
aggregate over-limit bonuses fail execution. Dynamic formula regression tests
preserve zero/positive behavior and reject negative/over-limit output without
mutating input. Executor/validation/reduction-ledger batch: 131 tests passed;
the final dynamic over-limit fixture also passed in the 69-test executor file.

The separate reduction ledger already has `effect-removal` entries and exact
owning-effect recovery, distinct from long-rest or restoration-magic recovery.
It is the appropriate basis for linked transfer; using a negative bonus would
not provide safe clamping, recovery or source ownership. This turn does not
implement the transfer operation or mark that original spell automated. Paid
API calls: 0. Review counts unchanged.

`npm run typecheck` completed successfully for the maximum-HP validation and
executor changes.

### Effect-owned maximum reduction: portable player entry and timed recovery

Added the `reduce-hit-point-maximum` Activity operation across contracts,
validation, executor, direct/compiled Headless authority, event text and SDK
conversion guidance. It binds an actual unique effect instance from the same
actor/module, enforces a positive maximum-HP floor, persists the applied amount,
rejects duplicate application and restores only that instance's ledger entries.
An invalid or immune target rolls the transaction back, including its Hit Die
cost. This is a reduction primitive, not an equal-value transfer implementation.

The archive/player-path test initially failed with `spell-not-headless`, proving
that direct engine success was insufficient: the operation was missing from the
mechanics registry. Registered the implemented operation and reran through the
normal player spell preparation/settlement path. The same exported `.starmod`
bytes now install independently twice, consume a spell slot, persist the real
owner binding through JSON save/reload and restore the maximum at timed expiry
without healing current HP. Fixtures are explicitly synthetic; they do not
replace original PDF conversion or browser/client synchronization evidence.

Campaign-time reconciliation now recovers orphaned effect-owned reductions.
Mixed-ledger tests preserve an unrelated permanent owner's reduction and a
long-rest reduction, prove input immutability and repeated reconciliation
stability. A one-round Activity uses a turn-boundary duration, so finite campaign
expiry fixtures intentionally use two or more rounds; no turn-boundary effect
was reinterpreted as elapsed-time expiry.

Validation: 7 files / 70 tests passed, covering `maximumReductionArchive`,
`effectOwnedMaximumReduction`, source lifecycles, reduction ledgers, campaign
time, mechanics registry and AI SDK guide. Paid conversion API calls: 0.
Original configuration review counts remain unchanged. Selected Hit Dice rolls,
equal transfers, same-plane restrictions and whole-companion behavior remain
outside this batch's acceptance evidence.

Final `npm run typecheck` completed with exit code 0 after the portable entry,
mixed-ledger recovery tests and conversion guide changes.

### Atomic maximum-HP transfers and recipient expiry

Added `transfer-hit-point-maximum` to Activity contracts, formula evaluation,
validation/reference checking, mechanics registration, direct commit and compiled
Host context. The actor is the donor; a distinct target is the beneficiary.
Both effects must already exist with exact source/module ownership. The donor's
actual applied debit funds the recipient's effect bonus, so requesting 100 from
a maximum of 30 with floor 1 yields 29 on both sides. Current HP increases only
when explicitly requested. Repetition, source immunity or a dead recipient fail
atomically without consuming an additional Hit Die or retaining partial effects.

Four direct/compiled regression variants cover current-HP increase enabled and
omitted, source immutability, duplicate rollback, failure rollback, persistence
and finite expiry on both sides. The archive test additionally exports and
independently reinstalls the transfer spell twice, then uses normal player
preparation/settlement and checks slot consumption and persisted effects.
These are synthetic protocol fixtures, not regenerated original content.

Initial lifecycle tests found that campaign-time expiry removed a maximum-HP
bonus but could leave current HP above the resulting maximum. Reconciliation
now clamps current HP to the base plus remaining active bonuses, including
zero-time source-lifecycle reconciliation. Debit restoration still does not heal.

Validation: the seven-file batch passed 125 tests; after expanding the optional
current-HP cases, all four transfer tests passed. SDK and AI conversion guidance
describe both the operation and its limits. Paired cross-creature lifetime,
same-plane eligibility, selected Hit Dice rolls and exact rest activation remain
separate requirements; no complete companion spell is newly certified.
Paid conversion API calls: 0. Original configuration/review counts unchanged.

The transfer batch's `npm run typecheck` completed with exit code 0.

### Linked transfer lifetimes: combat and character roster

Added explicit `linkLifetimes: true` to maximum-HP transfers. The Host stores
reciprocal exact effect IDs and stable character identities. Either effect
ending or either bearer being confirmed dead ends both; unconsciousness and
missing/ambiguous peer data do not prove expiry. Reused token IDs cannot redirect
a character-bound link. Normalization persists and validates this metadata.

Direct commit, compiled action completion and passive map lifecycle reconciliation
now settle linked expiry. Character-roster reconciliation runs a bounded fixed
point after source-rest/death cleanup, restoring the exact debit and clamping the
recipient's current HP after its bonus ends. This preserves result independence
from roster order and supports source-triggered expiry propagation. The passive
map entry also reconciles links when no summon death receipt changed.

Tests cover serialized links, replaced/reused tokens, ambiguous/missing peers,
donor/recipient effects, recipient death, map and campaign expiry, idempotent
passive cleanup, source immutability, and two independent portable player spell
installs. Six-file lifecycle batch: 101 passed. After adding passive cleanup,
the four-file targeted batch passed 32 tests. All fixtures remain synthetic.

Cross-map non-character companion peers still need map-wide evidence; this
batch does not certify that path, same-plane eligibility, rest selection or
selected Hit Dice rolls. No original spell configuration is promoted. Paid
conversion API calls: 0.

Final typecheck after the passive linked-lifetime entry update completed with
exit code 0.

### Cross-map linked lifetimes: non-character companions

The existing DM room-wide summon lifecycle lane now gathers peer evidence from
all saved maps and the complete character roster. Map snapshot construction
supplies death semantics rather than treating HP zero as death. Local character
snapshots take precedence over duplicate roster projections; duplicate remote
token identities remain ambiguous. External evidence is used for lifetime
decisions only, never as an extra combat target.

Linked effects now reconcile for actors without `sourceDeathBehavior: die` too.
After the initial summon-death pass, a bounded room-wide fixed point propagates
remote effect removal and restores effect-owned maximum reductions. It handles
a character absent from every map and a non-character companion on an unopened
map. Only changed actors/maps are persisted through the existing Host lane.

Seven cross-map scenarios cover living and unconscious companions, confirmed
death, recipient effect removal, donor effect removal, missing peers and duplicate
token IDs. Both map orders, JSON save/reload, repeated reconciliation, unchanged
map references and input immutability are asserted. The five-file related batch
passed 29 tests. SDK and conversion guidance reflect this local evidence.

This does not demonstrate browser DM/player synchronization or offline Host
execution. No original PDF configuration is regenerated or newly certified.
Paid conversion API calls: 0. Same-plane eligibility, rest choices and selected
Hit Dice rolls remain outstanding mechanisms.

Entry inspection found the DM workspace scheduler was gated solely on summon
tokens. It now also runs when either a character or token has a linked lifetime,
covering ordinary character links even without summons. A separate module,
campaign-time, SDK-guide and map render-isolation batch passed 95 tests.

Final `npm run typecheck`, including the broadened DM scheduler entry, completed
with exit code 0.

### Maximum-HP dice recipes and critical isolation

Audit before Hit Dice selection found that maximum reduction/transfer operations
accepted formula dice but the shared Host/UI recipe omitted them; preceding
constant fixtures could not expose this. Added those operation amounts and
maximum-HP modifier values to the formula collector. The portable reduction and
transfer fixtures now use actual 2d4 rolls through normal player settlement,
including two independent archive installs. Empty, short, excessive and
out-of-range roll submissions reject without changing source slots/HP.

The recipe also previously doubled every formula die whenever an Activity had
critical damage. It now doubles only IDs used by double-dice damage operations.
A mixed critical attack asserts 2d8 damage, unchanged 2d4 transfer and unchanged
1d6 maximum bonus, with execution amounts 14, 7 and 5 respectively.

The recipe/archive/player-spell transaction batch passed 131 tests in three
files. SDK and AI instructions distinguish fixed dice formulas from choosing
actual Hit Dice: the latter selection and per-die binding remain incomplete.
No original configuration is manually repaired or promoted. Paid API calls: 0.

`npm run typecheck` completed with exit code 0 for the dice-recipe changes.

### Closed Hit Dice quantity choices and authoritative recipes

Added `whenChoice` to Hit Die consumption, with exact declared-option validation.
Resolved choices filter costs before aggregate budget checking and spending.
Cost-bound choices remain relevant in the existing choice UI. Formula recipes
now exclude only outcomes contradicted by known choices; unresolved choices
retain possible branches so post-roll choices cannot erase their prerequisite
dice. Player spell, generic Activity and triggered-roll entry paths pass choices
to that shared collector.

Synthetic direct and registered compiled tests select one or two d6, spend the
matching real pool count, calculate per-die Constitution, enforce the half-total
budget, reject unknown choices/wrong dice counts and persist the remainder.
The compiled fixture registers its Activity catalog as a real installed module
does; a raw compiled action alone has only its static all-branch recipe.
Triggered roll collection requests only the chosen pool. Portable maximum-HP
fixtures now select two d6, consume two real Hit Dice plus the spell slot and
transfer/reduce the rolled 7 through two independent archive installations.

Related initial batch: 151 tests in five files. Final focused choices, archive,
recipe, trigger targeting/modes and validation batch: 94 tests in seven files.
These are synthetic protocol tests, not original PDF configuration conversion or
browser interaction evidence. Closed quantity menus are implemented; an arbitrary
multiclass editor, combined-pool transfer and exact rest eligibility remain to be
verified. Paid API calls: 0. Original conversion counts unchanged.

Final choice-default/pending-choice, render-isolation and SDK-guide batch: 55
tests passed. Initial typecheck identified a UI payload variable used before its
declaration; moved the existing declaration before recipe construction.

Final `npm run typecheck` after that fix completed with exit code 0.

### Mixed-pool transfer funding and noncombat rest choices

Mixed-pool tests exposed the transfer primitive rejecting the second contribution
because the pair was already linked. Reuse now requires both exact reciprocal
actor/character/effect endpoints; partial or different links remain rejected.
Direct/compiled tests spend d6 plus d10 under one half-total budget, record actual
debits of 10 and 19 when the second request hits floor 1, and restore both entries
once on expiry. Over-budget attempts roll back both costs and effects.

An integration fixture connects closed one/two Hit Dice choices to the existing
Host long-rest window. It initially failed for a one-character inactive snapshot:
the generic commit required active combat. Added an internal, non-command rest
commit permission forwarded only after the rest gate's clock/owner/entitlement/
receipt checks and restricted to rest trigger contexts in the authority bridge.
The snapshot remains inactive, and normal noncombat commits remain rejected.

The rest fixture verifies selected dice and per-die Constitution, no receipt on
invalid dice, success/decline replay rejection after serialization, stale-time
rejection and input immutability. The receipt is persisted with the returned
resources in the fixture; browser transaction persistence remains separate.
Mixed transfer and rest choices are independently covered, not a claim that the
full original companion feature has passed combined acceptance.

Six-file transfer, choices, archive, rest and authority bridge batch: 72 tests
passed. SDK and conversion guidance updated. Paid API calls: 0. No original
configuration is manually patched or newly certified.

Final typecheck for mixed-pool funding and the internal inactive-rest commit
permission completed with exit code 0.

### Portable rest funding: combined Host transaction and next-rest ordering

`restMaximumTransferArchive.test.ts` exports a synthetic feature to `.starmod`,
installs it twice independently, and uses the production player feature request
and Host rest settlement route. A closed mixed d6/d10 choice consumes one die
from each real pool under the half-total budget. Rolls 3 and 7 with CON +2 per
die debit 14 maximum HP, credit exactly 14, and publish the rest receipt in the
same character application. Invalid dice publish no application; serialization
and reload preserve the ledger, linked effects, costs and replay rejection.

The real next-long-rest clock advance exposed healing before own-source effect
expiry: the donor recovered to 16/30 instead of 30/30. Long-rest benefits now
remove proven own-source rest-expiring effects and settle their owned maximum
debits before choosing the healing cap. Other-source expiry still uses the
complete-roster pass. Confirmed recipient death also restores the debit once.

The seven-file archive/rest/lifecycle/feature regression batch passed 91 tests.
This is combined protocol evidence, not original PDF conversion certification,
not a browser synchronization run, and not validation of missing creature data
or same-plane eligibility. Paid conversion API calls: 0.

Final `npm run typecheck` completed with exit code 0 for this batch.

### 2026-09-28: refresh exact-source mechanism reviews after combined funding work

Read the verified inventory source for Create Homunculus again and added six
scoped reviews in private `fullbook-mechanism-review-20260928-r47.json`.
Four old diagnostics are now expressible: per-die Constitution arithmetic,
next-source-rest expiry, exact maximum/current-HP transfer, and the minimum
maximum-HP floor. Two remain partial: arbitrary mixed-pool quantity selection,
and a source-specific prohibition on premature removal of the owning effect.
Same-plane eligibility and missing creature data remain unresolved separately.

The offline coverage verifier checked diagnostic/source scopes and hashed the
current evidence files into `fullbook-review-coverage-20260928-r43.json`.
It reports 83 reviewed diagnostics / 946 source links: 67 expressible, 14 partial,
2 source corrections, 863 unreviewed. New batch plan
`fullbook-mechanism-batch-plan-20260928-r8.json` retains 879 unresolved links.
These are review counts, not counts of failed spells or certified conversions.
Original configurations remain unchanged; no entries were newly certified and
the paid conversion gate remains closed. API calls: 0.

### Actor-owned Hit Die pool menus

Added `choices[].optionsFrom: "actor-hit-dice"`. Schema validation recognizes
the four canonical pool IDs even before runtime expansion; outcome and cost
guards may reference them. UI prompts, spell preparation and the Activity
executor rebuild options from their own actor Hit Dice snapshots, omitting
missing, empty, invalid or ambiguous pools. Authored options cannot override
stock, requirements or targeting; unavailable defaults are discarded.

The compiled Host fixture verifies d6/d8/d10/d12 selection, only the selected
formula roll and cost, per-die CON healing, no change to other pools, exhausted
selection replay rejection and immutable failure. Choice tests also check absent
data, duplicate pools, injected options and canonical validation after expansion.
Three-file focused batch: 23 passed. Six-file schema/executor/player-feature/
player-spell/rest-archive/unified-import regression batch: 302 passed.

SDK and conversion instructions describe the real-pool selector and its boundary:
one pool per choice, no inferred trigger or arbitrary mixed-count editor. This
does not certify the original Dwarven Fortitude configuration or its Dodge
trigger; no source artifact is patched and no paid API is called.

Typecheck for the actor-owned pool selector completed with exit code 0.

### Composed quantities across real Hit Die pools

Added `actor-hit-die-count` choice generation with a canonical die size and
declared count ceiling (default 20, bounded at 511). Each pool offers 0 through
its remaining count within that ceiling. Unknown data fails closed; a known
absent pool offers zero. Expanded menus remain schema-valid even when source
outcomes reference currently unavailable counts. Validation requires every
positive quantity to have exactly its matching constant Hit Die cost and zero
to have none, preventing visible quantities without the declared resource cost.

The compiled Host test selects (d6,d10) allocations (1,1), (2,0), (0,2), rejects
(2,1) against a half-of-five shared budget and (0,3) against actual pool stock.
It checks exact selected dice/per-die CON, resources, healing, untouched input
and atomic failure. Trigger UI now rejects empty menus instead of reading an
undefined first option and skips a sole zero count. SDK/conversion guidance
describes composition and its finite declared ceilings.

Six-file focused/schema/choice/spell/rest-archive batch: 212 tests passed.
Typecheck then identified a missing discriminated-union guard in the new cost
validator; added the explicit hit-die guard. The portable rest fixture now uses
separate generated d6/d10 quantity choices, declares counts 0..2, and verifies
the mixed (1,1) allocation after two independent archive installs. Selected
rolls, atomic receipt/resources, save/reload, replay denial, recipient death and
next-long-rest recovery still pass. Focused updated archive/count tests: 11 passed.
Browser acceptance, original PDF configuration and source review status remain
unchanged. Paid API calls: 0.

Final typecheck after the explicit cost guard and generated-quantity archive
fixture completed with exit code 0.

### Compact authoring for Hit Dice benefits

Added the content-neutral `hit-dice-benefit` authoring pattern. It expands unique
pool sizes and count ceilings into ordinary validated choices, guarded costs,
selected fixed dice and optional per-die ability bonuses. Supports explicitly
declared per-pool healing or maximum transfer, shared fractional budgets and an
optional per-pool floor. No aggregation semantics or triggering rule is inferred.
Setup executes once at the first nonzero pool; all-zero selections create no
setup effects. Exported modules contain ordinary Activities only.

The pattern fixture checks zero, first-pool-only, second-pool-only and mixed
selection, a negative CON modifier with explicit per-pool floor, malformed pool
sets and authoring expansion. Its 40-branch expanded JSON is over ten times the
compact declaration in character length; this is not an API-token measurement.
The portable rest transfer fixture now uses this compiler and still verifies
two independent installs, Host settlement, receipt persistence and lifecycle
recovery. Three-file pattern/archive/pool batch: 26 passed. Synthetic examples
and conversion guidance updated; original conversions unchanged; API calls: 0.

Final typecheck passed after adding the test's explicit successful-result guard.

### Dispel candidates must represent ongoing spells

The lifecycle audit found generic Dispel Magic candidate discovery included
lingering results from instantaneous spells. The official 2014
[Sage Advice Compendium](https://www.dndbeyond.com/sources/dnd/sac/sage-advice-compendium)
explains that instantaneous results are not sustained by a spell to dispel;
this is a source-duration rule, not a rule based on how long a result persists.

Candidate discovery now excludes structured instantaneous imported spells and
native spells whose reviewed SRD duration is instantaneous. Both active-effect
and legacy concentration-reference discovery use this guard. Player and monster
Dispel Magic share that discovery path. An imported-spell test verifies no effect
removal or successful-dispel event while the attempted casting still consumes
its spell slot. Native cases include Acid Arrow, Animate Dead, Feeblemind and
Awaken, with Mage Armor, Haste and Bestow Curse as continuing positive controls.

This does not certify general immunity to all removal methods: generic explicit
remove-effect operations and other source-specific termination restrictions
remain separate work. No source configurations were patched; paid API calls: 0.

Player/monster spell and termination batch: 264 passed. Updated termination
cases plus the core combat engine batch: 322 passed (overlapping batches, not
586 unique tests).

Final typecheck for source-duration Dispel Magic eligibility passed.

### Protected lifetimes for linked maximum transfers

Added optional `protectLinkedLifetime: true` to maximum transfer, requiring
reciprocal links and independent permanent marker definitions. The Host stamps
both exact owning effects with protected-removal metadata; normalizers preserve
it and strict validation rejects malformed persisted values. Subsequent funding
must use the same protection policy, preventing a second pool from downgrading it.

Ordinary ID/tag removal and stacking replacement preserve protected anchors and
their maximum-reduction ledger. Validated lifecycle callers explicitly permit
removal after source rest/death or linked peer expiry; generic removal does not
receive that permission. Dispel discovery also excludes protected spell markers,
including stale concentration fallback references. This policy does not disable
privileged out-of-band DM state editing or provide blanket protection for complex
conditions, authored modifiers, concentration and source-link removal effects.

Portable generated rest-transfer acceptance now enables protection, verifies
saved flags and denied replacement/removal on both ends, then verifies real
source long-rest and recipient-death recovery. A separate fixture exercises
direct/compiled ID/tag removal, intact debit ledgers, unrelated removable tags,
malformed links and Dispel fallback. Existing compiled exact-ID removal returns
failure when nothing is removable; the direct path remains a no-op, preserving
the pre-existing return-contract distinction.

Five-file transfer/link/source lifecycle batch: 24 passed. Protected removal,
archive, transfer, cross-map and validation batch: 80 passed. Final protected
removal/archive/termination/core-engine batch: 327 passed. These overlap and are
not a count of newly automated source entries. SDK and AI conversion guidance
updated. Original configurations unchanged; paid API calls: 0.

Final typecheck for protected linked maximum-transfer lifetimes passed.

### Offline review reconciliation after protected transfer batch

Immutable review r48, coverage r44 and mechanism plan r9 were generated and
checked locally. Coverage records 83 reviewed diagnostics, with 69 expressible,
12 partial, 2 source-correction and 863 unreviewed source links. The plan retains
877 unresolved links. These are diagnostic links, not counts of broken spells.
The two updated reviews concern bounded Hit Die quantity selection and protected
linked maximum-transfer lifetimes for source 153:3; neither certifies the original
conversion or browser workflow. All 155 source entries remain in scope, and the
paid conversion gate remains false. API calls for this reconciliation: 0.

### Namespace isolation for imported companion control

Inspection found that source-specific companion commands and control release
matched actor and activity IDs but omitted the originating module. Added
`summonedSourcePackageId` to the authoritative combat projection from existing
map/simulation summon metadata. Direct proposal validation and compiled
settlement now also match the executing module, including forwarding the direct
release caller namespace. Missing legacy metadata defaults only to srd-5.1,
never the caller module. Native class commands without a sourceActivityId retain
their existing qualification path. No new client-supplied authority field.

Portable command/control fixtures now reject another module with the same
activity ID and missing imported-module provenance, for both direct and compiled
paths, successful commands and failed contests that would release control.
Rejected attempts preserve inputs. Existing map-derived module provenance,
export/reinstall command behavior and source-owned successful release still pass.
The command/control/routing batch passed 48 tests; bond/map-interaction/native
primitive regression passed 79 tests. SDK and conversion guidance updated.
These synthetic tests do not certify original PDF conversions or browser flows.
Paid conversion API calls: 0.

Final typecheck for companion module provenance passed.

### Source-specific companion eligibility

Added optional owned-companion.source {packageId, activityId}. This matches
Host ownership and exact originating module/activity before outcome resolution,
allowing source-specific benefits as well as commands. No source selector keeps
the original any-owned-companion behavior. Missing native provenance defaults
only to srd-5.1; absent activity provenance cannot satisfy an exact selector.
Validation rejects malformed selectors. All three combat-to-Activity snapshot
projections now preserve the source metadata.

Executor tests cover beneficial operations, wrong owner/module/activity, absent
metadata, legacy native namespace and invalid selector input. The portable
command fixture exports/reinstalls this requirement and checks both direct and
compiled paths. Executor/command/control batch: 94 passed. Definition validation:
60 passed. The requested trigger-settlement test filename did not match a file;
that command ran only the definition validation suite, not trigger settlement.
SDK and AI guidance describe explicit source selection without claiming unique
summon limits, UI filtering or original-source certification. API calls: 0.

Final typecheck for source-specific companion eligibility passed.

### Authoritative summon placement contracts

Source review of greater steed and lesser demon placement exposed a real gap:
cell UI used a default range, while summon map handoff checked footprint
occupancy/geometry but did not enforce that range. Added optional integer
placementRangeFeet and boolean requiresVisiblePlacement to summon operations,
validation and proposals. The three public cell selectors use declared ranges.
Host rechecks each individual summon using actual creature footprint distance,
latest sight and existing occupancy/geometry checks, and rejects malformed cell
coordinates. Default distance uses area placement range, creature target range,
or 30 feet. Mixed batches cannot borrow another operation's larger range.

Tests cover exact range boundary, out-of-range, occupied cells, malformed range,
legacy fallback, darkness, darkvision, late blindness, unchanged input maps,
executor projection, and portable direct/compiled summon handoffs. Initial
four-file batch passed 162 tests but emitted a worker shutdown timeout warning
with unreliable elapsed timings. After final changes, map/bond/validation batch
passed 128 and executor suite passed 70 without that warning. These overlap
with the initial batch. Visibility cell highlighting is still absent; Host
rejects invalid sight at placement. SDK and conversion guidance document this.

Immutable review r49 and coverage r45 now track 85 reviewed diagnostics:
71 expressible links, 12 partial, 2 source correction, 861 unreviewed. Two exact
placement diagnostics were reviewed against extracted source text and runtime
evidence. Original source-generated artifacts remain unchanged and uncertified.
No paid conversion or browser certification: API calls 0, gate remains closed.

Typecheck initially caught an optional creature-target distance. UI and Host now both fall back to 30 feet when omitted. Final map suite: 66 passed; final typecheck passed. Coverage r46 refreshes evidence hashes after this correction with unchanged counts.

### Atomic persistent summon groups

Reproduced a production handoff bug with both count=2 and two summon operations:
only the second persistent creature remained, while both initiative entries
were returned. The per-occurrence replacement loop included creatures created
earlier in the same transaction. Replacement now only considers IDs present
before this summon batch and removes replaced IDs from that set. New members
remain on the working map for later occupancy checks.

The two reproductions failed before the fix. Corrected a separate synthetic
fixture omission (resolved handoffs require durationRounds even for persistent
summons; the executor already fills 1). Final map/bond/routing batch: 94 passed.
Coverage includes multiple operations, distinct IDs and initiative entries,
old-source replacement, other-module preservation, duplicate-cell rejection
without mutating input, and JSON save/migration retaining both members. This
retains existing source replacement semantics; it does not implement arbitrary
unique-companion rule predicates. SDK updated; paid API calls: 0.

Final typecheck passed after correcting the fixture's literal true type and required resolved duration field. Production batch replacement fix unchanged.

### Sequential legal-cell previews for summon placement

The three ordinary Activity summon entry points now pass authoritative summon
proposals into the browser placement session. A pure preview helper replays the
selected prefix plus each candidate through existing atomic placement rules.
The next creature therefore uses its own range/sight and sees previous members'
footprints. The session recomputes candidates on each click from current map and
character state, updates highlights for the next member, and rejects stale cells.
Preview uses disposable initiative values and does not commit map/resources.
Final Host transaction validation remains unchanged.

Map suite: 69 passed, including darkvision, blindness after selection, mixed
placement ranges, existing and newly selected occupancy, exhausted choices and
unchanged input. Existing overlay and portable bond suites: 4 passed. This is
source wiring plus local behavior evidence, not browser dual-client acceptance.
Corpse-only placement bypasses manual selection; preselected area single summons
retain their existing final-check path. The helper currently replays candidate
placements over the map grid; large-map performance has not been certified.
SDK updated. Original conversions unchanged; paid API calls: 0.

Final typecheck passed. Review r50 and coverage r47 refresh the two placement evidence notes/hashes without changing coverage counts or opening the conversion gate.

### Bounded summon preview scanning

Replaced full-map candidate enumeration with conservative source-footprint and
next-monster-footprint bounds derived from the actual installed catalog size.
The upper-left anchor bound includes the monster footprint extension beyond the
range edge; candidates still pass the full atomic placement rules. Extracted
one distance-default helper shared with final placement validation.

Map suite: 73 passed. New exhaustive small-map comparisons use wolf, dire wolf
and mammoth, a Large source, and offset grid coordinates. A short-range preview
on a theoretical 20,000 by 20,000 grid returns the same cells as the small map,
without visiting the 400 million cells. This proves bounded scanning for that
case; it is not a real-browser frame-time or long-range/high-occupancy benchmark.
No source conversion or live room changed; paid API calls: 0.

Final typecheck for bounded summon preview scanning passed.

### Costly material waiver and source audit

Reviewed five unresolved material-related diagnostics against extracted source
and current endpoints. Found Walker in Dreams' failure-use claim contradicts
the supplied PDF; recorded source inventory/text hashes in the separate material
source review. Do not implement the inverted consumption rule.

A real costly-material grant test found Warding Bond ignored the native grant's
material exemption in its target-ring check and then removed the granted effect
for absent rings. Both now respect the Host-verified exemption, with a saved
effect tag for ongoing reconciliation. Tests verify actual resource debit,
ordinary material rejection, silence/ownership rejection and JSON/turn survival.
The first Stoneskin fixture exposed a separate endpoint limitation: native
resource-spell preparation does not resolve all imported Activity spells.
Warrior of the Gods' target-owned revival-only exemption is still unimplemented.

Three-file regression: 524 passed. Review r51 / coverage r48: 88 reviewed,
71 expressible links, 14 partial, 3 source correction, 858 unreviewed. Two newly
partial material mechanisms remain unresolved rather than being called narrative.
No original source conversion was edited or certified; paid API calls: 0.

Final typecheck for costly material waiver and new grant regression passed.


## Imported alternate-resource spell transaction bridge (2026-09-28)

- Added verified feature/grant transport through plugin spell preparation, Activity authority and adjudicated resource settlement. Namespaced imported spell IDs now pass the alternate-resource grant validator; local IDs retain compatibility.
- Synthetic imported corpse spell exercised on a monk with no ordinary spellcasting selection: owned grant succeeds, spends 2 ki once, creates both declared summons, leaves no ordinary slot charge. Missing ownership and insufficient resource reject. Undeclared corpse form fails atomically without ki consumption. Existing normal-slot scenarios remain covered.
- Local regression command: `npx vitest run src/rulesets/dnd5e/pluginSpellTransaction.test.ts src/rulesets/dnd5e/spellAction.test.ts src/rulesets/dnd5e/headlessCombatEngine.test.ts` — 639 passed (session 35312, exit 0).
- This is synthetic mechanism evidence only, not regenerated PDF configuration or browser/network acceptance. Resource grant menu discovery, export/reinstall with the granting feature, ability-dependent imported behavior and component waiver boundary cases still need dedicated coverage. Typecheck running in session 14180 at time of entry. Paid conversion API calls: 0.

- Final typecheck: `npm run typecheck` passed (session 14180, exit 0). No production TypeScript edits during the check.


## Alternate-resource player entry (2026-09-28)

- Added feature-grant hotbar projection with one command per declared cast level, authoritative feature/grant identifiers and visible resource cost. Missing definitions, exhausted resources and revoked grants cannot produce an enabled entry. Spellcasting action restrictions include the new command.
- Map cast initiation rechecks the grant/current resource, rejects mixed racial/item/class/ritual sources and forwards the selection through native/imported self-target and target-selection payloads. Existing Host transaction remains authoritative.
- Local tests: `npx vitest run src/components/map/PlayerCombatHotbar.test.ts src/rulesets/dnd5e/pluginSpellTransaction.test.ts` — 161 passed, session 1298 exit 0. Actual hotbar static render contains the new command; synthetic projection verifies two level costs, insufficient resource and revocation. This does not claim browser click/network acceptance or original PDF conversion.
- Typecheck started as session 42178. Paid API calls remain 0; no live room modified. Export/reinstall with granting feature and isolated real-player interaction remain outstanding.

- Final typecheck: session 42178 exited 0.


## Portable resource-spell grant verification (2026-09-28)

- Upgraded the synthetic imported corpse spell transaction matrix to package the spell and declarative resource grant in one unified bundle. Every case installs/uninstalls, exports `.starmod`, reads the archive and registers the reconstructed bundle before preparing/resolving the cast. No inline setup grant survives into the second installation.
- Eight cases cover normal slots, invalid forms, resource success, missing ownership, insufficient resources, invalid form atomic rollback with resource grants, silence and costly consumed material waiver. Preparation uses Wisdom (+1) rather than Intelligence (+4), yielding DC 12; waived components create no material consumption plan.
- Batch verification: `npx vitest run src/rulesets/dnd5e/pluginSpellTransaction.test.ts src/rulesets/dnd5e/starModAdapter.test.ts src/components/map/PlayerCombatHotbar.test.ts` — 167 passed; session 82617 exit 0. Typecheck session 86408 pending. Updated AI SDK guidance to describe the imported transaction bridge and its executable-definition prerequisites.
- Original PDF conversion, paid model regeneration and isolated browser/network flow are not certified by this synthetic archive test. API calls 0.

- Initial typecheck found a readonly-array mutation in the test fixture only. Replaced it with a newly parsed complete bundle. Affected 8 cases passed again (session 44502 exit 0); final typecheck passed (session 9037 exit 0).


## Resource-grant source reconciliation and material boundaries (2026-09-28)

- Re-read verified PDF inventory entries for Zealot, Forge and Druid Grove. Added source text hashes and explicit remaining target-owned resurrection waiver / equal-value metal conversion requirements in `2026-09-28-resource-grant-and-material-boundaries.md`. No unsupported rule was silently converted to an ordinary caster waiver or inventory grant.
- Immutable review r52 updates Consult Spirits with portable resource-grant evidence while retaining its sensor/spell implementation limits; adds partial reviews for Warrior of the Gods and Artisan's Blessing. Coverage r49: 90 reviewed diagnostics, 856 unreviewed source links, 16 partial links, 71 expressible links, 3 source corrections; 122 entries still require mechanism review. These are diagnostic counts, not completed spell counts.
- Offline batch plan r10 regenerated successfully against r52; 875 unresolved links remain. Both scripts exited 0. API gate closed, API calls 0. Next concrete implementation: target-owned revival-only component eligibility with Host verification, preserving ordinary costs and excluding undead creation.


## Target-owned revival material waiver (2026-09-28)

- Added closed declarative mechanic `revival-material-waiver`. Host resolves actual target-owned feature eligibility; no caster payload flag can grant the exception. Eligibility requires a creature-target Activity whose every result operation is target revival; mixed outcomes or unqualified targets fail closed.
- Plugin spell preparation skips only material inventory checking/consumption planning when eligible. Verbal/somatic constraints, ordinary slot/economy, long casting and corpse/return requirements remain in their existing authority paths.
- Formal Resurrection transaction tests cover ordinary materials, target waiver with missing materials, caster-only rejection and silence rejection, retaining strain and slot consumption. Classification tests cover mixed effects, multiple targets with an unqualified member, revocation and missing targets.
- Batch: `npx vitest run src/rulesets/dnd5e/pluginSpellTransaction.test.ts src/rulesets/dnd5e/declarativeSubclassAbility.test.ts src/rulesets/dnd5e/genericCombatPrimitives.test.ts` — 179 passed, session 9006 exit 0. Typecheck session 12935 pending. API calls 0.
- Not yet portable archive/browser certification for this newly added mechanic; keep source diagnostic partial pending those checks and original configuration regeneration.

- Final typecheck: session 12935 exit 0.


## Revival waiver archive and eligibility acceptance (2026-09-28)

- Converted the previous setup-callback waiver fixture into a declared unified feature bundle with Barbarian level >=3 class requirement, installed/uninstalled it, exported/read starmod and registered only the reconstructed bundle before casting.
- Five formal Resurrection cases passed: ordinary materials, target waiver, caster-only rejection (caster independently meets feature class requirement), silence, target below required class level. Existing classification assertions still cover mixed outcomes/targets and revoked ownership. Command: `npx vitest run src/rulesets/dnd5e/pluginSpellTransaction.test.ts -t 'target-owned material waiver'`, session 92793 exit 0.
- No production implementation changed this turn. Previous implementation typecheck session 12935 passed; no redundant full typecheck started for the fixture-only change. New fixture is parsed by the formal bundle validator and exercised through archive reconstruction.
- Review r53 changes only the exact Warrior of the Gods interface diagnostic to expressible; behaviorVerified remains false and configurationStillRequiresRegeneration true. It does not certify the original source conversion or all subclass abilities. API calls 0.


## Equal-value inventory exchange foundation (2026-09-28)

- Added Host-only `applyDnd5eInventoryExchange`: explicit input/output material tags, authoritative catalog values in exact integer copper, chosen coin deductions, inclusive/exclusive value ceiling, revision check, optional retained original matching output template, atomic staged deductions plus grant, durable replay receipt. Rejects bound/temporary/altered/enchanted/ethereal inputs and consumed originals; no guessed material identity or value.
- Local batch `npx vitest run src/rulesets/dnd5e/inventoryExchange.test.ts src/rulesets/dnd5e/items.test.ts`: 57 passed. Synthetic scenarios include valid metal+coins, unequal value, duplicate input, stale revision, absent/consumed original, exact exclusive ceiling and missing output; failure leaves original roster unchanged, JSON-restored replay is deduplicated. Typecheck session 72100 pending.
- This helper is not exposed as a player inventory mutation and has no Activity caller yet. Authorization, one-hour ritual completion, channel-divinity consumption, portable operation schema, UI selection and empty map output location remain required. Output currently stages an inventory grant; full source spell requires a scene object output and must not be declared complete from this helper. Keep Artisan's Blessing review partial. API calls 0.

- Final typecheck: session 72100 exit 0.


## Exchange Activity declaration and direct authority (2026-09-28)

- Added `exchange-inventory-items` Activity operation: declared template, quantity formula and bounded material/value/original policy. Validator checks policy and executor emits a Host-owned proposal once. Direct Activity authority consumes a Host-provided inventory selection using the atomic exchange helper, strips the settled proposal and commits normal Activity costs/effects. Failed final commit does not return/publish the staged inventory. Conflicting inventory mutations in the same execution are rejected.
- Compiled plugin/map compatibility explicitly rejects this operation until wire selection and map handoff are implemented. It is not yet a live player feature and no AI guide claims it is fully usable. This staged restriction must be removed only after those paths are implemented and tested.
- Added direct bridge coverage to the inventory exchange matrix, including final action-commit failure. Initial fixture had one combatant (combat correctly became inactive); corrected the test to use an opposing combatant. Added destroyed input/original rejection.
- Batch `npx vitest run src/rulesets/dnd5e/inventoryExchange.test.ts src/rulesets/dnd5e/activities/dnd5eActivityItemAlteration.test.ts src/rulesets/dnd5e/activities/dnd5eActivityValidation.test.ts`: 92 passed. Typecheck session 38047 pending. API calls 0.
- Remaining: client selection/wire validation, compiler/map Host settlement, ritual clock and resource integration, scene output instead of inventory-only result, original-content conversion and browser evidence.

- Final typecheck: session 38047 exit 0.


## Serializable exchange intent boundary (2026-09-28)

- Added `inventoryExchange` to the Activity command as untrusted selection only: inventory revision, input instance quantities, coin quantities and optional retained original. A strict bounded validator rejects extra policy/value/output fields, duplicate IDs/currencies, fractional/nonpositive or oversized quantities, consuming the original, empty input, malformed IDs and conflicting legacy inventory selection fields.
- Direct authority now reads only the validated wire command, not a caller-side exchange option. Sending exchange data when the resolved Activity has no exchange proposal is rejected. The synthetic direct bridge matrix now serializes/deserializes the command before Host execution.
- Batch command: `npx vitest run src/rulesets/dnd5e/inventoryExchange.test.ts src/rulesets/dnd5e/inventoryExchangeSelection.test.ts src/rulesets/dnd5e/activities/dnd5eActivityCommand.test.ts src/rulesets/dnd5e/activities/dnd5eActivityItemAlteration.test.ts` — 53 passed. Typecheck session 69817 pending. API calls 0.
- Does not enable the compiled map route yet; operation still explicitly unsupported there. Player selector, scene output, ritual clock/resources and browser validation remain outstanding.

- Final typecheck: session 69817 exit 0.


## Atomic scene output staging for exchange (2026-09-28)

- Inventory exchange now accepts a Host-only scene destination: consumes inputs and stamps its durable receipt without granting the output to the backpack. Returns the declared output identity for scene publication. Inventory destination remains the default for existing direct callers.
- Added map staging helper: rechecks actor/character binding, integer bounded cell, actor-footprint distance, occupancy, geometry placement and line of effect before generating a mundane obstacle marker and committing staged inventory. One-cell marker does not assert real item dimensions or HP. Replay uses the persistent receipt, so removed scene items are not recreated.
- Map object state can persist/normalize crafted item template, quantity and receipt identity. Tested empty-space/range/coordinate failures with unchanged roster, valid scene+inventory result, retained copy original, no duplicate backpack product, normalized JSON object metadata and replay after object removal.
- Batch `npx vitest run src/rulesets/dnd5e/inventoryExchange.test.ts src/rulesets/dnd5e/inventoryExchangeSelection.test.ts src/rulesets/dnd5e/mapObjectState.test.ts src/rulesets/dnd5e/items.test.ts`: 78 passed. Typecheck session 21674 pending.
- No live map route currently calls this staging helper; final atomic publication, scene pickup, ritual clock/resource integration, player selection and browser evidence remain required. Compiled exchange remains disabled. API calls 0.

- Final typecheck: session 21674 exit 0.


## Exchange scene output inside Activity commit (2026-09-28)

- Declared optional `sceneRangeFeet` on exchange operations; definition validator bounds it and executor preserves it in the Host proposal. Wire selection accepts only integer nonnegative `{col,row}` targetCell and rejects embedded distance or other fields. The client cannot switch inventory versus scene destination.
- Direct authority consumes a separately Host-supplied current map/token context when the operation declares scene output. It stages geometry-checked map and inventory together, then returns both only after ordinary Activity cost/effect commit succeeds. Inventory-only operations reject extraneous targetCell. Missing scene context is rejected.
- Tests verify success returns one map product, keeps only the copy original in inventory, spends action, and a failed final action commit returns neither map nor inventory. Input map/state/characters remain unchanged.
- Batch `npx vitest run src/rulesets/dnd5e/inventoryExchange.test.ts src/rulesets/dnd5e/inventoryExchangeSelection.test.ts src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts`: 83 passed. Typecheck session 3778 pending. API calls 0.
- Direct Host staging is now integrated; transport publication, compiled player map route, selection UI, scene pickup and authoritative hour-long completion remain outstanding. Existing generic activation supports minute/hour syntax but this does not itself prove a completed ritual; do not claim Artisan's Blessing automatic.

- Final typecheck: session 3778 exit 0.


## Host-owned exchange ritual records (2026-09-28)

- Added persisted pending exchange ritual state to normalized inventory. Host begin resolves the registered Activity and validates the selected exchange without publishing costs/output, captures exact definition/version/selection and start/completion campaign minute, increments inventory revision and returns the revised command. At most one ritual can be pending.
- Minute/hour exchange completion now requires the Host-owned pending record and Host worldMinute, exact content/selection binding and unchanged inventory revision. It can commit outside active combat after that gate; client timestamps are not accepted. Success clears the pending record; Host cancellation clears it with a new revision and no cost.
- Tests exercise one-hour start, save/normalize/reload, no materials charged at start, duplicate start rejection, 59-minute rejection, missing record, inventory mutation, definition change, cancellation and successful inactive-combat completion with scene output. Existing action exchange paths remain covered.
- Batch `npx vitest run src/rulesets/dnd5e/inventoryExchange.test.ts src/rulesets/dnd5e/items.test.ts src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts`: 113 passed. Typecheck session 31655 pending. API calls 0.
- Limitations remain: the strict inventory revision gate conservatively rejects any intervening inventory mutation, rather than tracking only original possession. Automatic interruption wiring for entering combat/incapacitation, client start/cancel UI and transport publication are not yet connected. The clock record alone does not certify uninterrupted activity. Keep source review partial and compiled player exchange disabled.

- Final typecheck: session 31655 exit 0.


## Persisted exchange ritual interruption (2026-09-28)

- Added a pure interruption projection which clears a pending exchange record and advances inventory revision without costs. Character normalization invokes it after condition/effect migration for incapacitated/zero-HP actors, so later recovery cannot restore the previous ritual. Begin/completion separately reject unavailable actors.
- The authoritative combat-start resource entry point clears participating characters' pending exchange rituals. Existing MapsWorkspacePage combat start uses this function and publishes recovered characters in its combat-start transaction; nonparticipating characters retain their state. This exchange flow is currently exploration-only.
- Tests show zero HP, stunned condition and official combat-start recovery each erase the saved record; healed/cleared actors still cannot finish it and retain their materials. Starting while incapacitated is rejected.
- Batch `npx vitest run src/rulesets/dnd5e/inventoryExchange.test.ts src/rulesets/dnd5e/resourceRecoveryArchive.test.ts src/store/characterRulesetMigration.test.ts src/store/characterNormalizationDamageAudit.test.ts src/pages/maps/commitDnd5eCombatResult.test.ts`: 39 passed. Typecheck session 56347 pending. API calls 0.
- Still requires actual start/cancel/complete transport and UI, noncombat voluntary interruption handling, feature resource-specific acceptance and scene pickup. This proves local transition behavior, not a live browser timeline or all fullbook source behaviors.

- Final typecheck: session 56347 exit 0.

## 2026-09-28：制作仪式的 Token / 角色身份绑定

本轮付费 API 请求为 0。上轮只确认批量工作方式，未推进实现；本轮继续补齐实际接入前提。

- 新增 `inventoryExchangeAuthority.ts`，使用 Host 的 Actor 快照关联库存角色，允许地图 Token ID 与 Character ID 不同。玩家命令不提供受信任的库存归属。
- 制作即时提交、仪式开始与完成使用同一身份检查；场景提交在 Token 身份模式下还要求落点计算所用 Token 与执行者一致。
- 合成测试覆盖不同 ID 的实际背包扣除、场景产物、行动消耗和一小时仪式完成；错配库存、错配场景 Token 被拒绝。既有失败原子性测试保留。
- 验证：`npx vitest run src/rulesets/dnd5e/inventoryExchange.test.ts src/rulesets/dnd5e/inventoryExchangeSelection.test.ts`：2 文件、28 项通过；`npm run typecheck`：进程 15551，exit 0。
- 限制：尚未接通玩家制作选择界面和房间开始/取消/完成提交；编译兼容性仍拒绝该操作。此证据不是 PDF 自动转换成功或双端验收，工匠祝福继续保持部分完成。

## 2026-09-28：制作仪式 Host 授权入口

- 新增 `activities/dnd5eInventoryExchangeRitualSettlement.ts`，提供 begin/cancel/complete 的事务准备。验证命令、房间版本、Host 世界分钟、角色关联、注册模块版本与 Activity 使用资格；完成复用已注册 Activity 的权威结算，传递 Host 场景及时间。
- 特性被撤销后禁止开始/完成，但允许取消已保存的同一仪式。返回结果不自行保存/广播，调用者仍需将资源、角色和地图原子提交。
- 合成行为测试覆盖真实 Token/角色分离、开始/完成、提前完成拒绝、错配角色、旧房间版本、特性撤销与免费取消。不是源 PDF 配置转换证据。
- 本地测试：制作/选择/资源恢复 32 项通过；Activity 归属、Headless bridge、休息契约、插件动作 92 项通过。类型检查首次发现重复 characterId 属性，删除重复项后 session 78759 exit 0。
- SDK 文档明确当前仅有 Host 准备接口，尚未连接玩家界面和房间路由，编译限制保留。下一步应复用 pluginFeatureAction/MapsWorkspacePage 中的版本化提交，不另建非原子保存链路。
- 付费 API 请求 0；全书目标未完成，工匠祝福仍为部分完成。

## 2026-09-28：制作仪式地图提交计划适配

- 新增 `inventoryExchangeRitualMapApplication.ts`，从 Host 地图/角色列表重建归属，将开始和取消生成的库存补丁、完成产生的 Headless 资源变更与地图产物转换为现有 `Dnd5eMapResultPlan`。
- 完成计划显式保留库存 patch 和新产物 changedTokenIds，使房间提交器不会漏掉制作结果。地图缺少战斗快照 Token 或存在重复 Token ID 时提前拒绝。
- 合成测试实际调用现有插件 rebase：无冲突可接收；角色并发修改或产物 ID 冲突拒绝。地图几何/落点并发仍要求房间整体版本校验，不能仅靠逐实体 rebase。
- `inventoryExchange.test.ts`、`pluginFeatureAction.test.ts`、`commitDnd5eCombatResult.test.ts` 共 60 项通过。首次用例缺少敌方地图 Token，修正完整地图夹具并增加快照不匹配拒绝用例。类型检查发现 token 空值收窄问题，修复后 session 70827 exit 0。
- 尚未连接实际 pluginFeatureAction 分支、MapsWorkspacePage 版本化发布或玩家制作界面。新函数当前是经过本地验证的适配接口，不代表房间链路已完成。下一步需同时处理计时能力的动作适配与编译门禁，不能只移除 unsupported 标记。
- API 调用 0；全书目标继续，源配置自动转换和双端验收均未新增通过声明。

## 2026-09-28：制作仪式插件处理分支与房间版本捕获

- `inventoryExchangePluginAction.ts` 解码 begin/cancel/complete 的纯选择载荷；时钟、战斗状态和提交版本均从 Host 取得，禁止附加可信结算字段。新请求通过保存的 ritualId 继续原仪式。
- `resolvePreparedDnd5ePluginFeatureAction` 已调用该分支并返回统一地图提交计划。探索快照内部 active=true 不再误判成真实战斗；Host 明确提供实际 combatActive，战斗中拒绝开始/完成。
- MapsWorkspacePage 将该请求纳入既有 characters/maps/combat/campaign-time 版本捕获及确认发布参数，传递 Host 时间和真实战斗状态。未操作任何真实房间。
- 本地边界用例通过插件 resolver 验证开始、跨请求完成、库存扣除及场景产物；缺少 Host authority、真实战斗中开始、夹带时钟字段拒绝。该夹具从 prepared 层开始，尚未覆盖玩家按钮/模块编译准备层。
- 三个测试文件共 60 项通过；类型检查 session 61634 exit 0。付费 API 请求 0。
- 仍保留 exchange-inventory-items 的编译拒绝；下一步是计时能力动作适配、制作选择 UI、注册模块往返及隔离房间真实验收，不能把此次处理器接线当成全流程完成。

## 2026-09-28：制作材料选择器

- 新增 `components/map/inventoryExchangeChoices.ts`，复用现有名称选择、多选及数量控件。原件独立选择且不列入耗材；材料与五种货币可组合选择，显示库存数量、单价及制作所需总价值。
- 候选排除附魔、临时/变形物品、已装备耗材、含物品容器、摧毁或异界物品。完成选择后调用同一等值交换规则做纯预检，丢弃其暂存结果，不扣除资源；Host 仍需独立重验。
- 新增选择器到 Host 原语的本地验收，取消/超量返回空且角色不变。三个测试文件共 25 项通过；类型检查 session 90089 exit 0。
- 选择器当前尚未挂到实际地图按钮。还需完成计时能力按钮适配、持久仪式恢复选择、地图落点交互及编译门禁收敛后，才能进行可导入模块和双端验收。不得把独立选择器称为已完成玩家流程。
- API 请求 0；未改动 5273/5274 房间。

## 2026-09-28：制作选择接线与保存后继续

- `dnd5eInventoryExchangeSavedSelection` 严格读取持久仪式中的材料选择，检查结构与 inventoryRevision；损坏数据拒绝，不猜测材料。
- `requestInventoryExchangeRitual` 支持开始/已有仪式取消/到时完成，恢复原选择；未到时不提供完成。取消不请求地图落点，取消点选则不提交。
- MapsWorkspacePage 插件发送入口已接选择流程；完成复用 beginDnd5eActivityCellTargeting 的地图点选，不要求玩家输入坐标。地图/房间切换或进入战斗会取消尚未提交的选择。战役时间缺失时明确提示，不能默认 0。
- 25 项本地测试通过，包含 JSON 往返继续、未到时拒绝、取消与损坏记录。类型检查初次暴露 worldMinute 可空，修复后 session 99906 exit 0。
- 尚未解除编译器 exchange 操作限制，FeatureActionAdapter 也尚不投影 minute/hour 计时能力。下步必须同时完成正常内容注册→按钮→prepare→resolve 的验收，不能只测试 handcrafted prepared 数据。
- API 请求 0，真实房间未修改，全书目标仍未完成。

## 2026-09-28：计时制作的注册/按钮/正常 prepare 路径

- 新增 `dnd5eInventoryExchangeProfile.ts` 明确当前可开放的形状：minute/hour、自身、单一 always 交换操作、无 choices/checks/scaling、非 spell、仅确定性资源消耗。其余组合继续列缺口，不能将本次范围等同全部制作机制。
- 编译兼容性允许该形状，FeatureActionAdapter 投影 economy none；编译后的普通 resolve 明确拒绝直接即时执行，必须由插件制作分支走持久仪式及 Host 时钟。
- 新增真实活动和特性注册测试，经过 prepareDnd5ePluginFeatureAction 后开始，保存/读取角色，再以正常准备请求完成。引导神力和金币开始时不扣，完成时各扣一次，地图生成产物。另验证普通 Headless 直接调用拒绝且资源不变。
- 42 项相关本地测试通过。测试先后修正资源消耗 formula 夹具与 Headless 导出函数名；类型检查最终 session 65206 exit 0。
- 此次尚未做该配方的 starmod 导出再安装，也未运行隔离浏览器的完整双端操作。复杂配方、特性撤销后的 UI 取消可达性与源配置自动生成仍需收敛。
- API 调用 0，未修改现有房间，全书目标继续进行。

## 2026-09-28：制作模块 starmod 往返与自动按钮修复

- 将正常制作流程验收扩展为直接注册、显式 action 的 archive、推导 action 的 archive、短物品 ID archive 四种路径。后三种实际调用 exportDnd5eStarMod/readDnd5eStarMod，再由统一内容安装器注册，全程执行正常 prepare/resolve。
- 测试发现推导按钮路径 feature-unavailable：机制目录未登记 exchange。现登记操作处理器，并按已验证的 ritual profile 判断是否 handled，其他形状仍报告缺失。不是简单把所有 exchange 标签改为 full。
- 统一内容运行时物品引用转换新增 exchange 模板；短 ID 仅在安装副本中补全，签名归档/原 bundle 保持不变。
- 62 项相关本地测试通过，类型检查 session 10475 exit 0。测试覆盖资源与金币在完成时消耗、场景产物、普通即时入口拒绝。
- 证据范围仍为合成模块。原始 PDF 条目配置未重新生成，隔离浏览器双端尚未验收；复杂制作配方与产物拾取等仍待完成。API 调用 0，现有房间未改动。

## 2026-09-28：隔离双端揭示原生临时房间包缺口

- 新建私有合成 `crafting-room-module-20260928.json`、`.codex-logs/crafting-room-20260928.spec.ts/config.ts`；Playwright 启动独立 6773/6774，STARS_SHARED_ROOT 为新临时目录，不访问现有房间。目标为上传/同步、玩家材料选择、Host 仪式记录、刷新取消；当前未通过。
- 首次夹具 local-only，被房间分发策略正确拒绝。改为自编内容 room-ephemeral 后失败；第三次导出测试误将 ArrayBuffer 直接 Array.from 得到空数据，第四次已改 Uint8Array 并检查非空。所有请求均未调用 AI。
- 最终 session 53980 exit 1：有效原生 starmod 上传后仍报 The selected file is not a V2 content package。实际原因不是 native JSON/ZIP 本身不被识别，而是 DmWorkshopPage 的 room-ephemeral 分支调用 dnd5eRoomRuntimeProjectionBytesV2；它只接受旧内容包。RulesPluginsPage 同样调用旧函数。
- 服务端 scripts/shared-server-core.mjs assertDeclarativeRoomPluginManifest 虽接受 unified format，但 ephemeral 校验只允许 format=dndstars5e-content/schemaVersion=2/provenance.projection。客户端和服务器均需新增原生统一包的去原文运行投影；不能仅在 UI 绕过策略或将原文包伪装可分发。
- 证据：私有 crafting-room-audit-20260928.json、-r2/-r3/-r4.json 各轮步骤为空；最后失败 trace/screenshot 位于 test-results/crafting-room-20260928。后续重跑可能覆盖 Playwright 临时输出，关键错误和原因已固定于本文。所有进程本轮均已终止，无运行中等待。
- 下一步实现原生 ephemeral projection（去说明原文和来源信息，保留结构化机制/依赖/图片的现有约束），并做服务器拒绝未缩减原文的测试，再重跑隔离双端。完整制作/全书目标均未达成。付费 API 请求 0。

## 2026-09-28：原生临时包与真实制作入口收敛

- 用户要求继续按机制批量实现，付费 API 留到整体稳定后的集中验证；本轮付费 API 请求 0。使用现有合成配置和本地测试，不重新转换原 PDF。
- 新增 roomRuntimeProjection.ts，支持统一原生包的 room-ephemeral 运行副本；移除定义 source、替换说明原文、保留机制，原始包不变。DmWorkshopPage、RulesPluginsPage 接入统一投影；服务端新增标记、原文及来源校验，并保留关闭房间清理。
- 内容相关 51 项测试通过；HTTP 临时包 5 项通过。额外补充 source 移除断言后单测再次通过。类型检查 session 67104 exit 0。
- 隔离双端 r5 已通过上传/玩家激活，但制作材料窗口未打开。发现非战斗状态使用空的持久先攻列表构建角色快照，改为地图生物的临时投影，仅用于数量计算，不启动战斗。
- r6 已通过开始仪式且金币未扣除，并恢复刷新后的仪式窗口。测试因精确按钮名称未包含说明文字而超时；修正测试选择器并设置动作 15 秒超时，未为该测试问题修改产品逻辑。
- r7 Playwright session 60432 exit 0（1 passed）：原生 starmod 上传、玩家激活、材料选择、Host 保存仪式、刷新恢复、取消且金币不变。私有证据 crafting-room-audit-20260928-r7.json；synthetic=true、automaticSourceConversion=false、fullBookCertified=false、errors=[]。测试仅使用独立临时目录及 6773/6774，未访问真实房间。
- SDK 制作章节改为当前状态，移除多个阶段互相矛盾的旧说明。浏览器完成制作/地图产物仍需验证，拾取尚未实现；本轮不增加源条目已认证数量，全书目标仍未完成。

## 2026-09-28：制作完成双端验收与转换协议补充

- 上轮属于 progress：实际修复原生临时包与非战斗制作入口，并通过隔离上传/开始/刷新/取消。本轮继续目标，不重启已结束进程，不调用付费转换。
- 扩展私有 Playwright 合成用例，在取消后重新开始、以 DM 权限推进隔离房间时间，玩家选择完成及地图落点。session 3014 exit 0，1 passed（56.4 秒）：Host 清除仪式、金币 5→0、产物只出现在所选 275/225 位置、数量 1、玩家地图仓库同步。原测试的开始/刷新/免费取消断言一并通过，pageerror=[]。
- 私有证据 crafting-room-audit-20260928-r8.json 明确 synthetic=true、automaticSourceConversion=false、fullBookCertified=false。本次浏览器未重发完成命令，不能据此独立宣称网络重放验收；底层耐久收据已有单测证据。
- 发现 AI SDK 只包含 exchange 操作引用，未展开 Dnd5eInventoryExchangePolicy。现从真实接口提取类型并补充铜币单位、边界、标签、原件、延时原子结算、支持 profile 与固定配方限制，防止模型发明字段或将自由制作误报为 full。SDK guide 16 项本地测试通过；该变更只增加 raw 类型文本与说明，无付费 API。
- 生成 review r54、coverage r51：工匠祝福保留 partial，更新已完成的运行证据，并明确自由产物/形状选择及原书配置尚未认证。统计保持 155 条、840 个诊断、90 已审、856 未审关联、15 partial、72 expressible；未以合成流程提高源资料完成率。
- 全书目标未完成。下一阶段应优先按类别集中核查剩余诊断并补齐通用能力，不逐条调用模型；当前制作 profile 的任意产物选择与拾取仍是明确边界。真实 5273/5274 房间未改动，付费 API 请求 0。

## 2026-09-28：批量转换提示的跨文件类型完整性

- 上轮为 progress：制作完成真实隔离双端通过，更新运行边界与 review r54。本轮保持 API0，按机制检查公共转换契约，不对原始配置逐条手改或逐条付费重试。
- 检查真实 Activity 契约发现四个未展开的跨文件类型：Dnd5eSummonLingerPolicy、Dnd5eActivityBasicActionGrantActionV1、Dnd5eSpellAuthorityRecordKindV1、SymbolMode。AI 只能看到文件引用，无法读取本地模块，容易猜错字段。现在从真实源码提取闭合声明，SymbolMode 同时附带 SYMBOL_MODES，提取边界缺失时直接报错。
- 新增通用检查：扫描 Activity 所有 import(...).Type 内联引用，确认生成提示包含对应 type/interface 声明，覆盖 spell、feature、focused-feature。检查实际抓到精简 feature 路径删除 Dnd5eSpellbookSchoolId 的问题；现删除大型法术契约时保留学派枚举。
- localContentAiSdkGuide 与 localContentMechanismPlan 共 23 项通过。该证据只证明所测跨文件内联类型依赖被提供，不等于所有普通 import 或整套提示已完全闭合，更不代表任何原书条目自动转换通过。
- 未触碰真实房间，未调用付费 API；全书目标保持未完成，源条目认证数量未提高。后续继续集中核对普通类型导入与剩余机制，不把配置错误诊断直接转成通过。

## 2026-09-28：Activity/Effect 普通类型依赖检查

- 上轮属于 progress：修复内联类型引用及精简提示中的学派枚举。本轮检查 Activity/Effect 普通 import type 依赖，发现 spell 提示缺少 Dnd5ePluginStaticCombatModifiers，而 Effect.character-capability 的 naturalWeapons 引用了该类型。
- 将真实静态战斗修正接口移入共享提示；feature 协议部分移除重复接口，避免增加同一路径的重复上下文。保留实际字段定义，不另写猜测类型。
- 新测试扫描 Activity/Effect 的直接导入，在普通法术与特性含区域提示中检查声明或明确基础枚举。DeclarativeSubclassAbilityV1 在法术 Activity 中仅由禁止生成的 Host authorityBinding 引用，测试明确排除并验证禁止说明；不因此把全部子职实现放进法术提示。检查范围不涵盖递归依赖或所有精简区域分支，不能泛称完整协议闭合。
- SDK/机制计划 25 项通过；转换导入 mock 测试 32 项通过；类型检查 session 22963 exit 0。未调用付费 API，未生成或改写原书配置，未接触真实房间。
- 全书目标仍未完成。此次修复减少转换契约缺定义的系统性原因，不增加源条目认证数量。

## 2026-09-28：全书离线预检刷新与完整修复反馈

- 上轮属于 progress：公共提示类型补齐及测试、类型检查完成。本轮重新读取离线 runner，确认只预检 exact-source、manualContentRepairs=false 的自动草稿，不调用模型。
- preflight r11：155 条仍为 32 ready-for-behavior-tests、122 blocked、1 no-parseable-current-source-draft。与 r10 的状态及逐候选 issues 完全一致；新增 248 份候选 spellEntryAudit，不宣称原配置自动得到修复。
- 生成 backlog r11；核对 entries/issues 与旧 backlog 完全一致后，将 source-scoped review r54 迁移为 r55，生成 mechanism-batches r5。保留 840 个诊断、874 未解决关联；其中 535 mechanism/evidence、28 cast-entry、22 execution-binding、221 status-marker、68 manual-boundary，follow-up-link 已审未解决数为 0（并非源行为全通过）。
- 新增 pdfSpellRepairFeedback，实际 PDF 导入器使用它合并并去重错误，同时在无有效根入口时提供逐 Activity 机器拒绝原因；存在合法根入口时不把正常受授权/触发的后续活动当成施放入口错误。完整保留不同 unsupported，函数不更改草稿或预检。
- 发现转换器此前将修复反馈截成 2000 字。现把完整诊断放入 host-validation-feedback 数据附件，提示明确其不是指令，不复制同一错误到提示正文；估算输入 token 加上诊断长度。超过 5000 字的本地 mock 验证尾部错误与完整被拒草稿都保留，无实际 API。
- repairFeedback/Headless preflight 17 项通过；PDF 页面接入与 helper 的类型检查 session 51457 exit 0。随后改为完整诊断附件的 localContentAiImport 与 helper 共 34 项通过；该最后一次附件改动未重复整仓类型检查，后续公共批次一并核查。
- 全书目标未完成；原配置未改写、真实房间未改动，付费 API 请求 0。

## 2026-09-28：连续导入改为批次轮转重试

- 上轮属于 progress：全书离线预检 r11 与入口诊断接入，修复完整反馈被 2000 字截断。本轮按用户的批量工作要求检查实际导入器，原实现对每条内容连续尝试完 3 次才处理下一条。
- 新增 pdfImportAttemptOrder 并接入 PDF 页面提取与内容转换：先遍历全部待处理项，再轮转重试失败项；每次 yield 前重新读取完成状态，成功项不重复；完成目录前仍不开始草稿生成。保留提取最多 2 轮、转换最多 3 轮、逐项保存、暂停检查和单项显式重试。
- 调度器不自行发请求、不更改草稿或认证状态；界面说明每次连续处理的轮次上限，并继续保留任务数不是模型调用数/费用上限的提示。此次没有改变模型内部 fallback/retry 策略，也不宣称实测节省了多少费用。
- 队列/缓存/修复反馈共 12 项通过：覆盖 A/B/C 首轮优先、成功项跳过、顽固失败仅到上限、取消后不继续、恢复使用保存结果。类型检查 session 51530 exit 0，覆盖上轮最后的完整诊断附件修改及本轮页面接入。
- 尚未进行真实 AI 批量调用；付费 API 请求 0，既有房间和源转换产物未修改，全书目标未完成。

## 2026-09-28：非施法魔法状态的显式来源标记

- 上轮属于 progress：批次轮转调度与类型检查完成。本轮根据 batch r5 选取明确剩余机制，核查“匿影无踪”的魔法来源缺口，未进行逐条付费转换。
- 发现 unified Effect 没有独立魔法标记；executor 仅凭 periodicDamage.magical 标记非施法效果，虽然 Host 提交器已能接受 proposal.magical。新增 Effect.magical?:true，执行时保留该标记；未改变 legacySource，不将特性伪造成法术，法术默认魔法性质不受影响。
- 校验拒绝 false、字符串及数值伪标记。合成注册 Activity 经实际 Host authority/commit 后得到 invisible ActiveEffect，JSON 重新读取保留 magical=true；省略字段仍为非魔法，来源不是 spell、无伪造环级。
- 首轮 E2E 新用例因复用 beforeEach 已注册的包 ID 失败，既有 96 项通过；改用独立测试包后两个新用例通过。最终校验及 SDK 共 85 项通过；类型检查 session 95027 exit 0。
- AI SDK 说明该字段只负责状态来源，不自动提供反魔法区域使用限制、反应时机、环位或解除魔法资格。review r56/coverage r52 将且仅将对应魔法标记诊断记为当前接口可表达；91 reviewed、855 unreviewed links、73 expressible，未改变源条目认证。原专长仍需自动再生成及完整流程验收。
- 付费 API0，原 PDF 转换配置及真实房间未改动；全书目标未完成。

## 2026-09-28：魔法特性状态的地图压制与恢复验收

- 上轮属于 progress：Effect.magical:true 与 Host 来源分类实现并通过类型检查。本轮延伸同一真实注册 Activity/Host commit 用例，不再手工构造已带魔法标记的最终状态冒充转换链路。
- 将提交后的 magical/ordinary invisible 状态 JSON 读取，再 normalizeCharacter，进入真实反魔法区域的 mapBridge 快照：魔法隐形不可用，普通非魔法隐形保持。经 planDnd5eMapResultApplication 保存并再次 JSON 读取后移动出区域，隐形恢复且原持续时间不重置。
- 两个参数化用例通过（同文件其余 36 项未重复执行）。仅扩展测试，生产代码未改，未重复整仓类型检查。此次证明地图压制/恢复，不证明魔法能力在压制区域内的初始发动门禁或完整原专长反应规则。
- 原始配置和真实房间不变，付费 API0，全书目标仍未完成。


## 2026-09-28：随机方向位移的 Host 地图结算

- 上轮仅重申批量工作约束，属于 no progress；本轮继续实际接口实现，付费转换门槛保持关闭。
- Activity move 新增 cardinalDirection（north/east/south/west），仅允许不消耗移动力/反应、不引发借机攻击的 forced 模式。Executor 保留方向；地图 Host 从目标位置推导整格落点，不接受施法者替换方向。三处交互入口跳过此类手动选点。
- 地图使用既有路径、墙体、占用与完整体型校验。方向受阻时留在原地并正常结算，不重新随机或选择其他方向。按地图整格分辨率截取距离，SDK 明确相关语义。
- 合成用例经 JSON 重读 Activity、真实随机表 Executor、地图提交，覆盖四个骰值、伪造选点被忽略、目标格占用及墙体阻挡、无借机攻击和原地图不变；另有字段组合拒绝测试。最终方向/随机表 15 项通过，方向/SDK 31 项通过；此前地图/校验既有 137 项通过。新用例首轮因缺少目标距离快照失败，补齐合成输入后通过，未为测试绕过产品校验。
- 类型检查 session 60187 exit 0，之后仅调整 UI 注释缩进。仍需补齐并验证失败豁免后再骰方向及目标速度资格的组合，不能将虫群孳生或对应来源诊断升级为完整支持。原始转换配置与源认证统计不变。
- 未访问真实 5273/5274 房间，未调用 API；全书目标保持 active，尚未完成。


## 2026-09-28：条件随机表触发路径与速度资格

- 上轮为 progress：随机方向字段、地图结算、SDK 与相关测试已完成。本轮保持 API0，继续检查多条调用链，未将局部地图支持视为完整原书法术完成。
- 发现触发窗口的随机表始终掷骰，没有应用既有 appliesWhenCheckTotal；公共声明过滤器也只匹配 per-target。现触发路径复用过滤器，以 Host 已掷骰值和声明 modifier 构造前置总值；过滤器支持 shared/per-target，并拒绝非有限总值。保留未满足条件的分支不掷骰。
- 新合成触发测试覆盖 shared/per-target、三阶段分支、前置 modifier、同一批目标不同结果、未提供及 NaN/Infinity 总值。测试首轮因缺少 outcome 不符合契约而失败，补齐合成最终操作后通过，未放宽产品校验。
- 新增 speed predicate（actor/target、四种比较、非负尺数阈值）；只读取有限已知速度。可放在 outcome 中，仅关闭移动分支而保留伤害。触发前置检查同步识别；AI SDK 说明不能错误地用根 requirements 拒绝整个施放。
- 检查发现 CombatAuthority 已取有效速度，Headless 内部 Activity 快照仍取基础速度；统一为 dnd5eEffectiveSpeed。测试验证束缚为 0、解除恢复基础 30 且不覆盖原速度，以及未知/非有限/负速度不能满足移动条件。
- 第一批 103 项通过，Executor/逐目标骰/虹光喷射/方向回归 90 项通过；补充混合目标后条件触发 4 项再次通过。首轮类型检查 27774 找出测试攻击事件缺少 mode、新 predicate 缺日志标签，均已修复；复查 46785 在本记录写入时仍运行。
- 本轮没有完成 saving-throw 成败作为随机表前置条件的全链路扩展。后续需统一施法、特性、触发三个入口及 Host 骰池验收，不应仅修改 Executor 后宣布支持。源条目认证、原始转换配置与真实房间均未改动，全书目标仍 active。

- 类型复查 session 46785 已结束，exit 0；未启动付费转换。


## 2026-09-28：豁免结果控制后续随机骰

- 上轮为 progress：条件随机表触发路径与速度资格完成。本轮继续通用条件掷骰，未调用模型或改写来源配置。
- random-roll 新增 appliesWhenSave（checkId、success/failure），限制引用前面的 per-target saving-throw，并要求随机表同为 per-target；可以与随机表总值条件共同使用。Executor 只在已结算豁免匹配时执行随机检定，缺失结果不当作失败。
- 新增 SaveGate helper，复用真实 saving-throw preview，不另写豁免算法；公共骰声明过滤器接收同一结果回调。施法入口把此类随机骰推迟到豁免之后；特性入口改为条件就绪的批次循环；触发收集器和 Headless 精确骰池校验同步接入。Host 的已知自愿失败目标被传入同一判断。
- 新用例验证多目标成败隔离、触发时仅失败目标骰随机表、优势/劣势、自愿失败、免疫自动成功、非法前置引用。实际注册编译包的 Host 测试验证失败缺骰与成功多交骰均拒绝且原状态不变；合法输入仅失败者受伤。
- 新 Host 测试首轮因缺少战斗距离快照被 invalid-target 拒绝，补齐测试的权威距离后通过，未降低校验。批量测试进一步抓到 preview 的 Host 模式映射遗漏，补齐 checkRollModes 后修复；并非仅改变测试期望。
- 第一批 108 项中 106 通过、2 项模式用例失败；修复后的 gate/真实 CombatE2e/条件触发/随机表 56 项全部通过。首轮类型检查 68028 exit 0；最终 helper 修复与缩进调整后的类型复查 31546 在本条记录写入时仍运行。
- 此证据不包括浏览器双端验收，也未将源资料条目改成已认证。原书完整随机移动机制还需组合豁免、速度、伤害与地图位移的来源行为验证及集中重新转换。付费 API0、真实房间不变，全书目标 active。

- 最终类型复查 session 31546 已结束，exit 0。


## 2026-09-28：攻击、豁免、随机表的多阶段前置条件

- 上轮属于 progress：豁免门控随机骰已接入多个入口并通过测试。本轮检查嵌套前置条件，发现 SaveGate 只看豁免骰，没有确认该豁免所依赖的攻击确实启用并命中；触发收集器也未处理原有 appliesWhenChoice/appliesWhenCheck。
- 新增复用实际攻击 preview 的 gate helper；SaveGate 遇到未执行或未命中的前置攻击返回 undefined，不把客户端提供的多余失败豁免视为有效结果。触发路径在请求骰子之前检查攻击/豁免模式，以及豁免的前置攻击结果。
- 新回归覆盖禁用模式与未命中攻击，以及两个目标分别命中/未命中的 attack→save→random-table 顺序；只命中且豁免失败者继续掷表。第一批条件相关 24 项通过。类型检查 73066 指出新增合成攻击缺少必需 rollMode，补 normal 后该文件 14 项再次通过；复查 20977 写入本记录时仍运行。
- review r57/coverage r53 将且仅将虫群孳生的随机移动组合诊断记为 partially-addressed-by-current-runtime：方向、阻挡、速度、豁免门控已有通用接口与合成证据；仍缺原始配置再生成、完整来源组合行为、速度为零时跳过方向骰、导出导入及浏览器双端证据。没有把原书条目认证或自动化等级直接改成通过。
- 覆盖报告为 155 entries、840 distinct diagnostics、92 reviewed diagnostics、854 unreviewed links、16 partial、3 source correction、73 expressible，122 entries awaiting mechanism review、1 awaiting batch regeneration。此次只是来源作用域内的审阅进度，非完成法术数量。
- 无 API 调用，未修改原始生成配置或真实房间；全书目标仍 active。

- 类型复查 session 20977 已完成，exit 0。


## 2026-09-28：随机骰池的目标有效速度资格

- 上轮属于 progress：多阶段攻击/豁免/随机表前置条件修复并更新部分审阅。本轮新增 random-roll.minimumTargetSpeedFeet（仅 per-target、有限非负阈值），可与豁免和总值门控组合。速度未知、非有限或不足时不请求随机骰，但不取消独立伤害 outcome。
- Executor、公共骰池过滤、施法和特性入口、触发收集及 Host 精确骰池验证均接入有效速度。SDK 说明不能用根 requirements 替代分支资格。
- 编译 Activity 的 actorSnapshot 仍读取基础速度，改为 dnd5eEffectiveSpeed，与 CombatAuthority 和 Headless 预检快照一致；未改动 sandbox 的原始战斗数据字段语义。
- 初始速度门控 27 项通过；扩展真实束缚场景后失败。临时诊断发现测试直接添加 conditions 标签被 Host 状态投影清除，因此改用 applyDnd5eStandardConditionEffect 建立实际持续状态，不放宽状态同步或骰池校验。诊断日志已移除。
- 最终 28 项 SaveGate 测试通过：实际注册编译包中正速度/束缚、成功/失败豁免的组合；失败伤害仍提交、零有效速度无随机骰和移动 handoff；多交或缺失随机骰被拒绝且原状态不变。另覆盖触发收集器束缚分支、未知速度及非法阈值。
- 较早的批次其余 109 项（方向、速度、CombatE2e、SDK 等）通过，失败的唯一 SaveGate 用例随后在最终 28 项中通过。类型检查 17585 写入此记录时仍运行。
- review r58 更新同一来源诊断的证据，仍为 partially-addressed，未提高原书认证数量。未重新生成配置、未访问真实房间、API0，全书目标 active。

- 类型检查 session 17585 已完成，exit 0；coverage r54 的计数与 r53 保持一致，仅更新同一 partial 诊断的证据。


## 2026-09-28：随机移动组合机制的模块往返验收

- 上轮属于 progress：最低有效速度筛选和编译快照修复完成。本轮仅新增组合验收测试，未修改生产代码或原始自动草稿。
- 新增 dnd5eRandomMovementArchive.test.ts：明确合成的原生模块通过 exportDnd5eStarMod/readDnd5eStarMod 真实二进制往返、注册、卸载及重新安装。逐字段确认 Activity 的门控、速度阈值及方向声明保留，不依赖先前安装残留。
- 七个场景全部通过：北/东/南/西、东向墙体阻挡、豁免成功、真实束缚效果。实际编译 Host 提交验证伤害、动作消耗、源状态不变；随后实际 map handoff 验证目标位置、不触发借机攻击、阻挡不撤销伤害，并检查 JSON 保存后的 HP 与位置。
- 本测试是合成 feature 的模块接口组合证据，不是原书法术自动转录、玩家学习或浏览器双端认证。未改动现有房间，API0；仅新增测试，未重复整仓类型检查。
- review r59 将同一 be7f0a5042f6 诊断升级为 expressible-by-current-runtime，behaviorVerified=false、configurationStillRequiresRegeneration=true 保持。不将这个机制判断扩展到该条目的其他诊断，也不增加原书预检或行为验收数量。全书目标 active。


## 2026-09-28：一次攻击批次后的唯一收尾动作

- 上轮为 progress：随机移动模块往返测试完成。本轮回到全书旧诊断，核查钢风斩的攻击后传送关联；发现已有 Host 历史与目标附近传送接口，但 continuation 最小两步且必填 nextActivityId，不能直接表达一次完整批次之后只提供收尾。
- continuation 新增单批次终结形态：maximumSteps:1 必须有合法 finishActivityId，此时可省略 nextActivityId；普通链仍要求 next 与有效次数，缺 finisher 的一步链被拒绝。准备阶段只校验已声明的下一步，终结动作仍要求正确根绑定且不能继续创建 continuation。
- 同步更新 pattern 展开、原生/旧包授予控制收集、法术活动可达性，以及 AI SDK 提示，避免转换器生成永远不用的假攻击步骤。
- 扩展真实编译 Host 测试为一批两个攻击，分别测试首目标命中/未命中，另一目标命中；收尾使用全部 Host 目标历史，忽略伪造 payload，收尾后清除授予。此前用例只有无攻击的恒定效果，不能证明命中/未命中目标均被保留。
- 连续步骤、可达性、SDK、原生内容相关 70 项通过。首轮类型检查 41017 发现上轮新增归档测试的 controller 写成 players（应为 player），已改正，归档 7 项重跑通过；类型复查 18088 在本条写入时仍运行。
- review r60/coverage r56 将对应 e5e93422eca627ec 诊断记录为 partial；联合原书行为、可见性、归档与浏览器双端仍未认证。155 entries、840 diagnostics、93 reviewed、853 unreviewed links、16 partial、74 expressible、3 source correction；原书配置及验收完成数不变。
- API0，真实房间未改；全书目标 active。

- 最终类型复查 session 18088 exit 0，覆盖当前生产修改及上一轮归档测试。

## 2026-09-28：单批次收尾的真实模块归档验证

- 将合成攻击批次的测试改为 exportDnd5eStarMod/readDnd5eStarMod 二进制往返，并通过原生 unified content 插件注册，不再在测试中手动注册每个 Headless action 和 feature。
- 初次运行发现测试将收尾 action 错当成独立 feature，传入不存在的 local.advanced:finish，Host 正确拒绝 invalid-plugin-action。修正为原生模块的拥有者 local.advanced:root，未修改生产授权检查。
- 合并运行 advanced patterns、distinct target continuation、random movement archive：3 文件 24 项全部通过。归档后的收尾保留全部攻击目标（包括未命中目标），忽略客户端伪造的目标历史，并清除后续动作授予。
- 本轮仅修改测试与记录，不重复全仓类型检查。此证据仍为合成模块接口验证，不是原书钢风斩自动生成、可见性或双端浏览器验收。原书完成数量不变，API 调用 0，付费转换门槛继续关闭。

## 2026-09-28：弹药绑定的物理可用性

- 上轮为 progress：真实归档收尾测试完成。本轮核查火箭 6638a5bfe6cec853 诊断，确认普通武器攻击、猎人多重攻击和墙体攻击已有库存弹药扣除入口；attackUses 是附魔次数，不应在归零时删除整袋剩余箭矢。
- 发现实际缺口：普通弹药选取只检查数量，不排除以太位面、已释放或不可取用容器中的箭矢。新增共用 dnd5eAmmunitionEntryAccessible，检查完整容器链，并用于附魔箭袋快照、普通弹药扣除与按攻击消耗的临时投射物。
- 首轮 59 项中 2 项失败，原因是库存规范化会修复缺失或循环容器链接。调整攻击可用性判断读取原始容器链，避免攻击本身将不可用弹药修复成可用散装弹药；不改变一般库存规范化行为。
- 库存、弹药绑定、临时武器 59 项通过；最终修改后武器攻击、猎人多重攻击、墙体攻击及临时武器 68 项通过。两个批次有重复测试，不将其相加作为独立用例数。类型检查 session 94466 正在运行。
- 火箭原始配置的自动生成及完整附魔次数/弹药数量联合流程仍未认证，本轮不提升原书完成数量。API0，未操作现有房间。
- 类型检查 session 94466 已完成，exit 0。review r61 / coverage r57 增加该来源的 partial 记录：94 项诊断已审阅、852 个关联仍待审阅；不将已有库存消耗入口误计为完整法术认证。

## 2026-09-28：附魔次数与实际弹药的联合结算

- 上轮为 progress：弹药物理可用性修复通过。本轮新增真实 prepare/resolve equipment attack 组合用例，明确合成来源，不手工覆盖原始生成配置。
- 分别从 1/2 次附魔余额出发，检查命中与未命中均只扣 1 支箭和 1 次附魔；命中 HP 包含火焰 rider，未命中不受伤。最终一次附魔结束后仍保留 19 支箭与箭袋，JSON 保存恢复后下一次攻击无火焰 rider。非法伤害骰提交失败，不产出 application，原始库存与效果不变。
- 武器攻击与弹药绑定合并 61 项通过；SDK 21 项通过。转换指南与 SDK 文档说明 attackUses 不代表清空库存，不应另外生成整袋删除操作。本轮无生产结算修改，不重复整仓类型检查。
- review r62 / coverage r58 将 6638a5bfe6cec853 对应来源的库存消耗不确定性升级为 expressible；behaviorVerified=false、configurationStillRequiresRegeneration=true 不变。完整原书生成、模块导入和浏览器认证尚待集中验收，原书完成数量不增加。API0、真实房间未改，全书目标继续 active。

## 2026-09-28：自主召唤的最近可见目标约束

- 上轮为 progress：弹药联合结算验证完成。本轮发现失控恶魔的最近非恶魔规则不能复用于最近任意可见生物；新增 summon.autonomousBehavior:"attack-nearest-visible"，贯通契约、校验、执行提案、地图 handoff、召唤创建、地图迁移、自动回合和 Host 攻击目标限制。与 commandPolicy/controlSave/cannotAttack 冲突时拒绝。
- 目标选择重建包含地图生物的权威快照，采用 Headless 可见性；保留并列最近目标，移动候选按新位置重新判断，不排除同阵营或恶魔。缺少可见目标时防御。生成快照不能传空先攻清单（会缺少战斗员），初次失败后已修正。
- 实际持续隐形与失明测试覆盖可见性；原始 conditions 标签会被状态投影清理，因此使用真实条件 Effect。测试又发现距离零时默认 0 尺特殊感官被误判为存在，修正 specialSenses 的正范围条件和 Headless 临时真实视觉判断；未改动隐形规则来迁就测试。
- 先前 64 项召唤与生命周期通过；最终扩大回归的 summonAutomaticTargets、SummonAndItemRouting、headlessCombatEngine、specialSenses 共 353 项通过。额外 SDK 21 项、上轮武器测试本轮 54 项通过。类型初查 35299 发现上轮测试多传 actor 参数，已修正；复查 session 76231 正在运行。
- review r63 / coverage r59 将 7bbb6c3624602b3c 记为 partial。死亡后创建、模块归档及浏览器联合流程尚待验收；还须核查现有目标过滤对昏迷但未死亡生物的处理。原书配置未改、认证数不增加、API0、真实房间未改，全书目标 active。
- 类型复查 76231 发现非法配置的负面测试没有显式标注类型边界，已改为 unknown → Activity 的故意非法输入，不修改运行时校验；最终类型检查 session 21488 运行中。
- 最终类型检查 session 21488 exit 0；当前生产修改与测试均通过类型检查。

## 2026-09-28：自主召唤的昏迷目标和原生归档

- 上轮为 progress：自主选敌接口和视野修复完成。本轮修正自主选敌对 HP=0 的一律排除：使用权威 deathSaves.dead 区分昏迷与死亡，Host 的最近目标约束和自动回合候选同步；原有失控恶魔与其他命令策略不变。
- 增加实际角色 0 HP、尚未死亡的场景：自动回合选择该最近目标，怪物攻击准备与未命中提交成功，实际重击造成两次死亡豁免失败；确认三次失败死亡后转向下一目标。召唤、怪物攻击、Headless 回归 378 项通过。
- 将自主 summon Activity 路由用例改为真实 .starmod 导出/读取及原生插件安装；字段逐项保留，导入后 Host handoff 携带正确自主策略。路由测试 25 项通过。类型检查 session 58850 运行中。
- review r64 / coverage r60 将 7bbb6c3624602b3c 的自主选敌诊断升级为 expressible，仅针对该诊断；原书法术仍缺死亡触发/延迟创建、原始自动转换与双端认证。本轮源码核查确认 map handoff 对非 immediate 召唤仍返回 delayed-summon-placement-unsupported，下一步需检查延迟流程及可执行性标签，不能声称它已接通。
- API0、原始生成配置及真实房间未改，原书验收数量不增加，全书目标 active。
- 类型检查 session 58850 已完成，exit 0。

## 2026-09-28：延迟召唤的真实支持性与全书离线复核

- 上轮为 progress：自主召唤昏迷目标与归档验证完成。本轮追踪实际调用链，确认当前并不存在可复用的 Activity 回合边界召唤队列；地图 handoff 拒绝非 immediate，三个 UI 提交入口也拒绝，怪物召唤仅有事件/沙盒展示，不能当成已接通的持久化队列。
- 修正自动化判定的假阳性：增加 summon-timing:source-next-turn-start 独立能力要求，目前没有实现 handler；Headless compatibility 明确报告缺少权威回合边界落点队列。即时召唤仍可正常编译。SDK 指南禁止把原文延迟改成即时来消除诊断。此修改是准确验收的前置修复，不是延迟召唤功能完成。
- 注册覆盖、SDK 与实际召唤路由 51 项通过。全书 exact-source、manualContentRepairs=false 的既有自动产物离线重检通过；preflight r12 为 32 ready、122 blocked、1 no-parseable。仅新增负能量洪流的具体时机诊断，原始配置未改，API0。
- backlog r12、review r65、coverage r61 与 mechanism-batches r6 已保存，旧审阅逐条核验仍匹配诊断哈希。841 诊断、95 已审阅、852 未审阅关联；现有源行为认证不提升。类型检查 session 73051 运行中。
- 下一步真实实现应将 Host 已确定的召唤提案、来源执行 ID、出现回合/阶段、目标或落点绑定和一次性收据持久化；在权威回合事件处理创建时重新验证位置、来源专注/取消条件及怪物资料，并由同一原子结果更新 Token 与先攻。普通 UI 刷新不可触发或重复创建。不能仅注册 handler 或移除拒绝分支。
- 类型检查 session 73051 已完成，exit 0。

## 2026-09-28：持久化延迟召唤队列核心

- 上轮为 progress：修正延迟召唤假 full 并重新离线预检。本轮新增 dnd5eDelayedSummonQueue，BattleMap.dnd5eDelayedSummons 保存 Host 已确定的召唤 handoff、落点选择、先攻骰、战斗 ID、来源 Token、回合事件水位与收据。地图迁移恢复合法记录；玩家快照合并只能采用共享权威队列，不能删除或添加任务。
- enqueue 只接受纯延迟召唤 handoff；同收据同请求幂等，不同请求冲突拒绝。待执行任务最多 4096（包含终态收据），达到容量拒绝新增而非丢弃防重放历史。完成、取消与阻塞均保留终态，不在普通刷新时自动创建。
- settle 仅处理同战斗、同来源、晚于入队水位的回合开始，允许同一 round 内的后续来源回合。真正创建时调用现有 applyDnd5eActivityMapHandoffsV1 重新验证落点，持续时间从出现时计算；来源可用性由 Host 回调判断。位置阻塞保留 blocked，不偷偷改位置或在后续回合重试。Token 和先攻结果随地图返回供原子提交。
- 队列、地图 handoff、召唤生命周期 95 项通过；最后补充地图合并保护后，队列/共享合并/地图迁移 87 项通过，两批有重复。类型检查 96734 exit 0（在最后仅增加合并字段及对应测试前完成）。
- 仍未接真实 UI/回合提交：需要权威单调回合序号来源、专注和取消判断、混合即时/延迟 handoff 拆分、三个施放入口以及回合开始对 Token/先攻/队列的原子提交。新模块只完成核心，不能据此注册 timing handler 或解除兼容性拒绝。原书认证数不变，API0，真实房间未改，目标 active。

## 2026-09-28：混合即时/延迟 handoff 的原子准备

- 上轮为 progress：持久化队列核心完成。本轮新增 applyDnd5eActivityDeferredMapHandoffs。先按原始索引验证整批落点，再将即时结果与延迟任务作为一个地图结果返回；失败不修改输入。没有延迟提案时仍走现有即时路径。需要显式战斗/回合水位与收据；重复已入队收据拒绝，不能再次执行即时部分。
- 拆分保留每个召唤的落点和骰值，不把延迟出现改成即时提交。不同怪物加值下，群体先攻不能只保存 d20：现已将原始预览计算出的 roll/initiativeCalculation 存入队列，实际出现时使用同一结果，Token ID 使用独立 delayed 执行后缀避免与即时批次索引碰撞。
- 混合场景覆盖即时僵尸、延迟狼、即时地精；原始群体先攻为 13 时延迟狼仍使用 13，不因狼自身敏捷加值改变。归档地图恢复、坐标对应、重复收据拒绝、重叠落点整批拒绝均通过。队列、地图 handoff、共享合并和地图迁移共 161 项通过；类型检查 session 3298 exit 0。
- 尚未接 UI。已确认 applyDnd5eCombatApplication 的 structuralMapChange 只比较 Token/区域，persistentAreaTurnBoundary 的三向地图合并也只处理 Token/区域；接入队列必须增加整体提交/并发校验，不能只增加一个数组合并而让终态收据与 Token 创建分离。另需单调回合时钟、真正来源生命周期回调和取消不可再获得回合的来源任务。
- 不解除 delayed timing 拒绝、不增加源认证数；API0，原始生成配置和真实房间未改，全书目标 active。

## 2026-09-28：延迟召唤来源取消接入地图结果

- 上轮为 progress：混合提交准备完成。本轮修正队列仅在来源自己回合才检查取消的问题。任意同战斗后续权威回合都可取消失效来源；只有创建仍要求来源回合，旧水位事件不做取消或创建。离场来源不再因永远没有下个回合而留下永久 pending。
- 新增默认来源判断：复用角色/Token 的权威 concentrationSpellId，HP=0 的专注来源不可继续；有 sourceDeathBehavior:die 的任务按确认死亡判断，不把玩家昏迷当死亡，保留稳定/再生/坚韧待决的怪物资格。无专注、无死亡绑定的任务不因为仅 HP=0 自动取消。
- 仅检查法术 ID 会漏掉同法术重新施放，因此新增 concentration=false 的 class-state-changed 事件取消器并接入 planDnd5eMapResultApplication。旧任务在新任务入队前取消；新专注 active=true 不会恢复旧收据。MapsWorkspacePage 的 structuralMapChange 现在包含队列变化，确保取消通过整图提交而非仅写 Token。
- 队列/召唤生命周期 29 项通过；加入实际地图桥接后队列/mapBridge 79 项通过。初次类型检查 57814 exit 0；新增事件桥接及 UI 结构比较后的最终类型检查 session 51344 运行中。
- 真正创建入口尚未接通：仍需持久化单调回合时钟、三个施放入口调用 deferred adapter，以及回合开始对队列、Token、先攻的原子提交和并发处理。付费门槛与 delayed timing 拒绝保持关闭，API0，真实房间未改，原书认证不增加。
- 最终类型检查 session 51344 exit 0。

## 2026-09-28：权威回合时钟及延迟请求准入

- 新增持久化 Activity 回合时钟，显式战斗初始化，使用准确的前后回合键和递增序号做比较；同一事件重放不推进，旧事件和跨战斗事件拒绝。刷新同一战斗不会生成新水位，新战斗初始化取消旧战斗待执行任务。
- 地图迁移保存合法时钟，玩家合并采用 Host 时钟；地图应用的结构变化判断包含时钟，避免只提交 Token 而遗失序号。延迟 handoff 准入必须与地图中的权威时钟完全一致，缺失或过期在任何效果提交前拒绝。
- 时钟和延迟队列集中本地测试 21 项通过。仍未连接实际回合推进、三个 UI 入口和创建/先攻的原子提交，因此 delayed timing 能力仍保持未开放，原书自动化认证数未提升。API 调用 0，真实房间未改。
- 本批类型检查 session 59373 完成，exit 0。

## 2026-09-28：回合时钟接入实际边界与一致性提交

- 上轮为 progress：时钟核心、地图持久化与准入测试完成。本轮将时钟接入 settleDnd5ePersistentAreaTurnTransition，结束边界使用旧序号，开始边界使用新序号；已提交开始键在刷新及事件重放时跳过整批豁免/伤害，旧顺序在异步结算前拒绝。界面调度任务执行前再次核对实时先攻游标，防止排队的旧战斗事件重置时钟。
- 边界地图合并现在同时提交队列与时钟。队列发生变化时要求当前地图仍与结算基准完全一致，避免将取消收据、过期落点与新 Token 分别合并；时钟采用前值比较，重复提交拒绝。普通无队列变化的 Token/区域仍保留既有三向合并行为。
- MapsWorkspacePage 在角色伤害写入前预检地图冲突，实际地图提交包含队列和时钟。此处保障本地提交准备的一致性；不据此声称所有 UI/先攻插入及服务器原子持久化链路已完成。
- 集中本地验证 39 项通过：实际边界时钟、同轮额外先攻位、刷新/重放无重复效果、过期事件在回调前拒绝、真实延迟 Token 与完成收据共同提交，以及并发占位/取消/重复提交拒绝。API0，未改真实房间；延迟能力仍未开放，原书认证数不增加。
- 尚需三个施放入口接入 deferred adapter，以及回合开始创建与先攻插入的权威提交。全书目标保持 active，不触发付费重转。
- 本批类型检查 session 63982 完成，exit 0。

## 2026-09-28：延迟召唤回合执行、施放入口与先攻交接

- 上轮为 progress：实际边界时钟与一致性地图提交完成。本轮在真实 settleDnd5ePersistentAreaTurnTransition 的 turn-start、区域触发前执行到期队列。结束阶段仍持有旧水位，开始阶段使用新水位；返回 Token/收据地图及固定先攻结果，不在刷新时另行排程。
- 玩家和怪物结束回合将返回的先攻条目传入 applyDnd5eTurnAdvance，排序后按 slotId 保留当前行动位；初始化/恢复边界路径也在持久化前插入。现有 persistDnd5eAuthorityState 使用 saveSharedResourcesAtomically 同批保存角色、地图和 combat，不新建分离的队列保存请求。
- 法术、特性、触发活动三个地图 handoff 入口均改用 deferred adapter，从地图权威时钟构造边界；移除这三处对所有非即时召唤的无条件拒绝。缺失时钟、战斗不匹配和重复收据仍由 adapter 拒绝。普通即时效果仍委托既有实现。
- 新贯穿用例使用真实队列和真实回合结算，验证结束阶段未创建、来源开始阶段创建、完成收据与 Token 同批地图合并、插入先攻保留重复 Token 的准确 slotId，以及地图归档恢复后无重复创建/先攻。边界、队列、先攻工具、地图 handoff 和能力注册共 132 项通过；类型检查 session 76055 exit 0。
- 此批不提升原书认证：延迟能力的 registry/Headless compatibility 仍未开放，需补统一能力契约及隔离端到端验收再解除。原始负能量洪流的死亡触发与尸体转换也未据此认证。API0，原始生成配置、真实房间未改，全书目标 active。

## 2026-09-28：延迟召唤能力契约与原生模块往返

- 上轮为 progress：三个 UI handoff 入口、真实回合创建、先攻交接已接通。本轮注册 summon-timing:source-next-turn-start 的 effects/duration/persistence 能力，移除 Headless 编译器关于“没有队列”的旧硬拒绝。此能力开放依据为已接通代码及本地行为证据，隔离浏览器验收仍未完成，不把注册本身当作端到端认证。
- 扩展 summonSourceDeathArchive 的原生 .starmod 二进制导出/重新读取/两次独立安装测试。即时与延迟两种模式均通过实际玩家法术 prepare/resolve 路径；延迟施放消耗一次法术位，归档后仍为 pending、尚无新 Token/先攻，下一来源回合通过实际边界执行后才有 Token、先攻和 completed 收据。原有来源死亡绑定仍通过。
- 更新 AI 转换指南和社区 SDK，明确战斗时钟前提、落点重新验证、失败不自动换位/重试，以及 source-next-turn-start 不等于死亡触发或目标回合触发。没有修改原书生成草稿来凑通过率。
- 模块往返、能力契约、队列、真实边界与 SDK 指南共 60 项通过；API0，真实房间未改。尚需隔离浏览器 DM 安装、玩家学习/施放、到期 Host 结算与刷新同步验证。原始负能量洪流全规则链和整书自动转换仍未认证，目标 active。
- 类型检查 session 69783 完成，exit 0。

## 2026-09-28：延迟召唤隔离双端验收及选格修复

- 上轮为 progress：注册和原生模块往返完成。本轮新增 `.codex-logs/delayed-summon-room-20260928.spec.ts/.config.ts`，6773/6774 使用独立临时 STARS_SHARED_ROOT、每次新建测试房间；不访问或覆盖真实 5273/5274。人工测试包明确 synthetic/automaticSourceConversion=false，使用 room-ephemeral 分发；初版 local-only 被正确拒绝，没有放宽产品权限。
- 浏览器发现实际遗漏：召唤落点预览将 delayed 提案直接交给仅即时地图应用，导致所有格子不可选。现仅在纯预览副本中转为 immediate 验证几何，正式请求保留延迟；89 项队列/地图测试通过，包含合法格、占位格和输入不变断言。
- 第二个真实遗漏是自中心模板不跟随鼠标，导致点击被旧 hover.valid 阻断。Activity 非区域选格现在更新悬停；拥有明确合法格集合时，确认按实际点击格重新运行合法性检查，不让旧悬停结果 veto 点击。测试脚本另修正了等待选点提示、玩家投掷按钮和 DM 骰子确认，不伪造骰子或直接写入完成结果。
- 最终 Playwright session 99183 exit 0，1 passed：DM 上传原生 .starmod → 玩家激活 → 玩家法术书学习 → 玩家施放、DM 选点、玩家投掷 → Host 队列 pending 且无新 Token → 玩家刷新后结束回合 → completed、两个 Token/先攻条目且当前行动位仍为来源 → DM/玩家刷新均两个 Token，无重复生成。证据 `C:/Users/Doco/AppData/Local/StarsApp/local-import-tests/delayed-summon-room-E92KPA.json`，errors 数组仅代表 pageerror 为空。
- 同次日志出现一次 console.error `combat-command-receipt-not-object`，保留为待查传输异常；最终服务端状态和双端断言通过不证明该日志无影响于其他流程。此前失败房间审计文件保留，不计成功。尚未据此认证原书负能量洪流的死亡/尸体完整链或全书转换。
- API0，原始生成配置未改，全书目标 active。最终类型检查 session 59428 运行中。
- 最终类型检查 session 59428 exit 0。

## 2026-09-28：以命令终态收据强化双端验收，整书离线报告 r13

- 上轮为 progress：双端样例通过并保留传输警告。本轮为测试加入命令 HTTP 响应采样与 console.error 记录，不采集身份请求头；没有凭单条日志修改解析器。一次重跑在地图 completed、命令仍 pending 时立即检查先攻而失败，证明原测试终态等待不足。修正为明确观察 committed 收据后再断言最终先攻和刷新，而不是把地图更新当作整笔提交完成。
- 最终 Playwright session 53385 exit 0，房间 VXBFEP 通过。证据 `delayed-summon-room-VXBFEP.json` 保存 PUT 202 pending、三次 GET 200 pending、最后 GET 200 committed，均 application/json；之后先攻数量/当前行动位和双端刷新断言通过。本次未出现 combat-command 协议警告。先前 `combat-command-receipt-not-object` 未复现且未获其坏响应，仍标记待查，不能称已修复。TVKCM7 为失败记录，不计通过。
- 先前关于 Token/收据/先攻“一起提交”的描述只证明最终命令事务与结果一致，不能扩大为所有中间订阅快照均无暂态：本次已观察地图变化早于终态回执。中间态可见性需要在事务展示层另行核查，不隐藏此限制。
- exact-source、manualContentRepairs=false 全书既有自动产物离线预检 r13 完成，32 ready、122 blocked、1 no-parseable，不提升源认证。backlog r13 从 841 减到 840 个诊断，仅移除了已实现的延迟召唤时机缺处理器诊断 b89786e83e9cc3df9aff62cc847846ebe37c3657dc64ea8ef514ef6e89714dc6；没有手工改变原始配置。
- review r66 将 r65 的 95 条既有审阅原样对齐 backlog r13，coverage r62 验证哈希/作用域通过：946 关联、851 未审阅、16 部分解决、3 来源校正、76 已可表达。mechanism-batches r7 已生成。此批未改生产代码，无需重复类型检查；付费 API0，全书目标 active。

## 2026-09-28：全书 Activity 正文结构化原因审计

- 上轮为 progress：收据终态验收和全书 r13 复核完成。本轮核查排程中的 status-marker，确认它是“部分/手动自动化”诊断而非地图图标。为避免反复逐条读取泛化诊断，PdfSpellHeadlessPreflight 新增 activityMechanismAudit：逐 Activity 保存 handler analysis、validationIssues、手动操作定位，以及实际执行的 compatibility 结果；不改变原有问题数组或行为认证。
- 新增 `scripts/audit-fullbook-activity-mechanisms.mjs`，以同一 ready 优先/最新候选原则汇总来源、run、解析状态和具体缺失组件；输入哈希及独占输出用于追溯。更新全书离线 runner 保留结构化字段，生成 preflight r14 与 activity-mechanisms r2。全书旧诊断与 ready 数未因此变化。
- 实际数据：155 来源、1 个候选未解析、322 个 Activity；201 个 Activity 含 manual-adjudication，涉及 68 个来源，所选草稿中缺失组件只有 operation:manual-adjudication。该结果只指导下一步源规则/活动正文核查，不证明其他组件的任意参数、顺序、特殊规则和生命周期已完整实现，不能批量改 full 或清除手动操作。
- 15 项预检测试通过，覆盖可执行活动审计、手动操作定位和持续保持 behaviorVerified=false；整书 r14 离线测试通过。初次类型检查 24669 报只读数组类型错误，已将报告字段改为 readonly string[]；复查 2586 运行中。API0，原始生成配置与真实房间未改，目标 active。
- 类型复查 session 2586 exit 0。

## 2026-09-28：显式不可减伤接口批量核验

- 针对创造小人来源诊断 b09bdf2cc48d51b935f52a6ffc3968ec61e3afa5327b217f4ba04a72ffbae0d9，新增 damage.cannotBeReduced 布尔字段及校验。串通 executor proposal、直接提交、编译器和可信插件伤害上下文；修复了仅接直接路径会导致实际插件施放丢失声明的问题。
- 直接/编译两条结算路径覆盖正常与不可减伤的抗性、免疫、固定被动减伤、易伤，保留临时 HP、伤害事件和输入状态不变断言。相关四个测试文件共 193 项通过。特殊来源保护、反应等组合尚未完成审计，因此没有提升来源认证或修改原始生成配置。
- API 调用 0，未更改真实房间。按机制整批补齐、本地验证，付费门槛保持关闭；当前类型检查 session 30594 运行中。
- 类型检查 30594 发现测试读取联合类型 status 前尚未收窄；调整断言顺序后复查 36692 exit 0。没有扩大源法术验收声明。

## 2026-09-28：伤害防御组合与生命值比例批次

- 上轮为 progress：新增不可减伤路径并通过 193 项测试。本轮扩展同类接口证据：直接/编译两条路径验证条件免疫与易伤组合、检查点新增免疫及绕过护盾池不消耗余额；检查点仍触发，目标资格保护仍保留。未将检查点合成验证冒充玩家反应 UI 验证。
- 不可减伤/协议校验/伤害检查点会话/伤害干预四文件 101 项通过。类型检查 27432 发现 fixture 对只读 featureIds 使用 push，已改成数组赋值；后续与生命门槛一起复核。
- 根据本地缓存原文核对神赐痊愈的严格半血门槛。新增 dnd5eActivityHealthThreshold.test.ts，直接和编译路径覆盖 29/60、30/60、30/61、31/61；门槛不取整、治疗量取整、资源仅成功扣一次、拒绝与原始状态不变。初始 compiled fixture 因未注册资源被正确拒绝，补实际资源定义及职业资格后通过，未放松 Host 检查。两机制合计 11 项测试通过。
- 更新 SDK/AI 接口说明。review r67/r68 分别将特定不可减伤标记诊断及神赐痊愈公式诊断记为可表达；coverage r64 校验通过：97 诊断已审阅、849 未审阅关联、16 partial、3 来源校正、78 可表达。源配置仍需集中重新转换，behaviorVerified=false，不更改全书 ready 数或原始生成内容。
- 类型复查 session 50843 运行中。付费 API0，真实房间未改，全书目标 active。
- 类型复查 50843 exit 0。

## 2026-09-28：独立内容的职业选项前置条件

- 上轮为 progress：防御与半血阈值接口批次已验证。本轮核查来源先决条件组，缓存原文确认永生者赠礼要求链之魔契、魔能斩要求刃之魔契及等级；现有 core classes.ts 已提供 pact-boon 的 chain/blade/tome 稳定 ID。
- 新增 classChoiceRequirements 通用声明和严格数组/ID 校验，接入独立 feature/feat 草稿校验、注册、目录克隆与角色资格。所有条款 AND、每条 anyOf OR；先检查实际职业存在，读取持久选择，不授予选项；资格检查位于构筑授予快捷路径之前。读取还验证 Array.isArray，未知或非数组选择不获授权。
- 新增 featureChoiceRequirements.test.ts：原生 starmod 导出→运行投影→安装→角色快照→Host Activity 执行；覆盖匹配两个选项、错误/缺失选项、其他职业残留选择、不拥有特性、角色持久化后删除前置选择使授权撤销。未覆盖玩家浏览器交互，不据此声称浏览器认证。
- 与 independentSpellGrants 合跑 15 项通过，修正数组读取后与 AI SDK guide 合跑 28 项通过。类型检查 91160 exit 0。文档及转换指南已说明范围；通用已知法术及任意描述的能力依赖仍不能由职业选项字段冒充。
- review r69 和 coverage r65 验证：99 已审阅诊断、847 未审阅关联、16 partial、3 来源校正、80 可表达。仅将两个前置条件诊断标为接口可表达，源配置仍待集中重新转换、行为认证 false。未调用付费 API，未更改真实房间，全书目标 active。

## 2026-09-28：已学法术前置条件

- 上轮为 progress：职业选项前置已串通原生包和 Host。本轮根据缓存怠惰之枪原文核查“习得魔能爆”条件，新增 requiredKnownSpellIds 并串通 feature/feat 校验、注册、目录克隆和角色资格判断。
- 学习证据使用有效职业/子职的戏法及已知列表、法师法术书、known/cantrip 构筑授予、种族戏法及其他已拥有合格特性的 cantrip 授予；不读取仅存在于职业列表或准备列表的数据，不将残留外职业选择算作资格。有限次施放授权不自动推定为学习。
- 递归资格检查采用同步作用域的角色/特性集合，阻止自我授予和无根循环资格；独立合法学习来源仍可解除依赖。每次重新判断，不缓存撤销后的资格。原生包→投影→安装→Host 测试新增“有正确职业选项但未学会法术”拒绝案例。
- 三文件 22 项通过，插件注册/草稿/种族/AI 指南回归 63 项通过；类型检查 97877 运行中。文档明确混合已知法术 OR 任意特性替代条件仍未处理。
- review r70、coverage r66 校验通过：100 已审阅诊断、846 未审阅关联、16 partial、3 来源校正、81 可表达。仅判定指定前置条件接口，不认证怠惰之枪命中减速效果或源配置自动转换。付费 API0，真实房间未改，目标 active。
- 类型检查 97877 exit 0。

## 2026-09-28：组合前置条件与依赖报告

- 上轮为 progress：已学法术前置及循环授予检查完成。本轮补 eligibility 的 all/any 组合，叶节点为已学法术、已拥有且合格的特性、职业等级、职业选项；与既有前置字段仍为 AND。限制深度/节点数，拒绝空分支及循环对象；本包局部特性 ID 在 Host 加命名空间，外包须完整 ID。
- 接入 feature/feat 草稿校验、注册、克隆及角色授权；延用同步递归资格保护，无根循环不能获得资格，独立学习来源可满足替代分支且撤销后重新判断。
- featureEligibility.test.ts 包含原生模块导出→投影→安装→Host 活动，验证法术/特性两个分支和共同等级门槛，拒绝未拥有、不合格提供者、错误职业与循环依赖。初始合成提供者无执行声明却标 full，被解析器正确拒绝；fixture 改为 manual 依赖，未放松生产校验或虚构其行为自动化。
- 前置引用审计接入单条预检与导出 executionWarnings：包外/派生特性需要安装授权证据，替代分支存在不代表可以忽略缺失引用。该审计不尝试按名称猜测引用，不将所有子职派生 ID 静态判为已存在。
- 核心资格及注册五文件 54 项通过，新增依赖审计后，组合/预检/导出/AI 指南四文件另 54 项通过（两批有重叠，不相加当独立用例）。类型检查 29682 运行中。
- review r71、coverage r67 校验通过：101 已审阅诊断、845 未审阅关联、17 partial、3 来源校正、81 可表达。残酷巫咒的“hex 或可施加诅咒的邪术师特性”仍 partial：组合接口有证据，但全部合法诅咒来源的 ID 映射尚未确认，不能删去 OR 分支。API0，真实房间未改，全书目标 active。
- 类型检查 29682 exit 0。

## 2026-09-28：规则能力类别前置接口

- 上轮为 progress：组合前置及依赖报告完成。本轮加入 rule-capability 叶节点，支持命名空间能力 ID 和可选职业限定。独立 feature/feat 的 ruleCapabilities 只声明前置规则身份，不产生效果；必须实际拥有且合格，职业声明须对应真实职业。延用递归资格检查，不能自我授权。
- 子职声明式能力及原生 subclass feature 支持 ruleCapabilityIds，由编译器绑定所属职业。原生凶兆之印标注 dnd5e:curse，能力查询复核祈唤选择、职业等级和既有选项资格；不靠显示名称匹配。导出/单条预检对包内没有独立提供者的能力类别提示核验职业选项、子职或外部提供者。
- 原生包测试发现统一内容 cloneRegisteredFeature 丢弃了子职编译出的能力声明，已从实际统一子职 payload 的 ruleCapabilityIds 重新投影所属职业，未回退到旧配置。修复后三文件 30 项通过；加入审计/指南后，能力类别、组合条件、声明式子职、预检、指南五文件 87 项通过。
- fixture 覆盖原生祈唤、独立提供者、导入子职三种实际 Host 路径；拒绝低等级、错误职业/子职、缺少提供者、自我资格；检查输入状态不变。子职提供者自身使用 manual，不将“可作为资格依据”冒充其效果自动化。
- SDK 与 AI 指南已补充声明格式和证据要求。review r72/coverage r68 校验通过，残酷巫咒仍 partial：原始配置未重新转换并验证全部提供者的声明。类型检查 20826 运行中。API0、真实房间未改、目标 active。
- 类型检查 20826 报子职映射回调参数隐式 any，补类型注解后 85735 exit 0。按 review r72 更新批次计划 r8：仍有 526 条机制/证据关联、28 施放入口、22 执行绑定、221 状态标记、68 显式人工边界待处理；这些是关联分类，不是独立法术数量，不据此声称任何源行为已完成。

## 2026-09-28：死亡豁免替代的 Host 暂停基础

- 上轮为 progress：能力类别资格与子职统一投影修复。本轮选择灼光复仇来源组合缺口，回查缓存原文：14 级、回合开始需要死亡豁免时可替代、恢复半最大 HP、可选起立、30 尺选择目标光耀伤害与目盲至本回合结束、长休恢复一次。现有普通 Activity 正确拒绝 0 HP/失能行动，不能直接塞治疗按钮绕过。
- 新增内部 deathSaveCheckpoint.ts 和 deathSaveSession.ts，接在真实 death-save 分支中、资格判断后、读骰与消费骰值修正前。同步 Host callback 只接收复制的状态，监听期间暂停自身避免递归；普通路径不设置任何可由玩家传入的绕过标记。
- Session 固定原始请求/状态，拒绝过期状态或 checkpoint；decline 重放原请求，accept 由可信 Host resolver 处理并拒绝换战斗/推进回合。失败替代不发布其部分状态，已结束 session 不可重用。death-save-turn 中恢复至正 HP 不结束当前回合。
- deathSaveSession.test.ts 明确使用合成可信 resolver，仅验证暂停基础，不冒充源规则或注册 Activity：覆盖骰值冻结、发现回调修改不污染权威状态、拒绝重复/过期、活着/稳定/死亡不提供替代、失败回滚、listener 清理。与伤害提交 session 合跑 21 项通过。类型检查 19430 运行中。
- 后续必须接注册 Activity 的资格和版本检查、仅本次死亡豁免允许失能角色的受限授权、资源/目标/真实治疗及状态效果、回合开始时点、玩家选择 UI、房间原子提交。目前没有新增公开 Activity 触发枚举或提升自动化组件支持状态；SDK 不宣传已支持完整替代。
- review r73/coverage r69 验证通过，将该源组合诊断记 partial：102 已审阅、844 未审阅关联、18 partial、3 来源校正、81 可表达。API0，真实房间未改，全书目标 active。
- 类型检查 19430 exit 0。

## 2026-09-28：死亡豁免替代注册 Activity 受限结算

- 新增 before-death-save 触发事件及注册 Activity session。仅真实 Host 死亡豁免 checkpoint 内，对匹配的角色、包、活动授予一次同步作用域执行资格；没有玩家可提交的失能绕过标记。已注册目录变化后拒绝旧选择，特性归属、次数、目标距离、骰值继续走通用权威入口。
- 替代仅支持当前状态内的治疗、倒地移除、伤害和简单状态效果；库存、移动、召唤等需各自原子适配的行为不允许在此入口被静默丢弃。预检显式阻断 before-death-save 的完整认证，直到玩家选择、回合开始时点及房间同步验收完成。
- 两文件 13 项本地测试通过：实际攻击降至 0 HP 后恢复，清理昏迷及倒地，资源只扣一次，目标伤害/目盲生效；无特性、次数耗尽、骰值无效、超距、错误触发引用、定义变化、checkpoint 外执行均被拒绝。失败不修改输入状态，重复 session 不可提交。
- 生命周期检查揭示另一个待补齐接口：现有 rounds:1/source-turn-end 表示来源下回合结束，不能表达灼光复仇的当前回合结束。测试记录并验证现有语义；不能据此认证原始特性。可选起立、自由目标选择及源配置仍未完成。该来源继续 partial，不修改源配置或提升全书完成数。
- 用户再次明确开发期不逐项调用转换 API：本轮 API 0，继续按共用机制批次修复，付费整批转换门槛保持关闭。真实 5273/5274 未修改。类型检查 21142 运行中。
- 触发调用与 PDF 预检另两文件 22 项通过；连同上述结算测试共 35 项。类型检查 21142 exit 0。没有执行新的全书 API 转换或更新全书认证计数。

## 2026-09-28：明确创建回合的效果到期边界

- 上轮为 progress：注册 Activity 的死亡豁免受限结算完成本地测试，并发现当前回合/下回合持续时间差异。本轮增加 rounds:1 的 includeCreationTurn 字段，只允许 source-turn-end 或 target-turn-end；默认保持旧语义。普通状态与复合效果的直接、编译入口均传递该字段，权威回合边界处理按来源/目标匹配；不通过伪造 appliedTurnKey 实现。
- ActiveEffect 序列化规范化保存字段，严格校验拒绝无效类型及不合格边界；状态详情注明包含当前回合。完成休息奖励不允许该字段，防止将要求完整持续时间的休息缩短。SDK 和自动转换指南同步格式与限制。
- 新回归覆盖两类边界、字段省略/false/true、普通状态/复合效果、直接/编译结算、JSON 往返和规范化；另测不同来源/目标不会提前清除。死亡豁免替代合成测试改为当前回合结束解除目盲，并实际验证。
- 六文件 189 项测试通过：新边界、死亡豁免 Activity、Activity 校验、结算 E2E、activeEffects、AI SDK 指南。类型检查 74527 运行中。该特性仍缺玩家选择、回合开始资格、房间原子同步及源配置自动转换验收，继续 partial；不增加全书认证计数。API 0，真实房间未修改。
- 类型检查 74527 exit 0。

## 2026-09-28：子职替代候选、可选起立与零目标

- 上轮为 progress：当前回合结束效果语义及两种执行入口通过。核查本轮受限入口发现只接 feature/feat，会遗漏来源真正的 subclass-ability；现加入该类型，沿用注册子职元数据、实际职业等级、子职和特性归属校验。
- 新增 Host 候选查询与默认暂停条件。只在活动战斗当前角色需要死亡豁免时查询其合格候选，返回复制的定义；不把候选等同于成本、目标和骰值已验证，提交继续走通用权威校验和注册目录变化检查。尚未接玩家界面及房间事务。
- creature 目标增加 minimumCount，默认一名，显式 0 允许不伤害任何生物时仍结算自身操作；范围为 0..count，非法值被拒绝。可选起立复用已有 choice/outcome/remove-standard-condition，不硬编码特性名。
- 真正的注册子职归属测试覆盖合法、低等级、错误子职、未拥有；用于资格提供的子职能力本身标记 manual，测试的合成 Activity 不冒充原始扩展自动转换。其他测试覆盖零目标/保留倒地/站起，以及两名受害者各承受伤害但自身只治疗一次、资源只扣一次。未声明 minimumCount:0 的零目标请求继续被拒绝。
- 六文件 193 项通过：死亡豁免 Activity/Session、Activity 校验/执行、子职资格、AI SDK 指南。类型检查 14943 运行中。指南及 SDK 写明字段与未完成的界面边界。回合开始资格、双端选择和房间提交仍需完成；来源继续 partial，API 0，真实房间未修改。
- 14943 发现合成测试对只读 outcomes 使用 push；改为创建新数组，类型检查 42710 复查中。已定位 MapsWorkspacePage 的实际死亡豁免入口：它先准备下一回合并掷死亡豁免骰，再执行 death-save-turn。下一步必须把替代选择放到掷死亡豁免骰及下一回合准备之前，而不能只在最后提交处替换结果。现有 damageReactionFlow 可参考其异步 Host 选择、修订复核及仅发布最终结果结构。
- 类型检查 42710 exit 0。

## 2026-09-28：死亡豁免掷骰前的异步 Host 流程

- 上轮为 progress：子职候选、可选起立及零目标协议。本轮新增 deathSaveReactionFlow，独立于普通死亡豁免掷骰；选择替代后才读取效果骰，decline 返回给调用方继续普通流程，cancel 与失败绝不自动降级为普通豁免。
- 流程保存基线和真实 checkpoint 快照，选择回调只收到复制数据。每次等待选择/骰子后及最终返回前复核房间授权回调、输入状态和已注册目录。session 在 finally 取消，不保留可复用提交入口。固定修订、触发引用、版本、目标、选项和 Host 骰值提交给通用权威入口；checkRollModes 也随注册替代提交。
- 复用通用触发骰流程，但对零受害者剔除仅作用于受害者的掷骰声明，保留自身治疗及资源相关声明；真正结算仍使用原始注册 Activity。没有原文/配置替换或忽略受害者效果。
- 本地三文件 33 项通过，涵盖接受/拒绝/取消/无能力、次数耗尽、选择或掷骰期间过期、模块定义变化、回调异常、非法骰值、回调修改隔离和零目标不掷伤害。所有路径保留输入不变，成功仅返回最终结果，没有网络发布。类型检查 96167 运行中。
- 地图入口尚未接入：需要在其结束回合状态检定和死亡豁免骰之前做选择，替代成功后复用专注/坠落等后续结算及最终房间提交。选择 UI、回合开始资格和隔离双端验收仍未完成，预检阻断继续保留。API 0，真实 5273/5274 未修改，目标 active。
- 类型检查 96167 exit 0。

## 2026-09-28：地图死亡豁免入口接入玩家选择

- 上轮为 progress：异步 Host 流程与回滚测试。本轮新增 deathSaveReactionChoice，通过现有房间选择窗口向角色控制者提供能力、声明式选项及目标切换列表。目标显示角色名称和已选标记，支持取消选择、零目标和取消整个操作；依据范围/阵营/视线预筛，最终资格仍由 Host 验证。
- MapsWorkspacePage 的 dnd5e-death-save 入口在所有结束回合检定及死亡豁免骰前调用替代流程。拒绝才走原先掷骰分支；取消或错误立即拒绝本次请求；成功替代直接进入既有专注/坠落后续结算和应用，不推进回合。未为该特性新增直接 HP 写入通道。
- 选择、异步流程及注册替代三文件 35 项通过。新增选择测试覆盖普通豁免、取消、可选起立、空目标、目标切换/取消选中、范围隐藏、最小数量和伪造选项、自身目标。类型检查 35381 运行中。
- 尚需隔离双端实测、回合开始资格和完整原始来源转换验收，预检继续阻断完整认证。API 0，真实 5273/5274 未修改。
- 类型检查 35381 exit 0。随后补充每次房间选择前后与专注/坠落后续结算之后、应用之前的授权状态复核；避免后续等待期间用旧结果覆盖新状态。选择/异步流程/地图后续结算三文件 39 项回归通过（与前述测试有重叠，不相加）；类型检查 44479 运行中。
- 类型检查 44479 exit 0。

## 2026-09-28：隔离双端恢复流程及零 HP 提示修复

- 上轮为 progress：地图入口接入。本轮创建独立 Playwright 配置/脚本 .codex-logs/death-save-room-20260928.*，仅使用 6773/6774 和每次全新的 STARS_SHARED_ROOT；模块通过真实导入和房间锁定同步，玩家点击死亡豁免后走能力、起立、零目标三步选择。fixture 明确 synthetic，不是 PDF 自动转换证明。
- 首次房间 6WGMRS 失败：Host 已发布 pending plugin-choice，但玩家提示分发禁止所有 0 HP 角色回答。combatInterruptProtocol 仅为 before-action、actor audience、activity-trigger、actor-choice 且 death-save 事件窗口允许未死亡/未稳定的 0 HP 角色；实际拥有者限制继续生效，真正能力执行仍需 Host checkpoint。相关路由 24 项通过。
- 第二次 PYAWUJ 恢复已成功，但脚本错误等待 /combat/commands 回执；死亡豁免实际使用 player-action-ack，含同次提交 authorityRevisions。另外手工附加 unconscious 被正确保留为独立状态，随后导致自动跳过；改为通过真实 Headless 攻击生成 0 HP 状态来源，不移除独立昏迷规则。
- 最终房间 DN8QYG Playwright 通过，保存 C:/Users/Doco/AppData/Local/StarsApp/local-import-tests/death-save-room-DN8QYG.json：模块双端启用、玩家选择、HP 0→14、昏迷和倒地清除、回合 1/hero 不推进，accepted ACK 包含 characters/maps/combat/player-action-processed 修订，两端刷新后仍 14 HP，无 pageerror。6773/6774 测试服务已由测试进程退出并检查无残留。
- 检查最终 combat 发现 hero movement.current 仍 0/max30、reaction.current 0；恢复后回合资源恢复需要继续检查修复。原始来源资格、完整带伤害/次数模块的双端覆盖及集中自动转换也未完成，继续 partial。API 0，真实房间未修改。类型检查 45821 运行中。
- 类型检查 45821 exit 0。

## 2026-09-28：恢复后的移动账本与反应预算

- 修复恢复生命后移动/反应仍为零：地图死亡豁免入口传入当前回合经济，并在同回合恢复成功后投影最终 Headless 预算；回合初始化保存显式 movementSpent:0。速度为零时不能将此前已移动距离重建为额外移动，否则会错误返还消耗。
- 回合刷新保留反应预算，状态限制在实际消费时检查；直接 Activity 和编译插件消费入口均拒绝受限制或已花费的反应。预算与暂时不可用状态分离，解除限制不返还已花费反应。
- 死亡替代、结束回合和移动经济 53 项通过；随后六文件批次中的五文件 61 项通过，新反应测试因配置遗漏 amount 和 Host 确认入口失败。修正合成测试的显式 active/actor-choice 声明与成本后，反应预算三项通过（每项覆盖直接和编译入口）；没有放宽生产校验。
- 隔离房间 KV75NV 验收通过，私有证据 death-save-room-KV75NV.json：accepted ACK、HP 0→14、当前回合不推进、移动30/已用0/反应1、两端刷新一致，无页面异常。单测另覆盖已走10尺恢复后仅剩20尺、已用反应不返还。该房间仍是合成模块，不等同原始来源或全书转换认证。
- 类型检查初次发现新测试漏填 amount，修正后复查。付费 API 调用为0，真实5273/5274未修改；完整来源资格及批量转换验收仍待完成。
- 修正后类型检查 20796 exit 0。

## 2026-09-28：替代结算的数值组合与资格边界审计

- 上轮为 progress：行动资源修复及隔离双端验收。本轮补齐组合表达式的本地证据：奇数最大生命值21/37向下取半、魅力8/18/20对应伤害调整、30尺边界允许/35尺拒绝。合法提交检查治疗、伤害、目盲、本次资源消耗、当前回合保留和当前回合结束清除；非法范围必须整个状态不变。替代/异步流程/选择三文件40项通过。
- 此测试手写合成 Activity，只证明接口表达和结算，不冒充原始PDF自动转换。数值使用声明式 floor/multiply/add/actor-max-hp/actor-ability-modifier，没有增加原生特性分支。没有清除来源 partial 或预检阻断。
- 当前资格缺口定位：deathSaveActivity 的候选仅判断当前先攻、0 HP、未稳定/未死亡；Headless death-save 分支也没有保存本回合已做死亡豁免的标记。turnStartResolvedTurnKey 只表示开始边界已处理，不保存开始时是否需要死亡豁免。不能从当前HP倒推回合开始资格，也不能用重复请求的不同commandId绕过次数语义。
- 后续必须把资格和已结算标记纳入权威回合状态，并经过角色/Token持久化、mapBridge快照与提交投影。需覆盖：回合开始0HP、回合中受伤降至0、同回合重复请求、下一回合重新开放、额外先攻槽、旧状态迁移及刷新。仅给候选加过滤或在UI隐藏按钮不足以完成该项。
- API调用0，原始来源批量重转门槛仍关闭，真实房间未修改。类型检查复查中。
- 类型检查93766 exit 0。

## 2026-09-28：权威死亡豁免回合账本

- 上轮为 progress：数值组合验证及资格缺口定位。本轮新增 deathSaveTurn，记录槽位回合键、开始时是否符合资格、是否已结算。显式及传统隐式回合开始建立记录，普通豁免和成功替代共同标记已结算；失败骰值不消费。候选发现复核已开始回合的记录，不允许当前HP倒推资格。
- 记录接入角色/Token类型、角色既有状态保留及mapBridge结果投影。已开始但没有记录的旧状态拒绝推断，下一回合重新建立；SDK明确该迁移行为及模块触发上下文不能授予权威资格。
- 新测试覆盖普通豁免重复请求、序列化/角色归一化保留记录、下一回合重开、非法骰值重试、回合中降到0HP拒绝和旧状态缺失拒绝。死亡替代/异步/结束回合四文件60项通过。现有Headless及反应预算两文件306项通过；beginTurnAction此前11项通过。混乱效果的旧预算断言改为预算存在但状态禁止使用，没有放宽其反应规则。
- 类型检查36796 exit 0。隔离双端流程复查中，仍需额外先攻槽及完整原始来源认证；未清除全书预检阻断，API0，真实房间未修改。
- 隔离首次建房请求15秒超时，进程已结束；只将建房请求等待延长为60秒后重新验证。房间RCL4PC完整流程通过（death-save-room-RCL4PC.json），结算断言未放宽。测试结束后检查临时共享目录 stars-fullbook-isolated-1790649047155/state/rooms/RCL4PC/characters.json，hero 的deathSaveTurn确实持久化为 turnKey=death-combat:1:hero、eligible=true、resolved=true；两端刷新HP及资源检查通过。尚未在浏览器模拟重复请求或额外回合槽，保留对应边界待验证。

## 2026-09-28：额外回合槽及恢复模块往返验证

- 上轮为 progress：回合权威账本与房间持久化。本轮26项本地测试通过，新增同轮同角色两个先攻槽分别开放一次死亡豁免，以及完整合成恢复Activity经.starmod导出、读取、重新安装后实际Host结算。恢复/伤害/目盲/资源消费仍正确；JSON往返保留已结算标记，再次降至0HP且独立补充次数资源也不能重开同回合窗口。
- 更新私有审阅r74和覆盖r70，补齐最近的接口、交互和持久化证据；来源仍partial、behaviorVerified=false，未把手工合成模块当成原始PDF转换。覆盖数字保持155条、102个已审诊断、18个partial关联、121条待机制审阅和2条待集中重转，不能将其当成完成数。
- 核查已存在resourceRecoveryArchive对特性/专长的导出重装、资源初始化和休息恢复测试；当前恢复模块往返fixture尚未把该资源声明/角色自动建立/实际休息生命周期连为一条来源级链路。下一步应连接该链路，而不是继续手工给combatant填次数后宣称原始来源已认证。
- API0，真实房间未修改。类型检查32411运行中。
- 类型检查32411发现测试manifest的features分类非法，改为合法mixed。随后将往返fixture改为真正声明namespaced资源，导入注册后由syncCharacterClassResources建立次数，不再手工构造恢复次数；实际结算扣至0，normalize后短休仍0、长休恢复1，补回资源也不能绕过同回合已结算限制。三文件30项通过，类型检查23292复查中。原始子职来源及整书转换仍未认证。
- 类型检查23292 exit 0。

## 2026-09-28：批量验收分流与休息时序缺口

- 上轮为progress：模块往返及资源恢复验证。本轮排程器增加严格匹配的source-behavior-verification类别，把4条已知休息完成窗口诊断分流至行为核验队列，保留未解决状态、来源范围和所有阻断；不把诊断文本本身当成实现证据。未知后缀和不同措辞仍进机制队列。排程/覆盖工具7项通过，生成私有批次r9。
- 对照本地PDF缓存inventory.json中options-druid正文：月光阴影的炉心在休息开始建立球体，休息完成或来源离开区域结束。restActivityWindows目前只有short-rest-complete/long-rest-complete凭据。因此它不只是待跑房间测试，还缺开始/进行中/结束的权威生命周期及空间清理，不能误映射为完成休息后生效。
- 转换SDK指南明确禁止把休息开始映射为完成事件、编造rest-start字段或永久效果绕过；指南21项测试通过。私有审阅r75将该精确来源诊断记为partial，覆盖r71校验通过。未修改原始产物/标签来伪造自动转换成功。
- 下一步为共享休息会话生命周期，而非逐个重做休息完成窗口。API0，真实房间未修改，全书目标active。

## 2026-09-28：共享休息会话开始与中断

- 上轮为progress：原文时点核对与批量诊断分流。本轮新增campaign-rest-sessions共享协议，接入campaign-time客户端类型/归一化/校验及真实服务器mutation端点。Host开始或打断会话，服务器读取角色名单核实参与者，开始时间和操作者由权威端生成，不采信客户端自报status或时间。
- 会话保留终态身份防重放，拒绝ID冲突、参与者重复休息、过期时钟和超限记录。普通推进、旧完成短休/长休操作及set-time会将当前会话标为unverified-time-advance中断；本阶段不会把普通时间推进冒充已验证持续休息，也不新增恢复收益。
- campaignRestSessions/campaignInteractions/campaignTime三文件23项通过，覆盖权限、服务器名单、字段伪造、幂等和冲突、序列化保留、旧接口推进的中断与损坏状态拒绝。类型检查95464运行中。
- 这是接入真实状态端点的第一段，不是完整休息能力实现：尚缺明确完成事务、开始触发凭据、休息区域创建与来源离开清理、UI和隔离双端。转换指南仍保留rest-start未开放限制，原始来源不认证。API0，真实房间未修改。
- 类型检查95464 exit 0。

## 2026-09-28：休息会话完成与实际资源恢复

- 上轮为progress：开始/打断端点。本轮complete-rest-session由已保存会话决定长短休及参与者，复用原时间推进/收益报告/骰值验证；完成记录绑定同次advance ID，原会话与推进同时提交。重复完成返回原状态，不新增advance；中断、过期时钟、名单缺失拒绝。会话校验核对完成时间、参与者与推进证据，损坏记录不自动清空。
- 客户端runDnd5eCampaignLongRestTransaction增加会话入口并保留收益前迁移基线及完成后角色协调；公开completeDnd5eCampaignRestSession供后续UI接入。校验会话种类及参与者不被调用方改变。
- 四文件30项通过，包括实际法师HP/法术位恢复，随后再消耗并JSON重载后重复完成不再次恢复，长短休的精确时间与参与者，原交互和时钟回归。补充检查损坏advance为null或非法参与者列表不会导致校验抛异常。类型检查88373运行中。
- 尚未接开始触发凭据、区域生命周期、UI及隔离双端；现有普通时间推进仍中断活动会话，不认证持续休息。原始来源仍partial，API0，真实房间未修改。
- 类型检查88373 exit 0。

## 2026-09-28：休息会话界面与隔离双端

- 上轮为progress：完成事务和资源恢复。CampaignTimeWidget增加开始休息（不推进时间），会话列表显示实际角色与进行中/完成/打断状态，DM可完成或打断，玩家只读；原直接完成休息入口保留。类型检查7599 exit 0。
- 新隔离Playwright配置rest-session-room-20260928使用6773/6774和每次独立临时共享目录。前两次测试停于入口准备：空地图及沉浸地图均无侧栏时钟；改为通过DM工坊/玩家扩展页的实际侧栏入口，无功能断言放宽。
- 最终房间ZSJPQG通过，证据C:/Users/Doco/AppData/Local/StarsApp/local-import-tests/rest-session-room-ZSJPQG.json：开始不推进时间/不治疗（HP5）；玩家只读；双端刷新后仍active；DM完成后480→960分钟且HP5→28，玩家同步completed；玩家直接请求start-rest-session返回403。测试服务退出后检查无6773/6774残留进程。
- 尚未验证浏览器打断操作及完成重放（已有本地覆盖），也未接开始时的Activity授权、休息区域与来源离开清理；不能据此认证炉心或全书自动转换。API0，真实5273/5274未修改。

## 2026-09-28：休息开始Activity授权与防重放

- 上轮为progress：会话UI和双端验证。本轮注册short-rest-started/long-rest-started生命周期事件；restStartActivityWindows从真实活动会话、参与者及开始分钟派生窗口，角色保存独立使用/放弃收据。没有把完成窗口改为开始，也没有提前发放休息收益。
- Host休息settlement复用注册Activity、归属/版本、目标、骰值及资源结算，并将开始收据与效果交给既有原子提交。普通编译plugin路径拒绝这类事件；非战斗提交只在显式休息授权下允许。插件特性控制、实际pluginFeatureAction提交分支都接入新事件。
- 新测试覆盖长短休开始、非参与者、非战斗暂时生命结算、非法骰不消耗、JSON/归一化后使用或放弃防重放、完成/打断后失效、普通插件绕过拒绝。损坏收据在角色归一化时保留为拒绝状态，避免丢弃后重新派生机会。四文件121项通过（包含旧完成休息、插件动作和Activity校验）。
- SDK指南明确开始授权与休息区域生命周期分离；后者及浏览器选择、完整来源转换仍待完成。类型检查29833通过，最终改动复查中。API0，真实房间未修改。
- 转换指南21项通过；类型检查64322 exit 0。特性提示区分开始和完成时点。

## 2026-09-28：休息区域绑定与原子清理（本地批次）

- 遵循集中实现/本地批测政策，新增付费转换调用 0。真实 5273/5274 房间未修改。
- create-persistent-area 增加 bindToRestSession 策略，执行器传递到地图交接。Host 从已接受的休息事件、当前时钟与参与者解析会话；种类、开始分钟或事件不匹配均拒绝，不接受模块提供运行时会话 ID。特性实际地图入口传入 Host 时钟并保留既有休息原子提交版本保护。
- 地图持久保存 restSessionId；非法字段使该区域归一化失败，不把绑定丢弃成无限期区域。会话完成、打断和普通时间推进，通过现有时钟/地图事务原子移除区域及其效果 Token；共享清理函数也接入客户端。已有 sourceExitBehavior 继续负责来源离开。
- 新服务端事务测试包含终止/普通推进、无关会话、刷新、非参与者/损坏/失去会话绑定、非 DM 请求及失败事务不写入。地图测试从 JSON 往返的合成 Activity 执行器生成区域，再验证授权、重载及拒绝分支。两次初始失败为测试输入缺 Host 触发上下文、actor-choice 确认；按实际授权补齐后通过，没有放宽产品校验。
- 8 个相关文件合计 265 项通过（最初 264 通过，修复测试输入后重跑受影响文件 74/74）；包括地图、区域、休息开始、会话事务、召唤清理、Activity 校验与转换指南。类型检查 56646 待完成。
- SDK/作者界面提供会话绑定。合成接口测试不认证原始炉心能力或全书自动导入：区域内技能加值、全掩蔽、火光屏蔽及原始配置仍需行为核实，仍保持来源 partial。未追加逐法术付费请求或重复启动浏览器房间。
- 类型检查 56646 exit 0。API 门槛继续关闭，全书目标保持进行中。

## 2026-09-28：区域技能加值与锚点全掩蔽

- 上一轮为 progress：休息绑定区域创建/清理已经实现并有本地证据。本轮复查缓存 PDF 德鲁伊原文：休息开始、固定点 30 尺球体、全掩蔽阻断、自己及盟友隐匿/察觉 +5、明火光亮对外不可见、休息完成或来源离开结束。没有把生命周期测试当成完整来源验收。
- 新增 occupantModifiers.skillCheckBonuses（标准技能 ID、正整数 1–30）和 requiresLineOfEffectFromAnchor。地图权威投影遵守占据、关系、自身和高度，检查固定锚点到生物的全掩蔽；同 feature/coreSpell 多实例取最大，不同功能累加。实际属性检定、躲藏与盗贼技能路径读取短期投影，被动察觉/调查同步加值，反魔法压制，离开/删除不写回熟练或永久属性。
- 顺带修复已有 skill-check-bonus-aura 虽可声明其他技能但运行时仅结算隐匿的问题；标准技能 ID 白名单接受 sleightOfHand 等驼峰标识，阻止无效技能。
- 本地批测：四文件最初 87 通过、1 个合成光环测试因缺 definitionId 被正常归一化丢弃；补齐输入后，区域/引擎/校验回归四文件 456 通过。最终补充驼峰 ID、作者指南后，四文件 154 通过。类型检查 74806 待完成。
- 明火屏蔽仍缺：当前光源 sourceKind 已有 torch/candle/lamp/hooded-lantern/spell/custom，但需明确未标注 custom/营火的来源属性，并将同一规则用于服务端可见性和玩家渲染。不得用整片黑暗或阻挡全部光源代替。原始来源保持 partial，未进行新 API 转换或原始配置认证。
- 类型检查 74806 发现 passiveInvestigation 可缺省、区域高度字段引用错误；改为缺省被动值和 vertical.baseElevationFeet。受影响 6 项测试重跑通过；最终类型检查 15283 运行中。不可变审阅 r76/覆盖 r72 保留此来源 partial，未提升任何原始转换认证计数。
- 最终类型检查 15283 exit 0。本轮 API 0，真实房间未改动。下一批定位 MapVisibilityLayers.tsx 光源投影、mapGeometryIlluminationAtPoint/mapGeometryLightPolygon 以及 shared/map-geometry-kernel.mjs，统一处理明火可见性。

## 2026-09-28：明火遮蔽区域与玩家照明投影

- 上轮为 progress：区域技能加值/锚点掩蔽已实现。新增 create-persistent-area.concealsFlameLightFromOutside 与地图持久字段，执行器/校验/地图交接贯通。光源增加 flame 布尔来源标记，火把等旧预设仍可识别，未知 custom/普通法术光不猜测；切换预设会复位标记，DM 场景灯与 Token 灯均提供开关。
- shared/flame-light-concealment 共用策略分别接入浏览器照明与服务端玩家可见性：内部明火不能照亮外部，外部观察者不能借其看清内部。渲染先排除对当前观察者隐蔽的光，再把多边形按相同点判定裁到边界，保留环境光与非明火光源。
- 发现施法者隐藏时区域会被玩家投影过滤，场景灯仍可能绘制；补匿名 lightingOnly 几何，去掉施法者/名称/交互信息，显示层不画轮廓，归一化保留其遮光字段。requiresLineOfEffectFromAnchor 可单独保存供匿名投影使用。
- 本地第一批四文件 131 通过；追加锚点墙壁与匿名存档遮蔽后，第二批四文件 113 通过。包含真正的 projectMapsForPlayer 与客户端 canSee 对比、入区/出区/结束、魔法光与环境光、场景和 Token 光源存档，以及玩家多边形裁切。类型检查 90463 运行中。
- 尚未认证原始炉心来源：原始配置仍待集中重转，浏览器完整休息交互尚待验收；另外服务端锚点全掩蔽路径当前检查静态地图几何，客户端还检查动态持久区域屏障，需补齐这条一致性分支后再认证完整能力。API 0，真实房间未修改。
- 首次类型检查 90463 指出光源编辑补丁缺 flame 字段及测试可选数组标注；已补齐 MapGeometryEntityPatch 和夹具类型。最终检查 50070 运行中。审阅 r77/覆盖 r73 保持 partial，不提高原始自动转换通过数。
- 最终类型检查 50070 exit 0。两批本地验证通过，API 0。下一轮需补 server mapFlameLightConcealed 的动态区域全掩蔽分支，再做代表性完整休息流程；不重跑逐项付费转换。

## 2026-09-28：动态全掩蔽统一射线内核

- 上轮为 progress：明火遮蔽策略及匿名玩家几何已落地。本轮把客户端现有持久区域射线逻辑提取到 shared/persistent-area-ray.mjs，将力场球/半球交点算法提取到 shared/force-shell-geometry.mjs；原 TS 导出兼容保留。没有修改墙体 HP 或可攻击规则。
- 服务端明火遮蔽的锚点全掩蔽判定在静态地图几何后调用同一内核，覆盖真实墙面板、力场球/半球、普通体积与边界区域。动态锚点高度沿用各端现有解析，点体积容差统一为 0.1 尺。
- 4 文件 64 项通过，包括 mapGeometry、forceShellGeometry、区域技能加值和 flameLightConcealment。新增参数化用例逐项比较 Host 玩家投影和客户端可见性：透明动态屏障能阻断区域传播，把屏障抬高后恢复区域遮光；移除屏障也恢复遮光。类型检查 65247 运行中。
- 接下来需将休息开始选择、区域创建、技能/照明、退出/结束清理组成代表性完整交互验证。现有真实房间不修改，付费 API 仍 0，原始来源配置待集中重转，不凭合成测试提升全书完成数。
- 类型检查 65247 exit 0。不可变审阅 r78/覆盖 r74 保存共享内核证据并继续保持来源 partial；下一步完整交互验证。API 0。

## 2026-09-28：休息能力串联与 Activity 检定修复

- 上轮为 progress：动态遮挡已统一。本轮新增长/短休 restAreaIntegration：真实会话开始 → 已注册 Activity 休息授权 → Headless handoff → 区域保存/重载 → 两类技能检定 → 完成/打断/来源离开清理；角色收据防重用。此处为明确标注的合成模块，不是自动转换源能力。
- 发现普通 ability-check 与 Activity 内部 skill-check 两条路径不一致：ActivityCombatAuthority 的快照未读取区域和光环加值。公开现有环境加值计算器，Host actor/target 快照传入同一权威 state；无 state 的辅助调用仍可读取自身区域投影。新增直接 Activity 检定结果断言（区域内比外部 +5）。
- 首次夹具缺先攻成员导致空快照，补实际地图参与者；第二次探针 Activity 缺 outcomes，被校验正确拒绝，补 resolve-only 操作。正式串联两项通过，相关三文件 95 项通过；追加结果断言后的四文件合计 52 项通过（受影响两项重跑通过）。类型检查 64490 exit 0。
- 已创建 rest-area-room-20260928 隔离 Playwright：实际 .starmod 导出/导入、玩家同步、DM 开始休息、玩家执行、刷新防重用及打断清理；使用独立临时目录和 6773/6774，reuseExistingServer:false。测试进程 96667 运行中。API 0，真实房间未修改。

## 2026-09-28：批量验证与费用约束再次确认

- 用户再次明确：先集中完成实现并提高把握，再进行付费 API 验证；禁止修复一个条目就调用一次转换 API。沿用 fullbook-batch-workflow 的整批门槛，当前保持关闭。
- 本地测试不调用模型服务，可以按机制批次执行；已通过且未受改动影响的检查复用证据，不逐法术重复启动双端测试。
- 核对上一轮 rest-area 浏览器进程 34460：当前已无法取得该进程。最新专属审计 rest-area-room-Y3MYRG.json 只记录导出/导入/玩家模块同步，未记录玩家创建区域和清理通过；因此该流程仍未验收。通用 test-results/.last-run.json 不能单独作为此项通过证据，不凭它提升完成数。
- 本次核对没有启动转换 API 或重复浏览器测试。全书目标保持进行中。

## 2026-09-28：统一模块的休息操作入口与区域提交

- 上轮为证据核对；本轮按实际玩家路径继续定位。隔离浏览器 54924 / 房间 7JBMTF 已正确打开职业特性汇总面板，但模块能力按钮缺失，确认不是休息判定本身。统一内容导入仅编译普通主动入口及效果授予入口，漏掉无普通 action 的休息 Activity。
- unifiedContent 为特性、专长、子职业能力的四种 actor-choice 休息事件注册 Headless 适配器，跳过已有注册和 authorityBinding；不推断为普通 active-use。增加四种事件的 .starmod 导出/导入测试，验证控制仍保留原始触发条件和卸载清理。相关三文件 26 项通过。
- 随后隔离浏览器 96388 / 房间 PGWEAA 证实玩家按钮可执行并发送请求，但 Host 返回 invalid-plugin-action。发现 resolvePreparedDnd5ePluginFeatureAction 的休息分支没有向结算传递已由 Host 准备的区域位置、距离和目标。补齐该分支，没有信任客户端额外坐标或绕过会话授权。
- restAreaIntegration 改为真实注册统一模块，并追加玩家 prepare/resolve 路径断言，覆盖长短休。初始夹具 contentCategory 填写 features（非合法枚举）被拒绝，改为 mixed。相关三文件 57 项通过、受影响两项修复后通过，合计 59。类型检查 18179 运行中。
- 浏览器此前失败记录保留；最后一次区域传递修复后尚未完成浏览器复验，不宣称玩家完整流程通过。API 0、真实 5273/5274 未修改，全书原始自动转换仍待集中验证。
- 类型检查 18179 只发现新增集成测试未对 result.ok 做 TypeScript 收窄；已增加失败分支 guard，未改变断言或产品行为。最终类型检查 64004 运行中（已轮询确认仍活跃），后续继续沿该进程核查，勿重新启动。

## 2026-09-28：休息结果到地图应用的元数据连接

- 上轮为 progress：注册入口和 Host 区域输入。收取类型检查 64004 exit 0 后，隔离复验 42515 / 房间 86Y6FG 确认请求已 accepted，但地图无区域。保留专属失败记录，未提升完成数。
- 对照真实 MapsWorkspacePage 路径，区域应用需要 activityHandoffs 和 activityDefinition 同时存在。休息分支通过直接 Activity authority 返回了 handoffs，却未适配 activityDefinition/activityAreaInstance；补齐为既有地图调用约定，不修改授权条件。
- 扩展 restAreaIntegration 到真实玩家请求结果 → 地图 handoff → restSessionId 断言。区域实例包含解析后的 shape/origin，测试按完整实例断言。相关 pluginFeatureAction 35 项与长短休串联 2 项通过。最终类型检查 7876 运行中。
- 全书原始配置仍待集中自动转换及行为认证；本轮付费 API 0，真实房间未修改。
- 类型检查 7876 指出成功/失败联合类型需要显式收窄，调整成功返回值后，最终类型检查 63105 exit 0。
- 浏览器复验 67716 在创建房间 POST 的 15 秒请求超时，尚未开始业务流程；服务已退出。仅将该冷启动建房请求 timeout 调为 60 秒，功能断言不变。最终进程 10708 exit 0，隔离房间 33X826 通过，证据 rest-area-room-33X826.json：真实 .starmod 导入及玩家模块同步、玩家休息开始创建区域、玩家保存状态带 restSessionId、刷新后入口禁用、Host 打断后玩家投影区域清零。
- 浏览器控制台记录一次 campaign-time reconciliation 的 maps-save-rejected:conflict；最终同步断言通过，未隐藏该日志，不把此次通过扩展为全部并发场景认证。测试服务退出后 6773/6774 无监听者。
- 审阅快照 r80 记录此代表性合成模块完整交互证据，仍保留源配置 partial 和 configurationStillRequiresRegeneration。原始炉心/全书仍需集中重转和各自规则验收。本轮 API 0，现有 5273/5274 未修改。

## 2026-09-29：批量对齐统一模块和 V2 活动入口

- 上轮为 progress：隔离休息区域流程 33X826 已通过。本轮回到全书公共导入连接，发现统一模块在同一特性有多个主动 Activity 时只编译唯一默认 action；无默认时多个按钮均丢失。V2 的 activeContentActivities 也仍只接受休息完成事件。
- 统一模块逐个注册受支持的特性/专长/子职业主动操作及休息选择，保留原有归属、grant、续段、Host 校验；不将普通触发监听器变为主动入口，不改变法术唯一施放入口规则。V2 补齐 short-rest-started/long-rest-started 筛选。
- 新参数化测试实际 .starmod 导出、导入、注册并执行特性/专长的两个活动，分别恢复不同 HP；未拥有、其他条目活动、监听器和缺失 ID 均拒绝。另对 V2 子职业四种休息事件验证归档重装后控制入口保持事件身份。
- 首批 unifiedContent/contentPackageV2 56 项通过；新增 V2 矩阵后 contentPackageV2/restAreaIntegration 38 项通过（两批有重叠，不相加）。类型检查 57047 运行中。SDK 文档已同步。本轮没有重复浏览器流程、没有 API 请求，原始配置通过数量未提升。
- 最终类型检查 57047 exit 0。此批接口及归档链路回归完成，全书原始配置仍待机制审阅与集中再生成，API 门槛保持关闭。

## 2026-09-29：执行绑定批次复用既有审阅

- 上轮为 progress：多 Activity 导入及 V2 休息入口已修复并通过类型检查。本轮对执行绑定类诊断使用原始自动转换产物离线审计，未编辑配置、未调用 API。
- fullbook-execution-bindings-20260929-r1.json 验证 15 个独立特性/专长条目均为 0 Activity，包含 22 条原始手动/部分声明；不是单纯 UI 隐藏问题。缓存来源 ID、种类、名称、原文严格匹配，转换必须声明 manualContentRepairs:false。
- 发现资源恢复、迫使豁免解除等旧限制已有精确审阅。audit-fullbook-manual-boundaries 增加 --review，先通过既有 coverage 校验，再逐来源/逐诊断精确关联；不把另一来源或附加条件继承为已实现，不提升认证。报告保留审阅哈希、原始声明与仍需重转标记。
- 8 项 Node 测试通过，包括来源隔离、诊断文字变化、歧义拒绝和不认证原始配置。本轮只改 Node 审计脚本与文档，未重复运行应用类型检查或浏览器。
- r2 报告的 43 条原始 unsupported 声明中，9 条已有可表达证据、1 条部分解决、33 条尚未审阅。匿影无踪的两条旧声明已有证据但原始配置仍空，必须留待集中重转；不能直接改 full 标签。报告范围只是该 15 项执行绑定批次，不代表全书剩余数量。API 0，全书目标保持进行中。

## 2026-09-29：独立特性/专长的等级与职业模板误判

- 上轮为 progress：15 项绑定批次已取得可复用来源审阅。本轮核对未审阅声明中的共同“旧 declarativeAbility 需要等级”理由。直接 Activity 的契约没有要求获得等级、职业归属或资源声明；unifiedContent 的归档往返测试实际执行不带这些字段的独立特性与专长，并保留所属条目资格校验。
- 转换指南明确优先用直接 Activity，禁止因为旧模板 level 必填就编造等级或跳过生成；真正的先决条件/资源消耗仍必须依据原文，不能据此宣称复杂机制完整。feature/feat/auto 三入口增加回归，指南与归档测试共 48 项通过。本轮只改指南文本和测试，不重复应用类型检查/浏览器。
- 不可变审阅 fullbook-mechanism-review-20260929-r1 与 coverage 同日 r1，将永生者赠礼、怠惰之枪、精灵之准的三个元数据/模板障碍标为接口可表达，严格限定来源和原诊断；具体治疗最大化、减速、攻击重掷仍不由此认证。原始三份草稿仍无 Activity，configurationStillRequiresRegeneration:true。
- 全书已审阅诊断 103→106；原始自动转换完成数未增加。其余机制审阅和集中重转继续，新增 API 0，真实房间未修改。

## 2026-09-29：法术命中跟随效果的回合与原目标约束

- 上轮为 progress：等级模板误判已核查。本轮从已验证 inventory-revision4 读取哈达之攫、怠惰之枪原文，确认均要求“每个你的回合一次”；现有合成例先前只有 once-per-turn，补上 turn-owner:actor，未改原始自动转换草稿。
- 加强归档后拉动地图测试：错误法术、未命中不打开窗口；其他生物回合由 Host requirements-not-met 在确认前拒绝，不移动、不提交。减速测试补其他回合拒绝，保留原目标防伪造、重复次数、存档和来源下回合结束到期。
- 初始测试误把候选列表当作最终授权，按实际“候选→Host资格→确认”分层调整断言；另发现原有放弃测试仍期待没有收据，与当前一次性答复防重放不符。补放弃后的地图/角色存档重载，确保不重复询问，且不占用一次每回合的使用键。
- 相关三文件合计 55 项通过（两轮修复仅重跑受影响文件；没有重跑应用类型检查或浏览器）。本轮产品运行时未改动，只加强已有链路测试和来源审阅。
- 不可变审阅/覆盖 20260929-r2 将哈达之攫的具体来源/目标绑定和每回合次数两项诊断标为接口可表达。已审阅诊断 108，仍需原始配置集中重转；不得据此把空 Activity 草稿标为完成。付费 API 0，真实房间未修改。

## 2026-09-29：属性与技能组合筛选的公共接口

- 上轮离线批次清单已更新，本轮继续真实接口缺口。核对缓存飞蝇斗篷原文：魅力（威吓）优势，其他魅力检定劣势。原 ability-check 契约承诺属性与技能同时匹配，但执行器将其拆成两个列表，造成 OR 扩大范围，且没有排除技能字段。
- 新增结构化 abilityCheckRules 存储与 excludedSkills 作者接口，校验、深拷贝、归一化和持久化均保留筛选条件。已有单属性/单技能配置继续兼容；组合条件不再展开成两条独立优势。排除仅限本修正，其他来源劣势仍能抵消优势。
- 接入角色检定、普通 Host、host-derived Activity、躲藏以及擒抱/推撞路径；后两者此前也漏读技能模式/属性劣势，现一并读取。更新转换指南与 SDK 文档。
- 新增合成矩阵覆盖普通魅力、威吓、游说、其他属性、Activity 配置编译、保存重载、效果暂停与非法选择器拒绝。普通 Host 原有非标准技能属性组合校验继续拒绝，未改变该授权边界；辅助模式和 Activity 检定验证组合筛选本身。
- 第一轮夹具缺战斗 ID 和对立参与者，修正后四文件共 138 项通过；另三个相关文件 333 项通过，合计 471。类型检查 28941 发现构造器漏映射新字段和测试夹具缺 position/concentrating，补齐并重跑新增 11 项通过。最终类型检查 87605 运行中，沿原进程收取结果。
- 不可变审阅/覆盖 20260929-r3 将精确来源的技能筛选诊断标为接口可表达，已审阅诊断 109；仍保留原始配置待集中重转，未认证该能力伤害灵光或全书。API 0，未修改真实房间。
- 最终类型检查 87605 exit 0。本批公共检定筛选接口与相关回归完成；不提升原始自动转换配置完成数，付费转换门槛保持关闭。

## 2026-09-29：来源属性区域伤害与全掩护缺口分离

- 上轮公共检定筛选已通过类型检查。本轮核查持续区域共享机制，发现伤害已有 modifierFormula 的 ability-modifier 和 count:0 支持，不需要新增同义接口。
- pluginAreas.test 新增四组真实地图事务：来源魅力 6/10/18/20，目标魅力 30，确认伤害分别 0/0/4/5；经过 JSON 地图重载、候选收集、Host prepare/resolve、角色 HP 回写及每回合收据。验证读取来源而非目标、不提前掷骰、负调整值不治疗、不修改输入。
- 初始新增夹具误把 map 传给 recordDnd5ePersistentAreaTrigger，修正为区域数组、候选与 round 后，四项通过；首轮既有 68 项通过，合计 72 项，后续只重跑受影响四项。仅测试和审阅更新，未修改运行时，未重复类型检查和浏览器。
- 确认实质缺口：persistentAreaGeometry 的 requiresLineOfEffectFromAnchor 仅过滤 occupantModifiers；普通 tokenIntersectsAreaAt、伤害候选和最终 resolver 没有对应伤害触发全掩护检查。requiresSourceVision 是视线要求，不等价，不能当替代修复。下一步应为触发声明、归一化、地图候选、Host 准备与最终结算补一致的来源到目标效果线条件，并验证动态墙、透明墙与黑暗区别。
- r4 审阅误用了不在枚举内的 decision，保留但不作为有效快照；r5 已使用 partially-addressed-by-current-runtime 并通过 coverage 校验。最新有效审阅/覆盖为 20260929-r5，110 个诊断已审阅，原始能力与全书未认证，配置仍待整批再生成。
- API 0，真实 5273/5274 未修改，全书目标仍进行中。

## 2026-09-29：区域触发来源效果线

- 上轮验证来源属性区域伤害并定位全掩护缺口。本轮新增 triggers.requiresSourceLineOfEffect，声明/快照归一化保留布尔值、非法值拒绝。没有用 requiresSourceVision 代替物理效果线。
- 地图候选通过既有 mapGeometryCoverBetween 检查来源到目标；普通移动使用当前路径点和高度，来源移动使用 afterMap。Host prepare 使用权威地图快照的有向效果线，最终 resolver 再查一次，旧候选遇到新墙不能提交伤害。
- 扩展四组来源属性真实地图事务测试，覆盖透明但阻挡效果的墙、只阻挡视线的墙、两者均阻挡，另直接验证最终 resolver 拒绝有向效果线阻断。各测试清理 geometry runtime，不触及真实房间。
- 四文件 133 项通过，类型检查 23364 运行中。SDK 和转换说明同步。此条件专门指向当前来源 Token，不能当成固定区域中心传播语义。
- 本轮 API 0，源生成配置仍待整批再生成与验证，全书目标保持进行中。
- 最终类型检查 23364 exit 0。最新有效审阅/覆盖为 20260929-r6，来源属性区域伤害诊断从部分解决更新为接口可表达，仍保留原始配置再生成和全书未认证。

## 2026-09-29：治疗骰最大化的 Activity 路径统一

- 上轮区域全掩护接口通过类型检查。本轮批量审阅独立特性/专长诊断，定位治疗骰最大化的已有接口接线缺口：compiled Activity 只读取 beacon-of-hope 旧状态，direct Activity authority 完全没有投影此属性，核心结算则已读取通用修正。
- 统一 dnd5eActiveMaximizeHealingDice 兼容通用效果和旧法术状态，三条快照复用同一读取器，保留 suspendedBy 排除。未新增法术专属结算。
- 四组真实 Host E2E 以 direct registered Activity 与 compiled plugin 两条入口结算，覆盖通用效果、旧状态、被压制及缺失，经过 JSON 存档；2d8+3 实骰1/2的最终治疗分别为19或6，固定+3保持不变，输入HP不变。四文件462项回归通过，类型检查3634运行中。
- 核对缓存永生者赠礼原文仍要求链之魔契与100尺内自身魔宠。当前通用 owned-companion 谓词仅校验所选目标归属，没有证明“受治疗者与当前魔宠距离”作为被动动态条件；不能用无条件最大化冒充完整实现。最新审阅/覆盖20260929-r7将该诊断标为部分解决，111诊断已审阅，源配置仍待再生成。
- API 0，无双端房间重跑，无真实5273/5274修改，全书目标继续。
- 最终类型检查3634 exit 0。通用治疗骰最大化快照接线修复完成；附带魔宠距离条件的来源能力仍未完整认证。

## 2026-09-29：原生法术与区域治疗的最大化修正

- 上轮 Activity 双入口治疗骰最大化已通过类型检查。本轮检查动态伙伴条件所需输入前，沿治疗路径发现原生 spell.effect:healing 与持续区域治疗仍绕过通用效果。先修复基础接线，避免将条件投影到一个只在部分治疗入口有效的属性。
- 原生治疗按各受治疗者效果决定骰最大化，保留生命领域17级施法者能力及固定加值；不把施法者自己的最大化效果传给其他受治疗者。区域治疗在骰合法性验证之后计算有效骰值，结算日志同步有效骰值、固定加值与总量。
- 新增 recipient/caster/suspended 三组原生治疗存档测试，及区域效果开启/压制两组测试，保留非法骰值拒绝和输入不变断言。三文件370项通过，类型检查90200运行中。
- 此轮未实现魔宠100尺动态条件。进一步审计发现 healing-touch、self-healing 怪物分支和 druid-creature-form-heal 也有独立骰池路径，尚未证明读取该通用修正；短休生命骰、药水和其他恢复路径同样需要一起核对。不能宣称所有治疗都已接入或永生者赠礼完整可用。有效审阅仍为20260929-r7的部分解决。
- API 0，未重复浏览器、未修改真实房间，全书目标继续。
- 最终类型检查90200 exit 0。原生法术与区域治疗的接线修复验证完成；其他独立治疗骰池及动态伙伴距离条件保持待处理。

## 2026-09-29：独立治疗骰池批量接入

- 上轮修复原生治疗与区域。本轮集中核对并接入 monster healing-touch/self-healing、fighter-second-wind、druid-creature-form-heal、短休生命骰和休憩曲、治疗物品。读取受治疗者通用最大化效果，保留固定加值、原始骰合法性与次数/资源消耗。
- 药水交易骰账同步有效治疗骰值，不把原始低骰总量当成实际恢复量；无骰固定治疗仍保持原值。短休逐枚体质加值和原最低值规则保留，休憩曲仍只算一次。
- 首批 hitPoints/items/monsterHealingTouch 三文件83项通过；第二批 headless/genericCombatPrimitives/monsterHealingTouch 共333项中331通过，两项新增夹具把修正错误地放在顶层而未创建效果。类型检查44514 exit0 后仅修正这两项夹具为真实ActiveEffect，再针对性重跑。
- 新覆盖包含效果暂停、非法骰、药水账目、资源扣除、形态生命值同步及输入不变；两批存在 monsterHealingTouch 重叠，不能直接相加。
- 条件来源能力仍保持部分解决：尚未实现魔宠归属及100尺动态范围校验，未重新生成原始配置，未提高全书认证数。当前有效审阅20260929-r7。
- API 0，真实房间未修改，全书目标继续。
- 两项夹具修复后的针对性测试通过；移除夹具残留无效顶层参数。六个相关文件的全部测试均已有通过结果，类型检查44514通过；其后仅夹具修正，不重复完整类型检查。

## 2026-09-29：地图级所属伙伴距离查询基础

- 上轮独立治疗骰池已接入通用最大化。本轮核对动态条件的数据来源，发现 mapBridge 只投影有 initiative entry 的 Token，不能据此否定未参加先攻的魔宠；因此附近伙伴查询直接读取当前地图，而非战斗参与者列表。
- 新增 ownedCompanionProximity 数据契约与地图查询：要求显式 bondKey 或 packageId/activityId，严格匹配 sourceTokenId 及存在的主人 characterId；拒绝遣散、失控、0HP/未知HP、已到期或缺必要世界时间的召唤物。使用现有三维 footprint 距离，不要求视线、无墙或主人清醒。geometry:null 表示已确认无几何，undefined 才读运行时。
- 20项测试通过：100尺边界、移出返回、JSON重载、无先攻条目、移出地图、跨主人/角色/模块/活动/绑定、遣散/死亡/过期、缺失时间和高度；实体墙不额外限制纯距离条件。类型检查79825运行中。
- 本模块目前是基础查询，尚无治疗调用方，不得声称永生者赠礼已接入或修改其部分解决审阅。下一步：持久化条件声明→Host地图上下文投影→Activity/core/区域/怪物/药水/短休读取；地图外不能沿用旧布尔结果或把未知距离视为通过。原始自动转换配置仍待集中再生成，最新有效审阅仍为r7。
- API 0，无真实房间改动，全书目标继续。
- 类型检查79825 exit 0。伙伴距离基础查询验证完成；声明与各治疗结算入口的动态接线仍待实现。

## 2026-09-29：有条件治疗最大化的声明与存档

- 上轮地图级伙伴查询通过20项测试。本轮新增 maximize-healing-dice.whenOwnedCompanionWithin 作者声明，编译为独立 maximizeHealingDiceNearCompanion 查询列表，不转成无条件布尔效果；同步严格校验、深拷贝、归一化、ActiveEffect留存条件及核心效果应用参数映射。
- dnd5eActiveMaximizeHealingDice 增加可选 Host 地图上下文，实时调用伙伴查询；缺少上下文时有条件分支为false，无条件与旧法术兼容保持。查询拒绝未知键，避免把新增限制静默忽略。
- 三文件138项通过，新增测试走 Activity声明→效果提案→机械效果→JSON存档归一化→实时地图查询，覆盖移出返回、暂停、无上下文、非法查询和嵌套对象独立。类型检查64506运行中。
- 此次仍未让各治疗入口自动传入地图上下文，不能宣称来源能力已工作；不更新原始配置或其部分解决审阅。下一步需Host侧上下文桥，包含不在先攻中的伙伴，并在同一事务内移动/遣散/死亡后重新求值；不能保存一个过期布尔状态。药水 options 目前只有 turnEconomy/transaction，短休 UI 直接调用 hitPoints，均需明确地图授权上下文。
- API 0，真实房间未修改，全书目标保持进行中。
- 最终类型检查64506 exit0。条件声明与持久化层验证完成；Host地图上下文自动接线仍是下一步，原始来源能力未完整认证。

## 2026-09-29：药水 Host 条件上下文与短休规则入口

- 前一轮仅确认批处理计划，属于无实现进展；本轮继续实际接线，未调用付费 API。
- items 与短休结算增加可选 healingContext；公共角色匹配函数只接受 ownerTokenId 对应 characterId 与受治疗者一致的上下文。药水实际恢复值和事务骰账使用同一条件。Host item coordinator 传递上下文，MapsWorkspacePage 使用 authorityMap、目标 Token（自用时施用者）、当前回合及场景时间，不接受客户端最大化布尔值。
- 本地三个文件96项通过（ownedCompanionProximity/items/hitPoints）。新增5个跨入口场景：有效范围、超距、误用施药者的魔宠、无上下文、遣散；通过 Host 药水结算验证HP与骰账，短休验证生命骰、体质与休憩曲。最初测试误选默认装备而收到not-usable，修正为按药水templateId定位后整批通过。
- 短休界面尚未传入上下文；CampaignTimeAdvance没有mapId，需在休息权威来源明确地图而不能随意选择另一个角色实例。Activity/core/区域/怪物治疗上下文与链之魔契前提仍未全部接通；原始来源能力保持partial，审阅r7不变。
- 类型检查18412运行中；API 0，5273/5274房间未改动。全书导入目标保持进行中。
- 最终类型检查18412 exit0。药水Host接线与短休规则接口通过验证；短休地图授权来源及其余治疗入口仍待接线，不构成全书或来源能力完成认证。

## 2026-09-29：Headless 条件治疗地图桥

- 上轮药水Host与短休规则接口为实际进展。本轮把当前地图中未参加先攻的伙伴纳入只读companionScene事务快照，保留网格/高度几何、来源绑定及可选世界时间；MapsWorkspacePage的地图快照调用传入已校验房间归属的场景时间。
- 新增headlessCompanionHealing，按本事务的受治疗者Token读取伙伴距离。已投影生物叠加当前位置、高度、体型、HP和控制权；从事务移除的生物不能回退成地图旧Token。未入先攻的伙伴从快照读取。纯距离条件不增加视线限制。缺场景或mapId不符时不启用有条件最大化。
- 接通原生法术治疗、持续区域治疗、怪物触碰/自疗、回气、形态治疗及三个Activity快照入口。遣散结算不可变更新场景中的匹配伙伴，避免同一事务后续治疗继续使用已遣散伙伴；失控/控制结束也使条件失效。
- 六文件481项通过：ownedCompanionProximity、ActivityCombatE2e、mapBridge、headlessCombatEngine、monsterHealingTouch、persistentAreaHealing。追加死亡/失控/遣散边界后三文件54项通过（含前述27项，不能相加为535）；新增近距/远距用例走直接注册和编译插件两条Activity路径，非先攻魔宠走真实mapBridge与回气，验证JSON恢复、事务移动、地图重建及输入不变。
- 首次类型检查77005发现三个map回调漏传state、Token体型类型推断和测试resourceKey缺失，已修复。最终类型检查86949运行中。
- 尚未完整：短休界面的授权地图来源、所有非MapsWorkspacePage快照调用的可选时钟、链之魔契资格前提、原始PDF自动生成该条件的整链认证。原始审阅r7保持partial，不以合成测试宣称全书已完成。
- API调用0；未改动5273/5274房间。继续全书目标。
- 类型检查86949仅剩新增边界夹具问题：dismissed是true字面量标记而非boolean，遣散提案缺operationId。修正为删除标记并提供operationId后27项重跑通过；最终类型检查22563运行中。补充SDK条件声明、缺上下文策略及资格边界文档。
- 最终类型检查22563 exit0。本轮Headless地图条件桥通过验证。下一批优先统一prepareDnd5ePersistentAreaTrigger/classFeatureAction等快照入口的Host时钟，以及CampaignTimeSystem→Dnd5eShortRestRecoveryActions的休息地图授权来源；保持原始PDF整链验收未完成。

## 2026-09-29：主要治疗入口时钟透传与转换契约补齐

- 上轮Headless地图桥已实现并验证。本轮集中接通10个prepare模块：classFeatureAction、fighterFeatureAction、adjudicatedSpellAction、coreSpellAreaAction、pluginAreaTransactions、monsterSpecialAction、monsterAreaAction、spellAction、pluginFeatureAction、pluginSpellTransaction。它们将可选worldMinute送入地图快照；MapsWorkspacePage实际调用使用readBrowserSceneWorldMinute，插件两条入口复用原有Host时钟参数，不接收玩家提交的条件布尔值。
- AI转换指南补齐Dnd5eOwnedCompanionProximity的内联依赖声明和条件最大化用法，明确绑定来源、资格分离和未完成限制。此前Effect协议虽引用该类型，但指南没有展开，不能假定模型已获得完整接口。
- 新增6个行为场景：回气和区域治疗分别用99、100、undefined时钟验证控制到期/遣散到期100的边界。99时最大化，达到截止或缺时钟正常骰值；伙伴不必加入先攻。通过真实prepare→Headless→地图/角色应用链验证。
- 首批4个有效文件156项通过（pluginAreas/localContentAiSdkGuide/classFeatureAction/monsterAreaAction）；fighter测试重复import导致解析失败，删除重复import后与pluginFeatureAction/pluginSpellTransaction/adjudicatedSpellAction四文件223项通过，合计8文件379项。没有重复调用付费API。类型检查1522运行中。
- 短休排查：CampaignTimeSystem→Dnd5eShortRestRecoveryActions仅有advance和characterId，CampaignTimeAdvance没有mapId，玩家界面直接saveSharedNow；不能任意从多地图同角色副本选择上下文。此项需要明确的Host休息来源/权威结算接线，尚未实现。回合触发等其他地图快照时钟调用仍应继续审计。
- 原始PDF自动转换认证仍未完成，审阅r7不变；真实5273/5274房间未动。API 0，目标继续。
- 最终类型检查1522 exit0。主要治疗入口时钟透传与AI契约依赖补齐已验证；短休Host地图来源、剩余触发入口及来源资格与全书再生成认证继续保持未完成。

## 2026-09-29：回合与移动触发链的条件时钟

- 上轮主要主动入口时钟透传为实际进展。本轮接通Dnd5eBeginTurnContext、prepare/resolveDnd5ePlayerEndTurn及对应页面调用。回合窗口建立的Headless状态现在保留Host世界时间，供后续Activity治疗条件读取。
- MovementHazardCoordinator在每一步重建地图快照时保留本次显式Host时钟；未显式提供时保留已结算状态或原事务快照的时钟，不因刷新地图而把已知时间丢失。页面调用提供房间匹配的场景时间。
- 三文件40项通过（beginTurnAction/endTurnAction/MovementHazardCoordinator）。新增开始与结束回合的到期99/100/缺时间条件判断，伙伴未加入先攻；移动测试同时验证先攻特殊槽位与worldMinute保留。
- 类型检查25544运行中。短休复查确认CampaignRestSession也仅记录角色与起止时间，没有地图身份，当前UI又直接保存HP/生命骰；不能假定休息对象当前地图已被Host固定。这一缺口保留，需单独接通权威休息消耗入口，不用任意地图兜底。
- API 0，5273/5274未修改；全书目标、原始审阅r7及未完成状态保持。
- 最终类型检查25544 exit0。回合开始/结束、移动Hazard快照刷新时钟接线已通过验证。短休权威消耗入口、来源资格和完整全书再生成/导入验收仍待完成。

## 2026-09-29：短休权威结算内核与重放记录

- 上轮回合/移动触发时钟接线为实际进展。本轮核查现有短休按钮：它直接applyAuthorityUpdate并saveSharedNow，休憩曲是否使用仅在React本地状态保存；尚无Host请求路径或持久化去重，不能直接接地图条件后宣称安全完整。
- 新增shortRestRecoveryAuthority：命令只含角色/地图/Token/短休advance/骰池及预期余额与可选吟游诗人ID。Host上下文提供可控角色、真实角色与地图、世界时间、已完成短休记录、骰值和已确认可听见休憩曲的吟游诗人名单。校验归属、短休受益人、时间与长度、战斗状态、地图Token、骰池并发余额；调用现有治疗解析器进行伙伴条件与治疗骰最大化。
- 返回角色和版本化journal供调用方原子保存。保存请求命令和结算结果用于相同请求重放；同ID改参数拒绝。按短休/受益人记录休憩曲使用，换请求ID也不能重复领取。重放不会再次扣骰/治疗；不进行隐式保存或选择地图，不把客户端参数当作Host资格判定。
- 三文件59项通过（新模块13项、hitPoints、ownedCompanionProximity）：近距最大化、JSON恢复与重复请求、下一枚生命骰、重复休憩曲、同ID改Token、归属/地图/Token/余量/过期记录/受益人/战斗/吟游诗人资格/非法骰拒绝、魔宠超距/遣散/到期；输入保持不变。类型检查运行中。
- 本模块尚无生产调用方，UI仍走旧路径，不能声明短休已接入或清除来源能力partial。下一步需要房间Host命令、已确认地图来源和角色+journal原子提交，再切换按钮及验证断线/冲突。API 0，真实房间未动，全书目标继续。
- 最终类型检查4359 exit0。补充接线调查：已有appendSharedPlayerActionRequest与saveSharedResourcesAtomically可复用；独立submitSharedPlayerCharacterCommand由shared-server-core.mjs的同步JS reducer处理，不能直接假定它会执行新TS内核。需选择并完成明确的Host路由/存档契约，再启用按钮，当前仍无生产调用方。

## 2026-09-29：短休记录资源与HTTP原子提交验证

- 上轮结算内核及重放测试为实际进展。本轮新增共享dnd5e-rest-recovery资源，浏览器/服务器共用严格journal验证：版本、请求字段、ID唯一、合法非负治疗值和记录容量；内核拒绝损坏或已满journal。纳入Host原子事务及DM撤销资源集合，不加入玩家可写名单。
- 新增publishDnd5eShortRestRecovery：运行内核后，将characters/maps/journal一次提交；要求3个写资源的确切版本和campaign-time/combat/map-geometry只读依赖版本。校验地图来自传入的同一快照；冲突必须重新规划，不能用新水位覆盖旧地图。网络/模糊冲突后只有匹配的已落盘receipt能证明成功，不重放旧角色或地图。
- 临时HTTP服务器（测试端口5492、临时sharedRoot）已验证：地图版本冲突时HP/骰池/journal全部不变；读取实际新地图重规划后原子提交；模拟提交成功但回复丢失后由持久化receipt恢复；玩家伪造清除journal得到403；重复ID的损坏journal得到422且characters不被同时覆盖。定向HTTP1项通过，另内核/共享校验30项通过。
- 正在运行完整sharedServerCombatTransactions回归27443与类型检查83509。真实5273/5274未触碰，API调用0。
- 限制：publisher目前仅被集成测试调用。尚须实际Host请求路由、请求日志读取/保存、界面请求与ACK/重试、明确休息地图和吟游诗人可听资格，不能宣称玩家短休自动化已完成。原始来源审阅r7仍partial，全书目标保持。
- 完整HTTP共享事务回归27443：34/34通过；最终类型检查83509 exit0。另30项规则/校验通过。下一步生产Host路由与玩家短休界面接线，当前publisher无生产调用方，保持未完成。

## 2026-09-29：短休生产Host路由与控制器

- 上轮journal与原子发布验证为实际进展。本轮新增共享行动类型dnd5e-short-rest-recovery及负载（advanceId/骰池/期望余额/可选bard）。Host外部信封决定命令ID、地图、Token、角色，不能由嵌套负载覆盖。通用归属校验后仅允许非战斗且无combatId的短休请求；展示分类none。
- MapsWorkspacePage新增实际Host分支，调用runShortRestRecovery、Host骰箱、休憩曲DM确认、重新加载角色/地图和ACK。控制器从独立共享快照读取角色、地图、时间、战斗、几何及journal确切版本；验证房间角色/切换、玩家所属；journal回执存在时不重新骰。听觉条件/生物状态与DM演奏确认决定休憩曲资格；Host请求序列已有锁，控制器不嵌套获取同一scheduler。
- HTTP实际控制器测试扩展到读取已落盘角色/地图/时钟/journal，经runShortRestRecovery→内核→publisher→真实临时服务器：其他玩家请求拒绝且不骰；合法请求恢复并扣一骰；重发同ID不再骰、不再提交。路由/HTTP三文件68项通过，展示13项通过。类型检查70752运行中。
- 限制：玩家Dnd5eShortRestRecoveryActions按钮尚未切换，仍直接写角色；新增Host路由尚没有实际按钮发出请求。下一步客户端ACK/持久化重试、明确地图Token选择、按钮替换和隔离DM/player浏览器验证。API 0，真实房间未动，原始来源/全书认证仍未完成。
- 最终类型检查70752 exit0。Host生产分支与实际HTTP控制器回归已通过；客户端按钮仍未接通，保留下一步与未完成状态。

## 2026-09-29：玩家短休请求与持久化重试接线

- 上轮Host生产路由及HTTP控制器通过验证。本轮新增shortRestRecoveryClient并切换Dnd5eShortRestRecoveryActions的room player分支：仅提交短休ID/骰池/期望余额/地图Token/可选bard，不客户端骰、不先写HP或生命骰；收到权威持久化receipt后重新载入characters/maps并显示结果。
- 客户端将完整待处理命令存于按room/member/character/advance隔离的localStorage键。超时、刷新或append网络错误保留原ID；重新读取journal已有receipt则直接恢复，不重复入队。待处理期间更改选项拒绝；明确拒绝清除pending。仅accepted ACK不足以确认治疗成功，需journal回执；切换房间立即中止，其他成员ACK不影响该请求。
- 玩家短休位置来自当前地图，单一角色Token可直接确定；多个Token须显式选择，未找到则不提交。非room-player的本地/DM旧路径暂保留，法术位恢复路径本轮未修改。
- 三文件48项通过（shortRestRecoveryClient6项、shortRestRecoveryAuthority13项、playerActionAuthorityRouter29项），覆盖持久化重试/仅ACK/改参数/拒绝/他人ACK/房间切换。类型检查59575运行中。
- 尚待隔离真实DM/player浏览器验收：按钮→服务端队列→Host页面→共享记录→玩家刷新；多请求ACK覆盖、同图重复Token和本地/DM路径也需继续评估。不能用客户端mock单测替代双端验收；来源/全书认证仍未完成。API0，真实房间未动。
- 最终类型检查59575 exit0。玩家房间分支已实际调用请求客户端，Host路由已有生产接线；隔离双端浏览器验收仍待执行，不将静态接线等同于全链路通过。

## 2026-09-29：批量验证策略与短休隔离浏览器未通过记录

- 按用户要求：停止逐条修复后调用付费转换 API；先按机制补齐接口及配置、集中运行本地确定性检查，达到集中验收条件后才使用付费批量转换。复用已有输入、固定测试数据和转换产物；失败按共用机制归组，禁止自动反复整本付费重试。
- 本轮仅修改隔离 Playwright 验证脚本，未更改产品结算规则。使用独立临时 sharedRoot、6773/6774 及空 AI 配置目录，未操作真实 5273/5274 房间。API 调用 0。
- 首轮创建房间请求 15 秒超时；改用既有隔离脚本的 60 秒创建超时。后续运行62498进入玩家投骰提示，但脚本只确认 DM，未确认玩家投骰，journal未生成。脚本增加玩家“确认并投掷”步骤。
- 运行63601（房间HC3SEK）exit1：读取 dnd5e-rest-recovery 的 GET 请求15秒超时，双端结算尚未验证成功。日志 .codex-logs/short-rest-browser-result.txt；私人审计 local-import-tests/short-rest-room-HC3SEK.json。保留失败，不降低断言或宣称端到端通过。后续需集中诊断隔离服务器/浏览器流程再复验。
- 先前本地48项与类型检查59575通过的证据仍有效，但不代替此次失败的双端验证。全书自动转换、来源认证和其余机制覆盖仍未完成。

## 2026-09-29：职业法器资格与具体库存武器绑定

- 上轮产生隔离浏览器失败证据，本轮属于实际机制实现进展。新增 weapon-enchantment.spellcastingFocusClassIds：声明非空无重复职业 ID，Host 从真实库存实例绑定，拒绝弹药容器及没有库存身份的武器。活动契约、校验、效果生成、复制、归一化和严格存档校验同步接入。
- dnd5eHeldSpellcastingFocus / Matches 与 dnd5eSpellComponentCheck 读取当前有效绑定，仅持握、鉴定/同调合格的准确实例为相应职业提供法器；不同实例、不同职业、悬置、移除、收起不能继承。昂贵/消耗材料仍被独立材料机制约束。沿用现有库存效果转交/悬置机制，不永久改写装备模板。
- SDK 文档和 AI 转换说明同步，明确该字段不自动解决契约武器选择、职业先决条件或既有加值规则。没有直接修改书籍生成配置以冒充转换成功。
- 本地五文件71项通过（weaponFocus、spellComponents、weapon binding eligibility、inventory binding route、activeEffects），执行31448 exit0。类型检查6181 exit0。新增用例验证 Host 生成→效果 JSON 持久化→材料检查及失效边界；不代替原始来源自动转换或浏览器验证。
- 私有审阅r8、覆盖r8已生成并通过作用域/哈希审计。进阶契约武器对应诊断保持 partially-addressed-by-current-runtime；覆盖112诊断、834未审阅链接、21部分链接，121条目仍需机制审阅。其他未解决范围与全书目标不变。
- API调用0；未重新进行付费转换，未触碰真实5273/5274房间。下一步集中处理剩余物品资格/加值与其他机制；双端超时问题仍待修复与复验，完整自动导入尚未认证。

## 2026-09-29：重骰自然骰值门槛与编辑保存

- 本轮继续共用骰值干预机制，实现 d20-choice-reroll.triggerD20Values，限定非空、不重复的1..20点数集合；缺少Host骰值上下文或不匹配时不提供条件性能力。省略字段保持旧行为。自身投骰与针对自身的攻击重骰两个生产入口均传入实际d20，不使用检定总值替代。
- 原有 must-use-latest 已支持，新增注册专长→资格筛选→实际重骰确认结算组合测试，验证玩家选择原值不能绕过Host策略。专长编辑器原先会把导入配置重置为单骰/自由选择；现保存源配置的额外骰数、选择策略和新增门槛，避免编辑后扩大使用范围。SDK与AI转换说明同步。
- 四文件41项通过，执行56825 exit0：新自然骰值资格、声明式职业/专长、重骰确认、投骰中断策略。覆盖缺失上下文、非法/不匹配骰值、归属/资源耗尽、旧声明兼容及必须采用更低的新骰值。类型检查50477正在运行。
- 明确限制：此门槛不是优势/劣势池中任意一枚骰的条件；不增加盟友范围、反应消耗、半身人幸运暂时禁用或按攻击属性限定优势重骰。因此不将慷慨吉运、精灵之准或花开二度标记完整支持，不更新原始PDF配置或完成数。
- API调用0，真实5273/5274未动。全书目标保持进行中；按机制批量实现，不为此单项调用付费转换。
- 最终类型检查50477 exit0。41项本地测试与生产调用接线已验证；尚未做本组完整扩展配置的自动转换及双端认证，完成数不提升。

## 2026-09-29：重骰结果恢复与重复点数的来源记录

- 上轮为实际机制实现，本轮继续检查生产重骰结算及重放。settleD20RollConfirmation 现在优先复用 payload.rollOptions 保存的 Host 骰值；原骰或贡献编号不匹配、传入新骰与保存结果矛盾时拒绝，不重新选择随机结果。持久化骰数和点数严格校验，不再用 Number 强制转换非数值数据。
- must-use-latest 的 selectedIndex 固定指向最后一枚新骰；原骰与新骰相同点数也记录真正采用的新骰，并写入替换轨迹。原实现使用 indexOf 会错误返回原骰索引。玩家自由选择仍须明确选择，刷新不会默认接受。
- 四文件38项通过，17527 exit0：新增JSON恢复/同点数来源/未选择等待/矛盾检查点/非法结果，并回归原重骰、中断同步和自然骰值资格。类型检查22128运行中。未修改书籍生成结果，API0，真实房间未动。
- 发现独立未解决问题：MapsWorkspacePage handleD20RollContinue 先 spendRoomCharacterClassResources，再 answer/finish中断。RoomCommandBus.completed 为内存Map；roomCommands的资源扣除只保存characters，现有测试重复调用同一存活Bus，不能证明页面刷新后幂等。扣资源成功而中断提交失败的窗口仍可能重复扣除或退回原骰。下一步应将资源扣除与对应结算/收据一次原子持久化，并测试：刷新重放、同ID异负载、提交成功回复丢失、CAS冲突、资源不足及玩家伪造；不能仅增加本地缓存宣称解决。
- 本轮只证明保存的骰值恢复与选择结果一致，不证明资源原子性，也不认证完整扩展能力；全书目标保持进行中。
- 最终类型检查22128 exit0。本轮38项测试通过；跨刷新资源扣除的原子性仍是下一步未解决项，未提升全书完成数。

## 2026-09-29：重骰资源扣除与中断完成原子提交

- 上轮确认内存Bus不足以证明刷新幂等。本轮新增 commitD20ChoiceReroll，并实际替换 MapsWorkspacePage 的 choice-reroll 结算分支：重新读取共享characters和combat-interrupts，由保存的Host资格/贡献/骰值重建结果，将资源扣除及中断done/response在同一CAS事务提交。该分支不再先走spendRoomCharacterClassResources后单独answer/finish，也不在失败时擅自回退原骰。
- 已完成中断可直接返回保存的结果；缺失/退休中断拒绝，不创建新扣费。真实版本冲突不自动换水位覆盖旧快照。网络回复丢失仅在重新读取到完全匹配的已完成结果时确认成功。拒绝非DM房间、房间切换、不同贡献、未保存骰值及不足的混合资源。
- 本地三文件32项通过；新增6项控制器行为测试验证原子写集合、重新调用/JSON读取防重复、丢失回复、CAS冲突、混合资源不足和Host/房间限制。
- 临时HTTP服务器5492、独立临时sharedRoot的完整35项事务回归通过（56200 exit0）。新真实HTTP用例验证：冲突时激励仍为1且中断未完成；重新读取后一次提交使激励为0且结果17持久化；模拟成功回复丢失能恢复；新调用不再次写入；玩家伪造双资源事务403。第一轮仅因toMatchObject把JSON省略的undefined字段当作缺项而失败，改成比较实际序列化响应后通过，未降低结算断言。
- 首次类型检查61147报告测试mock的泛型问题，已修正测试类型；最终检查96890运行中。产品逻辑未依赖修改已有自动生成内容，API调用0，真实5273/5274未触碰。
- 范围限制：本轮覆盖choice-reroll分支；预存d20替换等其他中断仍有各自资源路径，未统一迁移。浏览器UI刷新与长时间队列生命周期尚未独立验收；旧版本已扣资源但未保存完成的历史半提交无法据此自动推断恢复。全书原始配置认证仍未完成。
- 最终类型检查96890 exit0。本轮32项本地结算与35项真实HTTP事务测试通过；临时5492服务器已退出。仍保留上述UI/旧半提交/其他中断范围限制，不提升全书自动转换完成数。

## 2026-09-29：预存d20替换纳入相同原子事务

- 上轮choice-reroll原子提交是实际进展。本轮扩展同一结算器为commitD20RollResourceSettlement，并将MapsWorkspacePage预存骰替换生产分支迁入；移除原先先修改角色、saveCharacters、再answer/finish的分段写入。原choice-reroll导出保留为同一函数引用，未维护第二套结算逻辑。
- Host从持久化贡献确定替换值，校验原offer、当前角色真实持有的已注册特性及当前预存骰池。调用现有单枚消耗规则，与中断done/response一次CAS写入；相同点数的多枚骰只扣一枚。已完成请求读取原结果，不因刷新再扣同值另一枚；完成后的贡献ID/结果不一致则拒绝。
- 四文件75项通过：结算控制器、重骰恢复、确认协议、战役时间/休息资源；新增预存骰重复点数+丢失回复恢复、无资格/骰值耗尽拒绝、完成后修改贡献拒绝。真实临时HTTP服务器完整35项回归50223 exit0，验证已有重骰原子路径未退化；这35项未新增预存骰专属HTTP场景，不能据此声称预存骰浏览器验收。
- 类型检查82753运行中。API0，真实5273/5274未改动；没有重转PDF或修改书籍草稿自动化标记。仍需浏览器双端验证、其他修正类型与长生命周期核查；全书完成数不提升。
- 最终类型检查82753 exit0。75项本地行为测试及35项HTTP事务回归通过；预存骰专属双端/HTTP端到端证据仍需补充，完整源配置认证保持未完成。

## 2026-09-29：隔离短休双端与预存骰真实 HTTP 验收

- 短休浏览器测试 50692 exit0，55.1 秒通过。隔离房间 94QHCM，玩家实际点击生命骰并确认，Host 按合成角色的附近魔宠条件取最大骰值；HP 1→13，生命骰 3→2，玩家看到 Host 结算信息。双方触发刷新后，服务器仍保留上述结果且仅一条结算凭据。未额外断言刷新后两端 UI 完整重新加载，因此此项只证明刷新后的服务器持久化及此前的玩家展示。
- 私有审计：C:/Users/Doco/AppData/Local/StarsApp/local-import-tests/short-rest-room-94QHCM.json。合成数据、非 PDF 自动转换认证。记录含导航/刷新时 net::ERR_ABORTED，日志含既有 Konva 层数警告；不能称为无告警运行。测试修复了玩家投骰确认遗漏和请求超时，未降低 HP、骰池、凭据数量断言。
- 将真实 HTTP 原子事务验收参数化为 choice-reroll 与 stored-d20 两条路径。新增预存池 [7,7,12] 的场景：并发版本冲突不扣骰；一次成功提交只移除一个 7 并同时保存结果；成功回复丢失后恢复；新调用不再次写入；玩家伪造双资源事务返回 403。临时服务器使用独立目录。
- 首轮新增用例失败原因是合成角色仍为战士而等级写成法师；职业资格校验正确拒绝。修正测试角色职业与等级，未修改生产资格逻辑。最终 26088 exit0，两文件 45 项全部通过（36 HTTP + 9 控制器）。类型检查 56434 exit0，之后仅修正上述测试数据的 charClass/level 两个赋值。
- API 调用 0，真实 5273/5274 房间未改动。重骰/预存骰实际双端 UI 流程尚未完成独立验收；本轮不增加全书源条目自动转换完成数。全书目标仍 active，待批量配置再生成、剩余机制与导入导出全链路认证。

## 2026-09-29：无资源重骰的声明、导入与结算链路

- 上轮为 progress：实际补充了隔离短休证据与预存骰 HTTP 事务覆盖。本轮继续实现共享机制，不调用转换 API。
- 发现 d20-choice-reroll 在声明验证、专长导入、注册、资格投影和结果确认五层均强制至少一项资源，导致无次数消耗的被动重骰无法合法表达。现允许显式 cost:{economy:'none'} 或空 resources；资源非空时仍验证正整数消耗与专长自身资源引用，不允许隐式反应或动作。
- Host 资格投影仍要求已拥有特性、合法投骰种类/范围和自然点数条件。确认协议要求 Host offer 明确提供 resourceCosts 数组；空数组只表示无资源消耗，不绕过重骰策略。结算仍用已有原子事务保存完成结果、支持丢失回复恢复并防止重复写入。
- 编辑器保留导入的无消耗声明，不生成虚构次数池；对应次数/恢复字段显示为无消耗提示。更新 SDK 与 AI 转换说明。没有把含次数限制的原始能力改成免费能力。
- 五文件86项通过，覆盖自然点数、角色所有权、无资源池、强制采用新结果、非法成本、原子结算与刷新重放。新增包序列化→解析→安装验证无消耗成本和重骰策略不变；后续两文件50项通过（含既有36项 HTTP 事务回归，与前组有重叠，不能相加为独立用例数）。首轮注册器仍有强制资源检查，按失败证据补齐后通过。
- 首次类型检查17148 exit0；最后添加包往返断言及编辑器提示后，最终检查70434运行中。尚未单独做本轮编辑器浏览器验收，无资源重骰专属HTTP请求也未新增。
- 范围限制：无次数资源只是复杂骰值特性的一个组成部分；精灵之准的优势/攻击属性、慷慨吉运的盟友范围/反应/临时禁用等仍未实现，源草稿不提级。全书 API 门槛继续关闭，真实5273/5274未触碰，全书目标保持active。
- 最终类型检查70434 exit0。所有本轮进程已终止；验证通过范围与上述限制保持不变，未提升全书原始配置认证状态。

## 2026-09-29：优势攻击与实际属性限定的重骰路径

- 上轮无资源重骰为 progress（产品代码、包往返与测试已落地）。本轮检查发现优势双骰在地图入口显式跳过重骰，且资格投影没有实际攻击属性，无法表达精灵之准类条件。
- 声明新增 requiresAdvantage 与 attackAbilities。前者严格限制为 self-roll、attack、一枚追加骰与 highest 策略；后者校验六属性中的非空无重复列表，且仅适用于攻击。Host 根据生效优势模式与实际攻击属性提供能力，缺失上下文拒绝；不会把普通或劣势骰池误当优势。原有未声明优势处理策略的重骰不自动推广到双骰语义。
- 普通武器攻击从已准备 profile.attackAbility 传递属性；借机攻击从准备阶段保存实际武器属性。优势双骰后按稳定的骰池请求 ID 派生重骰窗口 ID，复用已有持久化 Host 追加骰/原子完成结算。合并保留原低骰，以 Host 最高策略结果替换采纳骰；不会压低原优势结果。原始双骰与追加骰仍各有投骰记录。
- 编辑保存、SDK 与 AI 转换说明保留新字段并明确未覆盖入口。导出→解析→安装测试验证无次数消耗、优势和属性限制及策略均保留。
- 初轮三文件58项通过；后续五文件45项通过（资格矩阵、原优势池合并、Host持久化highest策略、激励策略、借机攻击、原子结算）。包往返与合并最终两文件17项通过；各轮有重叠。首次类型检查88837仅报告测试response.finalValue可选类型，已加入明确存在断言并修复测试类型。最终检查38699运行中。
- 尚未覆盖所有原生法术攻击与Activity配方的攻击属性/优势双骰入口，也未浏览器验证本轮新增的窗口和中断恢复。只有武器及借机攻击生产路径接入；不能将整项精灵之准或全书条目标记为已认证。API0，未改真实5273/5274，未重转PDF或修改源草稿认证状态。目标保持active。
- 最终类型检查38699 exit0。上述入口与浏览器验证限制保持不变；本轮完成接口和武器路径，完整源条目仍未认证。

## 2026-09-29：Activity 与原生法术攻击属性传递

- 上轮为 progress：优势资格声明、武器/借机路径、打包测试已落地。本轮继续处理通用 Activity 和法术入口，API0。
- 新增 dnd5eActivityAttackAbility：仅从明确的 actor-ability-modifier、actor-spell-attack-bonus、actor-spellcasting-ability-modifier 及与常数/熟练加值组成的无歧义加法公式推导属性。固定值、竞争属性、目标属性或其他公式均返回未知，不按角色最高属性猜测。
- Activity 逐目标配方覆盖声明中的 attackAbility，以 Host 实际公式与本次选定施法属性生成元数据；非攻击骰清除该字段。插件法术 Prepared 保存已通过原有种族/职业/其他来源校验的 castingAbility。浏览器 Host 将新元数据传入统一重骰窗口，优势双骰只开放一次窗口，并沿用已验证的双骰合并。原生/插件常规法术攻击也传递实际属性。
- 固定加值魔法物品原本内部使用 int 占位施法属性。本轮为原生准备结果新增独立 attackAbility，固定 spellAttackBonus 或非角色施法物品不携带属性；不改变原命中加值。测试验证种族 CHA/INT 施法属性保留、固定+5物品没有属性资格。
- 第一批五文件153项通过，类型检查82899 exit0；后续原生法术与配方三文件218项通过（有重叠，不能相加为独立用例总数）。新测试覆盖实际施法来源切换、含糊公式拒绝、配方假属性被Host覆盖、伤害骰不携带属性、普通法术与物品既有回归。最终类型检查9768运行中。
- 剩余范围：Activity共享骰配方、若干特殊攻击/猜测位置入口、复杂公式显式属性表达及双端新增交互/恢复验收未完成。尚不能认证整项精灵之准；本轮未修改源草稿完成标记、未重转PDF、未接触真实5273/5274，付费批次门槛继续关闭。全书目标active。
- 最终类型检查9768 exit0。所有本轮测试进程已终止；新增路径的完整双端与源条目认证保持未完成。

## 2026-09-29：显式检定模式与共享施法者检定

- 上轮为 progress：Activity逐目标属性传递及常规法术入口已落地。本轮检查共享攻击发现其本来就不在编译契约内：攻击/目标豁免要求per-target，即使只有一个目标。因此保留shared攻击拒绝，不把该形状误当缺失的原文机制；SDK与转换说明明确这一约束。
- 修复过时兼容性限制：运行时支持显式优势/劣势，编译入口却拒绝。现沿用严格Activity定义验证，允许逐目标攻击/豁免的合法显式模式。新增四场景直接Host→编译插件对照，核验相同骰子得到相同HP结果、缺少第二枚骰拒绝且不修改状态。初轮48项E2E通过。
- 发现共享施法者属性/技能/专注检定在插件法术入口未收集；特性入口保留静态双骰数且缺少实际投骰者元数据。新增dnd5eActivitySharedRollDeclarationsV1，Host按当前状态统一计算模式、骰数、身份和检定类别；法术入口新增一次共享检定收集，特性入口和Headless权威骰子配方使用同一投影。随机/伤害骰不被转成属性检定，普通模式一骰、优势/劣势双骰，Host-derived旧双骰记录保留兼容接受。
- 测试区分旧式独立Headless动作与已注册Activity模块。前者仍按原声明骰数；后者新增正常/优势/劣势/抵消的真实Activity注册与双目标一次结算断言。首轮新增测试忘记注册Activity而收到invalid-dice，修正fixture并同时保留旧路径测试，没有放宽骰子校验。
- 最终三文件184项通过（共享检定、Activity战斗E2E、插件法术）。首次类型检查78530仅发现新增测试未缩窄direct结果类型，已加commit/ok守卫；最终类型检查50978运行中。API0，现有5273/5274未操作。
- 限制：新共享法术UI收集、专注检定具体状态组合和重骰窗口仍未独立浏览器验收；剩余特殊攻击及全书原始配置认证未完成。尚未重新转换或提升原始条目状态，全书目标继续active。
- 最终类型检查50978 exit0。184项相关回归通过；上述浏览器及完整源条目范围限制不变。

## 2026-09-29：重骰双端阶段恢复、免费策略与 Activity 骰池收尾

- 延续全书自动导入目标，付费 API 调用 0。沿用独立 6773/6774 与每次新建的临时房间根目录，没有操作真实 5273/5274 数据。
- 首轮浏览器审计 TRVLBH：highest 与 decline 已通过且刷新结果一致，owner-chooses 在追加骰确认前超时。定位到等待骰子仍使用 10 秒决定期限，以及服务端遗留 resourceCosts 非空限制。
- 服务端允许明确声明 resourceCosts: [] 的免费重骰；缺失/畸形成本继续拒绝。must-use-latest 在新旧点数相同时必须选最后一骰，不能错误索引第一骰。
- 所有已同意重骰先进入 rolling，投骰阶段恢复期限改为 120 秒；持久化 owner-chooses 选项后恢复 pending 并开启新的 10 秒选骰期限。服务端和本地队列一致，重发已存在选项不延长期限。仍保留投骰中断后的有限期回收。
- 独立双端房间 2AQXNG 三场景全部通过（12641 exit0，1.7分钟）：highest 消耗一次激励、decline 不重骰、owner-chooses 免费选原骰；每个场景刷新双端后队列结果/余额不变。私有审计 local-import-tests/d20-room-2AQXNG.json。测试从 Host 合成合法提议启动，并非原书条目或完整施法入口认证。日志有 ResizeObserver 警告，不影响这组断言，不宣称浏览器日志完全无错误。
- 扩展检查发现 Activity 玩家代骰与已确认检查点提前 return，绕过优势追加骰处理。统一 finalizeDicePool 收尾，保留单 d20 独立管线及 skipChoiceReroll 防重复；新增路径结构回归。另补上法术/特性 Activity 额外加减值骰的实际投骰 token，修复现有所有权检查发现的两个入口。
- 服务器策略 Node 测试3项通过。首轮两文件19项通过；扩大六文件197通过/2失败：既有地图灯光投影失败和额外骰缺少所有权，后者已修复。最终五文件25项通过（与前轮重叠）。首次类型检查14887报告贡献联合类型 featureId 未收窄，修正后16668 exit0。最终小修后的类型检查29714、双端复测18504及服务器定向测试47776运行中。
- 不改变全书原始配置认证状态，不提升155条目的完成率，不启动付费重转。完整 Activity 施法入口优势重骰的浏览器验收、特殊攻击入口与其他剩余机制仍未完成。全书目标保持 active。
- 最终类型检查29714 exit0；五文件25项通过、服务器原子变更定向24项通过、Node策略3项通过（各批次有重叠）。复测18504在加入隔离房间时 ECONNRESET，未进入交互，不算功能失败或通过；待类型检查结束后独立重跑67603。
- 最终独立双端复测67603 exit0（2.0分钟），私有审计 d20-room-NC9KU9.json：highest/decline/owner-chooses 三场景及每次双端刷新后的余额、队列结果均通过。仍有 ResizeObserver 警告。测试结束确认6773/6774无监听，所有本轮进程结束。完整源条目施法生产入口认证限制不变。

## 2026-09-29：带职业门槛的先攻资源恢复

- 上轮为 progress：共用重骰接口和隔离双端测试已完成。本轮重新读机制清单和原始提取文本，确认武士“耗尽时恢复一次、战士10级起”和魔射手“耗尽时恢复一次、战士15级起”的恢复诊断尚无对应接口；原 restoreOnCombatStart 仅回满，不能等价替代。
- 新增资源 combatStartRecovery，复用 restore/set/onlyWhenEmpty 的严格数值协议并可加 minimumClassLevel。声明式子职、独立特性、专长、资源注册/校验、Host角色资源投影和导出安装全部传递独立拷贝。新战斗参加者投先攻通过现有 Host combatStartCharactersFor → recoverDnd5eCombatStartResources 调用；普通同步不会恢复。指定策略覆盖战斗开始回满，短长休不受影响。职业门槛读取真实职业等级，未知职业门槛不满足。
- 相关四文件55项通过：注册后修改输入不会改已注册规则、14/15级子职门槛、9/10/15级兼职门槛、0/1/满额余额、短长休保留、保存重载不恢复、两次独立导出/重新安装等。规则数组/空对象/负数/非法布尔/越界等级/未知字段拒绝。源码测试与包往返不是原书配置已自动转换成功。
- SDK及AI转换说明已同步。付费API0，未修改原始配置，也未操作真实房间。类型检查25977运行中。
- 新增不可变审阅r9和覆盖r9：114项诊断已审阅，90条来源链接接口可表达，832条来源链接未审阅。仍为155条来源、121条待机制审阅、2条等待整批重转；这不是完成率。两项新增结论只覆盖资源恢复诊断，不认证整个子职或其他能力。原始配置需集中重转和行为验收，全书目标active。
- 最终类型检查25977 exit0。本轮55项相关测试与类型检查均通过；完整来源配置、先攻恢复的独立房间交互及全书认证仍未完成。没有后台测试进程。

## 2026-09-29：种族资源依赖目录与缺失资料诊断核对

- 上轮为 progress。本轮对照源提取文本与现有接口，发现转换参考仅列出职业资源，漏掉已由Host实现的固定种族资源。新增无运行时注册依赖的racialResourceCatalog，由racialAutomation和AI依赖目录共用同一ID/名称；原racialAutomation导出保持兼容。参考目录移至通用转换说明，使法术/特性/专长/子职路径均能读取。动态先天法术ID不枚举、不推测。
- 通用说明明确Activity直接消耗既有Host资源，不能另建同名次数；替代吐息使用不自动执行原吐息攻击，仍需按来源实现其余规则。目录本身不授予种族/祖先选择/能力所有权或余额。
- 新增导出PDF内容模块→解析starmod运行包→安装→真实角色投影→Headless测试。使用合成替代能力（不是原书完整龙之威怖）：消耗真实吐息1次、仅产生声明的临时HP，重复使用、错误种族、未选祖先、未拥有能力均拒绝；原状态不被修改、没有第二套插件次数。首次fixture未选祖先导致应有资源缺失；补上明确祖先选择，并保留缺祖先拒绝场景。第二次fixture仅一个阵营导致战斗自动结束，补上敌方参与者，未放宽产品校验。
- 资源引用/转换说明/种族行为/导入结算四文件49项通过；生命骰池、真实生命骰消耗、资格、选项前提、独立授予五文件39项通过；最终类型检查6629 exit0。API0，没有真实房间改动或后台进程。浏览器源条目施放验收仍未覆盖本新增参考目录。
- 私有审阅r10及覆盖r10：新增两项明确资源引用诊断的接口证据，以及三个经原文核对的“未给出职业/等级/资源”非机制缺口说明。仅纠正对应诊断，不认证完整龙之威怖、矮人坚毅、低身机敏或月之仪态。119项诊断已审阅，827条来源链接未审阅，92条接口可表达、21条部分解决、6条来源解释纠正；155条来源的完整认证仍未完成。原始配置待整批重转，付费门槛保持关闭，全书目标active。

## 2026-09-29：命中附伤的显式持续策略

- 上轮为progress，种族资源参考和导入Headless验证已完成。本轮检查武器附伤机制：damageType:inherit-primary和固定附伤骰已有实现，但动态读取本次武器骰仍缺接口；未将固定骰测试冒充动态武器骰完成。
- 检查中发现authoring协议无法覆盖运行时consumeEffectOnHit：原Activity编译总按“有限持续=命中移除”推导，导致持续期间反复命中附伤无法表达。新增on-hit-bonus-damage.consumeEffectOnHit布尔字段，明确选择命中后移除整个Effect或保留；不改变省略字段的旧包行为。oncePerTurn继续独立限频，breakOn、持续时间和专注仍可结束效果。
- 新增导出starmod→解析→安装→直接/编译Host双路径八场景测试：true/false/省略兼容、未命中保留、继承主伤害类型、第二次命中、重击翻倍、保存重载、每回合一次和下回合恢复、专注结束清理。初轮测试把空activeEffects的undefined断言为false，修正测试为缺失即无效果，没有放宽产品校验。相关三文件95项通过，覆盖旧的一次攻击加速/附伤组合与Activity校验；类型检查95951运行中。
- SDK/转换说明同步字段及整个Effect移除边界。原始草稿未编辑，未调用付费API，未提升原书条目/完整法术认证。动态武器骰、选择性目标标记及命中可选窗口仍需后续工作；本轮没有将这些待办换成更窄目标，全书目标active。
- 最终类型检查95951 exit0，本轮95项相关回归通过，所有本轮进程终止。下一步动态武器骰的已确认数据来源：Dnd5eWeaponClassDamageContext.weaponDamageSides；当前on-hit-bonus-damage.amount仍只支持固定骰面，不能用占位骰面假装已完成动态机制。全书目标及原始条目状态不变。

## 2026-09-29：命中时动态读取实际武器伤害骰面

- 上轮为progress：命中附伤持续策略已完成。本轮补上on-hit-bonus-damage.amount的新形状{kind:weapon-dice,count,bonus?}，只表示额外骰数与可选固定加值；不是通用公式。校验限制数量和额外字段，作者不能写sides冒充Host攻击数据。
- Activity施加效果时保留动态骰标志，不提前投骰。严格存档校验及归一化保留该标志；内部序列化占位骰面不能用于结算。统一武器附伤清单从本次Dnd5eWeaponClassDamageContext.weaponDamageSides取实际骰面，配合inherit-primary读取主伤害类型。装备攻击入口调用同一清单。法术攻击跳过这种动态武器附伤；非法骰面抛出已由Headless事务边界处理的roll-dice错误，返回invalid-dice且不提交伤害/效果消耗。
- 导出→解析→安装→直接/编译Host案例扩展到d4/d6/d8/d10/d12，施加后下一次攻击切换骰面仍按新数据结算；验证重击翻倍、严格存档、序列化恢复、非法骰面不扣HP/移除效果，以及非法数量/注入sides拒绝。保留固定骰、有限命中消耗、连续命中和每回合一次回归。首次两文件98项通过；最终五文件180项通过（两批重叠），类型检查93262运行中。
- SDK/转换说明及升环附伤数量/固定加值投影已适配。付费API0，原始配置不改，不接触真实房间。私有审阅r11、覆盖r11将兽人狂怒的动态骰表达诊断单独记录为接口可表达：120项诊断已审阅、93条可表达链接、826条未审阅链接。并未认证整个专长；简单/军用武器资格、命中后可选时点与资源消耗仍单独待处理。
- 完整原始条目转换与双端施放验收仍未完成，未打开付费门槛或更新全书完成状态。目标active。

## 2026-09-29：动态武器骰编辑入口与类型检查收敛

- 恢复任务后核对93262日志：类型检查实际失败，不能沿用上一轮“运行中”推断成功。发现模板编辑器仍将动态骰作为普通Formula传入，以及升环分支混合damage-reduction/on-hit导致类型关联丢失。已修复两处。
- 模板编辑器新增固定公式/本次武器骰选择、额外骰数、固定加值，以及命中移除效果的默认/明确true/明确false选择。默认兼容旧配置；切换骰来源会创建对应的新值。
- 三文件32项回归通过，随后完整类型检查3418 exit0。之后新增独立升环行为测试1项通过：动态骰与固定骰各自升环、原定义不变、基础环级保持原值、升环结果通过Activity校验。新增测试的首次fixture使用不支持通过apply-effect施加的damage-reduction，被校验正确拒绝；改用真实支持的固定骰附伤，没有放宽产品校验。类型检查在新增该测试之前完成，产品代码之后未改。
- 本轮付费API0，未修改真实房间、未提升任何完整原书条目的认证状态。命中后可选使用窗口、简单/军用武器资格及对应完整来源配置仍待收敛。全书目标仍active。

## 2026-09-29：攻击触发窗口的简易/军用武器资格

- 上轮为progress：动态骰UI和升环类型问题已修复。本轮核对现有触发确认：actor-choice已由统一settlement调用确认并记录拒绝回执，不应重新发明一套确认协议；但事件缺少简易/军用分类。
- 新增attack-weapon-category谓词（simple/martial），装备攻击从本次所持装备读取分类，经Headless attack-resolved事件传递至Activity触发上下文。谓词要求weapon攻击类别并且存在明确分类；法术攻击、未知分类不匹配。编辑器、严格分类输入校验、日志解释和SDK文档同步。
- 64项相关测试通过，包含真实装备准备/攻击结算/事件/触发窗口中的简易与军用武器往返、JSON恢复后谓词判定、法术攻击/未知分类拒绝，以及空/重复/非法/null分类拒绝。
- 首次类型检查33198发现日志标签穷尽映射缺项；已补标签及可读条件说明，重新运行51182。没有付费API、没有真实房间操作、没有提升完整原书条目认证。
- 后续关键缺口更明确：命中后才接受可选能力时，需要读取刚刚发生的攻击骰面/重击等Host证据，把附伤归入同一次攻击，不能只给下一次攻击施加on-hit效果。现有动态附伤与actor-choice分别可用不证明该组合完整。全书目标active。
- 类型检查51182 exit0。之后核对自动化能力目录发现还需注册predicate handler，否则来源转换能力分析会将其视为未支持；已注册，并追加能力分析断言（无缺失组件、full、确实命中新handler），8项触发测试通过。首次新增断言错误地比较两个不同predicate的完整handler列表，改为验证实际所需handler及无缺失组件。类型检查在此目录字符串注册与测试断言追加之前完成；未再次重复全量类型检查。完整原书能力认证仍未完成。

## 2026-09-29：保留当次攻击的武器骰证据

- 上轮为progress：武器资格已接入。本轮检查命中可选附伤的前提，现有attack-resolved事件没有保存基础武器骰组，选择后不能可靠使用当前装备倒推过去的攻击。
- 增加Host事件及Activity attack source的weaponDamageDice {count,sides}快照；源于实际攻击damage，不因critical翻倍，排除spellAttack及缺少weaponId的数据。触发上下文复制对象，避免与事件共用可变引用。伤害类型和重击结果继续使用既有同次事件字段。
- 扩充真实装备攻击测试为简易棍棒、短剑、巨剑2d6、巨斧1d12的普通命中/重击8例，检查骰组、重击标记、分类谓词、序列化、与事件引用隔离及后续装备更换不改历史快照。装备攻击文件62项通过；完整类型检查77226 exit0（也覆盖上一轮最后追加的handler目录注册与测试）。
- 仍未完成命中后可选附伤的执行接口，未以事件快照替代完整来源行为认证。后续实现需要同时接入rollDnd5eActivityTriggerDiceV1、Host权威配方与执行端，消耗资源和重复提交回执必须沿用既有事务边界；不能只施加下一次命中附伤。当前付费API0、真实房间未动、全书目标active。

## 2026-09-29：命中触发附伤的动态配方与事务验证（未完成原攻击合并）

- 上轮为progress：当次武器骰证据已保留。本轮新增damage.weaponDiceFromTrigger {rollId,count}，限定attack-hit、目标target、amount为constant0、类型继承；禁止再次攻击检定及类型选择覆盖。共享materializeDnd5eEventWeaponDice从Host命中证据生成实际dice公式；触发掷骰和执行器共用，缺少/非法/法术攻击证据拒绝，原定义不改。
- 通过统一触发结算测试普通命中1d12、重击的2d6武器额外一枚骰翻倍为2d6、拒绝不掷骰不消耗、非法骰值不扣资源或HP、接受消耗一次、存档恢复后重复事件不再次确认/投骰/扣伤。无证据与法术/未命中拒绝测试通过。首次测试错误地将registerDnd5eActivityPackage返回值当函数清理，改为使用其测试清理API；没有改动产品注册逻辑。
- 三文件57项回归通过；最后新测试+SDK说明两文件33项通过（重叠不累加）。首次类型检查78648仅发现测试缺position，补齐后最终76816 exit0。
- 关键限制：当前damage操作独立提交后续伤害，未并入原攻击伤害包。分开处理抗性取整、单次减伤、濒死/专注等可能不符合“同次攻击附伤”。因此不认证完整兽人狂怒，不将本轮当作该机制已完成。SDK与AI说明明确保留该缺口，来源配置与审阅统计不提升。后续需使用防御前事务挂接点完成聚合；damageCommitCheckpoint现有raw-typed-damage-before-defenses与adjusted-damage-before-hit-points两阶段，不能把adjusted阶段重复施加防御。
- 本轮付费API0，未操作真实房间，未完成新字段的导出安装/双端浏览器验收。全书目标仍active。

## 2026-09-29：同一攻击的兼容伤害分量统一防御取整

- 上轮为progress：动态后续伤害可执行，但未合入原攻击。本轮检查发现原有adjustDnd5eDamageComponents也逐分量应用防御；相同类型/相同魔法属性的3+3伤害会被抗性分别取整为1+1。
- 改为按伤害类型与有效魔法属性分组，组内统一应用防御，并用确定性比例/余数分配把最终伤害映射回原分量，保留来源与附伤归属。不同类型及不同魔法属性不混组，条件防御仍独立匹配。防御日志记录合并分量的前后数值。
- 新增真实Headless攻击的抗性/易伤/两者同时/免疫/不同类型/条件非魔法抗性六场景；同类3+3抗性为3，两者同时为6，来源标签保留、只扣血一次、输入状态不变。新测试及伤害checkpoint、动态附伤、条件防御四文件62项通过；核心战斗+装备攻击两文件369项通过。类型检查35870运行中。
- 进一步确认现有damageCommitReaction只允许受击者状态变化，严格拒绝其他状态变化；不能直接复用来丢弃攻击者扣资源。下一步需扩展或新增攻击者命中事务挂接点，并把可选附伤放到攻击内减伤/防御之前。本轮不将分量取整修复视为完成该可选时点，也未认证原书能力。
- 付费API0、原始转换配置未改、真实房间未动。全书目标active。
- 最终类型检查35870 exit0。所有本轮测试进程结束；完整命中可选附伤与全书认证仍未完成。

## 2026-09-29：武器命中前扣血事务挂接点与暂停重放

- 上轮为progress：兼容伤害分量统一取整。本轮新增Host内部weaponHitCheckpoint同步作用域：事件及战斗快照只向监听者提供独立副本；只为有武器骰证据的武器命中打开。监听者可暂停，根事务确保中断不被旧catch吞掉，作用域finally清理。
- 接入原武器攻击resolver。接受的额外骰按本次真实骰面和重击校验，资源成本逐项在当前事务消费；非法骰或超额消费由原事务回滚。附伤直接增加基础武器伤害，位于武器伤害削减、恶语、伤害倍率、Uncanny Dodge、Deflect Missiles、抗性及扣血之前；不再通过另一个damage提交。本内部挂接点尚未连接导入Activity，上一轮weaponDiceFromTrigger的独立提交路径仍保留其未完成限制。
- 新增weaponHitSession冻结原始action和state，暂停后只允许对应事件/序号恢复；状态变化拒绝、终结后重复回复拒绝，恢复重新执行原攻击且只最终提交一次。决策类型明确是Host内部已授权规则结果，不是网络或玩家输入接口；未声称已校验任意玩家提供的cost/count。
- 测试验证抗性前合并3+3=3，重击一次合并12减半6；资源消耗一次、单个HP/防御事件、输入状态不变、快照篡改无效、非法骰、余额不足、重复成本总额超过余额回滚、抛错暂停不泄漏listener、冻结骰值、旧状态/篡改目标/重复回复拒绝。新事务、包取整、原反应会话、核心战斗和装备攻击五文件398项通过。
- 首次类型检查5538发现项目erasableSyntaxOnly不允许构造器参数属性；已改显式声明/赋值，最终类型检查72046运行中。下一步将registered Activity资格/资源/骰值解析接入本会话，并接入房间UI和导入导出验收；缺这些仍不能认证完整兽人狂怒或全书导入。
- API0，真实房间未动，未重转来源配置或提高全书认证计数，目标active。
- 最终类型检查72046 exit0。398项相关测试与类型检查通过；本轮进程已结束，Activity接入、UI和导出安装验证仍待完成。

## 2026-09-29：导入Activity授权到原攻击附伤事务的适配

- 上轮为progress：内部命中会话可合并附伤，未接入导入资格。本轮新增resolveDnd5eWeaponHitActivity：仅接受已注册包/Activity身份、Host事件/快照及权威骰。由事件构建触发上下文，用既有角色投影、Activity命令解析和归属校验执行资格与公式校验；检查包版本、可选定义签名、额外未知roll拒绝。
- 当前适配边界为free/actor-choice/attack-hit、单个always伤害operation、weaponDiceFromTrigger、继承原伤害类型及resolve阶段资源成本。含其他状态变更、行动费用、升环、选项/检定、once-per-turn记录等暂拒绝，而不是丢弃这些副作用。它生成Host内部决策，由原攻击事务校验并扣费/合并伤害；不将该适配器当作未经授权的玩家命令入口。
- 新增合成feature导出starmod→读取→安装→真实武器命中暂停→导入Activity资格解析→原攻击恢复测试：普通/重击均在抗性前合并，只生成一次HP提交、消耗一次真实资源、原状态不改；错误包版本、旧定义签名、未拥有能力、非法骰与注入其他roll拒绝。合成资源选择为dnd5e-ki，不是原书专长的完整配置，未假称原PDF转换成功。
- 四文件63项相关回归通过，类型检查14751运行中。本轮API0，没有真实房间操作或来源配置重转。下一步仍需生产调用封装固定定义签名、处理已结算/拒绝回执避免后续触发窗口再次执行，以及玩家端选择和双端导入验收；全书目标active。
- 最终类型检查14751 exit0，63项相关测试通过，本轮无后台进程。原书配置自动转换和生产双端链路仍未完成。

## 2026-09-29：注册命中会话的定义锁定与处理回执

- 上轮为progress：导入Activity可解析为Host附伤决策。本轮增加createDnd5eRegisteredWeaponHitSession，固定输入包身份、版本、定义签名、原攻击与原状态；pending事件与快照由封装内部持有，不信任UI传回的副本。resume只接受接受/拒绝和Host权威骰，费用及骰数从注册Activity重新解析。
- 底层命中会话增加definitionUnchanged校验，定义变化终止会话。完成的Host攻击事件携带handledHitActivities，记录接受或拒绝过的Activity身份；后续统一触发发现跳过这些身份，避免资源仍有余量或拒绝未消耗时重复弹窗/结算。失败事务不产生已处理成功事件。
- 扩充导出安装测试：接受/拒绝、普通/重击、篡改返回事件/快照不影响权威、事件与结果JSON往返后不再次出现该Activity、重复回复拒绝、等待期间卸载定义拒绝。原命中/核心触发回归三文件58项通过，类型检查68914运行中。
- 该封装仍是Host内部调用层，尚未接入生产地图的候选发现、玩家网络选择、异步骰及最终房间原子提交，也未认证原PDF来源转换。付费API0、真实房间未动、全书目标active。
- 最终类型检查68914 exit0，58项相关测试通过，本轮进程结束。生产UI/双端认证及全书来源转换仍未完成。

## 2026-09-29：生产接入前的命中候选资格和骰子请求

- 上轮为progress：定义锁定与事件回执已完成。本轮检查MapsWorkspacePage实际攻击入口，经resolveDnd5eFacadeWithAirborneFalls调用resolveDnd5ePreparedWithMaterialDamageReactions，内部已持有同步重放边界。不能在此简单叠加另一个跨await listener，会造成反应会话被中断或重复确认；生产双时点驱动仍待整合。
- 新增listDnd5eWeaponHitActivities，从Host真实命中、已注册触发窗口、归属、规则资格及资源余额产生可展示的Activity/定义签名/骰子请求。探针只用于无提交资格计算，不向用户返回已掷骰结果；骰子依赖的资源公式不作此静态候选推断。未命中/法术攻击/缺证据/已处理回执不产生候选。
- resolveDnd5eWeaponHitActivity补齐合计资源成本预检，重复费用按资源汇总，资源不足在返回Host决策前拒绝；原攻击事务仍再次检查并原子扣费。
- 导出安装测试扩展到候选请求的真实骰面与重击骰数、筛选前后状态不变、资源耗尽拒绝、未命中/法术攻击排除、结果序列化后回执排除。两文件10项测试通过，类型检查80007运行中。
- 未接入生产玩家UI，不认证原书完整能力或全书自动转换。本轮API0、真实房间未动，目标active。
- 最终类型检查80007 exit0，10项相关测试通过，本轮进程结束。双时点生产驱动及全书验收仍未完成。

## 2026-09-29：统一命中选择与受伤前反应的重放会话

- 上轮为progress：候选筛选完成，生产组合方式待定。本轮扩展damageCommitSession，而不是跨await叠加监听作用域。现有直接攻击及prepared facade会话可选传入weaponHitPause；同一冻结baseline/action中维护命中选择和受伤前反应两个独立序号/决策表，结果新增pending-weapon-hit。
- resumeWeaponHit核对Host事件与序号并保存内部决策；恢复时命中附伤及资源消费重放在原攻击中，随后仍可停在既有伤害反应点。已选择的命中不会重复发现/询问，cancel清理两种pending与决策。现有调用不传命中回调时不会打开新窗口。
- 新增接受附伤→受伤前窗口→拒绝防御反应→单次最终扣血，以及在第二窗口取消的真实攻击测试。验证6+3原始伤害、资源只扣一次、两种窗口各询问一次、错误时点的旧回复拒绝、原输入不变、监听作用域不泄漏到下一次普通攻击。两文件25项测试通过，完整类型检查32554 exit0。
- 生产damageReactionFlow尚未提供命中发现回调或处理新状态，因旧入口未传此回调暂不会收到新pending类型；下一步需在该驱动接入候选筛选、现有confirm/roll回调、定义校验与事件回执，然后进行隔离双端测试。未将会话测试视为地图UI完成。
- API0，原书配置与真实房间未动，全书目标active。

## 2026-09-29：生产伤害驱动接入命中选择与多能力资源预算

- 上轮为progress：两种暂停时点已共用重放会话。本轮damageReactionFlow各直接/prepared/material边界均提供命中候选发现并处理pending-weapon-hit，复用现有confirm/roll/authorityUnchanged回调。MapsWorkspacePage现有damageReactionOptionsForMap已将这些回调连接到requestRegisteredDnd5eActivityTriggerChoice和rollDiceBoxValues，未另造UI协议。
- 对当次命中的多个可选能力逐项确认/投骰。每次接受后在私有预算快照扣除已决定的资源，再筛后续候选；原状态仍不提交。所有额外骰以独立重击策略保留，最终决策一次传回原攻击。多组骰在基础伤害中合并，整笔资源由原事务再次校验。
- 接受/拒绝/预算不足后跳过的已发现能力写入原始Host攻击事件的handledHitActivities；回执在facade构建application之前生成，后续触发窗口不会重复结算。跨await及受伤前反应等待期间检查所有已处理能力的定义/包版本，变化取消整笔结果。
- 新增生产驱动测试两个可选能力共用1或2次资源，再接受受击者的临时HP反应，核对各窗口只询问一次、骰数正确、余额不超支、单次扣血、源状态不变及序列化回执不重触发。新驱动+原反应两文件13项通过；扩大到导出安装/两类会话/装备攻击五文件91项通过（重叠不累加），类型检查54100运行中。
- 浏览器隔离DM/玩家交互尚未验证。本轮没有付费API或真实房间数据操作，也未提高原书条目认证状态。既有通用after-hit独立damage路径仍不能被误用来替代这条防御前合并入口；完整来源配置与浏览器验收继续待办。全书目标active。

- 上轮最终类型检查54100 exit0。

## 2026-09-29：命中驱动的异步取消与基础伤害替换

- 扩充weaponHitFlow：直接入口及prepared/material入口，1或2次共享资源，接受/拒绝、确认期间状态过期、投骰期间状态过期、确认/投骰/后续防御窗口卸载模块、非法骰值，共32项通过。验证失败没有生成facade最终结果、原状态不变、监听作用域释放，下一次普通攻击正常。
- 检查发现基础武器伤害替换分支会连同已付费的hitBonusDamage一起清零；改为仅抑制原基础池、保留已授权命中附伤，加入两入口及两种资源余额回归。完整测试与类型检查待最终记录。
- SDK与AI结构化指南同步记录防御前适配的实际支持形状和未支持项，不将通用事后独立伤害误报为合并结算。浏览器与原书配置认证未完成；API调用0，真实房间未改，目标active。

- 最终验证：weaponHitFlow / weaponHitCheckpoint / headlessCombatEngine 三文件351项通过；类型检查38352 exit0。无后台测试进程；未执行浏览器双端验收或付费转换。

## 2026-09-29：防御前命中附伤复用每回合使用记录

- 上轮为progress：基础伤害替换的附伤丢失已修复并通过351项测试。本轮回查机制排程，发现多项命中能力涉及每回合一次；新命中适配此前显式拒绝该要求。
- resolveDnd5eWeaponHitActivity现在将当前回合已用key交给标准Activity解析，并从已注册定义返回去重usageKeys；不接受客户端自报使用限制。原攻击事务检查已用/重复key，骰值与资源有效后原子记录到既有declarativeUsedTurnKeys。
- 生产驱动私有快照同步占用usageKeys，再筛选同次命中的其他选项；共享key互斥、不同key独立。最终合并决策带回全部使用记录。拒绝不占次数；异常、状态过期、卸载模块不发布临时记录。
- 导出安装测试加入once-per-turn要求，覆盖已使用的Host直接适配拒绝以及接受/拒绝的记录差异。生产驱动加入两入口、两种资源余额的共享key情形；同回合新命中不重复出现，其他生物回合重新可用，不混同每轮限制。三文件50项通过；补充事务层重复key/已用key拒绝及会话/SDK回归71632运行中，类型检查26106运行中。
- SDK和AI指南同步支持范围，不将该共享机制当作完整原书能力认证。动态职业骰、附带护甲/位移等仍需各自实现或验收。API0，原书配置和真实房间未修改，全书目标active。

- 最终验证：补充事务/会话/SDK三文件55项通过，类型检查26106 exit0。两组测试含重叠，不相加为独立覆盖数。没有浏览器或来源转换完成声明；全书目标继续active。

## 2026-09-29：普通公式附伤进入防御前原攻击事务

- 上轮为progress：每回合限制已接入。本轮检查发现此前命中适配只接受weaponDiceFromTrigger，普通固定骰或等级加值只能走独立后续伤害，不能满足属于同一次攻击的规则。
- 命中适配现接受普通damage.amount公式，保持单damage、target:target、inherit-primary以及原有无附带效果的边界。候选发现使用既有Activity骰数规划（含重击），支持多个rollId及纯数值无需投骰；生产驱动逐池请求Host骰并跨await检查权威。
- Host标准Activity解析器计算公式结果，通过内部resolvedBonusDamage决策传回原武器攻击，与动态武器骰共同合并后处理防御。此内部字段不作为玩家协议暴露；适配拒绝法术/未命中/无武器证据、额外未知骰ID，事务拒绝非安全整数或负数结果及总和溢出。
- 扩展.starmod导出安装测试为普通/重击×动态武器骰/两独立骰池加半战士等级/纯半等级公式，并同时验证注册会话和生产驱动：固定加值不翻倍、合并后抗性取整、单HP事件、资源与使用key仅一次。保留归属/版本/定义变化/非法骰/拒绝防重放检查。三文件56项通过；最终入口证据拒绝及SDK回归95647运行中，类型检查39197运行中。
- SDK与转换指南同步实际接口范围。不同伤害类型、附带效果、选择和scaling仍未由该适配支持，不把窄接口测试当作完整来源规则或双端认证。付费API0，未修改原书转换配置和真实房间；全书目标active。

- 最终验证：入口证据/导出安装/SDK两文件34项通过（与前组有重叠），类型检查39197 exit0。原始来源自动转换、不同伤害类型与附带效果适配、隔离双端验收仍未完成。

## 2026-09-29：命中附伤保留不同伤害类型及魔法属性

- 上轮为progress：普通公式已接入原攻击。本轮扩展Host内部命中决策的damageComponents，允许单damage操作输出固定伤害类型或显式magical覆盖；仍由注册Activity、权威命中及Host骰解析，未暴露客户端附伤总值接口。
- 原攻击将附伤分项接入既有减伤、伤害反应、类型/魔法属性防御及统一HP提交。新增类型同时进入damage-applied事件的damageTypes，避免后续按类型触发漏掉附伤。事务预检分项数量、合法类型、非负安全整数、布尔魔法属性及总和溢出，在资源消费前拒绝非法结果。
- .starmod测试增加普通/重击下光耀附伤与挥砍抗性、光耀易伤并存，以及魔法附伤穿过仅限非魔法挥砍的抗性。覆盖内部注册会话和生产异步驱动，仍核对单次HP事件、资源及使用记录、输入不变。增加负数/NaN/Infinity分项拒绝；连同既有分项取整三文件29项通过。
- SDK及AI指南同步固定类型和magical支持。damageSource、cannotBeReduced、多outcome、附带效果/位移、选择、scaling仍未由本窄适配完整支持；未将接口进展提升为原书条目认证。类型检查80867运行中。API0，真实房间和原始转换配置未改，全书目标active。

- 最终类型检查80867 exit0，29项相关测试通过。无后台测试进程；隔离浏览器与来源转换验收仍待完成，目标active。

## 2026-09-29：命中附伤支持原文必然触发的automatic

- 上轮为progress：固定类型/魔法属性分项已验证。本轮检查新命中适配仍仅接受actor-choice，导致必然发生的附伤无法走原攻击合并通路。
- 适配现接受automatic及actor-choice，前者调用标准Activity解析时使用system确认身份；后者保持actor身份。生产驱动仅对actor-choice打开使用确认，automatic仍请求公式需要的Host骰，并保留跨等待的权威/定义检查、资源预算、使用key及处理回执。
- .starmod导出安装测试新增自动武器骰与纯数值公式，在普通/重击两种情况下验证无使用确认、骰子请求正确、伤害/资源/使用次数一次提交。原可选模式仍覆盖接受与拒绝。未改变其他要求或用自动模式隐藏选择机制。
- SDK与转换指南明确：仅原文规定必然触发才使用automatic，不得将可选能力改成自动。没有改动原书配置或真实房间，API调用0。类型检查77234运行中；全书来源转换与双端验收仍未完成。

- 最终验证：两文件25项通过，类型检查77234 exit0，无后台测试进程。未运行付费转换或隔离浏览器验收，全书目标active。

## 2026-09-29：命中附伤接入等级骰数及加值进阶

- 上轮为progress：自动触发已验证。本轮移除命中适配对全部scaling的拒绝，允许非slot-level且只调整本damage operation骰数/固定加值的既有进阶；继续拒绝缺乏授权环级的slot-level及目标/投射物/范围/次数/持续时间调整。
- 候选骰数规划传入Host当前actor快照，与标准Activity执行的materialize→scale次序一致。含scaling的动态武器骰以完整Host求值结果回传，避免沿用原始count并丢失进阶增加的骰子或固定数值。定义签名仍锁定原始包定义。
- 新测试覆盖职业等级3/4/7、角色总等级20、普通/重击、普通公式/事件武器骰，并设置maximumSteps上限；验证实际请求骰数/骰面、固定加值不翻倍、抗性取整、单HP事件、次数记录及输入定义不变。连同既有骰子配方两文件18项通过。
- SDK和转换说明同步范围，明确骰数进阶不等于按职业等级更换骰面，未宣称完整武艺骰支持。导出安装/命中事务回归21996、类型检查91855运行中。API0，未修改原书配置或真实房间；来源认证及隔离双端未完成，目标active。

- 最终验证：导出安装/事务两文件27项通过，类型检查91855 exit0。无后台测试进程；全书目标active，未提高原书来源认证状态。

## 2026-09-29：全书源边界回查发现旧清单混入与缺页正文

- 上轮为progress：等级骰数/加值接口已验证。本轮原拟将命中机制进展回填审阅，读取原始inventory-revision4后发现魔射手包含骑兵正文。转向源边界问题，未继续扩大机制认证。
- 使用PDF技能只读渲染原始PDF第31页，视觉确认遮影矢末尾后即为骑兵标题。图像在私有xge-boundary-audit-20260929/page31.png；没有改动PDF。
- 生产resolvePdfExtractionAnchors此前对validExtraction文本提前返回，跳过新行号结果已有的确定性子职边界裁切。现在缓存文本先验证整个原始跨度的PDF证据，再经过相同的下一子职标题裁切；先校验可防止用可识别标题掩盖待裁掉的伪造文本。原输入不变，结果再次验证保持幂等。
- 单测覆盖旧文本跨下一子职、下一窗口所有权、警告、原输入不变、再次验证幂等，以及后缀伪造文本必须拒绝。pdfSpellImport.test.ts 22项通过。
- 使用生产finalize函数离线重放原始97窗口，无AI配置读取/网络调用。不可变报告：C:/Users/Doco/AppData/Local/StarsApp/local-import-tests/xge-cached-boundary-audit-20260929-r1.json。96窗口通过、1窗口拒绝；154个来源可通过本次源边界验证，2条自动校正：魔射手endPage32→31，征服之誓40→39。原始inventory-revision4文件哈希未变。
- 拒绝项为先祖守卫道途：旧条目只保留第10页引言/特性表，遗漏第11页先祖护卫等正文。已读取提取页面确认能力正文存在，不能再凭旧complete=true认为全书源边界完成。没有手写/补造能力正文，也没有把不通过的条目静默省略。下一步需继续确定性恢复或纳入后续受控边界重提取，并使下游转换按新来源哈希失效重验。
- 离线私有回放测试1项通过，类型检查待结果。付费API0，真实房间及旧转换结果未覆盖；本报告只验证来源边界，不认证全书自动化，goal保持active。

- 最终类型检查97984 exit0。没有遗留后台测试。96/97窗口源边界通过不是全书认证：先祖守卫正文恢复、校正后来源的下游失效与重新验证仍待处理。

## 2026-09-29：恢复缺失子职正文并重新校验生产缓存

- 先祖守卫旧来源停在等级表。新增确定性恢复仅适用于表格结尾、尚未包含能力正文的子职：原文字段须在连续页面唯一匹配，表内全部能力须有对应双语正文标题，并找到经特性表确认的下一子职标题。直接截取原文；缺标题、缺能力或边界不确定仍拒绝，不补写规则。
- 生产边界函数离线回放原始清单：97/97 窗口、155 个来源通过当前边界校验，来源 ID 保持不变；修正先祖守卫道途、魔射手、征服之誓三条。不可变私有报告 xge-cached-boundary-audit-20260929-r2.json，保留 r1 和原始清单，原清单文件哈希未变。
- PdfSpellImportCache 的完整缓存及原文缓存恢复现在都调用当前生产边界校验。正文或末页变化仅移除对应 draft/rejectedDraft，保留来源 ID 并显示继续转换提示；其他可复用配置保留。无法核对原文、来源无归属、重复、完成清单漏项或需要改变清单数量时拒绝命中缓存，不静默删除条目或沿用旧完成声明。恢复本身不调用 AI。
- 38 项 PDF/缓存测试通过：包括正常缓存、接口升级原文复用、边界修复、旧配置失效、再次保存恢复幂等、伪造/无归属/重复/未完成/漏项拒绝，以及既有损坏检测与排除页范围隔离。
- 额外用真实 155 条来源和合成配置占位符测试生产缓存恢复：97 个窗口保留、155 个 ID 不变，恰好 3 个占位配置失效、152 个不变；再次保存恢复结果一致。该测试不验证真实配置质量。不可变私有报告 xge-cache-restore-audit-20260929-r1.json 记录原清单/代码哈希和三条来源前后哈希，标注 configurationRequiresRegeneration=true、behaviorVerified=false。
- 私有报告目录仍为 C:/Users/Doco/AppData/Local/StarsApp/local-import-tests。API 调用 0；真实房间、原始 PDF、旧转换清单未覆盖。类型检查运行中。全书配置重新生成、机制缺口收敛和隔离双端验收仍未完成，目标保持 active。

- 最终类型检查 69495 exit0。38 项相关测试及整本缓存恢复回放均通过；没有遗留测试进程。本轮完成来源恢复和缓存失效，不提升全书行为认证状态。

## 2026-09-29：统一职业阶梯骰面进阶

- 上轮为 progress：原文恢复与缓存失效已验证。本轮核对当前 backlog 和最新 review，发现等级骰数接口不能表达骰面变化；原文巧劲引用当前武艺骰，相关完整机制仍未就绪。
- 新增 scaling.adjustments.diceSidesPerStep，复用既有职业等级/角色等级/环级/阶梯表步数及上限。Host 投骰配方与执行共用缩放，重击翻倍骰数而不翻倍骰面或固定加值。公式只调整首个实际骰池；同时修正此前嵌套纯数值表达式可能遮挡后续骰池、令骰数进阶失效的问题。
- 该字段同步处理持续区域伤害/治疗、复活生命骰、效果周期伤害、豁免失败伤害、固定公式命中附伤及减伤。创建持续效果保存骰参数，不提前投掷。声明校验拒绝无骰目标、非法增量、实际武器骰和伤害类型查表骰；最终骰面溢出拒绝，不静默截断。
- 四文件首批 184 项通过，包含等级阶梯、多职业、固定加值、嵌套混合骰、非法骰值、持续参数与原攻击抗性/单次扣血。后续四文件 64 项通过，包含新增保护、既有动态武器骰、SDK 及 .starmod 导出/安装后的可选和自动附伤、普通/重击、权威变更/资源/使用记录检查。两组含重叠，不相加为独立测试数。类型检查 33729 运行中。
- SDK 文档和转换说明同步；未提供进阶表时仍保留外部规则依赖，不猜测。真实来源的剑圣武器身份、自身回合条件、完整子职转换及玩家交互未验收，不能把共享骰面接口测试当成巧劲或武艺骰完整认证。
- 新不可变私有审阅 fullbook-mechanism-review-20260929-r12.json 及 coverage-r12：121 条诊断已审阅，825 个来源诊断关联未审阅，22 部分解决、93 可表达、6 来源校正；121 个来源仍需机制审阅，2 个等待集中重转。计数不是完成率，也未开启付费转换门槛。
- API 调用 0，原始清单/转换配置与真实房间未改。全书目标保持 active，仍须收敛剩余机制、集中自动转换及隔离双端验收。

- 最终类型检查 33729 exit0。两组测试通过，没有遗留测试进程；原书配置和双端行为认证状态未提升。

## 2026-09-29：命中资格拒绝已结束战斗的残留回合

- 上轮为 progress：骰面进阶与导出安装已验证。本轮核查“自己的回合”和指定武器条件，发现 turn-owner 在 combatActive=false 但快照仍有 currentTurnActorId 时会通过；命中适配也无条件传递残留先攻位置。
- 先加入回归并运行，两个文件 20 项失败、16 项通过，确认已结束战斗仍会发现/授权附伤。随后通用谓词显式拒绝 combatActive=false，命中适配仅在活动战斗中传入当前回合。保留旧调用只提供可信回合上下文的兼容语义。
- 导出/安装测试组合 turn-owner:actor、once-per-turn、attack-weapon 和武器类别；逐个覆盖普通/重击、可选/自动、武器骰/普通公式/纯数值/独立类型/魔法属性/等级骰面。对他人回合、结束战斗、错误武器、缺失武器检查候选为空、直接 Host 拒绝、资源和 HP 不变；原合格路径及一次性回执继续验证。
- 文档明确“每个自己的回合一次”须组合回合归属与使用次数限制。静态武器 ID 校验不等于动态剑圣武器选择、升级配置及完整授权；没有据此把原子职标成自动化完成。
- 类型检查 76740 exit0；四文件回归 24697 运行中。原书配置和真实房间未修改，API0，全书目标 active。

- 最终回归 84 项全部通过，24697 exit0。新不可变 review/coverage 20260929-r13 保存回合与静态武器资格证据，巧劲仍为 partial；诊断覆盖计数未变。无遗留测试进程，完整来源转换和双端验收仍待完成。

## 2026-09-29：批量接入区域远程武器轨迹劣势

- 上轮为 progress：结束战斗的回合资格漏洞已修复。本轮按最新 review-r13 生成不可变机制批次 r2；目前 590 条机制/证据诊断、29 条施放入口、202 条状态标记等不能相加当作独立实现缺口。旧配置 201 个 Activity 的唯一缺失处理器类别是显式 manual-adjudication，不能自动删除或当成全部叙事。
- 核对原始 PDF 来源中操控风力、守护之风、水墙的远程武器条款，发现当前只存在风墙普通飞射物阻挡。新增 blocking.rangedWeaponAttackDisadvantage:occupancy/boundary；独立的区域字段不隐式阻挡移动、视线或造成自动未命中。
- 共享 ray 内核为该用途按格子做线段相交区间和高度重叠，覆盖内部攻击、两端在外部但穿过区域、两端在不连续区域内部但越过空隙、擦角短区间及抬高轨迹。玩家装备与怪物武器准备路径以普通劣势理由接入原有优势/劣势计算，近战不套用；没有改动法术攻击的骰规则。
- 新合成 .starmod 导出、安装、Activity 创建区域提案、生产地图 handoff、保存迁移恢复验证字段保留及几何生效。装备测试验证实际提交两个 d20 后采用较低骰，并覆盖区域移除和已有优势抵消；怪物攻击验证同一区域影响。
- 首批三文件 123 项通过，扩展四文件 170 项通过（重叠不相加）。类型检查指出三个新测试区域夹具漏写必填 expiresAfterRound，已补齐后重跑相关测试及类型检查，未更改生产语义。最后测试 37259、类型检查 3700 运行中。
- 新 review-r14 保留四条诊断为 partial，coverage-r14：125 条诊断已审阅、821 个关联未审阅、26 部分解决、93 可表达、6 来源校正；仍有 121 个来源需机制审阅、2 个等待集中重转。规则的薄墙精确几何、方向/逆风移动、风模式生命周期、飞行豁免、火焰与冻结等没有被这一字段代替。
- SDK 和文档同步实际范围。原始来源/转换配置与现有房间未修改，API0；没有把原始法术或双端行为认证升级为完成，全书目标 active。

- 最终三文件 126 项通过，类型检查 3700 exit0。coverage-r15 重新记录修正夹具后的证据文件哈希，审阅仍引用 review-r14，计数不变。没有遗留测试进程。

## 2026-09-29：精确薄矩形轨迹与尺寸契约对齐

- 为区域远程武器劣势补齐非贴格矩形的实际几何：按保存的锚点、长度、宽度和旋转方向裁剪线段相交区间，再与原有格子掩码及高度相交。不会把 1 尺薄墙扩大成整格，也不会恢复已清除格子。其他射线用途保持原有语义。
- 集成测试发现地图允许 1 尺宽，但执行器强制平面尺寸为 5 尺倍数；进一步边界测试发现声明校验的可调整下限也有同一限制。统一非贴格矩形在声明、地图选择与 Host 执行中的精确尺寸规则，继续拒绝越界和非有限数值；显式贴格区域及默认立方体保留格子约束。
- 测试覆盖六种旋转方向乘两种模式、内部/穿越/平行/越过端点/高空轨迹、空区域与被清除格子；合成薄墙通过模块导出安装、Activity 提案、地图 handoff 和保存恢复。原贴格尺寸测试明确声明 gridAligned:true，并保留拒绝非格子尺寸的断言。
- 最终六文件 308 项通过（.codex-logs/thin-area-complete-20260929.txt）；npm run typecheck session10857 exit0，实际使用 tsc -b。早先 tsc --noEmit 只检查空根项目，不作为验证证据；首轮项目类型检查发现新夹具联合类型未缩窄，已修正。git diff --check 通过。
- 不可变 review-r15 / coverage-r16 记录四条既有部分完成诊断的新增证据，统计不变：125 条已审阅，821 个未审阅关联、26 个部分解决关联。没有提升原始法术或双端认证状态。
- API 调用 0，没有修改原书配置或真实房间；全书目标保持 active。完整风模式、曲线墙、逆风移动、飞行豁免、火焰/冻结条款及集中重转和隔离双端验收仍需继续。当前无遗留测试进程。

## 2026-09-29：混合区域效果的来源移动耗费豁免

- 上轮为 progress：薄矩形轨迹及尺寸契约已修复。本轮核对原始私有 PDF 边界报告中“守护之风”：区域耳聋包括施法者，但困难地形排除施法者。既有 includeSelf:false 会排除全部区域效果，单独地形测试不证明这个组合可表达；所有同一 Activity 区域 handoff 还共用 target.includeSelf。
- 新增 create-persistent-area.movementExcludesSource，贯通声明、严格布尔校验、执行提案、地图创建、保存迁移及三个移动耗费查询。仅按该区域 sourceTokenId 豁免移动耗费，其他占据者效果继续遵从原有目标条件。转换 SDK 明确混合场景使用 includeSelf:true + movementExcludesSource:true，避免丢失来源耳聋。
- 合成模块导出安装、区域创建及保存恢复验证来源与盟友均耳聋，但地形成本分别为 1/2；来源锚点移动和恢复后仍生效，其他来源区域不被豁免，区域移除后无残留地形成本。非法字段类型拒绝。实际玩家移动准备验证来源花费10尺、其他生物20尺；初始测试只铺一行地形，寻路正确绕行花15尺，因此改为铺满测试地图再验证预期成本，未修改生产寻路迎合测试。
- 五文件111项通过（area-source-terrain-verified-20260929.txt）；项目类型检查37576 exit0。随后将来源豁免和地面接触条件加入战斗模拟的路径缓存键，补充48项模拟回归通过（area-source-simulation-20260929.txt）；最终类型检查10433仍在运行。
- 不可变 review-r16 / coverage-r17：126条诊断已审阅，820个关联未审阅、26部分解决、94可表达、6来源校正。新增审阅只说明这一诊断可表达，原始配置未重转、整个守护之风未认证，121个来源仍需机制审阅。
- API调用0，未修改原书配置或真实房间，全书目标保持active。

- 最终项目类型检查10433 exit0，所有本轮测试进程已结束。111项接口/地图/玩家移动回归及48项战斗模拟回归通过；原书配置、双端与全书认证状态未提升。

## 2026-09-29：不限区域目标数贯通注册 Headless 命令

- 上轮为 progress：混合区域来源移动豁免已实现。本轮按剩余机制审阅队列核对原始“雷霆步”条款，确认其中“每个生物、CON豁免、3d10雷鸣、成功减半”的旧诊断仍称必须提供 maximumTargets，但声明和地图路径已允许省略。
- 新合成模块验证0/3/300目标，经 .starmod 导出安装、生产地图选人、编译共享伤害骰与逐目标骰配方，进入注册 Activity 的 Host HP 提交。测试发现真实缺口：通用命令校验固定256目标，导致300目标被拒绝；3目标最初未传内部 areaTargetIds 也被正确拒绝，随后夹具补齐 Host 地图结果。
- 命令校验默认保持256；仅对注册定义中省略 maximumTargets 的区域使用 Host 内部 areaTargetIds 数量扩展输入边界。精确目标集合匹配、来源权限、版本和修订校验仍保留，不能由客户端声明目标上限。缺少Host名单、漏目标、重复目标和夹带区域外目标均拒绝。
- 成功路径验证300个生物各自豁免，共享一次3d10结果，失败HP40→27、成功HP40→34，来源/物体/范围外目标排除，输入战斗状态不变。该测试使用合成大范围以验证数量契约，不声称它就是雷霆步的10尺原始范围或完整传送流程。
- 三文件56项通过；项目类型检查发现新夹具 confirmedBy 使用角色ID而不是协议枚举，已改为 actor 后两文件8项再次通过。最后类型检查87820运行中，初轮错误没有作为通过证据。
- 不可变 review-r17 / coverage-r18：127条诊断已审阅、819个未审阅关联、26部分解决、95可表达、6来源校正；121个来源仍需机制审阅。只提升该具体接口诊断为可表达，原始雷霆步传送、同伴携带及自动转换/双端认证均未据此提升。
- API调用0，原书配置及真实房间未修改；全书目标保持active。

- 最终项目类型检查87820 exit0。56项注册结算/命令回归及修正确认方后的8项重验通过，当前无遗留测试进程。目标继续active，付费集中转换门槛未开启。

## 2026-09-29：合并真实自动产物并核查初始区域伤害

- 上轮为 progress：不限目标的注册 Host 命令已修复。本轮将离线总预检改为读取已修正的 xge-cached-boundary-audit-20260929-r2 来源，按 kind/name/text 精确匹配未手工修复的自动运行。新不可变 preflight-r15：155项中32可进入行为测试、121阻断、2无可解析当前草稿（救赎之誓、碧水球）。没有把预检当作行为通过。
- 选择32条当前预检通过的原始自动草稿，仅经生产语法规范化，合并导出 fullbook-ready-bundle-20260929-r1.starmod，再经过接收方解析器读取、注册及卸载。报告保留各来源/自动运行/原草稿和产物哈希。模块含23法术、6专长、3特性、1附属物品、31 Activity。它是测试子集，不是全书交付，也没有悄悄省略全书剩余123项。
- 导出报告 runtimeValidation 为 unavailable（Node环境未获得该运行时校验能力），故只记录实际执行的往返解析和注册，不把该字段当作通过。模块 report 的 behaviorVerified/sourceCoverageVerified 保持false。
- 使用这份合并模块进行真正的玩家 pluginSpellTransaction 准备及Host提交，不再为每个法术单独制作包。阿迦纳萨喷火术、史尼洛雪球群在2/3/9环，鸣雷破在1/5/11/17级，共10组通过。验证两目标成功/失败豁免、一次共享伤害、升环或等级骰数、范围外与来源HP不变、法术位一次扣除、输入角色/地图未突变。报告 fullbook-ready-damage-20260929-r1.json；范围限初始伤害机制，不声称声音、组件等完整原文或网络双端已认证。
- 真实配置检查发现上述三个旧产物都添加了原文没有的 maximumTargets:256。常规场景行为通过不能认证“所有生物”。新增保守的原文约束：仅识别明确瞬发、所有区域生物/该线生物/来源除外周围生物须豁免的完整条款，检查初始活动和roll-effect模式，拒绝人为目标上限，不改写规则配置。持续区域和主动选择单个目标的文字不推断为不限目标。
- 两文件26项约束/预检回归通过，项目类型检查14546 exit0。再次离线预检-r16：29可进入行为测试、124阻断、2无可解析草稿；三个初始伤害产物回到阻断队列，等待集中自动重转。亚比达奇凋死术原已阻断，也新增上限诊断，未在本次三法术审阅中顺带认证。
- 新 backlog-20260929-r14 从最新来源/诊断重建，旧报告保留。review-r18 严格按相同诊断和sourceId继承127条既有审阅，新增3条仅说明接口可表达且必须重转；coverage-r19为839诊断、130已审阅、814未审阅关联、26部分解决、98可表达、6来源校正；121来源待机制审阅、5来源等待批次重转。计数因来源与诊断选择变化，不作为完成百分比。
- 所有产物位于 C:/Users/Doco/AppData/Local/StarsApp/local-import-tests，均使用新文件独占写入，没有覆盖原草稿、以前报告或真实房间。API调用0，当前无遗留测试进程，全书目标继续active，集中付费转换门槛关闭。

## 2026-09-29：合并模块隔离双端导入、学习、结算与刷新恢复

- 使用上一轮实际自动产物 fullbook-ready-bundle-20260929-r1.starmod（SHA256 ef67ed331fadadd74e1949c06599d155f325460d2aa1d91f11ed4611b13c19f2），未手工改写任何法术配置。新增私有 Playwright 合并模块夹具及配置，独立6773/6774端口和每轮全新临时共享目录，reuseExistingServer:false。
- r1通过DM界面上传、玩家精确版本激活、玩家界面学习/准备/施放授予技能、隐匿选项及玩家同意、Host结算，两端效果一致且技能加值10。同意前法术位不变，同意后仅扣1次。r1已结束并保留审计。
- 增加刷新断言后运行r2：两端同时刷新，分别确认准备法术、技能专精效果、加值10及剩余5环法术位保持一致；刷新后Host资源没有再次扣除。1项浏览器用例通过（1.5分钟），进程32728 exit0，pageerrors为空。证据 fullbook-combined-skill-room-20260929-r2.json；日志 .codex-logs/fullbook-combined-skill-room-20260929-r2.txt。
- 仅认证该合并测试包中授予技能的上述链路，不把它提升为32项完整行为认证、全书认证、第二DM房间导入认证或全部目录枚举认证。历史包中三个不正确目标上限配置仍保留原阻断状态。
- 从最新backlog-r14与review-r18重新生成不可变机制批次计划 fullbook-mechanism-batches-20260929-r3.json，替代旧计划用于后续路由。839诊断及846个未解决关联；其中机制/证据508、施放入口28、执行绑定22、状态标记217、人工边界67、来源行为验证4。此计数包含多条关联，不是法术数或完成比例，付费转换门槛仍关闭。
- 本轮仅修改私有测试夹具及验证记录，未修改生产代码，未重跑项目类型检查。全仓diff检查发现已有6处空行/空白问题（非本轮文件），未将其记录为通过，也未顺带修改原有工作。
- API调用0，未接触5273/5274现有房间；全书目标仍active。

## 2026-09-29：专注条件下的被动 AC 与全属性豁免

- 上轮为 progress：完成合并模块授予技能的隔离双端导入、学习、施放和刷新恢复。本轮回到机制批次，核对当前原始战争魔法资料：10级耐久魔法要求专注法术期间AC和任何豁免+2，原自动配置诊断仍称接口无法表达。
- 新增声明式 passive-defense.concentrationBonuses:{armorClass,savingThrows}，至少一项、1–10整数、拒绝未知字段。SDK说明与AI接口指南同步。通过已拥有且达到授予等级的被动能力动态读取当前法术专注，不创建新的专注来源，也不把加值固化入基础AC或豁免。
- 接入角色AC显示、原生Host攻击/豁免、地图和法术豁免预览、骰后干预预览、模拟、战役时间重复豁免，以及插件Activity的两个权威快照路径。专注豁免自身仍可获得加值，失败后和主动结束后立即撤销。
- 新合成.starmod子职导出/导入测试覆盖角色等级、未拥有能力、不在专注、无专注法术ID、角色与战斗状态JSON往返、专注豁免成功/失败、即时AC变化；新增注册Activity同时执行六属性豁免，逐条核对真实Host事件中的总值。首次注册Activity测试缺少Host距离表而被正确拒绝，补充夹具距离后通过，未放宽生产校验。
- 首轮3文件73项通过；扩展Host回归首次368通过/1夹具失败（上述距离），补齐后4文件274项通过。原生Headless大套件已在前轮运行中通过；原类型检查48040 exit0。最终夹具修改后的类型检查1855运行中。正常仓库换行配置下目标文件diff检查exit0；显式关闭autocrlf曾把CRLF误报为大量尾空白，已按正常配置重查，未改写文件换行。
- 私有review-r19与coverage-r20：131条诊断已审阅，813个关联未审阅、26部分解决、99可表达、6来源校正；121来源仍待机制审阅。只提升耐久魔法的这条诊断为接口可表达；原自动配置未修改/重转，整个战争魔法及其网络双端不据此认证。
- API调用0，未操作现有房间，全书目标继续active，付费集中转换门槛仍关闭。

- 最终类型检查1855 exit0，相关进程已全部结束；本轮274项最终相关回归通过。原书重转、其余机制与完整自动化验收仍未完成。

## 2026-09-29：专注防御贯通多阶段骰子需求及字段校验

- 上轮为 progress：新增专注条件防御与两种权威Activity快照。本轮全路径检索发现原生插件入口在预判后续骰子需求时，另用 dnd5eActivityEffectActorSnapshot，仍遗漏专注防御。
- 新回归先证明：注册命令入口已通过，直接原生plugin动作却因成功豁免被预判为失败而要求额外骰子，返回invalid-dice。before日志 concentration-save-gate-direct-before-20260929.txt保存失败证据；补齐内部快照的AC与豁免条件加值后通过。
- 合成导出模块增加两种分阶段流程：普通豁免失败→随机表；攻击命中→CON豁免失败→随机表。专注时攻击13对AC14未命中、CON总值10成功，不提交两个后续随机表；结束专注后攻击命中、CON失败，必须提交后续骰。验证直接plugin入口、注册Activity入口、事件AC/六属性豁免总值，以及缺少/多余后续骰子的拒绝。
- 测试扩展时曾误把appliesWhenCheck放在random-roll上，发现校验静默接受未执行字段。已修正夹具为合法的攻击→豁免→随机表结构，同时加上生产校验：appliesWhenCheck只允许saving-throw；appliesWhenSave、appliesWhenCheckTotal、minimumTargetSpeedFeet只允许random-roll。四项错误类型输入回归与SDK说明同步，未将无效字段实现成猜测语义。
- 最终4文件174项通过，日志 concentration-save-gate-verified-20260929.txt；类型检查78694运行中。未重跑无关全套测试。
- 重新对原有未手工修复的自动草稿进行全书离线预检，生成不可变 preflight-20260929-r17：29可进入行为测试、124阻断、2无可解析草稿；对比r16全部155个entry及候选诊断完全一致，新增字段收紧未改变当前草稿队列。没有API调用或重写原配置。
- 机制批次计划更新为fullbook-mechanism-batches-20260929-r4（backlog-r14/review-r19），845个未解决关联，仍是关联而非来源数量。coverage-r20维持131审阅、813未审阅关联、26部分、99可表达、6来源校正。没有借由本轮测试新增全书认证或机制已解决数量。
- API调用0，原房间未操作，全书目标保持active。

- 最终类型检查78694 exit0，目标文件diff检查exit0，相关测试进程已结束。coverage-r21更新当前证据哈希，计数不变；全书尚未完成，付费转换门槛继续关闭。

## 2026-09-29：动态属性先攻接口及角色卡/地图计算对齐

- 上轮为 progress：修复多阶段条件骰子快照并通过174项验证。本轮从剩余共享机制检索，核对战争魔法战术之智（INT）、风流剑客潇洒无畏（CHA）、幽域追踪者恐惧伏击（WIS）的原始先攻条款。
- 新增永久character-capability与兼容staticModifiers字段 initiativeBonusFromAbility，允许六属性键，按当前属性调整值计算且保留负数；注册器及Effect校验拒绝非法属性键。AI指南与SDK文档说明资格独立声明、额外加入而非替换DEX，不预先固化数值。
- 新共享initiativeModifiers计算接入角色快照、角色卡modifier与地图resolveDnd5eInitiative。检查中发现原有导入固定initiativeBonus只进入角色迁移、未进入角色卡和地图掷骰；同次对齐这两条原有路径。保存的手动加值不被改写，能力移除与资格变化在重新掷先攻时重新计算，不追改本场已排好的先攻。
- 新合成.starmod原生永久Effect两次导出/导入，覆盖INT/WIS/CHA各8/14/20、固定+5与手动+3组合、六非法属性输入、JSON恢复、能力移除、职业等级不足、临时属性降低、角色卡/地图骰/战斗快照结果一致及输入未突变。第一版夹具错误声明独立feature.sourceClassId，被注册器正确拒绝；改用现有classRequirements表达职业等级，没有放宽生产资格校验。
- 四文件60项最终通过，日志initiative-ability-verified-20260929.txt。类型检查74775运行中；目标文件diff检查exit0。
- 不可变review-r20新增三项原文范围明确的审阅：战术之智该条诊断可表达；另两条复合诊断只处理先攻，标记partially-addressed，条件偷袭和首回合其他效果不据此认证。coverage-r22：134审阅、810未审阅关联、28部分、100可表达、6来源校正；121来源仍待审阅、5待批次重转。原配置未修改、未重转，未进行三子职的来源级浏览器认证。
- API调用0，真实房间未操作，全书目标active，集中转换门槛未开启。

- 首次类型检查74775失败：Effect通用value联合类型遗漏AbilityKey，另有新夹具的非空标注；已补齐契约与夹具，未改动运行时语义。随后两文件89项回归通过（initiative-ability-contract-tests-20260929.txt），最终typecheck38193仍运行，不能把首次检查记为通过。
- 最新批次计划为fullbook-mechanism-batches-20260929-r5，依赖backlog-r14/review-r20；保持原始资料与草稿不变。

- 第二轮类型检查38193仅剩新夹具modifiers可选字段的非空标注错误；已补齐该测试行，生产契约错误已消失。第三轮typecheck进程11259正在运行，日志initiative-ability-final2-types-20260929.txt，续轮必须轮询同一进程而非重启。当前不能声称项目类型检查通过。
- coverage-r23更新本轮证据哈希（最终测试非空标注又变化一行），统计不变。60项功能回归与89项契约回归已通过；API调用0，全书目标仍active。

## 2026-09-29：动态先攻最终类型检查完成与下一批移动机制核查

- 上轮为progress：动态先攻接口、导入往返和回归完成，最终类型检查仍运行。本轮按原句柄11259继续轮询，最终exit0；未重启或把前两轮类型失败误记为通过。60项功能回归、89项契约回归及最终项目类型检查均完成。
- 下一批原文已核实：斥候9级优异灵活只增加步行10尺；已有攀爬/游泳速度同样+10，不能赋予不存在的速度，也不增加飞行。该来源原诊断仍未解决，本轮未新增已解决标记。
- 当前结构事实：character.ts 迁移分别投影walk/climb/swim/fly；headlessCombatEngine 的 dnd5eEffectiveSpeed、EffectiveWalkSpeed、EffectiveOptionalMovementSpeed、EffectiveFlySpeed、EffectiveMovementPoolSpeed构成共用移动额度。可选攀爬/游泳还可能由ActiveEffect或静态能力取得与步行相同的速度。原生变形hydrate及monsterShapechange都会覆盖基础movementSpeeds。
- 不能简单将新增加值放进通用active speed bonus：会误加到飞行；也不能只改一次角色迁移而忽略运行中变形或临时移动方式。后续实现应明确存在速度条件、步行绑定速度避免重复加值、速度置零/倍率/上限、形态切换与恢复、快速飞行不改变，以及Host移动额度/地图路径一致。已有 dnd5eFlightSpeedLimit.test.ts、independentSpellGrants.test.ts、mapBridge.test.ts 是相关回归入口。
- 本轮只有只读核查与验收记录更新，无生产代码修改，不重复运行已通过测试。API调用0，真实房间未改动；全书目标继续active。

## 2026-09-29：已有移动方式加值接口与导入链路

- 按斥候原文需求新增 existingMovementSpeedBonuses 永久 character-capability / static modifier，模式白名单 walk/climb/swim/fly、1..1000 正整数。读取原生永久 Effect 的投影结果，避免只查兼容 registry 而遗漏导入定义；嵌套对象克隆，不保存计算后的速度。
- Host 与角色当前移动投影接入，地图及两个角色卡、法术热栏复用移动投影。不存在/零速度模式不被授予，未声明飞行不加值；步行绑定避免同额重复叠加；全属性替换与保留能力的变形分别处理。
- 首轮暴露静态字段白名单遗漏和原生投影读取错误，已修复；同时补回 initiativeBonusFromAbility 的白名单。扩展测试发现 classes 导入 catalog 造成循环依赖，撤去该依赖，消费者使用 characterMovement；pluginApi 测试恢复正常启动。
- 修复共用移动计算中速度设为0仍可飞行、通用速度加值凭空生成飞行、原生攀爬/游泳未应用减速量的路径。合成档案含两次导出/导入、资格移除/等级不足、JSON不突变、加速/减速/束缚/归零、步行绑定、实际35尺移动与疾走额度、四类变形和恢复投影。
- 针对性5文件54项通过；扩大7文件379项通过（movement-bonuses-final-20260929.txt）。此前3文件371项通过时另有pluginApi文件循环依赖失败，不把该轮记为全通过。首次typecheck95752失败于测试controller错误使用monster；已改为dm。最终typecheck7663正在运行，续轮应轮询原进程。
- 仍需疲劳/负重及组合加值验收；本轮不将斥候来源标记为完整可表达，不修改原书配置、不更新全书完成计数。SDK记录具体已测范围与剩余边界。API调用0、真实房间未操作。
- 全工作树diff检查发现既有 persistentAreaTypes.ts 行尾空格与 pluginMechanicsRegistry.ts 文件末尾空行；不清理其他改动、不作为本轮通过证据。
- 最终typecheck7663 exit0；补充6文件172项回归通过（movement-bonuses-consumers-20260929.txt），含classes、character、activeEffects、PlayerMapSpellHotbar、initiativeModifiers及ActivityValidation。目标diff检查定位到本轮删除import留下的空白行，已移除，仅格式变化。仍保留疲劳/负重组合待验收，不提高来源认证计数。

## 2026-09-29：疲劳对所有移动方式与变形额度的统一计算

- 上轮为progress：已有移动方式接口与379项主回归、172项消费者回归通过，类型检查完成；仍保留疲劳、负重和组合加值边界。本轮未调用API。
- 新的确定性测试复现疲劳2级时先减半基础步行、再加能力加值导致结果错误，且其他模式不减半（movement-exhaustion-before-20260929.txt）。角色Headless快照改存未施加疲劳的基础步行，当前速度由统一疲劳倍率计算；2级减半，5级归零，所有模式及原文保留能力的形态一致。
- 角色移动投影全部复用Headless，不再为没有新能力的角色保留另一套计算。初始化战斗对象与开始战斗均用当前有效模式最大值生成移动额度。变形进入/恢复此前用原始速度重置额度，现改用当前有效速度，保留已消耗距离。
- 新增疲劳2/5级、无新能力的疲劳角色、疲劳+加速、运行时等级变化后的速度与新回合/疾走、四种变形中的疲劳、实际结束荒野形态后剩余15尺的行为断言。9文件451项通过（movement-exhaustion-final-20260929.txt），含Host、mapBridge、角色投影、飞行上限与三个角色UI消费者。
- 最终typecheck96355运行中，应轮询同一进程，不重复启动。未修改原文配置、未提高全书来源认证计数。
- 待继续：负重与其他永久速度加值组合；adjust-exhaustion在结算事务内改变疲劳后，对当前已开始回合的额度立即重算仍须补证据（本轮覆盖直接更改等级后的有效速度与重新开始回合，不能据此声称两个Activity分支的当前额度同步已验证）。
- 最终typecheck96355 exit0，目标文件diff检查exit0。另补充Activity Headless authority、pluginApi、classes回归通过，日志movement-exhaustion-authority-20260929.txt。当前无正在运行的类型检查；下一轮可继续补事务内疲劳变更的当前回合额度，无需重复已完成检查。

## 2026-09-29：事务内疲劳变化及永久速度加值组合

- 上轮为progress：疲劳统一作用于所有速度、变形额度和初始化额度；451项回归、86项补充及最终typecheck通过。本轮继续处理已确认的事务内额度缺口，未调用API。
- 新测试证明direct commit与registered Activity command在疲劳2降至1时只更新等级、剩余额度仍为25而非40（exhaustion-transaction-before-20260929.txt）。引入Host内部setDnd5eExhaustionLevel，读取当前最快移动方式、已消费距离与额外移动，更新等级后重算额度。接入两个Activity写入口和狂暴结束疲劳路径，速度为0时额度归零。
- 直接/注册双入口均测试四个阈值跨越（2→1、1→2、4→5、5→4）、步行与更快飞行、已消费5尺、额外15尺、输入状态不突变。另测试狂暴结束导致1→2，已消费10尺后剩余5尺。3文件376项通过（exhaustion-transaction-final-20260929.txt）。
- 核对永久固定速度加值发现角色面板遗漏。characterMovement现在从原生永久Effect投影读取与角色迁移相同的speedBonusFeet，和existingMovementSpeedBonuses叠加后再计算疲劳；合成.starmod新增第二个永久加值feature，+5和+10组合为45尺，疲劳2级为22尺。5文件62项通过（movement-combined-20260929.txt）。
- typecheck45250运行中，应续用此句柄。目标文件diff检查exit0。来源配置未改、未重转、未更新认证计数，真实房间未修改，全书目标仍active。
- 下一处负重核查事实：items.ts约626行已使用dnd5eActiveCarryingCapacityMultiplier；classes.ts步行超重判断仍直接strength*15。存在背包承重显示与速度判断口径不一致，需要共用权威计算及行为验证，不能把该条当作完成。速度基准归零后固定/临时加值是否不当恢复速度也待核查。
- 最终typecheck45250 exit0，目标diff检查exit0；本轮所有检查完成，无等待中的类型检查。下一轮从负重权威口径继续；376项/62项通过不代表原书来源已自动转换和认证。

## 2026-09-29：承重倍率与Host移动限制统一

- 上轮为progress：事务内疲劳变化及永久速度组合修复，376项/62项回归、最终typecheck完成。本轮继续负重口径，不调用API。
- 新增carryingCapacity.ts承重计算，inventory load与Host读取同一临时承重倍率。角色迁移把规范化背包重量及永久承重倍率投影到Headless；基础速度不再提前因超重永久归零，而在每次计算当前移动方式时，用当前力量和ActiveEffect判断。角色移动投影同样携带背包重量并使用当前形态力量，避免加速、永久加值或其他移动方式绕过超重限制。
- 旧classes基础步行入口仍保留自身负重检查，但临时承重倍率也已纳入；Host/地图主链路跳过这一旧的提前归零步骤，使用共享权威限制。子职承重倍率从现有rageFeature协议取得。
- 新行为：合成归档模块同时有+5永久步行及已有模式+10；10000金币导致超重时所有模式为0，加速/速度加值不能重开；承重翻倍后恢复45/30/25/60。移除承重效果后本回合额度归0且实际move被拒绝，恢复效果后额度恢复60。commitActiveEffects额度更新改用最快当前模式，速度为0时不残留额外移动额度。
- 第一组4文件77项通过；扩展8文件506项通过；最终7文件511项通过（movement-load-final-20260929.txt）。typecheck52141运行中，必须轮询同一进程。目标diff检查exit0。
- 原文配置仍未修改/重转，不提升来源认证计数。承重在变形中装备merge/drop/wear的细分、完整属性替换期间永久承重能力停用，以及同一事务内物品增减后已捕获重量的刷新尚需验收，不能用本轮普通承重测试作这些范围的完成证据。真实房间未改动，全书目标active。
- 最终typecheck52141 exit0，目标diff检查exit0。原文重新核对优异灵活9级条款；review-r21仅将该精确诊断标为接口可表达（behaviorVerified=false/configurationStillRequiresRegeneration=true），不认证斥候其他能力、不修补原配置。coverage-r24：135已审阅诊断，809未审阅关联、28部分、101可表达、6来源校正；121来源仍待机制审阅、5仍待批次重转。来源行为认证数量未增加。

## 2026-09-29：回到全书批次，核查临时武器旧诊断

- 上轮为progress：承重主链路、511项回归、typecheck完成，优异灵活精确诊断进入可表达清单。本轮重新生成batch plan r6（backlog-r14/review-r21）：843未解决关联，其中机制/证据505、施放入口28、执行绑定22、状态标记217、手动边界67、来源行为4；不将任何类别自动删除。
- 核查幽影刃三个旧诊断：本地临时物品模板、环阶伤害绑定、目标微光/黑暗攻击优势。现有协议已有完整字段，但原自动草稿未使用；未执行历史manual-repair脚本，也未读取其修复包作为转换成功证据。
- 新增源无关合成归档测试：原生Unified Content中同包4个item定义+conjured-item Activity，两次导出/导入、注册后按2/3/4/5/6/7/9环阶选择模板、生成库存、装备、JSON重载，再走真实equipmentAttackAction准备与Host扣血。逐档在bright/dim/dark测试攻击+6、心灵伤害骰2/3/4/5d8+3、魔法/熟练/20-60射程字段、目标暗光优势；切换普通武器后不继承心灵伤害或该优势。未把合成feature当成原法术施放入口或原文自动转换成功。
- 初版夹具遗漏自身目标，resolve按契约拒绝；补齐target后通过，没有放宽生产验证。3文件112项通过（archived-weapon-final-20260929.txt），包含现有临时武器释放/重现生命周期与V2引用测试。新增证据只支持已验证条款，不因此认证投掷与重现的原法术完整链路。
- AI转换指南明确：原文完整给出临时武器属性时可同包声明本地item模板，不能因没有外部模板而回退manual；环阶用templateVariants绑定武器实例，暗光优势限定该武器，生命周期和后续入口仍需独立声明。没有手动改原始配置。
- typecheck31198正在运行，目标diff检查exit0。源文件和API凭据未改，API调用0，真实房间未操作。
- 首次typecheck31198失败于新夹具的嵌套物品槽位字面量推断和光照dark枚举；补明确item envelope类型及正确darkness值，没有修改生产校验。3文件112项重新通过（archived-weapon-verified-20260929.txt）。最终typecheck7472运行中；续轮必须轮询同一句柄。
- review-r22仅新增幽影刃本地模板、武器实例伤害、目标暗光优势三条精确诊断为可表达；原施放入口、手动Activity标记、来源生命周期未据此移除。coverage-r25：138审阅、806未审阅关联、28部分、104可表达、6来源校正；121来源仍待机制审阅、5待批次重转。最新批次计划r7使用review-r22，不代表原配置已自动生成或认证。

## 2026-09-29：临时武器归档重现与来源清理验证

- 接续检查 typecheck7472，确认失败于归档测试 equipment 模板含不允许的 id/name 字段；已删除这两个多余字段，未放宽生产类型或校验。
- 新增源无关合成模块的二次导出/导入测试：注册原生 recall Activity 与本地武器模板，按原来源3环恢复模板，拒绝调用方9环覆盖；分别覆盖 discard 与 release 接口、JSON重载、回合末消失、提前/重复重现拒绝、来源保留与结束清理、来源已结束时拒绝重现。
- 该测试主动提供来源效果快照，只证明归档与生命周期接口连接，不代表原书自动配置、首次施法消费、附赠动作实际扣除、投掷攻击整条链路或隔离房间验收。未提升原书行为认证或调整 review。
- 3文件114项通过（archived-recall-tests-20260929.txt，session83533 exit0）；地图与Headless桥接2文件126项通过（archived-recall-bridge-20260929.txt，session67887 exit0）。合计240项，目标diff检查exit0。
- 代码核查：equipmentAttackAction 在实际 ranged/thrown 结算后调用 release；mapBridge 根据 turn-ended 事件映射角色身份并清理释放物品，来源结束亦进入库存清理。此次没有新增对此整条实际投掷事务的专门测试，不夸大覆盖。
- 最终类型检查 session25565 正在运行，日志 archived-recall-types-20260929.txt；必须续读同一进程。API调用0，原书配置未手改，5273/5274真实房间未改，全书目标仍active。
- 最终类型检查 session25565 exit0（archived-recall-types-20260929.txt），本批240项测试与类型检查均通过。全书审计计数维持原状，下一步仍需初次施法与重现消费的完整Host事务验收。

## 2026-09-29：临时武器完整Host事务发现并修复来源匹配缺口

- 上轮为progress（240项检查/typecheck通过）。本轮将合成归档测试扩展为真正的 spell 条目及 grant-actions/conjured-item 后续入口，不读取或手修原书配置。
- 先修正测试夹具：Effect须显式stacking=replace；spell-slot消费须由spell入口承载；战斗需双方角色才处于active。所有失败均抛出断言，未沿用部分旧测试失败时提前return的写法。
- 完整事务捕获真实生产缺口：初次Host生成、专注与法术位消费成功，下一轮重现被拒绝 Generated item source no longer exists。实际来源 definitionId 为 activity:cast:parent:modifiers:0；原executor只检查等于/末尾parent，未识别运行时拆分后缀。
- executor匹配来源时支持Headless生成的modifiers:number/extension/marker后缀，仍要求施法者来源身份及有效item-lease标记。正反测试包括不同后缀、他人来源、无标记、相似ID拒绝。
- 双模式discard/release归档测试现在从真实Host初次施法创建来源：扣一次3环与附赠动作，专注生效；结束双方回合后重现仍采用原3环模板，即使请求9环；只扣附赠动作、不再扣法术位；同receipt重放不产生事件/物品，换receipt重复生成拒绝，输入状态不被修改。
- 4文件159项通过（recall-authority-final-20260929.txt），目标diff检查exit0。typecheck session77399仍运行，日志recall-authority-types-20260929.txt；必须轮询同一会话。尚需保留带保留后缀的原始effectId兼容性校验。
- 未证明原书自动配置、真实房间、实际投掷攻击、完整专注结束Host消费流程；不增加来源认证计数。API调用0，目标active。
- typecheck77399 exit0。随后保留原始definitionId直接匹配，再尝试剥离运行时后缀，避免本身以marker/extension/modifiers:0结尾的自定义ID退化；增加对应原始ID回归。
- 更新后4文件159项再次通过（recall-authority-verified-20260929.txt）。最终typecheck45664仍运行（recall-authority-final-types-20260929.txt），下一轮必须续读该会话；不能因观察超时重复启动。

## 2026-09-29：来源终止地图回写与旧验收假通过修正

- 上轮为progress（运行时来源后缀匹配修复）；续读typecheck45664 exit0。
- 合成归档Host测试新增真实endDnd5eConcentration→planDnd5eMapResultApplication→JSON重载：装备中的临时武器及装备引用一并清理，characterPatches写出空库存，来源终止后重现被拒绝。缺少法术位时拒绝且未生成物品/消耗附赠动作。初版地图缺enemy token，由契约拒绝；补齐夹具后3文件131项通过。
- 原始PDF缓存重核幽影刃生命周期句；review-r23只将该精确诊断标为接口可表达，behaviorVerified=false、configurationStillRequiresRegeneration=true，不改源配置。coverage-r26：139诊断已审阅，805未审阅关联、28部分、105可表达、6来源校正，121来源待机制审阅、5待集中重转。batch-r8：839未解决关联，机制/证据501，施放入口28，执行绑定22，标记217，手动边界67，来源行为4。
- 首次typecheck91465失败于测试可选characterPatches访问，已使用可选访问保留结果断言。
- 集中检查ActivityHeadlessAuthorityBridge.test.ts的提前return：8处改为失败时throw，发现Goodberry/Create Food and Water/Identify三例实际提交因单角色战斗inactive而失败，之前只检查phase后return造成假通过。补充DM观察角色形成合法active状态，修正Goodberry旧action对象断言为actionAvailable=false；未放宽生产校验。59项桥接测试现在全部执行关键断言并通过。
- 最终5文件226项通过（recall-lifecycle-batch-20260929.txt）；目标diff检查exit0。typecheck93470仍运行，日志recall-lifecycle-batch-types-20260929.txt，下轮续读同一会话。未调用API、未触碰真实房间；全书目标active，原文自动转换成功数未增加。

## 2026-09-29：转入条件感官共享机制核查

- 上轮为progress（生命周期地图回写及三处假通过修正）。本轮续读typecheck93470，确认exit0。
- 重新读取batch-r8剩余机制诊断，集中筛出视野/光照/相对隐形组，核查SDK、永久投影、角色快照、共享视野编译及Headless访问器。
- 确认现有darkvision只能取最大范围，无法精确表达无既有感官才授予或已有感官再延长；不能只在character.ts静态增加字段，临时效果/变形/地图投影还会改变实际范围。新增实现边界记录 docs/verification/2026-09-29-conditional-vision-gap.md，明确下一批需统一共享编译与Headless语义、防Token/角色双重叠加，并将相对隐形保持独立。
- 本轮尚未添加条件感官生产实现，未改review计数，未认证原始来源。全书目标active，API调用0。

## 2026-09-29：条件视野接口实现第一批（仍有投影边界）

- 上轮为progress（核实共享接口缺口及实现位置）；本轮实现原生darkvision可选ifAbsent:true与existingBonusFeet，校验后投影到darkvisionIfAbsentFeet/darkvisionExistingBonusFeet。永久Effect、plugin静态修正、角色/Headless快照、地图Token同步与归一化均接入数值字段，转换指南已说明。
- shared/dnd5e-vision-profile.mjs先合并普通基础/临时感官，再判断条件分支；镜像同id+sourceActor的活动效果去重；永久角色/Token镜像取最大而非重复相加；所有结果有10000上限。Headless有效黑暗视觉改用同一编译器。
- 新增原生合成模块二次导出/导入、安装、特性拥有权、无范围/15尺/60尺、临时120尺以及暂停、角色与地图战斗快照一致性检查。地图桥接保留intrinsic范围以免已经增加的范围再次增加。
- 7文件287项通过（conditional-vision-final-20260929.txt）。typecheck60924仍运行，日志conditional-vision-types-20260929.txt，必须续读同一会话。
- 追加手工确定性探针发现未覆盖边界：compile({token:{},character:{darkvisionIfAbsentFeet:30}})=30，apply后仅token再compile=0。因为base元数据保留0但角色条件参数未携带到投影Token。该问题真实存在，下一步须修复共享apply的角色投影数据保留及相应回归，不可仅依赖当前287项通过。同时注意角色临时Effect只在character中时的投影、结束清理与原始token范围手动修改；不能把临时来源结果固化成永久基础。
- 尚未验收变形感官替换/恢复、多人浏览器/服务器实际投影；相对观察者隐形属于独立未实现机制。未更新任何全书review认证、未修原配置、API调用0，目标active。

## 2026-09-29：条件视野投影保留与Host效果接线

- 上轮为progress（条件感官第一批接口及287项测试）。续读typecheck60924失败：MapsWorkspacePage的visionProjectedCharacters只包含旧范围字段、Headless机械效果输入到modifier的穷尽映射缺两个新字段。已补齐实际数据映射，不仅修类型。
- 修复角色独有条件感官apply后仅Token重新compile=0的真实缺口。新增仅数值/来源ID的dnd5eProjectedCharacterVision快照，不复制原文、描述或完整角色；显式当前角色覆盖缓存，Token提供当前活动效果时不复用旧角色临时效果，重新应用时更新缓存。地图归一化及投影早退判断接入该数据。
- dnd5eProjectedDarkvisionRangeFeet记录上次派生值；当用户修改当前范围时，将新值视为基础，不让旧dnd5eBaseDarkvisionRangeFeet覆盖。正常重复投影/JSON重载则保持原始基础，避免加值重复。
- 新增字符独有永久/临时感官投影、token-only再编译、反复刷新、显式来源撤销、当前Token效果清空、手动改范围等用例。原生timed-effect三个基础范围经resolve→commit→机械效果规范化→JSON重载，确认两个字段真的进入Host并正确生效。
- 7文件295项通过（conditional-vision-projection-final-20260929.txt）；地图存储2文件27项通过；sharedServerCore选定Darkvision/filled fog/dynamic vision 4项通过、170项未运行（conditional-vision-server-20260929.txt）。共326项，不能表述为服务器全套通过。目标diff检查exit0。
- typecheck81838仍运行，日志conditional-vision-projection-types-20260929.txt；下轮必须续读同一会话。仍需变形感官替换与恢复、专属服务器条件投影/实际双端验证；没有更新全书review/行为认证，API调用0，目标active。

## 2026-09-29：条件黑暗视觉的变形与原文来源限定

- 上轮为progress（投影数据保留、Host字段补齐及326项检查）。续读typecheck81838 exit0。
- 新增creatureFormVision.ts，从当前形态目录投影黑暗视觉范围及保留规则。共享视野编译、角色投影、Headless有效范围/观察者计算、地图快照及事务内effectiveViewer接入。四种模式：polymorph/true-polymorph用新形态范围；wild-shape/shapechange只有新形态也有该感官时才使用原始范围与永久条件加值。临时外来效果继续由活动效果层合并。
- 保留原始combatant基础范围，地图快照不将形态范围覆盖原始值；解除荒野形态恢复原来的90尺。新建/同步Token、归一化、投影早退判断携带形态数字与保留标志，不携带怪物资料正文。
- 合成归档测试加入四种模式×巨鹰（无黑暗视觉）/巨蜘蛛（60尺），检查角色共享编译与地图Headless结果一致，并在荒野形态两种形态结束后恢复90尺。本批7文件176项通过（conditional-vision-forms-final-20260929.txt）。仅证明黑暗视觉，未证明其他特殊感官替换。
- 原PDF缓存重新核查：幽域追踪者“阴影视野”已有范围增加30尺限定种族特性来源；当前ifAbsent/existingBonusFeet针对所有已存在感官，尚不能精准表达这部分。下一步必须补source限定：种族60+临时120应取max(90,120)=120，而不是150；没有种族感官但有临时120也不应额外+30。不要把当前通用分支当作幽域完整实现，也不移除相对观察者隐形的独立缺口。
- 幽魂凝视原文为若不具有黑暗视觉则获得同30尺范围，且是动作/专注至多1分钟/短长休恢复；当前仅证明条件范围接口，未认证整个祈唤。
- typecheck79620运行中（conditional-vision-forms-types-20260929.txt），续读同一会话。没有API调用、原配置手修或全书认证计数增加，目标active。

## 2026-09-29：来源限定的条件黑暗视觉

- 续读旧79620时会话已不存在，原日志未见错误但不能单据此确认退出；本批新的完整typecheck67068已明确exit0，覆盖之前变形改动和本批新增内容。日志racial-vision-types-20260929.txt。
- Native darkvision新增existingRangeSource:'race'，只允许与ifAbsent:true配合。种族基准单独从coreRace/raceDefinition静态范围取得，不把选中特性或临时法术的范围当作种族基础。
- 永久投影/临时Effect执行、严格校验与重载、插件数值契约、角色到Headless、机械效果穷尽映射、地图新建与同步、共享投影视野缓存均接入来源限定字段。种族分支先求自身增强/缺省范围，再与其他普通范围取max；原通用条件分支保持兼容。转换SDK说明新增该声明。
- 合成模块二次导出导入测试无种族视觉/矮人；真实Host提交临时条件Effect测试种族0/60/120与临时120的组合。验证移除来源、JSON投影重载、避免重复加值。72项视野/角色/地图存储测试与163项效果/插件/Activity验证回归通过，共8文件235项；定向diff-check exit0。日志racial-vision-tests-20260929.txt、racial-vision-regression-20260929.txt、racial-vision-diff-20260929.txt。
- 未修改原书草稿，未调用API，未更新全书review或来源行为认证计数。仍不能宣称幽域追踪者完整自动化：相对观察者隐形需要贯通Host感知和服务器逐观察者投影；当前代码核查确认两处仍只处理一般隐形，不能只增加状态图标。专属服务器/真实双端条件视野验证也未完成。目标继续active。

## 2026-09-29：逐观察者黑暗视觉隐形

- 上轮为progress（种族来源范围接口与235项测试）。本轮新增Native darkvision-concealment及invisibleToDarkvision永久/临时字段，贯通Effect契约、Registry、执行、校验/重载、插件静态投影、角色/地图同步和SDK说明。
- shared视野模块提供目标能力与逐观察者条件谓词；Host在目标普通黑暗且观察者只能依赖黑暗视觉时判不可见，不改全局invisible条件。现有攻击优势/劣势入口因此使用同一结果。服务器获取目标实际光照，按观察者感官与距离决定匿名化身份；共享视野按合格观察者合并。物理遮挡、隐匿和原有玩家控制语义保留。
- 测试发现初版Host fixture未设置distanceFeetByCombatantPair，已补充权威5尺距离，排除Infinity范围造成假阳性。服务器fixture使用独立geometry。覆盖七种照明/感官组合及共享视野、范围不足、暂停；Native临时提交/移除、永久归档两次往返亦覆盖新字段。
- 8文件236项规则/存储回归 + Headless全文件308项 + 服务器选定6项（170跳过）通过，共550项。首次typecheck74701 exit2仅测试对象未收窄，修复后完整typecheck2264 exit0。日志darkvision-concealment-regression/headless/server/types-final-20260929.txt；定向diff-check exit0。无付费API调用，未触碰真实房间或原书草稿。
- 原缓存逐字复核阴影视野种族范围和观察者限定。新增immutable review r24，coverage r27：155 entries、839 distinct diagnostics、140 reviewed、944 links、804 unreviewed、28 partial、6 source correction、106 expressible；121条目待机制审查，5待批量重生成。batchplan r9 unresolved838 links：mechanism/evidence500、cast-entry28、follow-up0、execution-binding22、status-marker217、manual-boundary67、source-behavior4。
- 仅将诊断0683fad...判为接口可表达，behaviorVerified:false及configurationStillRequiresRegeneration:true保持。没有增加来源行为认证；尚需原书统一再生成、等级资格、真实双端、全部变形交互等验证。全书目标继续active。

## 2026-09-29：临时豁免熟练动态结算与批量旧诊断复核

- 上轮为progress（逐观察者隐形及550项检查）。本轮按来源/机制核查未审诊断，发现Native saving-throw-proficiency在执行时被转成固定savingThrowBonusByAbility：同一属性多次声明或多份来源会相加，且之后熟练加值变化无法跟随。未把旧接口存在当作已正确实现。
- 新增机械Effect字段savingThrowProficiencies，执行器保存去重属性集合。严格归一化/校验、Effect克隆和Host穷尽映射接入。运行时按目标当前proficiencyBonus和固有savingThrowProficiencies计算一次；concentrationDefense、campaign repeat save、两条Activity快照/编译入口接入。旧存档数字bonus保持原语义，不按法术名字猜测迁移。
- 新增temporarySaveProficiency.test.ts：合成模块两次归档往返、真实授权Host施加含重复CON的STR/CON训练、多份独立来源、3→4熟练变化、已有熟练、暂停、移除一份/全部、JSON重载、实际专注豁免与6次真实回合结束到期。通过直接plugin action与registered authority两条实际豁免事件检查总值，保留事务输入不变。初始fixture漏权威距离导致invalid-target，补齐后验证通过，未放宽生产校验。
- 6文件173项相关回归 + 2文件379项Headless/Executor回归通过，共552项；typecheck78425明确exit0，定向diff-check exit0。日志temporary-save-proficiency-regression/headless/types/diff-20260929.txt。
- 原缓存逐字复核幽魂凝视缺少黑暗视觉时授予30尺（仅该条款）及谭森变形术临时STR/CON豁免熟练。immutable review r25、coverage r28：155entries、839诊断、142reviewed、944links、802unreviewed、28partial、6sourceCorrection、108expressible；121条目待机制审查、5待批量重生成。batch r10 unresolved836links，其中mechanism/evidence498，其他类别不变。
- 仅接口可表达，behaviorVerified:false及configurationStillRequiresRegeneration:true保持。看穿30尺实体、已有豁免熟练后的替代构筑选择仍未实现；本轮没有声明这些复合条目已完整自动化。未调用付费API、未修原书草稿、未触碰真实房间，目标active。

## 2026-09-29：抗性中断回归与旧抗性抑制诊断复核

- 上轮为progress（动态临时豁免熟练与552项检查）。本轮批量核查抗性/免疫/熟练类旧诊断，未将包含多个机制的复合声明直接标为解决。
- 新增damageMitigationInterrupt.test.ts真实攻击回归，确认已有火焰抗性+抗性反应错误将9点伤害减为2而不是4。原失败日志damage-mitigation-resistance-gap-20260929.txt。已在最终中断入口加入当前目标/伤害来源的既有抗性检查，全部分量已有抗性时不重复减半；新回归通过。
- 重要未解决项：中断resistance仍在最终amount上减半，类型列表有交集就对整体减半。混合伤害、部分既有抗性、抗性压制、奇数与易伤顺序不能据此认证。不能仅枚举13种类型就关闭“灵体防御”的诊断。已写docs/verification/2026-09-29-resistance-interrupt-ordering.md，列出原始分量防御入口、现有原始伤害checkpoint仅覆盖部分路径、攻击专属抗性生命周期及下一批必要矩阵。该问题源于代码核查，尚未完成混合类型新回归或原始分量重构。
- 核实suppress-damage-resistance已支持元素灾厄单独的临时抗性压制条款。原缓存核对五种类型和法术结束；现有测试覆盖基础/Effect/条件/防御规则抗性，免疫/易伤隔离、暂停、移除、专注终结恢复，以及合成归档两次安装与两条Host入口实际伤害。仅该诊断新增review r26，仍behaviorVerified:false、configurationStillRequiresRegeneration:true。
- 3文件21项抗性压制/归档/构筑检查 + 4文件345项抗性中断/防御/Headless回归通过，共366项；typecheck53569明确exit0，定向diff-check exit0。日志defense-choice-audit-20260929.txt、defense-audit-regression/types/diff-20260929.txt。
- coverage r29：155entries、839诊断、143reviewed、944links、801unreviewed、28partial、6sourceCorrection、109expressible；121条目仍待机制审查、5待批量重生成。batch r11 unresolved835links，其中mechanism/evidence497，其余类别不变。原书配置、预检通过数及来源行为认证数未改变。API调用0，真实房间未修改，目标active。

## 2026-09-29：抗性反应进入原始伤害分量结算

- 提取共享中断资格校验；resistance分支不再对最终合计伤害减半。单类型、混合类型、豁免与区域伤害入口将事件上下文交给原始防御阶段。纯预览不传事件，不消耗资源。
- 当次反应抗性通过纯防御函数参数接入，与已有抗性合并，并接受抗性压制、免疫和易伤顺序。事件事务内记录伤害包，提交后关闭，不写入角色持久效果；后续攻击不继承。计算后未提交、或被来源保护取消的包导致声明校验失败，沿用原子回滚。
- 新增合成实际Host矩阵覆盖斩击+火焰、已有火焰抗性+寒冷、奇数易伤、压制、免疫、1点归零、资源次数、重放、后续动作、来源保护取消。原生灼热射线三次命中仅第一次减半、燃烧之手豁免后抗性均通过。原书草稿不改，不能计为自动转换成功。
- 初轮8文件606项回归通过；类型检查63399 exit1报告3处可选ability.cost访问，已修复。新增取消回滚后中断文件18项通过。最终回归78729与类型检查60785运行中，须续读会话得到明确退出状态。
- 本轮不提升来源行为认证、不更新review/coverage/preflight通过数。付费API调用0，真实5273/5274房间未改。全书目标active；下一步仍需可导出模块/脚本入口的中断专项补证与剩余机制批量实现。

- 最终验证完成：回归78729明确exit0，8文件607项通过（resistance-raw-regression-final-20260929.txt）；完整typecheck60785明确exit0（resistance-raw-types-final-20260929.txt）；定向diff-check exit0（resistance-raw-diff-final-20260929.txt）。所有本批检查会话结束。上述旧“运行中”记录由本条最终状态取代。

## 2026-09-29：归档重装与核心资源ID兼容

- 上轮为progress：原始分量抗性结算修复及607项回归。本轮新增damageResistanceArchive.test.ts，以合成模块实际导出/读取/注册、再次导出/重新注册验证抗性反应，而不是手工把特性ID写入防御者快照。
- 角色从2级升级到3级获得模块子职，JSON重载后通过地图所用dnd5eDamageMitigationInterruptFeaturesForCharacter查询可见，迁移到Host时仍持有能力。武僧/战士分别消耗已有核心资源；13种伤害类型经普通攻击/插件Activity路径各自测试，两次安装共104次成功伤害提交，包含再次提交拒绝、只耗一次反应和资源、输入不变。
- Fixture最初继承normalizeCharacter默认战士冠军选择，导致invalid-subclass；明确未选子职后通过。最初武僧气资源被不具备该职业的战士迁移移除，调整为真实职业资源。随后发现生产问题：持久化fighterSecondWind/fighterActionSurge/fighterIndomitable是驼峰，但声明式消耗和Activity校验只接受小写。新增coreResourceIds共用精确白名单；声明式仅scope:core接受这三个旧键，Activity资源字段也兼容它们，自定义插件ID格式未放宽。
- coreResourceIds.test.ts证明三种核心键接受、插件作用域/省略作用域拒绝，以及错误大小写/未知驼峰/空格/特殊键拒绝。5文件137项回归通过（resistance-archive-regression-20260929.txt），其中归档文件4项矩阵，不将104次内部提交当作104个独立测试。
- 完整typecheck71396运行中（resistance-archive-types-20260929.txt），继续读取同一会话。原书草稿、review/coverage及行为认证数不变，API调用0，真实房间未动，目标active。归档证明只覆盖合成类型抗性协议，不证明灵体防御完整规则（攻击限定、时点和其他复合条款需独立核实），亦未替代实际浏览器双端验收。

- 最终验证：typecheck71396明确exit0；定向diff-check exit0（resistance-archive-diff-20260929.txt）。本批所有检查已结束，以上运行中状态由本条取代。137项回归结果有效，没有付费调用。

## 2026-09-29：声明式减伤反应的独立次数与资源合并

- 上轮为progress：模块往返验证及核心资源ID兼容。本轮扩展原有归档矩阵，在导入的反应能力声明limits.uses=3、cost.uses=2及共享核心资源。原实现4个矩阵均失败：实际次数仍3而应为1（resistance-use-limit-gap-20260929.txt）。这是真实结算缺口，未绕过资源声明或修改原书草稿。
- 将减伤反应成本统一为按资源键合并的Map，加入自动注册的能力独立次数；共享职业资源与独立次数在消费前一起检查。抗性、减伤、转移和护盾池均复用该成本，在同一次激活中只消费一次。多个成本指向同一资源时先合并，避免逐项各自足够但合计不足。
- 导出dnd5eDamageMitigationInterruptHasResources共享纯资源资格校验，MapsWorkspacePage候选查找使用Host快照筛除次数或资源不足的反应。其余范围、视线、职业和反应经济仍由既有Host完整校验负责。
- 归档矩阵仍覆盖两次安装、真实升级、13类型、武僧/战士、普通攻击/插件Activity路径；新增检查独立次数3→1，以及恢复反应和共享资源后因独立次数不足仍拒绝，HP、反应和资源保持输入值。另增减伤/转移/护盾池3项真实Host测试，验证共享资源重复成本合并、次数消耗、任一种余额不足原子拒绝。
- 4文件338项回归通过（mitigation-use-limits-regression-20260929.txt），定向diff-check exit0。完整typecheck74082运行中（mitigation-use-limits-types-20260929.txt），应继续读取同一会话确认退出。
- 原书review/coverage、转换通过数及来源行为认证数未提升，付费API调用0，真实房间未修改。实际浏览器双端流程与完整原书重生成仍未验收；目标active。

- 下一机制核查证据：从xge-cached-boundary-audit-20260929-r2.json读取边界行者0996cf…:43:0的最后一段灵体防御。原文包含15级、因攻击受伤、反应、该攻击涉及伤害类型，以及持续至当前回合结束。本批默认单伤害包抗性不能直接代表这个完整声明，尤其触发来源和持续期不能靠枚举13种伤害类型替代。保持该诊断未认证，下一批需核对并扩展通用协议，而不是给原草稿硬编码法术名。

- 最终验证：typecheck74082明确exit0；回归51323 exit0，共4文件338项；定向diff-check exit0。独立中断测试58542也已读取exit0，所有本批检查会话结束。上面的运行中记录由此最终状态取代。

## 2026-09-29：攻击伤害触发条件

- 上轮为progress：独立次数/资源合并修复。本轮核查原缓存边界行者灵体防御的“因攻击受伤”条件；现有来源仅weapon-attack/spell/other，无法区分法术攻击和豁免法术，不能仅枚举13类型替代触发限制。
- 只读检查Chris's Premades公开main树，commit e4d85d6d5fc3852cb0dec60c06e42072def8923c，完整树891项/truncated:false，未找到spectral defense/horizon walker实现。来源https://github.com/chrisk123999/chris-premades/tree/e4d85d6d5fc3852cb0dec60c06e42072def8923c 。未复制代码，也未把未找到实现当作规则证明；搜索出现的社区讨论不用于权威认证持续期。
- 新增严格可选attackOnly布尔字段；Host统一资格校验要求weapon-attack或Host传入的attackDamage。原生玩家/怪物法术攻击及持续法术攻击分类写入来源；Activity执行器仅在成功attack-roll outcome且伤害目标就是该检查目标时生成attackDamage，编译器/直接提交/插件Host能力传递。无条件分支、失败分支、攻击者自身伤害不借用别的命中记录。
- 地图原生武器/怪物/法术反应候选传入实际来源分类；SDK说明新增字段和限制。未改变默认单伤害包持续期，未把灵体防御复合条款认证为完成。
- 归档测试扩展为9项矩阵：两次安装、13种类型、武僧/战士、普通攻击/插件Activity及攻击限定；无条件伤害负例同时执行无反应基线证明伤害本身有效，并确认声明反应因invalid-class-feature原子拒绝，避免invalid-dice假阳性。原生灼热射线可触发、燃烧之手不可触发通过。新增Activity攻击来源4组合与attackOnly字段严格校验。
- 当前完整回归7164、typecheck38993运行中，分别日志attack-only-regression-20260929.txt和attack-only-types-20260929.txt，续读同一会话。原书配置/review/coverage计数不变，API调用0，真实房间未修改，目标active。命中后的独立触发Activity、按同一次攻击追踪更晚伤害及持续期尚须补充端到端证据。

- 最终回归7164明确exit0，共7文件673项。初次typecheck38993 exit1仅新增测试fixture缺level/proficiencyBonus及动作联合类型推断；已补必填字段并将动作标注Dnd5eAction。2文件14项相关重跑通过（attack-only-fixtures-final-20260929.txt），与673重叠不相加。完整typecheck31445复查运行中（attack-only-types-final-20260929.txt）。定向diff-check exit0。
- 尚需追踪的来源边界：内置攻击的独立附加伤害（例如独立的命中后伤害函数）不能靠上一条attack-resolved事件推断。必须补充同次攻击的明确关联，再验证与独立触发Activity、延迟/周期伤害及当前回合边界的区别。当前新增attackOnly不因此宣称涵盖所有复合来源，也未修改原书配置。

- 最终typecheck31445明确exit0，日志attack-only-types-final-20260929.txt。本批所有验证会话结束，之前的运行中状态由本条替代。673项回归、测试修正后14项重跑、完整类型检查及定向diff-check均通过。目标仍active，原书自动化认证数量未增加。

## 2026-09-29：同次攻击附加伤害与怪物分量取整

- 上轮为progress：attackOnly协议及673项回归。本轮增加真实Host失败证据：巨蜘蛛9穿刺+9毒素用攻击限定抗性后错误剩17 HP而应22；同次怪物攻击两段3火焰分别减半错误剩28而应27；火焰箭9+降咒7黯蚀错误剩19而应23。三项均在旧代码实际失败（attack-rider-origin-gap-20260929.txt）。
- Monster命中豁免附加伤害由所属攻击解析器显式标记attackDamage，周期伤害调用仍保持默认false。原生法术降咒附加伤害沿用当前usesSpellAttackRoll，不借用全局最后一条攻击事件。
- 怪物攻击分量进入共享adjustDnd5eDamageComponents。函数泛型保留onHitEffectId等原有来源字段，允许分量自带damageSource；按伤害类型及delivery、magic、材质、阵营、环阶、绕过抗性/减伤标志、攻击属性分组，一组统一防御/取整，再分配回原分量。条件来源不同不错误合并。
- 6文件427项回归通过（attack-rider-regression-20260929.txt）。之后补同回合下一次攻击无中断：三种攻击都全额伤害，反应不继承；26项定向重跑通过（attack-rider-followup-20260929.txt），与427重叠不相加。diff-check exit0。写入测试文件时一次UNKNOWN打开错误，文件未截断；C盘健康且剩约92GB，改用apply_patch后成功，无需清理或改权限。
- 完整typecheck30432运行中（attack-rider-types-20260929.txt），续读同一会话。API调用0、原书草稿与review/coverage不变、真实房间未修改，目标active。当前仍未证明独立触发Activity跨提交的同次攻击持续期；该边界不靠本批三项测试宣称完成。

- 首次typecheck30432 exit1仅合成怪物两条damage fixture缺少必填average。已补average:3，26项定向测试再通过（attack-rider-fixture-final-20260929.txt）。完整typecheck2285复查运行中（attack-rider-types-final-20260929.txt），定向diff-check再通过。不要将这26项与427项相加。

- 最终验证：typecheck2285明确exit0（attack-rider-types-final-20260929.txt）。本批427项回归、fixture修正后的26项定向复查与定向diff-check通过，所有检查会话已结束。无新增API调用；全书目标仍进行中。

## 2026-09-29：永久豁免熟练的条件选择

- 上批伤害来源检查已完成。本批回到共同角色选项机制，新增 select.options.requiresSavingThrowProficiency，严格属性/布尔/去重校验。Host 和升级界面共享资格判断，按授予前永久熟练区分默认与替代选项；本内容授予不满足自身前提。
- 界面使用升级前快照，并顺序预览之前已有效选择的专长/构筑授予；后端重新校验，错误选择原子拒绝。同步更新 SDK 和 AI 转换说明。
- 5文件59项回归通过（save-fallback-batch-final-20260929.txt），含模块两次安装、升级、重载、Headless 熟练加值、修订与无输入修改。初次归档失败为fixture缺必填能力与错误选择键，修正后通过。完整typecheck2004运行中（save-fallback-types-20260929.txt），续读同一会话。
- 详细范围见2026-09-29-save-proficiency-choice.md。幽域追踪者钢铁意志对应条件已有接口证据；未重生成原配置，武士复合诊断也不能因此全部认证，review/coverage计数不变。无付费API调用，真实房间未修改，全书目标仍active。

- 首轮类型检查2004 exit1，仅新增归档fixture的classId被推断为string；已明确fighter字面量。完整复查65804运行中（save-fallback-types-final-20260929.txt）。Advancement合约末尾多余空行已清理，定向diff-check exit0。

- 最终验证：typecheck65804明确exit0（save-fallback-types-final-20260929.txt）。5文件59项回归与定向diff-check通过，本批所有验证已结束。未提升原书认证数，目标保持active。

## 2026-09-29：构筑接口回填与工具选择归档验证

- 上轮分类为progress：条件豁免熟练接口、59项回归和完整类型检查。本轮核对当前类型日志、私有清单及缓存原文，继续处理同类机制，未调用API。
- 书画之道原文要求书法/画家工具二选一；已有proficiency advancement和规范目录ID无需重写。新增toolChoiceArchive.test.ts，两次归档安装后验证中文候选、漏选/多选/伪造ID拒绝、真实2→3级升级、JSON重载，以及实际Host工具检定仅为所选工具增加熟练加值，输入不变。最初单角色战斗已结束导致检定拒绝，补合法敌对参战者后通过；没有放宽生产校验。
- 4文件31项回归通过（build-choice-archive-batch-final-20260929.txt），包括既有条件豁免归档和地图属性检定路径。完整typecheck15255运行中（build-choice-archive-types-20260929.txt），续读同一会话。
- 保存不可变review r27、coverage r30和batches r12：仅将钢铁意志的熟练条件诊断及书画之道的目录选择诊断归为当前接口可表达。原文短句匹配、诊断哈希和来源作用域均经脚本核查。两者仍behaviorVerified:false、configurationStillRequiresRegeneration:true，未改原草稿，也未认证完整子职。
- 当前155来源、839诊断、944来源关联；已审145诊断，799关联未审、28部分、6来源纠正、111接口可表达；未解决关联833。121来源仍需机制审阅，5来源待集中重生成，均不代表全书完成率。真实房间未动，全书目标active。

- 最终类型检查15255明确exit0（build-choice-archive-types-20260929.txt），31项相关回归已通过。本轮无未结束检查进程，无API调用。新审阅仅证明两个狭义诊断可表达，全书转换与行为认证继续保留未完成状态。

## 2026-09-29：旧清单的机制分类刷新

- 上轮为progress：工具归档验证及两项精确诊断审阅。本轮复核当前日志后，发现24项机制留在unclassified，包含造妖存活限制、场景建筑、永久化、遮蔽与占位校验，影响按共享接口批量开发。
- 提取suggestFullbookMechanismFamilies共用分类器，补充上述术语；批次规划使用当前分类建议并保留originalSuggestedFamilies。旧backlog和review不重写，未知文本继续unclassified，任何分类都不改变阻断或支持状态。
- 3脚本测试共10项通过（fullbook-routing-final-20260929.txt）；定向diff-check通过。不可变batch r13较r12未分类24→1；断言验证全部839诊断、来源关联、条目与计数完全保留，未解决关联仍833，没有以归类清除缺口。纯MJS改动无须重跑完整TS构建。
- 下一项核查有明确原文与代码证据：操水来源0996cf…:165:3要求同一来源至多两个非立即效果，以及一个动作解除其一。现有Activity stacking是单目标/效果叠加，monster sourceTargetLimit仅属于怪物动作，不能冒充跨场景对象的来源级数量限制。该诊断586b8464…仍未解决；下一实现需覆盖不同模式共享上限、来源隔离、即时模式不计数、动作解除、到期/重载及地图对象生命周期，不能仅新增一个局部计数谓词就宣称支持。
- API调用0，原房间未动，全书目标继续active。此轮进展是排程修复与下一机制边界核实，没有新增原书行为认证。

## 2026-09-29：持续区域来源上限

- 上轮为progress：批次分类刷新及明确来源数量限制边界。本轮新增create-persistent-area.sourceLimit组ID/最大数协议，严格验证、执行器传递、地图存档迁移和Host提交上限校验；三个实际地图提交入口提供当前Host地图集合。
- 相同模块/组/角色跨地图共享数量，其他角色和组隔离；怪物按地图Token隔离。世界时到期释放、永久效果保留、跨地图回合不可比较时保守计入。一次事务多个区域超限则无可提交结果，不修改输入；重复handoff ID不重复计数。已有较低上限不能被后续较高声明绕过。旧无上限声明不变。
- 归档读取/执行器传递、跨地图重载、解除后释放、缺Host快照、非法声明和多次创建原子拒绝已有合成测试；6文件263项原有及新回归通过（area-source-limit-regression-20260929.txt），后增归档用例3项通过（重叠不相加）。定向diff-check通过。具体边界见2026-09-29-persistent-area-source-limit.md。
- 首轮typecheck15206 exit1：sourceLimitMaps参数误加到相邻移动函数，以及测试将声明层操作直接当已解析proposal导致hallow类型不符。已移到正确提交签名并给测试明确proposal字段，后续区域+延迟召唤回归通过。完整复查78686运行中（area-source-limit-types-final-20260929.txt），应续读同一会话。
- 延迟队列剔除临时sourceLimitMaps，避免保存全房间地图快照。SDK与转换提示已对齐。未做原操水配置重生成、完整动作经济双端验证或并发写入验证；该原书诊断仍保留未解决，无API调用，无真实房间改动，目标active。

- 最终验证：typecheck78686明确exit0（area-source-limit-types-final-20260929.txt）。后续2文件19项区域/延迟召唤测试通过，与263项有重叠不相加；定向diff-check exit0。本批检查全部结束，原书审阅与认证计数未提升，全书目标仍active。

## 2026-09-29：地图写入跳过操作的自动化误判

- 上轮为progress：跨地图来源上限。本轮检查实际map handoff边界，确认普通物件操作存在有意保留的成功但不写入分支；注册proposal handler不能据此证明自动化完整。
- 自动化分析新增运行时限制：modify-map-object-lock、enchant-map-object-light、purify-map-consumables、带mappedObjectEnchantment或suppressesMappedBarriers的区域，以及现有true-polymorph物变生分支，不能再仅凭处理器注册判full。报告保留注册覆盖，同时列出具体operation ID及effects/persistence手动阶段；原施放/地图行为未修改，也未擅自启用物件系统。
- 新增5类操作及物变生作用域测试，明确旧full标签不能覆盖运行时限制；普通区域及其他召唤保持原判断。3文件109项回归通过（map-boundary-analysis-20260929.txt）。类型检查16049运行中（map-boundary-analysis-types-20260929.txt），应续读同一会话。Registry文件有已知旧空白问题，测试文件定向diff-check通过。
- 核实离线预检脚本不调用转换API，重跑全部155来源、仅复用明确未人工修复且原文完全匹配的自动产物，保存不可变preflight r18。结果仍29 ready-for-behavior-tests、124 blocked、2 no-parseable-current-source-draft；本次原始候选没有匹配新增地图跳过诊断，未虚报修复了原书条目。旧backlog/review保持原版本，无新来源认证。
- API调用0、用户房间未动，全书目标active。此批修的是验收准确性，不是此前停用的普通物件机制实现。

- 最终验证：typecheck16049明确exit0（map-boundary-analysis-types-20260929.txt）。109项回归及155来源离线重检结束，无未结束检查进程。全书目标仍active，原书行为认证数不变。

## 2026-09-29：混合地图提交不再丢弃受支持操作

- 上轮为progress：识别地图写入边界跳过操作并修正自动化报告。本轮继续该边界，实际失败测试证明一个magic-mouth物件操作与一个普通持续区域同时提交时，原代码直接返回成功，普通区域也被丢弃（mixed-map-handoff-gap-20260929.txt）。
- 改为只剔除原本停用的物件写入，然后让剩余操作经过相同的地图提交校验及原子暂存。纯物件分支保持原语义，未启用停用机制；独立区域、召唤、位移等不再被连带跳过。新增断言验证普通区域确实创建，缺放置数据拒绝，受限区域缺完整Host快照拒绝，输入未修改。
- 4文件104项回归通过（mixed-map-handoff-regression-20260929.txt），覆盖地图交互、来源上限、延迟召唤及自动化分析；定向diff-check通过。完整类型检查3518运行中（mixed-map-handoff-types-20260929.txt），续读同一会话。
- 这修复了可导入模块组合机制的实际提交缺口，未认证停用的物件操作或整项原书法术。既有assisted/限制报告继续保留；API调用0，真实房间未修改，目标active。

- 最终类型检查3518明确exit0（mixed-map-handoff-types-20260929.txt），104项回归与定向diff-check通过。本批所有检查完成，原书认证计数未增加，无新增API调用，全书目标仍active。

## 2026-09-29：持久伙伴已有实例时拒绝创建

- 上轮为progress：混合地图操作修复。本轮检查现有owned-companion只做目标归属判断，persistent召唤会替换已有伙伴，不能表达已有存活造物时施法失败。
- 新增summon.existingBondPolicy:reject-living，要求persistent和bondKey；校验器、执行器、导出导入、地图提交、SDK及转换说明对齐。Host在专注/持久重施清理前核查完整地图集合，按包/契约/来源隔离，已有正HP或未知HP拒绝，遣散不当作死亡；一次事务同契约多次创建拒绝。缺Host上下文拒绝，旧未声明策略保持替换行为。
- 扩展原有双安装/解除归档测试：实际注册Strict Activity、Host解析与传递、跨地图角色、怪物Token、本地重载、遣散/未知HP/0HP/其他模块、缺上下文、同事务重复创建和输入不变。旧释放/不释放契约的召回路径仍通过。这里按既有召唤系统0HP败退边界处理，未证明需要死亡豁免或复活状态的模型；造妖原来源仍未认证。
- 4文件回归通过（living-bond-regression-20260929.txt），定向diff-check通过。完整typecheck24725运行中（living-bond-types-20260929.txt），续读同一会话。无付费API调用，无真实房间修改，review/coverage计数未提升，目标active。

- 首次typecheck24725明确exit0，4文件176项通过。继续审查发现落点预览与延迟出现原未传完整Host地图上下文，会导致策略正确拒绝但无法使用；已补目标选择hook、回合边界和延迟队列的当前上下文传递，不读取队列中旧地图快照。
- 增加落点可选/已有伙伴无可选格，以及延迟出现成功、等待期间出现同契约伙伴后blocked、缺上下文blocked、输入不变测试。2文件19项通过（living-bond-boundary-final-20260929.txt），与176项有重叠不相加。类型复查33248运行中（living-bond-types-final-20260929.txt）；定向diff-check通过。跨客户端并发提交仍无独立证明，不升级为完整原书认证。

- 最终类型复查33248明确exit0（living-bond-types-final-20260929.txt），本批全部检查已结束。176项主回归及19项复查、定向diff-check通过，原书认证计数不变，全书目标active。

## 2026-09-29：持续攻击效果支持简易/军用武器类别限制

- 上轮为progress：存活伙伴重复创建限制及边界验证完成。本轮核对当前源码及缓存原文，发现attack-weapon-category触发谓词已存在，但持续weapon-attack-roll效果原来仍覆盖所有武器攻击，不能表达谭森变形术的简易/军用限定。
- 新增weapon-attack-roll.weaponCategories，配套weaponCategoryRollModes活动状态、严格校验、复制、回读、Host效果提交和装备攻击预览/结算。限定分类时不接受徒手、法术或未知类别；省略字段保持原语义。不从原生怪物攻击名称猜测类别，也不授予装备熟练。
- 首次测试揭示Host提交包装器丢失新字段，已修复并保留回归。3文件138项通过（weapon-category-effects-final-20260929.txt），包括合成模块双次导出安装、真实攻击、预览、暂停、重载和非法输入；另2文件131项验证回归通过（weapon-category-validation-20260929.txt）。完整typecheck48895仍运行（weapon-category-types-20260929.txt）。定向diff-check发现equipmentAttackAction.ts文件尾多余空行，待类型进程结束后一并修整。
- 原文精确诊断441fb4b2e8b0cee14cf7336450973abf10da048944519c6ee68edcf8ffae73bb记录为接口可表达，behaviorVerified:false/configurationStillRequiresRegeneration:true；未人工修复或重新生成原文配置。review r28、coverage r31（146诊断审阅、112条可表达链接）、batch r14（832未解决链接）排他新建，旧账本不覆盖。
- 其余谭森变形术条款和浏览器双端仍未认证，全书原来源就绪29/155未提升。本轮付费API为0，真实5273/5274房间未修改，目标active。

- 完整类型检查48895明确exit0。仅清除equipmentAttackAction.ts文件末尾多余空行；随后定向diff-check复查。138项行为回归和131项校验回归均通过，未把接口证据计作原书自动转换成功。

## 2026-09-29：持续技能数值加值及旧自动草稿解析

- 上轮为progress：武器类别限定效果完成。本轮检查不可解析条目的原始自动草稿，发现救赎之誓和平使节已有明确ability-check add的魅力说服+5字段，但校验器只支持优势/劣势，整份子职业无法解析。
- 新增带skill的ability-check add及可选ability联合选择器。公式施加时求值，skillCheckBonuses经过效果提交、克隆、序列化、回读；严格拒绝不合法值及缺skill。角色技能显示、普通Host技能检定、Activity快照和相关对抗/挣脱/隐匿入口读取同一活动状态，保留旧环境灵光逻辑。
- 6文件166项测试通过（skill-bonus-batch-20260929.txt），覆盖真实授予/Host/回读、显示与检定、选择器、暂停到期、负值/非法数据、双次模块导入导出和注册执行。3文件320项引擎/对抗/区域技能回归通过（skill-bonus-engine-regression-20260929.txt）。完整typecheck72488还在运行（skill-bonus-types-20260929.txt）；定向diff-check通过。
- 离线全书预检38139已exit0，报告r19排他新建。未编辑任何原文自动产物；救赎之誓contentParsed:false→true，加值Activity兼容检查通过，仍因其他机制blocked。全书29 ready/125 blocked/1 no-parseable-current-source-draft，上一版29/124/2。API0，未重提PDF、未修改真实房间。review r28/coverage r31/batch r14未因解析改善更新为来源行为认证。
- 新文档2026-09-29-skill-check-bonus-effects.md记录范围。数值公式在施加时求值，不是随属性持续动态变化；泛属性/工具检定加值未声称支持。原文动作/资源/期限及完整子职业、双端行为仍需后续验收，目标active。

- 首次类型检查72488以exit1结束：编辑器旧枚举不接受add及测试source.kind写成plugin。已补编辑器数值加值选项/输入/必填技能提示与加载保存，测试改为feature来源。类型复查72391运行中（skill-bonus-types-final-20260929.txt）。4项复查通过（与166项重叠）；其中编辑器既有测试仅覆盖草稿元数据迁移，不是新增UI的浏览器验收。若干PowerShell读取短暂等待后均exit0，未重复执行写入。

- 最终类型复查72391明确exit0，定向diff-check通过。166项机制测试、320项引擎回归及4项重叠复查均结束；API0，全书目标保持active。

## 2026-09-29：区域豁免按体型自动成功

- 上轮为progress：技能数值加值及救赎之誓解析阻断修复。本轮核查碧水球旧自动草稿和缓存原文：重复豁免缺saveAbility/saveDc不能擅自补为自动转换成功；Huge及更大自动成功确无区域字段，优先实现这项共享机制。
- 新增savingThrow.automaticSuccessMinimumSizeRank（0..5）；Huge为4，不能把PDF中文巨型误映射成项目Gargantuan的rank5。声明/存档/Host DC解析、插件校验、准备骰子和Headless提交串通；首轮发现声明规范化丢字段并修复。满足时无豁免骰，Host再次按规则体型检查，自动成功不等于免疫区域所有效果。
- 4文件414项通过（area-size-save-final-20260929.txt），后续2文件89项通过（area-size-save-boundary-20260929.txt，重叠）；同显示尺寸的大型/Huge/Gargantuan、输入不变、区域回执及重载防重放、体型改小重新需要骰子覆盖。导出安装及来源DC保存使用现有合成归档测试。
- 首次完整typecheck79660 exit1：新自动结果字符串未在事件类型登记。改为size-rule-success/dm-adjusted-automatic-failure并补日志无需掷骰展示和nextD20不消耗测试；复查42336运行（area-size-save-types-final-20260929.txt），4文件边界测试88709运行（area-size-save-boundary-final-20260929.txt）。定向diff发现persistentAreaTypes既有一处行尾空格已清理。
- 原文精确诊断f33e070467c0baf7d3f24d6f9a6741b71e89ed788815d358c966265ce018c0e3仅标接口可表达：review r29、coverage r32（147诊断审阅、113可表达链接）、batch r15（831未解决链接）排他新建。behaviorVerified:false，原配置仍需重新生成，碧水球其他行为/解析和双端未认证。主预检仍r19：29/125/1。API0，未改变真实房间，目标active。

- 类型复查42336明确exit0，生产代码未再修改。边界88709结果147通过/1失败：nextD20Advantage旧死亡豁免用例在角色本回合中途HP改0后直接豁免，与现有回合开始资格冲突，未进入本批区域分支。修正测试通过两次正常end-turn到下一回合，保留原即时请求invalid-actor断言；未改运行时死亡规则。nextD20/deathSaveTurn/战斗日志3文件回归通过（area-size-save-d20-final-20260929.txt），新增自动结果不会消耗预备优势、日志不展示伪d20。定向diff-check通过。各批有重叠，不相加为唯一测试数；所有进程已结束。API0，目标active。

## 2026-09-29：区域最近空位排出地图事务

- 上轮为progress：体型自动豁免及回归完成。本轮核查发现现有push-from-source仅在页面层操作地图，不能表达最近区域外空位，更不能视为共享结算已支持排出。
- 新增nearest-outside-area，禁止附带distanceFeet，复用Activity强制位移占格/边界/墙体校验，按网格距离与行列稳定选取。共享resolvePreparedDnd5ePersistentAreaTrigger中原子更新Headless位置、forced moved事件、地图与回执，无落点拒绝整笔而不返回application。选点使用结果态投影以保留形态/位置改变；保留原推移UI分支并限定其mode以避免重复执行。
- 3文件93项初验通过；4文件167项收敛回归通过（area-ejection-final-20260929.txt，前者重叠），包括几何/完整占格/实体阻挡、普通与自动豁免、失败不移动、移动力不消耗、模块归档与来源DC、无落点不写入和输入不变。typecheck1736运行中（area-ejection-types-20260929.txt）。
- 当前保持目标高度，不解决悬空水球垂直排出和下落；因此不升级原文诊断为完全可表达，review/coverage/batch保持r29/r32/r15，主预检r19仍29/125/1。SDK与转换说明及2026-09-29-area-nearest-ejection.md记录范围。API0，未编辑自动转换产物和真实房间，目标active。

- 初次完整类型检查1736 exit1：Headless返回的事件数组只读，不能原地push或传给可变地图事件参数。改为本地事件副本，与最终application共享，附加位移及位置关系清理事件；没有篡改原结果事件数组。2文件82项提交路径复查通过（area-ejection-commit-final-20260929.txt，与167项重叠），差异检查通过。类型复查99081运行中（area-ejection-types-final-20260929.txt）。

## 2026-09-29：区域排出与擒抱关系交叉验证

- 上轮为progress：最近空位排出共享事务及167项回归。续接时99081句柄已不存在，日志只有tsc命令无诊断，没有可恢复退出码；不据此声称通过。补跑类型检查33635（area-ejection-types-confirmed-20260929.txt）。
- 添加真实准备/结算路径的擒抱交叉用例：区域排出超过擒抱距离，要求Headless条件、地图持久化状态和唯一invalid-relation事件一致，输入不变。定向pluginAreas测试4827运行中（area-ejection-relations-20260929.txt）。未修改生产TS、自动转换草稿或真实房间。API0，目标active。
- 类型检查33635明确exit0。交叉测试首跑78通过/1失败：测试构造的怪物擒抱缺少可验证声明/逃脱检定，被规范化剔除，不能用于验证移动解除。改用标准basic-action:grapple/free-hand关系，期望实际距离失效事件out-of-range；生产代码未改。最终复查31727运行中（area-ejection-relations-final-20260929.txt）。
- 最终31727明确exit0，pluginAreas 79项全通过（与此前167项重叠），新增区域排出确实同步解除标准擒抱、返回唯一out-of-range事件并保持输入不变。差异检查通过；本轮类型检查33635退出0后仅修正测试声明字面量和断言，无生产代码改动。全部进程结束，API0，真实房间未动。全书仍29 ready/125 blocked/1不可解析；垂直排出、容量/随机排出及携带生命周期等仍未完成，目标active。

## 2026-09-29：区域推离移入共享Host结算

- 上轮为progress：区域最近空位排出与合法擒抱关系交叉验收，79项通过、类型检查退出0。本轮检查到push-from-source仍只在MapsWorkspacePage修改地图，没有Headless位移事件，而且always分支未排除declined。
- 新增dnd5ePersistentAreaPushMovementV1规划器，复用原方向与碰撞逻辑，返回实际位置/距离；兼容地图投影函数委托此规划器。共享区域事务统一处理两种模式、位置、forced moved事件、空间关系、地图和回执。移除页面二次推移。完全阻挡保留零位移和其他效果，缺失来源不静默吞掉。
- 合成归档测试参数化两种位移声明；擒抱交叉测试参数化两种模式。新增推离矩阵覆盖三种appliesOn/豁免成功失败、损伤、移动力、地图一致性、刷新回执、受阻、拒绝机会、缺失来源。5文件179项首跑178通过/1失败：缺失地图来源在mapBridge抛异常。增加事务前完整Token集合校验，明确invalid-target且原态/空事件/无application。2文件复查98167运行（area-push-shared-final-20260929.txt），完整typecheck94380运行（area-push-types-20260929.txt）。
- API0，不修改旧自动生成配置，不升级全书来源诊断；review r29/coverage r32/batch r15和预检r19 29/125/1保持。未碰真实房间，未做双端浏览器认证。沿途区域触发级联、垂直排出、容量及携带等尚未完成。目标active。
- 复查98167退出0，2文件89项通过。类型检查94380退出1：新增测试damageType应为damage.type，区域缺sourceCharacterId。修正为正式字段及怪物来源空角色ID；生产类型无诊断。定向测试93992（area-push-fixture-final-20260929.txt）与类型复查10224（area-push-types-final-20260929.txt）运行中。
- 最终类型复查10224明确exit0（area-push-types-final-20260929.txt），修正测试字段后的9项定向复查93992退出0（area-push-fixture-final-20260929.txt，与89/179项重叠）。全部进程结束。新验收文档2026-09-29-area-push-shared-transaction.md，SDK和AI转换说明同步。API0，目标active。

## 2026-09-29：持续区域目标自愿豁免失败

- 上轮为progress：区域推离共享事务、回归与类型检查完成。本轮核查发现Activity已有allowWillingFailure，持续区域没有等价接口。缓存PDF碧水球:171:5明确大型及更小可自愿失败、Huge及更大自动成功。
- 补savingThrow.allowWillingFailure声明/规范化/插件校验/归档保留；准备态给出选择资格。Headless willingFailure必须由Host目标控制者选择，拒绝未声明/非布尔/体型自动成功覆盖，自动失败无d20、无下次优势消耗，沿用失败效果及DM单独覆盖。日志增加无需掷骰语义。
- 页面共享选择窗口路由目标角色或DM，默认resist，选择协调器在同一事务的批量豁免/提交间缓存一次明确回答，新事务重新询问。来源sourceMayDecline的触发先征求来源意见，排除预掷波，避免未触发就询问目标。没有信任施法玩家传来的同意声明。
- 5文件168项首验通过（area-willing-failure-20260929.txt）。选择协调器及既有Activity自动豁免/后继检查3文件48项通过（area-willing-coordinator-20260929.txt，与前者重叠）；完整类型检查12675运行（area-willing-types-20260929.txt）。真实房间未动、API0、原配置未修改；碧水球其他机制及全书目标仍未完成。
- 完整类型检查12675明确exit0，差异检查通过（area-willing-diff-20260929.txt）；全部进程结束。新验收文档2026-09-29-area-willing-failure.md。
- 精确诊断2bb7f930b1a408852655516847729df59879046d950ef42bd5da89a10760cf7d按缓存原文核验后，review r30排他新建，仅expressible-by-current-runtime，behaviorVerified:false，仍要求重新生成原配置。新coverage：fullbook-review-coverage-20260929-r33.json，148诊断已审阅/114可表达链接/796未审阅；新batch：fullbook-mechanism-batches-20260929-r16.json，830未解决链接（机制492、施放入口28、执行绑定22、标记217、人工边界67、来源行为4）。这些不是法术完成率。原预检r19仍29 ready/125 blocked/1不可解析，未付费重转也未改原草稿。目标active。

## 2026-09-29：区域状态实例归属与隔离

- 上轮为progress：持续区域自愿失败、目标选择与导出/运行时验证完成。本轮核查携带路径前发现前置缺口：普通区域状态没有统一实例标签，原生状态ID与叠加键只区分法术/来源；泛型区域的skipSaveWhenSourceConditionActive又拿插件rulesId与未定义coreSpellId比较，无法识别自己的状态。直接按restrained携带会混淆其他来源。
- 新增persistentAreaConditionEffects共享筛选器；新标准状态写persistent-area:<areaId>，ID/stackingKey按实例/来源/状态隔离。准备态与Headless跳过豁免统一使用有效且未暂停的来源实例；无标签旧原生效果保留显式兼容，严格实例筛选不推断旧状态归属。
- 蛛网Headless及地图清理同步按实例识别。目标仍在同一施法者的另一张蛛网内，不会保留已经离开的新实例状态；无标签旧数据继续兼容施法者规则。保留symbol恐惧来源坐标标签。
- 4文件119项通过（area-condition-origin-20260929.txt）；补蛛网同施法者双实例清理并跑原生施法广泛回归，3文件234项通过（area-condition-origin-final-20260929.txt，有重叠）。定向差异检查通过。完整typecheck61364运行（area-condition-origin-types-20260929.txt）。
- 此批解决携带所需来源归属和一个真实区域豁免/状态覆盖缺口，尚未实现携带平移/容量/垂直生命周期，不提升全书条目认证。review r30、coverage r33、batch r16和主预检r19保持。API0，未改自动转换配置或真实房间，目标active。
- 完整类型检查61364明确exit0（area-condition-origin-types-20260929.txt），所有进程已结束。此次实例归属保留旧数据兼容，但不会给无实例标签的旧状态编造携带资格。下一步仍需将实际携带平移接入区域移动共享事务及碰撞/生命周期检查。API0，目标active。

## 2026-09-29：命令区域携带束缚目标

- 上轮为progress：状态实例标签、独立叠加及源实例豁免/蛛网清理隔离完成。本轮实现movement.carryRestrainedTargets:true，添加共享planDnd5ePersistentAreaCarry，严格按实例/来源/有效restrained和区域相交识别乘员；角色资料缺失拒绝，不把无归属旧状态猜成乘员。
- 普通区域命令在准备和提交两次检查携带位移，纳入未在先攻的乘员到临时Headless快照，原子提交动作消耗、状态位置、forced moved事件、地图与空间关系事件。Activity relocate-granting-area同用规划器，返回carriedTargetIds和无OA路径；两处页面事件交接及通用同步器接收这些目标，避免地图动了而Headless未动。
- 声明校验/地图保存重载/合成模块导出安装保留字段。明确拒绝与自动锚定/跟随/生命周期平移组合；同高度支持，区域或地表高度变化拒绝，尚未实现垂直坠落。完整占格、边界、墙、落点、来源隔离及提交复查覆盖。
- 4文件99项首验通过（area-carry-20260929.txt）；追加边界并跑原生施法、已有跨回合/目标缩放移动归档，4文件227项通过（area-carry-final-20260929.txt，与前者重叠）。定向差异检查通过。完整typecheck99202运行（area-carry-types-20260929.txt）。
- 未把同高度机制认定为碧水球/旋风全部携带和生命周期完成，不修改来源review账本或旧自动草稿；主预检r19仍29/125/1，review r30、coverage r33、batch r16保持。容量/随机排出/垂直随地表/结束落地/沿途触发级联未完成。API0，真实房间未动，目标active。
- 初次完整typecheck99202明确exit0。随后代码审查发现手动追加forced moved事件的区域携带/排出/推离未清除既有自愿直线移动streak；统一调用recordDnd5eStraightMovement，防止继续满足冲锋距离。对应携带与三种豁免分支补断言；定向测试23793（area-carry-streak-final-20260929.txt）、最终类型检查5826（area-carry-types-final-20260929.txt）运行中。
- 最终类型检查5826明确exit0（area-carry-types-final-20260929.txt），34项定向测试23793退出0，差异检查通过（area-carry-streak-diff-20260929.txt）。所有进程结束。验收文档2026-09-29-area-carry.md记录同高度范围及剩余垂直/容量/生命周期缺口。API0，目标active。

## 2026-09-29：Activity 位移实际高度同步

- 延续携带提交核查发现共享同步器将未指定高度写成0尺，覆盖地图快照解析的地形高度；事件距离同样漏算真实垂直差。统一使用mapGeometryTokenElevation，moved事件写入前后绝对高度；既有所有参与者预检保留，缺失目标时不会部分写入。
- 新测试修复前4失败/1通过（activity-move-elevation-before-20260929.txt）；修复后携带/地图交互/直线距离/高度4文件99项通过（activity-move-elevation-after-20260929.txt）。跨回合/随机移动模块归档与移动攻击链3文件22项通过（activity-move-elevation-archive-20260929.txt）。定向差异检查通过。
- 完整typecheck31146运行中，日志activity-move-elevation-types-20260929.txt。未改转换草稿或来源认证账本，主预检r19及review r30保持。API0，真实房间未动，目标active；此批不代表区域垂直携带/坠落或碧水球全机制完成。
- 完整类型检查31146明确exit0。全部测试进程结束，121项本轮回归通过；未启动付费API批测。下一批继续区域容量、排出及生命周期机制，不能将本次高度同步修复计作这些机制的完成。

## 2026-09-29：容量规划与区域外落点范围

- 上轮为progress：Activity高度共享修复和121项回归完成。重新核对缓存碧水球:171:5，继续容量/排出机制，不修改旧自动配置。
- nearest-outside-area新增maximumOutsideDistanceFeet，按目标落点占格与区域格的最近距离限制；不是移动总距离上限。声明严格校验，拒绝push组合/非法值；源DC/归档安装/Activity保留。共享区域事务无合规落点时原子拒绝，不先写伤害、状态或回执。SDK及AI指南同步。
- 新persistentAreaCapacity确定性规划器：体型单位容量、既有目标去重、Host显式随机结果、固定候选顺序、无放回选择和等待随机结果的可恢复返回值。尚未接入实际触发事务，不暴露模块容量声明；保留新目标并排出现有目标直至满足容量的策略尚不能作为碧水球原文全部认证。下一步需有效实例占员筛选、Host随机协调、联合落点、状态来源移除、倒地与原子提交。
- 4文件128项通过（area-capacity-boundary-20260929.txt），完整typecheck38345运行（area-capacity-boundary-types-20260929.txt）。新验收文档2026-09-29-area-capacity-planning.md。原预检r19、review r30/coverage r33/batch r16保持，未升级来源完成度。API0，真实房间未动，目标active。
- 完整typecheck38345明确exit0，定向diff检查通过（area-capacity-boundary-diff-20260929.txt），全部验证进程结束。容量规划器仍未接入实际区域触发；下一批不能跳过Host随机值收集及精确状态移除的生命周期处理。

## 2026-09-29：容量 Host 随机协调与排出事务

- 上轮为progress：容量纯规划器与有界落点接口完成。本轮把capacity声明接入规范化/模块归档/Activity提案和实际区域事务，仅允许带restrained条件的触发器；声明必须明确random-existing-until-fits策略，不推断原文未说明的容量行为。
- 临时快照包含未参加实际先攻的地图生物，缺绑定角色资料则拒绝；容量占员依据当前有效的同来源/同实例束缚及区域相交。新增Host协调器按需索要1-based随机值，依事务/候选/已用结果前缀缓存，多个候选无放回，单候选不掷骰。页面初次结算与DM最终调整使用协调器，随机池不接受可选重掷特性。
- 在复制状态内联合规划排出，后续落点避开先前排出者；经统一效果移除生命周期入口，只移除指定实例效果，保护状态不强删，更新移动额度与后继效果。倒地使用标准入口保留免疫规则，写forced moved及前后高度并清除自愿直线streak。任何一步失败均返回原状态/空事件/无地图应用，不提交新束缚、先前排出或回执。
- 首验3文件48项通过（area-capacity-transaction-first-20260929.txt）。专项事务初验4通过/2失败：一处测试构造了无效linkedLifetime导致归一化丢弃保护，另一处比较受Date.now影响的效果时间戳；改为有效保护引用与固定测试时间，6项通过（area-capacity-transaction-final-20260929.txt）。区域/归属/携带/容量4文件101项通过（area-capacity-transaction-regression-20260929.txt，与专项重叠）。
- 首次类型检查6004退出1，仅新增测试的Token体型和blockedConditionIds推断过宽；补显式类型。追加非法capacity声明拒绝与模块归档2文件23项通过（area-capacity-transaction-final2-20260929.txt），最终typecheck25651运行（area-capacity-transaction-types-final-20260929.txt）。定向diff检查通过，仅CRLF提示。SDK、AI指南和验收文档已更新。
- 不把此明确的多次排出策略认作碧水球全部原文认证；未做原始PDF重转或双端浏览器验证。垂直排出/坠落、区域结束落地、熄火及沿途区域级联仍缺。预检r19、review r30/coverage r33/batch r16保持，API0，真实房间未动，目标active。
- 最终完整类型检查25651明确exit0（area-capacity-transaction-types-final-20260929.txt），全部验证进程结束。本轮Host容量事务已接入并有模块归档/行为证据，不升级来源条目全自动认证。API0，目标active。

## 2026-09-29：容量区域结束清理

- 上轮为progress：容量Host随机与排出事务已接入。本轮核查区域结束发现共享对账仅在有专注来源消失时清理，非专注容量束缚可能残留。
- 新reconcileDnd5eEndedAreaCaptives用明确删除前后快照识别结束的容量区域，按原始效果（含暂停）、来源与实例清理束缚，调用Headless统一移除入口保留生命周期处理。只回写实际改变的Token/角色；无明确删除证据及普通独立持续区域状态不动。
- 共享区域/专注对账在无专注关系时也执行容量清理，涵盖回合到期；DM手动删除在已有环境坠落事务前调用，合并清理事件，最终以当前原始角色资料做差异投影，避免预清理导致changedCharacterIds漏写。
- 初验88通过/2失败，失败为新增测试读取Token.conditions（实际持久化在activeEffects）；改为效果投影断言。区域/容量2文件90项通过（area-end-captives-final-20260929.txt）；已有删除/环境坠落/受保护效果3文件13项通过（area-end-captives-removal-20260929.txt）。定向diff检查通过，仅CRLF提示。完整typecheck58285运行（area-end-captives-types-20260929.txt）。
- 本批尚未覆盖无本地图Token的跨地图角色结束广播，其他删除入口需继续核查；不声称落地/摔倒/熄火等完整结束机制已实现。未重转原草稿或升级全书来源认证，预检r19、review r30/coverage r33/batch r16保持。API0，真实房间未动，目标active。
- 完整类型检查58285明确exit0（area-end-captives-types-20260929.txt），本轮103项测试全部通过，验证进程已结束。下一步继续结束入口与跨地图生命周期覆盖，不把局部结束清理计为全书自动化完成。

## 2026-09-29：共享删除入口补齐容量清理

- 上轮为progress：区域对账及页面DM删除释放容量束缚。本轮核查调用图确认法术实体击毁与阳炎爆移除区域直接调用removePersistentAreaByDm，会绕过页面清理；先修复这一真实入口缺口。
- 容量清理下移到共享删除函数，返回完整characters/events，同时保留原单caster字段。页面DM删除不重复清理，实体攻击处理全部受影响角色；阳炎爆合并角色差异和释放事件，传递已有Headless round。源Token也返回清理后版本，避免施法者被自身区域束缚时兼容字段与map不一致。
- 初验删除/实体/法术移除3文件24项通过（area-end-shared-removal-20260929.txt）；石墙/环境坠落2文件13项通过（area-end-shared-removal-regression-20260929.txt）。首typecheck77913退出1，仅新增实体测试漏必填invisible字段；补齐后增加源Token一致性测试，3文件25项通过（area-end-shared-removal-final-20260929.txt）。定向diff通过，仅CRLF提示。
- 最终完整typecheck14188运行（area-end-shared-removal-types-final-20260929.txt）。没有虚构跨地图位置或给离图角色创建真实Token；无本地图Token的角色/其他地图NPC结束同步仍待房间级处理。预检r19、review r30/coverage r33/batch r16保持，未重转或升级来源条目，API0，真实房间未动，目标active。
- 最终完整类型检查14188明确exit0（area-end-shared-removal-types-final-20260929.txt）。本轮最终38项回归通过，全部验证进程结束。共享删除入口容量清理已完成，跨地图与完整结束物理效果仍未完成，目标active。

## 2026-09-29：容量束缚来源地图生命周期

- 上轮为progress：共享删除入口清理已完成。本轮新增Host捕获的activeEffect.areaLifetime(mapId/areaId/sourceActorId)，只给实际施加成功的容量束缚写入，JSON归一化及校验保留；不要求转换配置伪造地图ID。
- 新reconcileDnd5eAreaCaptivesAcrossMaps接入现有房间召唤/关联生命周期协调器和DM页面触发条件。来源地图唯一已加载、原来源区域实例确实缺失才结束；未知/重复地图、来源不匹配、旧无元数据状态均不猜测。实际地图目标通过原Headless移除入口，离图角色无自定义afterEffectEnds时用既有角色效果移除与零时间投影清理，不创建虚构Token。
- 离图角色有自定义结束后效果时暂缓；真实Token出现后走Headless，验证束缚解除与后继动作/移动限制都保留。此限制未静默吞掉或标作完成；来源地图整个缺失/已删除仍不能与未加载混同，需要后续明确删除证据策略。
- 首验区域生命周期/容量2文件19项通过（area-lifetime-room-20260929.txt）；补换Token角色与离图后继效果测试后，生命周期/跨地图链接/来源死亡/效果归一化4文件66项通过（area-lifetime-room-final-20260929.txt，含重叠）。定向diff通过，仅CRLF提示。完整typecheck81907运行（area-lifetime-room-types-20260929.txt）。
- SDK已说明Host元数据与保守边界。原预检r19及review r30/coverage r33/batch r16不变，不将此机制当成完整碧水球或全书原始转换认证。API0、真实房间未动，目标active。
- 最终完整类型检查81907明确exit0（area-lifetime-room-types-20260929.txt，批次跨日结束）。所有验证进程终止；本批跨地图清理与重载证据完成，来源地图缺失的明确删除判定、离图自定义后继效果、落地/熄火及原始PDF全流程仍未完成，目标active。

## 2026-09-30：来源地图删除证据

- 上轮为progress：跨地图容量来源身份及房间对账完成。本轮确认地图删除原无持久证据，不能将缺失地图当作已删除。
- 新maps.deletedMapIds及共享normalizer，地图store版本21；removeMap仅在地图确实存在时记录，保存/加载/迁移/发布泵携带记录。HP与Token补丁冲突重试以服务端记录为准，玩家保存不使用自己的删除声明。
- 服务端单资源CAS和多资源事务在现有锁内从current.maps与incoming.maps差集派生删除记录，保留既有历史，不信任incoming单独声称的ID。旧客户端缺此字段也不会抹去记录；共享校验拒绝畸形字段。新shared/map-deletion-history.mjs为纯规则，CAS实文件测试验证持久化、未知声明忽略及陈旧修订拒绝。
- 跨地图生命周期接受deletedMapIds；仅来源地图缺失且有明确记录时解除，实际存在的同ID地图优先检查当前区域。DM房间对账不再依赖activeMap存在，最后一张地图删除后仍处理离图角色。来源地图无记录/重复仍不猜测，离图自定义afterEffectEnds仍保留等待真实Token。
- 主测试4文件94项通过（area-map-deletion-20260930.txt）；服务端CAS/状态边界/成员投影定向13项通过，163项未选择（area-map-deletion-server-20260930.txt）；客户端资源校验/快照顺序2文件21项通过（area-map-deletion-validation-20260930.txt）。合计128项，定向diff通过，仅CRLF提示。完整typecheck82875运行（area-map-deletion-types-20260930.txt）。
- 未重启真实服务、未改房间数据、API0；未运行多资源事务浏览器端到端认证，不将纯/单CAS证据扩大为全书完成。旧无历史删除、外部整份资源删除恢复、离图自定义后继效果及落地/熄火仍需后续工作。预检r19和review r30/coverage r33/batch r16不变，目标active。
- 首次typecheck82875退出1：发布泵泛型从读回对象推断deletedMapIds为必填属性，及新测试的conflict结果缺expectedRevision/currentRevision。补显式Pick泛型和完整冲突结果后，重跑定向测试57855（area-map-deletion-final-20260930.txt）及完整typecheck7044（area-map-deletion-types-final-20260930.txt）。未改变删除语义或放宽类型。
- 最终完整类型检查7044明确exit0；修正后61项定向测试通过（与前128项重叠），全部验证进程结束。来源地图正常删除的证据与持久化链路已补，仍非全书/双端完成。目标active，API0。

## 2026-09-30：范围目标可见性独立契约

- 核查全书范围诊断，确认看见落点与看见每个受影响生物不能混用。新增area target.requiresVisibleTargets布尔字段；地图临时Host快照含非先攻生物，在maximumTargets之前用统一感知筛选。未声明时保持普通范围效果可影响不可见目标。
- Registered与compiled两条Host入口按实际choice/cast-level目标契约复核，失去可见性整次拒绝且不消耗。event-target自动触发也使用该字段，保留旧requiresLineOfSight触发语义。SDK与AI转换指南同步。
- 专项5测试含地图隐形/目盲/识破隐形/目标上限、非法声明、三种目标契约的模块导出安装与双入口。初始3个归档用例漏旧入口targetCell及顶层areaPlacement，修正调用形状后全部通过。新增2个事件范围用例通过；旧地图74项通过，旧Host48项中2项在合跑中超过5秒，单独20秒上限复跑2通过/48未选择（area-visible-targets-timeout-recheck-20260930.txt）。合并不重复行为证据129项，不声称全库回归通过。
- 首typecheck16968退出1，仅新测试JSON payload含undefined；改为无choice时空对象，5项专项复跑通过（area-visible-targets-confirmed-20260930.txt），最终typecheck43083运行（area-visible-targets-types-final-20260930.txt）。运行时没有因测试失败放宽边界。
- 精确核对缓存神圣武器来源并新增review r31，仅关闭逐目标可见性一条机制诊断，仍behaviorVerified=false且需重生成。coverage r34为149 reviewed/795 unreviewed links/115 expressible；batch r17 unresolved829。预检r19仍29可进入行为验收、125阻塞、1不可解析；没有重转/升级整条来源认证。
- API0、真实5273/5274未改、未运行双端浏览器认证；持续区域后续触发不自动继承施放时可见性，全书与来源完整行为仍未完成。目标active。
- 最终完整typecheck43083明确exit0（area-visible-targets-types-final-20260930.txt）；定向diff检查通过，仅CRLF提示。所有本轮验证进程结束，目标继续active。

## 2026-09-30：模式与升环后的目标契约一致性

- 上轮实际补齐可见性，判定为progress。本轮核查范围任选目标的前置链路，确认命令边界使用base target而执行器使用effective target；先修复这个共享错误，不新增未贯通的选择字段。
- Command按与执行器相同的scale-then-choice顺序判断area与creature，placement及Host成员相等校验使用实际契约；传输上限可接受Host明确提供的无上限区域成员数，执行器继续限制声明的maximumTargets/count。Host数据无法解析缩放时返回invalid-command。
- Registered authority的目标间距离矩阵及来源相关状态免疫也改为effective target，避免mode/cast-level里的限制与排除条件被遗漏。
- 新目标命令10项、旧命令5项、可见性归档5项共20通过（effective-target-regression-20260930.txt）；免疫6情况×3契约形态18通过/44未选择（effective-target-immunity-20260930.txt），合计38项。完整typecheck42967运行（effective-target-types-20260930.txt），运行期间冻结TS。
- 继续追踪发现pluginSpellTransaction的实际导入法术目标收集独立于通用地图选择器，上一轮requiresVisibleTargets尚未在该收集阶段筛选；最终Host虽会拒绝不可见目标，但需补收集入口避免整次误拒绝。这是下一步已确认问题，不把前轮合成/归档证据扩大为玩家完整施法路径已完成。
- API0、真实房间未改，review r31/coverage r34/batch r17保持，原始来源重生成及全书完整认证仍未完成，目标active。
- 完整typecheck42967明确exit0后补入pluginSpellTransaction的Host感知筛选，在maximumTargets前处理可见性。导入JSON法术×三种关系×三种感知9项事务测试通过，并断言HP及法术位扣除（imported-area-perception-final-20260930.txt；130项未选择），本批行为总计47项。
- 全书155来源与既有未人工修改自动草稿离线复检r20已通过（fullbook-preflight-r20-20260930.txt），仍29可进入行为验收/125阻塞/1不可解析，API0。最终完整类型检查30342运行（effective-target-types-final-20260930.txt），检查期间TS保持冻结。
- 最终完整typecheck30342明确exit0，定向diff检查通过。本轮所有验证进程结束。47项相关行为测试及155来源离线预检有证据，未声称全库/浏览器/全书认证完成。下一步范围内任选目标尚未实现，目标保持active。

## 2026-09-30：范围内显式选择目标

- 上轮有目标契约/真实施放入口修复，判定progress。本轮新增area selection:choose-any与minimumTargets（默认0）；maximumTargets仅限制最终选择，不提前截断候选。
- Command区分普通区域的完整名单与choose-any子集；唯一性/合法成员/上下限由Host校验。导入法术与特性地图入口先复算几何及感知，再接受明确targetTokenIds；缺字段拒绝，空数组与取消分开。空数组不伪造施法者为目标，但可消耗施法位/动作。
- 玩家法术确认与特性落点加入多选对话框，法术有选择时关闭自动提交；事件范围通过对应玩家/DM的共享选择窗口切换目标并确认，原始Host候选传入命令边界，只有选中项进入骰池与效果。现有choose-one保持。特性入口同时补effective choices目标投影与可见性。
- 编辑器与AI指南支持新声明；来源约束拒绝把明确“所有生物”的瞬发区域误转成choose-any。没有手改自动草稿或调用转换API。
- 初验15通过（area-subset-first-20260930.txt）；共享4文件48通过（area-subset-shared-20260930.txt）；契约/来源/选择3文件104通过（area-subset-contract-20260930.txt，含重叠）。事件初验1项5秒超时，且审查发现it.each展开数组参数未准确测试数组选择；改为具名案例，6项全部通过（area-subset-trigger-final-20260930.txt），选择器数组案例同步修正并通过。
- 特性真实地图入口4项通过，特性全文件与最终验证器2文件132通过（area-subset-feature-regression-20260930.txt）。按文件去重的最终相关行为证据205项；不声称全仓回归或浏览器验证。完整typecheck68379运行（area-subset-types-20260930.txt），TS保持冻结；定向diff通过，仅CRLF提示。
- 来源完整转换、刷新后的双端交互与全书认证尚未完成。review r31/coverage r34/batch r17不升级；预检最新r20仍29 ready/125 blocked/1不可解析。API0，真实5273/5274未改，目标active。
- 首次typecheck68379退出1：选择器已知string[]在类型谓词失败分支被收窄为never，导致filter报错。把保留界面选择的计算移到谓词前，未改变校验语义；8项选择器测试重新通过（area-subset-chooser-final-20260930.txt）。最终typecheck12377运行（area-subset-types-final-20260930.txt），检查期间冻结TS。
- 全书现有自动草稿离线预检r21通过（fullbook-preflight-r21-20260930.txt），仍29可进入行为测试/125阻塞/1不可解析。精确核对癫狂巫咒原文后，review r32只将“任选周边目标”诊断记为部分补齐，保留诅咒归属/必受伤主目标/主动附赠动作等来源证据缺口。coverage r35为150 reviewed、794 unreviewed links、29 partial、115 expressible；batch r18 unresolved829不变。没有提高整项认证。
- 最终完整typecheck12377明确exit0（area-subset-types-final-20260930.txt）。本轮全部验证进程结束；205项不重复相关行为测试、155来源离线预检和定向diff通过。浏览器双端与来源整项认证仍未完成，API0，目标active。

## 2026-09-30：特性范围遮挡入口一致性

- 用户要求继续。核查上一轮任选目标链路发现：通用Activity地图选择器应用遮挡，而pluginFeatureAction只检查平面范围/高度，可能收集墙后生物。本轮补共享遮挡计算，在maximumTargets及任选子集校验前过滤，并将持续区域targetCells设置为遮挡后格子。仅Activity路径生效；显式requiresLineOfEffect:false及已有核心法术绕角绑定保留。
- 特性任选目标UI与共享地图选择器候选取交集，非法落点先提示，不再把已知墙后生物作为可选项提交。Host仍复算，不信任UI。
- 怪物授予区域控制验证普通/任选两类，各覆盖实体墙、非阻挡墙、显式穿墙，比较预览/Host目标与格子、结算HP/附赠动作及输入不变，并拒绝墙后指定目标。玩家特性增加墙后拒绝、近侧正确结算。
- 初验45通过；最终完整特性/怪物区域/地图交互3文件121通过（feature-area-obstruction-final-20260930.txt）。定向diff通过，仅CRLF提示。完整typecheck52115运行（feature-area-obstruction-types-20260930.txt），冻结TS等终态。
- 原始自动草稿、review及预检不改：r21仍29可行为验收/125阻塞/1不可解析。API0、真实房间未动、无浏览器双端认证。目标active，不把新增局部机制证据算为全书完成。
- 完整typecheck52115明确exit0（feature-area-obstruction-types-20260930.txt）；最终121项测试通过，全部验证进程结束。目标继续active，来源完整认证与双端浏览器验证尚未完成。

## 2026-09-30：来源归属与效果备选资格

- 上轮特性范围遮挡修复及121项回归属于progress。本轮精确读取癫狂巫咒来源的诅咒资格诊断，新增通用active-effect.anyOf：指定效果ID或同一效果的全部语义tags组成备选，source:self要求同一效果的Host来源actorId匹配当前使用者；不能跨效果拼标签/归属。与旧单effectId互斥，旧声明兼容。
- 新备选匹配排除暂停效果。Registered/compiled/核心Host快照增加suspended投影；严格验证空/畸形/超限/未知字段及重复标签。具名备选只匹配完整ID或冒号后缀，不接受中间子串。SDK及AI指南声明来源效果必须真正具备标签，不能凭名称推断、不能以该谓词代替主目标区域流程。
- 新专项31测试覆盖14种效果组合、正反谓词、actor/target及any/self来源、15种非法声明。原初验30过1失败为测试读取拒绝结果中不存在的state，修正为检查输入不变及仅在有返回状态时检查资源。执行器/验证器/专项195通过（effect-selectors-regression-20260930.txt）；最终专项加两条Host既有回归158通过（effect-selectors-host-20260930.txt），其中专项增加真实地图授予特性准备/结算并断言伤害与附赠动作。两组去重共322通过。
- 完整typecheck28047运行（effect-selectors-types-20260930.txt），冻结TS。定向diff通过，仅CRLF提示。API0、真实房间未动、未运行浏览器验证。
- review r33只将来源资格诊断记为部分解决：效果筛选接口有证据，但hex/邪术师诅咒来源定义和跨模块依赖仍需整合；主目标锚定、必受伤主目标及任选周边仍独立待办。coverage r36：151 reviewed/793 unreviewed links/30 partial/115 expressible；batch r19 unresolved829保持。没有把合成模块测试升级为原始来源认证。离线全书预检r22运行，目标active。
- 离线全书预检r22通过（fullbook-preflight-r22-20260930.txt），155来源仍29 ready/125 blocked/1不可解析。首typecheck28047明确exit1，仅新测试combatant夹具漏必填position；补合法位置后专项重跑93413（effect-selectors-final-20260930.txt）、完整typecheck53257（effect-selectors-types-final-20260930.txt）。运行逻辑未改，TS再次冻结。
- 最终完整typecheck53257明确exit0；修正夹具后的31项专项再通过，全部验证进程终态。去重322项相关行为证据、155来源离线预检r22已完成。全书预检就绪29/155=18.7%，仅表示预检阶段，不是全书认证完成率。本机制批次完成，目标继续active。

## 2026-09-30：主目标与任选周边的执行衔接

- 上轮来源效果备选接口及322项测试属于progress。本轮复用event-target+choose-any窗口连接主目标必受伤与周边任选，发现普通activity-resolved缺Host执行ID、compiled入口不发完成事件，均已修复。事件与grant同源，改变投递批次ID不改变执行身份。
- 完成窗口清理从临时HP扩展到feature-used/spell-resolved/item-used/action-resolved，要求单事件、执行绑定及single-use；仅清理本次actor/原目标的匹配授权，其他执行和附带普通持续动作的效果保留。spell-cast与同源Activity完成只生成一次resolved窗口。
- 触发发现里的actor效果资格原先重复旧单ID判断，改用统一谓词；抽取同源效果匹配给执行及继承施法等级共用。执行绑定后续只读精确grant等级，不从其他同时存在的高环授权取最大值。
- 合成模块导出重装覆盖两入口、主目标固定魅力伤害最低1、主目标死亡、不可见周边、墙阻挡、选0/取消/非法名单、JSON重载、重放、旧事件及并存授权；增加4种完成事件actor/target清理、施法窗口去重和等级继承。
- 首验发现两个夹具问题（空效果列表可能省略，compiled旧参数需distanceFeet）及真正的compiled缺完成事件；修复后早期两归档文件7项通过。扩大4文件202项通过（primary-neighbors-regression-20260930.txt）；实际特性/法术入口及原即时授权3文件187通过4失败（primary-neighbors-facade-20260930.txt）。4失败单独复现同样失败，诊断报告primary-neighbors-gates.jsonl确认净化食粮/穿墙术/敲击术/秘法锁有处理器，但现有pluginMechanicsRegistry地图写入边界判assisted，施放准备返回spell-not-headless；未放宽或改测试隐藏该限制。
- 首typecheck49390退出1：readonly结果events不可push、新测试完成事件枚举推断string；改用context的可变事件数组并标注Activity类型。补齐零HP仍死亡豁免生物的事件范围资格，保留死亡/零HP无死亡豁免目标排除。最终78项子集回归42342（primary-neighbors-final-20260930.txt）与完整typecheck36551（primary-neighbors-types-final-20260930.txt）运行，TS冻结。
- API0、未修改真实房间/未运行浏览器认证；人工合成机制测试不是来源自动转换通过。原始草稿保持，目标active。
- 最终子集78项中77通过1失败：compiled对不规范的手写unconscious条件列表做效果投影时清除了该孤立条件，输入不变断言失败；同次typecheck36551退出1也指出条件列表readonly不可push。将夹具改为不可变条件列表并创建匹配的unconscious ActiveEffect，不改变运行逻辑。专项85883（primary-neighbors-confirmed-20260930.txt）和完整typecheck6318（primary-neighbors-types-confirmed-20260930.txt）复查，冻结TS。4个既有地图写入门槛失败仍保留。
- 最终10项专项85883通过，完整typecheck6318明确exit0，定向diff通过。所有验证进程已终止。全书离线预检r23通过，仍29/155预检就绪（18.7%）/125阻塞/1不可解析。389项不同相关测试通过，4项地图写入边界失败保留。review r34仅把主目标+周边选择的精确诊断从partial改为expressible，来源诅咒依赖仍partial，未升级整条自动转换认证。API0，目标active。

## 2026-09-30：地图食物饮料净化写入

- 接通已有 purify-map-consumables 处理器与地图提交，补魔法物品排除、当前墙体遮挡、占格和高度检查。仅恢复有 Host 类型数据的食物饮料净化；门锁、光源、物体附魔和屏障抑制仍受旧门槛限制。同步能力分析及 SDK。
- 地图处理与能力注册 87 项通过；原净化食粮背包施放回归 1 项通过，145 项无关测试跳过。以前记录的四个地图门槛失败中此项已修复，另三项未改或重认证。完整 typecheck 16897 exit0。
- 新测试覆盖魔法/高处/范围外/墙后/生物/无类型目标排除、选择后新增墙体、只清除指定污染、JSON 重载及重放幂等、缺少落点和后续操作失败不修改输入。详见 2026-09-30-map-consumables.md。
- r24 预检初次因报告参数误用绝对路径被文件名校验拒绝，修正为文件名后通过（74405）。仍 29/155 就绪（18.7%）、125 阻塞、1 不可解析。合成机制证据不等于来源认证或浏览器同步认证。API0、真实房间未改；目标 active。

## 2026-09-30：近战目标借机攻击限制

- 上轮地图净化修复属于 progress。本轮读取风流剑客原始缓存，发现已有能力标记只记录近战武器目标，直接 Host 借机攻击未检查该名单，地图入口只检查旧式静态特性。现改为统一角色能力投影，最终结算检查指定目标且只限其当前回合，覆盖借机法术替代；独立报复不受影响。仅本回合近战武器攻击记录名单，结束回合立即清除。
- 合成导出重装验证永久 character-capability Effect、角色投影、地图发现与准备。Host 验证命中/未命中、多个目标、其他目标仍能借机、JSON 重载、回合结束、非本回合攻击不授予保护、拒绝不耗反应/HP及报复。
- 首验 32 通过 2 失败因报复夹具遗漏距离，补明确 5 尺 Host 关系后四文件 36 通过。补充 Activity 战斗 E2E 68 通过（20356 exit0）；命令中不存在的 War Caster 文件不计证据。共 104 项不同测试通过。完整 typecheck 80902 exit0，定向 diff 检查通过。
- 明确保留 dedicated 徒手及近战法术攻击记录缺口；review r35 将精确诊断记 partial，不认证全子职。coverage r39：152 reviewed、792 unreviewed links、30 partial、116 expressible；batch r22 unresolved828。原始草稿/预检未变，r24 仍 29/155（18.7%）。API0、真实房间未动，目标 active。

## 2026-09-30：徒手与近战法术目标记录

- 上批属于 progress，本批补齐其明确记录的执行入口缺口。共享 Host 记录函数覆盖原生 melee/unarmed 事件与已注册原生法术 delivery；Activity 检定结果携带声明 delivery，registered/compiled 都调用共享函数，删除旧武器入口重复记录。只在来源本回合、明确 melee 时生效。
- 原生测试覆盖电爪、火焰箭、普通徒手、疾风连击重复目标及第二攻击非法导致整笔回滚；合成导出重装分别验证 melee/ranged 的 registered/compiled 路径。初验错误为夹具敌我关系、模块缺少 count/outcomes/legacySource、编译骰池缺 modifier/total；修正后四文件 103 通过，补充战斗 E2E/next-d20 两文件 85 通过，共 188 项。
- 完整 typecheck 61206 exit0，补充回归 27322 exit0；全部验证进程已结束，定向 diff 通过。SDK及专项报告更新。review r36 保留 partial：执行入口缺口已补，完整子职等级授权与原始自动配置尚未认证；coverage r40 计数不变。r24 原始预检仍 29/155（18.7%），未重新生成草稿。API0、真实房间未动，目标 active。

## 2026-09-30：子职永久能力等级授予往返验收

- 上批近战入口修复属于 progress。本批新增合成子职模块导出/重导出/安装测试，子职 level3 build-grant 授予独立 character-capability 特性，特性另有 rogue3 资格。通过正式升级接口选择子职，JSON 重载后无需显式 featureIds 即能投影并执行徒手攻击保护。
- 验证低等级、总等级10但 rogue2、rogue3未选子职、已授予角色降至 rogue2 均不能获得能力。首验缺少夹具原有 Expertise 选项而返回 missing-class-choice；补齐合法2级角色后，归档/升级/近战三文件24项通过。没有修改原始自动草稿或生产代码。
- 完整 typecheck42277 exit0（subclass-footwork-types-20260930.txt），定向diff通过。review r37仅将精确梦幻舞步诊断升级为expressible，behaviorVerified仍false、配置仍待批量重转；不认证风流剑客其他能力。coverage r41：117 expressible、29 partial；batch r23 unresolved827，机制/证据489。
- r24原始预检仍29/155（18.7%），本批API0、真实房间未动。整书目标active，下一批继续尚未审阅的目标关联增伤/重击及移动触发等共享机制。

## 2026-09-30：目标关联增伤/重击执行面审计

- 上轮等级授予验证属于 progress。本轮确认咒剑精确诊断并非单纯旧模型误判：Activity 只有检定级 criticalThreshold，目标关联效果现有通道没有来源限定的重击阈值；武器附魔/on-hit伤害也不能替代所有合格伤害骰的目标关联加值。
- 新增并执行 TypeScript AST 审计脚本，先定位16个引擎结果调用和2个Activity阈值读取；随后发现准备阶段也有阈值消费，扩大扫描至武器/怪物/借机/多重攻击/Activity骰池，结果19处结果调用、2处Activity读取、10处准备读取。每项保留真实函数、行号、参数表达式，避免仅改最终Host导致普通骰池与重击结算不符。
- 脚本运行及node --check通过，证据attack-outcome-entrypoints-20260930-r2.json。专项报告列明重定向重算、同源效果生命周期及伤害骰来源关联所需整体批次。不将调用清单当行为测试；本批未改运行时、未提高认证级别或完成数。
- review r37/coverage r41/batch r23仍有效；原始预检29/155（18.7%），API0，真实房间未动。目标active，下一步按此次确认的调用面实施统一来源/目标修正，而不是只改普通武器。

## 2026-09-30：扩展重击判定统一前置修复

- 上批AST审计提供了实际调用面证据，属于progress。本轮接线发现原生与Activity扩展重击语义不同。最初误将原生“扩展范围仍需命中AC”视为正确并做了本地修改；随后核对2014勇士原文及设计者解释，纠正判断：扩展范围骰值应命中；“命中后自动重击”仍需先命中。最终实现和测试均使用核实后的规则，详见critical-outcome-parity报告引用。
- 抽取共享resolveDnd5eAttackRollOutcome供原生包装、Activity执行与提交骰值命中预判使用；保留天然1和完全掩护检查，Activity重击成功要求实际命中，预判改用对应delivery的AC。旧Champion高AC测试明确按来源更正并提供双倍骰数，不以更改测试隐藏失败。
- 最终7文件235通过，原生定向8通过300跳过，共243项不同测试通过。完整typecheck77141 exit0，定向diff通过，验证进程全部结束。
- 目标关联重击Effect及伤害骰加值本身尚未实现，本批为其必要前置修复，不提升该诊断或原始配置认证。review r37/coverage r41/batch r23保留，原始预检29/155（18.7%），API0、真实房间未动，目标active。

## 2026-09-30：来源与目标绑定的重击范围

- 新增公共 Effect modifier `attacks-by-source-critical-threshold`，补齐声明校验、能力注册、Host 效果投影、状态序列化和严格校验。实际防御者上的效果只对其 source.actorId 生效；其他攻击者、暂停或移除效果不享受，多个阈值取最低值。
- 原生结算、两个 Activity snapshot、注册/编译模块的重击伤害骰准备、玩家端武器/怪物/法术入口统一接入。集成测试发现 Host 构造器会丢掉新字段，已补齐。进一步检查发现地图页独立的天然20判断会漏骰19重击，连同护盾等 AC 重算一起更正；天然骰元数据不改变，空格误击仍失败。
- 合成模块导出/导入后施加标记并通过两种模块入口完成19重击、双倍骰结算；外国来源/移除/暂停、原生法术和怪物预览等通过。8文件244项加法术预览6项，共250项不同测试通过。最终完整typecheck14527 exit0，定向diff通过，所有验证进程结束。详见2026-09-30-target-critical-effects.md。
- 咒剑诊断仅重击部分已补齐，目标关联伤害骰加值仍需实现；不把整项诊断或原始子职配置标为完成。review r37/coverage r41/batch r23保留。原始预检29/155（18.7%），本批API0、真实5273/5274房间未动。目标仍active。

## 2026-09-30：模块伤害骰来源贯穿 Host

- 上一批来源/目标重击实现属于progress。本批为目标关联伤害加值补齐实际骰值来源：公式求值器在校验后记录使用的骰数、提交骰数、原始值和变换后的值，避免把未使用的重击扩展骰当成本次骰值。
- damage proposal及注册/编译Host提交保留Activity、操作、目标、归属来源、执行者及原法术环位；固定伤害无骰证据，掷骰后算为0仍保留，范围共享池及重复引用可识别，诅咒术额外骰单独标识。战斗记录区分伤害骰合计与实际HP伤害，SDK说明不能按事件/骰子/公式节点直接重复发放增伤。
- 六文件最终147项不同测试通过（首轮146通过+新日志断言失败；修正漏写的现有未命名规则项展示包装后日志45项通过）。完整typecheck88963 exit0，之后仅修正日志断言字符串。定向diff通过，所有验证进程终止。详见2026-09-30-damage-roll-provenance.md。
- 尚未开放通用目标关联伤害加值：需继续对原生武器/法术/持续伤害保留资格与分组，并统一豁免/抗性之前的加值位置。未改原始草稿，review r37/coverage r41/batch r23保持；原始预检29/155（18.7%），API0、真实房间未动，整书目标active。

## 2026-09-30：模块伤害骰边界及来源加值

- 上批伤害骰来源记录属于progress。本批新增显式damage-roll公式边界：加值在内部骰值之后、外部豁免减半之前计算；重击只增加骰子。同一次结算同目标同来源类别同组ID只加一次，嵌套边界不重复加值，固定数值/零颗骰子不触发，新的结算重置领取记录。
- 新增damage-rolls-by-source-bonus目标Effect，贯通公式声明、投影、Host构造及严格状态往返。来源匹配实际伤害归属，授权伤害不会借用执行者的来源身份；注册与编译Activity都从Host状态提供回调，客户端命令无法注入回调或已领取集合。
- 合成导出模块同时验证19重击及+2固定增伤，两条入口3+4+2=9；另测先增伤再减半、重复引用、嵌套、固定伤害、外来源/暂停/移除、授权归属。6个实际发现文件198项通过；命令中另列的Scaling.test.ts不存在，不计其覆盖。完整typecheck94374 exit0，定向diff通过，验证进程全结束。详见2026-09-30-target-damage-boundaries.md。
- 原生武器/法术/持续伤害及未加边界的旧公式仍待接入，故未注册为全支持，能力分析维持assisted。未修改原始配置或重转，review r37/coverage r41/batch r23不变；原始预检29/155（18.7%），API0，真实房间未动，整书目标active。

## 2026-09-30：原生武器与借机攻击目标增伤

- 上批模块边界实现属于progress。本批将目标来源加值接入普通原生武器和借机攻击公共结算，在主武器、命中追加、职业及物品伤害组件间按组仅领取一次；固定伤害不产生资格。Host命中Activity及反应重放保留实际消耗骰子的标记，物品组件资格来自校验后的骰数。
- 加值先进入原始骰池，再进行归零、缩小术武器减伤、伤害减值、倍率及防御；重击不翻倍固定加值。替换原武器伤害时保留真正追加骰的资格。新增来源/目标/类型/数值审计事件及日志。
- 初始固定主伤害测试没有进入真实命中checkpoint，改用已存在的主伤害替换路径验证，没有放宽入口。最后6文件166项加导出命中Activity18个不同场景，共184项通过。完整typecheck5576 exit0，定向diff通过，全部验证进程结束。详见2026-09-30-native-weapon-target-bonus.md。
- 专用重定向、怪物、原生法术及持续伤害路径仍待实现，不提升整项来源认证或注册full。原始预检29/155（18.7%），review r37/coverage r41/batch r23保持，API0，真实房间未动，整书目标active。

## 2026-09-30：通用ActiveEffect持续伤害目标增伤

- 上批原生武器接入属于progress。本批在ActiveEffect periodicDamage公共结算中把实际来源的目标加值放入伤害骰固定修正，先加值归零、再豁免、再抗性/易伤。修复此处原先防御早于豁免的顺序；7+2豁免减半后易伤现在为8而非9。
- 来源/目标回合开始及目标回合结束共用实现。分别验证两项持续伤害独立加值、JSON重载后的同回合重放不重复结算、暂停/移除/不同或缺失来源无加值、负修正及非法骰回滚。5文件67项通过；完整typecheck5337 exit0、定向diff通过，全部验证进程结束。详见2026-09-30-periodic-target-bonus.md。
- 独立旧式延迟法术、持续区域和怪物特定伤害不视为本公共入口覆盖，其他原生法术/特殊路径继续实现，full支持注册仍保留。原始预检29/155（18.7%），review r37/coverage r41/batch r23不变，API0、真实房间未动，整书目标active。

## 2026-09-30：原生法术攻击目标伤害加值

- 单目标和独立多次攻击的伤害骰接入来源限定目标加值；在归零、恶毒嘲讽减伤、伤害乘数和防御之前加入，重击只翻倍骰子。各射线分别领取，未标记目标不受影响。半伤未命中分支在减半之前加入，不覆盖普通未命中或之后的旧式延迟伤害。
- 新增13项集成测试，覆盖命中、重击、抗性/易伤/免疫、来源隔离、暂停/移除、非法骰、混合目标射线、后续射线失败整次回滚及强酸箭半伤。首轮混合目标用例缺targetIds而被正确拒绝，补齐后明确断言invalid-dice，避免回滚测试假通过。4文件64项通过；完整typecheck80079 exit0，定向diff通过，全部验证进程结束。详见2026-09-30-native-spell-target-bonus.md。
- 共享豁免/自动伤害池、特殊转移攻击、怪物路径、持续区域和旧式延迟伤害仍待接入；full注册仍保留。原始预检29/155（18.7%），review r37/coverage r41/batch r23不变，API0，真实房间未动，整书目标active。

## 2026-09-30：原生共享豁免伤害池目标加值

- 上轮原生攻击集成属于progress。本轮原生cast-spell豁免分支一次验证共享主/附加骰池，一次消耗恶毒嘲讽，再为每个目标独立派生伤害分量。目标来源增伤只加入首个有骰分量，在归零、共享减伤、豁免和抗性之前处理，避免未标记目标加伤和多类型重复加值。单目标共用此路径。
- 枯萎术植物最大伤害移入目标派生阶段、位于减伤之前，避免原总值覆盖绕过恶毒嘲讽；骰值证据与最大伤害一致。原有植物及免疫回归通过。
- 新增6项范围/单目标豁免、易伤/抗性、多伤害类型及反应一次消耗用例。3文件353项通过；完整typecheck90225 exit0，定向diff通过，所有验证进程结束。详见2026-09-30-shared-save-target-bonus.md。
- 自动伤害/飞弹共享池、怪物、持续区域、特殊转移、旧式延迟仍待接入，full注册保留；原始预检29/155（18.7%），review r37/coverage r41/batch r23不变，API0、真实房间未动，整书目标active。

## 2026-09-30：自动伤害和玩家/怪物魔法飞弹来源加值

- 上轮共享豁免池属于progress。本轮原生自动伤害共用目标派生骰池，灼热金属首次及后续附赠动作伤害均在防御前加入来源限定加值，重复施放不再次扣法术位。
- 玩家及怪物core魔法飞弹各自逐枚骰池接入目标加值；护盾/有限魔法免疫跳过加值，逐枚抗性与原有首枚职业加值保留。新增optional targetBonus日志证据，与featureBonus分开，零值省略以保留原事件形状。
- 新测试覆盖两端普通/抗性/护盾/非法骰回滚和持续灼烧资源；首轮定向115通过，核心307通过+1旧事件严格断言失败，修复零值字段后最终5文件423通过。typecheck61722、修复后55289均exit0，定向diff通过，全部验证进程结束。详见2026-09-30-automatic-target-bonus.md。
- 其他怪物伤害、持续区域、特殊转移和旧式延迟仍待接入，full注册仍保留。原始预检29/155（18.7%），review r37/coverage r41/batch r23不变，API0、未改原始配置与真实房间，整书目标active。

## 2026-09-30：怪物核心施法与武器伤害来源加值

- 上轮自动伤害集成属于progress。本轮怪物core法术攻击在原始骰池内加入目标来源加值，范围豁免逐目标派生，不改共享骰池；普通怪物武器攻击在主伤害、额外暴击和特征分量的首个有骰分量领取一次，固定分量不领取，暴击不翻倍加值。
- 新增13项怪物火焰箭、火球、哥布林弯刀和红龙双类型啮咬测试，覆盖重击、抗性/易伤、外来源、非法骰及回滚。修正测试的阵营及火球目标间距离，保留Host校验。4文件434项通过，完整typecheck60082 exit0，定向diff通过，全部验证进程结束。详见2026-09-30-monster-source-bonus.md。
- 独立怪物区域/死亡/巢穴/特殊动作、附带豁免伤害、持续区域及旧式延迟仍待接入，full注册仍保留。原始预检29/155（18.7%），review r37/coverage r41/batch r23不变，API0、未改原始配置与真实房间，整书目标active。

## 2026-09-30：怪物区域伤害池来源加值

- 上轮怪物核心施法/武器属于progress。本轮共同区域入口保留未归零的原始分量，每个目标独立派生，首个有骰分量领取一次；按选择单独掷骰的区域保持独立池，海怪重复选同一目标仍各自结算。
- 调整为先对合计伤害豁免减半，再按原分量分配并处理防御，修复奇数易伤顺序和多类型分别取整漏1点；Bulette旧用例改为合计池减半。新黑龙吐息/海怪用例覆盖豁免、抗性/易伤、来源隔离、非法骰回滚和资源消耗。
- 最终5文件813项通过，含424个区域目录分支；完整typecheck97999 exit0，定向diff通过，全部验证进程结束。详见2026-09-30-monster-area-target-bonus.md。
- 独立死亡/巢穴/特殊动作/附带豁免、持续区域及旧式延迟仍待接入，full注册仍保留。原始预检29/155（18.7%），review r37/coverage r41/batch r23不变，API0、原始配置及真实房间未动，整书目标active。

## 2026-09-30：死亡爆发与龙裔吐息来源加值

- 上轮怪物区域属于progress。本轮死亡爆发保留原始骰总值，使用快照中的死亡来源判定加值，归零后先豁免再防御；龙裔吐息同样逐目标派生。暂停/移除/其他来源不适用，死亡快照结算后重载重放拒绝。
- 只读核实巢穴旧接口接受DM裁定最终effects，无原始骰池，故不二次增伤，也不据此宣称巢穴全自动掷骰。
- 新增5项死亡来源与回滚/重放、2项龙裔共享目标/豁免/易伤/资源用例。4文件118项通过，完整typecheck47007 exit0，定向diff通过，所有验证进程结束。详见2026-09-30-death-racial-source-bonus.md。
- 独立特殊/附带豁免伤害、持续区域和旧式延迟继续审计接入，full注册保留。原始预检29/155（18.7%），review r37/coverage r41/batch r23不变，API0、原始配置及真实房间未动，整书目标active。

## 2026-09-30：持续区域来源增伤与延迟路径核实

- 上轮死亡/种族吐息属于progress。本轮区域公共触发器在实际伤害骰修正中加入目标来源加值，再归零、豁免、防御和DM调整；保留workshop公式、强化塑能及最大骰额外骰逻辑，日志记录含加值修正。固定伤害和治疗不触发。
- 新增14项四时点、来源隔离、负修正、抗性/易伤、非法骰回滚和治疗排除测试；最终6文件448通过，完整typecheck7043 exit0，定向diff通过，全部进程结束。详见2026-09-30-persistent-area-target-bonus.md。触发资格和重放去重仍由调用协调器负责，本批不据此宣称传输层重放已验。
- 普通强酸箭延迟骰已走periodic公共入口；旧potency及目前最大化延迟分支无显式骰来源，仍需区分补齐，未擅自二次加值。独立特殊/附带豁免伤害继续审计，full注册保留。原始预检29/155（18.7%），review r37/coverage r41/batch r23不变，API0、原始配置及真实房间未动，整书目标active。

## 2026-09-30：最大化延迟伤害骰来源记录

- 上轮持续区域属于progress。本轮新最大化强酸箭效果保留maximizedDamageRoll骰信息及旧potency基础值，构造/归一化/严格校验/战斗克隆贯通，要求骰规格有界且与基础最大值一致，非法记录不降级为旧效果。
- 延迟边界按实际来源及当前标记重新计算加值，再归零和防御；旧potency-only保持原值不猜测历史骰来源。普通新延迟效果继续使用periodic公共接口；metadata本身不是任意效果的调度能力。
- 新增6项完整Overchannel施法到重载/回合结束/下一轮流程及1项严格往返拒绝用例；首轮fixture遗漏class-specific子职业映射，补齐真实结构后通过，未放宽权限。4文件278项通过，完整typecheck15261 exit0，定向diff通过，全部验证进程结束。详见2026-09-30-maximized-delayed-damage.md。
- 独立特殊/附带豁免等伤害入口仍待审计，full注册保留。原始预检29/155（18.7%），review r37/coverage r41/batch r23不变，API0、原始AI配置及真实房间未动，整书目标active。

## 2026-09-30：转移攻击及武僧附赠攻击来源加值

- 上轮最大化延迟记录属于progress。本轮Stand Against the Tide重击以原攻击者为来源，不能借猎人来源标记增伤；主/职业伤害首个有骰分量领取一次，减伤骰不领取，归零及减伤前加入。武僧独立附赠攻击入口每次命中各自领取，暴击不翻倍固定加值。
- 新增5项转移来源/暂停/暴击/回滚、2项连击普通+暴击及末次失败回滚伤害/气/附赠动作；4文件367项通过，完整typecheck14748 exit0，定向diff通过，全部验证进程结束。详见2026-09-30-special-attack-target-bonus.md。
- 其他独立特殊及附带/重复豁免伤害仍待审计接入，full注册保留。原始预检29/155（18.7%），review r37/coverage r41/batch r23不变，API0、原始配置及真实房间未动，整书目标active。

## 2026-09-30：重复豁免及炼狱叱喝来源增伤

- 上轮转移/武僧攻击属于progress。本轮repeatSave.damageOnFailure实际失败时读取效果来源标记，加入原骰池；修复需要多次成功的效果在成功但未达到移除阈值时仍造成失败伤害的问题。炼狱叱喝加值位于减半与防御之前。
- 新增11项重复失败/成功进度/来源隔离/缺失来源/防御/非法骰回滚和反应资源用例。修正测试初始错误契约资源key。最终3文件333项通过；扩展Activity检查79通过、4项能力评级失败未解决（汇总秘法锁、穿墙术、秘法锁/敲击术、光亮术均实际assisted而期待full），未宣称全回归通过。
- 完整typecheck16292 exit0、定向diff通过，全部验证进程结束；详见2026-09-30-repeat-reaction-target-bonus.md。剩余独立伤害入口及能力门禁继续处理，full注册保留。原始预检29/155（18.7%），review r37/coverage r41/batch r23不变，API0、原始配置及真实房间未动，整书目标active。


## 2026-09-30：地图评级核实与武僧特殊伤害

- 上轮四项评级失败已定位：地图物体写入被明确禁用，assisted 为真实能力，旧测试仍期待 full。本轮修正限定法术的预期，并校验地图限制理由和公开 full 查询；没有移除写入保护，也未把处理器注册当作完成。
- Quivering Palm 成功豁免后的 10d10 和 Deflect Missiles 返回攻击接入实际武僧来源增伤，失败豁免直接降零不加值；返回飞弹未命中/放弃不加值，暴击不倍增固定修正。
- 新增11项来源、抗性、暴击、零生命、未命中、放弃及非法骰事务回滚验证。最终5文件530项通过，完整typecheck35674 exit0，定向diff通过，所有验证进程结束。详见2026-09-30-map-rating-monk-target-bonus.md。
- 其他原生伤害路径及地图物体能力缺口仍未完成，full支持登记保留。原始配置预检29/155（18.7%），API0、原始配置及真实房间未动，整书目标active。


## 2026-09-30：随机表共享伤害池来源加值

- 上轮地图评级及武僧分支属于progress。本轮施法后随机表 self-centered-core-spell 在共享原始骰池之后按目标独立读取来源加值，再归零、豁免、防御；不污染其他目标的骰池，不扩大未知表项支持。
- 新增7项来源、暂停、防御、非法骰及JSON重载重放用例。首次fixture向强制触发提交多余triggerRoll被拒绝，修正输入后最终3文件367项通过。完整typecheck23287 exit0、定向diff通过，所有验证进程结束。
- 只读核实Hurl Through Hell提前骰总额缺显式延迟骰来源，及邪魔免伤边界，下一步处理。未放开原生来源增伤full登记。原始配置仍29/155（18.7%）、API0、原始AI配置和真实房间未动，整书目标active。详见2026-09-30-random-table-target-bonus.md。


## 2026-09-30：Hurl Through Hell 延迟骰来源

- 上轮随机表修复属于progress。本輪新触发保存10d10原始骰池，克隆及角色/地图桥保留，返回时验证骰面、数量和总和，再读取当前来源标记后归零/防御；邪魔无返回伤害加值。旧总额存档不猜测骰来源，新损坏记录原子拒绝。
- 新增13项来源/时点/重载/旧档/负修正/损坏记录/资源回滚与2项玩家及敌方地图往返测试，最终3文件390项通过。完整typecheck97946 exit0；仅清理末尾空行后定向diff通过，全部验证进程结束。详见2026-09-30-hurl-delayed-damage-provenance.md。
- 保留现有预掷骰交互，剩余怪物专属伤害继续审计，来源增伤full登记未放开。原始配置29/155（18.7%），API0、原始AI配置及真实房间未动，整书目标active。


## 2026-09-30：怪物待处理机制来源增伤

- 上轮Hurl延迟骰属于progress。本轮待处理触发器的独立damage及attack两条公共路径按实际拥有者读取来源增伤，damage保留原始负修正再加值归零；治疗/临时生命不变，未命中不加值，暴击不倍增固定修正。
- 新增2组共14情形验证来源、暂停、防御、负修正、非法骰回滚、暴击、未命中、JSON重载及重复快照拒绝。3文件321项通过，完整typecheck7843 exit0，定向diff通过，全部验证进程结束。
- 新增只读AST伤害入口清单工具并运行（43伤害骰调用/47伤害应用等），明确不把语法清单当作行为证明。同步after-hit需要判定与主攻击共享加值，未盲目二次添加；其余附带豁免/特殊动作/投掷待核查。详见2026-09-30-monster-mechanic-target-bonus.md。
- 原始配置29/155（18.7%），API0，原始AI配置及真实房间未动，整书目标active，来源增伤full登记未放开。


## 2026-09-30：怪物命中后独立豁免伤害

- 上轮待处理机制属于progress。本轮saving-throw-damage独立骰池在首个有骰分量领取一次来源增伤，再汇总豁免与后续防御；主武器池独立，多个伤害类型不重复。固定分量、全固定效果和能力值降低骰不领取。
- 新增12项命中/暴击/豁免/防御/来源隔离/负修正/固定分量/非法骰回滚，最终4文件2206项通过（含目录武器分支）。完整typecheck87830 exit0、定向diff通过、全部进程结束。详见2026-09-30-monster-on-hit-save-target-bonus.md。
- 同步after-hit额外机制仍需核查与主伤害归属，其他特殊动作/投掷等入口未完，full登记保留。原始配置29/155（18.7%）、API0、原始AI配置及真实房间未动，整书目标active。


## 2026-09-30：特殊吸取与传奇翼击来源伤害

- 上轮命中后豁免属于progress。本轮吸取之吻、条件伤害转治疗和传奇翼击三条路径按实际目标加入来源加值；上限降低/治疗继续按实际伤害，翼击成功豁免不领取，共享摘要保持基础池。
- 新增6项参数测试执行14情形，修正fixture遗漏传奇列表及条件投影；4文件781通过。首次类型检查发现fixture构造参数错误，修复后新增6项复跑通过，完整typecheck41345 exit0、定向diff通过，全部验证进程结束。
- 扩展monsterTeleportInvisibility有一项空中传送应要求坠落骰却ok的失败尚未修复；已确认准备层有传入高度，后续核查Headless空中判定，未降低预期。详见2026-09-30-monster-special-target-bonus.md。
- 投掷碰撞及其他路径仍待审计，来源增伤full登记保留。原始配置29/155（18.7%）、API0、原始配置及真实房间未动，整书目标active。


## 2026-09-30：怪物空中传送坠落回归

- 上轮特殊伤害属于progress。本轮修复自动坠落只接受原先有飞行支撑、遗漏从地面传送到空中的缺口。预览和结算共用怪物空中目的地判定，实际到达且无法悬空时请求骰；有飞行能力、地面落点及DM物理高度编辑不被泛化为坠落。
- 原传送失败已消除，增加飞行保持高度及非法骰回滚断言。4文件334项通过，完整typecheck76130 exit0、定向diff通过，全部验证进程结束。详见2026-09-30-monster-teleport-airborne-arrival.md。
- 来源伤害剩余投掷/同步after-hit等继续审计，完整能力登记未放开。原始配置29/155（18.7%）、API0，原始AI配置和真实房间未动，整书目标active。


## 2026-09-30：投掷碰撞及同步after-hit骰池

- 上轮空中传送属于progress。本轮投掷关联目标实际碰撞骰接入投掷者来源修正；无碰撞和环境坠落不借用伤害来源。同步after-hit原攻击目标沿用主攻击一次领取回调，固定主伤害时首个有骰额外分量领取；其他目标独立。公共机制保留原始总额，治疗/临时HP仍归零但不加值。
- 新增7项投掷与4项同步追加测试，验证关系/位置/资源回滚、JSON重载、重复释放拒绝及多个附加分量不重复领取。投掷首轮566通过，合并最终5文件407通过，完整typecheck56060 exit0、定向diff通过，全部验证进程结束。
- AST清单更新r2，43原始骰调用31加值读取仍不构成full证据。只读确认捕兽夹旧入口无可信布置者，不把受害者冒充来源。下一步分类所有剩余骰与手工伤害入口。详见2026-09-30-fling-synchronous-target-bonus.md。
- 原始配置29/155（18.7%）、API0、原始AI配置及真实房间未动，来源增伤full登记保留，整书目标active。


## 2026-09-30：伤害入口分类与第二目标战技

- 上轮投掷/同步机制属于progress。本轮按43原始骰/47伤害应用入口分类，产出带源文件SHA256的索引，不把分类当行为完成；发现第二目标战技漏读该目标来源加值并补齐，原目标不受影响。
- 新增5项来源、抗性、负修正、未命中及资源验证，本地战技fixture存在且实际执行，3文件337项通过，完整typecheck47225 exit0、定向diff通过，全部验证进程结束。
- 仍有固定主伤害后战技骰共享、脚本数值骰来源、其他手工汇总和自伤骰归属边界，不开放full登记。详见2026-09-30-damage-entrypoint-classification.md与.codex-logs/damage-entrypoint-classification-20260930-r1.json。
- 原始配置29/155（18.7%）、API0、原始AI配置及真实房间未动，整书目标active。


## 2026-09-30：普通/反击/指挥战技共享领取

- 上轮入口分类及第二目标修复属于progress。本轮Host内部Dnd5eWeaponDamageRollBudget贯通普通战技、反击、指挥盟友武器攻击，固定主伤害后首个战技骰领取，已有骰池不重复；真实盟友出手不借用指挥者标记。记录不进入玩家协议或存档。
- 新增3组共18情形验证固定/有骰主伤害、正确/错误来源、非法后续骰全事务回滚及资源/反应归属，3文件340项通过。完整typecheck83546 exit0、定向diff通过，所有进程结束。详见2026-09-30-maneuver-shared-roll-budget.md。
- 后续核查pluginSandbox Worker数值能力的骰来源、其他手工伤害/自伤归属，完整支持登记仍保留。原始配置29/155（18.7%）、API0、原始AI配置及真实房间未动，整书目标active。


## 2026-09-30：Worker 显式伤害骰来源接口

- 补齐脚本 Worker dealRolledDamage：引用注册 damageType 骰池，由 Host 读取实际骰、实际来源并在倍率及防御前加值。旧固定数值接口不猜测骰来源。同池同目标重复提交、其他目标专用骰池、未声明骰和非法倍率被拒绝。
- 验证真实 Worker 执行与序列化后的 Host 结算、接收边界、JSON 重载、资源及 HP 拒绝保护；5文件47项通过。首轮类型检查发现新测试注解问题，修正后完整 typecheck24860 exit0，定向diff通过，验证进程全部结束。详见2026-09-30-worker-rolled-damage.md。
- 只读确认旧 pluginDeclarativeCompiler 仍以最终数字调用 dealDamage，且其 parent-weapon 分量需考虑原攻击共享池，留作下一项；不以当前 Worker 新接口替代这条路径的验收。完整来源增伤能力登记未放开。
- 原始配置29/155（18.7%）、API0、原始AI配置与真实5273/5274房间未动，整书目标active。


## 2026-09-30：旧声明式伤害与父武器骰池

- 上轮 Worker 接口属于 progress。本轮修复 pluginDeclarativeCompiler 数值路径丢失伤害骰来源：实际 damage 骰在倍率/豁免/防御前领取，固定/治疗骰不猜测；同池同目标一次领取。
- resolveWeaponAttack 的事务内 WeakMap 记录贯通自动 after-hit 触发，与主攻击及其他附加共享；子触发失败不提交领取记录。原生其他攻击事件入口暂保留原行为，不凭事件猜測骰池。
- 新增12种情形，4文件92项通过；新测试只读数组类型错误修正后，完整 typecheck95926 exit0，定向diff通过，全部验证进程结束。详见2026-09-30-legacy-declarative-damage-pools.md。
- AST清单attack-event-ledger-audit-20260930-r1.json列出10个事件字面量及SHA256，供下一批核查怪物/法术/武僧/重定向/Activity攻击入口，不是行为认证。完整来源增伤登记未放开。
- 原始配置29/155（18.7%），API0，原始AI配置和真实房间未动，整书目标active。


## 2026-09-30：原生攻击事件批量衔接

- 上轮旧声明式修复属于progress。本轮统一原生攻击事件骰池记录：重定向和怪物主/附加分量沿用可变领取，单/多法术攻击、怪物法术、待处理怪物攻击、武僧连击和返击保留已验证池。补父攻击实际伤害类型。
- 明确开放无缩放零骰的命中后固定 parent-weapon 声明，其他主动/无Host正骰/有缩放情况仍拒绝。新增15项端到端与边界测试，5文件128项通过；完整typecheck43430 exit0、定向diff通过，所有验证进程结束。详见2026-09-30-native-parent-damage-ledgers.md。
- 事件清单r2保留10对象及源哈希：9原生接口有记录，Activity多检查关联待审计。下一步先验证同目标无关攻击重击是否影响其他分支，补明确检查→伤害池连接。旧原生事件的任意有骰预激活收集并非由本轮证明，完整支持登记未放开。
- 原始全书29/155（18.7%）、API0、原始AI配置和真实房间未动，整书目标active。


## 2026-09-30：Activity重击分支与实际目标

- 上轮原生事件衔接属于progress。本轮先用5个失败反例证实：同目标其他检查重击会影响普通检查，actor/all-targets也借用了错误目标的重击。现按outcome明确成功攻击条件与实际受伤目标解析，保留合法触发重击继承，独立检查不借用重击。
- 伤害提案和registered/compiled两条Host结算证据新增attackCheckKeys机器关联；模块导出重导入后的实际HP与消耗骰数已验收。较大兼容骰池中普通分支只用基础骰。9项新增、6文件109项通过；类型收窄测试问题修正后完整typecheck6340 exit0、定向diff通过，进程全部结束。详见2026-09-30-activity-critical-branch-attribution.md。
- Activity父攻击共享领取仍需消费上述关联；不把本轮元数据当成这一阶段完成。旧编译骰子预备superset保留兼容，不代表所有分支都实际使用重击骰。
- 原始配置预检仍29/155（18.7%），这是预检率而非整书完成率。API0、原始AI配置和真实房间未动，完整支持登记未放开，整书目标active。


## 2026-09-30：Activity 父攻击伤害记录

- 使用明确的 attackCheckKeys 将 registered/compiled 攻击事件接入共享事务记录；独立攻击分开，联合结果共享，固定伤害不占用实际有骰记录，grant-source 与旧缺关联提案保守处理。不把数据放入玩家协议或存档。
- 导出重导入后的真实事件与状态断言、固定/有骰/授予来源及旧提案边界、原生和声明式回归：3文件75项通过；完整typecheck11647 exit0、定向diff通过，验证进程结束。详见2026-09-30-activity-parent-damage-budget.md。
- 任意after-hit追加骰的全入口收集及未包装公式不由本批证明，完整支持登记未放开。原始预检29/155（18.7%）不是整书完成率；API0、原始配置及真实房间未改，整书目标active。


## 2026-09-30：攻击前移动快照与转换协议依赖

- 上轮父攻击记录为progress。本轮回查全书复合诊断，新增通用movement-distance的before-attack-straight-streak条件，Host按事件顺序将直线距离交给紧接的第一次攻击，命中和失手均清除本次累计；原生、compiled与registered均接入。替换转换指南中仅凭整回合准备效果判断紧接移动的建议。
- 合成模块导出重导入、分段/转弯/跨回合/失手后二击及重放、类型边界等8文件182项通过；扩大原生/玩家移动回归2文件357项通过。完整typecheck86600 exit0、定向diff通过，全部进程结束。
- 指南依赖回归发现并补齐漏带的Dnd5ePersistentAreaSourceLimit声明，未削弱依赖完整性测试。详见2026-09-30-attack-movement-snapshot.md。
- 私有review-r38追加证据，骑兵复合诊断仍partial：骑手自身回合内完整坐骑控制、其他动作间隔语义、原始源包及双端交互没有被本轮证明。本小项接口与本地验证完成；全书原始预检29/155（18.7%）不代表总体完成率。API0，原配置及真实房间未改，整书目标active。


## 2026-09-30：原始产物批量回放与漏检修复

- 上轮移动快照属于progress。本轮用准确来源及哈希重验原始候选，先合并29项做两次独立安装，再批量回放真实原始产物而非仅合成接口。发现冰刃成功减半、精魂移动原点、火焰额外微光半径、光耀祷词累计步数四项配置错误，新增通用来源约束，保留原始失败配置与日志。
- 最终完整预检r27：25 ready、129 blocked、1不能解析；25/155=16.1%是预检率而非总完成率。新的25项合并归档再次往返和两次独立注册通过；25来源各有至少一组现有定向行为断言通过，但没有全文行为或浏览器认证。精确来源/测试映射在私有fullbook-original-behavior-coverage-20260930-r1，4失败候选另存fullbook-original-behavior-failures-20260930-r1。
- 3源码测试文件71项通过，最终完整typecheck94854 exit0，定向diff通过，全部验证进程结束。批量回放原失败保留；生命转换旧版本误选已用当前原始候选重验通过，未改规则断言。详见2026-09-30-original-artifact-batch-acceptance.md。
- 私有backlog r15/review r39/coverage r43更新，最新候选选择带来的其他新诊断不自动提升支持等级。原始配置未手改；付费API0；5273/5274真实房间未动，整书目标active。


## 2026-09-30：施法成分来源核对

- 补齐明确来源标题的 verbal/somatic/material 比对；条件式或损坏文字不猜测。实际拦截休憩术多出的 verbal，原始配置不手改。
- 2 文件 47 项通过，全书离线回放 1 项通过，完整 typecheck 90718 exit 0，定向 diff 通过。
- 最新预检 r28 为 24/155（15.5%）：130 blocked、1 无可解析草稿。这是预检率，不是总体完成率。诊断 backlog r16；旧 review r39 / coverage r43 不代表新版诊断全部审核。
- 先前 25 项导出和行为验证保留为历史证据；不再宣称该 25 项集合全部通过当前预检。API 0，真实房间未动，整书目标未完成。详见 2026-09-30-source-component-evidence.md。


## 2026-09-30：区域方向性耗费与风类诊断收敛

- 上轮施法成分校验属于有效进展。本批实现 directionalMovementCost 通用区域声明，从选择后的矩形/立方区域保存单位方向，在真实玩家/怪物移动及路径树、规划、模拟、自愿/反应移动中结算独立额外耗费；按格步目的占用和高度计算，困难地形免除不免此项。
- 声明校验、提案、地图提交、迁移、SDK 与模块导出重装对齐。8 文件 322 项通过；另玩家/怪物武器攻击 2 文件 130 项通过。完整 typecheck 50794 exit 0；所有进程终止。
- 三条具体区域攻击劣势诊断可由已执行过的共用接口表达；操控风力的方向选择和多模式复合诊断仍为部分解决，不将机制回归冒充原始配置完整认证。见 2026-09-30-directional-area-movement.md。
- 原始最新预检 r28 仍 24/155（15.5%），这是预检率；不代表总工程完成率。API 0，原始生成内容和真实 5273/5274 房间未修改，目标未完成。

- 本批四条风区诊断的机制审阅进度为 3/4（75%），非全文或总体完成率。私有 review r40 / coverage r44 / batches r12 已按 backlog r16 核验保存；121 expressible、26 partial、806 unreviewed 来源关联保留，不将未知诊断自动视为可用。

## 2026-09-30：区域模式与真实飞行资格

- 通用区域支持施放时选择封闭模式，以及来源授予的后续动作切换、暂停和恢复。保留同一实体、范围、来源/DC、专注、期限及有限次数收据；Host 验证来源角色、Token、模块及活动授权。19 项专属用例与 9 文件 208 项回归通过。见 `2026-09-30-persistent-area-modes.md`。
- 飞行专属区域触发接入普通/强制移动、回合开始、准备阶段及 Headless 重检。成功移动保存实际 traversalMode，地图/角色投影与 JSON 刷新后区分飞行和攀爬；缺少旧记录不从高度猜测。倒地后使用既有共同结算边界追加坠落，保留悬浮资格。36 项专属用例、最终 11 文件 338 项回归通过，完整 typecheck 29101 exit 0、服务端语法与定向 diff 检查通过，进程全部结束。
- 进入点的在途中断仍待接入：飞行经过区域后同一次移动最终落地不能仅依最终状态结算，失败倒地也必须先处理再决定后续路径。任意独立风向和区域内摔落减伤仍待实现；两条飞行/倒地来源诊断保持 partial，不将回归通过数作为全文自动化认证。见 `2026-09-30-persistent-area-flight.md`。
- 最新原始配置预检 r31：24 ready、130 blocked、1 无可解析的当前草稿（24/155，15.5%，仅预检率）。私有 backlog r19 / review r42 / coverage r48 / batches r14 按准确诊断与来源范围保存：156 条不同诊断已审阅，122 个来源关联可表达、28 部分解决、6 需来源修正、803 未审阅。原始生成配置未手改，API 0，真实 5273/5274 服务和房间未动；全书集中生成、原文行为、导出安装与隔离双端验收仍未完成。
