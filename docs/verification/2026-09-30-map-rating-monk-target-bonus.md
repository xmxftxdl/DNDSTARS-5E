# 地图能力评级与武僧特殊伤害来源验收

本批不提高原始整书导入通过率：仍为 29/155（18.7%）。未调用付费 API，未修改原始 AI 配置或真实房间。

## 地图能力评级

核查发现 applyDnd5eActivityMapHandoffsV1 的 hasDisabledObjectHandoff 明确跳过地图锁、地图物体光源、物体附魔及穿墙通道。注册 proposal handler 不代表写入成功，现有 assisted 评级正确。

修正 CoreSpellActivities 中过时的 full 预期；汇总验收明确列出受地图写入限制的法术，同时检查限制理由和公开完整自动化查询。保留原有地图不写入及混合批次验证。未移除写入保护，未宣称这些物体机制已经自动化。

## 两条特殊伤害路径

- Quivering Palm：成功豁免后的 10d10 读取实际武僧来源加值，在归零与抗性之前加入；失败豁免直接降至 0 HP，不领取伤害骰加值。日志分类 feature-save。
- Deflect Missiles 反击：来源为返还飞弹的武僧，命中后原始伤害骰池加值。暴击只增加骰数；未命中、放弃反击不领取。
- 新增 11 项测试，覆盖来源隔离、抗性、暴击、零生命分支、未命中、放弃、非法骰导致动作/气/标记与接住状态事务回滚，并验证输入状态不被修改。

## 验证

首轮 3 文件 177 项通过；扩大回归 5 文件 530 项通过（包含 Headless 主回归、地图交接和日志）。定向 git diff --check 通过。
完整 npm run typecheck 通过（进程 35674 exit 0）；全部验证进程已结束。日志：.codex-logs/map-rating-monk-bonus-final.txt、.codex-logs/map-rating-monk-bonus-types.txt。

## 剩余范围

来源增伤全支持登记仍未放开：狂野魔法/特殊怪物附带伤害等其他原生入口仍待审计。物体地图写入仍是明确限制，本批只是纠正过时测试。完整 PDF 导入、重新生成配置和 DM/player 端到端整书验收尚未完成。
