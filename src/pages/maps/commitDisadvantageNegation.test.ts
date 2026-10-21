import { resolveAndCommitDnd5eActivityCommand } from '../../rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge'
import { withDnd5eCriticalCancellationCheckpoints } from '../../rulesets/dnd5e/criticalCancellationCheckpoint'
import { dnd5eCombatantPairKey } from '../../rulesets/dnd5e/headlessCombatPrimitives'
import { settleDnd5eActivityTriggerWindowsV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityTriggerSettlement'
import { requestMapActivityNegation, createMapActivityNegationDice } from './requestActivityNegationDice'
import { compileDnd5eActivityHeadlessAction } from '../../rulesets/dnd5e/activities/dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityFeatureActionAdapter'
import { collectDnd5eActivityNegationDice } from '../../rulesets/dnd5e/activities/dnd5eActivityNegationDice'
import { getRegisteredDnd5eActivity, registerDnd5eActivityPackage } from '../../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import { dnd5eActivityActorSnapshotFromCombatantV1, resolveRegisteredDnd5eActivityInCombatV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityCombatAuthority'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { prepareDnd5eActivityDisadvantageNegation, dnd5eActivityNegationContext } from '../../rulesets/dnd5e/activities/dnd5eActivityDisadvantageNegation'
import { requestBasicContestNegation } from './requestBasicContestNegation'
import { prepareDnd5ePlayerBasicAction, resolvePreparedDnd5ePlayerBasicAction } from '../../rulesets/dnd5e/playerBasicAction'
import { createDnd5eTurnEconomyCounts } from '../../rulesets/dnd5e/turnEconomy'
import { DND5E_SRD_MONSTERS, dnd5eMonsterAreaSavingThrowEffect, setDnd5eRoomMonsterCatalog } from '../../rulesets/dnd5e/monsters'
import { previewDnd5eSpellcastingSaves, commitDnd5eActivityExecution, resolveDnd5ePersistentAreaTrigger } from '../../rulesets/dnd5e/headlessCombatEngine'
import { prepareDnd5eBeginTurn, resolveDnd5eBeginTurn } from '../../rulesets/dnd5e/beginTurnAction'
import { dnd5ePendingNegationReservations, dnd5eDisadvantageNegationOptions } from '../../rulesets/dnd5e/disadvantageNegation'
import type { BattleMap } from '../../store/maps'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from '../../rulesets/dnd5e/activeEffects'
import { settleDnd5eConcentrationChecks } from './settleDnd5eCombatResult'
import { beforeEach, expect, it, vi } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { registerDnd5eRulesPlugin } from '../../rulesets/dnd5e/pluginApi'
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway'
import { commitDisadvantageNegation } from './commitDisadvantageNegation'
import { requestDisadvantageNegation } from './requestDisadvantageNegation'
import { migrateCharacterToDnd5e, createCombatantFromDnd5eCharacter } from '../../rulesets/dnd5e/character'
import { startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eHeadlessTurnKey } from '../../rulesets/dnd5e/headlessCombatEngine'

const session = vi.hoisted(() => ({ current: { roomId: 'room', memberId: 'dm', role: 'dm' } }))
vi.mock('../../lib/roomSession', () => ({ getRoomSession: () => session.current }))
beforeEach(() => { session.current = { roomId: 'room', memberId: 'dm', role: 'dm' } })

function fixture() {
  let featureId = ''
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.negation-commit', name: 'Test', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0' }, setup(api) {
    featureId = api.registerFeature({ id: 'choice', name: 'Choice', summary: 'Test', description: 'Test', automation: 'full',
      declarativeAbility: { schemaVersion: 1, id: 'choice', name: 'Choice', description: 'Test', level: 1,
        trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
        cost: { economy: 'none', resources: [{ resourceId: 'dnd5e-ki', scope: 'core', amount: 2 }] },
        mechanic: { kind: 'd20-disadvantage-negation', rollKinds: ['attack', 'ability-check', 'saving-throw'] } } })
  } })
  const hero = normalizeCharacter({ id: 'hero', charClass: '武僧', level: 11, dnd5ePluginFeatureIds: [featureId],
    classResources: { 'dnd5e-ki': { current: 3, max: 11 } } })
  let data: Record<string, any> = {
    characters: { characters: [hero], updatedAt: 1, _sync: { revision: 4 } },
    'combat-interrupts': { mapId: 'map', updatedAt: 1, _sync: { revision: 8 }, interrupts: [{
      id: 'prompt', mapId: 'map', transactionId: 'action', kind: 'plugin-choice', phase: 'before-action', status: 'answered', actorCharId: 'hero',
      payload: { featureId, pluginId: 'test.negation-commit', audience: 'actor', options: [{ id: 'use' }, { id: 'decline' }],
        disadvantageNegation: { rollId: 'host-roll', characterId: 'hero', kind: 'attack', mode: 'disadvantage', phase: 'before-roll' } },
      response: { optionId: 'use' },
    }] },
  }
  let lostReply = false
  const gateway: Pick<SharedRoomGatewayPort, 'loadResource' | 'saveResourcesAtomically'> = {
    loadResource: async <T>(name: string) => structuredClone(data[name]) as T,
    saveResourcesAtomically: vi.fn<SharedRoomGatewayPort['saveResourcesAtomically']>(async (writes, options) => {
      if (writes.some(write => write.expectedRevision !== data[write.name]._sync.revision)) throw Error('conflict')
      const next = structuredClone(data)
      for (const write of writes) next[write.name] = { ...structuredClone(write.data as object), _sync: { revision: data[write.name]._sync.revision + 1 } }
      data = next
      if (lostReply) throw Error('lost acknowledgement')
      return { status: 'committed', transactionId: options?.transactionId ?? '', revisions: {} }
    }),
  }
  return { dispose, gateway, data: () => data, prompt: () => data['combat-interrupts'].interrupts[0],
    input: { mapId: 'map', interruptId: 'prompt' }, loseReply: () => { lostReply = true } }
}

it.each([false, true])('atomically spends once, recovers reload and lost reply=%s', async lost => {
  const f = fixture()
  try {
    if (lost) f.loseReply()
    const response = await commitDisadvantageNegation(f.input, f.gateway)
    expect(response).toMatchObject({ mode: 'normal', used: true })
    expect(f.data().characters.characters[0].classResources['dnd5e-ki'].current).toBe(1)
    expect(f.prompt().status).toBe('done')
    expect(await commitDisadvantageNegation(f.input, { ...f.gateway })).toEqual(response)
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1)
  } finally { f.dispose() }
})

it('accepts the Host choice for a DM-controlled roller without changing the receipt owner', async () => {
  const f = fixture()
  try {
    f.prompt().payload.audience = 'dm'
    expect(await commitDisadvantageNegation(f.input, f.gateway)).toMatchObject({ used: true, characterId: 'hero' })
    expect(f.data().characters.characters[0].classResources['dnd5e-ki'].current).toBe(1)
  } finally { f.dispose() }
})

it('declines without a debit and rejects a changed replay', async () => {
  const f = fixture()
  try {
    f.prompt().response.optionId = 'decline'
    expect(await commitDisadvantageNegation(f.input, f.gateway)).toMatchObject({ used: false, mode: 'disadvantage' })
    expect(f.data().characters.characters[0].classResources['dnd5e-ki'].current).toBe(3)
    f.prompt().response.optionId = 'use'
    await expect(commitDisadvantageNegation(f.input, f.gateway)).rejects.toThrow('receipt-mismatch')
  } finally { f.dispose() }
})

it('fails stale writes without a debit, retry, or completion', async () => {
  const f = fixture()
  try {
    const save = f.gateway.saveResourcesAtomically
    f.gateway.saveResourcesAtomically = async (writes, options) => { f.data().characters._sync.revision++; return save(writes, options) }
    await expect(commitDisadvantageNegation(f.input, f.gateway)).rejects.toThrow('conflict')
    expect(f.data().characters.characters[0].classResources['dnd5e-ki'].current).toBe(3)
    expect(f.prompt().status).toBe('answered')
  } finally { f.dispose() }
})

it.each(['rolled', 'poor', 'other-owner', 'retired', 'player', 'switch-room'])('rejects %s before any debit', async failure => {
  const f = fixture()
  try {
    if (failure === 'rolled') f.prompt().payload.disadvantageNegation.phase = 'rolled'
    if (failure === 'poor') f.data().characters.characters[0].classResources['dnd5e-ki'].current = 1
    if (failure === 'other-owner') f.prompt().payload.disadvantageNegation.characterId = 'other'
    if (failure === 'retired') f.data()['combat-interrupts'].interrupts = []
    if (failure === 'player') session.current.role = 'player'
    if (failure === 'switch-room') {
      const read = f.gateway.loadResource
      f.gateway.loadResource = async <T>(name: string) => { const value = await read<T>(name); session.current.roomId = 'other'; return value }
    }
    await expect(commitDisadvantageNegation(f.input, f.gateway)).rejects.toThrow()
    expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled()
  } finally { f.dispose() }
})

it.each(['attack', 'ability-check', 'saving-throw'] as const)('routes the owning player choice into the atomic %s settlement', async kind => {
  const f = fixture()
  try {
    const character = f.data().characters.characters[0]
    const roll = { rollId: `host-${kind}`, characterId: character.id, kind, mode: 'disadvantage' as const, phase: 'before-roll' as const }
    let current = true
    const choose = vi.fn(async (choice: import('./requestDisadvantageNegation').DisadvantageNegationChoice) => {
      expect(choice.actor.id).toBe(character.id)
      expect(choice.audience).toBe('actor')
      expect(choice.options[0].label).toContain('2 点气')
      f.prompt().id = choice.id
      f.prompt().payload = { ...choice, ...choice.context }
      f.prompt().response = { optionId: 'use' }
      return 'use'
    })
    const input = { mapId: 'map', transactionId: 'action', character, roll }
    const result = await requestDisadvantageNegation(input, { choose, isCurrent: () => current,
      commit: args => commitDisadvantageNegation(args, f.gateway) })
    expect(result).toMatchObject({ mode: 'normal', used: true, rollId: roll.rollId })
    expect(f.data().characters.characters[0].classResources['dnd5e-ki'].current).toBe(1)
    current = false
    await expect(requestDisadvantageNegation(input, { choose, isCurrent: () => current })).rejects.toThrow('context-changed')
    expect(choose).toHaveBeenCalledTimes(1)
  } finally { f.dispose() }
})

it('does not debit after a cancelled choice or changed pre-roll context', async () => {
  const f = fixture()
  try {
    const character = f.data().characters.characters[0]
    const input = { mapId: 'map', transactionId: 'action', character,
      roll: { rollId: 'roll', characterId: character.id, kind: 'attack' as const, mode: 'disadvantage' as const, phase: 'before-roll' as const } }
    const commit = vi.fn()
    expect(await requestDisadvantageNegation(input, { choose: async () => undefined, isCurrent: () => true, commit })).toBeUndefined()
    let current = true
    await expect(requestDisadvantageNegation(input, { choose: async () => { current = false; return 'use' }, isCurrent: () => current, commit })).rejects.toThrow('context-changed')
    expect(commit).not.toHaveBeenCalled()
  } finally { f.dispose() }
})

