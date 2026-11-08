import { Link, useParams } from 'react-router-dom'
import { useCharacterStore } from '../store/characters'
import { useMapStore } from '../store/maps'
import { getRoomSession } from '../lib/roomSession'

export default function CampaignReadinessPanel() {
  const { campaignId } = useParams()
  const characters = useCharacterStore(state => state.characters)
  const maps = useMapStore(state => state.maps)
  const room = getRoomSession()
  const base = campaignId ? `/campaign/${encodeURIComponent(campaignId)}` : ''
  const current = room ? characters.filter(character => character.roomId === room.roomId) : []
  const assigned = current.filter(character => character.roomMemberId)
  const placed = new Set(maps.flatMap(map => map.tokens.map(token => token.characterId)))
  const missing = assigned.filter(character => !placed.has(character.id))
  const checks = [
    { title: '准备地图', ready: maps.length > 0, detail: maps.length ? `已有 ${maps.length} 张地图，请在开团前确认玩家视角。` : '上传地图并设置网格、墙体和视野。', to: `${base}/maps` },
    { title: '分配角色', ready: assigned.length > 0 && assigned.length === current.length, detail: current.length ? `${assigned.length} / ${current.length} 张角色已分配给房间成员。` : '先创建或导入角色，再分配给玩家。', to: `${base}/characters` },
    { title: '角色入场', ready: assigned.length > 0 && missing.length === 0, detail: missing.length ? `尚未放上地图：${missing.map(character => character.name).join('、')}` : assigned.length ? '已分配的角色都有地图棋子，请确认所在场景。' : '分配角色后，将角色放入本次场景。', to: `${base}/maps` },
  ]
  return <section className="mt-6 rounded-2xl border border-white/10 p-5" aria-label="开团准备检查">
    <h3 className="font-semibold text-slate-100">开团准备</h3>
    <p className="mt-1 text-sm text-slate-400">这些检查依据当前已加载的数据；玩家在线情况请查看下方队伍列表。规则包兼容性和玩家可见范围仍需检查。</p>
    <div className="mt-4 grid gap-3 md:grid-cols-3">{checks.map(check => <Link key={check.title} to={check.to} className="rounded-xl border border-white/10 p-4 hover:bg-white/5">
      <p className={check.ready ? 'text-emerald-300' : 'text-amber-300'}>{check.ready ? '✓' : '待准备'} · {check.title}</p>
      <p className="mt-2 text-sm text-slate-400">{check.detail}</p>
    </Link>)}</div>
  </section>
}