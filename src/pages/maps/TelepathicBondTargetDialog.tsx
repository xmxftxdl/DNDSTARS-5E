import { useState } from 'react'
import type { BattleMap } from '../../store/maps'
import { isTelepathicBondCreature, type TelepathicBondTarget } from '../../rulesets/dnd5e/telepathicBondMarkers'

export function TelepathicBondTargetDialog(props: {
  maps: readonly BattleMap[]; onCancel: () => void; onConfirm: (targets: TelepathicBondTarget[]) => void;
}) {
  const [selected, setSelected] = useState<TelepathicBondTarget[]>([])
  const groups = props.maps.map(map => ({ map, tokens: map.tokens.filter(isTelepathicBondCreature) })).filter(group => group.tokens.length)
  return <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/60" onClick={props.onCancel}>
    <section role="dialog" aria-modal="true" aria-label="心灵联结目标" className="w-[420px] max-w-[95vw] rounded-xl border border-cyan-500/30 bg-[#10131c] p-5 text-slate-100 shadow-2xl" onClick={event => event.stopPropagation()}>
      <h2 className="font-bold text-cyan-200">心灵联结</h2>
      <p className="mt-2 text-sm text-slate-400">可跨地图选择最多 8 个角色（含自己、友方玩家及非敌对 NPC）。选中后添加状态；不选目标则仅结算施法消耗。</p>
      <div className="mt-4 max-h-[50vh] space-y-4 overflow-y-auto">
        {!groups.length && <p className="text-sm text-slate-400">当前没有可选择的角色。</p>}
        {groups.map(({ map, tokens }) => <fieldset key={map.id}>
          <legend className="mb-2 text-xs text-slate-400">{map.name}</legend>
          {tokens.map(token => {
            const checked = selected.some(target => target.mapId === map.id && target.tokenId === token.id)
            return <label key={token.id} className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 text-sm hover:bg-white/5">
              <input type="checkbox" checked={checked} disabled={!checked && selected.length >= 8} onChange={() => setSelected(previous => checked ? previous.filter(target => !(target.mapId === map.id && target.tokenId === token.id)) : [...previous, { mapId: map.id, tokenId: token.id }])} />
              <span>{token.label || '未命名角色'}</span>
            </label>
          })}
        </fieldset>)}
      </div>
      <div className="mt-5 flex items-center justify-end gap-3">
        <span className="mr-auto text-xs text-slate-400">已选 {selected.length}/8</span>
        <button className="rounded px-3 py-2 text-sm text-slate-300 hover:bg-white/5" onClick={props.onCancel}>取消</button>
        <button className="rounded bg-cyan-800 px-4 py-2 text-sm font-bold hover:bg-cyan-700" onClick={() => props.onConfirm(selected)}>确认施法</button>
      </div>
    </section>
  </div>
}
