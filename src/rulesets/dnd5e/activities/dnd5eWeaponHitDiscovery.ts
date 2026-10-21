import { materializeDnd5eEventWeaponDice } from './dnd5eEventWeaponDice'
import { collectDnd5eActivityFormulaRollDeclarationsV1 } from './dnd5eActivityHeadlessCompiler'
import type { Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import type { Dnd5eWeaponHitEvent } from '../weaponHitCheckpoint'
import { dnd5eActivityTriggerContextsFromCombatEventV1, listDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerWindows'
import { resolveDnd5eWeaponHitActivity, dnd5eWeaponHitActivityGrant, dnd5eWeaponHitConditionChoices } from './dnd5eWeaponHitActivity'
import type { AvailableRegisteredDnd5eActivityV1 } from './dnd5eActivityRegistry'
import { collectDnd5eFormulaRollDeclarations } from './dnd5eFormula'
import { dnd5eSavingThrowMode } from '../passiveDefenses'

export interface Dnd5eWeaponHitOffer {
  available: AvailableRegisteredDnd5eActivityV1
  definitionSignature: string
  rolls: readonly { id: string; count: number; sides: number; kind?: 'saving-throw'; rollerTokenId?: string }[]
}

/** Discovery does not roll, spend or commit. Fixed minimum dice below are only
 * a validation probe for this narrow shape, never exposed as rolled results. */
export function listDnd5eWeaponHitActivities(input: {
  state: Dnd5eHeadlessCombatState; event: Dnd5eWeaponHitEvent; eventBatchId: string; combatRevision: number
}): readonly Dnd5eWeaponHitOffer[] {
  const offers: Dnd5eWeaponHitOffer[] = []
  if (!input.event.hit || (!['weapon', 'spell'].includes(input.event.attackCategory ?? '') && !input.event.attackDelivery)) return offers
  const windows = listDnd5eActivityTriggerWindowsV1({ state: input.state, events: [input.event], eventBatchId: input.eventBatchId })
  for (const window of windows) {
    if (window.triggerContext.event !== 'attack-hit') continue
    for (const available of window.available) {
      const operation = available.activity.outcomes[0]?.operations[0]
      if (operation?.kind !== 'damage') continue
      // Dice-dependent costs cannot be qualified before the player rolls.
      // Reject them here instead of offering an unaffordable result by chance.
      if (available.activity.consumption?.some(cost => cost.kind === 'resource' && collectDnd5eFormulaRollDeclarations([cost.amount]).length > 0)) continue
      let rolls: Dnd5eWeaponHitOffer['rolls']
      try {
        const context = dnd5eActivityTriggerContextsFromCombatEventV1(input.state, input.event, 0, input.eventBatchId)
          .find(context => context.event === 'attack-hit')
        const actor = input.state.combatants[input.event.actorId]
        const castLevel = dnd5eWeaponHitActivityGrant(input.state, input.event, available.packageId, available.activity)?.source.spellLevel
        rolls = collectDnd5eActivityFormulaRollDeclarationsV1(materializeDnd5eEventWeaponDice(available.activity, context), input.event.critical, { actor, castLevel })
        const target = input.state.combatants[input.event.targetId]
        for (const check of available.activity.checks ?? []) {
          if (check.kind !== 'saving-throw' || !target) continue
          const mode = check.rollMode === 'host-derived'
            ? dnd5eSavingThrowMode(target, check.ability, { effectVisible: true, sourceCreatureType: actor.creatureType, sourceIsSpell: false })
            : check.rollMode ?? 'normal'
          rolls = [...rolls, { id: `${check.rollId}:${target.id}`, count: mode === 'normal' ? 1 : 2, sides: 20,
            kind: 'saving-throw', rollerTokenId: target.id }]
        }
      } catch { continue }
      if (rolls.some(roll => !Number.isInteger(roll.count) || roll.count < 1 || roll.count > 2000)) continue
      const choices = dnd5eWeaponHitConditionChoices(input.state, input.event, available.activity)
      if (choices?.some(choice => choice.options.length === 0)) continue
      const checked = resolveDnd5eWeaponHitActivity({ ...input, packageId: available.packageId, packageVersion: available.packageVersion,
        activityId: available.activity.id, choices: Object.fromEntries((choices ?? []).map(choice => [choice.id, choice.options[0].id])), authoritativeRolls: Object.fromEntries(rolls.map(roll => [roll.id, { values: Array.from({ length: roll.count }, () => 1) }])) })
      if (checked.ok) offers.push({ available, definitionSignature: checked.definitionSignature, rolls })
    }
  }
  return offers
}
