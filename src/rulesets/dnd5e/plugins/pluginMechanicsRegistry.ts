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
import { DND5E_STANDARD_CONDITIONS, DND5E_STANDARD_CONDITION_IDS } from '../conditions'

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
  | `effect-lifecycle:${'break-on' | 'escape-check' | 'escape-saving-throw' | 'on-damage-condition' | 'after-effect-ends' | 'periodic-damage' | 'periodic-healing' | 'body-restoration' | 'calendar-repeat-save' | 'movement-repeat-save' | 'planar-banishment'}`
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

export type Dnd5eMechanicOperationHandlerDescriptorV1 = Omit<
  Dnd5eMechanicOperationHandlerRegistrationV1,
  'resolve'
>

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
  return [...operationHandlers.values()].map(operationHandlerDescriptor)
}

function operationHandlerDescriptor(
  registration: Dnd5eMechanicOperationHandlerRegistrationV1,
): Dnd5eMechanicOperationHandlerDescriptorV1 {
  return structuredClone({
    id: registration.id,
    label: registration.label,
    description: registration.description,
    phases: registration.phases,
    parameters: registration.parameters,
  })
}

export function dnd5eMechanicOperationHandlerDescriptorV1(
  handlerId: string,
): Dnd5eMechanicOperationHandlerDescriptorV1 | undefined {
  const registration = operationHandlers.get(handlerId)
  if (!registration) return undefined
  return operationHandlerDescriptor(registration)
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
    if (operation.kind === 'mechanic') {
      const ruleStateId = operation.handlerId === 'core.rule-state'
        ? operation.parameters?.['state-id']
        : undefined
      addComponent(result, typeof ruleStateId === 'string'
        ? `mechanic:core.rule-state:${ruleStateId}`
        : `mechanic:${operation.handlerId}`)
    }
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
    if (effect.escapeSavingThrow) addComponent(result, 'effect-lifecycle:escape-saving-throw')
    if (effect.onDamageCondition) addComponent(result, 'effect-lifecycle:on-damage-condition')
    if (effect.afterEffectEnds) addComponent(result, 'effect-lifecycle:after-effect-ends')
    if (effect.periodicDamage) addComponent(result, 'effect-lifecycle:periodic-damage')
    if (effect.periodicHealing) addComponent(result, 'effect-lifecycle:periodic-healing')
    if (effect.bodyRestoration) addComponent(result, 'effect-lifecycle:body-restoration')
    if (effect.calendarRepeatSave) addComponent(result, 'effect-lifecycle:calendar-repeat-save')
    if (effect.repeatSaveAfterMovement) addComponent(result, 'effect-lifecycle:movement-repeat-save')
    if (effect.planarBanishment) addComponent(result, 'effect-lifecycle:planar-banishment')
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
  if (component === 'operation:healing' || component === 'operation:temporary-hit-points' || component === 'operation:revive') return ['healing']
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
  if (effect.escapeSavingThrow) addComponent(components, 'effect-lifecycle:escape-saving-throw')
  if (effect.onDamageCondition) addComponent(components, 'effect-lifecycle:on-damage-condition')
  if (effect.afterEffectEnds) addComponent(components, 'effect-lifecycle:after-effect-ends')
  if (effect.periodicDamage) addComponent(components, 'effect-lifecycle:periodic-damage')
  if (effect.periodicHealing) addComponent(components, 'effect-lifecycle:periodic-healing')
  if (effect.bodyRestoration) addComponent(components, 'effect-lifecycle:body-restoration')
  if (effect.calendarRepeatSave) addComponent(components, 'effect-lifecycle:calendar-repeat-save')
  if (effect.repeatSaveAfterMovement) addComponent(components, 'effect-lifecycle:movement-repeat-save')
  if (effect.planarBanishment) addComponent(components, 'effect-lifecycle:planar-banishment')
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
registerCore('check:random-roll', ['eligibility'])
registerCore('check:opposed-ability-check', ['eligibility'])
for (const kind of ['ability-check', 'skill-check', 'concentration-check'] as const) registerCore(`check:${kind}`, ['eligibility'])
for (const kind of ['action-economy', 'spell-slot', 'resource', 'item-charge', 'ammo', 'hit-die', 'hp', 'movement'] as const) {
  registerCore(`consumption:${kind}`, ['cost'])
}
for (const kind of [
  'minimum-level', 'class-level', 'hp-percentage', 'hp-value', 'ability-score', 'condition',
  'illumination', 'airborne-state', 'target-relation', 'target-identity', 'owned-companion', 'can-hear-source', 'active-effect', 'distance', 'resource',
  'resource-capacity', 'once-per-turn', 'event-source', 'activity-definition', 'weapon-property',
  'attack-proficiency', 'attack-weapon', 'attack-origin', 'attack-hands', 'attack-mode', 'attack-result', 'attack-outcome', 'damage-type', 'damage-event', 'size-rank', 'creature-type', 'movement-distance', 'movement-property',
  'spell-used', 'skill-used', 'action-economy-available', 'armor-equipped', 'armor-proficiency', 'held-item', 'free-hands',
  'spellcasting-capability', 'choice',
] as const) registerCore(`predicate:${kind}`, ['eligibility'])
for (const event of DND5E_TRIGGER_EVENT_IDS_V1) registerCore(`trigger:${event}`, ['interrupt', 'persistence'])
for (const kind of [
  'damage', 'healing', 'temporary-hit-points', 'revive', 'stabilize', 'instant-death', 'stand-up', 'apply-standard-condition', 'apply-effect',
  'remove-standard-condition', 'remove-effect', 'remove-effects-by-tag', 'adjust-exhaustion',
  'lower-ability-score', 'recover-ability-score', 'recover-hit-point-maximum', 'resource', 'move', 'set-directional-command', 'summon', 'duplicate-creature', 'dispel-area',
  'relocate-granting-area',
  'reshape-granting-area',
  'set-granting-area-senses',
  'detonate-granting-area',
  'transform-creature', 'grant-extra-turns', 'grant-inventory-item', 'establish-spell-authority', 'identify-inventory-item', 'purify-inventory-item', 'break-inventory-item-attunement',
  'transition-spell-authority',
  'emit-sound', 'open-communication', 'modify-map-object-lock', 'enchant-map-object-light',
  'purify-map-consumables',
  'command-owned-companion', 'grant-weapon-attack', 'grant-basic-action', 'create-persistent-area', 'invoke-activity',
] as const) registerCore(`operation:${kind}`, componentFallbackPhases(`operation:${kind}`))
for (const kind of ['instantaneous', 'rounds', 'save-ends', 'concentration', 'permanent'] as const) {
  registerCore(`effect-duration:${kind}`, kind === 'instantaneous' ? ['effects'] : ['effects', 'duration', 'persistence'])
}
for (const kind of [
  'armor-class', 'attacks-against-source-armor-class', 'speed', 'attack-roll', 'attacks-against-target', 'cannot-be-surprised-while-conscious', 'attack-target-lock', 'ability-check', 'perception-target-lock', 'skill-check-bonus-aura', 'minimum-ability-check-d20', 'weapon-damage-roll', 'weapon-damage-multiplier', 'weapon-enchantment', 'weapon-damage-replacement', 'movement-boundary-save', 'saving-throw', 'death-saving-throw', 'maximize-healing-dice',
  'saving-throw-proficiency', 'damage-resistance', 'conditional-damage-resistance', 'damage-immunity', 'damage-vulnerability',
  'condition-immunity', 'condition-immunity-by-source-creature-type', 'saving-throw-advantage-by-source-creature-type', 'condition-immunity-by-source-magic', 'attacks-against-target-by-creature-type', 'character-capability', 'racial-saving-throw-advantage',
  'prohibit-reaction', 'prevent-actions', 'forced-flee-from-source',
  'maximum-attacks-per-turn', 'restricted-extra-action', 'darkvision', 'climb-speed', 'truesight', 'spell-targeting-immunity',
  'flight-speed', 'magically-held-aloft', 'safe-fall', 'controlled-descent', 'automatic-escape', 'ignore-magical-speed-reductions', 'action-restriction', 'see-invisible', 'emitted-light', 'language-capability', 'language-restriction', 'attack-decoys', 'planar-phase', 'tracking-capability', 'environmental-capability',
  'hit-point-maximum',
  'spell-save-disadvantage-aura', 'spell-action-as-bonus-action', 'attack-profile',
  'damage-reduction', 'on-hit-bonus-damage', 'attack-roll-reroll', 'death-prevention',
] as const) registerCore(`effect-modifier:${kind}`, ['effects', 'persistence'])
for (const kind of ['break-on', 'escape-check', 'escape-saving-throw', 'on-damage-condition', 'after-effect-ends', 'periodic-damage', 'periodic-healing', 'body-restoration', 'calendar-repeat-save', 'movement-repeat-save', 'planar-banishment'] as const) {
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
  id: 'core.resolve-only',
  label: '仅完成结算',
  description: '确认 Activity 已完成，但不写入目标、状态、地图或通讯结果；适用于只消费既定行动资源的通用能力。',
  phases: ['effects'],
  parameters: [],
  resolve() {
    return []
  },
})

