import type {
  Dnd5ePluginAbilityGenerationDefinition,
  Dnd5ePluginAction,
  Dnd5ePluginBackgroundDefinition,
  Dnd5ePluginDiceRollDeclaration,
  Dnd5ePluginFeatureDefinition,
  Dnd5ePluginItemDefinition,
  Dnd5ePluginRaceDefinition,
  Dnd5ePluginResourceDefinition,
  Dnd5ePluginSubclassDefinition,
  Dnd5ePluginSpellDefinition,
  Dnd5eRulesPlugin,
  Dnd5eRulesPluginManifest,
  JsonValue,
} from './pluginApi'
import type { Dnd5eCombatant } from './headlessCombatEngine'
import type { AbilityKey } from '../../lib/dnd'
import type { Dnd5eStandardConditionId } from './conditions'
import type { Dnd5eMonsterStatBlock } from './monsters'

export interface Dnd5eSandboxConditionDuration {
  expiresAt: 'source-next-turn-start' | 'target-next-turn-start' | 'target-turn-end' | 'target-turn-end-save'
  remainingRounds?: number
  saveAbility?: AbilityKey
  saveDc?: number
}

export type Dnd5eSandboxCapabilityOperation =
  | { kind: 'grant-temporary-hit-points'; targetId: string; amount: number }
  | { kind: 'heal'; targetId: string; amount: number }
  | { kind: 'deal-damage'; targetId: string; amount: number; damageType: import('./monsters').Dnd5eDamageType }
  | {
      kind: 'apply-standard-condition'
      targetId: string
      condition: Dnd5eStandardConditionId
      duration: Dnd5eSandboxConditionDuration
    }
  | { kind: 'spend-resource'; resourceId: string; amount: number }
  | { kind: 'restore-resource'; resourceId: string; amount: number }

interface SandboxActionDeclaration {
  id: string
  allowOffTurn?: boolean
  rolls?: readonly Dnd5ePluginDiceRollDeclaration[]
}

export interface Dnd5ePluginStateMigrationDeclaration {
  fromVersion: number
  toVersion: number
}

interface SandboxContributions {
  manifest: Dnd5eRulesPluginManifest
  features: Dnd5ePluginFeatureDefinition[]
  actions: SandboxActionDeclaration[]
  races: Dnd5ePluginRaceDefinition[]
  backgrounds: Dnd5ePluginBackgroundDefinition[]
  abilityGenerationMethods: Dnd5ePluginAbilityGenerationDefinition[]
  spells: Dnd5ePluginSpellDefinition[]
  items: Dnd5ePluginItemDefinition[]
  monsters: Dnd5eMonsterStatBlock[]
  resources: Dnd5ePluginResourceDefinition[]
  subclasses: Dnd5ePluginSubclassDefinition[]
  migrations: Dnd5ePluginStateMigrationDeclaration[]
}

interface SandboxWorkerResponse {
  type?: 'initialized' | 'init-error' | 'resolved' | 'resolve-error' | 'migrated' | 'migration-error'
  requestId?: string
  contributions?: SandboxContributions
  ok?: boolean
  operations?: Dnd5eSandboxCapabilityOperation[]
  reason?: string
  error?: string
  state?: JsonValue
  fromVersion?: number
  toVersion?: number
}

interface PendingResolutionRequest {
  kind: 'resolve'
  resolve(value: Dnd5eSandboxResolution): void
  reject(error: Error): void
  timeout: number
}

interface PendingMigrationRequest {
  kind: 'migrate'
  resolve(value: Dnd5ePluginStateMigrationResult): void
  reject(error: Error): void
  timeout: number
}

type PendingRequest = PendingResolutionRequest | PendingMigrationRequest

export type Dnd5eSandboxResolution =
  | { ok: true; operations: readonly Dnd5eSandboxCapabilityOperation[] }
  | { ok: false; reason: string }

export interface Dnd5ePluginStateMigrationResult {
  state: JsonValue
  fromVersion: number
  toVersion: number
}

