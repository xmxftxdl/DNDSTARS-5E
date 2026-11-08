import {getRoomSession} from '../../lib/roomSession'
import {durableD20RollId} from '../../lib/rollConfirmation'

export type BountifulOriginalRollIssuerMode='dm'|'player'
export function bountifulOriginalRollIssuerMode(source:unknown):BountifulOriginalRollIssuerMode{
 const value=source&&typeof source==='object'&&'hostOriginalRollIssuerMode'in source?source.hostOriginalRollIssuerMode:undefined
 if(value!=='dm'&&value!=='player')throw Error('bountiful-original:host-raw-issuer-mode-required')
 return value
}
/** Called by the actual Host raw-dice callback, using the same page mode and
 * current sequence that minted that DiceBox request. The original action's
 * author/sourceMode does not determine the request issuer namespace. */
export function captureBountifulOriginalRawIssuer(input:{mapId:string;parentId:string;mode:BountifulOriginalRollIssuerMode;rollId:string;cursor:number;raw:readonly number[]}){
 const session=getRoomSession()
 if(!session||session.role!=='dm')throw Error('bountiful-original:raw-host-required')
 if(!input.mapId||!input.parentId||!['dm','player'].includes(input.mode)||!Number.isSafeInteger(input.cursor)||input.cursor<1||input.raw.length<1||input.raw.length>2||input.raw.some(value=>!Number.isInteger(value)||value<1||value>20))throw Error('bountiful-original:invalid-raw-capture')
 const minted=durableD20RollId({mapId:input.mapId,sourceMode:input.mode,transactionId:input.parentId,occurrenceIndex:input.cursor-1})
 if(input.rollId!==minted&&input.rollId!==minted+':pool:'+input.raw.length+'d20')throw Error('bountiful-original:raw-capture-namespace-mismatch')
 return {hostOriginalRollIssuerMode:input.mode,hostOriginalRollId:input.rollId,hostOriginalDiceCursor:input.cursor}
}

/** Read only the raw metadata captured by the actual callback. A missing legacy
 * simulation capture is not a credential: the real server refuses its mint. */
export function bountifulNativeOriginalRawIssuer(source:unknown,request:{actorId:string;kind:string;originalRolls:readonly number[]}){
 const data=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
 if(!data(source)||!data(source.prepared)||!data(source.prepared.map)||!data(source.prepared.action))throw Error('bountiful-original:actual-native-source-required')
  // A nested actual save must obtain its own phase-qualified raw source; it
  // cannot borrow an attack, spell-target or earlier same-parent saving slot.
  if(request.kind==='saving-throw'&&Object.hasOwn(source,'hostDamageZeroSavingThrows'))throw Error('bountiful-original:damage-zero-raw-qualification-required')
 const sequence=source.hostOriginalOpportunityRolls
 if(request.kind==='attack'&&sequence!==undefined){
  if(!Array.isArray(sequence))throw Error('bountiful-original:actual-opportunity-book-required')
  const matches=sequence.filter(row=>data(row)&&row.actorId===request.actorId)
  if(matches.length!==1||!data(matches[0])||JSON.stringify(matches[0].values)!==JSON.stringify(request.originalRolls))throw Error('bountiful-original:actual-opportunity-raw-required')
  const row=matches[0]
  if(typeof source.prepared.map.id!=='string'||typeof source.prepared.action.id!=='string'||typeof row.hostOriginalRollId!=='string'||typeof row.hostOriginalDiceCursor!=='number')throw Error('bountiful-original:actual-opportunity-capture-required')
  const captured=captureBountifulOriginalRawIssuer({mapId:source.prepared.map.id,parentId:source.prepared.action.id,mode:bountifulOriginalRollIssuerMode(row),rollId:row.hostOriginalRollId,cursor:row.hostOriginalDiceCursor,raw:request.originalRolls})
  return{mode:captured.hostOriginalRollIssuerMode,rollId:captured.hostOriginalRollId,cursor:captured.hostOriginalDiceCursor}
 }
 const book=source.hostOriginalSpellSavingThrows
 let raw:Record<string,unknown>=source
 if(request.kind==='saving-throw'&&book!==undefined){
  if(!Array.isArray(book))throw Error('bountiful-original:actual-native-book-required')
  const matches=book.filter(row=>data(row)&&row.actorId===request.actorId)
  if(matches.length!==1||!data(matches[0])||JSON.stringify(matches[0].values)!==JSON.stringify(request.originalRolls))throw Error('bountiful-original:actual-target-raw-required')
  raw=matches[0]
 }
 if(raw.hostOriginalRollIssuerMode===undefined&&raw.hostOriginalRollId===undefined)return undefined
 if(typeof raw.hostOriginalRollId!=='string'||typeof raw.hostOriginalDiceCursor!=='number'||typeof source.prepared.map.id!=='string'||typeof source.prepared.action.id!=='string')throw Error('bountiful-original:actual-native-capture-required')
 const captured=captureBountifulOriginalRawIssuer({mapId:source.prepared.map.id,parentId:source.prepared.action.id,mode:bountifulOriginalRollIssuerMode(raw),rollId:raw.hostOriginalRollId,cursor:raw.hostOriginalDiceCursor,raw:request.originalRolls})
 return{mode:captured.hostOriginalRollIssuerMode,rollId:captured.hostOriginalRollId,cursor:captured.hostOriginalDiceCursor}
}
