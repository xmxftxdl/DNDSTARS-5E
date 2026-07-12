import WildernessFeatureControls from '../../classes/archer/WildernessFeatureControls'
import type { ClassFeatureKey } from '../../types/character'

export default function FeatureAuxiliaryControls({
  type,
  charId,
  battleMode,
  onActivateFeature,
}: {
  type: 'wilderness-checks'
  charId: string
  battleMode: boolean
  onActivateFeature?: (key: ClassFeatureKey) => void | Promise<void>
}) {
  if (type !== 'wilderness-checks') return null
  return (
    <WildernessFeatureControls
      charId={charId}
      battleMode={battleMode}
      onActivateFeature={onActivateFeature}
    />
  )
}
