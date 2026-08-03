import { afterEach, describe, expect, it } from 'vitest'
import {
  createEmptyMapGeometry,
  setMapGeometryRuntime,
} from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { validateDnd5eMonsterSchema } from './monsterSchema'
import {
  prepareDnd5eMonsterSpecialAction,
  resolvePreparedDnd5eMonsterSpecialAction,
} from './monsterSpecialAction'
import { planDnd5eMonsterTurn } from './monsterTurnPlanner'
import type { MonsterDecisionProvider } from './monsterDecisionProvider'
import { getDnd5eSrdMonster } from './monsters'

const abilities = { str: 18, dex: 14, con: 16, int: 12, wis: 12, cha: 16 } as const

function combatant(id: string, initiative: number, patch: Record<string, unknown> = {}) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: id === 'hero' ? 'player' : 'dm',
    initiative,
    abilities,
    proficiencyBonus: 4,
    armorClass: 16,
    currentHp: 100,
    maxHp: 100,
    temporaryHp: 0,
    speed: 30,
    position: { x: 5, y: 5 },
    concentrating: false,
    ...patch,
  })
}

function token(patch: Partial<Token>): Token {
  return {
    id: 'token', label: 'Token', x: 5, y: 5, color: '', emoji: '', size: 1,
    type: 'enemy', hp: 100, maxHp: 100, ...patch,
  }
}

function character(): Character {
  return {
    id: 'hero-character', name: 'Hero', player: 'P1', avatar: '', accent: '',
    race: '', charClass: 'Fighter', level: 5, background: '', experience: 0,
    reputation: 0, rulesetId: 'dnd5e-2014-srd-5.1',
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'], skills: [], maxHp: 40, currentHp: 40,
    tempHp: 0, hitDice: '5d10', ac: 14, speed: 30, initiativeBonus: 2,
    saveDC: 10, passivePerception: 10, inspiration: 0, conditions: [],
    notes: '', dmNotes: '', visibleToPlayers: true,
  }
}