it('carries the paid receipt across reload into one exact Headless check without restoring Ki', async () => {
  const f = fixture()
  try {
    f.prompt().payload.disadvantageNegation.kind = 'ability-check'
    await commitDisadvantageNegation(f.input, f.gateway)
    const saved = normalizeCharacter(JSON.parse(JSON.stringify(f.data().characters.characters[0])))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(saved), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    const state = startDnd5eHeadlessCombat('check', [actor, { ...structuredClone(actor), id: 'enemy', controller: 'dm', initiative: -10 }])
    const action = { type: 'ability-check' as const, actorId: actor.id, ability: 'wis' as const, mode: 'disadvantage' as const,
      d20: 18, d20Second: 2, disadvantageNegation: { rollId: 'host-roll', transactionId: 'action' } }
    const before = JSON.stringify(state)
    const result = resolveDnd5eHeadlessAction(state, action)
    expect(result.ok).toBe(true)
    expect(result.events.find(event => event.type === 'ability-check-resolved')).toMatchObject({ d20: 18 })
    expect(result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(1)
    expect(result.state.combatants[actor.id].classState.disadvantageNegationReceipts).toBeUndefined()
    expect(JSON.stringify(state)).toBe(before)
    expect(resolveDnd5eHeadlessAction(result.state, action).ok).toBe(false)
    expect(resolveDnd5eHeadlessAction(state, { ...action, disadvantageNegation: { ...action.disadvantageNegation, transactionId: 'other' } }).ok).toBe(false)
    expect(resolveDnd5eHeadlessAction(state, { ...action, mode: 'normal' }).ok).toBe(false)
    const ordinary = resolveDnd5eHeadlessAction(state, { ...action, disadvantageNegation: undefined })
    expect(ordinary.events.find(event => event.type === 'ability-check-resolved')).toMatchObject({ d20: 2 })
  } finally { f.dispose() }
})

it.each(['attack', 'opportunity-attack'] as const)('consumes a paid receipt only for its %s and keeps the debit', async type => {
  const f = fixture()
  try {
    await commitDisadvantageNegation(f.input, f.gateway)
    const saved = normalizeCharacter(JSON.parse(JSON.stringify(f.data().characters.characters[0])))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(saved), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    const target = { ...structuredClone(actor), id: 'enemy', controller: 'dm' as const, initiative: type === 'opportunity-attack' ? 100 : -10, armorClass: 10, currentHp: 30, maxHp: 30, position: { x: 1, y: 0 } }
    const state = startDnd5eHeadlessCombat('attack', [actor, target])
    const action = { type, actorId: actor.id, targetId: target.id, mode: 'disadvantage' as const, attackModifier: 0,
      d20: 18, d20Second: 2, damage: { count: 1, sides: 4, bonus: 0, rolls: [3], type: 'bludgeoning' as const },
      disadvantageNegation: { rollId: 'host-roll', transactionId: 'action' } }
    const result = resolveDnd5eHeadlessAction(state, action)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.events.find(event => event.type === 'attack-resolved')).toMatchObject({ d20: 18, hit: true })
    expect(result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(1)
    expect(result.state.combatants[actor.id].classState.disadvantageNegationReceipts).toBeUndefined()
    expect(resolveDnd5eHeadlessAction(state, { ...action, disadvantageNegation: { rollId: 'host-roll', transactionId: 'forged' } }).ok).toBe(false)
    const second = structuredClone(result.state); second.combatants[actor.id].turn.actionAvailable = true; second.combatants[actor.id].turn.reactionAvailable = true
    expect(resolveDnd5eHeadlessAction(second, action).ok).toBe(false)
  } finally { f.dispose() }
})


it('reserves parent Ki and binds a paid Flurry cancellation to just the second attack', async () => {
  const f = fixture()
  try {
    const roll = f.prompt().payload.disadvantageNegation
    roll.occurrence = 1
    roll.reservedResources = [{ resourceKey: 'dnd5e-ki', amount: 2 }]
    await expect(commitDisadvantageNegation(f.input, f.gateway)).rejects.toThrow('negation-feature-unavailable')
    expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled()
    roll.reservedResources[0].amount = 1
    await commitDisadvantageNegation(f.input, f.gateway)
    const saved = normalizeCharacter(JSON.parse(JSON.stringify(f.data().characters.characters[0])))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(saved), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    const target = { ...structuredClone(actor), id: 'enemy', controller: 'dm' as const, initiative: -10, armorClass: 10, currentHp: 30, maxHp: 30, position: { x: 1, y: 0 } }
    const state = startDnd5eHeadlessCombat('flurry', [actor, target])
    state.combatants[target.id].dodging = true
    state.combatants[actor.id].classState.monkAttackActionTurnKey = dnd5eHeadlessTurnKey(state, actor.id)
    const receipt = { rollId: 'host-roll', transactionId: 'action' }
    const strike = { targetId: target.id, d20: 18, d20Second: 2, mode: 'disadvantage' as const, damageRolls: [3] }
    const action = { type: 'monk-unarmed-bonus' as const, actorId: actor.id, mode: 'flurry' as const,
      attackModifier: 0, reachFeet: 5, damageType: 'bludgeoning' as const, damage: { count: 1, sides: 4, bonus: 0 },
      attacks: [{ ...strike, damageRolls: [] }, { ...strike, disadvantageNegation: receipt }] }
    const result = resolveDnd5eHeadlessAction(state, action)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.events.filter(event => event.type === 'attack-resolved').map(event => ({ d20: event.d20, hit: event.hit })))
      .toEqual([{ d20: 2, hit: false }, { d20: 18, hit: true }])
    expect(result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(0)
    expect(result.state.combatants[actor.id].classState.disadvantageNegationReceipts).toBeUndefined()
    expect(result.state.combatants[target.id].currentHp).toBe(27)
    const swapped = resolveDnd5eHeadlessAction(state, { ...action, attacks: [{ ...strike, disadvantageNegation: receipt }, strike] })
    expect(swapped.ok).toBe(false)
    expect(state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(1)
  } finally { f.dispose() }
})


it('defers a staged movement choice to its parent transaction without publishing a debit', async () => {
  const f = fixture()
  try {
    const character = f.data().characters.characters[0]
    const commit = vi.fn()
    const result = await requestDisadvantageNegation({ mapId: 'map', transactionId: 'follow', character,
      roll: { rollId: 'follow-attack', characterId: character.id, kind: 'attack', mode: 'disadvantage', phase: 'before-roll' } },
      { choose: async () => 'use', isCurrent: () => true, commit, deferToParentTransaction: true })
    expect(result).toMatchObject({ used: true, rollId: 'follow-attack' })
    expect(commit).not.toHaveBeenCalled()
    expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled()
    expect(f.data().characters.characters[0].classResources['dnd5e-ki'].current).toBe(3)
  } finally { f.dispose() }
})


it.each(['fire-bolt', 'eldritch-blast'] as const)('consumes the paid receipt only on the selected %s attack', async spellId => {
  const f = fixture()
  try {
    const multi = spellId === 'eldritch-blast'
    f.prompt().payload.disadvantageNegation.occurrence = multi ? 1 : 0
    await commitDisadvantageNegation(f.input, f.gateway)
    const saved = normalizeCharacter(JSON.parse(JSON.stringify(f.data().characters.characters[0])))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(saved), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    const castingClassId = multi ? 'warlock' as const : 'wizard' as const
    actor.classId = castingClassId
    actor.level = 14
    actor.classLevels = { monk: 11, [castingClassId]: 3 }
    actor.classSelections = { 'spell-cantrips': [spellId] }
    actor.classSelectionsByClass = { [castingClassId]: { 'spell-cantrips': [spellId] } }
    const target = { ...structuredClone(actor), id: 'enemy', controller: 'dm' as const, initiative: -10, armorClass: 12, currentHp: 40, maxHp: 40, position: { x: 4, y: 0 } }
    const state = startDnd5eHeadlessCombat('spell-luck', [actor, target])
    const paid = { rollId: 'host-roll', transactionId: 'action' }
    const attack = { targetId: target.id, d20: 18, d20Second: 2, mode: 'disadvantage' as const, effectRolls: [] as number[] }
    const action = { type: 'cast-spell' as const, actorId: actor.id, targetId: target.id, spellId, castingClassId, slotLevel: 0,
      d20: multi ? undefined : 18, d20Second: multi ? undefined : 2, mode: 'disadvantage' as const,
      effectRolls: multi ? [] : [3, 3, 3], disadvantageNegation: multi ? undefined : paid,
      projectileTargetIds: multi ? [target.id, target.id, target.id] : undefined,
      targetAttacks: multi ? [attack, { ...attack, effectRolls: [3], disadvantageNegation: paid }, attack] : undefined }
    const result = resolveDnd5eHeadlessAction(state, action)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    const hits = result.events.filter(event => event.type === 'attack-resolved')
    expect(hits.map(event => event.d20)).toEqual(multi ? [2, 18, 2] : [18])
    expect(result.state.combatants[target.id].currentHp).toBe(multi ? 37 : 31)
    expect(result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(1)
    expect(result.state.combatants[actor.id].classState.disadvantageNegationReceipts).toBeUndefined()
    if (multi) {
      expect(resolveDnd5eHeadlessAction(state, { ...action, targetAttacks: [{ ...attack, effectRolls: [3], disadvantageNegation: paid }, attack, attack] }).ok).toBe(false)
    } else {
      expect(resolveDnd5eHeadlessAction(state, { ...action, disadvantageNegation: { ...paid, transactionId: 'other' } }).ok).toBe(false)
    }
  } finally { f.dispose() }
})


it('uses a paid saving-throw receipt for concentration without changing another save or rerolling', async () => {
  const f = fixture()
  try {
    f.prompt().payload.disadvantageNegation.kind = 'saving-throw'
    await commitDisadvantageNegation(f.input, f.gateway)
    const saved = normalizeCharacter(JSON.parse(JSON.stringify(f.data().characters.characters[0])))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(saved), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    actor.concentrating = true
    actor.classState.concentrationCheckDisadvantagePendingSourceId = 'enemy'
    const state = startDnd5eHeadlessCombat('concentration-luck', [actor, { ...structuredClone(actor), id: 'enemy', controller: 'dm', initiative: -10 }])
    const action = { type: 'concentration-save' as const, actorId: actor.id, d20: 18, d20Second: 2, dc: 10,
      disadvantageNegation: { rollId: 'host-roll', transactionId: 'action' } }
    const before = JSON.stringify(state)
    const result = resolveDnd5eHeadlessAction(state, action)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.state.combatants[actor.id].concentrating).toBe(true)
    expect(result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(1)
    expect(result.state.combatants[actor.id].classState.disadvantageNegationReceipts).toBeUndefined()
    expect(JSON.stringify(state)).toBe(before)
    const unpaid = resolveDnd5eHeadlessAction(state, { ...action, disadvantageNegation: undefined })
    expect(unpaid.ok).toBe(true)
    expect(unpaid.state.combatants[actor.id].concentrating).toBe(false)
    const wrongKind = structuredClone(state)
    wrongKind.combatants[actor.id].classState.disadvantageNegationReceipts!['host-roll'].kind = 'attack'
    expect(resolveDnd5eHeadlessAction(wrongKind, action).ok).toBe(false)
    const next = structuredClone(result.state)
    next.combatants[actor.id].classState.concentrationCheckDisadvantagePendingSourceId = 'enemy'
    expect(resolveDnd5eHeadlessAction(next, action).ok).toBe(false)
  } finally { f.dispose() }
})


it.each([true, false])('offers concentration Luck before dice and stages its cost with the parent: use=%s', async use => {
  const f = fixture()
  try {
    const character = f.data().characters.characters[0]
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    actor.concentrating = true
    actor.classState.concentrationCheckDisadvantagePendingSourceId = 'enemy'
    const state = startDnd5eHeadlessCombat('concentration-ui', [actor, { ...structuredClone(actor), id: 'enemy', controller: 'dm', initiative: -10 }])
    const before = JSON.stringify(state)
    const rollD20 = vi.fn().mockResolvedValueOnce(18).mockResolvedValueOnce(2)
    const choose = vi.fn(async (request: { character: import('../../types/character').Character }) => {
      expect(rollD20).not.toHaveBeenCalled()
      expect(request.character.id).toBe(character.id)
      return use ? f.prompt().payload.featureId : undefined
    })
    const result = await settleDnd5eConcentrationChecks({ result: { ok: true, state,
      events: [{ type: 'concentration-check-required', targetId: actor.id, dc: 10 }] },
      map: { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
        tokens: [{ id: actor.id, label: 'Monk', characterId: character.id, x: 0, y: 0, size: 1, color: '', emoji: '', type: 'player' },
          { id: 'enemy', label: 'Enemy', x: 40, y: 0, size: 1, color: '', emoji: '', type: 'enemy' }] },
      characters: [character], characterIdByCombatantId: { [actor.id]: character.id },
      chooseDisadvantageNegation: choose, rollD20, rollD4: async () => 1, rollDice: async () => [] })
    expect(choose).toHaveBeenCalledTimes(1)
    expect(rollD20).toHaveBeenCalledTimes(use ? 1 : 2)
    expect(result.result.state.combatants[actor.id].concentrating).toBe(use)
    expect(result.result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(use ? 1 : 3)
    expect(JSON.stringify(state)).toBe(before)
    expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled()
  } finally { f.dispose() }
})


it.each([false, true])('isolates a paid spell save from the caster and other targets: multiple=%s', async multi => {
  const f = fixture()
  try {
    f.prompt().payload.disadvantageNegation.kind = 'saving-throw'
    await commitDisadvantageNegation(f.input, f.gateway)
    const character = normalizeCharacter(JSON.parse(JSON.stringify(f.data().characters.characters[0])))
    const target = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 1, position: { x: 4, y: 0 } })
    target.exhaustionLevel = 3
    target.currentHp = target.maxHp = 30
    const source = { ...structuredClone(target), id: 'caster', controller: 'dm' as const, initiative: 100,
      classId: 'wizard' as const, classLevels: { wizard: 3 }, level: 3, exhaustionLevel: 0, position: { x: 0, y: 0 },
      classSelections: { 'spell-cantrips': ['acid-splash'] }, classSelectionsByClass: { wizard: { 'spell-cantrips': ['acid-splash'] } } }
    source.classState.disadvantageNegationReceipts = undefined
    const other = { ...structuredClone(target), id: 'other', initiative: -10, position: { x: 5, y: 0 } }
    other.classState.disadvantageNegationReceipts = undefined
    const state = startDnd5eHeadlessCombat('spell-save-luck', [source, target, other])
    const paid = { rollId: 'host-roll', transactionId: 'action' }
    const action = { type: 'cast-spell' as const, actorId: source.id, targetId: target.id, spellId: 'acid-splash', slotLevel: 0,
      targetIds: multi ? [target.id, other.id] : undefined, effectRolls: multi ? [6] : [],
      savingThrowD20: multi ? undefined : 18, savingThrowD20Second: multi ? undefined : 2,
      savingThrowDisadvantageNegation: multi ? undefined : paid,
      targetSavingThrows: multi ? [{ targetId: target.id, d20: 18, d20Second: 2, disadvantageNegation: paid },
        { targetId: other.id, d20: 18, d20Second: 2 }] : undefined }
    const result = resolveDnd5eHeadlessAction(state, action)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.state.combatants[target.id].currentHp).toBe(30)
    expect(result.state.combatants[other.id].currentHp).toBe(multi ? 24 : 30)
    expect(result.state.combatants[target.id].classResources['dnd5e-ki'].current).toBe(1)
    expect(result.state.combatants[target.id].classState.disadvantageNegationReceipts).toBeUndefined()
    const saves = result.events.filter(event => event.type === 'saving-throw-resolved')
    expect(saves.map(event => event.d20)).toEqual(multi ? [18, 2] : [18])
    if (multi) expect(resolveDnd5eHeadlessAction(state, { ...action, targetSavingThrows: [
      { targetId: target.id, d20: 18, d20Second: 2 }, { targetId: other.id, d20: 18, d20Second: 2, disadvantageNegation: paid },
    ] }).ok).toBe(false)
  } finally { f.dispose() }
})


it.each(['death-save', 'death-save-turn'] as const)('cancels death-save disadvantage once through %s and preserves natural 20', async type => {
  const f = fixture()
  try {
    f.prompt().payload.disadvantageNegation.kind = 'saving-throw'
    await commitDisadvantageNegation(f.input, f.gateway)
    const character = normalizeCharacter(JSON.parse(JSON.stringify(f.data().characters.characters[0])))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    actor.currentHp = 0
    actor.exhaustionLevel = 3
    const enemy = { ...structuredClone(actor), id: 'enemy', currentHp: 10, exhaustionLevel: 0, controller: 'dm' as const, initiative: -10 }
    const state = startDnd5eHeadlessCombat('death-luck', [actor, enemy])
    const before = JSON.stringify(state)
    const action = { type, actorId: actor.id, d20: 18, d20Second: 1, deferNextTurnStart: true,
      disadvantageNegation: { rollId: 'host-roll', transactionId: 'action' } }
    const result = resolveDnd5eHeadlessAction(state, action)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.state.combatants[actor.id].deathSaves).toMatchObject({ successes: 1, failures: 0 })
    expect(result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(1)
    expect(result.state.combatants[actor.id].classState.disadvantageNegationReceipts).toBeUndefined()
    expect(JSON.stringify(state)).toBe(before)
    const unpaid = resolveDnd5eHeadlessAction(state, { ...action, disadvantageNegation: undefined })
    expect(unpaid.ok).toBe(true)
    expect(unpaid.state.combatants[actor.id].deathSaves.failures).toBe(2)
    const recovered = resolveDnd5eHeadlessAction(state, { ...action, d20: 20 })
    expect(recovered.ok).toBe(true)
    expect(recovered.state.combatants[actor.id].currentHp).toBe(1)
    expect(resolveDnd5eHeadlessAction(result.state, action).ok).toBe(false)
  } finally { f.dispose() }
})


it('binds a repeat-save payment to the exact persistent effect, not the adjacent save', async () => {
  const f = fixture()
  try {
    const effects = ['first', 'second'].map(id => createDnd5eMechanicalEffect({ id, definitionId: id, label: id, targetId: 'hero',
      source: { kind: 'spell', actorId: 'enemy' }, duration: { type: 'permanent' },
      repeatSave: { ability: 'wis', dc: 10, timing: 'target-turn-end', onSuccess: 'remove', disadvantage: true } }))
    f.prompt().payload.disadvantageNegation.kind = 'saving-throw'
    f.prompt().payload.disadvantageNegation.contextId = effects[0].id
    await commitDisadvantageNegation(f.input, f.gateway)
    const character = normalizeCharacter(JSON.parse(JSON.stringify(f.data().characters.characters[0])))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    const state = startDnd5eHeadlessCombat('repeat-luck', [actor, { ...structuredClone(actor), id: 'enemy', controller: 'dm', initiative: -10 }])
    state.combatants[actor.id].classState.activeEffects = effects
    const paid = { rollId: 'host-roll', transactionId: 'action' }
    const action = { type: 'end-turn' as const, actorId: actor.id, deferNextTurnStart: true,
      activeEffectSavingThrows: effects.map((effect, index) => ({ effectId: effect.id, targetId: actor.id,
        d20: 18, d20Second: 2, disadvantageNegation: index === 0 ? paid : undefined })) }
    const result = resolveDnd5eHeadlessAction(state, action)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.state.combatants[actor.id].classState.activeEffects?.map(effect => effect.id)).toEqual([effects[1].id])
    expect(result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(1)
    expect(result.state.combatants[actor.id].classState.disadvantageNegationReceipts).toBeUndefined()
    expect(result.events.filter(event => event.type === 'saving-throw-resolved').map(event => [event.d20, event.rollMode])).toEqual([[18, 'normal'], [2, 'disadvantage']])
    const wrong = { ...action, activeEffectSavingThrows: effects.map((effect, index) => ({ effectId: effect.id, targetId: actor.id,
      d20: 18, d20Second: 2, disadvantageNegation: index === 1 ? paid : undefined })) }
    expect(resolveDnd5eHeadlessAction(state, wrong).ok).toBe(false)
    expect(state.combatants[actor.id].classState.activeEffects).toHaveLength(2)
  } finally { f.dispose() }
})


it.each(['target-turn-start', 'target-turn-end'] as const)('reconstructs a deferred %s choice and charges only inside the boundary transaction', timing => {
  const f = fixture()
  try {
    const character = normalizeCharacter(JSON.parse(JSON.stringify(f.data().characters.characters[0])))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    const state = startDnd5eHeadlessCombat('deferred-repeat', [actor, { ...structuredClone(actor), id: 'enemy', controller: 'dm', initiative: -10 }])
    const effect = createDnd5eMechanicalEffect({ id: 'repeat', definitionId: 'repeat', label: 'Repeat', targetId: actor.id,
      source: { kind: 'spell' }, duration: { type: 'permanent' },
      repeatSave: { ability: 'wis', dc: 10, timing, onSuccess: 'remove', disadvantage: true } })
    state.combatants[actor.id].classState.activeEffects = [effect]
    const rolls = [{ effectId: effect.id, targetId: actor.id, d20: 18,
      disadvantageNegationChoice: { featureId: f.prompt().payload.featureId, rollId: 'deferred-save', transactionId: 'boundary', contextId: effect.id } }]
    const action = timing === 'target-turn-start'
      ? { type: 'begin-turn' as const, actorId: actor.id, turnStartActiveEffectSavingThrows: rolls }
      : { type: 'end-turn' as const, actorId: actor.id, deferNextTurnStart: true, activeEffectSavingThrows: rolls }
    const result = resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(state)), JSON.parse(JSON.stringify(action)))
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(1)
    expect(result.state.combatants[actor.id].classState.activeEffects ?? []).toHaveLength(0)
    expect(result.state.combatants[actor.id].classState.disadvantageNegationReceipts).toBeUndefined()
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'saving-throw-resolved', d20: 18, rollMode: 'normal' }))
    expect(state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(3)
    const wrongEffect = structuredClone(action)
    const wrongRolls = wrongEffect.type === 'begin-turn' ? wrongEffect.turnStartActiveEffectSavingThrows : wrongEffect.activeEffectSavingThrows
    wrongRolls[0].disadvantageNegationChoice.contextId = 'another-effect'
    expect(resolveDnd5eHeadlessAction(state, wrongEffect).ok).toBe(false)
    const poor = structuredClone(state)
    poor.combatants[actor.id].classResources['dnd5e-ki'].current = 1
    expect(resolveDnd5eHeadlessAction(poor, action).ok).toBe(false)
    expect(poor.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(1)
    const unowned = structuredClone(state)
    unowned.combatants[actor.id].pluginFeatureIds = []
    expect(resolveDnd5eHeadlessAction(unowned, action).ok).toBe(false)
    expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled()
  } finally { f.dispose() }
})


