# 仓库审查记录 · 2026-09-04

审查对象为 `codex/mobile-app` 分支的当前工作区，HEAD 为 `1ae557af`，包含大量未提交改动。因此这些结论针对本地现状，不代表线上版本或主分支。此次只生成报告、日志和隔离复现脚本，没有修改业务代码。

当前最需要补的是稳定性和发布保障。项目已经有较完整的房间鉴权、共享状态修订号、原子事务、恢复/备份演练和大量规则测试，但地图工作区、移动端会话生命周期、规则数据与校验器之间出现了明显脱节。本次定位了 **8 个具体运行时/数据问题，以及 2 类发布阻断问题**。

P1 表示影响主要功能或阻断发布，应优先修复；P2 表示特定场景下影响正确性、状态恢复或内容使用。

## 具体发现

### 1. [P1] 玩家战斗移动提交后抛出 ReferenceError

位置：[MapsWorkspacePage.tsx:35402](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/src/pages/MapsWorkspacePage.tsx:35402)。调用方在同文件第 9285 行。

`sendPlayerMoveRequest` 在动作已经提交后读取 `forcedFallReactionEvents.length`，但这个变量不在该函数作用域内；分支内的 `initial` 也不存在。普通合法战斗移动即可触发，不要求实际发生坠落。

**影响：**请求可能已到达 DM，但玩家端回调抛异常，第 9300 行附近关闭移动范围、重置谨慎移动等收尾不会执行，造成操作状态与已提交动作不一致。不能简单理解为“服务端没有移动”。

**证据：**执行从当前源码提取的完整函数，使用正常移动条件；提交计数为 1，随后抛出 `forcedFallReactionEvents is not defined`。类型检查也报告同一位置的未定义变量。

**建议：**把误放的坠落事件合并逻辑移回所属结算流程，增加“玩家移动成功后退出选点模式”的行为回归。

### 2. [P1] 玩家打开角色专注效果详情时地图组件渲染失败

位置：[MapsWorkspacePage.tsx:4164](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/src/pages/MapsWorkspacePage.tsx:4164)，`playerChar` 声明在第 5598 行。

当 `effectDetailInstance.kind === 'concentration'`、当前用户不是 DM、且详情关联角色存在时，渲染过程中计算 `canRemoveEffectDetailInstance` 会立即读取尚未初始化的 `playerChar`。可选链不能绕过 `const` 的初始化时序。

**影响：**玩家查看专注详情即触发组件错误，相关查看/结束专注操作无法正常进行。初次打开地图和 DM 查看不一定触发，因此普通启动检查容易漏掉。

**证据：**按源码声明顺序执行该表达式，抛出 `Cannot access 'playerChar' before initialization`；TypeScript 同时报告 TS2448。

**建议：**先计算玩家角色，再计算依赖它的权限/详情状态；补玩家打开专注详情的渲染测试。

### 3. [P1] 移动端正常重启后丢失登录 token

位置：[useMobileWorkspace.ts:247](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/apps/player-mobile/src/hooks/useMobileWorkspace.ts:247)、[mobileApi.ts:129](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/apps/player-mobile/src/services/mobileApi.ts:129)、[shared-server-core.mjs:11049](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/scripts/shared-server-core.mjs:11049)。

`GET /api/accounts/me` 实际返回公开个人资料，不包含 `sessionToken`。移动端却将它声明为 `MobileAccountSession`，恢复登录时直接覆盖并保存原会话。下一次获取战役列表使用的 token 因此为 `undefined`，收到 401 后又清空本地凭据。

**影响：**用户已有有效登录状态、网络正常，重新打开 App 仍需要重新登录；资料接口与会话类型的错误约定会让编译器无法发现这个问题。

**证据：**启动隔离的真实 `handleSharedApi` 服务，调用实际移动端 API 函数及恢复回调：资料请求成功，后续战役请求 401，保存的对象无 token，清除凭据被调用。

**建议：**独立定义资料响应类型，并将资料合并到原会话，保留原 token；加入真实服务端响应参与的恢复登录契约测试。

### 4. [P2] 变形角色血量回退路径把字符串 ID 当成完整对象

位置：[combatTokens.ts:28](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/src/lib/combatTokens.ts:28)。

