import type { Character } from '../../types/character'
import type { D20RollMode } from '../contracts'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { dnd5eInventoryEntryIsActive, dnd5eInventoryEntryUseAction, dnd5eInventoryItemTemplate, normalizeDnd5eInventory } from './items'
import { dnd5eEquipmentMergedBySpellForm } from './mergedFormEquipment'
import { commitDnd5eActivityExecution, dnd5eCombatantCanSee, dnd5eCombatantPairKey, dnd5eDirectedCombatantPairKey, dnd5eRepeatedMeleeAttackMode, dnd5eCombatantHasConcentrationCheckAdvantage, resolveDnd5eHeadlessAction, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { prepareDnd5eEffectRollDice } from './prepareEffectRollDice'
import { withDnd5eRollDiceTransaction } from './rollDiceTransaction'
import { dnd5eSavingThrowMode } from './passiveDefenses'
import { resolveDnd5eRollMode } from './rollMode'
import type { Dnd5eRollDiceRecipe } from './rollDiceModifiers'
import { actorSnapshot } from './activities/dnd5eActivityHeadlessCompiler'
import { dnd5eActivityAttackDefenses } from './activities/dnd5eActivityAttackDefenses'
import { dnd5eActivityHostSavingThrowModeV1 } from './activities/dnd5eActivityPerTargetRolls'
import { resolveCheck, resolveDnd5eActivity, type Dnd5eActivityExecutionResult } from './activities/dnd5eActivityExecutor'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import type { Dnd5eFormulaRollResult } from './activities/dnd5eFormula'

export interface Dnd5eTentacleRodIntent {
  actorId: string
  instanceId: string
  useActionId?: string
  receiptId: string
  targetIds: readonly string[]
}

export interface Dnd5eTentacleRodRollRequest {
  id: string
  label: string
  rollerId: string
  count: number
  sides: 4 | 6 | 8 | 10 | 12 | 20
  mode: D20RollMode
}

/** Validate from live Host inventory and scene, never from a retained client item. */
export function validateDnd5eTentacleRod2014(state: Dnd5eHeadlessCombatState, owner: Character, intent: Dnd5eTentacleRodIntent) {
  const inventory = normalizeDnd5eInventory(owner)
  const entry = inventory.entries.find(item => item.instanceId === intent.instanceId)
  const use = entry && dnd5eInventoryEntryUseAction(entry, intent.useActionId)
  const actor = state.combatants[intent.actorId]
  if (!state.active || !actor || !actor.turn.actionAvailable || state.initiativeOrder[state.initiativeIndex] !== actor.id ||
      actor.currentHp <= 0 || actor.magicSuppressed || owner.currentHp <= 0 ||
      dnd5eEquipmentMergedBySpellForm(owner) || !entry || !dnd5eInventoryItemTemplate(entry.templateId) || entry.quantity < 1 ||
      use?.effect.kind !== 'tentacle-rod-2014' || use.economy !== 'action' || use.consumeQuantity !== 0 ||
      entry.item.magicItem?.attunement !== 'required' || !dnd5eInventoryEntryIsActive(entry) ||
      !['mainWeapon', 'offHand'].includes(entry.equippedSlot ?? '') || entry.containerInstanceId ||
      !intent.receiptId || intent.receiptId.length > 300 || inventory.authorityUseReceipts?.includes(intent.receiptId)) return undefined
  if (intent.targetIds.length !== 3 || intent.targetIds.some(id => {
    const target = state.combatants[id]
    const distance = id === actor.id ? 0 : state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(actor.id,id)]
    return !target || distance == null || distance > 15 || !dnd5eCombatantCanSee(state, actor.id, id) ||
      state.lineOfEffectBlockedByCombatantPair?.[dnd5eDirectedCombatantPairKey(actor.id,id)] === true
  })) return undefined
  return { inventory, entry, actor }
}

