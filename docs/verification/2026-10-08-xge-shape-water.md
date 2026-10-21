# 操水验收（进行中）

原始条目 :165:3。当前仍为reference-only，尚无可执行Activity。

规则校正依据：https://www.dndbeyond.com/spells/2397-shape-water 。选择水体须能容纳在边长5尺立方体内，原稿“5立方英尺”存在体积翻译歧义，保留原稿并在修复配置中纠正。

已实现controlledWater纯状态处理，并以4项本地测试覆盖三维5尺移动、尺寸限制、持续效果上限2项、独立施法者、精确一小时到期、冻结的明确无生物要求、透明度/颜色基值恢复、解消归属、JSON恢复、重复action及非法参数。

尚未完成：地图显式水体和范围选取、较大水体子区域处理、流向模式、Host几何与生物占用来源、Activity与动作消耗、地图持久化及共享、跨地图两项上限、效果渲染、导出重导入和实际双端。不能凭helper测试计为可施放或整项通过。正式91/155不变。

## 持久化边界

水体状态已加入地图obstacle字段，浏览器与服务端共用严格校验。15项本地测试通过，覆盖真实服务端校验及玩家投影后JSON重建、归属/到期/收据不丢失、损坏记录拒绝，并包含原火焰持久化回归。仅证明数据边界，不证明实际网络施法或UI渲染；尚未有Activity施法入口。最新类型检查运行中，正式91/155不变。

## Host水体资格

新增实际地图水体资格采样，使用实时多边形与高度，提供可见性、表面中心距离、生物足迹/体积交集；损坏ID及整体超大水体拒绝。10项相关本地测试通过。当前仅整块已标记水体，较大水体局部选取尚待，接口也未接Activity或UI。移动/改变流向沿用即时操作语义，不应添加永久魔法水流。

## 大水体局部选取

可指定不超过5尺各维的子范围，裁剪原水体多边形及高度，浅水或岸边不生成额外水量；返回独立footprint，生物占用只检查交集。12项相关本地测试通过。局部结果的持久化拆分和对同源效果的去重尚未接通，因此不能将选择结果直接覆盖整片水体，也未开放施法。上轮类型检查通过但早于此改动，后续接线后统一检查。

## 局部水体分割

新增纯分割函数，按XY区域和Z范围输出选中与剩余棱柱，保留总水量、不重叠并继承既有效果。持续效果跨片段按唯一effectId计一次，一次解消清除所有本人片段而保留其他效果。15项相关测试通过，包含凹岸、125立方尺、JSON及总体积守恒。尚未接入Activity提交、跨片段重新选取和物理/渲染投影；类型检查运行中。

## Host地图持续效果提案

新增地图适配，将同源水体分片选择、占用与可见性、分割及shape/appearance/freeze/dismiss合成geometry提案。sourceWaterId在重载后保留，分片可以重新选为同源水；按全部地图计2项，解除覆盖全部本人片段。18项相关测试通过。此函数没有自行保存或扣动作，尚未接Activity；移动路径、冻结碰撞/渲染、用户操作和实际双端仍未完成。

## Activity声明与Headless提案

control-map-water声明和两条Headless路径已接入，严格拒绝伪造占用字段等非法声明。23项相关测试通过。当前仅产生地图操作提案，MapInteraction在提交适配尚未完成时明确拒绝，因此尚不可实际施放。暂不提供可导入完成包，不将结构化提案通过视为施法自动化通过。最新类型检查运行中。

## 地图交接适配

2026-10-08 操水地图交接2：MapInteraction替换统一拒绝为Host水体选区提案，change取自已声明operation；仅支持可提交结构的调用方，多图解除额外要求supportsOtherMapGeometryCommit。返回当前structureGeometry及其他地图otherMapGeometryUpdates，混合其他geometry写入拒绝，避免整图覆盖丢失。ActivityWater两条真实Headless路径继续接MapInteraction：冻结、占用拒绝、选择缺失、能力缺失、远图解除及外人解除拒绝、输入不变。shape-water-map-handoff-r1 session20991 terminal exit0，6files23tests（增强现有用例）。此前typecheck-r6 session80236 terminal exit0；r7 session20860运行中。页面批量保存与选区UI、移动和冻结物理/视觉仍未完成，不计完成。正式91/155、64待、限定双端43。

## 跨地图批量提交