`wildShapeFormId` 在角色类型中是字符串，却被命名为 `activeCreatureForm` 并读取 `.hitPoints.average`。当变形角色关联的 token 没有 `maxHp`，或缺少回退所需的血量字段时，代码抛出 TypeError。

**影响：**地图 token / 先攻血量展示在投影字段不完整的场景下崩溃。血量字段齐全时 `??` 短路会掩盖问题。

**证据：**使用字符串形态 ID、已存在的变形当前 HP、缺少 token 最大 HP 的输入，实际函数抛出异常。现有 [combatTokens.test.ts:80](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/src/lib/combatTokens.test.ts:80) 反而构造了对象类型的 `wildShapeFormId`，而且提供了完整 token HP，未覆盖真正失败的回退分支。

**建议：**通过形态 ID 查到形态定义，或使用明确的权威最大 HP 字段；测试使用符合真实类型的数据并覆盖缺失 token HP。

### 5. [P2] 移动端旧房间请求可以覆盖新房间

位置：[useMobileWorkspace.ts:183](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/apps/player-mobile/src/hooks/useMobileWorkspace.ts:183)、[useMobileWorkspace.ts:226](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/apps/player-mobile/src/hooks/useMobileWorkspace.ts:226)。

`refreshWorkspace` 发起请求后，没有检查当前房间身份或请求代次；只有组件级 `mounted` 检查。房间变化虽然清空了缓存，但清理 effect 不会取消已在运行的请求。

**影响：**A 房间慢请求在切换到 B 房间后返回，会覆盖 B 的工作区。修订号缓存也只有资源名，没有房间隔离；A 的高 revision 还能阻止 B 的低 revision 更新被接受。此处已确认的是客户端展示/缓存污染，不是服务端跨房间写入。

**证据：**先挂起 A 的请求，再让 B 完成，最后释放 A：界面状态先为 B，最终变回 A。

**建议：**使用会话 generation 或 AbortController；写缓存和提交 UI 状态前检查 generation，缓存按房间身份分区。

### 6. [P2] 移动端全部同步请求失败仍显示在线

位置：[useMobileWorkspace.ts:187](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/apps/player-mobile/src/hooks/useMobileWorkspace.ts:187)、[useMobileWorkspace.ts:229](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/apps/player-mobile/src/hooks/useMobileWorkspace.ts:229)。

所有资源请求都把异常转换为 `null`，语音状态也吞掉异常；只要后续投影构建完成，就执行 `setConnection('online')` 和清空错误。

**影响：**断网、会话失效或服务端错误时，客户端可能继续展示旧数据/空状态，并向用户报告已连接。

**证据：**15 个资源请求与语音请求全部拒绝后，实际刷新回调最终仍设置 `online`，错误为空。

**建议：**区分不存在、未授权和网络失败；至少要求关键资源成功后才标记同步成功，并保留最近一次成功同步时间。

### 7. [P2] 移动端暂时断网也会永久清除已保存登录

位置：[useMobileWorkspace.ts:258](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/apps/player-mobile/src/hooks/useMobileWorkspace.ts:258)。

启动恢复流程的统一 catch 无条件调用 `clearMobileAccount()`，没有使用已有 `MobileApiError` 的状态码和 `retriable` 信息。因此网络超时、服务器暂时不可用与确定的凭据失效执行相同操作。

**影响：**即使修复第 3 项，用户在地铁、飞行模式或服务维护时打开 App 仍会被退出登录，网络恢复后无法直接恢复原会话。

**证据：**注入 `retriable: true` 的网络错误，恢复流程仍调用清除凭据。

**建议：**仅在明确认证失效时清理；网络失败保留凭据，进入可重试的离线状态。

### 8. [P2] 三个内置怪物的新特性不被自身 schema 接受

位置：[monsters.ts:8472](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/src/rulesets/dnd5e/monsters.ts:8472)、[monsterSchema.ts:2139](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/src/rulesets/dnd5e/monsterSchema.ts:2139)。

活化盔甲、飞剑、窒息地毯被添加 `antimagic-susceptibility` 特性，但 `traitShapeIsValid` 没有接受该 kind 的分支，最终返回 false。

**影响：**这三份内置数据被 `validateDnd5eMonsterCatalog` 判为无效；将同样数据用于需要 `parseDnd5eMonsterStatBlock` 的怪物工坊/规则包导入路径时会被拒绝。不能据此断言它们在所有战斗路径中都无法出现。

