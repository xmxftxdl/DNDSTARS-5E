type SandboxOperation =
  | { kind: 'grant-temporary-hit-points' | 'heal'; targetId: string; amount: number }
  | { kind: 'deal-damage'; targetId: string; amount: number; damageType: string }
  | {
      kind: 'apply-standard-condition'
      targetId: string
      condition: string
      duration: Record<string, unknown>
    }
  | { kind: 'spend-resource'; resourceId: string; amount: number }
  | { kind: 'restore-resource'; resourceId: string; amount: number }

interface SandboxMessageEvent {
  data: {
    type?: string
    requestId?: string
    source?: string
    action?: Record<string, unknown>
    actor?: Record<string, unknown>
    target?: Record<string, unknown>
    targets?: Record<string, unknown>[]
    fromVersion?: number
    state?: unknown
  }
}

interface SandboxWorkerScope {
  postMessage(value: unknown): void
  addEventListener(type: 'message', listener: (event: SandboxMessageEvent) => void): void
  close(): void
}

const scope = self as unknown as SandboxWorkerScope
const nativePostMessage = scope.postMessage.bind(scope)
const NativeFunction = Function
const headlessActions = new Map<string, {
  id: string
  allowOffTurn?: boolean
  rolls?: readonly Record<string, unknown>[]
  resolve(context: Record<string, unknown>): unknown
}>()
const stateMigrations = new Map<number, {
  fromVersion: number
  toVersion: number
  migrate(state: unknown): unknown
}>()
let targetStateSchemaVersion = 1

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function clonePlain<T>(value: T, path = 'value'): T {
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number`)
    return value
  }
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    throw new Error(`${path} must contain only serializable data`)
  }
  if (Array.isArray(value)) return value.map((item, index) => clonePlain(item, `${path}[${index}]`)) as T
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${path} must contain only plain serializable objects`)
  }
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
      throw new Error(`${path} contains a forbidden object key`)
    }
    result[key] = clonePlain(item, `${path}.${key}`)
  }
  return result as T
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item)
  return Object.freeze(value)
}

function hideGlobalCapability(name: string): void {
  let target: object | null = globalThis
  while (target) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name)
    if (descriptor?.configurable) {
      try {
        Object.defineProperty(target, name, { value: undefined, writable: false, configurable: false })
      } catch {
        // A browser may expose a non-overridable descriptor. The own-property shadow below remains the fallback.
      }
    } else if (descriptor?.writable) {
      try {
        Object.defineProperty(target, name, { value: undefined, writable: false, configurable: false })
      } catch {
        // Continue hardening the remaining prototype chain.
      }
    }
    target = Object.getPrototypeOf(target) as object | null
  }
  try {
    Object.defineProperty(globalThis, name, { value: undefined, writable: false, configurable: false })
  } catch {
    // If this fails, the descriptor was already non-configurable and was handled above where possible.
  }
}

function lockFunctionConstructors(): void {
  const denied = function deniedDynamicCode(): never {
    throw new Error('Rules plugin dynamic code generation is disabled')
  }
  const prototypes = [
    Function.prototype,
    Object.getPrototypeOf(async function () {}),
    Object.getPrototypeOf(function* () {}),
    Object.getPrototypeOf(async function* () {}),
  ]
  for (const prototype of prototypes) {
    try {
      Object.defineProperty(prototype, 'constructor', {
        value: denied,
        writable: false,
        configurable: false,
      })
    } catch {
      // A frozen browser intrinsic is already less permissive than a writable one.
    }
  }
  hideGlobalCapability('Function')
  hideGlobalCapability('eval')
}

