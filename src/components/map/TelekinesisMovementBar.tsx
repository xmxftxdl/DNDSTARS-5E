import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dnd5eActivityChoiceOptionV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityContracts'
import MapMovementActionBar from './MapMovementActionBar'

export function useTelekinesisMovementChoice() {
  const [options, setOptions] = useState<readonly Dnd5eActivityChoiceOptionV1[] | null>(null)
  const [targetName, setTargetName] = useState<string | undefined>()
  const pending = useRef<((choice: Dnd5eActivityChoiceOptionV1 | undefined) => void) | null>(null)
  useEffect(() => () => { pending.current?.(undefined) }, [])
  const request = useCallback((next: readonly Dnd5eActivityChoiceOptionV1[], controlledTargetName?: string) => {
    setTargetName(controlledTargetName)
    pending.current?.(undefined)
    setOptions(next)
    return new Promise<Dnd5eActivityChoiceOptionV1 | undefined>(resolve => { pending.current = resolve })
  }, [])
  const finish = useCallback((id?: string) => {
    pending.current?.(options?.find(option => option.id === id))
    pending.current = null
    setOptions(null)
  }, [options])
  return { options, targetName, request, finish }
}

export default function TelekinesisMovementBar({ onFinish, targetName }: { targetName?: string; onFinish: (id?: string) => void }) {
  const [mode, setMode] = useState('horizontal')
  const [feet, setFeet] = useState(5)
  return <MapMovementActionBar>
    <span className="font-semibold text-sky-100">心灵遥控{targetName ? ` · ${targetName}` : ''}</span>
    <select aria-label="心灵遥控移动方式" value={mode} onChange={event => setMode(event.target.value)}
      className="rounded border border-sky-400/30 bg-void-900 px-2 py-1 text-xs text-sky-100">
      <option value="horizontal">平移 · 最多30尺</option>
      <option value="up">举起</option>
      <option value="down">放下</option>
      <option value="hold">原地控制</option>
    </select>
    {(mode === 'up' || mode === 'down') && <div className="flex items-center gap-1">
      <button type="button" aria-label="遥控距离减少5尺" disabled={feet <= 5}
        onClick={() => setFeet(value => Math.max(5, value - 5))} className="rounded px-2 py-1 text-sky-100 disabled:opacity-30">−5</button>
      <output className="min-w-16 text-center text-xs text-sky-100">{mode === 'up' ? '上升' : '下降'} {feet} 尺</output>
      <button type="button" aria-label="遥控距离增加5尺" disabled={feet >= 30}
        onClick={() => setFeet(value => Math.min(30, value + 5))} className="rounded px-2 py-1 text-sky-100 disabled:opacity-30">+5</button>
    </div>}
    <span className="text-[10px] text-slate-400">可举起不会飞行的生物 · 保持在60尺内</span>
    <button type="button" onClick={() => onFinish(mode === 'up' || mode === 'down' ? `${mode}-${feet}` : mode)}
      className="rounded-lg bg-sky-500/25 px-3 py-1 text-xs font-semibold text-sky-50 hover:bg-sky-500/35">确认</button>
    <button type="button" onClick={() => onFinish()} className="rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300">取消</button>
  </MapMovementActionBar>
}
