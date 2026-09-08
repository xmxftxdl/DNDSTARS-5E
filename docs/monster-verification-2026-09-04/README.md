# 全目录怪物验证 · 2026-09-04

已为全部 **334 只怪物**建立独立报告。该目录按实际证据生成；目录批次已完成，组合场景的覆盖边界见下文。

UI 当前结果：passed 330；inspect-only 4。

## 修复与验证

- 鲁莽攻击改为主动选择；修复玩家攻击鲁莽怪物时，UI 预掷骰及通用 Headless 武器入口遗漏优势的问题。
- 修复底栖魔鱼触手被旧安全名单重新降级的问题；触手疾病改为每次命中独立结算的持久效果，多重攻击恢复 Headless。
- 修复患病巨鼠与两类木乃伊的每 24 小时生命值上限恶化；验证持久化、重复同步和解除后的恢复。
- 修复吸血鬼形态非法传奇攻击；克拉肯闪电风暴改为恰好三束的 Headless 分配，支持重复目标、逐束豁免与独立 4d10 伤害。
- 修复克拉肯与紫虫等吞咽动作的关系生命周期、体内外全掩护、周期伤害、反刍和来源死亡脱离；修复木乃伊领主沙旋风的 60 尺传奇移动及窗口内伤害／状态免疫。
- 修复魔宠人偶啃咬：普通失败中毒 1 分钟；失败 5 点或更多时额外掷 1d10 分钟，同时中毒和昏迷，并在受伤或被唤醒时结束昏迷。
- 修复梦魇兽以太步行：新增原文允许的零乘客“仅自身”Headless 分支，自动结算位面切换与跨位面抑制；携带至多三名自愿生物的完整分支仍由 DM 裁定。
- 修复普通怪物 Headless 传送的控制栏落点入口；闪现犬新增“不啃咬、仅传送”分支，自动检查 40 尺、可见、空位、地图几何、动作与充能。
- 补验紫虫尾部螫针、部落战士双手长矛和守卫双手长矛的真实 Headless 战斗 UI；三个场景均完成伤害、动作消耗与双端日志同步。
- 修复怪物橡棍术：树精／德鲁伊会创建绑定武器与施法属性的持续效果，强化攻击只在效果有效时开放；树精已通过 7073/7074 双端真实 UI 的禁用、解锁、伤害与日志同步验证。
- 修复奥术之手切换持续指令时错误终止自身专注；修复具体法术卷轴缺失图标回退。
- 修复冻寒之触对亡灵的来源专属劣势在部分 Headless 攻击入口未生效；覆盖普通／怪物武器、法术与逐束攻击。
- 修复玩家移动提交后的未定义变量、专注详情的变量初始化顺序、移动登录 token 恢复及跨房间迟到响应问题。
- 同步反魔法易感 schema；修复依赖审计的旧版本硬约束及失败处理。构建的类型/架构阻断另行跟踪，不能据此宣称可发布。

## 环境与证据

- DM `http://127.0.0.1:6973`，玩家 `http://127.0.0.1:6974`；使用独立数据和缓存目录。
- 底栖魔鱼修复后的多重攻击专项另用 DM `7073`、玩家 `7074`，避免修改旧的全目录验证快照。
- 树精橡棍术专项复用 DM `7073`、玩家 `7074`，保存了施法前禁用、施法后效果字段、攻击伤害和双端日志证据。
- 克拉肯闪电风暴专项复用 DM `7073`、玩家 `7074`，保存了三束重复目标分配、生命值变化和双端日志证据。
- 克拉肯吞咽、木乃伊领主沙旋风、魔宠人偶啃咬、梦魇兽仅自身以太步和闪现犬仅传送专项复用 DM `7073`、玩家 `7074`，保存了关系、移动窗口、状态持续时间、位面／落点字段和双端日志证据。
- 紫虫、部落战士和守卫的旧只读 UI 记录已在 `7073/7074` 以当前源码补跑为实际战斗通过；总表以专项证据覆盖旧快照状态。
- 目录数值矩阵通过真实 Headless 公共入口结算；端到端测试通过实际网页按钮和目标选择操作。场景夹具只负责初始数据。
- UI 原始 JSON、通过截图、失败截图和只读后台观察记录保存在 `.codex-temp/monster-verification-20260904/`。
- 本目录保留每怪物的精简证据 JSON、字段路径及报告，避免只依赖临时日志。
- `ui-execution-order.json` 固化本轮真实 UI 的执行顺序：先按 CR 从高到低，同 CR 再按名称排序。
- 不以资料里的 Headless 标签证明 UI 已连通；不将 DM 裁定能力自动计为实现缺陷；不将测试夹具/热更新失败直接认定为产品 bug。