it('rebuilds the real begin-turn map facade and projects the deferred debit into exported characters', () => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    character.currentHp = character.maxHp = 20
    const effect = createDnd5eMechanicalEffect({ id: 'map-repeat', definitionId: 'map-repeat', label: 'Repeat', targetId: 'hero-token',
      source: { kind: 'spell' }, duration: { type: 'permanent' },
      repeatSave: { ability: 'wis', dc: 10, timing: 'target-turn-start', onSuccess: 'remove', disadvantage: true } })
    character.dnd5eCombatState = { ...character.dnd5eCombatState, activeEffects: [effect] }
    const map: BattleMap = { id: 'map', name: 'Map', width: 200, height: 200, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0,
      feetPerCell: 5, showGrid: true, tokens: [
        { id: 'hero-token', label: 'Hero', x: 0, y: 0, color: '', emoji: '', size: 1, type: 'player', characterId: character.id, hp: 20, maxHp: 20 },
        { id: 'enemy', label: 'Goblin', x: 50, y: 0, color: '', emoji: '', size: 1, type: 'enemy', poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7 },
      ] }
    const input = { combatId: 'map-deferred', round: 1, initiativeIndex: 0, map, characters: [character],
      initiativeOrder: map.tokens.map((token, i) => ({ slotId: `${token.id}:normal`, tokenId: token.id, label: token.label, emoji: '', color: '', roll: 20 - i * 10 })) }
    const prepared = prepareDnd5eBeginTurn(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.turnStartActiveEffectSavingThrows).toHaveLength(1)
    expect(prepared.prepared.turnStartActiveEffectSavingThrows[0].mode).toBe('disadvantage')
    const resolved = resolveDnd5eBeginTurn({ ...JSON.parse(JSON.stringify(input)), turnStartActiveEffectSavingThrows: [
      { effectId: effect.id, targetId: 'hero-token', d20: 18, disadvantageNegationChoice: {
        featureId: f.prompt().payload.featureId, rollId: 'map-begin', transactionId: 'begin-map', contextId: effect.id,
      } },
    ] })
    expect(resolved.ok, JSON.stringify(resolved)).toBe(true)
    if (!resolved.ok) return
    expect(resolved.application.characters.find(row => row.id === character.id)?.classResources?.['dnd5e-ki'].current).toBe(1)
    expect(resolved.result.state.combatants['hero-token'].classState.activeEffects ?? []).toHaveLength(0)
    expect(character.classResources?.['dnd5e-ki'].current).toBe(3)
    expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled()
  } finally { f.dispose() }
})

it('reserves prior choices without charging and hides an unaffordable next choice', () => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const featureId = f.prompt().payload.featureId
    const reservedResources = dnd5ePendingNegationReservations(character, [{ featureId }])
    expect(reservedResources).toEqual([{ resourceKey: 'dnd5e-ki', amount: 2 }])
    const roll = { rollId: 'next-save', characterId: character.id, kind: 'saving-throw' as const,
      mode: 'disadvantage' as const, phase: 'before-roll' as const, reservedResources }
    expect(dnd5eDisadvantageNegationOptions(character, roll)).toHaveLength(0)
    expect(character.classResources?.['dnd5e-ki'].current).toBe(3)
    character.classResources!['dnd5e-ki'].current = 4
    expect(dnd5eDisadvantageNegationOptions(character, roll)).toHaveLength(1)
    expect(dnd5ePendingNegationReservations(character, [{ featureId }, { featureId }])).toEqual([{ resourceKey: 'dnd5e-ki', amount: 4 }])
  } finally { f.dispose() }
})


it('settles an attack ward choice before attack economy, charging once and recording success', () => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    actor.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'save-penalty', definitionId: 'save-penalty', label: 'Penalty',
      targetId: actor.id, source: { kind: 'spell' }, duration: { type: 'permanent' }, modifiers: { savingThrowDisadvantages: ['wis'] } })]
    const target = { ...structuredClone(actor), id: 'enemy', controller: 'dm' as const, initiative: -10 }
    const ward = createDnd5eMechanicalEffect({ id: 'ward', definitionId: 'ward', label: 'Ward', targetId: target.id,
      source: { kind: 'plugin', actorId: target.id }, duration: { type: 'permanent' },
      attackAttemptWard: { ability: 'wis', dc: 10, frequency: 'once-per-turn', onFailure: 'cannot-target-this-turn', onSuccess: 'source-next-turn-spell-save-disadvantage' } })
    target.classState.activeEffects = [ward]
    const state = startDnd5eHeadlessCombat('ward-luck', [actor, target])
    const action = { type: 'attack-ward-attempt' as const, actorId: actor.id, targetId: target.id, turnKey: dnd5eHeadlessTurnKey(state, actor.id),
      saves: [{ effectId: ward.id, targetId: actor.id, d20: 18, d20Second: 2,
        disadvantageNegationChoice: { featureId: f.prompt().payload.featureId, rollId: 'ward-roll', transactionId: 'ward-action', contextId: ward.id } }] }
    const result = resolveDnd5eHeadlessAction(state, JSON.parse(JSON.stringify(action)))
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(1)
    expect(result.state.combatants[target.id].classState.activeEffects?.[0].attackAttemptWardReceipts?.[0].success).toBe(true)
    expect(result.state.combatants[actor.id].turn.actionAvailable).toBe(true)
    expect(result.state.combatants[actor.id].classState.disadvantageNegationReceipts).toBeUndefined()
    expect(state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(3)
    expect(resolveDnd5eHeadlessAction(result.state, action).ok).toBe(false)
    const declined = resolveDnd5eHeadlessAction(state, { ...action, saves: [{ ...action.saves[0], disadvantageNegationChoice: undefined }] })
    expect(declined.ok).toBe(true)
    expect(declined.state.combatants[target.id].classState.activeEffects?.[0].attackAttemptWardReceipts?.[0].success).toBe(false)
    expect(declined.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(3)
  } finally { f.dispose() }
})


it.each([false, true].flatMap(use => (['native', 'activity'] as const).map(path => ({ use, path }))))('settles a $path casting gate with disadvantage negation=$use without charging previews', ({ use, path }) => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    actor.classId = 'wizard'; actor.level = 14; actor.classLevels = { monk: 11, wizard: 3 }
    actor.classSelections = { ...actor.classSelections, 'spell-prepared': ['magic-missile'] }
    actor.classResources['dnd5e-spell-slot-1'] = { current: 1, max: 1 }
    const effect = createDnd5eMechanicalEffect({ id: 'casting-gate', definitionId: 'casting-gate', label: 'Gate', targetId: actor.id,
      source: { kind: 'spell' }, duration: { type: 'permanent' }, spellcastingSave: { ability: 'con', dc: 10 },
      modifiers: { savingThrowDisadvantages: ['con'] } })
    actor.classState.activeEffects = [effect]
    const enemy = { ...structuredClone(actor), id: 'enemy', controller: 'dm' as const, initiative: -10, currentHp: 30, maxHp: 30, classState: { schemaVersion: 2 as const } }
    const state = startDnd5eHeadlessCombat('casting-luck', [actor, enemy])
    const rolls = [{ effectId: effect.id, targetId: actor.id, d20: 18, d20Second: use ? undefined : 2,
      disadvantageNegationChoice: use ? { featureId: f.prompt().payload.featureId, rollId: 'casting-roll', transactionId: 'casting-action', contextId: effect.id } : undefined }]
    const before = JSON.stringify(state)
    expect(previewDnd5eSpellcastingSaves(state, actor.id, rolls)).toBe(use)
    expect(previewDnd5eSpellcastingSaves(state, actor.id, rolls)).toBe(use)
    expect(JSON.stringify(state)).toBe(before)
    const action = { type: 'cast-spell' as const, actorId: actor.id, targetId: enemy.id, targetIds: [enemy.id],
      projectileTargetIds: [enemy.id, enemy.id, enemy.id], spellId: 'magic-missile', slotLevel: 1,
      effectRolls: [4, 3, 2], spellcastingSavingThrows: rolls }
    const result = path === 'native'
      ? resolveDnd5eHeadlessAction(state, JSON.parse(JSON.stringify(action)))
      : commitDnd5eActivityExecution(state, { actorId: actor.id, activityId: 'local.test:spell', castLevel: 1,
        targetIds: [enemy.id], source: { kind: 'spell', id: 'local.test:spell', packageId: 'local.test' },
        spellcastingSavingThrows: JSON.parse(JSON.stringify(rolls)), resolution: { ok: true, status: 'resolved', checks: [],
          consumptions: [{ kind: 'spell-slot', minimumLevel: 1, level: 'selected', amount: 1, consumeOn: 'resolve' },
            { kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
          proposals: [{ kind: 'adjust-exhaustion', operationId: 'fatigue', targetId: enemy.id, amount: 1 }] } })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(use ? 1 : 3)
    expect(result.state.combatants[actor.id].classResources['dnd5e-spell-slot-1'].current).toBe(0)
    expect(result.state.combatants[actor.id].turn.actionAvailable).toBe(false)
    expect(result.state.combatants[enemy.id].currentHp).toBe(path === 'native' && use ? 18 : 30)
    if (path === 'activity') expect(result.state.combatants[enemy.id].exhaustionLevel).toBe(use ? 1 : 0)
    expect(result.state.combatants[actor.id].classState.disadvantageNegationReceipts).toBeUndefined()
    expect(JSON.stringify(state)).toBe(before)
    if (use) {
      const wrong = structuredClone(action)
      wrong.spellcastingSavingThrows[0].disadvantageNegationChoice!.contextId = 'other-gate'
      expect(resolveDnd5eHeadlessAction(state, wrong).ok).toBe(false)
    }
  } finally { f.dispose() }
})


