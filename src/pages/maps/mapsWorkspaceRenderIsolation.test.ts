import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspaceSource = readFileSync(
  new URL('../MapsWorkspacePage.tsx', import.meta.url),
  'utf8',
)
const mapCanvasSource = readFileSync(
  new URL('../../components/map/MapCanvas.tsx', import.meta.url),
  'utf8',
)
const sceneCanvasSource = readFileSync(
  new URL('../../presentation/maps/SceneCanvas.tsx', import.meta.url),
  'utf8',
)
const viewportLayerSource = readFileSync(
  new URL('../../presentation/maps/MapViewportLayer.tsx', import.meta.url),
  'utf8',
)
const panelsLayerSource = readFileSync(
  new URL('../../presentation/maps/MapWorkspacePanelsLayer.tsx', import.meta.url),
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

  it('owns canvas-only character projections behind the viewport boundary', () => {
    expect(workspaceSource).toContain('<MapViewportLayer')
    expect(workspaceSource).toContain('gridCalibrationDraft={gridCalibrationDraft}')
    expect(workspaceSource).toContain('rulesRevision={roomRulesSnapshot}')
    expect(workspaceSource).not.toContain('<SceneCanvas')
    expect(workspaceSource).not.toContain('const canvasActiveMap = useMemo(')
    expect(workspaceSource).not.toContain('const tokenBorderPresentations = useMemo(')
    expect(workspaceSource).not.toContain('const spellStatusTokenMarks:')
    expect(workspaceSource).not.toContain('const dnd5eTokenStatusMarkersByToken =')
    expect(workspaceSource).not.toContain('const shillelaghTokenIds =')
    expect(viewportLayerSource).toContain('useMapViewportCharacters(map.tokens, rulesRevision)')
    expect(viewportLayerSource).toContain('buildMapViewportPresentation(')
    expect(viewportLayerSource).toContain('<SceneCanvas')
  })

  it('keeps the campaign clock and high-cost panels outside the workspace render loop', () => {
    expect(workspaceSource).not.toContain('useBrowserSceneWorldMinute()')
    expect(workspaceSource).not.toContain('worldMinute={campaignWorldMinute}')
    expect(viewportLayerSource).toContain('useBrowserSceneWorldMinute()')
    expect(viewportLayerSource).toContain('worldMinute={worldMinute}')
    expect(workspaceSource).toContain('<MapWorkspacePanelsLayer')
    expect(workspaceSource).toContain('<MapWorkspaceInitiativePanel')
    expect(workspaceSource).toContain('<MapWorkspaceInventoryPanel')
    expect(workspaceSource).toContain('<MapWorkspaceSpellsPanel')
    expect(workspaceSource).not.toContain('<CombatLogEntryCard')
    expect(workspaceSource).not.toContain('<InitiativeTracker')
    expect(panelsLayerSource).toContain('const MemoizedMapWorkspacePanelsLayer = memo(')
    expect(panelsLayerSource).toContain('const MemoizedCombatLogEntryCard = memo(')
    expect(panelsLayerSource).toContain('const MemoizedInitiativeTracker = memo(')
    expect(panelsLayerSource).toContain('useLatestCallback(props.onInitiativeSelect)')
  })

  it('owns the scene orchestration entry in the collapsible DM toolbar', () => {
    expect(workspaceSource).toContain('data-testid="scene-orchestration-toolbar-button"')
    expect(workspaceSource).toContain('editorOpen={sceneEditorVisible}')
    expect(workspaceSource).toContain('const nextVisible = !sceneEditorVisible')
  })

  it('opens character details from map and initiative portraits without routing initiative clicks through movement', () => {
    expect(workspaceSource).toContain('const openTokenDetails = (tokenId: string) =>')
    expect(workspaceSource).toContain('if (playerCombatLocked) {\n      openTokenDetails(tokenId)')
    expect(workspaceSource).toContain('onInitiativeSelect={openTokenDetails}')
    expect(workspaceSource).toContain('onSelect={openTokenDetails}')
    expect(workspaceSource).not.toContain('onInitiativeSelect={handleSelectToken}')
  })

  it('keeps passive enemy area warnings visible without turning them into pointer-input mode', () => {
    expect(workspaceSource).toContain('const aoeHighlight = enemySpellAoeWarning?.highlight')
    expect(workspaceSource).toContain('aoeSelectMode={!playerCombatLocked && (')
    expect(workspaceSource).not.toContain('aoeSelectMode={!!enemySpellAoeWarning')
    expect(mapCanvasSource).toContain('const aoeHighlightVisible = aoeSelectMode || aoeHighlight != null')
    expect(mapCanvasSource).toContain('aoeHighlightVisible && aoeHighlight && aoeHighlight.cells.length > 0')
  })

  it('opens character details from the left character rail even while combat input is locked', () => {
    expect(workspaceSource).toContain("token.type === 'player' && token.characterId === c.id")
    expect(workspaceSource).toContain('openTokenDetails(characterToken.id)')
    expect(workspaceSource).toContain('railChars.length > 0 && !selectedCharacterToken')
    expect(workspaceSource).not.toContain('if (playerCombatLocked) return\n                    onAvatarClick(c.id)')
  })

  it('opens the dedicated player quick sheet while preserving the DM character detail panel', () => {
    expect(workspaceSource).toContain("const PlayerQuickCharacterSheet = lazy(() => import('../components/map/PlayerQuickCharacterSheet'))")
    expect(workspaceSource).toContain('isDM ? (')
    expect(workspaceSource).toContain('<MapWorkspaceCharacterDetailPanel')
    expect(workspaceSource).toContain('<PlayerQuickCharacterSheet')
    expect(workspaceSource).toContain('character={selectedCharacter}')
    expect(workspaceSource).toMatch(
      /<MapDetailPanelBoundary>\s*<PlayerQuickCharacterSheet[\s\S]*?<\/MapDetailPanelBoundary>/,
    )
  })

  it('never lets a lazy map tool replace the mounted workspace', () => {
    expect(workspaceSource).not.toContain('正在加载地图工具')
    expect(workspaceSource).not.toMatch(/return \(\s*<Suspense[^>]*>\s*<div className="h-full w-full">/)
    expect(workspaceSource).toContain('data-testid="map-viewport-loading"')
    expect(workspaceSource).toContain('<MapLazyOverlayBoundary label="正在打开怪物接管栏…">')
  })
})
