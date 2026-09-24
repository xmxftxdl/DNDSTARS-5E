/** DM-facing explanations for authoritative monster spell rejections. */
export function monsterSpellFailureMessage(reason: string): string {
  const messages: Record<string, string> = {
    'invalid-target': '所选范围没有有效生物，或目标清单已变化。请重新选择范围；也请检查目标高度和阻挡。',
    'resource-unavailable': '该法术的剩余施法次数或可用法术位不足。请检查此怪物的施法资源。',
    'action-unavailable': '该怪物的动作已经用完，无法再用动作施法。',
    'bonus-action-unavailable': '该怪物的附赠动作已经用完。',
    'verbal-component-unavailable': '施法者无法提供言语成分；请检查是否位于沉默术范围内。',
    'target-out-of-range': '所选目标或范围落点超出了施法距离。',
    'line-of-effect-blocked': '施法者与范围落点之间存在阻挡。',
    'invalid-dice': '结算所需的骰子结果缺失或不符合要求。',
    'turn-changed': '当前回合或怪物控制模式已经改变，请在该怪物的回合重新施法。',
    'invalid-actor': '施法者已不在当前地图上，或不再是有效怪物。',
    'invalid-stat-block': '施法者的怪物数据中没有有效的施法能力。',
    'invalid-spell': '该法术不在怪物的有效法术列表中。',
    'manual-spell': '此法术尚未接入自动结算。',
  }
  return `${messages[reason] ?? '法术被规则结算拒绝，请保留下方原因代码以便排查。'}\n原因：${reason}`
}
