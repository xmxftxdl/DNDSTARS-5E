import {
  AUTOMATION_PHASES,
  type AutomationCapability,
  type AutomationPhase,
} from '../../../domain/automation/automationCapability'
import type {
  Dnd5eActivityDefinitionV1,
  Dnd5eActivityMechanicOperationV1,
  Dnd5eActivityOperationV1,
  Dnd5eMechanicParameterValueV1,
} from '../activities/dnd5eActivityContracts'
import type {
  Dnd5eActivityActorSnapshot,
  Dnd5eActivityCapabilityProposal,
  Dnd5eActivityExecutionInput,
} from '../activities/dnd5eActivityExecutor'
import {
  DND5E_TRIGGER_EVENT_IDS_V1,
  type Dnd5eEffectModifierV1,
  type Dnd5ePredicateV1,
  type Dnd5eTriggerEventV1,
} from '../activities/dnd5eEffectContracts'
import { dnd5eActivityRequiredPhases } from '../activities/dnd5eActivityValidation'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from '../damageTypes'

export type Dnd5eMechanicHandlerComponentV1 =
  | `activation:${Dnd5eActivityDefinitionV1['activation']['kind']}`
  | `invocation:${'active' | 'triggered'}`
  | `target:${Dnd5eActivityDefinitionV1['target']['kind']}`
  | `check:${NonNullable<Dnd5eActivityDefinitionV1['checks']>[number]['kind']}`
  | `consumption:${NonNullable<Dnd5eActivityDefinitionV1['consumption']>[number]['kind']}`
  | `predicate:${Dnd5ePredicateV1['kind']}`
  | `trigger:${Dnd5eTriggerEventV1}`
  | `operation:${Dnd5eActivityOperationV1['kind']}`
  | `effect-modifier:${Dnd5eEffectModifierV1['kind']}`
  | `effect-duration:${NonNullable<Dnd5eActivityDefinitionV1['effects']>[number]['duration']['kind']}`
  | `effect-lifecycle:${'break-on' | 'escape-check' | 'periodic-damage'}`
  | `mechanic:${string}`
  | `authority:${NonNullable<Dnd5eActivityDefinitionV1['authorityBinding']>['execution']}`

export interface Dnd5eMechanicHandlerRegistrationV1 {
  id: string
  component: Dnd5eMechanicHandlerComponentV1
  phases: readonly AutomationPhase[]
  /** Legacy handlers remain callable only through the loading-boundary adapter. */
  legacyAdapter?: boolean
}

export interface Dnd5eActivityAutomationAnalysisV1 {
  capability: AutomationCapability
  requiredComponents: readonly Dnd5eMechanicHandlerComponentV1[]
  handledComponents: readonly Dnd5eMechanicHandlerComponentV1[]
  missingComponents: readonly Dnd5eMechanicHandlerComponentV1[]
  handlerIds: readonly string[]
  legacyAdapterHandlerIds: readonly string[]
}

export type Dnd5eMechanicParameterFieldV1 =
  | {
      key: string
      label: string
      kind: 'number'
      required?: boolean
      defaultValue?: number
      minimum?: number
      maximum?: number
      integer?: boolean
    }
  | {
      key: string
      label: string
      kind: 'string'
      required?: boolean
      defaultValue?: string
      maximumLength?: number
      pattern?: string
    }
  | {
      key: string
      label: string
      kind: 'boolean'
      required?: boolean
      defaultValue?: boolean
    }
  | {
      key: string
      label: string
      kind: 'select'
      required?: boolean
      defaultValue?: string
      options: readonly { value: string; label: string }[]
    }

export interface Dnd5eMechanicOperationResolutionContextV1 {
  activity: Dnd5eActivityDefinitionV1
  operation: Dnd5eActivityMechanicOperationV1
  execution: Dnd5eActivityExecutionInput
  /** Concrete operation target after actor/target/all-targets expansion. */
  target: Dnd5eActivityActorSnapshot
  critical: boolean
}

