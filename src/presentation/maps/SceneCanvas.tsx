import { memo, type ComponentProps } from 'react'
import MapCanvas from '../../components/map/MapCanvas'
import { useLatestCallback } from '../hooks/useLatestCallback'

export type SceneCanvasProps = ComponentProps<typeof MapCanvas>

function useOptionalLatestCallback<Args extends unknown[], Result>(
  callback: ((...args: Args) => Result) | undefined,
): ((...args: Args) => Result) | undefined {
  const latestCallback = useLatestCallback((...args: Args) => {
    if (!callback) throw new Error('SceneCanvas callback is unavailable')
    return callback(...args)
  })
  return callback ? latestCallback : undefined
}

const MemoizedMapCanvas = memo(MapCanvas)

/**
 * Konva scene boundary. Callback refs stay stable while always delegating to
 * the latest workspace closure, so unrelated parent UI updates do not redraw
 * the canvas merely because an inline handler received a new identity.
 */
const SceneCanvas = memo(function SceneCanvas(props: SceneCanvasProps) {
  const onSelectToken = useLatestCallback(props.onSelectToken)
  const onMoveSelect = useOptionalLatestCallback(props.onMoveSelect)
  const difficultTerrainMultiplierAtPosition = useOptionalLatestCallback(
    props.difficultTerrainMultiplierAtPosition,
  )
  const speedCostMultiplierAtPosition = useOptionalLatestCallback(
    props.speedCostMultiplierAtPosition,
  )
  const onAoePreviewCell = useOptionalLatestCallback(props.onAoePreviewCell)
  const onAoeConfirm = useOptionalLatestCallback(props.onAoeConfirm)
  const onAoeCancel = useOptionalLatestCallback(props.onAoeCancel)
  const onDnd5eStatusTokenClick = useOptionalLatestCallback(props.onDnd5eStatusTokenClick)
  const onDnd5ePluginAreaVisibilityToggle = useOptionalLatestCallback(
    props.onDnd5ePluginAreaVisibilityToggle,
  )
  const onDnd5ePluginAreaClick = useOptionalLatestCallback(props.onDnd5ePluginAreaClick)
  const onGridOffsetChange = useOptionalLatestCallback(props.onGridOffsetChange)
  const onGridSizeChange = useOptionalLatestCallback(props.onGridSizeChange)
  const onBlankContextMenu = useOptionalLatestCallback(props.onBlankContextMenu)
  const onDeleteBoxConfirm = useOptionalLatestCallback(props.onDeleteBoxConfirm)
  const onDeleteCancel = useOptionalLatestCallback(props.onDeleteCancel)
  const onSceneInteractionPointClick = useOptionalLatestCallback(
    props.onSceneInteractionPointClick,
  )
  const onSceneRegionCommit = useOptionalLatestCallback(props.onSceneRegionCommit)
  const onSceneEditCancel = useOptionalLatestCallback(props.onSceneEditCancel)
  const onScenePointPlacementCommit = useOptionalLatestCallback(
    props.onScenePointPlacementCommit,
  )
  const onFogShapeCommit = useOptionalLatestCallback(props.onFogShapeCommit)
  const onFogEditCancel = useOptionalLatestCallback(props.onFogEditCancel)
  const onGeometryDetectionCandidateRemove = useOptionalLatestCallback(
    props.onGeometryDetectionCandidateRemove,
  )
  const onGeometryEntityCommit = useOptionalLatestCallback(props.onGeometryEntityCommit)
  const onGeometryEntitySelect = useOptionalLatestCallback(props.onGeometryEntitySelect)
  const onGeometryEntityDelete = useOptionalLatestCallback(props.onGeometryEntityDelete)
  const onGeometryEntityPointsChange = useOptionalLatestCallback(
    props.onGeometryEntityPointsChange,
  )
  const onGeometryDoorInteract = useOptionalLatestCallback(props.onGeometryDoorInteract)
  const onGeometrySearch = useOptionalLatestCallback(props.onGeometrySearch)
  const onGeometryEditCancel = useOptionalLatestCallback(props.onGeometryEditCancel)
  const onTokenMoveBlocked = useOptionalLatestCallback(props.onTokenMoveBlocked)
  const onTokenMoveRequest = useOptionalLatestCallback(props.onTokenMoveRequest)
  const onTokenMoveCommit = useOptionalLatestCallback(props.onTokenMoveCommit)
  const onMapPing = useOptionalLatestCallback(props.onMapPing)
  const onTabletopPoint = useOptionalLatestCallback(props.onTabletopPoint)
  const onTabletopAnnotation = useOptionalLatestCallback(props.onTabletopAnnotation)

  return (
    <MemoizedMapCanvas
      {...props}
      onSelectToken={onSelectToken}
      onMoveSelect={onMoveSelect}
      difficultTerrainMultiplierAtPosition={difficultTerrainMultiplierAtPosition}
      speedCostMultiplierAtPosition={speedCostMultiplierAtPosition}
      onAoePreviewCell={onAoePreviewCell}
      onAoeConfirm={onAoeConfirm}
      onAoeCancel={onAoeCancel}
      onDnd5eStatusTokenClick={onDnd5eStatusTokenClick}
      onDnd5ePluginAreaVisibilityToggle={onDnd5ePluginAreaVisibilityToggle}
      onDnd5ePluginAreaClick={onDnd5ePluginAreaClick}
      onGridOffsetChange={onGridOffsetChange}
      onGridSizeChange={onGridSizeChange}
      onBlankContextMenu={onBlankContextMenu}
      onDeleteBoxConfirm={onDeleteBoxConfirm}
      onDeleteCancel={onDeleteCancel}
      onSceneInteractionPointClick={onSceneInteractionPointClick}
      onSceneRegionCommit={onSceneRegionCommit}
      onSceneEditCancel={onSceneEditCancel}
      onScenePointPlacementCommit={onScenePointPlacementCommit}
      onFogShapeCommit={onFogShapeCommit}
      onFogEditCancel={onFogEditCancel}
      onGeometryDetectionCandidateRemove={onGeometryDetectionCandidateRemove}
      onGeometryEntityCommit={onGeometryEntityCommit}
      onGeometryEntitySelect={onGeometryEntitySelect}
      onGeometryEntityDelete={onGeometryEntityDelete}
      onGeometryEntityPointsChange={onGeometryEntityPointsChange}
      onGeometryDoorInteract={onGeometryDoorInteract}
      onGeometrySearch={onGeometrySearch}
      onGeometryEditCancel={onGeometryEditCancel}
      onTokenMoveBlocked={onTokenMoveBlocked}
      onTokenMoveRequest={onTokenMoveRequest}
      onTokenMoveCommit={onTokenMoveCommit}
      onMapPing={onMapPing}
      onTabletopPoint={onTabletopPoint}
      onTabletopAnnotation={onTabletopAnnotation}
    />
  )
})

export default SceneCanvas
