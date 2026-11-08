import{dnd5ePluginFeatureCurrentEnvelopeFullV1,dnd5ePluginFeatureDefinition}from'../../rulesets/dnd5e/plugins/pluginContentCatalog'
import{secondChanceParentDefinitionSignature}from'../../lib/secondChanceParentSignature'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {SecondChanceCombat} from './secondChanceHostCommit'
import {secondChanceParentGroup} from './secondChanceParentGroup'
import {secondChanceParentScopeMatches} from './secondChanceParentScope'
import {assertSecondChanceOriginalClockAuthority} from './secondChanceOriginalClockAuthority'
import {captureSecondChancePostNativeFrame,readSecondChancePostNativeFrame,type SecondChancePostNativeFrame} from './secondChancePostNativeBoundary'
import {readPostNativeActivityStage,sameActivityParentData,type PostNativeActivityStage} from './postNativeActivityParent'
import {planDnd5eMapResultApplication} from '../../rulesets/dnd5e/mapBridge'

type Revisioned={_sync?:{revision?:number}}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'>
const issuedStages=new WeakMap<SecondChancePostNativeFrame,PostNativeActivityStage>()
const childFrames=new WeakMap<SecondChancePostNativeFrame,SecondChancePostNativeFrame>()
function revision(value:Revisioned|null,name:string){
  if(value==null)return 0
  const result=value._sync?.revision
  if(!Number.isSafeInteger(result)||result!<0)throw Error('second-chance-activity:revision-required:'+name)
  return result!
}
/** Called only from the actual Base Activity callback. This reads the real
 * stage WeakMap; neither a JSON snapshot nor an earlier native frame suffices. */
