import type { Dnd5eMonsterAction, Dnd5eMonsterStatBlock } from './monsters'

export interface Dnd5eMonsterSchemaIssue {
  monsterId: string
  actionId?: string
  code:
    | 'duplicate-action-id'
    | 'invalid-weapon-attack'
    | 'unstructured-on-hit-rule'
    | 'invalid-multiattack-sequence'
    | 'unsupported-action-kind'
  message: string
}

export type Dnd5eMonsterActionAutomation = 'headless' | 'dm-adjudication' | 'invalid'

export function dnd5eMonsterActionAutomation(action: Dnd5eMonsterAction): Dnd5eMonsterActionAutomation {
  if (action.kind === 'other') return 'dm-adjudication'
  if (action.kind === 'multiattack') return action.sequence?.length ? 'headless' : 'invalid'
  if (!action.attack || action.attack.damage.length < 1) return 'invalid'
  if (action.attack.onHit && !action.attack.onHitRule) return 'invalid'
  return 'headless'
}

export function validateDnd5eMonsterSchema(monster: Dnd5eMonsterStatBlock): Dnd5eMonsterSchemaIssue[] {
  const issues: Dnd5eMonsterSchemaIssue[] = []
  const ids = new Set<string>()
  for (const action of monster.actions) {
    if (ids.has(action.id)) {
      issues.push({ monsterId: monster.id, actionId: action.id, code: 'duplicate-action-id', message: `动作 ID 重复：${action.id}` })
    }
    ids.add(action.id)
    const automation = dnd5eMonsterActionAutomation(action)
    if (automation === 'invalid') {
      const code = action.kind === 'multiattack' ? 'invalid-multiattack-sequence'
        : action.kind === 'weapon-attack' && action.attack?.onHit && !action.attack.onHitRule
          ? 'unstructured-on-hit-rule'
          : action.kind === 'weapon-attack' ? 'invalid-weapon-attack' : 'unsupported-action-kind'
      issues.push({ monsterId: monster.id, actionId: action.id, code, message: `动作 ${action.name} 缺少可验证的 Headless 结构` })
    }
  }
  for (const action of monster.actions) {
    if (action.kind !== 'multiattack') continue
    for (const childId of action.sequence ?? []) {
      const child = monster.actions.find((candidate) => candidate.id === childId)
      if (!child || child.kind !== 'weapon-attack') {
        issues.push({
          monsterId: monster.id,
          actionId: action.id,
          code: 'invalid-multiattack-sequence',
          message: `多重攻击引用了不存在或不可攻击的动作：${childId}`,
        })
      }
    }
  }
  return issues
}

export function validateDnd5eMonsterCatalog(monsters: readonly Dnd5eMonsterStatBlock[]): Dnd5eMonsterSchemaIssue[] {
  return monsters.flatMap(validateDnd5eMonsterSchema)
}
