import { useCombatStatisticsStore } from '../../store/combatStatistics'
import { useFogStore } from '../../store/fog'
import { useMapExplorationStore } from '../../store/mapExploration'
import { useMapGeometryStore } from '../../store/mapGeometry'
import { useMapStore } from '../../store/maps'
import { useSceneOrchestrationStore } from '../../store/sceneOrchestration'

/**
 * Read-only React projection of the stores needed by the map orchestrator.
 * Imperative authority writes remain behind their application coordinators.
 */
export function useMapsPageStoreProjection() {
  return {
    maps: useMapStore((state) => state.maps),
    selectedId: useMapStore((state) => state.selectedId),
    select: useMapStore((state) => state.select),
    addMap: useMapStore((state) => state.addMap),
    updateMap: useMapStore((state) => state.updateMap),
    removeMap: useMapStore((state) => state.removeMap),
    addToken: useMapStore((state) => state.addToken),
    addEnemyFromPool: useMapStore((state) => state.addEnemyFromPool),
    addEncounterFromPool: useMapStore((state) => state.addEncounterFromPool),
    addCharacterToken: useMapStore((state) => state.addCharacterToken),
    updateToken: useMapStore((state) => state.updateToken),
    applyAuthorityTokenUpdate: useMapStore((state) => state.applyAuthorityTokenUpdate),
    applyAuthorityMapUpdate: useMapStore((state) => state.applyAuthorityMapUpdate),
    removeToken: useMapStore((state) => state.removeToken),
    fogMaps: useFogStore((state) => state.maps),
    fogRedoByMap: useFogStore((state) => state.redoByMap),
    fillFog: useFogStore((state) => state.fill),
    clearFog: useFogStore((state) => state.clear),
    addFogShape: useFogStore((state) => state.addShape),
    undoFog: useFogStore((state) => state.undo),
    redoFog: useFogStore((state) => state.redo),
    setFogStyle: useFogStore((state) => state.setStyle),
    geometryMaps: useMapGeometryStore((state) => state.maps),
    selectedGeometryEntityId: useMapGeometryStore((state) => state.selectedEntityId),
    selectGeometryEntity: useMapGeometryStore((state) => state.selectEntity),
    addGeometryEntity: useMapGeometryStore((state) => state.addEntity),
    removeGeometryEntity: useMapGeometryStore((state) => state.removeEntity),
    applyAuthorityGeometryDoorState: useMapGeometryStore((state) => state.applyAuthorityDoorState),
    applyAuthorityGeometryEntityUpdate: useMapGeometryStore((state) => state.applyAuthorityEntityUpdate),
    setGeometryEntityPoints: useMapGeometryStore((state) => state.setEntityPoints),
    replaceGeometryMap: useMapGeometryStore((state) => state.replaceMap),
    explorationMaps: useMapExplorationStore((state) => state.maps),
    recordMapExploration: useMapExplorationStore((state) => state.record),
    startCombatStatistics: useCombatStatisticsStore((state) => state.startCombat),
    recordCombatStatistics: useCombatStatisticsStore((state) => state.record),
    settleCombatExperience: useCombatStatisticsStore((state) => state.settleExperience),
    archiveCombatLog: useCombatStatisticsStore((state) => state.archiveCombatLog),
    sceneOrchestration: useSceneOrchestrationStore((state) => state.shared),
    setSceneTriggerRegion: useSceneOrchestrationStore((state) => state.setTriggerRegion),
    setSceneInteractionPointPosition: useSceneOrchestrationStore((state) => state.setInteractionPointPosition),
  }
}
