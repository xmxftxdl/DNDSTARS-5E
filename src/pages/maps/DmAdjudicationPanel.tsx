import { useState, type Dispatch, type SetStateAction } from 'react'
import { Maximize2, Minus, Scale } from 'lucide-react'
import type {
  DmAdjudicationEffect,
  DmAdjudicationInterruptPayload,
  DmAdjudicationTerrainEffect,
} from '../../lib/combatInterruptProtocol'
import type {
  Dnd5eAnimalMessengerResolutionV1,
  Dnd5eAnimateDeadResolutionV1,
  Dnd5eAnimateObjectsResolutionV1,
  Dnd5eSendingResolutionV1,
  Dnd5eSequesterResolutionV1,
  Dnd5eWordOfRecallResolutionV1,
} from '../../lib/sharedCombatTypes'
import type { Dnd5ePluginArea, Token } from '../../store/maps'
import {
  DND5E_DAMAGE_TYPES,
  DND5E_DAMAGE_TYPE_LABELS,
  type Dnd5eDamageType,
} from '../../rulesets/dnd5e/damageTypes'
import {
  projectPersistentAreaAdjudicationEffectsForSaveOverride,
  type PersistentAreaSaveOverride,
} from './persistentAreaAdjudicationDraft'
import {
  dnd5eSendingMessageWordCount,
  normalizeDnd5eSendingResolutionV1,
} from '../../rulesets/dnd5e/sending'
import {
  dnd5eAnimalMessengerDurationHours,
  dnd5eAnimalMessengerMessageWordCount,
  dnd5eAnimalMessengerTargetUsesFlight,
  dnd5eAnimalMessengerTravelCapacityMiles,
  normalizeDnd5eAnimalMessengerResolutionV1,
} from '../../rulesets/dnd5e/animalMessenger'
import {
  dnd5eAnimateDeadAnimationCapacity,
  dnd5eAnimateDeadReassertionCapacity,
  dnd5eCreateUndeadCapacity,
  normalizeDnd5eAnimateDeadResolutionV1,
} from '../../rulesets/dnd5e/animateDead'
import {
  dnd5eAnimateObjectsCapacity,
  dnd5eAnimateObjectsCapacityUsed,
  dnd5eAnimateObjectsProfile,
  normalizeDnd5eAnimateObjectsResolutionV1,
} from '../../rulesets/dnd5e/animateObjects'
import {
  DND5E_CREATION_MATERIAL_LABELS,
  dnd5eCreationDurationMinutes,
  dnd5eCreationMaximumEdgeFeet,
} from '../../rulesets/dnd5e/creation'
import {
  DND5E_CREATE_OR_DESTROY_WATER_MODE_LABELS,
  dnd5eCreateOrDestroyWaterCubeEdgeFeet,
  dnd5eCreateOrDestroyWaterMaximumGallons,
} from '../../rulesets/dnd5e/createOrDestroyWater'
import { normalizeDnd5eSequesterResolutionV1 } from '../../rulesets/dnd5e/sequester'
import { normalizeDnd5eWordOfRecallResolutionV1 } from '../../rulesets/dnd5e/wordOfRecall'

export interface SharedDmAdjudicationPromptView {
  id: string
  actorCharId?: string
  payload: DmAdjudicationInterruptPayload
  expiresAt?: number
}

export interface DmAdjudicationEffectDraft {
  id: string
  targetTokenId: string
  operation: '' | NonNullable<DmAdjudicationEffect['operation']>
  amount: string
  damageType?: '' | Dnd5eDamageType
  addCondition: string
  conditionDurationRounds: string
  conditionDurationTickOn: NonNullable<DmAdjudicationEffect['conditionDurationTickOn']>
  removeCondition: string
}

