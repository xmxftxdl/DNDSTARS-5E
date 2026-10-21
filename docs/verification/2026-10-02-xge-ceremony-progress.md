# 典礼术部分修复

2026-10-02婚礼历史步骤：`benefit-history`增加闭合`benefitRenewal:{kind:"recipient-death",match:"any"|"all"}`，Host从实际历史提案捕获至少两位独立受益者。不同于七天效果，受益历史不因时间、驱散或换施法者删除。再受益检查先前共同受益者的当前权威死亡标志，0HP/昏迷/离场/删除/旧无名单记录不满足；复活后也拒绝。成功再受益记录新一组成员，旧死亡不能反复解锁。当前查询限现有Host战斗快照，跨地图与已删除成员死亡证据仍缺。

普通提交和编译Headless均在费用前检查名单、时钟及资格，混合目标任何一位不合格整批拒绝。两条实际权威路线验证七天效果到期后历史保留、JSON/角色重载、零HP与缺失目标拒绝、复活拒绝、稳定角色换Token识别、换施法者受相同历史约束、再受益后记录替换及不重复消费。初期编译测试未注册消费资源及授予相应职业资格，修正为真实注册资源后通过；扩展换施法者夹具先缺实际轮次、再缺Host目标距离，补充真实权威数据后通过，没有降低生产校验。

v12实际典礼术包加入婚礼历史并删除该分支泛用人工批准；成年类人生物与自愿事实仍需Host确认。导出重导入、注册、Command与commit验证初次受益、再次拒绝、配偶0HP不解锁及确认死亡后更换配偶。包哈希`3dce9567b47231a1749c4ee508d2815d9c69a35c026e968b540adb33ac68ea19`，旧v1–v11和原稿保留，API0、assisted、entryComplete:false。

本步最终证据：`ceremony-widow-history-export-final.txt`实际包1项通过，`ceremony-widow-history-regression-final2.txt`6文件168项通过（含SDK说明），完整类型检查`ceremony-widow-typecheck-final.txt`终态退出码0（会话43412）；此前会话18437也退出0。婚礼跨地图/删除成员证据、AC显示及完整双端仍待完成；典礼术的统一尸体入口、水瓶目标扩展、一小时连续施法等保持待验收。累计49/155、106待验收、限定双端7、叙事豁免0。

婚礼距离步骤最终类型检查：`ceremony-wedding-typecheck-final.txt`终态退出码0（会话13210），此前修正测试后的会话83740也以0退出。所改生产文件diff空白检查通过。v11包及本步165项检查证据已入固定155条账本；没有遗留运行会话，典礼术仍未完整验收。

2026-10-02婚礼距离步骤：通用`armor-class`增加`cohortProximity`（maximumFeet与any/all）。普通提交和编译Headless两条路径从实际收到同一Effect的提案绑定名单，费用前验证至少两位独立身份；作者和玩家不能提交参与者ID。保留稳定角色身份用于换Token后查找，同角色多Token歧义、场景缺距离、非成员与一人组不获得加值。每次攻击按当前权威距离计算，30尺边界、移出/返回、重载和七天到期通过。没有把+2写入永久基础AC，也没有要求视线。

v11从原稿另存修复婚礼分支，增加成年类人生物与自愿资格、至少两个目标、七天条件+2；丧偶历史及再次受益未完成，保留原有明确裁定边界，因此仍assisted、entryComplete:false。实际部分包导出重导入、注册、Command、拒绝未批准和批准后commit、距离加值及重载验证通过；没有覆盖完整长施法/材料/浏览器结算。当前包哈希`e26edecf38395deaf3e90578d96fe398c7e2b52d4553d5b60984043cc51d6fdc`。

