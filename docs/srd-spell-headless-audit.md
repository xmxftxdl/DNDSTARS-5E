# SRD 5.1 法术 Headless 全量审计

本报告由 `npm run audit:srd-spell-headless` 从当前 SRD 目录、核心 Headless 注册表与人工逐法术决定生成。它只记录结构化机制与迁移判断，不复制法术正文。

## 判定标准

- **完整 Headless**：所有强制结果都可由有限选择、权威骰值、已注册内容和可观察状态决定。
- **半自动**：确定性条款可以自动结算，但至少一项强制条款依赖开放式语言、DM 选择、场景语义或未建模世界状态。
- **DM/资料**：主要产出是 DM 回答、叙事交互、协商或开放式现实改写；只自动处理消耗、专注、日志与暂停。

## 汇总

> “目标”表示完成所列通用原语后的可达等级，不表示法术今天已经接入。产品 UI 必须继续根据注册 operation 与 handler 计算当前覆盖率。

| 指标 | 数量 |
|---|---:|
| SRD 法术总数 | 319 |
| 当前已接入 Headless | 123 |
| 当前完整 / 半自动 / DM | 94 / 0 / 225 |
| 目标完整 / 半自动 / DM | 189 / 124 / 6 |
| 新增可完整迁移 | 95 |
| 新增只能半自动 | 124 |
| 应保留 DM | 6 |

## 通用原语需求

下表按逐法术决定中的能力/阻塞代码聚合。完整候选列表示实现该原语后可继续向完整 Headless 迁移的法术数；半自动列表示该原语只能自动化其中的确定性条款。

| 原语/阻塞代码 | 完整候选 | 半自动候选 | 合计 |
|---|---:|---:|---:|
| `persistent-area` | 13 | 30 | 43 |
| `saving-throw` | 17 | 22 | 39 |
| `legacy-core-transaction` | 0 | 29 | 29 |
| `summon-companion` | 7 | 12 | 19 |
| `mode-choice` | 6 | 10 | 16 |
| `cross-scene` | 0 | 13 | 13 |
| `duration` | 12 | 0 | 12 |
| `planar-state` | 8 | 3 | 11 |
| `dm-creature-choice` | 0 | 10 | 10 |
| `dm-interpretation` | 0 | 10 | 10 |
| `illusory-content` | 0 | 10 | 10 |
| `terrain-geometry` | 2 | 8 | 10 |
| `typed-target` | 5 | 4 | 9 |
| `stat-transform` | 4 | 4 | 8 |
| `world-object` | 1 | 7 | 8 |
| `death-handoff` | 5 | 2 | 7 |
| `semantic-command` | 0 | 7 | 7 |
| `sensor-vision` | 4 | 3 | 7 |
| `communication` | 3 | 3 | 6 |
| `condition-immunity` | 6 | 0 | 6 |
| `condition-lifecycle` | 5 | 1 | 6 |
| `inventory-effect` | 6 | 0 | 6 |
| `movement-blocking` | 6 | 0 | 6 |
| `movement-mode` | 5 | 1 | 6 |
| `open-text-trigger` | 1 | 5 | 6 |
| `random-table` | 3 | 3 | 6 |
| `active-effect` | 0 | 5 | 5 |
| `actor-control` | 1 | 4 | 5 |
| `effect-detection` | 2 | 3 | 5 |
| `form-catalog` | 3 | 2 | 5 |
| `slot-scaling` | 3 | 2 | 5 |
| `door-state` | 2 | 2 | 4 |
| `effect-removal` | 4 | 0 | 4 |
| `entity-movement` | 3 | 1 | 4 |
| `forced-movement` | 3 | 1 | 4 |
| `granted-activity` | 4 | 0 | 4 |
| `healing` | 3 | 1 | 4 |
| `roll-mode-modifier` | 4 | 0 | 4 |
| `semantic-compliance` | 0 | 4 | 4 |
| `semantic-destination` | 0 | 4 | 4 |
| `spell-attack` | 3 | 1 | 4 |
| `turn-trigger` | 4 | 0 | 4 |
| `world-information` | 0 | 4 | 4 |
| `barrier-material-thickness-gap` | 0 | 3 | 3 |
| `body-snapshot` | 3 | 0 | 3 |
| `concentration` | 3 | 0 | 3 |
| `condition-restoration` | 3 | 0 | 3 |
| `count-choice` | 0 | 3 | 3 |
| `effect-modifier` | 2 | 1 | 3 |
| `effect-suppression` | 2 | 1 | 3 |
| `item-link` | 3 | 0 | 3 |
| `language-capability` | 3 | 0 | 3 |
| `long-term-state` | 1 | 2 | 3 |
| `material-targeting` | 0 | 3 | 3 |
| `object-creation` | 0 | 3 | 3 |
| `object-enchantment` | 2 | 1 | 3 |
| `off-map-search` | 0 | 3 | 3 |
| `persistent-sense` | 0 | 3 | 3 |
| `save-ends` | 3 | 0 | 3 |
| `semantic-target` | 0 | 3 | 3 |
| `slot-scaling-gap` | 0 | 2 | 2 |
| `teleport` | 0 | 3 | 3 |
| `ability-check` | 1 | 1 | 2 |
| `ability-override` | 1 | 1 | 2 |
| `body-restoration` | 2 | 0 | 2 |
| `contested-check` | 1 | 1 | 2 |
| `damage-resistance` | 2 | 0 | 2 |
| `dispel-state` | 1 | 1 | 2 |
| `dm-information` | 0 | 2 | 2 |
| `dm-planar-destination` | 0 | 2 | 2 |
| `dm-response` | 0 | 2 | 2 |
| `environment-state` | 0 | 2 | 2 |
| `event-trigger` | 2 | 0 | 2 |
| `falling-state` | 2 | 0 | 2 |
| `hit-point-handoff` | 2 | 0 | 2 |
| `invisibility` | 1 | 1 | 2 |
| `invoke-activity` | 0 | 2 | 2 |
| `item-generation` | 2 | 0 | 2 |
| `light-source` | 1 | 1 | 2 |
| `long-term-penalty` | 2 | 0 | 2 |
| `max-hit-points` | 2 | 0 | 2 |
| `metadata-visibility` | 1 | 1 | 2 |
| `minor-world-effect` | 0 | 2 | 2 |
| `multi-save-counter` | 2 | 0 | 2 |
| `multi-target` | 2 | 0 | 2 |
| `npc-response` | 0 | 2 | 2 |
| `off-map-destination` | 0 | 2 | 2 |
| `reaction-trigger` | 2 | 0 | 2 |
| `resurrection-timer` | 2 | 0 | 2 |
| `saving-throw-modifier` | 2 | 0 | 2 |
| `skill-check-modifier` | 2 | 0 | 2 |
| `spell-storage` | 0 | 2 | 2 |
| `teleport-blocking` | 0 | 2 | 2 |
| `vertical-movement` | 2 | 0 | 2 |
| `world-object-gap` | 0 | 2 | 2 |
| `world-state` | 0 | 2 | 2 |
| `ability-restoration` | 1 | 0 | 1 |
| `action-economy` | 1 | 0 | 1 |
| `action-escape` | 1 | 0 | 1 |
| `action-restriction` | 1 | 0 | 1 |
| `area-lifecycle` | 1 | 0 | 1 |
| `area-movement` | 1 | 0 | 1 |
| `area-slot-scaling` | 1 | 0 | 1 |
| `attack-redirection` | 1 | 0 | 1 |
| `attack-resolution` | 1 | 0 | 1 |
| `automatic-escape` | 1 | 0 | 1 |
| `bounded-safe-options` | 0 | 1 | 1 |
| `carry-capacity` | 1 | 0 | 1 |
| `configured-sanctuary` | 0 | 1 | 1 |
| `consecrated-object-gap` | 0 | 1 | 1 |
| `corpse-state` | 1 | 0 | 1 |
| `crafting-judgment` | 0 | 1 | 1 |
| `damage` | 1 | 0 | 1 |
| `damage-accumulator` | 1 | 0 | 1 |
| `damage-immunity` | 1 | 0 | 1 |
| `damage-multiplier` | 1 | 0 | 1 |
| `damage-pool` | 1 | 0 | 1 |
| `damage-qualification` | 1 | 0 | 1 |
| `damage-reflection` | 1 | 0 | 1 |
| `damage-scaling` | 1 | 0 | 1 |
| `darkvision` | 1 | 0 | 1 |
| `deity-veto` | 0 | 1 | 1 |
| `dm-actor-control` | 0 | 1 | 1 |
| `dm-damage-type` | 0 | 1 | 1 |
| `dm-equipment-fit` | 0 | 1 | 1 |
| `dm-form-choice` | 0 | 1 | 1 |
| `dm-initial-state` | 0 | 1 | 1 |
| `dm-layout` | 0 | 1 | 1 |
| `dm-narrative` | 0 | 1 | 1 |
| `dm-object-fit` | 0 | 1 | 1 |
| `dm-object-narration` | 0 | 1 | 1 |
| `dm-weather` | 0 | 1 | 1 |
| `duplicate-counter` | 1 | 0 | 1 |
| `duration-by-material` | 0 | 1 | 1 |
| `effect-break` | 1 | 0 | 1 |
| `ejection-damage` | 1 | 0 | 1 |
| `expiry-penalty` | 1 | 0 | 1 |
| `extra-turns` | 1 | 0 | 1 |
| `hidden-object-tags` | 0 | 1 | 1 |
| `hit-point-threshold` | 1 | 0 | 1 |
| `language-immunity` | 1 | 0 | 1 |
| `layered-effects` | 0 | 1 | 1 |
| `long-term-save` | 1 | 0 | 1 |
| `long-term-world-state` | 0 | 1 | 1 |
| `magic-item-detection` | 0 | 1 | 1 |
| `magic-suppression` | 0 | 1 | 1 |
| `maximum-healing` | 1 | 0 | 1 |
| `metadata-override` | 0 | 1 | 1 |
| `minimum-roll` | 0 | 1 | 1 |
| `movement-capability` | 1 | 0 | 1 |
| `movement-gap` | 0 | 1 | 1 |
| `movement-modifier` | 1 | 0 | 1 |
| `movement-rate` | 1 | 0 | 1 |
| `multi-area` | 0 | 1 | 1 |
| `multi-cell-template` | 1 | 0 | 1 |
| `multi-effect` | 1 | 0 | 1 |
| `narrative-effect` | 0 | 1 | 1 |
| `notification` | 1 | 0 | 1 |
| `npc-personality` | 0 | 1 | 1 |
| `object-transform` | 0 | 1 | 1 |
| `object-unlock` | 1 | 0 | 1 |
| `occupant-permissions` | 1 | 0 | 1 |
| `on-hit-rider` | 1 | 0 | 1 |
| `open-ended-content` | 0 | 1 | 1 |
| `open-ended-effect` | 0 | 1 | 1 |
| `open-ended-exclusions` | 0 | 1 | 1 |
| `open-ended-form` | 0 | 1 | 1 |
| `open-ended-object` | 0 | 1 | 1 |
| `open-ended-option` | 0 | 1 | 1 |
| `open-text-release` | 0 | 1 | 1 |
| `passenger-movement` | 0 | 1 | 1 |
| `password-state` | 1 | 0 | 1 |
| `periodic-damage` | 1 | 0 | 1 |
| `periodic-healing` | 1 | 0 | 1 |
| `planar-sight` | 1 | 0 | 1 |
| `poison-kind-gap` | 0 | 1 | 1 |
| `random-damage` | 0 | 1 | 1 |
| `reader-identity` | 0 | 1 | 1 |
| `repair-state` | 0 | 1 | 1 |
| `resolve-only` | 1 | 0 | 1 |
| `resource-restriction` | 1 | 0 | 1 |
| `restricted-extra-action` | 1 | 0 | 1 |
| `round-timeline` | 1 | 0 | 1 |
| `semantic-bargain` | 0 | 1 | 1 |
| `semantic-creature-category` | 0 | 1 | 1 |
| `semantic-detection` | 0 | 1 | 1 |
| `semantic-entry` | 0 | 1 | 1 |
| `semantic-familiarity` | 0 | 1 | 1 |
| `semantic-location` | 0 | 1 | 1 |
| `semantic-memory` | 0 | 1 | 1 |
| `semantic-task` | 1 | 0 | 1 |
| `sensor-blocking` | 0 | 1 | 1 |
| `sensor-information` | 0 | 1 | 1 |
| `shared-senses` | 1 | 0 | 1 |
| `shared-spells` | 0 | 1 | 1 |
| `sound-event` | 1 | 0 | 1 |
| `source-anchoring` | 0 | 1 | 1 |
| `source-aura` | 1 | 0 | 1 |
| `source-control` | 1 | 0 | 1 |
| `source-following` | 1 | 0 | 1 |
| `source-link` | 1 | 0 | 1 |
| `spell-level-suppression` | 0 | 1 | 1 |
| `structure-damage` | 0 | 1 | 1 |
| `target-linked-effect` | 1 | 0 | 1 |
| `targeting-immunity` | 1 | 0 | 1 |
| `teleport-save` | 1 | 0 | 1 |
| `terrain-state` | 0 | 1 | 1 |
| `timed-delivery` | 0 | 1 | 1 |
| `tracking-suppression` | 1 | 0 | 1 |
| `transition-timer` | 1 | 0 | 1 |
| `truth-detection-gap` | 0 | 1 | 1 |
| `turn-trigger-gap` | 0 | 1 | 1 |
| `visibility-effect` | 1 | 0 | 1 |
| `visibility-rule` | 1 | 0 | 1 |
| `voice-response` | 0 | 1 | 1 |
| `world-material` | 0 | 1 | 1 |
| `world-navigation` | 0 | 1 | 1 |
| `world-registry` | 0 | 1 | 1 |

