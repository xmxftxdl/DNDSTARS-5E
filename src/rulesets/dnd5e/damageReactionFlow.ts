import type { Character } from '../../types/character'
import { consumeDnd5eSingleUseActivityGrant, dnd5eHeadlessTurnKey, resolveDnd5eHeadlessAction, type Dnd5eAction, type Dnd5eActionResult, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { createDnd5eDamageCommitSession, createDnd5ePreparedDamageCommitSession, type Dnd5eDamageReplaySession } from './damageCommitSession'
import type { Dnd5eDamageCommitCheckpoint } from './damageCommitCheckpoint'
import { dnd5eDamageCheckpointActivitySupported } from './damageCommitReaction'
import { prepareDnd5eDamageReactionSpell } from './damageReactionSpellPreparation'
import { scaleDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityScaling'
import { planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import type { Dnd5eReactionMaterialChange } from './damageReactionMaterialLedger'
import { mergeDnd5eReactionMaterialsIntoMapPlan } from './damageReactionMaterialApplication'
import { prepareDnd5eDamageReactionMaterialCharacters, type Dnd5ePreparedMaterialContext } from './damageReactionMaterialPreparation'
import { listDnd5ePersonalDamageCheckpointActivitiesV1, type Dnd5eActivityTriggerWindowV1 } from './activities/dnd5eActivityTriggerWindows'
import { rollDnd5eActivityTriggerDiceV1, type Dnd5eActivityTriggerChoiceRequestV1, type Dnd5eActivityTriggerConfirmationV1, type Dnd5eActivityTriggerRollRequestV1 } from './activities/dnd5eActivityTriggerSettlement'
import { listDnd5eWeaponHitActivities } from './activities/dnd5eWeaponHitDiscovery'
import { dnd5eWeaponHitSecondaryCandidates, dnd5eWeaponHitConditionChoices, resolveDnd5eWeaponHitActivity } from './activities/dnd5eWeaponHitActivity'
import { dnd5eActivityTriggerContextsFromCombatEventV1 } from './activities/dnd5eActivityTriggerWindows'
import { getRegisteredDnd5eActivity, listRegisteredDnd5eActivityPackages } from './activities/dnd5eActivityRegistry'
import type { Dnd5eWeaponHitEvent, Dnd5eWeaponHitDecision } from './weaponHitCheckpoint'
import {collectDnd5eHitPushConsequences} from './weaponHitPushConsequences'
import { dnd5eCriticalCancellationOptions } from './headlessCombatEngine'
import { dnd5ePluginFeatureDefinition } from './pluginApi'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import type { Dnd5eCriticalCancellationSelection } from './criticalCancellationCheckpoint'
import { dnd5eZeroHitPointTurnOptions } from './zeroHitPointReaction'

/** Async Host orchestration. No state is published here; the room commits the
 * sole final result after its own current-revision check. */
export interface Dnd5eDamageReactionFlowOptions {
  prepareZeroHitPointTurnStart?: (actorId:string,state:Dnd5eHeadlessCombatState)=>Promise<Extract<Dnd5eAction,{type:'begin-turn'}>>
  combatRevision: number
  movementMap?: import('../../store/maps').BattleMap
  chooseFollow?: (request:{follow:import('./weaponHitFollowCheckpoint').Dnd5eHitFollowRequest;state:Dnd5eHeadlessCombatState;eventId:string})=>Promise<import('./weaponHitFollowCheckpoint').Dnd5eHitFollowChoice>
  pushConsequences?: Pick<Parameters<typeof collectDnd5eHitPushConsequences>[0],'roll'|'rollEffectDice'|'requestFallReaction'|'rollFallingDamage'>
  selectPushCell?: (request:{actorId:string;targetId:string;maximumFeet:number;state:Dnd5eHeadlessCombatState;eventId:string;packageId:string;activity:import('./activities/dnd5eActivityContracts').Dnd5eActivityDefinitionV1}) => Promise<import('../../lib/gridCombat').GridCell|null>
  selectSecondaryTargets?: (request: {actorId:string;eventId:string;packageId:string;activity: import('./activities/dnd5eActivityContracts').Dnd5eActivityDefinitionV1;candidates:readonly {id:string;name:string}[]}) => Promise<readonly string[] | undefined>
  charactersByCombatantId?: Readonly<Record<string, Character>>
  authorityUnchanged: () => boolean
  confirm: (request: Dnd5eActivityTriggerChoiceRequestV1) => Promise<Dnd5eActivityTriggerConfirmationV1>
  roll: (request: Dnd5eActivityTriggerRollRequestV1) => Promise<readonly number[]>
}

export function resolveDnd5eActionWithDamageReactions(input: Dnd5eDamageReactionFlowOptions & {
  state:Dnd5eHeadlessCombatState; action:Dnd5eAction; options?:Parameters<typeof resolveDnd5eHeadlessAction>[2]
}):Promise<Dnd5eActionResult> {
  return driveDamageReactions(input,input.state,(pause,hitPause)=>createDnd5eDamageCommitSession(input.state,input.action,pause,input.options,undefined,hitPause))
}

export type Dnd5eDamageReactionMapContext = Omit<Parameters<typeof planDnd5eMapResultApplication>[0], 'state' | 'events'>

/** Direct action entry that cannot silently drop its material changes. */
export async function resolveDnd5eActionWithMaterialDamageReactions(
  input: Parameters<typeof resolveDnd5eActionWithDamageReactions>[0], context: Dnd5eDamageReactionMapContext,
): Promise<Dnd5eActionResult & { application?: Dnd5eMapResultPlan }> {
  const charactersByCombatantId = Object.fromEntries(Object.entries(context.characterIdByCombatantId).flatMap(([tokenId, id]) => {
    const character = context.characters.find(candidate => candidate.id === id)
    return character ? [[tokenId, character]] : []
  }))
  const settled = await resolveDnd5ePreparedWithMaterialDamageReactions({ ...input, charactersByCombatantId },
    { prepared: { state: input.state } }, value => {
      const result = resolveDnd5eHeadlessAction(value.prepared.state, input.action, input.options)
      return { result, application: result.ok ? planDnd5eMapResultApplication({ ...context, state: result.state, events: [...result.events] }) : undefined }
    })
  return { ...settled.result, application: settled.application }
}

export function resolveDnd5ePreparedWithDamageReactions<Input extends {prepared?:{state:Dnd5eHeadlessCombatState}},Result>(
  options:Dnd5eDamageReactionFlowOptions,input:Input,resolve:(input:Input)=>Result,
):Promise<Result> {
  if(!input.prepared)throw new Error('damage-reaction-prepared-state-required')
  return driveDamageReactions(options,input.prepared.state,(pause,hitPause)=>createDnd5ePreparedDamageCommitSession(input,resolve,pause,undefined,hitPause))
}

/** Host-only nested boundary. The owning facade must merge changes into its final application. */
export function resolveDnd5eDamageBoundaryWithMaterials<Result>(
  options: Dnd5eDamageReactionFlowOptions, state: Dnd5eHeadlessCombatState,
  resolve: (state: Dnd5eHeadlessCombatState) => Result, succeeded: (result: Result) => boolean,
): Promise<{ result: Result; materialChanges: readonly Dnd5eReactionMaterialChange[] }> {
  const input = { prepared: { state } }
  return driveDamageReactions(options, state, (pause,hitPause) => createDnd5ePreparedDamageCommitSession(input,
    value => ({ result: resolve(value.prepared.state), materialChanges: [] as readonly Dnd5eReactionMaterialChange[] }), pause, {
      charactersByCombatantId: options.charactersByCombatantId ?? {}, succeeded: value => succeeded(value.result),
    },hitPause), (value, materialChanges) => ({ ...value, materialChanges }))
}

/** Opt-in facade that can carry both combat and inventory changes in one map application. */
export function resolveDnd5ePreparedWithMaterialDamageReactions<
  Input extends { prepared?: { state: Dnd5eHeadlessCombatState } & Dnd5ePreparedMaterialContext },
  Result extends { result?: { ok: boolean }; application?: Dnd5eMapResultPlan },
>(options: Dnd5eDamageReactionFlowOptions, input: Input, resolve: (input: Input) => Result): Promise<Result> {
  if (!input.prepared) throw new Error('damage-reaction-prepared-state-required')
  const charactersByCombatantId = prepareDnd5eDamageReactionMaterialCharacters(options.charactersByCombatantId ?? {}, input.prepared)
  return driveDamageReactions(options, input.prepared.state, (pause,hitPause) => createDnd5ePreparedDamageCommitSession(input, resolve, pause, {
    charactersByCombatantId, succeeded: result => result.result?.ok === true,
  },hitPause), (result, changes) => {
    if (!result.result?.ok || !changes.length) return result
    if (!result.application) throw new Error('damage-reaction-material-application-required')
    return { ...result, application: mergeDnd5eReactionMaterialsIntoMapPlan(result.application, changes) }
  })
}

async function driveDamageReactions<Result>(input:Dnd5eDamageReactionFlowOptions, state:Dnd5eHeadlessCombatState,
  create:(pause:(checkpoint:Dnd5eDamageCommitCheckpoint,state?:Dnd5eHeadlessCombatState,characters?:Readonly<Record<string, Character>>)=>boolean,
    hitPause:(event:Dnd5eWeaponHitEvent,state:Dnd5eHeadlessCombatState)=>boolean)=>Dnd5eDamageReplaySession<Result>,
  finalizeMaterials?: (result: Result, changes: readonly Dnd5eReactionMaterialChange[]) => Result,
):Promise<Result> {
  let offered: {state:Dnd5eHeadlessCombatState; windows:readonly Dnd5eActivityTriggerWindowV1[]; characters:Readonly<Record<string, Character>>} | undefined
  const characters = structuredClone(input.charactersByCombatantId ?? {})
  const hitBatchId = `weapon-hit:${globalThis.crypto.randomUUID()}`
  const hitDefinitions = new Map<string, { packageId: string; activityId: string; version: string; signature: string }>()
  const session = create((checkpoint,state,stagedCharacters)=>{
    if(!state)return false
    const activeCharacters = stagedCharacters ?? characters
    const windows = listDnd5ePersonalDamageCheckpointActivitiesV1({state,checkpoint,eventBatchId:'discovery',character:activeCharacters[checkpoint.targetId],allowMaterialWrites:!!finalizeMaterials})
      .map(window=>({...window,available:window.available.filter(entry=>dnd5eDamageCheckpointActivitySupported(entry.activity,checkpoint))}))
      .filter(window=>window.available.length>0)
    offered={state,windows,characters:activeCharacters}
    return windows.length>0
  }, (event,snapshot) => listDnd5eWeaponHitActivities({ state:snapshot,event,eventBatchId:hitBatchId,combatRevision:input.combatRevision }).length > 0)
  const guard = () => {
    if(!input.authorityUnchanged()) {session.cancel();throw new Error('damage-reaction-stale-authority')}
    for (const definition of hitDefinitions.values()) if (JSON.stringify(getRegisteredDnd5eActivity(definition.packageId,definition.activityId)) !== definition.signature ||
      listRegisteredDnd5eActivityPackages().find(entry=>entry.packageId===definition.packageId)?.packageVersion !== definition.version) {
      session.cancel();throw new Error('weapon-hit-activity-changed')
    }
  }
  try {
    guard()
    let result=session.run(state)
    for(let count=0;(result.status==='pending' || result.status==='pending-zero'||result.status==='pending-zero-start'||result.status==='pending-critical'||result.status==='pending-weapon-hit'||result.status==='pending-hit-push'||result.status==='pending-hit-follow') && count<128;count++) {
      if(result.status==='pending-zero-start'){
        if(!input.prepareZeroHitPointTurnStart)throw new Error('zero-hp-start-input-required')
        const start=await input.prepareZeroHitPointTurnStart(result.actorId,result.snapshot)
        guard();result=session.resumeZeroStart(state,start);continue
      }
      if(result.status==='pending-zero'){
        const pending=result
        let selected:string|undefined
        for(const option of dnd5eZeroHitPointTurnOptions(pending.snapshot,pending.checkpoint)){
          const feature=dnd5ePluginFeatureDefinition(option.featureId)
          if(!feature?.declarativeAbility)throw new Error('zero-hp-definition-missing')
          const eventId=`${hitBatchId}:zero-hp:${pending.checkpoint.occurrence}:${option.featureId}`
          guard()
          const choice=await input.confirm({eventId,packageId:feature.ownerPluginId,actorId:option.actorId,
            targetIds:[option.actorId],confirmation:'actor-choice',
            activity:{schemaVersion:1,id:'zero-hit-point-extra-turn',name:feature.name,description:feature.declarativeAbility.description,
              activation:{kind:'reaction'},automation:automationCapabilityFromLegacyStatus('partial'),target:{kind:'self'},outcomes:[]},
            triggerContext:{eventId,event:'before-drop-to-zero',source:{kind:'combat',id:state.combatId},
              eligibleActorIds:[option.actorId],eligibleTargetIds:[option.actorId],actionEconomyAvailable:{reaction:true}},
          })
          guard()
          if(choice.accepted){selected=option.featureId;break}
        }
        result=session.resumeZero(state,pending.checkpoint.occurrence,selected);continue
      }
      if(result.status==='pending-critical'){
        const pending=result
        let selection:Dnd5eCriticalCancellationSelection|undefined
        for(const option of dnd5eCriticalCancellationOptions(pending.snapshot,pending.event)){
          const feature=dnd5ePluginFeatureDefinition(option.featureId),ability=feature?.declarativeAbility
          if(!feature||!ability)continue
          const signature=JSON.stringify(ability)
          const triggerContext=dnd5eActivityTriggerContextsFromCombatEventV1(pending.snapshot,pending.event,0,`${hitBatchId}:critical:${pending.occurrence}`).find(context=>context.event==='attack-hit')
          if(!triggerContext)throw Error('critical-cancellation-trigger-missing')
          guard()
          const choice=await input.confirm({eventId:`${triggerContext.eventId}:${option.protectorId}:${option.featureId}`,packageId:feature.ownerPluginId,
            actorId:option.protectorId,targetIds:[pending.event.targetId],confirmation:'actor-choice',triggerContext,
            activity:{schemaVersion:1,id:'critical-cancellation',name:ability.name,description:ability.description,
              activation:{kind:'reaction'},automation:automationCapabilityFromLegacyStatus('partial'),
              target:{kind:'creature',count:1,relation:'any',rangeFeet:ability.targeting.kind==='single-creature'?ability.targeting.rangeFeet:undefined},outcomes:[]}})
          guard()
          if(JSON.stringify(dnd5ePluginFeatureDefinition(option.featureId)?.declarativeAbility)!==signature)throw Error('critical-cancellation-definition-changed')
          if(choice.accepted){selection={protectorId:option.protectorId,featureId:option.featureId};break}
        }
        result=session.resumeCritical(state,pending.occurrence,pending.event,selection)
        continue
      }
      if(result.status==='pending-hit-follow'){
        if(!input.chooseFollow)throw Error('weapon-hit-follow-selection-unavailable')
        const pending=result
        guard()
        const choice=await input.chooseFollow({follow:structuredClone(pending.request),state:structuredClone(pending.snapshot),eventId:`${hitBatchId}:follow:${pending.occurrence}`})
        guard()
        result=session.resumeHitFollow(state,pending.occurrence,pending.request,choice)
        continue
      }
      if(result.status==='pending-hit-push'){
        const push=result,map=input.movementMap
        if(!map)throw Error('weapon-hit-push-map-required')
        guard()
        const receipts=await collectDnd5eHitPushConsequences({state:push.snapshot,map,events:[push.event],
          transactionId:`${hitBatchId}:push:${push.occurrence}`,isCurrent:()=>{guard();return true},
          roll:input.pushConsequences?.roll??(async()=>{throw Error('weapon-hit-push-save-ui-required')}),
          rollEffectDice:input.pushConsequences?.rollEffectDice,
          requestFallReaction:input.pushConsequences?.requestFallReaction,
          rollFallingDamage:input.pushConsequences?.rollFallingDamage??(async()=>{throw Error('weapon-hit-push-fall-ui-required')})})
        guard()
        if(!receipts.ok)throw Error(`weapon-hit-push-${receipts.reason}`)
        result=session.resumeHitPush(state,push.occurrence,push.event,{map,entryReplays:receipts.entryReplays,
          landings:receipts.landings,fallReactions:receipts.fallReactions})
        continue
      }
      if(result.status==='pending-weapon-hit') {
        const hit=result, staged=structuredClone(hit.snapshot), batch=`${hitBatchId}:${hit.occurrence}`
        const offers=listDnd5eWeaponHitActivities({state:staged,event:hit.event,eventBatchId:batch,combatRevision:input.combatRevision})
        const decisions: Dnd5eWeaponHitDecision[]=[]
        const handled: {packageId:string;activityId:string}[]=[]
        for(const offer of offers) {
          const entry=offer.available
          const identity={packageId:entry.packageId,activityId:entry.activity.id}
          handled.push(identity)
          hitDefinitions.set(JSON.stringify(identity),{...identity,version:entry.packageVersion,signature:offer.definitionSignature})
          guard()
          if(!listDnd5eWeaponHitActivities({state:staged,event:hit.event,eventBatchId:batch,combatRevision:input.combatRevision})
            .some(candidate=>candidate.available.packageId===entry.packageId && candidate.available.activity.id===entry.activity.id))continue
          const triggerContext=dnd5eActivityTriggerContextsFromCombatEventV1(staged,hit.event,0,batch).find(context=>context.event==='attack-hit')!
          const choice = entry.confirmation === 'automatic' ? { accepted: true } : await input.confirm({eventId:triggerContext.eventId,packageId:entry.packageId,activity:{...structuredClone(entry.activity),choices:dnd5eWeaponHitConditionChoices(staged,hit.event,entry.activity)},
            actorId:hit.event.actorId,targetIds:[hit.event.targetId],confirmation:'actor-choice',triggerContext:structuredClone(triggerContext)})
          guard()
          if(!choice.accepted)continue
          let selectedSecondaryTargetIds: readonly string[] = []
          const secondary = entry.activity.outcomes.flatMap(outcome=>outcome.operations).find(operation=>operation.kind==='secondary-weapon-damage')
          if (secondary?.kind === 'secondary-weapon-damage') {
            const candidates = dnd5eWeaponHitSecondaryCandidates(staged,hit.event,secondary)
            if (candidates.length) {
              if (!input.selectSecondaryTargets) throw new Error('weapon-hit-secondary-selection-unavailable')
              const selected = await input.selectSecondaryTargets({actorId:hit.event.actorId,eventId:triggerContext.eventId,
                packageId:entry.packageId,activity:structuredClone(entry.activity),candidates})
              guard()
              if (selected == null) continue
              if (selected.length>128 || new Set(selected).size!==selected.length || selected.some(id=>!candidates.some(candidate=>candidate.id===id))) throw new Error('invalid-secondary-targets')
              selectedSecondaryTargetIds=selected
            }
          }
          const authoritativeRolls: Record<string, { values: readonly number[] }> = {}
          for (const roll of offer.rolls) {
            authoritativeRolls[roll.id] = { values: await input.roll({...roll,label:entry.activity.name,kind:roll.kind ?? 'formula',actorId:hit.event.actorId,
              rollerTokenId:roll.rollerTokenId ?? hit.event.actorId,targetId:hit.event.targetId,targetName:staged.combatants[hit.event.targetId].name}) }
            guard()
          }
          let selected=resolveDnd5eWeaponHitActivity({state:staged,event:hit.event,eventBatchId:batch,combatRevision:input.combatRevision,
            ...identity,packageVersion:entry.packageVersion,expectedDefinitionSignature:offer.definitionSignature,choices:choice.choices,authoritativeRolls,selectedSecondaryTargetIds})
          if(!selected.ok)throw new Error(`weapon-hit-${selected.reason}`)
          if(selected.pushSelectionRequired){
            if(!input.selectPushCell || !input.movementMap)throw new Error('weapon-hit-push-selection-unavailable')
            const selectedPushCell=await input.selectPushCell({actorId:hit.event.actorId,targetId:hit.event.targetId,
              maximumFeet:selected.pushSelectionRequired.maximumFeet,state:structuredClone(staged),eventId:triggerContext.eventId,
              packageId:entry.packageId,activity:structuredClone(entry.activity)})
            guard()
            selected=resolveDnd5eWeaponHitActivity({state:staged,event:hit.event,eventBatchId:batch,combatRevision:input.combatRevision,
              ...identity,packageVersion:entry.packageVersion,expectedDefinitionSignature:offer.definitionSignature,choices:choice.choices,authoritativeRolls,
              selectedSecondaryTargetIds,map:input.movementMap,selectedPushCell})
            if(!selected.ok)throw new Error(`weapon-hit-${selected.reason}`)
            if(selected.pushSelectionRequired)throw new Error('weapon-hit-push-selection-required')
          }
          decisions.push(selected.decision)
          for (const grant of selected.decision.consumedGrants ?? []) consumeDnd5eSingleUseActivityGrant({
            before: staged, after: staged, actorId: hit.event.actorId, packageId: grant.packageId,
            activityId: grant.activityId, targetIds: [hit.event.targetId], grantEffectId: grant.effectId, events: [],
          })
          if (selected.decision.usageKeys?.length) {
            const actor = staged.combatants[hit.event.actorId]
            actor.classState.declarativeUsedTurnKeys = { ...actor.classState.declarativeUsedTurnKeys,
              ...Object.fromEntries(selected.decision.usageKeys.map(key => [key, dnd5eHeadlessTurnKey(staged, actor.id)])) }
          }
          for(const cost of selected.decision.resourceCosts)staged.combatants[hit.event.actorId].classResources[cost.resourceId].current-=cost.amount
        }
        const extras=decisions.flatMap(decision=>decision.extraDice?[decision.extraDice]:[])
        guard()
        result=session.resumeWeaponHit(state,hit.occurrence,hit.event,{extraDice:extras[0],additionalDice:extras.slice(1),
          ...(decisions.some(decision=>decision.resolvedBonusDamage!=null) ? {
            resolvedBonusDamage:decisions.reduce((sum,decision)=>sum+(decision.resolvedBonusDamage??0),0),
            resolvedBonusDamageRolled:decisions.some(decision=>decision.resolvedBonusDamageRolled===true),
          } : {}),
          damageComponents:decisions.flatMap(decision=>decision.damageComponents??[]),
          actorArmorBonuses:decisions.flatMap(decision=>decision.actorArmorBonuses??[]),
          targetWeaponMultipliers:decisions.flatMap(decision=>decision.targetWeaponMultipliers??[]),
          targetSightLimits:decisions.flatMap(decision=>decision.targetSightLimits??[]),
          linkedEffectApplications:decisions.flatMap(decision=>decision.linkedEffectApplications??[]),
          secondaryDamageTargets:decisions.flatMap(decision=>decision.secondaryDamageTargets??[]),
          pushMovements:decisions.flatMap(decision=>decision.pushMovements??[]),
          followRequests:decisions.flatMap(decision=>decision.followRequests??[]),
          consumedGrants:decisions.flatMap(decision=>decision.consumedGrants??[]),
          resourceCosts:decisions.flatMap(decision=>decision.resourceCosts),usageKeys:decisions.flatMap(decision=>decision.usageKeys??[]),handledActivities:handled})
        continue
      }
      const pending=result
      const candidates=offered
      if(!candidates)throw new Error('damage-reaction-missing-checkpoint')
      let accepted=false
      for(const window of candidates.windows) {
        for(const entry of window.available) {
          guard()
          const actorId=pending.checkpoint.targetId
          const spellPreparation = entry.activity.consumption?.some(cost => cost.kind === 'spell-slot')
            ? prepareDnd5eDamageReactionSpell({ packageId: entry.packageId, activity: entry.activity,
              actor: candidates.state.combatants[actorId], character: candidates.characters[actorId] }) : undefined
          if (spellPreparation && (!spellPreparation.ok || (spellPreparation.requiresInventoryWrite && (!finalizeMaterials || spellPreparation.componentCheck.materialPlan?.consumptionTiming === 'spell-end')))) continue
          const triggerContext={...window.triggerContext,eventId:pending.triggerEventId,
            source:{...window.triggerContext.source,executionId:pending.triggerEventId}}
          const decision:Dnd5eActivityTriggerConfirmationV1=entry.confirmation==='automatic' && !spellPreparation ? {accepted:true} : await input.confirm(structuredClone({
            eventId:pending.triggerEventId,packageId:entry.packageId,activity:entry.activity,
            actorId,targetIds:[actorId],confirmation:entry.confirmation,triggerContext,
            ...(spellPreparation?.ok ? { availableCastLevels: spellPreparation.availableCastLevels } : {}),
          }))
          guard()
          if(!decision.accepted)continue
          const castLevel = spellPreparation?.ok ? decision.castLevel : undefined
          if (spellPreparation?.ok && (castLevel == null || !spellPreparation.availableCastLevels.includes(castLevel))) throw new Error('damage-reaction-invalid-slot-choice')
          const rollEntry = castLevel == null ? entry : { ...entry, activity: scaleDnd5eActivityDefinitionV1(entry.activity, { actor: candidates.state.combatants[actorId], castLevel }).activity }
          const rolled=await rollDnd5eActivityTriggerDiceV1({state:candidates.state,available:rollEntry,triggerContext,actorId,targetIds:[actorId],roll:async request=>{
            guard();const values=await input.roll(request);guard();return values
          }})
          guard()
          if('unsupported' in rolled)throw new Error(`damage-reaction-${rolled.unsupported}`)
          result=session.accept(state,pending.checkpoint,{
            command:{schemaVersion:1,commandId:`damage-choice:${globalThis.crypto.randomUUID()}`,
              actorId,packageId:entry.packageId,packageVersion:entry.packageVersion,activityId:entry.activity.id,
              targetIds:[actorId],expectedRevision:input.combatRevision,triggerEventId:pending.triggerEventId,choices:decision.choices,castLevel},
            combatRevision:input.combatRevision,authoritativeRolls:rolled.rolls,checkRollModes:rolled.checkRollModes,
            confirmedBy:entry.confirmation==='automatic'?'system':entry.confirmation==='dm-approval'?'dm':entry.confirmation==='target-choice'?'target':'actor',
            dmApproved:entry.confirmation==='dm-approval',actorCharacter:candidates.characters[actorId],
          })
          accepted=true
          break
        }
        if(accepted)break
      }
      if(!accepted)result=session.decline(state,pending.checkpoint)
    }
    guard()
    if(result.status==='rejected')throw new Error(`damage-reaction-${result.reason}`)
    if(result.status!=='resolved')throw new Error('damage-reaction-checkpoint-limit')
    return finalizeMaterials ? finalizeMaterials(result.result, result.materialChanges ?? []) : result.result
  } finally {session.cancel()}
}
