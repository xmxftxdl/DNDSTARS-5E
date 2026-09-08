import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Shield, Footprints, HeartPulse, Sparkles, Trash2, Eye, Dices, PackageOpen, ArrowUp } from 'lucide-react'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { getEffectiveAc } from '../../lib/combatStats'
import Dnd5eConditionEditor, { Dnd5eConditionTags } from './Dnd5eConditionEditor'
import type { Dnd5eActiveEffectInstance } from '../../rulesets/dnd5e/activeEffects'
import { parseLiveHitPointDraft, resolveHitPointDisplay } from './characterHitPoints'
import { resolveMapTokenPortrait } from '../../lib/portraitPresentation'
import {
  closeCharacterDetailOnPrimaryPointerDown,
  shouldCloseCharacterDetailForKey,
} from './characterDetailClose'
import { showAppConfirm } from '../../lib/appDialog'
import type { ManualSettlementOperation } from '../../lib/combatSettlementMode'
import DmHitPointAdjustmentControls from './DmHitPointAdjustmentControls'
import {
  QUICK_CHARACTER_EQUIPMENT_SLOTS,
  quickCharacterAbilityRows,
  quickCharacterSkillRows,
  quickCreatureFormAbilityRows,
  quickCreatureFormPassivePerception,
  quickCreatureFormSkillRows,
  quickFormatModifier,
  quickProficiencyBonus,
} from '../../lib/quickCharacterView'
import {
  classResourceDefinitions,
  classResourceDisplayLabel,
  getClassResource,
} from '../../lib/classResources'
import { dnd5eEffectiveWalkingSpeed, dnd5eSpellSaveDc, getDnd5eSrdMonster, normalizeDnd5eInventory } from '../../rulesets/dnd5e'
import { dnd5eTruePolymorphObjectFormFromEffects } from '../../rulesets/dnd5e/truePolymorphObjectForms'

interface CharacterDetailPanelProps {
  token: Token
  character: Character
  onSetHitPoints: (input: {
    currentHp: number
    maxHp: number
    temporaryHp: number
    manuallySetMaximum: boolean
  }) => void | Promise<unknown>
  onAdjustHitPoints?: (operation: ManualSettlementOperation, amount: number) => void | Promise<unknown>
  isDM?: boolean
  canManageConditions?: boolean
  /** Effective union from the linked character and its map token. */
  conditionActiveEffects?: readonly Dnd5eActiveEffectInstance[]
  onConditionsChange?: (conditions: string[], activeEffects: Dnd5eActiveEffectInstance[]) => void
  conditionSourceOptions?: readonly { id: string; label: string }[]
  currentRound?: number
  onCorpseStateChange?: (state: {
    deathRound: number
    deathCause: 'other' | 'old-age'
    soulReturnStatus: 'free-willing' | 'unwilling' | 'not-free'
    bodyPresent: boolean
    missingBodyParts?: string[]
    vitalBodyPartsMissing?: boolean
  }) => void | Promise<unknown>
  onRepairSimulacrum?: (hitPoints: number) => void | Promise<unknown>
  onRemoveFromMap?: () => void | Promise<void>
  onClose: () => void
}

