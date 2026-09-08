import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from './activeEffects'
import {
  createDnd5eCombatant, reconcileDnd5eSourceLinkedRelations, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat,
  type Dnd5eAction, type Dnd5eMonsterOnHitEffectRoll,
} from './headlessCombatEngine'
import { DND5E_SRD_MONSTERS, type Dnd5eMonsterOnHitEffect } from './monsters'

const catalogCases = DND5E_SRD_MONSTERS.flatMap((monster) => (['actions', 'bonusActions', 'legendaryActions'] as const).flatMap(section => (monster[section] ?? [])
  .map(declared => {
    const referenced = monster.actions.find(action => action.id === declared.referencedActionId)
    return { ...referenced, ...declared, attack: declared.attack ?? referenced?.attack }
  })
  .filter((action) => action.automation === 'headless' && action.attack)
  .flatMap((action) => ['miss', 'hit', 'critical', ...(action.attack!.damageAtHalfHp ? ['half-hp'] : [])]
    .map((branch) => ({ monster, action, section, branch, label: `${monster.slug}:${section}:${action.id}:${branch}` })))))
const evidence: unknown[] = []
const uiFixtures: unknown[] = []

function onHitRoll(effect: Dnd5eMonsterOnHitEffect): Dnd5eMonsterOnHitEffectRoll {
  const result: Dnd5eMonsterOnHitEffectRoll = { effectId: effect.id }
  if (effect.kind === 'saving-throw-damage') {
    result.d20 = 1
    result.damageRolls = effect.damage.map((damage) => Array(damage.count).fill(1))
  } else if (effect.kind === 'saving-throw-condition' || effect.kind === 'saving-throw-instant-death') {
    result.d20 = 1
    if (effect.kind === 'saving-throw-condition' && effect.sharedDurationOnFailureMargin) {
      result.durationRolls = Array(effect.sharedDurationOnFailureMargin.count).fill(1)
    }
  }
  else if ('savingThrow' in effect && effect.savingThrow) result.d20 = 1
  else if (effect.kind === 'ability-score-reduction') result.damageRolls = [Array(effect.reduction.count).fill(1)]
  else if (effect.kind === 'forced-movement') {
    result.d20 = 1
    if (effect.resistance.kind === 'opposed-ability-check') result.sourceD20 = 19
    result.forcedMovement = {
      targetId: 'target', distanceFeet: 0, to: { x: 5, y: 0 },
    }
  }
  return result
}

