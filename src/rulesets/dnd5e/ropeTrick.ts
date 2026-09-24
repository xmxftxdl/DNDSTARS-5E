import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eActiveEffectInstance } from './activeEffects'
import { DND5E_COMBAT_STATE_SCHEMA_VERSION, projectDnd5eActiveEffectState, normalizeDnd5eActiveEffects } from './activeEffects'
import { cellTopLeft } from '../../lib/gridCombat'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { dnd5eEffectiveSpeed } from './headlessCombatEngine'

const definitionId = 'srd-5.1:rope-trick:space'
export function ropeTrickMovementBlock(character: Character, token: Token): string | undefined {
  // Being inside the space is not itself a movement disability. Preserve all
  // other restrictions when checking whether the creature can climb the rope.
  const effects = normalizeDnd5eActiveEffects([
    ...(character.dnd5eCombatState?.activeEffects ?? []),
    ...(token.dnd5eCombatState?.activeEffects ?? []),
  ]).filter((effect) => effect.definitionId !== definitionId)
  const projected = withEffects(character, effects)
  const combatant = createCombatantFromDnd5eCharacter({
    character: migrateCharacterToDnd5e(projected), controller: 'player',
    initiativeD20: 10, position: { x: token.x, y: token.y },
  })
  if (character.currentHp <= 0 || dnd5eEffectiveSpeed(combatant) <= 0) {
    return '当前无法移动（速度为 0 或已失去行动能力），不能沿绳子进出异次元空间。'
  }
}
export function ropeTrickEffect(character: Character, areaId?: string) {
  return character.dnd5eCombatState?.activeEffects?.find((effect) =>
    effect.definitionId === definitionId && (!areaId || effect.stackingKey === areaId))
}

export function interactWithRopeTrick(input: {
  map: BattleMap; characters: readonly Character[]; actor: Token;
  areaId: string; operation: 'enter' | 'leave'; now: number;
}): { ok: true; character: Character } | { ok: false; reason: string } {
  const { map, actor, areaId, operation } = input
  if (operation !== 'enter' && operation !== 'leave') return { ok: false, reason: '无效的绳子交互。' }
  const character = input.characters.find((entry) => entry.id === actor.characterId)
  const area = map.dnd5ePluginAreas?.find((entry) => entry.id === areaId && entry.coreSpellId === 'rope-trick')
  if (!character || !area) return { ok: false, reason: '魔绳术入口已不存在。' }
  const current = ropeTrickEffect(character)
  const movementBlock = ropeTrickMovementBlock(character, actor)
  if (movementBlock) return { ok: false, reason: movementBlock }
  if (operation === 'leave') {
    if (!current || current.stackingKey !== areaId) return { ok: false, reason: '你不在这个异次元空间中。' }
    return { ok: true, character: clearRopeTrickEffect(character, areaId) }
  }
  if (current) return { ok: false, reason: '你已在异次元空间中，不能重复进入。' }
  if (actor.size > 1) return { ok: false, reason: '这个空间只能容纳中型或更小的生物。' }
  if (!area.cells.some((cell) => {
    const top = cellTopLeft(cell, map)
    return Math.max(Math.abs(actor.x - top.x - map.gridSize / 2),
      Math.abs(actor.y - top.y - map.gridSize / 2)) <= map.gridSize * (5 / (map.feetPerCell || 5) + 0.5)
  })) return { ok: false, reason: '需要先移动到绳子周围 5 尺内。' }
  const occupants = input.characters.filter((entry) => ropeTrickEffect(entry, areaId))
  if (occupants.length >= 8) return { ok: false, reason: '异次元空间已满（8/8）。' }
  const effect: Dnd5eActiveEffectInstance = {
    schemaVersion: 1, id: `${definitionId}:${areaId}:${character.id}`, definitionId,
    label: '异次元空间（魔绳术）', kind: 'condition', legacyCondition: 'banished',
    source: { kind: 'spell', actorId: area.sourceTokenId, rulesId: 'rope-trick', label: '魔绳术' },
    appliedAt: input.now, duration: { type: 'permanent' },
    stackingKey: areaId, stackingPolicy: 'reject', visibility: 'public',
  }
  return { ok: true, character: withEffects(character, [...(character.dnd5eCombatState?.activeEffects ?? []), effect]) }
}

function clearRopeTrickEffect(character: Character, areaId: string): Character {
  return withEffects(character, character.dnd5eCombatState?.activeEffects?.filter((effect) =>
    effect.definitionId !== definitionId || effect.stackingKey !== areaId) ?? [])
}

function withEffects(character: Character, effects: Dnd5eActiveEffectInstance[]): Character {
  const projection = projectDnd5eActiveEffectState(effects)
  return { ...character, conditions: projection.conditions, dnd5eCombatState: {
    ...character.dnd5eCombatState, schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
    activeEffects: projection.activeEffects,
  } }
}

export function clearExpiredRopeTrickSpaces(characters: readonly Character[], areas: readonly Dnd5ePluginArea[]) {
  return characters.map((character) => {
    const effect = ropeTrickEffect(character)
    return effect && !areas.some((area) => area.id === effect.stackingKey && area.coreSpellId === 'rope-trick')
      ? clearRopeTrickEffect(character, effect.stackingKey) : character
  })
}