证据：`ceremony-wedding-cohort-export-final.txt`实际包1项通过；`ceremony-wedding-cohort-regression-final.txt`5文件165项通过，含两条权威路径、既有历史、地图快照、原生活动和SDK合同。首次两次原子拒绝测试夹具未提供位置，状态clone补空position导致严格比较失败，补真实位置后通过；没有修改生产clone来迁就测试。首轮类型检查发现新测试缺controller/concentrating/position，已修复；最终类型检查仍待终态，不提前宣称。地图AC显示与实际双端、丧偶与再次受益、统一尸体入口及完整长施法仍待验收。全书保持49/155、106待验收、限定双端7、叙事豁免0，付费API调用0。

本步最终验收：`ceremony-remains-source-activity-r2.txt`2文件76项通过，包含原生怪影相关活动及伤害提交会话；第一轮原生来源约定的2项失败已修复，日志保留。最终完整类型检查`ceremony-remains-source-typecheck-final.txt`终态退出码0（会话26405）；此前检查会话73071也以0退出。修改文件diff空白检查通过。实际v10包哈希`57017f9821c18fe43c93330144d46154736cd72b98f05dbe2a32a4af4a674c19`已存入账本，仍entryComplete:false。220项与76项范围分别保留，不据此声称全书或真实双端已通过。

2026-10-02遗骸分类与立即结果政策：地图增加显式`creature-corpse`资料，支持微型至巨型六种原体型，DM可编辑分类与体型。规范化、重载、六种体型的葬礼保护和界面静态渲染通过；尚未证明真实界面点击流程。原生操纵死尸仍仅接受其骨骸/小型中型类人生物尸体资料，其他生物尸体不会被推断为可操纵目标。

典礼术原文持续时间为立即。官方Sage Advice说明立即法术产生的结果不被解除魔法或反魔法暂停；将此通则应用于葬礼七天结果是本实现的规则判断，并非官方专门针对典礼术的裁定。来源：https://www.dndbeyond.com/sources/dnd/sac/sage-advice-compendium 。真实v10部分包导出重导入、注册、提交、反魔法地图快照及解除魔法候选验证通过。首次失败先暴露夹具使用裸法术ID，随后暴露生产提交保存Activity ID导致持续时间查询失败；现为导入法术保存其注册ID，同时保留Activity定义和堆叠ID。延迟伤害后的效果也携带来源ID。原生法术既有Activity来源约定保持，非立即效果的反魔法规则保持。

当前日志：`ceremony-remains-policy-export-final.txt`真实v10包1项通过；`ceremony-remains-source-regression-r1.txt`5文件220项通过。扩大回归第一轮165通过、2失败，定位为原生效果来源约定受变更影响，修正后第二轮结果另记。类型检查待终态确认，不提前声明通过。v10仍assisted、entryComplete:false；祈愿术强度例外、统一尸体选择、婚礼、水瓶目标扩展、连续施法与真实完整双端仍待完成。全书保持49/155、106待验收；未使用付费API。下面保留历史步骤，当时的驱散/反魔法待办由本段更正。

2026-10-02地图遗骸步骤：回读原始典礼术资料，葬礼明确是“祝福一具处于你周围5尺内的尸体”。此前“多尸体覆盖待办”是误列，已经从当前账本移除；不按范围祝福扩大规则。本步新增`protect-map-remains`闭合操作，用现有点选区域流程选择一具DM分类的地图尸体。Host重新验证选点、尸体分类、5尺距离、高度和效果连线；未知/骨骸堆/重叠多具/越界/缺时钟拒绝，不猜测目标。

保护记录包含来源Token/Activity/模块、环级、创建分钟和绝对到期分钟，地图规范化及重载保留。原生操纵死尸/创造不死生物的准备和提交都读取记录，时钟未知不能证明过期。战役时间到期只清除保护，不删除尸体；重复清理不改状态，现有DM地图权威更新及保存路径接入。没有新增视觉标记替代结算。

