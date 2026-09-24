import { MAX_DICE_POOL_COUNT } from '../../lib/dicePoolLimits'
import { adoptedD20Index, diceCheckResultLabel } from './diceCheckPresentation'
import type { DiceCheckPresentation } from './diceCheckPresentation'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Dice5, ScrollText } from 'lucide-react'
import DiceRollOverlay, { type DiceRoll } from '../../components/DiceRollOverlay'
import DiceTrayRerollControls from './DiceTrayRerollControls'
import DiceResultValues from './DiceResultValues'
import PersistentDiceTray, { type PersistentDiceRequest } from './PersistentDiceTray'
import DiceOverlayPortal from '../../components/DiceOverlayPortal'
import type {
  DiceBoxD20Request,
  DiceBoxRollRequest,
  SharedRollRequestPreview,
} from './useDicePresentation'
import type { ActiveDiceRollStatusView } from './diceRollStatusModel'
import { readDiceTrayHistory, writeDiceTrayHistory } from './diceTrayHistory'
import RoomDicePanel from './RoomDicePanel'
import { diceResultFormula } from './diceResultFormula'
import { diceCheckOutcomeLabel, type DiceCheckOutcome } from './diceCheckOutcome'
import type { RoomDiceEntry } from './roomDiceFeed'
import { dmAdoptedDie, dmDiceModes } from './dmDiceMode'

export interface DiceTraySecretConfirmation {
  onModeChange?: (mode: DiceCheckPresentation['mode'], values: number[]) => Promise<void>
  check?: DiceCheckPresentation
  visibility?: 'public' | 'dm-only'
  id: string
  label: string
  targetName: string
  sides: number
  values: readonly number[]
  busy?: boolean
}

export interface DiceTrayPlayerRollPrompt {
  check?: DiceCheckPresentation
  id: string
  label: string
  targetName: string
  count: number
  sides: number
  busy?: boolean
}

export interface DicePresentationOverlaysProps {
  checkResult?: DiceCheckOutcome | null
  checkOutcome?: DiceCheckOutcome | null
  controlsHost?: HTMLElement | null
  roomRolls?: readonly RoomDiceEntry[]
  onClearRoomRolls?: () => void
  historyScope?: string
  roll: DiceRoll | null
  diceBoxD20: DiceBoxD20Request | null
  diceBoxRoll: DiceBoxRollRequest | null
  rollRequestPreview: SharedRollRequestPreview | null
  activeRollStatus: ActiveDiceRollStatusView | null
  secretConfirmation: DiceTraySecretConfirmation | null
  playerRollPrompt?: DiceTrayPlayerRollPrompt | null
  isDM: boolean
  renderFreeRollControls?: (close: () => void, visibility: 'public' | 'dm', onVisibilityChange: (visibility: 'public' | 'dm') => void) => ReactNode
  freeReroll?: { roll: DiceRoll; onReroll: (index?: number) => Promise<void> }
  onRollDone: () => void
  onD20Complete: (request: DiceBoxD20Request, value: number) => void
  onDiceComplete: (request: DiceBoxRollRequest, values: number[]) => void
  onPreviewComplete: (id: string, delayMs: number) => void
  onSecretConfirm: (id: string, values: number[]) => void | Promise<void>
  onPlayerRoll?: (id: string) => void | Promise<void>
  dockTab?: 'log' | 'dice' | null
  onDockTabChange?: (tab: 'log' | 'dice' | null) => void
  combatLogPanel?: ReactNode
  combatLogCount?: number
}

interface DiceTrayRecord {
  check?: DiceCheckPresentation
  settlement?: DiceRoll['settlement']
  dieSides?: number[]
  sourceRoll?: DiceRoll
  id: string
  label: string
  targetName: string
  sides: number
  values: number[]
  total?: number
  formula?: string
}

