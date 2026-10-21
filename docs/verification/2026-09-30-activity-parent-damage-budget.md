# Activity 父攻击伤害记录

本批将已验证的 attackCheckKeys 接入 registered 与 compiled 两条 Host 路径的事务内伤害记录。记录使用 WeakMap，不接受玩家提供，也不序列化进存档。独立攻击分别记录；明确同时依赖多个成功攻击的伤害使用共享记录。攻击事件携带明确关联的首个伤害类型，供后续 parent-weapon 效果读取。

固定伤害不占用有骰伤害的领取记录；确有实际骰证据的伤害标记已领取。grant-source 保守占用，避免后续按执行者身份重新领取。旧提案缺少检查关联时保持保守处理，不猜测父伤害类型。其他目标及非攻击伤害不占用本次攻击记录。

验证：3文件75项本地测试通过，见 `.codex-logs/activity-parent-damage-budget.txt`。覆盖导出重导入后的两条 Host 路径、独立检查、固定/有骰/grant-source、联合结果、旧无关联提案、无关目标，以及记录不会跟随事件 JSON 序列化。原生攻击与旧声明式回归同时通过。

边界：本批没有证明所有原生或 Activity 入口都能收集任意 after-hit 追加骰，也未将未包装的普通公式自动升级为显式 damage-roll 加值边界。没有开放来源伤害机制完整支持标签。真实 DM/玩家房间未改，付费 API 调用为0，原始转换配置未覆盖。

完整类型检查 session11647 exit0，日志 `.codex-logs/activity-parent-damage-budget-typecheck.txt`；定向 diff 检查通过，验证进程全部结束。全书原始配置预检29/155（18.7%）不是整书完成率；全书目标仍在进行。
