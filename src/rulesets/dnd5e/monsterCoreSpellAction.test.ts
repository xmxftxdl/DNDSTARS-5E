import { registerDnd5eRulesPlugin } from './pluginApi'
import { prepareDnd5eRandomTargetMonsterSpell, dnd5eMonsterSpellIntentWithPreparedTargets } from './randomMonsterSpellTargets'
import { planDnd5eMapResultApplication } from './mapBridge'
import { afterEach, describe, expect, it } from 'vitest'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import type { BattleMap, Token, Dnd5ePluginArea } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  dnd5eAvailableMonsterSpellSlotLevels,
  dnd5eMonsterCoreSpellAreaTargetIds,
  prepareDnd5eMonsterCoreSpell,
  resolvePreparedDnd5eMonsterCoreSpell,
} from './monsterCoreSpellAction'
import {
  prepareDnd5eMonsterAreaAction,
  resolvePreparedDnd5eMonsterAreaAction,
} from './monsterAreaAction'
import { planDnd5eMonsterTurn } from './monsterTurnPlanner'
import { getDnd5eSrdMonster } from './monsters'
import {
  collectDnd5ePersistentAreaTriggers,
  reconcileDnd5ePluginAreasOnMap,
} from './pluginAreas'
import {
  prepareDnd5ePersistentAreaTrigger,
  resolvePreparedDnd5ePersistentAreaTrigger,
} from './pluginAreaTransactions'
import { dnd5eMonsterCoreSpellCompatibility } from './monsterAdvancedAbilities'
import { getDnd5eSrdCombatSpell } from './spells'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from './activeEffects'
import {
  dnd5eCombatantPairKey,
  dnd5eHeadlessTurnKey,
  resolveDnd5eHeadlessAction,
} from './headlessCombatEngine'

function token(patch: Partial<Token>): Token {
  return {
    id: 'token',
    label: 'Token',
    x: 5,
    y: 5,
    color: '',
    emoji: '',
    size: 1,
    type: 'enemy',
    hp: 40,
    maxHp: 40,
    ...patch,
  }
}

function character(): Character {
  return {
    id: 'hero',
    name: '英雄',
    player: 'P1',
    avatar: '',
    accent: '',
    race: '',
    charClass: '战士',
    level: 5,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'],
    skills: [],
    maxHp: 40,
    currentHp: 40,
    tempHp: 0,
    hitDice: '5d10',
    ac: 14,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 10,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
  }
}

it.each([1, 20, undefined])('passes monster missile Shield casting saves through the map adapter: %s', d20 => {
  const pain = createDnd5eMechanicalEffect({ definitionId: 'pain', label: 'Pain', targetId: 'defender',
    source: { kind: 'spell' }, spellcastingSave: { ability: 'con', dc: 18 } })
  const caster = token({ id: 'caster', poolId: 'srd-5.1:mage',
    dnd5eCombatState: { monsterSpellSlots: { 1: { current: 1, max: 1 } } } })
  const defender = token({ id: 'defender', x: 35, poolId: 'srd-5.1:mage', dnd5eSide: 'player',
    dnd5eCombatState: { activeEffects: [pain], monsterSpellSlots: { 1: { current: 1, max: 1 } } } })
  const map = battleMap([caster, defender])
  const ready = prepareDnd5eMonsterCoreSpell({ combatId: 'pain-shield', map, characters: [],
    initiativeOrder: initiative(map.tokens), actorTokenId: caster.id, targetTokenIds: [defender.id],
    spellId: 'magic-missile', slotLevel: 1 })
  expect(ready.ok, ready.ok ? '' : ready.reason).toBe(true)
  if (!ready.ok) return
  const resolved = resolvePreparedDnd5eMonsterCoreSpell({ prepared: ready.prepared,
    shieldSpellcastingSavingThrows: d20 == null ? undefined : { defender: [{ effectId: pain.id, d20 }] },
    resolution: { projectileTargetIds: ['defender', 'defender', 'defender'], effectRolls: [[4], [3], [2]] } })
  expect(resolved.result.ok).toBe(d20 != null)
  if (d20 == null) {
    expect(resolved.application).toBeUndefined()
    expect(resolved.result.state.combatants.defender.classState.monsterSpellSlots?.[1].current).toBe(1)
    expect(resolved.result.state.combatants.caster.classState.monsterSpellSlots?.[1].current).toBe(1)
    return
  }
  expect(resolved.result.state.combatants.defender.currentHp).toBe(d20 === 20 ? 40 : 28)
  expect(resolved.result.state.combatants.defender.classState.monsterSpellSlots?.[1].current).toBe(0)
  expect(resolved.result.state.combatants.caster.classState.monsterSpellSlots?.[1].current).toBe(0)
  expect(defender.dnd5eCombatState?.monsterSpellSlots?.[1].current).toBe(1)
})

function battleMap(tokens: Token[]): BattleMap {
  return {
    id: 'map',
    name: 'Map',
    width: 200,
    height: 100,
    gridSize: 10,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    feetPerCell: 5,
    tokens,
  }
}

function initiative(tokens: readonly Token[]) {
  return tokens.map((entry, index) => ({
    tokenId: entry.id,
    label: entry.label,
    emoji: '',
    color: '',
    roll: 20 - index,
  }))
}

