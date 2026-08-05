export const AUTOMATION_PHASES = Object.freeze([
  'eligibility',
  'cost',
  'targeting',
  'attack-roll',
  'saving-throw',
  'damage',
  'healing',
  'effects',
  'duration',
  'interrupt',
  'persistence',
] as const)

export type AutomationPhase = (typeof AUTOMATION_PHASES)[number]

export type AutomationLevel =
  | 'full'
  | 'assisted'
  | 'dm-adjudication'
  | 'display-only'
  | 'unsupported'

export interface AutomationCapability {
  schemaVersion: 1
  level: AutomationLevel
  supportedPhases: readonly AutomationPhase[]
  manualPhases: readonly AutomationPhase[]
  limitations: readonly string[]
}

export type LegacyAutomationStatus = 'full' | 'partial' | 'manual' | 'reference-only'

const ALL_PHASES = [...AUTOMATION_PHASES]

export function automationCapabilityFromLegacyStatus(
  status: LegacyAutomationStatus,
  reasons: readonly string[] = [],
): AutomationCapability {
  if (status === 'full') {
    return {
      schemaVersion: 1,
      level: 'full',
      supportedPhases: ALL_PHASES,
      manualPhases: [],
      limitations: [],
    }
  }
  if (status === 'partial') {
    return {
      schemaVersion: 1,
      level: 'assisted',
      supportedPhases: ['eligibility', 'cost', 'targeting', 'persistence'],
      manualPhases: ['attack-roll', 'saving-throw', 'damage', 'healing', 'effects', 'duration', 'interrupt'],
      limitations: reasons.length > 0 ? [...reasons] : ['部分结算步骤需要 DM 确认。'],
    }
  }
  if (status === 'manual') {
    return {
      schemaVersion: 1,
      level: 'dm-adjudication',
      supportedPhases: ['eligibility', 'cost', 'targeting', 'persistence'],
      manualPhases: ['attack-roll', 'saving-throw', 'damage', 'healing', 'effects', 'duration', 'interrupt'],
      limitations: reasons.length > 0 ? [...reasons] : ['规则效果必须由 DM 裁定。'],
    }
  }
  return {
    schemaVersion: 1,
    level: 'display-only',
    supportedPhases: [],
    manualPhases: ALL_PHASES,
    limitations: reasons.length > 0 ? [...reasons] : ['当前仅提供资料展示，不进入 Headless 结算。'],
  }
}

export function validateAutomationCapability(capability: AutomationCapability): readonly string[] {
  const errors: string[] = []
  const known = new Set<AutomationPhase>(AUTOMATION_PHASES)
  const supported = new Set(capability.supportedPhases)
  const manual = new Set(capability.manualPhases)
  if (capability.schemaVersion !== 1) errors.push('unsupported automation capability schema')
  for (const phase of [...supported, ...manual]) {
    if (!known.has(phase)) errors.push(`unknown automation phase: ${phase}`)
  }
  for (const phase of supported) {
    if (manual.has(phase)) errors.push(`automation phase cannot be both supported and manual: ${phase}`)
  }
  if (capability.level === 'full' && (manual.size > 0 || capability.limitations.length > 0)) {
    errors.push('full automation cannot declare manual phases or limitations')
  }
  if (capability.level !== 'full' && capability.limitations.length === 0) {
    errors.push('non-full automation must explain its limitations')
  }
  if ((capability.level === 'display-only' || capability.level === 'unsupported') && supported.size > 0) {
    errors.push(`${capability.level} automation cannot declare supported phases`)
  }
  return errors
}
