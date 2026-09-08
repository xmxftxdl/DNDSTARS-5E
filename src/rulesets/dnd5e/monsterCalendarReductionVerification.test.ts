import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { SharedCampaignTimeState } from '../../lib/campaignTime'
import type { Character } from '../../types/character'
import { normalizeDnd5eActiveEffects } from './activeEffects'
import { ensureDnd5eCoreSpellActivitiesRegisteredV1 } from './activities/dnd5eCoreSpellActivities'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat,
  type Dnd5eCombatant, type Dnd5eActionResult } from './headlessCombatEngine'
import { dnd5eCampaignRepeatSaveReductionRoll, reconcileDnd5eCharacterCampaignTime } from './campaignTimeRules'
import { getDnd5eSrdMonsterBySlug } from './monsters'
import { normalizeDnd5eCampaignPeriodicHitPointMaximumReduction } from './calendarMaximumReduction'

const evidence: unknown[] = []
const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 } as const
function combatant(id: string, initiative: number, patch: Partial<Dnd5eCombatant> = {}) {
  return createDnd5eCombatant({ id, name: id, controller: 'player', initiative, abilities, proficiencyBonus: 2, creatureType: 'humanoid',
    armorClass: 1, maxHp: 1000, currentHp: 1000, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false, ...patch })
}
const clock = (worldMinute: number): SharedCampaignTimeState => ({ schemaVersion: 2, worldMinute,
  displayMode: 'campaign-day', displayMinuteOffset: 0, timers: [], advances: [], updatedAt: worldMinute })
function success(result: Dnd5eActionResult) {
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
  if (!result.ok) throw new Error(result.reason)
  return result
}