export interface Dnd5eMechanicOperationHandlerRegistrationV1 {
  id: string
  label: string
  description: string
  phases: readonly AutomationPhase[]
  parameters: readonly Dnd5eMechanicParameterFieldV1[]
  resolve(
    context: Dnd5eMechanicOperationResolutionContextV1,
  ): readonly Dnd5eActivityCapabilityProposal[]
}

export interface Dnd5eMechanicOperationHandlerDescriptorV1 extends Omit<
  Dnd5eMechanicOperationHandlerRegistrationV1,
  'resolve'
> {}

const handlers = new Map<Dnd5eMechanicHandlerComponentV1, Map<string, Dnd5eMechanicHandlerRegistrationV1>>()
const operationHandlers = new Map<string, Dnd5eMechanicOperationHandlerRegistrationV1>()

function validHandlerId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,159}$/.test(value)
}

export function registerDnd5eMechanicHandlerV1(
  value: Dnd5eMechanicHandlerRegistrationV1,
): { dispose(): void } {
  if (!validHandlerId(value.id) || value.phases.some((phase) => !AUTOMATION_PHASES.includes(phase))) {
    throw new Error(`Invalid D&D 5e mechanic handler: ${value.id}`)
  }
  const bucket = handlers.get(value.component) ?? new Map<string, Dnd5eMechanicHandlerRegistrationV1>()
  if (bucket.has(value.id)) throw new Error(`D&D 5e mechanic handler is already registered: ${value.id}`)
  const token = structuredClone(value)
  bucket.set(value.id, token)
  handlers.set(value.component, bucket)
  return { dispose: () => {
    if (bucket.get(value.id) !== token) return
    bucket.delete(value.id)
    if (bucket.size === 0) handlers.delete(value.component)
  } }
}

export function listDnd5eMechanicHandlersV1(): readonly Dnd5eMechanicHandlerRegistrationV1[] {
  return [...handlers.values()].flatMap((bucket) => [...bucket.values()].map((entry) => structuredClone(entry)))
}

function validParameterField(field: Dnd5eMechanicParameterFieldV1): boolean {
  if (!validHandlerId(field.key) || !field.label.trim() || field.label.length > 120) return false
  if (field.kind === 'number') {
    return (field.defaultValue == null || Number.isFinite(field.defaultValue)) &&
      (field.minimum == null || Number.isFinite(field.minimum)) &&
      (field.maximum == null || Number.isFinite(field.maximum)) &&
      (field.minimum == null || field.maximum == null || field.minimum <= field.maximum)
  }
  if (field.kind === 'string') {
    if (field.maximumLength != null && (!Number.isInteger(field.maximumLength) || field.maximumLength < 1 || field.maximumLength > 10_000)) return false
    if (field.pattern != null) {
      try { new RegExp(field.pattern) } catch { return false }
    }
    return field.defaultValue == null || field.maximumLength == null || field.defaultValue.length <= field.maximumLength
  }
  if (field.kind === 'boolean') return field.defaultValue == null || typeof field.defaultValue === 'boolean'
  return field.options.length >= 1 && field.options.length <= 128 &&
    new Set(field.options.map((option) => option.value)).size === field.options.length &&
    field.options.every((option) => validHandlerId(option.value) && option.label.trim().length > 0) &&
    (field.defaultValue == null || field.options.some((option) => option.value === field.defaultValue))
}

export function registerDnd5eMechanicOperationHandlerV1(
  registration: Dnd5eMechanicOperationHandlerRegistrationV1,
): { dispose(): void } {
  if (
    !validHandlerId(registration.id) || !registration.label.trim() || !registration.description.trim() ||
    registration.label.length > 160 || registration.description.length > 2_000 ||
    registration.phases.length < 1 || registration.phases.some((phase) => !AUTOMATION_PHASES.includes(phase)) ||
    registration.parameters.length > 32 || registration.parameters.some((field) => !validParameterField(field)) ||
    new Set(registration.parameters.map((field) => field.key)).size !== registration.parameters.length ||
    operationHandlers.has(registration.id)
  ) throw new Error(`Invalid D&D 5e mechanic operation handler: ${registration.id}`)
  const coverage = registerDnd5eMechanicHandlerV1({
    id: registration.id,
    component: `mechanic:${registration.id}`,
    phases: [...registration.phases],
  })
  operationHandlers.set(registration.id, registration)
  return { dispose() {
    if (operationHandlers.get(registration.id) !== registration) return
    operationHandlers.delete(registration.id)
    coverage.dispose()
  } }
}

