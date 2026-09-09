import { useEffect, useRef, useState, type ReactNode } from 'react'
import DiceRollOverlay, { type DiceRoll } from '../../components/DiceRollOverlay'
import DiceTrayRerollControls from './DiceTrayRerollControls'
import PersistentDiceTray, { type PersistentDiceRequest } from './PersistentDiceTray'
import DiceOverlayPortal from '../../components/DiceOverlayPortal'
import type {
  DiceBoxD20Request,
  DiceBoxRollRequest,
  SharedRollRequestPreview,
} from './useDicePresentation'
import type { ActiveDiceRollStatusView } from './diceRollStatusModel'
import { readDiceTrayHistory, writeDiceTrayHistory } from './diceTrayHistory'

export interface DiceTraySecretConfirmation {
  visibility?: 'public' | 'dm-only'
  id: string
  label: string
  targetName: string
  sides: number
  values: readonly number[]
  busy?: boolean
}

export interface DiceTrayPlayerRollPrompt {
  id: string
  label: string
  targetName: string
  count: number
  sides: number
  busy?: boolean
}

export interface DicePresentationOverlaysProps {
  historyScope?: string
  roll: DiceRoll | null
  diceBoxD20: DiceBoxD20Request | null
  diceBoxRoll: DiceBoxRollRequest | null
  rollRequestPreview: SharedRollRequestPreview | null
  activeRollStatus: ActiveDiceRollStatusView | null
  secretConfirmation: DiceTraySecretConfirmation | null
  playerRollPrompt?: DiceTrayPlayerRollPrompt | null
  isDM: boolean
  renderFreeRollControls?: (close: () => void) => ReactNode
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
  sourceRoll?: DiceRoll
  id: string
  label: string
  targetName: string
  sides: number
  values: number[]
  total?: number
  formula?: string
}

