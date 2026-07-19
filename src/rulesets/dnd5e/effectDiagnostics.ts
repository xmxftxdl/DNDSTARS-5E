import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  DND5E_COMBAT_STATE_SCHEMA_VERSION,
  dnd5eConditionsFromActiveEffects,
  validateDnd5eActiveEffectsStrict,
} from './activeEffects'

export type Dnd5eEffectDiagnosticSeverity = 'error' | 'warning'

export interface Dnd5eEffectDiagnosticIssue {
  id: string
  severity: Dnd5eEffectDiagnosticSeverity
  ownerType: 'character' | 'token'
  ownerId: string
  ownerName: string
  message: string
}

function sameStrings(left: readonly string[] | undefined, right: readonly string[]): boolean {
  return (left?.length ?? 0) === right.length && (left ?? []).every((value, index) => value === right[index])
}

export function inspectDnd5eEffectStates(input: {
  characters: readonly Character[]
  maps: readonly BattleMap[]
}): Dnd5eEffectDiagnosticIssue[] {
  const issues: Dnd5eEffectDiagnosticIssue[] = []
  const actorIds = new Set<string>([
    ...input.characters.map((character) => character.id),
    ...input.maps.flatMap((map) => map.tokens.map((token) => token.id)),
  ])
  const inspect = (owner: {
    ownerType: 'character' | 'token'
    ownerId: string
    ownerName: string
    state: Character['dnd5eCombatState'] | undefined
    conditions: readonly string[] | undefined
  }) => {
    const state = owner.state
    if (!state && (owner.conditions?.length ?? 0) === 0) return
    const add = (severity: Dnd5eEffectDiagnosticSeverity, key: string, message: string) => issues.push({
      id: `${owner.ownerType}:${owner.ownerId}:${key}`,
      severity,
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      ownerName: owner.ownerName,
      message,
    })
    const validation = validateDnd5eActiveEffectsStrict(state?.activeEffects)
    for (const [index, message] of validation.issues.entries()) add('error', `invalid-${index}`, message)
    const legacyTimedEffects = (state as (typeof state & { timedEffects?: unknown[] }) | undefined)?.timedEffects
    if (legacyTimedEffects?.length) add('warning', 'legacy-timed', `仍有 ${legacyTimedEffects.length} 个旧 timedEffects 待迁移`)
    if (state?.schemaVersion !== DND5E_COMBAT_STATE_SCHEMA_VERSION) add('warning', 'schema', '战斗状态尚未升级到 schema v2')
    if (validation.ok) {
      const projected = dnd5eConditionsFromActiveEffects(validation.effects)
      if (!sameStrings(owner.conditions, projected)) add('error', 'projection', 'conditions 与 ActiveEffect 投影不一致')
      for (const effect of validation.effects) {
        if (effect.source.actorId && !actorIds.has(effect.source.actorId)) {
          add('warning', `source-${effect.id}`, `效果“${effect.label}”的来源角色已不存在`)
        }
        if (effect.duration.type === 'concentration' && !actorIds.has(effect.duration.sourceActorId)) {
          add('error', `concentration-${effect.id}`, `专注效果“${effect.label}”的来源角色已不存在`)
        }
      }
    }
  }
  for (const character of input.characters) {
    inspect({
      ownerType: 'character', ownerId: character.id, ownerName: character.name,
      state: character.dnd5eCombatState, conditions: character.conditions,
    })
  }
  for (const map of input.maps) {
    for (const token of map.tokens) {
      if (!token.dnd5eCombatState) continue
      inspect({
        ownerType: 'token', ownerId: token.id, ownerName: `${map.name} / ${token.label}`,
        state: token.dnd5eCombatState as Character['dnd5eCombatState'],
        conditions: token.dnd5eCombatState.conditions,
      })
    }
  }
  return issues
}