function newDmAdjudicationEffectDraft(): DmAdjudicationEffectDraft {
  return {
    id: `adjudication-effect-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    targetTokenId: '',
    operation: '',
    amount: '',
    damageType: '',
    addCondition: '',
    conditionDurationRounds: '',
    conditionDurationTickOn: 'target-turn-end',
    removeCondition: '',
  }
}

function adjudicatedCastingTimeLabel(value: DmAdjudicationInterruptPayload['castingTime']): string {
  if (value === 'bonus-action') return '附赠动作'
  if (value === 'reaction') return '反应'
  if (value === 'long') return '长时施法'
  return '动作'
}

interface DmAdjudicationPanelProps {
  isDm: boolean
  prompt: SharedDmAdjudicationPromptView | null
  tokens: readonly Token[]
  pluginAreas: readonly Dnd5ePluginArea[]
  dc: string
  setDc: Dispatch<SetStateAction<string>>
  mapOverride: 'roll' | 'success' | 'failure'
  setMapOverride: Dispatch<SetStateAction<'roll' | 'success' | 'failure'>>
  saveOverride: 'unchanged' | 'success' | 'failure'
  setSaveOverride: Dispatch<SetStateAction<'unchanged' | 'success' | 'failure'>>
  effects: DmAdjudicationEffectDraft[]
  setEffects: Dispatch<SetStateAction<DmAdjudicationEffectDraft[]>>
  concentrationRounds: string
  setConcentrationRounds: Dispatch<SetStateAction<string>>
  note: string
  setNote: Dispatch<SetStateAction<string>>
  onDecision: (approved: boolean, monsterSpellSelection?: {
    spellId: string
    slotLevel: number
  }, sendingResolution?: Dnd5eSendingResolutionV1,
  animalMessengerResolution?: Dnd5eAnimalMessengerResolutionV1,
  animateDeadResolution?: Dnd5eAnimateDeadResolutionV1,
  animateObjectsResolution?: Dnd5eAnimateObjectsResolutionV1,
  sequesterResolution?: Dnd5eSequesterResolutionV1,
  wordOfRecallResolution?: Dnd5eWordOfRecallResolutionV1,
  terrainEffects?: DmAdjudicationTerrainEffect[]) => void | Promise<void>
}

export default function DmAdjudicationPanel(props: DmAdjudicationPanelProps) {
  const {
    isDm: isDM,
    prompt: sharedDmAdjudicationPrompt,
    tokens,
    pluginAreas,
    dc: dmAdjudicationDc,
    setDc: setDmAdjudicationDc,
    mapOverride: dmAdjudicationMapOverride,
    setMapOverride: setDmAdjudicationMapOverride,
    saveOverride: dmAdjudicationSaveOverride,
    setSaveOverride: setDmAdjudicationSaveOverride,
    effects: dmAdjudicationEffects,
    setEffects: setDmAdjudicationEffects,
    concentrationRounds: dmAdjudicationConcentrationRounds,
    setConcentrationRounds: setDmAdjudicationConcentrationRounds,
    note: dmAdjudicationNote,
    setNote: setDmAdjudicationNote,
    onDecision: handleSharedDmAdjudicationChoice,
  } = props
  const contextKind = sharedDmAdjudicationPrompt?.payload.contextKind
  const isSpellAdjudication = contextKind == null || contextKind === 'spell'
  const isExplorationSpell = isSpellAdjudication && sharedDmAdjudicationPrompt?.payload.exploration === true
  const isAutomatedRitual = sharedDmAdjudicationPrompt?.payload.automatedRitual === true
  const isBasicActionAdjudication = contextKind === 'basic-action'
  const isRandomTableAdjudication = contextKind === 'post-spell-random-table'
  const isActivityBoundary = contextKind === 'activity-boundary'
  const isMonsterLegendaryAction = contextKind === 'monster-legendary-action'
  const isMonsterAction = contextKind === 'monster-action'
  const isMonsterSpell = contextKind === 'monster-spell'
  const isSending = isSpellAdjudication &&
    sharedDmAdjudicationPrompt?.payload.spellId === 'sending' &&
    !!sharedDmAdjudicationPrompt.payload.sending
  const isAnimalMessenger = isSpellAdjudication &&
    sharedDmAdjudicationPrompt?.payload.spellId === 'animal-messenger' &&
    !!sharedDmAdjudicationPrompt.payload.animalMessenger
  const isCreateUndead = isSpellAdjudication &&
    sharedDmAdjudicationPrompt?.payload.spellId === 'create-undead'
  const isAnimateDead = isSpellAdjudication &&
    (sharedDmAdjudicationPrompt?.payload.spellId === 'animate-dead' || isCreateUndead) &&
    !!sharedDmAdjudicationPrompt.payload.animateDead
  const isAnimateObjects = isSpellAdjudication &&
    sharedDmAdjudicationPrompt?.payload.spellId === 'animate-objects' &&
    !!sharedDmAdjudicationPrompt.payload.animateObjects
  const isCreation = isSpellAdjudication &&
    sharedDmAdjudicationPrompt?.payload.spellId === 'creation' &&
    !!sharedDmAdjudicationPrompt.payload.creation
  const isCreateOrDestroyWater = isSpellAdjudication &&
    sharedDmAdjudicationPrompt?.payload.spellId === 'create-or-destroy-water' &&
    !!sharedDmAdjudicationPrompt.payload.createOrDestroyWater
  const isSequester = isSpellAdjudication &&
    sharedDmAdjudicationPrompt?.payload.spellId === 'sequester' &&
    !!sharedDmAdjudicationPrompt.payload.sequester
  const isWordOfRecall = isSpellAdjudication &&
    sharedDmAdjudicationPrompt?.payload.spellId === 'word-of-recall' &&
    !!sharedDmAdjudicationPrompt.payload.wordOfRecall &&
    !!sharedDmAdjudicationPrompt.payload.wordOfRecallSanctuary
  const isWish = isSpellAdjudication &&
    sharedDmAdjudicationPrompt?.payload.spellId === 'wish' &&
    !!sharedDmAdjudicationPrompt.payload.wish
  const isSpeakWithPlants = isSpellAdjudication &&
    sharedDmAdjudicationPrompt?.payload.spellId === 'speak-with-plants'
  const requiresMonsterSpellSelection =
    sharedDmAdjudicationPrompt?.payload.requiresMonsterSpellSelection === true
  const monsterSpellOptions = sharedDmAdjudicationPrompt?.payload.monsterSpellOptions ?? []
  const [monsterSpellSelection, setMonsterSpellSelection] = useState<{
    promptId: string
    spellId: string
    slotLevel: number
  } | null>(null)
  const [minimizedPromptId, setMinimizedPromptId] = useState<string | null>(null)
  const [sendingDraft, setSendingDraft] = useState<{
    promptId: string
    targetIntelligenceAtLeastOne: boolean
    plane: 'same' | 'different'
    crossPlaneRoll: string
    reply: string
  } | null>(null)
  const [animalMessengerDraft, setAnimalMessengerDraft] = useState<{
    promptId: string
    destinationPreviouslyVisitedConfirmed: boolean
    targetVisibleConfirmed: boolean
  } | null>(null)
  const [animateDeadDraft, setAnimateDeadDraft] = useState<{
    promptId: string
    confirmed: boolean
  } | null>(null)
  const [animateObjectsDraft, setAnimateObjectsDraft] = useState<{
    promptId: string
    confirmed: boolean
  } | null>(null)
  const [sequesterWillingDraft, setSequesterWillingDraft] = useState<{
    promptId: string
    confirmed: boolean
  } | null>(null)
  const [wordOfRecallConfirmationDraft, setWordOfRecallConfirmationDraft] = useState<{
    promptId: string
    confirmed: boolean
  } | null>(null)
  const [plantTerrainDraft, setPlantTerrainDraft] = useState<{
    promptId: string
    areaId: string
    mode: '' | 'ordinary' | 'difficult'
  } | null>(null)
  const activePlantTerrainDraft = plantTerrainDraft && plantTerrainDraft.promptId === sharedDmAdjudicationPrompt?.id
    ? plantTerrainDraft
    : { promptId: sharedDmAdjudicationPrompt?.id ?? '', areaId: '', mode: '' as const }
  const plantTerrainAreas = pluginAreas.filter((area) =>
    area.coreSpellId === 'entangle' ||
    area.coreSpellId === 'plant-growth' ||
    /(?:entangle|plant-growth)/i.test(area.featureId),
  )
  const updatePlantTerrainDraft = (patch: Partial<typeof activePlantTerrainDraft>) => {
    setPlantTerrainDraft({ ...activePlantTerrainDraft, ...patch })
  }
  const activeSendingDraft = sendingDraft && sendingDraft.promptId === sharedDmAdjudicationPrompt?.id
    ? sendingDraft
    : {
        promptId: sharedDmAdjudicationPrompt?.id ?? '',
        targetIntelligenceAtLeastOne: true,
        plane: 'same' as const,
        crossPlaneRoll: '',
        reply: '',
      }
  const updateSendingDraft = (patch: Partial<typeof activeSendingDraft>) => {
    setSendingDraft({ ...activeSendingDraft, ...patch })
  }
  const parsedSendingRoll = activeSendingDraft.crossPlaneRoll === ''
    ? undefined
    : Number(activeSendingDraft.crossPlaneRoll)
  const sendingDelivered = activeSendingDraft.plane === 'same' ||
    (Number.isInteger(parsedSendingRoll) && parsedSendingRoll! > 5)
  const sendingResolution = isSending
    ? normalizeDnd5eSendingResolutionV1({
        schemaVersion: 1,
        targetIntelligenceAtLeastOne: activeSendingDraft.targetIntelligenceAtLeastOne,
        plane: activeSendingDraft.plane,
        ...(activeSendingDraft.plane === 'different'
          ? { crossPlaneRoll: parsedSendingRoll }
          : {}),
        delivered: sendingDelivered,
        reply: activeSendingDraft.reply,
      })
    : undefined
  const activeAnimalMessengerDraft = animalMessengerDraft && animalMessengerDraft.promptId === sharedDmAdjudicationPrompt?.id
    ? animalMessengerDraft
    : {
        promptId: sharedDmAdjudicationPrompt?.id ?? '',
        destinationPreviouslyVisitedConfirmed: false,
        targetVisibleConfirmed: false,
      }
  const animalMessengerResolution = isAnimalMessenger
    ? normalizeDnd5eAnimalMessengerResolutionV1({
        schemaVersion: 1,
        destinationPreviouslyVisitedConfirmed:
          activeAnimalMessengerDraft.destinationPreviouslyVisitedConfirmed,
        targetVisibleConfirmed: activeAnimalMessengerDraft.targetVisibleConfirmed,
      })
    : undefined
  const animalMessengerTarget = isAnimalMessenger
    ? tokens.find((token) =>
        token.id === sharedDmAdjudicationPrompt.payload.animalMessenger?.targetTokenId)
    : undefined
  const animalMessengerDurationHours = isAnimalMessenger
    ? dnd5eAnimalMessengerDurationHours(sharedDmAdjudicationPrompt.payload.slotLevel)
    : 0
  const animalMessengerTravelCapacityMiles = animalMessengerTarget && sharedDmAdjudicationPrompt
    ? dnd5eAnimalMessengerTravelCapacityMiles(
        animalMessengerTarget,
        sharedDmAdjudicationPrompt.payload.slotLevel,
      )
    : 0
  const activeAnimateDeadConfirmed = animateDeadDraft?.promptId === sharedDmAdjudicationPrompt?.id &&
    animateDeadDraft?.confirmed === true
  const animateDeadResolution = isAnimateDead
    ? normalizeDnd5eAnimateDeadResolutionV1({
        schemaVersion: 1,
        targetsConfirmed: activeAnimateDeadConfirmed,
      })
    : undefined
  const activeAnimateObjectsConfirmed = animateObjectsDraft?.promptId === sharedDmAdjudicationPrompt?.id &&
    animateObjectsDraft?.confirmed === true
  const animateObjectsResolution = isAnimateObjects
    ? normalizeDnd5eAnimateObjectsResolutionV1({
        schemaVersion: 1,
        targetsConfirmed: activeAnimateObjectsConfirmed,
      })
    : undefined
  const activeSequesterWilling = sequesterWillingDraft?.promptId === sharedDmAdjudicationPrompt?.id
    ? sequesterWillingDraft?.confirmed === true
    : false
  const sequesterResolution = isSequester
    ? normalizeDnd5eSequesterResolutionV1({
        schemaVersion: 1,
        willingCreatureConfirmed: sharedDmAdjudicationPrompt.payload.sequester?.targetKind === 'object' ||
          activeSequesterWilling,
      })
    : undefined
  const activeWordOfRecallConfirmation =
    wordOfRecallConfirmationDraft?.promptId === sharedDmAdjudicationPrompt?.id &&
    wordOfRecallConfirmationDraft?.confirmed === true
  const wordOfRecallResolution = isWordOfRecall
    ? normalizeDnd5eWordOfRecallResolutionV1({
        schemaVersion: 1,
        sanctuaryConsecratedConfirmed:
          sharedDmAdjudicationPrompt.payload.wordOfRecall?.mode === 'designate-sanctuary' &&
          activeWordOfRecallConfirmation,
        willingCreaturesConfirmed:
          sharedDmAdjudicationPrompt.payload.wordOfRecall?.mode === 'recall' &&
          activeWordOfRecallConfirmation,
      })
    : undefined
  const selectedMonsterSpellId = monsterSpellSelection &&
    monsterSpellSelection.promptId === sharedDmAdjudicationPrompt?.id
    ? monsterSpellSelection.spellId
    : monsterSpellOptions[0]?.spellId ?? ''
  const selectedMonsterSpell = monsterSpellOptions.find((spell) =>
    spell.spellId === selectedMonsterSpellId) ?? monsterSpellOptions[0]
  const requestedSlotLevel = monsterSpellSelection &&
    monsterSpellSelection.promptId === sharedDmAdjudicationPrompt?.id &&
    monsterSpellSelection.spellId === selectedMonsterSpell?.spellId
      ? monsterSpellSelection.slotLevel
      : undefined
  const selectedMonsterSpellSlotLevel = selectedMonsterSpell?.availableSlotLevels.includes(requestedSlotLevel ?? -1)
    ? requestedSlotLevel!
    : selectedMonsterSpell?.availableSlotLevels[0] ?? selectedMonsterSpell?.level ?? 0
  const supportsDirectEffects = contextKind !== 'map-interaction' && !isBasicActionAdjudication && !isActivityBoundary && !isAutomatedRitual && !isSending && !isAnimalMessenger && !isAnimateDead && !isAnimateObjects && !isCreation && !isCreateOrDestroyWater && !isSequester && !isWordOfRecall

  if (!isDM || !sharedDmAdjudicationPrompt) return null
  if (minimizedPromptId === sharedDmAdjudicationPrompt.id) {
    return (
      <button
        type="button"
        onClick={() => setMinimizedPromptId(null)}
        className="pointer-events-auto fixed right-4 top-20 z-[140] flex max-w-[min(30rem,calc(100vw-2rem))] items-center gap-3 rounded-2xl border border-amber-300/35 bg-void-950/95 px-4 py-3 text-left shadow-2xl backdrop-blur"
        aria-label="展开 DM 裁定"
        data-testid="dm-adjudication-restore"
      >
        <Scale className="h-5 w-5 shrink-0 text-amber-300" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-amber-100">
            {isMonsterLegendaryAction ? '传奇动作裁定中' : isMonsterAction || isMonsterSpell ? '怪物行动裁定中' : 'DM 裁定待处理'}
          </span>
          <span className="block truncate text-xs text-slate-400">
            {sharedDmAdjudicationPrompt.payload.casterName} · {sharedDmAdjudicationPrompt.payload.spellName}
          </span>
        </span>
        <Maximize2 className="h-4 w-4 shrink-0 text-slate-300" />
      </button>
    )
  }

  return (
    <>
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shared-dm-adjudication-title"
            data-testid="dm-adjudication-dialog"
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-amber-400/35 bg-void-950 shadow-2xl"
          >
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 id="shared-dm-adjudication-title" className="text-lg font-semibold text-amber-100">
                    {sharedDmAdjudicationPrompt.payload.contextKind === 'persistent-area-trigger'
                      ? '区域触发中断'
                      : sharedDmAdjudicationPrompt.payload.contextKind === 'map-interaction'
                        ? '地图交互中断'
                        : sharedDmAdjudicationPrompt.payload.contextKind === 'basic-action'
                          ? '其他行动裁定'
                          : isMonsterAction
                            ? '怪物动作裁定'
                          : isMonsterSpell
                            ? '怪物法术裁定'
                          : isMonsterLegendaryAction
                            ? '传奇动作裁定'
                          : isActivityBoundary
                            ? 'Activity 边界确认'
                          : isRandomTableAdjudication
                            ? '随机表结果裁定'
                        : 'DM 裁定'} · {sharedDmAdjudicationPrompt.payload.spellName}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {sharedDmAdjudicationPrompt.payload.casterName} · {sharedDmAdjudicationPrompt.payload.contextKind === 'persistent-area-trigger'
                      ? ({ 'on-create': '首次创建', 'on-enter': '进入区域', 'on-move-distance': '区域内移动', 'on-area-move-impact': '区域移动撞击', 'turn-start': '回合开始', 'turn-end': '回合结束', 'source-turn-start': '来源回合开始', 'on-detonate': '区域引爆' } as const)[sharedDmAdjudicationPrompt.payload.triggerTiming ?? 'on-enter']
                      : sharedDmAdjudicationPrompt.payload.contextKind === 'map-interaction'
                        ? 'DM 权威地图事务'
                        : sharedDmAdjudicationPrompt.payload.contextKind === 'basic-action'
                          ? <>玩家声明 · {sharedDmAdjudicationPrompt.payload.castingTime === 'bonus-action' ? '附赠动作' : '动作'}</>
                        : isMonsterLegendaryAction
                          ? <>消耗 {sharedDmAdjudicationPrompt.payload.legendaryActionCost ?? 1} 点传奇动作点 · 当前 {sharedDmAdjudicationPrompt.payload.legendaryActionPointsBefore ?? '未知'} 点</>
                        : isMonsterAction || isMonsterSpell
                          ? <>{adjudicatedCastingTimeLabel(sharedDmAdjudicationPrompt.payload.castingTime)} · DM 最终裁定</>
                        : isRandomTableAdjudication
                          ? <>d100 结果 {sharedDmAdjudicationPrompt.payload.randomTableRoll ?? '未知'} · 原始法术 {sharedDmAdjudicationPrompt.payload.sourceSpellId ?? '未知'}</>
                      : <>{
                      sharedDmAdjudicationPrompt.payload.ritual === true
                        ? `${sharedDmAdjudicationPrompt.payload.spellLevel}环，仪式施法（原施法时间 +10 分钟）`
                        : sharedDmAdjudicationPrompt.payload.spellLevel === 0
                          ? '戏法'
                          : `${sharedDmAdjudicationPrompt.payload.spellLevel}环，以${sharedDmAdjudicationPrompt.payload.slotLevel}环位施放`
                    } · {adjudicatedCastingTimeLabel(sharedDmAdjudicationPrompt.payload.castingTime)}{
                      sharedDmAdjudicationPrompt.payload.castingTime === 'long' &&
                      Number(sharedDmAdjudicationPrompt.payload.elapsedCastingMinutes) > 0
                        ? `（${sharedDmAdjudicationPrompt.payload.elapsedCastingMinutes} 分钟）`
                        : ''
                    }</>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
                    {isBasicActionAdjudication
                      ? `已经消耗${sharedDmAdjudicationPrompt.payload.castingTime === 'bonus-action' ? '附赠动作' : '动作'}`
                      : isMonsterLegendaryAction
                        ? `批准后扣除 ${sharedDmAdjudicationPrompt.payload.legendaryActionCost ?? 1} 点`
                      : isMonsterSpell
                        ? sharedDmAdjudicationPrompt.payload.spellLevel === 0
                          ? '批准后扣除动作，不消费环位'
                          : `批准后扣除动作与 ${sharedDmAdjudicationPrompt.payload.slotLevel} 环位`
                      : isMonsterAction
                        ? `批准后扣除${sharedDmAdjudicationPrompt.payload.castingTime === 'bonus-action' ? '附赠动作' : '动作'}与能力次数`
                      : isRandomTableAdjudication
                        ? '战斗结算已暂停'
                      : isSpellAdjudication
                        ? sharedDmAdjudicationPrompt.payload.ritual === true
                          ? Number(sharedDmAdjudicationPrompt.payload.elapsedCastingMinutes) > 0
                            ? `批准后：推进战役时钟 ${sharedDmAdjudicationPrompt.payload.elapsedCastingMinutes} 分钟，不消费行动资源或法术位`
                            : '批准后：完成长时仪式，不消费行动资源或法术位'
                          : isExplorationSpell
                            ? sharedDmAdjudicationPrompt.payload.spellLevel === 0
                              ? '批准后：探索施法，不消费战斗行动资源或环位'
                              : `批准后：探索施法，消费 ${sharedDmAdjudicationPrompt.payload.slotLevel} 环位，不消费战斗行动资源`
                          : sharedDmAdjudicationPrompt.payload.spellLevel === 0
                            ? sharedDmAdjudicationPrompt.payload.castingTime === 'long' && Number(sharedDmAdjudicationPrompt.payload.elapsedCastingMinutes) > 0
                              ? `批准后：推进战役时钟 ${sharedDmAdjudicationPrompt.payload.elapsedCastingMinutes} 分钟，不消费环位`
                              : `批准后：消费${adjudicatedCastingTimeLabel(sharedDmAdjudicationPrompt.payload.castingTime)}，不消费环位`
                            : sharedDmAdjudicationPrompt.payload.castingTime === 'long' && Number(sharedDmAdjudicationPrompt.payload.elapsedCastingMinutes) > 0
                              ? `批准后：推进战役时钟 ${sharedDmAdjudicationPrompt.payload.elapsedCastingMinutes} 分钟并消费 ${sharedDmAdjudicationPrompt.payload.slotLevel} 环位`
                              : `批准后：消费${adjudicatedCastingTimeLabel(sharedDmAdjudicationPrompt.payload.castingTime)}与 ${sharedDmAdjudicationPrompt.payload.slotLevel} 环位`
                        : '未批准前：不消费资源'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMinimizedPromptId(sharedDmAdjudicationPrompt.id)}
                    className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white"
                    aria-label="最小化 DM 裁定"
                    data-testid="dm-adjudication-minimize"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
                <section className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                  <h4 className="text-sm font-semibold text-slate-200">规则正文</h4>
                  <p className="mt-3 max-h-[48vh] overflow-y-auto whitespace-pre-line text-xs leading-6 text-slate-400">
                    {sharedDmAdjudicationPrompt.payload.description || '当前没有规则正文，请根据房间已获授权的资料裁定。'}
                  </p>
                </section>
                <section className="space-y-3">
                  <div className="rounded-xl border border-sky-400/15 bg-sky-500/[0.04] p-3 text-xs leading-5 text-sky-100/75">
                    {sharedDmAdjudicationPrompt.payload.contextKind === 'map-interaction'
                      ? '批准后由 DM Host 使用当前角色与地图快照掷骰和结算。可调整 DC 或直接指定成功／失败；事务完成前玩家无法重复提交。'
                      : isBasicActionAdjudication
                        ? '该行动的动作或附赠动作已由 Host 权威扣除。请根据玩家声明确认是否允许，并在备注中记录检定、DC、结果或后续效果；无论批准或驳回，都不会返还行动资源。'
                        : isMonsterLegendaryAction
                          ? '该传奇动作由 DM 裁定。传送可在批准后、点击顶部“继续”前拖动怪物到裁定位置；施法请选择具体法术与法术位，并可填写最终伤害、治疗或状态。批准后 Host 才会扣除传奇动作点和所选法术资源。'
                        : isMonsterSpell
                          ? '该怪物法术没有通过完整 Headless 审查。请填写完成命中、豁免、抗性后的最终效果；批准后 Host 原子扣除行动与法术资源，取消或提交失败均不消费。'
                        : isMonsterAction
                          ? '该怪物动作含有未自动化规则。请填写最终伤害、治疗或状态；批准后 Host 原子扣除行动、充能或每日次数，取消或提交失败均不消费。'
                        : isRandomTableAdjudication
                          ? '该随机表结果没有已审计的 Headless 自动化映射。原始施法与资源消耗已经完成；请填写完成命中、豁免、抗性等裁定后的最终效果，提交后才会恢复战斗。也可以跳过该结果。'
                        : isActivityBoundary
                          ? `Host 已准备目标、骰据和可验证的安全效果。批准后会原子提交这部分结算；边界外的叙事、幻象、地图或临场效果请在备注中记录，不要在此重复填写伤害或状态。取消则不消费任何资源。${sharedDmAdjudicationPrompt.payload.concentration && sharedDmAdjudicationPrompt.payload.suggestedConcentrationRounds != null
                            ? ` 本次安全子集会由 Activity 建立 ${sharedDmAdjudicationPrompt.payload.suggestedConcentrationRounds} 轮专注；此值只读，DM 无需重复填写。`
                            : ''}`
                        : isSpellAdjudication
                          ? isAutomatedRitual
                            ? '这是长时仪式的完成确认。Host 已验证法术、职业、成分、目标与区域；批准后将执行与普通施法完全相同的已审计 Headless 效果，但不消费行动资源或法术位。请不要重复填写伤害或状态。'
                            : sharedDmAdjudicationPrompt.payload.ritual === true
                            ? '这是长时仪式的完成确认。Host 已验证法术与职业的仪式资格；批准不会消费行动资源或法术位。请确认原施法时间加 10 分钟的过程与成分，并填写仪式完成后的最终状态、专注、持续效果或备注。'
                            : isAnimalMessenger
                              ? `Host 已校验动物信使的 V/S/M、微型野兽目标与 30 尺距离。DM 只需确认目标可见、目的地确由施法者到访；批准后会自动写入按本次环位计算的“动物信使”持续效果。路线阻碍、实际抵达与 NPC 反应仍由 DM 跟踪。不要添加通用伤害或状态行。`
                            : isSequester
                              ? `Host 已校验隔离术的 V/S/M、5,000 gp 消耗材料、目标类型和 5 尺触及距离。DM 只需确认生物自愿性；批准后系统会原子消费材料与对应法术位${isExplorationSpell ? '，探索施法不消费战斗行动资源' : '，并消费施法行动资源'}，随后写入专用永久效果。不要添加通用伤害或状态行。`
                            : isWordOfRecall
                              ? `Host 已校验回返真言的言语成分、法术位、圣所记录、目标数量与 5 尺距离。DM 只需确认地点与神祇的联系，或全部同行目标的自愿性；批准后系统会原子消费对应法术位${isExplorationSpell ? '，探索施法不消费战斗行动资源' : '和施法行动资源'}，并保存圣所或执行跨地图传送。不要添加通用伤害或状态行。`
                            : isSending
                              ? `Host 已校验短讯术的 V/S/M 与 25 词声明。DM 只需结算智力、位面、d100 与即时回应；批准后系统会消费对应法术位${isExplorationSpell ? '，探索施法不消费战斗行动资源' : '和施法行动资源'}。不要添加通用伤害或状态行。`
                            : isWish
                              ? `Host 已校验祈愿术的 9 环法术位、言语成分、用途边界以及玩家的完整声明。DM 应按下方声明裁定结果；批准后系统会消费 9 环法术位${isExplorationSpell ? '，探索施法不消费战斗行动资源' : '和施法行动资源'}。复制 8 环或更低法术不会触发祈愿压力；其余用途必须在备注中记录压力结算。`
                            : `该法术不会进入完整 Headless 效果推导。Host 已校验 V/S/M 与特殊材料；批准后系统原子消费材料与对应法术位${isExplorationSpell ? '，探索施法不消费战斗行动资源' : '，并消费施法行动资源'}。目标、伤害、治疗、状态、专注与持续效果由 DM 决定，下列最终效果只有在 DM 明确填写并提交后才会应用。`
                          : '数值应填写完成命中、豁免、抗性、易伤等裁定后的最终值。玩家请求中不含效果；下列内容由 DM 提交后才进入 Headless。'}
                  </div>
                  {sharedDmAdjudicationPrompt.payload.contextKind === 'map-interaction' && (
                    <div className="grid gap-3 rounded-xl border border-violet-400/15 bg-violet-500/[0.04] p-3 sm:grid-cols-2">
                      <label className="text-xs text-violet-100">
                        裁定 DC
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={dmAdjudicationDc}
                          onChange={(event) => setDmAdjudicationDc(event.target.value)}
                          disabled={sharedDmAdjudicationPrompt.payload.proposedDc == null}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200 disabled:opacity-40"
                        />
                      </label>
                      <label className="text-xs text-violet-100">
                        结果处理
                        <select
                          value={dmAdjudicationMapOverride}
                          onChange={(event) => setDmAdjudicationMapOverride(event.target.value as typeof dmAdjudicationMapOverride)}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                        >
                          <option value="roll">按 Headless 骰值结算</option>
                          <option value="success">直接判定成功</option>
                          <option value="failure">直接判定失败</option>
                        </select>
                      </label>
                    </div>
                  )}
                  {sharedDmAdjudicationPrompt.payload.proposedSaveSuccess != null && (
                    <label className="block rounded-xl border border-violet-400/15 bg-violet-500/[0.04] p-3 text-xs text-violet-100">
                      豁免结果调整
                      <select
                        value={dmAdjudicationSaveOverride}
                        onChange={(event) => {
                          const nextSaveOverride = event.target.value as PersistentAreaSaveOverride
                          setDmAdjudicationEffects((current) =>
                            projectPersistentAreaAdjudicationEffectsForSaveOverride({
                              effects: current,
                              targetTokenId: sharedDmAdjudicationPrompt.payload.targetTokenId,
                              currentSaveOverride: dmAdjudicationSaveOverride,
                              nextSaveOverride,
                              proposedDamage: sharedDmAdjudicationPrompt.payload.proposedDamage,
                              proposedDamageOnSaveSuccess: sharedDmAdjudicationPrompt.payload.proposedDamageOnSaveSuccess,
                              proposedDamageOnSaveFailure: sharedDmAdjudicationPrompt.payload.proposedDamageOnSaveFailure,
                            }),
                          )
                          setDmAdjudicationSaveOverride(nextSaveOverride)
                        }}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                      >
                        <option value="unchanged">保持自动结果（{sharedDmAdjudicationPrompt.payload.proposedSaveSuccess ? '成功' : '失败'}）</option>
                        <option value="success">改为成功</option>
                        <option value="failure">改为失败</option>
                      </select>
                    </label>
                  )}
                  {isAnimalMessenger && sharedDmAdjudicationPrompt.payload.animalMessenger && (
                    <div className="space-y-3 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-3 text-xs text-emerald-50">
                      <div>
                        <p className="font-semibold">动物信使声明</p>
                        <p className="mt-1 text-emerald-100/75">
                          目标：{sharedDmAdjudicationPrompt.payload.animalMessenger.targetName}（{animalMessengerTarget && dnd5eAnimalMessengerTargetUsesFlight(animalMessengerTarget) ? '飞行信使，50 里/24 小时' : '非飞行信使，25 里/24 小时'}）
                        </p>
                        <p className="mt-1 text-emerald-100/75">
                          目的地：{sharedDmAdjudicationPrompt.payload.animalMessenger.destination}
                        </p>
                        <p className="mt-1 text-emerald-100/75">
                          收信者：{sharedDmAdjudicationPrompt.payload.animalMessenger.recipientDescription}
                        </p>
                        <blockquote className="mt-2 whitespace-pre-wrap rounded-lg border border-emerald-300/15 bg-black/20 px-3 py-2 leading-5">
                          “{sharedDmAdjudicationPrompt.payload.animalMessenger.message}”
                        </blockquote>
                        <p className="mt-1 text-[10px] text-emerald-100/55">
                          {dnd5eAnimalMessengerMessageWordCount(sharedDmAdjudicationPrompt.payload.animalMessenger.message)} / 25 词
                        </p>
                      </div>
                      <div className="rounded-lg border border-emerald-300/15 bg-black/20 px-3 py-2 leading-5">
                        本次持续 {animalMessengerDurationHours} 小时；理论最大里程 {animalMessengerTravelCapacityMiles} 里。声明路线 {sharedDmAdjudicationPrompt.payload.animalMessenger.routeDistanceMiles} 里，
                        {sharedDmAdjudicationPrompt.payload.animalMessenger.routeDistanceMiles <= animalMessengerTravelCapacityMiles
                          ? '里程上可在持续时间内抵达。'
                          : '里程上无法在持续时间内抵达；结束时讯息遗失，野兽返回施法地点。'}
                      </div>
                      <label className="flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-500/[0.06] px-3 py-2 text-amber-100">
                        <input
                          aria-label="确认动物信使目标可见"
                          type="checkbox"
                          checked={activeAnimalMessengerDraft.targetVisibleConfirmed}
                          onChange={(event) => setAnimalMessengerDraft({
                            ...activeAnimalMessengerDraft,
                            targetVisibleConfirmed: event.target.checked,
                          })}
                        />
                        <span>我确认施法者当前能看见这只微型野兽。</span>
                      </label>
                      <label className="flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-500/[0.06] px-3 py-2 text-amber-100">
                        <input
                          aria-label="确认动物信使目的地曾到访"
                          type="checkbox"
                          checked={activeAnimalMessengerDraft.destinationPreviouslyVisitedConfirmed}
                          onChange={(event) => setAnimalMessengerDraft({
                            ...activeAnimalMessengerDraft,
                            destinationPreviouslyVisitedConfirmed: event.target.checked,
                          })}
                        />
                        <span>我确认施法者曾亲自到访该目的地。</span>
                      </label>
                    </div>
                  )}
                  {isAnimateDead && sharedDmAdjudicationPrompt.payload.animateDead && (() => {
                    const declaration = sharedDmAdjudicationPrompt.payload.animateDead
                    const kindLabel = declaration.undeadKind === 'ghoul' ? '食尸鬼' :
                      declaration.undeadKind === 'ghast' ? '尸妖' :
                        declaration.undeadKind === 'wight' ? '尸鬼' :
                          declaration.undeadKind === 'mummy' ? '木乃伊' : undefined
                    const capacity = isCreateUndead && declaration.undeadKind
                      ? dnd5eCreateUndeadCapacity(sharedDmAdjudicationPrompt.payload.slotLevel, declaration.undeadKind)
                      : declaration.mode === 'animate'
                        ? dnd5eAnimateDeadAnimationCapacity(sharedDmAdjudicationPrompt.payload.slotLevel)
                        : dnd5eAnimateDeadReassertionCapacity(sharedDmAdjudicationPrompt.payload.slotLevel)
                    return (
                      <div className="space-y-3 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] p-3 text-xs text-rose-50" data-testid="animate-dead-declaration-card">
                        <div>
                          <p className="font-semibold">{isCreateUndead ? '唤起死灵' : '操纵死尸'}：{declaration.mode === 'animate' ? '活化遗骸' : '重新确立控制'}</p>
                          <p className="mt-1 text-rose-100/75">
                            {sharedDmAdjudicationPrompt.payload.slotLevel} 环{kindLabel ? `“${kindLabel}”` : ''}上限：{capacity} 个；本次选择 {declaration.targets.length} 个。
                          </p>
                          <ol className="mt-2 space-y-1 rounded-lg border border-rose-300/15 bg-black/20 px-3 py-2">
                            {declaration.targets.map((target, index) => (
                              <li key={target.tokenId}>
                                {index + 1}. {target.targetName}{declaration.mode === 'animate'
                                  ? `（${isCreateUndead ? `小型／中型类人生物尸体 → ${kindLabel}` : target.remainsKind === 'bone-pile' ? '骨骸堆 → 骷髅' : '小型／中型类人生物尸体 → 僵尸'}）`
                                  : '（重置控制期限为 24 小时）'}
                              </li>
                            ))}
                          </ol>
                          <p className="mt-2 text-rose-100/70">Host 已复核：每个目标身份不重复、仍位于地图上，且与施法者相距不超过 10 尺。</p>
                        </div>
                        <label className="flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-500/[0.06] px-3 py-2 text-amber-100">
                          <input
                            aria-label={`确认${isCreateUndead ? '唤起死灵' : '操纵死尸'}目标与转换`}
                            type="checkbox"
                            checked={activeAnimateDeadConfirmed}
                            onChange={(event) => setAnimateDeadDraft({
                              promptId: sharedDmAdjudicationPrompt.id,
                              confirmed: event.target.checked,
                            })}
                          />
                          <span>我确认以上遗骸转换／重新控制计划。批准后系统将原子替换地图实体、消费对应环位，并建立 24 小时控制期限；若遗骸原格已被占用，则使用最近的合法相邻格。</span>
                        </label>
                        <p className="text-[10px] text-rose-100/60">{isCreateUndead ? '唤起死灵不造成伤害；8／9 环还可选择不同亡灵类型，各类型使用正文规定的独立数量上限。' : '操纵死尸不造成伤害；升环只增加可活化或重新控制的目标数量。'}</p>
                      </div>
                    )
                  })()}
                  {isAnimateObjects && sharedDmAdjudicationPrompt.payload.animateObjects && (() => {
                    const declaration = sharedDmAdjudicationPrompt.payload.animateObjects
                    const targets = declaration.targets.flatMap((declared) => {
                      const token = tokens.find((candidate) => candidate.id === declared.tokenId)
                      const profile = token ? dnd5eAnimateObjectsProfile(token) : undefined
                      return token && profile ? [{ declared, token, profile }] : []
                    })
                    const capacity = dnd5eAnimateObjectsCapacity(sharedDmAdjudicationPrompt.payload.slotLevel)
                    const used = dnd5eAnimateObjectsCapacityUsed(targets.map((entry) => entry.token))
                    return (
                      <div className="space-y-3 rounded-xl border border-violet-400/25 bg-violet-500/[0.07] p-3 text-xs text-violet-50" data-testid="animate-objects-declaration-card">
                        <div>
                          <p className="font-semibold">活化物件：目标与构装体数据</p>
                          <p className="mt-1 text-violet-100/75">{sharedDmAdjudicationPrompt.payload.slotLevel} 环容量：{capacity}；本次使用 {used}，选择 {targets.length} 个物件。</p>
                          <ol className="mt-2 space-y-2 rounded-lg border border-violet-300/15 bg-black/20 px-3 py-2">
                            {targets.map(({ declared, profile }, index) => (
                              <li key={declared.tokenId}>
                                <strong>{index + 1}. {declared.targetName}</strong> · {profile.sizeLabel}（计 {profile.capacityCost}） · AC {profile.armorClass} · HP {profile.hitPoints} · 命中 +{profile.attackBonus} · {profile.damageDice.count}d{profile.damageDice.sides}+{profile.damageDice.bonus} {profile.damageType === 'piercing' ? '穿刺' : profile.damageType === 'slashing' ? '挥砍' : '钝击'} · {profile.mobility === 'walk' ? '步行 30 尺' : profile.mobility === 'fly-hover' ? '飞行 30 尺并悬停' : '速度 0'}
                              </li>
                            ))}
                          </ol>
                          <p className="mt-2 text-violet-100/70">全部构装体具有体质 10、智力/感知 3、魅力 1、30 尺盲视且无法看见盲视范围外；攻击触及 5 尺。Host 已复核目标在 120 尺内、非魔法、无人穿戴/携带且不是巨型。</p>
                        </div>
                        <label className="flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-500/[0.06] px-3 py-2 text-amber-100">
                          <input
                            aria-label="确认活化物件目标与构装体数据"
                            type="checkbox"
                            checked={activeAnimateObjectsConfirmed}
                            onChange={(event) => setAnimateObjectsDraft({
                              promptId: sharedDmAdjudicationPrompt.id,
                              confirmed: event.target.checked,
                            })}
                          />
                          <span>我确认以上体型容量和数据。批准后系统将原子替换地图物件、消费环位并建立固定 10 轮专注；专注结束或构装体降至 0 HP 时恢复原物件。</span>
                        </label>
                        <p className="text-[10px] text-violet-100/60">升环每高于 5 环一级只增加 2 点物件容量；不会增加单个物件的伤害、命中、AC 或 HP。</p>
                      </div>
                    )
                  })()}
                  {isCreation && sharedDmAdjudicationPrompt.payload.creation && (() => {
                    const declaration = sharedDmAdjudicationPrompt.payload.creation
                    const durationMinutes = dnd5eCreationDurationMinutes(declaration.materials)
                    return (
                      <div className="space-y-2 rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/[0.07] p-3 text-xs text-fuchsia-50" data-testid="creation-declaration-card">
                        <p className="font-semibold">造物术：生成临时地图物件</p>
                        <p>物件：{declaration.objectDescription}</p>
                        <p>材质：{declaration.materials.map((material) => DND5E_CREATION_MATERIAL_LABELS[material]).join('、')}</p>
                        <p>持续：{durationMinutes} 分钟；混合材质已按最短持续时间结算。</p>
                        <p>尺寸：{declaration.edgeFeet} 尺立方边长；{sharedDmAdjudicationPrompt.payload.slotLevel} 环上限 {dnd5eCreationMaximumEdgeFeet(sharedDmAdjudicationPrompt.payload.slotLevel)} 尺。</p>
                        <p>落点：地图格（{declaration.targetCell.col}, {declaration.targetCell.row}），Host 已复核在 30 尺内且完整占地没有越界。</p>
                        <p className="rounded-lg border border-amber-300/20 bg-amber-500/[0.06] px-3 py-2 text-amber-100">批准即确认物件形态与材质均为施法者见过的类型。系统会消费环位、推进 1 分钟施法时间并生成物件；物件不能作为其他法术的材料成分，造物术不造成伤害。</p>
                      </div>
                    )
                  })()}
                  {isCreateOrDestroyWater && sharedDmAdjudicationPrompt.payload.createOrDestroyWater && (() => {
                    const declaration = sharedDmAdjudicationPrompt.payload.createOrDestroyWater
                    const containerMode = declaration.mode === 'create-container' || declaration.mode === 'destroy-container'
                    return (
                      <div className="space-y-2 rounded-xl border border-cyan-400/25 bg-cyan-500/[0.07] p-3 text-xs text-cyan-50" data-testid="create-or-destroy-water-declaration-card">
                        <p className="font-semibold">造水／枯水术：{DND5E_CREATE_OR_DESTROY_WATER_MODE_LABELS[declaration.mode]}</p>
                        {containerMode ? <>
                          <p>容器：{declaration.targetObjectName}</p>
                          <p>水量：{declaration.gallons} 加仑；{sharedDmAdjudicationPrompt.payload.slotLevel} 环上限 {dnd5eCreateOrDestroyWaterMaximumGallons(sharedDmAdjudicationPrompt.payload.slotLevel)} 加仑。</p>
                          <p>目标格：（{declaration.targetCell.col}, {declaration.targetCell.row}）；Host 已复核容器敞开、30 尺射程、容量与当前水量。</p>
                        </> : <>
                          <p>区域：{declaration.areaEdgeFeet} 尺立方；{sharedDmAdjudicationPrompt.payload.slotLevel} 环规则边长 {dnd5eCreateOrDestroyWaterCubeEdgeFeet(sharedDmAdjudicationPrompt.payload.slotLevel)} 尺。</p>
                          <p>起始格：（{declaration.targetCell.col}, {declaration.targetCell.row}）；Host 已复核 30 尺射程和完整地图边界。</p>
                          {declaration.mode === 'destroy-fog'
                            ? <p>重叠云雾术区域：{declaration.fogAreaIds?.length ?? 0} 个；批准后原子移除。</p>
                            : <p>批准后即时降雨；立即法术不会错误留下持续区域。</p>}
                        </>}
                        <p className="rounded-lg border border-amber-300/20 bg-amber-500/[0.06] px-3 py-2 text-amber-100">批准后系统只结算所声明的水量或雾区并消费对应环位；本法术不造成伤害，升环只增加水量上限或立方边长。</p>
                      </div>
                    )
                  })()}
                  {isSending && sharedDmAdjudicationPrompt.payload.sending && (
                    <div className="space-y-3 rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-3 text-xs text-violet-50">
                      <div>
                        <p className="font-semibold">短讯术声明</p>
                        <p className="mt-1 text-violet-100/70">
                          熟悉的生物：{sharedDmAdjudicationPrompt.payload.sending.recipientName}
                        </p>
                        <blockquote className="mt-2 whitespace-pre-wrap rounded-lg border border-violet-300/15 bg-black/20 px-3 py-2 leading-5">
                          “{sharedDmAdjudicationPrompt.payload.sending.message}”
                        </blockquote>
                        <p className="mt-1 text-[10px] text-violet-100/55">
                          {dnd5eSendingMessageWordCount(sharedDmAdjudicationPrompt.payload.sending.message)} / 25 词
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label>
                          目标智力
                          <select
                            aria-label="短讯术目标智力"
                            value={activeSendingDraft.targetIntelligenceAtLeastOne ? 'one-or-more' : 'zero'}
                            onChange={(event) => updateSendingDraft({
                              targetIntelligenceAtLeastOne: event.target.value === 'one-or-more',
                              ...(event.target.value === 'zero' ? { reply: '' } : {}),
                            })}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                          >
                            <option value="one-or-more">至少 1（理解含义）</option>
                            <option value="zero">0（无法理解含义）</option>
                          </select>
                        </label>
                        <label>
                          目标所在位面
                          <select
                            aria-label="短讯术目标所在位面"
                            value={activeSendingDraft.plane}
                            onChange={(event) => updateSendingDraft({
                              plane: event.target.value as 'same' | 'different',
                              crossPlaneRoll: '',
                              reply: '',
                            })}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                          >
                            <option value="same">同一位面（必定送达）</option>
                            <option value="different">不同位面（5% 失败）</option>
                          </select>
                        </label>
                      </div>
                      {activeSendingDraft.plane === 'different' && (
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                          <label>
                            跨位面 d100 结果（1–5 失败）
                            <input
                              aria-label="短讯术跨位面 d100 结果"
                              type="number"
                              min={1}
                              max={100}
                              step={1}
                              value={activeSendingDraft.crossPlaneRoll}
                              onChange={(event) => updateSendingDraft({
                                crossPlaneRoll: event.target.value,
                                reply: Number(event.target.value) <= 5 ? '' : activeSendingDraft.reply,
                              })}
                              className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => updateSendingDraft({
                              crossPlaneRoll: String(Math.floor(Math.random() * 100) + 1),
                              reply: '',
                            })}
                            className="rounded-lg border border-violet-300/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/20"
                          >
                            掷 d100
                          </button>
                        </div>
                      )}
                      <p role="status" className={sendingResolution?.delivered ? 'text-emerald-300' : 'text-amber-300'}>
                        {activeSendingDraft.plane === 'different' && !sendingResolution
                          ? '请输入 1–100 的 d100 结果。'
                          : sendingResolution?.delivered
                            ? `讯息将送达；目标${sendingResolution.targetIntelligenceAtLeastOne ? '理解含义并认出熟悉的施法者' : '听见讯息但无法理解含义'}。`
                            : 'd100 为 1–5：本次跨位面联络失败，但法术位仍会消费。'}
                      </p>
                      <label className="block">
                        目标即时回应（可选，最多 25 词）
                        <textarea
                          aria-label="短讯术目标即时回应"
                          value={activeSendingDraft.reply}
                          maxLength={250}
                          disabled={!sendingDelivered || !activeSendingDraft.targetIntelligenceAtLeastOne}
                          onChange={(event) => updateSendingDraft({ reply: event.target.value })}
                          rows={2}
                          className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-xs text-slate-200 disabled:opacity-40"
                          placeholder="目标可以立即以相同方式回应。"
                        />
                        <span className="mt-1 block text-[10px] text-violet-100/55">
                          {dnd5eSendingMessageWordCount(activeSendingDraft.reply)} / 25 词
                        </span>
                      </label>
                    </div>
                  )}
                  {isSequester && sharedDmAdjudicationPrompt.payload.sequester && (
                    <div className="space-y-3 rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-3 text-xs text-violet-50">
                      <div>
                        <p className="font-semibold">隔离术声明</p>
                        <p className="mt-1 text-violet-100/75">
                          目标：{sharedDmAdjudicationPrompt.payload.sequester.targetName}（{sharedDmAdjudicationPrompt.payload.sequester.targetKind === 'creature' ? '生物' : '地图物件'}）
                        </p>
                        <p className="mt-1 text-violet-100/75">Host 已复核：目标仍在地图上、类型匹配，且与施法者相距不超过 5 尺。</p>
                        <p className="mt-2 rounded-lg border border-violet-300/15 bg-black/20 px-3 py-2 leading-5">
                          提前结束条件：{sharedDmAdjudicationPrompt.payload.sequester.endingCondition ?? '未设置'}
                        </p>
                      </div>
                      {sharedDmAdjudicationPrompt.payload.sequester.targetKind === 'creature' ? (
                        <label className="flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-500/[0.06] px-3 py-2 text-amber-100">
                          <input
                            aria-label="确认隔离术目标自愿"
                            type="checkbox"
                            checked={activeSequesterWilling}
                            onChange={(event) => setSequesterWillingDraft({
                              promptId: sharedDmAdjudicationPrompt.id,
                              confirmed: event.target.checked,
                            })}
                          />
                          <span>我确认该生物自愿。批准后将自动施加永久假死：隐形、速度 0、不能行动、免疫预言学派指定；受到任意伤害时自动解除。</span>
                        </label>
                      ) : (
                        <p className="rounded-lg border border-emerald-300/20 bg-emerald-500/[0.05] px-3 py-2 text-emerald-100">
                          物体无需确认自愿。批准后会写入地图物件权威隔离状态；DM 可在物件详情中按“条件发生／物件受伤”结束。
                        </p>
                      )}
                      <p className="text-[10px] text-violet-100/60">隔离术没有升环增强；更高环位不会增加伤害、目标数或持续时间。</p>
                    </div>
                  )}
                  {isWordOfRecall && sharedDmAdjudicationPrompt.payload.wordOfRecall && sharedDmAdjudicationPrompt.payload.wordOfRecallSanctuary && (() => {
                    const declaration = sharedDmAdjudicationPrompt.payload.wordOfRecall
                    const sanctuary = sharedDmAdjudicationPrompt.payload.wordOfRecallSanctuary
                    return (
                      <div className="space-y-3 rounded-xl border border-cyan-400/25 bg-cyan-500/[0.06] p-3 text-xs text-cyan-50" data-testid="word-of-recall-declaration-card">
                        <div>
                          <p className="font-semibold">回返真言：{declaration.mode === 'designate-sanctuary' ? '指定圣所' : '召回至圣所'}</p>
                          <div className="mt-2 space-y-1 rounded-lg border border-cyan-300/15 bg-black/20 px-3 py-2">
                            <p>圣所：{sanctuary.sanctuaryName}</p>
                            <p>地图：{sanctuary.mapName}（{sanctuary.mapId}）</p>
                            <p>权威位置：X {Math.round(sanctuary.x)}，Y {Math.round(sanctuary.y)}，海拔 {sanctuary.elevationFeet} 尺</p>
                            <p>与神祇的联系：{sanctuary.deityConnection}</p>
                          </div>
                          {declaration.mode === 'recall' && (
                            <p className="mt-2 text-cyan-100/75">
                              同行自愿生物（{declaration.targets.length}/5）：{declaration.targets.length > 0
                                ? declaration.targets.map((target) => target.name).join('、')
                                : '无；仅传送施法者'}。Host 已复核这些 Token 位于施法者 5 尺内。
                            </p>
                          )}
                        </div>
                        <label className="flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-500/[0.06] px-3 py-2 text-amber-100">
                          <input
                            aria-label={declaration.mode === 'designate-sanctuary' ? '确认回返真言地点与神祇紧密相连' : '确认回返真言同行生物全部自愿'}
                            type="checkbox"
                            checked={activeWordOfRecallConfirmation}
                            onChange={(event) => setWordOfRecallConfirmationDraft({
                              promptId: sharedDmAdjudicationPrompt.id,
                              confirmed: event.target.checked,
                            })}
                          />
                          <span>{declaration.mode === 'designate-sanctuary'
                            ? '我确认当前位置奉献给施法者的神祇，或与该神祇有紧密联系；批准后把这个精确地图位置保存为唯一圣所。'
                            : '我确认全部列出的同行生物自愿；批准后施法者与这些生物会出现在圣所及其最近的未占据空间。'}</span>
                        </label>
                        <p className="text-[10px] text-cyan-100/60">回返真言没有升环增强；更高环位不会增加同行人数、范围、伤害或其他效果。</p>
                      </div>
                    )
                  })()}
                  {isWish && sharedDmAdjudicationPrompt.payload.wish && (() => {
                    const wish = sharedDmAdjudicationPrompt.payload.wish
                    const modeLabel = wish.mode === 'duplicate-spell' ? '复制 8 环或更低法术' :
                      wish.mode === 'create-object' ? '创造非魔法物品' :
                      wish.mode === 'heal-and-restore' ? '完全治疗并复原' :
                      wish.mode === 'grant-resistance' ? '永久伤害抗性' :
                      wish.mode === 'grant-immunity' ? '8 小时法术／魔法效果免疫' :
                      wish.mode === 'reroll-last-round' ? '重掷上一轮的一次掷骰' :
                      '开放式愿望'
                    const targets = 'targets' in wish ? wish.targets : []
                    return (
                      <div className="space-y-3 rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/[0.07] p-3 text-xs text-fuchsia-50" data-testid="wish-declaration-card">
                        <div>
                          <p className="font-semibold">祈愿术声明：{modeLabel}</p>
                          {wish.mode === 'duplicate-spell' && (
                            <p className="mt-2 rounded-lg border border-emerald-300/20 bg-emerald-500/[0.06] px-3 py-2 text-emerald-100">
                              复制：{wish.spellName}（{wish.spellLevel} 环，规则 ID：{wish.spellId}）。忽略该法术全部施法要求；此用途不触发祈愿压力。
                            </p>
                          )}
                          {wish.mode === 'create-object' && (
                            <div className="mt-2 space-y-1 rounded-lg border border-fuchsia-300/15 bg-black/20 px-3 py-2">
                              <p>物品：{wish.objectDescription}</p>
                              <p>价值：{wish.valueGp.toLocaleString()} gp；最大尺寸：{wish.maximumDimensionFeet} 尺</p>
                              <p>出现位置：{wish.placementDescription}</p>
                            </div>
                          )}
                          {targets.length > 0 && (
                            <div className="mt-2 rounded-lg border border-fuchsia-300/15 bg-black/20 px-3 py-2">
                              <p>目标（{targets.length}）：{targets.map((target) => target.name).join('、')}</p>
                            </div>
                          )}
                          {wish.mode === 'heal-and-restore' && (
                            <p className="mt-2 text-fuchsia-100/75">这些目标恢复全部生命值，并结束所有可由高等复原术移除的效果。</p>
                          )}
                          {wish.mode === 'grant-resistance' && (
                            <p className="mt-2 text-fuchsia-100/75">永久抗性：{DND5E_DAMAGE_TYPE_LABELS[wish.damageType]}伤害。</p>
                          )}
                          {wish.mode === 'grant-immunity' && (
                            <p className="mt-2 text-fuchsia-100/75">8 小时免疫：{wish.namedEffect}</p>
                          )}
                          {wish.mode === 'reroll-last-round' && (
                            <div className="mt-2 space-y-1 rounded-lg border border-fuchsia-300/15 bg-black/20 px-3 py-2">
                              <p>掷骰：{wish.rollDescription}</p>
                              <p>重掷方式：{wish.rollMode === 'advantage' ? '优势' : '劣势'}；DM 决定采用原结果或新结果。</p>
                            </div>
                          )}
                          {wish.mode === 'open-ended' && (
                            <blockquote className="mt-2 whitespace-pre-wrap rounded-lg border border-fuchsia-300/15 bg-black/20 px-3 py-2 leading-5">
                              “{wish.exactWish}”
                            </blockquote>
                          )}
                        </div>
                        {wish.mode !== 'duplicate-spell' && (
                          <div className="rounded-lg border border-amber-300/25 bg-amber-500/[0.08] px-3 py-2 text-amber-100">
                            该用途触发祈愿压力：力量降为 3，持续 2d4 天；长休前每次施放法术承受每法术环级 1d10 黯蚀伤害；并有 33% 几率永久失去祈愿术。请在备注中记录骰值与后续状态。
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  {isMonsterLegendaryAction && monsterSpellOptions.length > 0 && (
                    <div className="grid gap-3 rounded-xl border border-sky-400/15 bg-sky-500/[0.04] p-3 sm:grid-cols-2">
                      <label className="text-xs text-sky-100">
                        施展法术
                        <select
                          value={selectedMonsterSpell?.spellId ?? ''}
                          onChange={(event) => {
                            const spell = monsterSpellOptions.find((entry) => entry.spellId === event.target.value)
                            if (!spell) return
                            setMonsterSpellSelection({
                              promptId: sharedDmAdjudicationPrompt.id,
                              spellId: spell.spellId,
                              slotLevel: spell.availableSlotLevels[0] ?? spell.level,
                            })
                          }}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                        >
                          {monsterSpellOptions.map((spell) => (
                            <option key={spell.spellId} value={spell.spellId}>
                              {spell.spellName} · {spell.level === 0 ? '戏法' : `${spell.level} 环`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-sky-100">
                        使用资源
                        <select
                          value={selectedMonsterSpellSlotLevel}
                          onChange={(event) => {
                            if (!selectedMonsterSpell) return
                            setMonsterSpellSelection({
                              promptId: sharedDmAdjudicationPrompt.id,
                              spellId: selectedMonsterSpell.spellId,
                              slotLevel: Number(event.target.value),
                            })
                          }}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                        >
                          {(selectedMonsterSpell?.availableSlotLevels ?? []).map((slotLevel) => (
                            <option key={slotLevel} value={slotLevel}>
                              {selectedMonsterSpell?.resourceLabels[String(slotLevel)] ??
                                (slotLevel === 0 ? '随意施法' : `${slotLevel} 环`) }
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                  {isMonsterLegendaryAction && requiresMonsterSpellSelection && monsterSpellOptions.length === 0 && (
                    <p className="rounded-xl border border-rose-400/20 bg-rose-500/[0.06] p-3 text-xs text-rose-200">
                      当前没有仍可消耗资源的已准备法术；该传奇动作不能批准。
                    </p>
                  )}
                  {supportsDirectEffects && dmAdjudicationEffects.map((effect, index) => (
                    <div key={effect.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold text-slate-300">效果 {index + 1}</h4>
                        <button
                          type="button"
                          onClick={() => setDmAdjudicationEffects((current) => current.filter((entry) => entry.id !== effect.id))}
                          className="rounded-md px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                        >
                          删除
                        </button>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <label className="text-[11px] text-slate-400">
                          目标
                          <select
                            value={effect.targetTokenId}
                            onChange={(event) => setDmAdjudicationEffects((current) => current.map((entry) =>
                              entry.id === effect.id ? { ...entry, targetTokenId: event.target.value } : entry,
                            ))}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                          >
                            <option value="">选择地图单位</option>
                            {tokens.filter((token) => token.type !== 'obstacle').map((token) => (
                              <option key={token.id} value={token.id}>{token.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-[11px] text-slate-400">
                          HP 操作
                          <select
                            value={effect.operation}
                            onChange={(event) => setDmAdjudicationEffects((current) => current.map((entry) =>
                              entry.id === effect.id
                                ? { ...entry, operation: event.target.value as DmAdjudicationEffectDraft['operation'] }
                                : entry,
                            ))}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                          >
                            <option value="">无 HP 变化</option>
                            <option value="damage">最终伤害</option>
                            <option value="healing">治疗</option>
                            <option value="temporary-hit-points">临时 HP</option>
                          </select>
                        </label>
                        <label className="text-[11px] text-slate-400">
                          {effect.operation === 'damage' && effect.damageType ? '抗性前伤害' : '最终数值'}
                          <input
                            type="number"
                            min={0}
                            max={1_000_000}
                            step={1}
                            disabled={!effect.operation}
                            value={effect.amount}
                            onChange={(event) => setDmAdjudicationEffects((current) => current.map((entry) =>
                              entry.id === effect.id ? { ...entry, amount: event.target.value } : entry,
                            ))}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200 disabled:opacity-40"
                          />
                        </label>
                        <label className="text-[11px] text-slate-400">
                          伤害类型
                          <select
                            aria-label="伤害类型"
                            disabled={effect.operation !== 'damage'}
                            value={effect.damageType ?? ''}
                            onChange={(event) => setDmAdjudicationEffects((current) => current.map((entry) =>
                              entry.id === effect.id
                                ? { ...entry, damageType: event.target.value as '' | Dnd5eDamageType }
                                : entry,
                            ))}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200 disabled:opacity-40"
                          >
                            <option value="">无／数值已含抗性</option>
                            {DND5E_DAMAGE_TYPES.map((damageType) => (
                              <option key={damageType} value={damageType}>{DND5E_DAMAGE_TYPE_LABELS[damageType]}</option>
                            ))}
                          </select>
                          <span className="mt-1 block text-[10px] text-slate-500">
                            选择类型后，Host 会自动应用免疫、抗性与易伤。
                          </span>
                        </label>
                        <label className="text-[11px] text-slate-400">
                          添加状态（可选）
                          <input
                            value={effect.addCondition}
                            maxLength={80}
                            onChange={(event) => setDmAdjudicationEffects((current) => current.map((entry) =>
                              entry.id === effect.id ? { ...entry, addCondition: event.target.value } : entry,
                            ))}
                            placeholder="例如：倒地"
                            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                          />
                        </label>
                        {isSpellAdjudication && <label className="text-[11px] text-slate-400">
                          状态持续轮数（可选）
                          <input
                            type="number"
                            min={1}
                            max={14_400}
                            step={1}
                            disabled={!effect.addCondition.trim()}
                            value={effect.conditionDurationRounds}
                            onChange={(event) => setDmAdjudicationEffects((current) => current.map((entry) =>
                              entry.id === effect.id ? { ...entry, conditionDurationRounds: event.target.value } : entry,
                            ))}
                            placeholder={sharedDmAdjudicationPrompt.payload.concentration && dmAdjudicationConcentrationRounds
                              ? '留空则跟随本次专注'
                              : '留空则永久'}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200 disabled:opacity-40"
                          />
                          <span className="mt-1 block text-[10px] text-slate-500">
                            {sharedDmAdjudicationPrompt.payload.concentration && dmAdjudicationConcentrationRounds
                              ? '留空时状态会随本次专注结束；填写轮数则建立独立计时。'
                              : '1 分钟 = 10 轮；1 小时 = 600 轮。'}
                          </span>
                        </label>}
                        {isSpellAdjudication && <label className="text-[11px] text-slate-400">
                          持续时间递减时点
                          <select
                            disabled={!effect.addCondition.trim() || !effect.conditionDurationRounds}
                            value={effect.conditionDurationTickOn}
                            onChange={(event) => setDmAdjudicationEffects((current) => current.map((entry) =>
                              entry.id === effect.id
                                ? {
                                    ...entry,
                                    conditionDurationTickOn: event.target.value as DmAdjudicationEffectDraft['conditionDurationTickOn'],
                                  }
                                : entry,
                            ))}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200 disabled:opacity-40"
                          >
                            <option value="target-turn-end">目标回合结束</option>
                            <option value="target-turn-start">目标回合开始</option>
                            <option value="source-turn-end">来源回合结束</option>
                            <option value="source-turn-start">来源回合开始</option>
                          </select>
                        </label>}
                        <label className="text-[11px] text-slate-400 sm:col-span-2">
                          移除状态（可选）
                          <input
                            value={effect.removeCondition}
                            maxLength={80}
                            onChange={(event) => setDmAdjudicationEffects((current) => current.map((entry) =>
                              entry.id === effect.id ? { ...entry, removeCondition: event.target.value } : entry,
                            ))}
                            placeholder="必须与当前状态名称一致"
                            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                  {supportsDirectEffects && <button
                    type="button"
                    onClick={() => setDmAdjudicationEffects((current) => [...current, newDmAdjudicationEffectDraft()])}
                    className="w-full rounded-lg border border-dashed border-amber-400/25 bg-amber-500/[0.04] px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/10"
                  >
                    ＋ 添加目标效果
                  </button>}
                  {isSpeakWithPlants && (
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-3">
                      <h4 className="text-xs font-semibold text-emerald-100">植物地形结算（可选）</h4>
                      <p className="mt-1 text-[10px] text-emerald-100/60">
                        选择 30 尺内由植物生成的权威持续区域；Host 会实际更新地图移动成本。10 分钟结束时仍需由 DM 恢复原地形。
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <label className="text-[11px] text-slate-400">
                          植物区域
                          <select
                            aria-label="植物区域"
                            value={activePlantTerrainDraft.areaId}
                            onChange={(event) => updatePlantTerrainDraft({ areaId: event.target.value })}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                          >
                            <option value="">不调整地形</option>
                            {plantTerrainAreas.map((area) => (
                              <option key={area.id} value={area.id}>
                                {area.label}（{area.cells.length} 格）
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-[11px] text-slate-400">
                          地形结果
                          <select
                            aria-label="地形结果"
                            disabled={!activePlantTerrainDraft.areaId}
                            value={activePlantTerrainDraft.mode}
                            onChange={(event) => updatePlantTerrainDraft({
                              mode: event.target.value as typeof activePlantTerrainDraft.mode,
                            })}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200 disabled:opacity-40"
                          >
                            <option value="">选择结果</option>
                            <option value="ordinary">变为普通地形</option>
                            <option value="difficult">变为困难地形</option>
                          </select>
                        </label>
                      </div>
                      {plantTerrainAreas.length === 0 && (
                        <p className="mt-2 text-[10px] text-amber-200">当前地图没有可结算的植物持续区域。</p>
                      )}
                    </div>
                  )}
                  {sharedDmAdjudicationPrompt.payload.concentration && !isAutomatedRitual && !isActivityBoundary && (
                    <label className="block rounded-xl border border-violet-400/15 bg-violet-500/[0.04] p-3 text-xs text-violet-100">
                      专注持续轮数
                      <input
                        type="number"
                        min={1}
                        max={14_400}
                        step={1}
                        value={isAnimateObjects ? '10' : dmAdjudicationConcentrationRounds}
                        disabled={isAnimateObjects}
                        onChange={(event) => setDmAdjudicationConcentrationRounds(event.target.value)}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                      />
                      <span className="mt-1 block text-[10px] text-violet-100/55">{isAnimateObjects ? '活化物件规则固定为 1 分钟（10 轮），不可由通用裁定修改。' : '留空则本次只记录裁定效果，不建立 Headless 专注状态。'}</span>
                    </label>
                  )}
                  <label className="block text-xs text-slate-400">
                    DM 裁定备注（可选）
                    <textarea
                      value={dmAdjudicationNote}
                      maxLength={2_000}
                      onChange={(event) => setDmAdjudicationNote(event.target.value)}
                      rows={3}
                      className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-xs text-slate-200"
                      placeholder="记录豁免、命中、抗性、持续时间或需要后续手动跟踪的效果。"
                    />
                  </label>
                </section>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-4">
              <button
                type="button"
                onClick={() => void handleSharedDmAdjudicationChoice(false)}
                className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
              >
                {sharedDmAdjudicationPrompt.payload.contextKind === 'persistent-area-trigger'
                  ? '跳过本次触发'
                  : sharedDmAdjudicationPrompt.payload.contextKind === 'map-interaction'
                    ? '拒绝交互'
                    : sharedDmAdjudicationPrompt.payload.contextKind === 'basic-action'
                      ? '驳回裁定（不返还）'
                    : isMonsterLegendaryAction
                      ? '取消传奇动作（不扣点）'
                    : isMonsterAction || isMonsterSpell
                      ? '取消（不消费资源）'
                    : isRandomTableAdjudication
                      ? '跳过该随机表结果'
                    : '取消施法（不消费）'}
              </button>
              <button
                type="button"
                data-testid="dm-adjudication-approve"
                disabled={
                  (isSending && !sendingResolution) ||
                  (isAnimalMessenger && (
                    !animalMessengerResolution ||
                    !animalMessengerResolution.targetVisibleConfirmed ||
                    !animalMessengerResolution.destinationPreviouslyVisitedConfirmed
                  )) ||
                  (isAnimateDead && (!animateDeadResolution || !animateDeadResolution.targetsConfirmed)) ||
                  (isAnimateObjects && (!animateObjectsResolution || !animateObjectsResolution.targetsConfirmed)) ||
                  (isSequester && (
                    !sequesterResolution ||
                    (sharedDmAdjudicationPrompt.payload.sequester?.targetKind === 'creature' &&
                      !sequesterResolution.willingCreatureConfirmed)
                  )) ||
                  (isWordOfRecall && (
                    !wordOfRecallResolution ||
                    (sharedDmAdjudicationPrompt.payload.wordOfRecall?.mode === 'designate-sanctuary'
                      ? !wordOfRecallResolution.sanctuaryConsecratedConfirmed
                      : !wordOfRecallResolution.willingCreaturesConfirmed)
                  )) ||
                  (requiresMonsterSpellSelection && monsterSpellOptions.length === 0) ||
                  (monsterSpellOptions.length > 0 && (
                    !selectedMonsterSpell ||
                    !selectedMonsterSpell.availableSlotLevels.includes(selectedMonsterSpellSlotLevel)
                  )) ||
                  (isSpeakWithPlants && !!activePlantTerrainDraft.areaId && !activePlantTerrainDraft.mode) ||
                  dmAdjudicationEffects.some((effect) =>
                    !effect.targetTokenId ||
                    (!effect.operation && !effect.addCondition.trim() && !effect.removeCondition.trim()) ||
                    (effect.operation && (!Number.isInteger(Number(effect.amount)) || Number(effect.amount) < 0)) ||
                    (effect.conditionDurationRounds !== '' && (
                      !Number.isInteger(Number(effect.conditionDurationRounds)) ||
                      Number(effect.conditionDurationRounds) < 1 ||
                      Number(effect.conditionDurationRounds) > 14_400 ||
                      !effect.addCondition.trim()
                    ))
                  )
                }
                onClick={() => void handleSharedDmAdjudicationChoice(
                  true,
                  selectedMonsterSpell
                    ? {
                        spellId: selectedMonsterSpell.spellId,
                        slotLevel: selectedMonsterSpellSlotLevel,
                      }
                    : undefined,
                  sendingResolution,
                  animalMessengerResolution,
                  animateDeadResolution,
                  animateObjectsResolution,
                  sequesterResolution,
                  wordOfRecallResolution,
                  isSpeakWithPlants && activePlantTerrainDraft.areaId && activePlantTerrainDraft.mode
                    ? [{
                        areaId: activePlantTerrainDraft.areaId,
                        movementCostMultiplier: activePlantTerrainDraft.mode === 'ordinary' ? 1 : 2,
                      }]
                    : undefined,
                )}
                className="rounded-lg bg-amber-500/25 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/35 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isBasicActionAdjudication
                  ? '确认裁定'
                  : isMonsterLegendaryAction
                    ? '确认裁定并扣点'
                  : isMonsterAction || isMonsterSpell
                    ? '确认裁定并消费资源'
                  : isRandomTableAdjudication
                    ? '提交裁定并继续'
                    : isAutomatedRitual
                      ? '确认仪式完成并执行 Headless 效果'
                    : '批准并提交 Headless 事务'}
              </button>
            </div>
          </div>
        </div>
    </>
  )
}
