const browser=vi.hoisted(()=>({session:{roomId:'room',memberId:'dm',role:'dm'}}))
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>browser.session}))
import{it,expect,vi}from'vitest'
import{createCombatInterrupt}from'../../lib/combatInterruptQueue'
import{buildActivityCumulativeScene}from'./testFixtures/bountifulActivityCumulative.scene.fixture'
import{genuineWardMixedTwoDieRoom}from'../../pages/maps/mastermindWardMixedTwoDieRoom.fixture'
import{prepareMastermindSpellWindowWardOriginal,issueMastermindSpellWindowWardPool,prepareMastermindSpellWindowRaw,readMastermindProtectedSpellWardAdoptedInput}from'../../pages/maps/mastermindSpellWindowParent'
import{collectMastermindAuthenticatedSpellWardOwn,readMastermindAuthenticatedSpellWardOwn}from'../../pages/maps/mastermindSpellWardSavingAuthenticated'
import{listMastermindSpellWardPendingChoices,answerMastermindSpellWardPendingChoice}from'../../pages/maps/mastermindSpellWardChoiceClient'
import{submitMastermindSpellWindowOwnedRaw,confirmMastermindSpellWindowPool,readMastermindSpellWindowDiceRequest}from'../../pages/maps/mastermindSpellWindowDiceTransport'
import type{MastermindSpellWardOwnPageServices}from'../../pages/maps/mastermindSpellWardOwnPageCollector'
import{readCapturedDnd5ePreparedSpellAttackWindow}from'../../application/combat/dnd5eSpellWardOwn'