describe('monster core spell map action', () => {
  it.each([true, false])('forwards a marked target counter through monster spell settlement (hit=%s)', hit => {
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'test.spell-counter', name: 'Counter', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0' },
      setup(api) { api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'hunter', name: 'Hunter',
        classId: 'ranger', summary: 'Synthetic', abilities: [{
          schemaVersion: 1, id: 'counter', name: 'Counter', description: 'Synthetic', level: 15,
          trigger: { kind: 'before-saving-throw' }, cost: { economy: 'reaction' },
          targeting: { kind: 'self' }, effects: [], automation: 'full',
          mechanic: { kind: 'saving-throw-weapon-counterattack', markEffectDefinitionId: 'prey' },
        }] }) },
    })
    try {
      const mage = token({ id: 'mage', poolId: 'srd-5.1:mage', hp: 50, maxHp: 50,
        dnd5eCombatState: { monsterSpellSlots: { 3: { current: 1, max: 1 } } } })
      const hunterToken = token({ id: 'hunter', type: 'player', characterId: 'hero', x: 55 })
      const map = battleMap([mage, hunterToken])
      const ready = prepareDnd5eMonsterCoreSpell({ combatId: 'spell-counter', map, characters: [character()],
        initiativeOrder: initiative(map.tokens), actorTokenId: mage.id, targetTokenIds: [hunterToken.id],
        spellId: 'fireball', slotLevel: 3, areaTargetCell: { col: 5, row: 0 } })
      expect(ready.ok, ready.ok ? '' : ready.reason).toBe(true)
      if (!ready.ok) throw Error('counter spell preparation failed')
      const hunter = ready.prepared.state.combatants.hunter
      hunter.classId = 'ranger'; hunter.classLevels = { ranger: 15 }; hunter.level = 15
      hunter.subclassIds = { ranger: 'test.spell-counter:hunter' }
      hunter.pluginFeatureIds = ['test.spell-counter:hunter.counter']
      const mark = createDnd5eMechanicalEffect({ definitionId: 'prey', label: 'Prey', targetId: 'hunter',
        source: { kind: 'plugin', actorId: 'hunter', pluginId: 'test.spell-counter' },
        modifiers: { onHitBonusDamage: { count: 1, sides: 6, bonus: 0, damageType: 'inherit-primary',
          appliesTo: 'all-weapon-attacks', doubleDiceOnCritical: true, oncePerTurn: true,
          consumeEffectOnHit: false, boundTargetId: 'mage' } } })
      hunter.classState.activeEffects = [mark]
      const before = structuredClone(ready.prepared.state)
      const settled = resolvePreparedDnd5eMonsterCoreSpell({ prepared: ready.prepared,
        savingThrowCounterattacks: [{ targetId: 'hunter', sourceId: 'mage', ability: 'dex',
          occurrence: 0, featureId: 'test.spell-counter:hunter.counter', attack: {
            type: 'attack', actorId: 'hunter', targetId: 'mage', attackModifier: 20, d20: hit ? 18 : 1,
            damage: { count: 1, sides: 6, bonus: 0, rolls: hit ? [2] : [], type: 'piercing' },
            classDamageContext: { mode: 'ranged', weaponId: 'bow', finesse: false, strengthBased: false,
              weaponDamageSides: 6, damageType: 'piercing', adjacentEnemyOfTarget: false },
            classDamageRolls: hit ? [{ source: 'activity-effect-rider', rollId: `activity-on-hit:${mark.id}`, rolls: [4] }] : [],
          } }],
        resolution: { targetSavingThrows: [{ targetId: 'hunter', d20: hit ? 0 : 1 }],
          effectRolls: [Array(8).fill(2)] },
      })
      expect(settled.result.ok, settled.result.ok ? '' : settled.result.reason).toBe(true)
      expect(ready.prepared.state).toEqual(before)
      expect(settled.application).toBeDefined()
      expect(settled.result.state.combatants.mage.currentHp).toBe(hit ? 44 : 50)
      expect(settled.result.state.combatants.hunter.currentHp).toBe(before.combatants.hunter.currentHp - (hit ? 8 : 16))
      expect(settled.result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
      expect(settled.result.state.combatants.mage.classState.monsterSpellSlots?.[3].current).toBe(0)
    } finally { dispose() }
  })
  afterEach(() => setMapGeometryRuntime([]))

  it('prepares and resolves a listed SRD spell through the authoritative map snapshot', () => {
    const mage = token({
      id: 'mage',
      label: '法师',
      poolId: 'srd-5.1:mage',
      dnd5eCombatState: { monsterSpellSlots: {} },
    })
    const heroToken = token({
      id: 'hero-token',
      label: '英雄',
      type: 'player',
      characterId: 'hero',
      x: 35,
    })
    const map = battleMap([mage, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'combat',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mage.id,
      targetTokenIds: [heroToken.id],
      spellId: 'fire-bolt',
      slotLevel: 0,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      diceCount: 2,
      spellAttackMode: 'normal',
    })

    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        d20: 15,
        effectRolls: [[5, 6]],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(29)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'monster-core-spell-resolved',
      spellId: 'fire-bolt',
    }))
  })

  it('spends legendary points instead of turn economy for an off-turn Sphinx spell', () => {
    const sphinx = token({
      id: 'sphinx',
      label: '雄性斯芬克斯',
      poolId: 'srd-5.1:androsphinx',
      hp: 199,
      maxHp: 199,
      dnd5eCombatState: {
        monsterLegendaryActionPoints: 3,
        monsterSpellSlots: {
          '1': { current: 4, max: 4 },
          '2': { current: 3, max: 3 },
          '3': { current: 3, max: 3 },
          '4': { current: 3, max: 3 },
          '5': { current: 2, max: 2 },
          '6': { current: 1, max: 1 },
        },
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: '英雄',
      type: 'player',
      characterId: 'hero',
      x: 35,
    })
    const map = battleMap([sphinx, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'legendary-sphinx-spell',
      map,
      characters: [character()],
      initiativeOrder: initiative([heroToken, sphinx]),
      currentInitiativeIndex: 0,
      actorTokenId: sphinx.id,
      targetTokenIds: [heroToken.id],
      spellId: 'sacred-flame',
      slotLevel: 0,
      legendaryActionId: 'cast-a-spell-costs-3-actions',
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: heroToken.id, d20: 1 }],
        effectRolls: [[5, 6, 7]],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    const caster = resolved.result.state.combatants[sphinx.id]
    expect(caster.classState.monsterLegendaryActionPoints).toBe(0)
    expect(caster.turn.actionAvailable).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'monster-legendary-action-used',
      actorId: sphinx.id,
      actionId: 'cast-a-spell-costs-3-actions',
      cost: 3,
      remaining: 0,
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'monster-core-spell-resolved',
      spellId: 'sacred-flame',
    }))
  })

  it('lets a Mummy Lord resolve Harm through the same maximum-HP authority', () => {
    const mummyLord = token({
      id: 'mummy-lord',
      label: 'Mummy Lord',
      poolId: 'srd-5.1:mummy-lord',
      hp: 97,
      maxHp: 97,
      dnd5eCombatState: {
        monsterSpellSlots: { 6: { current: 1, max: 1 } },
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: 'Hero',
      type: 'player',
      characterId: 'hero',
      hp: 20,
      maxHp: 80,
      x: 35,
    })
    const map = battleMap([mummyLord, heroToken])
    const hero = { ...character(), currentHp: 20, maxHp: 80 }
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-harm',
      map,
      characters: [hero],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mummyLord.id,
      targetTokenIds: [heroToken.id],
      spellId: 'harm',
      slotLevel: 6,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: heroToken.id, d20: 1 }],
        effectRolls: [Array(14).fill(4)],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters[0]).toMatchObject({ currentHp: 1, maxHp: 24 })
    expect(resolved.application?.characters[0].dnd5eCombatState?.hitPointMaximumReductionLedger)
      .toMatchObject({ entries: [{ amount: 56, remainingRounds: 600 }] })
  })

  it('derives an adult black dragon breath target set from map cells and rejects a partial client submission', () => {
    const dragon = token({
      id: 'dragon', label: '成年黑龙', poolId: 'srd-5.1:adult-black-dragon',
      hp: 195, maxHp: 195,
      dnd5eCombatState: { monsterRechargeReadyByActionId: { 'acid-breath': true } },
    })
    const first = token({
      id: 'first', label: '第一名英雄', type: 'player', characterId: 'first-character', x: 45, y: 5,
    })
    const second = token({
      id: 'second', label: '第二名英雄', type: 'player', characterId: 'second-character', x: 85, y: 5,
    })
    const battle = battleMap([dragon, first, second])
    const characters = [
      { ...character(), id: 'first-character', name: '第一名英雄', currentHp: 120, maxHp: 120 },
      { ...character(), id: 'second-character', name: '第二名英雄', currentHp: 120, maxHp: 120 },
    ]
    const plan = planDnd5eMonsterTurn(battle, dragon, characters)
    expect(plan.areaAction).toMatchObject({ actionId: 'acid-breath' })
    if (!plan.areaAction) return

    const prepared = prepareDnd5eMonsterAreaAction({
      combatId: 'acid-map',
      map: battle,
      characters,
      initiativeOrder: initiative(battle.tokens),
      actorTokenId: dragon.id,
      actionId: plan.areaAction.actionId,
      targetTokenIds: plan.areaAction.targetTokenIds,
      areaTargetCell: plan.areaAction.areaTargetCell,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens.map((target) => target.id)).toEqual(expect.arrayContaining([first.id, second.id]))
    const settled = resolvePreparedDnd5eMonsterAreaAction({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: prepared.prepared.targetTokens.map((target) => ({ targetId: target.id, d20: 1 })),
        damageRolls: Array.from({ length: 12 }, () => 1),
      },
    })
    expect(settled.result.ok, settled.result.ok ? undefined : settled.result.reason).toBe(true)
    expect(settled.application?.characters).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'first-character', currentHp: 108 }),
      expect.objectContaining({ id: 'second-character', currentHp: 108 }),
    ]))
    expect(prepareDnd5eMonsterAreaAction({
      combatId: 'acid-map',
      map: battle,
      characters,
      initiativeOrder: initiative(battle.tokens),
      actorTokenId: dragon.id,
      actionId: plan.areaAction.actionId,
      targetTokenIds: [first.id],
      areaTargetCell: plan.areaAction.areaTargetCell,
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('prepares Magic Missile and applies its repeated projectile targets through the map bridge', () => {
    const mage = token({
      id: 'mage',
      label: '法师',
      poolId: 'srd-5.1:mage',
      dnd5eCombatState: {
        monsterSpellSlots: { 1: { current: 1, max: 1 } },
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: '英雄',
      type: 'player',
      characterId: 'hero',
      x: 35,
    })
    const map = battleMap([mage, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'magic-missile-map',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mage.id,
      targetTokenIds: [heroToken.id],
      spellId: 'magic-missile',
      slotLevel: 1,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        projectileTargetIds: [heroToken.id, heroToken.id, heroToken.id],
        effectRolls: [[4], [3], [2]],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(28)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === mage.id)
      ?.dnd5eCombatState?.monsterSpellSlots?.['1'].current).toBe(0)
  })

  it('settles Sunburst darkness removal in the monster bridge', () => {
    const monster = getDnd5eSrdMonster('srd-5.1:archmage')!
    const previousSpells = monster.spellcasting!.spells
    monster.spellcasting!.spells = [...(previousSpells ?? []), { id: 'sunburst', level: 8, name: 'Sunburst' }]
    try {
      const mage = token({ id: 'mage', poolId: 'srd-5.1:archmage',
        dnd5eCombatState: { monsterSpellSlots: { 8: { current: 1, max: 1 } } } })
      const hero = token({ id: 'hero-token', type: 'player', characterId: 'hero', x: 155 })
      const map = battleMap([mage, hero])
      map.dnd5ePluginAreas = [{
        id: 'darkness', pluginId: 'srd', featureId: 'darkness', sourceKind: 'core-spell',
        coreSpellId: 'darkness', label: 'darkness', color: '#000', sourceTokenId: 'other',
        sourceCharacterId: 'other', createdRound: 1, expiresAfterRound: 101, cells: [{ col: 15, row: 0 }],
        lighting: { kind: 'magical-darkness', radiusFeet: 15, spellLevel: 2 },
      }]
      const prepared = prepareDnd5eMonsterCoreSpell({
        combatId: 'sunburst', map, characters: [character()], initiativeOrder: initiative(map.tokens),
        actorTokenId: mage.id, targetTokenIds: [hero.id], areaTargetCell: { col: 15, row: 0 },
        spellId: 'sunburst', slotLevel: 8,
      })
      expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
      if (!prepared.ok) return
      const resolved = resolvePreparedDnd5eMonsterCoreSpell({ prepared: prepared.prepared,
        resolution: { targetSavingThrows: [{ targetId: hero.id, d20: 1 }], effectRolls: [Array(12).fill(1)] } })
      expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
      expect(resolved.application?.map.dnd5ePluginAreas).toEqual([])
      expect(resolved.result.state.combatants[hero.id].conditions).toContain('blinded')
    } finally {
      monster.spellcasting!.spells = previousSpells
    }
  })

  it('shares the authoritative area target declaration with manual DM spell placement', () => {
    const mage = token({
      id: 'mage',
      label: '法师',
      poolId: 'srd-5.1:mage',
      dnd5eCombatState: {
        monsterSpellSlots: { 3: { current: 1, max: 3 } },
      },
    })
    const first = token({
      id: 'first', type: 'player', characterId: 'first-character', x: 55, y: 5,
    })
    const second = token({
      id: 'second', type: 'player', characterId: 'second-character', x: 65, y: 5,
    })
    const map = battleMap([mage, first, second])
    const targetTokenIds = dnd5eMonsterCoreSpellAreaTargetIds({
      map,
      actorTokenId: mage.id,
      spellId: 'fireball',
      areaTargetCell: { col: 5, row: 0 },
    })

    expect(targetTokenIds).toEqual(expect.arrayContaining([first.id, second.id]))
    expect(prepareDnd5eMonsterCoreSpell({
      combatId: 'manual-monster-fireball',
      map,
      characters: [
        { ...character(), id: 'first-character' },
        { ...character(), id: 'second-character' },
      ],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mage.id,
      targetTokenIds: targetTokenIds ?? [],
      areaTargetCell: { col: 5, row: 0 },
      spellId: 'fireball',
      slotLevel: 3,
    })).toMatchObject({ ok: true })
  })

  it('prepares and resolves a monster Misty Step into a visible unoccupied cell', () => {
    const mage = token({
      id: 'mage',
      label: '法师',
      poolId: 'srd-5.1:mage',
      dnd5eCombatState: {
        monsterSpellSlots: { 2: { current: 1, max: 1 } },
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: '英雄',
      type: 'player',
      characterId: 'hero',
      x: 85,
    })
    const map = battleMap([mage, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-misty-step',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mage.id,
      targetTokenIds: [],
      areaTargetCell: { col: 4, row: 0 },
      spellId: 'misty-step',
      slotLevel: 2,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: { effectRolls: [] },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === mage.id))
      .toMatchObject({ x: 45, y: 5 })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'teleported',
      actorId: mage.id,
      spellId: 'misty-step',
      distanceFeet: 20,
    }))
    expect(resolved.application?.map.tokens.find((entry) => entry.id === mage.id)
      ?.dnd5eCombatState?.monsterSpellSlots?.['2'].current).toBe(0)
  })

  it('prepares and resolves a monster Charm Person with combat advantage and per-day usage', () => {
    const lamia = token({
      id: 'lamia',
      label: '拉米亚',
      poolId: 'srd-5.1:lamia',
      dnd5eCombatState: {
        monsterSpellUsesBySpellId: {
          'charm-person': { current: 3, max: 3 },
        },
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: '英雄',
      type: 'player',
      characterId: 'hero',
      x: 35,
    })
    const map = battleMap([lamia, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-charm-person',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: lamia.id,
      targetTokenIds: [heroToken.id],
      spellId: 'charm-person',
      slotLevel: 1,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{
          targetId: heroToken.id,
          d20: 1,
          d20Second: 2,
        }],
        effectRolls: [],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: heroToken.id,
      d20: 2,
      success: false,
    }))
    expect(resolved.result.state.combatants[heroToken.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        standardCondition: 'charmed',
        source: expect.objectContaining({ actorId: lamia.id, rulesId: 'charm-person' }),
        duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
      }),
    )
    expect(resolved.application?.map.tokens.find((entry) => entry.id === lamia.id)
      ?.dnd5eCombatState?.monsterSpellUsesBySpellId?.['charm-person'].current).toBe(2)
  })

  it('rejects a spell when a wall blocks line of effect', () => {
    const mage = token({ id: 'mage', poolId: 'srd-5.1:mage' })
    const heroToken = token({
      id: 'hero-token',
      type: 'player',
      characterId: 'hero',
      x: 35,
    })
    const map = battleMap([mage, heroToken])
    const geometry = createEmptyMapGeometry(map.id, 1)
    geometry.walls.push({
      id: 'wall',
      kind: 'wall',
      label: 'Wall',
      points: [{ x: 20, y: 0 }, { x: 20, y: 20 }],
      material: 'stone',
      blocksVision: true,
      blocksMovement: true,
      blocksLineOfEffect: true,
      baseHeightFeet: 0,
      heightFeet: 10,
      createdAt: 1,
    })
    setMapGeometryRuntime([geometry])

    expect(prepareDnd5eMonsterCoreSpell({
      combatId: 'combat',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mage.id,
      targetTokenIds: [heroToken.id],
      spellId: 'fire-bolt',
      slotLevel: 0,
    })).toMatchObject({ ok: false, reason: 'line-of-effect-blocked' })
  })

  it('puts safe monster spells in the same tactical candidate pool as weapon attacks', () => {
    const mage = token({ id: 'mage', label: '法师', poolId: 'srd-5.1:mage' })
    const heroToken = token({
      id: 'hero-token',
      label: '英雄',
      type: 'player',
      characterId: 'hero',
      x: 65,
    })
    const plan = planDnd5eMonsterTurn(
      battleMap([mage, heroToken]),
      mage,
      [character()],
    )

    expect(plan).toMatchObject({
      attacked: false,
      attackerTokenId: mage.id,
      targetTokenId: heroToken.id,
      spellCast: {
        spellId: 'magic-missile',
        slotLevel: 5,
        targetTokenIds: [heroToken.id],
        projectileTargetIds: Array.from({ length: 7 }, () => heroToken.id),
      },
      decision: {
        providerId: 'dnd5e:deterministic-tactical-v3',
      },
    })
  })

  it('selects a safe fireball placement that covers clustered hostiles and is revalidated by the Host', () => {
    const mage = token({
      id: 'mage',
      label: '法师',
      poolId: 'srd-5.1:mage',
      dnd5eCombatState: {
        monsterSpellSlots: {
          '3': { current: 1, max: 1 },
        },
      },
    })
    const first = token({
      id: 'hero-one',
      label: '英雄一',
      type: 'player',
      characterId: 'hero',
      x: 105,
      y: 45,
    })
    const second = token({
      id: 'hero-two',
      label: '英雄二',
      type: 'player',
      x: 115,
      y: 45,
    })
    const map = battleMap([mage, first, second])
    const plan = planDnd5eMonsterTurn(map, mage, [character()])
    expect(plan.spellCast).toMatchObject({
      spellId: 'fireball',
      targetTokenIds: expect.arrayContaining([first.id, second.id]),
      area: { shape: 'circle', radiusFeet: 20 },
      areaTargetCell: expect.any(Object),
    })

    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'combat',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mage.id,
      targetTokenIds: plan.spellCast!.targetTokenIds,
      areaTargetCell: plan.spellCast!.areaTargetCell,
      spellId: plan.spellCast!.spellId,
      slotLevel: plan.spellCast!.slotLevel,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) throw new Error('expected fireball to prepare')
    const settled = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: prepared.prepared.targetTokens.map((target) => ({
          targetId: target.id,
          d20: 1,
        })),
        effectRolls: [Array.from({ length: 8 }, () => 6)],
      },
    })
    expect(settled.result.ok).toBe(true)
    expect(settled.result.state.combatants[first.id].currentHp).toBe(0)
    expect(settled.result.state.combatants[second.id].currentHp).toBe(0)
    expect(prepareDnd5eMonsterCoreSpell({
      combatId: 'combat',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mage.id,
      targetTokenIds: [first.id],
      areaTargetCell: plan.spellCast!.areaTargetCell,
      spellId: plan.spellCast!.spellId,
      slotLevel: plan.spellCast!.slotLevel,
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('uses a healing spell when an allied monster is badly wounded', () => {
    const acolyte = token({
      id: 'acolyte',
      label: '侍僧',
      poolId: 'srd-5.1:acolyte',
      hp: 1,
      maxHp: 9,
    })
    const heroToken = token({
      id: 'hero-token',
      label: '英雄',
      type: 'player',
      characterId: 'hero',
      x: 25,
    })
    const statBlock = getDnd5eSrdMonster(acolyte.poolId!)!
    const cureWounds = statBlock.spellcasting!.spells!.find((spell) => spell.id === 'cure-wounds')!
    expect(dnd5eAvailableMonsterSpellSlotLevels({
      monster: statBlock,
      token: acolyte,
      spell: cureWounds,
    })).toEqual([1])
    const plan = planDnd5eMonsterTurn(
      battleMap([acolyte, heroToken]),
      acolyte,
      [character()],
    )
    expect(plan).toMatchObject({
      attacked: false,
      targetTokenId: acolyte.id,
      spellCast: {
        spellId: 'cure-wounds',
        targetTokenIds: [acolyte.id],
      },
    })
    const map = battleMap([acolyte, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'healing-combat',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: acolyte.id,
      targetTokenIds: [acolyte.id],
      spellId: 'cure-wounds',
      slotLevel: 1,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: { effectRolls: [[5]] },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === acolyte.id)?.hp).toBe(8)
  })

  it.each([
    ['dryad', 'barkskin'],
    ['deep-gnome-svirfneblin', 'blur'],
    ['archmage', 'fly'],
    ['mage', 'greater-invisibility'],
    ['archmage', 'invisibility'],
    ['druid', 'longstrider'],
    ['mage', 'mage-armor'],
    ['couatl', 'protection-from-poison'],
    ['dryad', 'shillelagh'],
    ['druid', 'shillelagh'],
  ] as const)('casts %s %s through a mechanical monster active-effect transaction', (slug, spellId) => {
    const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)!
    const listedSpell = monster.spellcasting!.spells!.find((spell) => spell.id === spellId)!
    const actor = token({
      id: slug,
      label: monster.name,
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
      dnd5eCombatState: {
        monsterSpellSlots: listedSpell.level > 0 && !listedSpell.usage
          ? { [listedSpell.level]: { current: 1, max: 1 } }
          : undefined,
        monsterSpellUsesBySpellId: listedSpell.usage?.kind === 'per-day'
          ? { [spellId]: { current: 1, max: listedSpell.usage.max } }
          : undefined,
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: '英雄',
      type: 'player',
      characterId: 'hero',
      x: 155,
    })
    const map = battleMap([actor, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: `active-effect-${spellId}`,
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: actor.id,
      targetTokenIds: [actor.id],
      spellId,
      slotLevel: listedSpell.level,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    if (spellId === 'shillelagh') {
      prepared.prepared.state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(actor.id, heroToken.id)]: 5,
      }
      expect(resolveDnd5eHeadlessAction(prepared.prepared.state, {
        type: 'monster-action',
        actorId: actor.id,
        actionId: slug === 'dryad' ? 'club-shillelagh' : 'quarterstaff-shillelagh',
        rolls: [{ targetId: heroToken.id, d20: 10, damageRolls: [[1]] }],
      })).toMatchObject({ ok: false, reason: 'class-resource-unavailable' })
    }

    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: { effectRolls: [] },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    const combatState = resolved.application?.map.tokens.find((entry) => entry.id === actor.id)
      ?.dnd5eCombatState
    const effect = combatState?.activeEffects?.find((entry) => entry.source.rulesId === spellId)
    expect(effect, spellId).toBeDefined()
    if (spellId === 'invisibility') {
      expect(effect).toMatchObject({
        standardCondition: 'invisible',
        breakOn: ['makes-attack', 'casts-spell'],
      })
    }
    if (spellId === 'greater-invisibility') {
      expect(effect).toMatchObject({ standardCondition: 'invisible' })
      expect(effect?.breakOn).toBeUndefined()
    }
    if (spellId === 'fly') expect(effect?.modifiers?.flySpeedFeet).toBe(60)
    if (spellId === 'longstrider') expect(effect?.modifiers?.speedBonusFeet).toBe(10)
    if (spellId === 'shillelagh') {
      expect(effect).toMatchObject({
        definitionId: 'srd-5.1:spell:shillelagh',
        modifiers: {
          shillelagh: {
            weaponId: slug === 'dryad' ? 'club' : 'quarterstaff',
            spellcastingAbility: slug === 'dryad' ? 'cha' : 'wis',
          },
        },
      })
      if (!resolved.result.ok) return
      resolved.result.state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(actor.id, heroToken.id)]: 5,
      }
      const attack = resolveDnd5eHeadlessAction(resolved.result.state, {
        type: 'monster-action',
        actorId: actor.id,
        actionId: slug === 'dryad' ? 'club-shillelagh' : 'quarterstaff-shillelagh',
        rolls: [{
          targetId: heroToken.id,
          d20: 10,
          damageRolls: [[1]],
        }],
      })
      expect(attack.ok, attack.ok ? undefined : attack.reason).toBe(true)
    }
    if (listedSpell.usage?.kind !== 'at-will' && listedSpell.level > 0) {
      if (listedSpell.usage?.kind === 'per-day') {
        expect(combatState?.monsterSpellUsesBySpellId?.[spellId]?.current).toBe(0)
      } else {
        expect(combatState?.monsterSpellSlots?.[String(listedSpell.level)]?.current).toBe(0)
      }
    }
    if (getDnd5eSrdCombatSpell(spellId)!.concentration) {
      expect(combatState).toMatchObject({
        concentrationSpellId: spellId,
        concentrationTargetIds: [actor.id],
      })
    }
  })

  it('rejects forged save dice on a monster buff before spending its slot', () => {
    const mage = token({
      id: 'mage',
      label: '法师',
      poolId: 'srd-5.1:mage',
      dnd5eCombatState: {
        monsterSpellSlots: { 3: { current: 1, max: 1 } },
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: '英雄',
      type: 'player',
      characterId: 'hero',
      x: 155,
    })
    const map = battleMap([mage, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'forged-buff-dice',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mage.id,
      targetTokenIds: [mage.id],
      spellId: 'fly',
      slotLevel: 3,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: mage.id, d20: 20 }],
        effectRolls: [],
      },
    })
    expect(resolved.result).toMatchObject({ ok: false, reason: 'invalid-dice' })
    expect(resolved.result.state.combatants[mage.id].classState.monsterSpellSlots?.['3'].current)
      .toBe(1)
  })

  it('settles monster Sleep by current HP while excluding undead targets', () => {
    const nightHag = token({
      id: 'night-hag',
      label: 'Night Hag',
      poolId: 'srd-5.1:night-hag',
      hp: 112,
      maxHp: 112,
      dnd5eCombatState: {
        monsterSpellUsesBySpellId: { sleep: { current: 1, max: 2 } },
      },
    })
    const ally = token({
      id: 'ally',
      label: 'Guard',
      poolId: 'srd-5.1:guard',
      hp: 3,
      maxHp: 11,
      x: 95,
      y: 45,
    })
    const heroToken = token({
      id: 'hero-token',
      label: 'Hero',
      type: 'player',
      characterId: 'hero',
      hp: 5,
      maxHp: 40,
      x: 105,
      y: 45,
    })
    const skeleton = token({
      id: 'skeleton',
      label: 'Skeleton',
      poolId: 'srd-5.1:skeleton',
      hp: 1,
      maxHp: 13,
      x: 115,
      y: 45,
    })
    const map = battleMap([nightHag, ally, heroToken, skeleton])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-sleep',
      map,
      characters: [{ ...character(), currentHp: 5 }],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: nightHag.id,
      targetTokenIds: [ally.id, heroToken.id, skeleton.id],
      areaTargetCell: { col: 10, row: 4 },
      spellId: 'sleep',
      slotLevel: 1,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: { effectRolls: [[2, 2, 2, 2, 2]] },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    const combatants = resolved.result.state.combatants
    expect(combatants.ally.conditions).toEqual(expect.arrayContaining(['unconscious', 'prone']))
    expect(combatants['hero-token'].conditions).toEqual(expect.arrayContaining(['unconscious', 'prone']))
    expect(combatants.skeleton.conditions).not.toContain('unconscious')
    expect(combatants['night-hag'].classState.monsterSpellUsesBySpellId?.sleep.current).toBe(0)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'sleep-resolved',
      hitPointPool: 10,
      remainingHitPoints: 2,
      affectedTargetIds: ['ally', 'hero-token'],
    }))
  })

  it('uses Lesser Restoration to remove the chosen condition from an allied monster', () => {
    const couatl = token({
      id: 'couatl',
      label: 'Couatl',
      poolId: 'srd-5.1:couatl',
      hp: 97,
      maxHp: 97,
      dnd5eCombatState: {
        monsterSpellUsesBySpellId: { 'lesser-restoration': { current: 1, max: 3 } },
      },
    })
    const ally = token({
      id: 'ally',
      label: 'Guard',
      poolId: 'srd-5.1:guard',
      x: 15,
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [createDnd5eConditionEffect({
          condition: 'paralyzed',
          source: { kind: 'feature', actorId: 'source', rulesId: 'test-paralysis' },
          targetId: 'ally',
        })],
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: 'Hero',
      type: 'player',
      characterId: 'hero',
      x: 155,
    })
    const map = battleMap([couatl, ally, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-lesser-restoration',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: couatl.id,
      targetTokenIds: [ally.id],
      spellId: 'lesser-restoration',
      slotLevel: 2,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: { conditionChoice: 'paralyzed', effectRolls: [] },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.state.combatants.ally.conditions).not.toContain('paralyzed')
    expect(resolved.result.state.combatants.ally.classState.activeEffects ?? [])
      .not.toContainEqual(expect.objectContaining({ standardCondition: 'paralyzed' }))
    expect(resolved.result.state.combatants.couatl.classState
      .monsterSpellUsesBySpellId?.['lesser-restoration'].current).toBe(0)
  })

  it('pushes only a failed Thunderwave save and rejects forged movement before spending a slot', () => {
    const druid = token({
      id: 'druid',
      label: 'Druid',
      poolId: 'srd-5.1:druid',
      dnd5eCombatState: {
        monsterSpellSlots: { 1: { current: 1, max: 1 } },
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: 'Hero',
      type: 'player',
      characterId: 'hero',
      x: 25,
      y: 5,
    })
    const map = battleMap([druid, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-thunderwave',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: druid.id,
      targetTokenIds: [heroToken.id],
      areaTargetCell: { col: 2, row: 0 },
      spellId: 'thunderwave',
      slotLevel: 1,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const forged = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: heroToken.id, d20: 1 }],
        forcedMovements: [{ targetId: heroToken.id, to: { x: 15, y: 5 }, distanceFeet: 5 }],
        effectRolls: [[5, 6]],
      },
    })
    expect(forged.result).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(forged.result.state.combatants.druid.classState.monsterSpellSlots?.['1'].current).toBe(1)

    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: heroToken.id, d20: 1 }],
        forcedMovements: [{ targetId: heroToken.id, to: { x: 45, y: 5 }, distanceFeet: 10 }],
        effectRolls: [[5, 6]],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(29)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === heroToken.id))
      .toMatchObject({ x: 45, y: 5 })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'moved', actorId: heroToken.id, distance: 10,
    }))
    expect(resolved.result.state.combatants.druid.classState.monsterSpellSlots?.['1'].current).toBe(0)

    const geometry = createEmptyMapGeometry(map.id, 1)
    geometry.walls.push({
      id: 'wall-behind-target',
      kind: 'wall',
      label: 'Wall',
      points: [{ x: 30, y: 0 }, { x: 30, y: 20 }],
      blocksVision: true,
      blocksMovement: true,
      blocksLineOfEffect: true,
      baseHeightFeet: 0,
      heightFeet: 10,
      createdAt: 1,
    })
    setMapGeometryRuntime([geometry])
    const blocked = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-thunderwave-blocked-push',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: druid.id,
      targetTokenIds: [heroToken.id],
      areaTargetCell: { col: 2, row: 0 },
      spellId: 'thunderwave',
      slotLevel: 1,
    })
    expect(blocked.ok, blocked.ok ? undefined : blocked.reason).toBe(true)
    if (!blocked.ok) return
    const wallStopped = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: blocked.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: heroToken.id, d20: 1 }],
        forcedMovements: [{
          targetId: heroToken.id,
          to: { x: heroToken.x, y: heroToken.y },
          distanceFeet: 0,
        }],
        effectRolls: [[5, 6]],
      },
    })
    expect(wallStopped.result.ok, wallStopped.result.ok ? undefined : wallStopped.result.reason)
      .toBe(true)
    expect(wallStopped.application?.map.tokens.find((entry) => entry.id === heroToken.id))
      .toMatchObject({ x: 25, y: 5 })
  })

  it('casts Insect Plague as a monster, persists its area, and settles creation damage through the shared area transaction', () => {
    const mummyLord = token({
      id: 'mummy-lord',
      label: 'Mummy Lord',
      poolId: 'srd-5.1:mummy-lord',
      hp: 97,
      maxHp: 97,
      dnd5eCombatState: {
        monsterSpellSlots: { 5: { current: 1, max: 1 } },
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: 'Hero',
      type: 'player',
      characterId: 'hero',
      x: 105,
      y: 5,
    })
    const map = battleMap([mummyLord, heroToken])
    const spell = getDnd5eSrdCombatSpell('insect-plague')!
    expect(dnd5eMonsterCoreSpellCompatibility(spell)).toEqual({ automation: 'full' })
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('cloudkill')!))
      .toEqual({ automation: 'full' })

    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-persistent-area',
      round: 2,
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mummyLord.id,
      targetTokenIds: [],
      areaTargetCell: { col: 10, row: 0 },
      areaTargetElevationFeet: 0,
      spellId: spell.id,
      slotLevel: 5,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const cast = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: { effectRolls: [] },
    })
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
    expect(cast.createdAreaId).toBeTruthy()
    expect(cast.application?.map.tokens.find((entry) => entry.id === mummyLord.id)?.dnd5eCombatState)
      .toMatchObject({
        concentrationSpellId: 'insect-plague',
        concentrationSpellLevel: 5,
        monsterSpellSlots: { 5: { current: 0, max: 1 } },
      })
    const createdArea = cast.application?.map.dnd5ePluginAreas?.find((area) =>
      area.id === cast.createdAreaId)
    expect(createdArea).toMatchObject({
      sourceTokenId: mummyLord.id,
      coreSpellId: 'insect-plague',
      concentrationId: 'insect-plague',
      movementCostMultiplier: 2,
    })
    if (!cast.application || !createdArea) return
    expect(reconcileDnd5ePluginAreasOnMap(
      cast.application.map,
      cast.application.characters,
      2,
    ).dnd5ePluginAreas).toHaveLength(1)

    const candidate = collectDnd5ePersistentAreaTriggers({
      map: cast.application.map,
      timing: 'on-create',
      round: 2,
      areaId: createdArea.id,
      turnKey: '2:mummy-lord',
    }).find((entry) => entry.targetToken.id === heroToken.id)
    expect(candidate).toBeDefined()
    if (!candidate) return
    const trigger = prepareDnd5ePersistentAreaTrigger({
      combatId: 'monster-persistent-area',
      round: 2,
      map: cast.application.map,
      characters: cast.application.characters,
      initiativeOrder: initiative(map.tokens),
      candidate,
    })
    expect(trigger.ok).toBe(true)
    if (!trigger.ok) return
    const settled = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: trigger.prepared,
      d20: 1,
      damageRolls: [1, 1, 1, 1],
    })
    expect(settled.result.ok, settled.result.ok ? undefined : settled.result.reason).toBe(true)
    expect(settled.application?.characters[0].currentHp).toBe(36)
    expect(settled.application?.map.dnd5ePluginAreas?.[0].triggerReceipts).toHaveLength(1)
  })

  it('plans a monster persistent area as a placement transaction without instant target IDs', () => {
    const mummyLord = token({
      id: 'mummy-lord',
      label: 'Mummy Lord',
      poolId: 'srd-5.1:mummy-lord',
      hp: 97,
      maxHp: 97,
      dnd5eCombatState: {
        monsterSpellSlots: { 5: { current: 1, max: 1 } },
      },
    })
    const first = token({
      id: 'hero-one', type: 'player', characterId: 'hero', x: 105, y: 45,
    })
    const second = token({
      id: 'hero-two', type: 'player', x: 115, y: 45,
    })
    const plan = planDnd5eMonsterTurn(
      battleMap([mummyLord, first, second]),
      mummyLord,
      [character()],
      {
        decisionProvider: {
          id: 'test:prefer-insect-plague',
          schemaVersion: 1,
          scoreCandidate(_context, candidate) {
            return {
              candidateId: candidate.id,
              score: candidate.id.includes(':insect-plague:') ? 10_000 : -10_000,
              reasons: [],
            }
          },
        },
      },
    )
    expect(plan.spellCast).toMatchObject({
      spellId: 'insect-plague',
      targetTokenIds: [],
      areaTargetCell: expect.any(Object),
      effect: 'persistent-area',
    })
    expect(plan.decision?.metrics).toMatchObject({
      affectedEnemyCount: 2,
      affectedAllyCount: 0,
    })
  })

  it('casts Spirit Guardians through the shared area transaction and excludes visible allies', () => {
    const priest = token({
      id: 'priest',
      label: 'Priest',
      poolId: 'srd-5.1:priest',
      x: 45,
      y: 45,
      dnd5eCombatState: {
        monsterSpellSlots: { 3: { current: 1, max: 1 } },
      },
    })
    const ally = token({ id: 'ally', label: 'Ally', x: 55, y: 45 })
    const heroToken = token({
      id: 'hero-token', label: 'Hero', type: 'player', characterId: 'hero', x: 65, y: 45,
    })
    const map = battleMap([priest, ally, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-spirit-guardians',
      round: 1,
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: priest.id,
      targetTokenIds: [],
      spellId: 'spirit-guardians',
      slotLevel: 3,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const cast = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: { effectRolls: [] },
    })
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
    const area = cast.application?.map.dnd5ePluginAreas?.find((entry) =>
      entry.id === cast.createdAreaId)
    expect(area).toMatchObject({
      coreSpellId: 'spirit-guardians',
      sourceTokenId: priest.id,
      excludedTargetIds: [ally.id],
    })
    expect(collectDnd5ePersistentAreaTriggers({
      map: cast.application!.map,
      timing: 'turn-start',
      round: 1,
      targetTokenId: ally.id,
      turnKey: '1:ally',
    })).toHaveLength(0)
    expect(collectDnd5ePersistentAreaTriggers({
      map: cast.application!.map,
      timing: 'turn-start',
      round: 1,
      targetTokenId: heroToken.id,
      turnKey: '1:hero-token',
    })).toHaveLength(1)
  })

  it('applies monster Hold Person with concentration and a repeat save', () => {
    const fanatic = token({
      id: 'fanatic',
      label: 'Cult Fanatic',
      poolId: 'srd-5.1:cult-fanatic',
      dnd5eCombatState: {
        monsterSpellSlots: { 2: { current: 1, max: 1 } },
      },
    })
    const heroToken = token({
      id: 'hero-token', label: 'Hero', type: 'player', characterId: 'hero', x: 35,
    })
    const map = battleMap([fanatic, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-hold-person',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: fanatic.id,
      targetTokenIds: [heroToken.id],
      spellId: 'hold-person',
      slotLevel: 2,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: heroToken.id, d20: 1 }],
        effectRolls: [],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.state.combatants.fanatic.classState).toMatchObject({
      concentrationSpellId: 'hold-person',
      concentrationTargetIds: [heroToken.id],
      monsterSpellSlots: { 2: { current: 0, max: 1 } },
    })
    expect(resolved.result.state.combatants[heroToken.id].classState.activeEffects)
      .toContainEqual(expect.objectContaining({
        standardCondition: 'paralyzed',
        source: expect.objectContaining({ actorId: fanatic.id, rulesId: 'hold-person' }),
        repeatSave: expect.objectContaining({ ability: 'wis', timing: 'target-turn-end' }),
      }))
  })

  it('lets Freedom of Movement prevent monster Hold Person without starting concentration', () => {
    const fanatic = token({
      id: 'fanatic',
      label: 'Cult Fanatic',
      poolId: 'srd-5.1:cult-fanatic',
      dnd5eCombatState: { monsterSpellSlots: { 2: { current: 1, max: 1 } } },
    })
    const heroToken = token({
      id: 'hero-token', label: 'Hero', type: 'player', characterId: 'hero', x: 35,
    })
    const freedom = createDnd5eMechanicalEffect({
      definitionId: 'activity:freedom-of-movement',
      label: 'Freedom of Movement',
      source: { kind: 'spell', actorId: 'cleric', rulesId: 'freedom-of-movement', magical: true },
      targetId: heroToken.id,
      modifiers: {
        conditionImmunitiesBySourceMagic: [{
          conditions: ['paralyzed', 'restrained'], sourceMagical: true, suppressExisting: true,
        }],
      },
    })
    const hero = {
      ...character(),
      dnd5eCombatState: { schemaVersion: 2 as const, activeEffects: [freedom] },
    }
    const map = battleMap([fanatic, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-hold-person-freedom',
      map,
      characters: [hero],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: fanatic.id,
      targetTokenIds: [heroToken.id],
      spellId: 'hold-person',
      slotLevel: 2,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: heroToken.id, d20: 1 }],
        effectRolls: [],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.state.combatants.fanatic.classState).toMatchObject({
      monsterSpellSlots: { 2: { current: 0, max: 1 } },
    })
    expect(resolved.result.state.combatants.fanatic.classState.concentrationSpellId).toBeUndefined()
    expect(resolved.result.state.combatants[heroToken.id].conditions).not.toContain('paralyzed')
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'condition-attempted', targetId: heroToken.id, condition: 'paralyzed', prevented: true,
    }))
  })

  it('rejects Hold Person against a non-humanoid before spending its slot', () => {
    const fanatic = token({
      id: 'fanatic', poolId: 'srd-5.1:cult-fanatic',
      dnd5eCombatState: { monsterSpellSlots: { 2: { current: 1, max: 1 } } },
    })
    const wolf = token({ id: 'wolf', poolId: 'srd-5.1:wolf', x: 35 })
    const map = battleMap([fanatic, wolf])
    expect(prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-hold-person-invalid',
      map,
      characters: [],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: fanatic.id,
      targetTokenIds: [wolf.id],
      spellId: 'hold-person',
      slotLevel: 2,
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(fanatic.dnd5eCombatState?.monsterSpellSlots?.['2'].current).toBe(1)
  })

  it('applies monster Banishment only after a failed save', () => {
    const archmage = token({
      id: 'archmage', poolId: 'srd-5.1:archmage', hp: 99, maxHp: 99,
      dnd5eCombatState: { monsterSpellSlots: { 4: { current: 1, max: 1 } } },
    })
    const heroToken = token({
      id: 'hero-token', type: 'player', characterId: 'hero', x: 35,
    })
    const map = battleMap([archmage, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-banishment', map, characters: [character()],
      initiativeOrder: initiative(map.tokens), actorTokenId: archmage.id,
      targetTokenIds: [heroToken.id], spellId: 'banishment', slotLevel: 4,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: heroToken.id, d20: 1 }],
        effectRolls: [],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.state.combatants.archmage.classState.concentrationSpellId)
      .toBe('banishment')
    expect(resolved.result.state.combatants[heroToken.id].conditions)
      .toEqual(expect.arrayContaining(['banished', 'incapacitated']))
  })

  it('uses the actual active-effect slot level for monster Dispel Magic checks', () => {
    const sphinx = token({
      id: 'sphinx', poolId: 'srd-5.1:androsphinx', hp: 199, maxHp: 199,
      dnd5eCombatState: { monsterSpellSlots: { 3: { current: 1, max: 1 } } },
    })
    const held = createDnd5eConditionEffect({
      condition: 'paralyzed',
      source: {
        kind: 'spell', actorId: 'enemy-caster', rulesId: 'hold-person', spellLevel: 4,
      },
      targetId: 'hero-token',
    })
    const hero = {
      ...character(),
      dnd5eCombatState: { schemaVersion: 2 as const, activeEffects: [held] },
    }
    const heroToken = token({
      id: 'hero-token', type: 'player', characterId: hero.id, x: 35,
    })
    const map = battleMap([sphinx, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-dispel-magic', map, characters: [hero],
      initiativeOrder: initiative(map.tokens), actorTokenId: sphinx.id,
      targetTokenIds: [heroToken.id], spellId: 'dispel-magic', slotLevel: 3,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        dispelMagicChecks: [{ effectId: held.id, d20: 20 }],
        effectRolls: [],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'spell-dispelled', spellId: 'hold-person', spellLevel: 4,
      dc: 14, success: true,
    }))
    expect(resolved.application?.characters[0].dnd5eCombatState?.activeEffects ?? [])
      .not.toContainEqual(expect.objectContaining({ id: held.id }))
  })

  it('casts Entangle as a ground area and delegates its creation save to the shared trigger', () => {
    const druid = token({
      id: 'druid', poolId: 'srd-5.1:druid',
      dnd5eCombatState: { monsterSpellSlots: { 1: { current: 1, max: 1 } } },
    })
    const heroToken = token({
      id: 'hero-token', type: 'player', characterId: 'hero', x: 45, y: 5,
    })
    const map = battleMap([druid, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-entangle', round: 1, map, characters: [character()],
      initiativeOrder: initiative(map.tokens), actorTokenId: druid.id,
      targetTokenIds: [], areaTargetCell: { col: 4, row: 0 },
      spellId: 'entangle', slotLevel: 1,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: { effectRolls: [] },
    })
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
    const area = cast.application?.map.dnd5ePluginAreas?.find((entry) =>
      entry.id === cast.createdAreaId)
    expect(area).toMatchObject({
      coreSpellId: 'entangle',
      vertical: { mode: 'ground' },
      movementCostMultiplier: 2,
      concentrationId: 'entangle',
    })
    if (!cast.application || !area) return
    const candidate = collectDnd5ePersistentAreaTriggers({
      map: cast.application.map,
      timing: 'on-create', round: 1, areaId: area.id, turnKey: '1:druid',
    }).find((entry) => entry.targetToken.id === heroToken.id)
    expect(candidate).toBeDefined()
    if (!candidate) return
    const trigger = prepareDnd5ePersistentAreaTrigger({
      combatId: 'monster-entangle', round: 1, map: cast.application.map,
      characters: cast.application.characters, initiativeOrder: initiative(map.tokens), candidate,
    })
    expect(trigger.ok).toBe(true)
    if (!trigger.ok) return
    const settled = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: trigger.prepared,
      d20: 1,
      damageRolls: [],
    })
    expect(settled.result.ok, settled.result.ok ? undefined : settled.result.reason).toBe(true)
    expect(settled.result.state.combatants[heroToken.id].conditions).toContain('restrained')
  })
})


