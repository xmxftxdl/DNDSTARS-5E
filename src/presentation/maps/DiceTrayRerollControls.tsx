import { useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'

export default function DiceTrayRerollControls({ values, sides, onReroll }: {
  values: readonly number[]
  sides: number
  onReroll: (index?: number) => Promise<void>
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const running = useRef(false)
  const dragged = useRef<number | null>(null)
  const reroll = async (index?: number) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError('')
    try {
      await onReroll(index)
      setSelected(null)
    } catch {
      setError('重投失败，请重试')
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  return <div className="dice-tray-reroll" aria-label="快速重投">
    <div className="dice-tray-drawer__dice" aria-label="点选或拖动单颗骰子重投">
      {values.map((value, index) => <button
        key={index}
        type="button"
        className="dice-tray-drawer__die"
        disabled={busy}
        draggable={!busy}
        aria-label={`选择第 ${index + 1} 颗 d${sides}，点数 ${value}`}
        aria-pressed={selected === index}
        onClick={() => setSelected(selected === index ? null : index)}
        onDragStart={(event) => {
          dragged.current = index
          setSelected(index)
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', String(index))
        }}
        onDragEnd={() => { dragged.current = null }}
      >{value}</button>)}
    </div>
    <div className="dice-tray-reroll__actions">
      <button type="button" disabled={busy || values.length === 0} onClick={() => void reroll()}>
        <RotateCcw size={14} />全部重投
      </button>
      <button
        type="button"
        disabled={busy}
        aria-disabled={selected == null || busy}
        className="dice-tray-reroll__drop"
        onClick={() => { if (selected != null) void reroll(selected) }}
        onDragOver={(event) => {
          if (!busy && dragged.current != null) event.preventDefault()
        }}
        onDrop={(event) => {
          event.preventDefault()
          const index = dragged.current
          dragged.current = null
          if (!busy && index != null) void reroll(index)
        }}
      >{busy ? '投掷中…' : selected == null ? '拖一颗到这里重投' : `重投第 ${selected + 1} 颗`}</button>
    </div>
    {error && <p role="alert">{error}</p>}
  </div>
}