it('actual B0 DECLINE then B1 authenticated USE20 and Own2 USE18 qualify one same-Saving Native replay without World publication',async()=>{
 const joint=await buildActivityCumulativeScene()
 try{
  const f=await genuineWardMixedTwoDieRoom(false,joint.proof.characters.find(c=>c.id==='helper')!),names=['characters','maps','combat','player-action-requests'],world=await Promise.all(names.map(f.api.read))
  type ChoiceApi=NonNullable<Parameters<typeof listMastermindSpellWardPendingChoices>[0]>
  const api=(member:'dm'|'reader'|'player'):ChoiceApi=>async<T>(operation:Parameters<ChoiceApi>[0],input:unknown)=>{const response=operation==='request'?await f.api.post('mastermind-spell-window/request?requestId='+encodeURIComponent((input as{requestId:string}).requestId),{},member,'GET'):await f.api.post('mastermind-spell-window/'+operation,input,member);if(response.status!==200)throw Error(JSON.stringify(response.payload));return response.payload as T}
  expect((await f.api.post('mastermind-misdirection/answer',{id:f.row.id,expectedRecordRevision:1,choice:'second-owner-token'},'player')).status).toBe(200)
  const ward=await prepareMastermindSpellWindowWardOriginal(f.parentId,0,f.g);if(!ward)throw Error('Actual Ward required')
  const pool=await issueMastermindSpellWindowWardPool(ward),scope={parentId:f.parentId,windowIndex:0,requestId:pool.requestId}
  expect(pool).toMatchObject({count:2,mode:'disadvantage'})
  expect((await f.api.post('mastermind-spell-window/raw',{...scope,rollerTokenId:'mage-token',values:[7,8]},'reader')).status).toBe(200)
  expect((await f.api.post('mastermind-spell-window/confirm',{...scope,rollerTokenId:'mage-token',values:[1,1]},'dm')).status).toBe(200)
  expect((await f.api.post('mastermind-spell-window/ward-complete',scope,'dm')).status).toBe(200)
  const visitedB:number[]=[],visitedOwn:number[]=[],physicalIds:string[]=[];let ownInputWaits=0
  const services:MastermindSpellWardOwnPageServices={
   wait:async()=>{
    const choices=(await listMastermindSpellWardPendingChoices(api('player'))).filter(row=>row.kind==='bountiful')
    if(!choices.length){
     // A genuine Own USE answer waits once before its independent physical pool.
     const locked=await readMastermindProtectedSpellWardAdoptedInput(ward),own=locked.row.own as{entries:{occurrence:number;request:unknown;decision?:unknown;confirmed?:unknown}[]}|undefined
     expect(visitedB).toEqual([0,1]);expect(visitedOwn).toEqual([2]);expect(own?.entries).toMatchObject([{occurrence:2,request:{nativeLucky:true,originalRolls:[1,1],dieIndex:0},decision:{decision:'use',memberId:'reader'}}]);expect(own?.entries[0].confirmed).toBeUndefined();ownInputWaits++;expect(ownInputWaits).toBe(1);return
    }
    expect(choices).toHaveLength(1)
    const row=choices[0];if(row.kind!=='bountiful')throw Error('Actual helper choice required')
    const occurrence=row.occurrence??0;expect(occurrence).toBe(visitedB.length);visitedB.push(occurrence)
    const decision=occurrence===0?'decline':'use';expect(occurrence).toBeLessThan(2)
    await expect(answerMastermindSpellWardPendingChoice(row,decision,api('dm'))).rejects.toThrow('actual-helper-controller-required')
    await expect(answerMastermindSpellWardPendingChoice(row,decision,api('reader'))).rejects.toThrow('actual-helper-controller-required')
    await answerMastermindSpellWardPendingChoice(row,decision,api('player'))
    console.info(JSON.stringify({authenticatedHelperChoice:{id:row.id,occurrence,decision}}))
   },
   choice:async request=>{
    const binding=request.context.wardOwnBinding;expect(binding.occurrence).toBe(2);visitedOwn.push(binding.occurrence)
    const locked=await readMastermindProtectedSpellWardAdoptedInput(ward),row=locked.row as typeof locked.row&{bountifulContinuations?:{occurrence:number;book:{request:unknown;raw?:unknown;confirmed?:unknown;complete?:true}}[]}
    expect(row.confirmed!.values).toEqual([1,1]);expect(row.bountiful).toMatchObject({complete:true,request:{originalRolls:[1,1],dieIndex:0},decisions:[{decision:'decline',memberId:'player'}]})
    expect(row.bountifulContinuations).toMatchObject([{occurrence:1,book:{complete:true,request:{originalRolls:[1,1],dieIndex:1},raw:{values:[4],memberId:'reader'},confirmed:{values:[20],rawValues:[4],memberId:'dm'}}}])
    const interrupt=createCombatInterrupt({id:request.id,transactionId:request.transactionId,mapId:request.mapId,actorCharId:request.actorCharId,kind:'plugin-choice',phase:request.phase,payload:{pluginId:request.pluginId,featureId:request.featureId,featureName:request.featureName,prompt:request.prompt,audience:request.audience,options:request.options,defaultOptionId:request.defaultOptionId,...request.context},expiresAt:Date.now()+30000})
    expect((await f.api.post('combat-interrupts/interrupt',{operation:'upsert',mapId:request.mapId,interrupt},'dm','PATCH')).status).toBe(200)
    for(const member of ['dm','player']as const)expect((await f.api.post('combat-interrupts/interrupt',{operation:'answer',mapId:request.mapId,id:request.id,response:{optionId:'use'}},member,'PATCH')).status).toBe(403)
    expect((await f.api.post('combat-interrupts/interrupt',{operation:'answer',mapId:request.mapId,id:request.id,response:{optionId:'use'}},'reader','PATCH')).status).toBe(200)
    return'decline'
   },
   physical:async request=>{
    physicalIds.push(request.id);const b=request.id.startsWith('mm-spell-ward-bountiful-pool:'),raw=b?4:3,adopted=b?20:18
    if(b)expect(request.bountifulOccurrence).toBe(1)
    expect(request).toMatchObject({rollerTokenId:'mage-token',rollerCharacterId:f.prepared.actor.id,kind:'saving',count:1,sides:20})
    browser.session={roomId:'room',memberId:'dm',role:'dm'}
    await expect(confirmMastermindSpellWindowPool({requestId:request.id,rollerTokenId:'mage-token',sides:20,values:[adopted]},api('dm'))).rejects.toThrow()
    browser.session={roomId:'room',memberId:'reader',role:'player'}
    await submitMastermindSpellWindowOwnedRaw({requestId:request.id,mapId:f.map.id,characterId:f.prepared.actor.id,rollerTokenId:'mage-token',sides:20,values:[raw]},api('reader'))
    browser.session={roomId:'room',memberId:'dm',role:'dm'}
    await confirmMastermindSpellWindowPool({requestId:request.id,rollerTokenId:'mage-token',sides:20,values:[adopted]},api('dm'))
    expect(await readMastermindSpellWindowDiceRequest(request.id,api('dm'))).toMatchObject({raw:[raw],confirmed:[adopted]})
   }
  }
  const cap=await collectMastermindAuthenticatedSpellWardOwn(ward,services)
  expect(await readMastermindAuthenticatedSpellWardOwn(cap)).toEqual({parentId:f.parentId,windowIndex:0,step:0,requestId:pool.requestId})
  await expect(readMastermindAuthenticatedSpellWardOwn(structuredClone(cap))).rejects.toThrow('actual-authenticated-own-replay-required')
  expect(visitedB).toEqual([0,1]);expect(visitedOwn).toEqual([2]);expect(physicalIds).toHaveLength(2);expect(ownInputWaits).toBe(1)
  const raw=await prepareMastermindSpellWindowRaw(f.parentId,0,f.g),view=readCapturedDnd5ePreparedSpellAttackWindow(raw.window)
  expect(raw.raw.targetId).toBe('second-owner-token');expect(view.events.filter(e=>e.type==='saving-throw-resolved')).toHaveLength(1)
  expect(view.events.filter(e=>e.type==='saving-throw-resolved')).toMatchObject([{ability:'cha',d20:18,modifier:2,total:20,success:true}])
  expect(view.state.combatants['spell-helper-token'].turn.reactionAvailable).toBe(false)
  // A captured view is a readonly state clone, never a Native WeakMap witness.
  expect(await readMastermindAuthenticatedSpellWardOwn(cap)).toEqual({parentId:f.parentId,windowIndex:0,step:0,requestId:pool.requestId})
  expect(await Promise.all(names.map(f.api.read))).toEqual(world);expect(f.api.gateway.saveResourcesAtomically).not.toHaveBeenCalled()
 }finally{browser.session={roomId:'room',memberId:'dm',role:'dm'};joint.dispose()}
},180000)