v9实际典礼术部分包为同一葬礼提供两个目标表示：已确认死亡角色/怪物与地图尸体（未增加第七种宗教典礼）。地图表示从原稿另存，真实导出重导入、注册、Command、Headless commit与地图写入通过；其他已修复分支保留。归档为`ceremony-partial-v9/`、assisted、entryComplete:false，原稿与v1–v8保留，API调用0。合成独立模块另验证新操作的编译Headless handoff；没有伪造一个生物占据尸体格来绕过目标校验。

证据：`ceremony-map-remains-regression-final.txt`5文件199项通过，`ceremony-map-remains-line-effect-r1.txt`85项地图效果连线补充通过，`ceremony-map-remains-export-r2.txt`实际v9包1项通过。数量重叠不相加。首轮类型检查发现错误读取legacySource.level及把布尔连线结果当对象，两处修正；第二轮发现迁移测试传了多余参数，也已修正。合成编译测试先缺targetCell/空地许可、后严格等值断言未容纳Host来源元数据；真实包Command夹具把areaPlacement放错到外围输入，均已修正，失败日志保留。最终完整类型检查`ceremony-map-remains-typecheck-final2.txt`终态退出码0（会话23163），所改生产文件diff空白检查通过；本轮无遗留运行会话。

仍需统一生物/物体尸体选择、重叠目标显式选择、全部遗骸分类、驱散/反魔法及祈愿术例外、完整持续施法与真实双端；婚礼和水瓶目标扩展仍未完成。当前49/155、106待验收、7条限定双端证据、叙事豁免0不变。

2026-10-02葬礼步骤：新增结构化Effect字段`undeadCreationProtection:{minimumPower:"wish"}`，通过合同校验、执行器提案、Headless效果创建和持久化。施加要求Host确认死亡且尸体存在，不能把0 HP昏迷当作尸体。选中含该效果的分支才获得死亡目标许可；其他典礼不继承。七天采用100800个六秒轮，战役时钟在10079分钟仍保护、10080分钟解除；暂停效果不提供保护。

原生操纵死尸/创造不死生物的准备与提交阶段均检查遗骸保护；扩展尸体召唤的Host快照、编译器和地图放置再次检查。批次任一受保护目标导致整批拒绝，输入状态、原尸体及未扣资源保留。5–9环扩展活动都不能绕过；普通升环与客户端名称不是祈愿术权限。混合尸体地图批次也验证原子拒绝，移除保护后原放置流程仍成功。此处没有实现祈愿术例外，不能据字段名称声称已完成。

v8部分包从原始典礼术稿另存修复葬礼分支，导出重导入后对两种控制归属的已确认生物尸体执行效果和commit，保留赎罪及圣水验证；归档在`ceremony-partial-v8/`，旧归档和原始稿保留，API调用0。初次导出测试误用`funeral`而原稿选项是`funeral-rite`，已校正，失败日志保留。最终`ceremony-funeral-export-final.txt`3文件34项通过；机制回归`ceremony-funeral-regression-final.txt`5文件212项通过，SDK说明28项通过，数量重叠不相加。最新类型检查终态另记于本段后续记录。

尚待葬礼遗骸物体施放选点、多尸体覆盖、祈愿术强度例外、真实完整双端，以及婚礼/他人或地图水瓶/连续施法。当前v8仍assisted、entryComplete:false，不计整条完成。全书仍49/155、106待验收，限定双端7条、叙事豁免0。

下一步定位证据：`CampaignTimeSystem.tsx`非角色Token效果推进在159行跳过obstacle。因此当前七天到期证据限定于角色/生物效果；不能把测试中手动附在遗骸物体的保护实例视作地图遗骸已经具备七天清理。遗骸物体施放接入时必须补地图物体权威计时，而不是仅写视觉标记或复用一个未推进的实例。