describe('Slow on monster spellcasting', () => {
  it('retains persisted Slow when a drow prepares Faerie Fire', () => {
    const drow = token({ id: 'drow', poolId: 'srd-5.1:drow' })
    drow.dnd5eCombatState = { activeEffects: [createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:slow', label: 'Slow', targetId: drow.id,
      source: { kind: 'spell', actorId: 'caster', rulesId: 'slow' },
      duration: { type: 'concentration', sourceActorId: 'caster', concentrationId: 'slow', remainingRounds: 10 },
      modifiers: { actionSpellDelay: { dieSides: 20, delayMinimum: 11 }, actionOrBonusActionOnly: true },
    })] }
    const target = token({ id: 'target', type: 'player', characterId: 'hero', x: 55, y: 35 })
    const map = battleMap([drow, target])
    const result = prepareDnd5eMonsterCoreSpell({ combatId: 'persisted-slow', round: 2, map, characters: [character()],
      initiativeOrder: initiative(map.tokens), actorTokenId: drow.id, targetTokenIds: [target.id],
      spellId: 'faerie-fire', slotLevel: 1, areaTargetCell: { col: 5, row: 3 } })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.reason)
    expect(result.prepared.state.combatants.drow.classState.activeEffects?.[0]?.modifiers?.actionSpellDelay).toEqual({ dieSides: 20, delayMinimum: 11 })
    const delayed = resolvePreparedDnd5eMonsterCoreSpell({ prepared: result.prepared, resolution: {
      effectRolls: [], slowSpellDelayD20: 11,
      slowSpellIntent: { spellId: 'faerie-fire', spellName: '妖火', slotLevel: 1, targetTokenIds: [target.id],
        effect: 'saving-throw', diceCount: 0, diceSides: 4, castingTime: 'action', areaTargetCell: { col: 5, row: 3 } },
    } }).result
    expect(delayed.ok, delayed.ok ? undefined : delayed.reason).toBe(true)
    expect(delayed.events.some(event => event.type === 'saving-throw-resolved' || event.type === 'spell-cast')).toBe(false)
    expect(delayed.state.combatants.drow.classState.concentrationSpellId).not.toBe('faerie-fire')
    expect(delayed.state.combatants.target.classState.activeEffects?.some(effect => effect.definitionId === 'srd-5.1:spell:faerie-fire') ?? false).toBe(false)

    expect(resolvePreparedDnd5eMonsterCoreSpell({ prepared: result.prepared, resolution: { effectRolls: [], targetSavingThrows: [{ targetId: target.id, d20: 1 }] } }).result.ok).toBe(false)
  })

  const prepare = () => {
    const drow = token({ id: 'drow', label: '卓尔', poolId: 'srd-5.1:drow' })
    const map = battleMap([drow])
    const result = prepareDnd5eMonsterCoreSpell({ combatId: 'slow-monster', round: 1, map, characters: [],
      initiativeOrder: initiative(map.tokens), actorTokenId: drow.id, targetTokenIds: [],
      spellId: 'darkness', slotLevel: 2, areaTargetCell: { col: 3, row: 3 } })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.reason)
    result.prepared.state.combatants.drow.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:slow', label: '缓慢术', targetId: 'drow', source: { kind: 'spell', rulesId: 'slow' },
      modifiers: { actionSpellDelay: { dieSides: 20, delayMinimum: 11 }, actionOrBonusActionOnly: true },
    })]
    return result.prepared
  }
  const intent = { spellId: 'darkness', spellName: '黑暗术', slotLevel: 2, targetTokenIds: [],
    effect: 'persistent-area' as const, diceCount: 0, diceSides: 4, castingTime: 'action' as const,
    areaTargetCell: { col: 3, row: 3 } }
  it('rejects omitted dice; 10 casts normally and 11 defers without creating darkness', () => {
    expect(resolvePreparedDnd5eMonsterCoreSpell({ prepared: prepare(), resolution: { effectRolls: [] } }).result)
      .toMatchObject({ ok: false, reason: 'invalid-dice' })
    const immediate = resolvePreparedDnd5eMonsterCoreSpell({ prepared: prepare(), resolution: { effectRolls: [], slowSpellDelayD20: 10 } })
    expect(immediate.result.ok).toBe(true)
    expect(immediate.createdAreaId).toBeTruthy()
    const delayed = resolvePreparedDnd5eMonsterCoreSpell({ prepared: prepare(), resolution: { effectRolls: [], slowSpellDelayD20: 11, slowSpellIntent: intent } })
    expect(delayed.result.ok).toBe(true)
    expect(delayed.createdAreaId).toBeUndefined()
    expect(delayed.result.state.combatants.drow.classState.concentrationSpellId).not.toBe('darkness')
    expect(delayed.result.state.combatants.drow.classState.monsterSpellUsesBySpellId?.darkness.current).toBe(0)
    const savedMap = JSON.parse(JSON.stringify(delayed.application!.map)) as BattleMap
    expect(savedMap.tokens[0].dnd5eCombatState?.slowDelayedMonsterSpell?.intent.spellId).toBe('darkness')
    const resumed = prepareDnd5eMonsterCoreSpell({ combatId: 'slow-monster', round: 2, map: savedMap, characters: [],
      initiativeOrder: initiative(savedMap.tokens), actorTokenId: 'drow', targetTokenIds: [], spellId: 'darkness', slotLevel: 2,
      areaTargetCell: intent.areaTargetCell })
    expect(resumed.ok).toBe(true)
    if (!resumed.ok) throw new Error(resumed.reason)
    const completed = resolvePreparedDnd5eMonsterCoreSpell({ prepared: resumed.prepared, resolution: { effectRolls: [], completeSlowSpell: true } })
    expect(completed.result.ok).toBe(true)
    expect(completed.createdAreaId).toBeTruthy()
    expect(completed.result.state.combatants.drow.classState.slowDelayedMonsterSpell).toBeUndefined()
    expect(completed.result.state.combatants.drow.classState.monsterSpellUsesBySpellId?.darkness.current).toBe(0)
    expect(completed.result.state.combatants.drow.turn.actionAvailable).toBe(false)
  })
  it('defers a damaging spell before any save or damage rolls are required', () => {
    const mage = token({ id: 'mage', poolId: 'srd-5.1:mage' })
    const target = token({ id: 'target', type: 'player', characterId: 'hero', x: 55, y: 35 })
    const map = battleMap([mage, target])
    const prepared = prepareDnd5eMonsterCoreSpell({ combatId: 'slow-fireball', map, characters: [character()],
      initiativeOrder: initiative(map.tokens), actorTokenId: mage.id, targetTokenIds: [target.id],
      spellId: 'fireball', slotLevel: 3, areaTargetCell: { col: 9, row: 3 } })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) throw new Error(prepared.reason)
    prepared.prepared.state.combatants.mage.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'slow', label: '缓慢术', targetId: mage.id, source: { kind: 'spell', rulesId: 'slow' },
      modifiers: { actionSpellDelay: { dieSides: 20, delayMinimum: 11 } },
    })]
    const delayed = resolvePreparedDnd5eMonsterCoreSpell({ prepared: prepared.prepared, resolution: {
      effectRolls: [], slowSpellDelayD20: 20, slowSpellIntent: { ...intent, spellId: 'fireball', spellName: '火球术',
        slotLevel: 3, effect: 'saving-throw', targetTokenIds: [target.id] },
    } })
    expect(delayed.result.ok).toBe(true)
    expect(delayed.result.events.some(event => event.type === 'saving-throw-resolved' || event.type === 'damage-applied')).toBe(false)
    const repeat = resolvePreparedDnd5eMonsterCoreSpell({ prepared: { ...prepared.prepared, state: delayed.result.state },
      resolution: { effectRolls: [], completeSlowSpell: true } })
    expect(repeat.result.ok).toBe(false)
  })

})