registerDnd5eMechanicOperationHandlerV1({
  id: 'core.prismatic-spray',
  label: '虹光喷射光束表',
  description: '按逐目标 d8 结果结算虹光喷射伤害、靛色石化进度与紫色位面放逐。',
  phases: ['effects', 'duration', 'persistence'],
  parameters: [],
  resolve({ operation, execution, target }) {
    const targetCheck = (checkId: string) => execution.resolvedChecks?.find((check) =>
      check.checkId === checkId && check.targetId === target.id)
    const savingThrow = targetCheck('spell-save')
    const primaryRay = targetCheck('prismatic-ray')?.total
    if (!savingThrow || primaryRay == null) throw new Error('prismatic spray checks are incomplete')
    const rays = primaryRay === 8
      ? [
          { ray: targetCheck('prismatic-extra-ray-a')?.total, damageCheckId: 'prismatic-extra-damage-a', suffix: 'a' },
          { ray: targetCheck('prismatic-extra-ray-b')?.total, damageCheckId: 'prismatic-extra-damage-b', suffix: 'b' },
        ]
      : [{ ray: primaryRay, damageCheckId: 'prismatic-primary-damage', suffix: 'primary' }]
    if (rays.some((entry) => entry.ray == null || entry.ray < 1 || entry.ray > 7)) {
      throw new Error('prismatic spray ray table is incomplete')
    }
    const damageTypes: readonly (Dnd5eDamageType | undefined)[] = [
      undefined, 'fire', 'acid', 'lightning', 'poison', 'cold',
    ]
    const proposals: Dnd5eActivityCapabilityProposal[] = []
    const appliedConditions = new Set<number>()
    for (const entry of rays) {
      const ray = entry.ray!
      const damageType = damageTypes[ray]
      if (damageType) {
        const damage = targetCheck(entry.damageCheckId)?.total
        if (damage == null) throw new Error('prismatic spray damage roll is incomplete')
        proposals.push({
          kind: 'deal-damage',
          operationId: `${operation.id}-${entry.suffix}-ray-${ray}`,
          targetId: target.id,
          amount: savingThrow.success
            ? target.successfulSpellSaveNegatesDamage === true ? 0 : Math.floor(damage / 2)
            : damage,
          damageType,
          magical: true,
        })
        continue
      }
      if (savingThrow.success || appliedConditions.has(ray)) continue
      appliedConditions.add(ray)
      const saveDc = Math.max(1, Math.floor(execution.actor.spellSaveDc ?? 8))
      if (ray === 6) {
        proposals.push({
          kind: 'apply-effect',
          operationId: `${operation.id}-${entry.suffix}-indigo`,
          targetId: target.id,
          effectId: 'prismatic-spray-indigo',
          name: '虹光喷射·靛色束缚',
          disposition: 'debuff',
          tags: ['spell', 'prismatic-spray', 'indigo', 'petrification'],
          duration: {
            kind: 'save-ends', maximumRounds: 10, timing: 'target-turn-end',
            ability: 'con', dc: saveDc,
            successesRequired: 3, failuresRequired: 3,
            onFailureThreshold: {
              replaceWithCondition: 'petrified', duration: 'permanent',
            },
          },
          conditions: ['restrained'],
          modifierGroups: [],
          magical: true,
          concentration: false,
          stacking: 'replace',
        })
      } else if (ray === 7) {
        proposals.push({
          kind: 'apply-effect',
          operationId: `${operation.id}-${entry.suffix}-violet`,
          targetId: target.id,
          effectId: 'prismatic-spray-violet',
          name: '虹光喷射·紫色目盲',
          disposition: 'debuff',
          tags: ['spell', 'prismatic-spray', 'violet', 'planar-transport'],
          duration: {
            kind: 'save-ends', maximumRounds: 1, timing: 'target-turn-start',
            ability: 'wis', dc: saveDc,
            successesRequired: 1, failuresRequired: 1,
            onFailureThreshold: {
              // The destination remains a DM narrative decision. Retain the
              // authoritative violet marker and stop further repeat saves.
              outcome: 'retain-effect',
            },
          },
          conditions: ['blinded'],
          extensionCondition: 'prismatic-spray-violet-dm-planar-destination',
          modifierGroups: [],
          magical: true,
          concentration: false,
          stacking: 'replace',
        })
      }
    }
    return proposals
  },
})

