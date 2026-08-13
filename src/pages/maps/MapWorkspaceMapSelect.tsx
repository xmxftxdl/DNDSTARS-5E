import { memo, type Dispatch, type SetStateAction } from 'react'
import { useMapStore } from '../../store/maps'
import { selectMapWorkspaceMenuItems } from './mapWorkspaceMenuProjection'

interface MapWorkspaceMapSelectProps {
  activeMapId: string
  setSelectedTokenId: Dispatch<SetStateAction<string | null>>
}

function MapWorkspaceMapSelect({
  activeMapId,
  setSelectedTokenId,
}: MapWorkspaceMapSelectProps) {
  const items = useMapStore(selectMapWorkspaceMenuItems)
  const select = useMapStore((state) => state.select)

  return (
    <select
      value={activeMapId}
      onChange={(event) => {
        select(event.target.value)
        setSelectedTokenId(null)
      }}
      className="rounded-lg border border-white/10 bg-void-900/60 px-2 py-1 text-xs text-slate-200 outline-none focus:border-arcane-500 [&>option]:bg-void-900"
    >
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  )
}

export default memo(MapWorkspaceMapSelect)