export interface Dnd5ePluginSandboxSession {
  readonly manifest: Dnd5eRulesPluginManifest
  readonly features: readonly Dnd5ePluginFeatureDefinition[]
  readonly actions: readonly SandboxActionDeclaration[]
  readonly races: readonly Dnd5ePluginRaceDefinition[]
  readonly backgrounds: readonly Dnd5ePluginBackgroundDefinition[]
  readonly abilityGenerationMethods: readonly Dnd5ePluginAbilityGenerationDefinition[]
  readonly spells: readonly Dnd5ePluginSpellDefinition[]
  readonly items: readonly Dnd5ePluginItemDefinition[]
  readonly monsters: readonly Dnd5eMonsterStatBlock[]
  readonly resources: readonly Dnd5ePluginResourceDefinition[]
  readonly subclasses: readonly Dnd5ePluginSubclassDefinition[]
  readonly migrations: readonly Dnd5ePluginStateMigrationDeclaration[]
  migrateState(fromVersion: number, state: JsonValue): Promise<Dnd5ePluginStateMigrationResult>
  resolve(input: {
    action: Dnd5ePluginAction
    actor: Dnd5eCombatant
    target?: Dnd5eCombatant
    targets?: readonly Dnd5eCombatant[]
  }): Promise<Dnd5eSandboxResolution>
  terminate(): void
}

const activeSessions = new Map<string, Dnd5ePluginSandboxSession>()

function cloneCombatantForSandbox(combatant: Dnd5eCombatant): Record<string, unknown> {
  return {
    id: combatant.id,
    name: combatant.name,
    controller: combatant.controller,
    classId: combatant.classId,
    subclassId: combatant.subclassId,
    level: combatant.level,
    currentHp: combatant.currentHp,
    maxHp: combatant.maxHp,
    temporaryHp: combatant.temporaryHp,
    armorClass: combatant.armorClass,
    speed: combatant.speed,
    proficiencyBonus: combatant.proficiencyBonus,
    abilities: { ...combatant.abilities },
    conditions: [...combatant.conditions],
    classResources: Object.fromEntries(
      Object.entries(combatant.classResources).map(([key, resource]) => [key, { ...resource }]),
    ),
    classSelections: Object.fromEntries(
      Object.entries(combatant.classSelections).map(([key, values]) => [key, [...values]]),
    ),
    position: { ...combatant.position },
  }
}

function validOperation(value: unknown): value is Dnd5eSandboxCapabilityOperation {
  if (!value || typeof value !== 'object') return false
  const operation = value as Partial<Dnd5eSandboxCapabilityOperation>
  if (operation.kind === 'spend-resource' || operation.kind === 'restore-resource') {
    return typeof operation.resourceId === 'string' && !!operation.resourceId &&
      typeof operation.amount === 'number' && Number.isInteger(operation.amount) &&
      operation.amount > 0 && operation.amount <= 1_000_000
  }
  if (operation.kind === 'grant-temporary-hit-points' || operation.kind === 'heal' || operation.kind === 'deal-damage') {
    if (
      operation.kind === 'deal-damage' &&
      (typeof operation.damageType !== 'string' ||
        !['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'].includes(operation.damageType))
    ) return false
    return typeof operation.targetId === 'string' && !!operation.targetId &&
      typeof operation.amount === 'number' && Number.isInteger(operation.amount) &&
      operation.amount >= 0 && operation.amount <= 1_000_000
  }
  if (operation.kind !== 'apply-standard-condition') return false
  const conditionOperation = value as Partial<Extract<Dnd5eSandboxCapabilityOperation, { kind: 'apply-standard-condition' }>>
  const duration = conditionOperation.duration
  if (
    typeof conditionOperation.targetId !== 'string' || !conditionOperation.targetId ||
    !conditionOperation.condition || !duration ||
    !['blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'].includes(conditionOperation.condition) ||
    !['source-next-turn-start', 'target-next-turn-start', 'target-turn-end', 'target-turn-end-save'].includes(duration.expiresAt)
  ) return false
  if (duration.expiresAt === 'target-turn-end' || duration.expiresAt === 'target-turn-end-save') {
    if (!Number.isInteger(duration.remainingRounds) || (duration.remainingRounds ?? 0) < 1 || (duration.remainingRounds ?? 0) > 10_000) return false
  }
  if (duration.expiresAt === 'target-turn-end-save') {
    if (!duration.saveAbility || !['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(duration.saveAbility)) return false
    if (!Number.isInteger(duration.saveDc) || (duration.saveDc ?? 0) < 1 || (duration.saveDc ?? 0) > 40) return false
  }
  return true
}

function validJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 64) return false
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every((item) => validJsonValue(item, depth + 1))
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return false
  return Object.entries(value).every(([key, item]) =>
    key !== '__proto__' && key !== 'prototype' && key !== 'constructor' && validJsonValue(item, depth + 1))
}

