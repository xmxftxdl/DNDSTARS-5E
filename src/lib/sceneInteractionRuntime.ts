import type { OrchestratedScene } from './sceneOrchestration'

// Like geometry runtime, this is a local view of the loaded authority/projection.
// Player projections do not contain private checks or outcome definitions.
let scenes: readonly OrchestratedScene[] = []
export function setSceneInteractionRuntime(value: readonly OrchestratedScene[]) { scenes = value }
export function sceneInteractionRuntimeForMap(mapId: string) { return scenes.filter(scene => scene.mapId === mapId) }