function lockDownWorkerRealm(): void {
  // WebAssembly remains available for deterministic computation. All browser I/O
  // and cross-context messaging is removed before any plugin top-level code runs.
  for (const name of [
    'fetch',
    'fetchLater',
    'XMLHttpRequest',
    'WebSocket',
    'WebSocketStream',
    'WebTransport',
    'EventSource',
    'RTCPeerConnection',
    'webkitRTCPeerConnection',
    'FontFace',
    'importScripts',
    'indexedDB',
    'caches',
    'localStorage',
    'sessionStorage',
    'navigator',
    'location',
    'Worker',
    'SharedWorker',
    'BroadcastChannel',
    'MessageChannel',
    'postMessage',
    'close',
    'dispatchEvent',
    'addEventListener',
    'removeEventListener',
    'setTimeout',
    'setInterval',
    'Notification',
  ]) hideGlobalCapability(name)
  lockFunctionConstructors()
}

function pluginFactory(source: string): () => unknown {
  if (source.length > 8 * 1024 * 1024) throw new Error('Rules plugin exceeds the 8 MiB sandbox limit')
  if (/\bimport\b/.test(source)) throw new Error('Rules plugins must be a self-contained bundle without imports')
  const defaultExport = /export\s+default\s+([A-Za-z_$][\w$]*)\s*;?\s*$/
  const match = source.match(defaultExport)
  if (!match) throw new Error('Rules plugin must end with `export default <pluginName>`')
  const executable = source.replace(defaultExport, `return ${match[1]}`)
  return NativeFunction(`"use strict";\n${executable}`) as () => unknown
}

function assertId(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/.test(value)) {
    throw new Error(`Invalid ${label}`)
  }
}