## 最终检查

- 全目录审查基线 Vitest：9688 通过，0 失败，0 跳过／待定；本轮新增改动均另跑对应目录、运行时与 UI 验证。
- 根目录 TypeScript 检查和本任务相关 ESLint 已通过。标准 build 仍会被 13 项架构预算拦截，详情见 `WORKLOG.md`。

## 复跑

先使用独立共享目录启动上述两个服务，运行目录测试生成清单，再生成场景夹具。端到端测试会覆盖该隔离目录的战斗数据，不能指向日常战役服务。

```powershell
$env:STARS_MONSTER_INVENTORY_DIR='.codex-temp/monster-verification-20260904'
node scripts/verify-monster-catalog.mjs
# 另一个终端启动隔离服务；端口被占用时会拒绝启动
node scripts/start-monster-verification.mjs
# 服务就绪后，在本终端运行真实浏览器测试
npx playwright test --config e2e/monster-verification.config.ts
node scripts/report-monster-verification.mjs
```

验证脚本会保存各矩阵的 JSON reporter 结果；生成器只有在对应套件整体无失败时，才把动作矩阵标为通过。

## 逐怪物索引（CR 从高到低）

| CR | 怪物 | 数值用例数 | Headless 待覆盖动作 | DM 裁定／非战斗动作 | UI | 当前结论 |
| ---: | --- | ---: | ---: | ---: | --- | --- |
| 30 | [塔拉斯克](monsters/tarrasque.md) | 43 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 24 | [远古红龙](monsters/ancient-red-dragon.md) | 37 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 24 | [远古金龙](monsters/ancient-gold-dragon.md) | 41 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 23 | [海妖克拉肯](monsters/kraken.md) | 29 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 23 | [远古蓝龙](monsters/ancient-blue-dragon.md) | 37 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 23 | [远古银龙](monsters/ancient-silver-dragon.md) | 41 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 22 | [远古绿龙](monsters/ancient-green-dragon.md) | 37 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 22 | [远古青铜龙](monsters/ancient-bronze-dragon.md) | 41 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 21 | [太阳神使](monsters/solar.md) | 28 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 21 | [巫妖](monsters/lich.md) | 23 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 21 | [远古赤铜龙](monsters/ancient-copper-dragon.md) | 41 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 21 | [远古黑龙](monsters/ancient-black-dragon.md) | 37 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 20 | [深狱炼魔](monsters/pit-fiend.md) | 22 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 20 | [远古白龙](monsters/ancient-white-dragon.md) | 37 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 20 | [远古黄铜龙](monsters/ancient-brass-dragon.md) | 41 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 19 | [巴洛炎魔](monsters/balor.md) | 18 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 17 | [成年红龙](monsters/adult-red-dragon.md) | 37 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 17 | [成年金龙](monsters/adult-gold-dragon.md) | 41 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 17 | [龙龟](monsters/dragon-turtle.md) | 15 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 17 | [雄性斯芬克斯](monsters/androsphinx.md) | 25 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 16 | [成年蓝龙](monsters/adult-blue-dragon.md) | 37 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 16 | [成年银龙](monsters/adult-silver-dragon.md) | 41 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 16 | [六臂蛇魔](monsters/marilith.md) | 17 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 16 | [铁魔像](monsters/iron-golem.md) | 17 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 16 | [行星神使](monsters/planetar.md) | 12 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 15 | [成年绿龙](monsters/adult-green-dragon.md) | 37 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 15 | [成年青铜龙](monsters/adult-bronze-dragon.md) | 41 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 15 | [木乃伊领主](monsters/mummy-lord.md) | 43 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 15 | [紫虫](monsters/purple-worm.md) | 8 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 14 | [冰魔](monsters/ice-devil.md) | 12 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 14 | [成年赤铜龙](monsters/adult-copper-dragon.md) | 41 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 14 | [成年黑龙](monsters/adult-black-dragon.md) | 37 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 13 | [成年白龙](monsters/adult-white-dragon.md) | 37 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 13 | [成年黄铜龙](monsters/adult-brass-dragon.md) | 41 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 13 | [风暴巨人](monsters/storm-giant.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 13 | [罗刹](monsters/rakshasa.md) | 8 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 13 | [纳尔弗魔](monsters/nalfeshnee.md) | 17 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 13 | [吸血鬼（本体形态）](monsters/vampire-vampire.md) | 41 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 13 | [吸血鬼（蝙蝠形态）](monsters/vampire-bat.md) | 26 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 13 | [吸血鬼（雾化形态）](monsters/vampire-mist.md) | 6 | 0 | 0 | inspect-only | 本次已覆盖范围通过 |
| 12 | [大法师](monsters/archmage.md) | 5 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 12 | [欲魔](monsters/erinyes.md) | 21 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 11 | [贝希摩斯](monsters/behir.md) | 14 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 11 | [雌性斯芬克斯](monsters/gynosphinx.md) | 13 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 11 | [寒炎虫](monsters/remorhaz.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 11 | [火巨灵](monsters/efreeti.md) | 8 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 11 | [角魔](monsters/horned-devil.md) | 20 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 11 | [鹏鸟](monsters/roc.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 11 | [气巨灵](monsters/djinni.md) | 7 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 10 | [底栖魔鱼](monsters/aboleth.md) | 27 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 10 | [青年红龙](monsters/young-red-dragon.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 10 | [青年金龙](monsters/young-gold-dragon.md) | 15 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 10 | [石魔像](monsters/stone-golem.md) | 12 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 10 | [守护纳迦](monsters/guardian-naga.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 10 | [提婆](monsters/deva.md) | 12 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 9 | [格拉兹特魔](monsters/glabrezu.md) | 9 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 9 | [骨魔](monsters/bone-devil.md) | 12 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 9 | [火巨人](monsters/fire-giant.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 9 | [黏土魔像](monsters/clay-golem.md) | 14 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 9 | [青年蓝龙](monsters/young-blue-dragon.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 9 | [青年银龙](monsters/young-silver-dragon.md) | 15 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 9 | [树人](monsters/treant.md) | 7 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 9 | [云巨人](monsters/cloud-giant.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 8 | [霸王龙](monsters/tyrannosaurus-rex.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 8 | [刺客](monsters/assassin.md) | 13 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 8 | [多头蛇](monsters/hydra.md) | 4 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 8 | [赫兹鲁魔](monsters/hezrou.md) | 12 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 8 | [披风怪](monsters/cloaker.md) | 10 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 8 | [青年绿龙](monsters/young-green-dragon.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 8 | [青年青铜龙](monsters/young-bronze-dragon.md) | 15 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 8 | [霜巨人](monsters/frost-giant.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 8 | [锁链魔](monsters/chain-devil.md) | 15 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 8 | [邪灵纳迦](monsters/spirit-naga.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 7 | [盾卫者](monsters/shield-guardian.md) | 7 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 7 | [鬼人](monsters/oni.md) | 16 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 7 | [巨猿](monsters/giant-ape.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 7 | [青年赤铜龙](monsters/young-copper-dragon.md) | 15 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 7 | [青年黑龙](monsters/young-black-dragon.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 7 | [石巨人](monsters/stone-giant.md) | 7 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 6 | [法师](monsters/mage.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 6 | [弗洛魔](monsters/vrock.md) | 17 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 6 | [美杜莎](monsters/medusa.md) | 16 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 6 | [猛犸象](monsters/mammoth.md) | 12 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 6 | [奇美拉](monsters/chimera.md) | 16 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 6 | [青年白龙](monsters/young-white-dragon.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 6 | [青年黄铜龙](monsters/young-brass-dragon.md) | 15 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 6 | [双足飞龙](monsters/wyvern.md) | 12 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 6 | [隐形追猎者](monsters/invisible-stalker.md) | 4 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 6 | [蛛化精灵](monsters/drider.md) | 16 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [奥图克](monsters/otyugh.md) | 12 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [半红龙老兵](monsters/half-red-dragon-veteran.md) | 20 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [独角兽](monsters/unicorn.md) | 28 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 5 | [缚灵](monsters/wraith.md) | 3 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 5 | [火蜥蜴](monsters/salamander.md) | 10 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [火元素](monsters/fire-elemental.md) | 5 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [角斗士](monsters/gladiator.md) | 15 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [巨魔](monsters/troll.md) | 10 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [巨鲨](monsters/giant-shark.md) | 5 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [巨型鳄鱼](monsters/giant-crocodile.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [掘地鲨](monsters/bulette.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [蔓生怪](monsters/shambling-mound.md) | 10 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [气元素](monsters/air-elemental.md) | 4 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 5 | [丘陵巨人](monsters/hill-giant.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [三角龙](monsters/triceratops.md) | 12 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [绳索怪](monsters/roper.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [水元素](monsters/water-elemental.md) | 4 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 5 | [索尔石怪](monsters/xorn.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [铁甲牛](monsters/gorgon.md) | 16 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [土元素](monsters/earth-elemental.md) | 4 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [吸血鬼衍体](monsters/vampire-spawn.md) | 18 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [熊人（混合形态）](monsters/werebear-hybrid.md) | 14 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [熊人（人类形态）](monsters/werebear-human.md) | 4 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [熊人（熊形态）](monsters/werebear-bear.md) | 10 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [血肉魔像](monsters/flesh-golem.md) | 14 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 5 | [夜鬼婆](monsters/night-hag.md) | 5 | 0 | 3 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 5 | [针刺魔](monsters/barbed-devil.md) | 13 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 4 | [楚尔异怪](monsters/chuul.md) | 9 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 4 | [大象](monsters/elephant.md) | 12 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 4 | [黑布丁](monsters/black-pudding.md) | 3 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 4 | [红龙雏龙](monsters/red-dragon-wyrmling.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 4 | [虎人（虎形态）](monsters/weretiger-tiger.md) | 15 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 4 | [虎人（混合形态）](monsters/weretiger-hybrid.md) | 24 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 4 | [虎人（人类形态）](monsters/weretiger-human.md) | 8 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 4 | [拉弥亚](monsters/lamia.md) | 12 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 4 | [魅魔／梦魔](monsters/succubus-incubus.md) | 14 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 4 | [双头巨人](monsters/ettin.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 4 | [野猪人（混合形态）](monsters/wereboar-hybrid.md) | 14 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 4 | [野猪人（人类形态）](monsters/wereboar-human.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 4 | [野猪人（野猪形态）](monsters/wereboar-boar.md) | 9 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 4 | [幽灵](monsters/ghost.md) | 6 | 0 | 2 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 4 | [羽蛇](monsters/couatl.md) | 11 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 3 | [变形怪](monsters/doppelganger.md) | 8 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 3 | [地狱犬](monsters/hell-hound.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 3 | [冬狼](monsters/winter-wolf.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 3 | [虎鲸](monsters/killer-whale.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 3 | [金龙雏龙](monsters/gold-dragon-wyrmling.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 3 | [巨蝎](monsters/giant-scorpion.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 3 | [蓝龙雏龙](monsters/blue-dragon-wyrmling.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 3 | [狼人（混合形态）](monsters/werewolf-hybrid.md) | 10 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 3 | [狼人（狼形态）](monsters/werewolf-wolf.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 3 | [狼人（人类形态）](monsters/werewolf-human.md) | 8 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 3 | [老兵](monsters/veteran.md) | 16 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 3 | [绿鬼婆](monsters/green-hag.md) | 6 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 3 | [梦魇兽](monsters/nightmare.md) | 4 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 3 | [木乃伊](monsters/mummy.md) | 14 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 3 | [牛头人](monsters/minotaur.md) | 16 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 3 | [骑士](monsters/knight.md) | 8 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 3 | [尸鬼](monsters/wight.md) | 15 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 3 | [石化蜥蜴](monsters/basilisk.md) | 8 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 3 | [相位蜘蛛](monsters/phase-spider.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 3 | [枭熊](monsters/owlbear.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 3 | [蝎尾狮](monsters/manticore.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 3 | [须魔](monsters/bearded-devil.md) | 15 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [艾泽](monsters/azer.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [安赫格掘穴虫](monsters/ankheg.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [白龙雏龙](monsters/white-dragon-wyrmling.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [半人马](monsters/centaur.md) | 14 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [北极熊](monsters/polar-bear.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [德鲁伊](monsters/druid.md) | 9 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [喋喋不休怪](monsters/gibbering-mouther.md) | 9 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [毒蛇群](monsters/swarm-of-poisonous-snakes.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [飞马](monsters/pegasus.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [格里克异怪](monsters/grick.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [鬼火](monsters/will-o-wisp.md) | 12 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [海鬼婆](monsters/sea-hag.md) | 10 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 2 | [黑龙雏龙](monsters/black-dragon-wyrmling.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [祭司](monsters/priest.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [剑齿虎](monsters/saber-toothed-tiger.md) | 12 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [胶质立方怪](monsters/gelatinous-cube.md) | 3 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 2 | [巨鹿](monsters/giant-elk.md) | 9 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [巨蟒](monsters/giant-constrictor-snake.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [巨型野猪](monsters/giant-boar.md) | 9 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [觉醒树木](monsters/awakened-tree.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [狂战士](monsters/berserker.md) | 10 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [猎鲨](monsters/hunter-shark.md) | 5 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [绿龙雏龙](monsters/green-dragon-wyrmling.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [魔化人鱼](monsters/merrow.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [拟态怪](monsters/mimic.md) | 9 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [牛头人骷髅](monsters/minotaur-skeleton.md) | 9 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [强盗头目](monsters/bandit-captain.md) | 9 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [青铜龙雏龙](monsters/bronze-dragon-wyrmling.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [蛇颈龙](monsters/plesiosaurus.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [尸妖](monsters/ghast.md) | 13 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [狮鹫](monsters/griffon.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [石像鬼](monsters/gargoyle.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [食人魔](monsters/ogre.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [食人魔僵尸](monsters/ogre-zombie.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [鼠人（混合形态）](monsters/wererat-hybrid.md) | 17 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [鼠人（巨鼠形态）](monsters/wererat-rat.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [鼠人（人类形态）](monsters/wererat-human.md) | 8 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [犀牛](monsters/rhinoceros.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [邪教狂信徒](monsters/cult-fanatic.md) | 4 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [银龙雏龙](monsters/silver-dragon-wyrmling.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [赭冻怪](monsters/ochre-jelly.md) | 3 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 2 | [蜘蛛人](monsters/ettercap.md) | 14 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 2 | [窒息地毯](monsters/rug-of-smothering.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [赤铜龙雏龙](monsters/copper-dragon-wyrmling.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [黄铜龙雏龙](monsters/brass-dragon-wyrmling.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [灰矮人](monsters/duergar.md) | 18 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [活化护甲](monsters/animated-armor.md) | 4 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [间谍](monsters/spy.md) | 8 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [巨蟾蜍](monsters/giant-toad.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [巨型鬣狗](monsters/giant-hyena.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [巨型秃鹫](monsters/giant-vulture.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [巨型章鱼](monsters/giant-octopus.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [巨型蜘蛛](monsters/giant-spider.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [巨鹰](monsters/giant-eagle.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [骏鹰](monsters/hippogriff.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [恐狼](monsters/dire-wolf.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [夸塞魔](monsters/quasit.md) | 12 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [老虎](monsters/tiger.md) | 12 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [狮子](monsters/lion.md) | 16 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [食人鱼群](monsters/swarm-of-quippers.md) | 8 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [食尸鬼](monsters/ghoul.md) | 10 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [树精](monsters/dryad.md) | 15 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [死亡犬](monsters/death-dog.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [小魔鬼](monsters/imp.md) | 8 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [熊地精](monsters/bugbear.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [鹰身女妖](monsters/harpy.md) | 7 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 1 | [幽魂](monsters/specter.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1 | [棕熊](monsters/brown-bear.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [暗幕怪](monsters/darkmantle.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [暴徒](monsters/thug.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [冰魔蝠](monsters/ice-mephit.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [豺狼人](monsters/gnoll.md) | 12 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [尘土魔蝠](monsters/dust-mephit.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [斥候](monsters/scout.md) | 8 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [大地精](monsters/hobgoblin.md) | 10 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [地底侏儒（斯涅布力）](monsters/deep-gnome-svirfneblin.md) | 9 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [鳄鱼](monsters/crocodile.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [蜂群](monsters/swarm-of-wasps.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [黑熊](monsters/black-bear.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [灰泥怪](monsters/gray-ooze.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [鸡蛇兽](monsters/cockatrice.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [甲虫群](monsters/swarm-of-beetles.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [礁鲨](monsters/reef-shark.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [巨蜂](monsters/giant-wasp.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [巨型海马](monsters/giant-sea-horse.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [巨型山羊](monsters/giant-goat.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [昆虫群](monsters/swarm-of-insects.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [萨堤尔](monsters/satyr.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [沙华鱼人](monsters/sahuagin.md) | 16 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [兽人](monsters/orc.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [蜈蚣群](monsters/swarm-of-centipedes.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [蜥蜴人](monsters/lizardfolk.md) | 18 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [锈蚀怪](monsters/rust-monster.md) | 3 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 1/2 | [岩浆怪](monsters/magmin.md) | 8 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [岩浆魔蝠](monsters/magma-mephit.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [幽影](monsters/shadow.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [猿](monsters/ape.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [战马](monsters/warhorse.md) | 9 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [战马骷髅](monsters/warhorse-skeleton.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [蜘蛛群](monsters/swarm-of-spiders.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/2 | [座狼](monsters/worg.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [蝙蝠群](monsters/swarm-of-bats.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [地精](monsters/goblin.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [渡鸦群](monsters/swarm-of-ravens.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [飞剑](monsters/flying-sword.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [斧喙鸟](monsters/axe-beak.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [格里姆洛克](monsters/grimlock.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [黑豹](monsters/panther.md) | 12 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [僵尸](monsters/zombie.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [巨獾](monsters/giant-badger.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [巨蛙](monsters/giant-frog.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [巨蜥](monsters/giant-lizard.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [巨枭](monsters/giant-owl.md) | 5 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [巨型蝙蝠](monsters/giant-bat.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [巨型毒蛇](monsters/giant-poisonous-snake.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [巨型狼蛛](monsters/giant-wolf-spider.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [巨型蜈蚣](monsters/giant-centipede.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [骷髅](monsters/skeleton.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [狼](monsters/wolf.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [蟒蛇](monsters/constrictor-snake.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [麋鹿](monsters/elk.md) | 9 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [骑乘马](monsters/riding-horse.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [怯魔](monsters/dretch.md) | 10 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [闪现犬](monsters/blink-dog.md) | 7 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 1/4 | [侍僧](monsters/acolyte.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [鼠群](monsters/swarm-of-rats.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [挽马](monsters/draft-horse.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [伪龙](monsters/pseudodragon.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [小妖精](monsters/sprite.md) | 12 | 0 | 1 | passed | Headless 已验证，仍有 DM 裁定边界 |
| 1/4 | [野猪](monsters/boar.md) | 9 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [蒸汽魔蝠](monsters/steam-mephit.md) | 11 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [卓尔](monsters/drow.md) | 9 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/4 | [紫罗兰蕈](monsters/violet-fungus.md) | 5 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [矮种马](monsters/pony.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [獒犬](monsters/mastiff.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [部落战士](monsters/tribal-warrior.md) | 10 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [毒蛇](monsters/poisonous-snake.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [飞蛇](monsters/flying-snake.md) | 5 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [狗头人](monsters/kobold.md) | 10 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [贵族](monsters/noble.md) | 4 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [巨鼠](monsters/giant-rat.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [巨蟹](monsters/giant-crab.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [巨型鼬](monsters/giant-weasel.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [骡子](monsters/mule.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [骆驼](monsters/camel.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [强盗](monsters/bandit.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [染病巨鼠](monsters/giant-rat-diseased.md) | 10 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [人鱼](monsters/merfolk.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [守卫](monsters/guard.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [吸血飞虫](monsters/stirge.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [邪教徒](monsters/cultist.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 1/8 | [血鹰](monsters/blood-hawk.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [蝙蝠](monsters/bat.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [渡鸦](monsters/raven.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [狒狒](monsters/baboon.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [海马](monsters/sea-horse.md) | 0 | 0 | 0 | inspect-only | 本次已覆盖范围通过 |
| 0 | [胡狼](monsters/jackal.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [獾](monsters/badger.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [尖叫蕈](monsters/shrieker.md) | 0 | 0 | 1 | inspect-only | Headless 已验证，仍有 DM 裁定边界 |
| 0 | [巨型火甲虫](monsters/giant-fire-beetle.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [觉醒灌木](monsters/awakened-shrub.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [老鼠](monsters/rat.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [劣魔](monsters/lemure.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [鬣狗](monsters/hyena.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [鹿](monsters/deer.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [猫](monsters/cat.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [猫头鹰](monsters/owl.md) | 5 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [魔宠人偶](monsters/homunculus.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [螃蟹](monsters/crab.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [平民](monsters/commoner.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [青蛙](monsters/frog.md) | 0 | 0 | 0 | inspect-only | 本次已覆盖范围通过 |
| 0 | [山羊](monsters/goat.md) | 6 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [食人鱼](monsters/quipper.md) | 5 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [隼](monsters/hawk.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [秃鹫](monsters/vulture.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [蜥蜴](monsters/lizard.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [蝎子](monsters/scorpion.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [鹰](monsters/eagle.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [鼬](monsters/weasel.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [章鱼](monsters/octopus.md) | 7 | 0 | 0 | passed | 本次已覆盖范围通过 |
| 0 | [蜘蛛](monsters/spider.md) | 3 | 0 | 0 | passed | 本次已覆盖范围通过 |