**证据：**全量测试中的 `monsterSchema.test.ts` 明确列出上述三个 ID，错误为 `invalid-stat-block / 特性数据无效`。

**建议：**同步扩展 trait schema 的严格字段校验，增加内置数据导出、重新解析的往返测试。

### 9. [P1] 当前工作区无法通过标准构建

位置：[package.json:32](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/package.json:32)、[audit-architecture.mjs](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/scripts/audit-architecture.mjs)。

`npm run build` 在架构审计阶段退出，包含文件规模、依赖边界和缺失迁移标记共 23 条问题。单独执行类型检查还有 **210 条错误：97 条位于业务源码、113 条位于测试**。移动端类型检查另报 26 条，其中包含引用的公共源码错误，不能简单相加当成独立缺陷数。

业务类型错误集中在地图工作区 40 条、DM 裁定面板 19 条、Headless 引擎 15 条。即使放宽架构阈值，类型检查仍然无法通过。

**建议：**先修运行时错误和状态类型脱节，再按实际模块边界拆分代码；不要仅调大阈值或删除断言以获得绿灯。

### 10. [P1] 生产依赖审计强制旧版本，CI 必然失败

位置：[audit-production.mjs:35](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/scripts/audit-production.mjs:35)。

审计要求 `packageJson.dependencies['react-router-dom'] === '7.18.1'`，但当前声明为 `^7.18.3`。因此脚本尚未进入实际依赖漏洞查询就退出；CI 中这个步骤也会失败。

**建议：**同步处理版本升级与历史安全例外，使审计针对实际安装/锁定的版本工作。本次只确认门禁逻辑失配，没有据此断言依赖本身存在漏洞，也没有得到完整的在线漏洞审计结果。

## 检查结果与可信边界

| 检查 | 结果 | 解释 |
| --- | --- | --- |
| 根目录全量 Vitest，限制为 2 workers | 664 文件：628 通过、36 失败；5,775 项通过、64 项失败、79 项跳过 | 约 425 秒；64 项断言失败不等于 64 个产品 bug |
| 4 个受本机配置影响的服务端套件复跑 | 3 文件通过、1 文件失败；78 项通过、1 项失败 | 使用空的独立 AI/语音配置目录，排除本机 DPAPI 解密限制 |
| 上述唯一失败的目录发布测试单独复跑 | 通过，其他 46 项未选择 | 前面的测试已发布另一商品，后续断言仍假定目录只有一项，属于测试隔离问题 |
| 移动端 Vitest | 19 文件：18 通过、1 失败；80 项通过、1 项失败 | Shatter 自动化等级的断言与当前投影不一致；未单凭这个差异判为产品 bug |
| 桌面端 Node tests | 6/6 通过 | 更新包与插件包存储单测，不代表真实安装/升级已经验收 |
| mobile-demo Node tests | 3/3 通过 | 仅技术示例服务 |
| 独立复现脚本 | 7 个运行时问题全部复现 | 使用当前源码、受控依赖及隔离真实账户服务；不是移动真机 E2E |
| 根目录 typecheck | 失败，210 条错误 | 97 条业务源码、113 条测试 |
| 移动端 typecheck | 失败，26 条错误 | 含公共代码问题 |
| 标准 build | 失败 | 架构审计阶段即退出，未产出新 bundle |
| 生产依赖审计 | 失败 | 旧版本约束阻断，尚未完成漏洞查询 |
| ESLint | 全量未完成；包含两大文件的缩小扫描仍在约 4 GiB 堆限制处 OOM | 另对 3 个小文件检查，得到 3 errors / 1 warning；不能当成全仓 lint 总数 |
| 法术运行时覆盖审计 | 未完成 | 两次遇到 Vite SSR 模块加载超时，未得到当前覆盖率 |
| 浏览器 E2E | 未完成 | 首次受本机 DPAPI 配置影响，隔离配置后启动仍耗时较长，结束该次尝试；未宣称浏览器场景通过 |
| PostgreSQL、Docker 恢复、移动真机与桌面安装 | 本次未运行 | 仓库已有相关 CI/脚本，但不能用文件存在代替本次实测 |

