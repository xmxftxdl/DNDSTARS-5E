const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const ordered=v=>Array.isArray(v)?v.map(ordered):object(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,n])=>[k,ordered(n)])):v
const same=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b))
const names=['characters','maps','combat','map-geometry','campaign-time']
const revision=v=>v==null?0:Number.isSafeInteger(v?._sync?.revision)&&v._sync.revision>=0?v._sync.revision:undefined
const mechanical=v=>{if(!object(v))return undefined;const{_sync,updatedAt,...rest}=v;return rest}
/** Only an issued original's approved, resumed DM boundary can advance its
 * combat CAS. All mechanical fields and the other four dependencies stay exact. */
export function mastermindThoughtAuthorizedVersions(row,snapshot){
 if(!object(row?.versions)||names.some(n=>!Number.isSafeInteger(row.versions[n])||row.versions[n]<0))return undefined
 const current=Object.fromEntries(names.map(n=>[n,revision(snapshot[n])]))
 if(names.some(n=>current[n]===undefined))return undefined
 if(names.every(n=>current[n]===row.versions[n]))return current
 if(names.some(n=>n!=='combat'&&current[n]!==row.versions[n])||current.combat<=row.versions.combat)return undefined
 const continuation=row.originalAction?.type==='dnd5e-plugin-action'&&['srd-5.1:effect-control.spell:detect-thoughts:surface','srd-5.1:effect-control.spell:detect-thoughts:probe'].includes(row.originalAction.dnd5ePluginAction?.featureId)
 const before=row.originalCombat,combat=snapshot.combat,queue=snapshot['combat-interrupts'],id=continuation?'plugin-choice:'+row.parentTransactionId:'dm-adjudication:'+row.parentTransactionId+':activity'
 if(!object(before)||revision(before)!==row.versions.combat||before.flowPause!==undefined||!object(combat)||combat.flowPause!==undefined||!same(mechanical(before),mechanical(combat)))return undefined
 const matches=queue?.interrupts?.filter(i=>i.id===id)
 if(!Array.isArray(matches)||matches.length!==1)return undefined
 const i=matches[0],p=i.payload
 if(row.phase!=='answered'||i.status!=='done'||i.transactionId!==row.parentTransactionId||i.mapId!==row.mapId||queue.mapId!==row.mapId||i.phase!=='before-action'||i.actorCharId!==row.readerCharacterId||i.targetCharId!==row.ownerCharacterId)return undefined
 if(continuation){if(i.kind!=='plugin-choice'||p?.audience!=='dm'||p.pluginId!=='srd-5.1'||p.featureId!==row.originalAction.dnd5ePluginAction.featureId||i.response?.optionId!=='dm-apply')return undefined}
 else if(i.kind!=='dm-adjudication'||i.response?.decision!=='approved'||p?.contextKind!=='activity-boundary'||p.actionId!==row.parentTransactionId||p.casterTokenId!==row.readerTokenId||p.spellId!=='detect-thoughts')return undefined
 return current
}
