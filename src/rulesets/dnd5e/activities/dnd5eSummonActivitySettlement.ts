import { isDnd5eCompanionTaskCommand } from '../companionTask'
import { dnd5eCombatantCanHearSource } from '../audibility'
import { isDnd5eCompanionReadyCommand } from '../companionReady'
import { dnd5eCompanionObjectExists } from '../companionObjectInteraction'
import { dnd5eCompanionDestinationFitsMap } from '../companionMovementDestination'
import { isDnd5eCompanionAttackKind } from '../companionAttackKind'
import { dnd5eCompanionGuardAreaFitsMap } from '../companionGuardArea'
import { createDnd5eMechanicalEffect } from '../activeEffects'
import { getDnd5eSrdMonster } from '../monsters'
import { dnd5eCombatantCanSpeakAudibly } from '../headlessCombatEngine'
import type { Dnd5eCombatEvent,Dnd5eCombatant,Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import type { Dnd5eActivityCapabilityProposal } from './dnd5eActivityExecutor'

function ownsBond(effect:NonNullable<Dnd5eCombatant['classState']['activeEffects']>[number],bondKey:string,packageId?:string):boolean {
  return effect.definitionId===`summon-bond:${bondKey}` && (effect.source.pluginId ?? 'srd-5.1')===(packageId ?? 'srd-5.1')
}

export function dnd5eSummonBondAllowsRecall(actor:Dnd5eCombatant,proposal:Extract<Dnd5eActivityCapabilityProposal,{kind:'summon'}>,packageId?:string):boolean {
  const conflict = actor.classState.activeEffects?.some(effect => {
    if (!effect.definitionId.startsWith('summon-bond:') || ownsBond(effect, proposal.bondKey!, packageId)) return false
    const key = effect.definitionId.slice('summon-bond:'.length)
    return proposal.exclusiveBondKeys?.includes(key) === true ||
      effect.tags?.includes(`exclusive-bond-key:${proposal.bondKey}`) === true
  })
  if (conflict) return false
  const bond=actor.classState.activeEffects?.find(effect=>ownsBond(effect,proposal.bondKey!,packageId))
  if(!bond)return true
  return (!bond.tags?.some(tag=>tag.startsWith('bond-monster:')) || bond.tags.includes(`bond-monster:${proposal.monsterId}`)) &&
    (!bond.tags?.some(tag=>tag.startsWith('bond-type:')) || bond.tags.includes(`bond-type:${proposal.creatureTypeOverride}`))
}

/** Shared by direct Activity commits and the registered plugin compiler. */
export function settleDnd5eSummonActivityCapability(state:Dnd5eHeadlessCombatState,actor:Dnd5eCombatant,proposal:Dnd5eActivityCapabilityProposal,activityId:string,events:Dnd5eCombatEvent[],packageId?:string,dmApproved=false):boolean|undefined {
  if (proposal.kind === 'end-owned-companion-control') {
    const target = state.combatants[proposal.targetId]
    if (!target || target.currentHp <= 0 || target.deathSaves.dead || target.summonedSourceCombatantId !== actor.id ||
      target.summonedSourceActivityId !== proposal.sourceActivityId ||
      (target.summonedSourcePackageId ?? 'srd-5.1') !== (packageId ?? 'srd-5.1') || !target.summonedCommandPolicy ||
      (proposal.requiresSpeech && (!dnd5eCombatantCanSpeakAudibly(actor) || !dnd5eCombatantCanHearSource(target,actor,state.mapId) || state.initiativeOrder[state.initiativeIndex] !== actor.id))) return false
    target.summonedSourceCombatantId = undefined
    target.classState.companionCommand = undefined
    target.controller = 'dm'
    target.classState.activeEffects = target.classState.activeEffects?.filter(effect => {
      if (effect.definitionId !== 'summon-control') return true
      events.push({ type: 'active-effect-removed', targetId: target.id, effectId: effect.id, definitionId: effect.definitionId, reason: 'released' })
      return false
    })
    events.push({ type: 'companion-control-ended', actorId: actor.id, targetId: target.id,
      sourceActivityId: proposal.sourceActivityId, becomesHostile: proposal.becomesHostile === true })
    return true
  }
  if(proposal.kind==='command-owned-companion' && proposal.sourceActivityId) {
    if (!isDnd5eCompanionTaskCommand(proposal) || !isDnd5eCompanionReadyCommand(proposal)) return false
    if ((proposal.command === 'use-object' || proposal.command === 'ready' && proposal.ready?.actionKind === 'interact-object') !== (proposal.objectInteraction != null) || (proposal.objectInteraction && !dnd5eCompanionObjectExists(state, proposal.objectInteraction))) return false
    if(proposal.attackKind != null && (!isDnd5eCompanionAttackKind(proposal.attackKind) || proposal.command !== 'attack' || !proposal.attackTargetId || proposal.guardArea))return false
    if (proposal.movementDestination && !dnd5eCompanionDestinationFitsMap(state.companionScene?.map, proposal.targetId, proposal.movementDestination)) return false
    if (proposal.guardArea && (proposal.command !== 'attack' || proposal.attackTargetId ||
      !dnd5eCompanionGuardAreaFitsMap(state.companionScene?.map, proposal.guardArea))) return false
    const attackTarget = proposal.attackTargetId ? state.combatants[proposal.attackTargetId] : undefined
    if (proposal.attackTargetId != null && (!(proposal.command === 'attack' || proposal.command === 'ready' && proposal.ready?.actionKind === 'attack') || !attackTarget ||
      attackTarget.id === proposal.targetId || attackTarget.deathSaves.dead ||
      attackTarget.objectDamageThreshold != null)) return false
    if ((proposal.helpTargetId != null || proposal.helpKind != null) &&
      (proposal.command !== 'help' || !proposal.helpTargetId || !state.combatants[proposal.helpTargetId] ||
        proposal.helpTargetId === proposal.targetId || !['attack', 'ability-check'].includes(proposal.helpKind ?? ''))) return false
    const target=state.combatants[proposal.targetId]
    const original=state.companionScene?.map.tokens.find(token=>token.id===proposal.targetId)?.dnd5eSummon
    const voluntary=proposal.voluntaryAfterControlEnds===true && dmApproved && original?.controlEnded===true &&
      original.sourceTokenId===actor.id && original.featureId===proposal.sourceActivityId &&
      (original.pluginId ?? 'srd-5.1')===(packageId ?? 'srd-5.1') && !!original.commandPolicy
    if(proposal.voluntaryAfterControlEnds && !dmApproved)return false
    if(!target || target.currentHp<=0 || target.deathSaves.dead || (!voluntary && (target.summonedSourceCombatantId!==actor.id || target.summonedSourceActivityId!==proposal.sourceActivityId || (target.summonedSourcePackageId ?? 'srd-5.1') !== (packageId ?? 'srd-5.1') || !target.summonedCommandPolicy)))return false
    if(proposal.requiresSpeech && (!dnd5eCombatantCanSpeakAudibly(actor)||!dnd5eCombatantCanHearSource(target,actor,state.mapId)||state.initiativeOrder[state.initiativeIndex]!==actor.id))return false
    target.classState.companionCommand={voluntaryForTokenId:proposal.voluntaryAfterControlEnds && dmApproved?target.id:undefined,task:proposal.task ? {...proposal.task} : undefined,ready:proposal.ready ? {...proposal.ready} : undefined,objectInteraction:proposal.objectInteraction ? {...proposal.objectInteraction} : undefined,guardArea:proposal.guardArea ? {...proposal.guardArea} : undefined,movementDestination:proposal.movementDestination ? {...proposal.movementDestination} : undefined,attackTargetId:proposal.attackTargetId,attackKind:proposal.attackKind,helpTargetId:proposal.helpTargetId,helpKind:proposal.helpKind,schemaVersion:1,sourceOwnerId:actor.id,sourceFeatureId:proposal.sourceActivityId,persistentOrder:(target.summonedCommandPolicy ?? (voluntary?original?.commandPolicy:undefined))==='persistent-order',command:proposal.command,issuedRound:state.round}
    if(proposal.controlSaveDisadvantage!=null)target.classState.activeEffects=target.classState.activeEffects?.map(effect=>effect.definitionId==='summon-control'&&effect.repeatSave?{...effect,repeatSave:{...effect.repeatSave,disadvantage:proposal.controlSaveDisadvantage}}:effect)
    events.push({type:'class-state-changed',actorId:actor.id,targetId:target.id,stateKey:`companion-command:${proposal.command}`,active:true})
    return true
  }
  if(proposal.kind==='summon' && proposal.bondKey) {
    // Do not create a persistent bond or commit its casting cost for an absent dependency.
    if (!getDnd5eSrdMonster(proposal.monsterId)) return false
    if(!dnd5eSummonBondAllowsRecall(actor,proposal,packageId))return false
    const definitionId=`summon-bond:${proposal.bondKey}`
    const bond=createDnd5eMechanicalEffect({id:`${encodeURIComponent(packageId ?? 'srd-5.1')}:${definitionId}:${encodeURIComponent(actor.id)}`,definitionId,label:'坐骑契约',targetId:actor.id,source:{kind:'spell',actorId:actor.id,rulesId:activityId,pluginId:packageId,magical:true},duration:{type:'permanent'},stackingKey:`${packageId ?? 'srd-5.1'}:${definitionId}`,stackingPolicy:'replace'})
    bond.grantedActivities=[...proposal.bondDismissActivityId?[proposal.bondDismissActivityId]:[],...proposal.bondActivityIds??[]]
    bond.tags=[`bond-monster:${proposal.monsterId}`,...proposal.creatureTypeOverride?[`bond-type:${proposal.creatureTypeOverride}`]:[],
      ...(proposal.exclusiveBondKeys ?? []).map(key => `exclusive-bond-key:${key}`)]
    proposal.bondEffectId = bond.id
    actor.classState.activeEffects=[...(actor.classState.activeEffects??[]).filter(effect=>!ownsBond(effect,proposal.bondKey!,packageId)),bond]
    return true
  }
  if(proposal.kind==='dismiss-owned-temporary-summons') {
    events.push({type:'temporary-summons-dismissed',actorId:actor.id,sourceActivityIds:[...proposal.sourceActivityIds],...(packageId?{packageId}:{})})
    return true
  }
  if(proposal.kind==='dismiss-owned-summon') {
    if(!actor.classState.activeEffects?.some(effect=>ownsBond(effect,proposal.bondKey!,packageId)))return false
    if(proposal.releaseBond)actor.classState.activeEffects=actor.classState.activeEffects.filter(effect=>!ownsBond(effect,proposal.bondKey!,packageId))
    else actor.classState.activeEffects=actor.classState.activeEffects.map(effect=>ownsBond(effect,proposal.bondKey!,packageId)?{...effect,tags:[...new Set([...(effect.tags??[]),'bond-dismissed'])]}:effect)
    if (state.companionScene) {
      const scene = state.companionScene
      state.companionScene = { ...scene, map: { ...scene.map, tokens: scene.map.tokens.map(token => {
        const summon = token.dnd5eSummon
        return summon?.sourceTokenId === actor.id && summon.bondKey === proposal.bondKey &&
          (summon.pluginId ?? 'srd-5.1') === (packageId ?? 'srd-5.1')
          ? { ...token, dnd5eSummon: { ...summon, dismissed: true } } : token
      }) } }
    }
    events.push({type:'summon-dismissed',actorId:actor.id,bondKey:proposal.bondKey,...packageId?{packageId}:{},releaseBond:proposal.releaseBond===true})
    return true
  }
  return undefined
}
