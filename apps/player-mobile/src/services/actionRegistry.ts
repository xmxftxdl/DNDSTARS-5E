import type {
  MobileActionDescriptorV1,
  MobileActionRegistryV1,
  MobileCharacterView,
  MobilePlayerWorkspace,
  MobileRoomRules,
} from '../../../../packages/mobile-protocol/src'
import type { MobileCredentials } from './mobileApi'
import { mobileRoomPluginPackage } from './mobileRoomPluginRuntime'
import {
  dnd5eSrdSpellHasFullHeadlessAutomation,
  dnd5eSustainedSpellControlLabel,
  getDnd5eSrdCombatSpell,
} from '../../../../src/rulesets/dnd5e'

export { prepareMobileRoomPlugins } from './mobileRoomPluginRuntime'

export const MOBILE_ACTION_REGISTRY_SCHEMA_VERSION = 1 as const

const coreActions: MobileActionDescriptorV1[] = [
  core('core.weapon-attack', '武器攻击', '⚔', 'action', 'single-creature', { type: 'dnd5e-weapon-attack' }),
  core('core.dash', '疾走', '↟', 'action', 'none', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'dash' } }),
  core('core.disengage', '撤离', '↩', 'action', 'none', { type: 'disengage' }),
  core('core.dodge', '闪避', '◇', 'action', 'none', { type: 'dodge' }),
  core('core.hide', '躲藏', '◐', 'action', 'none', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'hide' } }),
  core('core.help-attack', '协助攻击', '✦', 'action', 'single-creature', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'help', helpKind: 'attack' } }),
  core('core.help-check', '协助检定', '✦', 'action', 'single-creature', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'help', helpKind: 'ability-check' } }),
  core('core.wake', '唤醒', '!', 'action', 'single-creature', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'wake' } }),
  core('core.grapple-athletics', '擒抱（目标运动）', '◎', 'action', 'single-creature', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'grapple', targetDefense: 'athletics' } }),
  core('core.grapple-acrobatics', '擒抱（目标杂技）', '◎', 'action', 'single-creature', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'grapple', targetDefense: 'acrobatics' } }),
  core('core.shove-prone-athletics', '推倒（目标运动）', '➜', 'action', 'single-creature', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'shove', targetDefense: 'athletics', outcome: 'prone' } }),
  core('core.shove-prone-acrobatics', '推倒（目标杂技）', '➜', 'action', 'single-creature', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'shove', targetDefense: 'acrobatics', outcome: 'prone' } }),
  core('core.shove-push-athletics', '推开5尺（目标运动）', '➜', 'action', 'single-creature', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'shove', targetDefense: 'athletics', outcome: 'push' } }),
  core('core.shove-push-acrobatics', '推开5尺（目标杂技）', '➜', 'action', 'single-creature', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'shove', targetDefense: 'acrobatics', outcome: 'push' } }),
  core('core.release-grapple', '释放擒抱', '◌', 'none', 'single-creature', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'release-grapple' } }),
  core('core.escape-grapple', '挣脱擒抱', '↯', 'action', 'single-creature', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'escape-grapple' } }),
  core('core.escape-effect', '挣脱束缚效果', '↯', 'action', 'none', { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'escape-effect' } }),
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
  const targeting = record(action.targeting) ?? { kind: 'self' }
  const kind = ['self', 'single-creature', 'multiple-creatures', 'area'].includes(String(targeting.kind))
    ? targeting.kind as 'self' | 'single-creature' | 'multiple-creatures' | 'area' : 'self'
  // Host V1 intentionally resolves arbitrary multi-target declarations through
  // its safe single-target subset; mobile must not advertise that as full automation.
  if (kind === 'multiple-creatures' && automation === 'full') automation = 'partial'
  const economy = ['action', 'bonusAction', 'reaction', 'none'].includes(String(action.economy))
    ? action.economy as MobileActionDescriptorV1['economy'] : 'none'
  const manual = automation === 'manual'
  const declarativeAbility = record(feature.declarativeAbility) ?? feature
  const choices = array(declarativeAbility.choices).flatMap((rawChoice) => {
    const choice = record(rawChoice)
    if (!choice || !text(choice.id) || !text(choice.label)) return []
    const options = array(choice.options).flatMap((rawOption) => {
      const option = record(rawOption)
      return option && text(option.id) && text(option.label)
        ? [{ id: text(option.id), label: text(option.label), description: text(option.description) || undefined }]
        : []
    })
    return options.length ? [{
      id: text(choice.id), label: text(choice.label), options,
      defaultOptionId: text(choice.defaultOptionId) || undefined,
    }] : []
  })
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
    choices: choices.length ? choices : undefined,
    execution: manual
      ? { kind: 'host-command', command: {
          type: 'dnd5e-basic-action',
          dnd5eBasicAction: {
            kind: economy === 'bonusAction' ? 'other-bonus-action' : 'other-action',
            description: `${text(action.label) || text(feature.name) || featureId}：${text(action.description) || text(feature.description) || '由 DM 裁定具体效果。'}`,
          },
        } }
      : { kind: 'host-command', command: { type: 'dnd5e-plugin-action', dnd5ePluginAction: { featureId } } },
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
  const current = pkg?.format === 'dndstars5e-content' && pkg.schemaVersion === 2
  const legacy = pkg?.format === 'dndstars5e-declarative' && pkg.schemaVersion === 1
  if ((!current && !legacy) || manifest?.id !== pluginId) {
    throw new Error('unsupported-plugin-package')
  }
  const currentContent = current ? record(pkg?.content) : undefined
  if (current && !currentContent) throw new Error('unsupported-plugin-package')
  const legacyContent = record(pkg?.legacy) ?? {}
  const content = currentContent
    ? currentContent
    : {
        ...legacyContent,
        classes: array(pkg?.classes),
        subclasses: array(pkg?.subclasses),
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
  const actions = coreActions.map((entry) => ({ ...entry, targeting: { ...entry.targeting }, execution: cloneJson(entry.execution) }))
  const mainWeapon = character?.dnd5eInventory?.entries.find((entry) => entry.equippedSlot === 'mainWeapon')
  const offHandWeapon = character?.dnd5eInventory?.entries.find((entry) => entry.equippedSlot === 'offHand' && entry.item.equipment?.dnd5e && (entry.item.equipment.dnd5e as Record<string, unknown>).kind === 'weapon')
  const ammunition = (character?.dnd5eInventory?.entries ?? []).filter((entry) => /ammunition|弹药|箭|弩矢/i.test(`${entry.item.category} ${entry.item.name}`)).reduce((sum, entry) => sum + entry.quantity, 0)
  const weaponAttack = actions.find((entry) => entry.id === 'core.weapon-attack')
  if (weaponAttack && mainWeapon) {
    weaponAttack.label = mainWeapon.item.name
    weaponAttack.description = `以已装备主手武器攻击。${ammunition > 0 ? `携带弹药 ${ammunition}。` : ''}`
  }
  if (offHandWeapon) actions.push(core(
    'core.off-hand-attack',
    `${offHandWeapon.item.name}（副手）`,
    '⚔',
    'bonusAction',
    'single-creature',
    { type: 'dnd5e-weapon-attack', dnd5eWeaponAttackOptions: { offHandAttack: true } },
  ))
  const actor = input.workspace.scene?.controlledTokens?.find((token) => token.characterId === character?.id)
    ?? input.workspace.scene?.controlledTokens?.[0]
  const turnEconomy = actor ? input.workspace.combat?.turnEconomy?.[actor.id] : undefined
  const turnKey = turnEconomy?.turnKey ?? ''
  for (const grant of character?.combatState?.bonusWeaponAttackGrants ?? []) {
    if (!turnKey || grant.turnKey !== turnKey) continue
    actions.push(core(
      `host-granted-weapon-attack:${grant.id}`,
      grant.label,
      '⚔',
      grant.economy,
      'single-creature',
      { type: 'dnd5e-weapon-attack', dnd5eWeaponAttackOptions: { ...grant.options } },
    ))
  }
  for (const grant of character?.combatState?.basicActionGrants ?? []) {
    if (!turnKey || grant.turnKey !== turnKey) continue
    if (grant.actions.includes('dash')) actions.push(core(
      `host-granted-basic-action:${grant.grantId}:dash`,
      `${grant.label}：疾走`, '↟', 'bonusAction', 'none',
      { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'dash', activityBasicActionGrantId: grant.grantId } },
    ))
    if (grant.actions.includes('grapple')) for (const defense of ['athletics', 'acrobatics'] as const) actions.push(core(
      `host-granted-basic-action:${grant.grantId}:grapple:${defense}`,
      `${grant.label}：擒抱（目标${defense === 'athletics' ? '运动' : '杂技'}）`,
      '◎', 'bonusAction', 'single-creature',
      { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'grapple', targetDefense: defense, activityBasicActionGrantId: grant.grantId } },
    ))
    if (grant.actions.includes('shove')) for (const outcome of ['prone', 'push'] as const) actions.push(core(
      `host-granted-basic-action:${grant.grantId}:shove:${outcome}`,
      `${grant.label}：${outcome === 'prone' ? '推倒' : '推开'}${outcome === 'push' && grant.shovePushDistanceBonusFeet ? `（额外 ${grant.shovePushDistanceBonusFeet} 尺）` : ''}`,
      '➜', 'bonusAction', 'single-creature',
      { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'shove', targetDefense: 'athletics', outcome, activityBasicActionGrantId: grant.grantId } },
    ))
  }
  const recall = character?.combatState?.linkedEquipmentRecall
  if (recall) actions.push(core(
    'feature.linked-equipment-recall', `召回${recall.weaponName}`, '✦', 'bonusAction', 'self',
    { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'linked-equipment-recall', weaponId: recall.weaponId } },
  ))
  const teleport = character?.combatState?.extraActionTeleport
  if (teleport && turnKey && teleport.turnKey === turnKey && teleport.usedTurnKey !== turnKey) actions.push({
    schemaVersion: 1,
    id: 'feature.extra-action-teleport',
    group: 'features',
    source: 'class-feature',
    label: '额外动作传送',
    description: `动作如潮已开启；在地图选择 ${teleport.rangeFeet} 尺内未占据落点。`,
    icon: '✦', economy: 'none', automation: 'full',
    targeting: { kind: 'area', rangeFeet: teleport.rangeFeet },
    execution: { kind: 'host-command', command: {
      type: 'dnd5e-class-feature',
      dnd5eClassFeature: { feature: 'feature-extra-action-teleport' },
    } },
  })
  for (const shapeAction of character?.wildShapeActions ?? []) actions.push(core(
    `core.wild-shape-attack.${shapeAction.index}`,
    `${shapeAction.name}（荒野变形）`,
    '⚔',
    'action',
    'single-creature',
    { type: 'dnd5e-weapon-attack', dnd5eWeaponAttackOptions: { wildShapeActionIndex: shapeAction.index } },
  ))
  if (character?.combatState?.raging && character.combatState.frenzying &&
    character.combatState.frenzyStartedTurnKey !== turnEconomy?.turnKey && character.weaponProfile?.mode === 'melee') {
    actions.push(core('core.frenzy-attack', '狂乱附赠攻击', '⚔', 'bonusAction', 'single-creature', {
      type: 'dnd5e-weapon-attack', dnd5eWeaponAttackOptions: { frenzyAttack: true },
    }))
  }
  if (character?.combatState?.hordeBreakerOpportunityTurnKey &&
    character.combatState.hordeBreakerOpportunityTurnKey === turnEconomy?.turnKey &&
    character.combatState.hordeBreakerUsedTurnKey !== turnEconomy?.turnKey) {
    actions.push(core('core.horde-breaker-attack', '灭群者追加攻击', '⚔', 'none', 'single-creature', {
      type: 'dnd5e-weapon-attack', dnd5eWeaponAttackOptions: { hordeBreakerAttack: true },
    }))
  }
  const rangerMultiattack = character?.dnd5eClassChoices?.classes?.ranger?.selections?.multiattack?.[0]
  if ((character?.classLevels?.ranger ?? 0) >= 11 && (rangerMultiattack === 'volley' || rangerMultiattack === 'whirlwind-attack')) {
    actions.push(core(`core.hunter-multiattack.${rangerMultiattack}`, rangerMultiattack === 'volley' ? '万箭齐发' : '旋风攻击', '◎', 'action', 'single-creature', {
      type: 'dnd5e-weapon-attack', dnd5eWeaponAttackOptions: { hunterMultiattack: rangerMultiattack },
    }))
  }
  for (const area of input.workspace.scene?.persistentAreas ?? []) {
    if (area.sourceCharacterId !== character?.id || !area.movement) continue
    actions.push({
      schemaVersion: 1,
      id: `persistent-area-move:${area.id}`,
      group: 'features',
      source: 'class-feature',
      label: `移动${area.label}`,
      description: `消耗${area.movement.economy === 'bonus-action' ? '附赠动作' : '动作'}，在地图上选择新落点（最多 ${area.movement.maximumFeet} 尺）。距离、碰撞、墙门与行动经济由 Host 重新验证。`,
      icon: '◎',
      economy: area.movement.economy === 'bonus-action' ? 'bonusAction' : 'action',
      automation: 'full',
      targeting: { kind: 'area', rangeFeet: area.movement.maximumFeet },
      execution: {
        kind: 'host-command',
        command: { type: 'dnd5e-persistent-area-move', dnd5ePersistentAreaMove: { areaId: area.id } },
      },
    })
  }
  for (const control of character?.sustainedSpellControls ?? []) {
    if (!dnd5eSrdSpellHasFullHeadlessAutomation(control.spellId)) continue
    actions.push({
      schemaVersion: 1,
      id: `sustained-spell:${control.spellId}:${control.id}`,
      group: 'features',
      source: 'spell',
      label: control.label,
      description: control.description,
      icon: '✧',
      economy: control.economy === 'bonusAction' ? 'bonusAction' : 'action',
      automation: 'full',
      targeting: { kind: control.targeting },
      execution: control.id === 'expeditious-retreat'
        ? { kind: 'host-command', command: {
            type: 'dnd5e-basic-action',
            dnd5eBasicAction: { kind: 'dash', sourceSpellId: 'expeditious-retreat' },
          } }
        : { kind: 'host-command', command: {
            type: 'dnd5e-spell-cast',
            dnd5eSpellCast: {
              spellId: control.spellId,
              slotLevel: control.slotLevel,
              sustainedEffectAttack: control.id,
              ...(control.castingClassId ? { castingClassId: control.castingClassId } : {}),
            },
          } },
    })
  }
  for (const area of input.workspace.scene?.persistentAreas ?? []) {
    if (
      area.sourceKind !== 'core-spell' || area.sourceCharacterId !== character?.id ||
      !area.coreSpellId || area.slotLevel == null
    ) continue
    const spell = getDnd5eSrdCombatSpell(area.coreSpellId)
    const control = spell?.sustainedAttack
    if (!spell || !dnd5eSrdSpellHasFullHeadlessAutomation(spell.id) || !control || control.origin === 'caster') continue
    actions.push({
      schemaVersion: 1,
      id: `sustained-spell:${area.id}:${control.id}`,
      group: 'features',
      source: 'spell',
      label: dnd5eSustainedSpellControlLabel(control.id),
      description: `${control.economy === 'bonus-action' ? '附赠动作' : '动作'} · 操控地图上的现有法术实体，不消耗法术位。`,
      icon: '✧',
      economy: control.economy === 'bonus-action' ? 'bonusAction' : 'action',
      automation: 'full',
      targeting: { kind: control.resolution === 'saving-throw' ? 'area' : 'single-creature' },
      execution: { kind: 'host-command', command: {
        type: 'dnd5e-spell-cast',
        dnd5eSpellCast: {
          spellId: spell.id,
          slotLevel: area.slotLevel,
          sustainedEffectAttack: control.id,
          sustainedEffectAreaId: area.id,
          ...(area.castingClassId ? { castingClassId: area.castingClassId } : {}),
        },
      } },
    })
  }
  for (const grant of character?.alternateResourceSpells ?? []) {
    const coreSpell = getDnd5eSrdCombatSpell(grant.spellId)
    if (!grant.headless || (coreSpell && !dnd5eSrdSpellHasFullHeadlessAutomation(coreSpell.id))) continue
    for (const option of grant.castLevelOptions) actions.push({
      schemaVersion: 1,
      id: `alternate-resource-spell:${grant.featureId}:${grant.grantId}:${option.slotLevel}`,
      group: 'features',
      source: 'plugin',
      label: `${grant.spellName}${grant.castLevelOptions.length > 1 ? `（${option.slotLevel}环）` : ''}`,
      description: `${grant.featureName} · 消耗 ${option.resourceCost} 点 ${grant.resourceId}；资格、资源和法术效果由 Host 复核。`,
      icon: '✧',
      economy: grant.economy,
      automation: 'full',
      targeting: { kind: grant.targeting, rangeFeet: grant.rangeFeet },
      execution: { kind: 'host-command', command: {
        type: 'dnd5e-spell-cast',
        dnd5eSpellCast: {
          spellId: grant.spellId,
          slotLevel: option.slotLevel,
          alternateResourceSpell: { featureId: grant.featureId, grantId: grant.grantId },
        },
      } },
      ownerPluginId: grant.featureId.split(':')[0],
    })
  }
  const resolvedOwnedFeatureIds = new Set<string>()
  for (const spell of input.workspace.spells) actions.push({
    schemaVersion: 1, id: `spell:${spell.id}`, group: 'spells', source: 'spell', label: spell.name,
    economy: spell.castingTime === 'bonus-action' ? 'bonusAction' : spell.castingTime === 'reaction' ? 'reaction' : 'action',
    automation: spell.automationLevel, targeting: { kind: spell.area ? 'area' : spell.target === 'ally' && spell.rangeFeet === 0 ? 'self' : 'single-creature', rangeFeet: spell.rangeFeet },
    execution: { kind: 'spell', spellId: spell.id },
  })
  for (const entry of character?.dnd5eInventory?.entries ?? []) for (const use of entry.item.useActions ?? []) {
    const targeting = record(use.targeting)
    const targetKind = targeting?.kind === 'creature'
      ? 'single-creature'
      : targeting?.kind === 'map-area'
        ? 'area'
        : targeting?.kind === 'self'
          ? 'self'
          : 'none'
    const magicItem = record(entry.item.magicItem)
    actions.push({
      schemaVersion: 1, id: `item:${entry.instanceId}:${use.id}`, group: 'items', source: 'item', label: `${entry.item.name} · ${use.label}`,
      economy: (use.economy === 'bonusAction' ? 'bonusAction' : use.economy === 'reaction' ? 'reaction' : use.economy === 'none' ? 'none' : 'action'),
      automation: magicItem?.automation === 'headless' || record(use.effect) ? 'full' : 'manual',
      targeting: {
        kind: targetKind,
        ...(Number.isFinite(Number(targeting?.rangeFeet)) ? { rangeFeet: Number(targeting?.rangeFeet) } : {}),
      },
      execution: { kind: 'item', instanceId: entry.instanceId, useActionId: use.id },
    })
  }
  for (const requirement of input.rules?.member.ready === true ? input.rules.requiredPlugins : []) {
    try {
      const packageValue = input.loadPlugin
        ? await input.loadPlugin(requirement)
        : mobileRoomPluginPackage(requirement)
      if (!packageValue) throw new Error('plugin-runtime-not-active')
      for (const candidate of packageFeatureCandidates(requirement.id, packageValue)) {
        const featureAction = record(candidate.feature.action)
        const areaGrants = (input.workspace.scene?.persistentAreas ?? []).filter((area) =>
          area.sourceCharacterId === character?.id &&
          area.ownerPluginId === requirement.id &&
          area.grantedActivities?.some((grant) => grant.activityId === text(featureAction?.id)),
        )
        const directlyOwned = candidateOwned(character, owned, candidate)
        if (!directlyOwned && areaGrants.length === 0) continue
        if (directlyOwned) resolvedOwnedFeatureIds.add(candidate.id)
        const descriptor = pluginDescriptor(requirement.id, candidate.id, candidate.feature)
        if (descriptor && directlyOwned) actions.push(descriptor)
        if (descriptor?.execution.kind === 'host-command') for (const area of areaGrants) {
          const command = cloneJson(descriptor.execution.command)
          const pluginAction = record(command.dnd5ePluginAction) ?? {}
          command.dnd5ePluginAction = {
            ...pluginAction,
            payload: { persistentAreaId: area.id },
          }
          actions.push({
            ...descriptor,
            id: `${descriptor.id}:area:${area.id}`,
            label: `${area.label} · ${descriptor.label}`,
            execution: { kind: 'host-command', command },
          })
        }
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

/**
 * A room projection may briefly contain an empty registry while its plugin
 * packages are being verified. Core actions are still safe to advertise: the
 * mobile client only submits their intent and the Host revalidates ownership,
 * action economy, targets and resources before committing anything.
 */
export function mobileBasicActionDescriptors(registry?: MobileActionRegistryV1): MobileActionDescriptorV1[] {
  const projected = registry?.actions.filter((entry) => entry.group === 'actions') ?? []
  return projected.length ? projected : coreActions.map((entry) => ({
    ...entry,
    targeting: { ...entry.targeting },
    execution: cloneJson(entry.execution),
  }))
}
