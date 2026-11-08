import {getRoomSession} from '../../lib/roomSession'
import {readDnd5eActualMissingSpellcastingOriginalBoundary,readDnd5eStormCastOriginalOperation} from './damageCommitSession'
import {resolvePreparedDnd5eSpellCast} from './spellAction'
import {dnd5eSpellcastingSaveRequirements} from './headlessCombatEngine'
import {getDnd5eSrdSpellCatalogEntry} from './spellCatalog'
import {dnd5ePluginSpellDefinition} from './pluginApi'
import {createDnd5eParentEffectClock} from './activeEffects'
import type {MissingSpellcastingOriginal} from './missingSpellcastingOriginal'
export interface Dnd5eSpellcastingOriginalOperation{readonly kind:'spellcasting-original-operation'}
type Boundary=ReturnType<typeof readDnd5eActualMissingSpellcastingOriginalBoundary>
type Row={result:MissingSpellcastingOriginal;roomId:string;memberId:string;definition:string;boundary:Boundary}
const issued=new WeakMap<object,Row>()
function host(){const s=getRoomSession();if(s?.role!=='dm'||!s.roomId||!s.memberId)throw Error('spellcasting-original:actual-host-required');return s}
function facts(result:MissingSpellcastingOriginal,boundary:Boundary){
 if(boundary.resolve!==resolvePreparedDnd5eSpellCast)throw Error('spellcasting-original:actual-core-spell-resolver-required')
 const source=boundary.input as Parameters<typeof resolvePreparedDnd5eSpellCast>[0],p=source.prepared,r=result.requirement
 if(!p?.action?.id||p.action.type!=='dnd5e-spell-cast'||p.action.dnd5eSpellCast?.spellId!==p.spell.id||r.actorId!==p.actorToken.id||p.action.actorTokenId!==r.actorId||!Number.isSafeInteger(boundary.effectTimestamp)||boundary.effectTimestamp<=0)throw Error('spellcasting-original:actual-caster-parent-required')
 const spell=getDnd5eSrdSpellCatalogEntry(p.spell.id)??dnd5ePluginSpellDefinition(p.spell.id)
 if(!spell)throw Error('spellcasting-original:current-spell-required')
 const clock=createDnd5eParentEffectClock({parentId:p.action.id,sourceKey:p.action.id,timestamp:boundary.effectTimestamp}),current=clock.run(()=>dnd5eSpellcastingSaveRequirements(result.snapshot,r.actorId).find(row=>row.effect.id===r.effectId))
 if(!current||current.ability!==r.ability||current.dc!==r.dc||current.mode!==r.rollMode||r.requiredDiceCount!==(current.mode==='normal'?1:2))throw Error('spellcasting-original:actual-current-effect-required')
 if(boundary.stormOperation){const storm=readDnd5eStormCastOriginalOperation(boundary.stormOperation);if(storm.effectTimestamp!==boundary.effectTimestamp||storm.frame.parentId!==p.action.id||storm.frame.actorId!==r.actorId||storm.records.length!==1)throw Error('spellcasting-original:actual-earlier-storm-prefix-required')}
 return{source,definition:JSON.stringify(spell),effect:structuredClone(current.effect)}
}
/** Captures only a real next-original Session missing result. The operation is
 * mechanical lineage, not owner consent, physical raw or publication authority. */
export function captureDnd5eSpellcastingOriginalOperation(result:MissingSpellcastingOriginal):Dnd5eSpellcastingOriginalOperation{
 const session=host(),boundary=readDnd5eActualMissingSpellcastingOriginalBoundary(result),actual=facts(result,boundary),operation:Dnd5eSpellcastingOriginalOperation=Object.freeze({kind:'spellcasting-original-operation'})
 issued.set(operation,{result,roomId:session.roomId,memberId:session.memberId,definition:actual.definition,boundary});return operation
}
export function readDnd5eSpellcastingOriginalOperation(operation:object){
 const session=host(),row=issued.get(operation)
 if(!row||row.roomId!==session.roomId||row.memberId!==session.memberId)throw Error('spellcasting-original:actual-current-operation-required')
 const boundary=readDnd5eActualMissingSpellcastingOriginalBoundary(row.result),actual=facts(row.result,boundary)
 if(actual.definition!==row.definition||boundary.effectTimestamp!==row.boundary.effectTimestamp||boundary.resolve!==row.boundary.resolve)throw Error('spellcasting-original:current-native-source-required')
 return{source:actual.source,resolve:boundary.resolve,effectTimestamp:boundary.effectTimestamp,requirement:structuredClone(row.result.requirement),snapshot:structuredClone(row.result.snapshot),effect:actual.effect,...(boundary.stormOperation?{stormOperation:boundary.stormOperation}:{})}
}
