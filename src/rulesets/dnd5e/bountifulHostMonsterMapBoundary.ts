import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {resolvePreparedDnd5eMonsterAttack} from './monsterAttackAction'
import {recordBountifulHostMonsterAfterDice} from './bountifulHostMonsterAfterDice'
import {readBountifulNativePreparedReplay} from './bountifulNativePreparedRecovery'
import {resolveBountifulHostMonsterForMap,type BountifulNativeMapPublication} from './bountifulHostMonsterMapPublication'
import {resolveDnd5ePreparedWithMaterialDamageReactions} from './damageReactionFlow'

type Source=Parameters<typeof resolvePreparedDnd5eMonsterAttack>[0]
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>
/** The same concrete source is attached to the existing Maps SC probe and its
 * material damage driver. A caller never supplies replacement prepared state. */
export function createBountifulHostMonsterMapBoundary(input:{parentId:string;gateway:Gateway;authorityUnchanged:()=>boolean;damageOptions:Parameters<typeof resolveDnd5ePreparedWithMaterialDamageReactions>[0];onResolved:(publication:BountifulNativeMapPublication)=>void}){
 const attachReplay=async(source:Source)=>{
  if(!input.authorityUnchanged())throw Error('bountiful-native-map:stale-caller')
  await recordBountifulHostMonsterAfterDice(input.parentId,source,input.gateway)
  return readBountifulNativePreparedReplay(input.parentId,input.gateway)
 }
 return {
  attachReplay,
  async resolve(source:Source){
   await attachReplay(source)
   const resolved=await resolveBountifulHostMonsterForMap(input.parentId,{authorityUnchanged:input.authorityUnchanged,resolveActual:(resolver,protectedSource)=>resolveDnd5ePreparedWithMaterialDamageReactions(input.damageOptions,protectedSource,resolver)},input.gateway)
   input.onResolved(resolved.publication)
   return resolved.resolved
  },
 }
}