2026-10-08 操水批量提交3：mapGeometry store增加applyAuthorityMapReplacements，先归一化及关系校验所有地图，拒绝重复mapId，单次set写入且不独立发布、不加编辑器历史；旧单图入口复用。法术/特性两条页面分支接收otherMapGeometryUpdates并开启跨图能力，计入includeMapGeometry随原结算提交。新增store回归验证无效批次输入不变/无通知、重复拒绝、成功单次通知及复制隔离；r1/r2失败为fixture假设修正（不存在实体会被规范化清除、已有map-1应保留），r3 session95441 terminal exit0，7files37tests。typecheck-r7 session20860 terminal exit0；r8 session33987仍运行且启动后仅修测试断言，不是最终整体验收。水体选区UI、移动、冻结物理/渲染和实际双端仍待，尚无完成包。正式91/155、64待、限定双端43。

## 共享选择入口

2026-10-08 操水选择入口4：新增controlledWaterSelection，以地图区域生成Host合格水体候选，单一水体直接选用，多候选或解除使用现有共享选择窗口；同源分片和同一效果去重，只列本人的有效效果，返回后重新采样资格，取消/伪造/过期拒绝。MapsWorkspacePage法术与特性两条路径接requestActivityWaterSelections并传watersByOperationId，选区中心和尺寸来自areaPlacement，未使用坐标输入。shape-water-selection-r1 session99820 terminal exit0，8files39tests，覆盖唯一候选免弹窗/缺区域/伪造/目标消失/跨分片去重/本人及到期/取消。typecheck-r8 session33987 terminal exit0；r9 session15166新启动待终态。入口尚未浏览器验收；四模式完整配置、移动、冻结物理/渲染与地图水体创作入口仍待。正式91/155、64待、限定双端43，未计完成。

## 水体显示

2026-10-08 操水显示5：新增ControlledWaterSceneLayer并接入MapCanvas，按原始多边形绘制颜色/透明度和冻结边界，形状说明作为字面文本；使用现有Token可见性过滤且在后续迷雾层之前绘制。到期直接project原始水体外观、不改持久数据。render-r1退出0，7files22tests，覆盖坐标一致/冻结与改色/到期恢复/输入不变/墙后玩家不可见而DM可查。此为React节点及可见性测试，尚未浏览器视觉验收；形状动画、冻结物理、移动、四模式配置和水体创作入口仍缺，不能称完整操水术。typecheck-r9 session15166 terminal exit0（选择UI）；r10新启动待终态。正式91/155、64待、限定双端43不变。

## 冻结碰撞

2026-10-08 操水冻结碰撞6：mapGeometryMovementBlocked/PlacementBlocked/VolumeMovementBlocked新增临时冻结水体投影，查询时blocksMovement而不改保存geometry；显式worldMinute优先，否则由campaignTime注册读取当前已同步房间时间，未同步时对仍存冻结记录保守阻挡。冻结按真实底高/厚度，顶部上方不误挡，到期/解消恢复原始通行。physics-r1 session88477 terminal exit0，8files24tests；physics-regression-r1 session33224 terminal exit0，3files47tests（地图基础与场景时钟）。覆盖三种查询、5尺顶上通行、到期/解消/不改输入/实时读时钟与未知时间。未涵盖自动登上冰面、水体移动、冻结视线/材质等其他投影；尚未真实双端验收。typecheck-r10 session73727 terminal exit0；r11 session63058运行中。正式91/155、64待、限定双端43不变。

## DM 水体创作

2026-10-08 操水水体创作7：MapGeometryToolbar障碍多边形增加ControlledWaterFields，DM明确标记水体，底高/高度代表水底/水深，按地图比例生成真实位置尺寸，颜色/不透明度可编辑；零深度/无效多边形/比例不允许创建。标记时取消固体阻挡与地表标高，普通贴图不推断为水。authoring-r1 session54877 terminal exit0，9files26tests：真实比例及JSON保存、输入不变、非法尺寸、默认未标记、零深度提示及编辑字段。未跑浏览器实际创作或双端；取消标记不恢复此前固体参数，属于取消水体身份保留当前几何设置。r11 session63058仍在运行（早于本批创作改动），最新创作代码类型检查待其终态后运行。水体移动/形状动画/完整配置与全流程验收仍待。正式91/155、64待、限定双端43。

## 局部水体移动

2026-10-08 操水移动8：control-map-water扩展move displacementFeet，声明严格校验三轴有限值/额外字段/非零且长度<=5。地图适配沿用局部分割，仅平移selected的几何及保存位置，余水不动，维持水量及既有持续效果，记录动作收据，不新增限时移动效果、不改Token或HP。路径由Host volume movement检查，选中部分剔除后检测其他障碍，越界拒绝。move-r1 session14274 terminal exit0，9files43tests，新增3-4-5三维平移/125选水与2000总量/JSON/无源修改/撞墙及超距拒绝。路径目前用各凸片包围方柱，窄通道可能保守拒绝，需后续精化；不等于完整流体或重力实现。UI尚无方向选择，形状动画及四模式完成包/双端验收仍待。r11 session63058 terminal exit0；r12 session84535运行中（含创作入口及本批移动）。正式91/155、64待、限定双端43不变。