it.each([false, true])('settles a persistent area save with negation=%s and rejects another area context', use => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    actor.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'penalty', definitionId: 'penalty', label: 'Penalty', targetId: actor.id,
      source: { kind: 'spell' }, duration: { type: 'permanent' }, modifiers: { savingThrowDisadvantages: ['dex'] } })]
    const enemy = { ...structuredClone(actor), id: 'enemy', controller: 'dm' as const, initiative: -10 }
    const state = startDnd5eHeadlessCombat('area-luck', [actor, enemy])
    const input = { areaId: 'field', sourceId: enemy.id, targetId: actor.id,
      trigger: { id: 'save', label: 'Save', timing: 'on-create' as const, oncePerTurn: false,
        savingThrow: { ability: 'dex' as const, dc: 10, onSuccess: 'none' as const } },
      d20: 18, d20Second: use ? undefined : 2,
      disadvantageNegationChoice: use ? { featureId: f.prompt().payload.featureId, rollId: 'area-roll', transactionId: 'area-trigger', contextId: JSON.stringify(['field', 'save']) } : undefined }
    const before = JSON.stringify(state)
    const result = resolveDnd5ePersistentAreaTrigger(state, JSON.parse(JSON.stringify(input)))
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'saving-throw-resolved', targetId: actor.id, d20: use ? 18 : 2, success: use }))
    expect(result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(use ? 1 : 3)
    expect(result.state.combatants[actor.id].classState.disadvantageNegationReceipts).toBeUndefined()
    expect(JSON.stringify(state)).toBe(before)
    if (use) {
      expect(resolveDnd5ePersistentAreaTrigger(state, { ...input, areaId: 'other' }).ok).toBe(false)
      expect(resolveDnd5ePersistentAreaTrigger(state, { ...input, trigger: { ...input.trigger, id: 'other-trigger' } }).ok).toBe(false)
      expect(resolveDnd5ePersistentAreaTrigger(state, { ...input, willingFailure: true,
        trigger: { ...input.trigger, savingThrow: { ...input.trigger.savingThrow, allowWillingFailure: true } } }).ok).toBe(false)
    }
  } finally { f.dispose() }
})


it.each([false, true])('keeps primary and secondary area negation separate with primary use=%s', primaryUse => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    character.classResources!['dnd5e-ki'].current = 5
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    actor.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'penalty', definitionId: 'penalty', label: 'Penalty', targetId: actor.id,
      source: { kind: 'spell' }, duration: { type: 'permanent' }, modifiers: { savingThrowDisadvantages: ['dex', 'str'] } })]
    const enemy = { ...structuredClone(actor), id: 'enemy', controller: 'dm' as const, initiative: -10 }
    const state = startDnd5eHeadlessCombat('secondary-area-luck', [actor, enemy])
    const choose = (phase: 'primary' | 'condition') => ({ featureId: f.prompt().payload.featureId, rollId: `area-${phase}`,
      transactionId: `trigger-${phase}`, contextId: JSON.stringify(phase === 'condition' ? ['field', 'save', 'condition'] : ['field', 'save']) })
    const input = { areaId: 'field', sourceId: enemy.id, targetId: actor.id,
      trigger: { id: 'save', label: 'Save', timing: 'on-create' as const, oncePerTurn: false,
        savingThrow: { ability: 'dex' as const, dc: 20, onSuccess: 'none' as const },
        conditionSavingThrow: { ability: 'str' as const, dc: 10, onSuccess: 'none' as const },
        condition: { condition: 'restrained' as const, duration: { expiresAt: 'permanent' as const }, endsWithArea: true } },
      d20: 18, d20Second: primaryUse ? undefined : 2,
      disadvantageNegationChoice: primaryUse ? choose('primary') : undefined,
      conditionSave: { d20: 18, disadvantageNegationChoice: choose('condition') } }
    const before = JSON.stringify(state)
    const result = resolveDnd5ePersistentAreaTrigger(state, JSON.parse(JSON.stringify(input)))
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.events.filter(event => event.type === 'saving-throw-resolved').map(event => [event.d20, event.success])).toEqual([[primaryUse ? 18 : 2, false], [18, true]])
    expect(result.state.combatants[actor.id].conditions).not.toContain('restrained')
    expect(result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(primaryUse ? 1 : 3)
    expect(result.state.combatants[actor.id].classState.disadvantageNegationReceipts).toBeUndefined()
    expect(JSON.stringify(state)).toBe(before)
    expect(resolveDnd5ePersistentAreaTrigger(state, { ...input, conditionSave: { d20: 18, disadvantageNegationChoice: choose('primary') } }).ok).toBe(false)
    const poor = structuredClone(state)
    poor.combatants[actor.id].classResources['dnd5e-ki'].current = primaryUse ? 3 : 1
    const rejected = resolveDnd5ePersistentAreaTrigger(poor, input)
    expect(rejected.ok).toBe(false)
    expect(rejected.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(primaryUse ? 3 : 1)
  } finally { f.dispose() }
})


it.each(['saving-throw-condition', 'saving-throw-damage-and-max-hp-reduction'] as const)('settles monster %s with a target-owned Luck choice', kind => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const target = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 10, position: { x: 0, y: 0 } })
    target.currentHp = target.maxHp = 200
    const monster = DND5E_SRD_MONSTERS.find(row => row.slug === 'succubus-incubus')!
    const definition = monster.actions.find(row => row.rule?.kind === kind)!
    expect(definition).toBeDefined()
    const rule = definition.rule!
    if (rule.kind !== 'saving-throw-condition' && rule.kind !== 'saving-throw-damage-and-max-hp-reduction') throw Error('fixture')
    target.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'penalty', definitionId: 'penalty', label: 'Penalty', targetId: target.id,
      source: { kind: 'spell' }, duration: { type: 'permanent' }, modifiers: { savingThrowDisadvantages: [rule.ability] } })]
    const enemy = { ...structuredClone(target), id: 'enemy', controller: 'dm' as const, initiative: 30, statBlockId: monster.id }
    const state = startDnd5eHeadlessCombat('monster-luck', [enemy, target])
    state.distanceFeetByCombatantPair = { ['enemy\u0000hero']: 5 }
    const action = { type: 'monster-special-action' as const, actorId: enemy.id, targetId: target.id, actionId: definition.id,
      ...(rule.kind === 'saving-throw-damage-and-max-hp-reduction' ? { targetWilling: true, damageRolls: Array(rule.damage.count).fill(1) } : {}),
      d20: 20, disadvantageNegationChoice: { featureId: f.prompt().payload.featureId, rollId: 'monster-save', transactionId: 'monster-action',
        contextId: JSON.stringify([enemy.id, definition.id, target.id]) } }
    const before = JSON.stringify(state)
    const result = resolveDnd5eHeadlessAction(state, action)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'saving-throw-resolved', targetId: target.id, d20: 20, success: true }))
    expect(result.state.combatants[target.id].classResources['dnd5e-ki'].current).toBe(1)
    expect(result.state.combatants[enemy.id].classResources['dnd5e-ki'].current).toBe(3)
    expect(result.state.combatants[target.id].classState.disadvantageNegationReceipts).toBeUndefined()
    const declined = resolveDnd5eHeadlessAction(state, { ...action, disadvantageNegationChoice: undefined, d20Second: 1 })
    expect(declined.ok, JSON.stringify(declined)).toBe(true)
    expect(declined.events).toContainEqual(expect.objectContaining({ type: 'saving-throw-resolved', targetId: target.id, d20: 1, success: false }))
    expect(declined.state.combatants[target.id].classResources['dnd5e-ki'].current).toBe(3)
    if (rule.kind === 'saving-throw-condition') {
      expect(result.state.combatants[target.id].conditions).not.toContain(rule.condition)
      expect(declined.state.combatants[target.id].conditions).toContain(rule.condition)
    } else expect(result.state.combatants[target.id].maxHp).toBeGreaterThan(declined.state.combatants[target.id].maxHp)
    expect(resolveDnd5eHeadlessAction(state, { ...action, disadvantageNegationChoice: { ...action.disadvantageNegationChoice, contextId: 'wrong' } }).ok).toBe(false)
    expect(JSON.stringify(state)).toBe(before)
  } finally { f.dispose() }
})


it.each(['wing', 'breath'] as const)('keeps per-target Luck isolated for monster %s', kind => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const target = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    target.currentHp = target.maxHp = 200
    target.savingThrowBonuses.dex = 5
    target.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'penalty', definitionId: 'penalty', label: 'Penalty', targetId: target.id,
      source: { kind: 'spell' }, duration: { type: 'permanent' }, modifiers: { savingThrowDisadvantages: ['dex'] } })]
    const other = { ...structuredClone(target), id: 'other', initiative: 20 }
    const monster = DND5E_SRD_MONSTERS.find(row => row.slug === (kind === 'wing' ? 'adult-red-dragon' : 'red-dragon-wyrmling'))!
    const definition = kind === 'wing' ? monster.legendaryActions!.find(row => row.rule?.kind === 'legendary-wing-attack')!
      : monster.actions.find(row => row.id === 'fire-breath')!
    const damage = kind === 'wing' && definition.rule?.kind === 'legendary-wing-attack' ? definition.rule.damage
      : dnd5eMonsterAreaSavingThrowEffect(definition)!.damage!
    const enemy = { ...structuredClone(target), id: 'enemy', controller: 'dm' as const, initiative: kind === 'wing' ? 10 : 40,
      statBlockId: monster.id, movementSpeeds: monster.speed }
    enemy.classState.monsterLegendaryActionPoints = 3
    enemy.classState.monsterRechargeReadyByActionId = { [definition.id]: true }
    const state = startDnd5eHeadlessCombat('multi-luck', [target, other, enemy])
    state.distanceFeetByCombatantPair = { ['enemy\u0000hero']: 5, ['enemy\u0000other']: 5 }
    const saves = [{ targetId: target.id, d20: 20, disadvantageNegationChoice: { featureId: f.prompt().payload.featureId,
      rollId: 'multi-save', transactionId: 'multi-action', contextId: JSON.stringify(kind === 'wing'
        ? [enemy.id, definition.id, target.id] : [enemy.id, definition.id, '', target.id, 0]) } },
      { targetId: other.id, d20: 20, d20Second: 1 }]
    const action = kind === 'wing'
      ? { type: 'monster-adjudicated-action' as const, actorId: enemy.id, actionId: definition.id, legendary: true, effects: [],
          damageRolls: Array(damage.count).fill(1), targetSavingThrows: saves }
      : { type: 'monster-area-action' as const, actorId: enemy.id, actionId: definition.id,
          resolution: { schemaVersion: 1 as const, targetIds: [target.id, other.id], targetSavingThrows: saves, damageRolls: Array(damage.count).fill(1) } }
    const before = JSON.stringify(state)
    const result = resolveDnd5eHeadlessAction(state, action)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.state.combatants[target.id].classResources['dnd5e-ki'].current).toBe(1)
    expect(result.state.combatants[other.id].classResources['dnd5e-ki'].current).toBe(3)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'saving-throw-resolved', targetId: target.id, d20: 20, success: true }))
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'saving-throw-resolved', targetId: other.id, d20: 1, success: false }))
    expect(result.state.combatants[target.id].currentHp).toBeGreaterThan(result.state.combatants[other.id].currentHp)
    expect(result.state.combatants[target.id].classState.disadvantageNegationReceipts).toBeUndefined()
    expect(JSON.stringify(state)).toBe(before)
  } finally { f.dispose() }
})


it.each([false, true])('preserves a monster hit while resolving attached poison with Luck=%s', use => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const target = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 10, position: { x: 5, y: 0 } })
    target.currentHp = target.maxHp = 200
    target.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'penalty', definitionId: 'penalty', label: 'Penalty', targetId: target.id,
      source: { kind: 'spell' }, duration: { type: 'permanent' }, modifiers: { savingThrowDisadvantages: ['con'] } })]
    const monster = DND5E_SRD_MONSTERS.find(row => row.slug === 'spider')!
    const definition = monster.actions.find(row => row.id === 'bite')!
    const effect = definition.attack!.onHitEffects!.find(row => row.kind === 'saving-throw-damage')!
    if (effect.kind !== 'saving-throw-damage') throw Error('fixture')
    const enemy = { ...structuredClone(target), id: 'enemy', controller: 'dm' as const, initiative: 30, statBlockId: monster.id, position: { x: 0, y: 0 } }
    const state = startDnd5eHeadlessCombat('on-hit-luck', [enemy, target])
    state.distanceFeetByCombatantPair = { ['enemy\u0000hero']: 5 }
    const action = { type: 'monster-action' as const, actorId: enemy.id, actionId: definition.id,
      rolls: [{ targetId: target.id, d20: 19, damageRolls: definition.attack!.damage.map(damage => Array(damage.count).fill(1)),
        onHitEffectRolls: [{ effectId: effect.id, d20: 20, d20Second: use ? undefined : 1,
          damageRolls: effect.damage.map(damage => Array(damage.count).fill(damage.sides)),
          disadvantageNegationChoice: use ? { featureId: f.prompt().payload.featureId, rollId: 'poison-save', transactionId: 'bite-action',
            contextId: JSON.stringify([enemy.id, definition.id, target.id, effect.id]) } : undefined }] }] }
    const before = JSON.stringify(state)
    const result = resolveDnd5eHeadlessAction(state, action)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.state.combatants[target.id].classResources['dnd5e-ki'].current).toBe(use ? 1 : 3)
    expect(result.state.combatants[target.id].currentHp).toBe(use ? 199 : 195)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'saving-throw-resolved', targetId: target.id, d20: use ? 20 : 1, success: use }))
    expect(result.state.combatants[enemy.id].turn.actionAvailable).toBe(false)
    expect(result.state.combatants[target.id].classState.disadvantageNegationReceipts).toBeUndefined()
    expect(JSON.stringify(state)).toBe(before)
    if (use) {
      const wrong = structuredClone(action)
      wrong.rolls[0].onHitEffectRolls[0].disadvantageNegationChoice!.contextId = 'wrong-hit'
      expect(resolveDnd5eHeadlessAction(state, wrong).ok).toBe(false)
    }
  } finally { f.dispose() }
})


it('uses on-hit Luck to resist charge displacement while retaining charge damage', () => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const target = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 10, position: { x: 15, y: 0 } })
    target.currentHp = target.maxHp = 200
    target.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'penalty', definitionId: 'penalty', label: 'Penalty', targetId: target.id,
      source: { kind: 'spell' }, duration: { type: 'permanent' }, modifiers: { savingThrowDisadvantages: ['str'] } })]
    const monster = DND5E_SRD_MONSTERS.find(row => row.slug === 'minotaur')!
    const definition = monster.actions.find(row => row.id === 'gore')!
    const enemy = { ...structuredClone(target), id: 'enemy', controller: 'dm' as const, initiative: 30, statBlockId: monster.id, position: { x: 0, y: 0 } }
    const state = startDnd5eHeadlessCombat('charge-luck', [enemy, target])
    const moved = resolveDnd5eHeadlessAction(state, { type: 'move', actorId: enemy.id, to: { x: 10, y: 0 }, distance: 10 })
    expect(moved.ok).toBe(true)
    moved.state.distanceFeetByCombatantPair = { ['enemy\u0000hero']: 5 }
    const before = JSON.stringify(moved.state)
    const resolve = (use: boolean) => resolveDnd5eHeadlessAction(moved.state, { type: 'monster-action', actorId: enemy.id, actionId: definition.id,
      rolls: [{ targetId: target.id, d20: 19, damageRolls: definition.attack!.damage.map(damage => Array(damage.count).fill(1)),
        traitDamageRolls: [{ traitId: 'charge-damage', rolls: [4, 5] }],
        onHitEffectRolls: [{ effectId: 'charge:gore:forced-movement', d20: 20, d20Second: use ? undefined : 1,
          forcedMovement: { targetId: target.id, to: { x: use ? 15 : 25, y: 0 }, distanceFeet: use ? 0 : 10 },
          disadvantageNegationChoice: use ? { featureId: f.prompt().payload.featureId, rollId: 'charge-save', transactionId: 'charge-action',
            contextId: JSON.stringify([enemy.id, definition.id, target.id, 'charge:gore:forced-movement']) } : undefined }] }] })
    const used = resolve(true), declined = resolve(false)
    expect(used.ok, JSON.stringify(used)).toBe(true)
    expect(declined.ok, JSON.stringify(declined)).toBe(true)
    expect(used.state.combatants[target.id].position.x).toBe(15)
    expect(declined.state.combatants[target.id].position.x).toBe(25)
    expect(used.state.combatants[target.id].conditions).not.toContain('prone')
    expect(declined.state.combatants[target.id].conditions).toContain('prone')
    expect(used.state.combatants[target.id].currentHp).toBe(declined.state.combatants[target.id].currentHp)
    expect(used.state.combatants[target.id].currentHp).toBeLessThan(200)
    expect(used.state.combatants[target.id].classResources['dnd5e-ki'].current).toBe(1)
    expect(declined.state.combatants[target.id].classResources['dnd5e-ki'].current).toBe(3)
    expect(JSON.stringify(moved.state)).toBe(before)
  } finally { f.dispose() }
})


