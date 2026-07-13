import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { getTokenTargetAc } from '../../lib/enemyCombatStats'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'

export interface Dnd5eMapCombatSnapshot {
  state: Dnd5eHeadlessCombatState
  characterIdByCombatantId: Record<string, string>
}

const DEFAULT_ABILITIES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as const

export function createDnd5eMapCombatSnapshot(input: {
  combatId: string
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
}): Dnd5eMapCombatSnapshot {
  const charactersById = new Map(input.characters.map((character) => [character.id, character]))
  const initiativeByTokenId = new Map(input.initiativeOrder.map((entry) => [entry.tokenId, entry.roll]))
  const characterIdByCombatantId: Record<string, string> = {}
  const combatants = input.map.tokens.flatMap((token) => {
    if (token.type !== 'player' && token.type !== 'enemy') return []
    const initiative = initiativeByTokenId.get(token.id)
    if (initiative == null) return []
    const character = token.characterId ? charactersById.get(token.characterId) : undefined
    if (character) {
      const migrated = migrateCharacterToDnd5e(character)
      characterIdByCombatantId[token.id] = character.id
      const combatant = createCombatantFromDnd5eCharacter({
        character: migrated,
        controller: token.type === 'player' ? 'player' : 'dm',
        initiativeD20: Math.max(1, Math.min(20, initiative - migrated.initiativeBonus)),
        position: { x: token.x, y: token.y },
      })
      return [{ ...combatant, id: token.id, name: token.label, initiative }]
    }
    const maxHp = Math.max(1, token.maxHp ?? token.hp ?? 1)
    return [createDnd5eCombatant({
      id: token.id,
      name: token.label,
      controller: 'dm',
      initiative,
      abilities: { ...DEFAULT_ABILITIES },
      proficiencyBonus: 2,
      armorClass: getTokenTargetAc(token) ?? 10,
      currentHp: Math.max(0, Math.min(maxHp, token.hp ?? maxHp)),
      maxHp,
      temporaryHp: 0,
      speed: 30,
      position: { x: token.x, y: token.y },
      concentrating: false,
    })]
  })
  return { state: startDnd5eHeadlessCombat(input.combatId, combatants), characterIdByCombatantId }
}

export interface Dnd5eMapResultPlan {
  map: BattleMap
  characters: Character[]
  changedTokenIds: readonly string[]
  changedCharacterIds: readonly string[]
}

export function planDnd5eMapResultApplication(input: {
  state: Dnd5eHeadlessCombatState
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Readonly<Record<string, string>>
}): Dnd5eMapResultPlan {
  const changedTokenIds: string[] = []
  const changedCharacterIds: string[] = []
  const tokenById = new Map(input.map.tokens.map((token) => [token.id, token]))
  const map: BattleMap = {
    ...input.map,
    tokens: input.map.tokens.map((token) => {
      const combatant = input.state.combatants[token.id]
      if (!combatant) return token
      const patch: Partial<Token> = { x: combatant.position.x, y: combatant.position.y, hp: combatant.currentHp, maxHp: combatant.maxHp }
      if (token.x === patch.x && token.y === patch.y && token.hp === patch.hp && token.maxHp === patch.maxHp) return token
      changedTokenIds.push(token.id)
      return { ...token, ...patch }
    }),
  }
  const characters = input.characters.map((character) => {
    const combatantId = Object.keys(input.characterIdByCombatantId).find((id) => input.characterIdByCombatantId[id] === character.id)
    const combatant = combatantId ? input.state.combatants[combatantId] : undefined
    if (!combatant) return character
    if (character.currentHp === combatant.currentHp && character.tempHp === combatant.temporaryHp) return character
    changedCharacterIds.push(character.id)
    return { ...character, currentHp: combatant.currentHp, tempHp: combatant.temporaryHp }
  })
  for (const tokenId of Object.keys(input.state.combatants)) {
    if (!tokenById.has(tokenId)) throw new Error(`Headless combatant has no map token: ${tokenId}`)
  }
  return { map, characters, changedTokenIds, changedCharacterIds }
}
