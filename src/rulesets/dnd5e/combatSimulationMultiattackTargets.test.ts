import { afterEach, describe, expect, it, vi } from 'vitest'
import { monsterMechanicFixture } from './test-utils/monsterMechanicFixture'
import type { Character } from '../../types/character'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import { simulateDnd5eCombats } from './combatSimulation'
import {
  getDnd5eSrdMonster,
  setDnd5eRoomMonsterCatalog,
  type Dnd5eMonsterStatBlock,
} from './monsters'
import {
  createDnd5eConditionEffect,
  dnd5eActiveEffectId,
} from './activeEffects'
import { dnd5eMonsterActionAutomation } from './monsterSchema'
import { planDnd5eMonsterTurn } from './monsterTurnPlanner'

function inertHero(id: string, name: string): Character {
  return {
    id,
    name,
    player: id,
    avatar: '',
    accent: '',
    race: 'Human',
    charClass: 'Fighter',
    level: 1,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 500,
    currentHp: 500,
    tempHp: 0,
    hitDice: '1d10',
    ac: 10,
    speed: 0,
    initiativeBonus: -100,
    saveDC: 10,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    equipment: {},
  }
}

function monsterToken(
  monster: Dnd5eMonsterStatBlock,
  patch: Partial<Token> = {},
): Token {
  return {
    id: `${monster.slug}-token`,
    label: monster.name,
    x: 25,
    y: 25,
    color: '#ff0000',
    emoji: '',
    size: 1,
    type: 'enemy',
    poolId: monster.id,
    hp: monster.hitPoints.average,
    maxHp: monster.hitPoints.average,
    ...patch,
  }
}

function heroToken(
  hero: Character,
  x: number,
  y = 25,
): Token {
  return {
    id: `${hero.id}-token`,
    label: hero.name,
    x,
    y,
    color: '#ffffff',
    emoji: '',
    size: 1,
    type: 'player',
    characterId: hero.id,
    hp: hero.currentHp,
    maxHp: hero.maxHp,
  }
}

function battleMap(id: string, tokens: readonly Token[]): BattleMap {
  return {
    id,
    name: id,
    width: 250,
    height: 100,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    feetPerCell: 5,
    tokens: [...tokens],
  }
}

function firstMonsterTurn(
  result: ReturnType<typeof simulateDnd5eCombats>,
  monster: Dnd5eMonsterStatBlock,
) {
  return result.decisionLog.find((entry) => entry.actorName === monster.name)
}

function attackRollTexts(
  turn: NonNullable<ReturnType<typeof firstMonsterTurn>>,
): readonly string[] {
  return turn.executionSteps
    .filter((step) => step.kind === 'roll' && step.text.includes('攻击'))
    .map((step) => step.text)
}

