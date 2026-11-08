import{persistBountifulActivityLaterOriginalParent}from'./bountifulActivityLaterOriginal'
import{createBountifulActivityOriginalCollectorSession,readBountifulActivityOriginalOperation,readBountifulActivityMissingOriginalOperation}from'./bountifulActivityOriginalNative'
import{restoreBountifulActivityOriginalCollectorSession,readBountifulActivityOriginalRecoveryProof}from'./bountifulActivityOriginalRecovery'
import{createBountifulActivityOriginalRaw,readBountifulActivityOriginalDiceRoute,type BountifulActivityOriginalDiceRoute}from'./bountifulActivityOriginalRaw'
import{captureBountifulActivityOriginalQualification,captureBountifulActivityFirstOwnQualification,captureBountifulActivityLaterOwnQualification,readBountifulActivityOriginalQualification}from'./bountifulActivityOriginalQualification'
import{captureBountifulActivityOriginalContinuation,type BountifulActivityOriginalContinuation}from'../../rulesets/dnd5e/bountifulActivityOriginalContinuation'
import{persistBountifulOriginalParent}from'../../rulesets/dnd5e/bountifulLuckPersistentHost'
import{resolveBountifulPreparedActivityOriginal}from'../../rulesets/dnd5e/bountifulActivityOriginalPort'
type Source=Parameters<typeof createBountifulActivityOriginalCollectorSession>[0]
type Gateway=Parameters<typeof createBountifulActivityOriginalRaw>[1]&Parameters<typeof persistBountifulOriginalParent>[1]&Parameters<typeof captureBountifulActivityOriginalContinuation>[1]
type Qualification=Awaited<ReturnType<typeof captureBountifulActivityOriginalQualification>>
type Spec=Awaited<ReturnType<typeof readBountifulActivityOriginalDiceRoute>>
type CollectorSession=ReturnType<typeof createBountifulActivityOriginalCollectorSession>|Awaited<ReturnType<typeof restoreBountifulActivityOriginalCollectorSession>>
/** Shape narrowing only; the opaque proof's real issuer is checked below. */
function hasOriginalBookProof(session:CollectorSession):session is Awaited<ReturnType<typeof restoreBountifulActivityOriginalCollectorSession>>{return 'originalBookProof'in session&&typeof session.originalBookProof==='function'}
/** Actual Native determines each next pool. UI callbacks only perform the
 * physical presentation or wait for responses: authenticated book/receipt reads
 * determine every value and decision before the same Native session resumes. */
