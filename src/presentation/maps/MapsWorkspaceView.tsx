import {createEmptyMapFog,MAP_FOG_MAX_SHAPES,getRoomSession,showAppAlert,showAppActionChoice,showAppConfirm,showAppChoiceGroups,showAppDirectionStepper,showAppPrompt,mapGeometryTokenElevation,clearMapTabletopAnnotations,deleteMapTabletopAnnotation,publishMapTabletopAnnotation,publishMapTabletopFocus,publishMapTabletopPing,combatPresentationSavingThrowAbilityLabel,isTokenMovementLocked,dnd5eCombatTokenSide,clampGridSize,gridSizeBounds,pixelToCell,tokenAnchorCellFromPixel,tokenCenterForAnchorCell,isDnd5eTokenBanished,isTokenAlive,appRoomAuthorityScheduler,dnd5eMonsterManualControlEnabled} from "../../composition/mapsWorkspaceServices"
import {dnd5eCharacterCanActAtZeroHitPoints,dnd5eActiveActionRestriction,completeDnd5eCompanionTask,dnd5eCompanionHeldWeaponDefinition,dnd5eCompanionArmorDefinition,dnd5eRetryableCompanionSceneOrder,persistentEntityAttackPanel,persistentEntityAttackArmorClass,teleportationCircleContains,dnd5eInventoryEntryCanDrop,rollDnd5eActivityTriggerDiceV1} from "../../application/combat/mapsWorkspaceRules"
import MastermindNativeDirectOwnerResumePanel from "../../components/map/MastermindNativeDirectOwnerResumePanel"
import {prepareMastermindNativeDirectOwnerResume} from "../../pages/maps/mastermindNativeDirectOwnerResume"
import BountifulInitiativePanel from "../../components/map/BountifulInitiativePanel"
import MastermindNativeWardBountifulPanel from "../../components/map/MastermindNativeWardBountifulPanel"
import BountifulNativeLuckyChoicePanel from "../../components/map/BountifulNativeLuckyChoicePanel"
import {submitCurrentBountifulNativeLuckyChoice} from "../../application/combat/dnd5eCombatRules"
import MastermindNativeWardResumePanel from "../../components/map/MastermindNativeWardResumePanel"
import {prepareMastermindNativeWardResume} from "../../pages/maps/mastermindNativeWardResume"
import MastermindNativeWardOutcomePanel from "../../components/map/MastermindNativeWardOutcomePanel"
import MastermindWardSavingChoicePanel from "../../components/map/MastermindWardSavingChoicePanel"
import MastermindWardAttackPanel from "../../components/map/MastermindWardAttackPanel"
import MastermindNativeMagicTruthCastPanel from "../../components/map/MastermindNativeMagicTruthCastPanel"
import MastermindMagicTruthPanel from "../../components/map/MastermindMagicTruthPanel"
import ArcaneMovementOwnerPanel from "../../pages/maps/ArcaneMovementOwnerPanel"
import MastermindThoughtResultPanel from "../../components/map/MastermindThoughtResultPanel"
import MastermindNativeThoughtCastPanel from "../../components/map/MastermindNativeThoughtCastPanel"
import MastermindNativeSpellWindowPanel from "../../components/map/MastermindNativeSpellWindowPanel"
import ArcaneNativeOwnerPanel from "../../pages/maps/ArcaneNativeOwnerPanel"
import MastermindObservationPanel from "../../components/map/MastermindObservationPanel"
import MastermindMisdirectionPanel from "../../components/map/MastermindMisdirectionPanel"
import MastermindSpellWardChoicePanel from "../../components/map/MastermindSpellWardChoicePanel"
import MastermindThoughtConsentPanel from "../../components/map/MastermindThoughtConsentPanel"
import PactWeaponRitualPanel from "../../pages/maps/PactWeaponRitualPanel"
import {MapGeometryEditorTabs} from "../../components/map/MapGeometryEditorTabs"
import {dnd5eActivityRolledChoiceIds,dnd5eActivePlanarPhase,dnd5eActiveSwimSpeedEqualsWalking,createDnd5eMapCombatSnapshot,dnd5eActiveRequiresFlightMovement,dnd5eDragonbornBreathArea,getDnd5eSrdMonster,dnd5ePluginFeatureDefinition,dnd5ePluginGrantedActivityDefinitionV1,normalizeDnd5eInventory,dnd5ePersistentAreaDifficultTerrainMultiplierAt,dnd5ePersistentAreaSpeedCostMultiplierAt,type Dnd5eTraversalMode,dnd5eActivityChoiceIsRelevantV1,dnd5eActivityWithTargetChoicesV1} from "../../application/combat/dnd5eCombatRules"
import {promptMappedRockOrigin} from "../../pages/maps/mappedRockOriginChoice"
import {FortressFurnishingDialog} from "../../components/map/FortressFurnishingDialog"
import IllusionInvestigationPanel from "../../components/map/IllusionInvestigationPanel"
import {FortressRoomLayoutDialog} from "../../components/map/FortressRoomLayoutDialog"
import {DruidGrovePasswordPanel} from "../../components/map/DruidGrovePasswordPanel"
import {projectDnd5eMapCohortArmorClassBonus} from "../../application/combat/mapCohortArmorClassProjection"
import TerrainClearingPanel from "../../components/map/TerrainClearingPanel"
import Dnd5eBasicActionsPanel from "../../components/map/Dnd5eBasicActionsPanel"
import {TeleportationCircleDestinationDialog} from "../../pages/maps/TeleportationCircleDestinationDialog"
import {TelepathicBondTargetDialog} from "../../pages/maps/TelepathicBondTargetDialog"
import MapToolsDock from "../../components/map/MapToolsDock"
import {editMagicalFog} from "../../pages/maps/editMagicalFog"
import MapMovementActionBar from "../../components/map/MapMovementActionBar"
import TelekinesisMovementBar from "../../components/map/TelekinesisMovementBar"
import DmTokenElevationControls from "../../pages/maps/DmTokenElevationControls"
import {EnemyPoolPicker,MapViewportLayer,MapWorkspacePanelsLayer,MapWorkspaceCombatLogPanel,MapWorkspaceInitiativePanel,MapWorkspaceInventoryPanel,MapWorkspaceEnemyDetailPanel,MapWorkspaceCharacterDetailPanel,Dnd5eMapObjectDetailPanel,PlayerQuickCharacterSheet,MapWorkspaceSpellEffectDetailPanel,MapWorkspacePersistentAreaDetailPanel,MapWorkspaceActiveEffectDetailsDialog,NpcMerchantPanel,NpcCreateDialog,MapMerchantShopDialog,SceneOrchestrationSystem,MapDiceRoller,D20RollConfirmationOverlay,DmMonsterControlDock,Dnd5eLegendaryActionWindow,Dnd5eFighterCombatPanel,Dnd5eClassCombatPanel,Dnd5ePluginCombatPanel,CombatExperienceSettlementDialog,CombatInitiativeConfirmationDialog,DmCombatRecoveryDialog} from "../../pages/mapsWorkspaceComposition"
import {runtimeNow,appendSharedPlayerActionRequest,loadSharedResource,saveSharedResourcesAtomically,saveSharedResourceWithResult} from "../../pages/mapsWorkspaceRuntime"
import {Suspense} from "react"
import MapVoicePanel from "../../components/map/MapVoicePanel"
import {Upload,FileUp,Grid3x3,Trash2,Skull,User,X,Swords,Play,Pause,Square,SkipForward,Ruler,UserPlus,ChevronUp,SlidersHorizontal,Maximize2,Minimize2,GripVertical,GripHorizontal,RefreshCw,Move,Magnet,LocateFixed,ArrowUpRight,Circle as CircleIcon,Eraser,PencilLine,RotateCcw,Sparkles,MapPinned,Package} from "lucide-react"
import MapGeometryToolbar from "../../components/map/MapGeometryToolbar"
import Dnd5eMapPlaneControl from "../../components/map/Dnd5eMapPlaneControl"
import MapViewportNotesOverlay from "../../components/map/MapViewportNotesOverlay"
import MapViewportNoteButton from "../../components/map/MapViewportNoteButton"
import CharacterRailEntry from "../../components/map/CharacterRailEntry"
import PlayerMapSpellHotbar from "../../components/map/PlayerMapSpellHotbar"
import {CHAR_PANEL_TITLES} from "../../components/map/characterRailConfig"
import ClassResourceIndicators from "../../components/map/ClassResourceIndicators"
import CombatActionBanner from "../../components/map/CombatActionBanner"
import KillStreakPresentation from "../../components/map/KillStreakPresentation"
import {canShowEnemyDetail} from "../../components/map/enemyDetailPanelUtils"
import MapDetailPanelBoundary from "../../components/map/MapDetailPanelBoundary"
import MapLazyOverlayBoundary from "../../components/map/MapLazyOverlayBoundary"
import {dnd5eMergedCombatantActiveEffects} from "../../pages/maps/combatantActiveEffects"
import CombatDialogOverlay from "./CombatDialogOverlay"
import {RopeTrickPanel} from "../../pages/maps/RopeTrickPanel"
import DicePresentationOverlays from "./DicePresentationOverlays"
import MapCombatUnitDrawer from "./MapCombatUnitDrawer"
import {MapCombatUnitStatusPanel} from "./MapCombatUnitDrawer"
import {useMapStore} from "../../store/maps"
import {useMapGeometryStore} from "../../store/mapGeometry"
import {MightyFortressServicesPanel} from "../../components/map/MightyFortressServicesPanel"
import {useCharacterStore} from "../../store/characters"
import {setRoomMonsterRuntimeStatus,setRoomCharacterHitPoints} from "../../store/roomCommands"
import {promptDnd5eActivityChoice} from "../../pages/maps/dnd5eActivityChoicePager"
import SavingThrowResultOverlay from "../../pages/maps/SavingThrowResultOverlay"
import {mapAoeSelectMode} from "../../pages/maps/aoeTargetingSession"
import {resolvePersistentAreaEntityAttackByDm,toggleDmPluginAreaVisibility} from "../../pages/maps/dmWallOfFireRemoval"
import EnemyTokenPortraitSyncBoundary from "./EnemyTokenPortraitSyncBoundary"
import {dnd5eTokenCannotBeMarkedSurprised} from "../../pages/mapsPageHelpers"
import {mapTokenGrantedActivityControls} from "../../components/map/playerMapPersistentAreas"
import {Dnd5eSpellWhisperDialog} from "../../pages/maps/Dnd5eSpellWhisperDialog"
import {MapsEmptyMapPanel} from "../../pages/maps/MapsEntryPanels"
import ClassFeatureInterruptPanels from "../../pages/maps/ClassFeatureInterruptPanels"
import ReactionInterruptPanels from "../../pages/maps/ReactionInterruptPanels"
import MapWorkspaceMapSelect from "../../pages/maps/MapWorkspaceMapSelect"
import SourceLocationPanel from "../../pages/maps/SourceLocationPanel"
import ObjectFlightArrivalControl from "../../components/map/ObjectFlightArrivalControl"
import {runObjectFlightArrival} from "../../pages/maps/objectFlightArrivalController"
import {playerGeometryDoorClickRoute} from "../../pages/maps/playerGeometryDoorInteraction"
import Dnd5eActivityMapTargetingOverlay from "./Dnd5eActivityMapTargetingOverlay"
import DmAdjudicationPanel from "../../pages/maps/DmAdjudicationPanel"
import MapFogToolbar from "../../pages/maps/MapFogToolbar"
import type {MapsWorkspaceViewContext} from '../../pages/MapsWorkspacePage'