describe('D&D 5e simulation monster Multiattack occurrence targets', () => {
  it('moves then opens the commanded door in each independent simulation trial', () => {
    const monster = getDnd5eSrdMonster('srd-5.1:skeleton')!, owner = getDnd5eSrdMonster('srd-5.1:goblin')!
    const hero = inertHero('door-observer', 'Observer')
    const helper = monsterToken(monster, { dnd5eSummon: { schemaVersion: 1, pluginId: 'test', featureId: 'summon',
      sourceCharacterId: 'owner', sourceTokenId: 'owner-token', createdRound: 1, expiresAfterRound: 600,
      side: 'enemy', commandPolicy: 'persistent-order' },
      dnd5eCombatState: { companionCommand: { schemaVersion: 1, sourceOwnerId: 'owner-token', sourceFeatureId: 'summon',
        command: 'use-object', issuedRound: 1, persistentOrder: true, movementDestination: { mapId: 'door-command', x: 175, y: 25 },
        objectInteraction: { mapId: 'door-command', doorId: 'door', operation: 'open' } } } })
    const map = battleMap('door-command', [helper, monsterToken(owner, { id: 'owner-token', x: 25, y: 75 }), heroToken(hero, 225)])
    const geometry = createEmptyMapGeometry(map.id)
    geometry.doors.push({ id: 'door', kind: 'door', secret: false, label: 'Door', points: [{ x: 200, y: 0 }, { x: 200, y: 50 }], state: 'closed',
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1 })
    const before = structuredClone({ map, geometry })
    const result = simulateDnd5eCombats({ characters: [hero], monsters: [{ monsterId: monster.id, count: 1 }, { monsterId: owner.id, count: 1 }],
      trials: 3, seed: 2, maxRounds: 1, battlefield: { map, geometry } })
    const turn = firstMonsterTurn(result, monster)!
    expect(turn, JSON.stringify(result.decisionLog)).toMatchObject({ actionName: '物件交互', actorPositionAfter: { x: 175, y: 25 },
      outcome: { executed: true, headlessTransactions: 2 } })
    expect(result.actionUsage.find(entry => entry.actionId === 'companion:object')?.uses).toBe(3)
    expect({ map, geometry }).toEqual(before)
  })
  it.each([true, false])('executes a Hide order after movement only behind cover=%s', covered => {
    const monster = getDnd5eSrdMonster('srd-5.1:skeleton')!, owner = getDnd5eSrdMonster('srd-5.1:goblin')!
    const hero = inertHero('hide-observer', 'Observer')
    const helper = monsterToken(monster, { dnd5eSummon: { schemaVersion: 1, pluginId: 'test', featureId: 'summon',
      sourceCharacterId: 'owner', sourceTokenId: 'owner-token', createdRound: 1, expiresAfterRound: 600,
      side: 'enemy', commandPolicy: 'persistent-order' },
      dnd5eCombatState: { companionCommand: { schemaVersion: 1, sourceOwnerId: 'owner-token', sourceFeatureId: 'summon',
        command: 'hide', issuedRound: 1, persistentOrder: true, movementDestination: { mapId: 'hide-command', x: 175, y: 25 } } } })
    const map = battleMap('hide-command', [helper, monsterToken(owner, { id: 'owner-token', x: 25, y: 75 }), heroToken(hero, 225)])
    const geometry = createEmptyMapGeometry(map.id)
    if (covered) geometry.walls.push({ id: 'screen', kind: 'wall', label: 'Screen',
      points: [{ x: 200, y: 0 }, { x: 200, y: 100 }], blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 20, createdAt: 1 })
    const result = simulateDnd5eCombats({ characters: [hero], monsters: [{ monsterId: monster.id, count: 1 }, { monsterId: owner.id, count: 1 }],
      trials: 1, seed: 2, maxRounds: 1, battlefield: { map, geometry } })
    const turn = firstMonsterTurn(result, monster)!
    expect(turn.actorPositionAfter).toEqual({ x: 175, y: 25 })
    expect(turn.outcome.executed).toBe(covered)
    expect(turn.executionSteps.filter(step => step.text === `${monster.name}消耗动作`)).toHaveLength(covered ? 1 : 0)
    if (covered) {
      expect(turn.actionName).toBe('躲藏')
      expect(turn.outcome.headlessTransactions).toBe(2)
      expect(result.actionUsage.find(entry => entry.actionId === 'companion:hide')?.uses).toBe(1)
    }
  })
  it.each([true, false])('reports commanded cliff shove success=%s and spends one action', success => {
    const base = getDnd5eSrdMonster('srd-5.1:skeleton')!
    const monster = { ...base, abilities: { ...base.abilities, str: success ? 30 : 1, dex: 30 } }
    const owner = getDnd5eSrdMonster('srd-5.1:goblin')!
    const hero = inertHero('cliff-target', 'Cliff Target')
    hero.abilities = { ...hero.abilities, str: success ? 1 : 30, dex: success ? 1 : 30 }
    const helper = monsterToken(monster, { x: 175, elevationFeet: 40,
      dnd5eSummon: { schemaVersion: 1, pluginId: 'test', featureId: 'summon', sourceCharacterId: 'owner',
        sourceTokenId: 'owner-token', createdRound: 1, expiresAfterRound: 600, side: 'enemy', commandPolicy: 'persistent-order' },
      dnd5eCombatState: { companionCommand: { schemaVersion: 1, sourceOwnerId: 'owner-token', sourceFeatureId: 'summon',
        command: 'attack', attackKind: 'shove-push', attackTargetId: `${hero.id}-token`, issuedRound: 1, persistentOrder: true } } })
    const map = { ...battleMap('commanded-cliff', [helper,
      monsterToken(owner, { id: 'owner-token', x: 25, y: 75, elevationFeet: 40 }),
      { ...heroToken(hero, 225), elevationFeet: 40 }]), width: 350 }
    const geometry = { ...createEmptyMapGeometry(map.id), obstacles: [{
      id: 'platform', kind: 'obstacle' as const, label: 'Platform',
      points: [{ x: 0, y: 0 }, { x: 250, y: 0 }, { x: 250, y: 100 }, { x: 0, y: 100 }],
      baseHeightFeet: 0, heightFeet: 0, terrainElevationFeet: 40, terrainRegion: true,
      cover: 'none' as const, blocksMovement: false, blocksVision: false, blocksLineOfEffect: false, createdAt: 1,
    }] }
    setDnd5eRoomMonsterCatalog([monster])
    const result = simulateDnd5eCombats({ characters: [hero], customMonsters: [monster],
      monsters: [{ monsterId: monster.id, count: 1 }, { monsterId: owner.id, count: 1 }],
      trials: 1, seed: 2, maxRounds: 1, battlefield: { map, geometry } })
    const turn = firstMonsterTurn(result, monster)!
    expect(turn, JSON.stringify(result.decisionLog)).toMatchObject({ actionName: '推开', outcome: { executed: true, headlessTransactions: 1 } })
    expect(turn.executionSteps.filter(step => step.text.includes('坠落 40 尺'))).toHaveLength(success ? 1 : 0)
    expect(turn.executionSteps.filter(step => step.text === `${monster.name}消耗动作`)).toHaveLength(1)
    if (success) expect(turn.outcome.damage).toBeGreaterThan(0)
    else expect(turn.outcome.damage).toBe(0)
    expect(turn.outcome.targetHpBefore! - turn.outcome.targetHpAfter!).toBe(turn.outcome.damage)
    expect(result.actionUsage.find(entry => entry.actorName === monster.name && entry.actionName === '推开')?.averageDamage).toBe(turn.outcome.damage)
  })
  it.each(['grapple','shove-prone','shove-push'] as const)('executes commanded %s after movement through simulation and worker',async attackKind=>{
    const monster=getDnd5eSrdMonster('srd-5.1:skeleton')!,owner=getDnd5eSrdMonster('srd-5.1:goblin')!
    const hero=inertHero('special-target','Special Target')
    const helper=monsterToken(monster,{dnd5eSummon:{schemaVersion:1,pluginId:'test',featureId:'summon',sourceCharacterId:'owner',
      sourceTokenId:'owner-token',createdRound:1,expiresAfterRound:600,side:'enemy',commandPolicy:'persistent-order'},
      dnd5eCombatState:{companionCommand:{schemaVersion:1,sourceOwnerId:'owner-token',sourceFeatureId:'summon',command:'attack',
        attackKind,attackTargetId:`${hero.id}-token`,issuedRound:1,persistentOrder:true,movementDestination:{mapId:'special-command',x:175,y:25}}}})
    const map=battleMap('special-command',[helper,monsterToken(owner,{id:'owner-token',x:25,y:75}),heroToken(hero,225)])
    if(attackKind==='shove-push')expect(planDnd5eMonsterTurn(map,helper,[hero]).commandedSpecialAttack).toBeUndefined()
    map.width=350
    const before=structuredClone(map)
    const request:Parameters<typeof simulateDnd5eCombats>[0]={characters:[hero],monsters:[{monsterId:monster.id,count:1},{monsterId:owner.id,count:1}],
      trials:1,seed:31415926,maxRounds:1,battlefield:{map,geometry:createEmptyMapGeometry(map.id)}}
    const result=simulateDnd5eCombats(request),turn=firstMonsterTurn(result,monster)!
    expect(turn,JSON.stringify(result.decisionLog)).toMatchObject({actionName:{grapple:'擒抱','shove-prone':'击倒','shove-push':'推开'}[attackKind],outcome:{executed:true}})
    expect(turn.actorPositionAfter).toEqual({x:175,y:25})
    expect(turn.executionSteps.filter(step=>step.text===`${monster.name}消耗动作`)).toHaveLength(1)
    expect(turn.outcome.headlessTransactions).toBeGreaterThanOrEqual(2)
    expect(map).toEqual(before)
    let resolveResult!:(value:typeof result)=>void,rejectResult!:(error:Error)=>void
    const completed=new Promise<typeof result>((resolve,reject)=>{resolveResult=resolve;rejectResult=reject})
    const workerScope={onmessage:null as ((event:MessageEvent)=>void)|null,postMessage:(message:{status:string;result?:typeof result;error?:string})=>{
      if(message.status==='completed'&&message.result)resolveResult(structuredClone(message.result))
      if(message.status==='failed')rejectResult(new Error(message.error))}}
    vi.stubGlobal('self',workerScope)
    try{
      vi.resetModules()
      await import('../../workers/dnd5eCombatSimulation.worker')
      workerScope.onmessage!({data:{id:18,request:structuredClone(request)}} as MessageEvent)
      expect(firstMonsterTurn(await completed,monster)).toEqual(turn)
    }finally{vi.unstubAllGlobals()}
  })
  it.each([
    ['dash',175],['disengage',175],['dodge',175],['help',175],
    ['dash',25],['disengage',25],['dodge',25],['dash',475],
  ] as const)('executes saved %s companion order at x=%i and spends one real Headless action', async (command,destinationX) => {
    const monster=getDnd5eSrdMonster('srd-5.1:skeleton')!
    const owner=getDnd5eSrdMonster('srd-5.1:goblin')!
    const hero=inertHero('command-target','Command Target')
    const helper=monsterToken(monster,{
      dnd5eSummon:{schemaVersion:1,pluginId:'test',featureId:'summon',sourceCharacterId:'owner',
        sourceTokenId:'owner-token',createdRound:1,expiresAfterRound:600,side:'enemy',commandPolicy:'persistent-order'},
      dnd5eCombatState:{companionCommand:{schemaVersion:1,sourceOwnerId:'owner-token',sourceFeatureId:'summon',
        command,helpTargetId:`${hero.id}-token`,helpKind:'attack',issuedRound:1,persistentOrder:true,
        movementDestination:{mapId:'simulation-moving-order',x:destinationX,y:25}}},
    })
    const map={...battleMap('simulation-moving-order',[helper,monsterToken(owner,{id:'owner-token',x:25,y:75}),heroToken(hero,destinationX===475?525:225)]),width:750}
    const request:Parameters<typeof simulateDnd5eCombats>[0]={characters:[hero],monsters:[{monsterId:monster.id,count:1},{monsterId:owner.id,count:1}],
      trials:1,seed:31415926,maxRounds:1,battlefield:{map,geometry:createEmptyMapGeometry(map.id)}}
    const result=simulateDnd5eCombats(request)
    const turn=firstMonsterTurn(result,monster)!
    expect(turn,JSON.stringify(result.decisionLog)).toMatchObject({actionName:{dash:'疾走',disengage:'撤离',dodge:'闪避',help:'协助'}[command],outcome:{executed:true}})
    expect(turn.executionSteps.filter(step=>step.text===`${monster.name}消耗动作`)).toHaveLength(1)
    expect(turn.actorPositionAfter).toEqual({x:destinationX,y:25})
    expect(attackRollTexts(turn)).toEqual([])
    expect(turn.outcome.headlessTransactions).toBeGreaterThanOrEqual(destinationX===25?1:2)
    if(command==='disengage'&&destinationX===175){
      let resolveResult!:(value:typeof result)=>void, rejectResult!:(error:Error)=>void
      const completed=new Promise<typeof result>((resolve,reject)=>{resolveResult=resolve;rejectResult=reject})
      const workerScope={onmessage:null as ((event:MessageEvent)=>void)|null,
        postMessage:(message:{status:string;result?:typeof result;error?:string})=>{
          if(message.status==='completed'&&message.result)resolveResult(structuredClone(message.result))
          if(message.status==='failed')rejectResult(new Error(message.error))
        }}
      vi.stubGlobal('self',workerScope)
      try{
        vi.resetModules()
        await import('../../workers/dnd5eCombatSimulation.worker')
        workerScope.onmessage!({data:{id:17,request:structuredClone(request)}} as MessageEvent)
        expect(firstMonsterTurn(await completed,monster)).toEqual(turn)
      }finally{vi.unstubAllGlobals()}
    }
  })
  it.each(['persistent-order', 'turn-order'] as const)('executes a saved %s Help command and honors its lifetime in simulation', policy => {
    const monster = getDnd5eSrdMonster('srd-5.1:dretch')!
    const owner = getDnd5eSrdMonster('srd-5.1:goblin')!
    const hero = inertHero('help-target', 'Help Target')
    const helper = monsterToken(monster, {
      dnd5eSummon: { schemaVersion: 1, pluginId: 'test', featureId: 'summon', sourceCharacterId: 'owner',
        sourceTokenId: 'owner-token', createdRound: 1, expiresAfterRound: 600, side: 'enemy', commandPolicy: policy },
      dnd5eCombatState: { companionCommand: { schemaVersion: 1, sourceOwnerId: 'owner-token', sourceFeatureId: 'summon',
        command: 'help', helpTargetId: `${hero.id}-token`, helpKind: 'attack', issuedRound: 1, persistentOrder: policy === 'persistent-order' } },
    })
    const map = battleMap('simulation-help-command', [helper, monsterToken(owner, { id: 'owner-token', x: 25, y: 75 }), heroToken(hero, 75)])
    const before = structuredClone(map)
    const result = simulateDnd5eCombats({ characters: [hero],
      monsters: [{ monsterId: monster.id, count: 1 }, { monsterId: owner.id, count: 1 }], trials: 1, seed: 31415926,
      maxRounds: 2, battlefield: { map, geometry: createEmptyMapGeometry(map.id) },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 } })
    const first = firstMonsterTurn(result, monster)
    expect(first, JSON.stringify(result.decisionLog)).toMatchObject({ actionName: '协助', outcome: { executed: true } })
    expect(first!.outcome.headlessTransactions).toBeGreaterThan(0)
    expect(attackRollTexts(first!)).toEqual([])
    const helpTurns = result.decisionLog.filter(turn => turn.actorName === monster.name && turn.actionName === '协助')
    // A single Help action is a completed task, not an indefinite standing order.
    expect(helpTurns).toHaveLength(1)
    expect(map).toEqual(before)
  })
  it('carries the Tyrannosaurus Bite and Tail target allocation into Headless resolution', () => {
    const monster = getDnd5eSrdMonster('srd-5.1:tyrannosaurus-rex')!
    const first = inertHero('split-target-a', 'Split Target A')
    const second = inertHero('split-target-b', 'Split Target B')
    const map = battleMap('simulation-tyrannosaurus-split-targets', [
      monsterToken(monster),
      heroToken(first, 75),
      heroToken(second, 125),
    ])

    const result = simulateDnd5eCombats({
      characters: [first, second],
      monsters: [{ monsterId: monster.id, count: 1 }],
      trials: 1,
      seed: 20260729,
      maxRounds: 1,
      battlefield: {
        map,
        geometry: createEmptyMapGeometry(map.id),
      },
      strategyTraining: {
        enabled: true,
        explorationRate: 0,
        terminalRewardWeight: 1,
      },
    })
    const turn = firstMonsterTurn(result, monster)

    expect(turn, JSON.stringify(result.decisionLog, null, 2)).toBeDefined()
    expect(turn).toMatchObject({
      actionName: monster.actions.find((action) => action.id === 'multiattack')!.name,
      outcome: {
        executed: true,
      },
    })
    expect(turn!.outcome.headlessTransactions).toBeGreaterThan(0)
    const rolls = attackRollTexts(turn!)
    expect(rolls).toHaveLength(2)
    expect(rolls.some((text) => text.includes(first.name))).toBe(true)
    expect(rolls.some((text) => text.includes(second.name))).toBe(true)
  })

  it('uses the mapped Hydra head count as the concrete Bite occurrence count', () => {
    const monster = getDnd5eSrdMonster('srd-5.1:hydra')!
    const hero = inertHero('three-head-target', 'Three Head Target')
    const map = battleMap('simulation-hydra-runtime-head-count', [
      monsterToken(monster, {
        dnd5eCombatState: { monsterHydraHeadCount: 3 },
      }),
      heroToken(hero, 75),
    ])

    const result = simulateDnd5eCombats({
      characters: [hero],
      monsters: [{ monsterId: monster.id, count: 1 }],
      trials: 1,
      seed: 31415926,
      maxRounds: 1,
      battlefield: {
        map,
        geometry: createEmptyMapGeometry(map.id),
      },
      strategyTraining: {
        enabled: true,
        explorationRate: 0,
        terminalRewardWeight: 1,
      },
    })
    const turn = firstMonsterTurn(result, monster)

    expect(turn, JSON.stringify(result.decisionLog, null, 2)).toBeDefined()
    expect(turn).toMatchObject({
      actionName: monster.actions.find((action) => action.id === 'multiattack')!.name,
      outcome: {
        executed: true,
        headlessTransactions: 1,
      },
    })
    expect(attackRollTexts(turn!)).toHaveLength(3)
  })

  it('carries three Kraken Fling relation targets through an all-special Multiattack', () => {
    const catalog = monsterMechanicFixture('kraken', ['tentacle', 'fling', 'multiattack-flings'])
    const multiattack = catalog.actions.find((action) =>
      action.id === 'multiattack-flings')
    const fling = catalog.actions.find((action) => action.id === 'fling')
    const tentacle = catalog.actions.find((action) => action.id === 'tentacle')
    if (!multiattack || !fling || !tentacle) {
      throw new Error('Kraken Fling fixture is missing')
    }
    expect(dnd5eMonsterActionAutomation(multiattack)).toBe('headless')
    expect(dnd5eMonsterActionAutomation(fling)).toBe('headless')
    const monster: Dnd5eMonsterStatBlock = {
      ...catalog,
      name: 'Simulation Kraken',
      englishName: 'Simulation Kraken',
      abilities: { ...catalog.abilities, dex: 30 },
      speed: { ...catalog.speed, walk: 0, swim: 0 },
      // Retain the relation declaration so Headless can validate the seeded
      // grapples, but keep the weapon itself out of tactical candidates.
      actions: [
        multiattack,
        { ...tentacle, automation: 'dm-adjudication' },
        fling,
      ],
    }
    const krakenToken = monsterToken(monster, { id: 'simulation-kraken-token' })
    const heroes = [
      inertHero('fling-target-a', 'Fling Target A'),
      inertHero('fling-target-b', 'Fling Target B'),
      inertHero('fling-target-c', 'Fling Target C'),
    ]
    const targetPositions = [
      { x: 75, y: 25 },
      { x: 25, y: 75 },
      { x: 75, y: 75 },
    ] as const
    const targetTokens = heroes.map((hero, index) => {
      const position = targetPositions[index]!
      const token = heroToken(hero, position.x, position.y)
      const rootId = dnd5eActiveEffectId(
        'relation',
        'grapple',
        krakenToken.id,
        'tentacle',
        token.id,
      )
      const restrainedId = dnd5eActiveEffectId(
        'relation-dependent',
        'grapple',
        krakenToken.id,
        'tentacle',
        token.id,
        'restrained',
      )
      const source = {
        kind: 'monster' as const,
        actorId: krakenToken.id,
        rulesId: `monster:${monster.id}:tentacle:tentacle-grapple`,
      }
      const grappled = createDnd5eConditionEffect({
        id: rootId,
        stackingKey: rootId,
        condition: 'grappled',
        source,
        targetId: token.id,
        escapeCheck: {
          ability: 'str',
          skill: 'athletics',
          alternativeAbility: 'dex',
          alternativeSkill: 'acrobatics',
          dc: 18,
          economy: 'action',
        },
        relation: {
          schemaVersion: 1,
          kind: 'grapple',
          sourceActorId: krakenToken.id,
          sourceActionId: 'tentacle',
          slotGroup: 'tentacle',
          maxDistanceFeet: 30,
          movement: 'drag-target',
          endsOnSourceIncapacitated: true,
        },
      })
      const restrained = createDnd5eConditionEffect({
        id: restrainedId,
        stackingKey: restrainedId,
        condition: 'restrained',
        source,
        targetId: token.id,
        dependsOnEffectId: rootId,
      })
      return {
        ...token,
        dnd5eCombatState: {
          schemaVersion: 2 as const,
          activeEffects: [grappled, restrained],
          conditions: ['grappled', 'restrained'],
        },
      } satisfies Token
    })
    const map = {
      ...battleMap('simulation-kraken-all-special-targets', [
        krakenToken,
        ...targetTokens,
      ]),
      width: 1_000,
      height: 1_000,
    }
    setDnd5eRoomMonsterCatalog([monster])
    const planned = planDnd5eMonsterTurn(map, krakenToken, heroes)
    expect(planned, JSON.stringify(planned, null, 2)).toMatchObject({
      actionIndex: 0,
      attackTargetTokenIds: expect.arrayContaining(
        targetTokens.map((token) => token.id),
      ),
    })

    const result = simulateDnd5eCombats({
      characters: heroes,
      monsters: [{ monsterId: monster.id, count: 1 }],
      customMonsters: [monster],
      trials: 1,
      seed: 27182818,
      maxRounds: 1,
      battlefield: {
        map,
        geometry: createEmptyMapGeometry(map.id),
      },
      strategyTraining: {
        enabled: true,
        explorationRate: 0,
        terminalRewardWeight: 1,
      },
    })
    const turn = firstMonsterTurn(result, monster)

    expect(turn, JSON.stringify(result.decisionLog, null, 2)).toMatchObject({
      actionName: multiattack.name,
      outcome: {
        executed: true,
        headlessTransactions: 1,
        damage: 0,
      },
    })
    const flings = turn!.executionSteps.filter((step) =>
      step.kind === 'result' &&
      step.text.includes('特殊动作 fling'))
    expect(flings, JSON.stringify(turn!.executionSteps, null, 2)).toHaveLength(3)
    for (const hero of heroes) {
      expect(flings.some((step) => step.text.includes(hero.name))).toBe(true)
    }
  })
})

afterEach(() => setDnd5eRoomMonsterCatalog([]))
vi.mock('./monsterMultiattackConstraints', async importOriginal => {
  const original = await importOriginal<typeof import('./monsterMultiattackConstraints')>()
  const { monsterMechanicConstraints } = await import('./test-utils/monsterMechanicConstraints')
  return monsterMechanicConstraints(original)
})
