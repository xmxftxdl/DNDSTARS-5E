import { useState, type ReactNode } from 'react'
import DiceRollOverlay, { type DiceRoll } from '../../components/DiceRollOverlay'
import DiceBoxD20Overlay from '../../components/DiceBoxD20Overlay'
import DiceBoxRollOverlay from '../../components/DiceBoxRollOverlay'
import DiceOverlayPortal from '../../components/DiceOverlayPortal'
import type {
  DiceBoxD20Request,
  DiceBoxRollRequest,
  SharedRollRequestPreview,
} from './useDicePresentation'
import type { ActiveDiceRollStatusView } from './diceRollStatusModel'

export interface DiceTraySecretConfirmation {
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
  roll: DiceRoll | null
  diceBoxD20: DiceBoxD20Request | null
  diceBoxRoll: DiceBoxRollRequest | null
  rollRequestPreview: SharedRollRequestPreview | null
  activeRollStatus: ActiveDiceRollStatusView | null
  secretConfirmation: DiceTraySecretConfirmation | null
  playerRollPrompt?: DiceTrayPlayerRollPrompt | null
  isDM: boolean
  renderFreeRollControls?: (close: () => void) => ReactNode
  onRollDone: () => void
  onD20Complete: (request: DiceBoxD20Request, value: number) => void
  onDiceComplete: (request: DiceBoxRollRequest, values: number[]) => void
  onPreviewComplete: (id: string, delayMs: number) => void
  onSecretConfirm: (id: string, values: number[]) => void | Promise<void>
  onPlayerRoll?: (id: string) => void | Promise<void>
}

