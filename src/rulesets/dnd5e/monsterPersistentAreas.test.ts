import { afterEach, describe, expect, it } from 'vitest'
import {
  createEmptyMapGeometry,
  mapGeometryCanSeeToken,
  setMapGeometryRuntime,
} from '../../lib/mapGeometry'
import { migrateMapsState, type BattleMap, type Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { collectDnd5ePersistentAreaTriggers } from './pluginAreas'
import {
  prepareDnd5ePersistentAreaTrigger,
  resolvePreparedDnd5ePersistentAreaTrigger,
} from './pluginAreaTransactions'
import {
  prepareDnd5eMonsterSpecialAction,
  resolvePreparedDnd5eMonsterSpecialAction,
} from './monsterSpecialAction'
import { validateDnd5eMonsterSchema } from './monsterSchema'
import { getDnd5eSrdMonster } from './monsters'
import { planDnd5eMonsterTurn } from './monsterTurnPlanner'

function token(patch: Partial<Token>): Token {
  return {
    id: 'token', label: 'Token', x: 25, y: 25, color: '#fff', emoji: '', size: 1,
    type: 'enemy', hp: 100, maxHp: 100, ...patch,
  }
}

function character(id = 'hero-character'): Character {
  return {
    id, name: 'Hero', player: 'P1', avatar: '', accent: '', race: '',
    charClass: 'Fighter', level: 5, background: '', experience: 0, reputation: 0,
    rulesetId: 'dnd5e-2014-srd-5.1',
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'], skills: [], maxHp: 40, currentHp: 40,
    tempHp: 0, hitDice: '5d10', ac: 14, speed: 30, initiativeBonus: 2,
    saveDC: 10, passivePerception: 10, inspiration: 0, conditions: [],
    notes: '', dmNotes: '', visibleToPlayers: true,
  }
}

function battleMap(tokens: Token[], id = 'map'): BattleMap {
  return {
    id, name: id, width: 1_000, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens,
  }
}

function initiative(tokens: readonly Token[]) {
  return tokens.map((entry, index) => ({
    tokenId: entry.id,
    label: entry.label,
    emoji: entry.emoji ?? '',
    color: entry.color ?? '',
    roll: 20 - index,
  }))
}

describe('monster persistent areas and turn-boundary triggers', () => {
  afterEach(() => setMapGeometryRuntime([]))

  it('publishes reviewed declarations without parsing action prose', () => {
    const cases = [
      ['darkmantle', 'actions', 'darkness-aura'],
      ['dretch', 'actions', 'fetid-cloud'],
      ['kraken', 'legendaryActions', 'ink-cloud-costs-3-actions'],
    ] as const
    for (const [slug, section, actionId] of cases) {
      const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)!
      expect(monster[section]?.find((action) => action.id === actionId)).toMatchObject({
        automation: 'headless',
        rule: { kind: 'persistent-area' },
      })
      expect(validateDnd5eMonsterSchema(monster)).toEqual([])
    }
    expect(getDnd5eSrdMonster('srd-5.1:dretch')?.actions
      .find((action) => action.id === 'fetid-cloud')?.usage)
      .toEqual({ kind: 'per-day', max: 1 })
  })

  it('creates a source-anchored magical darkness volume and starts concentration atomically', () => {
    const darkmantle = token({
      id: 'darkmantle', label: 'Darkmantle', poolId: 'srd-5.1:darkmantle',
    })
    const hero = token({
      id: 'hero', label: 'Hero', type: 'player', characterId: 'hero-character', x: 125,
    })
    const map = battleMap([darkmantle, hero], 'darkness-map')
    const prepared = prepareDnd5eMonsterSpecialAction({
      combatId: 'darkness-combat', round: 2, map, characters: [character()],
      initiativeOrder: initiative(map.tokens), actorTokenId: darkmantle.id,
      actionId: 'darkness-aura',
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterSpecialAction({ prepared: prepared.prepared })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === darkmantle.id)?.dnd5eCombatState)
      .toMatchObject({
        concentrationSpellId: 'monster:srd-5.1:darkmantle:darkness-aura',
      })
    expect(resolved.application?.map.dnd5ePluginAreas).toEqual([
      expect.objectContaining({
        sourceTokenId: darkmantle.id,
        anchorMode: 'source-token',
        concentrationId: 'monster:srd-5.1:darkmantle:darkness-aura',
        vertical: { mode: 'volume', baseElevationFeet: -15, heightFeet: 30, anchorOffsetFeet: -15 },
        lighting: expect.objectContaining({ kind: 'magical-darkness', radiusFeet: 15 }),
      }),
    ])
  })

  it('settles Fetid Cloud at turn start with its complete action/reaction restriction', () => {
    const dretch = token({ id: 'dretch', label: 'Dretch', poolId: 'srd-5.1:dretch' })
    const hero = token({
      id: 'hero', label: 'Hero', type: 'player', characterId: 'hero-character', x: 75,
    })
    const map = battleMap([dretch, hero], 'fetid-map')
    const prepared = prepareDnd5eMonsterSpecialAction({
      combatId: 'fetid-combat', round: 1, map, characters: [character()],
      initiativeOrder: initiative(map.tokens), actorTokenId: dretch.id,
      actionId: 'fetid-cloud',
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eMonsterSpecialAction({ prepared: prepared.prepared })
    expect(cast.result.ok).toBe(true)
    if (!cast.application) return
    expect(collectDnd5ePersistentAreaTriggers({
      map: {
        ...cast.application.map,
        tokens: cast.application.map.tokens.map((entry) =>
          entry.id === hero.id ? { ...entry, elevationFeet: 30 } : entry),
      },
      timing: 'turn-start',
      round: 1,
      turnKey: '1:airborne-hero',
      targetTokenId: hero.id,
    })).toHaveLength(0)
    const candidate = collectDnd5ePersistentAreaTriggers({
      map: cast.application.map,
      timing: 'turn-start',
      round: 1,
      turnKey: '1:hero',
      targetTokenId: hero.id,
    })[0]
    expect(candidate).toBeDefined()
    if (!candidate) return
    const trigger = prepareDnd5ePersistentAreaTrigger({
      combatId: 'fetid-combat', round: 1, map: cast.application.map,
      characters: cast.application.characters,
      initiativeOrder: initiative(map.tokens), candidate,
    })
    expect(trigger.ok).toBe(true)
    if (!trigger.ok) return
    const settled = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: trigger.prepared,
      d20: 1,
    })
    expect(settled.result.ok, settled.result.ok ? undefined : settled.result.reason).toBe(true)
    const effect = settled.application?.characters[0].dnd5eCombatState?.activeEffects
      ?.find((entry) => entry.standardCondition === 'poisoned')
    expect(effect).toMatchObject({
      duration: { type: 'until-turn-boundary', boundary: 'target-turn-start' },
      modifiers: { actionOrBonusActionOnly: true, preventReactions: true },
    })
    expect(settled.result.state.combatants.hero.turn.reactionAvailable).toBe(false)
  })

  it('offers an effective persistent area to the tactical monster planner', () => {
    const dretch = token({ id: 'dretch', poolId: 'srd-5.1:dretch' })
    const hero = token({
      id: 'hero', type: 'player', characterId: 'hero-character', x: 75,
    })
    const plan = planDnd5eMonsterTurn(
      battleMap([dretch, hero], 'planner-map'),
      dretch,
      [character()],
      {
        requiredActionId: 'fetid-cloud',
        decisionProvider: {
          id: 'test:persistent-area',
          schemaVersion: 1,
          scoreCandidate(_context, candidate) {
            return {
              candidateId: candidate.id,
              score: candidate.id.startsWith('special:persistent-area:') ? 1_000 : -1_000,
              reasons: ['test'],
            }
          },
        },
      },
    )
    expect(plan.specialAction).toMatchObject({
      kind: 'persistent-area',
      actionId: 'fetid-cloud',
      destinationCell: { col: 0, row: 0 },
    })
  })

  it('routes magical area saves through the shared Magic Resistance mode', () => {
    const dretch = token({ id: 'dretch', poolId: 'srd-5.1:dretch' })
    const imp = token({ id: 'imp', poolId: 'srd-5.1:imp', x: 75 })
    const map = battleMap([dretch, imp], 'magical-save-map')
    const prepared = prepareDnd5eMonsterSpecialAction({
      combatId: 'magic-area', map, characters: [], initiativeOrder: initiative(map.tokens),
      actorTokenId: dretch.id, actionId: 'fetid-cloud',
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eMonsterSpecialAction({ prepared: prepared.prepared })
    if (!cast.application) return
    const candidate = collectDnd5ePersistentAreaTriggers({
      map: cast.application.map, timing: 'turn-start', round: 1,
      turnKey: '1:imp', targetTokenId: imp.id,
    })[0]
    expect(candidate).toBeDefined()
    if (!candidate?.trigger.savingThrow) return
    const magicalCandidate = {
      ...candidate,
      trigger: {
        ...candidate.trigger,
        savingThrow: { ...candidate.trigger.savingThrow, magical: true },
      },
    }
    const trigger = prepareDnd5ePersistentAreaTrigger({
      combatId: 'magic-area', round: 1, map: cast.application.map,
      characters: [], initiativeOrder: initiative(map.tokens), candidate: magicalCandidate,
    })
    expect(trigger.ok).toBe(true)
    if (!trigger.ok) return
    expect(trigger.prepared.save?.mode).toBe('advantage')
  })

  it('requires an underwater map for Kraken ink, then applies turn-end half-on-save damage once', () => {
    const hero = token({
      id: 'hero', label: 'Hero', type: 'player', characterId: 'hero-character', x: 275, y: 225,
    })
    const kraken = token({
      id: 'kraken', label: 'Kraken', poolId: 'srd-5.1:kraken', size: 4, x: 225, y: 225,
      dnd5eCombatState: { monsterLegendaryActionPoints: 3 },
    })
    const map = battleMap([hero, kraken], 'kraken-map')
    const base = {
      combatId: 'kraken-combat', round: 3, map, characters: [character()],
      initiativeOrder: initiative(map.tokens), actorTokenId: kraken.id,
      actionId: 'ink-cloud-costs-3-actions', legendary: true,
    }
    expect(prepareDnd5eMonsterSpecialAction(base)).toMatchObject({
      ok: false, reason: 'invalid-destination',
    })
    setMapGeometryRuntime([{ ...createEmptyMapGeometry(map.id), environment: 'underwater' }])
    const prepared = prepareDnd5eMonsterSpecialAction(base)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eMonsterSpecialAction({ prepared: prepared.prepared })
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
    expect(cast.result.state.combatants.kraken.classState.monsterLegendaryActionPoints).toBe(0)
    if (!cast.application) return
    const candidate = collectDnd5ePersistentAreaTriggers({
      map: cast.application.map,
      timing: 'turn-end',
      round: 3,
      turnKey: '3:hero',
      targetTokenId: hero.id,
    })[0]
    expect(candidate).toBeDefined()
    if (!candidate) return
    const trigger = prepareDnd5ePersistentAreaTrigger({
      combatId: 'kraken-combat', round: 3, map: cast.application.map,
      characters: cast.application.characters,
      initiativeOrder: initiative(map.tokens), candidate,
    })
    expect(trigger.ok).toBe(true)
    if (!trigger.ok) return
    const settled = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: trigger.prepared,
      d20: 20,
      damageRolls: [10, 10, 10],
    })
    expect(settled.result.ok, settled.result.ok ? undefined : settled.result.reason).toBe(true)
    expect(settled.application?.characters[0].currentHp).toBe(25)
    expect(settled.application?.map.dnd5ePluginAreas?.[0].triggerReceipts).toHaveLength(1)
  })

  it('makes a heavy ink volume block ordinary sight while exempting the Kraken viewer', () => {
    const kraken = token({ id: 'kraken', x: 225, poolId: 'srd-5.1:kraken', size: 4 })
    const target = token({ id: 'target', type: 'player', x: 275 })
    const viewer = token({ id: 'viewer', type: 'player', x: 925 })
    const area = {
      id: 'ink', pluginId: 'srd-5.1', featureId: 'monster:srd-5.1:kraken:ink-cloud',
      sourceKind: 'plugin-feature' as const, label: 'Ink Cloud', color: '#172554',
      sourceCharacterId: kraken.id, sourceTokenId: kraken.id,
      cells: Array.from({ length: 20 }, (_, col) => ({ col, row: 0 })),
      createdRound: 1, expiresAfterRound: 2,
      vertical: { mode: 'volume' as const, baseElevationFeet: -60, heightFeet: 120 },
      obscuration: { kind: 'heavy' as const, sourceCanSeeThrough: true },
    }
    const map = { ...battleMap([kraken, target, viewer], 'vision-map'), dnd5ePluginAreas: [area] }
    const geometry = createEmptyMapGeometry(map.id)
    geometry.vision.enabled = true
    geometry.vision.ambientLight = 'bright'
    expect(mapGeometryCanSeeToken({
      geometry, map, viewer, target, forceEnabled: true, fallbackRangeFeet: 500,
    })).toBe(false)
    expect(mapGeometryCanSeeToken({
      geometry, map, viewer: kraken, target, forceEnabled: true, fallbackRangeFeet: 500,
    })).toBe(true)
    expect(migrateMapsState({ maps: [map], selectedId: map.id }).maps[0]
      .dnd5ePluginAreas?.[0].obscuration)
      .toEqual({ kind: 'heavy', sourceCanSeeThrough: true })
  })
})
