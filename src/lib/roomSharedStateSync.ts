import { subscribeSharedResourceInvalidation } from './sharedApi'
import { useMapStore } from '../store/maps'
import { useFogStore } from '../store/fog'
import { useMapGeometryStore } from '../store/mapGeometry'
import { useMapExplorationStore } from '../store/mapExploration'
import { useCombatStatisticsStore } from '../store/combatStatistics'
import { useCharacterStore } from '../store/characters'
import { SHARED_SPELLBOOK_RESOURCE, useSpellbookStore } from '../store/spellbook'
import { SHARED_CUSTOM_MONSTERS_RESOURCE, useCustomMonsterStore } from '../store/customMonsters'
import { MAP_FOG_RESOURCE } from './fogOfWar'
import { MAP_GEOMETRY_RESOURCE } from './mapGeometry'
import { MAP_EXPLORATION_RESOURCE } from './mapExploration'
import { COMBAT_STATISTICS_RESOURCE } from './combatStatistics'
import { ROOM_CHAT_RESOURCE, ROOM_JOURNAL_RESOURCE } from './roomCommunications'
import { useRoomCommunicationsStore } from '../store/roomCommunications'
import { CAMPAIGN_TIME_RESOURCE } from './campaignTime'
import { useCampaignTimeStore } from '../store/campaignTime'
import { SCENE_ORCHESTRATION_RESOURCE } from './sceneOrchestration'
import { useSceneOrchestrationStore } from '../store/sceneOrchestration'
import { SCENE_AUDIO_LIBRARY_RESOURCE, SCENE_AUDIO_PLAYBACK_RESOURCE } from './sceneAudioLibrary'
import { useSceneAudioStore } from '../store/sceneAudio'

/**
 * Starts room-wide resource hydration after a room is actually entered.
 * Keeping this coordinator behind a dynamic import prevents maps, monsters, and
 * character rules from becoming part of the lobby's production entry graph.
 */
export function startRoomSharedStateSync(): () => void {
  const loadSharedMaps = useMapStore.getState().loadShared
  const loadSharedFog = useFogStore.getState().loadShared
  const loadSharedMapGeometry = useMapGeometryStore.getState().loadShared
  const loadSharedMapExploration = useMapExplorationStore.getState().loadShared
  const loadSharedCombatStatistics = useCombatStatisticsStore.getState().loadShared
  const loadSharedCharacters = useCharacterStore.getState().loadShared
  const loadSharedSpellbook = useSpellbookStore.getState().loadShared
  const loadSharedCustomMonsters = useCustomMonsterStore.getState().loadShared
  const loadSharedRoomChat = useRoomCommunicationsStore.getState().loadChat
  const loadSharedRoomJournal = useRoomCommunicationsStore.getState().loadJournal
  const loadSharedCampaignTime = useCampaignTimeStore.getState().loadShared
  const loadSharedSceneOrchestration = useSceneOrchestrationStore.getState().loadShared
  const loadSharedSceneAudioLibrary = useSceneAudioStore.getState().loadLibrary
  const loadSharedSceneAudioPlayback = useSceneAudioStore.getState().loadPlayback

  void Promise.all([
    loadSharedMaps(),
    loadSharedCharacters(),
    loadSharedSpellbook(),
    loadSharedCustomMonsters(),
    loadSharedFog(),
    loadSharedMapGeometry(),
    loadSharedMapExploration(),
    loadSharedCombatStatistics(),
    loadSharedRoomChat(),
    loadSharedRoomJournal(),
    loadSharedCampaignTime(),
    loadSharedSceneOrchestration(),
    loadSharedSceneAudioLibrary(),
    loadSharedSceneAudioPlayback(),
  ]).catch((error) => {
    console.error('[room-state] initial hydration failed', error)
  })

  const subscriptionOptions = { immediate: false }
  const stopMaps = subscribeSharedResourceInvalidation('maps', loadSharedMaps, subscriptionOptions)
  const stopCharacters = subscribeSharedResourceInvalidation('characters', loadSharedCharacters, subscriptionOptions)
  const stopSpellbook = subscribeSharedResourceInvalidation(SHARED_SPELLBOOK_RESOURCE, loadSharedSpellbook, subscriptionOptions)
  const stopCustomMonsters = subscribeSharedResourceInvalidation(SHARED_CUSTOM_MONSTERS_RESOURCE, loadSharedCustomMonsters, subscriptionOptions)
  const stopFog = subscribeSharedResourceInvalidation(MAP_FOG_RESOURCE, loadSharedFog, subscriptionOptions)
  const stopMapGeometry = subscribeSharedResourceInvalidation(MAP_GEOMETRY_RESOURCE, async () => {
    await loadSharedMapGeometry()
    await loadSharedMaps()
  }, subscriptionOptions)
  const stopMapExploration = subscribeSharedResourceInvalidation(MAP_EXPLORATION_RESOURCE, loadSharedMapExploration, subscriptionOptions)
  const stopCombatStatistics = subscribeSharedResourceInvalidation(COMBAT_STATISTICS_RESOURCE, loadSharedCombatStatistics, subscriptionOptions)
  const stopRoomChat = subscribeSharedResourceInvalidation(ROOM_CHAT_RESOURCE, loadSharedRoomChat, subscriptionOptions)
  const stopRoomJournal = subscribeSharedResourceInvalidation(ROOM_JOURNAL_RESOURCE, loadSharedRoomJournal, subscriptionOptions)
  const stopCampaignTime = subscribeSharedResourceInvalidation(CAMPAIGN_TIME_RESOURCE, loadSharedCampaignTime, subscriptionOptions)
  const stopSceneOrchestration = subscribeSharedResourceInvalidation(SCENE_ORCHESTRATION_RESOURCE, loadSharedSceneOrchestration, subscriptionOptions)
  const stopSceneAudioLibrary = subscribeSharedResourceInvalidation(SCENE_AUDIO_LIBRARY_RESOURCE, loadSharedSceneAudioLibrary, subscriptionOptions)
  const stopSceneAudioPlayback = subscribeSharedResourceInvalidation(SCENE_AUDIO_PLAYBACK_RESOURCE, loadSharedSceneAudioPlayback, subscriptionOptions)

  return () => {
    stopMaps()
    stopCharacters()
    stopSpellbook()
    stopCustomMonsters()
    stopFog()
    stopMapGeometry()
    stopMapExploration()
    stopCombatStatistics()
    stopRoomChat()
    stopRoomJournal()
    stopCampaignTime()
    stopSceneOrchestration()
    stopSceneAudioLibrary()
    stopSceneAudioPlayback()
  }
}