describe('every catalog Headless weapon executes its declared attack branches', () => {
  it.each(catalogCases)('$label', ({ monster, action, section, branch, label }) => {
    const attack = action.attack!
    const critical = branch === 'critical'
    const miss = branch === 'miss'
    const legendary = section === 'legendaryActions'
    const bonus = section === 'bonusActions'
    const combatId = `weapon-verification:${label}`
    const actor = createDnd5eCombatant({
      id: 'actor', name: monster.name, controller: 'dm', statBlockId: monster.id,
      initiative: legendary ? 10 : 20, abilities: monster.abilities, proficiencyBonus: 2,
      armorClass: monster.armorClass.value, maxHp: monster.hitPoints.average,
      currentHp: branch === 'half-hp' ? Math.floor(monster.hitPoints.average / 2) : monster.hitPoints.average,
      temporaryHp: 0, speed: monster.speed.walk, position: { x: 0, y: 0 }, concentrating: false,
      creatureType: monster.creatureType,
      sizeRank: ['微型', '小型', '中型', '大型', '超大型', '巨型'].indexOf(monster.size),
      classState: {
        turnStartResolvedTurnKey: `${combatId}:1:actor`,
        monsterLegendaryActionPoints: monster.legendaryActionPoints ?? 3,
        monsterActionUsesByActionId: Object.fromEntries(monster.actions.flatMap((candidate) => candidate.usage?.kind === 'per-day'
          ? [[candidate.id, { current: candidate.usage.max, max: candidate.usage.max }]] : [])),
      },
    })
    const condition = action.targetEligibility?.predicates.find((predicate) => predicate.kind === 'standard-condition')
    const target = createDnd5eCombatant({
      id: 'target', name: 'durable weapon target', controller: 'player', initiative: legendary ? 20 : 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 1, currentHp: 100_000, maxHp: 100_000,
      temporaryHp: 0, speed: 30, position: { x: 5, y: 0 }, concentrating: false,
      creatureType: 'humanoid', sizeRank: Math.min(2, attack.targetMaxSizeRank ?? 2),
      classState: { activeEffects: condition?.kind === 'standard-condition' ? [createDnd5eConditionEffect({
        condition: condition.condition, targetId: 'target', source: { kind: 'dm' },
      })] : [] },
    })
    let state = startDnd5eHeadlessCombat(combatId, [actor, target])
    if (action.requiredActiveEffectDefinitionId) {
      if (action.requiredActiveEffectDefinitionId === 'srd-5.1:spell:shillelagh') {
        state.combatants.actor.classState.activeEffects = [createDnd5eMechanicalEffect({
          definitionId: 'srd-5.1:spell:shillelagh',
          label: 'Shillelagh catalog prerequisite',
          targetId: actor.id,
          source: { kind: 'spell', actorId: actor.id, rulesId: 'shillelagh' },
          modifiers: {
            shillelagh: {
              weaponId: monster.slug === 'dryad' ? 'club' : 'quarterstaff',
              spellcastingAbility: monster.spellcasting?.ability ?? 'wis',
              spellcastingModifier: monster.spellcasting?.ability
                ? Math.floor((monster.abilities[monster.spellcasting.ability] - 10) / 2)
                : 0,
            },
          },
        })]
      } else {
        const buff = monster.actions.find((candidate) => action.requiredActiveEffectDefinitionId === `monster:${monster.id}:${candidate.id}:self-combat-buff`)
        expect(buff, `${label}: prerequisite buff`).toBeDefined()
        const prepared = resolveDnd5eHeadlessAction(state, { type: 'monster-special-action', actorId: actor.id, actionId: buff!.id })
        expect(prepared.ok, `${label}: prerequisite buff resolution`).toBe(true)
        state = prepared.state
        state.combatants.actor.turn.actionAvailable = true
      }
    }
    if (action.relationRequirement?.kind === 'target-linked-to-source') {
      const activeIndex = state.initiativeIndex
      if (legendary) state.initiativeIndex = state.initiativeOrder.indexOf(actor.id)
      const slot = action.relationRequirement.slotGroup
      const prerequisite = monster.actions.find((candidate) => candidate.id !== action.id && candidate.automation === 'headless'
        && candidate.attack?.onHitEffects?.some((effect) => effect.kind === 'source-linked-condition' && effect.relation.slotGroup === slot))
      expect(prerequisite, `${label}: source relation producer`).toBeDefined()
      const prepared = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action', actorId: actor.id, actionId: prerequisite!.id,
        rolls: [{ targetId: target.id, d20: 19, d20Second: 19,
          damageRolls: prerequisite!.attack!.damage.map((damage) => Array(damage.count).fill(1)),
          onHitEffectRolls: prerequisite!.attack!.onHitEffects?.map(onHitRoll) }],
      })
      expect(prepared.ok, `${label}: source relation preparation`).toBe(true)
      state = prepared.state
      state.initiativeIndex = activeIndex
      state.combatants.actor.turn.actionAvailable = true
    }
    const charge = bonus ? monster.traits.find(trait => trait.rule?.kind === 'charge-damage'
      && trait.rule.bonusActionFollowUp?.actionId === action.id)?.rule : undefined
    if (charge?.kind === 'charge-damage') {
      const distance = charge.minimumStraightMovementFeet
      state.combatants.target.position = { x: distance + 5, y: 0 }
      const moved = resolveDnd5eHeadlessAction(state, { type: 'move', actorId: actor.id,
        to: { x: distance, y: 0 }, distance })
      expect(moved.ok, 'charge approach').toBe(true)
      state = moved.state
      state.distanceFeetByCombatantPair = { 'actor\u0000target': 5 }
      const first = monster.actions.find(candidate => candidate.id === charge.actionId)!
      const hit = resolveDnd5eHeadlessAction(state, { type: 'monster-action', actorId: actor.id, actionId: first.id,
        rolls: [{ targetId: target.id, d20: 19, d20Second: 19,
          damageRolls: first.attack!.damage.map(damage => Array(damage.count).fill(1)),
          traitDamageRolls: charge.extraDamage ? [{ traitId: 'charge-damage', rolls: Array(charge.extraDamage.count).fill(1) }] : undefined,
          onHitEffectRolls: first.attack!.onHitEffects?.map(onHitRoll) }] })
      expect(hit.ok, 'charge hit prerequisite').toBe(true)
      state = hit.state
      if (state.combatants.target.classState.monsterOnHitSavePending) {
        const save = resolveDnd5eHeadlessAction(state, { type: 'monster-on-hit-save', actorId: target.id,
          sourceId: actor.id, actionId: first.id, d20: 1 })
        expect(save.ok, 'charge saving throw').toBe(true)
        state = save.state
      }
      expect(state.combatants.actor.classState.monsterTriggeredBonusAction?.actionId).toBe(action.id)
    }
    const hpBefore = state.combatants.target.currentHp
    const conditionsBefore = state.combatants.target.conditions
    if (branch === 'hit' && section === 'actions') uiFixtures.push({ slug: monster.slug, actionId: action.id,
      combatId, actorState: state.combatants.actor.classState,
      targetState: state.combatants.target.classState, targetHp: hpBefore,
      targetSizeRank: state.combatants.target.sizeRank,
    })
    const components = branch === 'half-hp' ? attack.damageAtHalfHp! : attack.damage
    const d20 = miss ? 1 : critical ? 20 : 19
    const damageRolls = components.map((damage) => Array(damage.count * (critical ? 2 : 1)).fill(1))
    if (critical) for (const extra of attack.criticalExtraDamage ?? []) damageRolls.push(Array(extra.count).fill(1))
    const hasAssassinate = monster.traits.some((trait) => trait.rule?.kind === 'assassinate')
    const sneak = monster.traits.find((trait) => trait.rule?.kind === 'sneak-attack')?.rule
    const payload: Extract<Dnd5eAction, { type: 'monster-action' | 'monster-bonus-action' | 'monster-legendary-action' }> = {
      type: legendary ? 'monster-legendary-action' : bonus ? 'monster-bonus-action' : 'monster-action', actorId: actor.id, actionId: action.id,
      rolls: [{
        targetId: target.id, d20, d20Second: d20, damageRolls,
        onHitEffectRolls: miss ? undefined : attack.onHitEffects?.map(onHitRoll),
        traitDamageRolls: !miss && hasAssassinate && sneak?.kind === 'sneak-attack'
          ? [{ traitId: 'sneak-attack', rolls: Array(sneak.extraDamage.count * (critical ? 2 : 1)).fill(1) }]
          : undefined,
      }],
    }
    const result = resolveDnd5eHeadlessAction(state, payload)
    const attackEvent = result.events.find((event) => event.type === 'attack-resolved')
    const damageEvents = result.events.filter((event) => event.type === 'damage-applied')
    evidence.push({ monsterId: monster.id, slug: monster.slug, section, actionId: action.id,
      scenario: branch, ok: result.ok, reason: result.ok ? undefined : result.reason,
      attack: attackEvent, damage: damageEvents,
      events: result.events.filter((event) => event.type !== 'damage-applied' && event.type !== 'attack-resolved'),
      hpAfter: result.state.combatants.target.currentHp,
      conditionsAfter: result.state.combatants.target.conditions,
    })
    expect(result.ok, `${label}: ${result.ok ? '' : result.reason}`).toBe(true)
    expect(attackEvent).toMatchObject({ d20, total: d20 + attack.toHit, hit: !miss, critical })
    if (legendary) expect(result.state.combatants.actor.classState.monsterLegendaryActionPoints)
      .toBe((monster.legendaryActionPoints ?? 3) - (action.legendaryCost ?? 1))
    else expect(bonus ? result.state.combatants.actor.turn.bonusActionAvailable : result.state.combatants.actor.turn.actionAvailable).toBe(false)
    if (miss) {
      expect(result.state.combatants.target.currentHp).toBe(hpBefore)
      expect(result.state.combatants.target.conditions).toEqual(conditionsBefore)
    } else {
      const baseDamage = components.reduce((total, damage) => total + Math.max(0, damage.count * (critical ? 2 : 1) + damage.bonus), 0)
      const criticalExtra = critical ? (attack.criticalExtraDamage ?? []).reduce((total, damage) => total + Math.max(0, damage.count + damage.bonus), 0) : 0
      const saveDamage = (attack.onHitEffects ?? []).reduce((total, effect) => total + (effect.kind === 'saving-throw-damage'
        ? effect.damage.reduce((sum, damage) => sum + Math.max(0, damage.count + damage.bonus), 0) : 0), 0)
      const traitDamage = hasAssassinate && sneak?.kind === 'sneak-attack' ? sneak.extraDamage.count * (critical ? 2 : 1) : 0
      expect(hpBefore - result.state.combatants.target.currentHp).toBe(baseDamage + criticalExtra + saveDamage + traitDamage)
    }
    if (branch === 'hit') {
      const spent = structuredClone(result.state)
      if (legendary) spent.combatants.actor.classState.monsterLegendaryActionPoints = 0
      const repeated = resolveDnd5eHeadlessAction(spent, payload)
      expect(repeated.ok, `${label}: repeated action`).toBe(false)
      expect(repeated.state.combatants).toEqual(spent.combatants)
      const invalidD20 = resolveDnd5eHeadlessAction(state, { ...payload, rolls: [{ ...payload.rolls[0], d20: 21 }] })
      expect(invalidD20.ok, `${label}: out-of-bounds d20`).toBe(false)
      expect(invalidD20.state.combatants).toEqual(state.combatants)
      const damageIndex = components.findIndex(damage => damage.count > 0)
      if (damageIndex >= 0) {
        const invalidRolls = damageRolls.map(rolls => [...rolls])
        invalidRolls[damageIndex][0] = components[damageIndex].sides + 1
        const invalidDamage = resolveDnd5eHeadlessAction(state, { ...payload,
          rolls: [{ ...payload.rolls[0], damageRolls: invalidRolls }],
        })
        expect(invalidDamage.ok, `${label}: out-of-bounds damage die`).toBe(false)
        expect(invalidDamage.state.combatants).toEqual(state.combatants)
      }
      const distant = structuredClone(state)
      const distanceFeet = (attack.rangeFeet?.long ?? attack.reachFeet ?? 5) + 5
      distant.combatants.target.position = { x: distanceFeet, y: 0 }
      distant.distanceFeetByCombatantPair = { 'actor\u0000target': distanceFeet }
      // Moving a grappled target outside reach invalidates that relation before
      // any command is validated. Atomic rejection retains this invariant cleanup.
      const reconciledDistant = structuredClone(distant)
      reconcileDnd5eSourceLinkedRelations(reconciledDistant, [])
      const beyondRange = resolveDnd5eHeadlessAction(distant, payload)
      expect(beyondRange.ok, `${label}: outside declared reach/range`).toBe(false)
      expect(beyondRange.state.combatants).toEqual(reconciledDistant.combatants)
    }
  })
})

afterAll(() => {
  const destination = process.env.STARS_MONSTER_INVENTORY_DIR
  if (!destination) return
  const directory = path.resolve(destination)
  const relative = path.relative(process.cwd(), directory)
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('evidence destination must be inside repository')
  mkdirSync(directory, { recursive: true })
  writeFileSync(path.join(directory, 'weapon-runtime.json'), JSON.stringify(evidence, null, 2))
  writeFileSync(path.join(directory, 'weapon-ui-fixtures.json'), JSON.stringify(uiFixtures, null, 2))
})