function SecretDiceTrayControls({
  confirmation,
  onConfirm,
}: {
  confirmation: DiceTraySecretConfirmation
  onConfirm: (values: number[]) => void | Promise<void>
}) {
  const [draft, setDraft] = useState(() => confirmation.values.map(String))
  const [submitting, setSubmitting] = useState(false)
  const parsed = draft.map((value) => Number(value))
  const valid = parsed.length === confirmation.values.length && parsed.every(
    (value) => Number.isInteger(value) && value >= 1 && value <= confirmation.sides,
  )
  const total = valid ? parsed.reduce((sum, value) => sum + value, 0) : '—'

  const submit = async () => {
    if (!valid || submitting || confirmation.busy) return
    setSubmitting(true)
    try {
      await onConfirm(parsed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={`dice-tray-drawer__secret${confirmation.values.length > 3 ? ' dice-tray-drawer__secret--many' : ''}`}
      data-testid="secret-dice-override"
    >
      <div className="dice-tray-drawer__total dice-tray-drawer__total--secret">
        <span>{confirmation.visibility === 'public' ? '明骰总值 · 等待 DM 确认' : '暗骰总值 · 等待 DM 确认'}</span>
        <strong>{total}</strong>
      </div>
      <div
        className="dice-tray-drawer__dice dice-tray-drawer__dice--editable"
        aria-label={`DM ${confirmation.visibility === 'public' ? '明骰' : '暗骰'}确认：${confirmation.values.length}d${confirmation.sides}`}
      >
        {draft.map((value, index) => (
          <input
            key={`${confirmation.id}:${index}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={`第 ${index + 1} 枚 d${confirmation.sides} 骰面`}
            value={value}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft((current) => current.map(
              (item, itemIndex) => itemIndex === index ? event.target.value : item,
            ))}
            className="dice-tray-drawer__secret-input"
          />
        ))}
      </div>
      <button
        type="button"
        disabled={!valid || submitting || confirmation.busy}
        onClick={() => void submit()}
        className="dice-tray-drawer__secret-confirm"
        data-testid="dice-tray-secret-confirm"
      >
        {submitting || confirmation.busy ? '提交中…' : '确认并继续'}
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
    secretConfirmation,
    playerRollPrompt,
    onDockTabChange,
  } = props
  const [restoredHistory] = useState(() => readDiceTrayHistory(props.historyScope))
  const [lastRecord, setLastRecord] = useState<DiceTrayRecord | null>(() => restoredHistory?.record ?? null)
  const [trayOpen, setTrayOpen] = useState(() => restoredHistory?.open ?? props.renderFreeRollControls != null)
  const historyRestoredRef = useRef(false)
  useEffect(() => {
    if (historyRestoredRef.current) return
    historyRestoredRef.current = true
    if (restoredHistory?.open) onDockTabChange?.('dice')
  }, [restoredHistory, onDockTabChange])
  const [freeRollControlsOpen, setFreeRollControlsOpen] = useState(false)
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
        label: activeRollStatus?.label || diceBoxD20.label || 'D20 检定',
        targetName: activeRollStatus?.targetName || diceBoxD20.targetName,
        sides: 20,
        values: diceBoxD20.value == null ? [] : [diceBoxD20.value],
        formula: activeRollStatus?.formula || '1d20',
      }
    : diceBoxRoll && activePresentationId
      ? {
          id: activePresentationId,
          label: activeRollStatus?.label || diceBoxRoll.label || '效果骰',
          targetName: activeRollStatus?.targetName || diceBoxRoll.targetName,
          sides: diceBoxRoll.sides,
          values: [...diceBoxRoll.values],
          formula: activeRollStatus?.formula || `${diceBoxRoll.totalCount ?? diceBoxRoll.count}d${diceBoxRoll.sides}`,
        }
      : rollRequestPreview && activePresentationId
        ? {
            id: activePresentationId,
            label: activeRollStatus?.label || rollRequestPreview.label ||
              (rollRequestPreview.kind === 'd20' ? 'D20 检定' : '效果骰'),
            targetName: activeRollStatus?.targetName || rollRequestPreview.targetName,
            sides: rollRequestPreview.sides,
            values: [...rollRequestPreview.values],
            formula: activeRollStatus?.formula || `${rollRequestPreview.count}d${rollRequestPreview.sides}`,
          }
        : null
  const secretRecord: DiceTrayRecord | null = secretConfirmation
    ? {
        id: `secret:${secretConfirmation.id}`,
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
      values: [...roll.values],
      total: roll.total,
      formula: roll.formula,
    }
    : null
  const activeSettledRecord = animatedRecord && lastRecord?.id === animatedRecord.id
    ? lastRecord
    : null
  const displayedRecord = secretRecord ?? activeSettledRecord ?? animatedRecord ?? playerPromptRecord ?? rollRecord ?? lastRecord
  const hasActivePresentation = secretConfirmation != null || playerRollPrompt != null || hasDicePresentation
  const activePresentationSettled = secretConfirmation != null || activeSettledRecord != null
  const showFreeRollControls = freeRollControlsOpen && !hasActivePresentation &&
    props.renderFreeRollControls != null
  // Keep the dice types visible throughout rolling and DM confirmation.
  const showFreeRollQuickbar = !showFreeRollControls && props.renderFreeRollControls != null
  const requestedDockTab = props.dockTab === undefined ? (trayOpen ? 'dice' : null) : props.dockTab
  const visibleDockTab = hasActivePresentation ? 'dice' : requestedDockTab
  const drawerOpen = visibleDockTab != null
  // Persist predetermined values while rolling, not just after the completion
  // callback. Refresh can happen before the iframe reports that dice settled.
  const historyRecord = secretRecord ?? animatedRecord ?? rollRecord ?? lastRecord
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
      const quickbar = drawer.querySelector('.dice-tray-drawer__controls--quick')?.getBoundingClientRect()
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
  }, [activePresentationId, hasActivePresentation, onDockTabChange, playerRollPrompt?.id, secretConfirmation?.id])
  const showIdleFreeRollHeader = !hasActivePresentation && displayedRecord == null &&
    props.renderFreeRollControls != null
  const hasManyDisplayedDice = (displayedRecord?.values.length ?? 0) >
    (secretConfirmation ? 3 : 6)
  const displayedTotal = displayedRecord
    ? displayedRecord.total ?? displayedRecord.values.reduce((sum, value) => sum + value, 0)
    : 0

  const physicalRequest: PersistentDiceRequest | null = animatedRecord ? {
    id: animatedRecord.id,
    staging: rollRequestPreview?.settled,
    count: diceBoxD20 ? 1 : diceBoxRoll?.count ?? Math.min(12, rollRequestPreview?.count ?? 1),
    sides: animatedRecord.sides,
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
      rememberRecord({ ...animatedRecord, values: fullValues, total: fullValues.reduce((sum, value) => sum + value, 0) })
      if (diceBoxD20) props.onD20Complete(diceBoxD20, values[0])
      else if (diceBoxRoll) props.onDiceComplete(diceBoxRoll, values)
      else if (rollRequestPreview) props.onPreviewComplete(rollRequestPreview.id, 0)
    },
  } : null

  return (
    <>
      {roll && <DiceRollOverlay showCard={false} roll={roll} onDone={() => {
        if (rollRecord) setLastRecord(rollRecord)
        props.onRollDone()
      }} />}
      {drawerOpen && (
        <DiceOverlayPortal layer="backdrop">
          <aside
            className="dice-tray-drawer dice-tray-drawer--backdrop"
            data-tab={visibleDockTab ?? undefined}
            aria-hidden="true"
          >
            <div className="dice-tray-drawer__surface" />
          </aside>
        </DiceOverlayPortal>
      )}
      <PersistentDiceTray
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
              className="dice-tray-drawer dice-tray-drawer--foreground"
              aria-label="战斗记录与骰盘"
            >
              {props.combatLogPanel && <nav className="combat-tray-tabs" aria-label="切换战斗记录与骰盘">
                <button type="button" aria-pressed={visibleDockTab === 'log'} onClick={() => setDockTab('log')}>记录 {props.combatLogCount ?? 0}</button>
                <button type="button" aria-pressed={visibleDockTab === 'dice'} onClick={() => setDockTab('dice')}>骰盘</button>
              </nav>}
              {visibleDockTab === 'log' ? props.combatLogPanel : <>
              <div className="dice-tray-drawer__rim" aria-hidden="true" />
              <div className="dice-tray-drawer__header">
                <div className="dice-tray-drawer__context">
                  <div className="dice-tray-drawer__context-meta">
                    <span>{showFreeRollControls ? '骰盘设置' : secretConfirmation ? (secretConfirmation.visibility === 'public' ? 'DM 明骰确认' : 'DM 暗骰确认') : playerRollPrompt ? '需要你投掷' : hasDicePresentation ? '正在投掷' : showIdleFreeRollHeader ? '骰盘' : '投掷结果'}</span>
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
                  {!showFreeRollControls && displayedRecord?.targetName && (
                    <div className="dice-tray-drawer__target" title={`目标：${displayedRecord.targetName}`}>
                      <span>目标</span>{displayedRecord.targetName}
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
                  {props.renderFreeRollControls?.(() => setFreeRollControlsOpen(false))}
                </div>
              ) : null}
              {!showFreeRollControls && displayedRecord ? <div
                className={`dice-tray-drawer__result${secretConfirmation ? ' dice-tray-drawer__result--secret' : ''}${playerRollPrompt ? ' dice-tray-drawer__result--player-request' : ''}${hasManyDisplayedDice ? ' dice-tray-drawer__result--many' : ''}`}
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
                        total: values.reduce((sum, value) => sum + value, 0),
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
                    <div className="dice-tray-drawer__total">
                      <span>{displayedRecord.formula ?? `${displayedRecord.values.length}d${displayedRecord.sides}`}</span>
                      <strong>{displayedTotal}</strong>
                    </div>
                    {!hasActivePresentation && props.freeReroll && displayedRecord.sourceRoll === props.freeReroll.roll ? (
                      <DiceTrayRerollControls
                        key={displayedRecord.id}
                        values={displayedRecord.values}
                        sides={displayedRecord.sides}
                        onReroll={props.freeReroll.onReroll}
                      />
                    ) : <div className="dice-tray-drawer__dice" aria-label={`各骰点数：${displayedRecord.values.join('、')}`}>
                      {displayedRecord.values.map((value, index) => (
                        <span key={`${displayedRecord.id}:${index}`} className="dice-tray-drawer__die">{value}</span>
                      ))}
                    </div>}
                  </>
                ) : (
                  <div className="dice-tray-drawer__waiting">
                    <span aria-hidden="true" />
                    骰子落稳后显示点数
                  </div>
                )}
              </div> : null}
              </>}
            </aside>
          )}
          {!drawerOpen && (props.combatLogPanel || props.renderFreeRollControls || displayedRecord) && (
            <div className="map-combat-right-dock__recall" data-testid="right-combat-dock-recall">
              {props.combatLogPanel && <button type="button" data-testid="combat-log-toggle" onClick={() => setDockTab('log')}>记录 <span>{props.combatLogCount ?? 0}</span></button>}
              <button
                type="button"
                data-testid="dice-tray-recall"
                onClick={() => setDockTab('dice')}
                aria-label={displayedRecord
                  ? `展开上次掷骰结果，总值 ${displayedTotal}`
                  : '展开自由掷骰盘'}
              >
                骰盘{displayedRecord ? <span>{displayedTotal}</span> : null}
              </button>
            </div>
          )}
        </DiceOverlayPortal>
      )}
    </>
  )
}
