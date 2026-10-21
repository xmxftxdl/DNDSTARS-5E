export type Dnd5eCompanionAttackKind = 'weapon' | 'grapple' | 'shove-prone' | 'shove-push'

export function isDnd5eCompanionAttackKind(value: unknown): value is Dnd5eCompanionAttackKind {
  return value === 'weapon' || value === 'grapple' || value === 'shove-prone' || value === 'shove-push'
}

export function dnd5eCompanionAttackKindAllows(kind: Dnd5eCompanionAttackKind, action: { type: string; outcome?: string }): boolean {
  if (kind === 'grapple') return action.type === 'grapple'
  if (kind === 'shove-prone') return action.type === 'shove' && action.outcome === 'prone'
  if (kind === 'shove-push') return action.type === 'shove' && action.outcome === 'push'
  return action.type !== 'grapple' && action.type !== 'shove'
}
