# 众星冠冕（Crown of Stars）逐项验收

原始条目 `:153:4`，原始转换稿不修改；本条未接受，全书 55/155 已接受、100 待验收。

原文需求：七环塑能、动作、自身、言语姿势、一小时不专注；初始七枚星光，八/九环九/十一枚。附赠动作对 120 尺内生物或物品作远程法术攻击，命中 4d12 光耀，无论命中与否消耗一枚，耗尽结束。剩余至少四枚时明亮30尺加额外微亮30尺，剩余1–3枚时仅微亮30尺。

原稿只有孤立的生物攻击 Activity，施放声明为 partial，缺少创建/次数/耗尽/动态照明/物品目标连接。现有 emitted-light、授予 Activity 和普通攻击可复用；有限次数必须属于效果实例，不能用刷新即补满的角色全局资源，也不能每次攻击重建一小时效果。

## 已验证的基础组件，尚未接入结算

`effectGrantCharges.ts` 提供效果次数声明与保存状态的纯数据校验、按施法环阶生成次数、消耗一次及按剩余次数选择光照档位。损坏的次数、重复阈值或不完整升环声明拒绝，不猜测或补充次数；操作返回新对象，不修改原输入。

`crown-stars-charges-r1.txt`：3 tests passed / exit 0。覆盖 7/9/11、无效环阶、连续消费和序列化重载、4/3与1/0照明边界、耗尽拒绝及输入不可变。本组件尚未被 ActiveEffect 协议/执行器/授予动作消费/地图光照调用，不能据此声称法术已自动化。

待做：配置与导入验证；效果实例持久化和过期；攻击命中/未命中都消耗，取消/非法目标不消耗，最后一次攻击先结算伤害再结束；物品目标；升环、非专注、到期、重施法；玩家学习/授予操作栏与双端照明同步；累计包导出重导入。

## ActiveEffect 保存与照明查询接线

`grantedActivityCharges` 已加入实际效果实例及构造输入，并经过 ActiveEffect 规范化保存。损坏次数、无授予动作的次数池、同时声明单次与次数池的矛盾效果，整个实例拒绝，不静默变为无限次数。有效效果查询排除耗尽实例；照明查询按次数档位投影，原有其他光源继续参与比较。攻击提交尚未消费这些次数，不能据此声称已自动扣除。

`crown-stars-persistence-r2.txt`：3 文件共 52 tests passed / exit 0。新测试通过真实效果构造、严格校验、序列化规范化和现有照明查询，验证七次消费的状态保存与4/3、1/0光照变化，原 source/duration 不变，既有 ActiveEffect 回归通过。r1 测试夹具误写 expiresAt，实际实例字段为 tickOn；修正夹具后通过，失败保留。

本步骤还没有接入导入声明、执行器、共享服务投影及攻击事务；次数池只会通过已接线的内部效果实例生效。项目类型检查日志 `crown-stars-persistence-typecheck-r1.txt` 待终态确认。

项目 `npm run typecheck` / `tsc -b --pretty false` 已结束，exit 0（会话31294）。本条仍未接受。


## 导入声明、执行器与 Host 效果创建

新增 Effect `grantCharges` 声明，验证有限次数、非空 grants、与 grantsSingleUse 不冲突，以及升环上限。执行器使用实际 castLevel 生成 grantedActivityCharges；缺失或非法环阶拒绝，不回退默认七环。Headless 创建条件、属性修正、扩展状态和普通标记效果时保留次数池，与 grants 同归属一个实例。

验证日志：`crown-stars-executor-r1.txt`，3 文件 86 tests passed；覆盖七/八/九环7/9/11、错误环阶和矛盾声明。`crown-stars-charge-archive-r1.txt`，4 tests passed；合成模块经过真实 .starmod 导出、重导入和两次独立安装，四类效果通过已注册 Activity 的 Host 权威入口生成唯一次数池。该测试仅证明导入至效果创建，不代表众星冠冕完整归档或攻击扣次完成。

尚待：攻击提交扣次/耗尽清理、对象目标、实际双端照明和完整法术归档验收。全书仍55条本地通过、100条待验收。本次无 API 调用。

项目类型检查 `crown-stars-executor-typecheck-r1.txt` 已确认终态 exit 0（会话9869）。


## 攻击提交扣次与耗尽清理