## 推荐迁移顺序

1. **基础权威结算**：豁免、持续区域、持续时间、条件生命周期、模式选择与升环；这批复用面最大，且大多不依赖新地图实体。
2. **实体与状态交接**：召唤伙伴、形态目录、HP/死亡交接、位面状态、物品链接与资源限制。
3. **地图与世界对象**：地形几何、移动阻挡、光照/传感器、门与容器状态、跨场景目的地注册表。
4. **半自动 DM 桥**：开放文本触发、语义命令/遵从、幻象内容、DM 选怪与 NPC 回答；只把确定性子步骤交给 Headless，并在语义边界暂停。

## 已有 Headless 法术

| 环级 | 法术 | 当前 | 目标 | 迁移动作 | 能力/阻塞代码 |
|---:|---|---|---|---|---|
| 2 | 强酸箭<br><code>acid-arrow</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `spell-attack`、`legacy-core-transaction` |
| 0 | 酸液飞溅<br><code>acid-splash</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 1 | 灾祸术<br><code>bane</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `attack-save-debuff`、`legacy-core-transaction` |
| 4 | 放逐术<br><code>banishment</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 2 | 树肤术<br><code>barkskin</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 4 | 黑触手<br><code>black-tentacles</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 6 | 剑刃护壁<br><code>blade-barrier</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 1 | 祝福术<br><code>bless</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `attack-save-buff`、`legacy-core-transaction` |
| 4 | 枯萎术<br><code>blight</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 2 | 目盲/耳聋术<br><code>blindness-deafness</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 2 | 朦胧术<br><code>blur</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 1 | 燃烧之手<br><code>burning-hands</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 3 | 召雷术<br><code>call-lightning</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 2 | 安定心神<br><code>calm-emotions</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 6 | 连锁闪电<br><code>chain-lightning</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 1 | 魅惑人类<br><code>charm-person</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 0 | 冻寒之触<br><code>chill-touch</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `spell-attack`、`legacy-core-transaction` |
| 6 | 死亡法阵<br><code>circle-of-death</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 5 | 死云术<br><code>cloudkill</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 1 | 七彩喷射<br><code>color-spray</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `color-spray-hit-point-pool`、`legacy-core-transaction` |
| 5 | 寒冰锥<br><code>cone-of-cold</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 3 | 法术反制<br><code>counterspell</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `counterspell`、`legacy-core-transaction` |
| 1 | 疗伤术<br><code>cure-wounds</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `healing`、`legacy-core-transaction` |
| 0 | 舞光术<br><code>dancing-lights</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 2 | 黑暗术<br><code>darkness</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 2 | 黑暗视觉<br><code>darkvision</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 3 | 昼明术<br><code>daylight</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 4 | 防死结界<br><code>death-ward</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 6 | 解离术<br><code>disintegrate</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 3 | 解除魔法<br><code>dispel-magic</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `dispel-magic`、`legacy-core-transaction` |
| 1 | 神恩<br><code>divine-favor</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 0 | 魔能爆<br><code>eldritch-blast</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `spell-attack`、`legacy-core-transaction` |
| 2 | 强化属性<br><code>enhance-ability</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 2 | 变巨/缩小术<br><code>enlarge-reduce</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 1 | 纠缠术<br><code>entangle</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 1 | 脚底抹油<br><code>expeditious-retreat</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 1 | 妖火<br><code>faerie-fire</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 1 | 虚假生命<br><code>false-life</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `temporary-hit-points`、`legacy-core-transaction` |
| 7 | 死亡一指<br><code>finger-of-death</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 0 | 火焰箭<br><code>fire-bolt</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `spell-attack`、`legacy-core-transaction` |
| 3 | 火球术<br><code>fireball</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 2 | 火焰刀<br><code>flame-blade</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 5 | 焰击术<br><code>flame-strike</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 2 | 炽焰法球<br><code>flaming-sphere</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 3 | 飞行术<br><code>fly</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 1 | 云雾术<br><code>fog-cloud</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 6 | 冰封法球<br><code>freezing-sphere</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 1 | 油腻术<br><code>grease</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 4 | 高等隐形术<br><code>greater-invisibility</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 0 | 神导术<br><code>guidance</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 1 | 曳光弹<br><code>guiding-bolt</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `spell-attack`、`legacy-core-transaction` |
| 6 | 重伤术<br><code>harm</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 6 | 医疗术<br><code>heal</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `fixed-healing`、`legacy-core-transaction` |
| 1 | 治愈真言<br><code>healing-word</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `healing`、`legacy-core-transaction` |
| 2 | 灼热金属<br><code>heat-metal</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `automatic-damage`、`legacy-core-transaction` |
| 1 | 炼狱叱喝<br><code>hellish-rebuke</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 1 | 英雄气概<br><code>heroism</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 1 | 狂笑术<br><code>hideous-laughter</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 5 | 怪物定身术<br><code>hold-monster</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 2 | 人类定身术<br><code>hold-person</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 1 | 猎人印记<br><code>hunters-mark</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `mark`、`legacy-core-transaction` |
| 3 | 催眠图纹<br><code>hypnotic-pattern</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 4 | 冰风暴<br><code>ice-storm</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 1 | 致伤术<br><code>inflict-wounds</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `spell-attack`、`legacy-core-transaction` |
| 5 | 疫病虫群<br><code>insect-plague</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 2 | 隐形术<br><code>invisibility</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 1 | 跳跃术<br><code>jump</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 2 | 次级复原术<br><code>lesser-restoration</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `remove-condition`、`legacy-core-transaction` |
| 3 | 闪电束<br><code>lightning-bolt</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 1 | 大步奔行<br><code>longstrider</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 1 | 法师护甲<br><code>mage-armor</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 0 | 法师之手<br><code>mage-hand</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 1 | 魔法飞弹<br><code>magic-missile</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `automatic-damage`、`legacy-core-transaction` |
| 2 | 魔化武器<br><code>magic-weapon</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 5 | 群体疗伤术<br><code>mass-cure-wounds</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `healing`、`legacy-core-transaction` |
| 9 | 群体医疗术<br><code>mass-heal</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `healing-pool`、`legacy-core-transaction` |
| 3 | 群体治愈真言<br><code>mass-healing-word</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `healing`、`legacy-core-transaction` |
| 9 | 流星爆<br><code>meteor-swarm</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 0 | 次级幻影<br><code>minor-illusion</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `narrative-effect`、`legacy-core-transaction` |
| 2 | 迷踪步<br><code>misty-step</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `teleport`、`legacy-core-transaction` |
| 2 | 月华之光<br><code>moonbeam</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 4 | 魅影杀手<br><code>phantasmal-killer</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 0 | 毒气喷溅<br><code>poison-spray</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 9 | 律令死亡<br><code>power-word-kill</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `power-word-kill`、`legacy-core-transaction` |
| 8 | 律令震慑<br><code>power-word-stun</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `power-word-stun`、`legacy-core-transaction` |
| 2 | 治疗祷言<br><code>prayer-of-healing</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `healing`、`legacy-core-transaction` |
| 0 | 燃火术<br><code>produce-flame</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 3 | 防护能量伤害<br><code>protection-from-energy</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 2 | 防护毒素<br><code>protection-from-poison</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 0 | 冷冻射线<br><code>ray-of-frost</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `spell-attack`、`legacy-core-transaction` |
| 0 | 抗力术<br><code>resistance</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 0 | 圣火术<br><code>sacred-flame</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 1 | 庇护术<br><code>sanctuary</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 2 | 灼热射线<br><code>scorching-ray</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `spell-attack`、`legacy-core-transaction` |
| 2 | 识破隐形<br><code>see-invisibility</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 2 | 粉碎音波<br><code>shatter</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 1 | 护盾术<br><code>shield</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `armor-class-buff`、`legacy-core-transaction` |
| 1 | 虔诚护盾<br><code>shield-of-faith</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `armor-class-buff`、`legacy-core-transaction` |
| 0 | 橡棍术<br><code>shillelagh</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 0 | 电爪<br><code>shocking-grasp</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `spell-attack`、`legacy-core-transaction` |
| 2 | 沉默术<br><code>silence</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 1 | 睡眠术<br><code>sleep</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `sleep-hit-point-pool`、`legacy-core-transaction` |
| 3 | 雪雨暴<br><code>sleet-storm</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 3 | 缓慢术<br><code>slow</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 0 | 维生术<br><code>spare-the-dying</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `stabilize`、`legacy-core-transaction` |
| 2 | 荆棘丛生<br><code>spike-growth</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 3 | 灵体卫士<br><code>spirit-guardians</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 2 | 灵体武器<br><code>spiritual-weapon</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `spell-attack`、`legacy-core-transaction` |
| 3 | 臭云术<br><code>stinking-cloud</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 6 | 阳炎射线<br><code>sunbeam</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 8 | 阳炎爆<br><code>sunburst</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 0 | 奇术<br><code>thaumaturgy</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `narrative-effect`、`legacy-core-transaction` |
| 1 | 雷鸣波<br><code>thunderwave</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 3 | 吸血鬼之触<br><code>vampiric-touch</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `spell-attack`、`legacy-core-transaction` |
| 0 | 恶言相加<br><code>vicious-mockery</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 4 | 火墙术<br><code>wall-of-fire</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 5 | 力场墙<br><code>wall-of-force</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 6 | 冰墙术<br><code>wall-of-ice</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 5 | 石墙术<br><code>wall-of-stone</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 6 | 棘墙术<br><code>wall-of-thorns</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 2 | 守护之链<br><code>warding-bond</code> | 完整 Headless | 完整 Headless | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 2 | 蛛网术<br><code>web</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 3 | 风墙术<br><code>wind-wall</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |

## 可新增为完整 Headless

| 环级 | 法术 | 当前 | 目标 | 迁移动作 | 能力/阻塞代码 |
|---:|---|---|---|---|---|
| 2 | 援助术<br><code>aid</code> | DM/资料 | 完整 Headless | 新增完整实现 | `max-hit-points`、`slot-scaling` |
| 1 | 警报术<br><code>alarm</code> | DM/资料 | 完整 Headless | 新增完整实现 | `persistent-area`、`event-trigger`、`notification` |
| 1 | 化兽为友<br><code>animal-friendship</code> | DM/资料 | 完整 Headless | 新增完整实现 | `saving-throw`、`typed-target`、`condition-lifecycle` |
| 8 | 动物形态<br><code>animal-shapes</code> | DM/资料 | 完整 Headless | 新增完整实现 | `stat-transform`、`form-catalog`、`hit-point-handoff` |
| 5 | 防活物护罩<br><code>antilife-shell</code> | DM/资料 | 完整 Headless | 新增完整实现 | `persistent-area`、`typed-target`、`movement-blocking` |
| 4 | 秘法眼<br><code>arcane-eye</code> | DM/资料 | 完整 Headless | 新增完整实现 | `sensor-vision`、`entity-movement`、`darkvision` |
| 5 | 奥术之手<br><code>arcane-hand</code> | DM/资料 | 完整 Headless | 新增完整实现 | `summon-companion`、`granted-activity`、`contested-check` |
| 2 | 秘法锁<br><code>arcane-lock</code> | DM/资料 | 完整 Headless | 新增完整实现 | `door-state`、`password-state`、`dispel-state` |
| 7 | 奥术之剑<br><code>arcane-sword</code> | DM/资料 | 完整 Headless | 新增完整实现 | `summon-companion`、`granted-activity`、`spell-attack` |
| 3 | 希望信标<br><code>beacon-of-hope</code> | DM/资料 | 完整 Headless | 新增完整实现 | `saving-throw-modifier`、`maximum-healing`、`condition-immunity` |
| 3 | 闪现术<br><code>blink</code> | DM/资料 | 完整 Headless | 新增完整实现 | `random-table`、`planar-state`、`turn-trigger` |
| 2 | 印记斩<br><code>branding-smite</code> | DM/资料 | 完整 Headless | 新增完整实现 | `on-hit-rider`、`damage-scaling`、`visibility-effect` |
| 8 | 克隆术<br><code>clone</code> | DM/资料 | 完整 Headless | 新增完整实现 | `long-term-state`、`death-handoff`、`body-snapshot` |
| 1 | 命令术<br><code>command</code> | DM/资料 | 完整 Headless | 新增完整实现 | `saving-throw`、`mode-choice`、`turn-trigger`、`slot-scaling`、`language-immunity` |
| 1 | 通晓语言<br><code>comprehend-languages</code> | DM/资料 | 完整 Headless | 新增完整实现 | `language-capability`、`duration` |
| 4 | 强迫术<br><code>compulsion</code> | DM/资料 | 完整 Headless | 新增完整实现 | `saving-throw`、`forced-movement`、`turn-trigger` |
| 4 | 困惑术<br><code>confusion</code> | DM/资料 | 完整 Headless | 新增完整实现 | `saving-throw`、`random-table`、`save-ends`、`area-slot-scaling` |
| 5 | 疫病术<br><code>contagion</code> | DM/资料 | 完整 Headless | 新增完整实现 | `spell-attack`、`multi-save-counter`、`mode-choice` |
| 3 | 造粮术<br><code>create-food-and-water</code> | DM/资料 | 完整 Headless | 新增完整实现 | `item-generation`、`inventory-effect` |
| 7 | 延迟爆裂火球<br><code>delayed-blast-fireball</code> | DM/资料 | 完整 Headless | 新增完整实现 | `persistent-area`、`damage-accumulator`、`event-trigger`、`slot-scaling` |
| 5 | 反制善恶<br><code>dispel-evil-and-good</code> | DM/资料 | 完整 Headless | 新增完整实现 | `mode-choice`、`effect-removal`、`planar-state` |
| 7 | 圣言术<br><code>divine-word</code> | DM/资料 | 完整 Headless | 新增完整实现 | `hit-point-threshold`、`condition-lifecycle`、`planar-state` |
| 2 | 注目术<br><code>enthrall</code> | DM/资料 | 完整 Headless | 新增完整实现 | `saving-throw`、`skill-check-modifier`、`source-link` |
| 6 | 摄心目光<br><code>eyebite</code> | DM/资料 | 完整 Headless | 新增完整实现 | `mode-choice`、`saving-throw`、`save-ends` |
| 4 | 忠犬术<br><code>faithful-hound</code> | DM/资料 | 完整 Headless | 新增完整实现 | `persistent-area`、`granted-activity`、`visibility-rule` |
| 3 | 恐惧术<br><code>fear</code> | DM/资料 | 完整 Headless | 新增完整实现 | `saving-throw`、`forced-movement`、`condition-lifecycle` |
| 1 | 羽落术<br><code>feather-fall</code> | DM/资料 | 完整 Headless | 新增完整实现 | `reaction-trigger`、`falling-state`、`movement-rate` |
| 8 | 弱智术<br><code>feeblemind</code> | DM/资料 | 完整 Headless | 新增完整实现 | `saving-throw`、`ability-override`、`long-term-save` |
| 1 | 获得魔宠<br><code>find-familiar</code> | DM/资料 | 完整 Headless | 新增完整实现 | `summon-companion`、`form-catalog`、`shared-senses` |
| 4 | 火焰护盾<br><code>fire-shield</code> | DM/资料 | 完整 Headless | 新增完整实现 | `mode-choice`、`damage-resistance`、`damage-reflection` |
| 7 | 火焰风暴<br><code>fire-storm</code> | DM/资料 | 完整 Headless | 新增完整实现 | `multi-cell-template`、`saving-throw`、`damage` |
| 6 | 石化术<br><code>flesh-to-stone</code> | DM/资料 | 完整 Headless | 新增完整实现 | `saving-throw`、`multi-save-counter`、`condition-lifecycle` |
| 1 | 浮碟术<br><code>floating-disk</code> | DM/资料 | 完整 Headless | 新增完整实现 | `summon-companion`、`source-following`、`carry-capacity` |
| 7 | 魔力监牢<br><code>forcecage</code> | DM/资料 | 完整 Headless | 新增完整实现 | `persistent-area`、`movement-blocking`、`teleport-save` |
| 9 | 预警术<br><code>foresight</code> | DM/资料 | 完整 Headless | 新增完整实现 | `roll-mode-modifier`、`condition-immunity`、`duration` |
| 4 | 行动自如<br><code>freedom-of-movement</code> | DM/资料 | 完整 Headless | 新增完整实现 | `condition-immunity`、`movement-modifier`、`automatic-escape` |
| 3 | 气化形体<br><code>gaseous-form</code> | DM/资料 | 完整 Headless | 新增完整实现 | `stat-transform`、`movement-mode`、`action-restriction` |
| 2 | 遗体防腐<br><code>gentle-repose</code> | DM/资料 | 完整 Headless | 新增完整实现 | `corpse-state`、`duration`、`resurrection-timer` |
| 1 | 神莓术<br><code>goodberry</code> | DM/资料 | 完整 Headless | 新增完整实现 | `item-generation`、`healing`、`inventory-effect` |
| 5 | 高等复原术<br><code>greater-restoration</code> | DM/资料 | 完整 Headless | 新增完整实现 | `mode-choice`、`effect-removal`、`ability-restoration` |
| 4 | 信仰守卫<br><code>guardian-of-faith</code> | DM/资料 | 完整 Headless | 新增完整实现 | `persistent-area`、`saving-throw`、`damage-pool` |
| 2 | 造风术<br><code>gust-of-wind</code> | DM/资料 | 完整 Headless | 新增完整实现 | `persistent-area`、`forced-movement`、`area-movement` |
| 3 | 加速术<br><code>haste</code> | DM/资料 | 完整 Headless | 新增完整实现 | `effect-modifier`、`restricted-extra-action`、`expiry-penalty` |
| 6 | 英雄宴<br><code>heroes-feast</code> | DM/资料 | 完整 Headless | 新增完整实现 | `max-hit-points`、`condition-immunity`、`saving-throw-modifier` |
| 8 | 圣洁灵光<br><code>holy-aura</code> | DM/资料 | 完整 Headless | 新增完整实现 | `roll-mode-modifier`、`typed-target`、`reaction-trigger` |
| 1 | 鉴定术<br><code>identify</code> | DM/资料 | 完整 Headless | 新增完整实现 | `metadata-visibility`、`effect-detection`、`inventory-effect` |
| 8 | 焚云术<br><code>incendiary-cloud</code> | DM/资料 | 完整 Headless | 新增完整实现 | `persistent-area`、`saving-throw`、`area-lifecycle` |
| 6 | 瞬间召唤<br><code>instant-summons</code> | DM/资料 | 完整 Headless | 新增完整实现 | `item-link`、`planar-state`、`inventory-effect` |
| 6 | 迷舞术<br><code>irresistible-dance</code> | DM/资料 | 完整 Headless | 新增完整实现 | `effect-modifier`、`saving-throw`、`action-escape` |
| 2 | 敲击术<br><code>knock</code> | DM/资料 | 完整 Headless | 新增完整实现 | `door-state`、`object-unlock`、`sound-event` |
| 5 | 通晓传奇<br><code>legend-lore</code> | DM/资料 | 完整 Headless | 新增完整实现 | `resolve-only` |
| 2 | 浮空术<br><code>levitate</code> | DM/资料 | 完整 Headless | 新增完整实现 | `saving-throw`、`vertical-movement`、`source-control` |
| 0 | 光亮术<br><code>light</code> | DM/资料 | 完整 Headless | 新增完整实现 | `light-source`、`object-enchantment`、`saving-throw` |
| 3 | 防护法阵<br><code>magic-circle</code> | DM/资料 | 完整 Headless | 新增完整实现 | `persistent-area`、`typed-target`、`movement-blocking` |
| 6 | 魔魂壶<br><code>magic-jar</code> | DM/资料 | 完整 Headless | 新增完整实现 | `planar-state`、`actor-control`、`body-snapshot` |
| 2 | 魔嘴术<br><code>magic-mouth</code> | DM/资料 | 完整 Headless | 新增完整实现 | `object-enchantment`、`open-text-trigger`、`communication` |
| 8 | 迷宫术<br><code>maze</code> | DM/资料 | 完整 Headless | 新增完整实现 | `planar-state`、`ability-check`、`turn-trigger` |
| 3 | 融身入石<br><code>meld-into-stone</code> | DM/资料 | 完整 Headless | 新增完整实现 | `terrain-geometry`、`planar-state`、`ejection-damage` |
| 0 | 传讯术<br><code>message</code> | DM/资料 | 完整 Headless | 新增完整实现 | `action-economy` |
| 8 | 心灵屏障<br><code>mind-blank</code> | DM/资料 | 完整 Headless | 新增完整实现 | `damage-immunity`、`condition-immunity`、`effect-suppression` |
| 2 | 镜影术<br><code>mirror-image</code> | DM/资料 | 完整 Headless | 新增完整实现 | `attack-redirection`、`duplicate-counter`、`attack-resolution` |
| 5 | 假象术<br><code>mislead</code> | DM/资料 | 完整 Headless | 新增完整实现 | `sensor-vision`、`invisibility`、`entity-movement` |
| 3 | 回避侦测<br><code>nondetection</code> | DM/资料 | 完整 Headless | 新增完整实现 | `effect-suppression`、`duration`、`targeting-immunity` |
| 2 | 行动无踪<br><code>pass-without-trace</code> | DM/资料 | 完整 Headless | 新增完整实现 | `skill-check-modifier`、`source-aura`、`tracking-suppression` |
| 5 | 穿墙术<br><code>passwall</code> | DM/资料 | 完整 Headless | 新增完整实现 | `terrain-geometry`、`movement-blocking`、`duration` |
| 3 | 魅影驹<br><code>phantom-steed</code> | DM/资料 | 完整 Headless | 新增完整实现 | `summon-companion`、`movement-mode`、`duration` |
| 4 | 变形术<br><code>polymorph</code> | DM/资料 | 完整 Headless | 新增完整实现 | `stat-transform`、`form-catalog`、`hit-point-handoff` |
| 7 | 投影术<br><code>project-image</code> | DM/资料 | 完整 Headless | 新增完整实现 | `sensor-vision`、`entity-movement` |
| 1 | 防护善恶<br><code>protection-from-evil-and-good</code> | DM/资料 | 完整 Headless | 新增完整实现 | `typed-target`、`roll-mode-modifier`、`condition-immunity` |
| 1 | 净化食粮<br><code>purify-food-and-drink</code> | DM/资料 | 完整 Headless | 新增完整实现 | `world-object`、`effect-removal`、`inventory-effect` |
| 5 | 死者复活<br><code>raise-dead</code> | DM/资料 | 完整 Headless | 新增完整实现 | `death-handoff`、`condition-restoration`、`long-term-penalty` |
| 2 | 衰弱射线<br><code>ray-of-enfeeblement</code> | DM/资料 | 完整 Headless | 新增完整实现 | `spell-attack`、`damage-multiplier`、`save-ends` |
| 7 | 再生术<br><code>regenerate</code> | DM/资料 | 完整 Headless | 新增完整实现 | `healing`、`periodic-healing`、`body-restoration` |
| 3 | 移除诅咒<br><code>remove-curse</code> | DM/资料 | 完整 Headless | 新增完整实现 | `effect-removal`、`item-link`、`duration` |
| 4 | 弹力法球<br><code>resilient-sphere</code> | DM/资料 | 完整 Headless | 新增完整实现 | `saving-throw`、`persistent-area`、`movement-blocking` |
| 7 | 复生术<br><code>resurrection</code> | DM/资料 | 完整 Headless | 新增完整实现 | `death-handoff`、`condition-restoration`、`long-term-penalty` |
| 7 | 反重力<br><code>reverse-gravity</code> | DM/资料 | 完整 Headless | 新增完整实现 | `persistent-area`、`vertical-movement`、`falling-state` |
| 3 | 回生术<br><code>revivify</code> | DM/资料 | 完整 Headless | 新增完整实现 | `death-handoff`、`resurrection-timer`、`healing` |
| 4 | 秘藏箱<br><code>secret-chest</code> | DM/资料 | 完整 Headless | 新增完整实现 | `item-link`、`planar-state`、`inventory-effect` |
| 7 | 拟像术<br><code>simulacrum</code> | DM/资料 | 完整 Headless | 新增完整实现 | `body-snapshot`、`summon-companion`、`resource-restriction` |
| 2 | 蛛行术<br><code>spider-climb</code> | DM/资料 | 完整 Headless | 新增完整实现 | `movement-mode`、`duration`、`concentration` |
| 4 | 石肤术<br><code>stoneskin</code> | DM/资料 | 完整 Headless | 新增完整实现 | `damage-resistance`、`damage-qualification`、`concentration` |
| 9 | 复仇风暴<br><code>storm-of-vengeance</code> | DM/资料 | 完整 Headless | 新增完整实现 | `persistent-area`、`round-timeline`、`multi-effect` |
| 5 | 心灵联结<br><code>telepathic-bond</code> | DM/资料 | 完整 Headless | 新增完整实现 | `communication`、`language-capability`、`duration` |
| 9 | 时间停止<br><code>time-stop</code> | DM/资料 | 完整 Headless | 新增完整实现 | `extra-turns`、`random-table`、`effect-break` |
| 3 | 小屋术<br><code>tiny-hut</code> | DM/资料 | 完整 Headless | 新增完整实现 | `persistent-area`、`movement-blocking`、`occupant-permissions` |
| 3 | 巧言术<br><code>tongues</code> | DM/资料 | 完整 Headless | 新增完整实现 | `language-capability`、`communication`、`duration` |
| 9 | 完全复生术<br><code>true-resurrection</code> | DM/资料 | 完整 Headless | 新增完整实现 | `death-handoff`、`body-restoration`、`condition-restoration` |
| 6 | 真知术<br><code>true-seeing</code> | DM/资料 | 完整 Headless | 新增完整实现 | `sensor-vision`、`effect-detection`、`planar-sight` |
| 0 | 克敌机先<br><code>true-strike</code> | DM/资料 | 完整 Headless | 新增完整实现 | `target-linked-effect`、`roll-mode-modifier`、`concentration` |
| 1 | 隐形仆役<br><code>unseen-servant</code> | DM/资料 | 完整 Headless | 新增完整实现 | `summon-companion`、`granted-activity`、`semantic-task` |
| 3 | 水下呼吸<br><code>water-breathing</code> | DM/资料 | 完整 Headless | 新增完整实现 | `movement-capability`、`duration`、`multi-target` |
| 3 | 水上行走<br><code>water-walk</code> | DM/资料 | 完整 Headless | 新增完整实现 | `movement-mode`、`multi-target`、`duration` |
| 9 | 怪影杀手<br><code>weird</code> | DM/资料 | 完整 Headless | 新增完整实现 | `saving-throw`、`condition-lifecycle`、`periodic-damage` |
| 6 | 御风而行<br><code>wind-walk</code> | DM/资料 | 完整 Headless | 新增完整实现 | `stat-transform`、`movement-mode`、`transition-timer` |