function initializePlugin(source: string): {
  manifest: Record<string, unknown>
  features: readonly Record<string, unknown>[]
  actions: readonly { id: string; allowOffTurn?: boolean; rolls?: readonly Record<string, unknown>[] }[]
  races: readonly Record<string, unknown>[]
  backgrounds: readonly Record<string, unknown>[]
  abilityGenerationMethods: readonly Record<string, unknown>[]
  spells: readonly Record<string, unknown>[]
  items: readonly Record<string, unknown>[]
  resources: readonly Record<string, unknown>[]
  subclasses: readonly Record<string, unknown>[]
  migrations: readonly { fromVersion: number; toVersion: number }[]
} {
  const factory = pluginFactory(source)
  lockDownWorkerRealm()
  const candidate = factory()
  if (!candidate || typeof candidate !== 'object') throw new Error('Rules plugin default export is invalid')
  const plugin = candidate as {
    manifest?: Record<string, unknown>
    migrations?: readonly Record<string, unknown>[]
    setup?: (api: Record<string, unknown>) => unknown
  }
  if (!plugin.manifest || typeof plugin.setup !== 'function') throw new Error('Rules plugin requires manifest and setup')
  const manifest = clonePlain(plugin.manifest, 'manifest')
  assertId(manifest.id, 'plugin manifest id')
  const schemaVersion = manifest.stateSchemaVersion ?? 1
  if (!Number.isInteger(schemaVersion) || Number(schemaVersion) < 1 || Number(schemaVersion) > 1_000) {
    throw new Error('Invalid plugin state schema version')
  }
  targetStateSchemaVersion = Number(schemaVersion)
  const migrationDeclarations: { fromVersion: number; toVersion: number }[] = []
  for (const candidateMigration of plugin.migrations ?? []) {
    if (!candidateMigration || typeof candidateMigration !== 'object') throw new Error('Invalid plugin state migration')
    const fromVersion = candidateMigration.fromVersion
    const toVersion = candidateMigration.toVersion
    const migrate = candidateMigration.migrate
    if (
      !Number.isInteger(fromVersion) || !Number.isInteger(toVersion) ||
      Number(fromVersion) < 1 || Number(toVersion) !== Number(fromVersion) + 1 ||
      Number(toVersion) > targetStateSchemaVersion || typeof migrate !== 'function'
    ) throw new Error('Plugin state migrations must be contiguous one-version steps')
    if (stateMigrations.has(Number(fromVersion))) throw new Error(`Duplicate plugin state migration: ${fromVersion}`)
    stateMigrations.set(Number(fromVersion), {
      fromVersion: Number(fromVersion),
      toVersion: Number(toVersion),
      migrate: migrate as (state: unknown) => unknown,
    })
    migrationDeclarations.push({ fromVersion: Number(fromVersion), toVersion: Number(toVersion) })
  }
  migrationDeclarations.sort((left, right) => left.fromVersion - right.fromVersion)
  const features: Record<string, unknown>[] = []
  const races: Record<string, unknown>[] = []
  const backgrounds: Record<string, unknown>[] = []
  const abilityGenerationMethods: Record<string, unknown>[] = []
  const spells: Record<string, unknown>[] = []
  const items: Record<string, unknown>[] = []
  const resources: Record<string, unknown>[] = []
  const subclasses: Record<string, unknown>[] = []
  const api = Object.freeze({
    apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1',
    registerFighterSubclass() {
      throw new Error('Worker sandbox accepts declarative generic features only; fighter subclass callbacks are not allowed')
    },
    registerFeature(definition: unknown) {
      const safe = clonePlain(definition, 'feature') as Record<string, unknown>
      assertId(safe.id, 'feature id')
      features.push(safe)
      return `${manifest.id}:${safe.id}`
    },
    registerResource(definition: unknown) {
      const safe = clonePlain(definition, 'resource') as Record<string, unknown>
      assertId(safe.id, 'resource id')
      resources.push(safe)
      return `${manifest.id}:${safe.id}`
    },
    registerSubclass(definition: unknown) {
      const safe = clonePlain(definition, 'subclass') as Record<string, unknown>
      assertId(safe.id, 'subclass id')
      subclasses.push(safe)
      return `${manifest.id}:${safe.id}`
    },
    registerHeadlessAction(definition: unknown) {
      if (!definition || typeof definition !== 'object') throw new Error('Invalid Headless action definition')
      const action = definition as { id?: unknown; allowOffTurn?: unknown; rolls?: unknown; resolve?: unknown }
      assertId(action.id, 'Headless action id')
      if (typeof action.resolve !== 'function') throw new Error(`Headless action ${action.id} requires resolve()`)
      if (action.allowOffTurn != null && typeof action.allowOffTurn !== 'boolean') {
        throw new Error(`Invalid allowOffTurn value for ${action.id}`)
      }
      if (headlessActions.has(action.id)) throw new Error(`Duplicate Headless action: ${action.id}`)
      const rolls = action.rolls == null ? undefined : clonePlain(action.rolls, `Headless action ${action.id} rolls`)
      if (rolls != null && !Array.isArray(rolls)) throw new Error(`Invalid Headless action rolls: ${action.id}`)
      headlessActions.set(action.id, {
        id: action.id,
        ...(action.allowOffTurn === true ? { allowOffTurn: true } : {}),
        ...(rolls ? { rolls: rolls as readonly Record<string, unknown>[] } : {}),
        resolve: action.resolve as (context: Record<string, unknown>) => unknown,
      })
      return `${manifest.id}:${action.id}`
    },
    registerRace(definition: unknown) {
      const safe = clonePlain(definition, 'race') as Record<string, unknown>
      assertId(safe.id, 'race id')
      races.push(safe)
      return `${manifest.id}:${safe.id}`
    },
    registerBackground(definition: unknown) {
      const safe = clonePlain(definition, 'background') as Record<string, unknown>
      assertId(safe.id, 'background id')
      backgrounds.push(safe)
      return `${manifest.id}:${safe.id}`
    },
    registerAbilityGenerationMethod(definition: unknown) {
      const safe = clonePlain(definition, 'abilityGenerationMethod') as Record<string, unknown>
      assertId(safe.id, 'ability generation method id')
      abilityGenerationMethods.push(safe)
      return `${manifest.id}:${safe.id}`
    },
    registerSpell(definition: unknown) {
      const safe = clonePlain(definition, 'spell') as Record<string, unknown>
      assertId(safe.id, 'spell id')
      spells.push(safe)
      return `${manifest.id}:${safe.id}`
    },
    registerItem(definition: unknown) {
      const safe = clonePlain(definition, 'item') as Record<string, unknown>
      assertId(safe.id, 'item id')
      items.push(safe)
      return `${manifest.id}:${safe.id}`
    },
  })
  const dispose = plugin.setup(api)
  if (dispose != null && typeof dispose !== 'function') throw new Error('Plugin setup must be synchronous')
  return {
    manifest,
    features,
    actions: [...headlessActions.values()].map(({ id, allowOffTurn, rolls }) => ({ id, allowOffTurn, rolls })),
    races,
    backgrounds,
    abilityGenerationMethods,
    spells,
    items,
    resources,
    subclasses,
    migrations: migrationDeclarations,
  }
}

