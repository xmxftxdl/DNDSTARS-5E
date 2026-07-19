import { describe, expect, it } from 'vitest'
import type { Dnd5eClassFeaturePayload, SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { prepareDnd5eClassFeature, previewDnd5eMonkBonusAttack, resolvePreparedDnd5eClassFeature } from './classFeatureAction'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { dnd5eConditionsFromActiveEffects } from './activeEffects'
import { migrateLegacyDnd5eConditions } from './legacyActiveEffectMigration'

function character(id: string, charClass: string, patch: Partial<Character> = {}): Character {
  const result: Character = {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id,
    name: id,
    player: '',
    avatar: '',
    accent: '',
    race: '人类',
    charClass,
    level: 6,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 14, cha: 16 },
    savingThrows: [],
    skills: [],
    maxHp: 30,
    currentHp: 20,
    tempHp: 0,
    hitDice: '6d8',
    ac: 14,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 14,
    passivePerception: 12,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...patch,
  }
  if (result.conditions.length > 0 && !result.dnd5eCombatState?.activeEffects?.length) {
    const activeEffects = migrateLegacyDnd5eConditions({ targetId: id, conditions: result.conditions })
    result.conditions = dnd5eConditionsFromActiveEffects(activeEffects)
    result.dnd5eCombatState = { ...result.dnd5eCombatState, schemaVersion: 2, activeEffects }
  }
  return result
}

function token(id: string, characterId: string, x: number): Token {
  return { id, label: id, x, y: 25, color: '', emoji: '', size: 1, type: 'player', characterId }
}

function fixture(actor: Character, payload: Dnd5eClassFeaturePayload, allies: Character[] = [], allyXs: number[] = []) {
  const actorToken = token(`${actor.id}-token`, actor.id, 25)
  const allyTokens = allies.map((ally, index) => token(`${ally.id}-token`, ally.id, allyXs[index] ?? 75 + index * 50))
  const enemyToken: Token = {
    id: 'enemy-token', label: '敌人', x: 925, y: 425, color: '', emoji: '', size: 1,
    type: 'enemy', hp: 10, maxHp: 10,
  }
  const map: BattleMap = {
    id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
    tokens: [actorToken, ...allyTokens, enemyToken],
  }
  const action: SharedPlayerActionState = {
    id: 'action', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending',
    type: 'dnd5e-class-feature', actorTokenId: actorToken.id, characterId: actor.id,
    dnd5eClassFeature: payload, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
  }
  const initiativeOrder = [actorToken, ...allyTokens, enemyToken].map((entry, index) => ({
    tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
  }))
  return { action, map, characters: [actor, ...allies], initiativeOrder, turnEconomy: createDnd5eTurnEconomyCounts('turn') }
}

