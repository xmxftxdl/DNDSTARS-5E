import{getRoomSession}from'../../lib/roomSession'
import{requestSharedStormFurySaving}from'../../lib/sharedApi'
import{captureStormFurySavingOriginalPreparation,readStormFurySavingOriginalReply}from'./stormFurySavingOriginalPreparation'
import type{Dnd5eStormFuryOriginalOperation}from'./damageCommitSession'
type Rpc=(operation:'prepare'|'inspect'|'dice'|'read',payload:unknown)=>Promise<Record<string,unknown>>
type Native=ReturnType<typeof captureStormFurySavingOriginalPreparation>
type Component={key:'original'|'bless'|'bane';count:number;sides:number;requestId:string}
type Identity={parentId:string;mapId:string;combatId:string;frameIndex:number}
declare const routeBrand:unique symbol
export interface StormFurySavingDiceRoute{readonly[routeBrand]:true}
type Row={operation:Dnd5eStormFuryOriginalOperation;native:Native;identity:Identity;component:Component;roomId:string;hostMemberId:string;rpc:Rpc}
const routes=new WeakMap<object,Row>(),active=new Map<string,WeakRef<StormFurySavingDiceRoute>>(),equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
function host(){const s=getRoomSession();if(s?.role!=='dm'||!s.roomId||!s.memberId)throw Error('storm-fury-dice:actual-host-required');return s}
function guard(row:Row){const s=host();if(s.roomId!==row.roomId||s.memberId!==row.hostMemberId||!equal(captureStormFurySavingOriginalPreparation(row.operation),row.native))throw Error('storm-fury-dice:actual-current-frontier-required')}
const faces=(v:unknown,c:Component):v is number[]=>Array.isArray(v)&&v.length===c.count&&v.every(n=>Number.isInteger(n)&&n>=1&&n<=c.sides)
async function inspect(row:Row){guard(row);const value=await row.rpc('inspect',{...row.identity,requestId:row.component.requestId});guard(row)
 if(value.ok!==true||value.sourceKind!=='storm-fury-saving-v1'||value.parentId!==row.identity.parentId||value.mapId!==row.identity.mapId||value.combatId!==row.identity.combatId||value.frameIndex!==row.identity.frameIndex||!equal(value.source,row.native.source)||!equal(value.request,row.native.request)||value.prefixSignature!==row.native.prefixSignature||value.effectTimestamp!==row.native.effectTimestamp||value.mode!==row.native.mode||value.blessed!==row.native.blessed||value.baned!==row.native.baned||!equal(value.component,row.component)||value.hostMemberId!==row.hostMemberId||typeof value.memberId!=='string'||!value.memberId||value.role!==(value.memberId===row.hostMemberId?'dm':'player')||value.rollerTokenId!==row.native.request.frame.event.actorId||value.rollerCharacterId!==null&&typeof value.rollerCharacterId!=='string'||value.physical!==undefined&&!faces(value.physical,row.component)||value.adopted!==undefined&&!faces(value.adopted,row.component))throw Error('storm-fury-dice:exact-private-component-required')
 return{roomId:row.roomId,...row.identity,requestId:row.component.requestId,count:row.component.count,sides:row.component.sides,key:row.component.key,rollKind:'saving-throw' as const,rollerTokenId:value.rollerTokenId as string,characterId:value.rollerCharacterId as string|null,memberId:value.memberId,hostMemberId:row.hostMemberId,rawValues:value.physical as number[]|undefined,values:value.adopted as number[]|undefined}
}
/** Only a genuine still-live mandatory saving operation can issue an opaque
 * DiceBox route. JSON, source data and a copied route cannot register a slot. */
