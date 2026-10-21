import { validateSharedSceneOrchestration, type SharedSceneOrchestrationState } from './sceneOrchestration'

/** Read the durable private scene and keep the revision that actually produced it. */
export async function loadPlanarPortalAuthority(
  load: <T>(name: string) => Promise<T | null>,
) {
  const value = await load<SharedSceneOrchestrationState & { _sync?: { revision?: number } }>('scene-orchestration')
  const revision = value?._sync?.revision
  if (!value || !validateSharedSceneOrchestration(value) || !Number.isSafeInteger(revision) || revision! < 0)
    throw Error('planar-portal-scene-unavailable')
  return { scenes: structuredClone(value.scenes), revision: revision! }
}
