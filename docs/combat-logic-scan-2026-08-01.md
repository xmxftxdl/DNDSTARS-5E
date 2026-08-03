# 战斗逻辑全仓扫描 — 2026-08-01

分支：`codex/p0-postgres-staging-release` @ `6058a32`（另有未提交改动）  
范围：Headless 攻击/法术/区域/移动/借机/突袭/死亡与再生/服务端投影  
方法：四路并行深挖 + 对高危项逐条 Read/Grep 核实  

健康度：`src/rulesets/dnd5e` 单测约 **1799 通过**（ vitest 偶发 EPIPE，非断言失败）。

---

## 高严重度（建议优先修）

### H1. 序列法术攻击 prepare 漏 Help/恐慌等，engine 用 `d20Second ?? 0`
`spellAction.ts:1234-1258` + `headlessCombatEngine.ts` 多处 `?? 0`

单目标路径已含 Help、恐慌、效用投影、next-d20；**魔能爆等序列攻击**对每个目标重算时漏掉这些。engine 按完整规则抬升 mode 后缺第二骰 → `?? 0` → `invalid-dice` 或错误结果。
**修**：序列分支与单目标同源；缺第二骰拒绝或强制补骰，禁止回退 0。

### H2. 怪物法术攻击模式漏朦胧 / Help / 倒地
`headlessCombatEngine.ts:1270-1295`（`dnd5eMonsterSpellAttackMode`）

prepare 与结算共用此函数：无朦胧劣势、无 Help 优势、无倒地近战优势/远程劣势；缺第二骰同样 `?? 0`。
**修**：与玩家武器/法术攻击同一套视觉、Help、倒地规则。

### H3. 借机攻击无视力竭 3+
`opportunityAttackAction.ts:241-251` + engine OA 路径

普通武器 prepare 有 `exhaustionLevel >= 3`；借机攻击 prepare 没有，engine 侧也未独立检查。
**修**：OA 劣势列表补力竭 3+。

### H4. 借机攻击 preview 把扩展重击误当成命中
`opportunityAttackAction.ts:294-295`

`hit: adjusted.hit || critical`，且 `critical = d20 >= criticalThreshold`。勇士 19 未达 AC 也会显示命中+重击（权威结算本身正确，UI/确认层误导）。
**修**：仅 nat20 自动命中；重击以先命中为前提。

### H5. 生命领域升环治疗用目录环级
`headlessCombatEngine.ts:12505-12542`

`2 + spell.level` 应用了四次（门徒加值与受佑医者）。升环施放应得 `2 + slotLevel`。
**修**：全部改为 `action.slotLevel`（戏法仍按 0）。

### H6. 团灭判定把「再生/不死坚韧待定」当成已死
`combatTokens.ts:42-50` / `97-103`

`isTokenFinallyDefeated` 对非玩家只看 `hp<=0`。巨魔等挂 `monsterRegenerationPendingAtZero`、僵尸挂 `undeadFortitudePending` 时，`checkCombatOutcome` 会立刻 `enemies-defeated` 并结束战斗，再生/坚韧回合永不到。
**修**：与 planner/kill-streak 一致，pending 期间不算最终阵德。

### H7. 再生怪超量即死后 pending 未清 → 下一快照「复活」
`headlessCombatEngine.ts:7207-7212`

`massiveDamage` 清了 `undeadFortitudePending`，**不清** `monsterRegenerationPendingAtZero`。Token 回写仍带 pending，快照重建时 `hp===0 && pending` → `dead:false`，可再回血。
**修**：massiveDamage 分支同步清除 `monsterRegenerationPendingAtZero`。

### H8. 突袭白名单漏龙威豁免
`surprise.ts:21-32`

无 `sorcerer-draconic-presence-save`。被突袭者回合边界发出的龙威豁免被 Headless 拒掉并被 settle 静默跳过 → 既不上状态也不给免疫。
**修**：加入豁免类白名单（与 death-save / concentration-save 同类）。