补充实际注册Headless活动证据：`ceremony-funeral-registered-route-r1.txt`26项通过，包含选中葬礼才接受已确认死亡目标、另一个分支拒绝死者、0 HP但未死亡者拒绝，以及未修改输入状态。此证据不是浏览器施法认证。生产变更的完整类型检查`ceremony-funeral-typecheck-final3.txt`终态退出码0；新增注册活动用例后最后完整复核`ceremony-funeral-typecheck-final4.txt`终态退出码0（会话98733）。所改生产文件diff空白检查通过。当前没有本轮遗留运行会话。

2026-10-02最新步骤：独立怪物也可记录当前与原始阵营。DM管理面板增加明确选择入口，Token持久字段`dnd5eAlignment`/`dnd5eOriginalAlignment`只接受九阵营，旧Token不猜测历史。Headless快照读取两项事实，赎罪恢复写回该Token当前阵营；即使HP/位置不变也不遗漏patch。地图迁移和重载保留事实。玩家投影移除原始历史，关闭怪物详情时另移除当前阵营；DM原始存档不变。怪物详情读取实例当前阵营，恢复后不再显示模板旧阵营。变形状态的显示仍优先保留该实例阵营。

`ceremony-monster-alignment-r1.txt`2文件30项通过，包含独立怪物真正的DC20检定/恢复/地图写回/重载及玩家投影检查，还有DM面板静态渲染。v7实际导出重导入后，对玩家控制和DM控制生物分别验证洞察失败与成功恢复，保留水瓶及银粉实际转换；`ceremony-monster-export-r1.txt`4文件59项通过。`ceremony-monster-regression-r1.txt`4文件124项通过；`ceremony-monster-server-projection-r2.txt`46项地图投影回归通过、131项其他测试未执行。数量有重叠，不相加。服务器投影r1命令选择未运行任何测试，634项跳过，不作为通过证据；随后用独立配置执行准确分组。

完整类型检查`ceremony-monster-typecheck-r1.txt`终态退出码0（会话85032）。v7归档仍为assisted及entryComplete:false，保留原稿和v1–v6归档，API调用0。尚无这批原始阵营管理按钮的真实点击证据，也未做完整持续施法及联合材料/阵营恢复浏览器事务；不据静态渲染或底层通过宣称完整双端施法通过。葬礼、婚礼、他人/地图水瓶、连续施法及完整双端仍待完成；下一步处理葬礼。

全书仍49/155、106待验收、限定双端7条、叙事豁免0。v7的局部证据和哈希已记录到固定155条账本。

2026-10-02最新步骤：赎罪在v6部分包中移除人工阵营恢复提案，改用`restore-original-alignment`。角色持久字段`dnd5eOriginalAlignment`须由DM明确记录（角色页增加DM入口），不从当前阵营猜测；规范化仅接受系统九个中文阵营值。玩家共享角色合并保留DM旧记录，并移除新上传玩家角色中的伪造记录。当前阵营与原始阵营不同且洞察DC20成功后，直接commit和编译插件都写回原始值并记录事件；历史缺失、无效或已恢复时在成本提交前拒绝。洞察失败正常完成执行，但不改阵营。

角色转Headless快照和地图结果写回已接入：恢复当前阵营后，即使HP等字段未改变也提交角色patch；原始记录独立保留，JSON重载及角色规范化不会丢失。合成事务验证直接/编译两条路线的成功、失败和拒绝成本；实际v6归档导出重导入后验证洞察19失败不改阵营、20成功恢复DM记录的原始值，同时保留圣水材料转换检查。本步未进行完整一小时施法、材料消耗与阵营恢复联合事务或真实浏览器网络认证。

证据：`ceremony-alignment-r2.txt`5项通过；`ceremony-alignment-regression-r1.txt`4文件150项通过；`ceremony-alignment-export-r3.txt`5文件44项通过。数量相互重叠，不相加。首次编译夹具缺少Host距离关系，补齐后通过；v6包夹具一人战斗被自动标记inactive，改为真正的双生物结算夹具后通过，保留r1/r2失败日志。第一次类型检查发现测试中可选characterPatches及服务端记录返回类型的错误，已修正；最终完整类型检查见`ceremony-alignment-final-typecheck.txt`终态。