export function listDnd5eMechanicOperationHandlersV1(): readonly Dnd5eMechanicOperationHandlerDescriptorV1[] {
  return [...operationHandlers.values()].map(({ resolve: _resolve, ...descriptor }) => structuredClone(descriptor))
}

export function dnd5eMechanicOperationHandlerDescriptorV1(
  handlerId: string,
): Dnd5eMechanicOperationHandlerDescriptorV1 | undefined {
  const registration = operationHandlers.get(handlerId)
  if (!registration) return undefined
  const { resolve: _resolve, ...descriptor } = registration
  return structuredClone(descriptor)
}

export function defaultDnd5eMechanicOperationParametersV1(
  handlerId: string,
): Readonly<Record<string, Dnd5eMechanicParameterValueV1>> {
  const registration = operationHandlers.get(handlerId)
  if (!registration) return {}
  return Object.fromEntries(registration.parameters.flatMap((field) =>
    field.defaultValue == null ? [] : [[field.key, field.defaultValue] as const]))
}

export function validateDnd5eMechanicOperationParametersV1(
  operation: Dnd5eActivityMechanicOperationV1,
): readonly string[] {
  const registration = operationHandlers.get(operation.handlerId)
  if (!registration) return [`未注册 Host mechanic handler：${operation.handlerId}`]
  const parameters = operation.parameters ?? {}
  const schemaByKey = new Map(registration.parameters.map((field) => [field.key, field]))
  const errors: string[] = []
  for (const key of Object.keys(parameters)) {
    if (!schemaByKey.has(key)) errors.push(`未知 mechanic 参数：${key}`)
  }
  for (const field of registration.parameters) {
    const value = parameters[field.key]
    if (value == null) {
      if (field.required && field.defaultValue == null) errors.push(`缺少 mechanic 参数：${field.key}`)
      continue
    }
    if (field.kind === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value) ||
        (field.integer && !Number.isInteger(value)) ||
        (field.minimum != null && value < field.minimum) ||
        (field.maximum != null && value > field.maximum)) errors.push(`mechanic 参数无效：${field.key}`)
    } else if (field.kind === 'boolean') {
      if (typeof value !== 'boolean') errors.push(`mechanic 参数无效：${field.key}`)
    } else if (field.kind === 'string') {
      if (typeof value !== 'string' || value.length > (field.maximumLength ?? 10_000) ||
        (field.pattern != null && !new RegExp(field.pattern).test(value))) errors.push(`mechanic 参数无效：${field.key}`)
    } else if (typeof value !== 'string' || !field.options.some((option) => option.value === value)) {
      errors.push(`mechanic 参数无效：${field.key}`)
    }
  }
  return errors
}

export function resolveDnd5eMechanicOperationV1(
  context: Dnd5eMechanicOperationResolutionContextV1,
): readonly Dnd5eActivityCapabilityProposal[] {
  const registration = operationHandlers.get(context.operation.handlerId)
  if (!registration) throw new Error(`unregistered D&D 5e mechanic handler: ${context.operation.handlerId}`)
  const errors = validateDnd5eMechanicOperationParametersV1(context.operation)
  if (errors.length) throw new Error(errors.join('; '))
  return registration.resolve(context)
}

function addComponent(
  result: Dnd5eMechanicHandlerComponentV1[],
  component: Dnd5eMechanicHandlerComponentV1,
): void {
  if (!result.includes(component)) result.push(component)
}

