import { initializeDnd5eActivityTurnClock } from './dnd5eActivityTurnClock'
import { commitDnd5eExplorationSummons } from './dnd5eExplorationSummonCommit'
import type { SharedRoomGatewayPort } from '../../../ports/sharedRoomGateway'
import { createDnd5eMechanicalEffect } from '../activeEffects'
import { describe, expect, it } from 'vitest'
import { mergeDnd5ePersistentAreaTurnMapDelta, settleDnd5ePersistentAreaTurnTransition } from '../../../pages/maps/persistentAreaTurnBoundary'
import { insertInitiativeEntriesPreservingActive } from '../../../pages/mapsPageHelpers'
import { mergePlayerTokenCombatFields, migrateMapsState, type BattleMap } from '../../../store/maps'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from '../mapBridge'
import { applyDnd5eActivityMapHandoffsV1, dnd5eActivitySummonPlacementCells } from './dnd5eActivityMapInteraction'
import { dnd5eActivityDelayedBoundary, applyDnd5eActivityDeferredMapHandoffs } from './dnd5eActivityDeferredMapHandoffs'
import { settleDnd5eDelayedSummonsAtWorldSecond, enqueueDnd5eDelayedSummon, normalizeDnd5eDelayedSummons, settleDnd5eDelayedSummonsAtTurnStart, type Dnd5eDelayedSummonRequest } from './dnd5eDelayedSummonQueue'

function fixture() {
  const map:BattleMap={id:'delay-map',name:'Delay',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,feetPerCell:5,
    dnd5eActivityTurnClock:{schemaVersion:1,combatId:'combat',turnKey:'turn-1',sequence:10},
    tokens:[{id:'actor',label:'Actor',x:75,y:75,size:1,type:'enemy',color:'',emoji:'',poolId:'srd-5.1:goblin',hp:20,maxHp:20}]}
  const summon={kind:'summon' as const,operationId:'spawn',monsterId:'srd-5.1:wolf',count:1,timing:'source-next-turn-start' as const,durationRounds:2,concentration:false,side:'enemy' as const}
  const request:Dnd5eDelayedSummonRequest={packageId:'test.delay',actionId:'execution-1',actorId:'actor',combatId:'combat',
    activity:{schemaVersion:1,id:'spawn',name:'Spawn',activation:{kind:'action'},target:{kind:'self'},automation:automationCapabilityFromLegacyStatus('full'),
      outcomes:[{id:'spawn',when:{kind:'always'},operations:[{...summon,id:'spawn',count:{kind:'constant',value:1}}]}]},
    handoffs:{persistentAreas:[],movements:[],invocations:[],summons:[summon]},selection:{summonCells:[{col:4,row:1}],summonInitiativeD20s:[12]}}
  const queued=enqueueDnd5eDelayedSummon({map,request,combatId:'combat',round:1,turnKey:'turn-1',turnSequence:10,receiptId:'receipt-1'})
  const settle=(current:BattleMap,patch:Partial<Parameters<typeof settleDnd5eDelayedSummonsAtTurnStart>[0]>={})=>settleDnd5eDelayedSummonsAtTurnStart({map:current,characters:[],combatId:'combat',round:2,turnKey:'turn-2',turnSequence:11,tokenId:'actor',apply:applyDnd5eActivityMapHandoffsV1,sourceAvailable:()=>true,...patch})
  return {map,request,queued,settle}
}

