import type {
  MobileActionDescriptorV1,
  MobileActionRegistryV1,
  MobileCharacterView,
  MobilePlayerWorkspace,
  MobileRoomRules,
} from '../../../../packages/mobile-protocol/src'
import { downloadMobileRoomPlugin, type MobileCredentials } from './mobileApi'

export const MOBILE_ACTION_REGISTRY_SCHEMA_VERSION = 1 as const

const coreActions: MobileActionDescriptorV1[] = [
  core('core.weapon-attack', '武器攻击', '⚔', 'action', 'single-creature', { type: 'dnd5e-weapon-attack' }),
  core('core.dash', '疾走', '↟', 'action', 'none', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'dash' } }),
  core('core.disengage', '撤离', '↩', 'action', 'none', { type: 'disengage' }),
  core('core.dodge', '闪避', '◇', 'action', 'none', { type: 'dodge' }),
  core('core.hide', '躲藏', '◐', 'action', 'none', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'hide' } }),
  core('core.ready', '准备', '⌛', 'action', 'none', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'ready', trigger: '由玩家声明，DM裁定', actionKind: 'other' } }),
  core('core.help-attack', '协助攻击', '✦', 'action', 'single-creature', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'help', helpKind: 'attack' } }),
  core('core.help-check', '协助检定', '✦', 'action', 'single-creature', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'help', helpKind: 'ability-check' } }),
  core('core.wake', '唤醒', '!', 'action', 'single-creature', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'wake' } }),
  core('core.grapple', '擒抱', '◎', 'action', 'single-creature', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'grapple', targetDefense: 'athletics' } }),
  core('core.shove', '推撞', '➜', 'action', 'single-creature', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'shove', targetDefense: 'athletics', outcome: 'prone' } }),
  core('core.other-action', '其他（主动）', '…', 'action', 'none', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'other-action' } }),
  core('core.other-bonus-action', '其他（附赠）', '…', 'bonusAction', 'none', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'other-bonus-action' } }),
]