function activityComponents(activity: Dnd5eActivityDefinitionV1): readonly Dnd5eMechanicHandlerComponentV1[] {
  const result: Dnd5eMechanicHandlerComponentV1[] = []
  addComponent(result, `activation:${activity.activation.kind}`)
  addComponent(result, `invocation:${activity.invocation?.kind ?? 'active'}`)
  if (activity.invocation?.kind === 'triggered') addComponent(result, `trigger:${activity.invocation.event}`)
  addComponent(result, `target:${activity.target.kind}`)
  for (const predicate of activity.requirements ?? []) addComponent(result, `predicate:${predicate.kind}`)
  for (const choice of activity.choices ?? []) {
    for (const option of choice.options) {
      for (const predicate of option.requirements ?? []) addComponent(result, `predicate:${predicate.kind}`)
    }
  }
  for (const check of activity.checks ?? []) addComponent(result, `check:${check.kind}`)
  for (const consumption of activity.consumption ?? []) addComponent(result, `consumption:${consumption.kind}`)
  const effectById = new Map((activity.effects ?? []).map((effect) => [effect.id, effect]))
  for (const operation of activity.outcomes.flatMap((outcome) => outcome.operations)) {
    if (operation.kind === 'mechanic') addComponent(result, `mechanic:${operation.handlerId}`)
    else addComponent(result, `operation:${operation.kind}`)
    if (operation.kind !== 'apply-effect') continue
    const effect = effectById.get(operation.effectId)
    if (!effect) continue
    addComponent(result, `effect-duration:${effect.duration.kind}`)
    for (const modifier of effect.modifiers ?? []) addComponent(result, `effect-modifier:${modifier.kind}`)
    for (const trigger of effect.triggers ?? []) {
      addComponent(result, `trigger:${trigger.event}`)
      for (const predicate of trigger.predicates ?? []) addComponent(result, `predicate:${predicate.kind}`)
    }
    if (effect.breakOn?.length) addComponent(result, 'effect-lifecycle:break-on')
    if (effect.escapeCheck) addComponent(result, 'effect-lifecycle:escape-check')
    if (effect.periodicDamage) addComponent(result, 'effect-lifecycle:periodic-damage')
  }
  if (activity.authorityBinding) addComponent(result, `authority:${activity.authorityBinding.execution}`)
  return result
}

function componentFallbackPhases(component: Dnd5eMechanicHandlerComponentV1): readonly AutomationPhase[] {
  if (component.startsWith('target:')) return ['targeting']
  if (component.startsWith('check:attack-roll')) return ['attack-roll']
  if (component.startsWith('check:saving-throw')) return ['saving-throw']
  if (component.startsWith('check:')) return ['eligibility']
  if (component.startsWith('consumption:')) return ['cost']
  if (component.startsWith('predicate:')) return ['eligibility']
  if (component.startsWith('trigger:')) return ['interrupt', 'persistence']
  if (component === 'operation:damage') return ['damage']
  if (component === 'operation:healing' || component === 'operation:temporary-hit-points') return ['healing']
  if (component === 'operation:resource') return ['cost']
  if (component === 'operation:manual-adjudication') return ['effects']
  if (component.startsWith('effect-duration:')) return ['duration']
  if (component.startsWith('effect-lifecycle:')) return ['duration', 'persistence']
  if (component.startsWith('mechanic:')) return ['effects', 'persistence']
  if (component.startsWith('effect-modifier:') || component.startsWith('operation:')) return ['effects']
  if (component.startsWith('authority:')) return ['effects', 'persistence']
  if (component.startsWith('invocation:triggered')) return ['interrupt', 'persistence']
  return ['eligibility', 'persistence']
}

/**
 * Computes truth from the Activity graph and currently registered Host handlers.
 * `activity.automation` is intentionally ignored; it is a Legacy adapter field.
 */