registerDnd5eMechanicOperationHandlerV1({
  id: 'core.rule-state',
  label: '持续规则状态',
  description: '在权威目标上写入带来源和生命周期的白名单规则状态；法术、物品、特性与专长共用同一原语。',
  phases: ['effects', 'duration', 'persistence'],
  parameters: [
    {
      key: 'state-id', label: '规则状态 ID', kind: 'string', required: true,
      maximumLength: 160, pattern: '^[a-z0-9][a-z0-9._:-]{0,159}$',
    },
    {
      key: 'duration-kind', label: '持续类型', kind: 'select', required: true,
      defaultValue: 'rounds',
      options: [
        { value: 'rounds', label: '固定轮数' },
        { value: 'concentration', label: '专注' },
        { value: 'permanent', label: '永久/直至解除' },
      ],
    },
    { key: 'duration-rounds', label: '持续轮数', kind: 'number', defaultValue: 1, minimum: 1, maximum: 5_256_000, integer: true },
    {
      key: 'stacking', label: '叠加策略', kind: 'select', defaultValue: 'replace',
      options: [
        { value: 'replace', label: '替换' },
        { value: 'refresh-duration', label: '刷新持续时间' },
        { value: 'stack', label: '允许叠加' },
      ],
    },
    { key: 'magical', label: '魔法来源', kind: 'boolean', defaultValue: true },
  ],
  resolve({ operation, target }) {
    const stateId = String(operation.parameters?.['state-id'] ?? '')
    const durationKind = String(operation.parameters?.['duration-kind'] ?? 'rounds')
    const durationRounds = Math.max(1, Math.floor(Number(operation.parameters?.['duration-rounds'] ?? 1)))
    const duration = durationKind === 'permanent'
      ? { kind: 'permanent' as const }
      : durationKind === 'concentration'
        ? { kind: 'concentration' as const, maximumRounds: durationRounds }
        : { kind: 'rounds' as const, rounds: durationRounds, expiresAt: 'target-turn-end' as const }
    const stackingValue = String(operation.parameters?.stacking ?? 'replace')
    const stacking = stackingValue === 'stack' || stackingValue === 'refresh-duration'
      ? stackingValue
      : 'replace'
    return [{
      kind: 'apply-effect',
      operationId: operation.id,
      targetId: target.id,
      effectId: `rule-state:${stateId}`,
      name: stateId,
      duration,
      conditions: [],
      extensionCondition: `rule-state:${stateId}`,
      modifierGroups: [],
      magical: operation.parameters?.magical !== false,
      concentration: durationKind === 'concentration',
      stacking,
    }]
  },
})