interface DiceTrayRecord {
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
        <span>暗骰总值</span>
        <strong>{total}</strong>
      </div>
      <div
        className="dice-tray-drawer__dice dice-tray-drawer__dice--editable"
        aria-label={`DM 暗骰确认：${confirmation.values.length}d${confirmation.sides}`}
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
  } = props
  const [lastRecord, setLastRecord] = useState<DiceTrayRecord | null>(null)
  const [trayOpen, setTrayOpen] = useState(() => props.renderFreeRollControls != null)
  const [freeRollControlsOpen, setFreeRollControlsOpen] = useState(false)
  const rememberRecord = (record: DiceTrayRecord) => {
    setLastRecord(record)
    setFreeRollControlsOpen(false)
    setTrayOpen(true)
  }
  const activePresentationId = diceBoxD20
    ? `d20:${diceBoxD20.id}`
    : diceBoxRoll
      ? `dice:${diceBoxRoll.id}`
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
  // The quick shelf is the tray's default idle mode and returns after the
  // physical dice settle. During motion the felt stays unobstructed, and during
  // DM secret confirmation the editable result rail owns the interaction layer.
  const showFreeRollQuickbar = !showFreeRollControls &&
    secretConfirmation == null &&
    playerRollPrompt == null &&
    props.renderFreeRollControls != null &&
    (!hasDicePresentation || activePresentationSettled)
  const drawerOpen = hasActivePresentation || trayOpen
  const showIdleFreeRollHeader = !hasActivePresentation && displayedRecord == null &&
    props.renderFreeRollControls != null
  const hasManyDisplayedDice = (displayedRecord?.values.length ?? 0) >
    (secretConfirmation ? 3 : 6)
  const displayedTotal = displayedRecord
    ? displayedRecord.total ?? displayedRecord.values.reduce((sum, value) => sum + value, 0)
    : 0

  return (
    <>
      {roll && <DiceRollOverlay showCard={false} roll={roll} onDone={() => {
        if (rollRecord) rememberRecord(rollRecord)
        props.onRollDone()
      }} />}
      {drawerOpen && (
        <DiceOverlayPortal layer="backdrop">
          <aside
            className="dice-tray-drawer dice-tray-drawer--backdrop"
            aria-hidden="true"
          >
            <div className="dice-tray-drawer__surface" />
          </aside>
        </DiceOverlayPortal>
      )}
      {diceBoxD20 && (
        <DiceBoxD20Overlay
          key={`local-d20-${diceBoxD20.id}`}
          active
          label={diceBoxD20.label || 'D20'}
          targetName={diceBoxD20.targetName}
          value={diceBoxD20.value}
          requestId={diceBoxD20.requestKey}
          flyIndex={diceBoxD20.flyIndex}
          settledHoldMs={diceBoxD20.settledHoldMs}
          layout="left-drawer"
          onComplete={(value) => {
            rememberRecord({
              id: `d20:${diceBoxD20.id}`,
              label: activeRollStatus?.label || diceBoxD20.label || 'D20 检定',
              targetName: activeRollStatus?.targetName || diceBoxD20.targetName,
              sides: 20,
              values: [value],
              total: value,
              formula: activeRollStatus?.formula || '1d20',
            })
            props.onD20Complete(diceBoxD20, value)
          }}
        />
      )}
      {diceBoxRoll && (
        <DiceBoxRollOverlay
          key={diceBoxRoll.id}
          count={diceBoxRoll.count}
          sides={diceBoxRoll.sides}
          label={diceBoxRoll.label}
          targetName={diceBoxRoll.targetName}
          values={diceBoxRoll.values}
          requestId={diceBoxRoll.requestKey}
          flyIndex={diceBoxRoll.flyIndex}
          settledHoldMs={diceBoxRoll.settledHoldMs}
          layout="left-drawer"
          showHud={false}
          onComplete={(values) => {
            const authoritativeValues = diceBoxRoll.values.length > 0 ? diceBoxRoll.values : values
            rememberRecord({
              id: `dice:${diceBoxRoll.id}`,
              label: activeRollStatus?.label || diceBoxRoll.label || '效果骰',
              targetName: activeRollStatus?.targetName || diceBoxRoll.targetName,
              sides: diceBoxRoll.sides,
              values: [...authoritativeValues],
              total: authoritativeValues.reduce((sum, value) => sum + value, 0),
              formula: activeRollStatus?.formula || `${diceBoxRoll.totalCount ?? diceBoxRoll.count}d${diceBoxRoll.sides}`,
            })
            props.onDiceComplete(diceBoxRoll, values)
          }}
        />
      )}
      {rollRequestPreview?.kind === 'd20' && (
        <DiceBoxD20Overlay
          key={`rr-d20-${rollRequestPreview.id}`}
          active
          label={rollRequestPreview.label}
          targetName={rollRequestPreview.targetName}
          value={rollRequestPreview.values[0]}
          requestId={rollRequestPreview.id}
          layout="left-drawer"
          onComplete={(value) => {
            rememberRecord({
              id: `preview:${rollRequestPreview.id}`,
              label: activeRollStatus?.label || rollRequestPreview.label || 'D20 检定',
              targetName: activeRollStatus?.targetName || rollRequestPreview.targetName,
              sides: 20,
              values: [value],
              total: value,
              formula: activeRollStatus?.formula || '1d20',
            })
            props.onPreviewComplete(rollRequestPreview.id, 800)
          }}
        />
      )}
      {rollRequestPreview?.kind === 'dice' && (
        <DiceBoxRollOverlay
          key={`rr-dice-${rollRequestPreview.id}`}
          count={rollRequestPreview.count}
          sides={rollRequestPreview.sides}
          label={rollRequestPreview.label}
          targetName={rollRequestPreview.targetName}
          values={rollRequestPreview.values}
          requestId={rollRequestPreview.id}
          layout="left-drawer"
          showHud={false}
          onComplete={(values) => {
            const authoritativeValues = rollRequestPreview.values.length > 0
              ? rollRequestPreview.values
              : values
            rememberRecord({
              id: `preview:${rollRequestPreview.id}`,
              label: activeRollStatus?.label || rollRequestPreview.label || '效果骰',
              targetName: activeRollStatus?.targetName || rollRequestPreview.targetName,
              sides: rollRequestPreview.sides,
              values: [...authoritativeValues],
              total: authoritativeValues.reduce((sum, value) => sum + value, 0),
              formula: activeRollStatus?.formula || `${rollRequestPreview.count}d${rollRequestPreview.sides}`,
            })
            props.onPreviewComplete(rollRequestPreview.id, 1500)
          }}
        />
      )}
      {(displayedRecord || props.renderFreeRollControls) && (
        <DiceOverlayPortal layer="foreground">
          {drawerOpen && (
            <aside
              data-testid="dice-tray-drawer"
              data-state="open"
              className="dice-tray-drawer dice-tray-drawer--foreground"
              aria-label="掷骰盘"
            >
              <div className="dice-tray-drawer__rim" aria-hidden="true" />
              <div className="dice-tray-drawer__header">
                <div className="dice-tray-drawer__context">
                  <div className="dice-tray-drawer__context-meta">
                    <span>{showFreeRollControls ? '骰盘设置' : secretConfirmation ? 'DM 暗骰' : playerRollPrompt ? '需要你投掷' : hasDicePresentation ? '正在投掷' : showIdleFreeRollHeader ? '骰盘' : '投掷结果'}</span>
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
                        setTrayOpen(true)
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
                        setTrayOpen(true)
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
                        setTrayOpen(false)
                      }}
                      aria-label="收起掷骰盘"
                    >
                      ›
                    </button>
                  )}
                  </div>
                </div>
              {showFreeRollControls || showFreeRollQuickbar ? (
                <div className={`dice-tray-drawer__controls ${showFreeRollControls
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
                    <div className="dice-tray-drawer__dice" aria-label={`各骰点数：${displayedRecord.values.join('、')}`}>
                      {displayedRecord.values.map((value, index) => (
                        <span key={`${displayedRecord.id}:${index}`} className="dice-tray-drawer__die">
                          {value}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="dice-tray-drawer__waiting">
                    <span aria-hidden="true" />
                    骰子落稳后显示点数
                  </div>
                )}
              </div> : null}
            </aside>
          )}
          {!drawerOpen && (props.renderFreeRollControls || (props.isDM && displayedRecord)) && (
            <button
              type="button"
              data-testid="dice-tray-recall"
              className="dice-tray-recall"
              onClick={() => {
                setTrayOpen(true)
                setFreeRollControlsOpen(false)
              }}
              aria-label={props.isDM && displayedRecord
                ? `展开上次掷骰结果，总值 ${displayedTotal}`
                : '展开自由掷骰盘'}
            >
              <span className="dice-tray-recall__die-icon" aria-hidden="true">
                <i /><i /><i /><i /><i />
              </span>
              <span className="dice-tray-recall__copy">
                <span>骰盘</span>
                <strong>{props.isDM && displayedRecord ? `上次 ${displayedTotal}` : '自由掷骰'}</strong>
              </span>
              <span className="dice-tray-recall__chevron" aria-hidden="true">‹</span>
            </button>
          )}
        </DiceOverlayPortal>
      )}
    </>
  )
}
