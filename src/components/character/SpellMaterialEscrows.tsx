import type { Dnd5eSpellMaterialEscrow } from '../../types/inventory'

export default function SpellMaterialEscrows({ records }: { records?: readonly Dnd5eSpellMaterialEscrow[] }) {
  if (!records?.length) return null
  const reserved = records.filter(record => record.status === 'reserved')
  const consumed = records.filter(record => record.status === 'consumed').slice(-5).reverse()
  return <details className="mt-3 rounded-xl border border-amber-300/15 bg-amber-500/[0.045] p-3">
    <summary className="cursor-pointer text-xs font-semibold text-amber-100">
      施法材料{reserved.length ? ` · ${reserved.length} 份预留` : ' · 消耗记录'}
    </summary>
    <div className="mt-2 space-y-2 text-xs">
      {reserved.map(record => <div key={record.id} className="rounded-lg bg-black/15 p-2">
        <p className="font-medium text-amber-100">{record.label} · 已预留</p>
        <p className="mt-1 text-slate-300">{record.entries.map(entry => `${entry.item.name} ×${entry.quantity}`).join('、')}</p>
        <p className="mt-1 text-[11px] text-slate-500">法术结束时消耗；预留期间无法使用或转交。</p>
      </div>)}
      {consumed.length > 0 && <div className="text-[11px] text-slate-500">
        <p>最近消耗</p>
        {consumed.map(record => <p key={record.id} className="mt-1">{record.label} · 法术已结束，材料已消耗</p>)}
      </div>}
    </div>
  </details>
}
