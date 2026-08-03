export const AI_PROVIDER_SCHEMA_VERSION = 1
export const AI_PROVIDER_SELECTION_SCHEMA_VERSION = 1

const PROVIDER_TRANSPORTS = new Set(['local-bridge', 'platform-server', 'external-server'])
const PROVIDER_STATUSES = new Set(['ready', 'offline', 'unconfigured', 'disabled'])
const DATA_BOUNDARIES = new Set(['local-only', 'cloud-processing'])
const BILLING_MODES = new Set(['free-local', 'platform-credit', 'external-account'])
const TASK_KINDS = new Set([
  'pdf-extraction',
  'campaign-analysis',
  'resource-structuring',
  'map-analysis',
  'transcription',
  'session-summary',
  'prep-recommendations',
])
const STRUCTURED_GENERATION_TASKS = new Set([...TASK_KINDS].filter((task) => task !== 'transcription'))
const CAPABILITIES = new Set([
  'text-generation',
  'structured-output',
  'vision',
  'transcription',
  'embedding',
  'long-context',
  'chinese',
])

const TASK_CAPABILITIES = {
  'pdf-extraction': ['structured-output'],
  'campaign-analysis': ['text-generation', 'structured-output'],
  'resource-structuring': ['structured-output'],
  'map-analysis': ['vision', 'structured-output'],
  transcription: ['transcription'],
  'session-summary': ['text-generation'],
  'prep-recommendations': ['text-generation'],
}

function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function boundedText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function uniqueAllowedStrings(value, allowed, maximum) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((entry) => typeof entry === 'string' && allowed.has(entry)))].slice(0, maximum)
}

