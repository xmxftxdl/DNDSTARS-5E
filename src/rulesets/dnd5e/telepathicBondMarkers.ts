import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { dnd5eCombatTokenSide } from '../../lib/opportunityAttacks'

export interface TelepathicBondTarget { mapId: string; tokenId: string }
export function isTelepathicBondCreature(token: Token): boolean {
  return (token.type === 'player' || token.type === 'npc' || token.type === 'enemy') &&
    !token.dnd5eSpellEffect && dnd5eCombatTokenSide(token) !== 'enemy'
}

/** Player effects are owned by the character sheet, rather than its map projection. */
export function applyTelepathicBondCharacterMarkers(input: {
  characters: readonly Character[]; maps: readonly BattleMap[];
  targets: readonly TelepathicBondTarget[]; sourceTokenId: string;
}): Character[] {
  return input.characters.map(character => {
    const selectedToken = input.targets.flatMap(target =>
      input.maps.find(map => map.id === target.mapId)?.tokens.filter(token =>
        token.id === target.tokenId && token.type === 'player' && token.characterId === character.id) ?? [],
    )[0]
    const effect = selectedToken?.dnd5eCombatState?.activeEffects?.find(effect =>
      effect.source.rulesId === 'telepathic-bond' && effect.source.actorId === input.sourceTokenId)
    if (!effect) return character
    return { ...character, dnd5eCombatState: {
      ...character.dnd5eCombatState, schemaVersion: 2,
      activeEffects: [
        ...(character.dnd5eCombatState?.activeEffects ?? []).filter(old =>
          !(old.source.rulesId === 'telepathic-bond' && old.source.actorId === input.sourceTokenId)),
        effect,
      ],
    } }
  })
}
export function validateTelepathicBondTargets(value: unknown, maps: readonly BattleMap[]): value is TelepathicBondTarget[] {
  if (!Array.isArray(value) || value.length > 8) return false
  const keys = new Set<string>()
  return value.every(target => {
    if (!target || typeof target.mapId !== 'string' || typeof target.tokenId !== 'string') return false
    const key = JSON.stringify([target.mapId, target.tokenId])
    const token = maps.find(map => map.id === target.mapId)?.tokens.find(token => token.id === target.tokenId)
    if (keys.has(key) || !token || !isTelepathicBondCreature(token)) return false
    keys.add(key)
    return true
  })
}
/** Applies only Host-validated marker targets; no distance or same-map restriction. */
export function applyTelepathicBondMarkers(input: {
  maps: readonly BattleMap[]; targets: readonly TelepathicBondTarget[];
  sourceTokenId: string; castId: string; round: number;
}): BattleMap[] {
  return input.maps.map(map => {
    const ids = new Set(input.targets.filter(target => target.mapId === map.id).map(target => target.tokenId))
    if (!ids.size) return map
    return { ...map, tokens: map.tokens.map(token => {
      if (!ids.has(token.id) || !isTelepathicBondCreature(token)) return token
      const effect = createDnd5eMechanicalEffect({
        id: `telepathic-bond:${input.castId}:${map.id}:${token.id}`,
        definitionId: 'srd-5.1:spell:telepathic-bond', label: '心灵联结', kind: 'buff',
        source: { kind: 'spell', rulesId: 'telepathic-bond', actorId: input.sourceTokenId },
        targetId: token.id, duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
        legacyCondition: 'telepathic-bond', appliedRound: input.round,
      })
      const previous = token.dnd5eCombatState?.activeEffects ?? []
      return { ...token, dnd5eCombatState: { ...token.dnd5eCombatState,
        activeEffects: [...previous.filter(old => !(old.source.rulesId === 'telepathic-bond' && old.source.actorId === input.sourceTokenId)), effect],
      } }
    }) }
  })
}