/** One item use, three independent attacks, one atomic ordinary damage commit. */
export async function resolveDnd5eTentacleRod2014(input: {
  state: Dnd5eHeadlessCombatState
  owner: Character
  intent: Dnd5eTentacleRodIntent
  roll(request: Dnd5eTentacleRodRollRequest): Promise<readonly number[]>
}) {
  const { owner, intent } = input
  const state = structuredClone(input.state)
  const valid = validateDnd5eTentacleRod2014(state, owner, intent)
  if (!valid) return { ok: false as const, reason: 'invalid-tentacle-rod-use' }
  const checks: Extract<Dnd5eActivityExecutionResult, {ok:true}>['checks'][number][] = []
  const proposals: Extract<Dnd5eActivityExecutionResult, {ok:true}>['proposals'][number][] = []
  const base: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'tentacle-rod-2014', name: '触须权杖（2014）',
    activation: {kind:'free'}, target: {kind:'creature',relation:'any',count:1,rangeFeet:15,includeSelf:true},
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: {kind:'item',id:valid.entry.templateId,magical:true}, outcomes: [],
  }
  const execution = (activity: Dnd5eActivityDefinitionV1, targetId: string, rolls: Record<string,Dnd5eFormulaRollResult>, mode: D20RollMode) => {
    const target = state.combatants[targetId]
    const distance = targetId === valid.actor.id ? 0 : state.distanceFeetByCombatantPair![dnd5eCombatantPairKey(valid.actor.id,targetId)]
    const helplessCritical = distance <= 5 && target.conditions.some(condition => ['unconscious','paralyzed'].includes(condition))
    return {
      activity, actor: actorSnapshot(valid.actor, valid.actor, state),
      targets: [{...actorSnapshot(target, valid.actor, state),...(helplessCritical?{criticalThresholdAgainstSource:2}:{}),attackArmorClasses:dnd5eActivityAttackDefenses(state,valid.actor.id,target.id)}],
      rolls, checkRollModes: Object.fromEntries((activity.checks ?? []).map(check => [`${check.id}:${targetId}`,mode])),
      distanceFeetByTargetId: {[targetId]:targetId === valid.actor.id ? 0 : state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(valid.actor.id,targetId)] ?? 0},
      confirmedBy: 'actor' as const,
    }
  }
  const collect = async (request: Dnd5eTentacleRodRollRequest) => {
    const values = await input.roll(request)
    if (values.length !== request.count || values.some(value => !Number.isInteger(value) || value < 1 || value > request.sides)) throw Error('invalid-tentacle-rod-dice')
    return {values:[...values]}
  }
  const collectEffectDice = (rollerId:string) => async (recipe:Dnd5eRollDiceRecipe) =>
    (await collect({id:recipe.id,label:'触须权杖 · 检定附加骰',rollerId,count:recipe.count,sides:recipe.sides,mode:'normal'})).values
  const resolveCheckWithEffectDice = async (check:NonNullable<Dnd5eActivityDefinitionV1['checks']>[number],
    prepared:ReturnType<typeof execution>,mode:D20RollMode,rollerId:string) => {
    const eventId=`${intent.receiptId}:${check.id}`
    const resolved=await prepareDnd5eEffectRollDice({roll:collectEffectDice(rollerId),resolve:rolls=>withDnd5eRollDiceTransaction({eventId,rolls},()=>{
      try{return {ok:true as const,check:resolveCheck(check,prepared,prepared.targets[0],mode)}}
      catch(error){return {ok:false as const,reason:error instanceof Error?error.message:'invalid-effect-dice'}}
    })})
    return {...resolved.result,effectDice:resolved.rolls,eventId}
  }
  try {
    for (let index = 0; index < 3; index++) {
      const targetId = intent.targetIds[index], id = `tentacle-${index + 1}`
      const distance = targetId === valid.actor.id ? 0 : state.distanceFeetByCombatantPair![dnd5eCombatantPairKey(valid.actor.id,targetId)]
      const mode = dnd5eRepeatedMeleeAttackMode(state,valid.actor.id,targetId,'normal',false,distance)
      const attack: Dnd5eActivityDefinitionV1 = {...base, checks:[{
        id,kind:'attack-roll',attackType:'weapon',rollId:id,scope:'per-target',delivery:'melee',
        attackBonus:{kind:'constant',value:9},rollMode:'host-derived',
      }],outcomes:[{id:`${id}-hit`,when:{kind:'check',checkId:id,result:'success'},operations:[{
        id:`${id}-damage`,kind:'damage',target:'target',amount:{kind:'dice',rollId:`${id}-damage`,count:1,sides:6},
        damageType:'bludgeoning',magical:true,critical:'double-dice',
      }]}]}
      const rolls: Record<string,Dnd5eFormulaRollResult> = {
        [`${id}:${targetId}`]:await collect({id,label:`触须 ${index + 1} · +9 近战攻击`,rollerId:valid.actor.id,count:mode === 'normal' ? 1 : 2,sides:20,mode}),
      }
      const previewInput = execution(attack,targetId,rolls,mode)
      const previewResult = await resolveCheckWithEffectDice(attack.checks![0],previewInput,mode,valid.actor.id)
      if(!previewResult.ok)return previewResult
      const preview = previewResult.check
      if (preview.success) {
        const critical = preview.criticalSuccess
        rolls[`${id}-damage`] = await collect({id:`${id}-damage`,label:`触须 ${index + 1} · ${critical ? '重击 2d6' : '1d6'} 钝击`,rollerId:valid.actor.id,count:critical ? 2 : 1,sides:6,mode:'normal'})
      }
      const result = withDnd5eRollDiceTransaction({eventId:previewResult.eventId,rolls:previewResult.effectDice},()=>
        resolveDnd5eActivity(execution(attack,targetId,rolls,mode)))
      if (!result.ok) return result
      checks.push(...result.checks); proposals.push(...result.proposals)
    }
    const allHitSameTarget = new Set(intent.targetIds).size === 1 && checks.length === 3 && checks.every(check => check.success)
    let slowedTargetId: string | undefined
    if (allHitSameTarget) {
      const targetId = intent.targetIds[0]
      const check = {id:'tentacle-con-save',kind:'saving-throw' as const,rollId:'tentacle-con-save',ability:'con' as const,
        dc:{kind:'constant' as const,value:15},rollMode:'host-derived' as const,scope:'per-target' as const}
      const activity = {...base,checks:[check]}
      const mode = dnd5eActivityHostSavingThrowModeV1({activity,state,actor:valid.actor,target:state.combatants[targetId],check})
      const saveInput = execution(activity,targetId,{[`tentacle-con-save:${targetId}`]:await collect({id:'tentacle-con-save',label:'触须权杖 · DC 15 体质豁免',rollerId:targetId,count:mode === 'normal' ? 1 : 2,sides:20,mode})},mode)
      const resolvedSave = await resolveCheckWithEffectDice(check,saveInput,mode,targetId)
      if(!resolvedSave.ok)return resolvedSave
      const result = resolvedSave.check
      checks.push(result)
      if (result.success === false) slowedTargetId = targetId
    }
    if(slowedTargetId)proposals.push({kind:'apply-effect',operationId:'tentacle-rod-slow',targetId:slowedTargetId,
      effectId:'tentacle-rod-2014:slowed',name:'触须权杖：迟滞',disposition:'debuff',
      duration:{kind:'save-ends',maximumRounds:10,timing:'target-turn-end',ability:'con',dc:15},
      conditions:[],modifierGroups:[{speedMultiplier:0.5,savingThrowDisadvantages:['dex'],preventReactions:true,actionOrBonusActionOnly:true}],
      concentration:false,stacking:'refresh-duration',magical:true})
    if(!validateDnd5eTentacleRod2014(state,owner,intent))return {ok:false as const,reason:'tentacle-rod-source-changed'}
    const committed = commitDnd5eActivityExecution(state,{
      actorId:valid.actor.id,activityId:base.id,targetIds:[...new Set(intent.targetIds)],
      source:{kind:'item',id:valid.entry.templateId},
      resolution:{ok:true,status:'resolved',checks,proposals,consumptions:[{kind:'action-economy',economy:'action',amount:1,consumeOn:'resolve'}]},
    })
    if (!committed.ok) return committed
    let settledState=committed.state
    const events=[...committed.events]
    for(let index=0;index<events.length;index++){
      const event=events[index]
      if(event.type!=='concentration-check-required'||event.settled)continue
      const target=settledState.combatants[event.targetId]
      if(!target?.concentrating)continue
      const baseMode=dnd5eSavingThrowMode(target,'con',{effectVisible:true})
      const mode=resolveDnd5eRollMode({advantage:[{active:baseMode==='advantage'||dnd5eCombatantHasConcentrationCheckAdvantage(target),reason:'concentration'}],
        disadvantage:[{active:baseMode==='disadvantage'||target.classState.concentrationCheckDisadvantagePendingSourceId!=null,reason:'concentration'}]}).mode
      const values=(await collect({id:`concentration-${index}`,label:`触须伤害 · DC ${event.dc} 专注豁免`,rollerId:target.id,count:mode==='normal'?1:2,sides:20,mode})).values
      const resolved=await prepareDnd5eEffectRollDice({roll:collectEffectDice(target.id),resolve:effectRollDice=>resolveDnd5eHeadlessAction(settledState,
        {type:'concentration-save',actorId:target.id,dc:event.dc,d20:values[0],d20Second:values[1],effectRollDice},
        {transactionId:`${intent.receiptId}:concentration:${index}`})})
      if(!resolved.result.ok)return resolved.result
      settledState=resolved.result.state
      events[index]={...event,settled:true}
      events.push(...resolved.result.events)
    }
    return {...committed,state:settledState,events,owner:{...owner,dnd5eInventory:{...valid.inventory,revision:(valid.inventory.revision ?? 0) + 1,
      authorityUseReceipts:[...(valid.inventory.authorityUseReceipts ?? []),intent.receiptId].slice(-512)}},checks,slowedTargetId}
  } catch (error) {
    return {ok:false as const,reason:error instanceof Error ? error.message : 'tentacle-rod-resolution-failed'}
  }
}
