import {expect,it} from'vitest'
import {nativeHoundFixture} from'./shadowMagic.hound.native.fixture'
import {houndFeatureId,namespace} from'./shadowMagic.houndSource.native.fixture'
import {prepareDnd5ePluginFeatureAction,resolvePreparedDnd5ePluginFeatureAction} from'./pluginFeatureAction'
import {getRegisteredDnd5eActivity} from'./activities/dnd5eActivityRegistry'
import {applyDnd5eActivityMapHandoffsV1} from'./activities/dnd5eActivityMapInteraction'
import {prepareDnd5eMonsterAttack,resolvePreparedDnd5eMonsterAttack} from'./monsterAttackAction'

for(const selected of['self','ally']as const)it('actual Hound can choose '+selected+' creature and attacks only that chosen body despite faction',async()=>{
 const f=await nativeHoundFixture();try{
  const map={...f.map(),tokens:f.map().tokens.map((token:any)=>({...token,type:'player' as const,dnd5eSide:'player' as const}))},targetId=selected==='self'?'soul-token':'foe-token',order=map.tokens.slice().reverse().map((token:any,i:number)=>({tokenId:token.id,label:token.label,roll:20-i,color:'',emoji:''}))
  const action:any={id:'actual-hound-'+selected,mapId:map.id,combatId:'hound-target-'+selected,sourceMode:'player',status:'pending',type:'dnd5e-plugin-action',actorTokenId:'soul-token',characterId:'soul',targetTokenId:targetId,round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5ePluginAction:{featureId:houndFeatureId,payload:{selectedActivityId:'hound-of-ill-omen'}}}
  const p=prepareDnd5ePluginFeatureAction({map,characters:f.characters(),action,initiativeOrder:order});expect(p.ok,JSON.stringify(p)).toBe(true);if(!p.ok)throw Error(p.reason)
  const used=await resolvePreparedDnd5ePluginFeatureAction({prepared:p.prepared,combatRevision:1,rolls:{}});expect(used.result.ok,JSON.stringify(used.result)).toBe(true);if(!used.result.ok||!used.application)throw Error('Real chosen original source required')
  const activity=getRegisteredDnd5eActivity(namespace,'hound-of-ill-omen');if(!activity)throw Error('Actual registered Hound Activity required')
  const target=map.tokens.find((token:any)=>token.id===targetId),col=selected==='self'?2:0,row=selected==='self'?0:1
  const made=applyDnd5eActivityMapHandoffsV1({map:used.application.map,characters:used.application.characters,activity,packageId:namespace,actionId:action.id,actorId:'soul-token',round:1,handoffs:used.result.activityHandoffs!,selection:{summonCells:[{col,row}],summonInitiativeD20s:[7]}});expect(made.ok,JSON.stringify(made)).toBe(true);if(!made.ok)throw Error(made.reason)
  const hound=made.map.tokens.find(token=>token.dnd5eSummon?.illOmenTarget);if(!hound)throw Error('Actual Hound body required')
  expect(hound.dnd5eSummon!.illOmenTarget).toEqual({targetTokenId:targetId,targetCharacterId:target.characterId})
  const native=prepareDnd5eMonsterAttack({combatId:'hound-native-'+selected,round:1,map:made.map,characters:used.application.characters,initiativeOrder:[...made.initiativeEntries,...order],actorTokenId:hound.id,targetTokenId:targetId});expect(native.ok,JSON.stringify(native)).toBe(true);if(!native.ok)throw Error(native.reason)
  const r=resolvePreparedDnd5eMonsterAttack({prepared:native.prepared,rolls:[{d20:18,...(native.prepared.targetAttackMode!=='normal'?{d20Second:18}:{}),damageRolls:[[1,1]]}]});expect(r.result.ok,JSON.stringify(r.result)).toBe(true)
  expect(r.result.events.some(event=>event.type==='attack-resolved'&&event.actorId===hound.id&&event.targetId===targetId)).toBe(true)
  const other=selected==='self'?'foe-token':'soul-token';expect(prepareDnd5eMonsterAttack({combatId:'hound-native-wrong-'+selected,round:1,map:made.map,characters:used.application.characters,initiativeOrder:[...made.initiativeEntries,...order],actorTokenId:hound.id,targetTokenId:other}).ok).toBe(false)
 }finally{f.dispose()}
})
