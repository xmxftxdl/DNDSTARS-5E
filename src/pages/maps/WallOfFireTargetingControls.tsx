import { useCallback, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Dnd5eSpellTargetingSession } from '../../presentation/maps/useCombatInteraction'
import { normalizeWallOfFireAngle } from '../../rulesets/dnd5e/wallOfFireGeometry'

interface Props {
  targeting: Dnd5eSpellTargetingSession | null
  setTargeting: Dispatch<SetStateAction<Dnd5eSpellTargetingSession | null>>
}

export function WallOfFireTargetingControls({ targeting, setTargeting }: Props) {
  const wallActive = targeting?.spellId === 'wall-of-fire' && targeting.area && !targeting.areaTargetSelected
  const genericRectActive = targeting?.spellId !== 'wall-of-fire' && targeting?.area?.shape === 'rect' &&
    targeting.area.rotatable === true && !targeting.areaTargetSelected
  const active = wallActive || genericRectActive
  const shape = targeting?.wallOfFireShape ?? 'line'
  const angle = wallActive
    ? targeting?.wallOfFireAngleDegrees ?? 0
    : targeting?.areaTargetAngleDegrees ?? 0
  const side = targeting?.wallOfFireDamagingSide ?? (shape === 'ring' ? 'outside' : 'right')
  const placeRangeFeet = targeting?.area && 'placeRangeFeet' in targeting.area
    ? targeting.area.placeRangeFeet ?? 120
    : 120
  const patch = useCallback((values: Partial<Dnd5eSpellTargetingSession>) => setTargeting((current) =>
    current?.area?.shape === 'rect' && current.area.rotatable && !current.areaTargetSelected
      ? { ...current, ...values }
      : current), [setTargeting])

  useEffect(() => {
    if (!active || (wallActive && shape !== 'line')) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!['q', 'e'].includes(event.key.toLowerCase())) return
      event.preventDefault()
      const nextAngle = normalizeWallOfFireAngle(angle + (event.key.toLowerCase() === 'q' ? -5 : 5))
      patch(wallActive ? { wallOfFireAngleDegrees: nextAngle } : { areaTargetAngleDegrees: nextAngle })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, angle, patch, shape, wallActive])

  if (!active) return null
  if (genericRectActive) return (
    <div data-testid="rotatable-rect-targeting-controls" className="absolute left-1/2 top-14 z-[112] flex max-w-[min(96vw,820px)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-cyan-300/50 bg-void-950/95 px-3 py-2 text-xs text-cyan-50 shadow-2xl backdrop-blur-sm">
      <strong className="text-cyan-200">长方形范围</strong>
      <label className="flex items-center gap-2">角度
        <input aria-label="长方形范围角度" type="range" min="0" max="359" step="1" value={angle} onChange={(event) => patch({ areaTargetAngleDegrees: Number(event.target.value) })} className="w-48 accent-cyan-400" />
        <output className="w-11 tabular-nums">{Math.round(angle)}°</output>
      </label>
      <span className="text-slate-400">Q / E 微调 5° · 移动鼠标选择中心 · 点击地图确认</span>
    </div>
  )
  return (
    <div data-testid="wall-of-fire-targeting-controls" className="absolute left-1/2 top-14 z-[112] flex max-w-[min(96vw,980px)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-orange-300/50 bg-void-950/95 px-3 py-2 text-xs text-orange-50 shadow-2xl backdrop-blur-sm">
      <strong className="text-orange-200">火墙术</strong>
      <button type="button" onClick={() => patch({ wallOfFireShape: 'line', wallOfFireDamagingSide: side === 'left' ? 'left' : 'right' })} className={`rounded px-2 py-1 ${shape === 'line' ? 'bg-orange-500/35' : 'bg-white/5'}`}>直线</button>
      <button type="button" onClick={() => patch({ wallOfFireShape: 'ring', wallOfFireDamagingSide: side === 'inside' ? 'inside' : 'outside' })} className={`rounded px-2 py-1 ${shape === 'ring' ? 'bg-orange-500/35' : 'bg-white/5'}`}>环形</button>
      {shape === 'line' ? <>
        <label className="flex items-center gap-2">角度
          <input aria-label="火墙角度" type="range" min="0" max="359" step="1" value={angle} onChange={(event) => patch({ wallOfFireAngleDegrees: Number(event.target.value) })} className="w-40 accent-orange-400" />
          <output className="w-10 tabular-nums">{Math.round(angle)}°</output>
        </label>
        <button type="button" onClick={() => patch({ wallOfFireDamagingSide: 'left' })} className={`rounded px-2 py-1 ${side === 'left' ? 'bg-rose-500/40' : 'bg-white/5'}`}>左侧灼热</button>
        <button type="button" onClick={() => patch({ wallOfFireDamagingSide: 'right' })} className={`rounded px-2 py-1 ${side === 'right' ? 'bg-rose-500/40' : 'bg-white/5'}`}>右侧灼热</button>
        <span className="text-slate-400">Q / E 微调 5°</span>
      </> : <>
        <button type="button" onClick={() => patch({ wallOfFireDamagingSide: 'inside' })} className={`rounded px-2 py-1 ${side === 'inside' ? 'bg-rose-500/40' : 'bg-white/5'}`}>内侧灼热</button>
        <button type="button" onClick={() => patch({ wallOfFireDamagingSide: 'outside' })} className={`rounded px-2 py-1 ${side === 'outside' ? 'bg-rose-500/40' : 'bg-white/5'}`}>外侧灼热</button>
      </>}
      <span className="text-slate-300">
        蓝色：{placeRangeFeet} 尺施法范围 · 红色：所选侧 10 尺灼烧范围 · 移动鼠标预览，点击地图确认
      </span>
    </div>
  )
}