async function migrateState(message: SandboxMessageEvent['data']): Promise<void> {
  const requestId = message.requestId ?? ''
  try {
    const fromVersion = message.fromVersion
    if (!Number.isInteger(fromVersion) || Number(fromVersion) < 1) throw new Error('Invalid source state schema version')
    if (Number(fromVersion) > targetStateSchemaVersion) {
      throw new Error(`Plugin state downgrade is not supported: ${fromVersion} -> ${targetStateSchemaVersion}`)
    }
    let currentVersion = Number(fromVersion)
    let state = clonePlain(message.state, 'state')
    while (currentVersion < targetStateSchemaVersion) {
      const migration = stateMigrations.get(currentVersion)
      if (!migration || migration.toVersion !== currentVersion + 1) {
        throw new Error(`Missing plugin state migration: ${currentVersion} -> ${currentVersion + 1}`)
      }
      state = clonePlain(
        await Promise.resolve(migration.migrate(deepFreeze(clonePlain(state, 'state')))),
        `migration ${migration.fromVersion} -> ${migration.toVersion}`,
      )
      if (JSON.stringify(state).length > 1024 * 1024) throw new Error('Migrated plugin state exceeds 1 MiB')
      currentVersion = migration.toVersion
    }
    nativePostMessage({
      type: 'migrated',
      requestId,
      fromVersion,
      toVersion: targetStateSchemaVersion,
      state,
    })
  } catch (error) {
    nativePostMessage({ type: 'migration-error', requestId, error: errorMessage(error) })
  }
}