it('negates disadvantage for an imported source-linked save without leaving a grapple relation on success', () => {
  const f = fixture()
  try {
    // Synthetic imported mechanic: preserve the published catalog, add a save to a separate test monster.
    const source = DND5E_SRD_MONSTERS.find(row => row.slug === 'ankheg')!
    const monster = structuredClone(source)
    monster.id = 'test:linked-luck'; monster.slug = 'test-linked-luck'
    const definition = monster.actions.find(row => row.id === 'bite')!
    const effect = definition.attack!.onHitEffects!.find(row => row.kind === 'source-linked-condition')!
    if (effect.kind !== 'source-linked-condition') throw Error('fixture')
    effect.savingThrow = { ability: 'str', dc: 10 }
    setDnd5eRoomMonsterCatalog([monster])
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const target = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 10, position: { x: 5, y: 0 } })
    target.currentHp = target.maxHp = 200
    target.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'penalty', definitionId: 'penalty', label: 'Penalty', targetId: target.id,
      source: { kind: 'spell' }, duration: { type: 'permanent' }, modifiers: { savingThrowDisadvantages: ['str'] } })]
    const enemy = { ...structuredClone(target), id: 'enemy', controller: 'dm' as const, initiative: 30, statBlockId: monster.id, position: { x: 0, y: 0 } }
    const state = startDnd5eHeadlessCombat('linked-luck', [enemy, target])
    state.distanceFeetByCombatantPair = { ['enemy\u0000hero']: 5 }
    const resolve = (use: boolean) => resolveDnd5eHeadlessAction(state, { type: 'monster-action', actorId: enemy.id, actionId: definition.id,
      rolls: [{ targetId: target.id, d20: 19, damageRolls: definition.attack!.damage.map(damage => Array(damage.count).fill(1)),
        onHitEffectRolls: [{ effectId: effect.id, d20: 20, d20Second: use ? undefined : 1,
          disadvantageNegationChoice: use ? { featureId: f.prompt().payload.featureId, rollId: 'linked-save', transactionId: 'linked-action',
            contextId: JSON.stringify([enemy.id, definition.id, target.id, effect.id]) } : undefined }] }] })
    const before = JSON.stringify(state)
    const used = resolve(true), declined = resolve(false)
    expect(used.ok, JSON.stringify(used)).toBe(true)
    expect(declined.ok, JSON.stringify(declined)).toBe(true)
    expect(used.state.combatants[target.id].conditions).not.toContain('grappled')
    expect(declined.state.combatants[target.id].conditions).toContain('grappled')
    expect(used.state.combatants[target.id].classState.activeEffects?.some(row => row.source.actorId === enemy.id)).toBe(false)
    expect(declined.state.combatants[target.id].classState.activeEffects?.some(row => row.source.actorId === enemy.id)).toBe(true)
    expect(used.state.combatants[target.id].currentHp).toBe(declined.state.combatants[target.id].currentHp)
    expect(used.state.combatants[target.id].classResources['dnd5e-ki'].current).toBe(1)
    expect(declined.state.combatants[target.id].classResources['dnd5e-ki'].current).toBe(3)
    expect(JSON.stringify(state)).toBe(before)
  } finally { setDnd5eRoomMonsterCatalog([]); f.dispose() }
})


it.each(['source', 'target', 'neither'] as const)('settles on-hit opposed Luck for %s with independent costs', side => {
  const f = fixture()
  try {
    const monster = structuredClone(DND5E_SRD_MONSTERS.find(row => row.slug === 'ankheg')!)
    monster.id = 'test:contest-luck'; monster.slug = 'test-contest-luck'
    const definition = monster.actions.find(row => row.id === 'bite')!
    definition.attack!.onHitEffects = [{ id: 'contest-push', kind: 'forced-movement',
      resistance: { kind: 'opposed-ability-check', sourceAbility: 'str', targetAbility: 'str' },
      direction: 'away-from-source', maximumDistanceFeet: 10 }]
    setDnd5eRoomMonsterCatalog([monster])
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const target = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 10, position: { x: 5, y: 0 } })
    target.currentHp = target.maxHp = 200
    target.abilities.str = 10
    target.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'penalty', definitionId: 'penalty', label: 'Penalty', targetId: target.id,
      source: { kind: 'spell' }, duration: { type: 'permanent' }, modifiers: { abilityCheckDisadvantages: ['str'] } })]
    const enemy = { ...structuredClone(target), id: 'enemy', controller: 'dm' as const, initiative: 30, statBlockId: monster.id, position: { x: 0, y: 0 } }
    const state = startDnd5eHeadlessCombat('contest-luck', [enemy, target])
    state.distanceFeetByCombatantPair = { ['enemy\u0000hero']: 5 }
    const choice = { featureId: f.prompt().payload.featureId, rollId: 'contest-roll', transactionId: 'contest-action',
      contextId: JSON.stringify([enemy.id, definition.id, target.id, 'contest-push', side]) }
    const action = { type: 'monster-action' as const, actorId: enemy.id, actionId: definition.id,
      rolls: [{ targetId: target.id, d20: 19, damageRolls: definition.attack!.damage.map(damage => Array(damage.count).fill(1)),
        onHitEffectRolls: [{ effectId: 'contest-push', sourceD20: 20, sourceD20Second: side === 'source' ? undefined : 1,
          d20: 10, d20Second: side === 'target' ? undefined : 1,
          forcedMovement: { targetId: target.id, to: { x: side === 'source' ? 15 : 5, y: 0 }, distanceFeet: side === 'source' ? 10 : 0 },
          sourceDisadvantageNegationChoice: side === 'source' ? choice : undefined,
          disadvantageNegationChoice: side === 'target' ? choice : undefined }] }] }
    const before = JSON.stringify(state)
    const result = resolveDnd5eHeadlessAction(state, action)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.state.combatants[target.id].position.x).toBe(side === 'source' ? 15 : 5)
    expect(result.state.combatants[target.id].classResources['dnd5e-ki'].current).toBe(side === 'target' ? 1 : 3)
    expect(result.state.combatants[enemy.id].classResources['dnd5e-ki'].current).toBe(side === 'source' ? 1 : 3)
    expect(result.state.combatants[target.id].classState.disadvantageNegationReceipts).toBeUndefined()
    expect(result.state.combatants[enemy.id].classState.disadvantageNegationReceipts).toBeUndefined()
    expect(JSON.stringify(state)).toBe(before)
    if (side !== 'neither') {
      choice.contextId = JSON.stringify([enemy.id, definition.id, target.id, 'contest-push', side === 'source' ? 'target' : 'source'])
      expect(resolveDnd5eHeadlessAction(state, action).ok).toBe(false)
      expect(JSON.stringify(state)).toBe(before)
    }
  } finally { setDnd5eRoomMonsterCatalog([]); f.dispose() }
})


it.each(['grapple', 'shove'] as const)('resolves %s Luck for each side without changing the original state', kind => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    actor.abilities.str = actor.abilities.dex = 10
    actor.skillProficiencies = []
    actor.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'penalty', definitionId: 'penalty', label: 'Penalty', targetId: actor.id,
      source: { kind: 'spell' }, duration: { type: 'permanent' }, modifiers: { abilityCheckDisadvantages: ['str', 'dex'] } })]
    const target = { ...structuredClone(actor), id: 'target', controller: 'dm' as const, initiative: 1, position: { x: 5, y: 0 } }
    const state = startDnd5eHeadlessCombat('basic-contest-luck', [actor, target])
    state.distanceFeetByCombatantPair = { ['hero\u0000target']: 5 }
    const before = JSON.stringify(state)
    for (const side of ['actor', 'target', 'neither'] as const) {
      const choice = { featureId: f.prompt().payload.featureId, rollId: 'basic-roll', transactionId: 'basic-action',
        contextId: JSON.stringify([kind, actor.id, target.id, side]) }
      const action = { type: kind, actorId: actor.id, targetId: target.id, actorD20: 20, actorD20Second: side === 'actor' ? undefined : 1,
        targetD20: 10, targetD20Second: side === 'target' ? undefined : 1, targetDefense: 'athletics' as const, outcome: 'prone' as const,
        actorDisadvantageNegationChoice: side === 'actor' ? choice : undefined,
        targetDisadvantageNegationChoice: side === 'target' ? choice : undefined }
      const result = resolveDnd5eHeadlessAction(state, action)
      expect(result.ok, JSON.stringify(result)).toBe(true)
      expect(result.events).toContainEqual(expect.objectContaining({ type: 'contest-resolved', contest: kind, success: side === 'actor' }))
      expect(result.state.combatants[target.id].conditions.includes(kind === 'grapple' ? 'grappled' : 'prone')).toBe(side === 'actor')
      expect(result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(side === 'actor' ? 1 : 3)
      expect(result.state.combatants[target.id].classResources['dnd5e-ki'].current).toBe(side === 'target' ? 1 : 3)
      expect(JSON.stringify(state)).toBe(before)
      if (side !== 'neither') {
        choice.contextId = 'wrong-basic-action'
        expect(resolveDnd5eHeadlessAction(state, action).ok).toBe(false)
        expect(JSON.stringify(state)).toBe(before)
      }
    }
  } finally { f.dispose() }
})


it('spends Luck on either side of a real grapple escape and preserves the held relation on failure', () => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const captive = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 10, position: { x: 5, y: 0 } })
    captive.abilities.str = captive.abilities.dex = 10
    captive.skillProficiencies = []
    captive.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'penalty', definitionId: 'penalty', label: 'Penalty', targetId: captive.id,
      source: { kind: 'spell' }, duration: { type: 'permanent' }, modifiers: { abilityCheckDisadvantages: ['str', 'dex'] } })]
    const grappler = { ...structuredClone(captive), id: 'grappler', controller: 'dm' as const, initiative: 30, position: { x: 0, y: 0 } }
    const initial = startDnd5eHeadlessCombat('escape-luck', [grappler, captive])
    initial.distanceFeetByCombatantPair = { ['grappler\u0000hero']: 5 }
    const held = resolveDnd5eHeadlessAction(initial, { type: 'grapple', actorId: grappler.id, targetId: captive.id,
      actorD20: 20, actorD20Second: 20, targetD20: 1, targetD20Second: 1, targetDefense: 'athletics' })
    expect(held.ok, JSON.stringify(held)).toBe(true)
    expect(held.state.combatants[captive.id].conditions).toContain('grappled')
    const next = resolveDnd5eHeadlessAction(held.state, { type: 'end-turn', actorId: grappler.id })
    expect(next.ok, JSON.stringify(next)).toBe(true)
    const before = JSON.stringify(next.state)
    for (const side of ['actor', 'target', 'neither'] as const) {
      const choice = { featureId: f.prompt().payload.featureId, rollId: 'escape-roll', transactionId: 'escape-action',
        contextId: JSON.stringify(['escape-grapple', captive.id, grappler.id, side]) }
      const action = { type: 'escape-grapple' as const, actorId: captive.id, grapplerId: grappler.id,
        actorD20: 20, actorD20Second: side === 'actor' ? undefined : 1,
        targetD20: 10, targetD20Second: side === 'target' ? undefined : 1,
        actorDisadvantageNegationChoice: side === 'actor' ? choice : undefined,
        targetDisadvantageNegationChoice: side === 'target' ? choice : undefined }
      const result = resolveDnd5eHeadlessAction(next.state, action)
      expect(result.ok, JSON.stringify(result)).toBe(true)
      expect(result.state.combatants[captive.id].conditions.includes('grappled')).toBe(side !== 'actor')
      expect(result.state.combatants[captive.id].turn.actionAvailable).toBe(false)
      expect(result.state.combatants[captive.id].classResources['dnd5e-ki'].current).toBe(side === 'actor' ? 1 : 3)
      expect(result.state.combatants[grappler.id].classResources['dnd5e-ki'].current).toBe(side === 'target' ? 1 : 3)
      expect(result.state.combatants[captive.id].classState.disadvantageNegationReceipts).toBeUndefined()
      expect(result.state.combatants[grappler.id].classState.disadvantageNegationReceipts).toBeUndefined()
      expect(JSON.stringify(next.state)).toBe(before)
      if (side !== 'neither') {
        choice.contextId = JSON.stringify(['grapple', captive.id, grappler.id, side])
        expect(resolveDnd5eHeadlessAction(next.state, action).ok).toBe(false)
        expect(JSON.stringify(next.state)).toBe(before)
      }
    }
  } finally { f.dispose() }
})