describe('Drow faerie fire automation', () => {
  function prepare(slow = false) {
    const drow = token({ id: 'drow', poolId: 'srd-5.1:drow' })
    const hero = token({ id: 'target', type: 'player', characterId: 'hero', x: 55, y: 35 })
    const map = battleMap([drow, hero])
    const prepared = prepareDnd5eMonsterCoreSpell({ combatId: 'faerie', round: 1, map, characters: [character()],
      initiativeOrder: initiative(map.tokens), actorTokenId: drow.id, targetTokenIds: [hero.id],
      spellId: 'faerie-fire', slotLevel: 1, areaTargetCell: { col: 5, row: 3 } })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) throw new Error(prepared.reason)
    if (slow) prepared.prepared.state.combatants.drow.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'slow', label: '缓慢术', targetId: 'drow', source: { kind: 'spell', rulesId: 'slow' },
      modifiers: { actionSpellDelay: { dieSides: 20, delayMinimum: 11 } },
    })]
    return prepared.prepared
  }
  it.each([1, 20])('resolves target save %i and only marks failed saves', d20 => {
    const result = resolvePreparedDnd5eMonsterCoreSpell({ prepared: prepare(), resolution: {
      effectRolls: [], targetSavingThrows: [{ targetId: 'target', d20 }],
    } }).result
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.target.currentHp).toBe(40)
    expect(result.state.combatants.target.classState.activeEffects?.some(effect => effect.definitionId === 'srd-5.1:spell:faerie-fire') ?? false).toBe(d20 === 1)
    if (d20 === 1) expect(result.state.combatants.drow.classState.concentrationSpellId).toBe('faerie-fire')
  })
  it('requires Slow d20 and defers before target saves', () => {
    expect(resolvePreparedDnd5eMonsterCoreSpell({ prepared: prepare(true), resolution: { effectRolls: [],
      targetSavingThrows: [{ targetId: 'target', d20: 1 }] } }).result).toMatchObject({ ok: false, reason: 'invalid-dice' })
    const result = resolvePreparedDnd5eMonsterCoreSpell({ prepared: prepare(true), resolution: {
      effectRolls: [], slowSpellDelayD20: 11, slowSpellIntent: { spellId: 'faerie-fire', spellName: '妖火',
        slotLevel: 1, targetTokenIds: ['target'], effect: 'saving-throw', diceCount: 0, diceSides: 4,
        castingTime: 'action', areaTargetCell: { col: 5, row: 3 } },
    } }).result
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.drow.classState.slowDelayedMonsterSpell?.intent.spellId).toBe('faerie-fire')
    expect(result.events.some(event => event.type === 'saving-throw-resolved')).toBe(false)
  })
  it('casts faerie fire from the same prepared UI transaction after a non-delaying Slow check', () => {
    const prepared = prepare(true)
    const checked = resolveDnd5eHeadlessAction(prepared.state, {
      type: 'check-slow-spell', actorId: 'drow', requestId: 'same-transaction',
      spellId: 'faerie-fire', spellName: '妖火', slotLevel: 1, d20: 10,
      intent: { kind: 'monster-core', spell: {
        spellId: 'faerie-fire', spellName: '妖火', slotLevel: 1, targetTokenIds: ['target'],
        effect: 'saving-throw', diceCount: 0, diceSides: 4, castingTime: 'action',
        areaTargetCell: { col: 5, row: 3 },
      } },
    })
    expect(checked.ok).toBe(true)
    Object.assign(prepared.state, checked.state)
    const result = resolvePreparedDnd5eMonsterCoreSpell({ prepared, resolution: {
      effectRolls: [], targetSavingThrows: [{ targetId: 'target', d20: 1 }],
    } }).result
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.target.classState.activeEffects?.some(
      effect => effect.definitionId === 'srd-5.1:spell:faerie-fire')).toBe(true)
    expect(result.state.combatants.drow.classState.slowSpellGate).toBeUndefined()
    expect(result.state.combatants.drow.classState.monsterSpellUsesBySpellId?.['faerie-fire'].current).toBe(0)
  })
})

