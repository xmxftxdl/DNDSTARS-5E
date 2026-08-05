import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { resolveInitiativePortrait } from '../../lib/portraitPresentation'
import type { RoomJournalMutation } from '../../lib/roomCommunications'
import { sceneInteractionReceiptId, type SceneInteractionOutcomeEffect } from '../../lib/sceneOrchestration'
import type { DmAdjudicationInterruptResponse } from '../../lib/combatInterruptProtocol'
import type { BattleMap, Token } from '../../store/maps'
import { useCharacterStore } from '../../store/characters'
import { useMapGeometryStore } from '../../store/mapGeometry'
import { useRoomCommunicationsStore } from '../../store/roomCommunications'
import { useSceneOrchestrationStore } from '../../store/sceneOrchestration'
import type { Character } from '../../types/character'
import { dnd5eDamageTypeLabels } from '../../presentation/maps/combatPresentationController'
import { mergeDnd5eCharacterPatchIntoResult } from './commitDnd5eCombatResult'
import {
  applyDnd5eInventoryGrantBundle,
  createDnd5eMapCombatSnapshot,
  dnd5eAbilityCheckModifier,
  dnd5eConditionLabel,
  dnd5eInventoryHasAuthorityGrantReceipt,
  dnd5eInventoryItemTemplate,
  dnd5eMapInteractionHeadlessSteps,
  dnd5eSkillCheckModifier,
  planDnd5eMapResultApplication,
  prepareDnd5eMapInteraction,
  prepareDnd5eMapInteractionOutcomeTransaction,
  resolveDnd5eHeadlessAction,
  resolveDnd5eMapInteraction,
  spendDnd5eTurnResource,
  validateDnd5eMapInteractionOutcomeReferences,
  type Dnd5eEffectiveRulesContextV1,
  type Dnd5eMapResultPlan,
  type PreparedDnd5eMapInteraction,
} from '../../application/combat/dnd5eCombatRules'
import type {
  Dnd5eTurnEconomyCounts,
  SharedPlayerActionAckState,
  SharedPlayerActionState,
} from '../../lib/sharedCombatTypes'
import type { MapGeometryEntity } from '../../lib/mapGeometry'

type MutableRef<T> = { current: T }
type MapInteractionResolution = ReturnType<typeof resolveDnd5eMapInteraction>

export interface Dnd5eMapInteractionActionContext {
  action: SharedPlayerActionState
  authorityMap: BattleMap
  liveRound: number
  liveIndex: number
  dnd5eActionActorToken: Token
  dnd5eActionActor: Character
  combatActiveRef: MutableRef<boolean>
  initiativeOrderRef: MutableRef<InitiativeEntry[]>
  effectiveRulesRef: MutableRef<Dnd5eEffectiveRulesContextV1 | null>
  acknowledgePlayerAction: (
    action: SharedPlayerActionState,
    status: SharedPlayerActionAckState['status'],
    reason?: string,
    acceptedPosition?: { x: number; y: number },
    dnd5eDeclarativeAttackIntents?: SharedPlayerActionAckState['dnd5eDeclarativeAttackIntents'],
    sideEffects?: {
      roomJournalMutations?: readonly RoomJournalMutation[]
      includeMapGeometry?: boolean
    },
  ) => void
  completePlayerActionRequest: (action: SharedPlayerActionState) => void
  finishSharedCombatInterrupt: (id: string, response?: Record<string, unknown>) => Promise<void>
  requestSharedMapInteractionAdjudication: (
    action: SharedPlayerActionState,
    actorName: string,
    prepared: PreparedDnd5eMapInteraction,
  ) => Promise<DmAdjudicationInterruptResponse>
  rollDiceBoxD20: (label: string, rollerName: string) => Promise<number>
  rollDiceBoxValues: (count: number, sides: number, label: string, rollerName: string) => Promise<number[]>
  currentDnd5eTurnEconomy: (tokenId: string, turnRound?: number) => Dnd5eTurnEconomyCounts
  updateDnd5eTurnEconomy: (
    tokenId: string,
    updater: (current: Dnd5eTurnEconomyCounts) => Dnd5eTurnEconomyCounts,
    turnRound?: number,
  ) => Dnd5eTurnEconomyCounts
  resolveDnd5eHeadlessActionWithAirborneFalls: (
    state: Parameters<typeof resolveDnd5eHeadlessAction>[0],
    action: Parameters<typeof resolveDnd5eHeadlessAction>[1],
    map: BattleMap,
    options?: Parameters<typeof resolveDnd5eHeadlessAction>[2],
  ) => Promise<ReturnType<typeof resolveDnd5eHeadlessAction>>
  applyDnd5eCombatApplication: (application: Dnd5eMapResultPlan) => void
  applyAuthorityGeometryDoorState: (
    mapId: string,
    entityId: string,
    state: NonNullable<MapInteractionResolution['nextDoorState']>,
  ) => void
  applyAuthorityGeometryEntityUpdate: (
    mapId: string,
    entityId: string,
    patch: Partial<MapGeometryEntity>,
  ) => void
  pushCombatLog: (message: string, type: 'turn') => void
}