describe('D&D 5e generic class feature authority bridge', () => {
  it('persists Barbarian Rage through the map bridge without changing AP', () => {
    const actor = character('barbarian', '野蛮人', {
      hitDice: '6d12',
      classResources: { 'dnd5e-rage': { current: 2, max: 2 } },
    })
    const input = fixture(actor, { feature: 'barbarian-rage' })
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0]).toMatchObject({
      classResources: { 'dnd5e-rage': { current: 1, max: 2 } },
      dnd5eCombatState: { raging: true, rageTurnsRemaining: 10 },
    })
  })

  it('allows a Berserker to enter a Frenzy and records its starting turn', () => {
    const actor = character('barbarian', '野蛮人', {
      level: 3,
      dnd5eClassChoices: { classes: { barbarian: { subclass: 'berserker' } } },
      classResources: { 'dnd5e-rage': { current: 2, max: 2 } },
    })
    const prepared = prepareDnd5eClassFeature(fixture(actor, { feature: 'barbarian-rage', frenzy: true }))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].dnd5eCombatState).toMatchObject({
      raging: true,
      frenzying: true,
      frenzyStartedTurnKey: 'combat:1:barbarian-token',
    })
  })

  it('routes voluntary Rage ending through the map bridge as a bonus action', () => {
    const actor = character('barbarian', '野蛮人', {
      level: 3,
      dnd5eClassChoices: { classes: { barbarian: { subclass: 'berserker' } } },
      dnd5eCombatState: { raging: true, rageTurnsRemaining: 8, frenzying: true },
      exhaustionLevel: 0,
    })
    const prepared = prepareDnd5eClassFeature(fixture(actor, { feature: 'barbarian-rage', end: true }))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0]).toMatchObject({
      exhaustionLevel: 1,
      dnd5eCombatState: { schemaVersion: 2 },
    })
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'barbarian-token', resource: 'bonusAction',
    })
  })

  it('prepares and persists Berserker Intimidating Presence against a target within 30 feet', () => {
    const actor = character('barbarian', '野蛮人', {
      level: 10,
      dnd5eClassChoices: { classes: { barbarian: { subclass: 'berserker' } } },
    })
    const input = fixture(actor, {
      feature: 'barbarian-intimidating-presence', targetTokenId: 'enemy-token',
    })
    input.map.tokens.find((entry) => entry.id === 'enemy-token')!.x = 75
    input.map.tokens.find((entry) => entry.id === 'enemy-token')!.y = 25
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.intimidatingPresence).toMatchObject({
      targetName: '敌人', saveDc: 15, saveModifier: 0, saveMode: 'normal', extending: false,
    })
    const resolved = resolvePreparedDnd5eClassFeature({
      prepared: prepared.prepared, savingThrowD20: 2,
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'enemy-token')?.dnd5eCombatState).toMatchObject({
      intimidatingPresenceSourceId: 'barbarian-token',
      intimidatingPresenceRoundsRemaining: 2,
      conditions: ['frightened'],
    })
  })

  it('grants Bardic Inspiration to another character within 60 feet and persists the die', () => {
    const bard = character('bard', '吟游诗人', {
      level: 10,
      classResources: { 'dnd5e-bardic-inspiration': { current: 3, max: 3 } },
    })
    const ally = character('ally', '战士')
    const input = fixture(bard, { feature: 'bardic-inspiration', targetTokenId: 'ally-token' }, [ally], [575])
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters.find((entry) => entry.id === ally.id)?.dnd5eCombatState).toMatchObject({
      bardicInspirationDie: 10,
      bardicInspirationSourceId: 'bard-token',
    })
  })

  it('rejects Bardic Inspiration beyond 60 feet before Headless settlement', () => {
    const bard = character('bard', '吟游诗人', {
      classResources: { 'dnd5e-bardic-inspiration': { current: 3, max: 3 } },
    })
    const ally = character('ally', '战士')
    const input = fixture(bard, { feature: 'bardic-inspiration', targetTokenId: 'ally-token' }, [ally], [675])
    expect(prepareDnd5eClassFeature(input)).toEqual({ ok: false, reason: 'target-out-of-range' })
  })

  it('starts and persists level-six Countercharm through the class-feature authority bridge', () => {
    const bard = character('bard', '吟游诗人', { level: 6 })
    const prepared = prepareDnd5eClassFeature(fixture(bard, { feature: 'bard-countercharm' }))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].dnd5eCombatState?.countercharmRoundsRemaining).toBe(2)
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'bard-token', resource: 'action',
    })
  })

  it('persists Bardic Inspiration on an unlinked creature token', () => {
    const bard = character('bard', '吟游诗人', {
      classResources: { 'dnd5e-bardic-inspiration': { current: 3, max: 3 } },
    })
    const input = fixture(bard, { feature: 'bardic-inspiration', targetTokenId: 'enemy-token' })
    const enemy = input.map.tokens.find((entry) => entry.id === 'enemy-token')!
    enemy.x = 75
    enemy.y = 25
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.dnd5eCombatState).toMatchObject({
      bardicInspirationDie: 8,
      bardicInspirationSourceId: 'bard-token',
    })
  })

  it('settles Lay on Hands healing and its action/pool through the authority bridge', () => {
    const paladin = character('paladin', '圣武士', {
      classResources: { 'dnd5e-lay-on-hands': { current: 30, max: 30 } },
    })
    const ally = character('ally', '战士', { currentHp: 5 })
    const input = fixture(paladin, { feature: 'paladin-lay-on-hands', targetTokenId: 'ally-token', amount: 12 }, [ally], [75])
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.application?.characters.find((entry) => entry.id === ally.id)?.currentHp).toBe(17)
    expect(resolved.application?.characters.find((entry) => entry.id === paladin.id)?.classResources?.['dnd5e-lay-on-hands']).toEqual({ current: 18, max: 30 })
  })

  it('routes Lay on Hands disease curing through the authority bridge', () => {
    const paladin = character('paladin', '圣武士', {
      classResources: { 'dnd5e-lay-on-hands': { current: 10, max: 30 } },
    })
    const ally = character('ally', '战士', { conditions: ['疾病'] })
    const prepared = prepareDnd5eClassFeature(fixture(
      paladin,
      { feature: 'paladin-lay-on-hands', targetTokenId: 'ally-token', cure: 'disease' },
      [ally],
      [75],
    ))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters.find((entry) => entry.id === ally.id)?.conditions).toEqual([])
    expect(resolved.application?.characters.find((entry) => entry.id === paladin.id)?.classResources?.['dnd5e-lay-on-hands']).toEqual({ current: 5, max: 30 })
  })

  it('uses Cleansing Touch to remove one selected spell from a willing touched creature', () => {
    const paladin = character('paladin', '圣武士', {
      level: 14,
      classResources: { 'dnd5e-cleansing-touch': { current: 2, max: 3 } },
      dnd5eCombatState: { concentrationEffectsBySource: { 'caster-token': 'bless' } },
    })
    const ally = character('ally', '战士', {
      dnd5eCombatState: { concentrationEffectsBySource: { 'caster-token': 'bless' } },
    })
    const caster = character('caster', '牧师', {
      concentrating: true,
      dnd5eCombatState: {
        concentrationSpellId: 'bless',
        concentrationTargetIds: ['paladin-token', 'ally-token'],
        concentrationRoundsRemaining: 10,
      },
    })
    const input = fixture(paladin, {
      feature: 'paladin-cleansing-touch',
      targetTokenId: 'ally-token',
      sourceTokenId: 'caster-token',
      spellId: 'bless',
    }, [ally, caster], [75, 125])
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    const nextPaladin = resolved.application?.characters.find((entry) => entry.id === paladin.id)
    const nextAlly = resolved.application?.characters.find((entry) => entry.id === ally.id)
    const nextCaster = resolved.application?.characters.find((entry) => entry.id === caster.id)
    expect(nextPaladin?.classResources?.['dnd5e-cleansing-touch']).toEqual({ current: 1, max: 3 })
    expect(nextPaladin?.dnd5eCombatState?.concentrationEffectsBySource).toEqual({ 'caster-token': 'bless' })
    expect(nextAlly?.dnd5eCombatState?.concentrationEffectsBySource).toBeUndefined()
    expect(nextCaster).toMatchObject({
      concentrating: true,
      dnd5eCombatState: { concentrationSpellId: 'bless', concentrationTargetIds: ['paladin-token'] },
    })
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'paladin-token', resource: 'action',
    })
  })

  it('rejects Cleansing Touch against an unwilling opposing creature', () => {
    const paladin = character('paladin', '圣武士', {
      level: 14,
      classResources: { 'dnd5e-cleansing-touch': { current: 1, max: 1 } },
    })
    const input = fixture(paladin, {
      feature: 'paladin-cleansing-touch',
      targetTokenId: 'enemy-token',
      sourceTokenId: 'paladin-token',
      spellId: 'bless',
    })
    const enemy = input.map.tokens.find((entry) => entry.id === 'enemy-token')!
    enemy.x = 75
    enemy.y = 25
    enemy.dnd5eCombatState = { concentrationEffectsBySource: { 'paladin-token': 'bless' } }
    paladin.concentrating = true
    paladin.dnd5eCombatState = {
      concentrationSpellId: 'bless', concentrationTargetIds: ['enemy-token'], concentrationRoundsRemaining: 10,
    }
    expect(prepareDnd5eClassFeature(input)).toEqual({ ok: false, reason: 'invalid-target' })
  })

  it('settles Life Domain Preserve Life allocations within 30 feet', () => {
    const cleric = character('cleric', '牧师', {
      level: 6,
      dnd5eClassChoices: { classes: { cleric: { subclass: 'life' } } },
      classResources: { 'dnd5e-channel-divinity': { current: 1, max: 1 } },
    })
    const first = character('first', '战士', { currentHp: 2 })
    const second = character('second', '游荡者', { currentHp: 4 })
    const input = fixture(cleric, {
      feature: 'cleric-preserve-life',
      allocations: [
        { targetTokenId: 'first-token', amount: 10 },
        { targetTokenId: 'second-token', amount: 8 },
      ],
    }, [first, second], [75, 125])
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.application?.characters.find((entry) => entry.id === first.id)?.currentHp).toBe(12)
    expect(resolved.application?.characters.find((entry) => entry.id === second.id)?.currentHp).toBe(12)
  })

  it('derives every undead within 30 feet and persists Turn Undead through the map bridge', () => {
    const cleric = character('cleric', '牧师', {
      level: 2,
      classResources: { 'dnd5e-channel-divinity': { current: 1, max: 1 } },
    })
    const input = fixture(cleric, { feature: 'cleric-turn-undead' })
    const skeleton = input.map.tokens.find((entry) => entry.id === 'enemy-token')!
    skeleton.poolId = 'srd-5.1:skeleton'
    skeleton.x = 75
    skeleton.y = 25
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.turnUndead?.targets).toHaveLength(1)
    expect(prepared.prepared.headlessAction).toMatchObject({
      type: 'cleric-turn-undead', targets: [{ targetId: skeleton.id }],
    })
    const resolved = resolvePreparedDnd5eClassFeature({
      prepared: prepared.prepared,
      turnUndeadSavingThrows: [{ targetId: skeleton.id, d20: 1 }],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-channel-divinity']).toEqual({ current: 0, max: 1 })
    expect(resolved.application?.map.tokens.find((entry) => entry.id === skeleton.id)?.dnd5eCombatState).toMatchObject({
      turnedByClericId: 'cleric-token', turnedRoundsRemaining: 10, conditions: ['turned'],
    })
  })

  it('derives nearby undead for Devotion Turn the Unholy and settles its Wisdom save', () => {
    const paladin = character('paladin', '圣武士', {
      level: 3,
      dnd5eClassChoices: { classes: { paladin: { subclass: 'devotion' } } },
      classResources: { 'dnd5e-channel-divinity': { current: 1, max: 1 } },
    })
    const input = fixture(paladin, { feature: 'paladin-turn-the-unholy' })
    const skeleton = input.map.tokens.find((entry) => entry.id === 'enemy-token')!
    skeleton.poolId = 'srd-5.1:skeleton'
    skeleton.x = 75
    skeleton.y = 25
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.headlessAction).toMatchObject({
      type: 'paladin-turn-the-unholy', targets: [{ targetId: skeleton.id }],
    })
    const resolved = resolvePreparedDnd5eClassFeature({
      prepared: prepared.prepared,
      turnUndeadSavingThrows: [{ targetId: skeleton.id, d20: 1 }],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'unholy-turned', actorId: 'paladin-token', targetId: skeleton.id, rounds: 10,
    })
  })

  it('injects the authoritative d100 result into Divine Intervention', () => {
    const cleric = character('cleric', '牧师', {
      level: 10,
      classResources: { 'dnd5e-divine-intervention': { current: 1, max: 1 } },
    })
    const prepared = prepareDnd5eClassFeature(fixture(cleric, { feature: 'cleric-divine-intervention' }))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared, divineInterventionD100: 10 })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].dnd5eCombatState?.divineInterventionCooldownDays).toBe(7)
  })

  it('activates the Devotion Holy Nimbus and persists its duration', () => {
    const paladin = character('paladin', '圣武士', {
      level: 20,
      dnd5eClassChoices: { classes: { paladin: { subclass: 'devotion' } } },
      classResources: { 'dnd5e-holy-nimbus': { current: 1, max: 1 } },
    })
    const prepared = prepareDnd5eClassFeature(fixture(paladin, { feature: 'paladin-holy-nimbus' }))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0]).toMatchObject({
      classResources: { 'dnd5e-holy-nimbus': { current: 0, max: 1 } },
      dnd5eCombatState: { holyNimbusRoundsRemaining: 10 },
    })
  })

  it('routes Draconic Wings and Draconic Presence through Headless authority', () => {
    const wingedSorcerer = character('sorcerer', '术士', {
      level: 14,
      dnd5eClassChoices: { classes: { sorcerer: { subclass: 'draconic' } } },
    })
    const wings = prepareDnd5eClassFeature(fixture(wingedSorcerer, {
      feature: 'sorcerer-draconic-wings', active: true,
    }))
    expect(wings.ok).toBe(true)
    if (!wings.ok) return
    const wingResult = resolvePreparedDnd5eClassFeature({ prepared: wings.prepared })
    expect(wingResult.application?.characters[0].dnd5eCombatState?.draconicWingsActive).toBe(true)

    const elderSorcerer = character('elder-sorcerer', '术士', {
      level: 18,
      dnd5eClassChoices: { classes: { sorcerer: { subclass: 'draconic' } } },
      classResources: { 'dnd5e-sorcery-points': { current: 18, max: 18 } },
    })
    const presence = prepareDnd5eClassFeature(fixture(elderSorcerer, {
      feature: 'sorcerer-draconic-presence', mode: 'awe',
    }))
    expect(presence.ok).toBe(true)
    if (!presence.ok) return
    const presenceResult = resolvePreparedDnd5eClassFeature({ prepared: presence.prepared })
    expect(presenceResult.application?.characters[0]).toMatchObject({
      concentrating: true,
      classResources: { 'dnd5e-sorcery-points': { current: 13, max: 18 } },
      dnd5eCombatState: { concentrationSpellId: 'class:draconic-presence:awe', concentrationRoundsRemaining: 10 },
    })
  })

  it('destroys a CR 1/4 skeleton with Destroy Undead at Cleric level 5', () => {
    const cleric = character('cleric', '牧师', {
      level: 5,
      classResources: { 'dnd5e-channel-divinity': { current: 1, max: 1 } },
    })
    const input = fixture(cleric, { feature: 'cleric-turn-undead' })
    const skeleton = input.map.tokens.find((entry) => entry.id === 'enemy-token')!
    skeleton.poolId = 'srd-5.1:skeleton'
    skeleton.x = 75
    skeleton.y = 25
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({
      prepared: prepared.prepared,
      turnUndeadSavingThrows: [{ targetId: skeleton.id, d20: 1 }],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === skeleton.id)?.hp).toBe(0)
    expect(resolved.result.events).toContainEqual({
      type: 'undead-destroyed', actorId: 'cleric-token', targetId: skeleton.id, challengeRating: 0.25,
    })
  })

  it('converts Sorcery Points into a spell slot using a bonus action', () => {
    const sorcerer = character('sorcerer', '术士', {
      level: 5,
      classResources: {
        'dnd5e-sorcery-points': { current: 5, max: 5 },
        'dnd5e-spell-slot-2': { current: 1, max: 3 },
      },
    })
    const input = fixture(sorcerer, { feature: 'sorcerer-create-spell-slot', slotLevel: 2 })
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.application?.characters[0].classResources).toMatchObject({
      'dnd5e-sorcery-points': { current: 2, max: 5 },
      'dnd5e-spell-slot-2': { current: 2, max: 3 },
    })
  })

  it('settles Rogue Cunning Action as a bonus-action Dash or Disengage', () => {
    const rogue = character('rogue', '游荡者', { level: 2 })
    const dash = prepareDnd5eClassFeature(fixture(rogue, { feature: 'rogue-cunning-action', option: 'dash' }))
    expect(dash.ok).toBe(true)
    if (!dash.ok) return
    const dashResult = resolvePreparedDnd5eClassFeature({ prepared: dash.prepared })
    expect(dashResult.result.events).toContainEqual({ type: 'turn-resource-spent', actorId: 'rogue-token', resource: 'bonusAction' })
    expect(dashResult.result.events).toContainEqual({ type: 'movement-granted', actorId: 'rogue-token', amount: 30 })

    const disengage = prepareDnd5eClassFeature(fixture(rogue, { feature: 'rogue-cunning-action', option: 'disengage' }))
    expect(disengage.ok).toBe(true)
    if (!disengage.ok) return
    expect(resolvePreparedDnd5eClassFeature({ prepared: disengage.prepared }).result.events)
      .toContainEqual({ type: 'disengage-granted', actorId: 'rogue-token' })
  })

  it('spends one Ki for Monk Step of the Wind and rejects it before level 2', () => {
    const monk = character('monk', '武僧', {
      level: 2,
      classResources: { 'dnd5e-ki': { current: 2, max: 2 } },
    })
    const prepared = prepareDnd5eClassFeature(fixture(monk, { feature: 'monk-step-of-the-wind', option: 'dash' }))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.application?.characters[0].classResources?.['dnd5e-ki']).toEqual({ current: 1, max: 2 })
    expect(resolved.result.events).toContainEqual({ type: 'movement-granted', actorId: 'monk-token', amount: 40 })

    const novice = character('novice', '武僧', { level: 1 })
    expect(prepareDnd5eClassFeature(fixture(novice, { feature: 'monk-step-of-the-wind', option: 'dash' })))
      .toEqual({ ok: false, reason: 'feature-locked' })
  })

  it('persists Monk Patient Defense and spends its bonus action and Ki', () => {
    const monk = character('monk', '武僧', {
      level: 5,
      classResources: { 'dnd5e-ki': { current: 3, max: 5 } },
    })
    const prepared = prepareDnd5eClassFeature(fixture(monk, { feature: 'monk-patient-defense' }))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.application?.characters[0]).toMatchObject({
      classResources: { 'dnd5e-ki': { current: 2, max: 5 } },
      dnd5eCombatState: { dodgingTurnKey: 'combat:1:monk-token' },
    })
    expect(resolved.result.events).toContainEqual({ type: 'turn-resource-spent', actorId: 'monk-token', resource: 'bonusAction' })
  })

  it('activates Devotion Paladin Sacred Weapon through Channel Divinity', () => {
    const paladin = character('paladin', '圣武士', {
      level: 3,
      dnd5eClassChoices: { classes: { paladin: { subclass: 'devotion' } } },
      classResources: { 'dnd5e-channel-divinity': { current: 1, max: 1 } },
    })
    const prepared = prepareDnd5eClassFeature(fixture(paladin, { feature: 'paladin-sacred-weapon' }))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.application?.characters[0]).toMatchObject({
      classResources: { 'dnd5e-channel-divinity': { current: 0, max: 1 } },
      dnd5eCombatState: { sacredWeaponTurnsRemaining: 10 },
    })
    expect(resolved.result.events).toContainEqual({ type: 'turn-resource-spent', actorId: 'paladin-token', resource: 'action' })
  })

  it('detects only eligible creatures within 60 feet with Divine Sense', () => {
    const paladin = character('paladin', '圣武士', {
      level: 3,
      classResources: { 'dnd5e-divine-sense': { current: 2, max: 2 } },
    })
    const input = fixture(paladin, { feature: 'paladin-divine-sense' })
    const undead = input.map.tokens.find((entry) => entry.id === 'enemy-token')!
    undead.poolId = 'srd-5.1:skeleton'
    undead.x = 575
    undead.y = 25
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.headlessAction).toMatchObject({ type: 'paladin-divine-sense', targetIds: ['enemy-token'] })
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.result.events).toContainEqual({ type: 'creatures-sensed', actorId: 'paladin-token', targetIds: ['enemy-token'] })
    expect(resolved.application?.characters[0].classResources?.['dnd5e-divine-sense']).toEqual({ current: 1, max: 2 })

    undead.x = 675
    const outOfRange = prepareDnd5eClassFeature(input)
    expect(outOfRange.ok).toBe(true)
    if (!outOfRange.ok) return
    expect(outOfRange.prepared.headlessAction).toMatchObject({ type: 'paladin-divine-sense', targetIds: [] })
  })

  it('resolves Flurry of Blows as two authoritative unarmed attacks after the Attack action', () => {
    const monk = character('monk', '武僧', {
      level: 5,
      abilities: { str: 10, dex: 16, con: 14, int: 10, wis: 16, cha: 8 },
      classResources: { 'dnd5e-ki': { current: 2, max: 5 } },
      dnd5eCombatState: {
        monkAttackActionTurnKey: 'combat:1:monk-token',
        monkMartialArtsTurnKey: 'combat:1:monk-token',
      },
    })
    const input = fixture(monk, {
      feature: 'monk-unarmed-bonus',
      mode: 'flurry',
      targetTokenIds: ['enemy-token', 'enemy-token'],
    })
    const enemy = input.map.tokens.find((entry) => entry.id === 'enemy-token')!
    enemy.x = 75
    enemy.y = 25
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.monkBonusAttack?.profile).toMatchObject({
      attackAbility: 'dex', attackModifier: 6, damage: { count: 1, sides: 6, bonus: 3 }, martialArts: true,
    })
    expect(previewDnd5eMonkBonusAttack(prepared.prepared, 0, 15).hit).toBe(true)
    const resolved = resolvePreparedDnd5eClassFeature({
      prepared: prepared.prepared,
      monkAttackRolls: [
        { d20: 15, damageRolls: [4] },
        { d20: 15, damageRolls: [3] },
      ],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-ki']).toEqual({ current: 1, max: 5 })
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(0)
    expect(resolved.result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(2)
  })

  it('lets a Lore Bard reduce a Monk bonus unarmed damage roll', () => {
    const monk = character('monk', '武僧', {
      level: 5,
      abilities: { str: 10, dex: 16, con: 14, int: 10, wis: 16, cha: 8 },
      classResources: { 'dnd5e-ki': { current: 2, max: 5 } },
      dnd5eCombatState: {
        monkAttackActionTurnKey: 'combat:1:monk-token',
        monkMartialArtsTurnKey: 'combat:1:monk-token',
      },
    })
    const bard = character('bard', '吟游诗人', {
      level: 5,
      dnd5eClassChoices: { classes: { bard: { subclass: 'lore', selections: {} } } },
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 3 } },
    })
    const input = fixture(
      monk,
      { feature: 'monk-unarmed-bonus', mode: 'martial-arts', targetTokenIds: ['enemy-token'] },
      [bard],
      [125],
    )
    const enemy = input.map.tokens.find((entry) => entry.id === 'enemy-token')!
    enemy.x = 75
    enemy.y = 25
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({
      prepared: prepared.prepared,
      monkAttackRolls: [{
        d20: 15,
        damageRolls: [5],
        cuttingWordsDamage: { bardId: 'bard-token', roll: 3, distanceFeet: 30 },
      }],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(5)
    expect(resolved.application?.characters.find((entry) => entry.id === bard.id)?.classResources?.['dnd5e-bardic-inspiration']).toEqual({ current: 1, max: 3 })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'bard-token', targetId: 'monk-token',
      stateKey: 'cutting-words', value: 3,
    }))
  })

  it('applies Open Hand no-reactions and an authoritative 15-foot push through Flurry of Blows', () => {
    const monk = character('monk', '武僧', {
      level: 5,
      abilities: { str: 10, dex: 16, con: 14, int: 10, wis: 16, cha: 8 },
      dnd5eClassChoices: { classes: { monk: { subclass: 'open-hand' } } },
      classResources: { 'dnd5e-ki': { current: 3, max: 5 } },
      dnd5eCombatState: {
        monkAttackActionTurnKey: 'combat:1:monk-token',
        monkMartialArtsTurnKey: 'combat:1:monk-token',
      },
    })
    const input = fixture(monk, {
      feature: 'monk-unarmed-bonus', mode: 'flurry',
      targetTokenIds: ['enemy-token', 'enemy-token'],
      openHandTechniques: ['no-reactions', 'push'],
    })
    const enemy = input.map.tokens.find((entry) => entry.id === 'enemy-token')!
    enemy.x = 75
    enemy.y = 25
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.monkBonusAttack?.targets[1].openHandTechnique).toMatchObject({
      effect: 'push', saveDc: 14, pushTo: { x: 225, y: 25 }, pushDistanceFeet: 15,
    })
    const resolved = resolvePreparedDnd5eClassFeature({
      prepared: prepared.prepared,
      monkAttackRolls: [
        { d20: 15, damageRolls: [1] },
        { d20: 15, damageRolls: [1], openHandSavingThrowD20: 1 },
      ],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)).toMatchObject({
      x: 225,
      dnd5eCombatState: {
        openHandNoReactionsAppliedTurnKeysBySource: { 'monk-token': 'combat:1:monk-token' },
      },
    })
    expect(resolved.result.events).toContainEqual({
      type: 'moved', actorId: 'enemy-token', from: { x: 75, y: 25 }, to: { x: 225, y: 25 }, distance: 15,
    })
  })

  it('lets the first Open Hand knockdown grant advantage to the second Flurry attack', () => {
    const monk = character('monk', '武僧', {
      level: 5,
      abilities: { str: 10, dex: 16, con: 14, int: 10, wis: 16, cha: 8 },
      dnd5eClassChoices: { classes: { monk: { subclass: 'open-hand' } } },
      classResources: { 'dnd5e-ki': { current: 3, max: 5 } },
      dnd5eCombatState: {
        monkAttackActionTurnKey: 'combat:1:monk-token',
        monkMartialArtsTurnKey: 'combat:1:monk-token',
      },
    })
    const input = fixture(monk, {
      feature: 'monk-unarmed-bonus', mode: 'flurry',
      targetTokenIds: ['enemy-token', 'enemy-token'],
      openHandTechniques: ['prone', undefined],
    })
    const enemy = input.map.tokens.find((entry) => entry.id === 'enemy-token')!
    enemy.x = 75
    enemy.y = 25
    enemy.hp = 20
    enemy.maxHp = 20
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({
      prepared: prepared.prepared,
      monkAttackRolls: [
        { d20: 15, damageRolls: [1], openHandSavingThrowD20: 1 },
        { d20: 5, d20Second: 15, damageRolls: [1] },
      ],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.dnd5eCombatState?.conditions).toContain('prone')
    expect(resolved.result.events.filter((event) => event.type === 'attack-resolved')).toEqual([
      expect.objectContaining({ hit: true, d20: 15 }),
      expect.objectContaining({ hit: true, d20: 15 }),
    ])
  })

  it('allows the Martial Arts bonus strike without spending Ki and rejects it without a qualifying Attack action', () => {
    const eligible = character('monk', '武僧', {
      level: 3,
      classResources: { 'dnd5e-ki': { current: 3, max: 3 } },
      dnd5eCombatState: { monkMartialArtsTurnKey: 'combat:1:monk-token' },
    })
    const input = fixture(eligible, { feature: 'monk-unarmed-bonus', mode: 'martial-arts', targetTokenIds: ['enemy-token'] })
    input.map.tokens.find((entry) => entry.id === 'enemy-token')!.x = 75
    input.map.tokens.find((entry) => entry.id === 'enemy-token')!.y = 25
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({
      prepared: prepared.prepared,
      monkAttackRolls: [{ d20: 15, damageRolls: [4] }],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-ki']).toEqual({ current: 3, max: 3 })

    const ineligible = character('novice', '武僧', { level: 3 })
    const rejectedInput = fixture(ineligible, { feature: 'monk-unarmed-bonus', mode: 'martial-arts', targetTokenIds: ['enemy-token'] })
    rejectedInput.map.tokens.find((entry) => entry.id === 'enemy-token')!.x = 75
    rejectedInput.map.tokens.find((entry) => entry.id === 'enemy-token')!.y = 25
    const rejected = prepareDnd5eClassFeature(rejectedInput)
    expect(rejected.ok).toBe(true)
    if (!rejected.ok) return
    expect(resolvePreparedDnd5eClassFeature({
      prepared: rejected.prepared,
      monkAttackRolls: [{ d20: 15, damageRolls: [4] }],
    }).result).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('uses Stillness of Mind as an action and persists the removed condition', () => {
    const monk = character('monk', '武僧', { level: 7, conditions: ['魅惑', '中毒'] })
    const prepared = prepareDnd5eClassFeature(fixture(monk, {
      feature: 'monk-stillness-of-mind', condition: 'charmed',
    }))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].conditions).toEqual(['中毒'])
    expect(resolved.result.events).toContainEqual({ type: 'condition-ended', targetId: 'monk-token', condition: '魅惑' })
    expect(resolved.result.events).toContainEqual({ type: 'turn-resource-spent', actorId: 'monk-token', resource: 'action' })
  })

  it('allows a level-five Monk to apply Stunning Strike through a Martial Arts bonus attack', () => {
    const monk = character('monk', '武僧', {
      level: 5,
      abilities: { str: 10, dex: 16, con: 14, int: 10, wis: 16, cha: 8 },
      classResources: { 'dnd5e-ki': { current: 2, max: 5 } },
      dnd5eCombatState: { monkMartialArtsTurnKey: 'combat:1:monk-token' },
    })
    const input = fixture(monk, {
      feature: 'monk-unarmed-bonus', mode: 'martial-arts', targetTokenIds: ['enemy-token'], stunningStrike: true,
    })
    const enemy = input.map.tokens.find((entry) => entry.id === 'enemy-token')!
    enemy.x = 75
    enemy.y = 25
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.monkBonusAttack?.targets[0].stunningStrike).toEqual({
      saveDc: 14, saveModifier: 0, saveMode: 'normal', blessed: false, baned: false,
    })
    const resolved = resolvePreparedDnd5eClassFeature({
      prepared: prepared.prepared,
      monkAttackRolls: [{ d20: 15, damageRolls: [2], stunningStrikeSaveD20: 5 }],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-ki']).toEqual({ current: 1, max: 5 })
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.dnd5eCombatState).toMatchObject({
      stunnedByActorId: 'monk-token', stunnedAppliedTurnKey: 'combat:1:monk-token',
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: enemy.id, ability: 'con', dc: 14, success: false,
    }))
  })

  it('requires enough committed Ki before requesting Stunning Strike on both Flurry attacks', () => {
    const monk = character('monk', '武僧', {
      level: 5,
      classResources: { 'dnd5e-ki': { current: 2, max: 5 } },
      dnd5eCombatState: {
        monkAttackActionTurnKey: 'combat:1:monk-token',
        monkMartialArtsTurnKey: 'combat:1:monk-token',
      },
    })
    const input = fixture(monk, {
      feature: 'monk-unarmed-bonus', mode: 'flurry', targetTokenIds: ['enemy-token', 'enemy-token'], stunningStrike: true,
    })
    const enemy = input.map.tokens.find((entry) => entry.id === 'enemy-token')!
    enemy.x = 75
    enemy.y = 25
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(resolvePreparedDnd5eClassFeature({
      prepared: prepared.prepared,
      monkAttackRolls: [
        { d20: 1, damageRolls: [] },
        { d20: 1, damageRolls: [] },
      ],
    }).result).toMatchObject({ ok: false, reason: 'class-resource-unavailable' })
  })

  it('implants Open Hand Quivering Palm only when the selected unarmed strike hits', () => {
    const monk = character('monk', '武僧', {
      level: 17,
      abilities: { str: 10, dex: 18, con: 14, int: 10, wis: 16, cha: 8 },
      dnd5eClassChoices: { classes: { monk: { subclass: 'open-hand' } } },
      classResources: { 'dnd5e-ki': { current: 10, max: 17 } },
      dnd5eCombatState: { monkMartialArtsTurnKey: 'combat:1:monk-token' },
    })
    const hitInput = fixture(monk, {
      feature: 'monk-unarmed-bonus', mode: 'martial-arts', targetTokenIds: ['enemy-token'],
      quiveringPalmAttackIndex: 0,
    })
    const hitEnemy = hitInput.map.tokens.find((entry) => entry.id === 'enemy-token')!
    hitEnemy.x = 75
    hitEnemy.y = 25
    hitEnemy.hp = 100
    hitEnemy.maxHp = 100
    const preparedHit = prepareDnd5eClassFeature(hitInput)
    expect(preparedHit.ok).toBe(true)
    if (!preparedHit.ok) return
    const hit = resolvePreparedDnd5eClassFeature({
      prepared: preparedHit.prepared,
      monkAttackRolls: [{ d20: 15, damageRolls: [5] }],
    })
    expect(hit.result.ok).toBe(true)
    expect(hit.application?.characters[0]).toMatchObject({
      classResources: { 'dnd5e-ki': { current: 7, max: 17 } },
      dnd5eCombatState: { quiveringPalmTargetId: 'enemy-token' },
    })

    const missInput = fixture(monk, {
      feature: 'monk-unarmed-bonus', mode: 'martial-arts', targetTokenIds: ['enemy-token'],
      quiveringPalmAttackIndex: 0,
    })
    const missEnemy = missInput.map.tokens.find((entry) => entry.id === 'enemy-token')!
    missEnemy.x = 75
    missEnemy.y = 25
    const preparedMiss = prepareDnd5eClassFeature(missInput)
    expect(preparedMiss.ok).toBe(true)
    if (!preparedMiss.ok) return
    const miss = resolvePreparedDnd5eClassFeature({
      prepared: preparedMiss.prepared,
      monkAttackRolls: [{ d20: 1, damageRolls: [] }],
    })
    expect(miss.result.ok).toBe(true)
    expect(miss.application?.characters[0].classResources?.['dnd5e-ki']).toEqual({ current: 10, max: 17 })
    expect(miss.application?.characters[0].dnd5eCombatState?.quiveringPalmTargetId).toBeUndefined()
  })

  it('releases Quivering Palm through a Constitution save and clears the persistent target', () => {
    const monk = character('monk', '武僧', {
      level: 17,
      abilities: { str: 10, dex: 18, con: 14, int: 10, wis: 16, cha: 8 },
      dnd5eClassChoices: { classes: { monk: { subclass: 'open-hand' } } },
      classResources: { 'dnd5e-ki': { current: 7, max: 17 } },
      dnd5eCombatState: { quiveringPalmTargetId: 'enemy-token' },
    })
    const failedSaveInput = fixture(monk, {
      feature: 'monk-quivering-palm-release', targetTokenId: 'enemy-token',
    })
    const failedSaveTarget = failedSaveInput.map.tokens.find((entry) => entry.id === 'enemy-token')!
    failedSaveTarget.hp = 100
    failedSaveTarget.maxHp = 100
    const preparedFailedSave = prepareDnd5eClassFeature(failedSaveInput)
    expect(preparedFailedSave.ok).toBe(true)
    if (!preparedFailedSave.ok) return
    expect(preparedFailedSave.prepared.quiveringPalmRelease).toMatchObject({ saveDc: 17, saveModifier: 0 })
    const failedSave = resolvePreparedDnd5eClassFeature({
      prepared: preparedFailedSave.prepared,
      savingThrowD20: 1,
    })
    expect(failedSave.result.ok).toBe(true)
    expect(failedSave.application?.map.tokens.find((entry) => entry.id === 'enemy-token')?.hp).toBe(0)
    expect(failedSave.application?.characters[0].dnd5eCombatState?.quiveringPalmTargetId).toBeUndefined()
    expect(failedSave.result.events).toContainEqual({
      type: 'hit-points-reduced-to-zero', sourceId: 'monk-token', targetId: 'enemy-token', hpBefore: 100,
    })

    const successfulSaveInput = fixture(monk, {
      feature: 'monk-quivering-palm-release', targetTokenId: 'enemy-token',
    })
    const successfulSaveTarget = successfulSaveInput.map.tokens.find((entry) => entry.id === 'enemy-token')!
    successfulSaveTarget.hp = 100
    successfulSaveTarget.maxHp = 100
    const preparedSuccessfulSave = prepareDnd5eClassFeature(successfulSaveInput)
    expect(preparedSuccessfulSave.ok).toBe(true)
    if (!preparedSuccessfulSave.ok) return
    const successfulSave = resolvePreparedDnd5eClassFeature({
      prepared: preparedSuccessfulSave.prepared,
      savingThrowD20: 20,
      effectRolls: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    })
    expect(successfulSave.result.ok).toBe(true)
    expect(successfulSave.application?.map.tokens.find((entry) => entry.id === 'enemy-token')?.hp).toBe(50)
    expect(successfulSave.result.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied', sourceId: 'monk-token', targetId: 'enemy-token', amount: 50,
    }))
  })

  it('ends Quivering Palm harmlessly without spending an action', () => {
    const monk = character('monk', '武僧', {
      level: 17,
      dnd5eClassChoices: { classes: { monk: { subclass: 'open-hand' } } },
      dnd5eCombatState: { quiveringPalmTargetId: 'enemy-token' },
    })
    const prepared = prepareDnd5eClassFeature(fixture(monk, { feature: 'monk-quivering-palm-end' }))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].dnd5eCombatState?.quiveringPalmTargetId).toBeUndefined()
    expect(resolved.result.events.some((event) => event.type === 'turn-resource-spent')).toBe(false)
  })

  it('readies and cancels Hurl Through Hell through the class-feature Headless bridge without spending an action', () => {
    const warlock = character('warlock', '邪术师', {
      level: 14,
      dnd5eClassChoices: { classes: { warlock: { subclass: 'fiend' } } },
      classResources: { 'dnd5e-hurl-through-hell': { current: 1, max: 1 } },
    })
    const prepared = prepareDnd5eClassFeature(fixture(warlock, {
      feature: 'warlock-hurl-through-hell-ready', active: true,
    }))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const readied = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(readied.result.ok).toBe(true)
    expect(readied.result.events.some((event) => event.type === 'turn-resource-spent')).toBe(false)
    expect(readied.application?.characters[0]).toMatchObject({
      classResources: { 'dnd5e-hurl-through-hell': { current: 1, max: 1 } },
      dnd5eCombatState: { hurlThroughHellReady: true },
    })

    const cancelInput = fixture(readied.application!.characters[0], {
      feature: 'warlock-hurl-through-hell-ready', active: false,
    })
    const cancelPrepared = prepareDnd5eClassFeature(cancelInput)
    expect(cancelPrepared.ok).toBe(true)
    if (!cancelPrepared.ok) return
    const cancelled = resolvePreparedDnd5eClassFeature({ prepared: cancelPrepared.prepared })
    expect(cancelled.result.ok).toBe(true)
    expect(cancelled.application?.characters[0].dnd5eCombatState?.hurlThroughHellReady).toBeUndefined()
  })

  it('uses Cunning Action to Hide and applies Supreme Sneak when movement stays within half speed', () => {
    const rogue = character('rogue', '游荡者', {
      level: 9,
      abilities: { str: 10, dex: 18, con: 12, int: 12, wis: 12, cha: 10 },
      skills: ['stealth'],
      passivePerception: 11,
      dnd5eClassChoices: { classes: { rogue: { subclass: 'thief', selections: { expertise: ['stealth'] } } } },
    })
    const input = fixture(rogue, { feature: 'rogue-cunning-action', option: 'hide' })
    input.turnEconomy = { ...input.turnEconomy, movement: { current: 20, max: 30 } }
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.rogueAbilityCheck).toMatchObject({
      modifier: 12, mode: 'advantage', passivePerceptionDc: 10,
    })
    const resolved = resolvePreparedDnd5eClassFeature({
      prepared: prepared.prepared,
      abilityCheckD20: 5,
      abilityCheckD20Second: 15,
      hideAllowed: true,
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].dnd5eCombatState?.hiddenCheckTotal).toBe(27)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', skill: 'stealth', d20: 15, total: 27, mode: 'advantage', success: true,
    }))
  })

  it('uses Ranger Vanish to Hide as a bonus action without Rogue Reliable Talent', () => {
    const ranger = character('ranger', '游侠', {
      level: 14,
      abilities: { str: 10, dex: 18, con: 12, int: 12, wis: 14, cha: 10 },
      skills: ['stealth'],
      dnd5eClassChoices: { classes: { ranger: { subclass: 'hunter' } } },
    })
    const prepared = prepareDnd5eClassFeature(fixture(ranger, { feature: 'ranger-vanish' }))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.rogueAbilityCheck).toMatchObject({ modifier: 9, mode: 'normal', passivePerceptionDc: 10 })
    const resolved = resolvePreparedDnd5eClassFeature({
      prepared: prepared.prepared,
      abilityCheckD20: 2,
      hideAllowed: true,
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'ranger-token', resource: 'bonusAction',
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', total: 11, reliableTalentApplied: false, success: true,
    }))
  })

  it('uses Primeval Awareness without revealing creature count or location', () => {
    const ranger = character('ranger', '游侠', {
      level: 5,
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 2 } },
      dnd5eClassChoices: { classes: { ranger: { subclass: 'hunter' } } },
    })
    const input = fixture(ranger, { feature: 'ranger-primeval-awareness', slotLevel: 2 })
    const undead = input.map.tokens.find((entry) => entry.id === 'enemy-token')!
    undead.poolId = 'srd-5.1:skeleton'
    const prepared = prepareDnd5eClassFeature(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eClassFeature({ prepared: prepared.prepared })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters.find((entry) => entry.id === ranger.id)?.classResources?.['dnd5e-spell-slot-2']).toEqual({ current: 0, max: 2 })
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'ranger-token', resource: 'action',
    })
    expect(resolved.result.events).toContainEqual({
      type: 'creature-types-sensed', actorId: 'ranger-token', creatureTypes: ['亡灵'], durationRounds: 20,
    })
  })

  it('applies Hide in Plain Sight to the next Stealth check and then clears the camouflage', () => {
    const ranger = character('ranger', '游侠', {
      level: 14,
      abilities: { str: 10, dex: 18, con: 12, int: 12, wis: 14, cha: 10 },
      skills: ['stealth'],
      dnd5eClassChoices: { classes: { ranger: { subclass: 'hunter' } } },
    })
    const preparedCamouflage = prepareDnd5eClassFeature(fixture(ranger, { feature: 'ranger-hide-in-plain-sight' }))
    expect(preparedCamouflage.ok).toBe(true)
    if (!preparedCamouflage.ok) return
    const camouflaged = resolvePreparedDnd5eClassFeature({ prepared: preparedCamouflage.prepared })
    expect(camouflaged.result.ok).toBe(true)
    const updatedRanger = camouflaged.application?.characters.find((entry) => entry.id === ranger.id)
    expect(updatedRanger?.dnd5eCombatState?.hideInPlainSightPrepared).toBe(true)
    if (!updatedRanger) return

    const preparedHide = prepareDnd5eClassFeature(fixture(updatedRanger, { feature: 'ranger-vanish' }))
    expect(preparedHide.ok).toBe(true)
    if (!preparedHide.ok) return
    expect(preparedHide.prepared.rogueAbilityCheck).toMatchObject({ modifier: 19 })
    const hidden = resolvePreparedDnd5eClassFeature({
      prepared: preparedHide.prepared,
      abilityCheckD20: 2,
      hideAllowed: true,
    })
    expect(hidden.result.ok).toBe(true)
    expect(hidden.application?.characters.find((entry) => entry.id === ranger.id)?.dnd5eCombatState).toMatchObject({
      hiddenCheckTotal: 21,
    })
    expect(hidden.application?.characters.find((entry) => entry.id === ranger.id)?.dnd5eCombatState?.hideInPlainSightPrepared).toBeUndefined()
  })

  it('uses Thief Fast Hands for checks or Use an Object as a bonus action', () => {
    const rogue = character('rogue', '游荡者', {
      level: 11,
      abilities: { str: 10, dex: 18, con: 12, int: 12, wis: 12, cha: 10 },
      skills: ['sleightOfHand'],
      dnd5eClassChoices: { classes: { rogue: { subclass: 'thief', selections: { expertise: ['sleightOfHand'] } } } },
    })
    const checkPrepared = prepareDnd5eClassFeature(fixture(rogue, {
      feature: 'rogue-fast-hands', option: 'sleight-of-hand',
    }))
    expect(checkPrepared.ok).toBe(true)
    if (!checkPrepared.ok) return
    const checked = resolvePreparedDnd5eClassFeature({
      prepared: checkPrepared.prepared,
      abilityCheckD20: 2,
    })
    expect(checked.result.ok).toBe(true)
    expect(checked.result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', skill: 'sleightOfHand', d20: 10, total: 22, reliableTalentApplied: true,
    }))

    const objectPrepared = prepareDnd5eClassFeature(fixture(rogue, {
      feature: 'rogue-fast-hands', option: 'use-object',
    }))
    expect(objectPrepared.ok).toBe(true)
    if (!objectPrepared.ok) return
    const objectUsed = resolvePreparedDnd5eClassFeature({ prepared: objectPrepared.prepared })
    expect(objectUsed.result.ok).toBe(true)
    expect(objectUsed.result.events).toContainEqual({
      type: 'object-action-taken', actorId: 'rogue-token', action: 'use-object',
    })
  })
})
