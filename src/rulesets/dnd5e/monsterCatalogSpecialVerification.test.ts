import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from './activeEffects'
import {
  createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat,
  type Dnd5eAction,
} from './headlessCombatEngine'
import { DND5E_SRD_MONSTERS, dnd5eMonsterActionUsageId } from './monsters'

const kinds = new Set([
  'ability-check', 'saving-throw-condition', 'saving-throw-terminal-effect',
  'conditioned-damage-and-healing', 'healing-touch', 'self-healing',
  'temporary-armor-class-bonus', 'self-combat-buff', 'invisibility', 'teleport',
  'persistent-area', 'automatic-area-active-effect', 'grant-movement',
])
const rejectedBoundaries = new Set(['out-of-range', 'source-blinded', 'target-blinded',
  'wrong-target-type', 'missing-condition', 'wrong-condition-source', 'target-not-zero', 'wrong-environment'])
function boundaryBranches(rule: NonNullable<(typeof DND5E_SRD_MONSTERS)[number]['actions'][number]['rule']>): string[] {
  return [
    ...('rangeFeet' in rule && ['saving-throw-condition', 'saving-throw-terminal-effect', 'conditioned-damage-and-healing', 'healing-touch', 'temporary-armor-class-bonus'].includes(rule.kind) ? ['out-of-range'] : []),
    ...('requiresSourceCanSeeTarget' in rule && rule.requiresSourceCanSeeTarget ? ['source-blinded'] : []),
    ...('requiresTargetCanSeeSource' in rule && rule.requiresTargetCanSeeSource ? ['target-blinded'] : []),
    ...(rule.kind === 'saving-throw-condition' && rule.requiredTargetCreatureTypes?.length ? ['wrong-target-type'] : []),
    ...('requiredCondition' in rule && rule.requiredCondition ? ['missing-condition'] : []),
    ...(rule.kind === 'conditioned-damage-and-healing' && rule.requireSameSource ? ['wrong-condition-source'] : []),
    ...(rule.kind === 'saving-throw-terminal-effect' && rule.requiresTargetAtZeroHitPoints ? ['target-not-zero'] : []),
    ...(rule.kind === 'persistent-area' && rule.requiredEnvironment ? ['wrong-environment'] : []),
  ]
}
const cases = DND5E_SRD_MONSTERS.flatMap(monster => (['actions', 'legendaryActions'] as const)
  .flatMap(section => (monster[section] ?? []).filter(action => action.automation === 'headless' && kinds.has(action.rule?.kind ?? ''))
    .flatMap(action => ['minimum', 'maximum', 'no-resource', ...boundaryBranches(action.rule!)].map(branch => ({
      monster, section, action, branch, label: `${monster.slug}:${section}:${action.id}:${branch}`,
    })))))
const evidence: unknown[] = []

