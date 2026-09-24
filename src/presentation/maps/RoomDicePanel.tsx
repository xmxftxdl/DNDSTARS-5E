import { diceCheckModeLabel } from './diceCheckPresentation'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp, ScrollText, X } from 'lucide-react'
import DiceOverlayPortal from '../../components/DiceOverlayPortal'
import type { RoomDiceEntry } from './roomDiceFeed'
import { dismissRoomDice, roomDiceDismissed, loadRoomDiceDismissal, saveRoomDiceDismissal } from './roomDiceDismissal'

const statusLabels = { waiting: '等待投掷', review: '待 DM 确认', confirmed: 'DM 已确认', result: '已完成' }

/** Companion history; all adjudication stays in the dice tray. */
export default function RoomDicePanel({ entries, besideTray, onClear, historyScope, logActive, logHost, openRequest = 0, visible = true }: {
  visible?: boolean
  onClear?: () => void
  historyScope?: string
  logActive?: boolean
  logHost?: HTMLElement | null
  openRequest?: number
  entries: readonly RoomDiceEntry[]; besideTray: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const [dismissal, setDismissal] = useState(() => loadRoomDiceDismissal(historyScope))
  const [previousOpenRequest, setPreviousOpenRequest] = useState(openRequest)
  if (previousOpenRequest !== openRequest) {
    setPreviousOpenRequest(openRequest)
    setDismissal(null)
    setExpanded(true)
  }
  useEffect(() => {
    if (!openRequest) return
    saveRoomDiceDismissal(historyScope, null)
  }, [openRequest, historyScope])
  if (!visible || !entries.length || roomDiceDismissed(entries, dismissal) || (logActive && !logHost)) return null
  const panel = <section className={`room-dice-panel${logActive ? ' room-dice-panel--inline' : besideTray ? ' room-dice-panel--beside' : ''}`} aria-label="投掷记录">
      <div className="room-dice-panel__heading">
      <button className="room-dice-panel__header" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
        <ScrollText size={14} /><span>投掷记录</span><small>{entries.length}</small>{expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
      <button type="button" className="room-dice-panel__close" aria-label="关闭并清空已完成的投掷记录" title="关闭并清空已完成投掷，历史保留在记录中" onClick={() => {
        const next = dismissRoomDice(entries)
        setDismissal(next)
        saveRoomDiceDismissal(historyScope, next)
        onClear?.()
      }}><X size={14} /></button>
      </div>
      {expanded && <div className="room-dice-panel__list" tabIndex={0} aria-label="投掷记录结果列表" onWheel={event => event.stopPropagation()}>
        {entries.map(entry => <details key={entry.id} className="room-dice-panel__card">
          <summary>
            <span className="room-dice-panel__face"><b>{entry.total ?? '…'}</b></span>
            <span className="room-dice-panel__identity"><strong>{entry.rollerName}</strong><span>{entry.label}</span><small>{statusLabels[entry.status]}</small></span>
            <span className="room-dice-panel__formula">{entry.formula}</span>
          </summary>
          <div className="room-dice-panel__detail">
            {entry.targetName && <p>目标：{entry.targetName}</p>}
            <div aria-label="各骰点数">{entry.values.map((value, index) => <span key={index}>d{entry.dieSides?.[index] ?? entry.sides} · {value}</span>)}</div>
            <p>{entry.check ? diceCheckModeLabel(entry.check) : entry.formula}{entry.total == null ? ' · 尚未返回骰值' : ` = ${entry.total}`}</p>
            {entry.bonus != null && entry.total != null && <p>
              骰点 {entry.total - entry.bonus} {entry.bonus >= 0 ? '+' : '−'} 加值 {Math.abs(entry.bonus)} = {entry.total}
            </p>}
          </div>
        </details>)}
      </div>}
    </section>
  return logActive && logHost ? createPortal(panel, logHost) : <DiceOverlayPortal layer="foreground">{panel}</DiceOverlayPortal>
}
