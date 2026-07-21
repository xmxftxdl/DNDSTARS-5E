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
import { GROUP_ABILITY_CHECK_RESOURCE } from './groupAbilityChecks'
import { useGroupAbilityChecksStore } from '../store/groupAbilityChecks'
import { CAMPAIGN_TIME_RESOURCE } from './campaignTime'
import { useCampaignTimeStore } from '../store/campaignTime'

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
  const loadSharedGroupAbilityChecks = useGroupAbilityChecksStore.getState().loadShared
  const loadSharedCampaignTime = useCampaignTimeStore.getState().loadShared

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
    loadSharedGroupAbilityChecks(),
    loadSharedCampaignTime(),
  ])

  const stopMaps = subscribeSharedResourceInvalidation('maps', loadSharedMaps)
  const stopCharacters = subscribeSharedResourceInvalidation('characters', loadSharedCharacters)
  const stopSpellbook = subscribeSharedResourceInvalidation(SHARED_SPELLBOOK_RESOURCE, loadSharedSpellbook)
  const stopCustomMonsters = subscribeSharedResourceInvalidation(SHARED_CUSTOM_MONSTERS_RESOURCE, loadSharedCustomMonsters)
  const stopFog = subscribeSharedResourceInvalidation(MAP_FOG_RESOURCE, loadSharedFog)
  const stopMapGeometry = subscribeSharedResourceInvalidation(MAP_GEOMETRY_RESOURCE, async () => {
    await loadSharedMapGeometry()
    await loadSharedMaps()
  })
  const stopMapExploration = subscribeSharedResourceInvalidation(MAP_EXPLORATION_RESOURCE, loadSharedMapExploration)
  const stopCombatStatistics = subscribeSharedResourceInvalidation(COMBAT_STATISTICS_RESOURCE, loadSharedCombatStatistics)
  const stopRoomChat = subscribeSharedResourceInvalidation(ROOM_CHAT_RESOURCE, loadSharedRoomChat)
  const stopRoomJournal = subscribeSharedResourceInvalidation(ROOM_JOURNAL_RESOURCE, loadSharedRoomJournal)
  const stopGroupAbilityChecks = subscribeSharedResourceInvalidation(GROUP_ABILITY_CHECK_RESOURCE, loadSharedGroupAbilityChecks)
  const stopCampaignTime = subscribeSharedResourceInvalidation(CAMPAIGN_TIME_RESOURCE, loadSharedCampaignTime)

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
    stopGroupAbilityChecks()
    stopCampaignTime()
  }
}