describe('Slow on manual monster spell adjudication', () => {
  it('requires a check, persists deferred intent on the token and applies the adjudication next turn', () => {
    const drow = token({ id: 'manual-drow', poolId: 'srd-5.1:drow' })
    const map = battleMap([drow])
    const prepared = prepareDnd5eMonsterCoreSpell({ combatId: 'manual-slow', round: 1, map, characters: [],
      initiativeOrder: initiative(map.tokens), actorTokenId: drow.id, targetTokenIds: [],
      spellId: 'darkness', slotLevel: 2, areaTargetCell: { col: 3, row: 3 } })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    prepared.prepared.state.combatants[drow.id].classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'slow', label: '缓慢术', targetId: drow.id, source: { kind: 'spell', rulesId: 'slow' },
      modifiers: { actionSpellDelay: { dieSides: 20, delayMinimum: 11 }, actionOrBonusActionOnly: true },
    })]
    const command = { type: 'monster-spell' as const, actorId: drow.id, spellId: 'darkness', slotLevel: 2,
      effects: [{ targetId: drow.id, addCondition: '测试状态' }] }
    expect(resolveDnd5eHeadlessAction(prepared.prepared.state, command)).toMatchObject({ ok: false, reason: 'invalid-dice' })
    const checked = resolveDnd5eHeadlessAction(prepared.prepared.state, { type: 'check-slow-spell', actorId: drow.id,
      requestId: 'manual-check', spellId: 'darkness', spellName: '黑暗术', slotLevel: 2, d20: 20,
      intent: { kind: 'monster-manual', spellId: 'darkness', spellName: '黑暗术', slotLevel: 2 } })
    expect(checked.ok, checked.ok ? undefined : checked.reason).toBe(true)
    expect(checked.state.combatants[drow.id].conditions).not.toContain('测试状态')
    const application = planDnd5eMapResultApplication({ state: checked.state, map, characters: [],
      characterIdByCombatantId: prepared.prepared.characterIdByCombatantId, events: [...checked.events] })
    const savedMap = JSON.parse(JSON.stringify(application.map)) as BattleMap
    expect(savedMap.tokens[0].dnd5eCombatState?.slowSpellGate?.delayed).toBe(true)
    const next = prepareDnd5eMonsterCoreSpell({ combatId: 'manual-slow', round: 2, map: savedMap, characters: [],
      initiativeOrder: initiative(savedMap.tokens), actorTokenId: drow.id, targetTokenIds: [],
      spellId: 'darkness', slotLevel: 2, areaTargetCell: { col: 3, row: 3 } })
    expect(next.ok).toBe(true)
    if (!next.ok) return
    const completed = resolveDnd5eHeadlessAction(next.prepared.state, command)
    expect(completed.ok, completed.ok ? undefined : completed.reason).toBe(true)
    expect(completed.state.combatants[drow.id].classState.monsterSpellUsesBySpellId?.darkness.current).toBe(0)
    expect(completed.state.combatants[drow.id].classState.slowSpellGate).toBeUndefined()
    expect(completed.state.combatants[drow.id].conditions).toContain('测试状态')
  })
})

