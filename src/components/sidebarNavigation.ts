import {
  BookOpen,
  FlaskConical,
  LayoutDashboard,
  MessageSquareText,
  Swords,
  Users,
} from 'lucide-react'
import type { AppMode } from '../lib/appMode'
import type { RoomSession } from '../lib/roomSession'

const navItems = [
  { to: '/', label: '战役总览', icon: LayoutDashboard, end: true },
  { to: '/maps', label: '战斗地图', icon: Swords },
  { to: '/characters', label: '角色', icon: Users },
  { to: '/spellbook', label: '法术书', icon: BookOpen },
  { to: '/communications', label: '通讯与日志', icon: MessageSquareText },
  { to: '/simulation', label: '战斗 AI 模拟', icon: FlaskConical },
]

const playerNavItems = navItems.filter((item) =>
  item.to === '/maps' ||
  item.to === '/characters' ||
  item.to === '/spellbook' ||
  item.to === '/communications')

export function sidebarNavItems(
  mode?: AppMode,
  roomRole?: RoomSession['role'],
  campaignBasePath = '',
) {
  const selected = roomRole === 'spectator'
    ? navItems.filter((item) => item.to === '/maps')
    : mode === 'player' ? playerNavItems : navItems
  if (!campaignBasePath) return selected
  return selected.map((item) => ({
    ...item,
    to: item.to === '/' ? `${campaignBasePath}/overview` : `${campaignBasePath}${item.to}`,
    end: item.to === '/',
  }))
}
