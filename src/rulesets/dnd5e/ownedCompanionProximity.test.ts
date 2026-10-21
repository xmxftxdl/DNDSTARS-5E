import { settleDnd5eSummonActivityCapability } from './activities/dnd5eSummonActivitySettlement'
import { createDnd5eMapCombatSnapshot } from './mapBridge'
import { dnd5eHeadlessMaximizeHealingDice } from './headlessCompanionHealing'
import { resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInventoryMutation } from './items'
import { resolveDnd5eShortRestHitDice } from './hitPoints'
import { resolveDnd5eAuthoritativeItemUse } from '../../application/combat/dnd5eItemUseCoordinator'
import { createCombatTransaction } from '../../lib/combatTransaction'
import { createDnd5eMechanicalEffect, dnd5eActiveMaximizeHealingDice, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import { dnd5eNearbyOwnedCompanions, validDnd5eOwnedCompanionProximity } from './ownedCompanionProximity'

function fixture() {
  const owner: Token = { id: 'owner', characterId: 'hero', label: 'Owner', type: 'player', x: 25, y: 25, size: 1, hp: 0, maxHp: 20, color: '', emoji: '' }
  const companion: Token = { ...owner, id: 'companion', characterId: undefined, type: 'npc', hp: 1, maxHp: 1, x: 1025,
    dnd5eSummon: { schemaVersion: 1, pluginId: 'test.companions', featureId: 'summon', sourceCharacterId: 'hero',
      sourceTokenId: owner.id, side: 'player', createdRound: 1, expiresAfterRound: 10, persistent: true, bondKey: 'familiar' } }
  const map: BattleMap = { id: 'proximity', name: 'Proximity', width: 2000, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [owner, companion] }
  const query = { maximumDistanceFeet: 100, bondKey: 'familiar', source: { packageId: 'test.companions', activityId: 'summon' } }
  const input = { map, ownerTokenId: owner.id, query, round: 1, geometry: null }
  return { map, owner, companion, input }
}

it('reads live map distance without an initiative slot or a persisted capability flag', () => {
  const { input, companion } = fixture()
  expect(dnd5eNearbyOwnedCompanions(input).map(t => t.id)).toEqual(['companion'])
  companion.x += 50
  expect(dnd5eNearbyOwnedCompanions(input)).toEqual([])
  companion.x -= 50
  expect(dnd5eNearbyOwnedCompanions(JSON.parse(JSON.stringify(input)))).toHaveLength(1)
  input.map.tokens = input.map.tokens.filter(t => t.id !== companion.id)
  expect(dnd5eNearbyOwnedCompanions(input)).toEqual([])
})

it.each(['other-owner', 'other-character', 'other-package', 'other-activity', 'other-bond', 'dismissed', 'control-ended', 'dead', 'unknown-hp', 'expired', 'missing-owner'] as const)(
  'does not count unavailable or mismatched companion: %s', change => {
    const { input, companion } = fixture()
    const summon = companion.dnd5eSummon!
    if (change === 'other-owner') summon.sourceTokenId = 'someone-else'
    if (change === 'other-character') summon.sourceCharacterId = 'other-character'
    if (change === 'other-package') summon.pluginId = 'other.package'
    if (change === 'other-activity') summon.featureId = 'other-summon'
    if (change === 'other-bond') summon.bondKey = 'steed'
    if (change === 'dismissed') summon.dismissed = true
    if (change === 'control-ended') summon.controlEnded = true
    if (change === 'dead') companion.hp = 0
    if (change === 'unknown-hp') companion.hp = undefined
    if (change === 'expired') { summon.persistent = undefined; input.round = 11 }
    if (change === 'missing-owner') input.ownerTokenId = 'absent'
    expect(dnd5eNearbyOwnedCompanions(input)).toEqual([])
  },
)

it('uses height but does not invent sight or cover requirements', () => {
  const { input, companion } = fixture()
  companion.x = 25
  companion.elevationFeet = 106
  expect(dnd5eNearbyOwnedCompanions(input)).toEqual([])
  companion.elevationFeet = 0
  companion.x = 75
  const geometry = createEmptyMapGeometry(input.map.id, 1)
  geometry.walls = [{ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 50, y: 0 }, { x: 50, y: 500 }],
    blocksVision: true, blocksLineOfEffect: true, blocksMovement: true, baseHeightFeet: 0, heightFeet: 20, createdAt: 1 }]
  expect(dnd5eNearbyOwnedCompanions({ ...input, geometry })).toHaveLength(1)
})

it('fails closed on missing campaign time and expires control at its deadline', () => {
  const { input, companion } = fixture()
  companion.dnd5eSummon!.controlExpiresAtWorldMinute = 100
  expect(dnd5eNearbyOwnedCompanions(input)).toEqual([])
  expect(dnd5eNearbyOwnedCompanions({ ...input, worldMinute: 99 })).toHaveLength(1)
  expect(dnd5eNearbyOwnedCompanions({ ...input, worldMinute: 100 })).toEqual([])
})

