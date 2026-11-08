import{ArcaneMovementMapsSettlementSignal,verifyArcaneMovementMapsSettlement}from'./arcaneMovementMapsSettlement'
import {ArcaneNativeMapsSettlementSignal,verifyArcaneNativeMapsSettlement} from './arcaneNativeMapsSettlement'
import {ArmorNativeMapsSettlementSignal,verifyArmorNativeMapsSettlement} from './armorNativeMapsSettlement'
import {BountifulOriginalParentPending} from '../../rulesets/dnd5e/bountifulLuckPersistentRoomDriver'
import {BountifulOriginalParentPublished,verifyBountifulMapsSettlement} from '../../rulesets/dnd5e/bountifulLuckMapsSettlement'
import {SecondChanceMapsSettlementSignal,verifySecondChanceMapsSettlement}from'./secondChanceMapsSettlement'
import {ActivityDeathMapsSettlementSignal,verifyActivityDeathMapsSettlement} from './activityDeathMapsSettlement'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import {
  DmActionTransactionCoordinator,
  type DmAuthoritativeActionOutcome,
} from '../../lib/dmActionTransactionCoordinator'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'

export interface RunMapsPlayerActionTransactionInput {
  coordinator: DmActionTransactionCoordinator
  action: SharedPlayerActionState
  run: () => Promise<void>
  waitForAuthorityCommit: () => Promise<void>
  readOutcome: (actionId: string) => DmAuthoritativeActionOutcome | undefined
  clearOutcome: (actionId: string) => void
  setTransactionActive: (active: boolean, transactionId: string | null) => void
  recover: (error: unknown) => Promise<void>
  rejectAfterRecovery?: (error: unknown) => Promise<void> | void
  arcaneMovementSettlement?:{gateway:Pick<SharedRoomGatewayPort,'loadResource'>;onPublished:()=>Promise<void>}
  arcaneNativeSettlement?:{gateway:Pick<SharedRoomGatewayPort,'loadResource'>;onPublished:(result:import("../../application/combat/dnd5eCombatRules").Dnd5eActionResult)=>Promise<void>}
  armorNativeSettlement?:{
    gateway:Pick<SharedRoomGatewayPort,'loadResource'>
    onPublished:(result:import("../../application/combat/dnd5eCombatRules").Dnd5eActionResult)=>Promise<void>
  }
  bountifulSettlement?:{gateway:Pick<SharedRoomGatewayPort,'loadResource'>;onPending?:()=>void;onPublished:(result:import("../../application/combat/dnd5eCombatRules").Dnd5eActionResult)=>Promise<void>}
  secondChanceSettlement?:{
    gateway:Pick<SharedRoomGatewayPort,'loadResource'>
    onPublished:(result:import("../../application/combat/dnd5eCombatRules").Dnd5eActionResult)=>Promise<void>
  }
  activityDeathSettlement?:{
    gateway:Pick<SharedRoomGatewayPort,'loadResource'>
    onPublished:(result:Extract<import("../../application/combat/dnd5eCombatRules").Dnd5eActionResult,{ok:true}>)=>Promise<void>
  }
  now?: number
}

/**
 * Keep the durable ACK reason bounded and diagnostic without copying arbitrary
 * exception text (URLs, response bodies, or browser details) into the room log.
 */
export function mapsPlayerActionAuthorityFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (message === 'combat-dice-cancelled') return 'combat-action-cancelled'
  const diagnostic = message.match(
    /(?:combat-command|state-transaction|shared-state-transaction|authoritative-resource-save-rejected)[a-z0-9:._-]*/i,
  )?.[0]
  return diagnostic
    ? `authority-commit-failed:${diagnostic.toLowerCase()}`
    : 'authority-commit-failed'
}

/**
 * MapsPage 的唯一 DM 玩家行动入口。这里统一串行化、CombatTransaction
 * 生命周期、共享快照提交等待和异常恢复，具体规则分支只负责 prepare/resolve。
 */