it.each(['actor', 'target'] as const)('preserves %s contest ownership through collector, JSON and map projection', async side => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    character.abilities.str = character.abilities.dex = 10
    character.dnd5eCombatState = { schemaVersion: 2, activeEffects: [createDnd5eMechanicalEffect({
      id: 'penalty', definitionId: 'penalty', label: 'Penalty', targetId: 'hero-token', source: { kind: 'spell' },
      duration: { type: 'permanent' }, modifiers: { abilityCheckDisadvantages: ['str', 'dex'] } })] }
    const defender = structuredClone(character)
    defender.id = 'defender'
    defender.dnd5eCombatState!.activeEffects = defender.dnd5eCombatState!.activeEffects!.map(effect => ({ ...effect, targetId: 'enemy' }))
    const map: BattleMap = { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [
        { id: 'hero-token', label: 'Hero', characterId: character.id, x: 5, y: 5, color: '', emoji: '', size: 1, type: 'player', hp: 30, maxHp: 30 },
        { id: 'enemy', characterId: defender.id, label: 'Enemy', x: 15, y: 5, color: '', emoji: '', size: 1, type: 'enemy', hp: 30, maxHp: 30 },
      ] }
    const prepared = prepareDnd5ePlayerBasicAction({ map, characters: [character, defender],
      action: { id: 'basic-request', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending',
        type: 'dnd5e-basic-action', actorTokenId: 'hero-token', characterId: character.id,
        dnd5eBasicAction: { kind: 'shove', targetTokenId: 'enemy', targetDefense: 'athletics', outcome: 'prone' },
        round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 },
      initiativeOrder: [{ tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: 'Enemy', emoji: '', color: '', roll: 10 }],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30) })
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.actorRollMode).toBe('disadvantage')
    const before = JSON.stringify(prepared.prepared)
    const choose = vi.fn<Parameters<typeof requestBasicContestNegation>[2]['choose']>(async () => 'use')
    const choice = await requestBasicContestNegation(prepared.prepared, side, { choose, isCurrent: () => true })
    expect(choose).toHaveBeenCalledTimes(1)
    expect(choose.mock.calls[0]?.[0]).toMatchObject({ actor: { id: side === 'actor' ? character.id : defender.id } })
    expect(choice?.contextId).toBe(JSON.stringify(['shove', 'hero-token', 'enemy', side]))
    expect(JSON.stringify(prepared.prepared)).toBe(before)
    expect(await requestBasicContestNegation(prepared.prepared, side, { choose: async () => 'decline', isCurrent: () => true })).toBeUndefined()
    await expect(requestBasicContestNegation(prepared.prepared, side, { choose, isCurrent: () => false })).rejects.toThrow('negation-roll-context-changed')
    const input = JSON.parse(JSON.stringify({ prepared: prepared.prepared, actorD20: 20, actorD20Second: side === 'actor' ? undefined : 1, targetD20: 10, targetD20Second: side === 'target' ? undefined : 1,
      actorDisadvantageNegationChoice: side === 'actor' ? choice : undefined, targetDisadvantageNegationChoice: side === 'target' ? choice : undefined }))
    const resolved = resolvePreparedDnd5ePlayerBasicAction(input)
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    expect(resolved.application?.characters.find(row => row.id === character.id)?.classResources?.['dnd5e-ki'].current).toBe(side === 'actor' ? 1 : 3)
    expect(resolved.application?.characters.find(row => row.id === defender.id)?.classResources?.['dnd5e-ki'].current).toBe(side === 'target' ? 1 : 3)
    expect(resolved.result.state.combatants.enemy.conditions.includes('prone')).toBe(side === 'actor')
    expect(resolved.result.state.combatants['hero-token'].turn.actionAvailable).toBe(false)
    expect(JSON.stringify(prepared.prepared)).toBe(before)
    expect(character.classResources?.['dnd5e-ki'].current).toBe(3)
  } finally { f.dispose() }
})


it.each([true, false])('uses Luck before hiding and preserves perception and action rules: use=%s', use => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    actor.abilities.dex = 10; actor.skillProficiencies = []
    actor.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'penalty', definitionId: 'penalty', label: 'Penalty', targetId: actor.id,
      source: { kind: 'spell' }, duration: { type: 'permanent' }, modifiers: { abilityCheckDisadvantages: ['dex'] } })]
    const observer = { ...structuredClone(actor), id: 'observer', controller: 'dm' as const, initiative: 1, position: { x: 5, y: 0 } }
    observer.abilities.wis = 10
    const state = startDnd5eHeadlessCombat('hide-luck', [actor, observer])
    state.lineOfSightBlockedByCombatantPair = { ['observer\u0000hero']: true }
    const action = { type: 'hide' as const, actorId: actor.id, d20: 20, d20Second: use ? undefined : 1,
      disadvantageNegationChoice: use ? { featureId: f.prompt().payload.featureId, rollId: 'hide-roll', transactionId: 'hide-action',
        contextId: JSON.stringify(['hide', actor.id]) } : undefined }
    const before = JSON.stringify(state)
    const result = resolveDnd5eHeadlessAction(state, action)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.state.combatants[actor.id].classState.hiddenCheckTotal).toBe(use ? 20 : undefined)
    expect(result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(use ? 1 : 3)
    expect(result.state.combatants[actor.id].turn.actionAvailable).toBe(false)
    expect(result.state.combatants[actor.id].classState.disadvantageNegationReceipts).toBeUndefined()
    expect(JSON.stringify(state)).toBe(before)
    const visible = structuredClone(state)
    visible.lineOfSightBlockedByCombatantPair = {}
    expect(resolveDnd5eHeadlessAction(visible, action).ok).toBe(false)
    expect(visible.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(3)
    if (action.disadvantageNegationChoice) {
      action.disadvantageNegationChoice.contextId = 'wrong-hide'
      expect(resolveDnd5eHeadlessAction(state, action).ok).toBe(false)
    }
  } finally { f.dispose() }
})


it.each(['check', 'save'] as const)('resolves fixed DC escape %s with an atomic Luck debit', kind => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    actor.abilities.str = 10; actor.skillProficiencies = []; actor.savingThrowBonuses.str = 0
    actor.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'penalty', definitionId: 'penalty', label: 'Penalty', targetId: actor.id,
      source: { kind: 'spell' }, duration: { type: 'permanent' }, modifiers: { abilityCheckDisadvantages: ['str'], savingThrowDisadvantages: ['str'] } }),
      createDnd5eConditionEffect({ id: 'restraint', condition: 'restrained', targetId: actor.id, source: { kind: 'spell' }, duration: { type: 'permanent' },
        escapeCheck: kind === 'check' ? { ability: 'str', dc: 15, economy: 'action' } : undefined,
        escapeSavingThrow: kind === 'save' ? { ability: 'str', dc: 15, economy: 'action' } : undefined })]
    actor.conditions = ['restrained']
    const observer = { ...structuredClone(actor), id: 'observer', controller: 'dm' as const, initiative: 1, position: { x: 5, y: 0 } }
    const state = startDnd5eHeadlessCombat('fixed-escape-luck', [actor, observer])
    const before = JSON.stringify(state)
    for (const use of [true, false]) {
      const action = { type: 'escape-active-effect' as const, actorId: actor.id, effectId: 'restraint', d20: 20, d20Second: use ? undefined : 1,
        disadvantageNegationChoice: use ? { featureId: f.prompt().payload.featureId, rollId: 'fixed-escape-roll', transactionId: 'fixed-escape-action',
          contextId: JSON.stringify(['escape-active-effect', actor.id, 'restraint']) } : undefined }
      const result = resolveDnd5eHeadlessAction(state, action)
      expect(result.ok, JSON.stringify(result)).toBe(true)
      expect(result.state.combatants[actor.id].conditions.includes('restrained')).toBe(!use)
      expect(result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(use ? 1 : 3)
      expect(result.state.combatants[actor.id].turn.actionAvailable).toBe(false)
      expect(result.state.combatants[actor.id].classState.disadvantageNegationReceipts).toBeUndefined()
      expect(JSON.stringify(state)).toBe(before)
      if (action.disadvantageNegationChoice) {
        action.disadvantageNegationChoice.contextId = JSON.stringify(['escape-active-effect', actor.id, 'different-effect'])
        expect(resolveDnd5eHeadlessAction(state, action).ok).toBe(false)
        expect(JSON.stringify(state)).toBe(before)
      }
    }
  } finally { f.dispose() }
})


it.each(['escape', 'remove'] as const)('collects the correct roll for %s and projects the final effect and cost', async operation => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    character.conditions = ['restrained']
    character.dnd5eCombatState = { schemaVersion: 2, activeEffects: [
      createDnd5eConditionEffect({ id: 'save-restraint', condition: 'restrained', targetId: 'hero-token', source: { kind: 'spell' },
        duration: { type: 'permanent' }, escapeSavingThrow: operation === 'escape' ? { ability: 'str', dc: 15, economy: 'action' } : undefined,
        removal: operation === 'remove' ? { action: { label: 'Free', economy: 'action', maxDistanceFeet: 0, selfOnly: true, abilityCheck: { ability: 'str', dc: 15 } } } : undefined }),
      createDnd5eMechanicalEffect({ id: 'save-penalty', definitionId: 'save-penalty', label: 'Penalty', targetId: 'hero-token',
        source: { kind: 'spell' }, duration: { type: 'permanent' }, modifiers: { savingThrowDisadvantages: ['str'], abilityCheckDisadvantages: ['str'] } })] }
    const map: BattleMap = { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [
        { id: 'hero-token', label: 'Hero', characterId: character.id, x: 5, y: 5, color: '', emoji: '', size: 1, type: 'player', hp: 30, maxHp: 30 },
        { id: 'enemy', label: 'Enemy', x: 15, y: 5, color: '', emoji: '', size: 1, type: 'enemy', hp: 30, maxHp: 30 }] }
    const prepared = prepareDnd5ePlayerBasicAction({ map, characters: [character],
      action: { id: 'escape-request', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending',
        type: 'dnd5e-basic-action', actorTokenId: 'hero-token', characterId: character.id,
        dnd5eBasicAction: operation === 'escape' ? { kind: 'escape-effect' } : { kind: 'dismiss-effect', effectId: 'save-restraint' }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 },
      initiativeOrder: [{ tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: 'Enemy', emoji: '', color: '', roll: 10 }],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30) })
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ actorRollKind: operation === 'escape' ? 'saving-throw' : 'ability-check', actorRollMode: 'disadvantage', actorCheckAbility: 'str' })
    const before = JSON.stringify(prepared.prepared)
    const choose = vi.fn<Parameters<typeof requestBasicContestNegation>[2]['choose']>(async () => 'use')
    const choice = await requestBasicContestNegation(prepared.prepared, 'actor', { choose, isCurrent: () => true })
    expect(choose.mock.calls[0]?.[0]).toMatchObject({ actor: { id: character.id }, context: { disadvantageNegation: { kind: operation === 'escape' ? 'saving-throw' : 'ability-check' } } })
    const resolved = resolvePreparedDnd5ePlayerBasicAction(JSON.parse(JSON.stringify({ prepared: prepared.prepared,
      actorD20: 20, actorDisadvantageNegationChoice: choice })))
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    expect(resolved.result.state.combatants['hero-token'].conditions).not.toContain('restrained')
    expect(resolved.application?.characters.find(row => row.id === character.id)?.classResources?.['dnd5e-ki'].current).toBe(1)
    expect(JSON.stringify(prepared.prepared)).toBe(before)
  } finally { f.dispose() }
})


it('uses Luck for an action removal check while enforcing distance and target context', () => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    actor.abilities.int = 10; actor.skillProficiencies = []
    actor.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'penalty', definitionId: 'penalty', label: 'Penalty', targetId: actor.id,
      source: { kind: 'spell' }, duration: { type: 'permanent' }, modifiers: { abilityCheckDisadvantages: ['int'] } })]
    const target = { ...structuredClone(actor), id: 'target', controller: 'dm' as const, initiative: 1, position: { x: 5, y: 0 } }
    target.conditions = ['restrained']
    target.classState.activeEffects = [createDnd5eConditionEffect({ id: 'removable', condition: 'restrained', targetId: target.id,
      source: { kind: 'spell' }, duration: { type: 'permanent' }, removal: { action: { label: 'Free', economy: 'action',
        maxDistanceFeet: 5, abilityCheck: { ability: 'int', skill: 'arcana', dc: 15 } } } })]
    const state = startDnd5eHeadlessCombat('remove-luck', [actor, target])
    state.distanceFeetByCombatantPair = { ['hero\u0000target']: 5 }
    const before = JSON.stringify(state)
    for (const use of [true, false]) {
      const action = { type: 'remove-active-effect' as const, actorId: actor.id, targetId: target.id, effectId: 'removable', d20: 20, d20Second: use ? undefined : 1,
        disadvantageNegationChoice: use ? { featureId: f.prompt().payload.featureId, rollId: 'remove-roll', transactionId: 'remove-action',
          contextId: JSON.stringify(['remove-active-effect', actor.id, target.id, 'removable']) } : undefined }
      const result = resolveDnd5eHeadlessAction(state, action)
      expect(result.ok, JSON.stringify(result)).toBe(true)
      expect(result.state.combatants[target.id].conditions.includes('restrained')).toBe(!use)
      expect(result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(use ? 1 : 3)
      expect(result.state.combatants[target.id].classResources['dnd5e-ki'].current).toBe(3)
      expect(result.state.combatants[actor.id].turn.actionAvailable).toBe(false)
      expect(result.state.combatants[actor.id].classState.disadvantageNegationReceipts).toBeUndefined()
      expect(JSON.stringify(state)).toBe(before)
      const far = structuredClone(state)
      far.combatants[target.id].position.x = 20
      far.distanceFeetByCombatantPair = { ['hero\u0000target']: 20 }
      expect(resolveDnd5eHeadlessAction(far, action).ok).toBe(false)
      expect(far.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(3)
      if (action.disadvantageNegationChoice) {
        action.disadvantageNegationChoice.contextId = 'wrong-target'
        expect(resolveDnd5eHeadlessAction(state, action).ok).toBe(false)
      }
    }
  } finally { f.dispose() }
})


it('plans Activity Luck for exact Host dice owners atomically across multiple rolls', () => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    const target = { ...structuredClone(actor), id: 'target', controller: 'dm' as const, initiative: 1 }
    const state = startDnd5eHeadlessCombat('activity-luck', [actor, target])
    const declarations = [
      { id: 'attack:target', label: 'Attack', count: 2, sides: 20, rollerTokenId: actor.id, d20RollKind: 'attack' as const, d20RollMode: 'disadvantage' as const },
      { id: 'save:target', label: 'Save', count: 2, sides: 20, rollerTokenId: target.id, d20RollKind: 'saving-throw' as const, d20RollMode: 'disadvantage' as const },
    ]
    const choice = (index: number) => ({ featureId: f.prompt().payload.featureId, rollId: `activity-roll-${index}`, transactionId: 'cast',
      contextId: dnd5eActivityNegationContext('spell:test', 'cast', declarations[index].id, declarations[index].rollerTokenId) })
    const choices = { [declarations[0].id]: choice(0), [declarations[1].id]: choice(1) }
    const before = JSON.stringify(state)
    const prepared = prepareDnd5eActivityDisadvantageNegation({ state, activityId: 'spell:test', actionId: 'cast', declarations, choices })
    expect(prepared.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(1)
    expect(prepared.state.combatants[target.id].classResources['dnd5e-ki'].current).toBe(1)
    expect(prepared.declarations.map(row => [row.count, row.d20RollMode, row.acceptedCounts])).toEqual([[1, 'normal', [1]], [1, 'normal', [1]]])
    expect(prepared.state.combatants[actor.id].classState.disadvantageNegationReceipts).toBeUndefined()
    expect(prepareDnd5eActivityDisadvantageNegation({ state, activityId: 'spell:test', actionId: 'cast', declarations, choices: {} }).state).toEqual(state)
    const invalid = { ...choices, [declarations[1].id]: { ...choice(1), contextId: choice(0).contextId } }
    expect(() => prepareDnd5eActivityDisadvantageNegation({ state, activityId: 'spell:test', actionId: 'cast', declarations, choices: invalid })).toThrow('context-mismatch')
    const poor = structuredClone(state); poor.combatants[target.id].classResources['dnd5e-ki'].current = 1
    expect(() => prepareDnd5eActivityDisadvantageNegation({ state: poor, activityId: 'spell:test', actionId: 'cast', declarations, choices })).toThrow('cost-unavailable')
    expect(poor.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(3)
    expect(() => prepareDnd5eActivityDisadvantageNegation({ state, activityId: 'spell:test', actionId: 'cast', declarations, choices: { absent: choice(0) } })).toThrow('unused-choice')
    expect(() => prepareDnd5eActivityDisadvantageNegation({ state, activityId: 'spell:test', actionId: 'cast', declarations: declarations.map(row => ({ ...row, d20RollMode: 'normal' })), choices })).toThrow('invalid-roll')
    expect(JSON.stringify(state)).toBe(before)
  } finally { f.dispose() }
})


