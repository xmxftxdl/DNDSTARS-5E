import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspaceSource = readFileSync(
  new URL('../MapsWorkspacePage.tsx', import.meta.url),
  'utf8',
)
const sceneCanvasSource = readFileSync(
  new URL('../../presentation/maps/SceneCanvas.tsx', import.meta.url),
  'utf8',
)

describe('MapsWorkspacePage render isolation', () => {
  it('keeps countdown and tabletop clocks outside the workspace parent', () => {
    expect(workspaceSource).toContain('const mapTabletopState = useMapTabletopState()')
    expect(workspaceSource).not.toContain('sharedDodgeNow')
    expect(workspaceSource).not.toContain('setMapTabletopState')
    expect(workspaceSource).not.toContain('MAP_TABLETOP_CHANNEL')
  })

  it('delegates unchanged DM roster identity handling to its focused hook', () => {
    expect(workspaceSource).toContain('const roomPlayerMemberIds = useRoomPlayerMemberIds(roomSession)')
    expect(workspaceSource).not.toContain('setRoomPlayerMemberIds')
  })

  it('subscribes to the active map while isolating all-map UI and artwork scans', () => {
    expect(workspaceSource).toContain('activeMap, addMap, updateMap')
    expect(workspaceSource).toContain('<MapWorkspaceMapSelect')
    expect(workspaceSource).toContain('<EnemyTokenPortraitSyncBoundary')
    expect(workspaceSource).not.toContain('maps, selectedId, select, addMap')
    expect(workspaceSource).not.toContain('useEnemyTokenPortraitSync({')
  })

  it('keeps hot canvas collections stable across unrelated workspace renders', () => {
    expect(workspaceSource).toContain('const activeMapTabletop = useMemo(')
    expect(workspaceSource).toContain('const targetSelectTokenIds = useMemo(')
    expect(workspaceSource).toContain('const optimisticTokenMoveIds = useMemo(')
    expect(workspaceSource).toContain('const playerMovableTokenIds = useMemo(')
    expect(workspaceSource).toContain('const lockDragTokenIds = useMemo(')
    expect(workspaceSource).toContain('const sceneTriggerZones = useMemo(')
    expect(workspaceSource).toContain('const sceneInteractionPoints = useMemo(')
    expect(workspaceSource).toContain('const mapEditingCoordinator = useMemo(')
    expect(workspaceSource).toContain('targetSelectTokenIds={targetSelectTokenIds}')
    expect(workspaceSource).toContain('lockDragTokenIds={lockDragTokenIds}')
    expect(workspaceSource).not.toContain('targetSelectTokenIds={[\n')
    expect(workspaceSource).not.toContain('lockDragTokenIds={[\n')
  })

  it('stabilizes interaction handlers before they reach the memoized Konva canvas', () => {
    expect(sceneCanvasSource).toContain('const MemoizedMapCanvas = memo(MapCanvas)')
    expect(sceneCanvasSource).toContain('useOptionalLatestCallback(props.onTokenMoveRequest)')
    expect(sceneCanvasSource).toContain('useOptionalLatestCallback(props.onGeometryEntityCommit)')
    expect(sceneCanvasSource).toContain('useOptionalLatestCallback(props.onTabletopAnnotation)')
  })
})