v6归档`C:/Users/Doco/AppData/Local/StarsApp/local-import-tests/fullbook-entry-repairs-20260930-r1/ceremony-partial-v6/`，仍assisted、entryComplete:false。普通怪物的原始阵营编辑、葬礼、婚礼、他人/地图水瓶、连续施法及完整双端尚未完成；原书法术不限角色目标，因此不能把当前角色链路当赎罪完整认证。固定全书仍49/155、106待验收、限定双端7条、叙事豁免0；付费API调用0。

最终完整类型检查`ceremony-alignment-final-typecheck.txt`已确认终态退出码0（会话93057）。归档哈希与当前局部证据已写入固定155条账本，保留旧v1–v5归档及失败日志。

2026-10-02最新步骤：赎罪增加仅在所选典礼触发的施法者感知（洞察）DC20检定。`ability-check`、`skill-check`及`concentration-check`声明`appliesWhenChoice`，规范校验、执行器、共享/逐目标骰子配方、触发投骰、普通法术/特性Host入口和Headless权威配方按同一选择处理；非赎罪分支不请求或要求洞察骰。特性Host补传实际payload选择，避免骰子声明忽略已选分支。非法gate的选项数组现在不会使校验器抛出异常。

v5部分包实际导出重导入后，赎罪选项声明DM确认“阵营曾被改变”和目标控制者确认自愿；检定只读取施法者洞察加值。当前独立包夹具施法者WIS16，d20=16得到19失败、d20=17得到20成功，目标WIS30不改变结果。失败无恢复提案；成功仍保留显式人工恢复边界，因为原始阵营历史与权威恢复尚未实现。不能宣称赎罪已经完整自动化。合成已安装Headless动作另验证选择不同分支时是否请求骰、成功/失败效果，以及缺骰和未知选项拒绝；该合成效果为治疗，不作为实际阵营恢复证据。

最终本步`ceremony-atonement-final-r1.txt`6文件125项通过，包含实际v5包、共享/逐目标骰、条件触发骰、执行器与转换SDK说明。第一次包夹具遗漏Host投骰模式，`ceremony-atonement-export-r1.txt`保留失败证据，补充权威模式后通过。旧v1–v4包与原始转换稿均保留；付费API调用0。v5包仍assisted、entryComplete:false。最终类型检查见`ceremony-atonement-final-typecheck.txt`，以终态确认。

当前仍49/155、106待验收、限定双端7条、叙事豁免0。下一步是原始阵营的权威记录/恢复，而非将成功检定误记为赎罪完整完成；葬礼、婚礼、其他持有者/地图水瓶、持续施法及真实完整双端也待完成。

最终完整类型检查`ceremony-atonement-final-typecheck.txt`已确认终态退出码0（会话32966）；早先检查会话30641也以0退出。全部本步进度与v5归档哈希已更新到固定155条账本，完整条目计数不变。

2026-10-02最新步骤：祝福圣水增加永久物理转换分支。`alter-inventory-item`声明`permanent:true`时不绑定临时效果，不保存可恢复快照；Host仍校验原模板、实例、物主、数量和库存版本。拒绝过期、已释放、以太、效果绑定、容器和充能/同调物品，避免把临时或不可用物品变为永久库存。既有可逆转换继续使用实际来源效果。

v4部分包保留v3资格、历史和材料配置，新增实际“一瓶水”库存模板及祝福圣水选项转换。实际导出重导入后，所选两瓶水中的一瓶变为原生圣水，同时扣除一份25gp银粉；剩下一瓶水及一份银粉。JSON重载、角色规范化与效果清理后圣水保留。合成Activity另验证转交后的永久保留、旧事务重放拒绝、材料先暂存扣除后的原观察版本结算和非法状态拒绝。限定为施法者库存中的水，其他持有者或地图水瓶尚未接入。