describe('catalog periodic maximum HP reductions through the actual campaign clock', () => {
  it.each(['giant-rat-diseased', 'mummy', 'mummy-lord'])('%s retains, schedules, applies and cures its calendar field', slug => {
    const monster = getDnd5eSrdMonsterBySlug(slug)!
    const action = monster.actions.find(action => action.attack?.onHitEffects?.some(effect =>
      effect.kind === 'persistent-effect' && effect.campaignPeriodicHitPointMaximumReduction))!
    const effect = action.attack!.onHitEffects!.find(effect => effect.kind === 'persistent-effect')!
    if (effect.kind !== 'persistent-effect' || !effect.campaignPeriodicHitPointMaximumReduction) throw new Error('Missing periodic field')
    const policy = effect.campaignPeriodicHitPointMaximumReduction
    const actor = combatant('actor', 20, { controller: 'dm', statBlockId: monster.id })
    const target = combatant('hero', 10, { creatureType: 'humanoid', abilities: { ...abilities, con: 10 }, position: { x: 5, y: 0 } })
    const state = startDnd5eHeadlessCombat('calendar-source-' + slug, [actor, target])
    const hit = success(resolveDnd5eHeadlessAction(state, { type: 'monster-action', actorId: actor.id, actionId: action.id,
      rolls: [{ targetId: target.id, d20: 19, damageRolls: action.attack!.damage.map(damage => Array(damage.count).fill(1)),
        onHitEffectRolls: [{ effectId: effect.id, d20: 1 }] }] }))
    const effects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(hit.state.combatants.hero.classState.activeEffects)))
    const active = effects.find(candidate => candidate.definitionId === effect.definitionId)!
    expect(active.campaignPeriodicHitPointMaximumReduction).toEqual(policy)
    expect(active.periodicDamage).toBeUndefined()
    const character: Character = { id: 'hero', name: 'Hero', player: 'Player', avatar: '', accent: '',
      race: '人类', charClass: '战士', level: 1, background: '', experience: 0, reputation: 0,
      rulesetId: 'dnd5e-2014-srd-5.1', abilities, savingThrows: [], skills: [], maxHp: 1000,
      currentHp: hit.state.combatants.hero.currentHp, tempHp: 0, hitDice: 'd10', ac: 10, speed: 30,
      initiativeBonus: 0, saveDC: 10, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '',
      visibleToPlayers: true, dnd5eWorldTimeAppliedMinute: 0, dnd5eCombatState: { activeEffects: effects } }
    const doomed = reconcileDnd5eCharacterCampaignTime({ ...character, maxHp: 1, currentHp: 1 }, clock(0)).character
    const dead = reconcileDnd5eCharacterCampaignTime(doomed, clock(policy.intervalHours * 60)).character
    expect(dead.maxHp).toBe(0)
    expect(dead.currentHp).toBe(0)
    expect(dead.deathSaveFailures).toBe(3)
    expect(dead.dnd5eCombatState?.bodyPresent).toBe(slug === 'giant-rat-diseased' ? undefined : false)
    const scheduled = reconcileDnd5eCharacterCampaignTime(character, clock(0)).character
    const interval = policy.intervalHours * 60
    expect(scheduled.dnd5eCombatState?.activeEffects?.find(candidate => candidate.id === active.id)
      ?.campaignPeriodicHitPointMaximumReduction?.nextWorldMinute).toBe(interval)
    const reexposedTarget = combatant('hero', 10, { classState: scheduled.dnd5eCombatState })
    const reexposedState = startDnd5eHeadlessCombat('calendar-reapply-' + slug, [actor, reexposedTarget])
    const reexposed = success(resolveDnd5eHeadlessAction(reexposedState, { type: 'monster-action', actorId: actor.id,
      actionId: action.id, rolls: [{ targetId: 'hero', d20: 19,
        damageRolls: action.attack!.damage.map(damage => Array(damage.count).fill(1)),
        onHitEffectRolls: [{ effectId: effect.id, d20: 1 }] }] }))
    expect(reexposed.state.combatants.hero.classState.activeEffects?.find(candidate => candidate.id === active.id)
      ?.campaignPeriodicHitPointMaximumReduction?.nextWorldMinute).toBe(interval)
    const before = reconcileDnd5eCharacterCampaignTime(scheduled, clock(interval - 1)).character
    expect(before.maxHp).toBe(1000)
    const first = reconcileDnd5eCharacterCampaignTime(before, clock(interval)).character
    const reduction = (due: number) => dnd5eCampaignRepeatSaveReductionRoll(active.id, 'hero', due,
      policy.reduction.count, policy.reduction.sides, policy.reduction.bonus)
    expect(first.maxHp).toBe(1000 - reduction(interval))
    expect(first.dnd5eCombatState?.hitPointMaximumReductionLedger?.entries).toHaveLength(1)
    const replay = reconcileDnd5eCharacterCampaignTime(first, clock(interval))
    expect(replay.changed).toBe(false)
    expect(replay.character.maxHp).toBe(first.maxHp)
    const second = reconcileDnd5eCharacterCampaignTime(first, clock(interval * 2)).character
    expect(second.maxHp).toBe(first.maxHp - reduction(interval * 2))
    expect(second.dnd5eCombatState?.hitPointMaximumReductionLedger?.entries).toHaveLength(2)
    const healer = combatant('healer', 20, { classId: 'cleric', level: 5,
      classSelections: { 'spell-prepared': ['cure-wounds', 'remove-curse'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 }, 'dnd5e-spell-slot-3': { current: 1, max: 1 } } })
    const afflicted = combatant('hero', 10, { currentHp: second.currentHp, maxHp: second.maxHp,
      position: { x: 5, y: 0 }, classState: { activeEffects: second.dnd5eCombatState?.activeEffects,
        hitPointMaximumReductionLedger: second.dnd5eCombatState?.hitPointMaximumReductionLedger } })
    const cureState = startDnd5eHeadlessCombat('calendar-cure-' + slug, [healer, afflicted])
    cureState.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(healer.id, afflicted.id)]: 5 }
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const cured = success(slug === 'giant-rat-diseased'
      ? resolveDnd5eHeadlessAction(cureState, { type: 'cast-spell', actorId: healer.id, targetId: afflicted.id,
        spellId: 'cure-wounds', slotLevel: 1, effectRolls: [1] })
      : resolveDnd5eHeadlessAction(cureState, { type: 'plugin-spell-activity', actorId: healer.id,
        pluginAction: { type: 'plugin', pluginId: 'srd-5.1', actionId: 'spell:remove-curse',
          transactionId: 'calendar-remove-curse-' + slug, actorId: healer.id, targetId: afflicted.id,
          targetIds: [afflicted.id], distanceFeet: 5, castLevel: 3, rolls: {} },
        spell: { castingClassId: 'cleric', spellId: 'remove-curse', spellName: '移除诅咒',
          spellLevel: 3, slotLevel: 3, castingTime: 'action', declaredTargetIds: [afflicted.id], spellSchool: 'abjuration' } }))
    expect(cured.state.combatants.hero.maxHp).toBe(1000)
    expect(cured.state.combatants.hero.classState.activeEffects?.some(candidate => candidate.id === active.id) ?? false).toBe(false)
    const afterCure = reconcileDnd5eCharacterCampaignTime({ ...second,
      maxHp: cured.state.combatants.hero.maxHp, dnd5eCombatState: cured.state.combatants.hero.classState }, clock(interval * 3))
    expect(afterCure.character.maxHp).toBe(1000)
    evidence.push({ slug, section: 'actions', actionId: action.id, scenario: 'calendar-boundary-replay-and-cure',
      firstReduction: reduction(interval), secondReduction: reduction(interval * 2), policy,
      maxHp: [1000, before.maxHp, first.maxHp, replay.character.maxHp, second.maxHp, afterCure.character.maxHp],
      cureEvents: cured.events })
  })

  it.each([0, -1, 0.5, Number.POSITIVE_INFINITY])('rejects an invalid calendar interval %s', intervalHours => {
    expect(normalizeDnd5eCampaignPeriodicHitPointMaximumReduction({ intervalHours,
      reduction: { average: 3, count: 1, sides: 6, bonus: 0 }, execution: 'campaign-time-only', recovery: 'when-effect-removed' })).toBeUndefined()
  })
})
afterAll(() => {
  const destination = process.env.STARS_MONSTER_INVENTORY_DIR
  if (!destination) return
  const directory = path.resolve(destination)
  if (path.relative(process.cwd(), directory).startsWith('..')) throw new Error('evidence must stay inside repository')
  mkdirSync(directory, { recursive: true })
  writeFileSync(path.join(directory, 'calendar-runtime.json'), JSON.stringify(evidence, null, 2))
})
