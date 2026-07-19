import { useMemo, useState } from 'react'
import { Gift, PackagePlus, Search } from 'lucide-react'
import { DND5E_SRD_ITEM_TEMPLATES } from '../../rulesets/dnd5e/items'
import { useCharacterStore } from '../../store/characters'
import { getRoomSession } from '../../lib/roomSession'
import { inventoryFailureMessage } from '../../lib/inventoryAuthority'
import type { RoomRosterMember } from '../../lib/roomApi'
import { roomCharactersOwnedByMembers } from '../../lib/playerView'

export default function Dnd5eDmInventoryDistributor({
  players,
}: {
  players: readonly RoomRosterMember[]
}) {
  const session = useMemo(() => getRoomSession(), [])
  const characters = useCharacterStore((state) => state.characters)
  const applyInventoryMutation = useCharacterStore((state) => state.applyInventoryMutation)
  const [characterId, setCharacterId] = useState('')
  const [templateId, setTemplateId] = useState('srd-5.1:item:potion-of-healing')
  const [quantity, setQuantity] = useState(1)
  const [filter, setFilter] = useState('')
  const [notice, setNotice] = useState('')

  const currentMemberIds = useMemo(
    () => new Set(players.filter((player) => player.online).map((player) => player.memberId)),
    [players],
  )
  const targets = useMemo(
    () => session
      ? roomCharactersOwnedByMembers(characters, session.roomId, currentMemberIds)
      : [],
    [characters, currentMemberIds, session],
  )
  const query = filter.trim().toLocaleLowerCase('zh-CN')
  const templates = DND5E_SRD_ITEM_TEMPLATES.filter((item) => !query ||
    item.name.toLocaleLowerCase('zh-CN').includes(query) ||
    item.englishName?.toLocaleLowerCase('en').includes(query))
  const selectedTemplate = DND5E_SRD_ITEM_TEMPLATES.find((item) => item.id === templateId)
  const validCharacterId = targets.some((character) => character.id === characterId) ? characterId : ''

  const distribute = () => {
    if (!validCharacterId || !templateId) {
      setNotice('请先选择角色和物品。')
      return
    }
    const result = applyInventoryMutation({ type: 'grant', characterId: validCharacterId, templateId, quantity })
    setNotice(result.ok ? (result.message ?? '分发完成。') : inventoryFailureMessage(result.reason))
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-300/10 bg-amber-500/[0.035] p-4" data-testid="dm-inventory-distributor">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-200">
            <Gift className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">DM 分发物品</p>
            <p className="mt-0.5 text-xs text-slate-500">从 SRD 5.1 模板发放装备或道具；结果写入房间权威角色快照。</p>
          </div>
        </div>
        <span className="rounded-lg border border-white/8 bg-black/20 px-2.5 py-1 text-[10px] text-slate-500">{DND5E_SRD_ITEM_TEMPLATES.length} 个模板</span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(180px,0.8fr)_minmax(260px,1.4fr)_90px_auto]">
        <label className="space-y-1 text-xs text-slate-500">
          <span>接收角色</span>
          <select value={validCharacterId} onChange={(event) => setCharacterId(event.target.value)} className="w-full rounded-lg border border-white/10 bg-void-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400/50">
            <option value="">选择角色…</option>
            {targets.map((character) => <option key={character.id} value={character.id}>{character.name}（{character.player || '未填写玩家'}）</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-slate-500">
          <span>物品模板</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-600" />
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="筛选中英文名称" className="mb-1.5 w-full rounded-lg border border-white/10 bg-void-900/70 py-2 pl-8 pr-3 text-xs text-slate-100 outline-none focus:border-amber-400/50" />
          </div>
          <select value={templates.some((item) => item.id === templateId) ? templateId : ''} onChange={(event) => setTemplateId(event.target.value)} className="w-full rounded-lg border border-white/10 bg-void-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400/50">
            <option value="">选择物品…</option>
            <optgroup label="装备">
              {templates.filter((item) => item.category === 'equipment').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </optgroup>
            <optgroup label="道具">
              {templates.filter((item) => item.category !== 'equipment').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </optgroup>
          </select>
        </label>
        <label className="space-y-1 text-xs text-slate-500">
          <span>数量</span>
          <input type="number" min={1} max={999} value={quantity} onChange={(event) => setQuantity(Math.min(999, Math.max(1, Math.floor(Number(event.target.value) || 1))))} className="w-full rounded-lg border border-white/10 bg-void-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400/50" />
        </label>
        <div className="flex items-end">
          <button type="button" onClick={distribute} disabled={!validCharacterId || !templateId} className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300/20 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40">
            <PackagePlus className="h-4 w-4" />
            分发
          </button>
        </div>
      </div>

      {selectedTemplate && (
        <p className="mt-3 rounded-lg border border-white/6 bg-black/15 px-3 py-2 text-xs leading-relaxed text-slate-500">
          <span className="font-semibold text-slate-300">{selectedTemplate.name}：</span>{selectedTemplate.rulesText}
        </p>
      )}
      {notice && <p className="mt-3 text-xs text-emerald-300">{notice}</p>}
    </div>
  )
}
