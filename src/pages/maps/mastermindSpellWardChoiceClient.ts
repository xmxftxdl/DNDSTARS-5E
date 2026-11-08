import{requestSharedMastermindSpellWindow}from'../../composition/browserSharedRoomResources'
type Api=typeof requestSharedMastermindSpellWindow
interface Scope{id:string;parentId:string;mapId:string;windowIndex:number;requestId:string}
export type MastermindSpellWardPendingChoice=Scope&({kind:'bountiful';occurrence?:number;ownerId:string;featureId:string;ownerCharacterId:string;ownerName:string;rollerTokenId:string}|{kind:'ward-failure';actorId:string;actorCharacterId:string;actorName:string;retargetAvailable?:true;wardTargetTokenId?:string;proposal?:{revision:number;targetTokenId:string;phase:'pending'|'rejected'|'accepted'|'canceled'};choices:readonly['waste']|readonly['waste','retarget-original']})
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)
function valid(v:unknown):v is MastermindSpellWardPendingChoice{
 if(!object(v)||!['id','parentId','mapId','requestId'].every(k=>typeof v[k]==='string'&&v[k].length>0)||!Number.isSafeInteger(v.windowIndex)||Number(v.windowIndex)<0)return false
 if(Object.hasOwn(v,'occurrence')&&(v.kind!=='bountiful'||!Number.isSafeInteger(v.occurrence)||Number(v.occurrence)<1||Number(v.occurrence)>=64))return false
 return v.kind==='bountiful'?['ownerId','featureId','ownerCharacterId','ownerName','rollerTokenId'].every(k=>typeof v[k]==='string'):v.kind==='ward-failure'&&['actorId','actorCharacterId','actorName'].every(k=>typeof v[k]==='string')&&Array.isArray(v.choices)&&(v.choices.length===1&&v.choices[0]==='waste'||v.choices.length===2&&v.choices[0]==='waste'&&v.choices[1]==='retarget-original')&&(v.retargetAvailable===undefined||v.retargetAvailable===true&&typeof v.wardTargetTokenId==='string'&&(v.proposal===undefined||object(v.proposal)&&Number.isSafeInteger(v.proposal.revision)&&Number(v.proposal.revision)>0&&typeof v.proposal.targetTokenId==='string'&&['pending','rejected','accepted','canceled'].includes(String(v.proposal.phase))))
}
/** Plain UI data never serves as a Native or result capability. Every answer
 * must pass the server's current canonical controller and exact parent scope. */
export async function listMastermindSpellWardPendingChoices(api:Api=requestSharedMastermindSpellWindow){const reply=await api<{choices:unknown}>('ward-choice-list',{});if(!Array.isArray(reply.choices)||!reply.choices.every(valid))throw Error('spell-ward-choice:actual-private-list-required');return reply.choices}
export async function answerMastermindSpellWardPendingChoice(row:MastermindSpellWardPendingChoice,decision:'use'|'decline'|'waste'|'retarget-original',api:Api=requestSharedMastermindSpellWindow){
 const scope={parentId:row.parentId,windowIndex:row.windowIndex,requestId:row.requestId}
 if(row.kind==='bountiful'){if(decision!=='use'&&decision!=='decline')throw Error('spell-ward-choice:helper-choice-required');await api('ward-bountiful-choice',{...scope,...(row.occurrence?{occurrence:row.occurrence}:{}),ownerId:row.ownerId,featureId:row.featureId,decision})}
 else{if(decision!=='waste'&&(decision!=='retarget-original'||!row.choices.some(choice=>choice===decision)))throw Error('spell-ward-choice:issued-actor-choice-required');await api('ward-outcome',{...scope,choice:decision})}
}

/** This is only a caster input proposal. The Host's genuine failed Native
 * source must qualify this revision before the original attack can continue. */
export async function proposeMastermindSpellWardTarget(row:MastermindSpellWardPendingChoice,targetTokenId:string,api:Api=requestSharedMastermindSpellWindow){if(row.kind!=='ward-failure'||!row.retargetAvailable||!targetTokenId||targetTokenId===row.wardTargetTokenId)throw Error('spell-ward-choice:issued-caster-retarget-category-required');return api('ward-retarget-propose',{parentId:row.parentId,windowIndex:row.windowIndex,requestId:row.requestId,targetTokenId})}
