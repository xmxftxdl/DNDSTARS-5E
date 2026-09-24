import { useCallback, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Dnd5eSpellTargetingSession } from '../../presentation/maps/useCombatInteraction'
import { normalizeWallOfFireAngle } from '../../rulesets/dnd5e/wallOfFireGeometry'
import { moveEarthSquareTargetingPatch } from './moveEarthTargeting'

interface Props {
  inline?: boolean
  targeting: Dnd5eSpellTargetingSession | null
  setTargeting: Dispatch<SetStateAction<Dnd5eSpellTargetingSession | null>>
}

export function WallOfFireTargetingControls({ targeting, setTargeting, inline = false }: Props) {
  const controlsClassName = (color: string) => `${inline ? 'flex flex-wrap items-center gap-2 min-w-0' : 'map-combat-action-bar'} ${color} text-xs`
  const wallActive = targeting?.spellId === 'wall-of-fire' && targeting.area && !targeting.areaTargetSelected
  const bladeActive = targeting?.spellId === 'blade-barrier' && targeting.area && !targeting.areaTargetSelected
  const genericRectActive = targeting?.spellId !== 'wall-of-fire' && targeting?.area?.shape === 'rect' &&
    targeting.area.rotatable === true && !targeting.areaTargetSelected
  const moveEarthActive = targeting?.spellId === 'move-earth' && targeting.area?.shape === 'rect' &&
    !targeting.areaTargetSelected
  const adjustableAreaActive = targeting?.spellId !== 'wall-of-fire' && targeting?.spellId !== 'blade-barrier' && !!targeting?.area && !targeting.areaTargetSelected && (
    ('minimumRadiusFeet' in targeting.area && targeting.area.minimumRadiusFeet != null) ||
    ('minimumWidthFeet' in targeting.area && targeting.area.minimumWidthFeet != null) ||
    ('minimumHeightFeet' in targeting.area && targeting.area.minimumHeightFeet != null) ||
    ('minimumLengthFeet' in targeting.area && targeting.area.minimumLengthFeet != null)
  )
  const forceActive = targeting?.spellId === 'wall-of-force' && !!targeting.area && !targeting.areaTargetSelected
  const active = forceActive || wallActive || bladeActive || moveEarthActive || genericRectActive || adjustableAreaActive
  const shape = targeting?.wallOfFireShape ?? 'line'
  const angle = wallActive
    ? targeting?.wallOfFireAngleDegrees ?? 0
    : bladeActive
      ? targeting?.bladeBarrierAngleDegrees ?? 0
    : targeting?.areaTargetAngleDegrees ?? 0
  const side = targeting?.wallOfFireDamagingSide ?? (shape === 'ring' ? 'outside' : 'right')
  const lengthFeet = targeting?.wallOfFireLengthFeet ?? 60
  const diameterFeet = targeting?.wallOfFireDiameterFeet ?? 20
  const patch = useCallback((values: Partial<Dnd5eSpellTargetingSession>) => setTargeting((current) =>
    current?.area && !current.areaTargetSelected
      ? { ...current, ...values }
      : current), [setTargeting])

  useEffect(() => {
    if (!active || targeting?.spellId === 'wall-of-stone' || targeting?.spellId === 'wall-of-ice' || targeting?.spellId === 'wall-of-force' || moveEarthActive || (wallActive && shape !== 'line')) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!['q', 'e'].includes(event.key.toLowerCase())) return
      event.preventDefault()
      const nextAngle = normalizeWallOfFireAngle(angle + (event.key.toLowerCase() === 'q' ? -5 : 5))
      patch(wallActive ? { wallOfFireAngleDegrees: nextAngle } : bladeActive ? { bladeBarrierAngleDegrees: nextAngle } : { areaTargetAngleDegrees: nextAngle })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, angle, bladeActive, moveEarthActive, patch, shape, wallActive, targeting?.spellId])

  if (!active) return null
  if (targeting?.spellId === 'wall-of-stone' || targeting?.spellId === 'wall-of-ice') {
    const ice = targeting.spellId === 'wall-of-ice'
    const layout = targeting.stoneWall
    return <div className={controlsClassName('text-amber-100')}>
      <strong>{ice ? '冰墙术' : '石墙术'}</strong>
      {ice ? <span>10×10 尺 · 厚 1 尺 · AC 12 · HP 30 · 贴合实体表面</span> : (['thick', 'thin'] as const).map(mode => <button type="button" key={mode}
        className={`rounded px-2 py-1 ${(layout?.mode ?? 'thick') === mode ? 'bg-amber-500/40' : 'bg-white/5'}`}
        onClick={() => patch({ stoneWall: { mode, start: layout?.start ?? { col: 0, row: 0 }, angles: [] }, areaTargetCell: undefined })}>
        {mode === 'thick' ? '10×10 尺 · 厚 6 英寸 · HP 180' : '20×10 尺 · 厚 3 英寸 · HP 90'}</button>)}
      <span>{layout?.angles.length ?? 0}/10 段 · 点击起点，再点击各段方向（可自由转向）</span>
      <button type="button" disabled={!layout?.angles.length} onClick={() => patch({ stoneWall: { ...layout!, angles: layout!.angles.slice(0, -1) } })}>撤销一段</button>
      <button type="button" disabled={!layout?.angles.length} className="rounded bg-amber-500/30 px-2 py-1"
        onClick={() => patch({ areaTargetSelected: true })}>完成布局</button>
    </div>
  }
  if (forceActive) {
    const forceShape = targeting.wallOfForceShape ?? 'plane'
    return <div className={controlsClassName('text-violet-100')}>
      <strong>力场墙</strong>
      {(['plane', 'hemisphere', 'sphere'] as const).map((value, index) => <button key={value} type="button"
        className={`rounded px-2 py-1 ${forceShape === value ? 'bg-violet-500/40' : 'bg-white/5'}`}
        onClick={() => patch({ wallOfForceShape: value, areaTargetRadiusFeet: value === 'plane' ? undefined : 10,
          areaTargetWidthFeet: undefined, areaTargetHeightFeet: undefined, stoneWall: undefined, areaTargetCell: undefined,
          area: value === 'plane' ? { shape: 'rect', origin: 'point', widthFeet: 100, minimumWidthFeet: 10, heightFeet: 5, placeRangeFeet: 120, rotatable: true }
            : { shape: 'circle', origin: 'point', radiusFeet: 10, minimumRadiusFeet: 5, placeRangeFeet: 120 } })}>
        {['平面墙', '半球', '球体'][index]}</button>)}
      {forceShape === 'plane' ? <>
        <span>{targeting.stoneWall?.angles.length ?? 0}/10 块 · 每块 10×10 尺 · 点击起点，再点击各块方向（可自由转向）</span>
        <button type="button" disabled={!targeting.stoneWall?.angles.length} onClick={() => patch({ stoneWall: { ...targeting.stoneWall!, angles: targeting.stoneWall!.angles.slice(0, -1) } })}>撤销一块</button>
        <button type="button" disabled={!targeting.stoneWall?.angles.length} className="rounded bg-violet-500/30 px-2 py-1" onClick={() => patch({ areaTargetSelected: true })}>完成布局</button>
      </> : <label>半径 <input type="range" min="5" max="10" step="5" value={targeting.areaTargetRadiusFeet ?? 10}
        onChange={event => patch({ areaTargetRadiusFeet: Number(event.target.value) })} /> {targeting.areaTargetRadiusFeet ?? 10} 尺</label>}
      <span>{forceShape === 'hemisphere' ? '高度为穹顶底面，底部开放' : forceShape === 'sphere' ? '高度为球心，形成完整球壳' : '平面墙高 10 尺'}</span>
    </div>
  }
  if (bladeActive) {
    const bladeShape = targeting?.bladeBarrierShape ?? 'line'
    const bladeAngle = targeting?.bladeBarrierAngleDegrees ?? 0
    const bladeLength = targeting?.bladeBarrierLengthFeet ?? 100
    const bladeDiameter = targeting?.bladeBarrierDiameterFeet ?? 60
    return <div data-testid="blade-barrier-targeting-controls" className={controlsClassName('border-sky-300/50 text-sky-50')}>
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
  if (moveEarthActive && targeting?.area?.shape === 'rect') {
    const side = moveEarthSquareTargetingPatch(
      targeting.areaTargetWidthFeet ?? targeting.areaTargetHeightFeet ?? 40,
    ).areaTargetWidthFeet
    return (
      <div data-testid="move-earth-area-size-controls" className={controlsClassName('border-amber-300/55 text-amber-50')}>
        <strong className="text-amber-200">地动术区域</strong>
        <label className="flex items-center gap-2">正方形边长
          <button
            type="button"
            aria-label="减小地动术区域边长"
            onClick={() => patch(moveEarthSquareTargetingPatch(side - 5))}
            className="rounded border border-amber-300/30 bg-white/5 px-1.5 py-0.5 hover:bg-amber-400/20"
          >−</button>
          <input
            aria-label="地动术区域边长"
            type="range"
            min="5"
            max="40"
            step="5"
            value={side}
            onChange={(event) => patch(moveEarthSquareTargetingPatch(Number(event.target.value)))}
            className="w-44 accent-amber-400"
          />
          <button
            type="button"
            aria-label="增大地动术区域边长"
            onClick={() => patch(moveEarthSquareTargetingPatch(side + 5))}
            className="rounded border border-amber-300/30 bg-white/5 px-1.5 py-0.5 hover:bg-amber-400/20"
          >+</button>
          <output className="w-24 tabular-nums">{side} × {side} 尺</output>
        </label>
        <span className="text-slate-400">拖动滑块调整边长，移动鼠标预览，点击地图确认。</span>
      </div>
    )
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
      <div data-testid="adjustable-area-targeting-controls" className={controlsClassName('border-cyan-300/50 text-cyan-50')}>
        <strong className="text-cyan-200">调整法术范围</strong>
        {controls.map((control) => {
          const stepFeet = control.min % 5 !== 0 ? 2.5 : 5
          return <label key={control.key} className="flex items-center gap-2">{control.label}
          <button
            type="button"
            aria-label={`减小法术范围${control.label}`}
            onClick={() => patch({ [control.key]: Math.max(control.min, control.value - stepFeet) })}
            className="rounded border border-cyan-300/30 bg-white/5 px-1.5 py-0.5 hover:bg-cyan-400/20"
          >−</button>
          <input aria-label={`法术范围${control.label}`} type="range" min={control.min} max={control.max} step={stepFeet} value={control.value} onChange={(event) => patch({ [control.key]: Number(event.target.value) })} className="w-36 accent-cyan-400" />
          <button
            type="button"
            aria-label={`增大法术范围${control.label}`}
            onClick={() => patch({ [control.key]: Math.min(control.max, control.value + stepFeet) })}
            className="rounded border border-cyan-300/30 bg-white/5 px-1.5 py-0.5 hover:bg-cyan-400/20"
          >+</button>
          <output className="w-12 tabular-nums">{control.value} 尺</output>
        </label>
        })}
        {targeting.area.shape === 'rect' && targeting.area.rotatable ? <label className="flex items-center gap-2">角度
          <input aria-label="法术范围角度" type="range" min="0" max="359" step="1" value={angle} onChange={(event) => patch({ areaTargetAngleDegrees: Number(event.target.value) })} className="w-40 accent-cyan-400" />
          <output className="w-11 tabular-nums">{Math.round(angle)}°</output>
        </label> : null}
        <span className="text-slate-400">移动鼠标预览，点击地图确认。</span>
      </div>
    )
  }
  if (genericRectActive) return (
    <div data-testid="rotatable-rect-targeting-controls" className={controlsClassName('border-cyan-300/50 text-cyan-50')}>
      <strong className="text-cyan-200">长方形范围</strong>
      <label className="flex items-center gap-2">角度
        <input aria-label="长方形范围角度" type="range" min="0" max="359" step="1" value={angle} onChange={(event) => patch({ areaTargetAngleDegrees: Number(event.target.value) })} className="w-48 accent-cyan-400" />
        <output className="w-11 tabular-nums">{Math.round(angle)}°</output>
      </label>
      <span className="text-slate-400">Q / E 微调 5° · 移动鼠标选择中心 · 点击地图确认</span>
    </div>
  )
  return (
    <div data-testid="wall-of-fire-targeting-controls" className={controlsClassName('border-orange-300/50 text-orange-50')}>
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
    </div>
  )
}