## 玩家输入

2026-10-08 操水输入9：Dnd5eWaterIntent增加受校验promptForChange，仅move/appearance/shape允许；页面共享窗口收集三轴位移、颜色/不透明度、形状文字，resolveControlledWaterInput严格校验并输出去提示标记的实际change，MapInteraction拒绝未解析prompt，防占位值落地。input-r1 session48400 terminal exit0，10files45tests，新增3-4-5位移、超距/无限/空值/零移动拒绝、颜色透明度及字面形状、不跨模式。typecheck-r12 session84535 terminal exit0；r13 session79752运行中。尚无完整四模式修复配置/导入包或双端UI验收；形状动画、路径窄通道等限制未解决。正式91/155、64待、限定双端43，不计完成。

## 候选归档与导入模式验证

2026-10-08 操水候选包10：私有shape-water-candidate-r1/candidate.starmod已生成，SHA f54c8aecc19e31af54047c858b3d19ded869ea23dc2cdd5d052ea9f05585b778，namespace local.xge.candidate.shapewater1；四模式+解除，后者targetOverride self无需圈区域。原始source :165:3及整稿SHA未变，manualContentRepairs记录，明确entryCompletefalse。package-r1 session64960 terminal exit0，导出重导入与2次独立注册通过；成功writer不得重跑。imported-modes-r1 session15495 terminal exit0，读取该归档逐一5模式经resolve/commitHeadless：每次单一对应地图提案及消耗一次动作、原战斗state不变。此测试未解析prompt或提交地图，不代替全流程验收。typecheck-r13 session79752 terminal exit0，当前无live进程。形状动画、窄通道等及实际双端仍待；正式91/155、64待、限定双端43。

## 冻结模式实际双端

2026-10-08 操水双端冻结11：隔离7273/7274新房间，候选r1实际UI导入、空戏法选择玩家学习、圈选水体冻结。首轮session78238 terminal exit1，invalid-target：pluginSpellTransaction.activityPermitsEmptyArea遗漏control-map-water，已补该操作允许无生物选区。重跑r2 session87442 terminal exit0，1passed1.6m；DM与玩家都有冻结数据及Konva冰面节点，施法者归属和160到期值正确，两端reload保留。已实际查看shape-water-freeze-player.png，5尺格边界位置正确，水体存在分片对角边线视觉问题待改善。result fullSpellAcceptedfalse：仅冻结模式探索态，未覆盖战斗动作/取消、外观/形状/移动/两效果上限/解除/到期；作者水体为fixture不是DM创作UI。当前无live进程。包SHA及原稿不变，未计条目完成；正式91/155、64待、限定已验收条目双端43。

## 解除与外观实际双端

2026-10-08 操水双端解除改色12：shape-water-dismiss-appearance-r1 session60358 terminal exit0，1passed2.1m。候选r1真实导入学习冻结并双端reload后，玩家选择解除（self override，无区域圈选），共享窗口只列本人冻结效果，提交后两端冰面节点清零。随后圈原同格，通过共享字段输入#ff0000与0.8，两端持久数据一致且reload后Konva颜色透明度匹配；已查看玩家截图，仅原选格为红色。该用例沿用旧freeze标题但实际覆盖解除与改色，result fullSpellAcceptedfalse；仍探索态非战斗，移动/形状动画/上限/到期与跨图解除完整UI待。没有修改产品或重新打包，本次无live进程。正式91/155、64待、限定已验收双端43不变。

## 移动实际双端

2026-10-08 操水双端移动13：shape-water-move-browser-r1 session1903 terminal exit0，1passed1.5m。候选r1真实导入学习、玩家圈5尺水块，共享字段填x=-5,y=0,z=0并提交，DM与玩家均得到移动片段x300..350、125立方尺，余水留原处、总1500；移动不生成alterations，两端reload保留。已查看玩家截图，原选格空出、左邻格出现水。result fullSpellAcceptedfalse，仅平地水平移动探索态；不覆盖窄通道、任意方向/高度的真实UI、自然流动、战斗/取消。当前无live进程，无产品改动。形状动画/上限/到期/跨图等仍待。正式91/155、64待、限定已验收条目双端43不变。

## 持续上限与到期双端