本步日志：`ceremony-water-partial-r1.txt`4文件129项通过（该配置未包含日志目录的包测试，不作为包验收证据）；`ceremony-water-export-r2.txt`使用专用配置包含实际v4包，4文件70项通过。首次测试夹具误把校验返回数组当结果对象、按转交前实例ID查找普通转交后物品，两处已修正，失败日志保留。`ceremony-permanent-inventory-r1.txt`另记录pluginSpellTransaction中Passwall、Knock、Arcane Lock三项`spell-not-headless`失败，旧基线未建立，不宣称已解决。最终类型检查记录在`ceremony-water-final-typecheck.txt`，须以终态退出码确认。

最终完整类型检查`ceremony-water-final-typecheck.txt`已确认终态退出码0（会话25876）。早先机制类型检查`ceremony-permanent-typecheck-r1.txt`也已确认退出码0（会话70828）。70与129项检查有重叠，不合计为199项独立案例。

v4归档：`C:/Users/Doco/AppData/Local/StarsApp/local-import-tests/fullbook-entry-repairs-20260930-r1/ceremony-partial-v4/`。原始转换稿及v1–v3归档不改；仍为assisted、entryComplete:false，无付费API。赎罪、葬礼、婚礼、一小时连续施法/接触范围和真实完整双端尚未验收；全书仍49/155完成、106待验收，限定双端7条、叙事豁免0。

当前全书进度仍为49/155本地验收，106待验收。典礼术未完成，不计入完成数。

原转换配置把24小时写为1440个六秒轮，实际仅2.4小时；已另存为14400轮。成人礼和献身奖励骰原来使用后删除效果，现已支持 `consumeOnUse:false`，每次对应检定可以选择使用，保留至原期限到期。规范校验、实例持久化、执行器和Headless消费通路均保留该字段；状态提示区分一次性和持续奖励。

`.codex-logs/ceremony-partial-r1.txt`记录6文件110项通过，覆盖部分配置导出重导入，以及独立测试效果在属性检定、持续区域豁免中的重复使用、非法骰拒绝和战役时间24小时到期。独立测试效果不是完整典礼术施法验收，不证明其他典礼已实现或玩家端完整施法流程已通过。原始转换稿保持不变，付费API调用为0。

部分归档位于本机 `C:/Users/Doco/AppData/Local/StarsApp/local-import-tests/fullbook-entry-repairs-20260930-r1/ceremony-partial/`，仍标记assisted和entryComplete:false。

状态提示补充6项检查通过：`.codex-logs/ceremony-presentation-r2.txt`。第一次使用不包含该文件的配置被过滤为“无测试文件”，日志保留，不计为通过。此前类型检查捕获的测试夹具无效saving-throw动作已修正，改走实际持续区域豁免入口；修正后的类型检查`.codex-logs/ceremony-bonus-retention-typecheck-r2.txt`退出码0。最终状态提示变更完整类型检查`.codex-logs/ceremony-final-typecheck.txt`退出码0。

尚待实现和验收：成人礼与献身的资格及永久受益历史；赎罪的阵营恢复；圣水物品转换；葬礼的复活为不死生物限制；婚礼的配对距离护甲及丧偶历史；一小时施法、材料消耗及期间范围校验；实际导入学习施法和双端闭环。不能把这些机械行为归为纯叙事豁免。

## 永久受益历史步骤

新增 `establish-spell-authority` 的 `benefit-history` 类型，记录保存到受益者。实际commit和编译插件入口均通过24小时效果到期、保存重载、不同施法者重复同种典礼拒绝且状态/动作不变、另一种典礼独立接受的检查；`ceremony-history-r3.txt`3项通过。首次夹具遗漏速度字段，修正后编译插件夹具遗漏Host距离，均保留失败日志，未算成功。

