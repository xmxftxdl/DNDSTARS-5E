import type { MapGeometryBlocking, MapGeometryEntityPatch } from '../../lib/mapGeometry'

export function MapGeometryDurabilityFields({ entity, onChange }: {
  entity: MapGeometryBlocking; onChange: (patch: MapGeometryEntityPatch) => void
}) {
  const durability = entity.dnd5eDurability
  const className = 'w-16 rounded border border-white/10 bg-void-900 px-1 py-0.5 text-slate-200'
  return <span className="flex items-center gap-1 text-[10px] text-slate-400">
    <label title="为整条选中墙线或整个物件设置耐久；局部可破坏墙段请分开绘制。留空表示未知。">最大耐久
      <input aria-label="几何最大耐久" className={className} type="number" min={1} max={1000000} step={1}
        placeholder="未记录" value={durability?.maxHitPoints ?? ''} onChange={event => {
          if (event.target.value === '') { onChange({ dnd5eDurability: undefined }); return }
          const value = Number(event.target.value)
          if (!Number.isSafeInteger(value) || value < 1 || value > 1000000) return
          onChange({ dnd5eDurability: { ...durability, maxHitPoints: value, hitPoints: Math.min(durability?.hitPoints ?? value, value), damageThreshold: durability?.damageThreshold ?? 0 } })
        }} />
    </label>
    {durability && <>
      <label>当前耐久<input aria-label="几何当前耐久" className={className} type="number" min={0} max={durability.maxHitPoints} step={1}
        value={durability.hitPoints} onChange={event => {
          const value = event.target.value === '' ? NaN : Number(event.target.value)
          if (Number.isSafeInteger(value) && value >= 0 && value <= durability.maxHitPoints) onChange({ dnd5eDurability: { ...durability, hitPoints: value } })
        }} /></label>
      <label title="单次伤害低于此值时不损失耐久；达到阈值则承受全部伤害。">伤害阈值<input aria-label="几何伤害阈值" className={className} type="number" min={0} max={1000000} step={1}
        value={durability.damageThreshold} onChange={event => {
          const value = event.target.value === '' ? NaN : Number(event.target.value)
          if (Number.isSafeInteger(value) && value >= 0 && value <= 1000000) onChange({ dnd5eDurability: { ...durability, damageThreshold: value } })
        }} /></label>
      {durability.hitPoints === 0 && <span>已摧毁</span>}
    </>}
  </span>
}
