import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat,
  type Dnd5eMonsterOnHitEffectRoll } from './headlessCombatEngine'
import { DND5E_SRD_MONSTERS } from './monsters'

const cases = DND5E_SRD_MONSTERS.flatMap(monster => monster.actions.flatMap(action =>
  action.automation === 'headless' && action.attack ? (action.attack.onHitEffects ?? []).flatMap(effect => {
    if (effect.kind !== 'saving-throw-condition' && effect.kind !== 'persistent-effect') return []
    const savingThrow = effect.kind === 'saving-throw-condition' ? effect : effect.savingThrow
    const excludedType = effect.targetCreatureTypeExclusions?.[0]
      ?? (effect.kind === 'persistent-effect' && effect.targetCreatureTypeRequirements?.length ? 'construct' : undefined)
    const branches = ['apply', ...(savingThrow ? ['save'] : []),
      ...(effect.kind === 'saving-throw-condition' ? ['condition-immune'] : []),
      ...(excludedType ? ['excluded-type'] : [])]
    return branches.map(branch => ({ monster, action, effect, branch, excludedType,
      label: `${monster.slug}:${action.id}:${effect.id}:${branch}` }))
  }) : []))
const evidence: unknown[] = []

describe('catalog on-hit condition and persistent effect field settlement', () => {
  it.each(cases)('$label', ({ monster, action, effect, branch, excludedType, label }) => {
    const savingThrow = effect.kind === 'saving-throw-condition' ? effect : effect.savingThrow
    const combatId = `on-hit:${label}`
    const actor = createDnd5eCombatant({ id: 'actor', name: monster.name, controller: 'dm', initiative: 20,
      statBlockId: monster.id, abilities: monster.abilities, proficiencyBonus: 2, armorClass: 10,
      currentHp: 1000, maxHp: 1000, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
      classState: { turnStartResolvedTurnKey: `${combatId}:1:actor`, monsterActionUsesByActionId:
        Object.fromEntries(monster.actions.flatMap(a => a.usage?.kind === 'per-day' ? [[a.id, { current: a.usage.max, max: a.usage.max }]] : [])) } })
    const score = branch === 'save' ? 30 : 10
    const target = createDnd5eCombatant({ id: 'target', name: 'Target', controller: 'player', initiative: 10,
      abilities: { str: score, dex: score, con: score, int: score, wis: score, cha: score }, proficiencyBonus: 2,
      creatureType: branch === 'excluded-type' ? excludedType : 'humanoid', armorClass: 1,
      currentHp: 1000, maxHp: 1000, temporaryHp: 0, speed: 30, position: { x: 5, y: 0 }, concentrating: false,
      conditionImmunities: branch === 'condition-immune' && effect.kind === 'saving-throw-condition'
        ? [effect.conditionOnFailedSave.condition] : [] })
    const state = startDnd5eHeadlessCombat(combatId, [actor, target])
    const rolls: Dnd5eMonsterOnHitEffectRoll[] = (action.attack!.onHitEffects ?? []).map(e => ({
      effectId: e.id, ...((branch !== 'excluded-type' && (e.kind === 'saving-throw-condition' || ('savingThrow' in e && e.savingThrow)))
        ? { d20: branch === 'save' ? 20 : 1, d20Second: branch === 'save' ? 20 : 1 } : {}),
      ...(e.kind === 'saving-throw-condition' && e.sharedDurationOnFailureMargin && branch !== 'save'
        ? { durationRolls: Array(e.sharedDurationOnFailureMargin.count).fill(1) }
        : {}),
    }))
    const result = resolveDnd5eHeadlessAction(state, { type: 'monster-action', actorId: actor.id, actionId: action.id,
      rolls: [{ targetId: target.id, d20: 19, d20Second: 19,
        damageRolls: action.attack!.damage.map(damage => Array(damage.count).fill(1)), onHitEffectRolls: rolls }] })
    expect(result.ok, `${label}: ${result.ok ? '' : result.reason}`).toBe(true)
    const affected = result.state.combatants.target
    const effects = affected.classState.activeEffects ?? []
    const applies = branch === 'apply'
    if (savingThrow && branch !== 'excluded-type') expect(result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: target.id, ability: savingThrow.ability,
      dc: savingThrow.dc, success: branch === 'save' }))
    if (effect.kind === 'saving-throw-condition') {
      const condition = effect.conditionOnFailedSave
      expect(affected.conditions.includes(condition.condition)).toBe(applies)
      if (applies) {
        const active = effects.find(candidate => candidate.standardCondition === condition.condition)
        expect(active).toBeDefined()
        expect(active?.duration).toMatchObject({ type: 'rounds', remainingRounds: condition.durationRounds })
        if (condition.repeatSaveAtEndOfTargetTurn) expect(active?.repeatSave).toMatchObject({
          ability: effect.ability, dc: effect.dc, timing: 'target-turn-end' })
        if (condition.preventHealing) expect(active?.modifiers?.preventHealing).toBe(true)
        for (const additional of effect.additionalConditionsOnFailedSave ?? []) {
          expect(affected.conditions).toContain(additional.condition)
          const child = effects.find(candidate => candidate.standardCondition === additional.condition)
          expect(child?.duration).toMatchObject({ type: 'rounds', remainingRounds: additional.durationRounds })
          if (additional.breakOnDamage) expect(child?.breakOn).toContain('takes-damage')
          if (additional.canBeAwakenedByAction) expect(child?.breakOn).toContain('awakened')
        }
      } else for (const additional of effect.additionalConditionsOnFailedSave ?? [])
        expect(affected.conditions).not.toContain(additional.condition)
    } else {
      const active = effects.find(candidate => candidate.definitionId === effect.definitionId)
      expect(!!active).toBe(applies)
      if (applies) {
        expect(active?.source).toMatchObject({ actorId: actor.id, kind: 'monster' })
        if (effect.ailment) expect(active?.legacyCondition).toBe(effect.ailment)
        if (effect.standardCondition) expect(affected.conditions).toContain(effect.standardCondition)
        if (effect.durationRounds) expect(active?.duration).toMatchObject({ type: 'rounds', remainingRounds: effect.durationRounds })
        if (effect.periodicDamage) expect(active?.periodicDamage).toMatchObject(effect.periodicDamage)
        if (effect.modifiers) expect(active?.modifiers).toMatchObject(effect.modifiers)
        if (effect.removal) expect(active?.removal).toMatchObject(effect.removal)
        if (effect.escapeCheck) expect(active?.escapeCheck).toMatchObject(effect.escapeCheck)
        if (effect.repeatSave) expect(active?.repeatSave).toMatchObject(effect.repeatSave)
        if (effect.calendarRepeatSave) expect(active?.calendarRepeatSave).toMatchObject(effect.calendarRepeatSave)
        if (effect.campaignPeriodicHitPointMaximumReduction) expect(active?.campaignPeriodicHitPointMaximumReduction)
          .toMatchObject(effect.campaignPeriodicHitPointMaximumReduction)
      }
    }
    evidence.push({ slug: monster.slug, section: 'actions', actionId: action.id, effectId: effect.id,
      scenario: `${effect.id}:${branch}`, events: result.events, activeEffects: effects, conditions: affected.conditions })
  })
})
afterAll(() => {
  const destination = process.env.STARS_MONSTER_INVENTORY_DIR
  if (!destination) return
  const directory = path.resolve(destination)
  if (path.relative(process.cwd(), directory).startsWith('..')) throw new Error('evidence must stay inside repository')
  mkdirSync(directory, { recursive: true })
  writeFileSync(path.join(directory, 'on-hit-runtime.json'), JSON.stringify(evidence, null, 2))
})