it('uses the same deferred resource timing for an automated monster area spell', () => {
  const drow = token({ id: 'unified-drow', poolId: 'srd-5.1:drow' })
  const map = battleMap([drow])
  const input = { combatId: 'unified-slow', round: 1, map, characters: [], initiativeOrder: initiative(map.tokens),
    actorTokenId: drow.id, targetTokenIds: [], spellId: 'darkness', slotLevel: 2, areaTargetCell: { col: 3, row: 3 } }
  const prepared = prepareDnd5eMonsterCoreSpell(input)
  expect(prepared.ok).toBe(true)
  if (!prepared.ok) return
  prepared.prepared.state.combatants[drow.id].classState.activeEffects = [createDnd5eMechanicalEffect({
    definitionId: 'slow', label: '缓慢术', targetId: drow.id, source: { kind: 'spell', rulesId: 'slow' },
    modifiers: { actionSpellDelay: { dieSides: 20, delayMinimum: 11 } },
  })]
  const checked = resolveDnd5eHeadlessAction(prepared.prepared.state, { type: 'check-slow-spell', actorId: drow.id,
    requestId: 'unified-check', spellId: 'darkness', spellName: '黑暗术', slotLevel: 2, d20: 11,
    intent: { kind: 'monster-core', spell: { spellId: 'darkness', spellName: '黑暗术', slotLevel: 2,
      targetTokenIds: [], effect: 'persistent-area', diceCount: 0, diceSides: 4, castingTime: 'action', areaTargetCell: input.areaTargetCell } } })
  expect(checked.ok, checked.ok ? undefined : checked.reason).toBe(true)
  expect(checked.state.combatants[drow.id].classState.monsterSpellUsesBySpellId?.darkness.current).toBe(1)
  const application = planDnd5eMapResultApplication({ state: checked.state, map, characters: [],
    characterIdByCombatantId: prepared.prepared.characterIdByCombatantId, events: [...checked.events] })
  expect(application.map.dnd5ePluginAreas ?? []).toHaveLength(0)
  const resumed = prepareDnd5eMonsterCoreSpell({ ...input, round: 2, map: JSON.parse(JSON.stringify(application.map)) })
  expect(resumed.ok).toBe(true)
  if (!resumed.ok) return
  const cast = resolvePreparedDnd5eMonsterCoreSpell({ prepared: resumed.prepared, resolution: { effectRolls: [] } })
  expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
  expect(cast.createdAreaId).toBeTruthy()
  expect(cast.result.state.combatants[drow.id].classState.slowSpellGate).toBeUndefined()
  expect(cast.result.state.combatants[drow.id].classState.monsterSpellUsesBySpellId?.darkness.current).toBe(0)
})


