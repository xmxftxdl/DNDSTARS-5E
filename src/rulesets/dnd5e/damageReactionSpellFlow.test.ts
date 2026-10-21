import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { resolveDnd5eActionWithDamageReactions, resolveDnd5eActionWithMaterialDamageReactions, resolveDnd5ePreparedWithMaterialDamageReactions, resolveDnd5eDamageBoundaryWithMaterials } from './damageReactionFlow'
import type { BattleMap } from '../../store/maps'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { applyDnd5eInventoryMutation } from './items'
import { dnd5eSpellMaterialConsumptionPlan, applyDnd5eSpellMaterialConsumption } from './spellMaterials'
import { reserveDnd5eSpellMaterials, dnd5eSpellMaterialEscrowBinding } from './spellMaterialEscrow'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eDamageCommitSession } from './damageCommitSession'
import { listDnd5ePersonalDamageCheckpointActivitiesV1 } from './activities/dnd5eActivityTriggerWindows'
import { planDnd5eMapResultApplication } from './mapBridge'
import { settleDnd5eConcentrationChecks } from '../../pages/maps/settleDnd5eCombatResult'
import { mergeDnd5eReactionMaterialsIntoMapPlan } from './damageReactionMaterialApplication'

it.each(['accept', 'decline', 'invalid-level', 'missing-level', 'silenced', 'stale', 'retained-material', 'consumed-material', 'missing-material', 'material-session', 'material-facade', 'material-facade-missing-application', 'material-facade-conflict', 'material-facade-stale', 'material-facade-failed', 'material-facade-nested', 'material-facade-direct', 'material-facade-concentration', 'material-facade-sequence', 'material-facade-main-cost', 'material-facade-main-exhausted', 'material-facade-main-escrow'] as const)('settles a selected reaction spell inside the damage transaction (%s)', async mode => {
  const packageId = 'test.reaction-spell-flow'
  const materialFacade = mode.startsWith('material-facade')
  const material = mode.endsWith('-material') || mode === 'material-session' || materialFacade
  const consumed = mode === 'consumed-material' || mode === 'material-session' || materialFacade
  const mainEscrow = mode === 'material-facade-main-escrow'
  const mainCost = mainEscrow || mode === 'material-facade-main-cost' || mode === 'material-facade-main-exhausted'
  const accepted = mode === 'accept' || mode === 'retained-material' || mode === 'material-session' || (materialFacade && mode !== 'material-facade-main-exhausted')
  const unavailable = mode === 'material-facade-main-exhausted' || mode === 'silenced' || mode === 'consumed-material' || mode === 'missing-material'
  let spellId = ''
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Synthetic', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    spellId = api.registerSpell({ id: 'ward', name: 'Synthetic ward', level: 1, school: 'abjuration', ritual: false,
      castingTime: { value: 1, unit: 'reaction', reactionTrigger: 'Synthetic damage.' }, range: { type: 'self' },
      components: { verbal: true, somatic: true, material, ...(material ? { materialText: 'Synthetic miniature worth 250 gp.', materialCostGp: 250, materialConsumed: consumed,
        materialRequirement: { label: 'Synthetic material', options: [{ label: 'Miniature', components: [{ tag: 'platinum-miniature-sword', label: 'Miniature', minimumUnitValueGp: 250, consumed }] }] } } : {}) }, duration: { type: 'instantaneous', concentration: false },
      classes: ['wizard'], description: 'Synthetic.', automation: { mode: 'reference-only' } })
  } })
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [{
    schemaVersion: 1, id: 'ward-cast', name: 'Ward', activation: { kind: 'reaction' }, target: { kind: 'self' },
    legacySource: { kind: 'spell', id: 'ward' }, invocation: { kind: 'triggered', event: 'before-damage', confirmation: 'actor-choice' },
    consumption: [{ kind: 'spell-slot', minimumLevel: 1, level: 'selected', amount: 1, consumeOn: 'resolve' }],
    outcomes: [{ id: 'ward', when: { kind: 'always' }, operations: [{ id: 'ward', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'dice', count: 1, sides: 4, rollId: 'ward-die' } }] }],
    scaling: [{ basis: 'slot-level', baseLevel: 1, adjustments: [{ operationId: 'ward', diceCountPerStep: 1 }] }],
    automation: automationCapabilityFromLegacyStatus('full'),
  }] })
  try {
    let character = normalizeCharacter({ id: 'character', name: 'Mage', charClass: '法师', level: 3,
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': [spellId] } } } } })
    if (material && mode !== 'missing-material') {
      const granted = applyDnd5eInventoryMutation([character], { type: 'grant', characterId: character.id, templateId: 'srd-5.1:item:platinum-miniature-sword-250gp', quantity: mode === 'material-facade-main-cost' || mainEscrow ? 2 : 1 })
      expect(granted.ok).toBe(true)
      character = granted.characters[0]
    }
    const beforeCharacter = structuredClone(character)
    const actor = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative,
      classId: 'wizard', level: 3, classLevels: { wizard: 3 }, abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 12, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    const state = startDnd5eHeadlessCombat('reaction-slots', [actor('attacker', 20), actor('defender', 10)])
    const defender = state.combatants.defender
    defender.classSelections = { 'spell-prepared': [spellId] }
    defender.classResources = { 'dnd5e-spell-slot-1': { current: 2, max: 2 }, 'dnd5e-spell-slot-2': { current: 1, max: 1 } }
    if (mode === 'material-facade-concentration') {
      defender.concentrating = true
      defender.classState.concentrationSpellId = 'bless'
    }
    if (mode === 'silenced') defender.soundSuppressed = true
    const before = structuredClone(state)
    let valid = true, confirmations = 0, rolls = 0
    if (mode === 'material-session') {
      const action = { type: 'attack' as const, actorId: 'attacker', targetId: 'defender', d20: 18, attackModifier: 4, damage: { count: 1, sides: 6, bonus: 0, rolls: [6], type: 'fire' as const } }
      const session = createDnd5eDamageCommitSession(state, action, (checkpoint, snapshot, characters) => !!snapshot &&
        listDnd5ePersonalDamageCheckpointActivitiesV1({ state: snapshot, checkpoint, eventBatchId: 'discovery', character: characters?.defender, allowMaterialWrites: true }).length > 0,
        undefined, { defender: character })
      const pending = session.run(state)
      expect(pending.status).toBe('pending')
      if (pending.status !== 'pending') throw new Error('Missing material checkpoint')
      expect(pending.charactersByCombatantId?.defender).toEqual(character)
      const completed = session.accept(state, pending.checkpoint, { combatRevision: 1, confirmedBy: 'actor', actorCharacter: character,
        authoritativeRolls: { 'ward-die': { values: [2, 2] } }, command: { schemaVersion: 1, commandId: 'ward', actorId: 'defender', packageId,
          packageVersion: '1.0.0', activityId: 'ward-cast', targetIds: ['defender'], expectedRevision: 1, triggerEventId: pending.triggerEventId, castLevel: 2 } })
      expect(completed.status, JSON.stringify(completed)).toBe('resolved')
      if (completed.status !== 'resolved') throw new Error('Material replay failed')
      expect(completed.result.ok).toBe(true)
      expect(completed.result.state.combatants.defender.currentHp).toBe(18)
      expect(completed.result.state.combatants.defender.classResources['dnd5e-spell-slot-2'].current).toBe(0)
      expect(completed.materialChanges).toHaveLength(1)
      const change = completed.materialChanges![0]
      expect(change.expectedInventoryRevision).toBe(character.dnd5eInventory!.revision)
      expect(change.inventory!.entries.some(entry => entry.templateId === 'srd-5.1:item:platinum-miniature-sword-250gp')).toBe(false)
      expect(session.run(state)).toMatchObject({ status: 'rejected', reason: 'session-ended' })
      expect(state).toEqual(before)
      expect(character).toEqual(beforeCharacter)
      return
    }
          const map: BattleMap = { id: 'map', name: 'Synthetic material transaction', width: 100, height: 100,
            gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
            tokens: [{ id: 'defender', label: 'Mage', characterId: character.id, type: 'player', x: 0, y: 0,
              color: '', emoji: '', size: 1, hp: 20, maxHp: 20 },
              { id: 'attacker', label: 'Attacker', type: 'enemy', x: 0, y: 0,
                color: '', emoji: '', size: 1, hp: 20, maxHp: 20 }] }
    const run = materialFacade
      ? async (options: Parameters<typeof resolveDnd5eActionWithDamageReactions>[0]) => {
        const primaryPlan = mainCost ? dnd5eSpellMaterialConsumptionPlan(character, { label: 'Primary cost', options: [{ label: 'Miniature', components: [{ tag: 'platinum-miniature-sword', label: 'Miniature', quantity: 1, consumed: true }] }] })! : undefined
        if (mainEscrow && primaryPlan) primaryPlan.consumptionTiming = 'spell-end'
        const binding = dnd5eSpellMaterialEscrowBinding('primary-cast', 'synthetic-primary')
        const input = { prepared: { state, actor: character, characters: [character], spellMaterialPlan: primaryPlan, action: { id: binding.id }, spell: { id: binding.sourceSpellId } }, action: options.action }
        const resolve = (input: { prepared: { state: typeof state }; action: typeof options.action }) => {
          const result = resolveDnd5eHeadlessAction(input.prepared.state, input.action)
          if (mode === 'material-facade-failed' && result.state.combatants.defender.turn.reactionAvailable === false) {
            return { result: { ...result, ok: false as const, reason: 'synthetic-downstream-failure' }, application: undefined }
          }
          if (mode === 'material-facade-missing-application') return { result, application: undefined }
          const primary = primaryPlan ? (mainEscrow ? reserveDnd5eSpellMaterials(character, primaryPlan, binding) : applyDnd5eSpellMaterialConsumption(character, primaryPlan)) : undefined
          if (mainEscrow && result.ok) {
            const target = result.state.combatants.defender
            target.classState.activeEffects = [...(target.classState.activeEffects ?? []), createDnd5eMechanicalEffect({
              id: binding.sourceEffectId, definitionId: 'synthetic-primary-material', label: 'Primary lifetime', targetId: target.id,
              source: { kind: 'spell', actorId: target.id, rulesId: binding.sourceSpellId }, duration: { type: 'rounds', remainingRounds: 1, tickOn: 'source-turn-end' },
            })]
          }
          if (primary && !primary.ok) throw new Error('Synthetic primary cost failed')
          const applicationCharacter = structuredClone(primary?.ok ? primary.character : character)
          if (mode === 'material-facade-conflict') applicationCharacter.dnd5eInventory!.revision = (applicationCharacter.dnd5eInventory!.revision ?? 0) + 1
          return { result, application: planDnd5eMapResultApplication({ state: result.state, map,
            characters: [applicationCharacter], baselineCharacters: [character], characterIdByCombatantId: { defender: character.id }, events: [...result.events] }) }
        }
        const settled = mode === 'material-facade-direct' || mode === 'material-facade-concentration' || mode === 'material-facade-sequence'
          ? await resolveDnd5eActionWithMaterialDamageReactions(options, { map, characters: [character], characterIdByCombatantId: { defender: character.id } }).then(result => ({ result, application: result.application }))
          : mode === 'material-facade-nested'
          ? await resolveDnd5eDamageBoundaryWithMaterials(options, state, snapshot => resolve({ ...input, prepared: { state: snapshot } }), value => value.result.ok)
            .then(({ result, materialChanges }) => ({ ...result, application: mergeDnd5eReactionMaterialsIntoMapPlan(result.application!, materialChanges) }))
          : await resolveDnd5ePreparedWithMaterialDamageReactions(options, input, resolve)
        if (mode === 'material-facade-failed') {
          expect(settled.result.ok).toBe(false)
          expect(settled.application).toBeUndefined()
          return settled.result
        }
        expect(settled.application!.characters[0].dnd5eInventory!.entries.some(entry => entry.templateId === 'srd-5.1:item:platinum-miniature-sword-250gp')).toBe(false)
        expect(settled.application!.characters[0].currentHp).toBe(accepted ? 18 : 14)
        expect(settled.application!.characters[0].classResources!['dnd5e-spell-slot-2'].current).toBe(accepted ? 0 : 1)
        expect(settled.application!.tokenPatches?.defender.hp).toBe(accepted ? 18 : 14)
        expect(settled.application!.characterPatches?.character).toMatchObject({ currentHp: accepted ? 18 : 14,
          classResources: { 'dnd5e-spell-slot-2': { current: accepted ? 0 : 1 } }, dnd5eInventory: settled.application!.characters[0].dnd5eInventory })
        if (mainCost) expect(settled.application!.characters[0].dnd5eInventory!.revision).toBe((character.dnd5eInventory!.revision ?? 0) + (accepted ? 2 : 1))
        if (mainEscrow) {
          const reserved = settled.application!.characters[0].dnd5eInventory!.spellMaterialEscrows![0]
          expect(reserved).toMatchObject({ status: 'reserved', sourceEffectId: binding.sourceEffectId })
          expect(reserved.entries).toHaveLength(1)
          expect(reserved.entries[0].quantity).toBe(1)
          const nextTurn = resolveDnd5eHeadlessAction(settled.result.state, { type: 'end-turn', actorId: 'attacker' })
          expect(nextTurn.ok).toBe(true)
          const ended = resolveDnd5eHeadlessAction(nextTurn.state, { type: 'end-turn', actorId: 'defender' })
          expect(ended.ok).toBe(true)
          const final = planDnd5eMapResultApplication({ state: ended.state, map: settled.application!.map,
            characters: settled.application!.characters, characterIdByCombatantId: { defender: character.id }, events: [...ended.events] })
          expect(final.characters[0].dnd5eInventory!.spellMaterialEscrows![0]).toMatchObject({ status: 'consumed', entries: [] })
          expect(final.characters[0].dnd5eInventory!.revision).toBe((character.dnd5eInventory!.revision ?? 0) + 3)
          expect(final.characterPatches?.character.dnd5eInventory).toEqual(final.characters[0].dnd5eInventory)
          const restored = JSON.parse(JSON.stringify(final)) as typeof final
          const replay = planDnd5eMapResultApplication({ state: ended.state, map: restored.map, characters: restored.characters,
            characterIdByCombatantId: { defender: character.id } })
          expect(replay.characters[0].dnd5eInventory).toEqual(final.characters[0].dnd5eInventory)
        }
        if (mode === 'material-facade-sequence') {
          // Reset combat eligibility to isolate inventory authority from reaction economy.
          const next = await resolveDnd5eActionWithMaterialDamageReactions({ ...options, state: structuredClone(before),
            confirm: async () => { throw new Error('Consumed material must not be offered again') },
            roll: async () => { throw new Error('Unavailable material must not roll') },
          }, { map: settled.application!.map, characters: settled.application!.characters, characterIdByCombatantId: { defender: character.id } })
          expect(next.ok).toBe(true)
          expect(next.state.combatants.defender.currentHp).toBe(14)
          expect(next.application!.characters[0].dnd5eInventory).toEqual(settled.application!.characters[0].dnd5eInventory)
        }
        if (mode === 'material-facade-concentration') {
          if (!settled.result.ok) throw new Error('Expected direct action success')
          const followed = await settleDnd5eConcentrationChecks({ result: settled.result,
            map: settled.application!.map, characters: settled.application!.characters, priorApplication: settled.application,
            characterIdByCombatantId: { defender: character.id }, rollD20: async () => 1, rollD4: async () => 1, rollDice: async count => Array(count).fill(1) })
          expect(followed.result.state.combatants.defender.concentrating).toBe(false)
          expect(followed.application.characterPatches?.character.dnd5eInventory).toEqual(settled.application!.characters[0].dnd5eInventory)
          expect(followed.application.characterPatches?.character.dnd5eCombatState).toEqual(followed.application.characters[0].dnd5eCombatState)
          expect(followed.application.changedCharacterIds).toContain(character.id)
        }
        return settled.result
      } : resolveDnd5eActionWithDamageReactions
    const promise = run({ state, combatRevision: 1, charactersByCombatantId: { defender: character },
      action: { type: 'attack', actorId: 'attacker', targetId: 'defender', d20: 18, attackModifier: 4, damage: { count: 1, sides: 6, bonus: 0, rolls: [6], type: 'fire' } },
      authorityUnchanged: () => valid,
      confirm: async request => {
        confirmations++
        expect(request.availableCastLevels).toEqual([1, 2])
        if (mode === 'stale' || mode === 'material-facade-stale') valid = false
        return { accepted: mode !== 'decline', castLevel: mode === 'invalid-level' ? 9 : mode === 'missing-level' ? undefined : 2 }
      },
      roll: async request => { rolls++; expect(request.count).toBe(2); expect(request.sides).toBe(4); return [2, 2] },
    })
    if (mode === 'invalid-level' || mode === 'missing-level') await expect(promise).rejects.toThrow('invalid-slot-choice')
    else if (mode === 'stale' || mode === 'material-facade-stale') await expect(promise).rejects.toThrow('stale-authority')
    else if (mode === 'material-facade-missing-application') await expect(promise).rejects.toThrow('material-application-required')
    else if (mode === 'material-facade-conflict') await expect(promise).rejects.toThrow('material-application-conflict')
    else if (mode === 'material-facade-failed') expect((await promise).ok).toBe(false)
    else {
      const result = await promise
      expect(result.ok, JSON.stringify(result)).toBe(true)
      expect(result.state.combatants.defender.currentHp).toBe(accepted ? 18 : 14)
      expect(result.state.combatants.defender.classResources['dnd5e-spell-slot-2'].current).toBe(accepted ? 0 : 1)
      expect(result.state.combatants.defender.classResources['dnd5e-spell-slot-1'].current).toBe(2)
      expect(result.state.combatants.defender.turn.reactionAvailable).toBe(!accepted)
    }
    expect(confirmations).toBe(unavailable ? 0 : 1)
    expect(rolls).toBe(accepted && mode !== 'material-facade-stale' ? 1 : 0)
    expect(state).toEqual(before)
    expect(character).toEqual(beforeCharacter)
  } finally { registration.dispose(); dispose() }
})