function core(id: string, label: string, icon: string, economy: MobileActionDescriptorV1['economy'], targetKind: MobileActionDescriptorV1['targeting']['kind'], command: Record<string, unknown>): MobileActionDescriptorV1 {
  return { schemaVersion: 1, id, group: 'actions', source: 'core', label, icon, economy, automation: 'full', targeting: { kind: targetKind }, execution: { kind: 'host-command', command } }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function text(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function array(value: unknown) { return Array.isArray(value) ? value : [] }
function cloneJson<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }

function pluginDescriptor(pluginId: string, featureId: string, feature: Record<string, unknown>): MobileActionDescriptorV1 | null {
  const declaredTrigger = record(feature.trigger)
  const declaredTargeting = record(feature.targeting)
  const declaredCost = record(feature.cost)
  const explicitAction = record(feature.action)
  if (!explicitAction && declaredTrigger?.kind !== 'active-use') return null
  const action = explicitAction ?? {
    label: feature.name,
    description: feature.description,
    economy: declaredCost?.economy ?? 'none',
    targeting: declaredTargeting ?? { kind: 'self' },
  }
  if (action.trigger && record(action.trigger)?.kind !== 'active-use') return null
  let automation = ['full', 'partial', 'manual'].includes(String(feature.automation))
    ? feature.automation as MobileActionDescriptorV1['automation'] : 'full'
  if (automation === 'manual') return null
  const targeting = record(action.targeting) ?? { kind: 'self' }
  const kind = ['self', 'single-creature', 'multiple-creatures', 'area'].includes(String(targeting.kind))
    ? targeting.kind as 'self' | 'single-creature' | 'multiple-creatures' | 'area' : 'self'
  // Host V1 intentionally resolves arbitrary multi-target declarations through
  // its safe single-target subset; mobile must not advertise that as full automation.
  if (kind === 'multiple-creatures' && automation === 'full') automation = 'partial'
  const economy = ['action', 'bonusAction', 'reaction', 'none'].includes(String(action.economy))
    ? action.economy as MobileActionDescriptorV1['economy'] : 'none'
  return {
    schemaVersion: 1,
    id: `plugin-action:${featureId}`,
    group: 'features',
    source: 'plugin',
    label: text(action.label) || text(feature.name) || featureId,
    description: text(action.description) || text(feature.summary) || text(feature.description),
    economy,
    automation,
    targeting: {
      kind: kind === 'multiple-creatures' ? 'single-creature' : kind,
      ...(typeof targeting.relation === 'string' ? { relation: targeting.relation as 'any' | 'ally' | 'enemy' } : {}),
      ...(Number.isFinite(Number(targeting.rangeFeet)) ? { rangeFeet: Number(targeting.rangeFeet) } : {}),
      ...(targeting.includeSelf === true ? { includeSelf: true } : {}),
      ...(Number.isInteger(Number(targeting.maximumTargets)) ? { maximumTargets: Number(targeting.maximumTargets) } : {}),
      ...(record(targeting.template) ? { template: cloneJson(targeting.template as Record<string, unknown>) } : {}),
      ...(kind === 'area' && !record(targeting.template) ? { template: {
        shape: text(targeting.shape) || 'circle',
        ...(Number.isFinite(Number(targeting.radiusFeet)) ? { radiusFeet: Number(targeting.radiusFeet) } : {}),
        ...(Number.isFinite(Number(targeting.lengthFeet)) ? { lengthFeet: Number(targeting.lengthFeet) } : {}),
        ...(Number.isFinite(Number(targeting.widthFeet)) ? { widthFeet: Number(targeting.widthFeet) } : {}),
        ...(Number.isFinite(Number(targeting.heightFeet)) ? { heightFeet: Number(targeting.heightFeet) } : {}),
      } } : {}),
    },
    execution: { kind: 'host-command', command: { type: 'dnd5e-plugin-action', dnd5ePluginAction: { featureId } } },
    ownerPluginId: pluginId,
  }
}

type PackageFeatureCandidate = {
  id: string
  feature: Record<string, unknown>
  grants?: Array<
    | { kind: 'subclass'; classId: string; className?: string; subclassId: string; minimumLevel: number }
    | { kind: 'class'; classId: string; className?: string; minimumLevel: number }
    | { kind: 'race'; raceId: string }
  >
}

const coreClassIds = new Set([
  'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
  'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard',
])
const coreClassNames: Record<string, string> = {
  barbarian: '野蛮人', bard: '吟游诗人', cleric: '牧师', druid: '德鲁伊', fighter: '战士', monk: '武僧',
  paladin: '圣武士', ranger: '游侠', rogue: '游荡者', sorcerer: '术士', warlock: '邪术师', wizard: '法师',
}

function packageClassId(pluginId: string, localId: string): string {
  return coreClassIds.has(localId) || localId.includes(':') ? localId : `${pluginId}:${localId}`
}

function classLevel(character: MobileCharacterView | undefined, classId: string, className?: string): number {
  const stored = character?.classLevels?.[classId]
  if (typeof stored === 'number' && Number.isFinite(stored)) return Math.max(0, Math.min(20, Math.floor(stored)))
  const identity = text(character?.charClass).toLowerCase()
  if (identity && [classId.toLowerCase(), text(className).toLowerCase(), text(coreClassNames[classId]).toLowerCase()].some(
    (candidate) => candidate && (identity === candidate || identity.includes(candidate)),
  )) return Math.max(1, Math.min(20, Math.floor(Number(character?.level) || 1)))
  return 0
}

function selectedSubclassId(character: MobileCharacterView | undefined, classId: string): string {
  return classId === 'fighter'
    ? text(character?.dnd5eClassChoices?.fighter?.subclass)
    : text(character?.dnd5eClassChoices?.classes?.[classId]?.subclass)
}

function satisfiesSubclassChoices(
  character: MobileCharacterView | undefined,
  subclassId: string,
  feature: Record<string, unknown>,
): boolean {
  const predicates = record(feature.predicates)
  return array(predicates?.subclassChoices).every((rawRequirement) => {
    const requirement = record(rawRequirement)
    const groupId = text(requirement?.groupId)
    const optionId = text(requirement?.optionId)
    if (!groupId || !optionId) return false
    return character?.classSelections?.[`${subclassId}/${groupId}`]?.includes(optionId) === true
  })
}

function candidateOwned(
  character: MobileCharacterView | undefined,
  owned: ReadonlySet<string>,
  candidate: PackageFeatureCandidate,
): boolean {
  if (!candidate.grants?.length) return owned.has(candidate.id)
  return candidate.grants.some((grant) => {
    if (grant.kind === 'race') {
      const identities = new Set([text(character?.dnd5eRaceId), text(character?.race)])
      return identities.has(grant.raceId)
    }
    if (classLevel(character, grant.classId, grant.className) < grant.minimumLevel) return false
    return grant.kind === 'class' || (
      selectedSubclassId(character, grant.classId) === grant.subclassId &&
      satisfiesSubclassChoices(character, grant.subclassId, candidate.feature)
    )
  }) === true
}

function packageFeatureCandidates(pluginId: string, value: unknown): PackageFeatureCandidate[] {
  const pkg = record(value)
  const manifest = record(pkg?.manifest)
  const content = record(pkg?.content)
  if (pkg?.format !== 'dndstars5e-content' || pkg.schemaVersion !== 2 || manifest?.id !== pluginId || !content) {
    throw new Error('unsupported-plugin-package')
  }
  const result: PackageFeatureCandidate[] = []
  const byId = new Map<string, PackageFeatureCandidate>()
  const classNames = new Map(array(content.classes).flatMap((rawClass) => {
    const definition = record(rawClass)
    return definition && text(definition.id) ? [[packageClassId(pluginId, text(definition.id)), text(definition.name)]] : []
  }))
  for (const raw of array(content.features)) {
    const feature = record(raw)
    if (!feature || !text(feature.id)) continue
    const candidate = { id: `${pluginId}:${text(feature.id)}`, feature }
    result.push(candidate)
    byId.set(candidate.id, candidate)
  }
  for (const raw of array(content.feats)) {
    const feature = record(raw); if (feature && text(feature.id)) result.push({ id: `${pluginId}:feat-${text(feature.id)}`, feature })
  }
  for (const rawRace of array(content.races)) {
    const race = record(rawRace)
    if (!race || !text(race.id)) continue
    const raceId = `${pluginId}:${text(race.id)}`
    for (const rawFeatureId of array(race.grantedFeatureIds)) {
      const featureId = text(rawFeatureId)
      if (!featureId) continue
      const candidate = byId.get(`${pluginId}:${featureId}`)
      if (candidate) candidate.grants = [...(candidate.grants ?? []), { kind: 'race', raceId }]
    }
  }
  for (const rawSubclass of array(content.subclasses)) {
    const subclass = record(rawSubclass); if (!subclass || !text(subclass.id)) continue
    const sourceClassId = packageClassId(pluginId, text(subclass.classId))
    const sourceSubclassId = `${pluginId}:${text(subclass.id)}`
    for (const raw of [...array(subclass.features), ...array(subclass.abilities)]) {
      const feature = record(raw)
      if (!feature || !text(feature.id)) continue
      result.push({
        id: `${pluginId}:${text(subclass.id)}.${text(feature.id)}`,
        feature,
        grants: [{
          kind: 'subclass',
          classId: sourceClassId,
          className: classNames.get(sourceClassId) || undefined,
          subclassId: sourceSubclassId,
          minimumLevel: Math.max(1, Math.min(20, Math.floor(Number(feature.level) || 1))),
        }],
      })
    }
  }
  for (const rawClass of array(content.classes)) {
    const classDefinition = record(rawClass)
    if (!classDefinition || !text(classDefinition.id)) continue
    const sourceClassId = packageClassId(pluginId, text(classDefinition.id))
    for (const rawAdvancement of array(classDefinition.advancements)) {
      const advancement = record(rawAdvancement)
      if (!advancement) continue
      const minimumLevel = Math.max(1, Math.min(20, Math.floor(Number(advancement.level) || 1)))
      for (const rawGrantId of array(advancement.grants)) {
        const grantId = text(rawGrantId)
        const candidate = byId.get(`${pluginId}:${grantId}`)
        if (!candidate) continue
        candidate.grants = [...(candidate.grants ?? []), {
          kind: 'class', classId: sourceClassId, className: text(classDefinition.name) || undefined, minimumLevel,
        }]
      }
    }
  }
  return result
}

const packageCache = new Map<string, Promise<unknown>>()

function cachedRoomPlugin(
  credentials: MobileCredentials,
  requirement: MobileRoomRules['requiredPlugins'][number],
): Promise<unknown> {
  const key = `${credentials.room.roomId}:${requirement.id}:${requirement.integrity}`
  const cached = packageCache.get(key)
  if (cached) return cached
  const pending = downloadMobileRoomPlugin(credentials, requirement)
  packageCache.set(key, pending)
  pending.catch(() => {
    if (packageCache.get(key) === pending) packageCache.delete(key)
  })
  return pending
}

/** Download and validate every required package before claiming room readiness. */
export async function prepareMobileRoomPlugins(
  credentials: MobileCredentials,
  rules: MobileRoomRules,
): Promise<void> {
  await Promise.all(rules.requiredPlugins.map((requirement) => cachedRoomPlugin(credentials, requirement)))
}

export async function buildMobileActionRegistry(input: {
  workspace: Omit<MobilePlayerWorkspace, 'actionRegistry'> | MobilePlayerWorkspace
  credentials: MobileCredentials
  rules: MobileRoomRules | null
  loadPlugin?: (requirement: MobileRoomRules['requiredPlugins'][number]) => Promise<unknown>
}): Promise<MobileActionRegistryV1> {
  const character = input.workspace.characters.find((entry) => entry.id === input.workspace.activeCharacterId) ?? input.workspace.characters[0]
  const owned = new Set([
    ...(character?.dnd5ePluginFeatureIds ?? []),
    ...(character?.dnd5eFeatIds ?? []).map((featId) => {
      const separator = featId.indexOf(':')
      return separator > 0 ? `${featId.slice(0, separator)}:feat-${featId.slice(separator + 1)}` : featId
    }),
  ])
  const rejectedPluginEntries: MobileActionRegistryV1['rejectedPluginEntries'] = []
  const actions = [...coreActions]
  const resolvedOwnedFeatureIds = new Set<string>()
  for (const spell of input.workspace.spells) actions.push({
    schemaVersion: 1, id: `spell:${spell.id}`, group: 'spells', source: 'spell', label: spell.name,
    economy: spell.castingTime === 'bonus-action' ? 'bonusAction' : spell.castingTime === 'reaction' ? 'reaction' : 'action',
    automation: spell.automationLevel, targeting: { kind: spell.area ? 'area' : spell.target === 'ally' && spell.rangeFeet === 0 ? 'self' : 'single-creature', rangeFeet: spell.rangeFeet },
    execution: { kind: 'spell', spellId: spell.id },
  })
  for (const entry of character?.dnd5eInventory?.entries ?? []) for (const use of entry.item.useActions ?? []) actions.push({
    schemaVersion: 1, id: `item:${entry.instanceId}:${use.id}`, group: 'items', source: 'item', label: `${entry.item.name} · ${use.label}`,
    economy: (use.economy === 'bonusAction' ? 'bonusAction' : use.economy === 'reaction' ? 'reaction' : use.economy === 'none' ? 'none' : 'action'),
    automation: 'full', targeting: { kind: 'none' }, execution: { kind: 'item', instanceId: entry.instanceId, useActionId: use.id },
  })
  for (const requirement of input.rules?.member.ready === true ? input.rules.requiredPlugins : []) {
    try {
      const packageValue = await (input.loadPlugin?.(requirement) ?? cachedRoomPlugin(input.credentials, requirement))
      for (const candidate of packageFeatureCandidates(requirement.id, packageValue)) {
        if (!candidateOwned(character, owned, candidate)) continue
        resolvedOwnedFeatureIds.add(candidate.id)
        const descriptor = pluginDescriptor(requirement.id, candidate.id, candidate.feature)
        if (descriptor) actions.push(descriptor)
      }
    } catch (cause) {
      rejectedPluginEntries.push({ pluginId: requirement.id, reason: cause instanceof Error ? cause.message : 'plugin-registry-failed' })
    }
  }
  // Preserve operability for old packages while keeping the Host as the only rules authority.
  for (const featureId of owned) if (
    !resolvedOwnedFeatureIds.has(featureId) &&
    !actions.some((entry) => entry.id === `plugin-action:${featureId}`)
  ) actions.push({
    schemaVersion: 1, id: `plugin-action:${featureId}`, group: 'features', source: 'plugin', label: featureId.split(':').pop()?.replaceAll('-', ' ') || featureId,
    economy: 'action', automation: 'partial', targeting: { kind: 'single-creature', relation: 'any' },
    execution: { kind: 'host-command', command: { type: 'dnd5e-plugin-action', dnd5ePluginAction: { featureId } } },
    ownerPluginId: featureId.split(':')[0],
  })
  return { schemaVersion: MOBILE_ACTION_REGISTRY_SCHEMA_VERSION, generatedAt: Date.now(), actions, rejectedPluginEntries }
}

export function emptyMobileActionRegistry(): MobileActionRegistryV1 {
  return { schemaVersion: 1, generatedAt: Date.now(), actions: [...coreActions], rejectedPluginEntries: [] }
}