2026-10-08 操水双端上限到期14：cap-expiry-r1 session59176 terminal exit0，1passed。沿真实导入学习/冻结/解除/改色链路，再输入形状“游动的小鱼”，DM和玩家显示同描述且按唯一effectId计2。第三次冻结被拒绝，服务端maps全值等于拒绝前，没有部分冻结。DM正式campaign-time mutation推进60分钟，两端形状描述消失、所有液态节点恢复基础#268fbc/0.45，reload仍无形状。仅形状文字不是动画，result fullSpellAcceptedfalse；战斗动作/取消、跨图及窄通道等完整验收仍待。本次无产品改动，无live进程，未计条目完成。正式91/155、64待、限定已验收条目双端43。

## 实际轮廓移动

2026-10-08 操水真实轮廓15：mapGeometryVolumeMovementBlocked增加可选凸footprint，普通方形移动保持原算法，水体分片传入真实多边形，使用全部边法线与墙段法线做连续分离轴检测，垂直体积内部探测也采用真实顶点。footprint-r1 session91961 terminal exit0，3files49tests；footprint-integration-r1 session26487 terminal exit0，10files47tests。新增细长水体窄通道通过/转向穿墙拒绝、三角空角不误碰撞/真正穿墙仍拒绝。仍有forceShell外壳使用原包围盒路径（此项未变，不宣称全部形状精确），本批尚未新增浏览器路径验收。r14 typecheck session36107运行中。形状动画/战斗取消等仍待，正式91/155、64待、限定已验收双端43不变。

## 战斗动作与取消

2026-10-08 操水战斗取消16：combat-r1 session73202 terminal exit0，1passed2.1m。实际导入学习后设置隔离active combat fixture并reload（未通过UI掷先攻）；玩家改色窗口取消、空选区冻结拒绝，两次均动作1且服务端maps等于此前；有效冻结真实施放成功，战斗turn economy new-token.action.current=0、UI动作已用完，DM玩家reload保留冻结。result fullSpellAcceptedfalse，不宣称全部模式战斗验收；形状动画/跨图解除等仍待。typecheck-r14 session36107 terminal exit0，当前无live进程，无产品改动。正式91/155、64待、限定已验收双端43不变。

## 跨地图解除双端

2026-10-08 操水跨图解除17：remote-r1 session73820 terminal exit1，实际远图解除已成功但本地图全值比较仅updatedAt不同；修正测试只排除保存时间，不改产品。r2 session84644 terminal exit0，1passed1.6m：真实导入学习后，对fixture远图本人冻结发起玩家解除，两图水体同ID，远图效果持久清除，本地图除保存时间外逐值不变，两端reload后远图alterations=0。remoteEffectSeededtrue，不宣称实际跨图移动流程。无live进程；形状动画及完整条目审计/累计包仍待，正式91/155、64待、限定已验收双端43不变。

## 自由形状笔画数据

2026-10-08 操水自由形状笔画18：复用SurfaceDrawingInput并扩展共享PluginChoiceField surface-drawing，严格长度/笔画点数/范围/颜色/宽度校验；normalizeSurfaceDrawing迁到shared单一实现，原TS接口保持。shape可带drawing，resolveControlledWaterInput和shared water持久化保留且拒绝非法笔画，Activity校验允许合法drawing；绘图回调用ref避免父组件闭包更新反复触发effect。drawing-r1 session28087 terminal exit0，11files55tests，含JSON保留与损坏拒绝及原绘图回归。尚未在操水窗口启用绘图字段、未接图案空间帧/分片裁切/动画，不能宣称形状动画完成。typecheck-r15 session86718运行中。正式91/155、64待、限定已验收双端43。

## 绘制图案裁切与动画

2026-10-08 操水图案坐标动画19：shape窗口启用可选surface-drawing字段；Host为每次绘制设置共享drawingFrameFeet，所有选中分片保留同一帧，JSON规范化保留且验证范围，移动只平移选中片对应效果帧。ControlledWaterSceneLayer按真实片多边形裁切图案，新增Konva轻微漂移动画，冻结时停止并归位，到期投影移除。drawing-frame-r1 session52131 exit1为测试选区只落单三角，改选跨三角中心后r2 session98051 terminal exit0，11files56tests，跨片统一帧/JSON/移动帧通过。尚未浏览器绘制/动画/刷新验收；动画只是玩家画出的2D水体图案，无自然语言自动生成形状。typecheck-r15 session86718 exit0；r16 session83397运行中。正式91/155、64待、限定已验收双端43不变。

## 双端绘图与类型修复