新增 consumeDnd5eActivityGrant，在注册 Activity 和插件提交成功后消费有限次数；拒绝的触发窗口仍使用原单次授予逻辑，不消费有限池。只修改原效果的次数，耗尽通过既有移除管线清理，不重建持续时间。权限查询拒绝零次数及损坏次数。当前状态已扣过的次数不再通过嵌套提交重复扣除。

`crown-stars-consumption-regression-r2.txt`：5文件59项通过。真实归档重导入及两次安装，四种效果连续七次消费，耗尽后授予移除；注册与编译攻击路径均覆盖命中、未命中、最后一枚命中/未命中、非法骰、超射程、零次数、附赠动作不可用。命中4d12光耀，最后一次仍结算伤害，原输入状态不变，原效果期限不刷新。该攻击夹具为合成配置，未据此认定众星冠冕原始条目已经完成。

失败记录保留：attack-r1..r3 使用了不符合编译路径的骰值格式（该路径需要原始d20且普通命中4d12），r4修正后通过。consumption-regression-r1 的合成配置缺少 action-economy consumption，注册入口不根据 activation 隐式补齐消耗；加入明确附赠动作消耗后 r2 通过。最终法术配置必须明确声明该消耗。

剩余：实际法术配置、物品目标、完整归档、双端操作及同步验证。取消UI/网络重放尚未单独验证；不将提交失败测试扩大解释为所有取消路径都已通过。全书55/155不变。

本步项目类型检查 `crown-stars-consumption-typecheck-r1.txt` 已确认 exit 0（会话27543）。


## 实际法术候选归档与外层施法事务

本地 `crown-of-stars-partial-r1/candidate.starmod` 已生成，保存原始 source，manualContentRepairs=true、API调用0；尚未加入正式累计包。实际条目包含自身施放、600轮非专注效果、7/9/11实例次数、授予120尺远程攻击、明确附赠动作消耗、重击骰翻倍和光照阈值。物品分支仍在 unsupported 中，攻击 Activity 保留 assisted 标记；该缺口未隐瞒。

`crown-stars-candidate-r4.txt`：1项通过，真实 PDF 导出管线和重导入配置一致。r1/r2纠正 schema 字段及supported/manual targeting冲突；r3发现项目规定法术位由外层施法事务处理，不能同时在插件配方声明消费；r4沿用该约定后导出成功。

`crown-stars-cast-r2.txt`：3项通过，使用准确候选字节实际 prepare/resolve 外层施法事务，在7/8/9环分别扣一个对应法术位并创建7/9/11星光。JSON重载后次数、授予动作、600轮期限和初始光照保留，不专注。为重施法夹具提供一个新法术位，将旧池设为2枚后再次施放，验证花费一次法术位、替换为一个满额新池而非叠加。此夹具补充法术位只是测试重施法前提，并非实现自动恢复法术位。

现有 stoneWallAttack 只处理武器攻击，不能直接接成通用法术的物品目标入口；Activity 当前目标协议也没有物品分支。后续需接通物品目标及地图事务，保留现有墙体攻击行为。尚待实际授予攻击UI、双端照明/状态、时钟过期、专注共存、取消/网络重放及正式累计包。全书55通过100待验收不变。


## 实际地图授予攻击、动态光照与期限

候选更新为 `crown-of-stars-partial-r2`。真实 effect-control 入口仅接受完整 Activity 或含手动裁定操作的 assisted Activity；r1把生物攻击标为 assisted，导致入口不可用。r2将已实现的生物攻击 Activity 标为full，但原文的物品目标缺口仍明确保留于unsupported和验收报告；全法术尚未接受。`crown-stars-candidate-r2-export.txt`确认真实导出重导入通过。

`crown-stars-lifecycle-r1.txt`：3文件5项通过，准确r2归档的实际外层施放与重施法7/8/9环，以及 effect-control prepare/resolve 地图适配器七次交替命中/未命中。四次命中共56光耀伤害，三次未命中仍扣星光；每次应用后JSON重载，次数与原600轮期限保留，4→3时光照从30明亮+30微亮变为0明亮+30微亮，最后一次伤害结算后池、授予和光照移除。

到期测试使用真实施法结果，通过战役时钟59分钟后余10轮、再1分钟效果结束。预先存在的另一专注效果仍保留。lifetime-r1夹具误用小数分钟（接口按整分钟推进）；r2夹具缺少集中效果的sourceActorId/concentrationId，修复为真实实例协议后合并测试通过。旧失败日志保留。