function finiteNonNegative(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

function normalizePricing(value) {
  if (!plainObject(value) || !BILLING_MODES.has(value.mode)) return null
  const pricing = {
    mode: value.mode,
    creditsPerMillionInput: finiteNonNegative(value.creditsPerMillionInput),
    creditsPerMillionOutput: finiteNonNegative(value.creditsPerMillionOutput),
    minimumCredits: Math.ceil(finiteNonNegative(value.minimumCredits)),
  }
  if (pricing.mode !== 'platform-credit' && (
    pricing.creditsPerMillionInput !== 0 ||
    pricing.creditsPerMillionOutput !== 0 ||
    pricing.minimumCredits !== 0
  )) return null
  return pricing
}

export function normalizeAiProviderDescriptor(value) {
  if (!plainObject(value) || value.schemaVersion !== AI_PROVIDER_SCHEMA_VERSION) {
    return { ok: false, error: 'invalid-provider-schema' }
  }
  const id = boundedText(value.id, 96)
  const displayName = boundedText(value.displayName, 120)
  const description = boundedText(value.description, 500)
  const transport = boundedText(value.transport, 32)
  const status = boundedText(value.status, 32)
  const dataBoundary = boundedText(value.dataBoundary, 32)
  const capabilities = uniqueAllowedStrings(value.capabilities, CAPABILITIES, CAPABILITIES.size)
  const supportedTasks = uniqueAllowedStrings(value.supportedTasks, TASK_KINDS, TASK_KINDS.size)
  const pricing = normalizePricing(value.pricing)
  if (
    !id || !displayName ||
    !PROVIDER_TRANSPORTS.has(transport) ||
    !PROVIDER_STATUSES.has(status) ||
    !DATA_BOUNDARIES.has(dataBoundary) ||
    capabilities.length !== value.capabilities?.length ||
    supportedTasks.length !== value.supportedTasks?.length ||
    !pricing
  ) return { ok: false, error: 'invalid-provider-descriptor' }
  if (
    (transport === 'local-bridge' && (dataBoundary !== 'local-only' || pricing.mode !== 'free-local')) ||
    (transport === 'platform-server' && (dataBoundary !== 'cloud-processing' || pricing.mode !== 'platform-credit')) ||
    (transport === 'external-server' && (dataBoundary !== 'cloud-processing' || pricing.mode !== 'external-account'))
  ) return { ok: false, error: 'invalid-provider-trust-boundary' }
  return {
    ok: true,
    value: {
      schemaVersion: AI_PROVIDER_SCHEMA_VERSION,
      id,
      displayName,
      description,
      transport,
      status,
      dataBoundary,
      capabilities,
      supportedTasks,
      pricing,
    },
  }
}

export function normalizeAiModelDescriptor(value) {
  if (!plainObject(value) || value.schemaVersion !== AI_PROVIDER_SCHEMA_VERSION) {
    return { ok: false, error: 'invalid-model-schema' }
  }
  const providerId = boundedText(value.providerId, 96)
  const id = boundedText(value.id, 160)
  const displayName = boundedText(value.displayName, 160)
  const capabilities = uniqueAllowedStrings(value.capabilities, CAPABILITIES, CAPABILITIES.size)
  const supportedTasks = uniqueAllowedStrings(value.supportedTasks, TASK_KINDS, TASK_KINDS.size)
  const contextWindowTokens = Math.floor(finiteNonNegative(value.contextWindowTokens))
  if (
    !providerId || !id || !displayName || contextWindowTokens < 1 ||
    capabilities.length !== value.capabilities?.length ||
    supportedTasks.length !== value.supportedTasks?.length
  ) return { ok: false, error: 'invalid-model-descriptor' }
  return {
    ok: true,
    value: {
      schemaVersion: AI_PROVIDER_SCHEMA_VERSION,
      providerId,
      id,
      displayName,
      contextWindowTokens,
      capabilities,
      supportedTasks,
    },
  }
}

export function normalizeAiProviderSelection(value) {
  if (!plainObject(value) || value.schemaVersion !== AI_PROVIDER_SELECTION_SCHEMA_VERSION) {
    return { ok: false, error: 'invalid-provider-selection-schema' }
  }
  const providerId = boundedText(value.providerId, 96)
  const modelId = boundedText(value.modelId, 160)
  const maxCreditsPerTask = Math.floor(finiteNonNegative(value.maxCreditsPerTask))
  if (!providerId || maxCreditsPerTask > 1_000_000) {
    return { ok: false, error: 'invalid-provider-selection' }
  }
  return {
    ok: true,
    value: {
      schemaVersion: AI_PROVIDER_SELECTION_SCHEMA_VERSION,
      providerId,
      ...(modelId ? { modelId } : {}),
      allowPaidFallback: value.allowPaidFallback === true,
      maxCreditsPerTask,
    },
  }
}

export function normalizeAiStructuredGenerationRequest(value) {
  if (!plainObject(value) || value.schemaVersion !== AI_PROVIDER_SCHEMA_VERSION) {
    return { ok: false, error: 'invalid-ai-request-schema' }
  }
  const jobId = boundedText(value.jobId, 128)
  const task = boundedText(value.task, 64)
  const systemPrompt = boundedText(value.systemPrompt, 120_000)
  const userPrompt = boundedText(value.userPrompt, 120_000)
  const maxOutputTokens = value.maxOutputTokens == null ? undefined : Number(value.maxOutputTokens)
  if (!jobId || !STRUCTURED_GENERATION_TASKS.has(task) || !systemPrompt || !userPrompt || !plainObject(value.outputSchema)) {
    return { ok: false, error: 'invalid-ai-request' }
  }
  if (maxOutputTokens != null && (
    !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 256 || maxOutputTokens > 16_384
  )) return { ok: false, error: 'invalid-ai-output-budget' }
  const documents = Array.isArray(value.documents) ? value.documents : []
  const images = Array.isArray(value.images) ? value.images : []
  if (documents.length > 512 || images.length > 32) return { ok: false, error: 'ai-request-too-large' }
  let documentCharacters = 0
  const normalizedDocuments = []
  for (const document of documents) {
    if (!plainObject(document)) return { ok: false, error: 'invalid-ai-document' }
    const id = boundedText(document.id, 128)
    const documentName = boundedText(document.documentName, 500)
    const mimeType = boundedText(document.mimeType, 120)
    if (!id || !documentName || !mimeType || typeof document.text !== 'string' || document.text.length > 2_000_000) {
      return { ok: false, error: 'invalid-ai-document' }
    }
    const pageStart = document.pageStart == null ? undefined : Number(document.pageStart)
    const pageEnd = document.pageEnd == null ? undefined : Number(document.pageEnd)
    if (
      (pageStart != null && (!Number.isSafeInteger(pageStart) || pageStart < 1)) ||
      (pageEnd != null && (!Number.isSafeInteger(pageEnd) || pageEnd < 1)) ||
      (pageStart != null && pageEnd != null && pageEnd < pageStart)
    ) return { ok: false, error: 'invalid-ai-document-pages' }
    documentCharacters += document.text.length
    normalizedDocuments.push({
      id,
      documentName,
      mimeType,
      text: document.text,
      ...(pageStart != null ? { pageStart } : {}),
      ...(pageEnd != null ? { pageEnd } : {}),
    })
  }
  if (documentCharacters > 20_000_000) return { ok: false, error: 'ai-request-too-large' }

  let imageCharacters = 0
  const normalizedImages = []
  for (const image of images) {
    if (!plainObject(image)) return { ok: false, error: 'invalid-ai-image' }
    const id = boundedText(image.id, 128)
    const mimeType = boundedText(image.mimeType, 32)
    if (
      !id || !['image/png', 'image/jpeg', 'image/webp'].includes(mimeType) ||
      typeof image.dataUrl !== 'string' ||
      !image.dataUrl.startsWith(`data:${mimeType};base64,`) ||
      image.dataUrl.length > 10_000_000
    ) return { ok: false, error: 'invalid-ai-image' }
    imageCharacters += image.dataUrl.length
    normalizedImages.push({ id, mimeType, dataUrl: image.dataUrl })
  }
  if (imageCharacters > 64_000_000) return { ok: false, error: 'ai-request-too-large' }
  try {
    if (JSON.stringify(value.outputSchema).length > 250_000) return { ok: false, error: 'ai-request-too-large' }
  } catch {
    return { ok: false, error: 'invalid-ai-output-schema' }
  }
  return {
    ok: true,
    value: {
      schemaVersion: AI_PROVIDER_SCHEMA_VERSION,
      jobId,
      task,
      systemPrompt,
      userPrompt,
      outputSchema: value.outputSchema,
      ...(maxOutputTokens != null ? { maxOutputTokens } : {}),
      ...(normalizedDocuments.length ? { documents: normalizedDocuments } : {}),
      ...(normalizedImages.length ? { images: normalizedImages } : {}),
    },
  }
}

export function aiTaskRequiredCapabilities(task) {
  return TASK_KINDS.has(task) ? [...TASK_CAPABILITIES[task]] : []
}

export function estimateAiProviderCredits(provider, inputTokens, outputTokens) {
  if (provider?.pricing?.mode !== 'platform-credit') return 0
  const input = Math.floor(finiteNonNegative(inputTokens))
  const output = Math.floor(finiteNonNegative(outputTokens))
  const variable = (
    input * finiteNonNegative(provider.pricing.creditsPerMillionInput) +
    output * finiteNonNegative(provider.pricing.creditsPerMillionOutput)
  ) / 1_000_000
  return Math.max(Math.ceil(finiteNonNegative(provider.pricing.minimumCredits)), Math.ceil(variable))
}

function providerSupportsTask(provider, task) {
  if (!provider.supportedTasks.includes(task)) return false
  return aiTaskRequiredCapabilities(task).every((capability) => provider.capabilities.includes(capability))
}

function modelSupportsTask(model, task) {
  if (!model) return true
  if (!model.supportedTasks.includes(task)) return false
  return aiTaskRequiredCapabilities(task).every((capability) => model.capabilities.includes(capability))
}

export function selectAiProvider(input) {
  const selection = normalizeAiProviderSelection(input?.selection)
  if (!selection.ok) return selection
  if (!TASK_KINDS.has(input?.task)) return { ok: false, error: 'unsupported-ai-task' }
  const providers = Array.isArray(input.providers)
    ? input.providers.map(normalizeAiProviderDescriptor).filter((entry) => entry.ok).map((entry) => entry.value)
    : []
  const models = Array.isArray(input.models)
    ? input.models.map(normalizeAiModelDescriptor).filter((entry) => entry.ok).map((entry) => entry.value)
    : []

  const attempt = (provider, requestedModelId, fallback) => {
    if (!provider || provider.status !== 'ready' || !providerSupportsTask(provider, input.task)) return null
    const providerModels = models.filter((model) => model.providerId === provider.id)
    const model = requestedModelId
      ? providerModels.find((candidate) => candidate.id === requestedModelId)
      : providerModels.find((candidate) => modelSupportsTask(candidate, input.task))
    if (requestedModelId && !model) return null
    if (providerModels.length > 0 && (!model || !modelSupportsTask(model, input.task))) return null
    const estimatedCredits = estimateAiProviderCredits(provider, input.estimatedInputTokens, input.estimatedOutputTokens)
    if (provider.pricing.mode === 'platform-credit' && estimatedCredits > selection.value.maxCreditsPerTask) return null
    return {
      ok: true,
      provider,
      ...(model ? { model } : {}),
      estimatedCredits,
      fallback,
    }
  }

  const selectedProvider = providers.find((provider) => provider.id === selection.value.providerId)
  const selected = attempt(selectedProvider, selection.value.modelId, false)
  if (selected) return selected
  if (!selectedProvider) return { ok: false, error: 'provider-not-found' }
  if (!selection.value.allowPaidFallback) {
    if (selectedProvider.status !== 'ready') return { ok: false, error: 'provider-unavailable' }
    return { ok: false, error: 'provider-cannot-run-task' }
  }
  const fallback = providers
    .filter((provider) => provider.id !== selectedProvider.id && provider.pricing.mode === 'platform-credit')
    .map((provider) => attempt(provider, undefined, true))
    .find(Boolean)
  return fallback ?? { ok: false, error: 'paid-fallback-unavailable' }
}
