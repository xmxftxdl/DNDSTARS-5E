import { BellRing, ChevronRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { getRoomSession } from '../lib/roomSession'
import { useRoomCommunicationsStore } from '../store/roomCommunications'

export default function RoomHandoutNotification() {
  const location = useLocation()
  const unread = useRoomCommunicationsStore((state) => state.unreadHandoutIds.length)
  const session = getRoomSession()
  const communicationsPath = session
    ? `/campaign/${encodeURIComponent(session.campaignId ?? session.roomId)}/communications`
    : '/communications'
  if (session?.role !== 'player' || unread < 1 || location.pathname === communicationsPath) return null
  return (
    <Link
      to={`${communicationsPath}?tab=handouts`}
      className="fixed right-6 top-6 z-[120] flex max-w-sm items-center gap-3 rounded-2xl border border-amber-300/25 bg-slate-950/95 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur transition hover:border-amber-300/45"
    >
      <span className="rounded-xl bg-amber-400/15 p-2 text-amber-200"><BellRing className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-100">收到 {unread} 份新讲义</span>
        <span className="mt-0.5 block text-xs text-slate-500">点击查看 DM 分发的线索</span>
      </span>
      <ChevronRight className="h-4 w-4 text-slate-500" />
    </Link>
  )
}
