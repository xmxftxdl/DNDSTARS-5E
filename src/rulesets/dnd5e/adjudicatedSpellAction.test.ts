import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  dnd5eAdjudicatedSpellElapsedCastingMinutes,
  prepareDnd5eAdjudicatedSpell,
  resolvePreparedDnd5eAdjudicatedSpell,
} from './adjudicatedSpellAction'
import { dnd5eSpellbookEntries, type Dnd5eImportedSpell } from './spellbook'
import { DND5E_LEATHER_ARMOR } from './equipment'
import {
  createDnd5eConditionEffect,
  normalizeDnd5eActiveEffects,
  validateDnd5eActiveEffectsStrict,
} from './activeEffects'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from './items'
import { dnd5eEffectiveOptionalMovementSpeed, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { validateSharedStateShape } from '../../../scripts/shared-server-core.mjs'

function wizard(spellId: string): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1', id: 'wizard', name: '法师', player: '', avatar: '', accent: '',
    race: '人类', charClass: '法师', level: 5, background: '', experience: 0, reputation: 0,
    abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 30, currentHp: 30, tempHp: 0, hitDice: '5d6', ac: 14, speed: 30, initiativeBonus: 2,
    saveDC: 15, passivePerception: 11, inspiration: 0, 
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': [spellId] } } } },
    classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
  }
}

function token(id: string, type: 'player' | 'enemy', x: number, characterId?: string): Token {
  return { id, label: id, x, y: 25, color: '', emoji: '', size: 1, type, characterId, hp: 30, maxHp: 30 }
}

function roomSpell(): Dnd5eImportedSpell {
  return {
    id: 'test.rules:amber-bolt', name: '琥珀箭', englishName: 'Amber Bolt', level: 1,
    school: 'evocation', ritual: false,
    castingTime: { value: 1, unit: 'action' },
    range: { type: 'distance', feet: 60 },
    components: { verbal: true, somatic: true, material: false },
    duration: { type: 'instantaneous', concentration: false },
    classes: ['wizard'], description: '具体命中与效果由 DM 裁定。',
    source: { title: '测试规则包', publisher: 'DNDSTARS', license: '测试' },
    automation: { mode: 'reference-only' },
  }
}

function fixture() {
  const spell = roomSpell()
  const actor = wizard(spell.id)
  const actorToken = token('wizard-token', 'player', 25, actor.id)
  const enemy = token('enemy-token', 'enemy', 125)
  const map: BattleMap = {
    id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
    tokens: [actorToken, enemy],
  }
  const action: SharedPlayerActionState = {
    id: 'adjudicated-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending',
    type: 'dnd5e-adjudicated-spell', actorTokenId: actorToken.id, characterId: actor.id,
    dnd5eAdjudicatedSpell: { spellId: spell.id, slotLevel: 1 },
    round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
  }
  return {
    action, spell: dnd5eSpellbookEntries([spell]).find((entry) => entry.id === spell.id)!,
    map, actor, actorToken, enemy,
    characters: [actor],
    initiativeOrder: [actorToken, enemy].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    })),
  }
}