其他失败主要集中在怪物 Headless 策略与旧测试约定、法术/视觉注册表的一致性、少量真实规则结算和源码字符串断言。它们需要逐项归因；例如“预期 122 个法术、实际 123 个”的数量差异本身并不能证明新增法术有 bug。

## 当前最缺的保障

1. **覆盖三端的持续集成。** 根目录 Vitest 只包含 `src` 和 `local-content`，常规 CI 没有移动端 typecheck/test。桌面测试存在于独立发布工作流，建议常规 PR 也运行必要的跨端检查。优先把移动登录恢复、房间切换、掉线重连纳入门禁。
2. **真实接口契约与生命周期测试。** 资料和会话响应必须分开定义；测试应覆盖实际 HTTP 返回内容，及旧响应迟到、401、超时、退出房间、重新登录这些时序。单测数量多，仍然挡不住“mock 返回了错误形状”的漏洞。
3. **交互测试替代关键流程的源码字符串匹配。** 地图渲染隔离测试有多处直接判断大文件是否包含某段文本。重构会产生假失败，还会把整份约 4 万行源码打印进日志；它们同时漏过了移动事件里的 ReferenceError。关键操作要验证用户事件、状态与提交结果。
4. **可维护的模块边界。** 当前地图工作区约 40,049 行、Headless 引擎约 40,597 行、服务端核心约 14,985 行。应按玩家动作提交、怪物回合、法术/效果生命周期、地图投影和账户/房间 API 拆分。实际编译错误和误放代码表明这已经影响交付，而不仅是代码风格。
5. **规则定义、schema、运行时和展示的一致性检查。** 增加内置目录往返解析、注册表双向校验和代表性实际结算。自动化徽章要和真正可执行的处理器保持一致；历史审计文档中的覆盖率不能直接当作当前事实。
6. **可重复的开发与发布说明。** 根目录缺少统一 README；应给出 Node/包管理器、服务配置、三端启动、测试隔离、构建、备份与恢复入口。已有备份恢复设施需要统一说明，不是重新发明一套。另应明确 npm/pnpm 双 lockfile 的维护策略，避免本地依赖状态与 CI 不同。

建议顺序：先处理第 1–3 项和构建/CI 阻断；然后修第 4–8 项并补对应回归；最后收敛测试隔离、规则注册与模块拆分。完成这些后，再做多人浏览器战斗、弱网切房间、真实移动端后台恢复和正式发布包验收。

## 复查材料

- [隔离复现脚本](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/.codex-temp/repo-review-20260904/reproduce.mjs)：在仓库根目录执行 `node .codex-temp/repo-review-20260904/reproduce.mjs`。脚本验证当前错误确实发生，退出 0 表示复现成功，不能把它当成“修复后应该通过”的正常回归测试。
- [复现输出](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/.codex-temp/repo-review-20260904/reproductions.log)
- [全量失败索引](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/.codex-temp/repo-review-20260904/failing-tests.txt)
- [全量测试日志](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/.codex-temp/repo-review-20260904/unit-tests.log)
- [业务与测试类型检查](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/.codex-temp/repo-review-20260904/typecheck.log)
- [移动端类型检查](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/.codex-temp/repo-review-20260904/mobile-typecheck.log)
- [移动端测试](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/.codex-temp/repo-review-20260904/mobile-tests.log)
- [服务端隔离复测](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/.codex-temp/repo-review-20260904/server-retest.log)
- [目录测试单独复测](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/.codex-temp/repo-review-20260904/catalog-isolation-retest.log)
- [构建日志](C:/Users/Doco/Desktop/DND/DNDSTARS-5E/.codex-temp/repo-review-20260904/build.log)

检查环境：Windows，Node v24.16.0，使用工作区已有依赖；CI 配置使用 Node 22。本次没有执行 `npm ci` 或替换锁文件，没有操作生产账户、线上房间或真实数据库，也未将旧报告中的覆盖率作为本次实测结果。

## 修复跟进

以上为初次审查的历史快照。用户随后授权修复和全目录怪物验证；具体运行时问题、类型检查与依赖审计已处理，标准构建仍有 13 项架构门禁未解除。请以 [后续验证记录](monster-verification-2026-09-04/WORKLOG.md) 和 [逐怪物结果](monster-verification-2026-09-04/README.md) 查看当前状态。