export function dnd5eActivityAutomationAnalysisV1(
  activity: Dnd5eActivityDefinitionV1,
): Dnd5eActivityAutomationAnalysisV1 {
  const requiredComponents = activityComponents(activity)
  const handledComponents: Dnd5eMechanicHandlerComponentV1[] = []
  const missingComponents: Dnd5eMechanicHandlerComponentV1[] = []
  const handlerIds = new Set<string>()
  const legacyAdapterHandlerIds = new Set<string>()
  const manualPhases = new Set<AutomationPhase>()
  for (const component of requiredComponents) {
    const registrations = [...(handlers.get(component)?.values() ?? [])]
    if (component === 'operation:manual-adjudication' || registrations.length === 0) {
      missingComponents.push(component)
      componentFallbackPhases(component).forEach((phase) => manualPhases.add(phase))
      continue
    }
    handledComponents.push(component)
    for (const handler of registrations) {
      handlerIds.add(handler.id)
      if (handler.legacyAdapter) legacyAdapterHandlerIds.add(handler.id)
    }
  }
  const requiredPhases = dnd5eActivityRequiredPhases(activity)
  const supportedPhases = requiredPhases.filter((phase) => !manualPhases.has(phase))
  const missing = missingComponents.filter((component) => component !== 'operation:manual-adjudication')
  const hasManualBoundary = missingComponents.includes('operation:manual-adjudication')
  const limitations = [
    ...missing.map((component) => `未注册 Host handler：${component}`),
    ...(hasManualBoundary ? ['Activity 包含显式 DM 裁定 operation。'] : []),
  ]
  const level: AutomationCapability['level'] = limitations.length === 0
    ? 'full'
    : supportedPhases.length === 0
      ? missing.length > 0 ? 'unsupported' : 'dm-adjudication'
      : hasManualBoundary || handledComponents.length > 0
        ? 'assisted'
        : 'dm-adjudication'
  return {
    capability: {
      schemaVersion: 1,
      level,
      supportedPhases: level === 'unsupported' ? [] : supportedPhases,
      manualPhases: [...manualPhases],
      limitations,
    },
    requiredComponents,
    handledComponents,
    missingComponents,
    handlerIds: [...handlerIds],
    legacyAdapterHandlerIds: [...legacyAdapterHandlerIds],
  }
}

export function dnd5eActivityWithDerivedAutomationV1(
  activity: Dnd5eActivityDefinitionV1,
): Dnd5eActivityDefinitionV1 {
  return { ...structuredClone(activity), automation: dnd5eActivityAutomationAnalysisV1(activity).capability }
}

export function dnd5eEffectAutomationAnalysisV1(
  effect: NonNullable<Dnd5eActivityDefinitionV1['effects']>[number],
): AutomationCapability {
  const components: Dnd5eMechanicHandlerComponentV1[] = [`effect-duration:${effect.duration.kind}`]
  for (const modifier of effect.modifiers ?? []) addComponent(components, `effect-modifier:${modifier.kind}`)
  for (const trigger of effect.triggers ?? []) {
    addComponent(components, `trigger:${trigger.event}`)
    for (const predicate of trigger.predicates ?? []) addComponent(components, `predicate:${predicate.kind}`)
  }
  if (effect.breakOn?.length) addComponent(components, 'effect-lifecycle:break-on')
  if (effect.escapeCheck) addComponent(components, 'effect-lifecycle:escape-check')
  if (effect.periodicDamage) addComponent(components, 'effect-lifecycle:periodic-damage')
  const missing = components.filter((component) => !(handlers.get(component)?.size))
  if (missing.length === 0) return {
    schemaVersion: 1,
    level: 'full',
    supportedPhases: effect.duration.kind === 'instantaneous'
      ? ['effects', 'persistence']
      : ['effects', 'duration', 'persistence'],
    manualPhases: [],
    limitations: [],
  }
  return {
    schemaVersion: 1,
    level: 'assisted',
    supportedPhases: ['persistence'],
    manualPhases: ['effects', 'duration'],
    limitations: missing.map((component) => `未注册 Host handler：${component}`),
  }
}