describe('DM-adjudicated spell deterministic-cost transaction', () => {
  it('converts printed long casting times and ritual overhead into campaign minutes', () => {
    const input = fixture()
    const mending = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'mending')!
    expect(dnd5eAdjudicatedSpellElapsedCastingMinutes(mending, false)).toBe(1)

    const importedHour = {
      ...input.spell,
      imported: {
        ...input.spell.imported!,
        castingTime: { value: 2, unit: 'hour' as const },
      },
    }
    expect(dnd5eAdjudicatedSpellElapsedCastingMinutes(importedHour, false)).toBe(120)
    expect(dnd5eAdjudicatedSpellElapsedCastingMinutes(input.spell, true)).toBe(10)
  })

  it('treats Plant Growth action and eight-hour modes as distinct Host-audited casting times', () => {
    const plantGrowth = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'plant-growth')!
    expect(dnd5eAdjudicatedSpellElapsedCastingMinutes(
      plantGrowth,
      false,
      'plant-growth-action',
    )).toBe(0)
    expect(dnd5eAdjudicatedSpellElapsedCastingMinutes(
      plantGrowth,
      false,
      'plant-growth-8-hours',
    )).toBe(480)
    // Old clients omit the variant; fail safe to the printed one-action mode,
    // never the former accidental one-hour parse.
    expect(dnd5eAdjudicatedSpellElapsedCastingMinutes(plantGrowth, false)).toBe(0)
  })

  it('prepares Mending as a one-minute long cast without a spell slot', () => {
    const input = fixture()
    const mending = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'mending')!
    input.actor.level = 1
    input.actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-cantrips': [mending.id] } } },
    }
    input.action.dnd5eAdjudicatedSpell = { spellId: mending.id, slotLevel: 0 }
    const prepared = prepareDnd5eAdjudicatedSpell({ ...input, spell: mending })
    expect(prepared).toMatchObject({
      ok: true,
      prepared: { castingTime: 'long', elapsedCastingMinutes: 1, slotLevel: 0 },
    })
  })

  it('reports when the character has not learned or prepared the spell', () => {
    const input = fixture()
    input.actor.dnd5eClassChoices = { classes: { wizard: { selections: { 'spell-prepared': [] } } } }
    expect(prepareDnd5eAdjudicatedSpell(input)).toEqual({
      ok: false,
      reason: 'spell-not-known-or-prepared',
    })
  })

  it('rejects unproficient armor and unavailable verbal components before asking the DM', () => {
    const input = fixture()
    input.actor.equipment = { armor: DND5E_LEATHER_ARMOR }
    expect(prepareDnd5eAdjudicatedSpell(input)).toEqual({
      ok: false,
      reason: 'armor-proficiency-required',
    })

    input.actor.equipment = undefined
    input.actor.conditions = ['沉默']
    expect(prepareDnd5eAdjudicatedSpell(input)).toEqual({
      ok: false,
      reason: 'verbal-component-unavailable',
    })
  })

  it('routes partial core spells to adjudication but rejects fully Headless spells', () => {
    const input = fixture()
    const entries = dnd5eSpellbookEntries([])
    const seeInvisibility = entries.find((entry) => entry.id === 'see-invisibility')!
    input.actor.dnd5eClassChoices = { classes: { wizard: { selections: { 'spell-prepared': [seeInvisibility.id] } } } }
    input.actor.classResources = { 'dnd5e-spell-slot-2': { current: 1, max: 2 } }
    input.action.dnd5eAdjudicatedSpell = { spellId: seeInvisibility.id, slotLevel: 2 }
    expect(prepareDnd5eAdjudicatedSpell({ ...input, spell: seeInvisibility })).toMatchObject({ ok: true })

    const arcaneHand = entries.find((entry) => entry.id === 'arcane-hand')!
    input.actor.dnd5eClassChoices = { classes: { wizard: { selections: { 'spell-prepared': [arcaneHand.id] } } } }
    input.actor.classResources = { 'dnd5e-spell-slot-5': { current: 1, max: 1 } }
    input.action.dnd5eAdjudicatedSpell = { spellId: arcaneHand.id, slotLevel: 5 }
    expect(prepareDnd5eAdjudicatedSpell({ ...input, spell: arcaneHand })).toEqual({
      ok: false,
      reason: 'invalid-action',
    })
  })

  it('Host validates components before voice narrative and atomically spends consumed materials', () => {
    const input = fixture()
    const arcaneLock = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'arcane-lock')!
    input.actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-prepared': [arcaneLock.id] } } },
    }
    input.actor.classResources = { 'dnd5e-spell-slot-2': { current: 1, max: 3 } }
    const withGoldDust = applyDnd5eInventoryMutation([input.actor], {
      type: 'grant',
      characterId: input.actor.id,
      templateId: 'srd-5.1:item:gold-dust-25gp',
      quantity: 1,
    })
    expect(withGoldDust.ok).toBe(true)
    input.actor = withGoldDust.characters[0]
    input.characters = [input.actor]
    const object: Token = {
      id: 'voice-object', label: '语音叙事门', x: 75, y: 75, color: '', emoji: '🚪',
      size: 1, type: 'obstacle', hp: 20, maxHp: 20,
      dnd5eObjectState: { schemaVersion: 1, locked: false },
    }
    input.map.tokens.push(object)
    input.action.dnd5eAdjudicatedSpell = {
      spellId: arcaneLock.id,
      castingClassId: 'wizard',
      slotLevel: 2,
      narrativeOnly: true,
    }

    input.actor.conditions = ['沉默']
    expect(prepareDnd5eAdjudicatedSpell({ ...input, spell: arcaneLock })).toEqual({
      ok: false,
      reason: 'verbal-component-unavailable',
    })
    input.actor.conditions = []

    const prepared = prepareDnd5eAdjudicatedSpell({ ...input, spell: arcaneLock })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.spellMaterialPlan).toMatchObject({
      allocations: [{ tag: 'gold-dust', quantity: 1, consumed: true }],
    })

    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: { decision: 'approved', effects: [] },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent',
    }))
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({
      type: 'condition-applied',
    }))
    expect(resolved.application?.characters.find((entry) => entry.id === input.actor.id)
      ?.classResources?.['dnd5e-spell-slot-2']).toEqual({ current: 0, max: 3 })
    expect(resolved.application?.map.tokens.find((entry) => entry.id === object.id))
      .toEqual(object)
    expect(normalizeDnd5eInventory(resolved.application!.characters[0]).entries).toHaveLength(0)
  })

  it('settles Prestidigitation without a target or DM effects and spends its combat action', () => {
    const input = fixture()
    const spell = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'prestidigitation')!
    input.actor.level = 1
    input.actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-cantrips': [spell.id] } } },
    }
    input.characters = [input.actor]
    input.action.dnd5eAdjudicatedSpell = {
      spellId: spell.id,
      castingClassId: 'wizard',
      slotLevel: 0,
      narrativeOnly: true,
    }

    const prepared = prepareDnd5eAdjudicatedSpell({ ...input, spell })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: { decision: 'approved', effects: [] },
    })

    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: input.actorToken.id, resource: 'action',
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'spell-cast', actorId: input.actorToken.id, targetId: input.actorToken.id,
      spellId: 'prestidigitation', slotLevel: 0,
    }))
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({ type: 'class-resource-spent' }))
    expect(resolved.application?.map.tokens.map((token) => ({
      id: token.id, x: token.x, y: token.y, hp: token.hp, maxHp: token.maxHp,
    }))).toEqual(input.map.tokens.map((token) => ({
      id: token.id, x: token.x, y: token.y, hp: token.hp, maxHp: token.maxHp,
    })))
  })

  it('settles Divination through voice narrative at base, ritual and upcast levels', () => {
    const configure = (slotLevel: 4 | 5, ritual = false) => {
      const input = fixture()
      const divination = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'divination')!
      input.actor.charClass = '牧师'
      input.actor.level = 20
      input.actor.dnd5eClassLevels = { cleric: 20 }
      input.actor.dnd5eClassChoices = {
        classes: { cleric: { selections: { 'spell-prepared': [divination.id] } } },
      }
      input.actor.classResources = {
        'dnd5e-spell-slot-4': { current: 2, max: 3 },
        'dnd5e-spell-slot-5': { current: 1, max: 3 },
      }
      const withOfferings = applyDnd5eInventoryMutation([input.actor], {
        type: 'grant',
        characterId: input.actor.id,
        templateId: 'srd-5.1:item:religious-offering-25gp',
        quantity: 1,
      })
      expect(withOfferings.ok).toBe(true)
      input.actor = withOfferings.characters[0]
      input.characters = [input.actor]
      input.action.dnd5eAdjudicatedSpell = {
        spellId: divination.id,
        castingClassId: 'cleric',
        slotLevel,
        narrativeOnly: true,
        ...(ritual ? { ritual: true as const } : {}),
      }
      return { input, divination }
    }

    const base = configure(4)
    const basePrepared = prepareDnd5eAdjudicatedSpell({ ...base.input, spell: base.divination })
    expect(basePrepared).toMatchObject({
      ok: true,
      prepared: {
        slotLevel: 4,
        ritual: false,
        elapsedCastingMinutes: 0,
        spellMaterialPlan: {
          allocations: [{ tag: 'religious-offering', quantity: 1, consumed: true }],
        },
      },
    })

    const ritual = configure(4, true)
    const ritualPrepared = prepareDnd5eAdjudicatedSpell({ ...ritual.input, spell: ritual.divination })
    expect(ritualPrepared).toMatchObject({
      ok: true,
      prepared: { slotLevel: 4, ritual: true, castingTime: 'long', elapsedCastingMinutes: 10 },
    })
    if (ritualPrepared.ok) {
      const ritualResolved = resolvePreparedDnd5eAdjudicatedSpell({
        prepared: ritualPrepared.prepared,
        response: { decision: 'approved', effects: [] },
      })
      expect(ritualResolved.result.ok).toBe(true)
      expect(ritualResolved.result.events).not.toContainEqual(expect.objectContaining({ type: 'turn-resource-spent' }))
      expect(ritualResolved.application?.characters[0]?.classResources).toMatchObject({
        'dnd5e-spell-slot-4': { current: 2, max: 3 },
        'dnd5e-spell-slot-5': { current: 1, max: 3 },
      })
      expect(normalizeDnd5eInventory(ritualResolved.application!.characters[0]).entries).toHaveLength(0)
      expect(ritualResolved.application?.changedCharacterIds).toContain(ritual.input.actor.id)
      expect(normalizeDnd5eInventory({
        ...ritual.input.actor,
        ...ritualResolved.application?.characterPatches?.[ritual.input.actor.id],
      }).entries).toHaveLength(0)
    }

    const upcast = configure(5)
    const upcastPrepared = prepareDnd5eAdjudicatedSpell({ ...upcast.input, spell: upcast.divination })
    expect(upcastPrepared).toMatchObject({ ok: true, prepared: { slotLevel: 5, ritual: false } })
    if (upcastPrepared.ok) {
      const upcastResolved = resolvePreparedDnd5eAdjudicatedSpell({
        prepared: upcastPrepared.prepared,
        response: { decision: 'approved', effects: [] },
      })
      expect(upcastResolved.result.ok).toBe(true)
      expect(upcastResolved.result.events).not.toContainEqual(expect.objectContaining({ type: 'damage-applied' }))
      expect(upcastResolved.result.events).not.toContainEqual(expect.objectContaining({ type: 'condition-applied' }))
      expect(upcastResolved.application?.characters[0]?.classResources).toMatchObject({
        'dnd5e-spell-slot-4': { current: 2, max: 3 },
        'dnd5e-spell-slot-5': { current: 0, max: 3 },
      })
      expect(normalizeDnd5eInventory(upcastResolved.application!.characters[0]).entries).toHaveLength(0)
      expect(upcastResolved.application?.changedCharacterIds).toContain(upcast.input.actor.id)
      expect(normalizeDnd5eInventory({
        ...upcast.input.actor,
        ...upcastResolved.application?.characterPatches?.[upcast.input.actor.id],
      }).entries).toHaveLength(0)
    }
  })

  it('settles Disintegrate\'s explicit object branch as slot-only voice narrative', () => {
    const input = fixture()
    const disintegrate = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'disintegrate')!
    input.actor.level = 11
    input.actor.dnd5eClassLevels = { wizard: 11 }
    input.actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-prepared': [disintegrate.id] } } },
    }
    input.actor.classResources = { 'dnd5e-spell-slot-6': { current: 1, max: 1 } }
    input.characters = [input.actor]
    input.action.dnd5eAdjudicatedSpell = {
      spellId: disintegrate.id,
      castingClassId: 'wizard',
      slotLevel: 6,
      narrativeOnly: true,
    }

    const prepared = prepareDnd5eAdjudicatedSpell({ ...input, spell: disintegrate })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: { decision: 'approved', effects: [] },
    })

    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({ type: 'damage-applied' }))
    expect(resolved.application?.map.tokens.find((entry) => entry.id === input.enemy.id))
      .toMatchObject({ id: input.enemy.id, hp: input.enemy.hp, maxHp: input.enemy.maxHp })
    expect(resolved.application?.characters[0]?.classResources?.['dnd5e-spell-slot-6'])
      .toEqual({ current: 0, max: 1 })
  })

  it('applies the authoritative Etherealness planar phase and validates base-slot targeting', () => {
    const input = fixture()
    const etherealness = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'etherealness')!
    input.actor.level = 20
    input.actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-prepared': [etherealness.id] } } },
    }
    input.actor.classResources = { 'dnd5e-spell-slot-7': { current: 2, max: 2 } }
    input.action.dnd5eAdjudicatedSpell = { spellId: etherealness.id, slotLevel: 7 }
    const prepared = prepareDnd5eAdjudicatedSpell({ ...input, spell: etherealness })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const invalidTarget = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved',
        effects: [{
          targetTokenId: input.enemy.id,
          addCondition: '以太化',
          conditionDurationRounds: 4_800,
          conditionDurationTickOn: 'target-turn-end',
        }],
      },
    })
    expect(invalidTarget.result).toMatchObject({ ok: false, reason: 'invalid-target' })

    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved',
        effects: [{
          targetTokenId: input.actorToken.id,
          addCondition: '以太化',
          conditionDurationRounds: 4_800,
          conditionDurationTickOn: 'target-turn-end',
        }],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    const actor = resolved.result.state.combatants[input.actorToken.id]
    expect(actor.classResources['dnd5e-spell-slot-7']).toEqual({ current: 1, max: 2 })
    expect(actor.classState.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: '以太化',
        duration: expect.objectContaining({ type: 'rounds', remainingRounds: 4_800 }),
        modifiers: {
          planarPhase: {
            plane: 'ethereal',
            ignoresMaterialCollision: true,
            suppressCrossPlaneEffects: true,
            unrestrictedVerticalMovement: true,
          },
        },
      }),
    ]))
  })

  it('projects Alter Self modes into concentration-linked movement and natural-weapon mechanics', () => {
    const entries = dnd5eSpellbookEntries([])
    const alterSelf = entries.find((entry) => entry.id === 'alter-self')!
    const aquaticInput = fixture()
    aquaticInput.actor.level = 20
    aquaticInput.actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-prepared': [alterSelf.id] } } },
    }
    aquaticInput.actor.classResources = { 'dnd5e-spell-slot-2': { current: 2, max: 3 } }
    aquaticInput.action.dnd5eAdjudicatedSpell = { spellId: alterSelf.id, slotLevel: 2 }
    const aquaticPrepared = prepareDnd5eAdjudicatedSpell({ ...aquaticInput, spell: alterSelf })
    expect(aquaticPrepared).toMatchObject({
      ok: true,
      prepared: { concentration: true, suggestedConcentrationRounds: 600 },
    })
    if (!aquaticPrepared.ok) return

    const aquatic = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: aquaticPrepared.prepared,
      response: {
        decision: 'approved',
        concentrationRounds: 600,
        effects: [{
          targetTokenId: aquaticInput.actorToken.id,
          addCondition: '变身术·水生适应（水下呼吸；游泳速度=步行速度）',
        }],
      },
    })
    expect(aquatic.result.ok).toBe(true)
    if (!aquatic.result.ok) return
    const aquaticActor = aquatic.result.state.combatants[aquaticInput.actorToken.id]
    expect(aquaticActor.classState.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        tags: ['alter-self', 'alter-self-aquatic-adaptation'],
        duration: expect.objectContaining({ type: 'concentration', remainingRounds: 600 }),
        modifiers: {
          swimSpeedEqualsWalking: true,
          environmentalCapabilities: { breatheIn: ['water'] },
        },
      }),
    ]))
    expect(dnd5eEffectiveOptionalMovementSpeed(aquaticActor, 'swim')).toBe(30)

    const naturalInput = fixture()
    naturalInput.actor.level = 20
    naturalInput.actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-prepared': [alterSelf.id] } } },
    }
    naturalInput.actor.classResources = { 'dnd5e-spell-slot-9': { current: 1, max: 1 } }
    naturalInput.action.dnd5eAdjudicatedSpell = { spellId: alterSelf.id, slotLevel: 9 }
    const naturalPrepared = prepareDnd5eAdjudicatedSpell({ ...naturalInput, spell: alterSelf })
    expect(naturalPrepared.ok).toBe(true)
    if (!naturalPrepared.ok) return
    const natural = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: naturalPrepared.prepared,
      response: {
        decision: 'approved',
        concentrationRounds: 600,
        effects: [{
          targetTokenId: naturalInput.actorToken.id,
          addCondition: '变身术·天生武器（魔法爪；1d6挥砍；熟练；攻击与伤害+1）',
        }],
      },
    })
    expect(natural.result.ok).toBe(true)
    if (!natural.result.ok) return
    expect(natural.result.state.combatants[naturalInput.actorToken.id].classState.activeEffects)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          tags: ['alter-self', 'alter-self-natural-weapon', 'alter-self-natural-weapon:slashing'],
          duration: expect.objectContaining({ type: 'concentration', remainingRounds: 600 }),
          source: expect.objectContaining({ magical: true }),
        }),
      ]))
  })

  it('removes concentration from Major Image when it is cast with a 6th-level slot', () => {
    const input = fixture()
    const majorImage = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'major-image')!
    input.actor.level = 20
    input.actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-prepared': [majorImage.id] } } },
    }
    input.actor.classResources = {
      'dnd5e-spell-slot-3': { current: 1, max: 3 },
      'dnd5e-spell-slot-6': { current: 1, max: 2 },
    }

    input.action.dnd5eAdjudicatedSpell = { spellId: majorImage.id, slotLevel: 3 }
    expect(prepareDnd5eAdjudicatedSpell({ ...input, spell: majorImage })).toMatchObject({
      ok: true,
      prepared: { concentration: true, suggestedConcentrationRounds: 100 },
    })

    input.action.dnd5eAdjudicatedSpell = { spellId: majorImage.id, slotLevel: 6 }
    const upcast = prepareDnd5eAdjudicatedSpell({ ...input, spell: majorImage })
    expect(upcast).toMatchObject({ ok: true, prepared: { concentration: false } })
    if (!upcast.ok) return
    expect(upcast.prepared.suggestedConcentrationRounds).toBeUndefined()
  })

  it('allows a Host-validated ritual to complete without spending an action or spell slot', () => {
    const input = fixture()
    const ritualSpell = {
      ...input.spell,
      headless: true,
      automationLevel: 'full' as const,
      imported: { ...input.spell.imported!, ritual: true },
    }
    input.action.dnd5eAdjudicatedSpell = {
      spellId: ritualSpell.id,
      slotLevel: ritualSpell.level,
      castingClassId: 'wizard',
      ritual: true,
    }
    input.actor.classResources = { 'dnd5e-spell-slot-1': { current: 0, max: 4 } }
    const prepared = prepareDnd5eAdjudicatedSpell({
      ...input,
      spell: ritualSpell,
      turnEconomy: {
        turnKey: 'combat:1:wizard-token', attacksUsed: 0,
        action: { current: 1, max: 1 }, bonusAction: { current: 1, max: 1 },
        reaction: { current: 1, max: 1 }, movement: { current: 30, max: 30 },
      },
    })
    expect(prepared).toMatchObject({ ok: true, prepared: { castingTime: 'long', ritual: true } })
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved',
        effects: [{
          targetTokenId: input.actorToken.id,
          addCondition: '仪式效果',
          conditionDurationRounds: 600,
          conditionDurationTickOn: 'target-turn-end',
        }],
        note: '原施法时间加 10 分钟。',
      },
    })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[input.actorToken.id].turn.actionAvailable).toBe(true)
    expect(resolved.result.state.combatants[input.actorToken.id].classResources['dnd5e-spell-slot-1'])
      .toEqual({ current: 0, max: 4 })
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({ type: 'turn-resource-spent' }))
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({ type: 'class-resource-spent' }))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'spell-cast',
      spellId: ritualSpell.id,
      slotLevel: ritualSpell.level,
      slotConsumed: false,
    }))
    expect(resolved.result.state.combatants[input.actorToken.id].conditions).toContain('仪式效果')
  })

  it('rejects ritual intent when the spell lacks the ritual tag', () => {
    const input = fixture()
    input.action.dnd5eAdjudicatedSpell = {
      spellId: input.spell.id,
      slotLevel: input.spell.level,
      castingClassId: 'wizard',
      ritual: true,
    }
    expect(prepareDnd5eAdjudicatedSpell(input)).toEqual({
      ok: false,
      reason: 'ritual-unavailable',
    })
  })

  it('spends the slot and casting action while applying only effects explicitly approved by the DM', () => {
    const input = fixture()
    const prepared = prepareDnd5eAdjudicatedSpell({
      ...input,
      turnEconomy: {
        turnKey: 'combat:1:wizard-token', attacksUsed: 0,
        action: { current: 1, max: 1 }, bonusAction: { current: 1, max: 1 },
        reaction: { current: 1, max: 1 }, movement: { current: 30, max: 30 },
      },
    })
    expect(prepared.ok).toBe(true)
    expect(input.actor.classResources?.['dnd5e-spell-slot-1']).toEqual({ current: 1, max: 4 })
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved',
        effects: [
          {
            targetTokenId: input.enemy.id,
            operation: 'damage',
            amount: 7,
            addCondition: '倒地',
            conditionDurationRounds: 600,
            conditionDurationTickOn: 'target-turn-end',
          },
          { targetTokenId: input.enemy.id, operation: 'temporary-hit-points', amount: 5 },
        ],
        note: '敏捷豁免失败。',
      },
    })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[input.actorToken.id].turn.actionAvailable).toBe(false)
    expect(resolved.result.state.combatants[input.actorToken.id].classResources['dnd5e-spell-slot-1']).toEqual({ current: 0, max: 4 })
    expect(resolved.application?.characters.find((character) => character.id === input.actor.id)
      ?.classResources?.['dnd5e-spell-slot-1']).toEqual({ current: 0, max: 4 })
    expect(resolved.application?.characterPatches?.[input.actor.id]
      ?.classResources?.['dnd5e-spell-slot-1']).toEqual({ current: 0, max: 4 })
    expect(resolved.result.state.combatants[input.enemy.id]).toMatchObject({ currentHp: 23, temporaryHp: 5, conditions: ['倒地'] })
    expect(resolved.result.state.combatants[input.enemy.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        legacyCondition: '倒地',
        duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
      }),
    )
    expect(resolved.application?.map.tokens.find((entry) => entry.id === input.enemy.id)?.dnd5eCombatState?.temporaryHp).toBe(5)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'adjudicated-spell-resolved', spellId: input.spell.id, effectCount: 2,
    }))
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: input.actorToken.id, resource: 'action',
    })
  })

  it('applies Host damage defenses when the DM supplies a damage type', () => {
    const input = fixture()
    input.enemy.poolId = 'srd-5.1:air-elemental'
    input.enemy.hp = 90
    input.enemy.maxHp = 90
    const prepared = prepareDnd5eAdjudicatedSpell({
      ...input,
      turnEconomy: {
        turnKey: 'combat:1:wizard-token', attacksUsed: 0,
        action: { current: 1, max: 1 }, bonusAction: { current: 1, max: 1 },
        reaction: { current: 1, max: 1 }, movement: { current: 30, max: 30 },
      },
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved',
        effects: [{
          targetTokenId: input.enemy.id,
          operation: 'damage',
          amount: 34,
          damageType: 'lightning',
        }],
      },
    })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[input.enemy.id].currentHp).toBe(73)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'damage-defense-resolved',
      targetId: input.enemy.id,
      damageType: 'lightning',
      damageBefore: 34,
      damageAfter: 17,
    }))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied', targetId: input.enemy.id, amount: 17,
      damageTypes: ['lightning'],
    }))
  })

  it('tracks targetless terrain concentration on the caster after DM approval', () => {
    const input = fixture()
    input.spell = {
      ...input.spell,
      imported: {
        ...input.spell.imported!,
        duration: { type: 'timed', value: 2, unit: 'hour', concentration: true },
      },
    }
    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared).toMatchObject({
      ok: true,
      prepared: { concentration: true, suggestedConcentrationRounds: 1_200 },
    })
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: { decision: 'approved', effects: [], concentrationRounds: 1_200 },
    })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[input.actorToken.id]).toMatchObject({
      concentrating: true,
      classState: {
        concentrationSpellId: input.spell.id,
        concentrationTargetIds: [input.actorToken.id],
        concentrationRoundsRemaining: 1_200,
      },
    })
    expect(resolved.application?.characters[0]).toMatchObject({
      concentrating: true,
      dnd5eCombatState: {
        concentrationSpellId: input.spell.id,
        concentrationTargetIds: [input.actorToken.id],
        concentrationRoundsRemaining: 1_200,
      },
    })
  })

  it('projects a Host-validated build-granted spell into the adjudicated combat entitlement', () => {
    const input = fixture()
    input.actor.dnd5eClassChoices = { classes: { wizard: { selections: {} } } }
    input.actor.dnd5eContentChoices = {
      'local.test:spell-grant': {
        schemaVersion: 1,
        contentId: 'local.test:spell-grant',
        selections: {},
        resolvedGrants: [{
          kind: 'spell', spellId: input.spell.id, mode: 'once-per-long-rest',
          ability: 'int', castAtLevel: 1,
        }],
      },
    }

    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(
      prepared.prepared.state.combatants[input.actorToken.id]
        .classSelectionsByClass?.wizard?.['spell-prepared'],
    ).toContain(input.spell.id)

    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved',
        effects: [{ targetTokenId: input.enemy.id, addCondition: '裁定效果' }],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
  })

  it('gives each Seeming cast one action controller that dismisses all of its target appearances', () => {
    const input = fixture()
    input.spell = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'seeming')!
    input.actor.level = 20
    input.actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-prepared': ['seeming'] } } },
    }
    input.actor.classResources = { 'dnd5e-spell-slot-5': { current: 1, max: 3 } }
    input.action.id = 'map:player-action:Seeming/Cast One'
    input.action.dnd5eAdjudicatedSpell = { spellId: 'seeming', slotLevel: 5 }

    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved',
        effects: [input.actorToken.id, input.enemy.id].map((targetTokenId) => ({
          targetTokenId,
          addCondition: '伪装术·统一外观',
          conditionDurationRounds: 4_800,
          conditionDurationTickOn: 'target-turn-end' as const,
        })),
      },
    })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return

    const actor = resolved.result.state.combatants[input.actorToken.id]
    const controller = actor.classState.activeEffects?.find((effect) =>
      effect.definitionId.startsWith('adjudicated:seeming-controller:'))
    expect(controller).toMatchObject({
      label: '伪装术·提前解除',
      duration: { type: 'rounds', remainingRounds: 4_800 },
      removal: {
        action: { label: '解除本次伪装术', economy: 'action', maxDistanceFeet: 0 },
      },
    })
    expect(resolved.result.state.combatants[input.enemy.id].classState.activeEffects)
      .toContainEqual(expect.objectContaining({
        legacyCondition: '伪装术·统一外观',
        removal: { sourceLink: { sourceRequiresEffect: controller?.definitionId } },
      }))
    expect(controller?.definitionId).toMatch(/^[a-z0-9][a-z0-9._:-]{0,255}$/)
    expect(normalizeDnd5eActiveEffects(
      resolved.result.state.combatants[input.enemy.id].classState.activeEffects,
    )).toContainEqual(expect.objectContaining({
      legacyCondition: '伪装术·统一外观',
      removal: { sourceLink: { sourceRequiresEffect: controller?.definitionId } },
    }))

    actor.turn.actionAvailable = true
    const dismissed = resolveDnd5eHeadlessAction(resolved.result.state, {
      type: 'remove-active-effect',
      actorId: actor.id,
      targetId: actor.id,
      effectId: controller!.id,
    })
    expect(dismissed.ok).toBe(true)
    if (!dismissed.ok) return
    expect(dismissed.state.combatants[actor.id].turn.actionAvailable).toBe(false)
    for (const combatant of Object.values(dismissed.state.combatants)) {
      expect(combatant.classState.activeEffects ?? []).not.toContainEqual(
        expect.objectContaining({ source: expect.objectContaining({ rulesId: 'seeming' }) }),
      )
      expect(combatant.conditions).not.toContain('伪装术·统一外观')
    }
  })

  it('requires a bounded Sending declaration and spends an upcast slot without inventing scaling', () => {
    const input = fixture()
    input.spell = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'sending')!
    input.actor.level = 20
    input.actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-prepared': ['sending'] } } },
    }
    input.actor.classResources = { 'dnd5e-spell-slot-6': { current: 1, max: 2 } }
    input.actor.equipment = {
      offHand: {
        id: 'dnd5e-arcane-focus',
        name: '奥术法器',
        slot: 'mainWeapon',
        spellcastingFocusClassIds: ['wizard'],
      },
    }
    input.action.dnd5eAdjudicatedSpell = { spellId: 'sending', slotLevel: 6 }
    expect(prepareDnd5eAdjudicatedSpell(input)).toEqual({ ok: false, reason: 'invalid-action' })

    input.action.dnd5eAdjudicatedSpell = {
      spellId: 'sending',
      slotLevel: 6,
      sending: {
        schemaVersion: 1,
        recipientName: '银月城档案员伊蕾娜',
        message: '月门安全，立即回报。',
      },
    }
    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved',
        effects: [],
        sending: {
          schemaVersion: 1,
          targetIntelligenceAtLeastOne: true,
          plane: 'different',
          crossPlaneRoll: 37,
          delivered: true,
          reply: '档案已经封存。',
        },
      },
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.state.combatants[input.actorToken.id].classResources['dnd5e-spell-slot-6'])
      .toEqual({ current: 0, max: 2 })
    expect(resolved.result.state.combatants[input.enemy.id]).toMatchObject({
      currentHp: input.enemy.hp,
      conditions: [],
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'adjudicated-spell-resolved', spellId: 'sending', slotLevel: 6, effectCount: 0,
    }))
  })

  it('rejects a contradictory Sending cross-plane result before spending the slot', () => {
    const input = fixture()
    input.spell = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'sending')!
    input.actor.level = 20
    input.actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-prepared': ['sending'] } } },
    }
    input.actor.classResources = { 'dnd5e-spell-slot-7': { current: 1, max: 1 } }
    input.actor.equipment = {
      offHand: {
        id: 'dnd5e-arcane-focus', name: '奥术法器', slot: 'mainWeapon',
        spellcastingFocusClassIds: ['wizard'],
      },
    }
    input.action.dnd5eAdjudicatedSpell = {
      spellId: 'sending', slotLevel: 7,
      sending: { schemaVersion: 1, recipientName: '伊蕾娜', message: '请回应。' },
    }
    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved', effects: [],
        sending: {
          schemaVersion: 1, targetIntelligenceAtLeastOne: true,
          plane: 'different', crossPlaneRoll: 3, delivered: true,
        },
      },
    })
    expect(resolved.result.ok).toBe(false)
    expect(resolved.result.state.combatants[input.actorToken.id].classResources['dnd5e-spell-slot-7'])
      .toEqual({ current: 1, max: 1 })
  })

  it('validates Animal Messenger as a visible-range Tiny beast declaration and scales duration at 4th level', () => {
    const input = fixture()
    input.spell = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'animal-messenger')!
    input.actor.level = 20
    input.actor.charClass = '德鲁伊'
    input.actor.dnd5eClassChoices = {
      classes: { druid: { selections: { 'spell-prepared': ['animal-messenger'] } } },
    }
    input.actor.classResources = { 'dnd5e-spell-slot-4': { current: 1, max: 3 } }
    input.actor.equipment = {
      offHand: {
        id: 'druidic-focus', name: '德鲁伊法器', slot: 'mainWeapon',
        spellcastingFocusClassIds: ['druid'],
      },
    }
    input.enemy.label = '蝙蝠'
    input.enemy.x = 125
    input.enemy.creatureSize = '微型'
    input.enemy.creatureTypes = ['野兽']
    input.enemy.poolId = 'srd-5.1:bat'
    input.action.dnd5eAdjudicatedSpell = {
      spellId: 'animal-messenger',
      castingClassId: 'druid',
      slotLevel: 4,
      animalMessenger: {
        schemaVersion: 1,
        targetTokenId: input.enemy.id,
        targetName: '蝙蝠',
        destination: '银月城东门驿站',
        recipientDescription: '身穿紫色法袍、佩戴银月徽记的法师',
        message: '测试营地安全，请在日落前回信。',
        routeDistanceMiles: 80,
      },
    }
    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    expect(resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved', effects: [],
        animalMessenger: {
          schemaVersion: 1,
          destinationPreviouslyVisitedConfirmed: false,
          targetVisibleConfirmed: true,
        },
      },
    }).result.ok).toBe(false)

    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved', effects: [],
        animalMessenger: {
          schemaVersion: 1,
          destinationPreviouslyVisitedConfirmed: true,
          targetVisibleConfirmed: true,
        },
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[input.actorToken.id].classResources['dnd5e-spell-slot-4'])
      .toEqual({ current: 0, max: 3 })
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({ type: 'damage-applied' }))
    expect(resolved.result.state.combatants[input.enemy.id].conditions).toContain('动物信使')
    expect(resolved.result.state.combatants[input.enemy.id].classState.activeEffects)
      .toContainEqual(expect.objectContaining({
        label: '动物信使',
        duration: expect.objectContaining({ type: 'rounds', remainingRounds: 72_000 }),
      }))
  })

  it('rejects Animal Messenger when the declared target is not a Tiny beast', () => {
    const input = fixture()
    input.spell = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'animal-messenger')!
    input.actor.level = 20
    input.actor.charClass = '德鲁伊'
    input.actor.dnd5eClassChoices = {
      classes: { druid: { selections: { 'spell-prepared': ['animal-messenger'] } } },
    }
    input.actor.classResources = { 'dnd5e-spell-slot-2': { current: 1, max: 3 } }
    input.actor.equipment = {
      offHand: {
        id: 'druidic-focus', name: '德鲁伊法器', slot: 'mainWeapon',
        spellcastingFocusClassIds: ['druid'],
      },
    }
    input.enemy.label = '战马'
    input.enemy.creatureSize = '大型'
    input.enemy.creatureTypes = ['野兽']
    input.enemy.poolId = 'srd-5.1:warhorse'
    input.action.dnd5eAdjudicatedSpell = {
      spellId: 'animal-messenger',
      castingClassId: 'druid',
      slotLevel: 2,
      animalMessenger: {
        schemaVersion: 1,
        targetTokenId: input.enemy.id,
        targetName: '战马',
        destination: '银月城东门驿站',
        recipientDescription: '紫袍法师',
        message: '请回信。',
        routeDistanceMiles: 10,
      },
    }
    expect(prepareDnd5eAdjudicatedSpell(input)).toEqual({ ok: false, reason: 'invalid-action' })
  })

  it('atomically turns three nearby remains into controlled undead when Animate Dead is cast at 4th level', () => {
    const input = fixture()
    input.spell = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'animate-dead')!
    input.actor.level = 20
    input.actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-prepared': ['animate-dead'] } } },
    }
    input.actor.classResources = { 'dnd5e-spell-slot-4': { current: 1, max: 3 } }
    input.actor.equipment = {
      offHand: {
        id: 'arcane-focus', name: '奥术法器', slot: 'mainWeapon',
        spellcastingFocusClassIds: ['wizard'],
      },
    }
    const remains: Token[] = [
      {
        id: 'bones-a', label: '骨骸堆 A', x: 75, y: 25, color: '', emoji: '🦴', size: 1,
        type: 'obstacle', dnd5eObjectState: { schemaVersion: 1, remains: { kind: 'bone-pile' } },
      },
      {
        id: 'corpse-b', label: '尸体 B', x: 25, y: 75, color: '', emoji: '⚰️', size: 1,
        type: 'obstacle', dnd5eObjectState: {
          schemaVersion: 1, remains: { kind: 'humanoid-corpse', creatureSize: 'small' },
        },
      },
      {
        id: 'corpse-c', label: '尸体 C', x: 75, y: 75, color: '', emoji: '⚰️', size: 1,
        type: 'obstacle', dnd5eObjectState: {
          schemaVersion: 1, remains: { kind: 'humanoid-corpse', creatureSize: 'medium' },
        },
      },
    ]
    input.map.tokens = [input.actorToken, input.enemy, ...remains]
    // Remains may legally share their square with another token. The spell
    // must use the nearest available square instead of failing after approval.
    input.enemy.x = remains[0]!.x
    input.enemy.y = remains[0]!.y
    input.action.combatId = undefined
    input.action.dnd5eAdjudicatedSpell = {
      spellId: 'animate-dead', slotLevel: 4,
      animateDead: {
        schemaVersion: 1, mode: 'animate',
        targets: remains.map((target) => ({
          tokenId: target.id,
          targetName: target.label,
          remainsKind: target.id === 'bones-a' ? 'bone-pile' : 'humanoid-corpse',
        })),
      },
    }
    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    expect(resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved', effects: [],
        animateDead: { schemaVersion: 1, targetsConfirmed: false },
      },
      worldMinute: 1_001,
    }).result.ok).toBe(false)

    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved', effects: [],
        animateDead: { schemaVersion: 1, targetsConfirmed: true },
      },
      worldMinute: 1_001,
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.some((target) => remains.some((entry) => entry.id === target.id))).toBe(false)
    const undead = resolved.application?.map.tokens.filter((target) =>
      target.dnd5eSummon?.featureId === 'spell:animate-dead') ?? []
    expect(undead).toHaveLength(3)
    expect(new Set(undead.map((target) => target.id)).size).toBe(3)
    expect(undead[0]).not.toMatchObject({ x: input.enemy.x, y: input.enemy.y })
    expect(undead.map((target) => target.poolId)).toEqual([
      'srd-5.1:skeleton', 'srd-5.1:zombie', 'srd-5.1:zombie',
    ])
    expect(undead.every((target) => target.dnd5eSummon?.controlExpiresAtWorldMinute === 2_441)).toBe(true)
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({ type: 'damage-applied' }))
    expect(resolved.result.state.combatants[input.actorToken.id].classResources['dnd5e-spell-slot-4'])
      .toEqual({ current: 0, max: 3 })
  })

  it('creates two controlled ghasts at night with an 8th-level slot and retains the exact costly materials', () => {
    const input = fixture()
    input.spell = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'create-undead')!
    input.actor.level = 20
    input.actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-prepared': ['create-undead'] } } },
    }
    input.actor.classResources = { 'dnd5e-spell-slot-8': { current: 1, max: 1 } }
    input.actor.equipment = {
      offHand: {
        id: 'arcane-focus', name: '奥术法器', slot: 'mainWeapon',
        spellcastingFocusClassIds: ['wizard'],
      },
    }
    for (const [templateId, quantity] of [
      ['srd-5.1:item:grave-dirt-clay-pot', 1],
      ['srd-5.1:item:brackish-water-clay-pot', 1],
      ['srd-5.1:item:black-onyx-150gp', 2],
    ] as const) {
      input.actor = applyDnd5eInventoryMutation([input.actor], {
        type: 'grant', characterId: input.actor.id, templateId, quantity,
      }).characters[0]!
    }
    input.characters = [input.actor]
    const remains: Token[] = [
      {
        id: 'corpse-a', label: '尸体 A', x: 75, y: 25, color: '', emoji: '⚰️', size: 1,
        type: 'obstacle', dnd5eObjectState: {
          schemaVersion: 1, remains: { kind: 'humanoid-corpse', creatureSize: 'small' },
        },
      },
      {
        id: 'corpse-b', label: '尸体 B', x: 25, y: 75, color: '', emoji: '⚰️', size: 1,
        type: 'obstacle', dnd5eObjectState: {
          schemaVersion: 1, remains: { kind: 'humanoid-corpse', creatureSize: 'medium' },
        },
      },
    ]
    input.map.tokens = [input.actorToken, input.enemy, ...remains]
    input.action.combatId = undefined
    input.action.dnd5eAdjudicatedSpell = {
      spellId: 'create-undead', slotLevel: 8,
      animateDead: {
        schemaVersion: 1, mode: 'animate', undeadKind: 'ghast',
        targets: remains.map((target) => ({
          tokenId: target.id, targetName: target.label, remainsKind: 'humanoid-corpse',
        })),
      },
    }
    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.elapsedCastingMinutes).toBe(1)
    expect(prepared.prepared.spellMaterialPlan?.allocations).toEqual(expect.arrayContaining([
      expect.objectContaining({ tag: 'grave-dirt-clay-pot', quantity: 1, consumed: false }),
      expect.objectContaining({ tag: 'brackish-water-clay-pot', quantity: 1, consumed: false }),
      expect.objectContaining({ tag: 'black-onyx', quantity: 2, consumed: false }),
    ]))
    const response = {
      decision: 'approved' as const,
      effects: [],
      animateDead: { schemaVersion: 1 as const, targetsConfirmed: true },
    }
    expect(resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared, response, worldMinute: 12 * 60,
    }).result.ok).toBe(false)

    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared, response, worldMinute: 23 * 60,
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    const undead = resolved.application?.map.tokens.filter((target) =>
      target.dnd5eSummon?.featureId === 'spell:create-undead') ?? []
    expect(undead).toHaveLength(2)
    expect(undead.map((target) => target.poolId)).toEqual(['srd-5.1:ghast', 'srd-5.1:ghast'])
    expect(undead.every((target) => target.dnd5eSummon?.controlExpiresAtWorldMinute === 23 * 60 + 1_440)).toBe(true)
    const inventory = normalizeDnd5eInventory(resolved.application?.characters[0]!)
    expect(inventory.entries.find((entry) => entry.templateId === 'srd-5.1:item:black-onyx-150gp')?.quantity).toBe(2)
    expect(resolved.result.state.combatants[input.actorToken.id].classResources['dnd5e-spell-slot-8'])
      .toEqual({ current: 0, max: 1 })
  })

  it('creates an actual mixed-material map object with 9th-level size scaling and exact expiry', () => {
    const input = fixture()
    input.spell = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'creation')!
    input.actor.level = 20
    input.actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-prepared': ['creation'] } } },
    }
    input.actor.classResources = { 'dnd5e-spell-slot-9': { current: 1, max: 1 } }
    input.actor.equipment = {
      offHand: {
        id: 'arcane-focus', name: '奥术法器', slot: 'mainWeapon',
        spellcastingFocusClassIds: ['wizard'],
      },
    }
    input.characters = [input.actor]
    input.action.combatId = undefined
    input.action.targetCell = { col: 2, row: 0 }
    input.action.dnd5eAdjudicatedSpell = {
      spellId: 'creation', slotLevel: 9,
      creation: {
        schemaVersion: 1,
        objectDescription: '宝石镶嵌木箱',
        materials: ['plant', 'gemstone'],
        edgeFeet: 25,
        targetCell: { col: 2, row: 0 },
      },
    }
    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.elapsedCastingMinutes).toBe(1)

    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: { decision: 'approved', effects: [] },
      worldMinute: 500,
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    const created = resolved.application?.map.tokens.find((candidate) =>
      candidate.dnd5eObjectState?.creation?.sourceActionId === input.action.id)
    expect(created).toMatchObject({
      label: '宝石镶嵌木箱', type: 'obstacle', size: 5,
      dnd5eObjectState: {
        magical: false,
        creation: {
          slotLevel: 9,
          materials: ['plant', 'gemstone'],
          edgeFeet: 25,
          createdWorldMinute: 500,
          expiresAtWorldMinute: 510,
          cannotBeSpellMaterial: true,
        },
      },
    })
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({ type: 'damage-applied' }))
    expect(resolved.result.state.combatants[input.actorToken.id].classResources['dnd5e-spell-slot-9'])
      .toEqual({ current: 0, max: 1 })
  })

  it('creates an upcast amount of water in an exact open map container without damage', () => {
    const input = fixture()
    input.spell = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'create-or-destroy-water')!
    input.actor.level = 5
    input.actor.charClass = '牧师'
    input.actor.dnd5eClassChoices = {
      classes: { cleric: { selections: { 'spell-prepared': ['create-or-destroy-water'] } } },
    }
    input.actor.classResources = { 'dnd5e-spell-slot-3': { current: 1, max: 1 } }
    input.actor.equipment = {
      offHand: {
        id: 'holy-symbol', name: '圣徽', slot: 'mainWeapon',
        spellcastingFocusClassIds: ['cleric'],
      },
    }
    input.characters = [input.actor]
    input.action.combatId = undefined
    const cistern: Token = {
      id: 'cistern', label: '敞口蓄水池', x: 75, y: 25, color: '#22d3ee', emoji: '🪣',
      size: 1, type: 'obstacle',
      dnd5eObjectState: {
        schemaVersion: 1,
        waterContainer: { schemaVersion: 1, open: true, capacityGallons: 50, waterGallons: 0 },
      },
    }
    input.map.tokens.push(cistern)
    input.action.targetCell = { col: 1, row: 0 }
    input.action.dnd5eAdjudicatedSpell = {
      spellId: 'create-or-destroy-water', slotLevel: 3,
      createOrDestroyWater: {
        schemaVersion: 1, mode: 'create-container', targetCell: { col: 1, row: 0 },
        targetObjectId: cistern.id, targetObjectName: cistern.label, gallons: 30,
      },
    }
    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: { decision: 'approved', effects: [] },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((token) => token.id === cistern.id)?.dnd5eObjectState)
      .toMatchObject({
        waterContainer: { open: true, capacityGallons: 50, waterGallons: 30 },
        consumable: { kind: 'drink', contaminants: [] },
      })
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({ type: 'damage-applied' }))
    expect(resolved.result.state.combatants[input.actorToken.id].classResources['dnd5e-spell-slot-3'])
      .toEqual({ current: 0, max: 1 })
  })

  it('removes only overlapping Fog Cloud areas and ends an exhausted cloud concentration', () => {
    const input = fixture()
    input.spell = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'create-or-destroy-water')!
    input.actor.level = 5
    input.actor.charClass = '牧师'
    input.actor.dnd5eClassChoices = {
      classes: { cleric: { selections: { 'spell-prepared': ['create-or-destroy-water'] } } },
    }
    input.actor.classResources = { 'dnd5e-spell-slot-2': { current: 1, max: 1 } }
    input.actor.equipment = {
      offHand: {
        id: 'holy-symbol', name: '圣徽', slot: 'mainWeapon',
        spellcastingFocusClassIds: ['cleric'],
      },
    }
    input.actor.concentrating = true
    input.actor.dnd5eCombatState = {
      concentrationSpellId: 'fog-cloud',
      concentrationSpellLevel: 1,
      concentrationTargetIds: [input.actorToken.id],
      concentrationRoundsRemaining: 600,
    }
    input.characters = [input.actor]
    input.action.combatId = undefined
    input.map.dnd5ePluginAreas = [{
      id: 'fog-near', pluginId: 'core-srd-spell', featureId: 'spell:fog-cloud',
      sourceKind: 'core-spell', coreSpellId: 'fog-cloud', label: '云雾术', color: '#94a3b8',
      sourceCharacterId: input.actor.id, sourceTokenId: input.actorToken.id,
      concentrationId: 'fog-cloud', cells: [{ col: 2, row: 1 }],
      createdRound: 1, expiresAfterRound: 11,
    }, {
      id: 'fog-far', pluginId: 'core-srd-spell', featureId: 'spell:fog-cloud',
      sourceKind: 'core-spell', coreSpellId: 'fog-cloud', label: '云雾术', color: '#94a3b8',
      sourceCharacterId: 'other', sourceTokenId: 'other-token', cells: [{ col: 15, row: 8 }],
      createdRound: 1, expiresAfterRound: 11,
    }]
    input.action.targetCell = { col: 1, row: 0 }
    input.action.dnd5eAdjudicatedSpell = {
      spellId: 'create-or-destroy-water', slotLevel: 2,
      createOrDestroyWater: {
        schemaVersion: 1, mode: 'destroy-fog', targetCell: { col: 1, row: 0 },
        areaEdgeFeet: 35, fogAreaIds: ['fog-near'],
      },
    }
    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: { decision: 'approved', effects: [] },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.dnd5ePluginAreas?.map((area) => area.id)).toEqual(['fog-far'])
    expect(resolved.result.state.combatants[input.actorToken.id]).toMatchObject({
      concentrating: false,
      classState: { concentrationSpellId: undefined, concentrationRoundsRemaining: undefined },
    })
    const resolvedActor = resolved.application?.characters.find((character) =>
      character.id === input.actor.id)
    expect(resolvedActor).toMatchObject({ concentrating: false })
    expect(resolvedActor?.dnd5eCombatState?.concentrationSpellId).toBeUndefined()
    expect(resolvedActor?.dnd5eCombatState?.concentrationRoundsRemaining).toBeUndefined()
  })

  it('settles an upcast Sequester creature target without scaling and breaks the full suspension on damage', () => {
    const input = fixture()
    input.spell = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'sequester')!
    input.actor.level = 20
    input.actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-prepared': ['sequester'] } } },
    }
    input.actor.classResources = { 'dnd5e-spell-slot-8': { current: 1, max: 1 } }
    input.actor = applyDnd5eInventoryMutation([input.actor], {
      type: 'grant', characterId: input.actor.id,
      templateId: 'srd-5.1:item:mixed-gem-dust-5000gp', quantity: 2,
    }).characters[0]!
    input.characters = [input.actor]
    input.enemy.x = 75
    input.enemy.label = '自愿测试目标'
    const willingTarget: Character = {
      ...wizard(''),
      id: 'willing-target-character',
      name: '自愿测试目标',
      dnd5eClassChoices: undefined,
      classResources: undefined,
    }
    input.enemy.type = 'player'
    input.enemy.characterId = willingTarget.id
    input.characters = [input.actor, willingTarget]
    input.action.dnd5eAdjudicatedSpell = {
      spellId: 'sequester',
      slotLevel: 8,
      sequester: {
        schemaVersion: 1,
        targetKind: 'creature',
        targetTokenId: input.enemy.id,
        targetName: input.enemy.label,
        endingCondition: '银钟在一英里内敲响三次',
      },
    }
    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved', effects: [],
        sequester: { schemaVersion: 1, willingCreatureConfirmed: false },
      },
    }).result.ok).toBe(false)

    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved', effects: [],
        sequester: { schemaVersion: 1, willingCreatureConfirmed: true },
      },
    })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[input.actorToken.id].classResources['dnd5e-spell-slot-8'])
      .toEqual({ current: 0, max: 1 })
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({ type: 'damage-applied' }))
    expect(resolved.result.state.combatants[input.enemy.id].classState.activeEffects)
      .toContainEqual(expect.objectContaining({
        label: '隔离术·假死（隐形／预言免疫）',
        standardCondition: 'invisible',
        duration: { type: 'permanent' },
        breakOn: ['takes-damage'],
        modifiers: expect.objectContaining({
          preventActions: true,
          speedOverrideFeet: 0,
          spellTargetingImmunitySchools: ['divination'],
        }),
      }))
    expect(validateDnd5eActiveEffectsStrict(
      resolved.result.state.combatants[input.enemy.id].classState.activeEffects,
    )).toMatchObject({ ok: true })
    expect(resolved.result.state.combatants[input.enemy.id].conditions).toEqual(['隔离术·假死'])
    expect(resolved.application?.characters[0]?.dnd5eInventory?.entries.find((entry) =>
      entry.templateId === 'srd-5.1:item:mixed-gem-dust-5000gp')?.quantity).toBe(1)
    expect(validateSharedStateShape('characters', {
      characters: resolved.application?.characters,
      selectedId: input.actor.id,
      updatedAt: 1,
    })).toEqual({ ok: true })
    expect(validateSharedStateShape('maps', {
      maps: [resolved.application?.map],
      selectedId: input.map.id,
      updatedAt: 1,
    })).toEqual({ ok: true })

    const damageCaster = resolved.result.state.combatants[input.actorToken.id]
    damageCaster.turn.actionAvailable = true
    damageCaster.classResources['dnd5e-spell-slot-1'] = { current: 1, max: 1 }
    damageCaster.classSelections['spell-prepared'] = ['test.rules:amber-bolt']
    damageCaster.classSelectionsByClass = {
      ...(damageCaster.classSelectionsByClass ?? {}),
      wizard: { 'spell-prepared': ['test.rules:amber-bolt'] },
    }
    const damaged = resolveDnd5eHeadlessAction(resolved.result.state, {
      type: 'adjudicated-spell', actorId: input.actorToken.id,
      castingClassId: 'wizard', spellId: 'test.rules:amber-bolt', spellName: '测试伤害',
      spellLevel: 1, slotLevel: 1, castingTime: 'action',
      effects: [{ targetId: input.enemy.id, operation: 'damage', amount: 1 }],
      settlementMode: 'dm-slot-only',
    })
    expect(damaged.ok).toBe(true)
    if (!damaged.ok) return
    expect(damaged.state.combatants[input.enemy.id].classState.activeEffects ?? [])
      .not.toContainEqual(expect.objectContaining({ source: expect.objectContaining({ rulesId: 'sequester' }) }))
  })

  it('writes Sequester object authority state and consumes only the base slot and one material', () => {
    const input = fixture()
    input.spell = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'sequester')!
    input.actor.level = 20
    input.actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-prepared': ['sequester'] } } },
    }
    input.actor.classResources = { 'dnd5e-spell-slot-7': { current: 1, max: 1 } }
    input.actor = applyDnd5eInventoryMutation([input.actor], {
      type: 'grant', characterId: input.actor.id,
      templateId: 'srd-5.1:item:mixed-gem-dust-5000gp', quantity: 1,
    }).characters[0]!
    input.characters = [input.actor]
    const object: Token = {
      id: 'sealed-chest', label: '封印宝箱', x: 75, y: 25,
      color: '#888', emoji: '📦', size: 1, type: 'obstacle',
    }
    input.map = { ...input.map, tokens: [...input.map.tokens, object] }
    input.action.dnd5eAdjudicatedSpell = {
      spellId: 'sequester', slotLevel: 7,
      sequester: {
        schemaVersion: 1, targetKind: 'object', targetTokenId: object.id,
        targetName: object.label, endingCondition: '塔门开启',
      },
    }
    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved', effects: [],
        sequester: { schemaVersion: 1, willingCreatureConfirmed: false },
      },
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === object.id)?.dnd5eObjectState?.sequester)
      .toMatchObject({ schemaVersion: 1, slotLevel: 7, endingCondition: '塔门开启' })
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({ type: 'damage-applied' }))
    expect(resolved.result.state.combatants[input.actorToken.id].classResources['dnd5e-spell-slot-7'])
      .toEqual({ current: 0, max: 1 })
  })

  it('runs spell-cast lifecycle breaks while preserving other targets of the same concentration spell', () => {
    const input = fixture()
    const ally = token('ally-token', 'player', 75)
    input.map = { ...input.map, tokens: [...input.map.tokens, ally] }
    input.initiativeOrder = [input.actorToken, ally, input.enemy].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const actor = prepared.prepared.state.combatants[input.actorToken.id]
    const allyCombatant = prepared.prepared.state.combatants[ally.id]
    const invisibilityFor = (targetId: string) => createDnd5eConditionEffect({
      condition: 'invisible',
      targetId,
      source: {
        kind: 'spell', actorId: actor.id, actorName: actor.name,
        rulesId: 'invisibility', label: '隐形术',
      },
      duration: {
        type: 'concentration', sourceActorId: actor.id,
        concentrationId: 'invisibility', remainingRounds: 600,
      },
      breakOn: ['makes-attack', 'casts-spell'],
    })
    actor.concentrating = true
    actor.classState.concentrationSpellId = 'invisibility'
    actor.classState.concentrationTargetIds = [actor.id, ally.id]
    actor.classState.concentrationRoundsRemaining = 600
    actor.classState.activeEffects = [invisibilityFor(actor.id)]
    actor.classState.concentrationEffectsBySource = { [actor.id]: 'invisibility' }
    allyCombatant.classState.activeEffects = [invisibilityFor(ally.id)]
    allyCombatant.classState.concentrationEffectsBySource = { [actor.id]: 'invisibility' }

    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: { decision: 'approved', effects: [], note: '批准。' },
    })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'spell-cast', actorId: actor.id, spellId: input.spell.id,
    }))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', targetId: actor.id, reason: 'casts-spell',
    }))
    expect(resolved.result.state.combatants[actor.id].classState.activeEffects).toBeUndefined()
    expect(resolved.result.state.combatants[ally.id].classState.activeEffects).toHaveLength(1)
    expect(resolved.result.state.combatants[actor.id]).toMatchObject({
      concentrating: true,
      classState: {
        concentrationSpellId: 'invisibility',
        concentrationTargetIds: [ally.id],
      },
    })
    expect(resolved.result.state.combatants[ally.id].classState.concentrationEffectsBySource)
      .toEqual({ [actor.id]: 'invisibility' })
  })

  it('replaces prior same-spell concentration effects instead of stacking them on recast', () => {
    const input = fixture()
    input.spell = {
      ...input.spell,
      imported: {
        ...input.spell.imported!,
        duration: { ...input.spell.imported!.duration, concentration: true },
      },
    }
    const oldEffect = createDnd5eConditionEffect({
      condition: 'charmed',
      targetId: input.enemy.id,
      source: {
        kind: 'spell', actorId: input.actorToken.id, actorName: input.actor.name,
        rulesId: input.spell.id, label: input.spell.name,
      },
      duration: {
        type: 'concentration', sourceActorId: input.actorToken.id,
        concentrationId: input.spell.id, remainingRounds: 10,
      },
    })
    input.actor.dnd5eCombatState = {
      concentrationSpellId: input.spell.id,
      concentrationSpellLevel: 1,
      concentrationTargetIds: [input.enemy.id],
      concentrationRoundsRemaining: 10,
    }
    input.characters = [input.actor]
    input.enemy.dnd5eCombatState = {
      activeEffects: [oldEffect],
      concentrationEffectsBySource: { [input.actorToken.id]: input.spell.id },
    }

    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved', concentrationRounds: 10,
        effects: [{ targetTokenId: input.enemy.id, addCondition: '失能' }],
      },
    })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    const target = resolved.result.state.combatants[input.enemy.id]
    expect(target.conditions).toEqual(['失能'])
    expect(target.classState.activeEffects).toHaveLength(1)
    expect(target.classState.activeEffects?.[0]).toMatchObject({
      legacyCondition: '失能',
      duration: {
        type: 'concentration', sourceActorId: input.actorToken.id,
        concentrationId: input.spell.id, remainingRounds: 10,
      },
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', targetId: input.enemy.id,
      reason: 'concentration-ended',
    }))
  })

  it('keeps an explicit finite condition duration separate from its concentration spell lifecycle', () => {
    const input = fixture()
    input.spell = {
      ...input.spell,
      imported: {
        ...input.spell.imported!,
        duration: {
          type: 'timed',
          value: 10,
          unit: 'minute',
          concentration: true,
        },
      },
    }

    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved',
        concentrationRounds: 100,
        effects: [{
          targetTokenId: input.enemy.id,
          addCondition: '束缚',
          conditionDurationRounds: 1,
          conditionDurationTickOn: 'source-turn-end',
        }],
      },
    })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return

    expect(resolved.result.state.combatants[input.actorToken.id]).toMatchObject({
      concentrating: true,
      classState: {
        concentrationSpellId: input.spell.id,
        concentrationTargetIds: [input.actorToken.id],
        concentrationRoundsRemaining: 100,
      },
    })
    expect(resolved.result.state.combatants[input.enemy.id].classState).toMatchObject({
      activeEffects: [expect.objectContaining({
        legacyCondition: '束缚',
        duration: expect.objectContaining({
          type: 'rounds',
          remainingRounds: 1,
          tickOn: 'source-turn-end',
        }),
      })],
    })
    expect(resolved.result.state.combatants[input.enemy.id].classState.concentrationEffectsBySource)
      .toBeUndefined()

    const firstCasterEnd = resolveDnd5eHeadlessAction(resolved.result.state, {
      type: 'end-turn', actorId: input.actorToken.id,
    })
    expect(firstCasterEnd.ok).toBe(true)
    if (!firstCasterEnd.ok) return
    expect(firstCasterEnd.state.combatants[input.enemy.id].conditions).toContain('束缚')

    const enemyEnd = resolveDnd5eHeadlessAction(firstCasterEnd.state, {
      type: 'end-turn', actorId: input.enemy.id,
    })
    expect(enemyEnd.ok).toBe(true)
    if (!enemyEnd.ok) return
    expect(enemyEnd.state.combatants[input.enemy.id].conditions).toContain('束缚')

    const nextCasterEnd = resolveDnd5eHeadlessAction(enemyEnd.state, {
      type: 'end-turn', actorId: input.actorToken.id,
    })
    expect(nextCasterEnd.ok).toBe(true)
    if (!nextCasterEnd.ok) return
    expect(nextCasterEnd.state.combatants[input.enemy.id].conditions).not.toContain('束缚')
    expect(nextCasterEnd.state.combatants[input.actorToken.id]).toMatchObject({
      concentrating: true,
      classState: { concentrationSpellId: input.spell.id },
    })
  })

  it('ends prior concentration when an adjudicated concentration spell creates no ongoing effect', () => {
    const input = fixture()
    input.spell = {
      ...input.spell,
      imported: {
        ...input.spell.imported!,
        duration: { ...input.spell.imported!.duration, concentration: true },
      },
    }
    input.actor.dnd5eCombatState = {
      concentrationSpellId: 'invisibility',
      concentrationSpellLevel: 2,
      concentrationTargetIds: [input.actorToken.id],
      concentrationRoundsRemaining: 600,
    }
    input.characters = [input.actor]

    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved',
        effects: [],
        note: '目标免疫；不建立新的持续效果或专注状态。',
      },
    })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[input.actorToken.id]).toMatchObject({
      concentrating: false,
      classState: {
        concentrationSpellId: undefined,
        concentrationTargetIds: undefined,
        concentrationRoundsRemaining: undefined,
      },
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: input.actorToken.id,
      stateKey: 'concentration', active: false,
    }))
  })

  it('ends Modify Memory when its target becomes the target of another spell', () => {
    const input = fixture()
    input.spell = {
      ...input.spell,
      id: 'modify-memory',
      name: '篡改记忆',
      imported: {
        ...input.spell.imported!,
        id: 'modify-memory',
        name: '篡改记忆',
        duration: { ...input.spell.imported!.duration, concentration: true },
      },
    }
    input.action.dnd5eAdjudicatedSpell = { spellId: input.spell.id, slotLevel: 1 }
    input.actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-prepared': [input.spell.id] } } },
    }
    input.characters = [input.actor]

    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const modified = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved', concentrationRounds: 10,
        effects: [{ targetTokenId: input.enemy.id, addCondition: '魅惑' }],
      },
    })
    expect(modified.result.ok).toBe(true)
    if (!modified.result.ok) return
    expect(modified.result.state.combatants[input.enemy.id].classState.activeEffects?.[0].breakOn)
      .toEqual(['takes-damage', 'targeted-by-spell'])

    const actor = modified.result.state.combatants[input.actorToken.id]
    actor.turn.actionAvailable = true
    actor.classState.bonusActionSpellTurnKey = undefined
    actor.classState.leveledSpellTurnKey = undefined
    actor.classSelections['spell-prepared'] = [input.spell.id, 'another-spell']
    actor.classSelectionsByClass = {
      ...actor.classSelectionsByClass,
      wizard: {
        ...(actor.classSelectionsByClass?.wizard ?? {}),
        'spell-prepared': [input.spell.id, 'another-spell'],
      },
    }
    actor.classResources['dnd5e-spell-slot-1'] = { current: 1, max: 4 }
    const targetedAgain = resolveDnd5eHeadlessAction(modified.result.state, {
      type: 'adjudicated-spell',
      actorId: input.actorToken.id,
      castingClassId: 'wizard',
      spellId: 'another-spell',
      spellName: '另一个法术',
      spellLevel: 1,
      slotLevel: 1,
      castingTime: 'action',
      settlementMode: 'dm-slot-only',
      effects: [{ targetId: input.enemy.id, addCondition: '收到传讯' }],
    })
    expect(targetedAgain.ok).toBe(true)
    if (!targetedAgain.ok) return
    expect(targetedAgain.state.combatants[input.enemy.id].conditions).toEqual(['收到传讯'])
    expect(targetedAgain.state.combatants[input.actorToken.id]).toMatchObject({
      concentrating: false,
      classState: { concentrationSpellId: undefined },
    })
    expect(targetedAgain.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', targetId: input.enemy.id,
      reason: 'targeted-by-spell',
    }))
  })

  it('validates costly materials and consumes them only after DM approval', () => {
    const input = fixture()
    const imported: Dnd5eImportedSpell = {
      ...roomSpell(),
      id: 'revivify',
      name: '回生术',
      level: 3,
      components: {
        verbal: true,
        somatic: true,
        material: true,
        materialText: '价值 300 gp 的钻石，法术会将其消耗',
        materialCostGp: 300,
        materialConsumed: true,
      },
    }
    input.action.dnd5eAdjudicatedSpell = { spellId: imported.id, slotLevel: 3 }
    input.spell = {
      ...input.spell,
      id: imported.id,
      name: imported.name,
      level: imported.level,
      imported,
      classes: imported.classes,
    }
    input.actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-prepared': [imported.id] } } },
    }
    input.actor.classResources = { 'dnd5e-spell-slot-3': { current: 1, max: 1 } }

    expect(prepareDnd5eAdjudicatedSpell(input)).toEqual({
      ok: false,
      reason: 'costly-material-unavailable',
    })

    const grant = applyDnd5eInventoryMutation([input.actor], {
      type: 'grant',
      characterId: input.actor.id,
      templateId: 'srd-5.1:item:diamond-300gp',
      quantity: 1,
    })
    expect(grant.ok).toBe(true)
    input.actor = grant.characters[0]
    input.characters = [input.actor]
    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(normalizeDnd5eInventory(input.actor).entries).toHaveLength(1)

    const rejected = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: { decision: 'cancelled', effects: [], note: '不批准。' },
    })
    expect(rejected.result.ok).toBe(false)
    expect(normalizeDnd5eInventory(input.actor).entries).toHaveLength(1)

    const approved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: { decision: 'approved', effects: [], note: '批准。' },
    })
    expect(approved.result.ok).toBe(true)
    expect(normalizeDnd5eInventory(approved.application!.characters[0]).entries).toHaveLength(0)
    expect(approved.result.state.combatants[input.actorToken.id].classResources['dnd5e-spell-slot-3'])
      .toEqual({ current: 0, max: 1 })
  })

  it('rejects player-selected effect targets that are not map combatants without spending the slot', () => {
    const input = fixture()
    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: { decision: 'approved', effects: [{ targetTokenId: 'forged-target', operation: 'damage', amount: 999 }] },
    })
    expect(resolved.result.ok).toBe(false)
    expect(resolved.result.state.combatants[input.actorToken.id].classResources['dnd5e-spell-slot-1']).toEqual({ current: 1, max: 4 })
  })

  it('treats an exploration adjudication as independent from an earlier bonus-action spell', () => {
    const input = fixture()
    input.action.combatId = undefined
    input.actor.dnd5eCombatState = {
      bonusActionSpellTurnKey: `map-${input.map.id}:1:${input.actorToken.id}`,
      leveledSpellTurnKey: `map-${input.map.id}:1:${input.actorToken.id}`,
    }
    input.characters = [input.actor]

    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const preparedActor = prepared.prepared.state.combatants[input.actorToken.id]
    expect(preparedActor.classState.bonusActionSpellTurnKey).toBeUndefined()
    expect(preparedActor.classState.leveledSpellTurnKey).toBeUndefined()

    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved',
        effects: [{ targetTokenId: input.enemy.id, addCondition: '记忆已篡改' }],
      },
    })
    expect(resolved.result.ok).toBe(true)
  })

  it('applies Speak with Plants terrain changes to a nearby authoritative plant area', () => {
    const input = fixture()
    const speakWithPlants = dnd5eSpellbookEntries([]).find((entry) => entry.id === 'speak-with-plants')!
    input.spell = speakWithPlants
    input.actor.charClass = '德鲁伊'
    input.actor.level = 20
    input.actor.abilities.wis = 20
    input.actor.dnd5eClassChoices = {
      classes: { druid: { selections: { 'spell-prepared': [speakWithPlants.id] } } },
    }
    input.actor.classResources = { 'dnd5e-spell-slot-3': { current: 2, max: 3 } }
    input.characters = [input.actor]
    input.action.combatId = undefined
    input.action.dnd5eAdjudicatedSpell = { spellId: speakWithPlants.id, slotLevel: 3 }
    input.map.dnd5ePluginAreas = [{
      id: 'entangle-area', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:entangle',
      sourceKind: 'core-spell', coreSpellId: 'entangle', label: '纠缠术', color: '#4d7c0f',
      sourceCharacterId: input.actor.id, sourceTokenId: input.actorToken.id,
      cells: [{ col: 1, row: 0 }], createdRound: 1, expiresAfterRound: 11,
      movementCostMultiplier: 2,
    }]

    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved', effects: [],
        terrainEffects: [{ areaId: 'entangle-area', movementCostMultiplier: 1 }],
      },
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.dnd5ePluginAreas?.[0].movementCostMultiplier).toBe(1)
    expect(resolved.result.state.combatants[input.actorToken.id].classResources['dnd5e-spell-slot-3'])
      .toEqual({ current: 1, max: 3 })
  })

  it('keeps the bonus-action spell restriction inside a live combat turn', () => {
    const input = fixture()
    input.actor.dnd5eCombatState = {
      bonusActionSpellTurnKey: `${input.action.combatId}:1:${input.actorToken.id}`,
    }
    input.characters = [input.actor]

    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved',
        effects: [{ targetTokenId: input.enemy.id, addCondition: '记忆已篡改' }],
      },
    })
    expect(resolved.result).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })
})