export async function processDnd5eMapInteractionAction(
  context: Dnd5eMapInteractionActionContext,
): Promise<void> {
  const {
    action, authorityMap, liveRound, liveIndex, dnd5eActionActorToken, dnd5eActionActor,
    combatActiveRef, initiativeOrderRef, effectiveRulesRef, acknowledgePlayerAction,
    completePlayerActionRequest, finishSharedCombatInterrupt, requestSharedMapInteractionAdjudication,
    rollDiceBoxD20, rollDiceBoxValues, currentDnd5eTurnEconomy, updateDnd5eTurnEconomy,
    resolveDnd5eHeadlessActionWithAirborneFalls, applyDnd5eCombatApplication,
    applyAuthorityGeometryDoorState, applyAuthorityGeometryEntityUpdate, pushCombatLog,
  } = context

  const payload = action.dnd5eMapInteraction
        const geometry = useMapGeometryStore.getState().maps.find((entry) => entry.mapId === authorityMap.id)
        if (!payload || (
          payload.operation === 'search'
            ? !payload.point || !Number.isFinite(payload.point.x) || !Number.isFinite(payload.point.y)
            : payload.operation === 'interact-point'
              ? typeof payload.interactionPointId !== 'string' || !payload.interactionPointId
              : typeof payload.doorId !== 'string'
        )) {
          acknowledgePlayerAction(action, 'rejected', 'invalid-map-interaction')
          completePlayerActionRequest(action)
          return
        }
        const pointScene = payload.operation === 'interact-point'
          ? useSceneOrchestrationStore.getState().shared.scenes.find((scene) =>
              scene.mapId === authorityMap.id &&
              scene.interactionPoints.some((point) => point.id === payload.interactionPointId),
            )
          : undefined
        const interactionPoints = pointScene?.interactionPoints ?? []
        const door = payload.operation === 'search' || payload.operation === 'interact-point'
          ? undefined
          : geometry?.doors.find((entry) => entry.id === payload.doorId)
        const inventory = dnd5eActionActor.dnd5eInventory?.entries ?? []
        const hasThievesTools = inventory.some((entry) =>
          entry.quantity > 0 && (entry.templateId.endsWith(':thieves-tools') || entry.item.name === '盗贼工具'),
        )
        const hasMatchingKey = !!door?.interaction?.keyItemId && inventory.some((entry) =>
          entry.quantity > 0 && (entry.templateId === door.interaction?.keyItemId || entry.instanceId === door.interaction?.keyItemId),
        )
        const prepared = prepareDnd5eMapInteraction({
          map: authorityMap,
          geometry,
          actor: dnd5eActionActorToken,
          payload,
          interactionPoints,
          hasThievesTools,
          hasMatchingKey,
        })
        if (!prepared.ok) {
          acknowledgePlayerAction(action, 'rejected', prepared.reason)
          completePlayerActionRequest(action)
          return
        }
        const interactionReceiptId = prepared.prepared.point && pointScene
          ? sceneInteractionReceiptId(
              pointScene,
              prepared.prepared.point,
              dnd5eActionActor.id,
              action.id,
            )
          : undefined
        if (
          interactionReceiptId &&
          dnd5eInventoryHasAuthorityGrantReceipt(
            useCharacterStore.getState().characters,
            interactionReceiptId,
          )
        ) {
          acknowledgePlayerAction(action, 'rejected', 'interaction-already-resolved')
          completePlayerActionRequest(action)
          return
        }
        if (
          prepared.prepared.point?.rewards.some((reward) =>
            !dnd5eInventoryItemTemplate(reward.templateId),
          )
        ) {
          acknowledgePlayerAction(action, 'rejected', 'interaction-reward-unavailable')
          completePlayerActionRequest(action)
          return
        }
        const configuredInteractionEffects = prepared.prepared.point
          ? [
              ...prepared.prepared.point.successEffects,
              ...prepared.prepared.point.failureEffects,
            ]
          : []
        if (configuredInteractionEffects.some((effect) =>
          effect.kind === 'handout' || effect.kind === 'task',
        )) {
          try {
            await useRoomCommunicationsStore.getState().loadJournal()
          } catch {
            acknowledgePlayerAction(action, 'rejected', 'interaction-journal-unavailable')
            completePlayerActionRequest(action)
            return
          }
        }
        const interactionJournal = useRoomCommunicationsStore.getState().journal
        const interactionReferenceValidation = validateDnd5eMapInteractionOutcomeReferences({
          effects: configuredInteractionEffects,
          journal: interactionJournal,
          triggeringMemberId: dnd5eActionActor.roomMemberId,
        })
        if (!interactionReferenceValidation.ok) {
          acknowledgePlayerAction(action, 'rejected', interactionReferenceValidation.reason)
          completePlayerActionRequest(action)
          return
        }
        if (combatActiveRef.current && prepared.prepared.spendAction) {
          const economy = currentDnd5eTurnEconomy(action.actorTokenId, liveRound)
          if (economy.action.current < 1) {
            acknowledgePlayerAction(action, 'rejected', 'action-unavailable')
            completePlayerActionRequest(action)
            return
          }
        }
        let mapInteractionTurnResource: 'objectInteraction' | 'action' = 'action'
        if (combatActiveRef.current && prepared.prepared.turnCost === 'object-interaction') {
          const economy = currentDnd5eTurnEconomy(action.actorTokenId, liveRound)
          mapInteractionTurnResource = (economy.objectInteraction?.current ?? 1) > 0 ? 'objectInteraction' : 'action'
          if (mapInteractionTurnResource === 'action' && economy.action.current < 1) {
            acknowledgePlayerAction(action, 'rejected', 'object-interaction-unavailable')
            completePlayerActionRequest(action)
            return
          }
        }
        const adjudication = await requestSharedMapInteractionAdjudication(
          action,
          dnd5eActionActor.name,
          prepared.prepared,
        )
        const interruptId = `dm-adjudication:${action.id}`
        if (adjudication.decision !== 'approved') {
          await finishSharedCombatInterrupt(interruptId, adjudication)
          acknowledgePlayerAction(action, 'rejected', 'map-interaction-cancelled')
          completePlayerActionRequest(action)
          return
        }
        const skill = prepared.prepared.checkSkill
        const modifier = skill === 'sleightOfHand' && prepared.prepared.method === 'thieves-tools'
          ? dnd5eAbilityCheckModifier(
              dnd5eActionActor,
              'dex',
              dnd5eActionActor.skills.includes('thievesTools') ? 1 : 0,
            )
          : skill
            ? dnd5eSkillCheckModifier(dnd5eActionActor, skill)
            : 0
        const mapInteractionOverride = adjudication.mapInteractionOverride === 'success'
          ? 'success'
          : adjudication.mapInteractionOverride === 'failure'
            ? 'failure'
            : undefined
        let d20 = prepared.prepared.automaticSuccess || mapInteractionOverride
          ? undefined
          : await rollDiceBoxD20(`${prepared.prepared.label}·地图交互检定`, dnd5eActionActor.name)
        if (d20 != null && prepared.prepared.rollMode && prepared.prepared.rollMode !== 'normal') {
          const secondD20 = await rollDiceBoxD20(
            `${prepared.prepared.label}·地图交互检定（${
              prepared.prepared.rollMode === 'advantage' ? '优势' : '劣势'
            }第二枚）`,
            dnd5eActionActor.name,
          )
          d20 = prepared.prepared.rollMode === 'advantage'
            ? Math.max(d20, secondD20)
            : Math.min(d20, secondD20)
        }
        const resolved = resolveDnd5eMapInteraction({
          prepared: prepared.prepared,
          d20,
          modifier,
          adjustedDc: adjudication.adjustedDc,
          dmOverride: mapInteractionOverride,
        })
        const interactionEffects: readonly SceneInteractionOutcomeEffect[] = prepared.prepared.point
          ? resolved.success
            ? prepared.prepared.point.successEffects
            : prepared.prepared.point.failureEffects
          : []
        const damageRollsByEffectId: Record<string, readonly number[]> = {}
        for (const effect of interactionEffects) {
          if (effect.kind !== 'damage') continue
          damageRollsByEffectId[effect.id] = await rollDiceBoxValues(
            effect.count,
            effect.sides,
            `${prepared.prepared.label}·${resolved.success ? '成功结果' : '失败结果'}伤害`,
            dnd5eActionActor.name,
          )
        }
        const preparedOutcomeTransaction = interactionReceiptId
          ? prepareDnd5eMapInteractionOutcomeTransaction({
              effects: interactionEffects,
              damageRollsByEffectId,
              journal: interactionJournal,
              triggeringMemberId: dnd5eActionActor.roomMemberId,
              receiptId: interactionReceiptId,
            })
          : undefined
        if (preparedOutcomeTransaction && !preparedOutcomeTransaction.ok) {
          await finishSharedCombatInterrupt(interruptId, adjudication)
          acknowledgePlayerAction(action, 'rejected', preparedOutcomeTransaction.reason)
          completePlayerActionRequest(action)
          return
        }
        const outcomeTransaction = preparedOutcomeTransaction?.ok
          ? preparedOutcomeTransaction.transaction
          : undefined
        const outcomeSteps = outcomeTransaction?.headlessSteps ?? dnd5eMapInteractionHeadlessSteps({
          effects: interactionEffects,
          damageRollsByEffectId,
        })
        const authorityCharacters = useCharacterStore.getState().characters
        let application: Dnd5eMapResultPlan = {
          map: authorityMap,
          characters: [...authorityCharacters],
          changedTokenIds: [],
          changedCharacterIds: [],
        }
        if (combatActiveRef.current || outcomeSteps.length > 0) {
          const snapshotInitiative = combatActiveRef.current
            ? initiativeOrderRef.current
            : authorityMap.tokens
                .filter((token) => token.type === 'player' || token.type === 'enemy')
                .map((token, index) => ({
                  slotId: `${token.id}:interaction`,
                  tokenId: token.id,
                  label: token.label,
                  emoji: token.emoji,
                  portrait: resolveInitiativePortrait(
                    token.characterId
                      ? authorityCharacters.find((character) => character.id === token.characterId)
                      : undefined,
                    token,
                  ),
                  portraitImageId: token.portraitImageId,
                  color: token.color,
                  roll: Math.max(1, 20 - index),
                }))
          const snapshot = createDnd5eMapCombatSnapshot({
            combatId: action.combatId ?? `map-interaction-${authorityMap.id}`,
            round: combatActiveRef.current ? liveRound : 1,
            turnSlotId: combatActiveRef.current
              ? initiativeOrderRef.current[liveIndex]?.slotId
              : `${action.actorTokenId}:interaction`,
            effectiveRules: effectiveRulesRef.current ?? undefined,
            map: authorityMap,
            characters: authorityCharacters,
            initiativeOrder: snapshotInitiative,
          })
          const actorIndex = snapshot.state.initiativeOrder.indexOf(action.actorTokenId)
          const combatant = snapshot.state.combatants[action.actorTokenId]
          if (actorIndex < 0 || !combatant) {
            acknowledgePlayerAction(action, 'rejected', 'invalid-map-interaction')
            completePlayerActionRequest(action)
            return
          }
          let outcomeState = { ...snapshot.state, initiativeIndex: actorIndex }
          if (combatActiveRef.current) {
            const economy = currentDnd5eTurnEconomy(action.actorTokenId, liveRound)
            combatant.turn = {
              actionAvailable: economy.action.current > 0,
              bonusActionAvailable: economy.bonusAction.current > 0,
              reactionAvailable: economy.reaction.current > 0,
              objectInteractionAvailable: (economy.objectInteraction?.current ?? 1) > 0,
              movementRemaining: economy.movement.current,
            }
            const economyResult = await resolveDnd5eHeadlessActionWithAirborneFalls(
              outcomeState,
              {
                type: 'interact-object', actorId: action.actorTokenId,
                interactionId: prepared.prepared.interactionId,
                useAction: prepared.prepared.turnCost === 'action' || mapInteractionTurnResource === 'action',
              },
              authorityMap,
            )
            if (!economyResult.ok) {
              await finishSharedCombatInterrupt(interruptId, adjudication)
              acknowledgePlayerAction(action, 'rejected', economyResult.reason)
              completePlayerActionRequest(action)
              return
            }
            outcomeState = economyResult.state
          }
          if (outcomeSteps.length > 0) {
            const outcomeResult = await resolveDnd5eHeadlessActionWithAirborneFalls(outcomeState, {
              type: 'scene-interaction-outcome',
              actorId: action.actorTokenId,
              interactionId: prepared.prepared.interactionId,
              steps: outcomeSteps,
            }, authorityMap)
            if (!outcomeResult.ok) {
              await finishSharedCombatInterrupt(interruptId, adjudication)
              acknowledgePlayerAction(action, 'rejected', outcomeResult.reason)
              completePlayerActionRequest(action)
              return
            }
            outcomeState = outcomeResult.state
          }
          application = planDnd5eMapResultApplication({
            state: outcomeState,
            map: authorityMap,
            characters: authorityCharacters,
            characterIdByCombatantId: snapshot.characterIdByCombatantId,
          })
        }
        let inventoryRewardMessage = ''
        if (prepared.prepared.point && interactionReceiptId) {
          const rewardResult = applyDnd5eInventoryGrantBundle(application.characters, {
            characterId: dnd5eActionActor.id,
            grants: resolved.success ? prepared.prepared.point.rewards : [],
            currencyGrants: outcomeTransaction?.currencyGrants ?? [],
            receiptId: interactionReceiptId,
          })
          if (!rewardResult.ok) {
            await finishSharedCombatInterrupt(interruptId, adjudication)
            acknowledgePlayerAction(action, 'rejected', rewardResult.reason ?? 'interaction-reward-failed')
            completePlayerActionRequest(action)
            return
          }
          const rewardedCharacter = rewardResult.characters.find(
            (character) => character.id === dnd5eActionActor.id,
          )
          if (!rewardedCharacter?.dnd5eInventory) {
            await finishSharedCombatInterrupt(interruptId, adjudication)
            acknowledgePlayerAction(action, 'rejected', 'interaction-reward-failed')
            completePlayerActionRequest(action)
            return
          }
          application = mergeDnd5eCharacterPatchIntoResult(
            {
              ...application,
              characters: rewardResult.characters,
            },
            dnd5eActionActor.id,
            { dnd5eInventory: rewardedCharacter.dnd5eInventory },
          )
          if (
            (resolved.success && prepared.prepared.point.rewards.length > 0) ||
            (outcomeTransaction?.currencyGrants.length ?? 0) > 0
          ) {
            inventoryRewardMessage = ` ${rewardResult.message ?? ''}`.trimEnd()
          }
        }
        try {
          applyDnd5eCombatApplication(application)
        } catch {
          await finishSharedCombatInterrupt(interruptId, adjudication)
          acknowledgePlayerAction(action, 'rejected', 'interaction-commit-failed')
          completePlayerActionRequest(action)
          return
        }
        if (combatActiveRef.current) {
          updateDnd5eTurnEconomy(
            action.actorTokenId,
            (current) => spendDnd5eTurnResource(
              current,
              prepared.prepared.turnCost === 'action' ? 'action' : mapInteractionTurnResource,
            ).economy,
            liveRound,
          )
        }
        const geometryChanged = !!prepared.prepared.door && !!(
          resolved.nextDoorState ||
          resolved.nextDoorPhysicalState ||
          (resolved.revealSecret && dnd5eActionActor.roomMemberId)
        )
        if (resolved.nextDoorState && prepared.prepared.door) {
          applyAuthorityGeometryDoorState(authorityMap.id, prepared.prepared.door.id, resolved.nextDoorState)
        }
        if (resolved.nextDoorPhysicalState && prepared.prepared.door) {
          applyAuthorityGeometryEntityUpdate(authorityMap.id, prepared.prepared.door.id, {
            physicalState: resolved.nextDoorPhysicalState,
            ...(resolved.nextDoorPhysicalState === 'broken'
              ? { lockState: 'unlocked' }
              : {}),
          })
        }
        if (resolved.revealSecret && prepared.prepared.door && dnd5eActionActor.roomMemberId) {
          applyAuthorityGeometryEntityUpdate(authorityMap.id, prepared.prepared.door.id, {
            revealedToMemberIds: [...new Set([
              ...(prepared.prepared.door.revealedToMemberIds ?? []),
              dnd5eActionActor.roomMemberId,
            ])],
          })
        }
        const checkText = prepared.prepared.blindSearch || resolved.total == null
          ? ''
          : `（${resolved.total} 对 DC ${resolved.dc}）`
        const interactionOutcome = prepared.prepared.point
          ? resolved.success
            ? prepared.prepared.point.successText
            : prepared.prepared.point.failureText
          : prepared.prepared.blindSearch
            ? resolved.revealSecret ? '发现了一处暗门' : '没有发现异常'
            : `${resolved.success ? '成功' : '失败'}`
        const mechanicalAmountByEffectId = new Map(outcomeSteps
          .filter((step) => step.kind === 'damage')
          .map((step) => [step.id, step.amount]))
        const interactionEffectText = interactionEffects.map((effect) => {
          if (effect.kind === 'currency') return ''
          if (effect.kind === 'handout') return effect.audience === 'all' ? '向全体玩家分发讲义' : '获得一份私密讲义'
          if (effect.kind === 'task') return effect.operation === 'add' ? `新增任务“${effect.title}”` : '推进一项任务'
          if (effect.kind === 'damage') {
            return `受到 ${mechanicalAmountByEffectId.get(effect.id) ?? 0} 点${dnd5eDamageTypeLabels[effect.damageType]}伤害`
          }
          return `获得${dnd5eConditionLabel(effect.condition)}状态`
        }).filter(Boolean).join('；')
        pushCombatLog(
          `${dnd5eActionActor.name} 尝试${prepared.prepared.label}${checkText}：${interactionOutcome}。${
            [inventoryRewardMessage.trim(), interactionEffectText].filter(Boolean).join('；')
          }`,
          'turn',
        )
        await finishSharedCombatInterrupt(interruptId, adjudication)
        completePlayerActionRequest(action)
        acknowledgePlayerAction(
          action,
          'accepted',
          undefined,
          undefined,
          undefined,
          {
            roomJournalMutations: outcomeTransaction?.journalMutations,
            includeMapGeometry: geometryChanged,
          },
        )
        return
}
