import{buildSelectedEnemyAttack,type EnemyTurnResult}from'../../lib/enemyAi'
import{loadSharedResource}from'../../composition/browserSharedRoomResources'
import{getRoomSession}from'../../lib/roomSession'
import{restoreMastermindNativeMonsterWardDecision}from'./mastermindMisdirectionNativeParent'
type Gateway=Parameters<typeof restoreMastermindNativeMonsterWardDecision>[1]
const commands=new WeakMap<object,{parentId:string;signature:string}>(),signature=(value:unknown)=>JSON.stringify(value)
/** The command is built by the existing monster producer only after protected
 * source recovery; its private binding is not serializable authority. */
export async function prepareMastermindNativeWardResume(parentId:string,g?:Gateway){
 const decision=await restoreMastermindNativeMonsterWardDecision(parentId,g);if(!decision)throw Error('native-ward-resume:current-parent-required');
 const prepared=decision.prepared,index=prepared.monster.actions.findIndex(action=>action.id===prepared.action.id),command=buildSelectedEnemyAttack(prepared.actorToken,prepared.targetToken,index,[prepared.targetToken.id],'action');
 if(!command||index<0||command.readiedAttack||command.multiattackStep)throw Error('native-ward-resume:actual-single-command-required');commands.set(command,{parentId,signature:signature(command)});return command
}
export async function readMastermindNativeWardResume(command:EnemyTurnResult,g?:Gateway){
 const binding=commands.get(command);if(!binding)return undefined;if(signature(command)!==binding.signature)throw Error('native-ward-resume:unchanged-command-required');
 const decision=await restoreMastermindNativeMonsterWardDecision(binding.parentId,g);if(!decision)throw Error('native-ward-resume:current-parent-required');return decision
}
/** Called once when the Host mounts a map, not on every newly issued raw row.
 * Thus an in-flight original cannot accidentally spawn a second handler. */
export async function listMastermindNativeWardResumeParents(mapId:string){
 const session=getRoomSession();if(session?.role!=='dm')return[];
 const[book,journal]=await Promise.all([loadSharedResource<{requests:Record<string,{parentId:string;mapId:string}>}>('mastermind-native-ward-originals'),loadSharedResource<{parents:Record<string,{phase:string;mapId:string;nativeOriginal?:{family:string}}>}>('mastermind-misdirections')]);
 if(getRoomSession()?.roomId!==session.roomId||getRoomSession()?.memberId!==session.memberId||getRoomSession()?.role!=='dm')throw Error('native-ward-resume:current-host-required');
 return [...new Set(Object.values(book?.requests??{}).filter(row=>row.mapId===mapId&&journal?.parents[row.parentId]?.mapId===mapId&&journal.parents[row.parentId].phase==='answered'&&journal.parents[row.parentId].nativeOriginal?.family==='monster-attack').map(row=>row.parentId))]
}