### H9. 专注断裂后持续区域仍可能结算
收集层 `pluginAreas.ts:313-314` 有专注检查，但回合边界/残留区域仍可能在异步 `reconcile` 之前被 `resolveDnd5ePersistentAreaTrigger` 结算。
**修**：resolve 入口强制校验 `concentrationId` 与施法者当前专注；断专注同步清区，勿只靠异步 reconcile。

### H10. 月华/灵体卫士「移到生物身上」漏 on-enter
`MapsPage.tsx` 区域移动路径（约 16800）/ 玩家移动 hazard（约 23578）

炽焰法球有撞击结算；月华移动、灵体卫士随施法者走进敌人格时，对静止敌人不收 `on-enter`，本回合进入伤害漏掉。
**修**：区域锚点移动与 source-token 跟随后，对落入新覆盖的生物补 `on-enter`（注意 2014 勘误：仅「生物进入」触发，区域移到身上是否触发需按你们选定的勘误口径写死并测）。

---

## 中严重度

| ID | 位置 | 问题 |
|----|------|------|
| M1 | `spellAction.ts:1195-1217` | 单目标法术攻击 prepare 漏战技大师挑拨/扰乱；engine 有 → 第二骰同值回退，优劣势静默失效 |
| M2 | `hunterMultiattackAction.ts` / `classFeatureAction.ts` | Help 只检查 `targetIndex===0`；多目标时优势丢失或与 engine 分叉 |
| M3 | `opportunityAttackAction.ts:229-240` | 优势源未包在 `!dnd5ePreventsAttackAdvantage` 内（飘忽等） |
| M4 | `headlessCombatEngine.ts` 区域伤害 | 持续区域 `adjustDamageForTarget` 未标魔法法术伤害源 → 非魔法抗性误伤荆棘等 |
| M5 | `monsterMoveAction.ts:224-234` | 怪物飞行未按飞速/步行比率折算，与玩家 traversal 不一致 |
| M6 | `traversal.ts` + pathfinding | 飞行同格下降消耗为 0（上升有消耗，不对称） |
| M7 | `MapsPage` 危险截断扣费 | 截断移动忽略困难地形/爬行/拖拽等，Host 经济偏多 |
| M8 | `traversal.ts` 攀爬 | 水平已 ×2 仍额外加垂直，上高台偏贵 |
| M9 | `pluginAreas.ts` 困难地形 | 只做 2D 格相交，飞越地面 Web/荆棘仍加倍 |
| M10 | `shared-server-core.mjs` 投影 | 不认 `seeInvisible`/妖火，与 Headless 可见性分叉 |
| M11 | `combatTokens` / MapsPage NPC 回合 | 存活 NPC 先攻只 advance，不跑 end-turn → 回合制状态不衰减 |

---

## 已检查、主路径看起来正确的方面

- 全掩护 / 半身·四分之三掩护加 AC；nat20 不穿全掩护  
- 法师护甲叠盾、着装护甲拒绝；树肤地板  
- 妖火勾边与「看不见」优劣势主路径  
- 抗性顺序：免疫 → 抗性（向下取整）→ 易伤；豁免减半在抗性前  
- 反制/护盾反应时机；死亡防护主路径  
- 借机「看不见目标」在 prepare 前拒绝；推撞权威位移；疾走 `movement-granted`  
- rollMode：同侧不叠加、优+劣=普通  

---

## 建议修复顺序

1. **H6+H7**（再生/团灭）— 一碰就结束战斗或即死回档，体感最炸  
2. **H1+H2+H3**（骰数/mode 分叉）— 同一类：统一 prepare 来源 + 禁止 `?? 0`  
3. **H5**（生命领域环位）— 一行级改动、有明确公式  
4. **H8**（突袭龙威）— 白名单加一项  
5. **H9+H10**（区域专注与进入）— 区域法术正确性  
6. **H4**（OA preview）— UI 误导  
7. 其余中危按移动/投影/NPC 回合排期  

---

## 一句话

隐藏问题主要集中在三类：**prepare/engine 骰模分叉（尤其序列法术与怪物法术）**、**0HP 再生与团灭判定不同步**、**持续区域进入/专注时序**。掩护、抗性顺序、主武器攻击链相对扎实。
