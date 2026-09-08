import { memo } from 'react'
import type { CombatDialogTone } from './useCombatDialog'
import { useEnemyTokenPortraitSync } from './useEnemyTokenPortraitSync'
import { useMapStore } from '../../store/maps'

interface EnemyTokenPortraitSyncBoundaryProps {
  enabled: boolean
  requireSharedImages: boolean
  showNotice: (title: string, message: string, tone?: CombatDialogTone) => unknown
}

/** Keeps the all-map artwork scan outside the 29k-line workspace render tree. */
function EnemyTokenPortraitSyncBoundary({
  enabled,
  requireSharedImages,
  showNotice,
}: EnemyTokenPortraitSyncBoundaryProps) {
  const maps = useMapStore((state) => state.maps)
  const updateToken = useMapStore((state) => state.updateToken)
  useEnemyTokenPortraitSync({
    enabled,
    maps,
    requireSharedImages,
    updateToken,
    showNotice,
  })
  return null
}

export default memo(EnemyTokenPortraitSyncBoundary)