registerDnd5eMechanicOperationHandlerV1({
  id: 'core.turn-end-random-condition',
  label: '回合结束随机状态',
  description: '在每个目标回合结束时要求 Host 掷一次封闭骰表；达到阈值时附加直到其下一回合开始的状态。',
  phases: ['effects', 'duration', 'persistence'],
  parameters: [
    { key: 'die-sides', label: '骰面', kind: 'number', required: true, defaultValue: 20, minimum: 2, maximum: 100, integer: true },
    { key: 'minimum', label: '触发下限', kind: 'number', required: true, defaultValue: 11, minimum: 1, maximum: 100, integer: true },
    {
      key: 'condition', label: '触发状态', kind: 'select', required: true, defaultValue: 'banished',
      options: [
        { value: 'banished', label: '暂离当前位面' },
        ...DND5E_STANDARD_CONDITION_IDS.map((value) => ({
          value, label: DND5E_STANDARD_CONDITIONS[value].label,
        })),
      ],
    },
    { key: 'duration-rounds', label: '机制持续轮数', kind: 'number', required: true, defaultValue: 10, minimum: 1, maximum: 14_400, integer: true },
    {
      key: 'dismiss-action-label', label: '主动解除动作名称', kind: 'string',
      maximumLength: 80,
    },
  ],
  resolve({ operation, target }) {
    const dieSides = Math.floor(Number(operation.parameters?.['die-sides'] ?? 20))
    const minimum = Math.floor(Number(operation.parameters?.minimum ?? 11))
    const condition = String(operation.parameters?.condition ?? 'banished')
    const durationRounds = Math.floor(Number(operation.parameters?.['duration-rounds'] ?? 10))
    const dismissActionLabel = String(operation.parameters?.['dismiss-action-label'] ?? '').trim()
    if (minimum > dieSides) throw new Error('random-condition threshold exceeds die sides')
    return [{
      kind: 'apply-effect', operationId: operation.id, targetId: target.id,
      effectId: `turn-end-random-condition:${operation.id}`, name: operation.id,
      duration: { kind: 'rounds', rounds: durationRounds, expiresAt: 'target-turn-end' },
      conditions: [], modifierGroups: [],
      extensionCondition: `turn-end-random-condition:${dieSides}:${minimum}:${condition}`,
      removalAction: dismissActionLabel ? {
        label: dismissActionLabel,
        economy: 'action',
        maxDistanceFeet: 0,
      } : undefined,
      magical: true, concentration: false, stacking: 'replace',
    }]
  },
})