v2部分包另存至 `ceremony-partial-v2/`，原v1保留；两种奖励分支已经附带历史写入操作，导出重导入1项通过（`ceremony-history-export-r1.txt`）。包继续标记assisted、entryComplete:false，不能由此声称真实典礼术已经完整施放或通过双端。

历史按模块ID和benefitKey隔离；同一包更换施法者不能绕过，不同模块ID的重复包全局去重仍需处理。成人礼与献身的年龄、信仰服务和意愿资格，以及四种其他典礼、施法期间和消耗、完整包及双端仍待完成。当前完成数49/155不变。

当前5文件121项检查全部通过（`ceremony-history-r4.txt`），另有v2导出重导入1项通过。多目标中任意已受益目标导致整次拒绝，在前序目标上也不写入奖励或历史，动作不消耗。完整类型检查`ceremony-history-typecheck-r2.txt`退出码0；首次类型失败为已修正的测试夹具缺字段。

新增多目标用例后的类型复核发现测试代码对联合类型的target字段未收窄（`ceremony-history-final-typecheck.txt`），已修正；最终4项历史用例复验通过（`ceremony-history-final-r1.txt`），最终完整类型检查`ceremony-history-final-typecheck-r2.txt`退出码0。

## 资格与材料步骤

生物目标新增requiredQualifications，可按选项覆盖目标合同。成人礼由DM确认刚成年，献身由目标控制者确认自愿接受并愿为神明服务；两者均要求Host已知humanoid类型。年龄和信仰不由名字猜测。法术和特性实际Host入口采集确认，编译执行器使用仅在Host内存中存在的凭据，绑定施法者/模块/规则动作/事务/选项；伪造payload、串用其他事务、取消或未知类型拒绝，不产生资源或效果写入。独立command上下文在客户端command之外提供。真实双端交互尚未验收。

v3部分包保存两种资格声明和明确的消耗银粉标签/最低25gp规则价值，另附带可登记库存的一份25gp银粉模板。原v1/v2目录保留。直接使用当前v3导出内容重导入注册后检查材料：缺材料、只有材料包、错误标签、低价值、摧毁、以太状态、过期均拒绝；正确银粉实际分配一份，重载后只消耗一份，旧库存版本重放拒绝。材料测试实际发现已摧毁物品被计入计划，已修复准备及结算共有校验，并测试以太物品不可用。按包内原施法时间计算普通60分钟/仪式70分钟，未据此声称完整持续施法已经实现。

`ceremony-qualifications-final-r1.txt`7文件60项通过，包含当前v3导出重导入、私有凭据和实际编译动作拒绝/通过、command回归及材料回归。失败日志保留：最初引用了错误的目标选择辅助函数，随后编译动作夹具缺显式距离；材料新分支发现摧毁状态未过滤。均已针对原因修复。

当前部分包目录ceremony-partial-v3仍标记assisted、entryComplete:false。还缺另外四种典礼、跨不同模块ID的历史策略、一小时期间范围和接触校验、实际完整施法/资源/耗时保存与双端及全书验收；本地49/155、106待验收不变。

资格和材料代码的完整类型检查`ceremony-qualifications-final-typecheck.txt`退出码0。转换SDK说明同步加入requiredQualifications的声明类型、事实确认与Host凭据边界、benefit-history以及consumeOnUse:false和24小时换算；没有调用模型API。

转换说明回归发现四项内联依赖定义遗漏：Dnd5eMapObjectFlightLimits、TerrainClearing、Dnd5eEntityDestructionTerrain和Dnd5eAbilityCheckRule。已补充声明，未向生成器暴露私有资格授权函数；检查改为一次报告所有缺项，保留原有同等完整性断言。`ceremony-sdk-guide-r4.txt`28项通过；r1–r3失败日志保留。最终SDK变更完整类型复核`ceremony-qualifications-sdk-final-typecheck.txt`退出码0。