export function SecretDiceTrayControls({
  confirmation,
  onConfirm,
}: {
  confirmation: DiceTraySecretConfirmation
  onConfirm: (values: number[]) => void | Promise<void>
}) {
  const [draft, setDraft] = useState(() => confirmation.values.map(String))
  const [submitting, setSubmitting] = useState(false)
  const [changingMode, setChangingMode] = useState(false)
  const [modeError, setModeError] = useState('')
  useEffect(() => setDraft(confirmation.values.map(String)), [confirmation.values])
  const parsed = draft.map((value) => Number(value))
  const valid = parsed.length === confirmation.values.length && parsed.every(
    (value) => Number.isInteger(value) && value >= 1 && value <= confirmation.sides,
  )
  const adoptedIndex = valid ? adoptedD20Index(parsed, confirmation.check) : undefined
  const total = valid ? adoptedIndex != null ? parsed[adoptedIndex] : parsed.reduce((sum, value) => sum + value, 0) : '—'

  const submit = async () => {
    if (!valid || submitting || changingMode || confirmation.busy) return
    setSubmitting(true)
    try {
      await onConfirm(parsed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={`dice-tray-drawer__secret${confirmation.values.length > 3 ? ' dice-tray-drawer__secret--many' : ''}${confirmation.check ? ' dice-tray-drawer__secret--check' : ''}${confirmation.onModeChange ? ' dice-tray-drawer__secret--mode' : ''}`}
      data-testid="secret-dice-override"
    >
      {confirmation.onModeChange && confirmation.check && <div className="dice-tray-drawer__modes" role="group" aria-label="DM 投掷模式">
        {dmDiceModes.map(option => <button key={option.value} type="button"
          aria-pressed={confirmation.check?.mode === option.value}
          disabled={!valid || submitting || changingMode || confirmation.busy}
          onClick={async () => {
            if (option.value === confirmation.check?.mode) return
            setChangingMode(true)
            setModeError('')
            try { await confirmation.onModeChange?.(option.value, parsed) }
            catch (error) { setModeError(error instanceof Error ? error.message : '切换失败，请重试') }
            finally { setChangingMode(false) }
          }}>{option.label}</button>)}
      </div>}
      {modeError && <span role="alert">{modeError}</span>}
      {(!confirmation.check || confirmation.check.modifier != null) && <div className="dice-tray-drawer__total dice-tray-drawer__total--secret">
        {confirmation.check?.modifier != null ? <strong style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
          {`1D20${confirmation.check.modifier >= 0 ? '+' : ''}${confirmation.check.modifier}=${typeof total === 'number' ? total + confirmation.check.modifier : total}`}
        </strong> : <><span>合计</span><strong>{total}</strong></>}
      </div>}
      <div
        className="dice-tray-drawer__dice dice-tray-drawer__dice--editable"
        aria-label={`DM ${confirmation.visibility === 'public' ? '明骰' : '暗骰'}确认：${confirmation.values.length}d${confirmation.sides}`}
      >
        {draft.map((value, index) => (
          <div key={`${confirmation.id}:${index}`} className="relative flex items-center">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={`第 ${index + 1} 枚 d${confirmation.sides} 骰面`}
            value={value}
            disabled={submitting || changingMode || confirmation.busy}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft((current) => current.map(
              (item, itemIndex) => itemIndex === index ? event.target.value : item,
            ))}
            className={`dice-tray-drawer__secret-input${index === adoptedIndex ? ' dice-tray-drawer__die--adopted' : ''}`}
            data-adopted={index === adoptedIndex || undefined}
          />
          {confirmation.check && valid && index === (adoptedIndex ?? 0) && <small className="dice-adopted-corner" aria-label="采用">✓</small>}
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={!valid || submitting || changingMode || confirmation.busy}
        onClick={() => void submit()}
        className="dice-tray-drawer__secret-confirm"
        data-testid="dice-tray-secret-confirm"
      >
        {submitting || confirmation.busy ? '提交中…' : '确认'}
      </button>
    </div>
  )
}

/** Highest-layer visual consumers of already-authoritative dice outcomes. */
export default function DicePresentationOverlays(props: DicePresentationOverlaysProps) {
  const {
    roll,
    diceBoxD20,
    diceBoxRoll,
    rollRequestPreview,
    activeRollStatus,
    secretConfirmation: pendingConfirmation,
    playerRollPrompt: pendingPlayerRollPrompt,
    onDockTabChange,
  } = props
  const secretConfirmation = pendingConfirmation
  const playerRollPrompt = diceBoxD20 || diceBoxRoll ? null : pendingPlayerRollPrompt
  const [restoredHistory] = useState(() => readDiceTrayHistory(props.historyScope))
  const [lastRecord, setLastRecord] = useState<DiceTrayRecord | null>(() => restoredHistory?.record ?? null)
  const [trayOpen, setTrayOpen] = useState(() => restoredHistory ? false : props.renderFreeRollControls != null)
  const [freeRollControlsOpen, setFreeRollControlsOpen] = useState(false)
  const [freeRollVisibility, setFreeRollVisibility] = useState<'public' | 'dm'>('public')
  const [roomLogHost, setRoomLogHost] = useState<HTMLDivElement | null>(null)
  const [roomResultsHeight, setRoomResultsHeight] = useState(0)
  useEffect(() => {
    if (!roomLogHost) return
    const observer = new ResizeObserver(() => setRoomResultsHeight(roomLogHost.getBoundingClientRect().height))
    observer.observe(roomLogHost)
    return () => observer.disconnect()
  }, [roomLogHost])
  const trayLayoutStyle = { '--room-results-height': `${roomResultsHeight}px` } as CSSProperties
  const [roomOpenRequest, setRoomOpenRequest] = useState(0)
  const drawerRef = useRef<HTMLElement>(null)
  const [frameBounds, setFrameBounds] = useState<{ top: number; height: number }>()
  const setDockTab = (tab: 'log' | 'dice' | null) => {
    setTrayOpen(tab === 'dice')
    if (tab !== 'dice') setFreeRollControlsOpen(false)
    onDockTabChange?.(tab)
  }
  const rememberRecord = (record: DiceTrayRecord) => {
    writeDiceTrayHistory(props.historyScope, record, true)
    setLastRecord(record)
    setFreeRollControlsOpen(false)
    setDockTab('dice')
  }
  const activePresentationId = diceBoxD20
    ? `d20:${diceBoxD20.requestKey ?? diceBoxD20.id}`
    : diceBoxRoll
      ? `dice:${diceBoxRoll.requestKey ?? diceBoxRoll.id}`
      : rollRequestPreview
        ? `preview:${rollRequestPreview.id}`
        : null
  const hasDicePresentation = activePresentationId != null
  const animatedRecord: DiceTrayRecord | null = diceBoxD20 && activePresentationId
    ? {
        id: activePresentationId,
        check: diceBoxD20.check,
        label: activeRollStatus?.label || diceBoxD20.label || 'D20 检定',
        targetName: activeRollStatus?.targetName || diceBoxD20.targetName,
        sides: 20,
        values: diceBoxD20.value == null ? [] : [diceBoxD20.value],
        formula: activeRollStatus?.formula || '1d20',
      }
    : diceBoxRoll && activePresentationId
      ? {
          id: activePresentationId,
          check: diceBoxRoll.check,
          label: activeRollStatus?.label || diceBoxRoll.label || '效果骰',
          targetName: activeRollStatus?.targetName || diceBoxRoll.targetName,
          sides: diceBoxRoll.sides,
          dieSides: diceBoxRoll.dieSides,
          values: [...diceBoxRoll.values],
          formula: diceBoxRoll.formula || activeRollStatus?.formula || `${diceBoxRoll.totalCount ?? diceBoxRoll.count}d${diceBoxRoll.sides}`,
        }
      : rollRequestPreview && activePresentationId
        ? {
            id: activePresentationId,
            check: rollRequestPreview.check,
            label: activeRollStatus?.label || rollRequestPreview.label ||
              (rollRequestPreview.kind === 'd20' ? 'D20 检定' : '效果骰'),
            targetName: activeRollStatus?.targetName || rollRequestPreview.targetName,
            sides: rollRequestPreview.sides,
            dieSides: rollRequestPreview.dieSides,
            total: rollRequestPreview.total,
            settlement: rollRequestPreview.settlement,
            values: [...rollRequestPreview.values],
            formula: rollRequestPreview.formula || activeRollStatus?.formula || `${rollRequestPreview.count}d${rollRequestPreview.sides}`,
          }
        : null
  const secretRecord: DiceTrayRecord | null = secretConfirmation
    ? {
        id: `secret:${secretConfirmation.id}`,
        check: secretConfirmation.check,
        label: secretConfirmation.label || 'DM 暗骰',
        targetName: secretConfirmation.targetName,
        sides: secretConfirmation.sides,
        values: [...secretConfirmation.values],
        formula: `${secretConfirmation.values.length}d${secretConfirmation.sides}`,
      }
    : null
  const playerPromptRecord: DiceTrayRecord | null = playerRollPrompt
    ? {
        id: `player-prompt:${playerRollPrompt.id}`,
        check: playerRollPrompt.check,
        label: playerRollPrompt.label,
        targetName: playerRollPrompt.targetName,
        sides: playerRollPrompt.sides,
        values: [],
        formula: `${playerRollPrompt.count}d${playerRollPrompt.sides}`,
      }
    : null
  const rollRecord: DiceTrayRecord | null = roll
    ? {
      sourceRoll: roll,
      id: `result:${roll.label}:${roll.targetName}:${roll.total}:${roll.values.join(',')}`,
      label: roll.label,
      targetName: roll.targetName,
      sides: roll.sides,
      dieSides: roll.dieSides,
      values: [...roll.values],
      total: roll.total,
      settlement: roll.settlement,
      formula: diceResultFormula(roll),
    }
    : null
  const activeSettledRecord = animatedRecord && lastRecord?.id === animatedRecord.id
    ? lastRecord
    : null
  const baseRecord = secretRecord ?? activeSettledRecord ?? animatedRecord ?? playerPromptRecord ?? rollRecord ?? lastRecord
  const checkResult = props.checkResult
  const displayedRecord = baseRecord && checkResult?.rollId && baseRecord.id.includes(checkResult.rollId)
    ? { ...baseRecord, check: { mode: checkResult.mode ?? 'normal', kind: checkResult.kind, success: checkResult.success, modifier: checkResult.modifier } }
    : baseRecord
  const adoptedIndex = adoptedD20Index(displayedRecord?.values ?? [], displayedRecord?.check)
  const hasActivePresentation = pendingConfirmation != null || playerRollPrompt != null || hasDicePresentation
  const activePresentationSettled = secretConfirmation != null || activeSettledRecord != null
  const showFreeRollControls = freeRollControlsOpen && !hasActivePresentation &&
    props.renderFreeRollControls != null
  // Keep the dice types visible throughout rolling and DM confirmation.
  const showFreeRollQuickbar = !showFreeRollControls && props.renderFreeRollControls != null
  const requestedDockTab = props.dockTab === undefined ? (trayOpen ? 'dice' : null) : props.dockTab
  const visibleDockTab = hasActivePresentation || props.checkOutcome ? 'dice' : requestedDockTab
  const drawerOpen = visibleDockTab != null
  // Persist predetermined values while rolling, not just after the completion
  // callback. Refresh can happen before the iframe reports that dice settled.
  const historyRecord = displayedRecord
  const historyJson = JSON.stringify(historyRecord)
  useEffect(() => {
    if (historyRecord) writeDiceTrayHistory(props.historyScope, historyRecord, visibleDockTab === 'dice')
  // JSON tracks value changes without writing again on every workspace render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.historyScope, historyJson, visibleDockTab])
  useEffect(() => {
    const drawer = drawerRef.current
    if (!drawer || visibleDockTab !== 'dice') return
    const measure = () => {
      const rect = drawer.getBoundingClientRect()
      const header = drawer.querySelector('.dice-tray-drawer__header')?.getBoundingClientRect()
      const quickControls = drawer.querySelector<HTMLElement>('.dice-tray-drawer__controls--quick')
      if (quickControls && header) quickControls.style.top = `${Math.ceil(header.bottom - rect.top + 6)}px`
      const quickbar = quickControls?.getBoundingClientRect()
      const result = drawer.querySelector('.dice-tray-drawer__result')?.getBoundingClientRect()
      const top = Math.ceil(Math.max(header?.bottom ?? rect.top, quickbar?.bottom ?? 0) + 10)
      // Reserve the result rail even before the dice finish, keeping the
      // physics viewport stable as the normal result/re-roll controls appear.
      const bottom = Math.min(result?.top ?? rect.bottom, rect.bottom - 120) - 10
      const height = Math.max(0, Math.floor(bottom - top))
      setFrameBounds((current) => current?.top === top && current.height === height ? current : { top, height })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(drawer)
    drawer.querySelectorAll('.dice-tray-drawer__header, .dice-tray-drawer__controls, .dice-tray-drawer__result').forEach((node) => observer.observe(node))
    window.addEventListener('resize', measure)
    measure()
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [drawerOpen, visibleDockTab, showFreeRollControls, showFreeRollQuickbar, displayedRecord, secretConfirmation, playerRollPrompt])
  useEffect(() => {
    if (hasActivePresentation) onDockTabChange?.('dice')
  }, [activePresentationId, hasActivePresentation, onDockTabChange, playerRollPrompt?.id, pendingConfirmation?.id])
  const showIdleFreeRollHeader = !hasActivePresentation && displayedRecord == null &&
    props.renderFreeRollControls != null
  const hasManyDisplayedDice = (displayedRecord?.values.length ?? 0) >
    (secretConfirmation ? 3 : 6)
  const displayedTotal = displayedRecord
    ? adoptedIndex != null ? displayedRecord.values[adoptedIndex]! : displayedRecord.total ?? displayedRecord.values.reduce((sum, value) => sum + value, 0)
    : 0

  const appending = diceBoxRoll?.appendFrom != null || rollRequestPreview?.appendFrom != null && !rollRequestPreview.settled
  const confirmationFaces = appending ? null : secretRecord ?? (!animatedRecord && lastRecord?.id.startsWith('secret:') ? lastRecord : null)
  const physicalRequest: PersistentDiceRequest | null = confirmationFaces ? {
    id: `confirmed-faces:${confirmationFaces.id}:${confirmationFaces.values.join(',')}`,
    staging: true,
    check: confirmationFaces.check,
    count: Math.min(MAX_DICE_POOL_COUNT, confirmationFaces.values.length),
    sides: confirmationFaces.sides,
    values: confirmationFaces.values.slice(0, MAX_DICE_POOL_COUNT),
    label: confirmationFaces.label,
    targetName: confirmationFaces.targetName,
    onComplete: () => undefined,
  } : animatedRecord ? {
    appendFrom: diceBoxRoll?.appendFrom ?? rollRequestPreview?.appendFrom,
    id: animatedRecord.id,
    check: animatedRecord.check,
    staging: !diceBoxD20 && !diceBoxRoll && rollRequestPreview?.settled,
    count: diceBoxD20 ? 1 : diceBoxRoll?.count ?? Math.min(MAX_DICE_POOL_COUNT, rollRequestPreview?.count ?? 1),
    sides: animatedRecord.sides,
    dieSides: animatedRecord.dieSides,
    values: animatedRecord.values,
    label: animatedRecord.label,
    targetName: animatedRecord.targetName,
    settledHoldMs: diceBoxD20?.settledHoldMs ?? diceBoxRoll?.settledHoldMs,
    retainedValues: diceBoxRoll?.retainedValues,
    rerollIndex: diceBoxRoll?.rerollIndex,
    onComplete: (values) => {
      if (diceBoxRoll?.rerollIndex != null && values.length === 0) {
        props.onDiceComplete(diceBoxRoll, [])
        return
      }
      const fullValues = diceBoxRoll?.retainedValues && diceBoxRoll.rerollIndex != null
        ? diceBoxRoll.retainedValues.map((value, index) => index === diceBoxRoll.rerollIndex ? values[0] : value)
        : animatedRecord.values.length > 0 ? animatedRecord.values : values
      rememberRecord({ ...animatedRecord, values: fullValues,
        total: diceBoxRoll?.rerollIndex != null ? fullValues.reduce((sum, value) => sum + value, 0)
          : animatedRecord.total ?? fullValues.reduce((sum, value) => sum + value, 0) })
      if (diceBoxD20) props.onD20Complete(diceBoxD20, values[0])
      else if (diceBoxRoll) props.onDiceComplete(diceBoxRoll, values)
      else if (rollRequestPreview) props.onPreviewComplete(rollRequestPreview.id, 0)
    },
  } : null

  return (
    <>
      {props.checkOutcome && <DiceOverlayPortal layer="foreground">
        <div key={props.checkOutcome.id} role="status" data-testid="dice-check-outcome"
          className={`dice-check-outcome ${props.checkOutcome.success ? 'dice-check-outcome--success' : 'dice-check-outcome--failure'}`}>
          <span>{props.checkOutcome.actorName}{props.checkOutcome.targetName ? ` → ${props.checkOutcome.targetName}` : ''}</span>
          <strong>{diceCheckOutcomeLabel(props.checkOutcome)}</strong>
        </div>
      </DiceOverlayPortal>}
      <RoomDicePanel entries={props.roomRolls ?? []} besideTray={visibleDockTab === 'dice'}
        visible={visibleDockTab === 'dice'}
        historyScope={props.historyScope} logActive={drawerOpen} logHost={roomLogHost} openRequest={roomOpenRequest}
        onClear={props.onClearRoomRolls} />
      {roll && <DiceRollOverlay showCard={false} roll={roll} onDone={() => {
        if (rollRecord) setLastRecord(rollRecord)
        props.onRollDone()
      }} />}
      {drawerOpen && (
        <DiceOverlayPortal layer="backdrop">
          <aside
            className="dice-tray-drawer dice-tray-drawer--backdrop"
            data-tab={visibleDockTab ?? undefined}
            data-room-rolls={Boolean(props.roomRolls?.length)}
            style={trayLayoutStyle}
            aria-hidden="true"
          >
            <div className="dice-tray-drawer__surface" />
          </aside>
        </DiceOverlayPortal>
      )}
      <PersistentDiceTray
        check={displayedRecord?.check}
        restoredRecord={restoredHistory?.record}
        frameBounds={frameBounds}
        request={physicalRequest}
        visible={visibleDockTab === 'dice'}
        onGrabReroll={!hasActivePresentation && props.freeReroll && displayedRecord?.sourceRoll === props.freeReroll.roll
          ? props.freeReroll.onReroll : undefined}
      />
      {(displayedRecord || props.renderFreeRollControls || props.combatLogPanel) && (
        <DiceOverlayPortal layer="foreground">
          {drawerOpen && (
            <aside
              data-testid="dice-tray-drawer"
              ref={drawerRef}
              data-state="open"
              data-tab={visibleDockTab ?? undefined}
              data-room-rolls={Boolean(props.roomRolls?.length)}
              style={trayLayoutStyle}
              className="dice-tray-drawer dice-tray-drawer--foreground"
              aria-label="战斗记录与骰盘"
            >
              {visibleDockTab === 'log' ? props.combatLogPanel : <>
              <div className="dice-tray-drawer__rim" aria-hidden="true" />
              <div className="dice-tray-drawer__header">
                <div className="dice-tray-drawer__context">
                  <div className="dice-tray-drawer__context-meta">
                    <span>{showFreeRollControls ? '骰盘设置' : secretConfirmation ? (secretConfirmation.visibility === 'public' ? '明骰' : '暗骰') : playerRollPrompt ? '需要你投掷' : hasDicePresentation ? '正在投掷' : showIdleFreeRollHeader ? '骰盘' : '投掷结果'}</span>
                    <strong>{showFreeRollControls
                      ? '自由掷骰'
                      : showIdleFreeRollHeader
                        ? '待投掷'
                        : displayedRecord?.formula ?? `${displayedRecord?.values.length ?? 0}d${displayedRecord?.sides ?? 20}`}</strong>
                  </div>
                  <div className="dice-tray-drawer__title" title={showFreeRollControls || showIdleFreeRollHeader ? '自由掷骰与属性／技能鉴定' : displayedRecord?.label}>
                    {showFreeRollControls
                      ? '自由掷骰与属性／技能鉴定'
                      : showIdleFreeRollHeader
                        ? '点击骰子添加，然后投掷'
                        : displayedRecord?.label}
                  </div>
                  {!hasActivePresentation && props.renderFreeRollControls && !displayedRecord ? (
                    <div className="dice-tray-drawer__target" aria-live="polite">
                      <span>下次投掷</span>{freeRollVisibility === 'dm' ? '暗骰 · 仅 DM 可见' : '明骰 · 全房间可见'}
                    </div>
                  ) : !showFreeRollControls && displayedRecord?.targetName && (
                    <div className="dice-tray-drawer__target" title={`目标：${displayedRecord.targetName}`}>
                      <span>目标</span>{displayedRecord.targetName}{displayedRecord.check?.mode === 'advantage' ? '（优势）' : displayedRecord.check?.mode === 'disadvantage' ? '（劣势）' : ''}
                    </div>
                  )}
                </div>
                <div className="dice-tray-drawer__header-action">
                  {!hasActivePresentation && props.renderFreeRollControls && !showFreeRollControls ? (
                    <button
                      type="button"
                      className="dice-tray-drawer__mode-button"
                      onClick={() => {
                        setDockTab('dice')
                        setFreeRollControlsOpen(true)
                      }}
                    >
                      掷骰设置
                    </button>
                  ) : null}
                  {!hasActivePresentation && showFreeRollControls && props.isDM && displayedRecord ? (
                    <button
                      type="button"
                      className="dice-tray-drawer__mode-button"
                      onClick={() => {
                        setFreeRollControlsOpen(false)
                        setDockTab('dice')
                      }}
                    >
                      上次结果
                    </button>
                  ) : null}
                  {secretConfirmation ? (
                    <span className="dice-tray-drawer__status dice-tray-drawer__status--secret">
                      等待 DM 确认
                    </span>
                  ) : playerRollPrompt ? (
                    <span className="dice-tray-drawer__status dice-tray-drawer__status--rolling">
                      {playerRollPrompt.busy ? '投掷中' : '等待确认'}
                    </span>
                  ) : hasDicePresentation && !activePresentationSettled ? (
                    <span className="dice-tray-drawer__status dice-tray-drawer__status--rolling">
                      投掷中
                    </span>
                  ) : hasDicePresentation ? (
                    <span className="dice-tray-drawer__status dice-tray-drawer__status--settled">
                      已落稳
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="dice-tray-drawer__collapse"
                      onClick={() => {
                        setFreeRollControlsOpen(false)
                        setDockTab(null)
                      }}
                      aria-label="收起掷骰盘"
                    >
                      ›
                    </button>
                  )}
                  </div>
                </div>
              {showFreeRollControls || showFreeRollQuickbar ? (
                <div inert={hasActivePresentation} className={`dice-tray-drawer__controls ${showFreeRollControls
                  ? 'dice-tray-drawer__controls--expanded'
                  : 'dice-tray-drawer__controls--quick'}`}>
                  {props.renderFreeRollControls?.(() => setFreeRollControlsOpen(false), freeRollVisibility, setFreeRollVisibility)}
                </div>
              ) : null}
              {!showFreeRollControls && displayedRecord ? <div
                className={`dice-tray-drawer__result${secretConfirmation ? ' dice-tray-drawer__result--secret' : ''}${playerRollPrompt ? ' dice-tray-drawer__result--player-request' : ''}${hasManyDisplayedDice ? ' dice-tray-drawer__result--many' : ''}${displayedRecord.settlement ? ' dice-tray-drawer__result--settlement' : ''}`}
                aria-live="polite"
              >
                {secretConfirmation ? (
                  <SecretDiceTrayControls
                    key={secretConfirmation.id}
                    confirmation={secretConfirmation}
                    onConfirm={async (values) => {
                      rememberRecord({
                        ...displayedRecord,
                        values: [...values],
                        total: secretConfirmation.check ? dmAdoptedDie(values, secretConfirmation.check.mode) : values.reduce((sum, value) => sum + value, 0),
                      })
                      await props.onSecretConfirm(secretConfirmation.id, values)
                    }}
                  />
                ) : playerRollPrompt ? (
                  <div className="dice-tray-drawer__player-request" data-testid="player-dice-roll-request">
                    <div className="dice-tray-drawer__total">
                      <span>{playerPromptRecord?.formula}</span>
                      <strong aria-hidden="true">?</strong>
                    </div>
                    <p>由你完成本次投掷。结果落稳后，DM 会自动继续结算。</p>
                    <button
                      type="button"
                      disabled={playerRollPrompt.busy}
                      onClick={() => void props.onPlayerRoll?.(playerRollPrompt.id)}
                      className="dice-tray-drawer__secret-confirm"
                      data-testid="player-dice-roll-confirm"
                    >
                      {playerRollPrompt.busy ? '骰子投掷中…' : '确认并投掷'}
                    </button>
                  </div>
                ) : !hasActivePresentation || activePresentationSettled ? (
                  <>
                    {displayedRecord.check?.modifier != null && displayedRecord.values.length > 0 ? <div className="dice-tray-drawer__total">
                      <strong style={{ fontSize: 14, whiteSpace: 'nowrap' }}>{`1D20${displayedRecord.check.modifier >= 0 ? '+' : ''}${displayedRecord.check.modifier}=${displayedRecord.values[adoptedIndex ?? 0] + displayedRecord.check.modifier}`}</strong>
                    </div> : (!displayedRecord.check || displayedRecord.settlement) && <div className="dice-tray-drawer__total">
                      <span>{displayedRecord.settlement?.label ?? displayedRecord.formula ?? `${displayedRecord.values.length}d${displayedRecord.sides}`}</span>
                      <strong>{displayedTotal}</strong>
                      {displayedRecord.settlement && <span className="text-[10px] text-slate-400">{displayedRecord.formula}</span>}
                    </div>}
                    {!hasActivePresentation && props.freeReroll && displayedRecord.sourceRoll === props.freeReroll.roll ? (
                      <DiceTrayRerollControls
                        key={displayedRecord.id}
                        values={displayedRecord.values}
                        sides={displayedRecord.sides}
                        dieSides={displayedRecord.dieSides}
                        onReroll={props.freeReroll.onReroll}
                      />
                    ) : <>
                      <DiceResultValues values={displayedRecord.values} sides={displayedRecord.sides} dieSides={displayedRecord.dieSides} adoptedIndex={displayedRecord.check ? adoptedIndex ?? 0 : undefined} />
                    </>}
                  </>
                ) : (
                  <div className="dice-tray-drawer__waiting">
                    <span aria-hidden="true" />
                    骰子落稳后显示点数
                  </div>
                )}
                {displayedRecord.check && <div className="dice-check-inline" data-testid="dice-check-inline">
                  <strong>{diceCheckResultLabel(displayedRecord.check)}</strong>
                </div>}
                {displayedRecord.settlement && <div className="basis-full text-[11px] text-slate-300" data-testid="dice-damage-breakdown">
                  {displayedRecord.settlement.details.map((detail, index) => <div key={index}>{detail}</div>)}
                </div>}
              </div> : null}
              <div className="dice-tray-drawer__room-results" ref={setRoomLogHost} />
              </>}
            </aside>
          )}
          {(props.controlsHost || !drawerOpen) && (props.combatLogPanel || props.renderFreeRollControls || displayedRecord) && (
            <CombatDiceControlsPortal host={props.controlsHost}>
            <div className={props.controlsHost ? 'combat-bar-dice-controls' : 'map-combat-right-dock__recall combat-bar-dice-controls'} data-testid="right-combat-dock-recall">
              {props.combatLogPanel && <button type="button" data-testid="combat-log-toggle" title="战斗记录" aria-label="战斗记录" aria-pressed={visibleDockTab === 'log'} onClick={() => setDockTab(visibleDockTab === 'log' ? null : 'log')}><ScrollText size={16} /><span>{props.combatLogCount ?? 0}</span></button>}
              <button
                type="button"
                data-testid="dice-tray-recall"
                title="骰盘"
                aria-pressed={visibleDockTab === 'dice'}
                onClick={() => {
                  if (visibleDockTab !== 'dice') setRoomOpenRequest(value => value + 1)
                  setDockTab(visibleDockTab === 'dice' ? null : 'dice')
                }}
                aria-label={displayedRecord
                  ? `展开上次掷骰结果，总值 ${displayedTotal}`
                  : '展开自由掷骰盘'}
              >
                <Dice5 size={16} />{displayedRecord ? <span>{displayedTotal}</span> : null}
              </button>
            </div>
            </CombatDiceControlsPortal>
          )}
        </DiceOverlayPortal>
      )}
    </>
  )
}

function CombatDiceControlsPortal({ host, children }: { host?: HTMLElement | null; children: ReactNode }) {
  return host ? createPortal(children, host) : children
}