registerDnd5eMechanicOperationHandlerV1({
  id: 'core.persistent-detection',
  label: '持续侦测',
  description: '在持续时间内由 Host 根据地图距离和权威目标数据返回符合条件的生物、魔法、毒素或疾病存在。',
  phases: ['effects', 'duration', 'persistence'],
  parameters: [
    {
      key: 'mode', label: '侦测类别', kind: 'select', required: true, defaultValue: 'magic',
      options: [
        { value: 'magic', label: '魔法存在与学派' },
        { value: 'planar-creatures', label: '异界/亡灵生物' },
        { value: 'poison-disease', label: '毒素、毒性生物与疾病' },
      ],
    },
    { key: 'range-feet', label: '范围（尺）', kind: 'number', required: true, defaultValue: 30, minimum: 5, maximum: 10_000, integer: true },
    { key: 'duration-rounds', label: '持续轮数', kind: 'number', required: true, defaultValue: 100, minimum: 1, maximum: 14_400, integer: true },
  ],
  resolve({ operation, target }) {
    const mode = String(operation.parameters?.mode ?? 'magic')
    const rangeFeet = Math.floor(Number(operation.parameters?.['range-feet'] ?? 30))
    const durationRounds = Math.floor(Number(operation.parameters?.['duration-rounds'] ?? 100))
    if (!['magic', 'planar-creatures', 'poison-disease'].includes(mode)) {
      throw new Error('unsupported persistent detection mode')
    }
    return [{
      kind: 'apply-effect', operationId: operation.id, targetId: target.id,
      effectId: `persistent-detection:${operation.id}`, name: operation.id,
      grantedActivities: mode === 'magic' ? ['spell:detect-magic:reveal-auras'] : undefined,
      duration: { kind: 'concentration', maximumRounds: durationRounds },
      conditions: [], modifierGroups: [],
      extensionCondition: `persistent-detection:${mode}:${rangeFeet}`,
      magical: true, concentration: true, stacking: 'replace',
    }]
  },
})

registerDnd5eMechanicOperationHandlerV1({
  id: 'core.reveal-persistent-detection',
  label: '显化持续侦测结果',
  description: '确认由持续侦测效果授予的动作；具体目标、可见性、距离与学派由 Host 在提交后的最终权威状态中读取。',
  phases: ['effects', 'persistence'],
  parameters: [],
  resolve() {
    return []
  },
})

registerDnd5eMechanicOperationHandlerV1({
  id: 'core.shared-senses',
  label: '共享伙伴感官',
  description: '在来源下回合开始前，将受 Host 所有权校验的伙伴设为视觉/听觉源，并暂停行动者自身的视觉与听觉。',
  phases: ['effects', 'duration', 'persistence'],
  parameters: [],
  resolve({ operation, execution, target }) {
    const companion = execution.targets[0]
    if (
      !companion || companion.summonedPersistent !== true ||
      companion.summonedSourceCombatantId !== execution.actor.id
    ) throw new Error('shared senses requires an owned persistent companion')
    return [{
      kind: 'apply-effect', operationId: operation.id, targetId: target.id,
      effectId: 'shared-senses', name: '共享感官',
      duration: { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-start' },
      conditions: ['blinded', 'deafened'], modifierGroups: [],
      extensionCondition: `shared-senses-token:${companion.id}`,
      magical: true, concentration: false, stacking: 'replace',
    }]
  },
})

/**
 * Durable state storage is not automation by itself. These exact consumers
 * are registered only after a runtime path reads the state and changes an
 * authoritative result. Unknown/custom states therefore remain assisted.
 */
for (const stateId of [
  'spell:true-strike:target-linked-effect',
  'spell:glibness:minimum-roll',
  'spell:pass-without-trace:source-aura',
  'spell:ray-of-enfeeblement:damage-multiplier',
  'spell:holy-aura:roll-mode-modifier',
  'spell:protection-from-evil-and-good:roll-mode-modifier',
  'spell:stoneskin:damage-resistance',
  'spell:beacon-of-hope:maximum-healing',
] as const) {
  registerDnd5eMechanicHandlerV1({
    id: `core.rule-state.consumer.${stateId.replaceAll(':', '.')}`,
    component: `mechanic:core.rule-state:${stateId}`,
    phases: ['effects', 'persistence'],
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