export function renderMapsWorkspaceView({activeMap,combatIdRef,roundRef,initiativeOrderRef,isSpectator,mode,finishEnemyAttack,isDM,characters,nativeMagicCasting,nativeMagicPending,startMastermindNativeMagicTruth,playerChar,selectedToken,selectedCharacterToken,roomSession,settleDnd5eContinuousMovementCompletion,pushCombatLog,playerObservation,pendingPlayerActionRef,sendPlayerDnd5eAbilityCheckRequest,sendPlayerDnd5eMapInteractionRequest,commitPortalTravel,updateMap,fortressFurnishingRequest,setFortressFurnishingRequest,fortressRoomRequest,setFortressRoomRequest,portalDestinationRequest,setPortalDestinationRequest,showCombatNotice,fileRef,handleMapFile,uvttFileRef,handleUvttFile,modeToggle,frameRef,rightCombatDockTab,showBar,combatActive,initiativeOrder,gridCalibrationDraft,roomRulesSnapshot,selectedTokenId,selectMapSpellToken,targetSelectTokenIds,sculptSelectableTokenIds,optimisticTokenMoveIds,playerMovableTokenIds,measureMode,showMoveRange,gridAdjustMode,deleteSelectMode,fogEditMode,geometryEditMode,sceneDrawTarget,mapTabletopTool,privateLocationFocus,activeMapTabletop,activeCombatProjectiles,activeCombatAttackTargetEffects,diceSavingThrowMarker,delegatedSavingThrowToken,activeCombatSavingThrow,delegatedSavingThrow,mapDoubleClickPingEnabled,setMapTabletopTool,setEffectDetailInstance,applyAuthorityMapUpdate,dnd5eWeaponTargeting,activeManualMonsterActionSelection,activeManualMonsterAttackTargeting,attackWallWithManualMonster,canSendPlayerCombatAction,createPlayerActionRequest,dnd5eWeaponAttackOptions,hostWallAttackIdsRef,setDnd5eWeaponTargeting,setDnd5eWeaponAttackOptions,handlePlayerActionRequest,submitPlayerActionRequest,setRopeTrickAreaId,setEffectDetailAreaId,setSelectedTokenId,currentInitiativeToken,authoritativeMovementTokenIds,dnd5ePersistentAreaActivityTargeting,playerCombatLocked,inMoveSelectMode,activeMoveCircle,activeAoeTargeting,dnd5eItemAreaTargeting,handleMoveSelect,dnd5eTraversalMode,dnd5eFlightTargetElevationFeet,activeMoverEnvironmentalCapabilities,activeMoverIgnoresMaterialCollision,activeMoverSolidMaterials,activeMoverObjectTraversal,terrainClearingArea,stoneEscapeArea,webIgnitionArea,playerSpellAoeSelectActive,playerActivityAoeSelectActive,dnd5eCoreAreaMoveTargeting,dnd5eSpellTargeting,committedSpellAreaLocked,aoeHighlight,rangedRangeCells,handleAoePreviewCell,handleAoeConfirm,setTerrainClearingTarget,setStoneEscapeTarget,setWebIgnitionTarget,cancelDnd5eActivityMapTargeting,setDnd5eCoreAreaMoveTargeting,setDnd5eManualMonsterAttackTargeting,setDnd5eManualMonsterSpellTargeting,setDnd5eSpellTargeting,setDnd5eItemAreaTargeting,setDnd5ePluginAreaTargeting,setDnd5eExtraActionTeleportTargeting,setAoePreviewCell,handleDeleteBoxConfirm,setDeleteSelectMode,activeFog,fogTool,fogPreviewAsPlayer,magicalFogEnabled,addFogShape,setFogEditMode,setFogPreviewAsPlayer,activeGeometry,geometryTool,geometryWallMaterial,selectedGeometryEntityId,geometryPreviewAsPlayer,geometrySnapToGrid,activeGeometryDiagnostics,activeGeometryDetectionCandidates,setGeometryDetectionCandidates,visionSourceTokenIds,exploredVisionPolygons,mapEditingCoordinator,handlePlayerGeometryDoorInteraction,setGeometryEditMode,setGeometryPreviewAsPlayer,selectGeometryEntity,visibleSceneTriggerZones,sceneInteractionPoints,sceneTeleportDestinations,sceneEditorVisible,mapTravelEditing,setSceneTriggerRegion,setSceneInteractionPointPosition,updateSceneAction,handleSceneInteractionPointClick,setSceneDrawTarget,canMovePlayerTokenOutsideCombat,myPlayerToken,sendPlayerExplorationMoveRequest,combatActiveRef,placeDmTokenWithoutMovementSettlement,setManualMonsterMoveSelection,playerMovement,setDnd5eItemCreatureTargeting,lockDragTokenIds,previewGridCalibration,gridSizePreview,enemySpellAoeWarning,activeCombatKillStreak,combatBannersEnabled,activeCombatAttackBanner,activeCombatSpellBanner,playerTurnBanner,travelEditorHost,setGeometryEditorSection,setMapToolPanel,setSceneEditorVisible,setGridAdjustMode,setMeasureMode,setShowMoveRange,sceneInteractionPointFocusId,requestCombatStartConfirmation,setSceneInteractionPointFocusId,playerWaitingForDm,mapToolsOpen,removeDnd5eItemArea,activeManualMonsterSpellTargeting,manualMonsterSpellTargetIds,settleManualMonsterSpell,manualMonsterMoveSelectMode,moveCircle,manualMonsterMoveToken,movementActorElevationFeet,manualMonsterMoveElevationFeet,manualMonsterMoveGroundElevationFeet,manualMonsterMoveDefinition,myPlayerTokenElevationFeet,turnCharacter,activeMoverPlanarPhase,activeMoverMovementProfile,activeMoverSolidWalk,playerCanAdjustFlightElevation,pendingPlayerAction,handleConfirmPlayerMovement,setDnd5eCarefulMovement,dnd5eCarefulMovement,setDnd5eStandFromProne,dnd5eStandFromProne,nativeLuckyPrompts,telekinesisMovementChoice,dnd5eActivityMapTargeting,finishDnd5eActivityCellTargeting,undoDnd5eCoreAreaMovePoint,submitDnd5eCoreAreaMoveSelection,dnd5eItemCreatureTargeting,spellTargetingControls,dnd5ePluginAreaTargeting,pluginRectAngleDegrees,pluginFixedDirectionAnchor,stoneEscapeToken,stoneEscapeTarget,stoneEscapeCells,terrainClearingCells,telepathicBondSelection,setTelepathicBondSelection,sendPlayerDnd5eAdjudicatedSpellRequest,combatDialog,closeCombatDialog,remoteSensorLocationDialog,spellWhisperPrompt,setSpellWhisperPrompt,sharedPluginChoicePrompt,sharedBardicInspirationPrompt,sharedCuttingWordsPrompt,sharedDarkOnesOwnLuckPrompt,sharedStrokeOfLuckPrompt,sharedEmpoweredSpellPrompt,sharedEmpoweredSpellSelection,sharedStandAgainstTidePrompt,handleSharedPluginChoice,handleSharedBardicInspirationChoice,handleSharedCuttingWordsChoice,handleSharedDarkOnesOwnLuckChoice,handleSharedStrokeOfLuckChoice,setSharedEmpoweredSpellSelection,handleSharedEmpoweredSpellChoice,handleSharedStandAgainstTideChoice,initiativeConfirmationDraft,initiativeConfirmationSubmitting,setInitiativeConfirmationDraft,startCombat,liveInitiativeConfirmationDraft,liveInitiativeConfirmationSubmitting,setLiveInitiativeConfirmationDraftLocked,confirmLiveInitiativeAdditions,showSurpriseSetup,surpriseSelection,setSurpriseSelection,setShowSurpriseSetup,sharedDmAdjudicationPrompt,dmAdjudicationDc,setDmAdjudicationDc,dmAdjudicationMapOverride,setDmAdjudicationMapOverride,dmAdjudicationSaveOverride,setDmAdjudicationSaveOverride,dmAdjudicationEffects,setDmAdjudicationEffects,dmAdjudicationConcentrationRounds,setDmAdjudicationConcentrationRounds,dmAdjudicationNote,setDmAdjudicationNote,handleSharedDmAdjudicationChoice,sharedSavingThrowRerollPrompt,sharedProtectionPrompt,sharedShieldSpellPrompt,sharedCounterspellPrompt,sharedUncannyDodgePrompt,sharedDeflectMissilesPrompt,sharedOpportunityAttackPrompt,handleSharedSavingThrowRerollChoice,handleSharedProtectionChoice,handleSharedShieldSpellChoice,handleSharedCounterspellChoice,handleSharedUncannyDodgeChoice,handleSharedDeflectMissilesChoice,handleSharedOpportunityAttackChoice,combatLog,combatLogOpen,displayActiveMap,displayInitiativeOrder,initiativeIndex,initiativeScroll,round,hpByToken,defeatedTokenIds,setInitiativeScroll,openTokenDetails,setCombatLog,setCombatLogOpen,sharedRollConfirmationPrompt,settlingRollConfirmation,handleD20ReplacementContribution,handleD20RollContinue,roomDiceFeed,combatPlaybackLedgerScope,activeMapId,diceRecoveryGeneration,roll,diceBoxD20,diceBoxRoll,rollRequestPreview,activeDiceRollStatus,pendingPlayerDiceRoll,checkOutcome,checkResult,secretDiceOverride,lastFreeDiceRoll,handleMapFreeDiceRoll,combatDiceControlsHost,setRightCombatDockTab,mapDiceCharacter,canControlPlayerTurn,mapDiceActorTokenId,mapDiceTurnEconomy,combatRollsVisible,setCombatRollsVisible,handleRollDone,completeDiceBoxD20,completeDiceBoxRoll,completeRollRequestPreview,handlePlayerDiceRoll,setSecretDiceOverride,dmCombatRecoveryOpen,combatId,setDmCombatRecoveryOpen,combatPublishSeqRef,clearSharedInterruptLocalState,clearPlayerCombatUI,dmAdjudicationResumeGateRef,reloadDnd5eAuthorityState,combatFlowPause,resumeCombatFlow,pauseCombatFlowManually,advanceInitiative,manualInitiativeAdvancePending,dnd5eTurnStartSettlementPending,openCombatRecovery,endCombat,combatEnding,canControlDeathSaveTurn,sendDnd5eDeathSaveRequest,handlePlayerEndTurn,canEndPlayerTurn,setCombatDiceControlsHost,setShowBar,presentedAreaTurnStart,handleSelectToken,selectDnd5eAreaModifierTarget,mapToolPanel,commitGridCalibration,setGridSizePreview,setFogTool,geometryEditorSection,scenePendingRunCount,objectFlightDiceMapsRef,rollDiceBoxValues,rollDiceBoxD20,rollDnd5eUnsupportedAirborneFalls,settleDnd5eMapMountedBalance,requestSharedHellishRebukeChoice,collectSharedSpellDamageDieChoices,requestDnd5eSavingThrowRerollDice,requestDnd5eBardicInspirationRoll,requestDnd5eOptionalBonusDieUse,requestDnd5eDarkOnesOwnLuckRoll,requestSharedPostSpellRandomTableChoice,requestSharedPostSpellRandomTableAdjudication,settleRegisteredDnd5eActivityTriggers,handleRedetectGrid,gridDetecting,removeMap,chooseMapTabletopTool,setTravelEditorHost,selectedGeometryEntity,geometryDiagnosticsEnabled,setGeometryTool,setGeometryWallMaterial,setGeometrySnapToGrid,setGeometryDiagnosticsEnabled,setGeometryDetectionCandidateMapId,createMapFromUvtt,magicalFogRedoCount,activeFogRedoCount,magicalFogCanUndo,setMagicalFogEnabled,fillFog,clearFog,undoFog,redoFog,setFogStyle,visionProjectedCharactersById,addCharacterToken,placeableCharacters,addToken,openEnemyPool,setNpcCreationMapId,operateFortressDoorByHost,beginDnd5eActivityCellTargeting,dropFortressItemByHost,moveFortressServantByHost,pickupFortressItemByHost,commandFortressByHost,castingWorldMinute,serveFortressFeastByHost,applyGrovePasswordByHost,removeMapTokenWithRelations,ropeTrickAreaId,effectDetailArea,monsterVisualSearchPending,investigatePersistentIllusion,applyAuthorityCharacterUpdate,saveCharactersSharedNow,activateSymbolByDm,setWebAreaUnsupported,removeDnd5ePersistentAreaWithEnvironmentalFalls,npcCreationMapId,updateToken,applyGroveRootingByHost,combatUnitPanelTab,monsterControl,setCombatUnitPanelTab,setSelectedCharacterTokenId,setEnemyDetailOpen,hostCharacterWeaponEntryRef,hostCharacterWeaponCurrentContext,setHostCharacterWeaponTargetingTokenId,prepareMonsterWornArmor,prepareMonsterHeldWeapon,pushHeadlessCombatLog,headlessCombatLogDetails,initiativeIndexRef,currentDnd5eTurnEconomy,retryOwnedCompanionSceneOrder,triggerMonsterReadiedObject,triggerMonsterReadiedMovement,triggerMonsterReadiedAttack,enemyDetailOpen,searchMonsterVisibleArea,manualMonsterActionPending,handleManualSettlement,removeToken,canDmManageConditions,conditionSourceOptions,applyDmConditionLabels,isEnemyTurn,manualMonsterActionUsed,dnd5eTurnEconomyByToken,areaControlWorldSecondRemainder,manualMonsterBonusActionUsed,manualMonsterTurnEconomy,dmGrantedActivityPendingId,setDnd5ePersistentAreaActivityTargeting,sendPlayerDnd5ePluginActionRequest,manualMonsterTurnKey,selectManualMonsterMultiattackContinuation,selectedCharacter,selectedCharacterSubject,reportMapTokenRemovalFailure,playerSpellActionSubmission,combatMonsterTokens,manualMonsterMoveSelection,selectManualMonsterAction,escapeManualMonsterActiveEffect,activateManualMonsterReckless,changeManualMonsterShape,executeMultipartCommand,settleManualMonsterDmAdjudication,selectManualMonsterSpell,beginManualMonsterMovement,effectDetailToken,effectDetailCharacter,effectDetailEffects,effectDetailInstance,canRemoveEffectDetailInstance,removeEffectDetailInstance,activeManualMonsterMapAreaEffect,legendaryActionWindow,legendaryActionAdjudicationActive,legendaryActionSettlementPending,settleLegendaryActionWindowSelection,completeLegendaryActionBoundary,railChars,activeCharId,onAvatarClick,combatFlowPauseRef,nativeSpellWindowCasting,nativeSpellWindowParents,startMastermindNativeSpellWindow,nativeThoughtCasting,nativeThoughtPending,startMastermindNativeThoughtCast,startMastermindNativeThoughtContinuation,charPanel,activeChar,triggeredReactionSpellIds,featherFallCasterDnd5eTurnEconomy,activeCharDnd5eTurnEconomy,combatHotbarActiveActionId,activeCharDnd5eGrappleEscapes,combatSpellModifiersByCharacter,featherFallCasterCharacter,setCombatSpellModifiers,combatSpellSlotLevelsByCharacter,setCombatSpellSlotLevel,handleCombatHotbarCommand,panelFull,panelWidth,panelHeight,startResizeHeight,setPanelFull,closeCharDock,sendDnd5eItemUseRequest,activeCharRacialRules,activeCharBreathResource,requestDreamNightmare,activeCharDnd5eFeatureTargets,handleDnd5eBasicAction,handleTriggerReadiedAction,dnd5eExtraActionTeleportTargeting,withDeclarativeAttackIntents,handleDisengage,handleDodge,sendPlayerDnd5eFighterFeatureRequest,sendPlayerDnd5eClassFeatureRequest,activeCharToken,activeDeclarativeAttackIntentFeatureIds,setPrivateLocationFocus,toggleDeclarativeAttackIntent,startResizeWidth,combatExperienceDraft,combatExperienceBusy,settleEndedCombatExperience,merchantInteraction,setMerchantInteraction,enemyPoolOpen,enemyPoolMode,setEnemyPoolOpen,handleEnemyPoolPick,handleEncounterBuild}: MapsWorkspaceViewContext) {
  return (<div className="map-workspace-container h-full w-full">
      {activeMap&&<ArcaneMovementOwnerPanel mapId={activeMap.id} state={request=>{
        let map=activeMap
        if(request&&'movementEntryCell'in request&&request.movementEntryCell&&typeof request.movementEntryCell==='object'&&'col'in request.movementEntryCell&&'row'in request.movementEntryCell&&typeof request.movementEntryCell.col==='number'&&typeof request.movementEntryCell.row==='number'){
          const token=map.tokens.find(t=>t.id===request.actorTokenId)
          if(token){const point=tokenCenterForAnchorCell({col:request.movementEntryCell.col,row:request.movementEntryCell.row},token,map);map={...map,tokens:map.tokens.map(t=>t.id===token.id?{...t,...point}:t)}}
        }
        return createDnd5eMapCombatSnapshot({map,characters:useCharacterStore.getState().characters,combatId:combatIdRef.current||'map-'+map.id,round:roundRef.current,initiativeOrder:initiativeOrderRef.current}).state
      }}/>}
      {activeMap&&<ArcaneNativeOwnerPanel mapId={activeMap.id} state={()=>createDnd5eMapCombatSnapshot({map:activeMap,characters:useCharacterStore.getState().characters,combatId:combatIdRef.current||'map-'+activeMap.id,round:roundRef.current,initiativeOrder:initiativeOrderRef.current}).state}/>}

      {!isSpectator&&activeMap&&<MastermindMisdirectionPanel mapId={activeMap.id} tokens={activeMap.tokens}/>}
      {!isSpectator&&activeMap&&<MastermindSpellWardChoicePanel mapId={activeMap.id} tokens={activeMap.tokens}/>}
      {!isSpectator&&activeMap&&<BountifulInitiativePanel mapId={activeMap.id} actorName={id=>activeMap.tokens.find(token=>token.id===id)?.label??id} ownerName={id=>activeMap.tokens.find(token=>token.id===id)?.label??id}/>}
      {!isSpectator&&activeMap&&<MastermindWardSavingChoicePanel mapId={activeMap.id} tokens={activeMap.tokens} />}
      {!isSpectator&&activeMap&&<MastermindWardAttackPanel mapId={activeMap.id} tokens={activeMap.tokens}/>}
      {!isSpectator&&activeMap&&<MastermindNativeWardBountifulPanel mapId={activeMap.id}/>}
      {mode==='dm'&&!isSpectator&&activeMap&&<MastermindNativeWardOutcomePanel mapId={activeMap.id} tokens={activeMap.tokens}/>}
      {mode==='dm'&&!isSpectator&&activeMap&&<MastermindNativeDirectOwnerResumePanel mapId={activeMap.id} onResume={async parentId=>{const command=await prepareMastermindNativeDirectOwnerResume(parentId);await finishEnemyAttack(command)}}/>}
      {mode==='dm'&&!isSpectator&&activeMap&&<MastermindNativeWardResumePanel mapId={activeMap.id} onResume={async parentId=>{const command=await prepareMastermindNativeWardResume(parentId);await finishEnemyAttack(command)}}/>}
      {!isSpectator&&activeMap&&<MastermindMagicTruthPanel mapId={activeMap.id}/>}
      {isDM&&activeMap&&<MastermindNativeMagicTruthCastPanel isDM={isDM} map={activeMap} characters={characters} session={getRoomSession()} pending={nativeMagicCasting} pendingCasts={nativeMagicPending} onCast={(actorId,ownerId,source)=>{void startMastermindNativeMagicTruth(actorId,ownerId,source)}} onResume={parentId=>{void startMastermindNativeMagicTruth('','',undefined,parentId)}}/>}
      {!isSpectator&&activeMap&&<MastermindThoughtConsentPanel mapId={activeMap.id}/>}
      {!isSpectator&&activeMap&&<MastermindThoughtResultPanel mapId={activeMap.id}/>}

      {!isSpectator&&activeMap&&<MastermindObservationPanel isDM={isDM} owner={isDM?undefined:playerChar??undefined} actorTokenId={!isDM?activeMap.tokens.find(token=>token.characterId===playerChar?.id)?.id:undefined} mapId={activeMap.id} target={selectedToken??selectedCharacterToken} targetLabels={activeMap.tokens} characters={characters} tokens={activeMap.tokens} hostScope={isDM&&roomSession?{roomId:roomSession.roomId,hostMemberId:roomSession.memberId}:undefined}/>}
      {isDM&&activeMap&&!!activeMap.dnd5ePendingMovementCompletions?.length&&<div role="status" className="absolute bottom-36 left-4 z-[110] flex flex-col gap-2 rounded-lg bg-slate-950/95 p-3 text-sm text-amber-100">
        <span>移动结束豁免待完成</span>
        {activeMap.dnd5ePendingMovementCompletions.map(entry=><button key={entry.id} type="button" className="rounded bg-amber-900 px-3 py-1"
          onClick={()=>{void settleDnd5eContinuousMovementCompletion(activeMap.id,entry.actorTokenId,entry.id).catch(()=>pushCombatLog('移动结束豁免未保存，请重试。','system'))}}>
          重试：{activeMap.tokens.find(token=>token.id===entry.actorTokenId)?.label??'目标'}</button>)}
      </div>}

      {playerObservation && <div role="status" aria-label="远端观察" className="absolute left-1/2 top-20 z-[110] flex -translate-x-1/2 items-center gap-3 rounded-lg border border-violet-400/50 bg-slate-950/95 px-4 py-2 text-sm text-violet-100">
        <span>{activeMap?.id === playerObservation.remoteMapId ? `正在观察：${playerObservation.label}` : `${playerObservation.label}仍在持续 · 当前查看本体`}</span>
        <button type="button" className="rounded bg-violet-600 px-3 py-1" onClick={() => useMapStore.getState().viewObservation(activeMap?.id === playerObservation.remoteMapId ? 'body' : 'sensor')}>
          {activeMap?.id === playerObservation.remoteMapId ? '查看本体与回合' : '查看远端'}</button>
        {!isDM && activeMap?.id === playerObservation.bodyMapId && useMapStore.getState().maps
          .find(map => map.id === playerObservation.remoteMapId)?.tokens.find(token => token.id === playerObservation.id)?.dnd5eSpellEffect?.hearingFromSource &&
          <button type="button" className="rounded bg-cyan-800 px-3 py-1" disabled={!!pendingPlayerActionRef.current}
            onClick={() => sendPlayerDnd5eAbilityCheckRequest({ ability: 'wis', skill: 'perception', dc: 0, totalOnly: true,
              remoteHearing: { sensorId: playerObservation.id, soundSourceTokenId: '' } })}>远端听觉检定</button>}
      </div>}
      {!isSpectator && activeMap && <div className="absolute bottom-24 left-4 z-[100] flex flex-col gap-2">
        {activeMap.dnd5ePluginAreas?.filter(area => area.teleportationExit).map(area => {
          const actors = activeMap.tokens.filter(token => token.type !== 'obstacle' && (isDM || token.characterId === playerChar?.id) && teleportationCircleContains(activeMap, area, token))
          if (!isDM && !actors.length) return null
          return <div key={area.id} className="rounded-lg border border-cyan-400/40 bg-slate-950/95 p-3 text-xs text-cyan-100">
            <div className="mb-2">传送法阵 · {area.teleportationExit?.expiresAt ? '开启后 6 秒关闭' : area.teleportationExit?.exploration ? '等待 DM 关闭' : '至施法者下一回合结束'}</div>
            <div className="flex flex-wrap gap-2">{actors.map(actor => <button key={actor.id} className="rounded bg-cyan-900 px-3 py-2" onClick={async () => {
              if (!isDM) {
                if (playerChar) sendPlayerDnd5eMapInteractionRequest({ operation: 'teleportation-circle', areaId: area.id }, { token: actor, character: playerChar }, '进入传送法阵')
                return
              }
              await commitPortalTravel(activeMap.id, area.id, actor.id)
            }}>{isDM ? actor.label + ' · ' : ''}进入法阵</button>)}
            {isDM && <button className="rounded border border-slate-600 px-3 py-2" onClick={() => {
              const current = useMapStore.getState().maps.find(map => map.id === activeMap.id)
              if (current) updateMap(current.id, { dnd5ePluginAreas: current.dnd5ePluginAreas?.filter(entry => entry.id !== area.id) })
            }}>关闭法阵</button>}</div>
          </div>
        })}
      </div>}
      {fortressFurnishingRequest && <FortressFurnishingDialog preview={fortressFurnishingRequest.preview} onDone={value=>{fortressFurnishingRequest.resolve(value);setFortressFurnishingRequest(null)}} />}
      {fortressRoomRequest && <FortressRoomLayoutDialog floor={fortressRoomRequest.floor} stair={fortressRoomRequest.stair} onDone={rooms=>{fortressRoomRequest.resolve(rooms);setFortressRoomRequest(null)}} />}
      {portalDestinationRequest && <TeleportationCircleDestinationDialog maps={useMapStore.getState().maps} onDone={exit => {
        portalDestinationRequest.resolve(exit); setPortalDestinationRequest(null)
      }} />}
      <EnemyTokenPortraitSyncBoundary
        enabled={isDM}
        requireSharedImages={!!roomSession}
        showNotice={showCombatNotice}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,.uvtt,.dd2vtt,.df2vtt,.json,application/json"
        className="hidden"
        onChange={handleMapFile}
      />
      <input
        ref={uvttFileRef}
        type="file"
        accept="application/json,.uvtt,.dd2vtt,.df2vtt"
        className="hidden"
        onChange={(event) => void handleUvttFile(event)}
      />

      {!activeMap ? (
        <MapsEmptyMapPanel
          modeToggle={modeToggle}
          isDm={isDM}
          onUpload={() => fileRef.current?.click()}
        />
      ) : (
        /* 全屏地图框，所有控件作为浮层 */
        <div
          ref={frameRef}
          className={[
            'map-workspace-frame relative h-full w-full overflow-hidden rounded-2xl',
            rightCombatDockTab === 'dice' ? 'map-workspace-frame--right-dock-open' : '',
          ].join(' ')}
        >
          <MapVoicePanel belowInitiative={showBar && combatActive && initiativeOrder.length > 0} />
          {/* 地图本体铺满 */}
          <div className="map-workspace-viewport absolute inset-y-0 left-0 right-0">
            <Suspense
              fallback={(
                <div
                  data-testid="map-viewport-loading"
                  className="flex h-full w-full items-center justify-center bg-void-950 text-sm text-slate-400"
                  role="status"
                >
                  正在初始化地图画布…
                </div>
              )}
            >
              <MapViewportLayer
              map={activeMap}
              gridCalibrationDraft={gridCalibrationDraft}
              rulesRevision={roomRulesSnapshot}
              combatActive={combatActive}
              selectedTokenId={selectedTokenId}
              onSelectToken={selectMapSpellToken}
              targetSelectTokenIds={targetSelectTokenIds}
              targetSelectableTokenIds={sculptSelectableTokenIds}
              isDM={isDM}
              viewerCharacterId={playerChar?.id}
              viewerMaterialSightRangeFeet={dnd5eActivePlanarPhase(playerChar?.dnd5eCombatState?.activeEffects).materialSightRangeFeet}
              optimisticTokenMoveIds={optimisticTokenMoveIds}
              playerMovableTokenIds={playerMovableTokenIds}
              tabletopTool={
                isDM && !measureMode && !showMoveRange && !gridAdjustMode && !deleteSelectMode && !fogEditMode && !geometryEditMode && !sceneDrawTarget
                  ? mapTabletopTool
                  : 'none'
              }
              tabletopPings={privateLocationFocus?.mapId === activeMap.id ? [...activeMapTabletop.pings, { ...privateLocationFocus, type: 'ping' as const }] : activeMapTabletop.pings}
              tabletopAnnotations={activeMapTabletop.annotations}
              tabletopFocus={privateLocationFocus?.mapId === activeMap.id && privateLocationFocus.createdAt > (activeMapTabletop.focus?.createdAt ?? 0) ? privateLocationFocus : activeMapTabletop.focus}
              projectiles={activeCombatProjectiles}
              attackTargetEffects={activeCombatAttackTargetEffects}
              savingThrowTokenId={diceSavingThrowMarker?.targetTokenId ?? delegatedSavingThrowToken?.id ?? activeCombatSavingThrow?.targetTokenId}
              savingThrowAbility={diceSavingThrowMarker ? diceSavingThrowMarker.ability : delegatedSavingThrow?.savingThrowAbility ?? activeCombatSavingThrow?.ability}
              pingEnabled={mapDoubleClickPingEnabled}
              onMapPing={(point) => void publishMapTabletopPing(activeMap.id, point)}
              onTabletopPoint={(point) => {
                if (!isDM) return
                setMapTabletopTool('none')
                void publishMapTabletopFocus(activeMap.id, point)
              }}
              onTabletopToolCancel={() => setMapTabletopTool('none')}
              onTabletopAnnotation={(shape, from, to, points) => {
                if (!isDM) return
                void publishMapTabletopAnnotation({
                  mapId: activeMap.id,
                  shape,
                  from,
                  to,
                  ...(points ? { points } : {}),
                })
              }}
              onTabletopAnnotationDelete={(annotationId) => {
                if (!isDM) return
                void deleteMapTabletopAnnotation(activeMap.id, annotationId)
              }}
              measureMode={isDM && measureMode && !showMoveRange && !gridAdjustMode && !deleteSelectMode && !fogEditMode && !geometryEditMode && !sceneDrawTarget}
              onDnd5eStatusTokenClick={isDM || playerChar ? (instance) => {
                if (isDM) {
                  setEffectDetailInstance(instance)
                  return
                }
                if (instance.kind !== 'concentration') return
                const token = activeMap.tokens.find((candidate) => candidate.id === instance.tokenId)
                if (token?.characterId === playerChar?.id) setEffectDetailInstance(instance)
              } : undefined}
              onDnd5ePluginAreaVisibilityToggle={(areaId) => { const latest = useMapStore.getState().maps.find((map) => map.id === activeMap.id); const next = latest && toggleDmPluginAreaVisibility(latest, areaId); if (isDM && next) applyAuthorityMapUpdate(next.id, { dnd5ePluginAreas: next.dnd5ePluginAreas }) }}
              onStoneWallAttackSelect={dnd5eWeaponTargeting || activeManualMonsterActionSelection?.action.kind === 'weapon-attack' || activeManualMonsterActionSelection?.action.kind === 'multiattack' ? async (areaId, panelId) => {
                const area = activeMap.dnd5ePluginAreas?.find(a => a.id === areaId)
                if (area?.coreSpellId === 'wall-of-force') {
                  await showCombatNotice('力场墙免疫所有伤害', '普通攻击不能破坏力场墙；本次没有投骰或消耗行动。解离术可以直接摧毁它，解除魔法无效。', 'amber'); return
                }
                if (activeManualMonsterAttackTargeting) { await attackWallWithManualMonster(areaId, panelId); return }
                const panel = persistentEntityAttackPanel(area,panelId)
                if (!panel || (!isDM && !canSendPlayerCombatAction())) return
                const action = createPlayerActionRequest({ type: 'dnd5e-weapon-attack', dnd5eWallTarget: { areaId, panelId }, dnd5eWeaponAttackOptions })
                if (!action) return
                if (isDM) {
                  hostWallAttackIdsRef.current.add(action.id)
                  setDnd5eWeaponTargeting(null); setDnd5eWeaponAttackOptions(undefined)
                  await handlePlayerActionRequest({ ...action, sourceMode: 'dm' }); return
                }
                if (submitPlayerActionRequest(action, `攻击${area?.label ?? "实体"} · AC ${persistentEntityAttackArmorClass(area!)} · ${panel.hitPoints}/${panel.maxHitPoints} HP`)) {
                  setDnd5eWeaponTargeting(null); setDnd5eWeaponAttackOptions(undefined)
                }
              } : undefined}
              onDnd5ePluginAreaClick={(areaId) => { if (isDM || (!isSpectator && activeMap.dnd5ePluginAreas?.some(area => area.id === areaId && (area.terrainClearing || area.illusionRecognition)))) { setRopeTrickAreaId(null); setEffectDetailAreaId(areaId); setSelectedTokenId(null) } else if (!isSpectator && activeMap.dnd5ePluginAreas?.some((area) => area.id === areaId && area.coreSpellId === 'rope-trick')) { setRopeTrickAreaId(areaId) } }}
              currentTurnTokenId={combatActive ? currentInitiativeToken?.id : undefined}
              authoritativeMovementTokenIds={authoritativeMovementTokenIds}
              builtinGrid={!!activeMap.builtinGridDetected}
              moveSelectMode={!dnd5ePersistentAreaActivityTargeting && !playerCombatLocked && inMoveSelectMode && !!activeMoveCircle && !activeAoeTargeting && !dnd5eItemAreaTargeting}
              moveCircle={activeMoveCircle}
              onMoveSelect={handleMoveSelect}
              moveTraversalMode={dnd5eTraversalMode}
              moveTargetElevationFeet={dnd5eFlightTargetElevationFeet ?? undefined}
              moveMinimumPassageGapInches={activeMoverEnvironmentalCapabilities.minimumPassageGapInches}
              moveCanOccupyCreatureSpaces={activeMoverEnvironmentalCapabilities.canOccupyCreatureSpaces}
              moveIgnoreMaterialCollision={activeMoverIgnoresMaterialCollision}
              moveIgnoreDifficultTerrainMaterials={activeMoverEnvironmentalCapabilities.ignoredDifficultTerrainMaterials}
              movePassThroughSolidMaterials={activeMoverSolidMaterials}
              movePassThroughObjectsAndCreatures={activeMoverObjectTraversal}
              moveIgnoreDifficultTerrain={activeMoverEnvironmentalCapabilities.ignoresDifficultTerrain}
              moveTreatsLiquidSurfacesAsSolidGround={activeMoverEnvironmentalCapabilities.treatsLiquidSurfacesAsSolidGround}
              difficultTerrainMultiplierAtPosition={(token, position) =>
                dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map: activeMap, token, position })}
              speedCostMultiplierAtPosition={(token, position) =>
                dnd5ePersistentAreaSpeedCostMultiplierAt({ map: activeMap, token, position })}
              aoeSelectMode={!!terrainClearingArea || !!stoneEscapeArea || !!webIgnitionArea || mapAoeSelectMode({
                creatureActivityTargetingActive: !!dnd5ePersistentAreaActivityTargeting,
                playerSpellAoeSelectActive,
                playerActivityAoeSelectActive,
                coreAreaMoveTargetingActive: !!dnd5eCoreAreaMoveTargeting,
                playerCombatLocked,
                activeAoeTargeting: !!activeAoeTargeting,
                itemAreaTargetingActive: !!dnd5eItemAreaTargeting,
                guessedSpellTargetingActive: dnd5eSpellTargeting?.guessedTargeting === true,
                spellAreaSelectionLocked: committedSpellAreaLocked,
              })}
              aoeHighlight={aoeHighlight}
              rangedRangeCells={rangedRangeCells}
              onAoePreviewCell={handleAoePreviewCell}
              onAoeConfirm={handleAoeConfirm}
              onAoeCancel={() => {
                setTerrainClearingTarget(null)
                setStoneEscapeTarget(null)
                setWebIgnitionTarget(null)
                cancelDnd5eActivityMapTargeting()
                setDnd5eCoreAreaMoveTargeting(null)
                setDnd5eManualMonsterAttackTargeting(null)
                setDnd5eManualMonsterSpellTargeting(null)
                setDnd5eSpellTargeting(null)
                setDnd5eItemAreaTargeting(null)
                setDnd5ePluginAreaTargeting(null)
                setDnd5eExtraActionTeleportTargeting(null)
                setAoePreviewCell(null)
              }}
              deleteSelectMode={isDM && deleteSelectMode && !showMoveRange && !gridAdjustMode && !measureMode && !fogEditMode && !geometryEditMode && !sceneDrawTarget}
              onDeleteBoxConfirm={handleDeleteBoxConfirm}
              onDeleteCancel={() => setDeleteSelectMode(false)}
              fog={activeFog}
              fogEditMode={isDM && fogEditMode}
              fogTool={fogTool}
              fogPreviewAsPlayer={fogPreviewAsPlayer}
              onFogShapeCommit={(shape) => {
                if (!isDM) return
                if (magicalFogEnabled) editMagicalFog(activeMap.id, fog => ({
                  ...fog, shapes: [...fog.shapes, shape].slice(-MAP_FOG_MAX_SHAPES),
                }))
                else addFogShape(activeMap.id, shape)
              }}
              onFogEditCancel={() => {
                setFogEditMode(false)
                setFogPreviewAsPlayer(false)
              }}
              geometry={activeGeometry}
              geometryEditMode={isDM && geometryEditMode}
              geometryTool={geometryTool}
              geometryWallMaterial={geometryWallMaterial}
              selectedGeometryEntityId={selectedGeometryEntityId}
              geometryPreviewAsPlayer={geometryPreviewAsPlayer}
              geometrySnapToGrid={geometrySnapToGrid}
              geometryTerrainEditingLocked={combatActive}
              geometryDiagnostics={activeGeometryDiagnostics}
              geometryDetectionCandidates={activeGeometryDetectionCandidates}
              onGeometryDetectionCandidateRemove={(index) =>
                setGeometryDetectionCandidates((current) => current.filter((_, candidateIndex) => candidateIndex !== index))}
              visionSourceTokenIds={visionSourceTokenIds}
              exploredVisionPolygons={exploredVisionPolygons}
              onGeometryEntityCommit={(entity) => {
                const result = mapEditingCoordinator.commit(activeMap.id, entity)
                if (!result.ok) {
                  void showAppAlert(result.reason === 'dm-authority-required' ? '只有当前房间的 DM 可以编辑地图。请检查登录和房间身份。' : result.reason === 'terrain-editing-locked-during-combat' ? '战斗中无法修改地形，请结束战斗后重试。' : '地图未接受这次绘制。临时线条已保留，请检查几何数量限制，或重新绘制；按 Esc 可取消。')
                  return false
                }
                if (entity.kind === 'obstacle' && (
                  entity.terrainRegion || entity.magicalDarkness || (entity.terrainCostMultiplier ?? 1) > 1
                )) {
                  mapEditingCoordinator.select(entity.id)
                }
              }}
              onGeometryEntitySelect={(entityId) => mapEditingCoordinator.select(entityId)}
              onGeometryEntityDelete={(entityId) => {
                mapEditingCoordinator.remove(activeMap.id, activeGeometry, entityId)
              }}
              onGeometryEntityPointsChange={(entityId, points) => {
                mapEditingCoordinator.setPoints(activeMap.id, activeGeometry, entityId, points)
              }}
              onGeometryDoorInteract={playerGeometryDoorClickRoute({
                isDM,
                isSpectator,
                spellAoeSelectActive: playerSpellAoeSelectActive,
              }) === 'ignore' ? undefined : (doorId) => {
                const route = playerGeometryDoorClickRoute({
                  isDM,
                  isSpectator,
                  spellAoeSelectActive: playerSpellAoeSelectActive,
                })
                if (route === 'spell-target' && activeMap) {
                  const door = activeGeometry?.doors.find((candidate) => candidate.id === doorId)
                  if (!door) return
                  handleAoeConfirm(pixelToCell(
                    (door.points[0].x + door.points[1].x) / 2,
                    (door.points[0].y + door.points[1].y) / 2,
                    activeMap,
                  ))
                  return
                }
                if (route === 'door-interaction') {
                  void handlePlayerGeometryDoorInteraction(doorId)
                }
              }}
              onGeometryEditCancel={() => {
                setGeometryEditMode(false)
                setGeometryPreviewAsPlayer(false)
                selectGeometryEntity(null)
              }}
              sceneTriggerZones={visibleSceneTriggerZones}
              sceneInteractionPoints={sceneInteractionPoints}
              sceneTeleportDestinations={sceneTeleportDestinations}
              sceneOverlayEditMode={
                isDM && (sceneEditorVisible || mapTravelEditing) && (
                  !sceneDrawTarget || sceneDrawTarget.kind === 'interaction-point'
                )
              }
              onSceneTriggerZoneMove={(sceneId, triggerId, region) => {
                if (!isDM) return
                setSceneTriggerRegion(sceneId, triggerId, region)
              }}
              onSceneInteractionPointMove={(sceneId, interactionPointId, point) => {
                if (!isDM) return
                setSceneInteractionPointPosition(sceneId, interactionPointId, point)
              }}
              onSceneTeleportDestinationMove={(sceneId, triggerId, actionId, point) => {
                if (!isDM) return
                updateSceneAction(sceneId, triggerId, actionId, point)
              }}
              onSceneInteractionPointClick={isDM ? handleSceneInteractionPointClick : undefined}
              sceneEditMode={
                isDM && !!sceneDrawTarget && sceneDrawTarget.kind !== 'interaction-point'
              }
              sceneRegionKind={
                sceneDrawTarget?.kind === 'circle' || sceneDrawTarget?.kind === 'rect'
                  ? sceneDrawTarget.kind
                  : undefined
              }
              onSceneRegionCommit={(region) => {
                if (!sceneDrawTarget || sceneDrawTarget.kind === 'interaction-point') return
                setSceneTriggerRegion(sceneDrawTarget.sceneId, sceneDrawTarget.triggerId, region)
                setSceneDrawTarget(null)
              }}
              scenePointPlacementMode={
                isDM && sceneDrawTarget?.kind === 'interaction-point'
              }
              onScenePointPlacementCommit={(point) => {
                if (!sceneDrawTarget || sceneDrawTarget.kind !== 'interaction-point') return
                setSceneInteractionPointPosition(
                  sceneDrawTarget.sceneId,
                  sceneDrawTarget.interactionPointId,
                  point,
                )
                setSceneDrawTarget(null)
              }}
              onSceneEditCancel={() => setSceneDrawTarget(null)}
              onTokenMoveBlocked={() => {
                pushCombatLog('移动被地图墙体、关闭的门或障碍物阻挡。', 'system')
              }}
              onTokenMoveRequest={(token, position, targetElevationFeet) => {
                if (!isDM) {
                  if (
                    canMovePlayerTokenOutsideCombat &&
                    token.id === myPlayerToken?.id &&
                    token.characterId === playerChar?.id
                  ) {
                    const completion = sendPlayerExplorationMoveRequest(token, position)
                    if (completion) return completion
                  }
                  // Never let a player client fall back to a direct local map
                  // write, even if combat starts or ownership changes while a
                  // drag is already in progress. The room server is authoritative.
                  return true
                }
                if (!combatActiveRef.current) return false
                const completion = placeDmTokenWithoutMovementSettlement({
                  mapId: activeMap.id,
                  token,
                  position,
                  elevationFeet: targetElevationFeet,
                })
                pushCombatLog(
                  `DM 战场调整：将 ${token.label} 移动到 (${Math.round(position.x)}, ${Math.round(position.y)})。`,
                  'system',
                )
                return completion
              }}
              onTokenMoveCommit={(token, position, targetElevationFeet) => {
                return placeDmTokenWithoutMovementSettlement({
                  mapId: activeMap.id,
                  token,
                  position,
                  elevationFeet: targetElevationFeet,
                })
              }}
              onBlankContextMenu={() => {
                setManualMonsterMoveSelection(null)
                playerMovement.clear()
                setDnd5eWeaponTargeting(null)
                setDnd5eSpellTargeting(null)
                setDnd5eItemAreaTargeting(null)
                setDnd5eItemCreatureTargeting(null)
                setDnd5ePluginAreaTargeting(null)
                setDnd5eManualMonsterAttackTargeting(null)
                setDnd5eManualMonsterSpellTargeting(null)
              }}
              lockDragTokenIds={lockDragTokenIds}
              gridAdjustMode={isDM && gridAdjustMode && !fogEditMode && !geometryEditMode && !sceneDrawTarget}
              onGridOffsetChange={(offsetX, offsetY) =>
                previewGridCalibration(activeMap.id, { gridOffsetX: offsetX, gridOffsetY: offsetY })
              }
              gridSizePreview={isDM && gridSizePreview}
              onGridSizeChange={(gridSize) =>
                previewGridCalibration(activeMap.id, { gridSize })
              }
              />
            </Suspense>
          </div>
          <MapViewportNotesOverlay
            mapId={activeMap.id}
            notes={activeMap.viewportNotes ?? []}
            editable={isDM}
            onChange={(viewportNotes) => updateMap(activeMap.id, { viewportNotes })}
            onError={(message) => void showCombatNotice('便签图片失败', message, 'amber')}
          />
          {enemySpellAoeWarning ? (
            <div
              data-testid="enemy-spell-area-warning"
              className="pointer-events-none absolute inset-x-0 top-5 z-[110] flex justify-center"
            >
              <div className="rounded-xl border border-rose-300/50 bg-rose-950/90 px-5 py-2 text-sm font-bold text-rose-100 shadow-[0_0_35px_rgba(244,63,94,0.35)]">
                {enemySpellAoeWarning.spellName} · 范围预警 · 2 秒后生效
              </div>
            </div>
          ) : null}
          {activeCombatKillStreak ? (
            <KillStreakPresentation
              key={activeCombatKillStreak.id}
              presentation={activeCombatKillStreak}
            />
          ) : null}
          {/* HUD 层级：横幅 130 > 临时交互/结果 110 > 先攻与顶部控制 80 > 玩家技能栏 40。 */}
          {combatBannersEnabled && !activeCombatKillStreak && (activeCombatAttackBanner || activeCombatSpellBanner || playerTurnBanner) ? (
            <div className="pointer-events-none absolute inset-x-0 top-[3%] z-[130] flex justify-center px-4">
              {activeCombatAttackBanner ? (
                <CombatActionBanner
                  key={activeCombatAttackBanner.id}
                  mode="attack"
                  classId={activeCombatAttackBanner.classId}
                  casterName={activeCombatAttackBanner.actorName}
                  attackName={activeCombatAttackBanner.attackName}
                  attackKind={activeCombatAttackBanner.attackKind}
                />
              ) : activeCombatSpellBanner ? (
                <CombatActionBanner
                  key={activeCombatSpellBanner.id}
                  mode="spell"
                  classId={activeCombatSpellBanner.castingClassId}
                  casterName={activeCombatSpellBanner.casterName}
                  spellId={activeCombatSpellBanner.spellId}
                  spellName={activeCombatSpellBanner.spellName}
                />
              ) : playerTurnBanner ? (
                <CombatActionBanner
                  key={playerTurnBanner.key}
                  mode="turn"
                  classId={playerTurnBanner.classId}
                />
              ) : null}
            </div>
          ) : null}
          <Suspense fallback={null}>
            <SceneOrchestrationSystem
              map={activeMap}
              isDm={isDM}
              combatActive={combatActive}
              editorOpen={sceneEditorVisible}
              travelEditorOpen={mapTravelEditing}
              travelEditorHost={travelEditorHost}
              onCloseTravelEditor={() => { setGeometryEditorSection('structure'); setGeometryEditMode(true); setSceneDrawTarget(null) }}
              onOpenMapTravel={() => {
                setMapToolPanel('geometry')
                setGeometryEditorSection('travel')
                setSceneEditorVisible(false)
                setSceneDrawTarget(null)
                setGeometryEditMode(false)
                setGeometryPreviewAsPlayer(false)
                setFogEditMode(false)
                setGridAdjustMode(false)
                setMeasureMode(false)
                setDeleteSelectMode(false)
                setShowMoveRange(false)
                setMapTabletopTool('none')
              }}
              focusedInteractionPointId={sceneInteractionPointFocusId}
              drawing={sceneDrawTarget}
              onBeginDraw={(target) => {
                setSceneDrawTarget(target)
                setMeasureMode(false)
                setDeleteSelectMode(false)
                setGridAdjustMode(false)
                setFogEditMode(false)
                setFogPreviewAsPlayer(false)
                setGeometryEditMode(false)
                setGeometryPreviewAsPlayer(false)
                setMapTabletopTool('none')
              }}
              onCancelDraw={() => setSceneDrawTarget(null)}
              onStartCombat={() => requestCombatStartConfirmation([], { clearStatuses: false })}
              onEditorVisibilityChange={(visible) => {
                setSceneEditorVisible(visible)
                if (!visible) setSceneInteractionPointFocusId(null)
              }}
            />
          </Suspense>
          {playerWaitingForDm && (
            <div
              data-testid="dm-authority-waiting"
              className="pointer-events-none absolute left-1/2 top-4 z-[110] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-sky-300/30 bg-void-950/92 px-3 py-2 text-xs font-semibold text-sky-100 shadow-xl backdrop-blur-md"
            >
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              正在等待 DM 同步战斗状态
            </div>
          )}
          {isDM && mapToolsOpen && (activeMap.dnd5eItemAreas?.length ?? 0) > 0 && (
            <div className="absolute right-4 top-16 z-30 w-52 rounded-xl border border-white/10 bg-void-950/88 p-2 text-xs shadow-xl backdrop-blur-sm">
              <p className="px-1 pb-1.5 font-semibold text-slate-300">地图物品区域</p>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {activeMap.dnd5eItemAreas!.map((area) => (
                  <div key={area.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-slate-300">
                      {area.sourceItemName}{area.armed ? '' : '（已触发）'}
                    </span>
                    {area.kind === 'hunting-trap' && (
                      <button
                        type="button"
                        onClick={() => removeDnd5eItemArea(area.id, true)}
                        className="rounded px-1.5 py-0.5 text-emerald-300 hover:bg-emerald-400/10"
                      >
                        收回
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeDnd5eItemArea(area.id)}
                      className="rounded px-1.5 py-0.5 text-rose-300 hover:bg-rose-400/10"
                    >
                      清除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isDM && gridAdjustMode && (
            <div className="pointer-events-none absolute left-1/2 top-[5.25rem] z-[110] flex -translate-x-1/2 items-center gap-2 rounded-xl border border-amber-400/35 bg-void-950/90 px-3 py-1.5 text-xs text-amber-100 shadow-xl backdrop-blur-sm">
              <Move className="h-3.5 w-3.5 shrink-0" />
              <span>
                拖拽平移网格 · 滚轮缩放格子 · Shift+滚轮 ±3px · 方向键微调 · 偏移 ({activeMap.gridOffsetX},{activeMap.gridOffsetY}) · {activeMap.gridSize}px
              </span>
            </div>
          )}

          {dnd5eItemAreaTargeting && (
            <div className="map-combat-action-bar border-amber-400/40">
              <span className="text-xl">△</span>
              <span className="text-slate-200">
                放置 <span className="font-semibold text-amber-200">{dnd5eItemAreaTargeting.itemName}</span>
                {' '}· {dnd5eItemAreaTargeting.targeting.widthFeet}×{dnd5eItemAreaTargeting.targeting.heightFeet} 尺
                {aoeHighlight ? ` · 当前高亮 ${aoeHighlight.cells.length} 格` : ''}
                {' '}· 移动鼠标预览，点击有效格确认
              </span>
              <button
                onClick={() => { setDnd5eItemAreaTargeting(null); setAoePreviewCell(null) }}
                className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                取消
              </button>
            </div>
          )}

          {activeManualMonsterSpellTargeting ? (
            <div
              data-testid="manual-monster-spell-targeting"
              className="map-combat-action-bar border-sky-400/40"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-sky-300" />
              <span className="text-slate-200">
                <span className="font-semibold text-sky-200">
                  {activeManualMonsterSpellTargeting.spellName}
                </span>
                {' '}· {activeManualMonsterSpellTargeting.slotLevel === 0
                  ? '戏法'
                  : `${activeManualMonsterSpellTargeting.slotLevel} 环`}
                {' '}· {activeManualMonsterSpellTargeting.area
                  ? '移动范围模板并点击有效格确认'
                  : '点击高亮目标施放'}
              </span>
              {!activeManualMonsterSpellTargeting.area && activeMap && (
                <div
                  aria-label="可选法术目标"
                  className="flex max-w-full flex-wrap items-center justify-center gap-1"
                >
                  <span className="text-xs text-slate-400">可选目标：</span>
                  {manualMonsterSpellTargetIds.map((targetId) => {
                    const target = activeMap.tokens.find((token) => token.id === targetId)
                    if (!target) return null
                    return (
                      <button
                        key={target.id}
                        type="button"
                        onClick={(event) => {
                          // This toolbar sits above the canvas. Keep its click from
                          // reaching map-level pointer handlers, then settle through
                          // the same Headless transaction used by a token click.
                          event.stopPropagation()
                          const targeting = activeManualMonsterSpellTargeting
                          if (!targeting) return
                          if (!settleManualMonsterSpell({
                            targeting,
                            targetTokenIds: [target.id],
                          })) {
                            void showCombatNotice(
                              '无法施法',
                              '怪物回合、DM 操作状态或施法资源已经变化。',
                              'amber',
                            )
                          }
                        }}
                        className="rounded-lg border border-sky-300/25 bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-100 hover:bg-sky-500/20"
                      >
                        {target.label}
                      </button>
                    )
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setDnd5eManualMonsterSpellTargeting(null)
                  setAoePreviewCell(null)
                }}
                className="rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                取消
              </button>
            </div>
          ) : null}

          {manualMonsterMoveSelectMode && moveCircle && manualMonsterMoveToken ? (
            <div
              data-testid="manual-monster-move-targeting"
              className="map-combat-action-bar border-cyan-400/40"
            >
              <Move className="h-4 w-4 shrink-0 text-cyan-300" />
              <span className="text-slate-200">
                <span className="font-semibold text-cyan-200">{manualMonsterMoveToken.label}</span>
                {' '}· 点击地图格移动 · 剩余 {moveCircle.feet} 尺
              </span>
              <select
                aria-label="怪物移动方式"
                value={dnd5eTraversalMode}
                onChange={(event) => playerMovement.selectTraversalMode(
                  event.target.value as Dnd5eTraversalMode,
                  movementActorElevationFeet,
                )}
                className="rounded-lg border border-white/10 bg-void-900 px-2 py-1 text-xs text-slate-200"
              >
                {manualMonsterMoveElevationFeet <= manualMonsterMoveGroundElevationFeet &&
                (manualMonsterMoveDefinition?.speed.walk ?? 0) > 0 ? (
                  <option value="walk">地面移动</option>
                ) : null}
                <option value="climb">攀爬（无攀爬速度时半速）</option>
                <option value="swim">游泳（无游泳速度时半速）</option>
                {(manualMonsterMoveDefinition?.speed.fly ?? 0) > 0 ? (
                  <option value="fly">飞行</option>
                ) : null}
                <option value="long-jump-running">助跑跳远</option>
                <option value="long-jump-standing">立定跳远</option>
              </select>
              {(dnd5eTraversalMode === 'fly' || dnd5eTraversalMode === 'climb') && (
                <div className="flex items-center gap-1 rounded-lg border border-cyan-300/15 bg-cyan-950/30 p-0.5">
                  <button
                    type="button"
                    aria-label={dnd5eTraversalMode === 'climb' ? "怪物攀爬高度降低 5 尺" : "怪物飞行高度降低 5 尺"}
                    onClick={() => playerMovement.adjustFlightElevation(-5, movementActorElevationFeet)}
                    className="rounded px-2 py-1 text-xs text-cyan-100 hover:bg-white/10"
                  >
                    −5
                  </button>
                  <output
                    aria-label={dnd5eTraversalMode === 'climb' ? "怪物攀爬目标高度" : "怪物飞行目标高度"}
                    className="min-w-20 text-center text-xs font-semibold tabular-nums text-cyan-100"
                  >
                    海拔 {dnd5eFlightTargetElevationFeet ?? movementActorElevationFeet} 尺
                  </output>
                  <button
                    type="button"
                    aria-label={dnd5eTraversalMode === 'climb' ? "怪物攀爬高度升高 5 尺" : "怪物飞行高度升高 5 尺"}
                    onClick={() => playerMovement.adjustFlightElevation(5, movementActorElevationFeet)}
                    className="rounded px-2 py-1 text-xs text-cyan-100 hover:bg-white/10"
                  >
                    +5
                  </button>
                </div>
              )}
              {dnd5eTraversalMode === 'climb' && manualMonsterMoveToken && (
                <button
                  type="button"
                  aria-label="确认怪物攀爬高度"
                  onClick={() => { void handleMoveSelect({ x: manualMonsterMoveToken.x, y: manualMonsterMoveToken.y }) }}
                  className="rounded-lg bg-cyan-500/25 px-3 py-1 text-xs font-semibold text-cyan-50 hover:bg-cyan-500/35"
                >
                  确认高度
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setManualMonsterMoveSelection(null)
                  playerMovement.clear()
                }}
                className="rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                取消
              </button>
            </div>
          ) : showMoveRange && moveCircle ? (
            <MapMovementActionBar>
              <span className="text-slate-200">
                选择移动落点 · 可达 {moveCircle.feet} 尺
              </span>
              <select
                aria-label="移动方式"
                value={dnd5eTraversalMode}
                onChange={(event) => playerMovement.selectTraversalMode(
                  event.target.value as Dnd5eTraversalMode,
                  myPlayerTokenElevationFeet,
                )}
                className="rounded-lg border border-white/10 bg-void-900 px-2 py-1 text-xs text-slate-200"
              >
                {!dnd5eActiveRequiresFlightMovement(turnCharacter?.dnd5eCombatState?.activeEffects) ? (
                  <>
                    <option value="walk">步行</option>
                    <option value="climb">攀爬（通常半速）</option>
                    <option value="swim">
                      {dnd5eActiveSwimSpeedEqualsWalking(turnCharacter?.dnd5eCombatState?.activeEffects) ||
                      activeMoverEnvironmentalCapabilities.ignoresUnderwaterMovementPenalty
                        ? '游泳（等同步行速度）'
                        : '游泳（通常半速）'}
                    </option>
                  </>
                ) : null}
                <option value="fly">
                  {activeMoverPlanarPhase.unrestrictedVerticalMovement
                    ? '以太升降（垂直每尺消耗 2 尺）'
                    : activeMoverMovementProfile?.flySpeed
                      ? `飞行（${activeMoverMovementProfile.flySpeed} 尺）`
                      : '飞行（无飞行速度）'}
                </option>
                {!dnd5eActiveRequiresFlightMovement(turnCharacter?.dnd5eCombatState?.activeEffects) ? (
                  <>
                    <option value="long-jump-running">助跑跳远</option>
                    <option value="long-jump-standing">立定跳远</option>
                    <option value="fall">坠落（按海拔差结算）</option>
                  </>
                ) : null}
              </select>
              {(dnd5eTraversalMode === 'fly' || dnd5eTraversalMode === 'climb' || activeMoverSolidWalk) && (
                <div className="flex items-center gap-1 rounded-lg border border-sky-300/15 bg-sky-950/30 p-0.5">
                  <button
                    type="button"
                    aria-label={activeMoverSolidWalk ? (activeMoverObjectTraversal ? "幽影穿行高度降低 5 尺" : "土石穿行高度降低 5 尺") : dnd5eTraversalMode === 'climb' ? "攀爬高度降低 5 尺" : "飞行高度降低 5 尺"}
                    disabled={!activeMoverSolidWalk && dnd5eTraversalMode !== 'climb' && !playerCanAdjustFlightElevation}
                    onClick={() => { if (activeMoverSolidWalk || dnd5eTraversalMode === 'climb' || playerCanAdjustFlightElevation) playerMovement.adjustFlightElevation(-5, myPlayerTokenElevationFeet) }}
                    className="rounded px-2 py-1 text-xs text-sky-100 hover:bg-white/10"
                  >
                    −5
                  </button>
                  <output
                    aria-label={activeMoverSolidWalk ? (activeMoverObjectTraversal ? "幽影穿行目标高度" : "土石穿行目标高度") : dnd5eTraversalMode === 'climb' ? "攀爬目标高度" : "飞行目标高度"}
                    className="min-w-20 text-center text-xs font-semibold tabular-nums text-sky-100"
                  >
                    海拔 {dnd5eFlightTargetElevationFeet ?? myPlayerTokenElevationFeet} 尺
                  </output>
                  <button
                    type="button"
                    aria-label={activeMoverSolidWalk ? (activeMoverObjectTraversal ? "幽影穿行高度升高 5 尺" : "土石穿行高度升高 5 尺") : dnd5eTraversalMode === 'climb' ? "攀爬高度升高 5 尺" : "飞行高度升高 5 尺"}
                    disabled={!activeMoverSolidWalk && dnd5eTraversalMode !== 'climb' && !playerCanAdjustFlightElevation}
                    onClick={() => { if (activeMoverSolidWalk || dnd5eTraversalMode === 'climb' || playerCanAdjustFlightElevation) playerMovement.adjustFlightElevation(5, myPlayerTokenElevationFeet) }}
                    className="rounded px-2 py-1 text-xs text-sky-100 hover:bg-white/10"
                  >
                    +5
                  </button>
                </div>
              )}
              <button
                type="button"
                aria-label="确认当前移动方式"
                disabled={pendingPlayerAction != null}
                onClick={handleConfirmPlayerMovement}
                className="rounded-lg bg-sky-500/25 px-3 py-1 text-xs font-semibold text-sky-50 hover:bg-sky-500/35 disabled:cursor-not-allowed disabled:opacity-40"
                title="在当前位置确认并结算所选移动方式；可用于原地升降、坠落或起身。"
              >
                确认
              </button>
              <button
                type="button"
                onClick={() => setDnd5eCarefulMovement((current) => !current)}
                className={`rounded-lg px-2 py-1 text-xs ${dnd5eCarefulMovement ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                title="半速移动穿过滚珠或铁蒺藜时无需进行敏捷豁免；每移动 1 尺消耗 2 尺移动。"
              >
                {dnd5eCarefulMovement ? '半速谨慎：开' : '半速谨慎：关'}
              </button>
              {turnCharacter?.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase())) && (
                <button
                  type="button"
                  onClick={() => setDnd5eStandFromProne((current) => !current)}
                  className={`rounded-lg px-2 py-1 text-xs ${dnd5eStandFromProne ? 'bg-sky-500/25 text-sky-100' : 'bg-amber-500/20 text-amber-100'}`}
                  title="起身消耗当前有效速度的一半；保持倒地时每移动 1 尺消耗 2 尺移动。"
                >
                  {dnd5eStandFromProne ? '移动方式：先起身' : '移动方式：匍匐'}
                </button>
              )}
              <button
                type="button"
                onClick={() => { setShowMoveRange(false); setDnd5eCarefulMovement(false); setDnd5eStandFromProne(true) }}
                className="rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                取消
              </button>
            </MapMovementActionBar>
          ) : null}

          {nativeLuckyPrompts[0]&&<BountifulNativeLuckyChoicePanel key={nativeLuckyPrompts[0].receiptId} prompt={nativeLuckyPrompts[0]} actorName={characters.find(character=>character.id===nativeLuckyPrompts[0].rollerCharacterId)?.name??'原掷骰者'} onChoose={decision=>submitCurrentBountifulNativeLuckyChoice({prompt:nativeLuckyPrompts[0],decision},{loadResource:loadSharedResource,appendPlayerActionRequest:appendSharedPlayerActionRequest})}/>}
          {telekinesisMovementChoice.options && <TelekinesisMovementBar targetName={telekinesisMovementChoice.targetName} onFinish={telekinesisMovementChoice.finish} />}

          {dnd5eActivityMapTargeting && (
            <Dnd5eActivityMapTargetingOverlay
              session={dnd5eActivityMapTargeting}
              onFinishCells={() => { finishDnd5eActivityCellTargeting(); setAoePreviewCell(null) }}
              onCancel={() => {
                cancelDnd5eActivityMapTargeting()
                setAoePreviewCell(null)
              }}
            />
          )}

          {dnd5eCoreAreaMoveTargeting && (
            <div
              data-testid="dnd5e-persistent-area-move-overlay"
              aria-live="polite"
              className="map-combat-action-bar border-sky-400/40"
            >
              {dnd5eCoreAreaMoveTargeting.coreSpellId === 'dancing-lights' ? (
                <span className="text-sky-100">
                  移动{dnd5eCoreAreaMoveTargeting.label}：依次选择新的光团位置（
                  {dnd5eCoreAreaMoveTargeting.targetCells?.length ?? 0}/
                  {dnd5eCoreAreaMoveTargeting.originCells?.length ?? 0}）。每团最多移动 60 尺，且每团需在另一团 20 尺内。
                </span>
              ) : dnd5eCoreAreaMoveTargeting.coreSpellId === 'major-image' ? (
                <span className="text-sky-100">
                  改变高等幻影位置：请在施法者 {dnd5eCoreAreaMoveTargeting.destinationRangeFeet ?? 120} 尺内选择新位置。只消耗动作，不会重新施法或消耗法术位。
                </span>
              ) : (
                <span className="text-sky-100">
                  移动{dnd5eCoreAreaMoveTargeting.label}：请在地图上选择新位置。
                </span>
              )}
              {dnd5eCoreAreaMoveTargeting.targetElevationFeet != null && (
                <label className="flex items-center gap-1 text-xs text-sky-100">
                  目标绝对高度（尺）
                  <input type="number" aria-label="区域移动目标高度" min={-1000} max={10000}
                    value={dnd5eCoreAreaMoveTargeting.targetElevationFeet}
                    onChange={(event) => {
                      const height = event.currentTarget.valueAsNumber
                      if (Number.isFinite(height)) setDnd5eCoreAreaMoveTargeting(current => current ? { ...current, targetElevationFeet: height } : current)
                    }}
                    className="w-20 rounded border border-white/20 bg-void-900 px-2 py-1" />
                </label>
              )}
              {dnd5eCoreAreaMoveTargeting.coreSpellId === 'dancing-lights' ? <>
                <button
                  type="button"
                  disabled={!dnd5eCoreAreaMoveTargeting.targetCells?.length}
                  onClick={undoDnd5eCoreAreaMovePoint}
                  className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  撤销上一个
                </button>
                <button
                  type="button"
                  disabled={
                    !dnd5eCoreAreaMoveTargeting.originCells?.length ||
                    dnd5eCoreAreaMoveTargeting.targetCells?.length !== dnd5eCoreAreaMoveTargeting.originCells.length
                  }
                  onClick={submitDnd5eCoreAreaMoveSelection}
                  className="shrink-0 rounded-lg bg-sky-500/25 px-3 py-1 text-xs font-semibold text-sky-100 hover:bg-sky-500/35 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  确认移动
                </button>
              </> : null}
              <button
                type="button"
                onClick={() => {
                  setDnd5eCoreAreaMoveTargeting(null)
                  setAoePreviewCell(null)
                }}
                className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                取消
              </button>
            </div>
          )}

          {dnd5eItemCreatureTargeting && (
            <div className="map-combat-action-bar border-cyan-400/40">
              <span className="text-xl">◎</span>
              <span className="text-slate-200">
                使用 <span className="font-semibold text-cyan-200">{dnd5eItemCreatureTargeting.itemName}</span>
                {' '}· 点击 {dnd5eItemCreatureTargeting.targeting.rangeFeet} 尺内的生物目标
                {dnd5eItemCreatureTargeting.attackTargetCount === 3 && ` · 选择第 ${(dnd5eItemCreatureTargeting.selectedAttackTargetIds?.length ?? 0) + 1}/3 条触须的目标（可重复）`}
              </span>
              <button
                onClick={() => setDnd5eItemCreatureTargeting(null)}
                className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                取消
              </button>
            </div>
          )}
          {spellTargetingControls}
          {dnd5ePluginAreaTargeting && <div className="map-combat-action-bar map-spell-targeting-standalone border-cyan-300/40" data-testid={pluginRectAngleDegrees != null ? 'plugin-rect-angle-controls' : 'plugin-area-controls'}>
            <strong>{dnd5ePluginAreaTargeting?.featureName}</strong>
            {dnd5ePluginAreaTargeting?.targeting.template.origin === 'point' && <label className="flex items-center gap-2">落点高度（尺）
              <input aria-label="能力落点高度" type="number" min="-1000" max="10000" step="5" placeholder="随地形"
                className="w-20 rounded border border-white/20 bg-slate-950 px-2 py-1" value={dnd5ePluginAreaTargeting.targetElevationFeet ?? ''}
                onChange={event => { const height = event.target.value === '' ? undefined : Number(event.target.value)
                  if (height != null && (!Number.isFinite(height) || height < -1000 || height > 10000)) return
                  setDnd5ePluginAreaTargeting(current => current ? { ...current, targetElevationFeet: height } : current)
                }} />
            </label>}
            {pluginRectAngleDegrees != null && <label className="flex items-center gap-2">方向
              <input aria-label="能力方向角度" type="range" min="0" max="359" step="1" value={pluginRectAngleDegrees}
                onChange={event => { const angle = Number(event.target.value); setDnd5ePluginAreaTargeting(current => current ? { ...current, targetAngleDegrees: angle } : current) }} />
              <output>{Math.round(pluginRectAngleDegrees)}°</output>
            </label>}
            <span>{pluginRectAngleDegrees != null ? 'Q / E 微调 5° · ' : ''}{pluginFixedDirectionAnchor ? '保持原区域位置' : '点击地图确认'}</span>
            {pluginFixedDirectionAnchor && <button type="button" onClick={() => void handleAoeConfirm(pluginFixedDirectionAnchor)}>确认方向</button>}
            <button type="button" onClick={() => { setDnd5ePluginAreaTargeting(null); setAoePreviewCell(null) }}>取消</button>
          </div>}
          {stoneEscapeArea && <div className="map-combat-action-bar border-amber-300/50 text-xs text-amber-100">
            <strong>{stoneEscapeToken?.label} · {stoneEscapeTarget?.push ? '墙体生成推离' : '石墙术反应逃离'}</strong><span>{stoneEscapeTarget?.push ? (stoneEscapeCells.length ? '由施法者决定一侧，DM 点击高亮空位；不消耗行动或反应。' : '附近没有合法空位，请由 DM 调整墙体布局。') : '点击高亮的墙外空位，消耗一次反应。'}</span>
            <button type="button" onClick={() => { setStoneEscapeTarget(null); setEffectDetailAreaId(stoneEscapeArea.id); setAoePreviewCell(null) }}>返回</button>
          </div>}
          {terrainClearingArea && <div className="map-combat-action-bar border-amber-300/50 text-xs text-amber-100" data-testid="terrain-clearing-selection">
            <strong>清理碎石</strong><span>{terrainClearingCells.length ? (combatActive ? '点击高亮格，消耗一个动作推进清理。' : '点击高亮格完成清理并推进时间。') : '没有本轮可清理的格子，请检查距离、当前回合和剩余动作。'}</span>
            <button type="button" onClick={() => { setTerrainClearingTarget(null); setAoePreviewCell(null) }}>取消</button>
          </div>}
          {webIgnitionArea && <div className="map-combat-action-bar border-orange-300/50 text-xs text-orange-100">
            <strong>点燃蛛网</strong>
            <span>高亮格为可选蛛网，移动鼠标预览，点击点燃一格。右键取消。</span>
            <button type="button" className="rounded bg-white/10 px-2 py-1" onClick={() => {
              setWebIgnitionTarget(null); setAoePreviewCell(null); setEffectDetailAreaId(webIgnitionArea.id)
            }}>取消</button>
          </div>}

          {telepathicBondSelection && <TelepathicBondTargetDialog
            maps={useMapStore.getState().maps}
            onCancel={() => setTelepathicBondSelection(null)}
            onConfirm={targets => {
              const payload = telepathicBondSelection
              setTelepathicBondSelection(null)
              sendPlayerDnd5eAdjudicatedSpellRequest({ ...payload, narrativeOnly: true, telepathicBondTargets: targets })
            }}
          />}
          <CombatDialogOverlay dialog={combatDialog} onClose={closeCombatDialog} />
          {remoteSensorLocationDialog.dialog}

          {spellWhisperPrompt ? <Dnd5eSpellWhisperDialog
            key={`${spellWhisperPrompt.originalActionId}:${spellWhisperPrompt.direction}`}
            whisper={spellWhisperPrompt}
            onClose={() => setSpellWhisperPrompt(null)}
          /> : null}

          <ClassFeatureInterruptPanels
            pluginChoicePrompt={sharedPluginChoicePrompt}
            bardicInspirationPrompt={sharedBardicInspirationPrompt}
            cuttingWordsPrompt={sharedCuttingWordsPrompt}
            darkOnesOwnLuckPrompt={sharedDarkOnesOwnLuckPrompt}
            strokeOfLuckPrompt={sharedStrokeOfLuckPrompt}
            empoweredSpellPrompt={sharedEmpoweredSpellPrompt}
            empoweredSpellSelection={sharedEmpoweredSpellSelection}
            standAgainstTidePrompt={sharedStandAgainstTidePrompt}
            onPluginChoice={handleSharedPluginChoice}
            onBardicInspirationChoice={handleSharedBardicInspirationChoice}
            onCuttingWordsChoice={handleSharedCuttingWordsChoice}
            onDarkOnesOwnLuckChoice={handleSharedDarkOnesOwnLuckChoice}
            onStrokeOfLuckChoice={handleSharedStrokeOfLuckChoice}
            setEmpoweredSpellSelection={setSharedEmpoweredSpellSelection}
            onEmpoweredSpellChoice={handleSharedEmpoweredSpellChoice}
            onStandAgainstTideChoice={handleSharedStandAgainstTideChoice}
          />
          {isDM && initiativeConfirmationDraft && !combatActive ? (
            <Suspense fallback={null}>
              <CombatInitiativeConfirmationDialog
                entries={initiativeConfirmationDraft.order}
                surprisedCount={initiativeConfirmationDraft.surprisedTokenIds.length}
                submitting={initiativeConfirmationSubmitting}
                onEntriesChange={(order) => setInitiativeConfirmationDraft((current) => current
                  ? { ...current, order }
                  : current)}
                onCancel={() => {
                  if (initiativeConfirmationSubmitting) return
                  setInitiativeConfirmationDraft(null)
                }}
                onConfirm={() => { void startCombat(initiativeConfirmationDraft) }}
              />
            </Suspense>
          ) : null}
          {isDM && liveInitiativeConfirmationDraft && combatActive ? (
            <Suspense fallback={null}>
              <CombatInitiativeConfirmationDialog
                entries={liveInitiativeConfirmationDraft.order}
                surprisedCount={0}
                submitting={liveInitiativeConfirmationSubmitting}
                title="确认新增怪物先攻"
                description="新增怪物已掷先攻。DM 可在此调整顺序或互换骰值；确认前它们不会进入战斗轮转。"
                footerHint="确认只会插入新增怪物，不会切换当前行动者，也不会重置轮次。"
                confirmLabel="确认并加入当前战斗"
                submittingLabel="正在同步…"
                dismissible={false}
                onEntriesChange={(order) => setLiveInitiativeConfirmationDraftLocked({
                  ...liveInitiativeConfirmationDraft,
                  order,
                })}
                onCancel={() => undefined}
                onConfirm={() => { void confirmLiveInitiativeAdditions(liveInitiativeConfirmationDraft) }}
              />
            </Suspense>
          ) : null}
          {isDM && showSurpriseSetup && !combatActive && activeMap && (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div role="dialog" aria-modal="true" aria-label="突袭设置" className="w-full max-w-xl rounded-2xl border border-rose-400/25 bg-void-950 p-5 shadow-2xl">
                <h3 className="text-lg font-semibold text-rose-100">开始战斗 · 突袭判定</h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">

                </p>
                <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
                  {activeMap.tokens.filter((token) => token.type === 'player' || token.type === 'enemy').map((token) => {
                    const effectiveSide = dnd5eCombatTokenSide(token)
                    const cannotBeSurprised = dnd5eTokenCannotBeMarkedSurprised(token, characters)
                    return (
                      <label
                        key={token.id}
                        title={cannotBeSurprised ? '该单位清醒时不会受突袭。' : undefined}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                          cannotBeSurprised
                            ? 'border-emerald-400/20 bg-emerald-500/[0.06] text-emerald-100'
                            : 'border-white/8 bg-white/[0.035] text-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!cannotBeSurprised && surpriseSelection.has(token.id)}
                          disabled={cannotBeSurprised}
                          onChange={(event) => setSurpriseSelection((current) => {
                            const next = new Set(current)
                            if (event.target.checked) next.add(token.id)
                            else next.delete(token.id)
                            return next
                          })}
                          className="accent-rose-500"
                        />
                        <span className="text-lg">{token.emoji || '◉'}</span>
                        <span className="min-w-0 flex-1 truncate">{token.label}</span>
                        <span className={`text-[10px] ${cannotBeSurprised ? 'text-emerald-300' : 'text-slate-500'}`}>
                          {cannotBeSurprised ? '不会受突袭' : effectiveSide === 'player' ? '玩家' : '敌人'}
                        </span>
                      </label>
                    )
                  })}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowSurpriseSetup(false)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">取消</button>
                  <button type="button" onClick={() => void requestCombatStartConfirmation([...surpriseSelection])} className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400">掷先攻并继续</button>
                </div>
              </div>
            </div>
          )}
          <DmAdjudicationPanel
            isDm={isDM}
            prompt={sharedDmAdjudicationPrompt}
            tokens={activeMap.tokens}
            pluginAreas={activeMap.dnd5ePluginAreas ?? []}
            dc={dmAdjudicationDc}
            setDc={setDmAdjudicationDc}
            mapOverride={dmAdjudicationMapOverride}
            setMapOverride={setDmAdjudicationMapOverride}
            saveOverride={dmAdjudicationSaveOverride}
            setSaveOverride={setDmAdjudicationSaveOverride}
            effects={dmAdjudicationEffects}
            setEffects={setDmAdjudicationEffects}
            concentrationRounds={dmAdjudicationConcentrationRounds}
            setConcentrationRounds={setDmAdjudicationConcentrationRounds}
            note={dmAdjudicationNote}
            setNote={setDmAdjudicationNote}
            onDecision={handleSharedDmAdjudicationChoice}
          />
          <ReactionInterruptPanels
            savingThrowRerollPrompt={sharedSavingThrowRerollPrompt}
            protectionPrompt={sharedProtectionPrompt}
            shieldSpellPrompt={sharedShieldSpellPrompt}
            counterspellPrompt={sharedCounterspellPrompt}
            uncannyDodgePrompt={sharedUncannyDodgePrompt}
            deflectMissilesPrompt={sharedDeflectMissilesPrompt}
            opportunityAttackPrompt={sharedOpportunityAttackPrompt}
            onSavingThrowRerollChoice={handleSharedSavingThrowRerollChoice}
            onProtectionChoice={handleSharedProtectionChoice}
            onShieldSpellChoice={handleSharedShieldSpellChoice}
            onCounterspellChoice={handleSharedCounterspellChoice}
            onUncannyDodgeChoice={handleSharedUncannyDodgeChoice}
            onDeflectMissilesChoice={handleSharedDeflectMissilesChoice}
            onOpportunityAttackChoice={handleSharedOpportunityAttackChoice}
          />

          <Suspense fallback={null}>
            <MapWorkspacePanelsLayer
              combatActive={combatActive}
              combatLog={combatLog}
              combatLogOpen={combatLogOpen}
              tokens={displayActiveMap?.tokens ?? []}
              characters={characters}
              currentTurnTokenId={currentInitiativeToken?.id}
              showFloatingInitiative={combatActive && initiativeOrder.length > 0 && !showBar}
              initiativeEntries={displayInitiativeOrder}
              initiativeActiveIndex={initiativeIndex}
              initiativeScrollOffset={initiativeScroll}
              initiativeRound={round}
              initiativeHitPoints={hpByToken}
              defeatedTokenIds={defeatedTokenIds}
              onInitiativeScroll={setInitiativeScroll}
              onInitiativeSelect={openTokenDetails}
              onClearCombatLog={() => setCombatLog([])}
              onOpenCombatLog={() => setCombatLogOpen(true)}
              onCloseCombatLog={() => setCombatLogOpen(false)}
              showCombatLogDock={false}
            />
          </Suspense>

          {sharedRollConfirmationPrompt && !(
            isDM &&
            sharedRollConfirmationPrompt.payload.visibility === 'dm-only' &&
            sharedRollConfirmationPrompt.payload.allowDmOverride === true
          ) && (
            <MapLazyOverlayBoundary label="正在打开投骰确认…">
              <D20RollConfirmationOverlay
                key={sharedRollConfirmationPrompt.id}
                interrupt={sharedRollConfirmationPrompt}
                isDM={isDM}
                playerCharacter={!isDM && playerChar ? { id: playerChar.id, name: playerChar.name } : undefined}
                busy={settlingRollConfirmation}
                onContribute={handleD20ReplacementContribution}
                onContinue={handleD20RollContinue}
              />
            </MapLazyOverlayBoundary>
          )}
          <DicePresentationOverlays
            roomRolls={roomDiceFeed.entries}
            onClearRoomRolls={roomDiceFeed.clear}
            key={`${combatPlaybackLedgerScope}:${activeMapId}:${diceRecoveryGeneration}`}
            historyScope={`${combatPlaybackLedgerScope}:${activeMapId}`}
            roll={roll}
            diceBoxD20={diceBoxD20}
            diceBoxRoll={diceBoxRoll}
            rollRequestPreview={rollRequestPreview}
            activeRollStatus={activeDiceRollStatus}
            playerRollPrompt={pendingPlayerDiceRoll
              ? {
                  id: pendingPlayerDiceRoll.requestId,
                  check: pendingPlayerDiceRoll.check,
                  label: pendingPlayerDiceRoll.label,
                  targetName: pendingPlayerDiceRoll.targetName,
                  count: pendingPlayerDiceRoll.count,
                  sides: pendingPlayerDiceRoll.sides,
                  busy: pendingPlayerDiceRoll.busy,
                }
              : null}
            checkOutcome={checkOutcome}
            checkResult={checkResult}
            secretConfirmation={secretDiceOverride
              ? {
                  id: secretDiceOverride.id,
                  onModeChange: secretDiceOverride.onModeChange,
                  check: secretDiceOverride.check,
                  label: secretDiceOverride.label,
                  targetName: secretDiceOverride.targetName,
                  sides: secretDiceOverride.sides,
                  values: secretDiceOverride.values,
                  visibility: secretDiceOverride.visibility,
                }
              : isDM &&
                  sharedRollConfirmationPrompt?.payload.visibility === 'dm-only' &&
                  sharedRollConfirmationPrompt.payload.allowDmOverride === true
                ? {
                    id: sharedRollConfirmationPrompt.id,
                    label: sharedRollConfirmationPrompt.payload.label,
                    targetName: sharedRollConfirmationPrompt.payload.targetName,
                    sides: 20,
                    values: [sharedRollConfirmationPrompt.payload.originalValue],
                    busy: settlingRollConfirmation,
                  }
                : null}
            isDM={isDM}
            freeReroll={!isSpectator && lastFreeDiceRoll ? {
              roll: lastFreeDiceRoll.roll,
              onReroll: (index) => handleMapFreeDiceRoll(lastFreeDiceRoll.input,
                index == null ? undefined : { values: lastFreeDiceRoll.roll.values, index }),
            } : undefined}
            dockTab={rightCombatDockTab}
            controlsHost={combatDiceControlsHost}
            combatLogCount={combatLog.length}
            combatLogPanel={<Suspense fallback={<div className="rounded-2xl bg-void-950 p-4 text-slate-400">正在载入战斗记录…</div>}>
              <MapWorkspaceCombatLogPanel
                combatLog={combatLog} tokens={displayActiveMap?.tokens ?? []} characters={characters}
                currentTurnTokenId={currentInitiativeToken?.id}
                onClearCombatLog={() => setCombatLog([])} onCloseCombatLog={() => setRightCombatDockTab(null)}
              />
            </Suspense>}
            onDockTabChange={setRightCombatDockTab}
            renderFreeRollControls={!isSpectator ? (close, visibility, onVisibilityChange) => (
              <Suspense fallback={<div className="p-4 text-xs text-slate-400">正在打开掷骰设置…</div>}>
                <MapDiceRoller
                  visibility={visibility}
                  onVisibilityChange={onVisibilityChange}
                  key={mapDiceCharacter?.id ?? 'no-character'}
                  embedded
                  onRequestClose={close}
                  isDm={isDM}
                  character={mapDiceCharacter ?? undefined}
                  canCheck={!isDM ? !!playerChar : combatActive
                    ? canControlPlayerTurn && mapDiceCharacter?.id === turnCharacter?.id
                    : !!mapDiceCharacter && (isDM || mapDiceCharacter.id === playerChar?.id)}
                  headlessCheck={isDM && (combatActive || !!mapDiceActorTokenId)}
                  pending={isDM && !!pendingPlayerAction}
                  turnEconomy={mapDiceTurnEconomy}
                  perceptionTargets={(activeMap?.tokens ?? [])
                    .filter((token) => token.id !== mapDiceActorTokenId && token.type !== 'obstacle')
                    .map((token) => ({ id: token.id, label: token.label || token.emoji || token.id }))}
                  combatRollsVisible={combatRollsVisible}
                  onCombatRollsVisibleChange={setCombatRollsVisible}
                  onRoll={handleMapFreeDiceRoll}
                  onReroll={lastFreeDiceRoll ? () => handleMapFreeDiceRoll(lastFreeDiceRoll.input) : undefined}
                  onCheck={(payload) => {
                    setDnd5eWeaponTargeting(null)
                    setDnd5eWeaponAttackOptions(undefined)
                    return sendPlayerDnd5eAbilityCheckRequest(payload)
                  }}
                />
              </Suspense>
            ) : undefined}
            onRollDone={handleRollDone}
            onD20Complete={completeDiceBoxD20}
            onDiceComplete={completeDiceBoxRoll}
            onPreviewComplete={completeRollRequestPreview}
            onPlayerRoll={handlePlayerDiceRoll}
            onSecretConfirm={async (confirmationId, values) => {
              if (secretDiceOverride?.id === confirmationId) {
                const request = secretDiceOverride
                request.resolve(values)
                setSecretDiceOverride((current) => current?.id === request.id ? null : current)
                return
              }
              if (
                sharedRollConfirmationPrompt?.id === confirmationId &&
                sharedRollConfirmationPrompt.payload.visibility === 'dm-only' &&
                sharedRollConfirmationPrompt.payload.allowDmOverride === true
              ) {
                await handleD20RollContinue(undefined, values[0])
              }
            }}
          />

          {isDM && activeMap && (
            <Suspense fallback={null}>
              <DmCombatRecoveryDialog
                open={dmCombatRecoveryOpen} mapId={activeMap.id} combatId={combatId} round={round}
                currentActorLabel={currentInitiativeToken?.label} onClose={() => setDmCombatRecoveryOpen(false)}
                onRecovered={async (result) => {
                  combatPublishSeqRef.current += 1
                  clearSharedInterruptLocalState()
                  clearPlayerCombatUI()
                  dmAdjudicationResumeGateRef.current?.resolve()
                  dmAdjudicationResumeGateRef.current = null
                  await reloadDnd5eAuthorityState({ includeMapGeometry: true })
                  await showCombatNotice('战斗已完整恢复', `已撤销 ${result.transactions.length} 个战斗事务，并重新载入 ${result.restored.map((entry) => entry.resource).join('、')}。`, 'sky')
                }}
              />
            </Suspense>
          )}

          {/* 顶部控件浮层（可隐藏）；临时移动/施法配置固定叠在本层之上。 */}
          {showBar ? (
            <div className="pointer-events-none absolute inset-x-2 top-2 z-[80] flex flex-col items-center gap-2">
            <div className="pointer-events-none relative flex w-full items-start justify-between gap-2">
            <div className="glass pointer-events-auto flex min-w-0 flex-wrap items-center gap-2 rounded-xl px-2 py-1.5 shadow-xl">
              {!combatActive ? modeToggle : null}
              {/* 战斗状态 + 控制 */}
              <div
                data-testid="combat-status"
                className={[
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold',
                  combatActive ? 'bg-rose-500/15 text-rose-200' : 'bg-white/5 text-slate-400',
                ].join(' ')}
              >
                <Swords className="h-3.5 w-3.5" />
                {combatActive
                  ? (isDM ? `第 ${round} 回合` : `第 ${round} 回合 · ${currentInitiativeToken?.label ?? '等待行动者'}`)
                  : '未开始'}
              </div>
              {combatActive && (isDM ? (
                <button
                  type="button"
                  data-testid="combat-flow-pause-control"
                  onClick={() => void (combatFlowPause
                    ? resumeCombatFlow()
                    : pauseCombatFlowManually()).catch(() => {
                      void showCombatNotice('暂停状态同步失败', '没有改变战斗流程，请检查房间连接后重试。', 'amber')
                    })}
                  disabled={combatFlowPause?.phase === 'adjudicating'}
                  className={[
                    'flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-wait',
                    combatFlowPause?.phase === 'adjudicating'
                      ? 'border-amber-300/30 bg-amber-500/20 text-amber-100'
                      : combatFlowPause
                        ? 'border-emerald-300/25 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10',
                  ].join(' ')}
                  title={combatFlowPause?.label ?? '暂停房间内所有战斗操作'}
                >
                  {combatFlowPause ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  {combatFlowPause?.phase === 'adjudicating'
                    ? 'DM 裁定中'
                    : combatFlowPause
                      ? '继续战斗'
                      : '暂停'}
                </button>
              ) : (
                combatFlowPause && (
                  <span
                    data-testid="combat-flow-pause-label"
                    className="rounded-lg border border-amber-300/25 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-100"
                  >
                    {combatFlowPause.phase === 'adjudicating' ? 'DM 裁定中' : '等待 DM 继续'}
                  </span>
                )
              ))}
              {isDM &&
                (combatActive ? (
                  <>
                    <button
                      type="button"
                      data-testid="dm-next-turn"
                      onClick={() => { void advanceInitiative() }}
                      disabled={
                        !!combatFlowPause ||
                        manualInitiativeAdvancePending ||
                        dnd5eTurnStartSettlementPending ||
                        initiativeOrder.length === 0
                      }
                      className="flex items-center gap-1 rounded-lg bg-arcane-500/25 px-2.5 py-1 text-xs font-semibold text-arcane-100 hover:bg-arcane-500/40 disabled:cursor-wait disabled:opacity-40"
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                      {manualInitiativeAdvancePending || dnd5eTurnStartSettlementPending ? '推进中…' : '下一位'}
                    </button>

                  </>
                ) : (
                  <button
                    data-testid="dm-start-combat"
                    onClick={() => {
                      setSurpriseSelection(new Set())
                      setShowSurpriseSetup(true)
                    }}
                    className="flex items-center gap-1 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 px-2.5 py-1 text-xs font-semibold text-white"
                  >
                    <Play className="h-3.5 w-3.5" />
                    开始战斗
                  </button>
                ))}

              {isDM && (
                <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="dm-authoritative-undo"
                  onClick={() => { void openCombatRecovery() }}
                  className="flex items-center gap-1 rounded-lg border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-100 hover:bg-sky-500/20 disabled:cursor-wait disabled:opacity-50"
                  title="从服务器检查点完整恢复 HP、资源、位置、回合与状态"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  战斗恢复
                </button>
                    {combatActive && (
                    <button
                      data-testid="dm-end-combat"
                      onClick={() => void endCombat()}
                      disabled={combatEnding}
                      className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
                    >
                      <Square className="h-3.5 w-3.5" />
                      {combatEnding ? '结束中…' : '结束'}
                    </button>
                    )}
                </div>
              )}

              {canControlDeathSaveTurn && (
                <button
                  data-testid="dnd5e-death-save"
                  onClick={() => sendDnd5eDeathSaveRequest()}
                  disabled={!!pendingPlayerAction}
                  className="flex items-center gap-1 rounded-lg bg-rose-500/25 px-2.5 py-1 text-xs font-semibold text-rose-100 hover:bg-rose-500/40 disabled:cursor-not-allowed disabled:opacity-40"
                  title="由 DM 权威投掷并同步死亡豁免；未恢复生命值时自动结束本回合"
                >
                  <Skull className="h-3.5 w-3.5" />
                  进行死亡豁免
                </button>
              )}

              {/* 玩家：结束自己的回合 */}
              {!isDM && (
                <button
                  data-testid="player-end-turn-top"
                  onClick={handlePlayerEndTurn}
                  disabled={!!pendingPlayerAction || !canEndPlayerTurn || !turnCharacter}
                  className={[
                    'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                    canEndPlayerTurn
                      ? 'bg-arcane-500/25 text-arcane-100 hover:bg-arcane-500/40'
                      : 'cursor-not-allowed bg-white/5 text-slate-600',
                  ].join(' ')}
                  title={canEndPlayerTurn && turnCharacter
                    ? `结束 ${turnCharacter.name} 的回合；下一回合恢复动作、附赠动作、反应与移动`
                    : '当前不是你的角色回合'}
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  结束回合
                </button>
              )}


            </div>
            <div className="glass pointer-events-auto flex shrink-0 items-center gap-2 rounded-xl px-2 py-1.5 shadow-xl">
              <div ref={setCombatDiceControlsHost} className="flex items-center" />
              <button
                onClick={() => setShowBar(false)}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-200"
                title="隐藏控制栏"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            </div>
            {combatActive && initiativeOrder.length > 0 && (
              <div className="relative w-full h-[130px] pointer-events-none">
              <div className="map-workspace-initiative">
              <Suspense fallback={null}>
                <MapWorkspaceInitiativePanel
                  entries={displayInitiativeOrder}
                  activeIndex={presentedAreaTurnStart?.initiativeIndex ?? initiativeIndex}
                  scrollOffset={initiativeScroll}
                  round={presentedAreaTurnStart?.round ?? round}
                  hpByToken={hpByToken}
                  defeatedTokenIds={defeatedTokenIds}
                  onScroll={setInitiativeScroll}
                  onSelect={(tokenId) => {
                    if (dnd5eSpellTargeting) {
                      void handleSelectToken(tokenId)
                      return
                    }
                    if (selectDnd5eAreaModifierTarget(tokenId)) return
                    openTokenDetails(tokenId)
                  }}
                />
              </Suspense>
              </div>
              </div>
            )}
            </div>
          ) : (
            <button
              onClick={() => setShowBar(true)}
              className="glass absolute right-2 top-2 z-30 flex h-9 items-center gap-1 rounded-xl px-3 text-xs font-medium text-slate-300 shadow-xl hover:text-arcane-200"
              title="显示控制栏"
            >
              <ChevronUp className="h-4 w-4 rotate-180" />
              控制栏
            </button>
          )}

          {!isDM && !isSpectator && <SourceLocationPanel activeMapId={activeMap.id} />}
          {showBar && isDM && (
            <MapToolsDock panel={mapToolPanel} onChange={(next) => {
              if (gridAdjustMode) commitGridCalibration(activeMap.id)
              setMapToolPanel(next)
              setMapTabletopTool(next === 'drawing' ? 'freehand' : 'none')
              setMeasureMode(next === 'ruler')
              setDeleteSelectMode(false)
              setGridAdjustMode(false)
              setGridSizePreview(false)
              setFogEditMode(next === 'fog')
              setFogTool('pan')
              setFogPreviewAsPlayer(false)
              setGeometryEditMode(next === 'geometry' && geometryEditorSection === 'structure')
              setSceneDrawTarget(null)
              if (next === 'geometry') setSceneEditorVisible(false)
              setGeometryPreviewAsPlayer(false)
              setShowMoveRange(false)
              selectGeometryEntity(null)
            }}>
              {mapToolPanel === 'map' && (<>
                <button
                  type="button"
                  data-testid="scene-orchestration-toolbar-button"
                  aria-pressed={sceneEditorVisible}
                  onClick={() => {
                    const nextVisible = !sceneEditorVisible
                    setSceneEditorVisible(nextVisible)
                    if (!nextVisible) setSceneDrawTarget(null)
                  }}
                  className={[
                    'flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors',
                    sceneEditorVisible
                      ? 'border-violet-300/35 bg-violet-500/25 text-violet-100'
                      : 'border-violet-400/15 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20',
                  ].join(' ')}
                  title="打开场景编排、天气与场景音频设置"
                >
                  <MapPinned className="h-3.5 w-3.5" />
                  场景编排
                  {scenePendingRunCount > 0 && (
                    <span className="rounded-full bg-amber-400 px-1.5 text-[10px] leading-4 text-slate-950">
                      {scenePendingRunCount}
                    </span>
                  )}
                </button>
                  {/* 地图切换 */}
                  <MapWorkspaceMapSelect
                    activeMapId={activeMap.id}
                    setSelectedTokenId={setSelectedTokenId}
                  />
                  <ObjectFlightArrivalControl onResolve={async selection => {
                    try {
                    const restored = await runObjectFlightArrival({ ...selection,
                      collectRolls: async (prepared, context) => {
                        objectFlightDiceMapsRef.current = context.sourceMap.id === context.destinationMap.id
                          ? [context.sourceMap] : [context.sourceMap, context.destinationMap]
                        const rolled = await rollDnd5eActivityTriggerDiceV1({ state: context.state,
                          actorId: prepared.entry.actorId, targetIds: prepared.targetIds,
                          available: { packageId: prepared.entry.packageId, packageVersion: '1.0.0',
                            activity: prepared.activity, confirmation: 'automatic', retention: 'single-event' },
                          triggerContext: { eventId: prepared.entry.id, event: 'damage-dealt',
                            source: { kind: 'spell', id: prepared.entry.activityId, level: prepared.entry.slotLevel },
                            eligibleActorIds: [prepared.entry.actorId], eligibleTargetIds: prepared.targetIds },
                          roll: request => rollDiceBoxValues(request.count, request.sides, request.label, request.targetName,
                            { rollerTokenId: request.rollerTokenId, d20RollKind: request.sides === 20 ? 'saving-throw' : undefined }),
                        })
                        if ('unsupported' in rolled) throw Error(rolled.unsupported)
                        return rolled.rolls
                      },
                      followups: { rollD20: rollDiceBoxD20, rollD4: async (label, name, context) => (await rollDiceBoxValues(1, 4, label, name, context))[0],
                        rollDice: rollDiceBoxValues, rollUnsupportedAirborneFalls: rollDnd5eUnsupportedAirborneFalls, settleMountedBalance: settleDnd5eMapMountedBalance,
                        requestHellishRebuke: requestSharedHellishRebukeChoice,
              chooseSpellDamageDice:request=>collectSharedSpellDamageDieChoices({...request,groups:[request.group]}),
                        requestSavingThrowReroll: requestDnd5eSavingThrowRerollDice,
                        requestBardicInspiration: requestDnd5eBardicInspirationRoll,
                        requestOptionalBonusDie: requestDnd5eOptionalBonusDieUse,
                        requestDarkOnesOwnLuck: requestDnd5eDarkOnesOwnLuckRoll,
                        requestPostSpellRandomTableChoice: requestSharedPostSpellRandomTableChoice,
                        requestPostSpellRandomTableAdjudication: requestSharedPostSpellRandomTableAdjudication,
                        settleActivityTriggers: settleRegisteredDnd5eActivityTriggers },
                    })
                    await Promise.all([useMapStore.getState().loadShared(), useCharacterStore.getState().loadShared()])
                    pushCombatLog(`物件飞行已恢复：${restored.completion.completedReceipt.object.label}`, 'system')
                    } finally { objectFlightDiceMapsRef.current = [] }
                  }} />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-white/10"
                    title="上传新地图"
                  >
                    <Upload className="h-3.5 w-3.5" /> 上传地图
                  </button>
                  <button
                    type="button"
                    onClick={() => uvttFileRef.current?.click()}
                    disabled={combatActive}
                    className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                    title={combatActive ? '战斗中无法替换地图几何' : '直接导入 UVTT、DD2VTT 或 DF2VTT 地图'}
                  >
                    <FileUp className="h-3.5 w-3.5" />
                    导入 UVTT
                  </button>

                  <button
                    onClick={() => updateMap(activeMap.id, { showGrid: !activeMap.showGrid })}
                    className={[
                      'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                      activeMap.showGrid ? 'bg-arcane-500/20 text-arcane-200' : 'text-slate-400 hover:bg-white/5',
                    ].join(' ')}
                    title={
                      activeMap.builtinGridDetected
                        ? `底图网格已识别 · ${activeMap.gridSize}px（叠加网格可手动开启）`
                        : '叠加网格开关'
                    }
                  >
                    <Grid3x3 className="h-3.5 w-3.5" />
                    {activeMap.builtinGridDetected ? (
                      <span className="text-[10px] text-emerald-300/90">底图✓</span>
                    ) : (
                      <span className="text-[10px] text-slate-500">未识别</span>
                    )}
                  </button>
                  <button
                    onClick={() => updateMap(activeMap.id, { showCoordinates: activeMap.showCoordinates === false })}
                    className={[
                      'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                      activeMap.showCoordinates !== false
                        ? 'bg-sky-500/20 text-sky-200'
                        : 'text-slate-400 hover:bg-white/5',
                    ].join(' ')}
                    title="显示/隐藏地图 X/Y 坐标轴"
                  >
                    <Grid3x3 className="h-3.5 w-3.5" />
                    XY
                  </button>
                  <button
                    onClick={() => void handleRedetectGrid()}
                    disabled={gridDetecting}
                    className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs font-medium text-slate-400 hover:bg-white/10 hover:text-slate-200 disabled:opacity-50"
                    title="重新分析当前地图底图是否自带网格"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${gridDetecting ? 'animate-spin' : ''}`} /> 重新识别网格
                  </button>
                  <button
                    onClick={() => {
                      if (gridAdjustMode) commitGridCalibration(activeMap.id)
                      setGridAdjustMode((v) => {
                        const next = !v
                        if (next) {
                          setMeasureMode(false)
                          setDeleteSelectMode(false)
                          setFogEditMode(false)
                        }
                        return next
                      })
                    }}
                    className={[
                      'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                      gridAdjustMode
                        ? 'bg-amber-500/25 text-amber-200'
                        : 'text-slate-400 hover:bg-white/5',
                    ].join(' ')}
                    title="拖拽平移网格对齐底图；方向键微调（Shift=5px）"
                  >
                    <Move className="h-3.5 w-3.5" />
                    移动网格
                  </button>
                  <button
                    onClick={() =>
                      updateMap(activeMap.id, {
                        snapMonstersToGrid: activeMap.snapMonstersToGrid === false,
                      })
                    }
                    className={[
                      'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                      activeMap.snapMonstersToGrid !== false
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : 'text-slate-400 hover:bg-white/5',
                    ].join(' ')}
                    title="开启：所有单位吸附格心、测距对齐格子；关闭：玩家、敌人和 NPC 均可自由放置，测距使用任意两点"
                  >
                    <Magnet className="h-3.5 w-3.5" />
                    吸附
                  </button>
                  {isDM && <Dnd5eMapPlaneControl mapId={activeMap.id} value={activeMap.dnd5ePlane}
                    etherealAdjacent={activeMap.dnd5eEtherealAdjacent}
                    onEtherealAdjacentChange={dnd5eEtherealAdjacent => updateMap(activeMap.id, { dnd5eEtherealAdjacent })}
                    onChange={dnd5ePlane => updateMap(activeMap.id, { dnd5ePlane })} />}
                  <div
                    className="flex flex-wrap items-center gap-1 rounded-lg bg-white/5 px-2 py-1"
                    title="格宽=屏幕上每格像素（对齐底图）；1 格固定 5 尺"
                  >
                    <SlidersHorizontal className="h-3 w-3 text-slate-500" />
                    <span className="text-[10px] text-slate-500">格宽</span>
                    <input
                      type="range"
                      min={gridSizeBounds(activeMap).min}
                      max={gridSizeBounds(activeMap).max}
                      value={clampGridSize(
                        gridCalibrationDraft?.mapId === activeMap.id
                          ? gridCalibrationDraft.gridSize
                          : activeMap.gridSize,
                        activeMap,
                      )}
                      onPointerDown={() => setGridSizePreview(true)}
                      onPointerUp={() => {
                        setGridSizePreview(false)
                        commitGridCalibration(activeMap.id)
                      }}
                      onPointerLeave={() => {
                        setGridSizePreview(false)
                        commitGridCalibration(activeMap.id)
                      }}
                      onChange={(e) =>
                        previewGridCalibration(activeMap.id, {
                          gridSize: clampGridSize(Number(e.target.value), activeMap),
                        })
                      }
                      className="w-16 accent-arcane-500"
                    />
                    <input
                      type="number"
                      min={gridSizeBounds(activeMap).min}
                      max={gridSizeBounds(activeMap).max}
                      value={clampGridSize(
                        gridCalibrationDraft?.mapId === activeMap.id
                          ? gridCalibrationDraft.gridSize
                          : activeMap.gridSize,
                        activeMap,
                      )}
                      onFocus={() => setGridSizePreview(true)}
                      onBlur={() => {
                        setGridSizePreview(false)
                        commitGridCalibration(activeMap.id)
                      }}
                      onChange={(e) =>
                        previewGridCalibration(activeMap.id, {
                          gridSize: clampGridSize(
                            Number(e.target.value) || (
                              gridCalibrationDraft?.mapId === activeMap.id
                                ? gridCalibrationDraft.gridSize
                                : activeMap.gridSize
                            ),
                            activeMap,
                          ),
                        })
                      }
                      className="w-10 rounded border border-white/10 bg-void-900/60 px-1 py-0.5 text-center text-xs text-slate-200 outline-none focus:border-arcane-500"
                    />
                    <span className="text-[10px] text-slate-500">px·5尺/格</span>
                    <span className="mx-0.5 h-4 w-px bg-white/10" />
                    <input
                      type="color"
                      value={activeMap.gridColor ?? '#c4b5fd'}
                      onPointerDown={() => setGridSizePreview(true)}
                      onPointerUp={() => setGridSizePreview(false)}
                      onChange={(e) => {
                        setGridSizePreview(true)
                        updateMap(activeMap.id, { gridColor: e.target.value })
                      }}
                      className="h-6 w-6 cursor-pointer rounded border border-white/10 bg-transparent p-0"
                      title="叠加网格颜色"
                    />
                    <input
                      type="range"
                      min={0.08}
                      max={0.85}
                      step={0.02}
                      value={activeMap.gridOpacity ?? 0.28}
                      onChange={(e) =>
                        updateMap(activeMap.id, { gridOpacity: Number(e.target.value) })
                      }
                      onPointerDown={() => setGridSizePreview(true)}
                      onPointerUp={() => setGridSizePreview(false)}
                      className="w-10 accent-arcane-500"
                      title="网格透明度"
                    />
                  </div>
                  <button
                    onClick={() => {
                      void (async () => {
                        if (await showAppConfirm({
                          title: '删除地图',
                          message: `删除地图“${activeMap.name}”？`,
                          confirmLabel: '删除',
                          tone: 'danger',
                        })) removeMap(activeMap.id)
                      })()
                    }}
                    className="flex items-center rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-rose-500/15 hover:text-rose-300"
                    title="删除当前地图"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> 删除地图
                  </button>

              </>)}
              {mapToolPanel === 'drawing' && (<>
                  <div className="flex flex-wrap items-center gap-1 rounded-lg border border-amber-400/15 bg-amber-500/[0.05] px-1 py-0.5" title="临时桌面协作标记，不写入永久地图几何或战争迷雾">
                    <MapViewportNoteButton
                      notes={activeMap.viewportNotes ?? []}
                      onChange={(viewportNotes) => updateMap(activeMap.id, { viewportNotes })}
                    />
                    <span className="mx-0.5 h-4 w-px bg-amber-200/15" />
                    <button
                      type="button"
                      onClick={() => chooseMapTabletopTool('focus')}
                      className={`rounded-md p-1.5 ${mapTabletopTool === 'focus' ? 'bg-amber-500/25 text-amber-100' : 'text-slate-400 hover:bg-white/10'}`}
                      title="点击地图，把全员视角聚焦到该处"
                    >
                      <LocateFixed className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseMapTabletopTool('arrow')}
                      className={`rounded-md p-1.5 ${mapTabletopTool === 'arrow' ? 'bg-amber-500/25 text-amber-100' : 'text-slate-400 hover:bg-white/10'}`}
                      title="拖动画临时箭头"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseMapTabletopTool('circle')}
                      className={`rounded-md p-1.5 ${mapTabletopTool === 'circle' ? 'bg-amber-500/25 text-amber-100' : 'text-slate-400 hover:bg-white/10'}`}
                      title="从圆心向外拖动画临时圈选"
                    >
                      <CircleIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseMapTabletopTool('freehand')}
                      className={`rounded-md p-1.5 ${mapTabletopTool === 'freehand' ? 'bg-amber-500/25 text-amber-100' : 'text-slate-400 hover:bg-white/10'}`}
                      title="按住并拖动，自由绘制临时标注"
                    >
                      <PencilLine className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseMapTabletopTool('eraser')}
                      className={`rounded-md p-1.5 ${mapTabletopTool === 'eraser' ? 'bg-rose-500/20 text-rose-200' : 'text-slate-400 hover:bg-white/10 hover:text-rose-200'}`}
                      title="橡皮擦：点击一条标注将其删除；也可直接右键标注删除"
                    >
                      <Eraser className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={activeMapTabletop.annotations.length === 0}
                      onClick={() => void clearMapTabletopAnnotations(activeMap.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-rose-200 disabled:opacity-30"
                      title="清除当前地图的全部临时标注"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <span
                      className={`px-1 text-[10px] ${mapDoubleClickPingEnabled ? 'text-amber-200/70' : 'text-slate-500'}`}
                      title={mapDoubleClickPingEnabled ? '双击地图发送临时 Ping' : '当前交互工具占用地图点击，退出该工具后恢复 Ping'}
                    >
                      {mapDoubleClickPingEnabled ? '双击 Ping' : 'Ping 暂停'}
                    </span>
                  </div>

              </>)}
              {mapToolPanel === 'geometry' && (<>
                  <MapGeometryEditorTabs section={geometryEditorSection} onStructure={() => { setGeometryEditorSection('structure'); setSceneDrawTarget(null); setGeometryEditMode(true) }}
                    onTravel={() => {
                        setGeometryEditorSection('travel')
                        setSceneEditorVisible(false)
                        setSceneDrawTarget(null)
                        setGeometryEditMode(false)
                        setGeometryPreviewAsPlayer(false)
                        setFogEditMode(false)
                        setGridAdjustMode(false)
                        setMeasureMode(false)
                        setDeleteSelectMode(false)
                        setShowMoveRange(false)
                        setMapTabletopTool('none')
                        selectGeometryEntity(null)
                      }}
                  />
                  {geometryEditorSection === 'travel' && <div key={activeMap.id} ref={setTravelEditorHost} className="max-h-[65vh] w-[min(400px,calc(100vw-3rem))] overflow-y-auto" />}
                  {geometryEditorSection === 'structure' && activeGeometry && (
                    <MapGeometryToolbar
                      mapId={activeMap.id}
                      geometry={activeGeometry}
                      selectedEntity={selectedGeometryEntity}
                      selectedToken={selectedCharacterToken ?? selectedToken}
                      editMode={geometryEditMode}
                      tool={geometryTool}
                      wallMaterial={geometryWallMaterial}
                      previewAsPlayer={geometryPreviewAsPlayer}
                      snapToGrid={geometrySnapToGrid}
                      terrainEditingLocked={combatActive}
                      diagnosticsEnabled={geometryDiagnosticsEnabled}
                      diagnosticIssueCount={activeGeometryDiagnostics?.issues.length ?? 0}
                      diagnosticsTruncated={activeGeometryDiagnostics?.truncated ?? false}
                      detectionCandidates={activeGeometryDetectionCandidates}
                      onEditModeChange={(enabled) => {
                        setGeometryEditMode(enabled)
                        if (enabled) {
                          setMeasureMode(false)
                          setDeleteSelectMode(false)
                          setGridAdjustMode(false)
                          setFogEditMode(false)
                          setFogPreviewAsPlayer(false)
                          setShowMoveRange(false)
                        } else {
                          setGeometryPreviewAsPlayer(false)
                          selectGeometryEntity(null)
                        }
                      }}
                      onToolChange={(nextTool) => {
                        if (combatActive && nextTool === 'elevation') {
                          void showCombatNotice('高度区域已锁定', '只能在战斗开始前绘制或修改地图高度区域。', 'amber')
                          return
                        }
                        setGeometryTool(nextTool)
                        selectGeometryEntity(null)
                      }}
                      onWallMaterialChange={setGeometryWallMaterial}
                      onPreviewChange={setGeometryPreviewAsPlayer}
                      onSnapToGridChange={setGeometrySnapToGrid}
                      onDiagnosticsEnabledChange={setGeometryDiagnosticsEnabled}
                      onDetectionCandidatesChange={(candidates) => {
                        setGeometryDetectionCandidates(candidates)
                        setGeometryDetectionCandidateMapId(candidates.length > 0 ? activeMap.id : null)
                      }}
                      onCreateMapFromUvtt={async (input) => {
                        await createMapFromUvtt(input)
                      }}
                    />
                  )}

              </>)}
              {mapToolPanel === 'fog' && (<>
                  <MapFogToolbar
                    mapId={activeMap.id}
                    fog={magicalFogEnabled ? activeGeometry?.darknessFog ?? createEmptyMapFog(activeMap.id) : activeFog}
                    redoCount={magicalFogEnabled ? magicalFogRedoCount : activeFogRedoCount}
                    canUndo={magicalFogEnabled ? magicalFogCanUndo : undefined}
                    editMode={fogEditMode}
                    tool={fogTool}
                    previewAsPlayer={fogPreviewAsPlayer}
                    onEditModeChange={(enabled) => {
                      setFogEditMode(enabled)
                      setGeometryEditMode(false)
                      setGeometryPreviewAsPlayer(false)
                      if (enabled) {
                        setFogTool('pan')
                        setMeasureMode(false)
                        setDeleteSelectMode(false)
                        setGridAdjustMode(false)
                        setShowMoveRange(false)
                        setGeometryEditMode(false)
                        setGeometryPreviewAsPlayer(false)
                        selectGeometryEntity(null)
                      } else {
                        setFogPreviewAsPlayer(false)
                      }
                    }}
                    onToolChange={setFogTool}
                    magicalDarkness={magicalFogEnabled}
                    darknessRegions={[
                      ...(activeGeometry?.obstacles.filter(region => region.magicalDarkness && region.darknessSpellLevel == null) ?? []),
                      ...(activeGeometry?.darknessFog?.shapes.filter(shape => shape.operation === 'cover').map(shape => ({ id: shape.id, label: '魔法黑暗' })) ?? []),
                    ]}
                    onRemoveDarkness={(id) => {
                      editMagicalFog(activeMap.id, fog => ({ ...fog, shapes: fog.shapes.filter(shape => shape.id !== id) }))
                    }}
                    onMagicalDarkness={(enabled) => {
                      setMagicalFogEnabled(enabled)
                      setFogEditMode(true)
                      setFogPreviewAsPlayer(false)
                      setMeasureMode(false)
                      setDeleteSelectMode(false)
                      setGridAdjustMode(false)
                      setShowMoveRange(false)
                      setGeometryPreviewAsPlayer(false)
                      setGeometryEditMode(false)
                      selectGeometryEntity(null)
                    }}
                    onFill={mapId => magicalFogEnabled ? editMagicalFog(mapId, fog => ({ ...fog, filled: true, shapes: [] })) : fillFog(mapId)}
                    onClear={mapId => magicalFogEnabled ? editMagicalFog(mapId, fog => ({ ...fog, filled: false, shapes: [] })) : clearFog(mapId)}
                    onUndo={mapId => magicalFogEnabled ? useMapGeometryStore.getState().undo(mapId) : undoFog(mapId)}
                    onRedo={mapId => magicalFogEnabled ? useMapGeometryStore.getState().redo(mapId) : redoFog(mapId)}
                    onPreviewChange={setFogPreviewAsPlayer}
                    onStyleChange={(mapId, patch) => magicalFogEnabled ? editMagicalFog(mapId, fog => ({ ...fog, ...patch })) : setFogStyle(mapId, patch)}
                  />

              </>)}
              {mapToolPanel === 'ruler' && (<>
                  <button
                    onClick={() =>
                      setMeasureMode((v) => {
                        const next = !v
                        if (next) {
                          setGridAdjustMode(false)
                          setDeleteSelectMode(false)
                          setFogEditMode(false)
                          setGeometryEditMode(false)
                          setGeometryPreviewAsPlayer(false)
                        }
                        return next
                      })
                    }
                    className={[
                      'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                      measureMode ? 'bg-ember-500/25 text-ember-400' : 'text-slate-400 hover:bg-white/5',
                    ].join(' ')}
                    title="测距：点 A 点 B；右键/Backspace 删除"
                  >
                    <Ruler className="h-3.5 w-3.5" /> {measureMode ? '停止测距' : '开始测距'}
                  </button>

              </>)}
              {mapToolPanel === 'units' && (<>
                  <button
                    onClick={() =>
                      setDeleteSelectMode((v) => {
                        const next = !v
                        if (next) {
                          setMeasureMode(false)
                          setGridAdjustMode(false)
                          setFogEditMode(false)
                          setAoePreviewCell(null)
                          setShowMoveRange(false)
                        }
                        return next
                      })
                    }
                    className={[
                      'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                      deleteSelectMode
                        ? 'bg-rose-500/25 text-rose-200'
                        : 'text-slate-400 hover:bg-white/5',
                    ].join(' ')}
                    title={combatActive ? '框选删除：战斗中只删除障碍物，右键取消' : '框选删除：拖拽选框删除单位/障碍物，右键取消'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    框删
                  </button>

                  <label className="flex items-center gap-1 rounded-lg bg-arcane-500/15 px-2 py-1 text-xs font-medium text-arcane-200">
                    <UserPlus className="h-3.5 w-3.5" />
                    <select
                      value=""
                      onChange={(e) => {
                        const ch = characters.find((c) => c.id === e.target.value)
                        const projected = visionProjectedCharactersById.get(e.target.value)
                        if (ch) addCharacterToken(activeMap.id, {
                          characterId: ch.id,
                          name: ch.name,
                          emoji: ch.avatar,
                          dnd5eCharacterDarkvisionRangeFeet: projected?.darkvisionRangeFeet,
                          dnd5eCharacterDarkvisionIfAbsentFeet: projected?.darkvisionIfAbsentFeet,
                          dnd5eCharacterDarkvisionExistingBonusFeet: projected?.darkvisionExistingBonusFeet,
                          dnd5eCharacterDarkvisionRacialFallbackFeet: projected?.darkvisionRacialFallbackFeet,
                          dnd5eCharacterDarkvisionRacialBonusFeet: projected?.darkvisionRacialBonusFeet,
                          dnd5eCharacterRacialDarkvisionRangeFeet: projected?.racialDarkvisionRangeFeet,
                          dnd5eCharacterInvisibleToDarkvision: projected?.invisibleToDarkvision,
                          dnd5eFormDarkvisionRangeFeet: projected?.dnd5eFormDarkvisionRangeFeet,
                          dnd5eFormRetainsDarkvision: projected?.dnd5eFormRetainsDarkvision,
                        })
                        e.target.value = ''
                      }}
                      className="cursor-pointer bg-transparent text-xs text-arcane-200 outline-none [&>option]:bg-void-900 [&>option]:text-slate-200"
                    >
                      <option value="">角色…</option>
                      {placeableCharacters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() => addToken(activeMap.id, 'enemy')}
                    className="flex items-center gap-1 rounded-lg bg-rose-500/15 px-2 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/25"
                    title="放置空白敌人占位符"
                  >
                    <Skull className="h-3.5 w-3.5" />
                    敌人
                  </button>
                  <button
                    onClick={() => openEnemyPool('add')}
                    className="flex items-center gap-1 rounded-lg bg-rose-500/25 px-2 py-1 text-xs font-medium text-rose-200 hover:bg-rose-500/35"
                    title="从怪物池选择并添加"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    添加怪物
                  </button>
                  <button
                    onClick={() => setNpcCreationMapId(activeMap.id)}
                    className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/25"
                    title="填写 NPC 名字并上传画像"
                  >
                    <User className="h-3.5 w-3.5" />
                    添加 NPC
                  </button>
                  <button
                    onClick={() => addToken(activeMap.id, 'obstacle')}
                    className="flex items-center gap-1 rounded-lg bg-slate-500/15 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-500/25"
                    title="放置由 DM 直接管理的地图物件；法术不会自动作用或修改它"
                  >
                    <Package className="h-3.5 w-3.5" />
                    物件
                  </button>

              </>)}
            </MapToolsDock>
          )}

          {activeGeometry&&!isSpectator&&(isDM||playerChar)&&<MightyFortressServicesPanel map={activeMap} geometry={activeGeometry}
            onDoor={async(servantTokenId,doorId,doorOperation,commanderTokenId)=>{
              if(isDM){await operateFortressDoorByHost(activeMap.id,commanderTokenId,servantTokenId,doorId,doorOperation,crypto.randomUUID());return}
              const actor=activeMap.tokens.find(token=>token.id===commanderTokenId)
              if(!actor||!playerChar||!sendPlayerDnd5eMapInteractionRequest({operation:'fortress-door',servantTokenId,doorId,doorOperation},
                {token:actor,character:playerChar},'堡垒仆役开关门'))throw Error('当前无法提交开关门请求。')
            }}
            onMove={async(servantTokenId,commanderTokenId,drop,targetElevationFeet,exactDestination)=>{
              const worker=activeMap.tokens.find(token=>token.id===servantTokenId)
              const actor=activeMap.tokens.find(token=>token.id===commanderTokenId)
              if(!worker||!actor)throw Error('仆役或指挥者已不在地图上。')
              const expectedPosition={x:worker.x,y:worker.y,elevationFeet:mapGeometryTokenElevation(activeGeometry,worker)}
              let destination=exactDestination
              if(!destination){
                const cells=await beginDnd5eActivityCellTargeting({receiptId:`fortress-move:${crypto.randomUUID()}`,kind:'movement',label:drop?'仆役移动后放下物品':'仆役移动',actorTokenId:actor.id,originTokenId:worker.id,rangeFeet:15,count:1})
                if(!cells?.[0])return
                destination={...tokenCenterForAnchorCell(cells[0],worker,activeMap),elevationFeet:targetElevationFeet??expectedPosition.elevationFeet}
              }
              const movement={expectedPosition,destination}
              if(isDM){
                if(drop)await dropFortressItemByHost(activeMap.id,actor.id,worker.id,drop.id,drop.receipt,crypto.randomUUID(),movement)
                else await moveFortressServantByHost(activeMap.id,actor.id,worker.id,movement,crypto.randomUUID())
                return
              }
              if(!playerChar||!sendPlayerDnd5eMapInteractionRequest(drop?{operation:'fortress-drop',servantTokenId,carriedObjectId:drop.id,expectedPickupReceipt:drop.receipt,movement}:
                {operation:'fortress-move',servantTokenId,movement},{token:actor,character:playerChar},'堡垒仆役移动'))throw Error('当前无法提交移动请求。')
            }}
            onDrop={async(servantTokenId,carriedObjectId,expectedPickupReceipt,commanderTokenId)=>{
              if(isDM){await dropFortressItemByHost(activeMap.id,commanderTokenId,servantTokenId,carriedObjectId,expectedPickupReceipt,crypto.randomUUID());return}
              const actor=activeMap.tokens.find(token=>token.id===commanderTokenId)
              if(!actor||!playerChar||!sendPlayerDnd5eMapInteractionRequest({operation:'fortress-drop',servantTokenId,carriedObjectId,expectedPickupReceipt},
                {token:actor,character:playerChar},'堡垒仆役放下'))throw Error('当前无法提交放下请求。')
            }}
            onPickup={async(servantTokenId,objectTokenId,expectedReceiptId,expectedQuantity,commanderTokenId,approach)=>{
              if(isDM){await pickupFortressItemByHost(activeMap.id,commanderTokenId,servantTokenId,objectTokenId,expectedReceiptId,expectedQuantity,crypto.randomUUID(),approach);return}
              const actor=activeMap.tokens.find(token=>token.id===commanderTokenId)
              if(!actor||!playerChar||!sendPlayerDnd5eMapInteractionRequest({operation:'fortress-pickup',servantTokenId,objectTokenId,expectedReceiptId,expectedQuantity,approach},
                {token:actor,character:playerChar},'堡垒仆役拾取'))throw Error('当前无法提交拾取请求。')
            }}
            onCommand={async(structureId,servantNumbers,instruction,actorTokenId)=>{
              if(isDM){await commandFortressByHost(activeMap.id,actorTokenId,structureId,servantNumbers,instruction,crypto.randomUUID());return}
              const actor=activeMap.tokens.find(token=>token.id===actorTokenId)
              if(!actor||!playerChar||!sendPlayerDnd5eMapInteractionRequest({operation:'fortress-command',structureId,servantNumbers,instruction},
                {token:actor,character:playerChar},'堡垒仆役指令'))throw Error('当前无法提交仆役指令。')
            }}
            worldMinute={castingWorldMinute} isDM={isDM} requestPending={!isDM && !!pendingPlayerAction} actorTokenId={activeMap.tokens.find(token=>token.type==='player'&&token.characterId===playerChar?.id)?.id}
            onFeast={async(structureId,guests,expectedWorldDay,actorTokenId)=>{
              if(isDM){await serveFortressFeastByHost(activeMap.id,actorTokenId,structureId,guests,expectedWorldDay,crypto.randomUUID());return}
              const actor=activeMap.tokens.find(token=>token.id===actorTokenId)
              if(!actor||!playerChar||!sendPlayerDnd5eMapInteractionRequest({operation:'fortress-feast',structureId,guests,expectedWorldDay},
                {token:actor,character:playerChar},'堡垒供餐'))throw Error('当前无法提交供餐请求。')
            }} />}
          {isDM && <DruidGrovePasswordPanel map={activeMap} isDM onSpeak={async (areaId, spokenPassword, actorId) => {
            if (!actorId) throw new Error('请选择说出口令的生物。')
            await applyGrovePasswordByHost(activeMap.id, actorId, areaId, spokenPassword, crypto.randomUUID())
          }} />}
          {!isDM && !isSpectator && playerChar && <DruidGrovePasswordPanel map={activeMap} onSpeak={async (areaId, spokenPassword) => {
            const actor = activeMap.tokens.find(t => t.type === 'player' && t.characterId === playerChar.id)
            if (!actor || !sendPlayerDnd5eMapInteractionRequest({ operation: 'grove-password', areaId, spokenPassword },
              { token: actor, character: playerChar }, '说出林地口令')) throw new Error('当前无法提交口令，请检查角色与回合。')
          }} />}
          {/* token 编辑浮层（DM，选中棋子时） */}
          {/* DM token editing is handled inside EnemyDetailPanel. */}

          {isDM &&
            selectedToken?.dnd5eSpellEffect &&
            !activeAoeTargeting &&
            !dnd5eItemAreaTargeting && (
              <MapDetailPanelBoundary>
                <MapWorkspaceSpellEffectDetailPanel
                  token={selectedToken}
                  sourceName={characters.find((character) =>
                    character.id === selectedToken.dnd5eSpellEffect?.sourceCharacterId)?.name}
                  onDelete={() => removeMapTokenWithRelations(activeMap.id, selectedToken.id)}
                  onClose={() => setSelectedTokenId(null)}
                />
              </MapDetailPanelBoundary>
          )}
          {!isDM && !isSpectator && activeMap.dnd5ePluginAreas?.filter((area) => area.id === ropeTrickAreaId && area.coreSpellId === 'rope-trick').map((area) => <RopeTrickPanel key={area.id} area={area} map={activeMap} characters={characters} actors={characters.filter((character) => activeMap.tokens.some((token) => token.characterId === character.id) && character.id === playerChar?.id)} onClose={() => setRopeTrickAreaId(null)} onInteract={async (characterId, transition) => {
            const latestMap = useMapStore.getState().maps.find((map) => map.id === activeMap.id)
            const actor = latestMap?.tokens.find((token) => token.characterId === characterId)
            const character = useCharacterStore.getState().characters.find((entry) => entry.id === characterId)
            if (!actor || !character || character.id !== playerChar?.id) return
            sendPlayerDnd5eMapInteractionRequest({ operation: 'rope-trick', areaId: area.id, transition }, { token: actor, character }, transition === 'enter' ? '进入异次元空间' : '离开异次元空间')
          }} />)}
          {!isSpectator && effectDetailArea?.illusionRecognition && <IllusionInvestigationPanel map={activeMap} area={effectDetailArea}
            actors={activeMap.tokens.filter(token => token.type !== 'obstacle' && (!combatActive || token.id === currentInitiativeToken?.id) && (isDM || (!!playerChar && token.characterId === playerChar.id)))}
            pending={!!pendingPlayerAction || monsterVisualSearchPending} onClose={() => setEffectDetailAreaId(null)}
            onInvestigate={tokenId => { void investigatePersistentIllusion(effectDetailArea.id, tokenId).catch(() => { void showCombatNotice('调查未完成', '请检查地图和角色状态后重试。', 'amber') }) }} />}
          {!isSpectator && effectDetailArea?.terrainClearing && <TerrainClearingPanel map={activeMap} area={effectDetailArea}
            actors={activeMap.tokens.filter(t => t.type !== 'obstacle' && (!combatActive || t.id === currentInitiativeToken?.id) && (isDM || (!!playerChar && t.characterId === playerChar.id)))}
            combatActive={combatActive} onClose={() => setEffectDetailAreaId(null)} onStart={actorTokenId => {
              setMeasureMode(false); setGridAdjustMode(false); setFogEditMode(false); setGeometryEditMode(false); setDeleteSelectMode(false); setShowMoveRange(false)
              cancelDnd5eActivityMapTargeting(); setDnd5eSpellTargeting(null); setDnd5eCoreAreaMoveTargeting(null); setDnd5ePluginAreaTargeting(null); setDnd5eItemAreaTargeting(null)
              setDnd5eExtraActionTeleportTargeting(null); setDnd5eManualMonsterAttackTargeting(null); setDnd5eManualMonsterSpellTargeting(null)
              setWebIgnitionTarget(null); setStoneEscapeTarget(null); setAoePreviewCell(null); setEffectDetailAreaId(null)
              setTerrainClearingTarget({ mapId: activeMap.id, areaId: effectDetailArea.id, actorTokenId })
            }} />}
          {isDM && !effectDetailArea?.terrainClearing && !effectDetailArea?.illusionRecognition && <MapDetailPanelBoundary><MapWorkspacePersistentAreaDetailPanel onStoneEscape={(areaId, tokenId, push) => {
            setStoneEscapeTarget({ mapId: activeMap.id, areaId, tokenId, push }); setEffectDetailAreaId(null)
          }} map={activeMap} area={effectDetailArea} sourceName={characters.find((character) => character.id === effectDetailArea?.sourceCharacterId)?.name} excludedTargetNames={[...new Set(effectDetailArea?.triggers?.flatMap((trigger) => trigger.excludedTokenIds ?? []) ?? [])].map((targetId) => { const token = activeMap.tokens.find((candidate) => candidate.id === targetId); const character = token?.characterId ? characters.find((candidate) => candidate.id === token.characterId) : undefined; return character?.name ?? token?.label ?? targetId })} feetPerCell={activeMap.feetPerCell} currentRound={round} onStartWallAttack={combatActive && currentInitiativeToken?.characterId ? () => {
            setDnd5eWeaponAttackOptions(undefined); setDnd5eWeaponTargeting(currentInitiativeToken.characterId!); setEffectDetailAreaId(null)
          } : undefined} onClose={() => setEffectDetailAreaId(null)} onResolveEntityAttack={async ({ areaId, panelId, attackTotal, damage, damageType }) => { const latest = useMapStore.getState().maps.find((map) => map.id === activeMap.id); const resolved = latest && resolvePersistentAreaEntityAttackByDm({ map: latest, characters: useCharacterStore.getState().characters, areaId, panelId, attackTotal, damage, damageType, round: roundRef.current }); if (!resolved) return undefined; if (resolved.outcome !== 'miss') { applyAuthorityMapUpdate(resolved.map.id, { dnd5ePluginAreas: resolved.map.dnd5ePluginAreas, tokens: resolved.map.tokens }); for (const character of resolved.characters ?? (resolved.character ? [resolved.character] : [])) { if (useCharacterStore.getState().characters.find(candidate => candidate.id === character.id) !== character) applyAuthorityCharacterUpdate(character.id, character); } await Promise.all([useMapStore.getState().saveSharedNow(), saveCharactersSharedNow()]); } pushCombatLog(resolved.outcome === 'miss' ? (resolved.armorClass === null ? `对 ${resolved.label} 的攻击自动失手。` : `对 ${resolved.label} 的攻击总值 ${resolved.attackTotal} 未达到 AC ${resolved.armorClass}，未命中。`) : `对 ${resolved.label} 的攻击总值 ${resolved.attackTotal} 命中 AC ${resolved.armorClass}，造成 ${resolved.damage} 点伤害；HP ${resolved.hitPointsBefore}→${resolved.hitPointsAfter}${resolved.outcome === 'destroyed' ? (panelId ? '，该墙段已击破' : '，法术结束') : ''}。`, resolved.outcome === 'miss' ? 'system' : 'damage'); return resolved }} onSetHutIllumination={async (areaId, illumination) => {
                const latest = useMapStore.getState().maps.find(map => map.id === activeMap.id)
                if (!latest?.dnd5ePluginAreas?.some(area => area.id === areaId && area.coreSpellId === 'tiny-hut')) throw new Error('小屋术已结束')
                applyAuthorityMapUpdate(latest.id, { dnd5ePluginAreas: latest.dnd5ePluginAreas.map(area => area.id === areaId ? { ...area, illuminationOverride: illumination } : area) })
                await useMapStore.getState().saveSharedNow()
              }} onActivateSymbol={activateSymbolByDm} onSetWebUnsupported={setWebAreaUnsupported} onSelectWebIgnitionCell={(areaId) => {
                setMeasureMode(false)
                setGridAdjustMode(false)
                setFogEditMode(false)
                setGeometryEditMode(false)
                setDeleteSelectMode(false)
                setShowMoveRange(false)
                cancelDnd5eActivityMapTargeting()
                setDnd5eSpellTargeting(null)
                setDnd5eCoreAreaMoveTargeting(null)
                setDnd5ePluginAreaTargeting(null)
                setDnd5eItemAreaTargeting(null)
                setDnd5eExtraActionTeleportTargeting(null)
                setDnd5eManualMonsterAttackTargeting(null)
                setDnd5eManualMonsterSpellTargeting(null)
                setEffectDetailAreaId(null)
                setAoePreviewCell(null)
                setWebIgnitionTarget({ mapId: activeMap.id, areaId })
              }} onDelete={removeDnd5ePersistentAreaWithEnvironmentalFalls} /></MapDetailPanelBoundary>}

          {isDM && npcCreationMapId === activeMap.id && <Suspense fallback={null}>
            <NpcCreateDialog key={activeMap.id} onClose={() => setNpcCreationMapId(null)} onCreate={(details) => {
              const tokenId = addToken(activeMap.id, 'npc', details)
              if (tokenId) setSelectedTokenId(tokenId)
              return tokenId
            }} />
          </Suspense>}
          {isDM && selectedToken?.type === 'npc' && !activeAoeTargeting && !dnd5eItemAreaTargeting && (
            <Suspense fallback={null}>
              <NpcMerchantPanel
                token={selectedToken}
                onBindShop={(shopId) => updateToken(activeMap.id, selectedToken.id, { merchantShopId: shopId })}
                onClose={() => setSelectedTokenId(null)}
              />
            </Suspense>
          )}

          {!isDM && !isSpectator && selectedToken?.type === 'obstacle' && selectedToken.dnd5eObjectState?.inventoryItem &&
            !activeAoeTargeting && !dnd5eItemAreaTargeting && (
              <div className="absolute bottom-24 left-4 z-30 rounded-xl border border-amber-400/30 bg-slate-950/95 p-4 text-sm text-slate-100">
                <div className="mb-2 font-semibold">{selectedToken.label} · 剩余 {selectedToken.dnd5eObjectState.inventoryItem.quantity}</div>
                <button className="rounded bg-amber-700 px-3 py-2" onClick={() => {
                  const token = combatActiveRef.current ? (canSendPlayerCombatAction() ? currentInitiativeToken : undefined)
                    : activeMap.tokens.find(t => t.type === 'player' && t.characterId === playerChar?.id)
                  const character = token && characters.find(c => c.id === token.characterId)
                  const item = selectedToken.dnd5eObjectState?.inventoryItem
                  if (!token || !character || !item) {
                    void showCombatNotice('现在不能拾取', '需要地图上自己的角色，战斗中须轮到自己。', 'amber')
                    return
                  }
                  sendPlayerDnd5eMapInteractionRequest({ operation: 'pickup-item', objectTokenId: selectedToken.id,
                    expectedReceiptId: item.receiptId, expectedQuantity: item.quantity }, { token, character }, '拾取物品')
                }}>拾取一件</button>
                <button className="ml-2 px-3 py-2" onClick={() => setSelectedTokenId(null)}>关闭</button>
                <div className="mt-2 text-xs text-slate-400">需要在 5 尺内；战斗中使用物品交互，用完后消耗动作。</div>
              </div>
            )}

          {isDM && selectedToken?.type === 'obstacle' && !selectedToken.dnd5eSpellEffect &&
            !activeAoeTargeting && !dnd5eItemAreaTargeting && (
              <MapDetailPanelBoundary>
                <Dnd5eMapObjectDetailPanel
                  creatureTokens={activeMap?.tokens ?? []}
                  token={selectedToken}
                  onSettleGroveRooting={canRoot => applyGroveRootingByHost(activeMap.id, selectedToken.id, canRoot)}
                  onUpdate={(patch) => updateToken(activeMap.id, selectedToken.id, patch)}
                  onDelete={() => {
                    removeMapTokenWithRelations(activeMap.id, selectedToken.id)
                    setSelectedTokenId(null)
                  }}
                  onClose={() => setSelectedTokenId(null)}
                />
              </MapDetailPanelBoundary>
          )}

          <MapCombatUnitDrawer
            statusAvailable={!!selectedCharacterToken}
            managementAvailable={isDM && !!selectedToken && !selectedCharacterToken}
            unitKey={selectedCharacterToken?.id ?? selectedToken?.id}
            open={!geometryEditMode && !dnd5eSpellTargeting && (!!selectedCharacterToken || !!(selectedToken && canShowEnemyDetail(selectedToken)))}
            activeTab={selectedCharacterToken && combatUnitPanelTab === 'management' ? 'stats' : combatUnitPanelTab}
            actionsAvailable={!!(
              isDM &&
              combatActive &&
              selectedToken?.type === 'enemy' &&
              selectedToken.id === currentInitiativeToken?.id &&
              dnd5eMonsterManualControlEnabled(monsterControl)
            )}
            onTabChange={setCombatUnitPanelTab}
            onClose={() => {
              setSelectedTokenId(null)
              setSelectedCharacterTokenId(null)
              setEnemyDetailOpen(false)
            }}
          >
          {isDM && selectedCharacterToken && hostCharacterWeaponEntryRef.current.eligible(hostCharacterWeaponCurrentContext(activeMap),selectedCharacterToken.id) && (
            <button type="button" data-testid="dm-character-weapon-attack" disabled={!!pendingPlayerAction || !!combatFlowPause}
              className="mx-3 my-2 rounded-lg bg-arcane-500/25 px-3 py-2 text-sm text-arcane-100 disabled:opacity-40"
              onClick={()=>{setHostCharacterWeaponTargetingTokenId(selectedCharacterToken.id);setDnd5eWeaponTargeting(null);setSelectedTokenId(null);setSelectedCharacterTokenId(null);setEnemyDetailOpen(false)}}>选择目标并进行武器攻击</button>
          )}
          {isDM && selectedToken?.type === 'enemy' && !!selectedToken.dnd5eCarriedObjects?.length && (
            <div className="mx-3 my-2 rounded-xl border border-slate-600 bg-slate-950/80 p-3">
              <p className="text-sm font-semibold text-slate-100">持有物品</p>
              {selectedToken.dnd5eCarriedObjects.map(item => <div key={item.id} className="mt-2 text-sm text-slate-200" data-testid={`companion-item-${item.id}`}>
                <div className="flex items-center justify-between gap-2">
                <span>{item.label}{(item.objectState.inventoryItem?.quantity ?? 1) > 1 ? ` ×${item.objectState.inventoryItem!.quantity}` : ''}{item.wieldedWeapon ? ` · 持用 · ${item.wieldedWeapon.proficient ? '熟练' : '不熟练'}` : ''}{item.wornArmor ? ` · 穿戴 · ${item.wornArmor.proficient ? '熟练' : '不熟练'}` : ''}</span>
                {!combatActive && ['srd-5.1:skeleton', 'srd-5.1:zombie'].includes(selectedToken.poolId ?? '') && dnd5eCompanionArmorDefinition(item) && <button type="button" className="rounded bg-slate-700 px-2 py-1"
                  onClick={() => { void prepareMonsterWornArmor(selectedToken.id, item.wornArmor ? null : item.id) }}>{item.wornArmor ? '脱下' : '穿戴'}</button>}
                {(!combatActive || currentInitiativeToken?.id === selectedToken.id) && (item.wieldedWeapon || dnd5eCompanionHeldWeaponDefinition(item)) && <button type="button" className="rounded bg-slate-700 px-2 py-1"
                  onClick={() => { void prepareMonsterHeldWeapon(selectedToken.id, item.wieldedWeapon ? null : item.id) }}>{item.wieldedWeapon ? '收起' : '持用'}</button>}
                </div>
                {item.objectState.inventoryItem?.instance?.item.category === 'container' && <details className="mt-1 rounded border border-slate-700 px-2 py-1" data-testid="companion-container-contents">
                  <summary className="cursor-pointer text-xs text-slate-300">容器内容（{item.objectState.inventoryItem.contents?.length ?? 0} 项）{item.objectState.weightPounds != null ? ` · 整包 ${Number(item.objectState.weightPounds.toFixed(2))} 磅` : ''}</summary>
                  {item.objectState.inventoryItem.contents?.map(entry => <p key={entry.instanceId} className="mt-1 text-xs">
                    {entry.item.name} ×{entry.quantity}{entry.containerInstanceId !== item.objectState.inventoryItem!.instance!.instanceId
                      ? ` · 位于 ${item.objectState.inventoryItem!.contents?.find(parent => parent.instanceId === entry.containerInstanceId)?.item.name ?? '子容器'}` : ''}
                  </p>)}
                  {(item.objectState.inventoryItem.boundEffects ?? []).filter(effect => effect.modifiers?.weaponEnchantment?.remainingAttacks != null).map(effect => <p key={effect.id} className="mt-1 text-xs text-amber-200">
                    {effect.label} · 剩余 {effect.modifiers!.weaponEnchantment!.remainingAttacks} 次
                  </p>)}
                </details>}
              </div>)}
              {combatActive && <p className="mt-2 text-xs text-slate-400">只能在自己的回合持用或收起。每次消耗一次物品交互；用完后消耗动作。更换武器需要先收起再持用，共两次交互。</p>}
            </div>
          )}
          {selectedToken?.dnd5eCombatState?.companionCommand?.command === 'task' && (
            <div className="mx-3 my-2 rounded-xl border border-amber-400/30 bg-slate-950/80 p-3" data-testid="companion-task-panel">
              <p className="text-sm font-semibold text-amber-100">正在执行口头任务</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-200">{selectedToken.dnd5eCombatState.companionCommand.task?.description}</p>
              {isDM && <button type="button" className="mt-2 rounded-lg bg-amber-700 px-3 py-2 text-sm text-white"
                onClick={() => {
                  const tokenId=selectedToken.id, mapId=activeMap.id
                  const expectedOrder=structuredClone(selectedToken.dnd5eCombatState!.companionCommand!)
                  void appRoomAuthorityScheduler.run('complete-companion-task',async()=>{
                    if(!isDM)return
                    await useMapStore.getState().loadShared({force:true})
                    const current=useMapStore.getState(), map=current.maps.find(map=>map.id===mapId)
                    const completed=map && completeDnd5eCompanionTask({map,tokenId,expectedOrder,isDm:isDM})
                    if(!completed)throw Error('任务已改变，请刷新后重试。')
                    const saved=await saveSharedResourceWithResult('maps',{maps:current.maps.map(map=>map.id===mapId?completed.map:map),selectedId:current.selectedId,updatedAt:runtimeNow()})
                    if(saved.status!=='saved')throw Error('任务保存冲突，请刷新后重试。')
                    await useMapStore.getState().loadShared({force:true})
                    pushHeadlessCombatLog(headlessCombatLogDetails([completed.event])[0] ?? '召唤物任务已完成。','turn',[completed.event])
                  }).catch(error=>{void showAppAlert(error instanceof Error?error.message:'任务确认失败，请重试。')})
                }}>确认任务完成并报告</button>}
            </div>
          )}
          {isDM && combatActive && selectedToken?.type === 'enemy' && selectedToken.id === currentInitiativeToken?.id &&
            selectedToken.dnd5eCombatState?.companionCommand?.objectInteraction?.operation === 'interact-point' &&
            selectedToken.dnd5eCombatState.companionCommand.executedTurnKey && (
            <div className="mx-3 my-2 rounded-xl border border-amber-400/30 bg-slate-950/80 p-3">
              <button type="button" className="rounded-lg bg-amber-700 px-3 py-2 text-sm text-white"
                disabled={dnd5eTurnStartSettlementPending || !dnd5eRetryableCompanionSceneOrder(selectedToken,
                  `${combatIdRef.current}:${roundRef.current}:${initiativeOrderRef.current[initiativeIndexRef.current]?.slotId ?? selectedToken.id}`,
                  currentDnd5eTurnEconomy(selectedToken.id).action.current > 0, activeMap)}
                onClick={() => { void retryOwnedCompanionSceneOrder(selectedToken.id) }}>再次执行场景交互</button>
            </div>
          )}
          {isDM && combatActive && selectedToken?.type === 'enemy' && selectedToken.dnd5eCombatState?.readiedAction?.actionKind === 'interact-object' && selectedToken.dnd5eCombatState.readiedAction.objectInteraction && (
            <div className="mx-3 my-2 rounded-xl border border-amber-400/30 bg-slate-950/80 p-3">
              <p className="text-sm text-slate-100">预备：{selectedToken.dnd5eCombatState.readiedAction.trigger}</p>
              <button type="button" className="mt-2 rounded-lg bg-amber-700 px-3 py-2 text-sm text-white"
                disabled={currentDnd5eTurnEconomy(selectedToken.id).reaction.current < 1}
                onClick={() => { void triggerMonsterReadiedObject(selectedToken.id) }}>触发预备物件操作</button>
            </div>
          )}
          {isDM && combatActive && selectedToken?.type === 'enemy' && selectedToken.dnd5eCombatState?.readiedAction?.actionKind === 'move' && (
            <div className="mx-3 my-2 rounded-xl border border-amber-400/30 bg-slate-950/80 p-3">
              <p className="text-sm text-slate-100">预备：{selectedToken.dnd5eCombatState.readiedAction.trigger}</p>
              <button type="button" className="mt-2 rounded-lg bg-amber-700 px-3 py-2 text-sm text-white"
                disabled={currentDnd5eTurnEconomy(selectedToken.id).reaction.current < 1}
                onClick={() => { void triggerMonsterReadiedMovement(selectedToken.id) }}>触发预备移动</button>
            </div>
          )}
          {isDM && combatActive && selectedToken?.type === 'enemy' && selectedToken.dnd5eCombatState?.readiedAction?.actionKind === 'attack' && (
            <div className="mx-3 my-2 rounded-xl border border-amber-400/30 bg-slate-950/80 p-3">
              <p className="text-sm text-slate-100">预备：{selectedToken.dnd5eCombatState.readiedAction.trigger}</p>
              <button type="button" className="mt-2 rounded-lg bg-amber-700 px-3 py-2 text-sm text-white"
                disabled={currentDnd5eTurnEconomy(selectedToken.id).reaction.current < 1}
                onClick={() => { void triggerMonsterReadiedAttack(selectedToken.id) }}>触发预备攻击</button>
            </div>
          )}
          {(combatUnitPanelTab === 'stats' || combatUnitPanelTab === 'management') && selectedToken &&
            !activeAoeTargeting &&
            !dnd5eItemAreaTargeting &&
            canShowEnemyDetail(selectedToken) &&
            (isDM || (selectedToken.showDetailOnToken !== false && enemyDetailOpen)) && (
              <MapDetailPanelBoundary>
                <MapWorkspaceEnemyDetailPanel
                  battleMap={activeMap}
                  onVisualSearch={isDM ? () => { void searchMonsterVisibleArea(selectedToken.id).catch(error => console.error('[monster-visual-search]', error)) } : undefined}
                  onInvestigationSearch={isDM ? () => { void searchMonsterVisibleArea(selectedToken.id, undefined, 'investigation').catch(error => console.error('[monster-investigation-search]', error)) } : undefined}
                  visualSearchDisabled={monsterVisualSearchPending || (combatActive && (currentInitiativeToken?.id !== selectedToken.id || !!combatFlowPause || manualMonsterActionPending))}
                  mapArmorClassBonus={projectDnd5eMapCohortArmorClassBonus({map:activeMap,characters,tokenId:selectedToken.id})}
              afterConditions={isDM && selectedToken ? <DmTokenElevationControls key={`${activeMap.id}:${selectedToken.id}:${selectedToken.elevationFeet}`} map={activeMap} geometry={activeGeometry} token={selectedToken} characters={characters} onChange={elevationFeet => useMapStore.getState().saveAuthorityTokenPatch(activeMap.id, selectedToken.id, { elevationFeet })} /> : null}
              statusSummary={<MapCombatUnitStatusPanel token={selectedToken} compact />}
              view={isDM && combatUnitPanelTab === 'management' ? 'management' : 'statblock'}
              embedded
              token={selectedToken}
              closable={!isDM}
              isDM={isDM}
              mapId={activeMap.id}
              characters={characters}
              tokens={activeMap.tokens}
              encounterParticipantTokenIds={combatActive
                ? initiativeOrder.map((entry) => entry.tokenId)
                : undefined}
              updateToken={updateToken}
              onSetHitPoints={({ currentHp, maxHp, temporaryHp, manuallySetMaximum }) => {
                return setRoomCharacterHitPoints({
                  characterId: selectedToken.characterId,
                  mapId: activeMap.id,
                  tokenId: selectedToken.id,
                  currentHp,
                  maxHp,
                  temporaryHp,
                  manuallySetMaximum,
                })
              }}
              onAdjustHitPoints={(operation, amount) =>
                handleManualSettlement(selectedToken.id, operation, amount)}
              removeToken={removeToken}
              canManageConditions={canDmManageConditions}
              conditionSourceOptions={conditionSourceOptions}
              onConditionsChange={(conditions, activeEffects) => applyDmConditionLabels(selectedToken, conditions, activeEffects)}
              onMonsterRuntimeStatusChange={(statusId, active) => {
                void setRoomMonsterRuntimeStatus({
                  mapId: activeMap.id,
                  tokenId: selectedToken.id,
                  statusId,
                  active,
                }).then((result) => {
                  if (result.status === 'rejected') {
                    void showAppAlert(result.message ?? '怪物专属状态更新被权威端拒绝。')
                    return
                  }
                  const label = statusId === 'monster-berserk'
                    ? '狂暴'
                    : statusId === 'monster-damage-aversion'
                      ? '伤害畏避'
                      : '再生受抑'
                  pushCombatLog(`DM ${active ? '附加' : '移除'}了 ${selectedToken.label} 的${label}状态。`, 'system')
                }).catch((error) => {
                  console.error('Failed to persist monster runtime state', error)
                  void showAppAlert('怪物专属状态更新未能保存，已保留服务器上的原状态。')
                })
              }}
              canUseMonsterActions={
                isDM &&
                combatActive &&
                dnd5eMonsterManualControlEnabled(monsterControl) &&
                isEnemyTurn &&
                selectedToken.id === currentInitiativeToken?.id
              }
              monsterActionUsed={manualMonsterActionUsed}
              monsterActionPending={manualMonsterActionPending}
              grantedActivityControls={mapTokenGrantedActivityControls(selectedToken, activeMap, characters, {
                combatId: combatActive ? combatIdRef.current ?? undefined : undefined, round,
                turnKey: dnd5eTurnEconomyByToken[selectedToken.id]?.turnKey,
                worldMinute: castingWorldMinute,
                worldSecondRemainder: areaControlWorldSecondRemainder,
              })}
              canUseGrantedActivity={(control) => !combatActive || control.economy === 'none' || (
                selectedToken.id === currentInitiativeToken?.id && (
                  control.economy === 'action' ? !manualMonsterActionUsed :
                  control.economy === 'bonus-action' ? !manualMonsterBonusActionUsed :
                  (manualMonsterTurnEconomy?.reaction.current ?? 1) > 0
                )
              )}
              canUseGrantedActivities={isDM && !manualMonsterActionPending}
              grantedActivityPendingId={dmGrantedActivityPendingId}
              onUseGrantedActivity={async (control) => {
                if (!activeMap || !roomSession || dmGrantedActivityPendingId) return
                const feature = dnd5ePluginFeatureDefinition(control.featureId)
                if (!feature?.action || (!control.effectId && !control.areaId)) return
                const dmActor = { tokenId: selectedToken.id, mapId: activeMap.id }
                const definition = dnd5ePluginGrantedActivityDefinitionV1(control.featureId)
                const activityChoices: Record<string, string> = {}
                for (const choice of definition?.choices ?? []) {
        if (choice.dmSelection || choice.dmWorldFact) continue
                  if (dnd5eActivityRolledChoiceIds(definition!).has(choice.id)) { activityChoices[choice.id] = choice.options[0]!.id; continue }
                  if (!dnd5eActivityChoiceIsRelevantV1(definition!, choice, activityChoices)) continue
                  const selected = await promptDnd5eActivityChoice({ ownerLabel: feature.name, choiceLabel: choice.label, textInput: choice.textInput, options: choice.options,
                    defaultOptionId: choice.defaultOptionId, prompt: showAppPrompt, directionStepper: showAppDirectionStepper,
                    choiceGroups: showAppChoiceGroups, actionChoice: showAppActionChoice,
                    notifyInvalid: message => showCombatNotice('能力选项无效', message, 'amber') })
                  if (!selected) return
                  activityChoices[choice.id] = selected.id
                }
                setManualMonsterMoveSelection(null)
                playerMovement.clear()
                setDnd5eManualMonsterAttackTargeting(null)
                setDnd5eWeaponTargeting(null)
                setDnd5eSpellTargeting(null)
                setDnd5eItemAreaTargeting(null)
                setDnd5eCoreAreaMoveTargeting(null)
                setDnd5ePluginAreaTargeting(null)
                setDnd5ePersistentAreaActivityTargeting(null)
                const selectedTarget = definition ? dnd5eActivityWithTargetChoicesV1(definition, activityChoices).target : undefined
                const mappedObjectOriginTokenId = selectedTarget?.kind === 'creature' && selectedTarget.mappedObjectOrigin
                  ? await promptMappedRockOrigin(activeMap, control.areaId, feature.name) : undefined
                if (mappedObjectOriginTokenId === null) return
                const payload = { ...(control.areaId ? { persistentAreaId: control.areaId } : { activeEffectId: control.effectId! }), activityChoices,
                  ...(mappedObjectOriginTokenId ? { mappedObjectOriginTokenId } : {}) }
                if (control.targeting === 'self' || (control.targeting === 'creature' && control.sourceActorTokenId)) {
                  sendPlayerDnd5ePluginActionRequest({ featureId: control.featureId, payload }, control.targeting === 'self' ? selectedToken.id : control.sourceActorTokenId, undefined, undefined, selectedToken.id, dmActor)
                } else if (feature.action.targeting.kind === 'area') {
                  const area = activeMap.dnd5ePluginAreas?.find(candidate => candidate.id === control.areaId)
                  setDnd5ePluginAreaTargeting({ source: 'plugin', characterId: selectedToken.id, dmActor, featureId: control.featureId, featureName: feature.name,
                    targeting: feature.action.targeting, persistentAreaId: control.areaId, activeEffectId: control.effectId, activityChoices })
                  setAoePreviewCell(area?.anchorCell ?? area?.cells[0] ?? tokenAnchorCellFromPixel(selectedToken.x, selectedToken.y, selectedToken, activeMap))
                } else {
                  setDnd5ePersistentAreaActivityTargeting({ characterId: selectedToken.id, dmActor, areaId: control.areaId, mappedObjectOriginTokenId, effectId: control.effectId, featureId: control.featureId, label: feature.name, activityChoices })
                }
              }}
              onSelectMonsterAction={(actionIndex, actionName, rollMode) => {
                if (!manualMonsterTurnKey || manualMonsterActionUsed) return
                setManualMonsterMoveSelection(null)
                playerMovement.clear()
                setDnd5eManualMonsterAttackTargeting({
                  actorTokenId: selectedToken.id,
                  actionIndex,
                  actionName,
                  resourceKind: 'action',
                  rollMode,
                })
              }}
              onSelectMonsterContinuation={(continuation, rollMode) =>
                selectManualMonsterMultiattackContinuation(selectedToken, continuation, rollMode)}
              onClose={() => {
                setSelectedTokenId(null)
                setEnemyDetailOpen(false)
              }}
                />
              </MapDetailPanelBoundary>
          )}

          {(combatUnitPanelTab === 'stats' || combatUnitPanelTab === 'status' || combatUnitPanelTab === 'management') && selectedCharacterToken && selectedCharacter && (
            isDM ? (
              <MapDetailPanelBoundary>
                <PactWeaponRitualPanel character={selectedCharacter} mapId={activeMap?.id} actorTokenId={selectedCharacterToken.id} isDm gateway={{loadResource:loadSharedResource,saveResourcesAtomically:saveSharedResourcesAtomically,appendPlayerActionRequest:appendSharedPlayerActionRequest}} onCommitted={()=>reloadDnd5eAuthorityState()}/>
                <MapWorkspaceCharacterDetailPanel
                  mapArmorClassBonus={projectDnd5eMapCohortArmorClassBonus({map:activeMap,characters,tokenId:selectedCharacterToken.id})}
              afterConditions={isDM && selectedCharacterToken ? <DmTokenElevationControls key={`${activeMap.id}:${selectedCharacterToken.id}:${selectedCharacterToken.elevationFeet}`} map={activeMap} geometry={activeGeometry} token={selectedCharacterToken} characters={characters} onChange={elevationFeet => useMapStore.getState().saveAuthorityTokenPatch(activeMap.id, selectedCharacterToken.id, { elevationFeet })} /> : null}
                  view={combatUnitPanelTab === 'status' ? 'status' : 'data'}
                  embedded
                  token={selectedCharacterToken}
                  character={selectedCharacter}
                  onSetHitPoints={({ currentHp, maxHp, temporaryHp, manuallySetMaximum }) => {
                    if (
                      selectedCharacterToken.dnd5eSimulacrum &&
                      currentHp > (selectedCharacterToken.hp ?? selectedCharacter.currentHp)
                    ) {
                      void showCombatNotice(
                        '拟像不能接受普通治疗',
                        '请使用详情中的“炼金实验室修复”入口，并核销每点 100 gp 的稀有草药和矿物。',
                        'amber',
                      )
                      return Promise.resolve({ status: 'rejected' as const })
                    }
                    const request = setRoomCharacterHitPoints({
                      characterId: selectedCharacterToken.dnd5eSimulacrum
                        ? undefined
                        : selectedCharacter.id,
                      mapId: activeMap.id,
                      tokenId: selectedCharacterToken.id,
                      currentHp,
                      maxHp: selectedCharacterToken.dnd5eSimulacrum?.maximumHitPoints ?? maxHp,
                      temporaryHp,
                      manuallySetMaximum: selectedCharacterToken.dnd5eSimulacrum ? false : manuallySetMaximum,
                    })
                    if (!selectedCharacterToken.dnd5eSimulacrum || currentHp !== 0) return request
                    return request.then((result) => {
                      if (result.status === 'applied') {
                        pushCombatLog(
                          `${selectedCharacterToken.label} 降至 0 HP，已恢复成雪并立即融化。`,
                          'system',
                          roundRef.current,
                        )
                      }
                      return result
                    })
                  }}
                  onAdjustHitPoints={(operation, amount) =>
                    handleManualSettlement(selectedCharacterToken.id, operation, amount)}
                  isDM
                  canManageConditions={canDmManageConditions}
                  conditionActiveEffects={dnd5eMergedCombatantActiveEffects({
                    character: selectedCharacterSubject,
                    token: selectedCharacterToken,
                  })}
                  conditionSourceOptions={conditionSourceOptions}
                  onConditionsChange={(conditions, activeEffects) => applyDmConditionLabels(selectedCharacterToken, conditions, activeEffects)}
                  currentRound={round}
                  onCorpseStateChange={selectedCharacterToken.dnd5eSimulacrum ? undefined : async (corpseState) => {
                    const current = useCharacterStore.getState().characters
                      .find((character) => character.id === selectedCharacter.id)
                    if (!current) throw new Error('character-missing')
                    applyAuthorityCharacterUpdate(current.id, {
                      ...current,
                      dnd5eCombatState: {
                        ...current.dnd5eCombatState,
                        schemaVersion: 2,
                        ...corpseState,
                      },
                    })
                    await saveCharactersSharedNow()
                    pushCombatLog(
                      `DM 更新了 ${current.name} 的尸体账本：死亡 ${Math.max(0, (round - corpseState.deathRound) / 14_400).toFixed(2)} 天，${corpseState.deathCause === 'old-age' ? '寿终正寝' : '并非寿终正寝'}，灵魂${corpseState.soulReturnStatus === 'free-willing' ? '自由且愿意返回' : corpseState.soulReturnStatus === 'unwilling' ? '自由但不愿返回' : '不自由／无法返回'}，${corpseState.bodyPresent ? '尸体存在' : '尸体不存在'}${corpseState.vitalBodyPartsMissing ? '，缺失关键器官/部位' : ''}。`,
                      'system',
                    )
                  }}
                  onRepairSimulacrum={selectedCharacterToken.dnd5eSimulacrum ? async (hitPoints) => {
                    const latestMap = useMapStore.getState().maps.find((map) => map.id === activeMap.id)
                    const latestToken = latestMap?.tokens.find((token) => token.id === selectedCharacterToken.id)
                    const simulacrum = latestToken?.dnd5eSimulacrum
                    if (!latestMap || !latestToken || !simulacrum) throw new Error('拟像已不在当前地图。')
                    const currentHp = Math.max(0, latestToken.hp ?? 0)
                    const restored = Math.min(
                      Math.max(0, Math.floor(hitPoints)),
                      Math.max(0, simulacrum.maximumHitPoints - currentHp),
                    )
                    if (restored < 1) throw new Error('拟像已满生命值，无需修复。')
                    const result = await setRoomCharacterHitPoints({
                      mapId: latestMap.id,
                      tokenId: latestToken.id,
                      currentHp: currentHp + restored,
                      maxHp: simulacrum.maximumHitPoints,
                      temporaryHp: latestToken.dnd5eCombatState?.temporaryHp ?? 0,
                      manuallySetMaximum: false,
                    })
                    if (result.status !== 'applied') {
                      throw new Error(result.message ?? '拟像修复未被权威端接受。')
                    }
                    pushCombatLog(
                      `DM 在炼金实验室修复了 ${latestToken.label} ${restored} HP；已确认核销价值 ${restored * 100} gp 的稀有草药和矿物。`,
                      'system',
                      roundRef.current,
                    )
                  } : undefined}
                  onRemoveFromMap={selectedCharacterToken.type === 'player' ? async () => {
                    try {
                      await removeMapTokenWithRelations(activeMap.id, selectedCharacterToken.id)
                      setSelectedCharacterTokenId(null)
                    } catch (error) {
                      reportMapTokenRemovalFailure(error)
                      throw error
                    }
                  } : undefined}
                  onClose={() => setSelectedCharacterTokenId(null)}
                />
              </MapDetailPanelBoundary>
            ) : (
              <MapDetailPanelBoundary>
                <PlayerQuickCharacterSheet
                  onDropItem={!isSpectator && playerChar && selectedCharacterToken?.characterId === playerChar.id && !activeAoeTargeting && !dnd5eItemAreaTargeting ? async () => {
                  if (combatActiveRef.current && (!canSendPlayerCombatAction() || currentInitiativeToken?.id !== selectedCharacterToken.id)) {
                    await showCombatNotice('现在不能放下物品', '战斗中须轮到自己的角色。', 'amber')
                    return
                  }
                  const inventory = normalizeDnd5eInventory(playerChar)
                  const entries = inventory.entries.filter(dnd5eInventoryEntryCanDrop)
                  if (!entries.length) { await showCombatNotice('没有可放下的物品', '当前没有可单独放到地上的物品。', 'amber'); return }
                  const selected = await showAppActionChoice({ title: '放到地上', message: '选择物品，将其放在角色当前位置；弹药按整堆放下，容器会连同全部内容一起放下。',
                    cancelLabel: '取消', options: entries.map(entry => ({ id: entry.instanceId, label: entry.quantity > 1 ? `${entry.item.name} ×${entry.quantity}` : entry.item.name,
                      description: entry.item.category === 'container' ? '包含全部内容' : entry.equippedSlot ? '正在装备' : '库存物品' })) })
                  if (!selected || !entries.some(entry => entry.instanceId === selected)) return
                  sendPlayerDnd5eMapInteractionRequest({ operation: 'drop-item', instanceId: selected,
                    expectedInventoryRevision: inventory.revision ?? 0 }, { token: selectedCharacterToken, character: playerChar }, '放下物品')
                } : undefined}
                  mapArmorClassBonus={projectDnd5eMapCohortArmorClassBonus({map:activeMap,characters,tokenId:selectedCharacterToken.id})}
                  view={combatUnitPanelTab === 'status' ? 'status' : 'data'}
                  embedded
                  character={selectedCharacter}
                  onQuickCheck={selectedCharacter.id === playerChar?.id && !isSpectator ? (check) => {
                    const actor = playerSpellActionSubmission()
                    if (!actor || actor.character.id !== selectedCharacter.id) return
                    sendPlayerDnd5eAbilityCheckRequest({ ...check, dc: 0, totalOnly: true, spendAction: false })
                  } : undefined}
                  quickCheckDisabled={!!pendingPlayerAction || !playerSpellActionSubmission()}
                  onClose={() => setSelectedCharacterTokenId(null)}
                />
              </MapDetailPanelBoundary>
            )
          )}

          {/* 左侧只保留角色选择；所有战斗操作统一进入底部快捷栏。 */}
          {combatUnitPanelTab === 'actions' && isDM && combatActive && selectedToken?.type === 'enemy' && (
            <MapLazyOverlayBoundary label="正在打开怪物控制栏…">
              <DmMonsterControlDock
              battleMap={activeMap}
              characters={characters}
              embedded
              focusedTokenId={selectedToken.id}
              onFocusedTokenChange={(tokenId) => {
                setSelectedCharacterTokenId(null)
                setSelectedTokenId(tokenId)
              }}
              monsters={combatMonsterTokens}
              currentTokenId={currentInitiativeToken?.type === 'enemy' ? currentInitiativeToken.id : undefined}
              actionUsed={manualMonsterActionUsed || dnd5eTurnStartSettlementPending}
              bonusActionUsed={manualMonsterBonusActionUsed || dnd5eTurnStartSettlementPending}
              actionPending={manualMonsterActionPending || dnd5eTurnStartSettlementPending}
              turnStartPending={dnd5eTurnStartSettlementPending}
              movementRemainingFeet={currentInitiativeToken && isTokenMovementLocked(currentInitiativeToken)
                ? 0
                : manualMonsterTurnEconomy?.movement.current}
              movementMaximumFeet={manualMonsterTurnEconomy?.movement.max}
              movementIntent={manualMonsterMoveSelection?.turnKey === manualMonsterTurnKey
                ? manualMonsterMoveSelection?.intent
                : undefined}
              canNimbleEscape={currentInitiativeToken?.poolId
                ? getDnd5eSrdMonster(currentInitiativeToken.poolId)?.traits.some((trait) =>
                    trait.rule?.kind === 'nimble-escape')
                : false}
              onSelectAction={selectManualMonsterAction}
              onEscapeActiveEffect={escapeManualMonsterActiveEffect}
              onActivateReckless={activateManualMonsterReckless}
              onShapechange={changeManualMonsterShape}
              onMultipartCommand={executeMultipartCommand}
              onSelectAdjudicatedAction={(token, actionIndex, _actionName, resourceKind = 'action') => {
                void settleManualMonsterDmAdjudication({
                  token,
                  kind: 'action',
                  actionIndex,
                  resourceKind,
                })
              }}
              onSelectSpell={selectManualMonsterSpell}
              onSelectAdjudicatedSpell={(token, spellId, spellName, slotLevel, castingTime) => {
                void settleManualMonsterDmAdjudication({
                  token,
                  kind: 'spell',
                  spellId,
                  spellName,
                  slotLevel,
                  castingTime,
                })
              }}
              onSelectContinuation={selectManualMonsterMultiattackContinuation}
              onSelectMovement={(token, kind) => {
                setSelectedTokenId(null)
                setSelectedCharacterTokenId(null)
                // Leave the battlefield unobstructed while choosing a landing
                // point; the selected monster remains highlighted in the dock.
                setEnemyDetailOpen(false)
                beginManualMonsterMovement(token, kind)
              }}
              onCancelMovement={() => {
                setManualMonsterMoveSelection(null)
                playerMovement.clear()
              }}
              endTurnPending={manualInitiativeAdvancePending || dnd5eTurnStartSettlementPending}
              onEndTurn={() => { void advanceInitiative() }}
              />
            </MapLazyOverlayBoundary>
          )}
          </MapCombatUnitDrawer>

          {/* Status inspection is independent of unit selection and the PDF/unit drawer. */}
          {effectDetailToken ? (
            <MapDetailPanelBoundary>
              <MapWorkspaceActiveEffectDetailsDialog
                targetName={effectDetailCharacter?.name ?? effectDetailToken.label}
                effects={effectDetailEffects}
                instance={effectDetailInstance ?? undefined}
                flightControls={isDM && activeMap && effectDetailInstance?.kind === 'flight' ? (
                  <DmTokenElevationControls key={effectDetailToken.id + ':' + effectDetailToken.elevationFeet}
                    map={activeMap} geometry={activeGeometry} token={effectDetailToken} characters={characters}
                    onChange={elevationFeet => useMapStore.getState().saveAuthorityTokenPatch(activeMap.id, effectDetailToken.id, { elevationFeet })} />
                ) : undefined}
                onRemove={canRemoveEffectDetailInstance
                  ? removeEffectDetailInstance
                  : undefined}
                onClose={() => setEffectDetailInstance(null)}
              />
            </MapDetailPanelBoundary>
          ) : null}


          {activeManualMonsterAttackTargeting && !activeManualMonsterMapAreaEffect ? (
            <div
              data-testid="manual-monster-attack-targeting-bar"
              className="map-combat-action-bar border-rose-300/30"
            >
              <span className="font-semibold text-rose-100">
                {activeManualMonsterAttackTargeting.actionName} · 点击地图上的目标
              </span>
              <button
                type="button"
                onClick={() => setDnd5eManualMonsterAttackTargeting(null)}
                className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:border-white/20 hover:text-white"
              >
                取消
              </button>
            </div>
          ) : null}

          {dnd5ePersistentAreaActivityTargeting && activeMap ? (
            <div
              data-testid="persistent-area-activity-target-picker"
              className="map-combat-action-bar border-emerald-300/30"
            >
              <span className="font-semibold text-emerald-100">
                {dnd5ePersistentAreaActivityTargeting.label} · 点击地图上的目标
              </span>
              {dnd5ePersistentAreaActivityTargeting.targetTokenIds != null ? <>
                <span className="text-emerald-100">已选 {dnd5ePersistentAreaActivityTargeting.targetTokenIds?.length ?? 0}/{dnd5ePersistentAreaActivityTargeting.maximumTargets} · 再次点击可取消</span>
                {(dnd5ePersistentAreaActivityTargeting.targetTokenIds ?? []).map(id => <span key={id} className="text-slate-200">{activeMap.tokens.find(token => token.id === id)?.label ?? id}</span>)}
                <button type="button" disabled={!dnd5ePersistentAreaActivityTargeting.targetTokenIds?.length}
                  className="rounded-lg border border-emerald-300/30 px-2 py-1 text-emerald-100 disabled:opacity-40"
                  onClick={() => { const first = dnd5ePersistentAreaActivityTargeting.targetTokenIds?.[0]; if (first) void handleSelectToken(first, true) }}>确认目标</button>
              </> : null}
              <button
                type="button"
                onClick={() => setDnd5ePersistentAreaActivityTargeting(null)}
                className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:border-white/20 hover:text-white"
              >
                取消
              </button>
            </div>
          ) : null}

          {isDM && combatActive && legendaryActionWindow && !legendaryActionAdjudicationActive ? (
            <Suspense fallback={null}>
              <Dnd5eLegendaryActionWindow
                endingTokenName={legendaryActionWindow.endingTokenName}
                candidates={legendaryActionWindow.candidates}
                targets={activeMap.tokens.filter((token) =>
                  token.type !== 'obstacle' && isTokenAlive(token, characters) &&
                  !isDnd5eTokenBanished(token, characters))}
                pending={legendaryActionSettlementPending}
                onUse={(selection) => {
                  void settleLegendaryActionWindowSelection(selection)
                }}
                onSkip={() => completeLegendaryActionBoundary(false)}
              />
            </Suspense>
          ) : null}

          {railChars.length > 0 && !selectedCharacterToken && !selectedToken && (
            <div className="absolute bottom-3 left-3 z-30 flex flex-col-reverse gap-3">
              {railChars.map((c) => (
                <CharacterRailEntry
                  key={c.id}
                  character={c}
                  isActive={c.id === activeCharId}
                  onAvatarClick={() => {
                    const characterToken = activeMap.tokens.find((token) =>
                      token.type === 'player' && token.characterId === c.id,
                    )
                    if (characterToken) {
                      openTokenDetails(characterToken.id)
                      return
                    }
                    onAvatarClick(c.id)
                  }}
                />
              ))}
            </div>
          )}

          <SavingThrowResultOverlay savingThrow={activeCombatSavingThrow} />
          <MastermindNativeSpellWindowPanel isDM={isDM} map={activeMap} characters={characters} session={getRoomSession()} currentTokenId={combatActive?initiativeOrder[initiativeIndex]?.tokenId:undefined} paused={!!combatFlowPauseRef.current} pending={nativeSpellWindowCasting||!!pendingPlayerAction} pendingParents={nativeSpellWindowParents} onCast={(actor,payload)=>{void startMastermindNativeSpellWindow(actor,payload)}} onResume={parent=>{void startMastermindNativeSpellWindow('',undefined,parent)}}/>
          <MastermindNativeThoughtCastPanel isDM={isDM} map={activeMap} characters={characters} session={getRoomSession()} pending={nativeThoughtCasting||!!pendingPlayerAction} pendingReads={nativeThoughtPending} onResume={parent=>{void startMastermindNativeThoughtCast('','',parent)}} onCast={(reader,owner)=>{void startMastermindNativeThoughtCast(reader,owner)}} onContinue={(reader,owner,kind,effect)=>{void startMastermindNativeThoughtContinuation(reader,owner,kind,effect)}}/>
          {!charPanel ? <PlayerMapSpellHotbar
            inventorySupplement={character=><PactWeaponRitualPanel character={character} mapId={activeMap?.id} actorTokenId={activeMap?.tokens.find(token=>token.characterId===character.id)?.id} isDm={isDM} gateway={{loadResource:loadSharedResource,saveResourcesAtomically:saveSharedResourcesAtomically,appendPlayerActionRequest:appendSharedPlayerActionRequest}} onCommitted={()=>reloadDnd5eAuthorityState()}/>}
            turnEconomyByToken={dnd5eTurnEconomyByToken}
            combatId={combatActive ? combatIdRef.current ?? undefined : undefined} round={round}
            isDM={isDM} combatActive={combatActive} mode={mode} map={activeMap} characters={characters}
            activeCharacter={currentInitiativeToken?.dnd5eSimulacrum ? turnCharacter : activeChar} playerCharacter={playerChar} turnCharacter={turnCharacter} currentInitiativeToken={currentInitiativeToken}
            playerCombatLocked={playerCombatLocked} pendingAction={pendingPlayerAction}
            activeTurnEconomy={triggeredReactionSpellIds.length > 0
              ? featherFallCasterDnd5eTurnEconomy
              : activeCharDnd5eTurnEconomy}
            activeActionId={combatHotbarActiveActionId} grappleEscapes={activeCharDnd5eGrappleEscapes}
            triggeredReactionSpellIds={triggeredReactionSpellIds}
            armedSpellModifiers={combatSpellModifiersByCharacter[(triggeredReactionSpellIds.length > 0
              ? featherFallCasterCharacter
              : playerChar)?.id ?? ''] ?? []}
            onArmedSpellModifiersChange={(modifiers) => {
              const characterId = (triggeredReactionSpellIds.length > 0
                ? featherFallCasterCharacter
                : playerChar)?.id
              if (characterId) setCombatSpellModifiers(characterId, modifiers)
            }}
            selectedSpellSlotLevels={combatSpellSlotLevelsByCharacter[(triggeredReactionSpellIds.length > 0
              ? featherFallCasterCharacter
              : playerChar)?.id ?? ''] ?? {}}
            onSelectedSpellSlotLevelChange={(actionId, slotLevel) => { const characterId = (triggeredReactionSpellIds.length > 0
              ? featherFallCasterCharacter
              : playerChar)?.id
              if (characterId) setCombatSpellSlotLevel(characterId, actionId, slotLevel)
            }} onCommand={handleCombatHotbarCommand}
            onUnavailable={(descriptor) => void showCombatNotice('当前不能使用', descriptor.disabledReason ?? '该操作目前不可用。', 'amber')}
          /> : null}
          {/* 底部浮层：按图标打开物品/特性/法术/技能栏 */}
          {!isDM && activeChar && charPanel && (
            <div
              data-testid="character-action-panel"
              className={[
                'absolute bottom-2 left-24 z-20 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-void-900/40 p-2 pr-4 pt-3 shadow-2xl backdrop-blur-sm',
                panelFull ? 'right-2' : '',
              ].join(' ')}
              style={
                panelFull
                  ? { top: '18%', bottom: 8, left: 96, right: 8 }
                  : { width: panelWidth, height: panelHeight, bottom: 8 }
              }
            >
              <div
                onMouseDown={startResizeHeight}
                className="absolute inset-x-0 top-0 z-10 flex h-3 cursor-ns-resize items-center justify-center rounded-t-2xl hover:bg-white/5"
                title="拖动上沿调整高度"
              >
                <GripHorizontal className="h-3 w-8 text-slate-500 opacity-70" />
              </div>

              <div className="mb-1.5 flex shrink-0 flex-wrap items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br text-sm ${activeChar.accent}`}>
                  {activeChar.avatar}
                </span>
                <span className="text-sm font-semibold text-slate-100 drop-shadow">{activeChar.name}</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                  {CHAR_PANEL_TITLES[charPanel]}
                </span>
                <ClassResourceIndicators character={activeChar} compact />
                <button
                  onClick={handlePlayerEndTurn}
                  data-testid="player-end-turn"
                  disabled={!!pendingPlayerAction || !combatActive || !canEndPlayerTurn}
                  className="ml-auto flex items-center gap-1 rounded-lg bg-arcane-500/20 px-2 py-1 text-xs font-medium text-arcane-100 hover:bg-arcane-500/30"
                  title="结束当前回合"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  结束回合
                </button>
                <button
                  onClick={() => setPanelFull((v) => !v)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10"
                  title={panelFull ? '还原宽度' : '铺满屏幕'}
                >
                  {panelFull ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <button
                  onClick={closeCharDock}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10"
                  title="收起面板"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
                {charPanel === 'inventory' && (
                  <Suspense fallback={null}>
                    <MapWorkspaceInventoryPanel
                      charId={activeChar.id}
                      pending={!!pendingPlayerAction}
                      onUseItem={combatActive ? sendDnd5eItemUseRequest : undefined}
                    />
                    <PactWeaponRitualPanel character={activeChar} mapId={activeMap?.id} actorTokenId={activeMap?.tokens.find(token=>token.characterId===activeChar.id)?.id} isDm={isDM} gateway={{loadResource:loadSharedResource,saveResourcesAtomically:saveSharedResourcesAtomically,appendPlayerActionRequest:appendSharedPlayerActionRequest}} onCommitted={()=>reloadDnd5eAuthorityState()}/>
                  </Suspense>
                )}
                {charPanel === 'features' && (
                  <div className="space-y-3">
                    {activeCharRacialRules?.dragonbornAncestry && (
                      <section className="rounded-xl border border-amber-300/20 bg-amber-500/[0.06] p-4">
                        <h4 className="text-sm font-semibold text-amber-100">龙裔吐息</h4>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          {activeCharRacialRules.dragonbornAncestry.name}血统 ·
                          {' '}{activeCharRacialRules.dragonbornAncestry.damageType}伤害 ·
                          {' '}{combatPresentationSavingThrowAbilityLabel(activeCharRacialRules.dragonbornAncestry.saveAbility)} ·
                          {' '}{activeCharBreathResource?.current ?? 0}/{activeCharBreathResource?.max ?? 1}
                        </p>
                        <button
                          type="button"
                          disabled={
                            !!pendingPlayerAction ||
                            !combatActive ||
                            !canControlPlayerTurn ||
                            activeChar.id !== turnCharacter?.id ||
                            activeCharDnd5eTurnEconomy.action.current < 1 ||
                            (activeCharBreathResource?.current ?? 0) < 1
                          }
                          onClick={() => {
                            const ancestry = activeCharRacialRules.dragonbornAncestry
                            if (!ancestry) return
                            setDnd5eWeaponTargeting(null)
                            setDnd5eSpellTargeting(null)
                            setDnd5eItemAreaTargeting(null)
                            setDnd5eItemCreatureTargeting(null)
                            setDnd5ePluginAreaTargeting({
                              source: 'dragonborn-breath',
                              characterId: activeChar.id,
                              featureId: 'dragonborn-breath',
                              featureName: '龙裔吐息',
                              targeting: {
                                kind: 'area',
                                relation: 'any',
                                includeSelf: false,
                                template: dnd5eDragonbornBreathArea(ancestry),
                              },
                            })
                            setAoePreviewCell(null)
                          }}
                          className="mt-3 w-full rounded-lg border border-amber-300/25 bg-amber-400/15 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          选择吐息方向
                        </button>
                      </section>
                    )}
                    <p className="rounded-xl border border-white/10 bg-void-950/50 p-4 text-sm leading-6 text-slate-300">
                      D&amp;D 5e 职业特性的主动操作已统一放在“技能”页；种族被动与战斗触发由 Headless 自动结算。
                    </p>
                  </div>
                )}
                {charPanel === 'skills' && <Suspense fallback={null}><div className="space-y-3">
                  {(isDM || activeChar.id === playerChar?.id) && activeChar.dnd5eDreamContact?.phase === 'connected' && !activeChar.dnd5eDreamContact.nightmareAttempted && (
                    <button type="button" data-testid="dream-nightmare-message" disabled={isSpectator || !!pendingPlayerAction}
                      className="w-full rounded-xl border border-purple-400/30 bg-purple-500/15 p-3 text-purple-100 disabled:opacity-50"
                      onClick={() => void requestDreamNightmare(activeChar)}>传递噩梦讯息</button>
                  )}
                  {mode === 'player' && activeChar.id === playerChar?.id && (!combatActive ||
                    activeChar.dnd5eCombatState?.activeEffects?.some(effect => effect.removal?.action?.economy === 'free')) && <div data-testid="exploration-effect-removal">
                    <Dnd5eBasicActionsPanel
                      effectsOnly
                      canAct={!isSpectator && (activeChar.currentHp > 0 || dnd5eCharacterCanActAtZeroHitPoints(activeChar))}
                      pending={!!pendingPlayerAction}
                      targets={combatActive ? [] : activeCharDnd5eFeatureTargets}
                      dismissibleEffects={(activeChar.dnd5eCombatState?.activeEffects ?? []).flatMap(effect =>
                        ((!combatActive && effect.removal?.action?.economy === 'action') || effect.removal?.action?.economy === 'free')
                          ? [{ effectId: effect.id, label: effect.label, actionLabel: effect.removal.action.label, economy: effect.removal.action.economy }] : [])}
                      allowedBasicActions={dnd5eActiveActionRestriction(activeChar.dnd5eCombatState?.activeEffects)?.allowedBasicActions}
                      onAction={handleDnd5eBasicAction}
                    />
                  </div>}
                  {isDM && combatActive && activeChar.dnd5eCombatState?.readiedAction && (
                    <section className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">待触发的准备动作</p>
                      <p className="mt-2 text-sm text-slate-100">{activeChar.dnd5eCombatState.readiedAction.trigger}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        内容：{activeChar.dnd5eCombatState.readiedAction.actionKind === 'attack' ? '攻击'
                          : activeChar.dnd5eCombatState.readiedAction.actionKind === 'move' ? '移动'
                            : activeChar.dnd5eCombatState.readiedAction.actionKind === 'interact-object' ? '物件交互' : '其他（DM 裁定）'}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleTriggerReadiedAction(activeChar.id)}
                        className="mt-3 w-full rounded-lg border border-amber-300/25 bg-amber-400/15 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-400/25"
                      >
                        条件已发生：触发并消耗反应
                      </button>
                    </section>
                  )}
                  {!combatActive && playerSpellActionSubmission()?.character.id===activeChar.id && <button type="button" data-action-id="exploration-weapon-attack" disabled={!!pendingPlayerAction} onClick={()=>{setDnd5eWeaponAttackOptions(undefined);setDnd5eWeaponTargeting(current=>current===activeChar.id?null:activeChar.id)}} className="mb-3 w-full rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">选择目标并进行武器攻击</button>}
                  {activeChar.charClass === '战士' ? (
                    <Dnd5eFighterCombatPanel
                      character={activeChar}
                      canAct={canControlPlayerTurn && activeChar.id === turnCharacter?.id}
                      targeting={dnd5eWeaponTargeting === activeChar.id}
                      extraActionTeleportTargeting={dnd5eExtraActionTeleportTargeting?.characterId === activeChar.id}
                      pending={!!pendingPlayerAction}
                      turnEconomy={activeCharDnd5eTurnEconomy}
                      basicActionTargets={activeCharDnd5eFeatureTargets}
                      onAttack={(options) => {
                        setDnd5eWeaponAttackOptions(withDeclarativeAttackIntents(activeChar.id, options))
                        setDnd5eWeaponTargeting((current) => current === activeChar.id ? null : activeChar.id)
                      }}
                      onDisengage={handleDisengage}
                      onDodge={handleDodge}
                      onBasicAction={handleDnd5eBasicAction}
                      onFeature={(feature) => {
                        setDnd5eWeaponTargeting(null)
                        setDnd5eWeaponAttackOptions(undefined)
                        sendPlayerDnd5eFighterFeatureRequest(feature)
                      }}
                      onClassFeature={(payload) => {
                        setDnd5eWeaponTargeting(null)
                        setDnd5eWeaponAttackOptions(undefined)
                        sendPlayerDnd5eClassFeatureRequest(payload, activeChar.id)
                      }}
                      onExtraActionTeleport={() => {
                        setDnd5eWeaponTargeting(null)
                        setDnd5eWeaponAttackOptions(undefined)
                        setDnd5eSpellTargeting(null)
                        setDnd5eItemAreaTargeting(null)
                        setDnd5eItemCreatureTargeting(null)
                        setDnd5ePluginAreaTargeting(null)
                        setDnd5eExtraActionTeleportTargeting((current) =>
                          current?.characterId === activeChar.id
                            ? null
                            : { characterId: activeChar.id },
                        )
                        setAoePreviewCell(null)
                      }}
                    />
                  ) : (
                    <Dnd5eClassCombatPanel
                      character={activeChar}
                      canAct={canControlPlayerTurn && activeChar.id === turnCharacter?.id}
                      targeting={dnd5eWeaponTargeting === activeChar.id}
                      pending={!!pendingPlayerAction}
                      turnEconomy={activeCharDnd5eTurnEconomy}
                      featureTargets={activeCharDnd5eFeatureTargets}
                      canDismissWardingBond={!!activeCharToken && activeMap?.tokens.some((targetToken) => {
                        const targetCharacter = targetToken.characterId
                          ? characters.find((candidate) => candidate.id === targetToken.characterId)
                          : undefined
                        return (targetCharacter?.dnd5eCombatState?.activeEffects ??
                          targetToken.dnd5eCombatState?.activeEffects ?? []).some((effect) =>
                          effect.definitionId === 'srd-5.1:spell:warding-bond' &&
                          effect.source.actorId === activeCharToken.id)
                      }) === true}
                      onAttack={(options) => {
                        setDnd5eWeaponAttackOptions(withDeclarativeAttackIntents(activeChar.id, options))
                        setDnd5eWeaponTargeting((current) => current === activeChar.id ? null : activeChar.id)
                      }}
                      onDisengage={handleDisengage}
                      onDodge={handleDodge}
                      onBasicAction={handleDnd5eBasicAction}
                      onFeature={(payload) => {
                        setDnd5eWeaponTargeting(null)
                        setDnd5eWeaponAttackOptions(undefined)
                        sendPlayerDnd5eClassFeatureRequest(payload, activeChar.id)
                      }}
                    />
                  )}
                  {activeMap && activeCharToken && (
                    <Dnd5ePluginCombatPanel
                      character={activeChar}
                      map={activeMap}
                      actorToken={activeCharToken}
                      canAct={canControlPlayerTurn && activeChar.id === turnCharacter?.id}
                      canUseRestActivities={!combatActive && !isSpectator && (isDM || activeChar.id === playerChar?.id)}
                      canUseExplorationActivities={!combatActive && !isSpectator && (isDM || activeChar.id === playerChar?.id)}
                      pending={!!pendingPlayerAction}
                      turnEconomy={activeCharDnd5eTurnEconomy}
                      armedAttackIntentFeatureIds={activeDeclarativeAttackIntentFeatureIds(activeChar.id)}
                      onInspectKnownLocation={location => {
                        const now = Date.now()
                        setPrivateLocationFocus({ type: 'focus', id: 'private-location:' + crypto.randomUUID(),
                          mapId: location.mapId, point: { x: location.x, y: location.y },
                          memberId: 'local-only', memberName: location.label, role: 'player',
                          createdAt: now, expiresAt: now + 3200 })
                      }}
                      onToggleAttackIntent={(featureId) =>
                        toggleDeclarativeAttackIntent(activeChar.id, featureId)
                      }
                      onAction={({ payload, targetTokenId, targetTokenIds }) => {
                        setDnd5eWeaponTargeting(null)
                        setDnd5eWeaponAttackOptions(undefined)
                        const featureActionId = dnd5ePluginFeatureDefinition(payload.featureId)?.action?.id
                        if (
                          featureActionId !== 'spell:instant-summons:recall' &&
                          !payload.featureId.endsWith('spell:instant-summons:recall')
                        ) {
                          sendPlayerDnd5ePluginActionRequest(payload, targetTokenId, undefined, targetTokenIds, activeChar.id)
                          return
                        }
                        void (async () => {
                          const latestCharacters = useCharacterStore.getState().characters
                          const latestActor = latestCharacters.find((character) => character.id === activeChar.id)
                          const links = latestActor
                            ? normalizeDnd5eInventory(latestActor).entries.flatMap((sapphire) => {
                                const recordId = sapphire.linkedSpellFocusAuthorityRecordId
                                const record = recordId
                                  ? latestActor.dnd5eCombatState?.spellAuthorityRecords?.[recordId]
                                  : undefined
                                if (
                                  !recordId || record?.kind !== 'linked-planar-object' ||
                                  record.profile !== 'instant-summons'
                                ) return []
                                const linkedItem = latestCharacters.flatMap((character) =>
                                  normalizeDnd5eInventory(character).entries,
                                ).find((entry) => entry.linkedSpellAuthorityRecordId === recordId)
                                return linkedItem ? [{ recordId, sapphire, linkedItem }] : []
                              })
                            : []
                          if (links.length < 1) {
                            await showCombatNotice('没有可召回连结', '没有找到仍由专属蓝宝石锚定的瞬间召唤物品。', 'amber')
                            return
                          }
                          const selected = await showAppPrompt(
                            `瞬间召唤：选择要捏碎的蓝宝石\n${links.map((link, index) =>
                              `${index + 1}. ${link.sapphire.item.name} → ${link.linkedItem.item.name}`,
                            ).join('\n')}\n每个连结只会消耗它自己的蓝宝石。`,
                            '1',
                          )
                          if (selected == null) return
                          const selectedLink = links[Number(selected) - 1]
                          if (!selectedLink) {
                            await showCombatNotice('蓝宝石选择无效', '请输入列表中的有效序号。', 'amber')
                            return
                          }
                          sendPlayerDnd5ePluginActionRequest({
                            ...payload,
                            payload: {
                              ...(payload.payload && typeof payload.payload === 'object' && !Array.isArray(payload.payload)
                                ? payload.payload
                                : {}),
                              activitySpellAuthorityRecordId: selectedLink.recordId,
                            },
                          }, targetTokenId, undefined, targetTokenIds)
                        })()
                      }}
                      onBeginAreaTargeting={({ featureId, featureName, targeting, featurePayload }) => {
                        setDnd5eWeaponTargeting(null)
                        setDnd5eWeaponAttackOptions(undefined)
                        setDnd5eSpellTargeting(null)
                        setDnd5eItemAreaTargeting(null)
                        setDnd5eItemCreatureTargeting(null)
                        setDnd5ePluginAreaTargeting({
                          source: 'plugin',
                          characterId: activeChar.id,
                          featureId,
                          featureName,
                          targeting,
                          featurePayload,
                        })
                        setAoePreviewCell(null)
                      }}
                    />
                  )}
                </div></Suspense>}
              </div>

              {!panelFull && (
                <div
                  onMouseDown={startResizeWidth}
                  className="absolute inset-y-0 right-0 flex w-3 cursor-ew-resize items-center justify-center rounded-r-2xl hover:bg-white/5"
                  title="拖动右沿调整宽度"
                >
                  <GripVertical className="h-5 w-5 text-slate-500" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isDM && combatExperienceDraft && (
        <MapLazyOverlayBoundary label="正在打开经验结算…">
          <CombatExperienceSettlementDialog
            draft={combatExperienceDraft}
            busy={combatExperienceBusy}
            onSettle={settleEndedCombatExperience}
          />
        </MapLazyOverlayBoundary>
      )}

      {!isDM && merchantInteraction && activeMap?.id === merchantInteraction.mapId && playerChar && (() => {
        const merchant = activeMap.tokens.find((token) => token.id === merchantInteraction.merchantTokenId)
        const buyerToken = activeMap.tokens.find((token) => token.id === merchantInteraction.buyerTokenId)
        if (!merchant || !buyerToken || merchant.type !== 'npc' || !merchant.merchantShopId) return null
        return (
          <Suspense fallback={null}>
            <MapMerchantShopDialog
              mapId={activeMap.id}
              merchant={merchant}
              buyerToken={buyerToken}
              buyer={playerChar}
              onClose={() => setMerchantInteraction(null)}
            />
          </Suspense>
        )
      })()}

      {isDM && enemyPoolOpen && (
        <MapLazyOverlayBoundary label="正在打开怪物目录…">
          <EnemyPoolPicker
            open={enemyPoolOpen}
            title={enemyPoolMode === 'add' ? '添加怪物' : '更换怪物'}
            canManageCustom
            enableAutomaticAppearanceSelection={enemyPoolMode === 'add'}
            allowFriendlyPlacement={enemyPoolMode === 'add'}
            getUsedVisualVariantIds={(template) => activeMap?.tokens
              .filter((token) => token.type === 'enemy' && token.poolId === template.id)
              .map((token) => token.visualVariantId) ?? []}
            hint={
              enemyPoolMode === 'add'
                ? '从完整 SRD 5.1 目录或房间自定义目录中选择，并放置到地图中央'
                : selectedToken
                  ? `为「${selectedToken.label}」选择新种类`
                  : undefined
            }
            onClose={() => setEnemyPoolOpen(false)}
            onPick={handleEnemyPoolPick}
            onBuildEncounter={enemyPoolMode === 'add' ? handleEncounterBuild : undefined}
          />
        </MapLazyOverlayBoundary>
      )}
    </div>)
}