export function dnd5eCombinedAutomationCapabilityV1(input: {
  activities?: readonly Dnd5eActivityDefinitionV1[]
  effects?: readonly NonNullable<Dnd5eActivityDefinitionV1['effects']>[number][]
}): AutomationCapability {
  const capabilities = [
    ...(input.activities ?? []).map((activity) => dnd5eActivityAutomationAnalysisV1(activity).capability),
    ...(input.effects ?? []).map(dnd5eEffectAutomationAnalysisV1),
  ]
  if (capabilities.length === 0) return {
    schemaVersion: 1,
    level: 'display-only',
    supportedPhases: [],
    manualPhases: [...AUTOMATION_PHASES],
    limitations: ['该内容未声明可执行 Activity 或 Effect。'],
  }
  const supported = new Set(capabilities.flatMap((capability) => capability.supportedPhases))
  const manual = new Set(capabilities.flatMap((capability) => capability.manualPhases))
  for (const phase of manual) supported.delete(phase)
  const limitations = [...new Set(capabilities.flatMap((capability) => capability.limitations))]
  const level: AutomationCapability['level'] = capabilities.every((capability) => capability.level === 'full')
    ? 'full'
    : capabilities.every((capability) => capability.level === 'display-only')
      ? 'display-only'
      : supported.size > 0
        ? 'assisted'
        : capabilities.some((capability) => capability.level === 'unsupported')
          ? 'unsupported'
          : 'dm-adjudication'
  return {
    schemaVersion: 1,
    level,
    supportedPhases: level === 'display-only' || level === 'unsupported' ? [] : [...supported],
    manualPhases: [...manual],
    limitations: level === 'full' ? [] : limitations.length ? limitations : ['部分机制需要 DM 裁定。'],
  }
}

function registerCore(component: Dnd5eMechanicHandlerComponentV1, phases: readonly AutomationPhase[]): void {
  registerDnd5eMechanicHandlerV1({
    id: `core.${component.replace(/:/g, '.')}`,
    component,
    phases,
  })
}