function battleMap(tokens: Token[], id = 'map'): BattleMap {
  return {
    id, name: id, width: 400, height: 200, gridSize: 10,
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

const selectRequested: MonsterDecisionProvider = {
  id: 'test:select-requested-special-action',
  schemaVersion: 1,
  scoreCandidate(_context, candidate) {
    return {
      candidateId: candidate.id,
      score: candidate.id.startsWith('special:') ? 1_000 : -1_000,
      reasons: ['test'],
    }
  },
}

describe('structured monster Teleport and Invisibility', () => {
  afterEach(() => setMapGeometryRuntime([]))

  it('publishes only complete fixed self teleports and keeps composite teleports manual', () => {
    const reviewed = [
      ['androsphinx', 'legendaryActions', 'teleport-costs-2-actions'],
      ['balor', 'actions', 'teleport'],
      ['gynosphinx', 'legendaryActions', 'teleport-costs-2-actions'],
      ['marilith', 'actions', 'teleport'],
      ['nalfeshnee', 'actions', 'teleport'],
      ['solar', 'legendaryActions', 'teleport'],
    ] as const
    for (const [slug, section, actionId] of reviewed) {
      const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)!
      const action = monster[section]?.find((candidate) => candidate.id === actionId)
      expect(action).toMatchObject({
        automation: 'headless',
        rule: {
          kind: 'teleport', target: 'self', rangeFeet: 120,
          requiresVisibleDestination: true,
          requiresUnoccupiedDestination: true,
        },
      })
      expect(validateDnd5eMonsterSchema(monster)).toEqual([])
    }
    for (const slug of ['blink-dog', 'unicorn']) {
      const action = getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions
        .find((candidate) => candidate.id === 'teleport')
      expect(action).toMatchObject({ automation: 'dm-adjudication' })
      expect(action?.rule).toBeUndefined()
    }
  })

  it('publishes five stable invisibility declarations without parsing descriptions', () => {
    for (const slug of ['duergar', 'imp', 'quasit', 'sprite', 'will-o-wisp']) {
      const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)!
      const action = monster.actions.find((candidate) => candidate.id === 'invisibility')!
      expect(action).toMatchObject({
        automation: 'headless',
        rule: { kind: 'invisibility', target: 'self', concentration: true },
      })
      const changedProse = structuredClone(monster)
      changedProse.actions.find((candidate) => candidate.id === 'invisibility')!.description =
        'Narrative wording changed; structured rule remains authoritative.'
      expect(validateDnd5eMonsterSchema(changedProse)).toEqual([])
    }
    expect(getDnd5eSrdMonster('srd-5.1:duergar')?.actions
      .find((candidate) => candidate.id === 'invisibility')?.rule)
      .toMatchObject({
        maximumDurationRounds: 600,
        breakOnMonsterAbilityIds: ['enlarge'],
      })
  })

  it('rechecks bounds, occupancy and sight before creating a teleport transaction', () => {
    const balor = token({ id: 'balor', label: 'Balor', poolId: 'srd-5.1:balor' })
    const heroToken = token({
      id: 'hero', label: 'Hero', type: 'player', characterId: 'hero-character', x: 155,
    })
    const blocker = token({ id: 'blocker', x: 35 })
    const map = battleMap([balor, heroToken, blocker], 'teleport-map')
    const base = {
      combatId: 'combat', map, characters: [character()],
      initiativeOrder: initiative(map.tokens), actorTokenId: balor.id,
      actionId: 'teleport',
    }
    expect(prepareDnd5eMonsterSpecialAction({
      ...base, destinationCell: { col: 40, row: 0 },
    })).toMatchObject({ ok: false, reason: 'invalid-destination' })
    expect(prepareDnd5eMonsterSpecialAction({
      ...base, destinationCell: { col: 3, row: 0 },
    })).toMatchObject({ ok: false, reason: 'destination-occupied' })
    expect(prepareDnd5eMonsterSpecialAction({
      ...base, destinationCell: { col: 25, row: 0 },
    })).toMatchObject({ ok: false, reason: 'destination-out-of-range' })

    const geometry = createEmptyMapGeometry(map.id, 1)
    geometry.walls.push({
      id: 'vision-wall', kind: 'wall', label: 'Wall',
      points: [{ x: 20, y: 0 }, { x: 20, y: 200 }], material: 'stone',
      blocksVision: true, blocksMovement: false, blocksLineOfEffect: false,
      baseHeightFeet: 0, heightFeet: 100, createdAt: 1,
    })
    setMapGeometryRuntime([geometry])
    expect(prepareDnd5eMonsterSpecialAction({
      ...base, destinationCell: { col: 5, row: 0 },
    })).toMatchObject({ ok: false, reason: 'destination-not-visible' })
  })

  it('moves through the shared map application and rejects replay-forged distance without spending', () => {
    const balorToken = token({ id: 'balor', label: 'Balor', poolId: 'srd-5.1:balor' })
    const heroToken = token({
      id: 'hero', label: 'Hero', type: 'player', characterId: 'hero-character', x: 155,
    })
    const map = battleMap([balorToken, heroToken], 'valid-teleport')
    const prepared = prepareDnd5eMonsterSpecialAction({
      combatId: 'combat', map, characters: [character()],
      initiativeOrder: initiative(map.tokens), actorTokenId: balorToken.id,
      actionId: 'teleport', destinationCell: { col: 10, row: 0 },
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterSpecialAction({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === balorToken.id))
      .toMatchObject({ x: 105, y: 5 })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'teleported', actorId: balorToken.id, distanceFeet: 50,
    }))

    const balor = combatant('balor', 20, { statBlockId: 'srd-5.1:balor' })
    const hero = combatant('hero', 10, { position: { x: 100, y: 5 } })
    const state = startDnd5eHeadlessCombat('forged-teleport', [balor, hero])
    state.coordinateUnitsPerFoot = 2
    const forged = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action', actorId: 'balor', actionId: 'teleport',
      teleportDestination: { to: { x: 35, y: 5 }, distanceFeet: 10 },
    })
    expect(forged).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(state.combatants.balor.position).toEqual({ x: 5, y: 5 })
    expect(state.combatants.balor.turn.actionAvailable).toBe(true)
  })

  it('keeps flyers airborne and routes an unsupported aerial arrival through deterministic fall dice', () => {
    const heroToken = token({
      id: 'hero', label: 'Hero', type: 'player', characterId: 'hero-character', x: 155,
    })
    const marilithToken = token({
      id: 'marilith', label: 'Marilith', poolId: 'srd-5.1:marilith',
    })
    const map = battleMap([marilithToken, heroToken], 'aerial-teleport')
    const prepared = prepareDnd5eMonsterSpecialAction({
      combatId: 'combat', map, characters: [character()],
      initiativeOrder: initiative(map.tokens), actorTokenId: marilithToken.id,
      actionId: 'teleport', destinationCell: { col: 5, row: 0 },
      destinationElevationFeet: 20,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const preview = resolvePreparedDnd5eMonsterSpecialAction({ prepared: prepared.prepared })
    expect(preview.result).toMatchObject({ ok: false, reason: 'invalid-dice' })
    expect(preview.airborneFalls).toEqual([expect.objectContaining({
      combatantId: marilithToken.id,
      fallDistanceFeet: 20,
      fallingDamageDice: 2,
    })])
    const settled = resolvePreparedDnd5eMonsterSpecialAction({
      prepared: prepared.prepared,
      airborneFallDamageRollsByCombatantId: { [marilithToken.id]: [3, 4] },
    })
    expect(settled.result.ok).toBe(true)
    expect(settled.application?.map.tokens.find((entry) => entry.id === marilithToken.id))
      .toMatchObject({ x: 55, y: 5, hp: 93 })
    if (settled.result.ok) {
      expect(settled.result.state.combatants.marilith.elevationFeet).toBe(0)
      expect(settled.result.state.combatants.marilith.airborne).toBe(false)
    }
  })

  it('spends the exact legendary cost and resolving the same source snapshot is deterministic', () => {
    const hero = combatant('hero', 20)
    const sphinx = combatant('sphinx', 10, {
      statBlockId: 'srd-5.1:androsphinx',
      position: { x: 5, y: 5 },
      classState: { monsterLegendaryActionPoints: 3 },
    })
    const state = startDnd5eHeadlessCombat('legendary-teleport', [hero, sphinx])
    state.coordinateUnitsPerFoot = 2
    const action = {
      type: 'monster-legendary-special-action' as const,
      actorId: 'sphinx',
      actionId: 'teleport-costs-2-actions',
      teleportDestination: { to: { x: 45, y: 5 }, distanceFeet: 20 },
    }
    const transaction = { transactionId: 'legendary-teleport-command', now: 1 }
    const first = resolveDnd5eHeadlessAction(state, action, transaction)
    const replay = resolveDnd5eHeadlessAction(state, action, transaction)
    expect(first.ok).toBe(true)
    expect(replay).toEqual(first)
    if (!first.ok) return
    expect(first.state.combatants.sphinx.classState.monsterLegendaryActionPoints).toBe(1)
    expect(state.combatants.sphinx.classState.monsterLegendaryActionPoints).toBe(3)
    expect(first.events).toContainEqual(expect.objectContaining({
      type: 'monster-legendary-action-used', cost: 2, remaining: 1,
    }))
  })

  it('applies concentration invisibility and ends it on the declared attack trigger', () => {
    const imp = combatant('imp', 20, { statBlockId: 'srd-5.1:imp' })
    const hero = combatant('hero', 10, { position: { x: 10, y: 5 } })
    const state = startDnd5eHeadlessCombat('monster-invisibility', [imp, hero])
    const hidden = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action', actorId: 'imp', actionId: 'invisibility',
    })
    expect(hidden.ok).toBe(true)
    if (!hidden.ok) return
    expect(hidden.state.combatants.imp.conditions).toContain('invisible')
    expect(hidden.state.combatants.imp.concentrating).toBe(true)
    hidden.state.combatants.imp.turn.actionAvailable = true
    const attacked = resolveDnd5eHeadlessAction(hidden.state, {
      type: 'attack', actorId: 'imp', targetId: 'hero', attackModifier: 0,
      d20: 1, damage: { count: 1, sides: 4, bonus: 0, rolls: [1] },
    })
    expect(attacked.ok).toBe(true)
    if (!attacked.ok) return
    expect(attacked.state.combatants.imp.conditions).not.toContain('invisible')
    expect(attacked.state.combatants.imp.concentrating).toBe(false)
  })

  it('ends invisibility on a stable DM-adjudicated ability id and preserves bonus-action economy', () => {
    const wisp = combatant('wisp', 20, { statBlockId: 'srd-5.1:will-o-wisp' })
    const hero = combatant('hero', 10, { position: { x: 10, y: 5 } })
    const state = startDnd5eHeadlessCombat('wisp-invisibility', [wisp, hero])
    const hidden = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action', actorId: 'wisp', actionId: 'invisibility',
    })
    expect(hidden.ok).toBe(true)
    if (!hidden.ok) return
    const consumed = resolveDnd5eHeadlessAction(hidden.state, {
      type: 'monster-adjudicated-action',
      actorId: 'wisp',
      actionId: 'consume-life',
      effects: [],
    })
    expect(consumed.ok).toBe(true)
    if (!consumed.ok) return
    expect(consumed.state.combatants.wisp.conditions).not.toContain('invisible')
    expect(consumed.state.combatants.wisp.concentrating).toBe(false)
    expect(consumed.state.combatants.wisp.turn.actionAvailable).toBe(false)
    expect(consumed.state.combatants.wisp.turn.bonusActionAvailable).toBe(false)
    expect(consumed.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: 'wisp', resource: 'bonusAction',
    }))
  })

  it('allows the planner to select only Host-legal structured actions', () => {
    const hero = token({
      id: 'hero', type: 'player', characterId: 'hero-character', x: 155,
    })
    const balor = token({ id: 'balor', poolId: 'srd-5.1:balor' })
    const teleportPlan = planDnd5eMonsterTurn(
      battleMap([balor, hero], 'planner-teleport'),
      balor,
      [character()],
      { requiredActionId: 'teleport', decisionProvider: selectRequested },
    )
    expect(teleportPlan.specialAction).toMatchObject({
      kind: 'teleport', actionId: 'teleport',
    })

    const imp = token({ id: 'imp', poolId: 'srd-5.1:imp' })
    const invisibilityPlan = planDnd5eMonsterTurn(
      battleMap([imp, hero], 'planner-invisibility'),
      imp,
      [character()],
      { requiredActionId: 'invisibility', decisionProvider: selectRequested },
    )
    expect(invisibilityPlan.specialAction).toMatchObject({
      kind: 'invisibility', actionId: 'invisibility',
    })
  })
})