describe('catalog special actions resolve declared values and resource limits', () => {
  it.each(cases)('$label', ({ monster, section, action, branch, label }) => {
    const rule = action.rule!
    const legendary = section === 'legendaryActions'
    const maximum = branch === 'maximum'
    const exhausted = branch === 'no-resource'
    const rejected = exhausted || rejectedBoundaries.has(branch)
    const usageActionId = dnd5eMonsterActionUsageId(action)
    const combatId = `special-verification:${label}`
    const actor = createDnd5eCombatant({
      id: 'actor', name: monster.name, controller: 'dm', statBlockId: monster.id,
      initiative: legendary ? 10 : 20, abilities: monster.abilities, proficiencyBonus: 2,
      armorClass: monster.armorClass.value, maxHp: 1000, currentHp: 500,
      temporaryHp: 0, speed: monster.speed.walk, movementSpeeds: monster.speed,
      position: { x: 0, y: 0 }, concentrating: false, creatureType: monster.creatureType,
      sizeRank: 2, classState: {
        turnStartResolvedTurnKey: `${combatId}:1:actor`,
        monsterLegendaryActionPoints: exhausted ? 0 : monster.legendaryActionPoints ?? 3,
        monsterRechargeReadyByActionId: { [usageActionId]: !exhausted },
        monsterActionUsesByActionId: action.usage?.kind === 'per-day'
          ? { [usageActionId]: { current: exhausted ? 0 : action.usage.max, max: action.usage.max } } : {},
      },
    })
    const target = createDnd5eCombatant({
      id: 'target', name: 'special target', controller: 'player', initiative: legendary ? 20 : 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 1, maxHp: 1000, currentHp: 500,
      temporaryHp: 0, speed: 30, position: { x: 5, y: 0 }, concentrating: false,
      creatureType: rule.kind === 'saving-throw-condition' ? rule.requiredTargetCreatureTypes?.[0] ?? 'humanoid' : 'humanoid',
      sizeRank: 2,
    })
    let state = startDnd5eHeadlessCombat(combatId, [actor, target])
    state.distanceFeetByCombatantPair = { 'actor\u0000target': 5 }
    if (action.relationRequirement?.kind === 'target-linked-to-source') {
      const slot = action.relationRequirement.slotGroup
      const producer = monster.actions.find(candidate => candidate.attack?.onHitEffects?.some(effect =>
        effect.kind === 'source-linked-condition' && effect.relation.slotGroup === slot))!
      const prepared = resolveDnd5eHeadlessAction(state, { type: 'monster-action', actorId: 'actor', actionId: producer.id,
        rolls: [{ targetId: 'target', d20: 19, d20Second: 19,
          damageRolls: producer.attack!.damage.map(damage => Array(damage.count).fill(1)),
          onHitEffectRolls: producer.attack!.onHitEffects?.map(effect => ({ effectId: effect.id })) }] })
      expect(prepared.ok, 'source relation prerequisite').toBe(true)
      state = prepared.state
      state.combatants.actor.turn.actionAvailable = true
    }
    if (exhausted && !legendary && !action.usage) {
      state.combatants.actor.turn.actionAvailable = false
      state.combatants.actor.turn.bonusActionAvailable = false
    }
    if (rule.kind === 'persistent-area') state.environment = rule.requiredEnvironment
    const command: Extract<Dnd5eAction, { type: 'monster-special-action' | 'monster-legendary-special-action' }> = {
      type: legendary ? 'monster-legendary-special-action' : 'monster-special-action', actorId: actor.id, actionId: action.id,
    }
    const healDice = (damage: { count: number; sides: number }) => Array(damage.count).fill(maximum ? damage.sides : 1)
    const addCondition = (condition: Parameters<typeof createDnd5eConditionEffect>[0]['condition'] | 'curse' | 'disease', sameSource = false) => {
      if (condition === 'curse' || condition === 'disease') {
        state.combatants.target.conditions = [...state.combatants.target.conditions, condition]
        state.combatants.target.classState.activeEffects = [...(state.combatants.target.classState.activeEffects ?? []),
          createDnd5eMechanicalEffect({ definitionId: `verification:${condition}`, label: condition,
            legacyCondition: condition, targetId: 'target', source: { kind: 'dm' } })]
        return
      }
      const effect = createDnd5eConditionEffect({ condition, targetId: 'target',
        source: sameSource ? { kind: 'monster', actorId: 'actor', rulesId: `monster:${monster.id}:enslave` } : { kind: 'dm' } })
      state.combatants.target.classState.activeEffects = [...(state.combatants.target.classState.activeEffects ?? []), effect]
      state.combatants.target.conditions = [...state.combatants.target.conditions, condition]
    }
    if (rule.kind === 'ability-check') command.d20 = maximum ? 20 : 1
    if (rule.kind === 'saving-throw-condition' || rule.kind === 'saving-throw-terminal-effect') {
      command.targetId = target.id
      command.d20 = maximum ? 20 : 1
      command.d20Second = command.d20
      state.combatants.target.savingThrowBonuses[rule.ability] = maximum ? 40 : -10
      if (rule.kind === 'saving-throw-terminal-effect') {
        if (rule.requiredCondition) addCondition(rule.requiredCondition)
        if (rule.requiresTargetAtZeroHitPoints) state.combatants.target.currentHp = 0
        if (rule.healingOnDeath) command.damageRolls = healDice(rule.healingOnDeath)
      }
    }
    if (rule.kind === 'conditioned-damage-and-healing') {
      addCondition(rule.requiredCondition, rule.requireSameSource)
      command.targetId = target.id
      command.damageRolls = healDice(rule.damage)
    }
    if (rule.kind === 'healing-touch') {
      command.targetId = target.id
      command.damageRolls = healDice(rule.healing)
      for (const condition of rule.removes) addCondition(condition)
    }
    if (rule.kind === 'self-healing') command.damageRolls = healDice(rule.healing)
    if (rule.kind === 'temporary-armor-class-bonus') command.targetId = target.id
    if (rule.kind === 'teleport') command.teleportDestination = {
      to: { x: maximum ? rule.rangeFeet : 5, y: 0 }, distanceFeet: maximum ? rule.rangeFeet : 5,
      toElevationFeet: 0, toGroundElevationFeet: 0,
    }
    if (branch === 'out-of-range' && 'rangeFeet' in rule) state.distanceFeetByCombatantPair = { 'actor\u0000target': rule.rangeFeet + 5 }
    if (branch === 'source-blinded' || branch === 'target-blinded') {
      const id = branch === 'source-blinded' ? 'actor' : 'target'
      state.combatants[id].conditions = [...state.combatants[id].conditions, 'blinded']
      state.combatants[id].classState.activeEffects = [...(state.combatants[id].classState.activeEffects ?? []),
        createDnd5eConditionEffect({ condition: 'blinded', targetId: id, source: { kind: 'dm' } })]
    }
    if (branch === 'wrong-target-type' && rule.kind === 'saving-throw-condition') {
      const requiredTypes = new Set<string>(rule.requiredTargetCreatureTypes)
      state.combatants.target.creatureType = ['undead', 'construct', 'beast', 'humanoid']
        .find(type => !requiredTypes.has(type))!
    }
    if (branch === 'missing-condition') {
      state.combatants.target.conditions = []
      state.combatants.target.classState.activeEffects = []
    }
    if (branch === 'wrong-condition-source') for (const effect of state.combatants.target.classState.activeEffects ?? []) {
      effect.source = { ...effect.source, actorId: 'another-monster' }
    }
    if (branch === 'target-not-zero') state.combatants.target.currentHp = 1
    if (branch === 'wrong-environment') state.environment = undefined
    const before = structuredClone(state)
    const result = resolveDnd5eHeadlessAction(state, command)
    evidence.push({ monsterId: monster.id, slug: monster.slug, section, actionId: action.id,
      scenario: branch, ok: result.ok, expectedOk: !rejected, reason: result.ok ? undefined : result.reason,
      events: result.events, actor: result.state.combatants.actor, target: result.state.combatants.target })
    if (rejected) {
      expect(result.ok, label).toBe(false)
      // Moving a source-linked target out of range legitimately removes that
      // relation before this command is rejected. The attempted action itself
      // must still leave HP, turn economy and resource pools untouched.
      expect(result.state.combatants.actor).toEqual(before.combatants.actor)
      expect(result.state.combatants.target).toMatchObject({
        currentHp: before.combatants.target.currentHp,
        maxHp: before.combatants.target.maxHp,
        temporaryHp: before.combatants.target.temporaryHp,
      })
      expect(result.state.combatants.target.turn.actionAvailable)
        .toBe(before.combatants.target.turn.actionAvailable)
      expect(result.state.combatants.target.turn.bonusActionAvailable)
        .toBe(before.combatants.target.turn.bonusActionAvailable)
      return
    }
    expect(result.ok, `${label}: ${result.ok ? '' : result.reason}`).toBe(true)
    const afterActor = result.state.combatants.actor
    const afterTarget = result.state.combatants.target
    if (legendary) {
      expect(afterActor.classState.monsterLegendaryActionPoints).toBe((monster.legendaryActionPoints ?? 3) - (action.legendaryCost ?? 1))
      expect(afterActor.turn.actionAvailable).toBe(before.combatants.actor.turn.actionAvailable)
    } else expect(action.economy === 'bonus-action' ? afterActor.turn.bonusActionAvailable : afterActor.turn.actionAvailable).toBe(false)
    if (action.usage?.kind === 'recharge') expect(afterActor.classState.monsterRechargeReadyByActionId?.[usageActionId]).toBe(false)
    if (action.usage?.kind === 'per-day') expect(afterActor.classState.monsterActionUsesByActionId?.[usageActionId]?.current).toBe(action.usage.max - 1)
    if (rule.kind === 'ability-check') {
      const modifier = (rule.skillKey ? monster.skills?.find(skill => skill.key === rule.skillKey)?.bonus : undefined)
        ?? Math.floor((monster.abilities[rule.ability] - 10) / 2)
      expect(result.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved',
        ability: rule.ability, skill: rule.skillKey, d20: command.d20, modifier, total: command.d20! + modifier }))
    }
    if (rule.kind === 'saving-throw-condition' || rule.kind === 'saving-throw-terminal-effect') {
      expect(result.events).toContainEqual(expect.objectContaining({ type: 'saving-throw-resolved',
        targetId: target.id, ability: rule.ability, dc: rule.dc, success: maximum }))
      if (rule.kind === 'saving-throw-condition') {
        expect(afterTarget.conditions.includes(rule.condition)).toBe(!maximum)
        if (!maximum && rule.preventReactions) expect(afterTarget.turn.reactionAvailable).toBe(false)
      } else if (!maximum) {
        expect(afterTarget.currentHp).toBe(0)
        if (rule.failure === 'instant-death') expect(afterTarget.deathSaves.dead).toBe(true)
      }
    }
    if (rule.kind === 'healing-touch' || rule.kind === 'self-healing') {
      expect((rule.kind === 'healing-touch' ? afterTarget : afterActor).currentHp).toBe(500 +
        rule.healing.count * (maximum ? rule.healing.sides : 1) + rule.healing.bonus)
      if (rule.kind === 'healing-touch') for (const condition of rule.removes) expect(afterTarget.conditions).not.toContain(condition)
    }
    if (rule.kind === 'conditioned-damage-and-healing') {
      const damage = rule.damage.count * (maximum ? rule.damage.sides : 1) + rule.damage.bonus
      expect(afterTarget.currentHp).toBe(500 - damage)
      expect(afterActor.currentHp).toBe(500 + damage)
    }
    if (rule.kind === 'invisibility') {
      expect(afterActor.conditions).toContain('invisible')
      expect(afterActor.concentrating).toBe(true)
      expect(afterActor.classState.activeEffects).toEqual(expect.arrayContaining([expect.objectContaining({
        standardCondition: 'invisible', breakOn: rule.breakOn,
        duration: expect.objectContaining({ type: 'concentration', remainingRounds: rule.maximumDurationRounds }),
      })]))
    }
    if (rule.kind === 'teleport') expect(afterActor.position).toEqual(command.teleportDestination!.to)
    if (rule.kind === 'temporary-armor-class-bonus') expect(afterTarget.classState.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ modifiers: expect.objectContaining({ armorClassBonus: rule.armorClassBonus }) }),
    ]))
    if (rule.kind === 'self-combat-buff') expect(afterActor.classState.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ modifiers: expect.objectContaining(rule.modifiers) }),
    ]))
    if (rule.kind === 'automatic-area-active-effect') for (const combatant of [afterActor, afterTarget]) {
      expect(combatant.classState.activeEffects).toEqual(expect.arrayContaining([
        expect.objectContaining({ modifiers: expect.objectContaining(rule.modifiers) }),
      ]))
    }
    if (rule.kind === 'persistent-area') expect(afterActor.concentrating).toBe(rule.concentration)
    if (rule.kind === 'grant-movement') {
      expect(afterActor.turn.movementRemaining).toBe(before.combatants.actor.turn.movementRemaining)
      expect(afterActor.classState.monsterLegendaryMovement?.maximumFeet)
        .toBe(rule.maximumDistanceFeet ?? Math.floor(
          Math.max(monster.speed.walk, monster.speed.fly ?? 0, monster.speed.climb ?? 0, monster.speed.swim ?? 0) *
          (rule.maximumSpeedFraction ?? 0),
        ))
    }
  })
})

afterAll(() => {
  const destination = process.env.STARS_MONSTER_INVENTORY_DIR
  if (!destination) return
  const directory = path.resolve(destination)
  if (path.relative(process.cwd(), directory).startsWith('..')) throw new Error('evidence must be inside repository')
  mkdirSync(directory, { recursive: true })
  writeFileSync(path.join(directory, 'special-runtime.json'), JSON.stringify(evidence, null, 2))
})
