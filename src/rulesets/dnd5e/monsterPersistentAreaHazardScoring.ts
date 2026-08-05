import { dnd5eAbilityCheckSuccessProbability } from './headlessCombatEngine'
import { dnd5eMonsterHasMagicResistance } from './monsterGenericAbilities'
import {
  dnd5ePersistentAreaAllowsTarget,
  dnd5eTokenIntersectsPersistentAreaAt,
} from './persistentAreaGeometry'
import type { Dnd5eDamageSourceContext, Dnd5eMoralAlignment } from './damageDefenses'
import type { Dnd5eDamageType, Dnd5eMonsterStatBlock } from './monsters'
import type { AbilityKey } from '../../lib/dnd'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'

export interface MonsterPersistentAreaHazardServices {
  monsterForToken(token: Token): Dnd5eMonsterStatBlock | undefined
  savingThrowModifier(
    token: Token,
    characters: readonly Character[],
    ability: AbilityKey,
  ): number
  resolveDamage(
    token: Token,
    damage: number,
    type: Dnd5eDamageType,
    source: Omit<Dnd5eDamageSourceContext, 'damageType'>,
  ): number
  moralAlignment(alignment: unknown): Dnd5eMoralAlignment | undefined
}

export function expectedPersistentAreaTurnEndDamageAt(input: {
  map: BattleMap
  token: Token
  characters: readonly Character[]
  position: { x: number; y: number }
  elevationFeet?: number
}, services: MonsterPersistentAreaHazardServices): number {
  const targetMonster = services.monsterForToken(input.token)
  let expectedDamage = 0
  for (const area of input.map.dnd5ePluginAreas ?? []) {
    if (!dnd5ePersistentAreaAllowsTarget(area, input.token, input.map)) continue
    const source = input.map.tokens.find((candidate) => candidate.id === area.sourceTokenId)
    for (const trigger of area.triggers ?? []) {
      if (
        trigger.timing !== 'turn-end' ||
        !trigger.damage ||
        !dnd5eTokenIntersectsPersistentAreaAt(
          input.token,
          input.map,
          area,
          input.position,
          trigger.cells?.length ? trigger.cells : area.cells,
          input.elevationFeet,
        )
      ) continue
      const isSpell = area.sourceKind === 'core-spell' || area.coreSpellId != null
      const saveMode = isSpell && targetMonster && dnd5eMonsterHasMagicResistance(targetMonster)
        ? 'advantage'
        : 'normal'
      const saveSuccessProbability = trigger.savingThrow
        ? dnd5eAbilityCheckSuccessProbability(
            services.savingThrowModifier(
              input.token,
              input.characters,
              trigger.savingThrow.ability,
            ),
            trigger.savingThrow.dc,
            saveMode,
          )
        : 0
      const saveDamageFactor = !trigger.savingThrow
        ? 1
        : trigger.savingThrow.onSuccess === 'half'
          ? 1 - saveSuccessProbability / 2
          : 1 - saveSuccessProbability
      const rawAverage =
        trigger.damage.count * (trigger.damage.sides + 1) / 2 +
        (trigger.damage.modifier ?? 0)
      expectedDamage += services.resolveDamage(
        input.token,
        rawAverage * saveDamageFactor,
        trigger.damage.type,
        {
          delivery: isSpell ? 'spell' : 'other',
          magical: isSpell,
          spellLevel: isSpell ? area.slotLevel : undefined,
          sourceMoralAlignment: services.moralAlignment(
            source ? services.monsterForToken(source)?.alignment : undefined,
          ),
        },
      )
    }
  }
  return expectedDamage
}
