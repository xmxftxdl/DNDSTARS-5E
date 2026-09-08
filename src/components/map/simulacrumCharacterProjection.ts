import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { DND5E_INVENTORY_SCHEMA_VERSION } from '../../types/inventory'

/**
 * A simulacrum keeps the subject's characterId so portraits and proficiencies
 * can be reused, but its mutable combat state belongs to the map token.  Never
 * render the linked live character directly: that would expose (and edit) the
 * subject's hit points, equipment, spell slots, effects, and concentration.
 */
export function projectSimulacrumCharacterForMapDetail(
  token: Token,
  subject: Character,
): Character {
  const simulacrum = token.dnd5eSimulacrum
  if (!simulacrum) return subject

  return {
    ...subject,
    name: token.label,
    level: simulacrum.level,
    dnd5eClassLevels: simulacrum.classLevels
      ? { ...simulacrum.classLevels }
      : subject.dnd5eClassLevels,
    abilities: { ...simulacrum.abilities },
    currentHp: Math.max(0, Math.min(
      simulacrum.maximumHitPoints,
      token.hp ?? simulacrum.maximumHitPoints,
    )),
    maxHp: simulacrum.maximumHitPoints,
    tempHp: Math.max(0, token.dnd5eCombatState?.temporaryHp ?? 0),
    ac: simulacrum.armorClass,
    speed: simulacrum.speed,
    saveDC: simulacrum.saveDc ?? subject.saveDC,
    classResources: Object.fromEntries(
      Object.entries(simulacrum.classResources).map(([id, resource]) => [id, {
        current: resource.current,
        max: resource.maximum,
      }]),
    ),
    equipment: undefined,
    dnd5eInventory: {
      schemaVersion: DND5E_INVENTORY_SCHEMA_VERSION,
      revision: 0,
      entries: [],
      currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      authorityGrantReceipts: [],
      authorityUseReceipts: [],
    },
    concentrating: false,
    conditions: [...(token.dnd5eCombatState?.conditions ?? [])],
    dnd5eCombatState: token.dnd5eCombatState
      ? structuredClone(token.dnd5eCombatState)
      : undefined,
    deathSaveSuccesses: undefined,
    deathSaveFailures: undefined,
    deathSaveStable: undefined,
    hitPointMaximumMode: 'manual',
    hitPointRolls: undefined,
    hitPointDice: undefined,
  }
}