export async function captureSecondChancePostConcentrationActivityFrame(
  nativeFrame:SecondChancePostNativeFrame,stage:PostNativeActivityStage,gateway:Gateway,
):Promise<SecondChancePostNativeFrame>{
  const native=readSecondChancePostNativeFrame(nativeFrame)
  if(native.phase!=='native-before-base')throw Error('second-chance-activity:original-native-frame-required')
  const settled=readPostNativeActivityStage(stage)
  if(settled.parentTransactionId!==native.parentTransactionId||settled.result.state.combatId!==native.combatId||settled.map.id!==native.mapId||
    !sameActivityParentData(settled.characters,native.characters)||!sameActivityParentData(settled.characterIdByCombatantId,native.characterIdByCombatantId)||
    !sameActivityParentData(settled.result.events.slice(0,native.result.events.length),native.result.events))throw Error('second-chance-activity:unrelated-base-stage')
  const [combat,maps,characters,geometry]=await Promise.all([
    gateway.loadResource<SecondChanceCombat&Revisioned>('combat'),
    gateway.loadResource<{maps:BattleMap[]}&Revisioned>('maps'),
    gateway.loadResource<{characters:Character[]}&Revisioned>('characters'),
    gateway.loadResource<Revisioned>('map-geometry'),
  ])
  if(!combat||!maps||!characters)throw Error('second-chance-activity:original-resources-required')
  const group=secondChanceParentGroup(combat,native.parentTransactionId),root=group[0]
  if(!root||!secondChanceParentScopeMatches(combat,root,native.mapId)||JSON.stringify(group)!==native.scGroupIdentity||
    group.some(row=>row.parentContinuation?.phase!=='ready')||
    revision(combat,'combat')!==native.revisions.combat||revision(maps,'maps')!==native.revisions.maps||
    revision(characters,'characters')!==native.revisions.characters||revision(geometry,'map-geometry')!==native.revisions['map-geometry'])throw Error('second-chance-activity:changed-original-group')
  const assertSources=()=>{for(const row of group){const feature=dnd5ePluginFeatureDefinition(row.featureId);if(!dnd5ePluginFeatureCurrentEnvelopeFullV1(row.featureId)||feature?.automation!=='full'||feature.declarativeAbility?.automation!=='full'||row.featureDefinitionSignature!=null&&JSON.stringify(feature.declarativeAbility)!==row.featureDefinitionSignature)throw Error('second-chance-activity:changed-source-definition')}}
  assertSources()
  if(root.parentDefinitionSignature!==undefined&&(!root.parentInput||root.parentDefinitionSignature!==await secondChanceParentDefinitionSignature(root.parentInput.state)))throw Error('second-chance-activity:changed-parent-definition')
  // This reads and compares the clock bound by the first actual issuance. It
  // never promotes the currently observed clock into original-hit authority.
  const clockRevision=await assertSecondChanceOriginalClockAuthority(root,gateway)
  readSecondChancePostNativeFrame(nativeFrame);assertSources()
  const projected=planDnd5eMapResultApplication({state:settled.result.state,map:settled.map,
    characters:settled.characters,characterIdByCombatantId:settled.characterIdByCombatantId,events:[...settled.result.events]})
  const prior=settled.priorApplication
  const spent=[...new Set([...(projected.spentReactions?.tokenIds??[]),
    ...(prior?.spentReactions?.round===settled.result.state.round?prior.spentReactions.tokenIds:[])])]
    .filter(id=>settled.result.state.combatants[id]?.turn.reactionAvailable===false&&projected.map.tokens.some(token=>token.id===id))
  const application={...projected,geometry:projected.geometry??prior?.geometry,
    spentReactions:spent.length?{round:settled.result.state.round,tokenIds:spent}:undefined,
    tokenPatches:{...prior?.tokenPatches,...Object.fromEntries(Object.entries(projected.tokenPatches??{}).map(([id,patch])=>[id,{...prior?.tokenPatches?.[id],...patch}]))},
    characterPatches:{...prior?.characterPatches,...Object.fromEntries(Object.entries(projected.characterPatches??{}).map(([id,patch])=>[id,{...prior?.characterPatches?.[id],...patch}]))},
    changedTokenIds:[...new Set([...(prior?.changedTokenIds??[]),...projected.changedTokenIds])],
    changedCharacterIds:[...new Set([...(prior?.changedCharacterIds??[]),...projected.changedCharacterIds])]}
  const frame=captureSecondChancePostNativeFrame({...native,phase:'post-concentration-pre-activities',
    revisions:{...native.revisions,'campaign-time':clockRevision},result:settled.result,map:settled.map,application})
  issuedStages.set(frame,stage);childFrames.set(nativeFrame,frame)
  return frame
}
/** Return the original capability, not a ParentWire clone of its empty object. */
export function readSecondChancePostConcentrationActivityStage(frame:SecondChancePostNativeFrame):PostNativeActivityStage{
  const view=readSecondChancePostNativeFrame(frame),stage=issuedStages.get(frame)
  if(view.phase!=='post-concentration-pre-activities'||!stage)throw Error('second-chance-activity:unissued-post-stage')
  readPostNativeActivityStage(stage)
  return stage
}

/** The original publisher adopts this guard only when its actual Base callback
 * issued a post-stage. Ordinary SC without a post-stage retains its contract. */
export function readSecondChancePostConcentrationClockGuard(nativeFrame:SecondChancePostNativeFrame):Record<string,number>{
 readSecondChancePostNativeFrame(nativeFrame)
 const child=childFrames.get(nativeFrame);if(!child)return{}
 readSecondChancePostConcentrationActivityStage(child)
 const revision=readSecondChancePostNativeFrame(child).revisions['campaign-time']
 if(!Number.isSafeInteger(revision)||revision!<0)throw Error('second-chance-activity:original-clock-not-bound')
 return{'campaign-time':revision!}
}

export function isSecondChancePostConcentrationChild(native:SecondChancePostNativeFrame,child:SecondChancePostNativeFrame){readSecondChancePostNativeFrame(native);readSecondChancePostConcentrationActivityStage(child);return childFrames.get(native)===child}