it('commits Activity Luck with the final save outcome and action cost without mutating the source', async () => {
  const f = fixture()
  const registration = registerDnd5eActivityPackage({ packageId: 'test.luck-bridge', packageVersion: '1.0.0', activities: [{
    schemaVersion: 1, id: 'save-test', name: 'Save test', activation: { kind: 'action' },
    legacySource: { kind: 'feature', id: 'save-test' },
    target: { kind: 'creature', relation: 'any', count: 1 }, automation: automationCapabilityFromLegacyStatus('full'),
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
    checks: [{ id: 'save', kind: 'saving-throw', ability: 'wis', rollId: 'save', scope: 'per-target', rollMode: 'disadvantage', dc: { kind: 'constant', value: 15 } }],
    outcomes: [{ id: 'pass', when: { kind: 'check', checkId: 'save', result: 'success' }, operations: [
      { id: 'mark', kind: 'temporary-hit-points', target: 'target', amount: { kind: 'constant', value: 2 } }] }],
  }] })
  const activity = getRegisteredDnd5eActivity('test.luck-bridge', 'save-test')!
  const disposeCompiled = registerDnd5eRulesPlugin({ manifest: { id: 'test.luck-bridge', name: 'Luck bridge', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
    api.registerFeature({ id: activity.id, name: activity.name, summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
  } })
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    const target = { ...structuredClone(actor), id: 'target', controller: 'dm' as const, initiative: 1, position: { x: 5, y: 0 } }
    actor.pluginFeatureIds = [...actor.pluginFeatureIds, 'test.luck-bridge:save-test']
    const state = startDnd5eHeadlessCombat('activity-bridge-luck', [actor, target])
    const before = JSON.stringify(state)
    for (const use of [true, false]) {
      const collector = createMapActivityNegationDice({ state, activityId: 'save-test', actionId: 'cast',
        map: { id: 'activity-test', tokens: [{ id: target.id, characterId: character.id }] } as BattleMap,
        characters: [character], choose: async () => use ? 'use' : 'decline',
        roll: async declaration => { expect(declaration.count).toBe(use ? 1 : 2); return use ? [20] : [20, 1] },
        isCurrent: () => true,
      })
      const authoritativeRolls = await collector.collect([{ id: 'save:target', label: 'Save', sides: 20, count: 2, rollerTokenId: target.id,
        d20RollKind: 'saving-throw', d20RollMode: 'disadvantage' }])
      const collected = { authoritativeRolls, disadvantageNegationChoices: collector.choices() }
      const transported = JSON.parse(JSON.stringify(collected)) as typeof collected
      const authority = {
        command: { schemaVersion: 1 as const, commandId: 'cast', actorId: actor.id, packageId: 'test.luck-bridge', packageVersion: '1.0.0',
          activityId: 'save-test', targetIds: [target.id], expectedRevision: 0 }, currentRevision: 0,
        actor: dnd5eActivityActorSnapshotFromCombatantV1(state.combatants[actor.id]), targets: [dnd5eActivityActorSnapshotFromCombatantV1(state.combatants[target.id])],
        ...transported, distanceFeetByTargetId: { target: 5 },
      }
      const resolve = (source = state, input = authority) => resolveRegisteredDnd5eActivityInCombatV1({
        state: source, command: input.command, combatRevision: input.currentRevision, authoritativeRolls: input.authoritativeRolls,
        disadvantageNegationChoices: input.disadvantageNegationChoices,
      })
      const unowned = structuredClone(state)
      unowned.combatants[actor.id].pluginFeatureIds = unowned.combatants[actor.id].pluginFeatureIds.filter(id => id !== 'test.luck-bridge:save-test')
      const rejected = resolve(unowned)
      expect(rejected.phase).toBe('resolve')
      expect(rejected.result.ok).toBe(false)
      if (rejected.phase === 'resolve' && !rejected.result.ok) expect(rejected.result.reason).toBe('unauthorized-actor')
      expect(unowned.combatants[target.id].classResources['dnd5e-ki'].current).toBe(3)
      expect(unowned.combatants[actor.id].turn.actionAvailable).toBe(true)
      const compiled = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: 'test.luck-bridge', actionId: 'save-test',
        featureId: 'test.luck-bridge:save-test', transactionId: 'cast', actorId: actor.id, targetId: target.id,
        rolls: transported.authoritativeRolls, disadvantageNegationChoices: transported.disadvantageNegationChoices })
      expect(compiled.ok, JSON.stringify(compiled.ok ? {} : compiled.reason)).toBe(true)
      expect(compiled.state.combatants[target.id].classResources['dnd5e-ki'].current).toBe(use ? 1 : 3)
      expect(compiled.state.combatants[target.id].temporaryHp).toBe(use ? 2 : 0)
      expect(compiled.state.combatants[actor.id].turn.actionAvailable).toBe(false)
      const result = resolve()
      expect(result.result.ok, JSON.stringify(result)).toBe(true)
      expect(result.phase).toBe('commit')
      if (result.phase !== 'commit') return
      expect(result.result.state.combatants[target.id].classResources['dnd5e-ki'].current).toBe(use ? 1 : 3)
      expect(result.result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(3)
      expect(result.result.state.combatants[target.id].temporaryHp).toBe(use ? 2 : 0)
      expect(result.result.state.combatants[actor.id].turn.actionAvailable).toBe(false)
      expect(JSON.stringify(state)).toBe(before)
      if (use) {
        const poor = structuredClone(state); poor.combatants[target.id].classResources['dnd5e-ki'].current = 1
        expect(resolve(poor, authority).result.ok).toBe(false)
        expect(poor.combatants[actor.id].turn.actionAvailable).toBe(true)
        const compiledAction = { type: 'plugin' as const, pluginId: 'test.luck-bridge', actionId: 'save-test',
          featureId: 'test.luck-bridge:save-test', transactionId: 'cast', actorId: actor.id, targetId: target.id,
          rolls: transported.authoritativeRolls, disadvantageNegationChoices: transported.disadvantageNegationChoices }
        expect(resolveDnd5eHeadlessAction(poor, compiledAction).ok).toBe(false)
        expect(resolveDnd5eHeadlessAction(state, { ...compiledAction, disadvantageNegationChoices: undefined }).ok).toBe(false)
        expect(resolveDnd5eHeadlessAction(state, { ...compiledAction, transactionId: 'different-cast' }).ok).toBe(false)
        expect(JSON.stringify(state)).toBe(before)
        const extra = { ...authority, disadvantageNegationChoices: { ...authority.disadvantageNegationChoices!, absent: authority.disadvantageNegationChoices!['save:target'] } }
        expect(resolve(state, extra).result.ok).toBe(false)
      }
    }
  } finally { disposeCompiled(); registration.dispose(); f.dispose() }
})


it('reserves Activity negation choices before later rolls and cancels stale collection without spending', async () => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    const state = startDnd5eHeadlessCombat('activity-collect', [actor])
    const before = JSON.stringify(state)
    const declarations = ['first', 'second'].map(id => ({ id, label: id, sides: 20, count: 2, rollerTokenId: actor.id,
      d20RollKind: 'ability-check' as const, d20RollMode: 'disadvantage' as const }))
    const choice = (id: string) => ({ featureId: f.prompt().payload.featureId, rollId: `paid-${id}`, transactionId: 'collect',
      contextId: dnd5eActivityNegationContext('checks', 'collect', id, actor.id) })
    const roll = vi.fn(async () => [20])
    const balances: number[] = []
    await expect(collectDnd5eActivityNegationDice({ state, activityId: 'checks', actionId: 'collect', declarations,
      choose: async (declaration, available) => { balances.push(available.combatants[actor.id].classResources['dnd5e-ki'].current); return choice(declaration.id) },
      roll, isCurrent: () => true,
    })).rejects.toThrow('cost-unavailable')
    expect(balances).toEqual([3, 1])
    expect(roll).toHaveBeenCalledTimes(1)
    let current = true
    roll.mockClear()
    await expect(collectDnd5eActivityNegationDice({ state, activityId: 'checks', actionId: 'collect', declarations,
      choose: async declaration => { current = false; return choice(declaration.id) }, roll, isCurrent: () => current,
    })).rejects.toThrow('stale')
    expect(roll).not.toHaveBeenCalled()
    expect(JSON.stringify(state)).toBe(before)
  } finally { f.dispose() }
})


it.each([0, 1, 2])('keeps map Activity reservations across phases with parent cost %s', async parentCost => {
  const f = fixture()
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    const state = startDnd5eHeadlessCombat('phases', [actor])
    const before = JSON.stringify(state)
    const choose = vi.fn(async () => 'use')
    const counts: number[] = []
    const collector = createMapActivityNegationDice({ state, activityId: 'checks', actionId: 'phases', characters: [character],
      parent: { actorId: actor.id, activity: { schemaVersion: 1, id: 'checks', name: 'Checks', activation: { kind: 'action' },
        target: { kind: 'self' }, automation: automationCapabilityFromLegacyStatus('full'), outcomes: [],
        consumption: [{ kind: 'resource', resourceId: 'dnd5e-ki', amount: { kind: 'constant', value: parentCost }, consumeOn: 'resolve' }] } },
      map: { id: 'map', tokens: [{ id: actor.id, characterId: character.id }] } as BattleMap, choose,
      isCurrent: () => true, roll: async declaration => { counts.push(declaration.count); return declaration.count === 1 ? [20] : [20, 1] },
    })
    const declaration = (id: string) => ({ id, label: id, sides: 20, count: 2, rollerTokenId: actor.id,
      d20RollKind: 'ability-check' as const, d20RollMode: 'disadvantage' as const })
    await collector.collect([declaration('first')])
    await collector.collect([declaration('second')])
    expect(counts).toEqual(parentCost < 2 ? [1, 2] : [2, 2])
    expect(choose).toHaveBeenCalledTimes(parentCost < 2 ? 1 : 0)
    expect(Object.keys(collector.choices())).toEqual(parentCost < 2 ? ['first'] : [])
    await expect(collector.collect([declaration('first')])).rejects.toThrow('invalid-context')
    expect(counts).toEqual(parentCost < 2 ? [1, 2] : [2, 2])
    expect(JSON.stringify(state)).toBe(before)
  } finally { f.dispose() }
})


it('settles Activity spell slots separately from the target Luck cost', async () => {
  const f = fixture()
  const packageId = 'test.luck-spell'
  const spellId = `${packageId}:save-test`
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [{
    schemaVersion: 1, id: 'save-test', name: 'Save test', activation: { kind: 'action' },
    legacySource: { kind: 'spell', id: 'save-test' }, target: { kind: 'creature', relation: 'any', count: 1 },
    automation: automationCapabilityFromLegacyStatus('full'),
    checks: [{ id: 'save', kind: 'saving-throw', ability: 'wis', rollId: 'save', scope: 'per-target', rollMode: 'disadvantage', dc: { kind: 'constant', value: 15 } }],
    outcomes: [{ id: 'pass', when: { kind: 'check', checkId: 'save', result: 'success' }, operations: [
      { id: 'mark', kind: 'temporary-hit-points', target: 'target', amount: { kind: 'constant', value: 2 } }] }],
  }] })
  const activity = getRegisteredDnd5eActivity(packageId, 'save-test')!
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Luck spell', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity, { outerSpellTransaction: true }))
    api.registerSpell({ id: 'save-test', name: 'Save test', level: 1, school: 'abjuration', ritual: false,
      castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 30 },
      components: { verbal: true, somatic: false, material: false }, duration: { type: 'instantaneous', concentration: false },
      classes: ['wizard'], description: 'Synthetic save spell', automation: { mode: 'headless-action', actionId: 'save-test' } })
  } })
  try {
    const monk = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const wizard = normalizeCharacter({ ...monk, id: 'caster', charClass: '法师', dnd5eClassLevels: { wizard: 11 },
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': [spellId] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 4 } } })
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(wizard), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    const target = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(monk), controller: 'player', initiativeD20: 1, position: { x: 5, y: 0 } })
    const state = startDnd5eHeadlessCombat('spell-luck', [actor, target])
    const before = JSON.stringify(state)
    const collector = createMapActivityNegationDice({ state, activityId: activity.id, actionId: 'cast', characters: [wizard, monk],
      map: { id: 'map', tokens: [{ id: target.id, characterId: monk.id }] } as BattleMap,
      choose: async () => 'use', isCurrent: () => true, roll: async () => [20] })
    const rolls = await collector.collect([{ id: `save:${target.id}`, label: 'Save', sides: 20, count: 2,
      rollerTokenId: target.id, d20RollKind: 'saving-throw', d20RollMode: 'disadvantage' }])
    const action = { type: 'plugin-spell-activity' as const, actorId: actor.id,
      pluginAction: { type: 'plugin' as const, pluginId: packageId, actionId: activity.id, transactionId: 'cast',
        actorId: actor.id, targetId: target.id, rolls, disadvantageNegationChoices: collector.choices() },
      spell: { castingClassId: 'wizard' as const, spellId, spellName: 'Save test', spellLevel: 1, slotLevel: 1,
        castingTime: 'action' as const, declaredTargetIds: [target.id] } }
    const result = resolveDnd5eHeadlessAction(state, action)
    expect(result.ok, result.ok ? '' : result.reason).toBe(true)
    expect(result.state.combatants[target.id].temporaryHp).toBe(2)
    expect(result.state.combatants[target.id].classResources['dnd5e-ki'].current).toBe(1)
    expect(result.state.combatants[actor.id].classResources['dnd5e-spell-slot-1'].current).toBe(1)
    expect(result.state.combatants[actor.id].turn.actionAvailable).toBe(false)
    expect(JSON.stringify(state)).toBe(before)
  } finally { dispose(); registration.dispose(); f.dispose() }
})


