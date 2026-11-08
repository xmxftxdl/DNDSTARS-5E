import{captureDnd5eBountifulActivityOriginalQualification,captureDnd5eBountifulActivityFirstOwnQualification,captureDnd5eBountifulActivityLaterOwnQualification}from'../../rulesets/dnd5e/bountifulActivityOriginalQualification'
export{readBountifulActivityOriginalQualification,type BountifulActivityOriginalQualification}from'../../rulesets/dnd5e/bountifulActivityOriginalQualification'
import{getRoomSession}from'../../lib/roomSession';
import{loadBountifulActivityOriginalSource}from'../../composition/browserSharedRoomResources';
import{readBountifulActivityOriginalOperation,readBountifulActivityOriginalOperationBookProof,readBountifulActivityOriginalActualStage}from'./bountifulActivityOriginalNative';
import{readBountifulActivityOriginalRecoveryProof}from'./bountifulActivityOriginalRecovery';
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
/** Only a genuine Native pending-one operation and the exact authenticated
 * original raw/adoption ledger may qualify this Activity original. */
export async function captureBountifulActivityOriginalQualification(operation:object){return capture(operation,'regular')}
export async function captureBountifulActivityFirstOwnQualification(operation:object){return capture(operation,'first-own')}
export async function captureBountifulActivityLaterOwnQualification(operation:object){return capture(operation,'later-own')}
async function capture(operation:object,mode:'regular'|'first-own'|'later-own'){
 const facts=readBountifulActivityOriginalOperation(operation),proof=readBountifulActivityOriginalOperationBookProof(operation),recovered=readBountifulActivityOriginalRecoveryProof(proof),book=await loadBountifulActivityOriginalSource({parentId:facts.parentId,mapId:facts.source.prepared.map.id,combatId:facts.source.prepared.state.combatId}),host=getRoomSession();
 if(host?.role!=='dm'||host.roomId!==book.roomId||host.memberId!==book.hostMemberId||!same(book,recovered.book)||!same(facts.source,recovered.source)||facts.effectTimestamp!==book.effectTimestamp||(mode==='regular'?!!facts.request.nativeLucky:facts.request.nativeLucky!==true)||facts.request.kind!=='ability-check')throw Error('activity-qualification:actual-original-book-required');
 const row=book.rows.find(r=>r.rollId===facts.pool.rollId),index=row?.index;
 if(!row||index===undefined||!row.raw||!row.confirmed||book.rows.some(r=>!r.raw||!r.confirmed)||facts.request.actorId!==row.actorId||facts.pool.actorId!==row.actorId||facts.pool.activityId!==row.activityId||facts.pool.checkId!==row.checkId||facts.pool.mode!==row.mode||facts.pool.skill!==row.skill||!same(facts.request.originalRolls,row.confirmed.values)||!same(facts.pool.values,row.confirmed.values)||row.confirmed.values[facts.request.dieIndex]!==1)throw Error('activity-qualification:exact-original-raw-required');
 return(mode==='first-own'?captureDnd5eBountifulActivityFirstOwnQualification:mode==='later-own'?captureDnd5eBountifulActivityLaterOwnQualification:captureDnd5eBountifulActivityOriginalQualification)(readBountifulActivityOriginalActualStage(operation),book);
}