export default function CharacterDetailPanel({
  token,
  character,
  onSetHitPoints,
  onAdjustHitPoints,
  isDM = false,
  canManageConditions = false,
  conditionActiveEffects,
  onConditionsChange,
  conditionSourceOptions,
  currentRound = 1,
  onCorpseStateChange,
  onRepairSimulacrum,
  onRemoveFromMap,
  onClose,
}: CharacterDetailPanelProps) {
  const portrait = resolveMapTokenPortrait(character, token)
  const tempHp = character.tempHp ?? 0
  const [currentHpDraft, setCurrentHpDraft] = useState(String(character.currentHp))
  const [maxHpDraft, setMaxHpDraft] = useState(String(character.maxHp))
  const [editingCurrentHp, setEditingCurrentHp] = useState(false)
  const [editingMaxHp, setEditingMaxHp] = useState(false)
  const [removingFromMap, setRemovingFromMap] = useState(false)
  const [removeFromMapError, setRemoveFromMapError] = useState<string>()
  const [corpseAgeDays, setCorpseAgeDays] = useState(() => Math.max(
    0,
    (currentRound - (character.dnd5eCombatState?.deathRound ?? currentRound)) / 14_400,
  ))
  const [corpseBodyPresent, setCorpseBodyPresent] = useState(
    character.dnd5eCombatState?.bodyPresent !== false,
  )
  const [corpseDeathCause, setCorpseDeathCause] = useState<'other' | 'old-age'>(
    character.dnd5eCombatState?.deathCause ?? 'other',
  )
  const [corpseSoulReturnStatus, setCorpseSoulReturnStatus] = useState<'free-willing' | 'unwilling' | 'not-free'>(
    character.dnd5eCombatState?.soulReturnStatus ?? 'free-willing',
  )
  const [corpseVitalPartsMissing, setCorpseVitalPartsMissing] = useState(
    character.dnd5eCombatState?.vitalBodyPartsMissing === true,
  )
  const [corpseMissingParts, setCorpseMissingParts] = useState(
    character.dnd5eCombatState?.missingBodyParts?.join('、') ?? '',
  )
  const [savingCorpseState, setSavingCorpseState] = useState(false)
  const [corpseStateMessage, setCorpseStateMessage] = useState<string>()
  const [simulacrumRepairHitPoints, setSimulacrumRepairHitPoints] = useState(1)
  const [simulacrumRepairConfirmed, setSimulacrumRepairConfirmed] = useState(false)
  const [simulacrumRepairPending, setSimulacrumRepairPending] = useState(false)
  const [simulacrumRepairMessage, setSimulacrumRepairMessage] = useState<string>()
  const simulacrum = token.dnd5eSimulacrum
  const activeCreatureForm = character.dnd5eCombatState?.wildShapeFormId
    ? getDnd5eSrdMonster(character.dnd5eCombatState.wildShapeFormId)
    : undefined
  const activeObjectForm = dnd5eTruePolymorphObjectFormFromEffects(
    character.dnd5eCombatState?.activeEffects,
  )
  const spellCreatureForm = !!activeCreatureForm && !activeObjectForm &&
    (character.dnd5eCombatState?.wildShapeMode === 'polymorph' ||
      character.dnd5eCombatState?.wildShapeMode === 'true-polymorph' ||
      character.dnd5eCombatState?.wildShapeMode === 'animal-shapes')
  const shapechangeEquipmentDisposition = character.dnd5eCombatState?.wildShapeMode === 'shapechange'
    ? character.dnd5eCombatState.shapechangeEquipmentDisposition
    : undefined
  const creatureFormEquipmentUnavailable = !!activeObjectForm || spellCreatureForm ||
    (!!activeCreatureForm && character.dnd5eCombatState?.wildShapeMode === 'shapechange' &&
      shapechangeEquipmentDisposition !== 'wear')
  const creatureFormEquipmentTitle = activeObjectForm
    ? '装备与携带物已融入物体形态'
    : shapechangeEquipmentDisposition === 'drop'
      ? '装备已掉落在施法位置'
      : '装备已融入形态'
  const creatureFormLabel = character.dnd5eCombatState?.wildShapeMode === 'true-polymorph'
    ? '完全变形术'
    : character.dnd5eCombatState?.wildShapeMode === 'polymorph'
    ? '变形术'
    : character.dnd5eCombatState?.wildShapeMode === 'animal-shapes'
      ? '动物形态'
      : character.dnd5eCombatState?.wildShapeMode === 'shapechange' ? '形体变化' : '荒野形态'
  const corpseDead = character.currentHp === 0 && (character.deathSaveFailures ?? 0) >= 3

  useEffect(() => {
    setCorpseAgeDays(Math.max(
      0,
      (currentRound - (character.dnd5eCombatState?.deathRound ?? currentRound)) / 14_400,
    ))
    setCorpseBodyPresent(character.dnd5eCombatState?.bodyPresent !== false)
    setCorpseDeathCause(character.dnd5eCombatState?.deathCause ?? 'other')
    setCorpseSoulReturnStatus(character.dnd5eCombatState?.soulReturnStatus ?? 'free-willing')
    setCorpseVitalPartsMissing(character.dnd5eCombatState?.vitalBodyPartsMissing === true)
    setCorpseMissingParts(character.dnd5eCombatState?.missingBodyParts?.join('、') ?? '')
  }, [
    character.id,
    character.dnd5eCombatState?.deathRound,
    character.dnd5eCombatState?.bodyPresent,
    character.dnd5eCombatState?.deathCause,
    character.dnd5eCombatState?.soulReturnStatus,
    character.dnd5eCombatState?.vitalBodyPartsMissing,
    character.dnd5eCombatState?.missingBodyParts,
    currentRound,
  ])

  const saveCorpseState = async () => {
    if (!onCorpseStateChange || savingCorpseState) return
    setSavingCorpseState(true)
    setCorpseStateMessage(undefined)
    try {
      const missingBodyParts = corpseMissingParts.split(/[,，、]/u)
        .map((part) => part.trim()).filter(Boolean).slice(0, 16)
      await onCorpseStateChange({
        deathRound: currentRound - Math.round(Math.max(0, corpseAgeDays) * 14_400),
        deathCause: corpseDeathCause,
        soulReturnStatus: corpseSoulReturnStatus,
        bodyPresent: corpseBodyPresent,
        missingBodyParts: missingBodyParts.length > 0 ? missingBodyParts : undefined,
        vitalBodyPartsMissing: corpseVitalPartsMissing || undefined,
      })
      setCorpseStateMessage('尸体账本已保存。')
    } catch {
      setCorpseStateMessage('尸体账本保存失败。')
    } finally {
      setSavingCorpseState(false)
    }
  }
  const quickCharacterSource = useMemo(() => ({
    ...character,
    savingThrows: character.savingThrows ?? [],
    skills: character.skills ?? [],
  }), [character])
  const abilityRows = useMemo(() => activeObjectForm
    ? []
    : activeCreatureForm
    ? quickCreatureFormAbilityRows(quickCharacterSource, activeCreatureForm, character.dnd5eCombatState)
    : quickCharacterAbilityRows(quickCharacterSource), [activeCreatureForm, activeObjectForm, quickCharacterSource])
  const skillRows = useMemo(() => activeObjectForm
    ? []
    : activeCreatureForm
    ? quickCreatureFormSkillRows(quickCharacterSource, activeCreatureForm, character.dnd5eCombatState)
    : quickCharacterSkillRows(quickCharacterSource), [activeCreatureForm, activeObjectForm, quickCharacterSource])
  const inventory = useMemo(() => normalizeDnd5eInventory(character), [character])
  const resourceRows = useMemo(() => {
    const definitions = classResourceDefinitions(character)
    const knownKeys = new Set(definitions.map((definition) => definition.key))
    const defined = definitions.flatMap((definition) => {
      const state = getClassResource(character, definition.key)
      return state ? [{
        key: definition.key,
        label: definition.label,
        current: state.current,
        max: state.max,
        unlimited: (definition.unlimited?.(character) ?? false) || Number(state.max) >= Number.MAX_SAFE_INTEGER,
        resetOn: definition.resetOn,
      }] : []
    })
    const legacy = Object.entries(character.classResources ?? {}).flatMap(([key, state]) =>
      knownKeys.has(key) ? [] : [{
        key,
        label: classResourceDisplayLabel(character, key),
        ...state,
        unlimited: Number(state.max) >= Number.MAX_SAFE_INTEGER,
        resetOn: undefined,
      }])
    return [...defined, ...legacy]
  }, [character])
  const spellSlotRows = resourceRows.filter((resource) =>
    resource.key.startsWith('dnd5e-spell-slot-') || resource.key === 'dnd5e-pact-slot')
  const classResourceRows = resourceRows.filter((resource) =>
    !resource.key.startsWith('dnd5e-spell-slot-') && resource.key !== 'dnd5e-pact-slot')
  const equippedEntries = inventory.entries.filter((entry) => entry.equippedSlot)
  const carriedEntries = inventory.entries.filter((entry) => !entry.equippedSlot)
  const initiative = activeObjectForm
    ? 0
    : (abilityRows.find((ability) => ability.key === 'dex')?.modifier ?? 0) +
      (activeCreatureForm ? 0 : character.initiativeBonus ?? 0)
  const speed = activeObjectForm ? 0 : activeCreatureForm?.speed.walk ?? dnd5eEffectiveWalkingSpeed(character)
  const spellSaveDc = dnd5eSpellSaveDc(character) ?? character.saveDC
  const [pendingHitPoints, setPendingHitPoints] = useState<{
    currentHp: number
    maxHp: number
  } | null>(null)
  const hitPointRequestIdRef = useRef(0)
  const submittedHitPointsRef = useRef<{ currentHp: number; maxHp: number } | null>(null)
  const baseDisplayedHitPoints = resolveHitPointDisplay({
    currentHp: character.currentHp,
    maxHp: character.maxHp,
    currentHpDraft,
    maxHpDraft,
    editingCurrentHp,
    editingMaxHp,
    pending: pendingHitPoints,
  })
  const displayedHitPoints = activeCreatureForm
    ? {
        currentHp: Math.max(0, token.hp ?? character.dnd5eCombatState?.wildShapeCurrentHp ?? activeCreatureForm.hitPoints.average),
        maxHp: Math.max(1, token.maxHp ?? activeCreatureForm.hitPoints.average),
        percentage: 0,
      }
    : baseDisplayedHitPoints
  const defeated = displayedHitPoints.currentHp <= 0
  const setHp = (hp: number, maxHp = character.maxHp, manuallySetMaximum = false) => {
    if (!isDM) return
    const nextHp = Math.max(0, Math.min(maxHp, hp))
    const submitted = submittedHitPointsRef.current
    if (submitted?.currentHp === nextHp && submitted.maxHp === maxHp) return
    const requestId = ++hitPointRequestIdRef.current
    submittedHitPointsRef.current = { currentHp: nextHp, maxHp }
    setPendingHitPoints({ currentHp: nextHp, maxHp })
    const result = onSetHitPoints({
      currentHp: nextHp,
      maxHp,
      temporaryHp: character.tempHp,
      manuallySetMaximum,
    })
    if (!result || typeof (result as PromiseLike<unknown>).then !== 'function') {
      if (hitPointRequestIdRef.current === requestId) {
        submittedHitPointsRef.current = null
        setPendingHitPoints(null)
      }
      return
    }
    const clearPendingRequest = () => {
      if (hitPointRequestIdRef.current === requestId) {
        submittedHitPointsRef.current = null
        setPendingHitPoints(null)
      }
    }
    void Promise.resolve(result).then(clearPendingRequest, clearPendingRequest)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldCloseCharacterDetailForKey(event.key)) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const commitCurrentHp = () => {
    const parsed = parseLiveHitPointDraft(currentHpDraft, character.maxHp) ?? character.currentHp
    const nextHp = simulacrum ? Math.min(character.currentHp, parsed) : parsed
    setEditingCurrentHp(false)
    setCurrentHpDraft(String(nextHp))
    const changed =
      nextHp !== character.currentHp ||
      token.hp !== nextHp ||
      token.maxHp !== character.maxHp
    if (changed) setHp(nextHp)
  }

  const updateCurrentHpDraft = (draft: string) => {
    setCurrentHpDraft(draft)
    const parsed = parseLiveHitPointDraft(draft, character.maxHp)
    if (parsed == null) return
    const nextHp = simulacrum ? Math.min(character.currentHp, parsed) : parsed
    const changed =
      nextHp !== character.currentHp ||
      token.hp !== nextHp ||
      token.maxHp !== character.maxHp
    if (changed) setHp(nextHp)
  }

  const updateMaxHpDraft = (draft: string) => {
    setMaxHpDraft(draft)
    if (draft.trim() === '') return
    const parsed = Number(draft)
    if (!Number.isFinite(parsed)) return
    const nextMaxHp = Math.max(1, Math.floor(parsed))
    const nextCurrentHp = Math.min(displayedHitPoints.currentHp, nextMaxHp)
    if (
      nextMaxHp !== character.maxHp ||
      nextCurrentHp !== character.currentHp ||
      token.maxHp !== nextMaxHp ||
      token.hp !== nextCurrentHp
    ) setHp(nextCurrentHp, nextMaxHp, true)
  }

  const commitMaxHp = () => {
    const parsed = Number(maxHpDraft)
    const nextMaxHp = Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : character.maxHp
    const nextCurrentHp = Math.min(character.currentHp, nextMaxHp)
    setEditingMaxHp(false)
    setMaxHpDraft(String(nextMaxHp))
    setCurrentHpDraft(String(nextCurrentHp))
    if (nextMaxHp !== character.maxHp || nextCurrentHp !== character.currentHp) {
      setHp(nextCurrentHp, nextMaxHp, true)
    }
  }

  const removeFromMap = async () => {
    if (!isDM || !onRemoveFromMap || removingFromMap) return
    if (!await showAppConfirm({
      title: '移除冒险者标记',
      message: `从当前地图移除“${character.name}”的 Token？人物卡、装备和角色数据都会保留，之后可以重新放置。`,
      confirmLabel: '移除标记',
      tone: 'danger',
    })) return
    setRemovingFromMap(true)
    setRemoveFromMapError(undefined)
    try {
      await onRemoveFromMap()
      onClose()
    } catch (cause) {
      setRemoveFromMapError(cause instanceof Error ? cause.message : '冒险者标记未能安全移除，请重试。')
      setRemovingFromMap(false)
    }
  }

  const repairSimulacrum = async () => {
    if (!simulacrum || !onRepairSimulacrum || simulacrumRepairPending || !simulacrumRepairConfirmed) return
    const missing = Math.max(0, simulacrum.maximumHitPoints - character.currentHp)
    const hitPoints = Math.min(missing, Math.max(1, Math.floor(simulacrumRepairHitPoints)))
    if (hitPoints < 1) return
    setSimulacrumRepairPending(true)
    setSimulacrumRepairMessage(undefined)
    try {
      await onRepairSimulacrum(hitPoints)
      setSimulacrumRepairMessage(`已修复 ${hitPoints} HP；材料成本 ${hitPoints * 100} gp。`)
      setSimulacrumRepairConfirmed(false)
    } catch (cause) {
      setSimulacrumRepairMessage(cause instanceof Error ? cause.message : '拟像修复未能保存。')
    } finally {
      setSimulacrumRepairPending(false)
    }
  }

  return (
    <div
      data-testid="character-detail-panel"
      data-defeated={defeated || undefined}
      className="glass absolute bottom-3 left-3 z-[120] flex max-h-[min(820px,calc(100%-3rem))] w-[min(520px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
    >
      <div className="flex items-start gap-3 border-b border-white/10 px-4 py-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-void-900 text-2xl"
          style={{ borderColor: token.color || '#34d399' }}
        >
          {portrait ? (
            <img src={portrait} alt={`${character.name}的地图 Token`} className="h-full w-full object-cover" />
          ) : (
            character.avatar || token.emoji
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-100">{character.name}</h2>
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
              Lv {character.level}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
              {character.charClass}
            </span>
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
              {character.race}
            </span>
            {character.background ? (
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                {character.background}
              </span>
            ) : null}
          </div>
          {activeCreatureForm ? <div className="mt-1 text-[11px] font-bold text-emerald-200">当前形态：{activeObjectForm?.profile.label ?? activeCreatureForm.name}（{activeObjectForm ? '完全变形术' : creatureFormLabel}{activeObjectForm?.permanent || character.dnd5eCombatState?.wildShapePermanent === true ? ' · 永久' : ''}）</div> : null}
          {token.dnd5eTruesightPerception ? (
            <div data-testid="truesight-perception" className="mt-1 text-[11px] font-bold text-cyan-200">
              真视察觉：{[
                token.dnd5eTruesightPerception.ethereal ? '以太位面' : null,
                token.dnd5eTruesightPerception.originalForm ? '原本形态' : null,
                token.dnd5eTruesightPerception.visualIllusion ? '视觉幻象' : null,
              ].filter(Boolean).join(' · ')}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          data-testid="close-character-detail"
          aria-label="关闭角色详情"
          onPointerDown={(event) => {
            closeCharacterDetailOnPrimaryPointerDown(event, onClose)
          }}
          onClick={(event) => {
            event.stopPropagation()
            // Pointer input closes on pointerdown so an authoritative death
            // snapshot cannot replace the panel between down/up and swallow
            // the click. Keyboard and assistive activation still arrive as a
            // click with detail === 0 and close through this fallback.
            if (event.detail === 0) onClose()
          }}
          className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-200"
          title="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <section className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-rose-200">
            <HeartPulse className="h-3.5 w-3.5" />
            生命值
          </div>
          <div className="mb-2 flex items-center gap-1">
            {isDM && !activeCreatureForm ? (
              <>
                <input
                  type="number"
                  aria-label="当前生命值"
                  min={0}
                  max={simulacrum ? character.currentHp : displayedHitPoints.maxHp}
                  value={editingCurrentHp ? currentHpDraft : String(displayedHitPoints.currentHp)}
                  onFocus={(event) => {
                    setCurrentHpDraft(String(character.currentHp))
                    setEditingCurrentHp(true)
                    event.currentTarget.select()
                  }}
                  onChange={(event) => updateCurrentHpDraft(event.target.value)}
                  onBlur={commitCurrentHp}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                  }}
                  className="w-20 rounded border border-white/10 bg-void-950/70 px-1 py-0.5 text-center text-xs text-slate-100 outline-none focus:border-arcane-500"
                />
                <span className="text-xs text-slate-500">/</span>
                {simulacrum ? (
                  <span
                    data-testid="simulacrum-locked-maximum-hit-points"
                    className="w-20 rounded border border-violet-300/20 bg-violet-500/10 px-1 py-0.5 text-center text-xs text-violet-100"
                    title="拟像最大生命值固定为被复制生物施法时最大生命值的一半"
                  >
                    {displayedHitPoints.maxHp}
                  </span>
                ) : (
                  <input
                    type="number"
                    aria-label="最大生命值"
                    min={1}
                    value={editingMaxHp ? maxHpDraft : String(displayedHitPoints.maxHp)}
                    onFocus={(event) => {
                      setMaxHpDraft(String(character.maxHp))
                      setEditingMaxHp(true)
                      event.currentTarget.select()
                    }}
                    onChange={(event) => updateMaxHpDraft(event.target.value)}
                    onBlur={commitMaxHp}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                    }}
                    className="w-20 rounded border border-white/10 bg-void-950/70 px-1 py-0.5 text-center text-xs text-slate-100 outline-none focus:border-arcane-500"
                  />
                )}
              </>
            ) : (
              <span className="rounded border border-white/10 bg-void-950/50 px-2 py-1 text-sm font-semibold tabular-nums text-slate-100">
                {displayedHitPoints.currentHp} / {displayedHitPoints.maxHp}
              </span>
            )}
            {activeCreatureForm ? <span className="text-[10px] text-slate-500">本体 {character.currentHp}/{character.maxHp}</span> : null}
            {tempHp > 0 && (
              <span className="ml-auto rounded bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-200">
                临时 {tempHp}
              </span>
            )}
          </div>
          {isDM && onAdjustHitPoints ? (
            <DmHitPointAdjustmentControls temporaryHp={tempHp} onAdjust={onAdjustHitPoints} />
          ) : null}
          {simulacrum ? (
            <p className="mt-2 text-[10px] leading-4 text-violet-100/75">
              拟像不能通过治疗或休息恢复生命值；普通生命值编辑只能造成伤害。降至 0 HP 时会化为雪并离场。
            </p>
          ) : null}
        </section>

        {simulacrum && isDM && onRepairSimulacrum ? (
          <section
            data-testid="simulacrum-alchemical-repair"
            className="mb-4 rounded-xl border border-violet-300/20 bg-violet-500/[0.06] p-3"
          >
            <h3 className="text-xs font-semibold text-violet-100">炼金实验室修复</h3>
            <p className="mt-1 text-[10px] leading-4 text-violet-100/75">
              每恢复 1 HP 消耗价值 100 gp 的稀有草药和矿物；此入口是拟像唯一的生命值恢复方式。
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={Math.max(1, simulacrum.maximumHitPoints - character.currentHp)}
                aria-label="拟像修复生命值"
                value={simulacrumRepairHitPoints}
                onChange={(event) => setSimulacrumRepairHitPoints(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
                className="w-24 rounded border border-white/10 bg-void-950/70 px-2 py-1.5 text-center text-xs text-slate-100"
              />
              <span className="text-xs text-violet-100">HP · {simulacrumRepairHitPoints * 100} gp</span>
            </div>
            <label className="mt-2 flex items-start gap-2 text-[10px] leading-4 text-slate-300">
              <input
                type="checkbox"
                checked={simulacrumRepairConfirmed}
                onChange={(event) => setSimulacrumRepairConfirmed(event.target.checked)}
              />
              <span>DM 已确认身处炼金实验室，并已核销足值的稀有草药和矿物。</span>
            </label>
            <button
              type="button"
              data-testid="repair-simulacrum"
              disabled={
                simulacrumRepairPending ||
                !simulacrumRepairConfirmed ||
                character.currentHp >= simulacrum.maximumHitPoints
              }
              onClick={() => void repairSimulacrum()}
              className="mt-2 w-full rounded-lg border border-violet-300/20 bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/25 disabled:opacity-40"
            >
              {simulacrumRepairPending ? '正在修复…' : '确认修复并记录材料成本'}
            </button>
            {simulacrumRepairMessage ? <p role="status" className="mt-1 text-[10px] text-slate-300">{simulacrumRepairMessage}</p> : null}
          </section>
        ) : null}

        <div data-testid="character-detail-combat-summary" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
            <Shield className="h-4 w-4 text-sky-400" />
            <div>
              <p className="text-[10px] text-slate-500">AC</p>
              <p className="text-sm font-semibold text-slate-100">{activeCreatureForm?.armorClass.value ?? getEffectiveAc(character)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
            <Footprints className="h-4 w-4 text-emerald-400" />
            <div>
              <p className="text-[10px] text-slate-500">速度</p>
              <p className="text-sm font-semibold text-slate-100">{speed} 尺</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
            <Sparkles className="h-4 w-4 text-violet-300" />
            <div>
              <p className="text-[10px] text-slate-500">熟练</p>
              <p className="text-sm font-semibold text-slate-100">{activeObjectForm ? '—' : `+${quickProficiencyBonus(character.level)}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
            <Dices className="h-4 w-4 text-amber-300" />
            <div><p className="text-[10px] text-slate-500">先攻</p><p className="text-sm font-semibold text-slate-100">{activeObjectForm ? '—' : quickFormatModifier(initiative)}</p></div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
            <Eye className="h-4 w-4 text-cyan-300" />
            <div><p className="text-[10px] text-slate-500">被动察觉</p><p className="text-sm font-semibold text-slate-100">{activeObjectForm ? '—' : activeCreatureForm
              ? quickCreatureFormPassivePerception(character.passivePerception, activeCreatureForm, character.dnd5eCombatState)
              : character.passivePerception}</p></div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
            <Sparkles className="h-4 w-4 text-violet-300" />
            <div><p className="text-[10px] text-slate-500">法术豁免 DC</p><p className="text-sm font-semibold text-slate-100">{spellCreatureForm || activeObjectForm ? '不可施法' : spellSaveDc ?? '—'}</p></div>
          </div>
          <div data-testid="character-detail-elevation" className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
            <ArrowUp className="h-4 w-4 text-cyan-300" />
            <div><p className="text-[10px] text-slate-500">高度</p><p className="text-sm font-semibold text-slate-100">{Math.max(0, Math.floor(token.elevationFeet ?? 0))} 尺</p></div>
          </div>
        </div>

        <section data-testid="character-detail-abilities">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">属性与豁免</h3>
          <div className="grid grid-cols-3 gap-2">
            {activeObjectForm ? <p className="col-span-full rounded-xl border border-amber-300/20 bg-amber-400/[0.05] p-3 text-xs text-amber-100">物体没有生物属性或豁免；本体数据在法术结束前封存。</p> : abilityRows.map((ability) => (
              <div key={ability.key} className="flex flex-col items-center rounded-xl border border-white/5 bg-void-900/40 px-2 py-2">
                <span className="text-[10px] font-medium text-slate-500">{ability.label}</span>
                <span className="text-lg font-bold text-arcane-200">{quickFormatModifier(ability.modifier)}</span>
                <span className="text-[10px] tabular-nums text-slate-500">属性 {ability.score}</span>
                <span className={ability.saveProficient ? 'mt-1 text-[9px] font-semibold text-emerald-300' : 'mt-1 text-[9px] text-slate-600'}>
                  豁免 {quickFormatModifier(ability.savingThrowModifier)}{ability.saveProficient ? ' · 熟练' : ''}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section data-testid="character-detail-skills" className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">技能</h3>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {activeObjectForm ? <p className="col-span-full rounded-xl border border-amber-300/20 bg-amber-400/[0.05] p-3 text-xs text-amber-100">物体不能进行生物技能检定，也不能行动、说话或施法。</p> : skillRows.map((skill) => (
              <div key={skill.key} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5">
                <span className={[
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  skill.expertise ? 'bg-amber-300' : skill.proficient ? 'bg-sky-300' : 'border border-slate-700',
                ].join(' ')} />
                <span className="min-w-0 flex-1 truncate text-[10px] text-slate-300">{skill.label}</span>
                <strong className="text-[11px] tabular-nums text-slate-100">{quickFormatModifier(skill.modifier)}</strong>
              </div>
            ))}
          </div>
        </section>

        {spellCreatureForm || activeObjectForm ? <section data-testid="character-detail-resources" className="mt-4 rounded-xl border border-amber-300/15 bg-amber-400/[0.04] p-3 text-xs text-amber-200">
          当前{activeObjectForm ? '物体' : '法术'}形态无法使用本体法术位或职业资源。
        </section> : (spellSlotRows.length > 0 || classResourceRows.length > 0) ? (
          <section data-testid="character-detail-resources" className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">法术位与职业资源</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[...spellSlotRows, ...classResourceRows].map((resource) => (
                <div key={resource.key} className="rounded-xl border border-violet-300/10 bg-violet-400/[0.05] px-3 py-2">
                  <div className="truncate text-[10px] font-semibold text-violet-100">{resource.label}</div>
                  <div className="mt-0.5 text-sm font-black tabular-nums text-white">
                    {resource.unlimited ? '不限次数' : `${resource.current}/${resource.max}`}
                  </div>
                  <div className="text-[9px] text-slate-500">{resourceResetLabel(resource.resetOn)}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {creatureFormEquipmentUnavailable ? <section data-testid="character-detail-equipment" className="mt-4 rounded-xl border border-amber-300/15 bg-amber-400/[0.04] p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-100"><PackageOpen className="h-3.5 w-3.5" />{creatureFormEquipmentTitle}</h3>
          <p className="mt-2 text-xs leading-5 text-amber-200/80">{activeObjectForm
            ? '目标穿戴与携带的一切已一并成为该物体形态的一部分，当前不能使用、持握或从中获益。'
            : shapechangeEquipmentDisposition === 'drop'
            ? '这些装备留在施法位置，当前不能从装备获得任何收益。'
            : '当前不能启动、使用、持握装备，也不能从装备获得任何收益。'}</p>
        </section> : <section data-testid="character-detail-equipment" className="mt-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500"><PackageOpen className="h-3.5 w-3.5" />装备与背包</h3>
          {equippedEntries.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {equippedEntries.map((entry) => (
                <div key={entry.instanceId} className="rounded-lg border border-amber-300/10 bg-amber-400/[0.04] px-2.5 py-2">
                  <div className="text-[9px] text-amber-200/55">{equipmentSlotLabel(entry.equippedSlot)}</div>
                  <div className="truncate text-[11px] font-semibold text-amber-50">{entry.item.name}</div>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-slate-600">没有已装备物品</p>}
          <div className="mt-2 rounded-xl border border-white/[0.06] bg-black/15 p-2.5">
            <div className="mb-1.5 text-[10px] font-semibold text-slate-400">背包 · {carriedEntries.length} 类物品</div>
            {carriedEntries.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {carriedEntries.slice(0, 12).map((entry) => (
                  <span key={entry.instanceId} className="rounded-md bg-white/5 px-2 py-1 text-[10px] text-slate-300">{entry.item.name}{entry.quantity > 1 ? ` ×${entry.quantity}` : ''}</span>
                ))}
                {carriedEntries.length > 12 ? <span className="px-1 py-1 text-[10px] text-slate-500">另有 {carriedEntries.length - 12} 类</span> : null}
              </div>
            ) : <span className="text-[10px] text-slate-600">背包为空</span>}
          </div>
        </section>}

        {canManageConditions && onConditionsChange ? (
          <div className="mt-4">
            <Dnd5eConditionEditor
              conditions={character.conditions}
              activeEffects={conditionActiveEffects ?? character.dnd5eCombatState?.activeEffects}
              targetId={token.id}
              targetName={character.name}
              sourceOptions={conditionSourceOptions}
              onChange={onConditionsChange}
            />
          </div>
        ) : character.conditions.length > 0 ? (
          <section className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">D&D 5e 状态</h3>
            <Dnd5eConditionTags conditions={character.conditions} />
          </section>
        ) : null}

        {character.dnd5eCombatState?.resurrectionPenalty ? (
          <section className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/[0.06] p-3" data-testid="dnd5e-resurrection-penalty">
            <h3 className="text-xs font-semibold text-amber-100">复活虚弱 {character.dnd5eCombatState.resurrectionPenalty.value}</h3>
            <p className="mt-1 text-[10px] leading-4 text-amber-200/75">
              攻击检定、豁免与属性检定均受此调整；每次长休恢复 {character.dnd5eCombatState.resurrectionPenalty.recoveryPerLongRest} 点。
            </p>
          </section>
        ) : null}

        {isDM && !simulacrum && character.rulesetId === 'dnd5e-2014-srd-5.1' ? (
          <section className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-400/[0.04] p-3" data-testid="dnd5e-body-integrity">
            <h3 className="text-xs font-semibold text-cyan-100">身体完整性</h3>
            <p className="mt-1 text-[10px] leading-4 text-cyan-100/75">
              {character.dnd5eCombatState?.bodyPresent === false
                ? '身体不存在'
                : (character.dnd5eCombatState?.missingBodyParts?.length ?? 0) > 0
                  ? `缺失部位：${character.dnd5eCombatState?.missingBodyParts?.join('、')}`
                  : '身体完整；无缺失部位'}
              {character.dnd5eCombatState?.vitalBodyPartsMissing ? '；缺失关键器官或部位' : ''}
            </p>
          </section>
        ) : null}

        {isDM && corpseDead && onCorpseStateChange ? (
          <section className="mt-4 rounded-xl border border-rose-300/20 bg-rose-500/[0.05] p-3" data-testid="dnd5e-corpse-state-editor">
            <h3 className="text-xs font-semibold text-rose-100">尸体与复活账本</h3>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">用于权威校验死亡时限与原因、灵魂能否返回、尸体是否存在以及关键部位完整性。</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-400">
              <label>死亡时间（天）
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  aria-label="死亡时间（天）"
                  value={corpseAgeDays}
                  onChange={(event) => setCorpseAgeDays(Math.max(0, Number(event.target.value) || 0))}
                  className="mt-1 w-full rounded border border-white/10 bg-void-950 px-2 py-1 text-slate-200"
                />
              </label>
              <label>死亡原因
                <select
                  aria-label="死亡原因"
                  value={corpseDeathCause}
                  onChange={(event) => setCorpseDeathCause(event.target.value as typeof corpseDeathCause)}
                  className="mt-1 w-full rounded border border-white/10 bg-void-950 px-2 py-1 text-slate-200"
                >
                  <option value="other">并非寿终正寝</option>
                  <option value="old-age">寿终正寝</option>
                </select>
              </label>
              <label>灵魂状态
                <select
                  aria-label="灵魂状态"
                  value={corpseSoulReturnStatus}
                  onChange={(event) => setCorpseSoulReturnStatus(event.target.value as typeof corpseSoulReturnStatus)}
                  className="mt-1 w-full rounded border border-white/10 bg-void-950 px-2 py-1 text-slate-200"
                >
                  <option value="free-willing">自由且愿意返回</option>
                  <option value="unwilling">自由但不愿返回</option>
                  <option value="not-free">灵魂不自由／无法返回</option>
                </select>
              </label>
              <label>缺失部位（逗号分隔）
                <input
                  aria-label="缺失部位"
                  value={corpseMissingParts}
                  onChange={(event) => setCorpseMissingParts(event.target.value)}
                  placeholder="例如：左臂"
                  className="mt-1 w-full rounded border border-white/10 bg-void-950 px-2 py-1 text-slate-200"
                />
              </label>
              <label className="flex items-center gap-2 rounded border border-white/8 bg-black/10 px-2 py-1.5">
                <input type="checkbox" aria-label="尸体仍存在" checked={corpseBodyPresent} onChange={(event) => setCorpseBodyPresent(event.target.checked)} />
                <span>尸体仍存在</span>
              </label>
              <label className="flex items-center gap-2 rounded border border-white/8 bg-black/10 px-2 py-1.5">
                <input type="checkbox" aria-label="缺失关键器官或部位" checked={corpseVitalPartsMissing} onChange={(event) => setCorpseVitalPartsMissing(event.target.checked)} />
                <span>缺失关键器官或部位</span>
              </label>
            </div>
            <button
              type="button"
              data-testid="save-dnd5e-corpse-state"
              disabled={savingCorpseState}
              onClick={() => void saveCorpseState()}
              className="mt-2 w-full rounded-lg border border-rose-300/20 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/25 disabled:opacity-50"
            >
              {savingCorpseState ? '正在保存…' : '保存尸体账本'}
            </button>
            {corpseStateMessage ? <p role="status" className="mt-1 text-[10px] text-slate-400">{corpseStateMessage}</p> : null}
          </section>
        ) : null}

        {isDM && onRemoveFromMap ? (
          <section className="mt-4 border-t border-white/10 pt-4">
            <p className="text-xs leading-relaxed text-slate-500">
              仅移除当前地图上的 Token；不会删除人物卡、装备或战役记录。
            </p>
            {removeFromMapError ? <p className="mt-2 text-xs text-rose-300">{removeFromMapError}</p> : null}
            <button
              type="button"
              data-testid="remove-character-token"
              disabled={removingFromMap}
              onClick={() => void removeFromMap()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/25 disabled:cursor-wait disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {removingFromMap ? '正在移除…' : '从地图移除标记'}
            </button>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function resourceResetLabel(resetOn: string | undefined): string {
  if (resetOn === 'short-rest') return '短休或长休恢复'
  if (resetOn === 'long-rest') return '长休恢复'
  if (resetOn === 'combat') return '战斗重置'
  return '按规则恢复'
}

function equipmentSlotLabel(slot: string | undefined): string {
  return QUICK_CHARACTER_EQUIPMENT_SLOTS.find((entry) => entry.key === slot)?.label ?? '已装备'
}
