const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const keys=(value,allowed)=>record(value)&&Object.keys(value).every(key=>allowed.includes(key))
const text=(value,max=2000)=>typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value
const integer=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=min&&value<=max
const face=value=>integer(value,1,20)
const id=i=>JSON.stringify(['bountiful-equipment-d20',i.roomId,i.mapId,i.parentId,i.sourceOccurrence,i.readyOrdinal,i.rawRollId])
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
export function validateBountifulEquipmentD20Command(c){
 if(!record(c)||!text(c.promptId,12000))return false
 if(c.phase==='equipment-choice')return c.decision==='keep'?keys(c,['phase','promptId','decision']):c.decision==='reroll'&&keys(c,['phase','promptId','decision','dieIndex','instanceId','effectId','resourceId'])&&integer(c.dieIndex,0,1)&&[c.instanceId,c.effectId,c.resourceId].every(value=>text(value))
 if(c.phase==='equipment-roll')return keys(c,['phase','promptId','rollRequestId','value'])&&text(c.rollRequestId,12000)&&face(c.value)
 if(c.phase==='equipment-confirm')return keys(c,['phase','promptId','rollRequestId','rawValue','value'])&&text(c.rollRequestId,12000)&&face(c.rawValue)&&face(c.value)
 return false
}
export function validateBountifulEquipmentD20Receipt(row,parent){
 if(!keys(row,['schemaVersion','kind','id','identity','ready','inventorySignature','candidates','choice','raw','confirmed','processed'])||row.schemaVersion!==1||row.kind!=='equipment-reroll')return false
 const i=row.identity,r=row.ready
 if(!keys(i,['roomId','mapId','combatId','parentId','sourceOccurrence','readyOrdinal','rawRollId','hostMemberId','roller'])||![i.roomId,i.mapId,i.combatId,i.parentId,i.rawRollId,i.hostMemberId].every(value=>text(value))||!integer(i.sourceOccurrence,0,511)||!integer(i.readyOrdinal,0,255)||!keys(i.roller,['tokenId','characterId','memberId'])||![i.roller.tokenId,i.roller.characterId,i.roller.memberId].every(value=>text(value))||row.id!==id(i))return false
 if(parent&&(['roomId','mapId','combatId','parentId','hostMemberId'].some(key=>i[key]!==parent[key])||!equal(i.roller,parent.roller)))return false
 if(!keys(r,['ordinal','actorId','kind','skill','originalRolls','values','rollMode','attackAbility','finalizedDice'])||r.kind!=='attack'||r.skill!==undefined||r.actorId!==i.roller.tokenId||r.ordinal!==i.readyOrdinal||!['normal','advantage','disadvantage'].includes(r.rollMode)||r.attackAbility!==undefined&&!['str','dex','con','int','wis','cha'].includes(r.attackAbility))return false
 const count=r.rollMode==='normal'?1:2
 if(!Array.isArray(r.originalRolls)||!Array.isArray(r.values)||r.originalRolls.length!==count||r.values.length!==count||!r.originalRolls.every(face)||!r.values.every(face)||!Array.isArray(r.finalizedDice)||new Set(r.finalizedDice).size!==r.finalizedDice.length||r.finalizedDice.some(index=>!integer(index,0,count-1))||typeof row.inventorySignature!=='string'||!row.inventorySignature.length||row.inventorySignature.length>2000000)return false
 if(!Array.isArray(row.candidates)||!row.candidates.length||row.candidates.length>128||row.candidates.some(c=>!keys(c,['instanceId','effectId','resourceId','itemName','dieIndices'])||![c.instanceId,c.effectId,c.resourceId,c.itemName].every(value=>text(value))||!Array.isArray(c.dieIndices)||!c.dieIndices.length||new Set(c.dieIndices).size!==c.dieIndices.length||c.dieIndices.some(index=>!integer(index,0,count-1)||r.finalizedDice.includes(index)))||new Set(row.candidates.map(c=>JSON.stringify([c.instanceId,c.effectId,c.resourceId]))).size!==row.candidates.length)return false
 const choice=row.choice,raw=row.raw,confirmed=row.confirmed,rollId=row.id+':owned-reroll'
 if(choice!==undefined&&(!keys(choice,choice.decision==='keep'?['requestId','memberId','decision']:['requestId','memberId','decision','dieIndex','instanceId','effectId','resourceId'])||!text(choice.requestId)||choice.memberId!==i.roller.memberId||!['keep','reroll'].includes(choice.decision)||choice.decision==='reroll'&&!row.candidates.some(c=>c.instanceId===choice.instanceId&&c.effectId===choice.effectId&&c.resourceId===choice.resourceId&&c.dieIndices.includes(choice.dieIndex))))return false
 if(raw!==undefined&&(!keys(raw,['requestId','memberId','value'])||choice?.decision!=='reroll'||raw.requestId!==rollId||raw.memberId!==i.roller.memberId||!face(raw.value)))return false
 if(confirmed!==undefined&&(!keys(confirmed,['requestId','memberId','rawValue','value'])||!raw||confirmed.requestId!==rollId||confirmed.memberId!==i.hostMemberId||confirmed.rawValue!==raw.value||!face(confirmed.value)))return false
 const expectedCount=!choice?0:choice.decision==='keep'?1:!raw?1:!confirmed?2:3
 if(!Array.isArray(row.processed)||row.processed.length!==expectedCount||new Set(row.processed.map(p=>p?.id)).size!==expectedCount)return false
 const responses=[]
 for(const p of row.processed){
  if(!keys(p,['id','signature'])||!text(p.id)||typeof p.signature!=='string'||p.signature.length>50000)return false
  let response;try{response=JSON.parse(p.signature)}catch{return false}
  if(!keys(response,['id','roomId','mapId','combatId','parentId','roomMemberId','sourceMode','actorTokenId','characterId','command'])||response.id!==p.id||response.roomId!==i.roomId||response.mapId!==i.mapId||response.combatId!==i.combatId||response.parentId!==i.parentId||response.actorTokenId!==i.roller.tokenId||response.characterId!==i.roller.characterId||!['dm','player'].includes(response.sourceMode)||response.sourceMode==='dm'&&response.roomMemberId!==i.hostMemberId||!validateBountifulEquipmentD20Command(response.command)||response.command.promptId!==row.id)return false
  responses.push(response)
 }
 if(choice){const actual=responses[0],c=actual.command;if(actual.id!==choice.requestId||actual.roomMemberId!==i.roller.memberId||c.phase!=='equipment-choice'||c.decision!==choice.decision||c.decision==='reroll'&&['dieIndex','instanceId','effectId','resourceId'].some(key=>c[key]!==choice[key]))return false}
 if(raw){const actual=responses[1],c=actual.command;if(actual.roomMemberId!==i.roller.memberId||c.phase!=='equipment-roll'||c.rollRequestId!==rollId||c.value!==raw.value)return false}
 if(confirmed){const actual=responses[2],c=actual.command;if(actual.sourceMode!=='dm'||actual.roomMemberId!==i.hostMemberId||c.phase!=='equipment-confirm'||c.rollRequestId!==rollId||c.rawValue!==raw.value||c.value!==confirmed.value)return false}
 return true
}
export function bountifulEquipmentD20ReceiptComplete(row){return row.choice?.decision==='keep'||!!row.confirmed}
export function projectBountifulEquipmentD20Prompt(row,memberId){
 if(!validateBountifulEquipmentD20Receipt(row)||row.identity.roller.memberId!==memberId)return undefined
 const i=row.identity,base={kind:'equipment-reroll',receiptId:row.id,occurrence:i.sourceOccurrence,parentId:i.parentId,promptId:row.id,mapId:i.mapId,combatId:i.combatId,rollerTokenId:i.roller.tokenId,rollerCharacterId:i.roller.characterId,sourceOccurrence:i.sourceOccurrence}
 if(!row.choice)return {...base,phase:'owner-choice',values:[...row.ready.values],candidates:structuredClone(row.candidates)}
 if(row.choice.decision==='reroll'&&!row.raw)return {...base,phase:'roll',rollRequestId:row.id+':owned-reroll',count:1,sides:20}
 return undefined
}
