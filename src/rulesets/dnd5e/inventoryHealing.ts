import type { Character } from '../../types/character'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { applyDnd5eHeadlessHealing, type Dnd5eCombatEvent } from './headlessCombatEngine'

/** Use the same healing primitive as spells, including zero-HP lifecycle events. */
export function healDnd5eInventoryTarget(character: Character, amount: number) {
  const target = createCombatantFromDnd5eCharacter({
    character: migrateCharacterToDnd5e(character), controller: 'player',
    initiativeD20: 10, position: { x: 0, y: 0 },
  })
  const events: Dnd5eCombatEvent[] = []
  const applied = applyDnd5eHeadlessHealing(target, amount, events, true)
  const transformed = !!target.classState.wildShapeFormId
  return {
    applied,
    events,
    character: {
      ...character,
      currentHp: transformed ? target.classState.wildShapeOriginalCurrentHp ?? character.currentHp : target.currentHp,
      conditions: [...target.conditions],
      deathSaveSuccesses: target.deathSaves.successes,
      deathSaveFailures: target.deathSaves.failures,
      deathSaveStable: target.deathSaves.stable,
      dnd5eCombatState: { ...target.classState },
    } satisfies Character,
  }
}