2026-10-08 操水双端绘图20：drawing-browser-r1 日志确认 1 passed (1.9m)，原 session38630 已不存在；result确认实际导入、玩家学习施放、DM提交、两端图案动画与刷新恢复，已查看玩家截图。typecheck-r16 session83397 terminal exit1，定位动画Effect清理返回Konva.Animation而非void，已改为块体停止动画；r17 session38370仍运行。整条尚不计通过，正式91/155、64待、限定已验收双端43。代码审计另发现：水体选择读取实时场景，但后续MapInteraction使用先前pluginApplication.map；现有movementAuthorityUnchanged仅保护物体投掷/移土且在水体异步窗口之前检查。需补操水窗口等待期间场景变化的拒绝与回归，再完成累计包验收。付费API调用0。

## 选择等待期间权威场景变化

2026-10-08 操水过期场景保护21：r17 typecheck session38370 terminal exit0，动画清理类型错误已修复。法术/特性两条主结算路径在全部异步选择后、MapInteraction前增加mapWaterChanges的movementAuthorityUnchanged检查，场景变化拒绝water-selection-stale，避免使用旧Token位置/视野/占用；复用既有权威快照方法。authority-r1 12项本地测试通过（覆盖异步期间位置、遮挡、时钟、资源等变化；不是实际浏览器并发用例）。drawing-browser-r2 session91148 terminal exit0、1passed1.9m，实际导入学习绘制施放、两端动画与reload仍正常，未误拒绝。r18 typecheck session23434已确认terminal exit0，含本次权威检查修改。当前无live测试进程。后续仍须实际并发拒绝验证、完整规则审计和累计包导出重导入；不能把上述局部结果计整条完成。正式91/155、64待、限定已验收双端43；API0。

## 并发拒绝与累计候选

2026-10-08 操水并发与累计候选22：stale-browser-r1 session61615 exit1，过期请求已正确拒绝、水体未变，但角色比较包含DM推进时间产生的正常dnd5eWorldTimeAppliedMinute=101；测试改为推进时间同步后、提交回答前取角色基线，未改产品。r2 session82220 terminal exit0、1passed1.6m；真实玩家形状窗口等待期间DM推进1分钟，收到water-selection-stale，地图/角色无施法额外改动，两端reload无效果且时间101。范围是探索态时钟变化，非所有并发组合。累计候选shape-water-cumulative-candidate-r1写入成功（writer61961 exit0，不可重跑），SHA7e28ea81ce6e8e0e86ab6caba1aa24127ef2e85b36862aa4c09f0e535148b39f，namespace local.xge.repaired.shapewater62；75法术10专长7特性共92候选，原91定义重定位后逐值相同，roundtrip及2独立注册通过；entryCompletefalse，acceptedCount91。final-modes-r1 session62727 exit0，累计包5模式各1提案/1动作通过（尚非地图提交）。累计包实际导入/学习/绘制/双端刷新测试final-browser-r1 session46810运行中，须等终态。正式91/155、64待、已验收条目限定双端43；API0。

## 累计包双端与归档审计

2026-10-08 操水累计包实际双端23：final-browser-r1 session46810 terminal exit0、1passed1.9m；累计92候选包真实UI导入/玩家学习操水/绘图施放/DM提交，两端有动画，reload恢复；已查看玩家截图。当前无live测试进程。原始:165:3文本复核与controlledWater本地测试逐项对应：30尺可见与5尺选体、3D移动<=5尺无伤害、形状与外观、无生物才冻结、1小时到期、每施法者跨图最多2效果、1动作解消；本地及既有多轮双端证据已覆盖主要结算。仍未将候选晋升正式：候选draft.unsupported包含早期已过时的待验收说明，需在最终归档中校正并保持运行定义一致，形成明确验收范围/限制与证据清单后再更新ledger。水体依赖DM显式标记；形状是玩家绘制的2D动画而非文本生成3D模型；不宣称流体动力学仿真。正式91/155、64待、限定已验收双端43不变，API0。

## 正式归档

2026-10-08 操水正式归档24：final-package-r1 session67232 terminal exit0，原91定义不变、最终运行content与累计双端已测r1逐值一致、重导入及2独立注册通过。r2 SHA4ad9c5362d8b776df1d0fdfd8397c2408e1d69f185d5fc2e034ee42fbe4a3ef4；record-shape-water-final.mjs已成功执行，成功writer不得重跑。正式ledger92/155、63待、限定实际双端44，archive repaired-entries-batch62.starmod，75法术10专长7特性。shape-water-final/acceptance.json列明模式、生命周期、战斗/并发、累计包证据与限制；水体需显式标记、图案为2D绘制动画、无流体动力学、forceShell保守碰撞及中心视线模型如实记录；不宣称全书通过。原始转换稿SHA未变，API0，当前无live进程。
