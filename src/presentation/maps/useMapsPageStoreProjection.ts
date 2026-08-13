import { useCombatStatisticsStore } from '../../store/combatStatistics'
import { useFogStore } from '../../store/fog'
import { useMapExplorationStore } from '../../store/mapExploration'
import { useMapGeometryStore } from '../../store/mapGeometry'
import { useMapStore } from '../../store/maps'
import { useSceneOrchestrationStore } from '../../store/sceneOrchestration'
import { useShallow } from 'zustand/react/shallow'
import type { BattleMap } from '../../store/maps'

export function selectMapsPageActiveMap(state: {
  maps: readonly BattleMap[]
  selectedId: string | null
}): BattleMap | null {
  return state.maps.find((entry) => entry.id === state.selectedId) ?? state.maps[0] ?? null
}

/**
 * Read-only React projection of the stores needed by the map orchestrator.
 * Imperative authority writes remain behind their application coordinators.
 */
export function useMapsPageStoreProjection() {
  const map = useMapStore(useShallow((state) => ({
    activeMap: selectMapsPageActiveMap(state),
    addMap: state.addMap,
    updateMap: state.updateMap,
    removeMap: state.removeMap,
    addToken: state.addToken,
    addEnemyFromPool: state.addEnemyFromPool,
    addEncounterFromPool: state.addEncounterFromPool,
    addCharacterToken: state.addCharacterToken,
    updateToken: state.updateToken,
    applyAuthorityTokenUpdate: state.applyAuthorityTokenUpdate,
    applyAuthorityMapUpdate: state.applyAuthorityMapUpdate,
    removeToken: state.removeToken,
  })))
  const activeMapId = map.activeMap?.id
  const fog = useFogStore(useShallow((state) => ({
    activeFogMap: state.maps.find((entry) => entry.mapId === activeMapId),
    activeFogRedoCount: state.redoByMap[activeMapId ?? '']?.length ?? 0,
    fillFog: state.fill,
    clearFog: state.clear,
    addFogShape: state.addShape,
    undoFog: state.undo,
    redoFog: state.redo,
    setFogStyle: state.setStyle,
  })))
  const geometry = useMapGeometryStore(useShallow((state) => ({
    activeGeometryMap: state.maps.find((entry) => entry.mapId === activeMapId),
    selectedGeometryEntityId: state.selectedEntityId,
    selectGeometryEntity: state.selectEntity,
    addGeometryEntity: state.addEntity,
    removeGeometryEntity: state.removeEntity,
    applyAuthorityGeometryDoorState: state.applyAuthorityDoorState,
    applyAuthorityGeometryEntityUpdate: state.applyAuthorityEntityUpdate,
    setGeometryEntityPoints: state.setEntityPoints,
    replaceGeometryMap: state.replaceMap,
  })))
  const exploration = useMapExplorationStore(useShallow((state) => ({
    activeExplorationMap: state.maps.find((entry) => entry.mapId === activeMapId),
    recordMapExploration: state.record,
  })))
  const combatStatistics = useCombatStatisticsStore(useShallow((state) => ({
    startCombatStatistics: state.startCombat,
    recordCombatStatistics: state.record,
    settleCombatExperience: state.settleExperience,
    archiveCombatLog: state.archiveCombatLog,
  })))
  const activeMapScenes = useSceneOrchestrationStore(useShallow((state) =>
    state.shared.scenes.filter((entry) => entry.mapId === activeMapId),
  ))
  const sceneActions = useSceneOrchestrationStore(useShallow((state) => ({
    setSceneTriggerRegion: state.setTriggerRegion,
    setSceneInteractionPointPosition: state.setInteractionPointPosition,
  })))

  return {
    ...map,
    ...fog,
    ...geometry,
    ...exploration,
    ...combatStatistics,
    activeMapScenes,
    ...sceneActions,
  }
}
