import { useMemo, useState, useSyncExternalStore } from 'react'
import { Gift, PackagePlus, Search } from 'lucide-react'
import { DND5E_SRD_ITEM_TEMPLATES } from '../../rulesets/dnd5e/items'
import { DND5E_MAGIC_ITEM_RARITY_LABELS } from '../../rulesets/dnd5e/magicItems'
import {
  dnd5eRulesPluginRegistrySnapshot,
  registeredDnd5ePluginItems,
  subscribeDnd5eRulesPluginRegistry,
} from '../../rulesets/dnd5e/pluginApi'
import { useCharacterStore } from '../../store/characters'
import { getRoomSession } from '../../lib/roomSession'
import { inventoryFailureMessage } from '../../lib/inventoryAuthority'
import type { RoomRosterMember } from '../../lib/roomApi'
import { roomCharactersOwnedByMembers } from '../../lib/playerView'
import type { Dnd5eInventoryItemTemplate } from '../../types/inventory'

const INVENTORY_CATEGORY_LABELS: Record<Dnd5eInventoryItemTemplate['category'], string> = {
  equipment: '装备',
  'magic-item': '魔法物品',
  'adventuring-gear': '冒险装备',
  consumable: '消耗品',
  tool: '工具',
  container: '容器',
}

const ITEM_USE_ECONOMY_LABELS = {
  action: '动作',
  bonusAction: '附赠动作',
  none: '无需动作',
} as const

const ITEM_CURRENCY_LABELS = {
  cp: '铜币',
  sp: '银币',
  ep: '银金币',
  gp: '金币',
  pp: '铂金币',
} as const

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
  const [identified, setIdentified] = useState(true)
  const [filter, setFilter] = useState('')
  const [notice, setNotice] = useState('')
  const pluginRevision = useSyncExternalStore(
    subscribeDnd5eRulesPluginRegistry,
    dnd5eRulesPluginRegistrySnapshot,
    dnd5eRulesPluginRegistrySnapshot,
  )
  void pluginRevision
  const allTemplates = [...DND5E_SRD_ITEM_TEMPLATES, ...registeredDnd5ePluginItems()]

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
  const templates = allTemplates.filter((item) => !query ||
    item.name.toLocaleLowerCase('zh-CN').includes(query) ||
    item.englishName?.toLocaleLowerCase('en').includes(query))
  const selectedTemplate = allTemplates.find((item) => item.id === templateId)
  const validCharacterId = targets.some((character) => character.id === characterId) ? characterId : ''

  const distribute = () => {
    if (!validCharacterId || !templateId) {
      setNotice('请先选择角色和物品。')
      return
    }
    const result = applyInventoryMutation({ type: 'grant', characterId: validCharacterId, templateId, quantity, identified: selectedTemplate?.magicItem ? identified : true })
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
            <p className="mt-0.5 text-xs text-slate-500">从 SRD 5.1 或当前房间规则包发放装备与道具；结果写入房间权威角色快照。</p>
          </div>
        </div>
        <span className="rounded-lg border border-white/8 bg-black/20 px-2.5 py-1 text-[10px] text-slate-500">{allTemplates.length} 个模板</span>
      </div>

      {selectedTemplate?.magicItem && (
        <label className="mt-3 inline-flex items-center gap-2 rounded-lg border border-fuchsia-300/10 bg-fuchsia-500/[0.04] px-3 py-2 text-xs text-fuchsia-100/80">
          <input type="checkbox" checked={identified} onChange={(event) => setIdentified(event.target.checked)} />
          分发时公开并标记为已鉴定
        </label>
      )}

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
            <optgroup label="魔法物品">
              {templates.filter((item) => !!item.magicItem).map((item) => <option key={item.id} value={item.id}>{item.name} · {DND5E_MAGIC_ITEM_RARITY_LABELS[item.magicItem!.rarity]} · {item.magicItem!.automation === 'headless' ? 'Headless' : 'DM 裁定'}</option>)}
            </optgroup>
            <optgroup label="普通装备">
              {templates.filter((item) => item.category === 'equipment' && !item.magicItem).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.source.book}</option>)}
            </optgroup>
            <optgroup label="道具">
              {templates.filter((item) => item.category !== 'equipment' && !item.magicItem).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.source.book}</option>)}
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
        <section className="mt-3 rounded-xl border border-white/8 bg-black/20 p-3" data-testid="dm-inventory-selected-item-details">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-100">{selectedTemplate.name}</p>
              {selectedTemplate.englishName && <p className="mt-0.5 text-[11px] text-slate-500">{selectedTemplate.englishName}</p>}
            </div>
            <div className="flex flex-wrap justify-end gap-1.5 text-[10px]">
              <span className="rounded-md border border-white/8 bg-white/[0.035] px-2 py-1 text-slate-400">
                {INVENTORY_CATEGORY_LABELS[selectedTemplate.category]}
              </span>
              {selectedTemplate.magicItem && (
                <>
                  <span className="rounded-md border border-violet-300/15 bg-violet-500/10 px-2 py-1 text-violet-200">
                    {DND5E_MAGIC_ITEM_RARITY_LABELS[selectedTemplate.magicItem.rarity]}
                  </span>
                  <span className="rounded-md border border-violet-300/15 bg-violet-500/10 px-2 py-1 text-violet-200">
                    {selectedTemplate.magicItem.attunement === 'required' ? '需要同调' : '无需同调'}
                  </span>
                  <span className={`rounded-md border px-2 py-1 ${selectedTemplate.magicItem.automation === 'headless' ? 'border-emerald-300/15 bg-emerald-500/10 text-emerald-200' : 'border-amber-300/15 bg-amber-500/10 text-amber-200'}`}>
                    {selectedTemplate.magicItem.automation === 'headless' ? 'Headless 已接入' : 'DM 裁定'}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="mt-3 space-y-3">
            <div className="rounded-lg border border-violet-300/15 bg-violet-500/[0.055] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200/70">完整规则效果</p>
              <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-slate-200">{selectedTemplate.rulesText}</p>
            </div>
            <div className="rounded-lg border border-white/6 bg-white/[0.02] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">物品简介</p>
              <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-slate-300">{selectedTemplate.description}</p>
            </div>
            {selectedTemplate.use?.effect.kind === 'dm-adjudication' && (
              <div className="rounded-lg border border-amber-300/12 bg-amber-500/[0.045] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/70">平台结算边界</p>
                <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-amber-50/80">{selectedTemplate.use.effect.adjudication}</p>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
            {selectedTemplate.weightLb != null && <span>重量：{selectedTemplate.weightLb} 磅</span>}
            {selectedTemplate.cost && <span>价格：{selectedTemplate.cost.amount} {ITEM_CURRENCY_LABELS[selectedTemplate.cost.currency]}</span>}
            {selectedTemplate.use && <span>使用：{ITEM_USE_ECONOMY_LABELS[selectedTemplate.use.economy]}</span>}
            {selectedTemplate.resources?.map((resource) => (
              <span key={resource.id}>{resource.label}：{resource.initial ?? resource.maximum}/{resource.maximum}（{resource.resetOn === 'dawn' ? '黎明恢复' : resource.resetOn === 'short-rest' ? '短休恢复' : resource.resetOn === 'long-rest' ? '长休恢复' : '不自动恢复'}）</span>
            ))}
            <span>来源：{selectedTemplate.source.book} · {selectedTemplate.source.license}</span>
          </div>
        </section>
      )}
      {notice && <p className="mt-3 text-xs text-emerald-300">{notice}</p>}
    </div>
  )
}
