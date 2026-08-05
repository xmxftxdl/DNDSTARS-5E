import type { AiModelDescriptorV1, AiProviderSelectionV1 } from '../../shared/ai-provider.mjs'

export interface ResourceStructuringModelRouteEntryV1 {
  modelId: string
  displayName: string
  tier: 'luna' | 'terra' | 'custom'
}

export interface ResourceStructuringModelRoutingV1 {
  schemaVersion: 1
  providerId: string
  primary: ResourceStructuringModelRouteEntryV1
  fallback?: ResourceStructuringModelRouteEntryV1
  automatic: boolean
}

function supportsResourceStructuring(model: AiModelDescriptorV1): boolean {
  return model.supportedTasks.includes('resource-structuring') &&
    model.capabilities.includes('text-generation') &&
    model.capabilities.includes('structured-output')
}

function modelTier(model: AiModelDescriptorV1): ResourceStructuringModelRouteEntryV1['tier'] {
  const identity = `${model.id} ${model.displayName}`.toLowerCase()
  if (identity.includes('gpt-5.6-luna')) return 'luna'
  if (identity.includes('gpt-5.6-terra')) return 'terra'
  return 'custom'
}

function routeEntry(model: AiModelDescriptorV1): ResourceStructuringModelRouteEntryV1 {
  return {
    modelId: model.id,
    displayName: model.displayName,
    tier: modelTier(model),
  }
}

function preferredTierModel(
  models: readonly AiModelDescriptorV1[],
  tier: ResourceStructuringModelRouteEntryV1['tier'],
  selectedModelId?: string,
): AiModelDescriptorV1 | undefined {
  const candidates = models.filter((model) => modelTier(model) === tier)
  return candidates.find((model) => model.id === selectedModelId) ??
    candidates.find((model) => /^external:gpt-5\.6-/i.test(model.id)) ??
    candidates[0]
}

/**
 * Resource extraction is deliberately tier-aware only for the DM's external
 * account. Other providers keep their explicit model choice and billing policy.
 */
export function selectResourceStructuringModelRouting(
  models: readonly AiModelDescriptorV1[],
  selection: AiProviderSelectionV1,
): ResourceStructuringModelRoutingV1 | null {
  const providerModels = models.filter((model) =>
    model.providerId === selection.providerId && supportsResourceStructuring(model))
  if (providerModels.length === 0) return null

  const selected = providerModels.find((model) => model.id === selection.modelId)
  if (selection.providerId !== 'external-account') {
    const primary = selected ?? providerModels[0]
    return {
      schemaVersion: 1,
      providerId: selection.providerId,
      primary: routeEntry(primary),
      automatic: false,
    }
  }

  const luna = preferredTierModel(providerModels, 'luna', selection.modelId)
  const terra = preferredTierModel(providerModels, 'terra', selection.modelId)
  const primary = luna ?? selected ?? terra ?? providerModels[0]
  const fallback = terra?.id !== primary.id ? terra : undefined
  return {
    schemaVersion: 1,
    providerId: selection.providerId,
    primary: routeEntry(primary),
    ...(fallback ? { fallback: routeEntry(fallback) } : {}),
    automatic: modelTier(primary) === 'luna' && modelTier(fallback ?? primary) === 'terra' && !!fallback,
  }
}
