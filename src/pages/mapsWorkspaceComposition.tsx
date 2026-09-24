import { lazy } from 'react'
import { loadEnemyPoolPicker } from './mapsWorkspaceRuntime'
export const EnemyPoolPicker = lazy(loadEnemyPoolPicker)
export const MapViewportLayer = lazy(() => import('../presentation/maps/MapViewportLayer'))
export const MapWorkspacePanelsLayer = lazy(() => import('../presentation/maps/MapWorkspacePanelsLayer'))
export const MapWorkspaceCombatLogPanel = lazy(() => import('../presentation/maps/MapWorkspacePanelsLayer').then(
  (module) => ({ default: module.MapWorkspaceCombatLogPanel }),
))
export const MapWorkspaceInitiativePanel = lazy(() => import('../presentation/maps/MapWorkspacePanelsLayer').then(
  (module) => ({ default: module.MapWorkspaceInitiativePanel }),
))
export const MapWorkspaceInventoryPanel = lazy(() => import('../presentation/maps/MapWorkspacePanelsLayer').then(
  (module) => ({ default: module.MapWorkspaceInventoryPanel }),
))
export const MapWorkspaceEnemyDetailPanel = lazy(() => import('../presentation/maps/MapWorkspacePanelsLayer').then(
  (module) => ({ default: module.MapWorkspaceEnemyDetailPanel }),
))
export const MapWorkspaceCharacterDetailPanel = lazy(() => import('../presentation/maps/MapWorkspacePanelsLayer').then(
  (module) => ({ default: module.MapWorkspaceCharacterDetailPanel }),
))
export const Dnd5eMapObjectDetailPanel = lazy(() => import('../components/map/Dnd5eMapObjectDetailPanel'))
export const PlayerQuickCharacterSheet = lazy(() => import('../components/map/PlayerQuickCharacterSheet'))
export const MapWorkspaceSpellEffectDetailPanel = lazy(() => import('../presentation/maps/MapWorkspacePanelsLayer').then(
  (module) => ({ default: module.MapWorkspaceSpellEffectDetailPanel }),
))
export const MapWorkspacePersistentAreaDetailPanel = lazy(() => import('../presentation/maps/MapWorkspacePanelsLayer').then(
  (module) => ({ default: module.MapWorkspacePersistentAreaDetailPanel }),
))
export const MapWorkspaceActiveEffectDetailsDialog = lazy(() => import('../presentation/maps/MapWorkspacePanelsLayer').then(
  (module) => ({ default: module.MapWorkspaceActiveEffectDetailsDialog }),
))
export const NpcMerchantPanel = lazy(() => import('../components/map/NpcMerchantPanel'))
export const MapMerchantShopDialog = lazy(() => import('../components/map/MapMerchantShopDialog'))
export const SceneOrchestrationSystem = lazy(() => import('../components/map/SceneOrchestrationSystem'))
export const MapDiceRoller = lazy(() => import('../components/map/MapDiceRoller'))
export const D20RollConfirmationOverlay = lazy(() => import('../components/map/D20RollConfirmationOverlay'))
export const DmMonsterControlDock = lazy(() => import('../components/map/DmMonsterControlDock'))
export const Dnd5eLegendaryActionWindow = lazy(() => import('../components/map/Dnd5eLegendaryActionWindow'))
export const Dnd5eFighterCombatPanel = lazy(() => import('../components/map/Dnd5eFighterCombatPanel'))
export const Dnd5eClassCombatPanel = lazy(() => import('../components/map/Dnd5eClassCombatPanel'))
export const Dnd5ePluginCombatPanel = lazy(() => import('../components/map/Dnd5ePluginCombatPanel'))
export const CombatExperienceSettlementDialog = lazy(() => import('../components/map/CombatExperienceSettlementDialog'))
export const CombatInitiativeConfirmationDialog = lazy(() => import('../components/map/CombatInitiativeConfirmationDialog'))
export const DmCombatRecoveryDialog = lazy(() => import('./maps/DmCombatRecoveryDialog'))