for (const kind of ['action', 'bonus-action', 'reaction', 'free', 'movement', 'minute', 'hour', 'passive', 'special'] as const) {
  registerCore(`activation:${kind}`, ['eligibility', 'cost', 'persistence'])
}
registerCore('invocation:active', ['eligibility', 'persistence'])
registerCore('invocation:triggered', ['eligibility', 'interrupt', 'persistence'])
for (const kind of ['self', 'creature', 'area'] as const) registerCore(`target:${kind}`, ['targeting'])
registerCore('check:attack-roll', ['attack-roll'])
registerCore('check:saving-throw', ['saving-throw'])
for (const kind of ['ability-check', 'skill-check', 'concentration-check'] as const) registerCore(`check:${kind}`, ['eligibility'])
for (const kind of ['action-economy', 'spell-slot', 'resource', 'item-charge', 'ammo', 'hit-die', 'hp', 'movement'] as const) {
  registerCore(`consumption:${kind}`, ['cost'])
}
for (const kind of [
  'minimum-level', 'class-level', 'hp-percentage', 'hp-value', 'ability-score', 'condition',
  'illumination', 'target-relation', 'target-identity', 'active-effect', 'distance', 'resource',
  'resource-capacity', 'once-per-turn', 'event-source', 'activity-definition', 'weapon-property',
  'attack-proficiency', 'attack-weapon', 'attack-origin', 'attack-hands', 'attack-mode', 'attack-result', 'attack-outcome', 'damage-type', 'damage-event', 'size-rank', 'creature-type', 'movement-distance', 'movement-property',
  'spell-used', 'skill-used', 'action-economy-available', 'armor-equipped', 'armor-proficiency', 'held-item', 'free-hands',
  'spellcasting-capability', 'choice',
] as const) registerCore(`predicate:${kind}`, ['eligibility'])
for (const event of DND5E_TRIGGER_EVENT_IDS_V1) registerCore(`trigger:${event}`, ['interrupt', 'persistence'])
for (const kind of [
  'damage', 'healing', 'temporary-hit-points', 'stabilize', 'stand-up', 'apply-standard-condition', 'apply-effect',
  'remove-standard-condition', 'remove-effect', 'resource', 'move', 'summon', 'dispel-area',
  'command-owned-companion', 'grant-weapon-attack', 'grant-basic-action', 'create-persistent-area', 'invoke-activity',
] as const) registerCore(`operation:${kind}`, componentFallbackPhases(`operation:${kind}`))
for (const kind of ['instantaneous', 'rounds', 'save-ends', 'concentration', 'permanent'] as const) {
  registerCore(`effect-duration:${kind}`, kind === 'instantaneous' ? ['effects'] : ['effects', 'duration', 'persistence'])
}
for (const kind of [
  'armor-class', 'speed', 'attack-roll', 'attack-target-lock', 'ability-check', 'weapon-damage-roll', 'weapon-enchantment', 'weapon-damage-replacement', 'movement-boundary-save', 'saving-throw',
  'saving-throw-proficiency', 'damage-resistance', 'damage-immunity', 'damage-vulnerability',
  'condition-immunity', 'prohibit-reaction', 'forced-flee-from-source',
  'maximum-attacks-per-turn', 'darkvision', 'flight-speed', 'see-invisible',
  'spell-save-disadvantage-aura', 'spell-action-as-bonus-action', 'attack-profile',
  'damage-reduction', 'on-hit-bonus-damage', 'attack-roll-reroll', 'death-prevention',
] as const) registerCore(`effect-modifier:${kind}`, ['effects', 'persistence'])
for (const kind of ['break-on', 'escape-check', 'periodic-damage'] as const) {
  registerCore(`effect-lifecycle:${kind}`, ['duration', 'persistence'])
}
for (const execution of ['plugin-headless-action', 'headless-event-engine'] as const) {
  registerDnd5eMechanicHandlerV1({
    id: `legacy.authority.${execution}`,
    component: `authority:${execution}`,
    phases: ['effects', 'persistence'],
    legacyAdapter: true,
  })
}

registerDnd5eMechanicOperationHandlerV1({
  id: 'core.event-damage-reflection',
  label: '按事件伤害反射',
  description: '读取权威受伤事件，把其中一部分伤害作为新的确定性伤害返还给 operation 目标。',
  phases: ['damage', 'effects', 'persistence'],
  parameters: [
    { key: 'multiplier', label: '反射倍率', kind: 'number', required: true, defaultValue: 1, minimum: 0, maximum: 100 },
    { key: 'maximum-damage', label: '最大伤害（0=不限）', kind: 'number', defaultValue: 0, minimum: 0, maximum: 1_000_000, integer: true },
    {
      key: 'damage-type', label: '伤害类型', kind: 'select', required: true, defaultValue: 'force',
      options: DND5E_DAMAGE_TYPES.map((value) => ({ value, label: value })),
    },
    { key: 'magical', label: '视为魔法伤害', kind: 'boolean', defaultValue: true },
  ],
  resolve({ operation, execution, target }) {
    const source = execution.triggerContext?.source
    const incomingDamage = source && 'damage' in source ? source.damage?.amount : undefined
    if (incomingDamage == null || incomingDamage <= 0) return []
    const multiplier = Number(operation.parameters?.multiplier ?? 1)
    const maximumDamage = Number(operation.parameters?.['maximum-damage'] ?? 0)
    const rawAmount = Math.max(0, Math.floor(incomingDamage * multiplier))
    const amount = maximumDamage > 0 ? Math.min(rawAmount, maximumDamage) : rawAmount
    if (amount <= 0) return []
    return [{
      kind: 'deal-damage',
      operationId: operation.id,
      targetId: target.id,
      amount,
      damageType: String(operation.parameters?.['damage-type'] ?? 'force') as Dnd5eDamageType,
      magical: operation.parameters?.magical !== false,
    }]
  },
})
