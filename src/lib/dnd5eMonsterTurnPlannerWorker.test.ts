import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import { createEmptyMapGeometry, mapGeometryRuntimeForMap } from './mapGeometry'
import {
  Dnd5eMonsterTurnPlanningCancelledError,
  disposeDnd5eMonsterTurnPlannerWorker,
  planDnd5eMonsterTurnOffThread,
  startDnd5eMonsterTurnPlanning,
} from './dnd5eMonsterTurnPlannerWorker'
import type {
  Dnd5eMonsterTurnWorkerRequest,
  Dnd5eMonsterTurnWorkerResponse,
} from './dnd5eMonsterTurnWorkerProtocol'
import { resolveDnd5eMonsterTurnWorkerInput } from './dnd5eMonsterTurnWorkerRuntime'
import {
  getDnd5eSrdMonster,
  type Dnd5eMonsterStatBlock,
} from '../rulesets/dnd5e/monsters'
import { setDnd5eRoomMonsterCatalog } from '../rulesets/dnd5e/roomMonsterCatalog'
import type { Dnd5eLearnedStrategyProfile } from '../rulesets/dnd5e/monsterStrategyLearning'

function token(patch: Partial<Token>): Token {
  return {
    id: 'token',
    label: 'Token',
    x: 0,
    y: 0,
    color: '',
    emoji: '',
    size: 1,
    type: 'enemy',
    hp: 10,
    maxHp: 10,
    ...patch,
  }
}