async function resolveAction(message: SandboxMessageEvent['data']): Promise<void> {
  const requestId = message.requestId ?? ''
  try {
    const actionId = typeof message.action?.actionId === 'string' ? message.action.actionId : ''
    const definition = headlessActions.get(actionId)
    if (!definition) throw new Error(`Unknown sandbox Headless action: ${actionId}`)
    const operations: SandboxOperation[] = []
    const actorResources = message.actor?.classResources
    const resourceBalances = new Map<string, { current: number; max: number }>()
    if (actorResources && typeof actorResources === 'object' && !Array.isArray(actorResources)) {
      for (const [resourceId, raw] of Object.entries(actorResources)) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
        const state = raw as { current?: unknown; max?: unknown }
        if (
          typeof state.current === 'number' && Number.isFinite(state.current) &&
          typeof state.max === 'number' && Number.isFinite(state.max)
        ) resourceBalances.set(resourceId, { current: state.current, max: state.max })
      }
    }
    const recordOperation = (kind: 'grant-temporary-hit-points' | 'heal', targetId: unknown, amount: unknown): number => {
      if (typeof targetId !== 'string' || !targetId) throw new Error('Headless capability targetId is invalid')
      if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new Error('Headless capability amount is invalid')
      const normalized = Math.max(0, Math.floor(amount))
      operations.push({ kind, targetId, amount: normalized })
      return normalized
    }
    const applyStandardCondition = (targetId: unknown, condition: unknown, duration: unknown): boolean => {
      if (typeof targetId !== 'string' || !targetId) throw new Error('Headless condition targetId is invalid')
      if (typeof condition !== 'string' || !condition) throw new Error('Headless standard condition is invalid')
      const safeDuration = clonePlain(duration, 'condition duration')
      if (!safeDuration || typeof safeDuration !== 'object' || Array.isArray(safeDuration)) {
        throw new Error('Headless condition duration is invalid')
      }
      operations.push({
        kind: 'apply-standard-condition', targetId, condition,
        duration: safeDuration as Record<string, unknown>,
      })
      return true
    }
    const dealDamage = (targetId: unknown, amount: unknown, damageType: unknown): number => {
      if (typeof targetId !== 'string' || !targetId) throw new Error('Headless damage targetId is invalid')
      if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new Error('Headless damage amount is invalid')
      if (typeof damageType !== 'string' || !damageType) throw new Error('Headless damage type is invalid')
      const normalized = Math.max(0, Math.floor(amount))
      operations.push({ kind: 'deal-damage', targetId, amount: normalized, damageType })
      return normalized
    }
    const changeResource = (kind: 'spend-resource' | 'restore-resource', resourceId: unknown, amount: unknown = 1): boolean => {
      if (typeof resourceId !== 'string' || !resourceId) throw new Error('Headless resource id is invalid')
      if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || amount > 1_000_000) {
        throw new Error('Headless resource amount is invalid')
      }
      const balance = resourceBalances.get(resourceId)
      if (!balance || (kind === 'spend-resource' && balance.current < amount)) return false
      balance.current = kind === 'spend-resource'
        ? balance.current - amount
        : Math.min(balance.max, balance.current + amount)
      operations.push({ kind, resourceId, amount })
      return true
    }
    const succeed = () => Object.freeze({ kind: 'success' })
    const fail = (reason: unknown) => Object.freeze({ kind: 'failure', reason: String(reason ?? '') })
    const context = deepFreeze({
      action: clonePlain(message.action ?? {}, 'action'),
      actor: clonePlain(message.actor ?? {}, 'actor'),
      target: message.target ? clonePlain(message.target, 'target') : undefined,
      targets: clonePlain(message.targets ?? [], 'targets'),
      rolls: clonePlain(message.action?.rolls ?? {}, 'rolls'),
      grantTemporaryHitPoints: (targetId: unknown, amount: unknown) =>
        recordOperation('grant-temporary-hit-points', targetId, amount),
      heal: (targetId: unknown, amount: unknown) => recordOperation('heal', targetId, amount),
      dealDamage,
      applyStandardCondition,
      spendResource: (resourceId: unknown, amount?: unknown) => changeResource('spend-resource', resourceId, amount),
      restoreResource: (resourceId: unknown, amount?: unknown) => changeResource('restore-resource', resourceId, amount),
      fail,
      succeed,
    })
    const result = await Promise.resolve(definition.resolve(context)) as { kind?: unknown; reason?: unknown } | undefined
    if (result?.kind === 'failure') {
      nativePostMessage({ type: 'resolved', requestId, ok: false, reason: String(result.reason ?? '') })
      return
    }
    if (result?.kind !== 'success') throw new Error('Headless resolver must return succeed() or fail()')
    if (operations.length > 64) throw new Error('Headless resolver exceeded the 64-operation capability limit')
    nativePostMessage({ type: 'resolved', requestId, ok: true, operations })
  } catch (error) {
    nativePostMessage({ type: 'resolve-error', requestId, error: errorMessage(error) })
  }
}

scope.addEventListener('message', (event) => {
  const message = event.data
  if (message.type === 'init') {
    try {
      const contributions = initializePlugin(message.source ?? '')
      nativePostMessage({ type: 'initialized', contributions })
    } catch (error) {
      nativePostMessage({ type: 'init-error', error: errorMessage(error) })
    }
    return
  }
  if (message.type === 'resolve') void resolveAction(message)
  if (message.type === 'migrate') void migrateState(message)
})
