import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspaceSource = readFileSync(
  new URL('../MapsWorkspacePage.tsx', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')
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
    expect(workspaceSource).not.toContain('<MapWorkspaceSpellsPanel')
    expect(workspaceSource).toContain('<PlayerMapSpellHotbar')
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
    expect(workspaceSource).toContain('if (playerCombatLocked && !dnd5eSpellTargeting) {\n      openTokenDetails(tokenId)')
    expect(workspaceSource).toContain('onInitiativeSelect={openTokenDetails}')
    expect(workspaceSource).toContain('onSelect={openTokenDetails}')
    expect(workspaceSource).not.toContain('onInitiativeSelect={handleSelectToken}')
  })

  it('settles attack-decoy targeting before the monster attack d20 and on-hit riders', () => {
    const monsterAttackFlowStart = workspaceSource.indexOf(
      'const monsterAttack = prepared.prepared',
    )
    const attackDecoyPrecheck = workspaceSource.indexOf(
      'const initialAttackDecoyRequirement = tranquility.passed',
      monsterAttackFlowStart,
    )
    const attackD20Roll = workspaceSource.indexOf(
      'let d20 = tranquility.passed',
      attackDecoyPrecheck,
    )
    const onHitRiderRolls = workspaceSource.indexOf(
      'const onHitEffectResolution = attackHit',
      attackDecoyPrecheck,
    )
    expect(monsterAttackFlowStart).toBeGreaterThan(-1)
    expect(attackDecoyPrecheck).toBeGreaterThan(monsterAttackFlowStart)
    expect(attackD20Roll).toBeGreaterThan(attackDecoyPrecheck)
    expect(onHitRiderRolls).toBeGreaterThan(attackDecoyPrecheck)
    expect(workspaceSource).toContain("'镜影术·分身目标判定'")
    expect(workspaceSource).toContain(
      'attackDecoyRolls: attackDecoyRolls.length > 0 ? attackDecoyRolls : undefined,',
    )
    expect(workspaceSource).toContain('const staged = await resolveDnd5eFacadeWithAirborneFalls(\n            resolvePreparedDnd5eMonsterAttack,')
    expect(
      workspaceSource.match(/const initialResolved = await resolveDnd5eFacadeWithAirborneFalls\(/g)?.length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('uses the acting character palette for creature-form attack banners', () => {
    const creatureFormBranchStart = workspaceSource.indexOf(
      'if (wildShapeActionIndex != null) {',
    )
    const normalWeaponBranchStart = workspaceSource.indexOf(
      'const attack = prepared.prepared',
      creatureFormBranchStart,
    )
    const creatureFormBranch = workspaceSource.slice(
      creatureFormBranchStart,
      normalWeaponBranchStart,
    )
    expect(creatureFormBranchStart).toBeGreaterThan(-1)
    expect(normalWeaponBranchStart).toBeGreaterThan(creatureFormBranchStart)
    expect(creatureFormBranch).toContain('character: wildShapeActorCharacter,')
    expect(creatureFormBranch).not.toContain("classId: 'druid'")
  })

  it('keeps passive enemy area warnings visible without turning them into pointer-input mode', () => {
    expect(workspaceSource).toContain('const aoeHighlight = enemySpellAoeWarning?.highlight')
    expect(workspaceSource).toContain('aoeSelectMode={mapAoeSelectMode({')
    expect(workspaceSource).not.toContain('aoeSelectMode={!!enemySpellAoeWarning')
    expect(mapCanvasSource).toContain('const aoeHighlightVisible = aoeSelectMode || aoeHighlight != null')
    expect(mapCanvasSource).toContain('aoeHighlightVisible && aoeHighlight && aoeHighlight.cells.length > 0')
  })

  it('routes manual monster breath weapons through map area selection instead of creature selection', () => {
    expect(workspaceSource).toContain('activeManualMonsterMapAreaEffect?.area ??')
    expect(workspaceSource).toContain("'monster-area',")
    expect(workspaceSource).toContain(
      'activeManualMonsterMapAreaEffect ? [] : manualMonsterAttackTargetIds,',
    )
    const manualAreaBranch = workspaceSource.indexOf('if (\n      activeManualMonsterMapAreaEffect &&')
    const monsterSpellAreaBranch = workspaceSource.indexOf(
      'if (activeManualMonsterSpellTargeting?.area && activeMap)',
      manualAreaBranch,
    )
    expect(manualAreaBranch).toBeGreaterThan(-1)
    expect(monsterSpellAreaBranch).toBeGreaterThan(manualAreaBranch)
    expect(workspaceSource.slice(manualAreaBranch, monsterSpellAreaBranch)).toContain(
      'dnd5eMonsterAreaActionTargetIds({',
    )
  })

  it('keeps player spell area selection interactive after an ended combat locks other map actions', () => {
    expect(workspaceSource).toContain('const playerSpellAoeSelectActive = !!dnd5eSpellTargeting && (')
    expect(workspaceSource).toContain('!!activeAoeTargeting || dnd5eSpellTargeting.guessedTargeting === true')
    expect(workspaceSource).toContain('aoeSelectMode={mapAoeSelectMode({')
  })

  it('offers an accessible creature picker for non-area spell targeting', () => {
    expect(workspaceSource).toContain('aria-label="选择法术目标"')
    expect(workspaceSource).toContain('data-testid="dnd5e-spell-selected-target-summary"')
    expect(workspaceSource).toContain('撤销上一个目标')
    expect(workspaceSource).toContain('dnd5eMapSpellTargetOptions({')
    expect(workspaceSource).toContain('if (tokenId) void handleSelectToken(tokenId)')
  })

  it('keeps player-granted persistent area Activities interactive during exploration', () => {
    expect(workspaceSource).toContain('const playerActivityAoeSelectActive = playerGrantedActivityAoeSelectActive({')
    expect(workspaceSource).toContain('pluginArea: dnd5ePluginAreaTargeting,')
    expect(workspaceSource).toContain('aoeSelectMode={mapAoeSelectMode({')
  })

  it('offers an accessible creature picker for persistent-area granted Activities', () => {
    expect(workspaceSource).toContain('data-testid="persistent-area-activity-target-picker"')
    expect(workspaceSource).toContain('dnd5ePersistentAreaActivityTargeting.label')
    expect(workspaceSource).toContain('data-testid={`persistent-area-activity-target-${target.id}`}')
    expect(workspaceSource).toContain('onClick={() => void handleSelectToken(target.id)}')
    expect(workspaceSource).toContain('距离、目标合法性、行动资源与授予来源仍由 Host 权威校验。')
  })

  it('keeps the remaining character dock panels available during post-combat exploration', () => {
    expect(workspaceSource).toContain('{!isDM && activeChar && charPanel && (')
    expect(workspaceSource).not.toContain('{!isDM && activeChar && charPanel && !playerCombatLocked && (')
  })

  it('uses the synchronized room rules for plugin actions outside combat', () => {
    expect(workspaceSource).toContain('if (combatActive) return')
    expect(workspaceSource).toContain('effectiveRulesRef.current = roomSession && roomRulesSnapshot')
    expect(workspaceSource).toContain('requiredPlugins: roomRulesSnapshot.requiredPlugins,')
    expect(workspaceSource).toContain('const recoveredRules = await loadRoomRules(roomSession)')
    expect(workspaceSource).toContain('!combatActiveRef.current && !effectiveRulesRef.current')
  })

  it('routes direct DM placement through the explicit battlefield adjustment path', () => {
    const start = workspaceSource.indexOf('onTokenMoveRequest={(token, position, targetElevationFeet) => {')
    const end = workspaceSource.indexOf('onBlankContextMenu=', start)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const placement = workspaceSource.slice(start, end)
    expect(placement).toContain('placeDmTokenWithoutMovementSettlement({')
    expect(placement).toContain('DM 战场调整：')
    expect(placement).toContain('sendPlayerExplorationMoveRequest(token, position)')
  })

  it('initializes every advanced combat turn with the active token movement speed', () => {
    expect(workspaceSource).toContain('const dnd5eTurnEconomySpeedForToken = (tokenId: string): number =>')
    expect(
      workspaceSource.match(/createDnd5eTurnEconomyCounts\([\s\S]{0,160}?dnd5eTurnEconomySpeedForToken\(/g)?.length,
    ).toBeGreaterThanOrEqual(3)
  })

  it('lets a player confirm any movement mode without selecting another map cell', () => {
    expect(workspaceSource).toContain('aria-label="确认当前移动方式"')
    expect(workspaceSource).toContain('onClick={handleConfirmPlayerMovement}')
    expect(workspaceSource).toContain(
      'void handleMoveSelect({ x: myPlayerToken.x, y: myPlayerToken.y })',
    )
    expect(workspaceSource).toContain("`${turnCharacter.name}原地${elevationChangeFeet > 0 ? '上升' : '下降'}")
  })

  it('defaults an airborne player to flight when movement targeting opens', () => {
    expect(workspaceSource).toContain('const myPlayerTokenIsAirborne = !!myPlayerToken &&')
    expect(workspaceSource).toContain(
      'myPlayerTokenElevationFeet > myPlayerTokenGroundElevationFeet + 1e-4',
    )
    expect(workspaceSource).toContain(
      'myPlayerTokenIsAirborne ||\n        dnd5eActiveRequiresFlightMovement',
    )
    expect(workspaceSource).toContain("? 'fly'\n        : 'walk'")
  })

  it('rechecks airborne support after direct character or status state changes', () => {
    expect(workspaceSource).toContain('const settleObservedAirborneSupportChange = async (')
    expect(workspaceSource).toContain('pendingAirborneSupportSourceRef.current ??= previous.state')
    expect(workspaceSource).toContain(
      'previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(\n      previous.state,\n      current.state,',
    )
    expect(workspaceSource).toContain('状态变化后自动复检飞行条件。')
  })

  it('deducts a planned vertical flight change from the horizontal move circle', () => {
    expect(workspaceSource).toContain("const plannedFlightElevationCost = dnd5eTraversalMode === 'fly'")
    expect(workspaceSource).toContain('(dnd5eFlightTargetElevationFeet ?? myPlayerTokenElevationFeet) -')
    expect(workspaceSource).toContain('availableFeet - fixedMovementCostFeet')
    expect(workspaceSource).toContain('dnd5eFlightTargetElevationFeet,\n    dnd5eTraversalMode,')
  })

  it('settles a player begin-turn boundary after an intervening dead slot is pruned', () => {
    expect(workspaceSource).toContain('const currentActorHasHeadlessRules = !!token && (')
    expect(workspaceSource).toContain("token.type === 'player' &&")
    expect(workspaceSource).toContain('dnd5eClassDefinitionForCharacter(linkedTurnCharacter) != null')
    expect(workspaceSource).toContain('currentTurnStartKey !== expectedTurnStartKey')
    expect(workspaceSource).toContain('settleAdvancedDnd5eHeadlessBeginTurn,')
  })

  it('settles plugin spell on-create area triggers before committing the application', () => {
    expect(workspaceSource).toContain('const activityCreatedSpellAreaIds: string[] = []')
    expect(workspaceSource).toContain('for (const createdAreaId of activityCreatedSpellAreaIds.filter((areaId) =>')
    expect(workspaceSource).toContain('settledPluginSpellEvents.push(...createdSettled.events)')
    expect(workspaceSource).toContain('const triggerInitiativeOrder = dnd5eSpellResolutionInitiativeOrder({')
    expect(workspaceSource).toContain('combatActive: combatActiveRef.current,')
    expect(workspaceSource).toContain('initiativeOrder: triggerInitiativeOrder,')
    expect(workspaceSource).toContain('sourceSaveDc: pluginCast.saveDc,')
    expect(workspaceSource).not.toContain('sourceSaveDc: pluginCast.actor.saveDC,')
    expect(workspaceSource).toContain('map = reconcileDnd5ePluginAreasOnMap(\n        settled.application.map,\n        characters,\n        input.round,')
    expect(workspaceSource).toContain('const reconciled = reconcileDnd5ePluginAreasAndConcentrationOnMap(\n            detonated.map,\n            detonated.characters,')
    expect(workspaceSource).toContain('const detonationMapBefore = pluginApplication.map')
    expect(workspaceSource).toContain('const before = detonationMapBefore.tokens.find((candidate) => candidate.id === token.id)')
    expect(workspaceSource).toContain('JSON.stringify(before) === JSON.stringify(token) ? [] : [token.id]')
    expect(workspaceSource).toContain('const concentrationReplacementDetonationAreas = dnd5eConcentrationReplacementDetonationAreas({')
    expect(workspaceSource).toContain('resolved.result.state.combatants[prepared.prepared.actorToken.id]')
    expect(workspaceSource).toContain("event.stateKey === 'concentration' &&")
    expect(workspaceSource).toContain('settledPluginFeatureEvents.push(...detonated.events)')
    expect(workspaceSource).toContain('const spellConcentrationReplacementDetonationAreas = pluginCast.concentrationRounds != null')
    expect(workspaceSource).toContain('beforeMap: pluginCast.map,')
    expect(workspaceSource).toContain('replacementConcentrationId: pluginCast.spell.id,')
    expect(workspaceSource).toContain('settledPluginSpellEvents.push(...detonated.events)')
    expect(workspaceSource).toContain('因施法者开始新的专注而自动爆炸并移除。')
  })

  it('collects a host-verifiable inventory selection for spells that establish a linked object', () => {
    expect(workspaceSource).toContain('const activityLinksInventory = applicableActivityOutcomes.some')
    expect(workspaceSource).toContain("operation.kind === 'establish-spell-authority' && operation.requiresSelectedInventoryItem === true")
    expect(workspaceSource).toContain('const actor = playerSpellActionSubmission()')
    expect(workspaceSource).toContain('omitCombatId: !combatActiveRef.current')
    expect(workspaceSource).toContain("pluginSpell.id !== 'instant-summons' || (")
    expect(workspaceSource).toContain('(entry.item.weightLb ?? 0) <= 10')
    expect(workspaceSource).toContain('选择要连结的背包物品')
    expect(workspaceSource).toContain('activityInventoryInstanceId = selectedEntry.instanceId')
    expect(workspaceSource).toContain('expectedActivityInventoryRevision = inventory.revision ?? 0')
  })

  it('routes room-wide Identify candidates back to their owning character inventory', () => {
    expect(workspaceSource).toContain('dnd5eInventoryIdentificationCandidates(characters)')
    expect(workspaceSource).toContain('activityInventoryCharacterId = selectedCandidate.characterId')
    expect(workspaceSource).toContain('const inventoryCharacterId = selection.activityInventoryCharacterId ?? pluginCast.actor.id')
    expect(workspaceSource).toContain('characterId: inventoryCharacterId')
    expect(workspaceSource).toContain('inventoryCharacterId,\n            ])')
  })

  it('merges generated inventory rewards into the authoritative Headless character patch', () => {
    expect(
      workspaceSource.match(/const generatedActor = generated\.characters\.find/g)?.length,
    ).toBeGreaterThanOrEqual(2)
    expect(
      workspaceSource.match(/mergeDnd5eCharacterPatchIntoResult\([\s\S]{0,240}?dnd5eInventory: generatedActor\.dnd5eInventory/g)?.length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('does not turn fixed item healing into a fake die roll', () => {
    expect(workspaceSource).toContain('healing.count > 0')
    expect(workspaceSource).toContain('healing.count === 0')
    expect(workspaceSource).toContain('固定值 ${resolved.healingRolled}')
  })

  it('collects every save in a simultaneous persistent-area wave before rolling shared damage', () => {
    const collectWaveIndex = workspaceSource.indexOf('const primedSavingThrows = await collectDnd5ePersistentAreaSavingThrowWaveResults')
    const perTargetIndex = workspaceSource.indexOf('for (const candidate of input.candidates)', collectWaveIndex)
    const sharedDamageIndex = workspaceSource.indexOf('const damageRolls = candidate.trigger.damage')
    expect(collectWaveIndex).toBeGreaterThan(-1)
    expect(perTargetIndex).toBeGreaterThan(collectWaveIndex)
    expect(sharedDamageIndex).toBeGreaterThan(perTargetIndex)
    expect(workspaceSource).toContain('resolve: async (waveCandidate) =>')
    expect(workspaceSource).toContain('const primedSavingThrow = primedSavingThrows.get(candidate.transactionId)')
    expect(workspaceSource).toContain('if (save && savingThrowPresentationId && !primedSavingThrow)')
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
    expect(workspaceSource).toContain('<MapLazyOverlayBoundary label="正在打开怪物控制栏…">')
  })
})
