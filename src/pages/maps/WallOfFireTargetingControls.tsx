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
  const bladeActive = targeting?.spellId === 'blade-barrier' && targeting.area && !targeting.areaTargetSelected
  const genericRectActive = targeting?.spellId !== 'wall-of-fire' && targeting?.area?.shape === 'rect' &&
    targeting.area.rotatable === true && !targeting.areaTargetSelected
  const adjustableAreaActive = targeting?.spellId !== 'wall-of-fire' && targeting?.spellId !== 'blade-barrier' && !!targeting?.area && !targeting.areaTargetSelected && (
    ('minimumRadiusFeet' in targeting.area && targeting.area.minimumRadiusFeet != null) ||
    ('minimumWidthFeet' in targeting.area && targeting.area.minimumWidthFeet != null) ||
    ('minimumHeightFeet' in targeting.area && targeting.area.minimumHeightFeet != null) ||
    ('minimumLengthFeet' in targeting.area && targeting.area.minimumLengthFeet != null)
  )
  const active = wallActive || bladeActive || genericRectActive || adjustableAreaActive
  const shape = targeting?.wallOfFireShape ?? 'line'
  const angle = wallActive
    ? targeting?.wallOfFireAngleDegrees ?? 0
    : bladeActive
      ? targeting?.bladeBarrierAngleDegrees ?? 0
    : targeting?.areaTargetAngleDegrees ?? 0
  const side = targeting?.wallOfFireDamagingSide ?? (shape === 'ring' ? 'outside' : 'right')
  const lengthFeet = targeting?.wallOfFireLengthFeet ?? 60
  const diameterFeet = targeting?.wallOfFireDiameterFeet ?? 20
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
      patch(wallActive ? { wallOfFireAngleDegrees: nextAngle } : bladeActive ? { bladeBarrierAngleDegrees: nextAngle } : { areaTargetAngleDegrees: nextAngle })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, angle, bladeActive, patch, shape, wallActive])

  if (!active) return null
  if (bladeActive) {
    const bladeShape = targeting?.bladeBarrierShape ?? 'line'
    const bladeAngle = targeting?.bladeBarrierAngleDegrees ?? 0
    const bladeLength = targeting?.bladeBarrierLengthFeet ?? 100
    const bladeDiameter = targeting?.bladeBarrierDiameterFeet ?? 60
    return <div data-testid="blade-barrier-targeting-controls" className="absolute left-1/2 top-14 z-[110] flex max-w-[min(96vw,980px)] -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded-xl border border-sky-300/50 bg-void-950/95 px-3 py-2 text-xs text-sky-50 shadow-2xl backdrop-blur-sm">
      <strong className="text-sky-200">剑刃障壁</strong>
      <button type="button" onClick={() => patch({ bladeBarrierShape: 'line' })} className={`rounded px-2 py-1 ${bladeShape === 'line' ? 'bg-sky-500/35' : 'bg-white/5'}`}>直线</button>
      <button type="button" onClick={() => patch({ bladeBarrierShape: 'ring' })} className={`rounded px-2 py-1 ${bladeShape === 'ring' ? 'bg-sky-500/35' : 'bg-white/5'}`}>环形</button>
      {bladeShape === 'line' ? <>
        <label className="flex items-center gap-2">长度<input aria-label="剑刃障壁长度" type="range" min="5" max="100" step="5" value={bladeLength} onChange={(event) => patch({ bladeBarrierLengthFeet: Number(event.target.value), areaTargetWidthFeet: Number(event.target.value) })} className="w-36 accent-sky-400" /><output className="w-14">{bladeLength} 尺</output></label>
        <label className="flex items-center gap-2">角度<input aria-label="剑刃障壁角度" type="range" min="0" max="359" step="1" value={bladeAngle} onChange={(event) => patch({ bladeBarrierAngleDegrees: Number(event.target.value), areaTargetAngleDegrees: Number(event.target.value) })} className="w-40 accent-sky-400" /><output className="w-11">{Math.round(bladeAngle)}°</output></label>
      </> : <label className="flex items-center gap-2">直径<input aria-label="剑刃障壁环形直径" type="range" min="5" max="60" step="5" value={bladeDiameter} onChange={(event) => patch({ bladeBarrierDiameterFeet: Number(event.target.value) })} className="w-32 accent-sky-400" /><output className="w-14">{bladeDiameter} 尺</output></label>}
      <span className="text-slate-400">Q / E 微调 5° · 移动鼠标预览，点击地图确认</span>
    </div>
  }
  if (adjustableAreaActive && targeting?.area) {
    const controls: Array<{ key: 'areaTargetRadiusFeet' | 'areaTargetWidthFeet' | 'areaTargetHeightFeet' | 'areaTargetLengthFeet'; label: string; min: number; max: number; value: number }> = []
    if (targeting.area.shape === 'circle' && targeting.area.minimumRadiusFeet != null) controls.push({
      key: 'areaTargetRadiusFeet', label: '半径', min: targeting.area.minimumRadiusFeet, max: targeting.area.radiusFeet,
      value: targeting.areaTargetRadiusFeet ?? targeting.area.radiusFeet,
    })
    if ((targeting.area.shape === 'rect' || targeting.area.shape === 'line') && targeting.area.minimumWidthFeet != null) controls.push({
      key: 'areaTargetWidthFeet', label: '宽度', min: targeting.area.minimumWidthFeet, max: targeting.area.widthFeet,
      value: targeting.areaTargetWidthFeet ?? targeting.area.widthFeet,
    })
    if (targeting.area.shape === 'rect' && targeting.area.minimumHeightFeet != null) controls.push({
      key: 'areaTargetHeightFeet', label: '长度', min: targeting.area.minimumHeightFeet, max: targeting.area.heightFeet,
      value: targeting.areaTargetHeightFeet ?? targeting.area.heightFeet,
    })
    if ((targeting.area.shape === 'line' || targeting.area.shape === 'cone') && targeting.area.minimumLengthFeet != null) controls.push({
      key: 'areaTargetLengthFeet', label: '长度', min: targeting.area.minimumLengthFeet, max: targeting.area.lengthFeet,
      value: targeting.areaTargetLengthFeet ?? targeting.area.lengthFeet,
    })
    return (
      <div data-testid="adjustable-area-targeting-controls" className="absolute left-1/2 top-14 z-[110] flex max-w-[min(96vw,900px)] -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded-xl border border-cyan-300/50 bg-void-950/95 px-3 py-2 text-xs text-cyan-50 shadow-2xl backdrop-blur-sm">
        <strong className="text-cyan-200">调整法术范围</strong>
        {controls.map((control) => <label key={control.key} className="flex items-center gap-2">{control.label}
          <input aria-label={`法术范围${control.label}`} type="range" min={control.min} max={control.max} step="5" value={control.value} onChange={(event) => patch({ [control.key]: Number(event.target.value) })} className="w-36 accent-cyan-400" />
          <output className="w-12 tabular-nums">{control.value} 尺</output>
        </label>)}
        {targeting.area.shape === 'rect' && targeting.area.rotatable ? <label className="flex items-center gap-2">角度
          <input aria-label="法术范围角度" type="range" min="0" max="359" step="1" value={angle} onChange={(event) => patch({ areaTargetAngleDegrees: Number(event.target.value) })} className="w-40 accent-cyan-400" />
          <output className="w-11 tabular-nums">{Math.round(angle)}°</output>
        </label> : null}
        <span className="text-slate-400">移动鼠标预览，点击地图确认；Host 会重新校验尺寸。</span>
      </div>
    )
  }
  if (genericRectActive) return (
    <div data-testid="rotatable-rect-targeting-controls" className="absolute left-1/2 top-14 z-[110] flex max-w-[min(96vw,820px)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-cyan-300/50 bg-void-950/95 px-3 py-2 text-xs text-cyan-50 shadow-2xl backdrop-blur-sm">
      <strong className="text-cyan-200">长方形范围</strong>
      <label className="flex items-center gap-2">角度
        <input aria-label="长方形范围角度" type="range" min="0" max="359" step="1" value={angle} onChange={(event) => patch({ areaTargetAngleDegrees: Number(event.target.value) })} className="w-48 accent-cyan-400" />
        <output className="w-11 tabular-nums">{Math.round(angle)}°</output>
      </label>
      <span className="text-slate-400">Q / E 微调 5° · 移动鼠标选择中心 · 点击地图确认</span>
    </div>
  )
  return (
    <div data-testid="wall-of-fire-targeting-controls" className="absolute left-1/2 top-14 z-[110] flex max-w-[min(96vw,980px)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-orange-300/50 bg-void-950/95 px-3 py-2 text-xs text-orange-50 shadow-2xl backdrop-blur-sm">
      <strong className="text-orange-200">火墙术</strong>
      <button type="button" onClick={() => patch({ wallOfFireShape: 'line', wallOfFireDamagingSide: side === 'left' ? 'left' : 'right' })} className={`rounded px-2 py-1 ${shape === 'line' ? 'bg-orange-500/35' : 'bg-white/5'}`}>直线</button>
      <button type="button" onClick={() => patch({ wallOfFireShape: 'ring', wallOfFireDamagingSide: side === 'inside' ? 'inside' : 'outside' })} className={`rounded px-2 py-1 ${shape === 'ring' ? 'bg-orange-500/35' : 'bg-white/5'}`}>环形</button>
      {shape === 'line' ? <>
        <label className="flex items-center gap-2">长度
          <input aria-label="火墙长度" type="range" min="5" max="60" step="5" value={lengthFeet} onChange={(event) => patch({ wallOfFireLengthFeet: Number(event.target.value) })} className="w-32 accent-orange-400" />
          <output className="w-12 tabular-nums">{lengthFeet} 尺</output>
        </label>
        <label className="flex items-center gap-2">角度
          <input aria-label="火墙角度" type="range" min="0" max="359" step="1" value={angle} onChange={(event) => patch({ wallOfFireAngleDegrees: Number(event.target.value) })} className="w-40 accent-orange-400" />
          <output className="w-10 tabular-nums">{Math.round(angle)}°</output>
        </label>
        <button type="button" onClick={() => patch({ wallOfFireDamagingSide: 'left' })} className={`rounded px-2 py-1 ${side === 'left' ? 'bg-rose-500/40' : 'bg-white/5'}`}>左侧灼热</button>
        <button type="button" onClick={() => patch({ wallOfFireDamagingSide: 'right' })} className={`rounded px-2 py-1 ${side === 'right' ? 'bg-rose-500/40' : 'bg-white/5'}`}>右侧灼热</button>
        <span className="text-slate-400">Q / E 微调 5°</span>
      </> : <>
        <label className="flex items-center gap-2">直径
          <input aria-label="火墙环形直径" type="range" min="5" max="20" step="5" value={diameterFeet} onChange={(event) => patch({ wallOfFireDiameterFeet: Number(event.target.value) })} className="w-24 accent-orange-400" />
          <output className="w-12 tabular-nums">{diameterFeet} 尺</output>
        </label>
        <button type="button" onClick={() => patch({ wallOfFireDamagingSide: 'inside' })} className={`rounded px-2 py-1 ${side === 'inside' ? 'bg-rose-500/40' : 'bg-white/5'}`}>内侧灼热</button>
        <button type="button" onClick={() => patch({ wallOfFireDamagingSide: 'outside' })} className={`rounded px-2 py-1 ${side === 'outside' ? 'bg-rose-500/40' : 'bg-white/5'}`}>外侧灼热</button>
      </>}
      <span className="text-slate-300">
        蓝色：{placeRangeFeet} 尺施法范围 · 红色：所选侧 10 尺灼烧范围 · 移动鼠标预览，点击地图确认
      </span>
    </div>
  )
}