it.each([{spellId:'fire-bolt',delay:false},{spellId:'magic-missile',delay:false},{spellId:'fire-bolt',delay:true},{spellId:'magic-missile',delay:true}])('randomizes actual monster $spellId targets and damage (delay=$delay)', ({spellId,delay}) => {
  const effect = createDnd5eMechanicalEffect({ definitionId: 'test:enemies', label: 'Enemies', targetId: 'mage',
    source: { kind: 'spell' }, modifiers: { perceiveVisibleCreaturesAsHostile: true, randomVisibleCreatureTargets: true } })
  const mage = token({ id: 'mage', poolId: 'srd-5.1:mage', dnd5eCombatState: { activeEffects: [effect] } })
  const ally = token({ id: 'ally', poolId: 'srd-5.1:goblin', x: 35 })
  const enemy = token({ id: 'enemy', type: 'player', x: 45 })
  const hidden = token({ id: 'hidden', x: 55, dnd5eCombatState: { activeEffects: [createDnd5eConditionEffect({
    condition: 'invisible', targetId: 'hidden', source: { kind: 'dm' } })] } })
  const map = battleMap([mage, ally, enemy, hidden, token({ id: 'far', x: 1000 })])
  const projectiles = spellId === 'magic-missile'
  let choices = 0
  const input = { combatId: 'monster-random-spell', map, characters: [], initiativeOrder: initiative([mage]),
    actorTokenId: mage.id, targetTokenIds: ['enemy'], spellId, slotLevel: projectiles ? 1 : 0,
    projectileTargetIds: projectiles ? ['enemy', 'enemy', 'enemy'] : undefined,
    chooseRandomTarget: (occurrence: number, ids: readonly string[]) => {
      expect([...ids].sort()).toEqual(['ally', 'enemy']); choices++; return occurrence === 1 ? 'enemy' : 'ally'
    } }
  let prepared = prepareDnd5eRandomTargetMonsterSpell(input)
  expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
  if (!prepared.ok) throw Error(prepared.reason)
  expect(choices).toBe(projectiles ? 3 : 1)
  if (delay) {
    const ready = prepared.prepared
    ready.state.combatants.mage.classState.activeEffects!.push(createDnd5eMechanicalEffect({
      definitionId: 'test:slow', label: 'Slow', targetId: 'mage', source: { kind: 'spell' },
      modifiers: { actionSpellDelay: { dieSides: 20, delayMinimum: 11 } } }))
    const intent = dnd5eMonsterSpellIntentWithPreparedTargets({ spellId, spellName: spellId, slotLevel: input.slotLevel,
      targetTokenIds: input.targetTokenIds, projectileTargetIds: input.projectileTargetIds,
      effect: ready.spell.effect, diceCount: ready.diceCount, diceSides: ready.spell.dice.sides, castingTime: ready.spell.castingTime }, ready)
    const deferred = resolveDnd5eHeadlessAction(ready.state, { type: 'check-slow-spell', actorId: 'mage',
      requestId: 'delayed-random', spellId, spellName: spellId, slotLevel: input.slotLevel, d20: 20,
      intent: { kind: 'monster-core', spell: intent } })
    expect(deferred.ok).toBe(true)
    expect(deferred.state.combatants.ally.currentHp).toBe(40)
    const state = JSON.parse(JSON.stringify(deferred.state)) as typeof deferred.state
    state.round += 1
    state.combatants.mage.turn.actionAvailable = true
    const saved = planDnd5eMapResultApplication({ state, map, characters: [], characterIdByCombatantId: ready.characterIdByCombatantId })
    const invalidMap = JSON.parse(JSON.stringify(saved.map)) as BattleMap
    invalidMap.tokens.find(t => t.id === 'ally')!.x = 1000
    expect(prepareDnd5eRandomTargetMonsterSpell({ ...input, map: invalidMap, round: state.round,
      chooseRandomTarget: () => { throw Error('Invalid saved target must not reroll') } })).toMatchObject({ ok: false, reason: 'target-out-of-range' })
    prepared = prepareDnd5eRandomTargetMonsterSpell({ ...input, map: JSON.parse(JSON.stringify(saved.map)), round: state.round,
      chooseRandomTarget: () => { throw Error('Delayed completion must not reroll targets') } })
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
    if (!prepared.ok) throw Error(prepared.reason)
    expect(prepared.prepared.targetTokens.map(t => t.id)).toEqual(projectiles ? ['ally', 'enemy'] : ['ally'])
  }
  const initialSlot = prepared.prepared.state.combatants.mage.classState.monsterSpellSlots?.['1']?.current
  const resolved = resolvePreparedDnd5eMonsterCoreSpell({ prepared: prepared.prepared, resolution: projectiles
    ? { projectileTargetIds: prepared.prepared.randomizedProjectileTargetIds, effectRolls: [[1], [2], [3]] }
    : { d20: 19, d20Second: 19, effectRolls: [[5, 6]] } })
  expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
  expect(resolved.result.state.combatants.ally.currentHp).toBe(projectiles ? 34 : 29)
  if (projectiles) expect(resolved.result.state.combatants.enemy.currentHp).toBe(37)
  expect(resolved.result.state.combatants.mage.classState.monsterSpellSlots?.['1']?.current).toBe(initialSlot! - (projectiles ? 1 : 0))
  expect(resolved.result.state.initiativeOrder).toEqual(['mage'])
  expect(ally.hp).toBe(40)
  effect.suspendedBy = ['antimagic-test']
  const suspended = prepareDnd5eRandomTargetMonsterSpell({ ...input, chooseRandomTarget: () => { throw Error('Must not randomize') } })
  expect(suspended.ok).toBe(true)
  if (suspended.ok) expect(suspended.prepared.targetTokens.map(t => t.id)).toEqual(['enemy'])
})

  it.each([1,20])('checks a monster casting save before Magic Missile effects: %s', d20 => {
    const pain=createDnd5eMechanicalEffect({definitionId:'pain',label:'Pain',targetId:'mage',source:{kind:'spell',actorId:'hero-token'},spellcastingSave:{ability:'con',dc:18}})
    const mage = token({
      id: 'mage',
      label: '法师',
      poolId: 'srd-5.1:mage',
      dnd5eCombatState: {
        monsterSpellSlots: { 1: { current: 1, max: 1 } }, activeEffects:[pain],
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: '英雄',
      type: 'player',
      characterId: 'hero',
      x: 35,
    })
    const map = battleMap([mage, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'magic-missile-map',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mage.id,
      targetTokenIds: [heroToken.id],
      spellId: 'magic-missile',
      slotLevel: 1,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      spellcastingSavingThrows:[{effectId:pain.id,d20}],
      resolution: {
        projectileTargetIds: [heroToken.id, heroToken.id, heroToken.id],
        effectRolls: d20 === 20 ? [[4], [3], [2]] : [],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(d20===20?28:40)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === mage.id)
      ?.dnd5eCombatState?.monsterSpellSlots?.['1'].current).toBe(0)
  })


it.each(['thunderwave', 'darkness'] as const)('does not produce map effects after prevented %s casting', spellId => {
  const id = 'prevented-caster'
  const pain = createDnd5eMechanicalEffect({ definitionId: 'pain', label: 'Pain', targetId: id,
    source: { kind: 'spell' }, spellcastingSave: { ability: 'con', dc: 18 } })
  const caster = token({ id, poolId: spellId === 'thunderwave' ? 'srd-5.1:druid' : 'srd-5.1:drow',
    dnd5eCombatState: { activeEffects: [pain], monsterSpellSlots: { 1: { current: 1, max: 1 } } } })
  const hero = token({ id: 'hero-token', type: 'player', characterId: 'hero', x: 25, y: 5 })
  const map = battleMap([caster, hero])
  const ready = prepareDnd5eMonsterCoreSpell({ combatId: 'prevented-area', map, characters: [character()],
    initiativeOrder: initiative(map.tokens), actorTokenId: id, targetTokenIds: spellId === 'thunderwave' ? [hero.id] : [],
    areaTargetCell: spellId === 'thunderwave' ? { col: 2, row: 0 } : { col: 3, row: 3 },
    spellId, slotLevel: spellId === 'thunderwave' ? 1 : 2 })
  expect(ready.ok, ready.ok ? '' : ready.reason).toBe(true)
  if (!ready.ok) return
  const result = resolvePreparedDnd5eMonsterCoreSpell({ prepared: ready.prepared,
    spellcastingSavingThrows: [{ effectId: pain.id, d20: 1 }], resolution: { effectRolls: [] } })
  expect(result.result.ok, result.result.ok ? '' : result.result.reason).toBe(true)
  if (!result.result.ok) return
  expect(result.result.events).toContainEqual({ type: 'spellcasting-prevented', actorId: id })
  expect(result.application?.map.tokens.find(t => t.id === hero.id)).toMatchObject({ x: 25, y: 5 })
  expect(result.application?.characters[0].currentHp).toBe(40)
  expect(result.application?.map.dnd5ePluginAreas ?? []).toHaveLength(0)
  expect(result.createdAreaId).toBeUndefined()
  expect(result.airborneFalls ?? []).toHaveLength(0)
})
it.each([1, 20, undefined])('checks pain once when a monster starts a delayed spell: %s', d20 => {
  const pain = createDnd5eMechanicalEffect({ definitionId: 'pain', label: 'Pain', targetId: 'drow',
    source: { kind: 'spell' }, spellcastingSave: { ability: 'con', dc: 18 } })
  const slow = createDnd5eMechanicalEffect({ definitionId: 'slow', label: 'Slow', targetId: 'drow',
    source: { kind: 'spell' }, modifiers: { actionSpellDelay: { dieSides: 20, delayMinimum: 11 } } })
  const drow = token({ id: 'drow', poolId: 'srd-5.1:drow', dnd5eCombatState: { activeEffects: [pain, slow] } })
  const map = battleMap([drow])
  const prepare = (map: BattleMap, round: number) => prepareDnd5eMonsterCoreSpell({ combatId: 'pain-delayed', round,
    map, characters: [], initiativeOrder: initiative(map.tokens), actorTokenId: 'drow', targetTokenIds: [],
    spellId: 'darkness', slotLevel: 2, areaTargetCell: { col: 3, row: 3 } })
  const ready = prepare(map, 1)
  expect(ready.ok, ready.ok ? '' : ready.reason).toBe(true)
  if (!ready.ok) return
  const result = resolvePreparedDnd5eMonsterCoreSpell({ prepared: ready.prepared,
    spellcastingSavingThrows: d20 == null ? undefined : [{ effectId: pain.id, d20 }],
    resolution: { effectRolls: [], slowSpellDelayD20: 20, slowSpellIntent: {
      spellId: 'darkness', spellName: 'Darkness', slotLevel: 2, targetTokenIds: [], effect: 'persistent-area',
      diceCount: 0, diceSides: 4, castingTime: 'action', areaTargetCell: { col: 3, row: 3 } } } })
  expect(result.result.ok, result.result.ok ? '' : result.result.reason).toBe(d20 != null)
  if (!result.result.ok) {
    expect(result.result.state.combatants.drow.classState.monsterSpellUsesBySpellId?.darkness.current).toBe(1)
    return
  }
  expect(result.result.state.combatants.drow.classState.monsterSpellUsesBySpellId?.darkness.current).toBe(0)
  expect(result.result.state.combatants.drow.turn.actionAvailable).toBe(false)
  expect(result.result.state.combatants.drow.classState.slowDelayedMonsterSpell != null).toBe(d20 === 20)
  expect(result.result.events.filter(e => e.type === 'saving-throw-resolved')).toHaveLength(1)
  expect(result.application?.map.dnd5ePluginAreas ?? []).toHaveLength(0)
  if (d20 !== 20) return
  const resumed = prepare(JSON.parse(JSON.stringify(result.application!.map)), 2)
  expect(resumed.ok, resumed.ok ? '' : resumed.reason).toBe(true)
  if (!resumed.ok) return
  const completed = resolvePreparedDnd5eMonsterCoreSpell({ prepared: resumed.prepared,
    resolution: { effectRolls: [], completeSlowSpell: true } })
  expect(completed.result.ok, completed.result.ok ? '' : completed.result.reason).toBe(true)
  expect(completed.result.events.filter(e => e.type === 'saving-throw-resolved')).toHaveLength(0)
  expect(completed.result.state.combatants.drow.classState.monsterSpellUsesBySpellId?.darkness.current).toBe(0)
  expect(completed.createdAreaId).toBeTruthy()
})
it.each([false,true])('freezes water with a monster cold area, empty=%s',empty=>{
 const mage=token({id:'mage',poolId:'srd-5.1:mage',x:25,y:225,dnd5eCombatState:{monsterSpellSlots:{5:{current:1,max:1}}}})
 const hero=token({id:'hero-token',type:'player',characterId:'hero',x:425,y:225})
 const map:BattleMap={...battleMap(empty?[mage]:[mage,hero]),width:1000,height:1000,gridSize:50,feetPerCell:5,dnd5ePluginAreas:[{
  id:'water',pluginId:'test.water',featureId:'water',label:'Water',color:'#0ff',sourceCharacterId:'other',sourceTokenId:'other',
  slotLevel:3,sourceSpellSaveDc:15,createdRound:1,expiresAfterRound:101,anchorMode:'fixed',anchorCell:{col:4,row:4},
  cells:[{col:4,row:3},{col:4,row:4},{col:4,row:5}],rectGeometry:{lengthFeet:10,widthFeet:1,gridAligned:false,direction:{dc:0,dr:1}},
  vertical:{mode:'volume',baseElevationFeet:0,heightFeet:10},blocking:{freezesOnColdSpell:true}}]}
 if(!empty)expect(prepareDnd5eMonsterCoreSpell({combatId:'water-cone',map,characters:[character()],initiativeOrder:initiative(map.tokens),actorTokenId:'mage',targetTokenIds:[],spellId:'cone-of-cold',slotLevel:5,areaTargetCell:{col:8,row:4}})).toMatchObject({ok:false,reason:'invalid-target'})
 const ready=prepareDnd5eMonsterCoreSpell({combatId:'water-cone',map,characters:[character()],initiativeOrder:initiative(map.tokens),
  actorTokenId:'mage',targetTokenIds:empty?[]:[hero.id],spellId:'cone-of-cold',slotLevel:5,areaTargetCell:{col:8,row:4}})
 expect(ready.ok,ready.ok?'':ready.reason).toBe(true)
 if(!ready.ok)return
 const result=resolvePreparedDnd5eMonsterCoreSpell({prepared:ready.prepared,resolution:{targetSavingThrows:empty?[]:[{targetId:hero.id,d20:1}],effectRolls:[Array(8).fill(1)]}})
 expect(result.result.ok,result.result.ok?'':result.result.reason).toBe(true)
 expect(result.application!.characters[0].currentHp).toBe(empty?40:32)
 expect(result.application!.map.dnd5ePluginAreas!.filter(a=>a.linkedParentAreaId==='water')).toHaveLength(4)
 expect(result.application!.map.tokens.find(t=>t.id==='mage')!.dnd5eCombatState!.monsterSpellSlots!['5'].current).toBe(0)
})

it.each(['bolt','ball-before','ball-after'] as const)('monster map cast respects water damage path: %s',mode=>{
 const mage=token({id:'mage',poolId:'srd-5.1:mage',x:25,y:525,dnd5eCombatState:{monsterSpellSlots:{3:{current:1,max:1}}}})
 const hero=token({id:'hero-token',type:'player',characterId:'hero',x:275,y:225})
 const wall:Dnd5ePluginArea={id:'wall',pluginId:'test.wall',featureId:'wall',label:'Wall',color:'#0ff',sourceCharacterId:'owner',sourceTokenId:'actor',slotLevel:3,sourceSpellSaveDc:15,createdRound:1,expiresAfterRound:101,anchorMode:'fixed',anchorCell:{col:4,row:4},cells:Array.from({length:7},(_,i)=>({col:4,row:1+i})),rectGeometry:{widthFeet:1,lengthFeet:30,gridAligned:false,direction:{dc:0,dr:1}},vertical:{mode:'volume',baseElevationFeet:0,heightFeet:10},blocking:{halvedDamageTypes:['fire']}}

 const map:BattleMap={...battleMap([mage,hero]),width:1000,height:1000,gridSize:50,feetPerCell:5,dnd5ePluginAreas:[wall]}
 const bolt=mode==='bolt',areaTargetCell=bolt?undefined:{col:mode==='ball-after'?6:2,row:4}
 const prepared=prepareDnd5eMonsterCoreSpell({combatId:'monster-water-path',map,characters:[character()],initiativeOrder:initiative(map.tokens),actorTokenId:mage.id,targetTokenIds:[hero.id],spellId:bolt?'fire-bolt':'fireball',slotLevel:bolt?0:3,areaTargetCell})
 expect(prepared.ok,prepared.ok?'':prepared.reason).toBe(true)
 if(!prepared.ok)return
 const result=resolvePreparedDnd5eMonsterCoreSpell({prepared:prepared.prepared,resolution:bolt?{d20:15,effectRolls:[[6,7]]}:{targetSavingThrows:[{targetId:hero.id,d20:1}],effectRolls:[Array(8).fill(3)]}})
 expect(result.result.ok,result.result.ok?'':result.result.reason).toBe(true)
 expect(result.application?.characters[0].currentHp).toBe(40-(bolt?6:mode==='ball-before'?12:24))
})


it('authorizes legendary cantrip ward saves without a reaction or premature legendary point cost', () => {
  const lich=token({id:'ward-lich',poolId:'srd-5.1:lich',dnd5eCombatState:{monsterLegendaryActionPoints:3}})
  const hero=token({id:'ward-hero',type:'player',characterId:'hero',x:35})
  const map=battleMap([hero,lich])
  const ready=prepareDnd5eMonsterCoreSpell({combatId:'legendary-spell-ward',map,characters:[character()],
    initiativeOrder:initiative(map.tokens),currentInitiativeIndex:0,actorTokenId:lich.id,targetTokenIds:[hero.id],
    spellId:'ray-of-frost',slotLevel:0,legendaryActionId:'cantrip'})
  expect(ready.ok,ready.ok?undefined:ready.reason).toBe(true);if(!ready.ok)throw Error(ready.reason)
  const state=ready.prepared.state
  state.combatants[lich.id].turn.reactionAvailable=false
  const effect=createDnd5eMechanicalEffect({definitionId:'ward',label:'Ward',targetId:hero.id,source:{kind:'plugin',actorId:hero.id},
    attackAttemptWard:{ability:'cha',dc:17,frequency:'once-per-turn',onFailure:'cannot-target-this-turn'}})
  state.combatants[hero.id].classState.activeEffects=[effect]
  const attempt={type:'attack-ward-attempt' as const,actorId:lich.id,targetId:hero.id,
    turnKey:dnd5eHeadlessTurnKey(state,lich.id),legendaryActionId:'cantrip',legendarySpell:{spellId:'ray-of-frost',slotLevel:0},
    saves:[{effectId:effect.id,targetId:lich.id,d20:1}]}
  for(const patch of [{legendaryActionId:undefined},{legendaryActionId:'forged'},
    {legendarySpell:{spellId:'acid-arrow',slotLevel:2}},{legendarySpell:{spellId:'ray-of-frost',slotLevel:1}},
    {legendarySpell:{spellId:'mage-hand',slotLevel:0}},{deflectMissilesReturn:true as const}]) {
    expect(resolveDnd5eHeadlessAction(state,{...attempt,...patch}).ok).toBe(false)
  }
  const exhausted=structuredClone(state);exhausted.combatants[lich.id].classState.monsterLegendaryActionPoints=0
  expect(resolveDnd5eHeadlessAction(exhausted,attempt)).toMatchObject({ok:false,reason:'class-resource-unavailable'})
  const ownTurn=structuredClone(state);ownTurn.initiativeIndex=1
  expect(resolveDnd5eHeadlessAction(ownTurn,{...attempt,turnKey:dnd5eHeadlessTurnKey(ownTurn,lich.id)}).ok).toBe(false)
  for(const d20 of [1,20]) {
    const checked=resolveDnd5eHeadlessAction(state,{...attempt,saves:[{...attempt.saves[0],d20}]})
    expect(checked.ok,checked.ok?undefined:checked.reason).toBe(true)
    expect(checked.state.combatants[lich.id].classState.monsterLegendaryActionPoints).toBe(3)
    expect(checked.state.combatants[lich.id].turn.reactionAvailable).toBe(false)
    const resolved=resolvePreparedDnd5eMonsterCoreSpell({prepared:{...ready.prepared,state:checked.state},
      resolution:{d20:18,effectRolls:[[2,2,2,2]]}}).result
    expect(resolved.ok,resolved.ok?undefined:resolved.reason).toBe(d20===20)
    expect(resolved.state.combatants[hero.id].currentHp).toBe(d20===20?32:40)
    expect(resolved.state.combatants[lich.id].classState.monsterLegendaryActionPoints).toBe(d20===20?2:3)
    expect(resolved.state.combatants[lich.id].turn.reactionAvailable).toBe(false)
    expect(resolved.state.combatants[lich.id].turn.actionAvailable).toBe(true)
  }
})

it('requires authoritative ward receipts before monster spell attack costs and leaves non-attack magic missile unaffected', () => {
  const mage=token({id:'ward-mage',poolId:'srd-5.1:mage',dnd5eCombatState:{monsterSpellSlots:{1:{current:2,max:2}}}})
  const hero=token({id:'ward-hero',type:'player',characterId:'hero',x:35})
  const map=battleMap([mage,hero])
  const effect=createDnd5eMechanicalEffect({definitionId:'ward',label:'Ward',targetId:hero.id,source:{kind:'plugin',actorId:hero.id},
    attackAttemptWard:{ability:'cha',dc:17,frequency:'once-per-turn',onFailure:'cannot-target-this-turn'}})
  const ready=prepareDnd5eMonsterCoreSpell({combatId:'monster-ward',map,characters:[character()],initiativeOrder:initiative(map.tokens),
    actorTokenId:mage.id,targetTokenIds:[hero.id],spellId:'fire-bolt',slotLevel:0})
  expect(ready.ok).toBe(true);if(!ready.ok)throw Error(ready.reason)
  ready.prepared.state.combatants[hero.id].classState.activeEffects=[effect]
  const cast=(state:typeof ready.prepared.state)=>resolvePreparedDnd5eMonsterCoreSpell({prepared:{...ready.prepared,state},resolution:{d20:18,effectRolls:[[5,6]]}})
  const missing=cast(ready.prepared.state)
  expect(missing.result.ok).toBe(false)
  expect(missing.result.state.combatants[mage.id].turn.actionAvailable).toBe(true)
  expect(missing.result.state.combatants[hero.id].currentHp).toBe(40)
  for(const d20 of [1,20]){
    const checked=resolveDnd5eHeadlessAction(ready.prepared.state,{type:'attack-ward-attempt',actorId:mage.id,targetId:hero.id,
      turnKey:dnd5eHeadlessTurnKey(ready.prepared.state,mage.id),saves:[{effectId:effect.id,targetId:mage.id,d20}]})
    expect(checked.ok).toBe(true)
    const resolved=cast(checked.state)
    expect(resolved.result.ok).toBe(d20===20)
    expect(resolved.result.state.combatants[hero.id].currentHp).toBe(d20===20?29:40)
    expect(resolved.result.state.combatants[mage.id].turn.actionAvailable).toBe(d20===1)
    expect(resolved.result.events.filter(e=>e.type==='saving-throw-resolved'&&e.ability==='cha')).toHaveLength(0)
  }
  const missile=prepareDnd5eMonsterCoreSpell({combatId:'monster-ward',map,characters:[character()],initiativeOrder:initiative(map.tokens),
    actorTokenId:mage.id,targetTokenIds:[hero.id],spellId:'magic-missile',slotLevel:1})
  expect(missile.ok).toBe(true);if(!missile.ok)throw Error(missile.reason)
  missile.prepared.state.combatants[hero.id].classState.activeEffects=[effect]
  const resolved=resolvePreparedDnd5eMonsterCoreSpell({prepared:missile.prepared,resolution:{projectileTargetIds:[hero.id,hero.id,hero.id],effectRolls:[[2],[2],[2]]}})
  expect(resolved.result.ok,resolved.result.ok?undefined:resolved.result.reason).toBe(true)
  expect(resolved.result.state.combatants[hero.id].currentHp).toBeLessThan(40)
})


it.each([1, 20])('does not materialize a monster area canceled by source interruption (save=%s)', savingThrowD20 => {
  const featureId = 'test.map-interruption:watcher.interrupt'
  const usesId = 'test.map-interruption:decl-watcher-interrupt-uses'
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.map-interruption', name: 'Map interruption', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'watcher', classId: 'ranger', name: 'Watcher', summary: 'Synthetic', abilities: [{
      schemaVersion: 1, id: 'interrupt', name: 'Interrupt', description: 'Synthetic', level: 11,
      trigger: { kind: 'before-spell-effect' }, cost: { economy: 'reaction', uses: 1 }, targeting: { kind: 'self' },
      limits: { uses: { kind: 'fixed', value: 1 }, reset: 'short-rest' }, effects: [],
      mechanic: { kind: 'source-action-interruption', events: ['spell-cast', 'teleport'], rangeFeet: 60, saveAbility: 'wis', dcAbility: 'wis' }, automation: 'full',
    }] })
  } })
  try {
    const caster = token({ id: 'drow-interrupted', poolId: 'srd-5.1:drow' })
    const hero = token({ id: 'hero-token', type: 'player', characterId: 'hero', x: 25, y: 5 })
    const map = battleMap([caster, hero])
    const ready = prepareDnd5eMonsterCoreSpell({ combatId: 'interrupted-area', map, characters: [character()],
      initiativeOrder: initiative(map.tokens), actorTokenId: caster.id, targetTokenIds: [],
      areaTargetCell: { col: 3, row: 3 }, spellId: 'darkness', slotLevel: 2 })
    expect(ready.ok, ready.ok ? '' : ready.reason).toBe(true)
    if (!ready.ok) return
    // This adapter test supplies an already-authorized reactor snapshot; import/learning is tested separately.
    const watcher = ready.prepared.state.combatants[hero.id]
    Object.assign(watcher, { classId: 'ranger', level: 11, classLevels: { ranger: 11 },
      subclassIds: { ranger: 'test.map-interruption:watcher' }, pluginFeatureIds: [featureId],
      abilities: { ...watcher.abilities, wis: 18 }, proficiencyBonus: 4,
      classResources: { [usesId]: { current: 1, max: 1 } } })
    const result = resolvePreparedDnd5eMonsterCoreSpell({ prepared: ready.prepared, resolution: { effectRolls: [] },
      sourceActionInterruptionReaction: { actorId: hero.id, featureId, savingThrowD20 } })
    expect(result.result.ok, result.result.ok ? '' : result.result.reason).toBe(true)
    expect(result.application?.map.dnd5ePluginAreas ?? []).toHaveLength(savingThrowD20 === 1 ? 0 : 1)
    expect(Boolean(result.createdAreaId)).toBe(savingThrowD20 === 20)
    expect(result.result.state.combatants[hero.id].classResources[usesId].current).toBe(0)
    expect(result.result.state.combatants[caster.id].turn.actionAvailable).toBe(false)
  } finally { dispose() }
})
