import{validStormCastOriginalFrame}from'./storm-cast-original.mjs'
const data=v=>!!v&&typeof v==='object'&&!Array.isArray(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
export function stormCastChoiceKey(id){let a=2166136261,b=2246822519;for(let i=0;i<id.length;i++){a=Math.imul(a^id.charCodeAt(i),16777619);b=Math.imul(b^id.charCodeAt(i),3266489917)}return'storm-cast:'+(a>>>0).toString(36)+(b>>>0).toString(36)}
/** Reconstruct only answers which the normal authenticated interrupt service has
 * already stored. A caller-supplied choice/result is never an input here. */
export function projectStormCastOwnerChoice(book,queue){try{
 if(!book||!validStormCastOriginalFrame(book.frame)||queue?.mapId!==book.mapId||!Array.isArray(queue.interrupts)||new Set(queue.interrupts.map(row=>row.id)).size!==queue.interrupts.length)return{ok:false,error:'storm-cast-choice:actual-interrupt-queue-required'}
 const frame=book.frame,key=stormCastChoiceKey(frame.id),interruptIds=[]
 const read=(featureId,suffix,options)=>{const id=key+':'+featureId+':'+suffix,row=queue.interrupts.find(row=>row.id===id),payload=row?.payload;if(!row||row.kind!=='plugin-choice'||!['answered','done'].includes(row.status)||row.transactionId!==book.parentId||row.mapId!==book.mapId||row.actorCharId!==book.characterId||!data(payload)||payload.featureId!==featureId||payload.defaultOptionId!=='pending'||!same(payload.options?.map(option=>option.id),options)||!(book.memberId===book.hostMemberId?['actor','dm']:['actor']).includes(payload.audience)||!data(row.response)||!options.includes(row.response.optionId)||row.response.optionId==='pending')throw Error('storm-cast-choice:actual-owner-answer-required');interruptIds.push(id);return row.response.optionId}
 for(const option of frame.options){const use=read(option.featureId,'use',['pending','decline','use']);if(use==='decline')continue
  const type=read(option.featureId,'damage-type',['pending','cancel','lightning','thunder']);if(type==='cancel')return{ok:true,decision:{kind:'decline'},interruptIds}
  const targetIds=[];for(const targetId of frame.targetIds){const answer=read(option.featureId,'target:'+targetId,['pending','cancel','skip','select']);if(answer==='cancel')return{ok:true,decision:{kind:'decline'},interruptIds};if(answer==='select')targetIds.push(targetId)}
  return{ok:true,decision:{kind:'use',choice:{frameId:frame.id,featureId:option.featureId,damageType:type,targetIds}},interruptIds}
 }
 return{ok:true,decision:{kind:'decline'},interruptIds}
}catch(error){return{ok:false,error:error?.message??'storm-cast-choice:actual-owner-answer-required'}}}