## 只能新增为半自动

| 环级 | 法术 | 当前 | 目标 | 迁移动作 | 能力/阻塞代码 |
|---:|---|---|---|---|---|
| 2 | 变身术<br><code>alter-self</code> | DM/资料 | 半自动 | 新增机械部分 | `mode-choice`、`stat-transform`、`illusory-content` |
| 2 | 动物信使<br><code>animal-messenger</code> | DM/资料 | 半自动 | 新增机械部分 | `timed-delivery`、`semantic-destination`、`npc-response` |
| 3 | 操纵死尸<br><code>animate-dead</code> | DM/资料 | 半自动 | 新增机械部分 | `summon-companion`、`material-targeting`、`dm-creature-choice` |
| 5 | 活化物件<br><code>animate-objects</code> | DM/资料 | 半自动 | 新增机械部分 | `summon-companion`、`world-object`、`dm-damage-type` |
| 8 | 反魔法力场<br><code>antimagic-field</code> | DM/资料 | 半自动 | 新增机械部分 | `persistent-area`、`magic-suppression`、`source-anchoring`、`movement-gap` |
| 8 | 嫌恶/关怀术<br><code>antipathy-sympathy</code> | DM/资料 | 半自动 | 新增机械部分 | `persistent-area`、`typed-target`、`semantic-creature-category` |
| 2 | 奥法师魔法灵光<br><code>arcanists-magic-aura</code> | DM/资料 | 半自动 | 新增机械部分 | `metadata-override`、`semantic-detection`、`long-term-state` |
| 9 | 星界投影<br><code>astral-projection</code> | DM/资料 | 半自动 | 新增机械部分 | `planar-state`、`cross-scene`、`death-handoff` |
| 5 | 启蒙术<br><code>awaken</code> | DM/资料 | 半自动 | 新增机械部分 | `ability-override`、`condition-lifecycle`、`npc-personality` |
| 4 | 放逐术<br><code>banishment</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 3 | 降咒<br><code>bestow-curse</code> | DM/资料 | 半自动 | 新增机械部分 | `mode-choice`、`effect-modifier`、`open-ended-option` |
| 6 | 剑刃护壁<br><code>blade-barrier</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 3 | 召雷术<br><code>call-lightning</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 2 | 安定心神<br><code>calm-emotions</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 3 | 鹰眼术<br><code>clairvoyance</code> | DM/资料 | 半自动 | 新增机械部分 | `sensor-vision`、`cross-scene`、`semantic-location` |
| 5 | 死云术<br><code>cloudkill</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 3 | 召唤动物<br><code>conjure-animals</code> | DM/资料 | 半自动 | 新增机械部分 | `summon-companion`、`count-choice`、`dm-creature-choice` |
| 7 | 召唤天界生物<br><code>conjure-celestial</code> | DM/资料 | 半自动 | 新增机械部分 | `summon-companion`、`slot-scaling`、`dm-creature-choice` |
| 5 | 召唤元素生物<br><code>conjure-elemental</code> | DM/资料 | 半自动 | 新增机械部分 | `summon-companion`、`material-targeting`、`dm-creature-choice` |
| 6 | 召唤精类生物<br><code>conjure-fey</code> | DM/资料 | 半自动 | 新增机械部分 | `summon-companion`、`slot-scaling`、`dm-creature-choice` |
| 4 | 召唤次级元素生物<br><code>conjure-minor-elementals</code> | DM/资料 | 半自动 | 新增机械部分 | `summon-companion`、`count-choice`、`dm-creature-choice` |
| 4 | 召唤林地之精<br><code>conjure-woodland-beings</code> | DM/资料 | 半自动 | 新增机械部分 | `summon-companion`、`count-choice`、`dm-creature-choice` |
| 5 | 异界探知<br><code>contact-other-plane</code> | DM/资料 | 半自动 | 新增机械部分 | `voice-response`、`saving-throw`、`random-damage` |
| 6 | 触发术<br><code>contingency</code> | DM/资料 | 半自动 | 新增机械部分 | `invoke-activity`、`open-text-trigger`、`spell-storage` |
| 2 | 不灭明焰<br><code>continual-flame</code> | DM/资料 | 半自动 | 新增机械部分 | `light-source`、`object-enchantment`、`dm-object-narration`、`dispel-state` |
| 4 | 操控水体<br><code>control-water</code> | DM/资料 | 半自动 | 新增机械部分 | `mode-choice`、`terrain-geometry`、`environment-state` |
| 8 | 操控天气<br><code>control-weather</code> | DM/资料 | 半自动 | 新增机械部分 | `mode-choice`、`environment-state`、`dm-initial-state` |
| 6 | 唤起死灵<br><code>create-undead</code> | DM/资料 | 半自动 | 新增机械部分 | `summon-companion`、`material-targeting`、`dm-creature-choice` |
| 1 | 造水/枯水术<br><code>create-or-destroy-water</code> | DM/资料 | 半自动 | 新增机械部分 | `mode-choice`、`world-object`、`terrain-geometry` |
| 5 | 造物术<br><code>creation</code> | DM/资料 | 半自动 | 新增机械部分 | `object-creation`、`open-ended-object`、`duration-by-material` |
| 2 | 黑暗术<br><code>darkness</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 3 | 昼明术<br><code>daylight</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 8 | 创造半位面<br><code>demiplane</code> | DM/资料 | 半自动 | 新增机械部分 | `cross-scene`、`door-state`、`semantic-destination` |
| 1 | 侦测善恶<br><code>detect-evil-and-good</code> | DM/资料 | 半自动 | 新增机械部分 | `persistent-sense`、`typed-target`、`effect-detection`、`consecrated-object-gap`、`barrier-material-thickness-gap` |
| 1 | 侦测魔法<br><code>detect-magic</code> | DM/资料 | 半自动 | 新增机械部分 | `persistent-sense`、`effect-detection`、`magic-item-detection`、`metadata-visibility`、`world-object-gap`、`barrier-material-thickness-gap` |
| 1 | 侦测毒性和疾病<br><code>detect-poison-and-disease</code> | DM/资料 | 半自动 | 新增机械部分 | `persistent-sense`、`effect-detection`、`typed-target`、`world-object-gap`、`poison-kind-gap`、`barrier-material-thickness-gap` |
| 2 | 侦测思想<br><code>detect-thoughts</code> | DM/资料 | 半自动 | 新增机械部分 | `saving-throw`、`sensor-information`、`dm-response` |
| 4 | 任意门<br><code>dimension-door</code> | DM/资料 | 半自动 | 新增机械部分 | `teleport`、`passenger-movement`、`off-map-destination` |
| 1 | 易容术<br><code>disguise-self</code> | DM/资料 | 半自动 | 新增机械部分 | `illusory-content`、`ability-check`、`dm-interpretation` |
| 4 | 支配野兽<br><code>dominate-beast</code> | DM/资料 | 半自动 | 新增机械部分 | `saving-throw`、`actor-control`、`semantic-command` |
| 8 | 支配怪物<br><code>dominate-monster</code> | DM/资料 | 半自动 | 新增机械部分 | `saving-throw`、`actor-control`、`semantic-command` |
| 5 | 支配人类<br><code>dominate-person</code> | DM/资料 | 半自动 | 新增机械部分 | `saving-throw`、`actor-control`、`semantic-command` |
| 5 | 托梦术<br><code>dream</code> | DM/资料 | 半自动 | 新增机械部分 | `communication`、`saving-throw`、`dm-narrative` |
| 0 | 德鲁伊伎俩<br><code>druidcraft</code> | DM/资料 | 半自动 | 新增机械部分 | `mode-choice`、`minor-world-effect`、`dm-weather` |
| 8 | 地震术<br><code>earthquake</code> | DM/资料 | 半自动 | 新增机械部分 | `persistent-area`、`terrain-geometry`、`structure-damage` |
| 2 | 变巨/缩小术<br><code>enlarge-reduce</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 7 | 以太化<br><code>etherealness</code> | DM/资料 | 半自动 | 新增机械部分 | `planar-state`、`movement-mode`、`effect-suppression`、`slot-scaling-gap` |
| 4 | 鬼斧神工<br><code>fabricate</code> | DM/资料 | 半自动 | 新增机械部分 | `object-creation`、`world-material`、`crafting-judgment` |
| 1 | 妖火<br><code>faerie-fire</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 2 | 召唤坐骑<br><code>find-steed</code> | DM/资料 | 半自动 | 新增机械部分 | `summon-companion`、`shared-spells`、`dm-creature-choice` |
| 2 | 寻找陷阱<br><code>find-traps</code> | DM/资料 | 半自动 | 新增机械部分 | `world-information`、`hidden-object-tags`、`dm-information` |
| 6 | 寻路术<br><code>find-the-path</code> | DM/资料 | 半自动 | 新增机械部分 | `world-navigation`、`semantic-destination`、`dm-information` |
| 7 | 死亡一指<br><code>finger-of-death</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 6 | 禁制术<br><code>forbiddance</code> | DM/资料 | 半自动 | 新增机械部分 | `persistent-area`、`typed-target`、`teleport-blocking`、`turn-trigger-gap` |
| 6 | 冰封法球<br><code>freezing-sphere</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 9 | 异界之门<br><code>gate</code> | DM/资料 | 半自动 | 新增机械部分 | `cross-scene`、`summon-companion`、`deity-veto` |
| 5 | 指使术<br><code>geas</code> | DM/资料 | 半自动 | 新增机械部分 | `saving-throw`、`semantic-command`、`semantic-compliance` |
| 4 | 巨虫术<br><code>giant-insect</code> | DM/资料 | 半自动 | 新增机械部分 | `stat-transform`、`form-catalog`、`dm-actor-control` |
| 8 | 花言巧语<br><code>glibness</code> | DM/资料 | 半自动 | 新增机械部分 | `minimum-roll`、`truth-detection-gap` |
| 6 | 法术无效结界<br><code>globe-of-invulnerability</code> | DM/资料 | 半自动 | 新增机械部分 | `persistent-area`、`spell-level-suppression` |
| 3 | 守卫刻文<br><code>glyph-of-warding</code> | DM/资料 | 半自动 | 新增机械部分 | `persistent-area`、`open-text-trigger`、`spell-storage` |
| 6 | 铜墙铁壁<br><code>guards-and-wards</code> | DM/资料 | 半自动 | 新增机械部分 | `multi-area`、`door-state`、`illusory-content` |
| 5 | 圣居<br><code>hallow</code> | DM/资料 | 半自动 | 新增机械部分 | `persistent-area`、`mode-choice`、`open-ended-exclusions` |
| 4 | 幻景<br><code>hallucinatory-terrain</code> | DM/资料 | 半自动 | 新增机械部分 | `terrain-geometry`、`illusory-content`、`dm-interpretation` |
| 1 | 迷幻手稿<br><code>illusory-script</code> | DM/资料 | 半自动 | 新增机械部分 | `illusory-content`、`reader-identity`、`dm-interpretation` |
| 9 | 禁锢术<br><code>imprisonment</code> | DM/资料 | 半自动 | 新增机械部分 | `mode-choice`、`planar-state`、`open-text-release` |
| 5 | 疫病虫群<br><code>insect-plague</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 2 | 动植物定位术<br><code>locate-animals-or-plants</code> | DM/资料 | 半自动 | 新增机械部分 | `world-information`、`semantic-target`、`off-map-search` |
| 4 | 生物定位术<br><code>locate-creature</code> | DM/资料 | 半自动 | 新增机械部分 | `world-information`、`semantic-target`、`off-map-search` |
| 2 | 物件定位术<br><code>locate-object</code> | DM/资料 | 半自动 | 新增机械部分 | `world-information`、`semantic-target`、`off-map-search` |
| 0 | 法师之手<br><code>mage-hand</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 7 | 豪宅术<br><code>magnificent-mansion</code> | DM/资料 | 半自动 | 新增机械部分 | `cross-scene`、`object-creation`、`dm-layout` |
| 3 | 高等幻影<br><code>major-image</code> | DM/资料 | 半自动 | 新增机械部分 | `illusory-content`、`sensor-vision`、`dm-interpretation` |
| 6 | 群体暗示术<br><code>mass-suggestion</code> | DM/资料 | 半自动 | 新增机械部分 | `saving-throw`、`semantic-command`、`semantic-compliance` |
| 0 | 修复术<br><code>mending</code> | DM/资料 | 半自动 | 新增机械部分 | `world-object`、`repair-state`、`dm-object-fit` |
| 7 | 海市蜃楼<br><code>mirage-arcane</code> | DM/资料 | 半自动 | 新增机械部分 | `terrain-geometry`、`illusory-content`、`world-state` |
| 5 | 篡改记忆<br><code>modify-memory</code> | DM/资料 | 半自动 | 新增机械部分 | `saving-throw`、`semantic-memory`、`dm-interpretation` |
| 6 | 地动术<br><code>move-earth</code> | DM/资料 | 半自动 | 新增机械部分 | `terrain-geometry`、`world-state`、`dm-interpretation` |
| 6 | 异界盟誓<br><code>planar-ally</code> | DM/资料 | 半自动 | 新增机械部分 | `summon-companion`、`dm-creature-choice`、`semantic-bargain` |
| 5 | 异界誓缚<br><code>planar-binding</code> | DM/资料 | 半自动 | 新增机械部分 | `saving-throw`、`actor-control`、`semantic-command` |
| 7 | 异界传送<br><code>plane-shift</code> | DM/资料 | 半自动 | 新增机械部分 | `spell-attack`、`saving-throw`、`cross-scene` |
| 3 | 植物滋长<br><code>plant-growth</code> | DM/资料 | 半自动 | 新增机械部分 | `persistent-area`、`terrain-geometry`、`long-term-world-state` |
| 2 | 治疗祷言<br><code>prayer-of-healing</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `healing`、`legacy-core-transaction` |
| 0 | 魔法伎俩<br><code>prestidigitation</code> | DM/资料 | 半自动 | 新增机械部分 | `mode-choice`、`minor-world-effect`、`open-ended-content` |
| 7 | 虹光喷射<br><code>prismatic-spray</code> | DM/资料 | 半自动 | 新增机械部分 | `saving-throw`、`random-table`、`dm-planar-destination` |
| 9 | 虹光法墙<br><code>prismatic-wall</code> | DM/资料 | 半自动 | 新增机械部分 | `persistent-area`、`layered-effects`、`dm-planar-destination` |
| 4 | 私人密室<br><code>private-sanctum</code> | DM/资料 | 半自动 | 新增机械部分 | `persistent-area`、`sensor-blocking`、`teleport-blocking`、`slot-scaling-gap` |
| 0 | 燃火术<br><code>produce-flame</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 6 | 预置幻影<br><code>programmed-illusion</code> | DM/资料 | 半自动 | 新增机械部分 | `illusory-content`、`open-text-trigger`、`dm-interpretation` |
| 5 | 转生术<br><code>reincarnate</code> | DM/资料 | 半自动 | 新增机械部分 | `death-handoff`、`random-table`、`dm-form-choice` |
| 2 | 魔绳术<br><code>rope-trick</code> | DM/资料 | 半自动 | 新增机械部分 | `cross-scene`、`persistent-area`、`semantic-entry` |
| 5 | 探知<br><code>scrying</code> | DM/资料 | 半自动 | 新增机械部分 | `saving-throw`、`sensor-vision`、`cross-scene` |
| 2 | 识破隐形<br><code>see-invisibility</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 5 | 伪装术<br><code>seeming</code> | DM/资料 | 半自动 | 新增机械部分 | `saving-throw`、`illusory-content`、`dm-interpretation` |
| 3 | 短讯术<br><code>sending</code> | DM/资料 | 半自动 | 新增机械部分 | `communication`、`cross-scene`、`npc-response` |
| 7 | 隔离术<br><code>sequester</code> | DM/资料 | 半自动 | 新增机械部分 | `invisibility`、`open-text-trigger`、`long-term-state` |
| 9 | 形体变化<br><code>shapechange</code> | DM/资料 | 半自动 | 新增机械部分 | `stat-transform`、`form-catalog`、`dm-equipment-fit` |
| 0 | 橡棍术<br><code>shillelagh</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `active-effect`、`legacy-core-transaction` |
| 2 | 沉默术<br><code>silence</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 1 | 无声幻影<br><code>silent-image</code> | DM/资料 | 半自动 | 新增机械部分 | `illusory-content`、`entity-movement`、`dm-interpretation` |
| 3 | 雪雨暴<br><code>sleet-storm</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 3 | 缓慢术<br><code>slow</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `saving-throw`、`legacy-core-transaction` |
| 3 | 植物交谈<br><code>speak-with-plants</code> | DM/资料 | 半自动 | 新增机械部分 | `communication`、`terrain-state`、`dm-response` |
| 2 | 荆棘丛生<br><code>spike-growth</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 3 | 臭云术<br><code>stinking-cloud</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 4 | 塑石术<br><code>stone-shape</code> | DM/资料 | 半自动 | 新增机械部分 | `terrain-geometry`、`world-object`、`dm-interpretation` |
| 2 | 暗示术<br><code>suggestion</code> | DM/资料 | 半自动 | 新增机械部分 | `saving-throw`、`semantic-command`、`semantic-compliance` |
| 7 | 魔法徽记<br><code>symbol</code> | DM/资料 | 半自动 | 新增机械部分 | `persistent-area`、`open-text-trigger`、`mode-choice` |
| 5 | 心灵遥控<br><code>telekinesis</code> | DM/资料 | 半自动 | 新增机械部分 | `contested-check`、`forced-movement`、`world-object` |
| 7 | 传送术<br><code>teleport</code> | DM/资料 | 半自动 | 新增机械部分 | `random-table`、`cross-scene`、`semantic-familiarity` |
| 5 | 传送法阵<br><code>teleportation-circle</code> | DM/资料 | 半自动 | 新增机械部分 | `persistent-area`、`cross-scene`、`world-registry` |
| 0 | 奇术<br><code>thaumaturgy</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `narrative-effect`、`legacy-core-transaction` |
| 6 | 木遁术<br><code>transport-via-plants</code> | DM/资料 | 半自动 | 新增机械部分 | `world-object`、`cross-scene`、`semantic-destination` |
| 5 | 树跃术<br><code>tree-stride</code> | DM/资料 | 半自动 | 新增机械部分 | `world-object`、`teleport`、`off-map-destination` |
| 9 | 完全变形术<br><code>true-polymorph</code> | DM/资料 | 半自动 | 新增机械部分 | `stat-transform`、`object-transform`、`open-ended-form` |
| 5 | 力场墙<br><code>wall-of-force</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 6 | 冰墙术<br><code>wall-of-ice</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 5 | 石墙术<br><code>wall-of-stone</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 6 | 棘墙术<br><code>wall-of-thorns</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 2 | 蛛网术<br><code>web</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 3 | 风墙术<br><code>wind-wall</code> | DM/资料 | 半自动 | 迁移为原生 Activity | `persistent-area`、`legacy-core-transaction` |
| 9 | 祈愿术<br><code>wish</code> | DM/资料 | 半自动 | 新增机械部分 | `invoke-activity`、`bounded-safe-options`、`open-ended-effect` |
| 6 | 回返真言<br><code>word-of-recall</code> | DM/资料 | 半自动 | 新增机械部分 | `teleport`、`cross-scene`、`configured-sanctuary` |
| 2 | 诚实之域<br><code>zone-of-truth</code> | DM/资料 | 半自动 | 新增机械部分 | `persistent-area`、`saving-throw`、`semantic-compliance` |

## 保留 DM/资料模式

| 环级 | 法术 | 当前 | 目标 | 迁移动作 | 能力/阻塞代码 |
|---:|---|---|---|---|---|
| 2 | 卜筮术<br><code>augury</code> | DM/资料 | DM/资料 | 保留 DM | `dm-response`、`future-information` |
| 5 | 通神术<br><code>commune</code> | DM/资料 | DM/资料 | 保留 DM | `dm-response`、`future-information` |
| 5 | 问道自然<br><code>commune-with-nature</code> | DM/资料 | DM/资料 | 保留 DM | `dm-response`、`world-information` |
| 4 | 预言术<br><code>divination</code> | DM/资料 | DM/资料 | 保留 DM | `dm-response`、`future-information` |
| 1 | 动物交谈术<br><code>speak-with-animals</code> | DM/资料 | DM/资料 | 保留 DM | `communication`、`npc-response` |
| 3 | 死者交谈<br><code>speak-with-dead</code> | DM/资料 | DM/资料 | 保留 DM | `communication`、`npc-response` |
