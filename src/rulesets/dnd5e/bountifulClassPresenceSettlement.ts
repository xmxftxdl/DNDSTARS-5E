import {resolvePreparedDnd5eClassFeature} from './classFeatureAction'
import {recordBountifulOriginalAfterDice,resolveBountifulOriginalForNormalAck} from './bountifulLuckNormalAck'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {Dnd5eDamageReactionFlowOptions} from './damageReactionFlow'

/** Concrete Presence continuation only. The normal native facade still
 * validates every saving throw bonus and spends its actual resource once. */
export async function resolveBountifulClassPresenceForNormalAck(input:{action:SharedPlayerActionState;source:Parameters<typeof resolvePreparedDnd5eClassFeature>[0];options:Dnd5eDamageReactionFlowOptions;rollCursor:number},gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>){
 if(!input.source.prepared.intimidatingPresence||input.source.prepared.intimidatingPresence.extending)throw Error('bountiful-class-settlement:presence-source-required')
 await recordBountifulOriginalAfterDice({...input,resolve:resolvePreparedDnd5eClassFeature,authorityUnchanged:input.options.authorityUnchanged},gateway)
 return resolveBountifulOriginalForNormalAck({...input,resolve:resolvePreparedDnd5eClassFeature},gateway)
}
