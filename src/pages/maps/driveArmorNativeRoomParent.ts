import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {captureArmorNativeIssuedParent,persistArmorNativeIssuedParent} from './armorNativeRoomIssuer'
import {resumeArmorNativeRoomParent} from './armorNativeRoomSettlement'
import {collectArmorNativeRoomChoice,collectArmorNativeRoomDie} from './armorNativeRoomUI'
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'mutateCombatInterrupt'>
type BasePorts=Parameters<typeof resumeArmorNativeRoomParent>[1]
type UI=Parameters<typeof collectArmorNativeRoomChoice>[2]&Parameters<typeof collectArmorNativeRoomDie>[2]
/** Ordinary native parent driver. Issuance always rebuilds the genuine prepared
 * hit checkpoint; recovery uses the private server journal. SC-origin attacks
 * and later death/geometry tails keep their separate explicit joint boundary. */
export async function driveArmorNativeRoomParent(input:{id:string}|Parameters<typeof captureArmorNativeIssuedParent>[0],gateway:Gateway,ui:UI,ports:BasePorts){
 let id:string
 if('id'in input)id=input.id
 else{id=(await persistArmorNativeIssuedParent(await captureArmorNativeIssuedParent(input,gateway),gateway)).id as string}
 const journal=await gateway.loadResource<{parents:Record<string,{phase:string}>}>('armor-native-parents')
 if(journal?.parents[id]?.phase==='consumed')return{...await resumeArmorNativeRoomParent(id,ports,gateway),parentId:id}
 const choice=await collectArmorNativeRoomChoice(id,gateway,ui)
 if(choice==='pending')return{status:'pending-owner-choice' as const,parentId:id}
 if(choice==='use'){try{await collectArmorNativeRoomDie(id,gateway,ui)}catch(error){if(error instanceof Error&&error.message==='combat-dice-cancelled')return{status:'pending-d6' as const,parentId:id};throw error}}
 return{...await resumeArmorNativeRoomParent(id,ports,gateway),parentId:id}
}
