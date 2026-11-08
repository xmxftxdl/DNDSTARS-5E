import {nativeHoundFixture} from './shadowMagic.hound.native.fixture'
import {houndFeatureId,namespace} from './shadowMagic.houndSource.native.fixture'
import {prepareDnd5ePluginFeatureAction,resolvePreparedDnd5ePluginFeatureAction} from './pluginFeatureAction'
import {getRegisteredDnd5eActivity} from './activities/dnd5eActivityRegistry'
import {applyDnd5eActivityMapHandoffsV1} from './activities/dnd5eActivityMapInteraction'
import {createDnd5eMapCombatSnapshot} from './mapBridge'

/** Actual native advancement, source Activity, real map handoff, and new combat snapshot. */
export async function nativeSummonedHound(targetX=75,originalActionId="real-hound-original"){
 const f=await nativeHoundFixture()
 try{
  const map={...f.map(),tokens:f.map().tokens.map((token:any)=>({...token,x:token.id==='soul-token'?25:targetX,y:25}))}
  const order=[...map.tokens].reverse().map((token:any,i:number)=>({tokenId:token.id,label:token.label,roll:20-i,color:'',emoji:''}))
  const action:any={id:originalActionId,mapId:map.id,combatId:'hound-create',sourceMode:'player',status:'pending',type:'dnd5e-plugin-action',actorTokenId:'soul-token',characterId:'soul',targetTokenId:'foe-token',round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5ePluginAction:{featureId:houndFeatureId,payload:{selectedActivityId:'hound-of-ill-omen'}}}
  const p=prepareDnd5ePluginFeatureAction({map,characters:f.characters(),action,initiativeOrder:order});if(!p.ok)throw Error(p.reason)
  const used=await resolvePreparedDnd5ePluginFeatureAction({prepared:p.prepared,combatRevision:1,rolls:{}})
  if(!used.result.ok||!used.application)throw Error('Native Hound Activity required')
  const activity=getRegisteredDnd5eActivity(namespace,'hound-of-ill-omen');if(!activity)throw Error('Registered Hound Activity required')
  const made=applyDnd5eActivityMapHandoffsV1({map:used.application.map,characters:used.application.characters,activity,packageId:namespace,actionId:action.id,actorId:'soul-token',round:1,handoffs:used.result.activityHandoffs!,selection:{summonCells:[{col:2,row:0}],summonInitiativeD20s:[7]}})
  if(!made.ok)throw Error(made.reason)
  const hound=made.map.tokens.find(token=>token.dnd5eSummon?.illOmenTarget);if(!hound)throw Error('Actual materialized Hound required')
  const snapshot=createDnd5eMapCombatSnapshot({map:made.map,characters:used.application.characters,combatId:'hound-real-turn',round:1,initiativeOrder:[...made.initiativeEntries,...order]})
  return{...f,map:made.map,characters:used.application.characters,houndId:hound.id,snapshot}
 }catch(e){f.dispose();throw e}
}