function requestId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export async function createDnd5ePluginSandbox(bytes: ArrayBuffer): Promise<Dnd5ePluginSandboxSession> {
  if (typeof Worker !== 'function') throw new Error('当前浏览器不支持规则包 Worker 沙箱')
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  const worker = new Worker(new URL('./pluginSandbox.worker.ts', import.meta.url), {
    type: 'module',
    name: 'dndstars-rules-plugin-sandbox',
  })
  let terminated = false
  let contributions: SandboxContributions | undefined
  let initResolve: ((value: SandboxContributions) => void) | undefined
  let initReject: ((error: Error) => void) | undefined
  const pending = new Map<string, PendingRequest>()
  const initialization = new Promise<SandboxContributions>((resolve, reject) => {
    initResolve = resolve
    initReject = reject
  })
  const initTimeout = window.setTimeout(() => {
    terminate(new Error('规则包初始化超时，Worker 已终止'))
  }, 3_000)

  const rejectAll = (error: Error) => {
    initReject?.(error)
    initReject = undefined
    initResolve = undefined
    for (const request of pending.values()) {
      window.clearTimeout(request.timeout)
      request.reject(error)
    }
    pending.clear()
  }
  function terminate(error?: Error): void {
    if (terminated) return
    terminated = true
    window.clearTimeout(initTimeout)
    worker.terminate()
    rejectAll(error ?? new Error('规则包 Worker 已终止'))
  }

  worker.addEventListener('error', (event) => {
    terminate(new Error(event.message || '规则包 Worker 运行失败'))
  })
  worker.addEventListener('message', (event: MessageEvent<SandboxWorkerResponse>) => {
    const message = event.data
    if (message.type === 'initialized' && message.contributions) {
      window.clearTimeout(initTimeout)
      contributions = message.contributions
      initResolve?.(message.contributions)
      initResolve = undefined
      initReject = undefined
      return
    }
    if (message.type === 'init-error') {
      terminate(new Error(message.error || '规则包初始化失败'))
      return
    }
    const id = message.requestId ?? ''
    const request = pending.get(id)
    if (!request) return
    pending.delete(id)
    window.clearTimeout(request.timeout)
    if (request.kind === 'migrate') {
      if (message.type === 'migration-error') {
        request.reject(new Error(message.error || '规则包状态迁移失败'))
        return
      }
      if (
        message.type !== 'migrated' || !Number.isInteger(message.fromVersion) ||
        !Number.isInteger(message.toVersion) || !validJsonValue(message.state)
      ) {
        request.reject(new Error('规则包 Worker 返回了无效的迁移结果'))
        return
      }
      request.resolve({
        state: message.state,
        fromVersion: Number(message.fromVersion),
        toVersion: Number(message.toVersion),
      })
      return
    }
    if (message.type === 'resolve-error') {
      request.reject(new Error(message.error || '规则包 Headless resolver 失败'))
      return
    }
    if (message.type !== 'resolved') {
      request.reject(new Error('规则包 Worker 返回了无效响应'))
      return
    }
    if (message.ok === false) {
      request.resolve({ ok: false, reason: message.reason || 'invalid-plugin-action' })
      return
    }
    if (
      !Array.isArray(message.operations) || message.operations.length > 64 ||
      !message.operations.every(validOperation)
    ) {
      request.reject(new Error('规则包返回了不允许的 Headless capability 操作'))
      return
    }
    request.resolve({ ok: true, operations: message.operations })
  })
  worker.postMessage({ type: 'init', source })
  const initialized = await initialization

  const session: Dnd5ePluginSandboxSession = {
    get manifest() { return initialized.manifest },
    get features() { return initialized.features },
    get actions() { return initialized.actions },
    get races() { return initialized.races },
    get backgrounds() { return initialized.backgrounds ?? [] },
    get abilityGenerationMethods() { return initialized.abilityGenerationMethods },
    get spells() { return initialized.spells ?? [] },
    get items() { return initialized.items ?? [] },
    get monsters() { return initialized.monsters ?? [] },
    get resources() { return initialized.resources ?? [] },
    get subclasses() { return initialized.subclasses ?? [] },
    get migrations() { return initialized.migrations },
    migrateState(fromVersion, state) {
      if (terminated) return Promise.reject(new Error('规则包 Worker 已终止'))
      if (!Number.isInteger(fromVersion) || fromVersion < 1) {
        return Promise.reject(new Error('规则包状态版本无效'))
      }
      if (!validJsonValue(state)) return Promise.reject(new Error('规则包状态必须是 JSON 数据'))
      const id = requestId()
      return new Promise<Dnd5ePluginStateMigrationResult>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          pending.delete(id)
          terminate(new Error('规则包状态迁移超时，Worker 已终止'))
          reject(new Error('规则包状态迁移超时，Worker 已终止'))
        }, 1_500)
        pending.set(id, { kind: 'migrate', resolve, reject, timeout })
        worker.postMessage({ type: 'migrate', requestId: id, fromVersion, state })
      })
    },
    resolve({ action, actor, target, targets }) {
      if (terminated) return Promise.reject(new Error('规则包 Worker 已终止'))
      const id = requestId()
      return new Promise<Dnd5eSandboxResolution>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          pending.delete(id)
          terminate(new Error('规则包 Headless resolver 超时，Worker 已终止'))
          reject(new Error('规则包 Headless resolver 超时，Worker 已终止'))
        }, 1_500)
        pending.set(id, { kind: 'resolve', resolve, reject, timeout })
        worker.postMessage({
          type: 'resolve',
          requestId: id,
          action: {
            type: action.type,
            pluginId: action.pluginId,
            actionId: action.actionId,
            transactionId: action.transactionId,
            featureId: action.featureId,
            actorId: action.actorId,
            targetId: action.targetId,
            targetIds: action.targetIds,
            targetCell: action.targetCell,
            targetOrientation: action.targetOrientation,
            distanceFeet: action.distanceFeet,
            rolls: action.rolls,
            interruptChoiceId: action.interruptChoiceId,
            payload: action.payload,
          },
          actor: cloneCombatantForSandbox(actor),
          target: target ? cloneCombatantForSandbox(target) : undefined,
          targets: (targets ?? (target ? [target] : [])).map(cloneCombatantForSandbox),
        })
      })
    },
    terminate() {
      terminate()
    },
  }
  void contributions
  return session
}

