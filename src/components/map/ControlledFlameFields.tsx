import type { MapGeometryEntityPatch, MapGeometryLight } from '../../lib/mapGeometry'

/** Keep the physical base independent of temporary spell illumination. */
export function controlledFlameBaseLightPatch(light: MapGeometryLight, patch: MapGeometryEntityPatch): MapGeometryEntityPatch {
  if (!light.controlledFlame) return patch
  return { ...patch, controlledFlame: { ...light.controlledFlame,
    brightRadiusFeet: patch.brightRadiusFeet ?? light.controlledFlame.brightRadiusFeet,
    dimRadiusFeet: patch.dimRadiusFeet ?? light.controlledFlame.dimRadiusFeet,
    color: patch.color ?? light.controlledFlame.color,
  } }
}

export function ControlledFlameFields({ light, onChange }: {
  light: MapGeometryLight; onChange: (patch: MapGeometryEntityPatch) => void
}) {
  const flame = light.controlledFlame
  return <span className="flex flex-wrap items-center gap-2 text-[10px] text-amber-100">
    <label title="记录真实火焰或可燃物，供控火等法术选择。普通灯光不会自动视为火焰。">
      <input type="checkbox" checked={!!flame} onChange={event => onChange({ controlledFlame: event.target.checked ? {
        id: light.id, magical: false, burning: light.enabled, extentFeet: 5, fuelAvailable: false,
        brightRadiusFeet: light.brightRadiusFeet, dimRadiusFeet: light.dimRadiusFeet, color: light.color, alterations: [],
      } : undefined })} /> 实体火焰／燃料
    </label>
    {flame && <>
      <label><input type="checkbox" checked={flame.burning} onChange={event => onChange({ controlledFlame: {
        ...flame, burning: event.target.checked, alterations: event.target.checked ? flame.alterations : [],
      } })} /> 正在燃烧</label>
      <label><input type="checkbox" checked={flame.magical} onChange={event => onChange({ controlledFlame: { ...flame, magical: event.target.checked } })} /> 魔法火焰</label>
      <label><input type="checkbox" checked={flame.fuelAvailable === true} onChange={event => onChange({ controlledFlame: { ...flame, fuelAvailable: event.target.checked } })} /> 有可燃物</label>
      <label>放置状态<select aria-label="燃料放置状态" value={flame.custody ?? ''} onChange={event => {
        const value = event.target.value
        if (value === '' || value === 'unattended' || value === 'carried' || value === 'worn') {
          onChange({ controlledFlame: { ...flame, custody: value || undefined } })
        }
      }}><option value="">未确认</option><option value="unattended">未被携带或穿戴</option><option value="carried">携带中</option><option value="worn">穿戴中</option></select></label>
      <label>尺寸（尺）<input type="number" aria-label="火焰或燃料尺寸（尺）" min={0.001} max={10000} step="any"
        className="ml-1 w-14 rounded border border-white/10 bg-void-900 px-1" value={flame.extentFeet}
        onChange={event => {
          const value=Number(event.target.value)
          if (Number.isFinite(value) && value>=0.001 && value<=10000) onChange({ controlledFlame: { ...flame, extentFeet: value } })
        }} /></label>
    </>}
  </span>
}