describe('durable delayed summon queue',()=>{
  it.each(['commit', 'conflict', 'active-combat', 'other-map-combat', 'room-changed', 'early'])(
    'commits exploration arrivals from an authoritative snapshot: %s', async mode => {
      const {map,request}=fixture()
      delete map.dnd5eActivityTurnClock
      delete request.combatId
      request.handoffs.summons=request.handoffs.summons.map(summon=>({...summon,explorationDelaySeconds:6}))
      const staged=applyDnd5eActivityDeferredMapHandoffs({...request,map,characters:[],round:1,worldMinute:100,worldSecondRemainder:58})
      if(!staged.ok)throw Error(staged.reason)
      const state:Record<string,unknown>={
        maps:{maps:[staged.map],_sync:{revision:7}},characters:{characters:[],_sync:{revision:3}},
        'campaign-time':{worldMinute:101,worldSecondRemainder:mode==='early'?3:4,_sync:{revision:5}},
        combat:{active:mode==='active-combat'||mode==='other-map-combat',mapId:mode==='other-map-combat'?'other':map.id,_sync:{revision:2}},
      }
      const before=structuredClone(state)
      let writes=0
      const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>={
        loadResource:async<T>(name:string)=>structuredClone(state[name]) as T,
        saveResourcesAtomically:async (batch,options)=>{
          writes++
          expect(batch).toHaveLength(1)
          expect(batch[0].expectedRevision).toBe(7)
          expect(options?.readRevisions).toEqual({combat:2,'campaign-time':5,characters:3})
          if(mode==='conflict')throw Error('state-transaction-conflict:maps')
          state.maps=structuredClone(batch[0].data)
          return {status:'committed',transactionId:'arrival',revisions:{maps:8}}
        },
      }
      const run=()=>commitDnd5eExplorationSummons(gateway,()=>mode!=='room-changed')
      if(mode==='conflict'){
        await expect(run()).rejects.toThrow('state-transaction-conflict')
        expect(state).toEqual(before)
        return
      }
      const shouldCommit=mode==='commit'||mode==='other-map-combat'
      expect(await run()).toBe(shouldCommit)
      expect(writes).toBe(shouldCommit?1:0)
      if(shouldCommit){
        const saved=state.maps as {maps:BattleMap[]}
        expect(saved.maps[0].dnd5eDelayedSummons?.[0].status).toBe('completed')
        expect(saved.maps[0].tokens.filter(token=>token.dnd5eSummon)).toHaveLength(1)
        expect(await run()).toBe(false)
        expect(writes).toBe(1)
      }else expect(state).toEqual(before)
    },
  )

  it('persists an explicit exploration deadline across minute rollover without a fabricated combat clock', () => {
    const {map,request}=fixture()
    delete map.dnd5eActivityTurnClock
    delete request.combatId
    request.handoffs.summons=request.handoffs.summons.map(summon=>({...summon,explorationDelaySeconds:6}))
    const staged=applyDnd5eActivityDeferredMapHandoffs({...request,map,characters:[],round:1,worldMinute:100,worldSecondRemainder:58})
    expect(staged.ok).toBe(true)
    if(!staged.ok)throw Error(staged.reason)
    const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[staged.map]}))).maps[0]
    expect(saved.dnd5eActivityTurnClock).toBeUndefined()
    expect(saved.dnd5eDelayedSummons?.[0]).toMatchObject({dueWorldSecond:6064,status:'pending'})
    expect(saved.dnd5eDelayedSummons?.[0].combatId).toBeUndefined()
    const settle=(worldSecond:number,current=saved)=>settleDnd5eDelayedSummonsAtWorldSecond({map:current,characters:[],worldSecond,apply:applyDnd5eActivityMapHandoffsV1})
    expect(settle(6063).map).toEqual(saved)
    const appeared=settle(6064)
    expect(appeared.map.dnd5eDelayedSummons?.[0].status).toBe('completed')
    expect(appeared.map.tokens.filter(token=>token.dnd5eSummon)).toHaveLength(1)
    expect(appeared.map.tokens.find(token=>token.dnd5eSummon)?.dnd5eSummon?.createdWorldMinute).toBe(101)
    expect(settle(7000,appeared.map).map).toEqual(appeared.map)
    const enteredCombat=initializeDnd5eActivityTurnClock(saved,'new-combat','first')
    expect(enteredCombat.dnd5eDelayedSummons?.[0].status).toBe('pending')
    const combatStart=settleDnd5eDelayedSummonsAtTurnStart({map:enteredCombat,characters:[],combatId:'new-combat',round:1,turnKey:'first',turnSequence:1,tokenId:'actor',apply:applyDnd5eActivityMapHandoffsV1})
    expect(combatStart.map.dnd5eDelayedSummons?.[0].status).toBe('completed')
    expect(combatStart.results[0].initiativeEntries).toHaveLength(1)
  })

  it('hands a pending combat summon to campaign time after combat ends and preserves it across a new combat',()=>{
    const {map,request}=fixture()
    request.handoffs.summons=request.handoffs.summons.map(summon=>({...summon,explorationDelaySeconds:6}))
    const staged=applyDnd5eActivityDeferredMapHandoffs({...request,map,characters:[],round:1,worldMinute:100,worldSecondRemainder:58,delayedBoundary:dnd5eActivityDelayedBoundary(map,'end-combat')})
    if(!staged.ok)throw Error(staged.reason)
    const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[staged.map]}))).maps[0]
    expect(saved.dnd5eDelayedSummons?.[0].dueAfterCombatWorldSecond).toBe(6064)
    const tick=(worldSecond:number)=>settleDnd5eDelayedSummonsAtWorldSecond({map:saved,characters:[],worldSecond,apply:applyDnd5eActivityMapHandoffsV1})
    expect(tick(6063).map).toEqual(saved)
    expect(tick(6064).map.dnd5eDelayedSummons?.[0].status).toBe('completed')
    expect(tick(6064).map.tokens.filter(token=>token.dnd5eSummon)).toHaveLength(1)
    const resumed=initializeDnd5eActivityTurnClock(saved,'another-combat','first')
    expect(resumed.dnd5eDelayedSummons?.[0]).toMatchObject({status:'pending',dueWorldSecond:6064})
    expect(resumed.dnd5eDelayedSummons?.[0].combatId).toBeUndefined()
    expect(migrateMapsState(JSON.parse(JSON.stringify({maps:[resumed]}))).maps[0].dnd5eDelayedSummons).toEqual(resumed.dnd5eDelayedSummons)
  })

  it.each(['token-removed','slot-removed','source-retained'])('preserves the original source turn position when %s',mode=>{
    const {map,request}=fixture()
    const order=[{tokenId:'before',slotId:'before-slot'},{tokenId:'actor',slotId:'source-slot'},{tokenId:'after',slotId:'after-slot'}]
    map.dnd5eActivityTurnClock={schemaVersion:1,combatId:'combat',turnKey:'1:source-slot',sequence:10,cursor:{tokenId:'actor',slotId:'source-slot',round:1,initiativeIndex:1}}
    map.tokens.push({id:'corpse',label:'Corpse',x:225,y:75,size:1,type:'enemy',color:'',emoji:'',poolId:'srd-5.1:bandit',hp:0,maxHp:11,dnd5eCombatState:{deathRound:1,bodyPresent:true}})
    request.handoffs.summons=request.handoffs.summons.map(summon=>({...summon,monsterId:'srd-5.1:zombie',corpseTokenId:'corpse',afterDamageKillOperationId:'damage',persistent:true,independentPersistent:true}))
    const staged=applyDnd5eActivityDeferredMapHandoffs({...request,map,characters:[],round:1,worldMinute:100,delayedBoundary:dnd5eActivityDelayedBoundary(map,'anchor',order)})
    if(!staged.ok)throw Error(staged.reason)
    const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[staged.map]}))).maps[0]
    expect(saved.dnd5eDelayedSummons?.[0].sourceTurn).toEqual({round:2,index:1,slotIds:['before-slot','source-slot','after-slot']})
    if(mode==='token-removed')saved.tokens=saved.tokens.filter(token=>token.id!=='actor')
    const remaining=mode==='source-retained'?order:order.filter(slot=>slot.tokenId!=='actor')
    const tick=(round:number,tokenId:string,current=saved)=>settleDnd5eDelayedSummonsAtTurnStart({map:current,characters:[],combatId:'combat',round,tokenId,slotId:order.find(slot=>slot.tokenId===tokenId)!.slotId,turnKey:round+':'+tokenId,turnSequence:11+round,initiativeOrder:remaining,worldMinute:100,apply:applyDnd5eActivityMapHandoffsV1})
    expect(tick(1,'after').map.dnd5eDelayedSummons?.[0].status).toBe('pending')
    expect(tick(2,'before').map.dnd5eDelayedSummons?.[0].status).toBe('pending')
    const reached=tick(2,'after').map
    expect(reached.dnd5eDelayedSummons?.[0].status).toBe(mode==='source-retained'?'pending':'completed')
    const appeared=mode==='source-retained'?tick(2,'actor',reached).map:reached
    expect(appeared.tokens.filter(token=>token.dnd5eSummon)).toHaveLength(1)
    expect(tick(3,'after',appeared).map).toEqual(appeared)
    if(mode==='token-removed')expect(appeared.tokens.some(token=>token.id==='actor')).toBe(false)
  })

  it.each(['independent','dependent','concentration','protected'])('handles a departed source at exploration arrival: %s',mode=>{
    const {map,request}=fixture()
    delete map.dnd5eActivityTurnClock
    delete request.combatId
    map.tokens.push({id:'corpse',label:'Corpse',x:225,y:75,elevationFeet:15,size:1,type:'enemy',color:'',emoji:'',poolId:'srd-5.1:bandit',hp:0,maxHp:11,dnd5eCombatState:{deathRound:1,bodyPresent:true}})
    request.handoffs.summons=request.handoffs.summons.map(summon=>({...summon,monsterId:'srd-5.1:zombie',corpseTokenId:'corpse',afterDamageKillOperationId:'damage',persistent:true,independentPersistent:mode==='dependent'?undefined:true,concentration:mode==='concentration',explorationDelaySeconds:6}))
    const staged=applyDnd5eActivityDeferredMapHandoffs({...request,map,characters:[],round:1,worldMinute:100})
    if(!staged.ok)throw Error(staged.reason)
    const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[staged.map]}))).maps[0]
    saved.tokens=saved.tokens.filter(token=>token.id!=='actor')
    if(mode==='protected')saved.tokens[0].dnd5eCombatState!.activeEffects=[createDnd5eMechanicalEffect({definitionId:'protected',label:'Protected',targetId:'corpse',source:{kind:'spell',actorId:'actor',rulesId:'ceremony'},undeadCreationProtection:{minimumPower:'wish'},duration:{type:'permanent'}})]
    const before=structuredClone(saved)
    const tick=(worldSecond:number,current=saved)=>settleDnd5eDelayedSummonsAtWorldSecond({map:current,characters:[],worldSecond,apply:applyDnd5eActivityMapHandoffsV1})
    expect(tick(6005).map).toEqual(saved)
    const appeared=tick(6006).map
    expect(appeared.dnd5eDelayedSummons?.[0].status).toBe(mode==='independent'?'completed':mode==='protected'?'blocked':'cancelled')
    expect(appeared.tokens.some(token=>token.id==='actor')).toBe(false)
    if(mode==='independent'){
      expect(appeared.tokens).toHaveLength(1)
      expect(appeared.tokens[0]).toMatchObject({poolId:'srd-5.1:zombie',elevationFeet:15,dnd5eSummon:{sourceTokenId:'actor',independentPersistent:true}})
    }else expect(appeared.tokens).toEqual(saved.tokens)
    expect(tick(6007,appeared).map).toEqual(appeared)
    expect(saved).toEqual(before)
  })

  it('transforms the corpse at its elevation after the caster has moved out of range', () => {
    const {map,request,settle}=fixture()
    map.width=5000
    map.tokens.push({id:'corpse',label:'Corpse',x:225,y:75,elevationFeet:15,size:1,type:'enemy',color:'',emoji:'',poolId:'srd-5.1:bandit',hp:0,maxHp:11,dnd5eCombatState:{deathRound:1,bodyPresent:true}})
    request.handoffs.summons=request.handoffs.summons.map(summon=>({...summon,monsterId:'srd-5.1:zombie',corpseTokenId:'corpse',afterDamageKillOperationId:'damage',persistent:true,independentPersistent:true}))
    const queued=enqueueDnd5eDelayedSummon({map,request,combatId:'combat',round:1,turnKey:'turn-1',turnSequence:10,receiptId:'moved-source'})
    queued.tokens=queued.tokens.map(token=>token.id==='actor'?{...token,x:4025,elevationFeet:0}:token)
    const before=structuredClone(queued)
    const appeared=settle(queued)
    expect(appeared.map.dnd5eDelayedSummons?.[0].status).toBe('completed')
    expect(appeared.map.tokens.find(token=>token.dnd5eSummon)).toMatchObject({x:225,y:75,elevationFeet:15,poolId:'srd-5.1:zombie'})
    expect(appeared.map.tokens.find(token=>token.id==='actor')).toEqual(queued.tokens.find(token=>token.id==='actor'))
    expect(queued).toEqual(before)
  })

  it.each(['valid', 'revived', 'stable-at-zero', 'body-absent', 'removed', 'protected'])('rechecks a damage-killed corpse at appearance: %s', mode => {
    const { map, request, settle } = fixture()
    const corpse = { id:'corpse',label:'Corpse',x:225,y:75,size:1,type:'enemy' as const,color:'',emoji:'',poolId:'srd-5.1:bandit',hp:0,maxHp:11,
      dnd5eCombatState:{deathRound:1, bodyPresent:true} }
    map.tokens.push(corpse)
    request.handoffs.summons=request.handoffs.summons.map(summon=>({...summon,monsterId:'srd-5.1:zombie',corpseTokenId:'corpse',afterDamageKillOperationId:'damage',persistent:true,independentPersistent:true}))
    const queued=enqueueDnd5eDelayedSummon({map,request,combatId:'combat',round:1,turnKey:'turn-1',turnSequence:10,receiptId:'killed'})
    const changed=structuredClone(queued)
    const target=changed.tokens.find(token=>token.id==='corpse')!
    if(mode==='revived')target.hp=5
    if(mode==='stable-at-zero'){target.dnd5eCombatState!.deathRound=undefined;target.dnd5eCombatState!.stableAtZero=true}
    if(mode==='protected')target.dnd5eCombatState!.activeEffects=[createDnd5eMechanicalEffect({definitionId:'funeral',label:'Protected',targetId:'corpse',source:{kind:'spell',actorId:'actor',rulesId:'ceremony'},undeadCreationProtection:{minimumPower:'wish'},duration:{type:'permanent'}})]
    if(mode==='body-absent')target.dnd5eCombatState!.bodyPresent=false
    if(mode==='removed')changed.tokens=changed.tokens.filter(token=>token.id!=='corpse')
    const before=structuredClone(changed)
    const result=settle(changed)
    expect(result.map.dnd5eDelayedSummons?.[0].status).toBe(mode==='valid'?'completed':'blocked')
    expect(result.map.tokens.filter(token=>token.dnd5eSummon)).toHaveLength(mode==='valid'?1:0)
    if(mode!=='valid')expect(result.map.tokens).toEqual(changed.tokens)
    expect(changed).toEqual(before)
    expect(settle(result.map).map).toEqual(result.map)
  })
  it('keeps independently raised persistent creatures from previous casts', () => {
    const { map, request, settle } = fixture()
    const independent = structuredClone(request)
    independent.handoffs.summons = independent.handoffs.summons.map(summon => ({ ...summon,
      monsterId: 'srd-5.1:zombie', persistent: true, independentPersistent: true,
      autonomousBehavior: 'attack-nearest-visible', corpseTokenId: 'corpse' }))
    const withCorpse = structuredClone(map)
    withCorpse.tokens.push({ id:'corpse',label:'Corpse',x:225,y:75,size:1,type:'enemy',color:'',emoji:'',poolId:'srd-5.1:bandit',hp:0,maxHp:11 })
    const queued = enqueueDnd5eDelayedSummon({ map: withCorpse, request: independent, combatId:'combat',round:1,turnKey:'turn-1',turnSequence:10,receiptId:'first' })
    const appeared = settle(queued)
    expect(appeared.map.dnd5eDelayedSummons?.[0].status).toBe('completed')
    const first = appeared.map.tokens.find(token=>token.dnd5eSummon)!
    expect(first).toBeDefined()
    const secondMap = structuredClone(withCorpse)
    secondMap.tokens.push({ ...first, id:'earlier-zombie',x:425,y:425 })
    const secondQueue = enqueueDnd5eDelayedSummon({map:secondMap,request:independent,combatId:'combat',round:1,turnKey:'turn-1',turnSequence:10,receiptId:'second'})
    const second = settle(secondQueue)
    expect(second.map.dnd5eDelayedSummons?.[0].status).toBe('completed')
    expect(second.map.tokens.filter(token=>token.dnd5eSummon)).toHaveLength(2)
    expect(second.map.tokens.find(token=>token.id==='earlier-zombie')).toEqual(secondMap.tokens.find(token=>token.id==='earlier-zombie'))
    expect(second.map.tokens.some(token=>token.id==='corpse')).toBe(false)
  })

  it('rechecks a living bond against current Host scope when the delayed creature appears', () => {
    const { map, request, settle } = fixture()
    const strict = structuredClone(request)
    strict.handoffs.summons = strict.handoffs.summons.map(summon => ({ ...summon, persistent: true,
      bondKey: 'single', existingBondPolicy: 'reject-living' }))
    const queued = enqueueDnd5eDelayedSummon({ map, request: strict, combatId: 'combat', round: 1,
      turnKey: 'turn-1', turnSequence: 10, receiptId: 'strict' })
    const appeared = settle(queued, { sourceLimitMaps: [] })
    expect(appeared.map.dnd5eDelayedSummons?.[0].status).toBe('completed')
    const companion = appeared.map.tokens.find(token => token.dnd5eSummon)!
    expect(companion).toBeDefined()
    const changed = structuredClone(queued)
    changed.tokens.push({ ...companion, id: 'created-before-boundary', x: 425, y: 425 })
    const before = structuredClone(changed)
    const blocked = settle(changed, { sourceLimitMaps: [changed] })
    expect(blocked.map.dnd5eDelayedSummons?.[0]).toMatchObject({ status: 'blocked', reason: 'invalid-summon-placement' })
    expect(blocked.map.tokens).toEqual(changed.tokens)
    expect(changed).toEqual(before)
    expect(settle(queued).map.dnd5eDelayedSummons?.[0].status).toBe('blocked')
  })
  it('offers legal delayed summon cells without creating preview tokens or changing the timing',()=>{
    const {map,request}=fixture()
    const before=JSON.stringify({map,request})
    const cells=dnd5eActivitySummonPlacementCells({map,activity:request.activity,actorId:request.actorId,
      packageId:request.packageId,summons:request.handoffs.summons,selectedCells:[]})
    expect(cells).toContainEqual({col:4,row:1})
    expect(cells).not.toContainEqual({col:1,row:1})
    expect(JSON.stringify({map,request})).toBe(before)
  })
  it('creates a due summon through the actual turn boundary and preserves the active initiative slot',async()=>{
    const {queued}=fixture()
    const transition={cursor:{mapId:queued.id,combatId:'combat',round:2,initiativeIndex:1,tokenId:'actor',slotId:'actor-extra'},
      boundaries:[{timing:'turn-end' as const,round:1,tokenId:'other',turnKey:'turn-1'},
        {timing:'turn-start' as const,round:2,tokenId:'actor',turnKey:'2:actor-extra'}]}
    const phases:string[]=[]
    const callbacks={
      settleBoundary:async({boundary,map,characters}:Parameters<Parameters<typeof settleDnd5ePersistentAreaTurnTransition>[0]['settleBoundary']>[0])=>{
        phases.push(`${boundary.timing}:${map.tokens.length}`)
        return {map,characters:[...characters],logs:[]}
      },
      expireBoundary:({map}:Parameters<Parameters<typeof settleDnd5ePersistentAreaTurnTransition>[0]['expireBoundary']>[0])=>map,
    }
    const settled=await settleDnd5ePersistentAreaTurnTransition({map:queued,characters:[],transition,...callbacks})
    expect(phases).toEqual(['turn-end:1','turn-start:2'])
    expect(settled.initiativeEntries).toHaveLength(1)
    const committed=mergeDnd5ePersistentAreaTurnMapDelta({before:queued,settled:settled.map,current:queued})
    const order=[{tokenId:'actor',slotId:'actor-first',label:'Actor',emoji:'',color:'',roll:20},
      {tokenId:'actor',slotId:'actor-extra',label:'Actor extra',emoji:'',color:'',roll:1}]
    const inserted=insertInitiativeEntriesPreservingActive(order,1,settled.initiativeEntries)
    expect(inserted.order[inserted.index].slotId).toBe('actor-extra')
    expect(inserted.order).toHaveLength(3)
    expect(committed.dnd5eDelayedSummons?.[0].status).toBe('completed')
    const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[committed]}))).maps[0]
    const replay=await settleDnd5ePersistentAreaTurnTransition({map:restored,characters:[],transition,...callbacks})
    expect(replay.map).toBe(restored)
    expect(replay.initiativeEntries).toEqual([])
    expect(phases).toHaveLength(2)
  })
  it('commits the created token and terminal queue receipt together, rejecting concurrent map changes',()=>{
    const {queued,settle}=fixture()
    const settled=settle(queued)
    const committed=mergeDnd5ePersistentAreaTurnMapDelta({before:queued,settled:settled.map,current:queued})
    expect(committed.tokens).toHaveLength(2)
    expect(committed.dnd5eDelayedSummons?.[0].status).toBe('completed')
    for(const current of [
      {...queued,tokens:[...queued.tokens,{...queued.tokens[0],id:'new-occupant',x:225,y:75}]},
      {...queued,dnd5eDelayedSummons:queued.dnd5eDelayedSummons!.map(entry=>({...entry,status:'cancelled' as const}))},
      committed,
    ]){
      const before=JSON.stringify(current)
      expect(()=>mergeDnd5ePersistentAreaTurnMapDelta({before:queued,settled:settled.map,current}))
        .toThrow('stale-delayed-summon-map-commit')
      expect(JSON.stringify(current)).toBe(before)
    }
  })
  it('rejects delayed admission with a missing or stale Host clock before applying any effects',()=>{
    const {map,request}=fixture()
    for(const clock of [undefined,{...map.dnd5eActivityTurnClock!,sequence:11},{...map.dnd5eActivityTurnClock!,combatId:'other'}]){
      const current={...map,dnd5eActivityTurnClock:clock}
      const before=JSON.stringify(current)
      const result=applyDnd5eActivityDeferredMapHandoffs({...request,map:current,characters:[],round:1,
        delayedBoundary:{combatId:'combat',turnKey:'turn-1',turnSequence:10,receiptId:'invalid'}})
      expect(result).toEqual({ok:false,reason:'invalid-delayed-summon-context'})
      expect(JSON.stringify(current)).toBe(before)
    }
  })
  it('cancels the old queue through the map result even if the same concentration has already restarted',()=>{
    const {queued}=fixture()
    queued.dnd5eDelayedSummons![0].request.handoffs.summons[0].concentration=true
    queued.dnd5eDelayedSummons![0].request.concentrationId='spell:synthetic'
    queued.tokens[0].dnd5eCombatState={concentrationSpellId:'spell:synthetic'}
    const snapshot=createDnd5eMapCombatSnapshot({map:queued,characters:[],combatId:'combat',initiativeOrder:[{tokenId:'actor',label:'Actor',emoji:'',color:'',roll:10}]})
    const result=planDnd5eMapResultApplication({...snapshot,map:queued,characters:[],events:[
      {type:'class-state-changed',actorId:'actor',stateKey:'concentration',active:false},
      {type:'class-state-changed',actorId:'actor',stateKey:'concentration',active:true}]})
    expect(result.map.dnd5eDelayedSummons?.[0]).toMatchObject({status:'cancelled',reason:'concentration-ended'})
    expect(queued.dnd5eDelayedSummons?.[0].status).toBe('pending')
  })
  it('cancels a departed source on another creature turn, including after map restoration',()=>{
    const {queued,settle}=fixture()
    const gone=migrateMapsState(JSON.parse(JSON.stringify({maps:[{...queued,tokens:[]}]}))).maps[0]
    expect(settle(gone,{tokenId:'other',turnSequence:10}).map).toBe(gone)
    const cancelled=settle(gone,{tokenId:'other'})
    expect(cancelled.results).toEqual([])
    expect(cancelled.map.dnd5eDelayedSummons?.[0]).toMatchObject({status:'cancelled',reason:'source-unavailable'})
    expect(settle({...cancelled.map,tokens:queued.tokens},{turnSequence:12,turnKey:'turn-3'}).results).toEqual([])
  })
  it.each(['matching','changed','missing','unconscious'] as const)('checks the actual source concentration at any later boundary (%s)',mode=>{
    const {queued,settle}=fixture()
    const current=structuredClone(queued)
    current.dnd5eDelayedSummons![0].request.concentrationId='spell:synthetic'
    current.dnd5eDelayedSummons![0].request.handoffs.summons[0].concentration=true
    current.tokens[0].dnd5eCombatState={concentrationSpellId:mode==='missing'?undefined:mode==='changed'?'spell:other':'spell:synthetic'}
    if(mode==='unconscious')current.tokens[0].hp=0
    const result=settle(current,{tokenId:'other'})
    expect(result.results).toEqual([])
    expect(result.map.dnd5eDelayedSummons?.[0].status).toBe(mode==='matching'?'pending':'cancelled')
    if(mode==='matching')expect(settle(result.map).results).toHaveLength(1)
  })
  it('atomically partitions mixed summons and preserves their original selections and grouped initiative',()=>{
    const {map,request,settle}=fixture()
    const delayed={...request.handoffs.summons[0],groupInitiative:true}
    const input={...request,map,round:1,characters:[],handoffs:{...request.handoffs,summons:[
      {...delayed,operationId:'first',monsterId:'srd-5.1:zombie',timing:'immediate' as const,groupInitiative:false},delayed,
      {...delayed,operationId:'last',monsterId:'srd-5.1:goblin',timing:'immediate' as const,groupInitiative:false}]},
      selection:{summonCells:[{col:3,row:1},{col:4,row:1},{col:5,row:1}],summonInitiativeD20s:[15,12,18]},
      delayedBoundary:{combatId:'combat',turnKey:'turn-1',turnSequence:10,receiptId:'mixed'}}
    const result=applyDnd5eActivityDeferredMapHandoffs(input)
    expect(result.ok,result.ok?'':result.reason).toBe(true)
    if(!result.ok)return
    expect(result.map.tokens.slice(1).map(token=>token.poolId)).toEqual(['srd-5.1:zombie','srd-5.1:goblin'])
    expect(result.initiativeEntries.map(entry=>entry.roll)).toEqual([13,20])
    expect(result.map.dnd5eDelayedSummons?.[0].request.selection.summonCells).toEqual([{col:4,row:1}])
    const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[result.map]}))).maps[0]
    const appeared=settle(restored)
    expect(appeared.map.tokens.slice(1).map(token=>token.poolId)).toEqual(['srd-5.1:zombie','srd-5.1:goblin','srd-5.1:wolf'])
    expect(appeared.results[0].initiativeEntries[0].roll).toBe(13)
    expect(appeared.map.tokens.at(-1)).toMatchObject({x:225,y:75})
    expect(new Set(appeared.map.tokens.map(token=>token.id)).size).toBe(4)
    expect(applyDnd5eActivityDeferredMapHandoffs({...input,map:restored})).toMatchObject({ok:false,reason:'delayed-summon-already-scheduled'})
    const invalid=applyDnd5eActivityDeferredMapHandoffs({...input,selection:{...input.selection,summonCells:[{col:3,row:1},{col:3,row:1},{col:5,row:1}]}})
    expect(invalid).toMatchObject({ok:false,reason:'invalid-summon-placement'})
    expect(map.tokens).toHaveLength(1)
    expect(map.dnd5eDelayedSummons).toBeUndefined()
  })
  it('preserves the authority queue when merging stale or forged player map writes',()=>{
    const {map,queued}=fixture()
    expect(mergePlayerTokenCombatFields([map],[queued])[0].dnd5eDelayedSummons).toEqual(queued.dnd5eDelayedSummons)
    expect(mergePlayerTokenCombatFields([queued],[map])[0].dnd5eDelayedSummons).toBeUndefined()
  })
  it('restores pending work and creates once at the matching later source boundary',()=>{
    const {map,request,queued,settle}=fixture()
    expect(map.tokens).toHaveLength(1)
    expect(map.dnd5eDelayedSummons).toBeUndefined()
    const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[queued]}))).maps[0]
    expect(restored.dnd5eDelayedSummons).toEqual(queued.dnd5eDelayedSummons)
    for(const patch of [{combatId:'other'},{tokenId:'other'},{turnKey:'turn-1',round:1},{turnKey:'old-slot',round:1,turnSequence:9},{round:0}]) {
      if(patch.round===0)expect(()=>settle(restored,patch)).toThrow('Invalid delayed summon boundary')
      else expect(settle(restored,patch).map).toBe(restored)
    }
    const appeared=settle(restored)
    expect(appeared.results).toHaveLength(1)
    expect(appeared.map.tokens).toHaveLength(2)
    expect(appeared.map.tokens[1].dnd5eSummon).toMatchObject({createdRound:2,expiresAfterRound:3})
    expect(appeared.results[0].initiativeEntries).toHaveLength(1)
    expect(appeared.map.dnd5eDelayedSummons?.[0]).toMatchObject({status:'completed',settledTurnKey:'turn-2'})
    const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[appeared.map]}))).maps[0]
    expect(settle(saved).results).toEqual([])
    expect(enqueueDnd5eDelayedSummon({map:saved,request,combatId:'combat',round:2,turnKey:'turn-2',turnSequence:11,receiptId:'receipt-1'})).toBe(saved)
  })
  it('allows a later source slot in the same round, without using round+1 as a shortcut',()=>{
    const {queued,settle}=fixture()
    expect(settle(queued,{round:1,turnKey:'later-source-slot'}).results).toHaveLength(1)
  })
  it('cancels unavailable sources and keeps blocked placements for explicit resolution without duplicate retries',()=>{
    const {queued,settle}=fixture()
    const cancelled=settle(queued,{sourceAvailable:()=>false})
    expect(cancelled.map.tokens).toHaveLength(1)
    expect(cancelled.map.dnd5eDelayedSummons?.[0].status).toBe('cancelled')
    const occupied={...queued,tokens:[...queued.tokens,{...queued.tokens[0],id:'occupant',x:225}]}
    const blocked=settle(occupied)
    expect(blocked.results).toEqual([])
    expect(blocked.map.tokens).toHaveLength(2)
    expect(blocked.map.dnd5eDelayedSummons?.[0]).toMatchObject({status:'blocked',reason:'invalid-summon-placement'})
    expect(settle({...blocked.map,tokens:queued.tokens},{turnKey:'turn-3',round:3}).results).toEqual([])
    expect(queued.dnd5eDelayedSummons?.[0].status).toBe('pending')
  })
  it('rejects conflicting receipts and malformed saved entries',()=>{
    const {queued,request}=fixture()
    expect(()=>enqueueDnd5eDelayedSummon({map:queued,request:{...request,actionId:'other'},combatId:'combat',round:1,turnKey:'turn-1',turnSequence:10,receiptId:'receipt-1'})).toThrow('Conflicting delayed summon receipt')
    expect(normalizeDnd5eDelayedSummons([null,{}, {...queued.dnd5eDelayedSummons![0],sourceTokenId:'forged'}])).toBeUndefined()
  })
})