export function runMapsPlayerActionTransaction(input: RunMapsPlayerActionTransactionInput): Promise<void> {
  const { action } = input
  return input.coordinator.enqueueCombatTransaction(
    {
      id: action.id,
      mapId: action.mapId,
      combatId: action.combatId,
      actorId: action.characterId ?? action.actorTokenId,
      actionId: action.id,
      actionKind: action.type,
      now: input.now,
    },
    async () => {
      // Only the invocation that actually owns the coordinator slot may clear
      // an earlier result. A coalesced SSE replay must not erase the outcome
      // while the first delivery is waiting for its authority commit barrier.
      input.clearOutcome(action.id)
      input.setTransactionActive(true, action.id)
      try {
        try{await input.run()}catch(error){
          if((error instanceof BountifulOriginalParentPending||error instanceof BountifulOriginalParentPublished)&&input.bountifulSettlement){
            const verified=await verifyBountifulMapsSettlement({error,action},input.bountifulSettlement.gateway)
            if(verified.kind==='pending'){input.bountifulSettlement.onPending?.();return {status:'ignored'}}
            await input.bountifulSettlement.onPublished(verified.result);return {status:'accepted'}
          }
          if(error instanceof ActivityDeathMapsSettlementSignal&&input.activityDeathSettlement){
            const settlement=await verifyActivityDeathMapsSettlement({settlement:error.settlement,mapId:action.mapId,combatId:action.combatId,parentTransactionId:action.id},input.activityDeathSettlement.gateway)
            if(settlement.kind==='activity-death-parent-pending')return{status:'ignored'}
            await input.activityDeathSettlement.onPublished(settlement.result)
            return{status:'accepted'}
          }
          if(error instanceof ArcaneMovementMapsSettlementSignal&&input.arcaneMovementSettlement){
            const verified=await verifyArcaneMovementMapsSettlement({signal:error,action},input.arcaneMovementSettlement.gateway)
            if(verified.kind==='pending')return{status:'ignored'}
            await input.arcaneMovementSettlement.onPublished();return{status:'accepted'}
          }
          if(error instanceof ArcaneNativeMapsSettlementSignal&&input.arcaneNativeSettlement){
            if(!action.combatId)throw Error('arcane-maps:combat-scope-required')
            const saved=await verifyArcaneNativeMapsSettlement({settlement:error.settlement,mapId:action.mapId,combatId:action.combatId,parentTransactionId:action.id},input.arcaneNativeSettlement.gateway)
            if(saved.kind==='arcane-native-parent-pending')return{status:'ignored'}
            if(!saved.result)throw Error('arcane-maps:publication-result-required')
            await input.arcaneNativeSettlement.onPublished(saved.result);return{status:'accepted'}
          }
          if(error instanceof ArmorNativeMapsSettlementSignal&&input.armorNativeSettlement){
            if(!action.combatId)throw Error('armor-native-maps:combat-scope-required')
            const saved=await verifyArmorNativeMapsSettlement({settlement:error.settlement,mapId:action.mapId,combatId:action.combatId,parentTransactionId:action.id},input.armorNativeSettlement.gateway)
            if(saved.kind==='armor-native-parent-pending')return{status:'ignored'}
            if(!saved.result)throw Error('armor-native-maps:publication-result-required')
            await input.armorNativeSettlement.onPublished(saved.result)
            return{status:'accepted'}
          }
          if(!(error instanceof SecondChanceMapsSettlementSignal)||!input.secondChanceSettlement)throw error
          const settlement=await verifySecondChanceMapsSettlement({settlement:error.settlement,mapId:action.mapId,combatId:action.combatId,parentTransactionId:action.id},input.secondChanceSettlement.gateway)
          if(settlement.kind==='second-chance-parent-pending')return {status:'ignored'}
          await input.secondChanceSettlement.onPublished(settlement.result)
          return {status:'accepted'}
        }
        await input.waitForAuthorityCommit()
        const outcome = input.readOutcome(action.id)
        if (!outcome) throw new Error('missing-player-action-authority-outcome')
        input.clearOutcome(action.id)
        return outcome
      } finally {
        input.setTransactionActive(false, null)
      }
    },
    async (error) => {
      input.setTransactionActive(false, null)
      input.clearOutcome(action.id)
      await input.recover(error)
      await input.rejectAfterRecovery?.(error)
    },
  )
}
