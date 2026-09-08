import { afterEach, describe, expect, it } from 'vitest'
import {
  createEmptyMapGeometry,
  setMapGeometryRuntime,
} from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  dnd5eActivePlanarPhase,
} from './activeEffects'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
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
    for (const slug of ['blink-dog', 'nightmare', 'unicorn']) {
      const action = getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions
        .find((candidate) => candidate.id === (slug === 'nightmare' ? 'ethereal-stride' : 'teleport'))
      expect(action).toMatchObject({ automation: 'dm-adjudication' })
      expect(action?.rule).toBeUndefined()
    }
    expect(getDnd5eSrdMonster('srd-5.1:blink-dog')?.actions
      .find((candidate) => candidate.id === 'teleport-only')).toMatchObject({
      automation: 'headless',
      rule: {
        kind: 'teleport', target: 'self', rangeFeet: 40,
        requiresVisibleDestination: true,
        requiresUnoccupiedDestination: true,
      },
    })
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

  it('publishes Ghost and Succubus/Incubus Etherealness as validated self toggles', () => {
    for (const slug of ['ghost', 'succubus-incubus']) {
      const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)!
      expect(monster.actions.find((action) => action.id === 'etherealness')).toMatchObject({
        automation: 'headless',
        kind: 'other',
        rule: { kind: 'toggle-planar-phase', target: 'self', plane: 'ethereal' },
      })
      expect(validateDnd5eMonsterSchema(monster)).toEqual([])
    }
  })

  it('toggles Etherealness atomically and blocks cross-plane attacks', () => {
    const ghost = combatant('ghost', 20, {
      statBlockId: 'srd-5.1:ghost', creatureType: 'undead',
    })
    const hero = combatant('hero', 10, { position: { x: 10, y: 5 } })
    const state = startDnd5eHeadlessCombat('ghost-etherealness', [ghost, hero])
    const forged = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action', actorId: 'ghost', actionId: 'etherealness',
      targetId: 'hero',
    })
    expect(forged).toMatchObject({ ok: false, reason: 'invalid-dice' })
    expect(state.combatants.ghost.turn.actionAvailable).toBe(true)

    const entered = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action', actorId: 'ghost', actionId: 'etherealness',
    })
    expect(entered.ok).toBe(true)
    if (!entered.ok) return
    expect(dnd5eActivePlanarPhase(
      entered.state.combatants.ghost.classState.activeEffects,
    ).plane).toBe('ethereal')
    expect(entered.state.combatants.ghost.turn.actionAvailable).toBe(false)
    expect(state.combatants.ghost.turn.actionAvailable).toBe(true)

    entered.state.initiativeIndex = 1
    const blocked = resolveDnd5eHeadlessAction(entered.state, {
      type: 'attack', actorId: 'hero', targetId: 'ghost', attackModifier: 20,
      d20: 20, damage: { count: 1, sides: 4, bonus: 0, rolls: [4] },
    })
    expect(blocked).toMatchObject({ ok: false, reason: 'invalid-target' })

    entered.state.initiativeIndex = 0
    entered.state.combatants.ghost.turn.actionAvailable = true
    const returned = resolveDnd5eHeadlessAction(entered.state, {
      type: 'monster-special-action', actorId: 'ghost', actionId: 'etherealness',
    })
    expect(returned.ok).toBe(true)
    if (!returned.ok) return
    expect(dnd5eActivePlanarPhase(
      returned.state.combatants.ghost.classState.activeEffects,
    ).plane).toBe('material')
    expect(returned.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', stateKey: 'monster:srd-5.1:ghost:etherealness',
      active: false,
    }))
  })

  it('settles the Nightmare zero-passenger Ethereal Stride choice as a self-only toggle', () => {
    const monster = getDnd5eSrdMonster('srd-5.1:nightmare')!
    expect(monster.actions.find((action) => action.id === 'ethereal-stride-self-only'))
      .toMatchObject({
        automation: 'headless',
        rule: {
          kind: 'toggle-planar-phase', target: 'self', plane: 'ethereal', magical: true,
        },
      })
    expect(validateDnd5eMonsterSchema(monster)).toEqual([])
    const nightmare = combatant('nightmare', 20, {
      statBlockId: monster.id, creatureType: monster.creatureType,
    })
    const hero = combatant('hero', 10, { position: { x: 10, y: 5 } })
    const state = startDnd5eHeadlessCombat('nightmare-self-only-ethereal-stride', [nightmare, hero])
    const entered = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action', actorId: nightmare.id,
      actionId: 'ethereal-stride-self-only',
    })
    expect(entered.ok, entered.ok ? undefined : entered.reason).toBe(true)
    if (!entered.ok) return
    expect(dnd5eActivePlanarPhase(
      entered.state.combatants.nightmare.classState.activeEffects,
    )).toMatchObject({ plane: 'ethereal', suppressCrossPlaneEffects: true })
    expect(entered.state.combatants.nightmare.turn.actionAvailable).toBe(false)
    expect(state.combatants.nightmare.classState.activeEffects).toBeUndefined()
  })

  it('prepares a no-target Etherealness map transaction for the manual UI route', () => {
    const ghostToken = token({ id: 'ghost', label: 'Ghost', poolId: 'srd-5.1:ghost' })
    const heroToken = token({
      id: 'hero', label: 'Hero', type: 'player', characterId: 'hero-character', x: 55,
    })
    const map = battleMap([ghostToken, heroToken], 'ghost-ethereal-map')
    const prepared = prepareDnd5eMonsterSpecialAction({
      combatId: 'combat', map, characters: [character()],
      initiativeOrder: initiative(map.tokens), actorTokenId: ghostToken.id,
      actionId: 'etherealness',
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const settled = resolvePreparedDnd5eMonsterSpecialAction({ prepared: prepared.prepared })
    expect(settled.result.ok).toBe(true)
    expect(settled.application?.map.tokens.find((entry) => entry.id === ghostToken.id)
      ?.dnd5eCombatState?.activeEffects).toEqual(expect.arrayContaining([
        expect.objectContaining({
          definitionId: 'monster:srd-5.1:ghost:etherealness:planar-phase',
          modifiers: { planarPhase: expect.objectContaining({ plane: 'ethereal' }) },
        }),
      ]))
  })

  it('settles Draining Kiss damage, half damage, maximum-HP loss, and target eligibility', () => {
    const fiend = combatant('fiend', 20, {
      statBlockId: 'srd-5.1:succubus-incubus', creatureType: 'fiend',
    })
    const hero = combatant('hero', 10, {
      position: { x: 10, y: 5 }, creatureType: 'humanoid',
    })
    const state = startDnd5eHeadlessCombat('draining-kiss', [fiend, hero])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(fiend.id, hero.id)]: 5,
    }

    const unwilling = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action', actorId: 'fiend', actionId: 'draining-kiss',
      targetId: 'hero', d20: 1, damageRolls: [1, 1, 1, 1, 1],
    })
    expect(unwilling).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(state.combatants.fiend.turn.actionAvailable).toBe(true)

    const willing = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action', actorId: 'fiend', actionId: 'draining-kiss',
      targetId: 'hero', targetWilling: true, d20: 20,
      damageRolls: [1, 1, 1, 1, 1],
    })
    expect(willing.ok, willing.ok ? undefined : willing.reason).toBe(true)
    if (!willing.ok) return
    expect(willing.state.combatants.hero).toMatchObject({ currentHp: 95, maxHp: 95 })
    expect(willing.state.combatants.hero.classState.hitPointMaximumReductionLedger)
      .toMatchObject({ entries: [expect.objectContaining({ amount: 5, recovery: 'long-rest' })] })

    const charmFiend = combatant('fiend', 20, {
      statBlockId: 'srd-5.1:succubus-incubus', creatureType: 'fiend',
    })
    const charmHero = combatant('hero', 10, {
      position: { x: 10, y: 5 }, creatureType: 'humanoid',
    })
    const charmState = startDnd5eHeadlessCombat(
      'draining-kiss-charmed',
      [charmFiend, charmHero],
    )
    charmState.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(charmFiend.id, charmHero.id)]: 5,
    }
    const charmed = resolveDnd5eHeadlessAction(charmState, {
      type: 'monster-special-action', actorId: 'fiend', actionId: 'charm',
      targetId: 'hero', d20: 1,
    })
    expect(charmed.ok, charmed.ok ? undefined : charmed.reason).toBe(true)
    if (!charmed.ok) return
    charmed.state.combatants.fiend.turn.actionAvailable = true
    const kissed = resolveDnd5eHeadlessAction(charmed.state, {
      type: 'monster-special-action', actorId: 'fiend', actionId: 'draining-kiss',
      targetId: 'hero', d20: 1, damageRolls: [1, 1, 1, 1, 1],
    })
    expect(kissed.ok).toBe(true)
    if (!kissed.ok) return
    expect(kissed.state.combatants.hero).toMatchObject({ currentHp: 90, maxHp: 90 })
    expect(kissed.events).toContainEqual(expect.objectContaining({
      type: 'hit-point-maximum-reduced', amount: 10, recovery: 'long-rest',
    }))
  })

  it('kills when Draining Kiss reduces maximum HP to zero', () => {
    const fiend = combatant('fiend', 20, {
      statBlockId: 'srd-5.1:succubus-incubus', creatureType: 'fiend',
    })
    const hero = combatant('hero', 10, {
      position: { x: 10, y: 5 }, creatureType: 'humanoid', currentHp: 5, maxHp: 5,
    })
    const state = startDnd5eHeadlessCombat('fatal-draining-kiss', [fiend, hero])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(fiend.id, hero.id)]: 5,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action', actorId: 'fiend', actionId: 'draining-kiss',
      targetId: 'hero', targetWilling: true, d20: 1,
      damageRolls: [1, 1, 1, 1, 1],
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero).toMatchObject({
      currentHp: 0,
      maxHp: 0,
      deathSaves: { dead: true, failures: 3 },
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'instant-death', sourceId: 'fiend', targetId: 'hero',
    }))
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

  it('settles the Blink Dog teleport-only choice without fabricating its optional Bite', () => {
    const blinkDogToken = token({
      id: 'blink-dog', label: 'Blink Dog', poolId: 'srd-5.1:blink-dog',
    })
    const heroToken = token({
      id: 'hero', label: 'Hero', type: 'player', characterId: 'hero-character', x: 155,
    })
    const map = battleMap([blinkDogToken, heroToken], 'blink-dog-teleport-only')
    const prepared = prepareDnd5eMonsterSpecialAction({
      combatId: 'combat', map, characters: [character()],
      initiativeOrder: initiative(map.tokens), actorTokenId: blinkDogToken.id,
      actionId: 'teleport-only', destinationCell: { col: 6, row: 0 },
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterSpecialAction({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === blinkDogToken.id))
      .toMatchObject({ x: 65, y: 5, hp: 100 })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'teleported', actorId: blinkDogToken.id, distanceFeet: 30,
    }))
    expect(resolved.result.events.some((event) => event.type === 'attack-resolved')).toBe(false)
    if (resolved.result.ok) {
      expect(resolved.result.state.combatants[blinkDogToken.id].classState
        .monsterRechargeReadyByActionId).toMatchObject({ teleport: false })
      expect(resolved.result.state.combatants[blinkDogToken.id].classState
        .monsterRechargeReadyByActionId?.['teleport-only']).toBeUndefined()
    }
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

  it('ends invisibility on a stable structured ability id and preserves bonus-action economy', () => {
    const wisp = combatant('wisp', 20, { statBlockId: 'srd-5.1:will-o-wisp' })
    const hero = combatant('hero', 10, { currentHp: 0, position: { x: 5, y: 0 } })
    const state = startDnd5eHeadlessCombat('wisp-invisibility', [wisp, hero])
    state.distanceFeetByCombatantPair = { ['hero\u0000wisp']: 5 }
    const hidden = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action', actorId: 'wisp', actionId: 'invisibility',
    })
    expect(hidden.ok).toBe(true)
    if (!hidden.ok) return
    const consumed = resolveDnd5eHeadlessAction(hidden.state, {
      type: 'monster-special-action',
      actorId: 'wisp',
      actionId: 'consume-life',
      targetId: 'hero',
      d20: 20,
      damageRolls: [1, 1, 1],
    })
    expect(consumed.ok, consumed.ok ? undefined : consumed.reason).toBe(true)
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