export function activateDnd5ePluginSandbox(session: Dnd5ePluginSandboxSession): Dnd5eRulesPlugin {
  activeSessions.get(session.manifest.id)?.terminate()
  activeSessions.set(session.manifest.id, session)
  return {
    manifest: session.manifest,
    setup(api) {
      for (const action of session.actions) {
        api.registerHeadlessAction({ ...action, execution: 'worker' })
      }
      for (const feature of session.features) api.registerFeature(feature)
      for (const subclass of session.subclasses) api.registerSubclass(subclass)
      for (const resource of session.resources) api.registerResource(resource)
      for (const race of session.races) api.registerRace(race)
      for (const background of session.backgrounds) api.registerBackground(background)
      for (const method of session.abilityGenerationMethods) api.registerAbilityGenerationMethod(method)
      for (const spell of session.spells) api.registerSpell(spell)
      for (const item of session.items) api.registerItem(item)
      for (const monster of session.monsters) api.registerMonster(monster)
      return () => {
        if (activeSessions.get(session.manifest.id) === session) {
          activeSessions.delete(session.manifest.id)
          session.terminate()
        }
      }
    },
  }
}

export async function resolveDnd5eSandboxedPluginAction(input: {
  action: Dnd5ePluginAction
  actor: Dnd5eCombatant
  target?: Dnd5eCombatant
  targets?: readonly Dnd5eCombatant[]
}): Promise<Dnd5eSandboxResolution> {
  const session = activeSessions.get(input.action.pluginId)
  if (!session) throw new Error(`规则包 ${input.action.pluginId} 的 Worker 未激活`)
  return session.resolve(input)
}

export function terminateDnd5ePluginSandbox(pluginId: string): void {
  const session = activeSessions.get(pluginId)
  if (!session) return
  activeSessions.delete(pluginId)
  session.terminate()
}