export async function createStormFurySavingDiceRoutes(operation:Dnd5eStormFuryOriginalOperation,rpc:Rpc=requestSharedStormFurySaving){
 const s=host(),native=captureStormFurySavingOriginalPreparation(operation),identity={parentId:native.parentId,mapId:native.mapId,combatId:native.combatId,frameIndex:native.frameIndex},prepared=await rpc('prepare',native)
 const components:Component[]=[{key:'original' as const,count:native.mode==='normal'?1:2,sides:20,requestId:''},...(native.blessed?[{key:'bless' as const,count:1,sides:4,requestId:''}]:[]),...(native.baned?[{key:'bane' as const,count:1,sides:4,requestId:''}]:[])].map(c=>({...c,requestId:'storm-fury-saving:'+JSON.stringify([native.parentId,native.frameIndex,native.request.featureId,c.key])}))
 if(prepared.ok!==true||!equal(prepared.components,components)||!equal(captureStormFurySavingOriginalPreparation(operation),native))throw Error('storm-fury-dice:exact-prepared-components-required')
 const issued:StormFurySavingDiceRoute[]=[]
 for(const component of components){const route=Object.freeze({})as StormFurySavingDiceRoute,row:Row={operation,native,identity,component,roomId:s.roomId,hostMemberId:s.memberId,rpc};await inspect(row);routes.set(route,row);active.set(component.requestId,new WeakRef(route));issued.push(route)}
 return{routes:issued,read:async()=>{const row=routes.get(issued[0])!;guard(row);const reply=await rpc('read',identity);guard(row);return readStormFurySavingOriginalReply(operation,reply)}}
}
export async function readStormFurySavingDiceRoute(route:StormFurySavingDiceRoute){const row=routes.get(route);if(!row)throw Error('storm-fury-dice:actual-issued-route-required');return inspect(row)}
export async function readStormFurySavingPlayerDiceOwner(route:StormFurySavingDiceRoute|undefined,requestId:string,rollerTokenId:string|undefined,count:number,sides:number){
 if(route===undefined){if(requestId.startsWith('storm-fury-saving:'))throw Error('storm-fury-dice:actual-issued-route-required');return undefined}
 const spec=await readStormFurySavingDiceRoute(route);if(spec.requestId!==requestId||spec.rollerTokenId!==rollerTokenId||spec.count!==count||spec.sides!==sides)throw Error('storm-fury-dice:exact-issued-owner-required')
 return{characterId:spec.characterId??undefined,memberId:spec.memberId,hostMemberId:spec.hostMemberId,rawValues:spec.rawValues,values:spec.values}
}
async function lookup(input:{requestId:string;rollerTokenId?:string;sides:number}){const route=active.get(input.requestId)?.deref();if(!route){active.delete(input.requestId);throw Error('storm-fury-dice:actual-live-request-required')}const row=routes.get(route)!,spec=await inspect(row);if(spec.rollerTokenId!==input.rollerTokenId||spec.sides!==input.sides)throw Error('storm-fury-dice:exact-issued-presentation-required');return{row,spec}}
export async function hasIssuedStormFurySavingRequest(input:{requestId:string;rollerTokenId?:string}){const route=active.get(input.requestId)?.deref();if(!route){active.delete(input.requestId);return false}const spec=await readStormFurySavingDiceRoute(route);if(spec.requestId!==input.requestId||spec.rollerTokenId!==input.rollerTokenId)throw Error('storm-fury-dice:exact-issued-presentation-required');return true}
export async function recordStormFurySavingHostRaw(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]}){
 const{row,spec}=await lookup(input);if(!faces(input.values,row.component))throw Error('storm-fury-dice:exact-physical-faces-required')
 if(spec.memberId===spec.hostMemberId){const started=await row.rpc('dice',{...row.identity,requestId:spec.requestId,phase:'start'});guard(row);if(started.ok!==true)throw Error('storm-fury-dice:actual-start-required');const recorded=await row.rpc('dice',{...row.identity,requestId:spec.requestId,phase:'raw',values:[...input.values]});guard(row);if(recorded.ok!==true||!equal((await inspect(row)).rawValues,input.values))throw Error('storm-fury-dice:actual-recorded-physical-required')}
 else if(!spec.rawValues||!equal(spec.rawValues,input.values))throw Error('storm-fury-dice:actual-physical-player-required')
}
export async function recordStormFurySavingHostAdoption(input:{requestId:string;rollerTokenId?:string;sides:number;rawValues:readonly number[];values:readonly number[]}){
 const{row,spec}=await lookup(input);if(!spec.rawValues||!equal(spec.rawValues,input.rawValues)||!faces(input.values,row.component))throw Error('storm-fury-dice:exact-physical-before-adoption-required')
 await row.rpc('dice',{...row.identity,requestId:spec.requestId,phase:'adopt',values:[...input.values]});guard(row);const adopted=await inspect(row);if(!equal(adopted.values,input.values))throw Error('storm-fury-dice:exact-private-adoption-required')
}