export async function collectBountifulActivityOriginals(input:{source:Source;restore?:boolean;gateway:Gateway;roll:(spec:Spec,route:BountifulActivityOriginalDiceRoute)=>Promise<readonly number[]>;settlePending:(pending:{parentId:string;occurrence:number;source:Source;qualification:Qualification;pendingQualification?:Qualification;continuation?:BountifulActivityOriginalContinuation})=>Promise<void>}){
 const identity={parentId:input.source.prepared.action.id,mapId:input.source.prepared.map.id,combatId:input.source.prepared.state.combatId}
 let session:ReturnType<typeof createBountifulActivityOriginalCollectorSession>|Awaited<ReturnType<typeof restoreBountifulActivityOriginalCollectorSession>>=input.restore?await restoreBountifulActivityOriginalCollectorSession(identity):createBountifulActivityOriginalCollectorSession(input.source),stage:ReturnType<typeof session.run>,qualification:Qualification|undefined,continuation:BountifulActivityOriginalContinuation|undefined,closed=false
 const dispose=async()=>{if(!closed){closed=true;await session.dispose()}}
 try{stage=session.run();for(let cursor=0;cursor<256;cursor++){
  if(stage.status==='missing-activity-ability-original'){
   qualification=undefined;continuation=undefined
   const operation=session.missingOriginal(stage),request=stage.request,facts=readBountifulActivityMissingOriginalOperation(operation),prior=hasOriginalBookProof(session)?readBountifulActivityOriginalRecoveryProof(session.originalBookProof()).book.rows.find(row=>row.rollId===request.rollId):undefined,label=prior?.label??(facts.source.prepared.feature.name+'·'+(facts.source.prepared.map.tokens.find(token=>token.id===request.actorId)?.label??'掷骰者')+'检定').slice(0,500),handle=await createBountifulActivityOriginalRaw(operation,input.gateway,input.gateway.loadBountifulActivityOriginalSource,label)
   try{const spec=await readBountifulActivityOriginalDiceRoute(handle.route);if(!spec.values){const adopted=await input.roll(spec,handle.route),after=await readBountifulActivityOriginalDiceRoute(handle.route);if(!after.values||JSON.stringify(after.values)!==JSON.stringify(adopted))throw Error('activity-collector:authenticated-adoption-required')}}finally{handle.close()}
   await session.dispose();session=await restoreBountifulActivityOriginalCollectorSession(identity);stage=session.run();continue
  }
  if(stage.status==='pending-ally-natural-one'){
   if(stage.request.nativeLucky){
    if(stage.occurrence===0){
     const operation=session.firstOwnOperation(stage),facts=readBountifulActivityOriginalOperation(operation),combat=await input.gateway.loadResource<{bountifulOriginalParents?:Record<string,unknown>}>('combat'),id=JSON.stringify(['bountiful-original-parent',identity.parentId,0]),prior=combat?.bountifulOriginalParents?.[id]
     if(prior&&hasOriginalBookProof(session)&&readBountifulActivityOriginalRecoveryProof(session.originalBookProof()).book.rows.some(row=>!row.raw||!row.confirmed)){const next=await session.resumeAuthenticatedAllyNaturalOne(stage);if(next.status==='resolved')throw Error('activity-collector:unconfirmed-original-prefix');qualification=undefined;continuation=undefined;stage=next;continue}
     qualification=await captureBountifulActivityFirstOwnQualification(operation)
     if(!prior)await persistBountifulOriginalParent({nativeLuckyChoiceVersion:1,parentId:identity.parentId,source:facts.source,resolve:resolveBountifulPreparedActivityOriginal,actorId:stage.request.actorId,kind:'ability-check',activityOriginalQualification:qualification},input.gateway)
     let next:typeof stage|Awaited<ReturnType<typeof session.resumeAuthenticatedAllyNaturalOne>>
     try{next=await session.resumeAuthenticatedAllyNaturalOne(stage)}catch(error){if(!(error instanceof Error)||error.message!=='bountiful-parent:decision-still-pending')throw error;await input.settlePending({parentId:identity.parentId,occurrence:0,source:facts.source,qualification});next=await session.resumeAuthenticatedAllyNaturalOne(stage)}
     continuation=await captureBountifulActivityOriginalContinuation({source:facts.source,qualification},input.gateway);stage=next;continue
    }
    if(!hasOriginalBookProof(session))return{status:'native-lucky-pending'as const,stage,dispose}
    const ownStage=stage,proof=session.originalBookProof(),book=readBountifulActivityOriginalRecoveryProof(proof),combat=await input.gateway.loadResource<{bountifulOriginalParents?:Record<string,unknown>}>('combat'),id=JSON.stringify(['bountiful-original-parent',identity.parentId,ownStage.occurrence]),prior=combat?.bountifulOriginalParents?.[id],unconfirmed=book.book.rows.some(row=>!row.raw||!row.confirmed)
    if(!prior||!unconfirmed){
     if(!qualification)throw Error('activity-own:preceding-qualified-original-required')
     const currentOwnQualification=await captureBountifulActivityLaterOwnQualification(session.ownOperation(ownStage))
     try{const next=await session.resumeAuthenticatedAllyNaturalOne(ownStage);continuation=await captureBountifulActivityOriginalContinuation({source:book.source,qualification},input.gateway);stage=next;continue}
     catch(error){if(!(error instanceof Error)||(error.message!=='bountiful-parent:decision-still-pending'&&(!!prior||error.message!=='activity-prefix:exact-authenticated-original-required')))throw error;await input.settlePending({parentId:identity.parentId,occurrence:ownStage.occurrence,source:book.source,qualification,pendingQualification:currentOwnQualification,continuation})}
    }
    const next=await session.resumeAuthenticatedAllyNaturalOne(ownStage)
    if(unconfirmed){if(next.status==='resolved')throw Error('activity-collector:unconfirmed-original-prefix');qualification=undefined;continuation=undefined}
    else if(qualification)continuation=await captureBountifulActivityOriginalContinuation({source:book.source,qualification},input.gateway)
    stage=next;continue
   }
   const operation=session.operation(stage),facts=readBountifulActivityOriginalOperation(operation)
   const combat=await input.gateway.loadResource<{bountifulOriginalParents?:Record<string,unknown>}>('combat'),id=JSON.stringify(['bountiful-original-parent',identity.parentId,stage.occurrence]),prior=combat?.bountifulOriginalParents?.[id]
   // A later physical original may already be locked when the realm reloads.
   // Re-read and replay only the existing authenticated B prefix to recover
   // its actual next Native frontier. No new qualification, mint or final
   // continuation is issued while any protected original is unconfirmed.
   if(prior&&hasOriginalBookProof(session)&&readBountifulActivityOriginalRecoveryProof(session.originalBookProof()).book.rows.some(row=>!row.raw||!row.confirmed)){
    const next=await session.resumeAuthenticatedAllyNaturalOne(stage)
    if(next.status==='resolved')throw Error('activity-collector:unconfirmed-original-prefix')
    qualification=undefined;continuation=undefined;stage=next;continue
   }
   if(stage.occurrence>0){
    if(!qualification||!continuation)throw Error('activity-collector:actual-first-prefix-required')
    if(!prior)await persistBountifulActivityLaterOriginalParent({operation,qualification,continuation},input.gateway)
    continuation=await captureBountifulActivityOriginalContinuation({source:facts.source,qualification},input.gateway)
    let next:Awaited<ReturnType<typeof session.resumeAuthenticatedAllyNaturalOne>>
    try{next=await session.resumeAuthenticatedAllyNaturalOne(stage)}catch(error){if(!(error instanceof Error)||error.message!=='bountiful-parent:decision-still-pending')throw error;await input.settlePending({parentId:identity.parentId,occurrence:stage.occurrence,source:facts.source,qualification,pendingQualification:await captureBountifulActivityOriginalQualification(operation),continuation});next=await session.resumeAuthenticatedAllyNaturalOne(stage)}
    continuation=await captureBountifulActivityOriginalContinuation({source:facts.source,qualification},input.gateway);stage=next;continue
   }
   qualification=await captureBountifulActivityOriginalQualification(operation)
   if(!prior)await persistBountifulOriginalParent({parentId:identity.parentId,source:facts.source,resolve:resolveBountifulPreparedActivityOriginal,actorId:stage.request.actorId,kind:'ability-check',activityOriginalQualification:qualification},input.gateway)
   let next:typeof stage|Awaited<ReturnType<typeof session.resumeAuthenticatedAllyNaturalOne>>
   try{next=await session.resumeAuthenticatedAllyNaturalOne(stage)}catch(error){if(!(error instanceof Error)||error.message!=='bountiful-parent:decision-still-pending')throw error;await input.settlePending({parentId:identity.parentId,occurrence:stage.occurrence,source:facts.source,qualification});next=await session.resumeAuthenticatedAllyNaturalOne(stage)}
   // This read does not trust the callback or its return value. It binds exact
   // current protected inputs and the canonical ready receipt to this worker.
   continuation=await captureBountifulActivityOriginalContinuation({source:facts.source,qualification},input.gateway)
   stage=next;continue
  }
  if(stage.status==='resolved'){
   if(!(hasOriginalBookProof(session)))throw Error('activity-collector:protected-original-book-required')
   const recovered=readBountifulActivityOriginalRecoveryProof(session.originalBookProof()),source=qualification?readBountifulActivityOriginalQualification(qualification,recovered.source).source:recovered.source
   return{status:'originals-collected'as const,source,qualification,continuation,observation:stage,dispose}
  }
  throw Error('activity-collector:unsupported-native-phase:'+stage.status)
 }throw Error('activity-collector:bounded-native-frontier-exceeded')
 }catch(error){await dispose();throw error}
}
