# SRD 5.1 怪物目录与怪物工坊

## 数据来源与生成

核心目录包含 334 个 SRD 5.1 怪物。`scripts/generate-srd-monsters.mjs` 从固定提交的 `5e-bits/5e-database` 英文转录生成 `src/rulesets/dnd5e/generated/srdMonsters.generated.json`；生成物同时记录官方 SRD 5.1 PDF、CC BY 4.0、转录仓库和提交哈希。应用运行时不访问外部怪物 API，也不会因上游更新而静默改变规则。

更新命令：

```powershell
npm run generate:srd-monsters
```

离线审计可用 `--source <本地 5e-SRD-Monsters.json>`。生成器要求至少 300 个条目、拒绝重复 ID，并把属性、AC、HP、速度、豁免、技能、伤害防护、感官、CR、XP、特性、动作、反应、传奇动作和施法摘要转换成项目 schema。原有 19 个已人工核对的中文条目在运行时按 slug 覆盖生成条目。

## 自动结算边界

- 纯命中＋伤害的武器攻击可标记为 `headless`。
- 仅由 Headless 武器攻击组成的多重攻击可标记为 `headless`。
- 带豁免、状态、擒抱、吞咽、位移、再生、半血伤害变化、充能、范围、变形或时机语义的动作标记为 `dm-adjudication`。
- 施法、反应、传奇动作和巢穴动作当前保留结构化栏目与完整正文，但默认由 DM 裁定。
- Headless resolver、自动怪物回合和借机攻击入口都会再次检查该标记；客户端不能把 `dm-adjudication` 动作改报为普通攻击。

## 房间怪物工坊

DM 可在地图的怪物选择器中打开“怪物工坊”。基础资料、六项属性、速度、特性和攻击会转换成 `Dnd5eMonsterStatBlock`，然后依次经过：

1. `monsterSchema` 字段、范围、骰式、动作引用和 Headless 结构校验；
2. `custom-monsters` 房间资源边界校验；
3. DM 权威共享写入；
4. 玩家端失效通知、重新读取和只读注册。

自定义条目使用 `room-monster:` 命名空间，最多 512 个。它们可以导入／导出 JSON，也能像 SRD 怪物一样放置为 Token、参与先攻、移动、XP 统计和已声明为 Headless 的攻击。删除模板不会删除地图上已有 Token，但该 Token 会失去 stat block，因此界面会在删除前警告。

## 尚未机械化

目录完整不等于所有能力都已自动结算。下一阶段仍需分别实现传奇动作时机与资源、怪物法术位/施法表、充能、再生抑制条件、群集半血伤害、变形状态池，以及飞行高度和水下战斗环境规则。实现前这些能力继续由 DM 按正文裁定。
