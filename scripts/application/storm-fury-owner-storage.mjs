import{recordStormFuryPushPreparation,recordStormFuryRoomInterruptMutation,readStormFuryPushDecision}from'./storm-fury-room-authority.mjs'
import{recordStormFurySavingPreparation,recordStormFurySavingDice,readStormFurySavingDice,inspectStormFurySavingComponent,recordStormFurySavingDiceEvent}from'./storm-fury-saving-authority.mjs'
import{createHash,randomUUID}from'node:crypto'
import{mkdir,readFile,writeFile,rename}from'node:fs/promises'
import path from'node:path'
import{bountifulNativeDiceController as canonicalControllerData}from'../../shared/bountiful-native-dice-controller.mjs'
import{recordStormFuryOriginal,readStormFuryOwnerWindow,recordStormFuryOwnerAnswer,readStormFuryOwnerDecision}from'./storm-fury-original-authority.mjs'
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),canonical=v=>Array.isArray(v)?v.map(canonical):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v,equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
async function read(file){try{return JSON.parse(await readFile(file,'utf8'))}catch(error){if(error.code==='ENOENT')return null;throw error}}
const doc=(ctx,name)=>read(path.join(ctx.stateRoot,name+'.json')),book=(ctx,key)=>path.join(ctx.stateRoot,'.authority','storm-fury-original',createHash('sha256').update(key).digest('hex')+'.json')
const ports={equal,doc,context:async ctx=>{const[combat,characters,maps,requests]=await Promise.all(['combat','characters','maps','player-action-requests'].map(name=>doc(ctx,name)));return{combat,characters,maps,requests}},load:(ctx,key)=>read(book(ctx,key)),save:async(ctx,key,value)=>{const target=book(ctx,key);await mkdir(path.dirname(target),{recursive:true});const next=target+'.'+randomUUID()+'.next';await writeFile(next,JSON.stringify(value));await rename(next,target)},controller:(data,mapId,tokenId,roomId)=>canonicalControllerData(data.maps?.maps?.find(map=>map.id===mapId),data.characters?.characters,tokenId,roomId)}
const furyPrivateTails=new Map()
function serializeFuryPrivate(ctx,run){const key=path.resolve(ctx.stateRoot),prior=furyPrivateTails.get(key)??Promise.resolve(),next=prior.catch(()=>undefined).then(run),tail=next.then(()=>undefined,()=>undefined);furyPrivateTails.set(key,tail);return next.finally(()=>{if(furyPrivateTails.get(key)===tail)furyPrivateTails.delete(key)})}
/** The HTTP dispatcher supplies the authenticated principal and serializes this
 * call with the room transaction lock. No body field selects a principal. */
export function dispatchStormFuryOwnerAuthority(ctx,operation,payload,principal){
 const handler={prepare:recordStormFuryOriginal,window:readStormFuryOwnerWindow,answer:recordStormFuryOwnerAnswer,decision:readStormFuryOwnerDecision}[operation]
 if(!handler||!principal?.memberId||!['dm','player'].includes(principal.role))return Promise.resolve({ok:false,status:403,error:'storm-fury-owner:authenticated-room-member-required'})
 return serializeFuryPrivate(ctx,()=>handler(ctx,payload,principal,ports))
}

export function dispatchStormFurySavingAuthority(ctx,operation,payload,principal){
 const handler={prepare:recordStormFurySavingPreparation,dice:recordStormFurySavingDice,read:readStormFurySavingDice,inspect:inspectStormFurySavingComponent}[operation]
 if(!handler||!principal?.memberId||!['dm','player'].includes(principal.role))return Promise.resolve({ok:false,status:403,error:'storm-fury-saving:authenticated-room-member-required'})
 return serializeFuryPrivate(ctx,()=>handler(ctx,payload,principal,ports))
}
export function dispatchStormFurySavingDiceEvent(ctx,channel,payload,principal){return serializeFuryPrivate(ctx,()=>recordStormFurySavingDiceEvent(ctx,channel,payload,principal,ports))}

export function dispatchStormFuryRoomInterruptMutation(ctx,payload,principal){return serializeFuryPrivate(ctx,()=>recordStormFuryRoomInterruptMutation(ctx,payload,principal,ports))}
export function dispatchStormFuryPushAuthority(ctx,operation,payload,principal){const handler={prepare:recordStormFuryPushPreparation,decision:readStormFuryPushDecision}[operation];if(!handler||!principal?.memberId||principal.role!=='dm')return Promise.resolve({ok:false,status:403,error:'storm-fury-push:actual-host-required'});return serializeFuryPrivate(ctx,()=>handler(ctx,payload,principal,ports))}
