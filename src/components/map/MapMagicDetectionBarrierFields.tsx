import type { MapGeometryBlocking, MapGeometryEntityPatch } from '../../lib/mapGeometry'
import type { MagicDetectionBarrier } from '../../lib/magicDetectionBarrier'

export function MapMagicDetectionBarrierFields({entity, onChange}: {
  entity: MapGeometryBlocking; onChange: (patch: MapGeometryEntityPatch) => void
}) {
  const barrier = entity.magicDetectionBarrier
  const update = (patch: Partial<MagicDetectionBarrier>) => onChange({magicDetectionBarrier: {...barrier!, ...patch}})
  return <span className="flex items-center gap-1 text-[10px] text-slate-300">
    <label title="填写侦测魔法的物理阻挡数据。未填写时沿用该实体的视线阻挡设置。">
      <input type="checkbox" aria-label="设置魔法侦测阻挡" checked={!!barrier}
        onChange={event => onChange({magicDetectionBarrier: event.target.checked
          ? {material: 'stone', thicknessFeet: 1, leadLined: false} : undefined})} />侦测阻挡
    </label>
    {barrier && <>
      <select aria-label="侦测阻挡材质" value={barrier.material}
        className="rounded bg-void-900" onChange={event => update({material: event.target.value as MagicDetectionBarrier['material']})}>
        <option value="stone">石材</option><option value="metal">普通金属</option>
        <option value="wood-earth">木材或泥土</option><option value="other">其他</option>
      </select>
      <label>厚度（尺）<input aria-label="侦测阻挡厚度" type="number" min={0} max={10000} step="any"
        className="w-16 rounded bg-void-900" value={barrier.thicknessFeet} onChange={event => {
          const thicknessFeet = event.target.value === '' ? NaN : Number(event.target.value)
          if (Number.isFinite(thicknessFeet) && thicknessFeet >= 0 && thicknessFeet <= 10000) update({thicknessFeet})
        }} /></label>
      <label><input type="checkbox" aria-label="含铅层" checked={barrier.leadLined}
        onChange={event => update({leadLined: event.target.checked})} />含铅层</label>
    </>}
  </span>
}