function battleMap(tokens: Token[]): BattleMap {
  return {
    id: 'worker-map',
    name: 'Worker map',
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

function customGoblin(): Dnd5eMonsterStatBlock {
  const goblin = structuredClone(getDnd5eSrdMonster('srd-5.1:goblin')!)
  goblin.id = 'custom:worker-goblin'
  goblin.slug = 'worker-goblin'
  goblin.name = 'Worker Goblin'
  return goblin
}

function learnedStrategy(): Dnd5eLearnedStrategyProfile {
  return {
    schemaVersion: 1,
    id: 'dnd5e:learned-contextual-v1:1:10',
    baseProviderId: 'dnd5e:deterministic-tactical-v3',
    sourceTrials: 10,
    sourceSeed: 1,
    explorationRate: 0,
    terminalRewardWeight: 0,
    trainedAt: 1,
    global: { sampleCount: 10, confidence: 1, weights: { damage: 0.2 } },
    monsters: {},
    players: {},
  }
}

class FakeWorker {
  static instances: FakeWorker[] = []

  onmessage: ((event: MessageEvent<Dnd5eMonsterTurnWorkerResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent) => void) | null = null
  messages: Dnd5eMonsterTurnWorkerRequest[] = []
  terminated = false

  constructor() {
    FakeWorker.instances.push(this)
  }

  postMessage(message: Dnd5eMonsterTurnWorkerRequest): void {
    this.messages.push(message)
  }

  terminate(): void {
    this.terminated = true
  }

  emit(message: Dnd5eMonsterTurnWorkerResponse): void {
    this.onmessage?.({ data: message } as MessageEvent<Dnd5eMonsterTurnWorkerResponse>)
  }

  emitError(message: string): void {
    this.onerror?.({ message } as ErrorEvent)
  }
}

describe('D&D 5e monster turn planner Worker client', () => {
  beforeEach(() => {
    FakeWorker.instances = []
    vi.stubGlobal('Worker', FakeWorker)
  })

  afterEach(() => {
    disposeDnd5eMonsterTurnPlannerWorker()
    setDnd5eRoomMonsterCatalog([])
    vi.unstubAllGlobals()
  })

  it('serializes geometry, learned policy, and encounter-local custom monsters', async () => {
    const monster = customGoblin()
    setDnd5eRoomMonsterCatalog([monster])
    const enemy = token({ id: 'enemy', poolId: monster.id })
    const hero = token({ id: 'hero', type: 'player', x: 50 })
    const map = battleMap([enemy, hero])
    const geometry = createEmptyMapGeometry(map.id, 42)
    const strategy = learnedStrategy()

    const task = startDnd5eMonsterTurnPlanning({
      map,
      enemy,
      characters: [],
      geometry,
      learnedStrategy: strategy,
      options: { combatId: 'combat', round: 2 },
    })

    const request = FakeWorker.instances[0].messages[0]
    expect(request).toMatchObject({
      type: 'plan',
      requestId: task.requestId,
      input: {
        geometry: { mapId: map.id, updatedAt: 42 },
        learnedStrategy: { id: strategy.id },
        options: { combatId: 'combat', round: 2 },
      },
    })
    expect(request.input.monsterCatalog?.map((entry) => entry.id)).toContain(monster.id)

    const plan = { moved: false, attacked: false, message: 'planned' }
    FakeWorker.instances[0].emit({
      type: 'planned',
      requestId: task.requestId,
      plan,
    })
    await expect(task.promise).resolves.toEqual(plan)
  })

  it('terminates and rejects stale work when a newer battlefield snapshot supersedes it', async () => {
    const monster = getDnd5eSrdMonster('srd-5.1:goblin')!
    const enemy = token({ id: 'enemy', poolId: monster.id })
    const hero = token({ id: 'hero', type: 'player', x: 50 })
    const input = { map: battleMap([enemy, hero]), enemy, characters: [] }

    const first = startDnd5eMonsterTurnPlanning(input)
    const firstRejection = expect(first.promise).rejects.toBeInstanceOf(
      Dnd5eMonsterTurnPlanningCancelledError,
    )
    const firstWorker = FakeWorker.instances[0]
    const second = startDnd5eMonsterTurnPlanning(input)

    expect(firstWorker.terminated).toBe(true)
    await firstRejection
    firstWorker.emit({
      type: 'planned',
      requestId: first.requestId,
      plan: { moved: false, attacked: false, message: 'stale' },
    })
    firstWorker.emitError('stale worker crash')
    expect(FakeWorker.instances[1].terminated).toBe(false)

    FakeWorker.instances[1].emit({
      type: 'planned',
      requestId: second.requestId,
      plan: { moved: false, attacked: false, message: 'fresh' },
    })
    await expect(second.promise).resolves.toMatchObject({ message: 'fresh' })
  })

  it('uses Worker termination for AbortSignal cancellation', async () => {
    const monster = getDnd5eSrdMonster('srd-5.1:goblin')!
    const enemy = token({ id: 'enemy', poolId: monster.id })
    const hero = token({ id: 'hero', type: 'player', x: 50 })
    const controller = new AbortController()
    const task = startDnd5eMonsterTurnPlanning(
      { map: battleMap([enemy, hero]), enemy, characters: [] },
      { signal: controller.signal },
    )
    const rejection = expect(task.promise).rejects.toMatchObject({ name: 'AbortError' })

    controller.abort()

    expect(FakeWorker.instances[0].terminated).toBe(true)
    await rejection
  })

  it('falls back to the synchronous planner when Worker is unavailable', async () => {
    disposeDnd5eMonsterTurnPlannerWorker()
    vi.stubGlobal('Worker', undefined)
    const monster = getDnd5eSrdMonster('srd-5.1:goblin')!
    const enemy = token({ id: 'enemy', poolId: monster.id, hp: 7, maxHp: 7 })
    const hero = token({ id: 'hero', type: 'player', x: 50, hp: 20, maxHp: 20 })
    const onFallback = vi.fn()

    const plan = await planDnd5eMonsterTurnOffThread(
      { map: battleMap([enemy, hero]), enemy, characters: [] },
      { onSynchronousFallback: onFallback },
    )

    expect(onFallback).toHaveBeenCalledWith(expect.stringContaining('unavailable'))
    expect(plan).toMatchObject({ attacked: true, attackerTokenId: enemy.id, targetTokenId: hero.id })
  })
})

describe('D&D 5e monster turn planner Worker runtime', () => {
  afterEach(() => {
    setDnd5eRoomMonsterCatalog([])
  })

  it('installs request registries, rebuilds the learned provider, and clears them afterward', () => {
    const monster = customGoblin()
    const enemy = token({ id: 'enemy', poolId: monster.id, hp: 7, maxHp: 7 })
    const hero = token({ id: 'hero', type: 'player', x: 50, hp: 20, maxHp: 20 })
    const map = battleMap([enemy, hero])

    const plan = resolveDnd5eMonsterTurnWorkerInput({
      map,
      enemy,
      characters: [],
      geometry: createEmptyMapGeometry(map.id),
      monsterCatalog: [monster],
      learnedStrategy: learnedStrategy(),
    })

    expect(plan).toMatchObject({
      attacked: true,
      attackerTokenId: enemy.id,
      targetTokenId: hero.id,
      decision: { providerId: learnedStrategy().id },
    })
    expect(getDnd5eSrdMonster(monster.id)).toBeUndefined()
    expect(mapGeometryRuntimeForMap(map.id)).toBeUndefined()
  })
})
