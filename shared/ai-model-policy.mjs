export const AI_MODEL_POLICY_VERSION = 1

export const AI_MODEL_POLICY = Object.freeze({
  providerId: 'external-account',
  generalModelId: 'gpt-5.6-luna',
  pdfExtractionModelId: 'gpt-5.6-luna',
  pdfSynthesisModelId: 'gpt-5.6-sol',
  imageModelId: 'gpt-image-2',
  imageQuality: 'low',
})

export const AI_CREDIT_POLICY = Object.freeze({
  creditsPerCny: 100,
  estimateSafetyMultiplier: 1.25,
  reservationBlockCredits: 500,
  textRates: Object.freeze({
    'gpt-5.6-luna': Object.freeze({ inputPerMillion: 1_000, outputPerMillion: 8_000 }),
    'gpt-5.6-sol': Object.freeze({ inputPerMillion: 4_000, outputPerMillion: 30_000 }),
  }),
  imageRates: Object.freeze({
    'gpt-image-2:low': 250,
  }),
})

function finiteNonNegative(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

export function upstreamModelId(modelId) {
  const normalized = String(modelId ?? '').trim()
  if (!normalized) return ''
  const segments = normalized.split(':')
  return segments.at(-1) ?? normalized
}

export function bridgeModelId(role, modelId) {
  const normalized = upstreamModelId(modelId)
  if (!normalized) return ''
  if (role === 'extraction' || role === 'synthesis') return `external:${role}:${normalized}`
  return `external:${normalized}`
}

export function fixedBridgeModelIdForTask(task, phase = 'general') {
  if (task === 'pdf-extraction' || phase === 'pdf-extraction') {
    return bridgeModelId('extraction', AI_MODEL_POLICY.pdfExtractionModelId)
  }
  if (task === 'campaign-analysis' && phase === 'pdf-synthesis') {
    return bridgeModelId('synthesis', AI_MODEL_POLICY.pdfSynthesisModelId)
  }
  return bridgeModelId('general', AI_MODEL_POLICY.generalModelId)
}

export function modelCreditRate(modelId, policy = AI_CREDIT_POLICY) {
  const id = upstreamModelId(modelId)
  const configured = policy?.textRates?.[id]
  return configured ?? { inputPerMillion: 0, outputPerMillion: 0 }
}

export function textCredits(input, policy = AI_CREDIT_POLICY) {
  const rate = modelCreditRate(input.modelId, policy)
  const base = (
    finiteNonNegative(input.inputTokens) * finiteNonNegative(rate.inputPerMillion) +
    finiteNonNegative(input.outputTokens) * finiteNonNegative(rate.outputPerMillion)
  ) / 1_000_000
  const multiplier = input.conservative === false
    ? 1
    : Math.max(1, finiteNonNegative(policy.estimateSafetyMultiplier) || 1)
  return Math.max(base > 0 ? 1 : 0, Math.ceil(base * multiplier))
}

export function imageCredits(input, policy = AI_CREDIT_POLICY) {
  const modelId = upstreamModelId(input.modelId)
  const quality = input.quality === 'low' ? 'low' : AI_MODEL_POLICY.imageQuality
  return Math.max(0, Math.ceil(finiteNonNegative(policy?.imageRates?.[`${modelId}:${quality}`])))
}

export function reserveCredits(estimatedCredits, policy = AI_CREDIT_POLICY) {
  const estimate = Math.max(0, Math.ceil(finiteNonNegative(estimatedCredits)))
  if (estimate === 0) return 0
  const block = Math.max(1, Math.ceil(finiteNonNegative(policy.reservationBlockCredits) || 500))
  return Math.ceil(estimate / block) * block
}

export function creditCny(credits, policy = AI_CREDIT_POLICY) {
  const perCny = Math.max(1, finiteNonNegative(policy.creditsPerCny) || 100)
  return Math.round((finiteNonNegative(credits) / perCny) * 100) / 100
}