以上是本地地图适配器证据，不是双端浏览器证据。物品目标、实际DM/玩家同步、UI取消/传输重放和正式累计包仍待完成。全书55条本地接受、100待验收不变。


## 物品目标：明确战斗属性与存档（接线未完成）

检查确认：地图 obstacle 已有hp/maxHp，但 MapObjectState 无通用AC/防御字段；pluginFeatureAction 的 single-creature 分支明确拒绝 obstacle，mapBridge 也仅投影 player/enemy/npc。不能只删除目标过滤，否则会对未知AC和怪物默认数据结算。

新增 MapObjectState.combatProfile（DM数据）：armorClass、可选damageThreshold及类型免疫/抗性/易伤。独立验证仅接受有限合法字段；攻击目标读取要求obstacle、有明确存活HP/maxHP和有效profile，不猜测AC或HP。真实地图迁移/JSON重载已保留该数据。

`crown-stars-object-profile-r1.txt`：3文件29项通过，覆盖新字段持久化、非法数据和未知/死亡目标拒绝，以及原物品状态与投掷物表面撞击回归。此步骤未实现物品攻击，不能据此声称物品分支可用。

下一步需添加明确的Activity物品攻击选择声明，将Host物品快照接入伤害结算和地图事务，提供DM属性编辑与玩家选择入口；不能把所有生物法术都放开为物品攻击，也不能把物品加入实际先攻。相关入口：pluginFeatureAction.ts single-creature目标检查；mapBridge.ts combatants投影；地图Activity目标选择UI。已有石墙/冰墙等攻击功能保留。55/155不变。

物品属性步骤项目类型检查 `crown-stars-object-profile-typecheck-r1.txt` 已确认exit0（会话53035）。DM编辑位置为 Dnd5eMapObjectDetailPanel.tsx；玩家下拉入口 Dnd5ePluginCombatPanel.tsx 和 playerMapPersistentAreas.ts 需对应接入。


## DM物件战斗属性编辑

Dnd5eMapObjectDetailPanel 增加空值默认为未设置的 AC、伤害阈值输入及默认折叠的伤害类型防御表。缺少 AC 时不写默认值，阈值/防御暂不可编辑；清空 AC 可移除战斗属性，保留重量、锁定等其他字段。界面没有宣称物品法术攻击已可用。

`crown-stars-object-editor-r2.txt`：2文件12项通过，包含真实组件输入回调设置/取消防御、非法AC/阈值拒绝和保存规范化，以及既有详情面板/对象数据回归。此为组件及本地数据验证，没有实际浏览器截图验收。

协议接入位置进一步确定：ActivityFeatureActionAdapter 将 creature 映射到single-creature；pluginMechanicsContracts 的 Dnd5ePluginTargeting 目前无物品声明。后续必须增加显式物品攻击选择协议，并在Host校验中与生物范围/影响分支区分，而非直接把所有single-creature目标过滤放开。全书仍55/155，物品分支尚未完成。

DM编辑步骤项目类型检查 `crown-stars-object-editor-typecheck-r1.txt` 已确认exit0（会话62895）。


## 物品攻击实际接入（本地通过，双端待验收）

新增 Activity target.allowObjectAttack 显式声明，仅用于单目标any关系攻击、一次攻击检定和对目标的伤害操作。编译到地图控制元数据；普通生物Activity拒绝object快照。Host仅为指定已配置AC/HP的obstacle创建临时攻击快照，使用物件防御和伤害阈值；对象不进入实际先攻。对象损伤只回写hp，不添加生物状态、死亡豁免或移动。默认沿用对象毒素/心灵免疫规则。玩家插件下拉目标与快捷栏点击目标已加显式对象声明检查，尚未浏览器验收。

候选 `crown-of-stars-partial-r3/candidate.starmod` 已真实导出/重导入并启用物品分支；原source保持不变。`crown-stars-object-final-local-r1.txt`：7文件36项通过。实际归档七次交替命中/未命中，普通/抗性/免疫/阈值/易伤/摧毁六场景，命中伤害和星光消耗一致；对象未获得combatState，未进入initiativeOrder。缺少AC/HP、超距、授权效果不存在时prepare拒绝且输入不变。普通生物攻击对象拒绝、非法对象攻击配方拒绝以及原有墙体/怪物墙体攻击回归通过。