it.each([{}, { maximumDistanceFeet: 100 }, { maximumDistanceFeet: NaN, bondKey: 'familiar' },
  { maximumDistanceFeet: -1, bondKey: 'familiar' }, { maximumDistanceFeet: 100, source: null },
  { maximumDistanceFeet: 100, source: { packageId: 'test' } }])('rejects incomplete query %j', query => {
  expect(validDnd5eOwnedCompanionProximity(query)).toBe(false)
})

it('compiles and reloads a conditional healing effect without granting unconditional maximum dice', () => {
  const { input, companion } = fixture()
  const actor = { id: 'owner', controller: 'players' as const, level: 5, proficiencyBonus: 3,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    armorClass: 10, currentHp: 1, maxHp: 20, conditions: [] }
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'conditional-healing', name: 'Conditional healing',
    activation: { kind: 'free' }, target: { kind: 'self' }, automation: automationCapabilityFromLegacyStatus('full'),
    effects: [{ schemaVersion: 1, id: 'maximum', name: 'Maximum', duration: { kind: 'permanent' }, stacking: 'replace',
      modifiers: [{ kind: 'maximize-healing-dice', whenOwnedCompanionWithin: input.query }] }],
    outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'maximum' }] }] }
  const result = resolveDnd5eActivity({ activity, actor, targets: [actor], rolls: {} })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) throw Error('compile failed')
  const proposal = result.proposals.find(p => p.kind === 'apply-effect')
  if (!proposal || proposal.kind !== 'apply-effect') throw Error('missing effect')
  expect(proposal.modifierGroups[0].maximizeHealingDice).not.toBe(true)
  const effect = createDnd5eMechanicalEffect({ definitionId: 'test:conditional', label: 'Conditional',
    source: { kind: 'plugin' }, targetId: actor.id, modifiers: proposal.modifierGroups[0] })
  const restored = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect])))
  expect(restored[0].modifiers?.maximizeHealingDiceNearCompanion).toEqual([input.query])
  expect(dnd5eActiveMaximizeHealingDice(restored)).toBe(false)
  expect(dnd5eActiveMaximizeHealingDice(restored, input)).toBe(true)
  companion.x += 50
  expect(dnd5eActiveMaximizeHealingDice(restored, input)).toBe(false)
  companion.x -= 50
  expect(dnd5eActiveMaximizeHealingDice(restored, input)).toBe(true)
  expect(dnd5eActiveMaximizeHealingDice([{ ...restored[0], suspendedBy: ['antimagic'] }], input)).toBe(false)
  expect(effect.modifiers?.maximizeHealingDiceNearCompanion?.[0].source).not.toBe(input.query.source)
  for (const invalid of [null, [], [{}], [{ ...input.query, maximumDistanceFeet: -1 }]]) {
    expect(validateDnd5eActiveEffectsStrict([{ ...effect, modifiers: { maximizeHealingDiceNearCompanion: invalid } }]).ok).toBe(false)
  }
  const invalidActivity = structuredClone(activity)
  Object.assign(invalidActivity.effects![0].modifiers![0], { whenOwnedCompanionWithin: { maximumDistanceFeet: 100 } })
  expect(resolveDnd5eActivity({ activity: invalidActivity, actor, targets: [actor], rolls: {} }).ok).toBe(false)
})

it.each(['near', 'far', 'healer-context', 'missing-context', 'dismissed'] as const)(
  'settles recipient-bound companion healing through Host potion and short-rest APIs: %s', mode => {
    const { input, companion } = fixture()
    const hero = normalizeCharacter({ id: 'hero', name: 'Hero', rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '战士', currentHp: 1, maxHp: 100, abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      hitPointDice: [{ sides: 10, current: 1, max: 1 }],
      dnd5eCombatState: { activeEffects: [createDnd5eMechanicalEffect({ definitionId: 'conditional-maximum',
        label: 'Conditional maximum', targetId: 'hero', source: { kind: 'plugin' },
        modifiers: { maximizeHealingDiceNearCompanion: [input.query] } })] } })
    const healer = normalizeCharacter({ id: 'healer', name: 'Healer', charClass: '战士' })
    if (mode === 'far') companion.x += 50
    if (mode === 'dismissed') companion.dnd5eSummon!.dismissed = true
    if (mode === 'healer-context') {
      input.map.tokens[0].characterId = healer.id
      companion.dnd5eSummon!.sourceCharacterId = healer.id
    }
    const healingContext = mode === 'missing-context' ? undefined : input
    const granted = applyDnd5eInventoryMutation([healer, hero], {
      type: 'grant', characterId: healer.id, templateId: 'srd-5.1:item:potion-of-healing', quantity: 1,
    })
    const entry = granted.characters[0].dnd5eInventory!.entries.find(entry => entry.templateId === 'srd-5.1:item:potion-of-healing')!
    const result = resolveDnd5eAuthoritativeItemUse({ characters: granted.characters, sourceCharacterId: healer.id,
      targetCharacterId: hero.id, instanceId: entry.instanceId, healingRolls: [1, 2], healingContext,
      transaction: createCombatTransaction({ id: 'companion-healing', mapId: input.map.id, combatId: 'combat',
        actorId: healer.id, actionId: 'potion', actionKind: 'item-use', now: 1 }) })
    expect(result, JSON.stringify(result)).toMatchObject({ ok: true })
    if (!result.ok) return
    expect(result.target.currentHp).toBe(mode === 'near' ? 11 : 6)
    expect(result.transaction?.rollLedger.entries).toContainEqual(expect.objectContaining({ kind: 'healing',
      dice: { sides: 4, values: mode === 'near' ? [4, 4] : [1, 2] } }))
    const rest = resolveDnd5eShortRestHitDice({ character: hero, spends: [{ poolIndex: 0, rolls: [1] }],
      songOfRest: { dieSides: 6, roll: 1 }, healingContext })
    expect(rest.character.currentHp).toBe(mode === 'near' ? 19 : 5)
    expect(hero.currentHp).toBe(1)
  },
)