it.each([true, false])('settles triggered Activity Luck and prevents repeat consumption (use=%s)', async use => {
  const f = fixture()
  const registration = registerDnd5eActivityPackage({ packageId: 'test.luck-trigger', packageVersion: '1.0.0', activities: [{
    schemaVersion: 1, id: 'save', name: 'Triggered save', activation: { kind: 'free' },
    invocation: { kind: 'triggered', event: 'movement-completed', confirmation: 'automatic' },
    legacySource: { kind: 'feature', id: 'save' }, target: { kind: 'creature', relation: 'any', count: 1 },
    automation: automationCapabilityFromLegacyStatus('full'),
    checks: [{ id: 'save', kind: 'saving-throw', ability: 'wis', rollId: 'save', scope: 'per-target', rollMode: 'disadvantage', dc: { kind: 'constant', value: 15 } }],
    outcomes: [{ id: 'pass', when: { kind: 'check', checkId: 'save', result: 'success' }, operations: [
      { id: 'mark', kind: 'temporary-hit-points', target: 'target', amount: { kind: 'constant', value: 2 } }] }],
  }] })
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    const target = { ...structuredClone(actor), id: 'target', initiative: 1 }
    actor.pluginFeatureIds = [...actor.pluginFeatureIds, 'test.luck-trigger:save']
    const state = startDnd5eHeadlessCombat('trigger-luck', [actor, target])
    const before = JSON.stringify(state)
    const choose = vi.fn(async () => use ? 'use' : 'decline')
    const roll = vi.fn(async (request: { count: number }) => request.count === 1 ? [20] : [20, 1])
    const input = { state, events: [{ type: 'moved' as const, actorId: target.id, from: { x: 0, y: 0 }, to: { x: 5, y: 0 },
      distance: 5, movementKind: 'forced' as const, sourceActorId: actor.id, activityId: 'push' }],
      eventBatchId: 'trigger-luck-event', combatRevision: 0, confirm: async () => true, roll,
      chooseDisadvantageNegation: (request: Omit<Parameters<typeof requestMapActivityNegation>[0], 'map' | 'characters' | 'choose' | 'isCurrent'>) => requestMapActivityNegation({ ...request,
        map: { id: 'map', tokens: [{ id: target.id, characterId: character.id }] } as BattleMap,
        characters: [character], choose, isCurrent: () => true }),
    }
    const result = await settleDnd5eActivityTriggerWindowsV1(input)
    expect(result.diagnostics, JSON.stringify(result.diagnostics)).toContainEqual(expect.objectContaining({ status: 'resolved', activityId: 'save' }))
    expect(result.state.combatants[target.id].temporaryHp).toBe(use ? 2 : 0)
    expect(result.state.combatants[target.id].classResources['dnd5e-ki'].current).toBe(use ? 1 : 3)
    expect(choose).toHaveBeenCalledTimes(1)
    expect(roll).toHaveBeenCalledTimes(1)
    const replay = await settleDnd5eActivityTriggerWindowsV1({ ...input, state: result.state, combatRevision: result.combatRevision })
    expect(replay.state.combatants[target.id].classResources['dnd5e-ki'].current).toBe(use ? 1 : 3)
    expect(roll).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(state)).toBe(before)
  } finally { registration.dispose(); f.dispose() }
})


it('binds Luck to each fresh continuation attack and rejects old choices and replay', () => {
  const f = fixture()
  const make = (id: string) => ({ schemaVersion: 1 as const, id, name: id, activation: { kind: 'free' as const },
    legacySource: { kind: 'feature' as const, id }, target: { kind: 'creature' as const, relation: 'any' as const, count: 1 },
    automation: automationCapabilityFromLegacyStatus('full'),
    checks: [{ id: 'hit', kind: 'attack-roll' as const, rollId: 'attack', scope: 'per-target' as const,
      rollMode: 'disadvantage' as const, attackBonus: { kind: 'constant' as const, value: 0 } }],
    outcomes: [{ id: 'hit', when: { kind: 'check' as const, checkId: 'hit', result: 'success' as const }, operations: [
      { id: 'mark', kind: 'temporary-hit-points' as const, target: 'target' as const, amount: { kind: 'constant' as const, value: 2 } }] }],
  })
  const root = { ...make('root'), continuation: { nextActivityId: 'next', maximumSteps: 2, excludePreviousTargets: true, requiredSuccessfulCheckId: 'hit' } }
  const next = { ...make('next'), requiresContinuationFrom: 'root' }
  const registration = registerDnd5eActivityPackage({ packageId: 'test.luck-chain', packageVersion: '1.0.0', activities: [root, next] })
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    actor.pluginFeatureIds = [...actor.pluginFeatureIds, 'test.luck-chain:root']
    actor.classResources['dnd5e-ki'].current = 5
    const firstTarget = { ...structuredClone(actor), id: 'first', initiative: 2 }
    const secondTarget = { ...structuredClone(actor), id: 'second', initiative: 1 }
    const state = startDnd5eHeadlessCombat('luck-chain', [actor, firstTarget, secondTarget])
    const choice = (activityId: string, commandId: string, targetId: string) => ({ featureId: f.prompt().payload.featureId,
      rollId: `paid-${commandId}`, transactionId: commandId,
      contextId: dnd5eActivityNegationContext(activityId, commandId, `attack:${targetId}`, actor.id) })
    const command = { schemaVersion: 1 as const, commandId: 'cast', actorId: actor.id, packageId: 'test.luck-chain', packageVersion: '1.0.0',
      activityId: 'root', targetIds: ['first'], expectedRevision: 0 }
    const first = resolveRegisteredDnd5eActivityInCombatV1({ state, command, combatRevision: 0,
      authoritativeRolls: { 'attack:first': { values: [20] } }, disadvantageNegationChoices: { 'attack:first': choice('root', 'cast', 'first') } })
    expect(first.phase).toBe('commit')
    if (first.phase !== 'commit' || !first.result.ok) throw Error(JSON.stringify(first))
    expect(first.result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(3)
    const resumed = JSON.parse(JSON.stringify(first.result.state)) as typeof state
    const nextCommand = { ...command, commandId: 'jump', activityId: 'next', continuationId: 'cast', targetIds: ['second'], expectedRevision: 1 }
    const resolve = (choices: Record<string, ReturnType<typeof choice>>, source = resumed, revision = 1) =>
      resolveRegisteredDnd5eActivityInCombatV1({ state: source, command: { ...nextCommand, expectedRevision: revision }, combatRevision: revision,
        authoritativeRolls: { 'attack:second': { values: [20] } }, disadvantageNegationChoices: choices })
    expect(resolve({ 'attack:second': choice('root', 'cast', 'first') }).result.ok).toBe(false)
    const paid = { 'attack:second': choice('next', 'jump', 'second') }
    const second = resolve(paid)
    if (second.phase !== 'commit' || !second.result.ok) throw Error(JSON.stringify(second))
    expect(second.result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(1)
    expect(second.result.state.combatants.second.temporaryHp).toBe(2)
    expect(resolve(paid, second.result.state, 2).result.ok).toBe(false)
    expect(resumed.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(3)
  } finally { registration.dispose(); f.dispose() }
})


it.each([0, 2])('charges Luck once alongside parent cost %s when critical cancellation re-evaluates an Activity attack', parentCost => {
  const f = fixture()
  const ns = 'test.luck-critical'
  const guardId = `${ns}:guardian.cancel`
  const guardResource = `${ns}:uses`
  const registration = registerDnd5eActivityPackage({ packageId: ns, packageVersion: '1.0.0', activities: [{
    schemaVersion: 1, id: 'strike', name: 'Strike', activation: { kind: 'action' },
    legacySource: { kind: 'feature', id: 'strike' }, target: { kind: 'creature', relation: 'any', count: 1 },
    automation: automationCapabilityFromLegacyStatus('full'),
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' },
      ...(parentCost ? [{ kind: 'resource' as const, resourceId: 'dnd5e-ki', amount: { kind: 'constant' as const, value: parentCost }, consumeOn: 'resolve' as const }] : [])],
    checks: [{ id: 'hit', kind: 'attack-roll', rollId: 'attack', scope: 'per-target', rollMode: 'disadvantage', attackBonus: { kind: 'constant', value: 5 } }],
    outcomes: [{ id: 'hit', when: { kind: 'check', checkId: 'hit', result: 'success' }, operations: [
      { id: 'damage', kind: 'damage', target: 'target', damageType: 'fire', critical: 'double-dice', amount: { kind: 'dice', rollId: 'damage', count: 1, sides: 6 } }] }],
  }] })
  const activity = getRegisteredDnd5eActivity(ns, 'strike')!
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: ns, name: 'Luck critical', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
    api.registerFeature({ id: activity.id, name: activity.name, summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
    api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'guardian', classId: 'cleric', name: 'Guardian', summary: 'Synthetic',
      resources: [{ id: 'uses', label: 'Uses', maximum: { kind: 'fixed', value: 1 }, resetOn: 'long-rest' }],
      abilities: [{ schemaVersion: 1, id: 'cancel', name: 'Cancel', description: 'Synthetic', level: 6,
        trigger: { kind: 'after-attack-roll' }, cost: { economy: 'reaction', resources: [{ resourceId: 'uses', amount: 1 }] },
        targeting: { kind: 'single-creature', relation: 'any', includeSelf: true, rangeFeet: 30, requiresSight: true },
        mechanic: { kind: 'critical-hit-cancellation', protects: 'any' }, effects: [], automation: 'partial' }] })
  } })
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    actor.pluginFeatureIds = [...actor.pluginFeatureIds, `${ns}:strike`]
    actor.classResources['dnd5e-ki'].current = 3 + parentCost
    const target = { ...structuredClone(actor), id: 'target', initiative: 1, classId: 'cleric' as const, level: 6,
      subclassId: `${ns}:guardian`, classLevels: { cleric: 6 }, subclassIds: { cleric: `${ns}:guardian` },
      pluginFeatureIds: [guardId], classResources: { [guardResource]: { current: 1, max: 1 } } }
    const state = startDnd5eHeadlessCombat('luck-critical', [actor, target])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(actor.id, target.id)]: 5 }
    const before = JSON.stringify(state)
    const choices = { 'attack:target': { featureId: f.prompt().payload.featureId, rollId: 'paid', transactionId: 'cast',
      contextId: dnd5eActivityNegationContext('strike', 'cast', 'attack:target', actor.id) } }
    const rolls = { 'attack:target': { values: [20], modifier: 0, total: 20 }, damage: { values: [3, 5], modifier: 0, total: 8 } }
    for (const path of ['registered', 'compiled'] as const) {
      const select = vi.fn(() => ({ protectorId: target.id, featureId: guardId }))
      const run = (source = state) => withDnd5eCriticalCancellationCheckpoints(select, () => path === 'compiled'
        ? resolveDnd5eHeadlessAction(source, { type: 'plugin', pluginId: ns, actionId: 'strike', featureId: `${ns}:strike`,
          actorId: actor.id, targetId: target.id, transactionId: 'cast', rolls, disadvantageNegationChoices: choices })
        : resolveRegisteredDnd5eActivityInCombatV1({ state: source, combatRevision: 0,
          command: { schemaVersion: 1, commandId: 'cast', actorId: actor.id, packageId: ns, packageVersion: '1.0.0', activityId: 'strike', targetIds: [target.id], expectedRevision: 0 },
          authoritativeRolls: rolls, disadvantageNegationChoices: choices }).result)
      const result = run()
      expect(result.ok, path + ":" + JSON.stringify(result)).toBe(true)
      if (!('state' in result)) throw Error('No committed state')
      expect(result.state.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(1)
      expect(result.state.combatants[target.id].currentHp).toBe(target.currentHp - 3)
      expect(result.state.combatants[target.id].classResources[guardResource].current).toBe(0)
      expect(result.state.combatants[target.id].turn.reactionAvailable).toBe(false)
      expect(select).toHaveBeenCalledTimes(1)
      expect(JSON.stringify(state)).toBe(before)
      if (parentCost) {
        const poor = structuredClone(state)
        poor.combatants[actor.id].classResources['dnd5e-ki'].current = 3
        const poorBefore = JSON.stringify(poor)
        expect(run(poor).ok).toBe(false)
        expect(JSON.stringify(poor)).toBe(poorBefore)
        if (path === 'compiled') {
          const unqualified = structuredClone(state)
          Object.assign(unqualified.combatants[actor.id], { classId: 'fighter', classLevels: { fighter: 11 } })
          const result = resolveDnd5eHeadlessAction(unqualified, { type: 'plugin', pluginId: ns, actionId: 'strike', featureId: `${ns}:strike`,
            actorId: actor.id, targetId: target.id, transactionId: 'unqualified',
            rolls: { ...rolls, 'attack:target': { values: [20, 1], modifier: 0, total: 21 } } })
          expect(result.ok).toBe(false)
          expect(unqualified.combatants[actor.id].classResources['dnd5e-ki'].current).toBe(5)
        }
      }
    }
  } finally { dispose(); registration.dispose(); f.dispose() }
})


it('rejects generic Luck choices instead of losing their cost at native binding dispatch', () => {
  const f = fixture()
  const registration = registerDnd5eActivityPackage({ packageId: 'test.native-luck', packageVersion: '1.0.0', activities: [{
    schemaVersion: 1, id: 'bound', name: 'Bound', activation: { kind: 'free' }, target: { kind: 'self' },
    legacySource: { kind: 'subclass-ability', id: 'guardian:cancel' }, automation: automationCapabilityFromLegacyStatus('partial'),
    authorityBinding: { kind: 'declarative-subclass-mechanic', subclassId: 'guardian', abilityId: 'cancel',
      mechanicKind: 'critical-hit-cancellation', execution: 'plugin-headless-action', actionId: 'decl.guardian.cancel' },
    outcomes: [{ id: 'marker', when: { kind: 'always' }, operations: [{ id: 'mark', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 1 } }] }],
  }] })
  try {
    const character = normalizeCharacter(structuredClone(f.data().characters.characters[0]))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    const state = startDnd5eHeadlessCombat('native-binding', [actor])
    const before = JSON.stringify(state)
    const result = resolveAndCommitDnd5eActivityCommand(state, {
      command: { schemaVersion: 1, commandId: 'cast', actorId: actor.id, packageId: 'test.native-luck', packageVersion: '1.0.0',
        activityId: 'bound', targetIds: [actor.id], expectedRevision: 0 }, currentRevision: 0,
      actor: dnd5eActivityActorSnapshotFromCombatantV1(actor), targets: [dnd5eActivityActorSnapshotFromCombatantV1(actor)], authoritativeRolls: {},
      disadvantageNegationChoices: { save: { featureId: f.prompt().payload.featureId, rollId: 'paid', transactionId: 'cast',
        contextId: dnd5eActivityNegationContext('bound', 'cast', 'save', actor.id) } },
    })
    expect(result).toMatchObject({ phase: 'resolve', result: { ok: false, details: ['activity-negation-native-owner-required'] } })
    expect(JSON.stringify(state)).toBe(before)
  } finally { registration.dispose(); f.dispose() }
})
