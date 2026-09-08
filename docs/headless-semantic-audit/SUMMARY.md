# D&D 5e Headless 语义完整性审查

生成时间：2026-08-21T00:46:24.457Z

## 审查口径

本报告不采用 `automation: headless`、UI 徽章或 schema 通过作为“完整自动化”的证据。每条规则同时核对原文语义、结构化定义、生产运行时消费者与直接测试。

- **verified-full**：未发现原文语义缺口；复杂规则具有生产消费者和直接测试。
- **implemented-unverified**：结构与消费者看似存在，但缺少该条目的直接结算测试。
- **semantic-gap / structural-gap**：原文条款未进入结构、消费者缺失或结构无效。
- **partial / manual / combat-manual-gap**：仍存在明确或隐含 DM 裁定；其中 combat-manual-gap 会直接影响战斗。

## 总览

| 范围 | 总数 | 状态统计 |
| --- | ---: | --- |
| 法术 | 319 | manual 7；partial 98；verified-full 214 |
| 怪物动作 | 1078 | manual 56；non-combat 15；verified-full 1007 |
| 怪物特质 | 551 | combat-manual-gap 104；delegated-to-monster-spells 36；excluded-narrative-transform 38；exploration-manual-gap 93；non-combat-or-narrative 108；verified-full 172 |
| 怪物法术引用 | 313 | semantic-gap 206；verified-full 107 |

## 高置信语义缺口

### 法术（0）

- 无

### 已标 Headless、但原文条款未闭环的怪物动作（0）

- 无

### 结构缺失怪物动作（0）

- 无

### 仍由 DM 裁定的战斗特质（104）

- Sunlight Sensitivity：7 个怪物实例
- Incorporeal Movement：4 个怪物实例
- Rejuvenation：4 个怪物实例
- Siege Monster：4 个怪物实例
- Vampire Weaknesses：4 个怪物实例
- Antimagic Susceptibility：3 个怪物实例
- Heated Body：3 个怪物实例
- Immutable Form：3 个怪物实例
- Misty Escape：3 个怪物实例
- Sure-Footed：3 个怪物实例
- Brave：2 个怪物实例
- Brute：2 个怪物实例
- Charge (Boar or Hybrid Form Only)：2 个怪物实例
- Damage Transfer：2 个怪物实例
- Dark Devotion：2 个怪物实例
- Elemental Demise：2 个怪物实例
- Fey Ancestry：2 个怪物实例
- Heated Weapons：2 个怪物实例
- Inscrutable：2 个怪物实例
- Rampage：2 个怪物实例
- Aberrant Ground：1 个怪物实例
- Acid Absorption：1 个怪物实例
- Adhesive (Object Form Only)：1 个怪物实例
- Aggressive：1 个怪物实例
- Barbed Hide：1 个怪物实例
- Berserk：1 个怪物实例
- Bound：1 个怪物实例
- Confer Fire Resistance：1 个怪物实例
- Consume Life：1 个怪物实例
- Corrode Metal：1 个怪物实例

### 怪物施法兼容缺口

共有 206 次法术引用、89 个不同法术没有通过完整怪物施法语义审查。逐个怪物和法术见 `monster-spells.csv`。

## 重要限制

静态语义审查能证明“字段与消费者是否存在”，不能替代浏览器内完整战斗 E2E。因此所有缺少逐条直接测试的复杂能力都保守列为 implemented-unverified，而不是完整。

逐条结果见同目录 CSV；完整机器可读证据见 `report.json`。