it('captures non-initiative companions and recomputes healing after transaction movement and map reload', () => {
  const { input, owner, companion } = fixture()
  const hero = normalizeCharacter({ id: 'hero', name: 'Hero', rulesetId: 'dnd5e-2014-srd-5.1',
    charClass: '战士', level: 3, currentHp: 1, maxHp: 100,
    classResources: { fighterSecondWind: { current: 1, max: 1 } },
    dnd5eCombatState: { activeEffects: [createDnd5eMechanicalEffect({ definitionId: 'conditional-maximum',
      label: 'Conditional maximum', targetId: 'hero', source: { kind: 'plugin' },
      modifiers: { maximizeHealingDiceNearCompanion: [input.query] } })] } })
  const projection = { map: input.map, characters: [hero], combatId: 'companion-map', round: 1,
    geometry: null, worldMinute: 99, initiativeOrder: [{ tokenId: owner.id, label: 'Owner', roll: 10, emoji: '', color: '' }] }
  const { state } = createDnd5eMapCombatSnapshot(projection)
  const body = state.combatants[owner.id]
  expect(state.combatants[companion.id]).toBeUndefined()
  expect(dnd5eHeadlessMaximizeHealingDice(state, body)).toBe(true)
  expect(dnd5eActivityActorSnapshotFromCombatantV1(body, body, state).maximizeHealingDice).toBe(true)
  const healed = resolveDnd5eHeadlessAction(state, { type: 'fighter-second-wind', actorId: body.id, resourceKey: 'fighterSecondWind', d10: 1 })
  expect(healed.ok, JSON.stringify(healed)).toBe(true)
  if (healed.ok) expect(healed.state.combatants[body.id].currentHp).toBe(14)
  expect(body.currentHp).toBe(1)
  body.position.x -= 100
  expect(dnd5eHeadlessMaximizeHealingDice(state, body)).toBe(false)
  body.position.x += 100
  const restored = JSON.parse(JSON.stringify(state))
  expect(dnd5eHeadlessMaximizeHealingDice(restored, restored.combatants[body.id])).toBe(true)
  companion.dnd5eSummon!.dismissed = true
  const refreshed = createDnd5eMapCombatSnapshot(projection).state
  expect(dnd5eHeadlessMaximizeHealingDice(refreshed, refreshed.combatants[body.id])).toBe(false)
  // Published map updates do not mutate an already captured transaction.
  expect(dnd5eHeadlessMaximizeHealingDice(state, body)).toBe(true)
  delete companion.dnd5eSummon!.dismissed
  const inCombat = createDnd5eMapCombatSnapshot({ ...projection, initiativeOrder: [...projection.initiativeOrder,
    { tokenId: companion.id, label: 'Companion', roll: 1, emoji: '', color: '' }] }).state
  const pet = inCombat.combatants[companion.id]
  expect(pet).toBeDefined()
  expect(dnd5eHeadlessMaximizeHealingDice(inCombat, inCombat.combatants[body.id])).toBe(true)
  pet.currentHp = 0
  expect(dnd5eHeadlessMaximizeHealingDice(inCombat, inCombat.combatants[body.id])).toBe(false)
  pet.currentHp = 1
  pet.summonedSourceCombatantId = undefined
  expect(dnd5eHeadlessMaximizeHealingDice(inCombat, inCombat.combatants[body.id])).toBe(false)
  body.classState.activeEffects!.push(createDnd5eMechanicalEffect({ definitionId: 'summon-bond:familiar',
    label: 'Bond', targetId: body.id, source: { kind: 'plugin', pluginId: 'test.companions' } }))
  const dismissed = structuredClone(state)
  expect(settleDnd5eSummonActivityCapability(dismissed, dismissed.combatants[body.id], {
    kind: 'dismiss-owned-summon', operationId: 'dismiss', bondKey: 'familiar', releaseBond: false,
  }, 'dismiss', [], 'test.companions')).toBe(true)
  expect(dnd5eHeadlessMaximizeHealingDice(dismissed, dismissed.combatants[body.id])).toBe(false)
  expect(dnd5eHeadlessMaximizeHealingDice(state, body)).toBe(true)
})