范围限制：本轮物品表示为已有地图obstacle token，不代表geometry门/墙或持久法术墙板已接入通用法术目标；既有墙体攻击未改动。双端选择与状态/光照同步、取消/网络重放、正式累计包仍待完成。候选保留未验收说明，不增加全书接受数（55/155）。

物品攻击接入项目类型检查 `crown-stars-object-attack-typecheck-r1.txt` 已确认exit0（会话99761）。

## 实际双端发现并修复物件伤害提交遗漏

`crown-stars-room-r2.txt` 曾失败：七枚星光均扣除，双方次数与光照数据同步，但物件HP仍为200。原因是mapBridge对象分支只写结果地图和tokenPatches，未登记changedTokenIds；实际插件结果重基线仅合并已修改Token，丢失该伤害。现已登记HP变化对象；未变化的对象不生成写入。

`crown-stars-object-final-local-r2.txt`：7文件36项通过。真实r3归档的六类物件伤害场景改为经实际entity commit写回后检查，避免只检验中间结果地图。仓库永久回归 `mapObjectDamageCommit.test.ts` 另验证无伤、受伤、摧毁三个场景经过投影、重基线、提交后HP正确；`crown-stars-object-commit-r1.txt`：3项通过。

`crown-stars-room-r3.txt`：1项实际DM/玩家浏览器测试通过（2.9分钟）。DM导入准确r3归档，玩家端注册并通过UI学习、准备、施放；一个7环位消耗，七枚星光依次使用，双方次数一致。Host物件HP确实下降，剩余3枚时双方光照数据为仅30尺微光，0枚时效果/光照移除，双方刷新仍为耗尽。测试目标HP提高到1000以免随机伤害提前摧毁；攻击骰来自实际UI，不将最终HP下降视为逐次精确伤害验证，也未据此宣称光照像素截图已验收。

取消/重放、战斗动作经济的剩余核查、最终元数据及累计包导出重导入尚未完成。部分证据已写入fullbook-ledger.json，整条仍待验收，全书55条本地接受、100条待验收不变。

## 最终条目验收（累计包26）

`crown-stars-gates-r2.txt`：实际r3配置8项边界通过，包括缺AC/HP、超距、无授权、附赠动作不足拒绝，准备后取消及非法骰值不修改输入；合法攻击花费附赠动作、保留动作并扣一枚星光。r1生成脚本因CRLF未替换断言而失败，已修复夹具并保留原日志。`crown-stars-gates-room-r1.txt`实际双端通过目标选择取消和效果耗尽后旧请求拒绝，均无额外消耗或伤害。

正式累计包 `repaired-entries-batch26.starmod` 共56条（39法术、10专长、7特性），SHA256 `236f08b1cf03f66fd2f4d02a72aae292c0c5415a94a2e1a1678f2bbe57e7a352`。`crown-stars-bundle26-r1.txt`验证真实导出重导入、两次独立注册、旧55条定义在包名重基线后相等、原始source未改。造妖术的本人契约来源包名相应重基线至batch26；未来累计包仍需执行相同处理。

`crown-stars-bundle26-behavior-r1.txt`：7文件24项通过，使用最终累计包验证众星冠冕7/8/9环施放及重施法、升环枚数、一次法术位消耗、原专注保留、1小时到期、生物及物件攻击、命中/未命中消耗、光照阈值、耗尽结束、物件防御/摧毁及拒绝边界。造妖术实际创建及契约行为也针对新包重跑通过。

`crown-stars-bundle26-room-r1.txt`：1项实际双端测试通过（3.1分钟）。最终累计包由DM导入，玩家学习/准备/施放；目标取消不发请求、不扣星光；七次实际物件攻击消耗同步且物件HP降低；3/0枚光照数据正确，耗尽后的新ID旧请求被拒绝、HP不变，双方刷新仍保留耗尽状态。

验收资料在私有目录 `crown-of-stars-final/acceptance.json` 与 `requirements-audit.json`。条目已接受，全书更新为56本地接受、99待验收，14条具有限定双端行为证据，纯叙事豁免0。限制：浏览器验证为20级法师探索场景，战斗附赠动作/精确伤害采用实际包本地Host测试；光照为双方状态数据而非逐像素画面验收；物品通过明确AC/HP的obstacle表示，未把geometry门/墙板纳入通用法术目标；非全书认证，也非穷尽网络故障注入。下一条为骷髅之舞。
